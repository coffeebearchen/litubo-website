/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — the opaque source reference that replaced
 * raw Directus ids in everything the browser can see.
 *
 * These tests exercise the real signing/verification code, not a stand-in: the
 * point of the ref is that it cannot be read, forged, replayed across products
 * or accounts, or used after it expires, and each of those is asserted against
 * the shipped implementation.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createSourceRef, resolveSourceRef, resolveSourceRefs, SOURCE_REF_TTL_MS } from '../server/utils/aiSourceRef'

const OWNER = { productId: 3, adminUserId: 'admin-1' }

/**
 * The key is derived from the configured server secret (HKDF), so these tests
 * supply a fixed one. Using a stable secret is also what lets the
 * "derivation is deterministic" test below mean anything.
 */
beforeAll(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ directusToken: 'test-directus-token-for-key-derivation' }))
})

describe('createSourceRef — the ref reveals nothing', () => {
  it('does not contain the media id, the product id, or the user id in readable form', () => {
    const ref = createSourceRef(4242, { productId: 3, adminUserId: 'bd2be2bb-b994-4a9d-855c-07baf74ff054' })

    expect(ref).not.toContain('4242')
    expect(ref).not.toContain('bd2be2bb')
    expect(ref).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  /**
   * The decisive property, and the one an earlier signed-but-not-encrypted
   * version failed: base64-decoding every part of the ref must yield nothing
   * meaningful. Signing stops forgery; it does not stop reading.
   */
  it('cannot be decoded — no part of it reveals the ids it stands for', () => {
    const adminUserId = 'bd2be2bb-b994-4a9d-855c-07baf74ff054'
    const ref = createSourceRef(4242, { productId: 3, adminUserId })

    const decodedParts = ref.split('.').map(part => Buffer.from(part, 'base64url').toString('utf8'))
    const everything = ref + '|' + decodedParts.join('|')

    expect(everything).not.toContain('4242')
    expect(everything).not.toContain(adminUserId)
    expect(everything).not.toContain('bd2be2bb')
    // Not JSON, not readable structure — it is ciphertext.
    for (const part of decodedParts) {
      expect(() => JSON.parse(part)).toThrow()
      expect(part).not.toContain('"m"')
      expect(part).not.toContain('"p"')
      expect(part).not.toContain('"u"')
    }
  })

  it('two refs for the same file differ — the ciphertext is not a stable fingerprint of the id', () => {
    const a = createSourceRef(7, OWNER)
    const b = createSourceRef(7, OWNER)
    expect(a).not.toBe(b)
  })

  it('two refs for the same file are still valid — the ref is a handle, not a nonce', () => {
    const a = createSourceRef(7, OWNER)
    const b = createSourceRef(7, OWNER)
    expect(resolveSourceRef(a, OWNER)).toBe(7)
    expect(resolveSourceRef(b, OWNER)).toBe(7)
  })
})

describe('resolveSourceRef — binding and integrity', () => {
  it('round-trips to the original association id for the admin and product it was minted for', () => {
    expect(resolveSourceRef(createSourceRef(99, OWNER), OWNER)).toBe(99)
  })

  it('refuses a ref minted for a DIFFERENT product', () => {
    const ref = createSourceRef(99, { productId: 3, adminUserId: 'admin-1' })
    expect(resolveSourceRef(ref, { productId: 4, adminUserId: 'admin-1' })).toBeNull()
  })

  it('refuses a ref minted for a DIFFERENT admin', () => {
    const ref = createSourceRef(99, { productId: 3, adminUserId: 'admin-1' })
    expect(resolveSourceRef(ref, { productId: 3, adminUserId: 'admin-2' })).toBeNull()
  })

  it('refuses an EXPIRED ref', () => {
    const mintedAt = Date.now()
    const ref = createSourceRef(99, OWNER, mintedAt)
    expect(resolveSourceRef(ref, OWNER, mintedAt + SOURCE_REF_TTL_MS - 1000)).toBe(99)
    expect(resolveSourceRef(ref, OWNER, mintedAt + SOURCE_REF_TTL_MS + 1000)).toBeNull()
  })

  it('refuses a TAMPERED ciphertext — the authentication tag catches any edit', () => {
    const ref = createSourceRef(99, OWNER)
    const [iv, body, tag] = ref.split('.')

    // Flip a byte of the ciphertext body.
    const bytes = Buffer.from(body, 'base64url')
    bytes[0] ^= 0xff
    expect(resolveSourceRef(`${iv}.${bytes.toString('base64url')}.${tag}`, OWNER)).toBeNull()

    // Swap in another ref's authentication tag.
    const other = createSourceRef(100, OWNER).split('.')[2]
    expect(resolveSourceRef(`${iv}.${body}.${other}`, OWNER)).toBeNull()
  })

  it('refuses a ref with a stripped or replaced part', () => {
    const ref = createSourceRef(99, OWNER)
    const [iv, body, tag] = ref.split('.')
    expect(resolveSourceRef(`${iv}.${body}`, OWNER)).toBeNull()
    expect(resolveSourceRef(`${body}.${tag}`, OWNER)).toBeNull()
    expect(resolveSourceRef(`${iv}.${body}.`, OWNER)).toBeNull()
    expect(resolveSourceRef(`${iv}..${tag}`, OWNER)).toBeNull()
  })

  it.each([
    ['an empty string', ''],
    ['a plain number', '42'],
    ['a raw uuid', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    ['a non-string', 42 as unknown],
    ['null', null as unknown],
    ['an absurdly long value', 'x'.repeat(600)],
  ])('refuses %s', (_label, value) => {
    expect(resolveSourceRef(value, OWNER)).toBeNull()
  })
})

describe('createSourceRef — the derived key is stable within a process', () => {
  it('a ref minted now still resolves later in the same process — the key is not regenerated per call', () => {
    const first = createSourceRef(5, OWNER)
    // Mint a few more; a per-call or per-import random key would invalidate the first.
    for (let i = 0; i < 5; i++) createSourceRef(i + 10, OWNER)
    expect(resolveSourceRef(first, OWNER)).toBe(5)
  })
})

describe('resolveSourceRefs — all or nothing', () => {
  it('resolves a valid list to its association ids, de-duplicated', () => {
    const refs = [createSourceRef(1, OWNER), createSourceRef(2, OWNER), createSourceRef(1, OWNER)]
    expect(resolveSourceRefs(refs, OWNER, 5)).toEqual([1, 2])
  })

  it('refuses the WHOLE list if any single ref is invalid — never analyzes the subset that verified', () => {
    const refs = [createSourceRef(1, OWNER), 'forged', createSourceRef(2, OWNER)]
    expect(resolveSourceRefs(refs, OWNER, 5)).toBeNull()
  })

  it('refuses a list containing one ref from another product', () => {
    const refs = [createSourceRef(1, OWNER), createSourceRef(2, { productId: 99, adminUserId: 'admin-1' })]
    expect(resolveSourceRefs(refs, OWNER, 5)).toBeNull()
  })

  it('refuses an empty list, a non-array, and a list over the cap', () => {
    expect(resolveSourceRefs([], OWNER, 5)).toBeNull()
    expect(resolveSourceRefs('nope', OWNER, 5)).toBeNull()
    const tooMany = Array.from({ length: 6 }, (_, i) => createSourceRef(i + 1, OWNER))
    expect(resolveSourceRefs(tooMany, OWNER, 5)).toBeNull()
  })
})
