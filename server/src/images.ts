// Image generation. Two real providers:
//   OpenRouter's dedicated images endpoint (POST /api/v1/images → { data: [{ b64_json }] }),
//   Cloudflare Workers AI (POST /accounts/{id}/ai/run/{model} → { result: { image } }),
//     FLUX.1 [schnell] by default, inside Cloudflare's free daily allowance.
// Without either key, images are offline placeholders (mock).

// Image models are tiered by MODEL_PROFILE like every text stage (they were not,
// which is why cost-first still billed the premium tier). Rates are per output
// image token; the premium tier costs 4x the lite tier for the same picture.
// Resolved locally (not via openrouter.modelFor) to avoid an import cycle.
const IMAGE_TIERS = {
  "cost-first": "google/gemini-3.1-flash-lite-image",
  balanced: "google/gemini-3.1-flash-image",
  premium: "google/gemini-3-pro-image"
} as const;

// ≈ USD per generated image, used ONLY when the API response omits a cost so
// spend caps and telemetry never silently under-count images. ~1290 output image
// tokens per standard-resolution picture x each tier's image_output rate.
const IMAGE_COST_ESTIMATES: Record<string, number> = {
  "google/gemini-3-pro-image": 0.155,
  "google/gemini-3-pro-image-preview": 0.155,
  "google/gemini-3.1-flash-image": 0.077,
  "google/gemini-3.1-flash-lite-image": 0.039,
  "google/gemini-2.5-flash-image": 0.039,
  // ~96 neurons for a 1024x1024, 8-step image at $0.011 per 1,000 neurons. Free inside
  // Cloudflare's 10,000-neuron daily allowance; this is the price past it, so caps stay honest.
  "@cf/black-forest-labs/flux-1-schnell": 0.0011
};

export type ImageProvider = "mock" | "openrouter" | "cloudflare";

const CLOUDFLARE_DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export function cloudflareImageModel(): string {
  return process.env.MODEL_IMAGE_CLOUDFLARE || CLOUDFLARE_DEFAULT_MODEL;
}

/** The provider used when a caller does not pick one: IMAGE_PROVIDER if it is set up, else OpenRouter, else Cloudflare, else mock. */
export function defaultImageProvider(): ImageProvider {
  const pick = process.env.IMAGE_PROVIDER;
  if ((pick === "cloudflare" || process.env.MODEL_IMAGE?.startsWith("@cf/")) && cloudflareConfigured()) return "cloudflare";
  if (pick === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (cloudflareConfigured()) return "cloudflare";
  return "mock";
}

/** What a writer can choose between, for the picture controls. */
export function imageProviders(): Array<{ id: "openrouter" | "cloudflare"; label: string; model: string; configured: boolean; free: boolean }> {
  return [
    { id: "openrouter", label: "OpenRouter", model: imageModel(), configured: Boolean(process.env.OPENROUTER_API_KEY), free: false },
    { id: "cloudflare", label: "Cloudflare FLUX", model: cloudflareImageModel(), configured: cloudflareConfigured(), free: true }
  ];
}

/**
 * Pick the provider and a model it can run. An explicit provider must be set up
 * (else a clear error); a "@cf/" model means Cloudflare; otherwise the default.
 * A model id meant for the other provider is swapped for this provider's default.
 */
export function resolveImageRoute(model?: string, provider?: ImageProvider): { provider: ImageProvider; model: string } {
  const chosen: ImageProvider = provider ?? (model?.startsWith("@cf/") ? "cloudflare" : defaultImageProvider());
  if (chosen === "cloudflare") {
    if (!cloudflareConfigured()) {
      if (provider === "cloudflare") throw new Error("Cloudflare pictures are not set up: add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
      return { provider: "mock", model: model ?? cloudflareImageModel() };
    }
    return { provider: "cloudflare", model: model?.startsWith("@cf/") ? model : cloudflareImageModel() };
  }
  if (chosen === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter pictures are not set up: add OPENROUTER_API_KEY.");
    return { provider: "openrouter", model: model && !model.startsWith("@cf/") ? model : imageModel() };
  }
  return { provider: "mock", model: model ?? imageModel() };
}

function imageProfile(): keyof typeof IMAGE_TIERS {
  const value = process.env.MODEL_PROFILE;
  return value === "balanced" || value === "premium" ? value : "cost-first";
}

// Everyday images (article covers, section art, optional per-shot stills).
export function imageModel(): string {
  return process.env.MODEL_IMAGE ?? IMAGE_TIERS[imageProfile()];
}

// The persona anchor is the single reference every Veo shot inherits, so quality
// compounds there — it stays on the premium tier even under cost-first.
export function anchorImageModel(): string {
  return process.env.MODEL_IMAGE_ANCHOR ?? IMAGE_TIERS.premium;
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

// Image bytes are now persisted in Postgres (image_assets.data bytea) by
// repository.saveImage and served from /api/images/:id — no disk storage here.

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Co-Create"
  };
}

// Offline placeholder so the visuals flow works without a key (varied by prompt).
export function mockImage(prompt: string): string {
  const hue = Math.abs([...prompt].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)) % 360;
  const label = prompt.replace(/[<>&]/g, " ").slice(0, 40);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 45% 18%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 45%)"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="920" cy="180" r="130" fill="#ffffff" opacity=".15"/><text x="80" y="120" fill="#f8fafc" font-family="Arial" font-size="46" font-weight="700">Co-Create</text><text x="82" y="180" fill="#e2e8f0" font-family="Arial" font-size="26">${label}</text></svg>`
  );
  return `data:image/svg+xml,${svg}`;
}

// Cost from the images response if present, else a configurable per-image
// estimate (IMAGE_COST_USD). The /images endpoint doesn't reliably return usage,
// so the estimate is how per-piece image spend becomes visible in telemetry.
// Always resolve to a number when the provider is real: an unpriced image used to
// return undefined, which meant spend caps under-counted image generation — the
// exact hole that let an image-heavy day run away. Order: real cost from the
// response > IMAGE_COST_USD override > per-tier estimate.
function imageCost(raw: { usage?: { cost?: number }; cost?: number }, model: string): number | undefined {
  const fromResponse = raw?.usage?.cost ?? raw?.cost;
  if (typeof fromResponse === "number" && fromResponse > 0) return fromResponse;
  const env = Number(process.env.IMAGE_COST_USD);
  if (Number.isFinite(env) && env > 0) return env;
  return IMAGE_COST_ESTIMATES[model];
}

/** What one image is expected to cost on a model, for spend caps checked before the call. */
export function estimateImageCost(model = imageModel()): number {
  return imageCost({}, model) ?? 0.08;
}

async function generateCloudflareImage(prompt: string, model: string): Promise<{ url: string; provider: "cloudflare"; model: string; cost?: number }> {
  const base = process.env.CLOUDFLARE_API_BASE ?? "https://api.cloudflare.com/client/v4";
  const account = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID ?? "");
  const body: Record<string, unknown> = { prompt: prompt.slice(0, 2048) };
  if (model.includes("flux-1-schnell")) body.steps = 8; // the model's maximum; best detail
  const response = await fetch(`${base}/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data: { result?: { image?: string }; errors?: Array<{ code?: number; message?: string }> } | undefined;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  const image = data?.result?.image;
  if (!response.ok || !image) {
    const errors = data?.errors ?? [];
    if (errors.some((e) => e.code === 4006 || /daily free allocation|neurons/i.test(e.message ?? ""))) {
      throw new Error("Cloudflare's free daily picture allowance is used up; it resets at 00:00 UTC.");
    }
    const detail = errors.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).join("; ") || text.slice(0, 300);
    throw new Error(`Cloudflare image generation failed: ${response.status} ${detail}`);
  }
  // FLUX.1 [schnell] returns a base64 JPEG.
  return { url: `data:image/jpeg;base64,${image}`, provider: "cloudflare", model, cost: imageCost({}, model) };
}

export async function generateImage(
  prompt: string,
  model?: string,
  options: { provider?: ImageProvider } = {}
): Promise<{ url: string; provider: ImageProvider; model: string; cost?: number }> {
  const route = resolveImageRoute(model, options.provider);
  if (route.provider === "mock") return { url: mockImage(prompt), provider: "mock", model: route.model };
  if (route.provider === "cloudflare") return generateCloudflareImage(prompt, route.model);
  model = route.model;
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
  return { url, provider: "openrouter", model, cost: imageCost(data, model) };
}
