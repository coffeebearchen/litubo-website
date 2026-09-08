/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — proves the PDF timeout actually terminates
 * the parse rather than abandoning a promise that keeps running.
 *
 * The decisive assertion is `getLivePdfWorkerCount() === 0` after a timeout:
 * the previous `Promise.race` implementation would have passed a "the call
 * returned an error in time" test while the runaway parse kept burning the
 * server's only JavaScript thread. A thread that has exited cannot.
 *
 * These tests use real worker threads (no mocking of worker_threads) with a
 * stand-in PDF module that busy-loops forever — a busy loop blocks the
 * worker's event loop entirely, so nothing short of real termination stops it.
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  extractPdfTextInWorker,
  getLivePdfWorkerCount,
  MAX_CONCURRENT_PDF_WORKERS,
} from '../server/utils/pdfExtractionWorker'
import { extractTextFromFile, MAX_PDF_PAGES, MAX_PER_FILE_CHARS, MAX_FILE_BYTES } from '../server/utils/aiTextExtraction'

const HANGING_MODULE = fileURLToPath(new URL('./fixtures/hangingPdfModule.mjs', import.meta.url))
const REAL_UNPDF = resolve(process.cwd(), 'node_modules/unpdf/dist/index.mjs')

const FAST_LIMITS = {
  timeoutMs: 700,
  maxPages: MAX_PDF_PAGES,
  maxChars: MAX_PER_FILE_CHARS,
  maxBytes: MAX_FILE_BYTES,
}

/** The same minimal, real, valid single-page PDF builder used in aiTextExtraction.test.ts. */
function buildRealTestPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 712 Td (${text}) Tj ET`
  const objects: string[] = []
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n')
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  objects.push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

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
})

describe('extractPdfTextInWorker — normal parses still work through the worker', () => {
  it('extracts genuine text from a real PDF and exits its worker cleanly', async () => {
    const outcome = await extractPdfTextInWorker(toArrayBuffer(buildRealTestPdf('Detection sensitivity \\(Fe\\): 0.8 mm')), {
      timeoutMs: 15_000,
      maxPages: MAX_PDF_PAGES,
      maxChars: MAX_PER_FILE_CHARS,
      maxBytes: MAX_FILE_BYTES,
      moduleEntry: REAL_UNPDF,
    })

    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.text).toContain('Detection sensitivity (Fe): 0.8 mm')
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 30_000)

  it('re-applies the byte ceiling inside the worker, not only in the caller', async () => {
    const outcome = await extractPdfTextInWorker(toArrayBuffer(Buffer.alloc(2048, 'a')), {
      ...FAST_LIMITS,
      timeoutMs: 5_000,
      maxBytes: 1024, // smaller than the payload
      moduleEntry: REAL_UNPDF,
    })
    expect(outcome).toEqual({ ok: false, reason: 'failed' })
    expect(getLivePdfWorkerCount()).toBe(0)
  }, 20_000)
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
})
