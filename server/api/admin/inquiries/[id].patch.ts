import { getRouterParam, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { inquiryId, updateAdminInquiry } from '~/server/utils/adminInquiries'
import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = inquiryId(getRouterParam(event, 'id'))
  const body = await readJsonBodyWithByteLimit(event, 32 * 1024)
  return updateAdminInquiry(id, body, <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options))
})
