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

### 4.3 Fact conflicts CF-1 – CF-5 — **ADJUDICATED by FD-002 (2026-09-06)**

V-0.5.1 recorded five conflicts and referred them to Codex without resolving any. The user issued **FD-002 — Master Authority & Responsive Adaptation**, recorded in `ADMIN-CMS-GOVERNING-CHARTER-V1.md` §L (Framework Decisions), immediately after FD-001. All five are now closed. The original conflict statements are preserved verbatim so the reasoning remains auditable.

| # | Conflict as recorded in V-0.5.1 | **FD-002 adjudication** | Status |
|---|---|---|---|
| **CF-1** | **ADM numbering namespaces disagree.** `README_VISUAL_INDEX.md` assigns ADM-04–08 = “单型号 Product Dossier” and ADM-09–11 = “多型号导入与审核队列”. This Register and the Blueprint assign ADM-04 = Media & Resources, ADM-05 = Page Content, ADM-06 = Relations, ADM-07 = SEO, ADM-08 = Sources. | **Resolved by two new namespaces.** Engineering work is addressed by module ID — `PC-01`, `PC-02`, `PW-00`…`PW-06`, `AI-01`, `IMP-01` (Blueprint §6.1). Visual evidence is addressed by Source Asset ID — `VM1-*` and `P2-*` (§4.4 below). **A bare `ADM-xx` may never drive code.** Every work order must name the engineering module ID and the Source Asset ID. Gate prefixes are likewise made explicit: `CH-DG-xx` (Charter) and `BP-DG-xx` (Blueprint); Charter `DG-10` = `CH-DG-10`, no gate renumbered. | **CLOSED** |
| **CF-2** | **P2 package forbids the use V-0.5 recorded for it.** V-0.5 registered the eight P2 images as “DRAFT retained / FD-001 user-confirmed implementation overlay”. The package README says they “must not be treated as approved visual masters” and “No page may be implemented directly from these pictures.” | **Both statements stand; their scopes are separated.** P2 images remain a **user-confirmed visual direction reference** under FD-001. The P2 README rule remains fully in force: they are **not independent code specifications**, and therefore may not by themselves determine route, data/API, permissions, interaction or mobile structure. P2 may only supplement visual hierarchy, spacing, module relationships and information expression for a module whose Matrix row already lists it. The original README is not modified. | **CLOSED** |
| **CF-3** | **No 375px master exists for ADM-02a through ADM-08.** The index rule requires both a 1440px and a 375px master before formal code construction. Only ADM-02 has a 375px file. | **Split decision.** `PC-01` **and** `PC-02` adopt the card-list principle from `VM1-ADM02-M375`: at 375px, no horizontally scrolling desktop table. `PC-02` inherits this because it shares the Product Catalogue shell with `PC-01`. For `PW-01`…`PW-06` there is **no approved mobile adaptation contract**; those modules are **BLOCKED at 375px** until each receives its own mobile adaptation contract in a Codex work order. | **CLOSED** |
| **CF-4** | **Both ADM-02 masters render a Chinese admin UI**, while §7 of this Register and the P2 README both declare English the confirmed admin baseline. | **English-first outranks the imagery.** All visible Admin UI is English. Chinese appearing inside any master image is evidence of **information hierarchy, layout and visual relationship only** and must never be copied out as visible UI copy. This applies to `VM1-ADM02-D1440`, `VM1-ADM02-M375` and every P2 image. | **CLOSED** |
| **CF-5** | **The two ADM-02 masters describe different right-hand panels.** P1 desktop-1440 shows a right **“AI 批处理入口”** rail; §5.2 of this Register specifies a persistent right **Product Control**. | **J-2 uses Product Control.** The right region of `PC-01` is the persistent **Product Control** panel. The AI batch-import rail visible in `VM1-ADM02-D1440` belongs to the future **`IMP-01` Import Review Queue** and must **not** be implemented now, must **not** be shown as an available/disabled-but-coming affordance, and must **not** display fabricated AI state or data. | **CLOSED** |

**V-0.5.1 action taken:** exact paths confirmed for all 12 files; no master file was modified, renamed, copied or staged.
**V-0.5.2 action taken:** CF-1 – CF-5 adjudicated per FD-002; Master Authority Matrix established in §4.4. No master file touched.

---

### 4.4 Master Authority Matrix and Namespace Rules (fixed by FD-002)

This matrix is the **single authoritative statement** of which visual asset may influence which engineering module, and along which dimensions. No other document may grant a visual asset more authority than its row here.

**Implementation authority levels:**

| Level | Meaning |
|---|---|
| `PRIMARY` | This asset is the governing implementation reference for the named module and dimensions. |
| `SUPPLEMENTARY` | May only refine visual hierarchy, spacing, module relationships and information expression **within a contract another authority has already set**. Never decides route, data/API, permissions, interaction or mobile structure. |
| `FUTURE-REFERENCE` | Records intended future logic. Confers **no** authorization to build anything now. |
| `NOT-A-DESIGN-SOURCE` | Usable only as acceptance evidence or existence proof. Never a design input. |

#### Registered assets (12)

| Source Asset ID | Actual file path | Original state | May be used for | May **not** be used for | Engineering module | Dimensions it may influence | Authority | Current evidence |
|---|---|---|---|---|---|---|---|---|
| `VM1-ADM02-D1440` | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/desktop-1440/LITUBO_CMS_ADM-02_Product-Center__default__desktop-1440__v01.png` | `DRAFT` (VM1 index row ADM-02); FD-001 + FD-002 user-confirmed | Desktop 1440px structure of `PC-01`: global nav, page header, status-tile strip, list table columns and density, pagination, right-region placement | Visible Chinese copy (CF-4); the right-region AI batch rail (CF-5 → `IMP-01`); data/API contract; permissions; any `PW-*` module | `PC-01` | Desktop layout · information hierarchy · component placement | **`PRIMARY`** | Image read 2026-09-06 (V-0.5.1) |
| `VM1-ADM02-M375` | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/admin/mobile-375/LITUBO_CMS_ADM-02_Product-Center__default__mobile-375__v01.png` | `DRAFT` (VM1 index row ADM-02); FD-001 + FD-002 user-confirmed | 375px responsive structure of `PC-01` **and** `PC-02`: stacked card list, sticky header, status-tile strip, search/filter/sort controls, fixed bottom action bar | Visible Chinese copy (CF-4); the AI batch panel (CF-5 → `IMP-01`); completeness/readiness **values** (gated by `CH-DG-11` / `BP-DG-02`); any `PW-*` module's mobile contract (CF-3) | `PC-01`, `PC-02` | 375px responsive structure · card composition · control placement | **`PRIMARY`** | Image read 2026-09-06 (V-0.5.1) |
| `P2-ADM02-ALL` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02__product-center__all-products__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy, spacing and module relationships for `PC-01` | Route · data/API · permissions · interaction · mobile structure (CF-2); any independent decision | `PC-01` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM02A-CATEGORY` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-02a__product-center__category-list__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PC-02` category context | Route · data/API · permissions · interaction · mobile structure (CF-2) | `PC-02` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM03-SPECS` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-03__product-workspace__specifications__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-01` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; starting `PW-01` before `PW-00` | `PW-01` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM04-MEDIA` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-04__product-workspace__media-resources__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-02` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; being cited as evidence for `/admin/media` (a different domain) | `PW-02` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM05-CONTENT` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-05__product-workspace__page-content__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-03` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; defining module-type enum values | `PW-03` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM06-RELATIONS` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-06__product-workspace__relations__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-04` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; **defining the relation schema** (`BP-DG-08`, AUDIT REQUIRED BEFORE SCHEMA) | `PW-04` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM07-SEO` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-07__product-workspace__seo-locales__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-05` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; **deciding locale/publication rules** (`CH-DG-14` / `BP-DG-09`) | `PW-05` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `P2-ADM08-SOURCES` | `docs/design-reference/inbox/admin-cms-ai-v1/reference-images/ADM-08__product-workspace__sources-history__desktop-reference__v01.png` | Draft input only — README forbids treating as approved master | Supplementary desktop visual hierarchy for `PW-06` **after** `PW-00` shell is accepted | Route · data/API · permissions · interaction · mobile structure; **defining confidence/retention model** (`BP-DG-06`) | `PW-06` | Visual hierarchy · spacing · information expression | `SUPPLEMENTARY` | Image read 2026-09-06 (V-0.5) |
| `VM1-LOGIC01` | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/01_single_product_dossier_workbench.png` | `DRAFT`（流程参考）per VM1 index | Recording the intended future AI dossier flow for `AI-01` | **Any** implementation; any AI feature, adapter, snapshot or proposal record; any UI affordance suggesting AI exists | `AI-01` | Future logic only | `FUTURE-REFERENCE` | Image read 2026-09-06 (V-0.5) |
| `VM1-LOGIC02` | `docs/design-reference/CMS-AI-VISUAL-MASTER-V1/logic-references/02_multi_model_import_ai_review_queue.png` | `DRAFT`（流程参考）per VM1 index | Recording the intended future import/review-queue flow for `IMP-01` | **Any** implementation; any import job, mapping or queue; the AI batch rail seen in `VM1-ADM02-D1440` | `IMP-01` | Future logic only | `FUTURE-REFERENCE` | Image read 2026-09-06 (V-0.5) |

#### Non-asset evidence sources — authority limits

| Source | May decide | May **not** decide | Authority |
|---|---|---|---|
| Screenshots (user-supplied or captured) | Whether a rendered route meets or fails an already-stated contract — acceptance evidence only | Design direction, layout, structure or any contract | `NOT-A-DESIGN-SOURCE` |
| Repository working tree · Directus state · the controlled running service | Whether a route, endpoint, field, component or value **exists** — factual existence only | Design direction; what a module *should* look like or contain | `NOT-A-DESIGN-SOURCE` |
| Automated tests, typecheck, lint, build | Whether code satisfies its own assertions | Visual acceptance; contract conformance; readiness | `NOT-A-DESIGN-SOURCE` |

#### Namespace rules — mandatory for every future work order

1. Every Codex work order that authorises code **must name both**: the engineering module ID (`PC-01`, `PC-02`, `PW-00`…`PW-06`, `AI-01`, `IMP-01`) **and** the Source Asset ID(s) it draws on.
2. A work order that cites only `ADM-xx` is **not actionable**. Claude must stop and report rather than infer which namespace is meant.
3. A `SUPPLEMENTARY` asset may never be the sole basis for a change. It must accompany a `PRIMARY` asset or an approved written contract.
4. A `FUTURE-REFERENCE` asset never authorises implementation, no matter which document cites it.
5. Screenshots and repository facts never originate design.
6. Where an asset's row and any other document disagree about that asset's authority, **this matrix governs**.

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

### 12.1 English-first ledger — line-by-line (V-0.5.2 rebuild)

**This ledger replaces the V-0.5.1 summary ledger**, which reported only per-file counts and an inconsistent estimate ("~249"). Every row below is one matching source line; the totals in \u00a712.1e are computed from these rows.

**Scan method.** `Select-String` with a CJK Unified Ideographs character class over `layouts/admin.vue`, all of `pages/admin/`, and all of `components/admin/`. 23 files scanned; 13 contain matches; **278 matching source lines**. No file was modified and no copy was translated \u2014 this task registers only.

**Classification.** `UI` = rendered visible text · `PLACEHOLDER` = input placeholder attribute · `OPTION` = `<option>` / label-map value rendered in a select · `ARIA` = assistive-technology only (`aria-label`, `alt`) · `DATA` = genuine Chinese business data · `COMMENT` = source/CSS comment, never rendered.

**"Hardcoded user-visible Chinese" = UI + PLACEHOLDER + OPTION.** `ARIA` is assistive-only and tracked separately; `COMMENT` is out of scope and may remain under §7.

#### 12.1a Compliant files — zero matches (10 files)

`pages/admin/index.vue` · `pages/admin/products/index.vue` · `pages/admin/products/categories.vue` · `pages/admin/products/categories/[id].vue` · `pages/admin/products/[id]/preview.vue` · `components/admin/StatusBadge.vue` · `components/admin/product/ProductBasicForm.vue` · `components/admin/product/ProductCatalogueNav.vue` · `components/admin/product/ProductCentreSidebar.vue` · `components/admin/product/ProductControlPanel.vue`

#### 12.1b Global shell and standalone routes

**`layouts/admin.vue`** — route: all `/admin/*` · module: shared shell (`PC-01` / `PW-00`) — 13 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 114 | `title="Phase 9A-2 后开放"` — hover tooltip on the disabled Content Center item | **UI** | global shell English pass |
| 78 | `aria-label="打开菜单"` | ARIA | accessibility English pass |
| 96 | `aria-label="关闭菜单"` | ARIA | accessibility English pass |
| 76, 88, 91 | Template comments | COMMENT (3) | may remain |
| 160, 199, 261, 311, 349, 356, 364 | CSS section comments | COMMENT (7) | may remain |

*Subtotal: UI 1 · ARIA 2 · COMMENT 10 = 13*

**`pages/admin/login.vue`** — route: `/admin/login` · module: none (auth; no Source Asset) — 8 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 22 | `请输入邮箱和密码` | **UI** | login English pass |
| 36 | `登录尝试过多，请稍后重试` | **UI** | login English pass |
| 38 | `该账号无管理员权限` | **UI** | login English pass |
| 40 | `邮箱或密码错误` | **UI** | login English pass |
| 55 | `产品管理后台` | **UI** | login English pass |
| 61 | `管理员邮箱` | **UI** | login English pass |
| 73 | `密码` | **UI** | login English pass |
| 86 | `登录中…` / `登录` | **UI** | login English pass |

*Subtotal: UI 8 = 8. **Not registered in V-0.5 or V-0.5.1.***

**`pages/admin/settings.vue`** — route: `/admin/settings` · module: none (Settings; no Source Asset) — 54 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 64, 76, 80, 103, 107, 122, 141, 147, 157, 176 | Toast / error strings: `加载设置失败，请刷新页面`; `初始化成功，CMS 集合已创建并预置数据`; `初始化失败，请稍后重试`; `设置已保存，前台 Footer 下次刷新即生效`; `保存失败，请重试`; `更新失败，请重试`; `保存失败`; `确认删除这条社媒链接？`; `删除失败，请重试`; `新增失败，请重试` | **UI** (10) | Settings English pass |
| 192, 193, 199, 204, 205, 207 | `← 管理后台`; `网站设置`; `加载中…`; `首次初始化`; `尚未检测到 CMS 设置集合…`; `初始化中…` / `初始化 Settings CMS` | **UI** (6) | Settings English pass |
| 214, 218, 222, 229, 231, 234, 240, 245, 250, 252, 257 | `公司与公开联系资料`; `品牌名称`; `法定公司名称`; `公开邮箱`; `Footer 展示邮箱…`; `联系电话`; `WhatsApp 链接`; `公司地址`; `版权声明`; `使用 {year} 占位符…`; `保存中…` / `保存设置` | **UI** (11) | Settings English pass |
| 265, 271, 277, 313, 316, 323, 325 | `社媒链接`; `收起` / `+ 添加链接`; `暂无社媒链接…`; `点击禁用` / `点击启用`; `显示` / `隐藏`; `…` / `保存`; `删除` | **UI** (7) | Settings English pass |
| 331, 335, 342, 348, 350 | `添加新社媒链接`; `平台`; `链接地址`; `添加中…` / `确认添加`; `取消` | **UI** (5) | Settings English pass |
| 357, 360, 361, 364, 365, 368, 369, 373 | `安全与 AI 连接`; `AI 集成状态`; `未连接（Phase M5 规划中）`; `API 凭证`; `在服务器 .env 文件中配置，不在此界面显示`; `管理员权限`; `Administrator 角色（Directus 内置）`; `此区域为只读策略面板…` | **UI** (8) | Settings English pass |
| 305 | `placeholder="顺序"` | PLACEHOLDER | Settings English pass |
| 337 | `<option value="" disabled>选择平台</option>` | OPTION | Settings English pass |
| 202, 212, 262, 329, 355 | Template section comments | COMMENT (5) | may remain |

*Subtotal: UI 47 · PLACEHOLDER 1 · OPTION 1 · COMMENT 5 = 54*

**`pages/admin/media/index.vue`** — route: `/admin/media` · module: Global Media Library (separate domain, never `PW-02`) — 1 line

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 126 | `// Filter folder tree: … sidebar "正式目录"` | COMMENT | may remain |

*Subtotal: COMMENT 1 = 1. **Route is English-compliant** — zero visible Chinese.*

#### 12.1c Product Center routes

**`pages/admin/products/new.vue`** — route: `/admin/products/new` · module: `PC-01` — 6 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 21 | `产品名称（EN）为必填项` | **UI** | `PC-01` English pass |
| 22 | `Slug 为必填项` | **UI** | `PC-01` English pass |
| 23 | `产品分类为必填项` | **UI** | `PC-01` English pass |
| 34 | `保存失败，请重试` | **UI** | `PC-01` English pass |
| 44 | `← 产品列表` | **UI** | `PC-01` English pass |
| 45 | `新建产品` | **UI** | `PC-01` English pass |

*Subtotal: UI 6 = 6*

#### 12.1d Product Workspace routes and shared components

**`pages/admin/products/[id]/index.vue`** — route: `/admin/products/:id` · module: `PW-00` — 9 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 31 | `产品名称（EN）为必填项` | **UI** | `PW-00` shell rebuild |
| 52 | `已保存` | **UI** | `PW-00` shell rebuild |
| 56 | `保存失败，请重试` | **UI** | `PW-00` shell rebuild |
| 73 | `状态更新失败` | **UI** | `PW-00` shell rebuild |
| 83 | `← 产品列表` | **UI** | `PW-00` shell rebuild |
| 84 | `产品详情` | **UI** | `PW-00` shell rebuild |
| 95 | `基础信息` | **UI** | `PW-00` shell rebuild |
| 118 | `创建时间` | **UI** | `PW-00` shell rebuild |
| 120 | `最后更新` | **UI** | `PW-00` shell rebuild |

*Subtotal: UI 9 = 9. **Not registered in V-0.5 or V-0.5.1.***

**`pages/admin/products/[id]/specs.vue`** — route: `/admin/products/:id/specs` · module: `PW-01` — 28 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 33, 43, 47, 52, 59, 74, 78, 83, 90 | `参数组标题（EN）为必填项`; `参数组已添加`; `添加失败，请重试`; `确认删除此参数组（含其下所有参数条目）？`; `删除失败`; `参数已添加`; `添加失败`; `确认删除此参数条目？`; `删除失败` | **UI** (9) | `PW-01` English pass |
| 98, 99, 109, 111, 117, 122 | `← 产品列表`; `产品编辑`; `技术参数`; `取消` / `＋ 添加参数组`; `参数组标题（EN）`; `添加中…` / `确认添加` | **UI** (6) | `PW-01` English pass |
| 128, 129, 130, 137, 138, 143, 147, 172, 180 | `此产品暂无技术参数`; `点击「添加参数组」…`; `建议在桌面端操作…`; `（无标题）`; `N 条`; `暂无参数条目`; headers `标签（EN）` / `值（EN）` / `备注`; `添加`; `💡 多语言参数（ES / PT）…` | **UI** (9) | `PW-01` English pass |
| 118, 166, 170 | `placeholder="如：General Specifications"`; `placeholder="标签（EN）"`; `placeholder="值（EN）"` | PLACEHOLDER (3) | `PW-01` English pass |
| 162 | `<!-- 快速添加条目 -->` | COMMENT | may remain |

*Subtotal: UI 24 · PLACEHOLDER 3 · COMMENT 1 = 28*

**`pages/admin/products/[id]/content.vue`** — route: `/admin/products/:id/content` · module: `PW-03` — 38 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45 | `SECTION_LABELS` values rendered as `<option>` text: `文本`(33), `功能列表`(34), `概览`(35), `图文`(36), `优势亮点`(37), `应用场景`(38), `检测对象`(39), `工作原理`(40), `选型配置`(41), `产线集成`(42), `报价提醒`(43), `视频`(44), `案例`(45) | OPTION (13) | `PW-03` English pass — **`SectionType` enum keys unchanged; labels only** (`BP-DG-07`) |
| 58, 63, 68, 72, 91, 95 | `操作失败，请重试`; `确认删除该模块？此操作不可撤销。`; `模块已删除`; `删除失败，请重试`; `模块已添加`; `添加失败，请重试` | **UI** (6) | `PW-03` English pass |
| 105, 106, 116, 118, 126, 134, 141, 144 | `← 产品列表`; `产品编辑`; `页面模块`; `取消` / `＋ 添加模块`; `模块类型`; `标题（EN）`; `立即启用`; `添加中…` / `确认添加` | **UI** (8) | `PW-03` English pass |
| 151, 152, 153, 166, 170, 175, 184 | `此产品暂无页面模块`; `点击「添加模块」…`; `建议先创建 overview（概览）模块。`; `（无标题）`; `title` `点击隐藏` / `点击启用`; `title="删除"`; `💡 模块内容…` | **UI** (7) | `PW-03` English pass |
| 135 | `placeholder="可留空"` | PLACEHOLDER | `PW-03` English pass |
| 122, 149, 156 | Template section comments | COMMENT (3) | may remain |

*Subtotal: UI 21 · PLACEHOLDER 1 · OPTION 13 · COMMENT 3 = 38*

**`pages/admin/products/[id]/media.vue`** — route: `/admin/products/:id/media` · module: `PW-02` — 62 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66 | `FILE_ROLE_LABELS` values rendered as role `<option>` text: `Hero 主图`(56), `概览图`(57), `应用场景`(58), `细节图`(59), `图库`(60), `视频封面`(61), `产品手册`(62), `规格书`(63), `工程图纸`(64), `操作手册`(65), `认证证书`(66) | OPTION (11) | `PW-02` English pass — **`FileRole` enum keys unchanged; labels only** (`CH-DG-12` / `BP-DG-05`) |
| 333, 424, 425 | `— 未设置 —`; `全部格式`; `图片` | OPTION (3) | `PW-02` English pass |
| 94, 95, 96 | Focal-point grid labels: `左上` / `上` / `右上`(94); `左` / `中` / `右`(95); `左下` / `下` / `右下`(96) | **UI** (3) | `PW-02` English pass |
| 129, 135, 148, 206, 215, 221, 234, 239, 243 | `已保存`; `保存失败，请重试`; `操作失败`; `文件「…」已经关联到此产品`; `已关联「…」`; `关联失败，请重试`; `确认移除此媒体记录？只删除关联，不删除原始文件。`; `媒体记录已移除`; `删除失败` | **UI** (9) | `PW-02` English pass |
| 251, 252, 262, 263, 264, 268, 269 | `← 产品列表`; `产品编辑`; `图片与资料`; `已绑定 N 个文件`; `从媒体库选择`; `此产品暂无媒体文件`; `上传文件后通过"从媒体库选择"…` | **UI** (7) | `PW-02` English pass |
| 308, 319, 321, 322, 323, 328, 331, 339, 344, 349, 355, 379, 386, 387 | `未设置角色`; `已启用 — 点击禁用` / `已禁用 — 点击启用`; `启用` / `禁用`; `编辑`; `移除`; `编辑媒体记录`; `文件角色`; `Alt 文字 (EN)`; `说明文字 (EN)`; `排序`; `图片焦点`; `焦点：`; `保存`; `取消` | **UI** (14) | `PW-02` English pass |
| 399, 410, 428, 432, 433, 442, 454, 462 | `从媒体库选择`; `全部`; `N 个文件`; `加载中…`; `暂无文件，请先在 Media Library 上传`; `此文件已关联到产品`; `已关联`; `加载更多` | **UI** (8) | `PW-02` English pass |
| 340, 345, 422 | `placeholder="图片替代文字"`; `placeholder="图片说明"`; `placeholder="搜索文件名 / 标题…"` | PLACEHOLDER (3) | `PW-02` English pass |
| 374, 397, 400 | `alt="焦点预览"`; `aria-label="从媒体库选择文件"`; `aria-label="关闭"` | ARIA (3) | accessibility English pass |
| 720 | CSS comment | COMMENT | may remain |

*Subtotal: UI 41 · PLACEHOLDER 3 · OPTION 14 · ARIA 3 · COMMENT 1 = 62*

**`pages/admin/products/[id]/faq.vue`** — route: `/admin/products/:id/faq` · module: **none — no Source Asset** (§12.1g) — 22 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 26, 27, 42, 46, 51, 58, 71 | `问题（EN）为必填项`; `答案（EN）为必填项`; `FAQ 已添加`; `添加失败`; `确认删除此 FAQ 条目？`; `删除失败`; `操作失败` | **UI** (7) | blocked — no Source Asset; 等待 Codex 决定 |
| 79, 80, 90, 92, 98, 102, 106, 111 | `← 产品列表`; `产品编辑`; `产品 FAQ`; `取消` / `＋ 添加 FAQ`; `问题（EN）`; `答案（EN）`; `来源备注（内部用）`; `添加中…` / `确认添加` | **UI** (8) | blocked — no Source Asset |
| 117, 118, 129, 131, 137, 138 | `此产品暂无 FAQ`; `点击「添加 FAQ」…`; `（无问题文字）`; `隐藏` / `启用`; `（无答案文字）`; `来源: ` | **UI** (6) | blocked — no Source Asset |
| 107 | `placeholder="如：来自产品手册第 3 页"` | PLACEHOLDER | blocked — no Source Asset |

*Subtotal: UI 21 · PLACEHOLDER 1 = 22. **Not registered in V-0.5 or V-0.5.1.***

**`pages/admin/products/[id]/seo.vue`** — route: `/admin/products/:id/seo` · module: `PW-05` — 18 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 41, 45, 53, 54, 65, 69 | `SEO 信息已保存`; `保存失败，请重试`; `← 产品列表`; `产品编辑`; `SEO 设置`; `页面标题（EN）` | **UI** (6) | `PW-05` English pass |
| 81, 86, 103, 105, 110 | `建议 50–70 个字符，留空则使用产品名称作为默认标题`; `页面描述（EN）`; `noindex（禁止搜索引擎收录此页面）`; `草稿或未完善页面建议勾选；发布正式页面时取消勾选`; `保存中…` / `保存 SEO` | **UI** (5) | `PW-05` English pass |
| 118, 121, 122, 124 | `搜索预览（示意）`; `产品标题` (fallback); `（暂无描述）` (fallback); `⚠️ 此页面已设为 noindex，搜索引擎不会收录` | **UI** (4) | `PW-05` English pass |
| 79, 96 | `placeholder="产品名称 — LITUBO"`; `placeholder="简洁描述产品核心价值，约 120–160 个字符效果最佳"` | PLACEHOLDER (2) | `PW-05` English pass |
| 175 | CSS comment | COMMENT | may remain |

*Subtotal: UI 15 · PLACEHOLDER 2 · COMMENT 1 = 18*

**`components/admin/product/ProductSubNav.vue`** — route: all `/admin/products/:id/*` · module: `PW-00` — 10 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 7 | `基础信息` — tab 1 of 6 | **UI** | replaced by `PW-00` shell tabs |
| 8 | `页面模块` — tab 2 of 6 | **UI** | replaced by `PW-00` shell tabs |
| 9 | `技术参数` — tab 3 of 6 | **UI** | replaced by `PW-00` shell tabs |
| 10 | `图片与资料` — tab 4 of 6 | **UI** | replaced by `PW-00` shell tabs |
| 11 | `产品 FAQ` — tab 5 of 6 | **UI** | replaced by `PW-00` shell tabs |
| — | *line 12 = `SEO`, tab 6 of 6 — already English, produces no match* | — | — |
| 28 | `aria-label="产品编辑导航"` | ARIA | accessibility English pass |
| 27, 40, 51, 81 | Template / CSS comments | COMMENT (4) | may remain |

*Subtotal: UI 5 · ARIA 1 · COMMENT 4 = 10*

**`components/admin/product/PublishPanel.vue`** — route: all `/admin/products/:id/*` · module: `PW-00` right Product Control — 9 lines

| Line | Original text | Class | Future handling |
|---|---|---|---|
| 15 | `提交审核` — draft → review | **UI** | `PW-00` Product Control rebuild |
| 17 | `退回草稿` — review → draft | **UI** | `PW-00` Product Control rebuild |
| 18 | `发布` — review → published | **UI** | `PW-00` Product Control rebuild |
| 20 | `撤回草稿` — published → draft | **UI** | `PW-00` Product Control rebuild |
| 27 | `已归档状态，如需恢复请联系管理员` | **UI** | `PW-00` Product Control rebuild |
| 33 | `确认发布此产品？发布后将对外公开可见。` | **UI** | `PW-00` Product Control rebuild |
| 36 | `确认撤回至草稿？产品将立即从前台下线。` | **UI** | `PW-00` Product Control rebuild |
| 44 | `发布状态` — panel title | **UI** | `PW-00` Product Control rebuild |
| 49 | `首次发布：` + `toLocaleDateString('zh-CN')` | **UI** | `PW-00` Product Control rebuild — locale also changes |

*Subtotal: UI 9 = 9*

#### 12.1e Totals — computed from the rows above

| Class | Count | In scope for English-first? |
|---|---:|---|
| `UI` | **207** | Yes |
| `PLACEHOLDER` | **11** | Yes |
| `OPTION` | **28** | Yes |
| `ARIA` | 6 | Separate accessibility pass |
| `DATA` — genuine Chinese business data | **0** | Out of scope — none found |
| `COMMENT` | 26 | Out of scope — may remain |
| **Total matching source lines** | **278** | — |

> **Hardcoded user-visible Chinese UI = UI + PLACEHOLDER + OPTION = 207 + 11 + 28 = 246, across 11 files.**

Per-file cross-check — column sums equal the class totals; row sums equal 278:

| File | UI | PLACEHOLDER | OPTION | ARIA | COMMENT | Line total |
|---|---:|---:|---:|---:|---:|---:|
| `layouts/admin.vue` | 1 | 0 | 0 | 2 | 10 | 13 |
| `pages/admin/login.vue` | 8 | 0 | 0 | 0 | 0 | 8 |
| `pages/admin/settings.vue` | 47 | 1 | 1 | 0 | 5 | 54 |
| `pages/admin/media/index.vue` | 0 | 0 | 0 | 0 | 1 | 1 |
| `pages/admin/products/new.vue` | 6 | 0 | 0 | 0 | 0 | 6 |
| `pages/admin/products/[id]/index.vue` | 9 | 0 | 0 | 0 | 0 | 9 |
| `pages/admin/products/[id]/specs.vue` | 24 | 3 | 0 | 0 | 1 | 28 |
| `pages/admin/products/[id]/content.vue` | 21 | 1 | 13 | 0 | 3 | 38 |
| `pages/admin/products/[id]/media.vue` | 41 | 3 | 14 | 3 | 1 | 62 |
| `pages/admin/products/[id]/faq.vue` | 21 | 1 | 0 | 0 | 0 | 22 |
| `pages/admin/products/[id]/seo.vue` | 15 | 2 | 0 | 0 | 1 | 18 |
| `components/admin/product/ProductSubNav.vue` | 5 | 0 | 0 | 1 | 4 | 10 |
| `components/admin/product/PublishPanel.vue` | 9 | 0 | 0 | 0 | 0 | 9 |
| **TOTAL** | **207** | **11** | **28** | **6** | **26** | **278** |

#### 12.1f Correction to the V-0.5.1 figure

V-0.5.1 reported "approximately **249** visible-UI occurrences across **9** files" without a line-level table. That estimate is **superseded**. The verified figure is **246 hardcoded user-visible Chinese lines across 11 files** (UI 207 + PLACEHOLDER 11 + OPTION 28). The file count rises from 9 to 11 because `login.vue` and `[id]/index.vue` were previously unregistered.

No `DATA`-class occurrence exists: every Chinese string found is a hardcoded literal in source, not genuine business data supplied in Chinese. The §7 data carve-out therefore applies to none of the current occurrences.

#### 12.1g Unmastered route

`/admin/products/:id/faq` → `pages/admin/products/[id]/faq.vue` exists, is linked from `ProductSubNav.vue` line 11, and has a 4-endpoint BFF at `server/api/admin/products/[id]/faq/`. **No Source Asset in the §4.4 Matrix covers a standalone product FAQ tab.** In `P2-ADM05-CONTENT`, FAQ appears as a *module inside Page Content*, not as its own workspace tab. This route therefore has no visual contract and no engineering module ID. Status: `LEGACY`, Source Asset `NONE`. Next step: 等待 Codex 决定.

#### 12.1h Superseded V-0.5.1 summary table (retained for audit trail)

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

> **The table above is the superseded V-0.5.1 summary.** Its "approximately 249 across 9 files" figure was an estimate with no line-level basis and must not be cited. The authoritative figure is **246 across 11 files**, computed in §12.1e. The table is retained only so the correction in §12.1f remains auditable.

### 12.1i Engineering module fact tables (V-0.5.2, complete — no summaries)

One complete table per engineering module. There are **11 engineering modules** in total: `PC-01`, `PC-02`, `PW-00`, `PW-01`…`PW-06`, `AI-01`, `IMP-01`. `PW-00` is included in this count (not a twelfth, separate item) because FD-002 makes it the gating prerequisite for `PW-01`…`PW-06`; a table listing only ten and omitting `PW-00` understates the module set and must not be repeated.

#### J-2 Recovery DoR — precise scope (PC-01 / PC-02 only)

`J-2 Recovery DoR` means only that a bounded recovery work order may begin for `PC-01` and `PC-02`. It does **not** mean J-2 is complete, does **not** mean visual acceptance has passed, and does **not** authorise pushing `origin/master`. The two rows below are the complete recovery-DoR evidence for this stage; the full 11-module fact tables that follow remain the underlying record.

| Module | Primary/supplementary assets | Fixable scope this recovery | Current acceptance | Conclusion |
|---|---|---|---|---|
| `PC-01` Product Center | `VM1-ADM02-D1440` / `VM1-ADM02-M375` (PRIMARY) | 1440px structure; 375px card-list layout; English-first; related API and tests | 375px **FAILED**; integrated **SUSPENDED** | Recovery work may start; this is **not** acceptance passing. |
| `PC-02` Category Context | `P2-ADM02A-CATEGORY` (SUPPLEMENTARY only — accompanies the `PC-01` PRIMARY assets via the shared shell) | Layout; category context; English copy; navigation; product list | `SUSPENDED` | Structural recovery is allowed; the Category Health **indicator** stays blocked until `CH-DG-10` is resolved — render `Not assessed — rule not configured`, never a fabricated value. |

Existing code that still shows the bare historical marker `(DG-10)` (e.g. `pages/admin/products/categories/index.vue`) is not changed by this task and remains correct per Blueprint §6.2 (Charter `DG-10` = `CH-DG-10`, no gate renumbered). From this point forward, new documents and new work orders use `CH-DG-10` explicitly.

#### J-2 Recovery closure evidence (2026-09-07)

Three defects blocked PC-01/PC-02 acceptance after the recovery work order landed; all three are now closed by read-only-verified fixes, each scoped to a single root cause:

1. **Component alias mismatch** — `nuxt.config.ts` sets `components: [{ path: '~/components', pathPrefix: false }]`, so every component registers under its bare filename (confirmed against `.nuxt/components.d.ts` and the Nuxt 3.21.11 `scanComponents` source). Sixteen template tags across `pages/admin/products/index.vue`, `pages/admin/products/categories/index.vue`, `pages/admin/products/categories/[id].vue`, `ProductCardList.vue` and `ProductControlPanel.vue` had been written with an `Admin*`/`AdminProduct*` prefix that has never resolved. Renamed to the real registered names (`ProductCatalogueNav`, `ProductCentreSidebar`, `ProductStatusTiles`, `ProductCardList`, `ProductControlPanel`, `CategoryContextPanel`, `StatusBadge`) — no `nuxt.config.ts` change, no behavioural change beyond making the existing components resolve.
2. **Category route topology** — `pages/admin/products/categories.vue` coexisted with a same-named `categories/` directory, which Nuxt's file-based router registers as **parent/child nesting** (verified against the generated `virtual:nuxt:.nuxt/routes.mjs` route table, both before and after the fix). The parent carried no `<NuxtPage />` outlet, so `/admin/products/categories/:id` matched a route but never mounted `categories/[id].vue`. Fixed by moving `categories.vue` to `categories/index.vue` (plain filesystem move, no `<NuxtPage/>` added, no layout restructure) — the route table now lists `admin-products-categories` and `admin-products-categories-id` as independent siblings.
3. **Stale test assertions** — `tests/productCentreView.test.ts` had 3 assertions still matching the pre-fix `Admin*` tag strings and the pre-move `categories.vue` path; updated to the corrected names/path.

**Verification performed:** `npx vitest run` 280/280 passed · `vue-tsc --noEmit` 0 errors · `eslint .` 0 errors · `nuxt build` succeeded. Logged-in browser verification (existing session, no restart mid-check beyond the one Nuxt picked up automatically for the file move) confirmed at both 1440px and 375px, with zero horizontal overflow at either width:
   - `/admin/products` — Product Catalogue rail, status tiles, table/card list and Product Control all render with real data; `.badge` elements present with real status classes.
   - `/admin/products/categories` — rail, category rows/cards and `CategoryContextPanel` render; Category Health renders exactly `Not assessed — rule not configured`.
   - `/admin/products/categories/1` and `/admin/products/categories/2` — confirmed via the generated route table that these are independent routes; page renders `categories/[id].vue`'s own subtitle, active tab, category title and (for category 2, which has a linked product) a product row with a real status badge.

**Not claimed:** this closes the *technical* rendering/structure defects recorded below. It does not by itself constitute the Codex/user visual sign-off against `VM1-ADM02-D1440`/`VM1-ADM02-M375` pixel-level intent, and it does not authorise `origin/master`.

#### `PC-01` — Product Catalogue / All Products

| Field | Value |
|---|---|
| Source Asset ID | `VM1-ADM02-D1440` (PRIMARY, desktop) · `VM1-ADM02-M375` (PRIMARY, 375px) · `P2-ADM02-ALL` (SUPPLEMENTARY) |
| Target route | `/admin/products` |
| Current actual route | `/admin/products` → `pages/admin/products/index.vue` — exists |
| Pages and shared components | `pages/admin/products/index.vue`; `components/admin/product/ProductCentreSidebar.vue`; `ProductCatalogueNav.vue`; `ProductControlPanel.vue`; `components/admin/StatusBadge.vue`; `layouts/admin.vue` |
| server API | `server/api/admin/products/index.get.ts`; `products-summary.get.ts`; `categories-summary.get.ts`; `categories.get.ts`; `presets.get.ts`; `asset/[id].get.ts` |
| types / data relations | `types/product-cms.ts` — `AdminProduct`, `ProductsSummary`, `ProductStatus`; `server/utils/adminProductsQuery.ts`; `server/utils/adminAssetProxy.ts`; Directus `products` ↔ `product_categories` |
| Reusable | Status multi-select filter, category filter, search sanitisation, pagination, products/categories aggregates, hardened asset proxy, BFF input validation, `tests/productCenter.test.ts` + `tests/assetProxy.test.ts` |
| Missing | Real Readiness/completeness column (gated by `CH-DG-11`/`BP-DG-02`, correctly rendered as absent, not fabricated); real media-reference count per row; real source/audit summary; Needs Attention query; category tab strip at the top of the central area. 375px card-list layout is **no longer missing** — see the 2026-09-07 closure evidence above. |
| Charter Gate | `CH-DG-11` (Readiness rule) — **unresolved**; `CH-DG-16` (visual pack backup) — unresolved |
| Blueprint Gate | `BP-DG-02` (readiness/completeness formula) — **unresolved**; currently gates the disabled Needs Attention control |
| English-first status | `index.vue` itself: **compliant, 0 occurrences**. Inherited from shared shell: `layouts/admin.vue` line 114 (1 UI) + 2 ARIA. Related `new.vue`: 6 UI. |
| Desktop evidence | `SCREENSHOT_CONFIRMED` (Codex review) + browser DOM verification 2026-09-07 (logged-in session, 1440px, zero overflow, rail/tiles/table/control panel all render with real data) |
| Mobile 375px evidence | Browser DOM verification 2026-09-07 (logged-in session, 375px): card list renders, table hidden, `scrollWidth === innerWidth`. Supersedes the prior `SCREENSHOT_CONFIRMED` **FAILED** finding against `VM1-ADM02-M375`, which was the desktop-table-at-375px defect closed by the component-alias fix. |
| Implementation status | `AUTOMATED_CHECKED` |
| Evidence status | `SCREENSHOT_CONFIRMED` + browser-verified 2026-09-07 (logged-in session, DOM assertions, no console resolve errors); **`RUNTIME_NOT_PROVEN` still applies per §3 rules** — no commit-SHA-stamped render was captured, so this row cannot be marked `VISUALLY_VERIFIED` |
| Acceptance status | Mobile 375px structural defect (desktop table at 375px) **closed 2026-09-07** — card list confirmed rendering with zero horizontal overflow. Status stays `AUTOMATED_CHECKED`, not `VISUALLY_VERIFIED` (runtime provenance unresolved). Integrated visual acceptance **still requires Codex/user pixel-level sign-off against `VM1-ADM02-D1440`/`VM1-ADM02-M375`** — not superseded by this fix. `origin/master` promotion **remains `BLOCKED`**. |
| Definition of Ready | **MET for a J-2 recovery work order.** PRIMARY assets identified for both viewports; target route exists; right-region contract fixed to Product Control (CF-5); English-first fixed (CF-4); mobile principle fixed (CF-3). Readiness/Needs Attention **values** remain gated by `CH-DG-11` / `BP-DG-02` and must render as "Not assessed" until those gates close. |
| Next step | 等待 Codex 决定 |

#### `PC-02` — Category Context

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM02A-CATEGORY` (SUPPLEMENTARY) · `VM1-ADM02-M375` (PRIMARY for 375px only, inherited via the shared Product Catalogue shell per CF-3) |
| Target route | `/admin/products/categories` and `/admin/products/categories/:id` |
| Current actual route | Both exist and are now independent sibling routes (fixed 2026-09-07; previously `categories.vue` + `categories/[id].vue` were parent/child-nested and the detail route never mounted) — `pages/admin/products/categories/index.vue`; `pages/admin/products/categories/[id].vue` |
| Pages and shared components | The two pages above; `ProductCatalogueNav.vue`; `CategoryContextPanel.vue`; `StatusBadge.vue`; `layouts/admin.vue` |
| server API | `server/api/admin/categories-summary.get.ts`; `categories.get.ts`; `products/index.get.ts` (category filter) |
| types / data relations | `types/product-cms.ts` — `CategorySummary`; Directus `product_categories` ↔ `products` |
| Reusable | Per-category status aggregates, category→product filtering, category list read path, tab navigation |
| Missing | Category Health value; average readiness; media-gap and attention counts; category-specific filters/segments. 375px card-list adaptation is **no longer missing** — see the 2026-09-07 closure evidence above. |
| Charter Gate | `CH-DG-10` (Category Health business definition) — **unresolved**; rendered as `Not assessed — rule not configured` |
| Blueprint Gate | `BP-DG-01` (Category Health formula) — unresolved; `BP-DG-03` (taxonomy/hierarchy) — unresolved |
| English-first status | Both page files **compliant, 0 occurrences**. Inherits shared-shell items only. |
| Desktop evidence | `REPOSITORY_CONFIRMED` (Codex reviewed basic category context) + browser DOM verification 2026-09-07 (1440px, zero overflow, category overview and a real category-detail route `.../categories/1` and `.../categories/2` both confirmed rendering their own distinct templates via the generated route table) |
| Mobile 375px evidence | Browser DOM verification 2026-09-07 (375px): category-overview cards and category-detail card list both render, table hidden, `scrollWidth === innerWidth`. Supersedes "**None.**" |
| Implementation status | `AUTOMATED_CHECKED` |
| Evidence status | `REPOSITORY_CONFIRMED` + browser-verified 2026-09-07; `RUNTIME_NOT_PROVEN` still applies per §3 rules |
| Acceptance status | Route-mount and 375px structural defects **closed 2026-09-07** (see closure evidence above). Status stays `AUTOMATED_CHECKED`, not `VISUALLY_VERIFIED`. Integrated visual acceptance **still requires Codex/user pixel-level sign-off** — no longer `SUSPENDED` on the routing defect, but still tied to the same J-2 chain as PC-01 pending that sign-off. |
| Definition of Ready | **MET for the routing and 375px structural scope.** Category Health values remain blocked by `CH-DG-10` / `BP-DG-01` and must keep rendering `Not assessed — rule not configured`. |
| Next step | 等待 Codex 决定 |

#### `PW-00` — Product Workspace Shell (gating prerequisite)

| Field | Value |
|---|---|
| Source Asset ID | **None single-authoritative.** Contract is §5.3 of this Register, assembled from the shared structure across `P2-ADM03-SPECS` … `P2-ADM08-SOURCES`, all SUPPLEMENTARY. |
| Target route | Shared shell wrapping `/admin/products/:id/*` |
| Current actual route | **No shell exists.** `pages/admin/products/[id]/index.vue` plus `ProductSubNav.vue` form a legacy tab strip, not a Workspace Shell. |
| Pages and shared components | Legacy only: `pages/admin/products/[id]/index.vue`; `components/admin/product/ProductSubNav.vue` (6 tabs); `ProductBasicForm.vue`; `PublishPanel.vue` |
| server API | `products/[id].get.ts`; `products/[id].patch.ts`; `products/index.post.ts`; `preview-data.get.ts` |
| types / data relations | `types/product-cms.ts` — `AdminProduct`, `ProductStatus`; lifecycle `draft → review → published → archived` |
| Reusable | `ProductBasicForm.vue` (English-compliant, preserve-first) as the Overview editor; lifecycle state machine; `product_code` invariants; preview endpoint |
| Missing | The shell itself: module rail with completeness, breadcrumb + product identity + top actions, common horizontal tabs, persistent right Product Control, per-tab empty/error/no-permission contracts |
| Charter Gate | `CH-DG-11` (Readiness, feeds the completeness rail) — unresolved |
| Blueprint Gate | `BP-DG-02` (completeness formula) — unresolved; `BP-DG-10` (role matrix / final publisher) — unresolved |
| English-first status | **Non-compliant.** `[id]/index.vue` 9 UI; `ProductSubNav.vue` 5 UI + 1 ARIA; `PublishPanel.vue` 9 UI. Total 23 UI + 1 ARIA. |
| Desktop evidence | `REPOSITORY_CONFIRMED` — legacy pages reviewed |
| Mobile 375px evidence | **None.** No approved mobile adaptation contract (CF-3). |
| Implementation status | `NOT_STARTED` (shell); legacy pages are `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** No PRIMARY asset defines the shell; completeness rail is gated by `CH-DG-11` / `BP-DG-02`; the 375px contract is blocked by CF-3. Codex must supply a written shell contract before any `PW-*` work. |
| Next step | 等待 Codex 决定 |

#### `PW-01` — Specifications

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM03-SPECS` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/specs` inside the `PW-00` shell |
| Current actual route | `/admin/products/:id/specs` → `pages/admin/products/[id]/specs.vue` — exists as a standalone legacy page |
| Pages and shared components | `pages/admin/products/[id]/specs.vue`; `ProductSubNav.vue` (legacy) |
| server API | **7 endpoints** under `server/api/admin/products/[id]/specs/`: `index.get.ts`, `index.post.ts`, `[gid].patch.ts`, `[gid].delete.ts`, `[gid]/items.post.ts`, `[gid]/items/[iid].patch.ts`, `[gid]/items/[iid].delete.ts` |
| types / data relations | `ProductSpecGroup`, `ProductSpecItem`; Directus `product_spec_groups` ↔ `product_spec_items` (CASCADE); EN/ES/PT value and note fields |
| Reusable | Group/item CRUD; ownership-chain validation (`assertProductExists`); existing multilingual value fields; sort order |
| Missing | Category-defined field sets; unit model and conversion; per-value evidence/source link; per-value review state; completeness contribution; Workspace Shell integration |
| Charter Gate | None assigned specifically; `CH-DG-11` consumes spec completeness |
| Blueprint Gate | `BP-DG-04` (parameter model, units, conversions) — **unresolved; blocks `PW-01`** |
| English-first status | **Non-compliant** — 24 UI + 3 PLACEHOLDER = 27 hardcoded visible |
| Desktop evidence | `SCREENSHOT_CONFIRMED` (Codex) — Chinese legacy form, no shell |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` + `SCREENSHOT_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; `BP-DG-04` unresolved; no PRIMARY asset; no mobile contract. |
| Next step | 等待 Codex 决定 |

#### `PW-02` — Media & Resources

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM04-MEDIA` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/media` inside the `PW-00` shell |
| Current actual route | `/admin/products/:id/media` → `pages/admin/products/[id]/media.vue` — exists as a standalone legacy page |
| Pages and shared components | `pages/admin/products/[id]/media.vue` (library picker modal, role select, focal-point grid); `ProductSubNav.vue` |
| server API | **4 endpoints** under `products/[id]/media/`: `index.get.ts`, `index.post.ts`, `[mid].patch.ts`, `[mid].delete.ts`. Supporting: `admin/asset/[id].get.ts`, `admin/media/files.get.ts`, `admin/files/[uuid]/meta.get.ts`, `admin/files/[uuid]/focal.patch.ts` |
| types / data relations | `ProductMedia`, `FileRole` (11 values); Directus `products_files` junction ↔ `directus_files`; product stores UUID references only |
| Reusable | Reference-only model (files stay global — never copied); duplicate-link guard; role/alt/caption/sort/focal-point fields; hardened asset proxy; folder governance in the global library |
| Missing | Public **resource** records (type, language, version, visibility, review state) — entirely absent; media→source evidence link; media review state; Workspace Shell integration |
| Charter Gate | `CH-DG-12` (`file_role` enum and ordering rules) — **unresolved** |
| Blueprint Gate | `BP-DG-05` (media roles, ordering, resource taxonomy) — **unresolved; blocks `PW-02` writes** |
| English-first status | **Non-compliant** — 41 UI + 3 PLACEHOLDER + 14 OPTION = 58 hardcoded visible, plus 3 ARIA |
| Desktop evidence | `REPOSITORY_CONFIRMED` — no route screenshot on record |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; `PW-02` additionally requires the J-3.5 product-media-source audit; `CH-DG-12` / `BP-DG-05` unresolved. **`/admin/media` is the global Media Library and may never be cited as `PW-02` evidence.** |
| Next step | 等待 Codex 决定 |

#### `PW-03` — Page Content

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM05-CONTENT` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/content` inside the `PW-00` shell |
| Current actual route | `/admin/products/:id/content` → `pages/admin/products/[id]/content.vue` — exists as a standalone legacy page |
| Pages and shared components | `pages/admin/products/[id]/content.vue`; `ProductSubNav.vue` |
| server API | **8 endpoints** under `products/[id]/sections/`: `index.get.ts`, `index.post.ts`, `[sid].patch.ts`, `[sid].delete.ts`, `[sid]/items.get.ts`, `[sid]/items.post.ts`, `[sid]/items/[iid].patch.ts`, `[sid]/items/[iid].delete.ts` |
| types / data relations | `ProductSection`, `ProductSectionItem`, `SectionType` (13 values); Directus `product_sections` ↔ `product_section_items` (CASCADE) |
| Reusable | Controlled module-type enum (not freeform); section/item CRUD; ownership-chain validation; enable/disable flag; sort order |
| Missing | Per-module review state, version and rollback; locale-level readiness; source/evidence link per module; public-eligibility rule; Workspace Shell integration |
| Charter Gate | `CH-DG-13` (content-module review granularity: whole product vs per module) — **unresolved** |
| Blueprint Gate | `BP-DG-07` (content module types, review/version/rollback) — **unresolved; blocks `PW-03`** |
| English-first status | **Non-compliant** — 21 UI + 1 PLACEHOLDER + 13 OPTION = 35 hardcoded visible. The 13 OPTION values are `SectionType` **labels**; the enum keys are English and must not change. |
| Desktop evidence | `SCREENSHOT_CONFIRMED` (Codex) — Chinese module-type form, no shell |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` + `SCREENSHOT_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; `CH-DG-13` / `BP-DG-07` unresolved; no PRIMARY asset; no mobile contract. |
| Next step | 等待 Codex 决定 |

#### `PW-04` — Relations

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM06-RELATIONS` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/relations` (planned) inside the `PW-00` shell |
| Current actual route | **None.** Full enumeration of `pages/admin/**/*.vue` returns 15 files; no `relations.vue`. |
| Pages and shared components | None. |
| server API | **None.** Full enumeration of `server/api/admin/**/*.ts` returns 60 endpoints; none serves a product-relations domain. The `sources/` endpoints belong to `PW-06` and must not be counted here. |
| types / data relations | No relation type in `types/product-cms.ts`; no Directus collection; no test |
| Reusable | Nothing exists to preserve |
| Missing | The entire domain — relation record, direction, allowed target kinds (product / application / resource / content), ordering, published-state check, placement approval. `AUDIT REQUIRED BEFORE SCHEMA`. |
| Charter Gate | None assigned |
| Blueprint Gate | `BP-DG-08` (relation semantics) — **unresolved; blocks all `PW-04` work** |
| English-first status | Not applicable — no UI exists |
| Desktop evidence | `REPOSITORY_CONFIRMED` — absence verified by full route and API enumeration |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; J-3.5 audit incomplete; `BP-DG-08` unresolved; schema undefined. |
| Next step | 等待 Codex 决定 |

#### `PW-05` — SEO & Locales

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM07-SEO` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/seo` inside the `PW-00` shell |
| Current actual route | `/admin/products/:id/seo` → `pages/admin/products/[id]/seo.vue` — exists as a standalone legacy page. **It is linked from `ProductSubNav.vue` line 12 (tab 6 of 6).** |
| Pages and shared components | `pages/admin/products/[id]/seo.vue` (title / description / noindex + SERP preview widget); `ProductSubNav.vue` |
| server API | **2 endpoints**: `products/[id]/seo.get.ts`, `products/[id]/seo.patch.ts` |
| types / data relations | `ProductSeoFields`; Directus `products.seo_title_en`, `seo_description_en`, `seo_noindex`, `seo_image` |
| Reusable | EN SEO title/description with server-side length limits (title ≤120, desc ≤320); `seo_noindex` flag; existing sitemap/robots exclusion behaviour; `useSeoHead` public-side integration |
| Missing | Locale readiness matrix (ES/PT); canonical route display; Open Graph media picker bound to the media reference model; structured-data and hreflang publication rule; Workspace Shell integration |
| Charter Gate | `CH-DG-14` (SEO and multilingual publication rules, ES/PT activation) — **unresolved** |
| Blueprint Gate | `BP-DG-09` (locale, canonical, noindex, SEO release) — **unresolved; blocks `PW-05` and the J-10 public cutover** |
| English-first status | **Non-compliant** — 15 UI + 2 PLACEHOLDER = 17 hardcoded visible |
| Desktop evidence | `REPOSITORY_CONFIRMED` — no route screenshot on record |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `LEGACY` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; `CH-DG-14` / `BP-DG-09` unresolved; no PRIMARY asset; no mobile contract. |
| Next step | 等待 Codex 决定 |

#### `PW-06` — Sources & History

| Field | Value |
|---|---|
| Source Asset ID | `P2-ADM08-SOURCES` (SUPPLEMENTARY only) |
| Target route | `/admin/products/:id/sources` (planned) inside the `PW-00` shell |
| Current actual route | **None.** No sources or history page exists among the 15 admin pages. |
| Pages and shared components | None. |
| server API | **3 endpoints exist**: `products/[id]/sources/index.get.ts`, `index.post.ts`, `[sourceId]/archive.post.ts`. Backend-only — no Admin UI consumes them. |
| types / data relations | `ProductSourceRecord`, `SourceReviewStatus`; Directus `product_source_records` (CASCADE to `products`); `tests/sourceRecords.test.ts` (21 cases) |
| Reusable | Required-UUID `source_file_id` rule (zero-source defence, 422 `SOURCE_REFERENCE_REQUIRED`); `source_locator` as an in-file position descriptor only; logical archive with no physical DELETE; duplicate-archive 409; **`nuxt-server` role has no permission on `product_source_records`** |
| Missing | The page itself; human decision queue; confidence model; cited excerpt / page / sheet display; change-history and audit timeline; publish-blocker derivation |
| Charter Gate | None assigned |
| Blueprint Gate | `BP-DG-06` (evidence confidence, `source_locator`, retention) — **unresolved; blocks `PW-06` and all AI provenance** |
| English-first status | Not applicable — no UI exists |
| Desktop evidence | `REPOSITORY_CONFIRMED` — BFF and types reviewed; no page |
| Mobile 375px evidence | **BLOCKED** — no approved mobile adaptation contract (CF-3) |
| Implementation status | `IN_DISCOVERY` — BFF foundation exists; page not implemented |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** `PW-00` incomplete; J-3.5 audit incomplete; `BP-DG-06` unresolved. |
| Next step | 等待 Codex 决定 |

#### `AI-01` — Single Product Dossier

| Field | Value |
|---|---|
| Source Asset ID | `VM1-LOGIC01` (**FUTURE-REFERENCE — confers no build authorization**) |
| Target route | None assigned |
| Current actual route | **None.** |
| Pages and shared components | None. |
| server API | **None.** No AI provider adapter, snapshot store or proposal record exists anywhere in the working tree. |
| types / data relations | None. Directus has no AI collection. |
| Reusable | Nothing exists to preserve |
| Missing | Frozen `InputSnapshot`; versioned proposal with evidence links; per-field human accept / edit / return decision; provider adapter; cost cap; retention and audit logging |
| Charter Gate | Charter §H.4 AI Gate chain — **unresolved**; FD-001 and FD-002 both explicitly **do not** authorize AI |
| Blueprint Gate | `BP-DG-11` (AI provider/model, budget, key, logs, retention) — **unresolved** |
| English-first status | Not applicable — no UI exists |
| Desktop evidence | `REPOSITORY_CONFIRMED` — absence verified |
| Mobile 375px evidence | Not applicable |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** Requires `PW-00`, J-3.5 and every `PW-01`…`PW-06` gate closed, plus separate explicit user authorization. Blueprint stage J-7. |
| Next step | 等待 Codex 决定 |

#### `IMP-01` — Import Review Queue

| Field | Value |
|---|---|
| Source Asset ID | `VM1-LOGIC02` (**FUTURE-REFERENCE — confers no build authorization**). The AI batch rail visible in `VM1-ADM02-D1440` and `VM1-ADM02-M375` also belongs to this module (CF-5) and must not be built into `PC-01`. |
| Target route | None assigned |
| Current actual route | **None.** |
| Pages and shared components | None. |
| server API | **None.** No import job collection, mapping validator or queue exists. |
| types / data relations | None. |
| Reusable | Nothing exists to preserve |
| Missing | Import batch record; field mapping; validation preview and error report; Draft-only creation; per-`product_code` isolation; rollback; idempotency |
| Charter Gate | `CH-DG-15` (import template fields and error-correction rules) — **unresolved** |
| Blueprint Gate | `BP-DG-12` (import template, duplicate/error correction) — **unresolved** |
| English-first status | Not applicable — no UI exists |
| Desktop evidence | `REPOSITORY_CONFIRMED` — absence verified |
| Mobile 375px evidence | Not applicable |
| Implementation status | `NOT_STARTED` |
| Evidence status | `REPOSITORY_CONFIRMED` |
| Acceptance status | `NOT_REVIEWED` |
| Definition of Ready | **NOT MET.** Requires all `AI-01` prerequisites plus an approved import schema and batch governance. Blueprint stage J-8. **FD-002 explicitly forbids showing any AI/import affordance or fabricated state in `PC-01` now.** |
| Next step | 等待 Codex 决定 |

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

