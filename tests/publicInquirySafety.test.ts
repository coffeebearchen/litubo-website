/**
 * FINAL-RELEASE-FIX-A — public form safety (FINAL-RELEASE-AUDIT-01 P0-01), over a REAL HTTP/1.1 connection.
 *
 * The four real public route handlers — `/api/inquiries` and the legacy `/api/contact`,
 * `/api/support-request` and `/api/spare-parts` adapters — are mounted on an h3 app behind a real
 * `node:http` server, so body limits, status codes and responses are what a network client sees.
 * Only the edges are replaced: the Nitro `useRuntimeConfig` global, the Directus fetch (captured,
 * never sent) and the config-gated email / HubSpot helpers (never constructed, so no SMTP connection
 * and no HubSpot request can happen). Every filesystem write function is a no-op spy: a regression
 * would be counted here, never allowed to write a real file.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createApp, createRouter, toNodeListener } from 'h3'
import inquiriesHandler from '../server/api/inquiries.post'
import contactHandler from '../server/api/contact.post'
import supportRequestHandler from '../server/api/support-request.post'
import sparePartsHandler from '../server/api/spare-parts.post'
import { PUBLIC_INQUIRY_BODY_MAX_BYTES } from '../server/utils/publicInquiry'

const fsSpy = vi.hoisted(() => {
  const calls: Array<{ fn: string, target: string }> = []
  const note = (fn: string, args: unknown[]) => { calls.push({ fn, target: String(args[0]) }) }
  const promiseApi = ['writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'open', 'rename', 'copyFile', 'cp', 'rm', 'unlink', 'truncate', 'symlink', 'link']
  const syncApi = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'openSync', 'renameSync', 'copyFileSync', 'cpSync', 'rmSync', 'unlinkSync', 'truncateSync', 'symlinkSync', 'linkSync', 'createWriteStream']
  const promises = Object.fromEntries(promiseApi.map(fn => [fn, async (...args: unknown[]) => note(fn, args)]))
  const callbacks = Object.fromEntries(promiseApi.map(fn => [fn, (...args: unknown[]) => {
    note(fn, args)
    const done = args[args.length - 1]
    if (typeof done === 'function') done(null)
  }]))
  const sync = Object.fromEntries(syncApi.map(fn => [fn, (...args: unknown[]) => note(fn, args)]))
  return { calls, promises, callbacks, sync }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...fsSpy.promises, default: { ...actual, ...fsSpy.promises } }
})
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ...fsSpy.promises, default: { ...actual, ...fsSpy.promises } }
})
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & { promises: Record<string, unknown> }>()
  const mocked = { ...actual, ...fsSpy.callbacks, ...fsSpy.sync, promises: { ...actual.promises, ...fsSpy.promises } }
  return { ...mocked, default: mocked }
})
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & { promises: Record<string, unknown> }>()
  const mocked = { ...actual, ...fsSpy.callbacks, ...fsSpy.sync, promises: { ...actual.promises, ...fsSpy.promises } }
  return { ...mocked, default: mocked }
})

interface DirectusCall { path: string, options: { method?: string, body?: Record<string, unknown> } }

const directus = vi.hoisted(() => ({ calls: [] as DirectusCall[], failure: null as Error | null }))

vi.mock('../server/utils/directus', () => ({
  directusFetch: async (path: string, options: DirectusCall['options'] = {}) => {
    directus.calls.push({ path, options })
    if (directus.failure) throw directus.failure
    return { data: { id: 700 + directus.calls.length } }
  },
}))

const notify = vi.hoisted(() => ({
  email: vi.fn<(id: number | null, type: string) => Promise<void>>(async () => {}),
  hubspot: vi.fn<(id: number, input: Record<string, unknown>) => Promise<void>>(async () => {}),
}))

vi.mock('../server/utils/sendInquiryEmail', () => ({ sendInquiryEmail: notify.email }))
vi.mock('../server/utils/syncHubspot', () => ({ syncHubspot: notify.hubspot }))

const config = {
  submissionIpSecret: 'test-ip-hash-secret',
  privacyPolicyVersion: '1.0',
  hubspotAccessToken: '',
  public: { siteUrl: 'http://localhost:3000' },
}

const MARK = 'TEST ONLY — NOT FOR PUBLICATION'
const SITE = 'http://localhost:3000'

/** Exactly the fields the nuxt-server create permission on `inquiries` allows. */
const STORED_KEYS = [
  'inquiry_type', 'status', 'locale', 'consent_given', 'consented_at', 'privacy_policy_version',
  'contact_name', 'contact_email', 'contact_phone', 'contact_company', 'contact_country', 'contact_title',
  'message', 'related_product_slug', 'related_application_slug', 'model_number', 'serial_number',
  'tm_product_interest', 'tm_product_format', 'tm_line_speed', 'tm_package_dimensions',
  'tm_contaminant_concern', 'tm_existing_equipment',
  'source_url', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'raw_fields', 'hubspot_sync_status',
].sort()

/** The body Become a Partner sends to /api/contact (pages/company/become-a-partner.vue). */
const partnerBody = () => ({
  name: `${MARK} Partner`, company: 'Example Packaging Ltd', email: 'partner@example.com', country: 'Chile',
  message: `${MARK} partner message`, consent: true,
  formId: 'become-a-partner', sourceUrl: '/company/become-a-partner', locale: 'en',
})

/** The legacy support request body (pages/support/[requestType].vue at git a2d1c4e). */
const supportBody = () => ({
  name: `${MARK} Support`, company: 'Example Foods SA', email: 'support@example.com', model: 'LT-TEST-01', serial: 'SN-TEST-01',
  country: 'Peru', issue: `${MARK} reject rate issue`, urgency: 'high', consent: true,
  formId: 'technical-support', sourceUrl: '/support/technical-support', locale: 'es',
})

/** The legacy spare parts body (pages/support/request-spare-parts.vue at git a2d1c4e). */
const sparePartsBody = () => ({
  email: 'parts@example.com', model: 'LT-TEST-01', serial: 'SN-TEST-01', parts: `${MARK} reject belt x2`,
  country: 'Brazil', message: 'Needed this month', consent: true,
  formId: 'spare-parts', sourceUrl: '/support/request-spare-parts', locale: 'pt',
})

/** The body the Contact page sends to /api/inquiries (pages/contact.vue). */
const contactPageBody = () => ({
  inquiry_type: 'contact', locale: 'en', contact_name: `${MARK} Contact`, contact_company: 'Example Dairy Co',
  contact_email: 'contact@example.com', contact_country: 'Mexico', contact_phone: '+52 55 0000 0000',
  message: `${MARK} contact message`, consent: true, website: '',
})

const ENDPOINTS: Array<{ path: string, body: () => Record<string, unknown> }> = [
  { path: '/api/inquiries', body: contactPageBody },
  { path: '/api/contact', body: partnerBody },
  { path: '/api/support-request', body: supportBody },
  { path: '/api/spare-parts', body: sparePartsBody },
]
const LEGACY = ENDPOINTS.slice(1)

let server: Server
let port = 0
let clientCounter = 0

/** A distinct documentation-range address, so each request has its own rate-limit bucket unless a test shares one. */
const newClient = () => `2001:db8::${(++clientCounter).toString(16)}`

interface Reply { status?: number, json: Record<string, unknown> | null, error?: string }

function send(path: string, headers: Record<string, string>, chunks: string[]): Promise<Reply> {
  return new Promise((done) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'POST', headers }, (res) => {
      let text = ''
      res.on('data', (chunk) => { text += String(chunk) })
      res.on('end', () => {
        let json: Record<string, unknown> | null = null
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
        done({ status: res.statusCode, json })
      })
    })
    req.on('error', (err: NodeJS.ErrnoException) => done({ json: null, error: err.code ?? err.message }))
    for (const chunk of chunks) req.write(chunk)
    req.end()
  })
}

/** POSTs a JSON body (a string is sent as-is) with a declared Content-Length, like a browser form submission. */
function post(path: string, body: unknown, options: { client?: string, referer?: string } = {}): Promise<Reply> {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return send(path, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(payload)),
    'x-forwarded-for': options.client ?? newClient(),
    'referer': options.referer ?? `${SITE}/company/become-a-partner`,
  }, [payload])
}

function storedInquiries(): Array<Record<string, unknown>> {
  return directus.calls.map((call) => {
    expect(call.path).toBe('/items/inquiries?fields=id')
    expect(call.options.method).toBe('POST')
    return call.options.body as Record<string, unknown>
  })
}

beforeAll(async () => {
  vi.stubGlobal('useRuntimeConfig', () => config)
  const router = createRouter()
    .post('/api/inquiries', inquiriesHandler)
    .post('/api/contact', contactHandler)
    .post('/api/support-request', supportRequestHandler)
    .post('/api/spare-parts', sparePartsHandler)
  const app = createApp({
    // Like Nitro's JSON error response: the status code and the error's own message.
    onError: (error, event) => {
      event.node.res.statusCode = error.statusCode
      event.node.res.setHeader('content-type', 'application/json')
      event.node.res.end(JSON.stringify({ statusCode: error.statusCode, message: error.message }))
    },
  })
  app.use(router)
  server = createServer(toNodeListener(app))
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  await new Promise<void>(done => server.close(() => done()))
  vi.unstubAllGlobals()
})

beforeEach(() => {
  directus.calls.length = 0
  directus.failure = null
  notify.email.mockClear()
  notify.hubspot.mockClear()
  config.hubspotAccessToken = ''
})

describe('FINAL-RELEASE-FIX-A — public inquiry submissions over real HTTP', () => {
  describe('path traversal and the filesystem', () => {
    const ESCAPE = 'litubo-fix-a-escape'
    const TRAVERSAL_IDS = [
      `../../${ESCAPE}`,
      `..\\..\\${ESCAPE}`,
      `../../../../../../../../${ESCAPE}`,
      `/tmp/${ESCAPE}`,
      `C:\\${ESCAPE}`,
      `become-a-partner/../../${ESCAPE}`,
      `become-a-partner\u0000../${ESCAPE}`,
    ]

    it('a traversal formId is refused by every legacy adapter; nothing is stored and no file is written', async () => {
      for (const { path, body } of LEGACY) {
        for (const formId of TRAVERSAL_IDS) {
          const reply = await post(path, { ...body(), formId })
          expect(reply.status, `${path} ${JSON.stringify(formId)}`).toBe(400)
          expect(reply.json?.message).toBe('Invalid form.')
        }
      }
      expect(directus.calls).toHaveLength(0)
      expect(fsSpy.calls).toEqual([])
    })

    it('nothing named after a traversal attempt exists in the repository or in any parent directory', () => {
      let dir = process.cwd()
      for (;;) {
        let entries: string[] = []
        try {
          entries = readdirSync(dir)
        } catch {
          entries = []
        }
        expect(entries.filter(name => name.startsWith(ESCAPE)), dir).toEqual([])
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }
    })

    it('valid submissions through all four endpoints are stored without any filesystem write', async () => {
      for (const { path, body } of ENDPOINTS) {
        const reply = await post(path, body())
        expect(reply.status, path).toBe(200)
        expect(reply.json, path).toEqual({ ok: true })
      }
      expect(storedInquiries()).toHaveLength(4)
      expect(fsSpy.calls).toEqual([])
    })

    it('the public inquiry sources contain no filesystem access, local data path or path building', () => {
      const sources = [
        'server/api/inquiries.post.ts', 'server/api/contact.post.ts', 'server/api/support-request.post.ts', 'server/api/spare-parts.post.ts',
        'server/utils/publicInquiry.ts', 'server/utils/legacyInquiryAdapters.ts', 'server/utils/writeInquiry.ts', 'server/utils/rateLimit.ts',
      ]
      for (const file of sources) {
        const source = readFileSync(resolve(process.cwd(), file), 'utf8')
        expect(source, file).not.toMatch(/['"](node:)?(fs|path)(\/promises)?['"]|writeFile|appendFile|createWriteStream|mkdir|process\.cwd|['"`/]\.data/)
      }
    })
  })

  describe('request body limit', () => {
    const oversized = (body: Record<string, unknown>) => JSON.stringify({ ...body, message: 'x'.repeat(PUBLIC_INQUIRY_BODY_MAX_BYTES) })

    it('the ceiling is 64 KB', () => {
      expect(PUBLIC_INQUIRY_BODY_MAX_BYTES).toBe(64 * 1024)
    })

    it('an oversized body is refused with 413 on every endpoint, declared or chunked, and nothing is stored', async () => {
      for (const { path, body } of ENDPOINTS) {
        const payload = oversized(body())

        const declared = await post(path, payload)
        expect(declared.error, path).toBeUndefined()
        expect(declared.status, path).toBe(413)

        // No Content-Length: Node sends the body chunked, so only the bytes actually read can refuse it.
        const pieces = Array.from({ length: Math.ceil(payload.length / 8192) }, (_, i) => payload.slice(i * 8192, (i + 1) * 8192))
        const chunked = await send(path, { 'content-type': 'application/json', 'x-forwarded-for': newClient() }, pieces)
        expect(chunked.error, path).toBeUndefined()
        expect(chunked.status, path).toBe(413)
      }
      expect(directus.calls).toHaveLength(0)
    })

    it('a long submission under the ceiling is accepted, and its message is trimmed to the field limit', async () => {
      const reply = await post('/api/contact', { ...partnerBody(), message: 'y'.repeat(PUBLIC_INQUIRY_BODY_MAX_BYTES - 2048) })
      expect(reply.status).toBe(200)
      const [stored] = storedInquiries()
      expect(String(stored!.message)).toHaveLength(5000)
    })
  })

  describe('consent', () => {
    it('an explicit consent of true is accepted, and only then does the server record consented_at', async () => {
      const before = Date.now()
      for (const { path, body } of ENDPOINTS) {
        expect((await post(path, body())).status, path).toBe(200)
      }
      const stored = storedInquiries()
      expect(stored).toHaveLength(4)
      for (const inquiry of stored) {
        expect(inquiry.consent_given).toBe(true)
        expect(Date.parse(String(inquiry.consented_at))).toBeGreaterThanOrEqual(before - 1000)
      }
    })

    it('false, missing or any other value is refused with 400 on every endpoint, and nothing is stored', async () => {
      for (const { path, body } of ENDPOINTS) {
        for (const consent of [false, undefined, null, 'true', 1, 'yes', {}, [true]]) {
          const reply = await post(path, { ...body(), consent })
          expect(reply.status, `${path} ${JSON.stringify(consent)}`).toBe(400)
          expect(reply.json?.message).toBe('Consent is required.')
        }
      }
      expect(directus.calls).toHaveLength(0)
      expect(notify.email).not.toHaveBeenCalled()
    })
  })

  describe('honeypot', () => {
    it('a filled website field gets the normal success response on every endpoint; nothing is stored or notified', async () => {
      for (const { path, body } of ENDPOINTS) {
        const reply = await post(path, { ...body(), website: 'https://bot.example' })
        expect(reply.status, path).toBe(200)
        expect(reply.json, path).toEqual({ ok: true })
      }
      expect(directus.calls).toHaveLength(0)
      expect(notify.email).not.toHaveBeenCalled()
      expect(notify.hubspot).not.toHaveBeenCalled()
    })
  })

  describe('rate limit', () => {
    it('allows 3 submissions per client per minute, then answers 429 without storing', async () => {
      const client = newClient()
      for (let i = 0; i < 3; i++) {
        expect((await post('/api/contact', partnerBody(), { client })).status).toBe(200)
      }
      expect((await post('/api/contact', partnerBody(), { client })).status).toBe(429)
      expect(directus.calls).toHaveLength(3)
    })

    it('one bucket is shared by all four endpoints', async () => {
      const client = newClient()
      expect((await post('/api/contact', partnerBody(), { client })).status).toBe(200)
      expect((await post('/api/support-request', supportBody(), { client })).status).toBe(200)
      expect((await post('/api/spare-parts', sparePartsBody(), { client })).status).toBe(200)
      expect((await post('/api/inquiries', contactPageBody(), { client })).status).toBe(429)
      expect(directus.calls).toHaveLength(3)
    })

    it('changing a body field does not open a new bucket, and another client is unaffected', async () => {
      const client = newClient()
      for (const inquiryType of ['contact', 'distributor', 'technical_matching']) {
        expect((await post('/api/inquiries', { ...contactPageBody(), inquiry_type: inquiryType }, { client })).status).toBe(200)
      }
      expect((await post('/api/inquiries', { ...contactPageBody(), inquiry_type: 'send_product_test' }, { client })).status).toBe(429)
      expect((await post('/api/contact', { ...partnerBody(), formId: 'contact' }, { client })).status).toBe(429)
      expect((await post('/api/inquiries', contactPageBody(), { client: newClient() })).status).toBe(200)
    })

    it('honeypot submissions count toward the limit too', async () => {
      const client = newClient()
      for (let i = 0; i < 3; i++) {
        expect((await post('/api/spare-parts', { ...sparePartsBody(), website: 'filled' }, { client })).status).toBe(200)
      }
      expect((await post('/api/spare-parts', sparePartsBody(), { client })).status).toBe(429)
      expect(directus.calls).toHaveLength(0)
    })
  })

  describe('validation', () => {
    it('an invalid email is refused with 400 on every endpoint', async () => {
      for (const { path, body } of ENDPOINTS) {
        const invalid = path === '/api/inquiries' ? { ...body(), contact_email: 'not-an-email' } : { ...body(), email: 'not-an-email' }
        const reply = await post(path, invalid)
        expect(reply.status, path).toBe(400)
        expect(reply.json?.message).toBe('Invalid email format.')
      }
      expect(directus.calls).toHaveLength(0)
    })

    it('each endpoint enforces its required fields', async () => {
      const cases: Array<[string, Record<string, unknown>]> = [
        ['/api/contact', { ...partnerBody(), name: '' }],
        ['/api/contact', { ...partnerBody(), name: '   ' }],
        ['/api/contact', { ...partnerBody(), email: undefined }],
        ['/api/contact', { ...partnerBody(), formId: undefined }],
        ['/api/support-request', { ...supportBody(), name: undefined }],
        ['/api/support-request', { ...supportBody(), formId: '' }],
        ['/api/spare-parts', { ...sparePartsBody(), model: '' }],
        ['/api/spare-parts', { ...sparePartsBody(), parts: undefined }],
        ['/api/spare-parts', { ...sparePartsBody(), email: undefined }],
        ['/api/inquiries', { ...contactPageBody(), contact_email: '' }],
      ]
      for (const [path, body] of cases) {
        expect((await post(path, body)).status, `${path} ${JSON.stringify(body)}`).toBe(400)
      }
      expect(directus.calls).toHaveLength(0)
    })

    it('an adapter refuses the form ids of forms that moved to /api/inquiries', async () => {
      const cases: Array<[string, Record<string, unknown>]> = [
        ['/api/contact', { ...partnerBody(), formId: 'technical-matching' }],
        ['/api/contact', { ...partnerBody(), formId: 'find-a-distributor' }],
        ['/api/support-request', { ...supportBody(), formId: 'send-product-test' }],
        ['/api/spare-parts', { ...sparePartsBody(), formId: 'contact' }],
      ]
      for (const [path, body] of cases) {
        const reply = await post(path, body)
        expect(reply.status, `${path} ${String(body.formId)}`).toBe(400)
        expect(reply.json?.message).toBe('Invalid form.')
      }
      expect(directus.calls).toHaveLength(0)
    })

    it('an unknown inquiry type or locale is refused', async () => {
      expect((await post('/api/inquiries', { ...contactPageBody(), inquiry_type: 'newsletter' })).json?.message).toBe('Invalid inquiry type.')
      expect((await post('/api/inquiries', { ...contactPageBody(), inquiry_type: undefined })).json?.message).toBe('Invalid inquiry type.')
      expect((await post('/api/inquiries', { ...contactPageBody(), locale: 'de' })).json?.message).toBe('Invalid locale.')
      expect((await post('/api/contact', { ...partnerBody(), locale: 'zh' })).json?.message).toBe('Invalid locale.')
      expect(directus.calls).toHaveLength(0)
    })

    it('a body that is not a JSON object, or a field value that is not text, is refused with 400', async () => {
      for (const raw of ['[]', '"text"', '42', 'null', '', '{"name":']) {
        expect((await post('/api/contact', raw)).status, JSON.stringify(raw)).toBe(400)
      }
      const typed: Array<[string, Record<string, unknown>]> = [
        ['/api/contact', { ...partnerBody(), name: { first: 'x' } }],
        ['/api/contact', { ...partnerBody(), email: ['partner@example.com'] }],
        ['/api/contact', { ...partnerBody(), formId: ['become-a-partner'] }],
        ['/api/support-request', { ...supportBody(), issue: 42 }],
        ['/api/spare-parts', { ...sparePartsBody(), parts: true }],
        ['/api/inquiries', { ...contactPageBody(), message: { text: 'x' } }],
      ]
      for (const [path, body] of typed) {
        const reply = await post(path, body)
        expect(reply.status, path).toBe(400)
        expect(reply.json?.message).toBe('Invalid field value.')
      }
      expect(directus.calls).toHaveLength(0)
    })
  })

  describe('allowlist and persistence', () => {
    it('stores exactly the allowlisted fields; unknown and internal fields in the body are never stored', async () => {
      const reply = await post('/api/inquiries', {
        ...contactPageBody(),
        status: 'resolved', note: 'internal-note', assigned_to: 'someone-else', ai_summary: 'injected', ai_reviewed: true,
        hubspot_contact_id: '999', hubspot_sync_status: 'synced', consent_given: false, consented_at: '2000-01-01T00:00:00.000Z',
        id: 12345, source_url: '/injected', referrer: 'https://evil.example/', raw_fields: { injected: true },
        privacy_policy_version: '0', formId: '../../x', extra_field: 'x',
      }, { referer: `${SITE}/contact` })
      expect(reply.status).toBe(200)
      expect(reply.json).toEqual({ ok: true })
      const [stored] = storedInquiries()
      expect(Object.keys(stored!).sort()).toEqual(STORED_KEYS)
      expect(stored).toMatchObject({
        inquiry_type: 'contact', status: 'new', consent_given: true, privacy_policy_version: '1.0',
        source_url: '/contact', referrer: `${SITE}/contact`, hubspot_sync_status: 'not_configured',
      })
      expect(stored!.consented_at).not.toBe('2000-01-01T00:00:00.000Z')
      expect(Object.keys(stored!.raw_fields as object).sort()).toEqual(['contact_company', 'contact_country', 'contact_email', 'contact_name', 'contact_phone', 'message'])
      expect(JSON.stringify(stored)).not.toMatch(/injected|internal-note|someone-else|evil\.example|extra_field|12345|formId/)
    })

    it('Become a Partner → /api/contact is stored as a contact inquiry with every business field kept', async () => {
      const reply = await post('/api/contact', {
        ...partnerBody(), inquiry_type: 'spare_parts', contact_title: 'Injected title', status: 'spam', sourceUrl: 'https://evil.example/landing',
      })
      expect(reply.status).toBe(200)
      expect(reply.json).toEqual({ ok: true })
      const [stored] = storedInquiries()
      expect(Object.keys(stored!).sort()).toEqual(STORED_KEYS)
      expect(stored).toMatchObject({
        inquiry_type: 'contact', status: 'new', locale: 'en', consent_given: true,
        contact_name: `${MARK} Partner`, contact_email: 'partner@example.com', contact_company: 'Example Packaging Ltd',
        contact_country: 'Chile', contact_phone: null, contact_title: null, message: `${MARK} partner message`,
        source_url: '/company/become-a-partner', hubspot_sync_status: 'not_configured',
      })
      expect(stored!.raw_fields).toEqual({
        contact_name: `${MARK} Partner`, contact_email: 'partner@example.com', contact_company: 'Example Packaging Ltd',
        contact_country: 'Chile', message: `${MARK} partner message`,
      })
      expect(JSON.stringify(stored)).not.toMatch(/formId|evil\.example|Injected title|spam/)
    })

    it('the legacy support request is stored as support_request with model, serial, issue and urgency', async () => {
      const reply = await post('/api/support-request', supportBody(), { referer: `${SITE}/support/technical-support` })
      expect(reply.status).toBe(200)
      const [stored] = storedInquiries()
      expect(Object.keys(stored!).sort()).toEqual(STORED_KEYS)
      expect(stored).toMatchObject({
        inquiry_type: 'support_request', locale: 'es', contact_name: `${MARK} Support`, contact_email: 'support@example.com',
        contact_company: 'Example Foods SA', contact_country: 'Peru', model_number: 'LT-TEST-01', serial_number: 'SN-TEST-01',
        message: `${MARK} reject rate issue`, source_url: '/support/technical-support',
      })
      expect(stored!.raw_fields).toMatchObject({ urgency: 'high', model_number: 'LT-TEST-01', message: `${MARK} reject rate issue` })
    })

    it('the legacy spare parts request is stored as spare_parts with the parts list as the message', async () => {
      expect((await post('/api/spare-parts', sparePartsBody())).status).toBe(200)
      expect((await post('/api/spare-parts', { ...sparePartsBody(), message: '', formId: undefined })).status).toBe(200)
      const [withNotes, withoutNotes] = storedInquiries()
      expect(withNotes).toMatchObject({
        inquiry_type: 'spare_parts', locale: 'pt', contact_name: null, contact_email: 'parts@example.com', contact_country: 'Brazil',
        model_number: 'LT-TEST-01', serial_number: 'SN-TEST-01', message: `${MARK} reject belt x2\n\nAdditional notes: Needed this month`,
      })
      expect(withoutNotes!.message).toBe(`${MARK} reject belt x2`)
    })

    it('/api/inquiries keeps its Phase 6 field mapping for the six form pages', async () => {
      const reply = await post('/api/inquiries', {
        inquiry_type: 'technical_matching', locale: 'en', contact_name: `${MARK} Engineer`, contact_email: 'tm@example.com',
        contact_company: 'Example Snacks', contact_country: 'Colombia', contact_phone: '+57 1 000 0000', contact_title: 'QA Manager',
        message: 'Line details', related_product_slug: 'x-ray-inspection', related_application_slug: 'bakery-snacks',
        tm_product_interest: 'X-ray', tm_product_format: 'Pouches', tm_line_speed: '120 ppm', tm_package_dimensions: '200 x 150 mm',
        tm_contaminant_concern: 'Glass', tm_existing_equipment: 'Metal detector', utm_source: 'test', utm_medium: 'email', utm_campaign: 'fix-a',
        concern: 'Bone fragments', urgency: 'low', consent: true, website: '',
      }, { referer: `${SITE}/technical-matching` })
      expect(reply.status).toBe(200)
      const [stored] = storedInquiries()
      expect(stored).toMatchObject({
        inquiry_type: 'technical_matching', contact_title: 'QA Manager', related_product_slug: 'x-ray-inspection',
        related_application_slug: 'bakery-snacks', tm_product_interest: 'X-ray', tm_product_format: 'Pouches', tm_line_speed: '120 ppm',
        tm_package_dimensions: '200 x 150 mm', tm_contaminant_concern: 'Glass', tm_existing_equipment: 'Metal detector',
        utm_source: 'test', utm_medium: 'email', utm_campaign: 'fix-a', source_url: '/technical-matching',
      })
      expect(stored!.raw_fields).toMatchObject({ concern: 'Bone fragments', urgency: 'low', tm_line_speed: '120 ppm' })
      expect(stored!.raw_fields).not.toHaveProperty('utm_source')
    })

    it('each stored inquiry gets the existing best-effort notification once; HubSpot sync runs only when a token is configured', async () => {
      expect((await post('/api/contact', partnerBody())).status).toBe(200)
      expect(notify.email).toHaveBeenCalledTimes(1)
      expect(notify.email).toHaveBeenCalledWith(701, 'contact')
      expect(notify.hubspot).not.toHaveBeenCalled()

      config.hubspotAccessToken = 'test-token-not-a-real-credential'
      expect((await post('/api/contact', partnerBody())).status).toBe(200)
      const [, second] = storedInquiries()
      expect(second!.hubspot_sync_status).toBe('pending')
      expect(notify.hubspot).toHaveBeenCalledTimes(1)
      expect(notify.hubspot.mock.calls[0]![0]).toBe(702)
      expect(notify.hubspot.mock.calls[0]![1]).toMatchObject({ inquiry_type: 'contact', contact_email: 'partner@example.com', source_url: '/company/become-a-partner' })
    })
  })

  describe('storage failure', () => {
    it('any Directus failure is 503 on every endpoint, never a success, and nothing is notified', async () => {
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const failures = [
          new Error('Directus not configured'),
          Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
          Object.assign(new Error('Bad Request'), { response: { status: 400 } }),
          Object.assign(new Error('Server Error'), { response: { status: 500 } }),
        ]
        for (const failure of failures) {
          directus.failure = failure
          for (const { path, body } of ENDPOINTS) {
            const reply = await post(path, body())
            expect(reply.status, `${path} ${failure.message}`).toBe(503)
            expect(reply.json).toEqual({ statusCode: 503, message: 'CMS unavailable. Please try again later.' })
          }
        }
        expect(notify.email).not.toHaveBeenCalled()
        expect(notify.hubspot).not.toHaveBeenCalled()
      } finally {
        errorLog.mockRestore()
      }
    })
  })

  describe('logging', () => {
    it('never logs a request body, contact details or request headers', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method).mockImplementation(() => {}))
      try {
        const person = { name: 'Zeta Private-Person', email: 'zeta.private@example.com', message: 'confidential-body-marker' }
        const body = { ...partnerBody(), ...person }
        await post('/api/contact', body)
        await post('/api/contact', { ...body, consent: false })
        await post('/api/contact', { ...body, website: 'bot' })
        notify.email.mockRejectedValueOnce(new Error(`smtp failed for ${person.email}`))
        await post('/api/contact', body)
        await new Promise(done => setTimeout(done, 20))
        directus.failure = Object.assign(new Error(`write failed for ${person.email}`), { response: { status: 500 } })
        await post('/api/contact', body)

        const logged = spies.flatMap(spy => spy.mock.calls).map(args => JSON.stringify(args))
        expect(logged).toEqual([
          JSON.stringify(['[inquiry] email notification failed', { id: 702 }]),
          JSON.stringify(['[inquiry] Directus write failed', { status: 500 }]),
        ])
        for (const line of logged) {
          for (const secret of [person.name, person.email, person.message, 'Example Packaging', 'become-a-partner', '2001:db8']) {
            expect(line).not.toContain(secret)
          }
        }
      } finally {
        spies.forEach(spy => spy.mockRestore())
      }
    })
  })

  it('no filesystem write function was called anywhere in this file', () => {
    expect(fsSpy.calls).toEqual([])
  })
})
