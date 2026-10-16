import fs from "node:fs";
import path from "node:path";
import { pool } from "./db";

(async () => {
  const file = path.join(__dirname, "..", "..", "db", "schema.sql");
  await pool.query(fs.readFileSync(file, "utf8"));
  console.log("schema applied");
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});