// Layer 3 — the publish gate and the guarded revision pass.
//
// The 1–7 ladder decides whether a piece is postable, with the six ordered
// tie-breaks and the floor/ceiling table from the Content Grading V2 field kit.
// The 5×10 anti-slop rubric stays underneath as the sentence-hygiene sub-score:
// two scales measuring different things, both reported.
//
// Revision is targeted — it edits only adjudicated spans, using the improvement
// DIRECTION, and a revision that installs casual slop is rejected outright. De-
// slopped writing is not casual writing; it is deliberate writing.

import type { AdjudicationReport, PublishVerdict, VoiceProfile } from "../../shared/src";
import { aiProvider, modelFor, rawChat, systemPrompt } from "./openrouter";
import { evaluateQuality } from "./quality";
import { drivingFindings, segmentPiece } from "./adjudicate";
import { hasConcreteAnchor } from "../../shared/src";

/** Score at or above which a piece may enter the ready-to-post queue. */
export const READY_SCORE = 5;

const CONCLUSION_MARKERS =
  /\b(which means|so the|therefore|the point is|what this buys|the upshot|that is why|which is why|so stop|so start|do this)\b/i;

export interface SynthesisResult {
  claim: boolean;
  proof: boolean;
  compression: boolean;
  ceiling: number;
}

/**
 * The synthesis test (field kit §8), adapted from slides to prose.
 * Claim: does the piece assert something contradictable, or only name a subject?
 * Proof: does the body establish it?
 * Compression: does it reduce to a conclusion, or only accumulate?
 */
export function synthesisTest(text: string): SynthesisResult {
  const units = segmentPiece(text);
  const titles = units.filter((unit) => unit.position === "title" || unit.position === "heading");
  const bodies = units.filter((unit) => unit.position === "body" || unit.position === "list-item");
  const closings = units.filter((unit) => unit.position === "closing");

  // A title that names a subject is not a claim; one with a finite verb asserts.
  const FINITE_VERB = /\b(is|are|was|were|has|have|does|do|makes|made|costs?|beats?|kills?|breaks?|wins?|fails?|means|stops?|starts?|needs?|should|must|will|can)\b/i;
  const claim = titles.some((unit) => FINITE_VERB.test(unit.text)) || bodies.slice(0, 2).some((unit) => FINITE_VERB.test(unit.text) && hasConcreteAnchor(unit.text));

  const proof = bodies.filter((unit) => hasConcreteAnchor(unit.text)).length >= 2;

  const compression =
    [...bodies, ...closings].some((unit) => CONCLUSION_MARKERS.test(unit.text)) ||
    (titles.length >= 2 && closings.some((unit) => hasConcreteAnchor(unit.text)));

  // Field kit ceilings: subjects named with no conclusion caps 5; claims proved
  // but the piece adds rather than compresses caps 6; all three opens 7.
  let ceiling = 7;
  if (!claim) ceiling = 5;
  else if (!proof) ceiling = 5;
  else if (!compression) ceiling = 6;

  return { claim, proof, compression, ceiling };
}

/**
 * Place a piece on the 1–7 ladder, then apply floors, ceilings, and the ordered
 * tie-breaks. Every verdict carries the boundary that decided it — a bare number
 * is not a judgment.
 */
export function publishVerdict(input: {
  text: string;
  report: AdjudicationReport;
  readyScore?: number;
}): PublishVerdict {
  const { report, text } = input;
  const readyScore = input.readyScore ?? READY_SCORE;
  const hygiene = evaluateQuality(text).scores.total;
  const synthesis = synthesisTest(text);
  const share = report.flaggedShare;
  // v1.2: low-confidence signals are shown to the writer but never move the verdict.
  const driving = drivingFindings(report.findings);

  // A pattern recurring across three or more locations is a piece-wide defect.
  const byCode = new Map<string, number>();
  for (const finding of driving) {
    const key = finding.code ?? finding.mechanism;
    byCode.set(key, (byCode.get(key) ?? 0) + 1);
  }
  const recurring = [...byCode.entries()].find(([, count]) => count >= 3);

  // Canned openings and endings are the most damaging defects in a published
  // piece — they are the first and last thing a reader meets.
  const critical = driving.filter(
    (finding) => /^(title|closing)/.test(finding.location) || finding.location === "title"
  );

  let ceiling = synthesis.ceiling;
  let ceilingReason = synthesis.claim
    ? synthesis.proof
      ? synthesis.compression
        ? ""
        : "adds rather than compresses"
      : "claim is not established in the body"
    : "names a subject without asserting a claim";

  if (recurring) {
    ceiling = Math.min(ceiling, 4);
    ceilingReason = `"${recurring[0]}" recurs in ${recurring[1]} places`;
  }
  if (driving.length > 0) ceiling = Math.min(ceiling, 6); // any located defect blocks 7
  if (share > 0.5) ceiling = Math.min(ceiling, 3);
  if (share > 0.7) ceiling = Math.min(ceiling, 2);

  // Density placement, then the ceiling.
  let score: number;
  let tieBreak: string;
  if (share === 0) {
    score = 7;
    tieBreak = "6/7 — no located defect survived the gates";
  } else if (share <= 0.05) {
    score = 6;
    tieBreak = "5/6 — defects are isolated word choices a reader glides past";
  } else if (share <= 0.12) {
    score = 5;
    tieBreak = "4/5 — no defect forces a re-read";
  } else if (share <= 0.25) {
    score = 4;
    tieBreak = "3/4 — clarity defects are isolated rather than recurring";
  } else if (share <= 0.4) {
    score = 3;
    tieBreak = "3/4 — clarity defects recur across the piece";
  } else if (share <= 0.6) {
    score = 2;
    tieBreak = "2/3 — several passages need effort to paraphrase";
  } else {
    score = 1;
    tieBreak = "1/2 — no working order; meaning fails repeatedly";
  }

  const capped = Math.min(score, ceiling);
  if (capped < score) tieBreak = `capped at ${capped}: ${ceilingReason}`;
  score = Math.max(1, capped);

  const ready = score >= readyScore && critical.length === 0;
  const reason = ready
    ? `Scored ${score}/7 with ${driving.length} located defect${driving.length === 1 ? "" : "s"}; ${tieBreak}.`
    : critical.length > 0 && score >= readyScore
      ? `Blocked: ${critical.length} defect${critical.length === 1 ? "" : "s"} on the opening or closing surface, where a reader meets the piece first and last.`
      : `Blocked at ${score}/7 (needs ${readyScore}); ${tieBreak}.`;

  return {
    score,
    hygiene,
    ready,
    reason,
    tieBreak,
    ceiling: ceilingReason || undefined,
    synthesis,
    criticalCount: critical.length
  };
}

export interface OvercorrectionHit {
  pattern: string;
  evidence: string;
}

/**
 * Guard on the reviser's own output. Removing formal slop by installing casual
 * slop moves the register and makes it worse.
 */
export function detectOvercorrection(text: string): OvercorrectionHit[] {
  const hits: OvercorrectionHit[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

  const staccato = sentences.filter((sentence) => sentence.split(/\s+/).length <= 3);
  if (staccato.length >= 3) {
    hits.push({ pattern: "staccato fragment abuse", evidence: staccato.slice(0, 3).join(" ") });
  }

  const bluntness = text.match(/^(look|here'?s the deal|here'?s the thing|real talk|let'?s be honest|no sugarcoating)\b[:,]?/im);
  if (bluntness) hits.push({ pattern: "performative bluntness", evidence: bluntness[0] });

  const casual = text.match(/\b(ngl|tbh|lowkey|chef'?s kiss|checks notes|it'?s giving|slaps)\b/i);
  if (casual) hits.push({ pattern: "costume casualness", evidence: casual[0] });

  const hotTake = text.match(/\b(unpopular opinion|hot take|everyone gets this wrong)\b/i);
  if (hotTake) hits.push({ pattern: "manufactured hot take", evidence: hotTake[0] });

  const oneWord = text.split(/\n{2,}/).filter((block) => block.trim().split(/\s+/).length === 1);
  if (oneWord.length >= 2) hits.push({ pattern: "one-word paragraph abuse", evidence: oneWord.slice(0, 2).join(" / ") });

  return hits;
}

export interface RevisionResult {
  text: string;
  changed: boolean;
  rejected?: OvercorrectionHit[];
  provider: "mock" | "openrouter";
  cost?: number;
}

/**
 * Targeted revision. Touches only the adjudicated spans, using each finding's
 * direction. Never rewrites wholesale, and never returns a revision that
 * introduced casual slop.
 */
export async function runAdjudicatedRevision(input: {
  text: string;
  report: AdjudicationReport;
  voice: VoiceProfile;
  promptBody?: string;
}): Promise<RevisionResult> {
  if (input.report.findings.length === 0) {
    return { text: input.text, changed: false, provider: "mock" };
  }
  if (aiProvider() === "mock") {
    return { text: input.text, changed: false, provider: "mock" };
  }

  const targets = input.report.findings
    .map((finding, i) => `${i + 1}. [${finding.location}] "${finding.quote}" — ${finding.mechanism}. Direction: ${finding.direction}`)
    .join("\n");

  const system = [
    systemPrompt(input.voice),
    "You are making a targeted edit, not a rewrite.",
    "Fix ONLY the listed spans, each in the direction given. Leave every other sentence exactly as it is.",
    "Do not remove formal slop by installing casual slop: no manufactured fragments, no 'Look,' or 'Real talk:', no slang pasted onto formal prose, no one-word paragraphs, no contrarian framing.",
    "Keep the author's voice, the argument, and the structure. Return the full revised piece and nothing else."
  ].join("\n\n");

  const user = [
    input.promptBody ?? "Revise the piece by fixing only the located defects below.",
    `Defects:\n${targets}`,
    `Piece:\n${input.text}`
  ].join("\n\n");

  const { content, usage } = await rawChat({ model: modelFor("refine"), system, user, temperature: 0.4 });
  const revised = content.trim();

  // Reject a revision that introduced overcorrection the original did not have.
  const before = detectOvercorrection(input.text).map((hit) => hit.pattern);
  const after = detectOvercorrection(revised);
  const introduced = after.filter((hit) => !before.includes(hit.pattern));
  if (introduced.length > 0) {
    return { text: input.text, changed: false, rejected: introduced, provider: "openrouter", cost: usage?.cost };
  }

  return { text: revised, changed: revised !== input.text, provider: "openrouter", cost: usage?.cost };
}
