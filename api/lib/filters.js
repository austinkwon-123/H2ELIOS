// Shared WHERE-clause builder for /api/projects and /api/analytics/summary so both
// endpoints filter identically and can never drift apart on semantics.
//
// Supported query params:
//   bbox     "minLng,minLat,maxLng,maxLat" - intersects projects.location via the
//            index-friendly && operator against ST_MakeEnvelope (viewport visibility,
//            not exact containment). Compared in planar geometry space (via
//            idx_projects_location_geom), not geography: geography's && takes the
//            geodesic *shortest path* between a polygon's vertices, so a wide/near-
//            global envelope (e.g. the globe's initial zoomed-out view) silently
//            wraps to the wrong side of the world and returns nothing.
//   status   comma-separated list matched against current_state, e.g. "live,construction".
//   end_use  comma-separated list of end_uses JSONB keys; a project matches if it has
//            ANY of them, via the GIN-indexable `?|` operator.
//
// Returns { whereSql, params } where whereSql is either '' or 'WHERE ...', and params
// is the positional parameter array ($1, $2, ...) to pass alongside whereSql.
function buildProjectFilter(query) {
  const clauses = [];
  const params = [];

  if (query.bbox) {
    const parts = String(query.bbox).split(',').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) {
      throw Object.assign(new Error('bbox must be "minLng,minLat,maxLng,maxLat"'), { status: 400 });
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    params.push(minLng, minLat, maxLng, maxLat);
    clauses.push(
      `location::geometry && ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326)`
    );
  }

  if (query.status) {
    const statuses = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      params.push(statuses);
      clauses.push(`current_state = ANY($${params.length})`);
    }
  }

  if (query.end_use) {
    const endUses = String(query.end_use).split(',').map((s) => s.trim()).filter(Boolean);
    if (endUses.length > 0) {
      params.push(endUses);
      clauses.push(`end_uses ?| $${params.length}::text[]`);
    }
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

module.exports = { buildProjectFilter };
