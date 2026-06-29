import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateImage, imageStyleDirective, mockImage, persistImage } from "../src/images";
import { buildImageConcept, extractBeats } from "../src/openrouter";

let previousKey: string | undefined;
beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY; // force mock
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
});

describe("image styles", () => {
  it("gives a distinct directive per style and defaults to editorial", () => {
    expect(imageStyleDirective("meme")).toMatch(/meme/i);
    expect(imageStyleDirective("productified")).toMatch(/branded|title card/i);
    expect(imageStyleDirective("diagram")).toMatch(/diagram|schematic/i);
    expect(imageStyleDirective(undefined)).toMatch(/editorial|cinematic/i);
  });
});

describe("mockImage / generateImage (offline)", () => {
  it("returns a data URL placeholder without a key", async () => {
    expect(mockImage("a cover")).toMatch(/^data:image\/svg\+xml,/);
    const result = await generateImage("a cover");
    expect(result.provider).toBe("mock");
    expect(result.url).toMatch(/^data:image\//);
  });
});

describe("buildImageConcept (offline)", () => {
  it("folds in style, identity, and role", async () => {
    const concept = await buildImageConcept("An essay about showing up on the boring days.", {
      style: "meme",
      identity: "art style: warm flat illustration",
      role: "cover"
    });
    expect(concept.toLowerCase()).toContain("meme");
    expect(concept.toLowerCase()).toContain("cover");
  });

  it("renders the title as overlay text for productified covers", async () => {
    const concept = await buildImageConcept("An essay about boring days.", {
      style: "productified",
      role: "cover",
      title: "Show Up Anyway"
    });
    expect(concept).toContain("Show Up Anyway");
  });
});

describe("persistImage", () => {
  it("passes through svg data URLs and served paths unchanged", () => {
    const svg = mockImage("a cover");
    expect(persistImage(svg)).toBe(svg);
    expect(persistImage("/api/images/abc.png")).toBe("/api/images/abc.png");
    expect(persistImage("https://example.com/x.png")).toBe("https://example.com/x.png");
  });

  it("writes a base64 PNG to disk and returns a served path", () => {
    const dir = join(tmpdir(), `gbedu-img-test-${process.pid}`);
    const prev = process.env.IMAGE_DIR;
    process.env.IMAGE_DIR = dir;
    try {
      // 1x1 transparent PNG
      const b64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      const result = persistImage(`data:image/png;base64,${b64}`);
      expect(result).toMatch(/^\/api\/images\/[a-f0-9]+\.png$/);
      expect(existsSync(join(dir, result.replace("/api/images/", "")))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      if (prev === undefined) delete process.env.IMAGE_DIR;
      else process.env.IMAGE_DIR = prev;
    }
  });
});

describe("extractBeats (offline)", () => {
  const article = [
    "# A boring Tuesday",
    "She opens the laptop and stares at the blank page, coffee going cold beside the keyboard.",
    "The cursor blinks. Nothing comes. The temptation is to wait for inspiration that never arrives.",
    "But the work is not the inspiration. The work is the showing up, again, on the unremarkable days.",
    "By evening there are four paragraphs. None are great. All of them exist, which is the whole point."
  ].join("\n\n");

  it("returns the requested number of beats, each with an anchor and scene", async () => {
    const beats = await extractBeats(article, 3);
    expect(beats.length).toBeGreaterThanOrEqual(1);
    expect(beats.length).toBeLessThanOrEqual(3);
    for (const beat of beats) {
      expect(beat.anchor.length).toBeGreaterThan(0);
      expect(beat.scene.length).toBeGreaterThan(0);
    }
  });

  it("bounds the beat count to 6 and never returns empty", async () => {
    const many = await extractBeats(article, 99);
    expect(many.length).toBeLessThanOrEqual(6);
    const fallback = await extractBeats("short", 3);
    expect(fallback.length).toBeGreaterThanOrEqual(1);
  });
});
