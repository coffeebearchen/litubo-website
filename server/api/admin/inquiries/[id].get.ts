import { getRouterParam, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getAdminInquiry, inquiryId } from '~/server/utils/adminInquiries'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return getAdminInquiry(inquiryId(getRouterParam(event, 'id')), <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options))
})
