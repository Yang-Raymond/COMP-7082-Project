-- GhostRacer schema (PostgreSQL + PostGIS)
-- Apply with:
--   psql "host=HOST port=PORT user=avnadmin dbname=ghostracer sslmode=require" -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  points        INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id         INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_id INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  name       VARCHAR(100) NOT NULL,
  -- PostGIS uses longitude-latitude order:
  --   ST_GeogFromText('LINESTRING(-123.1000 49.2500, -123.1010 49.2510)')
  path       GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  distance_m REAL         NOT NULL,
  area_key   VARCHAR(32)  NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_routes_creator ON routes (creator_id);
CREATE INDEX IF NOT EXISTS idx_routes_area_status ON routes (area_key, status);
CREATE INDEX IF NOT EXISTS sp_routes_path ON routes USING GIST (path);

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  route_id    INTEGER     NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  duration_ms INTEGER     NOT NULL,
  is_record   BOOLEAN     NOT NULL DEFAULT FALSE,
  flagged     BOOLEAN     NOT NULL DEFAULT FALSE,
  started_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_user ON runs (user_id, started_at);
-- leaderboard: fastest runs on a route
CREATE INDEX IF NOT EXISTS idx_runs_route_duration ON runs (route_id, duration_ms);

CREATE TABLE IF NOT EXISTS run_points (
  id        BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id    INTEGER          NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  seq       INTEGER          NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lng       DOUBLE PRECISION NOT NULL,
  t_ms      INTEGER          NOT NULL,
  speed_mps REAL,
  accel_mag REAL,
  UNIQUE (run_id, seq)
);
