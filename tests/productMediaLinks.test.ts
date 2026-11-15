import { describe, it, expect, vi } from 'vitest'
import { assertNoDuplicateMediaLink, assertMediaFileLinkable } from '../server/utils/productMediaLinks'

const PRODUCT_ID = 3
const FILE_UUID = '22222222-2222-2222-2222-222222222222'

describe('media eligibility before creating a product association', () => {
  it('allows an existing private file without publishing it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ data: [{ id: FILE_UUID }] }).mockResolvedValueOnce({ data: [] })
    await expect(assertMediaFileLinkable(FILE_UUID, fetch)).resolves.toBeUndefined()
    expect(fetch.mock.calls.every(call => call.length === 1)).toBe(true)
  })

  it('rejects malformed ids without any request', async () => {
    const fetch = vi.fn()
    for (const id of [null, {}, '../files', 'not-a-uuid']) {
      await expect(assertMediaFileLinkable(id, fetch)).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects missing files and archived files', async () => {
    await expect(assertMediaFileLinkable(FILE_UUID, vi.fn().mockResolvedValue({ data: [] })))
      .rejects.toMatchObject({ statusCode: 404 })
    const fetch = vi.fn().mockResolvedValueOnce({ data: [{ id: FILE_UUID }] })
      .mockResolvedValueOnce({ data: [{ id: 'lifecycle', archived: true }] })
    await expect(assertMediaFileLinkable(FILE_UUID, fetch)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not turn a failed lifecycle read into permission to link', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ data: [{ id: FILE_UUID }] })
      .mockRejectedValueOnce(Object.assign(new Error('forbidden'), { statusCode: 403 }))
    await expect(assertMediaFileLinkable(FILE_UUID, fetch)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('assertNoDuplicateMediaLink (server-side duplicate guard)', () => {
  it('resolves without throwing when no existing link is found', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await expect(assertNoDuplicateMediaLink(PRODUCT_ID, FILE_UUID, fetch)).resolves.toBeUndefined()
  })

  it('queries products_files scoped to both the product id and the file uuid', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await assertNoDuplicateMediaLink(PRODUCT_ID, FILE_UUID, fetch)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`filter[products_id][_eq]=${PRODUCT_ID}`),
    )
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`filter[directus_files_id][_eq]=${FILE_UUID}`),
    )
  })

  it('throws a 409 when the file is already linked to this product — the direct-repeat-POST case', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [{ id: 42 }] })
    await expect(assertNoDuplicateMediaLink(PRODUCT_ID, FILE_UUID, fetch))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('never lets a second call through even when called twice in a row with the same arguments (simulated repeat POST)', async () => {
    // First POST would have created the row; the second POST's duplicate check sees it.
    const fetch = vi.fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 42 }] })

    await expect(assertNoDuplicateMediaLink(PRODUCT_ID, FILE_UUID, fetch)).resolves.toBeUndefined()
    await expect(assertNoDuplicateMediaLink(PRODUCT_ID, FILE_UUID, fetch)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not flag the same file linked to a different product as a duplicate (scoped per-product, per-file query)', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [] })
    await assertNoDuplicateMediaLink(99, FILE_UUID, fetch)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('filter[products_id][_eq]=99'))
  })
})
