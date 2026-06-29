import { createHash } from "node:crypto";
import type { DesireReport, QualityReport, QualityViolation } from "../../shared/src";
import { DEFAULT_BANNED_TERMS } from "../../shared/src";

const tierOne = [...DEFAULT_BANNED_TERMS, "in today's fast-paced world", "at the end of the day"];
const tierTwo = ["not just", "more than ever", "it is important to note", "this underscores", "journey", "tapestry"];
const structuralPatterns: Array<[string, RegExp, "critical" | "moderate" | "minor"]> = [
  ["Not just X but Y construction", /not just\b[^.?!]{0,120}\bbut\b/gi, "moderate"],
  ["Throat-clearing opener", /\b(in today's|in a world where|when it comes to)\b/gi, "moderate"],
  ["Wisdom-ending abstraction", /\b(ultimately|at the end of the day|the key is to remember)\b/gi, "minor"],
  ["Self-explaining metaphor", /\bthis metaphor (means|shows|represents)\b/gi, "minor"]
];

export function evaluateQuality(text: string, generationId?: string): Omit<QualityReport, "id" | "createdAt"> {
  const vocabularyViolations = scanVocabulary(text);
  const structuralViolations = scanStructural(text);
  const sentenceLengths = text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((sentence) => sentence.trim().split(/\s+/).length);
  const avg = sentenceLengths.reduce((sum, length) => sum + length, 0) / Math.max(sentenceLengths.length, 1);
  const variance =
    sentenceLengths.reduce((sum, length) => sum + Math.abs(length - avg), 0) / Math.max(sentenceLengths.length, 1);
  const penalties = vocabularyViolations.length * 1.2 + structuralViolations.length * 1.4;

  const directness = clamp(10 - penalties * 0.6);
  const rhythm = clamp(variance > 7 ? 9 : variance > 4 ? 7 : 5);
  const trust = clamp(10 - vocabularyViolations.filter((item) => item.severity === "critical").length * 2);
  const authenticity = clamp(10 - structuralViolations.length * 0.9);
  const density = clamp(10 - countFiller(text) * 0.8);
  const total = Math.round(directness + rhythm + trust + authenticity + density);
  const verdict = total >= 43 ? "Pass" : total >= 35 ? "Flag" : total >= 25 ? "Revise" : "Reject";

  return {
    generationId,
    textHash: createHash("sha256").update(text).digest("hex"),
    vocabularyViolations,
    structuralViolations,
    scores: { directness, rhythm, trust, authenticity, density, total },
    verdict,
    summary:
      vocabularyViolations.length + structuralViolations.length === 0
        ? "No major slop markers detected. Review for substance and accuracy."
        : `Found ${vocabularyViolations.length} vocabulary and ${structuralViolations.length} structural markers. Clean the repeated tells before export.`
  };
}

export function rewriteSlop(text: string) {
  let revised = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bseamless\b/gi, "clean"],
    [/\brobust\b/gi, "strong"],
    [/\bleverage\b/gi, "use"],
    [/\butilize\b/gi, "use"],
    [/\bdelve into\b/gi, "look at"],
    [/\bcrucial\b/gi, "important"],
    [/\bvital\b/gi, "important"],
    [/\btransformative\b/gi, "life-changing"],
    [/\bnot just ([^,.!?;]+),? but ([^,.!?;]+)/gi, "$1, and also $2"],
    [/\bIn today's fast-paced world,?\s*/gi, ""],
    [/\bIt is important to note that\s*/gi, ""]
  ];
  for (const [pattern, replacement] of replacements) {
    revised = revised.replace(pattern, replacement);
  }
  return revised
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scanVocabulary(text: string): QualityViolation[] {
  const violations: QualityViolation[] = [];
  for (const term of tierOne) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      violations.push({
        severity: "critical",
        category: "vocabulary",
        label: term,
        excerpt: excerpt(text, match.index ?? 0)
      });
    }
  }
  for (const term of tierTwo) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      violations.push({
        severity: "moderate",
        category: "vocabulary",
        label: term,
        excerpt: excerpt(text, match.index ?? 0)
      });
    }
  }
  return violations;
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
