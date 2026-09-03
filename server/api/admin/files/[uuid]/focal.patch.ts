import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { getAdminToken } from '~/server/utils/adminDirectusClient'
import { useRuntimeConfig } from '#imports'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid') ?? ''
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, message: '无效的文件 UUID' })

  const body = await readBody(event)
  const x = Number(body.focal_point_x)
  const y = Number(body.focal_point_y)
  if (isNaN(x) || isNaN(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    throw createError({ statusCode: 400, message: 'focal_point_x/y 必须在 0–100 之间' })
  }

  const token = getAdminToken(event)
  const config = useRuntimeConfig()

  const result = await $fetch<{ data: { id: string } }>(
    `${config.directusUrl}/files/${uuid}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ focal_point_x: x, focal_point_y: y }),
    },
  ).catch((e: unknown) => { throw createError({ statusCode: 500, message: String((e as Error).message) }) })

  return result.data
})
