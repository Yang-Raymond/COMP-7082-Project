import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const file = process.argv[2] ?? "db/schema.sql";
const sql = fs.readFileSync(path.resolve(file), "utf8");

// Strip ?sslmode=... so it doesn't override the ssl option below
const url = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]*/, "");

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }, // fine for a one-off setup script
  });
  await client.connect();
  await client.query(sql); // no parameters, so multiple statements are allowed
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1"
  );
  console.log("Tables:", rows.map((r) => r.table_name).join(", "));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});