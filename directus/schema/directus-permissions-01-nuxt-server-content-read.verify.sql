-- DIRECTUS-PERMISSIONS-PROVISIONING-01 — verification for
-- directus-permissions-01-nuxt-server-content-read.sql. Read only: it writes nothing.
--
-- Raises (psql exits non-zero with ON_ERROR_STOP=1) unless every check holds:
--   1. directus_permissions has the expected Directus 11 columns;
--   2. exactly one role nuxt-server, one policy site-readonly-policy, one access link between them,
--      and that policy has neither admin nor app access;
--   3. exactly one permission row per owned collection on that policy, action read only, with the
--      exact fields and row filter of the apply artifact, validation and presets NULL;
--   4. no permission on content_items_files, content_relations, directus_revisions or
--      directus_activity for that policy;
--   5. no public policy (an access row with neither role nor user) has any permission on a Content
--      collection, media_file_lifecycle, directus_revisions or directus_activity;
--   6. no duplicate (policy, collection, action) row on that policy.
-- Prints `directus_permissions_verify: OK` when all hold.
--
-- Run: psql -X -At -v ON_ERROR_STOP=1 … < directus-permissions-01-nuxt-server-content-read.verify.sql

-- verify:begin
DO $verify$
DECLARE
  required_columns constant text[] := ARRAY['id', 'collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'policy'];
  forbidden_collections constant text[] := ARRAY['content_items_files', 'content_relations', 'directus_revisions', 'directus_activity'];
  public_denied_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'content_items_files', 'content_relations', 'media_file_lifecycle', 'directus_revisions', 'directus_activity'];
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'directus_permissions' AND column_name = ANY (required_columns);
  IF found_count <> array_length(required_columns, 1) THEN
    RAISE EXCEPTION 'directus_permissions_verify: unexpected directus_permissions columns (% of %)', found_count, array_length(required_columns, 1);
  END IF;

  IF (SELECT count(*) FROM directus_roles WHERE name = 'nuxt-server') <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = 'site-readonly-policy') <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_verify: role nuxt-server or policy site-readonly-policy is not unique';
  END IF;
  SELECT count(*) INTO found_count
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_verify: expected one access link nuxt-server → site-readonly-policy, found %', found_count;
  END IF;
  SELECT p.id INTO target_policy
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF EXISTS (SELECT 1 FROM directus_policies WHERE id = target_policy AND (admin_access OR app_access)) THEN
    RAISE EXCEPTION 'directus_permissions_verify: site-readonly-policy has admin or app access';
  END IF;

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
    SELECT count(*) INTO found_count FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection;
    IF found_count <> 1 THEN
      RAISE EXCEPTION 'directus_permissions_verify: expected exactly one permission for % on site-readonly-policy, found %', spec.collection, found_count;
    END IF;
    SELECT * INTO existing FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection;
    IF existing.action <> 'read'
       OR existing.fields IS DISTINCT FROM spec.fields
       OR existing.permissions::jsonb IS DISTINCT FROM spec.permissions
       OR existing.validation IS NOT NULL
       OR existing.presets IS NOT NULL THEN
      RAISE EXCEPTION 'directus_permissions_verify: permission for % does not match the artifact', spec.collection;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND collection = ANY (forbidden_collections)) THEN
    RAISE EXCEPTION 'directus_permissions_verify: site-readonly-policy has a permission on a forbidden collection';
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_permissions pe
     WHERE pe.collection = ANY (public_denied_collections)
       AND pe.policy IN (SELECT a.policy FROM directus_access a WHERE a.role IS NULL AND a."user" IS NULL)
  ) THEN
    RAISE EXCEPTION 'directus_permissions_verify: a public policy has a Content permission';
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_permissions WHERE policy = target_policy
     GROUP BY collection, action HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'directus_permissions_verify: duplicate permission rows on site-readonly-policy';
  END IF;
END
$verify$;
-- verify:end

SELECT 'directus_permissions_verify: OK';
