import { describe, expect, it, vi } from 'vitest'
import { getAdminInquiry, inquiryId, listAdminInquiries, updateAdminInquiry } from '../server/utils/adminInquiries'

describe('inquiry operator workflow', () => {
  it('paginates and validates filters without accepting arbitrary Directus fields', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [], meta: { filter_count: 30 } })
    expect(await listAdminInquiries({ page: '2', status: 'new', fields: '*' }, fetch)).toMatchObject({ page: 2, total: 30, pageSize: 25 })
    const params = new URL(fetch.mock.calls[0][0], 'http://isolated.test').searchParams
    expect(params.get('filter[status][_eq]')).toBe('new')
    expect(params.get('fields')).not.toBe('*')
    await expect(listAdminInquiries({ status: 'invalid' }, fetch)).rejects.toMatchObject({ statusCode: 400 })
    await expect(listAdminInquiries({ page: '-1' }, fetch)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('reports a missing inquiry and refuses invalid ids', async () => {
    await expect(getAdminInquiry(42, vi.fn().mockResolvedValue({ data: [] }))).rejects.toMatchObject({ statusCode: 404 })
    for (const id of ['0', '-1', '1.5', '1/filter', undefined]) expect(() => inquiryId(id)).toThrow()
    expect(inquiryId('42')).toBe(42)
  })

  it('updates only follow-up fields and records the first handling time', async () => {
    const fetch = vi.fn().mockResolvedValue({ data: [{ id: 4, status: 'new', first_handled_at: null }] })
    await updateAdminInquiry(4, { status: 'in_progress', note: '  Ask about belt width.  ' }, fetch)
    expect(fetch.mock.calls[1]).toEqual(['/items/inquiries/4', { method: 'PATCH', body: { status: 'in_progress', note: 'Ask about belt width.', first_handled_at: expect.any(String) } }])
    expect(fetch.mock.calls).toHaveLength(3)
  })

  it('does not allow changing customer data, CRM state or arbitrary payload keys', async () => {
    const fetch = vi.fn()
    await expect(updateAdminInquiry(4, { status: 'resolved', note: '', contact_email: 'changed@example.test' }, fetch)).rejects.toMatchObject({ statusCode: 400 })
    await expect(updateAdminInquiry(4, { status: 'resolved', note: 'a'.repeat(8001) }, fetch)).rejects.toMatchObject({ statusCode: 400 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
