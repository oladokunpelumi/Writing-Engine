// UGC Video Studio engine (BUILD 2). Turns a finished piece OR a product brief
// into a short-form video package for Google Flow / Veo 3: a spoken script, a
// per-shot Veo prompt list, and (in routes) keyframe stills. Reuses BUILD 1's
// shared primitives — the one through-line is ONE_THING_DOCTRINE; the spoken
// hook is generated + scored by the Headline/Hook Lab (video-hook mode) in the
// experiments route — so this engine only owns the script/shots structure.
import {
  ONE_THING_DOCTRINE,
  PERSONA_CASTING_DOCTRINE,
  UGC_VIDEO_DOCTRINE,
  VEO_PROMPT_DOCTRINE
} from "../../shared/src";
import type { PersonaSuggestion, ReferenceBlueprint, ShotList, VideoPersona, VideoScript, VideoSourceType } from "../../shared/src";
import { aiProvider, modelFor, parseJson, rawChat } from "./openrouter";

function personaBrief(persona?: VideoPersona | null): string {
  if (!persona) return "No persona set — write in a natural, first-person creator voice.";
  return [
    `Persona: ${persona.name}.`,
    persona.appearance && `Appearance: ${persona.appearance}.`,
    persona.wardrobe && `Wardrobe: ${persona.wardrobe}.`,
    persona.setting && `Setting: ${persona.setting}.`,
    persona.vocalStyle && `Vocal style: ${persona.vocalStyle}.`,
    persona.mannerisms && `Mannerisms: ${persona.mannerisms}.`,
    persona.visualStyle && `Visual style: ${persona.visualStyle}.`
  ]
    .filter(Boolean)
    .join(" ");
}

// ---- Reference analysis: reverse-engineer why a video holds attention ----
export async function analyzeReference(transcript: string): Promise<ReferenceBlueprint> {
  if (aiProvider() === "mock" || !transcript.trim()) {
    return {
      hookType: "pattern-interrupt: a bold on-screen claim in the first second",
      structure: ["Hook: name the surprising claim", "Proof: one concrete example", "Turn: the counterintuitive why", "CTA: one clear ask"],
      pacingNotes: "Fast cuts every ~2-3s; no dead air; escalating energy into the CTA.",
      tone: "Confident, casual, a little contrarian.",
      retentionTactics: ["open loop restated at the midpoint", "on-screen captions", "direct 'you' address"]
    };
  }
  const system =
    "You reverse-engineer short-form videos. Return ONLY strict JSON: { hookType, structure: string[], pacingNotes, tone, retentionTactics: string[] }. Capture the SHAPE (hook type, beat structure, pacing, tone, retention tactics) — never copy the content.";
  const { content } = await rawChat({
    model: modelFor("video-reference"),
    system,
    user: `Reference video transcript / description:\n${transcript.slice(0, 6000)}`,
    temperature: 0.3
  });
  return parseJson<ReferenceBlueprint>(content);
}

// ---- Cast: suggest one persona per attention angle, matched to the script ----
export async function suggestPersonas(input: { script?: VideoScript; sourceText: string }): Promise<PersonaSuggestion[]> {
  const topic = input.script
    ? [input.script.hook, ...input.script.beats.map((b) => b.spokenLine), input.script.cta].filter(Boolean).join(" ")
    : input.sourceText;
  if (aiProvider() === "mock" || !topic.trim()) {
    return [
      {
        angle: "contrast",
        rationale: "The last person you'd expect to teach this — the incongruity is the hook, the reversal is the proof.",
        name: "The Reversal",
        appearance: "40s, warm and weathered, the visible marks of a hard road behind them",
        wardrobe: "plain, lived-in",
        setting: "a modest room that quietly shows how far they've come",
        vocalStyle: "low, unhurried, matter-of-fact",
        mannerisms: "steady eye contact, small knowing pauses",
        visualStyle: "grainy handheld selfie, honest natural light"
      },
      {
        angle: "relatable",
        rationale: "The viewer at their own stage of the same struggle — 'that's me, they get it.'",
        name: "The Mirror",
        appearance: "late-20s, tired but determined, mid-journey not arrived",
        wardrobe: "everyday casual",
        setting: "a small apartment or car, real and unstaged",
        vocalStyle: "fast, candid, a little raw",
        mannerisms: "talks with their hands, quick half-laughs",
        visualStyle: "vertical phone video, ambient room light"
      },
      {
        angle: "authority",
        rationale: "Visibly embodies the result, so competence is assumed on sight.",
        name: "The Proof",
        appearance: "polished, composed, unmistakably successful at the thing they teach",
        wardrobe: "sharp, intentional",
        setting: "a clean, elevated space that signals the outcome",
        vocalStyle: "calm, precise, confident",
        mannerisms: "minimal, deliberate gestures",
        visualStyle: "crisp cinematic selfie, controlled light"
      }
    ];
  }
  const system = `You cast UGC video presenters.\n\n${PERSONA_CASTING_DOCTRINE}`;
  const user = [
    'Return ONLY strict JSON: an array of EXACTLY 3 objects, one per angle in this order — "contrast", "relatable", "authority". Each object: { angle, rationale, name, appearance, wardrobe, setting, vocalStyle, mannerisms, visualStyle }.',
    "rationale = one line on why this casting stops the scroll. Keep every persona specific, dignified, and believable.",
    `Script / topic to cast for:\n${topic.slice(0, 3000)}`
  ].join("\n\n");
  const { content } = await rawChat({ model: modelFor("video-reference"), system, user, temperature: 0.9 });
  return parseJson<PersonaSuggestion[]>(content);
}

// ---- Script: hook → beats → CTA, in the persona's voice ----
export async function runVideoScript(input: {
  sourceText: string;
  sourceType: VideoSourceType;
  persona?: VideoPersona | null;
  blueprint?: ReferenceBlueprint;
  platform: string;
  targetSeconds: number;
  promptBody?: string;
}): Promise<{ script: VideoScript; cost: number }> {
  const beats = Math.max(2, Math.min(8, Math.round(input.targetSeconds / 8)));
  const sourceFraming =
    input.sourceType === "product"
      ? "This is a UGC ad. Make a real person authentically recommend the product below — hook, why it matters, one proof, one CTA. Never sound like a corporate ad."
      : "Tease and promote the finished piece below — make a viewer want to read it. Pull the single most magnetic idea; do not summarize the whole thing.";
  if (aiProvider() === "mock" || !input.sourceText.trim()) {
    const script: VideoScript = {
      hook: "I archived four productivity apps inside my current productivity app.",
      beats: Array.from({ length: beats }, (_, i) => ({
        idea: `Beat ${i + 1}: escalate the one idea`,
        spokenLine:
          i === 0
            ? "Every system I adopt quietly becomes another thing to maintain."
            : `Here's the part nobody admits (${i}): organizing the work became the work.`
      })),
      cta: input.sourceType === "product" ? "Link's in bio — try it free." : "Full piece is in my bio. Go read it.",
      totalSeconds: beats * 8
    };
    return { script, cost: 0 };
  }
  const system = [
    input.persona ? `Speak entirely as this creator. ${personaBrief(input.persona)}` : "Write in a natural, first-person creator voice.",
    ONE_THING_DOCTRINE,
    UGC_VIDEO_DOCTRINE,
    input.blueprint ? `Model the shape of this proven reference (do not copy its content): ${JSON.stringify(input.blueprint)}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const user = [
    input.promptBody ??
      "Write a short-form UGC video script. Return ONLY strict JSON: { hook, beats: [{ idea, spokenLine }], cta, totalSeconds }.",
    sourceFraming,
    `Platform: ${input.platform}. Target length: ~${input.targetSeconds}s (~${beats} beats). Each spokenLine must be sayable in one breath.`,
    `Source:\n${input.sourceText.slice(0, 6000)}`
  ].join("\n\n");
  const { content, usage } = await rawChat({ model: modelFor("video-script"), system, user, temperature: 0.8 });
  return { script: parseJson<VideoScript>(content), cost: usage?.cost ?? 0 };
}

// ---- Shots: one ~8s Veo prompt per beat, persona identical across shots ----
export async function runVideoShots(input: {
  script: VideoScript;
  persona?: VideoPersona | null;
  platform: string;
  promptBody?: string;
}): Promise<{ shotList: ShotList; cost: number }> {
  const beats = input.script.beats.length || 1;
  if (aiProvider() === "mock") {
    const lines = [input.script.hook, ...input.script.beats.map((b) => b.spokenLine)];
    const shots = lines.slice(0, beats + 1).map((line, index) => ({
      index,
      spokenLine: line,
      visualPrompt: `${personaBrief(input.persona)} Handheld selfie video, subject speaks to camera, soft natural window light, casual bedroom setting, vertical 9:16, candid UGC style. Audio: the subject says "${line}".`,
      audioCue: "ambient room tone; no music bed",
      onScreenText: line.slice(0, 40),
      durationSec: 8
    }));
    return { shotList: { shots }, cost: 0 };
  }
  const system = [
    "You are a shot designer for Google Flow / Veo 3.",
    VEO_PROMPT_DOCTRINE,
    `Keep this creator IDENTICAL in every shot: ${personaBrief(input.persona)}`
  ].join("\n\n");
  const user = [
    input.promptBody ??
      "Turn the script into a Veo 3 shot list. Return ONLY strict JSON: { shots: [{ index, spokenLine, visualPrompt, audioCue, onScreenText, durationSec }] }.",
    `Platform: ${input.platform}. One shot per beat (plus the hook as shot 0), ~8s each.`,
    `Script:\n${JSON.stringify(input.script, null, 2)}`
  ].join("\n\n");
  const { content, usage } = await rawChat({ model: modelFor("video-shots"), system, user, temperature: 0.6 });
  return { shotList: parseJson<ShotList>(content), cost: usage?.cost ?? 0 };
}
