-- MEDIA-LIBRARY-PRODUCTION-BOOTSTRAP-01 — verification for directus-media-folders-01-bootstrap.sql.
-- Read only: it writes nothing.
--
-- Raises (psql exits non-zero with ON_ERROR_STOP=1) unless every check holds:
--   1. `directus_folders` has the expected Directus 12.3.1 shape (id, name, parent);
--   2. every folder is reachable from a root and no folder name contains "/", so every folder has
--      exactly one well-defined path;
--   3. each of the ten canonical paths is held by exactly one folder — the five roots home,
--      applications, company, products, resources, and the five product categories under products;
--   4. no sibling at a canonical position differs from the canonical name only by case or by
--      surrounding spaces, tabs or line breaks;
--   5. no folder carrying a canonical name sits outside every customer zone at a position other
--      than its canonical one.
-- Prints `directus_media_folders_verify: OK` when all hold.
--
-- It deliberately does NOT require the absence of the legacy-read-only and conflict-frozen folders
-- (products/technical-docs, resources/*, company/global-service, certifications): an environment
-- older than this artifact may hold them, the runtime keeps them frozen, and they are not this
-- artifact's to judge. It never counts files, never reads `directus_files` and never reads a
-- credential.
--
-- Run: psql -X -At -v ON_ERROR_STOP=1 … < directus-media-folders-01-bootstrap.verify.sql

-- verify:begin
DO $verify$
DECLARE
  folder_columns  constant text[] := ARRAY['id', 'name', 'parent'];

  canonical_paths constant text[] := ARRAY[
    'home', 'applications', 'company', 'products', 'resources',
    'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination',
    'products/conveyor'
  ];

  customer_zones  constant text[] := ARRAY[
    'products/xray', 'products/metal-detection', 'products/checkweigher', 'products/combination',
    'products/conveyor'
  ];

  -- The surrounding whitespace check 4 trims: space, tab, carriage return, line feed, form feed.
  whitespace      constant text := E' \t\r\n\f';

  found_count  integer;
  folder_count integer;
  slash_names  text;
  tree_names   text[];
  tree_parents text[];
  tree_paths   text[];
  offenders    text;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'directus_folders'
     AND column_name = ANY (folder_columns);
  IF found_count <> cardinality(folder_columns) THEN
    RAISE EXCEPTION 'directus_media_folders_verify: unexpected directus_folders shape (% of % columns)', found_count, cardinality(folder_columns);
  END IF;

  WITH RECURSIVE tree AS (
    SELECT id, name::text AS name, NULL::text AS parent_path, name::text AS path
      FROM directus_folders WHERE parent IS NULL
    UNION ALL
    SELECT f.id, f.name::text, tree.path, tree.path || '/' || f.name
      FROM directus_folders f JOIN tree ON f.parent = tree.id
  )
  SELECT coalesce(array_agg(name ORDER BY path, id), '{}'),
         coalesce(array_agg(parent_path ORDER BY path, id), '{}'),
         coalesce(array_agg(path ORDER BY path, id), '{}'),
         (SELECT count(*) FROM directus_folders),
         (SELECT string_agg(quote_literal(name), ', ' ORDER BY name) FROM directus_folders WHERE position('/' IN name) > 0)
    INTO tree_names, tree_parents, tree_paths, folder_count, slash_names
    FROM tree;

  IF folder_count <> cardinality(tree_paths) THEN
    RAISE EXCEPTION 'directus_media_folders_verify: % folder(s) cannot be reached from a root (a parent cycle)', folder_count - cardinality(tree_paths);
  END IF;
  IF slash_names IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_verify: folder name(s) containing "/" make folder paths ambiguous: %', slash_names;
  END IF;

  SELECT string_agg(format('%s (%s found)', c.path, coalesce(k.n, 0)), ', ' ORDER BY c.path) INTO offenders
    FROM unnest(canonical_paths) AS c(path)
    LEFT JOIN (SELECT t.path, count(*) AS n FROM unnest(tree_paths) AS t(path) GROUP BY t.path) k ON k.path = c.path
   WHERE coalesce(k.n, 0) <> 1;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'directus_media_folders_verify: expected exactly one folder at each canonical path: %', offenders;
  END IF;

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
    RAISE EXCEPTION 'directus_media_folders_verify: folder(s) that differ from a canonical name only by case or whitespace: %', offenders;
  END IF;

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
    RAISE EXCEPTION 'directus_media_folders_verify: canonical folder name(s) found outside the customer zones, away from their canonical position: %', offenders;
  END IF;
END
$verify$;
-- verify:end

SELECT 'directus_media_folders_verify: OK';
