import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { assertNoDuplicateMediaLink } from '~/server/utils/productMediaLinks'
import { FILE_ROLES } from '~/types/product-cms'
import type { FileRole } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  const body = await readBody(event)

  if (!body.directus_files_id) {
    throw createError({ statusCode: 400, message: 'directus_files_id 为必填项' })
  }

  const fetch = <T>(path: string, opts?: Record<string, unknown>) =>
    adminFetch<T>(event, path, opts)
  await assertNoDuplicateMediaLink(Number(id), body.directus_files_id, fetch)

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

  const payload = {
    products_id: Number(id),
    directus_files_id: body.directus_files_id,
    file_role: body.file_role ?? null,
    alt_en: body.alt_en ?? null,
    alt_es: body.alt_es ?? null,
    alt_pt: body.alt_pt ?? null,
    caption_en: body.caption_en ?? null,
    caption_es: body.caption_es ?? null,
    caption_pt: body.caption_pt ?? null,
    enabled: body.enabled !== false,
    language: body.language ?? null,
    version_label: body.version_label ?? null,
    sort: body.sort ?? null,
    file_date: body.file_date ?? null,
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/products_files', {
    method: 'POST', body: payload,
  })
  return (result as { data: unknown }).data
})
