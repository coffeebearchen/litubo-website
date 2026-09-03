import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import { useRuntimeConfig } from '#imports'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FileMeta {
  id: string
  filename_download: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  focal_point_x: number | null
  focal_point_y: number | null
}

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid') ?? ''
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const token = getAdminToken(event)
  const config = useRuntimeConfig()

  const result = await $fetch<{ data: FileMeta }>(
    `${config.directusUrl}/files/${uuid}?fields=id,filename_download,type,filesize,width,height,focal_point_x,focal_point_y`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).catch(() => null)

  if (!result?.data) throw createError({ statusCode: 404, message: '文件不存在' })
  return result.data
})
