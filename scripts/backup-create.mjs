#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-02 — creates one LITUBO backup set (database + uploads).
 *
 *   docker compose stop directus
 *   node scripts/backup-create.mjs --postgres-container litubo-cms-postgres-1 --database litubo_cms \
 *     --directus-container litubo-cms-directus-1 --uploads-dir dev-data/uploads --output-dir backups
 *   docker compose start directus
 *
 * Every target is explicit and there are no defaults. The tool refuses to start unless Directus is
 * stopped, no running container mounts the uploads, and no client session is connected to the
 * database; it refuses an output directory Git could pick up. It does not stop or start anything
 * itself: the maintenance window is the operator's decision, and the tool only proves it held.
 *
 * Exit codes: 0 the set is complete and verified · 1 refused or failed (the reason is printed; a
 * partial set keeps its `.incomplete` suffix and has no manifest) · 2 unexpected error.
 *
 * Full procedure: docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md
 */

import { parseArgs } from 'node:util'
import { BackupError, createBackupSet, formatBytes } from './backup-set.mjs'

const USAGE = `Usage:
  node scripts/backup-create.mjs --postgres-container <name> --database <name>
       --directus-container <name> --uploads-dir <path> --output-dir <path>`

async function main() {
  let values
  try {
    ({ values } = parseArgs({
      options: {
        'postgres-container': { type: 'string' },
        'database': { type: 'string' },
        'directus-container': { type: 'string' },
        'uploads-dir': { type: 'string' },
        'output-dir': { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }))
  }
  catch (error) {
    console.error(`BACKUP REFUSED [ARGUMENT_INVALID]: ${error instanceof Error ? error.message : String(error)}\n${USAGE}`)
    return 1
  }
  const missing = ['postgres-container', 'database', 'directus-container', 'uploads-dir', 'output-dir'].filter(flag => !values[flag])
  if (missing.length > 0) {
    console.error(`BACKUP REFUSED [ARGUMENT_INVALID]: missing ${missing.map(flag => `--${flag}`).join(', ')}. There are no defaults.\n${USAGE}`)
    return 1
  }

  console.log('\nLITUBO backup set')
  try {
    const result = await createBackupSet({
      postgresContainer: String(values['postgres-container']),
      database: String(values.database),
      directusContainer: String(values['directus-container']),
      uploadsDir: String(values['uploads-dir']),
      outputDir: String(values['output-dir']),
    }, { log: line => console.log(line) })
    const { manifest } = result
    console.log(`\nOK — ${result.setDir}`)
    console.log(`  database         ${manifest.databaseName}: ${manifest.databaseFingerprint.tables.length} tables, ${formatBytes(manifest.databaseBytes)} dump`)
    console.log(`  uploads          ${manifest.uploadsFileCount} files, ${formatBytes(manifest.uploadsTotalBytes)}`)
    console.log(`  Directus         ${manifest.directusVersion} (${manifest.directusImageDigest.slice(0, 19)}…) · PostgreSQL ${manifest.postgresVersion}`)
    console.log(`  duration         ${(result.durationMs / 1000).toFixed(1)} s`)
    console.log('\nStart Directus again (docker compose start directus). Keep this set out of Git; it holds business data and credentials-bearing database rows.\n')
    return 0
  }
  catch (error) {
    if (error instanceof BackupError) {
      console.error(`\nBACKUP FAILED [${error.code}]: ${error.message}\n`)
      return 1
    }
    console.error(`\nBACKUP FAILED [UNEXPECTED]: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
}

process.exitCode = await main()
