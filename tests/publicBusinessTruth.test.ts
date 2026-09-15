/**
 * FINAL-RELEASE-FIX-D — public business truth (FINAL-RELEASE-AUDIT-01 P1-05; CLAUDE.md "do not invent
 * certifications"; D-008, D-014, D-020).
 *
 * Source checks over what the public home and Quality & Manufacturing pages render: no DEMO notice or
 * hard-coded demo cards, no unverified certification or compliance claim, no construction instruction, and
 * no certification asset the business has not supplied. Rendered output is checked over real HTTP during
 * module validation; these tests keep the source from regressing.
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

const HOME = 'pages/index.vue'
const QUALITY = 'pages/company/quality-manufacturing.vue'

describe('FINAL-RELEASE-FIX-D — the home page shows no demo content (P1-05, D-014, D-020)', () => {
  it('renders no DEMO notice and keeps no hard-coded demo resource cards', () => {
    expect(template(HOME)).not.toMatch(/DEMO|NOT FOR PUBLIC/i)
    expect(source(HOME)).not.toMatch(/demoResources|demoNotice|demo-notice/)
    for (const title of ['What to look for in an X-ray inspection system', 'Managing false rejects', 'Selecting the right checkweigher']) {
      expect(source(HOME)).not.toContain(title)
    }
  })

  it('renders "Latest from LITUBO" only when it has real items, and none are hard-coded', () => {
    expect(template(HOME)).toMatch(/<section v-if="latestResources\.length" class="home-latest/)
    expect(source(HOME)).toMatch(/const latestResources: [^=]+= \[\]/)
  })

  it('no locale file carries the DEMO notice', () => {
    for (const file of ['i18n/en.json', 'i18n/es.json', 'i18n/pt.json']) {
      const text = source(file)
      expect(text, file).not.toMatch(/demoNotice|NOT FOR PUBLIC/)
      // es.json and pt.json are stored with a UTF-8 byte order mark.
      expect(JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).pages.home, file).not.toHaveProperty('demoNotice')
    }
  })
})

describe('FINAL-RELEASE-FIX-D — Quality & Manufacturing states only what the project can support (P1-05)', () => {
  it('makes no certification or compliance claim', () => {
    for (const claim of [/ISO\s?9001/i, /CE Mark/i, /\bFDA\b/i, /HACCP/i, /certif/i, /complian/i, /standards?\b/i, /accredit/i]) {
      expect(template(QUALITY), String(claim)).not.toMatch(claim)
    }
  })

  it('shows no construction instruction or placeholder note', () => {
    for (const note of [/supply certificate/i, /badge artwork/i, /placeholder/i, /being prepared/i, /being updated/i, /coming soon/i]) {
      expect(template(QUALITY), String(note)).not.toMatch(note)
    }
  })

  it('makes no unverified facility or process claim', () => {
    for (const fact of [/Kunshan/i, /facility/i, /laborator/i, /incoming inspection/i, /functional testing/i, /checkpoint/i, /despatch/i]) {
      expect(template(QUALITY), String(fact)).not.toMatch(fact)
    }
  })

  it('still renders its title, the product specification contact route and the contact CTA', () => {
    const text = template(QUALITY)
    expect(text).toContain("t('pages.quality.heroTitle')")
    expect(text).toContain("localePath('/contact')")
    expect(text).toContain('<CTABanner')
  })
})

describe('FINAL-RELEASE-FIX-D — no fake certification assets', () => {
  it('public/images/certifications holds no certificate or badge file', () => {
    const dir = resolve(root, 'public/images/certifications')
    expect((existsSync(dir) ? readdirSync(dir) : []).filter(name => name !== '.gitkeep')).toEqual([])
  })

  it('no public page, component, layout or English copy references a certification image', () => {
    for (const file of [...publicFiles('pages'), ...publicFiles('components'), ...publicFiles('layouts'), 'i18n/en.json']) {
      expect(source(file), file).not.toMatch(/images\/certifications|cert-(iso9001|ce|fda|haccp)/)
    }
  })
})

describe('FINAL-RELEASE-FIX-D — public runtime sources carry no production marker', () => {
  it('no public page, component, layout or English copy contains a DEMO / TEST marker or a construction instruction', () => {
    const files = [...publicFiles('pages'), ...publicFiles('components'), ...publicFiles('layouts'), 'app.vue', 'error.vue', 'i18n/en.json']
    for (const file of files.filter(f => existsSync(resolve(root, f)))) {
      for (const marker of [/NOT FOR PUBLIC/, /\bTEST ONLY\b/, /supply certificate/i, /badge artwork/i, /placeholder slot/i]) {
        expect(source(file), `${file} ${marker}`).not.toMatch(marker)
      }
    }
  })
})
