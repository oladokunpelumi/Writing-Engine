// Pictures for motion stories: planning, prompts, finishing in the look,
// generation under the cap, re-finishing, and the exported build.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Finishing runs a per-pixel pass over full-size frames; give it room under a parallel suite.
vi.setConfig({ testTimeout: 30_000 });
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { MOTION_LOOKS, type VideoProject } from "../../shared/src";
import { openDatabase } from "../src/db";
import { ownerContext } from "../src/context";
import { Repository } from "../src/repository";
import { applyMotionEdit, buildMotionPieceFolder, checkMotionWords, negatedWord, runMotionStory } from "../src/motionStory";
import {
  MAX_STILLS,
  MIN_STILLS,
  buildStillPrompt,
  finishForLook,
  generateMotionStills,
  iconFor,
  iconSvg,
  planMotionVisuals,
  refinishMotionStills
} from "../src/motionVisuals";

const savedKey = process.env.OPENROUTER_API_KEY;
beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = savedKey;
});

const PIECE = `# The Rearview

Look back at the wreckage. Scan the archives of your memory.

Back then, those shadows felt like giants. But look at them now.

The monster under the bed became just a pile of laundry.

You treat these like walls. They are not walls. They are weights. And weights are meant to be lifted.

All is well, because you are here to make it so.`;

const project = () => ({ id: "p1", title: "The Rearview", audience: "", sourceText: PIECE, sources: [] }) as unknown as VideoProject;

describe("pictures — planning and prompts", () => {
  it("plans 2-4 pictures, one hero shot on the hook, none on the payoff", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 45 });
    const pictured = story.beats.filter((beat) => beat.visual && beat.visual.kind !== "icon");
    expect(pictured.length).toBeGreaterThanOrEqual(MIN_STILLS);
    expect(pictured.length).toBeLessThanOrEqual(MAX_STILLS);
    expect(story.beats.filter((beat) => beat.visual?.kind === "video-shot")).toHaveLength(1);
    expect(story.beats[0].visual?.kind).toBe("video-shot");
    expect(story.beats.at(-1)?.visual).toBeUndefined();
    expect(story.visualBudgetUsd).toBe(3);
    expect(story.visualSpendUsd).toBe(0);
  });

  it("keeps the writer's pictures when re-planning", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const mine = { ...story, beats: story.beats.map((beat, i) => (i === 2 ? { ...beat, visual: { kind: "icon" as const, placement: "object" as const, subject: "weight", prompt: "", icon: "weight", motion: "", seconds: 5, status: "generated" as const, cost: 0 } } : { ...beat, visual: undefined })) };
    const planned = planMotionVisuals(mine);
    expect(planned[2].visual?.icon).toBe("weight");
  });

  it("matches icons by exact name only", () => {
    expect(iconFor(["weights"])).toBe("weight");
    expect(iconFor(["car"])).toBe("car");
    expect(iconFor(["walls"])).toBeUndefined(); // no loose tag hits
    const svg = iconSvg("weight", "#C26B2C", 2);
    expect(svg).toContain('stroke="#C26B2C"');
    expect(svg).toContain('pathLength="1"');
    expect(svg).not.toContain("<!--");
  });

  it("builds prompts from the beat, the look and fixed no-text rules", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const beat = story.beats.find((b) => b.visual && b.visual.kind !== "icon")!;
    for (const look of Object.values(MOTION_LOOKS)) {
      const prompt = buildStillPrompt({ look, visual: beat.visual!, beat, oneThing: story.oneThing });
      expect(prompt).toContain(beat.sourceQuote);
      expect(prompt).toMatch(/No text, letters, numbers/);
      expect(prompt).toMatch(/No real or recognisable people/);
    }
    // One raw serves every look: the prompt never changes with the look, and asks for an evenly lit photo.
    const prompts = Object.values(MOTION_LOOKS).map((look) => buildStillPrompt({ look, visual: beat.visual!, beat, oneThing: story.oneThing }));
    expect(new Set(prompts).size).toBe(1);
    expect(prompts[0]).toMatch(/evenly lit/);
    expect(prompts[0]).not.toMatch(/low-light|near-black|engraving|risograph/);
    const object = buildStillPrompt({ look: MOTION_LOOKS["riso-print"], visual: { ...beat.visual!, placement: "object" }, beat, oneThing: "" });
    expect(object).toMatch(/chroma-key green backdrop/);
    const laundry = buildStillPrompt({ visual: { ...beat.visual!, placement: "object", subject: "a small pile of folded laundry" }, beat, oneThing: "x" });
    expect(laundry).toContain("of a single small pile of folded laundry"); // no doubled article
    expect(laundry).not.toMatch(/"\./);
  });
});

describe("pictures — kept through the writer's edits", () => {
  it("keeps every picture, with the writer's new subject, when the story is saved or re-timed", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const pictured = story.beats.findIndex((beat) => beat.visual && beat.visual.kind !== "icon");
    expect(pictured).toBeGreaterThanOrEqual(0);
    const beats = story.beats.map((beat, i) => (i === pictured ? { ...beat, visual: { ...beat.visual!, subject: "a brass pendulum" }, end: beat.end + 0.5 } : beat));
    const saved = applyMotionEdit(story, { beats, oneThing: "They are weights." });
    expect(saved.beats.filter((beat) => beat.visual).length).toBe(story.beats.filter((beat) => beat.visual).length);
    expect(saved.beats[pictured].visual?.subject).toBe("a brass pendulum");
  });

  it("with no hint from the story model, pictures the line itself instead of a keyword list", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 }); // offline: no hints
    const beat = story.beats.find((b) => b.visual && b.visual.kind !== "icon")!;
    expect(beat.visual!.subject).toBe("");
    const prompt = buildStillPrompt({ visual: beat.visual!, beat, oneThing: story.oneThing });
    expect(prompt).toMatch(/pictures the line below|stands for the line below/);
    expect(prompt).toContain(beat.sourceQuote);
  });

  it("strikes the negated thing, not the word after 'not'", () => {
    expect(negatedWord("You are not moving from lack.")).toBe("lack");
    expect(negatedWord("That is not small.")).toBe("small");
    expect(negatedWord("They are not walls. They are weights.")).toBe("walls");
    expect(negatedWord("It is not about the money but the time")).toBe("money");
    expect(negatedWord("Nothing to see here")).toBeUndefined();
  });
});

describe("pictures — finishing in the look", () => {
  it("bakes stills into each look at plate and object sizes, in the look's palette", async () => {
    const src = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#808080" } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><circle cx="300" cy="380" r="160" fill="#111"/><circle cx="260" cy="320" r="40" fill="#fff"/></svg>') }])
      .png()
      .toBuffer();
    for (const look of Object.values(MOTION_LOOKS)) {
      const plate = await sharp(await finishForLook(src, look, "plate")).metadata();
      expect([plate.width, plate.height]).toEqual([1080, 1920]);
      const objectPng = await finishForLook(src, look, "object");
      const { data, info } = await sharp(objectPng).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([900, 900]);
      // The top-left corner (grey in the source) lands near the look's own colours, not the source's grey.
      const [r, g, b] = [data[0], data[1], data[2]];
      expect(Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b) > 4 || look.id === "paper-ember").toBe(true);
    }
  });

  it("keys a green-screen object by colour: the shadow on the green goes, a white object stays and gets an outline", async () => {
    const src = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#00B140" } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect x="250" y="420" width="260" height="200" fill="#006a26"/><rect x="380" y="380" width="300" height="240" fill="#f4f4f2"/></svg>') }])
      .png()
      .toBuffer();
    for (const look of Object.values(MOTION_LOOKS)) {
      const { data } = await sharp(await finishForLook(src, look, "object")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const ground = [1, 3, 5].map((i) => parseInt(look.palette.ground.slice(i, i + 2), 16));
      const off = (x: number, y: number) => [0, 1, 2].reduce((sum, c) => sum + Math.abs(data[(y * 900 + x) * 3 + c] - ground[c]), 0) / 3;
      // Scan the middle row: the shadow (left of the white card) is ground; the card's edges are drawn.
      const row = [...Array(900).keys()].map((x) => off(x, 450));
      const firstDrawn = row.findIndex((v) => v > 40);
      expect(firstDrawn).toBeGreaterThan(0);
      // Left of the card's edge, where the dark-green shadow was, sits at the ground.
      const shadowZone = row.slice(Math.max(0, firstDrawn - 120), firstDrawn - 8);
      expect(Math.max(...shadowZone)).toBeLessThan(14);
    }
  });

  it("cuts objects out: transparent around them, opaque on them", async () => {
    const src = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#00B140" } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect x="380" y="380" width="300" height="240" fill="#f4f4f2"/></svg>') }])
      .png()
      .toBuffer();
    for (const look of Object.values(MOTION_LOOKS)) {
      const { data, info } = await sharp(await finishForLook(src, look, "object")).raw().toBuffer({ resolveWithObject: true });
      expect(info.channels).toBe(4);
      expect(data[3]).toBe(0); // corner
      expect(data[(450 * 900 + 450) * 4 + 3]).toBe(255); // centre of the object
    }
    const plate = await sharp(await finishForLook(src, MOTION_LOOKS["paper-ember"], "plate")).metadata();
    expect(plate.channels).toBe(3); // plates stay opaque
  });

  it("fills holes the key punched inside an object (green spill on a shiny surface)", async () => {
    // A brass disc on green, with a band across it that reflects the backdrop.
    const src = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#00B140" } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><circle cx="512" cy="512" r="300" fill="#b8923c"/><rect x="262" y="490" width="500" height="44" fill="#1fae45"/></svg>') }])
      .png()
      .toBuffer();
    const { data } = await sharp(await finishForLook(src, MOTION_LOOKS["night-signal"], "object")).raw().toBuffer({ resolveWithObject: true });
    expect(data[(450 * 900 + 450) * 4 + 3]).toBe(255); // the reflected band, mid-object, is opaque
    expect(data[3]).toBe(0); // the backdrop is still cut away
  });

  it("trims a small object so it fills its slot, whatever size the model drew it", async () => {
    const src = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#d8d8d8" } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect x="440" y="560" width="150" height="110" fill="#3a4a60"/></svg>') }])
      .png()
      .toBuffer();
    const look = MOTION_LOOKS["paper-ember"]; // a dark object draws as ink here
    const { data } = await sharp(await finishForLook(src, look, "object")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const ground = [1, 3, 5].map((i) => parseInt(look.palette.ground.slice(i, i + 2), 16));
    let drawn = 0;
    for (let x = 0; x < 900; x++) {
      const at = (450 * 900 + x) * 3;
      if ([0, 1, 2].some((c) => Math.abs(data[at + c] - ground[c]) > 20)) drawn += 1;
    }
    // Untrimmed it spans ~15% of the width; trimmed (with the 2.5x enlargement cap) ~37%.
    expect(drawn / 900).toBeGreaterThan(0.3);
    expect(drawn / 900).toBeLessThan(0.5);
  });

  it("keys an object's plain background to the look's ground, dark or light, so it never shows as a square", async () => {
    for (const background of ["#121212", "#EDEDED"]) {
      const src = await sharp({ create: { width: 600, height: 600, channels: 3, background } })
        .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g"><stop offset="0" stop-color="#2a2a2a"/><stop offset="1" stop-color="#d0d0d0"/></linearGradient></defs><circle cx="300" cy="300" r="190" fill="url(#g)"/></svg>') }])
        .png()
        .toBuffer();
      for (const look of Object.values(MOTION_LOOKS)) {
        const { data } = await sharp(await finishForLook(src, look, "object")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const ground = [1, 3, 5].map((i) => parseInt(look.palette.ground.slice(i, i + 2), 16));
        for (const at of [0, (20 * 900 + 880) * 3]) {
          for (let c = 0; c < 3; c++) expect(Math.abs(data[at + c] - ground[c])).toBeLessThan(12);
        }
        // The object itself is still drawn, not keyed away: across its middle band the
        // pixels sit well off the ground on average.
        let off = 0;
        let n = 0;
        for (let x = 200; x < 700; x += 2) {
          const at = (450 * 900 + x) * 3;
          off += [0, 1, 2].reduce((sum, c) => sum + Math.abs(data[at + c] - ground[c]), 0) / 3;
          n += 1;
        }
        expect(off / n).toBeGreaterThan(15);
      }
    }
  });
});

describe("pictures — generation under the cap", () => {
  it("generates, finishes and stores planned stills offline, then re-finishes for a new look for free", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("vera", async () => {
      const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30, look: "paper-ember" });
      const result = await generateMotionStills({ story, repo });
      const done = result.beats.filter((beat) => beat.visual?.status === "generated" && beat.visual.kind !== "icon");
      expect(done.length).toBeGreaterThanOrEqual(MIN_STILLS);
      expect(result.spent).toBe(0); // offline placeholders cost nothing
      for (const beat of done) {
        expect(beat.visual!.finishedFor).toBe("paper-ember");
        const blob = await repo.getImageBlob(beat.visual!.imageId!);
        expect(blob?.mime).toBe("image/png");
        expect(await repo.getImageBlob(beat.visual!.rawImageId!)).toBeTruthy();
      }
      const refinished = await refinishMotionStills({ ...story, beats: result.beats, look: "night-signal" }, repo);
      for (const beat of refinished.filter((b) => b.visual?.rawImageId)) {
        expect(beat.visual!.finishedFor).toBe("night-signal");
        expect(beat.visual!.imageId).not.toBe(done.find((d) => d.sceneId === beat.sceneId)?.visual?.imageId);
      }
    });
  });

  it("stops before the call when a picture would pass the cap", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("vera", async () => {
      const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
      process.env.OPENROUTER_API_KEY = "test-key-not-used"; // makes the estimate real; the cap stops us first
      const result = await generateMotionStills({ story: { ...story, visualSpendUsd: 3 }, repo });
      const stills = result.beats.filter((beat) => beat.visual && beat.visual.kind !== "icon");
      expect(stills.every((beat) => beat.visual!.status === "over-budget")).toBe(true);
      expect(result.spent).toBe(3);
      expect(result.generated).toBe(0);
    });
  });
});

describe("pictures — export and build", () => {
  it("ships finished stills and icons, and the builder puts them on screen", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("vera", async () => {
      const { story } = await runMotionStory({ text: PIECE, title: "The Rearview", targetSeconds: 30, look: "riso-print" });
      const withIcon = { ...story, beats: story.beats.map((beat, i) => (i === 2 && !beat.visual ? { ...beat, visual: { kind: "icon" as const, placement: "object" as const, subject: "weight", prompt: "", icon: "weight", motion: "", seconds: 5, status: "generated" as const, cost: 0 } } : beat)) };
      const result = await generateMotionStills({ story: withIcon, repo });
      const generated = { ...withIcon, beats: result.beats };
      const gate = await checkMotionWords({ story: generated, pieceText: PIECE });
      const stills: Record<string, Buffer> = {};
      for (const beat of generated.beats) if (beat.visual?.imageId) stills[beat.sceneId] = (await repo.getImageBlob(beat.visual.imageId))!.data;
      const { files } = buildMotionPieceFolder(project(), { ...generated, wordsGate: gate, approved: true }, stills);
      const paths = files.map((f) => f.path);
      for (const sceneId of Object.keys(stills)) expect(paths).toContain(`assets/visuals/${sceneId}.png`);
      expect(paths.some((p) => p.endsWith(".svg") && p.startsWith("assets/visuals/"))).toBe(true);
      expect(paths).toContain("work/motion-kit/shots.mjs");
      const contract = JSON.parse(String(files.find((f) => f.path === "story.json")!.content));
      expect(contract.contract).toBe("co-create.motion-story/2");
      expect(contract.pictures.budgetUsd).toBe(3);
      const hero = contract.beats.find((b: { visual?: { kind: string } }) => b.visual?.kind === "video-shot");
      expect(hero.visual.video.prompt).toMatch(/no text/);

      const dir = mkdtempSync(join(tmpdir(), "motion-pictures-"));
      for (const file of files) {
        mkdirSync(dirname(join(dir, file.path)), { recursive: true });
        writeFileSync(join(dir, file.path), file.content);
      }
      execFileSync(process.execPath, [join(dir, "work", "motion-kit", "build.mjs"), dir]);
      const scenes = Object.keys(stills).map((sceneId) => readFileSync(join(dir, "video", "compositions", `b${Number(sceneId.split("-")[1])}.html`), "utf8"));
      expect(scenes.some((html) => html.includes('class="plate"') || html.includes('class="object"'))).toBe(true);
      const iconScene = readFileSync(join(dir, "video", "compositions", "b3.html"), "utf8");
      expect(iconScene).toContain('class="icon"');
      expect(readFileSync(join(dir, "video", "assets", "visuals", Object.keys(stills)[0] + ".png")).length).toBeGreaterThan(1000);
    });
  });
});
