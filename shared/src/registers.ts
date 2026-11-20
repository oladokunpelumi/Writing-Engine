// Register model (Layer 1 of the adjudicated quality gate).
//
// The central idea of the Looks-Like-a-Tell catalogue: POSITION SETS THE
// REGISTER. A fragment in a title is the register; the same fragment in a body
// line may be a defect. A judgment made against prose standards on an axis
// label is a false positive, and false positives cost the same as misses.
//
// Every surface declares what it is *expected* to carry, so the scanner can
// suppress reflex flags before they are ever emitted.

/** Canonical surface a unit of text sits on. */
export type SurfacePosition =
  | "title"
  | "subhead"
  | "heading"
  | "body"
  | "list-item"
  | "callout"
  | "label"
  | "caption"
  | "footnote"
  | "cta"
  | "closing";

/** The output format a piece belongs to. Registers differ per format. */
export type ContentFormat = "essay" | "thread" | "linkedin" | "newsletter" | "video-script" | "headline" | "slide";

export interface Register {
  /** Sentence fragments are the norm here, not a defect. (Catalogue A1, A5, A6, A7) */
  fragmentsExpected: boolean;
  /** Verb-first imperatives are the norm. (Catalogue B7) */
  imperativesExpected: boolean;
  /** "Label: value" is a data structure here, not a formatting tic. (Catalogue A8) */
  labelColonExpected: boolean;
  /** Bare noun phrases name a category here. (Catalogue A6, A7) */
  nounPhraseExpected: boolean;
  /** Prose standards apply — full sentences, varied rhythm, no slogan cadence. */
  proseStandards: boolean;
  /** Surfaces where canned openings/closings concentrate. (Field kit slide-surface map) */
  slopProne: boolean;
}

const LABEL_LIKE: Register = {
  fragmentsExpected: true,
  imperativesExpected: false,
  labelColonExpected: true,
  nounPhraseExpected: true,
  proseStandards: false,
  slopProne: false
};

const TITLE_LIKE: Register = {
  fragmentsExpected: true,
  imperativesExpected: false,
  labelColonExpected: true,
  nounPhraseExpected: true,
  proseStandards: false,
  slopProne: true // cover lines attract inflated significance
};

const PROSE: Register = {
  fragmentsExpected: false,
  imperativesExpected: false,
  labelColonExpected: false,
  nounPhraseExpected: false,
  proseStandards: true,
  slopProne: false
};

const CLOSING: Register = { ...PROSE, slopProne: true };

const IMPERATIVE: Register = {
  fragmentsExpected: true,
  imperativesExpected: true,
  labelColonExpected: false,
  nounPhraseExpected: false,
  proseStandards: false,
  slopProne: true // generic calls to action live here
};

const BASE_REGISTERS: Record<SurfacePosition, Register> = {
  title: TITLE_LIKE,
  subhead: { ...TITLE_LIKE, slopProne: true },
  heading: LABEL_LIKE,
  body: PROSE,
  "list-item": { ...PROSE, fragmentsExpected: true },
  callout: { ...LABEL_LIKE, slopProne: true },
  label: LABEL_LIKE,
  caption: { ...LABEL_LIKE, slopProne: false },
  footnote: LABEL_LIKE,
  cta: IMPERATIVE,
  closing: CLOSING
};

/**
 * Resolve the register for a surface within a format.
 *
 * Format overrides exist because the same position carries a different register
 * per medium: a spoken UGC line is *supposed* to be fragmentary and direct, and
 * punishing it for that is the register-mismatch error the catalogue warns about.
 */
export function registerFor(position: SurfacePosition, format: ContentFormat = "essay"): Register {
  const base = BASE_REGISTERS[position] ?? PROSE;
  switch (format) {
    case "video-script":
      // Spoken lines: fragments and imperatives are the medium, not a defect.
      return { ...base, fragmentsExpected: true, imperativesExpected: true, proseStandards: false };
    case "thread":
      // Short declaratives per post; fragments acceptable, prose rhythm rules relaxed.
      return { ...base, fragmentsExpected: true, proseStandards: false };
    case "headline":
      return TITLE_LIKE;
    default:
      return base;
  }
}

const POSITION_RULES: Array<[RegExp, SurfacePosition]> = [
  // Data surfaces first — "column header" must not fall through to "header".
  [/\b(axis|legend|column|row|tick|cell|chart label|step label|timeline label|data label|table)\b/i, "label"],
  [/\blabel\b/i, "label"],
  [/\b(footnote|source line|source)\b/i, "footnote"],
  [/\bcaption\b/i, "caption"],
  [/\b(callout|big number|stat)\b/i, "callout"],
  [/\b(subhead|kicker|sub-head)\b/i, "subhead"],
  [/\b(chart title|deck title|slide title|title)\b/i, "title"],
  [/\b(diagram heading|section header|header|heading)\b/i, "heading"],
  [/\b(instruction|call to action|cta)\b/i, "cta"],
  [/\b(closing|final line|last line)\b/i, "closing"],
  [/\b(bullet|body|paragraph|line)\b/i, "body"]
];

/**
 * Map a free-text position description ("Column headers of a three-column
 * comparison table") onto a canonical surface. Unknown descriptions fall back to
 * body, the strictest register, so an unlabelled unit is never under-judged.
 */
export function normalizePosition(raw: string): SurfacePosition {
  const value = (raw ?? "").trim();
  if (!value) return "body";
  // Descriptive positions ("Body bullet, one of six identical label bullets")
  // name their surface first and then describe it. Match the head of the phrase
  // before the whole string, or the trailing description wins and a body bullet
  // is mistaken for a label.
  const head = value.split(/\s+/).slice(0, 3).join(" ");
  for (const [pattern, position] of POSITION_RULES) {
    if (pattern.test(head)) return position;
  }
  for (const [pattern, position] of POSITION_RULES) {
    if (pattern.test(value)) return position;
  }
  return "body";
}
