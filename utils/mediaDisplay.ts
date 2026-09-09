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

/**
 * ML-CLOUD-UI-CLEANUP-01 — how a SYSTEM folder's name is shown.
 *
 * Directus stores these as slugs (`metal-detection`, `technical-docs`) because
 * they are business classification keys that governance matches on by exact
 * path. Showing the slug to a customer makes the library look like a database
 * browser, so the label is title-cased for display only — the stored name is
 * never touched, and the modal still shows the real full path.
 *
 * Deliberately mechanical: it splits on hyphens and spaces and capitalises,
 * with no alias table. A folder named `xray` reads as "Xray", not "X-ray",
 * because inventing display names for folders is how a label starts
 * disagreeing with the thing it labels.
 */
export function systemFolderLabel(name: string): string {
  return name
    .split(/[-\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01 — which SECTION of the folder navigation a
 * folder is listed under.
 *
 * This is presentation only. It reads the governance values the server already
 * computed (`management`, `policy_state`) and never decides them: nothing here
 * can make a protected folder renameable or a frozen folder writable. The
 * server re-checks every action regardless of where the browser drew the row.
 *
 * The four sections partition the tree — every folder lands in exactly one, so
 * a phone screen never shows the same folder twice while still listing all of
 * them:
 *
 *   quick-access  the healthy top-level areas, the places people start from
 *   customer      folders the customer may create, rename and move
 *   system        the protected system tree below the top level
 *   protected     everything fail-closed: frozen, legacy, ambiguous, unknown
 *
 * "Quick access" is a shortcut layer, not a governance class: a folder listed
 * there keeps its real `management` value and still renders its real badge.
 */
export type FolderSection = 'quick-access' | 'customer' | 'system' | 'protected'

export interface FolderPresentationInput {
  depth: number
  management: 'protected' | 'customer-managed' | 'locked'
  policy_state: string
}

export function folderSection(f: FolderPresentationInput): FolderSection {
  if (f.management === 'customer-managed') return 'customer'
  if (f.management === 'locked') return 'protected'
  // management === 'protected' from here: a healthy system folder.
  return f.depth === 0 ? 'quick-access' : 'system'
}

/**
 * The badge shown beside a folder's name, or null when there is nothing
 * unusual to say.
 *
 * Badges are derived from real state and are never decorative. A folder that
 * appears under Quick access shows the SAME badge it would show anywhere else:
 * a shortcut must not make a frozen folder look ordinary.
 *
 * `ambiguous` reads as "Conflict" because that is what it is — two distinct
 * folder UUIDs resolving to one path. `Protected` covers the remaining
 * fail-closed cases (`unknown`, and anything else locked), where the honest
 * statement is only that the customer cannot manage it.
 */
export function folderBadge(f: FolderPresentationInput): 'Conflict' | 'Read only' | 'Protected' | null {
  if (f.policy_state === 'conflict-frozen' || f.policy_state === 'ambiguous') return 'Conflict'
  if (f.policy_state === 'legacy-read-only') return 'Read only'
  if (f.management === 'locked') return 'Protected'
  return null
}
