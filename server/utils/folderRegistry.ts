import { createError } from 'h3'
import type { H3Event } from 'h3'
import { adminFetch } from './adminDirectusClient'

// ── Policy types ──────────────────────────────────────────────────────────────

export type PolicyState =
  | 'active-canonical'   // allow_upload=true, allow_move_target=true
  | 'container-only'     // parent container; files should go in sub-folders
  | 'legacy-read-only'   // browsable; no new writes
  | 'conflict-frozen'    // naming conflict; frozen, no new writes
  | 'ambiguous'          // two distinct UUIDs resolve to same full_path; fail-closed
  | 'unknown'            // folder exists in Directus but not in policy map

/**
 * ML-CLOUD-01 — folder MANAGEMENT policy, deliberately separate from
 * `PolicyState`.
 *
 * `PolicyState` answers a question about files: may they be uploaded here, may
 * this be a move target. It has never answered the question this module needs,
 * which is about the folder itself: may it be created, renamed or moved. D-023
 * / governance decision #9.5 requires the two to stay apart rather than
 * overloading one value with both jobs.
 */
export type FolderManagement =
  | 'protected'         // a system folder: browse and use, but never rename or move
  | 'customer-managed'  // inside a declared customer zone: create, rename, move
  | 'locked'            // everything else, including unknown — fail closed

export interface FolderEntry {
  folder_uuid: string
  name: string
  parent_chain: string[]   // names from root to this folder
  full_path: string        // e.g. 'products/xray'
  policy_state: PolicyState
  allow_upload: boolean
  allow_move_target: boolean
  /** Whether the folder itself may be managed. Separate dimension from the three fields above. */
  management: FolderManagement
  /**
   * The declared customer zone this folder belongs to, or null. A zone root
   * belongs to its own zone. Used to keep a customer folder inside the product
   * category it was filed under (D-023).
   */
  zone_root: string | null
}

// ── Frozen policy map (full_path → PolicyState) ───────────────────────────────
//
// Keyed by the computed full path (parent names + own name joined with '/').
// Only full-path matching is used; same name in different positions is treated
// as a distinct folder.  Planned folders that do not exist in Directus are not
// in this map and will never be returned by resolveFolderRegistry().

const FOLDER_POLICY: Readonly<Record<string, PolicyState>> = {
  'home':                       'active-canonical',
  'applications':               'active-canonical',
  'company':                    'active-canonical',
  'company/global-service':     'legacy-read-only',
  'products':                   'container-only',
  'products/xray':              'active-canonical',
  'products/metal-detection':   'active-canonical',
  'products/combination':       'active-canonical',
  'products/checkweigher':      'active-canonical',
  'products/conveyor':          'active-canonical',
  'products/technical-docs':    'legacy-read-only',
  'resources':                  'container-only',
  'resources/case-studies':     'legacy-read-only',
  'resources/downloads':        'legacy-read-only',
  'resources/insights':         'legacy-read-only',
  'certifications':             'conflict-frozen',
} as const

/**
 * ML-CLOUD-01 — the declared customer-manageable zones.
 *
 * Rights come from THIS list, never from absence from `FOLDER_POLICY`. A path
 * that is neither a system folder nor a descendant of one of these roots stays
 * `unknown` and is refused, exactly as before — the fail-closed model is not
 * inverted, it is given one explicit set of doors.
 *
 * Kept to the product-asset roots customers actually organise inside. Adding a
 * zone later is a one-line configuration change, not a permission subsystem.
 */
const CUSTOMER_MANAGEABLE_ROOTS: readonly string[] = [
  'products/xray',
  'products/metal-detection',
  'products/combination',
  'products/checkweigher',
  'products/conveyor',
] as const

/**
 * The declared root a path sits STRICTLY under, or null. The root itself is not
 * inside its own zone — it stays protected, and only its descendants are
 * customer-managed. Also used to inherit the zone's file-content policy.
 */
function customerZoneRootOf(fullPath: string): string | null {
  return CUSTOMER_MANAGEABLE_ROOTS.find(root => fullPath.startsWith(`${root}/`)) ?? null
}

/**
 * The zone a path BELONGS to, counting a zone root as belonging to its own
 * zone. `customerZoneRootOf` deliberately excludes the root, because the root
 * is protected and only its descendants are customer-managed. Membership is a
 * different question: `products/xray` is a legal destination for a folder
 * already filed under `products/xray`.
 */
function zoneOf(fullPath: string): string | null {
  if (CUSTOMER_MANAGEABLE_ROOTS.includes(fullPath)) return fullPath
  return customerZoneRootOf(fullPath)
}

// ── Pure builder (injectable for unit tests) ──────────────────────────────────

export function buildFolderRegistry(
  flat: Array<{ id: string; name: string; parent: string | null }>,
): FolderEntry[] {
  const nameMap = new Map<string, string>()
  const parentMap = new Map<string, string | null>()

  for (const f of flat) {
    nameMap.set(f.id, f.name)
    parentMap.set(f.id, f.parent)
  }

  function parentChain(id: string): string[] {
    const chain: string[] = []
    // ML-CLOUD-01 — a simple visited guard. Directus should never produce a
    // parent cycle, but malformed data must degrade to a truncated chain rather
    // than spin forever.
    const seen = new Set<string>()
    let cur: string | null = id
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const n = nameMap.get(cur)
      if (!n) break
      chain.unshift(n)
      cur = parentMap.get(cur) ?? null
    }
    return chain
  }

  const entries: FolderEntry[] = flat.map((f) => {
    const parent_chain = parentChain(f.id)
    const full_path = parent_chain.join('/')
    const declared = FOLDER_POLICY[full_path]

    /**
     * ML-CLOUD-01 — the evaluation order governance decision #9.3 fixes:
     * frozen states first, then an exact system-folder hit, then a declared
     * customer zone, and only then unknown.
     *
     * A customer folder inherits its zone root's FILE policy, which is what
     * makes `products/xray/LT-180C` actually usable for uploads and moves
     * instead of a folder you can create but never put anything in. Nothing
     * outside a declared zone inherits anything.
     */
    const zoneRoot = declared === undefined ? customerZoneRootOf(full_path) : null
    const inCustomerZone = zoneRoot !== null
    const policy_state: PolicyState = declared
      ?? (inCustomerZone ? (FOLDER_POLICY[zoneRoot] ?? 'unknown') : 'unknown')

    const frozen = policy_state === 'legacy-read-only' || policy_state === 'conflict-frozen'
    const management: FolderManagement = frozen
      ? 'locked'
      : declared !== undefined
        ? 'protected'
        : inCustomerZone
          ? 'customer-managed'
          : 'locked'

    return {
      folder_uuid: f.id,
      name: f.name,
      parent_chain,
      full_path,
      policy_state,
      allow_upload: policy_state === 'active-canonical',
      allow_move_target: policy_state === 'active-canonical',
      management,
      zone_root: zoneOf(full_path),
    }
  })

  // §2.7 Ambiguity check: two distinct UUIDs resolving to the same full_path → fail-closed.
  const pathCount = new Map<string, number>()
  for (const e of entries) {
    pathCount.set(e.full_path, (pathCount.get(e.full_path) ?? 0) + 1)
  }
  const ambiguousPaths = new Set(
    [...pathCount.entries()].filter(([, n]) => n > 1).map(([p]) => p),
  )
  if (ambiguousPaths.size === 0) return entries

  return entries.map(e =>
    ambiguousPaths.has(e.full_path)
      // Ambiguity outranks everything: neither the files nor the folder move.
      ? { ...e, policy_state: 'ambiguous' as PolicyState, allow_upload: false, allow_move_target: false, management: 'locked' as FolderManagement }
      : e,
  )
}

// ── Live resolver (fetches from Directus) ─────────────────────────────────────

export async function resolveFolderRegistry(event: H3Event): Promise<FolderEntry[]> {
  const result = await adminFetch<{
    data: Array<{ id: string; name: string; parent: string | null }>
  }>(event, '/folders?limit=-1&fields=id,name,parent&sort[]=name')

  const data = (result as { data: Array<{ id: string; name: string; parent: string | null }> }).data ?? []
  return buildFolderRegistry(data)
}

// ── Validation helpers (pure, work on already-resolved registry) ──────────────

export type FolderValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

export function validateUploadFolder(
  registry: FolderEntry[],
  folderUuid: string | null,
  nullAllowed: boolean,
): FolderValidationResult {
  if (folderUuid === null || folderUuid === '') {
    if (nullAllowed) return { ok: true }
    return {
      ok: false,
      code: 'FOLDER_NULL_DISALLOWED',
      message: 'Existing files cannot be moved to Needs Classification via this operation.',
    }
  }

  const entry = registry.find(e => e.folder_uuid === folderUuid)
  if (!entry) {
    return {
      ok: false,
      code: 'FOLDER_UNKNOWN',
      message: 'Folder UUID not found in the Directus folder tree.',
    }
  }

  if (entry.policy_state === 'ambiguous') {
    return {
      ok: false,
      code: 'FOLDER_AMBIGUOUS',
      message: `Folder UUID ${folderUuid} resolves to path "${entry.full_path}" which is shared by multiple folder IDs.`,
    }
  }

  if (!entry.allow_upload) {
    return {
      ok: false,
      code: 'FOLDER_NOT_ALLOWED',
      message: `Folder "${entry.full_path}" has policy "${entry.policy_state}" which does not permit uploads.`,
    }
  }

  return { ok: true }
}

export function validateMoveFolder(
  registry: FolderEntry[],
  folderUuid: string | null,
): FolderValidationResult {
  if (folderUuid === null || folderUuid === '') {
    return {
      ok: false,
      code: 'FOLDER_NULL_DISALLOWED',
      message: 'Existing files cannot be moved to Needs Classification via move or batch-move.',
    }
  }

  const entry = registry.find(e => e.folder_uuid === folderUuid)
  if (!entry) {
    return {
      ok: false,
      code: 'FOLDER_UNKNOWN',
      message: 'Folder UUID not found in the Directus folder tree.',
    }
  }

  if (entry.policy_state === 'ambiguous') {
    return {
      ok: false,
      code: 'FOLDER_AMBIGUOUS',
      message: `Folder UUID ${folderUuid} resolves to path "${entry.full_path}" which is shared by multiple folder IDs.`,
    }
  }

  if (!entry.allow_move_target) {
    return {
      ok: false,
      code: 'FOLDER_NOT_ALLOWED',
      message: `Folder "${entry.full_path}" has policy "${entry.policy_state}" which does not permit move targets.`,
    }
  }

  return { ok: true }
}

// ── Throwing assertions (call from API handlers) ──────────────────────────────

export async function assertFolderAllowsUpload(
  folderUuid: string | null,
  event: H3Event,
  nullAllowed = false,
): Promise<void> {
  const registry = await resolveFolderRegistry(event)
  const result = validateUploadFolder(registry, folderUuid, nullAllowed)
  if (!result.ok) {
    throw createError({ statusCode: 422, message: `${result.code}: ${result.message}` })
  }
}

export async function assertFolderAllowsMove(
  folderUuid: string | null,
  event: H3Event,
): Promise<void> {
  const registry = await resolveFolderRegistry(event)
  const result = validateMoveFolder(registry, folderUuid)
  if (!result.ok) {
    throw createError({ statusCode: 422, message: `${result.code}: ${result.message}` })
  }
}

// ── ML-CLOUD-01: folder management validation ────────────────────────────────

/**
 * The naming rules a folder has to satisfy. Deliberately the short list: trim,
 * reject empty, reject the two path separators, cap the length. No visual-
 * equivalence engine, no unicode confusable analysis — this is business file
 * organisation, and an over-clever name normaliser would reject names people
 * legitimately want more often than it would prevent a real problem.
 */
export const MAX_FOLDER_NAME_LENGTH = 80

export type FolderNameResult =
  | { ok: true, name: string }
  | { ok: false, code: string, message: string }

export function normalizeFolderName(raw: unknown): FolderNameResult {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'FOLDER_NAME_INVALID', message: 'Folder name is required.' }
  }
  const name = raw.trim()
  if (name.length === 0) {
    return { ok: false, code: 'FOLDER_NAME_EMPTY', message: 'Folder name cannot be empty.' }
  }
  if (name.includes('/') || name.includes('\\')) {
    return { ok: false, code: 'FOLDER_NAME_SEPARATOR', message: 'Folder name cannot contain "/" or "\\".' }
  }
  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      ok: false,
      code: 'FOLDER_NAME_TOO_LONG',
      message: `Folder name cannot be longer than ${MAX_FOLDER_NAME_LENGTH} characters.`,
    }
  }
  return { ok: true, name }
}

/** Case-insensitive sibling comparison — "Manuals" and "manuals" in one folder is a mistake, not two folders. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** The children of a folder, or the roots when `parentUuid` is null. */
function childrenOf(registry: FolderEntry[], parentUuid: string | null): FolderEntry[] {
  if (parentUuid === null) return registry.filter(e => e.parent_chain.length === 1)
  const parent = registry.find(e => e.folder_uuid === parentUuid)
  if (!parent) return []
  const depth = parent.parent_chain.length + 1
  return registry.filter(e =>
    e.parent_chain.length === depth && e.full_path.startsWith(`${parent.full_path}/`),
  )
}

/**
 * May a new folder be created under this parent, with this name?
 *
 * The parent must be somewhere a customer is allowed to organise: either a
 * declared zone root (protected, but explicitly opened for children) or a
 * folder already inside that zone. Anything else — unknown, legacy, frozen,
 * ambiguous, or a system folder outside the declared zones — is refused.
 */
export function validateFolderCreate(
  registry: FolderEntry[],
  parentUuid: unknown,
  rawName: unknown,
): FolderValidationResult & { name?: string } {
  const named = normalizeFolderName(rawName)
  if (!named.ok) return { ok: false, code: named.code, message: named.message }

  if (typeof parentUuid !== 'string' || parentUuid === '') {
    return {
      ok: false,
      code: 'FOLDER_PARENT_REQUIRED',
      message: 'Choose a folder to create this folder inside.',
    }
  }

  const parent = registry.find(e => e.folder_uuid === parentUuid)
  if (!parent) {
    return { ok: false, code: 'FOLDER_UNKNOWN', message: 'Folder UUID not found in the Directus folder tree.' }
  }
  if (!folderCanHoldCustomerFolders(parent)) {
    return {
      ok: false,
      code: 'FOLDER_ZONE_DISALLOWED',
      message: `Folders cannot be created inside "${parent.full_path}".`,
    }
  }

  const duplicate = childrenOf(registry, parentUuid).some(c => sameName(c.name, named.name))
  if (duplicate) {
    return {
      ok: false,
      code: 'FOLDER_NAME_TAKEN',
      message: `"${named.name}" already exists in this folder.`,
    }
  }

  return { ok: true, name: named.name }
}

/**
 * A folder may hold customer-created children when it is itself
 * customer-managed, or when it is a declared zone root. The zone root is
 * protected — it cannot be renamed or moved — but it is explicitly the place
 * customers organise inside, which is why that permission is stated here per
 * folder rather than inferred from the folder not being on a list.
 */
export function folderCanHoldCustomerFolders(entry: FolderEntry): boolean {
  if (entry.management === 'customer-managed') return true
  return entry.management === 'protected' && CUSTOMER_MANAGEABLE_ROOTS.includes(entry.full_path)
}

export function validateFolderRename(
  registry: FolderEntry[],
  folderUuid: unknown,
  rawName: unknown,
): FolderValidationResult & { name?: string } {
  const named = normalizeFolderName(rawName)
  if (!named.ok) return { ok: false, code: named.code, message: named.message }

  const entry = typeof folderUuid === 'string' ? registry.find(e => e.folder_uuid === folderUuid) : undefined
  if (!entry) {
    return { ok: false, code: 'FOLDER_UNKNOWN', message: 'Folder UUID not found in the Directus folder tree.' }
  }
  if (entry.management !== 'customer-managed') {
    return {
      ok: false,
      code: 'FOLDER_PROTECTED',
      message: `"${entry.full_path}" is a system folder and cannot be renamed.`,
    }
  }

  const parentUuid = parentUuidOf(registry, entry)
  const duplicate = childrenOf(registry, parentUuid)
    .some(c => c.folder_uuid !== entry.folder_uuid && sameName(c.name, named.name))
  if (duplicate) {
    return { ok: false, code: 'FOLDER_NAME_TAKEN', message: `"${named.name}" already exists in this folder.` }
  }

  return { ok: true, name: named.name }
}

/** The UUID of a folder's parent, derived from the registry's own paths. */
function parentUuidOf(registry: FolderEntry[], entry: FolderEntry): string | null {
  if (entry.parent_chain.length <= 1) return null
  const parentPath = entry.parent_chain.slice(0, -1).join('/')
  return registry.find(e => e.full_path === parentPath)?.folder_uuid ?? null
}

/**
 * May this folder move under that parent?
 *
 * The ways this goes wrong are all refused: moving a folder into itself, into
 * one of its own descendants (which would detach the subtree from the tree
 * entirely), out of the customer zone into somewhere protected, and across
 * from one declared zone into another.
 */
export function validateFolderMove(
  registry: FolderEntry[],
  folderUuid: unknown,
  newParentUuid: unknown,
): FolderValidationResult {
  const entry = typeof folderUuid === 'string' ? registry.find(e => e.folder_uuid === folderUuid) : undefined
  if (!entry) {
    return { ok: false, code: 'FOLDER_UNKNOWN', message: 'Folder UUID not found in the Directus folder tree.' }
  }
  if (entry.management !== 'customer-managed') {
    return {
      ok: false,
      code: 'FOLDER_PROTECTED',
      message: `"${entry.full_path}" is a system folder and cannot be moved.`,
    }
  }

  if (typeof newParentUuid !== 'string' || newParentUuid === '') {
    return { ok: false, code: 'FOLDER_PARENT_REQUIRED', message: 'Choose a destination folder.' }
  }
  if (newParentUuid === entry.folder_uuid) {
    return { ok: false, code: 'FOLDER_MOVE_INTO_SELF', message: 'A folder cannot be moved into itself.' }
  }

  const target = registry.find(e => e.folder_uuid === newParentUuid)
  if (!target) {
    return { ok: false, code: 'FOLDER_UNKNOWN', message: 'Destination folder not found in the Directus folder tree.' }
  }
  // Path prefix is enough to detect a descendant, and it needs no graph walk.
  if (target.full_path === entry.full_path || target.full_path.startsWith(`${entry.full_path}/`)) {
    return {
      ok: false,
      code: 'FOLDER_MOVE_INTO_DESCENDANT',
      message: 'A folder cannot be moved into one of its own subfolders.',
    }
  }
  if (!folderCanHoldCustomerFolders(target)) {
    return {
      ok: false,
      code: 'FOLDER_ZONE_DISALLOWED',
      message: `Folders cannot be moved into "${target.full_path}".`,
    }
  }

  /**
   * D-023 — a customer folder organises inside its own zone, and moving it to
   * another declared zone is refused. The zone is the product category the
   * assets underneath it are filed under, so a folder that hops between zones
   * silently re-files everything in it while every UUID stays valid — the kind
   * of change nobody would notice until the wrong category shows the wrong
   * datasheets.
   *
   * Both sides are known non-null by the time we get here: the source is
   * customer-managed, which means it sits under a zone, and the destination
   * passed `folderCanHoldCustomerFolders`, which means it is a zone root or
   * inside one. So a plain comparison cannot pass by matching two nulls.
   */
  if (target.zone_root !== entry.zone_root) {
    return {
      ok: false,
      code: 'FOLDER_ZONE_MISMATCH',
      message: `"${entry.full_path}" can only be moved within "${entry.zone_root}".`,
    }
  }

  const duplicate = childrenOf(registry, newParentUuid)
    .some(c => c.folder_uuid !== entry.folder_uuid && sameName(c.name, entry.name))
  if (duplicate) {
    return {
      ok: false,
      code: 'FOLDER_NAME_TAKEN',
      message: `"${entry.name}" already exists in the destination folder.`,
    }
  }

  return { ok: true }
}
