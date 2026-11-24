import "dotenv/config";
import { pool } from "./db";

async function main() {
  const tables = await pool.query(
    `SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size
       FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC`
  );
  console.table(tables.rows);
  const db = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size");
  console.log(db.rows[0]);
  const counts = await pool.query(
    "SELECT (SELECT count(*) FROM routes) AS routes, (SELECT count(*) FROM runs) AS runs, (SELECT count(*) FROM run_points) AS points"
  );
  console.log(counts.rows[0]);
    const all = await pool.query(
    "SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database ORDER BY pg_database_size(datname) DESC"
  );
  console.table(all.rows);

  const people = await pool.query("SELECT id, username, created_at FROM users ORDER BY id");
  console.log("users:", people.rowCount);
  console.table(people.rows);
  const fr = await pool.query("SELECT status, count(*)::int AS n FROM friendships GROUP BY status");
  console.table(fr.rows);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});