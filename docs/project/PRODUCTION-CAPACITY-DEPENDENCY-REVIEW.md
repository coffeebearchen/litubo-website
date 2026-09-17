# Production Capacity, Dependency and Security Review

> Module: FINAL-RELEASE-PRODUCTION-READY-03 / 03A / 03B · measured 2026-09-17 on the local development
> environment · decision D-041.
> **Result: BASELINE COMPLETE — SECURITY REMEDIATION REQUIRED.** This document is four separate records,
> not one PASS: a proven technical baseline (§1), open security blockers (§2), human commercial / legal
> confirmations (§3) and open production operations (§4).
> Nothing here was measured on a production server. Local capacity numbers are not a production SLA,
> a scan is not a security approval, and the license inventory is not legal advice.
>
> **Partly superseded by FINAL-RELEASE-SECURITY-REMEDIATION-01 (2026-09-18, D-042).** Directus was upgraded
> 11.17.4 → 12.3.1 (relicensed MSCL-1.0-GPL, running on an Open Innovation Grant key), the npm CLI, npx and
> corepack were removed from the document-extractor image, the Directus attack surface was narrowed with
> officially supported environment variables, and every remaining Critical / High finding in the three runtime
> images was classified with objective evidence (BLOCKING = 0, UNKNOWN SECURITY EXPOSURE = 0).
> §1.1 (Directus pin), §1.4 (image scan counts), §1.5 (Directus licence), the Directus row of §3 and all of §2
> are therefore point-in-time PR03 records, not current state — the current security position is
> `docs/project/SECURITY-REMEDIATION-REVIEW.md`. §1.2, §1.3, §4 and the remaining rows of §3 stand unchanged.
> This does not approve a production release: Final Release Verification is still NOT STARTED.

---

## 1. Proven technical baseline

### 1.1 Runtime pins

| Component | Pin | Verified by |
|---|---|---|
| Node | **22.22.2** (`.nvmrc`, `package.json` engines, CI `node-version-file`) | `node scripts/verify-node-runtime.mjs`; first step of `npm run release:verify` |
| Directus | `directus/directus:11.17.4@sha256:eb326f679ae847c0a776f93b972761dc2ebe84980e0b9d274a6bc31cd62809f7` (D-038) — **superseded 2026-09-18 by `directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869` (D-042)** | `node scripts/verify-directus-pin.mjs` |
| PostgreSQL | `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` (D-041) | `node scripts/verify-postgres-pin.mjs` |

**PostgreSQL pin.** The compose file declared the floating `postgres:16-alpine`. The running server reported
`server_version` 16.15 (Alpine 3.24.1, linux/amd64), and `docker buildx imagetools inspect` resolved
`16-alpine`, `16.15-alpine` and `16.15-alpine3.24` to the same OCI image index `sha256:cf78e766…` with
linux/amd64, linux/arm64/v8, linux/arm/v6, linux/arm/v7, linux/386, linux/ppc64le, linux/riscv64 and
linux/s390x manifests. The local image's repository digest was that same index, so pinning it changed the
declaration, not the server build.

`scripts/verify-postgres-pin.mjs` checks four things and exits non-zero on any drift: the compose
declaration is an exact `major.minor` tag with a digest; the running container was started from exactly
that reference; a repository digest of the running image matches; `SHOW server_version` matches. It ran
FAIL (exit 1) against the floating declaration and OK (exit 0) after the pin. It reads image identity and
the server version only — the version query runs as `psql -U "$POSTGRES_USER"` inside the container.

**Data safety of the recreate.**

1. Directus stopped; a backup set was created with the D-040 tool (`litubo-backup-20260916-225007`) and
   re-verified with `verifyBackupSet`.
2. Only the PostgreSQL service was recreated (`docker compose up -d --no-deps postgres`): same image ID,
   same bind-mounted data directory, healthy after 12.3 s. No `down -v`, no volume removal, no prune.
3. 29 business metrics (tables, products, Content item 6 revisions, permissions, roles / policies / access,
   files, inquiries, activity, revisions, sessions, migrations, triggers) were identical before and after.
4. The full database fingerprint (49 tables / 2,749 rows, 75 indexes, 132 constraints, 7 triggers,
   8 functions, 27 sequences, schema-definition hash) was identical to the backup manifest.
5. **Backup regression on the pinned image:** a second set (`litubo-backup-20260916-225622`) passed
   `verifyBackupSet`; pg_dump 16.15, 361 TOC entries validated by `pg_restore --list`, identical database
   fingerprint and an identical `uploads.tar` SHA-256.
6. Directus restarted: ping after 12.6 s, health 200, migrations 101 → 101, pin verifiers OK.

**Canonical release entry.** `npm run release:verify` runs, in order and chained with `&&`:
`verify-node-runtime` → `verify-directus-pin` → `verify-postgres-pin` → `release-check-test-data` →
`nuxt build`. Only this entry is gated; `dev`, `build`, `typecheck`, `lint` and `test` are deliberately left
as they are (Controller decision). Evidence:

| Runtime | Result |
|---|---|
| Windows system PATH, Node 24.14.0 | exit 1 after 2.6 s at the first step; no pin check, no data check and no build ran; `.output` untouched |
| Node 22.22.2 | exit 0 after 142 s: runtime OK · Directus pin OK · PostgreSQL pin OK · published TEST data PASS · build complete (8.26 MB, 2.06 MB gzip) |

The Windows workstation PATH is informational and not runtime authority; it was not modified.

### 1.2 Local capacity baseline

**Host (developer workstation, not the production server).**

| Item | Value |
|---|---|
| OS / CPU | Windows 11 10.0.26200 x64 · Intel Core Ultra 5 125H · 18 logical CPUs |
| Memory | 15.46 GiB total, 2.04 GiB free at measurement time |
| Docker | Docker Desktop, engine 29.1.3, linux/x86_64 VM with 18 CPUs and 7.49 GiB (8,038,035,456 B) |
| Free disk | C: 80,870,408,192 B (Docker Desktop data) · D: 71,649,792,000 B (repository) |

**Storage.**

| Item | Size |
|---|---|
| Git tracked files | 604 files, 72,796,793 B (`.git` 135,320,951 B) |
| `.output` (production build) | 11,531,589 B, 1,582 files (public 3,504,205 B · server 8,027,131 B); build report 8.26 MB / 2.06 MB gzip |
| `node_modules` (informational) | 282,083,669 B |
| PostgreSQL logical database | 12,549,143 B (cluster total 34 MB) |
| PostgreSQL data directory | 69,671,645 B |
| Directus uploads | 129 files, 7,189,583 B |
| One backup set (D-040) | 7,582,700 B |
| Images (`docker image ls` disk usage) | Directus 1.21 GB · PostgreSQL 420 MB · document-extractor 633 MB |

**Containers** (`docker stats --no-stream`, LITUBO containers only).

| Container | Idle | During sustained concurrency 20 |
|---|---|---|
| directus | 1.19% CPU · 236.6 MiB · 40 pids | 132–168% CPU · 280–316 MiB |
| postgres | 0.00% · 30.3 MiB · 8 pids | 13–14% CPU · 47.8 MiB · 16 pids |
| document-extractor | 0.00% · 162.7 MiB of 512 MiB · 8 pids | unchanged (not on these routes) |
| document-extractor-gateway | 0.00% · 13.5 MiB of 96 MiB · 12 pids | unchanged |
| Nuxt server (host process) | 75.1 MiB working set | 138–193 MiB; 66.3 MiB after the run |

**Concurrency.** `scripts/local-capacity-smoke.mjs` against the **local production build**
(`node .output/server/index.mjs`, Node 22.22.2, bound to 127.0.0.1:3310, runtime environment injected by
Node's `--env-file` from the local `.env` without the values being read or printed), backed by the local
Directus and PostgreSQL containers. GET only, six public routes (`/`, `/products`, `/api/cms/site-settings`,
`/api/cms/products/categories`, `/api/cms/posts`, `/sitemap.xml`), 60 requests per level, 30 s timeout.

| Concurrency | Requests | 200 | p50 ms | p95 ms | max ms | req/s |
|---|---|---|---|---|---|---|
| 1 | 60 | 60 | 17.9 | 48.9 | 57.2 | 41.2 |
| 5 | 60 | 60 | 74.1 | 118.8 | 124.8 | 64.4 |
| 10 | 60 | 60 | 123.4 | 265.9 | 403.1 | 66.3 |
| 20 | 60 | 60 | 199.3 | 697.5 | 886.6 | 67.3 |

A second pass without warm-up gave the same shape (p95 37.2 / 116.2 / 256.4 / 656.0 ms), and a sustained
run of 240 requests at concurrency 20 gave p50 324.7 ms, p95 701.2 ms, max 1,050.6 ms, 51.8 req/s. Across
all 720 measured requests: **0 timeouts, 0 connection errors, 0 5xx.** Throughput levels off at about
64–68 req/s from concurrency 5 on this machine; latency grows with concurrency.

GET smoke on the same build: `/`, `/products`, `/support/faq`, `/resources`, the three CMS APIs,
`/sitemap.xml`, `/admin/login` and `/admin` answered 200; `/admin/products` 302 to the login page;
`/api/admin/ai/providers` 401. No unexpected 401, 403 or 503.

**What this does not prove:** production capacity, users supported, guaranteed throughput, behaviour
behind Cloudflare / Nginx / TLS, a production CPU or memory size, or behaviour with published products.
The local dataset has no published products and no published posts.

### 1.3 Node dependencies

`package.json` declares 8 dependencies and 10 devDependencies.

**Vulnerabilities.** The configured npm mirror does not implement the audit endpoint (`NOT_IMPLEMENTED`), so
the audit ran against the authoritative registry with a command-line flag only
(`npm audit --omit=dev --json --registry=https://registry.npmjs.org/`). It counted 731 production, 212 dev,
230 optional and 64 peer dependencies.

| Scope | Critical | High | Moderate | Low |
|---|---|---|---|---|
| Production (`--omit=dev`) | 0 | 1 | 2 | 1 |
| Full tree (dev included) | 1 | 2 | 5 | 1 |

| Finding | Classification | Evidence |
|---|---|---|
| **High** `glob` 10.2.0–10.4.5, CLI `-c/--cmd` command injection (GHSA-5j98-mcp5-4vw2) | **BUILD-TIME / NOT DEPLOYED RUNTIME** — non-blocking for V1 runtime; update item | Only path: nuxt 3.21.11 → @nuxt/nitro-server → nitropack 2.13.4 → archiver 7.0.1 → archiver-utils 5.0.2 → glob 10.4.5. `.output` contains no `glob`, `archiver*`, `foreground-child` or `path-scurry` directory, and no server chunk or public asset contains their code. |
| Moderate `vue-i18n` 10.0.7 / `@intlify/core-base` 10.0.x, `escapeParameterHtml` does not stop DOM XSS through tag attributes (GHSA-x8qp-wqqm-57ph) | Runtime client dependency; vulnerable option not used — non-blocking; update item | vue-i18n is in the client bundle. The project never sets `escapeParameterHtml` (0 references), and none of its 6 `v-html` usages renders a translated message. |
| Low `esbuild` dev server file read on Windows (GHSA-g7r4-m6w7-qqqr) | DEV / BUILD TOOLING | Development server only |
| Critical `vitest` ≤ 4.1.10; High `vite` ≤ 6.4.2 (full tree only) | **DEV / BUILD TOOLING** — not a production runtime vulnerability | devDependencies; fixes need major upgrades, not done |

No dependency was upgraded and `npm audit fix` was not run.

### 1.4 Container images — scan performed

Trivy **v0.74.0**, from the official aquasecurity/trivy GitHub release, SHA-256 checked against the release
checksum file before use; vulnerability DB v2 updated 2026-09-16 13:02:23 UTC; scanned 2026-09-16
20:38–20:39 UTC; local Docker images only (`--image-src docker`), vulnerability scanner only. The scanned
image IDs are the IDs of the running containers. The binary, the DB and the raw JSON stay outside Git.

| Image | OS | Critical | High | Medium | Low | Unknown |
|---|---|---|---|---|---|---|
| Directus 11.17.4 | Alpine 3.23.4 | 5 (4 unique) | 145 (117 unique) | 160 | 52 | 2 |
| PostgreSQL 16.15 | Alpine 3.24.1 | 1 | 30 | 30 | 12 | 1 |
| document-extractor | Debian 12.13 | 14 | 176 | 304 | 381 | 14 |

This records that a scan was performed and what it found. **Zero Critical: NO.** Container security is not
proven — see §2.

> **Superseded (2026-09-18, D-042).** These are the PR03 counts. After the remediation, rescanned with the same
> pinned Trivy 0.74.0 (DB v2 updated 2026-09-17), the unique (CVE, package, version) Critical / High counts are
> Directus 12.3.1 **0 / 18**, PostgreSQL 16.15 **1 / 30** (no newer 16.x image exists upstream) and
> document-extractor **13 / 167**. See `docs/project/SECURITY-REMEDIATION-REVIEW.md` §1 and §5.

High findings, summarised (full lists in the raw scan output):

- **Directus:**
  - Directus application dependencies with fixes (axios 11, brace-expansion 9, @xmldom/xmldom 8, fast-uri 7,
    nanoid 5, liquidjs 4, undici 4 and smaller groups), including Directus core CVE-2026-61835 and
    CVE-2026-61836 (fixed in 12.0.0).
  - Go standard library in the bundled esbuild binaries (21).
  - Packages bundled with the npm CLI of the Node base image.
  - OpenSSL `libcrypto3` / `libssl3` CVE-2026-14456 and CVE-2026-45447 (fixed in newer Alpine packages).
- **PostgreSQL:** Go standard library in `gosu` (21), `libuuid` (7, fixed), OpenSSL CVE-2026-14456 (fixed in 3.5.8-r0).
- **document-extractor:**
  - Mostly Debian 12 packages with no fix reported: OpenEXR 18, libxml2 7, GLib 6, libheif 6, Tesseract 12,
    util-linux family, curl, Python 3.11, Perl, expat, libtiff, libvips, ImageMagick libraries and others.
  - Fixes are reported only for GnuTLS, PCRE2, libcap2 and the npm-CLI packages.

### 1.5 License inventory

This is an evidence inventory, not a legal conclusion.

| Component | Version | License evidence | Classification |
|---|---|---|---|
| Directus | 11.17.4 (pinned image) | `/directus/license` in the pinned image and `@directus/api` 35.2.0 `package.json`: **BUSL-1.1**. Its Additional Use Grant allows production use while the licensee's Total Finances (the largest of gross revenue, budget and funding, affiliates included) do not exceed US $5,000,000 over the most recent 12 months; the change license is GPL v3, three years after release. `/directus/package.json` declares no license. | **HUMAN COMMERCIAL / LEGAL CONFIRMATION REQUIRED BEFORE PRODUCTION** (§3) |
| PostgreSQL | 16.15 | Image SBOM attestation (SPDX 2.3, generated by Docker): `postgresql` 16.15 with no declared license and `NOASSERTION` — a metadata gap, not an unknown license. Official upstream evidence: `https://www.postgresql.org/about/licence/` (retrieved 2026-09-16, HTTP 200) states PostgreSQL is released under the **PostgreSQL License**. The upstream `COPYRIGHT` file at tag `REL_16_15` was requested from git.postgresql.org and rate-limited (HTTP 429). | License evidence resolved |
| Poppler | 22.12.0-2+deb12u3 | Debian `copyright`: GPL-2, GPL-3, GPL-2 or GPL-3, Apache-2.0 | GPL family → HUMAN REVIEW |
| libvips | 8.14.1-3+deb12u3 | Debian `copyright`: LGPL-2.1 | LGPL family → HUMAN REVIEW |
| util-linux | 2.38.1-5+deb12u3 | Debian `copyright`: LGPL-2.1+, GPL-2, GPL-2+, LGPL-2+, BSD-3-clause | Mixed → HUMAN REVIEW |
| Tesseract + models | 5.3.0-2; eng / chi_sim / osd 1:4.1.0-2 | Debian `copyright`: Apache-2.0 | Permissive |
| Leptonica | 1.82.0-3+b3 | Debian `copyright`: two-clause BSD-style text | Permissive |
| Node production packages | lockfile, 977 non-dev entries | MIT 839 · ISC 47 · BSD 35 · Apache-2.0 33 · BlueOak-1.0.0 14 · CC0-1.0 3 · Python-2.0 1 · CC-BY-4.0 1 (caniuse-lite data) · dual-licensed 3 (including node-forge "BSD-3-Clause OR GPL-2.0") · no license field 1 (`tosource` 2.0.0-alpha.3, build-time, zlib-style `LICENSE` text) · AGPL 0 · BUSL / source-available 0 | Inventory recorded |
| Deployed Node runtime trace | `.output/server/node_modules`, 40 packages | MIT 34 · BSD 4 · ISC 2 | Inventory recorded |

GPL or LGPL is not treated as "not allowed": whether any obligation applies depends on how LITUBO deploys
and distributes the software, which is a human decision.

---

## 2. Security blockers

**Container image scan: performed · Zero Critical: NO · Security remediation complete: NO ·
Release security blocker: YES.** Remediation is the separate module `FINAL-RELEASE-SECURITY-REMEDIATION-01`;
Final Release Verification is not authorized until it closes. Nothing was upgraded, disabled or patched
here.

> **Superseded (2026-09-18, D-042).** This whole section is the PR03 snapshot. `FINAL-RELEASE-SECURITY-REMEDIATION-01`
> has since carried out the remediation and reports BLOCKING = 0 and UNKNOWN SECURITY EXPOSURE = 0, with every
> residual Critical / High classified as FIXED, MITIGATED or NON-REACHABLE on evidence. Read
> `docs/project/SECURITY-REMEDIATION-REVIEW.md` for the current counts, classifications and open human gates;
> the triage rule in §2.1 below is unchanged and was the rule applied there. Controller review of that module
> has not happened yet, so the release security blocker is closed **pending Controller confirmation**, not by
> this document.

### 2.1 Triage rule

Every Critical finding gets a reachability / exposure / mitigation triage (Controller decision,
FINAL-RELEASE-PRODUCTION-READY-03B):

- **A** — reachable and unmitigated → BLOCKING.
- **B** — feature disabled, network unreachable, build-only or entrypoint-only, *with objective evidence* →
  NON-BLOCKING FINDING (still recorded).
- **C** — uncertain → BLOCKING.

"Not a current process" or "should not be used" is not evidence on its own.

### 2.2 Critical findings

| # | Image | CVE · package | Class | Evidence / reason |
|---|---|---|---|---|
| 1 | Directus | CVE-2026-45618 · liquidjs 10.25.7 → 10.26.0 (RCE, GHSA-gf2q-c269-pqgc) | **A — BLOCKING (admin-gated)** | The advisory needs attacker control of the template *source*. Directus renders Liquid only from template files: `services/mail` reads `EMAIL_TEMPLATES_PATH` (default `./templates`, absent) or the image's system templates, and the system callers pass fixed names (`password-reset`, `user-invitation`, `user-registration`, `base`). Public registration is off, Flows = 0, the public policy has 0 permissions and nobody but Administrator can create files. So unauthenticated and non-admin input cannot reach a template source. An admin-gated path cannot be excluded: the Flow "Send Email" template-name path traversal (GHSA-5h38-6755-g83w, fixed in 12.1.0) combined with an uploaded `.liquid` file. |
| 2 | Directus | CVE-2026-59873 · tar 7.5.13 → 7.5.19 (gzip-bomb DoS) | **A — BLOCKING (admin-gated)** | Used only by the extension installation manager, whose routes require `admin === true`; 0 extensions installed; marketplace installation is not disabled. |
| 3 | Directus | CVE-2026-59873 · tar 7.5.11 (npm CLI of the Node base image) | B | In Directus runtime code, npm is invoked only by `cli/commands/init` (`directus init`). The container command runs `cli.js bootstrap` and then `pm2-runtime`, which starts `cli.js start`. |
| 4 | Directus | CVE-2025-68121 · Go stdlib 1.23.12 in two esbuild binaries | B (build-only) | `crypto/tls` is linked, but no `@directus/*` runtime package or `cli.js` references esbuild. It is present through `@directus/extensions-sdk`, vite and tsx (build / development tooling). 0 extensions. |
| 5 | PostgreSQL | CVE-2025-68121 · Go stdlib 1.24.6 in `/usr/local/bin/gosu` | B — NON-REACHABLE IN NORMAL RUNTIME PATH | `gosu` contains 0 `crypto/tls` and 0 `net/http` symbol references, so the vulnerable TLS code is not linked. It runs once from `docker-entrypoint.sh` (`exec gosu postgres …`) to drop privileges; PID 1 is then `postgres`. The CVE remains in the image. |
| 6 | extractor | CVE-2023-6879 · libaom3 | B | The flaw is in AV1 multi-threaded *encoding*. The extractor writes PNG only; libaom is linked only by the vips HEIF module; `heifload` (priority 0) cannot win against `jpegload` (50) or `pngload` / `webpload` (200) for the only signatures accepted. |
| 7 | extractor | CVE-2026-58016 · libglib2.0-0 | B | The flaw is in D-Bus introspection XML parsing. Across all 143 files of the tool dependency closures and vips modules, only librsvg references that function (`svgload`, flagged untrusted and blocked by `VIPS_BLOCK_UNTRUSTED=1`; SVG not accepted). No D-Bus in the container. |
| 8–9 | extractor | CVE-2026-33845, CVE-2026-42010 · libgnutls30 → 3.7.9-2+deb12u7 | B (fix available) | DTLS handshake parsing and RSA-PSK *server* authentication. The tools read local files only (fixed command allowlist, `shell: false`); the extractor sits only on an `internal: true` network with no egress and runs no TLS server. |
| 10–12 | extractor | CVE-2023-5841, CVE-2026-42216, CVE-2026-42217 · libopenexr | B | `openexrload` is flagged untrusted and blocked; the EXR magic cannot pass the JPEG / PNG / WebP signature check; the Poppler tools do not link OpenEXR. |
| 13 | extractor | CVE-2025-7458 · libsqlite3-0 | B | Requires executing arbitrary SQL. SQLite is linked only by the vips OpenSlide module (`openslideload` untrusted, blocked); nothing accepts SQL. |
| 14 | extractor | CVE-2026-6653 · libxml2 | B | Across the same 143 files, libxml2 parse entry points are referenced only by libgsf (vips `dzsave` / zip output, never used — outputs are PNG), ImageMagick (`magickload`) and OpenSlide (`openslideload`); both of those loaders are flagged untrusted and blocked, and `magickload` also has the lowest loader priority (−100). Poppler tools do not link libxml2. |
| 15–17 | extractor | CVE-2026-13221, CVE-2026-42496, CVE-2026-8376 · perl-base | B | Perl is never executed: the extractor spawns only `prlimit` with `pdfinfo`, `pdftotext`, `vipsheader`, `vips` or `tesseract`, `shell: false`; no tool links libperl; CVE-2026-8376 affects 32-bit builds only (image is amd64). |
| 18 | extractor | CVE-2023-45853 · zlib1g | B | The flaw is in MiniZip. `libz.so.1` exports no MiniZip symbol and libminizip is not installed. |
| 19 | extractor | CVE-2026-59873 · tar 7.5.11 (npm CLI of the Node base image) | B | npm is not in the extractor's spawn allowlist; containers run `node server.mjs` / `node gateway.mjs`. |

Summary: 19 unique Critical findings — **2 BLOCKING (Directus, admin-gated)**, 17 non-blocking findings
with objective evidence. The two blocking ones have fixes only through a Directus release.

### 2.3 Directus 11.17.4 security advisories

Source: the directus/directus GitHub security advisories and the GitHub Advisory Database, checked
2026-09-17. **21 advisories cover 11.17.4** (1 critical, 11 high, 9 medium); every fix is in 12.x (12.0.0 to
12.3.1) with no 11.x backport. Applicability to the local configuration:

**Directus exposure facts:**
- **Network:** compose publishes `127.0.0.1:8055` only, in the production base file as well. The documented
  production intent is administration through an SSH tunnel with no public route (`docs/ADMIN-CMS-SETUP.md`
  §6.2 and §7; RSG-07). Nuxt reaches Directus through the server-side runtime setting `directusUrl`. Production
  is not deployed, so production exposure is **not proven**.
- **Feature flags:** `WEBSOCKETS_ENABLED` is set explicitly to `false`. `CACHE_ENABLED` and `TUS_ENABLED` are
  unset and default to `false` in the pinned `@directus/env` 5.8.0. `AI_ENABLED` defaults to `true`, but no
  LLM provider key is configured.
- **Data:** shares 0 · Flows 0 · Operations 0 · extensions 0 · public registration `false` · public policy
  permissions 0 · only `plpgsql` installed (no PostGIS) · no branding images configured.
- **Identities:** only Administrator can create `directus_files`; the `nuxt-server` policy has
  `app_access=false`; there is no other non-admin app user.
- **LITUBO usage:** no GraphQL and no `/files/import` anywhere in LITUBO code. Public Nuxt routes forward no
  client `deep` value and no image-transform width or height.

| Class | Advisories |
|---|---|
| **BLOCKING / TO VERIFY** — unauthenticated, no optional feature involved; depends on proving Directus is not publicly reachable in production | GHSA-gwvv-rr68-cmv6 (high, `deep` prototype-pollution persistent DoS) · GHSA-g293-vf99-xv36 (high, `/graphql/system` alias amplification) · GHSA-xw72-c69j-h2rj (high, Argon2 hash utility DoS) · GHSA-p623-wgx3-wxp8 (medium, side effects before permission checks) · GHSA-6hpw-rhhq-6xq3 (medium, `/settings/owner` pre-authorization side effects) |
| **BLOCKING (admin-gated)** — reachable by the Administrator role, no feature disablement | GHSA-j5h6-vqc3-phqh / CVE-2026-61835 (high, file-import SSRF) · GHSA-7vcx-mhxq-9j96 (high, image-transform DoS; the unauthenticated variant needs branding images, which are not set) · GHSA-5h38-6755-g83w (medium, mail-template path traversal; part of the LiquidJS chain above) |
| **MITIGATED BY FEATURE DISABLEMENT / NOT APPLICABLE** | GHSA-97xr-jchp-xm3c (critical, public WebSocket item access) · GHSA-mww8-4gwh-rjfw (high, WebSocket origin hijacking) · GHSA-ff8w-8crv-9rcf (medium, GraphQL over WebSocket) — WebSockets disabled · GHSA-c6w9-5g5j-jh2p / CVE-2026-61836 (high, cache key) — cache disabled and 0 shares · GHSA-3742-46gx-c8cc, GHSA-xjxq-pj7h-g676 (high, TUS) — TUS disabled · GHSA-4jw7-6mqj-vrhq (high, AI chat SSRF) — no LLM provider key configured · GHSA-chfm-g7r3-vv42 / CVE-2026-10716 (high, PostGIS SQL injection) — PostGIS not installed · GHSA-fq27-7m2r-q6vm (medium, manual Flows) — 0 Flows · GHSA-7h45-q5jx-7r87 (medium, share update) — no non-admin share permission, 0 shares · GHSA-r9xq-xp38-j4j3 (medium, settings readable by app users) — no non-admin app user · GHSA-788p-cvgf-q973 (medium, `project_color` XSS) — only Administrator can update settings · GHSA-8xp8-xrh2-88vr (medium, registration on MySQL / MariaDB) — PostgreSQL and registration disabled |

### 2.4 Unknown / to verify

- Whether production Directus is reachable only from the Nuxt host (drives the five unauthenticated advisories).
- Production document-extractor topology (host-process Nuxt with the loopback gateway, or containerized Nuxt on the internal network).
- Whether the Administrator role's credentials and access path meet the risk the admin-gated findings imply.

---

## 3. Human commercial / legal confirmation

| Item | Owner | Required before production |
|---|---|---|
| **Directus 11.17.4 — BUSL-1.1 Additional Use Grant** (production use while Total Finances ≤ US $5,000,000 over the most recent 12 months, as defined in the license) | User / Business | Confirm eligibility, or obtain a commercial license. Claude does not assess eligibility and gives no legal conclusion. Not a blocker for this local module; **a Production Preflight blocker**, and it must stay on the Final Release Verification checklist. |
| Poppler (GPL family), libvips (LGPL-2.1), util-linux (mixed) in the document-extractor image | User / Business, legal adviser as needed | Human legal review of any obligations under the actual deployment / distribution model. |
| PostgreSQL | — | Resolved: PostgreSQL License, official upstream evidence. |

**License terms can change between Directus releases; re-review required before future upgrade.** The
evidence above belongs to the pinned 11.17.4 image only and must not be mixed with the terms of another
release.

> **Superseded for Directus (2026-09-18, D-042).** That re-review has happened: 12.3.1 is **MSCL-1.0-GPL**, not
> BUSL-1.1, and the instance runs on an Open Innovation Grant key obtained by the business owner. The BUSL-1.1
> row in §1.5 and the first row of §3 apply only to the retired 11.17.4 image. The current, still-open human
> gates for Directus — OIG eligibility (revenue / headcount, grant usage agreement, one year renewable,
> 5 activations) and the fact that this licence requires telemetry that cannot be switched off — are listed in
> `docs/project/SECURITY-REMEDIATION-REVIEW.md` §7. The Poppler / libvips / util-linux rows are unchanged.

---

## 4. Open production operations

- Container security remediation — `FINAL-RELEASE-SECURITY-REMEDIATION-01` (§2).
- Repeatable CVE and advisory monitoring after this review (new Directus, Node, PostgreSQL and Debian advisories keep arriving; this review is a point-in-time record).
- Production capacity: server CPU / memory sizing, behaviour behind Cloudflare / Nginx / TLS, published-content load.
- Production network exposure of Directus (SSH tunnel only, no public route) and of the document-extractor.
- Production commercial / legal confirmation (§3).
- `SUBMISSION_IP_SECRET` presence check in Production Preflight — Controller decision: the existing built-in fallback stays and is not a V1 blocker; preflight checks exists / missing only and never reads the value.
- Production / offsite backup storage, retention, encryption at rest and scheduling (D-040, still open).

---

## 5. Reproducing this review

```bash
node scripts/verify-node-runtime.mjs
node scripts/verify-directus-pin.mjs
node scripts/verify-postgres-pin.mjs
npm run release:verify
node scripts/local-capacity-smoke.mjs --base-url http://127.0.0.1:3310 --levels 1,5,10,20 --requests 60
npm audit --omit=dev --json --registry=https://registry.npmjs.org/
docker buildx imagetools inspect postgres:16.15-alpine
```

- **Capacity target:** a local production build started as
  `node --env-file=.env --env-file=<a file setting NITRO_HOST=127.0.0.1 and NITRO_PORT=3310> .output/server/index.mjs`.
  The tool refuses non-loopback targets, sends GET only to the allowlisted routes, never sends cookies or
  credentials, never follows redirects and bounds concurrency (≤ 20), requests (≤ 500 per level) and timeouts.
- **Container scan:** use Trivy from a pinned official release with its checksum verified,
  `trivy image --image-src docker --scanners vuln --format json --output <outside Git> <image>`. Keep the
  binary, the DB and the JSON outside Git.
