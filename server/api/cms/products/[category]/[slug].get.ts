import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { DEMO_PRODUCT_CATEGORIES, DEMO_PRODUCTS } from '~/content/fixtures/products'
import type { Product } from '~/types/content'

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

export default defineEventHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  const productSlug = getRouterParam(event, 'slug')
  if (!categorySlug || !productSlug) throw createError({ statusCode: 400 })

  const config = useRuntimeConfig()

  if (config.cmsMode !== 'directus') {
    const category = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
    if (!category) throw createError({ statusCode: 404 })
    const product = DEMO_PRODUCTS.find(
      p => p.slug === productSlug && p.categoryId === category.id && p.status === 'published'
    )
    if (!product) throw createError({ statusCode: 404 })
    return product
  }

  // Resolve category to get its id
  const catRes = await directusFetch<{ data: Array<{ id: number }> }>(
    `/items/product_categories?filter[slug][_eq]=${encodeURIComponent(categorySlug)}&filter[status][_eq]=published&fields=id&limit=1`
  )
  if (!catRes.data.length) throw createError({ statusCode: 404 })
  const categoryId = catRes.data[0].id

  const prodRes = await directusFetch<{ data: DirectusProduct[] }>(
    `/items/products?filter[slug][_eq]=${encodeURIComponent(productSlug)}&filter[category_id][_eq]=${categoryId}&filter[status][_eq]=published&limit=1`
  )
  if (!prodRes.data.length) throw createError({ statusCode: 404 })

  const p = prodRes.data[0]
  const product: Product = {
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
    highlights: ((p.highlights ?? []) as Array<{ label_en: string; label_es?: string; label_pt?: string; body_en?: string; body_es?: string; body_pt?: string }>).map(h => ({
      title: { en: h.label_en ?? '', es: h.label_es ?? '', pt: h.label_pt ?? '' },
      body: { en: h.body_en ?? '', es: h.body_es ?? '', pt: h.body_pt ?? '' },
    })),
    specifications: ((p.specifications ?? []) as Array<{ label_en: string; label_es?: string; label_pt?: string; value_en?: string; value_es?: string; value_pt?: string; unit?: string; visible?: boolean }>)
      .filter(s => s.visible !== false)
      .map(s => ({
        label: { en: s.label_en ?? '', es: s.label_es ?? '', pt: s.label_pt ?? '' },
        value: { en: s.value_en ?? '', es: s.value_es ?? '', pt: s.value_pt ?? '' },
        unit: s.unit,
      })),
    options: [],
    downloadIds: [],
    relatedProductIds: p.related_product_slugs ?? [],
    applicationSlugs: p.application_slugs ?? [],
    seo: {
      title: { en: p.seo_title_en ?? p.name_en, es: p.seo_title_es ?? '', pt: p.seo_title_pt ?? '' },
      description: { en: p.seo_description_en ?? '', es: p.seo_description_es ?? '', pt: p.seo_description_pt ?? '' },
      canonicalPath: `/products/${categorySlug}/${p.slug}`,
      noIndex: p.seo_noindex ?? false,
    },
    status: p.status as Product['status'],
  }
  return product
})
