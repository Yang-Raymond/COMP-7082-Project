-- GhostRacer schema (PostgreSQL + PostGIS)
-- Apply with: npm run db:schema from /server

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  points        INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One pending password-reset code per user (6-digit code, stored hashed)
CREATE TABLE IF NOT EXISTS password_resets (
  user_id    INTEGER     PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0
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

-- Route saving (POST /routes). Written as ALTER ... IF NOT EXISTS so running this file again
-- also upgrades a database that was created before these columns existed.
-- client_id: a UUID the phone makes, so a retried upload returns the saved route instead of a copy
ALTER TABLE routes ADD COLUMN IF NOT EXISTS client_id UUID UNIQUE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS activity VARCHAR(10) NOT NULL DEFAULT 'run' CHECK (activity IN ('run', 'bike'));
ALTER TABLE routes ADD COLUMN IF NOT EXISTS elevation_gain_m REAL;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE run_points ADD COLUMN IF NOT EXISTS alt_m REAL;

-- Route visibility: 'public' = everyone with the app, 'private' = the creator and accepted friends.
-- Default is private so routes saved before this column existed are not exposed by accident.
ALTER TABLE routes ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));
CREATE INDEX IF NOT EXISTS idx_routes_visibility ON routes (visibility, activity);

-- Friends. One row per pair, whoever sent the request. Declining or removing deletes the row.
CREATE TABLE IF NOT EXISTS friendships (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  addressee_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  requester_muted BOOLEAN NOT NULL DEFAULT FALSE,
  addressee_muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_pair
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
-- Challenges. One sender challenges one or more friends to beat their time on a route.
CREATE TABLE IF NOT EXISTS challenges (
  id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  route_id   INTEGER     NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  sender_id  INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sender_ms  INTEGER     NOT NULL, --sender's best time on the route when the challenge was sent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- optional expiration time
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_challenges_sender ON challenges (sender_id);

CREATE TABLE IF NOT EXISTS challenge_recipients (
  challenge_id INTEGER     NOT NULL REFERENCES challenges (id) ON DELETE CASCADE,
  recipient_id INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  run_id       INTEGER     REFERENCES runs (id) ON DELETE SET NULL,
  duration_ms  INTEGER,
  raced_at     TIMESTAMPTZ,
  PRIMARY KEY (challenge_id, recipient_id)
);

-- Challenges that haven't been raced yet
CREATE INDEX IF NOT EXISTS idx_challenge_recipients_pending ON challenge_recipients (recipient_id) WHERE raced_at IS NULL;
