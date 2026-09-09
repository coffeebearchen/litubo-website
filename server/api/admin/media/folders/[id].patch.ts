import { createError, getRouterParam, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { resolveFolderRegistry, validateFolderRename, validateFolderMove } from '~/server/utils/folderRegistry'

/**
 * ML-CLOUD-01 — rename and/or move one customer-managed folder.
 *
 * Both operations are the same Directus write on the same row, so they share
 * one endpoint rather than two that would have to guard each other. A request
 * may carry a new `name`, a new `parent`, or both.
 *
 * What this endpoint must never do is change identity. The folder UUID does
 * not move, the files inside keep their own UUIDs, and every Product, Content,
 * Branding and AI Source reference continues to resolve — because none of them
 * reference a path. That is the whole reason renaming is safe here and would
 * not be in a path-addressed system.
 *
 * System folders are refused outright: a customer cannot rename or move the
 * business classification the rest of the site is organised by.
 */
export default defineEventHandler(async (event) => {
  const folderUuid = getRouterParam(event, 'id')
  if (!folderUuid) throw createError({ statusCode: 400, message: 'Folder id is required.' })

  const body = await readBody<{ name?: unknown, parent?: unknown }>(event)
  const wantsRename = body?.name !== undefined
  const wantsMove = body?.parent !== undefined
  if (!wantsRename && !wantsMove) {
    throw createError({ statusCode: 400, message: 'Nothing to update: provide a name, a parent, or both.' })
  }

  // Read fresh, immediately before writing — see folders.post.ts on why this is
  // the whole of the concurrency story for V1.
  const registry = await resolveFolderRegistry(event)
  const payload: Record<string, unknown> = {}

  if (wantsRename) {
    const check = validateFolderRename(registry, folderUuid, body!.name)
    if (!check.ok) throw createError({ statusCode: 422, message: `${check.code}: ${check.message}` })
    payload.name = check.name
  }

  if (wantsMove) {
    const check = validateFolderMove(registry, folderUuid, body!.parent)
    if (!check.ok) throw createError({ statusCode: 422, message: `${check.code}: ${check.message}` })
    payload.parent = body!.parent
  }

  await adminFetch(event, `/folders/${folderUuid}`, { method: 'PATCH', body: payload })

  return { id: folderUuid, ...payload }
})
