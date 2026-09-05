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

export interface FolderEntry {
  folder_uuid: string
  name: string
  parent_chain: string[]   // names from root to this folder
  full_path: string        // e.g. 'products/xray'
  policy_state: PolicyState
  allow_upload: boolean
  allow_move_target: boolean
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
    let cur: string | null = id
    while (cur) {
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
    const policy_state: PolicyState = FOLDER_POLICY[full_path] ?? 'unknown'
    return {
      folder_uuid: f.id,
      name: f.name,
      parent_chain,
      full_path,
      policy_state,
      allow_upload: policy_state === 'active-canonical',
      allow_move_target: policy_state === 'active-canonical',
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
      ? { ...e, policy_state: 'ambiguous' as PolicyState, allow_upload: false, allow_move_target: false }
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
