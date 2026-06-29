import type { Usage } from "../../shared/src";
import { aiProvider, rawChat } from "./openrouter";
import { evaluateQuality } from "./quality";

// Swarm sampling: fan out N variations over a fixed, prompt-cached prefix on a
// cheap model, then score / consensus-merge to find signal. (The limi/DeepSeek
// "~10 cents" idea + the transitive-learning swarm extraction.)

export interface SwarmVariant {
  label: string;
  system: string;
  user: string;
  temperature?: number;
}

export interface SwarmResult {
  label: string;
  content: string;
  usage?: Usage;
}

export function swarmModel(): string {
  return process.env.MODEL_SWARM ?? "google/gemini-3.1-flash-lite";
}

// Bounded-concurrency pool so a big swarm doesn't open N sockets at once.
async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runSwarm(variants: SwarmVariant[], model = swarmModel()): Promise<SwarmResult[]> {
  if (aiProvider() === "mock") {
    return variants.map((variant, index) => ({ label: variant.label, content: mockVariant(variant, index) }));
  }
  return pool(variants, 5, async (variant) => {
    const { content, usage } = await rawChat({
      model,
      system: variant.system,
      user: variant.user,
      temperature: variant.temperature
    });
    return { label: variant.label, content, usage };
  });
}

function mockVariant(variant: SwarmVariant, index: number): string {
  return [
    `# Variant ${variant.label}`,
    "",
    `(mock swarm output, temperature ${variant.temperature ?? "default"})`,
    "",
    variant.user.slice(0, 200 + index * 50),
    "",
    index % 2 === 0
      ? "Short punch."
      : "A longer, unwound sentence that carries one thought to a deliberate landing without padding."
  ].join("\n");
}

// Build N temperature-spread variants of one fixed prefix (for best-draft / sampling).
export function spreadVariants(system: string, user: string, n: number): SwarmVariant[] {
  const lo = 0.2;
  const hi = 0.95;
  return Array.from({ length: n }, (_, i) => ({
    label: `s${i + 1}`,
    system,
    user,
    temperature: n === 1 ? 0.7 : Number((lo + ((hi - lo) * i) / (n - 1)).toFixed(2))
  }));
}

export interface ScoredDraft extends SwarmResult {
  score: number;
  verdict: string;
}

// Rank drafts with the existing anti-slop scorer (works offline — rule-based).
export function scoreDrafts(results: SwarmResult[]): ScoredDraft[] {
  return results
    .map((result) => {
      const report = evaluateQuality(result.content);
      return { ...result, score: report.scores.total, verdict: report.verdict };
    })
    .sort((a, b) => b.score - a.score);
}

export type Confidence = "high" | "medium" | "emergent" | "low";

// Frequency consensus across runs (transitive-learning thresholds): 8+ high,
// 5–7 medium, 3–4 emergent. Used by concept extraction (E2).
export function consensusMerge(runs: string[][]): Array<{ value: string; count: number; confidence: Confidence }> {
  const counts = new Map<string, { value: string; count: number }>();
  for (const run of runs) {
    for (const raw of run) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const entry = counts.get(key) ?? { value: raw.trim(), count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .map((entry) => ({
      ...entry,
      confidence: (entry.count >= 8 ? "high" : entry.count >= 5 ? "medium" : entry.count >= 3 ? "emergent" : "low") as Confidence
    }))
    .sort((a, b) => b.count - a.count);
}

export function swarmCost(results: SwarmResult[]): number {
  return results.reduce((sum, result) => sum + (result.usage?.cost ?? 0), 0);
}
