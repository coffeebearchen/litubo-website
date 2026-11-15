// Server-side duplicate guard for product↔media associations (products_files).
// The client already disables an already-linked file in the picker; this is the
// authoritative check so a direct/duplicate POST can never create a second
// products_files row for the same product + file pair.

import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'
import { getLifecycleRecord } from './mediaLifecycle'

const FILE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Use the authenticated administrator's permissions; a failed read must reject the write. */
export async function assertMediaFileLinkable(fileUuid: unknown, fetch: FetchFn): Promise<void> {
  if (typeof fileUuid !== 'string' || !FILE_UUID_RE.test(fileUuid)) {
    throw createError({ statusCode: 400, message: '无效的文件 UUID' })
  }
  const file = await fetch<{ data: { id: string }[] }>(
    `/files?filter[id][_eq]=${fileUuid}&fields=id&limit=1`,
  )
  if (!file.data?.length) throw createError({ statusCode: 404, message: '文件不存在或不可访问' })
  if ((await getLifecycleRecord(fileUuid, fetch))?.archived) {
    throw createError({ statusCode: 409, message: '文件已归档，请先在媒体库恢复后再关联' })
  }
}

interface ExistingLinkRow {
  id: number
}

export async function assertNoDuplicateMediaLink(
  productId: number,
  fileUuid: string,
  fetch: FetchFn,
): Promise<void> {
  const res = await fetch<{ data: ExistingLinkRow[] }>(
    `/items/products_files?filter[products_id][_eq]=${productId}` +
    `&filter[directus_files_id][_eq]=${fileUuid}&fields=id&limit=1`,
  )
  if ((res.data ?? []).length > 0) {
    throw createError({ statusCode: 409, message: '该文件已关联到此产品，不能重复关联' })
  }
}
