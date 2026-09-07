/**
 * PWS-00A — read-only Product Workspace Shell + Overview.
 *
 * Pure helpers are imported from utils/productWorkspace.ts and utils/productCentre.ts —
 * the SAME modules the new Vue components import, so these tests exercise production
 * code rather than a copy of it. Behaviour that only exists inside .vue templates is
 * verified through source-evidence assertions, as established by
 * tests/productCentreView.test.ts and tests/assetProxy.test.ts.
 *
 * This module never writes: no fixture here calls a mutating HTTP method, and every
 * source-evidence check below confirms the new UI issues none either.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  WORKSPACE_MODULE_GROUPS,
  WORKSPACE_MODULE_NAV,
  WORKSPACE_READINESS_UNAVAILABLE,
  workspaceCategoryName,
  workspaceHeroUrl,
  sourceFileTypeLabel,
  sourceReviewStatusLabel,
  fileRoleLabel,
  workspaceMediaThumbUrl,
  workspaceMediaIsImage,
} from '../utils/productWorkspace'
import {
  productDetailRoute,
  workspaceOverviewRoute,
  workspacePageContentRoute,
  workspaceSourcesEvidenceRoute,
  workspaceSpecificationsRoute,
  workspaceMediaResourcesRoute,
} from '../utils/productCentre'
import type { AdminProduct } from '../types/product-cms'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

function renderedMarkup(source: string): string {
  // lastIndexOf, not indexOf: a component may use Vue's <template v-if="..."> grouping
  // fragments inside its real template, which close with an earlier </template>.
  return source
    .slice(source.indexOf('<template>'), source.lastIndexOf('</template>'))
    .replace(/<!--[\s\S]*?-->/g, '')
}

const NEW_FILES = [
  'pages/admin/product-workspace/[id]/overview.vue',
  'components/admin/workspace/WorkspaceShell.vue',
  'components/admin/workspace/WorkspaceModuleNav.vue',
  'components/admin/workspace/WorkspaceOverview.vue',
]

const PWS07_FILES = [
  'pages/admin/product-workspace/[id]/sources-evidence.vue',
  'components/admin/workspace/WorkspaceSourcesEvidence.vue',
]

function baseProduct(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: 42,
    status: 'draft',
    slug: 'lt-180c',
    name_en: 'LT-180C Free-Fall Metal Detector',
    name_es: null,
    name_pt: null,
    product_code: 'LT-180C',
    model_or_series: 'LT series',
    summary_en: 'High-sensitivity free-fall metal detector.',
    summary_es: null,
    summary_pt: null,
    category_id: 3,
    page_preset_id: null,
    published_at: null,
    review_notes: null,
    date_created: null,
    date_updated: null,
    hero_image: null,
    seo_title_en: null,
    seo_description_en: null,
    seo_noindex: null,
    ...overrides,
  }
}

// ── 1/2. Route helpers ────────────────────────────────────────────────────────

describe('Workspace route helper (parallel to the legacy editor route)', () => {
  it('generates the frozen PWS-00 route', () => {
    expect(workspaceOverviewRoute(42)).toBe('/admin/product-workspace/42/overview')
    expect(workspaceOverviewRoute('42')).toBe('/admin/product-workspace/42/overview')
  })

  it('does not change productDetailRoute() — the legacy editor stays the sole write surface', () => {
    expect(productDetailRoute(42)).toBe('/admin/products/42')
  })
})

// ── 3. Product Control keeps both entry points ───────────────────────────────

describe('Product Control — parallel entry points (source evidence)', () => {
  const source = repoFile('components/admin/product/ProductControlPanel.vue')

  it('keeps the existing legacy "Open product record" action untouched', () => {
    expect(source).toContain('Open product record')
    expect(source).toContain('productDetailRoute(product.id)')
  })

  it('adds the new read-only Workspace entry point alongside it, not in place of it', () => {
    expect(source).toContain('Open Workspace (read-only)')
    expect(source).toContain('workspaceOverviewRoute(product.id)')
  })

  // ── PWS-00A-SCOPE-CORRECT-01 regression guards ──────────────────────────

  it('legacy "Open product record" keeps its exact cb15c42 class list — never the new generic .btn* rules', () => {
    const legacyLinkMatch = source.match(
      /<NuxtLink :to="productDetailRoute\(product\.id\)" class="([^"]+)">/,
    )
    expect(legacyLinkMatch).not.toBeNull()
    expect(legacyLinkMatch![1]).toBe('btn btn-primary btn-full')
  })

  it('legacy route target is still exactly /admin/products/:id (productDetailRoute unchanged)', () => {
    expect(productDetailRoute(7)).toBe('/admin/products/7')
  })

  it('the Workspace entry point uses a dedicated class, never the legacy btn/btn-primary/btn-secondary classes', () => {
    const workspaceLinkMatch = source.match(
      /<NuxtLink :to="workspaceOverviewRoute\(product\.id\)" class="([^"]+)">/,
    )
    expect(workspaceLinkMatch).not.toBeNull()
    expect(workspaceLinkMatch![1]).toBe('workspace-entry-link')
    expect(workspaceLinkMatch![1]).not.toMatch(/\bbtn\b/)
  })

  it('defines no generic .btn / .btn-primary / .btn-secondary rule that could style the legacy link', () => {
    expect(source).not.toMatch(/(?<!-)\.btn\s*\{/)
    expect(source).not.toMatch(/\.btn-primary\s*\{/)
    expect(source).not.toMatch(/\.btn-secondary\s*\{/)
  })

  it('the new entry point style is scoped to its own selector only', () => {
    expect(source).toContain('.workspace-entry-link {')
    expect(source).toContain('.workspace-entry-link:hover')
  })

  it('never uses inline style for the new Workspace entry point', () => {
    const workspaceLinkTag = source.slice(
      source.indexOf('<NuxtLink :to="workspaceOverviewRoute(product.id)"'),
      source.indexOf('</NuxtLink>', source.indexOf('workspaceOverviewRoute(product.id)')),
    )
    expect(workspaceLinkTag).not.toContain('style=')
  })

  it('.panel-actions and .btn-full keep their exact cb15c42 declarations — no reintroduced flex/gap/min-height', () => {
    const panelActionsBlock = source.slice(
      source.indexOf('.panel-actions {'),
      source.indexOf('}', source.indexOf('.panel-actions {')) + 1,
    )
    expect(panelActionsBlock).not.toContain('display: flex')
    expect(panelActionsBlock).not.toContain('flex-direction: column')
    expect(panelActionsBlock).not.toContain('gap:')

    const btnFullBlock = source.slice(
      source.indexOf('.btn-full {'),
      source.indexOf('}', source.indexOf('.btn-full {')) + 1,
    )
    expect(btnFullBlock).not.toContain('min-height')
  })
})

// ── 4. New page composes the shell, module nav and overview ─────────────────

describe('New PWS-00 page composition (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/overview.vue')

  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspaceOverview', () => {
    expect(page).toContain('WorkspaceShell')
    expect(page).toContain('WorkspaceModuleNav')
    expect(page).toContain('WorkspaceOverview')
  })

  it('reads the same canonical product id used by the legacy route', () => {
    expect(page).toContain("route.params.id")
    expect(page).toContain('/api/admin/products/')
  })
})

// ── 5. Overview shows only the allowed real fields ───────────────────────────

describe('Overview field scope (source evidence)', () => {
  const source = repoFile('components/admin/workspace/WorkspaceOverview.vue')

  it('shows every allowed canonical field', () => {
    expect(source).toContain('name_en')
    expect(source).toContain('product_code')
    expect(source).toContain('model_or_series')
    expect(source).toContain('categoryName')
    expect(source).toContain('summary_en')
    expect(source).toContain('heroUrl')
    expect(source).toContain('product.status')
  })

  it('never displays Assigned language, Tasks, sources, confidence or AI conclusions', () => {
    const lower = source.toLowerCase()
    expect(lower).not.toContain('assigned language')
    expect(lower).not.toContain('task')
    expect(lower).not.toContain('confidence')
    expect(lower).not.toContain('source review')
    expect(lower).not.toContain(' ai ')
  })

  it('shows a neutral empty state instead of a fabricated hero image', () => {
    expect(source).toContain('No hero image linked')
  })
})

// ── 6. Exact Readiness literal ────────────────────────────────────────────────

describe('Readiness — exact mandated text (Register §12.1i / PWS-DOR-02)', () => {
  it('is exactly the mandated string', () => {
    expect(WORKSPACE_READINESS_UNAVAILABLE).toBe('Not assessed — rule not configured')
  })

  it('carries no digit, percentage, or score', () => {
    expect(WORKSPACE_READINESS_UNAVAILABLE).not.toMatch(/\d/)
    expect(WORKSPACE_READINESS_UNAVAILABLE).not.toContain('%')
  })

  it('the Overview component renders it verbatim and never a computed value', () => {
    const source = repoFile('components/admin/workspace/WorkspaceOverview.vue')
    expect(source).toContain('WORKSPACE_READINESS_UNAVAILABLE')
    expect(renderedMarkup(source)).not.toMatch(/\d+\s*%/)
  })

  it('does not mark CH-DG-11, BP-DG-02 or BP-DG-10 as resolved', () => {
    for (const file of NEW_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toMatch(/ch-dg-11.*(resolved|met)/)
      expect(lower).not.toMatch(/bp-dg-0?2.*(resolved|met)/)
      expect(lower).not.toMatch(/bp-dg-10.*(resolved|met)/)
    }
  })
})

// ── 7. No AI affordance anywhere in the new UI ───────────────────────────────

describe('No AI surface in PWS-00 (source evidence)', () => {
  it('no new file renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of NEW_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
    }
  })
})

// ── 8. Save / Submit are disabled ────────────────────────────────────────────

describe('Save and Submit are native-disabled (source evidence)', () => {
  const source = repoFile('components/admin/workspace/WorkspaceShell.vue')
  const template = source.slice(source.indexOf('<template>'), source.indexOf('</template>'))

  it('renders Save changes as a disabled button with a visible reason when saveState is unavailable (PWS-00, Sources & evidence default)', () => {
    const saveBlock = template.slice(template.indexOf('Save changes') - 300, template.indexOf('Save changes'))
    expect(saveBlock).toContain('disabled')
    expect(saveBlock).toMatch(/title="[^"]+"/)
    expect(saveBlock).toContain("saveState === 'unavailable'")
  })

  it("defaults saveState to 'unavailable' so tabs that don't pass it keep the exact original disabled button", () => {
    expect(source).toContain("{ saveState: 'unavailable' }")
  })

  it('the shared Shell header no longer renders Submit for review — PWS-VISUAL-ALIGN-01 moved it into Overview\'s Lifecycle card, matching PW-VIS-01/03/04/05/06/07/09', () => {
    expect(template).not.toContain('Submit for review')
  })

  it('renders no lifecycle transition control (draft/review/published/archived actions) in the shared header', () => {
    const lower = source.toLowerCase()
    expect(lower).not.toContain('publish')
  })

  it('Preview reuses the existing read-only Admin preview route', () => {
    expect(source).toContain('previewHref')
    expect(repoFile('pages/admin/product-workspace/[id]/overview.vue')).toContain('/preview')
  })
})

describe('Submit for review lives on Overview only, inside the Lifecycle card (source evidence)', () => {
  const overview = repoFile('components/admin/workspace/WorkspaceOverview.vue')
  const overviewTemplate = overview.slice(overview.indexOf('<template>'), overview.indexOf('</template>'))

  it('renders Submit for review as a disabled button with a visible reason', () => {
    const idx = overviewTemplate.indexOf('Submit for review')
    const submitBlock = overviewTemplate.slice(idx - 60, idx + 250)
    expect(submitBlock).toContain('disabled')
    expect(submitBlock).toMatch(/title="[^"]+"/)
  })

  it('sits inside the Lifecycle status card, not a standalone control', () => {
    const lifecycleBlock = overviewTemplate.slice(
      overviewTemplate.indexOf('ws-lifecycle-heading'),
      overviewTemplate.indexOf('Submit for review'),
    )
    expect(lifecycleBlock.length).toBeGreaterThan(0)
    expect(lifecycleBlock).toContain('StatusBadge')
  })
})

// ── 9/10. Module nav — disabled buttons, accordion, no <select> ─────────────

describe('Workspace module navigation (source evidence)', () => {
  const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')

  it('defines all nine PWS-00…PWS-08 addresses with only the five landed modules enabled', () => {
    expect(WORKSPACE_MODULE_NAV).toHaveLength(9)
    const enabled = WORKSPACE_MODULE_NAV.filter(i => i.enabled).map(i => i.key)
    expect(enabled).toEqual(['overview', 'page-content', 'specifications', 'media-resources', 'sources-evidence'])
  })

  it('groups modules under the three frozen headings', () => {
    expect(WORKSPACE_MODULE_GROUPS).toEqual(['PRODUCT RECORD', 'PUBLISH & DISTRIBUTE', 'CONTROL'])
  })

  it('renders unimplemented modules as native-disabled buttons, never as links', () => {
    expect(source).toContain('disabled')
    expect(source).not.toMatch(/<NuxtLink[^>]*disabled/)
  })

  it('never renders a <select> as a substitute for the module navigation', () => {
    expect(source.toLowerCase()).not.toContain('<select')
  })

  it('uses an accessible accordion disclosure pattern', () => {
    expect(source).toContain('aria-expanded')
    expect(source).toContain('aria-controls')
  })

  it('disabled modules carry a not-yet-available reason and never navigate', () => {
    expect(source).toContain('is not yet available')
  })
})

// ── 11. No write request anywhere in the new surface ─────────────────────────

describe('No write request in the new Workspace surface (source evidence)', () => {
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/i

  it('no new file issues a POST, PATCH, PUT or DELETE request', () => {
    for (const file of [...NEW_FILES]) {
      expect(repoFile(file)).not.toMatch(WRITE_METHOD_RE)
    }
  })

  it('the modified Product Control panel gained no new write request', () => {
    const source = repoFile('components/admin/product/ProductControlPanel.vue')
    expect(source).not.toMatch(WRITE_METHOD_RE)
  })

  it('the new page only ever calls useFetch for reads', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/overview.vue')
    const fetchCalls = page.match(/useFetch[^\n]*/g) ?? []
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) expect(call).not.toMatch(WRITE_METHOD_RE)
  })
})

// ── 12. Invalid product id shows a real empty state ──────────────────────────

describe('Invalid product id (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/overview.vue')

  it('renders a "Product not found" empty state rather than a blank form', () => {
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })

  it('the not-found branch never renders the editable Shell/Overview tree', () => {
    const notFoundBlock = page.slice(page.indexOf('v-if="notFound"'), page.indexOf('</div>', page.indexOf('v-if="notFound"')))
    expect(notFoundBlock).not.toContain('WorkspaceShell')
    expect(notFoundBlock).not.toContain('WorkspaceOverview')
  })
})

// ── Helper coverage ────────────────────────────────────────────────────────────

describe('workspaceCategoryName / workspaceHeroUrl (pure helpers)', () => {
  it('resolves a real category name from the shared category list', () => {
    const product = baseProduct({ category_id: 3 })
    expect(workspaceCategoryName(product, [{ id: 3, name_en: 'Metal detection equipment' }])).toBe(
      'Metal detection equipment',
    )
  })

  it('reports an honest fallback when no category is set', () => {
    const product = baseProduct({ category_id: null })
    expect(workspaceCategoryName(product, [])).toBe('Not set')
  })

  it('returns null (never a fabricated image) when no hero is linked', () => {
    const product = baseProduct({ hero_image: null })
    expect(workspaceHeroUrl(product)).toBeNull()
  })

  it('builds the hero URL through the same hardened asset proxy as Product Control', () => {
    const product = baseProduct({ hero_image: 'abc-123' })
    expect(workspaceHeroUrl(product)).toContain('/api/admin/asset/abc-123')
  })
})

// ── English-first (new surface only) ──────────────────────────────────────────

describe('PWS-00 surface is English-first (source evidence)', () => {
  it('no new file has visible or assistive Chinese in its template', () => {
    for (const file of NEW_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

// ── PWS-07 — Sources & Evidence (read-only, PWS-07-FAST-01R) ─────────────────

describe('PWS-07 module is enabled and routable (source evidence)', () => {
  it('enables sources-evidence without touching any module flag beyond the landed set', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey['sources-evidence']).toBe(true)
    expect(byKey.overview).toBe(true)
    expect(byKey['page-content']).toBe(true)
    expect(byKey.specifications).toBe(true)
    for (const key of ['relations', 'seo-locales', 'share-distribution', 'change-history']) {
      expect(byKey[key]).toBe(false)
    }
  })

  it('workspaceSourcesEvidenceRoute builds the frozen PWS-07 route', () => {
    expect(workspaceSourcesEvidenceRoute(42)).toBe('/admin/product-workspace/42/sources-evidence')
  })

  it('the module nav links enabled, non-active items with a real NuxtLink', () => {
    const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')
    expect(source).toContain('workspaceSourcesEvidenceRoute')
    expect(source).toContain('workspaceOverviewRoute')
  })
})

describe('sourceReviewStatusLabel / sourceFileTypeLabel (pure helpers)', () => {
  it('maps every enum value to clear English text without changing the enum itself', () => {
    expect(sourceReviewStatusLabel('confirmed')).toBe('Verified')
    expect(sourceReviewStatusLabel('needs_review')).toBe('Needs review')
    expect(sourceReviewStatusLabel('missing')).toBe('Needs review')
    expect(sourceReviewStatusLabel('conflict')).toBe('Needs review')
  })

  it('treats null/unset as the honest default: Pending verification', () => {
    expect(sourceReviewStatusLabel(null)).toBe('Pending verification')
  })

  it('maps common MIME types to friendly labels, never a raw MIME string', () => {
    expect(sourceFileTypeLabel('application/pdf')).toBe('PDF')
    expect(sourceFileTypeLabel('image/jpeg')).toBe('Image')
    expect(sourceFileTypeLabel(null)).toBe('File')
    expect(sourceFileTypeLabel('application/octet-stream')).not.toContain('/')
  })
})

describe('PWS-07 page composition (source evidence)', () => {
  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspaceSourcesEvidence', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('<WorkspaceShell')
    expect(page).toContain('<WorkspaceModuleNav')
    expect(page).toContain('<WorkspaceSourcesEvidence')
    expect(page).toContain('active-key="sources-evidence"')
  })

  it('reads the same canonical product id and fetches sources for it', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('route.params.id')
    expect(page).toContain('/api/admin/products/${id}/sources')
  })

  it('renders a "Product not found" empty state rather than a blank form', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })
})

describe('PWS-07 never exposes restricted fields (source evidence)', () => {
  it('the page and component never render raw_excerpt, source_locator, note or a file UUID field', () => {
    for (const file of PWS07_FILES) {
      const source = repoFile(file)
      expect(source).not.toContain('raw_excerpt')
      expect(source).not.toContain('source_locator')
      expect(source).not.toMatch(/\bnote\b/)
      expect(source).not.toContain('source_file_id')
    }
  })

  it('the API response type never carries raw_excerpt, source_locator, note or the file UUID', () => {
    const api = repoFile('server/api/admin/products/[id]/sources/index.get.ts')
    const interfaceBlock = api.slice(
      api.indexOf('interface SourceRecordSummary'),
      api.indexOf('}', api.indexOf('interface SourceRecordSummary')),
    )
    expect(interfaceBlock).not.toContain('raw_excerpt')
    expect(interfaceBlock).not.toContain('source_locator')
    expect(interfaceBlock).not.toMatch(/\bnote\b/)
    expect(interfaceBlock).not.toContain('source_file_id')
  })

  it('the GET endpoint only ever deep-fetches the file relation via dot-notation, never the bare field', () => {
    const api = repoFile('server/api/admin/products/[id]/sources/index.get.ts')
    expect(api).not.toMatch(/'id',\s*'product_id',[^\]]*'source_file_id'/)
    expect(api).toContain("'source_file_id.filename_download'")
  })

  it('never renders a download link, direct file URL, or original-file preview', () => {
    for (const file of PWS07_FILES) {
      const source = repoFile(file)
      // The security footnote is allowed to say the word "download" in prose
      // (mirroring the frozen visual master's own disclaimer); no actual
      // download affordance (link, href, asset proxy call) may exist.
      expect(source).not.toMatch(/<a\s[^>]*href/)
      expect(source).not.toContain('/api/admin/asset/')
      expect(source.toLowerCase()).not.toMatch(/>\s*download\s*</)
    }
  })
})

describe('PWS-07 has no working write affordance (source evidence)', () => {
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/i

  it('no PWS-07 file issues a POST, PATCH, PUT or DELETE request', () => {
    for (const file of PWS07_FILES) {
      expect(repoFile(file)).not.toMatch(WRITE_METHOD_RE)
    }
  })

  it('the sources GET endpoint issues no write request', () => {
    expect(repoFile('server/api/admin/products/[id]/sources/index.get.ts')).not.toMatch(WRITE_METHOD_RE)
  })

  it('renders no Save, Archive, Edit or AI Fill button', () => {
    for (const file of PWS07_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('archive')
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toMatch(/>\s*edit\s*</)
      expect(lower).not.toMatch(/>\s*save\s*</)
    }
  })

  it('no new file renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of PWS07_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('pws-ai')
    }
  })
})

describe('PWS-07 honest empty state and 375px card layout (source evidence)', () => {
  it('shows an honest empty state when no source records exist', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSourcesEvidence.vue')
    expect(component).toMatch(/sources\.length === 0/)
    expect(component).toContain('No sources recorded for this product yet.')
  })

  it('never fabricates a source row when the list is empty', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSourcesEvidence.vue')
    expect(component).not.toContain('DS_LT-180C')
    expect(component).not.toContain('Technical datasheet')
  })

  it('the 375px breakpoint turns the table into stacked cards, never a horizontally scrolling grid', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSourcesEvidence.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('display: block')
    expect(mobileBlock).not.toContain('overflow-x: auto')
  })
})

describe('PWS-07 is English-first and carries no Chinese (source evidence)', () => {
  it('no PWS-07 file has visible or assistive Chinese in its template', () => {
    for (const file of PWS07_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

// ── PWS-01 — Page Content (editable, PWS-01-FAST-01) ─────────────────────────

const PWS01_FILES = [
  'pages/admin/product-workspace/[id]/page-content.vue',
  'components/admin/workspace/WorkspacePageContent.vue',
]

describe('PWS-01 module is enabled and routable (source evidence)', () => {
  it('enables page-content without disabling any already-landed module', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey['page-content']).toBe(true)
    expect(byKey.overview).toBe(true)
    expect(byKey['sources-evidence']).toBe(true)
    for (const key of ['relations', 'seo-locales', 'share-distribution', 'change-history']) {
      expect(byKey[key]).toBe(false)
    }
  })

  it('workspacePageContentRoute builds the frozen PWS-01 route', () => {
    expect(workspacePageContentRoute(42)).toBe('/admin/product-workspace/42/page-content')
  })

  it('the module nav links page-content alongside the other two enabled modules', () => {
    const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')
    expect(source).toContain('workspacePageContentRoute')
  })
})

describe('PWS-01 page composition (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/page-content.vue')

  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspacePageContent', () => {
    expect(page).toContain('<WorkspaceShell')
    expect(page).toContain('<WorkspaceModuleNav')
    expect(page).toContain('<WorkspacePageContent')
    expect(page).toContain('active-key="page-content"')
  })

  it('reads the same canonical product id for every read and write', () => {
    expect(page).toContain('route.params.id')
    expect(page).toContain('/api/admin/products/${id}/sections')
    expect(page).toContain('/api/admin/products/${id}/faq')
    // Every write call must target the same productId derived from the route — never a
    // second, hardcoded, or cross-product id.
    expect(page).not.toMatch(/\/api\/admin\/products\/\d+\//)
  })

  it('renders a "Product not found" empty state rather than a blank form', () => {
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })
})

describe('PWS-01 issues no write request on load, only on explicit Save (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/page-content.vue')
  const component = repoFile('components/admin/workspace/WorkspacePageContent.vue')
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/g

  it('the presentational component never issues a write request itself', () => {
    expect(component).not.toMatch(WRITE_METHOD_RE)
  })

  it('every write call in the page lives inside handleSave(), never at top-level/mount time', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function handleSave'))
    expect(initialFetchBlock).not.toMatch(WRITE_METHOD_RE)

    const saveBlock = page.slice(page.indexOf('async function handleSave'), page.indexOf('</script>'))
    const writeCalls = [...saveBlock.matchAll(WRITE_METHOD_RE)]
    expect(writeCalls.length).toBeGreaterThan(0)
  })

  it('the top-level data fetch only ever calls useFetch (GET), never $fetch with a write method', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function handleSave'))
    const fetchCalls = initialFetchBlock.match(/useFetch[^\n]*/g) ?? []
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) expect(call).not.toMatch(WRITE_METHOD_RE)
  })

  it('Save changes is wired through the shared WorkspaceShell save event, not a local button', () => {
    expect(page).toContain('@save="handleSave"')
    expect(page).toContain(':save-state="saveState"')
  })

  it('save only runs when there are local changes and not already saving', () => {
    expect(page).toContain('if (!isDirty.value || saving.value) return')
  })
})

describe('PWS-01 stays within legacy-proven fields and module types (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspacePageContent.vue')
  const page = repoFile('pages/admin/product-workspace/[id]/page-content.vue')

  it('never references a section field beyond type/title_en/enabled — the legacy editor never exposed body/eyebrow/media/layout editing', () => {
    for (const file of [component, page]) {
      expect(file).not.toContain('body_en')
      expect(file).not.toContain('eyebrow_en')
      expect(file).not.toContain('layout_variant')
      expect(file).not.toContain('media_id')
      expect(file).not.toContain('external_url')
    }
  })

  it('imports SECTION_TYPES from the canonical type module rather than inventing a new module-type list', () => {
    expect(page).toContain("import { SECTION_TYPES } from '~/types/product-cms'")
  })

  it('never mutates props directly — every edit is emitted up to the page that owns the data', () => {
    expect(component).not.toMatch(/defineProps[\s\S]*?\bsections\[[^\]]*\]\s*\.\s*\w+\s*=/)
    expect(component).toContain('defineEmits')
  })
})

describe('PWS-01 has no AI surface and no lifecycle/publish control (source evidence)', () => {
  it('no PWS-01 file renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of PWS01_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
    }
  })

  it('never calls a publish, submit-for-review, or lifecycle-status endpoint', () => {
    for (const file of PWS01_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('submit for review')
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain('status: \'published\'')
    }
  })
})

describe('PWS-01 honest empty states and dirty/save states (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspacePageContent.vue')

  it('shows an honest empty state for modules and FAQ when there is no data', () => {
    expect(component).toContain('No page content modules for this product yet.')
    expect(component).toContain('No FAQ entries for this product yet.')
  })

  it('never fabricates a section or FAQ row when the list is empty', () => {
    expect(component).not.toContain('LT-180C')
    expect(component).not.toContain('Free-Fall')
  })

  it('marks unsaved new rows and pending deletions distinctly', () => {
    expect(component).toContain('New — not saved yet')
    expect(component).toContain('Will be removed on Save')
  })
})

describe('PWS-01 375px stacking, no horizontal overflow substitute (source evidence)', () => {
  it('the 375px breakpoint stacks controls in a column, never a horizontally scrolling table', () => {
    const component = repoFile('components/admin/workspace/WorkspacePageContent.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('flex-direction: column')
    expect(mobileBlock).not.toContain('overflow-x: auto')
    expect(component.toLowerCase()).not.toContain('<table')
  })
})

describe('PWS-01 is English-first and carries no Chinese (source evidence)', () => {
  it('no PWS-01 file has visible or assistive Chinese in its template', () => {
    for (const file of PWS01_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

describe('WorkspaceShell save-state extension keeps other tabs byte-identical by default (source evidence)', () => {
  it('Overview and Sources & evidence pages never pass a save-state, so they keep the original disabled button', () => {
    for (const file of [...NEW_FILES.filter(f => f.includes('overview')), 'pages/admin/product-workspace/[id]/sources-evidence.vue']) {
      expect(repoFile(file)).not.toContain('save-state')
    }
  })
})

// ── PWS-VISUAL-ALIGN-01 — module-name H1 per PW-VIS-02…09 (source evidence) ──

describe('WorkspaceShell H1 is the module name, not the product name (source evidence)', () => {
  const shell = repoFile('components/admin/workspace/WorkspaceShell.vue')

  it('requires a title prop and renders it as the H1 — every PRIMARY master except Overview shows the module name here', () => {
    expect(shell).toMatch(/title:\s*string/)
    const template = shell.slice(shell.indexOf('<template>'), shell.indexOf('</template>'))
    const h1Block = template.slice(template.indexOf('<h1'), template.indexOf('</h1>'))
    expect(h1Block).toContain('{{ title }}')
    expect(h1Block).not.toContain('product.name_en')
    // The breadcrumb's last segment legitimately still shows the product name — untouched.
    expect(template).toContain('{{ product.name_en }}')
  })

  it('Overview passes the real product name as the title (its title happens to equal the product name)', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/overview.vue')
    expect(page).toMatch(/:title="\(product as AdminProduct\)\.name_en"/)
  })

  it('Page content and Sources & evidence pass their own module name, never the product name', () => {
    const pageContent = repoFile('pages/admin/product-workspace/[id]/page-content.vue')
    const sources = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(pageContent).toContain('title="Page content"')
    expect(sources).toContain('title="Sources & evidence"')
  })
})

// ── PWS-02 — Specifications (editable, PWS-02-FAST-01) ───────────────────────

const PWS02_FILES = [
  'pages/admin/product-workspace/[id]/specifications.vue',
  'components/admin/workspace/WorkspaceSpecifications.vue',
]

describe('PWS-02 module is enabled and routable (source evidence)', () => {
  it('enables specifications without disabling any already-landed module', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey.specifications).toBe(true)
    expect(byKey.overview).toBe(true)
    expect(byKey['page-content']).toBe(true)
    expect(byKey['sources-evidence']).toBe(true)
    for (const key of ['relations', 'seo-locales', 'share-distribution', 'change-history']) {
      expect(byKey[key]).toBe(false)
    }
  })

  it('workspaceSpecificationsRoute builds the frozen PWS-02 route', () => {
    expect(workspaceSpecificationsRoute(42)).toBe('/admin/product-workspace/42/specifications')
  })

  it('the module nav links specifications alongside the other landed modules', () => {
    const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')
    expect(source).toContain('workspaceSpecificationsRoute')
  })

  it('the "Specifications" label is never abbreviated in the nav source', () => {
    const source = repoFile('utils/productWorkspace.ts')
    expect(source).toContain("label: 'Specifications'")
    expect(source).not.toMatch(/label:\s*'S\.\.\.'/)
  })
})

describe('PWS-02 page composition (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/specifications.vue')

  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspaceSpecifications', () => {
    expect(page).toContain('<WorkspaceShell')
    expect(page).toContain('<WorkspaceModuleNav')
    expect(page).toContain('<WorkspaceSpecifications')
    expect(page).toContain('active-key="specifications"')
    expect(page).toContain('title="Specifications"')
  })

  it('reads the same canonical product id for every read and write, never a second product', () => {
    expect(page).toContain('route.params.id')
    expect(page).toContain('/api/admin/products/${id}/specs')
    // Every write call must target the same productId derived from the route.
    expect(page).not.toMatch(/\/api\/admin\/products\/\d+\//)
  })

  it('reuses the canonical ProductSpecGroup/ProductSpecItem types, never a new parallel model', () => {
    expect(page).toContain("import type { AdminProduct, ProductSpecGroup, ProductSpecItem } from '~/types/product-cms'")
  })

  it('renders a "Product not found" empty state rather than a blank form', () => {
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })
})

describe('PWS-02 issues no write request on load, only on explicit Save (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/specifications.vue')
  const component = repoFile('components/admin/workspace/WorkspaceSpecifications.vue')
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/g

  it('the presentational component never issues a write request itself', () => {
    expect(component).not.toMatch(WRITE_METHOD_RE)
  })

  it('every write call in the page lives inside handleSave(), never at top-level/mount time', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function handleSave'))
    expect(initialFetchBlock).not.toMatch(WRITE_METHOD_RE)

    const saveBlock = page.slice(page.indexOf('async function handleSave'), page.indexOf('</script>'))
    const writeCalls = [...saveBlock.matchAll(WRITE_METHOD_RE)]
    expect(writeCalls.length).toBeGreaterThan(0)
  })

  it('the top-level data fetch only ever calls useFetch (GET), never $fetch with a write method', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function handleSave'))
    const fetchCalls = initialFetchBlock.match(/useFetch[^\n]*/g) ?? []
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) expect(call).not.toMatch(WRITE_METHOD_RE)
  })

  it('Save changes is wired through the shared WorkspaceShell save event, not a local button', () => {
    expect(page).toContain('@save="handleSave"')
    expect(page).toContain(':save-state="saveState"')
  })

  it('save only runs when there are local changes and not already saving', () => {
    expect(page).toContain('if (!isDirty.value || saving.value) return')
  })

  it('only PATCHes/POSTs rows that actually changed, diffed per group and per item', () => {
    expect(page).toContain('groupChanged(group)')
    expect(page).toContain('itemChanged(item)')
  })
})

describe('PWS-02 never calls publish/review/AI and never exposes cross-product or restricted data (source evidence)', () => {
  it('no PWS-02 file renders an AI Fill Workspace control, AI proposal action, or any AI hint', () => {
    for (const file of PWS02_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
      expect(lower).not.toContain('refine with ai')
      expect(lower).not.toContain('ai proposal')
      expect(lower).not.toContain('accept')
      expect(lower).not.toContain('reject')
    }
  })

  it('never calls a publish, submit-for-review, or lifecycle-status endpoint', () => {
    for (const file of PWS02_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('submit for review')
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain("status: 'published'")
    }
  })

  it('never references Sources & Evidence restricted fields (raw excerpt, locator, UUID, internal note, download)', () => {
    for (const file of PWS02_FILES) {
      const source = repoFile(file)
      expect(source).not.toContain('raw_excerpt')
      expect(source).not.toContain('source_locator')
      expect(source).not.toContain('source_file_id')
      expect(source.toLowerCase()).not.toMatch(/>\s*download\s*</)
    }
  })

  it('never fabricates a "Source coverage" or per-row Review-state/Source column backed by no real data', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSpecifications.vue')
    expect(component).not.toContain('Source coverage')
    expect(component).not.toContain('Review state')
    expect(component).not.toContain('Needs review')
  })
})

describe('PWS-02 honest empty states, dirty/save states, and no fabricated data (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceSpecifications.vue')

  it('shows an honest empty state when there are no groups or no items', () => {
    expect(component).toContain('No specification groups for this product yet.')
    expect(component).toContain('No parameters in this group yet.')
  })

  it('never fabricates a real product\'s parameter row when the list is empty', () => {
    expect(component).not.toContain('LT-180C')
    expect(component).not.toContain('Detection sensitivity')
  })

  it('marks unsaved new rows and pending deletions distinctly', () => {
    expect(component).toContain('New — not saved yet')
    expect(component).toContain('will be removed on Save')
  })

  it('renders the mandated Readiness empty text verbatim, never a computed score', () => {
    // lastIndexOf, not indexOf: the component's own <template v-if="..."> icon
    // fragments close with </template> earlier in the file.
    const template = component.slice(component.indexOf('<template>'), component.lastIndexOf('</template>'))
    expect(template).toContain('Not assessed — rule not configured')
    expect(template).not.toMatch(/\d+%/)
  })
})

describe('PWS-02 375px stacking, no horizontal overflow substitute (source evidence)', () => {
  it('the 375px breakpoint stacks the parameter table into cards, never a horizontally scrolling grid', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSpecifications.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('display: block')
    expect(mobileBlock).not.toContain('overflow-x: auto')
  })
})

describe('PWS-02 is English-first and carries no Chinese (source evidence)', () => {
  it('no PWS-02 file has visible or assistive Chinese in its template', () => {
    for (const file of PWS02_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

// ── PWS-03 — Media & Resources (product↔media associations, read+explicit-write) ──

const PWS03_FILES = [
  'pages/admin/product-workspace/[id]/media-resources.vue',
  'components/admin/workspace/WorkspaceMediaResources.vue',
]

describe('PWS-03 module is enabled and routable (source evidence)', () => {
  it('enables media-resources without disabling any already-landed module', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey['media-resources']).toBe(true)
    expect(byKey.overview).toBe(true)
    expect(byKey['page-content']).toBe(true)
    expect(byKey.specifications).toBe(true)
    expect(byKey['sources-evidence']).toBe(true)
    for (const key of ['relations', 'seo-locales', 'share-distribution', 'change-history']) {
      expect(byKey[key]).toBe(false)
    }
  })

  it('workspaceMediaResourcesRoute builds the frozen PWS-03 route, matching the pre-registered nav key', () => {
    expect(workspaceMediaResourcesRoute(42)).toBe('/admin/product-workspace/42/media-resources')
  })

  it('the module nav links media-resources alongside the other landed modules', () => {
    const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')
    expect(source).toContain('workspaceMediaResourcesRoute')
  })
})

describe('PWS-03 page composition (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')

  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspaceMediaResources', () => {
    expect(page).toContain('<WorkspaceShell')
    expect(page).toContain('<WorkspaceModuleNav')
    expect(page).toContain('<WorkspaceMediaResources')
    expect(page).toContain('active-key="media-resources"')
    expect(page).toContain('title="Media & resources"')
  })

  it('reads the same canonical product id for every read and write, never a second product', () => {
    expect(page).toContain('route.params.id')
    expect(page).toContain('/api/admin/products/${id}/media')
    expect(page).not.toMatch(/\/api\/admin\/products\/\d+\//)
  })

  it('reuses the canonical ProductMedia and FileRole types, never a new parallel model', () => {
    expect(page).toContain("import type { AdminProduct, ProductMedia, FileRole } from '~/types/product-cms'")
  })

  it('renders a "Product not found" empty state rather than a blank form', () => {
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })

  it('passes a save-state and listens for the shared Save changes event — R1 batches writes like PWS-01/02', () => {
    expect(page).toContain(':save-state="saveState"')
    expect(page).toContain('@save="handleSave"')
  })
})

// ── PWS-03-R1 — local dirty state + explicit Save (fix, 2026-09-07) ─────────
//
// R0 wrote to the server the instant a card was picked or removed. R1 replaces
// that with the same local-snapshot + explicit-Save pattern already proven in
// PWS-01/02: picking or removing only edits a local `mediaRows` array; the
// diff (new rows -> POST, rows marked for deletion -> DELETE) is only ever
// sent from inside handleSave(), which itself only runs on the shared
// WorkspaceShell "Save changes" click.

describe('PWS-03-R1 models associations as local dirty state, not immediate writes (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')

  it('defines an EditableMedia row shape carrying isNew and markedForDeletion, mirroring PWS-01/02\'s row model', () => {
    expect(page).toMatch(/interface EditableMedia\s*\{[\s\S]*?isNew: boolean[\s\S]*?markedForDeletion: boolean[\s\S]*?\}/)
  })

  it('builds mediaRows from the fetched association list on load, and resyncs it fresh after a save', () => {
    expect(page).toContain('const mediaRows = ref<EditableMedia[]>((mediaData.value ?? []).map(toEditableMedia))')
    expect(page).toContain('function resyncMediaRows()')
    expect(page).toContain('resyncMediaRows()')
  })

  it('isDirty is true exactly when a row is staged-new or staged-for-deletion', () => {
    expect(page).toContain('mediaRows.value.some((r: EditableMedia) => r.isNew || r.markedForDeletion)')
  })

  it('stageLink() only pushes a local row — it never calls $fetch', () => {
    const block = page.slice(page.indexOf('function stageLink'), page.indexOf('function unstage'))
    expect(block).not.toContain('$fetch')
    expect(block).toContain('mediaRows.value.push')
  })

  it('unstage() discards a brand-new row outright, or toggles markedForDeletion on a saved row — both local-only, no $fetch', () => {
    const block = page.slice(page.indexOf('function unstage'), page.indexOf('// ── Save'))
    expect(block).not.toContain('$fetch')
    expect(block).toContain('mediaRows.value.splice(rowIndex, 1)')
    expect(block).toContain('row.markedForDeletion = !row.markedForDeletion')
  })

  it('a second unstage() call on the same still-unsaved row undoes the pending deletion (toggle, not one-way)', () => {
    const block = page.slice(page.indexOf('function unstage'), page.indexOf('// ── Save'))
    // The toggle expression itself proves undo: applying it twice returns to the original value.
    expect(block).toMatch(/row\.markedForDeletion = !row\.markedForDeletion/)
  })
})

describe('PWS-03-R1 issues zero write requests on load, tab switching, opening/closing the picker, or staging — only inside handleSave() (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')
  const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/g

  it('the presentational component never issues a write request itself', () => {
    expect(component).not.toMatch(WRITE_METHOD_RE)
  })

  it('the top-level data fetch only ever calls useFetch (GET), never $fetch with a write method', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function loadLibraryFiles'))
    const fetchCalls = initialFetchBlock.match(/useFetch[^\n]*/g) ?? []
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) expect(call).not.toMatch(WRITE_METHOD_RE)
  })

  it('loadLibraryFiles (browsing Media Library) only ever issues a GET', () => {
    const libBlock = page.slice(page.indexOf('async function loadLibraryFiles'), page.indexOf('function openLibrary'))
    expect(libBlock).not.toMatch(WRITE_METHOD_RE)
  })

  it('openLibrary/closeLibrary/stageLink/unstage — every function before handleSave — issue no write request', () => {
    const preSaveBlock = page.slice(page.indexOf('function openLibrary'), page.indexOf('async function handleSave'))
    expect(preSaveBlock).not.toMatch(WRITE_METHOD_RE)
  })

  it('handleSave() is the only place in the page that issues POST or DELETE, and it does both — diffed per row', () => {
    const beforeSave = page.slice(0, page.indexOf('async function handleSave'))
    expect(beforeSave).not.toMatch(WRITE_METHOD_RE)

    const saveBlock = page.slice(page.indexOf('async function handleSave'), page.indexOf('</script>'))
    expect(saveBlock).toMatch(/method:\s*['"]POST['"]/)
    expect(saveBlock).toMatch(/method:\s*['"]DELETE['"]/)
    expect(saveBlock).not.toMatch(/method:\s*['"]PATCH['"]/)
  })

  it('save only runs when there are staged changes and not already saving — matching PWS-01/02\'s exact guard', () => {
    expect(page).toContain('if (!isDirty.value || saving.value) return')
  })

  it('never mutates props directly in the presentational component — every action is emitted up to the page', () => {
    expect(component).toContain('defineEmits')
    expect(component).not.toMatch(/defineProps[\s\S]*?\bmedia\[[^\]]*\]\s*\.\s*\w+\s*=/)
  })
})

describe('PWS-03 reuses the existing canonical product-media association API — no new data model (source evidence)', () => {
  it('the four product-media endpoints already exist and are unmodified in shape by this module (GET/POST/PATCH/DELETE on products_files)', () => {
    const getSource = repoFile('server/api/admin/products/[id]/media/index.get.ts')
    const postSource = repoFile('server/api/admin/products/[id]/media/index.post.ts')
    const patchSource = repoFile('server/api/admin/products/[id]/media/[mid].patch.ts')
    const deleteSource = repoFile('server/api/admin/products/[id]/media/[mid].delete.ts')
    expect(getSource).toContain('products_files')
    expect(postSource).toContain('/items/products_files')
    expect(patchSource).toContain('products_files')
    expect(deleteSource).toContain('/items/products_files')
  })

  it('unlink deletes only the join row, never the underlying Directus asset', () => {
    const deleteSource = repoFile('server/api/admin/products/[id]/media/[mid].delete.ts')
    expect(deleteSource).toContain('Only delete the products_files record')
    expect(deleteSource).not.toMatch(/\/items\/directus_files\/\$\{/)
  })

  it('the media reference-protection check already counts products_files associations — no change needed for PWS-03', () => {
    const lifecycle = repoFile('server/utils/mediaLifecycle.ts')
    expect(lifecycle).toContain('queryProductsFiles')
    expect(lifecycle).toContain("/items/products_files?filter[directus_files_id][_eq]=")
  })

  it('files are addressed only by stable Directus file UUID, never by filesystem path', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')
    const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
    for (const source of [page, component]) {
      expect(source).not.toMatch(/filename_disk/)
    }
  })
})

describe('PWS-03-R1 duplicate protection is enforced both client-side (staging) and server-side (direct repeat POST) (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')

  it('computes existingFileIds from every currently staged row (linked or pending-delete), so it can never be staged twice', () => {
    expect(page).toContain('mediaRows.value.map((r: EditableMedia) => r.directus_files_id)')
  })

  it('stageLink refuses to push a row when the file is already staged for this product', () => {
    const block = page.slice(page.indexOf('function stageLink'), page.indexOf('function unstage'))
    expect(block).toContain('if (existingFileIds.value.has(fileId)) return')
  })

  it('the picker disables an already-linked file rather than allowing a second pick', () => {
    const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
    expect(component).toContain(':disabled="existingFileIds.has(f.id)"')
  })

  it('every media read/write call is scoped to the route\'s own product id, never a second hardcoded product', () => {
    expect(page).not.toMatch(/\/api\/admin\/products\/\d+\/media/)
  })

  it('the POST endpoint enforces the duplicate guard server-side, so a direct repeat POST (bypassing the UI) is still rejected', () => {
    const postSource = repoFile('server/api/admin/products/[id]/media/index.post.ts')
    expect(postSource).toContain("import { assertNoDuplicateMediaLink } from '~/server/utils/productMediaLinks'")
    expect(postSource).toContain('await assertNoDuplicateMediaLink(Number(id), body.directus_files_id, fetch)')
  })

  it('the server-side duplicate guard is unit-tested against the real exported function (not a copy), covering the direct-repeat-POST case', () => {
    const guardSource = repoFile('server/utils/productMediaLinks.ts')
    expect(guardSource).toContain('export async function assertNoDuplicateMediaLink')
    expect(guardSource).toMatch(/statusCode:\s*409/)
    const guardTest = repoFile('tests/productMediaLinks.test.ts')
    expect(guardTest).toContain("import { assertNoDuplicateMediaLink } from '../server/utils/productMediaLinks'")
    expect(guardTest).toContain('direct-repeat-POST case')
  })
})

describe('PWS-03 never displays restricted or fabricated data (source evidence)', () => {
  it('never renders raw source text, locator, internal note, download URL, or original-file preview link', () => {
    for (const file of PWS03_FILES) {
      const source = repoFile(file)
      expect(source).not.toContain('raw_excerpt')
      expect(source).not.toContain('source_locator')
      expect(source).not.toMatch(/<a\s[^>]*href/)
      expect(source.toLowerCase()).not.toMatch(/>\s*download\s*</)
    }
  })

  it('never renders a bare Directus file UUID as visible text — only safe display fields', () => {
    const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
    const template = component.slice(component.indexOf('<template>'), component.lastIndexOf('</template>'))
    expect(template).not.toMatch(/\{\{\s*(item|f)\.(directus_files_id|id)\s*\}\}/)
  })

  it('adds no new upload entry point — uploading stays Media-Library-only', () => {
    for (const file of PWS03_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('upload')
      expect(lower).not.toContain('<input type="file"')
    }
  })

  it('never fabricates a "Delivery access" value the schema does not have', () => {
    for (const file of PWS03_FILES) {
      expect(repoFile(file)).not.toContain('Delivery access')
      expect(repoFile(file)).not.toContain('Contact-gated')
      expect(repoFile(file)).not.toContain('Internal only')
    }
  })
})

describe('PWS-03 has no AI surface and no lifecycle/publish control (source evidence)', () => {
  it('no PWS-03 file renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of PWS03_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
    }
  })

  it('never calls a publish, submit-for-review, or lifecycle-status endpoint', () => {
    for (const file of PWS03_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('submit for review')
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain("status: 'published'")
    }
  })
})

describe('PWS-03-R1 pending-state badges make staged changes visible before Save (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')

  it('marks a staged-new row distinctly from an already-saved association', () => {
    expect(component).toContain('New — not saved yet')
  })

  it('marks a row staged for removal distinctly, and it is still visible (not yet gone) until Save', () => {
    expect(component).toContain('Will be removed on Save')
  })

  it('the remove button reads "Discard" for an unsaved row, and "Undo removal" for a saved row already staged for deletion', () => {
    expect(component).toContain("if (row.isNew) return 'Discard'")
    expect(component).toContain("return row.markedForDeletion ? 'Undo removal' : 'Remove association'")
  })

  it('tells the admin that picking a file only stages it — nothing is sent until Save changes', () => {
    expect(component).toContain('nothing is sent until you click Save changes')
  })
})

describe('PWS-03 honest empty states, no fabricated resource rows (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')

  it('shows an honest empty state when there is no linked media or no linked documents', () => {
    expect(component).toContain('No media linked to this product yet.')
    expect(component).toContain('No documents linked to this product yet.')
  })

  it('never fabricates a real product\'s asset row when the list is empty', () => {
    expect(component).not.toContain('LT-180C')
    expect(component).not.toContain('Free-Fall')
  })

  it('names the core business rule against auto-inheriting other products\' materials', () => {
    expect(component).toContain('never inherited or mixed in automatically')
  })
})

describe('PWS-03 375px stacking, no horizontal overflow substitute (source evidence)', () => {
  it('the 375px breakpoint stacks the document table into cards and the detail rail to full width', () => {
    const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('flex-direction: column')
    expect(mobileBlock).toContain('display: block')
    expect(mobileBlock).not.toContain('overflow-x: auto')
  })
})

describe('PWS-03 is English-first and carries no Chinese (source evidence)', () => {
  it('no PWS-03 file has visible or assistive Chinese in its template', () => {
    for (const file of PWS03_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

describe('fileRoleLabel / workspaceMediaThumbUrl / workspaceMediaIsImage (pure helpers)', () => {
  it('maps every canonical FileRole to a clear English label without inventing a new role', () => {
    expect(fileRoleLabel('hero')).toBe('Hero image')
    expect(fileRoleLabel('datasheet')).toBe('Datasheet')
    expect(fileRoleLabel('certificate')).toBe('Certificate')
  })

  it('reports an honest fallback when no role is set, never a blank string', () => {
    expect(fileRoleLabel(null)).toBe('Role not set')
  })

  it('builds the thumbnail URL through the same hardened proxy the legacy editor and Media Library page already use', () => {
    expect(workspaceMediaThumbUrl('abc-123')).toBe('/api/admin/media/abc-123?width=240&height=180&fit=cover')
    expect(workspaceMediaThumbUrl(null)).toBeNull()
  })

  it('splits Product media vs. Documents & access by real MIME type, never by filename guesswork', () => {
    expect(workspaceMediaIsImage('image/jpeg')).toBe(true)
    expect(workspaceMediaIsImage('application/pdf')).toBe(false)
    expect(workspaceMediaIsImage(null)).toBe(false)
  })
})
