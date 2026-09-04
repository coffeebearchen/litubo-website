import { describe, it, expect, vi } from 'vitest'
import {
  getFileReferences,
  getLifecycleRecord,
  createOrUpdateLifecycleArchive,
  restoreLifecycleRecord,
} from '../server/utils/mediaLifecycle'

const TEST_UUID = '11111111-1111-1111-1111-111111111111'

// ── getFileReferences ─────────────────────────────────────────────────────────

describe('getFileReferences', () => {
  it('returns can_archive:true and empty references when no junction rows', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    const result = await getFileReferences(TEST_UUID, fetch)

    expect(result.total).toBe(0)
    expect(result.can_archive).toBe(true)
    expect(result.references).toHaveLength(0)
    expect(result.product_count).toBe(0)
    expect(result.section_count).toBe(0)
    // Only products_files queried (no section query when no junction rows)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns can_archive:false when products_files references exist', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        data: [
          { id: 10, file_role: 'hero', products_id: { id: 3, name: 'Product Alpha' } },
          { id: 11, file_role: 'gallery', products_id: { id: 3, name: 'Product Alpha' } },
        ],
      })
      .mockResolvedValueOnce({ data: [], meta: { filter_count: 0 } }) // product_sections

    const result = await getFileReferences(TEST_UUID, fetch)

    expect(result.can_archive).toBe(false)
    expect(result.total).toBe(2)
    expect(result.product_count).toBe(1) // same product
    expect(result.section_count).toBe(0)
    expect(result.references).toHaveLength(2)
    expect(result.references[0]).toMatchObject({ product_id: 3, file_role: 'hero' })
  })

  it('counts section references separately via junction IDs', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: 42, file_role: 'brochure', products_id: { id: 5, name: 'Product Beta' } }],
      })
      .mockResolvedValueOnce({ data: [{ id: 99 }], meta: { filter_count: 1 } })

    const result = await getFileReferences(TEST_UUID, fetch)

    expect(result.total).toBe(2) // 1 junction + 1 section
    expect(result.section_count).toBe(1)
    expect(result.can_archive).toBe(false)
    // Section query uses the junction ID list
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('filter[media_id][_in]=42'),
    )
  })

  it('skips junction rows with null products_id', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: 20, file_role: 'hero', products_id: null }],
      })
      .mockResolvedValueOnce({ data: [], meta: { filter_count: 0 } })

    const result = await getFileReferences(TEST_UUID, fetch)

    expect(result.product_count).toBe(0)
    expect(result.references).toHaveLength(0)
    expect(result.total).toBe(1) // junction row still counts
    expect(result.can_archive).toBe(false)
  })
})

// ── getLifecycleRecord ────────────────────────────────────────────────────────

describe('getLifecycleRecord', () => {
  it('returns null when no record exists', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    const record = await getLifecycleRecord(TEST_UUID, fetch)
    expect(record).toBeNull()
  })

  it('returns the lifecycle record when found', async () => {
    const mockRecord = { id: 'abc', archived: true, archived_at: '2026-09-04T12:00:00Z' }
    const fetch = vi.fn().mockResolvedValue({ data: [mockRecord] })
    const record = await getLifecycleRecord(TEST_UUID, fetch)
    expect(record).toMatchObject(mockRecord)
  })
})

// ── createOrUpdateLifecycleArchive ───────────────────────────────────────────

describe('createOrUpdateLifecycleArchive', () => {
  it('creates a new record (POST) when no existing record', async () => {
    const fetch = vi.fn().mockResolvedValue({})
    await createOrUpdateLifecycleArchive(TEST_UUID, 'admin@test.com', null, fetch)

    expect(fetch).toHaveBeenCalledOnce()
    const [path, opts] = fetch.mock.calls[0]
    expect(path).toBe('/items/media_file_lifecycle')
    expect((opts as { method: string }).method).toBe('POST')
    const body = (opts as { body: Record<string, unknown> }).body
    expect(body.file_id).toBe(TEST_UUID)
    expect(body.archived).toBe(true)
    expect(body.archived_by).toBe('admin@test.com')
    expect(typeof body.archived_at).toBe('string')
  })

  it('updates existing record (PATCH) when record already exists', async () => {
    const existing = { id: 'rec-1', archived: false, archived_at: null }
    const fetch = vi.fn().mockResolvedValue({})
    await createOrUpdateLifecycleArchive(TEST_UUID, 'admin@test.com', existing, fetch)

    const [path, opts] = fetch.mock.calls[0]
    expect(path).toBe('/items/media_file_lifecycle/rec-1')
    expect((opts as { method: string }).method).toBe('PATCH')
    const body = (opts as { body: Record<string, unknown> }).body
    expect(body.archived).toBe(true)
    expect(body.restored_at).toBeNull()
  })
})

// ── restoreLifecycleRecord ────────────────────────────────────────────────────

describe('restoreLifecycleRecord', () => {
  it('PATCHes the record with archived:false and restored metadata', async () => {
    const record = { id: 'rec-2', archived: true, archived_at: '2026-09-01T00:00:00Z' }
    const fetch = vi.fn().mockResolvedValue({})
    const restoredAt = await restoreLifecycleRecord(record, 'admin@test.com', fetch)

    expect(typeof restoredAt).toBe('string')
    const [path, opts] = fetch.mock.calls[0]
    expect(path).toBe('/items/media_file_lifecycle/rec-2')
    const body = (opts as { body: Record<string, unknown> }).body
    expect(body.archived).toBe(false)
    expect(body.restored_by).toBe('admin@test.com')
    expect(body.restored_at).toBe(restoredAt)
  })
})
