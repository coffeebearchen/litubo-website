export interface SiteSettings {
  id: number
  brand_name: string | null
  legal_company_name: string | null
  public_email: string | null
  public_phone: string | null
  public_whatsapp_url: string | null
  public_address: string | null
  copyright_text: string | null
  date_updated: string | null
}

export interface SiteSocialLink {
  id: number
  settings_id: number | null
  platform: string
  url: string
  sort: number | null
  enabled: boolean
}

export type SocialPlatform = 'linkedin' | 'youtube' | 'instagram' | 'facebook'

export const SOCIAL_PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
]

export interface PublicSiteSettings {
  brand_name: string
  legal_company_name: string
  public_email: string
  public_phone: string
  public_whatsapp_url: string
  public_address: string
  copyright_text: string
  social_links: Array<{
    platform: string
    url: string
    sort: number
  }>
}
