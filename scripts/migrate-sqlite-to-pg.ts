// One-time migration: copy an existing node:sqlite database into Postgres.
//
//   DATABASE_URL=<railway-postgres-url> \
//   OLD_SQLITE=.data/gbedu-desk.sqlite \
//   OLD_IMAGE_DIR=server/data/images \
//   npx tsx scripts/migrate-sqlite-to-pg.ts
//
// Tables are copied generically (every column the old DB has maps 1:1 to the new
// schema, which only ADDED columns). image_assets is special-cased: the old rows
// reference image files on disk; their bytes are loaded into the new bytea column
// and the served URL is rewritten to /api/images/<id>.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../server/src/db";

function guessMime(file: string): string {
  if (/\.jpe?g$/i.test(file)) return "image/jpeg";
  if (/\.webp$/i.test(file)) return "image/webp";
  if (/\.svg$/i.test(file)) return "image/svg+xml";
  return "image/png";
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the target Postgres.");
  const oldPath = process.env.OLD_SQLITE ?? ".data/gbedu-desk.sqlite";
  const imageDir = process.env.OLD_IMAGE_DIR ?? "server/data/images";

  const old = new DatabaseSync(oldPath);
  const db = await openDatabase(); // DATABASE_URL set → Postgres; runs migrate() (creates tables)

  const tables = (old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>)
    .map((row) => row.name);

  for (const table of tables) {
    if (table === "image_assets") continue; // handled below
    const rows = old.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
    let copied = 0;
    for (const row of rows) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`;
      try {
        await db.prepare(sql).run(...cols.map((c) => row[c]));
        copied += 1;
      } catch (error) {
        console.warn(`  ! ${table}: skipped a row — ${(error as Error).message}`);
      }
    }
    console.log(`${table}: ${copied}/${rows.length}`);
  }

  // image_assets: load bytes from disk into bytea, rewrite url to /api/images/<id>.
  const imgs = old.prepare("SELECT * FROM image_assets").all() as Array<Record<string, any>>;
  let withBytes = 0;
  for (const row of imgs) {
    let data: Buffer | null = null;
    let mime: string | null = null;
    let url = String(row.url ?? "");
    const match = /^\/api\/images\/(.+)$/.exec(url);
    if (match) {
      try {
        data = readFileSync(join(imageDir, match[1]));
        mime = guessMime(match[1]);
        url = `/api/images/${row.id}`;
        withBytes += 1;
      } catch {
        // file missing — keep the row, leave data null
      }
    }
    await db
      .prepare(
        `INSERT INTO image_assets (id, owner_id, post_id, prompt, url, provider, role, style, caption, data, mime, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`
      )
      .run(
        row.id,
        row.owner_id ?? "owner-default",
        row.post_id ?? null,
        row.prompt ?? "",
        url,
        row.provider ?? "openrouter",
        row.role ?? null,
        row.style ?? null,
        row.caption ?? null,
        data,
        mime,
        row.created_at ?? new Date().toISOString()
      );
  }
  console.log(`image_assets: ${imgs.length} rows (${withBytes} with bytes loaded)`);

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
