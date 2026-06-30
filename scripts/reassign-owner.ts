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
  "brief_seeds", "repurpose_packages", "voice_profiles", "shows", "experiments", "territories"
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
    const rows = await db.prepare(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ? RETURNING id`).all(newOwner, oldOwner);
    console.log(`  ${table}: ${rows.length}`);
  }

  // Owner-namespaced kv keys (activeVoiceId:<owner>, activeShowId:<owner>,
  // gridBible:<owner>, gridStoryLog:<owner>) — rewrite the suffix.
  const kv = await db
    .prepare("UPDATE kv SET key = regexp_replace(key, ':' || ? || '$', ':' || ?) WHERE key LIKE ? RETURNING key")
    .all(oldOwner, newOwner, `%:${oldOwner}`);
  console.log(`  kv keys: ${kv.length}`);

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Reassign failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
