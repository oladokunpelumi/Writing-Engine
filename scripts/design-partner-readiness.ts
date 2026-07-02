import { openDatabase } from "../server/src/db";
import { designPartnerReadiness } from "../server/src/readiness";
import { Repository } from "../server/src/repository";

async function main() {
  const db = await openDatabase();
  const repo = new Repository(db);
  const readiness = await designPartnerReadiness(repo);
  console.log(JSON.stringify(readiness, null, 2));
}

main().catch((error) => {
  console.error("Readiness check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
