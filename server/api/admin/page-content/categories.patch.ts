import { readBody, createError, setHeader } from 'h3'
import { adminFetch } from '~/server/utils/adminDirectusClient'

/**
 * V2-05 — save one existing product category's name, introduction and image.
 *
 * The category is a record with its own lifecycle, so this endpoint only writes the three fields the
 * screen shows. It never creates or deletes a row, never changes the slug (public URLs depend on it)
 * and never changes `status` (publication is a separate, gated decision). Only English is written,
 * because English is the only publicly enabled locale.
 *
 * An empty image clears `hero_image`; the public page then renders without that picture. A non-empty
 * value must be an existing Media Library file id, checked here so a typo cannot store a broken
 * reference.
 */
const MAX = { name: 120, intro: 1200 }
const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!s) return null
  if (s.length > max) throw createError({ statusCode: 400, message: `A field exceeds ${max} characters` })
  return s
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const body = (await readBody(event)) ?? {}
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'A category id is required' })
  }

  // name_en is not nullable in the collection, so an empty name would fail at the database anyway;
  // it is refused here with a message a person can act on.
  const name = text(body.name, MAX.name)
  if (!name) throw createError({ statusCode: 400, message: 'A category name is required' })

  const image = typeof body.heroImage === 'string' ? body.heroImage.trim() : ''
  if (image && !FILE_ID.test(image)) {
    throw createError({ statusCode: 400, message: 'The category image must be a Media Library file id' })
  }

  // Directus answers a PATCH for a missing id without complaint, so existence is proved first with a
  // filtered read — otherwise this endpoint would report success for a category that is not there.
  const found = await adminFetch<{ data?: { id: number }[] }>(
    event,
    `/items/product_categories?filter[id][_eq]=${id}&fields=id&limit=1`,
  )
  if (!Array.isArray(found?.data) || found.data.length === 0) {
    throw createError({ statusCode: 404, message: `Product category ${id} does not exist` })
  }

  const res = await adminFetch<{ data?: { id: number } | null }>(
    event,
    `/items/product_categories/${id}`,
    {
      method: 'PATCH',
      body: {
        name_en: name,
        intro_en: text(body.intro, MAX.intro),
        hero_image: image || null,
      },
    },
  )

  // A write that returns no row did not happen; saying "saved" then would be a lie the editor sees.
  if (res?.data?.id !== id) {
    throw createError({ statusCode: 409, message: 'The category was not updated — reload and try again' })
  }

  return { ok: true, id }
})
