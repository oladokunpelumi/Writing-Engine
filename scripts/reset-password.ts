// One-off account recovery: overwrites a user's password_hash directly, then
// immediately re-reads it and verifies the new password against it — so a shell-
// quoting mistake (a $, backtick, !, or space mangling NEW_PASSWORD in transit)
// is caught in this same run instead of surfacing later as a mysterious login
// failure. Run locally with your OWN DATABASE_URL — this script never sends the
// connection string or the new password anywhere but your own database.
//
// Usage:
//   DATABASE_URL=<your-postgres-url> EMAIL=you@example.com NEW_PASSWORD='a-strong-new-password' \
//     npx tsx scripts/reset-password.ts
import { openDatabase } from "../server/src/db";
import { Repository } from "../server/src/repository";
import { hashPassword, verifyPassword } from "../server/src/auth";

async function main() {
  const email = process.env.EMAIL;
  const newPassword = process.env.NEW_PASSWORD;
  if (!email) throw new Error("Set EMAIL to the account's email address.");
  if (!newPassword || newPassword.length < 8) throw new Error("Set NEW_PASSWORD (8+ characters).");
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Postgres connection string.");

  // Echoed so you can visually confirm the shell passed through exactly what you
  // typed — this is the single fastest way to catch $VAR expansion, backtick
  // command substitution, or word-splitting mangling the password in transit.
  console.log(`Received NEW_PASSWORD exactly as: "${newPassword}" (length ${newPassword.length})`);

  const db = await openDatabase();
  const repo = new Repository(db);

  const user = await repo.getUserByEmail(email);
  if (!user) throw new Error(`No user found for EMAIL=${email}.`);

  const passwordHash = hashPassword(newPassword);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);

  // Self-check: re-read what was just written and confirm it verifies, in this
  // same process, before declaring success.
  const reloaded = await repo.getUserByEmail(email);
  const confirmed = reloaded ? verifyPassword(newPassword, reloaded.passwordHash) : false;
  if (!confirmed) {
    throw new Error("Wrote a new hash, but it did not verify back against the same NEW_PASSWORD — this should not happen. Stop and report this.");
  }

  console.log(`Password reset AND verified for ${email}. Log in with the exact string shown above.`);
}

main().catch((error) => {
  console.error("Password reset failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
