import { setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * V2-05 — the existing product categories, listed for the third tab of /admin/page-content.
 *
 * The name, introduction and image stay in `product_categories`; nothing is copied into
 * `site_content`. The public product pages read this row, so a second copy is exactly how the two
 * would drift apart.
 *
 * Read-only here. Creating or deleting a category is not part of this screen.
 */
const FIELDS = 'id,slug,name_en,intro_en,hero_image,status,sort'

interface Row {
  id: number
  slug?: string | null
  name_en?: string | null
  intro_en?: string | null
  hero_image?: string | null
  status?: string | null
  sort?: number | null
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const res = await adminFetch<{ data?: Row[] }>(
    event,
    `/items/product_categories?fields=${FIELDS}&sort=sort,name_en&limit=-1`,
  )
  const rows = Array.isArray(res?.data) ? res.data : []

  return {
    categories: rows.map(r => ({
      id: r.id,
      slug: r.slug ?? '',
      name: r.name_en ?? '',
      intro: r.intro_en ?? '',
      heroImage: r.hero_image ?? null,
      status: r.status ?? '',
      sort: r.sort ?? null,
    })),
  }
})
