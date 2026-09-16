-- DIRECTUS-ACCESS-BOOTSTRAP-02 — installs the Nuxt service static token from the environment.
--
-- THIS FILE CONTAINS NO CREDENTIAL, AND NEVER WILL. It names one environment variable and reads
-- its value at run time; the value is not echoed, not returned in any result, and not included in
-- any error message. Nothing here may ever be replaced by a literal token: that would commit a
-- secret to Git.
--
-- WHY IT IS A SEPARATE FILE. directus-access-01-nuxt-server-site-readonly.sql builds the identity
-- structure — role, policy, access link, service user — and is safe to read, review and diff
-- because it touches no secret. This file owns exactly one column of one row:
-- `directus_users.token` of the single user holding the role `nuxt-server`. Splitting them is what
-- lets the structure live in Git while the secret stays in the deployment environment.
--
-- WHAT THE TOKEN IS. `.env.example` documents `DIRECTUS_TOKEN` as the site-readonly token, and
-- `server/utils/directus.ts` sends it as `Authorization: Bearer …` on every public CMS read. In
-- Directus 11 a static token is stored in plain text in `directus_users.token` and is matched
-- directly, so there is no hash to provision and no way to derive it — it must be supplied.
--
-- ENVIRONMENT VARIABLE (name only): DIRECTUS_SERVICE_TOKEN
--   It is read from the environment of the psql process, which scripts/provision-directus.mjs
--   populates by passing the value on stdin so it never appears in a command line, a process
--   listing or a log. The same value is what the application then receives as DIRECTUS_TOKEN.
--   The two names differ on purpose: one provisions, the other is consumed at run time, and a
--   deployment may well source them from the same secret in its own secret manager.
--
-- FAIL CLOSED. An absent, empty or shorter-than-32-character value raises and writes nothing; the
-- environment is then not provisioned, rather than provisioned with a weak or missing credential.
-- The check never reports the value, only its unsuitability.
--
-- IDEMPOTENT. Re-running with the same value writes nothing. Re-running with a different value
-- rotates the token in place. A value already held by a different user raises rather than colliding
-- with `directus_users_token_unique`.
--
-- SCOPE. It never creates or deletes any row, never touches a password, never touches the
-- Administrator user, and never touches a user outside the `nuxt-server` role. It requires the
-- structure from artifact 01 to exist already and refuses otherwise.
--
-- Restart Directus afterwards; static tokens are read per request, but policies are cached.

\getenv service_token DIRECTUS_SERVICE_TOKEN
\if :{?service_token}
\else
\set service_token ''
\endif

BEGIN;

LOCK TABLE directus_users IN SHARE ROW EXCLUSIVE MODE;

-- token:begin
-- psql substitutes a variable only OUTSIDE quoted text, so the value cannot be written directly
-- into the dollar-quoted block below. It is handed over through a transaction-local setting
-- instead: `is_local = true` discards it when this transaction ends, so it never outlives the
-- statement that needed it, and the SELECT reports only whether a value arrived — never the value.
SELECT set_config('provisioning.service_token', :'service_token', true) IS NOT NULL AS service_token_loaded;

DO $token$
DECLARE
  -- Read once from the transaction-local setting and never interpolated into a message, so no
  -- RAISE in this block can disclose it.
  supplied     constant text := current_setting('provisioning.service_token', true);
  minimum      constant integer := 32;
  owned_role   constant text := 'nuxt-server';

  target_role  uuid;
  found_count  integer;
  service_user record;
BEGIN
  IF supplied IS NULL OR length(supplied) < minimum THEN
    RAISE EXCEPTION 'directus_service_token: DIRECTUS_SERVICE_TOKEN is absent, empty or shorter than % characters; refusing to install a missing or weak static token (the value is not shown)', minimum;
  END IF;

  SELECT count(*) INTO found_count FROM directus_roles WHERE name = owned_role;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_service_token: expected exactly one role %, found % — apply directus-access-01-nuxt-server-site-readonly.sql first', owned_role, found_count;
  END IF;
  SELECT id INTO target_role FROM directus_roles WHERE name = owned_role;

  SELECT count(*) INTO found_count FROM directus_users WHERE role = target_role;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_service_token: expected exactly one user holding the role %, found %', owned_role, found_count;
  END IF;
  SELECT * INTO service_user FROM directus_users WHERE role = target_role;

  IF service_user.status <> 'active' THEN
    RAISE EXCEPTION 'directus_service_token: the % service user has status %, not active; refusing to install a token on it', owned_role, service_user.status;
  END IF;
  IF service_user.password IS NOT NULL THEN
    RAISE EXCEPTION 'directus_service_token: the % service user has a password; refusing (this identity must be token-only)', owned_role;
  END IF;

  IF EXISTS (SELECT 1 FROM directus_users WHERE token = supplied AND id <> service_user.id) THEN
    RAISE EXCEPTION 'directus_service_token: the supplied token is already held by a different user; refusing (the value is not shown)';
  END IF;

  UPDATE directus_users SET token = supplied
   WHERE id = service_user.id AND token IS DISTINCT FROM supplied;

  IF FOUND THEN
    RAISE NOTICE 'directus_service_token: installed on the % service user (value not shown)', owned_role;
  ELSE
    RAISE NOTICE 'directus_service_token: already current on the % service user (value not shown)', owned_role;
  END IF;

  IF (SELECT token IS NULL FROM directus_users WHERE id = service_user.id) THEN
    RAISE EXCEPTION 'directus_service_token: the token is still absent after the update';
  END IF;
END
$token$;
-- token:end

COMMIT;

SELECT 'directus_service_token: OK';
