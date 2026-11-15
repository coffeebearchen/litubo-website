/**
 * PUBLIC-CLAIMS-CLEANUP-01 — V1 conservative public claims (D-036; PUBLIC-CLAIMS-REVIEW-01).
 *
 * Narrow source checks over the public surfaces the user's frozen business decisions cover: no unverified
 * positioning, coverage, certification or service-network claim; no hard-coded FAQ teaser; no DEMO Application
 * detail and no indexable TODO_CONTENT. Rendered behaviour is checked over real HTTP during module validation.
 *
 * PUBLIC-CLAIMS-HOTFIX-01 extends the same narrow checks to /support/send-product-test, which must not promise
 * a testing laboratory, a free evaluation or a guaranteed test.
 */

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { INDUSTRY_GUIDES, industryGuide } from '../content/industry-guides'

const root = process.cwd()
const source = (file: string) => readFileSync(resolve(root, file), 'utf8')
const template = (file: string) => source(file).split('<template>')[1]!.split('</template>')[0]!

/** Vue, TypeScript and JSON files under a public runtime directory; admin subtrees are excluded. */
function publicFiles(dir: string): string[] {
  const files: string[] = []
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'admin') walk(full)
      }
      else if (/\.(vue|ts|json)$/.test(name)) {
        files.push(relative(root, full).replace(/\\/g, '/'))
      }
    }
  }
  if (existsSync(resolve(root, dir))) walk(resolve(root, dir))
  return files
}

const ABOUT = 'pages/company/about.vue'
const GLOBAL_SERVICE = 'pages/company/global-service.vue'
const HOME = 'pages/index.vue'
const APPLICATIONS_HUB = 'pages/applications/index.vue'
const APPLICATIONS_DETAIL = 'pages/applications/[slug].vue'
const PRODUCT_TEST = 'pages/support/send-product-test.vue'

describe('PUBLIC-CLAIMS-CLEANUP-01 — no unverified company or service claim in public copy (D-036)', () => {
  const BANNED = [
    /global manufacturer/i,
    /worldwide/i,
    /global (network|service network|distributor)/i,
    /authorised (regional )?distributor/i,
    /distributor network/i,
    /factory-trained/i,
    /belt alignment/i,
    /sensitivity validation/i,
    /nearest qualified/i,
    /established distribution/i,
    /supplied with every machine/i,
    /availability and lead times/i,
    /HACCP/i,
    /IP-rated/i,
    /stainless steel/i,
    /redundant detection/i,
    /legal metrology/i,
    /headquartered/i,
    /coverage map/i,
    /Knowledge Center/i,
  ]

  it('no public page, component, layout or English copy carries a banned claim', () => {
    const files = [...publicFiles('pages'), ...publicFiles('components'), ...publicFiles('layouts'), 'app.vue', 'error.vue', 'i18n/en.json']
    for (const file of files.filter(f => existsSync(resolve(root, f)))) {
      const text = source(file)
      for (const claim of BANNED) expect(text, `${file} ${claim}`).not.toMatch(claim)
    }
  })

  it('About keeps the confirmed legal entity, address and enquiry routes', () => {
    const text = template(ABOUT)
    expect(text).toContain('Shanghai NingPin Industrial Dev. Co., Ltd.')
    expect(text).toContain('Kunshan, Jiangsu Province, China')
    expect(text).toContain("localePath('/contact')")
    expect(text).toContain("localePath('/find-a-distributor')")
  })

  it('Global Service describes request routes only, and spare parts are requested rather than ordered', () => {
    const text = source(GLOBAL_SERVICE)
    expect(text).toMatch(/Spare parts can be requested/)
    expect(text).not.toMatch(/ordered directly/i)
    expect(text).not.toMatch(/coverage map|image coming soon|being prepared/i)
  })
})

describe('PUBLIC-CLAIMS-CLEANUP-01 — the home FAQ teaser follows real published FAQ data', () => {
  it('has no hard-coded question and no disabled search box', () => {
    const text = source(HOME)
    for (const question of [
      'What contaminants can X-ray inspection detect?',
      'How does metal detection work with wet or conductive products?',
      'Can LITUBO help with regulatory compliance documentation?',
    ]) {
      expect(text).not.toContain(question)
    }
    expect(text).not.toMatch(/home-faq__search|faqSearch/)
  })

  it('reads published FAQ posts in the current locale and hides the section when there are none', () => {
    const text = source(HOME)
    expect(text).toMatch(/\/api\/cms\/posts\?content_type=faq/)
    expect(text).toMatch(/post\.title\[locale\.value as 'en' \| 'es' \| 'pt'\]/)
    expect(template(HOME)).toMatch(/<section v-if="faqQuestions\.length" class="home-faq/)
  })

  it('no locale file still carries the FAQ search placeholder key', () => {
    for (const file of ['i18n/en.json', 'i18n/es.json', 'i18n/pt.json']) {
      const text = source(file)
      expect(text, file).not.toContain('faqSearch')
      expect(JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).pages.home, file).not.toHaveProperty('faqSearch')
    }
  })
})

describe('Applications: confirmed industries and useful editorial guides, no DEMO facts', () => {
  it('the hub lists the eight confirmed industries from navigation labels and reads no fixture', () => {
    const text = source(APPLICATIONS_HUB)
    for (const key of ['packaged', 'bottled', 'meat', 'frozen', 'bakery', 'nuts', 'powder', 'pharma']) {
      expect(text, key).toContain(`t('nav_applications.${key}')`)
    }
    expect(text).not.toMatch(/useApplications|useApplication\(|useProductCategories|content\/fixtures/)
  })

  it('links exactly the confirmed industry guides', () => {
    expect(INDUSTRY_GUIDES).toHaveLength(8)
    expect(new Set(INDUSTRY_GUIDES.map(guide => guide.slug)).size).toBe(8)
    expect(template(APPLICATIONS_HUB)).toContain('INDUSTRY_GUIDES[index].slug')
    expect(industryGuide('unknown-industry')).toBeUndefined()
  })

  it('unknown routes and unpublished languages remain closed, without any DEMO fixture read', () => {
    const text = source(APPLICATIONS_DETAIL)
    expect(text).toMatch(/createError\(\{ statusCode: 404, fatal: true \}\)/)
    expect(text).toContain('if (!guide)')
    expect(text).toContain('assertPublishedLocale()')
    expect(text).not.toMatch(/content\/fixtures|TODO_CONTENT|DEMO_APPLICATIONS/)
  })

  it('the guides make no invented certifications, results or customer case claims', () => {
    const text = JSON.stringify(INDUSTRY_GUIDES)
    expect(text).not.toMatch(/guaranteed|certified|\bISO\s?9001|99\.\d%|case study|our customer|\b\d+\s?mm\b/i)
    expect(INDUSTRY_GUIDES.every(guide => guide.considerations.length === 4)).toBe(true)
  })

  it('the DEMO Application fixtures are still present for development and tests', () => {
    expect(source('content/fixtures/applications.ts')).toContain('DEMO_APPLICATIONS')
  })
})

describe('PUBLIC-CLAIMS-HOTFIX-01 — Send Product for Test offers a technical review, not a free lab test', () => {
  const PROMISES = [/application lab/i, /free detection/i, /free evaluation/i, /guaranteed testing/i]

  it('the English hero subtitle asks for product details and testing requirements only', () => {
    const text = source('i18n/en.json')
    const copy = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).pages.productTest
    expect(copy.heroSubtitle).toBe('Submit your product details and testing requirements for technical review.')
    for (const promise of PROMISES) expect(copy.heroSubtitle, String(promise)).not.toMatch(promise)
  })

  it('the page renders that copy and makes no testing promise of its own', () => {
    expect(template(PRODUCT_TEST)).toContain("t('pages.productTest.heroSubtitle')")
    for (const promise of PROMISES) expect(source(PRODUCT_TEST), String(promise)).not.toMatch(promise)
  })
})
