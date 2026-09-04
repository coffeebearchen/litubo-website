import { adminFetch } from '~/server/utils/adminDirectusClient'

export interface FolderNode {
  id: string
  name: string
  parent: string | null
  children: FolderNode[]
}

export default defineEventHandler(async (event) => {
  const result = await adminFetch<{ data: Array<{ id: string; name: string; parent: string | null }> }>(
    event,
    '/folders?limit=-1&fields=id,name,parent&sort[]=name',
  )

  const flat = (result as { data: Array<{ id: string; name: string; parent: string | null }> }).data ?? []

  // Build tree
  const map = new Map<string, FolderNode>()
  for (const f of flat) map.set(f.id, { ...f, children: [] })

  const roots: FolderNode[] = []
  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
})
