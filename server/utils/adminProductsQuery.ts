/**
 * Pure query-sanitization helpers for the admin products BFF endpoints.
 *
 * No Nuxt auto-imports — this file is importable by both the Nitro route
 * handlers and the Vitest test suite without any runtime adapter.  Tests
 * therefore exercise the SAME code that runs in production.
 */

export const KNOWN_STATUSES = new Set(['draft', 'review', 'published', 'archived'])

/**
 * Filter raw status input against known lifecycle values.
 * Unknown values are silently dropped — never forwarded to Directus.
 */
export function filterKnownStatuses(raw: unknown): string[] {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(s => KNOWN_STATUSES.has(s))
}

/** Parse page number; always returns ≥ 1 (default: 1 for non-numeric input). */
export function parsePageNum(raw: unknown): number {
  return Math.max(1, parseInt(String(raw), 10) || 1)
}

/** Parse and clamp limit to the range 1–100; default 20 for non-numeric input. */
export function parseLimitNum(raw: unknown): number {
  return Math.min(100, Math.max(1, parseInt(String(raw), 10) || 20))
}

// category_id is an integer primary-key FK in Directus product_categories.
const INTEGER_ID_RE = /^\d{1,10}$/

/** Validate category_id as a positive-integer FK; returns null if invalid or absent. */
export function validateCategoryId(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  return INTEGER_ID_RE.test(s) ? s : null
}

const MAX_SEARCH_LEN = 200

/** Sanitize search string — enforces length limit; returns null if blank. */
export function sanitizeSearch(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).slice(0, MAX_SEARCH_LEN).trim()
  return s || null
}

/** Build Directus filter query-string parts from already-validated inputs. */
export function buildProductsFilterParts(
  statuses: string[],
  categoryId: string | null,
  search: string | null,
): string[] {
  const parts: string[] = []
  if (statuses.length === 1) {
    parts.push(`filter[status][_eq]=${encodeURIComponent(statuses[0])}`)
  } else if (statuses.length > 1) {
    statuses.forEach(s => parts.push(`filter[status][_in][]=${encodeURIComponent(s)}`))
  }
  if (categoryId) parts.push(`filter[category_id][_eq]=${encodeURIComponent(categoryId)}`)
  if (search) parts.push(`search=${encodeURIComponent(search)}`)
  return parts
}
