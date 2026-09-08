/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — proves the PDF path is genuinely
 * isolated: terminable, memory-capped, concurrency-capped, and bounded by a
 * deadline that includes queue time.
 *
 * The decisive assertion throughout is `getLivePdfWorkerCount() === 0`: the
 * old `Promise.race` implementation would have passed a "the call returned an
 * error in time" test while the runaway parse kept burning the server's only
 * JavaScript thread. A thread that has exited cannot.
 *
 * These tests use real worker threads and the real `pdfjs-dist` engine — the
 * only stand-in is a fixture module that hangs on purpose, which is the one
 * behaviour a real PDF cannot be relied upon to reproduce deterministically.
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import {
  extractPdfTextInWorker,
  getLivePdfWorkerCount,
  MAX_CONCURRENT_PDF_WORKERS,
  PDF_WORKER_MEMORY_MB,
} from '../server/utils/pdfExtractionWorker'
import { extractTextFromFile, MAX_PDF_PAGES, MAX_PER_FILE_CHARS, MAX_FILE_BYTES } from '../server/utils/aiTextExtraction'

const HANGING_MODULE = fileURLToPath(new URL('./fixtures/hangingPdfModule.mjs', import.meta.url))
const REAL_PDFJS = createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs')

const FAST_LIMITS = {
  timeoutMs: 700,
  maxPages: MAX_PDF_PAGES,
  maxChars: MAX_PER_FILE_CHARS,
  maxBytes: MAX_FILE_BYTES,
}

/**
 * A minimal, real, valid PDF. `pagesText` supplies one content stream per
 * page, so a caller can build both an ordinary document and one whose single
 * page expands to far more text than the per-file cap.
 */
function buildRealTestPdf(pagesText: string[]): Buffer {
  const objects: string[] = []
  const pageCount = pagesText.length
  const pageObjIds = pagesText.map((_, i) => 3 + i * 2)
  const kids = pageObjIds.map(id => `${id} 0 R`).join(' ')

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`)
  for (let i = 0; i < pageCount; i++) {
    const pageId = pageObjIds[i]
    const contentId = pageId + 1
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentId} 0 R >>\nendobj\n`)
    const content = pagesText[i]
    objects.push(`${contentId} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
  }
  objects.push(`${3 + pageCount * 2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += obj
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

/** One page whose content stream draws `lineCount` separate text runs — a single page that expands to a lot of text. */
function hugeSinglePageContent(lineCount: number, chunk: string): string {
  let stream = 'BT /F1 8 Tf 10 780 Td'
  for (let i = 0; i < lineCount; i++) stream += ` (${chunk}) Tj 0 -1 Td`
  stream += ' ET'
  return stream
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('extractPdfTextInWorker — a parse that never finishes is really terminated', () => {
  it('times out AND leaves no live worker thread behind', async () => {
    expect(getLivePdfWorkerCount()).toBe(0)

    const started = Date.now()
    const outcome = await extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 fake')), {
      ...FAST_LIMITS,
      moduleEntry: HANGING_MODULE,
    })
    const elapsed = Date.now() - started

    expect(outcome).toEqual({ ok: false, reason: 'timeout' })
    expect(elapsed).toBeGreaterThanOrEqual(FAST_LIMITS.timeoutMs - 50)
    // The decisive assertion: the thread running the runaway parse is gone.
    // A Promise.race timeout would leave this at 1.
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 20_000)

  it('terminates every hung worker, so repeated timeouts do not accumulate threads', async () => {
    const outcomes = await Promise.all([
      extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 a')), { ...FAST_LIMITS, moduleEntry: HANGING_MODULE }),
      extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 b')), { ...FAST_LIMITS, moduleEntry: HANGING_MODULE }),
      extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 c')), { ...FAST_LIMITS, moduleEntry: HANGING_MODULE }),
    ])

    for (const outcome of outcomes) expect(outcome).toEqual({ ok: false, reason: 'timeout' })
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 30_000)

  it('never runs more than MAX_CONCURRENT_PDF_WORKERS parses at once', async () => {
    let peak = 0
    const sampler = setInterval(() => {
      peak = Math.max(peak, getLivePdfWorkerCount())
    }, 20)

    await Promise.all(Array.from({ length: 5 }, () =>
      extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 x')), { ...FAST_LIMITS, moduleEntry: HANGING_MODULE }),
    ))
    clearInterval(sampler)

    expect(peak).toBeGreaterThan(0) // the sampler really observed live workers
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_PDF_WORKERS)
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 40_000)

  it('the total deadline covers queue time — a queued call cannot wait past its own budget', async () => {
    const timeoutMs = 900
    const started = Date.now()

    // Saturate the pool and queue three more behind it. If the deadline only
    // started once a slot freed up, the last callers would finish at roughly
    // 3x the budget instead of within it.
    const outcomes = await Promise.all(Array.from({ length: 6 }, () =>
      extractPdfTextInWorker(toArrayBuffer(Buffer.from('%PDF-1.4 q')), {
        ...FAST_LIMITS,
        timeoutMs,
        moduleEntry: HANGING_MODULE,
      }),
    ))
    const elapsed = Date.now() - started

    for (const outcome of outcomes) expect(outcome).toEqual({ ok: false, reason: 'timeout' })
    // Everything resolves within roughly one budget, not one budget per queue wave.
    expect(elapsed).toBeLessThan(timeoutMs * 2)
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 40_000)
})

describe('extractPdfTextInWorker — normal parses still work through the worker', () => {
  it('extracts genuine text from a real PDF and exits its worker cleanly', async () => {
    const pdf = buildRealTestPdf(['BT /F1 24 Tf 72 712 Td (Detection sensitivity \\(Fe\\): 0.8 mm) Tj ET'])
    const outcome = await extractPdfTextInWorker(toArrayBuffer(pdf), {
      timeoutMs: 20_000,
      maxPages: MAX_PDF_PAGES,
      maxChars: MAX_PER_FILE_CHARS,
      maxBytes: MAX_FILE_BYTES,
    })

    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.text).toContain('Detection sensitivity (Fe): 0.8 mm')
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 40_000)

  it('re-applies the byte ceiling inside the worker, not only in the caller', async () => {
    const outcome = await extractPdfTextInWorker(toArrayBuffer(Buffer.alloc(2048, 'a')), {
      ...FAST_LIMITS,
      timeoutMs: 5_000,
      maxBytes: 1024, // smaller than the payload
    })
    expect(outcome).toEqual({ ok: false, reason: 'failed' })
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 20_000)

  it('declares a real heap ceiling for the worker thread', () => {
    expect(PDF_WORKER_MEMORY_MB).toBeGreaterThan(0)
    expect(PDF_WORKER_MEMORY_MB).toBeLessThanOrEqual(512)
  })
})

describe('extractPdfTextInWorker — a single page that expands to enormous text is capped during extraction', () => {
  it('caps one huge page at maxChars instead of letting it blow past the whole-file budget', async () => {
    // ~40k text runs on ONE page: stopping only between pages would return far
    // more than the cap, because the page never ends before the budget does.
    const chunk = 'LOREM IPSUM DOLOR SIT AMET CONSECTETUR'
    const pdf = buildRealTestPdf([hugeSinglePageContent(40_000, chunk)])
    expect(pdf.byteLength).toBeGreaterThan(1_000_000) // a genuinely large single page

    const maxChars = 5_000
    const outcome = await extractPdfTextInWorker(toArrayBuffer(pdf), {
      timeoutMs: 60_000,
      maxPages: MAX_PDF_PAGES,
      maxChars,
      maxBytes: MAX_FILE_BYTES,
    })

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.text.length).toBeLessThanOrEqual(maxChars)
      expect(outcome.text).toContain('LOREM IPSUM')
    }
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 90_000)

  it('the same document through extractTextFromFile also respects the per-file cap', async () => {
    const pdf = buildRealTestPdf([hugeSinglePageContent(20_000, 'ALPHA BETA GAMMA DELTA EPSILON ZETA')])
    const result = await extractTextFromFile(toArrayBuffer(pdf), 'application/pdf', 'Source 1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.source.text.length).toBeLessThanOrEqual(MAX_PER_FILE_CHARS)
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 90_000)
})

describe('extractTextFromFile — the PDF path goes through the worker', () => {
  it('a hanging PDF parse becomes the same safe, generic failure, with no worker left running', async () => {
    const result = await extractTextFromFile(
      toArrayBuffer(Buffer.from('%PDF-1.4 hangs forever')),
      'application/pdf',
      'Source 1',
      HANGING_MODULE,
    )

    expect(result).toEqual({ ok: false, reason: 'This file could not be read.' })
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 30_000)

  it('the real engine entry resolves to pdfjs-dist, not to a package the production Node version does not support', () => {
    expect(REAL_PDFJS).toContain('pdfjs-dist')
    expect(REAL_PDFJS).not.toContain('unpdf')
  })
})
