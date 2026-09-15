/**
 * CC-IMP-07 — Change History page helpers (client). The page only shows what the server
 * derived from Directus revisions and the lifecycle state it returned; Archive and Restore
 * are confirmed, single requests the server re-checks.
 */

import type { AdminContentHistoryEvent, ContentHistoryCategory } from '../types/content-center'
import { CONTENT_LOCALE_LABELS, contentApiErrorStatus } from './contentCenter'

export interface LifecycleConfirmation {
  kind: 'archive' | 'restore'
  title: string
  lines: string[]
  confirmLabel: string
}

export const ARCHIVE_CONFIRMATION: LifecycleConfirmation = {
  kind: 'archive',
  title: 'Archive this content?',
  lines: [
    'This content will be archived.',
    'It will no longer be eligible for public delivery.',
    'Draft content and history will be preserved.',
  ],
  confirmLabel: 'Archive content',
}

export const RESTORE_CONFIRMATION: LifecycleConfirmation = {
  kind: 'restore',
  title: 'Restore this content to draft?',
  lines: [
    'The content returns to Draft and can be edited again.',
    'Every published language version is cleared.',
    'Restoring does not publish the content.',
  ],
  confirmLabel: 'Restore to draft',
}

export function lifecycleOutcomeMessage(result: string): string {
  return result === 'archived'
    ? 'The content was archived. It is read-only until it is restored.'
    : 'The content was restored to draft. It is not published.'
}

export type LifecycleErrorKind = 'conflict' | 'invalid_transition' | 'partial' | 'auth' | 'forbidden' | 'not_found' | 'invalid' | 'unavailable'

export function interpretLifecycleError(err: unknown): { kind: LifecycleErrorKind, message: string } {
  const status = contentApiErrorStatus(err)
  const payload = (err as { data?: { message?: unknown, data?: Record<string, unknown> } } | null)?.data
  const message = typeof payload?.message === 'string' && payload.message.trim() ? payload.message : null
  const data = payload?.data ?? {}
  if (status === 409 && data.code === 'lifecycle_changed') {
    return { kind: 'conflict', message: 'This content changed since the page was loaded. Reload to see its current state.' }
  }
  if (status === 403 && data.code === 'invalid_transition') return { kind: 'invalid_transition', message: message ?? 'This action is not available in the current state.' }
  if (status === 500 && data.partial === true) return { kind: 'partial', message: message ?? 'The action stopped part-way. Reload and try again.' }
  if (status === 422 || status === 400) return { kind: 'invalid', message: message ?? 'The request was not valid.' }
  if (status === 401) return { kind: 'auth', message: 'Your session has expired. Sign in again to continue.' }
  if (status === 403) return { kind: 'forbidden', message: 'You do not have permission to do this.' }
  if (status === 404) return { kind: 'not_found', message: 'This content was not found.' }
  return { kind: 'unavailable', message: 'Content Center is temporarily unavailable. Try again in a moment.' }
}

/** "English · Title, Summary · Revision 5" — only fields the server returned. */
export function historyEventDetail(event: AdminContentHistoryEvent): string {
  const parts = [
    event.locale ? CONTENT_LOCALE_LABELS[event.locale] : null,
    event.area,
    event.changes.length ? event.changes.join(', ') : null,
    event.revision !== null ? `Revision ${event.revision}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export const HISTORY_CATEGORY_TONE: Readonly<Record<ContentHistoryCategory, 'lifecycle' | 'publication' | 'edit' | 'neutral'>> = {
  Lifecycle: 'lifecycle',
  Publication: 'publication',
  Draft: 'edit',
  SEO: 'edit',
  Language: 'edit',
  Media: 'edit',
  Relations: 'edit',
  AI: 'neutral',
  Other: 'neutral',
}
