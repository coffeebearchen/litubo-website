/**
 * Content model types.
 * All localizable text uses LocalizedString.
 * Phase 1 adapters read local fixtures; Phase 2 adapters read Directus.
 * Components must not depend on adapter internals.
 */

export interface LocalizedString {
  en: string
  es: string
  pt: string
}

export type Locale = 'en' | 'es' | 'pt'

export type ContentStatus = 'published' | 'draft' | 'archived'

/* ─── Homepage ─────────────────────────────────────────────── */
export interface HomeHeroCta {
  label: LocalizedString
  path: string
}

export interface HomeHeroContent {
  imageUrl: string
  eyebrow: LocalizedString
  title: LocalizedString
  body: LocalizedString
  ctaPrimary: HomeHeroCta
  ctaSecondary: HomeHeroCta
}

export interface HomeContent {
  hero: HomeHeroContent | null
}

export interface SEOMeta {
  title: LocalizedString
  description: LocalizedString
  canonicalPath: string
  ogImage?: string
  noIndex?: boolean
}

/* ─── Posts (Blog / Knowledge) ─────────────────────────────────── */

export type ContentType = 'insight' | 'technical_guide' | 'case_study' | 'news' | 'faq'

export type FaqGroup =
  | 'xray'
  | 'metal-detection'
  | 'checkweighing'
  | 'applications'
  | 'service-support'
  | 'general'

export type PostTopic =
  | 'xray'
  | 'metal-detection'
  | 'checkweighing'
  | 'combination-inspection'
  | 'food-safety'
  | 'product-selection'
  | 'applications'
  | 'regulations-compliance'
  | 'service-maintenance'
  | 'company-news'

export interface PostListItem {
  id: string
  contentType: ContentType
  slug: string
  publishDate: string | null
  author: string | null
  topics: PostTopic[]
  coverImageUrl: string
  title: LocalizedString
  excerpt: LocalizedString
  /** Populated only when the list endpoint is called with content_type=faq */
  faqGroup?: FaqGroup | null
  /** Populated only when the list endpoint is called with content_type=faq */
  bodyHtml?: LocalizedString
}

export interface Post extends PostListItem {
  faqGroup: FaqGroup | null
  relatedProductSlugs: string[]
  relatedApplicationSlugs: string[]
  bodyHtml: LocalizedString
  seo: SEOMeta
}

export interface PostsResult {
  posts: PostListItem[]
  cmsError?: boolean
}

export interface MediaAsset {
  id: string
  url: string
  alt: LocalizedString
  width?: number
  height?: number
  mimeType?: string
}

/* ─── Product category ─────────────────────────────────────────────── */
export interface ProductCategory {
  id: string
  slug: string
  title: LocalizedString
  intro: LocalizedString
  heroMedia: MediaAsset
  order: number
  seo: SEOMeta
}

/* ─── Product ──────────────────────────────────────────────────────── */
export interface ProductHighlight {
  title: LocalizedString
  body: LocalizedString
  icon?: string
}

export interface ProductSpecRow {
  label: LocalizedString
  value: LocalizedString
  unit?: string
}

/** Structured spec group from product_spec_groups + product_spec_items. */
export interface PublicSpecGroup {
  title: LocalizedString
  description: LocalizedString
  items: ProductSpecRow[]
}

/** FAQ entry from product_faqs. Body fields are plain text (input-multiline). */
export interface PublicFaq {
  question: LocalizedString
  answer: LocalizedString
}

/** Section item from product_section_items. All text fields are plain text. */
export interface PublicSectionItem {
  label: LocalizedString
  title: LocalizedString
  body: LocalizedString
  iconKey?: string
}

/** Content section from product_sections. All body/eyebrow fields are plain text. */
export interface PublicSection {
  type: string
  title: LocalizedString
  eyebrow: LocalizedString
  body: LocalizedString
  layoutVariant?: string
  media?: MediaAsset
  items: PublicSectionItem[]
}

/** Downloadable file from products_files (brochure/datasheet/drawing/manual/certificate roles). */
export interface PublicDownload {
  uuid: string
  url: string
  role: string
  versionLabel?: string
  fileDate?: string
}

export interface Product {
  id: string
  categoryId: string
  slug: string
  name: LocalizedString
  summary: LocalizedString
  modelSeries?: string
  heroMedia: MediaAsset
  gallery: MediaAsset[]
  highlights: ProductHighlight[]
  specifications: ProductSpecRow[]
  /** Structured spec groups — populated in Directus mode; empty in fixtures mode. */
  specGroups?: PublicSpecGroup[]
  /** Product FAQ entries — populated in Directus mode; absent in fixtures mode. */
  faqs?: PublicFaq[]
  /** Page content sections — populated in Directus mode; absent in fixtures mode. */
  sections?: PublicSection[]
  /** Downloadable documents — populated in Directus mode; absent in fixtures mode. */
  downloads?: PublicDownload[]
  options: LocalizedString[]
  downloadIds: string[]
  relatedProductIds: string[]
  applicationSlugs: string[]
  seo: SEOMeta
  status: ContentStatus
  /** Development-only marker: must not appear in production builds */
  __DEMO_NOT_FOR_PUBLIC__?: boolean
}

/* ─── Application ──────────────────────────────────────────────────── */
export interface ApplicationChallenge {
  title: LocalizedString
  body: LocalizedString
}

export interface Application {
  id: string
  slug: string
  title: LocalizedString
  overview: LocalizedString
  challenges: ApplicationChallenge[]
  recommendedSolutionSlugs: string[]
  heroMedia: MediaAsset
  seo: SEOMeta
}

/* ─── Resource ─────────────────────────────────────────────────────── */
export type ResourceType = 'insight' | 'case-study' | 'download' | 'video'

export interface Resource {
  id: string
  type: ResourceType
  slug: string
  title: LocalizedString
  excerpt: LocalizedString
  body?: LocalizedString
  media?: MediaAsset
  videoUrl?: string
  date: string
  tags: string[]
  relatedProductIds: string[]
  downloadAssetId?: string
  seo: SEOMeta
  status: ContentStatus
  /** Development-only marker */
  __DEMO_NOT_FOR_PUBLIC__?: boolean
}

/* ─── Download asset ───────────────────────────────────────────────── */
export type DocumentType = 'datasheet' | 'brochure' | 'manual' | 'certificate' | 'catalog'

export interface DownloadAsset {
  id: string
  title: LocalizedString
  fileUrl: string
  documentType: DocumentType
  language: Locale
  version?: string
  publishDate: string
  relatedProductIds: string[]
}

/* ─── FAQ ──────────────────────────────────────────────────────────── */
export interface FAQ {
  id: string
  question: LocalizedString
  answer: LocalizedString
  category: string
  order: number
  noIndex?: boolean
}

/* ─── Inquiry (Phase 6 — unified form submission to Directus) ───────── */
export type InquiryType =
  | 'contact'
  | 'technical_matching'
  | 'distributor'
  | 'spare_parts'
  | 'support_request'
  | 'send_product_test'

export type InquiryStatus = 'new' | 'in_progress' | 'resolved' | 'spam'

/* Phase 7A: HubSpot Contact sync status stored on each inquiry record */
export type HubspotSyncStatus =
  | 'not_configured'
  | 'pending'
  | 'synced'
  | 'failed'

export interface InquiryPayload {
  inquiry_type: InquiryType
  status: InquiryStatus
  locale: Locale
  consent_given: boolean
  consented_at: string
  privacy_policy_version: string
  contact_name: string | null
  contact_email: string
  contact_phone: string | null
  contact_company: string | null
  contact_country: string | null
  contact_title: string | null
  message: string | null
  related_product_slug: string | null
  related_application_slug: string | null
  model_number: string | null
  serial_number: string | null
  tm_product_interest: string | null
  tm_product_format: string | null
  tm_line_speed: string | null
  tm_package_dimensions: string | null
  tm_contaminant_concern: string | null
  tm_existing_equipment: string | null
  source_url: string
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  raw_fields: Record<string, unknown>
  hubspot_sync_status: HubspotSyncStatus
}

/* ─── Form (legacy shape kept for reference) ────────────────────────── */
export type FormPurpose = 'contact' | 'technical-matching' | 'find-a-distributor'
  | 'spare-parts' | 'send-product-test' | 'support-request' | 'become-a-partner'

export interface FormSubmission {
  id?: string
  formId: FormPurpose
  locale: Locale
  values: Record<string, string | boolean>
  consentAt: string
  sourceUrl: string
  submittedAt: string
  status: 'new' | 'reviewed' | 'replied'
}

/* ─── AI draft (Phase 1 boundary) ──────────────────────────────────── */
export type AIDraftPurpose = 'blog-post' | 'customer-communication'

export interface AIDraft {
  id: string
  purpose: AIDraftPurpose
  locale: Locale
  output: string
  reviewedBy?: string
  publishStatus: 'draft' | 'approved' | 'published'
}
