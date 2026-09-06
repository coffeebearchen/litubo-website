import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { H3Event } from 'h3'

interface RawCategory { id: number; slug: string; name_en: string }
interface AggRow { category_id: number | null; status: string; count: { id: string } }

export default defineEventHandler(async (event: H3Event) => {
  const [categoriesResult, aggResult] = await Promise.all([
    adminFetch<{ data: RawCategory[] }>(
      event,
      '/items/product_categories?fields=id,slug,name_en&sort=name_en&limit=-1',
    ),
    adminFetch<{ data: AggRow[] }>(
      event,
      '/items/products?aggregate[count]=id&groupBy[]=category_id,status&limit=-1',
    ),
  ])

  const categories = categoriesResult.data
  const aggRows = aggResult.data

  return categories.map((cat) => {
    const rows = aggRows.filter((r) => r.category_id === cat.id)
    const byStatus = { draft: 0, review: 0, published: 0, archived: 0 }
    let total = 0
    for (const row of rows) {
      const s = row.status as keyof typeof byStatus
      const n = parseInt(row.count.id, 10) || 0
      if (s in byStatus) {
        byStatus[s] = n
        total += n
      }
    }
    return { id: cat.id, slug: cat.slug, name_en: cat.name_en, total, by_status: byStatus }
  })
})
