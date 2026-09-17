/**
 * FINAL-RELEASE-SECURITY-REMEDIATION-01 — the Directus license key is a runtime secret with one project name.
 *
 * Directus 12 reads `LICENSE_KEY`. The project supplies it as `DIRECTUS_LICENSE_KEY` — the same convention as
 * `DIRECTUS_SECRET` → `SECRET` — and docker-compose.yml is the only place that hands it to a container. The
 * value lives in the ignored .env locally and in the deployment secret manager in production. These tests pin
 * that wiring and keep any key-shaped value out of the repository; they never read .env.
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')

/** The text of one top-level Compose service, from its key up to the next service or top-level key. */
function serviceBlock(compose: string, name: string): string {
  const start = compose.indexOf(`\n  ${name}:\n`)
  if (start === -1) throw new Error(`service ${name} not found`)
  const rest = compose.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n|\nnetworks:\n/)
  return next === -1 ? rest : rest.slice(0, next + 1)
}

/** Every TypeScript source under server/, as repo-relative forward-slash paths. */
const serverSources = (dir = resolve(process.cwd(), 'server')): Array<{ path: string, text: string }> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) return serverSources(full)
    if (!entry.name.endsWith('.ts')) return []
    return [{ path: relative(process.cwd(), full).split(sep).join('/'), text: readFileSync(full, 'utf8') }]
  })

// Directus license keys (@directus/license 0.4.0): 25 characters of this alphabet, starting with "D", the last one
// a Luhn mod 32 checksum of the first 24, written in five dash-separated groups or as one run.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function luhnChecksum(payload: string): string {
  let sum = 0
  for (let i = 0; i < payload.length; i++) {
    const value = ALPHABET.indexOf(payload.at(-(1 + i))!)
    if ((i + 1) % 2 !== 0) {
      let doubled = value * 2
      if (doubled >= 32) doubled -= 31
      sum += doubled
    }
    else {
      sum += value
    }
  }
  return ALPHABET[(32 - (sum % 32)) % 32]!
}

// Grouped form, or a single 25-character run standing alone as a value (so runs inside base64 hashes do not count).
const KEY_CANDIDATES = [
  /(?<![0-9A-Za-z+/_-])[0-9A-Za-z]{5}(?:-[0-9A-Za-z]{5}){4}(?![0-9A-Za-z+/_=-])/g,
  /(?<=^|[\s"'`=:,])[0-9A-Za-z]{25}(?=$|[\s"'`,])/gm,
]

/** Whether a text holds something that validates as a Directus license key. Never returns the match. */
function containsLicenseKey(text: string): boolean {
  return KEY_CANDIDATES.some(pattern => (text.match(pattern) ?? []).some((candidate) => {
    const key = candidate.toUpperCase().replace(/-/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
    return key.startsWith('D')
      && [...key].every(char => ALPHABET.includes(char))
      && luhnChecksum(key.slice(0, 24)) === key[24]
  }))
}

describe('Directus license key — runtime wiring', () => {
  const compose = repoFile('docker-compose.yml')

  it('docker-compose.yml passes it to the Directus container as LICENSE_KEY, from DIRECTUS_LICENSE_KEY only', () => {
    const directus = serviceBlock(compose, 'directus')
    expect(directus.match(/^ {6}LICENSE_KEY: \$\{DIRECTUS_LICENSE_KEY\}$/gm)).toHaveLength(1)
    expect(compose.match(/DIRECTUS_LICENSE_KEY/g)).toHaveLength(1)
    // An offline license token is Enterprise-only; LITUBO uses a key, and Directus refuses to start with both.
    expect(compose).not.toContain('LICENSE_TOKEN')
  })

  it('no other service and no override receives it', () => {
    for (const name of ['postgres', 'document-extractor', 'document-extractor-gateway']) {
      expect(serviceBlock(compose, name), name).not.toContain('LICENSE')
    }
    expect(repoFile('docker-compose.local.yml')).not.toContain('LICENSE')
  })

  it('.env.example declares DIRECTUS_LICENSE_KEY once, with no value, and no second name for it', () => {
    const example = repoFile('.env.example')
    expect(example.match(/^DIRECTUS_LICENSE_KEY=.*$/gm)).toEqual(['DIRECTUS_LICENSE_KEY='])
    expect(example).not.toMatch(/^LICENSE_KEY=/m)
    expect(example).not.toMatch(/^(DIRECTUS_)?LICENSE_TOKEN=/m)
  })

  it('the Nuxt application never reads it, so no build or server bundle can carry it', () => {
    expect(repoFile('nuxt.config.ts')).not.toContain('LICENSE_KEY')
    expect(serverSources().filter(({ text }) => text.includes('LICENSE_KEY')).map(({ path }) => path)).toEqual([])
  })
})

describe('Directus license key — never in Git', () => {
  it('recognises a valid key in its written forms and ignores near misses', () => {
    // Synthetic: the checksum is computed here, so no complete key-shaped literal sits in this file.
    const payload = 'DTEST0SYNTHETC0KEY000000'
    const key = `${payload}${luhnChecksum(payload)}`
    const grouped = key.match(/.{5}/g)!.join('-')
    expect(containsLicenseKey(`DIRECTUS_LICENSE_KEY=${grouped}`)).toBe(true)
    expect(containsLicenseKey(`DIRECTUS_LICENSE_KEY=${key}`)).toBe(true)
    expect(containsLicenseKey(`"${grouped.toLowerCase()}"`)).toBe(true)
    const otherChecksum = ALPHABET[(ALPHABET.indexOf(luhnChecksum(payload)) + 1) % 32]
    expect(containsLicenseKey(`DIRECTUS_LICENSE_KEY=${payload}${otherChecksum}`)).toBe(false)
    expect(containsLicenseKey(`sha512-abc+${key}/def`)).toBe(false)
    expect(containsLicenseKey('DIRECTUS_LICENSE_KEY=')).toBe(false)
  })

  it('no tracked file contains a valid Directus license key', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean)
    const offenders: string[] = []
    for (const path of tracked) {
      const buffer = readFileSync(resolve(process.cwd(), path))
      if (buffer.subarray(0, 8000).includes(0)) continue // binary
      if (containsLicenseKey(buffer.toString('utf8'))) offenders.push(path)
    }
    // Paths only: a failure must never print the key itself.
    expect(offenders).toEqual([])
  })
})
