-- FINAL-RELEASE-FIX-E — tracked, least-privilege Directus permissions for the legacy public site
-- surface of the nuxt-server reader (FINAL-RELEASE-AUDIT-01 P1-09).
--
-- Why this file exists: the seventeen legacy `site-readonly-policy` permission rows (products,
-- product_*, products_files, posts, site_content, site_settings, site_social_links,
-- product_page_presets, directus_files, inquiries) were set by hand in the Directus Admin over
-- Phases 3 to 7 and recorded only in prose, so they could not be reproduced in another environment
-- and drifted wider than the public BFF needs. This artifact brings all seventeen under Decision
-- D-034 (tracked permission provisioning) and narrows each one to what the public server code
-- actually requests.
--
-- Target: Directus 11.17.4 system tables (same shape as
--   directus-permissions-01-nuxt-server-content-read.sql). There is no unique constraint on
--   (policy, collection, action); this file enforces uniqueness itself under a table lock.
--
-- THIS ARTIFACT OWNS the seventeen legacy (collection, action) pairs listed below on the policy
-- `site-readonly-policy` linked to the role `nuxt-server` — sixteen canonical rows plus one
-- revocation. It touches nothing else.
--
-- It never touches the three rows owned by D-034 (content_items, content_item_locales,
-- media_file_lifecycle): those stay exactly as
-- directus-permissions-01-nuxt-server-content-read.sql left them, and this file refuses to run if
-- any of its own specs named one of them. It never touches the Administrator or public policy,
-- users, roles, access links, static tokens or any secret, and it changes no collection, field,
-- relation or business row.
--
-- WHAT CHANGED, and why (every field list below is the union of what the public server code
-- literally requests; callers are named so a later reader can re-derive it):
--
--   products                read   fields unchanged (all 25 are requested by
--                                  api/cms/products/[category].get.ts, [category]/[slug].get.ts,
--                                  utils/sitemap.ts and utils/contentPublic.ts; `sort` and
--                                  `status` are needed to sort and filter). filter unchanged:
--                                  status = published. The published-category condition stays in
--                                  the BFF so public product behaviour is unchanged.
--   product_categories      read   fields unchanged (all 18 are requested; `status` is filtered on
--                                  and `sort` is sorted on). filter unchanged: status = published.
--   products_files          read   `language`, `caption_es` and `caption_pt` dropped — no caller
--                                  requests them (ES/PT are not published locales). filter was {}
--                                  (every file link of every product, draft included) and is now
--                                  parent product published AND enabled = true.
--   product_faqs            read   was fields=* (which exposed the internal `source_note`) and
--                                  filter={}. Now an explicit list without source_note, and
--                                  parent product published AND enabled = true.
--   product_sections        read   was fields=* / {}. Now explicit without `external_url`, and
--                                  parent product published AND enabled = true.
--   product_section_items   read   was fields=* / {}. Now explicit, and the parent section's
--                                  product published AND that section enabled AND enabled = true.
--   product_spec_groups     read   was fields=* / {}. Now explicit, and parent product published
--                                  AND enabled = true.
--   product_spec_items      read   was fields=* / {}. `note_es` / `note_pt` dropped (only note_en
--                                  is requested). Now the parent group's product published AND
--                                  that group enabled AND enabled = true.
--   posts                   read   `created_at` / `updated_at` dropped — no caller requests them.
--                                  filter gains content_type IN (technical_guide, faq): D-035 (3)
--                                  keeps only those two legacy types public, and the BFF already
--                                  sends that filter. insight, case_study and news rows are no
--                                  longer readable by this identity at all.
--   site_content            read   `page_key`, `section_key`, `updated_at` dropped — no caller
--                                  requests them. filter unchanged: status = published.
--   site_settings           read   was fields=* with no filter. Now exactly the seven fields
--                                  api/cms/site-settings.get.ts requests. The collection has no
--                                  publication lifecycle, so no status filter is invented.
--   site_social_links       read   was fields=* with no filter. Now platform,url,sort (requested)
--                                  plus `enabled` (filtered on), and the row filter enabled = true.
--   directus_files          read   `filename_disk`, `filesize`, `width`, `height` dropped — no
--                                  public caller requests them; utils/publicMedia.ts asks for
--                                  id,is_public,type,filename_download and utils/contentPublic.ts
--                                  additionally for title. filter unchanged: is_public = true,
--                                  which still gates /assets delivery through the media proxy.
--   product_page_presets    read   REVOKED. No public route reads this collection; the only
--                                  reader in the repository is api/admin/presets.get.ts, which
--                                  uses an administrator token, not this identity. A permission a
--                                  public identity never uses is removed rather than narrowed.
--   inquiries               create fields unchanged: exactly the thirty keys
--                                  utils/publicInquiry.ts writes. Already minimal.
--   inquiries               read   fields unchanged: `id` only — utils/writeInquiry.ts reads the
--                                  new row's id so the HubSpot sync can address it.
--   inquiries               update fields unchanged: the four hubspot_* columns
--                                  utils/syncHubspot.ts patches.
--
-- KNOWN RESIDUAL (P2, recorded rather than papered over): the three `inquiries` rows have no row
-- filter. The collection has no `user_created`, `created_by` or equivalent column, so without a
-- schema change there is no reliable way to scope read/update to rows this identity created; a
-- status-based filter would be brittle and is deliberately not invented. The fields are already
-- minimal (id on read, four hubspot_* columns on update), so the residual is the row scope only.
--
-- Policy resolution: by name, never by environment UUID — exactly one role `nuxt-server`, exactly
-- one policy `site-readonly-policy`, exactly one access link between them, and that policy has
-- neither admin nor app access. No permission id is ever hard-coded.
--
-- Idempotency: the table is locked (SHARE ROW EXCLUSIVE); an owned row is inserted when absent,
-- normalized in place (same id) when it drifted, and left untouched when it already matches; the
-- revoked row is deleted when present and ignored when absent. A second run changes nothing. More
-- than one row for an owned (collection, action), or an action on an owned collection that this
-- artifact does not declare, raises and nothing is written.
--
-- Apply order: after the schema snapshot and the tracked SQL guards, and after
-- directus-permissions-01-nuxt-server-content-read.sql. Then run this file's .verify.sql and
-- artifact 01's .verify.sql.
--
-- Reload: Directus 11 keeps permissions in process memory and does not observe direct SQL changes.
-- Restart the Directus service after apply or rollback (local: `docker compose restart directus`).
--
-- Verify:   directus/schema/directus-permissions-02-nuxt-server-legacy-site.verify.sql
-- Rollback: directus/schema/directus-permissions-02-nuxt-server-legacy-site.rollback.sql
--           (restores the exact pre-FIX-E definitions, and only from this canonical state).
--
-- Local development applies this file with psql inside the Postgres container. Production applies
-- it only as an explicit, verified release step (RELEASE-SAFETY-GATES §3A.8).

BEGIN;

LOCK TABLE directus_permissions IN SHARE ROW EXCLUSIVE MODE;

-- apply:begin
DO $apply$
DECLARE
  required_columns constant text[] := ARRAY['id', 'collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'policy'];
  -- Collections this artifact owns. directus_files is a Directus system collection and is not
  -- registered in directus_collections, so it is excluded from the registration check below.
  owned_collections constant text[] := ARRAY[
    'products', 'product_categories', 'products_files', 'product_faqs', 'product_sections',
    'product_section_items', 'product_spec_groups', 'product_spec_items', 'posts', 'site_content',
    'site_settings', 'site_social_links', 'directus_files', 'inquiries', 'product_page_presets'];
  registered_collections constant text[] := ARRAY[
    'products', 'product_categories', 'products_files', 'product_faqs', 'product_sections',
    'product_section_items', 'product_spec_groups', 'product_spec_items', 'posts', 'site_content',
    'site_settings', 'site_social_links', 'inquiries', 'product_page_presets'];
  -- Owned by artifact 01 (D-034). This file must never name one of them.
  content_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'media_file_lifecycle'];
  -- Every (collection, action) pair this artifact declares, as 'collection|action'.
  declared_pairs constant text[] := ARRAY[
    'products|read', 'product_categories|read', 'products_files|read', 'product_faqs|read',
    'product_sections|read', 'product_section_items|read', 'product_spec_groups|read',
    'product_spec_items|read', 'posts|read', 'site_content|read', 'site_settings|read',
    'site_social_links|read', 'directus_files|read',
    'inquiries|create', 'inquiries|read', 'inquiries|update'];
  -- Owned collections that must end up with no permission at all on this policy.
  revoked_collections constant text[] := ARRAY['product_page_presets'];
  -- A public policy must never hold a business permission on anything this identity reads.
  public_denied_collections constant text[] := owned_collections || content_collections;
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
  offender text;
  inserted integer := 0;
  normalized integer := 0;
  unchanged integer := 0;
  revoked integer := 0;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'directus_permissions' AND column_name = ANY (required_columns);
  IF found_count <> array_length(required_columns, 1) THEN
    RAISE EXCEPTION 'directus_permissions_legacy: directus_permissions does not have the expected Directus 11 columns (% of %)', found_count, array_length(required_columns, 1);
  END IF;

  SELECT count(*) INTO found_count FROM directus_roles WHERE name = 'nuxt-server';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy: expected exactly one role nuxt-server, found %', found_count;
  END IF;
  SELECT count(*) INTO found_count FROM directus_policies WHERE name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy: expected exactly one policy site-readonly-policy, found %', found_count;
  END IF;
  SELECT count(*) INTO found_count
    FROM directus_access a
    JOIN directus_roles r ON r.id = a.role
    JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy: expected exactly one access link nuxt-server → site-readonly-policy, found %', found_count;
  END IF;

  SELECT p.id INTO target_policy
    FROM directus_access a
    JOIN directus_roles r ON r.id = a.role
    JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF EXISTS (SELECT 1 FROM directus_policies WHERE id = target_policy AND (admin_access OR app_access)) THEN
    RAISE EXCEPTION 'directus_permissions_legacy: site-readonly-policy must have neither admin nor app access';
  END IF;

  IF owned_collections && content_collections THEN
    RAISE EXCEPTION 'directus_permissions_legacy: this artifact must not own a collection provisioned by artifact 01 (D-034)';
  END IF;

  SELECT count(*) INTO found_count FROM directus_collections WHERE collection = ANY (registered_collections);
  IF found_count <> array_length(registered_collections, 1) THEN
    RAISE EXCEPTION 'directus_permissions_legacy: an owned collection is not registered in Directus (% of %)', found_count, array_length(registered_collections, 1);
  END IF;

  -- The three D-034 rows must already be in place and are left untouched.
  SELECT count(*) INTO found_count
    FROM directus_permissions
   WHERE policy = target_policy AND collection = ANY (content_collections) AND action = 'read';
  IF found_count <> array_length(content_collections, 1) THEN
    RAISE EXCEPTION 'directus_permissions_legacy: expected the three D-034 content read rows to exist first (% of %); apply artifact 01 before this one', found_count, array_length(content_collections, 1);
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_permissions pe
     WHERE pe.collection = ANY (public_denied_collections)
       AND pe.policy IN (SELECT a.policy FROM directus_access a WHERE a.role IS NULL AND a."user" IS NULL)
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy: a public policy has a business permission; refusing to continue';
  END IF;

  -- Any action on an owned collection that this artifact neither declares nor revokes is a state
  -- this file does not understand: stop rather than leave it half-managed.
  SELECT pe.collection || '|' || pe.action INTO offender
    FROM directus_permissions pe
   WHERE pe.policy = target_policy
     AND pe.collection = ANY (owned_collections)
     AND NOT (pe.collection = ANY (revoked_collections))
     AND NOT (pe.collection || '|' || pe.action = ANY (declared_pairs))
   LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'directus_permissions_legacy: undeclared permission % on site-readonly-policy; refusing to continue', offender;
  END IF;

  FOR spec IN
    SELECT * FROM (VALUES
      ('products', 'read',
       'id,status,slug,category_id,sort,name_en,name_es,name_pt,model_or_series,summary_en,summary_es,summary_pt,hero_image,highlights,specifications,related_product_slugs,application_slugs,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_image,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb),
      ('product_categories', 'read',
       'id,status,slug,sort,name_en,name_es,name_pt,intro_en,intro_es,intro_pt,hero_image,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb),
      ('products_files', 'read',
       'id,products_id,directus_files_id,file_role,sort,alt_en,alt_es,alt_pt,caption_en,enabled,version_label,file_date',
       '{"_and":[{"products_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('product_faqs', 'read',
       'id,product_id,question_en,question_es,question_pt,answer_en,answer_es,answer_pt,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('product_sections', 'read',
       'id,product_id,type,title_en,title_es,title_pt,eyebrow_en,eyebrow_es,eyebrow_pt,body_en,body_es,body_pt,layout_variant,media_id,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('product_section_items', 'read',
       'id,section_id,label_en,label_es,label_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,icon_key,enabled,sort',
       '{"_and":[{"section_id":{"product_id":{"status":{"_eq":"published"}}}},{"section_id":{"enabled":{"_eq":true}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('product_spec_groups', 'read',
       'id,product_id,title_en,title_es,title_pt,description_en,description_es,description_pt,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('product_spec_items', 'read',
       'id,spec_group_id,label_en,label_es,label_pt,value_en,value_es,value_pt,note_en,enabled,sort',
       '{"_and":[{"spec_group_id":{"product_id":{"status":{"_eq":"published"}}}},{"spec_group_id":{"enabled":{"_eq":true}}},{"enabled":{"_eq":true}}]}'::jsonb),
      ('posts', 'read',
       'id,content_type,status,slug,publish_date,author,topics,faq_group,related_product_slugs,related_application_slugs,cover_image,seo_og_image,title_en,title_es,title_pt,excerpt_en,excerpt_es,excerpt_pt,body_en,body_es,body_pt,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt',
       '{"_and":[{"status":{"_eq":"published"}},{"content_type":{"_in":["technical_guide","faq"]}}]}'::jsonb),
      ('site_content', 'read',
       'id,content_key,status,hero_image,eyebrow_en,eyebrow_es,eyebrow_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,cta_primary_label_en,cta_primary_label_es,cta_primary_label_pt,cta_primary_path,cta_secondary_label_en,cta_secondary_label_es,cta_secondary_label_pt,cta_secondary_path',
       '{"status":{"_eq":"published"}}'::jsonb),
      ('site_settings', 'read',
       'brand_name,legal_company_name,public_email,public_phone,public_whatsapp_url,public_address,copyright_text',
       NULL::jsonb),
      ('site_social_links', 'read',
       'platform,url,sort,enabled',
       '{"enabled":{"_eq":true}}'::jsonb),
      ('directus_files', 'read',
       'id,is_public,title,type,filename_download',
       '{"is_public":{"_eq":true}}'::jsonb),
      ('inquiries', 'create',
       'inquiry_type,status,locale,consent_given,consented_at,privacy_policy_version,contact_name,contact_email,contact_phone,contact_company,contact_country,contact_title,message,related_product_slug,related_application_slug,model_number,serial_number,tm_product_interest,tm_product_format,tm_line_speed,tm_package_dimensions,tm_contaminant_concern,tm_existing_equipment,source_url,referrer,utm_source,utm_medium,utm_campaign,raw_fields,hubspot_sync_status',
       NULL::jsonb),
      ('inquiries', 'read',
       'id',
       NULL::jsonb),
      ('inquiries', 'update',
       'hubspot_sync_status,hubspot_contact_id,hubspot_synced_at,hubspot_error_summary',
       NULL::jsonb)
    ) AS owned(collection, action, fields, permissions)
  LOOP
    SELECT count(*) INTO found_count
      FROM directus_permissions
     WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
    IF found_count > 1 THEN
      RAISE EXCEPTION 'directus_permissions_legacy: % rows exist for the % % permission on site-readonly-policy; refusing to continue', found_count, spec.collection, spec.action;
    END IF;

    IF found_count = 0 THEN
      INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
      VALUES (spec.collection, spec.action, spec.permissions::json, NULL, NULL, spec.fields, target_policy);
      inserted := inserted + 1;
    ELSE
      SELECT * INTO existing
        FROM directus_permissions
       WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
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

  -- Revocation: this identity keeps no permission at all on a collection no public route reads.
  DELETE FROM directus_permissions
   WHERE policy = target_policy AND collection = ANY (revoked_collections);
  GET DIAGNOSTICS revoked = ROW_COUNT;

  RAISE NOTICE 'directus_permissions_legacy: inserted %, normalized %, unchanged %, revoked %', inserted, normalized, unchanged, revoked;
END
$apply$;
-- apply:end

COMMIT;
