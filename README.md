# Ansari Runners Backend (CheckBoard)

This backend stores one **best score per user** and returns leaderboard data sorted by highest score.

## 1) Setup

```bash
cd backend
npm install
cp .env.example .env
```

Set `.env` values:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=ansari_runners
MONGODB_COLLECTION=checkboard_scores
CORS_ORIGIN=*
```

## 2) Run

```bash
npm start
```

Dev mode:

```bash
npm run dev
```

## 3) API

### Health

`GET /health`

### Save score (best score logic)

`POST /api/scores`

Body:

```json
{
  "name": "Faizan",
  "score": 1234
}
```

Behavior:
- Each user has one record (name normalized to lower-case key internally).
- If new score is greater than previous best, record updates.
- If new score is lower, previous best remains unchanged.

### Leaderboard

`GET /api/leaderboard?limit=50`

Returns sorted list (highest score first):

```json
{
  "ok": true,
  "entries": [
    { "rank": 1, "name": "Faizan", "score": 1234 }
  ]
}
```

## 4) Frontend integration

In frontend, set backend URL in runtime:

```js
window.ANSARI_BACKEND_URL = "https://your-hosted-backend-url";
```

If backend is unavailable, frontend falls back to local leaderboard storage.

## 5) Smoke test

Run after backend starts:

```bash
npm run test:smoke
```

It verifies:
- database connectivity,
- score insertion,
- best-score-only behavior,
- rank sorting.
