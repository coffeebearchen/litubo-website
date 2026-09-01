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

export interface SEOMeta {
  title: LocalizedString
  description: LocalizedString
  canonicalPath: string
  ogImage?: string
  noIndex?: boolean
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

export interface Product {
  id: string
  categoryId: string
  slug: string
  name: LocalizedString
  summary: LocalizedString
  heroMedia: MediaAsset
  gallery: MediaAsset[]
  highlights: ProductHighlight[]
  specifications: ProductSpecRow[]
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

/* ─── Form ─────────────────────────────────────────────────────────── */
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
