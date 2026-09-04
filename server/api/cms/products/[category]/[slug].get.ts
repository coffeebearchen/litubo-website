import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { DEMO_PRODUCT_CATEGORIES, DEMO_PRODUCTS } from '~/content/fixtures/products'
import type {
  Product,
  MediaAsset,
  PublicSpecGroup,
  PublicFaq,
  PublicSection,
  PublicSectionItem,
  PublicDownload,
} from '~/types/content'

// ─── Directus raw types ────────────────────────────────────────────────────

interface DirectusProduct {
  id: number
  slug: string
  category_id: number
  name_en: string
  name_es: string | null
  name_pt: string | null
  model_or_series: string | null
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
  seo_image: string | null
  seo_noindex: boolean | null
  status: string
}

interface DirectusSpecGroup {
  id: number
  product_id: number
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  description_en: string | null
  description_es: string | null
  description_pt: string | null
  enabled: boolean
  sort: number | null
}

interface DirectusSpecItem {
  id: number
  spec_group_id: number
  label_en: string | null
  label_es: string | null
  label_pt: string | null
  value_en: string | null
  value_es: string | null
  value_pt: string | null
  note_en: string | null
  sort: number | null
  enabled: boolean
}

interface DirectusFaq {
  id: number
  product_id: number
  question_en: string | null
  question_es: string | null
  question_pt: string | null
  answer_en: string | null
  answer_es: string | null
  answer_pt: string | null
  enabled: boolean
  sort: number | null
}

interface DirectusMedia {
  id: number
  products_id: number
  directus_files_id: string | null
  file_role: string | null
  sort: number | null
  alt_en: string | null
  alt_es: string | null
  alt_pt: string | null
  caption_en: string | null
  enabled: boolean
  version_label: string | null
  file_date: string | null
}

interface DirectusSection {
  id: number
  product_id: number
  type: string
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  eyebrow_en: string | null
  eyebrow_es: string | null
  eyebrow_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  layout_variant: string | null
  media_id: number | null
  external_url: string | null
  enabled: boolean
  sort: number | null
}

interface DirectusSectionItem {
  id: number
  section_id: number
  label_en: string | null
  label_es: string | null
  label_pt: string | null
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  icon_key: string | null
  sort: number | null
  enabled: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const ls = (en: string | null, es: string | null, pt: string | null) => ({
  en: en ?? '',
  es: es ?? '',
  pt: pt ?? '',
})

const mediaUrl = (uuid: string | null): string =>
  uuid ? `/api/cms/media/${uuid}` : ''

const DOWNLOAD_ROLES = new Set(['brochure', 'datasheet', 'drawing', 'manual', 'certificate'])

// ─── Event handler ─────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  const productSlug = getRouterParam(event, 'slug')
  if (!categorySlug || !productSlug) throw createError({ statusCode: 400 })

  const config = useRuntimeConfig()

  // ── Fixtures mode ──────────────────────────────────────────────────────
  if (config.productsCmsMode !== 'directus') {
    const category = DEMO_PRODUCT_CATEGORIES.find(c => c.slug === categorySlug)
    if (!category) throw createError({ statusCode: 404 })
    const product = DEMO_PRODUCTS.find(
      p => p.slug === productSlug && p.categoryId === category.id && p.status === 'published'
    )
    if (!product) throw createError({ statusCode: 404 })
    return product
  }

  // ── Directus mode ──────────────────────────────────────────────────────

  // 1. Resolve category id
  let categoryId: number
  try {
    const catRes = await directusFetch<{ data: Array<{ id: number }> }>(
      `/items/product_categories?filter[slug][_eq]=${encodeURIComponent(categorySlug)}&filter[status][_eq]=published&fields=id&limit=1`
    )
    if (!catRes.data.length) throw createError({ statusCode: 404 })
    categoryId = catRes.data[0].id
  }
  catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) throw err
    console.error('[cms/products/slug] category fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product information temporarily unavailable' })
  }

  // 2. Fetch product main record
  const prodFields = [
    'id', 'slug', 'category_id', 'status', 'model_or_series',
    'name_en', 'name_es', 'name_pt',
    'summary_en', 'summary_es', 'summary_pt',
    'hero_image', 'highlights', 'specifications',
    'related_product_slugs', 'application_slugs',
    'seo_title_en', 'seo_title_es', 'seo_title_pt',
    'seo_description_en', 'seo_description_es', 'seo_description_pt',
    'seo_image', 'seo_noindex',
  ].join(',')

  let p: DirectusProduct
  try {
    const prodRes = await directusFetch<{ data: DirectusProduct[] }>(
      `/items/products?filter[slug][_eq]=${encodeURIComponent(productSlug)}&filter[category_id][_eq]=${categoryId}&filter[status][_eq]=published&fields=${prodFields}&limit=1`
    )
    if (!prodRes.data.length) throw createError({ statusCode: 404 })
    p = prodRes.data[0]
  }
  catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) throw err
    console.error('[cms/products/slug] product fetch failed:', err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Product information temporarily unavailable' })
  }

  const productId = p.id

  // 3. Fetch all related data — failures here are non-fatal; log and use empty arrays.

  // 3a. Media (gallery, hero override, downloads)
  let rawMedia: DirectusMedia[] = []
  try {
    const mediaRes = await directusFetch<{ data: DirectusMedia[] }>(
      `/items/products_files?filter[products_id][_eq]=${productId}&filter[enabled][_eq]=true` +
      `&fields=id,products_id,directus_files_id,file_role,sort,alt_en,alt_es,alt_pt,caption_en,enabled,version_label,file_date` +
      `&sort=sort&limit=100`
    )
    rawMedia = mediaRes.data
  }
  catch (err) {
    console.error('[cms/products/slug] media fetch failed:', err instanceof Error ? err.message : err)
  }

  // 3b. Spec groups
  let specGroups: PublicSpecGroup[] = []
  try {
    const groupRes = await directusFetch<{ data: DirectusSpecGroup[] }>(
      `/items/product_spec_groups?filter[product_id][_eq]=${productId}&filter[enabled][_eq]=true` +
      `&fields=id,title_en,title_es,title_pt,description_en,description_es,description_pt,sort` +
      `&sort=sort&limit=50`
    )
    const groups = groupRes.data
    if (groups.length) {
      const groupIds = groups.map(g => g.id).join(',')
      const itemRes = await directusFetch<{ data: DirectusSpecItem[] }>(
        `/items/product_spec_items?filter[spec_group_id][_in]=${groupIds}&filter[enabled][_eq]=true` +
        `&fields=id,spec_group_id,label_en,label_es,label_pt,value_en,value_es,value_pt,note_en,sort` +
        `&sort=sort&limit=500`
      )
      const itemsByGroup = new Map<number, DirectusSpecItem[]>()
      for (const item of itemRes.data) {
        const arr = itemsByGroup.get(item.spec_group_id) ?? []
        arr.push(item)
        itemsByGroup.set(item.spec_group_id, arr)
      }
      specGroups = groups.map(g => ({
        title: ls(g.title_en, g.title_es, g.title_pt),
        description: ls(g.description_en, g.description_es, g.description_pt),
        items: (itemsByGroup.get(g.id) ?? []).map(i => ({
          label: ls(i.label_en, i.label_es, i.label_pt),
          value: ls(i.value_en, i.value_es, i.value_pt),
          ...(i.note_en ? { unit: i.note_en } : {}),
        })),
      }))
    }
  }
  catch (err) {
    console.error('[cms/products/slug] spec groups fetch failed:', err instanceof Error ? err.message : err)
  }

  // 3c. FAQs (all text fields are plain-text input-multiline, not HTML)
  let faqs: PublicFaq[] = []
  try {
    const faqRes = await directusFetch<{ data: DirectusFaq[] }>(
      `/items/product_faqs?filter[product_id][_eq]=${productId}&filter[enabled][_eq]=true` +
      `&fields=id,question_en,question_es,question_pt,answer_en,answer_es,answer_pt,sort` +
      `&sort=sort&limit=50`
    )
    faqs = faqRes.data.map(f => ({
      question: ls(f.question_en, f.question_es, f.question_pt),
      answer: ls(f.answer_en, f.answer_es, f.answer_pt),
    }))
  }
  catch (err) {
    console.error('[cms/products/slug] faq fetch failed:', err instanceof Error ? err.message : err)
  }

  // 3d. Content sections + their items
  let sections: PublicSection[] = []
  try {
    const secRes = await directusFetch<{ data: DirectusSection[] }>(
      `/items/product_sections?filter[product_id][_eq]=${productId}&filter[enabled][_eq]=true` +
      `&fields=id,type,title_en,title_es,title_pt,eyebrow_en,eyebrow_es,eyebrow_pt,body_en,body_es,body_pt,layout_variant,media_id,sort` +
      `&sort=sort&limit=30`
    )
    const rawSections = secRes.data
    if (rawSections.length) {
      const sectionIds = rawSections.map(s => s.id).join(',')
      const siRes = await directusFetch<{ data: DirectusSectionItem[] }>(
        `/items/product_section_items?filter[section_id][_in]=${sectionIds}&filter[enabled][_eq]=true` +
        `&fields=id,section_id,label_en,label_es,label_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,icon_key,sort` +
        `&sort=sort&limit=200`
      )
      const itemsBySection = new Map<number, PublicSectionItem[]>()
      for (const si of siRes.data) {
        const arr = itemsBySection.get(si.section_id) ?? []
        arr.push({
          label: ls(si.label_en, si.label_es, si.label_pt),
          title: ls(si.title_en, si.title_es, si.title_pt),
          body: ls(si.body_en, si.body_es, si.body_pt),
          ...(si.icon_key ? { iconKey: si.icon_key } : {}),
        })
        itemsBySection.set(si.section_id, arr)
      }
      // Build a lookup for media_id → MediaAsset using rawMedia
      const mediaById = new Map<number, DirectusMedia>(rawMedia.map(m => [m.id, m]))
      sections = rawSections.map((s): PublicSection => {
        let media: MediaAsset | undefined
        if (s.media_id !== null) {
          const m = mediaById.get(s.media_id)
          if (m?.directus_files_id) {
            media = {
              id: m.directus_files_id,
              url: mediaUrl(m.directus_files_id),
              alt: ls(m.alt_en, null, null),
            }
          }
        }
        return {
          type: s.type,
          title: ls(s.title_en, s.title_es, s.title_pt),
          eyebrow: ls(s.eyebrow_en, s.eyebrow_es, s.eyebrow_pt),
          body: ls(s.body_en, s.body_es, s.body_pt),
          ...(s.layout_variant ? { layoutVariant: s.layout_variant } : {}),
          ...(media ? { media } : {}),
          items: itemsBySection.get(s.id) ?? [],
        }
      })
    }
  }
  catch (err) {
    console.error('[cms/products/slug] sections fetch failed:', err instanceof Error ? err.message : err)
  }

  // ── Assemble product from raw data ─────────────────────────────────────

  // Hero: prefer hero-role media file; fall back to products.hero_image field
  const heroFile = rawMedia.find(m => m.file_role === 'hero' && m.directus_files_id)
  const heroUuid = heroFile?.directus_files_id ?? p.hero_image
  const heroMedia: MediaAsset = {
    id: heroUuid ?? '',
    url: mediaUrl(heroUuid),
    alt: ls(p.name_en, p.name_es, p.name_pt),
  }

  // Gallery
  const gallery: MediaAsset[] = rawMedia
    .filter(m => m.file_role === 'gallery' && m.directus_files_id)
    .map(m => ({
      id: m.directus_files_id!,
      url: mediaUrl(m.directus_files_id),
      alt: ls(m.alt_en, m.alt_es, m.alt_pt),
    }))

  // Downloads
  const downloads: PublicDownload[] = rawMedia
    .filter(m => m.file_role && DOWNLOAD_ROLES.has(m.file_role) && m.directus_files_id)
    .map(m => ({
      uuid: m.directus_files_id!,
      url: `/api/cms/media/${m.directus_files_id}?download=true`,
      role: m.file_role!,
      ...(m.version_label ? { versionLabel: m.version_label } : {}),
      ...(m.file_date ? { fileDate: m.file_date } : {}),
    }))

  // Inline highlights from JSON (kept for backward compat)
  const highlights = ((p.highlights ?? []) as Array<{
    label_en?: string; label_es?: string; label_pt?: string
    body_en?: string; body_es?: string; body_pt?: string
  }>).map(h => ({
    title: ls(h.label_en ?? '', h.label_es ?? '', h.label_pt ?? ''),
    body: ls(h.body_en ?? '', h.body_es ?? '', h.body_pt ?? ''),
  }))

  // Inline specifications from JSON (kept as fallback when specGroups is empty)
  const specifications = ((p.specifications ?? []) as Array<{
    label_en?: string; label_es?: string; label_pt?: string
    value_en?: string; value_es?: string; value_pt?: string
    unit?: string; visible?: boolean
  }>)
    .filter(s => s.visible !== false)
    .map(s => ({
      label: ls(s.label_en ?? '', s.label_es ?? '', s.label_pt ?? ''),
      value: ls(s.value_en ?? '', s.value_es ?? '', s.value_pt ?? ''),
      ...(s.unit ? { unit: s.unit } : {}),
    }))

  const product: Product = {
    id: String(p.id),
    categoryId: String(p.category_id),
    slug: p.slug,
    name: ls(p.name_en, p.name_es, p.name_pt),
    summary: ls(p.summary_en, p.summary_es, p.summary_pt),
    ...(p.model_or_series ? { modelSeries: p.model_or_series } : {}),
    heroMedia,
    gallery,
    highlights,
    specifications,
    specGroups,
    faqs,
    sections,
    downloads,
    options: [],
    downloadIds: [],
    relatedProductIds: p.related_product_slugs ?? [],
    applicationSlugs: p.application_slugs ?? [],
    seo: {
      title: ls(p.seo_title_en ?? p.name_en, p.seo_title_es, p.seo_title_pt),
      description: ls(p.seo_description_en, p.seo_description_es, p.seo_description_pt),
      canonicalPath: `/products/${categorySlug}/${p.slug}`,
      ...(p.seo_image ? { ogImage: `/api/cms/media/${p.seo_image}` } : {}),
      noIndex: p.seo_noindex ?? false,
    },
    status: p.status as Product['status'],
  }

  return product
})
