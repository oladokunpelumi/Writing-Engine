import { describe, expect, it } from "vitest";
import { hookScore } from "../src/quality";
import { hookStyleDirective, HOOK_STYLES } from "../../shared/src";

describe("hookScore", () => {
  it("rewards a recognition-first mirror scene over an abstract opener", () => {
    const mirror = hookScore("It's 2am. Your kitchen is a mess and the one snack became eleven. You stop.");
    const abstract = hookScore("The key to good habits is consistency and discipline over time.");
    expect(mirror.score).toBeGreaterThan(abstract.score);
    expect(mirror.reasons).toContain("speaks to 'you'");
  });

  it("penalizes leading with the answer / throat-clearing", () => {
    expect(hookScore("In this essay I want to explain why focus matters.").score).toBeLessThan(5);
    expect(hookScore("Many people struggle with productivity.").score).toBeLessThan(5);
  });
});

describe("hook styles", () => {
  it("exposes four styles with distinct directives", () => {
    expect(HOOK_STYLES.length).toBe(4);
    expect(hookStyleDirective("confession")).toMatch(/confession/i);
    expect(hookStyleDirective("provocative-question")).toMatch(/question/i);
    expect(hookStyleDirective(undefined)).toMatch(/mirror-scene/i);
  });
});
