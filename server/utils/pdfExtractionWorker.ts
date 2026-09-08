import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { getDocumentProxy } from 'unpdf'

/**
 * PWS-AI-ENGINE-01R2-SAFETY-02 — PDF parsing in a genuinely terminable
 * execution unit.
 *
 * The previous implementation raced the parse against a timer with
 * `Promise.race`. That bounded how long the *caller* waited, but it could not
 * stop the parse: a pathological PDF that sent pdf.js into a long or infinite
 * CPU loop kept that loop running on the server's only JavaScript thread
 * after the caller had already given up, blocking every other request. Calling
 * that a "hard timeout" was wrong, and the wording has been corrected
 * throughout.
 *
 * The parse now runs in a `worker_threads` Worker. On timeout the worker is
 * actually `terminate()`d — Node stops that thread even mid-CPU-loop — and
 * this function waits for the thread's `exit` event before returning, so when
 * it resolves the work is provably gone rather than merely abandoned.
 * `getLivePdfWorkerCount()` exists so tests can assert exactly that.
 *
 * The worker is created from an inline source string (`eval: true`) rather
 * than a separate entry file, because the production Nitro bundle has no
 * stable on-disk path for a second entry point. It therefore imports the PDF
 * library by absolute path, resolved in this thread — which is invisible to
 * the bundler, so the static `getDocumentProxy` import above is what keeps
 * `unpdf` in the traced production dependency set. `resolvePdfModuleEntry()`
 * asserts on it so a broken trace fails loudly and immediately instead of
 * silently at parse time.
 */

/** At most this many PDFs are parsed at once; further calls queue rather than spawning unbounded threads. */
export const MAX_CONCURRENT_PDF_WORKERS = 2

export type PdfWorkerOutcome =
  | { ok: true, text: string }
  | { ok: false, reason: 'timeout' | 'failed' }

export interface PdfWorkerLimits {
  timeoutMs: number
  maxPages: number
  maxChars: number
  maxBytes: number
  /** Test-only override: the module the worker imports `getDocumentProxy` from. Defaults to the real `unpdf`. */
  moduleEntry?: string
}

/**
 * Runs as CommonJS inside the worker. Deliberately self-contained — it shares
 * no scope with this file and re-applies every limit itself, so a limit is
 * never enforced only on the (already abandoned) main-thread side.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')

function joinPageText(items) {
  let lastY
  let text = ''
  for (const item of items) {
    if (lastY === item.transform[5] || lastY === undefined) text += item.str
    else text += '\\n' + item.str
    lastY = item.transform[5]
  }
  return text
}

async function run() {
  const { bytes, moduleEntry, maxPages, maxChars, maxBytes } = workerData
  const data = new Uint8Array(bytes)
  if (data.byteLength === 0 || data.byteLength > maxBytes) return { ok: false, reason: 'failed' }

  const href = String(moduleEntry).startsWith('file:') ? moduleEntry : pathToFileURL(moduleEntry).href
  const mod = await import(href)
  const getDocumentProxy = mod.getDocumentProxy || (mod.default && mod.default.getDocumentProxy)
  if (typeof getDocumentProxy !== 'function') return { ok: false, reason: 'failed' }

  const doc = await getDocumentProxy(data)
  let text = ''
  const pageCount = Math.min(doc.numPages, maxPages)
  for (let i = 1; i <= pageCount; i++) {
    if (text.length >= maxChars) break
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += '\\n\\n' + joinPageText(content.items)
  }
  try { await doc.cleanup() } catch (e) { /* best effort */ }
  return { ok: true, text: text.slice(0, maxChars) }
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

async function acquireSlot(): Promise<void> {
  if (activeSlots < MAX_CONCURRENT_PDF_WORKERS) {
    activeSlots += 1
    return
  }
  await new Promise<void>(resolve => waiting.push(resolve))
  activeSlots += 1
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
 * ships only `unpdf`'s ESM build, so CommonJS resolution asks for a
 * `dist/index.cjs` that does not exist there and throws MODULE_NOT_FOUND —
 * verified against a real `nuxt build` output, not assumed. `createRequire`
 * remains as the fallback for runtimes without `import.meta.resolve`, where
 * the CJS build is present.
 */
function resolvePdfModuleEntry(): string {
  if (typeof getDocumentProxy !== 'function') {
    throw new Error('The PDF module is not available in this build.')
  }
  const metaResolve = (import.meta as { resolve?: (specifier: string) => string }).resolve
  if (typeof metaResolve === 'function') {
    try {
      return metaResolve('unpdf')
    } catch {
      // fall through to CommonJS resolution
    }
  }
  return createRequire(import.meta.url).resolve('unpdf')
}

/**
 * Never throws and never returns partial text from a parse that overran: a
 * timeout produces `{ ok: false, reason: 'timeout' }` only after the worker
 * thread has been terminated and confirmed exited.
 */
export async function extractPdfTextInWorker(bytes: ArrayBuffer, limits: PdfWorkerLimits): Promise<PdfWorkerOutcome> {
  let moduleEntry: string
  try {
    moduleEntry = limits.moduleEntry ?? resolvePdfModuleEntry()
  } catch {
    return { ok: false, reason: 'failed' }
  }

  await acquireSlot()

  let worker: Worker
  try {
    worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        bytes,
        moduleEntry,
        maxPages: limits.maxPages,
        maxChars: limits.maxChars,
        maxBytes: limits.maxBytes,
      },
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
      timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), limits.timeoutMs)
      worker.once('message', (message: PdfWorkerOutcome) => resolve(message))
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
