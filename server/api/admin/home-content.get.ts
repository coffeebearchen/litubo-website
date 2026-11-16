import type { H3Event } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * Admin: the fixed home blocks stored in `site_content` (the `home.` namespace).
 *
 * The admin client uses the administrator identity, so it can read `page_key`, `status` and every
 * locale column that the public service token is not allowed to see.
 */

export interface AdminHomeBlock {
  id: number
  content_key: string
  section_key: string | null
  status: string
  eyebrow_en: string
  title_en: string
  body_en: string
  updated_at: string | null
}

interface RawRow {
  id: number
  content_key: string
  section_key: string | null
  status: string
  eyebrow_en: string | null
  title_en: string | null
  body_en: string | null
  updated_at: string | null
}

export default defineEventHandler(async (event: H3Event) => {
  const res = await adminFetch<{ data: RawRow[] }>(
    event,
    '/items/site_content?fields=id,content_key,section_key,status,eyebrow_en,title_en,body_en,updated_at&sort=content_key&limit=100',
  )
  const blocks: AdminHomeBlock[] = (res.data ?? [])
    .filter(r => r.content_key.startsWith('home.'))
    .map(r => ({
      id: r.id,
      content_key: r.content_key,
      section_key: r.section_key ?? null,
      status: r.status,
      eyebrow_en: r.eyebrow_en ?? '',
      title_en: r.title_en ?? '',
      body_en: r.body_en ?? '',
      updated_at: r.updated_at ?? null,
    }))
  return { blocks }
})
