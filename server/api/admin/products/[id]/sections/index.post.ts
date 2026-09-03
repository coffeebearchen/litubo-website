import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import { SECTION_TYPES } from '~/types/product-cms'
import type { SectionType, SectionLayoutVariant } from '~/types/product-cms'

const LAYOUT_VARIANTS: SectionLayoutVariant[] = ['default', 'image_left', 'image_right', 'wide', 'narrow', 'two_column']

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  const body = await readBody(event)
  const type = body.type as SectionType
  if (!type || !SECTION_TYPES.includes(type)) {
    throw createError({ statusCode: 400, message: `section type 无效，允许值：${SECTION_TYPES.join(', ')}` })
  }

  if (body.external_url !== undefined && body.external_url !== null && body.external_url !== '') {
    if (!/^https:\/\/.+/.test(String(body.external_url))) {
      throw createError({ statusCode: 422, message: 'external_url 必须以 https:// 开头' })
    }
  }

  if (body.layout_variant !== undefined && body.layout_variant !== null) {
    if (!LAYOUT_VARIANTS.includes(body.layout_variant as SectionLayoutVariant)) {
      throw createError({ statusCode: 400, message: `layout_variant 无效，允许值：${LAYOUT_VARIANTS.join(', ')}` })
    }
  }

  // Validate media_id belongs to this product
  if (body.media_id !== undefined && body.media_id !== null) {
    const mediaCheck = await adminFetch<{ data: { products_id: number } | null }>(
      event, `/items/products_files/${body.media_id}?fields=products_id`,
    )
    const mData = (mediaCheck as { data: { products_id: number } | null }).data
    if (!mData || mData.products_id !== productId) {
      throw createError({ statusCode: 422, message: 'media_id 必须属于本产品的 products_files 记录' })
    }
  }

  const payload = {
    product_id: productId,
    type,
    title_en: body.title_en ?? null,
    title_es: body.title_es ?? null,
    title_pt: body.title_pt ?? null,
    eyebrow_en: body.eyebrow_en ?? null,
    eyebrow_es: body.eyebrow_es ?? null,
    eyebrow_pt: body.eyebrow_pt ?? null,
    body_en: body.body_en ?? null,
    body_es: body.body_es ?? null,
    body_pt: body.body_pt ?? null,
    layout_variant: body.layout_variant ?? null,
    media_id: body.media_id ?? null,
    external_url: body.external_url ?? null,
    enabled: body.enabled !== false,
    sort: body.sort ?? null,
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_sections', {
    method: 'POST',
    body: payload,
  })
  return (result as { data: unknown }).data
})
