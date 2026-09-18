/**
 * PRODUCTION-BOOTSTRAP-SAFETY-01 — the safety gate every provisioning run passes first.
 *
 * `scripts/provision-directus.mjs` changes a database. Before it reads the manifest, reads a secret or
 * makes its first docker, psql or Directus call, it asks this module whether the run may start at all.
 * The decision (`decideProvisioningSafety`) is pure: it looks at the command line it is given and, only
 * when the answer depends on which host this is, calls the one marker reader it is handed. The
 * filesystem check itself is `readProductionMarker`, kept apart so the decision can be tested without
 * touching /etc.
 *
 * The contract:
 *   - `--environment` is required and is exactly `local`, `scratch` or `production`; there is no default.
 *   - `production` also needs `--database litubo_cms`, `--allow-production`, a
 *     `--confirm-production-database` that repeats the database exactly, and the host marker
 *     /etc/litubo/PRODUCTION containing exactly LITUBO_PRODUCTION_V1. The marker is the production host's
 *     identity, not a secret. This repository never creates it.
 *   - On a host whose marker exists — or cannot be checked — `local` and `scratch` are refused, so the
 *     production host cannot be provisioned by calling it something else.
 *   - A local or scratch database whose name contains `prod`, `production` or `live` is refused. That is
 *     a guard against a mistyped target, not production detection: the production database `litubo_cms`
 *     contains none of them, which is why production is recognised by the marker instead.
 */

import { readFileSync } from 'node:fs'

export const ENVIRONMENTS = Object.freeze(['local', 'scratch', 'production'])
export const PRODUCTION_DATABASE = 'litubo_cms'
export const PRODUCTION_MARKER_PATH = '/etc/litubo/PRODUCTION'
export const PRODUCTION_MARKER_CONTENT = 'LITUBO_PRODUCTION_V1'

/** Name fragments a local or scratch target may not contain — a typo guard, not production detection. */
export const PRODUCTION_LIKE_NAME_FRAGMENTS = Object.freeze(['prod', 'production', 'live'])

/** Options that take a value; each may be given once, so a command line never has two readings. */
const VALUE_OPTIONS = ['environment', 'database', 'confirm-production-database']

/**
 * @typedef {{
 *   environment: string | null,
 *   database: string | null,
 *   allowProduction: boolean,
 *   confirmProductionDatabase: string | null,
 *   repeated: string[],
 * }} ProvisioningRequest
 * @typedef {{ state: 'absent' } | { state: 'present', content: string } | { state: 'unreadable', code: string }} MarkerState
 * @typedef {{ ok: true, environment: string, database: string } | { ok: false, code: string, reason: string }} SafetyVerdict
 */

/**
 * `--name value` or `--name=value`. A following token that starts with `--` is not a value.
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | null}
 */
function readOption(argv, name) {
  const i = argv.indexOf(`--${name}`)
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  const inline = argv.find(a => a.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : null
}

/**
 * Reads the part of a provisioning command line the safety gate decides on.
 * @param {string[]} argv the arguments after the script path
 * @returns {ProvisioningRequest}
 */
export function parseProvisioningRequest(argv) {
  return {
    environment: readOption(argv, 'environment'),
    database: readOption(argv, 'database'),
    allowProduction: argv.includes('--allow-production'),
    confirmProductionDatabase: readOption(argv, 'confirm-production-database'),
    repeated: VALUE_OPTIONS.filter(name => argv.filter(a => a === `--${name}` || a.startsWith(`--${name}=`)).length > 1),
  }
}

/**
 * Reads the production host marker. Only "no such file" means absent: a marker that exists but cannot be
 * read — a permission, a directory in its place, anything else — is unreadable, and the decision treats
 * that as "cannot rule out production".
 * @param {string} [path]
 * @param {(path: string, encoding: 'utf8') => string} [readFile]
 * @returns {MarkerState}
 */
export function readProductionMarker(path = PRODUCTION_MARKER_PATH, readFile = readFileSync) {
  try {
    return { state: 'present', content: readFile(path, 'utf8') }
  }
  catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN'
    return code === 'ENOENT' ? { state: 'absent' } : { state: 'unreadable', code }
  }
}

/**
 * Decides whether a provisioning run may start. Touches nothing itself; `readMarker` is called at most
 * once, and only after every check that can be made from the command line alone has passed.
 * @param {ProvisioningRequest} request
 * @param {() => MarkerState} readMarker
 * @returns {SafetyVerdict}
 */
export function decideProvisioningSafety(request, readMarker) {
  const { environment, database, allowProduction, confirmProductionDatabase, repeated } = request
  /** @returns {SafetyVerdict} */
  const refuse = (code, reason) => ({ ok: false, code, reason })

  if (repeated.length > 0) {
    return refuse('OPTION_REPEATED', `--${repeated[0]} is given more than once. Refusing an ambiguous command line.`)
  }
  if (!environment) {
    return refuse('ENVIRONMENT_MISSING', 'no environment. Pass --environment local, scratch or production. There is no default: a provisioning run must say which kind of environment it is about to change.')
  }
  if (!ENVIRONMENTS.includes(environment)) {
    return refuse('ENVIRONMENT_UNKNOWN', `environment ${JSON.stringify(environment)} is not one of local, scratch or production.`)
  }
  if (!database) {
    return refuse('DATABASE_MISSING', 'no target. Pass --database <name>. There is no default: a provisioning run must name the database it is about to change.')
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
    return refuse('DATABASE_NOT_IDENTIFIER', `database name ${JSON.stringify(database)} is not a plain PostgreSQL identifier. Refusing to interpolate it.`)
  }

  if (environment === 'production') {
    if (!allowProduction) {
      return refuse('PRODUCTION_NOT_ALLOWED', '--environment production also needs --allow-production. Production provisioning is a separate, authorized activity, and this flag is its explicit opt-in.')
    }
    if (!confirmProductionDatabase) {
      return refuse('PRODUCTION_CONFIRMATION_MISSING', '--environment production also needs --confirm-production-database <database>, repeating the target database exactly.')
    }
    if (confirmProductionDatabase !== database) {
      return refuse('PRODUCTION_CONFIRMATION_MISMATCH', `--confirm-production-database ${JSON.stringify(confirmProductionDatabase)} does not repeat --database ${JSON.stringify(database)} exactly.`)
    }
    if (database !== PRODUCTION_DATABASE) {
      return refuse('PRODUCTION_DATABASE_NOT_ALLOWED', `the production database is ${PRODUCTION_DATABASE}; ${JSON.stringify(database)} is not a production target.`)
    }
    const marker = readMarker()
    if (marker.state === 'absent') {
      return refuse('PRODUCTION_MARKER_MISSING', `this host has no production marker (${PRODUCTION_MARKER_PATH}). --environment production runs only on the LITUBO production host, and that marker is what identifies it.`)
    }
    if (marker.state !== 'present') {
      return refuse('PRODUCTION_MARKER_UNREADABLE', `the production marker ${PRODUCTION_MARKER_PATH} could not be read (${marker.code}), so this host cannot be confirmed as the production host.`)
    }
    if (marker.content !== PRODUCTION_MARKER_CONTENT) {
      return refuse('PRODUCTION_MARKER_MISMATCH', `the production marker ${PRODUCTION_MARKER_PATH} does not contain exactly ${PRODUCTION_MARKER_CONTENT}.`)
    }
    return { ok: true, environment, database }
  }

  if (allowProduction || confirmProductionDatabase !== null) {
    return refuse('PRODUCTION_OPTIONS_OUTSIDE_PRODUCTION', `--allow-production and --confirm-production-database belong to --environment production; with --environment ${environment} they are contradictory.`)
  }
  const lowered = database.toLowerCase()
  const fragment = PRODUCTION_LIKE_NAME_FRAGMENTS.find(f => lowered.includes(f))
  if (fragment) {
    return refuse('PRODUCTION_LIKE_NAME', `database name "${database}" contains "${fragment}". A local or scratch target must not look like a production database. This name check only catches a mistyped target; production is recognised by --environment production and the host marker, never by a name.`)
  }
  const marker = readMarker()
  if (marker.state === 'present') {
    return refuse('PRODUCTION_HOST', `this host carries the LITUBO production marker (${PRODUCTION_MARKER_PATH}). --environment ${environment} is refused here: on the production host only --environment production, with its confirmations, may provision.`)
  }
  if (marker.state !== 'absent') {
    return refuse('PRODUCTION_HOST_UNCERTAIN', `the production marker path ${PRODUCTION_MARKER_PATH} could not be checked (${marker.code}), so this host cannot be shown not to be the production host. --environment ${environment} is refused.`)
  }
  return { ok: true, environment, database }
}
