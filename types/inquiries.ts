import type { HubspotSyncStatus, InquiryStatus, InquiryType } from './content'

export const INQUIRY_STATUSES: InquiryStatus[] = ['new', 'in_progress', 'resolved', 'spam']
export const INQUIRY_TYPES: InquiryType[] = ['contact', 'technical_matching', 'distributor', 'spare_parts', 'support_request', 'send_product_test']

export interface AdminInquiry {
  id: number
  status: InquiryStatus
  inquiry_type: InquiryType
  submitted_at: string | null
  updated_at: string | null
  first_handled_at: string | null
  contact_name: string | null
  contact_email: string
  contact_company: string | null
  contact_country: string | null
  contact_phone: string | null
  message: string | null
  locale: string
  note: string | null
  model_number: string | null
  serial_number: string | null
  related_product_slug: string | null
  source_url: string | null
  hubspot_sync_status: HubspotSyncStatus
  hubspot_error_summary: string | null
  raw_fields: Record<string, string> | null
}

export interface AdminInquiriesResult {
  inquiries: AdminInquiry[]
  total: number
  page: number
  pageSize: number
}
