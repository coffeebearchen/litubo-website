/**
 * Regression cover for the four AI targets added for the admin:
 *
 *   inquiry-summary   (inquiry 摘要 / 意图 / 缺项)
 *   product-listing   (产品摘要 / SEO / 分类建议)
 *   product-media     (产品主图与 alt 建议)
 *   product-intake    (从一份资料生成一个新产品)
 *
 * These are the only place an untrusted, already-JSON-parsed provider response is inspected before
 * anything else touches it, so the cases that matter are the refusals: an unknown intent, a made-up
 * category id, an invented or unsafe value, an over-long field, an extra property. Every one of them
 * must be dropped rather than stored.
 *
 * The fingerprints are tested too: they are what makes a proposal stale when the record it was based
 * on changes, which is the difference between "confirm this suggestion" and "confirm whatever is on
 * screen now".
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createInquirySummaryTarget } from '../server/utils/aiTargets/inquirySummaryTarget'
import { createProductListingTarget, LISTING_LIMITS } from '../server/utils/aiTargets/productListingTarget'
import { createProductMediaTarget, ALT_MAX } from '../server/utils/aiTargets/productMediaTarget'
import { createProductIntakeTarget, INTAKE_LIMITS } from '../server/utils/aiTargets/productIntakeTarget'
import { inquiryFingerprint, inquirySubjectKey, buildInquiryGenerationInput } from '../server/utils/inquiryAi'
import { productListingFingerprint } from '../server/utils/productListingAi'
import { productMediaFingerprint, type MediaCandidate } from '../server/utils/productMediaAi'
import { intakeFingerprint, slugBase, uniqueSlug } from '../server/utils/productIntake'
import {
  lookupAnalysis,
  rememberAnalysis,
  claimApply,
  settleApply,
  resetProposalGuard,
} from '../server/utils/aiProposalReplayGuard'
import type { AdminInquiry } from '../types/inquiries'

const NO_CONTEXT = { sourceMaterial: '' }

function inquiry(overrides: Partial<AdminInquiry> = {}): AdminInquiry {
  return {
    id: 22,
    status: 'new',
    inquiry_type: 'contact',
    submitted_at: null,
    updated_at: null,
    first_handled_at: null,
    contact_name: null,
    contact_email: 'test-only@example.invalid',
    contact_company: null,
    contact_country: null,
    contact_phone: null,
    message: 'We pack biscuits at 90 packs per minute.',
    locale: 'en',
    note: null,
    model_number: null,
    serial_number: null,
    related_product_slug: null,
    source_url: null,
    hubspot_sync_status: 'not_configured',
    hubspot_error_summary: null,
    raw_fields: null,
    ai_summary: null,
    ai_intent: null,
    ai_confidence: null,
    ai_processed_at: null,
    ai_reviewed: false,
    ...overrides,
  }
}

describe('inquiry-summary target', () => {
  const target = createInquirySummaryTarget()
  const valid = { summary: 'The visitor asks about metal detection for a biscuit line.', intent: 'contact', missing: ['Bag material'] }

  it('accepts a well-formed response', () => {
    expect(target.parseAndValidate(valid, NO_CONTEXT)).toEqual({ ok: true, output: valid })
  })

  it('rejects an intent that is not one of the project inquiry types', () => {
    const result = target.parseAndValidate({ ...valid, intent: 'pricing_request' }, NO_CONTEXT)
    expect(result.ok).toBe(false)
  })

  it('rejects an extra field the schema does not allow', () => {
    const result = target.parseAndValidate({ ...valid, draftReply: 'Dear customer' }, NO_CONTEXT)
    expect(result.ok).toBe(false)
  })

  it('refuses a summary that carries a link, a path or a line break', () => {
    for (const summary of [
      'See https://example.com for details.',
      'Stored at C:\\notes\\product.txt',
      'Line one\nLine two',
    ]) {
      expect(target.parseAndValidate({ ...valid, summary }, NO_CONTEXT).ok).toBe(false)
    }
  })

  it('refuses the whole proposal when the summary is empty or too long', () => {
    expect(target.parseAndValidate({ ...valid, summary: '   ' }, NO_CONTEXT).ok).toBe(false)
    expect(target.parseAndValidate({ ...valid, summary: 'x'.repeat(701) }, NO_CONTEXT).ok).toBe(false)
  })

  it('drops unusable missing items, de-duplicates them and caps the list at five', () => {
    const raw = {
      ...valid,
      missing: ['Bag material', 'Bag material', 'https://example.com', '', 'A', 'B', 'C', 'D', 'E'],
    }
    const result = target.parseAndValidate(raw, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.missing).toHaveLength(5)
    expect(new Set(result.output.missing).size).toBe(result.output.missing.length)
  })
})

describe('product-listing target', () => {
  const target = createProductListingTarget([1, 2, 3])
  const valid = {
    summary: 'The LT-150L is an online checkweigher for packaged food lines.',
    seoTitle: 'Online Checkweigher LT-150L',
    seoDescription: 'Compact online checkweigher for packaged food lines.',
    categoryId: 3,
  }

  it('accepts a well-formed response', () => {
    expect(target.parseAndValidate(valid, NO_CONTEXT)).toEqual({ ok: true, output: valid })
  })

  it('drops a category id that was not offered, instead of inventing one', () => {
    const result = target.parseAndValidate({ ...valid, categoryId: 99 }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.categoryId).toBeNull()
  })

  it('refuses the proposal when the summary is unusable', () => {
    expect(target.parseAndValidate({ ...valid, summary: '' }, NO_CONTEXT).ok).toBe(false)
    expect(target.parseAndValidate({ ...valid, summary: 'x'.repeat(LISTING_LIMITS.summary + 1) }, NO_CONTEXT).ok).toBe(false)
  })

  it('drops an over-long SEO field without failing the whole proposal', () => {
    const result = target.parseAndValidate({ ...valid, seoTitle: 'x'.repeat(LISTING_LIMITS.seoTitle + 1) }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.seoTitle).toBe('')
    expect(result.output.summary).toBe(valid.summary)
  })

  it('drops an SEO description that carries a URL', () => {
    const result = target.parseAndValidate({ ...valid, seoDescription: 'More at https://example.com' }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.seoDescription).toBe('')
  })
})

describe('product-media target', () => {
  const target = createProductMediaTarget([5, 6])

  it('accepts a row that was offered', () => {
    const result = target.parseAndValidate({ mediaRowId: 5, altText: 'Checkweigher on a production line.' }, NO_CONTEXT)
    expect(result).toEqual({ ok: true, output: { mediaRowId: 5, altText: 'Checkweigher on a production line.' } })
  })

  it('drops a row that was not offered', () => {
    const result = target.parseAndValidate({ mediaRowId: 77, altText: 'A picture.' }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.mediaRowId).toBe(0)
  })

  it('keeps "I cannot tell" as a legitimate answer (both fields empty)', () => {
    const result = target.parseAndValidate({ mediaRowId: 0, altText: '' }, NO_CONTEXT)
    expect(result).toEqual({ ok: true, output: { mediaRowId: 0, altText: '' } })
  })

  it('drops alt text that is too long or carries a link', () => {
    for (const altText of ['x'.repeat(ALT_MAX + 1), 'See https://example.com', 'C:\\photos\\a.jpg']) {
      const result = target.parseAndValidate({ mediaRowId: 6, altText }, NO_CONTEXT)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.output.altText).toBe('')
    }
  })

  it('rejects a response with an unexpected property', () => {
    expect(target.parseAndValidate({ mediaRowId: 5, altText: 'x', caption: 'y' }, NO_CONTEXT).ok).toBe(false)
  })
})

describe('product-intake target', () => {
  const target = createProductIntakeTarget([1, 2, 3])
  const valid = {
    name: 'Belt-Type Metal Detector',
    modelOrSeries: 'MD-300',
    summary: 'A belt-type metal detector for conveyor lines.',
    seoTitle: 'Belt-Type Metal Detector MD-300',
    seoDescription: 'Belt-type metal detector for conveyor lines.',
    categoryId: 2,
    specs: [
      { group: 'Detection', parameter: 'Aperture size', value: '300 x 200 mm' },
      { group: 'Detection', parameter: 'Sensitivity (Fe)', value: '1.2 mm' },
    ],
  }

  it('accepts a well-formed response', () => {
    expect(target.parseAndValidate(valid, NO_CONTEXT)).toEqual({ ok: true, output: valid })
  })

  it('refuses the whole proposal when no usable name was produced', () => {
    for (const name of ['', '   ', 'x'.repeat(INTAKE_LIMITS.name + 1), 'https://example.com']) {
      expect(target.parseAndValidate({ ...valid, name }, NO_CONTEXT).ok).toBe(false)
    }
  })

  it('drops a duplicate parameter and keeps the first value', () => {
    const result = target.parseAndValidate({
      ...valid,
      specs: [
        { group: 'Detection', parameter: 'Aperture size', value: '300 x 200 mm' },
        { group: 'detection', parameter: 'aperture size', value: '999 mm' },
      ],
    }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.specs).toHaveLength(1)
    expect(result.output.specs[0]!.value).toBe('300 x 200 mm')
  })

  it('drops an unsafe parameter value and a value over the cap', () => {
    const result = target.parseAndValidate({
      ...valid,
      specs: [
        { group: 'G', parameter: 'P', value: 'see https://example.com' },
        { group: 'G', parameter: 'Q', value: 'x'.repeat(INTAKE_LIMITS.value + 1) },
        { group: 'G', parameter: 'R', value: 'ok value' },
      ],
    }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.specs).toEqual([{ group: 'G', parameter: 'R', value: 'ok value' }])
  })

  it('caps the number of parameter rows', () => {
    const specs = Array.from({ length: INTAKE_LIMITS.specs + 10 }, (_, i) => ({ group: 'G', parameter: `P${i}`, value: `V${i}` }))
    const result = target.parseAndValidate({ ...valid, specs }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.specs).toHaveLength(INTAKE_LIMITS.specs)
  })

  it('drops a category id that was not offered', () => {
    const result = target.parseAndValidate({ ...valid, categoryId: 42 }, NO_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output.categoryId).toBe(0)
  })

  it('rejects an extra property such as a status or a media field', () => {
    expect(target.parseAndValidate({ ...valid, status: 'published' }, NO_CONTEXT).ok).toBe(false)
  })
})

describe('fingerprints make an old proposal stale', () => {
  it('changes when the inquiry message changes, and not when an unrelated field does', () => {
    const base = inquiry()
    expect(inquiryFingerprint(base)).toBe(inquiryFingerprint(inquiry({ contact_phone: '+1 555 0100' })))
    expect(inquiryFingerprint(base)).not.toBe(inquiryFingerprint(inquiry({ message: 'A different question.' })))
  })

  it('changes when the product text or category changes', () => {
    const product = { id: 1, name_en: 'A', product_code: 'LT-1', model_or_series: 'S', summary_en: 's', category_id: 1 }
    const changed = { ...product, category_id: 2 }
    expect(productListingFingerprint(product)).not.toBe(productListingFingerprint(changed))
  })

  it('changes when the set of pictures changes, whatever the order', () => {
    const product = { name_en: 'A', product_code: 'LT-1', summary_en: 's' }
    const a: MediaCandidate = { rowId: 1, fileId: 'f1', label: 'a', title: null, currentAlt: null }
    const b: MediaCandidate = { rowId: 2, fileId: 'f2', label: 'b', title: null, currentAlt: null }
    expect(productMediaFingerprint(product, [a, b])).toBe(productMediaFingerprint(product, [b, a]))
    expect(productMediaFingerprint(product, [a, b])).not.toBe(productMediaFingerprint(product, [a]))
    expect(productMediaFingerprint(product, [a, b])).not.toBe(
      productMediaFingerprint(product, [a, { ...b, currentAlt: 'now described' }]),
    )
  })

  it('changes when the document or the typed product code changes', () => {
    expect(intakeFingerprint('file-1', 'LT-1')).toBe(intakeFingerprint('file-1', 'LT-1'))
    expect(intakeFingerprint('file-1', 'LT-1')).not.toBe(intakeFingerprint('file-2', 'LT-1'))
    expect(intakeFingerprint('file-1', 'LT-1')).not.toBe(intakeFingerprint('file-1', 'LT-2'))
  })
})

describe('product naming helpers', () => {
  it('turns a product name into a URL-safe slug base', () => {
    expect(slugBase('Belt-Type Metal Detector')).toBe('belt-type-metal-detector')
    expect(slugBase('  Ünïcode  Name  ')).toBe('unicode-name')
    expect(slugBase('!!!')).toBe('')
  })

  it('suffixes a slug that is already taken, and never reuses a taken base', async () => {
    const taken = new Set(['metal-detector', 'metal-detector-2'])
    const fetch = async <T>(path: string): Promise<T> => {
      const match = /filter\[slug\]\[_eq\]=([^&]+)/.exec(path)
      const slug = decodeURIComponent(match?.[1] ?? '')
      return { data: taken.has(slug) ? [{ id: 1 }] : [] } as unknown as T
    }
    await expect(uniqueSlug(fetch, 'metal-detector')).resolves.toBe('metal-detector-3')
    await expect(uniqueSlug(fetch, 'checkweigher')).resolves.toBe('checkweigher')
  })

  it('builds the subject key that keeps two inquiries apart', () => {
    expect(inquirySubjectKey(22)).toBe('inquiry:22')
    expect(inquirySubjectKey(22)).not.toBe(inquirySubjectKey(23))
  })

  it('starts the prompt input from the stored message only', () => {
    const input = buildInquiryGenerationInput(inquiry())
    expect(input.extractedSourceTexts).toHaveLength(1)
    expect(input.extractedSourceTexts[0]!.text).toContain('90 packs per minute')
    // Contact identity is deliberately not part of what the provider is shown.
    expect(JSON.stringify(input)).not.toContain('test-only@example.invalid')
  })
})

describe('the proposal guard spends a reference exactly once', () => {
  beforeEach(() => {
    resetProposalGuard()
  })

  const scope = {
    adminUserId: 'admin-1',
    subjectKey: 'product-intake',
    targetId: 'product-intake',
    providerId: 'deepseek',
    fingerprint: 'fp-1',
  }

  it('reports a confirmed analysis as already applied, and never mints a second reference for it', () => {
    const ref = rememberAnalysis(scope, { name: 'A' })
    expect(lookupAnalysis(scope)?.alreadyApplied).toBe(false)
    expect(claimApply(ref, { subjectKey: 'product-intake', adminUserId: 'admin-1' }).ok).toBe(true)
    settleApply(ref, { ok: true, appliedCount: 1, totalCount: 1, partial: false, message: 'done' })

    const after = lookupAnalysis(scope)
    expect(after?.alreadyApplied).toBe(true)
    expect(after?.proposalRef).toBe(ref)
    // This is precisely why the endpoints switch to a timestamped scope to generate again: asking for
    // the same scope returns the spent reference, whose confirmation can only answer 409.
    expect(rememberAnalysis(scope, { name: 'B' })).toBe(ref)
  })

  it('does not hand one administrator another administrator\'s proposal', () => {
    const ref = rememberAnalysis(scope, { name: 'A' })
    expect(claimApply(ref, { subjectKey: 'product-intake', adminUserId: 'admin-2' }).ok).toBe(false)
  })

  it('does not hand one subject another subject\'s proposal', () => {
    const ref = rememberAnalysis(scope, { name: 'A' })
    expect(claimApply(ref, { subjectKey: 'inquiry:9', adminUserId: 'admin-1' }).ok).toBe(false)
  })
})
