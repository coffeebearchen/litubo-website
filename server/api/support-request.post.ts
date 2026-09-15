import { defineEventHandler } from 'h3'
import { legacySupportRequestFields } from '~/server/utils/legacyInquiryAdapters'
import { handlePublicInquiry } from '~/server/utils/publicInquiry'

/**
 * Legacy `/api/support-request`: a narrow compatibility adapter onto the canonical inquiry pipeline
 * (FINAL-RELEASE-FIX-A). No page calls it; support pages use `/api/inquiries`. Nothing is written locally.
 */
export default defineEventHandler(event => handlePublicInquiry(event, legacySupportRequestFields))
