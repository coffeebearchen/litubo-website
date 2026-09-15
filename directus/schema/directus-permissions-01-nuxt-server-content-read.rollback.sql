-- DIRECTUS-PERMISSIONS-PROVISIONING-01 — rollback for
-- directus-permissions-01-nuxt-server-content-read.sql. Local development unless a release plan
-- explicitly calls for it.
--
-- Deletes only the rows the apply artifact owns — the `read` permission for content_items,
-- content_item_locales and media_file_lifecycle on the policy site-readonly-policy linked to the
-- role nuxt-server — and only when a row still matches the artifact exactly. A row that drifted is
-- not deleted: the rollback raises so a person can look at it. It never deletes the policy, the
-- role, the access link, any other permission row (the legacy site-readonly permissions stay), any
-- user or any token. Restart Directus afterwards (permissions are cached in process memory).

BEGIN;

LOCK TABLE directus_permissions IN SHARE ROW EXCLUSIVE MODE;

-- rollback:begin
DO $rollback$
DECLARE
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
  deleted integer := 0;
BEGIN
  SELECT count(*) INTO found_count
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1
     OR (SELECT count(*) FROM directus_roles WHERE name = 'nuxt-server') <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = 'site-readonly-policy') <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_rollback: nuxt-server → site-readonly-policy is not uniquely resolvable';
  END IF;
  SELECT p.id INTO target_policy
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';

  FOR spec IN
    SELECT * FROM (VALUES
      ('content_items',
       'id,content_type,status,archived_at',
       '{"_and":[{"status":{"_eq":"published"}},{"archived_at":{"_null":true}},{"content_type":{"_in":["technical_article","case_study"]}}]}'::jsonb),
      ('content_item_locales',
       'content_items_id,locale,slug,published_snapshot,published_at',
       '{"_and":[{"published_snapshot":{"_nnull":true}},{"locale":{"_eq":"en"}},{"content_items_id":{"status":{"_eq":"published"}}},{"content_items_id":{"archived_at":{"_null":true}}},{"content_items_id":{"content_type":{"_in":["technical_article","case_study"]}}}]}'::jsonb),
      ('media_file_lifecycle',
       'file_id,archived',
       '{"archived":{"_eq":true}}'::jsonb)
    ) AS owned(collection, fields, permissions)
  LOOP
    FOR existing IN SELECT * FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection LOOP
      IF existing.action <> 'read'
         OR existing.fields IS DISTINCT FROM spec.fields
         OR existing.permissions::jsonb IS DISTINCT FROM spec.permissions
         OR existing.validation IS NOT NULL
         OR existing.presets IS NOT NULL THEN
        RAISE EXCEPTION 'directus_permissions_rollback: permission % for % does not match the artifact; not deleted', existing.id, spec.collection;
      END IF;
      DELETE FROM directus_permissions WHERE id = existing.id;
      deleted := deleted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'directus_permissions_rollback: deleted %', deleted;
END
$rollback$;
-- rollback:end

COMMIT;
