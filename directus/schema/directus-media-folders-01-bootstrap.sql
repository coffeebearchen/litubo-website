-- MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01 — the Protected System Folders a fresh Directus environment
-- needs before any real media is entered.
--
-- Why this file exists: fresh provisioning builds the Directus system tables, the schema, the
-- constraints and guards, the service identity and the permissions, but not one row of
-- `directus_folders`. The Media Library's folder governance (server/utils/folderRegistry.ts, D-023)
-- is keyed on folder rows that exist: without them a fresh environment has no governed root and no
-- customer zone, and the admin cannot make one, because a customer folder needs an existing zone
-- root as its parent. The development tree was made by hand in Phase 2 and was never reproducible.
--
-- THIS ARTIFACT OWNS, AND ONLY OWNS, THE ROWS AT THESE TEN PATHS (a path is the parent names and the
-- folder's own name joined by "/"):
--   home · applications · company · products · resources
--   products/xray · products/metal-detection · products/checkweigher · products/combination ·
--   products/conveyor
-- They are exactly the entries of FOLDER_POLICY that are neither legacy-read-only nor
-- conflict-frozen, which are also the Protected System Folders of
-- docs/project/MEDIA-LIBRARY-CLOUD-WORKSPACE-V1-BLUEPRINT.md §3.1. tests/mediaFolderBootstrap.test.ts
-- fails if this list and the runtime policy ever drift apart.
--
-- IT NEVER CREATES:
--   · a legacy-read-only or conflict-frozen folder — products/technical-docs, resources/insights,
--     resources/case-studies, resources/downloads, company/global-service, certifications. Older
--     environments have them only because Phase 2 made them; the runtime keeps them browsable but
--     frozen, and a fresh environment is never handed a frozen folder.
--   · a folder of the v0.1 recommendation that was never created — brand, resources/manuals,
--     resources/certificates, test-only. The runtime has no policy for them, so they could only
--     ever be `unknown` and locked.
--   · any customer-managed folder (products/xray/<model>, …/manuals, …). Customers create those
--     through the controlled folder CRUD; no customer folder is written into provisioning.
--
-- IT NEVER WRITES: an existing folder row (no UPDATE, no DELETE — nothing is renamed, moved, merged
-- or removed), `directus_files`, `directus_settings` (storage_default_folder is left as it is),
-- products, content, media lifecycle records, permissions or TEST data. A folder has no public
-- state: creating one publishes nothing and changes no sitemap.
--
-- RESOLUTION IS BY PATH, NEVER BY UUID. A canonical folder that already exists keeps its UUID; a
-- missing one is created with `gen_random_uuid()`. No identifier from any environment appears here.
--
-- IDEMPOTENCY: `directus_folders` is locked (SHARE ROW EXCLUSIVE), and a canonical folder is created
-- only when its path does not exist yet. A second run creates nothing.
--
-- FAIL CLOSED. Nothing is written — and nothing is repaired — when any of these holds:
--   1. `directus_folders` does not have the shape this file was validated against (Directus 12.3.1:
--      id, name, parent).
--   2. a folder cannot be reached from a root (a parent cycle), or a folder name contains "/": its
--      path would be undefined or ambiguous, since paths join names with "/".
--   3. a canonical path is held by more than one folder — a duplicate root or a duplicate child. The
--      runtime already treats such a path as `ambiguous` and locks it.
--   4. a sibling at a canonical position differs from the canonical name only by case or by
--      surrounding spaces, tabs or line breaks (a root `Products`, say). The admin's own sibling
--      rule — trim, then compare case-insensitively — treats the two as one name.
--   5. a folder carrying a canonical name sits outside every customer zone at a position that is not
--      its canonical one (`xray` at the root, `resources/xray`, …). It may be the canonical folder
--      attached to the wrong parent; moving it is a human decision. A same-named folder INSIDE a
--      customer zone (products/<category>/…) is an ordinary customer folder and is left alone.
--   Every check runs on one read of the tree, before the first write.
--
-- APPLY ORDER: after the Directus bootstrap (manifest step 00) has created `directus_folders`. It
-- depends on nothing else and nothing else depends on it, so scripts/provisioning-manifest.json runs
-- it last (step 60), immediately followed by its verification (step 61).
--
-- RELOAD: Directus reads folders from the database on each request; this file alone needs no
-- restart. SQL writes carry no Directus activity or revision entry, like every provisioning artifact.
--
-- Verify:   directus/schema/directus-media-folders-01-bootstrap.verify.sql
-- Rollback: none, deliberately. The file only adds folders the runtime expects to exist and never
--           changes one that exists; undoing it would mean deleting Protected System Folders, which
--           may already hold files and customer folders, and D-023 never lets that happen
--           automatically. A failed run has written nothing: it is one transaction.

BEGIN;

-- apply:begin
DO $apply$
DECLARE
  folder_columns  constant text[] := ARRAY['id', 'name', 'parent'];

  -- Parents before children.
  canonical_paths constant text[] := ARRAY[
    'home', 'applications', 'company', 'products', 'resources',
    'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination',
    'products/conveyor'
  ];

  -- The declared customer zones (CUSTOMER_MANAGEABLE_ROOTS). Everything beneath them is customers'.
  customer_zones  constant text[] := ARRAY[
    'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination',
    'products/conveyor'
  ];

  -- The surrounding whitespace check 4 trims: space, tab, carriage return, line feed, form feed.
  whitespace      constant text := E' \t\r\n\f';

  found_count      integer;
  folder_count     integer;
  slash_names      text;
  tree_ids         uuid[];
  tree_names       text[];
  tree_parents     text[];
  tree_paths       text[];
  offenders        text;
  canonical        text;
  canonical_parent text;
  parent_id        uuid;
  folder_id        uuid;
  resolved         jsonb := '{}'::jsonb;
  created          text[] := '{}';
  kept             text[] := '{}';
BEGIN
  -- 1. A different Directus system-table shape must not be guessed at.
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'directus_folders'
     AND column_name = ANY (folder_columns);
  IF found_count <> cardinality(folder_columns) THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: directus_folders does not have the expected Directus 12.3.1 shape (% of % columns); nothing was written', found_count, cardinality(folder_columns);
  END IF;

  LOCK TABLE directus_folders IN SHARE ROW EXCLUSIVE MODE;

  -- One read of the whole tree: every folder a root can reach, with its parent's path and its own.
  -- A folder in a parent cycle is never reached, so the recursion ends.
  WITH RECURSIVE tree AS (
    SELECT id, name::text AS name, NULL::text AS parent_path, name::text AS path
      FROM directus_folders WHERE parent IS NULL
    UNION ALL
    SELECT f.id, f.name::text, tree.path, tree.path || '/' || f.name
      FROM directus_folders f JOIN tree ON f.parent = tree.id
  )
  SELECT coalesce(array_agg(id ORDER BY path, id), '{}'),
         coalesce(array_agg(name ORDER BY path, id), '{}'),
         coalesce(array_agg(parent_path ORDER BY path, id), '{}'),
         coalesce(array_agg(path ORDER BY path, id), '{}'),
         (SELECT count(*) FROM directus_folders),
         (SELECT string_agg(quote_literal(name), ', ' ORDER BY name) FROM directus_folders WHERE position('/' IN name) > 0)
    INTO tree_ids, tree_names, tree_parents, tree_paths, folder_count, slash_names
    FROM tree;

  -- 2. Every folder has exactly one well-defined path.
  IF folder_count <> cardinality(tree_ids) THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: % folder(s) cannot be reached from a root (a parent cycle); their paths are undefined, and nothing was written', folder_count - cardinality(tree_ids);
  END IF;
  IF slash_names IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: folder name(s) containing "/" make folder paths ambiguous: %; nothing was written', slash_names;
  END IF;

  -- 3. A canonical path held by more than one folder.
  SELECT string_agg(format('%s (%s folders)', path, n), ', ' ORDER BY path) INTO offenders
    FROM (SELECT t.path, count(*) AS n
            FROM unnest(tree_paths) AS t(path)
           WHERE t.path = ANY (canonical_paths)
           GROUP BY t.path
          HAVING count(*) > 1) duplicates;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: canonical path(s) held by more than one folder: %; the runtime already treats them as ambiguous, and nothing was written', offenders;
  END IF;

  -- 4. A sibling that is the canonical name up to case or surrounding whitespace.
  WITH canon AS (
    SELECT c.path, substring(c.path FROM '[^/]+$') AS name, substring(c.path FROM '^(.*)/[^/]+$') AS parent_path
      FROM unnest(canonical_paths) AS c(path)
  )
  SELECT string_agg(format('%s (for %s)', quote_literal(t.path), canon.path), ', ' ORDER BY t.path) INTO offenders
    FROM unnest(tree_names, tree_parents, tree_paths) AS t(name, parent_path, path)
    JOIN canon ON t.parent_path IS NOT DISTINCT FROM canon.parent_path
   WHERE lower(btrim(t.name, whitespace)) = canon.name
     AND t.name <> canon.name;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: folder(s) that differ from a canonical name only by case or whitespace: %; nothing was written', offenders;
  END IF;

  -- 5. A canonical name outside every customer zone, away from its canonical position.
  WITH canon AS (
    SELECT c.path, substring(c.path FROM '[^/]+$') AS name
      FROM unnest(canonical_paths) AS c(path)
  )
  SELECT string_agg(format('%s (canonical: %s)', quote_literal(t.path), canon.path), ', ' ORDER BY t.path) INTO offenders
    FROM unnest(tree_names, tree_paths) AS t(name, path)
    JOIN canon ON t.name = canon.name
   WHERE t.path <> canon.path
     AND NOT EXISTS (SELECT 1 FROM unnest(customer_zones) AS z(path) WHERE starts_with(t.path, z.path || '/'));
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_bootstrap: canonical folder name(s) found outside the customer zones, away from their canonical position: %; it may be a canonical folder under the wrong parent, moving it is a human decision, and nothing was written', offenders;
  END IF;

  -- Writes: a missing canonical folder is created under its canonical parent, which is either kept
  -- or created earlier in this loop. An existing one is kept exactly as it is.
  FOREACH canonical IN ARRAY canonical_paths LOOP
    SELECT t.id INTO folder_id FROM unnest(tree_ids, tree_paths) AS t(id, path) WHERE t.path = canonical;
    IF folder_id IS NOT NULL THEN
      kept := kept || canonical;
    ELSE
      canonical_parent := substring(canonical FROM '^(.*)/[^/]+$');
      parent_id := NULL;
      IF canonical_parent IS NOT NULL THEN
        parent_id := (resolved ->> canonical_parent)::uuid;
        IF parent_id IS NULL THEN
          RAISE EXCEPTION 'directus_media_folders_bootstrap: % is listed before its parent %; nothing was written', canonical, canonical_parent;
        END IF;
      END IF;
      INSERT INTO directus_folders (id, name, parent)
      VALUES (gen_random_uuid(), substring(canonical FROM '[^/]+$'), parent_id)
      RETURNING id INTO folder_id;
      created := created || canonical;
    END IF;
    resolved := resolved || jsonb_build_object(canonical, folder_id);
  END LOOP;

  RAISE NOTICE 'directus_media_folders_bootstrap: created [%], kept [%]',
    array_to_string(created, ', '), array_to_string(kept, ', ');
END
$apply$;
-- apply:end

COMMIT;
