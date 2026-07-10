import { describe, expect, it } from "vitest";
import { splitSharpenOutput, systemPrompt } from "../src/openrouter";
import { STARTER_VOICE_PROFILE, DEFAULT_VOICE_PROFILE } from "../../shared/src";

describe("splitSharpenOutput", () => {
  it("splits critique from the revised piece on the <<<FINAL>>> marker", () => {
    const raw = "Critique:\n- thin middle\n\n<<<FINAL>>>\n\n# The Piece\n\nBody text.";
    const { critique, final } = splitSharpenOutput(raw);
    expect(critique).toBe("Critique:\n- thin middle");
    expect(final).toBe("# The Piece\n\nBody text.");
  });

  it("tolerates surrounding whitespace and extra angle brackets on the marker line", () => {
    const raw = "Some critique.\n   <<<< FINAL >>>>   \nThe revised piece.";
    const { critique, final } = splitSharpenOutput(raw);
    expect(critique).toBe("Some critique.");
    expect(final).toBe("The revised piece.");
  });

  it("falls back to treating the whole content as final when no marker is present", () => {
    const raw = "# Critique\n\nSome critique text.\n\n# The Piece\n\nBody text.";
    const { critique, final } = splitSharpenOutput(raw);
    expect(critique).toBeUndefined();
    expect(final).toBe(raw);
  });

  it("falls back to the whole content if the marker is the very last line (no piece after it)", () => {
    const raw = "Critique only.\n<<<FINAL>>>\n";
    const { critique, final } = splitSharpenOutput(raw);
    expect(critique).toBeUndefined();
    expect(final).toBe(raw);
  });
});

describe("systemPrompt", () => {
  it("omits empty-label lines for a neutral starter voice", () => {
    const prompt = systemPrompt(STARTER_VOICE_PROFILE);
    expect(prompt).not.toMatch(/Pillars: *\n/);
    expect(prompt).not.toMatch(/Spine: *\n/);
    expect(prompt).not.toMatch(/Lexicon: *\n/);
    expect(prompt).toContain("Register:");
  });

  it("still includes pillars/spine/lexicon for a fully populated voice", () => {
    const prompt = systemPrompt(DEFAULT_VOICE_PROFILE);
    expect(prompt).toContain("Pillars:");
    expect(prompt).toContain("Spine:");
    expect(prompt).toContain("Lexicon:");
  });
});
