# LITUBO Website — Claude Code Project Instructions

## Mission and boundaries

Build the new public website for **LITUBO — Food & Packaging Inspection Solutions**. It is an international industrial B2B lead-generation and content website, not an e-commerce store.

- Locale architecture: English (`en`), Spanish (`es`) and Portuguese (`pt`) are structured from Module 1. Only English is publicly enabled at the first launch; publish ES/PT only after their content is approved and complete. Chinese is not a public language.
- Do not invent product specifications, certifications, customer names, project results, service locations, personnel, or event details.
- Do not change the confirmed information architecture, navigation labels, visual direction, or stack without explicit approval.
- Do not deploy, change DNS, migrate the Wix site, send email, submit forms to a live CRM, push a remote repository, or expose credentials without explicit approval.
- Never put secrets in source files, commits, or documentation. Use ignored environment files and `.env.example` only.

## Source of truth

Read these files before coding, in this order:

1. `docs/project/01-technical-decision.md`
2. `docs/project/02-scope-and-acceptance.md`
3. `docs/project/03-routing-and-navigation.md`
4. `docs/project/04-design-system.md`
5. `docs/project/05-content-model.md`
6. `docs/project/06-module-plan.md`

The approved visual reference images are stored outside this repository during preparation. Their rules are distilled in `04-design-system.md`; do not approximate them with generic SaaS styling.

## Proposed stack (locked only after user confirmation)

- Nuxt 3 + Vue 3 + TypeScript, SSR/hybrid rendering enabled
- Nuxt i18n for `en` / `es` / `pt`; route-prefix strategy defined in routing document
- A minimal CMS is part of the first public release: product, media, resource/blog and form-submission management. Design components against a CMS-ready adapter.
- Node 20 LTS, Docker Compose and Nginx on the existing US Tencent Cloud server. Cloudflare Free sits in front for DNS, TLS, caching and basic protection; it is not a second application server.

## Working protocol

1. Work only on the module explicitly authorized by the user.
2. Inspect existing files and `git status` before editing. Preserve unrelated changes.
3. Implement the smallest complete change that satisfies the module acceptance criteria.
4. Run lint, type-check, build, and relevant responsive browser checks.
5. Report: changed files, result of each verification, known limitations, and the next proposed module.
6. Make a local Git commit only when the module is accepted or the user explicitly requests it. Never push without authorization.
7. Keep the governing principle visible in decisions: **framework before details; make the full flow work before optimizing; modular, upgradeable, flexible, and low rework.**

## UX and responsive rules

- Desktop: `Products`, `Applications`, `Resources`, `Support`, and `Company` use the confirmed mega-menu patterns.
- Mobile: use a progressively disclosed accordion navigation; never squeeze the desktop mega menu into a narrow viewport.
- Treat 320px, 375px, 768px, 1024px, and 1440px as minimum verification widths. No horizontal overflow.
- Preserve accessible keyboard navigation, focus visibility, semantic headings, image alt text, and reduced-motion behavior.
- Avoid gradients, neon blue/purple, excessive animation, chat widgets, icon walls, rounded-card overload, and invented decorative sections.

## Content and SEO rules

- All page content goes through the models and translation keys; no duplicated hard-coded EN/ES/PT copy in Vue templates.
- Each public route needs an editable SEO title, description, canonical path, Open Graph image, and indexability setting.
- Downloads are direct in Phase 1; do not create a download gate. Do not create HubSpot submission, live newsletter subscription, public AI chat, automatic publication, automatic email, or outbound customer messaging until separately authorized.
