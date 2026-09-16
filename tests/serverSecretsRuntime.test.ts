/**
 * FINAL-RELEASE-PRODUCTION-READY-01D — every server secret is read by the running server from its own
 * environment, at the moment it is used (D-039).
 *
 * Production build artifacts must not contain server secrets, so SMTP_PASS, SUBMISSION_IP_SECRET,
 * HUBSPOT_ACCESS_TOKEN, OPENAI_API_KEY and DEEPSEEK_API_KEY are no longer `runtimeConfig` values, which
 * `nuxt build` serializes into `.output` (measured before this change: each of them once in the server
 * bundle). For every secret these tests pin, against its shipped consumer: an absent value keeps the
 * feature's existing disabled or fail-closed behaviour; the value present at call time is the one used;
 * a changed value is used by the very next call with nothing re-imported; and a stale copy left in
 * `runtimeConfig` — what a build used to capture — is never used. SUBMISSION_IP_SECRET's request-level
 * test sits beside the real limiter in tests/publicInquirySafety.test.ts.
 *
 * Nothing here reaches a real SMTP server, HubSpot or AI provider: nodemailer, `fetch`, the Directus
 * client and both AI engines are doubles, and every value is a fixed test string.
 */

import { Readable } from 'node:stream'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readDeepseekApiKey,
  readHubspotAccessToken,
  readOpenaiApiKey,
  readSmtpPassword,
  readSubmissionIpSecret,
} from '../server/utils/serverSecrets'
import { sendInquiryEmail } from '../server/utils/sendInquiryEmail'
import { syncHubspot } from '../server/utils/syncHubspot'

const runtimeConfig = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig.current }))

const mail = vi.hoisted(() => ({ transports: [] as Array<{ auth?: { user?: string, pass?: string } }>, sendMailCalls: 0 }))
vi.mock('nodemailer', () => {
  const createTransport = (options: { auth?: { user?: string, pass?: string } }) => {
    mail.transports.push(options)
    return {
      sendMail: async () => {
        mail.sendMailCalls++
        return {}
      },
    }
  }
  return { default: { createTransport }, createTransport }
})

const directusWrites = vi.hoisted(() => [] as Array<{ path: string, body: unknown }>)
vi.mock('../server/utils/directus', () => ({
  directusFetch: async (path: string, options: { body?: unknown } = {}) => {
    directusWrites.push({ path, body: options.body })
    return { data: {} }
  },
}))

const registryConfigs = vi.hoisted(() => [] as Array<{ openai: { apiKey: string }, deepseek: { apiKey: string } }>)
vi.mock('../server/utils/aiProviderRegistryDefault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/aiProviderRegistryDefault')>()
  return {
    ...actual,
    createDefaultAiProviderRegistry: (config: Parameters<typeof actual.createDefaultAiProviderRegistry>[0]) => {
      registryConfigs.push(config)
      return actual.createDefaultAiProviderRegistry(config)
    },
  }
})

// Content Center Analyze and Product Generate run only as far as building their provider registry: the
// engines behind it are doubles, so no source is read and no provider is ever called.
vi.mock('../server/utils/aiContentIntake', async importOriginal => ({
  ...(await importOriginal<typeof import('../server/utils/aiContentIntake')>()),
  analyzeContentAiSources: async () => ({ ok: false, error: 'engine double', fileResults: [] }),
}))
vi.mock('../server/utils/aiProposalEngine', async importOriginal => ({
  ...(await importOriginal<typeof import('../server/utils/aiProposalEngine')>()),
  runProposalEngine: async () => ({ ok: false, error: 'engine double', fileResults: [] }),
}))
vi.mock('../server/utils/productLifecycle', async importOriginal => ({
  ...(await importOriginal<typeof import('../server/utils/productLifecycle')>()),
  readProductLifecycle: async () => ({ status: 'draft' }),
}))
vi.mock('../server/utils/aiSourceRef', async importOriginal => ({
  ...(await importOriginal<typeof import('../server/utils/aiSourceRef')>()),
  resolveSourceRefs: () => [21],
}))

const SECRET_NAMES = ['SMTP_PASS', 'SUBMISSION_IP_SECRET', 'HUBSPOT_ACCESS_TOKEN', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'] as const
const READERS = {
  SMTP_PASS: readSmtpPassword,
  SUBMISSION_IP_SECRET: readSubmissionIpSecret,
  HUBSPOT_ACCESS_TOKEN: readHubspotAccessToken,
  OPENAI_API_KEY: readOpenaiApiKey,
  DEEPSEEK_API_KEY: readDeepseekApiKey,
} as const

/** Nuxt's run-time override for a `runtimeConfig` key — assembled, so no file carries one as a literal. */
const overrideNameFor = (name: string) => ['NUXT', name].join('_')

/** What `runtimeConfig` used to carry: a copy of each secret taken at build time. None may ever be used. */
const STALE_BUILD_COPIES = {
  smtpPass: 'stale-build-smtp-pass',
  submissionIpSecret: 'stale-build-ip-secret',
  hubspotAccessToken: 'stale-build-hubspot-token',
  openaiApiKey: 'stale-build-openai-key',
  deepseekApiKey: 'stale-build-deepseek-key',
}

beforeEach(() => {
  // Every test starts from "nothing supplied", whatever the shell running the suite exports.
  for (const name of SECRET_NAMES) {
    vi.stubEnv(name, undefined)
    vi.stubEnv(overrideNameFor(name), undefined)
  }
  runtimeConfig.current = {}
  mail.transports.length = 0
  mail.sendMailCalls = 0
  directusWrites.length = 0
  registryConfigs.length = 0
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useRuntimeConfig', () => runtimeConfig.current)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('serverSecrets readers — the running process environment, read at call time', () => {
  it.each(SECRET_NAMES)('%s: absent or empty reads as not configured', (name) => {
    expect(READERS[name]()).toBe('')
    vi.stubEnv(name, '')
    expect(READERS[name]()).toBe('')
  })

  it.each(SECRET_NAMES)('%s: returns the value present when called, and a changed value on the next call', (name) => {
    vi.stubEnv(name, `${name}-runtime-value-one`)
    expect(READERS[name]()).toBe(`${name}-runtime-value-one`)
    vi.stubEnv(name, `${name}-runtime-value-two`)
    expect(READERS[name]()).toBe(`${name}-runtime-value-two`)
  })

  it.each(SECRET_NAMES)('%s: Nuxt\'s override name is not a second way to supply it', (name) => {
    vi.stubEnv(overrideNameFor(name), 'framework-override-value')
    expect(READERS[name]()).toBe('')
  })
})

describe('SMTP_PASS — the inquiry notification email', () => {
  const smtpConfig = () => ({
    smtpHost: 'smtp.test',
    smtpPort: '587',
    smtpUser: 'mailbox@example.com',
    smtpFrom: 'noreply@example.com',
    contactEmail: 'contact@example.com',
    salesEmail: 'sales@example.com',
    ...STALE_BUILD_COPIES,
  })

  it('absent: the transport gets no password — never a stale build-time copy', async () => {
    runtimeConfig.current = smtpConfig()
    await sendInquiryEmail(1, 'contact')
    expect(mail.transports).toHaveLength(1)
    expect(mail.transports[0]!.auth).toEqual({ user: 'mailbox@example.com', pass: '' })
  })

  it('uses the password present at send time, and a rotated one on the next send', async () => {
    runtimeConfig.current = smtpConfig()
    vi.stubEnv('SMTP_PASS', 'runtime-smtp-pass-one')
    await sendInquiryEmail(1, 'contact')
    vi.stubEnv('SMTP_PASS', 'runtime-smtp-pass-two')
    await sendInquiryEmail(2, 'contact')
    expect(mail.transports.map(transport => transport.auth?.pass)).toEqual(['runtime-smtp-pass-one', 'runtime-smtp-pass-two'])
  })

  it('without SMTP_HOST email stays disabled exactly as before: no transport, nothing sent', async () => {
    runtimeConfig.current = { ...smtpConfig(), smtpHost: '' }
    vi.stubEnv('SMTP_PASS', 'runtime-smtp-pass')
    await sendInquiryEmail(1, 'contact')
    expect(mail.transports).toHaveLength(0)
    expect(mail.sendMailCalls).toBe(0)
  })
})

describe('HUBSPOT_ACCESS_TOKEN — Contact sync', () => {
  const input = {
    contact_email: 'lab@example.com',
    contact_name: null,
    contact_company: null,
    contact_phone: null,
    inquiry_type: 'contact',
    source_url: '/contact',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    product_interest: null,
  }
  const hubspotCalls: Array<{ url: string, authorization: string | undefined }> = []

  beforeEach(() => {
    hubspotCalls.length = 0
    runtimeConfig.current = { hubspotApiBase: 'http://hubspot.test', ...STALE_BUILD_COPIES }
    // The only network a sync could use. A double: nothing leaves the process.
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      hubspotCalls.push({ url, authorization: init?.headers?.Authorization })
      return new Response(JSON.stringify({ id: 'contact-1' }), { status: 200 })
    }))
  })

  it('absent: records not_configured and makes no HubSpot request — never with a stale build-time copy', async () => {
    await syncHubspot(7, input)
    expect(hubspotCalls).toHaveLength(0)
    expect(directusWrites).toHaveLength(1)
    expect(directusWrites[0]).toMatchObject({ path: '/items/inquiries/7', body: { hubspot_sync_status: 'not_configured' } })
  })

  it('authenticates with the token present at sync time, and a rotated one on the next sync', async () => {
    vi.stubEnv('HUBSPOT_ACCESS_TOKEN', 'runtime-hubspot-token-one')
    await syncHubspot(7, input)
    vi.stubEnv('HUBSPOT_ACCESS_TOKEN', 'runtime-hubspot-token-two')
    await syncHubspot(8, input)
    expect(hubspotCalls.map(call => call.authorization)).toEqual(['Bearer runtime-hubspot-token-one', 'Bearer runtime-hubspot-token-two'])
    expect(hubspotCalls.every(call => call.url.startsWith('http://hubspot.test/'))).toBe(true)
  })
})

describe('OPENAI_API_KEY / DEEPSEEK_API_KEY — every AI endpoint builds its providers from the run-time keys', () => {
  type Handler = (event: unknown) => unknown

  function adminEvent(url: string, params: Record<string, string>, body?: unknown) {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const method = body === undefined ? 'GET' : 'POST'
    const req = Object.assign(Readable.from(payload ? [payload] : []), {
      url,
      method,
      headers: {
        'host': 'localhost:3000',
        'content-type': 'application/json',
        ...(payload ? { 'content-length': String(Buffer.byteLength(payload)) } : {}),
      },
    })
    return {
      path: url,
      method,
      node: { req, res: { setHeader: () => {}, getHeader: () => undefined, end: () => {}, writableEnded: false, statusCode: 200 } },
      context: { params, adminUserId: 'admin-1', adminToken: 'admin-token' } as Record<string, unknown>,
    }
  }

  async function callProviders(): Promise<Array<{ id: string, configured: boolean }>> {
    const handler = (await import('../server/api/admin/ai/providers.get')).default as unknown as Handler
    return await handler(adminEvent('/api/admin/ai/providers', {})) as Array<{ id: string, configured: boolean }>
  }

  async function callContentAnalyze(): Promise<unknown> {
    const handler = (await import('../server/api/admin/content-center/[id]/ai-source-intake.post')).default as unknown as Handler
    return await handler(adminEvent('/api/admin/content-center/6/ai-source-intake', { id: '6' }, { locale: 'en', sourceRefs: ['ref'] }))
  }

  async function callProductGenerate(): Promise<unknown> {
    const { resetGenerateSlots } = await import('../server/utils/aiGenerateRateLimit')
    resetGenerateSlots()
    const handler = (await import('../server/api/admin/products/[id]/ai/specification-proposal/generate.post')).default as unknown as Handler
    return await handler(adminEvent('/api/admin/products/3/ai/specification-proposal/generate', { id: '3' }, { providerId: 'deepseek', sourceRefs: ['ref'] }))
  }

  const AI_ENDPOINTS: Array<[string, () => Promise<unknown>]> = [
    ['GET ai/providers', callProviders],
    ['POST Content Center Analyze', callContentAnalyze],
    ['POST Product Generate', callProductGenerate],
  ]

  beforeEach(() => {
    runtimeConfig.current = {
      aiDefaultProvider: 'deepseek',
      openaiModel: 'test-openai-model',
      deepseekModel: 'test-deepseek-model',
      documentExtractorUrl: 'http://127.0.0.1:1',
      ...STALE_BUILD_COPIES,
    }
  })

  it.each(AI_ENDPOINTS)('%s: absent keys reach the registry empty — never a stale build-time copy', async (label, call) => {
    await call()
    expect(registryConfigs.at(-1), label).toMatchObject({ openai: { apiKey: '' }, deepseek: { apiKey: '' } })
  })

  it.each(AI_ENDPOINTS)('%s: uses the keys present at request time, and rotated keys on the next request', async (label, call) => {
    vi.stubEnv('OPENAI_API_KEY', 'runtime-openai-key-one')
    vi.stubEnv('DEEPSEEK_API_KEY', 'runtime-deepseek-key-one')
    await call()
    vi.stubEnv('OPENAI_API_KEY', 'runtime-openai-key-two')
    vi.stubEnv('DEEPSEEK_API_KEY', 'runtime-deepseek-key-two')
    await call()
    expect(registryConfigs.slice(-2).map(config => [config.openai.apiKey, config.deepseek.apiKey]), label).toEqual([
      ['runtime-openai-key-one', 'runtime-deepseek-key-one'],
      ['runtime-openai-key-two', 'runtime-deepseek-key-two'],
    ])
  })

  it('ai/providers reports a provider configured only while its run-time key is present', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'runtime-deepseek-key')
    expect((await callProviders()).find(provider => provider.id === 'deepseek')?.configured).toBe(true)
    vi.stubEnv('DEEPSEEK_API_KEY', undefined)
    expect((await callProviders()).find(provider => provider.id === 'deepseek')?.configured).toBe(false)
  })
})

describe('runtime-only server secret contract (D-039)', () => {
  const repoFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  /** Every TypeScript source under server/, as repo-relative forward-slash paths. */
  const serverSources = (dir = resolve(process.cwd(), 'server')): Array<{ path: string, text: string }> =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) return serverSources(full)
      if (!entry.name.endsWith('.ts')) return []
      return [{ path: relative(process.cwd(), full).split(sep).join('/'), text: readFileSync(full, 'utf8') }]
    })

  const ALL_SECRETS = [...SECRET_NAMES, 'DIRECTUS_TOKEN']
  const RETIRED_CONFIG_KEYS = ['smtpPass', 'submissionIpSecret', 'hubspotAccessToken', 'openaiApiKey', 'deepseekApiKey', 'directusToken']

  it('nuxt.config.ts declares no server secret, so no build can serialize one', () => {
    const config = repoFile('nuxt.config.ts')
    for (const name of ALL_SECRETS) expect(config, name).not.toContain(`process.env.${name}`)
    for (const key of RETIRED_CONFIG_KEYS) expect(config, key).not.toMatch(new RegExp(`\\b${key}\\b`))
    const publicStart = config.indexOf('public: {')
    const publicBlock = config.slice(publicStart, config.indexOf('}', publicStart))
    for (const name of ALL_SECRETS) expect(publicBlock, name).not.toContain(name)
  })

  it('each secret is read from process.env in exactly one server module, and never from runtimeConfig', () => {
    const sources = serverSources()
    for (const name of SECRET_NAMES) {
      expect(sources.filter(({ text }) => text.includes(`process.env.${name}`)).map(({ path }) => path), name).toEqual(['server/utils/serverSecrets.ts'])
    }
    expect(sources.filter(({ text }) => text.includes('process.env.DIRECTUS_TOKEN')).map(({ path }) => path)).toEqual(['server/utils/directusServiceToken.ts'])
    for (const key of RETIRED_CONFIG_KEYS) {
      expect(sources.filter(({ text }) => new RegExp(`\\b${key}\\b`).test(text)).map(({ path }) => path), key).toEqual([])
    }
  })

  it('every consumer calls its reader', () => {
    const uses: Array<[string, string[]]> = [
      ['server/utils/sendInquiryEmail.ts', ['readSmtpPassword()']],
      ['server/utils/publicInquiry.ts', ['readSubmissionIpSecret()', 'readHubspotAccessToken()']],
      ['server/utils/syncHubspot.ts', ['readHubspotAccessToken()']],
      ['server/api/admin/ai/providers.get.ts', ['readOpenaiApiKey()', 'readDeepseekApiKey()']],
      ['server/api/admin/content-center/[id]/ai-source-intake.post.ts', ['readOpenaiApiKey()', 'readDeepseekApiKey()']],
      ['server/api/admin/products/[id]/ai/specification-proposal/generate.post.ts', ['readOpenaiApiKey()', 'readDeepseekApiKey()']],
    ]
    for (const [path, calls] of uses) {
      for (const call of calls) expect(repoFile(path), `${path} ${call}`).toContain(call)
    }
  })

  it('no NUXT_ override becomes a second project secret, and .env.example declares each secret once, with no value', () => {
    const example = repoFile('.env.example')
    const sources = serverSources()
    for (const name of ALL_SECRETS) {
      const override = overrideNameFor(name)
      for (const { path, text } of sources) expect(text, `${path} ${override}`).not.toContain(override)
      for (const path of ['nuxt.config.ts', 'scripts/provision-directus.mjs', 'scripts/provisioning-manifest.json', '.env.example']) {
        expect(repoFile(path), `${path} ${override}`).not.toContain(override)
      }
      const lines = example.match(new RegExp(`^${name}=.*$`, 'gm')) ?? []
      expect(lines, name).toHaveLength(1)
      expect(lines[0], name).toMatch(new RegExp(`^${name}=(<[^>]*>)?\\s*$`))
    }
  })
})
