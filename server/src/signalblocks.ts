import type { GridSignalBlock } from "../../shared/src";

// The signal block is The Grid's inter-stage lingua franca. Ported from
// grid/signalblocks.py: anchor on a DATE: line, read the six fields, validate.

const SECTORS = ["AI", "Energy", "Robotics", "Finance", "Trade", "Macro", "Adjacent"];
const FIELD = /^([A-Z]+):\s*(.*)$/;

function fieldValue(line: string, key: string): string | undefined {
  const match = line.trim().match(FIELD);
  if (!match || match[1] !== key) return undefined;
  return match[2].trim();
}

export function parseSignalBlocks(text: string): GridSignalBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: GridSignalBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const date = fieldValue(lines[i], "DATE");
    if (date === undefined) continue;
    const block: GridSignalBlock = { date, sector: "", signal: "", metric: "", implication: "", source: "" };
    // Read subsequent field lines until the block runs out.
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j].trim();
      if (line === "" || line === "---") continue;
      const sector = fieldValue(line, "SECTOR");
      const signal = fieldValue(line, "SIGNAL");
      const metric = fieldValue(line, "METRIC");
      const implication = fieldValue(line, "IMPLICATION");
      const source = fieldValue(line, "SOURCE");
      if (sector !== undefined) block.sector = stripBrackets(sector);
      else if (signal !== undefined) block.signal = stripBrackets(signal);
      else if (metric !== undefined) block.metric = stripBrackets(metric);
      else if (implication !== undefined) block.implication = stripBrackets(implication);
      else if (source !== undefined) block.source = stripBrackets(source);
      else if (fieldValue(line, "DATE") !== undefined) break; // next block
      else break; // non-field line ends the block
    }
    blocks.push(block);
  }
  return blocks;
}

function stripBrackets(value: string): string {
  return value.replace(/^\[/, "").replace(/\]$/, "").trim();
}

// Returns human-readable problems; empty array means valid.
export function validateSignalBlocks(blocks: GridSignalBlock[], minBlocks = 1): string[] {
  const problems: string[] = [];
  if (blocks.length < minBlocks) problems.push(`Expected at least ${minBlocks} signal block(s), found ${blocks.length}.`);
  blocks.forEach((block, index) => {
    const tag = `Block ${index + 1}`;
    for (const [key, value] of Object.entries(block)) {
      if (!value || /^\[.*\]$/.test(value)) problems.push(`${tag}: ${key} is empty or a placeholder.`);
    }
    if (block.sector && !SECTORS.includes(block.sector)) {
      problems.push(`${tag}: SECTOR "${block.sector}" is not one of ${SECTORS.join(", ")}.`);
    }
    if (block.metric && !/\d/.test(block.metric)) problems.push(`${tag}: METRIC must contain at least one number.`);
  });
  return problems;
}
