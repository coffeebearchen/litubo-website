-- DIRECTUS-ACCESS-BOOTSTRAP-01 — verification for
-- directus-access-01-nuxt-server-site-readonly.sql. Read only: it writes nothing.
--
-- Raises (psql exits non-zero with ON_ERROR_STOP=1) unless every check holds:
--   1. the Directus system tables have the expected 11.17 shape;
--   2. exactly one role `nuxt-server`, with no parent;
--   3. exactly one policy `site-readonly-policy`, with admin_access, app_access and enforce_tfa all
--      false and no ip_access restriction;
--   4. exactly one access row linking that role to that policy, naming no user;
--   5. the role carries that policy and nothing else — no second policy, no inherited capability;
--   6. the policy is reachable from that role alone: not from the public access row (neither role
--      nor user), not from any other role, and not from any user directly;
--   7. exactly one active user holds the role, and that user has no password, so the identity can
--      only ever be used with a static token;
--   8. the Administrator role and policy still exist, the Administrator policy still has admin
--      access, and it is not the policy this artifact owns.
-- Prints `directus_access_verify: OK` when all hold.
--
-- It deliberately does NOT check the static token. Whether a token is installed is the concern of
-- directus-access-02-service-token.sql, which owns that column; this file proves structure only and
-- never reads a credential.
--
-- Run: psql -X -At -v ON_ERROR_STOP=1 … < directus-access-01-nuxt-server-site-readonly.verify.sql

-- verify:begin
DO $verify$
DECLARE
  role_columns   constant text[] := ARRAY['id', 'name', 'icon', 'description', 'parent'];
  policy_columns constant text[] := ARRAY['id', 'name', 'icon', 'description', 'ip_access', 'enforce_tfa', 'admin_access', 'app_access'];
  access_columns constant text[] := ARRAY['id', 'role', 'user', 'policy', 'sort'];
  user_columns   constant text[] := ARRAY['id', 'first_name', 'status', 'role', 'token', 'password', 'provider', 'email'];

  owned_role     constant text := 'nuxt-server';
  owned_policy   constant text := 'site-readonly-policy';

  expected_columns constant integer :=
      array_length(role_columns, 1) + array_length(policy_columns, 1)
    + array_length(access_columns, 1) + array_length(user_columns, 1);

  found_count   integer;
  target_role   uuid;
  target_policy uuid;
  service_user  record;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND ((table_name = 'directus_roles'    AND column_name = ANY (role_columns))
       OR (table_name = 'directus_policies' AND column_name = ANY (policy_columns))
       OR (table_name = 'directus_access'   AND column_name = ANY (access_columns))
       OR (table_name = 'directus_users'    AND column_name = ANY (user_columns)));
  IF found_count <> expected_columns THEN
    RAISE EXCEPTION 'directus_access_verify: unexpected Directus system-table shape (% of % columns)', found_count, expected_columns;
  END IF;

  SELECT count(*) INTO found_count FROM directus_roles WHERE name = owned_role;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_access_verify: expected exactly one role %, found %', owned_role, found_count;
  END IF;
  SELECT id INTO target_role FROM directus_roles WHERE name = owned_role;
  IF EXISTS (SELECT 1 FROM directus_roles WHERE id = target_role AND parent IS NOT NULL) THEN
    RAISE EXCEPTION 'directus_access_verify: role % has a parent role', owned_role;
  END IF;

  SELECT count(*) INTO found_count FROM directus_policies WHERE name = owned_policy;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_access_verify: expected exactly one policy %, found %', owned_policy, found_count;
  END IF;
  SELECT id INTO target_policy FROM directus_policies WHERE name = owned_policy;
  IF EXISTS (
    SELECT 1 FROM directus_policies
     WHERE id = target_policy AND (admin_access OR app_access OR enforce_tfa OR ip_access IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'directus_access_verify: policy % is not least privilege (admin, app, TFA or ip_access is set)', owned_policy;
  END IF;

  SELECT count(*) INTO found_count
    FROM directus_access WHERE role = target_role AND policy = target_policy;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_access_verify: expected exactly one access row % → %, found %', owned_role, owned_policy, found_count;
  END IF;
  IF EXISTS (SELECT 1 FROM directus_access WHERE role = target_role AND policy = target_policy AND "user" IS NOT NULL) THEN
    RAISE EXCEPTION 'directus_access_verify: the % → % access row also names a user', owned_role, owned_policy;
  END IF;
  IF EXISTS (SELECT 1 FROM directus_access WHERE role = target_role AND policy <> target_policy) THEN
    RAISE EXCEPTION 'directus_access_verify: role % carries a policy other than %', owned_role, owned_policy;
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_access a LEFT JOIN directus_roles r ON r.id = a.role
     WHERE a.policy = target_policy AND (a.role IS NULL OR r.name <> owned_role)
  ) THEN
    RAISE EXCEPTION 'directus_access_verify: policy % is reachable from an identity other than the role % (a public access row or another role)', owned_policy, owned_role;
  END IF;

  SELECT count(*) INTO found_count FROM directus_users WHERE role = target_role;
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_access_verify: expected exactly one user holding the role %, found %', owned_role, found_count;
  END IF;
  SELECT * INTO service_user FROM directus_users WHERE role = target_role;
  IF service_user.status <> 'active' THEN
    RAISE EXCEPTION 'directus_access_verify: the % service user has status %, not active', owned_role, service_user.status;
  END IF;
  IF service_user.password IS NOT NULL THEN
    RAISE EXCEPTION 'directus_access_verify: the % service user has a password and could be used for an interactive login', owned_role;
  END IF;
  IF EXISTS (SELECT 1 FROM directus_access WHERE "user" = service_user.id) THEN
    RAISE EXCEPTION 'directus_access_verify: the % service user carries a policy of its own, bypassing the role', owned_role;
  END IF;

  IF (SELECT count(*) FROM directus_roles WHERE name = 'Administrator') <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = 'Administrator' AND admin_access) <> 1 THEN
    RAISE EXCEPTION 'directus_access_verify: the Administrator role or policy is missing or no longer has admin access';
  END IF;
  IF EXISTS (SELECT 1 FROM directus_policies WHERE id = target_policy AND name = 'Administrator') THEN
    RAISE EXCEPTION 'directus_access_verify: % resolved to the Administrator policy', owned_policy;
  END IF;
END
$verify$;
-- verify:end

SELECT 'directus_access_verify: OK';
