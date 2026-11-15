/**
 * CC-IMP-10 — Phase 1 public route ownership of the legacy `posts` collection (D-035).
 *
 * Technical Article and Case Study detail pages are served only by Content Center;
 * News is not public in Phase 1 (D-004 / D-013). The legacy `posts` API therefore
 * serves only the types whose public pages still read it: Technical Guides and FAQ.
 * No `posts` row is migrated, changed or deleted.
 */

import sanitizeHtml from 'sanitize-html'
import { publicFileId, publicMediaUrl, type PublicFile } from './contentPublic'

export const LEGACY_PUBLIC_POST_TYPES = ['technical_guide', 'insight', 'faq'] as const

export type LegacyPublicPostType = (typeof LEGACY_PUBLIC_POST_TYPES)[number]

export function isLegacyPublicPostType(value: unknown): value is LegacyPublicPostType {
  return typeof value === 'string' && (LEGACY_PUBLIC_POST_TYPES as readonly string[]).includes(value)
}

// ── Body HTML (LITUBO-STABLE-BASELINE-CLOSEOUT-01, RSG-06) ────────────────────

/**
 * The one HTML rule for legacy post bodies, used by the Technical Guide detail and the FAQ list.
 *
 * RSG-06 works on ids here, not on URL shapes. `files` is the caller's request-time `resolvePublicFiles`
 * result for every UUID the body contains (`legacyBodyFileIds`); a UUID may reach public output only while it
 * names a file that result allows (is_public, not archived, existing).
 *   - Link targets and image sources are read the way a browser reads them (control characters dropped,
 *     backslashes as slashes, percent-escapes decoded, dot segments resolved). An image is kept only when it
 *     points at an allowed Directus file (`/assets/<id>` or `/api/cms/media/<id>`) and is then served through
 *     the public proxy. A link that carries any UUID is kept only when it points at an allowed file (rewritten
 *     to the proxy); otherwise it keeps its text and loses the link. Links without a UUID are kept as they are.
 *   - A whitespace-free text or alt-text word that carries a refused UUID is removed whole; after sanitizing,
 *     every UUID-shaped string that is not an allowed file id is removed wherever it is.
 *   - If a refused id can still be read in the visible text (split by markup or invisible characters), the
 *     body for that locale is withheld (empty) — fail closed.
 * A UUID that has nothing to do with files (for example in an external link) is treated the same way. Other
 * links, text and the markup listed below are kept. The stored body is never changed.
 */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_ALL = new RegExp(UUID, 'gi')
const FILE_REF = new RegExp(`/(?:assets|api/cms/media)/(${UUID})(?:[/?#]|$)`, 'i')
const WORD = /\S+/g
// Characters that render as nothing, so they can split an id without showing (code point ranges).
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0xad, 0xad], [0x34f, 0x34f], [0x61c, 0x61c], [0x115f, 0x1160], [0x17b4, 0x17b5], [0x180e, 0x180e], [0x200b, 0x200f],
  [0x202a, 0x202e], [0x2060, 0x206f], [0x3164, 0x3164], [0xfe00, 0xfe0f], [0xfeff, 0xfeff], [0xffa0, 0xffa0],
]
const withoutInvisible = (text: string): string => Array.from(text).filter((char) => {
  const code = char.codePointAt(0)!
  return !INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to)
}).join('')
const SIZE = /^\d{1,4}%?$/
const SPAN = /^\d{1,3}$/

const uuidsIn = (value: string): string[] => (value.match(UUID_ALL) ?? []).map(id => id.toLowerCase())

/** Every UUID-shaped string in the bodies: the ids the caller checks in one `resolvePublicFiles` read. */
export function legacyBodyFileIds(...bodies: Array<string | null | undefined>): string[] {
  return [...new Set(bodies.flatMap(body => uuidsIn(body ?? '')))]
}

/** A URL as a browser reads it, without its host: controls dropped, `\` as `/`, %XX decoded, dot segments resolved. */
function browserPath(value: string): string {
  // eslint-disable-next-line no-control-regex
  let url = value.replace(/[\x00-\x1f\x7f]/g, '').replace(/\\/g, '/')
  for (let pass = 0; pass < 3; pass++) {
    const next = url.replace(/%([0-9a-f]{2})/gi, (_escape, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    if (next === url) break
    url = next
  }
  try {
    const parsed = new URL(url, 'https://site.invalid/')
    return `${parsed.pathname.replace(/\/{2,}/g, '/')}${parsed.search}${parsed.hash}`
  }
  catch {
    return url
  }
}

export function legacyPostHtml(raw: string | null | undefined, files: ReadonlyMap<string, PublicFile>): string {
  if (!raw) return ''
  const allowed = (id: string) => publicFileId(files, id) !== null
  const withoutRefusedWords = (text: string) => text.replace(WORD, word => (uuidsIn(word).every(allowed) ? word : ''))
  const pick = (attribs: sanitizeHtml.Attributes, names: string[], pattern: RegExp) =>
    Object.fromEntries(names.filter(name => pattern.test(attribs[name] ?? '')).map(name => [name, attribs[name]!]))
  // The allowed file a link target or image source points at, or null.
  const allowedFileOf = (target: string): string | null => {
    const path = browserPath(target)
    const ref = path.match(FILE_REF)
    return ref && uuidsIn(path).every(allowed) ? publicFileId(files, ref[1]) : null
  }

  const html = sanitizeHtml(raw, {
    allowedTags: [
      'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li',
      'strong', 'em', 'b', 'i', 's',
      'a', 'blockquote', 'code', 'pre', 'br',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      img: ['src', 'alt', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    textFilter: withoutRefusedWords,
    transformTags: {
      a: (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
        const href = attribs.href ?? ''
        if (uuidsIn(browserPath(href)).length === 0) {
          return { tagName: 'a', attribs: { href, rel: 'noopener noreferrer', target: href.startsWith('/') ? '_self' : '_blank' } }
        }
        const id = allowedFileOf(href)
        if (!id) return { tagName: '', attribs: {} }
        const download = /(?:^|[?&])download(?:=(?:1|true))?(?:[&#]|$)/i.test(browserPath(href).split('?')[1] ?? '')
        return { tagName: 'a', attribs: { href: publicMediaUrl(id, download), rel: 'noopener noreferrer', target: '_self' } }
      },
      img: (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
        const id = allowedFileOf(attribs.src ?? '')
        if (!id) return { tagName: '', attribs: {} }
        return { tagName: 'img', attribs: { src: publicMediaUrl(id), alt: withoutRefusedWords(attribs.alt ?? ''), ...pick(attribs, ['width', 'height'], SIZE) } }
      },
      td: (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => ({ tagName: 'td', attribs: pick(attribs, ['colspan', 'rowspan'], SPAN) }),
      th: (_tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => ({ tagName: 'th', attribs: pick(attribs, ['colspan', 'rowspan'], SPAN) }),
    },
  }).replace(UUID_ALL, id => (allowed(id) ? id : ''))

  // Fail closed: a refused id that can still be read once markup and invisible characters are gone.
  const visible = withoutInvisible(html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, ''))
  if (uuidsIn(visible).some(id => !allowed(id))) {
    console.warn('[cms/posts] body withheld: a file id is split by markup or invisible characters')
    return ''
  }
  return html
}
