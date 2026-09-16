import { getRouterParam, readBody, createError } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'
import { assertProductDraftForMutation } from '~/server/utils/productLifecycle'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductDraftForMutation(event, Number(id))

  const body = await readBody(event)
  if (!body.question_en?.trim()) throw createError({ statusCode: 400, message: '问题（EN）为必填项' })
  if (!body.answer_en?.trim()) throw createError({ statusCode: 400, message: '答案（EN）为必填项' })

  const payload = {
    product_id: Number(id),
    question_en: body.question_en,
    question_es: body.question_es ?? null,
    question_pt: body.question_pt ?? null,
    answer_en: body.answer_en,
    answer_es: body.answer_es ?? null,
    answer_pt: body.answer_pt ?? null,
    source_note: body.source_note ?? null,
    enabled: body.enabled !== false,
    sort: body.sort ?? null,
  }

  const result = await adminFetch<{ data: unknown }>(event, '/items/product_faqs', {
    method: 'POST', body: payload,
  })
  return (result as { data: unknown }).data
})
