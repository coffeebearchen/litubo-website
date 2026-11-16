import { defineEventHandler, getQuery } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { INDUSTRY_GUIDES } from '~/content/industry-guides'

/**
 * Public site search.
 *
 * Only content that is already public is searchable: published products, published articles and the
 * fixed application guides. Drafts, archived records, private media and inquiry data are never
 * reachable, and no service credential leaves the server.
 *
 * This is a plain substring search over the current language's fields. It deliberately does not call
 * an AI or a paid search provider — the site has none, and a keyword query does not need one.
 */

interface ProductRow {
  slug: string
  name_en: string | null
  summary_en: string | null
  model_or_series: string | null
  category_id: number | null
}
interface CategoryRow { id: number; slug: string; name_en: string | null }
interface PostRow {
  slug: string
  content_type: string
  title_en: string | null
  excerpt_en: string | null
  publish_date: string | null
}

interface SearchHit {
  type: 'product' | 'application' | 'insight'
  title: string
  subtitle: string
  to: string
}

const POST_ROUTE: Readonly<Record<string, string>> = {
  insight: '/resources/insights',
  technical_guide: '/resources/technical-guides',
  case_study: '/resources/case-studies',
  news: '/resources/news',
}

/** Minimum length: 2 Latin/Arabic characters, 1 CJK character. */
function isSearchable(q: string): boolean {
  if (!q) return false
  if (/[\u4e00-\u9fff]/.test(q)) return true
  return q.length >= 2
}

function clip(value: string | null | undefined, max = 160): string {
  if (!value) return ''
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const raw = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : ''
  const type = typeof query.type === 'string' ? query.type : 'all'
  const limit = Math.min(30, Math.max(1, Number(query.limit ?? 20) || 20))

  const empty = { q: raw, type, total: 0, hits: [] as SearchHit[], error: false }
  if (!isSearchable(raw)) return empty

  const pattern = raw.toLowerCase()
  const hits: SearchHit[] = []

  try {
    const wantProducts = type === 'all' || type === 'products'
    const wantInsights = type === 'all' || type === 'insights'

    const [catRes, productRes, postRes] = await Promise.all([
      wantProducts
        ? directusFetch<{ data: CategoryRow[] }>('/items/product_categories?filter[status][_eq]=published&fields=id,slug,name_en&limit=50')
        : Promise.resolve({ data: [] as CategoryRow[] }),
      wantProducts
        ? directusFetch<{ data: ProductRow[] }>('/items/products?filter[status][_eq]=published&fields=slug,name_en,summary_en,model_or_series,category_id&limit=200')
        : Promise.resolve({ data: [] as ProductRow[] }),
      wantInsights
        ? directusFetch<{ data: PostRow[] }>('/items/posts?filter[status][_eq]=published&filter[content_type][_in]=insight,technical_guide&fields=slug,content_type,title_en,excerpt_en,publish_date&limit=200')
        : Promise.resolve({ data: [] as PostRow[] }),
    ])

    const catById = new Map<number, CategoryRow>()
    for (const c of catRes.data ?? []) catById.set(c.id, c)

    if (wantProducts) {
      for (const p of productRes.data ?? []) {
        const haystack = `${p.name_en ?? ''} ${p.model_or_series ?? ''} ${p.summary_en ?? ''}`.toLowerCase()
        if (!haystack.includes(pattern)) continue
        const cat = p.category_id != null ? catById.get(p.category_id) : undefined
        if (!cat) continue
        hits.push({
          type: 'product',
          title: p.name_en ?? p.slug,
          subtitle: [p.model_or_series, clip(p.summary_en)].filter(Boolean).join(' · '),
          to: `/products/${cat.slug}/${p.slug}`,
        })
      }
    }

    if (wantInsights) {
      for (const post of postRes.data ?? []) {
        const haystack = `${post.title_en ?? ''} ${post.excerpt_en ?? ''}`.toLowerCase()
        if (!haystack.includes(pattern)) continue
        const base = POST_ROUTE[post.content_type]
        if (!base) continue
        hits.push({
          type: 'insight',
          title: post.title_en ?? post.slug,
          subtitle: clip(post.excerpt_en),
          to: `${base}/${post.slug}`,
        })
      }
    }

    if (type === 'all' || type === 'applications') {
      for (const guide of INDUSTRY_GUIDES) {
        const haystack = `${guide.title} ${guide.intro}`.toLowerCase()
        if (!haystack.includes(pattern)) continue
        hits.push({
          type: 'application',
          title: guide.title,
          subtitle: clip(guide.intro),
          to: `/applications/${guide.slug}`,
        })
      }
    }

    return {
      q: raw,
      type,
      total: hits.length,
      hits: hits.slice(0, limit),
      error: false,
    }
  }
  catch (err) {
    console.error('[search] failed:', err instanceof Error ? err.message : err)
    return { q: raw, type, total: 0, hits: [], error: true }
  }
})
