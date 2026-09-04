import { getQuery } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

const MAX_LIMIT = 200
const FIELDS = [
  'id', 'filename_disk', 'filename_download', 'title', 'description',
  'type', 'filesize', 'width', 'height', 'folder',
  'uploaded_on', 'focal_point_x', 'focal_point_y',
].join(',')

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit ?? 100)))
  const offset = Math.max(0, Number(q.offset ?? 0))

  const parts: string[] = [
    `fields=${FIELDS}`,
    `limit=${limit}`,
    `offset=${offset}`,
    `sort[]=-uploaded_on`,
    `meta=total_count,filter_count`,
  ]

  if (q.folder === 'root') {
    parts.push('filter[folder][_null]=true')
  } else if (q.folder) {
    parts.push(`filter[folder][_eq]=${encodeURIComponent(String(q.folder))}`)
  }

  if (q.type === 'image') {
    parts.push('filter[type][_starts_with]=image/')
  } else if (q.type === 'pdf') {
    parts.push('filter[type][_eq]=application/pdf')
  }

  if (q.search) {
    parts.push(`search=${encodeURIComponent(String(q.search).slice(0, 100))}`)
  }

  return adminFetch(event, `/files?${parts.join('&')}`)
})
