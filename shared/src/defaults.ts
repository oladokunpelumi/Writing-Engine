import type { PromptTemplateInput, WorkflowRecipePreview } from "./schemas";
import type { VoiceProfile } from "./schemas";

export const DEFAULT_BANNED_TERMS = [
  "seamless",
  "robust",
  "leverage",
  "utilize",
  "synergy",
  "holistic",
  "game-changer",
  "cutting-edge",
  "innovative",
  "transformative",
  "empower",
  "unlock",
  "delve",
  "crucial",
  "vital"
];

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  id: "voice-default",
  name: "Default",
  pillars: [
    "Writing and communication craft",
    "Faith and theology: moral, philosophical, spiritual implications",
    "Strategy and systems thinking",
    "Practical application the reader can use"
  ],
  register:
    "Observation-first, then theorize, then provoke. Intimate second person where it fits. Rigorous but warm, analytical without going cold.",
  spine: [
    "Observation: recognizable external human behavior",
    "Descent: the emotion or need underneath",
    "Connection: the larger pattern, often theological",
    "Synthesis: a precise position, not a softened compromise",
    "Invitation: where faith-relevant, move from you to I"
  ],
  constraints: [
    "Paraphrase by default",
    "Keep direct quotes under 15 words",
    "Never reproduce lyrics or long passages",
    "Flag scripture and named citations for confirmation",
    "No throat-clearing filler"
  ],
  bannedTerms: DEFAULT_BANNED_TERMS,
  lexicon: [
    "Pauline theology",
    "Genesis",
    "Ezekiel",
    "Augustine",
    "attachment theory",
    "social identity theory",
    "feedback loops",
    "systems framing"
  ],
  updatedAt: new Date().toISOString()
};

// Seeded ONLY for a brand-new owner's first-ever voice (repository.ts getVoice()
// auto-create path). Deliberately generic — DEFAULT_VOICE_PROFILE above is the
// founder's own real, specific voice and must never be handed to a new signup.
export const STARTER_VOICE_PROFILE: VoiceProfile = {
  id: "voice-starter",
  name: "Untitled voice",
  pillars: [],
  register:
    "No fixed voice yet — write in a clear, direct register suited to the topic and audience. No imposed persona, theme, or theological framing.",
  spine: [],
  constraints: ["No throat-clearing filler"],
  bannedTerms: DEFAULT_BANNED_TERMS,
  lexicon: [],
  updatedAt: new Date().toISOString()
};

// Reader-first refinement doctrine (adapted from the article-refiner skill).
// Lives here so it seeds as the editable `refine` prompt template AND backs the
// runRefine fallback, so refinement works even if the template was never seeded.
export const REFINE_PROMPT_BODY = [
  "You are refining a writer-first draft into a reader-first piece. Find the shape already inside the draft and rebuild the surface around it — reorder, sharpen, and cut until the reader never has to work. Do not replace the ideas.",
  "Priority order: Accuracy > Clarity > Usefulness > Completeness > Style. Style never overrides substance; completeness never justifies padding.",
  "Diagnose first (internally, do not print): is the draft writer-organized or reader-organized? Where does attention peak — that is often where it should start. What is the one claim? What can be cut without losing it? Does the ending earn its weight?",
  "Output gates — the result must: answer the reader's real question (not the writer's); be usable immediately; carry nothing unnecessary; scan cleanly.",
  "Never: open with sycophantic acknowledgement of the draft; hand back a skeleton when a finished piece was asked for; explain your changes unless asked; pad to look thorough; moralize at the end — land on image, action, or an open question.",
  "Honor the author's locked voice and the banned-term / source-handling rules. Flag scripture and named citations for confirmation rather than asserting them. Output only the refined piece."
].join("\n");

// Recognition-first opener doctrine: make the reader see themselves before any
// point is made (the "mirror" hook). Injected into the narrative generative stages.
export const HOOK_DOCTRINE = [
  "OPEN so the reader sees themselves before you make any point. Recognition before product: lead with the specific moment or feeling they are already living — not the thesis, answer, lesson, or definition.",
  "Be concrete and sensory (time, place, body, objects). Aim for the reader thinking 'wait — that's me.' They are being seen, not shamed.",
  "Once they recognize themselves they are emotionally open — only then earn the point. Never open with abstraction, throat-clearing, or the conclusion.",
  "Keep the opening TRUE to the piece — never fabricate a scene to be relatable."
].join("\n");

// Desire doctrine: on every page/section, someone must want something — even a
// glass of water (Vonnegut/McKee). Desire is what keeps a unit of writing alive
// and pulls the reader forward; its absence is why sections go inert and abstract.
// Injected into the same narrative generative stages as HOOK_DOCTRINE.
export const DESIRE_DOCTRINE = [
  "In EVERY section, someone must want something — a desire, need, or longing the reader can feel. Even a small want (Vonnegut's 'glass of water') keeps the writing alive; a section where no one wants anything goes inert and abstract.",
  "Name the wanter and the want concretely. In fiction it is a character; in an essay it is the person in your scene, the reader, or you — give them an active wanting, not a static observation.",
  "Let the want create motion: a gap between what they have and what they want, with a stake or obstacle in the way. Prefer sections that move toward (or away from) something over sections that only explain, define, or describe.",
  "Keep wants TRUE to the piece — never bolt on a craving that doesn't belong — and vary them so desire doesn't become a repeated tic."
].join("\n");

// Power words that reliably lift an attention line (Cole's "magnet" vocabulary).
// Used by headlineScore to reward a line that reaches for one.
export const HEADLINE_POWER_WORDS = [
  "crucial", "little-known", "powerful", "unforgettable", "memorable", "eye-opening",
  "painful", "emerging", "surprising", "brutal", "honest", "proven", "hidden", "secret", "underrated"
];

// The attention line — a page headline OR the first spoken line of a video —
// earns the first second. Shared craft: the Headline/Hook Lab generates and
// scores these for BOTH media (essay title in BUILD 1; video spoken hook in
// BUILD 2), so this doctrine is deliberately media-agnostic.
export const HEADLINE_DOCTRINE = [
  "An attention line (a page headline, or the first spoken line of a video) earns the first second. Anatomy: name WHAT it's about, WHO it's for, and the PROMISE — and open a curiosity gap only the piece can close.",
  "Reach for proven magnets: a specific number, a concrete detail over a clever abstraction, one power word, a named person or thing, or the exact question the audience is already asking themselves.",
  "Be specific enough that the line could only front THIS piece. If deleting the number or name leaves something that could sit on anything, it is too generic — rewrite it.",
  "Never: vague throat-clearing, clickbait a payoff can't honor, ALL-CAPS shouting, or padding past ~14 words (a spoken hook should be shorter still).",
  "Write many, keep the strongest — the best line is found by volume, not first-try cleverness."
].join("\n");

// One controlling idea per piece (Cole's "say one thing"). Shared primitive:
// BUILD 2's video script imports this exact constant for its "one through-line."
export const ONE_THING_DOCTRINE = [
  "Say ONE thing. A piece (or a video) advances a single controlling idea; the moment a second idea competes for the frame, it belongs in a different piece.",
  "Every section, example, and line serves that one claim — cut whatever only serves a different one.",
  "State the one thing plainly enough that a reader could repeat it back in a single sentence."
].join("\n");

// ---- BUILD 2: UGC Video Studio doctrines ----
// Short-form UGC craft. Reuses BUILD 1's shared primitives: the one through-line
// is ONE_THING_DOCTRINE; the spoken hook is generated + scored by the shared
// Headline/Hook Lab (video-hook mode). This covers what is video-specific.
export const UGC_VIDEO_DOCTRINE = [
  "Talk to camera like a real person, not an ad. Authentic, specific, a little imperfect beats polished and generic.",
  "The first ~1.5 seconds decide everything: open on the hook — a pattern interrupt, a bold claim, or the exact moment the viewer recognizes themselves. Never a slow intro or 'hey guys'.",
  "Hold ONE through-line the whole way (see the one-thing doctrine). Every beat earns the next by opening a small loop and paying it off; cut anything that doesn't move the viewer forward.",
  "Vary the energy — a beat of tension, a beat of relief. Concrete over abstract; show the thing, don't describe it.",
  "End on a single clear call to action the viewer can act on in one tap.",
  "Match the platform: vertical 9:16, fast cuts, spoken lines short enough to say in one breath."
].join("\n");

// Google Flow / Veo 3 prompt anatomy. Veo renders native audio (the spoken line
// becomes dialogue) in ~8s clips; the generated keyframe still is used as a Flow
// "ingredient" so the persona stays identical across shots.
export const VEO_PROMPT_DOCTRINE = [
  "Write each shot as a Veo 3 prompt with this anatomy: SUBJECT (who, exact look) · ACTION (what they do) · SETTING · CAMERA (angle + movement, e.g. handheld selfie, slow push-in) · LIGHTING · MOOD · STYLE · AUDIO.",
  "Put the spoken line in the AUDIO as dialogue in quotes so Veo speaks it in the persona's voice; add ambient/SFX cues where they help.",
  "Each clip is ~8 seconds — one beat per shot. Keep the described action doable in 8 seconds.",
  "CONSISTENCY is everything: describe the persona (face, hair, wardrobe), the setting, and the lighting IDENTICALLY in every shot so the clips cut together as one person in one world. The generated keyframe still is the reference 'ingredient' that locks the look.",
  "Be cinematic and concrete; do not put on-screen caption instructions inside the video prompt (captions are handled separately)."
].join("\n");

export const HOOK_STYLES = ["mirror-scene", "direct-analytical", "provocative-question", "confession"] as const;

export function hookStyleDirective(style?: string): string {
  switch (style) {
    case "direct-analytical":
      return "Hook style — direct-analytical: open on a sharp, specific claim or tension stated plainly. No scene, but no throat-clearing.";
    case "provocative-question":
      return "Hook style — provocative question: open on the precise question the reader is already asking themselves.";
    case "confession":
      return "Hook style — confession: open on an honest first-person admission the reader quietly shares.";
    case "mirror-scene":
    default:
      return "Hook style — mirror-scene: open on a specific, sensory scene the reader is already living, so they think 'that's me.'";
  }
}

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplateInput[] = [
  {
    stage: "frame",
    name: "Frame: structured brief",
    description: "Turns messy notes into thesis, spine, moves, anchor, tension, and audience.",
    notes: "Default production prompt",
    body:
      "Turn the brief and raw notes into a tight build-brief: the one thing (a single-sentence controlling idea the whole piece serves), structural spine, 3-6 key moves, anchor, tension, and audience. Do not write the post. Honor the voice profile and source-handling rules."
  },
  {
    stage: "draft",
    name: "Draft: voice-locked essay",
    description: "Drafts a complete post from the approved frame and retrieved memory.",
    notes: "Default production prompt",
    body:
      "Write a complete post in the author's locked voice. Follow the frame and structural spine. Use retrieved posts only as voice calibration and a map of ground already covered; never copy them. Keep the prose concrete, direct, and human."
  },
  {
    stage: "sharpen",
    name: "Sharpen: critique and revise",
    description: "Critiques the draft against quality gates and returns a stronger final.",
    notes: "Default production prompt",
    body:
      "First critique the draft against four gates: answers the real question, usable immediately, nothing padded, clean structure. Then output a line containing exactly <<<FINAL>>> and nothing else, then only the revised piece after it. No text after the revised piece."
  },
  {
    stage: "discover",
    name: "Discover: archive proposals",
    description: "Generates new topics and expansions from archive memory, clustered into series.",
    notes: "Default production prompt",
    body:
      "Read the archive index and voice profile. Return a strict JSON array of proposals; each has type, title, angle, rationale, optional sourcePostId, an optional `series` name + integer `seriesOrder`, and — per Cole's Idea Generator — a `writingType` (guide|opinion|list|story|credibility), an `ideaCategory` (explanation|habit|mistake|lesson|tip|story|timely), and a `whyMe` (expert|talked-to-experts|opinion). Cluster related proposals into 1-3 named series that each carry a clear through-line from a starting piece to deeper cuts and counterarguments. Leave standalone ideas without a series. Prefer topics that compound prior ideas without repeating them."
  },
  {
    stage: "repurpose",
    name: "Repurpose: platform variants",
    description: "Recasts a finished essay into platform-native formats in voice.",
    notes: "Default production prompt",
    body:
      "Recast the finished essay into platform-native formats in the author's voice. Return strict JSON with: tweetThread (array of 5-9 standalone tweets under 280 chars each, the first a hook, the last an invitation), linkedinPost (one reflective post with line breaks, no hashtag spam), and newsletterTeaser (2-3 sentences that make a reader open the full piece). Keep the voice; do not add slop or emojis-as-filler."
  },
  {
    stage: "seo",
    name: "SEO: publish package",
    description: "Creates copy-ready SEO and social metadata from a final post.",
    notes: "Default production prompt",
    body:
      "Return strict JSON with metaTitle, metaDescription, slug, tags, and socialBlurb. Keep it plain, accurate, and aligned with the essay rather than clickbait."
  },
  {
    stage: "image",
    name: "Image: Substack header",
    description: "Creates a visual prompt or image URL for a Substack cover.",
    notes: "Default production prompt",
    body:
      "Create a cinematic Substack header concept from the post's central metaphor. Include a human element, tactile atmosphere, and clear editorial mood."
  },
  {
    stage: "research-explainer",
    name: "Research explainer",
    description: "Summarizes articles with TL;DR, key ideas, implications, and practical takeaways.",
    notes: "Imported style from previous prompt workflow",
    body:
      "Act as a research assistant and explainer. Extract core ideas, examples, and implications. Use simple precise language, explain jargon, flag bias gently, and connect the material to writing craft, faith/theology where relevant, strategy/systems thinking, and practical use."
  },
  {
    stage: "deep-analysis",
    name: "Deep analysis",
    description: "Produces intellectual excavation with external references, debate, and synthesis.",
    notes: "Imported style from previous prompt workflow",
    body:
      "Analyze deeply. Think with the text rather than summarizing it. Integrate relevant history, philosophy, psychology, economics, theology, and science. Use concrete sensory anchors and plain-language explanations for complex ideas."
  },
  {
    stage: "synthesis-article",
    name: "Synthesis article",
    description: "Creates a standalone Substack essay from the analysis.",
    notes: "Imported style from previous prompt workflow",
    body:
      "Write a standalone 800-1200 word Substack essay. Open with a scene, maintain a contrarian observer/futurist voice, keep paragraphs short, include sensory checkpoints, and return to a physical image in the close."
  },
  {
    stage: "visual-prompt",
    name: "Visual prompt",
    description: "Creates a high-quality AI image prompt from an essay theme.",
    notes: "Imported style from previous prompt workflow",
    body:
      "Create an AI image prompt for a Substack header. Describe a scene or visual metaphor with mood, atmosphere, texture, cinematic lighting, and at least one human element."
  },
  {
    stage: "refine",
    name: "Refine: reader-first rewrite",
    description: "Rebuilds a draft around the reader — structure, depth, prose — using the article-refiner doctrine.",
    notes: "Adapted from the article-refiner skill",
    body: REFINE_PROMPT_BODY
  },
  {
    stage: "study-skill",
    name: "Study skill: navigate the territory",
    description: "Navigates a concept graph toward a goal (the transitive-learning study protocol).",
    notes: "Adapted from transitive-learning (optimize the skill, not the graph)",
    body:
      "You are a systems trainer, not a content tutor. Given the concept graph (reading order + gaps) and the learner's goal below, design a short session: pick the next 2–4 concepts to tackle in prerequisite order, state the competency gate for each ('I can ...'), name one transfer task, and flag any uncovered prerequisite to shore up first. Prioritize transformation over coverage; taste over completeness; treat error as feedback. Be concrete and brief."
  },
  {
    stage: "video-reference",
    name: "Video: reference blueprint",
    description: "Reverse-engineers why a pasted reference video holds attention.",
    notes: "UGC Video Studio (BUILD 2)",
    body:
      "Analyze the reference video transcript/description. Return ONLY strict JSON: { hookType, structure: string[], pacingNotes, tone, retentionTactics: string[] }. Name the hook type, the beat-by-beat structure, how it paces attention, its tone, and the specific retention tactics it uses. Do not copy its content — capture its shape."
  },
  {
    stage: "video-script",
    name: "Video: UGC script",
    description: "Writes a short-form spoken script (hook → beats → CTA) from a piece or product.",
    notes: "UGC Video Studio (BUILD 2)",
    body:
      "Write a short-form UGC video script in the persona's voice. Return ONLY strict JSON: { hook, beats: [{ idea, spokenLine }], cta, totalSeconds }. One through-line the whole way; the hook earns the first 1.5s; each beat's spokenLine is short enough to say in one breath; end on one clear CTA."
  },
  {
    stage: "video-shots",
    name: "Video: Veo shot list",
    description: "Turns a script into one ~8s Veo 3 shot per beat, sharing a persona/look.",
    notes: "UGC Video Studio (BUILD 2)",
    body:
      "Turn the script into a shot list for Google Flow / Veo 3. Return ONLY strict JSON: { shots: [{ index, spokenLine, visualPrompt, audioCue, onScreenText, durationSec }] }. One shot per beat, ~8s each. Each visualPrompt uses Veo anatomy (subject·action·setting·camera·lighting·mood·style·audio) and describes the persona IDENTICALLY every shot for consistency; put the spoken line in the audio as quoted dialogue."
  }
];

export const DEFAULT_WORKFLOW_RECIPE: WorkflowRecipePreview = {
  name: "Deep Analysis -> Synthesis Article -> Visual Prompt -> Quality Gate",
  description:
    "Turns raw notes into intellectual excavation, then a Substack-ready synthesis, then a tactile cover prompt, then an anti-slop quality pass.",
  stages: ["deep-analysis", "synthesis-article", "visual-prompt", "sharpen"],
  toggles: [
    { name: "Narrative Intensity", value: "Medium", options: ["Low", "Medium", "High"] },
    { name: "Systems Thinking Depth", value: "High", options: ["Low", "Medium", "High"] },
    { name: "Analytical Sharpness", value: "Medium", options: ["Low", "Medium", "High"] },
    { name: "Metaphor Density", value: "High", options: ["Low", "Medium", "High"] },
    { name: "Emotional Warmth", value: "Medium", options: ["Low", "Medium", "High"] },
    { name: "Structural Rigidity", value: "Flowing", options: ["Sectioned", "Flowing"] },
    { name: "Provocation Level", value: "Challenging", options: ["Reflective", "Challenging", "Confrontational"] }
  ],
  judgeReadiness: {
    voiceFidelity: true,
    antiSlop: true,
    theologicalRigor: true,
    structuralClarity: true,
    researchGrounding: true
  }
};

export const DEFAULT_REFINE_RECIPE: WorkflowRecipePreview = {
  name: "Synthesis Article -> Reader-first Refine",
  description: "Drafts a synthesis essay, then runs the reader-first refinement pass to rebuild it around the reader.",
  stages: ["synthesis-article", "refine"],
  toggles: [
    { name: "Depth", value: "Full rewrite", options: ["Light pass", "Full rewrite", "Structural rebuild"] },
    { name: "Tone", value: "Sharp and analytical", options: ["Warm and personal", "Sharp and analytical", "Lyrical and reflective", "Direct and operational"] }
  ],
  judgeReadiness: {
    voiceFidelity: true,
    antiSlop: true,
    theologicalRigor: true,
    structuralClarity: true,
    researchGrounding: false
  }
};

export const DEFAULT_WORKFLOW_RECIPES: WorkflowRecipePreview[] = [DEFAULT_WORKFLOW_RECIPE, DEFAULT_REFINE_RECIPE];
