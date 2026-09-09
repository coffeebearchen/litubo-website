import { createError, getRouterParam, setResponseHeader } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the minimal product context the AI
 * screens need, and nothing else.
 *
 * Those screens previously loaded the general `/api/admin/products/:id`
 * record, whose response carries the whole product: the hero image's Directus
 * UUID, internal review notes, SEO fields, highlights, and more. A screen that
 * renders a product name, a status chip and a thumbnail has no business
 * receiving any of that, and once it is in the browser it is in the browser.
 *
 * This returns four fields. The thumbnail is a URL to
 * `/api/admin/products/:id/ai/hero`, which is keyed by the product's numeric
 * route — so even the image reference contains no Directus identifier.
 */

/** Exactly what the AI screens receive about the product. No Directus identifier appears in any field. */
export interface AiProductContext {
  productId: number
  productName: string
  productCode: string | null
  lifecycleStatus: string
  /** Product-scoped thumbnail route, or null when this product has no image. Never an assets URL and never a file UUID. */
  thumbnailUrl: string | null
}

export default defineEventHandler(async (event): Promise<AiProductContext> => {
  // One administrator's working context: never cached by a shared cache, never
  // left on disk, never surviving sign-out.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid product id' })
  const productId = Number(id)
  await assertProductExists(event, productId)

  // Only these four columns are requested. Nothing that is not selected here
  // can be leaked by a later change to the response shape.
  const result = await adminFetch<{
    data: { name_en: string | null, product_code: string | null, status: string | null, hero_image: string | null } | null
  }>(event, `/items/products/${productId}?fields=name_en,product_code,status,hero_image`)

  const row = result.data
  if (!row) throw createError({ statusCode: 404, message: `产品 ID ${productId} 不存在` })

  return {
    productId,
    productName: row.name_en ?? 'Untitled product',
    productCode: row.product_code ?? null,
    lifecycleStatus: row.status ?? 'draft',
    // The UUID is used to decide whether a thumbnail exists, then discarded.
    thumbnailUrl: row.hero_image ? `/api/admin/products/${productId}/ai/hero` : null,
  }
})
