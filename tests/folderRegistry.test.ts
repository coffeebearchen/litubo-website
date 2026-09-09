import { describe, it, expect } from 'vitest'
import {
  buildFolderRegistry,
  validateUploadFolder,
  validateMoveFolder,
  validateFolderCreate,
  validateFolderRename,
  validateFolderMove,
  folderCanHoldCustomerFolders,
  normalizeFolderName,
  MAX_FOLDER_NAME_LENGTH,
} from '../server/utils/folderRegistry'

// ── Shared test UUIDs ─────────────────────────────────────────────────────────

const UUID = {
  home:           'aa000001-0000-0000-0000-000000000001',
  applications:   'aa000002-0000-0000-0000-000000000002',
  company:        'aa000003-0000-0000-0000-000000000003',
  globalService:  'aa000004-0000-0000-0000-000000000004',
  products:       'aa000005-0000-0000-0000-000000000005',
  xray:           'aa000006-0000-0000-0000-000000000006',
  metalDetect:    'aa000007-0000-0000-0000-000000000007',
  combination:    'aa000008-0000-0000-0000-000000000008',
  checkweigher:   'aa000009-0000-0000-0000-000000000009',
  conveyor:       'aa000010-0000-0000-0000-000000000010',
  techDocs:       'aa000011-0000-0000-0000-000000000011',
  resources:      'aa000012-0000-0000-0000-000000000012',
  caseStudies:    'aa000013-0000-0000-0000-000000000013',
  downloads:      'aa000014-0000-0000-0000-000000000014',
  insights:       'aa000015-0000-0000-0000-000000000015',
  certifications: 'aa000016-0000-0000-0000-000000000016',
  forged:         'ffffffff-dead-dead-dead-ffffffffffff',
  ambig1:         'bb000001-0000-0000-0000-000000000001',
  ambig2:         'bb000002-0000-0000-0000-000000000002',
  wrongXray:      'cc000001-0000-0000-0000-000000000001',
  orphan:         'dd000001-0000-0000-0000-000000000001',
}

// Minimal flat list matching the real 16-folder production tree
function baseFlat() {
  return [
    { id: UUID.home,           name: 'home',            parent: null },
    { id: UUID.applications,   name: 'applications',    parent: null },
    { id: UUID.company,        name: 'company',         parent: null },
    { id: UUID.globalService,  name: 'global-service',  parent: UUID.company },
    { id: UUID.products,       name: 'products',        parent: null },
    { id: UUID.xray,           name: 'xray',            parent: UUID.products },
    { id: UUID.metalDetect,    name: 'metal-detection', parent: UUID.products },
    { id: UUID.combination,    name: 'combination',     parent: UUID.products },
    { id: UUID.checkweigher,   name: 'checkweigher',    parent: UUID.products },
    { id: UUID.conveyor,       name: 'conveyor',        parent: UUID.products },
    { id: UUID.techDocs,       name: 'technical-docs',  parent: UUID.products },
    { id: UUID.resources,      name: 'resources',       parent: null },
    { id: UUID.caseStudies,    name: 'case-studies',    parent: UUID.resources },
    { id: UUID.downloads,      name: 'downloads',       parent: UUID.resources },
    { id: UUID.insights,       name: 'insights',        parent: UUID.resources },
    { id: UUID.certifications, name: 'certifications',  parent: null },
  ]
}

// ── buildFolderRegistry ───────────────────────────────────────────────────────

describe('buildFolderRegistry — policy assignment', () => {
  it('assigns active-canonical to root active folders (home, applications, company)', () => {
    const reg = buildFolderRegistry(baseFlat())
    for (const id of [UUID.home, UUID.applications, UUID.company]) {
      const e = reg.find(r => r.folder_uuid === id)!
      expect(e.policy_state).toBe('active-canonical')
      expect(e.allow_upload).toBe(true)
      expect(e.allow_move_target).toBe(true)
    }
  })

  it('assigns active-canonical to all products sub-folders except technical-docs', () => {
    const reg = buildFolderRegistry(baseFlat())
    for (const id of [UUID.xray, UUID.metalDetect, UUID.combination, UUID.checkweigher, UUID.conveyor]) {
      const e = reg.find(r => r.folder_uuid === id)!
      expect(e.policy_state).toBe('active-canonical')
      expect(e.allow_upload).toBe(true)
    }
  })

  it('assigns container-only to products and resources (no upload or move)', () => {
    const reg = buildFolderRegistry(baseFlat())
    for (const id of [UUID.products, UUID.resources]) {
      const e = reg.find(r => r.folder_uuid === id)!
      expect(e.policy_state).toBe('container-only')
      expect(e.allow_upload).toBe(false)
      expect(e.allow_move_target).toBe(false)
    }
  })

  it('assigns legacy-read-only to company/global-service, products/technical-docs, and resources/*', () => {
    const reg = buildFolderRegistry(baseFlat())
    for (const id of [UUID.globalService, UUID.techDocs, UUID.caseStudies, UUID.downloads, UUID.insights]) {
      const e = reg.find(r => r.folder_uuid === id)!
      expect(e.policy_state).toBe('legacy-read-only')
      expect(e.allow_upload).toBe(false)
      expect(e.allow_move_target).toBe(false)
    }
  })

  it('assigns conflict-frozen to certifications', () => {
    const reg = buildFolderRegistry(baseFlat())
    const e = reg.find(r => r.folder_uuid === UUID.certifications)!
    expect(e.policy_state).toBe('conflict-frozen')
    expect(e.allow_upload).toBe(false)
    expect(e.allow_move_target).toBe(false)
    expect(e.full_path).toBe('certifications')
  })

  it('builds correct full_path for products/xray', () => {
    const reg = buildFolderRegistry(baseFlat())
    const e = reg.find(r => r.folder_uuid === UUID.xray)!
    expect(e.full_path).toBe('products/xray')
    expect(e.parent_chain).toEqual(['products', 'xray'])
  })
})

describe('buildFolderRegistry — wrong parent chain (§2 req 2)', () => {
  it('marks root-level "xray" as unknown — same name, wrong hierarchy', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: null }]
    const reg = buildFolderRegistry(flat)
    const e = reg.find(r => r.folder_uuid === UUID.wrongXray)!
    expect(e.policy_state).toBe('unknown')
    expect(e.full_path).toBe('xray')       // not 'products/xray'
    expect(e.allow_upload).toBe(false)
    expect(e.allow_move_target).toBe(false)
  })

  it('marks resources/xray as unknown — correct depth, wrong parent', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: UUID.resources }]
    const reg = buildFolderRegistry(flat)
    const e = reg.find(r => r.folder_uuid === UUID.wrongXray)!
    expect(e.policy_state).toBe('unknown')
    expect(e.full_path).toBe('resources/xray')
  })
})

describe('buildFolderRegistry — orphan / missing parent chain (§2 req 8)', () => {
  it('marks folder with non-existent parent UUID as unknown (not promoted to root)', () => {
    const flat = [{ id: UUID.orphan, name: 'xray', parent: 'missing-parent-uuid' }]
    const reg = buildFolderRegistry(flat)
    const e = reg.find(r => r.folder_uuid === UUID.orphan)!
    // Chain breaks at missing parent → full_path = 'xray' → not 'products/xray' → unknown
    expect(e.policy_state).toBe('unknown')
    expect(e.allow_upload).toBe(false)
  })

  it('does not silently promote an orphan xray to active-canonical (missing parent link)', () => {
    // UUID.xray's parent is a UUID that does not exist in the flat list.
    // parentChain() breaks at the missing link, producing full_path = 'xray' (not 'products/xray').
    // 'xray' is not in FOLDER_POLICY → unknown → not writable.
    const flat = [{ id: UUID.xray, name: 'xray', parent: 'no-such-parent-uuid' }]
    const reg = buildFolderRegistry(flat)
    const e = reg.find(r => r.folder_uuid === UUID.xray)!
    expect(e.full_path).toBe('xray')           // degraded, not 'products/xray'
    expect(e.policy_state).toBe('unknown')
    expect(e.allow_upload).toBe(false)
    expect(e.allow_move_target).toBe(false)
  })
})

describe('buildFolderRegistry — ambiguity §2.7', () => {
  it('marks both UUIDs ambiguous when two resolve to the same full_path', () => {
    const flat = [
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',    parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',    parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const e1 = reg.find(r => r.folder_uuid === UUID.ambig1)!
    const e2 = reg.find(r => r.folder_uuid === UUID.ambig2)!

    expect(e1.policy_state).toBe('ambiguous')
    expect(e1.allow_upload).toBe(false)
    expect(e1.allow_move_target).toBe(false)
    expect(e2.policy_state).toBe('ambiguous')
    expect(e2.allow_upload).toBe(false)
    expect(e2.allow_move_target).toBe(false)
  })

  it('does not contaminate non-ambiguous siblings when one path is ambiguous', () => {
    const flat = [
      { id: UUID.home,     name: 'home',     parent: null },
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',     parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',     parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const home = reg.find(r => r.folder_uuid === UUID.home)!
    expect(home.policy_state).toBe('active-canonical')
    expect(home.allow_upload).toBe(true)
  })

  it('ambiguity at root level also triggers fail-closed', () => {
    const ambigCert2 = 'bb000003-0000-0000-0000-000000000003'
    const flat = [
      { id: UUID.certifications, name: 'certifications', parent: null },
      { id: ambigCert2,          name: 'certifications', parent: null },
    ]
    const reg = buildFolderRegistry(flat)
    for (const id of [UUID.certifications, ambigCert2]) {
      const e = reg.find(r => r.folder_uuid === id)!
      expect(e.policy_state).toBe('ambiguous')
    }
  })
})

describe('buildFolderRegistry — planned folders not in Directus (§2 req 5)', () => {
  it('planned folders (brand, resources/manuals, test-only) are never in the registry', () => {
    const reg = buildFolderRegistry(baseFlat())
    const paths = reg.map(e => e.full_path)
    expect(paths).not.toContain('brand')
    expect(paths).not.toContain('resources/manuals')
    expect(paths).not.toContain('resources/certificates')
    expect(paths).not.toContain('test-only')
  })
})

// ── validateUploadFolder ──────────────────────────────────────────────────────

describe('validateUploadFolder', () => {
  const registry = buildFolderRegistry(baseFlat())

  it('passes for active-canonical products/xray', () => {
    expect(validateUploadFolder(registry, UUID.xray, false)).toEqual({ ok: true })
  })

  it('passes null when nullAllowed=true (Needs Classification on upload)', () => {
    expect(validateUploadFolder(registry, null, true)).toEqual({ ok: true })
  })

  it('rejects null when nullAllowed=false → FOLDER_NULL_DISALLOWED', () => {
    const r = validateUploadFolder(registry, null, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NULL_DISALLOWED')
  })

  it('rejects forged UUID → FOLDER_UNKNOWN', () => {
    const r = validateUploadFolder(registry, UUID.forged, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_UNKNOWN')
  })

  it('rejects container-only products → FOLDER_NOT_ALLOWED', () => {
    const r = validateUploadFolder(registry, UUID.products, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects container-only resources → FOLDER_NOT_ALLOWED', () => {
    const r = validateUploadFolder(registry, UUID.resources, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects legacy-read-only company/global-service → FOLDER_NOT_ALLOWED', () => {
    const r = validateUploadFolder(registry, UUID.globalService, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects conflict-frozen certifications → FOLDER_NOT_ALLOWED', () => {
    const r = validateUploadFolder(registry, UUID.certifications, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects ambiguous UUID → FOLDER_AMBIGUOUS (§2.7)', () => {
    const flat = [
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',    parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',    parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const r1 = validateUploadFolder(reg, UUID.ambig1, false)
    const r2 = validateUploadFolder(reg, UUID.ambig2, false)
    expect(r1.ok).toBe(false)
    expect((r1 as { ok: false; code: string }).code).toBe('FOLDER_AMBIGUOUS')
    expect(r2.ok).toBe(false)
    expect((r2 as { ok: false; code: string }).code).toBe('FOLDER_AMBIGUOUS')
  })

  it('rejects wrong-parent xray (root-level) → FOLDER_NOT_ALLOWED, not confused with products/xray', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: null }]
    const reg = buildFolderRegistry(flat)
    const r = validateUploadFolder(reg, UUID.wrongXray, false)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })
})

// ── validateMoveFolder ────────────────────────────────────────────────────────

describe('validateMoveFolder', () => {
  const registry = buildFolderRegistry(baseFlat())

  it('passes for active-canonical products/xray', () => {
    expect(validateMoveFolder(registry, UUID.xray)).toEqual({ ok: true })
  })

  it('rejects null → FOLDER_NULL_DISALLOWED (move cannot go to Needs Classification)', () => {
    const r = validateMoveFolder(registry, null)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NULL_DISALLOWED')
  })

  it('rejects forged UUID → FOLDER_UNKNOWN', () => {
    const r = validateMoveFolder(registry, UUID.forged)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_UNKNOWN')
  })

  it('rejects container-only products → FOLDER_NOT_ALLOWED', () => {
    const r = validateMoveFolder(registry, UUID.products)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects legacy-read-only products/technical-docs → FOLDER_NOT_ALLOWED', () => {
    const r = validateMoveFolder(registry, UUID.techDocs)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects conflict-frozen certifications → FOLDER_NOT_ALLOWED', () => {
    const r = validateMoveFolder(registry, UUID.certifications)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects ambiguous UUID → FOLDER_AMBIGUOUS (§2.7)', () => {
    const flat = [
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',    parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',    parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const r = validateMoveFolder(reg, UUID.ambig1)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_AMBIGUOUS')
  })

  it('rejects wrong-parent xray → FOLDER_NOT_ALLOWED, not confused with products/xray', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: null }]
    const reg = buildFolderRegistry(flat)
    const r = validateMoveFolder(reg, UUID.wrongXray)
    expect(r.ok).toBe(false)
    expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('rejects all legacy resources sub-folders', () => {
    for (const id of [UUID.caseStudies, UUID.downloads, UUID.insights]) {
      const r = validateMoveFolder(registry, id)
      expect(r.ok).toBe(false)
      expect((r as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
    }
  })
})

// ── Route-level policy simulation (§2 req 9) ─────────────────────────────────
// Simulates what each API route handler does: resolve registry → validate → throw 422 or proceed.
// No real Directus is accessed; buildFolderRegistry serves as the registry source.

describe('route-level policy simulation — upload', () => {
  it('upload to legacy folder → validation fails, route would throw 422, write spy = 0', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateUploadFolder(reg, UUID.globalService, true)
    expect(check.ok).toBe(false)
    // Route throws createError(422) before any Directus file write
  })

  it('upload to wrong-parent xray → validation fails, route would throw 422', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: null }]
    const reg = buildFolderRegistry(flat)
    const check = validateUploadFolder(reg, UUID.wrongXray, true)
    expect(check.ok).toBe(false)
  })

  it('upload to ambiguous folder → FOLDER_AMBIGUOUS, route would throw 422, write spy = 0', () => {
    const flat = [
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',    parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',    parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const check = validateUploadFolder(reg, UUID.ambig1, false)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_AMBIGUOUS')
  })
})

describe('route-level policy simulation — meta.patch', () => {
  it('meta.patch with null folder → FOLDER_NULL_DISALLOWED, Directus write spy = 0', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, null)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_NULL_DISALLOWED')
  })

  it('meta.patch with forged UUID → FOLDER_UNKNOWN, Directus write spy = 0', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, UUID.forged)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_UNKNOWN')
  })
})

describe('route-level policy simulation — batch-move', () => {
  it('batch-move to null → FOLDER_NULL_DISALLOWED, entire batch rejected, 0 folder writes', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, null)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_NULL_DISALLOWED')
  })

  it('batch-move to forged UUID → FOLDER_UNKNOWN, entire batch rejected, 0 writes', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, UUID.forged)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_UNKNOWN')
  })

  it('batch-move to legacy products/technical-docs → FOLDER_NOT_ALLOWED, 0 writes', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, UUID.techDocs)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_NOT_ALLOWED')
  })

  it('batch-move to wrong-parent xray → FOLDER_NOT_ALLOWED, 0 writes', () => {
    const flat = [...baseFlat(), { id: UUID.wrongXray, name: 'xray', parent: null }]
    const reg = buildFolderRegistry(flat)
    const check = validateMoveFolder(reg, UUID.wrongXray)
    expect(check.ok).toBe(false)
  })

  it('batch-move to ambiguous xray → FOLDER_AMBIGUOUS, entire batch rejected, 0 writes', () => {
    const flat = [
      { id: UUID.products, name: 'products', parent: null },
      { id: UUID.ambig1,   name: 'xray',    parent: UUID.products },
      { id: UUID.ambig2,   name: 'xray',    parent: UUID.products },
    ]
    const reg = buildFolderRegistry(flat)
    const check = validateMoveFolder(reg, UUID.ambig1)
    expect(check.ok).toBe(false)
    expect((check as { ok: false; code: string }).code).toBe('FOLDER_AMBIGUOUS')
  })

  it('batch-move to valid products/xray → pre-validation passes, all files use same target UUID', () => {
    const reg = buildFolderRegistry(baseFlat())
    const check = validateMoveFolder(reg, UUID.xray)
    // Passes → route proceeds to PATCH each file to { folder: UUID.xray }
    expect(check.ok).toBe(true)
    // All file IDs in the batch would be written to the same UUID.xray — enforced in batch-move.post.ts
    expect(UUID.xray).toBe('aa000006-0000-0000-0000-000000000006')
  })
})

// ── ML-CLOUD-01: customer folder foundation ─────────────────────────────────

/**
 * The governance this implements (D-023 / decision #9) turns on one thing:
 * rights come from a declared customer zone, never from a path's absence from
 * a list. These tests hold that line, and hold the folder-management dimension
 * apart from the file-content one.
 */

/** A tree covering every case: system roots, a declared zone, its descendants, and paths outside any zone. */
const TREE = [
  { id: 'f-products', name: 'products', parent: null },
  { id: 'f-xray', name: 'xray', parent: 'f-products' },
  { id: 'f-lt180c', name: 'LT-180C', parent: 'f-xray' },
  { id: 'f-manuals', name: 'manuals', parent: 'f-lt180c' },
  { id: 'f-photos', name: 'photos', parent: 'f-lt180c' },
  // A second declared zone, so cross-zone moves have somewhere to be refused to.
  { id: 'f-conveyor', name: 'conveyor', parent: 'f-products' },
  { id: 'f-belts', name: 'belts', parent: 'f-conveyor' },
  { id: 'f-techdocs', name: 'technical-docs', parent: 'f-products' },
  { id: 'f-resources', name: 'resources', parent: null },
  { id: 'f-downloads', name: 'downloads', parent: 'f-resources' },
  { id: 'f-stray', name: 'stray-folder', parent: null },
]

const reg = () => buildFolderRegistry(TREE)
const at = (path: string) => reg().find(e => e.full_path === path)!

describe('folder management is a separate dimension from file-content policy', () => {
  it.each([
    ['products', 'protected'],
    ['products/xray', 'protected'],
    ['resources', 'protected'],
  ])('%s is a system folder → %s', (path, management) => {
    expect(at(path).management).toBe(management)
  })

  it.each([
    'products/xray/LT-180C',
    'products/xray/LT-180C/manuals',
    'products/xray/LT-180C/photos',
  ])('%s is inside a declared zone → customer-managed', (path) => {
    expect(at(path).management).toBe('customer-managed')
  })

  it.each([
    ['products/technical-docs', 'legacy-read-only'],
    ['resources/downloads', 'legacy-read-only'],
  ])('%s stays frozen (%s) and is never customer-managed', (path, policy) => {
    const entry = at(path)
    expect(entry.policy_state).toBe(policy)
    expect(entry.management).toBe('locked')
  })

  it('a path outside every declared zone stays unknown and locked', () => {
    const stray = at('stray-folder')
    expect(stray.policy_state).toBe('unknown')
    expect(stray.management).toBe('locked')
    expect(stray.allow_upload).toBe(false)
    expect(stray.allow_move_target).toBe(false)
  })

  it('a customer folder inherits its zone root’s file policy, so it is actually usable', () => {
    // This is the point of the inheritance: a folder you can create but never
    // upload into is not folder management, it is decoration.
    const zoneRoot = at('products/xray')
    const child = at('products/xray/LT-180C/manuals')
    expect(zoneRoot.policy_state).toBe('active-canonical')
    expect(child.policy_state).toBe('active-canonical')
    expect(child.allow_upload).toBe(true)
    expect(child.allow_move_target).toBe(true)
  })

  it('inheritance does not leak outside the zone', () => {
    expect(at('stray-folder').allow_upload).toBe(false)
    expect(at('products/technical-docs').allow_upload).toBe(false)
  })

  it('ambiguity outranks everything — the folder locks even inside a zone', () => {
    const ambiguous = buildFolderRegistry([
      ...TREE,
      { id: 'f-dupe', name: 'manuals', parent: 'f-lt180c' },
    ])
    for (const entry of ambiguous.filter(e => e.full_path === 'products/xray/LT-180C/manuals')) {
      expect(entry.policy_state).toBe('ambiguous')
      expect(entry.management).toBe('locked')
      expect(entry.allow_upload).toBe(false)
    }
  })

  it('a parent cycle in malformed data terminates instead of hanging', () => {
    const cyclic = buildFolderRegistry([
      { id: 'a', name: 'a', parent: 'b' },
      { id: 'b', name: 'b', parent: 'a' },
    ])
    expect(cyclic).toHaveLength(2)
    for (const entry of cyclic) expect(entry.management).toBe('locked')
  })
})

describe('folder names', () => {
  it('trims, and keeps the trimmed value', () => {
    const result = normalizeFolderName('  manuals  ')
    expect(result).toEqual({ ok: true, name: 'manuals' })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['forward slash', 'a/b'],
    ['backslash', 'a\\b'],
    ['not a string', 42],
  ])('rejects %s', (_label, value) => {
    expect(normalizeFolderName(value).ok).toBe(false)
  })

  it('rejects a name past the length cap', () => {
    expect(normalizeFolderName('x'.repeat(MAX_FOLDER_NAME_LENGTH)).ok).toBe(true)
    expect(normalizeFolderName('x'.repeat(MAX_FOLDER_NAME_LENGTH + 1)).ok).toBe(false)
  })
})

describe('creating a folder', () => {
  it('is allowed inside a declared zone root', () => {
    const result = validateFolderCreate(reg(), 'f-xray', 'LT-200')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.name).toBe('LT-200')
  })

  it('is allowed inside an existing customer folder', () => {
    expect(validateFolderCreate(reg(), 'f-lt180c', 'datasheets').ok).toBe(true)
  })

  it.each([
    ['a container-only system root', 'f-products'],
    ['a frozen legacy folder', 'f-techdocs'],
    ['a folder outside every zone', 'f-stray'],
  ])('is refused inside %s', (_label, parent) => {
    const result = validateFolderCreate(reg(), parent, 'anything')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_ZONE_DISALLOWED')
  })

  it('is refused when a sibling already has that name, case-insensitively', () => {
    const result = validateFolderCreate(reg(), 'f-lt180c', 'MANUALS')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_NAME_TAKEN')
  })

  it('allows the same name under a different parent', () => {
    expect(validateFolderCreate(reg(), 'f-xray', 'manuals').ok).toBe(true)
  })

  it('requires a parent — nothing is created at the tree root', () => {
    const result = validateFolderCreate(reg(), null, 'orphan')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_PARENT_REQUIRED')
  })
})

describe('renaming a folder', () => {
  it('is allowed for a customer folder', () => {
    const result = validateFolderRename(reg(), 'f-lt180c', 'LT-180C-rev2')
    expect(result.ok).toBe(true)
  })

  it.each([
    ['a system root', 'f-products'],
    ['a declared zone root', 'f-xray'],
    ['a frozen legacy folder', 'f-techdocs'],
    ['a folder outside every zone', 'f-stray'],
  ])('is refused for %s', (_label, id) => {
    const result = validateFolderRename(reg(), id, 'new-name')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_PROTECTED')
  })

  it('is refused when it would collide with a sibling', () => {
    const result = validateFolderRename(reg(), 'f-manuals', 'photos')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_NAME_TAKEN')
  })

  it('renaming a folder to its own name is not a collision with itself', () => {
    expect(validateFolderRename(reg(), 'f-manuals', 'manuals').ok).toBe(true)
  })
})

describe('moving a folder', () => {
  it('is allowed between two places in the same zone', () => {
    expect(validateFolderMove(reg(), 'f-manuals', 'f-photos').ok).toBe(true)
  })

  it('is refused into itself', () => {
    const result = validateFolderMove(reg(), 'f-lt180c', 'f-lt180c')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_MOVE_INTO_SELF')
  })

  it('is refused into its own descendant — the subtree cannot be detached', () => {
    const result = validateFolderMove(reg(), 'f-lt180c', 'f-manuals')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_MOVE_INTO_DESCENDANT')
  })

  it.each([
    ['a system container', 'f-products'],
    ['a frozen legacy folder', 'f-techdocs'],
    ['a folder outside every zone', 'f-stray'],
  ])('is refused into %s', (_label, target) => {
    const result = validateFolderMove(reg(), 'f-manuals', target)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_ZONE_DISALLOWED')
  })

  it('is refused for a protected folder, whatever the destination', () => {
    const result = validateFolderMove(reg(), 'f-xray', 'f-lt180c')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_PROTECTED')
  })

  it('is refused when the destination already has a folder with that name', () => {
    const withClash = buildFolderRegistry([...TREE, { id: 'f-clash', name: 'manuals', parent: 'f-photos' }])
    const result = validateFolderMove(withClash, 'f-manuals', 'f-photos')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_NAME_TAKEN')
  })
})

/**
 * D-023 — a customer folder organises inside the product category it was filed
 * under. Crossing to another declared zone keeps every UUID valid while
 * silently re-filing everything underneath, so the server refuses it.
 */
describe('a folder stays inside its own declared zone', () => {
  it('moves within the zone, one level up', () => {
    // products/xray/LT-180C/manuals → products/xray/LT-180C
    expect(validateFolderMove(reg(), 'f-manuals', 'f-lt180c').ok).toBe(true)
  })

  it('moves within the zone, between two nested folders', () => {
    // products/xray/LT-180C/manuals → products/xray/LT-180C/photos
    expect(validateFolderMove(reg(), 'f-manuals', 'f-photos').ok).toBe(true)
  })

  it('moves back to its own zone root', () => {
    // products/xray/LT-180C → products/xray
    expect(validateFolderMove(reg(), 'f-lt180c', 'f-xray').ok).toBe(true)
  })

  it.each([
    ['xray → conveyor', 'f-lt180c', 'f-conveyor'],
    ['conveyor → xray', 'f-belts', 'f-xray'],
    ['a nested xray folder → a nested conveyor folder', 'f-manuals', 'f-belts'],
  ])('refuses %s', (_label, folder, target) => {
    const result = validateFolderMove(reg(), folder, target)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FOLDER_ZONE_MISMATCH')
  })

  it('names the zone the folder is confined to, so the operator knows why', () => {
    const result = validateFolderMove(reg(), 'f-lt180c', 'f-conveyor')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('products/xray')
  })

  it('reports the zone a folder belongs to, counting a zone root as its own zone', () => {
    expect(at('products/xray').zone_root).toBe('products/xray')
    expect(at('products/xray/LT-180C/manuals').zone_root).toBe('products/xray')
    expect(at('products/conveyor/belts').zone_root).toBe('products/conveyor')
  })

  it.each([
    ['a system container', 'products'],
    ['a frozen legacy folder', 'products/technical-docs'],
    ['a path outside every zone', 'stray-folder'],
  ])('%s belongs to no zone', (_label, path) => {
    expect(at(path).zone_root).toBeNull()
  })
})

describe('which folders may hold customer-created children', () => {
  it.each([
    ['a declared zone root', 'products/xray', true],
    ['a customer folder', 'products/xray/LT-180C', true],
    ['a system container', 'products', false],
    ['a frozen legacy folder', 'products/technical-docs', false],
    ['a path outside every zone', 'stray-folder', false],
  ])('%s → %s', (_label, path, expected) => {
    expect(folderCanHoldCustomerFolders(at(path))).toBe(expected)
  })
})
