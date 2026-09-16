/**
 * FINAL-RELEASE-FIX-F — the V1 product lifecycle contract (D-037).
 *
 * Draft is the only editable state. Review, Published and Archived are
 * read-only, and a published product must be returned to Draft before it can be
 * edited again. This file proves the parts of that contract which can be proven
 * without a live Directus: that EVERY product business write route goes through
 * the one shared guard, that the status machine has a single definition, that
 * the four public product outputs share one publication rule, and that the AI
 * Apply release gate fails closed.
 *
 * Behaviour that needs a request — the 409s themselves — is covered by
 * `tests/productV1AiApplyAuthority.test.ts` and the existing endpoint-boundary
 * suite.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  ALLOWED_TRANSITIONS,
  MUTABLE_STATUSES,
  PRODUCT_STATUS_VALUES,
  isAllowedTransition,
} from '../server/utils/productLifecycle'
import { isProductAiApplyEnabled } from '../server/utils/productAiApplyGate'

const root = process.cwd()
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')

/** Every file under a directory, recursively, as repo-relative POSIX paths. */
function walk(dir: string): string[] {
  const out: string[] = []
  const absolute = resolve(root, dir)
  const recurse = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) recurse(full)
      else out.push(relative(root, full).replace(/\\/g, '/'))
    }
  }
  recurse(absolute)
  return out
}

/** Product routes that write business data. */
const WRITE_ROUTES = walk('server/api/admin/products')
  .filter(file => /\.(post|patch|put|delete)\.ts$/.test(file))
  // Creating a product is the one write that cannot require an existing Draft:
  // it establishes one (`status: 'draft'` is set server-side, not by the client).
  .filter(file => file !== 'server/api/admin/products/index.post.ts')
  // The base PATCH is both the lifecycle route and a content route; it is
  // asserted separately below because it must allow a status change on a
  // product that is deliberately not a Draft.
  .filter(file => file !== 'server/api/admin/products/[id].patch.ts')
  // Generate calls a provider and writes nothing.
  .filter(file => !file.endsWith('specification-proposal/generate.post.ts'))

describe('FINAL-RELEASE-FIX-F — every product business write goes through one Draft guard', () => {
  it('finds the write routes it is supposed to be checking', () => {
    // A sanity floor: if the route tree is restructured and this scan silently
    // matches nothing, the assertions below would pass vacuously.
    expect(WRITE_ROUTES.length).toBeGreaterThanOrEqual(20)
  })

  it.each(WRITE_ROUTES)('%s asserts the product is a Draft before writing', (file) => {
    const text = source(file)
    expect(text).toContain('assertProductDraftForMutation')
    // The old existence-only check must not be what guards a write any more.
    expect(text).not.toMatch(/\bassertProductExists\s*\(/)
  })

  it('the guard itself is the only place the editable states are decided', () => {
    expect(MUTABLE_STATUSES).toEqual(['draft'])
    for (const status of PRODUCT_STATUS_VALUES) {
      if (status === 'draft') continue
      expect(MUTABLE_STATUSES).not.toContain(status)
    }
  })

  it('creating a product still forces Draft server-side', () => {
    expect(source('server/api/admin/products/index.post.ts')).toMatch(/status:\s*'draft'/)
  })
})

describe('FINAL-RELEASE-FIX-F — a status change is separated from a content change', () => {
  const patchRoute = source('server/api/admin/products/[id].patch.ts')

  it('refuses a request that carries both a status and business fields', () => {
    expect(patchRoute).toMatch(/wantsStatusChange && \(contentKeys\.length > 0 \|\| wantsProductCode\)/)
    expect(patchRoute).toMatch(/A status change must be sent on its own/)
  })

  it('writes only status and published_at on a lifecycle request', () => {
    const lifecycleBranch = patchRoute.split('if (wantsStatusChange) {')[1]!.split('else {')[0]!
    expect(lifecycleBranch).toMatch(/payload\.status = nextStatus/)
    expect(lifecycleBranch).toMatch(/payload\.published_at/)
    for (const field of ['name_en', 'slug', 'category_id', 'summary_en', 'review_notes', 'product_code']) {
      expect(lifecycleBranch).not.toMatch(new RegExp(`payload\\.${field}\\s*=`))
    }
  })

  it('refuses a content change unless the product is a Draft', () => {
    expect(patchRoute).toMatch(/lifecycle\.status !== 'draft'/)
    expect(patchRoute).toContain('NOT_DRAFT_MESSAGE')
  })

  it('imports the shared state machine rather than keeping its own copy', () => {
    expect(patchRoute).toContain("from '~/server/utils/productLifecycle'")
    expect(patchRoute).not.toMatch(/const ALLOWED_TRANSITIONS/)
  })
})

describe('FINAL-RELEASE-FIX-F — the status machine has one definition', () => {
  it('keeps the transitions the server has always enforced', () => {
    expect(ALLOWED_TRANSITIONS).toEqual({
      draft: ['review'],
      review: ['draft', 'published'],
      published: ['draft'],
    })
  })

  it('allows the V1 lifecycle and refuses everything else', () => {
    expect(isAllowedTransition('draft', 'review')).toBe(true)
    expect(isAllowedTransition('review', 'published')).toBe(true)
    expect(isAllowedTransition('review', 'draft')).toBe(true)
    expect(isAllowedTransition('published', 'draft')).toBe(true)
    // No cross-step publish, and archived is neither reachable nor escapable.
    expect(isAllowedTransition('draft', 'published')).toBe(false)
    expect(isAllowedTransition('published', 'review')).toBe(false)
    expect(isAllowedTransition('archived', 'draft')).toBe(false)
    expect(isAllowedTransition('draft', 'archived')).toBe(false)
  })

  it('the publish panel offers exactly the transitions the server allows', () => {
    const panel = source('components/admin/product/PublishPanel.vue')
    const table = panel.split('const transitions')[1]!.split('const currentTransitions')[0]!
    const offered: Record<string, string[]> = {}
    for (const [, status, body] of table.matchAll(/(draft|review|published|archived):\s*(\[[\s\S]*?\])(?=,\n|\n\})/g)) {
      offered[status] = [...body!.matchAll(/target:\s*'(\w+)'/g)].map(m => m[1]!)
    }
    for (const status of PRODUCT_STATUS_VALUES) {
      expect(offered[status] ?? [], status).toEqual([...(ALLOWED_TRANSITIONS[status] ?? [])])
    }
  })
})

describe('FINAL-RELEASE-FIX-F — the four public product outputs share one publication rule', () => {
  /**
   * §17 option B: the queries stay where they are, and this proves they mean
   * the same thing. Every public product output must require a published
   * product; detail, list and related must also require a published category
   * (the sitemap derives its category from the same published-category query).
   */
  const detail = source('server/api/cms/products/[category]/[slug].get.ts')
  const list = source('server/api/cms/products/[category].get.ts')
  const sitemap = source('server/utils/sitemap.ts')
  const related = source('server/utils/contentPublic.ts')

  it.each([
    ['detail', () => detail],
    ['category list', () => list],
    ['sitemap', () => sitemap],
    ['related products', () => related],
  ])('%s requires status = published', (_label, read) => {
    expect(read()).toContain('filter[status][_eq]=published')
  })

  it.each([
    ['detail', () => detail],
    ['category list', () => list],
    ['sitemap', () => sitemap],
    ['related products', () => related],
  ])('%s resolves categories through the published-category query', (_label, read) => {
    // Order is not the contract: detail filters by slug first and related by an
    // id list first. What every output must carry is the published-category
    // query and the published condition on it.
    const text = read()
    expect(text).toContain('product_categories?')
    expect(text).toContain('filter[status][_eq]=published')
  })

  it('the sitemap narrows further on noindex, and never widens', () => {
    expect(sitemap).toContain('filter[seo_noindex][_neq]=true')
    // noindex is an indexing decision, not an unpublish: the public routes must
    // not filter on it.
    expect(detail).not.toContain('seo_noindex][_neq]')
    expect(list).not.toContain('seo_noindex][_neq]')
  })

  it('no public product output accepts draft, review or archived', () => {
    for (const text of [detail, list, sitemap, related]) {
      expect(text).not.toMatch(/filter\[status\]\[_eq\]=(draft|review|archived)/)
      expect(text).not.toMatch(/filter\[status\]\[_neq\]/)
    }
  })
})

describe('FINAL-RELEASE-FIX-F — the AI Apply release gate fails closed', () => {
  it('is closed in production unless explicitly turned on', () => {
    expect(isProductAiApplyEnabled({}, 'production')).toBe(false)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: '' }, 'production')).toBe(false)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: '1' }, 'production')).toBe(false)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: 'yes' }, 'production')).toBe(false)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: 'TRUE' }, 'production')).toBe(true)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: 'true' }, 'production')).toBe(true)
  })

  it('stays available outside production unless explicitly turned off', () => {
    expect(isProductAiApplyEnabled({}, 'development')).toBe(true)
    expect(isProductAiApplyEnabled({}, undefined)).toBe(true)
    expect(isProductAiApplyEnabled({ productAiApplyEnabled: 'false' }, 'development')).toBe(false)
  })

  it('the flag is a plain boolean and never a secret', () => {
    const example = source('.env.example')
    expect(example).toContain('PRODUCT_AI_APPLY_ENABLED=')
    expect(example).toMatch(/PRODUCT_AI_APPLY_ENABLED=\s*$/m)
    const config = source('nuxt.config.ts')
    expect(config).toContain('productAiApplyEnabled')
    // Server-side only: it must sit in runtimeConfig itself, above the nested
    // `public` block that the browser receives.
    const runtimeStart = config.indexOf('runtimeConfig: {')
    const publicStart = config.indexOf('public: {', runtimeStart)
    const flagIndex = config.indexOf('productAiApplyEnabled', runtimeStart)
    expect(runtimeStart).toBeGreaterThan(-1)
    expect(publicStart).toBeGreaterThan(runtimeStart)
    expect(flagIndex).toBeGreaterThan(runtimeStart)
    expect(flagIndex).toBeLessThan(publicStart)
  })

  it('Apply checks the gate before it claims or writes anything', () => {
    const applyRoute = source('server/api/admin/products/[id]/ai/specification-proposal/apply.post.ts')
    const gateIndex = applyRoute.indexOf('assertProductAiApplyEnabled')
    const claimIndex = applyRoute.indexOf('claimApply(')
    const writeIndex = applyRoute.indexOf('executeSpecificationApply(')
    expect(gateIndex).toBeGreaterThan(-1)
    expect(gateIndex).toBeLessThan(claimIndex)
    expect(gateIndex).toBeLessThan(writeIndex)
  })
})

describe('FINAL-RELEASE-FIX-F — AI is Draft-only on the way in as well as on the way out', () => {
  it('Generate refuses a non-Draft product before any provider is reached', () => {
    const generate = source('server/api/admin/products/[id]/ai/specification-proposal/generate.post.ts')
    const statusIndex = generate.indexOf("lifecycle.status !== 'draft'")
    const slotIndex = generate.indexOf('claimGenerateSlot(')
    const engineIndex = generate.indexOf('runProposalEngine(')
    expect(statusIndex).toBeGreaterThan(-1)
    expect(statusIndex).toBeLessThan(slotIndex)
    expect(statusIndex).toBeLessThan(engineIndex)
  })

  it('Product AI sources exclude files archived in the Media Library', () => {
    expect(source('server/utils/aiProposalEngine.ts')).toContain('archivedAmong')
    expect(source('server/api/admin/products/[id]/ai/sources.get.ts')).toContain('archivedAmong')
  })

  it('Apply re-resolves the bound sources and re-checks Draft before writing', () => {
    const applyRoute = source('server/api/admin/products/[id]/ai/specification-proposal/apply.post.ts')
    expect(applyRoute).toContain('resolveProductSourceFiles')
    const recheck = applyRoute.indexOf('readProductLifecycle(event, productId)')
    const writeIndex = applyRoute.indexOf('executeSpecificationApply(')
    expect(recheck).toBeGreaterThan(-1)
    expect(recheck).toBeLessThan(writeIndex)
  })

  it('every path out of a claimed proposal settles or releases it', () => {
    const applyRoute = source('server/api/admin/products/[id]/ai/specification-proposal/apply.post.ts')
    expect(applyRoute).toMatch(/catch \(error\) \{/)
    expect(applyRoute).toContain('releaseApply(proposalRef)')
    expect(applyRoute).toMatch(/settleApply\(proposalRef/)
  })
})
