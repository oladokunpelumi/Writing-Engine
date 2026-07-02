// Reassign all content from one owner to another (e.g. migrated `owner-default`
// rows → your real account after you register on an auth-enabled deploy).
//
//   DATABASE_URL=postgresql://…railway… \
//   NEW_EMAIL=you@example.com \              # looks up the user id; or set NEW_OWNER directly
//   OLD_OWNER=owner-default \                # default
//   npx tsx scripts/reassign-owner.ts
import { openDatabase } from "../server/src/db";

// Every table that carries an owner_id column (see db.ts).
const OWNED_TABLES = [
  "posts", "topic_ideas", "seo_packages", "image_assets", "schedule_entries",
  "generation_records", "voice_distillations", "corpus_sources", "corpus_segments",
  "brief_seeds", "repurpose_packages", "voice_profiles", "shows", "experiments", "territories",
  "usage_limits", "activation_events", "partner_feedback"
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to the target Postgres.");
  const oldOwner = process.env.OLD_OWNER ?? "owner-default";
  const db = await openDatabase();

  let newOwner = process.env.NEW_OWNER;
  if (!newOwner && process.env.NEW_EMAIL) {
    const row = await db.prepare("SELECT id FROM users WHERE email = ?").get<{ id: string }>(process.env.NEW_EMAIL);
    if (!row?.id) throw new Error(`No user found with email ${process.env.NEW_EMAIL} — register first.`);
    newOwner = String(row.id);
  }
  if (!newOwner) throw new Error("Set NEW_OWNER or NEW_EMAIL.");
  if (newOwner === oldOwner) throw new Error("NEW_OWNER equals OLD_OWNER; nothing to do.");

  console.log(`Reassigning content: ${oldOwner} → ${newOwner}`);
  for (const table of OWNED_TABLES) {
    // RETURNING owner_id (not id): every owned table has owner_id by definition,
    // but some (e.g. usage_limits, keyed by owner) have no id column.
    const rows = await db.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ? RETURNING owner_id`).all(newOwner, oldOwner);
    console.log(`  ${table}: ${rows.length}`);
  }

  // Owner-namespaced kv keys (activeVoiceId:<owner>, activeShowId:<owner>,
  // gridBible:<owner>, gridStoryLog:<owner>) — rewrite the suffix. The new owner
  // may already have auto-created rows (registering seeds an active voice/show),
  // so upsert with the MIGRATED value winning, then remove the old-owner row.
  const kvRows = await db.prepare("SELECT key, value FROM kv WHERE key LIKE ?").all<{ key: string; value: string }>(`%:${oldOwner}`);
  for (const row of kvRows) {
    const newKey = row.key.slice(0, -oldOwner.length) + newOwner;
    await db
      .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value")
      .run(newKey, row.value);
    await db.prepare("DELETE FROM kv WHERE key = ?").run(row.key);
  }
  console.log(`  kv keys: ${kvRows.length}`);

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Reassign failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
