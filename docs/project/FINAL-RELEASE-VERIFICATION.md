# Final Release Verification

> Module: FINAL-RELEASE-VERIFICATION-01 · 2026-09-18 · local development environment only.
> **Result: FINAL RELEASE VERIFICATION PASS — READY FOR REVIEW-BRANCH PUSH / GITHUB CI.**
> This is an independent verification of one frozen Release Candidate. It changed no runtime, no image, no
> permission, no database row, no business code and no UI: the only files it writes are governance records.
> It is **not** a production approval. Push, merge and deploy each still need their own authorization
> (`PROJECT-EXECUTION-PROTOCOL.md` §13), and the production-only human gates in §22 stay open.

---

## 1. Release Candidate

| Item | Value |
|---|---|
| RC baseline | **`da8f445`** — `docs(release): correct OIG grant terms and drop the ignored telemetry flag` |
| Frozen at | 2026-09-18, before any verification step ran |
| Preceding accepted state | Production Ready 01 COMPLETE · 02 PASS · 03 BASELINE COMPLETE · FINAL-RELEASE-SECURITY-REMEDIATION-01 PASS (Controller-accepted for `bb6c136`, plus the GOVERNANCE-FIX-01 commit `da8f445`) |
| Changes made to the RC during verification | **none** — no blocker was found, so no minimal fix was needed |

## 2. Repository / branch / HEAD

| Item | Value |
|---|---|
| Repository | `coffeebearchen/litubo-website` (local path `D:\LITUBO-website`) |
| Start branch | `review/final-release-security-remediation-01` |
| Start HEAD | `da8f4457b01121b70bf20127df43304ed2d59fb2` = expected `da8f445` |
| Verification branch | `review/final-release-verification-01`, created from `da8f445`, local only |
| `origin/master` | `8f2e384` — unchanged |
| Push / merge / deploy | **0 / 0 / 0** |

Tracked changes at start: 0. Untracked at start: exactly the six historical paths (`README-FIRST.md`,
`docs/design-reference/CMS-AI-VISUAL-MASTER-V1/`, `docs/design-reference/approved/admin-cms-product-workspace-v1/`,
`docs/design-reference/inbox/`, `docs/product-cms/CMS-AI-CONSTRUCTION-PACK-V1/`,
`docs/project/LITUBO_9C-2R_正式施工单.md`) — none of them touched.

## 3. Verification date and method

Carried out 2026-09-18 on the local development environment. Every governing document required by the work
order was read in full first: `CLAUDE.md`, `CURRENT-STATE.md` (11,476 lines, read completely through parallel
read-only sub-tasks as `PROJECT-EXECUTION-PROTOCOL.md` §9 step 4 allows), `MASTER-ROADMAP.md`, the execution
protocol, `RELEASE-SAFETY-GATES.md`, `SECURITY-REMEDIATION-REVIEW.md`,
`PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md`, both production runbooks, and the decision log (D-040 / D-041 /
D-042 in full).

No secret was read, printed or stored. Where a runtime value was needed, it was supplied to a process
(`node --env-file`, `psql` inside the container over its local socket) without being read; checks on
configuration are by **variable name and presence only**.

## 4. Runtime matrix

| Component | Declared | Running | Verifier | Result |
|---|---|---|---|---|
| Node | 22.22.2 (`.nvmrc`, `engines`) | 22.22.2 / npm 10.9.7 | `verify-node-runtime.mjs` | **OK** |
| Node — negative control | — | system PATH Node 24.14.0 | same | **exit 1, fail closed**; no later step ran |
| Directus | `directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869` | same digest, reports 12.3.1 | `verify-directus-pin.mjs` | **OK** |
| PostgreSQL | `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` | same digest, `server_version` 16.15 | `verify-postgres-pin.mjs` | **OK** |
| document-extractor | image rebuilt in SR-01 | `sha256:8d3d0639e317b9a3612547b69a267e5cb96a396f7f36eebbc363249d2123d617` in both containers | `docker inspect` | **matches the scanned image** |
| Compose | — | — | `docker compose config --quiet` | **exit 0** (no interpolated value printed) |

Container hardening read back from the running containers: extractor and gateway both `ReadonlyRootfs=true`,
`CapDrop=[ALL]`, PIDs 64 / 32, memory 512 MB / 96 MB. Directus restart count 0, PostgreSQL restart count 0,
0 Directus error lines in the last two hours.

No version was changed. Nothing was upgraded.

## 5. Git status

| Moment | Tracked | Untracked |
|---|---|---|
| Start | clean | the six historical paths |
| After verification, before commit | only this module's governance files | the same six, untouched |
| After commit | clean | the same six, untouched |

Staging was explicit (`git add -- <path> …`); `git add .` and `git add -A` were not used.

## 6. Release Safety Gates — RSG-01 … RSG-09

Status words follow `RELEASE-SAFETY-GATES.md` §0.3. "PASS" below means the gate held under this module's
evidence, for the local scope this module could observe; it does not convert an environment-level `OPEN` into
production proof.

| Gate | Result | Evidence from this module |
|---|---|---|
| **RSG-01 Draft never public** | **PASS** | Database: 4 products / 8 posts / 7 content items, **all draft**; 0 published rows of any kind. Production build: every draft detail URL answers 404 (`/products/x-ray-inspection/test`, `/products/conveyors-reject-systems/test-only-lt-180c-free-fall-metal-detector`, `/products/metal-detection/test-only-lt-180c-mixed-beta-01`, `/resources/insights/test-only-cc-imp-10-article`, `/resources/case-studies/test-only-cc-imp-10-case-study`, `/resources/insights/cc-imp-02-ui-create-2sxq57`). The 404 page does not leak the draft product's name. Published category page shows its empty state with 0 product cards; `/api/cms/posts` returns `{"posts":[]}`; `/resources` contains 0 occurrences of `TEST ONLY` / `[TEST]` / `NOT FOR PUBLICATION`. `sitemap.xml` contains 0 URLs. |
| **RSG-02 Single public eligibility contract** | **PASS (Content) · OPEN (Products, pre-existing)** | Detail, list, hub and sitemap all answered consistently: nothing published anywhere, nothing in the sitemap, no draft in any list. The Products-side gap registered in §4.3 of the gates file (four separately written `status = published` queries kept in sync by an equivalence test rather than one shared resolver) is unchanged by this module and stays `OPEN` with its existing owner. |
| **RSG-03 Human-only publish** | **PASS** | No publish action was performed by this module. The full suite (see §17) exercises the product lifecycle guard and the Content Center publish path, including that save, AI apply, readiness and scripts cannot publish. Public state is unchanged: 0 published rows before and after. |
| **RSG-04 AI applies to draft only** | **PASS (no bypass) · Content Golden Path still not live-proven** | Real provider calls in this module: **DeepSeek 0 · OpenAI 0 · cost 0**. The AI safety suites ran green. The historical fact stands and is not upgraded: the Content AI Golden Path has never been proven end-to-end live (RSG-04 Content stays `OPEN`, D-042 / R3). |
| **RSG-05 Locale independence, no fallback** | **PASS** | `/es/products` and `/pt/products` → 404; `/es` and `/pt` static pages render with `robots: noindex, follow`, no canonical and no hreflang — the documented locale architecture, not a content fallback. `/` carries a canonical and no robots restriction. |
| **RSG-06 Public media eligibility** | **PASS** | Through the production build's public media proxy: the one `is_public` file → 200; a non-public file → 404; a malformed id → 404; a well-formed but unknown UUID → 404. |
| **RSG-07 Permissions fail closed** | **PASS** | All three tracked artifacts verify: `directus_access_verify: OK`, `directus_permissions_verify: OK`, `directus_permissions_legacy_verify: OK`. 19 permission rows, 2 roles, 3 policies, 3 access rows, **0 public-policy business permissions**. Anonymous Directus: `/server/ping` and `/server/info` 200; items of every business collection, `/files`, `/settings`, `/license`, `/server/health` 403; `/users/me` 401; `/mcp`, `/ai/chat`, `/utils/hash/generate`, `/websocket` 404. Through the application: `/api/admin/*` → 401 without a session, `/admin/*` pages → 302 to the login page. |
| **RSG-08 Environment separation** | **PASS for this module · environment items remain OPEN** | Everything ran locally; production was never contacted. `release:check-test-data` → **PASS** (no published TEST data). No production value, DNS, firewall or infrastructure was touched. The environment-level items (production capacity, offsite backup storage, written production rollback, production secret manager, production network verification) stay `OPEN` and are listed in §23. |
| **RSG-09 Release layering** | **PASS** | One local commit on a local branch. push 0 · merge 0 · deploy 0. Local HEAD, checkpoint branch and `origin/master` are listed separately in §2 and §24. |

**P0 violations: NONE.**

## 7. Permissions and access

| Check | Result |
|---|---|
| `nuxt-server` permissions = expected | 19 rows; all three `.verify.sql` artifacts print their `OK` line |
| Public business permissions | **0** |
| Directus service identity | one `nuxt-server` role, one `site-readonly-policy`, one access link, one credential-free service user holding its static token (presence only — the value was never read) |
| Anonymous Directus business access | fail closed (403 on every business collection, `/files`, `/settings`, `/license`) |
| Published public read | no published record exists; published **categories** are served (5) and their product lists are correctly empty |
| Draft public read | denied — 404 on every draft detail route |
| Admin routes require admin auth | `/api/admin/*` 401, `/admin/*` 302 → `/admin/login` |
| Protected media fail closed | non-public / malformed / unknown file → 404 |
| Custom permission rules under OIG | in force: `/server/info` reports `license.source = env`, `production_enabled true`, `display_powered_by "OIG"`, and the 19 custom-rule rows resolve (public CMS reads succeed) |

No permission structure was modified.

## 8. Product V1

| Rule | Result |
|---|---|
| Draft editable, review / published / archived read-only | unchanged and exercised by the full suite (`assertProductDraftForMutation` guard on every product write route) |
| Published must return to draft before editing | unchanged; no published product exists to exercise live |
| Publish is human-only | no publish was performed; state before = state after |
| AI Generate / Apply — draft only | unchanged; 0 provider calls this module |
| `PRODUCT_AI_APPLY_ENABLED` | production default stays closed (absent ⇒ Apply refused); not altered |
| Workspace surfaces | Product Center (4 draft products, counts 4 / 0 / 0 / 0), Product Workspace with its six sections (基础信息 / 页面模块 / 技术参数 / 图片与资料 / 产品 FAQ / SEO), Save and 提交审核 present, product media thumbnails load |

Frozen modules (Relations, Share, Change History beyond what V1 ships) were not reopened.

## 9. Content Center

| Rule | Result |
|---|---|
| `content_items` / `content_item_locales` / `content_items_files` / `content_relations` | present; 7 items, 9 locale rows, 5 file links, **0 published snapshots** |
| Locale independence, no fallback | verified over HTTP (§6 RSG-05) |
| Draft independence / snapshot independence / restore clears snapshot | exercised by the real-PostgreSQL integration suites in the full run |
| AI applies to draft only; publish human-only | unchanged; no publish, no AI call |
| Negative paths (draft not public, missing locale not substituted, news never public, AI cannot publish) | all confirmed: draft content URLs 404, `/resources/news/…` 404, no locale substitution, no AI write |

Content Center admin list renders 7 rows, every one `Draft`.

## 10. Media Library

| Check | Result |
|---|---|
| Single business media entry point | unchanged — products, Content Center and settings reference media by id only |
| Folder tree and protected folders | render correctly (Applications / Company / Home / Products / Resources + Protected folders) |
| Preview and image transform | 10 of 10 thumbnails load through `/api/admin/media/<id>?width=240&height=180&fit=cover`; **0 broken images** |
| Public media rules | `is_public` → 200; non-public / archived / unknown / malformed → 404 |
| Byte-signature upload validation (SR-01) | intact: the upload route still verifies declared image bytes; its 13 tests pass in the full run. No file was uploaded by this module |
| Archived media | 18 of 20 lifecycle rows archived; archived files stay out of public output |

## 11. Public website truth

Measured against the **production build** (`.output/server/index.mjs`, Node 22.22.2, bound to 127.0.0.1 only):

```text
/                                  200      /products                          200
/products/x-ray-inspection         200      /products/metal-detection          200
/resources                         200      /support                           200
/support/faq                       200      /company/about                     200
/contact                           200      /nonexistent-page-xyz              404
draft product URLs (3)             404      draft content URLs (3)             404
/resources/news/<slug>             404      /es/products, /pt/products         404
/sitemap.xml                       200 (0 URLs)   /robots.txt                   200
/admin/login                       200      /admin/products, /admin/media      302 → /admin/login
/api/admin/* (4 routes)            401      /api/cms/* (4 routes)              200
```

Unexpected 401 = 0 · unexpected 403 = 0 · unexpected 503 = 0 · unexpected 5xx = 0. Every 401 / 403 / 404 above
is the documented, expected answer. Public payloads carry allowlisted keys only (categories expose
`id, slug, title, intro, heroMedia, seo, order` — no status, no internal ids, no working-copy fields).

## 12. Forms

Safety and regression only; **nothing was submitted**.

- `/contact` renders its 7 fields and a single `Send message` action.
- The shared public inquiry pipeline (64 KB body cap, shared rate bucket, honeypot, `consent === true`,
  locale allowlist, explicit field allowlist, storage failure → 503) is unchanged and its tests pass in the
  full run.
- No email was sent, no HubSpot request was made, no external call of any kind was issued.

## 13. AI safety

| Item | Result |
|---|---|
| Real provider calls this module | **DeepSeek 0 · OpenAI 0 · cost 0** |
| Content AI chain | Sources → extraction → proposal → human review → apply to draft — unchanged; no bypass path exists to publish |
| Product AI | Generate and Apply remain draft-only and server-authoritative |
| Auto publish / overwrite published / bypass human review | none possible; none attempted |
| Content AI Golden Path | **still not proven live** — recorded honestly, not upgraded (RSG-04 Content stays `OPEN`) |

## 14. Secrets

Checked by name and structure only; no value was read.

| Check | Result |
|---|---|
| `nuxt.config.ts` `runtimeConfig` | declares no server secret — only hosts, ports, modes, model names, e-mail addresses |
| Server bundle | each of `DIRECTUS_TOKEN`, `SMTP_PASS`, `SUBMISSION_IP_SECRET`, `HUBSPOT_ACCESS_TOKEN`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` appears exactly once, as a run-time `process.env.<NAME>` read |
| Client bundle (`.output/public`) | **0** occurrences of any of those names, and 0 occurrences of `DIRECTUS_LICENSE_KEY` / `LICENSE_KEY` |
| Directus address in client bundle | **0** occurrences of `8055` or `directusUrl` |
| Tracked files | the license-key guard test (checksum-valid key in any tracked file) passes |
| This module's own handling | the built server received its environment through `node --env-file`; no value was printed, logged or copied |

## 15. Security baseline

This module did **not** repeat the remediation. It confirmed the accepted contract has not regressed:

| Item | Accepted in SR-01 (D-042) | Verified now |
|---|---|---|
| Directus image | `12.3.1@sha256:8978edf6…`, 0 Critical / 18 High (all classified) | same digest running and declared |
| PostgreSQL image | `16.15-alpine@sha256:cf78e766…`, 1 Critical / 30 High (all NON-REACHABLE) | same digest running and declared |
| document-extractor image | rebuilt without npm / npx / corepack, 13 Critical / 167 High (all NON-REACHABLE) | `sha256:8d3d0639…` running in both containers |
| Hardening | websockets, cache, TUS, GraphQL introspection, MCP, AI, owner registration off; marketplace at its most restrictive value; no `TELEMETRY` value declared | anonymous surface re-measured and identical (§7) |
| **BLOCKING / UNKNOWN** | 0 / 0 | **0 / 0** |

Because the three images are byte-identical to the ones that were scanned and classified, the classification
carries over unchanged. No new scan was run: a scan against a newer vulnerability database would move the
point-in-time record without changing this RC, and the work order forbids reopening the remediation. Ongoing
CVE monitoring stays an open production operation (§23).

## 16. Backup and restore

`verifyBackupSet` was re-run on the two most recent sets; both pass every check (components present, names
valid, `SHA256SUMS` agrees, both component checksums match, manifest schema valid).

| Field | `litubo-backup-20260917-153808` (post-upgrade) |
|---|---|
| Directus recorded | 12.3.1, digest `sha256:8978edf6…` |
| PostgreSQL / pg_dump | 16.15 / 16.15 |
| Node | 22.22.2 |
| `database.dump` | 271,508 B, 392 TOC entries, SHA-256 `b3b310c7…` |
| Fingerprint | 53 tables, 27 sequences, schema hash `360c78b6…` |
| `uploads.tar` | 7,290,880 B ustar, 129 files / 7,189,583 B, SHA-256 `89a23195…` |

`litubo-backup-20260917-153058` (the set taken immediately before the upgrade, i.e. the upgrade's rollback)
also verifies OK. No restore was performed, no database was created or dropped, no volume was removed and no
development data was overwritten.

## 17. Tests

Run on Node 22.22.2 with the real PostgreSQL and the real document-extractor container enabled
(`CONTENT_DB_TEST_CONTAINER`, `DOCUMENT_EXTRACTOR_TEST_URL`, `DOCUMENT_EXTRACTOR_TEST_CONTAINER`).

| Run | Files | Tests | Result |
|---|---|---|---|
| Default (integration suites skipped) | 87 passed, 8 skipped (95) | 3075 passed, 167 skipped | exit 0 |
| Integration enabled, **file-parallel** | 90 passed, 5 failed (95) | 3232 passed, 10 failed | see finding F-1 |
| Integration enabled, **serial** (`--fileParallelism=false`) | **95 passed (95)** | **3242 passed, 0 failed, 0 skipped** | **exit 0** |

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors |
| `npm run release:verify` | **exit 0** — Node gate → Directus pin → PostgreSQL pin → published TEST data → build |
| `npm run release:check-test-data` | **PASS** — no published TEST data in posts, products, product_categories, content_item_locales |
| `git diff --check` | exit 0 |
| Permission verifications (3) | all `OK` |
| Pin verifications (3) | all `OK` |
| Backup verification | both recent sets `OK` |

**Finding F-1 — test infrastructure, not a product defect, not introduced here.** With the database
integration suites enabled and vitest's default file parallelism, `tests/releaseTestDataCheck.test.ts` fails
10 assertions. Its cleanup assertion counts **all** negative-id rows across five shared tables, so while
another integration suite legitimately holds its own negative-id fixtures the global count is not 0. Run
serially, every one of those tests passes. This matches the requirement already recorded in `CURRENT-STATE.md`
that the full suite be validated serially. Nothing in the product is affected; no fix was made, because a fix
would be test-infrastructure work outside this module's scope.

## 18. Build

`npm run release:verify` produced the production build on Node 22.22.2: **8.26 MB total, 2.06 MB gzip**,
build exit 0.

| Artifact check | Result |
|---|---|
| Server output | `.output/server`, 1,118 files |
| Client output | `.output/public`, 466 files |
| `.env*`, database dumps, `uploads.tar`, `SHA256SUMS`, Trivy JSON, `backups/`, scratch paths inside `.output` | **none** |
| Untracked design / construction-pack folders inside `.output` | **none** |
| Secret names in the client bundle | **0** (§14) |
| Directus address in the client bundle | **0** |

## 19. HTTP smoke

See §11 — GET only, loopback only, no cookies, no credentials, no writes. Unexpected 401 / 403 / 503 / 5xx: 0.

## 20. Browser — 1440 px

Public pages were checked against the production build; admin pages against the development server, where the
administrator session already existed (the administrator logged in once, in the preceding module; this module
requested no credential and typed none).

| Page | Result |
|---|---|
| `/` · `/products` · `/products/x-ray-inspection` · `/resources` · `/contact` · 404 page | `scrollWidth` 1425 ≤ 1440, 0 overflowing nodes, 0 broken images, data renders |
| `/products/x-ray-inspection` | empty state "Product information is being prepared" with 0 product cards |
| draft product URL | renders the 404 page and does not leak the draft product's name |
| Admin: Product Center · Content Center · Settings · Product Workspace · Media Library | no horizontal overflow, 0 broken images, 10 of 10 media thumbnails load, Settings shows no secret value |

Screenshots at 1440 px are illegible in this pane (the pane is ~334 CSS px wide, so a 1440 viewport is drawn
at about 0.23×). As in previous modules, 1440 evidence is DOM geometry measured in the page, recorded here as
a tooling limitation, not a product finding.

## 21. Browser — 375 px

| Page | `scrollWidth` / `innerWidth` | Overflowing nodes |
|---|---|---|
| `/` | 375 / 375 | 0 |
| `/products` | 375 / 375 | 0 |
| `/products/metal-detection` | 375 / 375 | 0 |
| `/resources` | 375 / 375 | 0 |
| Admin Product Center | 375 / 375 | 0 |
| Admin Product Workspace | 375 / 375 | 0 (section tabs collapse into a select) |
| Admin Media Library | 375 / 375 | 0, 0 broken images |

Legible 375 px screenshots were captured for the public home page, the public products list and the admin
Media Library. No layout break and no unreachable control was found. Nothing was redesigned.

**Console.** In a tab opened fresh after the build, across six admin pages and every public page: **0 errors,
0 warnings** — only Vite's HMR debug lines and Vue's `<Suspense>` experimental notice. The single console
error on the public tab is the deliberate 404 probe of a draft URL.

**Finding F-2 — development tooling, not a product defect, pre-existing and documented.** Running `nuxt build`
(inside `release:verify`) while a `nuxt dev` server is live rewrites `.nuxt` underneath it; that dev server
then reports the known `#app-manifest` pre-transform error and a long-lived admin tab logs `/_nuxt/…` 503s for
the affected assets. Directus and PostgreSQL were not involved: 0 restarts, 0 Directus error lines, and the
Nuxt server log contains no 503. A tab opened after the build is completely clean, and all media loads. This
is the same dev-only artifact already recorded in `CURRENT-STATE.md`; no code was changed.

## 22. License and human gates

Reported as facts. No legal judgement is made here.

| Gate | Owner | Fact |
|---|---|---|
| Directus OIG licence | business owner | Directus 12.3.1 is MSCL-1.0-GPL and runs on an Open Innovation Grant key the business owner obtained. They confirmed the revenue / headcount conditions themselves, read and submitted the application themselves, and Directus issued the key. The grant is **granted in perpetuity, with no expiration date and no renewal process**; each key carries **5 activations** (net usage today: 1, the development instance) |
| Telemetry | business owner | **OIG entitlement requires telemetry; telemetry opt-out is not available under the current OIG tier.** `docker-compose.yml` therefore declares no `TELEMETRY` value at all, and records why |
| Poppler (GPL), libvips (LGPL-2.1), util-linux (mixed) | human review | unchanged pre-production human review |
| PostgreSQL | — | resolved: PostgreSQL License |

Per the work order, a documented production-only human gate does not by itself prevent a verification PASS —
but it is never presented as a technical pass, and it must be closed before Production Preflight.

## 23. Open items (carried forward, none blocking this RC locally)

- Controller review of `FINAL-RELEASE-SECURITY-REMEDIATION-01` — the pre-release security blocker is closed on
  evidence but only the Controller can mark it closed.
- Production capacity (server CPU / memory, behaviour behind Cloudflare / Nginx / TLS, published-content load).
- Production network exposure of Directus and the extractor — proven in the repository, to be verified at
  deploy time by the provisioning runbook's checks.
- Production / offsite backup storage, retention, encryption at rest, scheduling; RPO / RTO to be confirmed.
- Written production rollback / cut-over procedure (the restore tool restores into TEST targets only).
- Production secret manager and its injection mechanism.
- Ongoing CVE and advisory monitoring (this and the security review are point-in-time records).
- Products-side RSG-01 / RSG-02 (no revision draft; four parallel published-status queries) — pre-existing,
  owned by the product publication workflow module.
- Content AI Golden Path never proven live (RSG-04 Content `OPEN`).
- Finding F-1 (serial full-suite requirement) and Finding F-2 (dev-server `#app-manifest` after a build) —
  both test / tooling only.
- Product 4 (`test sample`, slug `test`) carries no explicit TEST marker, so the release guard cannot see it.
  It is draft and not public; labelling or archiving it needs separate authorization.

## 24. Final result

```text
FINAL RELEASE VERIFICATION PASS — READY FOR REVIEW-BRANCH PUSH / GITHUB CI

full tests            PASS  (95 files / 3242 tests, serial, 0 failed, 0 skipped)
typecheck             PASS  (0 errors)
lint                  PASS  (0 errors)
release:verify        PASS  (exit 0)
build                 PASS  (8.26 MB / 2.06 MB gzip)
permission checks     PASS  (3 artifacts OK, public business permissions 0)
draft public leakage  0
public truth          consistent
AI publish bypass     0     (real provider calls 0)
secret leakage        0
security BLOCKING     0
security UNKNOWN      0
backup contract       PASS  (2 sets verified)
data integrity        PASS  (identical before and after the full suite)
HTTP smoke            PASS  (no unexpected 401 / 403 / 503 / 5xx)
1440 px               PASS
375 px                PASS
tracked clean         yes
push / merge / deploy 0 / 0 / 0

Production release:   NOT APPROVED
Production Preflight: NOT STARTED — human gates in §22 must close first
```

*Written 2026-09-18 by Claude Code in FINAL-RELEASE-VERIFICATION-01. Nothing in this document is a production
approval, a legal conclusion, or evidence about any environment other than the local development environment.*

---

## 25. Addendum — review branch push and GitHub CI

> Added by the later module **FINAL-RELEASE-REVIEW-BRANCH-CI-01** (2026-09-18, A3 · PUSH_REVIEW_BRANCH,
> separately authorized by the Controller). Sections 1–24 above are left exactly as written: within
> FINAL-RELEASE-VERIFICATION-01's own scope, push / merge / deploy were genuinely 0 / 0 / 0. This addendum records
> what happened **after** that module closed, so §2 and §24 are read against the current facts.

The verification branch was pushed to `origin` unchanged — no commit was added, amended or rebased, and the
release candidate is byte-identical to the one verified above.

| Item | Value |
|---|---|
| Remote branch | `origin/review/final-release-verification-01` |
| Remote SHA | `be1df5a712a1c11c75e25de5edc7d07046976083` — equal to the local HEAD verified in §2 |
| `origin/master` | `8f2e3847e0d7acda1bd987ffd18c3af03377fef9` — **unchanged, not merged** |
| Workflow | `CI` (`.github/workflows/ci.yml`), permissions `contents: read`, no secrets, no deploy |
| Run ID | **`35291162888`**, event `push`, status `completed`, conclusion **`success`** |
| Job | `105434083787` — "Tests, types, lint, build (Node 22.22.2)" — **success** |
| Steps | checkout · Node 22.22.2 · `npm ci` · Nuxt prepare · tests · typecheck · lint · production build — all success |
| push / force push / master push / PR / merge / deploy | 1 / 0 / 0 / 0 / **0** / **0** |

**CI test scope — recorded honestly.** GitHub CI ran **87 files passed, 8 skipped; 3075 tests passed, 167
skipped**. The skipped suites are the ones that need a local PostgreSQL and the document-extractor container; a
GitHub runner has neither, so they self-skip through their existing `describe.skipIf` guards. The green CI run
therefore **does not** cover them. Their real evidence is the local serial full run recorded in §17 —
**95 files / 3242 tests / 0 failed / 0 skipped**. The two results are complementary: CI's 87 / 3075 is not the
full suite, and the local 95 / 3242 is not CI-verified.

**Finding F-1 did not trigger in CI** and no workflow change was needed: `ci.yml` declares no `env:` at all, so
`CONTENT_DB_TEST_CONTAINER` is never set and the parallel-fixture interference is structurally impossible there.
No test, assertion, timeout or workflow was modified.

**Evidence provenance.** The session that performed the push had no read-only channel to GitHub Actions — the
repository is private (unauthenticated API 404 against a public control of 200), `gh` was not installed, the
Chrome extension was not connected, the isolated browser pane was not signed in, and reading any token is
forbidden. The run and job facts above were therefore obtained independently by the Controller through their own
connected GitHub account and transcribed here. They were not inferred from a badge or from the workflow file.

**Unchanged by this addendum:** production release stays **NOT APPROVED**, Production Preflight stays **NOT
STARTED**, every human gate in §22 stays open, and every item in §23 stays open. A green CI run proves the build,
types, lint and the CI-scoped tests on a clean checkout — it is not a production approval.

*Addendum written 2026-09-18 by Claude Code in FINAL-RELEASE-REVIEW-BRANCH-CI-01.*
