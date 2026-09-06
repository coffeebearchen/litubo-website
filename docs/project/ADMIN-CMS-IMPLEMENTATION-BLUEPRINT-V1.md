# LITUBO Admin CMS — Implementation Blueprint V1

> **Role:** This is the complete backend and Admin CMS master implementation blueprint. It sits below `ADMIN-CMS-GOVERNING-CHARTER-V1.md` and above all module-level construction contracts.
>
> **Status:** Framework baseline. Operational truth, current commits, and active blockers remain in `CURRENT-STATE.md`; sequence remains in `MASTER-ROADMAP.md`.

## 1. Authority and non-negotiable rules

| Actor | Responsibility |
|---|---|
| User | Final authority for business facts, real product files, visual approval, roles, publication, release, and framework change. |
| Codex/GPT | System architect, programme planner, dependency/Gate owner, risk reviewer, acceptance reviewer. |
| Claude | Sole code executor: reads governing files, inspects code, implements bounded work, tests, commits, reports. |

No normal construction task may change this Blueprint, the Charter, business meaning, schema, roles, or source-of-truth rules. Such a change requires an explicit user decision recorded as a Framework Decision.

## 2. Governing document stack

1. Runtime/repository truth and confirmed user decisions.
2. `docs/project/CURRENT-STATE.md`.
3. `ADMIN-CMS-GOVERNING-CHARTER-V1.md` — constitution: authority, boundaries, safety, change control.
4. **This file** — complete system construction map.
5. `MASTER-ROADMAP.md` — stage order and current progress.
6. Relevant Construction Pack, visual/logic master, current code, types, APIs, and tests.
7. The bounded module contract and work order.

Raw master status must remain truthful: visual files marked `DRAFT` are not edited. FD-001 records the user’s separate `USER-CONFIRMED FOR IMPLEMENTATION` authorization. FD-003 (Charter §D.2) sets reading-efficiency tiers for execution only; it may never be used to skip a module dependency, visual master, data/API contract, Gate, or acceptance step defined in this Blueprint, and it changes no module sequence, AI/import boundary, or existing data architecture.

## 3. Target architecture

```text
Admin UI
  → Nuxt page/composable/component
  → Nuxt Server BFF/Admin API
  → validation, role checks, audit, DTOs, domain rules
  → Directus / PostgreSQL / Media Storage

Public Nuxt frontend
  → Public BFF/API
  → public projection only: published + approved + locale/SEO-eligible + non-TEST ONLY
```

Rules:

- Admin pages do not bind themselves directly to unreviewed Directus raw data shapes.
- Nuxt Server/BFF owns authentication, authorization, CSRF, validation, DTOs, audit, and compatibility.
- Directus/PostgreSQL/store are substrate, not UI business logic.
- Public APIs never disclose internal sources, audit notes, AI proposals, unreviewed facts, or TEST ONLY records.
- Existing SSR session continuity, CSRF, admin role boundary, lifecycle, `product_code`, BFF APIs, media governance, source governance, and tests are preserved unless an explicit approved migration replaces them.

## 4. Domain ownership and canonical relationships

| Domain | Owns | Must not own |
|---|---|---|
| Identity & Access | Admin identity, role, session, audit actor | Product content or public delivery rules |
| Product Center | Product master, category, `product_code`, lifecycle entry | Physical media files |
| Product Workspace | One product’s work context, Product Control, review/readiness context | Global media storage |
| Specifications | Groups, definitions, values, units, field evidence | Publication decisions alone |
| Global Media Library | Media UUID, file, folder, archive, reference protection | Product-specific editorial role |
| Product Media & Resources | Product-to-media/resource reference, role, order, alt/caption | Copy or ownership of a physical asset |
| Sources & History | Evidence, `source_locator`, confidence, human confirmation, change history | Public presentation by default |
| Page Content | Controlled product page modules, FAQ/resource links, module versions | Raw source files |
| Relations | Product-to-product/application/resource meaning | Lifecycle changes |
| SEO & Locales | Locale, SEO, canonical, noindex eligibility | Publication bypass |
| Review & Publish | Review decisions, publication gate, audit | Fabricated readiness values |
| Import Center | Workbook staging, mapping, validation, draft creation | Bulk publication |
| AI Workbench / Dossier | Input snapshots, proposals, human decisions | Direct overwrite/publish/delete actions |
| Public Delivery | Public read projection, cache/invalidation | Internal fields or Admin writes |
| Settings & Operations | Rules, model config, retention, backups, health | Silent business-policy changes |

Canonical relationship rules:

```text
Product ─ belongs to → Category
Product ─ has → Specifications / Content Modules / Locale SEO / Audit events
Product ─ links to → MediaAsset through ProductMediaLink
Product ─ links to → SourceRecord through ProductSourceLink
Product ─ relates to → Product/Resource/Application through ProductRelation
Product ─ receives → AI Proposal; proposal is not formal product data before human acceptance
ImportRow ─ may create → one Draft Product after validation and review
```

Any field or relation not proved by current code/schema is labelled **AUDIT REQUIRED BEFORE SCHEMA**. It is not silently invented.

## 5. Global state, audit, security, and publication contracts

### 5.1 Lifecycle

```text
draft → review → published → archived
```

- `readiness`, content completeness, and Category Health are calculated indicators, never lifecycle states.
- Formulas are Decision Gates; absent formulas produce neutral statistics or `Not assessed`, never fake scores.
- TEST ONLY products stay non-public and noindex.
- Published edits, review outcomes, withdrawal, archive, restore, and material source changes must be auditable.

### 5.2 Human control

- No source evidence + no required human review + no publication gate = no public publication.
- Admin role, SSR auth, CSRF/Origin checks, input validation, and audit controls cannot be bypassed by page code.
- Concurrent edit, save failure, no-permission, empty, loading, and error behaviors must be defined per module.

### 5.3 Security and privacy

- Cookies/tokens/passwords/`.env` are never printed, committed, or included in screenshots/reports.
- Public DTOs use a field whitelist.
- Raw Word/Excel/PPT, source evidence, internal notes, and unreviewed data remain private.
- Upload type/size/quarantine policy, rate limiting, least privilege, logs, backups, and recovery are mandatory operational concerns.

## 6. Admin information architecture and visual traceability

| Visual/logic master | Module | Target responsibility |
|---|---|---|
| ADM-02 | Product Center | All products, real filters, list, Product Control context |
| ADM-02a | Categories | Category navigation and neutral/confirmed category statistics |
| ADM-03 | Specifications | Evidence-backed technical parameter workspace |
| ADM-04 | Product Media & Resources | Per-product references to global media/resources |
| ADM-05 | Page Content | Controlled website modules and reviewable content |
| ADM-06 | Relations | Product/application/resource relationships |
| ADM-07 | SEO & Locales | Locale, SEO, canonical/noindex readiness |
| ADM-08 | Sources & History | Evidence, audit, decision history |
| Logic 01 | Single Product Dossier | One Draft’s controlled AI proposal/review pipeline |
| Logic 02 | Multi-model Import Review Queue | Workbook mapping, draft-only import, isolated review queue |

An Admin route is complete only when it has real data/API, role boundary, empty/loading/error/no-permission states, desktop/375px behavior, tests, and acceptance evidence. No menu-only or static mock modules are allowed.

### 6.1 Engineering module IDs (fixed by FD-002, 2026-09-06)

The unprefixed `ADM-xx` numbers above originate from visual reference filenames and are **ambiguous across packages**: `README_VISUAL_INDEX.md` assigns `ADM-04`–`ADM-08` to a single-product Dossier and `ADM-09`–`ADM-11` to an import queue, while the table in §6 assigns those same numbers to Media, Page Content, Relations, SEO and Sources. FD-002 resolves this by introducing engineering module IDs that are independent of any filename.

| Engineering module ID | Module | §6 visual row | Blueprint stage |
|---|---|---|---|
| `PC-01` | Product Catalogue / All Products | ADM-02 | J-2 |
| `PC-02` | Category Context | ADM-02a | J-2 |
| `PW-00` | Product Workspace Shell | — (shared shell, no single visual row) | J-3 |
| `PW-01` | Specifications | ADM-03 | J-4 |
| `PW-02` | Media & Resources | ADM-04 | J-5 |
| `PW-03` | Page Content | ADM-05 | J-6b |
| `PW-04` | Relations | ADM-06 | J-6c |
| `PW-05` | SEO & Locales | ADM-07 | J-6d |
| `PW-06` | Sources & History | ADM-08 | J-6a |
| `AI-01` | Single Product Dossier | Logic 01 | J-7 |
| `IMP-01` | Import Review Queue | Logic 02 | J-8 |

Rules:

1. **An engineering module ID is not a visual filename.** `PW-02` is the Media & Resources module; it is not "the file named ADM-04". The two namespaces are related only through this table.
2. **An unprefixed `ADM-xx` reference must never drive code.** Any work order, report or Register row that instructs implementation must name the engineering module ID (`PC-01`…`IMP-01`) and the Source Asset ID defined in the Register's Master Authority Matrix.
3. This table changes **no** module sequence, dependency, data/API boundary or AI/import gate. §11 remains the binding stage order; `PW-00` (J-3) remains a prerequisite for every `PW-01`…`PW-06` module.
4. `PW-00` has no single visual row because the Workspace shell contract is defined by §5.3 of the Register, assembled from the shared structure visible across the ADM-03…ADM-08 references. No individual reference file is authoritative for it.

### 6.2 Gate namespace prefixes (fixed by FD-002)

Two independent gate namespaces exist. FD-002 makes the Charter prefix explicit so neither can be inferred from the other:

| Prefix | Owner document | Meaning |
|---|---|---|
| `CH-DG-xx` | `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` §M.2 | Charter Decision Gate — governance-level; business definitions the user must confirm |
| `BP-DG-xx` | This document §12 | Blueprint Decision Gate — implementation-level |

- `CH-DG-xx` is the explicit form of the Charter's existing `DG-xx` numbering. The numbers are unchanged: Charter `DG-10` **is** `CH-DG-10`. No Charter gate is renumbered by FD-002.
- Existing business code that displays a bare `(DG-10)` string — `pages/admin/products/categories.vue` — refers to Charter `DG-10` / `CH-DG-10` and remains correct. FD-002 does not require a code change.
- The same number in the two namespaces refers to entirely different decisions and must never be conflated. Any cross-mapping must be established by Codex and confirmed by the user; Claude must never assume one.

### 6.3 PWS work-order namespace and child blueprint standing (fixed by PW-GOV-01, 2026-09-07)

`docs/project/ADMIN-CMS-PRODUCT-WORKSPACE-BLUEPRINT-V1.md` is a child blueprint: it sits below this document and is bound by it and by the Charter. Its own `PW-00`…`PW-07`+`AI-01` numbering no longer addresses code work orders. Per the user's PW-GOV-01 governance decision (registered in full in the Register §4.5/§4.6), future Product Workspace implementation work orders use:

```text
PWS-00 Workspace shell + Overview
PWS-01 Page Content
PWS-02 Specifications
PWS-03 Media & Resources
PWS-04 Relations
PWS-05 SEO & Locales
PWS-06 Share & Distribution
PWS-07 Sources & Evidence
PWS-08 Change History
PWS-AI-01 Source Intake
PWS-AI-02 Proposal Review
```

This supersedes the `PW-01`…`PW-06` subdivision in §6.1 above **for addressing future Workspace work orders only**. §6.1's table, this document's module sequence (§11), and every gate in §12 are otherwise unchanged: a gate written against `PW-02` (e.g. `BP-DG-05`) continues to govern the module now addressed as `PWS-03`. `IMP-01` is not part of the `PWS-*` namespace and is unaffected.

The new Product Workspace reserves the route prefix `/admin/product-workspace/:id/...` (defined in the child blueprint §6). The existing legacy editor keeps `/admin/products/:id/...` unchanged; both address the same canonical `product_id`. No legacy route, page, component, schema, or data is deleted, migrated, or rewritten by this decision — this is a routing reservation, not a route implementation.

This section is a documentation cross-reference only. It authorizes no code, does not alter §11's stage order, and does not change any AI/Import gate. `PW-00`'s Definition of Ready (Register §12.1i) remains unresolved; no `PWS-*` code may begin without a separate Codex work order satisfying it.

## 7. Module contracts

### 7.1 Product Center and Categories — ADM-02 / ADM-02a

- Rebuild existing Product Center gradually; preserve product APIs, `product_code`, edit/new flows, and ProductBasicForm.
- Real search/filter/pagination/category statistics only.
- Category Health remains neutral until its formula is approved.
- Product Control is read-only context until Review/Publish contracts are implemented.
- No fake media/source counts, AI actions, exports, bulk actions, or health percentages.

### 7.2 Product Workspace Shell and Product Control

- One protected product context route and shared navigation for all product tabs.
- Overview reuses ProductBasicForm as the basic editor; it is not a full workspace substitute.
- Each tab has its own data/API/permission/empty/error contract.
- J-3 cannot invent content for later tabs.

### 7.3 Specifications — ADM-03

- Requires audited parameter model: groups, values, units, evidence, validation, and readiness input.
- Category-specific versus universal fields and unit conversion are Decision Gates.

### 7.4 Product Media & Resources — ADM-04

- Reuses global Media UUIDs; never copies physical assets.
- Requires approved product-media role, ordering, caption/alt, download and archive-reference rules.
- Links to product resources are distinct from global library management.

### 7.5 Page Content — ADM-05

- Controlled page-module records only; every module has source, review, version, and public eligibility rules.
- No direct uncontrolled rich-content publication.

### 7.6 Relations — ADM-06

- Defines allowed product/product, product/application, product/resource relation types and their direction/meaning.

### 7.7 SEO & Locales — ADM-07

- Governs English public release first; ES/PT structure is reserved.
- Requires locale, canonical, noindex, structured-data, translation-review and publication rules.

### 7.8 Sources & History — ADM-08

- Evidence is traceable through `SourceRecord` and `source_locator`.
- Audit records show actor, time, field/module, source basis, decision, and outcome.

### 7.9 Review & Publish

- Built only after readiness inputs exist.
- Calculates a transparent gate; does not replace the existing lifecycle.
- Publish/withdraw emits audit and invalidates appropriate public data/cache.

## 8. AI and import production lines

### 8.1 Single Product Dossier

```text
Current Draft
→ select only its already-linked approved source/material set
→ freeze InputSnapshot
→ generate a versioned proposal with evidence links
→ human accepts, edits, or returns each field/module
→ audit/review/publish gate
```

AI must never cross product boundaries, overwrite confirmed fields, auto-publish, delete assets, or move formal media. Model/provider, key ownership, cost cap, retention, logging, retry, and human-review policy are user Decision Gates.

### 8.2 Multi-model Import Review Queue

```text
XLSX/CSV upload
→ detect sheet
→ map fields
→ validate preview
→ stage errors and correction report
→ create Drafts only
→ isolate each product_code
→ per-product AI/human review
→ never bulk publish
```

Import needs idempotency, duplicate handling, partial failure, correction, rollback, audit, and real-template approval before live use.

## 9. Public frontend delivery contract

Only qualified public product projections are available to frontend routes:

```text
Published
+ required human review
+ valid public locale/SEO decision
+ non-TEST ONLY
+ no internal-only evidence/content
```

Define public fields, noindex/canonical, cache invalidation, public error fallback, structured data, and language behavior before frontend cutover. Existing fixtures remain until a contracted public CMS path is verified.

## 10. Quality, migration, backups, and operations

### 10.1 Incremental migration

- Keep working behavior until its replacement is tested.
- No schema change without an approved migration contract, backup, rollback, test-data rehearsal, and index/performance review.
- Protect old routes/APIs, ID=3 TEST ONLY, existing media, and existing sources.
- Separate fixtures from real product data.

### 10.2 Required verification per code module

```text
Vitest
Typecheck
Lint
Nuxt build
git diff --check
Relevant API/permission/state-machine tests
Desktop and 375px visual check when appropriate
```

### 10.3 Backup and recovery

- Passing module: exact commit → Codex review → concentrated acceptance → separate GitHub push → hash match.
- Schema and database changes: snapshot + database backup + restoration verification before mutation.
- Media: inventory/manifest and separate backup.
- Visual and Construction Packs presently untracked: maintain a separate manifest/hash/backup location; never mix raw packs into a business-code commit.
- Define health checks, service logs, capacity monitoring, dependency/security updates, and recovery procedures before production release.

### 10.3a Visual & Data Conformance Register Gate (fixed, 2026-09-06)

Before Claude changes any Admin/CMS source code for a given module:

1. The corresponding Register row (ADM-xx or Logic-xx) must exist in `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md`.
2. The row must confirm: target route, shared shell contract, data/API contract, English-first scope, applicable Charter DG and Blueprint BP-DG, and DoR status.
3. If the row is absent, shows `IN_DISCOVERY`, or has unresolved DoR items, stop and report — do not start code changes.
4. After implementation, the Register row must be updated with evidence before the task can report completion. Automated tests passing alone do not satisfy the Register gate; runtime and visual evidence are required.
5. Register authority: Charter > Blueprint > Register. The Register cannot change module sequence, override gates, or invent data rules.

### 10.4 GitHub Checkpoint Protocol (fixed, 2026-09-06)

A checkpoint is a remote backup only — it does not imply acceptance, release, or deployability.

1. An atomic sub-task with passing automated verification must have an exact local commit before any checkpoint push.
2. When the user or Codex explicitly authorises, create or fast-forward the designated GitHub remote checkpoint branch.
3. `origin/master` is updated only after integration acceptance, user visual confirmation, and Codex explicit authorisation — never as part of a checkpoint.
4. Never force-push, delete a branch, rewrite history, or change the remote URL.
5. Checkpoint branches are never auto-deleted.
6. Every report must list separately: local HEAD hash · checkpoint branch hash · `origin/master` hash · whether they differ and why.
7. The single checkpoint branch for the J-2 integration chain is `backup/admin-cms-j2` (fixed name; do not create duplicates).

## 11. Mandatory programme sequence

| Stage | Module | Dependency / unlock |
|---|---|---|
| J-1 | Charter + FD-001 | Completed |
| J-1.1 | Charter v1.1 | Completed |
| J-2 | ADM-02 Product Center + ADM-02a Categories | Current local code pending concentrated visual acceptance and backup |
| J-2.5 | Master Blueprint | This document; required before J-3 |
| J-3 | Workspace Shell + Product Control | J-2/J-2.5 accepted |
| J-3.5 | Product-media-source-audit relationship foundation | J-3; approved contract before schema |
| J-4 | ADM-03 Specifications | J-3 + parameter model gate |
| J-5 | ADM-04 Product Media & Resources | J-3.5 + media-role gate |
| J-6a | ADM-08 Sources & History | J-3.5 + evidence/audit contract |
| J-6b | ADM-05 Page Content | Content-module gate |
| J-6c | ADM-06 Relations | Relation-semantic gate |
| J-6d | ADM-07 SEO & Locales | SEO/locale gate |
| J-6e | Review & Publish + readiness | J-4 to J-6d inputs completed |
| J-7 | Single Product Dossier | Source/media/audit/review gates completed |
| J-8 | Multi-model Import Queue | Import contract; no bulk publication |
| J-9 | Real product pilot | User-selected authority files; a new Draft, never repurpose ID=3 |
| J-10 | Public frontend CMS cutover | Qualified published product projection |
| J-11 | Production operations closure | Security, backup/restore, performance, deployment approval |

## 12. Open Decision Gate register

### Gate namespace rule

`BP-DG-xx` denotes **Blueprint Decision Gates** — implementation-level gates managed within this document.
`CH-DG-xx` denotes **Charter Decision Gates** in `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` §M.2. FD-002 fixed this explicit prefix; it is the same numbering the Charter writes as `DG-xx` (Charter `DG-10` = `CH-DG-10`), and no Charter gate was renumbered. Prefer `CH-DG-xx` in new work orders and reports; a bare `DG-xx` in existing documents and in `pages/admin/products/categories.vue` still means the Charter gate.

These are two independent namespaces. The same number in each namespace (e.g. BP-DG-10 and DG-10) refers to an entirely different decision and must never be conflated. Neither namespace may be inferred from the other. Any explicit cross-mapping between a Charter DG and a Blueprint BP-DG must be established by Codex and confirmed by the user; Claude must never assume a mapping.

| Gate | Decision required | Blocks |
|---|---|---|
| BP-DG-01 | Category Health formula | Calculated category health only |
| BP-DG-02 | Product readiness/completeness formula | Publish readiness and review dashboard |
| BP-DG-03 | Category taxonomy and hierarchy | Full category operations |
| BP-DG-04 | Parameter model, units, conversions | Specifications |
| BP-DG-05 | Media roles, ordering, resource taxonomy | Product Media & Resources writes |
| BP-DG-06 | Evidence confidence, `source_locator`, retention | Sources/History and AI provenance |
| BP-DG-07 | Content module types, review/version/rollback | Page Content |
| BP-DG-08 | Relation semantics | Relations |
| BP-DG-09 | Locale, canonical, noindex, SEO release | SEO/Locales and public cutover |
| BP-DG-10 | Role matrix and final publisher | Expanded review/publish actions |
| BP-DG-11 | AI provider/model, budget, key, logs, retention | AI Dossier |
| BP-DG-12 | Import template, duplicate/error correction | Import Queue |
| BP-DG-13 | Real pilot model and authority source package | Real product Draft |
| BP-DG-14 | Raw visual/construction pack backup/recovery | Long-term reference reliability |
| BP-DG-15 | Migration/recovery/deployment authority | Production mutation/release |

Open Gates only block dependent stages. Codex consolidates user decisions at the relevant stage; Claude never guesses them.

## 13. Module readiness and completion

### Definition of Ready

```text
Relevant master confirmed through FD-001 or confirmed status
Current code/data/API audited
Required Decision Gates resolved or safely excluded
Allowed files and prohibited areas named
Test and acceptance criteria defined
Migration/rollback need known
```

### Definition of Done

```text
Bounded code complete
No fake data or hidden policy changes
Tests, typecheck, lint, build, diff check pass
Visual/functional acceptance evidence recorded
CURRENT-STATE and ROADMAP updated
Exact local commit reviewed
Separate backup/push complete when authorized
```

## 14. Traceability and working cycle

Every module must trace:

```text
Master → route/page → entity/DTO/API → tests → acceptance evidence → commit → GitHub backup
```

Fixed cycle:

```text
Codex identifies next dependency and consolidated Gate
→ one complete work order
→ Claude reads governing files and current code
→ bounded implementation + tests + local commit
→ Codex reviews
→ user participates only for consolidated business confirmation or one necessary visual session
→ separate backup/push order
→ state and milestone updates
```

No module may jump this sequence.
