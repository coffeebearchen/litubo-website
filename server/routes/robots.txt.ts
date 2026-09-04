import { defineEventHandler, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')

  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join('\n')
})
