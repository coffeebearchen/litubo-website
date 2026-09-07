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
} from '../utils/productWorkspace'
import { productDetailRoute, workspaceOverviewRoute } from '../utils/productCentre'
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

  it('defines all nine PWS-00…PWS-08 addresses with only Overview enabled', () => {
    expect(WORKSPACE_MODULE_NAV).toHaveLength(9)
    const enabled = WORKSPACE_MODULE_NAV.filter(i => i.enabled)
    expect(enabled).toHaveLength(1)
    expect(enabled[0]!.key).toBe('overview')
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
