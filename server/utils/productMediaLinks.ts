// Server-side duplicate guard for product↔media associations (products_files).
// The client already disables an already-linked file in the picker; this is the
// authoritative check so a direct/duplicate POST can never create a second
// products_files row for the same product + file pair.

import { createError } from 'h3'
import type { FetchFn } from './mediaLifecycle'

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
