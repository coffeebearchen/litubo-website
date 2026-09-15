// @vitest-environment happy-dom
/**
 * CC-IMP-07 — Change History panel and the archived Workspace banner, mounted, with `$fetch`
 * stubbed: read-only trail (no rollback / revert / delete), confirmed Archive and Restore with
 * the lifecycle fingerprint, conflict reload and pagination.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentHistory from '../../components/admin/content/ContentHistory.vue'
import ContentWorkspaceShell from '../../components/admin/content/ContentWorkspaceShell.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import type { AdminContentHistory } from '../../types/content-center'

const FP = 'a'.repeat(32)

function history(overrides: Partial<AdminContentHistory> = {}): AdminContentHistory {
  return {
    item: { id: 6, content_type: 'technical_article', status: 'draft', title: 'TEST ONLY — NOT FOR PUBLICATION' },
    lifecycle: { status: 'draft', archived_at: null, first_published_at: null, published_locales: [], lifecycleFingerprint: FP, can_archive: true, can_restore: false },
    events: [
      { id: 'rev-3', timestamp: '2026-09-15T10:00:00Z', kind: 'seo_updated', category: 'SEO', label: 'SEO updated', locale: 'en', area: null, changes: ['SEO title'], actor: 'TEST ONLY Admin', revision: 6 },
      { id: 'rev-2', timestamp: '2026-09-15T09:00:00Z', kind: 'media_linked', category: 'Media', label: 'Media linked', locale: null, area: 'Hero image · hero.png', changes: [], actor: 'System / Unknown', revision: null },
      { id: 'rev-1', timestamp: '2026-09-15T08:00:00Z', kind: 'created', category: 'Lifecycle', label: 'Content created', locale: null, area: null, changes: [], actor: 'TEST ONLY Admin', revision: null },
    ],
    page: 1,
    limit: 25,
    total: 3,
    pages: 1,
    truncated: false,
    limitations: ['History begins from the Directus revisions available for this content.'],
    ...overrides,
  }
}

const archivedHistory = () => history({
  item: { ...history().item, status: 'archived' },
  lifecycle: { ...history().lifecycle, status: 'archived', archived_at: '2026-09-15T11:00:00Z', lifecycleFingerprint: 'b'.repeat(32), can_archive: false, can_restore: true },
})

const mountPanel = (value = history()) => mount(ContentHistory, { props: { initial: value }, attachTo: document.body })
const apiError = (statusCode: number, data: Record<string, unknown>) =>
  Object.assign(new Error('fetch failed'), { statusCode, data: { statusCode, message: 'x', data } })

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('ContentHistory — read-only trail', () => {
  it('shows events newest first with safe details and offers no rollback, revert or delete', () => {
    const wrapper = mountPanel()
    expect(wrapper.findAll('.chi-label').map(e => e.text())).toEqual(['SEO updated', 'Media linked', 'Content created'])
    expect(wrapper.findAll('.chi-detail').map(e => e.text())).toEqual(['English · SEO title · Revision 6', 'Hero image · hero.png'])
    expect(wrapper.findAll('.chi-actor').map(e => e.text())).toEqual(['By TEST ONLY Admin', 'By System / Unknown', 'By TEST ONLY Admin'])
    expect(wrapper.findAll('button').map(b => b.text())).toEqual(['Archive content'])
    expect(wrapper.text()).not.toMatch(/rollback|revert|delete permanently|restore this revision/i)
    expect(wrapper.text()).toContain('cannot be edited or rolled back here')
  })

  it('states when there is no history', () => {
    expect(mountPanel(history({ events: [], total: 0 })).text()).toContain('No history yet.')
  })

  it('pages through the server', async () => {
    const fetchMock = vi.fn(async () => history({ page: 2, pages: 2, total: 26, events: [] }))
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountPanel(history({ pages: 2, total: 26 }))
    await wrapper.findAll('button').find(b => b.text() === 'Next')!.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center/6/history', { query: { page: 2 } })
    expect(wrapper.find('.chi-page').text()).toBe('Page 2 of 2')
  })
})

describe('ContentHistory — Archive / Restore', () => {
  it('Archive opens an explicit confirmation; Cancel sends nothing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountPanel()
    await wrapper.find('.chi-archive').trigger('click')
    const dialog = wrapper.find('[role="alertdialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.findAll('.chi-dialog-text p').map(p => p.text())).toEqual([
      'This content will be archived.',
      'It will no longer be eligible for public delivery.',
      'Draft content and history will be preserved.',
    ])
    expect(dialog.text()).not.toMatch(/delete|remove permanently/i)
    await dialog.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('confirmed Archive sends the lifecycle fingerprint, then reloads the trail and offers Restore', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ result: 'archived', lifecycle: archivedHistory().lifecycle })
      .mockResolvedValueOnce(archivedHistory())
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountPanel()
    await wrapper.find('.chi-archive').trigger('click')
    await wrapper.find('[role="alertdialog"] .chi-archive').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/admin/content-center/6/archive', { method: 'POST', body: { expectedLifecycleFingerprint: FP } })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/content-center/6/history', { query: { page: 1 } })
    expect(wrapper.find('.chi-notice--success').text()).toBe('The content was archived. It is read-only until it is restored.')
    expect(wrapper.find('.chi-primary').text()).toBe('Restore to draft')
    expect(wrapper.find('.chi-archive').exists()).toBe(false)
    expect(wrapper.emitted('state')!.at(-1)![0]).toMatchObject({ item: { status: 'archived' } })
  })

  it('Restore explains that it does not publish, and a stale state shows Reload', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(apiError(409, { code: 'lifecycle_changed' }))
      .mockResolvedValueOnce(history())
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountPanel(archivedHistory())
    await wrapper.find('.chi-primary').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').text()).toContain('Restoring does not publish the content.')
    await wrapper.find('[role="alertdialog"] .chi-primary').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/admin/content-center/6/restore', { method: 'POST', body: { expectedLifecycleFingerprint: 'b'.repeat(32) } })
    expect(wrapper.find('.chi-notice--error').text()).toContain('changed since the page was loaded')
    await wrapper.find('.chi-notice button').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/content-center/6/history', { query: { page: 1 } })
    expect(wrapper.find('.chi-archive').exists()).toBe(true)
  })
})

describe('ContentWorkspaceShell — archived records are marked read-only', () => {
  it('shows the banner only for archived content', () => {
    const shell = (status: 'draft' | 'archived') => mount(ContentWorkspaceShell, {
      props: { recordTitle: 'TEST ONLY', pageTitle: 'Overview', subtitle: 'Sub', status },
      global: { components: { StatusBadge }, stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
    })
    expect(shell('archived').find('.cc-archived').text()).toContain('Archived · Read only.')
    expect(shell('draft').find('.cc-archived').exists()).toBe(false)
  })
})
