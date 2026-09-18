/**
 * PRODUCTION-BOOTSTRAP-SAFETY-01 — the orchestrator (scripts/provision-directus.mjs) passes its safety gate
 * before its first docker, psql or Directus call.
 *
 * The real script is evaluated in-process, top to bottom, with two doubles. `execFileSync` is the only way
 * the script reaches docker — and through docker PostgreSQL and the Directus CLI — so its double records
 * every call and runs nothing; the host marker reader answers from the test. A refusal can therefore be
 * shown to have made zero docker calls, and a run that passes can be shown to stop at its first,
 * read-only query. Nothing here runs docker, reaches a database or touches /etc/litubo, and the global
 * fetch is replaced so no HTTP request can leave either. Every token is random per run.
 *
 * When the double is given an answer for every call, the script runs the whole manifest; that is how the
 * position of the media folder bootstrap and its verification is pinned (MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01).
 */

import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

type MarkerState = ReturnType<typeof import('../scripts/provisioning-safety.mjs').readProductionMarker>
interface DockerCall { file: string, args: string[], input: string | undefined }

const doubles = vi.hoisted(() => ({
  dockerCalls: [] as DockerCall[],
  dockerAnswers: [] as string[],
  marker: { state: 'absent' } as MarkerState,
  markerReads: 0,
}))

vi.mock('node:child_process', () => ({
  execFileSync: (file: string, args: string[], options: { input?: string } = {}) => {
    doubles.dockerCalls.push({ file, args, input: options.input })
    const answer = doubles.dockerAnswers.shift()
    if (answer !== undefined) return answer
    throw Object.assign(new Error('docker double: nothing is run here'), { stdout: '', stderr: 'docker double: stopped here' })
  },
}))

vi.mock('../scripts/provisioning-safety.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scripts/provisioning-safety.mjs')>()
  return {
    ...actual,
    readProductionMarker: () => {
      doubles.markerReads++
      return doubles.marker
    },
  }
})

class Exit extends Error {
  constructor(readonly code: string | number | null | undefined) {
    super(`process.exit(${code})`)
  }
}

const TOKEN = `test-${randomBytes(24).toString('hex')}`
const ABSENT: MarkerState = { state: 'absent' }
const MARKED: MarkerState = { state: 'present', content: 'LITUBO_PRODUCTION_V1' }
const PRODUCTION = ['--environment', 'production', '--database', 'litubo_cms', '--allow-production', '--confirm-production-database', 'litubo_cms']

/** The first thing a run that passes the gate does: a read-only existence query on the maintenance database. */
const existenceCheck = (database: string): DockerCall => ({
  file: 'docker',
  args: ['compose', '-f', 'docker-compose.yml', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d postgres -X -At -v ON_ERROR_STOP=1'],
  input: `SELECT count(*) FROM pg_database WHERE datname = '${database}';`,
})

interface Run {
  exit: string | number | null | undefined
  stdout: string
  stderr: string
  dockerCalls: DockerCall[]
  markerReads: number
  fetchCalls: number
}

async function runOrchestrator(args: string[], { marker = ABSENT, token = TOKEN, answers = [] as string[] } = {}): Promise<Run> {
  doubles.dockerCalls = []
  doubles.dockerAnswers = [...answers]
  doubles.marker = marker
  doubles.markerReads = 0
  vi.stubEnv('DIRECTUS_TOKEN', token)
  vi.stubEnv('PROVISION_COMPOSE_FILES', undefined)
  vi.stubEnv('PROVISION_PG_SERVICE', undefined)
  vi.stubEnv('PROVISION_DIRECTUS_SERVICE', undefined)

  const stdout: string[] = []
  const stderr: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => stdout.push(String(chunk)) > 0)
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => stderr.push(String(chunk)) > 0)
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Exit(code)
  })
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('no HTTP request may leave this test')
  })

  const argv = process.argv
  process.argv = [process.execPath, 'scripts/provision-directus.mjs', ...args]
  let exit: Run['exit'] = 'finished without exiting'
  try {
    vi.resetModules()
    await import('../scripts/provision-directus.mjs')
  }
  catch (error) {
    if (!(error instanceof Exit)) throw error
    exit = error.code
  }
  finally {
    process.argv = argv
  }
  const fetchCalls = fetchSpy.mock.calls.length
  vi.restoreAllMocks()
  return { exit, stdout: stdout.join(''), stderr: stderr.join(''), dockerCalls: doubles.dockerCalls, markerReads: doubles.markerReads, fetchCalls }
}

/** Refused by the gate: exit 1, the reason printed, and nothing at all reached docker, a database or Directus. */
function expectRefusedBeforeDocker(run: Run, reason: string) {
  expect(run.exit).toBe(1)
  expect(run.stderr).toContain('PROVISION FAILED: ')
  expect(run.stderr).toContain(reason)
  expect(run.dockerCalls).toEqual([])
  expect(run.fetchCalls).toBe(0)
  expect(run.stdout).not.toContain('Provisioning "')
  expect(`${run.stdout}${run.stderr}`).not.toContain(TOKEN)
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('provisioning orchestrator — every refusal happens before the first docker call', () => {
  it('A · the pre-gate command line, with no --environment', async () => {
    const run = await runOrchestrator(['--database', 'litubo_provisioning_test_contract'])
    expectRefusedBeforeDocker(run, 'no environment. Pass --environment local, scratch or production.')
    expect(run.markerReads).toBe(0)
  })

  it('B · an unknown environment', async () => {
    const run = await runOrchestrator(['--environment', 'prod', '--database', 'litubo_provisioning_test_contract'])
    expectRefusedBeforeDocker(run, 'environment "prod" is not one of local, scratch or production.')
    expect(run.markerReads).toBe(0)
  })

  it('C · --environment local on a host that carries the production marker', async () => {
    const run = await runOrchestrator(['--environment', 'local', '--database', 'litubo_cms'], { marker: MARKED })
    expectRefusedBeforeDocker(run, 'this host carries the LITUBO production marker (/etc/litubo/PRODUCTION). --environment local is refused here')
    expect(run.markerReads).toBe(1)
  })

  it('D · --environment scratch on a host that carries the marker, or whose marker cannot be checked', async () => {
    expectRefusedBeforeDocker(
      await runOrchestrator(['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract'], { marker: MARKED }),
      '--environment scratch is refused here',
    )
    expectRefusedBeforeDocker(
      await runOrchestrator(['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract'], { marker: { state: 'unreadable', code: 'EACCES' } }),
      'could not be checked (EACCES)',
    )
  })

  it('E · production without --allow-production', async () => {
    const run = await runOrchestrator(PRODUCTION.filter(a => a !== '--allow-production'), { marker: MARKED })
    expectRefusedBeforeDocker(run, '--environment production also needs --allow-production.')
    expect(run.markerReads).toBe(0)
  })

  it('F · production without the database confirmation', async () => {
    const run = await runOrchestrator(PRODUCTION.slice(0, 5), { marker: MARKED })
    expectRefusedBeforeDocker(run, '--environment production also needs --confirm-production-database <database>')
    expect(run.markerReads).toBe(0)
  })

  it('G · a confirmation that does not repeat the database', async () => {
    const run = await runOrchestrator([...PRODUCTION.slice(0, 5), '--confirm-production-database', 'litubo_CMS'], { marker: MARKED })
    expectRefusedBeforeDocker(run, '--confirm-production-database "litubo_CMS" does not repeat --database "litubo_cms" exactly.')
  })

  it('H · a production database other than litubo_cms', async () => {
    const run = await runOrchestrator(
      ['--environment', 'production', '--database', 'litubo_scratch', '--allow-production', '--confirm-production-database', 'litubo_scratch'],
      { marker: MARKED },
    )
    expectRefusedBeforeDocker(run, 'the production database is litubo_cms; "litubo_scratch" is not a production target.')
  })

  it('I · production on a host without the marker', async () => {
    const run = await runOrchestrator(PRODUCTION, { marker: ABSENT })
    expectRefusedBeforeDocker(run, 'this host has no production marker (/etc/litubo/PRODUCTION).')
    expect(run.markerReads).toBe(1)
  })

  it('J · production when the marker holds the wrong content', async () => {
    const run = await runOrchestrator(PRODUCTION, { marker: { state: 'present', content: 'LITUBO_PRODUCTION_V1\n' } })
    expectRefusedBeforeDocker(run, 'does not contain exactly LITUBO_PRODUCTION_V1.')
  })

  it('a local or scratch database whose name looks like production (the typo guard)', async () => {
    const run = await runOrchestrator(['--environment', 'scratch', '--database', 'litubo_prod_copy'])
    expectRefusedBeforeDocker(run, 'contains "prod"')
    expect(run.markerReads).toBe(0)
  })

  it('a run that passes the gate without its secret still stops before docker: secrets are resolved first', async () => {
    const run = await runOrchestrator(['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract'], { token: '' })
    expectRefusedBeforeDocker(run, 'needs the environment variable DIRECTUS_TOKEN')
  })
})

describe('provisioning orchestrator — a run the gate passes stops at the doubles, never at a real docker', () => {
  it('K · production with every requirement met: the only docker call is the read-only existence query', async () => {
    const run = await runOrchestrator(PRODUCTION, { marker: MARKED })
    expect(run.markerReads).toBe(1)
    expect(run.stdout).toContain('Provisioning "litubo_cms"')
    expect(run.stdout).toContain('  environment      production\n')
    expect(run.dockerCalls).toEqual([existenceCheck('litubo_cms')])
    // The double answers nothing, so the run stops there — exit 1, nothing written anywhere.
    expect(run.exit).toBe(1)
    expect(run.stderr).toContain('database existence check did not succeed')
    expect(run.fetchCalls).toBe(0)
    expect(`${run.stdout}${run.stderr}`).not.toContain(TOKEN)
  })

  it('L · local and scratch runs that were legal before pass the gate the same way', async () => {
    for (const [environment, database] of [['local', 'litubo_cms'], ['scratch', 'litubo_provisioning_test_contract']]) {
      const run = await runOrchestrator(['--environment', environment, '--database', database])
      expect(run.stdout, environment).toContain(`  environment      ${environment}\n`)
      expect(run.dockerCalls, environment).toEqual([existenceCheck(database)])
      expect(run.exit).toBe(1)
      expect(`${run.stdout}${run.stderr}`).not.toContain(TOKEN)
    }
  })

  it('--allow-existing keeps its meaning, and the manifest still starts at its first step', async () => {
    const args = ['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract']
    // The database exists and already has 3 tables: refused after two read-only queries.
    const refused = await runOrchestrator(args, { answers: ['1\n', '3\n'] })
    expect(refused.exit).toBe(1)
    expect(refused.stderr).toContain('already has 3 table(s) in public')
    expect(refused.dockerCalls.map(c => c.input)).toEqual([
      "SELECT count(*) FROM pg_database WHERE datname = 'litubo_provisioning_test_contract';",
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';",
    ])
    // With --allow-existing the run goes on to step 00, the Directus bootstrap, where the double stops it.
    const reapplied = await runOrchestrator([...args, '--allow-existing'], { answers: ['1\n', '3\n'] })
    expect(reapplied.stdout).toContain('(re-apply mode)')
    expect(reapplied.dockerCalls).toHaveLength(3)
    expect(reapplied.dockerCalls[2].args).toEqual([
      'compose', '-f', 'docker-compose.yml', 'run', '--rm', '--no-deps', '-e', 'DB_DATABASE=litubo_provisioning_test_contract', 'directus', 'node', 'cli.js', 'bootstrap',
    ])
    expect(reapplied.stderr).toContain('00-directus-bootstrap did not succeed')
    expect(`${reapplied.stdout}${reapplied.stderr}`).not.toContain(TOKEN)
  })
})

/**
 * MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01 — with every docker call answered, the real script runs the whole
 * manifest. The gate is still decided before anything else, the media folder bootstrap runs after every
 * earlier step, its verification runs immediately after it, and a verification that does not report its
 * OK line fails the run.
 */
describe('provisioning orchestrator — the media folder bootstrap runs last and is verified at once', () => {
  interface ManifestStep { id: string, expect?: string }
  const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
  const steps = (JSON.parse(repoFile('scripts/provisioning-manifest.json')) as { steps: ManifestStep[] }).steps
  const APPLY = repoFile('directus/schema/directus-media-folders-01-bootstrap.sql')
  const VERIFY = repoFile('directus/schema/directus-media-folders-01-bootstrap.verify.sql')
  const args = ['--environment', 'scratch', '--database', 'litubo_provisioning_test_contract']
  const psqlOnScratch = ['compose', '-f', 'docker-compose.yml', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d litubo_provisioning_test_contract -X -At -v ON_ERROR_STOP=1']

  /** The database exists and is empty; then each step answers its expected line, or nothing. */
  const answers = (override: Record<string, string> = {}) =>
    ['1\n', '0\n', ...steps.map(step => override[step.id] ?? (step.expect ? `${step.expect}\n` : ''))]

  it('runs every step in manifest order, ending with 60 and then 61', async () => {
    const run = await runOrchestrator(args, { answers: answers() })
    expect(run.exit).toBe('finished without exiting')
    expect(run.markerReads).toBe(1)
    expect(run.dockerCalls).toHaveLength(2 + steps.length)
    const apply = run.dockerCalls.findIndex(call => call.input === APPLY)
    const verify = run.dockerCalls.findIndex(call => call.input === VERIFY)
    expect(apply).toBe(run.dockerCalls.length - 2)
    expect(verify).toBe(apply + 1)
    expect(run.dockerCalls[apply]!.args).toEqual(psqlOnScratch)
    expect(run.dockerCalls[verify]!.args).toEqual(psqlOnScratch)
    expect(run.stdout).toContain('→ 51-permissions-02-verify\n   directus_permissions_legacy_verify: OK\n→ 60-media-folders-apply\n→ 61-media-folders-verify\n   directus_media_folders_verify: OK\n')
    expect(run.stdout).toContain(`Provisioned "litubo_provisioning_test_contract" — ${steps.length} of ${steps.length} steps, every verification passed.`)
    expect(run.fetchCalls).toBe(0)
    expect(`${run.stdout}${run.stderr}`).not.toContain(TOKEN)
  })

  it('fails the run when the verification does not report its OK line', async () => {
    const run = await runOrchestrator(args, { answers: answers({ '61-media-folders-verify': 'something else\n' }) })
    expect(run.exit).toBe(1)
    expect(run.stderr).toContain('61-media-folders-verify did not report "directus_media_folders_verify: OK".')
    expect(run.stdout).not.toContain('Provisioned "')
  })

  it('stops at a failing bootstrap, before its verification', async () => {
    const run = await runOrchestrator(args, { answers: answers().slice(0, 2 + steps.findIndex(step => step.id === '60-media-folders-apply')) })
    expect(run.exit).toBe(1)
    expect(run.stderr).toContain('60-media-folders-apply did not succeed')
    expect(run.dockerCalls.at(-1)!.input).toBe(APPLY)
    expect(run.dockerCalls.some(call => call.input === VERIFY)).toBe(false)
  })

  it('never reaches it when the gate refuses: production on an unmarked host makes no docker call at all', async () => {
    const run = await runOrchestrator(PRODUCTION, { marker: ABSENT, answers: answers() })
    expectRefusedBeforeDocker(run, 'this host has no production marker (/etc/litubo/PRODUCTION).')
  })
})
