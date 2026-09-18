# Production Preflight

> Module: FINAL-RELEASE-PRODUCTION-PREFLIGHT-01 · 2026-09-18 · read-only assessment.
> **Result: PRODUCTION PREFLIGHT INCOMPLETE — HUMAN / INFRA BLOCKERS REMAIN.**
> This module changed no production system — none exists to change. It contacted no server, wrote no DNS, issued
> no certificate, started no container and read no secret. It is an assessment of readiness, not a deployment.
> Production release remains **NOT APPROVED**; merge and deploy each still require their own authorization.
>
> **The single largest finding: there is no production host.** No server address, specification, operating
> system or Docker installation is recorded anywhere in this repository, and the public domain still serves the
> old Wix site. Several items below cannot be assessed as ready or not ready until that exists — they are
> recorded as **NOT ASSESSABLE**, which is different from "ready" and different from "broken".

---

## 1. Release SHA

| Item | Value |
|---|---|
| Release candidate | **`9f1da6fde329366ef686092db8d0633464bfeff8`** |
| Branch | `review/final-release-verification-01` (local and remote, identical) |
| Contents | the verified RC `da8f445` plus two governance-only commits (`be1df5a`, `9f1da6f`) — no runtime, business, test or workflow change since verification |
| Merged to `master`? | **No.** `origin/master` = `8f2e3847e0d7acda1bd987ffd18c3af03377fef9` |

A production build must come from the merged `master` SHA, or from an exact release SHA the Controller
approves. Deploying from an uncommitted working tree, a development server or an older `master` is forbidden.

## 2. Git / CI

| Check | Result |
|---|---|
| Start branch / HEAD | `review/final-release-verification-01` / `9f1da6f` — matches the authorized baseline |
| Tracked changes at start | 0 |
| Historical untracked paths | the same 6, untouched |
| `origin/master` | `8f2e384` — unchanged, **0 behind / 96 ahead**, an ancestor of HEAD, **no divergence** |
| Remote review branch | `9f1da6f` — equal to local HEAD |
| GitHub CI | workflow `CI`, run `35291162888` (`be1df5a`), conclusion **success**; the Controller confirms final CI **PASS**. CI scope is 87 files / 3075 tests with 8 files / 167 tests skipped (the local-DB and extractor integration suites), complemented by the local serial full run of 95 files / 3242 tests |

## 3. Production host

**PRODUCTION HOST = NOT YET PROVISIONED (no information of any kind in the repository).**

Every reference is a placeholder or an intention: `ssh user@<server-host>`, `http://<server-public-ip>:8055`,
"the existing US Tencent Cloud server". There is no recorded address, hostname, region, instance type,
specification, owner or SSH access path, and nothing in this module contacted a server.

This is not a defect in the code. It is the missing input that blocks the infrastructure half of this preflight.
The minimum information needed is listed in §31.

## 4. Operating system

**NOT ASSESSABLE** — no host. Constraints that the target must satisfy:

- Linux with Docker Engine and the Docker Compose plugin (`docker compose version` must run).
- The bind-mount ownership model assumes Linux uid semantics: `/data/litubo/postgres` owned by **uid/gid
  70:70** — the `postgres` user of the pinned **Alpine** image; uid 999 belongs to the Debian variant and does not
  apply (corrected in §34) — and `/data/litubo/uploads` owned by uid/gid 1000:1000 (`docs/ADMIN-CMS-SETUP.md` §6.1).
- **Architecture: `linux/amd64` is the only one this project has actually run and verified.** The pinned
  Directus and PostgreSQL digests are multi-architecture image *indexes*, so `linux/arm64` would also pull —
  pinning does not decide the architecture, and arm64 has never been exercised here
  (`PRODUCTION-PROVISIONING-RUNBOOK.md` §1).

## 5. CPU / RAM / disk

**NOT ASSESSABLE** — no host. What the repository can say:

- **Local baseline, not an SLA** (`PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md`, D-041): idle footprint Directus
  ~237 MiB, PostgreSQL ~30 MiB, extractor ~163 MiB of its 512 MiB cap, gateway ~14 MiB of 96 MiB, the Nuxt
  server ~75 MiB (138–193 MiB under load). Loopback GET-only concurrency 1/5/10/20 gave p95 48.9 / 118.8 /
  265.9 / 697.5 ms and levelled at 64–68 req/s, with **0 timeouts, 0 connection errors, 0 5xx across 720
  requests**. This measures a developer workstation, never a production server, and it excludes Cloudflare,
  a reverse proxy, TLS and any published product.
- **Disk guidance on record:** `/data` at least 20 GB (`docs/ADMIN-CMS-SETUP.md` §1). Present data volume is
  small (database dump ~272 KB, uploads ~7.2 MB across 129 files), so disk is dominated by images, logs and
  retained backup sets, not content.
- Container memory caps are declared for the extractor (512 MB) and gateway (96 MB); Directus and PostgreSQL
  declare **no** memory or CPU limit, so on a small instance they can compete for the whole host.

**Verdict: WARNING, not BLOCKING** — sizing cannot be judged, and no SLA is promised.

## 6. Docker / Node

| Item | Contract | Production state |
|---|---|---|
| Docker Engine + Compose plugin | required | **unverified — no host** |
| Node (build / release entry) | **22.22.2 exactly** (`.nvmrc`, `engines`), enforced fail-closed by `scripts/verify-node-runtime.mjs` as the first step of `npm run release:verify` | ready as a contract; unverified on a host |
| Node (running the built server) | the built `.output/server/index.mjs` runs under the same runtime contract | depends on the undecided run method (§10) |

## 7. DNS — **measured today, read-only**

| Name | Record | Value | TTL |
|---|---|---|---|
| `litubo.com` | A | `185.230.63.186`, `185.230.63.107`, `185.230.63.171` | 3453 |
| `www.litubo.com` | A | `34.149.87.45` | 75150 |
| `litubo.com` | NS | **`ns2.wixdns.net`, `ns3.wixdns.net`** | — |

**What this means.**

1. The domain's authoritative nameservers are **Wix**, not Cloudflare. The confirmed architecture (D-001,
   `01-technical-decision.md`) puts **Cloudflare Free** in front for DNS, TLS and caching. Cutover is therefore
   a **nameserver migration at the registrar**, not merely an A-record edit — a materially larger step, with
   propagation and a rollback consideration of its own.
2. The apex and `www` currently resolve to Wix / Google Cloud addresses: **the old Wix site is live on the
   production domain**. CLAUDE.md requires it stay online until cutover, so cutover must be planned as a
   switch-over, not an overwrite.
3. **No record points at any Tencent Cloud address**, and no target address exists to point at (§3).

**Status: DNS CUTOVER = DEPLOY-TIME HUMAN GATE — but the plan is not yet concrete**, because the target
address does not exist and the registrar / nameserver move has not been decided. Nothing was changed here.

## 8. TLS

**NOT DECIDED.** The documents name two different terminators without choosing one:

- `01-technical-decision.md` / D-001: Cloudflare Free provides TLS.
- `OPERATIONS-HANDBOOK.md` §9: "HTTPS/TLS 证书已颁发（Cloudflare 自动或 Let's Encrypt）" — explicitly either.
- `ADMIN-CMS-SPEC.md` §2.2: an Nginx layer on the server sits behind Cloudflare.

Undecided consequences: who holds the certificate, whether origin traffic is encrypted (Cloudflare Flexible
vs Full vs Full-Strict), auto-renewal ownership, HTTP→HTTPS redirect ownership, HSTS, and whether the apex or
`www` is canonical. `.env.example` sets `NUXT_PUBLIC_SITE_URL=https://litubo.com` (apex), while
`ADMIN-CMS-SPEC.md` §2.2 draws `https://www.litubo.com/` — **the canonical host is not settled either.**

**Status: TLS PROVISIONING = DEPLOY-TIME HUMAN GATE, and the design decision above it is still open.**
No certificate was issued or changed.

## 9. `PUBLIC_URL` — **BLOCKER**

| Variable | Repository value | Requirement |
|---|---|---|
| `DIRECTUS_PUBLIC_URL` | `.env.example` and `ADMIN-CMS-SETUP.md` §6.1 both state **`http://localhost:8055` for production**, "SSH tunnel only — no public domain" | The preflight contract requires an absolute HTTPS URL that is not `localhost` and not a development URL |
| `NUXT_PUBLIC_SITE_URL` | `https://litubo.com` | consistent with an apex-canonical site, but see §8 — `www` vs apex is unsettled |

Two distinct problems, both real:

1. **Contract conflict.** The repository's production value for `DIRECTUS_PUBLIC_URL` is `http://localhost:8055`.
   That is self-consistent with the security design — Directus is reachable only through an SSH tunnel, so
   `localhost:8055` genuinely is how it is addressed — but it is not HTTPS and not a public absolute URL.
2. **Licence activation risk.** The OIG activation binds to the project **and** `PUBLIC_URL` (D-042, runbook
   §2). If production keeps `http://localhost:8055`, production and the development instance would present the
   **same project identity and the same `PUBLIC_URL`** to `licensing.directus.com`. Whether that is accepted as
   a second activation, rejected, or silently treated as the same binding **has not been tested and cannot be
   tested without consuming an activation**. This is exactly the kind of thing that must not be discovered
   during a deployment window.

**Status: BLOCKER — the production `DIRECTUS_PUBLIC_URL` must be decided (and, if it changes, the licence
activation consequence understood) before deployment.** Not decided here.

## 10. Topology — **PARTIALLY DECIDED**

Decided, enforced in the repository and tested:

```text
Directus            127.0.0.1:8055 only          (never 0.0.0.0; guarded by test)
PostgreSQL          no published port            (litubo-internal network only)
document-extractor  no published port            (document-extractor-internal, internal: true)
extractor gateway   127.0.0.1:8787 only          (bridges the internal network to loopback)
Browser → Directus  never                        (directusUrl is server-side only; 0 occurrences in the client bundle)
Public data path    Vue → Nuxt server/api → Directus REST (internal) → PostgreSQL
```

**Not decided — and it is the load-bearing gap:**

> "How production runs Nuxt — host process or container — **is still undecided**, and the document-extractor
> topology (gateway vs. internal network) depends on that decision, as does the mechanism that places the
> server secrets in the server's environment." — `PRODUCTION-PROVISIONING-RUNBOOK.md` §4

The repository confirms this: `docker-compose.yml` contains **no Nuxt service**, and there is **no Dockerfile,
systemd unit, pm2 config or process-manager file** for the application anywhere. Three things hang off this one
decision: the extractor address (`http://127.0.0.1:8787` vs `http://document-extractor:8787`), the secret
injection mechanism (§18), and what the reverse proxy actually proxies (§13).

**Status: BLOCKER — production topology is not fully determined.**

## 11. Ports

Intended public exposure (`OPERATIONS-HANDBOOK.md` §9):

| Exposure | Ports |
|---|---|
| Public | **80 / 443 only** |
| Never public | `5432` (PostgreSQL), `8055` (Directus), `8787` (extractor gateway), the extractor's own port, any dev-server or debug port |

The Nuxt application's own listening port (3000 by default) must be reachable **only** by the reverse proxy,
not from the Internet. Which interface it binds depends on §10.

**Status: intended design clear and enforced in Compose for the containers; unverifiable on a host that does
not exist.**

## 12. Firewall

**NOT ASSESSABLE** — no host. Required at deploy time: allow 80/443, deny 8055, 8787 and 5432 from the
Internet, and verify with `ss -tlnp | grep 8055` showing `127.0.0.1:8055` plus an external `curl` to port 8055
timing out (`ADMIN-CMS-SETUP.md` §7). **DEPLOY-TIME GATE.** Nothing was changed here.

## 13. Reverse proxy — **BLOCKER**

**The repository contains no reverse-proxy configuration of any kind** — no Nginx, Caddy or Traefik file, no
`deploy/`, `infra/` or `ops/` directory. Documents reference one as if it existed:

- `ADMIN-CMS-SPEC.md` §2.2 draws `Nginx（腾讯云服务器）` in front of Nuxt.
- `ADMIN-CMS-SETUP.md` §7 justifies Directus not being public partly with "Nginx 无 Directus 路由".
- `OPERATIONS-HANDBOOK.md` §7 lists "nginx 配置" among the things GitHub backs up — **it does not exist in Git.**

Undecided and undocumented: who terminates TLS (§8), what proxies the Nuxt app, request body size limits (the
public inquiry pipeline caps bodies at 64 KB in the application — the proxy needs a compatible limit), read and
connect timeouts, `X-Forwarded-For` / `X-Forwarded-Proto` handling and which proxy is trusted.

**`X-Forwarded-For` matters for correctness, not just tidiness.** The public inquiry rate limiter keys on the
first address in `x-forwarded-for` (RSG-07 fact cell: "its trustworthiness depends on the production proxy").
Behind Cloudflare *and* an origin Nginx, that header carries multiple hops; if the chain is wrong, the limiter
either keys every visitor to one bucket or trusts a client-supplied value.

**Status: BLOCKER — the production reverse-proxy architecture is undecided and unwritten.** This module did not
design one, because inventing a proxy architecture here would conflict with whatever is later chosen.

## 14. Directus

| Item | State |
|---|---|
| Image | `directus/directus:12.3.1@sha256:8978edf6…` — immutable index digest, fail-closed by `verify-directus-pin.mjs` |
| Exposure | loopback only; no reverse-proxy route; no `admin.litubo.com` subdomain (D-042 (11); `ADMIN-CMS-SETUP.md` §7) |
| Admin access | Nuxt `/admin` for business users; the Directus Studio only through an SSH tunnel (`ssh -L 8055:localhost:8055`) |
| Hardening | websockets, cache, TUS, GraphQL introspection, MCP, AI and owner registration off; marketplace at `sandbox`; no `TELEMETRY` declared, deliberately |
| Registration | database setting `public_registration = false` |
| Restart policy | `unless-stopped` |
| Health | `GET /server/ping` → `pong` (anonymous). `/server/health` needs an administrator on Directus 12 |
| Resource limits | **none declared** — see §5 |

**Documentation conflict found and corrected in this module.** `ADMIN-CMS-SPEC.md` §2.2 still drew the
superseded design in which the Directus Studio is published at `https://admin.litubo.com/` behind an
IP-allowlisted Nginx. That contradicts D-042 (11), `ADMIN-CMS-SETUP.md` §7 and the loopback binding the test
suite enforces, and an operator following it would create precisely the public exposure the security
remediation closed. A superseded banner was added pointing at the governing contract; the historical text is
kept. **No runtime, port, network or permission was touched.**

## 15. PostgreSQL

| Item | State |
|---|---|
| Image | `postgres:16.15-alpine@sha256:cf78e766…` — immutable index digest, fail-closed by `verify-postgres-pin.mjs`; floating tags forbidden (D-041) |
| Network | `litubo-internal` only, **no published port** |
| Persistence | bind mount `${POSTGRES_DATA_DIR}:/var/lib/postgresql/data`; production path `/data/litubo/postgres`, owner **uid/gid 70:70** (the pinned Alpine image's `postgres` user; corrected from uid 999 — §34) |
| Health check | `pg_isready`, 10 s interval, 5 retries |
| Restart policy | `unless-stopped` |
| Database / user / encoding | `DB_DATABASE`, `DB_USER` from the environment; encoding and timezone are **not pinned in the repository** — they follow the image defaults (UTF-8, UTC) and have not been explicitly stated as a production contract |
| Resource limits | **none declared** |

Bind mounts, not named volumes, are deliberate: `docker compose down --volumes` destroys named volumes, and the
documentation forbids that command outright. **No production database was created; no migration was run.**

## 16. document-extractor

| Item | State |
|---|---|
| Image | built from `document-extractor/Dockerfile`; the running digest `sha256:8d3d0639…` is the one the security remediation scanned and classified |
| Network | `document-extractor-internal` with `internal: true` — **no route to the Internet, the host or Directus** |
| Exposure | publishes no port; the gateway publishes `127.0.0.1:8787` and pipes connections unread |
| Hardening | read-only root filesystem, `/tmp` tmpfs `noexec,nosuid,nodev`, `cap_drop: ALL`, `no-new-privileges`, uid 1000, 512 MB / 96 MB memory, 64 / 32 pids, 1.0 / 0.5 CPU |
| Health | `/healthz` through the gateway, so the whole path is checked |
| State | stateless — nothing to back up |
| Production topology | **depends on §10**: a host-process Nuxt uses the loopback gateway; a containerized Nuxt would join the internal network and drop the gateway |

## 17. Uploads / media persistence

| Item | State |
|---|---|
| Path | bind mount `${DIRECTUS_UPLOADS_DIR}:/directus/uploads`; production `/data/litubo/uploads`, owner uid 1000 |
| Not in Git | `.gitignore` excludes `dev-data/` and `backups/`; the backup tool refuses any output directory Git could pick up |
| Not in a container layer | bind mount, never a writable layer or a named volume |
| Not temporary | `/data/...`, outside the project directory |
| Backup inclusion | uploads are **half of the backup set** — never backed up separately from the database (D-040) |
| Restore path | into an explicitly TEST directory only; production cut-over is not a mode of the tool (§22) |
| Free disk | **NOT ASSESSABLE** — no host |
| Future COS migration | compatible — Directus storage adapters are an environment change (`STORAGE_*`), URLs and front-end code unchanged |
| Single business entry point | unchanged: Media Library remains the only business media workspace (D-023); public delivery is via the server-side proxy `/api/cms/media/:id`, never a raw Directus asset URL |

**Linux ownership has never been rehearsed.** Directus runs as uid 1000; a restored or newly created uploads
directory must carry that owner or Directus cannot write. `PRODUCTION-BACKUP-RESTORE-RUNBOOK.md` §4 states this
has not been rehearsed on Linux.

## 18. Secret matrix

Names, requirement and injection target only. **No value was read, printed or stored; presence was not probed
on any production system, because no production system exists.**

| Variable | Needed at launch? | Runtime target | Human action before launch | Behaviour if absent |
|---|---|---|---|---|
| `DB_PASSWORD` | **Yes** | Compose → PostgreSQL + Directus | generate, store in the secret manager | containers do not start correctly |
| `DIRECTUS_SECRET` | **Yes** | Compose → Directus (`SECRET`) | generate (≥32 chars) | JWT signing undefined |
| `DIRECTUS_ADMIN_EMAIL` / `DIRECTUS_ADMIN_PASSWORD` | **Yes**, for bootstrap | Compose → Directus | set, then change the password at first login | no administrator is created |
| `DIRECTUS_LICENSE_KEY` | **Yes** | Compose → Directus (`LICENSE_KEY`) | supply from the secret manager; binds an activation (§19) | Core tier: all 19 `nuxt-server` permission rows drop out → Directus 403 → public CMS 503 |
| `DIRECTUS_TOKEN` | **Yes** | provisioning step `32` **and** the Nuxt server process environment — one name, one value | supply once from the secret manager | CMS reads refused, inquiries 503, AI source selection 503 |
| `DIRECTUS_URL` | **Yes** (non-secret) | Nuxt server | set to the internal Directus address chosen in §10 | CMS adapter cannot reach Directus |
| `CMS_MODE`, `CMS_MODE_PRODUCTS` | **Yes** (non-secret) | Nuxt server | both exactly `directus` | **fails closed**: public CMS answers 503 and never serves DEMO fixtures |
| `NUXT_PUBLIC_SITE_URL` | **Yes** (non-secret) | Nuxt build/runtime | set to the canonical host decided in §8 | canonical / sitemap URLs wrong |
| `SUBMISSION_IP_SECRET` | **Yes** | Nuxt server | generate; Controller ruling: **presence must be confirmed at preflight, never its value** | the rate limiter still applies with a built-in fallback (accepted, not a V1 blocker) |
| `PRIVACY_POLICY_VERSION` | **Yes** (non-secret) | Nuxt server | align with the approved policy version | consent records stamp `1.0` |
| `CONTACT_EMAIL`, `SALES_EMAIL`, `SMTP_FROM` | **Yes** (non-secret) | Nuxt server | confirm recipients | defaults are used |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | **Optional at launch** | Nuxt server | only if e-mail notification is wanted at launch | the notification is best-effort and fails silently; **the inquiry is still stored** |
| `HUBSPOT_ACCESS_TOKEN` | **Optional at launch** | Nuxt server | Phase 7B, separate authorization | inquiries stored as `not_configured`; no HubSpot request |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | **No — disabled at launch** | Nuxt server | none | provider reports "not configured"; no request, no cost |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | **No — disabled at launch** | Nuxt server | none | provider reports "not configured"; no request, no cost |
| `PRODUCT_AI_APPLY_ENABLED` | **No — leave unset** | Nuxt server | none | absent means closed in production (503) |
| `DOCUMENT_EXTRACTOR_URL` | **Yes** (non-secret) | Nuxt server | set per the §10 decision | PDFs report "unavailable"; other sources still work |

**Classification.**

- **Launch-required:** `DB_PASSWORD`, `DIRECTUS_SECRET`, admin bootstrap pair, `DIRECTUS_LICENSE_KEY`,
  `DIRECTUS_TOKEN`, `DIRECTUS_URL`, `CMS_MODE`, `CMS_MODE_PRODUCTS`, `NUXT_PUBLIC_SITE_URL`,
  `SUBMISSION_IP_SECRET`, `PRIVACY_POLICY_VERSION`, the e-mail recipient addresses, `DOCUMENT_EXTRACTOR_URL`.
- **Optional after launch:** SMTP, HubSpot.
- **AI disabled at launch:** both provider keys unset, `PRODUCT_AI_APPLY_ENABLED` unset.
- **Email disabled at launch is safe:** inquiries are stored regardless; only the notification is skipped.

**Nothing is forced.** V1 runs safely with AI, HubSpot and SMTP all unconfigured, so none of them is a launch
blocker.

**Injection mechanism — open.** The contract is settled and proven locally (build artifacts secret-free; each
secret read once from `process.env` at runtime; a built server never reads a `.env` file). The *mechanism* that
puts those values into the Nuxt process environment in production is **undecided and unexercised**, because it
depends on §10. No production secret manager has ever been exercised.

## 19. OIG production activation

| Fact | Value |
|---|---|
| Grant terms | granted **in perpetuity**, no expiration date, no renewal process; each key carries **5 activations** |
| Activations in use | **1** (development). Two rehearsal activations were properly released |
| Remaining slots | **4** |
| Binding | project **and** absolute `PUBLIC_URL`; the first Directus process started with the key against a licence-free database activates it |
| Deactivation procedure | documented and measured: restart with `LICENSE_KEY` empty → `DELETE /license` (204) → confirm `source: null`. Must be done **before** destroying an instance |
| Restored copies | must run with `LICENSE_KEY` empty and **must never be deactivated** (they share the source binding) |
| Outbound requirement | the Directus container needs outbound HTTPS to `licensing.directus.com` (and the licence-required telemetry endpoint) |

**Status: NOT READY** — not because slots are short, but because the binding input is undecided (§9). Deciding
`PUBLIC_URL` after activation would mean burning a slot to correct it. **No activation was performed and the
key was never read.**

## 20. Backup

| Item | State |
|---|---|
| Tooling | `scripts/backup-create.mjs` / `backup-restore.mjs`, one set = `database.dump` + `uploads.tar` + `SHA256SUMS` + `manifest.json` |
| Consistency model | **quiesced, not atomic** — Directus stopped, no container mounting uploads, no client session, fingerprints re-checked after the copy |
| Proven | **LOCAL_REHEARSAL_PROVEN** (D-040), repeated on 12.3.1 (D-042 §9.1); the two most recent sets re-verified during Final Release Verification |
| Production destination | **NOT DECIDED** — the production command would write to `/data/litubo/backups` by documentation, but that path exists only as text |
| Schedule | **NOT DECIDED** — no cron, no scheduler, nothing deployed |
| Retention | **NOT DECIDED** — superseded suggestions (14 days / 7 days / 30 days / 3 months) were never decided, and a schedule that backs the two halves up separately cannot produce a consistent set |
| Encryption at rest | **NOT DECIDED** |
| Quiesce impact | during the window the public site answers 503 for CMS reads and inquiry submissions, and administrators must not log in (five failures lock an address for 15 minutes) |
| Sensitivity | a set contains the service token, password hashes, sessions, inquiry contact data and, from Directus 12, the licence key and token — **it must be handled as a credential store** |

**Status: HUMAN / INFRA GATE.** The tooling is ready and proven locally; the production destination, schedule,
retention and encryption are undecided. This is **not** "offsite already exists" — it does not.

## 21. Offsite backup

**NOT DECIDED and NOT PROVEN.** Tencent Cloud COS is named as a candidate, never chosen or configured. The
handbook's own checklist item — "备份文件已成功传输到异地存储" — is unchecked. A local rehearsal is explicitly
not proof of production backup storage (D-040 (9)).

**Status: HUMAN / INFRA GATE.** Because a backup set is sensitive material, the offsite decision carries an
access-control and encryption decision with it.

## 22. Restore

| Item | State |
|---|---|
| Restore into TEST targets | **PROVEN locally** — verification before anything is created; every table, sequence, schema object and all 129 files matched; ten fail-closed refusals each happened before any database or directory existed |
| Restore under Directus 12.3.1 | proven, started with `LICENSE_KEY` empty, no migration, anonymous responses identical |
| **Restore into production (cut-over)** | **NOT A MODE OF THE TOOL, NOT REHEARSED, NOT PROVIDED.** The tool refuses any target that is not explicitly TEST |
| Linux uid 1000 ownership of a restored uploads directory | **never rehearsed** |

**Status: partial.** Verification-restore is proven; disaster-recovery cut-over is not.

## 23. Rollback — checklist, not yet executable end to end

| Layer | Rollback path | State |
|---|---|---|
| Application code | redeploy the previous release SHA; `origin/master` `8f2e384` is the current pre-release state | **ready** (once a deployment method exists) |
| Directus image | restore the pre-upgrade set into a TEST database → rename → pin the previous digest → recreate the service; rehearsed 12.3.1 → 11.17.4 locally | **rehearsed locally** |
| PostgreSQL image | move the pin back; recreate only after a fresh verified backup set | **ready as a procedure** |
| Database content | restore a verified set — but only into a TEST target today (§22) | **GAP: production cut-over step missing** |
| Uploads | same set, same gap | **GAP** |
| Schema baseline | **no rollback exists** — undoing a schema apply means restoring a backup | known and documented |
| OIG activation | a licence activated by a newer version stays consumed unless deactivated first; never deactivate in a restored copy | **procedure known; production implications untested** |
| DNS | revert the nameserver / record change at the registrar; the old Wix site is still live, which helps | **plan needed** (§7) |
| Reverse proxy | revert the configuration | **NOT ASSESSABLE — no proxy exists yet** (§13) |

**Status: INCOMPLETE.** The written production rollback / cut-over procedure that `RELEASE-SAFETY-GATES.md`
§3A.8 step 8 requires is still **not provided** — the provisioning runbook says so itself.

## 24. Logging

| Source | State |
|---|---|
| Directus | container logs; `LOG_LEVEL: info` is a **local-only** override, so production uses the image default |
| PostgreSQL | container logs |
| document-extractor / gateway | container logs |
| Nuxt server | depends on §10 (host process vs container) |
| Reverse proxy | does not exist yet (§13) |

**Secret hygiene.** The evidence that credentials stay out of logs is strong but local: provisioning redacts the
token from everything it prints and never puts it on a command line; the backup tools summarize database-tool
output instead of echoing it; the secret-canary work found no secret in any HTTP response, server log or
Directus log. **No log rotation, retention or shipping is configured**, and nothing has been observed on a
production host.

**Status: contract good, production configuration absent.** Add a log-review checkpoint to the deployment
smoke: check the Nuxt, Directus, PostgreSQL and proxy logs for credentials, tokens, cookies and authorization
headers immediately after first start.

## 25. Health checks

| Target | Check | Notes |
|---|---|---|
| Directus | `GET /server/ping` → `pong` | anonymous; `/server/health` needs an administrator on Directus 12 |
| PostgreSQL | Compose health check `pg_isready` | already declared |
| extractor + gateway | `/healthz` through the gateway | already declared, covers the whole path |
| Nuxt | public route status codes | **no dedicated health endpoint is declared** in Compose because there is no Nuxt service |
| Containers | restart counts, `docker compose ps` | manual |
| Disk | free space on `/data` | manual |

No external monitoring service exists. **Post-launch improvement, not a launch blocker** — provided the manual
checks above are actually performed in the first week (`OPERATIONS-HANDBOOK.md` §9). No paid monitoring SaaS is
introduced.

## 26. Production initial data

**Decision required — option not yet chosen.** The three admissible sources:

- **A. Fresh provisioned empty database** — `scripts/provision-directus.mjs` against an empty database; 13 of 13
  steps were measured at 35 s on 12.3.1, producing 53 tables, 20 collections, 19 permission rows, 2 roles,
  3 policies, 3 access rows, 7 triggers, `public_registration = false` and an activated licence.
- **B. Approved sanitized seed** — does not exist today.
- **C. Approved production restore source** — does not exist today.

**A is the only option that exists.** It is also the only one that guarantees no development content leaks.

**The development database must not be migrated into production.** It currently holds 4 draft products (one,
`test sample` / slug `test`, carries **no** explicit TEST marker and is therefore invisible to the release
guard), 7 draft content items, 9 locale rows and TEST fixtures. The guard `npm run release:check-test-data`
catches *published* records with explicit TEST markers — it is a last line of defence, not a substitute for
starting clean.

**Explainable initial state:** with option A, production starts with **0 products, 0 content items,
0 published records**, a sitemap with 0 URLs and public list pages showing their empty states. That is correct
and expected, not a fault.

## 27. First real product rollout

**Deploying the system is not publishing products.** Recommended, human-controlled sequence:

1. Production system online; smoke checks pass (§25); public pages answer with their empty states.
2. Create **one** real product as **Draft**; upload its real media through the Media Library.
3. Human review of every technical value against the manufacturer's own documentation.
4. Publish that one product through the Admin UI (`draft → review → published`, each a separate request).
5. Verify the public detail page, the category list, the sitemap entry and the media URLs.
6. Then 3–5 products; then batch rollout.

**Forbidden:** automatic publication, bulk publication without review, AI-driven publication. The state machine
already enforces that publication is an explicit authenticated administrator action, and AI can only write to a
Draft.

## 28. Draft / sitemap / search production gate

Unchanged and re-affirmed for production, whatever the initial content is:

- Draft is **never** public: not in a detail route, a list, the sitemap, search, a related-item rendering or any
  public API payload.
- Published state changes **only** through an explicit human action by an authenticated administrator.
- Public payloads are built by explicit allowlist mapping, never by passing a Directus record through.
- Locale independence with no fallback: only `en` is in `publishedLocales`; `/es` and `/pt` content URLs 404.
- Public media requires `is_public = true` **and** not archived; `source_document` files are never public.

Final Release Verification measured all of this on the production build: every draft URL 404, sitemap 0 URLs,
0 published rows, media proxy 200/404/404/404.

## 29. Human gates — facts only, no legal conclusion

| Gate | Owner | State |
|---|---|---|
| Directus OIG eligibility | business owner | **Closed by the owner.** Directus 12.3.1 is MSCL-1.0-GPL and runs on an OIG key. The owner confirmed the revenue / headcount conditions themselves, read and submitted the application themselves, and Directus issued the key. Recorded as fact; **no legal conclusion is stated here** |
| Telemetry required by the OIG tier | business owner | **Informed and accepted.** `telemetry_required = true`; opt-out is unavailable on this tier; `docker-compose.yml` declares no `TELEMETRY` value and records why |
| Poppler (GPL), libvips (LGPL-2.1), util-linux (mixed) | human review | **OPEN** — pre-production human review, unchanged. `CURRENT-STATE.md` records it as a pre-production item |
| PostgreSQL licence | — | resolved: PostgreSQL License |
| Privacy policy content and version | business / legal | **OPEN** — `/privacy-policy` content review and `PRIVACY_POLICY_VERSION` alignment are on the pre-launch checklist and unchecked |

## 30. Merge readiness and branch protection

| Check | Result |
|---|---|
| Review branch clean | **yes** — tracked changes 0 |
| Final CI | **PASS** (Controller-verified) |
| `master` divergence | **none** — 0 behind / 96 ahead, fast-forward relationship |
| Merge strategy | not stated by the Controller; a fast-forward or a merge commit both apply cleanly |
| Rollback SHA after merge | `8f2e384` (the current `origin/master`) |
| **Branch protection on `master`** | **NOT ENABLED** (recorded fact). Nothing prevents a direct push, a force push or a merge without CI |

**MERGE READY — technically.** The branch is clean, CI is green and there is no divergence.

**Recommended before merge, as a HUMAN GATE:** enable branch protection on `master` — require a pull request,
require the `CI` check, forbid force pushes and branch deletion. This is repository governance, it is cheap,
and after merge `master` becomes the deployment source. **No GitHub repository setting was modified**, and none
will be without explicit authorization.

## 31. Production host information needed

The minimum to move this preflight forward. **The user supplies these themselves; Claude reads no credential.**

1. **Provider and region** — the existing US Tencent Cloud instance, or a new one?
2. **Public IP / hostname**, and how SSH access is granted (user, key).
3. **OS and version**, and **CPU architecture** (`amd64` is the only verified one).
4. **CPU cores / RAM / disk**, and the free space on the partition that will hold `/data`.
5. **Docker Engine and Compose plugin** — already installed? Which versions?
6. **Is anything else already running on that host** (ports 80 / 443 in particular, and the refrigerant-store
   project the technical decision says must stay isolated)?
7. **Reverse proxy** — is there already an Nginx on that host, and would LITUBO share it or get its own?
8. **Registrar access for `litubo.com`** — the domain is on Wix nameservers today; moving to Cloudflare is a
   registrar action.
9. **Cloudflare account** — does one exist for this domain?
10. **Backup destination** — which storage, what retention, and encrypted or not?
11. **Canonical host** — `https://litubo.com` or `https://www.litubo.com`?
12. **Secret storage** — where production secrets will live (password manager, cloud secret manager, a `600`
    `.env` on the server).

## 32. Blockers and gates

**BLOCKING — must be resolved before a deployment can be planned**

| # | Blocker | Section |
|---|---|---|
| B-1 | **No production host.** No address, specification, OS, architecture or Docker installation exists or is recorded | §3–§6 |
| B-2 | **Production Nuxt run method undecided** (host process vs container) — it determines the extractor topology, the secret injection mechanism and what the proxy proxies | §10 |
| B-3 | **No reverse-proxy architecture.** No configuration exists; TLS terminator, body size, timeouts and forwarded-header trust are all undecided | §13 |
| B-4 | **Production `DIRECTUS_PUBLIC_URL` undecided**, and the OIG activation binds to it — deciding late costs an activation | §9 |
| B-5 | **Backup destination, schedule, retention and encryption undecided; offsite storage does not exist** | §20, §21 |
| B-6 | **No written production rollback / cut-over procedure**; restore into production is not a mode of the tool | §22, §23 |
| B-7 | **Canonical host and TLS terminator undecided** (apex vs `www`; Cloudflare vs origin certificate) | §8 |
| B-8 | **Production initial data source not chosen** (A / B / C) | §26 |

**DEPLOY-TIME HUMAN ACTIONS — acceptable to defer, paths are clear**

| Action | Note |
|---|---|
| DNS cutover | a **nameserver migration** from Wix to Cloudflare, not just a record edit; the old site stays live until switch-over |
| TLS issuance | once §8 is decided |
| OIG production activation | once §9 is decided; 4 slots remain |
| Runtime secret injection | once §10 is decided |
| Firewall rules | 80/443 open, 8055/8787/5432 closed, verified on the host |

**HUMAN GATES**

| Gate | State |
|---|---|
| OIG eligibility · telemetry acceptance | closed by the business owner |
| Poppler / libvips / util-linux licence review | **OPEN** |
| Privacy policy content and version | **OPEN** |
| `master` branch protection | **recommended before merge** |

## 33. Final result

```text
PRODUCTION PREFLIGHT INCOMPLETE — HUMAN / INFRA BLOCKERS REMAIN

Release SHA              9f1da6f          clear
Git / CI                 PASS             no divergence, remote == local
Application readiness    READY            verified RC, pins fail closed, gates proven locally
Production host          NOT PROVISIONED  ← the dominant blocker
Topology                 PARTIAL          containers decided; Nuxt run method undecided
Reverse proxy            ABSENT
DNS                      on Wix nameservers; old site live; cutover = NS migration
TLS                      terminator undecided
PUBLIC_URL               undecided (licence activation binds to it)
Secrets                  contract proven; production injection mechanism undecided
PostgreSQL / uploads     persistence design ready; host absent
Backup                   tooling proven locally; destination / schedule / retention / offsite undecided
Restore                  TEST-target restore proven; production cut-over not provided
Rollback                 partial; written production procedure still missing
Initial data             option A available and recommended; not chosen
Merge                    READY (branch protection recommended first)

Production release:      NOT APPROVED
Deploy:                  NOT AUTHORIZED — do not start
```

**What is genuinely ready:** the software. The release candidate is verified, CI is green, the runtime pins fail
closed, the security remediation is closed on evidence, the public-safety gates hold, backup and restore tooling
is proven locally, and provisioning a fresh environment from Git is a measured 13-step run.

**What is not ready is the environment it would run in** — and none of that can be resolved by writing more
code. It needs a server, four architecture decisions (§32 B-2, B-3, B-4, B-7), and three operations decisions
(§32 B-5, B-6, B-8).

*Written 2026-09-18 by Claude Code in FINAL-RELEASE-PRODUCTION-PREFLIGHT-01. No production system was
contacted, no DNS or firewall was changed, no certificate was issued, no container was started or stopped, no
secret was read, and nothing here is a production approval or a legal conclusion.*

---

## 34. Addendum — PostgreSQL bind-mount ownership corrected to 70:70

> Added by **PRODUCTION-PREFLIGHT-UID-CORRECTION-01** (2026-09-18), a minimal fact correction inside this
> preflight. Documentation only: no runtime, image pin, Compose file, network, secret, reverse proxy, DNS or
> business code was changed.

**What was wrong.** §4, §15, `docs/ADMIN-CMS-SETUP.md` §6.1 and one line of `CURRENT-STATE.md` gave the production
PostgreSQL bind mount `/data/litubo/postgres` an owner of **uid 999** (`chown -R 999:999`). That is the `postgres`
user of the **Debian** variant of the official image. This project pins the **Alpine** variant, whose `postgres`
user is uid/gid **70**. Followed literally, the setup step would have given the data directory the wrong owner.

**The facts, now recorded.**

| Image (pinned) | Service user | Directory ownership |
|---|---|---|
| `postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` | `uid=70(postgres) gid=70(postgres)` | `/var/lib/postgresql` **70:70** · `/var/lib/postgresql/data` **70:70** |
| `directus/directus:12.3.1@sha256:8978edf633ae28aa31464bb71c55300c94d8bc771ff3727b5fac485173283869` | `uid=1000 gid=1000` (`node`) | `/directus/uploads` **1000:1000** — unchanged |

**Evidence.**

- **Authoritative — Linux, the target cloud server.** The Controller ran both exact pinned digests on the Tencent
  Cloud server and measured every value in the table above. Bind-mount ownership is a property of a Linux host,
  so this measurement is the one the production contract rests on.
- **Corroborating — the local development environment, same digests** (`verify-postgres-pin` and
  `verify-directus-pin` both exit 0, so the running images are exactly the pins). Read-only `docker compose exec`:
  PostgreSQL's `postgres` user `uid=70 gid=70`; its server process (PID 1) `70:70`; `/var/lib/postgresql`
  `70:70`. Directus default user and server process `1000:1000`. Every **image** fact agrees.
- **Not used as evidence.** Locally, the bind-mounted `/var/lib/postgresql/data` shows `70:0` and
  `/directus/uploads` shows `0:0`. Both are Windows directories mounted through Docker Desktop, which presents
  ownership its own way; a Windows workstation cannot demonstrate Linux bind-mount ownership. (`docker compose
  exec postgres id` without a user name also reports root: the PostgreSQL image's default user is root and its
  entrypoint drops to `postgres` for the server, which is why the named user and PID 1 were read instead.)

**Corrected in:** §4 and §15 above; `docs/ADMIN-CMS-SETUP.md` §6.1 (`sudo chown -R 70:70 /data/litubo/postgres`,
with the reason, so it is not "fixed" back to 999 later); `CURRENT-STATE.md`. A repository-wide search found no
other statement of PostgreSQL ownership and no test asserting one. The Directus uploads owner stays 1000:1000.

**What this addendum does not do.** It does not re-assess §3 / blocker B-1 or any other section. That a Tencent
Cloud server has now run the pinned images is recorded here only as the provenance of the ownership fact; the
host's specification, operating system, architecture, Docker versions, network and the other blockers are
**not** re-assessed by this minimal correction, and the result in §33 is unchanged. A later preflight pass should
bring the new host facts in formally.

*Addendum written 2026-09-18 by Claude Code in PRODUCTION-PREFLIGHT-UID-CORRECTION-01.*
