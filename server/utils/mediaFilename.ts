/**
 * ML-CLOUD-02 — human-visible filenames and the duplicate-upload warning.
 *
 * Two jobs that share one idea: comparing filenames the way a person would.
 * Renaming asks "is there already a file called this here?", uploading asks
 * "did I already upload this?". Both answer with a trimmed, case-folded
 * comparison and nothing cleverer — this is business file organisation, not
 * content addressing.
 */

/** Directus stores `filename_download` as varchar(255). */
export const MAX_FILENAME_LENGTH = 255

export type FilenameResult =
  | { ok: true, name: string }
  | { ok: false, code: string, message: string }

/** The trailing `.ext` of a filename, lowercased, or '' when there isn't one. */
export function extensionOf(filename: string | null | undefined): string {
  const name = (filename ?? '').trim()
  const dot = name.lastIndexOf('.')
  // A leading dot is a hidden file, not an extension.
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot).toLowerCase()
}

/**
 * Validate a filename a person typed, and keep the original extension on it.
 *
 * The extension is not the user's to change here. `filename_download` is what
 * the browser saves the file as, while the stored bytes and the MIME type stay
 * exactly as they were — so letting someone rename `datasheet.pdf` to
 * `datasheet.txt` produces a download that lies about itself. Appending the
 * real extension back is simpler to explain than a warning nobody reads, and
 * it is the one thing this function does beyond trimming and refusing.
 */
export function normalizeFilename(raw: unknown, currentFilename: string | null | undefined): FilenameResult {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'FILENAME_INVALID', message: 'Filename must be text.' }
  }
  const name = raw.trim()
  if (name === '') {
    return { ok: false, code: 'FILENAME_EMPTY', message: 'Filename cannot be empty.' }
  }
  if (name.includes('/') || name.includes('\\')) {
    return { ok: false, code: 'FILENAME_SEPARATOR', message: 'Filename cannot contain "/" or "\\".' }
  }

  const ext = extensionOf(currentFilename)
  const withExt = ext && !name.toLowerCase().endsWith(ext) ? `${name}${ext}` : name

  if (withExt.length > MAX_FILENAME_LENGTH) {
    return {
      ok: false,
      code: 'FILENAME_TOO_LONG',
      message: `Filename cannot be longer than ${MAX_FILENAME_LENGTH} characters.`,
    }
  }
  return { ok: true, name: withExt }
}

/** How two filenames are judged "the same name" — trimmed and case-folded. */
export function normalizeForCompare(filename: string | null | undefined): string {
  return (filename ?? '').trim().toLowerCase()
}

export interface ExistingFile {
  id: string
  filename_download: string | null
  /**
   * Directus types `filesize` as bigint and serialises it as a STRING, so this
   * is `number | string`. Comparing it strictly against a browser's
   * `File.size` silently never matches — the duplicate warning would be
   * permanently, quietly off.
   */
  filesize: number | string | null
  folder?: string | null
}

/** `filesize` as a number, whichever way Directus sent it. */
function sizeOf(filesize: number | string | null | undefined): number | null {
  if (filesize === null || filesize === undefined || filesize === '') return null
  const n = Number(filesize)
  return Number.isFinite(n) ? n : null
}

/**
 * The file in this folder that already carries this name, if any. Used to
 * refuse a rename before it happens rather than let two `manual.pdf` sit side
 * by side and leave the operator guessing which is which.
 */
export function findFilenameClash(
  existing: ExistingFile[],
  name: string,
  selfId: string,
): ExistingFile | null {
  const target = normalizeForCompare(name)
  // A row with no download name has no name to clash with. Without this guard
  // it would compare equal to an empty target and to every other nameless row.
  if (target === '') return null
  return existing.find(f => f.id !== selfId && normalizeForCompare(f.filename_download) === target) ?? null
}

export interface DuplicateCandidate {
  filename: string
  size: number
}

export interface DuplicateMatch {
  filename: string
  size: number
  existing: Array<{ id: string, filename_download: string | null, filesize: number | null }>
}

/**
 * Files already in the target folder that look like the ones about to be
 * uploaded: same name, same byte count.
 *
 * This is deliberately a warning and not a verdict. Directus stores no content
 * digest (confirmed read-only against the live schema — `directus_files` has
 * no checksum, hash or etag column), and adding one would mean a schema change
 * this module is not allowed to make. Name-and-size catches the case that
 * actually happens — someone uploading the same file twice because they forgot
 * they already had — and says "possible duplicate" rather than pretending to
 * content-addressing it cannot do. The operator decides.
 */
export function findPossibleDuplicates(
  candidates: DuplicateCandidate[],
  existing: ExistingFile[],
): DuplicateMatch[] {
  const byName = new Map<string, ExistingFile[]>()
  for (const file of existing) {
    const key = normalizeForCompare(file.filename_download)
    if (!key) continue
    const bucket = byName.get(key)
    if (bucket) bucket.push(file)
    else byName.set(key, [file])
  }

  const matches: DuplicateMatch[] = []
  for (const candidate of candidates) {
    const hits = (byName.get(normalizeForCompare(candidate.filename)) ?? [])
      .filter(f => sizeOf(f.filesize) === candidate.size)
    if (hits.length === 0) continue
    matches.push({
      filename: candidate.filename,
      size: candidate.size,
      existing: hits.map(f => ({ id: f.id, filename_download: f.filename_download, filesize: sizeOf(f.filesize) })),
    })
  }
  return matches
}
