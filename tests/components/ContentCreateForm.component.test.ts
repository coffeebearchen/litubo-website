// @vitest-environment happy-dom
/**
 * CC-IMP-02 — Create Draft form, mounted, with `$fetch` stubbed: required
 * fields, the exact request body, success, and every foundation error status.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ContentCreateForm from '../../components/admin/content/ContentCreateForm.vue'

const TEST_TITLE = 'TEST ONLY — NOT FOR PUBLICATION'

function mountForm() {
  return mount(ContentCreateForm, {
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } },
  })
}

async function fill(wrapper: ReturnType<typeof mountForm>, values: { type?: string, title?: string, slug?: string, summary?: string }) {
  if (values.type !== undefined) await wrapper.find('#cc-create-type').setValue(values.type)
  if (values.title !== undefined) await wrapper.find('#cc-create-title').setValue(values.title)
  if (values.slug !== undefined) await wrapper.find('#cc-create-slug').setValue(values.slug)
  if (values.summary !== undefined) await wrapper.find('#cc-create-summary').setValue(values.summary)
}

async function submit(wrapper: ReturnType<typeof mountForm>) {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

const apiError = (statusCode: number, message?: string, field?: string) =>
  Object.assign(new Error('fetch failed'), { statusCode, data: { statusCode, message, data: field ? { field } : undefined } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ContentCreateForm — mounted', () => {
  it('opens with the five registry content types and no preselected type', () => {
    const wrapper = mountForm()
    const options = wrapper.findAll('#cc-create-type option')
    expect(options.map(o => o.text())).toEqual(['Select a content type', 'Technical Article', 'Application / Solution', 'Case Study', 'Resource / Download', 'News'])
    expect((wrapper.find('#cc-create-type').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.text()).toContain('Creates an English draft. Nothing is published.')
  })

  it('does not send an incomplete form', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountForm()
    await submit(wrapper)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Select a content type.')
    expect(wrapper.text()).toContain('Enter a title.')
    expect(wrapper.text()).toContain('Enter a slug.')
  })

  it('creates a draft with exactly the allowed fields and emits the new id', async () => {
    const fetchMock = vi.fn(async () => ({ id: 42, status: 'draft' }))
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountForm()
    await fill(wrapper, { type: 'case_study', title: `${TEST_TITLE} UI`, slug: 'test-only-ui', summary: ' Short summary ' })
    await submit(wrapper)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content-center', {
      method: 'POST',
      body: { content_type: 'case_study', title: `${TEST_TITLE} UI`, slug: 'test-only-ui', summary: 'Short summary' },
    })
    expect(wrapper.emitted('created')).toEqual([[42]])
  })

  it('shows a duplicate slug (409) at the slug field', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(409, 'This slug is already used for this language.', 'slug') }))
    const wrapper = mountForm()
    await fill(wrapper, { type: 'news', title: TEST_TITLE, slug: 'test-only-taken' })
    await submit(wrapper)
    expect(wrapper.find('#cc-create-slug-error').text()).toBe('This slug is already used for this language.')
    expect(wrapper.find('#cc-create-slug').attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('created')).toBeUndefined()
  })

  it('shows 422 validation at its field, including a rejected content type', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(422, '"new" is a reserved slug.', 'slug') }))
    const wrapper = mountForm()
    await fill(wrapper, { type: 'news', title: TEST_TITLE, slug: 'new' })
    await submit(wrapper)
    expect(wrapper.find('#cc-create-slug-error').text()).toBe('"new" is a reserved slug.')

    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(422, 'content_type must be one of the Content Center V1 types.', 'content_type') }))
    await submit(wrapper)
    expect(wrapper.find('#cc-create-type-error').text()).toBe('content_type must be one of the Content Center V1 types.')
  })

  it('shows 400, 401 and server failures as a visible message', async () => {
    const wrapper = mountForm()
    await fill(wrapper, { type: 'news', title: TEST_TITLE, slug: 'test-only-errors' })

    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(400, 'Request body must be a JSON object.') }))
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('could not be processed')

    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(401) }))
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('session has expired')
    expect(wrapper.find('[role="alert"] a').attributes('href')).toBe('/admin/login')

    vi.stubGlobal('$fetch', vi.fn(async () => { throw apiError(503) }))
    await submit(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('temporarily unavailable')
    expect(wrapper.emitted('created')).toBeUndefined()
  })
})
