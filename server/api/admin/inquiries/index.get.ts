import { getQuery, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { listAdminInquiries } from '~/server/utils/adminInquiries'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return listAdminInquiries(getQuery(event), <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options))
})
