import { defineEventHandler, getQuery } from 'h3'
import { useRuntimeConfig } from '#imports'
import { directusFetch } from '~/server/utils/directus'
import { isLegacyPublicPostType, LEGACY_PUBLIC_POST_TYPES } from '~/server/utils/legacyPosts'
import { DEMO_POSTS_LIST } from '~/content/fixtures/posts'
import type { PostListItem, PostsResult } from '~/types/content'

interface DirectusPost {
  id: string
  content_type: string
  status: string
  slug: string
  publish_date: string | null
  author: string | null
  topics: string[] | null
  faq_group: string | null
  cover_image: string | null
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  excerpt_en: string | null
  excerpt_es: string | null
  excerpt_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
}

function toListItem(r: DirectusPost, isFaq: boolean): PostListItem {
  const item: PostListItem = {
    id: String(r.id),
    contentType: r.content_type as PostListItem['contentType'],
    slug: r.slug,
    publishDate: r.publish_date ?? null,
    author: r.author ?? null,
    topics: (r.topics ?? []) as PostListItem['topics'],
    coverImageUrl: r.cover_image ? `/api/cms/media/${r.cover_image}` : '',
    title: { en: r.title_en ?? '', es: r.title_es ?? '', pt: r.title_pt ?? '' },
    excerpt: { en: r.excerpt_en ?? '', es: r.excerpt_es ?? '', pt: r.excerpt_pt ?? '' },
  }
  if (isFaq) {
    item.faqGroup = (r.faq_group ?? null) as PostListItem['faqGroup']
    item.bodyHtml = { en: r.body_en ?? '', es: r.body_es ?? '', pt: r.body_pt ?? '' }
  }
  return item
}

export default defineEventHandler(async (event): Promise<PostsResult> => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const type = query.content_type as string | undefined
  const excludeType = query.exclude_type as string | undefined

  // CC-IMP-10 (D-035): legacy posts serve only Technical Guides and FAQ. Insights and
  // Case Studies are Content Center only; News is not public in Phase 1.
  if (type && !isLegacyPublicPostType(type)) return { posts: [] }

  if (config.cmsMode !== 'directus') {
    // For fixtures mode: include full Post data (which has faqGroup + bodyHtml) when FAQ type
    const { DEMO_POSTS } = await import('~/content/fixtures/posts')
    let list: PostListItem[] = type === 'faq'
      ? DEMO_POSTS.filter(p => p.contentType === 'faq').map(p => ({
          id: p.id, contentType: p.contentType, slug: p.slug, publishDate: p.publishDate,
          author: p.author, topics: p.topics, coverImageUrl: p.coverImageUrl,
          title: p.title, excerpt: p.excerpt, faqGroup: p.faqGroup, bodyHtml: p.bodyHtml,
        }))
      : DEMO_POSTS_LIST.filter(p => p.contentType !== 'faq')
    list = list.filter(p => isLegacyPublicPostType(p.contentType))
    if (type && type !== 'faq') list = list.filter(p => p.contentType === type)
    if (excludeType) list = list.filter(p => p.contentType !== excludeType)
    return { posts: list }
  }

  const topics = query['topics[]']
    ? (Array.isArray(query['topics[]']) ? query['topics[]'] : [query['topics[]']]) as string[]
    : undefined
  const limit = Number(query.limit ?? 20)
  const page = Number(query.page ?? 1)
  const offset = (page - 1) * limit

  const filters: string[] = [
    'filter[status][_eq]=published',
    `filter[content_type][_in]=${LEGACY_PUBLIC_POST_TYPES.join(',')}`,
  ]
  if (type) filters.push(`filter[content_type][_eq]=${encodeURIComponent(type)}`)
  if (excludeType) filters.push(`filter[content_type][_neq]=${encodeURIComponent(excludeType)}`)
  // Note: Directus 11 json field type does not support array subset operators.
  // Topics filtering is applied server-side after fetching.

  const isFaqQuery = type === 'faq'
  const fields = [
    'id', 'content_type', 'status', 'slug', 'publish_date', 'author', 'topics',
    'faq_group', 'cover_image', 'title_en', 'title_es', 'title_pt',
    'excerpt_en', 'excerpt_es', 'excerpt_pt',
    ...(isFaqQuery ? ['body_en', 'body_es', 'body_pt'] : []),
  ].join(',')

  // When topics filter is active, fetch all (up to 500) then filter server-side
  const effectiveLimit = (topics && topics.length > 0) ? 500 : limit
  const effectiveOffset = (topics && topics.length > 0) ? 0 : offset

  const qs = [
    ...filters,
    `fields=${fields}`,
    `limit=${effectiveLimit}`,
    `offset=${effectiveOffset}`,
    'sort=-publish_date',
  ].join('&')

  try {
    const res = await directusFetch<{ data: DirectusPost[] }>(`/items/posts?${qs}`)
    let items = res.data.filter(r => isLegacyPublicPostType(r.content_type)).map(r => toListItem(r, isFaqQuery))
    if (topics && topics.length > 0) {
      items = items.filter(p => topics.some(t => p.topics.includes(t as PostListItem['topics'][number])))
      items = items.slice(offset, offset + limit)
    }
    return { posts: items }
  }
  catch (err) {
    console.error('[cms/posts] Directus fetch failed:', err instanceof Error ? err.message : err)
    return { posts: [], cmsError: true }
  }
})
