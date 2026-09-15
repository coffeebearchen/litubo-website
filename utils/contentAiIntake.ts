/**
 * CC-IMP-08 — CC-AI-01 AI Source Intake page helpers (client).
 *
 * Selection is browser-local state over opaque source refs: choosing or clearing a
 * source never issues a request and never writes anything. The limits mirror the
 * server's `MAX_FILES_PER_REQUEST` / `MAX_IMAGES_PER_ANALYSIS`, which the server
 * enforces again before any file is read. Which files are eligible is decided by
 * the server; the page only shows it.
 */

import type { AdminContentAiSource } from '../types/content-center'
import { contentApiErrorStatus } from './contentCenter'

export const CONTENT_AI_SELECTION_DISCLOSURE = 'Selecting a source never calls an AI model or writes anything.'
export const CONTENT_AI_ANALYZE_DISCLOSURE = 'Only clicking "Analyze selected sources" sends text extracted from the selected sources to the configured AI provider.'
export const CONTENT_AI_DATA_DISCLOSURE = 'Extracted text from the selected sources will be sent to the configured AI provider for analysis. Original files are not sent to the AI provider. Nothing will be written or published.'
export const CONTENT_AI_OWNERSHIP_NOTE = 'These are the files already linked to this content item. Links are added or removed in Media & Relations.'
export const CONTENT_AI_PROPOSAL_NOTE = 'The prepared proposal is kept in server memory only: it expires after two hours or on a server restart. Review it in AI Proposal Review — nothing is written until you apply approved changes. If it is no longer available, analyze again.'

export interface ContentAiLimits {
  max_files: number
  max_images: number
}

export function selectedImageCount(sources: readonly AdminContentAiSource[], selected: readonly string[]): number {
  const chosen = new Set(selected)
  return sources.filter(s => s.isImage && chosen.has(s.sourceRef)).length
}

/** A source can be ticked when the server calls it analyzable and ticking it passes neither limit. */
export function canSelectContentAiSource(
  source: AdminContentAiSource,
  sources: readonly AdminContentAiSource[],
  selected: readonly string[],
  limits: ContentAiLimits,
): boolean {
  if (!source.analyzable) return false
  if (selected.includes(source.sourceRef)) return true
  if (selected.length >= limits.max_files) return false
  if (source.isImage && selectedImageCount(sources, selected) >= limits.max_images) return false
  return true
}

/** Returns the next selection; a source that cannot be added leaves it unchanged. Pure — no request. */
export function toggleContentAiSelection(
  source: AdminContentAiSource,
  sources: readonly AdminContentAiSource[],
  selected: readonly string[],
  limits: ContentAiLimits,
): string[] {
  if (selected.includes(source.sourceRef)) return selected.filter(ref => ref !== source.sourceRef)
  return canSelectContentAiSource(source, sources, selected, limits) ? [...selected, source.sourceRef] : [...selected]
}

export function contentAiIntakeCounts(sources: readonly AdminContentAiSource[], selected: readonly string[]) {
  return {
    linked: sources.length,
    readable: sources.filter(s => s.analyzable).length,
    unavailable: sources.filter(s => !s.analyzable).length,
    selected: selected.length,
    images: selectedImageCount(sources, selected),
  }
}

/** A safe sentence for a failed Analyze request; nothing internal is shown. */
export function interpretContentAiAnalyzeError(err: unknown): string {
  const status = contentApiErrorStatus(err)
  const message = (err as { data?: { message?: unknown } } | null)?.data?.message
  const serverMessage = typeof message === 'string' && message.trim() ? message : null
  if (status === 409 || status === 422 || status === 429) return serverMessage ?? 'This analysis could not start. Reload and try again.'
  if (status === 401) return 'Your session has expired. Sign in again, then analyze.'
  if (status === 403) return 'You do not have permission to analyze sources for this content item.'
  if (status === 404) return 'This content item was not found.'
  if (status === 413) return 'This request is too large.'
  if (status === 503) return 'AI source selection is unavailable on this server.'
  return 'The analysis could not be completed right now. Nothing was written. Try again.'
}
