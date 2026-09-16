/**
 * FINAL-RELEASE-PRODUCTION-READY-01C — the running server reads the Directus service token from its
 * own environment, at the moment it uses it.
 *
 * Production build artifacts must be secret-free, so `DIRECTUS_TOKEN` is no longer a `runtimeConfig`
 * value: Nuxt evaluates those at `nuxt build` and serializes them into `.output`. These tests pin the
 * run-time half of the contract against the shipped code — the value is read per call, a missing
 * value fails closed before any request, a stale value carried by `runtimeConfig` is never used, and
 * Nuxt's own override name is not a second way in. The build half (a value present while building
 * never reaches `.output`) is a property of a real build and was proven by scanning one; see
 * CURRENT-STATE, FINAL-RELEASE-PRODUCTION-READY-01C. Every value here is a fixed test string.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readDirectusToken } from '../server/utils/directusServiceToken'
import { directusFetch } from '../server/utils/directus'
import mediaHandler from '../server/api/cms/media/[id].get'

const runtimeConfig = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig.current }))

/** Nuxt's run-time override for a `runtimeConfig.directusToken` key — assembled, so no file carries it as a literal. */
const FRAMEWORK_OVERRIDE = ['NUXT', 'DIRECTUS', 'TOKEN'].join('_')

const fetchSpy = vi.fn(async () => ({ data: [] }))
const authorizations = () => (fetchSpy.mock.calls as unknown[][])
  .map(call => (call[1] as { headers?: Record<string, string> } | undefined)?.headers?.Authorization)

beforeEach(() => {
  runtimeConfig.current = { directusUrl: 'http://directus.test' }
  fetchSpy.mockClear()
  vi.stubGlobal('$fetch', fetchSpy)
  // Every test starts from "not supplied", whatever the shell running the suite exports.
  vi.stubEnv('DIRECTUS_TOKEN', undefined)
  vi.stubEnv(FRAMEWORK_OVERRIDE, undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('readDirectusToken — the running process environment, read at call time', () => {
  it('returns what DIRECTUS_TOKEN holds when it is called, not when the module was loaded', () => {
    expect(readDirectusToken()).toBe('')
    vi.stubEnv('DIRECTUS_TOKEN', 'runtime-value-one')
    expect(readDirectusToken()).toBe('runtime-value-one')
    vi.stubEnv('DIRECTUS_TOKEN', 'runtime-value-two')
    expect(readDirectusToken()).toBe('runtime-value-two')
  })

  it('treats an absent and an empty variable alike: not configured', () => {
    expect(readDirectusToken()).toBe('')
    vi.stubEnv('DIRECTUS_TOKEN', '')
    expect(readDirectusToken()).toBe('')
  })

  it('does not accept the framework override name as a second way to supply the secret', () => {
    vi.stubEnv(FRAMEWORK_OVERRIDE, 'framework-override-value')
    expect(readDirectusToken()).toBe('')
  })
})

describe('directusFetch — fails closed without the run-time token', () => {
  it('refuses before any request when DIRECTUS_TOKEN is absent: no anonymous call', async () => {
    await expect(directusFetch('/items/posts')).rejects.toThrow('Directus not configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never falls back to a token carried by runtimeConfig, such as a stale build-time copy', async () => {
    runtimeConfig.current = { directusUrl: 'http://directus.test', directusToken: 'stale-build-time-value' }
    await expect(directusFetch('/items/posts')).rejects.toThrow('Directus not configured')
    expect(fetchSpy).not.toHaveBeenCalled()

    vi.stubEnv('DIRECTUS_TOKEN', 'runtime-value')
    await directusFetch('/items/posts')
    expect(authorizations()).toEqual(['Bearer runtime-value'])
  })

  it('refuses when only the framework override name is set', async () => {
    vi.stubEnv(FRAMEWORK_OVERRIDE, 'framework-override-value')
    await expect(directusFetch('/items/posts')).rejects.toThrow('Directus not configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends the value present when each call is made', async () => {
    vi.stubEnv('DIRECTUS_TOKEN', 'first-runtime-value')
    await directusFetch('/items/posts')
    vi.stubEnv('DIRECTUS_TOKEN', 'second-runtime-value')
    await directusFetch('/items/posts')
    expect(authorizations()).toEqual(['Bearer first-runtime-value', 'Bearer second-runtime-value'])
  })
})

describe('public media proxy — the same run-time token gate', () => {
  const MEDIA_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const event = () => ({ context: { params: { id: MEDIA_ID } }, node: { req: { headers: {}, url: `/api/cms/media/${MEDIA_ID}` }, res: {} } })
  const handler = mediaHandler as unknown as (e: unknown) => Promise<unknown>

  it('answers 503 without DIRECTUS_TOKEN, before it reaches Directus', async () => {
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 503 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('with the run-time token it goes on to Directus, authenticated with that value', async () => {
    vi.stubEnv('DIRECTUS_TOKEN', 'runtime-value')
    // The double answers every lookup with no rows, so the file is "not found": 404, not 503.
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 404 })
    expect(fetchSpy).toHaveBeenCalled()
    expect(new Set(authorizations())).toEqual(new Set(['Bearer runtime-value']))
  })
})
