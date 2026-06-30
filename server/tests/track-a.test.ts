import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cosine } from "../src/embeddings";
import { retrieve, type EmbeddingStore } from "../src/retrieval";
import { runStage } from "../src/openrouter";
import { DEFAULT_VOICE_PROFILE, type BriefInput, type Post } from "../../shared/src";

const brief: BriefInput = {
  topic: "attachment and identity",
  seed: "",
  anchor: "",
  observation: "belonging anxiety",
  tension: "",
  audience: "",
  format: "Essay",
  targetLength: "1200",
  rawNotes: "",
  mode: "new"
};

const post = (title: string, body: string, tags: string[] = []): Post => ({
  id: title,
  title,
  body,
  tags,
  status: "imported",
  wordCount: body.split(/\s+/).length,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const emptyStore: EmbeddingStore = {
  getPostEmbedding: async () => undefined,
  savePostEmbedding: async () => {}
};

let previousKey: string | undefined;
let previousModel: string | undefined;

beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  previousModel = process.env.EMBED_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.EMBED_MODEL;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
  if (previousModel === undefined) delete process.env.EMBED_MODEL;
  else process.env.EMBED_MODEL = previousModel;
});

describe("cosine similarity", () => {
  it("is 1 for identical vectors, 0 for orthogonal or empty", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([], [])).toBe(0);
  });
});

describe("retrieve()", () => {
  it("falls back to lexical ranking when embeddings are disabled", async () => {
    const results = await retrieve(
      emptyStore,
      [
        post("Attachment and identity", "attachment identity belonging anxiety", ["attachment"]),
        post("Publishing cadence", "calendar writing rhythm draft export", ["writing"])
      ],
      brief,
      2
    );
    expect(results[0].post.title).toBe("Attachment and identity");
    expect(results[0].matchedTerms).toContain("attachment");
  });
});

describe("runStage (mock)", () => {
  it("runs an arbitrary workflow stage offline and threads prior output", async () => {
    const response = await runStage("deep-analysis", DEFAULT_VOICE_PROFILE, "prior stage output", brief);
    expect(response.provider).toBe("mock");
    expect(response.content).toContain("deep-analysis");
    expect(response.content).toContain("prior stage output");
  });
});
