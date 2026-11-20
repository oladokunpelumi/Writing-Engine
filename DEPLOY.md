# Deploying Co-Create on Railway

One Docker service serves the API + the built client from a single URL. State lives
in a managed **PostgreSQL** database — including generated images (stored as bytes
and served from `/api/images/:id`), so there's no volume to mount and nothing is
lost on redeploy. Access is **invite-only**.

## Architecture

- **Single service**: Express serves `/api/*` and the static client build on one origin — no CORS.
- **Storage**: PostgreSQL via `DATABASE_URL`. Structured data *and* image bytes live there (single source of truth).
- **Dev/test**: with no `DATABASE_URL`, the app runs on [pglite](https://pglite.dev) (in-process Postgres) — same dialect, no server, so local dev + the test suite need zero setup.
- **Runtime**: Node 22, `tsx` runs the TypeScript server directly.

## One-time deploy

1. **Push the repo to GitHub.**
2. In **Railway → New Project → Deploy from GitHub repo**, pick this repo. Railway reads `railway.json` and builds the `Dockerfile`.
3. **Add a database**: in the project, **New → Database → PostgreSQL**. Railway creates it and exposes its connection string.
4. **Wire it up**: on the app service → **Variables**, add `DATABASE_URL` and set it to a reference to the Postgres service — `${{Postgres.DATABASE_URL}}` (Railway resolves this to the internal connection string). Internal networking doesn't need SSL; if you use a public/proxied URL instead, also set `DATABASE_SSL=require`.
5. **Set the rest of the variables** (app service → Variables):
   - `AUTH_REQUIRED=true`
   - `INVITE_CODE=<a phrase you share only with people you want to let in>`
   - `JWT_SECRET=<a long random string>`
   - `OPENROUTER_API_KEY=<your key>`
   - model routing + flags (optional; sane defaults exist): `MODEL_DRAFT`, `MODEL_SHARPEN`, `MODEL_IMAGE`, `ENABLE_PROMPT_CACHE=true`, `MAX_OUTPUT_TOKENS=4000`, …
6. Railway builds and boots; the app runs `migrate()` on first connect (creates all tables). Open the service URL → **login screen** → **Create account** with your email/password **+ the invite code**.

> Railway injects `PORT` automatically; the server already reads it. The health check is `/api/health`.

## Migrate your existing data (optional)

If you have a local SQLite database to bring over, run the one-time script against
the Railway Postgres (grab the public connection string from the Postgres service →
Connect):

```bash
DATABASE_URL="postgresql://…railway…" \
DATABASE_SSL=require \
OLD_SQLITE=.data/gbedu-desk.sqlite \
OLD_IMAGE_DIR=server/data/images \
npx tsx scripts/migrate-sqlite-to-pg.ts
```

It copies every table and loads your on-disk images into Postgres as bytes.

## Run it locally

```bash
npm install
npm run dev          # pglite-backed, mock AI unless OPENROUTER_API_KEY is set
```

To exercise the production path locally, point it at any Postgres:

```bash
DATABASE_URL="postgresql://localhost:5432/cocreate" npm start
# open http://localhost:4187
```

With no `DATABASE_URL`, dev/start use pglite. Set `PGLITE_PATH=.data/pg` to persist
the local pglite database to disk (otherwise it's in-memory).

## Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Railway: `${{Postgres.DATABASE_URL}}`). Unset → pglite locally. |
| `DATABASE_SSL` | `require` to enable TLS for the pg client (public/proxied URLs). |
| `PGLITE_PATH` | Where pglite persists locally (dev only; unset = in-memory). |
| `AUTH_REQUIRED=true` | Gate the app behind login. **Keep on** for a public URL. |
| `INVITE_CODE` | Required to register. Rotate anytime to stop new signups. |
| `JWT_SECRET` | Signs session tokens. |
| `OPENROUTER_API_KEY` | Your key — this is the spend. |
| `MAX_OUTPUT_TOKENS` | Caps output tokens per call (cost guardrail). |
| `MODEL_*` | Per-stage model routing (any OpenRouter slug). |
| `MODEL_VIDEO_INGEST` | Optional multimodal OCR model override. |
| `MODEL_VIDEO_TREATMENT` | Optional treatment/visual-bible model override. |
| `MODEL_VIDEO_SCRIPT` | Optional master-script model override. |
| `MODEL_VIDEO_ADAPTATION` | Optional platform-adaptation model override. |
| `MODEL_VIDEO_SHOTS` | Optional shot-prompt model override. |
| `MODEL_IMAGE` | Storyboard keyframe image model. |
| `IMAGE_COST_USD` | Fallback cost estimate when the image provider omits cost. |

## Video Studio release checklist

- Keep `AUTH_REQUIRED=true`; uploads and private evidence/storyboard previews require authenticated requests.
- Confirm database backups inherit the same access controls and retention policy as the primary database.
- Verify source deletion removes its extracted chunks and evidence previews; project deletion removes all Video Studio assets.
- Use a non-confidential fixture for staging AI smoke tests. The local Fabrizio/Pletti acceptance test copies the private source to temporary storage and never commits it.
- Start with invite-only access. External AI processing requires explicit consent on each project, and link verification remains opt-in.

## Updating

Push to the default branch → Railway rebuilds and redeploys. The Postgres database
(your data + images) is untouched across deploys.

> A Render blueprint (`render.yaml`) is also included as a secondary option — it
> likewise expects a managed Postgres via `DATABASE_URL` (no disk).
