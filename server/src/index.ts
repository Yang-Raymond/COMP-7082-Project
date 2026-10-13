import express from "express";
import { pool } from "./db";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ok: true});
});

app.get("/health/db", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT now() AS time, current_database() AS database, (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis"
        );
        res.json({ok: true, ...result.rows[0]});
    } catch (err) {
        console.error("GET /health/db failed:", err);
        res.status(500).json({ok: false, error: "Database check failed. See the server terminal for the reason."});
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});