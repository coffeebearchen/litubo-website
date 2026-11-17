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
  /**
   * V2-06 — what a person confirmed from an AI proposal, or null when nothing was confirmed yet.
   * `ai_reviewed` is true only for a confirmed result; it is not an audit history and not a claim that
   * the content is correct. `ai_confidence` stays null: this scope has no calibrated basis for one.
   */
  ai_summary: string | null
  ai_intent: string | null
  ai_confidence: number | null
  ai_processed_at: string | null
  ai_reviewed: boolean
}

export interface AdminInquiriesResult {
  inquiries: AdminInquiry[]
  total: number
  page: number
  pageSize: number
}
