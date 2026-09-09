import { createError, readBody } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { resolveFolderRegistry, validateFolderCreate } from '~/server/utils/folderRegistry'

/**
 * ML-CLOUD-01 — create a customer-managed folder.
 *
 * A customer may organise inside a declared customer zone and nowhere else.
 * The zone is what grants the right; a path is never permitted merely because
 * nobody wrote it down (governance decision #9.4).
 *
 * The registry is resolved fresh here rather than trusted from the browser,
 * and the sibling-name check runs against that fresh read — which is also the
 * concurrency story for V1. Two people creating "manuals" at the same instant
 * is not a distributed-locking problem for a single-tenant admin tool; it is a
 * re-check immediately before the write, plus a disabled button on the client.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: unknown, parent?: unknown }>(event)

  const registry = await resolveFolderRegistry(event)
  const check = validateFolderCreate(registry, body?.parent, body?.name)
  if (!check.ok) {
    throw createError({ statusCode: 422, message: `${check.code}: ${check.message}` })
  }

  const created = await adminFetch<{ data: { id: string, name: string } }>(event, '/folders', {
    method: 'POST',
    body: { name: check.name, parent: body!.parent },
  })

  return { id: created.data.id, name: created.data.name }
})
