#!/usr/bin/env node
/**
 * FINAL-RELEASE-PRODUCTION-READY-02 — restores a LITUBO backup set into a disposable TEST target
 * and proves the result.
 *
 *   node scripts/backup-restore.mjs --backup-set backups/litubo-backup-20260916-150000 \
 *     --postgres-container litubo-cms-postgres-1 \
 *     --target-database litubo_restore_test_20260916 \
 *     --target-uploads-dir /some/scratch/uploads-restore-test-20260916
 *
 * Before anything is created: the target database name and the target uploads directory name must
 * both be marked TEST, the uploads target must be new or empty and must not overlap a live uploads
 * directory, and the set must be complete with every checksum matching. The target database must
 * not exist; this tool creates it and never replaces one. A production restore is not a mode of
 * this tool.
 *
 * Exit codes: 0 restored and verified · 1 refused or failed (the reason is printed) · 2 unexpected error.
 *
 * Full procedure: docs/project/PRODUCTION-BACKUP-RESTORE-RUNBOOK.md
 */

import { parseArgs } from 'node:util'
import { BackupError, formatBytes, restoreBackupSet } from './backup-set.mjs'

const USAGE = `Usage:
  node scripts/backup-restore.mjs --backup-set <dir> --postgres-container <name>
       --target-database <name containing _test_> --target-uploads-dir <new or empty dir named *-test-*>`

async function main() {
  let values
  try {
    ({ values } = parseArgs({
      options: {
        'backup-set': { type: 'string' },
        'postgres-container': { type: 'string' },
        'target-database': { type: 'string' },
        'target-uploads-dir': { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    }))
  }
  catch (error) {
    console.error(`RESTORE REFUSED [ARGUMENT_INVALID]: ${error instanceof Error ? error.message : String(error)}\n${USAGE}`)
    return 1
  }
  const missing = ['backup-set', 'postgres-container', 'target-database', 'target-uploads-dir'].filter(flag => !values[flag])
  if (missing.length > 0) {
    console.error(`RESTORE REFUSED [ARGUMENT_INVALID]: missing ${missing.map(flag => `--${flag}`).join(', ')}. There are no defaults.\n${USAGE}`)
    return 1
  }

  console.log('\nLITUBO restore (TEST target)')
  try {
    const result = await restoreBackupSet({
      backupSet: String(values['backup-set']),
      postgresContainer: String(values['postgres-container']),
      targetDatabase: String(values['target-database']),
      targetUploadsDir: String(values['target-uploads-dir']),
    }, { log: line => console.log(line) })
    console.log(`\nOK — ${result.manifest.setName} restored and verified`)
    console.log(`  database         ${result.targetDatabase}: ${result.tables} tables, ${result.rows} rows`)
    console.log(`  uploads          ${result.targetUploadsDir}: ${result.files} files, ${formatBytes(result.manifest.uploadsTotalBytes)}`)
    console.log(`  Directus         start ${result.manifest.directusVersion} (${result.manifest.directusImageDigest.slice(0, 19)}…) against these targets; never a different version`)
    console.log(`  duration         ${(result.durationMs / 1000).toFixed(1)} s\n`)
    return 0
  }
  catch (error) {
    if (error instanceof BackupError) {
      console.error(`\nRESTORE FAILED [${error.code}]: ${error.message}\n`)
      return 1
    }
    console.error(`\nRESTORE FAILED [UNEXPECTED]: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
}

process.exitCode = await main()
