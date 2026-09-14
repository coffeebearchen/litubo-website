# LITUBO Content Center — Technical Blueprint V1

> **Status:** FROZEN FOR IMPLEMENTATION — content, block, media, relation, SEO, locale, AI target, draft/publish, preview and public-delivery contracts.
> **Produced by:** `CONTENT-CENTER-BLUEPRINT-01` (TYPE C, A1, user-authorized, 2026-09-14). Long-term decision: `D-032`.
> **Revised by:** `CONTENT-CENTER-BLUEPRINT-01-REVIEW-FIX-01` (Controller review clarifications, 2026-09-14: database slug uniqueness, proposal binding, `block:new` identity, in-memory proposal expiry).
> **Runtime effect:** none. No collection, migration, route, component, API, permission, AI or media change is made or authorized by this document. Each implementation module in §34 needs its own work order.

---

## 1. Purpose

Translate the frozen Content Center modules (`docs/content-cms/CONTENT-CENTER-MODULE-FREEZE-V1.md`) into one implementable technical contract, so that implementation modules do not guess storage, lifecycle, AI mapping or public isolation.

## 2. Authority / inputs

Bound by, in this order of precedence for boundaries: repository reality → Governing Charter V1.1 → Decision Log (D-021 … D-032) → Module Freeze V1 → this Blueprint. Execution rules: `docs/project/PROJECT-EXECUTION-PROTOCOL.md`. Status: `CURRENT-STATE.md` and Register §4.7 / §4.8.

Inputs read: `CLAUDE.md`, the protocol and both templates, `CURRENT-STATE.md`, `MASTER-ROADMAP.md`, `08-decision-log.md`, the Freeze, the 8 approved visuals and their README, the Charter, the Register, the Implementation Blueprint, `docs/ADMIN-CMS-SPEC.md`, `docs/OPERATIONS-HANDBOOK.md`, `MEDIA-AND-PRODUCT-DATA-GOVERNANCE.md`, `docs/project/03-routing-and-navigation.md`, `docs/project/05-content-model.md`, and a static code/schema inventory (§3). The Freeze's own §27 status block ("Blueprint: NOT STARTED") is a point-in-time record; live status is in CURRENT-STATE and the Register.

This Blueprint does not overturn the Freeze, expand AI authority, create a second media store, copy product truth, publish automatically or raise source limits.

## 3. Current repository inventory

Static inventory only (code, `directus/schema/phase-p1-after.yaml`, docs). No running service, database row or Directus permission was queried.

| Area | Fact | Evidence |
|---|---|---|
| Collections | 16 user collections exist (inquiries, media_file_lifecycle, posts, product_categories, product_faqs, product_page_presets, product_section_items, product_sections, product_source_records, product_spec_groups, product_spec_items, products, products_files, site_content, site_settings, site_social_links) | latest schema snapshot; CURRENT-STATE |
| Collection budget | `docs/ADMIN-CMS-SPEC.md`: hard cap 25; a new collection needs a budget line, a reason existing collections cannot serve, worst case ≤ 23, and confirmation; junctions count. The SPEC budget table is stale (lists 12) | SPEC 297, 387–404, 410–443 |
| CMS mode | `CMS_MODE` defaults to `fixtures`; products have their own `CMS_MODE_PRODUCTS` | `nuxt.config.ts:77-80`, `.env.example:40` |
| Locales | i18n `prefix_except_default`, default `en`, locales en/es/pt; `runtimeConfig.public.publishedLocales = ['en']`; `/es`, `/pt` pages are noindex without canonical/hreflang; `site_settings` has no locale config | `nuxt.config.ts:20-36,105`; `useSeoHead.ts:37-41` |
| Admin auth | `/admin/*` and `/api/admin/*` require a Directus user whose role is `Administrator`; writes are CSRF-checked; admin BFF calls Directus with the admin's own token; public BFF uses a static read-only `nuxt-server` token; only two roles exist | `server/middleware/admin-auth.ts`; `adminDirectusClient.ts`; `directus.ts:9` |
| Public permissions | Directus permissions are not in the schema snapshot; `nuxt-server` field allowlists are documented only for products / products_files / site_settings; no record for posts or site_content | CURRENT-STATE 525, 551, 605 |
| Public media | `/api/cms/media/[id]` streams a file only when `directus_files.is_public = true`; it does not check `media_file_lifecycle.archived` | `server/api/cms/media/[id].get.ts` |
| Media protection | `getFileReferences` scans only `products_files`, `product_sections.media_id`, `product_source_records` | `server/utils/mediaLifecycle.ts:78-117` |
| Audit | No audit collection. Admin writes use the admin token, so Directus activity/revisions record them (Charter §N.4 path); `evidence/audit.get.ts` already reads `/revisions` | `server/api/admin/products/[id]/evidence/audit.get.ts` |
| Product lifecycle | draft ↔ review → published → draft in BFF transition table; `published_at` written once; **no revision draft** (published edits go live immediately); `archived` has no transition/API; preview API reads any status | `server/api/admin/products/[id].patch.ts` |
| Product blocks | `product_sections` / `product_section_items`: typed by code whitelist (13 in code vs 11 in Directus choices), flat `_en/_es/_pt` columns, `sort`, hard delete | `types/product-cms.ts:11-16`; `sections/*.ts` |
| Validation / config | `zod` 4 is a dependency, used only in AI; CRUD uses hand-written allowlists; configuration lives in code registries with fail-closed defaults (`AI_SOURCE_FORMATS`, `WORKSPACE_MODULE_NAV`, `FOLDER_POLICY`) | `package.json:26`; `utils/*.ts` |
| AI | Target contract and provider layer are target-neutral; engine, source resolution (`products_files`), fingerprint, replay guard, sourceRef and rate limit are keyed by `productId`; proposals live in process memory (10 min reuse / 2 h apply); Apply does not verify submitted changes against the stored proposal output; generate has no Draft gate; archived media is not excluded from sources | `server/utils/ai*.ts`; `server/api/admin/products/[id]/ai/*` |
| Sitemap | Products only (`status=published`, `seo_noindex≠true`, published category) | `server/routes/sitemap.xml.ts` |

## 4. Existing structures and disposition

| Structure | Current owner | Runtime use | Public use | Disposition | Reason |
|---|---|---|---|---|---|
| `posts` | Phase 5 CMS | Public only, via `/api/cms/posts*`; default mode serves 7 fixtures; no admin code; not in sitemap; `nuxt-server` read permission unconfirmed | `/resources`, `/resources/{insights,case-studies,news,technical-guides}/[slug]`, `/support/faq` | **LEAVE LEGACY** (untouched); read compatibility until per-route cutover; migrate later only if real rows exist | Single global slug (no per-locale slug); body is one HTML rich-text field per locale (Freeze requires structured blocks); `faq` is a content type (not a V1 type, and `/support/faq` depends on it); relations are JSON slug tags; file fields are UUIDs without relations (cannot be reference-protected); no noindex/canonical; no draft/published separation. Evolving it would redefine nearly every field while live FAQ pages depend on the old meaning. |
| `site_content` | Phase 4 CMS | Public only: `home.hero` row via `/api/cms/home` with i18n fallback | Home hero | **DO NOT USE** for Content Center; leave untouched | Hero-shaped fixed-page fields, no SEO, no relations; not a content-item concept. Future fixed-page content is outside Content Center V1. |
| `product_sections`, `product_section_items`, `product_faqs` | Product Workspace | Admin + public product pages | Product detail | **DO NOT USE** (D-031) | Product Page Content truth. |
| `products` | Product Center / Workspace | Admin + public | Product pages | **REFERENCE ONLY** through relations | Product truth (D-031). |
| `products_files` | Product Workspace | Admin + public + AI sources | Product downloads | **PATTERN REUSE** (field naming, role enum style), no shared rows | Proven junction shape; content needs its own owner key. |
| `directus_files`, `media_file_lifecycle` | Media Library | Admin + public proxy | Via `/api/cms/media` | **REUSE** as the only file store | D-023. |
| `content/fixtures/applications.ts` | Public fixtures | Public | 8 `/applications/[slug]` pages | **LEAVE**; possible later source switch (OPEN, §35) | D-002 fixed industry pages. |
| AI target contract, providers, extraction, replay guard, rate limit | AI | Admin | none | **REUSE / GENERALIZE** (subject key) | D-022, D-024…D-030. |
| Directus revisions | Directus | Admin writes | none | **REUSE** for Change History | Charter §N.4 path already in use. |

SPEC's conditional Phase 2 collections `applications` and `download_assets` are superseded by the Content Center types Application / Solution and Resource / Download (D-032); `partners` and `certificates` are unaffected.

## 5. Architecture principles

1. Reuse semantically compatible structures; do not force reuse of incompatible ones (`posts`, `site_content`).
2. Minimum new collections; no collection per content type, per block type or per history event.
3. **Structural public isolation:** the public reader can only ever read a published snapshot, never working draft columns (§31).
4. Code registries with fail-closed validation for types, blocks, roles and limits (repo convention).
5. One shared AI engine; content is a new *target* and *subject*, not a new engine.
6. Proportionate engineering: single Administrator role, single instance, no audit/version subsystem beyond Directus revisions and one published snapshot.

## 6. Content Item model

**Recommended:** new `content_items` (locale-neutral identity) + `content_item_locales` (one row per locale: working draft + published snapshot).

Alternatives: (A) extend `posts` — rejected (§4); (B) new collections — **selected**.

### 6.1 Logical data dictionary

Classification: `PUBLIC` = may appear in public payload (only via snapshot) · `INTERNAL` = admin only · `DRAFT_ONLY` = working copy, never public directly · `AI_REVIEW_ONLY` = proposal data, never persisted to content.

**`content_items`**

| Logical field | Storage field | Type | Req | Locale | Class | AI propose / Human edit / AI apply after approval / AI publish | Notes |
|---|---|---|---|---|---|---|---|
| id | `id` | integer PK | Y | – | INTERNAL | N / N / N / **N** | Repo convention (products, posts use integers) |
| type | `content_type` | string enum (§7) | Y | – | PUBLIC via snapshot | N / create only / N / **N** | Immutable after creation |
| status | `status` | `draft` \| `published` \| `archived` | Y | – | INTERNAL | N / via actions / N / **N** | Never set by a generic PATCH |
| first published | `first_published_at` | timestamp | N | – | INTERNAL | N / N / N / **N** | Set once by Publish |
| archived at | `archived_at` | timestamp | N | – | INTERNAL | N / N / N / **N** | Set by Archive, cleared by Restore |
| created / updated / by | `date_created`, `date_updated`, `user_created`, `user_updated` | Directus system | Y | – | INTERNAL | N / N / N / **N** | |
| default locale | — (config) | — | — | – | – | – | `en` from i18n `defaultLocale`; not stored |

**`content_item_locales`**

| Logical field | Storage field | Type | Req | Class | AI propose / Human edit / AI apply / AI publish | Notes |
|---|---|---|---|---|---|---|
| id | `id` | integer PK | Y | INTERNAL | N / N / N / **N** | |
| item | `content_items_id` | M2O `content_items` | Y | INTERNAL | N / N / N / **N** | Unique with `locale` |
| locale | `locale` | `en` \| `es` \| `pt` | Y | PUBLIC | N / create only / N / **N** | From i18n locales |
| title | `title` | string ≤ 160 | Y | DRAFT_ONLY | Y / Y / Y / **N** | |
| slug | `slug` | string ≤ 100 | Y | DRAFT_ONLY | **N** / Y until locked / N / **N** | §14 |
| summary | `summary` | text ≤ 400 | Y for publish | DRAFT_ONLY | Y / Y / Y / **N** | Hero subheadline + card text |
| blocks | `blocks` | JSON array (§9) | Y (may be `[]`) | DRAFT_ONLY | Y / Y / Y / **N** | Schema-validated |
| SEO title | `seo_title` | string ≤ 120 | N | DRAFT_ONLY | Y / Y / Y / **N** | Fallback `title` |
| SEO description | `seo_description` | string ≤ 320 | N | DRAFT_ONLY | Y / Y / Y / **N** | Fallback `summary` |
| canonical override | `canonical_path` | string (internal path) | N | DRAFT_ONLY | N / Y / N / **N** | §14 |
| noindex | `noindex` | boolean, default false | Y | DRAFT_ONLY | N / Y / N / **N** | |
| draft revision | `draft_revision` | integer ≥ 1 | Y | INTERNAL | N / N (server) / N / **N** | +1 on every working-copy write |
| published snapshot | `published_snapshot` | JSON \| null | N | **PUBLIC** | N / N / N / **N** | Only column the public reader may read (§31) |
| published revision | `published_revision` | integer \| null | N | INTERNAL | N / N / N / **N** | `draft_revision` captured at publish |
| published at | `published_at` | timestamp \| null | N | PUBLIC | N / N / N / **N** | Last publish |
| locale first published | `first_published_at` | timestamp \| null | N | INTERNAL | N / N / N / **N** | Locks slug |
| last change kind | `last_change_kind` | `manual_edit` \| `ai_apply` \| `publish` \| `unpublish` \| `restore` | Y | INTERNAL | N / N (server) / N / **N** | Written with each change so Directus revisions are explainable (§19) |

**`content_items_files`** and **`content_relations`**: §11, §12.

## 7. Content types

Code registry `utils/contentTypes.ts` (fail-closed; unknown type rejected).

| `content_type` | V1 label | Allowed blocks | Default blocks on create | Hard publish requirements (beyond common) | Hero media | Public in V1 registry |
|---|---|---|---|---|---|---|
| `technical_article` | Technical Article | text, key_points, image, faq, cta, related_content, downloads | text, key_points, faq, cta, related_content | ≥ 1 `text` block | optional | `false` until CC-IMP-10 |
| `application_solution` | Application / Solution | text, key_points, image, faq, cta, related_content, downloads | text, key_points, cta, related_content | ≥ 1 `text` and ≥ 1 `key_points` | required | `false` until CC-IMP-10 |
| `case_study` | Case Study | text, key_points, image, cta, related_content, downloads | text, text, key_points, cta, related_content | ≥ 1 `text` | required | `false` until CC-IMP-10 |
| `resource_download` | Resource / Download | text, downloads, cta, related_content | text, downloads, related_content | `downloads` block and ≥ 1 enabled `download` file | optional | `false` until CC-IMP-10 |
| `news` | News | text, image, cta, related_content | text | ≥ 1 `text` | optional | `false` (D-004 / D-013) |

Each registry entry also declares its public route pattern (§30) and sitemap eligibility. `publicEnabled = false` blocks Publish for that type (§23), so no type can become public before its route is authorized.

## 8. Lifecycle

### 8.1 States and data

- **Item:** `draft` (no published locale) · `published` (default locale has a snapshot) · `archived`.
- **Locale:** *not started* (no row) · *draft* (row, no snapshot) · *published* (snapshot present) · *published with changes* (`draft_revision > published_revision`). Derived, not stored.

### 8.2 Decisions

| Question | V1 answer |
|---|---|
| Single status record or separate Draft/Published storage? | **Working copy + published snapshot in the same locale row.** Public reads only `published_snapshot`. |
| Editing a Published item | Edits change the working copy only (`draft_revision` +1). The public page keeps the snapshot until a human publishes again. The item does not revert to `draft`. |
| Snapshot on Publish? | Yes — one snapshot per locale, replaced on each publish. No version history in V1. |
| Unpublish in V1? | **Yes**, per locale. Unpublishing the default locale unpublishes every locale and sets the item to `draft`. |
| Archive a Published item | Item → `archived`, `archived_at` set; immediately excluded from public routes, sitemap and relations (public reader requires item `status = published`). Snapshots are kept but unreadable. |
| Restore | Item → `draft`, all snapshots cleared, `archived_at` cleared. Re-exposure requires a new manual Publish. |
| Permanent delete | Not in V1. |

Transitions (server-enforced, 403 on anything else, consistent with the product BFF pattern):

```text
draft ──publish(default locale)──▶ published
published ──publish(locale)──▶ published          (idempotent when unchanged)
published ──unpublish(default)──▶ draft           (clears all snapshots)
published ──unpublish(non-default)──▶ published   (clears that snapshot)
draft | published ──archive──▶ archived
archived ──restore──▶ draft                        (clears all snapshots)
```

A non-default locale can be published only while the default locale is published. Charter §G.1 (product lifecycle) is unaffected; this is the content lifecycle defined under D-032.

## 9. Structured blocks

**Recommended:** ordered, schema-validated JSON array `content_item_locales.blocks`, validated by a server-side zod registry `server/utils/contentBlocks.ts` with a shared type list in `utils/contentBlocks.ts`.

| Option | Assessment |
|---|---|
| A. `content_blocks` collection (one row per block) | Directus-friendly ordering and per-block writes, but +1 collection, per-locale joins, and a multi-row publish snapshot. |
| B. Validated JSON array on the locale row | **Selected.** Blocks are already per locale; one write per save guarded by `draft_revision`; snapshot is a copy; AI targets a stable `block.id`; no extra collection. Not a free-form blob: unknown types, unknown keys and over-limit sizes are rejected. |
| C. Typed flat columns (product_sections style) | Needs a table per locale set; product-owned pattern; rejected. |

Block envelope: `{ id: uuid, type: BlockType, data: object }`. Array order is display order. Limits: ≤ 60 blocks and ≤ 200 KB JSON per locale row. All text is rendered as plain text (no `v-html`).

| Block type | `data` schema (V1) | Visual mapping |
|---|---|---|
| `text` | `heading?` ≤ 160; `paragraphs` 1–20 × ≤ 2000 | Introduction / body sections |
| `key_points` | `heading?`; `items` 1–12 × { `title` ≤ 120, `body?` ≤ 600 } | Key benefits / results |
| `image` | `fileLinkId` (a `content_items_files.id` with role `inline` on the same item); `caption?` ≤ 300 | Inline media |
| `faq` | `heading?`; `items` 1–30 × { `question` ≤ 300, `answer` ≤ 2000 } | FAQ |
| `cta` | `heading?` ≤ 160; `body?` ≤ 600; `label` ≤ 60; `href`: internal path starting `/` or `https://` URL | Call to action |
| `related_content` | `heading?` | Renders published relations (§12) |
| `downloads` | `heading?` | Renders enabled `download` files (§11) |

The "Hero section" in `CC-VIS-02` is the item template header (locale `title`, `summary`, `hero` media), not a block. Future block types are added to the registry with a schema; old rows stay valid because unknown-type rejection applies to writes, and renderers skip unknown types. "Reading time" and per-section status badges in the visuals are derived UI, not stored.

## 10. Type configuration

**Code/config, not DB-driven.** The registry (§7) owns allowed blocks, default order, required checks, hero requirement, public route and sitemap eligibility. Reasons: five fixed V1 types, repo convention of fail-closed code registries, reviewable in Git, no "CMS builder" UI. Changing a type's configuration is a code change in an authorized module.

## 11. Media model

**`content_items_files`** junction (mirrors `products_files` naming):

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | Referenced by `image` blocks as `fileLinkId` |
| `content_items_id` | M2O `content_items` | CASCADE on item deletion only (no deletion in V1) |
| `directus_files_id` | M2O `directus_files` | Unique with `content_items_id` + `file_role` |
| `file_role` | `hero` \| `og_image` \| `inline` \| `download` \| `source_document` | Code registry; `source_document` is INTERNAL and never public |
| `alt_en`, `alt_es`, `alt_pt` | string ≤ 250 | Same flat pattern as `products_files` alt text |
| `caption_en`, `caption_es`, `caption_pt` | string ≤ 300 | |
| `language` | `all` \| `en` \| `es` \| `pt` | For downloads |
| `version_label`, `file_date` | string / date | Downloads |
| `enabled` | boolean | |
| `sort` | integer | |

Rules:
- Files are selected from the Media Library only; no upload store, local path or binary copy.
- At most one enabled `hero` and one enabled `og_image` per item; OG falls back to hero.
- Linking an archived file is rejected (lifecycle check).
- `getFileReferences` is extended to count `content_items_files` rows (including those of archived items, which are restorable).
- Publish requires every file in the snapshot to be `is_public = true` and not archived; Publish never changes `is_public` (that stays a Media Library action).
- Video thumbnails: not V1.

**Resource / Download vs Media file:** a `resource_download` item is the page/listing entry (title, summary, locale SEO, relations); its files are Media Library assets linked with role `download`. The file is never copied, and the same file may also be linked to a product via `products_files`. Downloads are direct and ungated (D-006).

## 12. Relations

**`content_relations`** (single table; alternative of one table per relation kind rejected as duplicate logic):

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `content_items_id` | M2O `content_items` | Source item |
| `relation_kind` | `product` \| `content` | |
| `product_id` | M2O `products`, nullable | Required when kind = product |
| `related_content_id` | M2O `content_items`, nullable | Required when kind = content; ≠ source |
| `sort` | integer | |

Server rules: exactly one target matching the kind; no self relation; no duplicate target per source. Relations are locale-neutral. "Related Resources" are `content` relations whose target type is `resource_download`. Product relations store only the product id — product name, image and URL are read from the published product API at render time. Public rendering shows a relation only if the target is published (product `status = published`; content item published in the same locale with its type public).

## 13. SEO

| Capability | Storage | Default | Human confirmation |
|---|---|---|---|
| Slug | locale row | none (required) | Required |
| SEO title | locale row `seo_title` | `title` | Optional (soft warning if empty) |
| Meta description | locale row `seo_description` | `summary` | Optional (soft warning if empty) |
| Canonical | computed; optional `canonical_path` override | self URL of the published locale | Override only by human |
| Noindex | locale row `noindex` | `false` | Human |
| Open Graph image | item `og_image` file link | hero file link | Human |

Not V1 data: focus terms, social title, social description (OG uses SEO title/description). Existing site rules remain: `/es` and `/pt` pages are noindex with no canonical/hreflang while those locales are not in `publishedLocales`.

## 14. Slug / canonical

- **Format:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 100 chars.
- **Unique scope:** (`locale`, `slug`) across all content types, so a slug never changes meaning when a type's route changes. **The database-level unique constraint/index on (`locale`, `slug`) is the final authority** (P1, created and tested in CC-IMP-01), because an application pre-check cannot prevent concurrent races. The BFF keeps a friendly duplicate pre-check before save and at Publish, and maps a database uniqueness violation to the same 409 field error. The same slug in another locale is allowed; a different content type does not bypass the constraint.
- **Reserved:** `new`, `index`, `preview`, `draft`, `edit`, `admin`, `api`, `search`, `page`, `all`.
- **Collision:** 409 with a field error; no auto-suffixing.
- **After publish:** the slug is locked once the locale has `first_published_at` (unpublish, archive and restore do not unlock). V1 has **no slug redirect history** (limitation, P2). Changing a published URL requires a new item.
- **Canonical:** absolute site URL built from the type route + locale prefix + slug at render time; `canonical_path` may override with an internal path (validated `/...`). A Draft never has a canonical because Drafts are never rendered publicly; the admin preview emits `noindex` and no canonical.

## 15. Locales

| Option | Assessment |
|---|---|
| A. Per-locale translation rows (`content_item_locales`) | **Selected.** Per-locale slug uniqueness, per-locale publish state and snapshot, field-level public permission on one column, AI proposals scoped to (item, locale), adding a locale needs no schema change. |
| B. JSON localized fields on the item | Slug uniqueness and draft/published column permissions cannot be enforced inside JSON. Rejected. |
| C. Duplicate content items per locale | Duplicates type, media, relations and lifecycle truth. Rejected (D-031). |
| D. Flat `_en/_es/_pt` columns (repo convention for products/posts) | Blocks, snapshots, slugs and SEO would each need three columns; per-locale publish becomes column-conditional. Kept only for short media alt/caption text (§11). |

- **Default locale:** i18n `defaultLocale` (`en`). **Available locales:** i18n `locales`. **Site-published locales:** `runtimeConfig.public.publishedLocales`. No Settings UI is added.
- **Allowed state:** English published, Spanish draft, Portuguese not started — yes.
- **Locale readiness:** the §21 checklist evaluated per locale.
- **Publish a locale:** only when the locale is in `publishedLocales` and the default locale is published. Publishing the base never publishes a translation.
- **Public routing:** a locale URL resolves only when that locale has a snapshot; otherwise 404. **No fallback** to English content under a `/es` or `/pt` URL.
- **Creating a locale row:** copies block *structure* (ids and types, empty text) from the default locale as a starting point; after creation each locale owns its blocks (structure sync tooling is P2).

## 16. AI source model

- **Eligible sources for a Content AI analysis:** enabled `content_items_files` rows of the current item whose file is AI-readable (shared format contract), **not archived** (lifecycle check), and explicitly selected by the human. Roles `source_document`, `download` and `inline` may be selected; nothing public is required.
- Files linked only to a *related product* are **not** Content AI sources in V1 (attribution safety).
- Limits unchanged: `MAX_FILES_PER_REQUEST = 5`, `MAX_IMAGES_PER_ANALYSIS = 3` (D-030), 60 s reading budget, character caps; original binaries never go to a provider.
- The existing Product AI archived-source gap (sources list, engine resolution, `POST /products/:id/media`) is **not** fixed by Content Center; the content source resolver must include the archived check from its first version (P1 in CC-IMP-08).

## 17. AI target model

**One engine, generalized subject.** The engine is refactored to take a subject `{ kind: 'product' | 'content', id, locale?, identity, resolveSources }`, keeping the product path's behavior and outputs identical. Fingerprint, replay guard, sourceRef payload and rate-limit keys use `kind:id` (plus locale for content). Proposals remain in the existing in-memory replay guard in V1; binding, expiry and restart behaviour are fixed in §18.

**Target `content-draft`** (`server/utils/aiTargets/contentDraftTarget.ts`), declared with the shared `TargetDefinition` contract, zod `.strict()` output validation, leakage and echo checks tuned for longer prose.

Proposal item contract (model output → validated → server-held proposal):

| Element | Values |
|---|---|
| target domain | `content` |
| target record | `content_items.id` + `locale` (from the server-side subject, never from model output) |
| proposal item id | `proposalItemId` — stable and unique within the proposal, assigned by the server when the validated output is stored; identifies each change for Human Review and Apply, including each individual `block:new` |
| target path | `field:title` \| `field:summary` \| `field:seo_title` \| `field:seo_description` \| `block:<id>` \| `block:new` |
| operation | `set` (fields) \| `replace` (existing block data) \| `insert` (new block of an allowed type, appended) |
| existing value | captured by the server from the working copy at analysis time |
| proposed value | string or block `data` validated by the block registry |
| source evidence | source label (`Source N` → display name) only; no page numbers or locators unless real metadata exists (Freeze §9) |
| conflict | `candidateValues` 2–6 for a field or block text, resolved by a human |
| review state | `pending` \| `accepted` \| `edited` \| `rejected` (client), applied state in the replay guard |

Not AI-proposable in V1: slug, canonical, noindex, content type, status, media links and alt text, relations (relation suggestions are P2), publish.

## 18. Proposal apply mapping

| Accepted proposal | Draft storage target | Validation |
|---|---|---|
| `field:title` set | `content_item_locales.title` | ≤ 160 |
| `field:summary` set | `content_item_locales.summary` | ≤ 400 |
| `field:seo_title` set | `content_item_locales.seo_title` | ≤ 120 |
| `field:seo_description` set | `content_item_locales.seo_description` | ≤ 320 |
| `block:<id>` replace | element with that `id` in `blocks` | same type; block schema; block must exist |
| `block:new` insert (one per `proposalItemId`) | appended to `blocks` in the order stored in the server-held proposal; the **server generates the new block UUID** at Apply | type allowed for the content type; block schema; `image` blocks not insertable by AI; the client never supplies the final block id |

Apply contract:
- One PATCH to the locale row per Apply (all accepted items together), setting `last_change_kind = ai_apply` and `draft_revision + 1`.
- Preconditions: Administrator; item not archived; locale row exists; `draft_revision` equals the revision captured at analysis; proposal available, not expired and not already applied.
- **Every submitted change must match a proposal item in the server-held proposal output.** The request identifies accepted items by `proposalItemId` only. Human Review may accept or reject an item, or edit its proposed value (field string or block `data`, re-validated); it may never change `target`, `operation`, `subject`, `locale` or `proposalItemId`, which are always taken from the server-held proposal.
- Apply writes the working copy only — never `published_snapshot`, `status` or publish fields — and never calls Publish.
- Idempotent through the existing replay guard state machine; the single PATCH makes Apply all-or-nothing.

#### Proposal binding — mandatory acceptance contract for CC-IMP-09

Each content proposal is bound server-side when it is stored to: `subject.kind` (`content`), `subject.id`, `locale`, the `draft_revision` read at analysis, the proposal item set (every `proposalItemId` with its target and operation), the source content fingerprint, `PROMPT_CONTRACT_VERSION`, and the authenticated admin user (existing replay-guard binding).

Apply must prove that the `proposalRef` belongs to the same content item and locale addressed by the authenticated request's route. A proposal for Content A can never be applied to Content B, and a proposal for one locale never to another.

**Error convention (fixed, following the existing AI apply routes):** `409` — proposal not found, expired, already applied or being applied; subject, locale, target, operation or `proposalItemId` mismatch; `draft_revision` changed. `400` — unreadable or schema-invalid request body. `422` — an edited proposed value fails field or block validation. No rejection writes anything.

#### `block:new` identity

- Every proposed insert has its own `proposalItemId`; several `block:new` items stay one-to-one and are never matched by array position.
- Review may edit the proposed block `data` only.
- Apply processes accepted inserts in the deterministic order stored in the proposal, appends each after the existing blocks, generates each new block UUID on the server, and returns the mapping `proposalItemId → new block id`.

#### In-memory proposal expiry, restart and replay-guard loss (V1)

- Proposals and the replay guard stay in process memory; no proposal collection is added. A durable multi-instance proposal store remains P2.
- Server restart, TTL expiry (existing 2-hour apply window) or replay-guard eviction make the proposal unavailable: Apply fails safely with `409`, the Draft is not modified, nothing is reconstructed automatically, and the UI tells the user to Analyze again.
- `proposalRef` is a lookup handle and **not an authentication credential**. Safety rests on admin authentication + proposal subject binding + proposal target binding + `draft_revision` + replay/expiry validation.
- Because proposal state is ephemeral, the readiness "unapplied AI proposal" check (§21) is a best-effort soft warning and never a Publish blocker.

#### Pre-existing Product AI debt — not inherited

The Product AI Apply route binds `proposalRef` to the admin user and product (`claimApply`), but does not verify submitted changes against the stored proposal output, and Product generate has no Draft gate. This is **pre-existing cross-domain debt** (§35), not changed by this Blueprint or its review fix. Content Center must not inherit it: the `content-draft` Apply implements the full binding above. When CC-IMP-08 / CC-IMP-09 generalize the Proposal Engine, the Product AI regression tests must pass — Product target, D-025 Product Model Guard, source limits, replay behaviour and Apply behaviour. If a shared server-side binding would change Product AI runtime behaviour, that change must be listed explicitly in the implementation work order, never added implicitly.

Proposals are never persisted to content collections, never public, never in the sitemap or public API; nothing changes before Apply.

### Content Attribution Guard

A shared guard constant added to `server/utils/aiTargetContract.ts` and required by the `content-draft` target (enforced by a test that every content target includes it). The user input names the current content item: content type, locale, title and slug when present, and only the product names/codes a human explicitly linked when the implementation passes them. Rules the prompt states:

1. Material is used only for the current content item; a source that describes another article, case, customer or product family does not become the current item.
2. Product facts may be stated only for explicitly linked products and follow D-025 attribution; values for other models are never copied.
3. No invented customers, results, figures, certifications, dates or quotes (D-008); ambiguous material is omitted.
4. Text marked `[?]` is not a basis for any value.

Adding the guard is a shared prompt-contract change: `PROMPT_CONTRACT_VERSION` increases (D-025 (10)), which only invalidates cached analyses.

## 19. History

**Recommended:** reuse Directus revisions — no new audit collection.

| Option | Assessment |
|---|---|
| A. Directus activity/revisions + `last_change_kind` marker | **Selected.** Every admin write already produces revisions under the admin's identity (Charter §N.4 path; `evidence/audit.get.ts` precedent). The marker makes events explainable. |
| B. New `content_events` collection | Duplicates what Directus records; +1 collection. Rejected for V1. |

Event derivation for `CC-HIST` (read-only, newest first):

| Event | Derived from |
|---|---|
| created | create revision on `content_items` |
| edited | locale revision with `last_change_kind = manual_edit` |
| AI proposal applied | locale revision with `last_change_kind = ai_apply` |
| media linked / unlinked | create / delete activity on `content_items_files` |
| relation changed | create / update / delete activity on `content_relations` |
| published / unpublished | locale revision with `last_change_kind = publish` / `unpublish` |
| archived / restored | item revision where `status` changed to / from `archived` |

Directus revision retention must stay enabled for these collections (checked in CC-IMP-01).

## 20. Versioning

History (§19) and versioning are separate. V1 keeps exactly one published snapshot per locale and the working copy. There is no version list, compare or rollback UI; prior snapshot values remain in Directus revisions as an operator recovery aid only.

## 21. Readiness

Deterministic checklist computed server-side per (item, locale) by `server/utils/contentReadiness.ts`. **No percentages, weights or confidence.** Results are `pass` / `fail` (hard) / `warn` (soft).

| Hard (blocks Publish) | Soft (warning only) |
|---|---|
| Item not archived | `seo_title` or `seo_description` empty (fallback used) |
| Title present; summary present | No OG image (hero fallback) |
| Slug valid, not reserved, unique for the locale | No relations |
| Blocks valid against the registry; type-required blocks present (§7) | An unapplied AI proposal may exist for this locale (best-effort: proposal state is in memory and may already be gone; never a Publish blocker) |
| Hero media present when the type requires it | `noindex` is on |
| Every referenced file exists, is linked, not archived and `is_public` | Other site-published locales not started |
| `resource_download`: ≥ 1 enabled download file | Unpublished changes exist (informational) |
| Content type `publicEnabled` | |
| Locale in `publishedLocales`; non-default locale requires published default locale | |

All checks passing never publishes anything.

## 22. Preview

| Option | Assessment |
|---|---|
| A. Admin-rendered Draft preview | **Selected.** Rendered inside the admin route `/admin/content-center/:id/preview-publish`, protected by the existing admin SSR middleware, from the working copy via the admin BFF, using the same block renderer components as the public site; emits `noindex` and no canonical. |
| B. Signed private preview route | Needs token issuance, expiry and revocation design. Not V1. |
| C. Temporary public-token URL | Link leakage exposes Drafts. Rejected. |

The public route never accepts a draft/preview parameter.

## 23. Publish

| Aspect | Contract |
|---|---|
| Commands | `POST /api/admin/content-center/:id/locales/:locale/publish` · `…/unpublish`; `POST /api/admin/content-center/:id/archive` · `…/restore` |
| Authorization | Administrator session + CSRF (existing middleware). AI routes, Apply and Save never call these handlers. |
| Body | `{ expectedDraftRevision }` for publish; none for the others |
| Preconditions | Hard readiness (§21) recomputed server-side; `expectedDraftRevision === draft_revision` (409 `changed_since_review`) |
| Snapshot | Built server-side from current rows: locale fields, blocks, resolved file links (file id, role, locale alt/caption, version, date), relation target ids, SEO values with fallbacks resolved, `content_type`, `publishedRevision` |
| Write order | (1) PATCH locale row: `published_snapshot`, `published_revision = draft_revision`, `published_at = now`, `first_published_at ??= now`, `last_change_kind = publish`; (2) when publishing the default locale, PATCH item `status = published`, `first_published_at ??= now` |
| Failure | Public exposure requires both item `status = published` and a locale snapshot, so a failure between (1) and (2) exposes nothing; the retry completes step (2) |
| Idempotency | If `published_revision === draft_revision` and a snapshot exists, respond 200 `alreadyPublished` and still ensure step (2) |
| Unpublish | Clears `published_snapshot` / `published_revision` (all locales when default) and sets item `draft` when default; `last_change_kind = unpublish` |
| Archive / Restore | §24 |
| Not V1 | Scheduled publishing, bulk publish, publish review queue |

## 24. Archive / restore

- **Archive:** allowed from `draft` or `published`; sets `status = archived`, `archived_at`. Public route returns 404, the sitemap drops it, relations to it stop rendering, media links remain (and keep protecting the files), and the item is hidden from default admin list filters.
- **Restore:** sets `status = draft`, clears `archived_at` and all snapshots, `last_change_kind = restore` on each locale row. Nothing becomes public without a new Publish.
- **Delete:** not available in V1 (D-023 principle of reversible removal).

## 25. Permissions

Existing model reused: only the Directus `Administrator` role reaches the admin BFF; no Users & Permissions UI is added. Action matrix recorded for a future role split (`BP-DG-10` stays open):

| Action | V1 (Administrator) | Server gate |
|---|---|---|
| Read Draft / preview | ✅ | admin middleware |
| Create / edit Draft | ✅ | not archived; `draft_revision` check |
| Link media / relations | ✅ | ownership + lifecycle checks |
| Run AI analysis | ✅ | not archived; limits; rate limit |
| Review / apply AI | ✅ | proposal match; stale check |
| Publish / unpublish | ✅ | readiness; revision check |
| Archive / restore | ✅ | transition table |

Every BFF write uses an explicit field allowlist (no mass assignment) and verifies that every child row (`content_item_locales`, `content_items_files`, `content_relations`) belongs to the `:id` in the route (IDOR).

## 26. Directus collection plan (proposed — not created)

| Collection | New / reuse | Purpose | Ownership | Key fields | Relations | Indexes / unique | Lifecycle impact | Public access (`nuxt-server`) |
|---|---|---|---|---|---|---|---|---|
| `content_items` | New | Locale-neutral identity and lifecycle | Content Center | `content_type`, `status`, `first_published_at`, `archived_at` | — | index `status`, `content_type` | Holds item status | Read `id`, `content_type` only; filter `status = published` |
| `content_item_locales` | New | Working copy + published snapshot per locale | Content Center | §6.1 | M2O item | unique (`content_items_id`, `locale`); **database unique (`locale`, `slug`)** — final authority — plus BFF friendly pre-check | Holds snapshots | Read `id`, `content_items_id`, `locale`, `slug`, `published_snapshot`, `published_at` only; filter `published_snapshot` not null **and** `content_items_id.status = published` |
| `content_items_files` | New (junction) | Media Library references with role | Content Center (files stay Media Library) | §11 | M2O item, M2O `directus_files` | unique (item, file, role) | none | **None** (snapshot carries public file refs) |
| `content_relations` | New | Product / content references | Content Center (products stay Product Center) | §12 | M2O item, M2O products, M2O item | unique (item, kind, target) | none | **None** (snapshot carries target ids) |
| `directus_files`, `media_file_lifecycle` | Reuse | Files and archive state | Media Library | — | — | — | — | Unchanged (`/api/cms/media` proxy) |
| Directus revisions | Reuse | History | Directus | — | — | — | — | None |

Schema work follows the CLAUDE.md protocol: schema snapshot + database backup + committed snapshot before applying.

## 27. Collection budget

- **Proposed new collections: 4** (`content_items`, `content_item_locales`, `content_items_files`, `content_relations`).
- **Count:** 16 existing + 4 = 20 (cap 25; SPEC worst-case rule ≤ 23). With SPEC's still-applicable conditional `partners` and `certificates`: 22 ≤ 23. SPEC's conditional `applications` and `download_assets` are superseded (D-032).
- **Why each is necessary:**
  - `content_items` — no existing collection has compatible identity/lifecycle semantics (§4).
  - `content_item_locales` — per-locale slug uniqueness, per-locale publish state and column-level public isolation cannot be expressed on the item (§15, §31).
  - `content_items_files` — media references must be relational to be reference-protected and role-typed; `products_files` is owned by products.
  - `content_relations` — typed references to products and content with ordering; JSON slug tags (the `posts` approach) cannot be validated or protected.
- **Not added:** blocks table, events table, versions table, per-type collections, translations of media metadata.
- **Approval:** SPEC requires confirmation of new collections. The `CC-IMP-01` work order must state explicit approval of these 4 collections (and may refresh the stale SPEC budget table).

## 28. Legacy compatibility

| Structure | V1 plan |
|---|---|
| `posts` | Untouched: no schema change, no deletion, no admin UI. Existing `/api/cms/posts*` routes and fixtures keep serving current pages. `/support/faq` keeps using `faq` posts (FAQ is not a V1 content type). A route switches to Content Center only in CC-IMP-10 and only for a type the user enables. Before any cutover, CC-IMP-10 counts real `posts` rows read-only; migration of real rows would be a separately authorized module; deprecation is decided after cutover. |
| `site_content` | Untouched; not part of Content Center. |
| `content/fixtures/*` | Untouched until the corresponding route decision (§35). |
| Recorded doc drift | CURRENT-STATE says `site_content` is a singleton read via `/api/cms/site-content/[key]` (snapshot: not singleton; route absent); SPEC page_key table routes differ from actual routes; routing doc marks News reserved while `pages/resources/news/[slug].vue` exists and `technical-guides` is undocumented; Downloads/Videos placeholders hard-code English. Not changed here. |

## 29. Frontend delivery

Public BFF (CC-IMP-10), `nuxt-server` token:

- `GET /api/cms/content/[type]` (list) and `GET /api/cms/content/[type]/[slug]` (detail), locale from the request.
- Query: `content_item_locales` where `locale = L`, `published_snapshot` not null, item `status = published`; then filter by type registry `publicEnabled` and `L ∈ publishedLocales`.
- Output DTO built **only from `published_snapshot`** through an explicit allowlist mapper: title, summary, blocks (plain text), hero/OG/inline/download files as `/api/cms/media/{uuid}` URLs (download with `?download=true`), SEO (title, description, canonical, noindex), published_at, relations resolved to published targets.
- Before emitting a file URL: `is_public` true and not archived (the media proxy gains the archived check — P1).
- Never output: working copy fields, revisions, `last_change_kind`, internal ids beyond what routing needs, `source_document` files, AI proposals, readiness, history.
- Directus failure → 503, not 404 (product pattern).

## 30. Public route / sitemap

- The confirmed IA and `03-routing-and-navigation.md` govern routes; the preview navigation in `CC-VIS-05` is not IA.
- Registry route proposals (each needs user confirmation before `publicEnabled` becomes true — §35): `technical_article` → `/resources/insights/[slug]`; `case_study` → `/resources/case-studies/[slug]`; `resource_download` → listed on `/resources/downloads` (detail route not yet confirmed); `application_solution` → relationship to the eight D-002 `/applications/[slug]` pages undecided; `news` → none (D-004 / D-013).
- **Sitemap:** includes a content URL only when item published, locale snapshot present, locale ∈ `publishedLocales`, type `publicEnabled` and sitemap-eligible, `noindex` false in the snapshot. Archive, unpublish and restore remove it automatically because the sitemap uses the same query.
- **Search indexing:** robots meta from snapshot `noindex`; non-published locales keep the existing noindex rule; type public gate and publication state apply to any future site search.

## 31. Security model

**P0 public isolation contract:** Draft working copy, archived items, AI proposals, readiness/review state, source documents, history and internal notes can never appear in a public route, public API output, sitemap or search. Controls are layered: (1) `nuxt-server` column and row permissions expose only published snapshots of published items; (2) the public BFF maps only snapshot fields through an allowlist; (3) type, locale and archive gates in the BFF and sitemap; (4) tests below.

| Threat | Risk | Control | Test |
|---|---|---|---|
| Draft leakage | Unreviewed text public | Public reader limited to `published_snapshot`; DTO allowlist | Public API with draft-only item → 404; payload key allowlist test |
| Archived leakage | Removed content remains public | Row filter on item `status = published`; sitemap same query | Archive → detail 404, sitemap excludes |
| Cross-content AI attribution | Another document's facts land in this item | Content Attribution Guard; subject from server; fingerprint includes item/locale | Prompt contract test; fingerprint differs per item/locale |
| Wrong product relation | Mislinked or unpublished product shown | Relation stores id only; render only published products | Relation to draft product not rendered |
| Stale / archived media | Archived or private file served | Link rejects archived; publish requires `is_public` + not archived; proxy archived check | Link archived → 422; proxy archived → 404 |
| Public source leakage | Internal documents downloadable | `source_document` role never in snapshot or DTO; junction not readable by `nuxt-server` | Snapshot builder excludes role; permission test |
| AI direct publish | Unreviewed publication | Publish handlers not reachable from AI/Apply code; Apply writes working copy only | Apply never changes snapshot/status; AI modules do not import publish handlers |
| Slug collision | Wrong page served / overwrite | Database unique constraint on (locale, slug) as final authority + BFF pre-check at save and publish; reserved words; lock after first publish | Sequential duplicate → 409; concurrent duplicate attempts → exactly one succeeds; same slug in another locale allowed; another content type does not bypass; locked slug edit → 422 |
| Locale leakage | Untranslated or unapproved locale exposed | Publish requires locale in `publishedLocales`; no fallback | ES snapshot with ES unpublished site-wide → not served |
| Unauthorized publish | Non-admin publish | Administrator middleware + CSRF | Unauthenticated / wrong origin → 401 / 403 |
| Mass assignment | Client sets status/snapshot/revision | Field allowlists; lifecycle fields only via action routes | PATCH with `status` / `published_snapshot` ignored or 422 |
| IDOR / cross-record access | Editing another item's rows | Ownership check on every child row | Child row of item B via item A route → 403 |
| Apply integrity / proposal binding | Arbitrary or cross-record writes via Apply | Proposal bound server-side to subject, locale, draft revision, item set, source fingerprint, prompt version and admin; client may only accept, reject or edit values; server generates new block ids (§18) | Content A proposal applied to B → 409; wrong locale → 409; modified target / operation / `proposalItemId` → 409; changed revision → 409; several `block:new` map one-to-one; Draft unchanged after every rejection |
| Proposal / session persistence | Proposal lost after restart or expiry, then reconstructed, replayed or applied to a changed Draft | In-memory store with TTL; unavailable proposal → safe 409, no write, no reconstruction, UI asks to Analyze again; `proposalRef` is not a credential; readiness warning is best-effort only (§18) | Expired proposal → Apply 409; proposal missing after restart (fresh replay guard) → 409; wrong content id / locale → 409; Draft unchanged in each case; readiness never blocks on proposal state |

## 32. Test matrix

| Area | Unit | API / contract | Permission / isolation | Module |
|---|---|---|---|---|
| Type & block registry | schema accept/reject, limits, unknown type | — | — | CC-IMP-01 |
| Item / locale CRUD | allowlist mapper | create, save with revision, 409 stale | IDOR, mass assignment, auth | CC-IMP-01 |
| Slug | format, reserved | DB unique (locale, slug): sequential duplicate 409, concurrent attempts → one succeeds, other locale allowed, other type does not bypass; lock after publish | — | CC-IMP-01 / 05 |
| Media references | role rules | link/unlink, archived rejected, duplicate 409 | getFileReferences counts content | CC-IMP-04 |
| Relations | kind/target rules | self/duplicate rejected | render only published targets | CC-IMP-04 / 10 |
| Locales | structure copy | no fallback | locale not site-published not served | CC-IMP-05 / 10 |
| Readiness | every hard/soft rule | endpoint returns checklist | — | CC-IMP-06 |
| Preview | — | admin-only, noindex | unauthenticated preview → redirect | CC-IMP-06 |
| Publish / unpublish | snapshot builder (role exclusion) | preconditions, idempotency, partial failure retry | publish from AI/apply impossible | CC-IMP-06 |
| Archive / restore | transitions | snapshots cleared on restore | archived not public | CC-IMP-07 |
| History | event derivation | revisions read scoped to item | — | CC-IMP-07 |
| AI sources & target | subject generalization (product regression), guard included, fingerprint | eligibility incl. archived, limits 5/3 | cross-item sourceRef rejected | CC-IMP-08 |
| AI apply | mapping table; `block:new` identity and server-generated block ids | subject / locale / target / operation / item binding → 409; expired or missing (restart) proposal → 409; stale revision → 409; replay idempotent; Product AI regression suite | never touches snapshot/status; Draft unchanged on every rejection | CC-IMP-09 |
| Public delivery | DTO allowlist | list/detail, 503 on failure | Draft / archived / proposal / source leakage; sitemap filtering | CC-IMP-10 |

## 33. 1440 / 375 acceptance

UI modules CC-IMP-02 … CC-IMP-09 (and the public pages in CC-IMP-10) are accepted at **1440px** against the PRIMARY master for their module and at **375px** against Freeze §22: no page-level horizontal overflow, no unexpected console errors (fresh tab after server start), workspace navigation reachable, primary actions reachable, AI Accept/Edit/Reject usable, conflicts resolvable, manual Publish explicit. CC-IMP-01 is backend-only (1440 / 375 = N/A).

## 34. Implementation sequence

Not started, not authorized. Each module needs its own work order (protocol §10).

| ID | Name | Scope | Dependencies | Write surface | Recommended model | Visual | Required tests |
|---|---|---|---|---|---|---|---|
| **CC-IMP-01** | Content Foundation | 4 collections (snapshot + backup), type / block / role registries, readiness-free admin BFF: create item + default locale, read, save working copy with revision, slug rules, allowlists, ownership | Collection approval in its work order | Directus schema, `server/api/admin/content-center/**`, `server/utils/content*`, `utils/content*`, types, tests | Opus 5 · High | N/A | registry, CRUD contract, IDOR, mass assignment, slug incl. DB unique (locale, slug) and concurrent duplicate |
| **CC-IMP-02** | List, Workspace Shell & Overview | `CC-00` list/search/filter/create, Content Workspace shell + module rail, `CC-01` Overview (summaries), enable Content Center item in existing Admin shell | CC-IMP-01 | admin pages/components | Sonnet 5 · High | Product Center list pattern + `CC-FLOW-01`; `CC-VIS-01` | component, API list, 1440/375 |
| **CC-IMP-03** | Content Editor | `CC-02` title/summary/blocks editing and ordering | CC-IMP-02 | editor components, block BFF validation | Opus 5 · High | `CC-VIS-02` | block schema round-trip, stale revision, 1440/375 |
| **CC-IMP-04** | Media & Relations | `CC-03` Media Library picker links, roles, alt/caption; product/content relations; `getFileReferences` extension; archived-link rejection | CC-IMP-03 | junction BFF, `mediaLifecycle.ts` | Opus 5 · High | `CC-VIS-03` | reference protection, archived, duplicates, relation rules, 1440/375 |
| **CC-IMP-05** | SEO & Locales | `CC-04` SEO fields, noindex, canonical override, locale row creation, slug lock UI | CC-IMP-03 | locale BFF, SEO components | Sonnet 5 · High | `CC-VIS-04` | slug lock, uniqueness per locale, 1440/375 |
| **CC-IMP-06** | Preview, Readiness & Publish | `CC-05` admin preview renderer, readiness checklist, publish/unpublish with snapshot | CC-IMP-04, CC-IMP-05 | publish BFF, snapshot builder, renderer components | Opus 5 · High | `CC-VIS-05` | readiness, snapshot exclusion, idempotency, preview isolation, 1440/375 |
| **CC-IMP-07** | Archive, Restore & Change History | archive/restore actions; `CC-HIST` read-only timeline from revisions | CC-IMP-06 | lifecycle BFF, history API/UI | Sonnet 5 · High | `PW-VIS-09-CHANGE-HISTORY-D1440` pattern | transitions, event derivation, 1440/375 |
| **CC-IMP-08** | Content AI Target & Source Intake | engine subject generalization (no product regression), `content-draft` target, attribution guard + prompt version bump, content source resolver with archived exclusion, `CC-AI-01` UI | CC-IMP-04, CC-IMP-05 | `server/utils/ai*`, content AI routes, intake UI | Opus 5 · High | `CC-AI-01-SOURCE-INTAKE-D1440` | product AI regression suite, eligibility, limits, fingerprint, 1440/375; real provider calls only if separately authorized |
| **CC-IMP-09** | AI Proposal Review & Apply | `CC-AI-02` review UI, conflicts, apply mapping with proposal-match and stale checks | CC-IMP-08 | content apply BFF, review UI | Opus 5 · High | `CC-AI-02-PROPOSAL-REVIEW-D1440` | mapping, proposal binding (subject / locale / target / item), `block:new` identity, expiry / restart, stale, never-publish, Product AI regression, 1440/375 |
| **CC-IMP-10** | Public Delivery & Sitemap | public content API, `nuxt-server` permissions, media proxy archived check, confirmed routes per type, sitemap, legacy `posts` coexistence | CC-IMP-06 (CC-IMP-07 recommended); user route decisions (§35) | public BFF, pages, sitemap, Directus permissions | Opus 5 · High | existing public design system; routes per IA | leakage suite, sitemap, locale, 503, public 1440/375 |

First candidate: **CC-IMP-01**.

## 35. Risks / open issues

**P0 — blocks implementation:** none open. The P0 contracts in §31 (public isolation), §18 (AI writes Draft only, never publishes), §16 (source limits, no binaries to providers) and D-031 boundaries are mandatory acceptance criteria for the modules that touch them.

**P1 — must be solved inside the named module:**

| # | Issue | Module |
|---|---|---|
| 1 | Explicit approval of 4 new collections; schema snapshot + backup | CC-IMP-01 |
| 2 | Directus revisions enabled/retained for content collections | CC-IMP-01 |
| 3 | Database unique constraint on (`locale`, `slug`) created and tested, including concurrent duplicates; BFF friendly pre-check kept | CC-IMP-01 (UI messaging in CC-IMP-05) |
| 4 | `getFileReferences` counts `content_items_files`; archived files cannot be linked | CC-IMP-04 |
| 5 | Snapshot builder excludes `source_document`; publish requires `is_public` + not archived | CC-IMP-06 |
| 6 | Engine subject generalization without Product AI behavior change | CC-IMP-08 |
| 7 | Content source resolver excludes archived files; generate refuses archived items | CC-IMP-08 |
| 8 | **Mandatory acceptance contract:** proposal subject / locale / target / item binding, `block:new` identity with server-generated block ids, safe expiry and restart behaviour (§18) | CC-IMP-09 |
| 9 | `nuxt-server` column/row permissions configured and verified by test (not inferable from snapshots today) | CC-IMP-10 |
| 10 | Public media proxy checks archived state | CC-IMP-10 |
| 11 | Plain-text block rendering (no `v-html`) | CC-IMP-06 / 10 |

**P2 — registered backlog:** slug redirect history; durable multi-instance proposal/rate-limit store; locale block-structure sync; AI relation and media-metadata suggestions; focus terms / social title / social description fields; scheduled publishing; version list/compare/rollback; signed preview links; `posts` migration and deprecation; `site_content` future; Product-side gaps (archived check in product AI sources and `POST /products/:id/media`, product preview noindex, published product edits going live immediately); stale docs listed in §28; `SECTION_TYPES` code/schema drift (products).

**Pre-existing cross-domain debt (registered, not fixed here):** Product AI Apply does not verify submitted changes against the stored proposal output, and Product generate has no Draft gate (§18). Content Center does not inherit it; any Product AI runtime change needs its own explicit work-order scope, and CC-IMP-08 / CC-IMP-09 must pass the Product AI regression suite.

**OPEN — USER DECISION REQUIRED** (block only CC-IMP-10, not earlier modules):

1. Public route per type: confirm `technical_article` → `/resources/insights/[slug]` and `case_study` → `/resources/case-studies/[slug]`; whether Resource / Download items get a detail page or only a `/resources/downloads` listing; whether Application / Solution items back the eight D-002 `/applications/[slug]` pages or stay separate.
2. Which types become public, and when (routing doc lists resource detail routes as Phase 2; News stays non-public per D-004 / D-013 unless changed).
3. Whether any real `posts` content must be carried into Content Center (decided after a read-only row count).

## 36. Blueprint status

```text
CONTENT MODEL:             FROZEN FOR IMPLEMENTATION
BLOCK MODEL:               FROZEN FOR IMPLEMENTATION
MEDIA MODEL:               FROZEN FOR IMPLEMENTATION
RELATION MODEL:            FROZEN FOR IMPLEMENTATION
SEO MODEL:                 FROZEN FOR IMPLEMENTATION
LOCALE MODEL:              FROZEN FOR IMPLEMENTATION
AI TARGET MODEL:           FROZEN FOR IMPLEMENTATION
DRAFT / PUBLISH CONTRACT:  FROZEN FOR IMPLEMENTATION
PREVIEW CONTRACT:          FROZEN FOR IMPLEMENTATION
PUBLIC DELIVERY CONTRACT:  FROZEN FOR IMPLEMENTATION
DIRECTUS SCHEMA:           PROPOSED — NOT CREATED
IMPLEMENTATION:            NOT STARTED
FIRST CANDIDATE:           CC-IMP-01 — NOT AUTHORIZED
```

Changing a frozen contract here requires a TYPE C governance module; implementation modules may refine only details this Blueprint leaves open.
