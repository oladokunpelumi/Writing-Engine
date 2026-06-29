// Image generation via OpenRouter's dedicated images endpoint
// (POST /api/v1/images → { data: [{ b64_json }] }). Replaces the old approach of
// regex-grepping a URL out of a chat completion (which images don't return).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function imageModel(): string {
  return process.env.MODEL_IMAGE ?? "google/gemini-3-pro-image-preview";
}

export const VISUAL_CONCEPT_SYSTEM = [
  "You are an art director. Turn the article + style + visual identity below into ONE vivid image-generation prompt (2–4 sentences):",
  "name the subject/scene, composition, mood, lighting, palette, and art style. Keep it concrete and TRUE to the article — never invent facts.",
  "For meme style, describe a relatable everyday scene the reader sees themselves in, plus a short caption.",
  "When the brief asks to render text/a caption/a title in the image, state the EXACT text in quotes and where it sits, so the image model draws it legibly. Output ONLY the image prompt."
].join("\n");

export type ImageStyle = "meme" | "editorial" | "productified" | "diagram";

export function imageStyleDirective(style?: string): string {
  switch (style) {
    case "meme":
      return "Style: relatable meme-style illustration — an everyday scene the reader sees themselves in, gently exaggerated and warm, with a short caption rendered legibly across the image.";
    case "productified":
      return "Style: clean branded title card — bold typographic title rendered prominently and legibly, consistent framing, shareable and on-brand.";
    case "diagram":
      return "Style: simple explanatory diagram — a clean schematic that externalizes the article's core idea or system, with minimal labels.";
    case "editorial":
    default:
      return "Style: cinematic editorial cover — atmospheric, built from the article's central metaphor, magazine-cover grade.";
  }
}

// ---- File-backed image storage ----------------------------------------------
// Base64 PNGs from the images endpoint are ~1–2 MB each; storing them inline in
// SQLite bloats the DB once a single piece generates 4–6 images. Persist large
// raster data URLs to disk and store a served path (/api/images/<file>) instead.
// Small SVG placeholders (mock mode) and already-served paths/URLs pass through.

export function imageDir(): string {
  return process.env.IMAGE_DIR ?? join(process.cwd(), "data", "images");
}

export function persistImage(url: string): string {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s.exec(url);
  if (!match) return url; // svg data URLs, http(s), or already a /api/images path
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const b64 = match[2];
  const dir = imageDir();
  mkdirSync(dir, { recursive: true });
  const file = `${createHash("sha1").update(b64).digest("hex").slice(0, 24)}.${ext}`;
  writeFileSync(join(dir, file), Buffer.from(b64, "base64"));
  return `/api/images/${file}`;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Gbedu Desk"
  };
}

// Offline placeholder so the visuals flow works without a key (varied by prompt).
export function mockImage(prompt: string): string {
  const hue = Math.abs([...prompt].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)) % 360;
  const label = prompt.replace(/[<>&]/g, " ").slice(0, 40);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 45% 18%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 45%)"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="920" cy="180" r="130" fill="#ffffff" opacity=".15"/><text x="80" y="120" fill="#f8fafc" font-family="Arial" font-size="46" font-weight="700">Gbedu Desk</text><text x="82" y="180" fill="#e2e8f0" font-family="Arial" font-size="26">${label}</text></svg>`
  );
  return `data:image/svg+xml,${svg}`;
}

// Cost from the images response if present, else a configurable per-image
// estimate (IMAGE_COST_USD). The /images endpoint doesn't reliably return usage,
// so the estimate is how per-piece image spend becomes visible in telemetry.
function imageCost(raw: { usage?: { cost?: number }; cost?: number }): number | undefined {
  const fromResponse = raw?.usage?.cost ?? raw?.cost;
  if (typeof fromResponse === "number" && fromResponse > 0) return fromResponse;
  const env = Number(process.env.IMAGE_COST_USD);
  return Number.isFinite(env) && env > 0 ? env : undefined;
}

export async function generateImage(
  prompt: string,
  model = imageModel()
): Promise<{ url: string; provider: "mock" | "openrouter"; model: string; cost?: number }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { url: mockImage(prompt), provider: "mock", model };
  }
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"}/images`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, prompt, n: 1 })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter image generation failed: ${response.status} ${message}`);
  }
  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    usage?: { cost?: number };
    cost?: number;
  };
  const item = data.data?.[0];
  const url = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url ?? "";
  if (!url) throw new Error("OpenRouter returned no image");
  return { url, provider: "openrouter", model, cost: imageCost(data) };
}
