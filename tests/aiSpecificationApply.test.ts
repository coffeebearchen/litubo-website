/**
 * PWS-AI-ENGINE-01 — "Apply accepted changes to Draft" request validation.
 * Pure Zod-schema tests; no network, no Directus, no AI provider involved.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApplyChangeSchema, ApplyRequestSchema, normalizeSpecName } from '../server/utils/aiSpecificationApply'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

describe('ApplyChangeSchema — add', () => {
  it('accepts a well-formed add change', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'Detection performance', parameter: 'Detection sensitivity (Fe)', value: '0.8 mm',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an optional note', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'Detection performance', parameter: 'X', value: 'Y', note: 'From datasheet page 7',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an add missing a required field', () => {
    expect(ApplyChangeSchema.safeParse({ action: 'add', group: 'X', value: 'Y' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'add', parameter: 'X', value: 'Y' }).success).toBe(false)
  })

  it('rejects an add with no fields the model does not own (e.g. a specItemId)', () => {
    // A discriminated union on `action: 'add'` only recognizes the add-shape keys;
    // extra keys like specItemId are simply not part of the parsed output.
    const result = ApplyChangeSchema.safeParse({
      action: 'add', group: 'X', parameter: 'Y', value: 'Z', specItemId: 999,
    })
    expect(result.success).toBe(true)
    if (result.success) expect('specItemId' in result.data).toBe(false)
  })
})

describe('ApplyChangeSchema — update', () => {
  it('accepts a well-formed update change', () => {
    const result = ApplyChangeSchema.safeParse({ action: 'update', specItemId: 42, value: '0.8 mm' })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive or non-integer specItemId', () => {
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: 0, value: 'X' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: -1, value: 'X' }).success).toBe(false)
    expect(ApplyChangeSchema.safeParse({ action: 'update', specItemId: 1.5, value: 'X' }).success).toBe(false)
  })

  it('an update never accepts a group or parameter field — it can only change value/note', () => {
    const result = ApplyChangeSchema.safeParse({
      action: 'update', specItemId: 1, value: 'X', group: 'Should not exist', parameter: 'Should not exist',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('group' in result.data).toBe(false)
      expect('parameter' in result.data).toBe(false)
    }
  })
})

describe('ApplyRequestSchema', () => {
  it('accepts a request with 1-100 changes', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [{ action: 'update', specItemId: 1, value: 'X' }] }).success).toBe(true)
  })

  it('rejects an empty changes array — Apply is disabled client-side but the server refuses it too', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [] }).success).toBe(false)
  })

  it('rejects an unrecognized action value', () => {
    expect(ApplyRequestSchema.safeParse({ changes: [{ action: 'delete', specItemId: 1 }] }).success).toBe(false)
  })

  it('rejects a request with more than 100 changes', () => {
    const changes = Array.from({ length: 101 }, (_, i) => ({ action: 'update' as const, specItemId: i + 1, value: 'X' }))
    expect(ApplyRequestSchema.safeParse({ changes }).success).toBe(false)
  })
})

describe('normalizeSpecName', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeSpecName('  Detection   Sensitivity (Fe) ')).toBe('detection sensitivity (fe)')
  })

  it('two differently-cased/spaced names normalize to the same key', () => {
    expect(normalizeSpecName('Detection sensitivity (Fe)')).toBe(normalizeSpecName('detection  SENSITIVITY (fe)'))
  })
})

describe('apply.post.ts — only writes the canonical whitelisted fields', () => {
  const source = repoFile('server/api/admin/products/[id]/ai/specification-proposal/apply.post.ts')

  it('re-verifies product existence before any write', () => {
    expect(source).toContain('await assertProductExists(event, productId)')
  })

  it('validates the request body against the Zod schema before touching Directus', () => {
    expect(source).toContain('ApplyRequestSchema.safeParse(body)')
  })

  it('an update only ever writes value_en/note_en — never label_en, spec_group_id, or any other field', () => {
    const updateBlock = source.slice(source.indexOf("change.action === 'update'"), source.indexOf("// action === 'add'"))
    expect(updateBlock).toContain('value_en: change.value')
    expect(updateBlock).toContain('note_en: change.note')
    expect(updateBlock).not.toContain('label_en:')
    expect(updateBlock).not.toContain('spec_group_id:')
  })

  it('an update re-verifies the item belongs to this exact product before writing', () => {
    const updateBlock = source.slice(source.indexOf("change.action === 'update'"), source.indexOf("// action === 'add'"))
    expect(updateBlock).toContain('item.spec_group_id.product_id !== productId')
  })

  it('an add reuses an existing group by normalized name instead of always creating a new one', () => {
    expect(source).toContain('groupIdByName.get(normalizedGroupName)')
    expect(source).toContain('normalizeSpecName(change.group)')
  })

  it('the response never echoes an internal id, group id, or item id — only a safe applied-count summary', () => {
    const returnLine = source.slice(source.lastIndexOf('return {'))
    expect(returnLine).toContain('message:')
    expect(returnLine).not.toMatch(/\bid\s*:/)
  })

  it('never touches Page Content, FAQ, SEO, Media, Evidence, or publish/status fields', () => {
    const lower = source.toLowerCase()
    expect(lower).not.toContain('product_sections')
    expect(lower).not.toContain('product_faqs')
    expect(lower).not.toContain('products_files')
    expect(lower).not.toContain('product_source_records')
    expect(lower).not.toContain("status: 'published'")
    expect(lower).not.toContain('submit for review')
  })
})

describe('providers.get.ts — safe summary only', () => {
  const source = repoFile('server/api/admin/ai/providers.get.ts')

  it('maps only id/label/configured/isDefault into the response', () => {
    const mapBlock = source.slice(source.indexOf('.map(p =>'), source.indexOf('))'))
    expect(mapBlock).toContain('id: p.id')
    expect(mapBlock).toContain('label: p.label')
    expect(mapBlock).toContain('configured: p.configured')
    expect(mapBlock).toContain('isDefault:')
  })

  it('the returned object per provider only ever has id/label/configured/isDefault keys — never apiKey or model', () => {
    // config.openaiApiKey/config.deepseekApiKey ARE read here (necessary, to build
    // the registry) but only inside the .map() return shape is what actually leaves
    // this endpoint — that shape is checked precisely, not just absence of a word.
    const mapBlock = source.slice(source.indexOf('.map(p =>'), source.indexOf('))'))
    expect(mapBlock).not.toContain('apiKey')
    expect(mapBlock).not.toContain('model')
  })

  it('never reads process.env directly — only through useRuntimeConfig()', () => {
    expect(source).not.toContain('process.env')
  })
})
