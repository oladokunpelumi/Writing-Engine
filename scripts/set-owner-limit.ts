import { openDatabase } from "../server/src/db";
import { Repository } from "../server/src/repository";

function optionalNumber(name: string) {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number.`);
  return parsed;
}

async function main() {
  const db = await openDatabase();
  const repo = new Repository(db);

  let ownerId = process.env.OWNER_ID;
  if (!ownerId && process.env.EMAIL) {
    const user = await repo.getUserByEmail(process.env.EMAIL);
    if (!user) throw new Error(`No user found for EMAIL=${process.env.EMAIL}.`);
    ownerId = user.id;
  }
  if (!ownerId) throw new Error("Set OWNER_ID or EMAIL.");

  const limit = await repo.setUsageLimitForOwner(ownerId, {
    dailyLimitUsd: optionalNumber("DAILY_LIMIT_USD"),
    monthlyLimitUsd: optionalNumber("MONTHLY_LIMIT_USD"),
    disabled: process.env.DISABLED === "true"
  });
  console.log(JSON.stringify(limit, null, 2));
}

main().catch((error) => {
  console.error("Set owner limit failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
