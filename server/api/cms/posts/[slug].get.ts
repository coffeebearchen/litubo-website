import { defineEventHandler, getRouterParam, createError } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { publicFileId, resolvePublicFiles, type PublicFile } from '~/server/utils/contentPublic'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { isLegacyPublicPostType, legacyBodyFileIds, legacyPostHtml, LEGACY_PUBLIC_POST_TYPES } from '~/server/utils/legacyPosts'
import { DEMO_POSTS } from '~/content/fixtures/posts'
import type { Post } from '~/types/content'

interface DirectusPostDetail {
  id: string
  content_type: string
  status: string
  slug: string
  publish_date: string | null
  author: string | null
  topics: string[] | null
  faq_group: string | null
  related_product_slugs: string[] | null
  related_application_slugs: string[] | null
  cover_image: string | null
  cover_fit: string | null
  seo_og_image: string | null
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  excerpt_en: string | null
  excerpt_es: string | null
  excerpt_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  seo_title_en: string | null
  seo_title_es: string | null
  seo_title_pt: string | null
  seo_description_en: string | null
  seo_description_es: string | null
  seo_description_pt: string | null
}

// Maps content_type to its public URL path prefix.
// faq is intentionally excluded: FAQ items have no individual detail route.
const CONTENT_TYPE_PATH: Record<string, string> = {
  insight: '/resources/insights',
  case_study: '/resources/case-studies',
  technical_guide: '/resources/technical-guides',
  news: '/resources/news',
}

/** `files` is the RSG-06 result for the cover, the OG image and the body's files (LITUBO-STABLE-BASELINE-CLOSEOUT-01): a file it does not allow is left out. */
function toPost(r: DirectusPostDetail, slug: string, files: ReadonlyMap<string, PublicFile>): Post {
  const postSlug = r.slug ?? slug
  const coverFileId = publicFileId(files, r.cover_image)
  const ogFileId = publicFileId(files, r.seo_og_image)
  const pathPrefix = CONTENT_TYPE_PATH[r.content_type]
  return {
    id: String(r.id),
    contentType: r.content_type as Post['contentType'],
    slug: postSlug,
    publishDate: r.publish_date ?? null,
    author: r.author ?? null,
    topics: (r.topics ?? []) as Post['topics'],
    faqGroup: (r.faq_group ?? null) as Post['faqGroup'],
    relatedProductSlugs: r.related_product_slugs ?? [],
    relatedApplicationSlugs: r.related_application_slugs ?? [],
    coverImageUrl: coverFileId ? `/api/cms/media/${coverFileId}?v=2` : '',
    // The cover's own description: the file title an editor wrote in the Media Library, if any.
    coverAlt: coverFileId ? (files.get(coverFileId.toLowerCase())?.title ?? '') : '',
    // V2-05: the fit now comes from the record. Null means "no opinion yet", and the page keeps its
    // previous behaviour for that article rather than being forced to a value.
    coverFit: r.cover_fit === 'contain' || r.cover_fit === 'cover' ? r.cover_fit : null,
    title: { en: r.title_en ?? '', es: r.title_es ?? '', pt: r.title_pt ?? '' },
    excerpt: { en: r.excerpt_en ?? '', es: r.excerpt_es ?? '', pt: r.excerpt_pt ?? '' },
    bodyHtml: {
      en: legacyPostHtml(r.body_en, files),
      es: legacyPostHtml(r.body_es, files),
      pt: legacyPostHtml(r.body_pt, files),
    },
    seo: {
      title: {
        en: r.seo_title_en || r.title_en || '',
        es: r.seo_title_es || r.title_es || '',
        pt: r.seo_title_pt || r.title_pt || '',
      },
      description: {
        en: r.seo_description_en ?? '',
        es: r.seo_description_es ?? '',
        pt: r.seo_description_pt ?? '',
      },
      canonicalPath: pathPrefix ? `${pathPrefix}/${postSlug}` : '',
      // A designated OG image wins; otherwise the cover is the honest fallback, because a share
      // card showing the site default on every article tells the reader nothing about this one.
      ogImage: ogFileId ? `/api/cms/media/${ogFileId}` : coverFileId ? `/api/cms/media/${coverFileId}` : undefined,
    },
  }
}

export default defineEventHandler(async (event): Promise<Post> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!slug) throw createError({ statusCode: 404, message: 'Not found' })

  // CC-IMP-10 (D-035): only Technical Guide and FAQ posts are still public here.
  // DEMO fixtures outside production only; a production server not configured for Directus answers 503.
  if (requireCmsSource('cmsMode') === 'fixtures') {
    const post = DEMO_POSTS.find(p => p.slug === slug && isLegacyPublicPostType(p.contentType))
    if (!post) throw createError({ statusCode: 404, message: 'Not found' })
    return post
  }

  const fields = [
    'id', 'content_type', 'status', 'slug', 'publish_date', 'author',
    'topics', 'faq_group', 'related_product_slugs', 'related_application_slugs',
    'cover_image', 'cover_fit', 'seo_og_image',
    'title_en', 'title_es', 'title_pt',
    'excerpt_en', 'excerpt_es', 'excerpt_pt',
    'body_en', 'body_es', 'body_pt',
    'seo_title_en', 'seo_title_es', 'seo_title_pt',
    'seo_description_en', 'seo_description_es', 'seo_description_pt',
  ].join(',')

  let record: DirectusPostDetail | null = null
  try {
    const res = await directusFetch<{ data: DirectusPostDetail[] }>(
      `/items/posts?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_eq]=published`
      + `&filter[content_type][_in]=${LEGACY_PUBLIC_POST_TYPES.join(',')}&fields=${fields}&limit=1`,
    )
    record = res.data[0] ?? null
  }
  catch (err) {
    console.error(`[cms/posts/${slug}] Directus fetch failed:`, err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content unavailable' })
  }

  if (!record || !isLegacyPublicPostType(record.content_type)) throw createError({ statusCode: 404, message: 'Not found' })

  // RSG-06: the cover, the OG image and every file the body references are linked only while the file is
  // is_public and not archived in the Media Library right now; a failed check is a 503 like the read above,
  // never a page with unchecked files or an unchecked body.
  let files: Map<string, PublicFile>
  try {
    files = await resolvePublicFiles(directusFetch, [
      record.cover_image, record.seo_og_image, ...legacyBodyFileIds(record.body_en, record.body_es, record.body_pt),
    ].filter((id): id is string => Boolean(id)))
  }
  catch (err) {
    console.error(`[cms/posts/${slug}] media eligibility check failed:`, err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content unavailable' })
  }

  return toPost(record, slug, files)
})
