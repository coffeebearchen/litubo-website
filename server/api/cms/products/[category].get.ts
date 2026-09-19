import { defineEventHandler, getRouterParam, createError } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { publicHeroFileIds } from '~/server/utils/productHero'
import { publicFileId, resolvePublicFiles } from '~/server/utils/contentPublic'
import { DEMO_PRODUCT_CATEGORIES, DEMO_PRODUCTS } from '~/content/fixtures/products'
import type { ProductCategory, Product } from '~/types/content'

interface DirectusCategory {
  id: number
  slug: string
  name_en: string
  name_es: string | null
  name_pt: string | null
  intro_en: string | null
  intro_es: string | null
  intro_pt: string | null
  hero_image: string | null
  seo_title_en: string | null
  seo_title_es: string | null
  seo_title_pt: string | null
  seo_description_en: string | null
  seo_description_es: string | null
  seo_description_pt: string | null
  seo_noindex: boolean | null
  sort: number | null
}

interface DirectusProduct {
  id: number
  slug: string
  category_id: number
  name_en: string
  name_es: string | null
  name_pt: string | null
  summary_en: string | null
  summary_es: string | null
  summary_pt: string | null
  hero_image: string | null
  highlights: unknown[] | null
  specifications: unknown[] | null
  related_product_slugs: string[] | null
  application_slugs: string[] | null
  seo_title_en: string | null
  seo_title_es: string | null
  seo_title_pt: string | null
  seo_description_en: string | null
  seo_description_es: string | null
  seo_description_pt: string | null
  seo_noindex: boolean | null
  status: string
}

/** `heroFileId` is the category's own image, already RSG-06 checked (LITUBO-PUBLIC-MEDIA-CLOSEOUT-01). */
function mapCategory(c: DirectusCategory, heroFileId: string | null): ProductCategory {
  return {
    id: String(c.id),
    slug: c.slug,
    title: { en: c.name_en, es: c.name_es ?? '', pt: c.name_pt ?? '' },
    intro: { en: c.intro_en ?? '', es: c.intro_es ?? '', pt: c.intro_pt ?? '' },
    heroMedia: {
      id: heroFileId ?? '',
      url: heroFileId ? `/api/cms/media/${heroFileId}` : '',
      alt: { en: c.name_en, es: c.name_es ?? '', pt: c.name_pt ?? '' },
    },
    order: c.sort ?? 0,
    seo: {
      title: { en: c.seo_title_en ?? c.name_en, es: c.seo_title_es ?? '', pt: c.seo_title_pt ?? '' },
      description: { en: c.seo_description_en ?? '', es: c.seo_description_es ?? '', pt: c.seo_description_pt ?? '' },
      canonicalPath: `/products/${c.slug}`,
      noIndex: c.seo_noindex ?? false,
    },
  }
}

/** `heroFileId` is the product's public hero (LITUBO-HERO-FIX-01): designated through the shared rule and already RSG-06 checked. */
function mapProduct(p: DirectusProduct, catSlug: string, heroFileId: string | null): Product {
  return {
    id: String(p.id),
    categoryId: String(p.category_id),
    slug: p.slug,
    name: { en: p.name_en, es: p.name_es ?? '', pt: p.name_pt ?? '' },
    summary: { en: p.summary_en ?? '', es: p.summary_es ?? '', pt: p.summary_pt ?? '' },
    heroMedia: {
      id: heroFileId ?? '',
      url: heroFileId ? `/api/cms/media/${heroFileId}` : '',
      alt: { en: p.name_en, es: p.name_es ?? '', pt: p.name_pt ?? '' },
    },
    gallery: [],
    highlights: (p.highlights ?? []) as Product['highlights'],
    specifications: (p.specifications ?? []) as Product['specifications'],
    options: [],
    downloadIds: [],
    relatedProductIds: p.related_product_slugs ?? [],
    applicationSlugs: p.application_slugs ?? [],
    seo: {
      title: { en: p.seo_title_en ?? p.name_en, es: p.seo_title_es ?? '', pt: p.seo_title_pt ?? '' },
      description: { en: p.seo_description_en ?? '', es: p.seo_description_es ?? '', pt: p.seo_description_pt ?? '' },
      canonicalPath: `/products/${catSlug}/${p.slug}`,
      noIndex: p.seo_noindex ?? false,
    },
    status: p.status as Product['status'],
  }
}

export default defineEventHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  if (!categorySlug) throw createError({ statusCode: 400 })

  // DEMO fixtures outside production only; a production server not configured for Directus answers 503.
  if (requireCmsSource('productsCmsMode') === 'fixtures') {
    const category = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
    if (!category) throw createError({ statusCode: 404 })
    const products = DEMO_PRODUCTS.filter(p => p.categoryId === category.id && p.status === 'published')
    return { category, products }
  }

  // Resolve category — failure here is a hard 503 (not a 404 that would de-index the page).
  let catRes: { data: DirectusCategory[] }
  try {
    catRes = await directusFetch<{ data: DirectusCategory[] }>(
      `/items/product_categories?filter[slug][_eq]=${encodeURIComponent(categorySlug)}&filter[status][_eq]=published&limit=1`
    )
  }
  catch (err) {
    console.error('[cms/products/category] Directus category fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product catalogue temporarily unavailable' })
  }

  if (!catRes.data.length) throw createError({ statusCode: 404 })
  const cat = catRes.data[0]

  // Product list failure is a 503 too (FINAL-RELEASE-FIX-C): answering the category with an empty
  // product list would hide the outage behind a 200. The same holds for the card heroes
  // (LITUBO-HERO-FIX-01) and the category's own image (LITUBO-PUBLIC-MEDIA-CLOSEOUT-01): an
  // unverified file is never emitted, and a failed check is not a missing image.
  try {
    const prodRes = await directusFetch<{ data: DirectusProduct[] }>(
      `/items/products?filter[category_id][_eq]=${cat.id}&filter[status][_eq]=published&sort=sort,name_en&limit=200`
    )
    const [heroes, categoryFiles] = await Promise.all([
      publicHeroFileIds(directusFetch, prodRes.data),
      resolvePublicFiles(directusFetch, cat.hero_image ? [cat.hero_image] : []),
    ])
    const category = mapCategory(cat, publicFileId(categoryFiles, cat.hero_image))
    const products = prodRes.data.map(p => mapProduct(p, categorySlug, heroes.get(p.id) ?? null))
    return { category, products }
  }
  catch (err) {
    console.error('[cms/products/category] Directus product fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product catalogue temporarily unavailable' })
  }
})
