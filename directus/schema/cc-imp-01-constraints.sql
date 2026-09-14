-- CC-IMP-01 — Content Foundation database constraints.
--
-- Directus schema snapshots can express single-column uniqueness only, so the
-- composite, partial and CHECK constraints required by
-- docs/content-cms/CONTENT-CENTER-BLUEPRINT-V1.md (§6.1, §11, §12, §14, §26) are
-- applied here, right after `directus schema apply cc-imp-01-apply.yaml`.
-- The database is the final authority; the admin BFF keeps friendly pre-checks.
-- Local development only. Idempotent: every statement can be re-run safely.

BEGIN;

-- One working copy per content item and locale.
CREATE UNIQUE INDEX IF NOT EXISTS content_item_locales_item_locale_unique
  ON content_item_locales (content_items_id, locale);

-- Public route identity: a slug is unique per locale across every content type
-- (Blueprint §14, P1 owned by CC-IMP-01).
CREATE UNIQUE INDEX IF NOT EXISTS content_item_locales_locale_slug_unique
  ON content_item_locales (locale, slug);

DO $$ BEGIN
  ALTER TABLE content_item_locales
    ADD CONSTRAINT content_item_locales_draft_revision_check CHECK (draft_revision >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A file is linked to an item at most once per role.
CREATE UNIQUE INDEX IF NOT EXISTS content_items_files_item_file_role_unique
  ON content_items_files (content_items_id, directus_files_id, file_role);

-- Exactly one target, matching the relation kind.
DO $$ BEGIN
  ALTER TABLE content_relations
    ADD CONSTRAINT content_relations_target_check CHECK (
      (relation_kind = 'product' AND product_id IS NOT NULL AND related_content_id IS NULL)
      OR (relation_kind = 'content' AND related_content_id IS NOT NULL AND product_id IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No self relation.
DO $$ BEGIN
  ALTER TABLE content_relations
    ADD CONSTRAINT content_relations_no_self_check CHECK (
      related_content_id IS NULL OR related_content_id <> content_items_id
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No duplicate target per source item.
CREATE UNIQUE INDEX IF NOT EXISTS content_relations_item_product_unique
  ON content_relations (content_items_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS content_relations_item_content_unique
  ON content_relations (content_items_id, related_content_id) WHERE related_content_id IS NOT NULL;

COMMIT;
