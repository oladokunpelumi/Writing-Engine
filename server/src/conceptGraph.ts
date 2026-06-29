import { aiProvider } from "./openrouter";
import { runSwarm, spreadVariants, type SwarmResult } from "./swarm";

// Concept knowledge-graph (transitive-learning core): swarm-extract concepts from
// each unit → frequency-merge → prerequisite DAG (max in-degree 4, acyclic) →
// topological reading order + gap analysis. Reuses the swarm harness.

export interface ConceptNode {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: string;
  prerequisites: string[];
  appearsInUnit: string;
  frequency: number;
  gate: string;
  confidence: "high" | "medium" | "emergent" | "low";
}

export interface ConceptEdge {
  source: string;
  target: string;
}

export interface ConceptGraph {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

export interface GraphUnit {
  title: string;
  text: string;
}

const EXTRACT_SYSTEM = [
  "You extract the distinct CONCEPTS taught or argued in the unit below.",
  "Output ONLY a JSON array — no prose. Each item:",
  '{ "name": short lowercase concept, "category": one-word kind, "description": one sentence, "difficulty": "foundational"|"core"|"advanced", "prerequisites": [concept names], "gate": "I can ..." competency }.',
  "Extract 8–20 concepts that are genuinely present. Prerequisites must be other concepts the reader needs first. Do not fabricate."
].join("\n");

const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type RawConcept = {
  name?: string;
  category?: string;
  description?: string;
  difficulty?: string;
  prerequisites?: string[];
  gate?: string;
};

function lenientArray(text: string): RawConcept[] {
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  const candidate = unfenced.match(/\[[\s\S]*\]/);
  if (!candidate) return [];
  try {
    const parsed = JSON.parse(candidate[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Deterministic offline extraction so the graph is demonstrable without a key.
function mockExtract(unit: GraphUnit, seed: number): RawConcept[] {
  const words = Array.from(new Set(unit.text.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? [])).slice(0, 6);
  const base: RawConcept[] = [
    { name: `${unit.title} core idea`, category: "theme", description: "The unit's central claim.", difficulty: "core", prerequisites: [], gate: "I can state the central claim" }
  ];
  words.slice(0, 3 + (seed % 2)).forEach((word, index) => {
    base.push({
      name: word,
      category: index === 0 ? "concept" : "supporting",
      description: `Idea of ${word}.`,
      difficulty: index === 0 ? "foundational" : "core",
      prerequisites: index === 0 ? [] : [`${unit.title} core idea`],
      gate: `I can explain ${word}`
    });
  });
  return base;
}

async function extractUnit(unit: GraphUnit, n: number): Promise<RawConcept[][]> {
  if (aiProvider() === "mock") {
    return Array.from({ length: n }, (_, seed) => mockExtract(unit, seed));
  }
  const results: SwarmResult[] = await runSwarm(spreadVariants(EXTRACT_SYSTEM, `Unit: ${unit.title}\n\n${unit.text.slice(0, 8000)}`, n));
  return results.map((result) => lenientArray(result.content));
}

function confidenceFor(count: number, runs: number): ConceptNode["confidence"] {
  const ratio = count / Math.max(1, runs);
  if (ratio >= 0.7) return "high";
  if (ratio >= 0.45) return "medium";
  if (ratio >= 0.2) return "emergent";
  return "low";
}

// Merge a unit's N runs into canonical concepts by name-frequency consensus.
function mergeUnit(runs: RawConcept[][], unitTitle: string): ConceptNode[] {
  const byName = new Map<string, { node: ConceptNode; prereqs: Set<string> }>();
  for (const run of runs) {
    for (const raw of run) {
      if (!raw?.name) continue;
      const id = slug(String(raw.name));
      if (!id) continue;
      const existing = byName.get(id);
      if (existing) {
        existing.node.frequency += 1;
        (raw.prerequisites ?? []).forEach((p) => existing.prereqs.add(slug(String(p))));
      } else {
        byName.set(id, {
          node: {
            id,
            name: String(raw.name).trim(),
            category: String(raw.category ?? "concept"),
            description: String(raw.description ?? ""),
            difficulty: String(raw.difficulty ?? "core"),
            prerequisites: [],
            appearsInUnit: unitTitle,
            frequency: 1,
            gate: String(raw.gate ?? `I can explain ${raw.name}`),
            confidence: "emergent"
          },
          prereqs: new Set((raw.prerequisites ?? []).map((p) => slug(String(p))))
        });
      }
    }
  }
  const runs_n = runs.length;
  return [...byName.values()]
    .filter((entry) => entry.node.frequency >= Math.max(2, Math.ceil(runs_n * 0.2))) // drop one-off noise
    .map((entry) => ({ ...entry.node, prerequisites: [...entry.prereqs].filter(Boolean), confidence: confidenceFor(entry.node.frequency, runs_n) }));
}

// Whether `from` can already reach `to` along prereq→dependent edges (cycle guard).
function reachable(adj: Map<string, Set<string>>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

// Build the DAG: edges prereq→dependent, max in-degree 4 (strongest prereqs kept),
// skipping any edge that would create a cycle.
export function buildGraph(nodes: ConceptNode[]): ConceptGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const candidates: Array<{ source: string; target: string; weight: number }> = [];
  for (const node of nodes) {
    for (const prereq of node.prerequisites) {
      const source = byId.get(prereq);
      if (source && source.id !== node.id) candidates.push({ source: source.id, target: node.id, weight: source.frequency });
    }
  }
  candidates.sort((a, b) => b.weight - a.weight);
  const edges: ConceptEdge[] = [];
  const indegree = new Map<string, number>();
  const adj = new Map<string, Set<string>>();
  const seenPair = new Set<string>();
  for (const c of candidates) {
    const pair = `${c.source}->${c.target}`;
    if (seenPair.has(pair)) continue;
    if ((indegree.get(c.target) ?? 0) >= 4) continue;
    if (reachable(adj, c.target, c.source)) continue; // would create a cycle
    edges.push({ source: c.source, target: c.target });
    seenPair.add(pair);
    indegree.set(c.target, (indegree.get(c.target) ?? 0) + 1);
    if (!adj.has(c.source)) adj.set(c.source, new Set());
    adj.get(c.source)!.add(c.target);
  }
  return { nodes, edges };
}

// Kahn's topological order — prerequisites before dependents (the reading sequence).
export function topoOrder(graph: ConceptGraph): ConceptNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  const out = new Map<string, string[]>();
  for (const edge of graph.edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    if (!out.has(edge.source)) out.set(edge.source, []);
    out.get(edge.source)!.push(edge.target);
  }
  const queue = graph.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const order: ConceptNode[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) order.push(node);
    for (const next of out.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  // Append any leftovers (shouldn't happen — graph is acyclic).
  for (const node of graph.nodes) if (!seen.has(node.id)) order.push(node);
  return order;
}

export interface GraphGaps {
  missingPrerequisites: string[];
  lowConfidence: ConceptNode[];
}

// Gaps = prerequisites referenced but not present as nodes (uncovered ground),
// plus emergent/low-confidence concepts worth firming up.
export function gaps(graph: ConceptGraph): GraphGaps {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const missing = new Set<string>();
  for (const node of graph.nodes) {
    for (const prereq of node.prerequisites) if (!ids.has(prereq)) missing.add(prereq);
  }
  return {
    missingPrerequisites: [...missing],
    lowConfidence: graph.nodes.filter((node) => node.confidence === "emergent" || node.confidence === "low")
  };
}

// Full extraction: per unit swarm-extract + merge, union across units, build DAG.
export async function extractGraph(units: GraphUnit[], n: number): Promise<ConceptGraph> {
  const merged = new Map<string, ConceptNode>();
  for (const unit of units) {
    const runs = await extractUnit(unit, n);
    for (const node of mergeUnit(runs, unit.title)) {
      const existing = merged.get(node.id);
      if (existing) {
        existing.frequency += node.frequency;
        existing.prerequisites = [...new Set([...existing.prerequisites, ...node.prerequisites])];
        if (node.confidence === "high") existing.confidence = "high";
      } else {
        merged.set(node.id, node);
      }
    }
  }
  return buildGraph([...merged.values()]);
}
