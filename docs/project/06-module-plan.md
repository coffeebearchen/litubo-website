# 06 — Module development plan

## Module 0A — Project archive reconciliation (no code)

Create and approve the site master register, decision log, current-status record and empty data templates. Reconcile visual references with navigation, Phase 1 scope and content/data models. Never ask Claude to resolve conflicts by itself.

**Done when:** every Phase 1 route has a status, template, visual reference, data owner and mobile rule; all Phase 2-only routes are hidden; decisions are recorded.

## Module 0B — Project foundation (after 0A approval)

Create Nuxt project, repository hygiene, environment template, lint/typecheck/build scripts, EN/ES/PT routing skeleton, tokens and CMS-ready empty content adapters. No business page layout.

**Done when:** local app starts, SSR build passes, EN/ES example routes resolve, and no secret/config production values are present.

## Module 1 — Global shell and responsive baseline

Implement Header, five desktop mega menus, mobile accordion navigation, language switch UI/routing, Footer, shared buttons/links, global tokens, responsive constraints and placeholder content contracts. No Home or product business sections.

**Done when:** every mega-menu state matches the approved menu artwork; keyboard/mobile behavior works; Header/Footer work on blank route templates at 320–1440px; no horizontal overflow; build passes.

## Module 2 — Home

Implement the confirmed home composition: image-led hero, buyer-path split, latest-resource slots, FAQ search/quick answers, case-study block, event rows and final CTA. Use explicitly marked editorial placeholders where real data is absent.

**Done when:** section order, visual hierarchy and mobile stack match the approved artwork and all CTAs use confirmed routes.

## Module 3 — Products

Product overview/filter, category template and product-detail template, against typed content fixtures for approved data only.

**Done when:** category/product routes resolve, filter/pagination behavior is honest, spec tables work on mobile and related-resource/product relationships render.

## Module 4 — Applications and conversion pages

Applications overview/detail; Contact; Technical Matching; Find a Distributor; local validation and mock success paths.

**Done when:** all three inquiry purposes pass their correct form configuration and no live submission is falsely implied.

## Module 5 — Resources and Support

Resource hub/content templates, downloads/videos, Support overview, FAQ, manual/parts/service/test request templates.

**Done when:** taxonomy and filtering are functional with fixtures; document statuses and download handling are explicit.

## Module 6 — Company, system pages and SEO

About/quality/service/partner/events/careers; search-results shell; privacy/terms/sitemap/404; SEO defaults/schema only where content is verified.

**Done when:** public navigation has no dead end, basic metadata/sitemap/404 work, and all copy remains approved.

## Module 7 — Advanced operations and launch enhancements (separate approvals)

Add Excel import with validation, HubSpot, newsletter, public AI chat, advanced anti-spam, staged QA, analytics/consent, performance/accessibility audit, deploy, then approved Wix cutover.

**Done when:** every external action is separately approved and staging acceptance is recorded before production.
