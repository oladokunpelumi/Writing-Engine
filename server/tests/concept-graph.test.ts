import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildGraph, extractGraph, gaps, topoOrder, type ConceptNode } from "../src/conceptGraph";

const node = (id: string, prerequisites: string[], frequency = 5): ConceptNode => ({
  id,
  name: id,
  category: "concept",
  description: "",
  difficulty: "core",
  prerequisites,
  appearsInUnit: "u",
  frequency,
  gate: `I can ${id}`,
  confidence: "high"
});

describe("buildGraph", () => {
  it("caps in-degree at 4 and stays acyclic", () => {
    const nodes = [
      node("a", []),
      node("b", ["a"]),
      node("c", ["a", "b"]),
      node("d", ["a", "b", "c"]),
      node("e", ["a", "b", "c", "d"]),
      node("f", ["a", "b", "c", "d", "e"]) // 5 prereqs → must be capped to 4
    ];
    const graph = buildGraph(nodes);
    const indegree = new Map<string, number>();
    for (const edge of graph.edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    expect(Math.max(...indegree.values())).toBeLessThanOrEqual(4);
    // topo order is valid: every edge goes source-before-target
    const order = topoOrder(graph).map((n) => n.id);
    for (const edge of graph.edges) {
      expect(order.indexOf(edge.source)).toBeLessThan(order.indexOf(edge.target));
    }
  });

  it("skips edges that would create a cycle", () => {
    const nodes = [node("x", ["y"]), node("y", ["x"])]; // mutual prereqs
    const graph = buildGraph(nodes);
    expect(graph.edges.length).toBe(1); // only one direction kept
    const order = topoOrder(graph).map((n) => n.id);
    expect(order.length).toBe(2);
  });
});

describe("gaps", () => {
  it("flags prerequisites that are not nodes", () => {
    const graph = buildGraph([node("b", ["a", "missing-thing"])]);
    expect(gaps(graph).missingPrerequisites).toContain("missing-thing");
  });
});

describe("extractGraph (mock)", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = prev;
  });

  it("builds a DAG from units offline", async () => {
    const graph = await extractGraph(
      [{ title: "Recursion", text: "recursion calls itself with base cases and stacks frames repeatedly" }],
      6
    );
    expect(graph.nodes.length).toBeGreaterThan(0);
    const order = topoOrder(graph);
    expect(order.length).toBe(graph.nodes.length);
  });
});
