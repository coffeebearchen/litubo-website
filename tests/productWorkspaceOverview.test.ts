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
} from '../utils/productWorkspace'
import {
  productDetailRoute,
  workspaceOverviewRoute,
  workspaceSourcesEvidenceRoute,
} from '../utils/productCentre'
import type { AdminProduct } from '../types/product-cms'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

function renderedMarkup(source: string): string {
  return source
    .slice(source.indexOf('<template>'), source.indexOf('</template>'))
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

  it('renders Save changes as a disabled button with a visible reason', () => {
    const saveBlock = source.slice(source.indexOf('Save changes') - 300, source.indexOf('Save changes'))
    expect(saveBlock).toContain('disabled')
    expect(saveBlock).toMatch(/title="[^"]+"/)
  })

  it('renders Submit for review as a disabled button with a visible reason', () => {
    const submitBlock = source.slice(source.indexOf('Submit for review') - 300, source.indexOf('Submit for review'))
    expect(submitBlock).toContain('disabled')
    expect(submitBlock).toMatch(/title="[^"]+"/)
  })

  it('renders no lifecycle transition control (draft/review/published/archived actions)', () => {
    const lower = source.toLowerCase()
    expect(lower).not.toContain('publish')
    expect(lower).not.toContain('submit for review".*@click')
  })

  it('Preview reuses the existing read-only Admin preview route', () => {
    expect(source).toContain('previewHref')
    expect(repoFile('pages/admin/product-workspace/[id]/overview.vue')).toContain('/preview')
  })
})

// ── 9/10. Module nav — disabled buttons, accordion, no <select> ─────────────

describe('Workspace module navigation (source evidence)', () => {
  const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')

  it('defines all nine PWS-00…PWS-08 addresses with only Overview and Sources & evidence enabled', () => {
    expect(WORKSPACE_MODULE_NAV).toHaveLength(9)
    const enabled = WORKSPACE_MODULE_NAV.filter(i => i.enabled).map(i => i.key)
    expect(enabled).toEqual(['overview', 'sources-evidence'])
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
  it('enables sources-evidence without touching any other module flag', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey['sources-evidence']).toBe(true)
    expect(byKey.overview).toBe(true)
    for (const key of ['page-content', 'specifications', 'media-resources', 'relations', 'seo-locales', 'share-distribution', 'change-history']) {
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
