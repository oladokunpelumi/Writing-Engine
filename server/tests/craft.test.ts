import { describe, expect, it } from "vitest";
import { headlineScore, scannabilityScore } from "../src/quality";
import { framePrompt, draftPrompt } from "../src/openrouter";
import { mockDiscover } from "../src/mockAi";
import { ONE_THING_DOCTRINE } from "../../shared/src";
import type { BriefInput, Post } from "../../shared/src";

const brief: BriefInput = {
  topic: "todo apps",
  seed: "",
  anchor: "",
  observation: "",
  tension: "",
  audience: "",
  format: "Essay",
  targetLength: "800 words",
  rawNotes: "my todo app has 4 archived todo apps inside it",
  mode: "new"
};

describe("headlineScore (shared attention engine)", () => {
  it("rewards a numbered, specific, power-word line over a vague one", () => {
    const strong = headlineScore("7 little-known ways to fix your onboarding in 2026");
    const weak = headlineScore("Some thoughts about things");
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reasons.join(" ")).toMatch(/number/);
  });

  it("penalizes generic slop and over-length", () => {
    const slop = headlineScore("A robust, seamless, innovative synergy of transformative leverage for everyone everywhere");
    expect(slop.score).toBeLessThan(5);
  });

  it("judges the mechanism, not the vocabulary (anti-slop v1.2)", () => {
    // A portable line costs points even with no listed word in it.
    const portable = headlineScore("The future of work is here");
    expect(portable.reasons.join(" ")).toMatch(/portable/);
    // A listed word on an anchored, specific line costs nothing.
    const anchored = headlineScore("Why a robust Stripe retry rule saved us $40k in March");
    expect(anchored.reasons.join(" ")).not.toMatch(/portable|filler/);
    expect(anchored.score).toBeGreaterThan(portable.score);
    // Title Case is not specificity.
    expect(headlineScore("Unlocking Tomorrow's Potential").reasons).not.toContain("something specific/named");
  });

  it("strips a leading # and surrounding quotes before scoring", () => {
    const r = headlineScore('# "3 mistakes that cost you readers"');
    expect(r.reasons.join(" ")).toMatch(/number/);
  });
});

describe("scannabilityScore (rate of revelation)", () => {
  it("flags a long first sentence and a wall of text", () => {
    const wall = Array.from(
      { length: 9 },
      (_, i) => `Clause ${i} keeps going and going and stacking more and more onto the same paragraph without any break here.`
    ).join(" ");
    const bad = `This is a deliberately long opening sentence that runs well past a dozen words and refuses to stop early. ${wall}`;
    const r = scannabilityScore(bad);
    expect(r.flags.some((f) => f.kind === "long-first-sentence")).toBe(true);
    expect(r.flags.some((f) => f.kind === "wall-of-text")).toBe(true);
    expect(r.score).toBeLessThan(9);
  });

  it("passes a clean, skimmable piece", () => {
    const good = "You open the app.\n\nYou close it again.\n\n## Why\n\nThe tools multiply. The work does not shrink.\n\n## What to do\n\nPick one. Delete the rest. Ship it today.";
    const r = scannabilityScore(good);
    expect(r.score).toBeGreaterThanOrEqual(8);
    expect(r.flags.length).toBe(0);
  });
});

describe("ONE_THING_DOCTRINE (shared through-line)", () => {
  it("is injected into the frame and draft prompts", () => {
    const frame = framePrompt(brief);
    expect(frame).toContain(ONE_THING_DOCTRINE);
    expect(frame).toContain("The one thing:");
    expect(draftPrompt(brief, "a frame", [], [])).toContain(ONE_THING_DOCTRINE);
  });
});

describe("Idea Generator (Discover extension)", () => {
  it("mock proposals carry writingType / ideaCategory / whyMe", () => {
    const posts = [{ id: "p1", title: "Old piece", body: "body text", tags: [], status: "published" } as unknown as Post];
    const ideas = mockDiscover(posts, 8);
    expect(ideas.some((idea) => idea.writingType && idea.ideaCategory && idea.whyMe)).toBe(true);
  });
});
