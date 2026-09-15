import { defineEventHandler } from 'h3'
import { canonicalInquiryFields, handlePublicInquiry } from '~/server/utils/publicInquiry'

/**
 * The unified public inquiry endpoint used by the six Phase 6 form pages. The whole pipeline —
 * body limit, rate limit, honeypot, consent, allowlist, Directus write — is shared with the legacy
 * adapters and lives in `server/utils/publicInquiry.ts`.
 */
export default defineEventHandler(event => handlePublicInquiry(event, canonicalInquiryFields))
