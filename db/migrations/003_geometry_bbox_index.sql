-- 003_geometry_bbox_index.sql
-- Bug found wiring up the frontend: PostGIS's geography && operator takes the
-- geodesic *shortest path* between a polygon's vertices, so a wide
-- ST_MakeEnvelope(...)::geography box (e.g. the near-global bbox the globe
-- sends on initial load, before the user has zoomed in) silently represents
-- the wrong side of the world once its longitude span approaches 180 degrees -
-- the API was returning 0 results for the default view.
--
-- Fix: compare in planar geometry space instead, where a bbox is just a flat
-- rectangle with no geodesic wraparound ambiguity. Backed by its own GIST
-- index since a cast on the indexed geography column can't use
-- idx_projects_location.
CREATE INDEX IF NOT EXISTS idx_projects_location_geom
    ON projects USING GIST ((location::geometry));
