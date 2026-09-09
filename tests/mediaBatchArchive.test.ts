/**
 * ML-CLOUD-02 — Batch Archive.
 *
 * The single-file Archive endpoint refuses to archive a file a product still
 * points at. Batching that action is only about saving clicks, so the batch
 * must apply the SAME protection per file — a batch that quietly relaxed the
 * rule the single action enforces would be the one way to lose a referenced
 * asset. These tests drive the real handler against a stubbed Directus and
 * assert exactly that, plus the reporting a partial batch has to produce.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The handler imports `readBody` from h3 directly, so it cannot be stubbed as
 * a global. Only that one function is replaced — `createError` stays real, so
 * the status codes asserted below are the ones the endpoint actually throws.
 */
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual, readBody: async (event: { body: unknown }) => event.body }
})

const FILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const FILE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

interface DirectusState {
  /** Files that exist. */
  files: Set<string>
  /** file id → number of product references. */
  references: Record<string, number>
  /** file id → existing lifecycle row. */
  lifecycle: Record<string, { id: string, archived: boolean }>
  /** File ids that should make the reference lookup throw. */
  refsFail: Set<string>
}

let state: DirectusState
let writes: Array<{ url: string, body: unknown }>

function installNitroGlobals() {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useRuntimeConfig', () => ({ directusUrl: 'http://directus.test' }))
  vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: Record<string, unknown>) => {
    const method = String(options?.method ?? 'GET').toUpperCase()
    if (method !== 'GET') {
      writes.push({ url, body: options?.body })
      if (url.includes('/items/media_file_lifecycle')) return { data: { id: 'new-row' } }
      return { data: {} }
    }

    if (url.includes('/users/me')) return { data: { email: 'dev@litubo.com' } }

    if (url.includes('/files?filter[id][_eq]=')) {
      const id = url.split('filter[id][_eq]=')[1].split('&')[0]
      return { data: state.files.has(id) ? [{ id }] : [] }
    }

    if (url.includes('/items/media_file_lifecycle')) {
      const id = url.split('filter[file_id][_eq]=')[1].split('&')[0]
      const row = state.lifecycle[id]
      return { data: row ? [{ ...row, archived_at: null }] : [] }
    }

    if (url.includes('/items/products_files')) {
      const id = url.split('filter[directus_files_id][_eq]=')[1].split('&')[0]
      if (state.refsFail.has(id)) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
      const count = state.references[id] ?? 0
      return {
        data: Array.from({ length: count }, (_, i) => ({
          id: i + 1, file_role: 'hero', products_id: { id: 7, name_en: 'Product Seven' },
        })),
      }
    }

    if (url.includes('/items/product_sections')) return { data: [], meta: { filter_count: 0 } }
    if (url.includes('/items/product_source_records')) return { data: [] }

    return { data: [] }
  }))
}

type BatchResult = {
  archived: number
  skipped: number
  results: Array<{ id: string, outcome: string, reference_total?: number }>
}

async function runBatch(fileIds: unknown): Promise<BatchResult> {
  const handler = (await import('../server/api/admin/media/batch-archive.post'))
    .default as unknown as (event: unknown) => Promise<BatchResult>
  return handler({ body: { file_ids: fileIds }, context: { adminToken: 'tok' } })
}

async function statusCodeOf(run: () => Promise<unknown>): Promise<number | 'no-error'> {
  try {
    await run()
    return 'no-error'
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1
  }
}

beforeEach(() => {
  state = {
    files: new Set([FILE_A, FILE_B, FILE_C]),
    references: {},
    lifecycle: {},
    refsFail: new Set(),
  }
  writes = []
  vi.resetModules()
  installNitroGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('batch archive applies the single-file reference protection to every file', () => {
  it('archives files nothing references', async () => {
    const res = await runBatch([FILE_A, FILE_B])
    expect(res.archived).toBe(2)
    expect(res.results.map(r => r.outcome)).toEqual(['archived', 'archived'])
    expect(writes).toHaveLength(2)
  })

  it('refuses a referenced file and writes nothing for it', async () => {
    state.references[FILE_A] = 2
    const res = await runBatch([FILE_A])

    expect(res.archived).toBe(0)
    expect(res.results[0].outcome).toBe('referenced')
    expect(res.results[0].reference_total).toBe(2)
    expect(writes).toHaveLength(0)
  })

  it('archives the unreferenced files and keeps the referenced one — one refusal does not stop the batch', async () => {
    state.references[FILE_B] = 1
    const res = await runBatch([FILE_A, FILE_B, FILE_C])

    expect(res.archived).toBe(2)
    expect(res.skipped).toBe(1)
    expect(res.results).toEqual([
      { id: FILE_A, outcome: 'archived' },
      { id: FILE_B, outcome: 'referenced', reference_total: 1, message: expect.any(String) },
      { id: FILE_C, outcome: 'archived' },
    ])
    expect(writes).toHaveLength(2)
  })

  it('reports an already archived file instead of archiving it twice', async () => {
    state.lifecycle[FILE_A] = { id: 'row-1', archived: true }
    const res = await runBatch([FILE_A])

    expect(res.results[0].outcome).toBe('already-archived')
    expect(writes).toHaveLength(0)
  })

  it('reuses an existing lifecycle row rather than creating a second one', async () => {
    state.lifecycle[FILE_A] = { id: 'row-1', archived: false }
    await runBatch([FILE_A])

    expect(writes).toHaveLength(1)
    expect(writes[0].url).toContain('/items/media_file_lifecycle/row-1')
  })

  it('reports a file that does not exist without touching the rest', async () => {
    state.files.delete(FILE_B)
    const res = await runBatch([FILE_A, FILE_B])

    expect(res.results.map(r => r.outcome)).toEqual(['archived', 'not-found'])
    expect(res.archived).toBe(1)
  })

  /**
   * If the reference lookup fails we do not know whether the file is in use.
   * Archiving on "we could not check" is the failure mode this protection
   * exists to prevent, so the file is reported as failed and left alone.
   */
  it('does not archive a file whose reference check failed', async () => {
    state.refsFail.add(FILE_A)
    const res = await runBatch([FILE_A, FILE_B])

    expect(res.results[0].outcome).toBe('failed')
    expect(res.results[1].outcome).toBe('archived')
    expect(writes).toHaveLength(1)
  })

  it('never deletes anything — every write goes to the lifecycle collection', async () => {
    await runBatch([FILE_A, FILE_B, FILE_C])
    expect(writes.every(w => w.url.includes('/items/media_file_lifecycle'))).toBe(true)
    expect(writes.every(w => (w.body as { archived?: boolean }).archived === true)).toBe(true)
  })
})

describe('batch archive input validation', () => {
  it.each([
    ['an empty array', []],
    ['not an array', 'all'],
    ['a non-UUID entry', ['not-a-uuid']],
    ['a batch over the cap', Array.from({ length: 101 }, () => FILE_A)],
  ])('rejects %s with 400', async (_label, input) => {
    expect(await statusCodeOf(() => runBatch(input))).toBe(400)
  })
})
