import { createHash } from "node:crypto";
import type { DesireReport, QualityReport, QualityViolation, ScannabilityReport } from "../../shared/src";
import { DEFAULT_BANNED_TERMS, HEADLINE_POWER_WORDS, hasConcreteAnchor, hasNamedEntity } from "../../shared/src";
import { scanPhrase } from "./slopScan";

// Anti-slop v1.2: vocabulary is a CUE to look closer, never a cause. A word on
// these lists is reported as a minor signal and does not, on its own, lower
// trust or decide the verdict. Only a cluster (several cues in one sentence)
// nudges the directness sub-score, because a cluster usually sits on top of a
// real mechanism the adjudicator then names.
const vocabularyCues = [
  ...DEFAULT_BANNED_TERMS,
  "in today's fast-paced world",
  "at the end of the day",
  "not just",
  "more than ever",
  "it is important to note",
  "this underscores",
  "journey",
  "tapestry"
];
const structuralPatterns: Array<[string, RegExp, "critical" | "moderate" | "minor"]> = [
  ["Not just X but Y construction", /not just\b[^.?!]{0,120}\bbut\b/gi, "moderate"],
  ["Throat-clearing opener", /\b(in today's|in a world where|when it comes to)\b/gi, "moderate"],
  ["Wisdom-ending abstraction", /\b(ultimately|at the end of the day|the key is to remember)\b/gi, "minor"],
  ["Self-explaining metaphor", /\bthis metaphor (means|shows|represents)\b/gi, "minor"]
];
// Support missing for a claim (v1.2 V: unsupported) — the one thing that does
// cost trust. An unnamed authority asks the reader to believe without a source.
const UNSUPPORTED_ATTRIBUTION =
  /\b(studies (show|suggest|prove)|research (shows|suggests|proves)|experts (say|agree|believe)|scientists (say|agree)|many (people )?believe|it is (widely|commonly|generally) (known|believed|accepted))\b/gi;

export function evaluateQuality(text: string, generationId?: string): Omit<QualityReport, "id" | "createdAt"> {
  const vocabularyViolations = scanVocabulary(text);
  const structuralViolations = [...scanStructural(text), ...scanUnsupported(text)];
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const sentenceLengths = sentences.map((sentence) => sentence.trim().split(/\s+/).length);
  const avg = sentenceLengths.reduce((sum, length) => sum + length, 0) / Math.max(sentenceLengths.length, 1);
  const variance =
    sentenceLengths.reduce((sum, length) => sum + Math.abs(length - avg), 0) / Math.max(sentenceLengths.length, 1);
  const clusters = cueClusters(sentences);
  const unsupported = structuralViolations.filter((item) => item.label === "Unnamed authority").length;
  const penalties = structuralViolations.length * 1.4 + clusters;

  const directness = clamp(10 - penalties * 0.6);
  const rhythm = clamp(variance > 7 ? 9 : variance > 4 ? 7 : 5);
  const trust = clamp(10 - unsupported * 2);
  const authenticity = clamp(10 - structuralViolations.length * 0.9);
  const density = clamp(10 - countFiller(text) * 0.8);
  const total = Math.round(directness + rhythm + trust + authenticity + density);
  // No automatic Reject (v1.2). The lowest hygiene verdict is Revise; whether a
  // piece is publishable is the publish gate's call, with a named mechanism.
  const verdict = total >= 43 ? "Pass" : total >= 35 ? "Flag" : "Revise";

  return {
    generationId,
    textHash: createHash("sha256").update(text).digest("hex"),
    vocabularyViolations,
    structuralViolations,
    scores: { directness, rhythm, trust, authenticity, density, total },
    verdict,
    summary:
      vocabularyViolations.length + structuralViolations.length === 0
        ? "No slop markers found. Check the substance and accuracy."
        : `${structuralViolations.length} structural marker${structuralViolations.length === 1 ? "" : "s"}${
            vocabularyViolations.length
              ? ` and ${vocabularyViolations.length} vocabulary cue${vocabularyViolations.length === 1 ? "" : "s"} (cues mean look closer, not defects on their own)`
              : ""
          }.`
  };
}

/**
 * Mechanical fixes that keep meaning exactly (v1.2 W: wordy). Deletes
 * throat-clearing and collapses padded phrases. It does NOT swap vocabulary —
 * trading "crucial" for "important" changes the word, not the mechanism — and
 * it leaves staged contrasts ("not just X but Y") for the adjudicated revision,
 * because fixing those needs judgment about what the sentence claims.
 */
export function rewriteSlop(text: string) {
  let revised = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bIn today's fast-paced world,?\s*/gi, ""],
    [/\bIt is important to note that\s*/gi, ""],
    [/\bIt'?s worth noting that\s*/gi, ""],
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bat this point in time\b/gi, "now"],
    [/\butilize\b/gi, "use"],
    [/\butilizes\b/gi, "uses"]
  ];
  for (const [pattern, replacement] of replacements) {
    revised = revised.replace(pattern, replacement);
  }
  // A deletion at a sentence start leaves a lower-case first letter.
  revised = revised.replace(/(^|[.!?]\s+)([a-z])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
  return revised
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scanVocabulary(text: string): QualityViolation[] {
  const violations: QualityViolation[] = [];
  for (const term of vocabularyCues) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      violations.push({
        severity: "minor",
        category: "vocabulary",
        label: `cue: ${term}`,
        excerpt: excerpt(text, match.index ?? 0)
      });
    }
  }
  return violations;
}

/** Sentences carrying three or more vocabulary cues — the only cue signal that is scored. */
function cueClusters(sentences: string[]): number {
  return sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return vocabularyCues.filter((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`).test(lower)).length >= 3;
  }).length;
}

function scanUnsupported(text: string): QualityViolation[] {
  return Array.from(text.matchAll(UNSUPPORTED_ATTRIBUTION)).map((match) => ({
    severity: "moderate" as const,
    category: "structure",
    label: "Unnamed authority",
    excerpt: excerpt(text, match.index ?? 0)
  }));
}

function scanStructural(text: string): QualityViolation[] {
  return structuralPatterns.flatMap(([label, pattern, severity]) =>
    Array.from(text.matchAll(pattern)).map((match) => ({
      severity,
      category: "structure",
      label,
      excerpt: excerpt(text, match.index ?? 0)
    }))
  );
}

function countFiller(text: string) {
  return (text.match(/\b(very|really|just|actually|basically|simply)\b/gi) ?? []).length;
}

function excerpt(text: string, index: number) {
  return text.slice(Math.max(0, index - 45), Math.min(text.length, index + 95)).replace(/\s+/g, " ").trim();
}

function clamp(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Score how well a piece's OPENING magnetizes a reader from the first look —
// recognition-first, specific, no leading-with-the-answer. Rule-based (offline);
// ranks Hook Lab outputs and surfaces an Opener score on a final.
export function hookScore(text: string): { score: number; reasons: string[] } {
  const opener = text.replace(/^#+\s.*$/gm, "").trim();
  const sentences = opener.split(/(?<=[.!?])\s+/).filter(Boolean);
  const head = sentences.slice(0, 3).join(" ");
  const first = sentences[0] ?? head;
  const lower = head.toLowerCase();
  let score = 5;
  const reasons: string[] = [];

  if (/\b(you|your|you're|you've|yourself)\b/.test(lower)) {
    score += 2;
    reasons.push("speaks to 'you'");
  }
  if (/\b(morning|night|kitchen|phone|screen|desk|coffee|mirror|room|hands|eyes|bed|car|midnight|2 ?a\.?m|3 ?a\.?m)\b/.test(lower)) {
    score += 1;
    reasons.push("concrete scene");
  }
  if (/\d/.test(head)) {
    score += 1;
    reasons.push("a specific number");
  }
  if (first.split(/\s+/).length <= 9) {
    score += 1;
    reasons.push("short, punchy open");
  }
  if (/\?/.test(head)) {
    score += 1;
    reasons.push("opens a question");
  }
  if (/^(the (key|secret|truth|answer|problem|point) (to|is|with)|in (today'?s|a world|the world)|many people|we (all|often)|there (is|are)\b|[a-z][a-z\s]+ is (a|the|when|defined as))/i.test(opener)) {
    score -= 3;
    reasons.push("leads with the answer / abstraction");
  }
  if (/^(it'?s worth noting|in this (post|essay|piece|article)|let'?s|i want to|i'?m going to|today,? i)/i.test(opener)) {
    score -= 2;
    reasons.push("throat-clearing opener");
  }
  return { score: Math.max(0, Math.min(10, score)), reasons };
}

// Score an "attention line" (a page headline OR a spoken video hook) by the
// proven magnets — a number, a power word, specificity, a curiosity gap, a
// reader-target, tight length. Rule-based/offline; ranks Headline Lab variants
// (and, in the video studio, spoken-hook variants). Mirrors hookScore's shape.
export function headlineScore(text: string): { score: number; reasons: string[] } {
  const line = (text.replace(/^#+\s*/, "").replace(/["“”]/g, "").trim().split(/\r?\n/)[0] ?? "").trim();
  const lower = line.toLowerCase();
  const words = line.split(/\s+/).filter(Boolean);
  let score = 4;
  const reasons: string[] = [];

  if (/\d/.test(line)) {
    score += 2;
    reasons.push("a specific number");
  }
  const power = HEADLINE_POWER_WORDS.find((word) => lower.includes(word));
  if (power) {
    score += 2;
    reasons.push(`power word "${power}"`);
  }
  if (/\b(you|your|you're|you'll|your's)\b/.test(lower)) {
    score += 1;
    reasons.push("targets the reader");
  }
  if (/\b(how to|ways to|reasons|steps|why|what|the secret|guide to|reveals?)\b/.test(lower)) {
    score += 1;
    reasons.push("a clear promise");
  }
  // Specificity: a year, or a Named thing beyond the first word.
  // Title Case capitalises every word, so capitals alone are not specificity.
  if (/\b(19|20)\d{2}\b/.test(line) || hasNamedEntity(line)) {
    score += 1;
    reasons.push("something specific/named");
  }
  if (/\?/.test(line) || /\b(this|these|the one|nobody|no one|everyone)\b/.test(lower)) {
    score += 1;
    reasons.push("opens a curiosity gap");
  }
  if (words.length >= 4 && words.length <= 14) {
    score += 1;
    reasons.push("tight length");
  }

  if (words.length > 18) {
    score -= 2;
    reasons.push("too long — cut it down");
  }
  if (words.length > 0 && words.length < 3) {
    score -= 1;
    reasons.push("too thin to promise anything");
  }
  // v1.2: judge the line's mechanism, not its vocabulary. The calibrated scanner
  // asks whether the headline is portable (could title any piece), vague, or a
  // stock formula — words alone never cost points.
  const scan = scanPhrase({ phrase: line, position: "title", format: "headline" });
  if (scan.verdict === "slop") {
    score -= scan.primaryCode === "V" ? 3 : 2;
    reasons.push(`${scan.primaryCode ?? "slop"}: ${scan.mechanism ?? "names nothing a reader could check"}`);
  } else if (words.length > 0 && !hasConcreteAnchor(line) && !reasons.includes("targets the reader") && !reasons.includes("a clear promise")) {
    // Portable (v1.2 V): no anchor, no reader, no promise — it could title any piece.
    score -= 2;
    reasons.push("V: portable — could title an unrelated piece unedited");
  }
  const letters = line.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 6 && letters === letters.toUpperCase()) {
    score -= 1;
    reasons.push("all-caps shouting");
  }

  return { score: Math.max(0, Math.min(10, score)), reasons };
}

const SLOW_OPENERS =
  /^(in today'?s|in a world|many people|we all|we often|there (is|are)|it (is|has) (long )?been|since the (dawn|beginning)|throughout (history|time))/i;

// Scannability / "rate of revelation" (Cole): does the piece respect the scroll —
// a short clear open, signposts, varied rhythm, no walls of text, no buried lead?
// Rule-based/offline; feeds the "Make it skimmable" pass. Media-agnostic principles
// that BUILD 2's video retention pacing references.
export function scannabilityScore(text: string): ScannabilityReport {
  const clean = text.trim();
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((part) => part.replace(/^#{1,6}\s.*$/gm, "").trim())
    .filter(Boolean);
  const flags: Array<{ kind: string; excerpt: string }> = [];
  const reasons: string[] = [];
  let penalty = 0;

  const firstPara = paragraphs[0] ?? "";
  const firstSentence = (firstPara.split(/(?<=[.!?])\s+/)[0] ?? "").trim();
  const firstLen = firstSentence.split(/\s+/).filter(Boolean).length;
  if (firstLen > 12) {
    flags.push({ kind: "long-first-sentence", excerpt: firstSentence.slice(0, 120) });
    penalty += 2;
    reasons.push("the first sentence is long — open short and clear");
  }

  let walls = 0;
  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    const words = para.split(/\s+/).filter(Boolean).length;
    if ((sentences > 5 || words > 120) && walls < 3) {
      flags.push({ kind: "wall-of-text", excerpt: para.replace(/\s+/g, " ").slice(0, 90) });
      penalty += 1.5;
      walls += 1;
    }
  }
  if (walls) reasons.push(`${walls} dense paragraph${walls > 1 ? "s" : ""} — break them for the scroll`);

  const headings = (clean.match(/^#{2,6}\s/gm) ?? []).length;
  if (wordCount > 400 && headings === 0) {
    flags.push({ kind: "no-subheadings", excerpt: "" });
    penalty += 2;
    reasons.push("no subheadings on a long piece — add signposts");
  }

  const lengths = clean
    .replace(/^#{1,6}\s.*$/gm, "")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((sentence) => sentence.trim().split(/\s+/).length);
  if (lengths.length > 4) {
    const avg = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    const variance = lengths.reduce((sum, length) => sum + Math.abs(length - avg), 0) / lengths.length;
    if (variance < 4) {
      penalty += 1;
      reasons.push("sentence lengths are too uniform — mix short punches with longer lines");
    }
  }

  if (wordCount > 300 && (SLOW_OPENERS.test(firstPara) || firstLen > 25)) {
    flags.push({ kind: "slow-lead", excerpt: firstPara.replace(/\s+/g, " ").slice(0, 100) });
    penalty += 1.5;
    reasons.push("the lead is slow — front-load the point");
  }

  const score = Math.max(0, Math.min(10, Math.round(10 - penalty)));
  if (!flags.length && !reasons.length) reasons.push("scans cleanly — short open, varied rhythm, signposted");
  return { score, flags, reasons };
}

// Split a piece into sections for the desire meter: markdown headings first
// (heading + its body), falling back to paragraph blocks when there are none.
export function splitSections(text: string): string[] {
  const trimmed = text.trim();
  if (/^#{1,6}\s/m.test(trimmed)) {
    const parts = trimmed
      .split(/\n(?=#{1,6}\s)/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const DESIRE_VERBS =
  /\b(want(?:s|ed)?|wish(?:es|ed)?|need(?:s|ed)?|crave[sd]?|long(?:s|ed)? for|yearn(?:s|ed)?|hop(?:e[sd]?|ing)|hunger(?:s|ed)? for|hungry for|ache[sd]? for|dying to|desperate(?:ly)?|determined to|refus(?:e[sd]?|ing) to|tr(?:y|ies|ied|ying) to|chas(?:e[sd]?|ing)|pursu(?:e[sd]?|ing)|aim(?:s|ed|ing)? to|seek(?:s|ing)?|sought|set out to|dream(?:s|ed|ing)? of|goal|must|has to|have to|hell-bent)\b/i;
// A named/pronoun subject taking a wanting action (agency, not just a static verb).
const DESIRE_AGENCY =
  /\b(I|you|he|she|they|we|[A-Z][a-z]+)\s+(?:want|wish|need|crave|long|yearn|hope|hoping|try|tried|trying|chase|chased|pursue|pursued|refuse|refused|decide|decided|reach|reached|grab|grabbed|fight|fought|seek|sought|beg|begged)\b/;
const DESIRE_STAKES =
  /\b(but|until|unless|if only|can'?t|cannot|won'?t|afraid|fear(?:s|ed)?|risk(?:s|ed)?|los(?:e|es|ing|t)|fail(?:s|ed|ure)?|blocked|stuck|stop(?:s|ped)?|prevent(?:s|ed)?|in the way)\b/i;

// Per-section desire meter (rule-based, offline). Flags sections where no one
// visibly wants anything — the inert/abstract stretches the doctrine targets.
export function desireScore(text: string): DesireReport {
  const blocks = splitSections(text);
  const sections = blocks.map((block, index) => {
    const body = block.replace(/^#{1,6}\s.*$/m, "").trim() || block;
    const signals: string[] = [];
    const want = DESIRE_VERBS.test(body);
    const agency = DESIRE_AGENCY.test(body);
    const stakes = DESIRE_STAKES.test(body);
    if (want) signals.push("names a want");
    if (agency) signals.push("a subject acting on a want");
    if (stakes) signals.push("a stake or obstacle");
    const hasWant = want || agency;
    return {
      index,
      excerpt: body.replace(/\s+/g, " ").slice(0, 140).trim(),
      hasWant,
      signals
    };
  });
  const withWant = sections.filter((section) => section.hasWant).length;
  const score = sections.length === 0 ? 0 : Math.round((withWant / sections.length) * 10);
  const weakSections = sections.filter((section) => !section.hasWant).map((section) => section.index);
  return { score, sections, weakSections };
}
