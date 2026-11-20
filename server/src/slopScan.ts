// Deterministic phrase scanner — the free leg of the hybrid adjudicator.
//
// Implements the Slop Adjudication Module's gates in order, with the
// Looks-Like-a-Tell guards running first. Produces CANDIDATES, not verdicts:
// anything it marks borderline is what the LLM adjudicator re-examines.
//
// Gate 0 register → guards → Gate 1 information → Gate 2 portability →
// Gate 3 form → Gate 4 register → Gate 5 substitution → coin-flip default.
//
// The coin-flip default is not-slop, because the base rate favours it and the
// guidance is explicit that a strong artifact should not be rejected over one
// isolated phrase.

import {
  ABSTRACTION_TOKENS,
  PRIMARY_CAUSE_ORDER,
  SLOP_CODE_BY_BUCKET,
  STOCK_FORMULAS,
  containsAny,
  guardPhrase,
  hasConcreteAnchor,
  hasNamedActor,
  hedgeCount,
  isAdjectival,
  splitTriad,
  type GuardHit,
  type SlopBucket,
  type SlopCode
} from "../../shared/src";
import { normalizePosition, registerFor, type ContentFormat, type SurfacePosition } from "../../shared/src";

export interface PhraseInput {
  phrase: string;
  /** Free-text or canonical position. Defaults to body — the strictest register. */
  position?: string;
  format?: ContentFormat;
}

export interface PhraseScan {
  phrase: string;
  position: SurfacePosition;
  verdict: "slop" | "not-slop";
  bucket?: SlopBucket;
  /** v1.2 letter for the primary cause: F / V / W / R. */
  primaryCode?: SlopCode;
  /** Other codes the phrase also tripped. Recorded, but they don't drive the verdict. */
  secondaryCodes?: SlopCode[];
  /** Strength of the primary evidence: 0 specific mechanism, 1 vocabulary cue, 2 generic. */
  evidenceTier?: 0 | 1 | 2;
  code?: string;
  mechanism?: string;
  /** Why the scanner landed where it did — the evidence, not a restatement. */
  signals: string[];
  suppressedBy?: GuardHit;
  /** Borderline items are the ones worth spending an adjudication call on. */
  confidence: "clear" | "borderline";
}

interface DetectorHit {
  bucket: SlopBucket;
  code: string;
  mechanism: string;
  why: string;
  /**
   * Evidence strength, used before the V > W > F > R order:
   * 0 = a specific mechanism (a stock formula, an unnamed authority, a passive
   *     hiding its actor, stacked hedges);
   * 1 = a vocabulary cue (counting listed abstract words) — v1.2 treats
   *     vocabulary as a cue, never a cause on its own;
   * 2 = a generic "names nothing concrete" signal (portability, a verbless noun
   *     phrase), which rides along with almost every canned phrase.
   * v1.2: record a secondary code only when it causes separate, evidenced harm,
   * so only tier-0 hits count as secondary codes.
   */
  tier: 0 | 1 | 2;
}

const NEGATIVE_PARALLELISM =
  /\b(is|isn'?t|it'?s|not)\b[^.]{0,60}\bnot just\b|\bnot just\b[^.]{0,60}[-—,]|\bisn'?t (just )?a[n]? [^,.]{1,40},? (it'?s|but)\b|\bisn'?t (just )?\w+ ?[-—] ?it'?s\b/i;

const ACTOR_HIDING_PASSIVE =
  /\b(were|was|have been|has been|are|is|been)\s+(raised|made|taken|decided|identified|noted|discussed|considered|implemented|conducted|performed|addressed|reviewed)\b/i;

const NOMINALISATION_CHAIN = /\b\w+(tion|ment|ance|ence|ity|ing)\s+of\s+\w+(tion|ment|ance|ence|ity|ing)?\b/i;

/**
 * Curly quotes and typographic dashes come through from Word and Google Slides
 * and silently break every apostrophe pattern ("isn't" vs "isn't"). Normalise
 * once, at the door, so the detectors can stay readable.
 */
export function normalizeTypography(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "—")
    .trim();
}

/** Language that points at a source: it must then name one. */
const ATTRIBUTION =
  /\bbased on (a|an|the|recent)\b|\b(a|the)?\s*(recent|new|latest) (study|survey|report|research|analysis)\b|\baccording to (industry|experts|research|sources|reports)\b|\b(studies|surveys|reports) (show|suggest|indicate)\b/i;

/** A quantifier standing in for a figure the writer never gives. */
const VAGUE_QUANTIFIER = /\b(most|much|many|a lot) of the\b|\bthe (majority|bulk) of\b/i;

/** Gate 2 — could this be pasted into a deck on an unrelated subject unedited? */
export function portsUnedited(phrase: string): boolean {
  if (hasConcreteAnchor(phrase)) return false;
  return containsAny(phrase, ABSTRACTION_TOKENS);
}

function sentences(phrase: string): string[] {
  return phrase.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Gate 3 — a run of clipped declaratives doing cadence rather than content. */
function isSloganRun(phrase: string): boolean {
  const parts = sentences(phrase);
  if (parts.length < 2) return false;
  const clipped = parts.filter((part) => part.split(/\s+/).length <= 5);
  return clipped.length >= 2 && !hasConcreteAnchor(phrase);
}

/** Gate 3 — three overlapping adjectives rather than three distinct items. */
function isAdjectiveTriad(phrase: string): boolean {
  const parts = splitTriad(phrase);
  if (parts.length < 3) return false;
  return parts.filter(isAdjectival).length >= 2;
}

/** The mechanical label bullet: a category label whose value names no size. */
function isEmptyLabelBullet(phrase: string): boolean {
  const match = phrase.match(/^\s*([A-Za-z][A-Za-z \-/]{1,30}):\s*(.+)$/);
  if (!match) return false;
  return /^(significant|high|low|strong|positive|improved|meaningful|substantial|various|multiple|several|good|better|tbd)\b/i.test(
    match[2].trim()
  );
}

/**
 * Scan one phrase. Guards run before any flag, so a construction that merely
 * looks like a tell is suppressed with the catalogue entry that cleared it.
 */
export function scanPhrase(input: PhraseInput, order: SlopBucket[] = PRIMARY_CAUSE_ORDER): PhraseScan {
  const phrase = normalizeTypography(input.phrase ?? "");
  const position = normalizePosition(input.position ?? "body");
  const format = input.format ?? "essay";
  const register = registerFor(position, format);

  if (!phrase) {
    return { phrase, position, verdict: "not-slop", signals: ["empty"], confidence: "clear" };
  }

  // --- Guards first. Burden of proof sits on the flag. ---
  const guard = guardPhrase({ phrase, position, register, format });
  if (guard) {
    return {
      phrase,
      position,
      verdict: "not-slop",
      signals: [`guard ${guard.id}: ${guard.reason}`],
      suppressedBy: guard,
      confidence: "clear"
    };
  }

  // Every detector runs; the primary cause is chosen afterwards by the v1.2
  // order. A phrase is a candidate if ANY detector fires, so verdicts are the
  // same as a first-match scan — only which code leads can differ.
  const hits: DetectorHit[] = [];
  const hit = (bucket: SlopBucket, code: string, mechanism: string, why: string, tier: 0 | 1 | 2 = 0) =>
    hits.push({ bucket, code, mechanism, why, tier });

  // --- Gate 3 / bucket 1 (F): fixed formulas and manufactured cadence ---
  const formula = STOCK_FORMULAS.find((candidate) => candidate.pattern.test(phrase));
  if (formula) hit(formula.bucket, formula.code, formula.mechanism, `matches a stock formula (${formula.mechanism})`);

  if (NEGATIVE_PARALLELISM.test(phrase)) {
    hit(1, "S1.2", "negative parallelism", "denies a modest claim to inflate a grander one");
  }
  if (isEmptyLabelBullet(phrase)) {
    hit(1, "S1.13", "mechanical label bullet", "the label adds nothing and the value names no size");
  }
  if (isAdjectiveTriad(phrase) && !hasConcreteAnchor(phrase)) {
    hit(1, "S1.5", "rhetorical triad", "three overlapping adjectives with no referent");
  }
  if (register.proseStandards && isSloganRun(phrase)) {
    hit(1, "S1.4", "slogan fragment", "clipped declaratives carrying cadence rather than content");
  }

  // --- Gate 5 / bucket 3 (W): wordiness, stacked hedging, jargon ---
  if (hedgeCount(phrase) >= 2) {
    hit(3, "S3.5", "stacked hedging", "multiple uncertainty markers on a single claim");
  }
  if (NOMINALISATION_CHAIN.test(phrase) && !hasConcreteAnchor(phrase)) {
    hit(3, "S3.1", "nominalisation", "verbs hidden inside nouns; no actor performs anything");
  }
  const abstractionHits = ABSTRACTION_TOKENS.filter((token) =>
    new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(phrase)
  );
  if (abstractionHits.length >= 3 && !hasConcreteAnchor(phrase)) {
    hit(3, "S3.7", "unexplained jargon", `abstraction stacked ${abstractionHits.length} deep with nothing concrete`, 1);
  }

  // --- Gate 1 / bucket 2 (V): carries nothing a reader could check ---
  if (ACTOR_HIDING_PASSIVE.test(phrase) && !hasNamedActor(phrase) && !hasConcreteAnchor(phrase)) {
    hit(2, "S2.1", "actor-hiding passive", "no one performs the action and nothing is recoverable");
  }
  // Catalogue A10 — an ATTRIBUTION with no author, date, or sample. Scoped to
  // attributive language on purpose: a footnote that states a measurement rule
  // ("Losses are measured net of recoveries") or a real limit is carrying
  // content under Gate 1, and flagging it is the false positive A10 warns about.
  if (ATTRIBUTION.test(phrase) && !hasConcreteAnchor(phrase)) {
    hit(2, "S2.5", "unnamed authority", "attributes the claim to a source it never names");
  }
  if (portsUnedited(phrase)) {
    hit(2, "S2.1", "empty abstraction", "ports to an unrelated subject unedited; names no actor, figure, or change", 2);
  }
  // A quantifier where a figure belongs — especially when the specific number
  // is already on the slide one line up.
  if (VAGUE_QUANTIFIER.test(phrase) && !hasConcreteAnchor(phrase)) {
    hit(2, "S2.1", "vague quantifier", "names a share without a figure a reader could check");
  }
  // A verbless abstract noun phrase in a prose surface makes no claim at all.
  const hasVerb = /\b(is|are|was|were|has|have|had|will|can|does|do|rose|fell|grew|adds|drives|names|sets|shows|means|must|should)\b|\w+(s|ed|ing)\b/i.test(phrase);
  if (register.proseStandards && !register.fragmentsExpected && !hasVerb && !hasConcreteAnchor(phrase)) {
    hit(2, "S2.1", "empty abstraction", "a noun phrase presented as a claim; nothing is asserted", 2);
  }

  // --- The genuine coin-flip resolves to not-slop. ---
  if (hits.length === 0) {
    return {
      phrase,
      position,
      verdict: "not-slop",
      signals: ["survived every gate"],
      confidence: hasConcreteAnchor(phrase) ? "clear" : "borderline"
    };
  }

  // Evidence tier first (specific > vocabulary cue > generic), then the v1.2
  // order (V > W > F > R) inside a tier. Sort is stable: on a tie, the detector
  // that ran first wins.
  const rank = (h: DetectorHit) => {
    const index = order.indexOf(h.bucket);
    return h.tier * (order.length + 1) + (index === -1 ? order.length : index);
  };
  const primary = [...hits].sort((a, b) => rank(a) - rank(b))[0];
  // Secondary codes: only tier-0 hits in another bucket count as separate harm.
  const secondaryCodes = [
    ...new Set(hits.filter((h) => h.tier === 0 && h.bucket !== primary.bucket).map((h) => SLOP_CODE_BY_BUCKET[h.bucket]))
  ];

  return {
    phrase,
    position,
    verdict: "slop",
    bucket: primary.bucket,
    primaryCode: SLOP_CODE_BY_BUCKET[primary.bucket],
    secondaryCodes: secondaryCodes.length ? secondaryCodes : undefined,
    evidenceTier: primary.tier,
    code: primary.code,
    mechanism: primary.mechanism,
    // Primary cause's evidence first — adjudicate.ts reads signals[0] as the deciding gate.
    signals: [primary.why, ...hits.filter((h) => h !== primary).map((h) => h.why)],
    confidence: "clear"
  };
}

/** Share of scanned phrases marked slop — the module's base-rate calibration aid. */
export function slopShare(scans: PhraseScan[]): number {
  if (scans.length === 0) return 0;
  return scans.filter((scan) => scan.verdict === "slop").length / scans.length;
}
