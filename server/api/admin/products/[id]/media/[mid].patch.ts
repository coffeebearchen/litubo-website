import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'
import { FILE_ROLES } from '~/types/product-cms'
import type { FileRole } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const mid = getRouterParam(event, 'mid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!mid || isNaN(Number(mid))) throw createError({ statusCode: 400, message: '无效的媒体记录 ID' })
  await assertProductDraftForMutation(event, Number(id))

  const check = await adminFetch<{ data: { products_id: number } | null }>(
    event, `/items/products_files/${mid}?fields=products_id`,
  )
  const checkData = (check as { data: { products_id: number } | null }).data
  if (!checkData || checkData.products_id !== Number(id)) {
    throw createError({ statusCode: 403, message: '该媒体记录不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)

  if (body.file_role !== undefined && body.file_role !== null) {
    if (!FILE_ROLES.includes(body.file_role as FileRole)) {
      throw createError({ statusCode: 400, message: `file_role 无效，允许值：${FILE_ROLES.join(', ')}` })
    }
  }

  const LANG_VALUES = ['all', 'en', 'es', 'pt']
  if (body.language !== undefined && body.language !== null) {
    if (!LANG_VALUES.includes(body.language)) {
      throw createError({ statusCode: 400, message: `language 无效，允许值：${LANG_VALUES.join(', ')}` })
    }
  }

  const payload: Record<string, unknown> = {}
  const allowed = ['file_role','alt_en','alt_es','alt_pt','caption_en','caption_es','caption_pt',
    'enabled','language','version_label','sort','file_date']
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key]
  }
  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/products_files/${mid}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
