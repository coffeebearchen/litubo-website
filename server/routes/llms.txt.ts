/**
 * `/llms.txt` — a compact, machine-readable index of the public site for AI answer engines.
 *
 * This is the emerging convention (llmstxt.org): a small Markdown file that tells a language model
 * what the site is and where its key public pages are, without forcing it to crawl everything.
 *
 * Ground rules:
 * - every entry comes from the published database, using the same public gates as the website;
 * - draft, archived or unlisted records never appear;
 * - no prices, lead times, certifications or performance claims are stated, because the site does
 *   not publish them — an AI answer must not be able to quote a fact we cannot stand behind.
 */
import { defineEventHandler, setHeader } from 'h3'
import { directusFetch } from '~/server/utils/directus'

interface CategoryRow { id: number; slug: string; name_en: string | null; intro_en: string | null; sort: number | null }
interface ProductRow {
  slug: string
  name_en: string | null
  summary_en: string | null
  model_or_series: string | null
  seo_noindex: boolean | null
  category_id: number | null
}
interface PostRow {
  slug: string
  content_type: string
  title_en: string | null
  excerpt_en: string | null
}

const SITE = 'https://litubo.com'

const APPLICATION_PAGES: Array<{ slug: string; name: string; intro: string }> = [
  { slug: 'packaged-food', name: 'Packaged Food', intro: 'Bags, trays, pouches and lightweight food packs.' },
  { slug: 'bottled-canned-products', name: 'Bottled & Canned Products', intro: 'Glass, plastic and metal containers and closures.' },
  { slug: 'meat-seafood', name: 'Meat & Seafood', intro: 'Fresh, chilled and frozen product handling.' },
  { slug: 'frozen-food', name: 'Frozen Food', intro: 'Frozen packs, condensation and cleaning considerations.' },
  { slug: 'bakery-snacks', name: 'Bakery & Snacks', intro: 'Loose or packed bakery and snack products.' },
  { slug: 'nuts-seeds-dried-food', name: 'Nuts, Seeds & Dried Food', intro: 'Bulk and packed free-flowing product.' },
  { slug: 'powder-granules', name: 'Powder & Granules', intro: 'Loose or packaged powders and granular material.' },
  { slug: 'pharmaceutical-daily-chemical', name: 'Pharmaceutical & Daily Chemical', intro: 'Bottles, cartons, sachets and other formats.' },
]

function oneLine(value: string | null | undefined, max = 180): string {
  if (!value) return ''
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export default defineEventHandler(async (event) => {
  let categories: CategoryRow[] = []
  let products: ProductRow[] = []
  let posts: PostRow[] = []

  try {
    const [catRes, prodRes, postRes] = await Promise.all([
      directusFetch<{ data: CategoryRow[] }>('/items/product_categories?filter[status][_eq]=published&fields=id,slug,name_en,intro_en,sort&sort=sort&limit=50'),
      directusFetch<{ data: ProductRow[] }>('/items/products?filter[status][_eq]=published&fields=slug,name_en,summary_en,model_or_series,seo_noindex,category_id&sort=name_en&limit=200'),
      directusFetch<{ data: PostRow[] }>('/items/posts?filter[status][_eq]=published&filter[content_type][_in]=insight,technical_guide&fields=slug,content_type,title_en,excerpt_en&sort=-publish_date&limit=100'),
    ])
    categories = catRes.data ?? []
    products = prodRes.data ?? []
    posts = postRes.data ?? []
  }
  catch {
    // A Directus outage must not serve a half-true index.
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setHeader(event, 'Cache-Control', 'no-store')
    return '# LITUBO\n\n> This index is temporarily unavailable.\n'
  }

  const catById = new Map<number, { slug: string; name: string }>()
  for (const c of categories) catById.set(c.id, { slug: c.slug, name: c.name_en ?? c.slug })

  const lines: string[] = []
  lines.push('# LITUBO')
  lines.push('')
  lines.push('> LITUBO supplies food and packaging inspection equipment — X-ray inspection, metal detection,')
  lines.push('> checkweighing and combination systems — with application clarification, product selection and')
  lines.push('> configuration support. Final model selection is confirmed with the technical team for each')
  lines.push('> application; this site does not publish prices, lead times or certification claims.')
  lines.push('')

  lines.push('## Product families')
  lines.push('')
  for (const c of categories) {
    const intro = oneLine(c.intro_en)
    lines.push(`- [${c.name_en ?? c.slug}](${SITE}/products/${c.slug})${intro ? `: ${intro}` : ''}`)
  }
  lines.push('')

  lines.push('## Products')
  lines.push('')
  for (const p of products) {
    const model = p.model_or_series ? ` (${p.model_or_series})` : ''
    const summary = oneLine(p.summary_en)
    const cat = p.category_id != null ? catById.get(p.category_id) : undefined
    const url = cat ? `${SITE}/products/${cat.slug}/${p.slug}` : `${SITE}/products`
    lines.push(`- [${p.name_en ?? p.slug}${model}](${url})${summary ? `: ${summary}` : ''}`)
  }
  lines.push('')

  lines.push('## Applications')
  lines.push('')
  for (const a of APPLICATION_PAGES) {
    lines.push(`- [${a.name}](${SITE}/applications/${a.slug}): ${a.intro}`)
  }
  lines.push('')

  if (posts.length) {
    lines.push('## Articles')
    lines.push('')
    for (const post of posts) {
      const path = post.content_type === 'technical_guide' ? 'technical-guides' : 'insights'
      const excerpt = oneLine(post.excerpt_en)
      lines.push(`- [${post.title_en ?? post.slug}](${SITE}/resources/${path}/${post.slug})${excerpt ? `: ${excerpt}` : ''}`)
    }
    lines.push('')
  }

  lines.push('## Other pages')
  lines.push('')
  lines.push(`- [Products](${SITE}/products)`)
  lines.push(`- [Applications](${SITE}/applications)`)
  lines.push(`- [Resources](${SITE}/resources)`)
  lines.push(`- [Frequently asked questions](${SITE}/support/faq)`)
  lines.push(`- [Support](${SITE}/support)`)
  lines.push(`- [About LITUBO](${SITE}/company/about)`)
  lines.push(`- [Contact](${SITE}/contact)`)
  lines.push(`- [Technical matching](${SITE}/technical-matching)`)
  lines.push('')

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return `${lines.join('\n')}\n`
})
