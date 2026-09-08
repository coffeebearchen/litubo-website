import { z } from 'zod'

/**
 * PWS-AI-ENGINE-01R — request shape for "Apply accepted changes to Draft".
 * An `add` would create a new `product_spec_items` row (and its
 * `product_spec_groups` parent if the named group does not already exist on
 * this product); an `update` would only ever change `value_en`/`note_en` on
 * an existing item this product already owns. `.strict()` on both branches
 * means any extra key — including one branch's fields sent alongside the
 * other's — fails validation outright rather than being silently ignored.
 * These schemas are kept as the agreed contract for a future real
 * transactional writer; they are validated but never executed while Apply
 * is disabled — see the PWS-AI-ENGINE-01R2 note below.
 */

export const ApplyChangeSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    group: z.string().trim().min(1).max(200),
    parameter: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({
    action: z.literal('update'),
    specItemId: z.number().int().positive(),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }).strict(),
])

export const ApplyRequestSchema = z.object({
  changes: z.array(ApplyChangeSchema).min(1).max(100),
}).strict()

export type ApplyChange = z.infer<typeof ApplyChangeSchema>
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>

export type ApplyOutcome =
  | { ok: true, appliedCount: number }
  | { ok: false, error: string }

/**
 * PWS-AI-ENGINE-01R2 — `applyAcceptedSpecificationChanges()` has been
 * removed. It performed multiple independent Directus REST writes with
 * best-effort compensation on failure (delete/revert calls each wrapped in
 * a silently-swallowing try/catch): a compensation call could itself fail
 * and be swallowed, a process interruption between writes could leave a
 * partial batch committed, and no concurrency check existed for two Apply
 * calls racing on the same product. That is not an atomic transaction, and
 * per this task's instructions it must not be kept, wrapped, or renamed —
 * it must be gone. The Nitro `apply.post.ts` endpoint below no longer calls
 * anything in this file's write path and unconditionally refuses to write.
 *
 * A real fix requires a single Directus-side transactional command (running
 * inside one database transaction: Draft check, row lock, full
 * pre-validation, writes, activity/revision, commit-or-rollback) that Nuxt
 * calls as one HTTP request. Building that requires a Directus custom
 * extension, which requires mounting `/directus/extensions` in
 * `docker-compose.yml` — the same compose file this repository's own
 * comments mark as shared verbatim between local dev and the production
 * server. Adding that mount is a production Docker infrastructure change,
 * which CLAUDE.md prohibits without explicit per-action authorization. That
 * authorization has not been requested or given in this task, so Apply
 * stays disabled instead of falling back to the saga.
 */
