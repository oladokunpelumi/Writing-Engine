import { describe, expect, it } from "vitest";
import { extractCitationFlags } from "../src/guardrails";

describe("guardrails", () => {
  it("flags scripture and named citations for confirmation", () => {
    const flags = extractCitationFlags("This recalls Ezekiel 36:26 and Augustine on desire.");
    expect(flags.map((flag) => flag.kind)).toContain("scripture");
    expect(flags.map((flag) => flag.kind)).toContain("named-citation");
  });
});
