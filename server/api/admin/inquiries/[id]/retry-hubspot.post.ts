import { getRouterParam, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { getAdminInquiry, hubspotInputFromInquiry, inquiryId } from '~/server/utils/adminInquiries'
import { syncHubspot } from '~/server/utils/syncHubspot'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = inquiryId(getRouterParam(event, 'id'))
  const fetch = <T>(path: string, options?: Record<string, unknown>) => adminFetch<T>(event, path, options)
  const inquiry = await getAdminInquiry(id, fetch)

  // HubSpot upserts by email, so retrying does not create a second contact.
  // Customer messages remain internal and no customer reply is sent here.
  await syncHubspot(id, hubspotInputFromInquiry(inquiry))
  return getAdminInquiry(id, fetch)
})
