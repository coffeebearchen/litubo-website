# 01 — Technical decision

## Recommended route: Nuxt 3 website on one Tencent Cloud application server

**Recommendation:** Nuxt 3 (Vue 3 + TypeScript + hybrid SSR/static rendering) as the public site, `@nuxtjs/i18n` for EN/ES/PT, and a CMS adapter. The existing US Tencent Cloud server is the only application server. Cloudflare Free sits in front as DNS, TLS, caching and basic protection; it is not a second business server.

This keeps the frontend in the Vue family, gives the site strong SEO and shareable pages from day one, uses the already familiar Docker/Nginx operating model, and avoids splitting first-release business data between servers.

## Compared options

| Route | Strength | Cost / weakness | Verdict |
| --- | --- | --- | --- |
| **A. Nuxt 3 + minimal CMS on Tencent Cloud; Cloudflare Free in front** | Modern Vue, SSR SEO, EN/ES/PT routing, simple single-server operations, clear handoff | Requires a new Node/Vue 3 project and separate Docker isolation from refrigerant store | **Choose** |
| B. Vue 2 / uni-app + Java / MySQL / Redis | Familiar collaboration pattern from refrigerant store; maximum custom control | Built for commerce/app flow, not content SEO; self-built CMS, multilingual publishing and search add much more work | Do not use for this site |
| C. Keep Wix and extend it | Lowest immediate effort | Design/system control, structured product data, menu behavior and long-term development are constrained | Keep current site online until cutover only |

## CMS boundary

The first release includes a minimal CMS because LITUBO must be able to change product information, Hero/media assets and resources without asking a developer. It covers manual CRUD for products, images/files, videos, blogs/resources and form records. Bulk Excel import, advanced workflow, automatic AI publication, HubSpot integration and public AI chat are Phase 2. The content schema and adapter must make those upgrades additive.

## Technical baseline

- Runtime: Node.js 20 LTS; package manager selected at project initialization and locked in the repository.
- Frontend: Nuxt 3, Vue 3, TypeScript, SSR, route-level SEO metadata.
- Internationalization: `en` default without prefix; `es` with `/es/...`, `pt` with `/pt/...`. Only published locales appear in the public selector. Slugs remain stable and are mapped explicitly rather than auto-translated.
- Styling: scoped component CSS plus global design tokens (CSS variables); no generic UI kit that would override the confirmed visual character.
- Images: optimized WebP/AVIF derivatives, responsive `srcset`, original master files kept outside the public build.
- Hosting: Docker Compose + Nginx on the existing US Tencent Cloud environment, in a fully separate project/network/database from refrigerant store. Cloudflare Free proxies the public domain. No deployment in this preparation phase.
- CMS candidate: Directus + PostgreSQL in the same compose environment. The public site communicates through one content adapter, so the storage implementation can change without page rewrites.

## Explicit non-goals for Phase 1

No ecommerce, user account, payment, public price, CRM write, live newsletter subscription, public AI chat, automatic AI publication/email, Excel bulk import, download gate, or production deployment.
