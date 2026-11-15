import { readJsonBodyWithByteLimit } from '~/server/utils/requestBodyLimit'
import { answerVisitorQuestion, assertVisitorAssistantRequest, VISITOR_ASSISTANT_BODY_MAX_BYTES } from '~/server/utils/visitorAssistant'

export default defineEventHandler(async (event) => {
  const body = await readJsonBodyWithByteLimit<{ question?: unknown }>(event, VISITOR_ASSISTANT_BODY_MAX_BYTES)
  const question = assertVisitorAssistantRequest(event, body?.question)
  return answerVisitorQuestion(event, question)
})
