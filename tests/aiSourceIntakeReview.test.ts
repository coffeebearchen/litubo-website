/**
 * PWS-AI-ENGINE-01 — AI Source Intake (rebuilt) + AI Proposal Review (new).
 * Source-level assertions, matching this repo's established pattern for
 * page/component coverage (see tests/productWorkspaceOverview.test.ts and
 * tests/aiProviderRegistry.test.ts) since no component-mounting harness is
 * configured (`vitest.config.ts` uses `environment: 'node'`).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { workspaceAiProposalReviewRoute } from '../utils/productCentre'
import { isTextSourceMime } from '../utils/aiProposal'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

function renderedMarkup(source: string): string {
  return source
    .slice(source.indexOf('<template>'), source.lastIndexOf('</template>'))
    .replace(/<!--[\s\S]*?-->/g, '')
}

const SOURCE_INTAKE_PAGE = 'pages/admin/product-workspace/[id]/ai-source-intake.vue'
const SOURCE_INTAKE_COMPONENT = 'components/admin/workspace/WorkspaceAiSourceIntake.vue'
const REVIEW_PAGE = 'pages/admin/product-workspace/[id]/ai-proposal-review.vue'
const REVIEW_COMPONENT = 'components/admin/workspace/WorkspaceAiProposalReview.vue'
const ALL_AI_UI_FILES = [SOURCE_INTAKE_PAGE, SOURCE_INTAKE_COMPONENT, REVIEW_PAGE, REVIEW_COMPONENT]

describe('workspaceAiProposalReviewRoute', () => {
  it('builds the expected route and is not part of WORKSPACE_MODULE_NAV', () => {
    expect(workspaceAiProposalReviewRoute(42)).toBe('/admin/product-workspace/42/ai-proposal-review')
    const nav = repoFile('utils/productWorkspace.ts')
    expect(nav).not.toContain('ai-proposal-review')
  })
})

describe('isTextSourceMime (client mirror of the server allowlist)', () => {
  it('agrees with the server allowlist on the supported types', () => {
    for (const mime of [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'text/tab-separated-values',
      'text/plain',
    ]) {
      expect(isTextSourceMime(mime)).toBe(true)
    }
  })

  it('rejects images and other unsupported types', () => {
    expect(isTextSourceMime('image/jpeg')).toBe(false)
    expect(isTextSourceMime(null)).toBe(false)
  })
})

describe('AI Source Intake — the old no-op Continue behavior has been removed', () => {
  const component = repoFile(SOURCE_INTAKE_COMPONENT)

  it('no longer contains "Continue to proposal review" or the local no-op continueClicked state', () => {
    expect(component).not.toContain('Continue to proposal review')
    expect(component).not.toContain('continueClicked')
    expect(component).not.toContain('The next step is not built yet')
  })

  it('the real primary action is the high-contrast Analyze button', () => {
    expect(component).toContain('Analyze selected sources')
    expect(component).toContain("emit('analyze')")
  })
})

describe('AI Source Intake — 4-step flow indicator', () => {
  const component = repoFile(SOURCE_INTAKE_COMPONENT)

  it('shows all four named steps with "Select sources" as current', () => {
    for (const step of ['Select sources', 'Analyze', 'Review proposals', 'Apply to Draft']) {
      expect(component).toContain(step)
    }
    expect(component).toContain('ws-step--current')
  })
})

describe('AI Source Intake — Provider status and gating', () => {
  const component = repoFile(SOURCE_INTAKE_COMPONENT)

  it('shows "AI provider is not configured." when no provider is configured', () => {
    expect(component).toContain('AI provider is not configured.')
  })

  it('Analyze is disabled unless at least one analyzable file is selected and a provider is configured', () => {
    expect(component).toContain('canAnalyze')
    expect(component).toContain('hasConfiguredProvider')
    expect(component).toContain(':disabled="!canAnalyze"')
  })

  it('shows the exact required pre-click prompt once something is selected', () => {
    expect(component).toContain('Selected text sources will be sent to the configured AI provider')
    expect(component).toContain('Nothing will be written or published.')
  })

  it('an unsupported file (e.g. an image) is shown as "Not available for text-source analysis yet", never as selectable', () => {
    expect(component).toContain('Not available for text-source analysis yet')
    expect(component).toContain(':disabled="!isAnalyzable(m)"')
  })
})

describe('AI Source Intake page — selected mediaIds only ever travel in the POST body', () => {
  const page = repoFile(SOURCE_INTAKE_PAGE)

  it('the generate call sends mediaIds in the request body, never appended to a URL or route', () => {
    const block = page.slice(page.indexOf('async function analyze'), page.indexOf('} catch'))
    expect(block).toContain('body: { providerId: selectedProviderId.value, mediaIds: [...selectedIds.value] }')
    expect(block).not.toMatch(/mediaIds.*[?&]/)
  })

  it('never puts a selected id into router.push or a query object', () => {
    expect(page).not.toMatch(/router\.push\([^)]*selectedIds/)
    expect(page).not.toMatch(/query:\s*\{[^}]*selectedIds/)
  })

  it('only the explicit analyze() call issues a write-shaped request — page load and toggling are $fetch-free', () => {
    const beforeAnalyze = page.slice(0, page.indexOf('async function analyze'))
    expect(beforeAnalyze).not.toContain('$fetch')
    const toggleBlock = page.slice(page.indexOf('function toggleSelection'), page.indexOf('const analyzing'))
    expect(toggleBlock).not.toContain('$fetch')
  })
})

describe('AI Proposal Review — honest empty state on refresh / direct open', () => {
  const page = repoFile(REVIEW_PAGE)

  it('shows the exact required empty-state text when there is no active proposal', () => {
    expect(page).toContain('No active proposal. Return to AI Source Intake.')
  })

  it('the proposal session is sourced only from useAiProposalSession(), never a route param or query', () => {
    expect(page).toContain('useAiProposalSession()')
    expect(page).not.toContain('route.query')
  })

  it('hasActiveProposal requires both a non-null session AND a matching productId — a stale session for another product does not leak through', () => {
    expect(page).toContain('proposalSession.value.productId === productId')
  })
})

describe('AI Proposal Review — Accept / Reject / Edit and accepted-gated Apply', () => {
  const component = repoFile(REVIEW_COMPONENT)

  it('every item starts Pending, never pre-accepted', () => {
    expect(component).toContain("status: 'pending' as const")
  })

  it('provides independent accept/reject/edit actions per row', () => {
    expect(component).toContain('function acceptRow')
    expect(component).toContain('function rejectRow')
    expect(component).toContain('function startEdit')
    expect(component).toContain('function saveEdit')
  })

  it('Apply is disabled when accepted count is 0', () => {
    expect(component).toContain('acceptedCount.value > 0')
    expect(component).toContain(':disabled="!canApply"')
  })

  it('displays a visible accepted count', () => {
    expect(component).toContain('{{ acceptedCount }} accepted')
  })
})

describe('AI Proposal Review — "Review required" for existing/matching specification names', () => {
  const component = repoFile(REVIEW_COMPONENT)

  it('matches proposed parameters against existing spec item labels by normalized name', () => {
    expect(component).toContain('existingByName')
    expect(component).toContain('normalize(it.parameter)')
  })

  it('shows the literal "Review required" label and the current value when a match exists', () => {
    expect(component).toContain('Review required')
    expect(component).toContain('Current value:')
  })

  it('the user must explicitly choose Add or Update — the accept action label makes this concrete, not implicit', () => {
    expect(component).toContain('Accept as Update')
    expect(component).toContain('Accept as Add')
  })
})

describe('AI Proposal Review — only accepted items are ever sent to Apply', () => {
  const component = repoFile(REVIEW_COMPONENT)

  it("applyAccepted() filters to status === 'accepted' before building the request", () => {
    const block = component.slice(component.indexOf('async function applyAccepted'), component.indexOf('</script>'))
    expect(block).toContain("filter((r: ReviewRow) => r.status === 'accepted')")
  })

  it('a matched row sends action "update" with its real specItemId; an unmatched row sends action "add"', () => {
    const block = component.slice(component.indexOf('async function applyAccepted'), component.indexOf('</script>'))
    expect(block).toContain("action: 'update' as const")
    expect(block).toContain("action: 'add' as const")
  })
})

describe('AI Proposal Review — no automatic overwrite, publish, or unrelated writes', () => {
  for (const file of [REVIEW_PAGE, REVIEW_COMPONENT]) {
    it(`${file} never calls publish/submit-for-review or writes Page Content/FAQ/Media`, () => {
      const lower = repoFile(file).toLowerCase()
      expect(lower).not.toContain('/publish')
      expect(lower).not.toContain('submit for review')
      expect(lower).not.toContain("status: 'published'")
      expect(lower).not.toContain('/sections')
      expect(lower).not.toContain('/faq')
      expect(lower).not.toContain('/media/')
    })
  }

  it('applying is only ever true while the one Apply request is in flight — no auto-apply on mount', () => {
    const page = repoFile(REVIEW_PAGE)
    expect(page).not.toContain('onMounted')
  })
}
)

describe('PWS-AI-ENGINE-01 UI never leaks a file UUID, path, download URL, locator, or internal note', () => {
  for (const file of ALL_AI_UI_FILES) {
    it(`${file} template never renders directus_files_id, a raw path, or a download link`, () => {
      const source = repoFile(file)
      const template = source.includes('<template>') ? renderedMarkup(source) : source
      expect(template).not.toContain('directus_files_id')
      expect(template).not.toMatch(/<a\s[^>]*href/)
      expect(source).not.toContain('source_locator')
      expect(source).not.toContain('raw_excerpt')
    })
  }
})

describe('PWS-AI-ENGINE-01 UI files are English-first with no visible Chinese', () => {
  it('no AI UI file has visible or assistive Chinese in its template', () => {
    for (const file of ALL_AI_UI_FILES) {
      expect(renderedMarkup(repoFile(file))).not.toMatch(/[一-鿿]/)
    }
  })
})

describe('PWS-AI-ENGINE-01 UI 375px stacking, no horizontal-scroll substitute', () => {
  it('WorkspaceAiSourceIntake stacks its file grid to a single column at 767px', () => {
    const component = repoFile(SOURCE_INTAKE_COMPONENT)
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('grid-template-columns: 1fr')
  })

  it('WorkspaceAiProposalReview stacks its proposal table into cards at 767px', () => {
    const component = repoFile(REVIEW_COMPONENT)
    const mobileBlock = component.slice(component.indexOf('max-width: 767px'))
    expect(mobileBlock).toContain('display: block')
    expect(mobileBlock).not.toContain('overflow-x: auto')
  })
})

describe('Settings AI card — English, real provider status, no key display', () => {
  const page = repoFile('pages/admin/settings.vue')

  it('no longer shows the stale Phase M5 / disconnected Chinese placeholder', () => {
    expect(page).not.toContain('未连接（Phase M5 规划中）')
    expect(page).not.toContain('Phase M5')
  })

  it('fetches the real safe provider status endpoint', () => {
    expect(page).toContain("$fetch<AiProviderSummary[]>('/api/admin/ai/providers')")
  })

  it('never renders an API key input or a raw key value', () => {
    const template = renderedMarkup(page)
    const aiCardBlock = template.slice(template.indexOf('Security &amp; AI connection'))
    expect(aiCardBlock).not.toMatch(/<input[^>]*api.?key/i)
    expect(aiCardBlock.toLowerCase()).not.toContain('sk-')
  })

  it('the AI card heading and status copy are English', () => {
    const template = renderedMarkup(page)
    const aiCardBlock = template.slice(template.indexOf('Security &amp; AI connection'), template.indexOf('Security &amp; AI connection') + 800)
    expect(aiCardBlock).not.toMatch(/[一-鿿]/)
  })
})
