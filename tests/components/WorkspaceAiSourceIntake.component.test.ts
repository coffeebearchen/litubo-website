// @vitest-environment happy-dom
/**
 * PWS-AI-ENGINE-01R — real component-mounting behavior tests for
 * `WorkspaceAiSourceIntake.vue`, using `@vue/test-utils` against the actual
 * mounted component (not `readFileSync` + string matching). This is a
 * purely presentational component (props/emits only, no Nuxt composable
 * calls), so it mounts directly without `@nuxt/test-utils`.
 */

import { describe, it, expect } from 'vitest'
import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import WorkspaceAiSourceIntake from '../../components/admin/workspace/WorkspaceAiSourceIntake.vue'
import type { ProductMedia } from '../../types/product-cms'

function media(overrides: Partial<ProductMedia> & { id: number }): ProductMedia {
  return {
    products_id: 1,
    directus_files_id: 'uuid',
    file_role: null,
    alt_en: null, alt_es: null, alt_pt: null,
    caption_en: null, caption_es: null, caption_pt: null,
    enabled: true,
    language: null,
    version_label: null,
    sort: null,
    file_date: null,
    filename_download: 'file.txt',
    type: 'text/plain',
    width: null, height: null,
    ...overrides,
  } as ProductMedia
}

const BASE_PROPS = {
  linkedMedia: [] as ProductMedia[],
  selectedIds: [] as number[],
  mediaResourcesHref: '/admin/product-workspace/1/media-resources',
  providers: [{ id: 'deepseek', label: 'DeepSeek', configured: true, isDefault: true }],
  providersLoading: false,
  providersError: false,
  selectedProviderId: 'deepseek',
  analyzing: false,
  analyzeError: null,
  fileResults: [],
}

function mountIntake(props: ComponentMountingOptions<typeof WorkspaceAiSourceIntake>['props']) {
  return mount(WorkspaceAiSourceIntake, {
    props,
    global: { stubs: { NuxtLink: { template: '<a><slot/></a>' } } },
  })
}

describe('WorkspaceAiSourceIntake — real mounted component', () => {
  it('clicking a text file\'s checkbox emits toggle with its id', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, linkedMedia: [media({ id: 5, type: 'text/plain', filename_download: 'notes.txt' })] })
    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('toggle')).toEqual([[5]])
  })

  it('an image file\'s checkbox is really disabled in the DOM — cannot be clicked into selection', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, linkedMedia: [media({ id: 6, type: 'image/jpeg', filename_download: 'photo.jpg' })] })
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Not available for text-source analysis yet')
  })

  it('an Excel file shows the distinct "Excel files are not supported" reason, not the generic one', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, linkedMedia: [media({ id: 7, type: 'application/vnd.ms-excel', filename_download: 'sheet.xls' })] })
    expect(wrapper.text()).toContain('Excel files are not supported for text-source analysis yet')
  })

  it('shows the live "N / 5 selected" counter', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, selectedIds: [1, 2] })
    expect(wrapper.text()).toContain('2 / 5 selected')
  })

  it('once 5 files are selected, an unselected file\'s checkbox becomes disabled (cap enforced in the DOM)', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      linkedMedia: [media({ id: 99, type: 'text/plain' })],
      selectedIds: [1, 2, 3, 4, 5],
    })
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('an already-selected file stays clickable (to deselect) even at the cap', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      linkedMedia: [media({ id: 1, type: 'text/plain' })],
      selectedIds: [1, 2, 3, 4, 5],
    })
    const checkbox = wrapper.find('input[type="checkbox"]')
    expect((checkbox.element as HTMLInputElement).disabled).toBe(false)
  })

  it('clicking "Analyze selected sources" emits analyze — only when enabled', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, linkedMedia: [media({ id: 1, type: 'text/plain' })], selectedIds: [1] })
    const button = wrapper.findAll('button').find(b => b.text().includes('Analyze selected sources'))!
    expect((button.element as HTMLButtonElement).disabled).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('analyze')).toHaveLength(1)
  })

  it('Analyze is really disabled in the DOM when no provider is configured, even with a valid selection', () => {
    const wrapper = mountIntake({
      ...BASE_PROPS,
      linkedMedia: [media({ id: 1, type: 'text/plain' })],
      selectedIds: [1],
      providers: [{ id: 'deepseek', label: 'DeepSeek', configured: false, isDefault: true }],
      selectedProviderId: null,
    })
    const button = wrapper.findAll('button').find(b => b.text().includes('Analyze selected sources'))!
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('AI provider is not configured.')
  })

  it('a provider-status fetch failure shows "Could not read provider status." with a Retry button that emits retry-providers', async () => {
    const wrapper = mountIntake({ ...BASE_PROPS, providers: [], providersError: true })
    expect(wrapper.text()).toContain('Could not read provider status.')
    expect(wrapper.text()).not.toContain('AI provider is not configured.')
    const retryButton = wrapper.findAll('button').find(b => b.text() === 'Retry')!
    await retryButton.trigger('click')
    expect(wrapper.emitted('retry-providers')).toHaveLength(1)
  })

  it('a product with only image files shows the honest no-readable-sources explanation with supported formats and a link back to Media & resources', () => {
    const wrapper = mountIntake({ ...BASE_PROPS, linkedMedia: [media({ id: 1, type: 'image/jpeg' }), media({ id: 2, type: 'image/png' })] })
    expect(wrapper.text()).toContain('PDF')
    expect(wrapper.text()).toContain('CSV')
    expect(wrapper.text()).toContain('TXT')
    expect(wrapper.find('a').exists()).toBe(true)
  })
})
