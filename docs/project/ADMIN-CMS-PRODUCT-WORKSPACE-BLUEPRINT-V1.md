# LITUBO Admin CMS — Product Workspace Blueprint V1

**Document status:** Approved governance baseline — controlled implementation remains gated (PW-GOV-01, 2026-09-07)

**Scope:** New Product Workspace only; no removal or replacement of the existing product editor

**Primary language:** English-first for all administrator-facing UI

**Owner:** LITUBO product team

**Last updated:** 2026-09-06

---

## 1. Purpose and authority

This document defines the new **Product Workspace**: a structured internal workbench for one product model. It makes product data, product-page content, specifications, media links, downloads, relations, evidence, and audit history work together without creating a second product database.

It is a child blueprint. It does not replace the four existing governance documents:

1. `CLAUDE.md` — the only Claude starting point and reading navigation.
2. `docs/project/ADMIN-CMS-GOVERNING-CHARTER-V1.md` — highest rules, boundaries, and change control.
3. `docs/project/ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md` — overall Admin CMS modules, dependencies, data/API direction, and sequencing.
4. `docs/project/ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md` — visual master, route, data, English-first, and acceptance mapping.

If this document conflicts with a higher document, the higher document wins. Before code begins, this blueprint and each approved Workspace visual must be registered in the Conformance Register.

---

## 2. Confirmed strategic decision

LITUBO will build a **new Product Workspace alongside the old single-product editor**.

- Existing product pages and routes remain available during the pilot.
- No legacy page, route, table, field, media item, or product record may be deleted in this initiative.
- The new Workspace uses the same existing `product_id` and the same canonical product data. It must not create a second `products` collection or a second copy of product assets.
- During the pilot, one product record must have one active editing surface at a time. The new Workspace is the preferred surface for pilot products; the legacy editor is retained for safety and comparison, not extended in parallel.
- A later explicit decision may mark a migrated legacy page read-only. Removal is a separate future project, never an implied side effect of Workspace work.

This is a controlled parallel migration, not a rewrite-and-delete operation.

---

## 3. What Product Workspace is — and is not

### It is

- An internal administrator workbench for one product model.
- A structured dossier for product facts, page content, specifications, approved media associations, documents, evidence, and history.
- The place where staff prepare a product record for review and public release.
- A future controlled entry point for AI-assisted extraction and drafting.

### It is not

- A public customer portal.
- An employee's personal private drive.
- A second Media Library or a place to upload duplicate files.
- A social-media auto-posting tool in V1.
- A system that may invent technical values, overwrite approved facts, or publish without human review.

---

## 4. Product Center and Workspace: two different levels

| Area | Main job | Typical question it answers |
|---|---|---|
| **Product Center** | Find, filter, create, and monitor the catalogue | “Which product do I need to work on?” |
| **Product Workspace** | Build and review one product dossier | “Is this specific model accurate, complete, and ready for review?” |

The Product Center remains the catalogue-level landing page. Opening a product enters its Workspace. They are complementary, not duplicate pages.

---

## 5. Common Workspace shell

Every Workspace page uses one stable frame:

1. **Global Admin navigation** — Product Center, Media Library, Content Center when implemented, Settings.
2. **Workspace navigation** — the product-specific menu below.
3. **Main work area** — page-specific form, table, cards, or review workflow.
4. **Context inspector** — selected media, status, validation, or related record; it must never hide required editing content.
5. **Product header** — breadcrumb, product name/model, lifecycle status, Preview product, Save changes, and overflow actions.

Desktop and mobile must preserve the information hierarchy. At 375px, navigation becomes a deliberate drawer or accordion; important actions remain reachable and no horizontal overflow is permitted.

---

## 6. Workspace menu, pages, and responsibilities

| Menu item | Main responsibility | Does not do |
|---|---|---|
| **Overview** | Product identity, product code, category, lifecycle state, short summary, review actions | Complex page-module editing |
| **Page content** | Ordered public product-page modules: overview, features, applications, CTA, FAQ content | Store original PDFs or raw images |
| **Specifications** | Technical parameter groups, units, values, notes, validation state | Write marketing copy |
| **Media & resources** | Link approved Media Library assets, assign display roles, alt text, documents and customer-download visibility | Duplicate or physically move existing files |
| **Relations** | Applications, related models, accessories, compare sets, optional attachments | Act as a media association screen |
| **SEO & locales** | URL slug, metadata, English and future locale content, public preview | Directly manage social accounts |
| **Share & distribution** | Future public URL, copy link, QR code, UTM variants, manual social-preview information | Automatic Facebook/LinkedIn/YouTube posting in V1 |
| **Sources & evidence** | Restricted source PDFs, Excel files, photos, quotations, verification state, citations | Expose internal source materials to customers |
| **Change history** | Append-only record of edit, review, approval, publication, and migration events | Store raw evidence files |

### Default new routes

```text
/admin/product-workspace/:id/overview
/admin/product-workspace/:id/page-content
/admin/product-workspace/:id/specifications
/admin/product-workspace/:id/media-resources
/admin/product-workspace/:id/relations
/admin/product-workspace/:id/seo-locales
/admin/product-workspace/:id/share-distribution
/admin/product-workspace/:id/sources-evidence
/admin/product-workspace/:id/change-history
```

These routes are proposed defaults. They must be checked against the existing router before implementation; no redirect or legacy-route replacement is allowed in the first pilot.

---

## 7. Generic template first; product customization second

### 7.1 The operating model

The first implementation is a reusable **Industrial Equipment — Standard Product** template. It gives every product the same reliable structure before category-specific variations are introduced.

The template defines:

- which Workspace sections exist and their default order;
- which fields are required, optional, review-only, or not yet configured;
- default specification group names and units where approved;
- document classes and display roles;
- page-module skeletons and public-page section order;
- AI drafting instructions and validation requirements for each field.

The template does **not** define product facts. It must never create a false technical number, a certificate claim, an image role, or a published marketing statement.

### 7.2 Template layers and stable relationships

The system follows **base template → category template → model-specific configuration**:

| Object | Role | Mandatory relationship |
|---|---|---|
| **Product** | The one real product master record | Existing `product_id` remains the only product identity |
| **Workspace** | The editing and review surface for one real product | Always bound to one `product_id` |
| **Base template** | Shared menu, lifecycle, evidence, review, history, and English-first rules | Reusable across all product categories |
| **Category template** | Approved specification groups, modules, media roles, document types, and validation rules | Inherits the base template and has a version |
| **Model configuration** | The permitted structure selected for a specific model | Bound to `product_id` and the selected template version |
| **AI proposal** | A suggested value or module generated from sources | Must identify `product_id`, target field, source, and decision state |

This lets LITUBO build one dependable common workflow first. The template says **what needs to be prepared**; the specific product record says **what is actually true**.

### 7.3 Product creation flow

1. Administrator creates or selects one existing product record.
2. Administrator chooses **Industrial Equipment — Standard Product**.
3. The system creates a Draft Workspace structure for that same `product_id`.
4. Staff link existing media/documents, enter verified facts, or later request AI draft proposals.
5. Staff edit, accept, or reject proposed content.
6. Normal review and publishing controls remain in force.

### 7.4 Rules for individual customization

- A product may enable, sort, or configure only modules allowed by its selected template.
- A template upgrade must never silently rewrite an existing product. The administrator must review the proposed template change.
- New custom fields, parameter groups, or modules must record a reason and owner. If they will be reused, they become a new template version rather than repeated one-off structures.
- English is the first public/admin working language. ES/PT structure may be prepared, but an unreviewed AI translation is never treated as approved localized content.

### 7.5 Personalization after the common template works

Once the generic template is stable, LITUBO may add controlled category templates:

- Metal Detector Product
- X-ray Inspection Product
- Checkweigher Product
- Combination Inspection Product
- Conveyor & Reject System

Each category template inherits the common Workspace shell. It may add approved specification groups, required media roles, and content prompts, but it may not fork the core product data model or bypass review.

---

## 8. Data ownership and single source of truth

| Data | Canonical owner | Workspace responsibility |
|---|---|---|
| Product identity, category, code, lifecycle | Existing product record | Read and edit approved fields for the same `product_id` |
| Images, PDFs, videos, certificates | Media Library | Create/manage associations and presentation roles only |
| Public page modules | Product content model | Arrange and edit structured content; no raw-file duplication |
| Specifications | Product specification groups | Manage parameter, unit, value, note, and verification state |
| Related models/applications/accessories | Product relation records | Manage explicit relations |
| Internal source materials | Restricted evidence records / Media Library | Link, classify, verify, and cite; never expose automatically |
| Audit activity | Append-only history records | Display history; never allow manual history rewriting |

### Required rule

**One product model = one canonical `product_id` = one set of factual product data.** New Workspace tables, if later needed, must be associations or structured extensions keyed by `product_id`; they must not duplicate the product record.

---

## 9. Media, documents, and customer downloads

Media Library remains the single physical source of files. A Workspace item shows that an asset is linked to a product; it does not copy the file.

For every linked document, keep three independent controls:

| Dimension | Examples |
|---|---|
| **Lifecycle** | Draft, In review, Approved, Released, Archived |
| **Classification** | Public-ready, Internal, Restricted |
| **Delivery** | Public download, Contact-gated, Customer portal later, Internal only |

Do not label a file “Customer-only” until a real authenticated customer portal exists. In V1, an operating manual or data sheet can be Public download, Contact-gated, or Internal only according to an explicit rule.

---

## 10. AI-assisted product intake — later, controlled, and reviewable

AI is a future Workspace capability, not an automatic content publisher.

### 10.1 Inputs

- **Product images** are supplied separately. AI may suggest image role and alt text, but cannot infer unverified technical specifications from photos.
- **Technical and product sources** may include PDFs, Excel files, Word files, quotation sheets, existing public copy, scans, and manually entered notes.
- Every source remains traceable to its Media Library or restricted-evidence record.

### 10.2 Safe flow

```text
Select one product model
  → attach/select sources and images
  → extract text / tables
  → generate structured field proposals
  → show source citation, confidence, and conflicts
  → human accepts, edits, or rejects each proposal
  → save only to Draft
  → normal review and release
```

### 10.3 Non-negotiable AI rules

- AI never overwrites approved facts without a named human action.
- AI never auto-publishes, auto-sends, or auto-posts to social media.
- Unknown values are shown as **Needs confirmation**, never guessed.
- AI output must identify the source it used or say that no source was found.
- API keys and provider credentials remain server-side only; they are never displayed in the browser.
- The system must retain an audit record of proposal, reviewer decision, and final written values.

AI implementation begins only after the stable manual Workspace data contract is complete. Bulk spreadsheet import is a separate later module, not part of the first single-product AI workflow.

---

## 11. Visual masters and storage

The approved design images for this Workspace must be version-controlled as development references, not shipped as site assets.

### Target directory

```text
docs/design-reference/approved/admin-cms-product-workspace-v1/
```

It should contain a short `README.md` and finalized images such as:

```text
PW-VIS-01-OVERVIEW-D1440.png
PW-VIS-02-PAGE-CONTENT-D1440.png
PW-VIS-03-SPECIFICATIONS-D1440.png
PW-VIS-04-MEDIA-RESOURCES-D1440.png
PW-VIS-05-RELATIONS-D1440.png
PW-VIS-06-SEO-LOCALES-D1440.png
PW-VIS-07-SHARE-DISTRIBUTION-D1440.png
PW-VIS-08-SOURCES-EVIDENCE-D1440.png
PW-VIS-09-CHANGE-HISTORY-D1440.png
PW-AI-01-SOURCE-INTAKE-D1440.png
PW-AI-02-PROPOSAL-REVIEW-D1440.png
```

Mobile masters use the same stable ID with `-M375`, for example `PW-VIS-01-OVERVIEW-M375.png`.

Do **not** place these images in `public/`, `assets/`, Vue components, the runtime Media Library, `docs/design-reference/inbox/`, or the existing protected `CMS-AI-VISUAL-MASTER-V1/` package. The chat-generated images are drafts until the LITUBO owner explicitly approves them.

When a V1 image is accepted for implementation, it is frozen. A material redesign uses a new `...-v2/` folder and a new Conformance Register entry; it does not overwrite the V1 evidence.

---

## 12. Phased delivery order

| Phase | Deliverable | Gate |
|---|---|---|
| **PW-00** | Approved visual masters, route map, data/API contract, legacy-parallel rule | Definition of Ready passes |
| **PW-01** | Shared Workspace shell and Overview | Desktop + mobile visual acceptance |
| **PW-02** | Page content | Structured modules and legacy data compatibility verified |
| **PW-03** | Specifications | Units, validation, and non-fabrication rules verified |
| **PW-04** | Media & resources | Media linking and delivery controls verified |
| **PW-05** | Relations | Explicit associations and permissions verified |
| **PW-06** | SEO & locales, Sources & evidence, Change history | Restricted evidence and audit behavior verified |
| **Future PW-07** | Share & distribution | Public URL and manual sharing only; no auto-posting |
| **Future AI-01** | Single-product AI source intake and proposal review | Stable manual fields, source audit, and security design pass |

The exact numbering must be reconciled with the overall Admin CMS Blueprint before implementation. No phase may silently expand into an unapproved schema, permissions, or publishing project.

---

## 13. Definition of Ready before any Workspace code

All of the following must be true:

- The existing J-2 Product Center work is closed or explicitly isolated; no competing uncommitted task is touching the same pages.
- This child blueprint is approved and cross-referenced by the four governing documents.
- The specific visual master for the next screen is approved and registered with a stable image ID.
- The next screen has a confirmed route, data/API contract, field ownership, and English-first copy plan.
- Legacy behaviour for that route is documented: remain, read-only, or not touched.
- Required test cases and 1440px / 375px browser evidence are listed.
- No fake completeness, health, readiness, source, or customer-access value will be displayed when no configured rule exists.

---

## 14. Acceptance requirements for every implementation task

Each construction order must state:

1. the visual master ID and exact file path;
2. the route(s) and product state being exercised;
3. data fields, API response fields, permissions, and field ownership;
4. exact files allowed to change;
5. required tests, typecheck, lint, build, and `git diff --check`;
6. 1440px and 375px screenshots of ordinary pages only;
7. confirmation that legacy routes and protected design packages were not changed unless explicitly authorized.

Every visible administrator label, button, empty state, error, aria-label, and help text is English-first. Existing foreign-language source documents or product content are not silently translated or altered by a UI task.

---

## 15. Decisions deferred deliberately

The following are not decided by this blueprint and must not be guessed in code:

- the final customer portal and customer authentication model;
- social-platform credentials, automatic posting, and campaign analytics;
- bulk multi-product spreadsheet import;
- final AI provider selection, cost policy, quotas, and retention policy;
- category-specific template field lists until product-domain review;
- permission roles beyond the existing Administrator boundary.

---

## 16. Immediate next action

1. Perform a document-authority audit of the existing project files; do not delete files based on names alone.
2. Confirm this Blueprint as the child plan for the new Workspace.
3. Select and approve the final visual masters, then copy them into the approved Workspace visual folder using exact stable names.
4. Update the four governing documents with only the necessary cross-references.
5. Issue one documentation-only work order and commit it safely.
6. Only then issue the first code work order: **PW-00 / Workspace shell and Overview pilot**.

---

## 17. Governance closure — PW-GOV-01 (2026-09-07)

**Status:** This child blueprint is promoted from `Draft for approval and controlled implementation` to **`Approved governance baseline — controlled implementation remains gated`**. This closes only the *documentation-governance* gap recorded by the PW-PRE-00 audits; it authorizes no code, route, schema, API, product/category/media data, or AI feature.

### 17.1 Standing under the four governing documents

This remains a child blueprint. Where it conflicts with `CLAUDE.md`, `ADMIN-CMS-GOVERNING-CHARTER-V1.md`, `ADMIN-CMS-IMPLEMENTATION-BLUEPRINT-V1.md`, or `ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md`, those four win. It is now cross-referenced from the Register (§4.5, §4.6) and from the Implementation Blueprint (§6.3).

### 17.2 Visual masters frozen

All 11 images listed in §11 above are now **frozen** as the Product Workspace desktop (1440px) visual masters, registered as `PRIMARY` (desktop-only) in `ADMIN-CMS-VISUAL-DATA-CONFORMANCE-REGISTER-V1.md` §4.5. See that section for the full asset-to-module mapping, authority limits, and the explicit statement that this freeze decides visual hierarchy and desktop layout only — never data, permissions, publication, or AI write behaviour. **No `M375` mobile master exists for any of the 11 images**; each future implementation work order must supply its own mobile adaptation contract before 375px work begins, per the CF-3 principle in the Register. `PWS-00` is bounded to the shared Workspace shell (§5: global nav, workspace nav, main work area, context inspector, product header) plus the Overview tab (§6: product identity, product code, category, lifecycle state, short summary, review actions); it explicitly excludes complex page-module editing, which belongs to `PWS-01` Page Content.

### 17.3 PWS work-order numbering

Future Workspace implementation work orders use the `PWS-00`…`PWS-08` + `PWS-AI-01`/`PWS-AI-02` namespace fixed in Register §4.6, superseding both this document's own `PW-00`…`PW-07`+`AI-01` numbering (§12 above) and the Blueprint §6.1 `PW-00`…`PW-06` subdivision for addressing purposes. §12's phase content (what each phase delivers) is unchanged; only the address changes, per the mapping table in Register §4.6. This is a naming ruling only — no phase is implemented by this renumbering.

### 17.4 New Workspace and legacy editor coexist — route decision recorded, not built

The new Workspace reserves the route prefix `/admin/product-workspace/:id/...` (see §6 above for the per-tab paths, now understood as `PWS-*` addressed). The existing legacy editor keeps its routes at `/admin/products/:id/...` unchanged. Both surfaces read and write the same canonical `product_id`; no second product record, table, schema, page, component, media item, or route is created, deleted, migrated, or rewritten by this task. **This section records the routing decision only — no route file is created by PW-GOV-01.**

### 17.5 English-first

All Workspace administrator-facing UI remains English-first, consistent with §1 and Register §7. This governance task adds no UI and translates nothing.

### 17.6 AI intake principle (confirmed scope, no implementation)

Consistent with §10 above: AI addresses one selected product and its explicitly linked source materials only. The flow is Source Intake (`PWS-AI-01`) → field proposals carrying source, citation and confidence, including conflict flags → human Accept/Edit/Reject per field → accepted results are written to Draft only. AI may never fabricate facts, auto-publish, overwrite an already-confirmed field, or mix materials across products. This restates existing §10 rules against the now-frozen `PWS-AI-01`/`PWS-AI-02` visuals; it authorizes no AI code, provider, or credential.

### 17.7 Media Library remains the sole physical source

Consistent with §9 above and Blueprint §4: the global Media Library is the only source of truth for images, PDFs, videos and certificates. The Workspace may only manage associations, display roles and metadata; it may never copy a physical asset.

### 17.8 `PWS-00` — no code authorization

Freezing the 11 visual masters and fixing the `PWS-*` namespace does **not** authorize `PWS-00` (Workspace shell + Overview) code. Per Register §12.1i, `PW-00`'s Definition of Ready remains `NOT MET`: the completeness-rail gate (`CH-DG-11`/`BP-DG-02`) and the 375px mobile-contract gate (CF-3) are unresolved. A separate, complete Codex work order — naming route, data/API contract, field ownership, allowed files, and 1440px/375px acceptance criteria — is required before any `PWS-00` code begins.

### 17.9 J-2 status unaffected

This task does not touch, reference for reinterpretation, or change the status of J-2 (`PC-01`/`PC-02`). J-2's pixel-level visual sign-off and the `origin/master` lock remain exactly as recorded in the Register and `CURRENT-STATE.md` before this task began.
