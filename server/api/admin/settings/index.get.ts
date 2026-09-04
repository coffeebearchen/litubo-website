import { adminFetch } from '~/server/utils/adminDirectusClient'
import type { SiteSettings, SiteSocialLink } from '~/types/settings'

export default defineEventHandler(async (event) => {
  try {
    const settingsRes = await adminFetch<{ data: SiteSettings | null }>(
      event, '/items/site_settings?fields=*',
    )
    const settings = (settingsRes as { data: SiteSettings | null }).data

    // Directus singleton returns { id: null, ...nulls } when no record exists
    if (!settings || settings.id === null) {
      return { needsSetup: true, settings: null, socialLinks: [] }
    }

    const linksRes = await adminFetch<{ data: SiteSocialLink[] }>(
      event,
      `/items/site_social_links?filter[settings_id][_eq]=${settings.id}&sort=sort`,
    )
    const socialLinks = (linksRes as { data: SiteSocialLink[] }).data ?? []

    return { needsSetup: false, settings, socialLinks }
  } catch {
    return { needsSetup: true, settings: null, socialLinks: [] }
  }
})
