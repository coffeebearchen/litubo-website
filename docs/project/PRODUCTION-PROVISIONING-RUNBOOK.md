# Production Provisioning Runbook

> Scope: building a **new Directus + PostgreSQL environment** from this repository.
> This runbook does not deploy, does not change DNS, and does not implement backup or restore.
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
| the service user's static token | the deployment environment / secret manager | **never** |
| the three Content permission rows | `directus-permissions-01-…sql` (D-034) | yes |
| the sixteen legacy site permission rows | `directus-permissions-02-…sql` (FINAL-RELEASE-FIX-E) | yes |

Provisioning therefore needs exactly one secret in its environment, `DIRECTUS_SERVICE_TOKEN`
(§2). Without it the run stops and reports the environment as not provisioned — it does not
quietly produce an environment that cannot serve.

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
backup before any production mutation, plus a written rollback plan. **Neither is implemented in this
repository yet**, and nothing in this runbook creates or tests a backup. Production deployment
requires a verified backup before mutation; treat that as an open prerequisite, not a solved one.

---

## 2. Environment variables

Names only — this repository never stores values. `.env.example` lists every name and is the
authoritative list; it currently covers all nine variables `docker-compose.yml` requires.

Required by `docker-compose.yml`: `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_DATA_DIR`,
`DIRECTUS_UPLOADS_DIR`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`,
`DIRECTUS_PUBLIC_URL`.

**`DIRECTUS_SERVICE_TOKEN` — provisioning only, and the only secret provisioning consumes.** It is
not an application variable and is deliberately absent from `.env.example`, which lists what the
running services read. Step `32` installs its value as the static token of the service user, and the
application then presents the *same value* as `DIRECTUS_TOKEN`. Two names, one secret: a deployment
normally sources both from one entry in its secret manager.

- It is read from the environment of the provisioning process only, passed to the container on
  stdin, and never appears in a command line, a process listing, a log or this repository.
- Absent, empty, or shorter than 32 characters → the run fails and writes nothing.
- `--without-service-token` builds the structure without it and says loudly that the environment
  cannot serve. Use it only to inspect a structure, never as a way past a missing secret.
- Rotating it later is the same step run again with a new value.

Two production values are load-bearing and fail closed if wrong:

- `CMS_MODE` and `CMS_MODE_PRODUCTS` must be exactly `directus`. Missing, empty or any other value
  makes the public CMS endpoints return 503 rather than serve DEMO fixtures.
- `PRODUCT_AI_APPLY_ENABLED` must be exactly `true` to enable Product AI Apply; it is absent by
  default, and absent means closed.

---

## 3. Provisioning

```bash
# 1. Create the target database (the script never creates databases).
# 2. Put the service token in the environment (see §2) and run the canonical order.
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

Start the built server (`.output/server/index.mjs`) the way the target environment runs Node. How
production runs Nuxt — host process or container — **is still undecided**, and the document-extractor
topology (gateway vs. internal network) depends on that decision.

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
  which is why the backup prerequisite above is not optional.

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
- Provisioning would need a credential value to be read out of a file or a container.
- The target database already contains business data.
- A public policy holds any business permission.
- `npm ci` modifies the tracked lockfile.
- The release guard exits non-zero.
- Production interaction becomes necessary before the corresponding authorization exists.
