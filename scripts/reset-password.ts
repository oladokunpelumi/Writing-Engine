// One-off account recovery: overwrites a user's password_hash directly.
// Run locally with your OWN DATABASE_URL — this script never sends the
// connection string or the new password anywhere but your own database.
//
// Usage:
//   DATABASE_URL=<your-postgres-url> EMAIL=you@example.com NEW_PASSWORD='a-strong-new-password' \
//     npx tsx scripts/reset-password.ts
import { openDatabase } from "../server/src/db";
import { Repository } from "../server/src/repository";
import { hashPassword } from "../server/src/auth";

async function main() {
  const email = process.env.EMAIL;
  const newPassword = process.env.NEW_PASSWORD;
  if (!email) throw new Error("Set EMAIL to the account's email address.");
  if (!newPassword || newPassword.length < 8) throw new Error("Set NEW_PASSWORD (8+ characters).");
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Postgres connection string.");

  const db = await openDatabase();
  const repo = new Repository(db);

  const user = await repo.getUserByEmail(email);
  if (!user) throw new Error(`No user found for EMAIL=${email}.`);

  const passwordHash = hashPassword(newPassword);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);

  console.log(`Password reset for ${email}. Log in with the new password now.`);
}

main().catch((error) => {
  console.error("Password reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
