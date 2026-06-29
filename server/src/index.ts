import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db";
import { Repository } from "./repository";
import { createRouter } from "./routes";
import { imageDir } from "./images";

const app = express();
const port = Number(process.env.PORT ?? 4187);
const repo = new Repository(openDatabase());
repo.seedDefaults();

app.use(cors());
app.use(express.json({ limit: "8mb" }));
// Serve file-backed generated images. Mounted before the API router so a GET to
// /api/images/<file> resolves to disk first.
app.use("/api/images", express.static(imageDir()));
app.use("/api", createRouter(repo));

// Production single-service: serve the built client from the same origin as the
// API (so the client's relative /api calls just work — no CORS, one URL). Only
// active when a build exists, so dev (Vite) and tests are unaffected.
const clientDist = process.env.CLIENT_DIST ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback for any non-API route.
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(clientDist, "index.html")));
}

app.listen(port, () => {
  console.log(`Gbedu Desk API running on http://localhost:${port}`);
});
