import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'
import { createSpecGroup } from '~/server/utils/productSpecWriter'

/** Delegates to the canonical writer (`productSpecWriter.ts`) — the same function the AI Apply endpoint uses to create a group. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductDraftForMutation(event, Number(id))

  const body = await readBody(event)
  if (!body.title_en?.trim()) throw createError({ statusCode: 400, message: '参数组标题（EN）为必填项' })

  const fetch = <T>(path: string, opts?: Record<string, unknown>) => adminFetch<T>(event, path, opts)
  const groupId = await createSpecGroup(fetch, {
    product_id: Number(id),
    title_en: body.title_en,
    title_es: body.title_es ?? null,
    title_pt: body.title_pt ?? null,
    description_en: body.description_en ?? null,
    enabled: body.enabled !== false,
    sort: body.sort ?? null,
  })
  return { id: groupId }
})
