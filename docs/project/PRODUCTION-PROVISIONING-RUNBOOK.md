# Production Provisioning Runbook

> Scope: building a **new Directus + PostgreSQL environment** from this repository.
> This runbook does not deploy, does not change DNS, and does not itself back up or restore — that is
> `docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md`.
> Production deployment remains **NOT AUTHORIZED** and requires its own TYPE D authorization
> (`PROJECT-EXECUTION-PROTOCOL.md` §4, §13.4).

The normative contract is `docs/project/RELEASE-SAFETY-GATES.md` §3A.8. The **executable order** is
`scripts/provisioning-manifest.json`, run by `scripts/provision-directus.mjs`. This document
explains and references them; it deliberately does **not** restate the step order, so the order
cannot drift between a script, a manifest and a runbook.

---

## 0. What this repository provisions, and the one thing it cannot

A fresh environment **is provisioned from Git**, with one deliberate exception: the secret.

FINAL-RELEASE-PRODUCTION-READY-01 rehearsed provisioning on a disposable local database and the
chain stopped at `expected exactly one role nuxt-server, found 0` — a Directus schema snapshot
carries collections, fields and relations only, and the tracked permission artifacts own permission
rows on a policy that has to exist already. The role, the policy, the link between them and the
service user had all been made by hand, once, in a single database. FINAL-RELEASE-PRODUCTION-READY-01A
closed that gap: `directus/schema/directus-access-01-nuxt-server-site-readonly.sql` now owns those
four objects and runs as step `31`, before either permission artifact.

**The exception is the static token.** A Directus static token is stored as-is and cannot be derived,
so it must be supplied. The repository provisions the identity that holds it and never the value:

| Layer | Owner | In Git |
|---|---|---|
| collections, fields, relations | `directus/schema/cc-imp-01-after.yaml` | yes |
| role `nuxt-server`, policy `site-readonly-policy`, their access link, the service user | `directus-access-01-nuxt-server-site-readonly.sql` | yes |
| the service user's static token, `DIRECTUS_TOKEN` | the deployment environment / secret manager | **never** |
| the three Content permission rows | `directus-permissions-01-…sql` (D-034) | yes |
| the sixteen legacy site permission rows | `directus-permissions-02-…sql` (FINAL-RELEASE-FIX-E) | yes |

Provisioning therefore needs exactly one secret in its environment: `DIRECTUS_TOKEN`, the same
secret the Nuxt server authenticates with (§2). Without it the run stops and reports the
environment as not provisioned — it does not quietly produce an environment that cannot serve.

No step of this runbook requires a manual `INSERT`, and none should be added. If a future
environment appears to need one, that is a gap in an artifact; fix the artifact.

---

## 1. Prerequisites

| Item | Required value | How to verify |
|---|---|---|
| Node | **22.22.2** exactly (`.nvmrc`, `package.json` engines) | `node scripts/verify-node-runtime.mjs` — non-zero exit on any other version; also the first step of `npm run release:verify` |
| npm | the npm bundled with that Node (10.9.7) | `npm -v` |
| Directus image | **12.3.1** — `directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869` (D-042) | `node scripts/verify-directus-pin.mjs` |
| PostgreSQL image | **16.15** — `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` (D-041; floating tags are not allowed) | `node scripts/verify-postgres-pin.mjs` — declaration, running image, digest and `server_version` |
| Architecture | validated on **linux/amd64**; the pin is the multi-architecture image index, so `linux/arm64` also resolves | `docker buildx imagetools inspect <image>` lists both platforms |

**Architecture note.** The pinned digest is the OCI image *index*, not a single-platform manifest, so
pinning does not choose the deployment architecture. The only architecture this project has actually
run and verified is `linux/amd64`. Confirm the target server's architecture during deployment
preflight; it has not been verified here.

**Backup prerequisite.** `RELEASE-SAFETY-GATES.md` §3A.8 steps 7 and 8 require a verified restorable
backup before any production mutation, plus a written rollback plan. Backups are made and restored with
`docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md` (D-040): the database and the Directus uploads as one
set, taken in a quiesced window and verified by restoring it into TEST targets. The tooling and a local
rehearsal are proven; production backup storage is not, and a written production rollback / cut-over
plan is still not provided. Nothing in this runbook creates a backup: take one before a production
mutation, and treat the rollback plan as an open prerequisite, not a solved one.

**Dependency, license, security and capacity review.** `docs/project/PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md`
(D-041) records the pinned runtimes, a local capacity baseline, the npm and container vulnerability scans and
the license inventory. Its container security findings were owned by `FINAL-RELEASE-SECURITY-REMEDIATION-01`,
whose result is recorded in `docs/project/SECURITY-REMEDIATION-REVIEW.md`. Changing the PostgreSQL or Directus
pin recreates a container, so take and verify a backup set first.

**Directus 12.3.1 and its license (D-042).** `FINAL-RELEASE-SECURITY-REMEDIATION-01` moved Directus from 11.17.4
to 12.3.1, the lowest release that fixes every Directus advisory that applied to 11.17.4. Directus 12 is
relicensed (MSCL-1.0-GPL) and enforces its license in code. The business owner obtained an Open Innovation Grant
(OIG) license key: they confirmed the organisation meets the grant's revenue / headcount conditions themselves,
submitted the application themselves, and Directus issued the key. The grant is perpetual — no expiration date and
no renewal process — and carries five activations. This runbook records those facts and states no legal
conclusion. Measured locally on 12.3.1:
- **With the OIG key** the license is `active`, custom permission rules are entitled, and every public CMS response
  of the production build matched the 11.17.4 baseline (42 of 42 routes).
- **Without a key** the instance stays `active` for LITUBO's usage, because only seats, collections, Flows and SSO
  can lock it; but all nineteen `nuxt-server` permission rows drop out of permission evaluation. Every CMS read
  of that identity was refused (403), and the public CMS endpoints and the sitemap answered 503.
- An earlier statement here that such an instance would be locked was inaccurate and is withdrawn.

---

## 2. Environment variables

Names only — this repository never stores values. `.env.example` lists every name and is the
authoritative list; it currently covers all ten variables `docker-compose.yml` requires.

Required by `docker-compose.yml`: `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_DATA_DIR`,
`DIRECTUS_UPLOADS_DIR`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`,
`DIRECTUS_PUBLIC_URL`, `DIRECTUS_LICENSE_KEY`.

**`DIRECTUS_LICENSE_KEY` — the Directus license key.**
- **Who receives it.** Only the Directus container, as `LICENSE_KEY`, through `docker-compose.yml` — the same
  way `DIRECTUS_SECRET` becomes `SECRET`.
- **Where it lives.** Locally, in the ignored `.env`; in production, the deployment secret manager supplies
  it to Compose. It is never in Git, never supplied to a Nuxt build, and never read by the Nuxt server or by
  provisioning.
- **When it is needed.** Always, with the pinned Directus 12.3.1. Without it the Core tier drops every
  `nuxt-server` permission row and the public CMS reads fail closed (§1;
  `docs/project/SECURITY-REMEDIATION-REVIEW.md` §3).
- **Activation.** The first Directus process that starts with the key against a database holding no license
  activates it against `https://licensing.directus.com`. On a fresh environment that is provisioning step `10`
  (`schema apply` loads the license). The activation binds to the project and `DIRECTUS_PUBLIC_URL`, which must be
  an absolute URL. Directus stores the key and the returned token in `directus_settings`, so every later backup
  set carries them and is secret material. Later starts revalidate the binding online, so the Directus container
  needs outbound HTTPS to that host.
- **Activations are limited.** An OIG key has five, meant for one project's environments. They are released only by
  deactivation, and a stranded one needs Directus support.
- **Deactivating an environment-managed license** (FINAL-RELEASE-SECURITY-REMEDIATION-01 did this twice on
  disposable instances):
  1. Restart that Directus with `LICENSE_KEY` empty; the license source becomes `settings`.
  2. As an administrator, call `DELETE /license` (204).
  3. Check that `GET /license` reports `source: null` and that `directus_settings.license_key` is empty.

  Do this before destroying any instance that activated the key.
- **Never deactivate in a copy of another environment.** A restore of an environment's backup into the same
  project and `PUBLIC_URL` revalidates that environment's binding without a new activation.
  INFERRED from the licensing documentation, not tested: deactivating in such a copy would release the live
  environment's binding.
- **Telemetry is part of the OIG license.** Its entitlement `telemetry_required` is `true`: **OIG entitlement
  requires telemetry; telemetry opt-out is not available under the current OIG tier.** Directus sends its usage
  report to `https://telemetry.directus.io` — aggregate counts, the public URL and the project id, and no content.
  `docker-compose.yml` deliberately declares **no `TELEMETRY` variable**: a value there would be ignored while
  reading as "telemetry is off", so the file carries the reason as a comment instead. Do not add one.
  `PROJECT_OWNER_ENABLED: "false"` still stops the separate owner registration.
- **Grant terms.** The OIG is granted in perpetuity, has no expiration date and requires no renewal process; each
  grant key carries five activations. Eligibility (revenue / headcount, grant usage agreement) is the business
  owner's confirmation, and the runbook states no legal conclusion.

**`DIRECTUS_TOKEN` — the one secret.** `DIRECTUS_TOKEN` is supplied once by deployment secret
management and is used both to provision the nuxt-server service user's static token and by Nuxt at
runtime. It is the same variable `.env.example` lists for the application: step `32` installs its
value on the service user, and the running Nuxt server reads it from its own process environment and
sends it as the Bearer token on every public CMS read. There is no second variable to keep equal to it
by hand.

- Provisioning reads it from its own process environment — never from `.env` — passes it to the
  container on stdin, and redacts it from everything it prints. It never appears in a command line,
  a process listing, a log or this repository.
- Absent or empty → the run stops before it touches the database. Shorter than 32 characters → step
  `32` refuses and writes nothing.
- `--without-service-token` builds the structure without it and says loudly that the environment
  cannot serve. Use it only to inspect a structure, never as a way past a missing secret.

**Build, provisioning, runtime — one secret, and the build is not one of the places it goes.**

| Phase | Needs `DIRECTUS_TOKEN`? | Where the value comes from |
|---|---|---|
| Build — `nuxt build` | **No.** A production build artifact must be secret-free; it is not secret material. | Nowhere. `nuxt.config.ts` does not declare it, so a build has nothing to serialize. Do not supply the production value to a build. |
| Provisioning — step `32` | Yes | The secret manager, into the environment of `scripts/provision-directus.mjs` (§3). |
| Runtime — the running Nuxt server | Yes, the same value | The secret manager, into the environment of the server process when it starts. The server reads it when it uses it (`server/utils/directusServiceToken.ts`). |

FINAL-RELEASE-PRODUCTION-READY-01C measured this with random TEST values against a disposable
Directus. A server was built with value **A** as `DIRECTUS_TOKEN` in the build environment. Every file
of `.output` was then scanned — each `.gz` / `.br` asset decompressed, source maps included — and **A**
was found **0** times. The same build was then started with different run-time environments:

| Directus holds | Server started with | Result |
|---|---|---|
| **A**, the build-time value | no `DIRECTUS_TOKEN` | refused before any request reached Directus — the build-time value is not used even where it would be valid |
| **A** | `DIRECTUS_TOKEN` = A | authenticated |
| **A** | a wrong `DIRECTUS_TOKEN` | refused (401) |
| **B**, rotated through step `32` | `DIRECTUS_TOKEN` = B | authenticated — no rebuild |
| **B** | no token · a wrong value · the old build-time value A | refused (0 requests · 401 · 401) |
| **B** | only `NUXT_DIRECTUS_TOKEN` = B | refused before any request |
| **B** | only a `.env` file containing B in the server's working directory | refused before any request — a built server does not read `.env` files |

Consequences for deployment:

- Put `DIRECTUS_TOKEN` into the environment of the Nuxt server process when it starts. The mechanism
  (process manager, container environment, secret-manager integration) belongs to the still-undecided
  production runtime method (§4); the contract does not depend on it.
- A missing value fails closed and no anonymous request is made. Public CMS reads answer as they do
  for any Directus failure (measured: the legacy posts list returns `cmsError`, product categories and
  the Content Center list answer 503), and the AI source-reference endpoints answer 503.
- `nuxt dev` loads `.env` into its own environment, so a local `.env` keeps working in development
  (verified with a TEST dotenv file).
- `NUXT_DIRECTUS_TOKEN` is Nuxt's generic run-time override for a `runtimeConfig` key. There is no such
  key any more, so it has no effect, and it is **not** part of the LITUBO secret contract.

**Every server secret — runtime only (D-039).** The rule `DIRECTUS_TOKEN` follows is the rule for every
secret the Nuxt server uses:

- **Build phase** — `nuxt build` does not require production server secrets. `nuxt.config.ts` declares
  none of them, so a build has nothing to serialize. Do not supply their production values to a build.
- **Runtime phase** — the server process receives each secret it needs in its environment, from the
  deployment environment / secret manager, when it starts. The server reads it when it uses it
  (`server/utils/directusServiceToken.ts`, `server/utils/serverSecrets.ts`), so a rotation takes a
  restart, not a rebuild.

| Variable (name only) | Used for | Without it (existing behaviour, unchanged) |
|---|---|---|
| `DIRECTUS_TOKEN` | Public CMS reads, inquiry storage, the AI source-reference key | CMS reads refused, inquiry submissions answer 503, AI source selection answers 503 |
| `SMTP_PASS` | Authenticating inquiry notification emails | the best-effort notification fails; the inquiry itself is still stored |
| `SUBMISSION_IP_SECRET` | Keying the hash of client addresses in the in-process rate limiter | the limiter still applies, keyed with a built-in fallback. Controller decision (FINAL-RELEASE-PRODUCTION-READY-03): the fallback stays and is not a V1 blocker; Production Preflight must confirm the variable is configured — presence only, never its value |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Contact sync | inquiries are stored as `not_configured`; no HubSpot request |
| `OPENAI_API_KEY` | The OpenAI provider | the provider reports "not configured"; no request |
| `DEEPSEEK_API_KEY` | The DeepSeek provider | the provider reports "not configured"; no request |

FINAL-RELEASE-PRODUCTION-READY-01D measured the whole set with synthetic canaries — three distinct values
per secret — and no real credential, no real email and no external call:

- **Before the change**, a build with a canary for each secret in its environment serialized
  `SMTP_PASS`, `SUBMISSION_IP_SECRET`, `HUBSPOT_ACCESS_TOKEN`, `OPENAI_API_KEY` and `DEEPSEEK_API_KEY`
  once each into `.output/server/chunks/_/nitro.mjs`.
- **After it**, the same kind of build contained each of the eighteen canaries **0** times — browser
  assets, server bundle, source maps, decompressed `.gz` / `.br` assets and `.nuxt` included — and each
  secret kept exactly one run-time read in the server bundle.
- That build, started with other values at run time, authenticated to a local fake SMTP server with the
  **run-time** `SMTP_PASS` (a wrong run-time value was used as given; with none, no credentials were
  sent), and the fake refused every message, so nothing was delivered anywhere. With the HubSpot canary
  in the build environment and none at run time, inquiries were stored as `not_configured` and no
  HubSpot request was made. No canary appeared in any HTTP response (SSR HTML and payload included),
  server log or Directus log.
- `SUBMISSION_IP_SECRET` and the AI keys cannot be observed from outside a built server without a real
  provider call, so they rest on the build-time value being absent (0 occurrences) and on unit tests
  showing that each consumer uses the value present when it is called.

This is a local proof. No production secret manager or production injection mechanism has been
exercised.

**Rotation.** One change in the secret manager, then two actions: re-run step `32` with the new value
and restart Directus, and restart the Nuxt server with the new value in its environment. No rebuild is
needed — the build never held the old value. Until both are done, reads through `directusFetch` are
refused. Rotation also invalidates outstanding AI source references, whose key is derived from the
token; they live 30 minutes and are simply minted again. Every other server secret rotates with a
restart alone: change it in the secret manager and restart the Nuxt server — no rebuild.

Two production values are load-bearing and fail closed if wrong:

- `CMS_MODE` and `CMS_MODE_PRODUCTS` must be exactly `directus`. Missing, empty or any other value
  makes the public CMS endpoints return 503 rather than serve DEMO fixtures.
- `PRODUCT_AI_APPLY_ENABLED` must be exactly `true` to enable Product AI Apply; it is absent by
  default, and absent means closed.

---

## 3. Provisioning

```bash
# 1. Create the target database (the script never creates databases).
# 2. Put DIRECTUS_TOKEN in the environment (see §2) and run the canonical order.
#    Supply it from your secret manager — never type it inline, and never commit it.
node scripts/provision-directus.mjs --database <name>
```

The script refuses to run without an explicit `--database`, refuses any name containing `prod`,
`production` or `live`, refuses anything that is not a plain PostgreSQL identifier, and refuses a
database that already has tables unless `--allow-existing` is passed. It resolves every required
secret **before** touching the database, so a missing one fails at once rather than half way through.
It stops at the first failure and exits non-zero; it never skips a step, never swallows an error and
never repairs drift.

Steps, and what each one exists for, are documented in `scripts/provisioning-manifest.json`.
Summarised: Directus bootstrap → tracked schema baseline → database constraints → revision guard →
lifecycle guard → schema-object verification → **access bootstrap → service token → access
verification** → permissions artifact 01 → its verification → permissions artifact 02 → its
verification.

**Order matters and is not cosmetic.** The constraint, revision-guard and lifecycle-guard SQL must run
in that sequence; the access bootstrap must precede both permission artifacts, which own rows on a
policy that has to exist already and fail closed when it does not; and permissions artifact 02
refuses to run before artifact 01 has created its three rows.

The artifacts are idempotent: re-running the whole manifest over an already-provisioned database
leaves 19 permission rows, 49 tables and 7 triggers unchanged, with both verifications still passing (measured on
Directus 11.17.4).

**Directus 12.3.1 (FINAL-RELEASE-SECURITY-REMEDIATION-01).** The image has no npm / npx, so the orchestrator starts
the CLI as `node cli.js`. A fresh provision of an empty TEST database with the committed compose file completed
13 of 13 steps in 35 s, with every verification passing and without changing any artifact. It produced:
- 53 tables (the 49 above plus Directus 12's four OAuth system tables), 20 collections, 19 permission rows and
  7 user triggers;
- `public_registration = false`;
- an activated OIG license.

With a TEST service token, the `nuxt-server` identity then read what it may (200), was refused forbidden fields,
collections and writes (403, 0 rows written), was refused without a token (403) and with a wrong one (401). The
license was deactivated before the database was dropped. The re-run idempotency above was not re-measured on 12.3.1.

### After provisioning

1. **Restart Directus.** It caches schema and permissions in process memory, so a freshly provisioned
   environment keeps serving the old shape until it restarts.
2. Run `npm run release:check-test-data` against the target database. Only exit 0 passes; exit 2
   means the check itself could not run, which is a failure, not an unknown.

---

## 4. Application build and start

```bash
node scripts/verify-node-runtime.mjs    # refuses to continue on the wrong Node, before npm ci
npm ci                                  # must not modify package-lock.json
npm run release:verify                  # Node → Directus pin → PostgreSQL pin → published TEST data → nuxt build
```

`npm run release:verify` is the canonical release entry (D-041). Its steps are chained, and the first one
refuses any Node other than `.nvmrc`, so nothing expensive runs on a wrong runtime. It needs the Directus and
PostgreSQL containers running, because it compares them with their pins. The everyday `npm run build` is
deliberately not gated and is not a release path.

The build needs no secret (§2). Start the built server (`.output/server/index.mjs`) the way the target
environment runs Node, with the server secrets it needs in its process environment. How production runs
Nuxt — host process or container — **is still undecided**, and the document-extractor topology (gateway
vs. internal network) depends on that decision, as does the mechanism that places the server secrets in
the server's environment.

---

## 5. Smoke checks

Read-only, after startup:

- `GET /server/ping` returns `pong`. `GET /server/health` needs an administrator on Directus 12 (anonymous: 403).
- `GET /server/info` reports `license.source` `env` and `production_enabled` `true`; an administrator's
  `GET /license` reports status `active` and `custom_permission_rules_enabled` `true`.
- `node scripts/verify-directus-pin.mjs` confirms declared image, running image, digest and reported
  version all agree.
- `node scripts/verify-postgres-pin.mjs` confirms the same for PostgreSQL, using the server's own
  `server_version`.
- Public routes return their expected status. A 404 for content that is not published is correct;
  an unexpected 401, 403 or 503 is not.

---

## 6. Rollback boundaries

- Each permission artifact has a `.rollback.sql` that removes **only** rows exactly matching what it
  owns, and refuses to delete drifted rows.
- The guard SQL files document their own `DROP TRIGGER` / `DROP FUNCTION` order in their headers.
- There is **no rollback for the schema baseline**. Undoing a schema apply means restoring a backup —
  which is why the backup prerequisite above is not optional (§1; restore procedure and its limits in
  `PRODUCTION-BACKUP-RESTORE-RUNBOOK.md`).
- **A Directus version upgrade has no down-migration either.** Its rollback is the verified backup set taken in the
  quiesced window before the upgrade:
  1. Restore that set into a TEST database.
  2. Rename the databases so the restored one takes the environment's name.
  3. Pin the previous image and recreate the Directus service.

  FINAL-RELEASE-SECURITY-REMEDIATION-01 rehearsed this locally for 12.3.1 → 11.17.4. After restore and rename,
  11.17.4 started (pong after about 21 s) with no migration. Its anonymous responses matched the development
  instance, and its whole-database fingerprint matched the backup. A license activated by the newer version stays
  consumed unless it is deactivated first (§2).

---

## 7. STOP conditions

Stop and report rather than improvise if any of these hold:

- The running Directus version or digest does not match the pin.
- The running PostgreSQL version or digest does not match the pin.
- A permission artifact's `.verify.sql` does not print its `OK` line.
- The access bootstrap's `.verify.sql` does not print `directus_access_verify: OK`, or it reports
  that the policy is reachable from an identity other than the `nuxt-server` role.
- Any step would need a manual `INSERT`, `UPDATE` or `DELETE` to get past it.
- The service token is unavailable, and the answer being considered is to generate one locally,
  commit one, reuse another environment's, or pass `--without-service-token` and carry on.
- A deployment plan supplies a production server secret (§2) to the build, expects the built server to
  read one from a `.env` file, or adds a second project variable for one — a Nuxt `NUXT_*` override
  included.
- Provisioning would need a credential value to be read out of a file or a container.
- The Directus license key would have to be read, printed, typed inline or copied into a file other than the
  secret manager's.
- An instance that activated the license is about to be destroyed without deactivating it first, or a deactivation
  is about to run in a copy of another environment (§2).
- `/server/info` reports a license source other than `env`, or `GET /license` reports a status other than `active`
  or `custom_permission_rules_enabled` `false`, on an environment meant to run the license.
- The target database already contains business data.
- A public policy holds any business permission.
- `npm ci` modifies the tracked lockfile.
- The release guard exits non-zero.
- Production interaction becomes necessary before the corresponding authorization exists.
