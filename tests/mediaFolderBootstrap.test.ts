/**
 * MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01 — the Protected System Folder bootstrap, checked without a
 * database, so these run everywhere, CI included.
 *
 * The artifact (directus/schema/directus-media-folders-01-bootstrap.sql) writes the folder rows the
 * Media Library's folder governance is keyed on. Four things are pinned here: that its tree is the
 * runtime's own list of Protected System Folders and nothing else, that its write surface is one
 * INSERT into directus_folders, that the manifest runs it last and verifies it at once, and that the
 * rows it creates give exactly today's governance semantics when the runtime reads them back. What
 * the SQL does against a real PostgreSQL — idempotency, UUID preservation, every refusal — is
 * tests/mediaFolderBootstrapDbIntegration.test.ts.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildFolderRegistry,
  folderCanHoldCustomerFolders,
  validateFolderCreate,
  validateFolderMove,
  validateFolderRename,
  validateUploadFolder,
} from '../server/utils/folderRegistry'

const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const APPLY_PATH = 'directus/schema/directus-media-folders-01-bootstrap.sql'
const VERIFY_PATH = 'directus/schema/directus-media-folders-01-bootstrap.verify.sql'
const APPLY = repoFile(APPLY_PATH)
const VERIFY = repoFile(VERIFY_PATH)
const REGISTRY_SOURCE = repoFile('server/utils/folderRegistry.ts')

/** The ten Protected System Folders of the Cloud Workspace Blueprint §3.1 (D-023). */
const PROTECTED_SYSTEM_FOLDERS = [
  'home', 'applications', 'company', 'products', 'resources',
  'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination', 'products/conveyor',
]
const PRODUCT_CATEGORIES = PROTECTED_SYSTEM_FOLDERS.filter(path => path.startsWith('products/'))

/** Folders a fresh environment must never be given: frozen in older environments, or planned and never made. */
const NEVER_BOOTSTRAPPED = [
  'products/technical-docs', 'resources/insights', 'resources/case-studies', 'resources/downloads',
  'company/global-service', 'certifications',
  'brand', 'resources/manuals', 'resources/certificates', 'test-only',
]

/** SQL with its comment lines removed, so words in the header cannot satisfy or fail a code check. */
function code(sql: string): string {
  return sql.split(/\r?\n/).filter(line => !line.trim().startsWith('--')).join('\n')
}

/** The quoted elements of `<name> constant text[] := ARRAY[ ... ];` in an artifact. */
function sqlArray(sql: string, name: string): string[] {
  const match = code(sql).match(new RegExp(`\\b${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`))
  if (!match) throw new Error(`${name} not found`)
  return [...match[1]!.matchAll(/'([^']*)'/g)].map(m => m[1]!)
}

/** FOLDER_POLICY and CUSTOMER_MANAGEABLE_ROOTS, read from the runtime source rather than restated here. */
function runtimePolicy(): Record<string, string> {
  const block = REGISTRY_SOURCE.match(/const FOLDER_POLICY[^=]*=\s*\{([\s\S]*?)\}\s*as const/)
  if (!block) throw new Error('FOLDER_POLICY not found')
  return Object.fromEntries([...block[1]!.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => [m[1]!, m[2]!]))
}
function runtimeZones(): string[] {
  const block = REGISTRY_SOURCE.match(/const CUSTOMER_MANAGEABLE_ROOTS[^=]*=\s*\[([\s\S]*?)\]/)
  if (!block) throw new Error('CUSTOMER_MANAGEABLE_ROOTS not found')
  return [...block[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!)
}

const sorted = (values: string[]) => [...values].sort()

describe('the bootstrap tree is the runtime’s own list of Protected System Folders', () => {
  it('reads the runtime policy it is compared against (the parse is not vacuous)', () => {
    const policy = runtimePolicy()
    expect(Object.keys(policy)).toHaveLength(16)
    expect(runtimeZones()).toHaveLength(5)
  })

  it('equals the FOLDER_POLICY entries that are neither legacy-read-only nor conflict-frozen', () => {
    const protectedByRuntime = Object.entries(runtimePolicy())
      .filter(([, state]) => state !== 'legacy-read-only' && state !== 'conflict-frozen')
      .map(([path]) => path)
    expect(sorted(sqlArray(APPLY, 'canonical_paths'))).toEqual(sorted(protectedByRuntime))
  })

  it('equals the ten Protected System Folders of the Cloud Workspace Blueprint §3.1', () => {
    expect(sorted(sqlArray(APPLY, 'canonical_paths'))).toEqual(sorted(PROTECTED_SYSTEM_FOLDERS))
    const blueprint = repoFile('docs/project/MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-BLUEPRINT.md')
    const section = blueprint.slice(blueprint.indexOf('### 3.1 Protected System Folders'), blueprint.indexOf('### 3.2'))
    for (const path of PROTECTED_SYSTEM_FOLDERS) expect(section).toContain(`- ${path}\n`)
  })

  it('apply and verify declare the same tree and the same customer zones', () => {
    expect(sqlArray(VERIFY, 'canonical_paths')).toEqual(sqlArray(APPLY, 'canonical_paths'))
    expect(sqlArray(VERIFY, 'customer_zones')).toEqual(sqlArray(APPLY, 'customer_zones'))
  })

  it('names the declared customer zones exactly as the runtime declares them', () => {
    expect(sorted(sqlArray(APPLY, 'customer_zones'))).toEqual(sorted(runtimeZones()))
    expect(sorted(runtimeZones())).toEqual(sorted(PRODUCT_CATEGORIES))
  })

  it('lists every parent before its children, and every parent is itself canonical', () => {
    const paths = sqlArray(APPLY, 'canonical_paths')
    paths.forEach((path, index) => {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null
      if (parent !== null) {
        expect(paths.indexOf(parent), `${path} needs ${parent} first`).toBeGreaterThanOrEqual(0)
        expect(paths.indexOf(parent)).toBeLessThan(index)
      }
    })
  })

  it('never creates a legacy, frozen or planned folder', () => {
    const paths = sqlArray(APPLY, 'canonical_paths')
    for (const path of NEVER_BOOTSTRAPPED) expect(paths).not.toContain(path)
    const policy = runtimePolicy()
    for (const path of paths) expect(['active-canonical', 'container-only']).toContain(policy[path])
  })
})

describe('the apply artifact writes directus_folders rows and nothing else', () => {
  const body = code(APPLY)

  it('has one INSERT, into directus_folders, with a generated UUID', () => {
    expect(body.match(/\bINSERT\b/gi)).toHaveLength(1)
    expect(body).toMatch(/INSERT INTO directus_folders \(id, name, parent\)\s+VALUES \(gen_random_uuid\(\), /)
  })

  it.each(['UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'COPY', 'MERGE'])(
    'contains no %s',
    (keyword) => {
      expect(body).not.toMatch(new RegExp(`\\b${keyword}\\b`, 'i'))
    },
  )

  it('locks only directus_folders and reads only directus_folders and the column catalogue', () => {
    expect(body.match(/\bLOCK TABLE\b[^;]*;/gi)).toEqual(['LOCK TABLE directus_folders IN SHARE ROW EXCLUSIVE MODE;'])
    // Every relation read, minus the file's own CTEs and the array unnesting. String literals (the
    // refusal messages) and `IS NOT DISTINCT FROM` are not reads.
    const statements = body.replace(/'(?:[^']|'')*'/g, "''")
    const relations = new Set([...statements.matchAll(/(?<!DISTINCT\s)\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_.]*)/gi)].map(m => m[1]!.toLowerCase()))
    for (const local of ['tree', 'canon', 'unnest']) relations.delete(local)
    expect([...relations].sort()).toEqual(['directus_folders', 'information_schema.columns'])
    expect(body).toMatch(/WITH RECURSIVE tree AS/)
    expect(body).toMatch(/WITH canon AS/)
  })

  it('names no schema and carries no identifier from any environment', () => {
    expect(body).not.toMatch(/\bpublic\./i)
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it('runs as one transaction, with the apply block marked once', () => {
    expect(body.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(body.match(/^COMMIT;$/gm)).toHaveLength(1)
    expect(APPLY.match(/^-- apply:begin$/gm)).toHaveLength(1)
    expect(APPLY.match(/^-- apply:end$/gm)).toHaveLength(1)
    expect(APPLY.indexOf('BEGIN;')).toBeLessThan(APPLY.indexOf('-- apply:begin'))
    expect(APPLY.indexOf('-- apply:end')).toBeLessThan(APPLY.lastIndexOf('COMMIT;'))
  })

  it('makes every check before its first write', () => {
    const firstWrite = body.indexOf('INSERT INTO directus_folders')
    const lastRefusal = body.lastIndexOf('canonical folder name(s) found outside the customer zones')
    expect(lastRefusal).toBeGreaterThan(0)
    expect(lastRefusal).toBeLessThan(firstWrite)
    // Inside the write loop the only refusal is the parents-first guard, which the ordering test above
    // rules out; nothing can refuse after an INSERT has run.
    expect(body.slice(firstWrite).match(/RAISE EXCEPTION/g)).toBeNull()
  })

  it('keeps its SQL code ASCII, so no invisible character can change what it compares', () => {
    const offenders = code(APPLY).split('\n').filter(line => /[^\x20-\x7e\t]/.test(line))
    expect(offenders).toEqual([])
  })
})

describe('the verify artifact reads and never writes', () => {
  const body = code(VERIFY)

  it.each(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'COPY', 'MERGE', 'LOCK'])(
    'contains no %s',
    (keyword) => {
      expect(body).not.toMatch(new RegExp(`\\b${keyword}\\b`, 'i'))
    },
  )

  it('prints the line the manifest expects, once, after the checks', () => {
    expect(body.match(/SELECT 'directus_media_folders_verify: OK';/g)).toHaveLength(1)
    expect(body.indexOf("SELECT 'directus_media_folders_verify: OK';")).toBeGreaterThan(body.lastIndexOf('$verify$;'))
    expect(VERIFY.match(/^-- verify:begin$/gm)).toHaveLength(1)
    expect(VERIFY.match(/^-- verify:end$/gm)).toHaveLength(1)
  })

  it('keeps its SQL code ASCII', () => {
    expect(code(VERIFY).split('\n').filter(line => /[^\x20-\x7e\t]/.test(line))).toEqual([])
  })
})

describe('provisioning runs the bootstrap last and verifies it at once', () => {
  interface Step { id: string, kind: string, file?: string, expect?: string, secretEnv?: string, args?: string[], inline?: string }
  const steps = (JSON.parse(repoFile('scripts/provisioning-manifest.json')) as { steps: Step[] }).steps

  it('keeps the thirteen verified steps before it exactly as they were', () => {
    expect(steps.slice(0, 13).map(step => step.id)).toEqual([
      '00-directus-bootstrap', '10-schema-baseline', '20-constraints', '21-revision-guard', '22-lifecycle-guard',
      '30-verify-schema-objects', '31-access-bootstrap', '32-service-token', '33-access-verify',
      '40-permissions-01-apply', '41-permissions-01-verify', '50-permissions-02-apply', '51-permissions-02-verify',
    ])
  })

  it('ends with the apply step and, immediately after it, the verify step', () => {
    expect(steps).toHaveLength(15)
    expect(steps[13]).toMatchObject({ id: '60-media-folders-apply', kind: 'psql', file: APPLY_PATH })
    expect(steps[14]).toMatchObject({ id: '61-media-folders-verify', kind: 'psql-expect', file: VERIFY_PATH, expect: 'directus_media_folders_verify: OK' })
    for (const step of steps.slice(13)) {
      expect(existsSync(resolve(process.cwd(), step.file!)), step.file).toBe(true)
      expect(step.secretEnv).toBeUndefined()
    }
  })

  it('touches directus_folders in no other step', () => {
    for (const step of steps.slice(0, 13)) {
      const text = step.file ? repoFile(step.file) : (step.inline ?? '')
      expect(text, step.id).not.toMatch(/directus_folders/)
    }
  })
})

describe('the rows it creates give exactly today’s governance semantics', () => {
  /** The rows a fresh run writes, with stand-in UUIDs: names and parents are all the runtime reads. */
  function bootstrapRows() {
    const ids = new Map(sqlArray(APPLY, 'canonical_paths').map((path, index) => [path, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]))
    return [...ids].map(([path, id]) => {
      const cut = path.lastIndexOf('/')
      return { id, name: path.slice(cut + 1), parent: cut < 0 ? null : ids.get(path.slice(0, cut))! }
    })
  }
  const registry = () => buildFolderRegistry(bootstrapRows())
  const at = (path: string) => registry().find(entry => entry.full_path === path)!

  it('resolves every created row to its canonical path, once, and none is ambiguous or unknown', () => {
    const entries = registry()
    expect(sorted(entries.map(entry => entry.full_path))).toEqual(sorted(PROTECTED_SYSTEM_FOLDERS))
    for (const entry of entries) {
      expect(entry.management, entry.full_path).toBe('protected')
      expect(['ambiguous', 'unknown', 'legacy-read-only', 'conflict-frozen']).not.toContain(entry.policy_state)
    }
  })

  it.each(['home', 'applications', 'company'])('%s is an active-canonical system folder that takes files but no customer folders', (path) => {
    const entry = at(path)
    expect(entry).toMatchObject({ policy_state: 'active-canonical', allow_upload: true, allow_move_target: true, zone_root: null })
    expect(folderCanHoldCustomerFolders(entry)).toBe(false)
  })

  it.each(['products', 'resources'])('%s stays a container: no files, no customer folders', (path) => {
    const entry = at(path)
    expect(entry).toMatchObject({ policy_state: 'container-only', allow_upload: false, allow_move_target: false, zone_root: null })
    expect(folderCanHoldCustomerFolders(entry)).toBe(false)
  })

  it.each(PRODUCT_CATEGORIES)('%s is a protected zone root that takes files and customer folders', (path) => {
    const entry = at(path)
    expect(entry).toMatchObject({ policy_state: 'active-canonical', allow_upload: true, allow_move_target: true, zone_root: path })
    expect(folderCanHoldCustomerFolders(entry)).toBe(true)
  })

  it('lets a customer folder be created in each product category and nowhere else', () => {
    const entries = registry()
    for (const entry of entries) {
      const result = validateFolderCreate(entries, entry.folder_uuid, 'LT-180C')
      expect(result.ok, entry.full_path).toBe(PRODUCT_CATEGORIES.includes(entry.full_path))
      if (!result.ok) expect(result.code).toBe('FOLDER_ZONE_DISALLOWED')
    }
  })

  it('refuses to rename or move any of them', () => {
    const entries = registry()
    for (const entry of entries) {
      const rename = validateFolderRename(entries, entry.folder_uuid, 'renamed')
      const move = validateFolderMove(entries, entry.folder_uuid, at('products/xray').folder_uuid)
      expect(rename.ok).toBe(false)
      expect(move.ok).toBe(false)
      if (!rename.ok) expect(rename.code).toBe('FOLDER_PROTECTED')
      if (!move.ok) expect(move.code).toBe('FOLDER_PROTECTED')
    }
  })

  it('accepts uploads exactly where the file policy did before', () => {
    const entries = registry()
    for (const entry of entries) {
      expect(validateUploadFolder(entries, entry.folder_uuid, false).ok, entry.full_path).toBe(entry.policy_state === 'active-canonical')
    }
  })

  it('a customer folder made later inside a zone is customer-managed and inherits its zone’s file policy', () => {
    const rows = bootstrapRows()
    const xray = rows.find(row => row.name === 'xray')!
    const withCustomer = buildFolderRegistry([...rows, { id: 'customer-lt180c', name: 'LT-180C', parent: xray.id }])
    const customer = withCustomer.find(entry => entry.full_path === 'products/xray/LT-180C')!
    expect(customer).toMatchObject({ management: 'customer-managed', policy_state: 'active-canonical', allow_upload: true, zone_root: 'products/xray' })
  })
})
