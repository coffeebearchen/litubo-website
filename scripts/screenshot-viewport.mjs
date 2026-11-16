/**
 * True narrow-viewport screenshots via the Chrome DevTools Protocol.
 *
 * `chrome --headless --window-size=320` does not render at 320: the window is clamped to about
 * 500 CSS px and the PNG is simply cropped, so a "320" capture looks like a broken layout that is
 * not actually broken. `Emulation.setDeviceMetricsOverride` changes the real layout viewport, which
 * is what a phone does.
 *
 * Usage:
 *   node scripts/screenshot-viewport.mjs <url> <width> <height> <outfile> [fullPage]
 *
 * Requires Chrome reachable on 127.0.0.1:9222 (the caller starts it).
 */
import { writeFile } from 'node:fs/promises'

const [url, widthArg, heightArg, outFile, fullArg] = process.argv.slice(2)
if (!url || !outFile) {
  console.error('usage: screenshot-viewport.mjs <url> <width> <height> <outfile> [full]')
  process.exit(1)
}
const width = Number(widthArg) || 390
const height = Number(heightArg) || 844
const fullPage = fullArg === 'full'

async function target() {
  const res = await fetch('http://127.0.0.1:9222/json')
  const list = await res.json()
  const page = list.find(t => t.type === 'page')
  if (!page) throw new Error('no page target')
  return page.webSocketDebuggerUrl
}

const wsUrl = await target()
const ws = new WebSocket(wsUrl)
let id = 0
const pending = new Map()

function send(method, params = {}) {
  const msgId = ++id
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
    setTimeout(() => {
      if (pending.has(msgId)) {
        pending.delete(msgId)
        reject(new Error(`timeout: ${method}`))
      }
    }, 45000)
  })
}

let loadedResolve
const loaded = new Promise(r => { loadedResolve = r })

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }
  if (msg.method === 'Page.loadEventFired') loadedResolve()
})

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width < 768,
})
// Report the viewport the page really sees, so a crop can never be mistaken for a layout again.
await send('Page.navigate', { url })
await Promise.race([loaded, new Promise(r => setTimeout(r, 25000))])
await new Promise(r => setTimeout(r, 3000))

const metrics = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ inner: window.innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth })`,
  returnByValue: true,
})

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: fullPage,
})
await writeFile(outFile, Buffer.from(shot.data, 'base64'))

const m = JSON.parse(metrics.result.value)
console.log(JSON.stringify({
  file: outFile,
  viewport: m.inner,
  documentWidth: m.doc,
  bodyWidth: m.body,
  overflow: m.doc > m.inner,
}))
ws.close()
process.exit(0)
