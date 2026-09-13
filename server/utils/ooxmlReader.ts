/**
 * AI-XLSX-SOURCE-01 — a bounded reader for Office Open XML packages.
 *
 * An .xlsx file (and, in a later module, a .docx file) is a ZIP archive of XML
 * parts, and neither layer can be trusted. A ZIP entry can declare a few
 * kilobytes and inflate to gigabytes; an entry name can try to leave the
 * package; the same part can appear twice so that two readers disagree about
 * which copy counts; an XML part can carry a DTD whose entities expand without
 * end. This module is the one place those risks are handled, so a format reader
 * built on it only ever sees parser events from a part it asked for by name.
 *
 * - The archive is read by `yauzl` from the bytes already in memory. Nothing is
 *   written to disk, and no entry is ever extracted to a path.
 * - Every entry name is validated. A name that appears twice — compared without
 *   regard to case, the way Office compares part names — makes the package
 *   malformed instead of letting one copy win.
 * - A part is inflated as a stream and its actual output is counted as it
 *   arrives, per part and across the package. The sizes the archive declares
 *   are never used as a limit. The moment a ceiling is passed the stream is
 *   destroyed, which stops the inflation itself.
 * - XML is parsed by `saxes` as a stream of events and never built into a
 *   document tree. A DOCTYPE is refused outright, so no entity is ever defined;
 *   element depth and the length of any single token are capped.
 * - The deadline is checked on every chunk, not after the read.
 *
 * A refusal carries a code and nothing from the file: no entry name, no XML
 * fragment, no parser message.
 */

import yauzl, { type Entry, type ZipFile } from 'yauzl'
import { SaxesParser } from 'saxes'
import type { Readable } from 'node:stream'

export type OoxmlFailureCode = 'malformed' | 'encrypted' | 'too_complex' | 'timeout'

/**
 * A refusal. The message is the code itself, so nothing from the file can travel
 * with it. A format reader built on this module throws its own codes the same
 * way from inside an event handler, and they come back out of `readXml` intact.
 */
export class OoxmlFailure<C extends string = OoxmlFailureCode> extends Error {
  readonly code: C

  constructor(code: C) {
    super(code)
    this.name = 'OoxmlFailure'
    this.code = code
  }
}

/** Anything thrown that is not already a refusal is treated as a damaged file. */
export function asOoxmlFailure(error: unknown): OoxmlFailure<string> {
  return error instanceof OoxmlFailure ? error : new OoxmlFailure('malformed')
}

export const MAX_ZIP_ENTRIES = 1_000
export const MAX_TOTAL_DECOMPRESSED_BYTES = 64 * 1024 * 1024
export const MAX_XML_DEPTH = 128
export const MAX_XML_TOKEN_CHARS = 1024 * 1024

export interface OoxmlLimits {
  maxEntries: number
  maxTotalDecompressedBytes: number
  maxXmlDepth: number
  maxXmlTokenChars: number
}

export const OOXML_LIMITS: Readonly<OoxmlLimits> = Object.freeze({
  maxEntries: MAX_ZIP_ENTRIES,
  maxTotalDecompressedBytes: MAX_TOTAL_DECOMPRESSED_BYTES,
  maxXmlDepth: MAX_XML_DEPTH,
  maxXmlTokenChars: MAX_XML_TOKEN_CHARS,
})

/** The first bytes of an OLE compound file — the container Office puts an encrypted workbook in. */
const CFB_SIGNATURE = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] as const
/** The first bytes of a ZIP local file header, which an OOXML package starts with. */
const ZIP_SIGNATURE = [0x50, 0x4B, 0x03, 0x04] as const
/** Decoded XML goes to the parser in slices this size, so the token and deadline checks run often. */
const XML_SLICE_CHARS = 64 * 1024

function startsWithSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value)
}

/** `x:row` → `row`. A part may use any namespace prefix, so elements are matched by local name. */
export function localName(qualifiedName: string): string {
  const colon = qualifiedName.indexOf(':')
  return colon === -1 ? qualifiedName : qualifiedName.slice(colon + 1)
}

/**
 * Whether an entry name is a plain relative path inside the package. Checked on
 * the name as stored and again after NFKC, because a compatibility character —
 * a full-width full stop or solidus — can become `.` or `/` once normalized.
 */
export function isSafeEntryName(name: string): boolean {
  if (!name || name.length > 1024) return false
  for (const form of new Set([name, name.normalize('NFKC')])) {
    if (/[\p{Cc}\\]/u.test(form)) return false
    if (form.startsWith('/') || /^[a-z]:/i.test(form)) return false
    const path = form.endsWith('/') ? form.slice(0, -1) : form
    if (path.split('/').some(segment => segment === '' || segment === '.' || segment === '..')) return false
  }
  return true
}

export interface XmlEvents {
  open?(name: string, attributes: Readonly<Record<string, string>>): void
  close?(name: string): void
  text?(text: string): void
}

export interface OoxmlPackage {
  /** Whether the package holds this part. Part names compare without regard to case, as they do in Office. */
  has(partName: string): boolean
  /**
   * Streams one part's XML to `events`, inflating at most `maxBytes` of it. A
   * handler may throw an `OoxmlFailure` to stop the read. Rejects only with an
   * `OoxmlFailure`.
   */
  readXml(partName: string, maxBytes: number, events: XmlEvents): Promise<void>
  close(): void
}

export interface OoxmlOpenOptions {
  /** Epoch milliseconds after which reading stops with `timeout`. */
  deadline: number
  now?: () => number
  limits?: Partial<OoxmlLimits>
}

export async function openOoxmlPackage(bytes: Uint8Array, options: OoxmlOpenOptions): Promise<OoxmlPackage> {
  const limits: OoxmlLimits = { ...OOXML_LIMITS, ...options.limits }
  const now = options.now ?? Date.now
  const checkDeadline = () => {
    if (now() > options.deadline) throw new OoxmlFailure('timeout')
  }

  // An encrypted workbook is not a ZIP at all: Office wraps it in a compound file.
  if (startsWithSignature(bytes, CFB_SIGNATURE)) throw new OoxmlFailure('encrypted')
  if (!startsWithSignature(bytes, ZIP_SIGNATURE)) throw new OoxmlFailure('malformed')
  checkDeadline()

  const zipfile = await new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true },
      (error, opened) => (error || !opened ? reject(new OoxmlFailure('malformed')) : resolve(opened)),
    )
  })
  // yauzl reports some problems as events, and an 'error' event with no listener would throw.
  zipfile.on('error', () => {})

  const entries = new Map<string, Entry>()
  try {
    if (zipfile.entryCount > limits.maxEntries) throw new OoxmlFailure('too_complex')
    await new Promise<void>((resolve, reject) => {
      let seen = 0
      zipfile.on('entry', (entry: Entry) => {
        try {
          seen += 1
          if (seen > limits.maxEntries) throw new OoxmlFailure('too_complex')
          checkDeadline()
          if (!isSafeEntryName(entry.fileName)) throw new OoxmlFailure('malformed')
          if (!entry.fileName.endsWith('/')) {
            const key = entry.fileName.toLowerCase()
            // Two copies of one part: refuse, rather than let one of them win.
            if (entries.has(key)) throw new OoxmlFailure('malformed')
            entries.set(key, entry)
          }
          zipfile.readEntry()
        }
        catch (error) {
          reject(asOoxmlFailure(error))
        }
      })
      zipfile.once('end', () => resolve())
      zipfile.once('error', () => reject(new OoxmlFailure('malformed')))
      zipfile.readEntry()
    })
  }
  catch (error) {
    zipfile.close()
    throw asOoxmlFailure(error)
  }

  let totalBytes = 0

  function streamXml(stream: Readable, maxBytes: number, events: XmlEvents): Promise<void> {
    return new Promise((resolve, reject) => {
      const parser = new SaxesParser<{ xmlns: false, position: true }>({ xmlns: false, position: true })
      const decoder = new TextDecoder('utf-8')
      let partBytes = 0
      let depth = 0
      let lastTokenEnd = 0
      let handlerFailure: OoxmlFailure<string> | null = null
      let settled = false

      const settle = (error?: unknown) => {
        if (settled) return
        settled = true
        stream.destroy()
        if (error === undefined) resolve()
        else reject(asOoxmlFailure(error))
      }
      /** Runs a handler; whatever it throws stops the parse at the next check. */
      const handle = (run: () => void) => {
        if (handlerFailure) return
        try {
          run()
        }
        catch (error) {
          handlerFailure = asOoxmlFailure(error)
        }
      }
      const tokenEnded = () => {
        lastTokenEnd = parser.position
      }

      // No DTD is ever processed: its mere presence refuses the part.
      parser.on('doctype', () => handle(() => {
        throw new OoxmlFailure('malformed')
      }))
      parser.on('error', () => handle(() => {
        throw new OoxmlFailure('malformed')
      }))
      /** A finished token is measured exactly; the stream check below stops one that is still growing. */
      const checkToken = (token: string) => {
        if (token.length > limits.maxXmlTokenChars) throw new OoxmlFailure('too_complex')
      }

      parser.on('opentag', (tag) => {
        tokenEnded()
        depth += 1
        handle(() => {
          if (depth > limits.maxXmlDepth) throw new OoxmlFailure('too_complex')
          checkToken(tag.name)
          for (const value of Object.values(tag.attributes)) checkToken(value)
          events.open?.(localName(tag.name), tag.attributes)
        })
      })
      parser.on('closetag', (tag) => {
        tokenEnded()
        depth -= 1
        handle(() => events.close?.(localName(tag.name)))
      })
      parser.on('text', (text) => {
        tokenEnded()
        handle(() => {
          checkToken(text)
          events.text?.(text)
        })
      })
      parser.on('cdata', (text) => {
        tokenEnded()
        handle(() => {
          checkToken(text)
          events.text?.(text)
        })
      })
      parser.on('comment', (comment) => {
        tokenEnded()
        handle(() => checkToken(comment))
      })
      parser.on('processinginstruction', tokenEnded)
      parser.on('xmldecl', tokenEnded)

      // Never hand the parser more than one token's worth at once, so a growing token is caught mid-way.
      const sliceChars = Math.max(1, Math.min(XML_SLICE_CHARS, limits.maxXmlTokenChars))
      let fedChars = 0
      const feed = (text: string) => {
        for (let offset = 0; offset < text.length; offset += sliceChars) {
          const slice = text.slice(offset, offset + sliceChars)
          parser.write(slice)
          fedChars += slice.length
          if (handlerFailure) throw handlerFailure
          // Nothing has ended for this long: one text run, attribute, comment or name is too large.
          // `parser.position` is exact only while an event is being handled, so what was fed is counted here.
          if (fedChars - lastTokenEnd > limits.maxXmlTokenChars) throw new OoxmlFailure('too_complex')
          checkDeadline()
        }
      }

      stream.on('data', (chunk: Buffer) => {
        if (settled) return
        try {
          partBytes += chunk.length
          totalBytes += chunk.length
          if (partBytes > maxBytes || totalBytes > limits.maxTotalDecompressedBytes) throw new OoxmlFailure('too_complex')
          checkDeadline()
          feed(decoder.decode(chunk, { stream: true }))
        }
        catch (error) {
          settle(error)
        }
      })
      stream.on('error', () => settle(new OoxmlFailure('malformed')))
      stream.on('end', () => {
        if (settled) return
        try {
          feed(decoder.decode())
          parser.close()
          if (handlerFailure) throw handlerFailure
          settle()
        }
        catch (error) {
          settle(error)
        }
      })
    })
  }

  return {
    has: partName => entries.has(partName.toLowerCase()),
    readXml(partName, maxBytes, events) {
      return new Promise((resolve, reject) => {
        const entry = entries.get(partName.toLowerCase())
        if (!entry) return reject(new OoxmlFailure('malformed'))
        if (entry.isEncrypted()) return reject(new OoxmlFailure('encrypted'))
        try {
          checkDeadline()
        }
        catch (error) {
          return reject(asOoxmlFailure(error))
        }
        zipfile.openReadStream(entry, (error, stream) => {
          if (error || !stream) return reject(new OoxmlFailure('malformed'))
          streamXml(stream, maxBytes, events).then(resolve, reject)
        })
      })
    },
    close: () => zipfile.close(),
  }
}
