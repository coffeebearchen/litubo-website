import { defineEventHandler } from 'h3'
import { legacyContactFields } from '~/server/utils/legacyInquiryAdapters'
import { handlePublicInquiry } from '~/server/utils/publicInquiry'

/**
 * Legacy `/api/contact`: a narrow compatibility adapter onto the canonical inquiry pipeline
 * (FINAL-RELEASE-FIX-A). Its one caller is the Become a Partner page. Nothing is written locally.
 */
export default defineEventHandler(event => handlePublicInquiry(event, legacyContactFields))
