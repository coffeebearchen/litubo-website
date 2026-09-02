import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import sanitizeHtml from 'sanitize-html'
import { directusFetch } from '~/server/utils/directus'
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

function toPost(r: DirectusPostDetail, slug: string): Post {
  return {
    id: String(r.id),
    contentType: r.content_type as Post['contentType'],
    slug: r.slug ?? slug,
    publishDate: r.publish_date ?? null,
    author: r.author ?? null,
    topics: (r.topics ?? []) as Post['topics'],
    faqGroup: (r.faq_group ?? null) as Post['faqGroup'],
    relatedProductSlugs: r.related_product_slugs ?? [],
    relatedApplicationSlugs: r.related_application_slugs ?? [],
    coverImageUrl: r.cover_image ? `/api/cms/media/${r.cover_image}` : '',
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
      canonicalPath: '',
      ogImage: r.seo_og_image ? `/api/cms/media/${r.seo_og_image}` : undefined,
    },
  }
}

export default defineEventHandler(async (event): Promise<Post> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!slug) throw createError({ statusCode: 404, message: 'Not found' })

  const config = useRuntimeConfig()

  if (config.cmsMode !== 'directus') {
    const post = DEMO_POSTS.find(p => p.slug === slug)
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
      `/items/posts?filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_eq]=published&fields=${fields}&limit=1`,
    )
    record = res.data[0] ?? null
  }
  catch (err) {
    console.error(`[cms/posts/${slug}] Directus fetch failed:`, err instanceof Error ? err.message : err)
    throw createError({ statusCode: 503, message: 'Content unavailable' })
  }

  if (!record) throw createError({ statusCode: 404, message: 'Not found' })

  return toPost(record, slug)
})
