/**
 * FINAL-RELEASE-PRODUCTION-READY-02 — backup set tooling (scripts/backup-set.mjs and its two CLIs).
 *
 * No Docker and no database: every file-system rule, the ustar archive, the manifest contract and
 * checksum verification run for real on temporary directories, and the two orchestrators are driven
 * through a scripted Docker double. That double records every call, which is what lets these tests
 * prove the property that matters most for a restore tool — a damaged or incomplete set, a wrong
 * database name or a wrong uploads directory is refused before anything is created.
 *
 * The real rehearsal (quiesced backup of the development data, restore into a TEST database and TEST
 * uploads directory, a disposable Directus on the restored data) is recorded in CURRENT-STATE.md.
 */

import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BackupError,
  CHECKSUMS_FILE,
  DATABASE_FILE,
  DEV_UPLOADS_DIR,
  FINGERPRINT_SQL,
  MANIFEST_FILE,
  MANIFEST_KEYS,
  TOOL_REPO_ROOT,
  UPLOADS_FILE,
  assertBackupOutput,
  assertOutsideGitTracking,
  assertRestoreDatabaseTarget,
  assertRestoreUploadsTarget,
  compareFingerprints,
  compareInventories,
  createBackupSet,
  encodeHeader,
  formatChecksums,
  formatFingerprint,
  gitCheckIgnore,
  listUploads,
  parseChecksums,
  parseFingerprint,
  readUploadsArchive,
  restoreBackupSet,
  setNameFor,
  summarizeToc,
  summarizeToolError,
  validateManifest,
  verifyBackupSet,
  writeUploadsArchive,
} from '../scripts/backup-set.mjs'

const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')

type Result = { code: number, stdout: string, stderr: string, truncated: boolean }
const ok = (stdout = ''): Result => ({ code: 0, stdout, stderr: '', truncated: false })
const failed = (stderr = ''): Result => ({ code: 1, stdout: '', stderr, truncated: false })

const FINGERPRINT = {
  tables: [
    { name: 'public.directus_files', rows: 60, hash: 'b'.repeat(32) },
    { name: 'public.products', rows: 4, hash: 'a'.repeat(32) },
  ],
  sequences: [{ name: 'public.products_id_seq', lastValue: '6' }],
  objects: { tables: 2, views: 0, indexes: 3, constraints: 4, triggers: 1, functions: 1, sequences: 1 },
  schemaHash: 'c'.repeat(32),
}
const CHANGED_FINGERPRINT = { ...FINGERPRINT, tables: [FINGERPRINT.tables[0], { ...FINGERPRINT.tables[1], rows: 5 }] }
const TOC = [
  ';',
  '; Archive created at 2026-09-16 15:00:00 UTC',
  ';',
  '215; 1259 16389 TABLE public directus_files directus',
  '216; 1259 16390 TABLE public products directus',
  '3524; 0 16389 TABLE DATA public directus_files directus',
  '3525; 0 16390 TABLE DATA public products directus',
  '3600; 2606 16400 CONSTRAINT public products products_pkey directus',
  '',
].join('\n')
const PINNED_IMAGE = `directus/directus:11.17.4@sha256:${'e'.repeat(64)}`
const FAKE_DUMP = Buffer.concat([Buffer.from('PGDMP'), randomBytes(4096)])
const SET_NAME = 'litubo-backup-20260916-150000'

let root = ''
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'litubo-backup-test-'))
})
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

let counter = 0
async function scratch(name = 'case') {
  const dir = join(root, `${name}-${++counter}`)
  await mkdir(dir, { recursive: true })
  return dir
}

/** A small uploads tree with the shapes Directus produces, plus a nested directory and an empty file. */
async function makeUploads(dir: string) {
  await mkdir(join(dir, 'nested', 'deeper'), { recursive: true })
  const files: Record<string, Buffer> = {
    'a1b2c3d4-0000-4000-8000-000000000001.jpg': randomBytes(3000),
    'a1b2c3d4-0000-4000-8000-000000000001__thumb.png': randomBytes(513),
    'directus-health-file': Buffer.from('ok\n'),
    'empty.txt': Buffer.alloc(0),
    'nested/c.pdf': randomBytes(1024),
    'nested/deeper/d.txt': Buffer.from('TEST ONLY — NOT FOR PUBLICATION\n'),
  }
  for (const [path, bytes] of Object.entries(files)) await writeFile(join(dir, ...path.split('/')), bytes)
  return files
}

function manifestFor(inventory: { files: { path: string, bytes: number, sha256: string }[], directories: string[] }, parts: { databaseBytes: number, databaseSha256: string, uploadsBytes: number, uploadsSha256: string }, overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    createdAt: '2026-09-16T15:00:00.000Z',
    setName: SET_NAME,
    consistencyModel: 'quiesced',
    gitCommit: 'unknown',
    nodeVersion: 'v22.22.2',
    directusVersion: '11.17.4',
    directusImageDigest: `sha256:${'e'.repeat(64)}`,
    postgresVersion: '16.15',
    pgDumpVersion: 'pg_dump (PostgreSQL) 16.15',
    databaseName: 'litubo_cms',
    databaseFile: DATABASE_FILE,
    databaseFormat: 'pg_dump-custom',
    databaseBytes: parts.databaseBytes,
    databaseSha256: parts.databaseSha256,
    databaseTocEntries: 5,
    databaseFingerprint: FINGERPRINT,
    uploadsFile: UPLOADS_FILE,
    uploadsFormat: 'ustar',
    uploadsBytes: parts.uploadsBytes,
    uploadsSha256: parts.uploadsSha256,
    uploadsFileCount: inventory.files.length,
    uploadsTotalBytes: inventory.files.reduce((sum, file) => sum + file.bytes, 0),
    uploadsDirectories: inventory.directories,
    uploadsFiles: inventory.files,
    ...overrides,
  }
}

/** A complete, valid backup set built from real files. */
async function buildSet(overrides: Record<string, unknown> = {}) {
  const base = await scratch('set')
  const uploads = join(base, 'uploads-source')
  await mkdir(uploads)
  const files = await makeUploads(uploads)
  const setDir = join(base, SET_NAME)
  await mkdir(setDir)
  await writeFile(join(setDir, DATABASE_FILE), FAKE_DUMP)
  const inventory = await writeUploadsArchive(await listUploads(uploads), join(setDir, UPLOADS_FILE))
  const archive = await readFile(join(setDir, UPLOADS_FILE))
  const parts = { databaseBytes: FAKE_DUMP.length, databaseSha256: sha256(FAKE_DUMP), uploadsBytes: archive.length, uploadsSha256: sha256(archive) }
  const manifest = manifestFor(inventory, parts, overrides)
  await writeFile(join(setDir, CHECKSUMS_FILE), formatChecksums(parts))
  await writeFile(join(setDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2))
  return { base, setDir, uploads, files, manifest }
}

interface FakeOptions {
  directusState?: 'running' | 'stopped' | 'missing'
  mountSource?: string | null
  image?: string | null
  mounting?: string[]
  sessions?: string
  databaseExists?: boolean
  fingerprints?: string[]
  toc?: string
  pgRestore?: Result
  containerSha?: string
}

/** A scripted Docker: answers the calls the tools make and records every one of them. */
function fakeDocker(options: FakeOptions = {}) {
  const calls: string[] = []
  let containerFile: Buffer | null = null
  let fingerprintCall = 0
  const docker = {
    async ping() {
      calls.push('ping')
      return true
    },
    async state(container: string): Promise<'running' | 'stopped' | 'missing'> {
      calls.push(`state ${container}`)
      return container.includes('directus') ? (options.directusState ?? 'stopped') : 'running'
    },
    async image(container: string) {
      calls.push(`image ${container}`)
      return options.image === undefined ? PINNED_IMAGE : options.image
    },
    async mountSource(container: string, destination: string) {
      calls.push(`mountSource ${container} ${destination}`)
      return options.mountSource ?? null
    },
    async runningContainersMounting(dir: string) {
      calls.push(`mounting ${dir}`)
      return options.mounting ?? []
    },
    async exec(container: string, script: string, input?: string) {
      calls.push(`exec ${script}${input ? ` <<< ${input.split('\n')[0]}` : ''}`)
      if (script.startsWith('command -v')) return ok()
      if (script.startsWith('psql ')) {
        const sql = input ?? ''
        if (sql === FINGERPRINT_SQL) {
          const answers = options.fingerprints ?? [formatFingerprint(FINGERPRINT)]
          return ok(answers[Math.min(fingerprintCall++, answers.length - 1)])
        }
        if (sql.includes('FROM pg_database WHERE datname')) return ok(options.databaseExists ? '1\n' : '0\n')
        if (sql.includes('pg_stat_activity')) return ok(`${options.sessions ?? '0'}\n`)
        if (sql.includes('pg_database_size')) return ok('12549143\n')
        if (sql.startsWith('SHOW server_version')) return ok('16.15\n')
        if (sql.startsWith('CREATE DATABASE') || sql.startsWith('DROP DATABASE')) return ok()
        return failed('psql: unexpected query')
      }
      if (script === 'pg_dump --version') return ok('pg_dump (PostgreSQL) 16.15\n')
      if (script.startsWith('pg_dump -U')) {
        containerFile = FAKE_DUMP
        return ok()
      }
      if (script.startsWith('pg_restore --list')) return ok(options.toc ?? TOC)
      if (script.startsWith('pg_restore -U')) return options.pgRestore ?? ok()
      if (script.startsWith('sha256sum')) return ok(`${options.containerSha ?? sha256(containerFile ?? Buffer.alloc(0))}  /tmp/file\n`)
      if (script.startsWith('test ! -e') || script.startsWith('rm -f')) return ok()
      return failed('sh: unexpected script')
    },
    async copyOut(container: string, from: string, to: string) {
      calls.push(`copyOut ${from}`)
      await writeFile(to, containerFile ?? Buffer.alloc(0))
      return ok()
    },
    async copyIn(container: string, from: string, to: string) {
      calls.push(`copyIn ${to}`)
      containerFile = await readFile(from)
      return ok()
    },
  }
  return { docker, calls }
}

// ── naming and target guards ────────────────────────────────────────────────

describe('backup set naming and restore targets', () => {
  it('names a set by its UTC creation time, so names sort chronologically', () => {
    expect(setNameFor(new Date('2026-09-16T15:00:00.000Z'))).toBe(SET_NAME)
    const names = ['2026-12-01T00:00:00Z', '2026-09-16T15:00:01Z', '2027-01-01T00:00:00Z'].map(t => setNameFor(new Date(t)))
    expect([...names].sort()).toEqual([names[1], names[0], names[2]])
  })

  it('accepts only databases marked TEST as restore targets', () => {
    for (const name of ['litubo_restore_test_20260916150000', 'restore_test', 'test']) {
      expect(() => assertRestoreDatabaseTarget(name)).not.toThrow()
    }
    const refusals: [string, string][] = [
      ['litubo_cms', 'TARGET_DATABASE_NOT_TEST'],
      ['latest', 'TARGET_DATABASE_NOT_TEST'],
      ['contest_db', 'TARGET_DATABASE_NOT_TEST'],
      ['litubo_restore_20260916', 'TARGET_DATABASE_NOT_TEST'],
      ['litubo_prod_test', 'TARGET_DATABASE_NOT_TEST'],
      ['LITUBO_RESTORE_TEST', 'TARGET_DATABASE_INVALID'],
      ['litubo_test;drop', 'TARGET_DATABASE_INVALID'],
      ['', 'TARGET_DATABASE_INVALID'],
      [`${'x'.repeat(60)}_test`, 'TARGET_DATABASE_INVALID'],
    ]
    for (const [name, code] of refusals) {
      expect(() => assertRestoreDatabaseTarget(name), name).toThrow(expect.objectContaining({ code }))
    }
    expect(() => assertRestoreDatabaseTarget('litubo_test', { sourceDatabase: 'litubo_test' })).toThrow(expect.objectContaining({ code: 'TARGET_DATABASE_IS_SOURCE' }))
  })

  it('refuses the development uploads directory and anything overlapping it', async () => {
    await expect(assertRestoreUploadsTarget(DEV_UPLOADS_DIR)).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_TEST' })
    await expect(assertRestoreUploadsTarget(join(DEV_UPLOADS_DIR, 'uploads-restore-test-1'))).rejects.toMatchObject({ code: 'TARGET_UPLOADS_PROTECTED' })
    const live = join(await scratch(), 'uploads-live-test')
    await expect(assertRestoreUploadsTarget(live, { protectedDirs: [live] })).rejects.toMatchObject({ code: 'TARGET_UPLOADS_PROTECTED' })
  })

  it('accepts only a new or empty uploads directory marked TEST', async () => {
    const base = await scratch()
    await expect(assertRestoreUploadsTarget(join(base, 'uploads'))).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_TEST' })
    await expect(assertRestoreUploadsTarget(join(base, 'latest-uploads'))).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_TEST' })
    await expect(assertRestoreUploadsTarget(join(base, 'uploads-restore-test-1'))).resolves.toBeUndefined()
    const empty = join(base, 'uploads-restore-test-2')
    await mkdir(empty)
    await expect(assertRestoreUploadsTarget(empty)).resolves.toBeUndefined()
    const occupied = join(base, 'uploads-restore-test-3')
    await mkdir(occupied)
    await writeFile(join(occupied, 'existing.jpg'), 'x')
    await expect(assertRestoreUploadsTarget(occupied)).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_EMPTY' })
  })

  it('keeps backup data out of Git: inside the repository only an ignored location is accepted', async () => {
    expect(gitCheckIgnore('backups/litubo-backup-20260916-150000/database.dump', TOOL_REPO_ROOT)).toBe('ignored')
    expect(gitCheckIgnore('dev-data/uploads/file.jpg', TOOL_REPO_ROOT)).toBe('ignored')
    expect(gitCheckIgnore('scripts/backup-set.mjs', TOOL_REPO_ROOT)).toBe('not-ignored')
    expect(() => assertOutsideGitTracking(join(TOOL_REPO_ROOT, 'backups'), 'X', 'output')).not.toThrow()
    expect(() => assertOutsideGitTracking(join(TOOL_REPO_ROOT, 'docs', 'backups-here'), 'OUTPUT_NOT_GIT_IGNORED', 'output')).toThrow(expect.objectContaining({ code: 'OUTPUT_NOT_GIT_IGNORED' }))
    expect(() => assertOutsideGitTracking(TOOL_REPO_ROOT, 'OUTPUT_NOT_GIT_IGNORED', 'output')).toThrow(expect.objectContaining({ code: 'OUTPUT_NOT_GIT_IGNORED' }))
    expect(() => assertOutsideGitTracking(join(tmpdir(), 'anywhere'), 'X', 'output')).not.toThrow()
    await expect(assertRestoreUploadsTarget(join(TOOL_REPO_ROOT, 'docs', 'uploads-restore-test-x'))).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_GIT_IGNORED' })
  })

  it('refuses an output directory that is missing, not ignored, or overlapping the uploads', async () => {
    const repo = await scratch('repo')
    const output = join(repo, 'kept')
    await mkdir(output)
    const uploads = join(repo, 'uploads')
    await mkdir(uploads)
    await expect(assertBackupOutput(output, uploads, { repoRoot: repo, checkIgnore: () => 'ignored' })).resolves.toBeUndefined()
    await expect(assertBackupOutput(output, uploads, { repoRoot: repo, checkIgnore: () => 'not-ignored' })).rejects.toMatchObject({ code: 'OUTPUT_NOT_GIT_IGNORED' })
    await expect(assertBackupOutput(output, uploads, { repoRoot: repo, checkIgnore: () => 'unknown' })).rejects.toMatchObject({ code: 'OUTPUT_NOT_GIT_IGNORED' })
    await expect(assertBackupOutput(join(repo, 'missing'), uploads, { repoRoot: repo, checkIgnore: () => 'ignored' })).rejects.toMatchObject({ code: 'OUTPUT_DIR_MISSING' })
    await expect(assertBackupOutput(join(uploads, 'inside'), uploads, { repoRoot: repo, checkIgnore: () => 'ignored' })).rejects.toMatchObject({ code: 'OUTPUT_OVERLAPS_UPLOADS' })
    await expect(assertBackupOutput(repo, uploads, { repoRoot: join(repo, 'elsewhere'), checkIgnore: () => 'ignored' })).rejects.toMatchObject({ code: 'OUTPUT_OVERLAPS_UPLOADS' })
  })
})

// ── the uploads archive ─────────────────────────────────────────────────────

describe('uploads archive (POSIX ustar)', () => {
  it('round-trips every byte, file and directory, and extracts to an identical tree', async () => {
    const base = await scratch()
    const source = join(base, 'source')
    await mkdir(source)
    const files = await makeUploads(source)
    const archivePath = join(base, UPLOADS_FILE)
    const written = await writeUploadsArchive(await listUploads(source), archivePath)
    expect(written.files.map(f => f.path).sort()).toEqual(Object.keys(files).sort())
    expect(written.directories).toEqual(['nested', 'nested/deeper'])
    for (const file of written.files) {
      expect(file.bytes).toBe(files[file.path].length)
      expect(file.sha256).toBe(sha256(files[file.path]))
    }
    expect((await readFile(archivePath)).length % (512 * 20)).toBe(0)

    expect(compareInventories(written, await readUploadsArchive(archivePath))).toEqual([])
    const target = join(base, 'uploads-restore-test')
    await mkdir(target)
    const extracted = await readUploadsArchive(archivePath, { extractTo: target })
    expect(compareInventories(written, extracted)).toEqual([])
    for (const [path, bytes] of Object.entries(files)) {
      expect((await readFile(join(target, ...path.split('/')))).equals(bytes)).toBe(true)
    }
  })

  it('never overwrites a file that already exists in the target', async () => {
    const base = await scratch()
    const source = join(base, 'source')
    await mkdir(source)
    await makeUploads(source)
    const archivePath = join(base, UPLOADS_FILE)
    await writeUploadsArchive(await listUploads(source), archivePath)
    const target = join(base, 'target-test')
    await mkdir(target)
    await writeFile(join(target, 'empty.txt'), 'kept')
    await expect(readUploadsArchive(archivePath, { extractTo: target })).rejects.toThrow()
    expect(await readFile(join(target, 'empty.txt'), 'utf8')).toBe('kept')
  })

  it('refuses to archive entries that do not belong in an uploads directory', async () => {
    for (const intruder of ['.env', '.env.local', '.git', 'litubo-backup-20260916-150000', 'PG_VERSION']) {
      const dir = await scratch()
      await writeFile(join(dir, 'photo.jpg'), 'x')
      if (intruder === '.git' || intruder.startsWith('litubo-backup')) await mkdir(join(dir, intruder))
      else await writeFile(join(dir, intruder), 'x')
      await expect(listUploads(dir), intruder).rejects.toMatchObject({ code: 'UPLOADS_UNEXPECTED_ENTRY' })
    }
  })

  it('does not follow symbolic links', async () => {
    const dir = await scratch()
    await writeFile(join(dir, 'photo.jpg'), 'x')
    try {
      await symlink(TOOL_REPO_ROOT, join(dir, 'escape'), 'junction')
    }
    catch {
      return // this platform cannot create the link without extra privileges; the refusal is exercised where it can
    }
    await expect(listUploads(dir)).rejects.toMatchObject({ code: 'UPLOADS_UNEXPECTED_ENTRY' })
  })

  const END = Buffer.alloc(512 * 2)
  const hostile: [string, () => Buffer, string][] = [
    ['a path climbing out of the target', () => Buffer.concat([encodeHeader({ path: '../evil.txt', type: 'raw', size: 0, mtime: 0 }), END]), 'ARCHIVE_UNSAFE_PATH'],
    ['an absolute path', () => Buffer.concat([encodeHeader({ path: '/etc/evil.txt', type: 'raw', size: 0, mtime: 0 }), END]), 'ARCHIVE_UNSAFE_PATH'],
    ['a Windows drive path', () => Buffer.concat([encodeHeader({ path: 'C:/evil.txt', type: 'raw', size: 0, mtime: 0 }), END]), 'ARCHIVE_UNSAFE_PATH'],
    ['a symbolic link entry', () => Buffer.concat([encodeHeader({ path: 'link', type: 'raw', size: 0, mtime: 0, typeflag: '2' }), END]), 'ARCHIVE_UNSUPPORTED_ENTRY'],
    ['a header with a wrong checksum', () => {
      const header = encodeHeader({ path: 'file.txt', type: 'file', size: 0, mtime: 0 })
      header[0] = 'g'.charCodeAt(0)
      return Buffer.concat([header, END])
    }, 'ARCHIVE_INVALID'],
    ['a truncated archive', () => Buffer.concat([encodeHeader({ path: 'file.txt', type: 'file', size: 1000, mtime: 0 }), Buffer.alloc(512)]), 'ARCHIVE_INVALID'],
    ['no end-of-archive marker', () => encodeHeader({ path: 'file.txt', type: 'file', size: 0, mtime: 0 }), 'ARCHIVE_INVALID'],
    ['data after the end marker', () => Buffer.concat([END, Buffer.from('x'.repeat(512))]), 'ARCHIVE_INVALID'],
    ['a duplicated entry', () => Buffer.concat([
      encodeHeader({ path: 'file.txt', type: 'file', size: 0, mtime: 0 }),
      encodeHeader({ path: 'file.txt', type: 'file', size: 0, mtime: 0 }),
      END,
    ]), 'ARCHIVE_INVALID'],
  ]
  it.each(hostile)('refuses an archive with %s, writing nothing outside the target', async (_label, build, code) => {
    const base = await scratch()
    const archivePath = join(base, 'hostile.tar')
    await writeFile(archivePath, build())
    const target = join(base, 'inner', 'target-test')
    await mkdir(target, { recursive: true })
    await expect(readUploadsArchive(archivePath, { extractTo: target })).rejects.toMatchObject({ code })
    expect(existsSync(join(base, 'inner', 'evil.txt'))).toBe(false)
  })

  it('reports every kind of inventory difference', () => {
    const expected = { files: [{ path: 'a', bytes: 1, sha256: '1'.repeat(64) }, { path: 'b', bytes: 1, sha256: '2'.repeat(64) }], directories: ['d'] }
    const actual = { files: [{ path: 'a', bytes: 1, sha256: '9'.repeat(64) }, { path: 'c', bytes: 1, sha256: '3'.repeat(64) }], directories: [] }
    expect(compareInventories(expected, actual)).toEqual(['different bytes: a', 'missing file b', 'unexpected file c', 'missing directory d'])
  })
})

// ── manifest, checksums and set verification ────────────────────────────────

describe('manifest and checksums', () => {
  it('accepts a complete manifest and names no secret-bearing field', async () => {
    const { manifest } = await buildSet()
    expect(() => validateManifest(manifest)).not.toThrow()
    expect(MANIFEST_KEYS.filter(key => /pass|secret|token|credential|env|cookie|jwt|key/i.test(key))).toEqual([])
  })

  it('refuses unknown, missing or malformed fields', async () => {
    const { manifest } = await buildSet()
    const broken: [string, Record<string, unknown>, string][] = [
      ['an unknown field', { ...manifest, databasePassword: 'x' }, 'MANIFEST_INVALID'],
      ['a newer format', { ...manifest, formatVersion: 2 }, 'MANIFEST_UNSUPPORTED'],
      ['a malformed checksum', { ...manifest, uploadsSha256: 'abc' }, 'MANIFEST_INVALID'],
      ['a non-canonical component name', { ...manifest, databaseFile: '../database.dump' }, 'MANIFEST_INVALID'],
      ['an unsafe file path', { ...manifest, uploadsFiles: [{ path: '../x', bytes: 0, sha256: '0'.repeat(64) }], uploadsFileCount: 1, uploadsTotalBytes: 0 }, 'MANIFEST_INVALID'],
      ['a file count that disagrees', { ...manifest, uploadsFileCount: 999 }, 'MANIFEST_INVALID'],
      ['a name that disagrees with its time', { ...manifest, setName: 'litubo-backup-20260101-000000' }, 'MANIFEST_INVALID'],
      ['a fingerprint with an extra field', { ...manifest, databaseFingerprint: { ...FINGERPRINT, note: 'x' } }, 'MANIFEST_INVALID'],
      ['a non-quiesced consistency model', { ...manifest, consistencyModel: 'online' }, 'MANIFEST_INVALID'],
    ]
    for (const [label, value, code] of broken) {
      expect(() => validateManifest(value), label).toThrow(expect.objectContaining({ code }))
    }
    const missing = Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== 'uploadsSha256'))
    expect(() => validateManifest(missing)).toThrow(expect.objectContaining({ code: 'MANIFEST_INVALID' }))
  })

  it('reads SHA256SUMS strictly', () => {
    const sums = parseChecksums(formatChecksums({ databaseSha256: '1'.repeat(64), uploadsSha256: '2'.repeat(64) }))
    expect(sums.get(DATABASE_FILE)).toBe('1'.repeat(64))
    for (const text of ['', `${'1'.repeat(64)}  database.dump\n`, `${'1'.repeat(64)}  database.dump\n${'2'.repeat(64)}  uploads.tar\n${'3'.repeat(64)}  manifest.json\n`, `${'1'.repeat(64)} database.dump\n${'2'.repeat(64)}  uploads.tar\n`]) {
      expect(() => parseChecksums(text)).toThrow(expect.objectContaining({ code: 'CHECKSUMS_INVALID' }))
    }
  })

  it('verifies a complete set', async () => {
    const { setDir } = await buildSet()
    await expect(verifyBackupSet(setDir)).resolves.toMatchObject({ setName: SET_NAME })
  })

  it.each([MANIFEST_FILE, DATABASE_FILE, UPLOADS_FILE, CHECKSUMS_FILE])('refuses a set missing %s', async (component) => {
    const { setDir } = await buildSet()
    await rm(join(setDir, component))
    await expect(verifyBackupSet(setDir)).rejects.toMatchObject({ code: 'SET_COMPONENT_MISSING' })
  })

  it.each([DATABASE_FILE, UPLOADS_FILE])('refuses a set whose %s differs by one byte', async (component) => {
    const { setDir } = await buildSet()
    const bytes = await readFile(join(setDir, component))
    const index = Math.floor(bytes.length / 2)
    bytes[index] = bytes[index] ^ 0xff
    await writeFile(join(setDir, component), bytes)
    await expect(verifyBackupSet(setDir)).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' })
  })

  it('refuses a set whose SHA256SUMS disagrees with its manifest', async () => {
    const { setDir } = await buildSet()
    await writeFile(join(setDir, CHECKSUMS_FILE), formatChecksums({ databaseSha256: '0'.repeat(64), uploadsSha256: '0'.repeat(64) }))
    await expect(verifyBackupSet(setDir)).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' })
  })

  it('refuses an incomplete or misnamed set directory', async () => {
    const base = await scratch()
    const incomplete = join(base, `${SET_NAME}.incomplete`)
    await mkdir(incomplete)
    await expect(verifyBackupSet(incomplete)).rejects.toMatchObject({ code: 'SET_INCOMPLETE' })
    const misnamed = join(base, 'my-backup')
    await mkdir(misnamed)
    await expect(verifyBackupSet(misnamed)).rejects.toMatchObject({ code: 'SET_NAME_INVALID' })
  })
})

// ── database fingerprint ────────────────────────────────────────────────────

describe('database fingerprint', () => {
  it('parses only a complete answer', () => {
    const text = formatFingerprint(FINGERPRINT)
    expect(parseFingerprint(text)).toEqual({ ok: true, fingerprint: FINGERPRINT })
    expect(parseFingerprint(text.replace('DONE\n', ''))).toMatchObject({ ok: false })
    expect(parseFingerprint(`${text}TABLE\tpublic.late\t1\t${'d'.repeat(32)}\n`)).toMatchObject({ ok: false })
    expect(parseFingerprint(text.replace('a'.repeat(32), 'nothex'))).toMatchObject({ ok: false })
    expect(parseFingerprint(`psql: error: connection failed\n${text}`)).toMatchObject({ ok: false })
    expect(parseFingerprint(text.replace('OBJECTS\t2', 'OBJECTS\t3'))).toMatchObject({ ok: false })
  })

  it('reports rows, content, sequence, schema and object differences', () => {
    expect(compareFingerprints(FINGERPRINT, FINGERPRINT)).toEqual([])
    expect(compareFingerprints(FINGERPRINT, CHANGED_FINGERPRINT)).toEqual(['table public.products: 4 → 5 rows'])
    const altered = {
      tables: [{ ...FINGERPRINT.tables[0], hash: 'f'.repeat(32) }],
      sequences: [{ name: 'public.products_id_seq', lastValue: '7' }],
      objects: { ...FINGERPRINT.objects, tables: 1, triggers: 0 },
      schemaHash: 'd'.repeat(32),
    }
    expect(compareFingerprints(FINGERPRINT, altered)).toEqual([
      'tables: 2 → 1',
      'triggers: 1 → 0',
      'schema definitions differ',
      'table public.directus_files: content differs',
      'table public.products missing',
      'sequence public.products_id_seq: 6 → 7',
    ])
  })

  it('reads a pg_restore table of contents', () => {
    expect(summarizeToc(TOC)).toEqual({ entries: 5, tables: 2, tableData: 2 })
  })

  it('summarizes database tool errors without echoing row data', () => {
    const stderr = [
      'pg_restore: error: COPY failed for table "directus_users": ERROR:  invalid input',
      'CONTEXT:  COPY directus_users, line 2: "3f0c…	nuxt-server	secret-token-value-123"',
      'psql:<stdin>:1: ERROR:  relation "x" does not exist',
      'DETAIL:  Key (token)=(secret-token-value-123) already exists.',
    ].join('\n')
    const summary = summarizeToolError(stderr)
    expect(summary).toContain('pg_restore: error: COPY failed for table "directus_users"')
    expect(summary).toContain('psql:<stdin>:1: ERROR:  relation "x" does not exist')
    expect(summary).not.toContain('secret-token-value-123')
  })
})

// ── restore orchestration ───────────────────────────────────────────────────

describe('restore — nothing is created before every check has passed', () => {
  const target = async () => join(await scratch('targets'), 'uploads-restore-test-20260916')

  it('restores a verified set into a new TEST database and TEST uploads directory', async () => {
    const { setDir, files } = await buildSet()
    const uploadsTarget = await target()
    const { docker, calls } = fakeDocker()
    const result = await restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_20260916', targetUploadsDir: uploadsTarget }, { docker })
    expect(result).toMatchObject({ tables: 2, rows: 64, files: Object.keys(files).length })
    const create = calls.findIndex(call => call.includes('CREATE DATABASE litubo_restore_test_20260916'))
    const restore = calls.findIndex(call => call.startsWith('exec pg_restore -U "$POSTGRES_USER" --no-password --exit-on-error --single-transaction --dbname=litubo_restore_test_20260916'))
    expect(create).toBeGreaterThan(-1)
    expect(restore).toBeGreaterThan(create)
    expect(calls.some(call => call.includes('DROP DATABASE'))).toBe(false)
    for (const [path, bytes] of Object.entries(files)) {
      expect((await readFile(join(uploadsTarget, ...path.split('/')))).equals(bytes)).toBe(true)
    }
  })

  it('refuses a corrupted set without a single Docker call or a created directory', async () => {
    const { setDir } = await buildSet()
    const dump = await readFile(join(setDir, DATABASE_FILE))
    dump[10] = dump[10] ^ 0x01
    await writeFile(join(setDir, DATABASE_FILE), dump)
    const uploadsTarget = await target()
    const { docker, calls } = fakeDocker()
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: uploadsTarget }, { docker }))
      .rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' })
    expect(calls).toEqual([])
    expect(existsSync(uploadsTarget)).toBe(false)
  })

  it.each([MANIFEST_FILE, DATABASE_FILE, UPLOADS_FILE])('refuses a set missing %s without a single Docker call', async (component) => {
    const { setDir } = await buildSet()
    await rm(join(setDir, component))
    const { docker, calls } = fakeDocker()
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: await target() }, { docker }))
      .rejects.toMatchObject({ code: 'SET_COMPONENT_MISSING' })
    expect(calls).toEqual([])
  })

  it.each([['litubo_cms', 'TARGET_DATABASE_NOT_TEST'], ['litubo_restore_20260916', 'TARGET_DATABASE_NOT_TEST'], ['LITUBO_TEST', 'TARGET_DATABASE_INVALID']])(
    'refuses database target %s before reading the set', async (targetDatabase, code) => {
      const { docker, calls } = fakeDocker()
      const uploadsTarget = await target()
      await expect(restoreBackupSet({ backupSet: join(root, 'does-not-exist'), postgresContainer: 'pg', targetDatabase, targetUploadsDir: uploadsTarget }, { docker }))
        .rejects.toMatchObject({ code })
      expect(calls).toEqual([])
      expect(existsSync(uploadsTarget)).toBe(false)
    },
  )

  it('refuses the development uploads directory as a target before reading the set', async () => {
    const { docker, calls } = fakeDocker()
    const before = await readdir(resolve(DEV_UPLOADS_DIR, '..')).catch(() => [])
    await expect(restoreBackupSet({ backupSet: join(root, 'does-not-exist'), postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: DEV_UPLOADS_DIR }, { docker }))
      .rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_TEST' })
    expect(calls).toEqual([])
    expect(await readdir(resolve(DEV_UPLOADS_DIR, '..')).catch(() => [])).toEqual(before)
  })

  it('refuses to restore into the database the set was taken from', async () => {
    const { setDir } = await buildSet({ databaseName: 'litubo_source_test' })
    const { docker, calls } = fakeDocker()
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_source_test', targetUploadsDir: await target() }, { docker }))
      .rejects.toMatchObject({ code: 'TARGET_DATABASE_IS_SOURCE' })
    expect(calls).toEqual([])
  })

  it('never replaces an existing database', async () => {
    const { setDir } = await buildSet()
    const { docker, calls } = fakeDocker({ databaseExists: true })
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: await target() }, { docker }))
      .rejects.toMatchObject({ code: 'TARGET_DATABASE_EXISTS' })
    expect(calls.some(call => call.includes('CREATE DATABASE') || call.includes('DROP DATABASE'))).toBe(false)
  })

  it('drops the database it created when pg_restore fails, and restores no files', async () => {
    const { setDir } = await buildSet()
    const uploadsTarget = await target()
    const { docker, calls } = fakeDocker({ pgRestore: failed('pg_restore: error: could not execute query: ERROR:  boom\nCONTEXT:  COPY directus_users, line 1: "secret-token-value-123"') })
    const attempt = restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: uploadsTarget }, { docker })
    await expect(attempt).rejects.toMatchObject({ code: 'RESTORE_DATABASE_FAILED' })
    await expect(attempt).rejects.not.toThrow(/secret-token-value-123/)
    expect(calls.some(call => call.includes('DROP DATABASE IF EXISTS litubo_restore_test_1'))).toBe(true)
    expect(calls.some(call => call.startsWith('exec rm -f /tmp/litubo_restore_test_1.dump'))).toBe(true)
    expect(existsSync(uploadsTarget)).toBe(false)
  })

  it('drops the database it created when the copy inside the container does not match', async () => {
    const { setDir } = await buildSet()
    const { docker, calls } = fakeDocker({ containerSha: '0'.repeat(64) })
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: await target() }, { docker }))
      .rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' })
    expect(calls.some(call => call.startsWith('exec pg_restore -U'))).toBe(false)
    expect(calls.some(call => call.includes('DROP DATABASE IF EXISTS litubo_restore_test_1'))).toBe(true)
  })

  it('fails when the restored database does not match the backup, before any file is written', async () => {
    const { setDir } = await buildSet()
    const uploadsTarget = await target()
    const { docker } = fakeDocker({ fingerprints: [formatFingerprint(CHANGED_FINGERPRINT)] })
    await expect(restoreBackupSet({ backupSet: setDir, postgresContainer: 'pg', targetDatabase: 'litubo_restore_test_1', targetUploadsDir: uploadsTarget }, { docker }))
      .rejects.toMatchObject({ code: 'RESTORE_DATABASE_MISMATCH' })
    expect(existsSync(uploadsTarget)).toBe(false)
  })
})

// ── backup orchestration ────────────────────────────────────────────────────

describe('backup — a set is only produced from a quiesced source', () => {
  async function source() {
    const repo = await scratch('backup')
    const uploads = join(repo, 'uploads')
    await mkdir(uploads)
    const files = await makeUploads(uploads)
    const output = join(repo, 'backups')
    await mkdir(output)
    return { repo, uploads, output, files }
  }
  const options = (s: { uploads: string, output: string }) => ({ postgresContainer: 'litubo-cms-postgres-1', database: 'litubo_cms', directusContainer: 'litubo-cms-directus-1', uploadsDir: s.uploads, outputDir: s.output })
  const deps = (repo: string, docker: ReturnType<typeof fakeDocker>['docker']) => ({ docker, repoRoot: repo, checkIgnore: () => 'ignored' as const, now: () => new Date('2026-09-16T15:00:00.000Z') })
  /** The source database exists for a backup (a restore target, by contrast, must not). */
  const sourceDocker = (fake: FakeOptions) => fakeDocker({ databaseExists: true, ...fake })

  it('creates a complete set that verifies, with the manifest written last', async () => {
    const s = await source()
    const { docker, calls } = sourceDocker({ mountSource: s.uploads })
    const result = await createBackupSet(options(s), deps(s.repo, docker))
    expect(result.setDir).toBe(join(s.output, SET_NAME))
    expect((await readdir(s.output)).sort()).toEqual([SET_NAME])
    expect((await readdir(result.setDir)).sort()).toEqual([CHECKSUMS_FILE, DATABASE_FILE, MANIFEST_FILE, UPLOADS_FILE].sort())
    const manifest = await verifyBackupSet(result.setDir)
    expect(Object.keys(manifest).sort()).toEqual([...MANIFEST_KEYS].sort())
    expect(manifest).toMatchObject({ databaseName: 'litubo_cms', directusVersion: '11.17.4', uploadsFileCount: Object.keys(s.files).length, databaseTocEntries: 5, consistencyModel: 'quiesced' })
    expect(calls.some(call => call.startsWith('exec pg_dump -U "$POSTGRES_USER" --no-password --format=custom --file=/tmp/litubo-backup-20260916-150000.dump litubo_cms'))).toBe(true)
    expect(calls.some(call => call.startsWith('exec rm -f /tmp/litubo-backup-20260916-150000.dump'))).toBe(true)
  })

  const refusals: [string, FakeOptions | ((uploads: string) => FakeOptions), string][] = [
    ['Directus is running', uploads => ({ mountSource: uploads, directusState: 'running' }), 'NOT_QUIESCED'],
    ['the uploads directory is not the one Directus mounts', { mountSource: '/somewhere/else' }, 'UPLOADS_SOURCE_MISMATCH'],
    ['another running container mounts the uploads', uploads => ({ mountSource: uploads, mounting: ['litubo-provisioning-test-directus'] }), 'NOT_QUIESCED'],
    ['a client session is connected to the database', uploads => ({ mountSource: uploads, sessions: '2' }), 'NOT_QUIESCED'],
    ['Directus is not pinned by digest', uploads => ({ mountSource: uploads, image: 'directus/directus:11' }), 'IMAGE_NOT_PINNED'],
  ]
  it.each(refusals)('refuses when %s, before pg_dump and before any set directory exists', async (_label, fake, code) => {
    const s = await source()
    const { docker, calls } = sourceDocker(typeof fake === 'function' ? fake(s.uploads) : fake)
    await expect(createBackupSet(options(s), deps(s.repo, docker))).rejects.toMatchObject({ code })
    expect(calls.some(call => call.startsWith('exec pg_dump -U'))).toBe(false)
    expect(await readdir(s.output)).toEqual([])
  })

  it('refuses an output directory Git could pick up, before any Docker call', async () => {
    const s = await source()
    const { docker, calls } = sourceDocker({ mountSource: s.uploads })
    await expect(createBackupSet(options(s), { ...deps(s.repo, docker), checkIgnore: () => 'not-ignored' as const })).rejects.toMatchObject({ code: 'OUTPUT_NOT_GIT_IGNORED' })
    expect(calls).toEqual([])
  })

  it('refuses when the database changes during the backup, leaving only an unrestorable incomplete set', async () => {
    const s = await source()
    const { docker } = sourceDocker({ mountSource: s.uploads, fingerprints: [formatFingerprint(FINGERPRINT), formatFingerprint(CHANGED_FINGERPRINT)] })
    await expect(createBackupSet(options(s), deps(s.repo, docker))).rejects.toMatchObject({ code: 'QUIESCE_BROKEN' })
    const staging = join(s.output, `${SET_NAME}.incomplete`)
    expect(await readdir(s.output)).toEqual([`${SET_NAME}.incomplete`])
    expect(existsSync(join(staging, MANIFEST_FILE))).toBe(false)
    await expect(verifyBackupSet(staging)).rejects.toMatchObject({ code: 'SET_INCOMPLETE' })
  })

  it('refuses a dump whose table of contents does not cover every table, and cleans the container copy', async () => {
    const s = await source()
    const oneTable = TOC.split('\n').filter(line => !line.includes('directus_files')).join('\n')
    const { docker, calls } = sourceDocker({ mountSource: s.uploads, toc: oneTable })
    await expect(createBackupSet(options(s), deps(s.repo, docker))).rejects.toMatchObject({ code: 'DUMP_INVALID' })
    expect(calls.some(call => call.startsWith('exec rm -f /tmp/litubo-backup-20260916-150000.dump'))).toBe(true)
    expect(existsSync(join(s.output, `${SET_NAME}.incomplete`, MANIFEST_FILE))).toBe(false)
  })

  it('never touches the uploads it copies', async () => {
    const s = await source()
    const before = await listUploads(s.uploads)
    const { docker } = sourceDocker({ mountSource: s.uploads })
    await createBackupSet(options(s), deps(s.repo, docker))
    expect(await listUploads(s.uploads)).toEqual(before)
    for (const [path, bytes] of Object.entries(s.files)) {
      expect((await readFile(join(s.uploads, ...path.split('/')))).equals(bytes)).toBe(true)
    }
  })
})

// ── static contract ─────────────────────────────────────────────────────────

describe('backup tooling secret contract (static)', () => {
  const sources = ['scripts/backup-set.mjs', 'scripts/backup-create.mjs', 'scripts/backup-restore.mjs']
    .map(path => ({ path, text: readFileSync(resolve(TOOL_REPO_ROOT, path), 'utf8') }))

  it('never reads the process environment, a .env file or a container environment', () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toMatch(/process\.env/)
      expect(text, path).not.toMatch(/dotenv/)
      expect(text, path).not.toMatch(/readFile(Sync)?\([^)]*\.env/)
      expect(text, path).not.toMatch(/\.Config\.Env/)
      expect(text, path).not.toMatch(/\bprintenv\b/)
      expect(text, path).not.toMatch(/'compose',\s*'config'/)
    }
  })

  it('inspects containers only for state, image, name and mounts', () => {
    const text = sources[0].text
    const fields = [...text.matchAll(/\{\{(?:range )?(\.[A-Za-z.]+)/g)].map(match => match[1])
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) {
      expect(['.Server.Version', '.State.Running', '.Config.Image', '.Mounts', '.Destination', '.Source', '.Name']).toContain(field)
    }
  })

  it('addresses Postgres only through the container user, never a password', () => {
    const text = sources[0].text
    expect(text).toContain('-U "$POSTGRES_USER" --no-password')
    expect(text).not.toMatch(/PGPASSWORD|POSTGRES_PASSWORD|DB_PASSWORD/)
  })

  it('exposes both tools as npm scripts', () => {
    const scripts = JSON.parse(readFileSync(resolve(TOOL_REPO_ROOT, 'package.json'), 'utf8')).scripts
    expect(scripts['backup:create']).toBe('node scripts/backup-create.mjs')
    expect(scripts['backup:restore-test']).toBe('node scripts/backup-restore.mjs')
  })

  it('keeps the backup error type distinguishable from unexpected failures', () => {
    const error = new BackupError('X', 'message')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('X')
  })

  it('does not follow a restore target created as a link', async () => {
    const base = await scratch()
    const linked = join(base, 'uploads-restore-test-link')
    try {
      await symlink(await scratch(), linked, 'junction')
    }
    catch {
      return
    }
    expect((await lstat(linked)).isSymbolicLink()).toBe(true)
    await expect(assertRestoreUploadsTarget(linked)).rejects.toMatchObject({ code: 'TARGET_UPLOADS_NOT_EMPTY' })
  })
})
