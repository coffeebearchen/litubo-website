/**
 * CC-IMP-03 — Content Editor helpers and save contract.
 *
 * The helpers are the same module the editor imports. The save body built here
 * is also run through the server's real `validateBlocks`, so "what the editor
 * sends" and "what the Foundation accepts" cannot drift apart.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyBlockData as serverEmptyBlockData, validateBlocks } from '../server/utils/contentBlocks'
import { MAX_BLOCKS_PER_LOCALE, emptyBlockData, type ContentBlock } from '../utils/contentBlocks'
import { CONTENT_TYPES } from '../utils/contentTypes'
import {
  CONTENT_EDITOR_BLOCK_TYPES,
  EDITOR_BLOCK_BYTES_MESSAGE,
  EDITOR_BLOCK_LIMIT_MESSAGE,
  EDITOR_CONFLICT_MESSAGE,
  buildEditorSaveBody,
  contentLocaleSaveUrl,
  describeBlockErrorPath,
  editorAddableBlockTypes,
  editorLimitProblem,
  editorOutline,
  editorStateFromLocale,
  interpretEditorSaveError,
  isEditorDirty,
  moveListEntry,
  newEditorBlock,
  removeListEntry,
} from '../utils/contentEditor'

const repoFile = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

let counter = 0
const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

const row = (blocks: ContentBlock[] = [], overrides: Record<string, unknown> = {}) =>
  ({ title: 'TEST ONLY — NOT FOR PUBLICATION', slug: 'test-only-editor', summary: null, blocks, ...overrides }) as Parameters<typeof editorStateFromLocale>[0]

describe('editable block types come from the registry', () => {
  it('edits text, key points, FAQ and CTA only', () => {
    expect([...CONTENT_EDITOR_BLOCK_TYPES]).toEqual(['text', 'key_points', 'faq', 'cta'])
  })

  it('offers only the types the content type allows; media/relation types are managed elsewhere', () => {
    expect(editorAddableBlockTypes('technical_article')).toEqual({ addable: ['text', 'key_points', 'faq', 'cta'], managedElsewhere: ['image', 'related_content', 'downloads'] })
    expect(editorAddableBlockTypes('news')).toEqual({ addable: ['text', 'cta'], managedElsewhere: ['image', 'related_content'] })
    expect(editorAddableBlockTypes('resource_download')).toEqual({ addable: ['text', 'cta'], managedElsewhere: ['downloads', 'related_content'] })
    expect(editorAddableBlockTypes('blog')).toEqual({ addable: [], managedElsewhere: [] })
  })

  it('creates new blocks with a UUID and the shared empty data the server also uses', () => {
    expect(serverEmptyBlockData).toBe(emptyBlockData)
    const block = newEditorBlock('faq', () => '6f1c1b9e-8f3a-4c7e-9d2a-1b2c3d4e5f60')
    expect(block).toEqual({ id: '6f1c1b9e-8f3a-4c7e-9d2a-1b2c3d4e5f60', type: 'faq', data: { items: [{ question: '', answer: '' }] } })
  })
})

describe('changed fields and save body', () => {
  const blocks: ContentBlock[] = [
    { id: uuid(), type: 'text', data: { paragraphs: ['Intro'] } },
    { id: uuid(), type: 'related_content', data: {} },
  ]

  it('is clean until something really changes', () => {
    const original = editorStateFromLocale(row(blocks))
    const current = editorStateFromLocale(row(blocks))
    expect(isEditorDirty(original, current)).toBe(false)
    expect(buildEditorSaveBody(original, current, 3)).toBeNull()
    current.title = `${current.title}  `
    current.summary = ''
    expect(isEditorDirty(original, current)).toBe(false)
    current.blocks[0].data = { ...current.blocks[0].data, heading: '' }
    expect(isEditorDirty(original, current)).toBe(false)
  })

  it('sends only changed fields plus expectedDraftRevision, never status or publication fields', () => {
    const original = editorStateFromLocale(row(blocks))
    const current = editorStateFromLocale(row(blocks))
    current.summary = 'New summary'
    expect(buildEditorSaveBody(original, current, 3)).toEqual({ expectedDraftRevision: 3, summary: 'New summary' })

    current.slug = 'test-only-editor-2'
    current.blocks = moveListEntry(current.blocks, 1, -1)
    const body = buildEditorSaveBody(original, current, 3)!
    expect(Object.keys(body).sort()).toEqual(['blocks', 'expectedDraftRevision', 'slug', 'summary'])
    expect(body.blocks!.map(b => b.type)).toEqual(['related_content', 'text'])
    expect(JSON.stringify(body)).not.toMatch(/status|published|content_type|draft_revision|last_change_kind/)
    expect(contentLocaleSaveUrl(5, 'en')).toBe('/api/admin/content-center/5/locales/en')
  })

  it('keeps block ids and preserves future-managed blocks untouched', () => {
    const image: ContentBlock = { id: uuid(), type: 'image', data: { fileLinkId: 7, caption: 'Kept' } }
    const original = editorStateFromLocale(row([...blocks, image]))
    const current = editorStateFromLocale(row([...blocks, image]))
    current.blocks[0].data = { paragraphs: ['Intro, edited'] }
    const body = buildEditorSaveBody(original, current, 1)!
    expect(body.blocks!.map(b => b.id)).toEqual([blocks[0].id, blocks[1].id, image.id])
    expect(body.blocks![2]).toEqual(image)
  })

  it('produces blocks the server validator accepts for the content type', () => {
    const typeId = 'technical_article'
    const original = editorStateFromLocale(row([]))
    const current = editorStateFromLocale(row([]))
    current.blocks = CONTENT_EDITOR_BLOCK_TYPES.map(type => newEditorBlock(type, () => globalThis.crypto.randomUUID()))
    current.blocks[0].data = { heading: '', paragraphs: ['One', 'Two'] }
    current.blocks[1].data = { items: [{ title: 'Fast', body: '' }, { title: 'Accurate', body: 'Within tolerance' }] }
    current.blocks[3].data = { heading: 'Talk to us', label: 'Contact', href: '/contact', body: '' }
    const body = buildEditorSaveBody(original, current, 1)!
    const result = validateBlocks(body.blocks, CONTENT_TYPES[typeId].allowedBlocks)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(body.blocks![0].data).toEqual({ paragraphs: ['One', 'Two'] })
    expect(body.blocks![1].data).toEqual({ items: [{ title: 'Fast' }, { title: 'Accurate', body: 'Within tolerance' }] })
  })
})

describe('list mutations and outline', () => {
  it('moves and removes without mutating the input', () => {
    const list = ['a', 'b', 'c']
    expect(moveListEntry(list, 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveListEntry(list, 0, -1)).toEqual(['a', 'b', 'c'])
    expect(removeListEntry(list, 1)).toEqual(['a', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('derives numbered entries from the same blocks', () => {
    const outline = editorOutline([
      { id: 'x1', type: 'text', data: { paragraphs: [''] } },
      { id: 'x2', type: 'faq', data: { heading: 'Common questions', items: [{ question: 'Q', answer: 'A' }] } },
      { id: 'x3', type: 'cta', data: { label: 'Contact', href: '' } },
      { id: 'x4', type: 'downloads', data: {} },
    ])
    expect(outline.map(i => [i.position, i.label, i.typeLabel, i.empty, i.managedElsewhere])).toEqual([
      [1, 'Text', 'Text', true, false],
      [2, 'Common questions', 'FAQ', false, false],
      [3, 'Contact', 'Call to action', false, false],
      [4, 'Downloads', 'Downloads', false, true],
    ])
  })
})

describe('limits', () => {
  it('stops an obvious 61st section or an oversized payload before sending', () => {
    const many = Array.from({ length: MAX_BLOCKS_PER_LOCALE + 1 }, () => newEditorBlock('text', () => globalThis.crypto.randomUUID()))
    expect(editorLimitProblem(many)).toBe(EDITOR_BLOCK_LIMIT_MESSAGE)
    expect(editorLimitProblem(many.slice(0, MAX_BLOCKS_PER_LOCALE))).toBeNull()
    const huge = Array.from({ length: 12 }, () => ({ id: globalThis.crypto.randomUUID(), type: 'text' as const, data: { paragraphs: Array.from({ length: 20 }, () => 'x'.repeat(2000)) } }))
    expect(editorLimitProblem(huge)).toBe(EDITOR_BLOCK_BYTES_MESSAGE)
  })
})

describe('save errors are specific, never a bare "Save failed"', () => {
  const apiError = (statusCode: number, message?: string, data?: Record<string, unknown>) => ({ statusCode, data: { message, data } })

  it('recognises a stale revision conflict', () => {
    const view = interpretEditorSaveError(apiError(409, 'This draft was changed since it was loaded. Reload it before saving.', { currentDraftRevision: 6 }))
    expect(view).toMatchObject({ kind: 'conflict', message: EDITOR_CONFLICT_MESSAGE, currentDraftRevision: 6 })
    expect(interpretEditorSaveError(apiError(409, 'x', { currentDraftRevision: null })).kind).toBe('conflict')
  })

  it('maps slug, field and archived rejections', () => {
    expect(interpretEditorSaveError(apiError(409, 'This slug is already used for this language.', { field: 'slug' }))).toMatchObject({ kind: 'field', field: 'slug' })
    expect(interpretEditorSaveError(apiError(409, 'This content item is archived and cannot be edited.'))).toMatchObject({ kind: 'rejected', message: 'This content item is archived and cannot be edited.' })
    expect(interpretEditorSaveError(apiError(422, '"new" is a reserved slug.', { field: 'slug' }))).toMatchObject({ kind: 'field', field: 'slug', message: '"new" is a reserved slug.' })
    expect(interpretEditorSaveError(apiError(422, 'title is required.', { field: 'title' }))).toMatchObject({ kind: 'field', field: 'title' })
  })

  it('attaches block schema errors to their section', () => {
    const view = interpretEditorSaveError(apiError(422, 'blocks are not valid.', {
      field: 'blocks',
      errors: ['blocks[3].data.href: href must be empty, an internal path starting with "/", or an https:// URL', 'blocks[1].data.items.2.answer: Too big'],
    }))
    expect(view.kind).toBe('blocks')
    expect(view.blockErrors[3]).toEqual(['href: href must be empty, an internal path starting with "/", or an https:// URL'])
    expect(view.blockErrors[1]).toEqual(['Item 3 answer: Too big'])
    expect(describeBlockErrorPath('data.paragraphs.0')).toBe('Paragraph 1')
  })

  it('explains the 60-section and 200 KB limits, 413, session and server failures', () => {
    expect(interpretEditorSaveError(apiError(422, 'blocks are not valid.', { field: 'blocks', errors: ['at most 60 blocks are allowed'] }))).toMatchObject({ kind: 'too_large', message: EDITOR_BLOCK_LIMIT_MESSAGE })
    expect(interpretEditorSaveError(apiError(422, 'blocks are not valid.', { field: 'blocks', errors: ['blocks exceed 204800 bytes'] }))).toMatchObject({ kind: 'too_large', message: EDITOR_BLOCK_BYTES_MESSAGE })
    expect(interpretEditorSaveError(apiError(413)).kind).toBe('too_large')
    expect(interpretEditorSaveError(apiError(401)).message).toMatch(/unsaved changes are still here/)
    expect(interpretEditorSaveError(apiError(500)).message).toMatch(/unsaved changes are kept/)
    expect(interpretEditorSaveError(new Error('offline')).kind).toBe('unavailable')
  })
})

describe('source evidence — editor boundaries', () => {
  const page = repoFile('pages/admin/content-center/[id]/editor.vue')
  const editor = repoFile('components/admin/content/ContentEditor.vue')
  const blockEditor = repoFile('components/admin/content/ContentBlockEditor.vue')

  it('guards unsaved edits on route leave and browser unload, and hides Refresh', () => {
    expect(page).toContain('onBeforeRouteLeave(() => {')
    expect(page).toContain('if (status.value.dirty && !window.confirm(EDITOR_LEAVE_MESSAGE)) return false')
    expect(page).toContain(':show-refresh="false"')
    expect(editor).toContain("window.addEventListener('beforeunload', onBeforeUnload)")
    expect(editor).toContain("window.removeEventListener('beforeunload', onBeforeUnload)")
  })

  it('saves with exactly one PATCH request and never retries or reloads on its own', () => {
    expect(editor.match(/method: 'PATCH'/g)).toHaveLength(1)
    expect(editor.match(/\$fetch</g)).toHaveLength(2) // the PATCH and the user-confirmed reload
    expect(editor).toContain('@click="reloadLatest"')
  })

  it('renders plain text only and adds no editor or drag-and-drop dependency', () => {
    for (const source of [page, editor, blockEditor, repoFile('components/admin/content/ContentEditorOutline.vue')]) {
      expect(source).not.toMatch(/v-html|innerHTML|contenteditable/)
      expect(source).not.toMatch(/[一-鿿]/)
    }
    const pkg = JSON.parse(repoFile('package.json')) as { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ')
    expect(names).not.toMatch(/drag|sortable|tiptap|quill|prosemirror|editor/i)
  })

  it('does not edit hero, SEO, locales, media links or publication', () => {
    expect(editor).not.toMatch(/seo_title|seo_description|canonical_path|noindex|published_snapshot|fileLinkId/)
    expect(blockEditor).not.toMatch(/<input[^>]*fileLinkId/)
  })
})
