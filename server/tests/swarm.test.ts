import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consensusMerge, runSwarm, scoreDrafts, spreadVariants } from "../src/swarm";

let previousKey: string | undefined;
beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY; // force mock fan-out
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
});

describe("spreadVariants", () => {
  it("spreads temperatures across N and shares the cached prefix", () => {
    const variants = spreadVariants("SYS", "USER", 5);
    expect(variants.length).toBe(5);
    expect(variants[0].temperature).toBeLessThan(variants[4].temperature!);
    expect(variants.every((v) => v.system === "SYS" && v.user === "USER")).toBe(true);
  });
});

describe("runSwarm + scoreDrafts (mock)", () => {
  it("fans out N variants and returns them ranked by score", async () => {
    const results = await runSwarm(spreadVariants("SYS", "write the post", 6));
    expect(results.length).toBe(6);
    const ranked = scoreDrafts(results);
    expect(ranked.length).toBe(6);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    expect(typeof ranked[0].verdict).toBe("string");
  });
});

describe("consensusMerge", () => {
  it("counts frequency across runs and assigns confidence tiers", () => {
    const runs = [
      ["pointers", "recursion"],
      ["Pointers", "loops"],
      ["pointers", "recursion"],
      ["pointers"]
    ];
    const merged = consensusMerge(runs);
    const pointers = merged.find((m) => m.value.toLowerCase() === "pointers");
    expect(pointers?.count).toBe(4);
    expect(pointers?.confidence).toBe("emergent"); // 3-4 = emergent
    expect(merged[0].value.toLowerCase()).toBe("pointers");
  });
});
