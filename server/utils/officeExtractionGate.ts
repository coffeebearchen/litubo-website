/**
 * AI-XLSX-SOURCE-01 — one Office document parsed at a time.
 *
 * The workbook reader runs inside the server process. Its input, its inflation
 * and its XML are all bounded, but several administrators analyzing large
 * workbooks at once would still multiply that work. This gate lets one Office
 * parse run, lets at most three wait, and answers anything more with `busy` —
 * the same shape as the PDF sidecar's own queue.
 *
 * A waiter gives up at its deadline, which is the same deadline its parse would
 * have had, so time spent queuing is taken from the analysis's reading budget,
 * never added to it. The gate knows nothing about spreadsheets, so the Word
 * reader can share it.
 */

export const OFFICE_MAX_ACTIVE = 1
export const OFFICE_MAX_QUEUED = 3

export type OfficeGateResult<T> = { ok: true, value: T } | { ok: false, code: 'busy' }

export interface OfficeExtractionGate {
  /** Runs `task` when a slot is free before `deadline`; otherwise answers `busy` without running it. */
  run<T>(task: () => Promise<T>, options: { deadline: number, now?: () => number }): Promise<OfficeGateResult<T>>
  stats(): { active: number, queued: number }
}

export function createOfficeExtractionGate(
  { maxActive = OFFICE_MAX_ACTIVE, maxQueued = OFFICE_MAX_QUEUED }: { maxActive?: number, maxQueued?: number } = {},
): OfficeExtractionGate {
  let active = 0
  const waiting: Array<(granted: boolean) => void> = []

  const release = () => {
    active -= 1
    const next = waiting.shift()
    if (next) {
      active += 1
      next(true)
    }
  }

  return {
    async run(task, { deadline, now = Date.now }) {
      if (active < maxActive) {
        active += 1
      }
      else {
        const waitMs = deadline - now()
        if (waiting.length >= maxQueued || waitMs <= 0) return { ok: false, code: 'busy' }
        const granted = await new Promise<boolean>((resolve) => {
          // Called only by release(), after the timer below exists.
          const admit = (ok: boolean) => {
            clearTimeout(timer)
            resolve(ok)
          }
          const timer = setTimeout(() => {
            const index = waiting.indexOf(admit)
            if (index !== -1) waiting.splice(index, 1)
            resolve(false)
          }, waitMs)
          waiting.push(admit)
        })
        // The slot was handed over by release(), already counted as active.
        if (!granted) return { ok: false, code: 'busy' }
      }
      try {
        return { ok: true, value: await task() }
      }
      finally {
        release()
      }
    },
    stats: () => ({ active, queued: waiting.length }),
  }
}

/** The process-wide gate every Office reader shares. */
export const officeExtractionGate = createOfficeExtractionGate()
