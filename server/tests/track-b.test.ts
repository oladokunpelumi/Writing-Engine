import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDiscover, runRepurpose, draftPrompt } from "../src/openrouter";
import { DEFAULT_VOICE_PROFILE, type BriefInput, type Post } from "../../shared/src";

const post = (title: string, body: string): Post => ({
  id: title,
  title,
  body,
  tags: [],
  status: "imported",
  wordCount: body.split(/\s+/).length,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const brief: BriefInput = {
  topic: "cadence",
  seed: "",
  anchor: "",
  observation: "",
  tension: "",
  audience: "",
  format: "Essay",
  targetLength: "800",
  rawNotes: "",
  mode: "new"
};

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
});

describe("discover series (mock)", () => {
  it("clusters at least one proposal into a named series", async () => {
    const ideas = await runDiscover([post("Old piece", "body")], DEFAULT_VOICE_PROFILE, 8);
    const withSeries = ideas.filter((idea) => idea.series);
    expect(withSeries.length).toBeGreaterThan(0);
    expect(withSeries[0].seriesOrder).toBeTypeOf("number");
  });
});

describe("repurpose (mock)", () => {
  it("returns platform-native variants", async () => {
    const pack = await runRepurpose("# A consistent practice\n\nConsistency compounds.", DEFAULT_VOICE_PROFILE);
    expect(pack.tweetThread.length).toBeGreaterThan(1);
    expect(pack.linkedinPost.length).toBeGreaterThan(0);
    expect(pack.newsletterTeaser.length).toBeGreaterThan(0);
  });
});

describe("draft prompt callbacks/motifs", () => {
  it("includes callback guidance and weaves motifs when memory + motifs exist", () => {
    const prompt = draftPrompt(brief, "frame text", [post("Prior essay", "body")], ["the rearview", "currents"]);
    expect(prompt).toContain("call back to them by title");
    expect(prompt).toContain("the rearview");
    expect(prompt).toContain("Prior essay");
  });

  it("notes the absence of prior memory when none retrieved", () => {
    const prompt = draftPrompt(brief, "frame text", []);
    expect(prompt).toContain("no prior memory to build on yet");
  });
});
