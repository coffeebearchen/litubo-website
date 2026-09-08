import { z } from 'zod'

/**
 * PWS-AI-ENGINE-01 — request shape for "Apply accepted changes to Draft".
 * This is the only place the AI-assisted flow is allowed to reach the
 * canonical Specifications write model: an `add` creates a new
 * `product_spec_items` row (and its `product_spec_groups` parent if the
 * named group does not already exist on this product); an `update` only
 * ever changes `value_en`/`note_en` on an existing item this product
 * already owns. No other field, table, or write shape is reachable through
 * this schema — the AI model itself never touches Directus directly.
 */

export const ApplyChangeSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    group: z.string().trim().min(1).max(200),
    parameter: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('update'),
    specItemId: z.number().int().positive(),
    value: z.string().trim().min(1).max(500),
    note: z.string().trim().max(500).optional(),
  }),
])

export const ApplyRequestSchema = z.object({
  changes: z.array(ApplyChangeSchema).min(1).max(100),
})

export type ApplyChange = z.infer<typeof ApplyChangeSchema>
export type ApplyRequest = z.infer<typeof ApplyRequestSchema>

/** Case/whitespace-insensitive match, used both to detect "Review required" duplicates and to reuse an existing group by name rather than creating a near-duplicate. */
export function normalizeSpecName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}
