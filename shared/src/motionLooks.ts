// House looks for motion stories, and the treatments a beat can take.
//
// One source of truth: the Story stage shows these, the words gate checks
// treatments against them, and the piece-folder export writes them to
// work/motion-kit/looks.json, where the builder (motion-kit/build.mjs) turns a
// story into a HyperFrames project. A look is the rules of one medium, not a
// palette: what the ground is, what may carry ink, how words arrive, what moves
// between beats, and what the music feels like.

export const MOTION_LOOK_IDS = ["paper-ember", "night-signal", "riso-print"] as const;
export type MotionLookId = (typeof MOTION_LOOK_IDS)[number];

export const MOTION_TREATMENTS = [
  "reveal", // words resolve in reading order, the look's own way
  "slam", // the emphasis word lands hard, with a three-frame shake
  "underline", // a hand-drawn squiggle draws under the emphasis word
  "circle", // a hand-drawn ellipse draws around the emphasis word
  "strike", // the emphasis word is struck through (a negation, a correction)
  "focus", // the first line falls back out of focus as the next resolves
  "count", // the emphasis figure counts up to its value
  "stamp", // the emphasis word is printed on, plates settling into register
  "still" // words build, then nothing moves (the beat before or the payoff)
] as const;
export type MotionTreatment = (typeof MOTION_TREATMENTS)[number];

export const MOTION_TREATMENT_NOTES: Record<MotionTreatment, string> = {
  reveal: "Words resolve in reading order.",
  slam: "The key word lands hard. For a claim that should hit.",
  underline: "A hand-drawn line under the key word. For the word the beat turns on.",
  circle: "A hand-drawn ring around the key word. For a detail worth pointing at.",
  strike: "The key word is crossed out. For 'not X' turns and corrections.",
  focus: "The first line blurs back as the second arrives. For 'not this, but that'.",
  count: "The figure counts up. Only for a beat whose key word is a number.",
  stamp: "The key word is printed on. Riso Print only; elsewhere it lands as a slam.",
  still: "Words build, then hold dead still. For the payoff or the breath before it."
};

export interface MotionLook {
  id: MotionLookId;
  name: string;
  /** When to pick it, in one line. */
  bestFor: string;
  /** What the medium is, in a sentence. */
  medium: string;
  palette: {
    ground: string;
    ink: string;
    /** The one accent: hand-drawn marks and other graphics (3:1 against the ground). */
    accent: string;
    /** The accent as text: the emphasis word itself (at least 4.5:1 against the ground). */
    accentText: string;
    /** A second ink with one job (Paper: the reflective turn; Riso: plate B). */
    second: string;
    /** Words not yet revealed, quiet lines. */
    muted: string;
  };
  display: {
    family: string;
    weight: number;
    caps: boolean;
    lineHeight: number;
    tracking: string;
    /** Largest size in px a card's text may take on a 1080-wide frame. */
    maxSize: number;
    /** Characters per line before the builder splits a story line (layout only; words never change). */
    maxChars: number;
    /** A font file shipped in motion-kit/assets/fonts, or null when HyperFrames bundles the family. */
    file: string | null;
  };
  /** How `reveal` looks in this medium. */
  revealStyle: "blur" | "ink" | "print";
  /** What lives on the ground and moves only at seams. */
  carrier: "none" | "lane-dashes" | "halftone";
  grain: number;
  /** Stroke width in px for hand-drawn marks. */
  markStroke: number;
  /** The treatment a beat gets when the writer has not chosen one. */
  defaults: Record<"hook" | "turn" | "proof" | "payoff" | "cta", MotionTreatment>;
  music: { mood: string; suggestion: string };
}

export const MOTION_LOOKS: Record<MotionLookId, MotionLook> = {
  "paper-ember": {
    id: "paper-ember",
    name: "Paper & Ember",
    bestFor: "Reflective essays and Co-Create's own posts: quiet, warm, written by a hand.",
    medium: "Ink on warm paper with an ember pen that marks the word that matters. Co-Create's own colours and type.",
    palette: { ground: "#F5F1E8", ink: "#111827", accent: "#C26B2C", accentText: "#A3541C", second: "#6E5B92", muted: "#B9B2A4" },
    display: { family: "Syne", weight: 700, caps: false, lineHeight: 1.04, tracking: "-0.01em", maxSize: 170, maxChars: 15, file: "Syne-700-latin.woff2" },
    revealStyle: "ink",
    carrier: "none",
    grain: 0.08,
    markStroke: 10,
    defaults: { hook: "underline", turn: "reveal", proof: "circle", payoff: "still", cta: "underline" },
    music: { mood: "calm, warm, unhurried", suggestion: "Mixkit #419 'Pilates and Yoga' (Arulo), ambient" }
  },
  "night-signal": {
    id: "night-signal",
    name: "Night Signal",
    bestFor: "Punchy, motivational pieces and hard turns: a road at night, words like signs.",
    medium: "Headlight-white condensed caps on asphalt, one sodium-amber word per card, lane dashes that travel with every cut.",
    palette: { ground: "#131418", ink: "#F3F0E8", accent: "#F4A43A", accentText: "#F4A43A", second: "#E4572E", muted: "#4B4D55" },
    display: { family: "League Gothic", weight: 400, caps: true, lineHeight: 0.92, tracking: "0.01em", maxSize: 300, maxChars: 26, file: null },
    revealStyle: "blur",
    carrier: "lane-dashes",
    grain: 0.06,
    markStroke: 9,
    defaults: { hook: "slam", turn: "reveal", proof: "focus", payoff: "still", cta: "reveal" },
    music: { mood: "night drive, low tension that resolves", suggestion: "Mixkit #723 'Other World' (Lily J), chillout tension" }
  },
  "riso-print": {
    id: "riso-print",
    name: "Riso Print",
    bestFor: "Lists, proof and figures, and Co-Create marketing that should feel loud and made.",
    medium: "A two-plate risograph: blue ink for words, fluorescent orange for emphasis and its off-register shadow, halftone dots for every gradient.",
    palette: { ground: "#F2EDE3", ink: "#2337A0", accent: "#FF5C39", accentText: "#2337A0", second: "#FF5C39", muted: "#B8BCD8" },
    display: { family: "Archivo Black", weight: 400, caps: true, lineHeight: 0.96, tracking: "-0.005em", maxSize: 240, maxChars: 15, file: null },
    revealStyle: "print",
    carrier: "halftone",
    grain: 0.1,
    markStroke: 12,
    defaults: { hook: "stamp", turn: "reveal", proof: "count", payoff: "still", cta: "stamp" },
    music: { mood: "bright, bouncy, made by hand", suggestion: "Mixkit #702 'Pop 09' (Grigoriy Nuzhny), positive" }
  }
};

/** The look a story gets when nobody chose one. */
export const DEFAULT_MOTION_LOOK: MotionLookId = "paper-ember";

/** A treatment that needs a number falls back to reveal; stamp is Riso's own. */
export function resolveTreatment(look: MotionLook, treatment: MotionTreatment, emphasis: string[]): MotionTreatment {
  const hasFigure = emphasis.some((word) => /\d/.test(word));
  const hasEmphasis = emphasis.length > 0;
  if (treatment === "count" && !hasFigure) return hasEmphasis ? "circle" : "reveal";
  if (treatment === "stamp" && look.id !== "riso-print") return hasEmphasis ? "slam" : "reveal";
  if (["slam", "underline", "circle", "strike", "stamp"].includes(treatment) && !hasEmphasis) return "reveal";
  return treatment;
}
