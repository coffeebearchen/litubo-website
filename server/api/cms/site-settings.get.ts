import { directusFetch } from '~/server/utils/directus'
import type { SiteSettings, PublicSiteSettings } from '~/types/settings'

const SETTINGS_FIELDS = 'brand_name,legal_company_name,public_email,public_phone,public_whatsapp_url,public_address,copyright_text'

const FALLBACK: PublicSiteSettings = {
  brand_name: 'LITUBO',
  legal_company_name: 'Shanghai NingPin Industrial Dev. Co., Ltd.',
  public_email: 'sales@litubo.com',
  public_phone: '+86 21 5270 7913',
  public_whatsapp_url: 'https://wa.me/8619370713936',
  public_address: 'No. 23, Huangtu Rd., Huaqiao Town, Kunshan, Jiangsu Province, China',
  copyright_text: '© {year} LITUBO. All rights reserved.',
  social_links: [
    { platform: 'linkedin', url: 'https://www.linkedin.com/company/litubo', sort: 1 },
    { platform: 'youtube', url: 'https://www.youtube.com/@litubo', sort: 2 },
  ],
}

export default defineEventHandler(async (): Promise<PublicSiteSettings> => {
  try {
    const [sRes, lRes] = await Promise.all([
      directusFetch<{ data: SiteSettings | null }>(`/items/site_settings?fields=${SETTINGS_FIELDS}`),
      directusFetch<{ data: Array<{ platform: string; url: string; sort: number }> }>(
        '/items/site_social_links?filter[enabled][_eq]=true&sort=sort&fields=platform,url,sort&limit=10',
      ),
    ])

    const s = (sRes as { data: SiteSettings | null }).data
    if (!s) return FALLBACK

    const links = (lRes as { data: Array<{ platform: string; url: string; sort: number }> }).data ?? []

    return {
      brand_name: s.brand_name ?? FALLBACK.brand_name,
      legal_company_name: s.legal_company_name ?? FALLBACK.legal_company_name,
      public_email: s.public_email ?? FALLBACK.public_email,
      public_phone: s.public_phone ?? FALLBACK.public_phone,
      public_whatsapp_url: s.public_whatsapp_url ?? FALLBACK.public_whatsapp_url,
      public_address: s.public_address ?? FALLBACK.public_address,
      copyright_text: s.copyright_text ?? FALLBACK.copyright_text,
      social_links: links.length > 0 ? links : FALLBACK.social_links,
    }
  } catch {
    return FALLBACK
  }
})
