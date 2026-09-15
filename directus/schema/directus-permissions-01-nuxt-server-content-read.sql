-- DIRECTUS-PERMISSIONS-PROVISIONING-01 — tracked Directus permissions for the nuxt-server
-- public reader (Content Center public delivery, CC-IMP-10 prerequisite).
--
-- Why this file exists: Directus schema snapshots (directus/schema/*.yaml) capture
-- collections, fields and relations only — never roles, policies or permissions. Every
-- earlier nuxt-server permission was set by hand and recorded in prose, so it could not be
-- reproduced in another environment. From this artifact on, a Directus permission that
-- differs from that baseline is provisioned from Git (Decision D-034).
--
-- Target: Directus 11.17.4 system tables
--   directus_permissions (id serial, collection, action, permissions json, validation json,
--                         presets json, fields text, policy uuid → directus_policies)
--   directus_policies / directus_roles / directus_access (role ↔ policy link)
-- There is no unique constraint on (policy, collection, action); this file enforces
-- uniqueness itself under a table lock. A different system-table shape fails closed.
--
-- THIS ARTIFACT OWNS ONLY the three `read` rows below on the policy `site-readonly-policy`
-- linked to the role `nuxt-server`:
--   content_items         fields  id,content_type,status,archived_at
--                         filter  status = published AND archived_at IS NULL
--                                 AND content_type IN (technical_article, case_study)
--   content_item_locales  fields  content_items_id,locale,slug,published_snapshot,published_at
--                         filter  published_snapshot IS NOT NULL AND locale = en
--                                 AND parent item (content_items_id →) status = published,
--                                 archived_at IS NULL, content_type IN (technical_article, case_study)
--   media_file_lifecycle  fields  file_id,archived
--                         filter  archived = true   (the public media proxy only needs to know
--                                                    whether a file is archived)
-- `slug` is the one working-copy column exposed: it is the route lookup key the Content Center
-- Blueprint (§26) allows, locked once a locale is first published; the reader must still match
-- published_snapshot.slug. No working title / summary / blocks / SEO, draft_revision,
-- last_change_kind, user_* or date_* column is readable.
--
-- It never touches: any other row of site-readonly-policy (the legacy posts, products,
-- product_* , products_files, directus_files, site_content, site_settings, site_social_links,
-- inquiries permissions stay exactly as they are); the Administrator or public policy; users,
-- roles, access links, static tokens or any secret. It grants nothing on content_items_files,
-- content_relations, directus_revisions or directus_activity, and refuses to run if such a
-- permission exists on this policy or if a public policy has any Content permission.
--
-- Policy resolution: by name, never by environment UUID — exactly one role `nuxt-server`,
-- exactly one policy `site-readonly-policy`, exactly one access link between them, and that
-- policy has neither admin nor app access. Anything else raises and nothing is written.
--
-- Idempotency: the table is locked (SHARE ROW EXCLUSIVE); an owned row is inserted when absent,
-- normalized in place (same id) when it drifted, and left untouched when it already matches.
-- A second run changes nothing. More than one `read` row, or any non-read row, for an owned
-- collection on this policy raises.
--
-- Apply order (after the collections exist): cc-imp-01-apply.yaml → cc-imp-01-constraints.sql →
-- cc-imp-01-fix-01-revision-guard.sql → cc-imp-07-fix-02-lifecycle-guard.sql → this file →
-- directus-permissions-01-nuxt-server-content-read.verify.sql.
--
-- Reload: Directus 11 keeps schema and permissions in process memory and does not observe direct
-- SQL changes. Restart the Directus service after apply or rollback
-- (local: `docker compose restart directus`). No cache is flushed and no data volume is touched.
--
-- Verify:   directus/schema/directus-permissions-01-nuxt-server-content-read.verify.sql
-- Rollback: directus/schema/directus-permissions-01-nuxt-server-content-read.rollback.sql
--           (deletes only these exact rows; refuses a row that drifted).
--
-- Local development applies this file with psql inside the Postgres container. Production applies
-- it only as an explicit, verified release step (RELEASE-SAFETY-GATES §3A.8).

BEGIN;

LOCK TABLE directus_permissions IN SHARE ROW EXCLUSIVE MODE;

-- apply:begin
DO $apply$
DECLARE
  required_columns constant text[] := ARRAY['id', 'collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'policy'];
  owned_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'media_file_lifecycle'];
  forbidden_collections constant text[] := ARRAY['content_items_files', 'content_relations', 'directus_revisions', 'directus_activity'];
  public_denied_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'content_items_files', 'content_relations', 'media_file_lifecycle', 'directus_revisions', 'directus_activity'];
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
  inserted integer := 0;
  normalized integer := 0;
  unchanged integer := 0;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'directus_permissions' AND column_name = ANY (required_columns);
  IF found_count <> array_length(required_columns, 1) THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: directus_permissions does not have the expected Directus 11 columns (% of %)', found_count, array_length(required_columns, 1);
  END IF;

  SELECT count(*) INTO found_count FROM directus_roles WHERE name = 'nuxt-server';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: expected exactly one role nuxt-server, found %', found_count;
  END IF;
  SELECT count(*) INTO found_count FROM directus_policies WHERE name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: expected exactly one policy site-readonly-policy, found %', found_count;
  END IF;
  SELECT count(*) INTO found_count
    FROM directus_access a
    JOIN directus_roles r ON r.id = a.role
    JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: expected exactly one access link nuxt-server → site-readonly-policy, found %', found_count;
  END IF;

  SELECT p.id INTO target_policy
    FROM directus_access a
    JOIN directus_roles r ON r.id = a.role
    JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF EXISTS (SELECT 1 FROM directus_policies WHERE id = target_policy AND (admin_access OR app_access)) THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: site-readonly-policy must have neither admin nor app access';
  END IF;

  SELECT count(*) INTO found_count FROM directus_collections WHERE collection = ANY (owned_collections);
  IF found_count <> array_length(owned_collections, 1) THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: an owned collection is not registered in Directus (% of %)', found_count, array_length(owned_collections, 1);
  END IF;

  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND collection = ANY (forbidden_collections)) THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: site-readonly-policy has a permission on a forbidden collection; refusing to continue';
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_permissions pe
     WHERE pe.collection = ANY (public_denied_collections)
       AND pe.policy IN (SELECT a.policy FROM directus_access a WHERE a.role IS NULL AND a."user" IS NULL)
  ) THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: a public policy has a Content permission; refusing to continue';
  END IF;

  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND collection = ANY (owned_collections) AND action <> 'read') THEN
    RAISE EXCEPTION 'directus_permissions_provisioning: site-readonly-policy has a non-read permission on an owned collection; refusing to continue';
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
    SELECT count(*) INTO found_count FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection AND action = 'read';
    IF found_count > 1 THEN
      RAISE EXCEPTION 'directus_permissions_provisioning: % read permissions exist for % on site-readonly-policy; refusing to continue', found_count, spec.collection;
    END IF;

    IF found_count = 0 THEN
      INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
      VALUES (spec.collection, 'read', spec.permissions::json, NULL, NULL, spec.fields, target_policy);
      inserted := inserted + 1;
    ELSE
      SELECT * INTO existing FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection AND action = 'read';
      IF existing.fields IS DISTINCT FROM spec.fields
         OR existing.permissions::jsonb IS DISTINCT FROM spec.permissions
         OR existing.validation IS NOT NULL
         OR existing.presets IS NOT NULL THEN
        UPDATE directus_permissions
           SET fields = spec.fields, permissions = spec.permissions::json, validation = NULL, presets = NULL
         WHERE id = existing.id;
        normalized := normalized + 1;
      ELSE
        unchanged := unchanged + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'directus_permissions_provisioning: inserted %, normalized %, unchanged %', inserted, normalized, unchanged;
END
$apply$;
-- apply:end

COMMIT;
