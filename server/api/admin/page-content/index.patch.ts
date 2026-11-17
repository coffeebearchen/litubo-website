import { readBody, createError, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { findHeroPage } from '~/server/utils/heroRegistry'

/**
 * V2-04 — publish one hero row.
 *
 * There is no draft record and no second row: the admin keeps unpublished edits in the browser and
 * sends them here only when a person presses Publish. That keeps one row per page, which is what
 * the public reader already expects.
 *
 * `action`:
 *   publish   — write the supplied fields to the single existing row (creating it if absent)
 *   withdraw  — return the page to its approved default by unpublishing the row
 */
interface Body {
  pageKey?: unknown
  action?: unknown
  eyebrow?: unknown
  title?: unknown
  body?: unknown
  heroImage?: unknown
  ctaPrimaryLabel?: unknown
  ctaPrimaryPath?: unknown
  ctaSecondaryLabel?: unknown
  ctaSecondaryPath?: unknown
}

const MAX = { eyebrow: 200, title: 200, body: 1000, cta: 120, path: 300 }

function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  if (s.length > max) throw createError({ statusCode: 400, message: `A field exceeds ${max} characters` })
  return s
}

/**
 * A CTA may only point inside this site. An absolute external URL, a protocol-relative `//host`, a
 * `javascript:` URL and a `data:` URL are all refused — the hero is public output.
 */
function sitePath(value: unknown): string | null {
  const s = text(value, MAX.path)
  if (!s) return null
  if (!s.startsWith('/') || s.startsWith('//')) {
    throw createError({ statusCode: 400, message: 'A button link must be a site path beginning with a single /' })
  }
  if (s.includes('\\')) throw createError({ statusCode: 400, message: 'A button link may not contain a backslash' })
  return s
}

/**
 * A hero image must be a Media Library file id. `hero_image` is a uuid column, so anything else used to
 * surface as a database error; refusing it here turns that into a message a person can act on, and
 * matches the check the category endpoint already makes.
 */
function fileId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw createError({ statusCode: 400, message: 'The hero image must be a Media Library file id' })
  }
  return s
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const body = (await readBody(event)) ?? ({} as Body)
  const entry = findHeroPage(body.pageKey)
  if (!entry) throw createError({ statusCode: 400, message: 'Unknown page' })

  const action = body.action === 'withdraw' ? 'withdraw' : 'publish'

  // Find the single existing row for this page. The registry key is the server's, not the client's.
  const found = await adminFetch<{ data?: { id: number, status?: string | null }[] }>(
    event,
    `/items/site_content?filter[content_key][_eq]=${encodeURIComponent(entry.contentKey)}&fields=id,status&limit=2`,
  )
  const rows = Array.isArray(found?.data) ? found.data : []
  if (rows.length > 1) {
    // Two rows for one key would make the public read ambiguous; refuse rather than pick one.
    throw createError({ statusCode: 409, message: `More than one site_content row uses ${entry.contentKey}` })
  }
  const existing = rows[0] ?? null

  if (action === 'withdraw') {
    if (!existing) return { ok: true, state: 'Using default' as const }
    // Unpublishing, not deleting: the row's copy stays recoverable and the public page falls back to
    // the approved default. The UI tells the editor exactly this.
    await adminFetch(event, `/items/site_content/${existing.id}`, {
      method: 'PATCH',
      body: { status: 'draft' },
    })
    return { ok: true, state: 'Using default' as const }
  }

  const eyebrow = text(body.eyebrow, MAX.eyebrow) ?? entry.defaults.eyebrow
  const title = text(body.title, MAX.title) ?? entry.defaults.title
  const payload: Record<string, unknown> = {
    content_key: entry.contentKey,
    page_key: entry.pageKey,
    section_key: 'hero',
    status: 'published',
    eyebrow_en: eyebrow,
    title_en: title,
    body_en: text(body.body, MAX.body),
    hero_image: fileId(body.heroImage),
    cta_primary_label_en: text(body.ctaPrimaryLabel, MAX.cta),
    cta_primary_path: sitePath(body.ctaPrimaryPath),
    cta_secondary_label_en: text(body.ctaSecondaryLabel, MAX.cta),
    cta_secondary_path: sitePath(body.ctaSecondaryPath),
  }

  if (existing) {
    await adminFetch(event, `/items/site_content/${existing.id}`, { method: 'PATCH', body: payload })
  }
  else {
    // First publish for this page. Because the read above proved no row exists, a duplicate could
    // only appear under concurrent requests; a unique index on content_key is not proven to exist,
    // so this is recorded as a known gap rather than claimed safe.
    await adminFetch(event, '/items/site_content', { method: 'POST', body: payload })
  }

  return { ok: true, state: 'Published override' as const }
})
