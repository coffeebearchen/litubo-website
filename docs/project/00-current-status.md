# 00 — Current project status

## Status: Module 0B + Module 1 complete — ready for Module 2

## Confirmed operating principle

**Framework before details; make the full flow work before optimizing; modular, upgradeable, flexible, and low rework.**

## Confirmed delivery architecture

- Existing US Tencent Cloud server is the single application server: Nuxt website, CMS, API and database run in a separate Docker project from refrigerant store.
- Cloudflare Free is an optional front edge for DNS, TLS, caching and basic protection.
- YouTube is the preferred host for public marketing videos.

## Completed modules

### Module 0B + Module 1 — Engineering Foundation and Global Shell

**Completed:** 2026-09-01

**Stack locked:**
- Nuxt 3.21.11 + Vue 3.5.42 + TypeScript (strict)
- @nuxtjs/i18n v9.5.6, `prefix_except_default` strategy (EN no prefix, ES `/es/`, PT `/pt/`)
- Google Fonts: Source Serif 4 (display) + Inter (body/nav/forms)
- CMS adapter pattern: Phase 1 reads local fixtures; Phase 2 reads Directus via same interface
- Node 20 LTS, npm; Docker + Nginx (deployment — not yet applied)

**Decisions recorded:** D-001 through D-020 in `docs/project/08-decision-log.md`

**Verification results:**
- `npm run lint`: 0 errors (17 → 0 after fixes)
- `npx vue-tsc --noEmit`: 0 errors
- `npx nuxt build`: ✨ Build complete — 2.6 MB / 632 kB gzip
- `npm run dev`: Dev server confirmed at http://localhost:3000
- Browser checks (800px desktop, 375px mobile):
  - Header: fixed dark-green, LITUBO logo, 5 nav items, Contact, EN switcher, accent CTA
  - Products mega menu: confirmed via mouseenter trigger — 5 items + CTA render correctly
  - Mobile nav: hamburger shows accordion panel with 5 sections + Contact + accent CTA
  - Contact page: form + contact details sidebar render correctly
  - Footer: 4-column grid (brand, Company, Support, Resources), legal bar, all links

**Known limitations:**
- Google Fonts blocked in Claude's sandboxed browser (503s) — site falls back to system serif/sans correctly; will load normally in real browsers
- `copyright` i18n key uses `{year}` ICU placeholder — rendered with `.replace('{year}', year)` in template as a safe workaround
- Email/phone/whatsapp moved from i18n JSON to `composables/useContactInfo.ts` (non-translatable contact details; `@` and `+` break ICU parser)
- Hydration mismatch warning appears in dev (SSR/CSR locale detection edge case in @nuxtjs/i18n v9) — no visible user impact; will be resolved when full locale content is added

**Phase 1 public routes registered:**
- `/`, `/products`, `/products/[category]`, `/products/[category]/[slug]`
- `/applications`, `/applications/[slug]`
- `/resources`, `/resources/[type]`, `/resources/[type]/[slug]`, `/resources/downloads`, `/resources/videos`
- `/contact`, `/technical-matching`, `/find-a-distributor`
- `/support`, `/support/faq`, `/support/request-spare-parts`, `/support/send-product-test`, `/support/[requestType]`
- `/company/about`, `/company/quality-manufacturing`, `/company/global-service`, `/company/become-a-partner`
- `/privacy-policy`, `/terms-of-use`
- `[...slug]` → 404

**Phase 2 (hidden) routes:** Events, Careers, News

## Current authorization

Module 2 is the next proposed step. No deployment, no external connections.

## Next proposed module

**Module 2 — Product Catalogue and Application Pages**

Scope: Full product listing page, product category pages, individual product detail page (using fixture data with `__DEMO_NOT_FOR_PUBLIC__` guard), application listing page, and individual application pages. No real product specs or images — demo fixtures only, clearly guarded.
