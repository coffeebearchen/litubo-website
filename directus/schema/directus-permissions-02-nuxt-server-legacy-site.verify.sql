-- FINAL-RELEASE-FIX-E — verification for
-- directus-permissions-02-nuxt-server-legacy-site.sql. Read only: it writes nothing.
--
-- Raises (psql exits non-zero with ON_ERROR_STOP=1) unless every check holds:
--   1. directus_permissions has the expected Directus 11 columns;
--   2. exactly one role nuxt-server, one policy site-readonly-policy, one access link between them,
--      and that policy has neither admin nor app access;
--   3. exactly one permission row for each of the sixteen owned (collection, action) pairs on that
--      policy, with the exact fields and row filter of the apply artifact, validation and presets
--      NULL;
--   4. no permission at all on product_page_presets for that policy (revoked);
--   5. no permission on that policy for any legacy collection beyond the declared pairs;
--   6. the three D-034 rows (content_items, content_item_locales, media_file_lifecycle) are still
--      exactly as artifact 01 defines them;
--   7. no public policy (an access row with neither role nor user) has any permission on a legacy
--      or Content collection;
--   8. no duplicate (policy, collection, action) row on that policy;
--   9. the forbidden broad patterns are absent: no fields = '*' anywhere on the policy, no
--      unfiltered product child read, no readable insight / case_study / news legacy post, and no
--      filename_disk in the directus_files field list.
-- Prints `directus_permissions_legacy_verify: OK` when all hold.
--
-- Run: psql -X -At -v ON_ERROR_STOP=1 … < directus-permissions-02-nuxt-server-legacy-site.verify.sql

-- verify:begin
DO $verify$
DECLARE
  required_columns constant text[] := ARRAY['id', 'collection', 'action', 'permissions', 'validation', 'presets', 'fields', 'policy'];
  owned_collections constant text[] := ARRAY[
    'products', 'product_categories', 'products_files', 'product_faqs', 'product_sections',
    'product_section_items', 'product_spec_groups', 'product_spec_items', 'posts', 'site_content',
    'site_settings', 'site_social_links', 'directus_files', 'inquiries', 'product_page_presets'];
  content_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'media_file_lifecycle'];
  declared_pairs constant text[] := ARRAY[
    'products|read', 'product_categories|read', 'products_files|read', 'product_faqs|read',
    'product_sections|read', 'product_section_items|read', 'product_spec_groups|read',
    'product_spec_items|read', 'posts|read', 'site_content|read', 'site_settings|read',
    'site_social_links|read', 'directus_files|read',
    'inquiries|create', 'inquiries|read', 'inquiries|update'];
  revoked_collections constant text[] := ARRAY['product_page_presets'];
  child_collections constant text[] := ARRAY[
    'products_files', 'product_faqs', 'product_sections', 'product_section_items',
    'product_spec_groups', 'product_spec_items'];
  public_denied_collections constant text[] := owned_collections || content_collections;
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
  offender text;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema() AND table_name = 'directus_permissions' AND column_name = ANY (required_columns);
  IF found_count <> array_length(required_columns, 1) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: unexpected directus_permissions columns (% of %)', found_count, array_length(required_columns, 1);
  END IF;

  IF (SELECT count(*) FROM directus_roles WHERE name = 'nuxt-server') <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = 'site-readonly-policy') <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: role nuxt-server or policy site-readonly-policy is not unique';
  END IF;
  SELECT count(*) INTO found_count
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: expected one access link nuxt-server → site-readonly-policy, found %', found_count;
  END IF;
  SELECT p.id INTO target_policy
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF EXISTS (SELECT 1 FROM directus_policies WHERE id = target_policy AND (admin_access OR app_access)) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: site-readonly-policy has admin or app access';
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
      ('inquiries', 'read', 'id', NULL::jsonb),
      ('inquiries', 'update', 'hubspot_sync_status,hubspot_contact_id,hubspot_synced_at,hubspot_error_summary', NULL::jsonb)
    ) AS owned(collection, action, fields, permissions)
  LOOP
    SELECT count(*) INTO found_count
      FROM directus_permissions
     WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
    IF found_count <> 1 THEN
      RAISE EXCEPTION 'directus_permissions_legacy_verify: expected exactly one % % permission, found %', spec.collection, spec.action, found_count;
    END IF;
    SELECT * INTO existing
      FROM directus_permissions
     WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
    IF existing.fields IS DISTINCT FROM spec.fields
       OR existing.permissions::jsonb IS DISTINCT FROM spec.permissions
       OR existing.validation IS NOT NULL
       OR existing.presets IS NOT NULL THEN
      RAISE EXCEPTION 'directus_permissions_legacy_verify: permission % % does not match the artifact', spec.collection, spec.action;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND collection = ANY (revoked_collections)) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: a revoked collection still has a permission on site-readonly-policy';
  END IF;

  SELECT pe.collection || '|' || pe.action INTO offender
    FROM directus_permissions pe
   WHERE pe.policy = target_policy
     AND pe.collection = ANY (owned_collections)
     AND NOT (pe.collection || '|' || pe.action = ANY (declared_pairs))
   LIMIT 1;
  IF offender IS NOT NULL THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: undeclared permission % on site-readonly-policy', offender;
  END IF;

  -- The D-034 rows are still exactly artifact 01's.
  FOR spec IN
    SELECT * FROM (VALUES
      ('content_items', 'read',
       'id,content_type,status,archived_at',
       '{"_and":[{"status":{"_eq":"published"}},{"archived_at":{"_null":true}},{"content_type":{"_in":["technical_article","case_study"]}}]}'::jsonb),
      ('content_item_locales', 'read',
       'content_items_id,locale,slug,published_snapshot,published_at',
       '{"_and":[{"published_snapshot":{"_nnull":true}},{"locale":{"_eq":"en"}},{"content_items_id":{"status":{"_eq":"published"}}},{"content_items_id":{"archived_at":{"_null":true}}},{"content_items_id":{"content_type":{"_in":["technical_article","case_study"]}}}]}'::jsonb),
      ('media_file_lifecycle', 'read', 'file_id,archived', '{"archived":{"_eq":true}}'::jsonb)
    ) AS owned(collection, action, fields, permissions)
  LOOP
    SELECT count(*) INTO found_count
      FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection;
    IF found_count <> 1 THEN
      RAISE EXCEPTION 'directus_permissions_legacy_verify: the D-034 row for % is missing or duplicated (found %)', spec.collection, found_count;
    END IF;
    SELECT * INTO existing FROM directus_permissions WHERE policy = target_policy AND collection = spec.collection;
    IF existing.action <> spec.action
       OR existing.fields IS DISTINCT FROM spec.fields
       OR existing.permissions::jsonb IS DISTINCT FROM spec.permissions
       OR existing.validation IS NOT NULL
       OR existing.presets IS NOT NULL THEN
      RAISE EXCEPTION 'directus_permissions_legacy_verify: the D-034 row for % was modified', spec.collection;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM directus_permissions pe
     WHERE pe.collection = ANY (public_denied_collections)
       AND pe.policy IN (SELECT a.policy FROM directus_access a WHERE a.role IS NULL AND a."user" IS NULL)
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: a public policy has a business permission';
  END IF;

  IF EXISTS (
    SELECT 1 FROM directus_permissions WHERE policy = target_policy
     GROUP BY collection, action HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: duplicate permission rows on site-readonly-policy';
  END IF;

  -- Forbidden broad patterns, stated positively so a future widening is caught here too.
  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND (fields = '*' OR fields IS NULL)) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: site-readonly-policy still has a wildcard field list';
  END IF;
  IF EXISTS (
    SELECT 1 FROM directus_permissions
     WHERE policy = target_policy AND collection = ANY (child_collections)
       AND (permissions IS NULL OR permissions::jsonb = '{}'::jsonb OR permissions::text NOT LIKE '%published%')
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: a product child collection is readable without a published-parent filter';
  END IF;
  IF EXISTS (
    SELECT 1 FROM directus_permissions
     WHERE policy = target_policy AND collection = 'posts'
       AND (permissions::text LIKE '%insight%' OR permissions::text LIKE '%case_study%' OR permissions::text LIKE '%news%'
            OR permissions::text NOT LIKE '%technical_guide%' OR permissions::text NOT LIKE '%faq%')
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: the legacy posts filter is not restricted to technical_guide and faq';
  END IF;
  IF EXISTS (
    SELECT 1 FROM directus_permissions
     WHERE policy = target_policy AND collection = 'directus_files' AND fields LIKE '%filename_disk%'
  ) THEN
    RAISE EXCEPTION 'directus_permissions_legacy_verify: directus_files still exposes filename_disk';
  END IF;
END
$verify$;
-- verify:end

SELECT 'directus_permissions_legacy_verify: OK';
