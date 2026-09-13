/**
 * AI-PDF-SOURCE-01 — document-extractor entry point.
 *
 * Listens on every interface inside the container; Docker Compose publishes the
 * port on the host's loopback address only (127.0.0.1). The port is fixed here:
 * the service reads no configuration and no secrets from its environment.
 */

import { createExtractorServer } from './extractor.mjs'

const PORT = 8787

const server = createExtractorServer()

server.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', port: PORT }))
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close()
    process.exit(0)
  })
}
