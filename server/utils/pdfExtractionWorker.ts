import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-01 — PDF parsing in an isolated, terminable,
 * memory-capped worker, on a dependency that actually supports the production
 * Node version.
 *
 * Why not `unpdf` any more: `unpdf@1.8.1` declares `engines: { node: ">=22" }`
 * while this project's production runtime is Node 20. Text extraction happened
 * to work when run against a real Node 20.18.1 build, but a declared engine
 * floor above the deployment target is an unowned risk — any patch release may
 * start using a Node 22 API and break production silently. `pdfjs-dist@4.10.38`
 * declares `engines: { node: ">=20" }`, is the same PDF engine `unpdf` wrapped,
 * and was verified end to end on a real Node 20.18.1 runtime (text extracted
 * correctly from a real PDF inside this worker). This is NOT a return to the
 * `pdf-parse` / `xlsx` path that broke Windows `nuxt dev`: those failed because
 * of dynamic template-string `require()` in a bundled legacy build; here the
 * engine is imported once, by an explicit absolute path, inside the worker.
 *
 * Isolation properties, each verified by `tests/pdfExtractionWorker.test.ts`
 * rather than asserted in prose:
 *
 *  - **Terminable.** On timeout the worker is really `terminate()`d and its
 *    `exit` event awaited, so a parse stuck in a CPU loop stops instead of
 *    running on after the caller gave up. `Promise.race` alone could not do
 *    this, which is why the previous implementation's "hard timeout" claim was
 *    wrong.
 *  - **Memory-capped.** `resourceLimits.maxOldGenerationSizeMb` bounds the
 *    thread's heap, so a decompression-bomb PDF cannot exhaust server memory;
 *    the thread dies instead. Confirmed on Node 20 with a deliberate allocator.
 *  - **Concurrency-capped.** At most `MAX_CONCURRENT_PDF_WORKERS` parses run
 *    at once; the rest queue.
 *  - **Total deadline includes queue time.** The clock starts when the caller
 *    asks, not when a slot frees up, so a saturated queue cannot stretch the
 *    real wait past the limit.
 */

/** At most this many PDFs are parsed at once; further calls queue rather than spawning unbounded threads. */
export const MAX_CONCURRENT_PDF_WORKERS = 2

/** Heap ceiling for one PDF worker thread. Exceeding it kills that thread only. */
export const PDF_WORKER_MEMORY_MB = 256

export type PdfWorkerOutcome =
  | { ok: true, text: string }
  | { ok: false, reason: 'timeout' | 'failed' }

export interface PdfWorkerLimits {
  /** Total wall-clock budget, including any time spent queued for a slot. */
  timeoutMs: number
  maxPages: number
  maxChars: number
  maxBytes: number
  /** Test-only override: the module the worker imports the PDF engine from. Defaults to the real `pdfjs-dist`. */
  moduleEntry?: string
}

/**
 * Runs as CommonJS inside the worker. Deliberately self-contained — it shares
 * no scope with this file and re-applies every limit itself, so a limit is
 * never enforced only on the (already abandoned) main-thread side.
 *
 * The per-page character budget is applied WHILE walking a page's text items,
 * not only after a page completes: a single page can expand to far more text
 * than the whole-file cap, and stopping only between pages would let one
 * pathological page blow straight past it.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')

function joinTextItems(items, budget) {
  let lastY
  let text = ''
  for (const item of items) {
    if (text.length >= budget) break
    const str = typeof item.str === 'string' ? item.str : ''
    const y = item.transform ? item.transform[5] : undefined
    if (lastY === y || lastY === undefined) text += str
    else text += '\\n' + str
    lastY = y
  }
  return text.slice(0, budget)
}

async function run() {
  const { bytes, moduleEntry, maxPages, maxChars, maxBytes, standardFontDataUrl } = workerData
  const data = new Uint8Array(bytes)
  if (data.byteLength === 0 || data.byteLength > maxBytes) return { ok: false, reason: 'failed' }

  const mod = await import(moduleEntry)
  const pdfjs = mod && mod.getDocument ? mod : (mod && mod.default ? mod.default : null)
  if (!pdfjs || typeof pdfjs.getDocument !== 'function') return { ok: false, reason: 'failed' }

  const task = pdfjs.getDocument({
    data,
    // No eval, no network fetches, no system font access: this worker only
    // ever turns bytes already on disk into text.
    isEvalSupported: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl,
  })

  let doc
  try {
    doc = await task.promise
    let text = ''
    const pageCount = Math.min(doc.numPages, maxPages)
    for (let i = 1; i <= pageCount; i++) {
      if (text.length >= maxChars) break
      const page = await doc.getPage(i)
      try {
        const content = await page.getTextContent()
        text += joinTextItems(content.items, maxChars - text.length)
      } finally {
        try { page.cleanup() } catch (e) { /* best effort */ }
      }
    }
    return { ok: true, text: text.slice(0, maxChars) }
  } finally {
    if (doc) { try { await doc.destroy() } catch (e) { /* best effort */ } }
  }
}

run().then(
  result => parentPort.postMessage(result),
  () => parentPort.postMessage({ ok: false, reason: 'failed' }),
)
`

let liveWorkers = 0

/** Number of PDF worker threads currently alive. Tests assert this returns to 0 after a timeout, proving the thread really exited. */
export function getLivePdfWorkerCount(): number {
  return liveWorkers
}

let activeSlots = 0
const waiting: Array<() => void> = []

/**
 * Waits for a concurrency slot, but never past `deadlineAt` — the caller's
 * total budget covers queue time too. Returns false if the deadline passed
 * while queued, in which case no slot was taken.
 */
async function acquireSlot(deadlineAt: number): Promise<boolean> {
  if (activeSlots < MAX_CONCURRENT_PDF_WORKERS) {
    activeSlots += 1
    return true
  }
  let release: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const granted = await new Promise<boolean>((resolve) => {
    release = () => resolve(true)
    waiting.push(release)
    const remaining = deadlineAt - Date.now()
    timer = setTimeout(() => resolve(false), Math.max(0, remaining))
  })
  clearTimeout(timer)
  if (!granted) {
    const index = release ? waiting.indexOf(release) : -1
    if (index >= 0) waiting.splice(index, 1)
    return false
  }
  activeSlots += 1
  return true
}

function releaseSlot(): void {
  activeSlots -= 1
  const next = waiting.shift()
  if (next) next()
}

/**
 * Returns a specifier the worker can `import()`.
 *
 * `import.meta.resolve()` first, deliberately: the production Nitro bundle
 * ships only ESM builds, so CommonJS resolution can ask for a `.cjs` entry
 * that is not present there and throw MODULE_NOT_FOUND — a failure mode
 * verified against a real `nuxt build` output, not assumed. `createRequire`
 * remains the fallback for runtimes without `import.meta.resolve`.
 */
function resolvePdfModule(specifier: string): string {
  const metaResolve = (import.meta as { resolve?: (s: string) => string }).resolve
  if (typeof metaResolve === 'function') {
    try {
      return metaResolve(specifier)
    } catch {
      // fall through to CommonJS resolution
    }
  }
  return createRequire(import.meta.url).resolve(specifier)
}

/**
 * Never throws and never returns partial text from a parse that overran: a
 * timeout produces `{ ok: false, reason: 'timeout' }` only after the worker
 * thread has been terminated and confirmed exited.
 */
export async function extractPdfTextInWorker(bytes: ArrayBuffer, limits: PdfWorkerLimits): Promise<PdfWorkerOutcome> {
  // The clock starts here, before queueing, so the caller's budget is the real
  // end-to-end wait rather than just the parse time.
  const deadlineAt = Date.now() + limits.timeoutMs

  let moduleEntry: string
  let standardFontDataUrl: string | undefined
  try {
    const resolved = limits.moduleEntry ?? resolvePdfModule('pdfjs-dist/legacy/build/pdf.mjs')
    // `import.meta.resolve` yields a file: URL, `createRequire().resolve` and
    // the test override yield a filesystem path. Dynamic `import()` of a bare
    // Windows path fails, so normalize to a URL href once, here.
    moduleEntry = resolved.startsWith('file:') ? resolved : pathToFileURL(resolved).href
    if (!limits.moduleEntry) {
      // A filesystem path, NOT a file: URL: pdf.js reads standard font data
      // through Node's filesystem factory, and Node's fetch cannot read file:
      // URLs — passing a URL here produces "Unable to load font data" warnings
      // on every parse. Only passed when the directory is actually present, so
      // a build that ships the engine without its font data stays quiet.
      const fontDir = fileURLToPath(new URL('../../standard_fonts/', moduleEntry))
      if (existsSync(fontDir)) standardFontDataUrl = fontDir
    }
  } catch {
    return { ok: false, reason: 'failed' }
  }

  const gotSlot = await acquireSlot(deadlineAt)
  if (!gotSlot) return { ok: false, reason: 'timeout' }

  const remainingMs = deadlineAt - Date.now()
  if (remainingMs <= 0) {
    releaseSlot()
    return { ok: false, reason: 'timeout' }
  }

  let worker: Worker
  try {
    worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        bytes,
        moduleEntry,
        standardFontDataUrl,
        maxPages: limits.maxPages,
        maxChars: limits.maxChars,
        maxBytes: limits.maxBytes,
      },
      resourceLimits: { maxOldGenerationSizeMb: PDF_WORKER_MEMORY_MB },
    })
  } catch {
    releaseSlot()
    return { ok: false, reason: 'failed' }
  }

  liveWorkers += 1
  const exited = new Promise<void>((resolve) => {
    worker.once('exit', () => {
      liveWorkers -= 1
      resolve()
    })
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const outcome = await new Promise<PdfWorkerOutcome>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), remainingMs)
      worker.once('message', (message: PdfWorkerOutcome) => resolve(message))
      // An 'error' here also covers the worker being killed by its own memory
      // ceiling — reported as a plain failure, never as partial text.
      worker.once('error', () => resolve({ ok: false, reason: 'failed' }))
      worker.once('exit', () => resolve({ ok: false, reason: 'failed' }))
    })

    // Always terminate — on timeout this is what actually stops a runaway
    // parse; on success it just closes an idle thread deterministically.
    await worker.terminate()
    await exited
    return outcome
  } finally {
    clearTimeout(timer)
    releaseSlot()
  }
}
