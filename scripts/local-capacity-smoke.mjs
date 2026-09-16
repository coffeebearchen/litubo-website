#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-03 — a small, bounded, read-only load baseline for a LITUBO server
 * running on this machine.
 *
 * It measures how a local server answers a handful of public GET routes at a few fixed concurrency
 * levels, so the release record holds measured numbers instead of guesses. It is not a stress test
 * and it says nothing about production capacity: one developer machine, loopback networking, no
 * TLS, no CDN, no real traffic mix.
 *
 * Safety contract (each point has a test in tests/localCapacitySmoke.test.ts):
 *   - loopback targets only (127.0.0.1, localhost, [::1]); anything else is refused before any request;
 *   - GET only, to a fixed allowlist of public routes, with no request body;
 *   - no cookie and no authorization header is ever set, and redirects are never followed;
 *   - concurrency, request count and timeout are bounded;
 *   - it reads no environment variable and no file.
 *
 * Usage:
 *   node scripts/local-capacity-smoke.mjs --base-url http://127.0.0.1:3310
 *     [--levels 1,5,10,20] [--requests 60] [--timeout-ms 30000] [--endpoints /,/products] [--no-warmup] [--json]
 *
 * Exit codes: 0 no timeout, no connection error and no 5xx · 1 at least one of those · 2 refused / invalid input.
 */

import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ENDPOINT_ALLOWLIST = Object.freeze([
  '/',
  '/products',
  '/api/cms/site-settings',
  '/api/cms/products/categories',
  '/api/cms/posts',
  '/sitemap.xml',
])

export const LOOPBACK_HOSTS = Object.freeze(['127.0.0.1', 'localhost', '[::1]'])

export const LIMITS = Object.freeze({
  maxConcurrency: 20,
  maxLevels: 6,
  maxRequestsPerLevel: 500,
  minTimeoutMs: 1000,
  maxTimeoutMs: 60000,
})

export const DEFAULTS = Object.freeze({ levels: [1, 5, 10, 20], requestsPerLevel: 60, timeoutMs: 30000 })

const USER_AGENT = 'litubo-local-capacity-smoke/1'

export class CapacityError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CapacityError'
    this.code = code
  }
}

/** Returns the origin of a loopback base URL, or throws before anything is requested. */
export function assertLoopbackBaseUrl(raw) {
  let url
  try {
    url = new URL(String(raw ?? ''))
  } catch {
    throw new CapacityError('TARGET_INVALID', `${JSON.stringify(raw)} is not a URL.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CapacityError('TARGET_REFUSED', `${url.protocol} is not an HTTP target.`)
  }
  if (url.username || url.password) {
    throw new CapacityError('TARGET_REFUSED', 'a base URL carrying credentials is refused.')
  }
  if (!LOOPBACK_HOSTS.includes(url.hostname)) {
    throw new CapacityError('TARGET_REFUSED', `${url.hostname} is not a loopback host; only ${LOOPBACK_HOSTS.join(', ')} are allowed.`)
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new CapacityError('TARGET_INVALID', 'give the server origin only (scheme, host and port), without a path, query or fragment.')
  }
  return url.origin
}

/** Validates a requested endpoint list against the allowlist; the default is the whole allowlist. */
export function resolveEndpoints(requested) {
  if (requested === undefined) return [...ENDPOINT_ALLOWLIST]
  const list = String(requested).split(',').map(s => s.trim())
  if (list.length === 0 || list.some(e => e === '')) throw new CapacityError('ENDPOINT_INVALID', 'the endpoint list is empty or has an empty entry.')
  const unknown = list.filter(e => !ENDPOINT_ALLOWLIST.includes(e))
  if (unknown.length > 0) throw new CapacityError('ENDPOINT_REFUSED', `not on the allowlist: ${unknown.join(', ')}.`)
  if (new Set(list).size !== list.length) throw new CapacityError('ENDPOINT_INVALID', 'the endpoint list repeats an entry.')
  return list
}

export function boundedInteger(raw, name, min, max) {
  const text = String(raw ?? '').trim()
  if (!/^\d+$/.test(text)) throw new CapacityError('LIMIT_INVALID', `${name} must be a whole number, got ${JSON.stringify(raw)}.`)
  const value = Number(text)
  if (value < min || value > max) throw new CapacityError('LIMIT_INVALID', `${name} must be between ${min} and ${max}, got ${value}.`)
  return value
}

export function parseLevels(raw) {
  const parts = String(raw ?? '').split(',').map(s => s.trim())
  if (parts.length === 0 || parts.length > LIMITS.maxLevels) {
    throw new CapacityError('LIMIT_INVALID', `between 1 and ${LIMITS.maxLevels} concurrency levels are allowed.`)
  }
  return parts.map(p => boundedInteger(p, 'a concurrency level', 1, LIMITS.maxConcurrency))
}

/** Nearest-rank percentile of an ascending array; null for an empty one. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[Math.min(rank, sorted.length) - 1]
}

const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10)

function latencyStats(samples) {
  const ms = samples.filter(s => s.outcome === 'response').map(s => s.ms).sort((a, b) => a - b)
  return { p50: round1(percentile(ms, 50)), p95: round1(percentile(ms, 95)), max: round1(ms.length ? ms[ms.length - 1] : null) }
}

/** Aggregates request samples: counts, status distribution and latency of answered requests. */
export function summarize(samples) {
  const statusCounts = {}
  for (const s of samples) {
    if (s.outcome === 'response') statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  }
  const responses = samples.filter(s => s.outcome === 'response')
  return {
    requests: samples.length,
    responses: responses.length,
    success: responses.filter(s => s.status >= 200 && s.status < 400).length,
    status4xx: responses.filter(s => s.status >= 400 && s.status < 500).length,
    status5xx: responses.filter(s => s.status >= 500).length,
    timeouts: samples.filter(s => s.outcome === 'timeout').length,
    connectionErrors: samples.filter(s => s.outcome === 'connection_error').length,
    statusCounts,
    ...latencyStats(samples),
  }
}

async function timedGet(url, timeoutMs, fetchImpl, now) {
  const controller = new AbortController()
  // A referenced timer: it also keeps the process alive while a request is outstanding.
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = now()
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { accept: '*/*', 'user-agent': USER_AGENT },
      signal: controller.signal,
    })
    const body = await response.arrayBuffer()
    return { outcome: 'response', status: response.status, ms: now() - started, bytes: body.byteLength }
  } catch (error) {
    if (controller.signal.aborted) return { outcome: 'timeout', status: null, ms: now() - started, bytes: 0 }
    return { outcome: 'connection_error', status: null, ms: now() - started, bytes: 0, reason: String(error?.cause?.code ?? error?.name ?? 'error') }
  } finally {
    clearTimeout(timer)
  }
}

/** Sends `requests` GETs, round-robin over `endpoints`, with at most `concurrency` in flight. */
export async function runLevel({ origin, endpoints, concurrency, requests, timeoutMs }, { fetchImpl = fetch, now = () => performance.now() } = {}) {
  const samples = []
  let next = 0
  const started = now()
  const worker = async () => {
    while (next < requests) {
      const index = next++
      const endpoint = endpoints[index % endpoints.length]
      const result = await timedGet(new URL(endpoint, origin), timeoutMs, fetchImpl, now)
      samples.push({ endpoint, ...result })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker))
  const wallMs = now() - started
  const perEndpoint = {}
  for (const endpoint of endpoints) {
    const own = samples.filter(s => s.endpoint === endpoint)
    perEndpoint[endpoint] = { requests: own.length, statusCounts: summarize(own).statusCounts, ...latencyStats(own) }
  }
  return {
    concurrency,
    ...summarize(samples),
    wallMs: round1(wallMs),
    requestsPerSecond: round1(wallMs > 0 ? (samples.length / wallMs) * 1000 : null),
    perEndpoint,
  }
}

/** Validates everything, then runs an optional warm-up pass and each level in turn. */
export async function runCapacitySmoke(options, deps = {}) {
  const origin = assertLoopbackBaseUrl(options.baseUrl)
  const endpoints = resolveEndpoints(options.endpoints)
  const levels = options.levels === undefined ? [...DEFAULTS.levels] : parseLevels(options.levels)
  const requests = options.requests === undefined ? DEFAULTS.requestsPerLevel : boundedInteger(options.requests, 'requests per level', 1, LIMITS.maxRequestsPerLevel)
  const timeoutMs = options.timeoutMs === undefined ? DEFAULTS.timeoutMs : boundedInteger(options.timeoutMs, 'timeout-ms', LIMITS.minTimeoutMs, LIMITS.maxTimeoutMs)
  const { fetchImpl = fetch, now = () => performance.now() } = deps

  const warmup = []
  if (options.warmup !== false) {
    for (const endpoint of endpoints) {
      const result = await timedGet(new URL(endpoint, origin), timeoutMs, fetchImpl, now)
      warmup.push({ endpoint, outcome: result.outcome, status: result.status, ms: round1(result.ms) })
    }
  }
  const results = []
  for (const concurrency of levels) {
    results.push(await runLevel({ origin, endpoints, concurrency, requests, timeoutMs }, { fetchImpl, now }))
  }
  const totals = {
    requests: results.reduce((n, r) => n + r.requests, 0),
    timeouts: results.reduce((n, r) => n + r.timeouts, 0),
    connectionErrors: results.reduce((n, r) => n + r.connectionErrors, 0),
    status5xx: results.reduce((n, r) => n + r.status5xx, 0),
  }
  return {
    origin,
    endpoints,
    requestsPerLevel: requests,
    timeoutMs,
    warmup,
    levels: results,
    totals,
    passed: totals.timeouts === 0 && totals.connectionErrors === 0 && totals.status5xx === 0,
  }
}

function formatReport(result) {
  const lines = [
    'LITUBO local capacity smoke (loopback, GET only — a local baseline, not a production SLA)',
    `  target        ${result.origin}`,
    `  endpoints     ${result.endpoints.join('  ')}`,
    `  per level     ${result.requestsPerLevel} requests, timeout ${result.timeoutMs} ms`,
  ]
  if (result.warmup.length > 0) {
    lines.push(`  warm-up       ${result.warmup.map(w => `${w.endpoint} ${w.status ?? w.outcome} ${w.ms} ms`).join(' · ')}`)
  }
  lines.push('', '  conc  requests  ok  4xx  5xx  timeouts  conn-err   p50 ms   p95 ms   max ms   req/s')
  for (const r of result.levels) {
    lines.push(`  ${String(r.concurrency).padStart(4)}  ${String(r.requests).padStart(8)}  ${String(r.success).padStart(2)}  ${String(r.status4xx).padStart(3)}  ${String(r.status5xx).padStart(3)}  ${String(r.timeouts).padStart(8)}  ${String(r.connectionErrors).padStart(8)}  ${String(r.p50).padStart(7)}  ${String(r.p95).padStart(7)}  ${String(r.max).padStart(7)}  ${String(r.requestsPerSecond).padStart(6)}`)
  }
  lines.push('', result.passed
    ? `OK — ${result.totals.requests} requests: no timeout, no connection error, no 5xx.`
    : `FAIL — timeouts ${result.totals.timeouts}, connection errors ${result.totals.connectionErrors}, 5xx ${result.totals.status5xx}.`)
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2)) {
  let values
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        'base-url': { type: 'string' },
        levels: { type: 'string' },
        requests: { type: 'string' },
        'timeout-ms': { type: 'string' },
        endpoints: { type: 'string' },
        'no-warmup': { type: 'boolean' },
        json: { type: 'boolean' },
      },
      strict: true,
    }))
    if (!values['base-url']) throw new CapacityError('TARGET_INVALID', '--base-url is required (for example http://127.0.0.1:3310).')
    const result = await runCapacitySmoke({
      baseUrl: values['base-url'],
      levels: values.levels,
      requests: values.requests,
      timeoutMs: values['timeout-ms'],
      endpoints: values.endpoints,
      warmup: !values['no-warmup'],
    })
    console.log(values.json ? JSON.stringify(result, null, 2) : formatReport(result))
    return result.passed ? 0 : 1
  } catch (error) {
    if (error instanceof CapacityError) {
      console.error(`REFUSED — ${error.code}: ${error.message}`)
      return 2
    }
    if (error?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || error?.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
      console.error(`REFUSED — ${error.message}`)
      return 2
    }
    throw error
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
if (invokedDirectly) process.exitCode = await main()
