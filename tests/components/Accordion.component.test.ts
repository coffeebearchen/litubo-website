// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import Accordion from '../../components/ui/Accordion.vue'

describe('Accordion SSR and hydration', () => {
  it('preserves unique accessible ids from server render through hydration and toggling', async () => {
    const page = () => h('main', [h(Accordion, { title: 'First' }), h(Accordion, { title: 'Second' })])
    const host = document.createElement('div')
    host.innerHTML = await renderToString(createSSRApp(page))
    document.body.appendChild(host)
    const serverIds = [...host.querySelectorAll('button')].map(button => button.getAttribute('aria-controls'))
    expect(new Set(serverIds).size).toBe(2)
    const app = createSSRApp(page)
    app.mount(host)
    try {
      const buttons = [...host.querySelectorAll('button')]
      expect(buttons.map(button => button.getAttribute('aria-controls'))).toEqual(serverIds)
      for (const button of buttons) {
        const region = host.querySelector(`[id="${button.getAttribute('aria-controls')}"]`)
        expect(region?.getAttribute('aria-labelledby')).toBe(button.id)
      }
      buttons[0].click()
      await nextTick()
      expect(buttons[0].getAttribute('aria-expanded')).toBe('true')
      expect(buttons[1].getAttribute('aria-expanded')).toBe('false')
    } finally {
      app.unmount()
      host.remove()
    }
  })
})
