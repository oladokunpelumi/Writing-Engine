import { describe, expect, it } from "vitest";
import { DEFAULT_WORKFLOW_RECIPE } from "../../shared/src";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";

describe("repository", () => {
  it("persists voice, posts, and schedule entries", () => {
    const repo = new Repository(openDatabase(":memory:"));
    const voice = repo.getVoice();
    const updatedVoice = repo.updateVoice({ ...voice, register: "Sharper, warmer, slower." });
    expect(updatedVoice.register).toBe("Sharper, warmer, slower.");

    const post = repo.createPost({
      title: "A test post",
      body: "Faith and writing need a patient structure.",
      status: "imported",
      tags: ["faith", "writing"]
    });
    expect(repo.listPosts()).toHaveLength(1);
    expect(post.wordCount).toBe(7);

    const schedule = repo.createSchedule({
      title: "Publish the test post",
      postId: post.id,
      targetDate: "2026-06-20",
      status: "ready",
      reminderChannel: "none",
      reminderSent: false,
      checklist: {
        finalCopied: false,
        imageSaved: false,
        seoReady: false,
        pastedToSubstack: false
      }
    });
    expect(schedule.status).toBe("ready");
    expect(repo.listSchedules()[0].title).toBe("Publish the test post");
  });

  it("persists corpus segments, brief seeds, and workflow recipes idempotently", () => {
    const repo = new Repository(openDatabase(":memory:"));
    const source = repo.upsertCorpusSource({
      path: "/tmp/Prompts & Writings.md",
      name: "Prompts & Writings.md",
      checksum: "abc123",
      segmentCount: 1
    });
    const segment = repo.upsertCorpusSegment(source.id, {
      sourcePath: source.path,
      title: "Competence and Pattern Notes",
      body: "Observe the room. Follow the pattern. Then improve the pattern.",
      type: "raw-note",
      memoryRole: "brief-seed",
      tags: ["systems"],
      lineStart: 10,
      lineEnd: 18,
      confidence: 0.9,
      embeddingStatus: "not-configured",
      judgeReadiness: {
        voiceFidelity: true,
        antiSlop: true,
        theologicalRigor: false,
        structuralClarity: false,
        researchGrounding: false
      }
    });
    const updated = repo.upsertCorpusSegment(source.id, { ...segment, body: "Observe. Align. Improve." });
    expect(repo.listCorpusSegments()).toHaveLength(1);
    expect(updated.id).toBe(segment.id);
    expect(updated.body).toBe("Observe. Align. Improve.");

    const seed = repo.upsertBriefSeed(
      {
        title: "Competence and Pattern Notes",
        topic: "competence",
        seed: "Observe the room",
        tension: "contrarianism versus alignment",
        rawNotes: "Observe the room. Follow the pattern. Then improve the pattern.",
        tags: ["systems"],
        sourceLineRange: `${source.path}:10-18`
      },
      segment.id
    );
    expect(repo.listBriefSeeds()).toHaveLength(1);
    expect(repo.briefFromSeed(seed.id)?.corpusSegmentId).toBe(segment.id);

    const workflow = repo.upsertWorkflowRecipe(DEFAULT_WORKFLOW_RECIPE);
    const sameWorkflow = repo.upsertWorkflowRecipe(DEFAULT_WORKFLOW_RECIPE);
    expect(workflow.id).toBe(sameWorkflow.id);
    expect(repo.listWorkflowRecipes()).toHaveLength(1);
  });
});
