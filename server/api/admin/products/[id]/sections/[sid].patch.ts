import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { SECTION_TYPES } from '~/types/product-cms'
import type { SectionType, SectionLayoutVariant } from '~/types/product-cms'

const LAYOUT_VARIANTS: SectionLayoutVariant[] = ['default', 'image_left', 'image_right', 'wide', 'narrow', 'two_column']

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sid = getRouterParam(event, 'sid')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  if (!sid || isNaN(Number(sid))) throw createError({ statusCode: 400, message: '无效的 section ID' })
  const productId = Number(id)

  // Ownership check
  const existing = await adminFetch<{ data: { product_id: number } | null }>(
    event, `/items/product_sections/${sid}?fields=product_id`,
  )
  const existData = (existing as { data: { product_id: number } | null }).data
  if (!existData || existData.product_id !== productId) {
    throw createError({ statusCode: 403, message: '该 section 不属于此产品，操作被拒绝' })
  }

  const body = await readBody(event)
  const payload: Record<string, unknown> = {}

  if (body.type !== undefined) {
    if (!SECTION_TYPES.includes(body.type as SectionType)) {
      throw createError({ statusCode: 400, message: `section type 无效，允许值：${SECTION_TYPES.join(', ')}` })
    }
    payload.type = body.type
  }

  if (body.external_url !== undefined && body.external_url !== null && body.external_url !== '') {
    if (!/^https:\/\/.+/.test(String(body.external_url))) {
      throw createError({ statusCode: 400, message: 'external_url 必须以 https:// 开头' })
    }
  }

  if (body.layout_variant !== undefined && body.layout_variant !== null) {
    if (!LAYOUT_VARIANTS.includes(body.layout_variant as SectionLayoutVariant)) {
      throw createError({ statusCode: 400, message: `layout_variant 无效，允许值：${LAYOUT_VARIANTS.join(', ')}` })
    }
  }

  if (body.media_id !== undefined && body.media_id !== null) {
    const mediaCheck = await adminFetch<{ data: { products_id: number } | null }>(
      event, `/items/products_files/${body.media_id}?fields=products_id`,
    )
    const mData = (mediaCheck as { data: { products_id: number } | null }).data
    if (!mData || mData.products_id !== productId) {
      throw createError({ statusCode: 400, message: 'media_id 必须属于本产品的 products_files 记录' })
    }
  }

  const allowed = ['type','title_en','title_es','title_pt','eyebrow_en','eyebrow_es','eyebrow_pt',
    'body_en','body_es','body_pt','layout_variant','media_id','external_url','enabled','sort']
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key]
  }

  if (Object.keys(payload).length === 0) throw createError({ statusCode: 400, message: '没有可更新的字段' })

  const result = await adminFetch<{ data: unknown }>(event, `/items/product_sections/${sid}`, {
    method: 'PATCH', body: payload,
  })
  return (result as { data: unknown }).data
})
