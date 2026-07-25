// Diagnostic: checks a candidate password against the CURRENTLY stored hash for
// an account, using the exact same verifyPassword() the login route calls.
// Bypasses the web UI/network entirely, so a mismatch here means the stored hash
// itself doesn't match what you expect — not a sign-in code path problem.
//
// Usage:
//   DATABASE_URL=<your-postgres-url> EMAIL=you@example.com CANDIDATE_PASSWORD='what-you-are-typing-at-login' \
//     npx tsx scripts/verify-password.ts
import { openDatabase } from "../server/src/db";
import { Repository } from "../server/src/repository";
import { verifyPassword } from "../server/src/auth";

async function main() {
  const email = process.env.EMAIL;
  const candidate = process.env.CANDIDATE_PASSWORD;
  if (!email) throw new Error("Set EMAIL to the account's email address.");
  if (!candidate) throw new Error("Set CANDIDATE_PASSWORD to the password you are trying to log in with.");
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to your Postgres connection string.");

  const db = await openDatabase();
  const repo = new Repository(db);
  const user = await repo.getUserByEmail(email);
  if (!user) {
    console.log(`No user found for EMAIL=${email}. (This alone would explain a rejected login.)`);
    return;
  }

  console.log(`Found user id=${user.id}, stored email="${user.email}".`);
  console.log(`Stored password_hash format looks valid: ${/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(user.passwordHash)}`);
  const matches = verifyPassword(candidate, user.passwordHash);
  console.log(matches ? "MATCH: this password verifies against the stored hash — the DB is fine." : "NO MATCH: this password does NOT verify against the stored hash.");
}

main().catch((error) => {
  console.error("Verify failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
