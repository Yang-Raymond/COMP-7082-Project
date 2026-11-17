import { Client } from "pg";

const url = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]*/, "");

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(process.argv[2]);
  console.table(rows);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });