import { randomUUID } from "node:crypto";
import type { CitationFlag } from "../../shared/src";

const scriptureBooks =
  "(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Songs|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)";

const scripturePattern = new RegExp(`\\b(?:[1-3]\\s)?${scriptureBooks}\\s+\\d{1,3}:\\d{1,3}(?:-\\d{1,3})?\\b`, "gi");
const namedCitationPattern =
  /\b(?:Augustine|Aquinas|Calvin|Luther|Bonhoeffer|C\.?\s?S\.?\s?Lewis|Kierkegaard|Bowlby|Ainsworth|Tajfel|Turner|Girard)\b/g;

export function extractCitationFlags(text: string): CitationFlag[] {
  const flags: CitationFlag[] = [];
  for (const match of text.matchAll(scripturePattern)) {
    flags.push({
      id: randomUUID(),
      label: match[0],
      kind: "scripture",
      context: contextAround(text, match.index ?? 0)
    });
  }
  for (const match of text.matchAll(namedCitationPattern)) {
    flags.push({
      id: randomUUID(),
      label: match[0],
      kind: "named-citation",
      context: contextAround(text, match.index ?? 0)
    });
  }
  return dedupe(flags);
}

function contextAround(text: string, index: number) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + 120);
  return text.slice(start, end).trim();
}

function dedupe(flags: CitationFlag[]) {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${flag.kind}:${flag.label.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function guardrailPrompt() {
  return [
    "Source handling:",
    "- Paraphrase by default.",
    "- Keep any direct quote under 15 words.",
    "- Never reproduce song lyrics or long source passages.",
    "- Flag scripture and named citations for human confirmation instead of asserting them as verified.",
    "- Avoid banned terms and filler constructions."
  ].join("\n");
}
