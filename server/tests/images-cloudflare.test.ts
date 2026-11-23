// Cloudflare Workers AI as an image provider: routing, the request it sends,
// the free-allowance message, and motion stills made through it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { openDatabase } from "../src/db";
import { ownerContext } from "../src/context";
import { Repository } from "../src/repository";
import { defaultImageProvider, generateImage, imageProviders, resolveImageRoute } from "../src/images";
import { runMotionStory } from "../src/motionStory";
import { generateMotionStills } from "../src/motionVisuals";

vi.setConfig({ testTimeout: 30_000 });

const KEYS = ["OPENROUTER_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "IMAGE_PROVIDER", "MODEL_IMAGE", "MODEL_IMAGE_CLOUDFLARE"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

const cloudflare = () => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acc-123";
  process.env.CLOUDFLARE_API_TOKEN = "cf-test-token";
};

describe("image provider routing", () => {
  it("falls back from OpenRouter to Cloudflare to offline placeholders", () => {
    expect(defaultImageProvider()).toBe("mock");
    cloudflare();
    expect(defaultImageProvider()).toBe("cloudflare");
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(defaultImageProvider()).toBe("openrouter");
    process.env.IMAGE_PROVIDER = "cloudflare";
    expect(defaultImageProvider()).toBe("cloudflare");
  });

  it("gives each provider a model it can run, and refuses a provider that is not set up", () => {
    process.env.OPENROUTER_API_KEY = "or-key";
    expect(resolveImageRoute(undefined, "openrouter").model).not.toMatch(/^@cf\//);
    expect(() => resolveImageRoute(undefined, "cloudflare")).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    cloudflare();
    // An OpenRouter model id handed to Cloudflare is swapped for Cloudflare's default.
    expect(resolveImageRoute("google/gemini-3-pro-image", "cloudflare")).toEqual({ provider: "cloudflare", model: "@cf/black-forest-labs/flux-1-schnell" });
    expect(resolveImageRoute("@cf/leonardo/phoenix-1.0").provider).toBe("cloudflare");
    expect(imageProviders().map((p) => [p.id, p.configured, p.free])).toEqual([
      ["openrouter", true, false],
      ["cloudflare", true, true]
    ]);
  });
});

describe("Cloudflare requests", () => {
  it("calls the account's Workers AI run endpoint with the prompt and returns a JPEG data URL", async () => {
    cloudflare();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ success: true, result: { image: Buffer.from("jpeg-bytes").toString("base64") } }), { status: 200 });
    });
    const image = await generateImage("x".repeat(3000), undefined, { provider: "cloudflare" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.cloudflare.com/client/v4/accounts/acc-123/ai/run/@cf/black-forest-labs/flux-1-schnell");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer cf-test-token");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.prompt).toHaveLength(2048); // the model's limit
    expect(body.steps).toBe(8);
    expect(Object.keys(body).sort()).toEqual(["prompt", "steps"]); // no seed: the model rejects extra fields
    expect(image.url.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(image.provider).toBe("cloudflare");
    expect(image.cost).toBeGreaterThan(0);
    expect(image.cost).toBeLessThan(0.01);
  });

  it("says plainly when the free daily allowance is used up", async () => {
    cloudflare();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ success: false, errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }] }), { status: 429 }));
    await expect(generateImage("a lamp", undefined, { provider: "cloudflare" })).rejects.toThrow(/free daily picture allowance is used up/);
  });
});

describe("motion stills through Cloudflare", () => {
  it("generates, finishes and prices the planned stills with the provider the writer picked", async () => {
    cloudflare();
    const jpeg = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#7f8a96" } }).jpeg().toBuffer();
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ success: true, result: { image: jpeg.toString("base64") } }), { status: 200 });
    });
    const repo = new Repository(await openDatabase());
    await ownerContext.run("vera", async () => {
      const { story } = await runMotionStory({ text: "# T\n\nLook back at the wreckage. Those shadows felt like giants. The monster became a pile of laundry. They are not walls. They are weights. All is well.", targetSeconds: 30 });
      process.env.OPENROUTER_API_KEY = "or-key-not-used"; // present, but the writer picked Cloudflare
      const result = await generateMotionStills({ story, repo, provider: "cloudflare" });
      const made = result.beats.filter((beat) => beat.visual?.status === "generated" && beat.visual.kind !== "icon");
      expect(made.length).toBeGreaterThan(0);
      expect(urls.every((u) => u.includes("/ai/run/@cf/"))).toBe(true); // never OpenRouter
      for (const beat of made) {
        expect(beat.visual!.provider).toBe("cloudflare");
        expect((await repo.getImageBlob(beat.visual!.imageId!))?.mime).toBe("image/png");
      }
      expect(result.spent).toBeCloseTo(made.length * 0.0011, 6);
    });
  });
});
