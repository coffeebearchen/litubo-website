/**
 * FINAL-RELEASE-SECURITY-REMEDIATION-01 — the Directus 12.3.1 runtime contract.
 *
 * 12.3.1 is the lowest Directus release that fixes every security advisory that applied to 11.17.4
 * (docs/project/SECURITY-REMEDIATION-REVIEW.md). These tests pin what the upgrade and the hardening rely on:
 * the image pin in both places that declare it, the attack-surface settings (official Directus 12.3.1
 * variables only), loopback-only publishing, the CLI entry of an image without npm / npx, and documentation
 * that no longer tells anyone to use commands or variables that do not exist. They read tracked files only.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const DIRECTUS_VERSION = '12.3.1'
const DIRECTUS_IMAGE = 'directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869'

/**
 * Each key is an official Directus 12.3.1 variable with a default in @directus/env 6.2.2 and an entry in the
 * configuration docs, and each value switches off something LITUBO does not use (MARKETPLACE_TRUST has no
 * "off"; `sandbox` is its most restrictive value).
 */
const HARDENING: Record<string, string> = {
  WEBSOCKETS_ENABLED: 'false',
  CACHE_ENABLED: 'false',
  TUS_ENABLED: 'false',
  GRAPHQL_INTROSPECTION: 'false',
  MCP_ENABLED: 'false',
  AI_ENABLED: 'false',
  MARKETPLACE_TRUST: 'sandbox',
  PROJECT_OWNER_ENABLED: 'false',
  TELEMETRY: 'false',
}

const compose = repoFile('docker-compose.yml')
const directus = serviceBlock(compose, 'directus')

describe('Directus 12.3.1 pin', () => {
  it('docker-compose.yml declares exactly the 12.3.1 index digest, once', () => {
    expect(directus).toMatch(/^ {4}image: directus\/directus:12\.3\.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869$/m)
    expect(compose.match(/image: directus\/directus:/g)).toHaveLength(1)
    expect(compose).not.toContain('directus/directus:11.')
  })

  it('the provisioning manifest records the same runtime', () => {
    const manifest = JSON.parse(repoFile('scripts/provisioning-manifest.json')) as { runtime: { directusVersion: string, directusImage: string } }
    expect(manifest.runtime.directusVersion).toBe(DIRECTUS_VERSION)
    expect(manifest.runtime.directusImage).toBe(DIRECTUS_IMAGE)
  })

  it('the local override does not redeclare the Directus image', () => {
    expect(repoFile('docker-compose.local.yml')).not.toMatch(/image:/)
  })
})

describe('Directus attack-surface hardening', () => {
  it.each(Object.entries(HARDENING))('%s is set to %s exactly once, in the Directus service', (key, value) => {
    const lines = directus.split('\n').filter(line => new RegExp(`^ {6}${key}:`).test(line))
    expect(lines).toEqual([`      ${key}: "${value}"`])
    expect(compose.match(new RegExp(`^\\s+${key}:`, 'gm'))).toHaveLength(1)
  })

  it('declares no variable Directus does not have', () => {
    // Directus has no PUBLIC_REGISTRATION variable; registration is the database setting
    // directus_settings.public_registration, which stays false.
    expect(compose).not.toMatch(/PUBLIC_REGISTRATION/)
  })

  it('switches nothing back on and trusts no proxy headers', () => {
    expect(directus).not.toMatch(/^ {6}(WEBSOCKETS_(?:REST|GRAPHQL)_ENABLED|IP_TRUST_PROXY|CORS_ENABLED|EXTENSIONS_AUTO_RELOAD|MCP_OAUTH_ENABLED|AI_TELEMETRY_ENABLED|RATE_LIMITER_ENABLED): "?true"?$/m)
  })

  it('says next to TELEMETRY that the Open Innovation Grant license ignores it', () => {
    const at = directus.indexOf('      TELEMETRY: "false"')
    expect(directus.slice(Math.max(0, at - 400), at)).toContain('telemetry_required = true')
  })

  it('publishes Directus on loopback only', () => {
    const ports = directus.slice(directus.indexOf('    ports:\n'), directus.indexOf('    environment:\n'))
    const published = ports.split('\n').filter(line => /^\s+- "/.test(line)).map(line => line.trim())
    expect(published).toEqual(['- "127.0.0.1:8055:8055"'])
  })
})

describe('Directus CLI and documentation without npx', () => {
  it('provisioning starts the CLI as node cli.js, never npx', () => {
    const orchestrator = repoFile('scripts/provision-directus.mjs')
    expect(orchestrator).toContain(`directusService, 'node', 'cli.js', ...args]`)
    expect(orchestrator).not.toMatch(/'npx'/)
  })

  it.each(['CLAUDE.md', 'docs/ADMIN-CMS-SETUP.md'])('%s gives no npx directus command', (path) => {
    expect(repoFile(path)).not.toMatch(/npx directus/)
  })

  it.each([
    'docs/ADMIN-CMS-SETUP.md',
    'docs/project/PRODUCTION-PROVISIONING-RUNBOOK.md',
    'docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md',
  ])('%s does not expect an anonymous /server/health to succeed', (path) => {
    // Directus 12 answers an unauthenticated /server/health with 403; liveness is /server/ping.
    expect(repoFile(path)).not.toMatch(/server\/health` (?:→|returns) 200|server\/health\n```\n\n期望返回/)
  })

  it.each(['docs/ADMIN-CMS-SETUP.md', 'docs/ADMIN-CMS-SPEC.md'])('%s does not present PUBLIC_REGISTRATION as configuration', (path) => {
    expect(repoFile(path)).not.toContain('PUBLIC_REGISTRATION=false')
  })

  it('the operations handbook does not give a public Directus address', () => {
    expect(repoFile('docs/OPERATIONS-HANDBOOK.md')).not.toMatch(/cms\.litubo\.com|服务器IP:8055/)
  })
})
