import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Check that server/.env exists, then stop the server with Ctrl+C and run `npm run dev` again.");
}

// Aiven's own URL ends in "?sslmode=require", which makes the driver
// ignore the certificate below. Remove it if it's there.
let url: URL;
try {
    url = new URL(connectionString);
} catch {
    // Do not let Node print the raw value: it contains the password.
    throw new Error("DATABASE_URL in server/.env is not a valid URL. Expected postgres://avnadmin:PASSWORD@HOST:PORT/ghostracer");
}
url.searchParams.delete("sslmode");

const caPath = process.env.DATABASE_CA_CERT_PATH || path.join(__dirname, "..", "ca.pem");
if (!fs.existsSync(caPath)) {
    throw new Error(
        `Database CA certificate not found at ${caPath}. Download the Aiven CA certificate as server/ca.pem, or set DATABASE_CA_CERT_PATH in server/.env.`,
    );
}

export const pool = new Pool({
    connectionString: url.toString(),
    ssl: {
        ca: fs.readFileSync(caPath, "utf8"),
    },
    max: 3, // the Aiven free plan allows about 20 connections in total, shared by the whole team
    connectionTimeoutMillis: 10_000, // give up after 10 s instead of hanging
});

// Without this listener, a connection dropped by the server while idle crashes the whole process.
pool.on("error", (err) => {
    console.error("Idle database connection error:", err.message);
});
