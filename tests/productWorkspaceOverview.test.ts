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
  workspaceAiSourceIntakeRoute,
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

  it('never displays Assigned language, Tasks, sources, confidence, or a fabricated AI conclusion/score', () => {
    // PWS-AI-ENGINE-01R §7.2 authorizes exactly one real, honest AI affordance here
    // (the "AI Fill Specifications" CTA, which only navigates to AI Source Intake —
    // never writes, never fabricates a result) — so this no longer bans the word "ai"
    // outright; it still bans any fabricated readiness/confidence/task-assignment surface.
    const lower = source.toLowerCase()
    expect(lower).not.toContain('assigned language')
    expect(lower).not.toContain('task')
    expect(lower).not.toContain('confidence')
    expect(lower).not.toContain('source review')
  })

  it('the one AI affordance present is the honest, non-writing "AI Fill Specifications" CTA — never a fabricated AI conclusion or score', () => {
    expect(source).toContain('AI Fill Specifications')
    expect(source).toContain('workspaceAiSourceIntakeRoute')
    expect(source).not.toMatch(/ai (confidence|score|conclusion|summary)/i)
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

// ── 7. No UNAUTHORIZED AI affordance anywhere in the new UI ──────────────────

describe('No unauthorized AI surface in PWS-00 (source evidence)', () => {
  // PWS-AI-ENGINE-01R §7.2 explicitly authorizes exactly one AI affordance in this
  // module set — the "AI Fill Specifications" CTA in WorkspaceOverview.vue, which
  // only navigates to AI Source Intake and never writes or fabricates a result.
  // Every OTHER file here must still carry no AI surface at all.
  const filesThatMustStayAiFree = NEW_FILES.filter(f => f !== 'components/admin/workspace/WorkspaceOverview.vue')

  it('no file besides the authorized Overview CTA renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of filesThatMustStayAiFree) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
    }
  })

  it('the one authorized AI affordance only navigates to AI Source Intake — it never calls $fetch or writes anything itself', () => {
    const source = repoFile('components/admin/workspace/WorkspaceOverview.vue')
    expect(source).not.toContain('$fetch')
    expect(source).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/)
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

  it('defines all ten PWS-00…PWS-08 + AI Source Intake addresses with only the six landed modules enabled', () => {
    expect(WORKSPACE_MODULE_NAV).toHaveLength(10)
    const enabled = WORKSPACE_MODULE_NAV.filter(i => i.enabled).map(i => i.key)
    expect(enabled).toEqual(['overview', 'page-content', 'specifications', 'media-resources', 'sources-evidence', 'ai-source-intake'])
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
      // PWS-07-WRITE-AUDIT-01's sources-evidence.vue legitimately carries a
      // `source_file_id` request-body key when staging a NEW evidence link
      // (the value the admin just picked, sent once to create the link) — it
      // is never rendered. The rendered template itself must still never
      // show it, so the check narrows to markup once a page defines one.
      const template = source.includes('<template>') ? renderedMarkup(source) : source
      expect(template).not.toContain('source_file_id')
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

describe('PWS-07\'s original read-only Evidence register still has no write affordance (source evidence)', () => {
  // Scoped to WorkspaceSourcesEvidence.vue only: the sources-evidence.vue PAGE
  // was intentionally, independently authorized to gain a real Save flow in
  // PWS-07-WRITE-AUDIT-01 (see that section's own "zero writes until Save"
  // tests below) — this component is the one part of PWS-07 required to stay
  // exactly as read-only as it always was.
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/i
  const READONLY_COMPONENT = 'components/admin/workspace/WorkspaceSourcesEvidence.vue'

  it('WorkspaceSourcesEvidence.vue issues no POST, PATCH, PUT or DELETE request', () => {
    expect(repoFile(READONLY_COMPONENT)).not.toMatch(WRITE_METHOD_RE)
  })

  it('the sources GET endpoint issues no write request', () => {
    expect(repoFile('server/api/admin/products/[id]/sources/index.get.ts')).not.toMatch(WRITE_METHOD_RE)
  })

  it('WorkspaceSourcesEvidence.vue renders no Save, Archive, Edit or AI Fill button', () => {
    const lower = repoFile(READONLY_COMPONENT).toLowerCase()
    expect(lower).not.toContain('archive')
    expect(lower).not.toContain('ai fill')
    expect(lower).not.toContain('ai-fill')
    expect(lower).not.toMatch(/>\s*edit\s*</)
    expect(lower).not.toMatch(/>\s*save\s*</)
  })

  it('WorkspaceSourcesEvidence.vue renders no AI Fill Workspace control or any AI hint', () => {
    expect(repoFile(READONLY_COMPONENT).toLowerCase()).not.toContain('pws-ai')
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
  // Sources & evidence intentionally left this list in PWS-07-WRITE-AUDIT-01:
  // that task explicitly and independently authorized turning it from a
  // read-only tab into one with a real Save changes flow for Specifications
  // evidence links. Overview remains untouched and still passes no save-state.
  it('Overview never passes a save-state, so it keeps the original disabled button', () => {
    for (const file of NEW_FILES.filter(f => f.includes('overview'))) {
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
    // CC-IMP-04 — the picker markup moved unchanged into the shared MediaLibraryPicker;
    // the Product component still passes every staged file as linked.
    const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')
    expect(component).toContain(':linked-file-ids="linkedFileIds"')
    expect(repoFile('components/admin/media/MediaLibraryPicker.vue')).toContain(':disabled="existingFileIds.has(f.id)"')
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

// ── PWS-03-R2 — same-page layout, matching PW-VIS-04 (style fix, 2026-09-07) ──
//
// R0/R1 rendered "Product media" and "Documents & access" as two Tabs that
// hide one another. Re-reading PW-VIS-04-MEDIA-RESOURCES-D1440 at full size
// confirms the PRIMARY master draws both as two stacked sections on the SAME
// page, alongside one persistent "Selected asset" rail — never a tab switch.
// This fix removes the Tab structure entirely; the R1 dirty-state/Save logic
// itself is untouched (verified by the still-passing PWS-03-R1 blocks above).

describe('PWS-03-R2 renders Product media and Documents & access as one same-page layout, not Tabs (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')

  it('no tab-switching structure remains — no role="tab"/tablist and no activeTab state', () => {
    expect(component).not.toContain('role="tab"')
    expect(component).not.toContain('role="tablist"')
    expect(component).not.toContain('activeTab')
  })

  it('both sections are unconditional siblings — neither is gated behind the other with v-if/v-else', () => {
    const mediaSectionIdx = component.indexOf('aria-labelledby="ws-media-heading"')
    const docsSectionIdx = component.indexOf('aria-labelledby="ws-docs-heading"')
    expect(mediaSectionIdx).toBeGreaterThan(-1)
    expect(docsSectionIdx).toBeGreaterThan(mediaSectionIdx)

    const betweenSections = component.slice(
      component.lastIndexOf('<section', mediaSectionIdx),
      component.lastIndexOf('<section', docsSectionIdx),
    )
    // The closing </section> for Product media must appear before the Documents
    // section opens — i.e. they are sequential siblings, not alternates of one v-if/v-else.
    expect(betweenSections).toContain('</section>')
    expect(component.slice(component.lastIndexOf('<section', docsSectionIdx), docsSectionIdx)).not.toContain('v-else')
  })

  it('Product media keeps its own "Select from Media Library" entry point, and Documents & access has its own "Add documents" entry point — both open the same picker', () => {
    expect(component).toContain('+ Select from Media Library')
    expect(component).toContain('+ Add documents')
    const openCalls = component.match(/emit\('open-library'\)/g) ?? []
    expect(openCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('Documents & access still shows an honest empty state — never a fabricated row', () => {
    expect(component).toContain('No documents linked to this product yet.')
  })

  it('the right-rail Selected asset panel stays visible alongside both sections on desktop (sticky, ≥768px only)', () => {
    const desktopBlock = component.slice(component.indexOf('@media (min-width: 768px)'))
    expect(desktopBlock).toContain('.ws-detail')
    expect(desktopBlock).toContain('position: sticky')
  })

  it('the mobile breakpoint still stacks the detail rail to full width, not the sticky desktop layout', () => {
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('.ws-detail { width: 100%; }')
  })
})

describe('PWS-03-R2 preserves every R1 dirty-state guarantee — this is a style-only fix (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/media-resources.vue')
  const component = repoFile('components/admin/workspace/WorkspaceMediaResources.vue')

  it('EditableMedia rows, isDirty, stageLink, unstage and handleSave are all unchanged in shape', () => {
    expect(page).toContain('interface EditableMedia')
    expect(page).toContain('const isDirty = computed(')
    expect(page).toContain('function stageLink(fileId: string)')
    expect(page).toContain('function unstage(rowIndex: number)')
    expect(page).toContain('async function handleSave()')
  })

  it('the server-side duplicate guard is still wired into the POST endpoint', () => {
    const postSource = repoFile('server/api/admin/products/[id]/media/index.post.ts')
    expect(postSource).toContain("import { assertNoDuplicateMediaLink } from '~/server/utils/productMediaLinks'")
  })

  it('the presentational component still never issues a write request', () => {
    expect(component).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/)
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

// ── PWS-SOURCES-LITE-POLISH-01 — Sources & evidence lite polish ─────────────
//
// A visual/interaction close-out of the writable Specifications evidence
// surface added by PWS-07-WRITE-AUDIT-01. The user confirmed only a small
// number of machine parameters are being entered and no higher-tier audit
// UI is needed, so this task removed the batched dirty-state/Save model and
// the on-screen audit-history panel, replacing them with three small,
// explicit, immediate-write actions (Link evidence / Record verification /
// Remove, the last gated behind an in-place confirmation) — never a write
// on page load, row selection, opening/closing the picker, or a dropdown
// change. No schema, endpoint or Directus-native audit data changed: every
// write still goes through the exact same three endpoints PWS-07-WRITE-
// AUDIT-01 introduced. The existing read-only "Evidence register"
// (WorkspaceSourcesEvidence.vue) keeps its own describe blocks above.

const EVIDENCE_FILES = [
  'pages/admin/product-workspace/[id]/sources-evidence.vue',
  'components/admin/workspace/WorkspaceEvidenceLinks.vue',
]

describe('PWS-SOURCES-LITE-POLISH-01 reuses product_source_records, never a new evidence table (source evidence)', () => {
  it('the util module builds/parses a server-generated spec_item: fact_key — never accepts a client fact_key', () => {
    const util = repoFile('server/utils/productEvidenceLinks.ts')
    expect(util).toContain("export const EVIDENCE_FACT_KEY_PREFIX = 'spec_item:'")
    expect(util).toContain('export function buildSpecItemFactKey')
    expect(util).toContain('export function parseSpecItemFactKey')
  })

  it('POST validates the spec item and source file both belong to this product before ever calling Directus', () => {
    const postSource = repoFile('server/api/admin/products/[id]/evidence/index.post.ts')
    expect(postSource).toContain('await assertSpecItemBelongsToProduct(Number(id), specItemId, fetch)')
    expect(postSource).toContain('await assertSourceFileLinkedToProduct(Number(id), fileUuid, fetch)')
    expect(postSource).toContain('await assertNoDuplicateEvidenceLink(')
  })

  it('the client never controls fact_key, table name, or target type — only spec_item_id and source_file_id are read from the request body', () => {
    const postSource = repoFile('server/api/admin/products/[id]/evidence/index.post.ts')
    expect(postSource).not.toContain('body.fact_key')
    expect(postSource).not.toContain('body.target_id')
    expect(postSource).not.toContain('body.target_type')
    expect(postSource).not.toContain('body.table')
    expect(postSource).toContain('buildSpecItemFactKey(specItemId)')
  })

  it('the POST endpoint writes to product_source_records — no new collection is introduced for the link itself', () => {
    const postSource = repoFile('server/api/admin/products/[id]/evidence/index.post.ts')
    expect(postSource).toContain("'/items/product_source_records'")
  })

  it('review-status changes are the only field a PATCH may touch, and only via server-side whitelist', () => {
    const patchSource = repoFile('server/api/admin/products/[id]/evidence/[linkId].patch.ts')
    expect(patchSource).toContain('body: { review_status: body.review_status }')
    expect(patchSource).not.toContain('...body')
  })

  it('removing an evidence link reuses the existing PWS-07 sources archive endpoint unmodified', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('/sources/${linkId}/archive')
    const archiveSource = repoFile('server/api/admin/products/[id]/sources/[sourceId]/archive.post.ts')
    expect(archiveSource).toContain('archived: true')
    expect(archiveSource).toContain('already archived')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 cross-product objects are rejected, never leaked (source evidence)', () => {
  it('every write endpoint calls assertProductExists before touching product_source_records', () => {
    for (const file of [
      'server/api/admin/products/[id]/evidence/index.get.ts',
      'server/api/admin/products/[id]/evidence/index.post.ts',
      'server/api/admin/products/[id]/evidence/[linkId].patch.ts',
    ]) {
      expect(repoFile(file)).toContain('await assertProductExists(event, Number(id))')
    }
  })

  it('the PATCH endpoint checks the link\'s own product_id and its fact_key shape before allowing any change', () => {
    const patchSource = repoFile('server/api/admin/products/[id]/evidence/[linkId].patch.ts')
    expect(patchSource).toContain('existing.product_id !== Number(id)')
    expect(patchSource).toContain('parseSpecItemFactKey(existing.fact_key) === null')
    expect(patchSource).toMatch(/statusCode:\s*404/)
  })

  it('spec-item ownership and source-file ownership are both scoped to the exact route product id, never a second product', () => {
    const util = repoFile('server/utils/productEvidenceLinks.ts')
    expect(util).toContain('filter[spec_group_id][product_id][_eq]=${productId}')
    expect(util).toContain('filter[products_id][_eq]=${productId}')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 never hardcodes a specification vocabulary (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')

  it('the spec-item picker is built by iterating the product\'s own groups/items props, never a static option list', () => {
    expect(component).toContain('v-for="group in specGroups"')
    expect(component).toContain('v-for="item in group.items"')
    expect(component).not.toMatch(/<option[^>]*>(Detection sensitivity|Housing material|Power supply|Inlet diameter)/)
  })

  it('the source picker is built from the linkedMedia prop only — never a global Media Library browse', () => {
    expect(component).toContain('v-for="m in linkedMedia"')
    expect(component).not.toContain('/api/admin/media/files')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 writes only on an explicit click — never on load, select, open/close or dropdown change (source evidence)', () => {
  const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
  const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/g

  it('the presentational component never issues a write request itself — it only emits', () => {
    expect(component).not.toMatch(WRITE_METHOD_RE)
    expect(component).toContain("'link-evidence'")
    expect(component).toContain("'update-verification'")
    expect(component).toContain("'remove-evidence'")
  })

  it('the top-level data fetch only ever calls useFetch (GET), never $fetch with a write method', () => {
    const initialFetchBlock = page.slice(0, page.indexOf('async function linkEvidence'))
    const fetchCalls = initialFetchBlock.match(/useFetch[^\n]*/g) ?? []
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) expect(call).not.toMatch(WRITE_METHOD_RE)
  })

  it('linkEvidence, updateVerification and removeEvidence are three separate immediate-write handlers, not a batched Save', () => {
    expect(page).not.toContain('isDirty')
    expect(page).not.toContain('handleSave')
    expect(page).not.toContain('EditableEvidenceLink')
    expect(page).toContain('async function linkEvidence(')
    expect(page).toContain('async function updateVerification(')
    expect(page).toContain('async function removeEvidence(')
    expect(page.match(/method:\s*['"]POST['"]/g)?.length).toBe(2) // create + archive
    expect(page).toMatch(/method:\s*['"]PATCH['"]/)
  })

  it('each write handler guards against a second concurrent write with the same pending flag', () => {
    for (const fn of ['linkEvidence', 'updateVerification', 'removeEvidence']) {
      const start = page.indexOf(`async function ${fn}(`)
      const body = page.slice(start, page.indexOf('\n}', start))
      expect(body).toContain('if (pending.value) return')
    }
  })

  it('opening/closing the picker and changing its dropdowns never call an emit or $fetch — only confirmPick does', () => {
    const block = component.slice(component.indexOf('function openPicker'), component.indexOf('function confirmPick'))
    expect(block).not.toContain('emit(')
    expect(block).not.toContain('$fetch')
    const confirmBlock = component.slice(component.indexOf('function confirmPick'), component.indexOf('function sourceDisplayName'))
    expect(confirmBlock).toContain("emit('link-evidence'")
  })

  it('selecting a row only sets local state — it never emits or writes', () => {
    const block = component.slice(component.indexOf('function selectItem'), component.indexOf('function askRemove'))
    expect(block).not.toContain('emit(')
    expect(block).not.toContain('$fetch')
  })

  it('Remove requires an explicit second confirmation click before it emits', () => {
    expect(component).toContain('function askRemove')
    expect(component).toContain('function confirmRemove')
    expect(component).toContain('Confirm remove')
    const askBlock = component.slice(component.indexOf('function askRemove'), component.indexOf('function cancelRemove'))
    expect(askBlock).not.toContain('emit(')
    const confirmBlock = component.slice(component.indexOf('function confirmRemove'), component.indexOf('// ── Record verification'))
    expect(confirmBlock).toContain("emit('remove-evidence'")
  })

  it('Record verification stages a local draft status and only writes when Update is clicked', () => {
    const openBlock = component.slice(component.indexOf('function openVerifyDraft'), component.indexOf('function cancelVerifyDraft'))
    expect(openBlock).not.toContain('emit(')
    const confirmBlock = component.slice(component.indexOf('function confirmVerifyDraft'), component.indexOf('watch(selectedId'))
    expect(confirmBlock).toContain("emit('update-verification'")
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 shows no audit history, actor, timeline or revision (source evidence)', () => {
  it('WorkspaceEvidenceLinks.vue no longer imports or renders EvidenceAuditEntry data', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    expect(component).not.toContain('EvidenceAuditEntry')
    expect(component).not.toContain('auditEntries')
    expect(component).not.toContain('Evidence history')
    expect(component.toLowerCase()).not.toContain('actor')
    expect(component.toLowerCase()).not.toContain('revision')
  })

  it('the page no longer fetches the audit endpoint', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).not.toContain('evidence/audit')
    expect(page).not.toContain('refreshAudit')
  })

  it('the existing Directus-native audit endpoint is left in place, untouched, for possible future use', () => {
    const auditSource = repoFile('server/api/admin/products/[id]/evidence/audit.get.ts')
    expect(auditSource).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/)
    expect(auditSource).toContain('/revisions?filter')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 merges the restricted/internal copy into one line, no duplicates (source evidence)', () => {
  it('the page shows exactly one internal-workspace scope note, worded as specified', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('Internal workspace')
    expect(page).toContain('This information is never public.')
  })

  it('the old separate restricted badge, hint and footnote no longer exist on the read-only register', () => {
    const component = repoFile('components/admin/workspace/WorkspaceSourcesEvidence.vue')
    expect(component).not.toContain('Restricted — not visible to customers')
    expect(component).not.toContain('Record where product facts originate')
    expect(component).not.toContain('exact source locations are restricted')
  })

  it('the evidence table card no longer repeats its own separate restricted hint', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    expect(component).not.toContain('Link a specification parameter to a source already associated')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 Specification evidence table matches the PW-VIS-08 column set (source evidence)', () => {
  it('the header row is exactly Specification / Source / Verification / Action', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    const theadBlock = component.slice(component.indexOf('<thead>'), component.indexOf('</thead>'))
    const headers = [...theadBlock.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim()).filter(Boolean)
    expect(headers).toEqual(['Specification', 'Source', 'Verification', 'Action'])
  })

  it('Verification is a static safe badge in the table, not a per-row dropdown that writes on change', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    const rowBlock = component.slice(component.indexOf('<tbody>'), component.indexOf('</tbody>'))
    expect(rowBlock).not.toContain('<select')
    expect(rowBlock).not.toContain('@change')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 never displays restricted or fabricated data (source evidence)', () => {
  it('never renders raw source text, locator, internal note, download URL, or original-file preview link', () => {
    for (const file of EVIDENCE_FILES) {
      const source = repoFile(file)
      expect(source).not.toContain('raw_excerpt')
      expect(source).not.toContain('source_locator')
      expect(source.toLowerCase()).not.toMatch(/>\s*download\s*</)
    }
  })

  it('never renders a bare Directus file UUID, fact_key, or the internal note field as visible text', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    const template = component.slice(component.indexOf('<template>'), component.lastIndexOf('</template>'))
    expect(template).not.toMatch(/\{\{\s*(link|entry|m)\.(source_file_id|fact_key|note)\s*\}\}/)
  })

  it('the GET endpoint never selects raw_excerpt, source_locator or note from Directus', () => {
    // Checks the actual field-selection string sent to Directus, not the
    // whole file — this endpoint's own safety-explaining comments legitimately
    // name these restricted fields to document that they are excluded.
    const listSource = repoFile('server/api/admin/products/[id]/evidence/index.get.ts')
    const fieldsBlock = listSource.slice(listSource.indexOf('const FIELDS ='), listSource.indexOf('.join('))
    expect(fieldsBlock).not.toContain('raw_excerpt')
    expect(fieldsBlock).not.toContain('source_locator')
    expect(fieldsBlock).not.toContain("'note'")
  })

  it('the evidence POST response only ever echoes the new link\'s own id — never the file UUID or fact_key it received', () => {
    const postSource = repoFile('server/api/admin/products/[id]/evidence/index.post.ts')
    expect(postSource).toContain('return { id: (result as { data: { id: number } }).data.id }')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 has no AI, upload, publish or lifecycle surface (source evidence)', () => {
  it('no evidence file renders an AI Fill Workspace control or any AI hint', () => {
    for (const file of EVIDENCE_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill')
      expect(lower).not.toContain('ai-fill')
      expect(lower).not.toContain('pws-ai')
    }
  })

  it('adds no new upload entry point and never calls a publish/submit-for-review/lifecycle endpoint', () => {
    for (const file of EVIDENCE_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('<input type="file"')
      expect(lower).not.toContain('submit for review')
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain("status: 'published'")
    }
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 honest empty states, no fabricated evidence rows (source evidence)', () => {
  const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')

  it('shows an honest, compact empty state when there is no evidence linked yet', () => {
    expect(component).toContain('No specification evidence linked for this product yet.')
  })

  it('never fabricates a real product\'s parameter or source name when the list is empty', () => {
    expect(component).not.toContain('LT-180C')
    expect(component).not.toContain('Detection sensitivity')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 375px stacking, no horizontal overflow substitute (source evidence)', () => {
  it('the 375px breakpoint stacks the evidence table into cards and the detail rail to full width', () => {
    const component = repoFile('components/admin/workspace/WorkspaceEvidenceLinks.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('display: block')
    expect(mobileBlock).toContain('.ws-detail { width: 100%; }')
    expect(mobileBlock).not.toContain('overflow-x: auto')
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 is English-first and carries no Chinese (source evidence)', () => {
  it('no evidence file has visible or assistive Chinese in its template', () => {
    for (const file of EVIDENCE_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

describe('PWS-SOURCES-LITE-POLISH-01 leaves the existing read-only Evidence register untouched apart from the merged copy (regression guard)', () => {
  it('WorkspaceSourcesEvidence.vue still renders no write request and no new props', () => {
    const source = repoFile('components/admin/workspace/WorkspaceSourcesEvidence.vue')
    expect(source).not.toMatch(/method:\s*['"](POST|PATCH|PUT|DELETE)['"]/)
    expect(source).toContain('defineProps<{\n  sources: SourceRecordSummary[]\n}>()')
  })

  it('the page still mounts WorkspaceSourcesEvidence alongside WorkspaceEvidenceLinks, not in place of it', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).toContain('<WorkspaceSourcesEvidence :sources="sources" />')
    expect(page).toContain('<WorkspaceEvidenceLinks')
  })

  it('the page no longer passes a save-state or listens for a shared Save changes event — every write here is immediate and explicit', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/sources-evidence.vue')
    expect(page).not.toContain(':save-state=')
    expect(page).not.toContain('@save=')
  })
})

// ── PWS-AI-01-FAST-01 — AI Source Intake (selection only, explicitly authorized) ──
//
// The user explicitly authorized this narrowed first step of `AI-01`: an
// admin may select which of the CURRENT product's own already-associated
// Media Library files would scope a hypothetical future AI run. Nothing
// here calls a model, writes a product parameter, creates a proposal, or
// publishes anything — selection is purely local, ephemeral UI state.
// PWS-AI-02 (Proposal Review) does not exist and is out of scope.

const AI_INTAKE_FILES = [
  'pages/admin/product-workspace/[id]/ai-source-intake.vue',
  'components/admin/workspace/WorkspaceAiSourceIntake.vue',
]

describe('PWS-AI-01-FAST-01 module is enabled and routable', () => {
  it('enables ai-source-intake without touching any other module flag', () => {
    const byKey = Object.fromEntries(WORKSPACE_MODULE_NAV.map(i => [i.key, i.enabled]))
    expect(byKey['ai-source-intake']).toBe(true)
    expect(byKey.overview).toBe(true)
    expect(byKey['page-content']).toBe(true)
    expect(byKey.specifications).toBe(true)
    expect(byKey['media-resources']).toBe(true)
    expect(byKey['sources-evidence']).toBe(true)
    for (const key of ['relations', 'seo-locales', 'share-distribution', 'change-history']) {
      expect(byKey[key]).toBe(false)
    }
  })

  it('workspaceAiSourceIntakeRoute builds the frozen route', () => {
    expect(workspaceAiSourceIntakeRoute(42)).toBe('/admin/product-workspace/42/ai-source-intake')
  })

  it('the module nav links the enabled item with a real NuxtLink, using the shared icon set', () => {
    const source = repoFile('components/admin/workspace/WorkspaceModuleNav.vue')
    expect(source).toContain('workspaceAiSourceIntakeRoute')
    const icon = repoFile('components/admin/workspace/WorkspaceNavIcon.vue')
    expect(icon).toContain("moduleKey === 'ai-source-intake'")
  })
})

describe('PWS-AI-01-FAST-01 page composition', () => {
  it('mounts WorkspaceShell, WorkspaceModuleNav and WorkspaceAiSourceIntake', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    expect(page).toContain('<WorkspaceShell')
    expect(page).toContain('<WorkspaceModuleNav')
    expect(page).toContain('<WorkspaceAiSourceIntake')
    expect(page).toContain('active-key="ai-source-intake"')
  })

  it('renders a "Product not found" empty state rather than a blank form', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    expect(page).toContain('Product not found')
    expect(page).toContain('notFound')
  })

  it('does not pass a save-state or listen for a Save changes event — this page never writes', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    expect(page).not.toContain(':save-state=')
    expect(page).not.toContain('@save=')
  })
})

describe('PWS-AI-01-FAST-01 reads only the current product\'s own already-associated files — never cross-product', () => {
  it('fetches exactly the product record and its own media association list, nothing else', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    expect(page).toContain('useFetch<AiProductContext>(`/api/admin/products/${id}/ai/context`)')
    expect(page).toContain('useFetch<AiIntakeSource[]>(`/api/admin/products/${id}/ai/sources`)')
    expect(page).not.toContain('/api/admin/media/files')
    expect(page).not.toContain('/api/admin/products/${id}/sources')
    expect(page).not.toContain('/api/admin/products/${id}/evidence')
  })

  it('the file grid is built by iterating the linkedMedia prop only — never a static or global list', () => {
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    expect(component).toContain('v-for="source in sources"')
    expect(component).not.toContain('/api/admin/media/files')
  })
})

// PWS-AI-ENGINE-01 (2026-09-08) superseded the PWS-AI-01-FAST-01 "selection
// only, zero-write, no-op Continue" design with a real Analyze → Review →
// Apply flow — see tests/aiProposalEngine.test.ts, tests/aiTextExtraction.test.ts,
// tests/aiSpecificationApply.test.ts and tests/aiSourceIntakeReview.test.ts for
// full coverage of the new engine and UI. The two blocks below are updated in
// place (not deleted) to keep asserting what is still true post-upgrade: page
// load and toggling a selection remain local-only, and the one real write path
// (Analyze) is the sole exception, exactly as intended.
describe('PWS-AI-ENGINE-01 page load and selection stay local-only — Analyze is the one deliberate exception', () => {
  const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/g

  it('the top-level (synchronous, page-load-time) data fetch is useFetch (GET) only — no $fetch runs on load', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    // Everything before the first function declaration is what actually runs
    // at page load. Slicing at one named handler broke as soon as another
    // click-triggered handler was added ahead of it; the first `function` is
    // the real boundary.
    const firstFunctionAt = page.search(/\n(async )?function /)
    expect(firstFunctionAt).toBeGreaterThan(-1)
    const topLevel = page.slice(0, firstFunctionAt)
    expect(topLevel).not.toContain('$fetch')
    expect(topLevel).not.toMatch(WRITE_METHOD_RE)
  })

  it('retrySources() is a read-only re-fetch (GET, explicitly click-triggered) — never a write', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    const block = page.slice(page.indexOf('async function retrySources'), page.indexOf('async function retryProviders'))
    expect(block).toContain('$fetch<AiIntakeSource[]>')
    expect(block).not.toMatch(WRITE_METHOD_RE)
  })

  it('retryProviders() is a read-only re-fetch (GET, explicitly click-triggered) — never a write', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    const retryBlock = page.slice(page.indexOf('async function retryProviders'), page.indexOf('async function analyze'))
    expect(retryBlock).toContain("$fetch<AiProviderSummary[]>('/api/admin/ai/providers')")
    expect(retryBlock).not.toMatch(WRITE_METHOD_RE)
  })

  it('no $fetch or write method appears anywhere before the Analyze handler is defined', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    const beforeAnalyze = page.slice(0, page.indexOf('async function analyze'))
    expect(beforeAnalyze).not.toMatch(WRITE_METHOD_RE)
  })

  it('the presentational component never issues any fetch request itself — it only emits', () => {
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    expect(component).not.toContain('$fetch')
    expect(component).not.toContain('useFetch')
    expect(component).not.toMatch(WRITE_METHOD_RE)
  })

  it('toggling a selection only mutates a local ref array — it never emits a write or calls the server', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    const block = page.slice(page.indexOf('function toggleSelection'), page.indexOf('const analyzing'))
    expect(block).not.toContain('$fetch')
    expect(block).toContain('selectedRefs.value')
  })

  it('Analyze is a real, explicit request — POST to the generate endpoint, never a no-op boolean flip', () => {
    const page = repoFile('pages/admin/product-workspace/[id]/ai-source-intake.vue')
    const block = page.slice(page.indexOf('async function analyze'), page.indexOf('</script>'))
    expect(block).toContain('/ai/specification-proposal/generate')
    expect(block).toMatch(/method:\s*['"]POST['"]/)
  })
})

describe('PWS-AI-ENGINE-01 Analyze is gated on a supported, selected file and a configured provider', () => {
  it('Analyze is disabled unless canAnalyze is true (selection + configured provider)', () => {
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    expect(component).toContain(':disabled="!canAnalyze"')
  })

  it('renders the real, now-authorized Analyze control — the module has moved past selection-only', () => {
    for (const file of AI_INTAKE_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('ai fill workspace')
      expect(lower).not.toContain('apply approved')
    }
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    expect(component).toContain('Analyze selected sources')
  })
})

describe('PWS-AI-01-FAST-01 honest empty state directs to Media & resources, never fabricates a file', () => {
  const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')

  it('shows an honest empty state with a link to Media & resources when nothing is associated yet', () => {
    expect(component).toContain('This product has no associated files yet.')
    expect(component).toContain('mediaResourcesHref')
  })

  it('never fabricates a real product\'s file name when the list is empty', () => {
    expect(component).not.toContain('LT-180C')
    expect(component).not.toContain('Datasheet.pdf')
  })
})

describe('PWS-AI-01-FAST-01 never displays restricted or fabricated data', () => {
  it('never renders a bare Directus file UUID, raw source text, locator, internal note, or download link', () => {
    for (const file of AI_INTAKE_FILES) {
      const source = repoFile(file)
      expect(source).not.toContain('raw_excerpt')
      expect(source).not.toContain('source_locator')
      expect(source.toLowerCase()).not.toMatch(/>\s*download\s*</)
      expect(source).not.toMatch(/<a\s[^>]*href/)
    }
  })

  it('the display-name helper never falls back to any fragment of the file UUID', () => {
    const util = repoFile('utils/productWorkspace.ts')
    const block = util.slice(util.indexOf('export function aiIntakeFileDisplayName'), util.indexOf('export function mediaReadableLabel'))
    expect(block).not.toContain('directus_files_id')
  })

  it('the template never interpolates directus_files_id directly', () => {
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    const template = component.slice(component.indexOf('<template>'), component.lastIndexOf('</template>'))
    expect(template).not.toMatch(/\{\{\s*m\.directus_files_id\s*\}\}/)
  })
})

describe('PWS-AI-01-FAST-01 has no AI, upload, publish, or lifecycle surface', () => {
  it('no file renders an upload entry point or calls a publish/lifecycle endpoint', () => {
    for (const file of AI_INTAKE_FILES) {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('<input type="file"')
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain("status: 'published'")
      expect(lower).not.toContain('submit for review')
    }
  })
})

describe('PWS-AI-01-FAST-01 375px stacking, no horizontal overflow substitute', () => {
  it('the 375px breakpoint stacks the file grid into a single column', () => {
    const component = repoFile('components/admin/workspace/WorkspaceAiSourceIntake.vue')
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('grid-template-columns: 1fr')
  })
})

describe('PWS-AI-01-FAST-01 is English-first and carries no Chinese', () => {
  it('no file has visible or assistive Chinese in its template', () => {
    for (const file of AI_INTAKE_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})
