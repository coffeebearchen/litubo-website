-- CC-IMP-07 REVIEW FIX 02 — atomic lifecycle (archive / restore) guard for Content Center.
--
-- Database-native objects; Directus schema snapshots (cc-imp-01-*.yaml) do NOT
-- capture triggers or functions. This file is the canonical rebuild artifact.
-- Apply after cc-imp-01-apply.yaml, cc-imp-01-constraints.sql and
-- cc-imp-01-fix-01-revision-guard.sql. Local development only. Idempotent: safe
-- to re-run. No table, column, index, collection or permission is created.
--
-- Why: the admin BFF re-reads state before every write, but Directus REST has no
-- conditional write, so a request that read "draft" could still write after a
-- concurrent Archive committed (CC-IMP-07 Review Fix 01 reproduced it). These
-- triggers make PostgreSQL the final authority (Blueprint §8.2, §23, §24).
--
-- Contract
--   content_items (BEFORE UPDATE)
--     1. An archived item is immutable except for Restore:
--        status archived → draft, archived_at → NULL, content_type and
--        first_published_at unchanged, and every locale row already has no
--        published_snapshot / published_revision / published_at.
--        Anything else on an archived row — Archived → Published, a second
--        Archive, a no-op write — is rejected. Directus audit fields
--        (date_updated, user_updated) are not business fields and are ignored.
--     2. status = archived ⇔ archived_at IS NOT NULL.
--     3. Draft ↔ Published and Draft | Published → Archived keep working.
--   content_items (BEFORE UPDATE OF archived_at)
--     4. Only Archive and Restore write archived_at. A write that sets
--        archived_at = NULL on an item that is not archived is a stale Restore
--        (e.g. a duplicate Restore after the first one committed) → rejected.
--   content_item_locales (BEFORE INSERT OR UPDATE)
--     5. Takes FOR SHARE on the parent item. FOR SHARE conflicts with the row
--        lock of any content_items UPDATE, so a locale write and a lifecycle
--        transition on the same item serialize in commit order.
--     6. Parent archived → every INSERT and UPDATE is rejected, except the
--        Restore clear: NEW.last_change_kind = 'restore', item / locale /
--        working-copy fields / draft_revision / first_published_at unchanged,
--        and published_snapshot, published_revision, published_at all NULL.
--        A stale Unpublish (last_change_kind = 'unpublish') or Publish is rejected.
--        The Restore clear must change something (Review Fix 03): a row that is
--        already cleared with last_change_kind = 'restore' is rejected
--        (restore_already_cleared), so a duplicate Restore records no no-op
--        revision; the BFF skips such rows, which keeps a partial Restore retryable.
--   content_item_locales (BEFORE UPDATE OF last_change_kind)
--     7. A write that sets last_change_kind = 'restore' requires the parent to be
--        archived (a duplicate Restore after the first one committed → rejected).
--   content_items_files, content_relations (BEFORE INSERT OR UPDATE OR DELETE)
--     8. FOR SHARE on the owner item(s) — OLD and NEW content_items_id, so moving a
--        row into or out of an archived item is rejected. Owner archived → rejected.
--        DELETE is guarded only when issued directly (pg_trigger_depth() = 1):
--        foreign-key ON DELETE CASCADE from deleting a product or content item is
--        not a Content Center edit and keeps working. Relation targets are not
--        checked (no new business rule).
--   content_item_locales has no delete surface in the admin BFF and no DELETE guard.
--
-- Trigger order: PostgreSQL fires same-event row triggers by name. On
-- content_item_locales, content_item_locales_draft_revision_guard_trg runs before
-- content_item_locales_lifecycle_guard_trg and
-- content_item_locales_lifecycle_marker_guard_trg; either rejection rolls back the
-- whole statement.
--
-- Error identity: SQLSTATE 23505 with DETAIL "Key (content_lifecycle)=…" and
-- message prefix "content_lifecycle_guard:". For INSERT / UPDATE Directus
-- translates it into RECORD_NOT_UNIQUE with field "content_lifecycle" — no real
-- column has that name, so only this guard produces it. Directus does not
-- translate DELETE errors; for an administrator it returns the raw database
-- message, which knex prefixes with the SQL text ("delete from … -
-- content_lifecycle_guard: …"); the BFF recognizes that marker (verified against
-- the running Directus). The BFF maps both to 409 `lifecycle_changed`.
-- A rejected statement rolls back its Directus transaction: no field, activity or
-- revision is written.
--
-- Verification (expected results after apply):
--   SELECT tgrelid::regclass, tgname FROM pg_trigger
--    WHERE NOT tgisinternal AND tgrelid::regclass::text LIKE 'content_%' ORDER BY 1, 2;
--   → content_item_locales  content_item_locales_draft_revision_guard_trg
--     content_item_locales  content_item_locales_lifecycle_guard_trg
--     content_item_locales  content_item_locales_lifecycle_marker_guard_trg
--     content_items         content_items_lifecycle_guard_trg
--     content_items         content_items_lifecycle_restore_guard_trg
--     content_items_files   content_items_files_lifecycle_guard_trg
--     content_relations     content_relations_lifecycle_guard_trg
--   SELECT proname FROM pg_proc WHERE proname LIKE 'content_lifecycle_%' ORDER BY 1;
--   → content_lifecycle_child_guard, content_lifecycle_item_guard,
--     content_lifecycle_item_restore_guard, content_lifecycle_locale_guard,
--     content_lifecycle_locale_marker_guard, content_lifecycle_lock_item,
--     content_lifecycle_reject
--
-- Rollback (local only), in this order:
--   DROP TRIGGER IF EXISTS content_relations_lifecycle_guard_trg ON content_relations;
--   DROP TRIGGER IF EXISTS content_items_files_lifecycle_guard_trg ON content_items_files;
--   DROP TRIGGER IF EXISTS content_item_locales_lifecycle_marker_guard_trg ON content_item_locales;
--   DROP TRIGGER IF EXISTS content_item_locales_lifecycle_guard_trg ON content_item_locales;
--   DROP TRIGGER IF EXISTS content_items_lifecycle_restore_guard_trg ON content_items;
--   DROP TRIGGER IF EXISTS content_items_lifecycle_guard_trg ON content_items;
--   DROP FUNCTION IF EXISTS content_lifecycle_child_guard();
--   DROP FUNCTION IF EXISTS content_lifecycle_locale_marker_guard();
--   DROP FUNCTION IF EXISTS content_lifecycle_locale_guard();
--   DROP FUNCTION IF EXISTS content_lifecycle_item_restore_guard();
--   DROP FUNCTION IF EXISTS content_lifecycle_item_guard();
--   DROP FUNCTION IF EXISTS content_lifecycle_lock_item(integer);
--   DROP FUNCTION IF EXISTS content_lifecycle_reject(text, integer, text);

BEGIN;

CREATE OR REPLACE FUNCTION content_lifecycle_reject(table_name text, item_id integer, reason text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'content_lifecycle_guard: % rejected for content item % (%)', table_name, item_id, reason
    USING ERRCODE = '23505',
          DETAIL = format('Key (content_lifecycle)=(%s) rejected for content item %s.', reason, item_id),
          TABLE = table_name,
          COLUMN = 'content_lifecycle',
          CONSTRAINT = 'content_lifecycle_guard';
END;
$$;

-- Status of the item, locked FOR SHARE until the calling transaction ends; NULL when
-- the row does not exist (the foreign key, not this guard, handles that).
CREATE OR REPLACE FUNCTION content_lifecycle_lock_item(item_id integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  item_status text;
BEGIN
  SELECT status INTO item_status FROM content_items WHERE id = item_id FOR SHARE;
  RETURN item_status;
END;
$$;

CREATE OR REPLACE FUNCTION content_lifecycle_item_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'archived' THEN
    IF NEW.status = 'draft'
       AND NEW.archived_at IS NULL
       AND NEW.content_type IS NOT DISTINCT FROM OLD.content_type
       AND NEW.first_published_at IS NOT DISTINCT FROM OLD.first_published_at THEN
      IF EXISTS (
        SELECT 1 FROM content_item_locales
         WHERE content_items_id = OLD.id
           AND (published_snapshot IS NOT NULL OR published_revision IS NOT NULL OR published_at IS NOT NULL)
      ) THEN
        PERFORM content_lifecycle_reject('content_items', OLD.id, 'restore_before_publication_cleared');
      END IF;
      RETURN NEW;
    END IF;
    PERFORM content_lifecycle_reject('content_items', OLD.id, 'archived');
  END IF;

  IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN
    PERFORM content_lifecycle_reject('content_items', OLD.id, 'archive_without_archived_at');
  END IF;
  IF NEW.status IS DISTINCT FROM 'archived' AND NEW.archived_at IS NOT NULL THEN
    PERFORM content_lifecycle_reject('content_items', OLD.id, 'archived_at_without_archive');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION content_lifecycle_item_restore_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.archived_at IS NULL AND OLD.status IS DISTINCT FROM 'archived' THEN
    PERFORM content_lifecycle_reject('content_items', OLD.id, 'not_archived');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION content_lifecycle_locale_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_status text;
  other_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content_items_id IS DISTINCT FROM OLD.content_items_id THEN
    -- Moving a locale row between items: lock both owners in id order, reject if either is archived.
    item_status := content_lifecycle_lock_item(LEAST(OLD.content_items_id, NEW.content_items_id));
    other_status := content_lifecycle_lock_item(GREATEST(OLD.content_items_id, NEW.content_items_id));
    IF item_status = 'archived' OR other_status = 'archived' THEN
      PERFORM content_lifecycle_reject('content_item_locales', OLD.content_items_id, 'archived');
    END IF;
    RETURN NEW;
  END IF;

  item_status := content_lifecycle_lock_item(NEW.content_items_id);
  IF item_status IS DISTINCT FROM 'archived' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.last_change_kind = 'restore'
     AND NEW.locale IS NOT DISTINCT FROM OLD.locale
     AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.slug IS NOT DISTINCT FROM OLD.slug
     AND NEW.summary IS NOT DISTINCT FROM OLD.summary
     AND NEW.blocks::jsonb IS NOT DISTINCT FROM OLD.blocks::jsonb
     AND NEW.seo_title IS NOT DISTINCT FROM OLD.seo_title
     AND NEW.seo_description IS NOT DISTINCT FROM OLD.seo_description
     AND NEW.canonical_path IS NOT DISTINCT FROM OLD.canonical_path
     AND NEW.noindex IS NOT DISTINCT FROM OLD.noindex
     AND NEW.draft_revision IS NOT DISTINCT FROM OLD.draft_revision
     AND NEW.first_published_at IS NOT DISTINCT FROM OLD.first_published_at
     AND NEW.published_snapshot IS NULL
     AND NEW.published_revision IS NULL
     AND NEW.published_at IS NULL THEN
    -- Review Fix 03: a row that is already cleared with the restore marker needs no cleanup. A
    -- second Restore that prepared its payload before the first one committed is refused here, so
    -- it writes nothing and Directus records no activity or revision for it.
    IF OLD.published_snapshot IS NULL
       AND OLD.published_revision IS NULL
       AND OLD.published_at IS NULL
       AND OLD.last_change_kind = 'restore' THEN
      PERFORM content_lifecycle_reject('content_item_locales', NEW.content_items_id, 'restore_already_cleared');
    END IF;
    RETURN NEW;
  END IF;

  PERFORM content_lifecycle_reject('content_item_locales', NEW.content_items_id, 'archived');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION content_lifecycle_locale_marker_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.last_change_kind = 'restore'
     AND content_lifecycle_lock_item(NEW.content_items_id) IS DISTINCT FROM 'archived' THEN
    PERFORM content_lifecycle_reject('content_item_locales', NEW.content_items_id, 'not_archived');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION content_lifecycle_child_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  first_id integer;
  second_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    first_id := OLD.content_items_id;
  ELSIF TG_OP = 'INSERT' THEN
    first_id := NEW.content_items_id;
  ELSE
    first_id := LEAST(OLD.content_items_id, NEW.content_items_id);
    second_id := GREATEST(OLD.content_items_id, NEW.content_items_id);
    IF second_id = first_id THEN
      second_id := NULL;
    END IF;
  END IF;

  IF content_lifecycle_lock_item(first_id) = 'archived' THEN
    PERFORM content_lifecycle_reject(TG_TABLE_NAME, first_id, 'archived');
  END IF;
  IF second_id IS NOT NULL AND content_lifecycle_lock_item(second_id) = 'archived' THEN
    PERFORM content_lifecycle_reject(TG_TABLE_NAME, second_id, 'archived');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_items_lifecycle_guard_trg ON content_items;
CREATE TRIGGER content_items_lifecycle_guard_trg
  BEFORE UPDATE ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_item_guard();

DROP TRIGGER IF EXISTS content_items_lifecycle_restore_guard_trg ON content_items;
CREATE TRIGGER content_items_lifecycle_restore_guard_trg
  BEFORE UPDATE OF archived_at ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_item_restore_guard();

DROP TRIGGER IF EXISTS content_item_locales_lifecycle_guard_trg ON content_item_locales;
CREATE TRIGGER content_item_locales_lifecycle_guard_trg
  BEFORE INSERT OR UPDATE ON content_item_locales
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_locale_guard();

DROP TRIGGER IF EXISTS content_item_locales_lifecycle_marker_guard_trg ON content_item_locales;
CREATE TRIGGER content_item_locales_lifecycle_marker_guard_trg
  BEFORE UPDATE OF last_change_kind ON content_item_locales
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_locale_marker_guard();

DROP TRIGGER IF EXISTS content_items_files_lifecycle_guard_trg ON content_items_files;
CREATE TRIGGER content_items_files_lifecycle_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON content_items_files
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_child_guard();

DROP TRIGGER IF EXISTS content_relations_lifecycle_guard_trg ON content_relations;
CREATE TRIGGER content_relations_lifecycle_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON content_relations
  FOR EACH ROW
  EXECUTE FUNCTION content_lifecycle_child_guard();

COMMIT;
