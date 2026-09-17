# Security Remediation Review

> Module: FINAL-RELEASE-SECURITY-REMEDIATION-01 · 2026-09-17 to 2026-09-18 · local development environment.
> **Result: SECURITY REMEDIATION COMPLETE — READY FOR CONTROLLER REVIEW.** BLOCKING = 0, UNKNOWN SECURITY
> EXPOSURE = 0. Every Critical and High finding left in the three runtime images is FIXED, MITIGATED or
> NON-REACHABLE, with the evidence recorded below (D-042).
> Final Release Verification: **NOT STARTED**. Production release: **NOT APPROVED**. Nothing here is a legal
> conclusion or an eligibility assessment.
>
> History:
> - The module first stopped at the Directus 12 license decision (81f3fd9).
> - The business owner then obtained an Open Innovation Grant (OIG) license key, and the key was wired into the
>   runtime secret path (4e72a57).
> - This revision records the upgrade, the hardening, the mitigations and the classification.
>
> The key's value was never read, printed or recorded; nor was any other secret.

---

## 1. Outcome

| Area | Before | After |
|---|---|---|
| Directus | 11.17.4 — 21 official advisories apply: 4 BLOCKING, 5 BLOCKING / TO VERIFY, 12 mitigated or not applicable | **12.3.1** — all 21 **FIXED** by version (§2), plus explicit attack-surface hardening (§3.6) |
| Directus image, unique Critical / High | 4 / 117 | **0 / 18** — all classified (§5.1) |
| PostgreSQL 16.15 image, unique Critical / High | 1 / 30 | 1 / 30 — no newer 16.x image exists upstream; all NON-REACHABLE (§5.2) |
| document-extractor image, unique Critical / High | 14 / 177 | **13 / 167** — the npm CLI findings (1 Critical, 10 High) FIXED by removing npm, npx and corepack; the rest NON-REACHABLE (§5.3) |
| Directus production network exposure | TO VERIFY | internal-only by design, enforced in the repository; deploy-time verification in the runbooks (§4) |
| BLOCKING / UNKNOWN | 11 / several | **0 / 0** |

Scanner: Trivy 0.74.0 (the PR03 checksum-verified binary), vulnerability DB v2 updated 2026-09-17 07:06:17 UTC. The
"before" column was rescanned with that same DB: the Directus 11.17.4 and PostgreSQL counts equal PR03's, and the
extractor has one more High than PR03 recorded (a newer DB entry). Counts are unique (CVE, package, installed
version). Raw scan JSON stays in the session scratch directory and is not committed.

---

## 2. Official advisory matrix — Directus 11.17.4 → 12.3.1

**Source.** The directus/directus repository security advisories (GitHub REST API, 78 published) and release list,
fetched 2026-09-17. An advisory applies to 11.17.4 when its affected range includes 11.17.4 and none of its
patched versions is at or below 11.17.4.

**Minimum secure version: 12.3.1** (released 2026-08-25, also the latest release). It is the lowest release at or
above every first fixed version below; 12.2.0 fixes 19 of the 21.

**Post-remediation status.** Each advisory is FIXED because the pinned version is at or above its first fixed
version. The hardening column records settings that additionally close the feature, where one exists.

| # | Advisory | Sev. | Fixed in | Trigger | Exposure before | Status after | Additional hardening in 12.3.1 |
|---|---|---|---|---|---|---|---|
| 1 | GHSA-97xr-jchp-xm3c | critical | 12.1.0 | Public WebSocket client after a failed auth message | WebSockets off | **FIXED** | `WEBSOCKETS_ENABLED: "false"`; `/websocket` 404 |
| 2 | GHSA-c6w9-5g5j-jh2p · CVE-2026-61836 | high | 12.0.0 | Cache key not segmented by authorization | Cache off; 0 shares | **FIXED** | `CACHE_ENABLED: "false"` |
| 3 | GHSA-j5h6-vqc3-phqh · CVE-2026-61835 | high | 12.0.0 | File-import SSRF via `0.0.0.0` | Admin-gated; LITUBO never calls `/files/import` | **FIXED** | anonymous `/files/import` 403 |
| 4 | GHSA-3742-46gx-c8cc | high | 12.1.0 | TUS upload path validation | TUS off | **FIXED** | `TUS_ENABLED: "false"` |
| 5 | GHSA-xjxq-pj7h-g676 | high | 12.1.0 | TUS authorization bypass | TUS off | **FIXED** | `TUS_ENABLED: "false"` |
| 6 | GHSA-chfm-g7r3-vv42 · CVE-2026-10716 | high | 12.1.0 | PostGIS geometry SQL injection | PostGIS not installed | **FIXED** | — |
| 7 | GHSA-g293-vf99-xv36 | high | 12.1.0 | Anonymous alias amplification on system GraphQL | Unauthenticated | **FIXED** | `GRAPHQL_INTROSPECTION: "false"` |
| 8 | GHSA-mww8-4gwh-rjfw | high | 12.1.0 | WebSocket origin hijacking | WebSockets off | **FIXED** | `WEBSOCKETS_ENABLED: "false"` |
| 9 | GHSA-xw72-c69j-h2rj | high | 12.1.0 | Unauthenticated Argon2 hash utility DoS | Unauthenticated | **FIXED** | `/utils/hash/*` removed in 12.1.0 (404 measured) |
| 10 | GHSA-4jw7-6mqj-vrhq | high | 12.2.0 | AI chat file-download SSRF | No LLM provider | **FIXED** | `AI_ENABLED: "false"`; `/ai/*` 404 |
| 11 | GHSA-7vcx-mhxq-9j96 | high | 12.2.0 | Image-transform target dimensions DoS | Admin-gated | **FIXED** | `ASSETS_TRANSFORM_IMAGE_MAX_OUTPUT_DIMENSION` default 6000 |
| 12 | GHSA-gwvv-rr68-cmv6 | high | 12.2.0 | `deep` prototype-pollution persistent DoS | Unauthenticated | **FIXED** | Nuxt forwards no `deep` |
| 13 | GHSA-5h38-6755-g83w | medium | 12.1.0 | Mail-template path traversal (LiquidJS RCE chain) | Admin-gated | **FIXED** | liquidjs 10.27.2 in the image |
| 14 | GHSA-6hpw-rhhq-6xq3 | medium | 12.1.0 | `/settings/owner` side effects before authorization | Unauthenticated | **FIXED** | `PROJECT_OWNER_ENABLED: "false"`; anonymous 403 |
| 15 | GHSA-788p-cvgf-q973 | medium | 12.1.0 | Stored XSS through the project colour | Admin-gated | **FIXED** | — |
| 16 | GHSA-ff8w-8crv-9rcf | medium | 12.1.0 | Unbounded GraphQL documents over WebSocket | WebSockets off | **FIXED** | `WEBSOCKETS_ENABLED: "false"` |
| 17 | GHSA-p623-wgx3-wxp8 | medium | 12.1.0 | Side effects applied before permission checks | Not proven | **FIXED** | — |
| 18 | GHSA-fq27-7m2r-q6vm | medium | 12.2.0 | Manual-trigger Flows run unauthenticated | 0 Flows | **FIXED** | anonymous `/flows/trigger/*` 403 |
| 19 | GHSA-r9xq-xp38-j4j3 | medium | 12.2.0 | Settings readable by minimal app-access users | No non-admin app-access policy | **FIXED** | — |
| 20 | GHSA-7h45-q5jx-7r87 | medium | 12.3.1 | Share update reassigns `user_created` / role | 0 shares | **FIXED** | — |
| 21 | GHSA-8xp8-xrh2-88vr | medium | 12.3.1 | Registration e-mail on MySQL / MariaDB | PostgreSQL; registration off | **FIXED** | `public_registration = false` |

**Container Criticals of 11.17.4 (PR03).**
- CVE-2026-45618 in liquidjs 10.25.7 is FIXED: the 12.3.1 image ships liquidjs 10.27.2 (fixed ≥ 10.26.0).
- CVE-2026-59873 in tar 7.5.13 is FIXED: the image ships tar 7.5.22 (fixed ≥ 7.5.19).
- The npm CLI's tar and esbuild's Go stdlib are gone from the 12.3.1 image, which has no npm, npx or corepack and 0 Critical findings.

---

## 3. Directus 12.3.1

### 3.1 Image evidence

| Fact | Value |
|---|---|
| Pin | `directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869` — the OCI index digest from `docker buildx imagetools inspect`; linux/amd64 and linux/arm64 manifests |
| Pulled image | RepoDigest equals the pin; created 2026-08-25T16:40:26Z |
| Versions inside | `directus` 12.3.1, `@directus/api` 39.1.0, `@directus/license` 0.4.0, `@directus/env` 6.2.2; Node v22.23.2; Alpine 3.24.1 |
| Package managers | `npm`, `npx`, `corepack` absent; `pm2` present (the image's supervisor) |
| License file | `/directus/license` SHA-256 `f209dfa60e56b29f6e8e5cefde91dec4ce86f12289209ede63520556385d555d` — identical to the upstream v12.3.1 tag (Monospace Sustainable Core License 1.0, MSCL-1.0-GPL); `@directus/api` declares "SEE LICENSE IN license" |
| Fixed libraries | liquidjs 10.27.2, tar 7.5.22 |

### 3.2 License, entitlements and enforcement

**License text** (unchanged from 81f3fd9): v11.17.4 was BUSL-1.1, and v12.0.0 / v12.3.1 are MSCL-1.0-GPL. Paraphrased,
not interpreted, MSCL-1.0-GPL:
- permits use for any purpose except a "Competing Use";
- forbids circumventing the license-key functionality;
- grants GPL-3.0 on the fourth anniversary of each release.

**Measured OIG entitlements.** `GET /license` as an administrator on two disposable instances (§3.8, §3.10) reported:
- license "Open Innovation Grant", status `active`, source `env`;
- seats, collections, Flows and activity / revision history all unlimited;
- `custom_permission_rules_enabled`, `sso_enabled`, `custom_llms_enabled`, `ai_translations_enabled` and
  `production_enabled` all true, `offline_enabled` false, **`telemetry_required` true**.

The development instance's public `/server/info` reports license source `env`, `production_enabled` true and
`display_powered_by` "OIG". No administrator token was created on the development database, so `GET /license` was
not called there.

**Enforcement, read from the 12.3.1 source and measured.**
- `PermissionsService.readByQuery` drops every custom-rule permission unless `custom_permission_rules_enabled` is
  entitled. All 19 `nuxt-server` rows carry field lists, and 15 carry item filters.
- The license status becomes `locked` only through seats, collections, Flows or SSO: those are the only
  entitlements with a registered resolver (`api/src/license/entitlements/manager.ts`). Custom permission rules and
  custom LLMs have validators but no resolvers, so they never lock an instance.
- **Correction.** 81f3fd9 stated that a freshly provisioned instance using custom permission rules would be locked
  at once. That was inaccurate and is withdrawn. Measured on a Core-tier (unlicensed) 12.3.1 instance with
  LITUBO's usage:
  - status `active`, not locked;
  - every `nuxt-server` request to Directus refused with 403;
  - the Nuxt production build's categories, products, Content Center, media and sitemap endpoints answering 503
    (fail closed), while the site settings fell back to their defaults.

  With the OIG license the same build served everything identically to 11.17.4 (§3.12).
- `LICENSE_KEY` (project variable `DIRECTUS_LICENSE_KEY`): with no license stored, the first Directus process
  started with it activates against `https://licensing.directus.com`. The activation binds the project and
  `PUBLIC_URL`, and Directus stores the key and the returned token in `directus_settings`. A failed activation or
  update exits the process; a failed refresh of an activated key is logged. An environment-managed license cannot
  be changed or deactivated through the API.

### 3.3 Activations used by this module

The OIG key has 5 activations. Deactivation is the only release; a stranded one needs Directus support.

| Instance | Project / URL | Activation | Released |
|---|---|---|---|
| R1 upgrade rehearsal (restored development data) | development project, development `PUBLIC_URL` | activated at start | **yes**: restart with `LICENSE_KEY` empty (source `settings`), `DELETE /license` 204, `source: null`, key and token cleared |
| R2 fresh provisioning rehearsal | new project, development `PUBLIC_URL` | activated during provisioning step `10` | **yes**, same procedure |
| B3 restore rehearsal (§3.11) | copy of the development project and URL | none new: `LICENSE_KEY` empty, restored license revalidated | not deactivated, by design (it shares the development binding) |
| Development instance | development project and URL | active (source `env`) | in use |

Net activations in use after the module: **1** (development).

### 3.4 Breaking changes checked against LITUBO

| 12.x change | LITUBO finding |
|---|---|
| License enforcement (12.0.0) | handled by the OIG key (§3.2) |
| `IP_TRUST_PROXY` default `false` | Directus sits behind no proxy; the Nuxt server forwards no client-IP header to Directus. Its login rate limit and inquiry limiter read `x-forwarded-for` on the Nuxt side |
| Unauthenticated `/server/health` → 403 | documentation updated to use `/server/ping` for liveness (ADMIN-CMS-SETUP, both runbooks) |
| npm / npx removed from the image (12.1.0) | `scripts/provision-directus.mjs` now starts the CLI as `node cli.js`; CLAUDE.md and ADMIN-CMS-SETUP commands updated |
| `/utils/hash/*` removed | unused by LITUBO |
| Draft publishing for versioned collections | no collection has `versioning: true` |
| WYSIWYG rebuilt on Tiptap | three `input-rich-text-html` fields; affects Studio editing only, where unsupported markup is normalized on save |
| App Access minimal settings permissions narrowed for new policies | `nuxt-server` has no app access; existing policies unchanged |
| Imports capped at 50 MB; valueless boolean flags; `schemaDiff` signature | LITUBO uses no import endpoint, `schema/apply?force` or SDK |
| Image transformation output cap 6000 px | the admin asset proxy clamps width / height to 2000 |
| Flows update / delete targeting | 0 Flows |
| Storage `exists()` throws on connection failure | local storage |
| Bundled pm2 entrypoint | compose uses the image's default command |

### 3.5 Migrations and data

The migration from 11.17.4 to 12.3.1 applied six migrations (101 → 107, last `20260727A`):
- Null Item Versions;
- Add AI Translation Settings;
- Add Licensing;
- Add Autosave Revision Interval;
- Add MCP Oauth;
- Add Default Save Action.

It added four empty tables: `directus_oauth_clients`, `directus_oauth_codes`, `directus_oauth_consents` and
`directus_oauth_tokens`.

On identical data (R1 and the development upgrade):
- 20 business tables and 25 system tables byte-identical;
- `directus_collections` (+`status`, `autosave_revision_interval`), `directus_sessions` (+`oauth_client`) and
  `directus_settings` (58 → 67 columns) changed only by added columns — the original columns' content hashes
  equal;
- `directus_migrations` +6 rows;
- sequences unchanged;
- `project_id` unchanged by activation.

### 3.6 Attack-surface hardening

All keys are official Directus 12.3.1 variables: each has a default in `@directus/env` 6.2.2 and is documented in
the configuration reference. `PUBLIC_REGISTRATION`, which the compose file used to set, is not a Directus variable
in 11.17.4 or 12.3.1 and was removed; registration is the database setting `public_registration`, which is `false`.

| Setting | Default | Effect, measured on 12.3.1 |
|---|---|---|
| `WEBSOCKETS_ENABLED: "false"` | false | `/websocket` 404; `/server/info` websocket false |
| `CACHE_ENABLED: "false"` | false | no response cache |
| `TUS_ENABLED: "false"` | false | no resumable uploads |
| `GRAPHQL_INTROSPECTION: "false"` | true | administrator introspection query → 400 `GRAPHQL_VALIDATION` |
| `MCP_ENABLED: "false"` | true | MCP routes not mounted: `/mcp` 404 (11.17.4 answered 403) |
| `AI_ENABLED: "false"` | true | AI routes not mounted: `/ai/chat` 404 |
| `MARKETPLACE_TRUST: "sandbox"` | sandbox | the most restrictive value; installing extensions stays administrator-only and 0 are installed. There is no switch to turn the marketplace off; `EXTENSIONS_LIMIT=0` would mean unlimited in 12.3.1 (`env['EXTENSIONS_LIMIT'] ? … : null`), so it is not used |
| `PROJECT_OWNER_ENABLED: "false"` | true | no owner registration is sent; anonymous `POST /settings/owner` 403 |
| `TELEMETRY: "false"` | true | ignored while the OIG license requires telemetry (§3.7) |

Anonymous surface of the upgraded instance:
- 200: `/server/ping`, `/server/info` (keys `project`, `license` only), `/server/specs/oas` (the anonymous role's
  specification), and a GraphQL `{ __typename }` query.
- 403: items of every business collection, `/files`, `/settings`, `/license`, `/extensions`, `/server/health`,
  `/files/import`, `/users/register`, `/settings/owner`, share info and Flow triggers.
- 401: `/users/me`.
- 404: `/mcp`, `/ai/chat`, `/utils/hash/generate` and `/websocket`.

The public policy holds 0 permissions.

### 3.7 Telemetry

- **Contract (12.3.1).** `api/src/schedules/telemetry.ts` schedules the usage report unless the license does not
  require telemetry and `TELEMETRY` is false. The docs describe the schedule: a report after startup, with a random
  delay of up to 30 minutes, then every 6 hours to `TELEMETRY_URL` (`https://telemetry.directus.io`). The report
  holds aggregate counts and flags, the public URL and the random project id, and no content. The project owner
  registration is separate and is controlled by `PROJECT_OWNER_ENABLED`.
- **Under the OIG license** `telemetry_required` is true, so the usage report is sent and `TELEMETRY: "false"`
  cannot switch it off. The variable is set anyway, with a comment, so it takes effect if the license ever allows
  it. An actual transmission was not captured; the outbound path exists, because the Directus container's network
  is not internal (licensing needs it too).
- **LITUBO need.** None. Directus 11.17.4 sent the same report by default, so the change is that it is now
  documented and cannot be disabled under this license. It is not a vulnerability; it is recorded as a human gate
  (§7).

### 3.8 R1 — upgrade rehearsal on restored data

1. Verified backup set `litubo-backup-20260917-143309` (Directus 11.17.4 quiesced, 49 tables / 2,749 rows /
   129 files) → restored into a TEST database with `scripts/backup-restore.mjs`: fingerprint and every file's
   SHA-256 matched.
2. Disposable 12.3.1 through `docker compose run` on its own loopback port, with the hardening, the license, the
   development `PUBLIC_URL`, a TEST uploads directory and a scratch `/schema` mount. Pong after about 21 s; its
   database sessions went to the TEST database only.
3. Data and migrations as §3.5; all three permission verifications `OK` on the 12.x system tables.
4. `GET /license` as §3.2 (an ephemeral administrator token set on the TEST database for the probe process only,
   never printed, cleared afterwards).
5. Anonymous probes as §3.6; read-only anonymous responses equal to 11.17.4 except `/license` (new, 403) and `/mcp`
   (disabled, 404).
6. The Nuxt production build served 42 checked routes identically from 11.17.4 and 12.3.1. The only difference was
   the order of two parallel data fetches in the SSR payload of `/resources`, which also varies between renders on
   one server.
7. Browser smoke at 1440 and 375 px: Home, products and a category page rendered, the CMS image loaded, no
   horizontal overflow and 0 console errors.
8. Negative control on the Core tier (§3.2); then deactivation (§3.3); container removed, TEST database dropped
   after a TEST-name guard, TEST directories deleted.

### 3.9 Rollback rehearsal

1. The same set was restored into a TEST database.
2. The database was renamed, as a rollback would do.
3. It was served by Directus 11.17.4.

Result: pong after about 21 s, migrations 101 → 101, read-only anonymous responses equal to the development
instance, and a whole-database fingerprint after start equal to the set. Rollback therefore needs:
- the verified pre-upgrade set;
- a restore into a TEST name, then a rename;
- the 11.17.4 pin.

A license activated by 12.3.1 stays consumed unless it is deactivated first.

### 3.10 R2 — fresh provisioning on 12.3.1

The orchestrator used the committed compose file (12.3.1 plus hardening), an empty TEST database, an empty TEST
uploads directory and an in-memory TEST service token:
- **Orchestrator.** 13 of 13 steps in 35 s, every verification passed.
- **Result.** 53 tables, 20 collections, 19 permission rows, 2 roles, 3 policies, 3 access rows, 7 user triggers,
  `public_registration` false, license activated.
- **Checks.** The three verifications passed again, and the published-TEST-data SQL found 0.
- **Identity probes (14 of 14 as expected).** The `nuxt-server` token read the allowed collections (200). Forbidden
  fields (`draft_revision`, inquiry `contact_email`), forbidden collections (`content_relations`, `users`) and
  writes (`POST posts`, `PATCH site_settings`) got 403, with 0 rows written. No token got 403 and a random token
  401.
- **License.** Deactivated, then the TEST database was dropped.

The first driver process exited early after the licensed runtime had started: its fetch-based ping loop left an
unsettled top-level await. A continuation script completed the verification, deactivation and cleanup from that
state. The orchestrator run itself was not repeated.

### 3.11 Development upgrade and backups

| Step | Evidence |
|---|---|
| Quiesce and back up | `docker compose stop directus`; set `litubo-backup-20260917-153058`; `verifyBackupSet` OK; fingerprint and uploads inventory equal to the R1 set |
| Upgrade | `docker compose up -d --no-deps directus` recreated only Directus; pong after about 24 s; the same six migrations; no license error in the log |
| Pins | `verify-directus-pin` FAIL before (running 11.17.4 vs declared 12.3.1) → OK after; `verify-postgres-pin` OK |
| Data | 20 business tables identical to the pre-upgrade set; the same four system tables changed by added columns; four OAuth tables added; all business counts, 19 permission rows, roles / policies / access, the service identity, activity 1107 / max 1141 and revisions 859 / max 891 unchanged |
| Permissions | all three verifications `OK`; public policy permissions 0 |
| Post-upgrade set | `litubo-backup-20260917-153808` records Directus 12.3.1 by digest; 53 tables, 2,755 rows, 129 files; `verifyBackupSet` OK |
| Restore rehearsal of that set | restored into a TEST database (fingerprint and files matched). Disposable 12.3.1 started with `LICENSE_KEY` empty: pong after about 21 s, uploads mount = restored directory, sessions only to the restored database, migrations 107 → 107, anonymous responses equal to the upgraded instance. Startup changed only `directus_settings` (INFERRED: the online revalidation writing a new token; the column-level difference was not computed); schema hash unchanged. Removed without deactivation; the development instance still reported its own license |

### 3.12 Nuxt integration after the upgrade

The production build against the upgraded development instance answered 42 of 42 checked routes identically to the
11.17.4 baseline. The routes cover:
- public CMS JSON through the `nuxt-server` identity;
- Draft never public: every draft product and content slug 404;
- locale isolation: `es` / `pt` empty lists, unknown locale 404, unpublished locale page 404;
- media public rules: the one `is_public` file 200 with identical bytes, a non-public file 404, a malformed id 404;
- `sitemap.xml` and `robots.txt`;
- the public pages;
- the admin surface without a session: `/admin/products` 302 to login, `/api/admin/*` 401.

The server logs held only the expected 404s.

---

## 4. Network exposure

### 4.1 Directus — internal-only by design, enforced in the repository

| Check | Evidence |
|---|---|
| Port publishing and bind address | the production base `docker-compose.yml` publishes Directus only as `127.0.0.1:8055:8055`; a test fails on any other binding (`tests/directusSecurityRemediationContract.test.ts`). PostgreSQL publishes no port |
| Docker networks | Directus joins `litubo-internal` only. It is not an internal network, because licensing and the license-required telemetry need outbound HTTPS |
| Reverse proxy | the repository contains no reverse-proxy route to Directus. The documented production access is an SSH tunnel only, with no admin subdomain (`docs/ADMIN-CMS-SETUP.md` §6.2 / §7). `docs/OPERATIONS-HANDBOOK.md` §1 contradicted this with a public CMS address and was corrected in this module; a test keeps it corrected |
| Nuxt → Directus path | server-side only: `runtimeConfig.directusUrl` is not in `public`, and the production `.output/public` contains no Directus address. The server code calls only `/items/*`, `/files` and `/files/{id}`, `/folders`, `/users/me`, `/revisions`, `/permissions`, `/collections`, `/relations`, `/policies`, `/assets/{id}` and `/auth/login` / `refresh` / `logout` — never `/schema`, `/utils`, `/flows`, `/shares`, `/extensions`, `/graphql`, `/server`, `/settings`, `/users/register`, `/auth/password`, `/mcp`, `/ai`, `/license` or `/files/import` (static enumeration of `server/`) |
| Studio, REST, GraphQL, `/server/*`, `/files/import`, WebSocket, extension install, shares, Flows, registration | reachable only on loopback / through the SSH tunnel; on the instance itself as §3.6. WebSockets, MCP and AI are off; 0 shares, 0 Flows, 0 extensions; registration off; public policy 0 permissions |
| Deploy-time verification | `docs/ADMIN-CMS-SETUP.md` §7: `ss -tlnp` must show `127.0.0.1:8055`, and an external request to port 8055 must time out; plus the provisioning runbook smoke checks. These are production preflight steps; the design they verify is fixed in the repository |

### 4.2 document-extractor

| Check | Evidence |
|---|---|
| Public exposure | the extractor publishes no port and joins only `document-extractor-internal` (`internal: true`). The gateway publishes `127.0.0.1:8787` only and pipes each connection, unread, to `document-extractor:8787` |
| Caller | the Nuxt server only (`documentExtractorUrl`, server-side). The AI source-intake routes that use it require an administrator session (401 without) |
| Container | read-only root filesystem, `/tmp` tmpfs `noexec,nosuid,nodev`, `cap_drop: ALL`, `no-new-privileges`, uid 1000, 512 MB, 64 pids, 1 CPU, no volumes, no secrets |
| Processes | fixed allowlist: `prlimit --as --core=0 --` + `pdfinfo` / `pdftotext` / `vipsheader` / `vips` / `tesseract`, argument arrays, `shell: false`, frozen environments. `gateway.mjs` and `server.mjs` spawn nothing |
| Inputs | PDF / JPEG / PNG / WebP by signature; images must also be opened by exactly `jpegload` / `pngload` / `webpload`; `VIPS_BLOCK_UNTRUSTED=1`; Tesseract reads only the PNG libvips wrote |
| Measured | the integration suites (45 tests) passed before and after the image change: real Poppler / libvips / Tesseract, RLIMIT_AS, SIGKILL at the deadline, uid 1000 on a read-only root, "no route out: no Internet, no DNS, no Directus" |

---

## 5. Residual Critical / High classification

Allowed classes: FIXED, MITIGATED, NON-REACHABLE WITH EVIDENCE. None is TO VERIFY, UNKNOWN or ASSUMED SAFE.

### 5.1 Directus 12.3.1 — 0 Critical, 18 High

| Finding | Component | Trigger | Evidence | Class |
|---|---|---|---|---|
| CVE-2026-83605 / -83607 / -83608 / -83613 / -83614 / -83615 / -83616 / -83619 (8) | @xmldom/xmldom 0.8.13 | building or serializing attacker-influenced XML DOM; quadratic parsing | the only dependents are samlify, xml-crypto and @authenio/xml-encryption — the SAML chain used by `api/src/auth/drivers/saml.ts`, instantiated only for `AUTH_PROVIDERS` entries with a SAML driver. The container has no `AUTH_PROVIDERS` variable (names inspected, values not read) | NON-REACHABLE |
| CVE-2026-75899 / -75931 / -75975 / -76172 (4) | fast-uri 3.1.5 | normalize / resolve on attacker-controlled URIs feeding a network destination | used only through ajv, whose dependents are @modelcontextprotocol/sdk (MCP routes not mounted, `MCP_ENABLED: "false"`), ajv-formats (MCP) and braintrust (AI telemetry: `AI_ENABLED: "false"`, `AI_TELEMETRY_ENABLED` unset); ajv resolves schema identifiers, not request URLs | NON-REACHABLE |
| CVE-2026-84375 | js-yaml 4.3.1 | parsing attacker-controlled YAML with merge keys (DoS) | over HTTP, YAML is parsed only by `readFileUploadBody({ allowYaml })` on `/schema/diff` and `/schema/apply`, both behind `checkIsAdmin` (`/utils/import` accepts JSON only). The other parsers read local files (CLI snapshot / apply, seeds, bundled YAML). The Nuxt server never calls `/schema`; Directus is reachable only on loopback / through the SSH tunnel (§4.1) | MITIGATED (no LITUBO route; reaching it needs host SSH access and Directus administrator credentials) |
| CVE-2026-14456 (libcrypto3 and libssl3, 2) | OpenSSL 3.5.7 | an OpenSSL QUIC server receiving QUIC Initial packets | Node does not link the system OpenSSL (`ldd`); only `apk`, BusyBox `ssl_client` and OpenSSL's engine / provider modules do, and none runs. Directus listens on TCP 8055 only; the one UDP socket is Docker's embedded DNS resolver | NON-REACHABLE |
| GHSA-3f6p-5ww8-9rcr | mysql2 3.15.3 | a rogue MySQL server downgrading authentication | `DB_CLIENT` is `pg`; knex loads only the configured client, and the database is PostgreSQL | NON-REACHABLE |
| GHSA-2x7j-588g-ccc2 | nodemailer 9.0.3 | a crafted address list reaching `addressparser` (DoS) | mail is sent only by Directus flows (0), invitations and registration (off). The password-reset mail addresses the stored `user.email`, not the request input. No `EMAIL_*` variable is configured. The Nuxt server calls none of these endpoints, and Directus is not publicly reachable | NON-REACHABLE |
| GHSA-rgj7-g3m4-5g8c | sharp 0.35.3 (bundled libheif) | decoding a crafted HEIF / AVIF | Directus runs sharp on upload metadata and on transformations when the stored type is an image, and sharp decodes the real bytes. **Mitigation added:** `server/api/admin/media/upload.post.ts`, LITUBO's only upload route, now refuses image uploads whose bytes are not the declared JPEG / PNG / WebP (`uploadContentMatchesType`, 13 tests). Stored files: 0 of 60 are ISO-BMFF (HEIF / AVIF) containers. A Directus Studio upload needs the SSH tunnel and Directus administrator credentials | MITIGATED |

### 5.2 PostgreSQL 16.15 — 1 Critical, 30 High

`postgres:16-alpine`, `16.15-alpine` and `16-alpine3.24` still resolve to the pinned digest, so no newer 16.x image
exists upstream. The pin is kept (§10 of the work order); no PostgreSQL runtime change was made.

| Finding | Component | Evidence | Class |
|---|---|---|---|
| CVE-2025-68121 (Critical) and 21 High: CVE-2025-61726, -61729, CVE-2026-25679, -27145, -32280, -32281, -32283, -33811, -33814, -33818, -39820, -39821, -39822, -39836, -42499, -42504, -56853, -56858, -56859, -56860, -56862 | Go stdlib 1.24.6 in `/usr/local/bin/gosu` | the CVEs sit in `crypto/tls`, `crypto/x509`, `net/url`, `net/http` (HTTP/2), `net` (resolver / dial), `encoding/asn1`, `encoding/xml`, `net/mail`, `mime`, `html/template`, `x/net/idna` and `os.Root`. The binary references **0** symbols of each of those packages; its linked packages are `runtime`, `fmt`, `syscall`, `os`, `strconv`, `strings`, `internal/*` and `github.com/moby/sys/user`. gosu runs once in `docker-entrypoint.sh` (`exec gosu postgres …`); PID 1 is `postgres` | NON-REACHABLE |
| CVE-2026-53612, -53613, -53614, -76642, -78408, -78409, -78410 (7) | libuuid 2.42.1 (util-linux source) | the flaws are in the util-linux `mount(8)` and `nsenter` programs and their X-mount helpers. The image's `libuuid` package contains only `libuuid.so.1`; `mount` and `nsenter` are BusyBox applets, and no util-linux program package is installed. `libuuid` is linked only by `uuid-ossp.so`, whose extension is not installed (`pg_extension`: plpgsql only) | NON-REACHABLE |
| CVE-2026-14456 (libcrypto3 and libssl3, 2) | OpenSSL 3.5.7 | needs an OpenSSL QUIC server. `postgres` references 0 QUIC symbols, `ssl` is `off`, and it listens on TCP 5432 on the internal network only | NON-REACHABLE |

### 5.3 document-extractor — 13 Critical, 167 High

**Fixed in this module.** The Dockerfile removes the npm CLI, npx and corepack from the Node base image, in a layer
after the apt and COPY layers. The rebuild used the cached apt layer, and the 208 installed Debian packages kept
identical names and versions. This removed CVE-2026-59873 (Critical) and ten High findings: brace-expansion ×3,
tar ×2, pacote ×2, ip-address, picomatch and sigstore.

**Method.** A script run inside the image, offline (`--network none`), built the reachability model:
- **Roots.** The executables the extractor may start plus `node`, and all five libvips modules, because libvips
  loads every module at start-up.
- **Closure.** Their transitive shared-library closure via `ldd` (147 files, 120 packages), mapped to Debian
  packages with `dpkg -S`.
- **Symbols.** Each file's ELF dynamic symbols, listing importers and exporters of the vulnerable entry points.
- **Loaders.** `vips -l` class flags (priority, `untrusted`), and a blocked-operation check under
  `VIPS_BLOCK_UNTRUSTED=1`.

The CVE descriptions come from the Trivy DB.

| Group | Packages (Critical / High) | Evidence | Class |
|---|---|---|---|
| E1 — never loaded or executed | bsdutils 0/5, gzip 0/1, imagemagick-6-common 0/2, libcap2 0/1, libncursesw6 0/1, libpython3.11-minimal 0/5, libpython3.11-stdlib 0/5, libsystemd0 0/1, libtinfo6 0/1, libudev1 0/1, libuuid1 0/5, mount 0/5, ncurses-base 0/1, ncurses-bin 0/1, perl-base 3/5, python3.11 0/5, python3.11-minimal 0/5, util-linux-extra 0/5 — **3 / 55** | none of these files is in any root's library closure. The executables they ship (`perl`, `python3`, `gzip`, `mount`, `nsenter`, `infocmp`, …) are never started: the spawn allowlist is fixed, argument arrays only, `shell: false`, the root filesystem is read-only, and `/tmp` is `noexec`. perl CVE-2026-8376 is 32-bit only (the image is amd64); the ncurses CVE is in the `infocmp` tool; the systemd CVE is in `systemd-homed` | NON-REACHABLE |
| E2 — util-linux program flaws in loaded libraries | libblkid1 0/5, libmount1 0/5, libsmartcols1 0/5, util-linux 0/5 — **0 / 20** | the CVEs are in `mount(8)`, `nsenter` and the X-mount helpers. The loaded code is `prlimit` (util-linux) and these libraries (through GIO), which perform no mounts; the container has no `CAP_SYS_ADMIN` (`cap_drop: ALL`) and `no-new-privileges` | NON-REACHABLE |
| E3 — network-only code | libcurl3-gnutls 0/5, libcurl4 0/5, libgnutls30 2/3, libldap-2.5-0 0/1 — **2 / 14** | `curl_easy_perform` is imported only by libcfitsio (`fitsload`, untrusted), libhdf5 (via `matload`, untrusted) and libtesseract (URL inputs only; the extractor passes local `/tmp` paths). GnuTLS handshakes are imported only by libcurl-gnutls, librtmp and libldap; DTLS and PSK functions have 0 importers. The container has no route out (integration test). Debian has fixed GnuTLS (`3.7.9-2+deb12u7`); not applied (§8) | NON-REACHABLE |
| E4 — blocked loaders, or vulnerable functions never called | libopenexr-3-1-30 3/18, libmagickcore-6.q16-6 0/2, libsqlite3-0 1/2, libhdf5-103-1 0/1, libjxl0.7 0/1, libxml2 1/7, libglib2.0-0 1/6, libharfbuzz0b 0/1, libexpat1 0/4, libpcre2-8-0 0/3, libacl1 0/1, zlib1g 1/0 — **7 / 46** | see "E4 details" below | NON-REACHABLE |
| E5 — decoders never selected for accepted input | libheif1 0/6, libde265-0 0/1, libaom3 1/1, libtiff6 0/4, libvips42 0/4, libvips-tools 0/4 — **1 / 20** | see "E5 details" below | NON-REACHABLE |
| E6 — fixed model data | libtesseract5 0/6, tesseract-ocr 0/6 — **0 / 12** | every CVE needs a crafted `.traineddata` model. The models are image files on a read-only root, the language set (`-l eng+chi_sim`) and `--oem 1` are constants, and `TESSDATA_PREFIX` is not taken from input | NON-REACHABLE |

**E4 details.**
- **Blocked loaders.** `openexrload`, `magickload` (priority −100), `openslideload` (the only SQLite user),
  `matload` (HDF5 through libmatio), `jxlload` and `svgload` (librsvg) are flagged `untrusted`. The block check
  printed "operation is blocked" for `openexrload`, `magickload`, `svgload` and `matload`; for the others it failed
  first on the missing test file, and the protection rests on the `untrusted` flag plus the signature check.
- **libjxl.** `DecodeImagePNM` is exported by no library in the closure.
- **libxml2.** Parse entry points are imported only by ImageMagick, OpenSlide and libgsf (`dzsave` / ODF metadata,
  unused). `xmlURIEscapeStr`, `xmlValidate*`, `xmlXPtrEval`, `xmlXInclude*` and `xmlOutputBufferCreate*` have 0
  importers; the Python bindings are not installed.
- **glib.** `g_dbus_node_info_new_for_xml` and the D-Bus connection functions are imported only by librsvg, and there
  is no D-Bus. `g_regex_replace` has 0 importers. `g_date_time_get_ymd` is imported by libgsf and librsvg. The
  key-file, I/O-channel and GVariant readers are imported by GIO, gdk-pixbuf and librsvg for trusted local files.
- **HarfBuzz.** `hb_shape` is imported only by Pango (librsvg, and the unused vips `text`).
- **expat.** Only fontconfig (its read-only configuration) and libvips (the `.v` metadata of `vipsload`, untrusted).
- **PCRE2.** Only GLib and libselinux, with program-constant patterns (Debian fix `10.42-1+deb12u1`; not applied, §8).
- **libacl.** Only libarchive, which extracts nothing to disk here (non-root, no capabilities, read-only root).
- **zlib.** No MiniZip symbol exists in the closure.

**E5 details.**
- **Signatures.** Accepted images start with the JPEG, PNG or WebP signature. The TIFF, HEIF (`ftyp` brand) and
  vips signatures cannot also match with a higher priority: `pngload` and `webpload` have priority 200, `jpegload`
  50, `tiffload` 50 and `heifload` 0.
- **Loader check.** The extractor then requires `vipsheader` to report exactly the expected loader before
  `vips thumbnail` runs, and Tesseract (leptonica, libtiff) reads only the PNG libvips wrote.
- **libaom, libde265.** Reached only through libheif.
- **libvips.** Its four CVEs are in `pdfload` (untrusted; PDFs go to Poppler's tools), `vipsload` (untrusted) and
  `tiffload` (×2).
- **libtiff.** CVE-2026-52490 is in the libtiff command-line tools, which are not installed.

---

## 6. Changes made

| File | Change |
|---|---|
| `docker-compose.yml` | Directus pin 11.17.4 → 12.3.1; hardening variables (§3.6); non-existent `PUBLIC_REGISTRATION` removed |
| `scripts/provisioning-manifest.json` | runtime pin 12.3.1 |
| `scripts/provision-directus.mjs` | Directus CLI started as `node cli.js` (the 12.1+ image has no npx) |
| `server/api/admin/media/upload.post.ts` | image uploads must carry the bytes of the declared JPEG / PNG / WebP (§5.1) |
| `document-extractor/Dockerfile` | npm CLI, npx and corepack removed after the apt / COPY layers (§5.3) |
| `tests/directusSecurityRemediationContract.test.ts` (new), `tests/mediaUploadTypes.test.ts`, `tests/documentExtractorInfra.test.ts` | pin, hardening, loopback publishing, CLI entry, documentation and upload-signature guards |
| `CLAUDE.md`, `docs/ADMIN-CMS-SETUP.md`, `docs/ADMIN-CMS-SPEC.md`, `docs/OPERATIONS-HANDBOOK.md` | `node cli.js` instead of `npx directus`; `/server/ping` for liveness; registration is a database setting; no public Directus address |
| Runbooks, CURRENT-STATE, RELEASE-SAFETY-GATES, decision log | D-042 and the facts above |

The development environment now runs Directus 12.3.1 (with the OIG license) and the rebuilt extractor image.
PostgreSQL is unchanged. The previous extractor image is kept locally as `litubo-document-extractor:pre-sr01`.

---

## 7. Human gates (facts only, no legal conclusion)

| Gate | Owner | Fact |
|---|---|---|
| Directus commercial eligibility | business owner | Directus 12.3.1 is MSCL-1.0-GPL and runs on an OIG key. OIG terms: under US $5M annual revenue and fewer than 50 employees, assessed on the legal entities whose representatives log into the Studio; grant usage agreement; one year, renewable; 5 activations |
| Telemetry required by the OIG license | business owner | the usage report (aggregate counts, public URL, project id) cannot be disabled under this license (§3.7) |
| Poppler (GPL), libvips (LGPL-2.1), util-linux (mixed) | human review | unchanged from PR03 |

---

## 8. Not covered by this module (not security blockers)

- **Deploy-time checks.** Production deployment, its reverse proxy, and the §4.1 deploy-time checks belong to the
  production preflight.
- **Debian fixes not applied.** Fixed packages exist for NON-REACHABLE extractor findings: GnuTLS `deb12u7`, PCRE2
  `deb12u1` and libcap2 `deb12u3`. A controlled rebuild with extraction regression can take them later. They were
  not pulled into this module's rebuild, so no Debian package changed.
- **PostgreSQL image.** Re-check the upstream 16.x image when a new build is published.
- **Provisioning re-run.** Re-running provisioning over an already-provisioned 12.3.1 database (idempotency) was
  not re-measured.
- **Restored licensed copies.** INFERRED from the licensing documentation, not tested: deactivating in a restored
  copy that shares an environment's project and URL would release that environment's binding. The runbooks
  therefore forbid it.

---

## 9. Evidence

- **Advisories and releases.** GitHub REST `repos/directus/directus/security-advisories` (78 published) and the
  release list, 2026-09-17.
- **Source.** v12.3.1 archive from `codeload.github.com`. Files cited: `api/src/license/*`, `controllers/license.ts`,
  `services/server.ts`, `services/permissions.ts`, `schedules/telemetry.ts`, `mailer.ts`, `services/users.ts`,
  `middleware/read-file-upload-body.ts`, `controllers/schema.ts`, `controllers/utils.ts`,
  `services/files/lib/extract-metadata.ts`, `services/assets.ts`, `constants.ts`, `cli/commands/schema/apply.ts`,
  `cli/commands/bootstrap/index.ts`, `packages/env/src/constants/defaults.ts`.
- **Documentation.** The `directus/docs` main branch, 2026-09-17:
  - `licensing/overview`, `telemetry` and `open-innovation-grant`;
  - `releases/breaking-changes/version-12`;
  - `configuration/general`, `ai` and `extensions`.
- **Images.**
  - `docker buildx imagetools inspect`;
  - offline `docker run --network none` inspections (license file, versions, `ldd`, `dpkg`, symbols, loaders);
  - `docker inspect` restricted to image, mounts, state and environment variable **names**.
- **Scans.** Trivy 0.74.0, DB 2026-09-17 07:06:17 UTC: Directus 11.17.4 and 12.3.1, PostgreSQL 16.15, and the
  extractor before and after.
- **Runtime.**
  - SQL fingerprints (`scripts/backup-set.mjs`) and metrics;
  - the three permission verification artifacts;
  - backup, restore and pin tools;
  - anonymous and ephemeral-administrator API probes on disposable TEST databases;
  - Nuxt production-build comparisons;
  - extractor integration suites.
- **Storage.** Raw artifacts (scans, logs, probe output) stay in the session scratch directory, outside Git. Backup
  sets stay in the ignored `backups/`.
