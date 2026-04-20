const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB || "ansari_runners";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || "checkboard_scores";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in environment.");
  process.exit(1);
}

const app = express();

app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN }));
app.use(express.json({ limit: "48kb" }));

const normalizeName = (name) => String(name || "").replace(/\s+/g, " ").trim().slice(0, 32);
const toNameKey = (name) => normalizeName(name).toLowerCase();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let mongoClient = null;
let scoresCollection = null;

async function initDatabase() {
  mongoClient = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
  });

  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);
  scoresCollection = db.collection(COLLECTION_NAME);

  await Promise.all([
    scoresCollection.createIndex({ nameKey: 1 }, { unique: true }),
    scoresCollection.createIndex({ bestScore: -1, updatedAt: 1 }),
  ]);
}

app.get("/health", async (_req, res) => {
  const dbReady = Boolean(scoresCollection);
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    service: "ansari-runners-backend",
    dbReady,
  });
});

app.post("/api/scores", async (req, res) => {
  try {
    if (!scoresCollection) {
      return res.status(503).json({ ok: false, error: "Database is not ready" });
    }

    const displayName = normalizeName(req.body && req.body.name);
    const nameKey = toNameKey(displayName);
    const safeScore = Math.max(0, Math.floor(Number(req.body && req.body.score) || 0));

    if (!displayName) {
      return res.status(400).json({ ok: false, error: "Name is required" });
    }

    const now = new Date();
    const existing = await scoresCollection.findOne({ nameKey });

    if (!existing) {
      await scoresCollection.insertOne({
        nameKey,
        displayName,
        bestScore: safeScore,
        createdAt: now,
        updatedAt: now,
      });

      return res.status(201).json({
        ok: true,
        updated: true,
        bestScore: safeScore,
      });
    }

    if (safeScore > existing.bestScore) {
      await scoresCollection.updateOne(
        { nameKey },
        {
          $set: {
            displayName,
            bestScore: safeScore,
            updatedAt: now,
          },
        }
      );

      return res.json({
        ok: true,
        updated: true,
        bestScore: safeScore,
      });
    }

    await scoresCollection.updateOne(
      { nameKey },
      {
        $set: {
          displayName,
          updatedAt: now,
        },
      }
    );

    return res.json({
      ok: true,
      updated: false,
      bestScore: existing.bestScore,
    });
  } catch (error) {
    console.error("POST /api/scores failed", error);
    return res.status(500).json({ ok: false, error: "Unable to save score" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    if (!scoresCollection) {
      return res.status(503).json({ ok: false, error: "Database is not ready" });
    }

    const parsedLimit = Number.parseInt(String(req.query.limit || "50"), 10);
    const limit = clamp(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1, 100);

    const rows = await scoresCollection
      .find(
        {},
        {
          projection: {
            _id: 0,
            displayName: 1,
            bestScore: 1,
            updatedAt: 1,
          },
        }
      )
      .sort({ bestScore: -1, updatedAt: 1 })
      .limit(limit)
      .toArray();

    const entries = rows.map((row, index) => ({
      rank: index + 1,
      name: row.displayName,
      score: row.bestScore,
    }));

    return res.json({ ok: true, entries });
  } catch (error) {
    console.error("GET /api/leaderboard failed", error);
    return res.status(500).json({ ok: false, error: "Unable to load leaderboard" });
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Ansari backend running on http://0.0.0.0:${PORT}`);
    console.log(`Database: ${DB_NAME}.${COLLECTION_NAME}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});
