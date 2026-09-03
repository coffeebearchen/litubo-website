export type ProductStatus = 'draft' | 'review' | 'published' | 'archived'

export interface ProductPreset {
  id: number
  code: string
  name_en: string
  category_hint: string | null
  default_module_order: string[] | null
  active: boolean
}

export interface AdminProduct {
  id: number
  status: ProductStatus
  slug: string
  name_en: string
  name_es: string | null
  name_pt: string | null
  model_or_series: string | null
  summary_en: string | null
  summary_es: string | null
  summary_pt: string | null
  category_id: number | null
  page_preset_id: number | null
  published_at: string | null
  review_notes: string | null
  date_created: string | null
  date_updated: string | null
  hero_image: string | null
  seo_title_en: string | null
  seo_description_en: string | null
  seo_noindex: boolean | null
}

export interface ProductCategory {
  id: number
  slug: string
  name_en: string
  name_es: string | null
  name_pt: string | null
}

export interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string | null
}
