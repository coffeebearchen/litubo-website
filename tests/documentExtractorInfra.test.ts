/**
 * AI-PDF-SOURCE-01 — the repository side of the isolation: Compose, the
 * Dockerfile, runtime configuration, and "no new npm package".
 *
 * A file saying something is not Docker enforcing it, so the same limits are
 * also read back from the running containers with `docker inspect` (see
 * `tests/documentExtractorIntegration.test.ts` and CURRENT-STATE). These tests
 * keep the committed configuration from drifting away from what was verified.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')

/** The text of one top-level Compose service, from its key up to the next service or top-level key. */
function serviceBlock(compose: string, name: string): string {
  const start = compose.indexOf(`\n  ${name}:\n`)
  if (start === -1) throw new Error(`service ${name} not found`)
  const rest = compose.slice(start + 1)
  const next = rest.slice(1).search(/\n {2}[a-z][\w-]*:\n|\nnetworks:\n/)
  return next === -1 ? rest : rest.slice(0, next + 1)
}

describe('docker-compose.yml — document-extractor', () => {
  const compose = repoFile('docker-compose.yml')
  const extractor = serviceBlock(compose, 'document-extractor')
  const gateway = serviceBlock(compose, 'document-extractor-gateway')

  it('is resource-limited: 512 MB with no extra swap, one CPU, 64 PIDs', () => {
    expect(extractor).toContain('mem_limit: 512m')
    expect(extractor).toContain('memswap_limit: 512m')
    expect(extractor).toContain('cpus: 1.0')
    expect(extractor).toContain('pids_limit: 64')
  })

  it('runs read-only with a 64 MB tmpfs /tmp, every capability dropped, no-new-privileges and an init process', () => {
    expect(extractor).toContain('read_only: true')
    expect(extractor).toMatch(/tmpfs:\n\s+- \/tmp:size=64m,mode=1777,noexec,nosuid,nodev\n/)
    expect(extractor).toMatch(/cap_drop:\n\s+- ALL\n/)
    expect(extractor).not.toContain('cap_add')
    expect(extractor).toContain('no-new-privileges:true')
    expect(extractor).toContain('init: true')
  })

  it('gets no secrets, no environment file, no volume and publishes no port', () => {
    for (const forbidden of ['env_file', 'environment:', 'volumes:', 'ports:', '${']) {
      expect(extractor, forbidden).not.toContain(forbidden)
    }
  })

  it('joins only its internal network, and that network has no route out', () => {
    expect(extractor).toMatch(/networks:\n\s+- document-extractor-internal\n/)
    expect(extractor).not.toContain('litubo-internal')
    expect(compose).toMatch(/\n {2}document-extractor-internal:\n\s+driver: bridge\n\s+internal: true\n/)
  })

  it('the gateway publishes 127.0.0.1:8787 only, runs gateway.mjs, and is locked down the same way', () => {
    expect(gateway).toContain('- "127.0.0.1:8787:8787"')
    expect(compose).not.toMatch(/0\.0\.0\.0:8787|- "8787:8787"/)
    expect(gateway).toContain('command: ["node", "gateway.mjs"]')
    expect(gateway).toContain('read_only: true')
    expect(gateway).toMatch(/cap_drop:\n\s+- ALL\n/)
    expect(gateway).toContain('no-new-privileges:true')
    expect(gateway).toMatch(/networks:\n\s+- document-extractor-internal\n\s+- document-extractor-edge\n/)
    for (const forbidden of ['env_file', 'environment:', 'volumes:', 'litubo-internal', '${']) {
      expect(gateway, forbidden).not.toContain(forbidden)
    }
  })
})

describe('document-extractor/Dockerfile', () => {
  const dockerfile = repoFile('document-extractor/Dockerfile')

  it('pins the official Node 22.22.2 bookworm-slim image by digest — never latest or a floating tag', () => {
    expect(dockerfile).toMatch(/^FROM node:22\.22\.2-bookworm-slim@sha256:[0-9a-f]{64}$/m)
    expect(dockerfile.match(/^FROM .*$/gm)).toHaveLength(1)
  })

  it('installs only poppler-utils and util-linux, without recommended packages, and keeps no apt lists', () => {
    expect(dockerfile).toContain('apt-get install -y --no-install-recommends poppler-utils util-linux')
    expect(dockerfile).toContain('rm -rf /var/lib/apt/lists/*')
    for (const unwanted of ['tesseract', 'libvips', 'libreoffice', 'ghostscript', 'python', 'curl', 'wget', 'npm ', 'package.json']) {
      expect(dockerfile.toLowerCase(), unwanted).not.toContain(unwanted)
    }
  })

  it('copies only the three service files and runs as the unprivileged node user', () => {
    expect(dockerfile.match(/^COPY .*$/gm)).toEqual(['COPY extractor.mjs gateway.mjs server.mjs ./'])
    expect(dockerfile).toMatch(/^USER node$/m)
  })

  it('the service directory holds exactly the Dockerfile and three files — no package manifest, no dependencies', () => {
    expect(readdirSync(resolve(process.cwd(), 'document-extractor')).sort()).toEqual(['Dockerfile', 'extractor.mjs', 'gateway.mjs', 'server.mjs'])
  })
})

describe('runtime configuration', () => {
  it('the sidecar address is server-only runtime config, defaulting to the loopback gateway', () => {
    const config = repoFile('nuxt.config.ts')
    expect(config).toContain('documentExtractorUrl: process.env.DOCUMENT_EXTRACTOR_URL ?? \'http://127.0.0.1:8787\'')
    const publicStart = config.indexOf('public: {')
    const publicBlock = config.slice(publicStart, config.indexOf('},', publicStart))
    expect(publicBlock).not.toContain('documentExtractor')
  })

  it('.env.example documents it with the non-secret local value and the runtime override name', () => {
    const example = repoFile('.env.example')
    expect(example).toContain('\nDOCUMENT_EXTRACTOR_URL=http://127.0.0.1:8787\n')
    expect(example).toContain('NUXT_DOCUMENT_EXTRACTOR_URL')
  })

  it('no browser-side code imports the client or knows the sidecar address', () => {
    const offenders: string[] = []
    for (const dir of ['pages', 'components', 'composables', 'layouts', 'utils', 'plugins', 'middleware']) {
      let entries: string[]
      try {
        entries = readdirSync(resolve(process.cwd(), dir), { recursive: true }) as string[]
      }
      catch {
        continue
      }
      for (const entry of entries) {
        if (!/\.(vue|ts|js|mjs)$/.test(entry)) continue
        const text = readFileSync(resolve(process.cwd(), dir, entry), 'utf8')
        if (/documentExtractorClient|:8787|extract\/pdf/.test(text)) offenders.push(`${dir}/${entry}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('no npm package beyond the authorised ones', () => {
  /**
   * AI-PDF-SOURCE-01 added no package at all. AI-XLSX-SOURCE-01 was authorised
   * exactly two runtime packages, yauzl and saxes, pinned to exact versions —
   * plus @types/yauzl, because yauzl ships no types of its own.
   */
  it('dependencies and devDependencies are the pre-AI-PDF-SOURCE-01 set plus the authorised workbook packages', () => {
    const pkg = JSON.parse(repoFile('package.json')) as { dependencies: Record<string, string>, devDependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@nuxtjs/i18n', '@types/sanitize-html', 'nodemailer', 'nuxt', 'sanitize-html', 'saxes', 'yauzl', 'zod'])
    expect(Object.keys(pkg.devDependencies).sort()).toEqual([
      '@nuxt/eslint', '@types/node', '@types/nodemailer', '@types/yauzl', '@vitejs/plugin-vue', '@vue/test-utils', 'happy-dom', 'typescript', 'vitest', 'vue-tsc',
    ])
  })

  it('pins the workbook packages to exact versions', () => {
    const pkg = JSON.parse(repoFile('package.json')) as { dependencies: Record<string, string>, devDependencies: Record<string, string> }
    for (const version of [pkg.dependencies.yauzl, pkg.dependencies.saxes, pkg.devDependencies['@types/yauzl']]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })
})
