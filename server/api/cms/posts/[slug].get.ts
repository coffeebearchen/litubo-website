import { defineEventHandler, getRouterParam, createError } from 'h3'
import sanitizeHtml from 'sanitize-html'
import { directusFetch } from '~/server/utils/directus'
import { publicFileId, resolvePublicFiles, type PublicFile } from '~/server/utils/contentPublic'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { isLegacyPublicPostType, LEGACY_PUBLIC_POST_TYPES } from '~/server/utils/legacyPosts'
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

// UUID pattern used to identify Directus /assets/{uuid} paths
const UUID_IN_ASSETS = /\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i', 's',
    'a', 'blockquote', 'code', 'pre', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        href: attribs.href ?? '',
        rel: 'noopener noreferrer',
        target: (attribs.href ?? '').startsWith('/') ? '_self' : '_blank',
      },
    }),
    img: (_tagName, attribs) => {
      const src = attribs.src ?? ''
      const match = src.match(UUID_IN_ASSETS)
      // Only allow images whose src contains a Directus /assets/{uuid} path
      if (!match) return { tagName: '', attribs: {} }
      const uuid = match[1]
      return {
        tagName: 'img',
        attribs: {
          src: `/api/cms/media/${uuid}`,
          alt: attribs.alt ?? '',
          ...(attribs.width && { width: attribs.width }),
          ...(attribs.height && { height: attribs.height }),
        },
      }
    },
  },
}

function safeHtml(raw: string | null): string {
  if (!raw) return ''
  return sanitizeHtml(raw, SANITIZE_CONFIG)
}

// Maps content_type to its public URL path prefix.
// faq is intentionally excluded: FAQ items have no individual detail route.
const CONTENT_TYPE_PATH: Record<string, string> = {
  insight: '/resources/insights',
  case_study: '/resources/case-studies',
  technical_guide: '/resources/technical-guides',
  news: '/resources/news',
}

/** `files` is the RSG-06 result for the cover and OG image (LITUBO-STABLE-BASELINE-CLOSEOUT-01): a file it does not allow is left out. */
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
    coverImageUrl: coverFileId ? `/api/cms/media/${coverFileId}` : '',
    title: { en: r.title_en ?? '', es: r.title_es ?? '', pt: r.title_pt ?? '' },
    excerpt: { en: r.excerpt_en ?? '', es: r.excerpt_es ?? '', pt: r.excerpt_pt ?? '' },
    bodyHtml: {
      en: safeHtml(r.body_en),
      es: safeHtml(r.body_es),
      pt: safeHtml(r.body_pt),
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
      ogImage: ogFileId ? `/api/cms/media/${ogFileId}` : undefined,
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
    'cover_image', 'seo_og_image',
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

  // RSG-06: the cover and OG image are linked only while the file is is_public and not archived in the
  // Media Library right now; a failed check is a 503 like the read above, never a page with unchecked files.
  let files: Map<string, PublicFile>
  try {
    files = await resolvePublicFiles(directusFetch, [record.cover_image, record.seo_og_image].filter((id): id is string => Boolean(id)))
  }
  catch (err) {
    console.error(`[cms/posts/${slug}] media eligibility check failed:`, err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content unavailable' })
  }

  return toPost(record, slug, files)
})
