/**
 * MEDIA-AI-LINK-PICKER-01 — Select from Media Library browses the tree.
 *
 * The Product Workspace picker listed every file in the library newest first,
 * with no folder shown and no way to narrow to the formats AI can read. The
 * hierarchy built for Media Library never reached the one screen that links
 * sources to a product. These tests pin the rules that fix that — and the rules
 * it must not bend: linking stays an explicit pick saved per product, and a
 * folder is where a file is found, never which product it belongs to.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildLibraryFilesQuery,
  directChildFolders,
  flattenFolderTree,
  folderPathLabel,
  folderTrail,
  libraryShowsFiles,
  UNCLASSIFIED_FOLDER,
  type LibraryBrowseState,
} from '../utils/mediaDisplay'
import { AI_SOURCE_FORMATS, isAiSourceReadableNow } from '../utils/aiSourceFormats'
import { listArchivedFileIds } from '../server/utils/mediaLifecycle'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const WRITE_METHOD_RE = /method:\s*['"](POST|PATCH|PUT|DELETE)['"]/

/** The route module calls `defineEventHandler` at module scope — a Nitro auto-import — so it is stubbed first. */
let buildFilesDirectusQuery: (q: Record<string, unknown>, excludeFileIds?: readonly string[]) => string
let TEXT_FILTER_MIME_TYPES: readonly string[]

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  const mod = await import('../server/api/admin/media/files.get')
  buildFilesDirectusQuery = mod.buildFilesDirectusQuery
  TEXT_FILTER_MIME_TYPES = mod.TEXT_FILTER_MIME_TYPES
})

interface Folder { id: string, name: string, parent: string | null, full_path: string, children: Folder[] }
const folder = (id: string, parent: string | null, full_path: string, children: Folder[] = []): Folder =>
  ({ id, name: full_path.split('/').pop() ?? id, parent, full_path, children })

/** products → checkweigher → LT180C → {manuals, specifications} · LT200C → old-versions · xray · resources */
const TREE: Folder[] = [
  folder('products', null, 'products', [
    folder('checkweigher', 'products', 'products/checkweigher', [
      folder('lt180c', 'checkweigher', 'products/checkweigher/LT180C', [
        folder('manuals', 'lt180c', 'products/checkweigher/LT180C/manuals'),
        folder('specs', 'lt180c', 'products/checkweigher/LT180C/specifications'),
      ]),
      folder('lt200c', 'checkweigher', 'products/checkweigher/LT200C', [
        folder('old', 'lt200c', 'products/checkweigher/LT200C/old-versions'),
      ]),
    ]),
    folder('xray', 'products', 'products/xray'),
  ]),
  folder('resources', null, 'resources'),
]
const FLAT = flattenFolderTree(TREE)
const PARENT_OF = Object.fromEntries(FLAT.map(f => [f.id, f.parent]))
const idsAt = (context: string | null) => directChildFolders(FLAT, PARENT_OF, context).map(f => f.id)

describe('the picker walks the Media Library tree one level at a time', () => {
  it('lists only the top-level folders at the library root', () => {
    expect(idsAt(null)).toEqual(['products', 'resources'])
  })

  it.each([
    ['products', ['checkweigher', 'xray']],
    ['checkweigher', ['lt180c', 'lt200c']],
    ['lt180c', ['manuals', 'specs']],
  ])('inside %s, lists only its own children', (context, expected) => {
    expect(idsAt(context)).toEqual(expected)
  })

  it('never pulls a model\'s subfolders up beside the model, or to the root', () => {
    for (const grandchild of ['manuals', 'specs', 'old']) {
      expect(idsAt('checkweigher')).not.toContain(grandchild)
      expect(idsAt(null)).not.toContain(grandchild)
    }
  })

  it('Unclassified is a view of files, so it has no folders to open', () => {
    expect(idsAt(UNCLASSIFIED_FOLDER)).toEqual([])
  })

  it('flattening keeps every folder exactly once, at its real depth', () => {
    expect(FLAT).toHaveLength(9)
    expect(new Set(FLAT.map(f => f.id)).size).toBe(9)
    expect(FLAT.find(f => f.id === 'manuals')?.depth).toBe(3)
  })
})

describe('the picker says where you are', () => {
  it('builds the trail from the library root down to the open folder', () => {
    expect(folderTrail(FLAT, 'manuals').map(f => f.id)).toEqual(['products', 'checkweigher', 'lt180c', 'manuals'])
  })

  it.each([
    ['the library root', null],
    ['Unclassified', UNCLASSIFIED_FOLDER],
    ['a folder the tree no longer contains', 'deleted-folder'],
  ])('has no trail at %s', (_label, folderId) => {
    expect(folderTrail(FLAT, folderId)).toEqual([])
  })

  it('shows a file\'s folder in the form Media Library cards use', () => {
    expect(folderPathLabel('products/checkweigher/LT180C')).toBe('products / checkweigher / LT180C')
    expect(folderPathLabel(null)).toBe('')
    expect(folderPathLabel(undefined)).toBe('')
  })
})

describe('the picker never lists the whole library blind', () => {
  const root: LibraryBrowseState = { folder: null, search: '', type: '' }

  it('asks for no files at the root until something narrows the view', () => {
    expect(libraryShowsFiles(root)).toBe(false)
    expect(libraryShowsFiles({ ...root, search: '   ' })).toBe(false)
  })

  const narrowed: Array<[string, LibraryBrowseState]> = [
    ['a folder is open', { ...root, folder: 'lt180c' }],
    ['Unclassified is open', { ...root, folder: UNCLASSIFIED_FOLDER }],
    ['a search is typed', { ...root, search: 'electrical' }],
    ['a format is chosen', { ...root, type: 'text' }],
  ]
  it.each(narrowed)('lists files once %s', (_label, state) => {
    expect(libraryShowsFiles(state)).toBe(true)
  })

  it('sends the open folder to the existing files endpoint', () => {
    expect(buildLibraryFilesQuery({ ...root, folder: 'lt180c', limit: 60, offset: 0 }))
      .toEqual({ limit: '60', offset: '0', archived: 'exclude', folder: 'lt180c' })
  })

  it('combines folder and search, so a search inside LT180C stays inside LT180C', () => {
    expect(buildLibraryFilesQuery({ folder: 'lt180c', search: '  electrical ', type: '', limit: 60, offset: 0 }))
      .toEqual({ limit: '60', offset: '0', archived: 'exclude', folder: 'lt180c', search: 'electrical' })
  })

  it('combines folder and format', () => {
    expect(buildLibraryFilesQuery({ folder: 'lt180c', search: '', type: 'text', limit: 60, offset: 120 }))
      .toEqual({ limit: '60', offset: '120', archived: 'exclude', folder: 'lt180c', type: 'text' })
  })

  it('a search at the root covers the whole library — no folder is sent', () => {
    expect(buildLibraryFilesQuery({ ...root, search: 'electrical', limit: 60, offset: 0 })).not.toHaveProperty('folder')
  })

  it('Unclassified is sent as the endpoint\'s own no-folder value', () => {
    expect(buildLibraryFilesQuery({ ...root, folder: UNCLASSIFIED_FOLDER, limit: 60, offset: 0 }).folder).toBe('root')
  })
})

describe('the files endpoint narrows by folder, format and search together', () => {
  it('puts all three conditions into one Directus query', () => {
    const query = buildFilesDirectusQuery({ folder: 'lt180c', type: 'text', search: 'electrical', limit: '60', offset: '0' })
    expect(query).toContain('filter[folder][_eq]=lt180c')
    expect(query).toContain('search=electrical')
    expect(query).toContain('filter[_or][0][type][_starts_with]=text/plain')
    expect(query).toContain('limit=60')
  })

  it('Text narrows to exactly the three AI-readable text formats, and nothing else', () => {
    const query = buildFilesDirectusQuery({ type: 'text' })
    const matched = [...query.matchAll(/filter\[_or\]\[\d+\]\[type\]\[_starts_with\]=([^&]+)/g)].map(m => m[1])
    expect(matched).toEqual(['text/plain', 'text/csv', 'text/tab-separated-values'])
    expect(query).not.toContain('application/pdf')
    expect(query).not.toContain('image/')
  })

  it('keeps the existing Image, PDF and Unclassified filters unchanged', () => {
    expect(buildFilesDirectusQuery({ type: 'image' })).toContain('filter[type][_starts_with]=image/')
    expect(buildFilesDirectusQuery({ type: 'pdf' })).toContain('filter[type][_eq]=application/pdf')
    expect(buildFilesDirectusQuery({ folder: 'root' })).toContain('filter[folder][_null]=true')
  })

  it('adds no folder, format or search condition that was not asked for', () => {
    const query = buildFilesDirectusQuery({})
    expect(query).not.toContain('filter[')
    expect(query).not.toContain('search=')
  })
})

describe('Text means exactly what AI Source Intake can analyze today', () => {
  const TABLE: Array<string | null> = [
    'text/plain', 'text/csv', 'text/tab-separated-values', 'text/plain; charset=utf-8', 'TEXT/CSV',
    'application/pdf', 'image/png', 'image/jpeg', 'text/html',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', null,
  ]

  it('every format in the Text filter is one the shared source contract marks AI-readable', () => {
    for (const mime of TEXT_FILTER_MIME_TYPES) expect(isAiSourceReadableNow(mime)).toBe(true)
  })

  /** AI-SOURCE-CONTRACT-01 — the filter is pinned to the contract's own text family, not to a copy of it. */
  it('the Text filter is exactly the contract\'s text family', () => {
    const textFamily = AI_SOURCE_FORMATS.find(f => f.key === 'text')!.types.map(t => t.mime)
    expect([...TEXT_FILTER_MIME_TYPES].sort()).toEqual([...textFamily].sort())
  })

  it.each(TABLE)('the filter and the one AI-readable decision (engine and picker badge alike) agree on %s', (mime) => {
    const readable = isAiSourceReadableNow(mime)
    const filter = mime !== null && TEXT_FILTER_MIME_TYPES.some(t => mime.toLowerCase().startsWith(t))
    expect(filter).toBe(readable)
  })

  /** A Text filter must not suggest PDF can be analyzed — it cannot, until an isolated parser exists. */
  it('PDF is neither in the Text filter nor AI-readable', () => {
    expect(TEXT_FILTER_MIME_TYPES).not.toContain('application/pdf')
    expect(isAiSourceReadableNow('application/pdf')).toBe(false)
  })
})

/**
 * MEDIA-AI-LINK-PICKER-01-R1 — archived files are never offered for a new link.
 *
 * Archiving means a file is no longer in use. The picker used to list archived
 * files anyway — including the CORRUPTED pre-hotfix TXT copies, which carried
 * an AI-readable mark — so a retired file could be linked to a product and from
 * there reach AI Source Intake. The exclusion happens in the files result
 * itself, so an archived file is absent from the list, the count and every
 * page, not hidden on screen.
 */
describe('archived files are never offered for a new link', () => {
  const ARCHIVED = ['d1e61fd1-0000-4000-8000-000000000001', '13f6fd6a-0000-4000-8000-000000000002']

  it('the picker always asks the files endpoint to leave archived files out', () => {
    expect(buildLibraryFilesQuery({ folder: null, search: 'corrupted', type: '', limit: 60, offset: 0 }).archived).toBe('exclude')
    expect(buildLibraryFilesQuery({ folder: 'lt180c', search: '', type: 'text', limit: 60, offset: 0 }).archived).toBe('exclude')
  })

  it('removes archived files from the Directus result by id, while folder, Text and search still apply', () => {
    const query = buildFilesDirectusQuery({ folder: 'lt180c', type: 'text', search: 'electrical' }, ARCHIVED)
    expect(query).toContain(`filter[id][_nin]=${ARCHIVED.join(',')}`)
    expect(query).toContain('filter[folder][_eq]=lt180c')
    expect(query).toContain('filter[_or][0][type][_starts_with]=text/plain')
    expect(query).toContain('search=electrical')
  })

  it('adds no exclusion when nothing is archived', () => {
    expect(buildFilesDirectusQuery({ folder: 'lt180c' }, [])).not.toContain('_nin')
  })

  it('reads the archived list from the one existing archive state, in full', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ data: [{ file_id: ARCHIVED[0] }, { file_id: ARCHIVED[1] }] })
    await expect(listArchivedFileIds(fetch)).resolves.toEqual(ARCHIVED)
    const [path] = fetch.mock.calls[0] as [string]
    expect(path).toContain('/items/media_file_lifecycle?')
    expect(path).toContain('filter[archived][_eq]=true')
    expect(path).toContain('limit=-1')
  })

  it('drops an entry that is not a file id, rather than splicing it into a filter', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({
      data: [{ file_id: ARCHIVED[0] }, { file_id: 'x&filter[id][_eq]=y' }, { file_id: null }],
    })
    await expect(listArchivedFileIds(fetch)).resolves.toEqual([ARCHIVED[0]])
  })

  it('fails closed: a failed archived-list read fails the request instead of returning archived files', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('Directus unavailable'))
    await expect(listArchivedFileIds(fetch)).rejects.toThrow('Directus unavailable')
    const handler = read('server/api/admin/media/files.get.ts')
    // The read is awaited before the files query is built — no catch that would fall back to an unfiltered result.
    expect(handler).toContain('q.archived === \'exclude\' ? await listArchivedFileIds(fetch) : []')
    expect(handler).not.toMatch(/catch/)
  })

  it('only the picker opts in — Media Library\'s own views keep showing archived files with their badge', () => {
    expect(read('pages/admin/media/index.vue')).not.toMatch(/archived:\s*'exclude'/)
    expect(read('pages/admin/product-workspace/[id]/media-resources.vue')).toContain('buildLibraryFilesQuery(')
  })
})

describe('linking stays an explicit pick, saved per product — a folder is never product truth', () => {
  const page = read('pages/admin/product-workspace/[id]/media-resources.vue')
  const component = read('components/admin/workspace/WorkspaceMediaResources.vue')
  const between = (source: string, from: string, to: string) => {
    const start = source.indexOf(from)
    expect(start).toBeGreaterThan(-1)
    return source.slice(start, source.indexOf(to, start))
  }

  it('a picker file carries its folder, in the page and in the component', () => {
    for (const source of [page, component]) {
      expect(source).toMatch(/interface LibraryFile \{[^}]*folder: string \| null/)
    }
  })

  it('loads files through the shared query builder and root rule, from the existing endpoint', () => {
    const block = between(page, 'async function loadLibraryFiles', 'async function loadLibraryFolders')
    expect(block).toContain('libraryShowsFiles(state)')
    expect(block).toContain('buildLibraryFilesQuery(')
    expect(block).toContain('\'/api/admin/media/files\'')
  })

  it('discards a response that a newer folder, search or format has already superseded', () => {
    const block = between(page, 'async function loadLibraryFiles', 'async function loadLibraryFolders')
    expect(block).toContain('if (request !== libraryRequest) return')
  })

  it('browsing — folders, search, format, retry — issues no write and touches no association', () => {
    const block = between(page, 'async function loadLibraryFolders', 'const existingFileIds')
    expect(block).not.toMatch(WRITE_METHOD_RE)
    expect(block).not.toContain('mediaRows')
  })

  it('a file becomes staged only through an explicit pick, never from where it sits', () => {
    // Exactly one place adds an association row, and only the picker's pick event reaches it.
    expect(page.match(/mediaRows\.value\.push\(/g)).toHaveLength(1)
    expect(between(page, 'function stageLink', 'function unstage')).toContain('mediaRows.value.push(')
    expect(page.match(/stageLink\(/g)).toHaveLength(1)
    expect(page).toContain('@pick-file="stageLink"')
    // A new row is built from the file alone — its folder plays no part.
    expect(between(page, 'function fromLibraryFile', 'const mediaRows')).not.toContain('folder')
  })

  it('Save writes the association to this route\'s product only', () => {
    const save = between(page, 'async function handleSave', '</script>')
    expect(save).toContain('await $fetch(`/api/admin/products/${productId}/media`, {')
    expect(page).not.toMatch(/\/api\/admin\/products\/\d+\/media/)
  })

  it('AI Source Intake reads the product\'s explicit associations, never a folder', () => {
    const sources = read('server/api/admin/products/[id]/ai/sources.get.ts')
    expect(sources).toContain('/items/products_files?filter[products_id][_eq]=${productId}')
    expect(sources).not.toMatch(/folder/i)
  })

  it('neither the page\'s picker nor the component compares a folder to a product\'s identity', () => {
    const picker = between(page, '// ── Media Library picker', '// ── Save')
    for (const source of [picker, component]) {
      expect(source).not.toMatch(/name_en|product_code/)
    }
  })
})
