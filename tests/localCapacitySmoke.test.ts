/**
 * FINAL-RELEASE-PRODUCTION-READY-03 — `scripts/local-capacity-smoke.mjs` safety contract.
 *
 * The tool may only ever send bounded GET requests, without cookies or credentials, to an allowlist
 * of public routes on a loopback server. Every refusal happens before a single request is made.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CapacityError,
  ENDPOINT_ALLOWLIST,
  LIMITS,
  assertLoopbackBaseUrl,
  boundedInteger,
  parseLevels,
  percentile,
  resolveEndpoints,
  runCapacitySmoke,
  summarize,
} from '../scripts/local-capacity-smoke.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function refusalCode(fn: () => unknown): string | null {
  try {
    fn()
    return null
  } catch (error) {
    return error instanceof CapacityError ? error.code : 'NOT_A_CAPACITY_ERROR'
  }
}

describe('target guard — loopback only', () => {
  it.each([
    ['http://127.0.0.1:3310', 'http://127.0.0.1:3310'],
    ['http://127.0.0.1:3310/', 'http://127.0.0.1:3310'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://[::1]:3000', 'http://[::1]:3000'],
  ])('accepts %s', (raw, origin) => {
    expect(assertLoopbackBaseUrl(raw)).toBe(origin)
  })

  it.each([
    ['https://example.com', 'TARGET_REFUSED'],
    ['http://litubo.com', 'TARGET_REFUSED'],
    ['http://10.0.0.5:3000', 'TARGET_REFUSED'],
    ['http://192.168.1.20:3000', 'TARGET_REFUSED'],
    ['http://0.0.0.0:3000', 'TARGET_REFUSED'],
    ['http://127.0.0.2:3000', 'TARGET_REFUSED'],
    ['http://localhost.evil.test:3000', 'TARGET_REFUSED'],
    ['http://127.0.0.1.nip.io:3000', 'TARGET_REFUSED'],
    ['http://user:secret@127.0.0.1:3000', 'TARGET_REFUSED'],
    ['ftp://127.0.0.1', 'TARGET_REFUSED'],
    ['file:///etc/passwd', 'TARGET_REFUSED'],
    ['http://127.0.0.1:3310/api', 'TARGET_INVALID'],
    ['http://127.0.0.1:3310/?q=1', 'TARGET_INVALID'],
    ['http://127.0.0.1:3310/#top', 'TARGET_INVALID'],
    ['not a url', 'TARGET_INVALID'],
    ['', 'TARGET_INVALID'],
  ])('refuses %s', (raw, code) => {
    expect(refusalCode(() => assertLoopbackBaseUrl(raw))).toBe(code)
  })
})

describe('endpoint allowlist and limits', () => {
  it('defaults to exactly the six public GET routes', () => {
    expect(resolveEndpoints(undefined)).toEqual(['/', '/products', '/api/cms/site-settings', '/api/cms/products/categories', '/api/cms/posts', '/sitemap.xml'])
    expect(ENDPOINT_ALLOWLIST).toHaveLength(6)
  })

  it('accepts a subset of the allowlist', () => {
    expect(resolveEndpoints('/,/sitemap.xml')).toEqual(['/', '/sitemap.xml'])
  })

  it.each([
    ['/admin', 'ENDPOINT_REFUSED'],
    ['/api/inquiries', 'ENDPOINT_REFUSED'],
    ['/api/admin/ai/providers', 'ENDPOINT_REFUSED'],
    ['http://127.0.0.1:3310/', 'ENDPOINT_REFUSED'],
    ['//evil.test/', 'ENDPOINT_REFUSED'],
    ['/products?page=2', 'ENDPOINT_REFUSED'],
    ['/,,/products', 'ENDPOINT_INVALID'],
    ['/,/', 'ENDPOINT_INVALID'],
  ])('refuses endpoint list %j', (raw, code) => {
    expect(refusalCode(() => resolveEndpoints(raw))).toBe(code)
  })

  it('bounds concurrency levels, request counts and timeouts', () => {
    expect(parseLevels('1,5,10,20')).toEqual([1, 5, 10, 20])
    expect(LIMITS.maxConcurrency).toBe(20)
    expect(refusalCode(() => parseLevels('0'))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => parseLevels('21'))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => parseLevels('1,x'))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => parseLevels('1,2,3,4,5,6,7'))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => boundedInteger('0', 'requests', 1, LIMITS.maxRequestsPerLevel))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => boundedInteger('501', 'requests', 1, LIMITS.maxRequestsPerLevel))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => boundedInteger('999', 'timeout', LIMITS.minTimeoutMs, LIMITS.maxTimeoutMs))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => boundedInteger('60001', 'timeout', LIMITS.minTimeoutMs, LIMITS.maxTimeoutMs))).toBe('LIMIT_INVALID')
    expect(refusalCode(() => boundedInteger('-5', 'timeout', LIMITS.minTimeoutMs, LIMITS.maxTimeoutMs))).toBe('LIMIT_INVALID')
  })
})

describe('statistics', () => {
  it('uses nearest-rank percentiles', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(percentile(values, 50)).toBe(10)
    expect(percentile(values, 95)).toBe(19)
    expect(percentile([7], 95)).toBe(7)
    expect(percentile([], 50)).toBeNull()
  })

  it('counts statuses, 5xx, timeouts and connection errors separately', () => {
    const summary = summarize([
      { outcome: 'response', status: 200, ms: 10 },
      { outcome: 'response', status: 302, ms: 20 },
      { outcome: 'response', status: 404, ms: 30 },
      { outcome: 'response', status: 503, ms: 40 },
      { outcome: 'timeout', status: null, ms: 1000 },
      { outcome: 'connection_error', status: null, ms: 1 },
    ])
    expect(summary).toMatchObject({
      requests: 6,
      responses: 4,
      success: 2,
      status4xx: 1,
      status5xx: 1,
      timeouts: 1,
      connectionErrors: 1,
      statusCounts: { 200: 1, 302: 1, 404: 1, 503: 1 },
      p50: 20,
      max: 40,
    })
  })
})

describe('live behaviour against a local test server', () => {
  let server: Server | null = null
  afterEach(async () => {
    if (!server) return
    server.closeAllConnections()
    await new Promise(done => server!.close(() => done(null)))
    server = null
  })

  function listen(handler: (req: IncomingMessage) => { status: number, headers?: Record<string, string>, delayMs?: number }) {
    const seen: Array<{ method?: string, url?: string, cookie?: string, authorization?: string, contentLength?: string }> = []
    server = createServer((req, res) => {
      seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization, contentLength: req.headers['content-length'] })
      const answer = handler(req)
      const send = () => {
        if (res.destroyed) return
        res.writeHead(answer.status, answer.headers ?? { 'content-type': 'text/plain' })
        res.end('x')
      }
      if (answer.delayMs) setTimeout(send, answer.delayMs)
      else send()
    })
    return new Promise<{ port: number, seen: typeof seen }>(done => server!.listen(0, '127.0.0.1', () => done({ port: (server!.address() as AddressInfo).port, seen })))
  }

  it('sends only credential-free GETs to allowlisted paths, never follows redirects, and counts 5xx and timeouts', async () => {
    const { port, seen } = await listen((req) => {
      switch (req.url) {
        case '/api/cms/products/categories': return { status: 503 }
        case '/api/cms/posts': return { status: 200, delayMs: 1600 }
        case '/sitemap.xml': return { status: 302, headers: { location: 'http://example.invalid/elsewhere' } }
        default: return { status: 200 }
      }
    })
    const result = await runCapacitySmoke({ baseUrl: `http://127.0.0.1:${port}`, levels: '2', requests: '12', timeoutMs: '1000', warmup: false })
    const level = result.levels[0]
    expect(level.requests).toBe(12)
    expect(level.statusCounts).toEqual({ 200: 6, 302: 2, 503: 2 })
    expect(level.status5xx).toBe(2)
    expect(level.timeouts).toBe(2)
    expect(level.connectionErrors).toBe(0)
    expect(result.passed).toBe(false)
    expect(seen.length).toBe(12)
    for (const request of seen) {
      expect(request.method).toBe('GET')
      expect(request.cookie).toBeUndefined()
      expect(request.authorization).toBeUndefined()
      expect(request.contentLength ?? '0').toBe('0')
      expect(ENDPOINT_ALLOWLIST).toContain(request.url)
    }
  }, 20000)

  it('passes when every answer is a non-5xx response in time', async () => {
    const { port } = await listen(() => ({ status: 200 }))
    const result = await runCapacitySmoke({ baseUrl: `http://127.0.0.1:${port}`, levels: '1,3', requests: '6', timeoutMs: '5000' })
    expect(result.warmup).toHaveLength(6)
    expect(result.levels.map(l => l.requests)).toEqual([6, 6])
    expect(result.totals).toEqual({ requests: 12, timeouts: 0, connectionErrors: 0, status5xx: 0 })
    expect(result.passed).toBe(true)
  }, 20000)

  it('records connection errors instead of crashing when nothing listens', async () => {
    const { port } = await listen(() => ({ status: 200 }))
    server!.closeAllConnections()
    await new Promise(done => server!.close(() => done(null)))
    server = null
    // Generous timeout: a refused loopback connect can take a couple of seconds on Windows.
    const result = await runCapacitySmoke({ baseUrl: `http://127.0.0.1:${port}`, levels: '1', requests: '3', timeoutMs: '10000', warmup: false })
    expect(result.levels[0].connectionErrors).toBe(3)
    expect(result.levels[0].timeouts).toBe(0)
    expect(result.passed).toBe(false)
  }, 45000)
})

describe('command line refusals happen before any request', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/local-capacity-smoke.mjs', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 15000 })

  it('refuses a non-loopback target with exit 2', () => {
    const result = run('--base-url', 'https://example.com')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('TARGET_REFUSED')
    expect(result.stdout).toBe('')
  })

  it('refuses a missing target, out-of-bounds levels and unknown options with exit 2', () => {
    expect(run().status).toBe(2)
    const levels = run('--base-url', 'http://127.0.0.1:1', '--levels', '50')
    expect(levels.status).toBe(2)
    expect(levels.stderr).toContain('LIMIT_INVALID')
    expect(run('--base-url', 'http://127.0.0.1:1', '--method', 'POST').status).toBe(2)
  })
})

describe('static contract', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/local-capacity-smoke.mjs'), 'utf8')

  it('uses GET as the only request method and never follows redirects', () => {
    const methods = [...source.matchAll(/method:\s*'([A-Z]+)'/g)].map(m => m[1])
    expect(methods).toEqual(['GET'])
    expect(source).toContain("redirect: 'manual'")
    expect(source).not.toMatch(/\bbody:/)
  })

  it('sets no cookie or authorization header and reads no environment or file', () => {
    expect(source).not.toMatch(/['"]?cookie['"]?\s*:/i)
    expect(source).not.toMatch(/['"]?authorization['"]?\s*:/i)
    expect(source).not.toMatch(/process\.env/)
    expect(source).not.toMatch(/readFile|createReadStream|node:fs/)
  })
})
