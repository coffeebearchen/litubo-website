/**
 * FINAL-RELEASE-PRODUCTION-READY-03 — PostgreSQL immutable pin and the canonical release entry.
 *
 * Covers `scripts/verify-postgres-pin.mjs` (declaration parsing, drift detection, secret-free contract)
 * and the `release:verify` npm script, which must refuse a wrong Node before any expensive step while
 * leaving the everyday scripts untouched (Controller decision, FINAL-RELEASE-PRODUCTION-READY-03B).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  POSTGRES_PIN_PATTERN,
  SERVER_VERSION_COMMAND,
  checkPostgresDeclaration,
  compareRunningPostgres,
  findPostgresDeclarations,
} from '../scripts/verify-postgres-pin.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PINNED = 'postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685'
const DIGEST = 'sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685'

describe('PostgreSQL pin — repository declaration', () => {
  it('docker-compose.yml declares exactly one PostgreSQL image, pinned to 16.15 and the verified index digest', () => {
    const declarations = findPostgresDeclarations(readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf8'))
    expect(declarations).toEqual([PINNED])
    const checked = checkPostgresDeclaration(declarations[0])
    expect(checked.problems).toEqual([])
    expect(checked.version).toBe('16.15')
    expect(checked.digest).toBe(DIGEST)
  })

  it('the local override file does not re-declare the PostgreSQL image', () => {
    expect(findPostgresDeclarations(readFileSync(resolve(ROOT, 'docker-compose.local.yml'), 'utf8'))).toEqual([])
  })
})

describe('PostgreSQL pin — declaration checks', () => {
  it.each([
    'postgres:16-alpine',
    'postgres:16',
    'postgres:latest',
    'postgres:16.15-alpine',
    'postgres:16.15',
    `postgres@${DIGEST}`,
    'postgres:16.15-alpine@sha256:cf78e766',
    `postgres:16.15-alpine@${DIGEST.toUpperCase()}`,
    `postgres:16.15.1-alpine@${DIGEST}`,
    `postgres:16.15-bookworm@${DIGEST}`,
    '',
  ])('refuses %j', (declared) => {
    const checked = checkPostgresDeclaration(declared)
    expect(checked.version).toBeNull()
    expect(checked.digest).toBeNull()
    expect(checked.problems).toHaveLength(1)
  })

  it('accepts an exact Alpine-minor tag with the digest', () => {
    const checked = checkPostgresDeclaration(`postgres:16.15-alpine3.24@${DIGEST}`)
    expect(checked).toEqual({ version: '16.15', digest: DIGEST, problems: [] })
    expect(POSTGRES_PIN_PATTERN.test(PINNED)).toBe(true)
  })

  it('finds only postgres images, in order, including quoted and commented lines', () => {
    const compose = [
      'services:',
      '  postgres:',
      `    image: "${PINNED}"  # pinned`,
      '  directus:',
      '    image: directus/directus:11.17.4@sha256:eb326f679ae847c0a776f93b972761dc2ebe84980e0b9d274a6bc31cd62809f7',
      '  other:',
      '    image: postgres:16-alpine',
      '  extractor:',
      '    image: litubo-document-extractor:local',
    ].join('\n')
    expect(findPostgresDeclarations(compose)).toEqual([PINNED, 'postgres:16-alpine'])
  })
})

describe('PostgreSQL pin — running comparison', () => {
  const base = {
    declared: PINNED,
    version: '16.15',
    digest: DIGEST,
    runningImage: PINNED,
    repoDigests: [`postgres@${DIGEST}`],
    serverVersion: '16.15\n',
  }

  it('reports nothing when declaration, running image, digest and server version agree', () => {
    expect(compareRunningPostgres(base)).toEqual([])
    expect(compareRunningPostgres({ ...base, serverVersion: '16.15 (Debian 16.15-1.pgdg120+1)' })).toEqual([])
  })

  it('flags a container started from another image reference', () => {
    const problems = compareRunningPostgres({ ...base, runningImage: 'postgres:16-alpine' })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('not the declared')
  })

  it('flags a running image whose repository digests do not include the pin', () => {
    expect(compareRunningPostgres({ ...base, repoDigests: [] })).toHaveLength(1)
    expect(compareRunningPostgres({ ...base, repoDigests: [`postgres@sha256:${'0'.repeat(64)}`] })).toHaveLength(1)
    expect(compareRunningPostgres({ ...base, repoDigests: null })).toHaveLength(1)
  })

  it('flags a server that reports another version, or nothing', () => {
    expect(compareRunningPostgres({ ...base, serverVersion: '16.14' })[0]).toContain('16.14')
    expect(compareRunningPostgres({ ...base, serverVersion: '17.0' })).toHaveLength(1)
    expect(compareRunningPostgres({ ...base, serverVersion: '' })).toHaveLength(1)
  })
})

describe('PostgreSQL pin — command line and secret-free contract', () => {
  it('--declaration-only passes on the repository compose file without Docker', () => {
    const run = spawnSync(process.execPath, ['scripts/verify-postgres-pin.mjs', '--declaration-only'], { cwd: ROOT, encoding: 'utf8' })
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('OK — PostgreSQL is pinned')
    expect(run.stdout).toContain(PINNED)
  })

  it('reads no environment, no .env file and no container configuration beyond image identity', () => {
    const source = readFileSync(resolve(ROOT, 'scripts/verify-postgres-pin.mjs'), 'utf8')
    expect(source).not.toMatch(/process\.env/)
    expect(source).not.toMatch(/['"`]\.env['"`]|dotenv/)
    expect(source).not.toMatch(/Config\.Env|printenv|\benv\b\s*\|/)
    expect(source).not.toMatch(/PGPASSWORD|POSTGRES_PASSWORD|DB_PASSWORD/)
    expect(SERVER_VERSION_COMMAND).toContain('-U "$POSTGRES_USER"')
    expect(SERVER_VERSION_COMMAND).toContain('SHOW server_version')
  })
})

describe('canonical release entry — release:verify', () => {
  const scripts = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>
  const steps = (scripts['release:verify'] ?? '').split('&&').map(s => s.trim())

  it('refuses a wrong Node first, then checks both pins and published TEST data, and builds last', () => {
    expect(steps).toEqual([
      'node scripts/verify-node-runtime.mjs',
      'node scripts/verify-directus-pin.mjs',
      'node scripts/verify-postgres-pin.mjs',
      'node scripts/release-check-test-data.mjs',
      'nuxt build',
    ])
  })

  it('chains every step with && so a failed gate stops the entry before the build', () => {
    expect(scripts['release:verify']).not.toMatch(/;|\|\||(?<!&)&(?!&)/)
  })

  it('leaves the everyday scripts unwrapped: only the canonical release entry is gated', () => {
    for (const name of ['dev', 'build', 'typecheck', 'lint', 'test']) {
      expect(scripts[name], name).not.toContain('verify-node-runtime')
    }
  })
})
