import express from "express";
import cors from "cors";
import pg from "pg";
import { randomUUID } from "node:crypto";
import "dotenv/config";

const { Pool, Client } = pg;

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/timelinegen";

async function ensureDatabaseExists(connectionString) {
  // Parse out the target database name so we can connect to the maintenance DB
  // and CREATE DATABASE if it doesn't already exist.
  const url = new URL(connectionString);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!dbName) return;
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (!rows.length) {
      console.log(`[server] Creating database "${dbName}"...`);
      // CREATE DATABASE can't be parameterized; quote the identifier safely.
      const safe = '"' + dbName.replace(/"/g, '""') + '"';
      await admin.query(`CREATE DATABASE ${safe}`);
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function init() {
  await ensureDatabaseExists(DATABASE_URL);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timelines (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'Untitled',
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS timelines_updated_at_idx ON timelines (updated_at DESC);`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comparisons (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'Untitled comparison',
      data        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS comparisons_updated_at_idx ON comparisons (updated_at DESC);`,
  );
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// List
app.get("/api/timelines", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, created_at, updated_at,
              COALESCE(jsonb_array_length(data->'rows'), 0) AS row_count
         FROM timelines
        ORDER BY updated_at DESC`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        rowCount: r.row_count,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Get one
app.get("/api/timelines/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, data, created_at, updated_at
         FROM timelines WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      timeline: r.data,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Create
app.post("/api/timelines", async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id || randomUUID();
    const name = body.name || body.timeline?.name || "Untitled";
    const data = body.timeline || body.data || { id, name, mode: "duration", pxPerDay: 12, rows: [], brackets: [], guides: [] };
    // Ensure data.id matches
    data.id = id;
    data.name = name;
    const { rows } = await pool.query(
      `INSERT INTO timelines (id, name, data) VALUES ($1, $2, $3)
       RETURNING id, name, created_at, updated_at`,
      [id, name, data],
    );
    const r = rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      timeline: data,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Update (full upsert of timeline body)
app.put("/api/timelines/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const data = body.timeline || body.data;
    if (!data) return res.status(400).json({ error: "Missing timeline body" });
    data.id = id;
    const name = body.name || data.name || "Untitled";
    const { rows } = await pool.query(
      `INSERT INTO timelines (id, name, data, updated_at)
         VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             data = EXCLUDED.data,
             updated_at = NOW()
       RETURNING id, name, created_at, updated_at`,
      [id, name, data],
    );
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      timeline: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Rename only
app.patch("/api/timelines/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const name = req.body?.name;
    if (!name) return res.status(400).json({ error: "Missing name" });
    const { rows } = await pool.query(
      `UPDATE timelines
          SET name = $2,
              data = jsonb_set(data, '{name}', to_jsonb($2::text)),
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, created_at, updated_at`,
      [id, name],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Duplicate
app.post("/api/timelines/:id/duplicate", async (req, res) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query(
      `SELECT name, data FROM timelines WHERE id = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const newId = randomUUID();
    const newName = `${rows[0].name} (copy)`;
    const data = { ...rows[0].data, id: newId, name: newName };
    const inserted = await pool.query(
      `INSERT INTO timelines (id, name, data) VALUES ($1, $2, $3)
       RETURNING id, name, created_at, updated_at`,
      [newId, newName, data],
    );
    const r = inserted.rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      timeline: data,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Delete timeline
app.delete("/api/timelines/:id", async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM timelines WHERE id = $1`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// --------------------------------------------------------------------------
// Comparisons (saved multi-timeline views)
// data shape: {
//   timelineIds: string[],
//   positions:   Record<string, { x: number, y: number }>,
//   pxPerDayOverride: number | null,
//   viewZoom:    number,
//   hiddenLegends: string[],
// }
// --------------------------------------------------------------------------

function normalizeComparisonData(input) {
  const d = (input && typeof input === "object" ? input : {});
  return {
    timelineIds: Array.isArray(d.timelineIds)
      ? d.timelineIds.filter((x) => typeof x === "string")
      : [],
    positions:
      d.positions && typeof d.positions === "object" && !Array.isArray(d.positions)
        ? d.positions
        : {},
    pxPerDayOverride:
      typeof d.pxPerDayOverride === "number" ? d.pxPerDayOverride : null,
    viewZoom: typeof d.viewZoom === "number" ? d.viewZoom : 1,
    hiddenLegends: Array.isArray(d.hiddenLegends)
      ? d.hiddenLegends.filter((x) => typeof x === "string")
      : [],
  };
}

// List comparisons
app.get("/api/comparisons", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, data, created_at, updated_at
         FROM comparisons
        ORDER BY updated_at DESC`,
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        timelineIds: Array.isArray(r.data?.timelineIds) ? r.data.timelineIds : [],
      })),
    );
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Get one comparison
app.get("/api/comparisons/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, data, created_at, updated_at FROM comparisons WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      data: normalizeComparisonData(r.data),
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Create comparison
app.post("/api/comparisons", async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id || randomUUID();
    const name = body.name || "Untitled comparison";
    const data = normalizeComparisonData(body.data);
    if (data.timelineIds.length < 2) {
      return res.status(400).json({ error: "A comparison needs at least 2 timeline ids" });
    }
    const { rows } = await pool.query(
      `INSERT INTO comparisons (id, name, data) VALUES ($1, $2, $3)
       RETURNING id, name, created_at, updated_at`,
      [id, name, data],
    );
    const r = rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      data,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Update (upsert) comparison
app.put("/api/comparisons/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const data = normalizeComparisonData(body.data);
    const name = body.name || "Untitled comparison";
    const { rows } = await pool.query(
      `INSERT INTO comparisons (id, name, data, updated_at)
         VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             data = EXCLUDED.data,
             updated_at = NOW()
       RETURNING id, name, created_at, updated_at`,
      [id, name, data],
    );
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      data,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Rename comparison
app.patch("/api/comparisons/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const name = req.body?.name;
    if (!name) return res.status(400).json({ error: "Missing name" });
    const { rows } = await pool.query(
      `UPDATE comparisons SET name = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, name, created_at, updated_at`,
      [id, name],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Delete comparison
app.delete("/api/comparisons/:id", async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM comparisons WHERE id = $1`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] TimelineGenerator API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[server] Failed to initialize DB:", err);
    process.exit(1);
  });

