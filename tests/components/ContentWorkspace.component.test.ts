// @vitest-environment happy-dom
/**
 * CC-IMP-02 — Content Workspace shell, module rail and CC-01 Overview, mounted.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContentOverview from '../../components/admin/content/ContentOverview.vue'
import ContentWorkspaceNav from '../../components/admin/content/ContentWorkspaceNav.vue'
import ContentWorkspaceShell from '../../components/admin/content/ContentWorkspaceShell.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import WorkspaceNavIcon from '../../components/admin/workspace/WorkspaceNavIcon.vue'
import type { AdminContentDraftDetail } from '../../types/content-center'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION Concurrent A r3'

const global = {
  components: { StatusBadge, WorkspaceNavIcon },
  stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } },
}

const draft: AdminContentDraftDetail = {
  id: 5,
  content_type: 'technical_article',
  status: 'draft',
  first_published_at: null,
  archived_at: null,
  date_created: '2026-09-14T16:25:00Z',
  date_updated: '2026-09-15T00:30:00Z',
  linkCounts: { media: 0, relations: 0 },
  locales: [{
    id: 13,
    content_items_id: 5,
    locale: 'en',
    title: TEST_TITLE,
    slug: 'cc-imp-01-fix-cas-pkeyyv',
    summary: 'Summary A r3',
    blocks: [
      { id: 'a', type: 'text', data: { paragraphs: [''] } },
      { id: 'b', type: 'key_points', data: { items: [] } },
      { id: 'c', type: 'faq', data: { items: [] } },
      { id: 'd', type: 'cta', data: { label: '', href: '/' } },
      { id: 'e', type: 'related_content', data: {} },
    ] as never,
    seo_title: null,
    seo_description: null,
    canonical_path: null,
    noindex: false,
    draft_revision: 4,
    published_revision: null,
    published_at: null,
    first_published_at: null,
    last_change_kind: 'manual_edit',
  }],
}

describe('ContentWorkspaceNav — mounted', () => {
  const wrapper = mount(ContentWorkspaceNav, {
    props: { itemId: 5, title: TEST_TITLE, typeLabel: 'Technical Article', status: 'draft', activeKey: 'overview' },
    global,
  })

  it('shows the record identity and a way back to the list', () => {
    expect(wrapper.find('.cc-nav-name').text()).toBe(TEST_TITLE)
    expect(wrapper.find('.cc-nav-type').text()).toBe('Technical Article')
    expect(wrapper.find('.cc-nav-back').attributes('href')).toBe('/admin/content-center')
  })

  it('enables only Overview; future modules are disabled buttons that link nowhere', () => {
    const active = wrapper.find('[aria-current="page"]')
    expect(active.text()).toBe('Overview')
    const disabled = wrapper.findAll('button.cc-nav-item--disabled')
    expect(disabled.map(b => b.find('.cc-nav-item-label').text())).toEqual([
      'Content editor', 'Media & relations', 'SEO & locales', 'AI Source Intake',
      'AI Proposal Review', 'Preview & publish readiness', 'Change history',
    ])
    for (const button of disabled) {
      expect(button.attributes('disabled')).toBeDefined()
      expect(button.text()).toContain('Not built yet')
    }
    // The back link is the rail's only anchor.
    expect(wrapper.findAll('a').map(a => a.attributes('href'))).toEqual(['/admin/content-center'])
  })

  it('offers a disclosure toggle for narrow viewports', async () => {
    const toggle = wrapper.find('.cc-nav-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.cc-nav').classes()).toContain('cc-nav--open')
  })
})

describe('ContentWorkspaceShell — mounted', () => {
  it('renders breadcrumb, title, status and a Refresh action', async () => {
    const wrapper = mount(ContentWorkspaceShell, {
      props: { recordTitle: TEST_TITLE, pageTitle: 'Overview', subtitle: 'Sub', status: 'draft' },
      slots: { nav: '<aside>rail</aside>', default: '<p>main</p>' },
      global,
    })
    expect(wrapper.find('nav[aria-label="Breadcrumb"]').text()).toContain('Content Center')
    expect(wrapper.find('[aria-current="page"]').text()).toBe(TEST_TITLE)
    expect(wrapper.find('h1').text()).toBe('Overview')
    expect(wrapper.find('.badge').text()).toBe('Draft')
    const refresh = wrapper.findAll('button').find(b => b.text() === 'Refresh')!
    await refresh.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.text()).not.toMatch(/Save changes|Publish|AI Fill/)
  })
})

describe('ContentOverview — mounted', () => {
  const wrapper = mount(ContentOverview, { props: { draft }, global })
  const card = (heading: string) => wrapper.findAll('section').find(s => s.find('h2').text() === heading)!

  it('shows identity, type and lifecycle from the real record', () => {
    expect(card('Content identity').text()).toContain(TEST_TITLE)
    expect(card('Content identity').text()).toContain('cc-imp-01-fix-cas-pkeyyv')
    expect(card('Content identity').text()).toContain('Summary A r3')
    expect(card('Content type').text()).toContain('Technical Article')
    const lifecycle = card('Lifecycle status').text()
    expect(lifecycle).toContain('Draft')
    expect(lifecycle).toContain('14 Sept 2026')
    expect(lifecycle).toContain('Never published')
    expect(lifecycle).toMatch(/Draft revision\s*4/)
  })

  it('shows language, section, SEO and link summaries without editing controls', () => {
    const languages = card('Language status').findAll('li').map(li => li.text())
    expect(languages[0]).toContain('English (default)')
    expect(languages[0]).toContain('Draft')
    expect(languages[1]).toContain('Not started')
    expect(languages[2]).toContain('Not started')
    expect(card('Structured content').text()).toMatch(/5\s*sections/)
    expect(card('SEO status').text()).toContain('Missing — title is used')
    expect(card('SEO status').text()).toContain('Allowed')
    expect(card('Media & relations').text()).toMatch(/0\s*linked media/)
    expect(card('Media & relations').text()).toMatch(/0\s*related records/)
    expect(wrapper.findAll('input, textarea, select, button')).toHaveLength(0)
  })

  it('states readiness and AI as unavailable, never as a score', () => {
    expect(card('Readiness').text()).toContain('Not available yet')
    expect(card('AI-assisted content').text()).toContain('AI workflow not configured')
    expect(wrapper.text()).not.toMatch(/%|score|confidence|suggestions ready/i)
    const modules = card('Workspace modules').findAll('li').map(li => li.text())
    expect(modules[0]).toMatch(/Overview\s*Available/)
    expect(modules.slice(1).every(text => text.includes('Not built yet'))).toBe(true)
  })
})
