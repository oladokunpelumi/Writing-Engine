import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db";
import { Repository } from "./repository";
import { createRouter } from "./routes";
import { iconExists, iconSvg } from "./motionVisuals";

async function main() {
  const app = express();
  const port = Number(process.env.PORT ?? 4187);
  const db = await openDatabase();
  const repo = new Repository(db);
  await repo.seedDefaults();

  // Durable model profile: a Labs switch persisted in kv wins over the env
  // default, so restarts/redeploys keep the operator's last choice.
  const savedProfile = await repo.getModelProfileSetting();
  if (savedProfile) process.env.MODEL_PROFILE = savedProfile;

  app.use(cors());
  app.use(express.json({ limit: "8mb" }));

  // Generated images live in Postgres (image_assets.data bytea). Serve them
  // publicly by id (unguessable uuid) so <img> tags and exported markdown resolve
  // without auth. Mounted before the API router.
  // Lucide icons (ISC) for picture previews; public, like the icon set itself.
  app.get("/api/icons/:name", (req, res) => {
    const name = String(req.params.name).replace(/\.svg$/, "");
    if (!iconExists(name)) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(iconSvg(name, "#111827", 2));
  });

  app.get("/api/images/:id", async (req, res, next) => {
    try {
      const blob = await repo.getImageBlob(req.params.id);
      if (!blob) {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", blob.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(blob.data);
    } catch (error) {
      next(error);
    }
  });

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
    console.log(`Co-Create API running on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start Co-Create:", error);
  process.exit(1);
});
