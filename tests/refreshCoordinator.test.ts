import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCoordinator, type TokenData } from '../server/utils/refreshCoordinator'

const fakeTokenData: TokenData = {
  access_token: 'new-at',
  refresh_token: 'new-rt',
  expires: 900_000,
}

describe('RefreshCoordinator', () => {
  // ── ensure intent ──────────────────────────────────────────────────────────

  describe('ensure intent', () => {
    it('valid AT returns ok without consuming RT', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn()
      const verifyAt = vi.fn().mockResolvedValue('valid')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'ensure' },
        { verifyAt, callRefresh },
      )

      expect(verifyAt).toHaveBeenCalledWith('at-1')
      expect(callRefresh).not.toHaveBeenCalled()
      expect(r).toEqual({ action: 'ok' })
    })

    it('Directus 5xx on AT check returns 503, does not touch RT', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn()
      const verifyAt = vi.fn().mockResolvedValue('unavailable')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'ensure' },
        { verifyAt, callRefresh },
      )

      expect(callRefresh).not.toHaveBeenCalled()
      expect(r.action).toBe('503')
    })

    it('AT invalid + RT refresh 401 → 401 clear both', async () => {
      const c = createCoordinator()
      const authErr = Object.assign(new Error(), { statusCode: 401 })
      const callRefresh = vi.fn().mockRejectedValue(authErr)
      const verifyAt = vi.fn().mockResolvedValue('invalid')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'ensure' },
        { verifyAt, callRefresh },
      )

      expect(r.action).toBe('401')
      if (r.action === '401') {
        expect(r.clearAt).toBe(true)
        expect(r.clearRt).toBe(true)
      }
    })

    it('AT invalid + RT refresh 5xx → 503, cookies preserved', async () => {
      const c = createCoordinator()
      const serverErr = Object.assign(new Error(), { statusCode: 503 })
      const callRefresh = vi.fn().mockRejectedValue(serverErr)
      const verifyAt = vi.fn().mockResolvedValue('invalid')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'ensure' },
        { verifyAt, callRefresh },
      )

      expect(r.action).toBe('503')
    })
  })

  // ── scheduled-renew intent ─────────────────────────────────────────────────

  describe('scheduled-renew intent', () => {
    it('skips AT pre-check and proactively refreshes RT', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn().mockResolvedValue(fakeTokenData)
      const verifyAt = vi.fn()

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'scheduled-renew' },
        { verifyAt, callRefresh },
      )

      expect(verifyAt).not.toHaveBeenCalled()
      expect(callRefresh).toHaveBeenCalledOnce()
      expect(r.action).toBe('ok')
      if (r.action === 'ok') expect(r.tokens).toEqual(fakeTokenData)
    })

    it('no RT + valid AT → 503, session intact', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn()
      const verifyAt = vi.fn().mockResolvedValue('valid')

      const r = await c.refresh(
        { at: 'at-1', rt: undefined, intent: 'scheduled-renew' },
        { verifyAt, callRefresh },
      )

      expect(verifyAt).toHaveBeenCalledWith('at-1')
      expect(callRefresh).not.toHaveBeenCalled()
      expect(r.action).toBe('503')
    })

    it('no RT + invalid AT → 401, clear AT only', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn()
      const verifyAt = vi.fn().mockResolvedValue('invalid')

      const r = await c.refresh(
        { at: 'at-1', rt: undefined, intent: 'scheduled-renew' },
        { verifyAt, callRefresh },
      )

      expect(r.action).toBe('401')
      if (r.action === '401') {
        expect(r.clearAt).toBe(true)
        expect(r.clearRt).toBe(false)
      }
    })

    it('no RT + Directus unavailable → 503', async () => {
      const c = createCoordinator()
      const verifyAt = vi.fn().mockResolvedValue('unavailable')

      const r = await c.refresh(
        { at: 'at-1', rt: undefined, intent: 'scheduled-renew' },
        { verifyAt, callRefresh: vi.fn() },
      )

      expect(r.action).toBe('503')
    })

    it('RT refresh 401 but AT still valid → 503, session intact', async () => {
      const c = createCoordinator()
      const authErr = Object.assign(new Error(), { statusCode: 401 })
      const callRefresh = vi.fn().mockRejectedValue(authErr)
      const verifyAt = vi.fn().mockResolvedValue('valid')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'scheduled-renew' },
        { verifyAt, callRefresh },
      )

      expect(verifyAt).toHaveBeenCalledWith('at-1')
      expect(r.action).toBe('503')
    })

    it('RT refresh 401 + AT also invalid → 401, clear both', async () => {
      const c = createCoordinator()
      const authErr = Object.assign(new Error(), { statusCode: 401 })
      const callRefresh = vi.fn().mockRejectedValue(authErr)
      const verifyAt = vi.fn().mockResolvedValue('invalid')

      const r = await c.refresh(
        { at: 'at-1', rt: 'rt-1', intent: 'scheduled-renew' },
        { verifyAt, callRefresh },
      )

      expect(r.action).toBe('401')
      if (r.action === '401') {
        expect(r.clearAt).toBe(true)
        expect(r.clearRt).toBe(true)
      }
    })
  })

  // ── concurrency and grace window ───────────────────────────────────────────

  describe('concurrency and grace window', () => {
    it('two concurrent scheduled-renew with same RT trigger only one Directus call', async () => {
      const c = createCoordinator()
      const callRefresh = vi.fn().mockResolvedValue(fakeTokenData)

      const [r1, r2] = await Promise.all([
        c.refresh({ rt: 'rt-1', intent: 'scheduled-renew' }, { verifyAt: vi.fn(), callRefresh }),
        c.refresh({ rt: 'rt-1', intent: 'scheduled-renew' }, { verifyAt: vi.fn(), callRefresh }),
      ])

      expect(callRefresh).toHaveBeenCalledTimes(1)
      expect(r1.action).toBe('ok')
      expect(r2.action).toBe('ok')
    })

    describe('with fake timers', () => {
      beforeEach(() => { vi.useFakeTimers() })
      afterEach(() => { vi.useRealTimers() })

      it('within grace window: old RT reuses result without new Directus call', async () => {
        const c = createCoordinator()
        const callRefresh = vi.fn().mockResolvedValue(fakeTokenData)
        const deps = { verifyAt: vi.fn(), callRefresh }

        // First call — grace stored
        const r1 = await c.refresh({ rt: 'rt-1', intent: 'scheduled-renew' }, deps)
        expect(callRefresh).toHaveBeenCalledTimes(1)
        expect(r1.action).toBe('ok')

        // 4 seconds later — within 5s grace
        vi.advanceTimersByTime(4_000)

        const r2 = await c.refresh({ rt: 'rt-1', intent: 'scheduled-renew' }, deps)
        expect(callRefresh).toHaveBeenCalledTimes(1)
        expect(r2.action).toBe('ok')
        if (r2.action === 'ok') expect(r2.tokens).toEqual(fakeTokenData)
      })

      it('after grace window expires: coordinator accepts a fresh RT call', async () => {
        const c = createCoordinator()
        const callRefresh = vi.fn().mockResolvedValue(fakeTokenData)
        const deps = { verifyAt: vi.fn(), callRefresh }

        // First call — grace stored for rt-1
        await c.refresh({ rt: 'rt-1', intent: 'scheduled-renew' }, deps)
        expect(callRefresh).toHaveBeenCalledTimes(1)

        // Advance past grace window (clears the cache entry via setTimeout)
        await vi.advanceTimersByTimeAsync(5_001)

        // Next call with a new RT (simulating next rotation cycle)
        await c.refresh({ rt: 'rt-2', intent: 'scheduled-renew' }, deps)
        expect(callRefresh).toHaveBeenCalledTimes(2)
      })

      it('late-arriving request with already-rotated RT returns 503, no cookie clear', async () => {
        const c = createCoordinator({ graceTtl: 5_000, rotatedTtl: 60_000 })

        // B: successfully rotates rt-old → grace + rotated records stored
        const callRefresh = vi.fn().mockResolvedValue(fakeTokenData)
        await c.refresh({ rt: 'rt-old', intent: 'scheduled-renew' }, { verifyAt: vi.fn(), callRefresh })
        expect(callRefresh).toHaveBeenCalledTimes(1)

        // Advance past grace window (5001ms); rotated record still valid (60s TTL)
        await vi.advanceTimersByTimeAsync(5_001)

        // A: arrives late with same old RT; Directus returns 401 (RT already consumed by B)
        const lateCallRefresh = vi.fn().mockRejectedValue(Object.assign(new Error(), { statusCode: 401 }))
        const verifyAt = vi.fn()

        const r = await c.refresh(
          { at: 'at-1', rt: 'rt-old', intent: 'scheduled-renew' },
          { verifyAt, callRefresh: lateCallRefresh },
        )

        // Must be 503, not 401; verifyAt must not be called; no clear decision
        expect(r.action).toBe('503')
        expect(verifyAt).not.toHaveBeenCalled()
      })
    })
  })
})
