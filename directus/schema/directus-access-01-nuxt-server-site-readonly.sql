-- DIRECTUS-ACCESS-BOOTSTRAP-01 — the Directus identity a fresh environment needs before any
-- permission artifact can run.
--
-- Why this file exists: FINAL-RELEASE-PRODUCTION-READY-01 rehearsed provisioning on an empty
-- database and the chain stopped at `expected exactly one role nuxt-server, found 0`. A Directus
-- YAML schema snapshot carries collections, fields and relations only, and the tracked permission
-- artifacts (D-034, FINAL-RELEASE-FIX-E) deliberately own nothing but `directus_permissions` rows
-- on a policy that must ALREADY exist. Nothing in Git created that policy, that role, the link
-- between them, or the service user the Nuxt server authenticates as: they had been made by hand
-- once, in one database, and were never reproducible. This artifact owns exactly those objects.
--
-- THIS ARTIFACT OWNS, AND ONLY OWNS:
--   1. role   `nuxt-server`           — no parent, therefore no inherited capability
--   2. policy `site-readonly-policy`  — admin_access=false, app_access=false, enforce_tfa=false
--   3. the single `directus_access` row linking that role to that policy, with no user
--   4. one service user holding that role — the identity `DIRECTUS_TOKEN` belongs to, created
--      WITHOUT a password so it can never be used for an interactive login
--
-- IT NEVER WRITES:
--   · any `directus_permissions` row. Those belong to
--     directus-permissions-01-nuxt-server-content-read.sql (D-034) and
--     directus-permissions-02-nuxt-server-legacy-site.sql (FINAL-RELEASE-FIX-E). This file reads
--     that table only to refuse when something is already inconsistent.
--   · any token, password, TFA secret or other credential. The service user's `token` column is
--     neither read nor written here, and no secret value appears in this file. Installing the
--     static token is a separate, secret-bearing step that owns nothing else:
--     directus/schema/directus-access-02-service-token.sql
--   · the Administrator role or policy, the public policy (the access row with neither role nor
--     user), or any other role, policy, access row or user.
--
-- RESOLUTION IS BY NAME, NEVER BY UUID. No identifier from the current development database
-- appears anywhere in this file; every object is created with `gen_random_uuid()`. That is what
-- makes it apply to an empty database and to an existing one with the same result.
--
-- IDEMPOTENCY: the four tables are locked (SHARE ROW EXCLUSIVE); an owned object is created when
-- absent, its cosmetic columns are normalized in place when they drifted, and it is left untouched
-- when it already matches. A second run changes nothing and creates no duplicate.
--
-- FAIL CLOSED, DELIBERATELY NOT SELF-HEALING: `directus_roles.name` and `directus_policies.name`
-- have no unique constraint, so duplicates are possible and this file checks for them itself.
-- Security-relevant drift is never silently repaired — an existing policy that has gained admin or
-- app access, a role that has gained a parent or a second policy, a service user that has gained a
-- password or a policy of its own, all raise. Revoking elevated access silently could break
-- another consumer, and granting it is not this artifact's decision; a person must look.
-- Cosmetic drift (icon, description) is normalized.
--
-- APPLY ORDER (RELEASE-SAFETY-GATES §3A.8, executable form in scripts/provisioning-manifest.json):
--   schema baseline → constraints → revision guard → lifecycle guard → schema-object verify →
--   THIS FILE → directus-access-02-service-token.sql → .verify.sql →
--   directus-permissions-01-…sql → its .verify.sql → directus-permissions-02-…sql → its .verify.sql
--
-- RELOAD: Directus 11 caches schema, policies and permissions in process memory and does not
-- observe direct SQL. Restart the Directus service after apply or rollback
-- (local: `docker compose restart directus`). No cache is flushed and no data volume is touched.
--
-- Verify:   directus/schema/directus-access-01-nuxt-server-site-readonly.verify.sql
-- Rollback: directus/schema/directus-access-01-nuxt-server-site-readonly.rollback.sql
--           (refuses while any permission row still exists on the policy — see that file).

BEGIN;

LOCK TABLE directus_roles, directus_policies, directus_access, directus_users IN SHARE ROW EXCLUSIVE MODE;

-- apply:begin
DO $apply$
DECLARE
  role_columns   constant text[] := ARRAY['id', 'name', 'icon', 'description', 'parent'];
  policy_columns constant text[] := ARRAY['id', 'name', 'icon', 'description', 'ip_access', 'enforce_tfa', 'admin_access', 'app_access'];
  access_columns constant text[] := ARRAY['id', 'role', 'user', 'policy', 'sort'];
  user_columns   constant text[] := ARRAY['id', 'first_name', 'status', 'role', 'token', 'password', 'provider', 'email'];

  owned_role     constant text := 'nuxt-server';
  owned_policy   constant text := 'site-readonly-policy';
  role_icon      constant text := 'supervised_user_circle';
  role_desc      constant text := 'Nuxt frontend read-only access — published content and public files only';
  policy_icon    constant text := 'badge';
  policy_desc    constant text := 'Read-only access for Nuxt frontend';

  expected_columns constant integer :=
      array_length(role_columns, 1) + array_length(policy_columns, 1)
    + array_length(access_columns, 1) + array_length(user_columns, 1);

  found_count    integer;
  target_role    uuid;
  target_policy  uuid;
  service_user   uuid;
  existing_policy record;
  existing_user  record;
  created        text[] := '{}';
  normalized     text[] := '{}';
BEGIN
  -- 0. A different Directus system-table shape must not be guessed at.
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND ((table_name = 'directus_roles'    AND column_name = ANY (role_columns))
       OR (table_name = 'directus_policies' AND column_name = ANY (policy_columns))
       OR (table_name = 'directus_access'   AND column_name = ANY (access_columns))
       OR (table_name = 'directus_users'    AND column_name = ANY (user_columns)));
  IF found_count <> expected_columns THEN
    RAISE EXCEPTION 'directus_access_bootstrap: the Directus system tables do not have the expected 11.17 shape (% of % columns)', found_count, expected_columns;
  END IF;

  -- 1. Neither name is unique in the database, so ambiguity is checked before anything is written.
  SELECT count(*) INTO found_count FROM directus_roles WHERE name = owned_role;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'directus_access_bootstrap: % roles are named %; the identity is ambiguous and nothing was written', found_count, owned_role;
  END IF;
  SELECT count(*) INTO found_count FROM directus_policies WHERE name = owned_policy;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'directus_access_bootstrap: % policies are named %; the identity is ambiguous and nothing was written', found_count, owned_policy;
  END IF;

  -- 2. Role.
  SELECT id INTO target_role FROM directus_roles WHERE name = owned_role;
  IF target_role IS NULL THEN
    INSERT INTO directus_roles (id, name, icon, description, parent)
    VALUES (gen_random_uuid(), owned_role, role_icon, role_desc, NULL)
    RETURNING id INTO target_role;
    created := created || 'role'::text;
  ELSE
    IF EXISTS (SELECT 1 FROM directus_roles WHERE id = target_role AND parent IS NOT NULL) THEN
      RAISE EXCEPTION 'directus_access_bootstrap: role % has a parent role and would inherit capability this artifact does not own; refusing to continue', owned_role;
    END IF;
    UPDATE directus_roles SET icon = role_icon, description = role_desc
     WHERE id = target_role AND (icon IS DISTINCT FROM role_icon OR description IS DISTINCT FROM role_desc);
    IF FOUND THEN normalized := normalized || 'role'::text; END IF;
  END IF;

  -- 3. Policy. Least privilege is a precondition here, never something this file grants or revokes.
  SELECT * INTO existing_policy FROM directus_policies WHERE name = owned_policy;
  IF existing_policy.id IS NULL THEN
    INSERT INTO directus_policies (id, name, icon, description, ip_access, enforce_tfa, admin_access, app_access)
    VALUES (gen_random_uuid(), owned_policy, policy_icon, policy_desc, NULL, false, false, false)
    RETURNING id INTO target_policy;
    created := created || 'policy'::text;
  ELSE
    target_policy := existing_policy.id;
    IF existing_policy.admin_access OR existing_policy.app_access THEN
      RAISE EXCEPTION 'directus_access_bootstrap: policy % already has admin or app access; refusing to continue (revoking it silently could break another consumer, and granting it is not this artifact''s decision)', owned_policy;
    END IF;
    IF existing_policy.enforce_tfa THEN
      RAISE EXCEPTION 'directus_access_bootstrap: policy % enforces TFA, which a token-only service identity can never satisfy; refusing to continue', owned_policy;
    END IF;
    IF existing_policy.ip_access IS NOT NULL THEN
      RAISE EXCEPTION 'directus_access_bootstrap: policy % restricts ip_access; refusing to overwrite a deliberate network restriction', owned_policy;
    END IF;
    UPDATE directus_policies SET icon = policy_icon, description = policy_desc
     WHERE id = target_policy AND (icon IS DISTINCT FROM policy_icon OR description IS DISTINCT FROM policy_desc);
    IF FOUND THEN normalized := normalized || 'policy'::text; END IF;
  END IF;

  -- 4. Access link: exactly one, role-scoped, and the role carries no other policy.
  SELECT count(*) INTO found_count FROM directus_access WHERE role = target_role AND policy = target_policy;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'directus_access_bootstrap: % access rows already link % to %; the link is ambiguous and nothing else was written', found_count, owned_role, owned_policy;
  END IF;
  IF EXISTS (SELECT 1 FROM directus_access WHERE role = target_role AND policy <> target_policy) THEN
    RAISE EXCEPTION 'directus_access_bootstrap: role % carries a policy other than %; refusing to continue', owned_role, owned_policy;
  END IF;

  IF found_count = 0 THEN
    INSERT INTO directus_access (id, role, "user", policy, sort)
    VALUES (gen_random_uuid(), target_role, NULL, target_policy, NULL);
    created := created || 'access'::text;
  ELSIF EXISTS (SELECT 1 FROM directus_access WHERE role = target_role AND policy = target_policy AND "user" IS NOT NULL) THEN
    RAISE EXCEPTION 'directus_access_bootstrap: the % → % access row also names a user; refusing to continue', owned_role, owned_policy;
  END IF;

  -- 5. Service user. Created with no password: this identity authenticates by static token only,
  --    and the token itself is installed by directus-access-02-service-token.sql, never here.
  SELECT count(*) INTO found_count FROM directus_users WHERE role = target_role;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'directus_access_bootstrap: % users hold the role %; the service identity is ambiguous', found_count, owned_role;
  END IF;

  IF found_count = 0 THEN
    -- Only the columns this artifact owns are named. status, provider, text_direction and
    -- email_notifications take their database defaults; email and password stay NULL.
    INSERT INTO directus_users (id, first_name, role)
    VALUES (gen_random_uuid(), owned_role, target_role)
    RETURNING id INTO service_user;
    created := created || 'service user'::text;
  ELSE
    SELECT * INTO existing_user FROM directus_users WHERE role = target_role;
    service_user := existing_user.id;
    IF existing_user.password IS NOT NULL THEN
      RAISE EXCEPTION 'directus_access_bootstrap: the % service user has a password and could be used for an interactive login; refusing to continue', owned_role;
    END IF;
    IF existing_user.status <> 'active' THEN
      RAISE EXCEPTION 'directus_access_bootstrap: the % service user has status %, not active; refusing to continue', owned_role, existing_user.status;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM directus_access WHERE "user" = service_user) THEN
    RAISE EXCEPTION 'directus_access_bootstrap: the % service user carries a policy of its own, bypassing the role; refusing to continue', owned_role;
  END IF;

  -- 6. Post-conditions that keep this policy off every other identity. The public access row is the
  --    one with neither role nor user; this policy must never be reachable through it.
  IF EXISTS (
    SELECT 1 FROM directus_access a LEFT JOIN directus_roles r ON r.id = a.role
     WHERE a.policy = target_policy AND (a.role IS NULL OR r.name <> owned_role)
  ) THEN
    RAISE EXCEPTION 'directus_access_bootstrap: policy % is reachable from an identity other than the role %; refusing to continue', owned_policy, owned_role;
  END IF;

  RAISE NOTICE 'directus_access_bootstrap: created [%], normalized [%]',
    array_to_string(created, ', '), array_to_string(normalized, ', ');
END
$apply$;
-- apply:end

COMMIT;
