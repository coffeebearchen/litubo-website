import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
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

function mapCategory(c: DirectusCategory): ProductCategory {
  return {
    id: String(c.id),
    slug: c.slug,
    title: { en: c.name_en, es: c.name_es ?? '', pt: c.name_pt ?? '' },
    intro: { en: c.intro_en ?? '', es: c.intro_es ?? '', pt: c.intro_pt ?? '' },
    heroMedia: {
      id: c.hero_image ?? '',
      url: c.hero_image ? `/api/cms/media/${c.hero_image}` : '',
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

function mapProduct(p: DirectusProduct, catSlug: string): Product {
  return {
    id: String(p.id),
    categoryId: String(p.category_id),
    slug: p.slug,
    name: { en: p.name_en, es: p.name_es ?? '', pt: p.name_pt ?? '' },
    summary: { en: p.summary_en ?? '', es: p.summary_es ?? '', pt: p.summary_pt ?? '' },
    heroMedia: {
      id: p.hero_image ?? '',
      url: p.hero_image ? `/api/cms/media/${p.hero_image}` : '',
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

  const config = useRuntimeConfig()

  if (config.cmsMode !== 'directus') {
    const category = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
    if (!category) throw createError({ statusCode: 404 })
    const products = DEMO_PRODUCTS.filter(p => p.categoryId === category.id && p.status === 'published')
    return { category, products }
  }

  const catRes = await directusFetch<{ data: DirectusCategory[] }>(
    `/items/product_categories?filter[slug][_eq]=${encodeURIComponent(categorySlug)}&filter[status][_eq]=published&limit=1`
  )
  if (!catRes.data.length) throw createError({ statusCode: 404 })
  const category = mapCategory(catRes.data[0])

  const prodRes = await directusFetch<{ data: DirectusProduct[] }>(
    `/items/products?filter[category_id][_eq]=${catRes.data[0].id}&filter[status][_eq]=published&sort=sort,name_en&limit=-1`
  )
  const products = prodRes.data.map(p => mapProduct(p, categorySlug))

  return { category, products }
})
