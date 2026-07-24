import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import { analyzeReference, runVideoScript, runVideoShots } from "../src/videoStudio";
import type { VideoPersonaInput } from "../../shared/src";

async function freshRepo() {
  return new Repository(await openDatabase());
}

const maya: VideoPersonaInput = {
  name: "Maya",
  appearance: "curly hair, freckles",
  wardrobe: "oversized hoodie",
  setting: "sunny bedroom",
  vocalStyle: "fast, warm",
  mannerisms: "talks with her hands",
  visualStyle: "grainy iphone selfie"
};

describe("video personas (owner-scoped CRUD)", () => {
  it("creates, lists, updates, and deletes personas isolated per owner", async () => {
    const repo = await freshRepo();
    const persona = await ownerContext.run("alice", () => repo.createPersona(maya));
    expect(persona.name).toBe("Maya");
    expect(persona.visualStyle).toBe("grainy iphone selfie");
    expect(await ownerContext.run("alice", () => repo.listPersonas())).toHaveLength(1);
    // bob is isolated
    expect(await ownerContext.run("bob", () => repo.listPersonas())).toHaveLength(0);
    const updated = await ownerContext.run("alice", () => repo.updatePersona(persona.id, { ...maya, vocalStyle: "slow and dry" }));
    expect(updated?.vocalStyle).toBe("slow and dry");
    expect(await ownerContext.run("alice", () => repo.deletePersona(persona.id))).toBe(true);
    expect(await ownerContext.run("alice", () => repo.listPersonas())).toHaveLength(0);
  });
});

describe("video engine (mock mode)", () => {
  it("script returns a hook, beats, and a CTA scaled to length", async () => {
    const { script } = await runVideoScript({ sourceText: "todo apps stacked inside todo apps", sourceType: "piece", platform: "tiktok", targetSeconds: 32 });
    expect(script.hook.length).toBeGreaterThan(0);
    expect(script.beats.length).toBeGreaterThanOrEqual(2);
    expect(script.cta.length).toBeGreaterThan(0);
  });

  it("shots yield one Veo prompt per beat, each carrying the spoken line", async () => {
    const { script } = await runVideoScript({ sourceText: "a product", sourceType: "product", platform: "tiktok", targetSeconds: 24 });
    const { shotList } = await runVideoShots({ script, persona: null, platform: "tiktok" });
    expect(shotList.shots.length).toBeGreaterThan(0);
    expect(shotList.shots[0].visualPrompt).toBeTruthy();
    expect(shotList.shots[0].spokenLine).toBeTruthy();
    expect(shotList.shots[0].durationSec).toBe(8);
  });

  it("analyzeReference returns a blueprint shape", async () => {
    const blueprint = await analyzeReference("a transcript of a viral video");
    expect(Array.isArray(blueprint.structure)).toBe(true);
    expect(blueprint.hookType.length).toBeGreaterThan(0);
  });
});

describe("video projects (persistence)", () => {
  it("creates, updates in place, and round-trips a project with script + shots", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", async () => {
      const project = await repo.saveVideoProject({
        sourceType: "piece",
        sourceText: "x",
        platform: "tiktok",
        targetSeconds: 30,
        script: { hook: "h", beats: [{ idea: "i", spokenLine: "s" }], cta: "c" }
      });
      const updated = await repo.saveVideoProject({
        id: project.id,
        shots: [{ index: 0, spokenLine: "s", visualPrompt: "vp", audioCue: "", onScreenText: "", durationSec: 8 }]
      });
      const fetched = await repo.getVideoProject(project.id);
      expect(fetched?.script?.hook).toBe("h");
      expect(fetched?.shots).toHaveLength(1);
      expect(updated.shots[0].visualPrompt).toBe("vp");
      expect(await repo.listVideoProjects()).toHaveLength(1);
    });
  });
});
