import { adminFetch } from '~/server/utils/adminDirectusClient'

interface LifecycleRecord {
  id: string
  file_id: string
  archived: boolean
  archived_at: string | null
  archived_by: string | null
}

export default defineEventHandler(async (event) => {
  const res = await adminFetch<{ data: LifecycleRecord[] }>(
    event,
    '/items/media_file_lifecycle?filter[archived][_eq]=true&fields=id,file_id,archived,archived_at,archived_by&limit=500',
  )
  return { data: res.data ?? [] }
})
