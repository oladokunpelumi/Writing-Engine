import { describe, expect, it } from "vitest";
import { aiProvider, runFrame } from "../src/openrouter";
import { DEFAULT_VOICE_PROFILE } from "../../shared/src";

describe("hybrid AI", () => {
  it("uses mock provider when OpenRouter key is absent", async () => {
    const previous = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    expect(aiProvider()).toBe("mock");
    const response = await runFrame(
      {
        topic: "writing courage",
        seed: "",
        anchor: "",
        observation: "",
        tension: "",
        audience: "",
        format: "Essay",
        targetLength: "1200",
        rawNotes: "",
        mode: "new"
      },
      DEFAULT_VOICE_PROFILE
    );
    expect(response.provider).toBe("mock");
    expect(response.content).toContain("Thesis:");
    process.env.OPENROUTER_API_KEY = previous;
  });
});
