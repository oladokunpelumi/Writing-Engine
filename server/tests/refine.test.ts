import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { refineDirectives, runRefine } from "../src/openrouter";
import { selectDoctrine } from "../src/refinerDoctrine";
import { DEFAULT_VOICE_PROFILE } from "../../shared/src";

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = previousKey;
});

describe("refineDirectives", () => {
  it("maps depth and theological params to instructions", () => {
    const lines = refineDirectives({ depth: "structural", theological: "soften", reader: "creatives" });
    expect(lines.join(" ")).toContain("structural rebuild");
    expect(lines.join(" ")).toContain("Soften");
    expect(lines.join(" ")).toContain("creatives");
  });

  it("defaults to matching the draft when no word target is given", () => {
    expect(refineDirectives({}).join(" ")).toContain("match the draft");
  });

  it("returns nothing for undefined params", () => {
    expect(refineDirectives()).toEqual([]);
  });
});

describe("selectDoctrine", () => {
  it("always includes reader principles + prose standards", () => {
    const text = selectDoctrine();
    expect(text).toContain("Reader Principles");
    expect(text).toContain("Prose Standards");
    expect(text).not.toContain("Structural Arcs");
  });

  it("adds arcs when an arc is set and the matching audience by reader", () => {
    const text = selectDoctrine({ arc: "Problem → Tension → Resolution", reader: "thinkers and creatives" });
    expect(text).toContain("Structural Arcs");
    expect(text).toContain("Creatives");
    expect(text).not.toContain("High-Performers");
  });

  it("prefers an owner's edited override over the built-in text", () => {
    const text = selectDoctrine({}, { "reader-principles": "MY EDITED PRINCIPLES" });
    expect(text).toContain("MY EDITED PRINCIPLES");
  });
});

describe("runRefine (mock)", () => {
  it("refines supplied text offline", async () => {
    const response = await runRefine("# A messy draft\n\nIt rambles.", DEFAULT_VOICE_PROFILE, { depth: "light" });
    expect(response.provider).toBe("mock");
    expect(response.content).toContain("A messy draft");
  });
});
