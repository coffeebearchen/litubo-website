import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import type { ProductMedia } from '~/types/product-cms'

const JUNCTION_FIELDS = [
  'id', 'products_id', 'file_role',
  'alt_en', 'alt_es', 'alt_pt', 'caption_en', 'caption_es', 'caption_pt',
  'enabled', 'language', 'version_label', 'sort', 'file_date',
  // Nested fields from directus_files via M2O — use dot-notation only (no bare field name)
  // so Directus always returns directus_files_id as an object, never as a raw UUID string.
  'directus_files_id.id',
  'directus_files_id.filename_download',
  'directus_files_id.type',
  'directus_files_id.filesize',
  'directus_files_id.width',
  'directus_files_id.height',
  'directus_files_id.focal_point_x',
  'directus_files_id.focal_point_y',
].join(',')

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  // Directus may return directus_files_id as an object when nested fields are requested
  const result = await adminFetch<{ data: unknown[] }>(
    event,
    `/items/products_files?filter[products_id][_eq]=${id}&fields=${JUNCTION_FIELDS}&sort[]=sort&sort[]=id&limit=200`,
  )

  const rows = (result as { data: unknown[] }).data ?? []

  // Normalize: flatten nested directus_files_id object into flat fields
  const media: ProductMedia[] = rows.map((row: unknown) => {
    const r = row as Record<string, unknown>
    const fileObj = r.directus_files_id as Record<string, unknown> | string | null

    let fileId: string | null = null
    let filename_download: string | null = null
    let type: string | null = null
    let filesize: number | null = null
    let width: number | null = null
    let height: number | null = null
    let focal_point_x: number | null = null
    let focal_point_y: number | null = null

    if (fileObj && typeof fileObj === 'object') {
      fileId = (fileObj.id as string) ?? null
      filename_download = (fileObj.filename_download as string) ?? null
      type = (fileObj.type as string) ?? null
      filesize = (fileObj.filesize as number) ?? null
      width = (fileObj.width as number) ?? null
      height = (fileObj.height as number) ?? null
      focal_point_x = (fileObj.focal_point_x as number) ?? null
      focal_point_y = (fileObj.focal_point_y as number) ?? null
    } else if (typeof fileObj === 'string') {
      fileId = fileObj
    }

    return {
      id: r.id as number,
      products_id: r.products_id as number,
      directus_files_id: fileId,
      file_role: r.file_role as ProductMedia['file_role'],
      alt_en: r.alt_en as string | null,
      alt_es: r.alt_es as string | null,
      alt_pt: r.alt_pt as string | null,
      caption_en: r.caption_en as string | null,
      caption_es: r.caption_es as string | null,
      caption_pt: r.caption_pt as string | null,
      enabled: r.enabled as boolean,
      language: r.language as ProductMedia['language'],
      version_label: r.version_label as string | null,
      sort: r.sort as number | null,
      file_date: r.file_date as string | null,
      filename_download,
      type,
      filesize,
      width,
      height,
      focal_point_x,
      focal_point_y,
    } satisfies ProductMedia
  })

  return media
})
