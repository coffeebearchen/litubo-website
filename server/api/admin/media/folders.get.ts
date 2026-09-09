import { adminFetch } from '~/server/utils/adminDirectusClient'
import { buildFolderRegistry, folderCanHoldCustomerFolders } from '~/server/utils/folderRegistry'
import type { PolicyState, FolderManagement } from '~/server/utils/folderRegistry'

export interface FolderNode {
  id: string
  name: string
  parent: string | null
  full_path: string
  policy_state: PolicyState
  allow_upload: boolean
  allow_move_target: boolean
  /**
   * ML-CLOUD-01 — whether the folder ITSELF may be renamed or moved, which is
   * a different question from whether files may be put in it. The browser
   * needs both to render the right controls.
   */
  management: FolderManagement
  /** True when a customer may create folders inside this one. */
  can_create_children: boolean
  /** The declared customer zone this folder belongs to, so the browser can offer same-zone move targets only. */
  zone_root: string | null
  children: FolderNode[]
}

export default defineEventHandler(async (event) => {
  const result = await adminFetch<{
    data: Array<{ id: string; name: string; parent: string | null }>
  }>(event, '/folders?limit=-1&fields=id,name,parent&sort[]=name')

  const flat = (result as { data: Array<{ id: string; name: string; parent: string | null }> }).data ?? []

  // Enrich with registry policy fields
  const registry = buildFolderRegistry(flat)
  const entryMap = new Map(registry.map(e => [e.folder_uuid, e]))

  // Build enriched tree
  const nodeMap = new Map<string, FolderNode>()
  for (const f of flat) {
    const entry = entryMap.get(f.id)
    nodeMap.set(f.id, {
      id: f.id,
      name: f.name,
      parent: f.parent,
      full_path: entry?.full_path ?? f.name,
      policy_state: entry?.policy_state ?? 'unknown',
      allow_upload: entry?.allow_upload ?? false,
      allow_move_target: entry?.allow_move_target ?? false,
      management: entry?.management ?? 'locked',
      can_create_children: entry ? folderCanHoldCustomerFolders(entry) : false,
      zone_root: entry?.zone_root ?? null,
      children: [],
    })
  }

  const roots: FolderNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parent && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent)!.children.push(node)
    }
    else {
      roots.push(node)
    }
  }

  return roots
})
