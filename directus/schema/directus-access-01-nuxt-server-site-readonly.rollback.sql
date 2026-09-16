-- DIRECTUS-ACCESS-BOOTSTRAP-01 — rollback for
-- directus-access-01-nuxt-server-site-readonly.sql. Local development unless a release plan
-- explicitly calls for it.
--
-- READ THIS BEFORE RUNNING IT. `directus_permissions.policy` and `directus_access.policy` are both
-- `ON DELETE CASCADE` foreign keys to `directus_policies`. Deleting the policy would therefore
-- silently delete every permission row on it — including the three rows owned by
-- directus-permissions-01-nuxt-server-content-read.sql (D-034) and the sixteen owned by
-- directus-permissions-02-nuxt-server-legacy-site.sql (FINAL-RELEASE-FIX-E) — with no error and no
-- trace, destroying two other artifacts' state from inside this one.
--
-- So this rollback REFUSES while any permission row still exists on the policy. Tear the stack down
-- in the reverse of the apply order:
--   directus-permissions-02-…rollback.sql → directus-permissions-01-…rollback.sql → this file.
-- Each of those refuses to delete a row that drifted, so nothing unowned is removed on the way.
--
-- It deletes only what the apply artifact created, and only when it still matches: the access row
-- linking `nuxt-server` to `site-readonly-policy`, the single service user holding that role, the
-- policy and the role. It refuses when the role holds more than one user, when the service user has
-- a password, or when the policy is reachable from any other identity. Deleting the service user
-- also removes its static token — that is the point of a teardown, and it is why this file is not
-- part of any provisioning path.
--
-- It never touches the Administrator role or policy, the public policy, any other role, policy,
-- user or access row, or any `directus_permissions` row (it only counts them, to refuse).
--
-- Restart Directus afterwards: policies and permissions are cached in process memory.

BEGIN;

LOCK TABLE directus_roles, directus_policies, directus_access, directus_users IN SHARE ROW EXCLUSIVE MODE;

-- rollback:begin
DO $rollback$
DECLARE
  owned_role   constant text := 'nuxt-server';
  owned_policy constant text := 'site-readonly-policy';

  found_count   integer;
  target_role   uuid;
  target_policy uuid;
  service_user  record;
  removed       text[] := '{}';
BEGIN
  IF (SELECT count(*) FROM directus_roles WHERE name = owned_role) <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = owned_policy) <> 1 THEN
    RAISE EXCEPTION 'directus_access_rollback: % or % is not uniquely resolvable; nothing was deleted', owned_role, owned_policy;
  END IF;
  SELECT id INTO target_role FROM directus_roles WHERE name = owned_role;
  SELECT id INTO target_policy FROM directus_policies WHERE name = owned_policy;

  -- The guard this whole file exists for.
  SELECT count(*) INTO found_count FROM directus_permissions WHERE policy = target_policy;
  IF found_count > 0 THEN
    RAISE EXCEPTION 'directus_access_rollback: % permission row(s) still exist on %; deleting the policy would cascade and silently destroy rows owned by directus-permissions-01 and -02. Roll those artifacts back first, then run this file', found_count, owned_policy;
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_access a LEFT JOIN directus_roles r ON r.id = a.role
     WHERE a.policy = target_policy AND (a.role IS NULL OR r.name <> owned_role)
  ) THEN
    RAISE EXCEPTION 'directus_access_rollback: policy % is reachable from an identity other than the role %; not deleted', owned_policy, owned_role;
  END IF;

  SELECT count(*) INTO found_count FROM directus_users WHERE role = target_role;
  IF found_count > 1 THEN
    RAISE EXCEPTION 'directus_access_rollback: % users hold the role %; not deleted', found_count, owned_role;
  END IF;

  IF found_count = 1 THEN
    SELECT * INTO service_user FROM directus_users WHERE role = target_role;
    IF service_user.password IS NOT NULL THEN
      RAISE EXCEPTION 'directus_access_rollback: the % service user has a password, so it is not the credential-free identity this artifact created; not deleted', owned_role;
    END IF;
  END IF;

  DELETE FROM directus_access WHERE role = target_role AND policy = target_policy;
  IF FOUND THEN removed := removed || 'access'::text; END IF;

  IF found_count = 1 THEN
    DELETE FROM directus_users WHERE id = service_user.id;
    removed := removed || 'service user'::text;
  END IF;

  DELETE FROM directus_policies WHERE id = target_policy;
  IF FOUND THEN removed := removed || 'policy'::text; END IF;

  DELETE FROM directus_roles WHERE id = target_role;
  IF FOUND THEN removed := removed || 'role'::text; END IF;

  RAISE NOTICE 'directus_access_rollback: deleted [%]', array_to_string(removed, ', ');
END
$rollback$;
-- rollback:end

COMMIT;
