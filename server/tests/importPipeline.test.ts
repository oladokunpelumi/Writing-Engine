import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPreviousInputsPreview, parsePosts, parsePromptTemplates, parsePromptsAndWritings } from "../src/importPipeline";

describe("previous input import pipeline", () => {
  it("splits Posts.md into the expected archive entries", () => {
    const posts = parsePosts(readFileSync("/Users/pelumioladokun/Downloads/Posts.md", "utf8"));
    expect(posts).toHaveLength(17);
    expect(posts[0].title).toBe("The Rearview");
    expect(posts[16].title).toContain("River");
    expect(posts.every((post) => post.wordCount > 10)).toBe(true);
  });

  it("imports previous prompt workflows into template categories", () => {
    const prompts = parsePromptTemplates(readFileSync("/Users/pelumioladokun/Downloads/Prompts.md", "utf8"));
    expect(prompts.map((prompt) => prompt.stage)).toEqual([
      "research-explainer",
      "deep-analysis",
      "synthesis-article",
      "visual-prompt"
    ]);
    expect(prompts.find((prompt) => prompt.stage === "deep-analysis")?.body).toContain("STAGE 1");
  });

  it("previews anti-slop rule assets without UI unzip work", () => {
    process.env.ALLOW_LOCAL_IMPORT = "true"; // legacy single-author local-file path
    const preview = buildPreviousInputsPreview();
    expect(preview.antiSlopRuleCount).toBeGreaterThan(5);
    expect(preview.referenceOutputs[0].kind).toBe("deep-analysis-reference");
  });

  it("classifies the combined prompts and writings corpus", () => {
    const parsed = parsePromptsAndWritings(readFileSync("/Users/pelumioladokun/Downloads/Prompts & Writings.md", "utf8"));
    expect(parsed.briefSeeds.length).toBeGreaterThanOrEqual(3);
    expect(parsed.corpusSegments.some((segment) => segment.type === "prompt-template")).toBe(true);
    expect(parsed.corpusSegments.some((segment) => segment.type === "deep-analysis-output")).toBe(true);
    expect(parsed.corpusSegments.some((segment) => segment.type === "synthesis-output")).toBe(true);
    expect(parsed.corpusSegments.some((segment) => segment.type === "visual-prompt-output")).toBe(true);
    expect(parsed.corpusSegments.some((segment) => segment.type === "critique-output")).toBe(true);
    expect(parsed.corpusSegments.every((segment) => segment.lineStart > 0 && segment.lineEnd >= segment.lineStart)).toBe(true);
    expect(parsed.corpusSegments.filter((segment) => segment.memoryRole === "brief-seed")).toHaveLength(parsed.briefSeeds.length);
  });

  it("detects workflow prompts, stages, and synthesis toggles from the combined corpus", () => {
    const parsed = parsePromptsAndWritings(readFileSync("/Users/pelumioladokun/Downloads/Prompts & Writings.md", "utf8"));
    expect(parsed.promptTemplates.map((prompt) => prompt.stage)).toEqual([
      "deep-analysis",
      "synthesis-article",
      "visual-prompt",
      "research-explainer"
    ]);
    expect(parsed.workflowRecipes[0].stages).toEqual(["deep-analysis", "synthesis-article", "visual-prompt", "sharpen"]);
    expect(parsed.workflowRecipes[0].toggles.map((toggle) => toggle.name)).toContain("Narrative Intensity");
    expect(parsed.workflowRecipes[0].toggles.map((toggle) => toggle.name)).toContain("Provocation Level");
  });
});
