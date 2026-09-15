/**
 * CC-IMP-01 — Content Center registries and route surface
 * (CONTENT-CENTER-BLUEPRINT-V1 §7, §10–§12, §15, §29; D-031, D-032).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTENT_BLOCK_TYPES } from '../utils/contentBlocks'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, isContentLocale } from '../utils/contentLocales'
import {
  CONTENT_MEDIA_ROLES,
  PUBLIC_CONTENT_MEDIA_ROLES,
  isContentMediaRole,
  isPublicContentMediaRole,
} from '../utils/contentMediaRoles'
import { validateContentRelationInput } from '../utils/contentRelations'
import { CONTENT_TYPE_IDS, CONTENT_TYPES, getContentType, isContentTypeId } from '../utils/contentTypes'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('content type registry', () => {
  it('holds exactly the five frozen V1 types', () => {
    expect([...CONTENT_TYPE_IDS]).toEqual(['technical_article', 'application_solution', 'case_study', 'resource_download', 'news'])
    expect(Object.keys(CONTENT_TYPES).sort()).toEqual([...CONTENT_TYPE_IDS].sort())
  })

  it('accepts known types and rejects unknown ones', () => {
    for (const id of CONTENT_TYPE_IDS) expect(getContentType(id)?.id).toBe(id)
    for (const bad of ['article', 'faq', 'insight', 'Technical_Article', '', null, undefined, 1]) {
      expect(isContentTypeId(bad)).toBe(false)
      expect(getContentType(bad)).toBeNull()
    }
  })

  it('makes only the Phase 1 types public, each with its confirmed route (D-035)', () => {
    const publicTypes = Object.values(CONTENT_TYPES).filter(def => def.publicEnabled)
    expect(publicTypes.map(def => [def.id, def.sitemapEligible, def.publicRoute])).toEqual([
      ['technical_article', true, '/resources/insights'],
      ['case_study', true, '/resources/case-studies'],
    ])
    for (const def of Object.values(CONTENT_TYPES).filter(def => !def.publicEnabled)) {
      expect(def.sitemapEligible).toBe(false)
      expect(def.publicRoute).toBeNull()
    }
  })

  it('only references registered block types, and defaults are allowed', () => {
    for (const def of Object.values(CONTENT_TYPES)) {
      for (const type of [...def.allowedBlocks, ...def.defaultBlocks, ...def.requiredBlocks.map(r => r.type)]) {
        expect(CONTENT_BLOCK_TYPES).toContain(type)
      }
      for (const type of def.defaultBlocks) expect(def.allowedBlocks).toContain(type)
      expect(def.defaultBlocks).not.toContain('image')
    }
  })

  it('records the frozen readiness metadata', () => {
    expect(CONTENT_TYPES.application_solution.heroRequired).toBe(true)
    expect(CONTENT_TYPES.case_study.heroRequired).toBe(true)
    expect(CONTENT_TYPES.resource_download.requiresDownloadFile).toBe(true)
    expect(CONTENT_TYPES.application_solution.requiredBlocks).toEqual([{ type: 'text', min: 1 }, { type: 'key_points', min: 1 }])
  })
})

describe('media role registry', () => {
  it('accepts the five Blueprint roles and rejects unknown roles', () => {
    expect([...CONTENT_MEDIA_ROLES]).toEqual(['hero', 'og_image', 'inline', 'download', 'source_document'])
    for (const role of CONTENT_MEDIA_ROLES) expect(isContentMediaRole(role)).toBe(true)
    for (const bad of ['gallery', 'datasheet', 'thumbnail', 'HERO', '', null]) expect(isContentMediaRole(bad)).toBe(false)
  })

  it('never treats source_document as public', () => {
    expect(PUBLIC_CONTENT_MEDIA_ROLES).not.toContain('source_document')
    expect(isPublicContentMediaRole('source_document')).toBe(false)
    expect(isPublicContentMediaRole('download')).toBe(true)
  })
})

describe('relation foundation validator', () => {
  it('accepts a product relation and a content relation', () => {
    expect(validateContentRelationInput({ relation_kind: 'product', product_id: 3 }, 10)).toMatchObject({ ok: true, product_id: 3, related_content_id: null })
    expect(validateContentRelationInput({ relation_kind: 'content', related_content_id: 11 }, 10)).toMatchObject({ ok: true, product_id: null, related_content_id: 11 })
  })

  it('rejects zero or two targets, a kind mismatch, self relation and unknown kinds', () => {
    expect(validateContentRelationInput({ relation_kind: 'product' }, 10).ok).toBe(false)
    expect(validateContentRelationInput({ relation_kind: 'product', product_id: 3, related_content_id: 11 }, 10).ok).toBe(false)
    expect(validateContentRelationInput({ relation_kind: 'content', product_id: 3 }, 10).ok).toBe(false)
    expect(validateContentRelationInput({ relation_kind: 'content', related_content_id: 10 }, 10).ok).toBe(false)
    expect(validateContentRelationInput({ relation_kind: 'resource', related_content_id: 11 }, 10).ok).toBe(false)
  })
})

describe('content locales', () => {
  it('mirror the i18n configuration in nuxt.config.ts', () => {
    const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8')
    const codes = [...config.matchAll(/\{\s*code:\s*'([a-z]{2})'/g)].map(m => m[1])
    expect(codes).toEqual([...CONTENT_LOCALES])
    expect(config).toMatch(new RegExp(`defaultLocale:\\s*'${DEFAULT_CONTENT_LOCALE}'`))
    expect(isContentLocale('zh')).toBe(false)
  })
})

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })
}

describe('route surface', () => {
  const adminDir = join(ROOT, 'server', 'api', 'admin', 'content-center')

  it('exposes only the Draft Foundation, Media & Relations (CC-IMP-04), SEO & Locales (CC-IMP-05) and Preview & Publish (CC-IMP-06) routes', () => {
    const files = listFiles(adminDir).map(f => relative(adminDir, f).split('\\').join('/')).sort()
    expect(files).toEqual([
      '[id].get.ts',
      '[id]/ai-proposal-review.get.ts',
      '[id]/ai-proposal-review.post.ts',
      '[id]/ai-source-intake.get.ts',
      '[id]/ai-source-intake.post.ts',
      '[id]/archive.post.ts',
      '[id]/history.get.ts',
      '[id]/locales/[locale].patch.ts',
      '[id]/locales/[locale]/publish.post.ts',
      '[id]/locales/[locale]/unpublish.post.ts',
      '[id]/locales/index.post.ts',
      '[id]/media-relations.get.ts',
      '[id]/media-relations.put.ts',
      '[id]/preview-publish.get.ts',
      '[id]/restore.post.ts',
      '[id]/seo-locales.get.ts',
      '[id]/seo-locales.put.ts',
      'index.get.ts',
      'index.post.ts',
    ])
  })

  it('has no item-level PATCH or DELETE (content_type is immutable, no permanent delete); lifecycle actions are publish / unpublish / archive / restore', () => {
    const files = listFiles(adminDir).map(f => relative(adminDir, f).split('\\').join('/'))
    expect(files.some(f => /\[id\]\.patch\.ts$/.test(f))).toBe(false)
    expect(files.some(f => /delete|purge|trash|rollback|revert/i.test(f))).toBe(false)
    expect(files.filter(f => /archive|restore/i.test(f)).sort()).toEqual(['[id]/archive.post.ts', '[id]/restore.post.ts'])
    expect(files.filter(f => /publish/i.test(f)).sort()).toEqual([
      '[id]/locales/[locale]/publish.post.ts',
      '[id]/locales/[locale]/unpublish.post.ts',
      '[id]/preview-publish.get.ts',
    ])
  })

  it('the only public Content Center API is the read-only public reader (CC-IMP-10)', () => {
    const cmsFiles = listFiles(join(ROOT, 'server', 'api', 'cms')).map(f => relative(ROOT, f).split('\\').join('/'))
    expect(cmsFiles.filter(f => /content-center|\/content\/|content_items/i.test(f)).sort()).toEqual([
      'server/api/cms/content/[type]/[slug].get.ts',
      'server/api/cms/content/[type]/index.get.ts',
    ])
  })

  it('sits under the admin-auth middleware prefix', () => {
    const middleware = readFileSync(join(ROOT, 'server', 'middleware', 'admin-auth.ts'), 'utf8')
    expect(middleware).toContain('/api/admin/')
  })
})
