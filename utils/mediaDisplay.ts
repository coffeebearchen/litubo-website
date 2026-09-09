/**
 * ML-CLOUD-03 — how the Media Library describes a file when it cannot show it.
 *
 * A card always renders something in its thumbnail box: a picture, or one of
 * these short labels. Keeping the mapping here rather than inline in the page
 * means the fallback a broken image falls back TO is the same thing a
 * never-had-a-thumbnail file shows, and both can be tested without mounting
 * the page.
 */

/** The label a card shows when there is no picture: a broken image, or a non-image format. */
export function fileKind(type: string | null | undefined): string {
  const t = (type ?? '').trim().toLowerCase()
  if (t === 'application/pdf') return 'PDF'
  if (t.startsWith('image/')) return 'IMAGE'
  if (t.startsWith('text/csv')) return 'CSV'
  if (t.startsWith('text/tab-separated-values')) return 'TSV'
  if (t.startsWith('text/')) return 'TXT'
  return 'FILE'
}

export interface UploadOutcome {
  filename: string
  ok: boolean
  message?: string
}

/**
 * A one-line account of a finished upload batch.
 *
 * A partly failed batch is the case that matters: reporting it as a single
 * "Upload failed" hides four files that landed fine, and reporting it as
 * success hides the one that did not.
 */
export function summariseUpload(results: UploadOutcome[]): string {
  const ok = results.filter(r => r.ok).length
  const failed = results.length - ok
  if (results.length === 0) return 'Nothing to upload'
  if (failed === 0) return `${ok} file(s) uploaded successfully`
  if (ok === 0) return `${failed} file(s) failed to upload`
  return `${ok} uploaded, ${failed} failed`
}
