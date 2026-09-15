-- FINAL-RELEASE-FIX-B — release data safety check: published TEST data. Read only.
--
-- Reports every record that is in a publicly deliverable state while one of its identity fields carries
-- an explicit TEST marker. Markers are matched exactly and case-sensitively:
--   '[TEST]'                 legacy seed posts
--   'TEST ONLY'              also covers 'TEST ONLY — NOT FOR PUBLICATION'
--   'NOT FOR PUBLICATION'
-- The word "test" on its own never matches, so real content about testing is never reported.
--
-- Covered collections, and the state that makes a record public:
--   posts                 status = 'published', every content type (the posts API serves only some
--                         types, but a published TEST row must not reach a release baseline either way)
--   products              status = 'published'
--   product_categories    status = 'published'
--   content_item_locales  parent content item status = 'published' and a published_snapshot exists
-- Identity fields: names / titles and SEO titles in every locale; for content, the working-copy title,
-- the SEO title and the title inside the published snapshot.
--
-- Output with psql -A -t: one `FINDING<TAB>collection<TAB>id<TAB>status<TAB>marker<TAB>slug` line per
-- finding, then exactly one `CHECKED<TAB><number of findings>` line.
--
-- This file holds no transaction control and no write. scripts/release-check-test-data.mjs runs it inside
-- a READ ONLY transaction (npm run release:check-test-data); the tests run it inside a transaction that is
-- always rolled back.

WITH markers (rank, marker) AS (
  VALUES (1, '[TEST]'), (2, 'TEST ONLY'), (3, 'NOT FOR PUBLICATION')
),
public_records (collection, id, status, slug, identity) AS (
  SELECT 'posts', p.id, p.status, p.slug,
         concat_ws(' ', p.title_en, p.title_es, p.title_pt, p.seo_title_en, p.seo_title_es, p.seo_title_pt)
    FROM posts p
   WHERE p.status = 'published'
  UNION ALL
  SELECT 'products', pr.id, pr.status, pr.slug,
         concat_ws(' ', pr.name_en, pr.name_es, pr.name_pt, pr.seo_title_en, pr.seo_title_es, pr.seo_title_pt)
    FROM products pr
   WHERE pr.status = 'published'
  UNION ALL
  SELECT 'product_categories', c.id, c.status, c.slug,
         concat_ws(' ', c.name_en, c.name_es, c.name_pt, c.seo_title_en, c.seo_title_es, c.seo_title_pt)
    FROM product_categories c
   WHERE c.status = 'published'
  UNION ALL
  SELECT 'content_item_locales', l.id, i.status, l.slug,
         concat_ws(' ', l.title, l.seo_title, l.published_snapshot ->> 'title')
    FROM content_item_locales l
    JOIN content_items i ON i.id = l.content_items_id
   WHERE i.status = 'published' AND l.published_snapshot IS NOT NULL
),
findings AS (
  SELECT r.collection, r.id, r.status, r.slug,
         (SELECT m.marker FROM markers m WHERE strpos(r.identity, m.marker) > 0 ORDER BY m.rank LIMIT 1) AS marker
    FROM public_records r
)
SELECT line
  FROM (
    SELECT 1 AS part, f.collection, f.id,
           concat_ws(E'\t', 'FINDING', f.collection, f.id::text, f.status, f.marker, coalesce(f.slug, '')) AS line
      FROM findings f
     WHERE f.marker IS NOT NULL
    UNION ALL
    SELECT 2, '', 0, concat_ws(E'\t', 'CHECKED', count(*)::text)
      FROM findings f
     WHERE f.marker IS NOT NULL
  ) report
 ORDER BY part, collection, id;
