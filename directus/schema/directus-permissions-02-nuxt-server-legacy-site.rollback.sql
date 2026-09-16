-- FINAL-RELEASE-FIX-E — rollback for directus-permissions-02-nuxt-server-legacy-site.sql.
-- Local development unless a release plan explicitly calls for it.
--
-- This artifact took over seventeen permission rows that already existed, so rolling back is not a
-- deletion: it restores the exact pre-FIX-E definitions of those seventeen rows, which are recorded
-- literally below. This file is therefore also the tracked record of the legacy permission state
-- that was in place before FINAL-RELEASE-FIX-E.
--
-- It refuses to run unless every owned row is currently in the exact FIX-E canonical state (and
-- product_page_presets is absent). A row that drifted is not touched: the rollback raises so a
-- person can look at it. It never deletes or alters the policy, the role, the access link, the
-- three D-034 rows (content_items, content_item_locales, media_file_lifecycle), any other policy,
-- any user or any token.
--
-- The restored state is deliberately wider than the canonical one — it is the state P1-09 was
-- raised about. Do not leave a site running on it: restart Directus, confirm what you needed to
-- confirm, then re-apply directus-permissions-02-nuxt-server-legacy-site.sql.
--
-- Restart Directus after running this (permissions are cached in process memory).

BEGIN;

LOCK TABLE directus_permissions IN SHARE ROW EXCLUSIVE MODE;

-- rollback:begin
DO $rollback$
DECLARE
  content_collections constant text[] := ARRAY['content_items', 'content_item_locales', 'media_file_lifecycle'];
  found_count integer;
  target_policy uuid;
  spec record;
  existing record;
  restored integer := 0;
  recreated integer := 0;
BEGIN
  SELECT count(*) INTO found_count
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';
  IF found_count <> 1
     OR (SELECT count(*) FROM directus_roles WHERE name = 'nuxt-server') <> 1
     OR (SELECT count(*) FROM directus_policies WHERE name = 'site-readonly-policy') <> 1 THEN
    RAISE EXCEPTION 'directus_permissions_legacy_rollback: nuxt-server → site-readonly-policy is not uniquely resolvable';
  END IF;
  SELECT p.id INTO target_policy
    FROM directus_access a JOIN directus_roles r ON r.id = a.role JOIN directus_policies p ON p.id = a.policy
   WHERE r.name = 'nuxt-server' AND p.name = 'site-readonly-policy';

  IF EXISTS (SELECT 1 FROM directus_permissions WHERE policy = target_policy AND collection = 'product_page_presets') THEN
    RAISE EXCEPTION 'directus_permissions_legacy_rollback: product_page_presets already has a permission; the policy is not in the FIX-E canonical state';
  END IF;

  -- Each row: the FIX-E canonical definition that must currently be in place, then the pre-FIX-E
  -- definition to restore.
  FOR spec IN
    SELECT * FROM (VALUES
      ('products', 'read',
       'id,status,slug,category_id,sort,name_en,name_es,name_pt,model_or_series,summary_en,summary_es,summary_pt,hero_image,highlights,specifications,related_product_slugs,application_slugs,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_image,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb,
       'id,status,slug,category_id,sort,name_en,name_es,name_pt,model_or_series,summary_en,summary_es,summary_pt,hero_image,highlights,specifications,related_product_slugs,application_slugs,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_image,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb, NULL::jsonb),
      ('product_categories', 'read',
       'id,status,slug,sort,name_en,name_es,name_pt,intro_en,intro_es,intro_pt,hero_image,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb,
       'id,status,slug,sort,name_en,name_es,name_pt,intro_en,intro_es,intro_pt,hero_image,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,seo_noindex',
       '{"status":{"_eq":"published"}}'::jsonb, NULL::jsonb),
      ('products_files', 'read',
       'id,products_id,directus_files_id,file_role,sort,alt_en,alt_es,alt_pt,caption_en,enabled,version_label,file_date',
       '{"_and":[{"products_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb,
       'id,products_id,directus_files_id,file_role,sort,alt_en,alt_es,alt_pt,caption_en,caption_es,caption_pt,enabled,language,version_label,file_date',
       '{}'::jsonb, NULL::jsonb),
      ('product_faqs', 'read',
       'id,product_id,question_en,question_es,question_pt,answer_en,answer_es,answer_pt,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb,
       '*', '{}'::jsonb, NULL::jsonb),
      ('product_sections', 'read',
       'id,product_id,type,title_en,title_es,title_pt,eyebrow_en,eyebrow_es,eyebrow_pt,body_en,body_es,body_pt,layout_variant,media_id,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb,
       '*', '{}'::jsonb, NULL::jsonb),
      ('product_section_items', 'read',
       'id,section_id,label_en,label_es,label_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,icon_key,enabled,sort',
       '{"_and":[{"section_id":{"product_id":{"status":{"_eq":"published"}}}},{"section_id":{"enabled":{"_eq":true}}},{"enabled":{"_eq":true}}]}'::jsonb,
       '*', '{}'::jsonb, NULL::jsonb),
      ('product_spec_groups', 'read',
       'id,product_id,title_en,title_es,title_pt,description_en,description_es,description_pt,enabled,sort',
       '{"_and":[{"product_id":{"status":{"_eq":"published"}}},{"enabled":{"_eq":true}}]}'::jsonb,
       '*', '{}'::jsonb, NULL::jsonb),
      ('product_spec_items', 'read',
       'id,spec_group_id,label_en,label_es,label_pt,value_en,value_es,value_pt,note_en,enabled,sort',
       '{"_and":[{"spec_group_id":{"product_id":{"status":{"_eq":"published"}}}},{"spec_group_id":{"enabled":{"_eq":true}}},{"enabled":{"_eq":true}}]}'::jsonb,
       '*', '{}'::jsonb, NULL::jsonb),
      ('posts', 'read',
       'id,content_type,status,slug,publish_date,author,topics,faq_group,related_product_slugs,related_application_slugs,cover_image,seo_og_image,title_en,title_es,title_pt,excerpt_en,excerpt_es,excerpt_pt,body_en,body_es,body_pt,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt',
       '{"_and":[{"status":{"_eq":"published"}},{"content_type":{"_in":["technical_guide","faq"]}}]}'::jsonb,
       'id,content_type,status,slug,publish_date,author,topics,faq_group,related_product_slugs,related_application_slugs,cover_image,seo_og_image,title_en,title_es,title_pt,excerpt_en,excerpt_es,excerpt_pt,body_en,body_es,body_pt,seo_title_en,seo_title_es,seo_title_pt,seo_description_en,seo_description_es,seo_description_pt,created_at,updated_at',
       '{"status":{"_eq":"published"}}'::jsonb, NULL::jsonb),
      ('site_content', 'read',
       'id,content_key,status,hero_image,eyebrow_en,eyebrow_es,eyebrow_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,cta_primary_label_en,cta_primary_label_es,cta_primary_label_pt,cta_primary_path,cta_secondary_label_en,cta_secondary_label_es,cta_secondary_label_pt,cta_secondary_path',
       '{"status":{"_eq":"published"}}'::jsonb,
       'id,content_key,page_key,section_key,status,hero_image,eyebrow_en,eyebrow_es,eyebrow_pt,title_en,title_es,title_pt,body_en,body_es,body_pt,cta_primary_label_en,cta_primary_label_es,cta_primary_label_pt,cta_primary_path,cta_secondary_label_en,cta_secondary_label_es,cta_secondary_label_pt,cta_secondary_path,updated_at',
       '{"status":{"_eq":"published"}}'::jsonb, NULL::jsonb),
      ('site_settings', 'read',
       'brand_name,legal_company_name,public_email,public_phone,public_whatsapp_url,public_address,copyright_text',
       NULL::jsonb,
       '*', NULL::jsonb, NULL::jsonb),
      ('site_social_links', 'read',
       'platform,url,sort,enabled',
       '{"enabled":{"_eq":true}}'::jsonb,
       '*', NULL::jsonb, NULL::jsonb),
      ('directus_files', 'read',
       'id,is_public,title,type,filename_download',
       '{"is_public":{"_eq":true}}'::jsonb,
       'id,is_public,title,type,filename_disk,filename_download,filesize,width,height',
       '{"is_public":{"_eq":true}}'::jsonb, NULL::jsonb),
      ('inquiries', 'create',
       'inquiry_type,status,locale,consent_given,consented_at,privacy_policy_version,contact_name,contact_email,contact_phone,contact_company,contact_country,contact_title,message,related_product_slug,related_application_slug,model_number,serial_number,tm_product_interest,tm_product_format,tm_line_speed,tm_package_dimensions,tm_contaminant_concern,tm_existing_equipment,source_url,referrer,utm_source,utm_medium,utm_campaign,raw_fields,hubspot_sync_status',
       NULL::jsonb,
       'inquiry_type,status,locale,consent_given,consented_at,privacy_policy_version,contact_name,contact_email,contact_phone,contact_company,contact_country,contact_title,message,related_product_slug,related_application_slug,model_number,serial_number,tm_product_interest,tm_product_format,tm_line_speed,tm_package_dimensions,tm_contaminant_concern,tm_existing_equipment,source_url,referrer,utm_source,utm_medium,utm_campaign,raw_fields,hubspot_sync_status',
       NULL::jsonb, NULL::jsonb),
      ('inquiries', 'read', 'id', NULL::jsonb, 'id', NULL::jsonb, NULL::jsonb),
      ('inquiries', 'update',
       'hubspot_sync_status,hubspot_contact_id,hubspot_synced_at,hubspot_error_summary', NULL::jsonb,
       'hubspot_sync_status,hubspot_contact_id,hubspot_synced_at,hubspot_error_summary', NULL::jsonb, NULL::jsonb)
    ) AS owned(collection, action, canonical_fields, canonical_permissions, legacy_fields, legacy_permissions, legacy_validation)
  LOOP
    SELECT count(*) INTO found_count
      FROM directus_permissions
     WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
    IF found_count <> 1 THEN
      RAISE EXCEPTION 'directus_permissions_legacy_rollback: expected exactly one % % row, found %', spec.collection, spec.action, found_count;
    END IF;
    SELECT * INTO existing
      FROM directus_permissions
     WHERE policy = target_policy AND collection = spec.collection AND action = spec.action;
    IF existing.fields IS DISTINCT FROM spec.canonical_fields
       OR existing.permissions::jsonb IS DISTINCT FROM spec.canonical_permissions
       OR existing.validation IS NOT NULL
       OR existing.presets IS NOT NULL THEN
      RAISE EXCEPTION 'directus_permissions_legacy_rollback: permission % for % % is not in the FIX-E canonical state; not restored', existing.id, spec.collection, spec.action;
    END IF;

    UPDATE directus_permissions
       SET fields = spec.legacy_fields,
           permissions = spec.legacy_permissions::json,
           validation = spec.legacy_validation::json,
           presets = NULL
     WHERE id = existing.id;
    restored := restored + 1;
  END LOOP;

  -- The revoked row is recreated exactly as it was before FIX-E (validation was an empty object).
  INSERT INTO directus_permissions (collection, action, permissions, validation, presets, fields, policy)
  VALUES ('product_page_presets', 'read', '{"active":{"_eq":true}}'::json, '{}'::json, NULL, '*', target_policy);
  recreated := 1;

  IF (SELECT count(*) FROM directus_permissions WHERE policy = target_policy AND collection = ANY (content_collections)) <> 3 THEN
    RAISE EXCEPTION 'directus_permissions_legacy_rollback: the three D-034 rows must still be present and untouched';
  END IF;

  RAISE NOTICE 'directus_permissions_legacy_rollback: restored %, recreated %', restored, recreated;
END
$rollback$;
-- rollback:end

COMMIT;
