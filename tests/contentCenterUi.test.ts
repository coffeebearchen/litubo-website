/**
 * CC-IMP-02 — Content Center List, Workspace Shell and Overview.
 *
 * Pure helpers are imported from utils/contentCenter.ts — the same module the
 * pages and components import. Page wiring that only exists in `.vue` files is
 * checked through source evidence, following tests/productWorkspaceOverview.test.ts.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONTENT_AI_UNAVAILABLE,
  CONTENT_CENTER_LIST_ROUTE,
  CONTENT_CENTER_NEW_ROUTE,
  CONTENT_LOCALE_OPTIONS,
  CONTENT_READINESS_UNAVAILABLE,
  CONTENT_STATUS_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  CONTENT_WORKSPACE_MODULES,
  buildContentListQuery,
  contentBlockSummary,
  contentCreateRequestBody,
  contentListApiQuery,
  contentListRow,
  contentLocaleState,
  contentLocaleSummary,
  contentOverviewRoute,
  contentSeoSummary,
  contentWorkspaceModuleRoute,
  hasActiveContentFilters,
  interpretContentApiError,
  missingContentCreateFields,
  parseContentListQuery,
  primaryContentLocale,
} from '../utils/contentCenter'
import { CONTENT_TYPE_IDS } from '../utils/contentTypes'
import type { AdminContentDraft, AdminContentListItem } from '../types/content-center'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const UI_FILES = [
  'pages/admin/content-center/index.vue',
  'pages/admin/content-center/new.vue',
  'pages/admin/content-center/[id]/index.vue',
  'pages/admin/content-center/[id]/overview.vue',
  'components/admin/content/ContentList.vue',
  'components/admin/content/ContentCreateForm.vue',
  'components/admin/content/ContentWorkspaceShell.vue',
  'components/admin/content/ContentWorkspaceNav.vue',
  'components/admin/content/ContentOverview.vue',
  'pages/admin/content-center/[id]/editor.vue',
  'components/admin/content/ContentEditor.vue',
  'components/admin/content/ContentBlockEditor.vue',
  'components/admin/content/ContentEditorOutline.vue',
  'pages/admin/content-center/[id]/media-relations.vue',
  'components/admin/content/ContentMediaRelations.vue',
  'components/admin/content/ContentRelationPicker.vue',
  'pages/admin/content-center/[id]/seo-locales.vue',
  'components/admin/content/ContentSeoLocales.vue',
]

describe('routes and workspace module rail', () => {
  it('uses the frozen route intent', () => {
    expect(CONTENT_CENTER_LIST_ROUTE).toBe('/admin/content-center')
    expect(CONTENT_CENTER_NEW_ROUTE).toBe('/admin/content-center/new')
    expect(contentOverviewRoute(5)).toBe('/admin/content-center/5/overview')
  })

  it('lists the eight workspace modules in the frozen order with only the built modules enabled', () => {
    expect(CONTENT_WORKSPACE_MODULES.map(m => m.label)).toEqual([
      'Overview', 'Content editor', 'Media & relations', 'SEO & locales',
      'AI Source Intake', 'AI Proposal Review', 'Preview & publish readiness', 'Change history',
    ])
    expect(CONTENT_WORKSPACE_MODULES.filter(m => m.enabled).map(m => m.key)).toEqual(['overview', 'editor', 'media-relations', 'seo-locales', 'ai-source-intake', 'preview-publish', 'history'])
    expect(contentWorkspaceModuleRoute('history', 5)).toBe('/admin/content-center/5/history')
    expect(contentWorkspaceModuleRoute('editor', 5)).toBe('/admin/content-center/5/editor')
    expect(contentWorkspaceModuleRoute('media-relations', 5)).toBe('/admin/content-center/5/media-relations')
    expect(contentWorkspaceModuleRoute('seo-locales', 5)).toBe('/admin/content-center/5/seo-locales')
    expect(contentWorkspaceModuleRoute('ai-source-intake', 5)).toBe('/admin/content-center/5/ai-source-intake')
    expect(contentWorkspaceModuleRoute('preview-publish', 5)).toBe('/admin/content-center/5/preview-publish')
    for (const module of CONTENT_WORKSPACE_MODULES.filter(m => !m.enabled)) {
      expect(module.disabledReason).toBe('Not built yet')
      expect(contentWorkspaceModuleRoute(module.key, 5)).toBeNull()
    }
    expect(contentWorkspaceModuleRoute('overview', 5)).toBe('/admin/content-center/5/overview')
  })

  it('creates the list, create, bare-id and overview pages without a shadowing [id].vue', () => {
    for (const file of UI_FILES) expect(existsSync(resolve(process.cwd(), file)), file).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'pages/admin/content-center/[id].vue'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'pages/admin/content-center.vue'))).toBe(false)
    // CC-IMP-08 — AI Source Intake exists; AI Proposal Review is still a future module (CC-IMP-09).
    expect(existsSync(resolve(process.cwd(), 'pages/admin/content-center/[id]/ai-source-intake.vue'))).toBe(true)
    for (const future of ['ai-proposal-review']) {
      expect(existsSync(resolve(process.cwd(), `pages/admin/content-center/[id]/${future}.vue`)), future).toBe(false)
    }
  })

  it('redirects the bare id route to the Overview', () => {
    const source = repoFile('pages/admin/content-center/[id]/index.vue')
    expect(source).toContain('navigateTo(contentOverviewRoute(String(route.params.id)), { replace: true })')
  })
})

describe('filter options come from the registries', () => {
  it('offers exactly the five V1 content types, three statuses and three locales', () => {
    expect(CONTENT_TYPE_OPTIONS.map(o => o.value)).toEqual([...CONTENT_TYPE_IDS])
    expect(CONTENT_TYPE_OPTIONS.map(o => o.label)).toEqual(['Technical Article', 'Application / Solution', 'Case Study', 'Resource / Download', 'News'])
    expect(CONTENT_STATUS_OPTIONS.map(o => o.value)).toEqual(['draft', 'published', 'archived'])
    expect(CONTENT_LOCALE_OPTIONS.map(o => o.value)).toEqual(['en', 'es', 'pt'])
  })
})

describe('list query state', () => {
  it('parses the URL and drops unknown values', () => {
    expect(parseContentListQuery({ search: 'powder', type: 'news', status: 'draft', locale: 'es', page: '3' }))
      .toEqual({ search: 'powder', contentType: 'news', status: 'draft', locale: 'es', page: 3 })
    expect(parseContentListQuery({ type: 'blog', status: 'review', locale: 'zh', page: '-2' }))
      .toEqual({ search: '', contentType: '', status: '', locale: '', page: 1 })
    expect(parseContentListQuery({ search: ['a', 'b'] }).search).toBe('a')
    expect(parseContentListQuery({ search: 'x'.repeat(150) }).search).toHaveLength(100)
  })

  it('builds the URL and the API query, omitting empty values', () => {
    const state = { search: ' powder ', contentType: 'case_study', status: 'draft', locale: 'en', page: 2 }
    expect(buildContentListQuery(state)).toEqual({ search: 'powder', type: 'case_study', status: 'draft', locale: 'en', page: '2' })
    expect(contentListApiQuery(state)).toEqual({ search: 'powder', content_type: 'case_study', status: 'draft', locale: 'en', page: 2, limit: 25 })
    const empty = { search: '', contentType: '', status: '', locale: '', page: 1 }
    expect(buildContentListQuery(empty)).toEqual({})
    expect(contentListApiQuery(empty)).toEqual({ page: 1, limit: 25 })
    expect(hasActiveContentFilters(empty)).toBe(false)
    expect(hasActiveContentFilters({ ...empty, locale: 'pt' })).toBe(true)
  })

  it('shows the default-locale title and slug in a list row', () => {
    const item: AdminContentListItem = {
      id: 7, content_type: 'technical_article', status: 'draft', date_created: '2026-09-15T00:00:00Z', date_updated: null,
      locales: [
        { locale: 'es', title: 'ES title', slug: 'es-slug', draft_revision: 1 },
        { locale: 'en', title: 'EN title', slug: 'en-slug', draft_revision: 2 },
      ],
    }
    expect(contentListRow(item)).toMatchObject({
      id: 7, title: 'EN title', slug: 'en-slug', typeLabel: 'Technical Article', status: 'draft',
      localeCodes: ['ES', 'EN'], updated: '15 Sept 2026', overviewRoute: '/admin/content-center/7/overview',
    })
    expect(primaryContentLocale([{ locale: 'pt', title: 'PT', slug: 'pt' }])?.title).toBe('PT')
    expect(contentListRow({ ...item, locales: [] }).title).toBe('Untitled content #7')
  })
})

describe('API errors are explained, never swallowed', () => {
  const apiError = (statusCode: number, message?: string, field?: string) =>
    ({ statusCode, data: { message, data: field ? { field } : undefined } })

  it('maps the foundation error convention to English messages', () => {
    expect(interpretContentApiError(apiError(400))).toMatchObject({ status: 400, field: null })
    expect(interpretContentApiError(apiError(401)).message).toMatch(/session has expired/)
    expect(interpretContentApiError(apiError(404)).message).toBe('This content item was not found.')
    expect(interpretContentApiError(apiError(409, 'This slug is already used for this language.', 'slug')))
      .toEqual({ status: 409, field: 'slug', message: 'This slug is already used for this language.' })
    expect(interpretContentApiError(apiError(422, 'content_type must be one of the Content Center V1 types.', 'content_type')))
      .toMatchObject({ field: 'content_type' })
    expect(interpretContentApiError(apiError(422, 'These fields cannot be set here: status.'))).toMatchObject({ field: null, message: 'These fields cannot be set here: status.' })
    expect(interpretContentApiError(apiError(503)).message).toMatch(/temporarily unavailable/)
    expect(interpretContentApiError(new Error('network')).message).toMatch(/temporarily unavailable/)
    expect(interpretContentApiError(apiError(409, 'x', 'status')).field).toBeNull()
  })
})

describe('create draft form', () => {
  it('checks only that required fields are present', () => {
    expect(missingContentCreateFields({ content_type: '', title: ' ', slug: '', summary: '' }))
      .toEqual({ content_type: 'Select a content type.', title: 'Enter a title.', slug: 'Enter a slug.' })
    expect(missingContentCreateFields({ content_type: 'blog', title: 'T', slug: 's', summary: '' })).toHaveProperty('content_type')
    // Slug format is the BFF's rule, not the form's.
    expect(missingContentCreateFields({ content_type: 'news', title: 'T', slug: 'Not A Slug', summary: '' })).toEqual({})
  })

  it('sends only the four create fields', () => {
    expect(contentCreateRequestBody({ content_type: 'news', title: ' T ', slug: ' s ', summary: '' }))
      .toEqual({ content_type: 'news', title: 'T', slug: 's' })
    expect(Object.keys(contentCreateRequestBody({ content_type: 'news', title: 'T', slug: 's', summary: 'S' })).sort())
      .toEqual(['content_type', 'slug', 'summary', 'title'])
  })
})

describe('overview summaries use real draft fields only', () => {
  const locale = (overrides: Record<string, unknown>) => ({
    id: 1, content_items_id: 1, locale: 'en', title: 'T', slug: 's', summary: null, blocks: [],
    seo_title: null, seo_description: null, canonical_path: null, noindex: false,
    draft_revision: 1, published_revision: null, published_at: null, first_published_at: null, last_change_kind: 'manual_edit',
    ...overrides,
  }) as AdminContentDraft['locales'][number]

  it('derives locale states per Blueprint §8.1', () => {
    expect(contentLocaleState(null)).toBe('not_started')
    expect(contentLocaleState({ draft_revision: 3, published_revision: null })).toBe('draft')
    expect(contentLocaleState({ draft_revision: 3, published_revision: 3 })).toBe('published')
    expect(contentLocaleState({ draft_revision: 4, published_revision: 3 })).toBe('published_with_changes')
    const rows = contentLocaleSummary({ locales: [locale({ draft_revision: 2 })] })
    expect(rows.map(r => [r.code, r.stateLabel, r.draftRevision, r.isDefault])).toEqual([
      ['en', 'Draft', 2, true], ['es', 'Not started', null, false], ['pt', 'Not started', null, false],
    ])
  })

  it('counts sections by type and reports SEO presence', () => {
    const row = locale({
      blocks: [
        { id: 'a', type: 'text', data: {} }, { id: 'b', type: 'text', data: {} }, { id: 'c', type: 'faq', data: {} },
      ],
      seo_title: 'SEO', noindex: true,
    })
    expect(contentBlockSummary(row)).toEqual({ total: 3, byType: [{ type: 'text', label: 'Text', count: 2 }, { type: 'faq', label: 'FAQ', count: 1 }] })
    expect(contentBlockSummary(null)).toEqual({ total: 0, byType: [] })
    expect(contentSeoSummary(row)).toEqual({ seoTitle: true, seoDescription: false, canonicalOverride: false, noindex: true })
  })

  it('never states a readiness score or an AI result', () => {
    expect(CONTENT_READINESS_UNAVAILABLE).toBe('Not available yet')
    expect(CONTENT_AI_UNAVAILABLE).toBe('AI workflow not configured')
  })
})

describe('source evidence — scope and safety', () => {
  it('enables the existing Content Center shell entry and adds no other menu', () => {
    const layout = repoFile('layouts/admin.vue')
    expect(layout).toMatch(/<NuxtLink\s+to="\/admin\/content-center"/)
    expect(layout).not.toContain('Available after Phase 9A-2')
    expect(layout).not.toContain('nav-item--disabled"')
    const labels = [...layout.matchAll(/<\/svg>\s*([A-Za-z ]+?)\s*<\/(?:NuxtLink|span)>/g)].map(m => m[1])
    expect(labels).toEqual(['Product Center', 'Content Center', 'Media Library', 'Settings'])
  })

  it('reads, creates and saves drafts only through the admin BFF; no publish, AI, media-write or Directus call', () => {
    for (const file of UI_FILES) {
      const source = repoFile(file)
      // `directus_files_id` is a Media Library reference field name, not a Directus call.
      expect(source, file).not.toMatch(/\/items\/|directusUrl|directusToken|localhost:8055/i)
      expect(source, file).not.toMatch(/publish'|\/publish|\/unpublish|\/archive|\/restore|\/ai\/|proposal/i)
      expect(source, file).not.toMatch(/method:\s*'DELETE'/)
    }
    // CC-IMP-05 — the only other POST is an explicit "Start locale" in SEO & Locales.
    const posts = UI_FILES.filter(file => /method:\s*'POST'/.test(repoFile(file)))
    expect(posts).toEqual(['components/admin/content/ContentCreateForm.vue', 'components/admin/content/ContentSeoLocales.vue'])
    const patches = UI_FILES.filter(file => /method:\s*'PATCH'/.test(repoFile(file)))
    expect(patches).toEqual(['components/admin/content/ContentEditor.vue'])
    const puts = UI_FILES.filter(file => /method:\s*'PUT'/.test(repoFile(file)))
    expect(puts).toEqual(['components/admin/content/ContentMediaRelations.vue', 'components/admin/content/ContentSeoLocales.vue'])
    expect(repoFile('components/admin/content/ContentCreateForm.vue')).toContain("$fetch<AdminContentDraft>('/api/admin/content-center', {")
  })

  it('the Overview and the list body issue no request at all', () => {
    for (const file of ['components/admin/content/ContentOverview.vue', 'components/admin/content/ContentList.vue', 'components/admin/content/ContentWorkspaceNav.vue', 'components/admin/content/ContentWorkspaceShell.vue']) {
      expect(repoFile(file), file).not.toMatch(/\$fetch|useFetch/)
    }
  })

  it('shows no percentage, score or confidence and no visible Chinese', () => {
    for (const file of UI_FILES) {
      const template = repoFile(file).split('<template>').slice(1).join('<template>').split('<style')[0]
      expect(template, file).not.toMatch(/%|score|confidence/i)
      expect(repoFile(file), file).not.toMatch(/[一-鿿]/)
    }
  })

  it('the Overview page distinguishes loading, not found and load failure', () => {
    const page = repoFile('pages/admin/content-center/[id]/overview.vue')
    expect(page).toContain('Loading content record…')
    expect(page).toContain('errorStatus.value === 404 || errorStatus.value === 400')
    expect(page).toContain('Content not found')
    expect(page).toContain('This content record could not be loaded')
    expect(page).toContain('@click="refresh()"')
  })

  it('successful create opens the new record Overview', () => {
    expect(repoFile('pages/admin/content-center/new.vue')).toContain('navigateTo(contentOverviewRoute(id))')
    expect(repoFile('pages/admin/content-center/new.vue')).toContain('<ContentCreateForm @created="openCreated" />')
  })
})
