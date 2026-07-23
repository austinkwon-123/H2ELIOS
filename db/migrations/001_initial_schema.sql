-- 001_initial_schema.sql
-- Initial H2Grid OS schema: multi-tenant org/user model, project registry with
-- PostGIS location, and append-only Timescale hypertables for state/metric history
-- (drives the 4D timeline slider). See db/migrations/002_iea_etl_prep.sql for the
-- follow-up corrections made once real IEA source data was loaded against this.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- ==========================================================
-- Tenancy & Access
-- ==========================================================
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    plan_tier       TEXT NOT NULL DEFAULT 'trial'
                        CHECK (plan_tier IN ('trial', 'pro', 'enterprise')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL UNIQUE,
    role            TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- Reference data
-- ==========================================================
CREATE TABLE technologies (
    id              SMALLSERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,   -- e.g. 'alk', 'pem', 'soec'
    label           TEXT NOT NULL,
    color_class     TEXT NOT NULL
                        CHECK (color_class IN ('green','blue','pink','turquoise','gray','brown','mfg'))
);

CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    company_type    TEXT NOT NULL
                        CHECK (company_type IN ('epc', 'investor', 'manufacturer', 'developer', 'offtaker')),
    country_code    CHAR(2),
    website         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================
-- Core project entity
-- ==========================================================
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    country_code    CHAR(2) NOT NULL,
    region          TEXT,                   -- 'Americas' | 'Europe' | 'MEA' | 'Asia-Pac'
    location        geography(Point, 4326) NOT NULL,
    technology_id   SMALLINT REFERENCES technologies(id),

    -- current snapshot (denormalized for fast map queries; source of truth is history tables)
    current_state       TEXT NOT NULL DEFAULT 'planned'
                            CHECK (current_state IN ('planned', 'fid', 'construction', 'live', 'at_risk', 'cancelled')),
    current_capacity_mw NUMERIC(12,2),
    current_capex_usd   NUMERIC(16,2),

    data_source     TEXT,                   -- 'iea', 'ai_pipeline', 'manual'
    confidence      NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_location ON projects USING GIST (location);
CREATE INDEX idx_projects_state    ON projects (current_state);
CREATE INDEX idx_projects_region   ON projects (region);

-- ==========================================================
-- Time-series: state transitions (drives the timeline slider)
-- ==========================================================
CREATE TABLE project_state_history (
    id              BIGSERIAL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    state           TEXT NOT NULL
                        CHECK (state IN ('planned', 'fid', 'construction', 'live', 'at_risk', 'cancelled')),
    effective_at    TIMESTAMPTZ NOT NULL,   -- when the state became true (not row insert time)
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    source          TEXT,                   -- provenance: url, filing id, 'manual:<user_id>'
    PRIMARY KEY (id, effective_at)
);
SELECT create_hypertable('project_state_history', 'effective_at');
CREATE INDEX idx_state_history_project ON project_state_history (project_id, effective_at DESC);

-- ==========================================================
-- Time-series: numeric estimate revisions (CAPEX/capacity drift)
-- ==========================================================
CREATE TABLE project_metric_history (
    id              BIGSERIAL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    metric          TEXT NOT NULL CHECK (metric IN ('capacity_mw', 'capex_usd', 'opex_usd_yr')),
    value           NUMERIC(16,2) NOT NULL,
    effective_at    TIMESTAMPTZ NOT NULL,
    source          TEXT,
    PRIMARY KEY (id, effective_at)
);
SELECT create_hypertable('project_metric_history', 'effective_at');
CREATE INDEX idx_metric_history_project ON project_metric_history (project_id, metric, effective_at DESC);

-- ==========================================================
-- Relationships: who's involved in a project
-- ==========================================================
CREATE TABLE project_companies (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role            TEXT NOT NULL
                        CHECK (role IN ('epc', 'investor', 'manufacturer', 'developer', 'offtaker')),
    PRIMARY KEY (project_id, company_id, role)
);

-- ==========================================================
-- Enterprise reporting
-- ==========================================================
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    filters         JSONB NOT NULL,          -- saved query: region, state, tech, date range
    export_url      TEXT,                    -- S3 pointer once generated
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
