// Do-not-flag guards (Layer 1 of the adjudicated quality gate).
//
// Ported from the Looks-Like-a-Tell false-positive catalogue (v1.3) and the
// anti-slop negative constraints. These run BEFORE any flag is emitted.
//
// The governing rule from the adjudication module: the burden of proof sits on
// the flag. A phrase is slop when you can say what it FAILS to do — not when it
// merely carries a construction that often signals slop. Over-flagging a strong
// artifact is an error of the same size as missing a deck-wide pattern.

import { DEFAULT_BANNED_TERMS } from "./defaults";
import type { ContentFormat, Register, SurfacePosition } from "./registers";

export interface GuardContext {
  phrase: string;
  position: SurfacePosition;
  register: Register;
  format: ContentFormat;
}

export interface GuardHit {
  /** Stable id so a suppression can be explained and tested. */
  id: string;
  /** The catalogue entry this guard came from. */
  catalogue: string;
  reason: string;
}

export type Guard = (ctx: GuardContext) => GuardHit | null;

/** Abstractions that carry no checkable content when they stand alone. */
export const ABSTRACTION_TOKENS = [
  ...DEFAULT_BANNED_TERMS,
  "value",
  "potential",
  "excellence",
  "journey",
  "synergy",
  "synergies",
  "momentum",
  "landscape",
  "commitment",
  "committed",
  "pivotal",
  "category-defining",
  "enablement",
  "realization",
  "meaningful",
  "impact",
  "proactive",
  "resilient",
  "collaborative",
  "remarkable",
  "sophisticated",
  "best-in-class",
  "world-class",
  "state-of-the-art",
  "next-generation",
  "stakeholder",
  "alignment",
  "efficiencies",
  "outcomes",
  "capabilities",
  "solutions",
  "accountability",
  "collaboration",
  "transparency",
  "innovation",
  "efficiency",
  "productivity",
  "engagement",
  "empowerment",
  "transformation",
  "posture",
  "opportunity",
  "ambition",
  "execution",
  "multi-layered"
];

export interface StockFormula {
  pattern: RegExp;
  mechanism: string;
  bucket: 1 | 2 | 3 | 4;
  code: string;
}

// ---- Anti-slop v1.2 vocabulary (F/V/W/R) ----
// The four buckets are v1.2's four codes under their field-kit numbers:
// 1 formulaic/manufactured = F, 2 vague/unsupported = V,
// 3 wordy/indirect/jargon = W, 4 repetitive/over-framed = R.
export type SlopCode = "F" | "V" | "W" | "R";
export type SlopBucket = 1 | 2 | 3 | 4;

export const SLOP_CODE_BY_BUCKET: Record<SlopBucket, SlopCode> = { 1: "F", 2: "V", 3: "W", 4: "R" };

/**
 * v1.2 primary-cause order for a phrase that trips several codes: V (meaning or
 * support missing) before W (meaning recoverable but buried) before F (clear
 * meaning, canned phrasing) before R (useful point delayed or duplicated).
 */
export const PRIMARY_CAUSE_ORDER: SlopBucket[] = [2, 3, 1, 4];

/**
 * Canned openers, closers, and empty benefits, each mapped to the four-bucket
 * taxonomy and its sub-pattern code from the Content Grading V2 field kit.
 * Order matters: scene-setting is checked before the comparatives inside it.
 */
export const STOCK_FORMULAS: StockFormula[] = [
  { pattern: /\bin today'?s\b[^.]{0,40}\b(landscape|world|environment|market|era|climate)\b/i, mechanism: "generic scene-setting", bucket: 4, code: "S4.1" },
  { pattern: /\bat the end of the day\b/i, mechanism: "canned summation", bucket: 4, code: "S4.4" },
  { pattern: /\bwhen it comes to\b/i, mechanism: "restating the request", bucket: 4, code: "S4.2" },
  { pattern: /\bthere are (several|many|a number of) (ways|strategies|options|approaches)\b/i, mechanism: "meta-announcement", bucket: 4, code: "S4.3" },
  { pattern: /\bexperts agree\b|\bstudies show\b(?![^.]*\d)/i, mechanism: "unnamed authority", bucket: 2, code: "S2.5" },
  { pattern: /\breflects our commitment\b/i, mechanism: "empty abstraction", bucket: 2, code: "S2.1" },
  { pattern: /\bunlock(s|ing)? (the )?(full )?(value|potential)\b/i, mechanism: "tacked-on benefit", bucket: 2, code: "S2.3" },
  { pattern: /\bunlock(s|ing)? .{0,20}\b(synerg|value|growth|efficien)/i, mechanism: "tacked-on benefit", bucket: 2, code: "S2.3" },
  { pattern: /\btruly\b/i, mechanism: "unearned intensifier", bucket: 2, code: "S2.1" },
  { pattern: /\bthe journey (to|toward|continues|ahead)\b|\bon a journey\b/i, mechanism: "stock formula", bucket: 1, code: "S1.3" },
  { pattern: /\bwe remain committed\b/i, mechanism: "promotional register", bucket: 1, code: "S1.9" },
  { pattern: /\btogether,? we can\b/i, mechanism: "canned ending", bucket: 1, code: "S1.11" },
  { pattern: /\bthe time is now\b/i, mechanism: "slogan fragment", bucket: 1, code: "S1.4" },
  { pattern: /\blook(ing)? to the future\b/i, mechanism: "canned ending", bucket: 1, code: "S1.11" },
  { pattern: /\bbuilding the future of\b/i, mechanism: "inflated significance", bucket: 1, code: "S1.8" },
  { pattern: /\ba pivotal moment\b/i, mechanism: "inflated significance", bucket: 1, code: "S1.8" },
  { pattern: /\bunderscores the importance\b/i, mechanism: "inflated significance", bucket: 1, code: "S1.8" },
  { pattern: /\bbridge the gap between\b/i, mechanism: "stock figure", bucket: 1, code: "S1.3" },
  { pattern: /\bwe are here to support you\b/i, mechanism: "promotional register", bucket: 1, code: "S1.9" },
  { pattern: /\b(delivering|deliver) excellence\b|\boperational excellence\b/i, mechanism: "promotional register", bucket: 1, code: "S1.9" },
  { pattern: /\bmore .{0,24} than ever\b/i, mechanism: "unearned comparative", bucket: 1, code: "S1.8" }
];

/** Terms of art. A shared domain term is not jargon in its own room. (B8) */
export const DOMAIN_TERMS = [
  "epic",
  "sprint",
  "backlog",
  "theme",
  "ebitda",
  "dpa",
  "sla",
  "escrow",
  "cohort",
  "retention cohort",
  "churn",
  "arr",
  "mrr",
  "runway",
  "pipeline",
  "firewall",
  "waterfall",
  "onboarding",
  "reconciliation",
  "risk assessment",
  "account takeover",
  "refund abuse",
  "card testing",
  "activation",
  "enrolment",
  "enrollment",
  "postmortem",
  "incident",
  "throughput",
  "latency"
];

// Full month names only. An abbreviation pattern like /(jan|mar|dec)[a-z]*/
// matches "decision", "marketing", and the modal "may" — which silently turned
// vague prose into "carries a date" and suppressed real flags. Any actual date
// carries a digit, and the digit test above already catches those.
const MONTHS = /\b(january|february|march|april|june|july|august|september|october|november|december)\b/i;

/**
 * Gate 1 (Information): does the phrase carry something a reader could act on,
 * check, or be wrong about? A number, date, sample, named actor, or unit.
 */
/**
 * Spelled-out quantities. Good prose writes "four days", not "4 days", and
 * without this the digit test alone reads a specific sentence as an abstraction.
 * "one" is deliberately excluded — it is far more often a pronoun ("one of the",
 * "no one") than a count, and treating it as a figure hands out free passes.
 */
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|billion|half|dozen)\b/i;

export function hasConcreteAnchor(phrase: string): boolean {
  if (/\d/.test(phrase)) return true;
  if (NUMBER_WORDS.test(phrase)) return true;
  if (MONTHS.test(phrase)) return true;
  if (/\bn\s*=/i.test(phrase)) return true;
  if (/[£$€%]/.test(phrase)) return true;
  return hasNamedEntity(phrase);
}

/**
 * A capitalised word that is not merely sentence-initial. Words following a
 * full stop are sentence starts too — counting them turned "Win the close.
 * Keep the evidence." into a phrase with a "named entity".
 */
export function hasNamedEntity(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  // Title Case capitalises everything, so capitalisation carries no information
  // there. Without this, "Unlocking Tomorrow's Potential" reads as a phrase full
  // of named entities and the Gate-1 guard clears pure boiler plate.
  if (isTitleCase(words)) return false;
  return words.some((word, index) => {
    if (index === 0) return false;
    const previous = words[index - 1] ?? "";
    if (/[.!?:]$/.test(previous)) return false; // start of a new sentence
    return /^[A-Z][A-Za-z-]+$/.test(word.replace(/[^A-Za-z-]/g, ""));
  });
}

/** Most substantive words capitalised — Title Case, where caps mean nothing. */
export function isTitleCase(words: string[]): boolean {
  const substantive = words.filter((word) => word.replace(/[^A-Za-z]/g, "").length > 2);
  if (substantive.length < 3) return false;
  const capitalised = substantive.filter((word) => /^[A-Z]/.test(word.replace(/[^A-Za-z]/g, "")));
  return capitalised.length / substantive.length >= 0.6;
}

/** A named actor performing a stated action, in either voice. */
export function hasNamedActor(phrase: string): boolean {
  if (/\bby [A-Z][a-z]+/.test(phrase)) return true; // "approved by Legal"
  if (/\bby (the )?[a-z]+ (team|group|committee|board)\b/i.test(phrase)) return true;
  return false;
}

function containsAny(phrase: string, terms: string[]): boolean {
  const lower = phrase.toLowerCase();
  return terms.some((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower));
}

/** "Label: value" where the value is real data rather than an empty adjective. (A8) */
export function isLabelColonWithData(phrase: string): boolean {
  const match = phrase.match(/^\s*([A-Za-z][A-Za-z \-/]{1,30}):\s*(.+)$/);
  if (!match) return false;
  const value = match[2].trim();
  if (!value) return false;
  // An empty adjective as the whole value is the mechanical-label-bullet tic.
  if (/^(significant|high|low|strong|positive|improved|meaningful|substantial|various|multiple|several|tbd|good|better)\b/i.test(value)) {
    return false;
  }
  return hasConcreteAnchor(value) || value.split(/\s+/).length >= 2;
}

/** A contrast where BOTH sides name a real candidate. (B5) */
export function isRealContrast(phrase: string): boolean {
  const match = phrase.match(/(.+?),?\s+not\s+(.+)/i);
  if (!match) return false;
  const [, left, right] = match;
  // A strawman rejection ("not just a X — a Y") is the inflated-contrast tic.
  if (/\bjust\b/i.test(phrase)) return false;
  return hasNamedEntity(left) || hasNamedEntity(right) || (/\bthe \w+\b/i.test(left) && /\bthe \w+\b/i.test(right));
}

/** Count hedge markers. One matching a real unknown is fine; four stacked are not. (B9) */
export function hedgeCount(phrase: string): number {
  const hedges = /\b(may|might|could|possibly|potentially|perhaps|arguably|somewhat|it seems|appears to|worth considering|relatively)\b/gi;
  return (phrase.match(hedges) ?? []).length;
}

/** A three-item list whose items are nouns/noun phrases rather than adjectives. (B1) */
export function isDistinctNounTriad(phrase: string): boolean {
  const parts = splitTriad(phrase);
  if (parts.length < 3) return false;
  return parts.filter(isAdjectival).length < 2;
}

/** Split a candidate three-item list on commas and a trailing "and". */
export function splitTriad(phrase: string): string[] {
  return phrase
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Comparatives and adjective endings — three of these is a rhetorical triad. (B1) */
export function isAdjectival(part: string): boolean {
  const head = part.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (/^(more|less|faster|cheaper|better|simpler|smarter|stronger|quicker|safer|easier)$/.test(head)) return true;
  return /(er|ier|est|ive|able|ible|ful|ous|ic|al|ing)$/i.test(head.replace(/[^a-z-]/gi, ""));
}

/** The ordered guard set. First hit suppresses the flag. */
export const GUARDS: Guard[] = [
  // Catalogue B20 — never flag a sentence for opening with a conjunction.
  (ctx) =>
    /^(and|but|so|yet|or)\b/i.test(ctx.phrase.trim()) && ctx.phrase.trim().split(/\s+/).length > 3
      ? { id: "B20-opening-conjunction", catalogue: "B20", reason: "opening conjunction is natural written English" }
      : null,

  // Catalogue B14 / negative constraint 3 — shortness is never itself the fault.
  (ctx) =>
    ctx.phrase.trim().split(/\s+/).length <= 6 && hasConcreteAnchor(ctx.phrase)
      ? { id: "B14-short-and-specific", catalogue: "B14", reason: "short and specific is the target, not a defect" }
      : null,

  // Catalogue A6/A7 — a noun phrase naming a category is what a label is for.
  // Deliberately NOT applied to slop-prone surfaces (title, subhead, callout):
  // catalogue A1 is explicit that a title still has to name a subject, so
  // "Building the future of field operations" must stay flaggable.
  // Footnotes are excluded: catalogue A10 governs them, and it requires an
  // author, a date, or a sample — "Based on a recent industry survey" is a noun
  // phrase too, and it is exactly the thing A10 says to flag.
  (ctx) =>
    ctx.register.nounPhraseExpected &&
    !ctx.register.slopProne &&
    ctx.position !== "footnote" &&
    !/[.!?]/.test(ctx.phrase) &&
    ctx.phrase.trim().split(/\s+/).length <= 8
      ? { id: "A6-label-noun-phrase", catalogue: "A6/A7", reason: `noun phrase in ${ctx.position} names a category` }
      : null,

  // Catalogue A10 — a footnote with an author, date, or sample is doing its job.
  (ctx) =>
    ctx.position === "footnote" && hasConcreteAnchor(ctx.phrase)
      ? { id: "A10-sourced-footnote", catalogue: "A10", reason: "source line carries author, date, or sample" }
      : null,

  // Catalogue A9 — a figure with a population or unit is a real callout.
  (ctx) =>
    ctx.position === "callout" && /\d/.test(ctx.phrase) && ctx.phrase.trim().split(/\s+/).length > 1
      ? { id: "A9-callout-with-population", catalogue: "A9", reason: "figure states what it counts" }
      : null,

  // Catalogue A8 — label-colon carrying real data is a data structure.
  (ctx) =>
    isLabelColonWithData(ctx.phrase)
      ? { id: "A8-label-colon-data", catalogue: "A8", reason: "label names a category and the value is real data" }
      : null,

  // Catalogue B5 — a contrast between two real candidates states a distinction.
  (ctx) =>
    isRealContrast(ctx.phrase)
      ? { id: "B5-real-contrast", catalogue: "B5", reason: "both sides of the contrast name a real candidate" }
      : null,

  // Catalogue B12 — passive voice that names its actor is not hiding anything.
  (ctx) =>
    hasNamedActor(ctx.phrase)
      ? { id: "B12-passive-named-actor", catalogue: "B12", reason: "the actor is named" }
      : null,

  // Catalogue B8 / negative constraint 4 — a term of art is not jargon.
  (ctx) =>
    containsAny(ctx.phrase, DOMAIN_TERMS) && hasConcreteAnchor(ctx.phrase)
      ? { id: "B8-domain-term", catalogue: "B8", reason: "domain term used with an audience that shares it" }
      : null,

  // Catalogue B1 — a real list is not a rhetorical triad.
  (ctx) =>
    isDistinctNounTriad(ctx.phrase) && !ctx.register.proseStandards
      ? { id: "B1-distinct-triad", catalogue: "B1", reason: "three distinct items, not three overlapping adjectives" }
      : null,

  // Gate 1 — the phrase carries checkable content and states an action or change.
  (ctx) =>
    hasConcreteAnchor(ctx.phrase) && !containsAny(ctx.phrase, ABSTRACTION_TOKENS)
      ? { id: "G1-carries-information", catalogue: "Gate 1", reason: "carries a figure, date, or named entity a reader could check" }
      : null
];

/** Run the guard set. Returns the first suppression, or null to allow a flag. */
export function guardPhrase(ctx: GuardContext): GuardHit | null {
  for (const guard of GUARDS) {
    const hit = guard(ctx);
    if (hit) return hit;
  }
  return null;
}

export { containsAny };
