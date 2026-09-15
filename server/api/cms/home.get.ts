import { defineEventHandler } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { requireCmsSource } from '~/server/utils/cmsSource'
import type { HomeContent } from '~/types/content'

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
    return { hero: null }
  }

  let record: DirectusSiteContent | null = null
  try {
    const res = await directusFetch<{ data: DirectusSiteContent[] }>(
      '/items/site_content?filter[content_key][_eq]=home.hero&filter[status][_eq]=published&limit=1'
    )
    record = res.data[0] ?? null
  }
  catch {
    // Directus 不可达时静默回退，不使整页崩溃
    return { hero: null }
  }

  if (!record) {
    return { hero: null }
  }

  const ls = (en: string | null, es: string | null, pt: string | null) => ({
    en: en ?? '',
    es: es ?? '',
    pt: pt ?? '',
  })

  return {
    hero: {
      imageUrl: record.hero_image ? `/api/cms/media/${record.hero_image}` : '',
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
  }
})
