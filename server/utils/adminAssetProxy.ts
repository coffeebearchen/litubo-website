/**
 * Pure validation and transformation helpers for the admin asset proxy.
 *
 * No Nuxt auto-imports — this file is importable by both the Nitro route
 * handler (server/api/admin/asset/[id].get.ts) and the Vitest test suite
 * (tests/assetProxy.test.ts) without any runtime adapter.  Tests therefore
 * exercise the SAME code that runs in production; there is no inline-copy gap.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Only safe raster image types — never SVG, PDF, HTML, video, or binary.
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

export const ALLOWED_FIT = new Set([
  'cover',
  'contain',
  'fill',
  'inside',
  'outside',
])

export function clampInt(
  val: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = parseInt(String(val), 10)
  return isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

export function validateAssetId(id: string): boolean {
  return UUID_RE.test(id)
}

export function validateMime(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const base = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_MIME.has(base)
}

export function buildSafeParams(raw: Record<string, unknown>): URLSearchParams {
  return new URLSearchParams({
    width:   String(clampInt(raw.width,   1, 2000, 80)),
    height:  String(clampInt(raw.height,  1, 2000, 80)),
    fit:     ALLOWED_FIT.has(String(raw.fit)) ? String(raw.fit) : 'cover',
    quality: String(clampInt(raw.quality, 1, 100,  75)),
  })
}

// Upstream HTTP status → safe proxy status.
// 3xx redirects are refused (502); 404 is preserved; everything else → 502.
export function mapUpstreamStatus(status: number): number {
  if (status >= 300 && status < 400) return 502
  return status === 404 ? 404 : 502
}
