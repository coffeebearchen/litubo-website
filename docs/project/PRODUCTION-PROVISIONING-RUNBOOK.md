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
| Node | **22.22.2** exactly (`.nvmrc`, `package.json` engines) | `node scripts/verify-node-runtime.mjs` — non-zero exit on any other version |
| npm | the npm bundled with that Node (10.9.7) | `npm -v` |
| Directus image | `directus/directus:11.17.4@sha256:eb326f679ae847c0a776f93b972761dc2ebe84980e0b9d274a6bc31cd62809f7` | `node scripts/verify-directus-pin.mjs` |
| PostgreSQL | 16 (`postgres:16-alpine`) | `docker compose ps` |
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

---

## 2. Environment variables

Names only — this repository never stores values. `.env.example` lists every name and is the
authoritative list; it currently covers all nine variables `docker-compose.yml` requires.

Required by `docker-compose.yml`: `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_DATA_DIR`,
`DIRECTUS_UPLOADS_DIR`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`,
`DIRECTUS_PUBLIC_URL`.

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
| `SUBMISSION_IP_SECRET` | Keying the hash of client addresses in the in-process rate limiter | the limiter still applies, keyed with a built-in fallback (an open decision, CURRENT-STATE) |
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
leaves 19 permission rows, 49 tables and 7 triggers unchanged, with both verifications still passing.

### After provisioning

1. **Restart Directus.** It caches schema and permissions in process memory, so a freshly provisioned
   environment keeps serving the old shape until it restarts.
2. Run `npm run release:check-test-data` against the target database. Only exit 0 passes; exit 2
   means the check itself could not run, which is a failure, not an unknown.

---

## 4. Application build and start

```bash
node scripts/verify-node-runtime.mjs    # refuses to continue on the wrong Node
npm ci                                  # must not modify package-lock.json
npx nuxt build
```

The build needs no secret (§2). Start the built server (`.output/server/index.mjs`) the way the target
environment runs Node, with the server secrets it needs in its process environment. How production runs
Nuxt — host process or container — **is still undecided**, and the document-extractor topology (gateway
vs. internal network) depends on that decision, as does the mechanism that places the server secrets in
the server's environment.

---

## 5. Smoke checks

Read-only, after startup:

- `GET /server/ping` returns `pong`; `GET /server/health` returns 200.
- `node scripts/verify-directus-pin.mjs` confirms declared image, running image, digest and reported
  version all agree.
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

---

## 7. STOP conditions

Stop and report rather than improvise if any of these hold:

- The running Directus version or digest does not match the pin.
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
- The target database already contains business data.
- A public policy holds any business permission.
- `npm ci` modifies the tracked lockfile.
- The release guard exits non-zero.
- Production interaction becomes necessary before the corresponding authorization exists.
