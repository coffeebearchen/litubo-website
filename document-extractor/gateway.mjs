/**
 * AI-PDF-SOURCE-01 — loopback gateway for the document-extractor.
 *
 * The extractor sits on an internal Docker network with no route out. That is
 * what keeps an exploited PDF parser from reaching the Internet, the host, or
 * Directus. Docker publishes no port for a container that is only on an
 * internal network (verified on Docker Engine 29.1.3 / Docker Desktop), so a
 * host-process Nuxt could not reach the extractor at all.
 *
 * This gateway closes that gap and does nothing else. It accepts TCP
 * connections on the loopback-published port and pipes each one, unread and
 * unlogged, to one fixed address: document-extractor:8787. It parses nothing,
 * never takes a destination from its input, and keeps no state. A Nuxt running
 * inside the Compose project can join the internal network and skip it.
 */

import { connect, createServer } from 'node:net'

const LISTEN_PORT = 8787
const TARGET = Object.freeze({ host: 'document-extractor', port: 8787 })
/** Longer than the extractor's own 15 s task deadline, so a slow extraction is never cut off here. */
const IDLE_TIMEOUT_MS = 30_000

const server = createServer((client) => {
  const upstream = connect(TARGET)
  const abort = () => {
    client.destroy()
    upstream.destroy()
  }
  client.setTimeout(IDLE_TIMEOUT_MS, abort)
  client.on('error', abort)
  upstream.on('error', abort)
  // A client that has gone has nothing left to receive; the extractor sees the
  // closed connection and stops the work.
  client.on('close', () => upstream.destroy())
  // When the extractor finishes its answer, pipe() flushes it to the client and
  // then ends the client connection — never cut off mid-response.
  client.pipe(upstream)
  upstream.pipe(client)
})

server.maxConnections = 32
server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'gateway_listening', port: LISTEN_PORT }))
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close()
    process.exit(0)
  })
}
