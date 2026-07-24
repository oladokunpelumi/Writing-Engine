import type {
  BriefInput,
  GenerationResponse,
  Post,
  PromptStage,
  PromptVersion,
  RefineParams,
  Usage,
  VoiceProfile
} from "../../shared/src";
import { DESIRE_DOCTRINE, HOOK_DOCTRINE, ONE_THING_DOCTRINE, REFINE_PROMPT_BODY, hookStyleDirective } from "../../shared/src";
import { extractCitationFlags, guardrailPrompt } from "./guardrails";
import { mockDiscover, mockDraft, mockFrame, mockRefine, mockRepurpose, mockSeo, mockSharpen, mockStage } from "./mockAi";
import { generateImage, imageStyleDirective, VISUAL_CONCEPT_SYSTEM } from "./images";

const modelEnv: Partial<Record<PromptStage, string>> = {
  frame: "MODEL_FRAME",
  draft: "MODEL_DRAFT",
  sharpen: "MODEL_SHARPEN",
  discover: "MODEL_DISCOVER",
  seo: "MODEL_SEO",
  image: "MODEL_IMAGE",
  repurpose: "MODEL_REPURPOSE",
  refine: "MODEL_REFINE",
  "visual-prompt": "MODEL_VISUAL_PROMPT",
  "signals-deepdive": "MODEL_SIGNALS_DEEPDIVE",
  "signals-macro": "MODEL_SIGNALS_MACRO",
  "fintel-bridge": "MODEL_FINTEL_BRIDGE",
  synthesis: "MODEL_SYNTHESIS",
  reviewgate: "MODEL_REVIEWGATE",
  story: "MODEL_STORY",
  critic: "MODEL_CRITIC",
  "study-skill": "MODEL_STUDY_SKILL",
  "video-reference": "MODEL_VIDEO_REFERENCE",
  "video-script": "MODEL_VIDEO_SCRIPT",
  "video-shots": "MODEL_VIDEO_SHOTS"
};

type ModelProfile = "cost-first" | "balanced" | "premium";

const modelProfiles: Record<ModelProfile, Partial<Record<PromptStage, string>>> = {
  "cost-first": {
    frame: "z-ai/glm-5.2",
    draft: "z-ai/glm-5.2",
    sharpen: "z-ai/glm-5.2",
    refine: "z-ai/glm-5.2",
    repurpose: "google/gemini-3.1-flash-lite",
    discover: "google/gemini-3.1-flash-lite",
    seo: "google/gemini-3.1-flash-lite",
    "visual-prompt": "google/gemini-3.1-flash-lite",
    "signals-deepdive": "z-ai/glm-5.2",
    "signals-macro": "google/gemini-3.1-flash-lite",
    "fintel-bridge": "z-ai/glm-5.2",
    synthesis: "z-ai/glm-5.2",
    reviewgate: "z-ai/glm-5.2",
    story: "z-ai/glm-5.2",
    critic: "z-ai/glm-5.2",
    "study-skill": "google/gemini-3.1-flash-lite",
    "video-reference": "google/gemini-3.1-flash-lite",
    "video-script": "z-ai/glm-5.2",
    "video-shots": "google/gemini-3.1-flash-lite"
  },
  balanced: {
    frame: "z-ai/glm-5.2",
    draft: "anthropic/claude-sonnet-4.6",
    sharpen: "anthropic/claude-sonnet-4.6",
    refine: "anthropic/claude-sonnet-4.6",
    repurpose: "anthropic/claude-sonnet-4.6",
    discover: "google/gemini-3.1-flash-lite",
    seo: "google/gemini-3.1-flash-lite",
    "visual-prompt": "google/gemini-3.1-flash-lite",
    "signals-deepdive": "z-ai/glm-5.2",
    "signals-macro": "google/gemini-3.1-flash-lite",
    "fintel-bridge": "z-ai/glm-5.2",
    synthesis: "anthropic/claude-sonnet-4.6",
    reviewgate: "z-ai/glm-5.2",
    story: "anthropic/claude-sonnet-4.6",
    critic: "anthropic/claude-sonnet-4.6",
    "study-skill": "google/gemini-3.1-flash-lite",
    "video-reference": "google/gemini-3.1-flash-lite",
    "video-script": "anthropic/claude-sonnet-4.6",
    "video-shots": "google/gemini-3.1-flash-lite"
  },
  premium: {
    frame: "anthropic/claude-sonnet-4.6",
    draft: "anthropic/claude-sonnet-4.6",
    sharpen: "anthropic/claude-opus-4.8",
    refine: "anthropic/claude-sonnet-4.6",
    repurpose: "anthropic/claude-sonnet-4.6",
    discover: "z-ai/glm-5.2",
    seo: "z-ai/glm-5.2",
    "visual-prompt": "anthropic/claude-sonnet-4.6",
    "signals-deepdive": "anthropic/claude-sonnet-4.6",
    "signals-macro": "z-ai/glm-5.2",
    "fintel-bridge": "anthropic/claude-sonnet-4.6",
    synthesis: "anthropic/claude-sonnet-4.6",
    reviewgate: "anthropic/claude-sonnet-4.6",
    story: "anthropic/claude-opus-4.8",
    critic: "anthropic/claude-opus-4.8",
    "study-skill": "anthropic/claude-sonnet-4.6",
    "video-reference": "google/gemini-3.1-flash-lite",
    "video-script": "anthropic/claude-sonnet-4.6",
    "video-shots": "z-ai/glm-5.2"
  }
};

export function modelProfile(): ModelProfile {
  const value = process.env.MODEL_PROFILE;
  if (value === "balanced" || value === "premium" || value === "cost-first") return value;
  // Default: cost-first — bakeoff-validated cheap models on every stage but the
  // manual Deep Sharpen panel. Switch via MODEL_PROFILE or the Labs control.
  return "cost-first";
}

export function aiProvider() {
  return process.env.OPENROUTER_API_KEY ? "openrouter" : "mock";
}

export function modelFor(stage: PromptStage) {
  const key = modelEnv[stage];
  return (key && process.env[key]) || modelProfiles[modelProfile()][stage] || process.env.MODEL_DRAFT || "openrouter/auto";
}

// ---- Fusion (OpenRouter server tool: parallel model panel + judge) ----
// Enabled per-stage via FUSION_STAGES (comma list). The outer model invokes it
// when a prompt benefits from multiple perspectives (critique / high-stakes);
// FUSION_FORCE=true makes every call use it. FUSION_PANEL overrides the panel.

export function fusionEnabledFor(stage: PromptStage) {
  return (process.env.FUSION_STAGES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(stage);
}

function fusionTool() {
  const panel = (process.env.FUSION_PANEL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parameters: Record<string, unknown> = {};
  if (panel.length > 0) parameters.analysis_models = panel;
  if (process.env.FUSION_JUDGE_MODEL) parameters.model = process.env.FUSION_JUDGE_MODEL;
  return Object.keys(parameters).length > 0
    ? { type: "openrouter:fusion", parameters }
    : { type: "openrouter:fusion" };
}

// ---- Prompt builders (shared by the non-stream and streaming paths) ----

export function framePrompt(brief: BriefInput, promptVersion?: PromptVersion) {
  return [
    promptVersion?.body ?? "Turn this brief into a structured frame. Do not write the post.",
    "Include a 'The one thing:' line: the single controlling idea of the piece, in one sentence.",
    "Include a 'Cold open' line: the specific recognition scene/feeling the post should lead with so the reader sees themselves first.",
    "Include a 'Driving want' line: the central desire that pulls the piece forward (who wants what, and what's in the way).",
    ONE_THING_DOCTRINE,
    HOOK_DOCTRINE,
    hookStyleDirective(brief.hookStyle),
    DESIRE_DOCTRINE,
    JSON.stringify(brief, null, 2)
  ].join("\n\n");
}

export function draftPrompt(
  brief: BriefInput,
  frame: string,
  retrieved: Post[],
  motifs: string[] = [],
  promptVersion?: PromptVersion
) {
  const callbackGuidance =
    retrieved.length > 0
      ? "Build on the retrieved prior posts: where it is natural, call back to them by title to extend the through-line of the body of work. Never repeat or copy them; deepen the argument instead."
      : "There is no prior memory to build on yet; establish the through-line this piece can later be called back to.";
  const motifGuidance = motifs.length > 0 ? `Weave the author's recurring motifs where they fit, never forced: ${motifs.join(", ")}.` : "";
  return [
    promptVersion?.body ?? "Draft a complete post from this frame and brief. Use retrieved memory for calibration only; do not copy it.",
    ONE_THING_DOCTRINE,
    HOOK_DOCTRINE,
    hookStyleDirective(brief.hookStyle),
    DESIRE_DOCTRINE,
    callbackGuidance,
    motifGuidance,
    `Brief:\n${JSON.stringify(brief, null, 2)}`,
    `Frame:\n${frame}`,
    `Retrieved memory:\n${formatRetrieved(retrieved)}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function sharpenPrompt(draft: string, promptVersion?: PromptVersion) {
  return [
    promptVersion?.body ??
      "Critique this draft against: answers the real question, usable immediately, nothing padded, clean structure. Then output a line containing exactly <<<FINAL>>> and nothing else, then only the revised piece after it.",
    "Output only the Critique, the <<<FINAL>>> marker line, and the revised piece. Do not narrate your process or any tools you use. No text after the revised piece.",
    draft
  ].join("\n\n");
}

// Models sometimes wrap JSON in ```json fences or add prose around it. Strip the
// fence and fall back to the first {...} / [...] block so structured calls are robust.
export function parseJson<T>(content: string): T {
  const unfenced = content.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const match = unfenced.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) throw new Error("Model did not return valid JSON");
    return JSON.parse(match[0]) as T;
  }
}

function formatRetrieved(retrieved: Post[]) {
  return retrieved
    .map((post) => `Title: ${post.title}\nTags: ${post.tags.join(", ")}\nExcerpt:\n${post.body.slice(0, 1600)}`)
    .join("\n\n---\n\n");
}

// ---- Stage runners ----

export async function runFrame(
  brief: BriefInput,
  voice: VoiceProfile,
  promptVersion?: PromptVersion
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    const content = mockFrame(brief, voice);
    return mockResponse(content, "mock-frame", promptVersion);
  }
  const { content, usage } = await chat(modelFor("frame"), systemPrompt(voice), framePrompt(brief, promptVersion), "frame");
  return openrouterResponse(content, modelFor("frame"), promptVersion, usage);
}

export async function runDraft(
  brief: BriefInput,
  frame: string,
  voice: VoiceProfile,
  retrieved: Post[],
  motifs: string[] = [],
  promptVersion?: PromptVersion
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    const content = mockDraft(brief, frame, retrieved);
    return { ...mockResponse(content, "mock-draft", promptVersion), retrieved: [] };
  }
  const { content, usage } = await chat(
    modelFor("draft"),
    systemPrompt(voice),
    draftPrompt(brief, frame, retrieved, motifs, promptVersion),
    "draft"
  );
  return openrouterResponse(content, modelFor("draft"), promptVersion, usage);
}

export async function runSharpen(
  draft: string,
  voice: VoiceProfile,
  promptVersion?: PromptVersion,
  fusion?: boolean
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    const content = mockSharpen(draft);
    return mockResponse(content, "mock-sharpen", promptVersion);
  }
  const { content, usage } = await chat(
    modelFor("sharpen"),
    systemPrompt(voice),
    sharpenPrompt(draft, promptVersion),
    "sharpen",
    fusion
  );
  return openrouterResponse(content, modelFor("sharpen"), promptVersion, usage);
}

// Sharpen's prompt asks for a critique followed by a revised final, so its raw
// content is never the piece itself. Splits on the <<<FINAL>>> marker line; if a
// custom/legacy prompt version doesn't emit the marker, the whole content is
// treated as the final (today's pre-fix behavior) rather than silently breaking.
const SHARPEN_FINAL_MARKER = /^\s*<{2,}\s*FINAL\s*>{2,}\s*$/im;

export function splitSharpenOutput(content: string): { critique?: string; final: string } {
  const match = content.match(SHARPEN_FINAL_MARKER);
  if (!match || match.index === undefined) return { final: content };
  const critique = content.slice(0, match.index).trim();
  const final = content.slice(match.index + match[0].length).trim();
  if (!final) return { final: content };
  return { critique: critique || undefined, final };
}

// Turn the refinement parameters (from the article-refiner intake) into prompt
// directives. Empty params → the doctrine's defaults apply.
export function refineDirectives(params?: RefineParams): string[] {
  if (!params) return [];
  const lines: string[] = [];
  if (params.reader) lines.push(`Primary reader: ${params.reader}. Refine toward what this reader needs.`);
  if (params.depth === "light") lines.push("Depth — light pass: tighten at sentence level and cut filler; preserve section order and sequencing.");
  if (params.depth === "full") lines.push("Depth — full rewrite: keep every idea, but rebuild section order around the reader's experience, reopen the lead, and strengthen the ending.");
  if (params.depth === "structural") lines.push("Depth — structural rebuild: extract only the core insight and rebuild the architecture from the chosen arc; no original sentence is off-limits for cutting.");
  if (params.arc && params.arc !== "infer") lines.push(`Structural arc: ${params.arc}.`);
  if (params.arc === "infer") lines.push("Structural arc: infer the arc the draft itself wants.");
  if (params.theological === "keep") lines.push("Keep the spiritual/theological references as they are.");
  if (params.theological === "soften") lines.push("Soften spiritual/theological references so a secular reader still follows the argument.");
  if (params.theological === "cut") lines.push("Cut spiritual/theological references; the argument should stand without them.");
  if (params.tone) lines.push(`Tone target: ${params.tone}.`);
  lines.push(params.wordTarget ? `Word count target: ${params.wordTarget}.` : "No word target given: match the draft's register and length.");
  return lines;
}

export async function runRefine(
  text: string,
  voice: VoiceProfile,
  params?: RefineParams,
  promptVersion?: PromptVersion,
  doctrine?: string
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    const content = mockRefine(text, params);
    return mockResponse(content, "mock-refine", promptVersion);
  }
  const directives = refineDirectives(params);
  // Doctrine joins the system prompt so prompt caching reuses it across refines.
  const system = doctrine
    ? `${systemPrompt(voice)}\n\nReader-first reference doctrine — apply it:\n${doctrine}`
    : systemPrompt(voice);
  const user = [
    promptVersion?.body ?? REFINE_PROMPT_BODY,
    directives.length > 0 ? `Refinement parameters:\n- ${directives.join("\n- ")}` : "",
    `Article to refine:\n${text}`
  ]
    .filter(Boolean)
    .join("\n\n");
  const { content, usage } = await chat(modelFor("refine"), system, user, "refine");
  return openrouterResponse(content, modelFor("refine"), promptVersion, usage);
}

// Desire pass: an INCREMENTAL edit that adds a concrete, true want to the sections
// that read inert (flagged by desireScore), leaving the rest of the piece intact.
// Reuses the cheap refine model + prompt caching.
export async function runDesirePass(
  text: string,
  voice: VoiceProfile,
  weakExcerpts: string[],
  promptVersion?: PromptVersion
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    // Offline: no model to rewrite with — return the piece unchanged so the flow works.
    return mockResponse(text, "mock-desire-pass", promptVersion);
  }
  const system = `${systemPrompt(voice)}\n\nDesire doctrine — apply it:\n${DESIRE_DOCTRINE}`;
  const targets =
    weakExcerpts.length > 0
      ? `These sections currently read inert — no one in them visibly wants anything. Add a concrete, TRUE want (a desire/need/longing, a gap with a stake) to each, in the author's voice:\n${weakExcerpts
          .map((excerpt, i) => `${i + 1}. ${excerpt}`)
          .join("\n")}`
      : "Sweep the whole piece: in any section where no one wants anything, add a concrete, true want.";
  const user = [
    promptVersion?.body ??
      "Revise the article so every section has someone wanting something. Make INCREMENTAL edits — touch only the inert sections; keep the rest, the structure, and the voice intact. Return the full revised article.",
    targets,
    `Article:\n${text}`
  ].join("\n\n");
  const { content, usage } = await chat(modelFor("refine"), system, user, "refine");
  return openrouterResponse(content, modelFor("refine"), promptVersion, usage);
}

// Scannability pass (Cole's "rate of revelation"): an incremental edit that makes
// a piece respect the scroll — shorten the first sentence, break walls of text,
// add subheadings, vary rhythm — touching only the flagged spots. Reuses the
// cheap refine model. Offline → returns the text unchanged so the flow works.
export async function runScannabilityPass(
  text: string,
  voice: VoiceProfile,
  flagExcerpts: string[],
  promptVersion?: PromptVersion
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    return mockResponse(text, "mock-scannability-pass", promptVersion);
  }
  const system = systemPrompt(voice);
  const targets =
    flagExcerpts.length > 0
      ? `These spots hurt scannability — fix each without changing the meaning:\n${flagExcerpts
          .map((excerpt, i) => `${i + 1}. ${excerpt}`)
          .join("\n")}`
      : "Sweep the whole piece for anything that slows the scroll.";
  const user = [
    promptVersion?.body ??
      "Revise the piece to respect the scroll: a short, clear first sentence; short signposting subheadings where a long piece needs them; walls of text broken into shorter paragraphs; sentence lengths varied (short punches beside longer lines); the point front-loaded, not buried. Make INCREMENTAL edits — keep the ideas, argument, and voice intact; do not rewrite for the sake of it. Return the full revised piece.",
    targets,
    `Piece:\n${text}`
  ].join("\n\n");
  const { content, usage } = await chat(modelFor("refine"), system, user, "refine");
  return openrouterResponse(content, modelFor("refine"), promptVersion, usage);
}

// Generic runner for arbitrary workflow stages (research-explainer, deep-analysis,
// synthesis-article, visual-prompt, …). The previous stage's output is threaded
// in as `input`; the first generative stage also receives retrieved memory.
export async function runStage(
  stage: PromptStage,
  voice: VoiceProfile,
  input: string,
  brief?: BriefInput,
  promptVersion?: PromptVersion,
  retrieved: Post[] = []
): Promise<GenerationResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    const content = mockStage(stage, input, brief, retrieved);
    return mockResponse(content, `mock-${stage}`, promptVersion);
  }
  // Narrative stages get the recognition-first opener + per-section desire doctrine.
  const narrative = stage === "synthesis-article" || stage === "story";
  const user = [
    promptVersion?.body ?? `Run the ${stage} stage on the material below.`,
    narrative ? HOOK_DOCTRINE : "",
    narrative ? hookStyleDirective(brief?.hookStyle) : "",
    narrative ? DESIRE_DOCTRINE : "",
    brief ? `Brief:\n${JSON.stringify(brief, null, 2)}` : "",
    input ? `Input:\n${input}` : "",
    retrieved.length > 0 ? `Retrieved memory:\n${formatRetrieved(retrieved)}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const { content, usage } = await chat(modelFor(stage), systemPrompt(voice), user, stage);
  return openrouterResponse(content, modelFor(stage), promptVersion, usage);
}

export async function runSeo(finalText: string, promptVersion?: PromptVersion) {
  if (!process.env.OPENROUTER_API_KEY) return mockSeo(finalText);
  const { content } = await chat(
    modelFor("seo"),
    promptVersion?.body ?? "Return strict JSON with metaTitle, metaDescription, slug, tags, socialBlurb.",
    finalText,
    "seo"
  );
  return parseJson<ReturnType<typeof mockSeo>>(content);
}

export async function runDiscover(posts: Post[], voice: VoiceProfile, limit: number, promptVersion?: PromptVersion) {
  if (!process.env.OPENROUTER_API_KEY) return mockDiscover(posts, limit);
  const archive = posts
    .map((post) => `ID: ${post.id}\nTitle: ${post.title}\nTags: ${post.tags.join(", ")}\nExcerpt: ${post.body.slice(0, 700)}`)
    .join("\n\n---\n\n");
  const system = [
    promptVersion?.body ?? "Read the archive index and voice profile and propose topics.",
    "Return ONLY a strict JSON array. Each item: { type: 'new'|'expand', title, angle, rationale, sourcePostId?, series?, seriesOrder?, writingType?, ideaCategory?, whyMe? }.",
    "For each idea also set: writingType ('guide'|'opinion'|'list'|'story'|'credibility'), ideaCategory ('explanation'|'habit'|'mistake'|'lesson'|'tip'|'story'|'timely'), and whyMe ('expert'|'talked-to-experts'|'opinion') — the writing form, the idea's category, and the author's authority angle for it.",
    "Cluster related proposals into 1-3 named series (set the same `series` name and an integer `seriesOrder` starting at 1) that each carry a through-line; leave standalone ideas without a series."
  ].join("\n");
  const { content } = await chat(
    modelFor("discover"),
    system,
    `Voice:\n${JSON.stringify(voice, null, 2)}\n\nArchive:\n${archive}\n\nLimit: ${limit}`,
    "discover"
  );
  return parseJson<ReturnType<typeof mockDiscover>>(content);
}

export async function runRepurpose(finalText: string, voice: VoiceProfile, promptVersion?: PromptVersion) {
  if (!process.env.OPENROUTER_API_KEY) return mockRepurpose(finalText);
  const { content } = await chat(
    modelFor("repurpose"),
    [
      systemPrompt(voice),
      promptVersion?.body ??
        "Recast the essay into platform-native formats in voice. Return strict JSON with tweetThread (array of strings), linkedinPost (string), newsletterTeaser (string)."
    ].join("\n\n"),
    finalText,
    "repurpose"
  );
  return parseJson<ReturnType<typeof mockRepurpose>>(content);
}

// Build a strong visual *concept* from the article (cheap text), then render it
// via the real images endpoint. Style + per-Show visual identity make covers
// suitable and cohesive; the cover defaults to the recognition/"mirror" scene.
export async function buildImageConcept(
  finalText: string,
  opts?: { style?: string; identity?: string; role?: string; title?: string }
): Promise<string> {
  const directive = imageStyleDirective(opts?.style);
  const overlay = overlayDirective(opts);
  if (!process.env.OPENROUTER_API_KEY) {
    return [
      directive,
      opts?.identity ?? "",
      overlay,
      `— ${opts?.role === "section" ? "section image" : "cover"} for: ${finalText.slice(0, 160)}`
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  const input = [
    directive,
    opts?.identity ? `Visual identity (keep consistent): ${opts.identity}` : "",
    overlay,
    opts?.role === "section"
      ? "This is a SECTION image illustrating one beat of the piece."
      : "This is the COVER — depict the recognition scene the reader sees themselves in.",
    `Article:\n${finalText.slice(0, 1500)}`
  ]
    .filter(Boolean)
    .join("\n\n");
  const { content } = await chat(modelFor("visual-prompt"), VISUAL_CONCEPT_SYSTEM, input, "visual-prompt");
  return content.trim();
}

// Meme + productified styles render text in the image. Productified covers carry
// the title; memes carry a witty caption the model writes. Other styles stay clean.
function overlayDirective(opts?: { style?: string; role?: string; title?: string }): string {
  if (opts?.style === "productified" && opts.title) {
    return `Render this exact title text prominently and legibly in the image: "${opts.title.slice(0, 80)}".`;
  }
  if (opts?.style === "meme") {
    return "Render a short, witty caption legibly across the image (you choose the words).";
  }
  return "";
}

export async function runImage(
  finalText: string,
  promptVersion?: PromptVersion,
  opts?: { style?: string; identity?: string; role?: string; title?: string }
) {
  const prompt = await buildImageConcept(finalText, opts);
  const { url, provider, model, cost } = await generateImage(prompt);
  return { prompt, url, provider, model, cost };
}

export type VisualBeat = { anchor: string; scene: string };

// Split the final into 3–6 visual beats (section anchors). A cheap model names,
// for each beat, a short anchor label + a one-sentence scene to depict. Mock mode
// derives beats from the piece's own paragraphs/headings so the flow works offline.
export async function extractBeats(finalText: string, n: number): Promise<VisualBeat[]> {
  const count = Math.max(1, Math.min(6, Math.floor(n) || 3));
  if (!process.env.OPENROUTER_API_KEY) {
    const blocks = finalText
      .replace(/^#+\s*/gm, "")
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter((b) => b.length > 40);
    const chosen = blocks.length ? blocks : [finalText.trim()];
    const step = Math.max(1, Math.floor(chosen.length / count));
    const beats: VisualBeat[] = [];
    for (let i = 0; i < count && i * step < chosen.length; i += 1) {
      const block = chosen[i * step];
      beats.push({ anchor: block.split(/\s+/).slice(0, 6).join(" "), scene: block.slice(0, 200) });
    }
    return beats.length ? beats : [{ anchor: "Opening scene", scene: finalText.slice(0, 200) }];
  }
  const system = [
    "You are an art director planning a visual story for an article.",
    `Split the article into ${count} distinct visual beats, in reading order.`,
    "Return ONLY a JSON array of objects: {\"anchor\": a 3-6 word label, \"scene\": one sentence describing the image to depict that beat}.",
    "Cover different moments of the piece — never repeat a scene."
  ].join("\n");
  const { content } = await chat(modelFor("visual-prompt"), system, finalText.slice(0, 4000), "visual-prompt");
  try {
    const raw = parseJson<Array<{ anchor?: string; scene?: string }>>(content);
    const beats = raw
      .map((x) => ({ anchor: String(x.anchor ?? "").slice(0, 80), scene: String(x.scene ?? x.anchor ?? "").trim() }))
      .filter((b) => b.scene)
      .slice(0, count);
    if (beats.length) return beats;
  } catch {
    // fall through to a single-beat fallback below
  }
  return [{ anchor: "Opening scene", scene: finalText.slice(0, 200) }];
}

// ---- Helpers ----

function mockResponse(content: string, model: string, promptVersion?: PromptVersion): GenerationResponse {
  return {
    content,
    provider: "mock",
    model,
    promptVersionId: promptVersion?.id,
    citations: extractCitationFlags(content)
  };
}

function openrouterResponse(content: string, model: string, promptVersion?: PromptVersion, usage?: Usage): GenerationResponse {
  return {
    content,
    provider: "openrouter",
    model,
    promptVersionId: promptVersion?.id,
    citations: extractCitationFlags(content),
    usage
  };
}

function toUsage(raw: unknown): Usage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const usage = raw as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    cost: usage.cost
  };
}

export function systemPrompt(voice: VoiceProfile) {
  // Skip empty fields so a neutral starter voice (empty pillars/spine/lexicon)
  // doesn't emit dangling "Pillars: " / "Spine: " / "Lexicon: " labels.
  return [
    "You are Co-Create, a single-author writing engine.",
    "Write in the author's locked voice.",
    voice.pillars.length ? `Pillars: ${voice.pillars.join("; ")}` : "",
    `Register: ${voice.register}`,
    voice.spine.length ? `Spine: ${voice.spine.join(" -> ")}` : "",
    voice.constraints.length ? `Constraints: ${voice.constraints.join("; ")}` : "",
    voice.bannedTerms.length ? `Banned terms: ${voice.bannedTerms.join(", ")}` : "",
    voice.lexicon.length ? `Lexicon: ${voice.lexicon.join(", ")}` : "",
    guardrailPrompt()
  ]
    .filter(Boolean)
    .join("\n");
}

// The system prompt (voice profile + guardrails) repeats across Frame -> Draft ->
// Sharpen. Marking it with cache_control lets OpenRouter reuse it (Anthropic /
// Gemini honor the breakpoint; OpenAI caches automatically and ignores it).
function buildMessages(system: string, user: string) {
  const cache = process.env.ENABLE_PROMPT_CACHE === "true";
  const systemContent = cache
    ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
    : system;
  return [
    { role: "system", content: systemContent },
    { role: "user", content: user }
  ];
}

// ---- Per-stage config (mode / temperature / max_tokens) ----
// Resolved from env per stage so each stage of a workflow can run cheap-chat,
// a web-search model, or a fusion panel. Defaults preserve prior behavior:
// mode=chat, no temperature override, max_tokens=MAX_OUTPUT_TOKENS.

export type StageMode = "chat" | "fusion" | "web_search";

function stageEnvKey(stage: PromptStage) {
  return stage.toUpperCase().replace(/-/g, "_");
}

export function stageMode(stage?: PromptStage): StageMode {
  if (!stage) return "chat";
  const value = process.env[`MODE_${stageEnvKey(stage)}`];
  return value === "fusion" || value === "web_search" ? value : "chat";
}

function stageTemperature(stage?: PromptStage): number | undefined {
  if (!stage) return undefined;
  const value = process.env[`TEMP_${stageEnvKey(stage)}`];
  return value === undefined || value === "" ? undefined : Number(value);
}

function stageMaxTokens(stage?: PromptStage): number {
  const fallback = Number(process.env.MAX_OUTPUT_TOKENS ?? 12000);
  if (!stage) return fallback;
  const value = process.env[`MAXTOK_${stageEnvKey(stage)}`];
  return value === undefined || value === "" ? fallback : Number(value);
}

// OpenRouter web-search plugin (single-model live search; exa or provider-native).
function webPlugin() {
  return { id: "web", engine: process.env.WEB_ENGINE ?? "exa", max_results: Number(process.env.WEB_MAX_RESULTS ?? 6) };
}

// Resolve how a stage call runs. Mode precedence: explicit Deep-Sharpen /
// FUSION_STAGES / MODE=fusion → fusion; else MODE=web_search → web plugin;
// else plain chat. Exported for tests.
export function stagePlan(stage?: PromptStage, forceFusion?: boolean) {
  const mode = stageMode(stage);
  const useFusion = Boolean(forceFusion) || mode === "fusion" || Boolean(stage && fusionEnabledFor(stage));
  const useWeb = !useFusion && mode === "web_search";
  return { mode, useFusion, useWeb, temperature: stageTemperature(stage), maxTokens: stageMaxTokens(stage) };
}

function requestBody(model: string, system: string, user: string, stream: boolean, stage?: PromptStage, forceFusion?: boolean) {
  const plan = stagePlan(stage, forceFusion);
  const body: Record<string, unknown> = {
    model,
    messages: buildMessages(system, user),
    stream,
    // Cap output so the provider doesn't reserve the model's full context window
    // (which can exceed the key's credit budget) and to bound per-call cost.
    max_tokens: plan.maxTokens,
    fallbacks: ["openrouter/auto"],
    provider: { allow_fallbacks: true },
    usage: { include: true }
  };
  if (plan.temperature !== undefined) body.temperature = plan.temperature;
  if (plan.useFusion) {
    body.tools = [fusionTool()];
    if (forceFusion || process.env.FUSION_FORCE === "true") body.tool_choice = "required";
  } else if (plan.useWeb) {
    body.plugins = [webPlugin()];
  }
  return body;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Co-Create"
  };
}

const EMPTY_VISIBLE_DRAFT_ERROR =
  "The model returned no visible draft. Try again or switch the stage to the stable route.";

type ChatCompletionData = { choices?: Array<{ message?: { content?: string } }>; usage?: unknown };

function visibleContent(data: ChatCompletionData) {
  const content = data.choices?.[0]?.message?.content;
  return content && content.trim().length > 0 ? content : undefined;
}

async function postChatCompletion(body: Record<string, unknown>) {
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${message}`);
  }
  return (await response.json()) as ChatCompletionData;
}

async function chatWithEmptyGuard(body: Record<string, unknown>): Promise<{ content: string; usage?: Usage }> {
  const started = Date.now();
  const data = await postChatCompletion(body);
  const content = visibleContent(data);
  if (content) {
    const usage = toUsage(data.usage) ?? {};
    return { content, usage: { ...usage, latencyMs: Date.now() - started } };
  }

  const fallbackModel = process.env.MODEL_DRAFT || modelProfiles.balanced.draft || "openrouter/auto";
  const retryBody = { ...body, model: fallbackModel };
  const retryData = await postChatCompletion(retryBody);
  const retryContent = visibleContent(retryData);
  if (retryContent) {
    const usage = toUsage(retryData.usage) ?? {};
    return { content: retryContent, usage: { ...usage, latencyMs: Date.now() - started, fallbackModel } };
  }

  throw new Error(EMPTY_VISIBLE_DRAFT_ERROR);
}

// Low-level call with an explicit model + temperature and a prompt-cached system
// prefix (honors ENABLE_PROMPT_CACHE). Used by the swarm harness to fan out N
// cheap variations over a fixed, cached prefix. Requires a live key.
export async function rawChat(opts: {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; usage?: Usage }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: buildMessages(opts.system, opts.user),
    max_tokens: opts.maxTokens ?? Number(process.env.MAX_OUTPUT_TOKENS ?? 12000),
    fallbacks: ["openrouter/auto"],
    provider: { allow_fallbacks: true },
    usage: { include: true }
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  return chatWithEmptyGuard(body);
}

async function chat(
  model: string,
  system: string,
  user: string,
  stage?: PromptStage,
  forceFusion?: boolean
): Promise<{ content: string; usage?: Usage }> {
  return chatWithEmptyGuard(requestBody(model, system, user, false, stage, forceFusion));
}

// Streaming variant: parses OpenAI-compatible SSE chunks, forwards each token to
// onToken, captures the final usage frame, and resolves with the full content.
export async function chatStream(
  model: string,
  system: string,
  user: string,
  onToken: (token: string) => void,
  stage?: PromptStage
): Promise<{ content: string; usage?: Usage }> {
  const started = Date.now();
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(requestBody(model, system, user, true, stage))
  });
  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => "");
    throw new Error(`OpenRouter stream failed: ${response.status} ${message}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let usage: Usage | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }>; usage?: unknown };
        const token = json.choices?.[0]?.delta?.content;
        if (token) {
          full += token;
          onToken(token);
        }
        if (json.usage) usage = toUsage(json.usage);
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
  if (!full.trim()) {
    // Empty / reasoning-only stream — apply the same guard as the non-streaming
    // path: retry once on the safe fallback model (non-streamed), push the recovered
    // draft through onToken so the client still receives it, else surface the
    // branded error instead of a blank result.
    const fallbackModel = process.env.MODEL_DRAFT || modelProfiles.balanced.draft || "openrouter/auto";
    const retry = await postChatCompletion(requestBody(fallbackModel, system, user, false, stage));
    const recovered = visibleContent(retry);
    if (recovered) {
      onToken(recovered);
      const retryUsage = toUsage(retry.usage) ?? {};
      return { content: recovered, usage: { ...retryUsage, latencyMs: Date.now() - started, fallbackModel } };
    }
    throw new Error(EMPTY_VISIBLE_DRAFT_ERROR);
  }
  return { content: full, usage: { ...(usage ?? {}), latencyMs: Date.now() - started } };
}
