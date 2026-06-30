import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../src/auth";
import { buildPreviousInputsPreview } from "../src/importPipeline";

async function freshRepo() {
  return new Repository(await openDatabase());
}

describe("per-owner isolation", () => {
  it("keeps each owner's posts separate", async () => {
    const repo = await freshRepo();
    await ownerContext.run("alice", () => repo.createPost({ title: "Alice note", body: "alice body", status: "draft", tags: [] }));
    await ownerContext.run("bob", () => repo.createPost({ title: "Bob note", body: "bob body", status: "draft", tags: [] }));
    const alicePosts = await ownerContext.run("alice", () => repo.listPosts());
    const bobPosts = await ownerContext.run("bob", () => repo.listPosts());
    expect(alicePosts.map((p) => p.title)).toEqual(["Alice note"]);
    expect(bobPosts.map((p) => p.title)).toEqual(["Bob note"]);
  });

  it("gives each owner an independent active voice", async () => {
    const repo = await freshRepo();
    const aliceVoice = await ownerContext.run("alice", () => repo.getVoice());
    const bobVoice = await ownerContext.run("bob", () => repo.getVoice());
    expect(aliceVoice.id).not.toBe(bobVoice.id);
    await ownerContext.run("alice", async () => {
      const created = await repo.createVoice("Faith essays");
      await repo.setActiveVoice(created.id);
      expect((await repo.getVoice()).name).toBe("Faith essays");
    });
    // bob is unaffected
    expect(await ownerContext.run("bob", async () => (await repo.getVoice()).name)).toBe("Default");
  });
});

describe("auth", () => {
  it("hashes and verifies passwords", () => {
    const hash = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("signs and verifies JWTs and rejects tampering/expiry", () => {
    const token = signToken({ sub: "user-1", email: "a@b.com" });
    expect(verifyToken(token)?.sub).toBe("user-1");
    expect(verifyToken(token + "x")).toBeUndefined();
    const expired = signToken({ sub: "user-1", email: "a@b.com" }, 60, Date.now() - 120_000);
    expect(verifyToken(expired)).toBeUndefined();
  });
});

describe("ingestion from pasted content", () => {
  it("parses posts from provided text without local files", () => {
    const preview = buildPreviousInputsPreview({ posts: "**1. First**\n\nA body long enough to count as content here.\n", owner: "alice" });
    expect(preview.posts.length).toBeGreaterThan(0);
    expect(preview.posts[0].title).toContain("First");
  });
});
