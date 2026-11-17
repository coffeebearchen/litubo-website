import { getQuery, setHeader, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * V2-03 — the Blog & FAQ list.
 *
 * Source of truth is `posts`, the collection the public Insights pages actually read. Content Center
 * uses `content_items`, which the public blog never reads, so mixing them here would show a record
 * that looks published but changes nothing on the site.
 *
 * Returns only list fields: no body, so the list stays small and the editor loads the full row.
 */
const LIST_FIELDS = 'id,slug,title_en,status,content_type,publish_date,cover_image,updated_at'

/** Content types the public blog and FAQ actually render. */
const BLOG_TYPES = ['insight', 'technical_guide']
const FAQ_TYPES = ['faq']

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const query = getQuery(event)
  const tab = query.tab === 'faq' ? 'faq' : 'blog'
  const types = tab === 'faq' ? FAQ_TYPES : BLOG_TYPES

  const params = new URLSearchParams({
    fields: LIST_FIELDS,
    limit: '200',
    sort: '-publish_date,-id',
    'filter[content_type][_in]': types.join(','),
  })

  // A search box that filtered in the browser would only search the page already loaded; filter
  // server-side so the count stays honest.
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : ''
  if (q) params.set('filter[title_en][_icontains]', q)

  if (query.status === 'draft' || query.status === 'published') {
    params.set('filter[status][_eq]', String(query.status))
  }

  const res = await adminFetch<{ data?: unknown[] }>(event, `/items/posts?${params.toString()}`)
  const rows = Array.isArray(res?.data) ? res.data : []

  if (!Array.isArray(res?.data)) {
    throw createError({ statusCode: 502, message: 'Unexpected response from the content store' })
  }

  return { tab, count: rows.length, posts: rows }
})
