import "dotenv/config";
import { pool } from "./db";

const sql = `
CREATE TABLE IF NOT EXISTS live_races (
  user_id   integer     PRIMARY KEY REFERENCES users(id)  ON DELETE CASCADE,
  route_id  integer     NOT NULL    REFERENCES routes(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_races_route_idx ON live_races (route_id);
`;

pool
  .query(sql)
  .then(() => console.log("Done: the live_races table is ready."))
  .catch((e) => console.error("Failed:", e.message))
  .finally(() => pool.end());