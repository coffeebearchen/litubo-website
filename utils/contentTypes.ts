import type { ContentBlockType } from './contentBlocks'

/**
 * CC-IMP-01 — Content Center content type registry (CONTENT-CENTER-BLUEPRINT-V1 §7, §10).
 *
 * One shared content system with five V1 types (D-031). Code configuration, not
 * database configuration; fail-closed — an unknown type is rejected.
 *
 * CC-IMP-10 (D-035) — Phase 1 public delivery: only Technical Article
 * (`/resources/insights/[slug]`) and Case Study (`/resources/case-studies/[slug]`)
 * are `publicEnabled`, English only (`runtimeConfig.public.publishedLocales`).
 * Application / Solution, Resource / Download and News stay non-public; Publish
 * refuses a type that is not public, and the public reader never returns one.
 */

export const CONTENT_TYPE_IDS = [
  'technical_article',
  'application_solution',
  'case_study',
  'resource_download',
  'news',
] as const

export type ContentTypeId = (typeof CONTENT_TYPE_IDS)[number]

export interface ContentTypeDefinition {
  id: ContentTypeId
  label: string
  allowedBlocks: readonly ContentBlockType[]
  /** Blocks created (with empty text) when a draft of this type is created. */
  defaultBlocks: readonly ContentBlockType[]
  /** Readiness metadata for the Publish module: minimum count per block type. */
  requiredBlocks: readonly { type: ContentBlockType, min: number }[]
  /** Readiness metadata: at least one enabled `download` file link is required. */
  requiresDownloadFile: boolean
  heroRequired: boolean
  publicEnabled: boolean
  sitemapEligible: boolean
  /** Public route prefix (the slug follows) — null while the type has no confirmed public route. */
  publicRoute: string | null
}

export const CONTENT_TYPES: Readonly<Record<ContentTypeId, ContentTypeDefinition>> = {
  technical_article: {
    id: 'technical_article',
    label: 'Technical Article',
    allowedBlocks: ['text', 'key_points', 'image', 'faq', 'cta', 'related_content', 'downloads'],
    defaultBlocks: ['text', 'key_points', 'faq', 'cta', 'related_content'],
    requiredBlocks: [{ type: 'text', min: 1 }],
    requiresDownloadFile: false,
    heroRequired: false,
    // D-035 — Phase 1 public route confirmed by the user.
    publicEnabled: true,
    sitemapEligible: true,
    publicRoute: '/resources/insights',
  },
  application_solution: {
    id: 'application_solution',
    label: 'Application / Solution',
    allowedBlocks: ['text', 'key_points', 'image', 'faq', 'cta', 'related_content', 'downloads'],
    defaultBlocks: ['text', 'key_points', 'cta', 'related_content'],
    requiredBlocks: [{ type: 'text', min: 1 }, { type: 'key_points', min: 1 }],
    requiresDownloadFile: false,
    heroRequired: true,
    // D-035 — not public in Phase 1; the eight D-002 application pages keep their fixtures.
    publicEnabled: false,
    sitemapEligible: false,
    publicRoute: null,
  },
  case_study: {
    id: 'case_study',
    label: 'Case Study',
    allowedBlocks: ['text', 'key_points', 'image', 'cta', 'related_content', 'downloads'],
    defaultBlocks: ['text', 'text', 'key_points', 'cta', 'related_content'],
    requiredBlocks: [{ type: 'text', min: 1 }],
    requiresDownloadFile: false,
    heroRequired: true,
    // D-035 — Phase 1 public route confirmed by the user.
    publicEnabled: true,
    sitemapEligible: true,
    publicRoute: '/resources/case-studies',
  },
  resource_download: {
    id: 'resource_download',
    label: 'Resource / Download',
    allowedBlocks: ['text', 'downloads', 'cta', 'related_content'],
    defaultBlocks: ['text', 'downloads', 'related_content'],
    requiredBlocks: [{ type: 'downloads', min: 1 }],
    requiresDownloadFile: true,
    heroRequired: false,
    // D-035 — not public in Phase 1; /resources/downloads keeps its placeholder.
    publicEnabled: false,
    sitemapEligible: false,
    publicRoute: null,
  },
  news: {
    id: 'news',
    label: 'News',
    allowedBlocks: ['text', 'image', 'cta', 'related_content'],
    defaultBlocks: ['text'],
    requiredBlocks: [{ type: 'text', min: 1 }],
    requiresDownloadFile: false,
    heroRequired: false,
    // D-004 / D-013 / D-035: News stays non-public in Phase 1.
    publicEnabled: false,
    sitemapEligible: false,
    publicRoute: null,
  },
}

export function isContentTypeId(value: unknown): value is ContentTypeId {
  return typeof value === 'string' && (CONTENT_TYPE_IDS as readonly string[]).includes(value)
}

export function getContentType(value: unknown): ContentTypeDefinition | null {
  return isContentTypeId(value) ? CONTENT_TYPES[value] : null
}
