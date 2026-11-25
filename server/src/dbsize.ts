import "dotenv/config";
import { pool } from "./db";

async function main() {
  // Sizes
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

  // People and friendships
  const people = await pool.query("SELECT id, username, created_at FROM users ORDER BY id");
  console.log("users:", people.rowCount);
  console.table(people.rows);
  const byStatus = await pool.query("SELECT status, count(*)::int AS n FROM friendships GROUP BY status");
  console.table(byStatus.rows);
  const pairs = await pool.query(
    `SELECT a.username AS requester, b.username AS addressee, f.status
       FROM friendships f
       JOIN users a ON a.id = f.requester_id JOIN users b ON b.id = f.addressee_id ORDER BY f.id`
  );
  console.table(pairs.rows);

  // Routes
  const rr = await pool.query(
    `SELECT r.id, r.name, r.visibility, r.status, u.username AS creator
       FROM routes r LEFT JOIN users u ON u.id = r.creator_id ORDER BY r.id`
  );
  console.table(rr.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});