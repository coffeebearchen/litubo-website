# LITUBO Admin/CMS Visual & Data Conformance Register V1

**Document type:** Canonical execution register  
**Version:** 1.0  
**Date:** 2026-09-06  
**Document state:** Effective framework; individual implementation facts require V-0 source and runtime verification.  
**Owner:** User (business and visual decisions) / Codex (architecture and acceptance) / Claude (execution and evidence)

---

## 1. Purpose and authority

This register converts the approved Admin/CMS visual and logic masters into enforceable implementation contracts. It prevents a task from being marked complete merely because code compiles, a test passes, or a page uses similar colours.

This file is not a second Charter and is not a second Blueprint. Its authority is limited to executable traceability:

```text
Visual / logic master
→ target route
→ shared shell and component contract
→ data and API contract
→ English-first contract
→ automated and visual evidence
→ verified implementation status
```

The governing order is:

1. User's explicit new decision and verified system facts;
2. `ADMIN-CMS-GOVERNING-CHARTER-V1.md` — governance, scope, decision and change rules;
3. `ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` — programme sequence, domains, data/API principles and dependencies;
4. This register — master-to-route-to-evidence execution contract;
5. `CURRENT-STATE.md` — verified current state and blockers;
6. `MASTER-ROADMAP.md` — progress only; it cannot change the Blueprint sequence;
7. A current approved Codex work order — scoped execution only.

If any item conflicts with the Charter, the Charter wins. If this register appears to conflict with the Blueprint sequence, the Blueprint wins. If documents conflict with the repository, running service, Directus state or a newly confirmed user decision, report the factual conflict before changing code.

`CLAUDE.md` is the only operational task-entry point. This file is mandatory reading for all Admin/CMS code or governance work.

---

## 2. Non-negotiable operating rules

1. A visual master is a page and workflow contract, not a palette suggestion.
2. Automated checks never substitute for visual acceptance.
3. A page cannot be called aligned unless the running service, Git HEAD, target route and visual evidence are known.
4. Admin visible UI is English-first. Chinese may remain only in comments, historical documents, non-rendered internal notes or genuine business data where English substitution would alter the fact.
5. Global Media Library manages reusable files. It is not the same thing as a product-level **Media & Resources** workspace.
6. Do not fabricate Readiness, Category Health, Needs Attention, source counts, media counts, review status, AI state or percentages. Every displayed value needs a defined data source and rule.
7. Product Workspace child pages must not be declared complete before their shared Workspace shell is implemented and accepted.
8. No AI Dossier, bulk Import Queue, real-data import or frontend CMS switch may start before its Blueprint and Decision Gate prerequisites are satisfied.
9. Existing working data, APIs, authentication, lifecycle rules and media governance are preserved unless an approved migration contract explicitly says otherwise.
10. A legacy page may remain available during migration, but it must be identified as `LEGACY`; it must never be reported as its corresponding master being complete.

---

## 3. Status vocabulary

Only the following statuses may be used in this register, Current State, a work order or an implementation report.

| Status | Meaning |
|---|---|
| `NOT_STARTED` | No source implementation or verified route evidence exists. |
| `IN_DISCOVERY` | Source, runtime, data/API or design mapping is being verified; no completion claim is allowed. |
| `LEGACY` | A pre-workspace or pre-master page exists and may be operational, but does not satisfy the master contract. |
| `BLOCKED_BY_GATE` | Implementation is prevented by a named Charter DG or Blueprint BP-DG decision. |
| `IN_IMPLEMENTATION` | A current approved Codex work order is actively changing the stated contract. |
| `AUTOMATED_CHECKED` | Required code checks pass, but visual acceptance has not happened. |
| `VISUALLY_VERIFIED` | Required runtime, desktop, mobile, English and contract evidence has been accepted. |
| `REJECTED` | Evidence proves the current rendered page does not meet the contract. |
| `SUPERSEDED` | A user-approved framework change replaces the specified contract. |

Rules:

- `AUTOMATED_CHECKED` is not `VISUALLY_VERIFIED`.
- A route with no verified runtime provenance cannot be `VISUALLY_VERIFIED`.
- A route containing unresolved visible Chinese cannot be `VISUALLY_VERIFIED` for English Admin.
- A master shown only by a global or unrelated page cannot be marked implemented.
- Status changes require evidence, not optimistic planning language.

---

## 4. Canonical master source registry

The original master files are immutable reference evidence. Exact repository paths must be confirmed in V-0 and entered in the table below. Do not modify, rename, copy or overwrite them.

| ID | Master | Expected source area | Exact filename / identifier | Original state | Implementation authority |
|---|---|---|---|---|---|
| ADM-02 | Product Center — All Products | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-02__product-center__all-products__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-02a | Product Center — Category List | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-02a__product-center__category-list__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-03 | Product Workspace — Specifications | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-03__product-workspace__specifications__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-04 | Product Workspace — Media & Resources | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-05 | Product Workspace — Page Content | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-05__product-workspace__page-content__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-06 | Product Workspace — Relations | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-06__product-workspace__relations__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-07 | Product Workspace — SEO & Locales | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| ADM-08 | Product Workspace — Sources & History | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/` | `ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| LOGIC-01 | Single Product Dossier Workbench | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/` | `01_single_product_dossier_workbench.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |
| LOGIC-02 | Multi-model Import AI Review Queue | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/` | `02_multi_model_import_ai_review_queue.png` | DRAFT retained | FD-001 user-confirmed implementation overlay |

**V-0 action:** replace only the “Expected source area” with the exact discovered repository path. Do not alter original DRAFT labels or fabricate a source path.

---

## 5. Shared visual and interaction contracts

### 5.1 Admin global shell

All Admin/CMS routes use the global Admin shell:

- branded global left navigation;
- a clear active location;
- English visible labels;
- responsive 375px behavior without horizontal overflow or inaccessible primary controls;
- consistent light, engineering-oriented visual system: cold white surfaces, restrained deep green emphasis, limited orange warning/review accent, clear data density and readable spacing.

### 5.2 Product Center contract — ADM-02 and ADM-02a

```text
Global Admin navigation
→ Product Catalogue context rail
→ central All Products or Category Context workspace
→ persistent right Product Control
```

The Product Catalogue rail owns System Views and Product Taxonomy. The central space owns product-category statistics, filters, list/context table and pagination. The right panel owns the selected product or category context. It is not an optional one-off modal.

### 5.3 Product Workspace contract — ADM-03 through ADM-08

```text
Global Admin navigation
→ Product Workspace module rail with completeness
→ breadcrumb, product identity and top actions
→ common horizontal workspace tabs
→ current module central work area
→ persistent right Product Control
```

The common top actions are a controlled Draft workflow: `Save draft`, `Preview`, and `Review` or equivalent approved lifecycle action. The Workspace must expose the product context, workflow limits, source/audit state and blockers consistently across module pages.

No standalone legacy specs/content form qualifies as a Product Workspace page simply because it has a tab or a green button.

---

## 6. Data and API conformance rules

### 6.1 Preserve first

The following are intended to be retained unless a later approved source audit proves otherwise:

- Admin authentication, SSR refresh and security boundaries;
- existing product identity, `product_code`, lifecycle state and category relationship;
- existing global Media Library and folder governance;
- existing source/data-governance protections;
- existing APIs, BFF safety controls and tests that remain compatible;
- existing ProductBasicForm fields and save logic as a future Overview/basic-editor base.

### 6.2 Incremental extension, not destructive replacement

The following contracts are likely required by the masters, but no schema existence is assumed until V-0 verifies it:

| Capability | Required data/API contract | Migration rule |
|---|---|---|
| Product media references | Product ↔ global asset reference, role, sort order, locale/contextual ALT, caption, review/source context | Additive relation; files remain global and are never copied into product records. |
| Public resources | Product ↔ resource record, type, language, version, visibility, review state, source reference | Additive relation; does not replace global file governance. |
| Specifications | Category-defined groups/fields, value, unit, source/evidence link, evidence/review state | Preserve valid existing values; no fabricated readiness. |
| Page content | Controlled module type, product, locale, sort order, approved content/reference state | Not a free-form drag-and-drop page builder. |
| Relations | Product ↔ applications, resources, products, content records and website placements | Separate product relationships from category and Media Library folders. |
| SEO & locales | Locale data, SEO title/description, canonical route, Open Graph media reference, indexing state | Public route ownership stays governed by category and lifecycle. |
| Sources & history | Protected source package, evidence record, original citation/page/sheet, confidence, human decision, change audit | Source originals remain protected and distinct from Media Library/Git. |
| Readiness / health | Defined, computed rule using confirmed data | No hard-coded percent/count; gate required before use. |
| AI dossier | Isolated Draft task, linked source package, AI suggestion, human accept/edit/return decision | Future only; AI cannot publish, move files or overwrite confirmed data. |
| Import queue | Workbook/import batch, per-`product_code` Draft, isolated review task and human decision | Future only; no bulk publish. |

### 6.3 Required data/API evidence before code

Before a module changes schema, API or UI, its Register row must list:

1. existing sources of truth;
2. exact new field/relation/BFF needed, if any;
3. API input validation and output allow-list;
4. permission and lifecycle boundary;
5. migration compatibility and rollback plan;
6. applicable Charter DG and Blueprint BP-DG;
7. test and browser evidence to prove the contract.

---

## 7. English-first conformance contract

All visible Admin UI must be English unless the user explicitly changes this framework.

This includes:

- page titles, breadcrumbs, headings and labels;
- buttons, tabs, menus, selects and option values;
- form help text, empty, loading and error states;
- server-generated success/error messages and Toasts;
- settings, global navigation and shared components;
- workflow, review, source and future AI guidance shown to operators.

The following may remain Chinese if not rendered to an Admin operator:

- source code comments;
- historical governance documents;
- non-rendered internal technical notes;
- genuine business data supplied in Chinese, where translating would falsify the source record.

Every English task must include:

1. source scan for visible Chinese;
2. rendered-route verification;
3. a classification of each Chinese occurrence: visible UI, server UI message, data/fixture, or non-visible text;
4. a record of target English, responsible module and completion status.

Known screenshot evidence at register creation:

| Route | Known visible issue | Current classification |
|---|---|---|
| `/admin/products/4/specs` | Chinese breadcrumb, tabs, heading, action and Directus guidance | `LEGACY` / English non-compliant |
| `/admin/products/4/content` | Chinese labels, actions and module-type options | `LEGACY` / English non-compliant |
| `/admin/products/new` | Chinese back link and page title | English non-compliant |
| `/admin/settings` | substantial Chinese visible UI across the page | English non-compliant |
| `/admin/media` | English largely present; broken thumbnails/alt-text behavior observed | visual quality investigation required |
| `/admin/products` | English largely present; structure does not prove ADM-02 compliance | visual/runtime investigation required |

---

## 8. Master-by-master execution register

### ADM-02 — Product Center / All Products

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** `/admin/products` → `pages/admin/products/index.vue` |
| Required shell | Global Admin nav + Product Catalogue rail + central catalogue + persistent right Product Control. |
| Central contract | Category count strip; search; status, technical category, completeness and language filters; Needs media control; table rows with thumbnail, status, media references, readiness and last update; pagination. |
| Data/API contract | Product identity/status/category; image/media summary; source/audit summary; readiness must be computed from an approved rule. |
| Current code | `pages/admin/products/index.vue` + `components/admin/product/ProductCentreSidebar.vue` + `components/admin/product/ProductControlPanel.vue` + `components/admin/product/ProductCatalogueNav.vue`. BFF: `/api/admin/products/index.get.ts` + `/api/admin/products-summary.get.ts` + `/api/admin/categories-summary.get.ts`. 222 tests pass. |
| Current evidence | `RUNTIME_PROVEN`: HEAD `5ea32f9`, PID 33632 (`D:\LITUBO-website\...nuxi.mjs dev`). `SCREENSHOT_CONFIRMED` (Codex review + V-0 mobile screenshot): 3-column layout code exists but desktop evidence shows gaps vs ADM-02 contract (Readiness% column missing from table, Category tab strip absent at top of central area, Product Control panel rendering unconfirmed at 1440px). English visible in products/index.vue: largely present — no Chinese in template. |
| Implementation status | `AUTOMATED_CHECKED` — code structure in place; DG-10 gates Readiness% and Needs Attention (currently "Not assessed" placeholder). |
| Evidence status | `RUNTIME_PROVEN` + `SCREENSHOT_CONFIRMED` |
| Acceptance status | `SUSPENDED` — Codex declared J-2 visual acceptance failed/suspended; desktop 1440px + right panel data truth not confirmed; origin/master push blocked. |
| Prohibited claim | Basic product table, English strings or a filter alone do not equal ADM-02 completion. |
| Acceptance criteria | Known serving HEAD + desktop 1440px + mobile 375px + functional filter evidence + English scan + right panel data truth (real Readiness%, real media counts). |

### ADM-02a — Product Center / Category Context

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** `/admin/products/categories` → `pages/admin/products/categories.vue`; `/admin/products/categories/:id` → `pages/admin/products/categories/[id].vue` |
| Required shell | Same Product Catalogue shell as ADM-02. |
| Central contract | Category tabs, title/product count, category-specific filters/segments, category product table and pagination. |
| Right contract | Category Health, total products, attention/media gaps, average readiness, description and audit evidence. |
| Data/API contract | Category aggregate BFF (`/api/admin/categories-summary.get.ts`); Category Health/Readiness gated by DG-10 (currently "Not assessed" placeholder). |
| Current code | `pages/admin/products/categories.vue` (category list) + `pages/admin/products/categories/[id].vue` (category context + product table + CategoryContextPanel). BFF: `categories-summary.get.ts`. |
| Current evidence | `REPOSITORY_CONFIRMED`: routes exist. `SCREENSHOT_CONFIRMED` (Codex review): basic category context exists. |
| Implementation status | `AUTOMATED_CHECKED` — tests pass; Category Health gated. |
| Evidence status | `REPOSITORY_CONFIRMED` + `SCREENSHOT_CONFIRMED` |
| Acceptance status | `SUSPENDED` — tied to J-2 overall visual acceptance; no standalone desktop 1440px + 375px acceptance done. |
| Acceptance | Same shell evidence, category navigation/reload proof, no invented health values and both viewport evidence. |

### ADM-03 — Product Workspace / Specifications

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** `/admin/products/:id/specs` → `pages/admin/products/[id]/specs.vue` |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Category-defined specification groups; value, unit, evidence/status and source columns; completeness/blockers/media summary. |
| Right contract | Lifecycle workflow, visibility, draft preview, blockers, recommendations, media/source/review context. |
| Data/API contract | BFF: `/api/admin/products/[id]/specs/` (GET, POST groups/items; PATCH/DELETE). Types: `ProductSpecGroup`, `ProductSpecItem` in `types/product-cms.ts`. |
| Current code | `pages/admin/products/[id]/specs.vue` — standalone route; uses `ProductSubNav` (Chinese tabs); no shared Workspace Shell. |
| English non-compliance | Visible Chinese UI: back link "← 产品列表", page title placeholder "产品编辑", card title "技术参数", buttons "取消"/"＋ 添加参数组"/"确认添加"/"添加", table headers "标签（EN）"/"值（EN）"/"备注", empty states (3 lines Chinese), group label "（无标题）"/"X 条". |
| Current evidence | `SCREENSHOT_CONFIRMED` (Codex): Chinese legacy specs form with no Workspace Shell. `REPOSITORY_CONFIRMED`: code reviewed. |
| Implementation status | `LEGACY` — basic CRUD exists; no Workspace Shell; English non-compliant. |
| Evidence status | `SCREENSHOT_CONFIRMED` + `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` — cannot accept before shared Workspace Shell is implemented and accepted. |
| Acceptance | Shared shell accepted first; then desktop/mobile, English scan, and actual source/evidence contract proof. |

### ADM-04 — Product Workspace / Media & Resources

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** product media at `/admin/products/:id/media` → `pages/admin/products/[id]/media.vue`. Global Media Library (`/admin/media`) is NOT ADM-04. |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Visual media references with role, preview, order, contextual ALT/caption and source ref; public resource records with type, language, version, review and visibility. |
| Right contract | Media needs attention, linked assets/resources, blockers and source/audit. |
| Data/API contract | BFF: `/api/admin/products/[id]/media/` (GET/POST/PATCH/DELETE), `/api/admin/media/files.get.ts`, `/api/admin/asset/[id].get.ts` (proxy). Types: `ProductMedia` in `types/product-cms.ts`. Files remain in global Media Library; product stores only references (role, ALT, caption, sort, focal point). |
| Current code | `pages/admin/products/[id]/media.vue` — standalone route; has media-library picker modal, role labels (Chinese constants), focal point UI; no shared Workspace Shell. |
| English non-compliance | FILE_ROLE_LABELS constants in Chinese (Hero 主图, 概览图, etc. — rendered as UI labels). Back link "← 产品列表", empty states in Chinese, "已关联" badge. |
| Current evidence | `REPOSITORY_CONFIRMED`: code reviewed; product-level media reference exists. |
| Implementation status | `LEGACY` — basic reference CRUD exists; file-remain-global rule is implemented; no Workspace Shell; English non-compliant. |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` — cannot accept before shared Workspace Shell is implemented and accepted. |
| Prohibited claim | `/admin/media` must never be cited as ADM-04 completion. |

### ADM-05 — Product Workspace / Page Content

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** `/admin/products/:id/content` → `pages/admin/products/[id]/content.vue` |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Controlled public product-page template: Hero & summary, key capabilities, typical applications, FAQ and CTA; each has edit/review/source context. |
| Right contract | Page readiness by locale, review/visibility, draft preview, media summary and blockers. |
| Data/API contract | BFF: `/api/admin/products/[id]/sections/` (GET/POST/PATCH/DELETE + items). Types: `ProductSection`, `ProductSectionItem`, `SectionType` in `types/product-cms.ts`. Controlled module types (not freeform). |
| Current code | `pages/admin/products/[id]/content.vue` — standalone route; module-type constants in Chinese; no shared Workspace Shell. |
| English non-compliance | Module type labels all Chinese in `SECTION_LABELS` constant (文本, 功能列表, 概览, etc. — rendered in UI). Buttons "取消"/"＋ 添加模块"/"确认添加", empty states (3 lines Chinese). |
| Current evidence | `SCREENSHOT_CONFIRMED` (Codex): Chinese module-type form with no Workspace Shell. `REPOSITORY_CONFIRMED`: code reviewed. |
| Implementation status | `LEGACY` — basic CRUD exists; no Workspace Shell; English non-compliant. |
| Evidence status | `SCREENSHOT_CONFIRMED` + `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` — cannot accept before shared Workspace Shell is implemented and accepted. |

### ADM-06 — Product Workspace / Relations

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Not yet implemented (V-0):** no admin page route exists for product relations. No `pages/admin/products/[id]/relations.vue`. |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Applications/industries, public resource records, related products, content relations and controlled website placements. |
| Data/API contract | Explicit relation records, ordering, published-state checks and placement approval; distinct from categories, Media Library folders and website menu editing. No BFF API for product relations exists yet (AUDIT REQUIRED BEFORE SCHEMA). |
| Current code | None for relations. Sources BFF (`/api/admin/products/[id]/sources/`) exists for ADM-08 usage, not ADM-06. |
| Current evidence | `REPOSITORY_CONFIRMED`: no routes or components found for this domain. |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |

### ADM-07 — Product Workspace / SEO & Locales

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Confirmed (V-0):** `/admin/products/:id/seo` → `pages/admin/products/[id]/seo.vue`. Note: this route is NOT listed in `ProductSubNav.vue` tab list (5 tabs only). |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Language/default state, search preview, SEO fields, indexing/sitemap workflow, Open Graph media, canonical/route and locale readiness matrix. |
| Data/API contract | BFF: `/api/admin/products/[id]/seo.get.ts` + `seo.patch.ts`. Types: `ProductSeoFields` in `types/product-cms.ts`. EN-only SEO fields currently; no locale readiness matrix. |
| Current code | `pages/admin/products/[id]/seo.vue` — standalone route; basic SEO title/description/noindex fields + search preview widget; no shared Workspace Shell; not in ProductSubNav. |
| English non-compliance | Mostly English; inline hints "建议 50–70 个字符…" and "草稿或未完善页面建议勾选" are Chinese visible hints. Search preview label "搜索预览（示意）". |
| Current evidence | `REPOSITORY_CONFIRMED`: route and BFF confirmed. |
| Implementation status | `LEGACY` — basic EN-only SEO form; no locale readiness matrix; no Workspace Shell; not linked from SubNav. |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` — cannot accept before shared Workspace Shell is implemented and accepted. |
| Prohibited claim | A plain SEO field form does not equal ADM-07 (missing locale readiness matrix, Open Graph media picker, canonical route display). |

### ADM-08 — Product Workspace / Sources & History

| Contract field | Requirement / V-0 Finding |
|---|---|
| Target route | **Not yet implemented (V-0):** no admin page route exists. BFF APIs exist but no `pages/admin/products/[id]/sources.vue` or similar page. |
| Required shell | Full Product Workspace contract in Section 5.3. |
| Central contract | Protected source package, evidence records, cited original excerpt/page/sheet, confidence, human decision queue and change history. |
| Right contract | Evidence status, publish blockers, visibility, source package and future AI boundary. |
| Data/API contract | BFF: `/api/admin/products/[id]/sources/index.get.ts` + `index.post.ts` + `[sourceId]/archive.post.ts`. Types: `ProductSourceRecord`, `SourceReviewStatus` in `types/product-cms.ts`. Protected originals are NOT in Media Library or Git (by design). Human review queue is NOT yet implemented. |
| Current code | Sources BFF APIs exist (GET/POST/archive); no corresponding admin page, no Workspace Shell, no human decision queue UI. |
| Current evidence | `REPOSITORY_CONFIRMED`: BFF code and types reviewed; no admin page. |
| Implementation status | `IN_DISCOVERY` — BFF foundation started; page not implemented. |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` — page does not exist; cannot accept. |

### LOGIC-01 — Single Product Dossier Workbench

| Contract field | Requirement |
|---|---|
| Target domain | Future per-Draft controlled AI-assisted production lane. |
| Contract | Current Draft only → linked source package only → AI suggestions → human accept/edit/return → module review. |
| Non-negotiable limits | AI cannot publish, delete/move files, alter confirmed fields or process other products. |
| Prerequisites | Product Workspace, source package/evidence, product-media-source audit, human review and publish gate. |
| Current status | `NOT_STARTED`. |

### LOGIC-02 — Multi-model Import AI Review Queue

| Contract field | Requirement |
|---|---|
| Target domain | Future structured workbook import and isolated per-`product_code` review queue. |
| Contract | Workbook/sheet mapping → Draft creation only → one isolated AI task per Draft → human accept/edit/return → Product Workspace review. |
| Non-negotiable limits | No bulk publish; no cross-product source blending; no AI overwrite of confirmed fields. |
| Prerequisites | Logic-01 prerequisites plus approved import schema, mapping validation and batch governance. |
| Current status | `NOT_STARTED`. |

---

## 9. Visual acceptance and runtime provenance

No Admin/CMS visual task can be marked `VISUALLY_VERIFIED` without all of the following:

1. exact route and expected master ID;
2. known running Git HEAD or an explicit statement that runtime provenance cannot be proven;
3. desktop evidence at 1440px;
4. mobile evidence at 375px;
5. side-by-side master contract comparison, not general aesthetic opinion;
6. no horizontal overflow, obscured controls, overlap or inaccessible primary actions;
7. English-first visible UI verification;
8. real data/API evidence for displayed status, count, readiness, source and review values;
9. automated test/typecheck/lint/build evidence for code tasks only;
10. user/Codex acceptance before `origin/master` promotion.

The report must distinguish:

- screenshot of a **running old/unknown service**;
- screenshot of the stated current Git HEAD;
- source-code-only evidence;
- automated evidence;
- user visual acceptance.

---

## 10. Definition of Ready and Definition of Done

### 10.1 Definition of Ready for every Admin/CMS code task

Before Claude changes code, the approved work order must state:

| Required item | Evidence |
|---|---|
| Current module | Blueprint module and Register row |
| Target master | Exact master ID and actual source path |
| Target route | Existing or planned Nuxt route |
| Shared shell | Existing component or prerequisite work needed |
| Data/API contract | Existing sources, required additions and validation boundary |
| Gate check | Applicable Charter DG and Blueprint BP-DG |
| English scope | Visible UI strings affected |
| Acceptance | Automated checks plus 1440px/375px visual criteria |
| No-touch scope | Data, schema, AI, Import, deployment and other exclusions |

### 10.2 Definition of Done for every Admin/CMS code task

Before a task can report completion, it must provide:

| Required item | Evidence |
|---|---|
| Exact files | Staged/committed file list |
| Data/API contract | Evidence that the specified contract exists and is truthful |
| Safety | Input validation, permissions and lifecycle boundary where relevant |
| Automated checks | Relevant tests, typecheck, lint, build and diff check |
| English | Source scan and rendered verification |
| Runtime | Exact serving HEAD/worktree evidence |
| Visual | 1440px and 375px route screenshots compared to the target master |
| Status | Register row changed only with evidence |
| Git | Local commit; checkpoint/master handling follows approved Git policy |
| Open items | Unresolved DG/BP-DG and blocked work clearly listed |

---

## 11. No-jump sequencing rules

1. Do not pick the next module because it is visually easy.
2. Do not rebuild a child tab before the relevant Product Catalogue or Product Workspace shell is ready.
3. Do not code artificial right-panel metrics before their data rules are approved.
4. Do not substitute a global page for a product-context master page.
5. Do not start AI, Import, real product trial, frontend CMS cutover or publishing automation early.
6. Do not silently change Blueprint sequence; only a user-approved framework change can do that.
7. Do not push `origin/master` while integrated visual acceptance is failed, suspended or unverified.

The intended programme remains:

```text
V-0 source/runtime fact audit
→ shared Product Catalogue and Product Workspace foundations
→ ADM-02 / ADM-02a Product Center alignment
→ ADM-03 through ADM-08 in Blueprint order
→ lifecycle/review/readiness completion
→ Logic-01 Single Product Dossier
→ Logic-02 Multi-model Import Queue
→ qualified frontend CMS read path
```

The Blueprint remains the binding source for exact module numbering and dependencies.

---

## 12. V-0 evidence ledger — completed 2026-09-06

The following table is populated from read-only source/runtime evidence gathered in V-0.5 audit session.

| Evidence item | Required value | V-0 Confirmed value | Source / command | Verified date | Status |
|---|---|---|---|---|---|
| Repository HEAD | Exact SHA | `5ea32f975795637f0ff469f568707e06aea8a2dc` | `git rev-parse HEAD` | 2026-09-06 | `RUNTIME_PROVEN` |
| `origin/master` | Exact SHA | `2a3e67f952c3443166c73851467b7eaf77cec243` | `git rev-parse origin/master` | 2026-09-06 | `RUNTIME_PROVEN` |
| Checkpoint branch | Exact branch and SHA | `origin/backup/admin-cms-j2` @ `5ea32f9...` (matches HEAD) | `git rev-parse origin/backup/admin-cms-j2` | 2026-09-06 | `RUNTIME_PROVEN` |
| localhost:3000 process | PID + command line + worktree proof | PID 33632; `node.exe "D:\LITUBO-website\node_modules\...nuxi.mjs" dev`; worktree = `D:\LITUBO-website` | PowerShell `Get-CimInstance Win32_Process` | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-02 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-02a actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-03 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-04 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-05 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-06 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-07 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| ADM-08 actual master path | Repo-relative path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| Logic-01 actual master path | Repo-relative path | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| Logic-02 actual master path | Repo-relative path | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | Glob + Read (image viewed) | 2026-09-06 | `RUNTIME_PROVEN` |
| Visible Chinese scan | Full classified list | See table below | `rg -n` + source review of all pages/admin/ and components/admin/ | 2026-09-06 | `RUNTIME_PROVEN` |
| Product Center route/component/API map | Verified mapping | See table below | source review | 2026-09-06 | `RUNTIME_PROVEN` |
| Product Workspace route/component/API map | Verified mapping | See table below | source review | 2026-09-06 | `RUNTIME_PROVEN` |
| Global Admin shell English compliance | All nav labels English | `layouts/admin.vue`: "Content Management", "Product Center", "Content Center" (disabled), "Media Library", "Settings", "Sign out" — all English. Chinese only in `aria-label` attributes and code comments (not visible UI). | source review | 2026-09-06 | `RUNTIME_PROVEN` |

### 12.1 Visible Chinese UI classification

| File | Lines | Chinese text | Classification | Target module for fix |
|---|---|---|---|---|
| `layouts/admin.vue` | 78, 96 | `aria-label="打开菜单"`, `aria-label="关闭菜单"` | Aria label — not visible UI text | Low priority / English accessibility pass |
| `pages/admin/products/new.vue` | 44–45 | `← 产品列表`, `新建产品` | Visible UI: back link, page title | J-3 Workspace Shell / Product Center refactor |
| `pages/admin/products/[id]/specs.vue` | 98, 109, 111, 117, 122, 128–130, 137–138, 143, 147, 172, 180 | Back link, card title, buttons, form labels, table headers, empty states, hints | Visible UI throughout | J-3/J-4 Workspace Shell + ADM-03 |
| `pages/admin/products/[id]/content.vue` | 33–40, 118, 126, 134–135, 141, 144, 151–153, 166, 175, 184 | Module type labels, buttons, form labels, empty states | Visible UI: module type labels in SECTION_LABELS constant rendered in select | J-3/J-4 Workspace Shell + ADM-05 |
| `pages/admin/products/[id]/media.vue` | 56–66, 94–96, 129, 206, 215, 234, 251–252, 262–264, 308, 319, 321–323, 328–387, 400 | FILE_ROLE_LABELS, focal point labels, media modal labels, back link | Visible UI: role labels, focal point grid, modal labels, back link | J-3/J-4 Workspace Shell + ADM-04 |
| `pages/admin/products/[id]/seo.vue` | 41, 45, 53–54, 69, 79, 81, 86, 96, 103, 105, 110, 118, 121–124 | SEO hints, labels, preview texts | Visible UI: form hints, section heading "搜索预览（示意）" | J-3/J-4 Workspace Shell + ADM-07 |
| `pages/admin/settings.vue` | 64–373 | Entire page UI in Chinese | Visible UI: all labels, headings, buttons, hints | Settings page English pass (separate module) |
| `components/admin/product/ProductSubNav.vue` | 7–11 | 基础信息, 页面模块, 技术参数, 图片与资料, 产品 FAQ | Visible UI: all 5 tab labels | J-3 Workspace Shell replacement |
| `components/admin/product/PublishPanel.vue` | 15–20, 27, 33, 36, 44, 49 | Button labels, confirmation dialogs, panel title, publish date format | Visible UI: lifecycle action buttons, panel title | J-3/J-4 right Product Control refactor |

### 12.2 Product Center route/component/API map

| Layer | Item | Path |
|---|---|---|
| Page | All Products | `pages/admin/products/index.vue` |
| Page | Category List | `pages/admin/products/categories.vue` |
| Page | Category Context | `pages/admin/products/categories/[id].vue` |
| Component | Left catalogue rail | `components/admin/product/ProductCentreSidebar.vue` |
| Component | Sub-nav (Products/Categories) | `components/admin/product/ProductCatalogueNav.vue` |
| Component | Right panel | `components/admin/product/ProductControlPanel.vue` |
| Component | Status badge | `components/admin/StatusBadge.vue` |
| BFF | List products | `server/api/admin/products/index.get.ts` |
| BFF | Products summary | `server/api/admin/products-summary.get.ts` |
| BFF | Categories summary | `server/api/admin/categories-summary.get.ts` |
| BFF | Asset proxy | `server/api/admin/asset/[id].get.ts` |
| Utility | Query helpers | `server/utils/adminProductsQuery.ts` |
| Utility | Asset proxy helpers | `server/utils/adminAssetProxy.ts` |
| Types | Product/Category | `types/product-cms.ts` (AdminProduct, CategorySummary, ProductsSummary) |

### 12.3 Product Workspace route/component/API map (legacy pages — no shared shell)

| Layer | Item | Path | Status |
|---|---|---|---|
| Page | Product overview/basic | `pages/admin/products/[id]/index.vue` | LEGACY |
| Page | Specs | `pages/admin/products/[id]/specs.vue` | LEGACY |
| Page | Content/sections | `pages/admin/products/[id]/content.vue` | LEGACY |
| Page | Media | `pages/admin/products/[id]/media.vue` | LEGACY |
| Page | FAQ | `pages/admin/products/[id]/faq.vue` | LEGACY |
| Page | SEO | `pages/admin/products/[id]/seo.vue` | LEGACY |
| Page | Preview | `pages/admin/products/[id]/preview.vue` | LEGACY |
| Page | New product | `pages/admin/products/new.vue` | LEGACY |
| Component | Sub-nav (Chinese tabs) | `components/admin/product/ProductSubNav.vue` | LEGACY — to be replaced by Workspace Shell tabs |
| Component | Basic form | `components/admin/product/ProductBasicForm.vue` | Preserve-first |
| Component | Publish panel | `components/admin/product/PublishPanel.vue` | Preserve-first; needs English pass |
| BFF | Product CRUD | `server/api/admin/products/[id].get.ts`, `index.post.ts`, `[id].patch.ts` | Preserve |
| BFF | Specs | `server/api/admin/products/[id]/specs/` (6 endpoints) | Preserve |
| BFF | Sections/content | `server/api/admin/products/[id]/sections/` (7 endpoints) | Preserve |
| BFF | Media | `server/api/admin/products/[id]/media/` (4 endpoints) | Preserve |
| BFF | FAQ | `server/api/admin/products/[id]/faq/` (4 endpoints) | Preserve |
| BFF | SEO | `server/api/admin/products/[id]/seo.get.ts`, `seo.patch.ts` | Preserve |
| BFF | Sources | `server/api/admin/products/[id]/sources/` (3 endpoints) | Preserve — ADM-08 foundation |
| BFF | Preview data | `server/api/admin/products/[id]/preview-data.get.ts` | Preserve |
| Page | Global Media Library | `pages/admin/media/index.vue` | Separate — NOT ADM-04 |
| Page | Settings | `pages/admin/settings.vue` | Separate — English pass needed |
| Types | All workspace types | `types/product-cms.ts` | Preserve and extend |

---

## 13. Change control

This register can be changed only when:

1. a user explicitly changes the framework, visual master, business rule or acceptance standard; or
2. V-0/source/runtime evidence corrects a factual entry without changing the framework; or
3. an approved Codex work order updates a row after verified implementation evidence.

Every material change must state:

- reason;
- affected master(s), route(s), data/API contract(s) and gate(s);
- compatibility/rollback consequence;
- whether the Charter, Blueprint, Current State or Roadmap also needs a cross-reference update.

No ordinary coding task may alter a master contract or claim a module is complete without this register being updated with evidence.

