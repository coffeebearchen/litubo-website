import { createError, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'admin_at')
  if (!token) throw createError({ statusCode: 401, message: 'Not authenticated' })

  const config = useRuntimeConfig()

  const me = await $fetch<{
    data: {
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      role: { name: string }
    }
  }>(`${config.directusUrl}/users/me?fields=id,email,first_name,last_name,role.name`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return {
    id: me.data.id,
    email: me.data.email,
    first_name: me.data.first_name,
    last_name: me.data.last_name,
    role: me.data.role?.name ?? null,
  }
})
