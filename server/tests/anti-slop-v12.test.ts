// Anti-slop v1.2 behaviour on top of the adjudicated gate: F/V/W/R primary
// codes chosen by root cause (V > W > F > R, specific evidence first), and
// severity / confidence / frequency on every finding. Low-confidence signals
// are shown to the writer but never move the verdict.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdjudicatedFindingSchema, type AdjudicationReport } from "../../shared/src";
import { adjudicatePiece, drivingFindings } from "../src/adjudicate";
import { openDatabase } from "../src/db";
import { publishVerdict } from "../src/publishGate";
import { ownerContext } from "../src/context";
import { Repository } from "../src/repository";
import { scanPhrase } from "../src/slopScan";

const savedKey = process.env.OPENROUTER_API_KEY;
beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY; // the deterministic leg only
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = savedKey;
});

const SAMPLE = `# Unlocking Tomorrow's Potential

Momentum is building across the business. Studies show teams are more aligned than ever.

Manual approval adds four days to every invoice cycle at Acme.

Streamlining approvals delivers meaningful efficiency gains. Optimizing workflows delivers meaningful efficiency gains. Simplifying handoffs delivers meaningful efficiency gains.

Together, we can build the future.`;

describe("anti-slop v1.2 — primary cause", () => {
  it("codes a missing source as V, with the primary's evidence first", () => {
    const scan = scanPhrase({ phrase: "Studies show teams are more aligned than ever.", position: "body" });
    expect(scan.verdict).toBe("slop");
    expect(scan.primaryCode).toBe("V");
    expect(scan.evidenceTier).toBe(0);
    expect(scan.signals[0]).toMatch(/authority|source|attribut/i);
  });

  it("codes a slogan run as F rather than letting a generic V signal win", () => {
    const scan = scanPhrase({ phrase: "Build fast. Ship often. Win big.", position: "body" });
    expect(scan.verdict).toBe("slop");
    expect(scan.primaryCode).toBe("F");
  });
});

describe("anti-slop v1.2 — severity, confidence, frequency", () => {
  it("carries the v1.2 fields on every adjudicated finding", async () => {
    const report = await adjudicatePiece({ text: SAMPLE, format: "essay" });
    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(["F", "V", "W", "R"]).toContain(finding.primaryCode);
      expect(finding.secondaryCodes).not.toContain(finding.primaryCode);
    }

    const authority = report.findings.find((f) => f.code === "S2.5");
    expect(authority?.severity).toBe("major"); // support missing for a claim
    expect(authority?.confidence).toBe("high");

    const title = report.findings.find((f) => f.location === "title");
    expect(title?.primaryCode).toBe("V");
    expect(title?.severity).toBe("major"); // meaning lost where the reader meets the piece

    const closing = report.findings.find((f) => f.quote.startsWith("Together, we can"));
    expect(closing?.primaryCode).toBe("F");

    // The same mechanism three+ times is pervasive, and never stays minor.
    const repeated = report.findings.filter((f) => f.mechanism === "empty abstraction");
    expect(repeated.length).toBeGreaterThanOrEqual(3);
    for (const finding of repeated) {
      expect(finding.frequency).toBe("pervasive");
      expect(finding.severity).not.toBe("minor");
    }
  });

  it("never lets a low-confidence signal drive the verdict", () => {
    const text = [
      "# Manual approval costs Acme four days per invoice",
      "",
      "Acme's finance team waits four days on every invoice because two managers sign each one.",
      "",
      "In March, 412 invoices waited a combined 1,648 days, per the AP ledger.",
      "",
      "Which means one signature, not two, buys back three days per invoice."
    ].join("\n");
    const finding = (confidence: "low" | "high") =>
      AdjudicatedFindingSchema.parse({
        location: "closing",
        quote: "Which means one signature, not two, buys back three days per invoice.",
        bucket: 1,
        code: "S1.5",
        mechanism: "rhetorical triad",
        effect: "",
        direction: "",
        source: "scanner",
        primaryCode: "F",
        confidence
      });
    const reportWith = (confidence: "low" | "high"): AdjudicationReport => ({
      format: "essay",
      unitsScanned: 5,
      candidates: 1,
      findings: [finding(confidence)],
      flaggedShare: confidence === "low" ? 0 : 0.2,
      baseRateBand: [0.05, 0.35],
      provider: "mock",
      cost: 0
    });

    expect(drivingFindings(reportWith("low").findings)).toHaveLength(0);
    const low = publishVerdict({ text, report: reportWith("low") });
    const high = publishVerdict({ text, report: reportWith("high") });
    expect(low.criticalCount).toBe(0);
    expect(high.criticalCount).toBe(1);
    expect(high.ready).toBe(false);
    expect(low.score).toBeGreaterThan(high.score);
  });

  it("keeps low-confidence cues out of the writer's defect profile", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("carol", async () => {
      await repo.recordFindings(undefined, [
        { location: "l1", quote: "q", bucket: 2, code: "S2.5", mechanism: "unnamed authority", effect: "", direction: "", source: "scanner", confidence: "high" },
        { location: "l2", quote: "q", bucket: 1, code: "S1.5", mechanism: "rhetorical triad", effect: "", direction: "", source: "scanner", confidence: "low" }
      ]);
      const profile = await repo.defectProfile();
      expect(profile.totalFindings).toBe(1);
      expect(profile.topDefects.map((d) => d.code)).toEqual(["S2.5"]);
    });
  });
});
