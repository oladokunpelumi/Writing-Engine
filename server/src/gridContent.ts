import type { PromptTemplateInput, VoiceProfile, WorkflowRecipePreview } from "../../shared/src";

// THE GRID content engine, ported as Gbedu stage templates + voice + recipe.
// Prompts are condensed-but-faithful versions of the .md prompt files; they seed
// as editable templates (Prompt Studio) so the originals can be pasted in to deepen.

const SIGNAL_FORMAT = [
  "Each signal uses this exact block format:",
  "DATE: YYYY-MM-DD",
  "SECTOR: [AI | Energy | Robotics | Finance | Trade | Macro | Adjacent]",
  "SIGNAL: [short title]",
  "METRIC: [at least one number — $, %, unit, or date]",
  "IMPLICATION: [6-month forward read, 2 sentences max]",
  "SOURCE: [company announcement | regulatory filing | peer-reviewed | market data | ...]"
].join("\n");

export const GRID_VOICE_PROFILE: VoiceProfile = {
  id: "voice-grid",
  name: "The Grid",
  pillars: [
    "Near-future Afrofuturist hard sci-fi grounded in real signals",
    "Technology's human cost and dignity",
    "Systems and economics rendered as lived experience",
    "Hope and agency without utopian gloss"
  ],
  register:
    "Cinematic and grounded, 6th–8th grade reading level. Body in the room — a sensory anchor roughly every 200 words. Show, don't announce. Each character narrates with a distinct voice signature. Plain-language windows for any technical idea.",
  spine: [
    "Open inside a scene, already in the problem",
    "Let the signal pressure the character's choice",
    "Turn on a concrete moment, not a speech",
    "Land on image or action, never a moral"
  ],
  constraints: [
    "900–1,100 word story + 150–200 word Signal Decoder",
    "Rotate primary emotion and lead character (never repeat the last)",
    "Explain technical concepts inline, in plain language",
    "One Crash Course easter egg, delivery method rotated",
    "No lists-of-three; vary sentence length; no slop"
  ],
  bannedTerms: [
    "delve",
    "utilize",
    "leverage",
    "facilitate",
    "multifaceted",
    "synergy",
    "paradigm",
    "tapestry",
    "testament",
    "realm",
    "landscape",
    "seamless"
  ],
  lexicon: ["Afrofuturism", "humanoid robotics", "energy transition", "market flows", "agency", "dignity", "diaspora futures"],
  updatedAt: new Date(0).toISOString()
};

export const GRID_PROMPT_TEMPLATES: PromptTemplateInput[] = [
  {
    stage: "signals-deepdive",
    name: "Signals: Daily Deep Dive",
    description: "Collects 3–5 dated signals across six sectors from live sources.",
    notes: "The Grid",
    body:
      `Collect today's strongest real-world signals across AI, Energy, Robotics, Finance, Trade, and one Adjacent sector. Use live, citable sources. Return a short narrative (1–2 paragraphs) then 3–5 signal blocks.\n\n${SIGNAL_FORMAT}`
  },
  {
    stage: "signals-macro",
    name: "Signals: Macro Briefing",
    description: "Daily macro/geopolitical snapshot with concrete numbers.",
    notes: "The Grid",
    body:
      "Give a focused macro/geopolitical snapshot for today: oil (Brent), the equity mood, and one or two geopolitical developments. Lead with concrete numbers and a one-line atmosphere read. Keep it under 200 words. Cite live sources."
  },
  {
    stage: "fintel-bridge",
    name: "Signals: Fintel Bridge",
    description: "Extracts signal blocks from a financial intelligence report.",
    notes: "The Grid",
    body:
      `Read the financial intelligence report below and extract 2–3 of its strongest, most concrete claims as signal blocks. Pure extraction — do not add outside information.\n\n${SIGNAL_FORMAT}`
  },
  {
    stage: "synthesis",
    name: "Synthesis: converge + seed",
    description: "Dedups the window's signals, finds convergence, proposes story seeds.",
    notes: "The Grid",
    body:
      "From the signals below: (1) deduplicate to 5–7 distinct signals, each with a one-line story hook; (2) name 2–3 convergence trends across them; (3) propose 2–3 story seeds (a character situation pressured by a convergence), each with a one-line premise; (4) give 3 cover-image prompts. Avoid reusing recent easter-egg topics. Be concrete and forward-reading."
  },
  {
    stage: "reviewgate",
    name: "ReviewGate: recommendation",
    description: "Recommends seed/character/emotion/easter method under continuity rules.",
    notes: "The Grid",
    body:
      "Given the synthesis seeds and the continuity rules provided, recommend the next episode's choices as strict JSON: { seed, character, emotion, easterMethod, signals, macroDetail, rationale }. Obey the rules: do not reuse the blocked character or the blocked emotions; use the provided next easter-egg method and installment number."
  },
  {
    stage: "story",
    name: "Story: episode engine",
    description: "Writes the episode in voice from the session (bible + log + gate + signals).",
    notes: "The Grid",
    body:
      "Write the next installment of THE GRID from the session below. 900–1,100 words. Open inside a scene already in the problem; keep the body in the room with sensory anchors; let the signal pressure a concrete choice; land on image or action. Then add a 150–200 word Signal Decoder (which real signals the story used), Substack metadata (Title, Subtitle, Preview, Emotional tag, Tags), and a Story Log entry block titled 'Installment NNN — \"Title\"' with the tracked fields. Honor the voice profile and continuity (no repeated character/emotion; the assigned easter-egg method)."
  },
  {
    stage: "critic",
    name: "Critic: quality gate",
    description: "Grades a draft against the StoryEngine checklist; returns JSON verdict.",
    notes: "The Grid",
    body:
      "Grade the draft against the quality checklist: banned vocabulary, 900–1,100 word target, no lists-of-three, emotion not repeated from the last two installments, lead character not repeated from the last one, sensory anchoring, plain-language tech windows. Return strict JSON: { pass: boolean, violations: string[] }. Be specific and terse."
  }
];

export const GRID_RECIPE: WorkflowRecipePreview = {
  name: "THE GRID — Signals → Synthesis → ReviewGate → Story",
  description: "The signal-to-fiction episode pipeline: collect signals, synthesize, gate, write the episode with a critic loop, publish.",
  stages: ["signals-deepdive", "signals-macro", "synthesis", "reviewgate", "story"],
  toggles: [
    { name: "Deep Dive mode", value: "fusion", options: ["chat", "web_search", "fusion"] },
    { name: "Macro mode", value: "web_search", options: ["chat", "web_search"] }
  ],
  judgeReadiness: {
    voiceFidelity: true,
    antiSlop: true,
    theologicalRigor: false,
    structuralClarity: true,
    researchGrounding: true
  }
};
