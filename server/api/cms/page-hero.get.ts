import { getQuery, setHeader, createError } from 'h3'
import { directusFetch } from '~/server/utils/directus'
import { requireCmsSource } from '~/server/utils/cmsSource'
import { publicFileId, resolvePublicFiles } from '~/server/utils/contentPublic'
import { findHeroPage } from '~/server/utils/heroRegistry'

/**
 * V2-04 — the published hero override for one page, or nothing.
 *
 * The public reader never sees a draft, never sees a private image, and never fails the page: an
 * unreachable CMS, a missing row, an empty value or an ineligible image all return `hero: null`, and
 * the page falls back to the copy in its own component. A blank page because nobody filled a form in
 * would be worse than no override at all.
 *
 * Separate from `/api/admin/page-content` on purpose: that route needs a session, this one must not.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

  requireCmsSource('cmsMode')

  const pageKey = typeof getQuery(event).page === 'string' ? String(getQuery(event).page) : ''
  const entry = findHeroPage(pageKey)
  if (!entry) throw createError({ statusCode: 400, message: 'Unknown page' })

  try {
    const res = await directusFetch<{
      data?: {
        hero_image?: string | null
        eyebrow_en?: string | null
        title_en?: string | null
        body_en?: string | null
        cta_primary_label_en?: string | null
        cta_primary_path?: string | null
        cta_secondary_label_en?: string | null
        cta_secondary_path?: string | null
      }[]
    }>(
      `/items/site_content?filter[content_key][_eq]=${encodeURIComponent(entry.contentKey)}`
      + '&filter[status][_eq]=published'
      + '&fields=hero_image,eyebrow_en,title_en,body_en,cta_primary_label_en,cta_primary_path,cta_secondary_label_en,cta_secondary_path'
      + '&limit=1',
    )

    const row = Array.isArray(res?.data) ? res.data[0] : undefined
    if (!row) return { hero: null }

    // The image must pass the same public-eligibility gate as every other media reference; a private
    // or archived file returns no URL rather than leaking its id or a Directus path.
    let imageUrl = ''
    if (row.hero_image) {
      const files = await resolvePublicFiles(directusFetch, [row.hero_image])
      const id = publicFileId(files, row.hero_image)
      if (id) imageUrl = `/api/cms/media/${id}`
    }

    return {
      hero: {
        eyebrow: row.eyebrow_en ?? null,
        title: row.title_en ?? null,
        body: row.body_en ?? null,
        imageUrl,
        ctaPrimaryLabel: row.cta_primary_label_en ?? null,
        ctaPrimaryPath: row.cta_primary_path ?? null,
        ctaSecondaryLabel: row.cta_secondary_label_en ?? null,
        ctaSecondaryPath: row.cta_secondary_path ?? null,
      },
    }
  }
  catch {
    // A CMS fault must not take the page down; the caller uses its approved default.
    return { hero: null }
  }
})
