#!/usr/bin/env node
// Hero video shots for a motion story, under the story's picture cap.
//
//   node work/motion-kit/shots.mjs [pieceDir] [--dry]
//
// For each beat whose picture is a hero video shot, takes the finished still
// (assets/visuals/<beat>.png) as the first frame and asks HyperFrames to move it
// (`media-use generate --type video`, your HyperFrames sign-in). Each shot is
// priced first with --plan; a shot that would pass what is left of the cap
// (story.json pictures.budgetUsd - spentUsd - shots already made) is skipped.
// Spend is kept in work/shots-spend.json. Then rebuild: node work/motion-kit/build.mjs .

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const PIECE = resolve(argv.find((a) => !a.startsWith("--")) ?? ".");
const DRY = argv.includes("--dry");
const story = JSON.parse(readFileSync(join(PIECE, "story.json"), "utf8"));
const ledgerPath = join(PIECE, "work", "shots-spend.json");
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : { shots: [] };
const spentOnShots = ledger.shots.reduce((sum, s) => sum + (s.usd ?? 0), 0);
const budget = story.pictures?.budgetUsd ?? 3;
let remaining = budget - (story.pictures?.spentUsd ?? 0) - spentOnShots;
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" };
const cli = (args) => execFileSync("npx", ["--yes", "hyperframes@0.8.223", ...args], { cwd: PIECE, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const usdFrom = (text) => {
  const m = text.match(/"usd"\s*:\s*([0-9.]+)/) ?? text.match(/usd[^0-9]{0,12}([0-9]+\.[0-9]+)/i);
  return m ? Number(m[1]) : undefined;
};

let made = 0;
for (const beat of story.beats) {
  const shot = beat.visual?.video;
  if (!shot) continue;
  const still = join(PIECE, beat.visual.file);
  const out = join(PIECE, shot.file);
  if (existsSync(out)) {
    console.log(`${beat.id}: shot already exists`);
    continue;
  }
  if (!existsSync(still)) {
    console.log(`${beat.id}: no still to start from (generate pictures in Co-Create first)`);
    continue;
  }
  const seconds = String(Math.max(5, Math.min(10, Math.round(shot.seconds ?? 5))));
  const args = ["media-use", "generate", "--type", "video", "--first-frame", still, "--prompt", shot.prompt, "--seconds", seconds, "--aspect", "9:16", "--out", out];
  const plan = cli([...args, "--plan"]);
  const usd = usdFrom(plan);
  if (usd === undefined) {
    console.log(`${beat.id}: could not read the planned cost; not generating. Plan output:\n${plan}`);
    continue;
  }
  if (usd > remaining + 1e-9) {
    console.log(`${beat.id}: skipped, it would pass the $${budget.toFixed(2)} cap for this story.`);
    continue;
  }
  if (DRY) {
    console.log(`${beat.id}: fits the cap (dry run, nothing generated).`);
    continue;
  }
  mkdirSync(join(PIECE, "assets", "visuals"), { recursive: true });
  cli(args);
  remaining -= usd;
  ledger.shots.push({ beat: beat.id, usd, seconds: Number(seconds), at: new Date().toISOString() });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
  made += 1;
  console.log(`${beat.id}: hero shot made -> ${shot.file}`);
}
console.log(made ? `Made ${made} shot(s). Rebuild: node work/motion-kit/build.mjs .` : "No new shots.");
