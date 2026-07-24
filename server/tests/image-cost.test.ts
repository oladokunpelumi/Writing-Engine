import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { anchorImageModel, imageModel } from "../src/images";
import { modelFor } from "../src/openrouter";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";

const keys = ["MODEL_PROFILE", "MODEL_IMAGE", "MODEL_IMAGE_ANCHOR", "IMAGE_COST_USD"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of keys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("image model tiering", () => {
  it("routes everyday images by profile — cost-first is the cheap tier, not the premium one", () => {
    process.env.MODEL_PROFILE = "cost-first";
    expect(imageModel()).toBe("google/gemini-3.1-flash-lite-image");
    process.env.MODEL_PROFILE = "balanced";
    expect(imageModel()).toBe("google/gemini-3.1-flash-image");
    process.env.MODEL_PROFILE = "premium";
    expect(imageModel()).toBe("google/gemini-3-pro-image");
  });

  it("defaults to the cheap tier when no profile is set (regression: used to be premium)", () => {
    expect(imageModel()).toBe("google/gemini-3.1-flash-lite-image");
  });

  it("keeps the persona anchor on the premium tier even under cost-first", () => {
    process.env.MODEL_PROFILE = "cost-first";
    expect(anchorImageModel()).toBe("google/gemini-3-pro-image");
  });

  it("honours explicit env pins over the profile", () => {
    process.env.MODEL_PROFILE = "cost-first";
    process.env.MODEL_IMAGE = "openai/gpt-5-image-mini";
    process.env.MODEL_IMAGE_ANCHOR = "google/gemini-2.5-flash-image";
    expect(imageModel()).toBe("openai/gpt-5-image-mini");
    expect(anchorImageModel()).toBe("google/gemini-2.5-flash-image");
  });

  it("exposes the image tier through modelFor so routing/admin reflects it", () => {
    process.env.MODEL_PROFILE = "cost-first";
    expect(modelFor("image")).toBe("google/gemini-3.1-flash-lite-image");
  });
});

describe("persona anchor caching", () => {
  it("caches the anchor and clears it when the persona's look changes", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("alice", async () => {
      const persona = await repo.createPersona({
        name: "Maya",
        appearance: "curly hair",
        wardrobe: "hoodie",
        setting: "bedroom",
        vocalStyle: "warm",
        mannerisms: "",
        visualStyle: "grainy selfie"
      });
      expect(persona.anchorImageUrl).toBeUndefined();

      const anchored = await repo.setPersonaAnchor(persona.id, "/api/images/abc");
      expect(anchored?.anchorImageUrl).toBe("/api/images/abc");

      // Editing something cosmetic-but-not-visual keeps the cached anchor (free reruns).
      const sameLook = await repo.updatePersona(persona.id, {
        name: "Maya B",
        appearance: "curly hair",
        wardrobe: "hoodie",
        setting: "bedroom",
        vocalStyle: "dry",
        mannerisms: "",
        visualStyle: "grainy selfie"
      });
      expect(sameLook?.anchorImageUrl).toBe("/api/images/abc");

      // Changing the LOOK invalidates it, so the next storyboard regenerates.
      const newLook = await repo.updatePersona(persona.id, {
        name: "Maya B",
        appearance: "shaved head",
        wardrobe: "hoodie",
        setting: "bedroom",
        vocalStyle: "dry",
        mannerisms: "",
        visualStyle: "grainy selfie"
      });
      expect(newLook?.anchorImageUrl).toBeUndefined();
    });
  });
});
