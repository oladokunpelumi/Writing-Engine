// Writing -> narrative story -> motion graphics: the Story stage, its words
// gate, and the content-studio piece folder.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MotionStorySchema, type VideoProject } from "../../shared/src";
import { openDatabase } from "../src/db";
import { Repository } from "../src/repository";
import { ownerContext } from "../src/context";
import {
  SETTLE_SECONDS,
  WORDS_PER_SECOND,
  applyMotionEdit,
  approvalBlocker,
  buildMotionPieceFolder,
  checkMotionWords,
  normalizeBeats,
  normalizeForTrace,
  readingSeconds,
  runMotionStory,
  toCardLines
} from "../src/motionStory";
import { buildExportPackage } from "../src/videoStudioV2";
import { MOTION_LOOKS, MOTION_LOOK_IDS, MOTION_TREATMENTS, DEFAULT_MOTION_LOOK } from "../../shared/src";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { suggestLook } from "../src/motionStory";

const savedKey = process.env.OPENROUTER_API_KEY;
beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = savedKey;
});

const PIECE = `# Manual approval costs Acme four days per invoice

You have watched an invoice sit in someone's inbox for a week. You know the vendor is waiting, and you know why.

At Acme, every invoice over $500 needs two managers to sign it. The second signature almost never changes anything.

In March, 412 invoices waited a combined 1,648 days, per the AP ledger. Only 3 were rejected at the second signature.

The finance team spends Friday afternoons chasing signatures instead of closing the books.

Which means one signature, not two, buys back three days per invoice.`;

const project = (overrides: Partial<VideoProject> = {}) =>
  ({ id: "p1", title: "Approvals", audience: "", sourceText: PIECE, sources: [], ...overrides }) as unknown as VideoProject;

describe("motion story — drafting", () => {
  it("tells a piece as timed beats with the hook at frame 0, using only the piece's sentences", async () => {
    const { story } = await runMotionStory({ text: PIECE, title: "Manual approval", targetSeconds: 30 });
    expect(() => MotionStorySchema.parse(story)).not.toThrow();
    expect(story.lane).toBe("kinetic-type");
    expect(story.soundMode).toBe("silent-first");
    expect(story.beats[0].role).toBe("hook");
    expect(story.beats[0].start).toBe(0);
    expect(story.beats.at(-1)?.role).toBe("payoff");
    expect(Math.abs(story.totalSeconds - 30)).toBeLessThanOrEqual(1);

    const piece = normalizeForTrace(PIECE);
    story.beats.forEach((beat, index) => {
      if (index > 0) expect(beat.start).toBe(story.beats[index - 1].end); // contiguous
      expect(beat.end - beat.start + 0.05).toBeGreaterThanOrEqual(readingSeconds(beat.lines)); // readable
      expect(piece).toContain(normalizeForTrace(beat.sourceQuote)); // traced
      expect(beat.narration).toBe(""); // text only, sound off
      expect(beat.onScreenText).toBe(beat.lines.join(" / ")); // still a valid ProductionScene
    });
    // The payoff gets the longest hold.
    const holds = story.beats.map((beat) => beat.end - beat.start);
    expect(holds.at(-1)).toBe(Math.max(...holds));
    expect(story.hookCandidates.length).toBeGreaterThan(1);
  });

  it("cuts a sentence into card lines without adding a word", () => {
    const sentence = "In March, 412 invoices waited a combined 1,648 days, per the AP ledger.";
    const lines = toCardLines(sentence);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(normalizeForTrace(sentence)).toContain(normalizeForTrace(lines.join(" ")).replace(/\.$/, ""));
  });

  it("repairs a messy model draft into a renderable story", () => {
    const beats = normalizeBeats(
      [
        { role: "turn", seconds: 1, lines: "Your inbox / is lying to you", transitionOut: "spin" },
        { role: "nonsense", seconds: 2, lines: ["Two signatures", "", "one decision"], emphasis: ["Two", "absent"] },
        { role: "payoff", seconds: 3, lines: ["Sign once."] }
      ],
      15
    );
    expect(beats[0].role).toBe("hook"); // beat 0 is always the hook
    expect(beats[0].lines).toEqual(["Your inbox", "is lying to you"]);
    expect(beats[0].transitionOut).toBe("cut"); // unknown seam falls back to a cut
    expect(beats[1].role).toBe("turn");
    expect(beats[1].lines).toEqual(["Two signatures", "one decision"]);
    expect(beats[1].emphasis).toEqual(["Two"]); // emphasis must be on screen
    expect(beats.at(-1)?.end).toBeCloseTo(15, 0);
    for (const beat of beats) expect(beat.end - beat.start + 0.05).toBeGreaterThanOrEqual(readingSeconds(beat.lines));
  });

  it("reads at 3 words a second after the card settles", () => {
    expect(readingSeconds(["one two three", "four five six"])).toBeCloseTo(SETTLE_SECONDS + 6 / WORDS_PER_SECOND, 5);
  });
});

describe("motion story — words gate", () => {
  it("passes a story built from the piece", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const gate = await checkMotionWords({ story, pieceText: PIECE });
    expect(gate.pass).toBe(true);
    expect(gate.beats.every((beat) => beat.readable && beat.traced)).toBe(true);
  });

  it("blocks invented figures, untraced lines, too-fast cards and a late hook", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const beats = story.beats.map((beat) => ({ ...beat }));
    beats[1] = { ...beats[1], lines: ["Acme loses $2 million", "a year to approvals"] }; // not in the piece
    beats[2] = { ...beats[2], sourceQuote: "Approvals are the silent killer of growth." }; // not in the piece
    beats[3] = { ...beats[3], end: beats[3].start + 0.6 }; // far too short to read
    const edited = applyMotionEdit(story, { beats });
    expect(edited.wordsGate).toBeUndefined();
    expect(edited.approved).toBe(false);

    const gate = await checkMotionWords({ story: edited, pieceText: PIECE });
    expect(gate.pass).toBe(false);
    const kinds = gate.issues.filter((issue) => issue.blocking).map((issue) => issue.kind);
    expect(kinds).toContain("invented-figure");
    expect(kinds).toContain("untraced-quote");
    expect(kinds).toContain("reading-time");
    const figure = gate.issues.find((issue) => issue.kind === "invented-figure");
    expect(figure?.message).toMatch(/\$2/);

    const late = await checkMotionWords({
      story: { ...edited, beats: edited.beats.map((beat, i) => (i === 0 ? { ...beat, role: "turn" as const } : beat)) },
      pieceText: PIECE
    });
    expect(late.issues.some((issue) => issue.kind === "hook-late" && issue.blocking)).toBe(true);
  });

  it("runs anti-slop v1.2 on every card in its own register", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 15 });
    const beats = story.beats.map((beat, i) =>
      i === story.beats.length - 1
        ? { ...beat, lines: ["Together, we can", "build the future."], sourceQuote: beat.sourceQuote }
        : beat
    );
    const gate = await checkMotionWords({ story: applyMotionEdit(story, { beats }), pieceText: PIECE });
    const slop = gate.findings.find((finding) => finding.location === beats.at(-1)?.sceneId);
    expect(slop?.primaryCode).toBe("F");
    expect(gate.issues.some((issue) => issue.kind === "slop")).toBe(true);
  });

  it("approves only a story whose current version passed the gate", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    expect(approvalBlocker(undefined)).toMatch(/Generate/);
    expect(approvalBlocker(story)).toMatch(/words check/);
    const gate = await checkMotionWords({ story, pieceText: PIECE });
    const checked = { ...story, wordsGate: gate };
    expect(approvalBlocker(checked)).toBeUndefined();
    // Re-saving identical beats is not a change; editing a line is.
    expect(approvalBlocker({ ...applyMotionEdit(checked, { beats: checked.beats }), wordsGate: gate })).toBeUndefined();
    const changed = checked.beats.map((beat, i) => (i === 1 ? { ...beat, lines: [...beat.lines.slice(0, -1)] } : beat));
    expect(approvalBlocker({ ...applyMotionEdit(checked, { beats: changed }), wordsGate: gate })).toMatch(/changed/);
    expect(approvalBlocker({ ...checked, wordsGate: { ...gate, pass: false } })).toMatch(/blocking/);
  });
});

describe("motion story — piece folder", () => {
  it("exports the content-studio layout with story.json and brief.md", async () => {
    const { story } = await runMotionStory({ text: PIECE, title: "Manual approval costs Acme four days per invoice", targetSeconds: 30 });
    const gate = await checkMotionWords({ story, pieceText: PIECE });
    const approved = { ...story, wordsGate: gate, approved: true, approvedAt: new Date().toISOString() };
    const { folderName, files } = buildMotionPieceFolder(project(), approved);

    expect(folderName).toBe("manual-approval-costs-acme-four-days-per-invoice");
    const paths = files.map((file) => file.path);
    for (const expected of ["story.json", "brief.md", "CLAUDE.md", "source/piece.md", "brand/.keep", "work/.keep", "video/.keep", "review/.keep", "deliver/.keep"]) {
      expect(paths).toContain(expected);
    }

    const text = (path: string) => String(files.find((file) => file.path === path)!.content);
    const contract = JSON.parse(text("story.json"));
    expect(contract.contract).toBe("co-create.motion-story/2");
    expect(MOTION_LOOK_IDS).toContain(contract.look);
    for (const beat of contract.beats) expect(MOTION_TREATMENTS).toContain(beat.treatment);
    // The folder carries its own builder.
    for (const kit of ["work/motion-kit/build.mjs", "work/motion-kit/runtime/kit.js", "work/motion-kit/looks.json", "work/motion-kit/assets/vendor/gsap.min.js"]) {
      expect(paths).toContain(kit);
    }
    expect(contract.canvas).toEqual({ width: 1080, height: 1920 });
    expect(contract.beats[0].startFrame).toBe(0);
    for (const beat of contract.beats) {
      expect(beat.startFrame).toBe(Math.round(beat.start * 30));
      expect(beat.endFrame).toBe(Math.round(beat.end * 30));
    }
    expect(contract.totalFrames).toBe(Math.round(approved.totalSeconds * 30));
    expect(contract.gate.pass).toBe(true);

    const brief = text("brief.md");
    expect(brief).toContain("## Look");
    expect(brief).toContain("[NEEDS AUDIENCE]");
    expect(brief).toContain(approved.beats[0].lines.join(" "));
    expect(brief).toContain("_<platform>_9x16_");
    expect(text("CLAUDE.md")).toContain("HYPERFRAMES_NO_TELEMETRY=1");
    expect(text("CLAUDE.md")).toContain("node work/motion-kit/build.mjs .");
  });

  it("shows the motion story in the V2 export package", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 15 });
    const pkg = buildExportPackage({
      ...project(),
      format: "explainer",
      primaryOutput: "4-8 min",
      privacyState: "private",
      treatments: [],
      adaptations: [],
      shots: [],
      storyboards: [],
      scriptVersions: [],
      motionStory: story
    } as unknown as VideoProject);
    expect(pkg.markdown).toContain("## Motion Story");
    expect(pkg.markdown).toContain(story.beats[0].lines.join(" / "));
  });

  it("persists the story on the project", async () => {
    const repo = new Repository(await openDatabase());
    await ownerContext.run("dana", async () => {
      const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
      const saved = await repo.saveVideoProject({ title: "Approvals", sourceText: PIECE, currentStage: "motion-story", motionStory: story });
      const loaded = await repo.getVideoProject(saved.id);
      expect(loaded?.currentStage).toBe("motion-story");
      expect(loaded?.motionStory?.beats.length).toBe(story.beats.length);
      // Other fields can be saved without dropping the story.
      const renamed = await repo.saveVideoProject({ id: saved.id, title: "Renamed" });
      expect(renamed.motionStory?.id).toBe(story.id);
    });
    const other = await ownerContext.run("erin", () => repo.listVideoProjects());
    expect(other).toHaveLength(0);
  });
});

describe("motion story — looks and treatments", () => {
  it("suggests a look from the piece's shape", () => {
    expect(suggestLook(PIECE)).toBe("riso-print"); // three or more figures
    const punchy = Array.from({ length: 8 }, (_, i) => `Short line number ${["one", "two", "three", "four", "five", "six", "seven", "eight"][i]} here.`).join(" ");
    expect(suggestLook(punchy)).toBe("night-signal");
    expect(suggestLook("A long, reflective sentence that wanders through an idea and takes its time getting anywhere at all, as essays do.")).toBe(DEFAULT_MOTION_LOOK);
  });

  it("drafts treatments: a figure counts, a negation strikes, the payoff holds still", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 45 });
    expect(story.look).toBe("riso-print");
    expect(story.beats.at(-1)?.treatment).toBe("still");
    const proof = story.beats.find((beat) => beat.role === "proof");
    expect(proof?.treatment).toBe("count");
  });

  it("keeps the approval when only the look or a treatment changes", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30 });
    const gate = await checkMotionWords({ story, pieceText: PIECE });
    const approved = { ...story, wordsGate: gate, approved: true };
    const restyled = applyMotionEdit(approved, {
      beats: approved.beats.map((beat, i) => (i === 1 ? { ...beat, treatment: "circle" as const } : beat)),
      look: "night-signal"
    });
    expect(restyled.look).toBe("night-signal");
    expect(restyled.approved).toBe(true);
    expect(approvalBlocker(restyled)).toBeUndefined();
    const reworded = applyMotionEdit(approved, { beats: approved.beats.map((beat, i) => (i === 1 ? { ...beat, lines: ["Changed"] } : beat)) });
    expect(reworded.approved).toBe(false);
  });

  it("notes treatments that cannot land, too many hits, and repeats", async () => {
    const { story } = await runMotionStory({ text: PIECE, targetSeconds: 30, look: "paper-ember" });
    const beats = story.beats.map((beat, i) => ({ ...beat, treatment: (i === 1 ? "stamp" : i < story.beats.length - 1 ? "slam" : "still") as never }));
    const gate = await checkMotionWords({ story: applyMotionEdit(story, { beats }), pieceText: PIECE });
    const notes = gate.issues.filter((issue) => issue.kind === "treatment");
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((issue) => !issue.blocking)).toBe(true);
    expect(notes.some((issue) => /slam or stamp/.test(issue.message))).toBe(true);
  });

  it("holds every look to its own contrast rules: accent 3:1, accent text and ink 4.5:1", () => {
    const lum = (hexColor: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const look of Object.values(MOTION_LOOKS)) {
      expect(ratio(look.palette.accent, look.palette.ground), `${look.id} accent`).toBeGreaterThanOrEqual(3);
      expect(ratio(look.palette.accentText, look.palette.ground), `${look.id} accentText`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(look.palette.ink, look.palette.ground), `${look.id} ink`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps motion-kit/looks.json in step with shared/src/motionLooks.ts", () => {
    const kit = JSON.parse(readFileSync(join(__dirname, "..", "..", "motion-kit", "looks.json"), "utf8"));
    expect(kit.looks).toEqual(JSON.parse(JSON.stringify(MOTION_LOOKS)));
    expect(kit.treatments).toEqual([...MOTION_TREATMENTS]);
  });

  it("builds a HyperFrames project from an exported folder, in every look", async () => {
    const { story } = await runMotionStory({ text: PIECE, title: "Approvals", targetSeconds: 30 });
    const gate = await checkMotionWords({ story, pieceText: PIECE });
    const { files } = buildMotionPieceFolder(project(), { ...story, wordsGate: gate, approved: true });
    const dir = mkdtempSync(join(tmpdir(), "motion-folder-"));
    for (const file of files) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), file.content);
    }
    for (const look of MOTION_LOOK_IDS) {
      execFileSync(process.execPath, [join(dir, "work", "motion-kit", "build.mjs"), dir, "--look", look, "--out", `video-${look}`]);
      const out = join(dir, `video-${look}`);
      expect(readdirSync(join(out, "compositions")).length).toBe(story.beats.length);
      const ledger = JSON.parse(readFileSync(join(out, "ledger.json"), "utf8"));
      expect(ledger.look).toBe(look);
      expect(ledger.seams.length).toBe(story.beats.length - 1);
      const cues = JSON.parse(readFileSync(join(out, "cues.json"), "utf8"));
      expect(cues.filter((cue: { type: string }) => cue.type === "scene_cut").length).toBe(story.beats.length - 1);
      const index = readFileSync(join(out, "index.html"), "utf8");
      expect(index).toContain(MOTION_LOOKS[look].palette.ground);
      // Copy is data: every on-screen word appears in a scene file.
      const scenes = readdirSync(join(out, "compositions")).map((f) => readFileSync(join(out, "compositions", f), "utf8")).join("\n");
      for (const beat of story.beats) for (const word of beat.lines.join(" ").split(/\s+/)) {
        const shown = MOTION_LOOKS[look].display.caps ? word.toUpperCase() : word;
        expect(scenes).toContain(shown.replace(/&/g, "&amp;"));
      }
    }
  });
});
