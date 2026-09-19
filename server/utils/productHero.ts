import type { FetchFn } from './mediaLifecycle'
import { resolvePublicFiles } from './contentPublic'

/**
 * LITUBO-HERO-FIX-01 — the one rule for a product's hero image in public output.
 *
 * The product media editor designates the hero by giving an enabled `products_files` link the role
 * `hero`. `products.hero_image` is the older single-file field and stays the fallback for products
 * that only have that. The product detail and the category listing both pick through
 * `designatedHeroFileId`, so a product never has one hero on its page and another on its card
 * (RELEASE-SAFETY-GATES §3.3).
 *
 * A listing card renders the hero as an image, so `publicHeroFileIds` also applies RSG-06 before a
 * URL is emitted: the designated file must be `is_public` and not archived in the Media Library
 * right now. When it is not, the card has no hero — another file is never substituted, and the id of
 * a private file never reaches public output.
 */

export interface HeroLinkRow {
  id?: number | null
  products_id?: number | null
  directus_files_id: string | null
  file_role: string | null
  sort?: number | null
  enabled?: boolean | null
}

const bySortThenId = (a: HeroLinkRow, b: HeroLinkRow): number =>
  (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || (a.id ?? 0) - (b.id ?? 0)

/** The hero a product designates: its first enabled `hero` link (lowest sort, then lowest id), else `products.hero_image`. */
export function designatedHeroFileId(links: readonly HeroLinkRow[], heroImage: string | null): string | null {
  const hero = links
    .filter(link => link.file_role === 'hero' && link.enabled !== false && typeof link.directus_files_id === 'string' && link.directus_files_id !== '')
    .sort(bySortThenId)[0]
  return hero?.directus_files_id ?? heroImage ?? null
}

/**
 * The public hero file id of each product, for listing cards: its designated hero, kept only when
 * RSG-06 allows it. At most three reads, whatever the number of products; any upstream failure
 * throws, so the caller fails closed instead of guessing.
 */
export async function publicHeroFileIds(
  fetch: FetchFn,
  products: ReadonlyArray<{ id: number, hero_image: string | null }>,
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (products.length === 0) return out

  const res = await fetch<{ data: HeroLinkRow[] }>(
    `/items/products_files?filter[products_id][_in]=${products.map(p => p.id).join(',')}`
    + '&filter[file_role][_eq]=hero&filter[enabled][_eq]=true&fields=id,products_id,directus_files_id,file_role,sort,enabled&limit=-1',
  )
  const linksByProduct = new Map<number, HeroLinkRow[]>()
  for (const link of res.data ?? []) {
    const productId = Number(link.products_id)
    linksByProduct.set(productId, [...(linksByProduct.get(productId) ?? []), link])
  }

  const designated = new Map<number, string>()
  for (const product of products) {
    const fileId = designatedHeroFileId(linksByProduct.get(product.id) ?? [], product.hero_image)
    if (fileId) designated.set(product.id, fileId.toLowerCase())
  }

  const eligible = await resolvePublicFiles(fetch, [...designated.values()])
  for (const [productId, fileId] of designated) {
    if (eligible.has(fileId)) out.set(productId, fileId)
  }
  return out
}
