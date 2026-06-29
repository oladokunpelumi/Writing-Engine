import type { GridContinuity } from "../../shared/src";

// Continuity memory for THE GRID, ported from grid/memory.py. The StoryLog is an
// append-only markdown record; parsing it yields the rotation state that keeps the
// serial coherent (next number, no repeated lead/emotion, rotated easter-egg method).

export interface GridLogEntry {
  number: number;
  title: string;
  emotion: string;
  character: string;
  easterMethod: string;
  easterTopic: string;
  raw: string;
}

export const KNOWN_EASTER_METHODS = ["Idle thought", "Background texture", "Dialogue aside", "Physical object"];

const ENTRY_START = /^[ \t]*#{0,3}[ \t]*Installment[ \t]+(\d+)[ \t]*[—\-–:][ \t]*"?(.*?)"?[ \t]*$/gm;

function field(block: string, label: string): string {
  const re = new RegExp(`^\\s*(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:\\s*(.+)$`, "im");
  const match = block.match(re);
  return match ? match[1].replace(/\*\*/g, "").trim() : "";
}

export function parseLogEntries(text: string | undefined): GridLogEntry[] {
  if (!text) return [];
  const starts: Array<{ index: number; number: number; title: string }> = [];
  for (const match of text.matchAll(ENTRY_START)) {
    starts.push({ index: match.index ?? 0, number: Number(match[1]), title: match[2].trim() });
  }
  const entries = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
    const raw = text.slice(start.index, end);
    const easterMethod =
      KNOWN_EASTER_METHODS.find((method) => new RegExp(method, "i").test(field(raw, "Crash Course Easter Egg") || raw)) || "";
    return {
      number: start.number,
      title: start.title,
      emotion: field(raw, "Primary emotion"),
      character: field(raw, "Core character"),
      easterMethod,
      easterTopic: field(raw, "Crash Course Easter Egg").split(/\.\s*Delivery/i)[0].trim(),
      raw
    };
  });
  return entries.sort((a, b) => a.number - b.number);
}

export function nextInstallmentNumber(entries: GridLogEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.number), 0) + 1;
}

export function blockedCharacters(entries: GridLogEntry[]): string[] {
  return entries.slice(-1).map((entry) => entry.character).filter(Boolean);
}

export function blockedEmotions(entries: GridLogEntry[]): string[] {
  return entries.slice(-2).map((entry) => entry.emotion).filter(Boolean);
}

export function recentEasterMethods(entries: GridLogEntry[]): string[] {
  return entries.slice(-2).map((entry) => entry.easterMethod).filter(Boolean);
}

export function nextEasterMethod(entries: GridLogEntry[]): string {
  const recent = recentEasterMethods(entries);
  return KNOWN_EASTER_METHODS.find((method) => !recent.includes(method)) ?? KNOWN_EASTER_METHODS[0];
}

export function usedEasterTopics(entries: GridLogEntry[], n = 4): string[] {
  return entries
    .slice(-n)
    .map((entry) => entry.easterTopic)
    .filter(Boolean);
}

export function continuityFrom(entries: GridLogEntry[]): GridContinuity {
  return {
    nextInstallment: nextInstallmentNumber(entries),
    blockedCharacters: blockedCharacters(entries),
    blockedEmotions: blockedEmotions(entries),
    recentEasterMethods: recentEasterMethods(entries),
    nextEasterMethod: nextEasterMethod(entries),
    usedEasterTopics: usedEasterTopics(entries)
  };
}

// Render the continuity rules as a prompt block for the ReviewGate / Story stages.
export function continuityPrompt(c: GridContinuity): string {
  return [
    `Next installment number: ${c.nextInstallment}`,
    c.blockedCharacters.length ? `Do NOT use these lead characters (used last): ${c.blockedCharacters.join(", ")}` : "No blocked characters yet.",
    c.blockedEmotions.length ? `Do NOT reuse these primary emotions (used recently): ${c.blockedEmotions.join(", ")}` : "No blocked emotions yet.",
    `Use this easter-egg delivery method: ${c.nextEasterMethod}`,
    c.usedEasterTopics.length ? `Avoid these recent easter-egg topics: ${c.usedEasterTopics.join(", ")}` : "No recent easter topics to avoid."
  ].join("\n");
}

// Pull the "Installment NNN — ..." block out of a finished story for the StoryLog.
export function extractLogEntry(story: string): string | undefined {
  const match = story.match(/(#{0,3}\s*Installment\s+\d+[\s\S]*?)(?:\n#{1,3}\s|\n*$)/);
  return match ? match[1].trim() : undefined;
}
