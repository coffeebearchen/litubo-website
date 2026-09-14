// @vitest-environment happy-dom
/**
 * CC-IMP-02 — CC-00 list body, mounted: records, loading, error and both empty states.
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContentList from '../../components/admin/content/ContentList.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import type { AdminContentListItem } from '../../types/content-center'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION'

const item = (id: number, overrides: Partial<AdminContentListItem> = {}): AdminContentListItem => ({
  id,
  content_type: 'technical_article',
  status: 'draft',
  date_created: '2026-09-14T10:00:00Z',
  date_updated: '2026-09-15T10:00:00Z',
  locales: [{ locale: 'en', title: `${TEST_TITLE} ${id}`, slug: `test-only-${id}`, draft_revision: 1 }],
  ...overrides,
})

const BASE = { items: [] as AdminContentListItem[], loading: false, error: null as string | null, hasFilters: false }

function mountList(props: Partial<typeof BASE>) {
  return mount(ContentList, {
    props: { ...BASE, ...props },
    global: {
      components: { StatusBadge },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } },
    },
  })
}

describe('ContentList — mounted', () => {
  it('renders real records in the table and the card list', () => {
    const wrapper = mountList({
      items: [
        item(5),
        item(4, { content_type: 'news', locales: [
          { locale: 'en', title: `${TEST_TITLE} B`, slug: 'test-only-b', draft_revision: 1 },
          { locale: 'es', title: `${TEST_TITLE} B ES`, slug: 'test-only-b-es', draft_revision: 1 },
        ] }),
      ],
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain(`${TEST_TITLE} 5`)
    expect(rows[0].text()).toContain('test-only-5')
    expect(rows[0].text()).toContain('Technical Article')
    expect(rows[0].text()).toContain('Draft')
    expect(rows[1].text()).toContain('News')
    expect(rows[1].findAll('.cc-locale-chip').map(c => c.text())).toEqual(['EN', 'ES'])
    expect(rows[0].find('a').attributes('href')).toBe('/admin/content-center/5/overview')
    expect(wrapper.findAll('.cc-card')).toHaveLength(2)
    expect(wrapper.find('.cc-card-open').attributes('href')).toBe('/admin/content-center/5/overview')
  })

  it('shows a loading state without any rows', () => {
    const wrapper = mountList({ loading: true, items: [item(1)] })
    expect(wrapper.find('[role="status"]').text()).toBe('Loading content…')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows the error with a retry action', async () => {
    const wrapper = mountList({ error: 'Content Center is temporarily unavailable. Try again in a moment.' })
    expect(wrapper.find('[role="alert"]').text()).toContain('temporarily unavailable')
    await wrapper.find('[role="alert"] button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows the first-draft empty state when there is no content', () => {
    const wrapper = mountList({})
    expect(wrapper.text()).toContain('No content yet.')
    expect(wrapper.text()).toContain('Create your first draft.')
    expect(wrapper.find('a').attributes('href')).toBe('/admin/content-center/new')
  })

  it('shows a filtered empty state with Clear filters', async () => {
    const wrapper = mountList({ hasFilters: true })
    expect(wrapper.text()).toContain('No content matches these filters.')
    expect(wrapper.text()).not.toContain('No content yet.')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('clear-filters')).toHaveLength(1)
  })
})
