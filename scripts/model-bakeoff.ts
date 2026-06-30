import { evaluateQuality } from "../server/src/quality";
import { rawChat } from "../server/src/openrouter";

const capUsd = Number(process.env.BAKEOFF_CAP_USD ?? 3);
const maxTokens = Number(process.env.BAKEOFF_MAX_OUTPUT_TOKENS ?? 700);
const models = (process.env.BAKEOFF_MODELS ?? [
  "z-ai/glm-5.2",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-3.1-flash-lite"
].join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const prompts = [
  {
    stage: "frame",
    user: "Frame a personal essay about a founder realizing their productivity system was hiding grief. Return a terse outline with a cold open."
  },
  {
    stage: "draft",
    user: "Draft 350 words in an intimate, precise voice from this seed: the tool became a mirror, not a machine."
  },
  {
    stage: "polish",
    user: "Tighten this line without making it generic: I kept asking the system to produce more because I did not want to feel the quiet."
  }
];

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log("No OPENROUTER_API_KEY found; bakeoff skipped before spend.");
    return;
  }

  let spend = 0;
  const rows: Array<Record<string, string | number | boolean | undefined>> = [];
  for (const model of models) {
    for (const prompt of prompts) {
      if (spend >= capUsd) throw new Error(`Bakeoff cap reached: $${spend.toFixed(4)} >= $${capUsd.toFixed(2)}`);
      const started = Date.now();
      try {
        const result = await rawChat({
          model,
          system: "You are Co-Create. Write with intimacy, clarity, and no generic SaaS phrasing.",
          user: prompt.user,
          maxTokens
        });
        const latencyMs = Date.now() - started;
        const cost = result.usage?.cost ?? 0;
        spend += cost;
        const quality = evaluateQuality(result.content);
        rows.push({
          model,
          stage: prompt.stage,
          latencyMs,
          cost: Number(cost.toFixed(6)),
          visible: result.content.trim().length > 0,
          verdict: quality.verdict,
          score: quality.scores.total
        });
      } catch (error) {
        rows.push({
          model,
          stage: prompt.stage,
          latencyMs: Date.now() - started,
          cost: 0,
          visible: false,
          verdict: error instanceof Error ? error.message.slice(0, 120) : "failed",
          score: 0
        });
      }
    }
  }

  console.table(rows);
  console.log(`Estimated spend: $${spend.toFixed(5)} / cap $${capUsd.toFixed(2)}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

