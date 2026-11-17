import { createHash } from 'node:crypto'
import { getAdminToken } from './adminDirectusClient'
import { extractTextFromFile, MAX_PER_FILE_CHARS } from './aiTextExtraction'
import { createImageTextReader, createPdfTextReader } from './documentExtractorClient'
import type { H3Event } from 'h3'

/**
 * Shared plumbing for the intake feature: turn one uploaded file into text, and make the paperwork
 * (slug, uniqueness) that creating a product record requires.
 *
 * The file is downloaded and read with exactly the same extractors the existing source analysis uses,
 * so a PDF that the specifications AI can read is also readable here — no second, weaker path.
 */
export interface IntakeFile {
  id: string
  filename: string
  mimeType: string | null
}

export interface IntakeText {
  ok: true
  text: string
  filename: string
}
export interface IntakeTextError {
  ok: false
  error: string
}

/** Where the document-extractor sidecar lives; PDFs and images are read there, never in this process. */
export function intakeReaders(config: { documentExtractorUrl?: string | null }) {
  return {
    pdf: createPdfTextReader({ baseUrl: config.documentExtractorUrl, maxTextChars: MAX_PER_FILE_CHARS }),
    image: createImageTextReader({ baseUrl: config.documentExtractorUrl }),
  }
}

export async function downloadFileBytes(event: H3Event, fileId: string): Promise<ArrayBuffer> {
  const config = useRuntimeConfig()
  const token = getAdminToken(event)
  const res = await $fetch<ArrayBuffer>(`${config.directusUrl}/assets/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arrayBuffer',
    timeout: 30_000,
  })
  return res
}

/** Reads one stored file into text, or says why it cannot. Never throws for a bad document. */
export async function extractIntakeText(
  event: H3Event,
  file: IntakeFile,
  readers: ReturnType<typeof intakeReaders>,
): Promise<IntakeText | IntakeTextError> {
  let bytes: ArrayBuffer
  try {
    bytes = await downloadFileBytes(event, file.id)
  }
  catch {
    return { ok: false, error: 'The uploaded file could not be read from the media library.' }
  }
  const result = await extractTextFromFile(bytes, file.mimeType, file.filename, { readers, maxChars: MAX_PER_FILE_CHARS })
  if (!result.ok) {
    return { ok: false, error: `The document could not be read (${result.code}). Try a text-based PDF or a .docx/.xlsx export.` }
  }
  const text = result.source.text.trim()
  if (!text) return { ok: false, error: 'The document contained no readable text.' }
  return { ok: true, text, filename: file.filename }
}

/**
 * A proposal is based on the exact document and the exact code the person typed. Either changing makes
 * an older proposal stale — which is the point: a code typed for one file must not be used to publish
 * another file's contents.
 */
export function intakeFingerprint(fileId: string, productCode: string): string {
  return createHash('sha256').update(JSON.stringify([fileId, productCode]), 'utf8').digest('hex')
}

/** A URL-safe slug base from a product name. Empty input has no base, and the caller must refuse. */
export function slugBase(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Finds a free slug by suffixing -2, -3 … A slug is permanent in public URLs, so a collision must be
 * resolved before the product is created rather than discovered afterwards.
 */
export async function uniqueSlug(fetch: <T>(path: string, options?: Record<string, unknown>) => Promise<T>, base: string): Promise<string> {
  const candidate = base || 'product'
  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? candidate : `${candidate}-${n}`
    const res = await fetch<{ data?: Array<{ id: number }> }>(
      `/items/products?filter[slug][_eq]=${encodeURIComponent(slug)}&fields=id&limit=1`,
    )
    if (!res?.data?.length) return slug
  }
  throw new Error('Could not find a free slug for this product name.')
}
