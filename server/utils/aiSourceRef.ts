import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-02 — opaque references to a product's source
 * files, used in place of Directus ids in anything the browser can see.
 *
 * The AI Source Intake screen previously read the general media endpoint, so
 * the browser received `directus_files_id` (a real storage UUID),
 * `filename_download`, `caption_en` and `alt_en` for every file, and Generate
 * accepted raw `products_files.id` values back. That is more of the content
 * store than this screen needs, and it makes the client's ids meaningful
 * elsewhere in the system.
 *
 * A source ref instead:
 *
 *  - **is not reversible.** The payload is ENCRYPTED, not merely signed. An
 *    earlier version signed a base64url payload, which meant anyone could
 *    decode the ref and read the association id and the administrator's user
 *    id straight out of it — signing prevents forgery, not reading. With
 *    AES-256-GCM the ref is ciphertext: it reveals nothing and cannot be
 *    altered undetected.
 *  - **is bound to one admin and one product.** A ref minted for product 3 and
 *    admin A fails verification for product 4 or admin B, so a ref cannot be
 *    replayed across products or between accounts.
 *  - **expires.** Refs are valid for `SOURCE_REF_TTL_MS`, so a captured ref
 *    stops working shortly after the session that produced it.
 *
 * The key is generated per process at startup and never leaves it: it is not
 * read from, and cannot leak into, configuration or `.env`. A server restart
 * therefore invalidates outstanding refs, which is the fail-closed direction —
 * the browser simply reloads the list and gets fresh ones.
 */

/** How long a minted ref stays valid. Long enough to browse and analyze, short enough that a captured ref dies quickly. */
export const SOURCE_REF_TTL_MS = 30 * 60 * 1000

/**
 * Per-process encryption key. Deliberately not configurable: there is no
 * operational reason to share it between processes, and a key that lives only
 * in memory cannot be committed, logged, or read out of the environment.
 */
const REF_KEY = randomBytes(32)

interface SourceRefPayload {
  /** `products_files.id` — the association row, never a Directus file UUID. */
  m: number
  /** Product this ref was minted for. */
  p: number
  /** Admin user this ref was minted for. */
  u: string
  /** Expiry, epoch milliseconds. */
  e: number
}

/** AES-256-GCM: the payload is unreadable, and any modification fails the auth tag on decrypt. */
function seal(payload: SourceRefPayload): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', REF_KEY, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${body.toString('base64url')}.${tag.toString('base64url')}`
}

/** Returns the payload, or null for anything malformed, truncated, or tampered with. */
function open(ref: string): SourceRefPayload | null {
  const parts = ref.split('.')
  if (parts.length !== 3) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', REF_KEY, Buffer.from(parts[0], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[1], 'base64url')), decipher.final()])
    return JSON.parse(plain.toString('utf8')) as SourceRefPayload
  } catch {
    // A wrong key, a wrong IV, a truncated body, or a failed auth tag all land
    // here. The caller learns only that the ref is unusable.
    return null
  }
}

export interface SourceRefBinding {
  productId: number
  adminUserId: string
}

/** Mints an opaque ref for one association row, bound to this admin and product. */
export function createSourceRef(mediaId: number, binding: SourceRefBinding, now = Date.now()): string {
  const payload: SourceRefPayload = {
    m: mediaId,
    p: binding.productId,
    u: binding.adminUserId,
    e: now + SOURCE_REF_TTL_MS,
  }
  return seal(payload)
}

/**
 * Returns the `products_files.id` a ref stands for, or null if the ref is
 * malformed, tampered with, expired, or was minted for a different admin or
 * product. Never throws, and never reports which check failed — a caller
 * cannot use the failure reason to probe for valid ids.
 */
export function resolveSourceRef(ref: unknown, binding: SourceRefBinding, now = Date.now()): number | null {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 512) return null

  const payload = open(ref)
  if (!payload) return null

  if (typeof payload?.m !== 'number' || !Number.isInteger(payload.m) || payload.m <= 0) return null
  if (payload.p !== binding.productId) return null
  if (payload.u !== binding.adminUserId) return null
  if (typeof payload.e !== 'number' || payload.e <= now) return null

  return payload.m
}

/** Resolves a list of refs, returning null if ANY of them fails — a partially valid request is refused outright. */
export function resolveSourceRefs(refs: unknown, binding: SourceRefBinding, maxCount: number, now = Date.now()): number[] | null {
  if (!Array.isArray(refs) || refs.length === 0 || refs.length > maxCount) return null
  const mediaIds: number[] = []
  for (const ref of refs) {
    const mediaId = resolveSourceRef(ref, binding, now)
    if (mediaId === null) return null
    if (!mediaIds.includes(mediaId)) mediaIds.push(mediaId)
  }
  return mediaIds
}
