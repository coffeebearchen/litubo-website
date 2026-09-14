# LITUBO Content Center — Module Freeze V1

> **Status:** FROZEN — module topology, page responsibilities, route intent, write boundaries and V1 content types.
> **Not frozen here:** data model, API contract, Directus schema, locale persistence, publish contract. These belong to `CONTENT-CENTER-BLUEPRINT-01`.
> **Frozen by:** `CONTENT-CENTER-MODULE-FREEZE-01` (user-authorized, 2026-09-14). Long-term architecture decision: `D-031` in `docs/project/08-decision-log.md`.
> **Runtime effect:** none. This document authorizes no route, component, API, schema, AI runtime or publication.

---

## 1. Purpose

Freeze what the Content Center *is* before anyone designs how it is stored or built: one content system, its modules, what each module may read and write, where it lives in the Admin, and which visual elements are placeholders. The Blueprint then designs data and API against this frozen shape, and implementation follows only after separate authorization.

Execution order for Content Center work:

```text
Approved Visual → Module Freeze → Blueprint → Explicit Implementation Authorization
→ Draft/Public Safety Gates → Production Release Gates
```

These capability gates replace the historical M4 / M5 milestone numbers as the Content Center entry rule. Milestone numbers stay in history; they are not a Content Center gate.

## 2. Source of truth

| Order | Source | Role |
| --- | --- | --- |
| 1 | Working tree, running services, Directus state | Facts |
| 2 | `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` | Highest governance (safety, boundaries, framework change) |
| 3 | `docs/project/08-decision-log.md` (D-021 … D-031) | Confirmed long-term decisions |
| 4 | **This Module Freeze** | Content Center module shape |
| 5 | `CONTENT-CENTER-BLUEPRINT-01` (not started) | Data, API, schema, locale, publish contracts |
| 6 | `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md` §4.7 / §4.8 | Asset → module → status register |
| 7 | `docs/design-reference/approved/admin-cms-content-center-v1/` | Approved visual direction |
| 8 | `docs/project/CURRENT-STATE.md` | Verified progress |

If the repository, CURRENT-STATE, a visual, this Freeze or the Blueprint conflict: **STOP and report.** Do not guess.

## 3. Approved visual assets

Folder: `docs/design-reference/approved/admin-cms-content-center-v1/` (8 PNG + `README.md`, tracked in Git).

| File | Source Asset ID | Engineering module | Authority |
| --- | --- | --- | --- |
| `00-CC-FLOW-01-FUNCTIONAL-FLOW-D1440.png` | `CC-FLOW-01-FUNCTIONAL-FLOW-D1440` | all (flow); `CC-00` partial | APPROVED flow reference |
| `01-CC-VIS-01-CONTENT-CENTER-OVERVIEW-D1440.png` | `CC-VIS-01-CONTENT-CENTER-OVERVIEW-D1440` | `CC-01` | PRIMARY desktop |
| `02-CC-VIS-02-CONTENT-EDITOR-D1440.png` | `CC-VIS-02-CONTENT-EDITOR-D1440` | `CC-02` | PRIMARY desktop |
| `03-CC-VIS-03-MEDIA-RELATIONS-D1440.png` | `CC-VIS-03-MEDIA-RELATIONS-D1440` | `CC-03` | PRIMARY desktop |
| `04-CC-VIS-04-SEO-LOCALES-D1440.png` | `CC-VIS-04-SEO-LOCALES-D1440` | `CC-04` | PRIMARY desktop |
| `05-CC-AI-01-SOURCE-INTAKE-D1440.png` | `CC-AI-01-SOURCE-INTAKE-D1440` | `CC-AI-01` | PRIMARY desktop |
| `06-CC-AI-02-PROPOSAL-REVIEW-D1440.png` | `CC-AI-02-PROPOSAL-REVIEW-D1440` | `CC-AI-02` | PRIMARY desktop |
| `07-CC-VIS-05-PREVIEW-PUBLISH-READINESS-D1440.png` | `CC-VIS-05-PREVIEW-PUBLISH-READINESS-D1440` | `CC-05` | PRIMARY desktop |

**Namespace rule.** Engineering module IDs (`CC-00`…`CC-05`, `CC-AI-01`, `CC-AI-02`, `CC-HIST`) and Source Asset IDs (the full file stem, e.g. `CC-VIS-02-CONTENT-EDITOR-D1440`) are separate namespaces. A work order names the engineering ID and cites assets by full Source Asset ID. The step labels drawn inside the flow image (`CC-00 Overview`, `CC-01 Editor`, …) are **not** engineering IDs. Files are not renamed. `CC-*` does not collide with `PC-*`, `PW-*`, `PWS-*`, `AI-01`, `IMP-01`, `VM1-*`, `P2-*`, `PW-VIS-*`, `PW-AI-*`, `CH-DG-*` or `BP-DG-*`.

## 4. Visual interpretation rules

The approved images are **APPROVED VISUAL DIRECTION**. They are not a database schema, API contract, permission model, production data, or a literal authorization for every button, count or text they show.

1. **Desktop primary ≠ PNG width.** `D1440` means a 1440-class desktop layout. PNG sizes (1672×941, 1586×992) are not a contract; acceptance runs in a 1440px browser viewport. Images are not redrawn for pixel size.
2. **Repository shell > incidental visual shell** (§5).
3. **Mock data ≠ business truth** (§24).
4. **Visual buttons / counts / badges ≠ runtime authorization.** A control shown in an image exists in V1 only when this Freeze or the Blueprint freezes it.
5. **English-first.** Admin UI strings are English.
6. When an image contradicts a decision in the Decision Log, the decision governs.

## 5. Global shell

- The repository's current Admin shell (`layouts/admin.vue`) is authoritative. Today: Product Center, Content Center (disabled placeholder), Media Library, Settings.
- Menus drawn in the images that the repo shell does not have — Dashboard, Global Settings, Help & Support, and any AI Tools / Website / Users & Permissions entry — are **not** added because an image shows them.
- The future Content Center entry is enabled **inside the existing shell** by turning the current disabled item into a link to `/admin/content-center`. No other shell change is implied.
- Inside a content record, the workspace uses its own module rail (§11 / §33 order), following the existing Product Workspace shell pattern.

## 6. V1 content types

**ONE Content Center. ONE shared Content Workspace.** V1 content types:

| Content type | Notes |
| --- | --- |
| Technical Article | Knowledge / insight style article |
| Application / Solution | Industry or application content |
| Case Study | Customer / project story (only with verified, approved facts) |
| Resource / Download | Downloadable resource entry referencing Media Library files |
| News | Company news |

These are **content types**, not five systems. There is no Article CMS, News CMS, Case CMS, Resource CMS or Application CMS. All types share the same list, workspace, modules, AI flow, readiness and publish path; differences are type configuration (Blueprint).

Public exposure of a type is **not** enabled by this list. It stays subject to the confirmed public IA and decisions D-002, D-003, D-004, D-013, D-014 (for example, News remains non-public in Phase 1 until separately enabled) and to the production release gates.

## 7. Product / Content ownership

- **Product truth** (identity, specifications, product page content, product media associations, product SEO) is owned by **Product Center / Product Workspace**.
- **`product_sections` and `product_section_items` remain Product Workspace-owned** (Product Page Content). Content Center does not take them over and does not use them as its primary content store.
- Content Center references products **only through Relations** (`CC-03`). It never copies product truth into a content record as a second source of truth.
- **`posts` and `site_content`** exist in the repository. Status: **LEGACY / EXISTING STRUCTURES · BLUEPRINT INVENTORY REQUIRED · NO ASSUMED OWNERSHIP.** This Freeze does not decide reuse, migration, replacement or deprecation. Older descriptions of them (`docs/ADMIN-CMS-SPEC.md`, `docs/OPERATIONS-HANDBOOK.md`: Directus native admin as operator UI, `posts.content_type` enums, `download_assets` / `company_content` plans) are historical inputs to that inventory, not Content Center rules.

## 8. Media boundary

- **Media Library is the only business-media workspace** (D-023). Content stores Media UUID / ID references only.
- "Add media", "Replace", "Add download" in the images mean *select from / reference a Media Library asset*. No second business-media file system, no upload store owned by Content Center, no file copy.
- Folder names and paths are never content truth (D-023).

## 9. AI boundary

- **D-021 still applies to Product Workspace AI:** single-product scope.
- **Content AI scope (added by D-031): single current Content Draft** — one current content record plus explicitly selected / linked, allowed, readable sources. Not a general AI platform, global content generator or cross-content autonomous agent.
- **Same architecture, no second engine:** Sources → bounded extraction → `ExtractedSource` → Proposal → Human Review → Apply approved changes to Draft (D-022, D-024 … D-030 continue to apply).
- **Existing safety limits are authoritative.** Per Analyze: at most `MAX_FILES_PER_REQUEST = 5` sources and `MAX_IMAGES_PER_ANALYSIS = 3` images (D-030 (13)); reading budget and character caps unchanged. The "13 source files selected" in `CC-AI-01` is a placeholder. Changing a limit needs its own decision.
- **Forbidden:** direct AI write, AI publish, automatic overwrite of published content, a second AI engine, original binaries to the provider.
- Source entry concepts shown in `CC-AI-01` (Product Center, Media Library, Uploaded documents, Linked resources) are future source-entry concepts only. The concrete source picker and relation model are Blueprint decisions; V1 analyzes only explicitly selected, allowed, readable, linked sources.
- **Confidence column** (High / Medium / Low in `CC-AI-02`): **VISUAL PLACEHOLDER · NOT V1 DATA CONTRACT.** No trustworthy model confidence exists; fabricated scores are forbidden. Not implemented without an independent, verifiable definition.
- **Evidence location:** page citations such as "p. 1", "p. 3", "page 12" are **not** a guaranteed capability of Document Source V1. **Evidence location UI must use only real available source metadata**; the Blueprint must not invent page numbers.
- **"Improve with AI"** (SEO fields) and similar shortcuts: an entry into Source → Proposal → Human Review for that field, never direct generation that overwrites a field. Final button wording may change in implementation.
- **"AI Fill Workspace" / "AI Fill Content"**: opens / starts the Content AI proposal workflow; it is not "fill everything and save". Apply writes Draft only.

## 10. Module topology

```text
CC-00  Content Center List                (collection)
└── Content record → Content Workspace
    ├── CC-01    Overview
    ├── CC-02    Content Editor
    ├── CC-03    Media & Relations
    ├── CC-04    SEO & Locales
    ├── CC-AI-01 AI Source Intake
    ├── CC-AI-02 AI Proposal Review
    ├── CC-05    Preview & Publish Readiness
    └── CC-HIST  Change History
```

**List vs Overview:** `CC-00` is the collection list. `CC-01` is the Overview of **one** content record inside the Content Workspace. `01-CC-VIS-01` (titled "Content Center Overview" in the image) depicts `CC-01`.

## 11. Module responsibilities

| Module | Visual basis | Responsibilities | Not responsible for |
| --- | --- | --- | --- |
| `CC-00` Content Center List | No dedicated full master. Existing Product Center collection/list pattern (`/admin/products`) + `CC-FLOW-01` + Content Center visual language | Browse, search, filter, create a Draft content record, open a record | Editing content; publishing |
| `CC-01` Workspace Overview | `CC-VIS-01-CONTENT-CENTER-OVERVIEW-D1440` | Identity summary, content type, lifecycle summary, readiness summary, media summary, SEO summary, AI summary, module progress, workspace navigation | Full body editing |
| `CC-02` Content Editor | `CC-VIS-02-CONTENT-EDITOR-D1440` | Title, slug, summary, structured sections, FAQ, CTA, core Draft content | Media storage; publishing |
| `CC-03` Media & Relations | `CC-VIS-03-MEDIA-RELATIONS-D1440` | Hero media, inline media, downloads (Media Library references); related Products, related Content, related Resources | Uploading/storing files; copying product truth |
| `CC-04` SEO & Locales | `CC-VIS-04-SEO-LOCALES-D1440` | Slug, SEO title, meta description, canonical, noindex, Open Graph, locale variants / locale readiness | Publishing a locale |
| `CC-AI-01` AI Source Intake | `CC-AI-01-SOURCE-INTAKE-D1440` | Select sources, show source states, analyze within current limits, disclose the AI data flow | Any direct content write |
| `CC-AI-02` AI Proposal Review | `CC-AI-02-PROPOSAL-REVIEW-D1440` | Accept, Edit, Reject, resolve conflicts, Apply approved proposals to Draft | Publishing |
| `CC-05` Preview & Publish Readiness | `CC-VIS-05-PREVIEW-PUBLISH-READINESS-D1440` | Preview, readiness checklist, manual publish entry | Publish contract details (Blueprint pending) |
| `CC-HIST` Change History | No new master; reuse the Product Workspace history pattern (`PW-VIS-09-CHANGE-HISTORY-D1440`; the Product Workspace runtime module is itself not built yet) | Read-only record of candidate events: Created, Edited, AI proposal applied, Published, Unpublished, Archived | Complex audit / version system; event schema (Blueprint pending) |

## 12. Route intent

| Module | Route intent |
| --- | --- |
| `CC-00` | `/admin/content-center` |
| `CC-01` | `/admin/content-center/:id/overview` |
| `CC-02` | `/admin/content-center/:id/editor` |
| `CC-03` | `/admin/content-center/:id/media-relations` |
| `CC-04` | `/admin/content-center/:id/seo-locales` |
| `CC-AI-01` | `/admin/content-center/:id/ai-source-intake` |
| `CC-AI-02` | `/admin/content-center/:id/ai-proposal-review` |
| `CC-05` | `/admin/content-center/:id/preview-publish` |
| `CC-HIST` | `/admin/content-center/:id/history` |

No route is implemented by this Freeze. Recorded suggestions only (Blueprint decides):
- Follow the existing Product Workspace file convention: `pages/admin/content-center/index.vue` and `pages/admin/content-center/[id]/<module>.vue`.
- A bare `/admin/content-center/:id` would reasonably redirect to `/overview`.
- If a dedicated create route is used, a static segment such as `/admin/content-center/new` must not be shadowed by `[id]`.

## 13. Entry / Exit

```text
Content Center List    → Create / Open → Overview
Overview               → any Workspace module
Editor                 → Save Draft → other Workspace modules
Media & Relations      → Save references to Draft → other Workspace modules
SEO & Locales          → Save Draft metadata → AI / Preview / other modules
AI Source Intake       → Analyze → AI Proposal Review
AI Proposal Review     → Apply approved changes to Draft → affected Draft modules
Preview / Readiness    → Manual Publish
History                → return to current Workspace
```

This expresses dependency and workflow. Users are not forced to click through modules linearly.

## 14. Write-boundary matrix

| Module | Read | Draft write | Proposal / review write | Publish |
| --- | --- | --- | --- | --- |
| `CC-00` | YES | CREATE Draft only | NO | NO |
| `CC-01` | YES | minimal / summary only | NO | NO |
| `CC-02` | YES | YES | NO | NO |
| `CC-03` | YES | YES (references) | NO | NO |
| `CC-04` | YES | YES (metadata) | NO | NO |
| `CC-AI-01` | YES | NO | Analyze / session only | NO |
| `CC-AI-02` | YES | Apply approved → Draft | YES | NO |
| `CC-05` | YES | NO | NO | MANUAL HUMAN ENTRY |
| `CC-HIST` | YES | NO | NO | NO |

Concrete endpoints, permissions and concurrency: Blueprint.

## 15. Structured content

Content Center uses a **structured content editor**, not one giant rich-text field. Hero, Introduction, Key benefits, FAQ, CTA and Related content in `CC-VIS-02` show the structural direction. The block schema, per-type templates and allowed blocks: **Blueprint pending.** "Reading time" and the per-section status badges in the image are placeholders until the Blueprint defines them.

## 16. SEO

**Frozen V1 capabilities:** slug, SEO title, meta description, canonical, noindex, Open Graph image (consistent with the CLAUDE.md public-route SEO rule).
**Blueprint pending:** whether "focus terms" become a stored field; social title / social description storage; search and social preview rendering; slug and canonical rules.

## 17. Locales

Content Center is **locale-aware**. EN / ES / PT in the images are illustrative; V1 does not have to publish three languages. English launches first; ES / PT publish only when complete and approved (D-009). Locale persistence model: **Blueprint pending.**

## 18. Readiness

V1 readiness is a **human-readable completeness / publishing-assistance summary**. Candidate dimensions: Content, Media, Relations, SEO, Locales, AI Review.

**Not frozen:** numeric percentages, weighted scores, a workflow engine. The 71% / 75% / "5 / 7" style values in the images are placeholders. The minimal rule set is a Blueprint decision.

## 19. Preview / Publish

- **AI Apply = Draft only.** AI never publishes.
- **Publish is a manual human action**, entered from `CC-05`.
- Publish endpoint, permission, versioning, scheduled publishing and unpublish: **BLUEPRINT PENDING.**
- The public page rendered inside the `CC-VIS-05` preview (navigation "Products / Solutions / Resources / Support / About") is **not** an IA authorization. The confirmed public IA (Products, Applications, Resources, Support, Company) stays. The preview image informs composition and layout direction only.
- Production publication remains subject to production release gates.

## 20. Change History

Reuse the Product Workspace history interaction / visual pattern. No complex audit or version system is invented at this stage. Candidate events: Created, Edited, AI proposal applied, Published, Unpublished, Archived. Event storage and schema: **Blueprint pending.**

## 21. Desktop contract

- 1440px browser viewport is the desktop acceptance environment.
- Layout, hierarchy and panel placement follow the PRIMARY master for the module; `CC-00` follows the Product Center list pattern.
- Repository Admin shell; English UI strings; no page-level horizontal overflow.
- Empty, loading, error and no-permission states per Charter §N.2.

## 22. 375px mobile contract

There is no separate approved mobile visual. Every Content Center implementation module must be accepted at 375px against this contract:

1. No page-level horizontal overflow.
2. Single-column stacking when needed.
3. Workspace navigation remains reachable.
4. Right-hand summary panels move below primary content.
5. Tables become responsive list / card / controlled-scroll patterns.
6. Primary actions remain reachable.
7. AI Accept / Edit / Reject remains usable.
8. Conflicts remain resolvable.
9. Manual Publish remains explicit.

The Module Freeze itself needs no mobile screenshot.

## 23. Explicit V1 exclusions

Shown in visuals but **not** in Content Center V1 (FUTURE / VISUAL PLACEHOLDER; not implemented without separate authorization):

- Legal review workflow
- Brand review workflow
- QR-code publishing / sharing
- Distribution readiness; "Share preview" as a distribution feature
- Automatic social distribution
- Numeric readiness percentages and computed scores (71% / 75% style)
- AI confidence scores (High / Medium / Low)
- Guaranteed page-number evidence citations
- Direct single-field AI overwrite
- Scheduled publishing (not frozen; Blueprint may only record it as future)
- Global menu items not in the repository shell (Dashboard, Help & Support, …)

## 24. Placeholder / mock-data rules

Everything in the images such as CW-3000, LT-180C, "How to Choose a Checkweigher for Powder Products", 2024 dates, file names, image sizes, people names, view counts, source counts and readiness numbers is **DESIGN PLACEHOLDER · NOT VERIFIED BUSINESS DATA** (D-008). None of it may be written into the system as real or public content, used as seed data, or used as test fixtures presented as real.

Taxonomy labels in the images ("Knowledge / Article", "Application Guide", tags) are not taxonomy authority. V1 high-level types are only those in §6; category, topic, taxonomy and template subtype are Blueprint decisions.

## 25. Blueprint inputs

`CONTENT-CENTER-BLUEPRINT-01` must resolve, at minimum:

1. Content Item model
2. Legacy `posts` / `site_content` disposition (inventory first)
3. Content type configuration
4. Block schema (structured content)
5. Draft / Published persistence
6. Media relations (Media UUID references, roles)
7. Product / Content relations
8. SEO model
9. Locale model
10. AI Target model (Content Draft target on the existing Proposal Engine)
11. Proposal Apply mapping
12. History / events
13. Readiness rules
14. Preview
15. Publish API (permission, unpublish, versioning)
16. Frontend delivery (public routes per confirmed IA and D-003 / D-004 / D-013 / D-014)
17. Slug / canonical rules
18. Archive / recovery

Constraints the Blueprint must respect: `docs/ADMIN-CMS-SPEC.md` collection-budget approval rule for any new collection; Directus schema snapshot + backup protocol (CLAUDE.md); Charter §G / §N; D-021 … D-031; the proportionate-engineering principle (no enterprise-grade audit, locking or permission systems unless required).

## 26. Out of scope

Runtime code, routes, components, API, DB migration, Directus collections, AI runtime, extractor, Docker, Product data, Media runtime, Provider calls, deployment, push. Enabling the disabled Content Center shell item. Updating `docs/ADMIN-CMS-SPEC.md` / `docs/OPERATIONS-HANDBOOK.md` historical content (drift recorded in §7).

## 27. Freeze status

```text
VISUAL DIRECTION:      APPROVED
MODULE TOPOLOGY:       FROZEN
PAGE RESPONSIBILITIES: FROZEN
ROUTE INTENT:          FROZEN
WRITE BOUNDARIES:      FROZEN
CONTENT TYPES:         FROZEN FOR V1
DATA MODEL:            NOT FROZEN
API CONTRACT:          NOT FROZEN
DIRECTUS SCHEMA:       NOT STARTED
BLUEPRINT:             NOT STARTED
IMPLEMENTATION:        NOT STARTED
```

---

## Appendix A — Governance rulings recorded by this Freeze

Rulings on conflicts found by the pre-Freeze read-only review (2026-09-14):

| # | Conflict | Ruling |
| --- | --- | --- |
| 1 | Content Center entry conditions required M4 completion and a real-product pilot, while the roadmap placed Content Center before real product entry; the Charter said "after M4" in one place and "after M5" in another | Capability gates (§1). Visual, Freeze, Blueprint and Draft-only implementation may proceed before a real-product production pilot; production publication, production release and public exposure stay gated. M4 / M5 numbers are historical only. |
| 2 | Charter §E.4 listed `product_sections` / `product_section_items` under Content Center; `posts` / `site_content` ownership undefined | `product_sections` / `product_section_items` stay Product Workspace-owned and are not the Content Center store. `posts` / `site_content`: legacy, Blueprint inventory required, no assumed ownership. |
| 3 | `CC-AI-01/02` vs D-021 single-product AI scope; 13 sources vs the 5-source limit | D-021 unchanged for Product Workspace AI; Content AI = single current Content Draft + explicit sources on the same Proposal Engine; limits unchanged (§9). |
| 4 | Visual capabilities with no current support or conflicting with decisions (confidence, page citations, single-field AI, Legal/Brand review, QR/distribution, percentages) | Placeholders / exclusions (§9, §18, §23). |
| 5 | Public preview navigation and taxonomy labels differ from the confirmed IA and D-003 | Not IA or taxonomy authority (§6, §19, §24). |
| 6 | No list-page master; "Change history" not in the flow | `CC-00` uses the Product Center list pattern + flow; `CC-HIST` reuses the Product Workspace history pattern (§11). |
| 7 | Desktop-only masters; placeholder data | 375px contract (§22); mock data rule (§24). |
