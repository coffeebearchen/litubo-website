/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — cost control in front of the one endpoint
 * that can call a paid AI provider.
 *
 * Generate is the only place this application spends money. Nothing previously
 * stopped an administrator (or a stuck retry loop, or a double-clicked button)
 * from starting several analyses of the same product at once, each one a
 * separate provider call. Two limits close that:
 *
 *  - **Single flight.** One generation at a time per administrator per
 *    product. A second request while one is running is refused rather than
 *    queued, because queueing would still pay for both.
 *  - **Cooldown.** After a generation finishes, that administrator waits
 *    `COOLDOWN_MS` before starting another for the same product. This bounds
 *    an accidental loop to one call per cooldown window instead of as many as
 *    the network allows.
 *
 * Honest scope: this is **single-instance** protection. The state lives in this
 * process's memory, so two app instances behind a load balancer would each
 * allow one in-flight generation. That is a real limitation, not an oversight —
 * a multi-instance deployment needs a shared store (Redis or a Directus-side
 * counter), which is deliberately not introduced here: it would mean new
 * infrastructure this task is not authorised to add. The single-instance guard
 * is still worth having, since a runaway loop from one browser is by far the
 * likeliest way to spend money unintentionally.
 *
 * No Directus table, no product data, and no cross-request identity beyond the
 * administrator id already established by the auth middleware.
 */

/** One generation at a time per administrator per product. */
export const COOLDOWN_MS = 10_000

/** A slot older than this is treated as abandoned, so a crashed request cannot wedge a product forever. */
export const MAX_INFLIGHT_MS = 120_000

interface GenerateSlot {
  /** When the in-flight generation started, or null when nothing is running. */
  startedAt: number | null
  /** When the last generation finished; the cooldown is measured from here. */
  finishedAt: number
}

const slots = new Map<string, GenerateSlot>()

function key(adminUserId: string, productId: number): string {
  return `${adminUserId}:${productId}`
}

export type GenerateSlotDecision =
  | { allowed: true }
  | { allowed: false, reason: 'in-flight' | 'cooldown', retryAfterSeconds: number }

/**
 * Tries to claim the generation slot for this administrator and product.
 * `releaseGenerateSlot()` must be called in a `finally` when this returns
 * `{ allowed: true }`, or the slot stays claimed until `MAX_INFLIGHT_MS`.
 */
export function claimGenerateSlot(adminUserId: string, productId: number, now = Date.now()): GenerateSlotDecision {
  const slotKey = key(adminUserId, productId)
  const slot = slots.get(slotKey)

  if (slot?.startedAt !== null && slot?.startedAt !== undefined) {
    const runningFor = now - slot.startedAt
    if (runningFor < MAX_INFLIGHT_MS) {
      return {
        allowed: false,
        reason: 'in-flight',
        retryAfterSeconds: Math.max(1, Math.ceil((MAX_INFLIGHT_MS - runningFor) / 1000)),
      }
    }
    // Older than the ceiling: the request that claimed it is gone. Reclaim.
  }

  if (slot) {
    const sinceFinished = now - slot.finishedAt
    if (slot.finishedAt > 0 && sinceFinished < COOLDOWN_MS) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.max(1, Math.ceil((COOLDOWN_MS - sinceFinished) / 1000)),
      }
    }
  }

  slots.set(slotKey, { startedAt: now, finishedAt: slot?.finishedAt ?? 0 })
  return { allowed: true }
}

/** Releases the slot and starts this administrator's cooldown for this product. */
export function releaseGenerateSlot(adminUserId: string, productId: number, now = Date.now()): void {
  slots.set(key(adminUserId, productId), { startedAt: null, finishedAt: now })
}

/** Test-only: forget all slots, so one test's cooldown cannot affect the next. */
export function resetGenerateSlots(): void {
  slots.clear()
}
