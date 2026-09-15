import { defineEventHandler } from 'h3'
import { legacySparePartsFields } from '~/server/utils/legacyInquiryAdapters'
import { handlePublicInquiry } from '~/server/utils/publicInquiry'

/**
 * Legacy `/api/spare-parts`: a narrow compatibility adapter onto the canonical inquiry pipeline
 * (FINAL-RELEASE-FIX-A). No page calls it; Request Spare Parts uses `/api/inquiries`. Nothing is written locally.
 */
export default defineEventHandler(event => handlePublicInquiry(event, legacySparePartsFields))
