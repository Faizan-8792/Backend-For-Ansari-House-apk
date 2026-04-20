const assert = require("assert");

const BASE_URL = process.env.BACKEND_BASE_URL || "http://127.0.0.1:5000";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Invalid JSON from ${path}: ${text}`);
  }

  return { response, data };
}

async function run() {
  const testSuffix = Date.now();
  const firstName = `SmokeOne_${testSuffix}`;
  const secondName = `SmokeTwo_${testSuffix}`;

  let result = await request("/health");
  assert.equal(result.response.status, 200, "health check failed");
  assert.equal(result.data.ok, true, "health payload should be ok=true");

  result = await request("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: firstName, score: 120 }),
  });
  assert.equal(result.response.status, 201, "first insert should return 201");

  result = await request("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: secondName, score: 95 }),
  });
  assert.equal(result.response.status, 201, "second insert should return 201");

  result = await request("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: firstName, score: 80 }),
  });
  assert.equal(result.response.status, 200, "lower score update should return 200");
  assert.equal(result.data.bestScore, 120, "best score must remain highest");

  result = await request("/api/leaderboard?limit=20");
  assert.equal(result.response.status, 200, "leaderboard fetch failed");
  assert.equal(result.data.ok, true, "leaderboard payload should be ok=true");

  const entries = result.data.entries || [];
  const firstEntry = entries.find((entry) => entry.name === firstName);
  const secondEntry = entries.find((entry) => entry.name === secondName);

  assert.ok(firstEntry, "first test user missing from leaderboard");
  assert.ok(secondEntry, "second test user missing from leaderboard");
  assert.equal(firstEntry.score, 120, "first user best score incorrect");
  assert.equal(secondEntry.score, 95, "second user best score incorrect");
  assert.ok(firstEntry.rank < secondEntry.rank, "higher score should have better rank");

  console.log("Smoke test passed.");
}

run().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exit(1);
});
