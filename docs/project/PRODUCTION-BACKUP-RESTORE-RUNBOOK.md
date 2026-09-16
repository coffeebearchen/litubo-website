# Production Backup and Restore Runbook

> Scope: backing up and restoring the **Directus database and the Directus uploads** of a LITUBO
> environment, as one backup set.
> Status: **LOCAL_REHEARSAL_PROVEN** (FINAL-RELEASE-PRODUCTION-READY-02, D-040). Production and
> offsite backup storage, retention and encryption at rest are **not proven** and remain open
> operations decisions. Production deployment remains **NOT AUTHORIZED** and requires its own TYPE D
> authorization (`PROJECT-EXECUTION-PROTOCOL.md` §4, §13.4).

The tools are `scripts/backup-create.mjs` and `scripts/backup-restore.mjs` (`npm run backup:create`,
`npm run backup:restore-test`); everything they share, and everything their tests exercise, is in
`scripts/backup-set.mjs`. This runbook explains how to use them and what they prove. It is the
backup and rollback basis that `RELEASE-SAFETY-GATES.md` §3A.8 steps 7 and 8 and
`PRODUCTION-PROVISIONING-RUNBOOK.md` §1 require before any production mutation.

---

## 0. What a backup set is

A database dump alone restores rows that point at media files nobody saved; a copy of the uploads
alone restores files no row describes. **The database and the uploads are one recoverable unit.**
A backup set is a directory `litubo-backup-YYYYMMDD-HHMMSS` (UTC) holding exactly four files:

| File | Content |
|---|---|
| `database.dump` | `pg_dump` custom format of the Directus database |
| `uploads.tar` | POSIX ustar archive of the Directus uploads directory — readable by any standard `tar` |
| `SHA256SUMS` | `sha256sum -c` compatible checksums of the two components |
| `manifest.json` | non-secret metadata, written last: format version, time, Git commit, Node, Directus version and image digest, PostgreSQL and `pg_dump` versions, both checksums and sizes, a per-table row count and content hash of the database, sequence positions, schema object counts and a schema-definition hash, and a per-file inventory (path, bytes, SHA-256) of the uploads |

A set without `manifest.json` is not a set. A backup that fails leaves its directory named
`….incomplete`, without a manifest; the restore tool refuses both.

### What is in it, and what is not

| State | Owner | In the backup set |
|---|---|---|
| Application code, Directus schema snapshots, tracked SQL artifacts (constraints, guards, access bootstrap, permissions), provisioning manifest, runbooks | Git | No — Git is its backup |
| Products, categories, Content Center items and locales, settings, posts, inquiries, media metadata (`directus_files`, folders, `media_file_lifecycle`), relations, roles / policies / access / users / permissions, activity, revisions, sessions, migrations, and every custom constraint, trigger, function and sequence | PostgreSQL | `database.dump` |
| Directus media files: originals, the transforms Directus generates from them (`<id>__<key>.<ext>`), the `directus-health-file` probe | Directus uploads directory | `uploads.tar` |
| `DIRECTUS_TOKEN`, `SMTP_PASS`, `SUBMISSION_IP_SECRET`, `HUBSPOT_ACCESS_TOKEN`, AI provider keys, `DB_PASSWORD`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_PASSWORD` | Deployment environment / secret manager | **Never collected by the tools** (§6) |
| Nuxt in-memory state: rate limits, AI proposals, SourceRefs | Nuxt process | No — lost on every restart by design |
| `document-extractor` | stateless container | No state to back up |
| `private-product-source/` | local working material, not read by the application | No — not application state |

**The database itself is sensitive.** It legitimately contains the nuxt-server service user's static
token (the restored identity needs it), administrator password hashes, session rows and inquiry
contact data. A backup set must be handled like a credential store: never in Git, never in a shared
location without access control. Encryption at rest is an open decision (§3).

---

## 1. Consistency: quiesced, not atomic

`pg_dump` reads one consistent database snapshot, but nothing makes that snapshot and a copy of the
uploads directory the same instant. The set is consistent because **nothing can write either side
while it is taken** — a *quiesced consistent backup set*. It is not a database-level atomic snapshot
and must not be described as one.

Writers, from the repository and the running environment (FINAL-RELEASE-PRODUCTION-READY-02):

| Writer | Writes | Stopped by |
|---|---|---|
| Directus (admin app, REST API) | database; uploads (upload, replace, transforms generated on asset requests, `directus-health-file` on `/server/health`) | `docker compose stop directus` |
| Nuxt server | nothing directly — it has no database driver and writes no files; every write (inquiries, admin changes, AI Apply) goes through Directus | stopping Directus (its writes then answer 503) |
| Directus flows / schedules | none exist locally (0 flows) | re-check before production |
| Maintenance tools: `scripts/provision-directus.mjs`, the Directus CLI, the database integration tests, manual `psql` | database, directly | not running them during the window |
| PostgreSQL internals (autovacuum, statistics) | no logical data | — |

The contract, which the tool enforces rather than trusts:

1. The operator stops Directus.
2. `backup-create` refuses to start unless the Directus container is stopped, **no running container
   mounts the uploads directory**, and **no client session is connected to the database**.
3. It fingerprints the database, dumps it, archives the uploads.
4. It repeats every check, re-fingerprints the database and re-lists the uploads; any difference fails
   the backup (`QUIESCE_BROKEN`) and leaves an incomplete set.
5. Only then does it write `SHA256SUMS` and `manifest.json` and rename the set to its final name.
6. The operator starts Directus again.

During the window the public site answers 503 for CMS reads and inquiry submissions. **Do not log in
while Directus is stopped**: the admin login counts an unavailable Directus as a failed attempt and
locks the address for 15 minutes after five.

---

## 2. Backup

Requirements: Node 22.22.2 (`node scripts/verify-node-runtime.mjs`), Docker, the Postgres container
running, an output directory that already exists **outside the repository or ignored by Git**
(locally `backups/`), and free space for about the database size plus the uploads size.

```bash
docker compose stop directus
node scripts/backup-create.mjs \
  --postgres-container litubo-cms-postgres-1 \
  --database litubo_cms \
  --directus-container litubo-cms-directus-1 \
  --uploads-dir dev-data/uploads \
  --output-dir backups
docker compose start directus
```

In production the same command takes the production values, for example `--uploads-dir
/data/litubo/uploads --output-dir /data/litubo/backups` (the documented locations in
`docs/ADMIN-CMS-SETUP.md` §6.1 and `docs/ADMIN-CMS-SPEC.md` §2.3 — not yet verified on a server).
Every target is explicit; there are no defaults.

Before anything is written, the tool refuses when:

| Code | Meaning |
|---|---|
| `NOT_QUIESCED` | Directus is running, another running container mounts the uploads, or a client session is connected to the database |
| `UPLOADS_SOURCE_MISMATCH` / `UPLOADS_SOURCE_UNKNOWN` | `--uploads-dir` is not the directory the Directus container stores its files in |
| `OUTPUT_NOT_GIT_IGNORED` / `OUTPUT_OVERLAPS_UPLOADS` / `OUTPUT_DIR_MISSING` | the output could be picked up by Git, overlaps the uploads, or does not exist |
| `IMAGE_NOT_PINNED` | the Directus container does not run an exact version pinned by digest, so the manifest could not say which Directus the data belongs to |
| `UPLOADS_UNEXPECTED_ENTRY` | the uploads directory holds something that does not belong there (`.env*`, `.git`, PostgreSQL data files, a backup set, a symbolic link) — the wrong directory was named |
| `INSUFFICIENT_SPACE`, `DATABASE_MISSING`, `TOOLS_MISSING`, `DOCKER_UNAVAILABLE` | as named |

While it runs, it fails with `DUMP_INVALID` if `pg_restore --list` cannot read the dump or the dump
does not contain every table and its data, `DUMP_COPY_FAILED` if the copy out of the container does
not hash to what `pg_dump` wrote, `ARCHIVE_INVALID` if the archive does not read back identically, and
`QUIESCE_BROKEN` if anything moved. Exit code 0 means a complete, verified set.

---

## 3. Storage

- **Never in Git.** The tool refuses an output directory inside the repository unless Git ignores it;
  `.gitignore` ignores `backups/` and `dev-data/`.
- Keep several dated sets. Do not keep the only copy on the disk that holds the data it protects.
- **Open operations decisions** (not decided by this runbook): how long sets are kept, where offsite
  copies go (for example Tencent Cloud COS), encryption at rest, and automated scheduling. Older
  documents suggested differing periods (`ADMIN-CMS-SPEC.md` §2.3, kept as history: database 14 days,
  uploads 7 days; the former `OPERATIONS-HANDBOOK.md` §7: database 30 days, media 3 months) — those were
  suggestions, not decisions, and a schedule that backs the two up separately does not produce a
  consistent set.
- A set must be restorable without the machine that made it: the manifest records the per-file
  SHA-256 of every upload and a content hash of every table, so a restore verifies against the set
  itself, not against the source.

---

## 4. Restore (into a TEST target)

```bash
node scripts/backup-restore.mjs \
  --backup-set backups/litubo-backup-YYYYMMDD-HHMMSS \
  --postgres-container litubo-cms-postgres-1 \
  --target-database litubo_restore_test_YYYYMMDD \
  --target-uploads-dir /scratch/uploads-restore-test-YYYYMMDD
```

In order, and nothing is created before step 4:

1. **Targets.** The database name must contain `test` as its own underscore-separated part and no
   `prod` / `live`; it must not be the database the set was taken from. The uploads directory name must
   contain `test` as its own `-` / `_` / `.` separated part, must not overlap the development or the
   documented production uploads directory, must not be where Git could pick it up, and must be new or
   empty.
2. **Set.** The directory is a set name, not `.incomplete`; all four files exist; the manifest passes
   its allowlist schema; `SHA256SUMS` agrees with it; both components hash to the recorded values.
3. **Environment.** The Postgres server's major version is at least the one the set came from, and the
   target database does not exist — a restore never replaces a database.
4. **Database.** The tool creates the target database, copies the dump into the container, checks its
   hash there, and runs `pg_restore --exit-on-error --single-transaction`. If anything in this step
   fails, the restore is rolled back and the tool drops the database it created.
5. **Verify the database.** Every table's row count and content hash, every sequence position, the
   schema object counts and the schema-definition hash must equal the manifest (`RESTORE_DATABASE_MISMATCH`
   otherwise; the database is left for inspection).
6. **Uploads.** The archive is extracted into the target directory — exclusively, so no existing file
   is overwritten, and refusing any entry that is not a plain file or directory or would land outside the
   target — and every file's bytes must match its recorded SHA-256 (`RESTORE_UPLOADS_MISMATCH`).

Then start **the pinned Directus recorded in the manifest** against the restored targets, on its own
loopback port, without touching the running environment:

```bash
DIRECTUS_UPLOADS_DIR=/scratch/uploads-restore-test-YYYYMMDD \
docker compose run -d --no-deps --name litubo-restore-test-directus \
  -e DB_DATABASE=litubo_restore_test_YYYYMMDD -e TELEMETRY=false \
  -p 127.0.0.1:8057:8055 directus
```

Check `GET /server/ping` → `pong`, `GET /server/health` → 200, the container's `/directus/uploads`
mount is the restored directory (`docker inspect` mounts only), its database sessions go to the restored
database only, `directus_migrations` is unchanged (no migration ran), and anonymous requests answer the
same as the source environment. Remove the container, drop the TEST database and delete the TEST
directory when done — deleting only names that carry the TEST marker.

On a Linux host, Directus runs as uid 1000 (`docs/ADMIN-CMS-SETUP.md` §6.1): a restored uploads
directory it must write to needs that owner. This has not been rehearsed on Linux.

---

## 5. Restoring into production is not a mode of these tools

The restore tool only restores into targets marked TEST, and refuses any other name. A disaster-recovery
cut-over — making restored data the data a production Directus serves — is **not rehearsed and not
provided**. It needs its own procedure and its own TYPE D authorization. What is proven is that a set can
be restored into a fresh target, verified completely, and served by the pinned Directus.

---

## 6. Secrets

- The tools never read the process environment, a `.env` file or a container's environment; `docker
  inspect` is used only for state, image, name and mounts. PostgreSQL is addressed as `$POSTGRES_USER`,
  expanded inside the container over its local socket; no password is involved, and `pg_dump` /
  `pg_restore` run with `--no-password` so they fail instead of prompting. Output of the database tools
  is summarized, never echoed, so a failing `COPY` cannot print row data.
- **Restoring the database and the uploads needs no secret, and no secret needs to be in Git.**
- **Running the application on restored data still needs its runtime secrets**, from the deployment
  environment / secret manager (D-039): `DB_PASSWORD`, `DIRECTUS_SECRET` and the admin credentials for the
  containers, and `DIRECTUS_TOKEN` and the other server secrets for the Nuxt server. The restored database
  carries the service user's token as it was when the set was taken; if the token was rotated since,
  re-run provisioning step `32` with the current value (`PRODUCTION-PROVISIONING-RUNBOOK.md` §2).
- The backup set itself contains the database's own credential-bearing rows (§0). The tools collect
  nothing beyond the database and the uploads.

---

## 7. Failures

| Situation | What happens | What to do |
|---|---|---|
| Checksum mismatch | refused before anything is created (`CHECKSUM_MISMATCH`) | the set is damaged; use another set; never "try anyway" |
| Missing component or `.incomplete` set | refused (`SET_COMPONENT_MISSING`, `SET_INCOMPLETE`) | a partial set is never restored |
| Wrong target | refused (`TARGET_*`) | name a new TEST database and a new or empty TEST directory |
| `pg_restore` fails | rolled back; the created database is dropped | read the summarized error; check the PostgreSQL version and roles |
| Restored database differs | `RESTORE_DATABASE_MISMATCH`; database kept for inspection | stop; do not use the set until explained |
| Media bytes differ | `RESTORE_UPLOADS_MISMATCH` | stop; the set or the target disk is damaged |
| Quiescence broken | `QUIESCE_BROKEN`; set left incomplete | find the writer, run again in a quiet window, delete the incomplete set |

---

## 8. Production rule

- **No production migration, provisioning change or deployment mutation without a recent verified
  backup set** taken with these tools in a quiesced window.
- The restore rehearsal is repeated periodically, and after any change to the tools, the Directus
  version, the PostgreSQL major version or the storage layout. A local rehearsal is not proof that
  production backup storage works.
- **RPO / RTO: V1 operational target — TO BE CONFIRMED.** The measurements below are local measurements,
  not service levels.

---

## 9. Local rehearsal (FINAL-RELEASE-PRODUCTION-READY-02, 2026-09-16)

On the local development data, with no production system involved:

| Step | Result |
|---|---|
| Quiesce | `docker compose stop directus` 2.6 s; client sessions on `litubo_cms` 0 |
| Backup | set `litubo-backup-20260916-154638` in `backups/` (ignored, untracked); tool 7.7 s; `database.dump` 256,030 B (361 TOC entries), `uploads.tar` 7,290,880 B (129 files, 7,189,583 B of content), `manifest.json` 35,632 B, `SHA256SUMS` 158 B |
| Consistency | database fingerprint taken before stopping Directus = the fingerprint at backup time; uploads inventory identical |
| Interoperability | Windows `bsdtar` lists 129 entries and extracts files whose SHA-256 all match the manifest |
| Secret scan | 22 tracked TEST canaries: 0 in `uploads.tar`, `manifest.json`, `SHA256SUMS`, the raw dump and the dump rendered as SQL; no secret-like file name in the archive; archive members = the uploads inventory |
| Restore | into `litubo_restore_test_20260916154605` and a scratch `uploads-restore-test-…` directory; tool 7.6 s; 49 tables, 2,749 rows, 27 sequences, schema identical |
| Independent check | key business counts identical (products, Content item 6, permissions 19, roles / policies / access, files 60, inquiries, activity 1107 / max 1141, revisions 859 / max 891); 60 `directus_files` rows → 0 missing files, 0 size mismatches; 69 unreferenced files = 67 generated transforms + `directus-health-file` + one legacy `phase4-site-content.yaml`; all 129 files byte-identical |
| Disposable Directus 11.17.4 (pinned digest) | pong after about 9 s; health 200; uploads mount = restored directory; sessions only to the restored database; migrations 101 → 101; no database change caused by startup; ten anonymous requests answer with the same status and body as the source |
| Negative | backup with Directus running → `NOT_QUIESCED`; one-byte-corrupted dump and archive → `CHECKSUM_MISMATCH`; missing dump / archive / manifest → `SET_COMPONENT_MISSING`; target `litubo_cms` and a name without TEST → `TARGET_DATABASE_NOT_TEST`; the development uploads directory as target → `TARGET_UPLOADS_NOT_TEST`; an existing target database → `TARGET_DATABASE_EXISTS` — each before creating any database or directory |
| Cleanup and integrity | disposable container, TEST database and TEST directories removed; development database fingerprint (every row of 49 tables) and every upload's SHA-256 and mtime identical before and after |

---

## 10. STOP conditions

Stop and report rather than improvise if:

- a backup would need Directus or any writer to keep running, or a writer cannot be identified;
- the uploads directory cannot be confirmed as the one Directus mounts;
- a set would have to be written where Git could pick it up;
- any checksum does not match on a set believed valid;
- a restore target is not clearly a disposable TEST target, or would touch development or production data;
- a restored database or restored media differ from the manifest without an explanation;
- the pinned Directus fails to start or runs a migration on restored data;
- a production restore, production backup storage or any production interaction becomes necessary
  before its authorization exists.
