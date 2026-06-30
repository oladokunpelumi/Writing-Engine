import type { GenerationResponse, GridContinuity, GridSignalBlock, PromptStage } from "../../shared/src";
import type { Repository } from "./repository";
import { runStage } from "./openrouter";
import { parseSignalBlocks, validateSignalBlocks } from "./signalblocks";
import { continuityFrom, continuityPrompt, extractLogEntry, parseLogEntries } from "./gridMemory";
import { refine } from "./agents";
import { DESIRE_DOCTRINE, HOOK_DOCTRINE } from "../../shared/src";

const isMock = () => !process.env.OPENROUTER_API_KEY;

function lenientJson<T>(text: string): T | undefined {
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    const match = unfenced.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return undefined;
    }
  }
}

// The Grid always writes in the Grid show's voice, regardless of which show is
// currently active in the UI.
async function gridVoice(repo: Repository) {
  const show = await repo.ensureGridShow();
  return (show.voiceId && (await repo.getVoiceById(show.voiceId))) || (await repo.getVoice());
}

async function run(repo: Repository, stage: Parameters<Repository["getActivePromptVersion"]>[0], input: string) {
  return runStage(stage, await gridVoice(repo), input, undefined, await repo.getActivePromptVersion(stage));
}

// ---- Stage 1: Signals ----
export interface GridSignalsResult {
  deepDive: string;
  macro: string;
  fintel: string;
  blocks: GridSignalBlock[];
  problems: string[];
  combined: string;
  responses: Array<{ stage: PromptStage; response: GenerationResponse }>;
}

export async function runGridSignals(
  repo: Repository,
  input: { deepDive?: string; macro?: string; fintelReport?: string }
): Promise<GridSignalsResult> {
  const responses: Array<{ stage: PromptStage; response: GenerationResponse }> = [];
  // A provided text is used verbatim (manual mode); otherwise the stage generates it.
  const deepResp = input.deepDive?.trim() ? undefined : await run(repo, "signals-deepdive", "Collect today's signals.");
  if (deepResp) responses.push({ stage: "signals-deepdive", response: deepResp });
  const macroResp = input.macro?.trim() ? undefined : await run(repo, "signals-macro", "Give today's macro briefing.");
  if (macroResp) responses.push({ stage: "signals-macro", response: macroResp });
  const deepDive = input.deepDive?.trim() || deepResp?.content || "";
  const macro = input.macro?.trim() || macroResp?.content || "";

  let fintel = "";
  if (input.fintelReport?.trim()) {
    const fintelResp = await run(repo, "fintel-bridge", input.fintelReport);
    responses.push({ stage: "fintel-bridge", response: fintelResp });
    fintel = fintelResp.content;
  }

  const combined = [deepDive, macro, fintel].filter(Boolean).join("\n\n---\n\n");
  const blocks = parseSignalBlocks(combined);
  const problems = blocks.length > 0 ? validateSignalBlocks(blocks) : [];
  return { deepDive, macro, fintel, blocks, problems, combined, responses };
}

// ---- Stage 2: Synthesis ----
export async function runGridSynthesis(repo: Repository, signals: string) {
  return run(repo, "synthesis", signals);
}

// ---- Gate 1: ReviewGate recommendation (continuity-aware) ----
export async function gridContinuity(repo: Repository): Promise<GridContinuity> {
  return continuityFrom(parseLogEntries(await repo.getGridStoryLog()));
}

export async function runGridReviewGate(repo: Repository, synthesis: string) {
  const continuity = await gridContinuity(repo);
  const input = `Synthesis:\n${synthesis}\n\nContinuity rules:\n${continuityPrompt(continuity)}`;
  const response = await run(repo, "reviewgate", input);
  return { response, continuity };
}

// ---- Stage 3: Story (memory-fed, with critic loop) ----
export interface GridStoryResult {
  content: string;
  usage?: GenerationResponse["usage"];
  rounds: number;
  problems: string[];
}

export async function runGridStory(repo: Repository, args: { reviewGate: string; signals: string }): Promise<GridStoryResult> {
  const continuity = await gridContinuity(repo);
  const bible = await repo.getGridBible();
  const recentLog = parseLogEntries(await repo.getGridStoryLog())
    .slice(-3)
    .map((entry) => entry.raw)
    .join("\n\n");
  const session = [
    HOOK_DOCTRINE,
    DESIRE_DOCTRINE,
    bible ? `## UNIVERSE BIBLE\n${bible.slice(0, 6000)}` : "",
    recentLog ? `## RECENT STORY LOG\n${recentLog}` : "",
    `## CONTINUITY\n${continuityPrompt(continuity)}`,
    `## REVIEW GATE\n${args.reviewGate}`,
    args.signals ? `## SIGNALS\n${args.signals}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  let lastUsage: GenerationResponse["usage"];
  const storyPv = await repo.getActivePromptVersion("story");
  const voice = await gridVoice(repo);

  const result = await refine({
    maxRounds: 3,
    generate: async (revise) => {
      const input = revise
        ? `${session}\n\n## PRIOR DRAFT (revise in place; do not regenerate)\n${revise.previous}\n\n## FIX THESE\n- ${revise.problems.join("\n- ")}`
        : session;
      const response = await runStage("story", voice, input, undefined, storyPv);
      lastUsage = response.usage;
      return response.content;
    },
    validate: async (draft) => validateStory(repo, draft)
  });

  return { content: result.text, usage: lastUsage, rounds: result.rounds, problems: result.problems };
}

// Critic gate: LLM verdict + structural checks. Skipped in mock mode (no key) so
// offline runs are single-pass; the refine loop is bounded regardless.
async function validateStory(repo: Repository, draft: string): Promise<string[]> {
  if (isMock()) return [];
  const response = await run(repo, "critic", draft);
  const verdict = lenientJson<{ pass?: boolean; violations?: string[] }>(response.content);
  const problems = verdict && verdict.pass === false ? verdict.violations ?? ["Critic flagged issues."] : [];
  return problems;
}

// ---- Gate 2 → Publish: append the StoryLog entry, return a Substack package ----
export async function gridPublish(repo: Repository, story: string) {
  const logEntry = extractLogEntry(story);
  if (logEntry) await repo.appendGridStoryLog(logEntry);
  const title = story.match(/^#\s+(.+)$/m)?.[1]?.trim() || story.match(/Title:\s*(.+)$/m)?.[1]?.trim() || "Untitled episode";
  return {
    title,
    appendedLog: Boolean(logEntry),
    logEntry: logEntry ?? "",
    substack: story
  };
}
