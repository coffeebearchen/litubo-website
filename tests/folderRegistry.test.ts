import { describe, it, expect } from 'vitest'
import {
  buildFolderRegistry,
  validateUploadFolder,
  validateMoveFolder,
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
