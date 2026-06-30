import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSignalBlocks, validateSignalBlocks } from "../src/signalblocks";
import { continuityFrom, parseLogEntries, extractLogEntry } from "../src/gridMemory";
import { refine } from "../src/agents";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { runGridSignals, runGridStory } from "../src/gridEngine";

const SIGNALS = `Some narrative.

DATE: 2026-06-21
SECTOR: AI
SIGNAL: Humanoid mandate expands
METRIC: 10,000 units by 2027
IMPLICATION: Labor displacement accelerates within 6 months.
SOURCE: company announcement

DATE: 2026-06-21
SECTOR: Energy
SIGNAL: Grid storage surge
METRIC: 40% YoY
IMPLICATION: Cheaper peaking power reshapes margins.
SOURCE: market data`;

const STORYLOG = `# THE GRID — Story Log

## Installment 007 — "Tender Machines"
**Primary emotion:** Tenderness
**Core character:** Àyọ̀
**Crash Course Easter Egg:** Jiangchuan Biota. Delivery: Idle thought

## Installment 008 — "Motion Capture"
**Primary emotion:** Melancholy
**Core character:** Zhùzào
**Crash Course Easter Egg:** Cambrian Explosion. Delivery: Background texture`;

describe("signal blocks", () => {
  it("parses and validates well-formed blocks", () => {
    const blocks = parseSignalBlocks(SIGNALS);
    expect(blocks.length).toBe(2);
    expect(blocks[0].sector).toBe("AI");
    expect(blocks[0].metric).toContain("10,000");
    expect(validateSignalBlocks(blocks)).toEqual([]);
  });

  it("flags a bad sector and a number-less metric", () => {
    const problems = validateSignalBlocks([
      { date: "2026-06-21", sector: "Sportsball", signal: "x", metric: "lots", implication: "y", source: "z" }
    ]);
    expect(problems.some((p) => p.includes("SECTOR"))).toBe(true);
    expect(problems.some((p) => p.includes("METRIC"))).toBe(true);
  });
});

describe("grid continuity (rotation)", () => {
  it("computes next number, blocked lead/emotions, and the next easter method", () => {
    const c = continuityFrom(parseLogEntries(STORYLOG));
    expect(c.nextInstallment).toBe(9);
    expect(c.blockedCharacters).toEqual(["Zhùzào"]);
    expect(c.blockedEmotions).toEqual(["Tenderness", "Melancholy"]);
    expect(c.nextEasterMethod).toBe("Dialogue aside");
  });

  it("extracts a story-log entry from a finished draft", () => {
    const story = `# Title\n\nBody...\n\n## Installment 9 — "New One"\n**Primary emotion:** Wonder\n`;
    expect(extractLogEntry(story)).toContain("Installment 9");
  });
});

describe("refine loop", () => {
  it("stops once validation passes", async () => {
    let attempt = 0;
    const result = await refine({
      generate: async () => `attempt-${(attempt += 1)}`,
      validate: (text) => (text === "attempt-2" ? [] : ["not yet"])
    });
    expect(result.text).toBe("attempt-2");
    expect(result.rounds).toBe(1);
  });

  it("is bounded by maxRounds", async () => {
    const result = await refine({ generate: async () => "x", validate: () => ["always fails"], maxRounds: 2 });
    expect(result.rounds).toBe(2);
    expect(result.problems.length).toBeGreaterThan(0);
  });
});

describe("grid engine (mock mode)", () => {
  let previousKey: string | undefined;
  beforeEach(() => {
    previousKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });
  afterEach(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  it("runs signals and a story offline (critic skipped in mock)", async () => {
    const repo = new Repository(await openDatabase());
    await repo.ensureGridShow();
    const signals = await runGridSignals(repo, {});
    expect(signals.combined.length).toBeGreaterThan(0);
    const story = await runGridStory(repo, { reviewGate: "seed 1, character Sùlú, emotion Wonder", signals: signals.combined });
    expect(story.content.length).toBeGreaterThan(0);
    expect(story.rounds).toBe(0);
  });
});
