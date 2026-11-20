import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { evaluateQuality, rewriteSlop } from "../src/quality";
import { Repository } from "../src/repository";
import { applyDistillationToVoice, distillVoice } from "../src/voiceDistillation";

describe("prompt studio and quality management", () => {
  it("creates prompt versions and activates rollback candidates", async () => {
    const repo = new Repository(await openDatabase());
    await repo.seedDefaults();
    const frame = (await repo.getPromptByStage("frame"))!;
    const version = await repo.addPromptVersion(frame.id, {
      body: "New frame body",
      notes: "test version"
    });
    expect((await repo.getActivePromptVersion("frame"))?.id).toBe(version.id);
    const first = frame.versions[frame.versions.length - 1];
    await repo.activatePromptVersion(frame.id, first.id);
    expect((await repo.getActivePromptVersion("frame"))?.id).toBe(first.id);
  });

  it("distills voice profile fields from saved posts", async () => {
    const repo = new Repository(await openDatabase());
    const post = await repo.createPost({
      title: "The Mirror",
      body: "You look away because the mirror keeps telling the truth. Be aware. Move.",
      status: "imported",
      tags: ["identity"]
    });
    const distillation = distillVoice([post]);
    const voice = applyDistillationToVoice(await repo.getVoice(), distillation);
    expect(distillation.sourcePostIds).toContain(post.id);
    expect(voice.constraints.join(" ")).toContain("sensory pressure");
  });

  it("scores structural markers and makes only meaning-preserving cuts (anti-slop v1.2)", () => {
    const text = "In today's fast-paced world, we leverage robust systems that are not just useful but transformative.";
    const report = evaluateQuality(text);
    expect(report.verdict).not.toBe("Pass");
    expect(report.structuralViolations.length).toBeGreaterThan(0);
    // Vocabulary is a cue, never a cause: reported as minor, and it costs no trust.
    expect(report.vocabularyViolations.length).toBeGreaterThan(0);
    expect(report.vocabularyViolations.every((v) => v.severity === "minor")).toBe(true);
    expect(report.scores.trust).toBe(10);
    const rewrite = rewriteSlop(text);
    expect(rewrite).not.toContain("In today's fast-paced world");
    expect(rewrite.startsWith("We ")).toBe(true);
    // No cosmetic word swaps, and staged contrast is left for adjudicated revision.
    expect(rewrite).toContain("leverage");
    expect(rewrite).toContain("not just useful but transformative");
  });

  it("never auto-rejects, and charges trust only for missing support", () => {
    const wall = Array.from({ length: 12 }, () => "In today's fast-paced world, it is important to note that studies show this is not just big but huge.").join(" ");
    const report = evaluateQuality(wall);
    expect(report.verdict).not.toBe("Reject");
    expect(report.structuralViolations.some((v) => v.label === "Unnamed authority")).toBe(true);
    expect(report.scores.trust).toBeLessThan(10);
    const clean = evaluateQuality("Our robust checkout cut refunds by 12% in March, per the Stripe dashboard.");
    expect(clean.scores.trust).toBe(10);
  });
});
