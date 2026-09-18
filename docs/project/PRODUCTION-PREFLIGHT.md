# Production Preflight

> **Current result — FINAL-RELEASE-PRODUCTION-PREFLIGHT-02 (2026-09-18): PRODUCTION PREFLIGHT STILL INCOMPLETE.**
> The production host now exists and has been measured, and the V1 deployment topology is frozen (D-043). Still open:
> `DIRECTUS_PUBLIC_URL`, the canonical host and TLS, backup schedule / retention / encryption / offsite, the written
> production rollback, the production secret files, and three items this pass found (§47). **Part II (§35–§48) is the
> current assessment.** Part I (§1–§34) below is the FINAL-RELEASE-PRODUCTION-PREFLIGHT-01 record as written from the
> repository alone; it is kept, with a one-line pointer wherever Part II supersedes it.

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

> **Updated (§35):** the remote review branch is now `32e877a` — documentation-only commits since `9f1da6f` — with
> its own GitHub CI success (run `35303613756`); `origin/master` is still `8f2e384`.

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

> **Superseded (§36–§37):** the production host now exists — Tencent Cloud Lighthouse, Frankfurt Zone 2, the server
> that already runs the refrigerant-store system.

**PRODUCTION HOST = NOT YET PROVISIONED (no information of any kind in the repository).**

Every reference is a placeholder or an intention: `ssh user@<server-host>`, `http://<server-public-ip>:8055`,
"the existing US Tencent Cloud server". There is no recorded address, hostname, region, instance type,
specification, owner or SSH access path, and nothing in this module contacted a server.

This is not a defect in the code. It is the missing input that blocks the infrastructure half of this preflight.
The minimum information needed is listed in §31.

## 4. Operating system

> **Superseded (§36):** Ubuntu Server 24.04.4 LTS on x86_64 — the architecture this project has verified.

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

> **Updated (§36, §38):** measured host — 2 vCPU, about 3.6 GiB, about 59 GB, shared with an existing workload;
> sufficient for rehearsal and initial deployment verification, not proven for long-term production.

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

> **Updated (§39–§40):** Docker Engine 29.1.3 · Compose v2 2.40.3 · LITUBO's own Node 22.22.2 at
> `/opt/litubo/runtime/node-current`; Nuxt runs as a systemd host process on that Node.

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

> **Still OPEN (§43).** The statements presenting `http://localhost:8055` as the production value, in `.env.example`
> and `ADMIN-CMS-SETUP.md` §6.1, are now marked stale pending the Controller's decision.

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

> **Superseded (§39, D-043):** Nuxt runs as a host process under systemd on `127.0.0.1:3310`, so the extractor
> address is the loopback gateway, `http://127.0.0.1:8787`.

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

> **Updated (§39):** the Nuxt application listens on `127.0.0.1:3310`, set explicitly — Nitro binds every interface
> when no host is given.

**Status: intended design clear and enforced in Compose for the containers; unverifiable on a host that does
not exist.**

## 12. Firewall

**NOT ASSESSABLE** — no host. Required at deploy time: allow 80/443, deny 8055, 8787 and 5432 from the
Internet, and verify with `ss -tlnp | grep 8055` showing `127.0.0.1:8055` plus an external `curl` to port 8055
timing out (`ADMIN-CMS-SETUP.md` §7). **DEPLOY-TIME GATE.** Nothing was changed here.

## 13. Reverse proxy — **BLOCKER**

> **Partially superseded (§39, §44):** the architecture is frozen — the existing host Nginx gets its own LITUBO virtual
> host in front of Nuxt; the virtual host itself, TLS and forwarded-header handling remain open.

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

> **Updated (§39):** Nuxt is a host process, so the loopback gateway path applies. The image a production host runs is
> a new open item (§47 row 19).

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

> **Updated (§45):** the mechanism is frozen — protected server-side configuration injected into the systemd process
> environment; no file exists yet. `DIRECTUS_URL` and `DOCUMENT_EXTRACTOR_URL` now follow from the topology (§39).

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

> **Updated (§46):** `/data/litubo/backups` now exists on the host (mode 700); schedule, retention, encryption and
> offsite storage remain open.

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

> **Superseded (§41):** option A is chosen — a fresh, empty production database.

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

> **Mostly answered (§36–§40):** items 1 and 3–7 are answered; item 2 is not part of the evidence; items 8–11 remain
> open; item 12 is answered as a mechanism (§45), not yet as files.

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

> **Superseded by the reconciliation in §47.**

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

> **Superseded by §48 — PRODUCTION PREFLIGHT STILL INCOMPLETE.**

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

---

## Part II — FINAL-RELEASE-PRODUCTION-PREFLIGHT-02: reassessment with server evidence

> Module: **FINAL-RELEASE-PRODUCTION-PREFLIGHT-02** · 2026-09-18 · TYPE C · A1 `GOVERNANCE_DOCS` · local commit only.
> **Result: PRODUCTION PREFLIGHT STILL INCOMPLETE.** The production host now exists and has been measured, and the
> Controller has frozen the V1 deployment topology (D-043). What remains open is what a server cannot settle by
> existing: `DIRECTUS_PUBLIC_URL`, the canonical host and TLS, backup schedule / retention / encryption / offsite, the
> written production rollback and the production secret files — plus three items this pass found (§47 rows 18–20).
> Production release remains **NOT APPROVED**; merge and deploy each still require their own authorization.

## 35. Scope, baseline and evidence

| Item | Value |
|---|---|
| Branch / start HEAD | `review/final-release-verification-01` / `32e877a162bbbf6db86aedf56d3495afe8efa938` — matches the work order |
| Remote review branch | `32e877a` — equal to the start HEAD |
| GitHub CI for `32e877a` | run `35303613756`, completed / **success** — verified independently by the Controller |
| Since `9f1da6f` (Part I's release SHA) | documentation only: six files under `docs/`, no runtime, test or workflow change |
| `origin/master` | `8f2e3847e0d7acda1bd987ffd18c3af03377fef9` — unchanged, not merged |
| Tracked changes at start | 0; the six historical untracked paths untouched |

**Where the facts come from.** Every server fact in §36–§40 was measured on the real server by the Controller and the
user — read-only checks plus a safe installation (the LITUBO Node runtime, the Git checkout, the build and the
directories) — and handed to this module in its work order. This module did not contact the server. Facts drawn from
the repository cite the file and line.

**What this module did not do.** No deployment; no service, container or database started; no `docker compose up`; no
schema apply or provisioning; no Directus administrator created; no licence key used and no activation consumed; no
`.env` created or read; no secret read, printed or requested; no Nginx, firewall, DNS, Wix, Cloudflare or registrar
change; no certificate; no AI call; no e-mail; no `npm audit fix` or `npm upgrade`; no push; no merge.

## 36. Production host — measured

| Item | Value |
|---|---|
| Provider | Tencent Cloud Lighthouse |
| Region | Frankfurt Zone 2 |
| Operating system | Ubuntu Server 24.04.4 LTS |
| Architecture | x86_64 (`linux/amd64`) |
| CPU | 2 vCPU |
| Memory | nominal 4 GB; about 3.6 GiB visible to the host |
| Disk | 60 GB class; filesystem about 59 GB |
| Free disk after the Nuxt build | about 40 GB |

- **The architecture is the verified one.** `linux/amd64` is the only architecture this project has run and verified
  (§4), and both pinned images have now run on this host (§34). The §4 architecture concern is closed.
- **The region differs from the documentation.** D-001, `CLAUDE.md`, `01-technical-decision.md` and
  `00-current-status.md` describe "the existing **US** Tencent Cloud server". The verified host — the existing server
  that already runs the refrigerant-store system — is in **Frankfurt**. The substance of D-001 (reuse the existing
  Tencent Cloud server as the single application server) matches the verified host; only the region label does not.
  This is recorded for the Controller to confirm (§47 row 20). This module does not edit D-001, `CLAUDE.md` or the
  technical decision; it adds a fact note to `CURRENT-STATE.md` §1.

## 37. Existing workload on the same host — must not be disturbed

| Existing | Fact at verification |
|---|---|
| Application directory | `/home/ubuntu/refrigerant-store` |
| Containers | `deploy_server_1`, `deploy_redis_1`, `deploy_mysql_1` — all `Up 3 weeks` |
| Host Nginx | listening on `:80`; its `/api/` location proxies to `localhost:8080` for the old application |
| Existing application | `:8080` |

LITUBO work must not change, restart, migrate or redesign any of this. What that means for the deployment module:

1. **LITUBO needs its own Nginx virtual host, selected by its own host name.** LITUBO's server API lives entirely under
   `/api/*` (public CMS, inquiries, admin), so it can never share the old application's `/api/` location, and that
   location is not to be edited.
2. **No LITUBO host name may resolve to this server before the LITUBO virtual host exists** — until then Nginx would
   answer that name with whichever server block it treats as the default.
3. **Compose isolation is already in the repository.** `docker-compose.yml` fixes `name: litubo-cms`, so LITUBO's
   containers and networks are namespaced apart from the old `deploy_*` project. Every LITUBO script and runbook uses
   `docker compose` (the v2 plugin, 2.40.3 here); none uses the legacy `docker-compose` 1.29.2, which stays installed
   for the old system and is not removed.
4. **Port availability is not yet verified.** The evidence lists `:80` and `:8080` in use; whether `127.0.0.1:3310`,
   `:8055` and `:8787` are free was not part of it. A read-only listener check is a deployment-module entry step.
5. **Memory, CPU, disk and the Docker daemon are shared** — see §38.

## 38. Capacity — sufficient for rehearsal, not proven for production

The measured host (§36) is shared with the workload in §37. The repository's only sizing data is the local baseline
(§5; `PRODUCTION-CAPACITY-DEPENDENCY-REVIEW.md`): Directus about 237 MiB idle and 280–316 MiB under load (measured on
11.17.4; 12.3.1 not re-measured), PostgreSQL about 30 MiB, the Nuxt server 75–193 MiB, and declared caps of 512 MiB
for the extractor and 96 MiB for its gateway. Directus and PostgreSQL declare no memory limit. Locally the Directus,
PostgreSQL and extractor images occupy about 1.21 GB, 420 MB and 633 MB of disk.

**Conclusion — the only one the evidence supports:** the host is **sufficient to continue production rehearsal and
initial deployment verification.** It is **not** proven sufficient for long-term production. Memory, CPU, swap and disk
growth (images, logs, backup sets) must be measured again once the full LITUBO stack runs beside the existing workload.

## 39. Frozen V1 production topology (D-043)

Decided by the Controller; recorded here, not designed here.

```text
Internet
   ↓ 80 / 443
Nginx — the existing host Nginx; LITUBO gets its own virtual host (not configured yet)
   ↓
Nuxt 127.0.0.1:3310 — host process under systemd, /opt/litubo/runtime/node-current/bin/node
   ↓ server API only
Directus 127.0.0.1:8055 — Compose; the Studio only through an SSH tunnel
   ↓
PostgreSQL — Compose network litubo-internal only; no published port

Nuxt → document-extractor-gateway 127.0.0.1:8787 → document-extractor (internal: true network)
```

| Component | Runs as | Address | In the repository today | Left to the deployment module |
|---|---|---|---|---|
| Nuxt | host process under systemd, on LITUBO's own Node by explicit path; **not** in Compose | `127.0.0.1:3310`, never `0.0.0.0` | no unit file (deliberately not created here) | the unit, its environment and its logs |
| Directus | Compose | `127.0.0.1:8055` | already so (`docker-compose.yml`, guarded by test) | verify the listener on the host; outbound HTTPS to the licensing and telemetry hosts |
| PostgreSQL | Compose | no published port | already so | — |
| document-extractor | Compose, `internal: true` network | no published port | already so | image provenance (§47 row 19) |
| Extractor gateway | Compose | `127.0.0.1:8787` | already so | isolation was measured on Docker Desktop (also Engine 29.1.3); re-verify on Linux |
| Nginx | existing host service | 80 / 443 | no configuration in Git | the LITUBO virtual host, after the canonical host / TLS decision (§44) |

**Three repository facts the unit and the build depend on:**

1. **Nitro listens on every interface unless told otherwise.** The built server takes its port from `NITRO_PORT` or
   `PORT` (default 3000) and its host from `NITRO_HOST` or `HOST`, with no default host
   (`node_modules/nitropack/dist/presets/node/runtime/node-server.mjs` lines 17–18; nitropack 2.13.4 per the lockfile).
   The unit must set the host to `127.0.0.1` and the port to `3310` explicitly; leaving the host out binds all
   interfaces.
2. **One process.** The admin session-refresh coordinator, both rate limiters and pending AI proposals are per-process
   memory state. A single systemd instance is what they were built for, and a restart clears them. The multi-instance
   precondition in `MASTER-ROADMAP.md` M8 (a shared coordinator) does not arise.
3. **Non-secret configuration is read whenever `nuxt.config.ts` is evaluated — including at build time.** Under D-043:

| Setting | Build-time variable (default) | Run-time override | Value under D-043 |
|---|---|---|---|
| `directusUrl` | `DIRECTUS_URL` (empty) | `NUXT_DIRECTUS_URL` | `http://127.0.0.1:8055` |
| `documentExtractorUrl` | `DOCUMENT_EXTRACTOR_URL` (`http://127.0.0.1:8787`) | `NUXT_DOCUMENT_EXTRACTOR_URL` | `http://127.0.0.1:8787` — the default |
| `cmsMode` / `productsCmsMode` | `CMS_MODE` / `CMS_MODE_PRODUCTS` (`fixtures`) | `NUXT_CMS_MODE` / `NUXT_PRODUCTS_CMS_MODE` | `directus` — anything else fails closed (503) |
| `public.siteUrl`; i18n `baseUrl` (line 35) | `NUXT_PUBLIC_SITE_URL` (`https://litubo.com`) | `NUXT_PUBLIC_SITE_URL` (for `siteUrl`) | the canonical host — **OPEN** (§44) |
| Listen address | — | `NITRO_HOST` / `NITRO_PORT` | `127.0.0.1` / `3310` |

These are addresses and switches, not secrets. The host's build of `32e877a` was made in an environment this module
did not see, so the non-secret values baked into it are unknown: it proves the build works on the host, and it is
**not** the release artifact. The release artifact comes from the canonical release entry `npm run release:verify`
(Node gate → Directus pin → PostgreSQL pin → published-TEST-data check → build; D-041 (5)). That entry needs the
Directus and PostgreSQL containers running, so it belongs to the deployment module, and it should run with the decided
canonical host, because the i18n `baseUrl` is taken from the same variable when the configuration is evaluated.

## 40. Runtime, checkout, build and directories — measured

| Item | Fact |
|---|---|
| Docker Engine | 29.1.3 |
| Docker Compose (v2 plugin) | 2.40.3 |
| Legacy `docker-compose` | 1.29.2 — kept for the existing system; not removed, not upgraded, not a LITUBO entry point |
| LITUBO Node | `/opt/litubo/runtime/node-current` — Node 22.22.2, npm 10.9.7 (matches `.nvmrc`; D-038 (1)) |
| System Node | 18.20.8 / npm 10.8.2 — left in place; LITUBO does not replace it |
| Checkout | `/opt/litubo/repo`, fast-forwarded to `32e877a`; working tree clean |
| Build | `npm ci` and `npm run build` succeeded; Nuxt 3.21.11 (the version `package-lock.json` pins); `.output/server/index.mjs` exists |
| npm advisories | `npm ci` printed an audit advisory; its content is not part of the evidence, and **nothing was fixed or upgraded** — no `npm audit fix`, no `--force`, no `npm upgrade`. The last recorded dependency review is D-041's (production dependencies: critical 0 / high 1, the build-time `glob` / moderate 2 / low 1) |

| Path | Owner | Mode | Purpose |
|---|---|---|---|
| `/data/litubo/postgres` | 70:70 | 755 | PostgreSQL data bind mount (`POSTGRES_DATA_DIR`); owner = the pinned Alpine image's `postgres` user (§34) |
| `/data/litubo/uploads` | 1000:1000 | 755 | Directus uploads bind mount (`DIRECTUS_UPLOADS_DIR`); owner = Directus uid 1000 |
| `/data/litubo/backups` | not part of the evidence | 700 | local backup output |
| `/etc/litubo` | root:root | 700 | protected server-side configuration |

**Existence only.** These facts prove the paths exist with the recorded owner and mode — nothing about their contents,
and nothing about a backup schedule, retention, encryption or offsite storage. **Entry check for the deployment
module:** under the fresh-database policy (§41), `/data/litubo/postgres` and `/data/litubo/uploads` must be empty
before the first start.

## 41. Initial production data — decided

**A fresh, empty production database** (§26 option A, now chosen). Nothing is copied from the development database, a
test database, TEST ONLY products, local sessions, local Directus data or a rehearsal database. Schema, permissions and
the service identity come from the repository's tracked provisioning artifacts (`scripts/provisioning-manifest.json`,
13 steps). Real products follow a separate, human-controlled rollout — one Draft → human verification → first publish
→ 3–5 products → verification → batch import (§27). This module created no product and no database.

Facts the deployment module has to carry (none of them decided here):

1. **The provisioning executor is not a production tool as written.** `scripts/provision-directus.mjs` refuses any
   database name containing `prod`, `production` or `live` — "this script has no production mode to opt into"
   (lines 16–17, 52, 91–93) — and states that production provisioning is "a separate, authorized activity". How the
   tracked artifacts are applied to the production database, and under which authorization, is a TYPE D decision.
2. **Provisioning waits for `DIRECTUS_PUBLIC_URL`.** Step `10` (schema baseline) is where a key-bearing Directus
   activates the licence (`PRODUCTION-PROVISIONING-RUNBOOK.md` §2), and the activation binds to `PUBLIC_URL` (§43).
3. **The Media Library folder tree is data, and a fresh database has none.** The governed folders
   (`server/utils/folderRegistry.ts` lines 55–72: `home`, `applications`, `company`, `products/xray` and the other
   product roots, `resources`, …) are rows in `directus_folders`; neither the schema snapshot nor any provisioning step
   creates them. Uploads still work — they land in *Needs Classification*, because the upload route accepts no folder
   (`server/api/admin/media/upload.post.ts` line 114) — but the LITUBO admin cannot create the governed roots, since a
   new folder needs an existing zone parent (`validateFolderCreate`, `folderRegistry.ts` lines 388–426). A decided
   bootstrap — a tracked artifact or a documented one-time step — is needed before real media is filed.
4. **After provisioning:** restart Directus (it caches schema and permissions), then run
   `npm run release:check-test-data` against the production database — only exit 0 passes.
5. **The explainable initial state** is unchanged from §26: 0 products, 0 content items, an empty sitemap and empty
   public lists.

## 42. Launch feature policy — decided

| Feature | Launch setting | Existing behaviour (unchanged) |
|---|---|---|
| AI providers | `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` unset | each provider reports "not configured"; no request, no cost |
| Product AI Apply | `PRODUCT_AI_APPLY_ENABLED` unset | closed in production (503); generation and review still work |
| HubSpot | `HUBSPOT_ACCESS_TOKEN` unset | inquiries stored as `not_configured`; no HubSpot request |
| SMTP | optional | without it the inquiry is **still stored** and only the notification is skipped; configuring it later is a separate step, and its values are never part of this module |

No AI key is connected, and no AI cost can arise from this configuration.

## 43. `DIRECTUS_PUBLIC_URL` — OPEN / BLOCKING BEFORE FIRST PRODUCTION DIRECTUS ACTIVATION

Unchanged from §9 and deliberately **not decided here**. No value is chosen — not `http://localhost:8055`, not
`https://www.litubo.com`, not `https://litubo.com`, not `https://cms.litubo.com`, not a temporary IP address or host
name. The OIG activation binds to the project and `PUBLIC_URL`, activations are limited (4 left), and production
Directus has never started, so the value can still be chosen correctly, once.

Until the Controller decides:

- no production Directus is started with the licence key, and no activation is consumed;
- the statements that presented `http://localhost:8055` as the production value are marked **stale / superseded
  pending Controller decision** — the comment above `DIRECTUS_PUBLIC_URL` in `.env.example`, and
  `docs/ADMIN-CMS-SETUP.md` §6.1 — without replacing them with any other value. The local-development value in
  `.env.example` is unchanged.

## 44. Canonical host and TLS — OPEN

Unchanged: apex or `www` is not decided, and neither is the TLS terminator (Cloudflare or an origin certificate). The
domain's nameservers are still Wix's and the old Wix site is live (§7), so cut-over is a nameserver migration. The
evidence shows the host Nginx on `:80`; `:443` is not part of it. Nothing was changed.

Whatever is decided, the application needs the following from the virtual host (repository facts):

| Requirement | Why |
|---|---|
| **HTTPS before production admin use** | the admin session cookies are `Secure` in production (`server/api/admin/auth/login.post.ts` lines 50–52), so `/admin` — and with it the first product rollout — needs HTTPS |
| **Pass the original `Host` header to Nuxt** | the admin CSRF check compares the `Origin` host with the request's `Host` (`server/middleware/admin-auth.ts` lines 81–90); a proxy that sends `Host: 127.0.0.1:3310` makes every admin write fail with 403 |
| **Exactly one trustworthy client address in `X-Forwarded-For`** | the public inquiry limiter (`server/utils/publicInquiry.ts` lines 146–147) and the admin login lock-out (`login.post.ts` lines 5–6) both key on the first `X-Forwarded-For` address and fall back to the socket address. Overwrite the header with the real client address (restored from Cloudflare first, if Cloudflare is chosen) and never append to a client-supplied value, or the limits can be dodged; without the header every visitor is `127.0.0.1`, and five failed logins would lock every administrator out for 15 minutes |
| **Body size** | public inquiries are capped at 64 KB in the application (`publicInquiry.ts` line 40); admin media uploads allow 50 MB per file (`upload.post.ts` line 93), and the proxy limit must admit that on the upload route |
| **The old application's `/api/` location stays untouched** | §37 |

## 45. Secret and configuration mechanism — frozen, not yet provisioned

**Frozen (D-043):** Compose secret and configuration values stay **outside Git**; the Nuxt server's runtime secrets are
**injected into the systemd process environment from protected server-side configuration**. The prepared directory is
`/etc/litubo` (root:root, 700); nothing inside it is recorded, and this module created, read or checked no file there.

**Unchanged contract (D-038, D-039):** one canonical name per secret; no `NUXT_*` alias for a secret; nothing secret in
`.output`; a built server never reads a `.env` file; a missing secret fails closed.

**Not yet done — deployment module:** create the protected configuration; define exactly how Compose and the unit read
it; confirm the launch-required secrets are **present** — by name, never by value (§18: `DB_PASSWORD`,
`DIRECTUS_SECRET`, the administrator bootstrap pair, `DIRECTUS_LICENSE_KEY`, `DIRECTUS_TOKEN`,
`SUBMISSION_IP_SECRET`); and repeat the D-039 check that the release build contains no secret. `DIRECTUS_LICENSE_KEY`
must not reach a production Directus before §43 is decided.

## 46. Backup and rollback — re-classified on the new evidence

| Item | State | Evidence / reason |
|---|---|---|
| Backup / restore tooling | **PROVEN locally** (D-040) | unchanged |
| Backup output directory on the host | **EXISTS** | `/data/litubo/backups`, mode 700 — existence only |
| Backup schedule | **OPEN** | nothing scheduled or deployed |
| Retention | **OPEN** | not decided |
| Encryption at rest | **OPEN** | not decided; a set is credential material (§20) |
| Offsite destination (COS is a candidate) | **OPEN** | not chosen, not configured |
| Offsite transfer verification | **OPEN** | nothing to verify yet |
| Production restore / cut-over | **OPEN** | not a mode of the tool (§22) |
| Written production rollback | **OPEN** | not provided (§23; `RELEASE-SAFETY-GATES.md` §3A.8 step 8) |
| Restored uploads owned by uid 1000 on Linux | never rehearsed | the target directory's owner now matches (1000:1000) |

`/data/litubo/backups` sits on the same disk as the data it would protect, so on its own it is a staging location, not
an offsite destination (`PRODUCTION-BACKUP-RESTORE-RUNBOOK.md` §3: do not keep the only copy on the disk that holds
the data it protects). The host has a Git checkout, which makes "check out the previous release SHA and rebuild"
mechanically possible — but no written procedure exists, and data rollback still has no production path.

## 47. Blocker reconciliation

| # | Item | Previous state (Part I) | Current state | Evidence | Remaining action | Owner / next gate |
|---|---|---|---|---|---|---|
| 1 | Production host (B-1) | BLOCKING — no host information | **CLOSED** | Tencent Cloud Lighthouse, Frankfurt Zone 2 (§36) | — | — |
| 2 | OS / architecture (B-1) | NOT ASSESSABLE | **CLOSED** | Ubuntu Server 24.04.4 LTS; x86_64, the only verified architecture; both pinned images ran here (§34, §36) | — | — |
| 3 | Docker / Compose (B-1) | unverified | **CLOSED** | Engine 29.1.3; Compose v2 2.40.3; legacy 1.29.2 kept (§40) | LITUBO uses `docker compose` (v2) only; the legacy tool stays | deployment module |
| 4 | Capacity baseline | NOT ASSESSABLE (warning) | **PARTIALLY CLOSED** | 2 vCPU · about 3.6 GiB · about 59 GB · about 40 GB free after the build; shared host (§36–§38) | measure again with the full stack beside the existing workload | deployment module → post-deploy review |
| 5 | Nuxt production run mode (B-2) | BLOCKING — undecided | **CLOSED** (decision) | D-043: systemd host process, explicit Node path, `127.0.0.1:3310` (§39) | write the unit; set host and port explicitly | deployment module |
| 6 | Reverse proxy architecture (B-3) | BLOCKING — none | **PARTIALLY CLOSED** | frozen: existing host Nginx → own LITUBO virtual host → `127.0.0.1:3310` (§39); no virtual host exists | write it after row 13: `Host` pass-through, one trustworthy `X-Forwarded-For`, body size, timeouts (§44); old server blocks untouched | Controller (row 13) → deployment module |
| 7 | Network exposure plan | design clear; not verifiable | **PARTIALLY CLOSED** | public 80 / 443 only; 3310 / 8055 / 8787 on loopback; 5432 unpublished; Studio via SSH tunnel; the Compose bindings are in the repository and tested (§39) | on the host: listener check, external probe, Lighthouse firewall rules (not part of the evidence), outbound HTTPS for Directus licensing and telemetry | deployment module |
| 8 | Persistence paths | design ready; no host | **CLOSED** | `/data/litubo/postgres` 70:70 755; `/data/litubo/uploads` 1000:1000 755 (§40) | confirm both are empty before the first start | deployment module (entry check) |
| 9 | Initial production data source (B-8) | BLOCKING — not chosen | **CLOSED** (decision) | fresh empty database; tracked provisioning artifacts; staged product rollout (§41) | the production provisioning path and its authorization (the executor refuses production names); a folder-tree bootstrap; runs only after row 12 | Controller → deployment module |
| 10 | Production build feasibility | not assessed | **CLOSED** (Nuxt) | host `npm ci` + `npm run build` at `32e877a`; Nuxt 3.21.11, as the lockfile pins; `.output/server/index.mjs` (§40) | produce the release artifact with `npm run release:verify` and the production non-secret configuration (§39) | deployment module |
| 11 | Backup destination existence (B-5) | "exists only as text" | **PARTIALLY CLOSED** | `/data/litubo/backups` exists, mode 700, on the same disk as the data (§40, §46) | an offsite destination (row 14) | Controller |
| 12 | `DIRECTUS_PUBLIC_URL` (B-4) | BLOCKING | **OPEN — BLOCKING BEFORE FIRST PRODUCTION DIRECTUS ACTIVATION** | undecided; stale `localhost` statements marked (§43) | decide the value and understand its licensing consequence; no key and no activation before then | Controller |
| 13 | Canonical host / TLS (B-7) | BLOCKING | **OPEN** | nameservers on Wix; old site live; `:443` not part of the evidence; the admin cookie is `Secure` in production (§44) | decide apex or `www` and the terminator; then certificate, virtual host and a nameserver migration plan | Controller → deployment module |
| 14 | Backup schedule / retention / encryption / offsite (B-5) | BLOCKING | **OPEN** | nothing decided or configured (§46) | decide, implement, verify an offsite transfer | Controller → operations module |
| 15 | Production rollback (B-6) | BLOCKING | **OPEN** | no written production rollback or cut-over (§46) | write it — code, Directus image, data, DNS, proxy | Controller → deployment module |
| 16 | Secret injection | open — it depended on B-2 | **PARTIALLY CLOSED** | mechanism frozen; `/etc/litubo` (700) exists; no file, no value (§45) | create the protected configuration; presence-only check; secret-free release build | deployment module |
| 17 | Branch protection / merge status | technically merge-ready; protection not enabled | **OPEN** — human gate, unchanged | remote review branch `32e877a`, CI run `35303613756` success; `origin/master` `8f2e384`; this module's commit is local only | push and merge decisions (A3 / A4); enabling protection before merge is recommended | Controller |
| 18 | Co-tenancy with the refrigerant-store system | not known | **OPEN** (new) | its containers, Nginx `:80`, the app on `:8080`, `/api/` → `:8080` (§37) | own virtual host by host name; confirm 3310 / 8055 / 8787 are free; change nothing of the old system | deployment module (entry check) |
| 19 | document-extractor image on the host | not raised | **OPEN** (new) | the base image is pinned by digest but the apt layer is not (`document-extractor/Dockerfile` lines 5, 15–16); D-042's classification covers image `sha256:8d3d0639…` only | run that exact image, or build → scan → classify to BLOCKING 0 / UNKNOWN 0 before production | Controller → deployment module |
| 20 | Region label ("US" in D-001 and three documents) | not raised | **OPEN** (documentation) | verified region Frankfurt Zone 2 (§36) | the Controller confirms; the wording is corrected in an authorized module | Controller |

Human gates carried unchanged from §29: the Poppler / libvips / util-linux review and the privacy policy with
`PRIVACY_POLICY_VERSION` are **OPEN**; OIG eligibility and the telemetry acceptance stay closed by the business owner.

## 48. Final result

```text
PRODUCTION PREFLIGHT STILL INCOMPLETE

Closed             host · OS / architecture · Docker / Compose · Nuxt run mode (decided) · persistence paths ·
                   initial data (decided) · launch feature policy (decided) · Nuxt build feasibility
Partially closed   capacity · reverse proxy · network exposure · backup destination (local directory only) ·
                   secret mechanism
Open               DIRECTUS_PUBLIC_URL (blocking before the first production Directus activation) ·
                   canonical host / TLS · backup schedule / retention / encryption / offsite ·
                   written production rollback · co-tenancy entry checks · extractor image provenance ·
                   region label in D-001
Human gates        Poppler / libvips / util-linux review · privacy policy and version ·
                   master branch protection · merge (A4) and deploy (A5) authorizations

Production release NOT APPROVED
Deploy             NOT AUTHORIZED — do not start
```

**Why not PASS.** The server exists, so everything a server settles by existing is now settled. What remains are
decisions only the Controller and the business owner can make — the Directus public URL, the canonical host and TLS,
the backup destination and policy, the rollback procedure — and the artifacts that follow from them. None of these is
resolved by writing code, and none may be closed early to reach a deployment. No `FINAL-RELEASE-MERGE-AND-DEPLOY-01`
candidate is registered while the preflight is not PASS.

**This module's footprint on production: none.** Production service starts 0 · production database writes 0 · licence
activations 0 · secret reads 0 · Nginx changes 0 · DNS changes 0 · deployments 0.

*Part II written 2026-09-18 by Claude Code in FINAL-RELEASE-PRODUCTION-PREFLIGHT-02. The server facts are the
Controller's and the user's measurements; nothing here is a production approval or a legal conclusion.*
