// Layers 1–4 — guards, gates, the ladder, the reviser's guardrail, and cadence.
//
// The guard cases are taken from the Looks-Like-a-Tell catalogue's own
// fine/not-fine pairs, so each test states the line the catalogue draws.

import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import { scanPhrase } from "../src/slopScan";
import { segmentPiece, adjudicatePiece } from "../src/adjudicate";
import { detectOvercorrection, publishVerdict, synthesisTest } from "../src/publishGate";
import { normalizePosition } from "../../shared/src";

const verdict = (phrase: string, position = "Body line") => scanPhrase({ phrase, position }).verdict;

describe("guards — the catalogue's own fine / not-fine pairs", () => {
  it("A1 title: names a subject vs names nothing", () => {
    expect(verdict("Q3 Payment Fraud Losses", "Title")).toBe("not-slop");
    expect(verdict("Unlocking Tomorrow's Potential", "Title")).toBe("slop");
  });

  it("A4 body bullet: an observable change vs an empty benefit", () => {
    expect(verdict("Manual approval adds four days to the cycle.")).toBe("not-slop");
    expect(verdict("Streamlining approvals delivers meaningful efficiency gains.")).toBe("slop");
  });

  it("A8 label-colon: real data vs a label that adds nothing", () => {
    expect(verdict("Epic: improve onboarding", "Body line")).toBe("not-slop");
    expect(verdict("Impact: significant", "Body line")).toBe("slop");
  });

  it("A10 footnote: author, date, sample vs an unnamed survey", () => {
    expect(verdict("Deloitte Treasury Survey, March 2026, n=412", "Footnote")).toBe("not-slop");
    expect(verdict("Based on a recent industry survey", "Footnote")).toBe("slop");
  });

  it("B1 triad: three distinct items vs three overlapping adjectives", () => {
    expect(verdict("Adding detail, estimates, and priority", "Column header")).toBe("not-slop");
    expect(verdict("Faster, smarter, and more intuitive", "Closing line")).toBe("slop");
  });

  it("B5 contrast: two real candidates vs a strawman", () => {
    expect(verdict("The fault is in the parser, not the tokenizer")).toBe("not-slop");
    expect(verdict("This isn't just a calendar, it's a gateway to a more intentional life")).toBe("slop");
  });

  it("B9 hedging: one hedge on a real unknown vs four stacked", () => {
    expect(verdict("The estimate is preliminary because two regions have not reported.")).toBe("not-slop");
    expect(verdict("It may potentially be worth considering whether we could possibly delay.")).toBe("slop");
  });

  it("B12 passive: a named actor vs a hidden one", () => {
    expect(verdict("The exception must be approved by Legal and Security.")).toBe("not-slop");
    expect(verdict("Concerns were raised during the review process.")).toBe("slop");
  });

  it("B14: shortness is never itself the fault", () => {
    expect(verdict("Losses fell 12%.")).toBe("not-slop");
    expect(verdict("Momentum is building.")).toBe("slop");
  });

  it("B20: a sentence opening with a conjunction is never flagged", () => {
    expect(verdict("But the second region has not reported.")).toBe("not-slop");
  });
});

describe("register — position sets what counts as a defect", () => {
  it("normalises descriptive positions by their head, not their tail", () => {
    expect(normalizePosition("Body bullet, one of six identical label bullets")).toBe("body");
    expect(normalizePosition("Column headers of a three-column comparison table")).toBe("label");
    expect(normalizePosition("Four legend entries on a horizon chart")).toBe("label");
  });

  it("clears a fragment in a label and in a spoken script, flags it in essay body", () => {
    const fragment = "Near-term, medium-term, and long-term horizons";
    expect(scanPhrase({ phrase: fragment, position: "Legend entry" }).verdict).toBe("not-slop");
    expect(scanPhrase({ phrase: "Win the close. Keep the evidence.", position: "Body line", format: "video-script" }).verdict).toBe(
      "not-slop"
    );
    expect(scanPhrase({ phrase: "Win the close. Keep the evidence.", position: "Closing line" }).verdict).toBe("slop");
  });
});

describe("segmentation + base rate", () => {
  it("locates units by surface, treating the last block as the closing", () => {
    const units = segmentPiece("# A real title\n\nFirst body sentence here. Second one too.\n\n- a list item\n\nThe closing line lands.");
    expect(units[0].position).toBe("title");
    expect(units.some((u) => u.position === "list-item")).toBe(true);
    expect(units[units.length - 1].position).toBe("closing");
    expect(units[1].location).toBe("paragraph 1, sentence 1");
  });

  it("adjudicates a sloppy piece and credits a located strength", async () => {
    const piece = [
      "# Building the future of field operations",
      "",
      "In today's fast-moving landscape, teams are more stretched than ever. We remain committed to delivering excellence.",
      "",
      "Manual approval adds four days to the cycle, and 22% of requests stall before a reviewer opens them.",
      "",
      "Together, we can build something remarkable."
    ].join("\n");
    const report = await adjudicatePiece({ text: piece });
    expect(report.findings.length).toBeGreaterThanOrEqual(3);
    expect(report.findings.every((f) => f.mechanism && f.mechanism !== "reads like AI")).toBe(true);
    expect(report.findings.every((f) => f.location)).toBe(true);
    // A direction, never a drafted sentence.
    expect(report.findings.some((f) => f.direction.length > 0)).toBe(true);
    expect(report.strength?.quote).toContain("four days");
  });

  it("leaves a clean, specific piece almost entirely alone", async () => {
    const clean = [
      "# Manual approval costs four days",
      "",
      "Approval adds four days to every request. 22% stall before a reviewer opens them.",
      "",
      "We cut the data-source step to two fields, which means the median request now clears in under a day."
    ].join("\n");
    const report = await adjudicatePiece({ text: clean });
    expect(report.flaggedShare).toBeLessThanOrEqual(0.2);
  });
});

describe("the publish ladder", () => {
  it("blocks a sloppy piece with a named reason and clears a clean one", async () => {
    const sloppy = [
      "# Unlocking tomorrow's potential",
      "",
      "We remain committed to delivering excellence. Together, we can build something remarkable.",
      "",
      "At the end of the day, it's about doing our best work together."
    ].join("\n");
    const sloppyReport = await adjudicatePiece({ text: sloppy });
    const blocked = publishVerdict({ text: sloppy, report: sloppyReport });
    expect(blocked.ready).toBe(false);
    expect(blocked.score).toBeLessThanOrEqual(4);
    expect(blocked.reason).toMatch(/Blocked/);
    expect(blocked.tieBreak).toBeTruthy();

    const clean = [
      "# Manual approval costs four days",
      "",
      "Approval adds four days to every request. 22% stall before a reviewer opens them.",
      "",
      "We cut the step to two fields, which means the median request now clears in under a day."
    ].join("\n");
    const cleanReport = await adjudicatePiece({ text: clean });
    const cleared = publishVerdict({ text: clean, report: cleanReport });
    expect(cleared.score).toBeGreaterThanOrEqual(5);
    expect(cleared.ready).toBe(true);
    expect(cleared.hygiene).toBeGreaterThan(0);
  });

  it("caps at 4 when one pattern recurs across three or more locations", async () => {
    const recurring = [
      "Momentum is building.",
      "",
      "Momentum is shifting.",
      "",
      "Momentum is growing.",
      "",
      "Approval adds four days to every request and 22% stall before review."
    ].join("\n");
    const report = await adjudicatePiece({ text: recurring });
    const v = publishVerdict({ text: recurring, report });
    expect(v.score).toBeLessThanOrEqual(4);
  });

  it("runs the synthesis test: a subject-naming title cannot reach 7", () => {
    const subjectOnly = "# Payment fraud\n\nLosses came from three places.\n\nCard testing was one.";
    expect(synthesisTest(subjectOnly).ceiling).toBeLessThanOrEqual(5);
  });
});

describe("the reviser's guardrail", () => {
  it("detects casual slop so a revision that installs it can be rejected", () => {
    const overcorrected = "Look, here's the deal. Short. Punchy. Wrong. This thing slaps, ngl.";
    const hits = detectOvercorrection(overcorrected);
    const patterns = hits.map((h) => h.pattern);
    expect(patterns).toContain("performative bluntness");
    expect(patterns).toContain("staccato fragment abuse");
    expect(patterns).toContain("costume casualness");
  });

  it("does not fire on deliberate prose with one short sentence", () => {
    const fine = "Approval adds four days to every request. That is the whole problem, and it is fixable in a week.";
    expect(detectOvercorrection(fine)).toEqual([]);
  });
});

describe("cadence — queue and defect profile", () => {
  it("records runs and findings, exposes the queue and the writer's failure modes", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("alice", async () => {
      const post = await repo.createPost({ title: "A piece", body: "Momentum is building.", status: "draft", tags: [] });
      await repo.recordGateRun({ postId: post.id, score: 3, ready: false, reason: "Blocked at 3/7", findingsCount: 2 });
      await repo.recordFindings(post.id, [
        { location: "paragraph 1, sentence 1", quote: "Momentum is building.", bucket: 2, code: "S2.1", mechanism: "empty abstraction", effect: "", direction: "name the change", source: "scanner" },
        { location: "closing", quote: "Together, we can", bucket: 1, code: "S1.11", mechanism: "canned ending", effect: "", direction: "cut the formula", source: "scanner" }
      ]);
      // Second run clears; the queue only holds what reached ready.
      await repo.recordGateRun({ postId: post.id, score: 6, ready: true, reason: "Scored 6/7", findingsCount: 0 });
      await repo.setPostStatus(post.id, "ready");

      const queue = await repo.readyQueue();
      expect(queue.map((p) => p.id)).toEqual([post.id]);
      expect(queue[0].gateScore).toBe(6);

      const profile = await repo.defectProfile();
      expect(profile.totalFindings).toBe(2);
      expect(profile.runs).toBe(2);
      // The first run did not clear, so the first-pass rate is 0.
      expect(profile.firstPassClearRate).toBe(0);
      expect(profile.topDefects.map((d) => d.code).sort()).toEqual(["S1.11", "S2.1"]);
    });
  });

  it("keeps findings owner-scoped", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("alice", () =>
      repo.recordFindings(undefined, [
        { location: "l", quote: "q", bucket: 2, code: "S2.1", mechanism: "empty abstraction", effect: "", direction: "", source: "scanner" }
      ])
    );
    const bob = await ownerContext.run("bob", () => repo.defectProfile());
    expect(bob.totalFindings).toBe(0);
  });
});
