import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { desireScore, splitSections } from "../src/quality";
import { draftPrompt, framePrompt, runDesirePass } from "../src/openrouter";
import { DEFAULT_VOICE_PROFILE, DESIRE_DOCTRINE } from "../../shared/src";
import type { BriefInput } from "../../shared/src";

let previousKey: string | undefined;
beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY; // force mock / offline
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
});

const brief: BriefInput = {
  topic: "Showing up on the boring days",
  seed: "",
  anchor: "",
  observation: "",
  tension: "",
  audience: "writers",
  format: "Essay",
  targetLength: "1000 words",
  rawNotes: "",
  mode: "new"
};

describe("desireScore (offline)", () => {
  it("rewards a section with a named subject + want over an inert/abstract one", () => {
    const text = [
      "## A wanting scene",
      "She wanted the page to be finished before the kids woke, but the cursor just blinked.",
      "## An inert definition",
      "Productivity is a system of habits and routines that compound over time across many domains."
    ].join("\n\n");
    const report = desireScore(text);
    expect(report.sections).toHaveLength(2);
    expect(report.sections[0].hasWant).toBe(true);
    expect(report.sections[1].hasWant).toBe(false);
    expect(report.weakSections).toContain(1);
    expect(report.weakSections).not.toContain(0);
    expect(report.score).toBe(5); // 1 of 2 sections shows a want
  });

  it("never exceeds 10 and reports 10 when every section wants something", () => {
    const text = "I need this to work.\n\nYou want the same thing, badly.";
    const report = desireScore(text);
    expect(report.score).toBe(10);
    expect(report.weakSections).toHaveLength(0);
  });
});

describe("splitSections", () => {
  it("splits on markdown headings, keeping each heading with its body", () => {
    const parts = splitSections("# One\nbody one\n\n## Two\nbody two");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("One");
    expect(parts[1]).toContain("Two");
  });

  it("falls back to paragraph blocks when there are no headings", () => {
    const parts = splitSections("para one here\n\npara two here\n\npara three");
    expect(parts).toHaveLength(3);
  });
});

describe("DESIRE_DOCTRINE injection", () => {
  it("appears in the frame and draft prompts", () => {
    expect(framePrompt(brief)).toContain(DESIRE_DOCTRINE);
    expect(framePrompt(brief)).toContain("Driving want");
    expect(draftPrompt(brief, "a frame", [])).toContain(DESIRE_DOCTRINE);
  });
});

describe("runDesirePass (offline)", () => {
  it("returns the piece as a mock provider response", async () => {
    const text = "## Flat\nProductivity is a system of habits.";
    const response = await runDesirePass(text, DEFAULT_VOICE_PROFILE, ["Productivity is a system of habits."]);
    expect(response.provider).toBe("mock");
    expect(response.content).toBe(text);
  });
});
