import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fusionEnabledFor, modelFor } from "../src/openrouter";

const saved: Record<string, string | undefined> = {};
const keys = ["FUSION_STAGES", "MODEL_FRAME", "MODEL_DRAFT", "MODEL_SHARPEN"];

beforeEach(() => {
  for (const key of keys) saved[key] = process.env[key];
});

afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("model routing", () => {
  it("uses the stage env var, then MODEL_DRAFT, then openrouter/auto", () => {
    process.env.MODEL_FRAME = "google/gemini-3.5-flash";
    process.env.MODEL_DRAFT = "anthropic/claude-sonnet-4.6";
    expect(modelFor("frame")).toBe("google/gemini-3.5-flash");
    // extended stage with no dedicated env var falls back to MODEL_DRAFT
    expect(modelFor("synthesis-article")).toBe("anthropic/claude-sonnet-4.6");
    delete process.env.MODEL_DRAFT;
    delete process.env.MODEL_FRAME;
    expect(modelFor("frame")).toBe("openrouter/auto");
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
