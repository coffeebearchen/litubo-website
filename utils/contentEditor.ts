/**
 * CC-IMP-03 — Content Editor (CC-02) pure helpers.
 *
 * The editor works on one locale working copy (title, slug, summary, blocks) and
 * saves it with one `PATCH /api/admin/content-center/:id/locales/:locale` carrying
 * `expectedDraftRevision` and only the fields that changed. Block types, empty
 * block data and limits come from the shared registry (utils/contentBlocks.ts);
 * the server's zod schemas and the database revision guard stay the authority.
 */

import type { AdminContentLocaleDraft } from '../types/content-center'
import {
  MAX_BLOCKS_JSON_BYTES,
  MAX_BLOCKS_PER_LOCALE,
  emptyBlockData,
  type ContentBlock,
  type ContentBlockType,
} from './contentBlocks'
import { getContentType } from './contentTypes'
import { CONTENT_BLOCK_LABELS, contentApiErrorStatus } from './contentCenter'

// ── Block types this module edits ───────────────────────────────────────────

/** Blocks that need no Media Library file or relation. Everything else is preserved as is. */
export const CONTENT_EDITOR_BLOCK_TYPES = ['text', 'key_points', 'faq', 'cta'] as const satisfies readonly ContentBlockType[]

export type EditorBlockType = (typeof CONTENT_EDITOR_BLOCK_TYPES)[number]

export function isEditorBlockType(value: unknown): value is EditorBlockType {
  return typeof value === 'string' && (CONTENT_EDITOR_BLOCK_TYPES as readonly string[]).includes(value)
}

/** Types the content type allows: those editable here, and those managed in Media & relations. */
export function editorAddableBlockTypes(contentTypeId: unknown): { addable: EditorBlockType[], managedElsewhere: ContentBlockType[] } {
  const allowed = getContentType(contentTypeId)?.allowedBlocks ?? []
  return {
    addable: CONTENT_EDITOR_BLOCK_TYPES.filter(type => allowed.includes(type)),
    managedElsewhere: allowed.filter(type => !isEditorBlockType(type)),
  }
}

/** A new block with a UUID identity and the registry's empty data. */
export function newEditorBlock(type: EditorBlockType, newId: () => string): ContentBlock {
  return { id: newId(), type, data: emptyBlockData(type) }
}

// ── Working copy ────────────────────────────────────────────────────────────

export interface ContentEditorState {
  title: string
  slug: string
  summary: string
  blocks: ContentBlock[]
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function editorStateFromLocale(row: Pick<AdminContentLocaleDraft, 'title' | 'slug' | 'summary' | 'blocks'>): ContentEditorState {
  return {
    title: row.title ?? '',
    slug: row.slug ?? '',
    summary: row.summary ?? '',
    blocks: clone(Array.isArray(row.blocks) ? row.blocks : []),
  }
}

export function cloneEditorState(state: ContentEditorState): ContentEditorState {
  return clone(state)
}

const OPTIONAL_TEXT_KEYS = new Set(['heading', 'body', 'caption'])

/** Drops optional text keys left empty, so "cleared" and "never set" compare and save identically. */
function stripEmptyOptional(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmptyOptional)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue
      if (OPTIONAL_TEXT_KEYS.has(key) && entry === '') continue
      out[key] = stripEmptyOptional(entry)
    }
    return out
  }
  return value
}

export function normalizeEditorBlocks(blocks: readonly ContentBlock[]): ContentBlock[] {
  return blocks.map(block => ({ id: block.id, type: block.type, data: stripEmptyOptional(block.data) as Record<string, unknown> }))
}

export type EditorSaveFields = Partial<{ title: string, slug: string, summary: string, blocks: ContentBlock[] }>

/** Only the fields that really changed. Title and summary are compared as the server stores them (trimmed). */
export function editorChangedFields(original: ContentEditorState, current: ContentEditorState): EditorSaveFields {
  const changed: EditorSaveFields = {}
  if (current.title.trim() !== original.title.trim()) changed.title = current.title
  if (current.slug !== original.slug) changed.slug = current.slug
  if (current.summary.trim() !== original.summary.trim()) changed.summary = current.summary
  const blocks = normalizeEditorBlocks(current.blocks)
  if (JSON.stringify(blocks) !== JSON.stringify(normalizeEditorBlocks(original.blocks))) changed.blocks = blocks
  return changed
}

export function isEditorDirty(original: ContentEditorState, current: ContentEditorState): boolean {
  return Object.keys(editorChangedFields(original, current)).length > 0
}

/** The single save request body, or null when nothing changed. Never carries status or publication fields. */
export function buildEditorSaveBody(original: ContentEditorState, current: ContentEditorState, expectedDraftRevision: number): ({ expectedDraftRevision: number } & EditorSaveFields) | null {
  const changed = editorChangedFields(original, current)
  if (Object.keys(changed).length === 0) return null
  return { expectedDraftRevision, ...changed }
}

export function contentLocaleSaveUrl(itemId: number, locale: string): string {
  return `/api/admin/content-center/${itemId}/locales/${encodeURIComponent(locale)}`
}

// ── List mutations (pure) ───────────────────────────────────────────────────

export function moveListEntry<T>(list: readonly T[], index: number, delta: number): T[] {
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list]
  const next = [...list]
  const [entry] = next.splice(index, 1)
  next.splice(target, 0, entry)
  return next
}

export function removeListEntry<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index)
}

// ── Outline (derived from the same blocks state) ────────────────────────────

const PREVIEW_MAX = 80

function firstText(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function blockPreviewText(block: ContentBlock): string {
  const data = block.data ?? {}
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : []
  const text = firstText([
    data.heading,
    ...(Array.isArray(data.paragraphs) ? data.paragraphs : []),
    ...items.map(item => item.title ?? item.question),
    data.label,
    data.caption,
  ])
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text
}

function collectStrings(value: unknown, out: string[]): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(entry => collectStrings(entry, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(entry => collectStrings(entry, out))
  return out
}

/** Deterministic: an editable block whose every text value is blank. */
export function isBlockEmpty(block: ContentBlock): boolean {
  if (!isEditorBlockType(block.type)) return false
  return collectStrings(block.data, []).every(text => !text.trim())
}

export interface EditorOutlineItem {
  id: string
  position: number
  type: ContentBlockType
  typeLabel: string
  label: string
  managedElsewhere: boolean
  empty: boolean
}

export function editorOutline(blocks: readonly ContentBlock[]): EditorOutlineItem[] {
  return blocks.map((block, index) => {
    const typeLabel = CONTENT_BLOCK_LABELS[block.type] ?? block.type
    return {
      id: block.id,
      position: index + 1,
      type: block.type,
      typeLabel,
      label: blockPreviewText(block) || typeLabel,
      managedElsewhere: !isEditorBlockType(block.type),
      empty: isBlockEmpty(block),
    }
  })
}

// ── Limits ──────────────────────────────────────────────────────────────────

export function blocksJsonByteSize(blocks: readonly ContentBlock[]): number {
  return new TextEncoder().encode(JSON.stringify(blocks)).length
}

export const EDITOR_BLOCK_LIMIT_MESSAGE = `A draft can have at most ${MAX_BLOCKS_PER_LOCALE} sections.`
export const EDITOR_BLOCK_BYTES_MESSAGE = `The sections are too large to save (limit ${Math.round(MAX_BLOCKS_JSON_BYTES / 1024)} KB). Shorten or remove some text.`

/** Obvious limit breaches caught before sending; the server validator stays the final authority. */
export function editorLimitProblem(blocks: readonly ContentBlock[]): string | null {
  if (blocks.length > MAX_BLOCKS_PER_LOCALE) return EDITOR_BLOCK_LIMIT_MESSAGE
  if (blocksJsonByteSize(blocks) > MAX_BLOCKS_JSON_BYTES) return EDITOR_BLOCK_BYTES_MESSAGE
  return null
}

// ── Save errors (CC-IMP-01 error convention) ────────────────────────────────

export const EDITOR_CONFLICT_MESSAGE = 'This draft changed since you opened it.'

export type EditorSaveErrorKind =
  | 'conflict' | 'field' | 'blocks' | 'too_large' | 'session' | 'forbidden' | 'not_found' | 'rejected' | 'unavailable'

export type EditorField = 'title' | 'slug' | 'summary'

export interface EditorSaveError {
  kind: EditorSaveErrorKind
  status: number
  message: string
  field: EditorField | null
  /** Keyed by block index in the array that was sent. */
  blockErrors: Record<number, string[]>
  currentDraftRevision: number | null
}

const EDITOR_FIELDS: readonly EditorField[] = ['title', 'slug', 'summary']
const BLOCK_ERROR_RE = /^blocks\[(\d+)\](?:\.([^:]*))?: (.*)$/

/** `data.items.2.answer` → `Item 3 answer`; `data.paragraphs.0` → `Paragraph 1`. */
export function describeBlockErrorPath(path: string): string {
  const parts = path.split('.').filter(part => part !== 'data')
  const words: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const next = parts[i + 1]
    if (next !== undefined && /^\d+$/.test(next)) {
      words.push(`${part === 'paragraphs' ? 'Paragraph' : 'Item'} ${Number(next) + 1}`)
      i++
    } else {
      words.push(part)
    }
  }
  return words.join(' ')
}

function base(kind: EditorSaveErrorKind, status: number, message: string): EditorSaveError {
  return { kind, status, message, field: null, blockErrors: {}, currentDraftRevision: null }
}

export function interpretEditorSaveError(err: unknown): EditorSaveError {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: Record<string, unknown> } } | null)?.data
  const serverMessage = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const inner = payload?.data && typeof payload.data === 'object' ? payload.data : {}

  switch (status) {
    case 409: {
      if ('currentDraftRevision' in inner) {
        const current = Number(inner.currentDraftRevision)
        return { ...base('conflict', status, EDITOR_CONFLICT_MESSAGE), currentDraftRevision: Number.isInteger(current) ? current : null }
      }
      if (inner.field === 'slug') return { ...base('field', status, serverMessage ?? 'This slug is already used for this language.'), field: 'slug' }
      return base('rejected', status, serverMessage ?? 'This draft cannot be saved right now.')
    }
    case 422: {
      if (EDITOR_FIELDS.includes(inner.field as EditorField)) {
        return { ...base('field', status, serverMessage ?? 'This value is not valid.'), field: inner.field as EditorField }
      }
      if (inner.field === 'blocks') {
        const errors = Array.isArray(inner.errors) ? inner.errors.map(String) : []
        const blockErrors: Record<number, string[]> = {}
        let general: string | null = null
        for (const entry of errors) {
          const match = BLOCK_ERROR_RE.exec(entry)
          if (match) {
            const index = Number(match[1])
            const where = match[2] ? `${describeBlockErrorPath(match[2])}: ` : ''
            ;(blockErrors[index] ??= []).push(`${where}${match[3]}`)
          } else if (/at most \d+ blocks/.test(entry)) {
            general = EDITOR_BLOCK_LIMIT_MESSAGE
          } else if (/exceed \d+ bytes/.test(entry)) {
            general = EDITOR_BLOCK_BYTES_MESSAGE
          } else {
            general = entry
          }
        }
        if (general && Object.keys(blockErrors).length === 0) return { ...base('too_large', status, general), blockErrors }
        return { ...base('blocks', status, general ?? 'Some sections are not valid. Check the highlighted sections.'), blockErrors }
      }
      if (Array.isArray((inner as { invalidFileLinkIds?: unknown }).invalidFileLinkIds)) {
        return base('blocks', status, serverMessage ?? 'An image section refers to a file that is not linked to this content.')
      }
      return base('rejected', status, serverMessage ?? 'Some values are not valid.')
    }
    case 413:
      return base('too_large', status, 'This save is too large. Shorten or remove some text, then try again.')
    case 400:
      return base('rejected', status, serverMessage ?? 'The save request could not be processed.')
    case 401:
      return base('session', status, 'Your session has expired. Your unsaved changes are still here — sign in again in another tab, then save.')
    case 403:
      return base('forbidden', status, 'You do not have permission to save this draft.')
    case 404:
      return base('not_found', status, serverMessage ?? 'This content item or language draft was not found.')
    default:
      return base('unavailable', status, 'Content Center is temporarily unavailable. Your unsaved changes are kept — try again.')
  }
}

export const EDITOR_LEAVE_MESSAGE = 'You have unsaved changes in this draft. Leave without saving?'
