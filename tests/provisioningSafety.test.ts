/**
 * PRODUCTION-BOOTSTRAP-SAFETY-01 — the provisioning safety gate (scripts/provisioning-safety.mjs).
 *
 * The decision is tested as the pure function it is: every case hands it a marker reader that counts
 * its calls, so no test here touches /etc/litubo, runs docker or reaches a database. The marker reader
 * itself is tested with an injected file reader. The two runs at the end start the real orchestrator
 * with an empty PATH — no docker binary is reachable even if the gate failed — on command lines the gate
 * refuses before it ever looks for the marker. Every token is random per run and never a credential.
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  ENVIRONMENTS,
  PRODUCTION_DATABASE,
  PRODUCTION_LIKE_NAME_FRAGMENTS,
  PRODUCTION_MARKER_CONTENT,
  PRODUCTION_MARKER_PATH,
  decideProvisioningSafety,
  parseProvisioningRequest,
  readProductionMarker,
} from '../scripts/provisioning-safety.mjs'

type MarkerState = ReturnType<typeof readProductionMarker>

const ABSENT: MarkerState = { state: 'absent' }
const MARKED: MarkerState = { state: 'present', content: PRODUCTION_MARKER_CONTENT }
const unreadable = (code: string): MarkerState => ({ state: 'unreadable', code })

/** The complete, correct production command line. */
const PRODUCTION = [
  '--environment', 'production',
  '--database', 'litubo_cms',
  '--allow-production',
  '--confirm-production-database', 'litubo_cms',
]

/** Decides one command line against a marker state, counting how often the host was consulted. */
function decide(argv: string[], marker: MarkerState = ABSENT) {
  let reads = 0
  const verdict = decideProvisioningSafety(parseProvisioningRequest(argv), () => {
    reads++
    return marker
  })
  return { verdict, reads }
}

describe('provisioning safety gate — the production identity is fixed in one place', () => {
  it('names the environments, the production database and the host marker exactly', () => {
    expect([...ENVIRONMENTS]).toEqual(['local', 'scratch', 'production'])
    expect(PRODUCTION_DATABASE).toBe('litubo_cms')
    expect(PRODUCTION_MARKER_PATH).toBe('/etc/litubo/PRODUCTION')
    expect(PRODUCTION_MARKER_CONTENT).toBe('LITUBO_PRODUCTION_V1')
  })

  it('keeps the old name fragments, which the production database name passes — so a name cannot identify production', () => {
    expect([...PRODUCTION_LIKE_NAME_FRAGMENTS]).toEqual(['prod', 'production', 'live'])
    expect(PRODUCTION_LIKE_NAME_FRAGMENTS.some(f => PRODUCTION_DATABASE.includes(f))).toBe(false)
  })
})

describe('provisioning safety gate — the decision', () => {
  it('A · refuses a run with no --environment, before it consults the host', () => {
    for (const argv of [
      ['--database', 'litubo_provisioning_test_contract'],
      ['--environment', '--database', 'litubo_provisioning_test_contract'],
      ['--environment=', '--database', 'litubo_provisioning_test_contract'],
      [],
    ]) {
      const { verdict, reads } = decide(argv, MARKED)
      expect(verdict, argv.join(' ')).toMatchObject({ ok: false, code: 'ENVIRONMENT_MISSING' })
      expect(reads).toBe(0)
    }
  })

  it('B · refuses any environment that is not exactly local, scratch or production', () => {
    for (const environment of ['prod', 'Production', 'PRODUCTION', 'staging', 'dev', 'test', 'local ', ' scratch']) {
      const { verdict, reads } = decide(['--environment', environment, '--database', 'litubo_scratch'])
      expect(verdict, environment).toMatchObject({ ok: false, code: 'ENVIRONMENT_UNKNOWN' })
      expect(reads).toBe(0)
    }
  })

  it('C · refuses --environment local on a host that carries the production marker', () => {
    const { verdict, reads } = decide(['--environment', 'local', '--database', 'litubo_cms'], MARKED)
    expect(verdict).toMatchObject({ ok: false, code: 'PRODUCTION_HOST' })
    expect(reads).toBe(1)
    // Any marker counts: a host is not "less production" because its marker is malformed.
    expect(decide(['--environment', 'local', '--database', 'litubo_cms'], { state: 'present', content: 'anything' }).verdict)
      .toMatchObject({ ok: false, code: 'PRODUCTION_HOST' })
  })

  it('D · refuses --environment scratch on a host that carries the marker, or whose marker cannot be checked', () => {
    expect(decide(['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract'], MARKED).verdict)
      .toMatchObject({ ok: false, code: 'PRODUCTION_HOST' })
    for (const environment of ['local', 'scratch']) {
      for (const code of ['EACCES', 'EISDIR', 'ENOTDIR', 'UNKNOWN']) {
        const { verdict } = decide(['--environment', environment, '--database', 'litubo_provisioning_test_contract'], unreadable(code))
        expect(verdict, `${environment} ${code}`).toMatchObject({ ok: false, code: 'PRODUCTION_HOST_UNCERTAIN' })
      }
    }
  })

  it('E · refuses production without --allow-production, before it consults the host', () => {
    const { verdict, reads } = decide(PRODUCTION.filter(a => a !== '--allow-production'), MARKED)
    expect(verdict).toMatchObject({ ok: false, code: 'PRODUCTION_NOT_ALLOWED' })
    expect(reads).toBe(0)
  })

  it('F · refuses production without an exact database confirmation', () => {
    for (const argv of [
      ['--environment', 'production', '--database', 'litubo_cms', '--allow-production'],
      ['--environment', 'production', '--database', 'litubo_cms', '--allow-production', '--confirm-production-database'],
      ['--environment', 'production', '--database', 'litubo_cms', '--allow-production', '--confirm-production-database='],
    ]) {
      const { verdict, reads } = decide(argv, MARKED)
      expect(verdict, argv.join(' ')).toMatchObject({ ok: false, code: 'PRODUCTION_CONFIRMATION_MISSING' })
      expect(reads).toBe(0)
    }
  })

  it('G · refuses a confirmation that does not repeat the database exactly', () => {
    for (const confirmation of ['litubo_CMS', 'litubo_cms ', ' litubo_cms', 'litubo_cm', 'litubo_cms_x', 'directus']) {
      const argv = ['--environment', 'production', '--database', 'litubo_cms', '--allow-production', '--confirm-production-database', confirmation]
      const { verdict, reads } = decide(argv, MARKED)
      expect(verdict, JSON.stringify(confirmation)).toMatchObject({ ok: false, code: 'PRODUCTION_CONFIRMATION_MISMATCH' })
      expect(reads).toBe(0)
    }
  })

  it('H · refuses any production database other than litubo_cms, even when it is confirmed', () => {
    for (const database of ['litubo', 'litubo_cms2', 'LITUBO_CMS', 'directus', 'litubo_scratch']) {
      const argv = ['--environment', 'production', '--database', database, '--allow-production', '--confirm-production-database', database]
      const { verdict, reads } = decide(argv, MARKED)
      expect(verdict, database).toMatchObject({ ok: false, code: 'PRODUCTION_DATABASE_NOT_ALLOWED' })
      expect(reads).toBe(0)
    }
  })

  it('I · refuses production on a host without the marker', () => {
    const { verdict, reads } = decide(PRODUCTION, ABSENT)
    expect(verdict).toMatchObject({ ok: false, code: 'PRODUCTION_MARKER_MISSING' })
    expect(reads).toBe(1)
  })

  it('J · refuses production unless the marker holds exactly LITUBO_PRODUCTION_V1, and when it cannot be read', () => {
    for (const content of [
      '',
      'LITUBO_PRODUCTION_V1\n',
      'LITUBO_PRODUCTION_V1\r\n',
      ' LITUBO_PRODUCTION_V1',
      '﻿LITUBO_PRODUCTION_V1',
      'litubo_production_v1',
      'LITUBO_PRODUCTION_V2',
      'LITUBO_PRODUCTION',
    ]) {
      const { verdict } = decide(PRODUCTION, { state: 'present', content })
      expect(verdict, JSON.stringify(content)).toMatchObject({ ok: false, code: 'PRODUCTION_MARKER_MISMATCH' })
    }
    for (const code of ['EACCES', 'EISDIR', 'UNKNOWN']) {
      expect(decide(PRODUCTION, unreadable(code)).verdict, code).toMatchObject({ ok: false, code: 'PRODUCTION_MARKER_UNREADABLE' })
    }
  })

  it('K · passes production only when every requirement holds; the decision runs nothing itself', () => {
    const { verdict, reads } = decide(PRODUCTION, MARKED)
    expect(verdict).toEqual({ ok: true, environment: 'production', database: 'litubo_cms' })
    expect(reads).toBe(1)
    // The inline `--name=value` form is the same command line.
    expect(decide([
      '--environment=production', '--database=litubo_cms', '--allow-production', '--confirm-production-database=litubo_cms',
    ], MARKED).verdict).toEqual({ ok: true, environment: 'production', database: 'litubo_cms' })
  })

  it('L · local and scratch runs that were legal before still pass on a host without the marker', () => {
    // litubo_cms is also the local development database's own name: the name alone never decides.
    for (const environment of ['local', 'scratch']) {
      for (const database of ['litubo_cms', 'litubo_provisioning_test_contract', 'litubo_provisioning_test_access_20260916', 'directus']) {
        const { verdict, reads } = decide(['--environment', environment, '--database', database, '--allow-existing', '--without-service-token'])
        expect(verdict, `${environment} ${database}`).toEqual({ ok: true, environment, database })
        expect(reads).toBe(1)
      }
    }
  })

  it('keeps the name guard for local and scratch targets — as a typo guard, decided before the host is consulted', () => {
    for (const database of ['litubo_prod', 'production_copy', 'LIVE_db', 'prodcms', 'litubo_delivery']) {
      const { verdict, reads } = decide(['--environment', 'scratch', '--database', database])
      expect(verdict, database).toMatchObject({ ok: false, code: 'PRODUCTION_LIKE_NAME' })
      expect(reads).toBe(0)
      if (!verdict.ok) expect(verdict.reason).toContain('never by a name')
    }
  })

  it('refuses production options on a local or scratch run as contradictory', () => {
    for (const argv of [
      ['--environment', 'local', '--database', 'litubo_cms', '--allow-production'],
      ['--environment', 'scratch', '--database', 'litubo_cms', '--confirm-production-database', 'litubo_cms'],
      ['--environment', 'local', '--database', 'litubo_cms', '--confirm-production-database='],
    ]) {
      const { verdict, reads } = decide(argv)
      expect(verdict, argv.join(' ')).toMatchObject({ ok: false, code: 'PRODUCTION_OPTIONS_OUTSIDE_PRODUCTION' })
      expect(reads).toBe(0)
    }
  })

  it('refuses a value option given twice, so a command line has only one reading', () => {
    for (const argv of [
      ['--environment', 'local', '--environment', 'production', '--database', 'litubo_cms'],
      ['--environment', 'production', '--environment=production', ...PRODUCTION.slice(2)],
      ['--environment', 'scratch', '--database', 'litubo_a', '--database=litubo_b'],
      [...PRODUCTION, '--confirm-production-database', 'litubo_cms'],
    ]) {
      const { verdict, reads } = decide(argv, MARKED)
      expect(verdict, argv.join(' ')).toMatchObject({ ok: false, code: 'OPTION_REPEATED' })
      expect(reads).toBe(0)
    }
  })

  it('keeps the existing database refusals: an explicit target, and a plain identifier', () => {
    const missing = decide(['--environment', 'local'])
    expect(missing.verdict).toMatchObject({ ok: false, code: 'DATABASE_MISSING' })
    if (!missing.verdict.ok) expect(missing.verdict.reason).toContain('no target. Pass --database <name>.')
    for (const database of ['litubo-cms', 'a;drop', '1abc', 'x y', 'litubo_cms"']) {
      const { verdict, reads } = decide(['--environment', 'local', '--database', database])
      expect(verdict, database).toMatchObject({ ok: false, code: 'DATABASE_NOT_IDENTIFIER' })
      expect(reads).toBe(0)
    }
  })
})

describe('provisioning safety gate — reading the host marker', () => {
  const failing = (code?: string) => () => {
    throw Object.assign(new Error('simulated'), code === undefined ? {} : { code })
  }

  it('reads the fixed path as UTF-8 and reports what it holds', () => {
    const calls: unknown[][] = []
    const state = readProductionMarker(undefined, (...args: unknown[]) => {
      calls.push(args)
      return PRODUCTION_MARKER_CONTENT
    })
    expect(state).toEqual({ state: 'present', content: PRODUCTION_MARKER_CONTENT })
    expect(calls).toEqual([[PRODUCTION_MARKER_PATH, 'utf8']])
  })

  it('treats only "no such file" as absent', () => {
    expect(readProductionMarker(undefined, failing('ENOENT'))).toEqual({ state: 'absent' })
  })

  it('treats every other failure — a permission, a directory, a broken path — as unreadable', () => {
    for (const code of ['EACCES', 'EPERM', 'EISDIR', 'ENOTDIR', 'ELOOP']) {
      expect(readProductionMarker(undefined, failing(code)), code).toEqual({ state: 'unreadable', code })
    }
    expect(readProductionMarker(undefined, failing())).toEqual({ state: 'unreadable', code: 'UNKNOWN' })
  })
})

describe('provisioning orchestrator — refusals from the real command line', () => {
  /** An empty directory as the whole PATH: whatever happens, no docker binary can be found. */
  const NO_BINARIES = mkdtempSync(join(tmpdir(), 'litubo-no-binaries-'))
  const TOKEN = `test-${randomBytes(24).toString('hex')}`
  afterAll(() => rmSync(NO_BINARIES, { recursive: true, force: true }))

  function run(args: string[]) {
    const env: NodeJS.ProcessEnv = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase() !== 'PATH') env[key] = value
    }
    return spawnSync(process.execPath, ['scripts/provision-directus.mjs', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...env, PATH: NO_BINARIES, DIRECTUS_TOKEN: TOKEN },
    })
  }

  it.each([
    ['the pre-gate command line, with no --environment', ['--database', 'litubo_provisioning_test_contract'], 'no environment. Pass --environment'],
    ['production without --allow-production', ['--environment', 'production', '--database', 'litubo_cms', '--confirm-production-database', 'litubo_cms'], '--environment production also needs --allow-production'],
  ])('refuses %s before any docker call, and prints no secret', (_label, args, reason) => {
    const result = run(args)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`PROVISION FAILED: ${reason}`)
    // The header is printed immediately before the first docker call; a docker attempt would fail as "did not succeed".
    expect(result.stdout).not.toContain('Provisioning "')
    expect(result.stderr).not.toContain('did not succeed')
    expect(`${result.stdout}${result.stderr}`).not.toContain(TOKEN)
  }, 60_000)
})
