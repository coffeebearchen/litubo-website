/**
 * CC-IMP-06 — Preview & Publish Readiness page state (client).
 *
 * Every value comes from `GET /api/admin/content-center/:id/preview-publish`.
 * Readiness is shown as the server computed it — pass / blocker / warning, no
 * score or percentage — and the page never decides that content is publishable:
 * the Publish route recomputes readiness itself. A disabled button is only a
 * convenience; the server refuses the same request.
 */

import type {
  AdminContentPreviewMedia,
  AdminContentPreviewPublish,
  ContentReadiness,
} from '../types/content-center'
import { CONTENT_LOCALE_LABELS, CONTENT_LOCALE_STATE_LABELS, contentApiErrorStatus } from './contentCenter'
import { isImageMimeType } from './contentMediaRelations'
import { workspaceMediaThumbUrl } from './productWorkspace'

export const DRAFT_PREVIEW_BANNER = 'Draft preview · Not public'

export interface ReadinessCounts {
  blockers: number
  warnings: number
}

export function readinessCounts(readiness: ContentReadiness): ReadinessCounts {
  return {
    blockers: readiness.hard.filter(check => check.state === 'fail').length,
    warnings: readiness.soft.filter(check => check.state === 'warn').length,
  }
}

export function readinessHeadline(readiness: ContentReadiness): string {
  return readiness.ready ? 'Ready to publish' : 'Blocked'
}

const localeLabel = (state: AdminContentPreviewPublish) => CONTENT_LOCALE_LABELS[state.locale]

export function currentDraftRevision(state: AdminContentPreviewPublish): number | null {
  return state.locales.find(l => l.locale === state.locale)?.draft_revision ?? null
}

/** A default-language snapshot exists but the item is not published yet (an earlier publish stopped part-way). */
function needsFinishing(state: AdminContentPreviewPublish): boolean {
  return state.locale === state.default_locale && state.publication.has_snapshot && state.item.status !== 'published'
}

export interface PublishAction {
  enabled: boolean
  label: string
  /** Why Publish is not available, in the user's words; `null` when it is. */
  reason: string | null
}

export function publishAction(state: AdminContentPreviewPublish): PublishAction {
  const label = `Publish ${localeLabel(state)}`
  if (!state.preview) return { enabled: false, label, reason: `${localeLabel(state)} has not been started.` }
  const blockers = state.readiness.hard.filter(check => check.state === 'fail')
  if (blockers.length > 0) {
    const more = blockers.length > 1 ? ` (+${blockers.length - 1} more)` : ''
    return { enabled: false, label, reason: `${blockers[0].label}${more}` }
  }
  if (needsFinishing(state)) return { enabled: true, label: 'Finish publishing', reason: null }
  if (state.publication.has_snapshot && !state.publication.unpublished_changes) {
    return { enabled: false, label: 'Published', reason: 'The published version is up to date.' }
  }
  return { enabled: true, label: state.publication.has_snapshot ? `Publish ${localeLabel(state)} again` : label, reason: null }
}

export function publishConfirmMessage(state: AdminContentPreviewPublish): string {
  const name = localeLabel(state)
  return state.publication.has_snapshot
    ? `Publish the current ${name} draft? It replaces the published ${name} version.`
    : `Publish the ${name} version of this content now?`
}

export function unpublishConfirmMessage(state: AdminContentPreviewPublish): string {
  const name = localeLabel(state)
  return state.locale === state.default_locale
    ? `Unpublish ${name}? Every language of this content is unpublished and the content returns to Draft. Drafts are kept.`
    : `Unpublish ${name}? Other languages stay as they are. The ${name} draft is kept.`
}

export function publicationOutcomeMessage(result: string, state: AdminContentPreviewPublish): string {
  const name = localeLabel(state)
  switch (result) {
    case 'published': return `${name} was published.`
    case 'already_published': return `${name} was already published with this draft. Nothing new was written.`
    case 'unpublished': return state.locale === state.default_locale ? 'All languages were unpublished. The content is a Draft again.' : `${name} was unpublished.`
    default: return `${name} was already unpublished.`
  }
}

export interface PublicationLocaleTab {
  code: AdminContentPreviewPublish['locale']
  label: string
  isDefault: boolean
  active: boolean
  stateLabel: string
}

export function publicationLocaleTabs(state: AdminContentPreviewPublish): PublicationLocaleTab[] {
  return state.locales.map(row => ({
    code: row.locale,
    label: CONTENT_LOCALE_LABELS[row.locale],
    isDefault: row.locale === state.default_locale,
    active: row.locale === state.locale,
    stateLabel: CONTENT_LOCALE_STATE_LABELS[row.state],
  }))
}

/** Why a previewed file would not be published, or `null` when it is eligible. */
export function previewMediaStatus(media: AdminContentPreviewMedia): string | null {
  if (media.missing || !media.file) return 'Missing file'
  if (!media.enabled) return 'Disabled link'
  if (media.file.archived) return 'Archived'
  if (!media.file.is_public) return 'Not public'
  return null
}

/** Admin-only thumbnail through the Media Library preview route. */
export function previewImageUrl(media: AdminContentPreviewMedia | null, width = 960): string | null {
  if (!media || media.missing || !media.file || !isImageMimeType(media.file.type)) return null
  return workspaceMediaThumbUrl(media.directus_files_id, { width, height: Math.round(width * 0.5625) })
}

export function previewMediaName(media: AdminContentPreviewMedia): string {
  return media.file?.title?.trim() || media.file?.filename_download || `File ${media.directus_files_id.slice(0, 8)}`
}

export type PublicationErrorKind = 'conflict' | 'not_ready' | 'archived' | 'partial' | 'auth' | 'forbidden' | 'not_found' | 'invalid' | 'unavailable'

export interface PublicationErrorView {
  kind: PublicationErrorKind
  message: string
}

export function interpretPublicationError(err: unknown): PublicationErrorView {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: Record<string, unknown> } } | null)?.data
  const message = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const data = payload?.data ?? {}
  if (status === 409 && data.code === 'changed_since_review') {
    return { kind: 'conflict', message: 'This content changed since the page was loaded (text, media or relations). Reload and review the latest version before publishing.' }
  }
  if (status === 409) return { kind: 'archived', message: message ?? 'This content cannot be changed in its current state.' }
  if (status === 422 && data.code === 'not_ready') {
    return { kind: 'not_ready', message: 'Publishing was refused because readiness checks failed. The checklist now shows the current result.' }
  }
  if (status === 422 || status === 400) return { kind: 'invalid', message: message ?? 'The request was not valid.' }
  if (status === 500 && data.partial === true) return { kind: 'partial', message: message ?? 'The action stopped part-way. Try again to finish.' }
  if (status === 401) return { kind: 'auth', message: 'Your session has expired. Sign in again to continue.' }
  if (status === 403) return { kind: 'forbidden', message: 'You do not have permission to do this.' }
  if (status === 404) return { kind: 'not_found', message: 'This content or language was not found.' }
  return { kind: 'unavailable', message: 'Content Center is temporarily unavailable. Try again in a moment.' }
}
