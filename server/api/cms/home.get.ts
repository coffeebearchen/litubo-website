import { defineEventHandler } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { publicFileId, resolvePublicFiles, type PublicFile } from '~/server/utils/contentPublic'
import type { HomeBlock, HomeContent } from '~/types/content'

interface DirectusSiteContent {
  id: number
  content_key: string
  status: string
  hero_image: string | null
  eyebrow_en: string | null
  eyebrow_es: string | null
  eyebrow_pt: string | null
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  cta_primary_label_en: string | null
  cta_primary_label_es: string | null
  cta_primary_label_pt: string | null
  cta_primary_path: string | null
  cta_secondary_label_en: string | null
  cta_secondary_label_es: string | null
  cta_secondary_label_pt: string | null
  cta_secondary_path: string | null
}

export default defineEventHandler(async (): Promise<HomeContent> => {
  // fixtures 模式（仅限非生产）：返回 null，前台使用 i18n 回退；生产环境未配置 Directus 时返回 503
  if (requireCmsSource('cmsMode') === 'fixtures') {
    return { hero: null, blocks: {} }
  }

  let rows: DirectusSiteContent[] = []
  try {
    // All published site_content rows, filtered to the `home.` namespace below. The read-only
    // service policy exposes `content_key`/`status` but not `page_key`, so the namespace check runs
    // in code rather than as a Directus filter.
    const res = await directusFetch<{ data: DirectusSiteContent[] }>(
      '/items/site_content?filter[status][_eq]=published&limit=100'
    )
    rows = (res.data ?? []).filter(r => r.content_key.startsWith('home.'))
  }
  catch {
    // Directus 不可达时静默回退，不使整页崩溃
    return { hero: null, blocks: {} }
  }

  const record = rows.find(r => r.content_key === 'home.hero') ?? null
  const blockRows = rows.filter(r => r.content_key !== 'home.hero')

  const ls = (en: string | null, es: string | null, pt: string | null) => ({
    en: en ?? '',
    es: es ?? '',
    pt: pt ?? '',
  })

  // RSG-06: every output image must be is_public and not archived; resolve once for all records.
  let imageMap: ReadonlyMap<string, PublicFile> = new Map()
  const imageIds = [...(record?.hero_image ? [record.hero_image] : []), ...blockRows.flatMap(r => (r.hero_image ? [r.hero_image] : []))]
  if (imageIds.length) {
    try {
      imageMap = await resolvePublicFiles(directusFetch, imageIds)
    }
    catch {
      imageMap = new Map()
    }
  }
  const mediaUrl = (fileId: string | null): string => {
    const id = fileId ? publicFileId(imageMap, fileId) : null
    return id ? `/api/cms/media/${id}` : ''
  }

  const blocks: Record<string, HomeBlock> = {}
  for (const row of blockRows) {
    blocks[row.content_key] = {
      eyebrow: ls(row.eyebrow_en, row.eyebrow_es, row.eyebrow_pt),
      title: ls(row.title_en, row.title_es, row.title_pt),
      body: ls(row.body_en, row.body_es, row.body_pt),
      imageUrl: mediaUrl(row.hero_image),
    }
  }

  if (!record) {
    return { hero: null, blocks }
  }

  return {
    hero: {
      imageUrl: mediaUrl(record.hero_image),
      eyebrow: ls(record.eyebrow_en, record.eyebrow_es, record.eyebrow_pt),
      title: ls(record.title_en, record.title_es, record.title_pt),
      body: ls(record.body_en, record.body_es, record.body_pt),
      ctaPrimary: {
        label: ls(record.cta_primary_label_en, record.cta_primary_label_es, record.cta_primary_label_pt),
        path: record.cta_primary_path ?? '/products',
      },
      ctaSecondary: {
        label: ls(record.cta_secondary_label_en, record.cta_secondary_label_es, record.cta_secondary_label_pt),
        path: record.cta_secondary_path ?? '/contact',
      },
    },
    blocks,
  }
})
