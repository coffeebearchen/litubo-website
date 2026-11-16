// ── Core enums ──────────────────────────────────────────────────────────────

export type ProductStatus = 'draft' | 'review' | 'published' | 'archived'

export type SectionType =
  | 'text' | 'feature_list'
  | 'overview' | 'image_text' | 'benefits' | 'applications'
  | 'detection_targets' | 'working_principle' | 'configuration_options'
  | 'line_integration' | 'quotation_reminder' | 'video' | 'case_studies'

export const SECTION_TYPES: SectionType[] = [
  'text', 'feature_list',
  'overview', 'image_text', 'benefits', 'applications',
  'detection_targets', 'working_principle', 'configuration_options',
  'line_integration', 'quotation_reminder', 'video', 'case_studies',
]

export type SectionLayoutVariant = 'default' | 'image_left' | 'image_right' | 'wide' | 'narrow' | 'two_column'

export type FileRole =
  | 'hero' | 'overview' | 'application' | 'detail' | 'gallery'
  | 'video_poster' | 'brochure' | 'datasheet' | 'drawing' | 'manual' | 'certificate'

export const FILE_ROLES: FileRole[] = [
  'hero', 'overview', 'application', 'detail', 'gallery',
  'video_poster', 'brochure', 'datasheet', 'drawing', 'manual', 'certificate',
]

export type SourceReviewStatus = 'confirmed' | 'needs_review' | 'missing' | 'conflict'

// ── 9A-1 types (preserved) ────────────────────────────────────────────────

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
  product_code: string | null
  model_or_series: string | null
  /** Checkweigher series metadata. Nullable; only meaningful on the Checkweighers category. */
  checkweigher_series?: 'compact' | 'standard' | 'medium-range' | 'extra-large' | 'pharmaceutical' | null
  checkweigher_configuration?: 'online' | 'left-right' | null
  checkweigher_l_series?: boolean | null
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

export interface CategorySummary {
  id: number
  slug: string
  name_en: string
  intro_en: string | null
  total: number
  by_status: {
    draft: number
    review: number
    published: number
    archived: number
  }
}

export interface ProductsSummary {
  all: number
  draft: number
  review: number
  draft_review: number
  published: number
  archived: number
}

export interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string | null
}

// ── 9A-2 types ────────────────────────────────────────────────────────────

export interface ProductMedia {
  id: number
  products_id: number
  directus_files_id: string | null
  file_role: FileRole | null
  alt_en: string | null
  alt_es: string | null
  alt_pt: string | null
  caption_en: string | null
  caption_es: string | null
  caption_pt: string | null
  enabled: boolean
  language: 'all' | 'en' | 'es' | 'pt' | null
  version_label: string | null
  sort: number | null
  file_date: string | null
  // Joined from directus_files:
  filename_download?: string | null
  type?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  focal_point_x?: number | null
  focal_point_y?: number | null
}

export interface ProductSection {
  id: number
  product_id: number
  type: SectionType
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  eyebrow_en: string | null
  eyebrow_es: string | null
  eyebrow_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  layout_variant: SectionLayoutVariant | null
  media_id: number | null
  external_url: string | null
  enabled: boolean
  sort: number | null
}

export interface ProductSectionItem {
  id: number
  section_id: number
  label_en: string | null
  label_es: string | null
  label_pt: string | null
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  body_en: string | null
  body_es: string | null
  body_pt: string | null
  icon_key: string | null
  sort: number | null
  enabled: boolean
}

export interface ProductSpecGroup {
  id: number
  product_id: number
  title_en: string | null
  title_es: string | null
  title_pt: string | null
  description_en: string | null
  description_es: string | null
  description_pt: string | null
  enabled: boolean
  sort: number | null
  items?: ProductSpecItem[]
}

export interface ProductSpecItem {
  id: number
  spec_group_id: number
  label_en: string | null
  label_es: string | null
  label_pt: string | null
  value_en: string | null
  value_es: string | null
  value_pt: string | null
  note_en: string | null
  note_es: string | null
  note_pt: string | null
  sort: number | null
  enabled: boolean
}

export interface ProductFaq {
  id: number
  product_id: number
  question_en: string | null
  question_es: string | null
  question_pt: string | null
  answer_en: string | null
  answer_es: string | null
  answer_pt: string | null
  source_note: string | null
  enabled: boolean
  sort: number | null
}

export interface ProductSourceRecord {
  id: number
  product_id: number
  source_file_id: string | null
  source_locator: string | null
  raw_excerpt: string | null
  fact_key: string | null
  review_status: SourceReviewStatus | null
  note: string | null
  date_created: string | null
  archived: boolean
  archived_at: string | null
}

export interface ProductSeoFields {
  seo_title_en: string | null
  seo_description_en: string | null
  seo_noindex: boolean | null
}
