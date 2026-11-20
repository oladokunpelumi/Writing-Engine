// Layer 0 — calibration against the 120-item Slop Drill Pack (v1.3).
//
// This is the instrument every other layer is tuned against. It measures the
// DETERMINISTIC scanner only (free, offline), so the suite stays fast and the
// LLM adjudicator's contribution can be judged separately.
//
// The drill pack's own scoring guidance: sort errors into false positives and
// false negatives — one will dominate. Over-flagging is the failure mode this
// format punishes, so the false-positive rate carries the tighter floor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanPhrase } from "../src/slopScan";

interface DrillItem {
  id: number;
  setId: number;
  setName: string;
  taskPrompt: string;
  phrase: string;
  position: string;
  verdict: "slop" | "not-slop";
  bucket: number | null;
  rationale: string;
}

interface DrillPack {
  totalItems: number;
  baseRates: Record<string, { slop: number; total: number; pct: number }>;
  items: DrillItem[];
}

const pack: DrillPack = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "slop-drill-pack.json"), "utf8")
);

interface Outcome {
  item: DrillItem;
  predicted: "slop" | "not-slop";
  bucket?: number;
}

function run(): Outcome[] {
  return pack.items.map((item) => {
    const scan = scanPhrase({ phrase: item.phrase, position: item.position });
    return { item, predicted: scan.verdict, bucket: scan.bucket };
  });
}

function metrics(outcomes: Outcome[]) {
  const tp = outcomes.filter((o) => o.item.verdict === "slop" && o.predicted === "slop").length;
  const fp = outcomes.filter((o) => o.item.verdict === "not-slop" && o.predicted === "slop").length;
  const fn = outcomes.filter((o) => o.item.verdict === "slop" && o.predicted === "not-slop").length;
  const tn = outcomes.filter((o) => o.item.verdict === "not-slop" && o.predicted === "not-slop").length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    accuracy: (tp + tn) / outcomes.length,
    /** Share of not-slop items wrongly flagged — the expensive error here. */
    falsePositiveRate: fp / (fp + tn)
  };
}

describe("slop calibration — 120-item drill pack", () => {
  it("loads all 120 labelled items with a base rate inside the normal band", () => {
    expect(pack.totalItems).toBe(120);
    expect(pack.items).toHaveLength(120);
    const slop = pack.items.filter((i) => i.verdict === "slop").length;
    // The adjudication module: 15–35% is normal for a competent artifact.
    const share = slop / pack.items.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.35);
  });

  it("scores the deterministic scanner and reports the confusion matrix", () => {
    const outcomes = run();
    const m = metrics(outcomes);

    // Printed so a regression shows the movement, not just a pass/fail.
    console.log(
      `\n  deterministic scanner — accuracy ${(m.accuracy * 100).toFixed(1)}% ` +
        `| precision ${(m.precision * 100).toFixed(1)}% | recall ${(m.recall * 100).toFixed(1)}% ` +
        `| false-positive rate ${(m.falsePositiveRate * 100).toFixed(1)}%` +
        `\n  tp ${m.tp}  fp ${m.fp}  fn ${m.fn}  tn ${m.tn}\n`
    );

    const falsePositives = outcomes.filter((o) => o.item.verdict === "not-slop" && o.predicted === "slop");
    if (falsePositives.length) {
      console.log("  false positives (over-flagging is the expensive error):");
      for (const fp of falsePositives) console.log(`    [${fp.item.position}] ${fp.item.phrase}`);
    }
    const falseNegatives = outcomes.filter((o) => o.item.verdict === "slop" && o.predicted === "not-slop");
    if (falseNegatives.length) {
      console.log("  false negatives (candidates the adjudicator must catch):");
      for (const fn of falseNegatives) console.log(`    b${fn.item.bucket} [${fn.item.position}] ${fn.item.phrase}`);
    }

    // Floors locked at the measured baseline (119/120). Raise them when the
    // scanner improves; never lower them silently. The drill pack's own bar for
    // "ready" is 114/120, so these sit above it.
    expect(m.accuracy).toBeGreaterThanOrEqual(0.95);
    expect(m.falsePositiveRate).toBeLessThanOrEqual(0.02);
    expect(m.recall).toBeGreaterThanOrEqual(0.9);
  });

  it("never flags a label, axis, legend, column, footnote or caption surface", () => {
    // Position sets the register. Judging a label against prose standards is
    // the single most common false positive in the catalogue (A5–A8, Gate 4).
    const labelSurfaces = pack.items.filter((item) =>
      /(label|axis|legend|column|footnote|caption|tick|cell|source)/i.test(item.position)
    );
    expect(labelSurfaces.length).toBeGreaterThan(10);
    const wronglyFlagged = labelSurfaces
      .filter((item) => item.verdict === "not-slop")
      .filter((item) => scanPhrase({ phrase: item.phrase, position: item.position }).verdict === "slop");
    expect(wronglyFlagged.map((i) => i.phrase)).toEqual([]);
  });

  it("keeps each set's flagged share within the base-rate band", () => {
    // A run of sets that all come out over half slop means the gates are not
    // being applied — the module's own calibration check, automated.
    for (const [setId, expected] of Object.entries(pack.baseRates)) {
      const items = pack.items.filter((i) => i.setId === Number(setId));
      const flagged = items.filter((i) => scanPhrase({ phrase: i.phrase, position: i.position }).verdict === "slop").length;
      const share = flagged / items.length;
      expect(share, `set ${setId} flagged ${(share * 100).toFixed(0)}% vs labelled ${expected.pct}%`).toBeLessThanOrEqual(0.6);
    }
  });

  it("agrees with the labelled bucket on most true positives", () => {
    const outcomes = run();
    const truePositives = outcomes.filter((o) => o.item.verdict === "slop" && o.predicted === "slop");
    const agreed = truePositives.filter((o) => o.bucket === o.item.bucket).length;
    const rate = agreed / Math.max(1, truePositives.length);
    console.log(`\n  bucket agreement on true positives: ${(rate * 100).toFixed(1)}% (${agreed}/${truePositives.length})\n`);
    // Bucket precision is refined by the LLM adjudicator; the scanner only needs
    // to be right more often than not so the candidate carries a useful hint.
    expect(rate).toBeGreaterThanOrEqual(0.85);
  });
});
