/**
 * PUBLIC-CLAIMS-CLEANUP-01 — V1 conservative public claims (D-036; PUBLIC-CLAIMS-REVIEW-01).
 *
 * Narrow source checks over the public surfaces the user's frozen business decisions cover: no unverified
 * positioning, coverage, certification or service-network claim; no hard-coded FAQ teaser; no DEMO Application
 * detail and no indexable TODO_CONTENT. Rendered behaviour is checked over real HTTP during module validation.
 */

import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

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

describe('PUBLIC-CLAIMS-CLEANUP-01 — Applications: confirmed categories only, DEMO details closed', () => {
  it('the hub lists the eight confirmed industries from navigation labels and reads no fixture', () => {
    const text = source(APPLICATIONS_HUB)
    for (const key of ['packaged', 'bottled', 'meat', 'frozen', 'bakery', 'nuts', 'powder', 'pharma']) {
      expect(text, key).toContain(`t('nav_applications.${key}')`)
    }
    expect(text).not.toMatch(/useApplications|useApplication\(|useProductCategories|content\/fixtures/)
  })

  it('the hub links to no Application detail route', () => {
    expect(template(APPLICATIONS_HUB)).not.toMatch(/\/applications\/\$\{|applications\/\${app|:to="localePath\(`\/applications\//)
    expect(source(APPLICATIONS_HUB)).not.toMatch(/applications\/\$\{/)
  })

  it('every Application detail URL is a 404 with no indexable metadata and no fixture read', () => {
    const text = source(APPLICATIONS_DETAIL)
    expect(text).toMatch(/createError\(\{ statusCode: 404, fatal: true \}\)/)
    expect(text).toMatch(/noIndex: true/)
    expect(text).not.toMatch(/useApplication|useProductCategories|TODO_CONTENT|seo\.title|seo\.description/)
  })

  it('no public page or component links to an Application detail route', () => {
    for (const file of [...publicFiles('pages'), ...publicFiles('components'), ...publicFiles('layouts')]) {
      expect(source(file), file).not.toMatch(/localePath\('\/applications\/[a-z-]/)
    }
  })

  it('the DEMO Application fixtures are still present for development and tests', () => {
    expect(source('content/fixtures/applications.ts')).toContain('DEMO_APPLICATIONS')
  })
})
