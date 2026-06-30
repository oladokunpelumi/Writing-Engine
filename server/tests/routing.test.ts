import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fusionEnabledFor, modelFor, modelProfile, rawChat } from "../src/openrouter";

const saved: Record<string, string | undefined> = {};
const keys = [
  "FUSION_STAGES",
  "MODEL_PROFILE",
  "MODEL_FRAME",
  "MODEL_DRAFT",
  "MODEL_SHARPEN",
  "MODEL_CRITIC",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL"
];
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  for (const key of keys) saved[key] = process.env[key];
  for (const key of keys) delete process.env[key];
  originalFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-key";
});

afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  globalThis.fetch = originalFetch;
});

describe("model routing", () => {
  it("uses the stage env var, then the selected profile", () => {
    process.env.MODEL_FRAME = "google/gemini-3.5-flash";
    process.env.MODEL_DRAFT = "anthropic/claude-sonnet-4.6";
    expect(modelFor("frame")).toBe("google/gemini-3.5-flash");
    expect(modelFor("story")).toBe("anthropic/claude-sonnet-4.6");
    delete process.env.MODEL_DRAFT;
    delete process.env.MODEL_FRAME;
    expect(modelFor("frame")).toBe("z-ai/glm-5.2");
  });

  it("switches profiles while keeping per-stage env overrides authoritative", () => {
    process.env.MODEL_PROFILE = "premium";
    expect(modelProfile()).toBe("premium");
    expect(modelFor("critic")).toBe("anthropic/claude-opus-4.8");
    process.env.MODEL_CRITIC = "custom/critic";
    expect(modelFor("critic")).toBe("custom/critic");
    delete process.env.MODEL_CRITIC;
    process.env.MODEL_PROFILE = "cost-first";
    expect(modelFor("draft")).toBe("z-ai/glm-5.2");
    process.env.MODEL_PROFILE = "unknown";
    expect(modelProfile()).toBe("balanced");
  });

  it("retries empty visible output once on MODEL_DRAFT", async () => {
    process.env.MODEL_DRAFT = "stable/draft";
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const content = bodies.length === 1 ? "" : "fallback draft";
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 12, cost: 0.001 } }), { status: 200 });
    }) as typeof fetch;

    const result = await rawChat({ model: "empty/model", system: "system", user: "user", maxTokens: 20 });
    expect(result.content).toBe("fallback draft");
    expect(result.usage?.cost).toBe(0.001);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].model).toBe("empty/model");
    expect(bodies[1].model).toBe("stable/draft");
  });

  it("throws the branded empty-output message after the retry also returns blank", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), { status: 200 })) as typeof fetch;

    await expect(rawChat({ model: "empty/model", system: "system", user: "user" })).rejects.toThrow("model returned no visible draft");
  });
});

describe("fusion stage gating", () => {
  it("is enabled only for stages listed in FUSION_STAGES", () => {
    process.env.FUSION_STAGES = "sharpen, deep-analysis";
    expect(fusionEnabledFor("sharpen")).toBe(true);
    expect(fusionEnabledFor("deep-analysis")).toBe(true);
    expect(fusionEnabledFor("frame")).toBe(false);
    delete process.env.FUSION_STAGES;
    expect(fusionEnabledFor("sharpen")).toBe(false);
  });
});
