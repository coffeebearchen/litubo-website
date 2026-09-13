// @vitest-environment happy-dom
/**
 * MEDIA-AI-LINK-PICKER-01 — Select from Media Library, mounted.
 *
 * Real `@vue/test-utils` mounts of the picker, asserting what an operator sees
 * and what each click asks the page to do. The component never writes: every
 * action is an event, so "picking stages, only Save writes" is checkable here
 * as "picking emits pick-file, and nothing else".
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceMediaResources from '../../components/admin/workspace/WorkspaceMediaResources.vue'

interface Folder { id: string, name: string, parent: string | null, full_path: string, management: string, children: Folder[] }
interface FileRow {
  id: string
  filename_download: string | null
  title: string | null
  type: string | null
  filesize: number | null
  width: number | null
  height: number | null
  folder: string | null
}
interface MediaRow {
  id: number | null
  directus_files_id: string
  filename_download: string | null
  type: string | null
  filesize: number | null
  file_role: null
  alt_en: string | null
  language: string | null
  version_label: string | null
  enabled: boolean
  isNew: boolean
  markedForDeletion: boolean
}

const folder = (id: string, name: string, parent: string | null, full_path: string, management: string, children: Folder[] = []): Folder =>
  ({ id, name, parent, full_path, management, children })

const TREE: Folder[] = [
  folder('products', 'products', null, 'products', 'protected', [
    folder('checkweigher', 'checkweigher', 'products', 'products/checkweigher', 'protected', [
      folder('lt180c', 'LT180C', 'checkweigher', 'products/checkweigher/LT180C', 'customer-managed', [
        folder('manuals', 'manuals', 'lt180c', 'products/checkweigher/LT180C/manuals', 'customer-managed'),
      ]),
      folder('lt200c', 'LT200C', 'checkweigher', 'products/checkweigher/LT200C', 'customer-managed'),
    ]),
  ]),
  folder('resources', 'resources', null, 'resources', 'protected'),
]

const file = (id: string, filename: string, type: string, folderId: string | null): FileRow =>
  ({ id, filename_download: filename, title: null, type, filesize: 160, width: null, height: null, folder: folderId })

const linkedTo = (fileId: string): MediaRow => ({
  id: 1,
  directus_files_id: fileId,
  filename_download: 'already.txt',
  type: 'text/plain',
  filesize: 1,
  file_role: null,
  alt_en: null,
  language: null,
  version_label: null,
  enabled: true,
  isNew: false,
  markedForDeletion: false,
})

const BASE = {
  media: [] as MediaRow[],
  libraryOpen: true,
  libraryFiles: [] as FileRow[],
  libraryLoading: false,
  libraryError: false,
  libraryTotal: 0,
  librarySearch: '',
  libraryTypeFilter: '' as '' | 'image' | 'pdf' | 'text',
  libraryFolders: TREE,
  libraryFoldersError: false,
  libraryFolderId: null as string | null,
}

function mountPicker(overrides: Partial<typeof BASE> = {}) {
  return mount(WorkspaceMediaResources, {
    props: { ...BASE, ...overrides },
    global: { stubs: { teleport: true } },
  })
}

const folderRows = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findAll('.ws-lib-folder').map(row => row.find('.ws-lib-folder__name').text())

const trail = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findAll('.ws-lib-trail__link, .ws-lib-trail__current').map(part => part.text())

describe('the picker opens on folders, not on the whole library', () => {
  it('shows the top-level folders and Unclassified, and waits for a folder or search before listing files', () => {
    const wrapper = mountPicker({ libraryFiles: [file('stale', 'stale.txt', 'text/plain', 'lt180c')], libraryTotal: 1 })
    expect(folderRows(wrapper)).toEqual(['Products', 'Resources', 'Unclassified files'])
    expect(wrapper.find('.ws-lib-prompt').exists()).toBe(true)
    expect(wrapper.findAll('.ws-lib-card')).toHaveLength(0)
  })

  it('opening a folder asks the page to navigate into it', async () => {
    const wrapper = mountPicker()
    await wrapper.find('.ws-lib-folder').trigger('click')
    expect(wrapper.emitted('navigate-folder')).toEqual([['products']])
  })
})

describe('inside a folder the picker shows one level, and where you are', () => {
  it('lists only the models in a category — never their subfolders', () => {
    expect(folderRows(mountPicker({ libraryFolderId: 'checkweigher' }))).toEqual(['LT180C', 'LT200C'])
  })

  it('shows the trail, and each ancestor navigates back up', async () => {
    const wrapper = mountPicker({ libraryFolderId: 'checkweigher' })
    expect(trail(wrapper)).toEqual(['Media Library', 'Products', 'Checkweigher'])
    const links = wrapper.findAll('.ws-lib-trail__link')
    await links[1]?.trigger('click')
    await links[0]?.trigger('click')
    expect(wrapper.emitted('navigate-folder')).toEqual([['products'], [null]])
  })

  it('says so when a folder has no subfolders', () => {
    expect(mountPicker({ libraryFolderId: 'lt200c' }).text()).toContain('No subfolders')
  })

  it('Unclassified lists files without offering folders to open', () => {
    const wrapper = mountPicker({ libraryFolderId: 'root' })
    expect(folderRows(wrapper)).toEqual([])
    expect(trail(wrapper)).toEqual(['Media Library', 'Unclassified'])
  })
})

describe('each file row says what it is and where it is', () => {
  const files = [
    file('f-txt', 'LT180C-test-electrical.txt', 'text/plain', 'lt180c'),
    file('f-pdf', 'LT180C-manual.pdf', 'application/pdf', 'lt180c'),
  ]

  it('shows filename, format, size and folder path', () => {
    const row = mountPicker({ libraryFolderId: 'lt180c', libraryFiles: files, libraryTotal: 2 }).find('.ws-lib-card')
    expect(row.find('.ws-lib-card__name').text()).toBe('LT180C-test-electrical.txt')
    expect(row.find('.ws-lib-card__meta').text()).toContain('TXT · 160 B')
    expect(row.find('.ws-lib-card__path').text()).toBe('products / checkweigher / LT180C')
  })

  it('marks only the formats AI Source Intake can analyze as AI-readable — a PDF too since AI-PDF-SOURCE-01, an image not', () => {
    const withImage = [...files, file('f-img', 'LT180C-nameplate.jpg', 'image/jpeg', 'lt180c')]
    const rows = mountPicker({ libraryFolderId: 'lt180c', libraryFiles: withImage, libraryTotal: 3 }).findAll('.ws-lib-card')
    expect(rows[0]?.find('.ws-lib-card__ai').exists()).toBe(true)
    expect(rows[1]?.find('.ws-lib-card__ai').exists()).toBe(true)
    expect(rows[2]?.find('.ws-lib-card__ai').exists()).toBe(false)
  })

  it('a file in no folder says Unclassified', () => {
    const row = mountPicker({
      libraryFolderId: 'root',
      libraryFiles: [file('loose', 'loose.txt', 'text/plain', null)],
      libraryTotal: 1,
    }).find('.ws-lib-card')
    expect(row.find('.ws-lib-card__path').text()).toBe('Unclassified')
  })
})

describe('picking stages; nothing links on its own', () => {
  const one = [file('f-txt', 'LT180C-test-electrical.txt', 'text/plain', 'lt180c')]

  it('an already linked file is disabled and says so', () => {
    const row = mountPicker({ libraryFolderId: 'lt180c', libraryFiles: one, libraryTotal: 1, media: [linkedTo('f-txt')] }).find('.ws-lib-card')
    expect((row.element as HTMLButtonElement).disabled).toBe(true)
    expect(row.text()).toContain('Already linked')
  })

  it('picking a file only asks the page to stage it', async () => {
    const wrapper = mountPicker({ libraryFolderId: 'lt180c', libraryFiles: one, libraryTotal: 1 })
    await wrapper.find('.ws-lib-card').trigger('click')
    expect(wrapper.emitted('pick-file')).toEqual([['f-txt']])
    expect(wrapper.emitted('navigate-folder')).toBeUndefined()
    expect(wrapper.emitted('unlink')).toBeUndefined()
  })
})

describe('the format filter includes Text, and the AI-readable note follows the shared contract', () => {
  it('offers All formats, Image, PDF and Text', () => {
    const options = mountPicker().find('select.ws-lib-type').findAll('option')
    expect(options.map(option => option.attributes('value'))).toEqual(['', 'image', 'pdf', 'text'])
  })

  it('choosing Text asks the page to narrow to text', async () => {
    const wrapper = mountPicker()
    await wrapper.find('select.ws-lib-type').setValue('text')
    expect(wrapper.emitted('update-type-filter')).toEqual([['text']])
  })

  it('names the formats AI can analyze (PDF included since AI-PDF-SOURCE-01) and the ones that can only be linked', () => {
    const text = mountPicker().text()
    expect(text).toContain('marks the CSV, PDF, TSV, TXT files AI Source Intake can analyze today.')
    expect(text).toContain('JPG, PNG, WebP files can be linked, but not analyzed.')
    expect(text).not.toContain('PDF and images can be linked')
  })
})

describe('failures are said, with a way back', () => {
  it('a failed folder load offers Retry', async () => {
    const wrapper = mountPicker({ libraryFoldersError: true })
    expect(wrapper.text()).toContain('Folders could not be loaded.')
    await wrapper.find('.ws-lib-folders .ws-lib-retry').trigger('click')
    expect(wrapper.emitted('retry-folders')).toHaveLength(1)
  })

  it('a failed file load offers Retry', async () => {
    const wrapper = mountPicker({ libraryFolderId: 'lt180c', libraryError: true })
    expect(wrapper.text()).toContain('Files could not be loaded.')
    await wrapper.find('.ws-lib-files .ws-lib-retry').trigger('click')
    expect(wrapper.emitted('retry-files')).toHaveLength(1)
  })
})
