import { describe, expect, it } from "vitest";
import { retrievePosts } from "../src/retrieval";
import type { Post } from "../../shared/src";

const post = (title: string, body: string, tags: string[] = []): Post => ({
  id: title,
  title,
  body,
  tags,
  status: "imported",
  wordCount: body.split(/\s+/).length,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

describe("lexical retrieval", () => {
  it("ranks topically relevant memory first", () => {
    const results = retrievePosts(
      [
        post("Attachment and identity", "attachment identity belonging anxiety", ["attachment"]),
        post("Publishing cadence", "calendar writing rhythm draft export", ["writing"])
      ],
      {
        topic: "attachment and identity",
        seed: "",
        anchor: "",
        observation: "belonging anxiety",
        tension: "",
        audience: "",
        format: "Essay",
        targetLength: "1200",
        rawNotes: "",
        mode: "new"
      },
      2
    );
    expect(results[0].post.title).toBe("Attachment and identity");
    expect(results[0].matchedTerms).toContain("attachment");
  });
});
