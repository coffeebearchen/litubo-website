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

/**
 * ML-CLOUD-MOBILE-VISUAL-ALIGN-01-R1 — the folders directly inside one
 * location, never deeper.
 *
 * The navigation sections were first written as global filters over the whole
 * flattened tree, which collected every customer-managed folder in the library
 * into a single list: a model's folder, its own `manuals`, and an unrelated
 * model's `photos` all rendered as siblings. That is a second folder tree that
 * disagrees with the real one, and it hides each row's actual parent.
 *
 * `contextId` of `null` means the library root, whose direct children are the
 * top-level folders. Anything deeper is reached by opening a folder, which is
 * what makes the breadcrumb the honest answer to "where am I".
 */
export function directChildFolders<T extends { id: string, depth: number }>(
  folders: readonly T[],
  parentOf: Readonly<Record<string, string | null>>,
  contextId: string | null,
): T[] {
  if (contextId === null) return folders.filter(f => f.depth === 0)
  return folders.filter(f => parentOf[f.id] === contextId)
}

// ── MEDIA-AI-LINK-PICKER-01: browsing the tree from the Product Workspace ────

/** What the picker's format filter can narrow to. `text` is the formats AI Source Intake can analyze. */
export type LibraryTypeFilter = '' | 'image' | 'pdf' | 'text'

/**
 * The files endpoint's existing value for "files in no folder". It is a filter,
 * not a folder id: Unclassified is a view of the library, never a place.
 */
export const UNCLASSIFIED_FOLDER = 'root'

/** `products/checkweigher/LT180C` → `products / checkweigher / LT180C`, the form Media Library file cards use. */
export function folderPathLabel(fullPath: string | null | undefined): string {
  return (fullPath ?? '').split('/').filter(Boolean).join(' / ')
}

/**
 * The folder tree as a flat list, each entry carrying its depth — so the picker
 * can ask `directChildFolders()` for a level instead of keeping a second
 * definition of "direct children" that could disagree with Media Library's.
 */
export function flattenFolderTree<T extends { id: string, children: readonly T[] }>(
  roots: readonly T[],
): Array<T & { depth: number }> {
  const out: Array<T & { depth: number }> = []
  const walk = (nodes: readonly T[], depth: number) => {
    for (const node of nodes) {
      out.push({ ...node, depth })
      walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}

/**
 * The chain from the library root down to `folderId`, root first. Empty at the
 * root, at Unclassified, and for an id the tree does not contain.
 */
export function folderTrail<T extends { id: string, parent: string | null }>(
  folders: readonly T[],
  folderId: string | null,
): T[] {
  if (!folderId || folderId === UNCLASSIFIED_FOLDER) return []
  const byId = new Map(folders.map(f => [f.id, f]))
  const chain: T[] = []
  const seen = new Set<string>()
  let current = byId.get(folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.unshift(current)
    current = current.parent ? byId.get(current.parent) : undefined
  }
  return chain
}

export interface LibraryBrowseState {
  folder: string | null
  search: string
  type: LibraryTypeFilter
}

/**
 * Whether the picker should list files at all.
 *
 * At the library root with nothing narrowed, the only answer to "which files?"
 * is every file in the library, newest first — the blind list this replaces.
 * So the root shows folders and waits: opening a folder, searching, or choosing
 * a format is what asks for files.
 */
export function libraryShowsFiles(state: LibraryBrowseState): boolean {
  return state.folder !== null || state.search.trim() !== '' || state.type !== ''
}

/**
 * The query the picker sends to the existing `/api/admin/media/files`. Folder,
 * search and format narrow together: a search inside LT180C finds matches in
 * LT180C, not across the library. At the root a search covers everything.
 */
export function buildLibraryFilesQuery(
  state: LibraryBrowseState & { limit: number, offset: number },
): Record<string, string> {
  const query: Record<string, string> = { limit: String(state.limit), offset: String(state.offset) }
  if (state.folder !== null) query.folder = state.folder
  if (state.type) query.type = state.type
  const search = state.search.trim()
  if (search) query.search = search
  return query
}
