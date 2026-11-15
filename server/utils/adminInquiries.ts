import { createError } from 'h3'
import { INQUIRY_STATUSES, INQUIRY_TYPES } from '../../types/inquiries'
import type { AdminInquiry, AdminInquiriesResult } from '../../types/inquiries'
import type { FetchFn } from './mediaLifecycle'

const FIELDS = 'id,status,inquiry_type,submitted_at,updated_at,first_handled_at,contact_name,contact_email,contact_company,contact_country,contact_phone,message,locale,note,model_number,serial_number,related_product_slug,source_url,hubspot_sync_status,hubspot_error_summary,raw_fields'

export function inquiryId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw createError({ statusCode: 400, message: 'Invalid inquiry ID' })
  return Number(value)
}

export async function listAdminInquiries(query: Record<string, unknown>, fetch: FetchFn): Promise<AdminInquiriesResult> {
  const page = query.page === undefined ? 1 : Number(query.page)
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw createError({ statusCode: 400, message: 'Invalid page' })
  const params = new URLSearchParams({ fields: FIELDS, limit: '25', page: String(page), sort: '-submitted_at,-id', meta: 'filter_count' })
  if (query.status) {
    if (!INQUIRY_STATUSES.includes(query.status as AdminInquiry['status'])) throw createError({ statusCode: 400, message: 'Invalid status' })
    params.set('filter[status][_eq]', String(query.status))
  }
  if (query.type) {
    if (!INQUIRY_TYPES.includes(query.type as AdminInquiry['inquiry_type'])) throw createError({ statusCode: 400, message: 'Invalid inquiry type' })
    params.set('filter[inquiry_type][_eq]', String(query.type))
  }
  const result = await fetch<{ data: AdminInquiry[]; meta?: { filter_count?: number } }>(`/items/inquiries?${params}`)
  return { inquiries: result.data, total: result.meta?.filter_count ?? result.data.length, page, pageSize: 25 }
}

export async function getAdminInquiry(id: number, fetch: FetchFn): Promise<AdminInquiry> {
  const result = await fetch<{ data: AdminInquiry[] }>(`/items/inquiries?filter[id][_eq]=${id}&fields=${FIELDS}&limit=1`)
  if (!result.data?.length) throw createError({ statusCode: 404, message: 'Inquiry not found' })
  return result.data[0]
}

export async function updateAdminInquiry(id: number, body: unknown, fetch: FetchFn): Promise<AdminInquiry> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, message: 'Invalid update' })
  const input = body as Record<string, unknown>
  if (Object.keys(input).some(key => !['status', 'note'].includes(key))) throw createError({ statusCode: 400, message: 'Only status and internal note can be changed' })
  if (!INQUIRY_STATUSES.includes(input.status as AdminInquiry['status']) || typeof input.note !== 'string' || input.note.length > 8000) throw createError({ statusCode: 400, message: 'Choose a valid status and keep notes within 8,000 characters' })
  const current = await getAdminInquiry(id, fetch)
  const payload: Record<string, unknown> = { status: input.status, note: input.note.trim() || null }
  if (!current.first_handled_at && input.status !== 'new') payload.first_handled_at = new Date().toISOString()
  await fetch(`/items/inquiries/${id}`, { method: 'PATCH', body: payload })
  return getAdminInquiry(id, fetch)
}
