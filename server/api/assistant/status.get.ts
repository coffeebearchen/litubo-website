import { setResponseHeader } from 'h3'
import { visitorAssistantStatus } from '~/server/utils/visitorAssistant'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const status = visitorAssistantStatus(useRuntimeConfig())
  return { available: status.enabled && status.configured }
})
