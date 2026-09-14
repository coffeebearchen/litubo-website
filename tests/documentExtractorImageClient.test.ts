/**
 * AI-IMAGE-OCR-SOURCE-01 — the Nuxt server's image OCR reader client.
 *
 * The transport is stubbed: no sidecar, no network. Only two answers ever leave
 * the client — a bounded transcription or one agreed failure code — and bytes
 * that are not the format their stored type says are never sent at all.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  IMAGE_READER_FAILURE_CODES,
  MAX_IMAGE_OCR_TEXT_CHARS,
  createImageTextReader,
  detectImageType,
  extractorEndpoint,
  imageMatchesDeclaredType,
} from '../server/utils/documentExtractorClient'
import * as sidecar from '../document-extractor/extractor.mjs'
import { brokenImage, fixture, solidPng } from './helpers/testOnlyImage'

const BASE_URL = 'http://127.0.0.1:8787'
const PNG = fixture('TEST-ONLY-nameplate-en.png')
const JPEG = fixture('TEST-ONLY-nameplate-en.jpg')
const WEBP = fixture('TEST-ONLY-nameplate-en.webp')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function reader(response: Response | (() => Promise<Response>)) {
  const fetchImpl = vi.fn(async (_url: URL, _init: RequestInit) => (typeof response === 'function' ? response() : response))
  return { read: createImageTextReader({ baseUrl: BASE_URL, fetchImpl: fetchImpl as unknown as typeof fetch }), fetchImpl }
}

describe('the client and the sidecar agree on the image contract', () => {
  it('the same text ceiling and the same failure codes', () => {
    expect(MAX_IMAGE_OCR_TEXT_CHARS).toBe(sidecar.MAX_OCR_TEXT_CHARS)
    expect([...IMAGE_READER_FAILURE_CODES]).toEqual([...sidecar.IMAGE_FAILURE_CODES])
  })

  it('the same signature check, byte for byte', () => {
    for (const bytes of [PNG, JPEG, WEBP, solidPng(4, 4), brokenImage('jpeg'), brokenImage('webp'), new TextEncoder().encode('<svg/>'), new Uint8Array(0)]) {
      expect(detectImageType(bytes)).toBe(sidecar.detectImageType(Buffer.from(bytes)))
    }
  })

  it('an image endpoint is /extract/image on the same configured base', () => {
    expect(extractorEndpoint(BASE_URL, 'extract/image')?.href).toBe('http://127.0.0.1:8787/extract/image')
    expect(extractorEndpoint(BASE_URL)?.href).toBe('http://127.0.0.1:8787/extract/pdf')
  })
})

describe('the stored content type must match the bytes', () => {
  it.each([
    [PNG, 'image/png', true],
    [JPEG, 'image/jpeg', true],
    [JPEG, 'image/jpg', true],
    [WEBP, 'IMAGE/WEBP; charset=binary', true],
    [JPEG, 'image/png', false],
    [PNG, 'image/webp', false],
    [new TextEncoder().encode('<svg/>'), 'image/png', false],
    [PNG, 'image/gif', false],
    [PNG, null, false],
  ] as Array<[Uint8Array, string | null, boolean]>)('%#', (bytes, mimeType, expected) => {
    expect(imageMatchesDeclaredType(bytes, mimeType)).toBe(expected)
  })
})

describe('createImageTextReader — only two answers leave it', () => {
  it('posts the bytes alone, as their real format, with no redirect, and returns the transcription', async () => {
    const { read, fetchImpl } = reader(jsonResponse(200, { ok: true, text: 'LT-180C\nVoltage 220 V' }))
    expect(await read(JPEG, { timeoutMs: 20_000, mimeType: 'image/jpg' })).toEqual({ ok: true, text: 'LT-180C\nVoltage 220 V' })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe('http://127.0.0.1:8787/extract/image')
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, redirect: 'error' })
    expect(init.body).toBe(JPEG)
  })

  it('bytes that are not their stored format are malformed and never sent', async () => {
    const { read, fetchImpl } = reader(jsonResponse(200, { ok: true, text: 'x' }))
    expect(await read(PNG, { timeoutMs: 20_000, mimeType: 'image/jpeg' })).toEqual({ ok: false, code: 'malformed' })
    expect(await read(new TextEncoder().encode('<svg/>'), { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code: 'malformed' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('no time left is timeout and nothing is sent; no configured sidecar is unavailable', async () => {
    const { read, fetchImpl } = reader(jsonResponse(200, { ok: true, text: 'x' }))
    expect(await read(PNG, { timeoutMs: 0, mimeType: 'image/png' })).toEqual({ ok: false, code: 'timeout' })
    expect(fetchImpl).not.toHaveBeenCalled()
    const unconfigured = createImageTextReader({ baseUrl: '' })
    expect(await unconfigured(PNG, { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code: 'unavailable' })
  })

  it.each(IMAGE_READER_FAILURE_CODES.map(code => [code]))('the agreed code %s passes through', async (code) => {
    const { read } = reader(jsonResponse(422, { ok: false, code }))
    expect(await read(PNG, { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code })
  })

  it.each([
    ['an unknown code', jsonResponse(422, { ok: false, code: 'vision_failed' })],
    ['a PDF-only code', jsonResponse(422, { ok: false, code: 'too_many_pages' })],
    ['a transcription over 8,000 characters', jsonResponse(200, { ok: true, text: 'x'.repeat(8_001) })],
    ['a success status with a failure body', jsonResponse(200, { ok: false, code: 'malformed' })],
    ['a body that is not JSON', new Response('<html>stderr: /tmp/x.png</html>', { status: 500 })],
    ['an extra field smuggling metadata', jsonResponse(502, { ok: false, code: 'weird', exif: 'GPS SECRET' })],
  ])('%s is unavailable, and nothing from it goes further', async (_label, response) => {
    const { read } = reader(response)
    expect(await read(PNG, { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code: 'unavailable' })
  })

  it('an empty transcription is no_text; a transport failure is unavailable', async () => {
    expect(await reader(jsonResponse(200, { ok: true, text: '  \n ' })).read(PNG, { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code: 'no_text' })
    const failing = reader(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8787')
    })
    expect(await failing.read(PNG, { timeoutMs: 20_000, mimeType: 'image/png' })).toEqual({ ok: false, code: 'unavailable' })
  })
})
