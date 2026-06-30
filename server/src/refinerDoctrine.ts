import { createHash } from "node:crypto";
import type { RefineParams } from "../../shared/src";
import type { Repository } from "./repository";

// The article-refiner reference doctrine, embedded so it is portable and
// multi-tenant-safe (no runtime reads of ~/Downloads). It is seeded into each
// owner's Corpus as editable reference material, and the refine stage selects
// the relevant pieces per request (mirroring the skill's conditional loading).

const READER_PRINCIPLES = `# Reader Principles

Readers are active evaluators deciding, sentence by sentence, whether to continue. Three failure modes end that decision: they slow down and re-read (prose dense or poorly ordered), they misunderstand (ambiguous claim, missing transition, example that didn't land), or they give up (the piece stopped being worth the effort). Make every structural and prose decision against these three.

The writer/reader gap: writers draft in discovery sequence, building toward a conclusion they reached at the end. That helps the writer and confuses the reader, who doesn't share the discovery. Reader-first writing starts from the destination — the insight, the claim, the change — and works backward to build the path the reader needs. Diagnostic: does the opening assume the reader already cares? If yes, it is writer-organized. A reader-organized piece earns attention before asking for it.

Writing changes ideas, it doesn't convey them. The question is not "does this represent my thinking?" but "does this move the reader from where they are to where the piece wants them to go?" The writer's argument logic, evidence, and discovery order are rarely the reader's.

Value is not optional. Before refining prose, confirm the piece addresses something the target reader actually cares about; no polish saves a piece with no value to its reader.

The right reader is the first decision, not the last. Hold one person in mind, not a demographic. Reader experience over argument logic: place the reader inside the problem, let them feel the tension, resolve it in a way that changes something. Ask where the reader enters emotionally, where tension peaks, and whether resolution arrives before they've given up.

The function of a piece is to move the reader — in thinking, feeling, or action. Not to be comprehensive or demonstrate expertise. Final diagnostic: after the revised piece, what is different for the reader? If unclear, it is not done.`;

const PROSE_STANDARDS = `# Prose Standards

Self-check gate (run before every output): Does this answer the reader's actual question? Is it usable immediately? Did anything unnecessary survive — cut it. Is the structure clean enough to scan? Would I want to receive this? If any answer is no, fix before sending.

Vocabulary kill list — Tier 1 (replace immediately; three across one output = reject and rewrite): delve, utilize, leverage (non-financial), facilitate, elucidate, embark, endeavor, encompass, multifaceted, tapestry, testament to, paradigm, synergy, holistic, nuanced (as filler), realm (metaphorical), landscape (metaphorical), myriad, plethora. Tier 2 (suspicious in clusters — three in one paragraph means it's performing): robust, comprehensive, seamless, cutting-edge, innovative, streamline, empower, foster, enhance, elevate, optimize, scalable, pivotal, intricate, profound, resonate, underscore, harness, navigate (metaphorical), cultivate, bolster, cornerstone, game-changer, transformative. Tier 3 (delete on sight): "it's worth noting," "it's important to note," "importantly/notably/interestingly," "let's dive into/explore," "in conclusion," "furthermore/moreover/additionally," "in today's world," "at the end of the day," and "Not just X, but Y" (restructure — pick the stronger claim).

Structural patterns to eliminate: Topic Sentence Machine (every paragraph claim→elaboration→example→wrap-up; vary it, let some paragraphs end on the point, let one be a single sentence); Transition Word Chains (open with the subject, not "However/Furthermore"); Symmetry Addiction (let length follow content; real writing is lumpy); Hedge Parade (state it or don't); Not Just X But Y (pick the strongest claim); Wisdom Ending (end on image, action, or open question — don't explain the takeaway); Metaphor Explanation (trust the metaphor or rewrite it, never explain it); Em Dash Overload (max ~3 per 300 words).

Tone calibration — match tone to task, don't carry one register across everything: technical/analytical = precise and direct; creative/lyrical = vivid and sensory where earned; strategic = confident and grounded; personal/reflective = warm and human; operational = direct and action-first. The dominant register here is personal-reflective with analytical precision: warmth in the voice, sharpness in the claim, no unearned sentimentality.

Sentence rhythm: AI defaults to a uniform 15–25 word band. Mix short punches (one clause, sometimes one word), long unwinding sentences that follow a thought to its landing, and medium workhorse sentences. If every sentence sits in 15–25 words, cut one under 8 and extend one past 35. Vary paragraph length; a one-sentence paragraph draws the eye.

Endings fail when they restate the argument, tell the reader what to feel, moralize beyond what was earned, or introduce a new idea. They work when they land on a specific image the piece built toward, return to the opening with new weight, leave an open question, or end on a line short enough to echo. The last sentence should feel final without feeling closed.

Theological/philosophical references function as invisible scaffolding — the reader feels the weight without identifying the beam. Keep when load-bearing and the audience receives it; soften for mixed audiences (translate to the universal form without naming sources, preserving the shape: worth precedes output, identity precedes action); cut when the argument stands without it. Never use them as decoration.`;

const STRUCTURAL_ARCS = `# Structural Arcs

The arc is the shape of the reader's experience — the journey from first sentence to last. Before selecting, ask: what do I want the reader to feel at the end that they didn't feel at the beginning? The arc is the mechanism that produces that change. Movements should be felt, never announced (no section literally named "Chaos").

Arc 1 — Emptiness → Chaos → Order → Return (circular, Eastern). A still opening where something is absent or unnamed; the noise/problem enters; a realignment settles (not a solution); the opening image returns, seen differently. Best for reflective and personal essays on identity, work, meaning, creative practice. Pitfalls: the Return must land with new weight, not restate; Chaos must be specific; Emptiness must not be so abstract it loses the reader.

Arc 2 — Problem → Tension → Resolution (classical essay). State what's wrong early; show why it persists and what forces conflict; resolve with a reframe, lens, or better question. Best for analytical pieces and explainers. Pitfall: each section must earn the next — problems go academic, tensions become lists, resolutions become obvious.

Arc 3 — Descent → Reversal → Ascent (dramatic). The situation worsens and stakes rise; a single turning moment/realization; what becomes possible after, earned not triumphal. Best for personal narrative, case studies, creative nonfiction. Pitfall: the reversal must be earned or the ascent reads as false hope.

Arc 4 — Observation → Complication → Insight (essayist; Montaigne, Baldwin, Didion). Something noticed (a perception, not a claim); it turns out more complex than it looked; the complication reveals something smaller and sharper than expected. Best for personal essays and cultural criticism. Pitfall: the insight must genuinely surprise.

Arc-agnostic principles: the lead must earn the reader (the first paragraph is an audition — it starts, it doesn't warm up); every transition must pull (create a question or land an image), not push ("now I will discuss X"); the ending must not explain itself; length follows content — a short section whose thought is complete is precise, not thin.`;

const AUDIENCE_CREATIVES = `# Audience — Thinkers and Creatives Building an Audience

This reader is building something in public — a body of work, a newsletter, a reputation as a thinker. They are familiar with the performance of audience-building and quietly suspicious of it; they recognize content strategy when handed it and resent it. They read slowly and critically, comparing every piece to their own standard. They want to be met as a peer.

They want: recognition before resolution (name their experience accurately first — does this writer know what it feels like to be me?); ideas that complicate rather than confirm (the version with friction, revealing what the comfortable take leaves out); specificity over generality ("you post to prove you exist, not because the post is ready" lands; "building an audience is hard" lands nowhere); a voice, not a persona (edges — something it wouldn't say, something it has actually thought); something to carry out (a sentence, an image, a reframe that follows them into their own work).

Kills the piece: content-strategy structure (hook→problem→solution→CTA); generic affirmation ("your voice matters," "consistency is key"); over-explained metaphors (they'll find a good one); safe takes with no original angle; endings that wrap too neatly (they prefer productive uncertainty).

Tone: warm but not soft, rigorous without cold. Responds to first-person honesty (not confessional, not distant), short declaratives after long ones, and self-implication (the writer is inside the problem). Avoid cheerleading, prescriptive "you must," clinical distance, and the pose of having it figured out. Write as if the piece will be quoted — make the sentences worth quoting.`;

const AUDIENCE_PERFORMERS = `# Audience — High-Performers and Knowledge Workers

This reader's identity is entangled with output and results. They read efficiently and have no time for pieces that don't earn attention fast. They are also quietly exhausted — a restlessness they don't announce, a suspicion the next achievement won't feel like enough. They aren't looking for permission to slow down; they want a frame that makes their experience make sense.

They want: speed of recognition (the first paragraph must show it knows their actual life, not the idealized one); precision over poetry (argument, not atmosphere — get to the claim, extended metaphors lose them); a practical reframe they can apply immediately, not a feeling they'll forget; respect for their intelligence (don't cite what they know — say something they haven't heard stated this cleanly); honesty about the cost (acknowledge difficulty without sentimentalizing).

Kills the piece: slow openings and warm-up paragraphs; vague claims ("the way we work is broken" — broken how, for whom?); therapy-speak ("hold space for yourself"); no new angle; endings that are only inspirational (motivation without mechanism — give them something to do, even if it's a question to sit with).

Tone: direct, efficient, the voice of someone who has thought it through and isn't wasting time. Responds to short declaratives, concrete specifics ("one bad quarter away from insolvency"), systems language, and self-awareness in the writer. Avoid delaying narrative, emotional language before intellectual credibility, hedging where conviction belongs, and lists of advice. For both audiences at once: lead with the experiential recognition creatives need, deliver the conceptual frame performers need, and end with an open question or short image that serves both.`;

export const REFINER_DOCTRINE: Record<string, { title: string; body: string }> = {
  "reader-principles": { title: "Reader Principles", body: READER_PRINCIPLES },
  "prose-standards": { title: "Prose Standards", body: PROSE_STANDARDS },
  "structural-arcs": { title: "Structural Arcs", body: STRUCTURAL_ARCS },
  "audience-creatives": { title: "Audience — Creatives", body: AUDIENCE_CREATIVES },
  "audience-performers": { title: "Audience — High-Performers", body: AUDIENCE_PERFORMERS }
};

const SOURCE_PATH = "article-refiner";

// Select the relevant doctrine for a refine request, mirroring the skill's
// conditional loading. Overrides (the owner's edited Corpus copies) win over the
// built-in text. reader-principles + prose-standards always load.
export function selectDoctrine(params?: RefineParams, overrides: Record<string, string> = {}): string {
  const get = (name: string) => overrides[name] ?? REFINER_DOCTRINE[name]?.body ?? "";
  const picked = ["reader-principles", "prose-standards"];
  if (params?.arc && params.arc.trim() && params.arc !== "na") picked.push("structural-arcs");
  const reader = (params?.reader ?? "").toLowerCase();
  if (/creativ|thinker|writer|audience|substack|brand|artist/.test(reader)) picked.push("audience-creatives");
  if (/performer|executive|knowledge worker|operator|founder|leader|professional|high.?perform/.test(reader)) picked.push("audience-performers");
  return picked
    .map((name) => get(name))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// Seed the doctrine into the current owner's Corpus once (idempotent), so it is
// visible and editable in the Corpus tab.
export async function ensureRefinerDoctrine(repo: Repository) {
  if ((await repo.listCorpusSources()).some((source) => source.path === SOURCE_PATH)) return;
  const all = Object.values(REFINER_DOCTRINE).map((entry) => entry.body).join("\n");
  const entries = Object.entries(REFINER_DOCTRINE);
  const source = await repo.upsertCorpusSource({
    path: SOURCE_PATH,
    name: "Article Refiner doctrine",
    checksum: createHash("sha256").update(all).digest("hex"),
    segmentCount: entries.length
  });
  for (const [name, entry] of entries) {
    const lineEnd = Math.max(1, entry.body.split("\n").length);
    await repo.upsertCorpusSegment(source.id, {
      sourcePath: `${SOURCE_PATH}/references/${name}.md`,
      title: entry.title,
      body: entry.body,
      type: "prompt-template",
      memoryRole: "reference-output",
      tags: ["article-refiner", "doctrine", name],
      lineStart: 1,
      lineEnd,
      confidence: 1,
      embeddingStatus: "not-configured",
      judgeReadiness: {
        voiceFidelity: true,
        antiSlop: true,
        theologicalRigor: false,
        structuralClarity: true,
        researchGrounding: true
      }
    });
  }
}

// Ensure the doctrine is in the Corpus, then return the relevant slice for this
// refine request — preferring the owner's edited Corpus copies over built-ins.
export async function refinerDoctrineFor(repo: Repository, params?: RefineParams): Promise<string> {
  await ensureRefinerDoctrine(repo);
  const overrides: Record<string, string> = {};
  for (const segment of await repo.listCorpusSegments()) {
    if (!segment.sourcePath.startsWith(`${SOURCE_PATH}/references/`)) continue;
    const name = segment.sourcePath.replace(`${SOURCE_PATH}/references/`, "").replace(/\.md$/, "");
    overrides[name] = segment.body;
  }
  return selectDoctrine(params, overrides);
}
