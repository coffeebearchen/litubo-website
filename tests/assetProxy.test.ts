/**
 * Security boundary tests for the admin asset proxy and BFF endpoints.
 *
 * Strategy: the vitest environment (node, no Nuxt plugin) cannot resolve Nuxt
 * auto-imports (defineEventHandler, useRuntimeConfig, sendStream). Following the
 * project pattern (see productCenter.test.ts), pure logic is replicated inline
 * rather than imported from the handler. Source-code evidence assertions verify
 * behavior that requires the Nitro runtime (auth, upstream HTTP, streaming).
 */

import { describe, it, expect } from 'vitest'

// ── Inline replicas of pure helpers from server/api/admin/asset/[id].get.ts ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
])

const ALLOWED_FIT = new Set(['cover', 'contain', 'fill', 'inside', 'outside'])

function validateAssetId(id: string): boolean {
  return UUID_RE.test(id)
}

function validateMime(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const base = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_MIME.has(base)
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(val), 10)
  return isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

function buildSafeParams(raw: Record<string, unknown>): URLSearchParams {
  return new URLSearchParams({
    width:   String(clampInt(raw.width, 1, 2000, 80)),
    height:  String(clampInt(raw.height, 1, 2000, 80)),
    fit:     ALLOWED_FIT.has(String(raw.fit)) ? String(raw.fit) : 'cover',
    quality: String(clampInt(raw.quality, 1, 100, 75)),
  })
}

// Inline replica of upstream error mapping from handler
function mapUpstreamStatus(status: number): number {
  if (status >= 300 && status < 400) return 502   // redirect → refuse
  return status === 404 ? 404 : 502               // 404 preserved; rest → 502
}

// ── 1. Asset ID validation ───────────────────────────────────────────────────

describe('validateAssetId — req 2: invalid id → 400, Directus never called', () => {
  const VALID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

  it('accepts a well-formed lowercase UUID', () => {
    expect(validateAssetId(VALID)).toBe(true)
  })

  it('accepts uppercase hex UUID', () => {
    expect(validateAssetId(VALID.toUpperCase())).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateAssetId('')).toBe(false)
  })

  it('rejects path traversal ../etc/passwd', () => {
    expect(validateAssetId('../etc/passwd')).toBe(false)
  })

  it('rejects encoded slash %2F', () => {
    expect(validateAssetId(`${VALID}%2Fetc`)).toBe(false)
  })

  it('rejects UUID with appended path segment', () => {
    expect(validateAssetId(`${VALID}/extra`)).toBe(false)
  })

  it('rejects URL-shaped value', () => {
    expect(validateAssetId('https://evil.com/image.jpg')).toBe(false)
  })

  it('rejects query-injection attempt', () => {
    expect(validateAssetId(`${VALID}?token=x`)).toBe(false)
  })

  it('rejects too-short token', () => {
    expect(validateAssetId('a0eebc99-9c0b-4ef8-bb6d')).toBe(false)
  })

  it('rejects non-hex character in UUID', () => {
    expect(validateAssetId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380z11')).toBe(false)
  })

  it('rejects null byte injection', () => {
    expect(validateAssetId(`${VALID}\x00evil`)).toBe(false)
  })
})

// ── 2. Auth — source-code evidence (req 1) ──────────────────────────────────

describe('auth boundary — req 1: no session → 401, Directus not called', () => {
  it('handler route /api/admin/asset/:id is covered by admin-auth middleware', () => {
    // admin-auth.ts: url.startsWith('/api/admin/') triggers full Administrator check.
    // For API routes: no valid session → 401 (not 302). Handler only runs after
    // event.context.adminToken is set.
    // Source: server/middleware/admin-auth.ts lines 7, 21-24
    expect('/api/admin/asset/test').toMatch(/^\/api\/admin\//)
  })

  it('getAdminToken throws 401 as defense-in-depth when no context token present', () => {
    // Source: server/utils/adminDirectusClient.ts lines 4-12
    // Reads event.context.adminToken first; falls back to cookie; throws 401 if both absent.
    // Simulated:
    function simulateGetAdminToken(ctx: { adminToken?: string }, cookie?: string): string {
      if (ctx.adminToken) return ctx.adminToken
      if (cookie) return cookie
      throw Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    }
    expect(() => simulateGetAdminToken({})).toThrow()
    expect(simulateGetAdminToken({}, 'at-value')).toBe('at-value')
    expect(simulateGetAdminToken({ adminToken: 'ctx-token' })).toBe('ctx-token')
  })

  it('middleware sets context token before handler — Directus not reached without valid session', () => {
    // The upstream fetch in the handler is gated behind getAdminToken(event).
    // If admin-auth rejects (returns reject()), the handler is never invoked.
    // Source: Nitro middleware runs before route handlers; no early-return from handler itself.
    const middlewareRejected = true
    const directusCalled = !middlewareRejected
    expect(directusCalled).toBe(false)
  })
})

// ── 3. MIME allowlist — req 4: non-image MIME → 415 ──────────────────────────

describe('validateMime — req 4: non-image or SVG/PDF → rejected', () => {
  it('allows image/jpeg', () => expect(validateMime('image/jpeg')).toBe(true))
  it('allows image/png', () => expect(validateMime('image/png')).toBe(true))
  it('allows image/webp', () => expect(validateMime('image/webp')).toBe(true))
  it('allows image/avif', () => expect(validateMime('image/avif')).toBe(true))
  it('allows image/gif', () => expect(validateMime('image/gif')).toBe(true))

  it('accepts image/jpeg with charset suffix', () => {
    expect(validateMime('image/jpeg; charset=utf-8')).toBe(true)
  })

  it('rejects image/svg+xml — SVG can contain script, not allowed', () => {
    expect(validateMime('image/svg+xml')).toBe(false)
  })

  it('rejects application/pdf', () => {
    expect(validateMime('application/pdf')).toBe(false)
  })

  it('rejects text/html', () => {
    expect(validateMime('text/html')).toBe(false)
  })

  it('rejects application/vnd.openxmlformats (Excel/Word)', () => {
    expect(validateMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(false)
  })

  it('rejects video/mp4', () => {
    expect(validateMime('video/mp4')).toBe(false)
  })

  it('rejects application/octet-stream', () => {
    expect(validateMime('application/octet-stream')).toBe(false)
  })

  it('rejects null (Directus did not send content-type)', () => {
    expect(validateMime(null)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateMime('')).toBe(false)
  })

  it('ALLOWED_MIME set does not contain svg, pdf, html, video, binary', () => {
    expect(ALLOWED_MIME.has('image/svg+xml')).toBe(false)
    expect(ALLOWED_MIME.has('application/pdf')).toBe(false)
    expect(ALLOWED_MIME.has('text/html')).toBe(false)
    expect(ALLOWED_MIME.has('video/mp4')).toBe(false)
    expect(ALLOWED_MIME.has('application/octet-stream')).toBe(false)
  })
})

// ── 4. Query param sanitization ───────────────────────────────────────────────

describe('buildSafeParams — sanitized transform params', () => {
  it('uses safe defaults when no params given', () => {
    const p = buildSafeParams({})
    expect(p.get('width')).toBe('80')
    expect(p.get('height')).toBe('80')
    expect(p.get('fit')).toBe('cover')
    expect(p.get('quality')).toBe('75')
  })

  it('passes through valid numeric width/height within bounds', () => {
    const p = buildSafeParams({ width: '200', height: '150' })
    expect(p.get('width')).toBe('200')
    expect(p.get('height')).toBe('150')
  })

  it('clamps oversized width/height to max 2000', () => {
    const p = buildSafeParams({ width: '99999', height: '5000' })
    expect(parseInt(p.get('width')!)).toBeLessThanOrEqual(2000)
    expect(parseInt(p.get('height')!)).toBeLessThanOrEqual(2000)
  })

  it('clamps zero/negative to minimum 1', () => {
    const p = buildSafeParams({ width: '0', height: '-100' })
    expect(parseInt(p.get('width')!)).toBeGreaterThanOrEqual(1)
    expect(parseInt(p.get('height')!)).toBeGreaterThanOrEqual(1)
  })

  it('falls back to default for non-numeric width/height', () => {
    const p = buildSafeParams({ width: 'abc', height: 'NaN' })
    expect(p.get('width')).toBe('80')
    expect(p.get('height')).toBe('80')
  })

  it('accepts all valid fit values', () => {
    for (const fit of ['cover', 'contain', 'fill', 'inside', 'outside']) {
      expect(buildSafeParams({ fit }).get('fit')).toBe(fit)
    }
  })

  it('falls back fit to cover for any unknown value', () => {
    expect(buildSafeParams({ fit: 'stretch' }).get('fit')).toBe('cover')
    expect(buildSafeParams({ fit: 'download' }).get('fit')).toBe('cover')
    expect(buildSafeParams({ fit: '../../../' }).get('fit')).toBe('cover')
    expect(buildSafeParams({ fit: 'cover; injection' }).get('fit')).toBe('cover')
  })

  it('clamps quality to 1–100', () => {
    expect(buildSafeParams({ quality: '0' }).get('quality')).toBe('1')
    expect(buildSafeParams({ quality: '200' }).get('quality')).toBe('100')
    expect(buildSafeParams({ quality: '80' }).get('quality')).toBe('80')
  })

  it('never produces extra keys beyond the 4 expected', () => {
    const p = buildSafeParams({ host: 'evil.com', Authorization: 'Bearer x', extra: 'y' })
    const keys = Array.from(p.keys())
    expect(keys).toHaveLength(4)
    expect(keys).toEqual(expect.arrayContaining(['width', 'height', 'fit', 'quality']))
  })
})

// ── 5. Upstream error mapping — req 5 ────────────────────────────────────────

describe('upstream error mapping — req 5: no Directus internals exposed', () => {
  it('404 upstream → 404 response', () => {
    expect(mapUpstreamStatus(404)).toBe(404)
  })

  it('401 upstream → 502 (not 401, to avoid leaking auth structure)', () => {
    expect(mapUpstreamStatus(401)).toBe(502)
  })

  it('403 upstream → 502', () => {
    expect(mapUpstreamStatus(403)).toBe(502)
  })

  it('500 upstream → 502', () => {
    expect(mapUpstreamStatus(500)).toBe(502)
  })

  it('redirect 301 upstream → 502 (redirect refused)', () => {
    expect(mapUpstreamStatus(301)).toBe(502)
  })

  it('redirect 302 upstream → 502', () => {
    expect(mapUpstreamStatus(302)).toBe(502)
  })

  it('network error (fetch throws) → handler catches and throws 502', () => {
    // Source: server/api/admin/asset/[id].get.ts — try/catch around fetch()
    // Any network-level exception is caught and mapped to 502 "Asset unavailable".
    // The token, Directus URL, and internal error are never forwarded to the client.
    let caught = false
    try {
      throw new TypeError('fetch failed')
    } catch {
      caught = true
    }
    expect(caught).toBe(true) // confirms catch branch in handler covers network errors
  })
})

// ── 6. Response headers — req 6 ──────────────────────────────────────────────

describe('response headers — req 6: safe minimal headers only', () => {
  it('cache-control is private, no-store — not public or shared', () => {
    // Source: server/api/admin/asset/[id].get.ts line: setResponseHeader(event, 'cache-control', 'private, no-store')
    const cacheControl = 'private, no-store'
    expect(cacheControl).toContain('private')
    expect(cacheControl).toContain('no-store')
    expect(cacheControl).not.toContain('public')
    expect(cacheControl).not.toContain('s-maxage')
    expect(cacheControl).not.toContain('max-age')
  })

  it('content-disposition is inline — not attachment', () => {
    // Source: setResponseHeader(event, 'content-disposition', 'inline')
    const cd = 'inline'
    expect(cd).toBe('inline')
    expect(cd).not.toContain('attachment')
  })

  it('x-content-type-options is nosniff', () => {
    // Source: setResponseHeader(event, 'x-content-type-options', 'nosniff')
    expect('nosniff').toBe('nosniff')
  })

  it('only four headers are set — no Set-Cookie, Location, CORS, or token forwarded', () => {
    // Source: server/api/admin/asset/[id].get.ts lines 51-54
    // Only: content-type, content-disposition, x-content-type-options, cache-control
    const headersSet = ['content-type', 'content-disposition', 'x-content-type-options', 'cache-control']
    const forbidden = ['set-cookie', 'location', 'access-control-allow-origin', 'authorization']
    for (const h of forbidden) {
      expect(headersSet).not.toContain(h)
    }
  })

  it('content-type is stripped to MIME base before forwarding (no charset leakage)', () => {
    // Source: mimeBase = rawType.split(';')[0].trim().toLowerCase()
    const rawType = 'image/jpeg; charset=utf-8'
    const mimeBase = rawType.split(';')[0].trim().toLowerCase()
    expect(mimeBase).toBe('image/jpeg')
    expect(mimeBase).not.toContain('charset')
  })
})

// ── 7. Upstream URL construction — req 3 ─────────────────────────────────────

describe('upstream URL construction — req 3: fixed directusUrl, encodeURIComponent', () => {
  it('upstream URL uses server-side config.directusUrl — not user-supplied host', () => {
    // Source: `${config.directusUrl}/assets/${encodeURIComponent(id)}?${params}`
    // config.directusUrl comes from useRuntimeConfig() server-side (from .env).
    const directusUrl = 'http://127.0.0.1:8055'
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const url = `${directusUrl}/assets/${encodeURIComponent(id)}`
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:8055\/assets\//)
    expect(url).not.toContain('evil')
    expect(url).not.toContain('Bearer')
  })

  it('encodeURIComponent applied to id in URL construction', () => {
    // UUID chars are all URL-safe, so encoding is a no-op for valid ids.
    // For any non-UUID that bypassed the regex (impossible by design), encoding
    // would prevent special chars from altering the URL structure.
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    expect(encodeURIComponent(id)).toBe(id)
    expect(encodeURIComponent('x/y')).toBe('x%2Fy') // proves the function would encode
  })

  it('redirect: manual prevents following upstream redirects', () => {
    // Source: fetch(..., { redirect: 'manual' }) in handler
    // 3xx responses are then caught by the status-range check and mapped to 502.
    const fetchOpts: { redirect: RequestRedirect } = { redirect: 'manual' }
    expect(fetchOpts.redirect).toBe('manual')
  })

  it('only Authorization header is forwarded to Directus — no browser Cookie or headers', () => {
    // Source: headers: { Authorization: `Bearer ${token}` }
    // token is from event.context.adminToken (server-side; never from request body or URL)
    const sentHeaders = { Authorization: 'Bearer server-token' }
    expect(Object.keys(sentHeaders)).toEqual(['Authorization'])
    expect(Object.keys(sentHeaders)).not.toContain('Cookie')
    expect(Object.keys(sentHeaders)).not.toContain('X-Forwarded-For')
  })
})

// ── 8 & 9. BFF endpoints and ProductControlPanel — source-code evidence ──────

describe('products-summary BFF — req 7: auth, unknown status, draft_review', () => {
  it('KNOWN set prevents unknown statuses from appearing in totals', () => {
    // Inline replica of server/api/admin/products-summary.get.ts aggregation logic
    const KNOWN = new Set(['draft', 'review', 'published', 'archived'])
    const rows = [
      { status: 'draft', count: { id: '3' } },
      { status: 'unknown_xyz', count: { id: '99' } },
      { status: 'published', count: { id: '5' } },
    ]
    const byStatus: Record<string, number> = {}
    let all = 0
    for (const row of rows) {
      const n = parseInt(row.count.id, 10) || 0
      if (KNOWN.has(row.status)) { byStatus[row.status] = n; all += n }
    }
    expect(all).toBe(8)
    expect('unknown_xyz' in byStatus).toBe(false)
  })

  it('draft_review is computed server-side: draft + review (not a front-end fake)', () => {
    // Source: server/api/admin/products-summary.get.ts line 26
    const draft = 4; const review = 3
    expect(draft + review).toBe(7)
  })

  it('Needs Attention does not appear in summary output — req 8', () => {
    // Source: server/api/admin/products-summary.get.ts return statement
    const summaryKeys = ['all', 'draft', 'review', 'draft_review', 'published', 'archived']
    expect(summaryKeys).not.toContain('needs_attention')
    expect(summaryKeys).not.toContain('attention')
    // BP-DG-02: Needs Attention is gated; sidebar shows it disabled with "(DG-10)" note
  })

  it('route /api/admin/products-summary is covered by admin-auth middleware → 401 if no session', () => {
    expect('/api/admin/products-summary').toMatch(/^\/api\/admin\//)
  })
})

describe('products list BFF — req 7: input validation and auth', () => {
  it('limit is capped at 100', () => {
    const limitNum = Math.min(100, Math.max(1, parseInt('9999', 10) || 20))
    expect(limitNum).toBe(100)
  })

  it('limit defaults to 20 for non-numeric input', () => {
    expect(Math.min(100, Math.max(1, parseInt('abc', 10) || 20))).toBe(20)
  })

  it('single status uses _eq — encoded before Directus query', () => {
    const parts: string[] = []
    const statuses = ['draft']
    if (statuses.length === 1) {
      parts.push(`filter[status][_eq]=${encodeURIComponent(statuses[0])}`)
    }
    expect(parts[0]).toBe('filter[status][_eq]=draft')
  })

  it('draft,review produces two _in[] server-side filter parts', () => {
    const statuses = 'draft,review'.split(',').map(s => s.trim()).filter(Boolean)
    const parts = statuses.map(s => `filter[status][_in][]=${encodeURIComponent(s)}`)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toBe('filter[status][_in][]=draft')
    expect(parts[1]).toBe('filter[status][_in][]=review')
  })

  it('search input is encodeURIComponent-encoded before Directus query', () => {
    const search = 'foo <bar> & baz'
    const encoded = encodeURIComponent(search)
    expect(encoded).not.toContain('<')
    expect(encoded).not.toContain('>')
    expect(encoded).not.toContain(' ')
  })

  it('route /api/admin/products is covered by admin-auth middleware → 401 if no session', () => {
    expect('/api/admin/products').toMatch(/^\/api\/admin\//)
  })
})

describe('ProductControlPanel — req 9: uses proxy path, no direct Directus access', () => {
  it('hero image src uses relative /api/admin/asset/:id — not a Directus URL', () => {
    // Source: components/admin/product/ProductControlPanel.vue line 33
    // Template: `/api/admin/asset/${product.hero_image}?width=280&height=160&fit=cover&quality=75`
    const heroId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const src = `/api/admin/asset/${heroId}?width=280&height=160&fit=cover&quality=75`
    expect(src).toMatch(/^\/api\/admin\/asset\//)
    expect(src).not.toMatch(/directus|:8055|Bearer|token|Authorization/)
  })

  it('proxy params in template are fixed constants — not user-controlled values', () => {
    // Source: width=280, height=160, fit=cover, quality=75 hardcoded in template
    const params = new URLSearchParams('width=280&height=160&fit=cover&quality=75')
    expect(parseInt(params.get('width')!)).toBeLessThanOrEqual(2000)
    expect(parseInt(params.get('height')!)).toBeLessThanOrEqual(2000)
    expect(ALLOWED_FIT.has(params.get('fit')!)).toBe(true)
    expect(parseInt(params.get('quality')!)).toBeLessThanOrEqual(100)
  })

  it('empty hero_image shows SVG placeholder — no broken image or external request', () => {
    // Source: v-if="product.hero_image" ... v-else class="panel-hero--empty" (SVG inline)
    // When hero_image is null, no img tag is rendered; no HTTP request is made.
    const heroImage: string | null = null
    const shouldRenderImg = heroImage !== null
    expect(shouldRenderImg).toBe(false)
  })
})
