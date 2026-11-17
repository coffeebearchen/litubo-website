import { getQuery, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { HERO_REGISTRY } from '~/server/utils/heroRegistry'

/**
 * V2-04 — the hero rows the admin may edit.
 *
 * Returns one entry per registry page: the row that exists (or null), the approved default, and a
 * derived state. A page with no row is `Using default`, which is a normal state, not an error.
 *
 * Only `site_content` columns that already exist are read; V2 adds none.
 */
const FIELDS = [
  'id', 'content_key', 'page_key', 'section_key', 'status', 'hero_image',
  'eyebrow_en', 'title_en', 'body_en',
  'cta_primary_label_en', 'cta_primary_path',
  'cta_secondary_label_en', 'cta_secondary_path',
  'updated_at',
].join(',')

interface Row {
  id: number
  content_key: string
  status?: string | null
  hero_image?: string | null
  eyebrow_en?: string | null
  title_en?: string | null
  body_en?: string | null
  cta_primary_label_en?: string | null
  cta_primary_path?: string | null
  cta_secondary_label_en?: string | null
  cta_secondary_path?: string | null
  updated_at?: string | null
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const keys = HERO_REGISTRY.map(e => e.contentKey)
  const params = new URLSearchParams({
    fields: FIELDS,
    limit: '200',
    'filter[content_key][_in]': keys.join(','),
  })

  const res = await adminFetch<{ data?: Row[] }>(event, `/items/site_content?${params.toString()}`)
  const rows = Array.isArray(res?.data) ? res.data : []
  const byKey = new Map(rows.map(r => [r.content_key, r]))

  const wanted = typeof getQuery(event).page === 'string' ? String(getQuery(event).page) : ''
  const entries = HERO_REGISTRY
    .filter(e => !wanted || e.pageKey === wanted)
    .map((e) => {
      const row = byKey.get(e.contentKey) ?? null
      // State is derived, not stored: there is no draft record, so "Draft" can only mean the row
      // exists but is not published.
      const state = !row
        ? 'Using default'
        : row.status === 'published' ? 'Published override' : 'Draft'
      return {
        pageKey: e.pageKey,
        contentKey: e.contentKey,
        label: e.label,
        path: e.path,
        zone: e.zone,
        scope: e.scope,
        state,
        defaults: e.defaults,
        row: row
          ? {
              id: row.id,
              status: row.status ?? 'draft',
              heroImage: row.hero_image ?? null,
              eyebrow: row.eyebrow_en ?? '',
              title: row.title_en ?? '',
              body: row.body_en ?? '',
              ctaPrimaryLabel: row.cta_primary_label_en ?? '',
              ctaPrimaryPath: row.cta_primary_path ?? '',
              ctaSecondaryLabel: row.cta_secondary_label_en ?? '',
              ctaSecondaryPath: row.cta_secondary_path ?? '',
              updatedAt: row.updated_at ?? null,
            }
          : null,
      }
    })

  return { pages: entries }
})
