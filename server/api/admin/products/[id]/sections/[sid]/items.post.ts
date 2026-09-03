import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!sid || isNaN(Number(sid))) throw createError({ statusCode: 400, message: '无效的 section ID' })
  await assertProductExists(event, Number(id))

  const secCheck = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_sections/${sid}?fields=product_id`,
  )
  const secData = (secCheck as { data: { product_id: number } | null }).data
  if (!secData || secData.product_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该 section 不属于此产品' })
  }

  const body = await readBody(event)
  const payload = {
    section_id: Number(sid),
    label_en: body.label_en ?? null,
    label_es: body.label_es ?? null,
    label_pt: body.label_pt ?? null,
    title_en: body.title_en ?? null,
    title_es: body.title_es ?? null,
    title_pt: body.title_pt ?? null,
    body_en: body.body_en ?? null,
    body_es: body.body_es ?? null,
    body_pt: body.body_pt ?? null,
    icon_key: body.icon_key ?? null,
    sort: body.sort ?? null,
    enabled: body.enabled !== false,
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_section_items', {
    method: 'POST', body: payload,
  })
  return (result as { data: unknown }).data
})
