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

// ── PWS-AI-ENGINE-01R2-SAFETY-02 — fragment-splitting and Unicode bypasses ──

const NO_SAFE_ITEMS = 'The AI provider\'s response did not contain any safely usable specification suggestions.'

/** ~158 characters of "confidential" prose — long enough to split into two fragments that each sit under the 80-character per-field threshold. */
const SECRET_158 = 'The XR-180C uses a proprietary balanced coil arrangement supplied under contract 7741 and must never be described in any customer facing document at all ever.'

describe('parseAndValidate — a passage split across fields is still caught (aggregate detection)', () => {
  it('a 158-character passage split into two sub-80-character values fails the WHOLE proposal, not just one field', () => {
    // The point of the fixture: long enough that neither half alone trips the
    // 80-character per-field threshold, yet the whole passage is delivered.
    expect(SECRET_158.length).toBeGreaterThan(150)
    expect(SECRET_158.length).toBeLessThan(160)
    const first = SECRET_158.slice(0, 79)
    const second = SECRET_158.slice(79)
    expect(first.length).toBeLessThan(80)
    expect(second.length).toBeLessThan(80)

    const raw = {
      groups: [{
        group: 'Detection performance',
        items: [
          { parameter: 'Design note A', value: first },
          { parameter: 'Design note B', value: second },
        ],
      }],
    }
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: SECRET_158 })

    expect(result).toEqual({ ok: false, error: NO_SAFE_ITEMS })
    expect(JSON.stringify(result)).not.toContain('proprietary balanced coil')
    expect(JSON.stringify(result)).not.toContain('contract 7741')
  })

  it('the same passage spread over many items in several groups is also caught', () => {
    const chunkSize = 30
    const chunks: string[] = []
    for (let i = 0; i < SECRET_158.length; i += chunkSize) chunks.push(SECRET_158.slice(i, i + chunkSize))

    const raw = {
      groups: chunks.map((chunk, i) => ({
        group: `Group ${i + 1}`,
        items: [{ parameter: `Parameter ${i + 1}`, value: chunk }],
      })),
    }
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: SECRET_158 })

    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('balanced coil')
  })

  it('a whitespace-reflowed split (fragments cut at a word boundary) is caught too', () => {
    const cut = SECRET_158.indexOf(' ', 70) // split exactly at a space, so naive rejoining would not match
    const raw = {
      groups: [{
        group: 'Detection performance',
        items: [
          { parameter: 'A', value: SECRET_158.slice(0, cut) },
          { parameter: 'B', value: SECRET_158.slice(cut + 1) },
        ],
      }],
    }
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: SECRET_158 })
    expect(result.ok).toBe(false)
  })
})

describe('parseAndValidate — invisible-character bypasses', () => {
  const longParagraph = SECRET_158

  it.each([
    ['U+200B zero width space', '\u200B'],
    ['U+2060 word joiner', '\u2060'],
    ['U+00AD soft hyphen', '\u00AD'],
    ['U+FEFF zero width no-break space', '\uFEFF'],
  ])('an echo laced with %s (visually identical to the source) is still rejected', (_label, invisible) => {
    const laced = longParagraph.split('').join(invisible)
    const raw = validProposal({ value: laced })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })

    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('balanced coil')
  })

  it('a split-plus-invisible-character combination is rejected as well', () => {
    const laced = longParagraph.split('').join('\u200B')
    const raw = {
      groups: [{
        group: 'Detection performance',
        items: [
          { parameter: 'A', value: laced.slice(0, Math.floor(laced.length / 2)) },
          { parameter: 'B', value: laced.slice(Math.floor(laced.length / 2)) },
        ],
      }],
    }
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })
    expect(result.ok).toBe(false)
  })

  it('an NFKC-equivalent rewrite (full-width characters) does not evade the check', () => {
    const fullWidth = longParagraph.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
    const raw = validProposal({ value: fullWidth })
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial: longParagraph })
    expect(result.ok).toBe(false)
  })
})

describe('parseAndValidate — normal short specifications are never harmed by the aggregate check', () => {
  it('a realistic multi-item proposal extracted from a delimited source still passes', () => {
    const sourceMaterial = 'Model: LT-180C | Detection sensitivity (Fe): 0.8 mm | Rated power: 220V | Protection class: IP65 | Contact material: Stainless steel 304'
    const raw = {
      groups: [{
        group: 'Detection performance',
        items: [
          { parameter: 'Detection sensitivity (Fe)', value: '0.8 mm' },
          { parameter: 'Rated power', value: '220V' },
          { parameter: 'Protection class', value: 'IP65' },
          { parameter: 'Contact material', value: 'Stainless steel 304' },
        ],
      }],
    }
    const result = specificationsTarget.parseAndValidate(raw, { sourceMaterial })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output.groups[0].items).toHaveLength(4)
  })
})

describe('parseAndValidate — extended locator patterns', () => {
  it.each([
    ['a javascript: URI', 'javascript:alert(1)'],
    ['a data: URI', 'data:text/plain;base64,SGVsbG8='],
    ['a file: URI', 'file:///etc/passwd'],
    ['a protocol-relative URL', 'see //cdn.example.com/asset'],
    ['a bare domain', 'contact evil.example.com'],
    ['a hyphen-less long hex id', 'a1b2c3d4e5f67890abcd1234ef567890'],
    ['a single-segment Windows path', 'C:\\datasheet.pdf'],
    ['a zero-width character', 'IP\u200B65'],
  ])('drops an item whose value contains %s', (_label, unsafeValue) => {
    const result = specificationsTarget.parseAndValidate(validProposal({ value: unsafeValue }), NO_CONTEXT)
    expect(result).toEqual({ ok: false, error: NO_SAFE_ITEMS })
  })

  it('does not false-positive on ordinary specification values', () => {
    for (const value of ['0.8 mm', 'IP65', 'Stainless steel 304', '220V / 50Hz', '±0.5 g', '1200 x 800 x 1500 mm']) {
      const result = specificationsTarget.parseAndValidate(validProposal({ value }), NO_CONTEXT)
      expect(result.ok).toBe(true)
    }
  })
})

describe('parseAndValidate — proposal size ceilings', () => {
  const OVERSIZED = 'The AI provider returned more suggestions than can be safely reviewed at once.'

  it('rejects a response with more than 200 items in total', () => {
    const raw = {
      groups: Array.from({ length: 5 }, (_, gi) => ({
        group: `Group ${gi + 1}`,
        items: Array.from({ length: 50 }, (_, ii) => ({ parameter: `P${gi}-${ii}`, value: 'v' })),
      })),
    }
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result).toEqual({ ok: false, error: OVERSIZED })
  })

  it('rejects a response whose total character count is over the ceiling', () => {
    const raw = {
      groups: Array.from({ length: 50 }, (_, gi) => ({
        group: `Group ${gi + 1}`,
        items: Array.from({ length: 3 }, (_, ii) => ({ parameter: `Parameter ${gi}-${ii}`, value: 'x'.repeat(200) })),
      })),
    }
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result).toEqual({ ok: false, error: OVERSIZED })
  })

  it('accepts a large-but-reasonable proposal just under the ceilings', () => {
    const raw = {
      groups: Array.from({ length: 4 }, (_, gi) => ({
        group: `Group ${gi + 1}`,
        items: Array.from({ length: 40 }, (_, ii) => ({ parameter: `Parameter ${gi}-${ii}`, value: '0.8 mm' })),
      })),
    }
    const result = specificationsTarget.parseAndValidate(raw, NO_CONTEXT)
    expect(result.ok).toBe(true)
  })
})
