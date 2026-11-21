// Pictures for motion stories.
//
//   planMotionVisuals   — choose 2-4 beats for generated stills (at most one
//                         hero video shot) and icons where a key word matches.
//   buildStillPrompt    — subject + the beat's own sentence + the look's art
//                         direction + fixed rules (no text, no real faces).
//   finishForLook       — bake the still into the look's medium: an ink
//                         engraving for Paper & Ember, a two-plate halftone for
//                         Riso Print, an asphalt-to-amber duotone for Night
//                         Signal. Plates fade where the words sit.
//   generateMotionStills — generate, finish and store, under the story's cap.
//
// Pictures never carry words. Every word on screen stays HyperFrames type.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import sharp from "sharp";
import type { MotionBeat, MotionLook, MotionStory, MotionVisual } from "../../shared/src";
import { DEFAULT_MOTION_LOOK, MOTION_LOOKS } from "../../shared/src";
import { estimateImageCost, generateImage, imageModel } from "./images";
import type { Repository } from "./repository";

export const MIN_STILLS = 2;
export const MAX_STILLS = 4;
export const MAX_ICONS = 3;
export const DEFAULT_VISUAL_BUDGET_USD = 3;

const STOP = new Set(
  "a an the and or but so of to in on at by for with from into onto over under is are was were be been being it its this that these those you your yours i me my we our they them their he she his her not no just then than as if when what who how why all any each every some more most very can will would should could do does did have has had look looks looked see saw seen scan felt feel feels became become becomes make makes made treat treats meant mean means get gets got know knew keep kept back here there now".split(
    " "
  )
);

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];

/** Concrete-looking words of a beat, most telling first (emphasis, then longer nouns). */
function keyWords(beat: MotionBeat): string[] {
  const emphasis = beat.emphasis.map((w) => w.toLowerCase().replace(/[^a-z'-]/g, "")).filter(Boolean);
  const rest = wordsOf(`${beat.lines.join(" ")} ${beat.sourceQuote}`)
    .filter((w) => !STOP.has(w) && w.length > 2)
    .sort((a, b) => b.length - a.length);
  return [...new Set([...emphasis, ...rest])];
}

// ---------------------------------------------------------------------------
// Icons (Lucide, ISC)
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);
let lucideDir: string | null = null;
let lucideTags: Record<string, string[]> | null = null;

function lucide() {
  if (!lucideDir) {
    lucideDir = dirname(require.resolve("lucide-static/package.json"));
    lucideTags = JSON.parse(readFileSync(join(lucideDir, "tags.json"), "utf8")) as Record<string, string[]>;
  }
  return { dir: lucideDir, tags: lucideTags! };
}

const singular = (w: string) => (w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/**
 * The Lucide icon whose name IS one of the words ("weights" -> weight, "car" ->
 * car), or a two-part name that starts with the word and is tagged with it.
 * Loose tag hits ("walls" -> lamp-wall-down) are not icons for the idea.
 */
export function iconFor(words: string[]): string | undefined {
  const { tags } = lucide();
  for (const raw of words) {
    const word = singular(raw.toLowerCase().replace(/[^a-z-]/g, ""));
    if (word.length < 3) continue;
    if (tags[word]) return word;
    const pair = Object.keys(tags).find((name) => {
      const parts = name.split("-");
      return parts.length === 2 && parts[0] === word && tags[name].includes(word);
    });
    if (pair) return pair;
  }
  return undefined;
}

export function iconExists(name: string): boolean {
  if (!/^[a-z0-9-]+$/.test(name)) return false;
  try {
    readFileSync(join(lucide().dir, "icons", `${name}.svg`));
    return true;
  } catch {
    return false;
  }
}

/** A Lucide icon as standalone SVG, recoloured and with every shape normalised for draw-on. */
export function iconSvg(name: string, color = "currentColor", strokeWidth = 2): string {
  if (!iconExists(name)) throw new Error(`Unknown icon "${name}"`);
  const raw = readFileSync(join(lucide().dir, "icons", `${name}.svg`), "utf8").replace(/<!--[\s\S]*?-->\s*/g, "");
  return raw
    .replace(/class="[^"]*"\s*/, "")
    .replace(/stroke="currentColor"/, `stroke="${color}"`)
    .replace(/stroke-width="[^"]*"/, `stroke-width="${strokeWidth}"`)
    .replace(/<(path|circle|line|rect|polyline|polygon|ellipse)\b/g, '<$1 pathLength="1"')
    .trim();
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/**
 * Pick the beats that get pictures. Stills go where a concrete thing can be
 * pictured: the hook first (it also becomes the one hero video shot), then
 * turns with concrete words. The payoff stays words. Beats that read as
 * proof or carry a figure prefer an icon. Writer edits win: a beat that
 * already has a visual keeps it.
 */
export function planMotionVisuals(story: MotionStory, hints: Array<string | undefined> = []): MotionBeat[] {
  const beats = story.beats.map((beat) => ({ ...beat }));
  const want = Math.max(MIN_STILLS, Math.min(MAX_STILLS, Math.round(beats.length / 2.5)));
  const existing = beats.filter((b) => b.visual && b.visual.kind !== "icon").length;
  let stills = existing;
  let icons = beats.filter((b) => b.visual?.kind === "icon").length;

  const scored = beats
    .map((beat, index) => {
      if (beat.visual || beat.role === "payoff") return { index, score: -1 };
      let score = beat.role === "hook" ? 10 : 0;
      if (hints[index]) score += 3; // the story model saw something worth picturing here
      score += Math.min(4, keyWords(beat).filter((w) => w.length >= 5).length);
      if (/\d/.test(beat.lines.join(" "))) score -= 3; // figures read better as type
      if (beat.treatment === "strike" || beat.treatment === "focus") score -= 2; // the type is already the picture
      return { index, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  let hero = beats.some((b) => b.visual?.kind === "video-shot");
  for (const { index } of scored) {
    if (stills >= want) break;
    const beat = beats[index];
    const subject = hints[index]?.trim() || keyWords(beat).slice(0, 3).join(", ");
    const isHero = !hero && beat.role === "hook";
    beats[index] = {
      ...beat,
      visual: {
        kind: isHero ? "video-shot" : "still",
        placement: stills % 2 === 0 ? "plate" : "object",
        subject,
        prompt: "",
        motion: "slow push in",
        seconds: 5,
        status: "planned",
        cost: 0
      }
    };
    if (isHero) hero = true;
    stills += 1;
  }

  for (const [index, beat] of beats.entries()) {
    if (icons >= MAX_ICONS) break;
    if (beat.visual || beat.role === "payoff" || beat.role === "hook") continue;
    const icon = iconFor(keyWords(beat));
    if (!icon) continue;
    beats[index] = { ...beat, visual: { kind: "icon", placement: "object", subject: icon, prompt: "", icon, motion: "", seconds: 5, status: "generated", cost: 0 } };
    icons += 1;
  }
  return beats;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const ART_DIRECTION: Record<string, string> = {
  "paper-ember":
    "Rendered as a fine ink engraving or etching: dense parallel hatching and cross-hatching, strong tonal contrast, black ink on warm off-white paper, no colour, timeless editorial illustration.",
  "night-signal":
    "A cinematic low-light photograph: one warm practical light source, deep near-black shadows, warm amber highlights, film grain, quiet and still, shot on a 35 mm lens.",
  "riso-print":
    "Bold flat graphic shapes made for a two-colour risograph print: strong simple silhouettes, high contrast, minimal detail, generous negative space, cream paper."
};

const RULES =
  "No text, letters, numbers, signs, labels, logos, watermarks or interface elements anywhere in the image. No real or recognisable people; if a person appears, show them from behind or as a silhouette. Not a chart, graph or diagram.";

export function buildStillPrompt(input: { look: MotionLook; visual: MotionVisual; beat: MotionBeat; oneThing: string }): string {
  const { look, visual, beat, oneThing } = input;
  const subject = visual.subject.trim() || keyWords(beat).slice(0, 3).join(", ");
  const bare = subject.replace(/^(a|an|the|one)\s+/i, "");
  const frame =
    visual.placement === "plate"
      ? `A vertical 9:16 image of ${subject}. Keep the top 60% of the frame calm, simple and low in detail, because words will sit there; put the subject in the lower half.`
      : `A single ${bare}, centred and isolated on a plain, flat, evenly coloured background in ${look.palette.ground} with no cast shadow, filling about 70% of a square frame with even margins.`;
  return [
    frame,
    `It pictures this line from a personal essay: "${beat.sourceQuote.trim()}"`,
    oneThing ? `The essay's point: "${oneThing.trim()}"` : "",
    ART_DIRECTION[look.id] ?? "",
    RULES
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Finishing: bake a still into the look's medium (deterministic pixels)
// ---------------------------------------------------------------------------

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Dot coverage for a halftone screen at a rotated grid. */
function dot(x: number, y: number, cell: number, angle: number, density: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const u = (x * c + y * s) / cell, v = (-x * s + y * c) / cell;
  const du = u - Math.floor(u) - 0.5, dv = v - Math.floor(v) - 0.5;
  const dist = Math.sqrt(du * du + dv * dv);
  const radius = Math.sqrt(clamp01(density) / Math.PI);
  return 1 - smooth(radius - 0.06, radius + 0.06, dist);
}

export async function finishForLook(input: Buffer, look: MotionLook, placement: MotionVisual["placement"]): Promise<Buffer> {
  const W = placement === "plate" ? 1080 : 900;
  const H = placement === "plate" ? 1920 : 900;
  const { data } = await sharp(input)
    .resize(W, H, { fit: "cover", position: "attention" })
    .removeAlpha()
    .grayscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(W * H * 3);

  // Objects: key out the plain background (read from the border) so it becomes the
  // look's ground in every look, whatever colour the picture was generated on.
  // Without this a dark-ground object turns into a black square in a light look.
  let mask: Buffer | undefined;
  let bg = 0;
  if (placement === "object") {
    mask = await sharp(input).resize(W, H, { fit: "cover", position: "attention" }).removeAlpha().grayscale().normalise().blur(4).raw().toBuffer();
    const ring: number[] = [];
    const margin = Math.round(W * 0.03);
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (x < margin || y < margin || x >= W - margin || y >= H - margin) ring.push(mask[y * W + x]);
    ring.sort((a, b) => a - b);
    bg = ring[ring.length >> 1] / 255;
  }

  const ground = hex(look.palette.ground);
  const ink = hex(look.palette.ink);
  const second = hex(look.palette.second);
  const accent = hex(look.palette.accent);

  for (let y = 0; y < H; y++) {
    // Plates fade towards the ground where the words sit (top ~60%), so type keeps its contrast.
    const keep = placement === "plate" ? 0.18 + 0.82 * smooth(H * 0.5, H * 0.72, y) : 1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const lum = data[i] / 255;
      let r: number, g: number, b: number;
      if (look.id === "paper-ember") {
        // Engraving: parallel lines whose width follows the darkness.
        const t = (Math.sin(((x * 0.34 + y * 0.94) * 2 * Math.PI) / 7) + 1) / 2;
        const darkness = (1 - (lum * 0.88 + 0.08)) * keep;
        const amount = smooth(t - 0.12, t + 0.12, darkness);
        r = ground[0] + (ink[0] - ground[0]) * amount;
        g = ground[1] + (ink[1] - ground[1]) * amount;
        b = ground[2] + (ink[2] - ground[2]) * amount;
      } else if (look.id === "riso-print") {
        // Two plates on paper, multiplied: blue carries the shadows, orange the mid-tones, off register.
        const a = dot(x, y, 11, 0.26, Math.pow(1 - lum, 1.15) * keep);
        const m = 4 * lum * (1 - lum);
        const o = dot(x - 3, y - 2, 11, 1.31, m * 0.8 * keep);
        r = ground[0] * (1 - a * (1 - ink[0])) * (1 - o * (1 - second[0]));
        g = ground[1] * (1 - a * (1 - ink[1])) * (1 - o * (1 - second[1]));
        b = ground[2] * (1 - a * (1 - ink[2])) * (1 - o * (1 - second[2]));
      } else {
        // Night: asphalt to amber duotone, kept low under the words, with fixed grain.
        const l = clamp01(lum * (0.35 + 0.65 * keep) * 0.92 + (hash(x, y) - 0.5) * 0.05);
        const mid = [0.29, 0.23, 0.15];
        const lo = ground;
        const hi = accent;
        const blend = (p: number, q: number, t: number) => p + (q - p) * t;
        if (l < 0.6) {
          const t = l / 0.6;
          r = blend(lo[0], mid[0], t); g = blend(lo[1], mid[1], t); b = blend(lo[2], mid[2], t);
        } else {
          const t = (l - 0.6) / 0.4;
          r = blend(mid[0], hi[0], t); g = blend(mid[1], hi[1], t); b = blend(mid[2], hi[2], t);
        }
      }
      if (mask) {
        const k = smooth(0.07, 0.2, Math.abs(mask[i] / 255 - bg));
        r = ground[0] + (r - ground[0]) * k;
        g = ground[1] + (g - ground[1]) * k;
        b = ground[2] + (b - ground[2]) * k;
      }
      const grain = look.id === "night-signal" ? 0 : (hash(x + 7, y + 3) - 0.5) * 0.035;
      out[i * 3] = Math.round(clamp01(r + grain) * 255);
      out[i * 3 + 1] = Math.round(clamp01(g + grain) * 255);
      out[i * 3 + 2] = Math.round(clamp01(b + grain) * 255);
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Generation under the story's cap
// ---------------------------------------------------------------------------

function dataUrlToBuffer(url: string): Buffer {
  const base64 = url.match(/^data:[^;]+;base64,(.+)$/);
  if (base64) return Buffer.from(base64[1], "base64");
  const utf8 = url.match(/^data:([^,]+),(.*)$/s);
  if (utf8) return Buffer.from(decodeURIComponent(utf8[2]), "utf8");
  throw new Error("Image came back in an unexpected format");
}

async function storePng(repo: Repository, png: Buffer, meta: { prompt: string; provider: "mock" | "openrouter"; role: "motion-raw" | "motion-still"; caption: string; style: string }) {
  return repo.saveImage({ url: `data:image/png;base64,${png.toString("base64")}`, ...meta });
}

export interface StillsResult {
  beats: MotionBeat[];
  spent: number;
  generated: number;
  skipped: number;
}

/**
 * Generate every planned still (and each hero shot's first frame) that is not
 * done yet, finish it in the story's look, and store raw and finished images.
 * A beat is skipped, not generated, when it would take spend past the cap.
 */
export async function generateMotionStills(input: { story: MotionStory; repo: Repository; sceneIds?: string[]; model?: string }): Promise<StillsResult> {
  const { story, repo } = input;
  const look = MOTION_LOOKS[story.look ?? DEFAULT_MOTION_LOOK];
  const budget = story.visualBudgetUsd ?? DEFAULT_VISUAL_BUDGET_USD;
  const model = input.model ?? imageModel();
  let spent = story.visualSpendUsd ?? 0;
  let generated = 0;
  let skipped = 0;
  const beats: MotionBeat[] = [];
  for (const beat of story.beats) {
    const v = beat.visual;
    const wanted = v && v.kind !== "icon" && (input.sceneIds ? input.sceneIds.includes(beat.sceneId) : v.status !== "generated");
    if (!v || !wanted) {
      beats.push(beat);
      continue;
    }
    const estimate = process.env.OPENROUTER_API_KEY ? estimateImageCost(model) : 0;
    if (spent + estimate > budget + 1e-9) {
      beats.push({ ...beat, visual: { ...v, status: "over-budget", error: `Would pass the $${budget.toFixed(2)} cap for this story.` } });
      skipped += 1;
      continue;
    }
    const prompt = buildStillPrompt({ look, visual: v, beat, oneThing: story.oneThing });
    try {
      const image = await generateImage(prompt, model);
      const cost = image.cost ?? estimate;
      spent += cost;
      const raw = await sharp(dataUrlToBuffer(image.url)).png().toBuffer();
      const finished = await finishForLook(raw, look, v.placement);
      const rawAsset = await storePng(repo, raw, { prompt, provider: image.provider, role: "motion-raw", caption: v.subject, style: "raw" });
      const finishedAsset = await storePng(repo, finished, { prompt, provider: image.provider, role: "motion-still", caption: v.subject, style: look.id });
      beats.push({
        ...beat,
        visual: { ...v, prompt, status: "generated", rawImageId: rawAsset.id, imageId: finishedAsset.id, finishedFor: look.id, provider: image.provider, model: image.model, cost, error: undefined }
      });
      generated += 1;
    } catch (error) {
      beats.push({ ...beat, visual: { ...v, prompt, status: "failed", error: error instanceof Error ? error.message : String(error) } });
    }
  }
  return { beats, spent, generated, skipped };
}

/** Re-finish stored stills for a new look from their raw images (no generation, no cost). */
export async function refinishMotionStills(story: MotionStory, repo: Repository): Promise<MotionBeat[]> {
  const look = MOTION_LOOKS[story.look ?? DEFAULT_MOTION_LOOK];
  const beats: MotionBeat[] = [];
  for (const beat of story.beats) {
    const v = beat.visual;
    if (!v || v.kind === "icon" || !v.rawImageId || v.finishedFor === look.id) {
      beats.push(beat);
      continue;
    }
    const raw = await repo.getImageBlob(v.rawImageId);
    if (!raw) {
      beats.push(beat);
      continue;
    }
    const finished = await finishForLook(raw.data, look, v.placement);
    const asset = await storePng(repo, finished, { prompt: v.prompt, provider: v.provider ?? "mock", role: "motion-still", caption: v.subject, style: look.id });
    beats.push({ ...beat, visual: { ...v, imageId: asset.id, finishedFor: look.id } });
  }
  return beats;
}
