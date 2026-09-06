import { adminFetch } from '~/server/utils/adminDirectusClient'
import { KNOWN_STATUSES } from '~/server/utils/adminProductsQuery'
import type { H3Event } from 'h3'

interface AggRow { status: string; count: { id: string } }

export default defineEventHandler(async (event: H3Event) => {
  const result = await adminFetch<{ data: AggRow[] }>(
    event,
    '/items/products?aggregate[count]=id&groupBy[]=status&limit=-1',
  )
  const byStatus: Record<string, number> = {}
  let all = 0
  for (const row of result.data) {
    const n = parseInt(row.count.id, 10) || 0
    if (KNOWN_STATUSES.has(row.status)) {
      byStatus[row.status] = n
      all += n
    }
  }
  return {
    all,
    draft: byStatus['draft'] ?? 0,
    review: byStatus['review'] ?? 0,
    draft_review: (byStatus['draft'] ?? 0) + (byStatus['review'] ?? 0),
    published: byStatus['published'] ?? 0,
    archived: byStatus['archived'] ?? 0,
  }
})
