/**
 * FINAL-RELEASE-PRODUCTION-READY-02 — the LITUBO backup set: the Directus database and the
 * Directus uploads, backed up and restored as one unit.
 *
 * A database dump alone restores rows that point at media files nobody saved; an uploads copy
 * alone restores files no row describes. So a backup set is a directory
 * `litubo-backup-YYYYMMDD-HHMMSS` (UTC) holding exactly four files:
 *
 *   database.dump   pg_dump custom format of the Directus database
 *   uploads.tar     POSIX ustar archive of the Directus uploads directory
 *   SHA256SUMS      `sha256sum -c` compatible checksums of the two components
 *   manifest.json   non-secret metadata, written last: versions, both checksums, a per-table
 *                   row count and content hash of the database, and a per-file inventory
 *                   (path, bytes, SHA-256) of the uploads
 *
 * Consistency is a quiesced backup, not an atomic snapshot. pg_dump reads one consistent
 * database snapshot, but nothing makes that snapshot and a copy of the uploads directory the
 * same instant. The set is consistent because nothing can write either side while it is taken:
 * Directus — the only writer to the database and to the uploads, the Nuxt server included,
 * whose writes all go through it — is stopped, no other client session is connected to the
 * database, and no running container mounts the uploads. `createBackupSet` refuses to start
 * otherwise, and re-checks all of it, plus a database fingerprint, after the copy.
 *
 * Restore is deliberately narrow: into a new database whose name is marked TEST and a new or
 * empty uploads directory whose name is marked TEST, never over live data, and only after
 * every checksum has matched. A production restore is not a mode of this tool.
 *
 * This module never reads the process environment or a .env file and never asks a container for
 * its environment. Postgres credentials stay inside the container, where `$POSTGRES_USER` is
 * expanded by the container's own shell. Output of the database tools is summarized, never
 * echoed, so a failing COPY cannot print row data.
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, mkdir, open, readdir, readFile, rename, stat, statfs, utimes, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORMAT_VERSION = 1
export const TOOL_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SET_NAME_PATTERN = /^litubo-backup-\d{8}-\d{6}$/
export const INCOMPLETE_SUFFIX = '.incomplete'
export const MANIFEST_FILE = 'manifest.json'
export const DATABASE_FILE = 'database.dump'
export const UPLOADS_FILE = 'uploads.tar'
export const CHECKSUMS_FILE = 'SHA256SUMS'
export const SET_COMPONENTS = [MANIFEST_FILE, DATABASE_FILE, UPLOADS_FILE, CHECKSUMS_FILE]

/** Where Directus keeps its files inside its container (docker-compose.yml). */
export const DIRECTUS_UPLOADS_MOUNT = '/directus/uploads'
/** The local development uploads directory (docker-compose.yml + .env.example defaults). */
export const DEV_UPLOADS_DIR = join(TOOL_REPO_ROOT, 'dev-data', 'uploads')
/** The documented production uploads directory (docs/ADMIN-CMS-SETUP.md §6.1). */
export const DOCUMENTED_PRODUCTION_UPLOADS_DIR = '/data/litubo/uploads'

const BLOCK = 512
const RECORD = BLOCK * 20
const CHUNK = 1024 * 1024
const MAX_CAPTURE = 64 * 1024 * 1024
const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/
const CONTAINER_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/
const SHA256_HEX = /^[0-9a-f]{64}$/
const MD5_HEX = /^[0-9a-f]{32}$/
const PRODUCTION_MARKERS = ['prod', 'production', 'live']

/** Names that never belong in a Directus uploads directory; archiving one means the wrong directory was named. */
const FORBIDDEN_UPLOAD_NAMES = [
  /^\.env(\..*)?$/i,
  /^\.git$/i,
  /^PG_VERSION$/,
  /^postgresql(\.auto)?\.conf$/,
  /^pg_hba\.conf$/,
  /^litubo-backup-\d{8}-\d{6}(\.incomplete)?$/,
]

export class BackupError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'BackupError'
    this.code = code
  }
}

// ── naming ──────────────────────────────────────────────────────────────────

/** @param {Date} date */
export function setNameFor(date) {
  const two = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return `litubo-backup-${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}`
    + `-${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}`
}

/** @param {unknown} name */
export function isPlainIdentifier(name) {
  return typeof name === 'string' && IDENTIFIER.test(name)
}

/**
 * @param {unknown} name
 * @param {string} flag
 */
export function assertContainerName(name, flag) {
  if (typeof name !== 'string' || !CONTAINER_NAME.test(name)) {
    throw new BackupError('ARGUMENT_INVALID', `${flag} must name a Docker container (letters, digits, "_", "." or "-").`)
  }
}

/** A database name is a test target only when "test" is one of its underscore-separated parts. */
export function hasTestSegment(/** @type {string} */ name) {
  return /(?:^|_)test(?:_|$)/.test(name)
}

/** A directory name is a test target only when "test" is one of its "-", "_" or "." separated parts. */
export function hasTestSegmentInDirectoryName(/** @type {string} */ name) {
  return /(?:^|[-_.])test(?:[-_.]|$)/i.test(name)
}

/**
 * @param {unknown} name
 * @param {{ sourceDatabase?: string }} [options]
 */
export function assertRestoreDatabaseTarget(name, { sourceDatabase } = {}) {
  if (typeof name !== 'string' || !isPlainIdentifier(name)) {
    throw new BackupError('TARGET_DATABASE_INVALID', `target database ${JSON.stringify(name)} is not a lower-case PostgreSQL identifier ([a-z_][a-z0-9_]*, at most 63 characters).`)
  }
  if (!hasTestSegment(name)) {
    throw new BackupError('TARGET_DATABASE_NOT_TEST', `target database "${name}" is not marked as a test target. Its name must contain "test" as its own underscore-separated part, for example litubo_restore_test_20260916. This tool never restores into a development or production database.`)
  }
  for (const marker of PRODUCTION_MARKERS) {
    if (name.includes(marker)) {
      throw new BackupError('TARGET_DATABASE_NOT_TEST', `target database "${name}" contains "${marker}". This tool restores into disposable test databases only.`)
    }
  }
  if (sourceDatabase !== undefined && name === sourceDatabase) {
    throw new BackupError('TARGET_DATABASE_IS_SOURCE', `target database "${name}" is the database this set was taken from. Restore into a new test database instead.`)
  }
}

// ── paths ───────────────────────────────────────────────────────────────────

/**
 * @param {string} child
 * @param {string} parent
 */
export function isSameOrInside(child, parent) {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

/**
 * @param {string} a
 * @param {string} b
 */
export function samePath(a, b) {
  const norm = (/** @type {string} */ p) => (sep === '\\' ? resolve(p).toLowerCase() : resolve(p))
  return norm(a) === norm(b)
}

/**
 * A relative archive path: "/"-separated, no empty, "." or ".." part, no backslash, colon or
 * control character, at most 255 bytes. Portable across Linux and Windows extraction.
 * @param {unknown} path
 */
export function isSafeRelativePath(path) {
  if (typeof path !== 'string' || path === '' || Buffer.byteLength(path) > 255) return false
  // eslint-disable-next-line no-control-regex
  return path.split('/').every(part => part !== '' && part !== '.' && part !== '..' && !/[\\: -]/.test(part))
}

/**
 * @param {string} relPath repository-relative, "/"-separated
 * @param {string} repoRoot
 * @returns {'ignored' | 'not-ignored' | 'unknown'}
 */
export function gitCheckIgnore(relPath, repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', '--', relPath], { windowsHide: true })
  if (result.status === 0) return 'ignored'
  if (result.status === 1) return 'not-ignored'
  return 'unknown'
}

/**
 * @typedef {{ repoRoot?: string, checkIgnore?: (relPath: string, repoRoot: string) => 'ignored' | 'not-ignored' | 'unknown' }} GitOptions
 */

/**
 * Backup data holds business rows, password hashes and a service token. It must never sit where
 * `git add` could pick it up: a location inside the repository is accepted only when Git ignores it.
 * @param {string} target
 * @param {string} code
 * @param {string} what
 * @param {GitOptions} [options]
 */
export function assertOutsideGitTracking(target, code, what, { repoRoot = TOOL_REPO_ROOT, checkIgnore = gitCheckIgnore } = {}) {
  const abs = resolve(target)
  if (!isSameOrInside(abs, repoRoot)) return
  const rel = relative(resolve(repoRoot), abs).split(sep).join('/')
  if (rel === '') {
    throw new BackupError(code, `${what} is the repository root. Backup data must never live where Git can pick it up.`)
  }
  const verdict = checkIgnore(`${rel}/.litubo-backup-probe`, resolve(repoRoot))
  if (verdict !== 'ignored') {
    const why = verdict === 'not-ignored' ? 'not ignored by Git' : 'of unknown ignore status (git check-ignore did not answer)'
    throw new BackupError(code, `${what} (${rel}) is inside the repository and ${why}. Use a directory outside the repository, or an ignored one such as backups/.`)
  }
}

/**
 * @param {string} outputDir
 * @param {string} uploadsDir
 * @param {GitOptions} [gitOptions]
 */
export async function assertBackupOutput(outputDir, uploadsDir, gitOptions) {
  const output = resolve(outputDir)
  const uploads = resolve(uploadsDir)
  if (isSameOrInside(output, uploads) || isSameOrInside(uploads, output)) {
    throw new BackupError('OUTPUT_OVERLAPS_UPLOADS', `the output directory ${output} overlaps the uploads directory ${uploads}. A backup must not be written into, or around, the data it copies.`)
  }
  assertOutsideGitTracking(output, 'OUTPUT_NOT_GIT_IGNORED', 'the output directory', gitOptions)
  const info = await stat(output).catch(() => null)
  if (!info || !info.isDirectory()) {
    throw new BackupError('OUTPUT_DIR_MISSING', `the output directory ${output} does not exist. Create it deliberately; this tool does not choose a location.`)
  }
}

/**
 * @param {string} targetDir
 * @param {GitOptions & { protectedDirs?: string[] }} [options]
 */
export async function assertRestoreUploadsTarget(targetDir, { protectedDirs = [DEV_UPLOADS_DIR, DOCUMENTED_PRODUCTION_UPLOADS_DIR], ...gitOptions } = {}) {
  const target = resolve(targetDir)
  if (!hasTestSegmentInDirectoryName(basename(target))) {
    throw new BackupError('TARGET_UPLOADS_NOT_TEST', `target uploads directory "${basename(target)}" is not marked as a test target. Its name must contain "test" as its own "-", "_" or "." separated part, for example uploads-restore-test-20260916.`)
  }
  for (const live of protectedDirs) {
    if (isSameOrInside(target, live) || isSameOrInside(live, target)) {
      throw new BackupError('TARGET_UPLOADS_PROTECTED', `target uploads directory ${target} overlaps a live uploads directory (${resolve(live)}). This tool never restores over live media.`)
    }
  }
  assertOutsideGitTracking(target, 'TARGET_UPLOADS_NOT_GIT_IGNORED', 'the target uploads directory', gitOptions)
  const info = await lstat(target).catch((/** @type {NodeJS.ErrnoException} */ error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (info && (!info.isDirectory() || info.isSymbolicLink() || (await readdir(target)).length > 0)) {
    throw new BackupError('TARGET_UPLOADS_NOT_EMPTY', `target uploads directory ${target} already exists and is not an empty directory. A restore writes only into a new or empty directory; it never replaces files.`)
  }
}

// ── checksums ───────────────────────────────────────────────────────────────

/** @param {string} path */
export async function sha256File(path) {
  const hash = createHash('sha256')
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.allocUnsafe(CHUNK)
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
    }
  }
  finally {
    await handle.close()
  }
  return hash.digest('hex')
}

/** @param {{ databaseSha256: string, uploadsSha256: string }} sums */
export function formatChecksums({ databaseSha256, uploadsSha256 }) {
  return `${databaseSha256}  ${DATABASE_FILE}\n${uploadsSha256}  ${UPLOADS_FILE}\n`
}

/**
 * Strict: exactly one line per component, nothing else.
 * @param {string} text
 */
export function parseChecksums(text) {
  /** @type {Map<string, string>} */
  const sums = new Map()
  const lines = String(text).split('\n')
  if (lines.at(-1) === '') lines.pop()
  for (const line of lines) {
    const match = /^([0-9a-f]{64}) {2}(database\.dump|uploads\.tar)$/.exec(line)
    if (!match || sums.has(match[2])) {
      throw new BackupError('CHECKSUMS_INVALID', `${CHECKSUMS_FILE} is not in the expected format.`)
    }
    sums.set(match[2], match[1])
  }
  if (sums.size !== 2) throw new BackupError('CHECKSUMS_INVALID', `${CHECKSUMS_FILE} must list ${DATABASE_FILE} and ${UPLOADS_FILE}.`)
  return sums
}

// ── uploads listing and the ustar archive ───────────────────────────────────

/**
 * @typedef {{ type: 'directory', path: string, mtimeMs: number }} DirectoryEntry
 * @typedef {{ type: 'file', path: string, bytes: number, mtimeMs: number, abs: string }} FileEntry
 * @typedef {DirectoryEntry | FileEntry} UploadEntry
 * @typedef {{ path: string, bytes: number, sha256: string }} InventoryFile
 * @typedef {{ files: InventoryFile[], directories: string[] }} Inventory
 */

/**
 * Lists the uploads directory in a fixed order, refusing anything that is not a plain file or
 * directory: a symbolic link could lead the archive outside the directory it was asked to copy.
 * @param {string} root
 * @returns {Promise<UploadEntry[]>}
 */
export async function listUploads(root) {
  const info = await lstat(root).catch(() => null)
  if (!info || !info.isDirectory() || info.isSymbolicLink()) {
    throw new BackupError('UPLOADS_DIR_MISSING', `the uploads directory ${resolve(root)} does not exist or is not a plain directory.`)
  }
  /** @type {UploadEntry[]} */
  const entries = []
  /**
   * @param {string} abs
   * @param {string} rel
   */
  const walk = async (abs, rel) => {
    for (const name of (await readdir(abs)).sort()) {
      const childAbs = join(abs, name)
      const childRel = rel ? `${rel}/${name}` : name
      if (FORBIDDEN_UPLOAD_NAMES.some(pattern => pattern.test(name)) || !isSafeRelativePath(childRel)) {
        throw new BackupError('UPLOADS_UNEXPECTED_ENTRY', `refusing to archive "${childRel}": it does not belong in a Directus uploads directory, so the wrong directory may have been named.`)
      }
      const child = await lstat(childAbs)
      if (child.isSymbolicLink()) {
        throw new BackupError('UPLOADS_UNEXPECTED_ENTRY', `refusing to archive "${childRel}": symbolic links are not followed.`)
      }
      if (child.isDirectory()) {
        entries.push({ type: 'directory', path: childRel, mtimeMs: child.mtimeMs })
        await walk(childAbs, childRel)
      }
      else if (child.isFile()) {
        entries.push({ type: 'file', path: childRel, bytes: child.size, mtimeMs: child.mtimeMs, abs: childAbs })
      }
      else {
        throw new BackupError('UPLOADS_UNEXPECTED_ENTRY', `refusing to archive "${childRel}": it is neither a file nor a directory.`)
      }
    }
  }
  await walk(root, '')
  return entries
}

/**
 * @param {UploadEntry[]} a
 * @param {UploadEntry[]} b
 */
export function sameListing(a, b) {
  return a.length === b.length && a.every((entry, i) => {
    const other = b[i]
    return entry.type === other.type && entry.path === other.path && entry.mtimeMs === other.mtimeMs
      && (entry.type !== 'file' || (other.type === 'file' && entry.bytes === other.bytes))
  })
}

/**
 * @param {number} value
 * @param {number} width field width including the terminating NUL
 */
function octal(value, width) {
  const digits = Math.floor(value).toString(8)
  if (digits.length > width - 1) throw new BackupError('ARCHIVE_FIELD_OVERFLOW', `a value (${value}) does not fit a ustar header field.`)
  return `${digits.padStart(width - 1, '0')}\0`
}

/** @param {string} full */
function splitUstarName(full) {
  if (Buffer.byteLength(full) <= 100) return { name: full, prefix: '' }
  for (let i = full.length - 1; i > 0; i--) {
    if (full[i] !== '/') continue
    const prefix = full.slice(0, i)
    const name = full.slice(i + 1)
    if (name !== '' && Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) return { name, prefix }
  }
  throw new BackupError('ARCHIVE_PATH_TOO_LONG', `"${full}" is too long for a ustar archive.`)
}

/**
 * One POSIX ustar header block. Exported for the tests, which build hostile archives with it.
 * @param {{ path: string, type: 'file' | 'directory' | 'raw', size: number, mtime: number, typeflag?: string }} entry
 */
export function encodeHeader({ path, type, size, mtime, typeflag }) {
  const header = Buffer.alloc(BLOCK)
  const full = type === 'directory' ? `${path}/` : path
  const { name, prefix } = type === 'raw' ? { name: path, prefix: '' } : splitUstarName(full)
  header.write(name, 0, 100, 'utf8')
  header.write(octal(type === 'directory' ? 0o755 : 0o644, 8), 100, 8, 'ascii')
  header.write(octal(0, 8), 108, 8, 'ascii')
  header.write(octal(0, 8), 116, 8, 'ascii')
  header.write(octal(size, 12), 124, 12, 'ascii')
  header.write(octal(mtime, 12), 136, 12, 'ascii')
  header.fill(0x20, 148, 156)
  header.write(typeflag ?? (type === 'directory' ? '5' : '0'), 156, 1, 'ascii')
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  header.write(prefix, 345, 155, 'utf8')
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return header
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

/**
 * @param {Buffer} block
 * @param {number} start
 * @param {number} length
 */
function headerString(block, start, length) {
  const field = block.subarray(start, start + length)
  const end = field.indexOf(0)
  return utf8.decode(end === -1 ? field : field.subarray(0, end))
}

/**
 * @param {Buffer} block
 * @param {number} start
 * @param {number} length
 */
function headerOctal(block, start, length) {
  const text = block.toString('ascii', start, start + length).replace(/[\0 ]+$/, '').replace(/^ +/, '')
  if (!/^[0-7]+$/.test(text)) return null
  return Number.parseInt(text, 8)
}

/**
 * Reads one header block, accepting only what this tool writes: a checksummed POSIX ustar
 * header for a plain file or a directory, at a safe relative path.
 * @param {Buffer} block
 */
export function decodeHeader(block) {
  const invalid = (/** @type {string} */ why) => new BackupError('ARCHIVE_INVALID', `the uploads archive is not valid: ${why}.`)
  let sum = 0
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : block[i]
  if (headerOctal(block, 148, 8) !== sum) throw invalid('a header checksum does not match')
  if (block.toString('ascii', 257, 263) !== 'ustar\0' || block.toString('ascii', 263, 265) !== '00') throw invalid('a header is not POSIX ustar')
  let name
  let prefix
  try {
    name = headerString(block, 0, 100)
    prefix = headerString(block, 345, 155)
  }
  catch {
    throw invalid('an entry name is not UTF-8')
  }
  const size = headerOctal(block, 124, 12)
  const mtime = headerOctal(block, 136, 12)
  if (size === null || mtime === null) throw invalid('a header has a malformed size or time')
  let path = prefix ? `${prefix}/${name}` : name
  const typeflag = String.fromCharCode(block[156])
  /** @type {'file' | 'directory'} */
  let type
  if (typeflag === '0' || typeflag === '\0') {
    type = 'file'
  }
  else if (typeflag === '5') {
    if (!path.endsWith('/') || size !== 0) throw invalid('a directory entry is malformed')
    path = path.slice(0, -1)
    type = 'directory'
  }
  else {
    throw new BackupError('ARCHIVE_UNSUPPORTED_ENTRY', `the uploads archive contains an entry of type ${JSON.stringify(typeflag)} ("${path}"); only plain files and directories are restored.`)
  }
  if (!isSafeRelativePath(path)) {
    throw new BackupError('ARCHIVE_UNSAFE_PATH', `the uploads archive contains an unsafe path ${JSON.stringify(path)}; nothing outside the target directory may be written.`)
  }
  return { path, type, size, mtime }
}

/**
 * Writes the listed uploads into a new ustar archive, hashing every file as it is copied.
 * A file whose size moves while it is read fails the backup: the directory was not quiet.
 * @param {UploadEntry[]} entries from `listUploads`
 * @param {string} archivePath must not exist
 * @returns {Promise<Inventory>}
 */
export async function writeUploadsArchive(entries, archivePath) {
  const out = await open(archivePath, 'wx')
  /** @type {InventoryFile[]} */
  const files = []
  /** @type {string[]} */
  const directories = []
  let offset = 0
  const write = async (/** @type {Buffer} */ buffer) => {
    await out.write(buffer, 0, buffer.length, offset)
    offset += buffer.length
  }
  try {
    const buffer = Buffer.allocUnsafe(CHUNK)
    for (const entry of entries) {
      const mtime = Math.floor(entry.mtimeMs / 1000)
      if (entry.type === 'directory') {
        await write(encodeHeader({ path: entry.path, type: 'directory', size: 0, mtime }))
        directories.push(entry.path)
        continue
      }
      await write(encodeHeader({ path: entry.path, type: 'file', size: entry.bytes, mtime }))
      const hash = createHash('sha256')
      const source = await open(entry.abs, 'r')
      let copied = 0
      try {
        // Exactly the listed size is copied; a file that shrank fails here, one that grew fails
        // the re-listing after the archive is written.
        while (copied < entry.bytes) {
          const { bytesRead } = await source.read(buffer, 0, Math.min(buffer.length, entry.bytes - copied), copied)
          if (bytesRead === 0) {
            throw new BackupError('QUIESCE_BROKEN', `"${entry.path}" changed size while it was being archived. The uploads directory was not quiet.`)
          }
          const chunk = buffer.subarray(0, bytesRead)
          hash.update(chunk)
          await write(chunk)
          copied += bytesRead
        }
      }
      finally {
        await source.close()
      }
      const padding = (BLOCK - (entry.bytes % BLOCK)) % BLOCK
      if (padding > 0) await write(Buffer.alloc(padding))
      files.push({ path: entry.path, bytes: entry.bytes, sha256: hash.digest('hex') })
    }
    await write(Buffer.alloc(BLOCK * 2))
    const tail = (RECORD - (offset % RECORD)) % RECORD
    if (tail > 0) await write(Buffer.alloc(tail))
    await out.sync()
  }
  finally {
    await out.close()
  }
  return { files, directories }
}

/**
 * Reads a ustar archive written by `writeUploadsArchive`, hashing every file. With `extractTo`,
 * also writes each file there — exclusively, so an existing file is never overwritten — and
 * refuses any path that would land outside it.
 * @param {string} archivePath
 * @param {{ extractTo?: string }} [options]
 * @returns {Promise<Inventory>}
 */
export async function readUploadsArchive(archivePath, { extractTo } = {}) {
  const truncated = () => new BackupError('ARCHIVE_INVALID', 'the uploads archive is truncated.')
  const handle = await open(archivePath, 'r')
  /** @type {InventoryFile[]} */
  const files = []
  /** @type {string[]} */
  const directories = []
  const seen = new Set()
  const root = extractTo ? resolve(extractTo) : null
  try {
    const size = (await handle.stat()).size
    if (size === 0 || size % BLOCK !== 0) throw truncated()
    const header = Buffer.alloc(BLOCK)
    const buffer = Buffer.allocUnsafe(CHUNK)
    /**
     * @param {Buffer} target
     * @param {number} length
     * @param {number} position
     */
    const readExact = async (target, length, position) => {
      const { bytesRead } = await handle.read(target, 0, length, position)
      if (bytesRead !== length) throw truncated()
    }
    let position = 0
    for (;;) {
      if (position + BLOCK > size) throw truncated()
      await readExact(header, BLOCK, position)
      if (header.every(byte => byte === 0)) {
        if (position + 2 * BLOCK > size) throw truncated()
        for (let at = position + BLOCK; at < size; at += CHUNK) {
          const length = Math.min(CHUNK, size - at)
          await readExact(buffer, length, at)
          if (!buffer.subarray(0, length).every(byte => byte === 0)) {
            throw new BackupError('ARCHIVE_INVALID', 'the uploads archive has data after its end-of-archive marker.')
          }
        }
        break
      }
      const entry = decodeHeader(header)
      position += BLOCK
      if (seen.has(entry.path)) throw new BackupError('ARCHIVE_INVALID', `the uploads archive lists "${entry.path}" twice.`)
      seen.add(entry.path)
      const destination = root ? join(root, ...entry.path.split('/')) : null
      if (destination && root && (!isSameOrInside(destination, root) || destination === root)) {
        throw new BackupError('ARCHIVE_UNSAFE_PATH', `the uploads archive entry "${entry.path}" would be written outside the target directory.`)
      }
      if (entry.type === 'directory') {
        if (destination) await mkdir(destination, { recursive: true })
        directories.push(entry.path)
        continue
      }
      if (position + entry.size > size) throw truncated()
      const hash = createHash('sha256')
      const outFile = destination ? await (async () => {
        await mkdir(dirname(destination), { recursive: true })
        return open(destination, 'wx')
      })() : null
      try {
        let remaining = entry.size
        let at = position
        while (remaining > 0) {
          const length = Math.min(CHUNK, remaining)
          await readExact(buffer, length, at)
          const chunk = buffer.subarray(0, length)
          hash.update(chunk)
          if (outFile) await outFile.write(chunk, 0, length, at - position)
          at += length
          remaining -= length
        }
        if (outFile) await outFile.sync()
      }
      finally {
        if (outFile) await outFile.close()
      }
      if (destination) await utimes(destination, entry.mtime, entry.mtime)
      files.push({ path: entry.path, bytes: entry.size, sha256: hash.digest('hex') })
      position += entry.size + ((BLOCK - (entry.size % BLOCK)) % BLOCK)
    }
  }
  finally {
    await handle.close()
  }
  return { files, directories }
}

/**
 * @param {Inventory} expected
 * @param {Inventory} actual
 * @returns {string[]} one line per difference; empty when identical
 */
export function compareInventories(expected, actual) {
  const problems = []
  const want = new Map(expected.files.map(file => [file.path, file]))
  const got = new Map(actual.files.map(file => [file.path, file]))
  if (got.size !== actual.files.length || want.size !== expected.files.length) problems.push('a file is listed twice')
  for (const [path, file] of want) {
    const other = got.get(path)
    if (!other) problems.push(`missing file ${path}`)
    else if (other.bytes !== file.bytes || other.sha256 !== file.sha256) problems.push(`different bytes: ${path}`)
  }
  for (const path of got.keys()) {
    if (!want.has(path)) problems.push(`unexpected file ${path}`)
  }
  const wantDirs = new Set(expected.directories)
  const gotDirs = new Set(actual.directories)
  for (const dir of wantDirs) if (!gotDirs.has(dir)) problems.push(`missing directory ${dir}`)
  for (const dir of gotDirs) if (!wantDirs.has(dir)) problems.push(`unexpected directory ${dir}`)
  return problems
}

// ── database fingerprint ────────────────────────────────────────────────────

const USER_SCHEMAS = `n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'`

/**
 * One read-only snapshot of the whole database: every table's row count and a hash of its
 * content (order-independent), every sequence position, object counts, and a hash of the
 * schema definitions (columns, constraints, indexes, triggers, functions). Session settings
 * are pinned so the same data renders the same text on any server of the same major version.
 */
export const FINGERPRINT_SQL = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL TimeZone = 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL IntervalStyle = 'postgres';
SET LOCAL extra_float_digits = 1;
SET LOCAL bytea_output = 'hex';
SELECT concat_ws(E'\\t', 'TABLE', format('%s.%s', s, r),
  (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', s, r), false, true, '')))[1]::text,
  (xpath('/row/h/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(x.h, '''' ORDER BY x.h), '''')) AS h FROM (SELECT md5(t::text) AS h FROM %I.%I t) x', s, r), false, true, '')))[1]::text)
FROM (SELECT n.nspname AS s, c.relname AS r FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND ${USER_SCHEMAS}) rels
ORDER BY s, r;
SELECT concat_ws(E'\\t', 'SEQUENCE', format('%s.%s', schemaname, sequencename), coalesce(last_value::text, 'null'))
FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, sequencename;
SELECT concat_ws(E'\\t', 'OBJECTS',
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r', 'p') AND ${USER_SCHEMAS}),
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm') AND ${USER_SCHEMAS}),
  (SELECT count(*) FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname NOT LIKE 'pg_toast%'),
  (SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace WHERE ${USER_SCHEMAS}),
  (SELECT count(*) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT g.tgisinternal AND ${USER_SCHEMAS}),
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE ${USER_SCHEMAS}),
  (SELECT count(*) FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog', 'information_schema')));
SELECT concat_ws(E'\\t', 'SCHEMA', md5(coalesce(string_agg(d, E'\\n' ORDER BY d), ''))) FROM (
  SELECT format('column %I.%I.%I %s %s %s', n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, coalesce(pg_get_expr(ad.adbin, ad.adrelid), '')) AS d
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm') AND ${USER_SCHEMAS}
  UNION ALL
  SELECT format('constraint %I.%I.%I %s', n.nspname, coalesce(c.relname, '-'), k.conname, pg_get_constraintdef(k.oid))
  FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace LEFT JOIN pg_class c ON c.oid = k.conrelid WHERE ${USER_SCHEMAS}
  UNION ALL
  SELECT format('index %s', indexdef) FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname NOT LIKE 'pg_toast%'
  UNION ALL
  SELECT format('trigger %s', pg_get_triggerdef(g.oid)) FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE NOT g.tgisinternal AND ${USER_SCHEMAS}
  UNION ALL
  SELECT format('function %s', pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.prokind IN ('f', 'p') AND ${USER_SCHEMAS}
) defs;
SELECT 'DONE';
COMMIT;
`

export const FINGERPRINT_OBJECT_KEYS = ['tables', 'views', 'indexes', 'constraints', 'triggers', 'functions', 'sequences']

/**
 * @typedef {{ name: string, rows: number, hash: string }} TableFingerprint
 * @typedef {{ name: string, lastValue: string }} SequenceFingerprint
 * @typedef {{ tables: TableFingerprint[], sequences: SequenceFingerprint[], objects: Record<string, number>, schemaHash: string }} DatabaseFingerprint
 */

/**
 * Only a complete answer is accepted: known line kinds, one OBJECTS and one SCHEMA line, counts
 * that agree with the lines, and DONE last.
 * @param {string} stdout
 * @returns {{ ok: true, fingerprint: DatabaseFingerprint } | { ok: false, reason: string }}
 */
export function parseFingerprint(stdout) {
  /** @type {TableFingerprint[]} */
  const tables = []
  /** @type {SequenceFingerprint[]} */
  const sequences = []
  /** @type {Record<string, number> | null} */
  let objects = null
  /** @type {string | null} */
  let schemaHash = null
  let done = false
  for (const line of String(stdout).split(/\r?\n/)) {
    if (line === '') continue
    if (done) return { ok: false, reason: 'output after DONE' }
    const parts = line.split('\t')
    if (parts[0] === 'TABLE' && parts.length === 4 && parts[1] !== '' && /^\d+$/.test(parts[2]) && MD5_HEX.test(parts[3])) {
      tables.push({ name: parts[1], rows: Number(parts[2]), hash: parts[3] })
    }
    else if (parts[0] === 'SEQUENCE' && parts.length === 3 && parts[1] !== '' && /^(-?\d+|null)$/.test(parts[2])) {
      sequences.push({ name: parts[1], lastValue: parts[2] })
    }
    else if (parts[0] === 'OBJECTS' && parts.length === FINGERPRINT_OBJECT_KEYS.length + 1 && objects === null && parts.slice(1).every(p => /^\d+$/.test(p))) {
      objects = Object.fromEntries(FINGERPRINT_OBJECT_KEYS.map((key, i) => [key, Number(parts[i + 1])]))
    }
    else if (parts[0] === 'SCHEMA' && parts.length === 2 && schemaHash === null && MD5_HEX.test(parts[1])) {
      schemaHash = parts[1]
    }
    else if (line === 'DONE') {
      done = true
    }
    else {
      return { ok: false, reason: 'an unrecognised line' }
    }
  }
  if (!done) return { ok: false, reason: 'no completion line' }
  if (!objects || !schemaHash) return { ok: false, reason: 'no object counts or schema hash' }
  if (objects.tables !== tables.length || objects.sequences !== sequences.length) return { ok: false, reason: 'counts that disagree with the listed tables or sequences' }
  return { ok: true, fingerprint: { tables, sequences, objects, schemaHash } }
}

/**
 * @param {DatabaseFingerprint} fingerprint
 * @returns {string}
 */
export function formatFingerprint(fingerprint) {
  return [
    ...fingerprint.tables.map(t => `TABLE\t${t.name}\t${t.rows}\t${t.hash}`),
    ...fingerprint.sequences.map(s => `SEQUENCE\t${s.name}\t${s.lastValue}`),
    `OBJECTS\t${FINGERPRINT_OBJECT_KEYS.map(key => fingerprint.objects[key]).join('\t')}`,
    `SCHEMA\t${fingerprint.schemaHash}`,
    'DONE',
    '',
  ].join('\n')
}

/**
 * @param {DatabaseFingerprint} expected
 * @param {DatabaseFingerprint} actual
 * @returns {string[]} one line per difference; empty when identical
 */
export function compareFingerprints(expected, actual) {
  const problems = []
  for (const key of FINGERPRINT_OBJECT_KEYS) {
    if (expected.objects[key] !== actual.objects[key]) problems.push(`${key}: ${expected.objects[key]} → ${actual.objects[key]}`)
  }
  if (expected.schemaHash !== actual.schemaHash) problems.push('schema definitions differ')
  const got = new Map(actual.tables.map(t => [t.name, t]))
  for (const table of expected.tables) {
    const other = got.get(table.name)
    if (!other) problems.push(`table ${table.name} missing`)
    else if (other.rows !== table.rows) problems.push(`table ${table.name}: ${table.rows} → ${other.rows} rows`)
    else if (other.hash !== table.hash) problems.push(`table ${table.name}: content differs`)
  }
  const want = new Set(expected.tables.map(t => t.name))
  for (const table of actual.tables) if (!want.has(table.name)) problems.push(`table ${table.name} unexpected`)
  const gotSequences = new Map(actual.sequences.map(s => [s.name, s.lastValue]))
  for (const sequence of expected.sequences) {
    const value = gotSequences.get(sequence.name)
    if (value === undefined) problems.push(`sequence ${sequence.name} missing`)
    else if (value !== sequence.lastValue) problems.push(`sequence ${sequence.name}: ${sequence.lastValue} → ${value}`)
  }
  const wantSequences = new Set(expected.sequences.map(s => s.name))
  for (const sequence of actual.sequences) if (!wantSequences.has(sequence.name)) problems.push(`sequence ${sequence.name} unexpected`)
  return problems
}

/**
 * `pg_restore --list` output, reduced to what the backup checks: TOC entries, tables and table data.
 * @param {string} listing
 */
export function summarizeToc(listing) {
  let entries = 0
  let tables = 0
  let tableData = 0
  for (const line of String(listing).split(/\r?\n/)) {
    const match = /^\d+; \d+ \d+ (.+)$/.exec(line)
    if (!match) continue
    entries++
    if (match[1].startsWith('TABLE DATA ')) tableData++
    else if (match[1].startsWith('TABLE ')) tables++
  }
  return { entries, tables, tableData }
}

// ── manifest ────────────────────────────────────────────────────────────────

export const MANIFEST_KEYS = [
  'formatVersion', 'createdAt', 'setName', 'consistencyModel', 'gitCommit', 'nodeVersion',
  'directusVersion', 'directusImageDigest', 'postgresVersion', 'pgDumpVersion',
  'databaseName', 'databaseFile', 'databaseFormat', 'databaseBytes', 'databaseSha256', 'databaseTocEntries', 'databaseFingerprint',
  'uploadsFile', 'uploadsFormat', 'uploadsBytes', 'uploadsSha256', 'uploadsFileCount', 'uploadsTotalBytes', 'uploadsDirectories', 'uploadsFiles',
]

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {unknown} value */
function isCount(value) {
  return Number.isSafeInteger(value) && /** @type {number} */ (value) >= 0
}

/**
 * @param {unknown} value
 * @param {string[]} keys
 */
function hasExactKeys(value, keys) {
  return isPlainObject(value) && Object.keys(/** @type {object} */ (value)).length === keys.length && keys.every(key => key in /** @type {object} */ (value))
}

/**
 * The manifest is an allowlist: an unknown field is refused, so nothing — a credential included —
 * can ride along in it unnoticed.
 * @param {unknown} value
 * @returns {asserts value is Record<string, any>}
 */
export function validateManifest(value) {
  const fail = (/** @type {string} */ why) => {
    throw new BackupError('MANIFEST_INVALID', `${MANIFEST_FILE} is not a valid LITUBO backup manifest: ${why}.`)
  }
  if (!isPlainObject(value)) fail('it is not a JSON object')
  const manifest = /** @type {Record<string, any>} */ (value)
  const unexpected = Object.keys(manifest).filter(key => !MANIFEST_KEYS.includes(key))
  if (unexpected.length > 0) fail(`unexpected field(s) ${unexpected.join(', ')}`)
  const missing = MANIFEST_KEYS.filter(key => !(key in manifest))
  if (missing.length > 0) fail(`missing field(s) ${missing.join(', ')}`)
  if (manifest.formatVersion !== FORMAT_VERSION) {
    throw new BackupError('MANIFEST_UNSUPPORTED', `${MANIFEST_FILE} has format version ${JSON.stringify(manifest.formatVersion)}; this tool reads version ${FORMAT_VERSION} only.`)
  }
  if (typeof manifest.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) fail('createdAt is not an ISO UTC timestamp')
  if (typeof manifest.setName !== 'string' || !SET_NAME_PATTERN.test(manifest.setName) || setNameFor(new Date(manifest.createdAt)) !== manifest.setName) fail('setName does not match createdAt')
  if (manifest.consistencyModel !== 'quiesced') fail('consistencyModel must be "quiesced"')
  if (typeof manifest.gitCommit !== 'string' || !/^([0-9a-f]{40}|unknown)$/.test(manifest.gitCommit)) fail('gitCommit is malformed')
  if (typeof manifest.nodeVersion !== 'string' || !/^v\d+\.\d+\.\d+$/.test(manifest.nodeVersion)) fail('nodeVersion is malformed')
  if (typeof manifest.directusVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.directusVersion)) fail('directusVersion is malformed')
  if (typeof manifest.directusImageDigest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(manifest.directusImageDigest)) fail('directusImageDigest is malformed')
  if (typeof manifest.postgresVersion !== 'string' || !/^\d+(\.\d+)*$/.test(manifest.postgresVersion)) fail('postgresVersion is malformed')
  if (typeof manifest.pgDumpVersion !== 'string' || !/^pg_dump \(PostgreSQL\) \d+(\.\d+)*$/.test(manifest.pgDumpVersion)) fail('pgDumpVersion is malformed')
  if (!isPlainIdentifier(manifest.databaseName)) fail('databaseName is not a plain identifier')
  if (manifest.databaseFile !== DATABASE_FILE || manifest.uploadsFile !== UPLOADS_FILE) fail('component file names are not the canonical ones')
  if (manifest.databaseFormat !== 'pg_dump-custom' || manifest.uploadsFormat !== 'ustar') fail('component formats are not the supported ones')
  if (!isCount(manifest.databaseBytes) || manifest.databaseBytes === 0) fail('databaseBytes is not a positive count')
  if (!isCount(manifest.uploadsBytes) || manifest.uploadsBytes < 2 * BLOCK || manifest.uploadsBytes % BLOCK !== 0) fail('uploadsBytes is not a valid archive size')
  if (typeof manifest.databaseSha256 !== 'string' || !SHA256_HEX.test(manifest.databaseSha256)) fail('databaseSha256 is malformed')
  if (typeof manifest.uploadsSha256 !== 'string' || !SHA256_HEX.test(manifest.uploadsSha256)) fail('uploadsSha256 is malformed')
  if (!isCount(manifest.databaseTocEntries) || manifest.databaseTocEntries === 0) fail('databaseTocEntries is not a positive count')

  const fingerprint = manifest.databaseFingerprint
  if (!hasExactKeys(fingerprint, ['tables', 'sequences', 'objects', 'schemaHash'])) fail('databaseFingerprint has the wrong shape')
  if (!Array.isArray(fingerprint.tables) || !fingerprint.tables.every((/** @type {unknown} */ t) => hasExactKeys(t, ['name', 'rows', 'hash'])
    && typeof (/** @type {any} */ (t)).name === 'string' && /^[^\t\r\n]+$/.test((/** @type {any} */ (t)).name) && isCount((/** @type {any} */ (t)).rows) && MD5_HEX.test((/** @type {any} */ (t)).hash))) fail('databaseFingerprint.tables is malformed')
  if (!Array.isArray(fingerprint.sequences) || !fingerprint.sequences.every((/** @type {unknown} */ s) => hasExactKeys(s, ['name', 'lastValue'])
    && typeof (/** @type {any} */ (s)).name === 'string' && /^[^\t\r\n]+$/.test((/** @type {any} */ (s)).name) && typeof (/** @type {any} */ (s)).lastValue === 'string' && /^(-?\d+|null)$/.test((/** @type {any} */ (s)).lastValue))) fail('databaseFingerprint.sequences is malformed')
  if (!hasExactKeys(fingerprint.objects, FINGERPRINT_OBJECT_KEYS) || !FINGERPRINT_OBJECT_KEYS.every(key => isCount(fingerprint.objects[key]))) fail('databaseFingerprint.objects is malformed')
  if (fingerprint.objects.tables !== fingerprint.tables.length || fingerprint.objects.sequences !== fingerprint.sequences.length) fail('databaseFingerprint counts disagree with its lists')
  if (typeof fingerprint.schemaHash !== 'string' || !MD5_HEX.test(fingerprint.schemaHash)) fail('databaseFingerprint.schemaHash is malformed')

  if (!Array.isArray(manifest.uploadsDirectories) || !manifest.uploadsDirectories.every(isSafeRelativePath) || new Set(manifest.uploadsDirectories).size !== manifest.uploadsDirectories.length) fail('uploadsDirectories is malformed')
  if (!Array.isArray(manifest.uploadsFiles) || !manifest.uploadsFiles.every((/** @type {unknown} */ f) => hasExactKeys(f, ['path', 'bytes', 'sha256'])
    && isSafeRelativePath((/** @type {any} */ (f)).path) && isCount((/** @type {any} */ (f)).bytes) && typeof (/** @type {any} */ (f)).sha256 === 'string' && SHA256_HEX.test((/** @type {any} */ (f)).sha256))) fail('uploadsFiles is malformed')
  if (new Set(manifest.uploadsFiles.map((/** @type {InventoryFile} */ f) => f.path)).size !== manifest.uploadsFiles.length) fail('uploadsFiles lists a path twice')
  if (manifest.uploadsFileCount !== manifest.uploadsFiles.length) fail('uploadsFileCount disagrees with uploadsFiles')
  const total = manifest.uploadsFiles.reduce((/** @type {number} */ sum, /** @type {InventoryFile} */ f) => sum + f.bytes, 0)
  if (!isCount(manifest.uploadsTotalBytes) || manifest.uploadsTotalBytes !== total) fail('uploadsTotalBytes disagrees with uploadsFiles')
}

/**
 * Everything a restore checks before it changes anything: the set is named and complete, the
 * manifest is valid, SHA256SUMS agrees with it, and both components hash to the recorded values.
 * @param {string} setDir
 */
export async function verifyBackupSet(setDir) {
  const dir = resolve(setDir)
  const name = basename(dir)
  if (name.endsWith(INCOMPLETE_SUFFIX)) {
    throw new BackupError('SET_INCOMPLETE', `${name} is marked incomplete: the backup that produced it did not finish. It cannot be restored.`)
  }
  if (!SET_NAME_PATTERN.test(name)) {
    throw new BackupError('SET_NAME_INVALID', `${name} is not a backup set name (litubo-backup-YYYYMMDD-HHMMSS).`)
  }
  const info = await stat(dir).catch(() => null)
  if (!info || !info.isDirectory()) throw new BackupError('SET_NOT_FOUND', `backup set ${dir} does not exist.`)
  const missing = []
  for (const component of SET_COMPONENTS) {
    const entry = await lstat(join(dir, component)).catch(() => null)
    if (!entry || !entry.isFile()) missing.push(component)
  }
  if (missing.length > 0) {
    throw new BackupError('SET_COMPONENT_MISSING', `backup set ${name} is incomplete — missing ${missing.join(', ')}. A partial set is never restored.`)
  }
  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'))
  }
  catch {
    throw new BackupError('MANIFEST_INVALID', `${MANIFEST_FILE} is not valid JSON.`)
  }
  validateManifest(parsed)
  const manifest = parsed
  if (manifest.setName !== name) {
    throw new BackupError('MANIFEST_INVALID', `${MANIFEST_FILE} describes ${manifest.setName}, not ${name}.`)
  }
  const sums = parseChecksums(await readFile(join(dir, CHECKSUMS_FILE), 'utf8'))
  if (sums.get(DATABASE_FILE) !== manifest.databaseSha256 || sums.get(UPLOADS_FILE) !== manifest.uploadsSha256) {
    throw new BackupError('CHECKSUM_MISMATCH', `${CHECKSUMS_FILE} and ${MANIFEST_FILE} disagree about a component checksum.`)
  }
  for (const [file, bytes, sha256] of /** @type {[string, number, string][]} */ ([
    [DATABASE_FILE, manifest.databaseBytes, manifest.databaseSha256],
    [UPLOADS_FILE, manifest.uploadsBytes, manifest.uploadsSha256],
  ])) {
    const path = join(dir, file)
    if ((await stat(path)).size !== bytes || (await sha256File(path)) !== sha256) {
      throw new BackupError('CHECKSUM_MISMATCH', `${file} does not match its recorded SHA-256. The set is damaged; nothing was restored.`)
    }
  }
  return manifest
}

// ── processes and Docker ────────────────────────────────────────────────────

/**
 * @typedef {{ code: number, stdout: string, stderr: string, truncated: boolean }} RunResult
 * @typedef {(command: string, args: string[], options?: { input?: string }) => Promise<RunResult>} Runner
 */

/** @type {Runner} */
export function runProcess(command, args, { input } = {}) {
  return new Promise((done) => {
    let settled = false
    /** @param {RunResult} result */
    const finish = (result) => {
      if (!settled) {
        settled = true
        done(result)
      }
    }
    const child = spawn(command, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    /** @type {Buffer[]} */
    const out = []
    /** @type {Buffer[]} */
    const err = []
    let outBytes = 0
    let errBytes = 0
    let truncated = false
    child.stdout.on('data', (/** @type {Buffer} */ chunk) => {
      outBytes += chunk.length
      if (outBytes <= MAX_CAPTURE) out.push(chunk)
      else truncated = true
    })
    child.stderr.on('data', (/** @type {Buffer} */ chunk) => {
      errBytes += chunk.length
      if (errBytes <= MAX_CAPTURE) err.push(chunk)
    })
    child.on('error', () => finish({ code: 127, stdout: '', stderr: `${command}: could not be started`, truncated: false }))
    child.on('close', code => finish({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), truncated }))
    child.stdin.on('error', () => {})
    child.stdin.end(input ?? '')
  })
}

/**
 * Reduces database-tool stderr to at most three diagnostic lines, dropping DETAIL / CONTEXT
 * text, so a failure explains itself without printing row data.
 * @param {string} stderr
 */
export function summarizeToolError(stderr) {
  const kept = String(stderr ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^(pg_dump|pg_restore|psql|sha256sum|sh|docker)\b.*?:\s/i.test(line) || /^(ERROR|FATAL):/.test(line))
    .map(line => line.replace(/\s+(DETAIL|CONTEXT|HINT):.*$/, ''))
    .map(line => (line.length > 240 ? `${line.slice(0, 240)}…` : line))
    .slice(0, 3)
  return kept.length > 0 ? kept.join(' | ') : 'no diagnostic line (tool output is summarized, never echoed)'
}

/**
 * @typedef {{
 *   ping: () => Promise<boolean>,
 *   state: (container: string) => Promise<'running' | 'stopped' | 'missing'>,
 *   image: (container: string) => Promise<string | null>,
 *   mountSource: (container: string, destination: string) => Promise<string | null>,
 *   runningContainersMounting: (dir: string) => Promise<string[]>,
 *   exec: (container: string, script: string, input?: string) => Promise<RunResult>,
 *   copyOut: (container: string, from: string, to: string) => Promise<RunResult>,
 *   copyIn: (container: string, from: string, to: string) => Promise<RunResult>,
 * }} DockerOps
 */

/**
 * The only Docker calls these tools make. `inspect` reads state, image, name and mounts —
 * never the container's environment.
 * @param {Runner} [run]
 * @returns {DockerOps}
 */
export function createDocker(run = runProcess) {
  const inspect = async (/** @type {string[]} */ names, /** @type {string} */ format) => {
    const result = await run('docker', ['inspect', '--type', 'container', '--format', format, ...names])
    return result.code === 0 ? result.stdout : null
  }
  return {
    async ping() {
      const result = await run('docker', ['version', '--format', '{{.Server.Version}}'])
      return result.code === 0 && result.stdout.trim() !== ''
    },
    async state(container) {
      const out = await inspect([container], '{{.State.Running}}')
      if (out === null) return 'missing'
      return out.trim() === 'true' ? 'running' : 'stopped'
    },
    async image(container) {
      const out = await inspect([container], '{{.Config.Image}}')
      return out === null ? null : out.trim()
    },
    async mountSource(container, destination) {
      const out = await inspect([container], '{{range .Mounts}}{{.Destination}}{{"\\t"}}{{.Source}}{{"\\n"}}{{end}}')
      if (out === null) return null
      const line = out.split(/\r?\n/).find(entry => entry.split('\t')[0] === destination)
      return line ? line.split('\t').slice(1).join('\t') : null
    },
    async runningContainersMounting(dir) {
      const ps = await run('docker', ['ps', '--quiet', '--no-trunc'])
      if (ps.code !== 0) throw new BackupError('DOCKER_UNAVAILABLE', 'could not list running containers.')
      const ids = ps.stdout.split(/\s+/).filter(Boolean)
      if (ids.length === 0) return []
      const out = await inspect(ids, '{{.Name}}{{range .Mounts}}{{"\\t"}}{{.Source}}{{end}}{{"\\n"}}')
      if (out === null) throw new BackupError('DOCKER_UNAVAILABLE', 'could not inspect running containers.')
      return out.split(/\r?\n/).filter(Boolean)
        .map(line => line.split('\t'))
        .filter(([, ...sources]) => sources.some(source => source !== '' && samePath(source, dir)))
        .map(([name]) => name.replace(/^\//, ''))
    },
    exec(container, script, input) {
      return run('docker', ['exec', '-i', container, 'sh', '-c', script], { input })
    },
    copyOut(container, from, to) {
      return run('docker', ['cp', `${container}:${from}`, to])
    },
    copyIn(container, from, to) {
      return run('docker', ['cp', from, `${container}:${to}`])
    },
  }
}

/** @param {string} database a validated identifier */
function psqlCommand(database) {
  return `psql -X -q -A -t -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d ${database}`
}

/**
 * @param {DockerOps} docker
 * @param {string} container
 * @param {string} database
 * @param {string} sql
 */
async function queryScalar(docker, container, database, sql) {
  const result = await docker.exec(container, psqlCommand(database), sql)
  if (result.code !== 0 || result.truncated) {
    throw new BackupError('DATABASE_QUERY_FAILED', `a query against ${database} failed: ${summarizeToolError(result.stderr)}`)
  }
  return result.stdout.trim()
}

/**
 * @param {DockerOps} docker
 * @param {string} container
 * @param {string} database
 */
export async function fingerprintDatabase(docker, container, database) {
  const result = await docker.exec(container, psqlCommand(database), FINGERPRINT_SQL)
  if (result.code !== 0 || result.truncated) {
    throw new BackupError('FINGERPRINT_FAILED', `could not fingerprint database ${database}: ${summarizeToolError(result.stderr)}`)
  }
  const parsed = parseFingerprint(result.stdout)
  if (!parsed.ok) throw new BackupError('FINGERPRINT_FAILED', `database ${database} answered the fingerprint query with ${parsed.reason}.`)
  return parsed.fingerprint
}

/**
 * @param {DockerOps} docker
 * @param {string} container
 * @param {string[]} tools
 */
async function assertContainerTools(docker, container, tools) {
  const script = tools.map(tool => `command -v ${tool} >/dev/null 2>&1 || { echo ${tool}; exit 3; }`).join('; ')
  const result = await docker.exec(container, script)
  if (result.code !== 0) {
    throw new BackupError('TOOLS_MISSING', `the Postgres container ${container} lacks ${result.stdout.trim() || 'a required tool'}.`)
  }
}

/**
 * @param {DockerOps} docker
 * @param {string} container
 * @param {string} database
 * @param {string} code
 */
async function assertNoClientSessions(docker, container, database, code) {
  const count = await queryScalar(docker, container, 'postgres',
    `SELECT count(*) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid() AND backend_type = 'client backend';`)
  if (count !== '0') {
    throw new BackupError(code, `${count} client session(s) are connected to ${database}. A quiesced backup needs every writer stopped (docker compose stop directus) and no other connection to the database.`)
  }
}

/** @param {string | null} reference */
export function parseDirectusImage(reference) {
  const match = /^directus\/directus:(\d+\.\d+\.\d+)@(sha256:[0-9a-f]{64})$/.exec(reference ?? '')
  if (!match) {
    throw new BackupError('IMAGE_NOT_PINNED', `the Directus container was created from ${JSON.stringify(reference)}, not an exact version pinned by digest. The manifest must record exactly which Directus the data belongs to.`)
  }
  return { version: match[1], digest: match[2] }
}

/** @param {string} repoRoot */
function readGitCommit(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true })
  const sha = result.status === 0 ? result.stdout.trim() : ''
  return /^[0-9a-f]{40}$/.test(sha) ? sha : 'unknown'
}

/** @param {string} path */
async function pathExists(path) {
  return (await lstat(path).catch(() => null)) !== null
}

/** @param {string} version */
function majorOf(version) {
  return Number.parseInt(String(version).split('.')[0], 10)
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

// ── backup ──────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   docker?: DockerOps,
 *   log?: (line: string) => void,
 *   now?: () => Date,
 *   repoRoot?: string,
 *   checkIgnore?: GitOptions['checkIgnore'],
 * }} Dependencies
 */

/**
 * Creates one backup set. Refuses to start unless the source is quiesced, re-checks quiescence
 * after the copy, and writes the manifest only once every component has been verified. On
 * failure the partial directory keeps its `.incomplete` suffix and has no manifest.
 * @param {{ postgresContainer: string, database: string, directusContainer: string, uploadsDir: string, outputDir: string }} options
 * @param {Dependencies} [deps]
 */
export async function createBackupSet(options, deps = {}) {
  const docker = deps.docker ?? createDocker()
  const log = deps.log ?? (() => {})
  const now = deps.now ?? (() => new Date())
  const repoRoot = deps.repoRoot ?? TOOL_REPO_ROOT
  const gitOptions = { repoRoot, checkIgnore: deps.checkIgnore ?? gitCheckIgnore }
  const { postgresContainer, database, directusContainer } = options
  const startedAt = Date.now()

  assertContainerName(postgresContainer, '--postgres-container')
  assertContainerName(directusContainer, '--directus-container')
  if (!isPlainIdentifier(database)) throw new BackupError('ARGUMENT_INVALID', '--database must be a lower-case PostgreSQL identifier.')
  if (!options.uploadsDir) throw new BackupError('ARGUMENT_INVALID', '--uploads-dir is required.')
  if (!options.outputDir) throw new BackupError('ARGUMENT_INVALID', '--output-dir is required.')
  const uploadsDir = resolve(options.uploadsDir)
  const outputDir = resolve(options.outputDir)
  await assertBackupOutput(outputDir, uploadsDir, gitOptions)
  const entries = await listUploads(uploadsDir)

  // The source must be quiet: Directus stopped, nothing else mounting the uploads, nobody connected.
  if (!(await docker.ping())) throw new BackupError('DOCKER_UNAVAILABLE', 'Docker is not reachable.')
  if ((await docker.state(postgresContainer)) !== 'running') throw new BackupError('POSTGRES_NOT_RUNNING', `the Postgres container ${postgresContainer} is not running.`)
  const directusState = await docker.state(directusContainer)
  if (directusState === 'missing') throw new BackupError('DIRECTUS_CONTAINER_MISSING', `there is no container named ${directusContainer}.`)
  if (directusState === 'running') {
    throw new BackupError('NOT_QUIESCED', `Directus (${directusContainer}) is running, so the database and the uploads can still change. Stop it first (docker compose stop directus) and start it again after the backup.`)
  }
  const mounted = await docker.mountSource(directusContainer, DIRECTUS_UPLOADS_MOUNT)
  if (!mounted) throw new BackupError('UPLOADS_SOURCE_UNKNOWN', `${directusContainer} has no mount at ${DIRECTUS_UPLOADS_MOUNT}, so the uploads directory cannot be confirmed.`)
  if (!samePath(mounted, uploadsDir)) {
    throw new BackupError('UPLOADS_SOURCE_MISMATCH', `--uploads-dir ${uploadsDir} is not the directory ${directusContainer} stores its files in (${mounted}).`)
  }
  const mounting = await docker.runningContainersMounting(uploadsDir)
  if (mounting.length > 0) {
    throw new BackupError('NOT_QUIESCED', `running container(s) ${mounting.join(', ')} mount the uploads directory. Stop them before the backup.`)
  }
  const directus = parseDirectusImage(await docker.image(directusContainer))
  await assertContainerTools(docker, postgresContainer, ['pg_dump', 'pg_restore', 'sha256sum'])
  if ((await queryScalar(docker, postgresContainer, 'postgres', `SELECT count(*) FROM pg_database WHERE datname = '${database}';`)) !== '1') {
    throw new BackupError('DATABASE_MISSING', `database ${database} does not exist in ${postgresContainer}.`)
  }
  await assertNoClientSessions(docker, postgresContainer, database, 'NOT_QUIESCED')

  const uploadsTotalBytes = entries.reduce((sum, entry) => sum + (entry.type === 'file' ? entry.bytes : 0), 0)
  const databaseSize = Number(await queryScalar(docker, postgresContainer, 'postgres', `SELECT pg_database_size('${database}');`))
  const volume = await statfs(outputDir)
  const needed = Math.ceil((uploadsTotalBytes + databaseSize) * 1.1) + 16 * 1024 * 1024
  if (volume.bavail * volume.bsize < needed) {
    throw new BackupError('INSUFFICIENT_SPACE', `the output volume has ${formatBytes(volume.bavail * volume.bsize)} free; this backup needs about ${formatBytes(needed)}.`)
  }
  const postgresVersion = await queryScalar(docker, postgresContainer, 'postgres', 'SHOW server_version;')
  const pgDump = await docker.exec(postgresContainer, 'pg_dump --version')
  const pgDumpVersion = pgDump.stdout.trim()
  if (pgDump.code !== 0 || !/^pg_dump \(PostgreSQL\) \d+(\.\d+)*$/.test(pgDumpVersion)) {
    throw new BackupError('TOOLS_MISSING', 'pg_dump did not report a version.')
  }

  const createdAt = now()
  const setName = setNameFor(createdAt)
  const finalDir = join(outputDir, setName)
  const stagingDir = `${finalDir}${INCOMPLETE_SUFFIX}`
  if (await pathExists(finalDir) || await pathExists(stagingDir)) {
    throw new BackupError('SET_EXISTS', `${setName} already exists in ${outputDir}.`)
  }
  await mkdir(stagingDir)
  log(`  set              ${setName} (writing into ${basename(stagingDir)})`)

  try {
    const before = await fingerprintDatabase(docker, postgresContainer, database)
    log(`  database         ${before.tables.length} tables fingerprinted (${before.tables.reduce((sum, t) => sum + t.rows, 0)} rows)`)

    const containerDump = `/tmp/${setName}.dump`
    const hostDump = join(stagingDir, DATABASE_FILE)
    let containerSha = ''
    let toc = { entries: 0, tables: 0, tableData: 0 }
    const stale = await docker.exec(postgresContainer, `test ! -e ${containerDump}`)
    if (stale.code !== 0) throw new BackupError('DUMP_FAILED', `${containerDump} already exists in ${postgresContainer}.`)
    try {
      const dump = await docker.exec(postgresContainer, `pg_dump -U "$POSTGRES_USER" --no-password --format=custom --file=${containerDump} ${database}`)
      if (dump.code !== 0) throw new BackupError('DUMP_FAILED', `pg_dump failed: ${summarizeToolError(dump.stderr)}`)
      const listing = await docker.exec(postgresContainer, `pg_restore --list ${containerDump}`)
      if (listing.code !== 0 || listing.truncated) throw new BackupError('DUMP_INVALID', `pg_restore could not read the dump: ${summarizeToolError(listing.stderr)}`)
      toc = summarizeToc(listing.stdout)
      if (toc.tables !== before.tables.length || toc.tableData !== before.tables.length) {
        throw new BackupError('DUMP_INVALID', `the dump lists ${toc.tables} tables and ${toc.tableData} table-data entries; the database has ${before.tables.length} tables.`)
      }
      const sum = await docker.exec(postgresContainer, `sha256sum ${containerDump}`)
      containerSha = /^([0-9a-f]{64})\s/.exec(sum.stdout)?.[1] ?? ''
      if (sum.code !== 0 || !containerSha) throw new BackupError('DUMP_INVALID', 'the dump could not be checksummed inside the container.')
      const copy = await docker.copyOut(postgresContainer, containerDump, hostDump)
      if (copy.code !== 0) throw new BackupError('DUMP_COPY_FAILED', `the dump could not be copied out of ${postgresContainer}.`)
    }
    finally {
      await docker.exec(postgresContainer, `rm -f ${containerDump}`)
    }
    const databaseSha256 = await sha256File(hostDump)
    const databaseBytes = (await stat(hostDump)).size
    if (databaseSha256 !== containerSha || databaseBytes === 0) {
      throw new BackupError('DUMP_COPY_FAILED', 'the copied dump does not match the dump pg_dump wrote.')
    }
    log(`  database.dump    ${formatBytes(databaseBytes)}, ${toc.entries} TOC entries, valid`)

    const archivePath = join(stagingDir, UPLOADS_FILE)
    const inventory = await writeUploadsArchive(entries, archivePath)
    if (!sameListing(entries, await listUploads(uploadsDir))) {
      throw new BackupError('QUIESCE_BROKEN', 'the uploads directory changed while it was being archived.')
    }
    const readBack = await readUploadsArchive(archivePath)
    const archiveProblems = compareInventories(inventory, readBack)
    if (archiveProblems.length > 0) throw new BackupError('ARCHIVE_INVALID', `the archive does not read back as written: ${archiveProblems.slice(0, 5).join('; ')}.`)
    const uploadsSha256 = await sha256File(archivePath)
    const uploadsBytes = (await stat(archivePath)).size
    log(`  uploads.tar      ${inventory.files.length} files, ${formatBytes(uploadsTotalBytes)} of content, ${formatBytes(uploadsBytes)} archive, read back`)

    // Nothing may have moved while the copies were taken.
    if ((await docker.state(directusContainer)) !== 'stopped') throw new BackupError('QUIESCE_BROKEN', `${directusContainer} started during the backup.`)
    const mountingAfter = await docker.runningContainersMounting(uploadsDir)
    if (mountingAfter.length > 0) throw new BackupError('QUIESCE_BROKEN', `container(s) ${mountingAfter.join(', ')} mounted the uploads during the backup.`)
    await assertNoClientSessions(docker, postgresContainer, database, 'QUIESCE_BROKEN')
    const after = await fingerprintDatabase(docker, postgresContainer, database)
    const moved = compareFingerprints(before, after)
    if (moved.length > 0) throw new BackupError('QUIESCE_BROKEN', `the database changed during the backup: ${moved.slice(0, 5).join('; ')}.`)

    const manifest = {
      formatVersion: FORMAT_VERSION,
      createdAt: createdAt.toISOString(),
      setName,
      consistencyModel: 'quiesced',
      gitCommit: readGitCommit(repoRoot),
      nodeVersion: process.version,
      directusVersion: directus.version,
      directusImageDigest: directus.digest,
      postgresVersion,
      pgDumpVersion,
      databaseName: database,
      databaseFile: DATABASE_FILE,
      databaseFormat: 'pg_dump-custom',
      databaseBytes,
      databaseSha256,
      databaseTocEntries: toc.entries,
      databaseFingerprint: before,
      uploadsFile: UPLOADS_FILE,
      uploadsFormat: 'ustar',
      uploadsBytes,
      uploadsSha256,
      uploadsFileCount: inventory.files.length,
      uploadsTotalBytes,
      uploadsDirectories: inventory.directories,
      uploadsFiles: inventory.files,
    }
    validateManifest(manifest)
    await writeFile(join(stagingDir, CHECKSUMS_FILE), formatChecksums({ databaseSha256, uploadsSha256 }), { flag: 'wx' })
    await writeFile(join(stagingDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    await rename(stagingDir, finalDir)
    return { setDir: finalDir, manifest, durationMs: Date.now() - startedAt }
  }
  catch (error) {
    if (error instanceof BackupError) {
      error.message += ` The partial set stays at ${stagingDir}: marked incomplete, no manifest, never restorable.`
    }
    throw error
  }
}

// ── restore ─────────────────────────────────────────────────────────────────

/**
 * Restores a verified set into a new TEST database and a new or empty TEST uploads directory,
 * then proves the result: every table's rows and content hash, every sequence and the schema
 * definitions against the manifest, and every file's bytes against its recorded SHA-256.
 * Nothing is created until the set has passed `verifyBackupSet`.
 * @param {{ backupSet: string, postgresContainer: string, targetDatabase: string, targetUploadsDir: string }} options
 * @param {Dependencies & { protectedUploadsDirs?: string[] }} [deps]
 */
export async function restoreBackupSet(options, deps = {}) {
  const docker = deps.docker ?? createDocker()
  const log = deps.log ?? (() => {})
  const gitOptions = { repoRoot: deps.repoRoot ?? TOOL_REPO_ROOT, checkIgnore: deps.checkIgnore ?? gitCheckIgnore }
  const { postgresContainer, targetDatabase } = options
  const startedAt = Date.now()

  assertContainerName(postgresContainer, '--postgres-container')
  assertRestoreDatabaseTarget(targetDatabase)
  if (!options.targetUploadsDir) throw new BackupError('ARGUMENT_INVALID', '--target-uploads-dir is required.')
  if (!options.backupSet) throw new BackupError('ARGUMENT_INVALID', '--backup-set is required.')
  const uploadsTarget = resolve(options.targetUploadsDir)
  await assertRestoreUploadsTarget(uploadsTarget, deps.protectedUploadsDirs ? { ...gitOptions, protectedDirs: deps.protectedUploadsDirs } : gitOptions)

  const setDir = resolve(options.backupSet)
  const manifest = await verifyBackupSet(setDir)
  assertRestoreDatabaseTarget(targetDatabase, { sourceDatabase: manifest.databaseName })
  log(`  verified         ${manifest.setName}: manifest valid, ${DATABASE_FILE} and ${UPLOADS_FILE} match their SHA-256`)

  if (!(await docker.ping())) throw new BackupError('DOCKER_UNAVAILABLE', 'Docker is not reachable.')
  if ((await docker.state(postgresContainer)) !== 'running') throw new BackupError('POSTGRES_NOT_RUNNING', `the Postgres container ${postgresContainer} is not running.`)
  await assertContainerTools(docker, postgresContainer, ['pg_restore', 'sha256sum'])
  const serverVersion = await queryScalar(docker, postgresContainer, 'postgres', 'SHOW server_version;')
  if (!(majorOf(serverVersion) >= majorOf(manifest.postgresVersion))) {
    throw new BackupError('VERSION_MISMATCH', `the set was taken from PostgreSQL ${manifest.postgresVersion}; ${postgresContainer} runs ${serverVersion}.`)
  }
  if ((await queryScalar(docker, postgresContainer, 'postgres', `SELECT count(*) FROM pg_database WHERE datname = '${targetDatabase}';`)) !== '0') {
    throw new BackupError('TARGET_DATABASE_EXISTS', `database ${targetDatabase} already exists. A restore creates its target; it never replaces one.`)
  }

  // ── from here on, something is created ──
  const created = await docker.exec(postgresContainer, psqlCommand('postgres'), `CREATE DATABASE ${targetDatabase};`)
  if (created.code !== 0) throw new BackupError('RESTORE_DATABASE_FAILED', `could not create ${targetDatabase}: ${summarizeToolError(created.stderr)}`)
  const containerDump = `/tmp/${targetDatabase}.dump`
  try {
    const stale = await docker.exec(postgresContainer, `test ! -e ${containerDump}`)
    if (stale.code !== 0) throw new BackupError('RESTORE_DATABASE_FAILED', `${containerDump} already exists in ${postgresContainer}.`)
    const copy = await docker.copyIn(postgresContainer, join(setDir, DATABASE_FILE), containerDump)
    if (copy.code !== 0) throw new BackupError('RESTORE_DATABASE_FAILED', `the dump could not be copied into ${postgresContainer}.`)
    const sum = await docker.exec(postgresContainer, `sha256sum ${containerDump}`)
    if (sum.code !== 0 || /^([0-9a-f]{64})\s/.exec(sum.stdout)?.[1] !== manifest.databaseSha256) {
      throw new BackupError('CHECKSUM_MISMATCH', 'the dump copied into the container does not match its recorded SHA-256.')
    }
    const restore = await docker.exec(postgresContainer, `pg_restore -U "$POSTGRES_USER" --no-password --exit-on-error --single-transaction --dbname=${targetDatabase} ${containerDump}`)
    if (restore.code !== 0) throw new BackupError('RESTORE_DATABASE_FAILED', `pg_restore failed and rolled back: ${summarizeToolError(restore.stderr)}`)
  }
  catch (error) {
    // Only ever the database this run created, under a name already proven to be a TEST target.
    const dropped = await docker.exec(postgresContainer, psqlCommand('postgres'), `DROP DATABASE IF EXISTS ${targetDatabase};`)
    if (error instanceof BackupError) {
      error.message += dropped.code === 0
        ? ` The empty database ${targetDatabase} this run had created was dropped.`
        : ` The database ${targetDatabase} this run had created could not be dropped; remove it by hand.`
    }
    throw error
  }
  finally {
    await docker.exec(postgresContainer, `rm -f ${containerDump}`)
  }

  const restored = await fingerprintDatabase(docker, postgresContainer, targetDatabase)
  const databaseProblems = compareFingerprints(manifest.databaseFingerprint, restored)
  if (databaseProblems.length > 0) {
    throw new BackupError('RESTORE_DATABASE_MISMATCH', `the restored database ${targetDatabase} differs from the backup: ${databaseProblems.slice(0, 5).join('; ')}. It is left in place for inspection.`)
  }
  const rows = restored.tables.reduce((sum, t) => sum + t.rows, 0)
  log(`  database         ${targetDatabase}: ${restored.tables.length} tables, ${rows} rows, ${restored.sequences.length} sequences and schema identical to the backup`)

  await mkdir(uploadsTarget, { recursive: true })
  const extracted = await readUploadsArchive(join(setDir, UPLOADS_FILE), { extractTo: uploadsTarget })
  const fileProblems = compareInventories({ files: manifest.uploadsFiles, directories: manifest.uploadsDirectories }, extracted)
  if (fileProblems.length > 0) {
    throw new BackupError('RESTORE_UPLOADS_MISMATCH', `the restored uploads differ from the backup: ${fileProblems.slice(0, 5).join('; ')}.`)
  }
  log(`  uploads          ${extracted.files.length} files, ${formatBytes(manifest.uploadsTotalBytes)}, every file matches its SHA-256`)

  return {
    manifest,
    targetDatabase,
    targetUploadsDir: uploadsTarget,
    tables: restored.tables.length,
    rows,
    files: extracted.files.length,
    durationMs: Date.now() - startedAt,
  }
}
