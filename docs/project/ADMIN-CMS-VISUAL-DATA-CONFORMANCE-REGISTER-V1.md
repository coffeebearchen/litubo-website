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

The original master files are immutable reference evidence. Do not modify, rename, copy or overwrite them. All paths below were re-confirmed file-by-file in V-0.5.1 (`Glob` enumeration of `docs/design-reference/**`, plus direct image read).

### 4.1 Two distinct master packages exist

V-0.5.1 established that Admin/CMS visual references live in **two separate, non-identical packages**, each with its own self-declared status. V-0.5 recorded only the second one and therefore under-reported the evidence base.

| Package | Path root | Self-declared status (verbatim source) | Registered in index? |
|---|---|---|---|
| **P1 — Visual Master V1** | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/` | `README_VISUAL_INDEX.md` calls itself “Claude 的视觉唯一入口”; ADM-02 rows are `DRAFT`; rule: “没有对应 `CONFIRMED` 图，不得开始该页面正式代码施工”. | Yes — `README_VISUAL_INDEX.md` |
| **P2 — Inbox draft input** | `docs/design-reference/inbox/admin-cms-ai-v1/` | `README.md`: “**must not be treated as approved visual masters or as code specifications**”; “**No page may be implemented directly from these pictures**”; “It contains desktop references only; it is not a 375px mobile specification.” | No |

Both packages remain untracked (`??`) by design and are never staged.

### 4.2 Confirmed master file registry (12 files, individually verified)

| ID | Master | Exact repository path | Package | Viewport | Original state (source’s own label) |
|---|---|---|---|---|---|
| ADM-02 | Product Center — desktop master | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png` | P1 | 1440px | `DRAFT` (index row ADM-02) |
| ADM-02 | Product Center — **mobile master** | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png` | P1 | 375px | `DRAFT` (index row ADM-02) |
| ADM-02 | Product Center — All Products reference | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-02a | Product Center — Category List | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-03 | Product Workspace — Specifications | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-04 | Product Workspace — Media & Resources | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-05 | Product Workspace — Page Content | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-06 | Product Workspace — Relations | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-07 | Product Workspace — SEO & Locales | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| ADM-08 | Product Workspace — Sources & History | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | P2 | desktop only | Draft input only — not an approved master |
| LOGIC-01 | Single Product Dossier Workbench | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | P1 | flow reference | `DRAFT`（流程参考） |
| LOGIC-02 | Multi-model Import AI Review Queue | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | P1 | flow reference | `DRAFT`（流程参考） |

### 4.3 Recorded fact conflicts — resolution required from Codex, not from Claude

These are reported, not resolved. Claude must not pick a winner.

| # | Conflict | Evidence | Consequence |
|---|---|---|---|
| CF-1 | **ADM numbering namespaces disagree.** `README_VISUAL_INDEX.md` assigns ADM-04–08 = “单型号 Product Dossier” and ADM-09–11 = “多型号导入与审核队列”. This Register and the Blueprint assign ADM-04 = Media & Resources, ADM-05 = Page Content, ADM-06 = Relations, ADM-07 = SEO, ADM-08 = Sources. | `README_VISUAL_INDEX.md` rows vs Blueprint §6 | The same ADM number denotes different modules in the two documents. Any work order citing “ADM-04”–“ADM-08” must state which namespace it means. |
| CF-2 | **P2 package forbids the use V-0.5 recorded for it.** V-0.5 registered the eight P2 images as “DRAFT retained / FD-001 user-confirmed implementation overlay”. The package README says they “must not be treated as approved visual masters” and “No page may be implemented directly from these pictures.” | `inbox/admin-cms-ai-v1/README.md` lines 5, 18 | FD-001 (a user decision) outranks a package’s self-label under §1 governing order item 1, but the package’s own restriction must remain visible and must not be silently overwritten. |
| CF-3 | **No 375px master exists for ADM-02a through ADM-08.** The index rule requires both a 1440px and a 375px `CONFIRMED` master before formal code construction. Only ADM-02 has a 375px file, and it is `DRAFT`. | `README_VISUAL_INDEX.md` line 3; P2 README line 24 | The 375px contract for ADM-02a–ADM-08 is undefined. Mobile acceptance criteria for those modules cannot be authored from existing evidence. |
| CF-4 | **Both ADM-02 masters render a Chinese admin UI**, while §7 of this Register and the P2 README both declare English the confirmed admin baseline. | Direct image read of both ADM-02 P1 files | The English-first contract and the ADM-02 master imagery disagree. English-first governs visible UI; the master governs layout and information hierarchy only. |
| CF-5 | **The two ADM-02 masters describe different right-hand panels.** P1 desktop-1440 shows a right **“AI 批处理入口”** rail; §5.2 of this Register specifies a persistent right **Product Control**. | P1 desktop-1440 image vs §5.2 | The ADM-02 right-panel contract is not settled. No right-panel work may proceed on assumption. |

**V-0.5.1 action taken:** exact paths confirmed for all 12 files; no master file was modified, renamed, copied or staged.

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

All rows below were re-verified in V-0.5.1 against the working tree at HEAD `9a9d306`. Implementation status, Evidence status and Acceptance status are three independent axes and must never be substituted for one another.

### ADM-02 — Product Center / All Products

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path (1440px) | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png` |
| Master actual path (375px) | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png` — **recorded for the first time in V-0.5.1; V-0.5 omitted it** |
| Master actual path (P2 reference) | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` |
| Original state / FD-001 | P1 rows labelled `DRAFT` in `README_VISUAL_INDEX.md`; P2 README forbids treating its image as an approved master. FD-001 records the user's `USER-CONFIRMED FOR IMPLEMENTATION` decision for ADM-02, which under §1 item 1 outranks both self-labels. FD-001 does **not** authorize AI, import, real data or publication. |
| Target route | `/admin/products` |
| Current actual route | `/admin/products` → `pages/admin/products/index.vue` — exists |
| Page / component evidence | `pages/admin/products/index.vue`; `components/admin/product/ProductCentreSidebar.vue`; `components/admin/product/ProductControlPanel.vue`; `components/admin/product/ProductCatalogueNav.vue`; `components/admin/StatusBadge.vue` |
| server API evidence | `server/api/admin/products/index.get.ts`; `server/api/admin/products-summary.get.ts`; `server/api/admin/categories-summary.get.ts`; `server/api/admin/asset/[id].get.ts` |
| types / tests evidence | `types/product-cms.ts` (`AdminProduct`, `ProductsSummary`); `server/utils/adminProductsQuery.ts`; `server/utils/adminAssetProxy.ts`; `tests/productCenter.test.ts`, `tests/assetProxy.test.ts` — 222 tests recorded green at commit `5ea32f9`; **not re-run in V-0.5.1** (this task runs no tests). |
| Data/API preservable | Product identity/status/category read path; `product_code`; status multi-select filtering; category aggregate; asset proxy security boundary; BFF input validation helpers. |
| Data/API to confirm or add | Real Readiness/completeness value and its rule; real media-reference count per row; real source/audit summary; Needs Attention query. None of these may be rendered until their rule is approved. |
| Charter DG | DG-11 (产品完整度 Readiness 计算规则) — **unresolved**. DG-16 (视觉资料包备份) — unresolved. |
| Blueprint BP-DG | BP-DG-02 (readiness/completeness formula) — **unresolved**; currently gates the disabled Needs Attention control. |
| Prerequisites | J-2 stage. No upstream module blocks it. |
| English-first status | `pages/admin/products/index.vue` — **zero Chinese occurrences** (verified by scan). Shared `layouts/admin.vue` contributes one visible Chinese tooltip (`title="Phase 9A-2 后开放"`, line 114) plus two Chinese `aria-label` values. |
| Implementation status | `AUTOMATED_CHECKED` |
| Evidence status | `SCREENSHOT_CONFIRMED` (desktop Codex review + user-supplied 375px screenshot); **`RUNTIME_NOT_PROVEN`** — see §12 runtime provenance. |
| **Mobile 375px acceptance** | **`FAILED`** — see §8a. |
| **Integrated visual acceptance** | **`SUSPENDED`** |
| **origin/master promotion** | **`BLOCKED`** |
| Prohibited claim | A product table, English strings, passing tests or a working filter do not equal ADM-02 completion. |
| Next step | 等待 Codex 决定 |

### ADM-02a — Product Center / Category Context

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). Mobile contract undefined. |
| Original state / FD-001 | P2 draft input only — package README forbids direct implementation. FD-001 covers ADM-02a as user-confirmed implementation direction. |
| Target route | `/admin/products/categories` and `/admin/products/categories/:id` |
| Current actual route | Both exist — `pages/admin/products/categories.vue`; `pages/admin/products/categories/[id].vue` |
| Page / component evidence | The two pages above; `ProductCatalogueNav.vue`; CategoryContextPanel section inside `categories/[id].vue` |
| server API evidence | `server/api/admin/categories-summary.get.ts`; `server/api/admin/categories.get.ts`; `server/api/admin/products/index.get.ts` (category filter) |
| types / tests evidence | `types/product-cms.ts` (`CategorySummary`); `tests/productCenter.test.ts` category-context cases |
| Data/API preservable | Category aggregate counts by status; category→product filter; category list read path. |
| Data/API to confirm or add | Category Health value and rule; average readiness; media-gap and attention counts. All currently render as “Not assessed” placeholders and must stay that way until approved. |
| Charter DG | DG-10 (Category Health 业务定义) — **unresolved**; rendered as `Not assessed (DG-10)`. |
| Blueprint BP-DG | BP-DG-01 (Category Health formula) — unresolved. BP-DG-03 (taxonomy/hierarchy) — unresolved. |
| Prerequisites | J-2 stage, shares the Product Catalogue shell with ADM-02. |
| English-first status | No Chinese occurrences found in either page file. |
| Implementation status | `AUTOMATED_CHECKED` |
| Evidence status | `REPOSITORY_CONFIRMED`; desktop screenshot reviewed by Codex; **`RUNTIME_NOT_PROVEN`**. |
| Mobile 375px acceptance | `NOT_REVIEWED` — no 375px master and no 375px screenshot for this route. |
| Integrated visual acceptance | `SUSPENDED` — tied to the J-2 chain. |
| Next step | 等待 Codex 决定 |

### ADM-03 — Product Workspace / Specifications

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-03 as confirmed direction; it does not waive the Workspace Shell prerequisite. |
| Target route | `/admin/products/:id/specs` inside a shared Product Workspace Shell |
| Current actual route | `/admin/products/:id/specs` → `pages/admin/products/[id]/specs.vue` — exists, but as a **standalone legacy page**, not inside a Workspace Shell |
| Page / component evidence | `pages/admin/products/[id]/specs.vue`; `components/admin/product/ProductSubNav.vue` (legacy tab strip) |
| server API evidence | **7 endpoints** under `server/api/admin/products/[id]/specs/`: `index.get.ts`, `index.post.ts`, `[gid].patch.ts`, `[gid].delete.ts`, `[gid]/items.post.ts`, `[gid]/items/[iid].patch.ts`, `[gid]/items/[iid].delete.ts`. *(V-0.5 recorded “6 endpoints” — corrected.)* |
| types / tests evidence | `types/product-cms.ts` (`ProductSpecGroup`, `ProductSpecItem`). No dedicated specs test file found. |
| Data/API preservable | Spec group/item CRUD; ownership-chain validation; existing EN/ES/PT value and note fields. |
| Data/API to confirm or add | Category-defined field sets; unit model and conversion; per-value evidence/source link; per-value review state; completeness contribution. |
| Charter DG | No Charter DG assigned specifically to the parameter model; DG-11 readiness consumes spec completeness. |
| Blueprint BP-DG | BP-DG-04 (parameter model, units, conversions) — **unresolved; blocks ADM-03**. |
| Prerequisites | **J-3 Workspace Shell must exist and be accepted first**; then J-4. |
| English-first status | **Non-compliant.** Visible Chinese at lines 33, 43, 47, 52, 59, 74, 78, 83, 90, 98, 99, 109, 111, 117, 118, 122, 128, 129, 130, 137, 138, 143, 147, 162, 166, 170, 172, 180 (28 occurrences). |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` + `SCREENSHOT_CONFIRMED` (Codex desktop review) |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

### ADM-04 — Product Workspace / Media & Resources

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-04 as confirmed direction. |
| Target route | `/admin/products/:id/media` inside a shared Product Workspace Shell |
| Current actual route | `/admin/products/:id/media` → `pages/admin/products/[id]/media.vue` — exists as a **standalone legacy page** |
| Page / component evidence | `pages/admin/products/[id]/media.vue` (library picker modal, role select, focal-point grid); `ProductSubNav.vue` |
| server API evidence | **4 endpoints** under `server/api/admin/products/[id]/media/`: `index.get.ts`, `index.post.ts`, `[mid].patch.ts`, `[mid].delete.ts`. Supporting: `server/api/admin/asset/[id].get.ts` (hardened proxy), `server/api/admin/media/files.get.ts`, `server/api/admin/files/[uuid]/meta.get.ts`, `server/api/admin/files/[uuid]/focal.patch.ts`. *(The two `files/[uuid]/` endpoints were not recorded in V-0.5.)* |
| types / tests evidence | `types/product-cms.ts` (`ProductMedia`, `FileRole`); `tests/assetProxy.test.ts` covers the proxy boundary only, not the product-media contract. |
| Data/API preservable | Reference-only model (files stay global, product stores UUID + role + alt/caption + sort + focal point); duplicate-link guard; asset proxy security controls. |
| Data/API to confirm or add | Public **resource** records (type, language, version, visibility, review state) — currently absent; media→source evidence link; media review state; ordering semantics. |
| Charter DG | DG-12 (media `file_role` 枚举与排序规则) — **unresolved**. |
| Blueprint BP-DG | BP-DG-05 (media roles, ordering, resource taxonomy) — **unresolved; blocks ADM-04 writes**. |
| Prerequisites | **J-3 Workspace Shell**, then **J-3.5 product-media-source audit**, then J-5. |
| English-first status | **Non-compliant.** 62 Chinese occurrences; `FILE_ROLE_LABELS` (lines 56–66) and the focal-point label grid (lines 94–96) are rendered UI values, not comments. |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` (no route screenshot on record) |
| Acceptance status | `NOT_REVIEWED` |
| Prohibited claim | `/admin/media` is the **global Media Library**. It must never be cited as ADM-04 implementation, and it is not marked `LEGACY` for ADM-04 purposes — it is a different domain. |
| Next step | 等待 Codex 决定 |

### ADM-05 — Product Workspace / Page Content

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-05 as confirmed direction. |
| Target route | `/admin/products/:id/content` inside a shared Product Workspace Shell |
| Current actual route | `/admin/products/:id/content` → `pages/admin/products/[id]/content.vue` — exists as a **standalone legacy page** |
| Page / component evidence | `pages/admin/products/[id]/content.vue`; `ProductSubNav.vue` |
| server API evidence | **8 endpoints** under `server/api/admin/products/[id]/sections/`: `index.get.ts`, `index.post.ts`, `[sid].patch.ts`, `[sid].delete.ts`, `[sid]/items.get.ts`, `[sid]/items.post.ts`, `[sid]/items/[iid].patch.ts`, `[sid]/items/[iid].delete.ts`. *(V-0.5 recorded “7 endpoints” — corrected.)* |
| types / tests evidence | `types/product-cms.ts` (`ProductSection`, `ProductSectionItem`, `SectionType` — 13 values). No dedicated sections test file found. |
| Data/API preservable | Controlled module-type enum (not freeform); section/item CRUD; ownership-chain validation; enable/disable flag; sort order. |
| Data/API to confirm or add | Per-module review state, version and rollback; locale-level readiness; source/evidence link per module; public-eligibility rule. |
| Charter DG | DG-13 (页面内容模块审核粒度：整产品 vs 逐模块) — **unresolved**. |
| Blueprint BP-DG | BP-DG-07 (content module types, review/version/rollback) — **unresolved; blocks ADM-05**. |
| Prerequisites | **J-3 Workspace Shell**, then J-6b. |
| English-first status | **Non-compliant.** 38 Chinese occurrences; `SECTION_LABELS` (lines 33–45) are rendered `<option>` values in the module-type select. |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` + `SCREENSHOT_CONFIRMED` (Codex desktop review) |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

### ADM-06 — Product Workspace / Relations

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-06 as confirmed direction; no code authorization follows from that alone. |
| Target route | `/admin/products/:id/relations` (planned) inside a shared Product Workspace Shell |
| Current actual route | **None.** `Glob pages/admin/**/*.vue` returns 15 files; no `relations.vue` among them. |
| Page / component evidence | None. |
| server API evidence | **None.** `Glob server/api/admin/**/*.ts` returns 60 endpoints; none serves a product-relations domain. The `sources/` endpoints belong to ADM-08 and must not be counted here. |
| types / tests evidence | No relation type in `types/product-cms.ts`; no test. |
| Data/API preservable | Nothing exists to preserve. |
| Data/API to confirm or add | Entire domain — relation record, direction, allowed target kinds (product / application / resource / content), ordering, published-state check, placement approval. `AUDIT REQUIRED BEFORE SCHEMA`. |
| Charter DG | No Charter DG assigned. |
| Blueprint BP-DG | BP-DG-08 (relation semantics) — **unresolved; blocks all ADM-06 work**. |
| Prerequisites | **J-3 Workspace Shell**, then **J-3.5**, then J-6c. |
| English-first status | Not applicable — no UI exists. |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` (absence verified by full route and API enumeration) |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

### ADM-07 — Product Workspace / SEO & Locales

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-07 as confirmed direction. |
| Target route | `/admin/products/:id/seo` inside a shared Product Workspace Shell |
| Current actual route | `/admin/products/:id/seo` → `pages/admin/products/[id]/seo.vue` — exists as a **standalone legacy page** |
| **V-0.5 error corrected** | V-0.5 stated “this route is NOT listed in `ProductSubNav.vue` tab list (5 tabs only)”. **This is factually wrong.** `components/admin/product/ProductSubNav.vue` defines **6 tabs**; line 12 is `{ label: 'SEO', path: '/admin/products/${productId}/seo' }`. The SEO tab **is** present and linked. The earlier audit counted only the five *Chinese* labels and mistook that for the total tab count. |
| Page / component evidence | `pages/admin/products/[id]/seo.vue` (title/description/noindex + SERP preview widget); `ProductSubNav.vue` line 12 |
| server API evidence | **2 endpoints**: `server/api/admin/products/[id]/seo.get.ts`, `server/api/admin/products/[id]/seo.patch.ts` |
| types / tests evidence | `types/product-cms.ts` (`ProductSeoFields`). No dedicated SEO test file found. |
| Data/API preservable | EN SEO title/description with server-side length limits; `seo_noindex` flag; existing public sitemap/robots exclusion behaviour. |
| Data/API to confirm or add | Locale readiness matrix (ES/PT); canonical route display; Open Graph media picker bound to the media reference model; structured-data and hreflang publication rule. |
| Charter DG | DG-14 (SEO 与多语言发布规则，ES/PT 激活条件) — **unresolved**. |
| Blueprint BP-DG | BP-DG-09 (locale, canonical, noindex, SEO release) — **unresolved; blocks ADM-07 and the J-10 public cutover**. |
| Prerequisites | **J-3 Workspace Shell**, then J-6d. |
| English-first status | **Non-compliant.** 18 Chinese occurrences at lines 41, 45, 53, 54, 65, 69, 79, 81, 86, 96, 103, 105, 110, 118, 121, 122, 123, 124 — including the visible hint “建议 50–70 个字符…” (line 81) and the section heading “搜索预览（示意）” (line 118). |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` (no route screenshot on record) |
| Acceptance status | `NOT_REVIEWED` |
| Prohibited claim | A plain SEO field form does not equal ADM-07 — the locale readiness matrix, Open Graph media picker and canonical route display are all absent. |
| Next step | 等待 Codex 决定 |

### ADM-08 — Product Workspace / Sources & History

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` |
| 375px master | **None exists** (CF-3). |
| Original state / FD-001 | P2 draft input only. FD-001 covers ADM-08 as confirmed direction. |
| Target route | `/admin/products/:id/sources` (planned) inside a shared Product Workspace Shell |
| Current actual route | **None.** No `sources.vue` or history page exists among the 15 admin pages. |
| Page / component evidence | None. |
| server API evidence | **3 endpoints** exist: `server/api/admin/products/[id]/sources/index.get.ts`, `index.post.ts`, `[sourceId]/archive.post.ts`. These are backend-only; nothing in the Admin UI consumes them. |
| types / tests evidence | `types/product-cms.ts` (`ProductSourceRecord`, `SourceReviewStatus`); `tests/sourceRecords.test.ts` (21 cases, recorded green at an earlier commit). |
| Data/API preservable | `source_file_id` required-UUID rule (zero-source defence, 422 `SOURCE_REFERENCE_REQUIRED`); `source_locator` as in-file position descriptor only; logical archive with no physical DELETE; `nuxt-server` role has **no** permission on `product_source_records`. |
| Data/API to confirm or add | Human decision queue; confidence model; cited excerpt/page/sheet display; change-history/audit timeline; publish-blocker derivation. |
| Charter DG | No Charter DG assigned. |
| Blueprint BP-DG | BP-DG-06 (evidence confidence, `source_locator`, retention) — **unresolved; blocks ADM-08 and AI provenance**. |
| Prerequisites | **J-3 Workspace Shell**, then **J-3.5**, then J-6a. |
| English-first status | Not applicable — no UI exists. |
| Implementation status | `IN_DISCOVERY` — BFF foundation exists; no page. |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

### LOGIC-01 — Single Product Dossier Workbench

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` |
| Original state / FD-001 | `DRAFT`（流程参考）per `README_VISUAL_INDEX.md`. FD-001 confirms it as a logic direction and **explicitly does not authorize AI**. |
| Target route | None assigned. Future per-Draft AI-assisted lane. |
| Current actual route | **None.** |
| Page / component / API / types evidence | None. No AI provider adapter, no snapshot store, no proposal record exists in the working tree. |
| Data/API preservable | Nothing exists to preserve. |
| Data/API to confirm or add | Frozen `InputSnapshot`; versioned proposal with evidence links; per-field human accept/edit/return decision; cost/retention/audit logging. |
| Charter DG | H.4 AI Gate chain — unresolved. |
| Blueprint BP-DG | BP-DG-11 (AI provider/model, budget, key, logs, retention) — **unresolved**. |
| Prerequisites | J-3, J-3.5, J-4…J-6e all complete, plus separate user authorization. Blueprint stage J-7. |
| English-first status | Not applicable — no UI exists. |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` (absence verified) |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

### LOGIC-02 — Multi-model Import AI Review Queue

| Contract field | V-0.5.1 verified finding |
|---|---|
| Master actual path | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` |
| Original state / FD-001 | `DRAFT`（流程参考）per `README_VISUAL_INDEX.md`. FD-001 confirms it as a logic direction and **explicitly does not authorize import or real data**. |
| Target route | None assigned. Future workbook import and per-`product_code` review queue. |
| Current actual route | **None.** |
| Page / component / API / types evidence | None. No import job collection, mapping validator or queue exists in the working tree. |
| Data/API preservable | Nothing exists to preserve. |
| Data/API to confirm or add | Import batch record; field mapping; validation preview and error report; Draft-only creation; per-`product_code` isolation; rollback. |
| Charter DG | DG-15 (导入模板字段与错误修复规则) — **unresolved**. |
| Blueprint BP-DG | BP-DG-12 (import template, duplicate/error correction) — **unresolved**. |
| Prerequisites | All LOGIC-01 prerequisites plus approved import schema and batch governance. Blueprint stage J-8. |
| English-first status | Not applicable — no UI exists. |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` (absence verified) |
| Acceptance status | `NOT_REVIEWED` |
| Next step | 等待 Codex 决定 |

---

## 8a. Confirmed mobile 375px failure — ADM-02 Product Center

The user supplied a 375px screenshot of `/admin/products`. It establishes the following as fact:

| # | Observed defect |
|---|---|
| 1 | A horizontal scrollbar is present at the bottom of the page. |
| 2 | The `Product Center` heading is clipped/obscured by the top region. |
| 3 | The product list is still the desktop multi-column table; its right-hand columns fall outside the visible area. |
| 4 | A phone user must drag horizontally and cannot fully read or operate the primary product information. |

Registered consequence:

```text
ADM-02 Product Center
Evidence:                     SCREENSHOT_CONFIRMED
Mobile 375px acceptance:      FAILED
Integrated visual acceptance: SUSPENDED
origin/master promotion:      BLOCKED
Runtime provenance:           RUNTIME_NOT_PROVEN
```

**Contract comparison now possible.** V-0.5.1 recovered the previously unregistered 375px master (`.../admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png`). It specifies a **stacked card list** — one card per product carrying thumbnail, name, product code, a completeness bar, source label, updated time, a status badge and a per-card action — together with a sticky header, a four-tile status strip, search/filter/sort controls and a fixed bottom action bar. It does **not** specify a horizontally scrolling desktop table at 375px. The observed failure is therefore a contract deviation against a master that exists, not merely an aesthetic complaint.

Rules that follow:

- This `FAILED` verdict must not be softened because automated tests pass, because the route returns HTTP 200, or because the page can be opened.
- `SUSPENDED` must never be recorded as “mobile passed”.
- The card-list contract above is descriptive evidence of the master, not an implementation authorization. No ADM-02 mobile code may start without a separate complete Codex work order.

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

## 12. V-0 evidence ledger — corrected 2026-09-06 (V-0.5.1)

This ledger **supersedes the V-0.5 ledger**, which contained stale and incorrect entries. Corrections are marked.

### 12.0 Git and runtime evidence

| Evidence item | V-0.5.1 confirmed value | Source / command | Status |
|---|---|---|---|
| Repository HEAD | `9a9d306f895d6b0a752b0f5309b4c080d2a0ff7b` | `git rev-parse HEAD` | Confirmed. **V-0.5 recorded `5ea32f9…`, which was already superseded by its own commit — corrected.** |
| `origin/master` | `2a3e67f952c3443166c73851467b7eaf77cec243` | `git rev-parse origin/master` | Confirmed; unchanged; **not promoted**. |
| Checkpoint branch | `origin/backup/admin-cms-j2` @ `9a9d306f895d6b0a752b0f5309b4c080d2a0ff7b` | `git rev-parse origin/backup/admin-cms-j2` | Confirmed equal to HEAD and a valid ancestor (`git merge-base --is-ancestor` → 0). |
| Working tree vs HEAD | Identical for every tracked file | `git diff HEAD --name-only` → empty | Confirmed. Only the four protected reference items remain `??`. |
| Protected commit chain | All nine of `178b340 317bec0 fdc83d2 5821289 4a74e42 69c0e18 948ad9b 5ea32f9 9a9d306` are ancestors of HEAD | `git merge-base --is-ancestor <sha> HEAD` → 0 for each | Confirmed; none rewritten. |
| localhost:3000 owning process | **PID 27024**, started `2026-09-06 17:19:37`, `node … node_modules\.bin\..\@nuxt\cli\bin\nuxi.mjs dev` | `Get-NetTCPConnection -LocalPort 3000`; `Get-CimInstance Win32_Process` | **V-0.5 recorded PID 33632 as `RUNTIME_PROVEN`. That process no longer exists.** The recorded evidence decayed within one session. |
| **Runtime provenance** | **`RUNTIME_NOT_PROVEN`** | — | See 12.0a. |

#### 12.0a Why runtime provenance is `RUNTIME_NOT_PROVEN`

What can be shown:

- a listener on port 3000 is owned by PID 27024, launched from `D:\LITUBO-website`;
- that process started at `17:19:37`, after HEAD commit `9a9d306` was written at `17:15:49`;
- every tracked file in the working tree is byte-identical to HEAD.

What cannot be shown, and why the verdict is therefore negative:

1. The Nuxt dev server serves the **working tree**, not a commit. Nothing in the running service reports a commit SHA, so no response can be tied to `9a9d306`.
2. Dev-mode HMR and module caching mean the bytes held in memory need not equal the bytes now on disk.
3. The user-supplied 375px screenshot carries no timestamp, PID or build identifier. It cannot be attributed to any commit or to either observed process.
4. V-0.5's own PID-based claim is already falsified by PID 33632's disappearance, which demonstrates that PID observation is not durable provenance.

Consequently no route in this register may be marked `VISUALLY_VERIFIED` on current evidence (§3 rule: “A route with no verified runtime provenance cannot be `VISUALLY_VERIFIED`”). Establishing provenance requires a commit-stamped build identifier exposed by the running service, or an equivalent mechanism Codex approves.

### 12.0b Master path evidence — 12 files

Every path below was enumerated by `Glob docs/design-reference/**` and, for the two ADM-02 P1 files, additionally confirmed by direct image read in V-0.5.1. Full paths are recorded in §4.2 and are not abbreviated to a parent directory.

| ID | File | Confirmed |
|---|---|---|
| ADM-02 (1440px, P1) | `…/CMS-AI-VISUAL-MASTER-V1/admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png` | **New in V-0.5.1** |
| ADM-02 (375px, P1) | `…/CMS-AI-VISUAL-MASTER-V1/admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png` | **New in V-0.5.1** |
| ADM-02 (P2) | `…/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | Re-confirmed |
| ADM-02a | `…/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | Re-confirmed |
| ADM-03 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | Re-confirmed |
| ADM-04 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | Re-confirmed |
| ADM-05 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | Re-confirmed |
| ADM-06 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | Re-confirmed |
| ADM-07 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | Re-confirmed |
| ADM-08 | `…/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | Re-confirmed |
| LOGIC-01 | `…/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | Re-confirmed |
| LOGIC-02 | `…/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | Re-confirmed |

### 12.1 English-first visible-text ledger — complete scan

Scan method: regex `[\u4e00-\u9fff]` over `layouts/admin.vue`, `pages/admin/`, `components/admin/`, with line numbers. **246 occurrences across 10 files in `pages/admin/`**, plus `layouts/admin.vue` and two components. No file was modified.

Classification key — **UI** = rendered to an operator; **ARIA** = assistive-technology only; **COMMENT** = source/CSS comment, never rendered.

| Route | Source file | Lines | Representative visible Chinese | Class | Future module |
|---|---|---|---|---|---|
| all `/admin/*` | `layouts/admin.vue` | 114 | `title="Phase 9A-2 后开放"` — hover tooltip on the disabled Content Center item | **UI** | Global shell English pass |
| all `/admin/*` | `layouts/admin.vue` | 78, 96 | `aria-label="打开菜单"`, `aria-label="关闭菜单"` | ARIA | Accessibility English pass |
| all `/admin/*` | `layouts/admin.vue` | 76, 88, 91, 160, 199, 261, 311, 349, 356, 364 | HTML/CSS comments | COMMENT | none — may remain |
| `/admin/login` | `pages/admin/login.vue` | 22, 36, 38, 40, 55, 61, 73, 86 | `请输入邮箱和密码`; `登录尝试过多，请稍后重试`; `该账号无管理员权限`; `邮箱或密码错误`; `产品管理后台`; `管理员邮箱`; `密码`; `登录中…`/`登录` | **UI** (8) | **Not previously registered.** Login English pass |
| `/admin/products` | `pages/admin/products/index.vue` | — | **none** | — | compliant |
| `/admin` | `pages/admin/index.vue` | — | **none** | — | compliant |
| `/admin/products/categories`, `/…/categories/:id` | `categories.vue`, `categories/[id].vue` | — | **none** | — | compliant |
| `/admin/products/new` | `pages/admin/products/new.vue` | 21, 22, 23, 34, 44, 45 | `产品名称（EN）为必填项`; `Slug 为必填项`; `产品分类为必填项`; `保存失败，请重试`; `← 产品列表`; `新建产品` | **UI** (6) | Product Center / J-3 refactor |
| `/admin/products/:id` | `pages/admin/products/[id]/index.vue` | 31, 52, 56, 73, 83, 84, 95, 118, 120 | `产品名称（EN）为必填项`; `已保存`; `保存失败，请重试`; `状态更新失败`; `← 产品列表`; `产品详情`; `基础信息`; `创建时间`; `最后更新` | **UI** (9) | **Not previously registered.** J-3 Workspace Shell |
| `/admin/products/:id/specs` | `pages/admin/products/[id]/specs.vue` | 33, 43, 47, 52, 59, 74, 78, 83, 90, 98, 99, 109, 111, 117, 118, 122, 128, 129, 130, 137, 138, 143, 147, 162, 166, 170, 172, 180 | `技术参数`; `＋ 添加参数组`; `确认添加`; table headers `标签（EN）`/`值（EN）`/`备注`; empty states; `（无标题）`; `X 条` | **UI** (27) + COMMENT (1: line 162) | J-3 shell + ADM-03 |
| `/admin/products/:id/content` | `pages/admin/products/[id]/content.vue` | 33–45, 58, 63, 68, 72, 91, 95, 105, 106, 116, 118, 122, 126, 134, 135, 141, 144, 149, 151, 152, 153, 156, 166, 170, 175, 184 | `SECTION_LABELS` option values (`文本`, `功能列表`, `概览`, `图文`, `优势亮点`, `应用场景`, `检测对象`, `工作原理`, `选型配置`, `产线集成`, `报价提醒`, `视频`, `案例`); `页面模块`; `＋ 添加模块`; empty states | **UI** (35) + COMMENT (3: 122, 149, 156) | J-3 shell + ADM-05 |
| `/admin/products/:id/media` | `pages/admin/products/[id]/media.vue` | 56–66, 94–96, 129, 135, 148, 206, 215, 221, 234, 239, 243, 251, 252, 262, 263, 264, 268, 269, 308, 319, 321, 322, 323, 328, 331, 333, 339, 340, 344, 345, 349, 355, 374, 379, 386, 387, 397, 399, 400, 410, 422, 424, 425, 428, 432, 433, 442, 454, 462, 720 | `FILE_ROLE_LABELS` (`Hero 主图`, `概览图`, `应用场景`, `细节图`, `图库`, `视频封面`, `产品手册`, `规格书`, `工程图纸`, `操作手册`, `认证证书`); focal-point grid (`左上`…`右下`); `图片与资料`; `从媒体库选择`; `已关联` | **UI** (61) + COMMENT (1: line 720) | J-3 shell + J-3.5 + ADM-04 |
| `/admin/products/:id/faq` | `pages/admin/products/[id]/faq.vue` | 26, 27, 42, 46, 51, 58, 71, 79, 80, 90, 92, 98, 102, 106, 107, 111, 117, 118, 129, 131, 137, 138 | `问题（EN）为必填项`; `FAQ 已添加`; `确认删除此 FAQ 条目？`; `产品 FAQ`; `＋ 添加 FAQ`; `来源备注（内部用）`; `此产品暂无 FAQ`; `（无问题文字）`; `来源:` | **UI** (22) | **Not previously registered. No ADM master covers a FAQ tab** — see 12.1a |
| `/admin/products/:id/seo` | `pages/admin/products/[id]/seo.vue` | 41, 45, 53, 54, 65, 69, 79, 81, 86, 96, 103, 105, 110, 118, 121, 122, 123, 124 | `SEO 设置`; `页面标题（EN）`; `建议 50–70 个字符…`; `noindex（禁止搜索引擎收录此页面）`; `搜索预览（示意）`; `此页面已设为 noindex…` | **UI** (17) + COMMENT (1: line 175) | J-3 shell + ADM-07 |
| `/admin/media` | `pages/admin/media/index.vue` | 126 | code comment only (`// … sidebar "正式目录"`) | COMMENT (1) | **compliant** — English pass already completed |
| `/admin/settings` | `pages/admin/settings.vue` | 64, 76, 80, 103, 107, 122, 141, 147, 157, 176, 192, 193, 199, 204, 205, 207, 212, 214, 218, 222, 229, 231, 234, 240, 245, 250, 252, 257, 262, 265, 271, 277, 305, 313, 316, 323, 325, 329, 331, 335, 337, 342, 348, 350, 355, 357, 360, 361, 364, 365, 368, 369, 373 | Whole page: `网站设置`; `首次初始化`; `公司与公开联系资料`; `社媒链接`; `安全与 AI 连接`; all labels, buttons, hints and confirms | **UI** (50) + COMMENT (4: 202, 212, 262, 329, 355 headers) | Settings English pass (separate module, no ADM master) |
| product tabs | `components/admin/product/ProductSubNav.vue` | 7, 8, 9, 10, 11 | `基础信息`, `页面模块`, `技术参数`, `图片与资料`, `产品 FAQ` — **5 of 6 tab labels; line 12 `SEO` is already English** | **UI** (5) | J-3 Workspace Shell replaces this component |
| product tabs | `components/admin/product/ProductSubNav.vue` | 28 / 27, 40, 51, 81 | `aria-label="产品编辑导航"` / comments | ARIA (1) + COMMENT (4) | Accessibility pass |
| product pages | `components/admin/product/PublishPanel.vue` | 15, 17, 18, 20, 27, 33, 36, 44, 49 | `提交审核`; `退回草稿`; `发布`; `撤回草稿`; `已归档状态，如需恢复请联系管理员`; `确认发布此产品？…`; `确认撤回至草稿？…`; `发布状态`; `首次发布：` + `toLocaleDateString('zh-CN')` | **UI** (9) | J-3 right Product Control refactor |
| product forms | `components/admin/product/ProductBasicForm.vue` | — | **none** | — | compliant (English pass completed) |
| Product Center | `ProductCentreSidebar.vue`, `ProductCatalogueNav.vue`, `ProductControlPanel.vue`, `StatusBadge.vue` | — | **none** | — | compliant |

**Result: visible Chinese is NOT absent.** Approximately **249 visible-UI occurrences** remain across 9 files. Four files carrying visible Chinese were absent from the V-0.5 ledger entirely: `pages/admin/login.vue`, `pages/admin/products/[id]/index.vue`, `pages/admin/products/[id]/faq.vue`, and (as a comment-only, compliant case) `pages/admin/media/index.vue`.

#### 12.1a Unmastered route discovered

`/admin/products/:id/faq` → `pages/admin/products/[id]/faq.vue` exists and is linked from `ProductSubNav.vue` line 11, with a 4-endpoint BFF at `server/api/admin/products/[id]/faq/`. **No ADM master in either package covers a standalone product FAQ tab.** In the P2 reference set, FAQ appears as a *module inside ADM-05 Page Content*, not as its own workspace tab. This route therefore has no visual contract. Status: `LEGACY`, master `NONE`. Resolution: 等待 Codex 决定.

### 12.2 Product Center route/component/API map

| Layer | Item | Path | Status |
|---|---|---|---|
| Page | All Products (ADM-02) | `pages/admin/products/index.vue` | `AUTOMATED_CHECKED`; 375px `FAILED` |
| Page | Category List (ADM-02a) | `pages/admin/products/categories.vue` | `AUTOMATED_CHECKED` |
| Page | Category Context (ADM-02a) | `pages/admin/products/categories/[id].vue` | `AUTOMATED_CHECKED` |
| Page | Admin dashboard | `pages/admin/index.vue` | No ADM master; `LEGACY` |
| Page | Login | `pages/admin/login.vue` | No ADM master; `LEGACY`; English non-compliant |
| Component | Left catalogue rail | `components/admin/product/ProductCentreSidebar.vue` | Preserve |
| Component | Sub-nav (Products/Categories) | `components/admin/product/ProductCatalogueNav.vue` | Preserve |
| Component | Right panel | `components/admin/product/ProductControlPanel.vue` | Preserve; right-panel contract unsettled (CF-5) |
| Component | Status badge | `components/admin/StatusBadge.vue` | Preserve |
| BFF | List products | `server/api/admin/products/index.get.ts` | Preserve |
| BFF | Products summary | `server/api/admin/products-summary.get.ts` | Preserve |
| BFF | Categories summary | `server/api/admin/categories-summary.get.ts` | Preserve |
| BFF | Category list | `server/api/admin/categories.get.ts` | Preserve |
| BFF | Page presets | `server/api/admin/presets.get.ts` | Preserve |
| BFF | Asset proxy | `server/api/admin/asset/[id].get.ts` | Preserve — hardened |
| Utility | Query helpers | `server/utils/adminProductsQuery.ts` | Preserve |
| Utility | Asset proxy helpers | `server/utils/adminAssetProxy.ts` | Preserve |
| Types | Product/Category | `types/product-cms.ts` — `AdminProduct`, `CategorySummary`, `ProductsSummary` | Preserve and extend |

### 12.3 Product Workspace route/component/API map — legacy pages, no shared shell

Endpoint counts below were re-derived from a full `Glob server/api/admin/**/*.ts` enumeration (60 files). Two counts in the V-0.5 ledger were wrong and are corrected here.

| Layer | Item | Path | Status |
|---|---|---|---|
| Page | Product overview/basic | `pages/admin/products/[id]/index.vue` | `LEGACY`; English non-compliant |
| Page | Specs (ADM-03) | `pages/admin/products/[id]/specs.vue` | `LEGACY`; English non-compliant |
| Page | Content/sections (ADM-05) | `pages/admin/products/[id]/content.vue` | `LEGACY`; English non-compliant |
| Page | Media (ADM-04) | `pages/admin/products/[id]/media.vue` | `LEGACY`; English non-compliant |
| Page | FAQ | `pages/admin/products/[id]/faq.vue` | `LEGACY`; **no ADM master** (12.1a) |
| Page | SEO (ADM-07) | `pages/admin/products/[id]/seo.vue` | `LEGACY`; **is linked from ProductSubNav line 12** |
| Page | Preview | `pages/admin/products/[id]/preview.vue` | `LEGACY`; no ADM master |
| Page | New product | `pages/admin/products/new.vue` | `LEGACY`; English non-compliant |
| Page | **Relations (ADM-06)** | **absent** | `NOT_STARTED` |
| Page | **Sources & History (ADM-08)** | **absent** | `IN_DISCOVERY` — BFF only |
| Component | Sub-nav | `components/admin/product/ProductSubNav.vue` — **6 tabs**, 5 Chinese labels + `SEO` | `LEGACY` — replaced by Workspace Shell tabs |
| Component | Basic form | `components/admin/product/ProductBasicForm.vue` | Preserve-first; English compliant |
| Component | Publish panel | `components/admin/product/PublishPanel.vue` | Preserve-first; English non-compliant |
| BFF | Product CRUD | `products/[id].get.ts`, `products/index.post.ts`, `products/[id].patch.ts` | Preserve |
| BFF | Specs | `products/[id]/specs/` — **7 endpoints** *(V-0.5 said 6 — corrected)* | Preserve |
| BFF | Sections/content | `products/[id]/sections/` — **8 endpoints** *(V-0.5 said 7 — corrected)* | Preserve |
| BFF | Media | `products/[id]/media/` — 4 endpoints | Preserve |
| BFF | Media file meta/focal | `admin/files/[uuid]/meta.get.ts`, `admin/files/[uuid]/focal.patch.ts` — **not recorded in V-0.5** | Preserve |
| BFF | FAQ | `products/[id]/faq/` — 4 endpoints | Preserve |
| BFF | SEO | `products/[id]/seo.get.ts`, `seo.patch.ts` — 2 endpoints | Preserve |
| BFF | Sources | `products/[id]/sources/` — 3 endpoints | Preserve — ADM-08 foundation |
| BFF | Preview data | `products/[id]/preview-data.get.ts` | Preserve |
| Page | Global Media Library | `pages/admin/media/index.vue` | **Separate domain — NOT ADM-04, not `LEGACY` for ADM-04**; English compliant |
| Page | Settings | `pages/admin/settings.vue` | Separate domain; no ADM master; English non-compliant |
| Types | All workspace types | `types/product-cms.ts` | Preserve and extend |

### 12.4 Corrections applied to the V-0.5 ledger

| # | V-0.5 claim | V-0.5.1 verified fact |
|---|---|---|
| C-1 | ADM-07 route “is NOT listed in `ProductSubNav.vue` (5 tabs only)” | **Wrong.** `ProductSubNav.vue` has **6 tabs**; line 12 links SEO. The earlier audit counted only Chinese labels. |
| C-2 | HEAD = `5ea32f9…`, `RUNTIME_PROVEN` | HEAD = `9a9d306…`. Provenance is **`RUNTIME_NOT_PROVEN`**. |
| C-3 | localhost:3000 = PID 33632, `RUNTIME_PROVEN` | PID 33632 no longer exists; current owner is **PID 27024**. |
| C-4 | Specs BFF = 6 endpoints | **7 endpoints.** |
| C-5 | Sections BFF = 7 endpoints | **8 endpoints.** |
| C-6 | Master registry = 10 files in 2 directories | **12 files in 2 packages**, including the previously unrecorded ADM-02 375px and 1440px P1 masters. |
| C-7 | Visible-Chinese ledger covered 9 files | Four further files carry Chinese: `login.vue` (8 UI), `[id]/index.vue` (9 UI), `[id]/faq.vue` (22 UI), `media/index.vue` (1 comment, compliant). |
| C-8 | P2 inbox images registered as usable masters without qualification | P2 `README.md` explicitly forbids treating them as approved masters or implementing from them (CF-2). |
| C-9 | No mobile master recorded for ADM-02 | A 375px ADM-02 master exists and specifies a **stacked card list**, giving the 375px `FAILED` verdict a concrete contract to cite (§8a). |

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

