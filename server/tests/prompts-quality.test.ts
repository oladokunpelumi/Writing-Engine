import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { evaluateQuality, rewriteSlop } from "../src/quality";
import { Repository } from "../src/repository";
import { applyDistillationToVoice, distillVoice } from "../src/voiceDistillation";

describe("prompt studio and quality management", () => {
  it("creates prompt versions and activates rollback candidates", () => {
    const repo = new Repository(openDatabase(":memory:"));
    repo.seedDefaults();
    const frame = repo.getPromptByStage("frame")!;
    const version = repo.addPromptVersion(frame.id, {
      body: "New frame body",
      notes: "test version"
    });
    expect(repo.getActivePromptVersion("frame")?.id).toBe(version.id);
    const first = frame.versions[frame.versions.length - 1];
    repo.activatePromptVersion(frame.id, first.id);
    expect(repo.getActivePromptVersion("frame")?.id).toBe(first.id);
  });

  it("distills voice profile fields from saved posts", () => {
    const repo = new Repository(openDatabase(":memory:"));
    const post = repo.createPost({
      title: "The Mirror",
      body: "You look away because the mirror keeps telling the truth. Be aware. Move.",
      status: "imported",
      tags: ["identity"]
    });
    const distillation = distillVoice([post]);
    const voice = applyDistillationToVoice(repo.getVoice(), distillation);
    expect(distillation.sourcePostIds).toContain(post.id);
    expect(voice.constraints.join(" ")).toContain("sensory pressure");
  });

  it("scores and rewrites slop markers", () => {
    const text = "In today's fast-paced world, we leverage robust systems that are not just useful but transformative.";
    const report = evaluateQuality(text);
    expect(report.verdict).not.toBe("Pass");
    expect(report.vocabularyViolations.length).toBeGreaterThan(0);
    const rewrite = rewriteSlop(text);
    expect(rewrite).not.toContain("leverage");
    expect(rewrite).not.toContain("In today's fast-paced world");
  });
});
