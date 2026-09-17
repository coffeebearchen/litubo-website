# Security Remediation Review

> Module: FINAL-RELEASE-SECURITY-REMEDIATION-01 · 2026-09-17 · local development environment.
> **Result: SECURITY REMEDIATION INCOMPLETE — BLOCKING ITEMS REMAIN.** The module stopped at a commercial /
> license decision before changing anything. No image, dependency, configuration, network, permission or data
> change was made, so every open item in `PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md` §2 is still open.
> Final Release Verification: **NOT STARTED**. Nothing here is a legal conclusion or an eligibility assessment.
>
> **Update (2026-09-17):** the business owner obtained an Open Innovation Grant license key, and the module continues
> on path A (§6). The key's value has never been seen or recorded here.

---

## 1. Why the module stopped

Every official fix for the Directus advisories that apply to 11.17.4 ships only in Directus 12.x (§2).
Directus 12 changed its license and enforces it in code. Without a license key, the permission rules that the
least-privilege `nuxt-server` identity depends on are removed from permission evaluation, and a new installation
that uses them is locked (§3). Keeping those rules on 12.x needs a license key: either the free Open Innovation
Grant, which has business eligibility criteria and a grant agreement, or a paid plan.

That choice belongs to the business owner. It meets two of the work order's STOP conditions: a commercial /
legal decision is required, and the authorized scope cannot resolve the blockers safely. Staying on 11.17.4 does
not close them either (§4). No upgrade was attempted.

---

## 2. Official advisory matrix — Directus 11.17.4

**Source.** The directus/directus repository security advisories (GitHub REST API, 78 published advisories) and
the GitHub release list, both fetched 2026-09-17. An advisory applies when its affected range includes 11.17.4
and none of its patched versions is at or below 11.17.4. Fifteen older advisories publish open-ended ranges but
are patched at or below 11.17.4, so they do not apply.

**Result.** **21 advisories apply** (1 critical, 11 high, 9 medium). Their first fixed versions are 12.0.0 (2),
12.1.0 (12), 12.2.0 (5) and 12.3.1 (2). No Directus release after 11.17.4 exists on the 11.x line, and no
advisory names an 11.x backport.

**Classification rule.** This module applies the Controller's rule: an admin-only path is not a safety conclusion.
`GHSA-788p-cvgf-q973`, which PR03 recorded as mitigated because only the Administrator can update settings, is
therefore BLOCKING (admin-gated) here.

| # | Advisory | Sev. | Fixed in | Trigger | Exposure on the local stack | Status after this module |
|---|---|---|---|---|---|---|
| 1 | GHSA-97xr-jchp-xm3c | critical | 12.1.0 | Public WebSocket client after a failed auth message | `WEBSOCKETS_ENABLED=false` | MITIGATED (feature disabled) — not fixed |
| 2 | GHSA-c6w9-5g5j-jh2p · CVE-2026-61836 | high | 12.0.0 | Cache key not segmented by authorization | Cache off (default `false`); 0 shares | MITIGATED — not fixed |
| 3 | GHSA-j5h6-vqc3-phqh · CVE-2026-61835 | high | 12.0.0 | File-import SSRF via `0.0.0.0` | Admin-gated; LITUBO never calls `/files/import` | **BLOCKING** |
| 4 | GHSA-3742-46gx-c8cc | high | 12.1.0 | TUS upload path validation | TUS off (default `false`) | MITIGATED — not fixed |
| 5 | GHSA-xjxq-pj7h-g676 | high | 12.1.0 | TUS authorization bypass | TUS off | MITIGATED — not fixed |
| 6 | GHSA-chfm-g7r3-vv42 · CVE-2026-10716 | high | 12.1.0 | PostGIS geometry SQL injection | PostGIS not installed | NOT APPLICABLE |
| 7 | GHSA-g293-vf99-xv36 | high | 12.1.0 | Anonymous alias amplification on system GraphQL | Unauthenticated; production exposure not proven | **BLOCKING / TO VERIFY** |
| 8 | GHSA-mww8-4gwh-rjfw | high | 12.1.0 | WebSocket origin hijacking | WebSockets off | MITIGATED — not fixed |
| 9 | GHSA-xw72-c69j-h2rj | high | 12.1.0 | Unauthenticated Argon2 hash utility DoS | Unauthenticated; exposure not proven | **BLOCKING / TO VERIFY** |
| 10 | GHSA-4jw7-6mqj-vrhq | high | 12.2.0 | AI chat file-download SSRF | No LLM provider key configured | MITIGATED — not fixed |
| 11 | GHSA-7vcx-mhxq-9j96 | high | 12.2.0 | Image-transform target dimensions DoS | Admin-gated (the unauthenticated variant needs branding images, which are not set) | **BLOCKING** |
| 12 | GHSA-gwvv-rr68-cmv6 | high | 12.2.0 | `deep` prototype-pollution persistent DoS | Unauthenticated; exposure not proven | **BLOCKING / TO VERIFY** |
| 13 | GHSA-5h38-6755-g83w | medium | 12.1.0 | Mail-template path traversal (with CVE-2026-45618, a LiquidJS RCE chain) | Admin-gated | **BLOCKING** |
| 14 | GHSA-6hpw-rhhq-6xq3 | medium | 12.1.0 | `/settings/owner` side effects before authorization | Unauthenticated; exposure not proven | **BLOCKING / TO VERIFY** |
| 15 | GHSA-788p-cvgf-q973 | medium | 12.1.0 | Stored XSS through the project colour | Admin-gated | **BLOCKING** |
| 16 | GHSA-ff8w-8crv-9rcf | medium | 12.1.0 | Unbounded GraphQL documents over WebSocket | WebSockets off | MITIGATED — not fixed |
| 17 | GHSA-p623-wgx3-wxp8 | medium | 12.1.0 | Side effects applied before permission checks | Exposure not proven | **BLOCKING / TO VERIFY** |
| 18 | GHSA-fq27-7m2r-q6vm | medium | 12.2.0 | Manual-trigger Flows run unauthenticated | 0 Flows | MITIGATED while no manual-trigger Flow exists |
| 19 | GHSA-r9xq-xp38-j4j3 | medium | 12.2.0 | Settings readable by minimal app-access users | No non-admin app-access policy exists | NOT APPLICABLE |
| 20 | GHSA-7h45-q5jx-7r87 | medium | 12.3.1 | Share update reassigns `user_created` / role | 0 shares; no non-admin share permission | NOT APPLICABLE |
| 21 | GHSA-8xp8-xrh2-88vr | medium | 12.3.1 | Registration e-mail on MySQL / MariaDB | PostgreSQL; registration disabled | NOT APPLICABLE |

**Container findings (PR03 Trivy scan, unchanged).** Two findings are BLOCKING (admin-gated):
- CVE-2026-45618 in liquidjs 10.25.7;
- CVE-2026-59873 in tar 7.5.13.

The `pnpm-lock.yaml` of each tag shows:
- v11.17.4: liquidjs 10.25.7 and tar 7.5.13;
- v12.3.1: liquidjs 10.27.2 and tar 7.5.22, above their fixed versions 10.26.0 and 7.5.19.

The 12.3.1 image itself was not pulled or scanned.

**Minimum secure version: 12.3.1.** It was released 2026-08-25 and is also the latest release. 12.2.0 fixes 19 of
the 21; the remaining two (rows 20 and 21) are not applicable here.

**Summary now.**
- BLOCKING: 4 advisories (admin-gated) plus the 2 container Criticals.
- BLOCKING / TO VERIFY: 5 advisories (unauthenticated).
- MITIGATED or NOT APPLICABLE: 12 advisories.
- FIXED: 0.

---

## 3. Directus 12 license and enforcement — facts

### 3.1 License text

| Tag | `license` file | SHA-256 |
|---|---|---|
| v11.17.4 | Business Source License 1.1 | `d834350451105865ecb23f4365c306d40cb90f58ffeb1c87d3ee696546274b11` |
| v12.0.0, v12.3.1 | Monospace Sustainable Core License 1.0, abbreviation MSCL-1.0-GPL | `f209dfa60e56b29f6e8e5cefde91dec4ce86f12289209ede63520556385d555d` |

Directus 12.0.0's release notes list the relicensing from BUSL-1.1 as a breaking change. Paraphrased, not
interpreted, the MSCL-1.0-GPL text:
- permits use for any purpose except a "Competing Use", and names internal use explicitly;
- forbids moving, changing, disabling or circumventing the license-key functionality to reach protected
  functionality without a valid key;
- grants a GPL-3.0 license on the fourth anniversary of each release.

The license file inside the 12.3.1 Docker image was not checked, because the image was not pulled.

### 3.2 Enforcement in Directus 12.3.1

**Core tier.** Without a license the instance runs on the Core tier. Its entitlements are `CORE_LICENSE` in
`@directus/license` 0.4.0, the version 12.3.1 depends on:
- 3 seats, 25 collections, 5 Flows;
- SSO off, custom LLMs off and **custom permission rules off**;
- **telemetry required**;
- activity and revision history window of 30 days;
- AI translations off.

**What counts as a custom permission rule.** A non-system permission is one when any of the following holds,
unless it equals a recommended app permission (`hasCustomRule`, `api/src/license/entitlements/lib/custom-permission-rules-enabled.ts`):
- its field list is not `*`;
- it has an item filter;
- it has validation;
- it has presets.

**Runtime effect without the entitlement.**
- Runtime permission evaluation reads permissions through `PermissionsService.readByQuery`
  (`api/src/permissions/utils/fetch-raw-permissions.ts`).
- That method drops every custom-rule permission (`api/src/services/permissions.ts`).
- Creating or updating a custom-rule permission through the service is refused.

**License status** (`api/src/license/utils/compute-license-status.ts`, `get-core-grace-expires-at.ts`). With no
license and usage over the Core entitlements, the status is:
- `grace` only within 30 days of the v12 migration, and only on an instance installed at least one day earlier;
- `locked` otherwise, including every clean install.

A `locked` instance rejects every items, files, assets, GraphQL and MCP request, and the Flow trigger routes. The
check (`api/src/middleware/is-locked.ts`) does not look at the caller, so Administrator requests are rejected too.

**License key** (`api/src/license/manager.ts`; docs `licensing/overview`).
- It is configured as `LICENSE_KEY` in the environment, or stored through the Studio.
- With `LICENSE_KEY` set, Directus activates, updates or refreshes the license against
  `https://licensing.directus.com` at startup. If activating or updating fails, it exits. A failed network refresh
  of an already activated key is logged, and the stored token keeps being used.
- The activation binds to the project and to an absolute `PUBLIC_URL`.
- Online mode revalidates periodically and sends the project id, the public URL and the seat, collection and Flow
  counts.
- Offline license tokens are Enterprise-only.

**Open Innovation Grant** (docs `licensing/open-innovation-grant`; `https://directus.com/pricing`, retrieved
2026-09-17).
- Free commercial self-hosted use for entities with less than US $5M annual revenue and fewer than 50 employees,
  under a grant usage agreement.
- A key is valid for one year and is renewable.
- A key has 5 activations. An instance must be deactivated before it is destroyed; otherwise its activation stays
  consumed.

**Telemetry** (docs `licensing/telemetry`).
- Some licenses require telemetry, and those ignore `TELEMETRY=false`.
- The Core tier has `telemetry_required: true`.
- The pricing page lists telemetry opt-out only for Enterprise.
- Whether an Open Innovation Grant license lifts the requirement is **UNKNOWN**; it cannot be checked without a key.

**Other 12.x breaking changes relevant to LITUBO** (docs `releases/breaking-changes/version-12`, 12.0.0 release notes):
- `IP_TRUST_PROXY` now defaults to `false`.
- Unauthenticated `/server/health` returns 404; use `/server/ping` for liveness.
- npm / npx are removed from the image (12.1.0).
- The `/utils/hash/*` endpoints are removed (12.1.0).
- Image transformation output has a cap, `ASSETS_TRANSFORM_IMAGE_MAX_OUTPUT_DIMENSION`.
- Imports have a 50 MB default cap.
- A valueless boolean query flag now counts as true.
- New App Access policies get narrower minimal permissions.

### 3.3 LITUBO against the Core tier

Measured with read-only SQL on the local development database:
- 20 user collections (limit 25);
- 1 Studio seat (Administrator) and 1 API-only service user;
- 0 Flows, no SSO, no Directus LLM provider;
- on `site-readonly-policy`, the `nuxt-server` identity (D-034 / D-038 / FINAL-RELEASE-FIX-E): **19 of 19
  permission rows have an explicit field list, and 15 also have an item filter.** All 19 are custom permission rules.

**Consequences, read from the 12.3.1 source (not executed).**
- **No license.** All 19 rows drop out of permission evaluation. Every public CMS read made as `nuxt-server` is
  refused, so the public CMS routes fail closed.
- **New production instance.** A production instance provisioned fresh on 12.x is `locked` at once. That also
  blocks the Administrator's items / files / assets requests, which the LITUBO admin makes.
- **Upgraded development instance.** It would get the 30-day grace against locking. INFERRED from the same code,
  not tested: the dropped rules get no grace, because the entitlement check has no grace override.

**Excluded remediation.** Replacing the field lists and item filters with unrestricted `*` permissions to fit the
Core tier would remove the identity-level least privilege that RSG-07 requires and that the D-034 artifacts own.

**INFERRED, not tested.** The 30-day activity / revision window would limit Content Center Change History,
because CC-IMP-07 reads Directus revisions and activity.

---

## 4. Staying on 11.17.4

- There is no newer 11.x release and no backport.
- The pinned 11.17.4 configuration contract (`@directus/env` defaults in the running image) has no switch that
  disables Flows or the mail-template path. The only Flow settings are `FLOWS_ENV_ALLOW_LIST`,
  `FLOWS_RUN_SCRIPT_MAX_MEMORY` and `FLOWS_RUN_SCRIPT_TIMEOUT`.
- The admin-gated LiquidJS chain (CVE-2026-45618 with GHSA-5h38-6755-g83w) therefore has neither a fix nor a
  feature-disable mitigation on 11.17.4. It stays BLOCKING.
- The admin-gated file-import SSRF and image-transform DoS stay BLOCKING. Closing them by configuration on 11.17.4
  would need code-level proof that has not been produced.
- The five unauthenticated advisories still need proof that production Directus is reachable only from the Nuxt
  host (§5).

---

## 5. Areas not remediated — status unchanged

### Directus production exposure: TO VERIFY

Supporting intent in the repository:
- The production base compose file binds `127.0.0.1:8055` only.
- `docs/ADMIN-CMS-SETUP.md` §6.2 / §7 make an SSH tunnel the only production administration path, with no
  admin subdomain and no Nginx route.

Gaps:
- The repository contains no Nginx configuration.
- The production Nuxt runtime method is still undecided (`PRODUCTION-PROVISIONING-RUNBOOK.md` §4).
- `docs/OPERATIONS-HANDBOOK.md` §1 still gives `https://cms.litubo.com/admin` as an example Directus address,
  which contradicts that intent.

### Directus hardening: not changed

Facts for the next module, from the running 11.17.4 image:
- **Telemetry.** `TELEMETRY` defaults to `true`, and the telemetry schedule reports to
  `https://telemetry.directus.io` at startup and every 6 hours. The Directus container's network is not
  `internal`, so an outbound route exists. Actual transmission was not captured.
- **Other defaults.** `MCP_ENABLED` and `AI_ENABLED` default to `true`, `MARKETPLACE_TRUST` defaults to
  `sandbox`, and `GRAPHQL_INTROSPECTION` defaults to `true`.
- **`PUBLIC_REGISTRATION`.** The compose key is not read by the 11.17.4 runtime; it appears only in the
  `directus init` env template. Public registration is actually closed by the database setting
  `public_registration = false`.

### Other areas

- **document-extractor.** The PR03 reachability triage stands: 14 Criticals, non-blocking with evidence.
  Production topology is still TO VERIFY. Nothing changed.
- **PostgreSQL.** The 16.15 immutable pin is unchanged. The `gosu` Critical stays non-reachable in the normal
  runtime path, and the image is not clean. Nothing changed.
- **Trivy.** No rescan was run, because no image changed. PR03's scan remains the before-state; there is no
  after-state.

---

## 6. Decision required

**Decision taken (2026-09-17).** The business owner obtained an Open Innovation Grant license key and instructed
the module to continue. The key is wired into the existing runtime secret path as `DIRECTUS_LICENSE_KEY`:
- the ignored `.env` locally, the deployment secret manager in production;
- Compose passes it to the Directus container as `LICENSE_KEY`;
- details in `PRODUCTION-PROVISIONING-RUNBOOK.md` §2.

The options below record the question as it stood when the module stopped.

**Business owner.** Decide whether LITUBO obtains a Directus license key for 12.x:
- through the Open Innovation Grant, which means checking eligibility against its criteria and accepting its
  agreement;
- or through a paid plan;
- or not at all.

**Controller.** The remediation path follows from that answer.

**A — Licensed upgrade to 12.3.1.** A new work order would cover:
- `LICENSE_KEY` as a runtime-only secret (D-039);
- outbound HTTPS to `licensing.directus.com`, and to the telemetry service if the license requires it;
- an absolute `PUBLIC_URL` per environment;
- activation handling for disposable restore rehearsals (D-040);
- the 12.x breaking changes in §3.2;
- full regression.

**B — Stay on 11.17.4.** This needs an explicit Controller decision on the admin-gated findings, a decision this
module's rule does not let Claude make, plus proof of production exposure.

**C — Any other CMS direction.** This is an architecture change outside this module.

---

## 7. Evidence

- **Advisories.** GitHub REST `repos/directus/directus/security-advisories`, 78 published, fetched 2026-09-17.
- **Releases.** The GitHub release list; the latest release is 12.3.1, dated 2026-08-25.
- **License texts.** `https://raw.githubusercontent.com/directus/directus/<tag>/license` for v11.17.4, v12.0.0 and
  v12.3.1.
- **Source.** The v12.3.1 source archive from `codeload.github.com`, files as cited above.
- **License package.** `@directus/license` 0.4.0 from the npm registry, SHA-256
  `a46dba51932c76f8418ad298186a473f7892927624c465d70400566053ca8283`.
- **Lockfiles.** `pnpm-lock.yaml` at v11.17.4 and v12.3.1.
- **Documentation.** The `directus/docs` main branch, retrieved 2026-09-17:
  `content/releases/3.breaking-changes/3.version-12.md` and `content/licensing/1.overview.md`,
  `2.telemetry.md` and `3.open-innovation-grant.md`.
- **LITUBO facts.**
  - Read-only SQL on the local development database.
  - `@directus/env` defaults and the `@directus/api` distribution inside the running 11.17.4 container.
- **Storage.** Raw downloads stay in the session scratch directory, outside Git.
