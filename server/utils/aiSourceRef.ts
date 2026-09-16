import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { subjectKeyOf, type AiSubjectBinding } from './aiSubject'
import { readDirectusToken } from './directusServiceToken'

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
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03 — the key is DERIVED, not random per
 * process. A per-process random key meant every restart, and every additional
 * worker, invalidated refs another instance had just minted: correct-but-
 * useless behaviour that would surface as spurious "this selection is no
 * longer valid" errors the moment the app ran as more than one process.
 *
 * It is derived with HKDF-SHA256 from `DIRECTUS_TOKEN` — an existing,
 * server-only secret — under a fixed salt and info string, so the derived key
 * is specific to this purpose and cannot be used to recover the secret or
 * interchanged with any other derived key. The secret itself is never logged,
 * returned, or exposed; only the derived key exists in memory. No new
 * environment variable is introduced.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03-MIN-01 — `DIRECTUS_TOKEN` is not assumed to
 * be present. When it is not configured, this module mints and resolves
 * nothing and raises `SourceRefUnavailableError`, which the endpoints answer
 * with 503. That is a deliberate fail-closed path, not a fallback: no raw
 * Directus id is ever accepted in a ref's place.
 *
 * FINAL-RELEASE-PRODUCTION-READY-01C — the secret is read through
 * `readDirectusToken()`, from the environment of the running server, and no
 * longer through `runtimeConfig`, which `nuxt build` serializes into the build
 * artifact.
 */

/** How long a minted ref stays valid. Long enough to browse and analyze, short enough that a captured ref dies quickly. */
export const SOURCE_REF_TTL_MS = 30 * 60 * 1000

/** Fixed derivation context: changing either value rotates every outstanding ref, deliberately. */
const KEY_SALT = 'litubo.ai-source-ref.salt.v1'
const KEY_INFO = 'litubo:ai-source-ref:aes-256-gcm:v1'

export class SourceRefUnavailableError extends Error {
  constructor() {
    super('Source references are unavailable because the server secret is not configured.')
    this.name = 'SourceRefUnavailableError'
  }
}

let derivedKey: Buffer | null = null

/**
 * Derives (once per process) the AES key from the configured server secret.
 * Throws `SourceRefUnavailableError` when no secret is configured — callers
 * turn that into a clean refusal rather than falling back to anything weaker.
 */
function refKey(): Buffer {
  if (derivedKey) return derivedKey
  const secret = readDirectusToken()
  if (!secret) throw new SourceRefUnavailableError()
  derivedKey = Buffer.from(hkdfSync('sha256', secret, KEY_SALT, KEY_INFO, 32))
  return derivedKey
}

interface SourceRefPayload {
  /** The association row id (`products_files.id` or `content_items_files.id`), never a Directus file UUID. */
  m: number
  /** CC-IMP-08 — subject key this ref was minted for (`product:<id>` or `content:<id>:<locale>`). */
  s: string
  /** Admin user this ref was minted for. */
  u: string
  /** Expiry, epoch milliseconds. */
  e: number
}

/** AES-256-GCM: the payload is unreadable, and any modification fails the auth tag on decrypt. */
function seal(payload: SourceRefPayload): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', refKey(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${body.toString('base64url')}.${tag.toString('base64url')}`
}

/**
 * Returns the payload, or null for anything malformed, truncated, or tampered
 * with.
 *
 * PWS-AI-ENGINE-01R2-REVIEW-FIX-03-MIN-01 — the key is derived BEFORE the
 * `try`, and deliberately before the shape check too. `refKey()` used to be
 * called inside the block below, so a missing server secret was swallowed by
 * the same `catch` that absorbs a forged ref: every request answered "this
 * selection is no longer valid" and the 503 branch in both endpoints was
 * unreachable. A missing secret is a server fault, not a bad ref, and the two
 * must not be reported as the same thing — with no key there is nothing to
 * judge any ref against, so the error propagates instead.
 */
function open(ref: string): SourceRefPayload | null {
  const key = refKey()

  const parts = ref.split('.')
  if (parts.length !== 3) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64url'))
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'))
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[1], 'base64url')), decipher.final()])
    return JSON.parse(plain.toString('utf8')) as SourceRefPayload
  } catch {
    // Ciphertext-level failures only: a wrong IV, a truncated body, a failed
    // auth tag, or a payload that is not JSON. The caller learns only that the
    // ref is unusable. A missing server secret cannot reach here — it is
    // raised above, before this block runs.
    return null
  }
}

/**
 * CC-IMP-08 — bound to one admin and one subject: the existing product shape
 * `{ productId, adminUserId }` (key `product:<id>`) or `{ subjectKey, adminUserId }`
 * for a content item and locale. A ref minted for one subject never resolves for another.
 */
export type SourceRefBinding = AiSubjectBinding & { adminUserId: string }

/** Mints an opaque ref for one association row, bound to this admin and subject. */
export function createSourceRef(mediaId: number, binding: SourceRefBinding, now = Date.now()): string {
  const payload: SourceRefPayload = {
    m: mediaId,
    s: subjectKeyOf(binding),
    u: binding.adminUserId,
    e: now + SOURCE_REF_TTL_MS,
  }
  return seal(payload)
}

/**
 * Returns the `products_files.id` a ref stands for, or null if the ref is
 * malformed, tampered with, expired, or was minted for a different admin or
 * product. It never reports which of those checks failed — a caller cannot use
 * the failure reason to probe for valid ids.
 *
 * The one thing it does throw is `SourceRefUnavailableError`, when the server
 * has no secret to derive the key from. That is not a statement about the ref
 * and must not be flattened into `null`: callers turn it into 503.
 */
export function resolveSourceRef(ref: unknown, binding: SourceRefBinding, now = Date.now()): number | null {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 512) return null

  const payload = open(ref)
  if (!payload) return null

  if (typeof payload?.m !== 'number' || !Number.isInteger(payload.m) || payload.m <= 0) return null
  if (payload.s !== subjectKeyOf(binding)) return null
  if (payload.u !== binding.adminUserId) return null
  if (typeof payload.e !== 'number' || payload.e <= now) return null

  return payload.m
}

/**
 * Resolves a list of refs, returning null if ANY of them fails — a partially
 * valid request is refused outright. Propagates `SourceRefUnavailableError`
 * from `resolveSourceRef` unchanged.
 */
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
