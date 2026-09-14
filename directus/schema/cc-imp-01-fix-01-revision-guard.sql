-- CC-IMP-01-FIX-01-R1 — atomic draft revision guard for content_item_locales.
--
-- Database-native object; Directus schema snapshots (cc-imp-01-*.yaml) do NOT
-- capture triggers or functions. This file is the canonical rebuild artifact.
-- Apply after cc-imp-01-apply.yaml and cc-imp-01-constraints.sql. Local
-- development only. Idempotent: safe to re-run.
--
-- Contract (docs/content-cms/CONTENT-CENTER-BLUEPRINT-V1.md §8, §18):
--   A. If any working-copy field changes (title, slug, summary, blocks,
--      seo_title, seo_description, canonical_path, noindex), the same UPDATE
--      must set draft_revision = OLD.draft_revision + 1.
--   B. draft_revision may only ever change to OLD.draft_revision + 1
--      (never decrease, never jump).
--   C. An update that changes no working-copy field and leaves draft_revision
--      unchanged passes (publication fields, last_change_kind).
--
-- Why this is atomic: an UPDATE takes the row lock. Two concurrent saves that
-- both read revision N both send N + 1; the second waits for the first, then
-- runs this trigger against the committed row (OLD = N + 1, NEW = N + 1 with
-- changed fields) and is rejected. Its transaction rolls back, so it writes no
-- field and Directus records no activity or revision for it.
--
-- Error identity: SQLSTATE 23505 with DETAIL "Key (draft_revision)=…". Directus
-- translates it into RECORD_NOT_UNIQUE with field "draft_revision" on
-- content_item_locales — a combination no real index produces (draft_revision
-- has no unique index) — and the admin BFF maps exactly that to 409.
--
-- Rollback (local only), in this order:
--   DROP TRIGGER IF EXISTS content_item_locales_draft_revision_guard_trg ON content_item_locales;
--   DROP FUNCTION IF EXISTS content_item_locales_draft_revision_guard();

BEGIN;

CREATE OR REPLACE FUNCTION content_item_locales_draft_revision_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  draft_changed boolean;
BEGIN
  draft_changed :=
       NEW.title IS DISTINCT FROM OLD.title
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.blocks::jsonb IS DISTINCT FROM OLD.blocks::jsonb
    OR NEW.seo_title IS DISTINCT FROM OLD.seo_title
    OR NEW.seo_description IS DISTINCT FROM OLD.seo_description
    OR NEW.canonical_path IS DISTINCT FROM OLD.canonical_path
    OR NEW.noindex IS DISTINCT FROM OLD.noindex;

  IF (NEW.draft_revision IS DISTINCT FROM OLD.draft_revision
        AND NEW.draft_revision IS DISTINCT FROM OLD.draft_revision + 1)
     OR (draft_changed AND NEW.draft_revision IS DISTINCT FROM OLD.draft_revision + 1) THEN
    RAISE EXCEPTION 'content_item_locales_draft_revision_guard: draft revision conflict'
      USING ERRCODE = '23505',
            DETAIL = format('Key (draft_revision)=(%s) is not the next draft revision of row %s (current %s).',
                            NEW.draft_revision, OLD.id, OLD.draft_revision),
            TABLE = 'content_item_locales',
            COLUMN = 'draft_revision',
            CONSTRAINT = 'content_item_locales_draft_revision_guard';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_item_locales_draft_revision_guard_trg ON content_item_locales;

CREATE TRIGGER content_item_locales_draft_revision_guard_trg
  BEFORE UPDATE ON content_item_locales
  FOR EACH ROW
  EXECUTE FUNCTION content_item_locales_draft_revision_guard();

COMMIT;
