-- 002_iea_etl_prep.sql
-- Reconciles the schema with the real IEA source data shape before the first bulk load.
--
-- Findings from js/iea-data.js and js/data.js:
--   1. `country` in the IEA GeoJSON is ISO 3166-1 alpha-3 ("PRT", "NLD"), not alpha-2.
--      Storing it lossily would break round-tripping back to the source. Widen the column.
--   2. The color/technology-class vocabulary in use across both datasets is actually
--      green | blue | pink | turquoise | gray | gray_blue | brown | mfg — two more values
--      than the original CHECK allowed (pink, gray_blue). Widen rather than collapse them,
--      since collapsing would destroy a real distinction (pink = nuclear-adjacent, for example).
--   3. `category` (production vs. infrastructure) is a first-class attribute of a project,
--      independent of technology. It wasn't modeled — add it.

ALTER TABLE projects
    ALTER COLUMN country_code TYPE CHAR(3);

ALTER TABLE companies
    ALTER COLUMN country_code TYPE CHAR(3);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS category TEXT;

-- End-use demand (ammonia, mobility, refining, ...) and source provenance are
-- high-value signal for B2B filtering/reporting — don't drop them on the floor.
-- JSONB (not booleans-as-columns) because we expect to later store MW allocations
-- per end-use, not just a flag, and end-use categories themselves may grow.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS end_uses JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS sources TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_projects_end_uses ON projects USING GIN (end_uses);

ALTER TABLE technologies
    DROP CONSTRAINT IF EXISTS technologies_color_class_check;

ALTER TABLE technologies
    ADD CONSTRAINT technologies_color_class_check
        CHECK (color_class IN ('green', 'blue', 'pink', 'turquoise', 'gray', 'gray_blue', 'brown', 'mfg'));

-- Provenance: every row this ETL writes should be traceable back to which source file/run
-- produced it, and how confident we are in its effective_at date (many IEA rows have no
-- `updated` year at all).
ALTER TABLE project_state_history
    ADD COLUMN IF NOT EXISTS date_confidence TEXT NOT NULL DEFAULT 'exact'
        CHECK (date_confidence IN ('exact', 'year_only', 'fallback_ingest'));
