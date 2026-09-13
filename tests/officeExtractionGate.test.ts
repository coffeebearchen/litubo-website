/**
 * AI-XLSX-SOURCE-01 — one Office parse at a time (`officeExtractionGate.ts`).
 *
 * The gate never sees a spreadsheet: every task here is a controllable promise,
 * so nothing waits on a real parse or on eight real seconds.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OFFICE_MAX_ACTIVE,
  OFFICE_MAX_QUEUED,
  createOfficeExtractionGate,
  officeExtractionGate,
} from '../server/utils/officeExtractionGate'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise<void>(done => setImmediate(done))
const inAMinute = () => Date.now() + 60_000

afterEach(() => {
  vi.useRealTimers()
})

describe('officeExtractionGate', () => {
  it('allows one active Office parse and three waiting, shared by the whole process', () => {
    expect(OFFICE_MAX_ACTIVE).toBe(1)
    expect(OFFICE_MAX_QUEUED).toBe(3)
    expect(officeExtractionGate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('runs one task, queues three in order, and answers a fifth busy without running it', async () => {
    const gate = createOfficeExtractionGate()
    const started: number[] = []
    let running = 0
    let peak = 0
    const holds = [0, 1, 2, 3].map(() => deferred())
    const runs = holds.map((hold, index) => gate.run(async () => {
      started.push(index)
      running += 1
      peak = Math.max(peak, running)
      await hold.promise
      running -= 1
      return index
    }, { deadline: inAMinute() }))
    await flush()
    expect(started).toEqual([0])
    expect(gate.stats()).toEqual({ active: 1, queued: 3 })

    const fifth = vi.fn(async () => -1)
    await expect(gate.run(fifth, { deadline: inAMinute() })).resolves.toEqual({ ok: false, code: 'busy' })
    expect(fifth).not.toHaveBeenCalled()

    for (const [index, hold] of holds.entries()) {
      hold.resolve()
      await expect(runs[index]).resolves.toEqual({ ok: true, value: index })
      await flush()
    }
    expect(started).toEqual([0, 1, 2, 3])
    expect(peak).toBe(1)
    expect(gate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('hands the slot on when a task fails, and the failure reaches only its own caller', async () => {
    const gate = createOfficeExtractionGate()
    const failing = gate.run(async () => {
      throw new Error('parse failed')
    }, { deadline: inAMinute() })
    const next = gate.run(async () => 'next', { deadline: inAMinute() })
    await expect(failing).rejects.toThrow('parse failed')
    await expect(next).resolves.toEqual({ ok: true, value: 'next' })
    expect(gate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('gives up at the deadline while waiting, so queuing spends the reading budget instead of adding to it', async () => {
    vi.useFakeTimers()
    const gate = createOfficeExtractionGate()
    const hold = deferred()
    const first = gate.run(() => hold.promise, { deadline: Date.now() + 60_000 })
    const parse = vi.fn(async () => 'parsed')
    const waiting = gate.run(parse, { deadline: Date.now() + 500 })
    expect(gate.stats()).toEqual({ active: 1, queued: 1 })

    await vi.advanceTimersByTimeAsync(499)
    expect(gate.stats().queued).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(waiting).resolves.toEqual({ ok: false, code: 'busy' })
    expect(gate.stats()).toEqual({ active: 1, queued: 0 })

    hold.resolve()
    await expect(first).resolves.toEqual({ ok: true, value: undefined })
    expect(parse).not.toHaveBeenCalled()
    expect(gate.stats()).toEqual({ active: 0, queued: 0 })
  })

  it('answers busy at once when the slot is taken and the deadline has already passed', async () => {
    const gate = createOfficeExtractionGate()
    const hold = deferred()
    const first = gate.run(() => hold.promise, { deadline: inAMinute() })
    const parse = vi.fn(async () => 'parsed')
    await expect(gate.run(parse, { deadline: Date.now() - 1 })).resolves.toEqual({ ok: false, code: 'busy' })
    expect(gate.stats()).toEqual({ active: 1, queued: 0 })
    hold.resolve()
    await first
    expect(parse).not.toHaveBeenCalled()
  })
})
