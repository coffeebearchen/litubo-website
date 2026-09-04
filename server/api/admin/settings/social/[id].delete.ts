import { createError, getRouterParam } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: 'Invalid social link id' })

  await adminFetch(event, `/items/site_social_links/${id}`, { method: 'DELETE' })
  return { ok: true }
})
