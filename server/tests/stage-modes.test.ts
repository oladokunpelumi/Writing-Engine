import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stageMode, stagePlan } from "../src/openrouter";

const keys = [
  "MODE_RESEARCH_EXPLAINER",
  "MODE_DEEP_ANALYSIS",
  "TEMP_SYNTHESIS_ARTICLE",
  "MAXTOK_SYNTHESIS_ARTICLE",
  "MAX_OUTPUT_TOKENS",
  "FUSION_STAGES"
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of keys) saved[k] = process.env[k];
  for (const k of keys) delete process.env[k];
});
afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("per-stage modes", () => {
  it("defaults to chat with the global max-tokens fallback", () => {
    process.env.MAX_OUTPUT_TOKENS = "12000";
    const plan = stagePlan("draft");
    expect(plan.mode).toBe("chat");
    expect(plan.useFusion).toBe(false);
    expect(plan.useWeb).toBe(false);
    expect(plan.maxTokens).toBe(12000);
    expect(plan.temperature).toBeUndefined();
  });

  it("reads MODE_<STAGE>=web_search (hyphens → underscores)", () => {
    process.env.MODE_RESEARCH_EXPLAINER = "web_search";
    expect(stageMode("research-explainer")).toBe("web_search");
    const plan = stagePlan("research-explainer");
    expect(plan.useWeb).toBe(true);
    expect(plan.useFusion).toBe(false);
  });

  it("fusion takes precedence over web_search, and forceFusion always wins", () => {
    process.env.MODE_DEEP_ANALYSIS = "fusion";
    expect(stagePlan("deep-analysis").useFusion).toBe(true);
    process.env.MODE_RESEARCH_EXPLAINER = "web_search";
    expect(stagePlan("research-explainer", true).useFusion).toBe(true);
    expect(stagePlan("research-explainer", true).useWeb).toBe(false);
  });

  it("applies per-stage temperature and max-tokens overrides", () => {
    process.env.TEMP_SYNTHESIS_ARTICLE = "0.8";
    process.env.MAXTOK_SYNTHESIS_ARTICLE = "6000";
    const plan = stagePlan("synthesis-article");
    expect(plan.temperature).toBe(0.8);
    expect(plan.maxTokens).toBe(6000);
  });
});
