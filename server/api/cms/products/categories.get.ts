import { defineEventHandler, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { DEMO_PRODUCT_CATEGORIES } from '~/content/fixtures/products'
import type { ProductCategory } from '~/types/content'

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

function toProductCategory(c: DirectusCategory): ProductCategory {
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

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  if (config.productsCmsMode !== 'directus') {
    return DEMO_PRODUCT_CATEGORIES
  }

  try {
    const data = await directusFetch<{ data: DirectusCategory[] }>(
      '/items/product_categories?filter[status][_eq]=published&sort=sort,name_en&limit=-1'
    )
    return data.data.map(toProductCategory) as ProductCategory[]
  }
  catch (err) {
    console.error('[cms/products/categories] Directus fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product catalogue temporarily unavailable' })
  }
})
