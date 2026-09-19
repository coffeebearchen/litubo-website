import { defineEventHandler, createError } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { publicFileId, resolvePublicFiles } from '~/server/utils/contentPublic'
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

/** `heroFileId` is the category's own image, already RSG-06 checked (LITUBO-PUBLIC-MEDIA-CLOSEOUT-01). */
function toProductCategory(c: DirectusCategory, heroFileId: string | null): ProductCategory {
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

export default defineEventHandler(async () => {
  // DEMO fixtures outside production only; a production server not configured for Directus answers 503.
  if (requireCmsSource('productsCmsMode') === 'fixtures') {
    return DEMO_PRODUCT_CATEGORIES
  }

  try {
    const data = await directusFetch<{ data: DirectusCategory[] }>(
      '/items/product_categories?filter[status][_eq]=published&sort=sort,name_en&limit=100'
    )
    // RSG-06 (LITUBO-PUBLIC-MEDIA-CLOSEOUT-01): a category image is linked only while its file is
    // is_public and not archived in the Media Library; a failed check is a 503 like the read above.
    const files = await resolvePublicFiles(directusFetch, data.data.flatMap(c => (c.hero_image ? [c.hero_image] : [])))
    return data.data.map(c => toProductCategory(c, publicFileId(files, c.hero_image))) as ProductCategory[]
  }
  catch (err) {
    console.error('[cms/products/categories] Directus fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product catalogue temporarily unavailable' })
  }
})
