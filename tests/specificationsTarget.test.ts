/**
 * PWS-AI-ENGINE-01R2-SAFETY-01 — direct tests of `specificationsTarget.parseAndValidate()`,
 * the single place an untrusted, already-JSON-parsed provider response is
 * validated before anything else touches it. No previous task had a
 * dedicated test file for this function; its safety scan was previously
 * only exercised indirectly. Covers both the pre-existing pattern-based scan
 * (URL/UUID/path/extension/page-number/newline) and the new long-contiguous-
 * source-echo detector this task adds.
 */

import { describe, it, expect } from 'vitest'
import { specificationsTarget } from '../server/utils/aiTargets/specificationsTarget'

const NO_CONTEXT = { sourceMaterial: '' }

function validProposal(overrides: { parameter?: string, value?: string, group?: string } = {}) {
  return {
    groups: [{
      group: overrides.group ?? 'Detection performance',
      items: [{ parameter: overrides.parameter ?? 'Detection sensitivity (Fe)', value: overrides.value ?? '0.8 mm' }],
    }],
  }
}

describe('specificationsTarget.parseAndValidate — structural validation', () => {
  it('accepts a well-formed proposal with short, normal values', () => {
    const result = specificationsTarget.parseAndValidate(validProposal(), NO_CONTEXT)
    expect(result).toEqual({ ok: true, output: validProposal() })
  })

  it('rejects a response that does not match the schema at all', () => {
    const result = specificationsTarget.parseAndValidate({ not: 'the right shape' }, NO_CONTEXT)
    expect(result).toEqual({ ok: false, error: 'The AI provider returned a response that could not be safely used.' })
  })

  it('rejects a response carrying an extra field like note/source/locator (.strict())', () => {
    const raw = { groups: [{ group: 'G', items: [{ parameter: 'P', value: 'V', note: 'from page 3' }] }] }
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result.ok).toBe(false)
  })
})

describe('specificationsTarget.parseAndValidate — pattern-based leakage scan (pre-existing)', () => {
  it.each([
    ['a URL', 'See https://example.com/spec.pdf for details'],
    ['a UUID', 'Ref a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    ['a filesystem-looking path', 'C:\\Users\\admin\\data\\sheet.txt'],
    ['an echoed file extension', 'source.pdf'],
    ['a page-number locator', 'see page 12'],
    ['a newline', 'line one\nline two'],
  ])('drops an item whose value contains %s', (_label, unsafeValue) => {
    const raw = validProposal({ value: unsafeValue })
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result).toEqual({ ok: false, error: 'The AI provider\'s response did not contain any safely usable specification suggestions.' })
  })

  it('drops only the unsafe item, keeping a safe sibling item in the same group', () => {
    const raw = {
      groups: [{
        group: 'Detection performance',
        items: [
          { parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' },
          { parameter: 'Reference', value: 'https://example.com/leak' },
        ],
      }],
    }
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.groups[0].items).toEqual([{ parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' }])
    }
  })
})

describe('specificationsTarget.parseAndValidate — long contiguous source-material echo (new)', () => {
  const longParagraph = 'The XR-180C free-fall metal detector uses a balanced coil design rated for continuous production line operation and meets IP65 ingress protection standards under normal operating conditions.'

  it('rejects a value that echoes 80+ contiguous characters of the source material, even with no URL/UUID/path present', () => {
    expect(longParagraph.length).toBeGreaterThan(80)
    const raw = validProposal({ value: longParagraph })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })
    expect(result).toEqual({ ok: false, error: 'The AI provider\'s response did not contain any safely usable specification suggestions.' })
  })

  it('still rejects when the echoed run is only part of a longer output value (surrounding text does not hide it)', () => {
    const raw = validProposal({ value: `Summary: ${longParagraph} (end of excerpt)` })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })
    expect(result.ok).toBe(false)
  })

  it('is case- and whitespace-insensitive (normalizes before comparing)', () => {
    const sourceMaterial = longParagraph
    const shoutedAndRespaced = longParagraph.toUpperCase().replace(/ /g, '   ')
    const raw = validProposal({ value: shoutedAndRespaced })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial })
    expect(result.ok).toBe(false)
  })

  it('never rejects a normal short spec value that happens to also appear in the source material', () => {
    const sourceMaterial = `Datasheet excerpt. ${longParagraph} Detection sensitivity (Fe): 0.8 mm. IP65 rated.`
    const shortValues = ['0.8 mm', 'IP65', 'Stainless steel 304', '220V']
    for (const value of shortValues) {
      const raw = validProposal({ value })
      const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial })
      expect(result.ok).toBe(true)
    }
  })

  it('an empty sourceMaterial context never triggers the echo check (no false positives when context is unavailable)', () => {
    const raw = validProposal({ value: longParagraph })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: '' })
    expect(result.ok).toBe(true)
  })

  it('a model that echoes the entire source material back as its only output is honestly rejected, never a fabricated empty success', () => {
    const raw = validProposal({ group: longParagraph, value: '0.8 mm' })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })
    expect(result).toEqual({ ok: false, error: 'The AI provider\'s response did not contain any safely usable specification suggestions.' })
  })
})
