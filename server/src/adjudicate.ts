// Layer 2 — the hybrid adjudicator.
//
// The deterministic scanner is free and runs on everything; it produces
// CANDIDATES. The model then re-examines only those candidates through the six
// gates, which is where portability and register judgments actually live. A
// base-rate check runs last: if the flagged share runs hot, form-only flags are
// re-opened before anything is returned.
//
// Directions, never drafted copy. The improvement vocabulary names the move and
// the gain — "name the missing population", "keep the dropped qualifier" — so a
// finding tells the writer what to do without writing the sentence for them.

import type { AdjudicatedFinding, AdjudicationReport, ContentFormat, LocatedStrength, SurfacePosition } from "../../shared/src";
import { SLOP_CODE_BY_BUCKET, type SlopBucket } from "../../shared/src";
import { aiProvider, modelFor, parseJson, rawChat } from "./openrouter";
import { scanPhrase, type PhraseScan } from "./slopScan";

/** Form-only signals: v1.2's "mostly a style preference" — low confidence unless confirmed. */
const FORM_ONLY_CODES = new Set(["S1.4", "S1.5", "S1.7"]);

/** Surfaces a reader meets first or last, or that carry the claim. */
const MATERIAL_POSITIONS = new Set<SurfacePosition>(["title", "heading", "closing", "callout", "cta"]);

export interface PieceUnit {
  text: string;
  position: SurfacePosition;
  /** A location a human can actually find, e.g. "paragraph 3, sentence 2". */
  location: string;
}

/** Base-rate bands per format (adjudication module §6, adapted to prose). */
const BASE_RATE_BANDS: Partial<Record<ContentFormat, [number, number]>> = {
  essay: [0.05, 0.35],
  newsletter: [0.05, 0.35],
  linkedin: [0.05, 0.3],
  thread: [0.05, 0.3],
  "video-script": [0.05, 0.25],
  headline: [0.0, 0.5]
};

const BUCKET_DIRECTIONS: Record<number, string> = {
  1: "cut the formula and state the specific claim it is standing in for",
  2: "name the missing actor, figure, population, or date",
  3: "say it in fewer words, keeping every real qualification",
  4: "delete the framing and open on the point"
};

const BUCKET_EFFECTS: Record<number, string> = {
  1: "the reader hears cadence where a claim should be",
  2: "the reader cannot tell what changed or what supports it",
  3: "the reader pays for words that carry no extra meaning",
  4: "the reader waits while the piece clears its throat"
};

/**
 * Split a piece into located units. Markdown structure carries the position:
 * headings are titles, list items are list-items, quotes are callouts, the last
 * paragraph is the closing surface where canned endings concentrate.
 */
export function segmentPiece(text: string, format: ContentFormat = "essay"): PieceUnit[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const units: PieceUnit[] = [];
  let paragraphIndex = 0;

  blocks.forEach((block, blockIndex) => {
    const isLastBlock = blockIndex === blocks.length - 1;

    if (/^#{1,6}\s/.test(block)) {
      const level = (block.match(/^#+/) ?? ["#"])[0].length;
      units.push({
        text: block.replace(/^#{1,6}\s*/, "").trim(),
        position: level === 1 ? "title" : "heading",
        location: level === 1 ? "title" : `heading "${block.replace(/^#{1,6}\s*/, "").slice(0, 40)}"`
      });
      return;
    }

    if (/^>\s/.test(block)) {
      units.push({ text: block.replace(/^>\s*/gm, "").trim(), position: "callout", location: `callout (block ${blockIndex + 1})` });
      return;
    }

    if (/^([-*+]|\d+\.)\s/m.test(block)) {
      block.split(/\n/).forEach((line, i) => {
        const item = line.replace(/^\s*([-*+]|\d+\.)\s*/, "").trim();
        if (item) units.push({ text: item, position: "list-item", location: `list item ${i + 1} (block ${blockIndex + 1})` });
      });
      return;
    }

    paragraphIndex += 1;
    const sentences = block.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    sentences.forEach((sentence, i) => {
      const position: SurfacePosition = isLastBlock && format !== "headline" ? "closing" : "body";
      units.push({ text: sentence, position, location: `paragraph ${paragraphIndex}, sentence ${i + 1}` });
    });
  });

  return units;
}

interface Candidate {
  unit: PieceUnit;
  scan: PhraseScan;
}

/**
 * v1.2 confidence: high = mechanism visibly supported (a model-confirmed flag,
 * or a specific scanner mechanism — drill-pack precision on these is 100%);
 * medium = plausible, another reading reasonable; low = mostly style.
 */
function confidenceFor(scan: PhraseScan, source: "scanner" | "adjudicator"): AdjudicatedFinding["confidence"] {
  if (source === "adjudicator") return "high";
  if (scan.code && FORM_ONLY_CODES.has(scan.code)) return "low";
  return scan.evidenceTier === 0 ? "high" : "medium";
}

/**
 * v1.2 severity: major = support missing for a material claim, or meaning lost
 * where the reader meets the piece; moderate = reduces clarity or trust;
 * minor = local awkwardness, meaning still clear. Frequency raises it later.
 */
function severityFor(code: string | undefined, primaryCode: AdjudicatedFinding["primaryCode"], position: SurfacePosition): AdjudicatedFinding["severity"] {
  if (code === "S2.5") return "major"; // unnamed authority: a claim with its support missing
  if (primaryCode === "V") return MATERIAL_POSITIONS.has(position) ? "major" : "moderate";
  if (MATERIAL_POSITIONS.has(position)) return "moderate"; // canned or padded where the reader meets it
  return "minor";
}

function toFinding(candidate: Candidate, source: "scanner" | "adjudicator"): AdjudicatedFinding {
  const bucket = candidate.scan.bucket;
  const primaryCode = bucket ? SLOP_CODE_BY_BUCKET[bucket] : undefined;
  return {
    location: candidate.unit.location,
    quote: candidate.unit.text.slice(0, 160),
    bucket,
    code: candidate.scan.code,
    mechanism: candidate.scan.mechanism ?? "unnamed mechanism",
    effect: bucket ? BUCKET_EFFECTS[bucket] ?? "" : "",
    direction: bucket ? BUCKET_DIRECTIONS[bucket] ?? "" : "",
    gate: candidate.scan.signals[0],
    source,
    primaryCode,
    secondaryCodes: candidate.scan.secondaryCodes ?? [],
    severity: severityFor(candidate.scan.code, primaryCode, candidate.unit.position),
    confidence: confidenceFor(candidate.scan, source),
    frequency: "isolated"
  };
}

/**
 * v1.2 frequency: the same sub-pattern once, twice, or three+ times across the
 * piece. A repeated problem is at least moderate — recurrence is itself harm.
 */
function withFrequency(findings: AdjudicatedFinding[]): AdjudicatedFinding[] {
  // Keyed on code AND mechanism: S2.1 alone spans several distinct sub-patterns.
  const keyOf = (finding: AdjudicatedFinding) => `${finding.code ?? ""}|${finding.mechanism}`;
  const counts = new Map<string, number>();
  for (const finding of findings) counts.set(keyOf(finding), (counts.get(keyOf(finding)) ?? 0) + 1);
  return findings.map((finding) => {
    const count = counts.get(keyOf(finding)) ?? 1;
    const frequency: AdjudicatedFinding["frequency"] = count >= 3 ? "pervasive" : count === 2 ? "repeated" : "isolated";
    const severity = frequency !== "isolated" && finding.severity === "minor" ? "moderate" : finding.severity;
    return { ...finding, frequency, severity };
  });
}

/** Findings allowed to move the verdict. v1.2: low-confidence signals must not drive it. */
export function drivingFindings(findings: AdjudicatedFinding[]): AdjudicatedFinding[] {
  return findings.filter((finding) => finding.confidence !== "low");
}

/** Credit one located strength, at every score. (Field kit §10) */
function findStrength(units: PieceUnit[], flagged: Set<string>): LocatedStrength | undefined {
  const clean = units.filter((unit) => !flagged.has(unit.location) && unit.text.split(/\s+/).length > 4);
  const withAnchor = clean.find((unit) => /\d|[£$€%]/.test(unit.text)) ?? clean[0];
  if (!withAnchor) return undefined;
  return {
    location: withAnchor.location,
    quote: withAnchor.text.slice(0, 160),
    why: /\d|[£$€%]/.test(withAnchor.text)
      ? "states a figure the reader can check"
      : "makes a specific claim that could not be moved to another piece unedited"
  };
}

const ADJUDICATION_SYSTEM = [
  "You adjudicate whether a phrase is AI slop, using six gates in order. Stop at the first gate that decides.",
  "Gate 1 Information: does it carry a named actor, action, number, change, rule, condition, or distinction? Any one is content.",
  "Gate 2 Portability: could it be pasted into a piece on an unrelated subject without editing a word? If it ports, it is slop.",
  "Gate 3 Form: for any triad, colon, dash, contrast or parallel — delete one element. If only the cadence changes, the structure is decoration.",
  "Gate 4 Register: judge the phrase against what its POSITION normally carries. Fragments are correct in titles, labels and captions.",
  "Gate 5 Substitution: would a simpler word carry the same meaning to this audience? A shared term of art is not jargon.",
  "Tie-break: write the plainer version. If it says the same thing in fewer words, the original was slop. If it loses a qualification, party, condition, or degree, it was not.",
  "A genuine coin-flip resolves to NOT slop. The burden of proof sits on the flag; over-flagging costs the same as missing one.",
  "Buckets (anti-slop v1.2 codes): 1 = F formulaic/slogan-like, 2 = V vague/inflated/unsupported, 3 = W wordy/jargon-filled/indirect, 4 = R unnecessary framing/repetition/structure.",
  "When causes overlap, the primary is the ROOT cause in this order: V (meaning, actor, support or causal link missing) before W (meaning recoverable but buried) before F (meaning clear but canned) before R (point delayed or duplicated). A specific mechanism outranks a generic 'names nothing concrete' signal.",
  "A flagged word or punctuation mark alone is never a finding. A finding needs a mechanism and an effect on the reader.",
  "Never draft replacement copy. Give the DIRECTION a fix should take — name the missing population, keep the dropped qualifier, settle the ambiguity."
].join("\n");

interface AdjudicatedVerdict {
  location: string;
  verdict: "slop" | "not-slop";
  bucket?: number;
  code?: string;
  mechanism?: string;
  effect?: string;
  direction?: string;
  gate?: string;
}

/**
 * Adjudicate a whole piece. Deterministic scan first, model only on candidates,
 * base-rate check last.
 */
export async function adjudicatePiece(input: {
  text: string;
  format?: ContentFormat;
  promptBody?: string;
}): Promise<AdjudicationReport> {
  const format = input.format ?? "essay";
  const units = segmentPiece(input.text, format);
  const band = BASE_RATE_BANDS[format] ?? [0.05, 0.35];

  const candidates: Candidate[] = [];
  for (const unit of units) {
    const scan = scanPhrase({ phrase: unit.text, position: unit.position, format });
    if (scan.verdict === "slop") candidates.push({ unit, scan });
  }

  let findings: AdjudicatedFinding[] = candidates.map((candidate) => toFinding(candidate, "scanner"));
  let provider: "mock" | "openrouter" = "mock";
  let cost = 0;

  // The model leg: re-examine only the candidates, through the gates.
  if (candidates.length > 0 && aiProvider() === "openrouter") {
    try {
      const user = [
        input.promptBody ??
          'Adjudicate each candidate. Return ONLY strict JSON: an array of { location, verdict: "slop"|"not-slop", bucket, code, mechanism, effect, direction, gate }.',
        `Format: ${format}. Judge each phrase against its stated position.`,
        JSON.stringify(
          candidates.map((candidate) => ({
            location: candidate.unit.location,
            position: candidate.unit.position,
            phrase: candidate.unit.text,
            scannerHint: { bucket: candidate.scan.bucket, mechanism: candidate.scan.mechanism }
          })),
          null,
          2
        )
      ].join("\n\n");
      const { content, usage } = await rawChat({
        model: modelFor("adjudicate"),
        system: ADJUDICATION_SYSTEM,
        user,
        temperature: 0.2
      });
      const verdicts = parseJson<AdjudicatedVerdict[]>(content);
      const byLocation = new Map(verdicts.map((v) => [v.location, v]));
      findings = candidates
        .map((candidate) => {
          const verdict = byLocation.get(candidate.unit.location);
          if (!verdict) return toFinding(candidate, "scanner");
          if (verdict.verdict === "not-slop") return null; // the gates cleared it
          const base = toFinding(candidate, "adjudicator");
          const bucket = (verdict.bucket as SlopBucket | undefined) ?? (base.bucket as SlopBucket | undefined);
          const code = verdict.code ?? base.code;
          const primaryCode = bucket ? SLOP_CODE_BY_BUCKET[bucket] : base.primaryCode;
          return {
            ...base,
            bucket,
            code,
            primaryCode,
            secondaryCodes: base.secondaryCodes.filter((secondary) => secondary !== primaryCode),
            severity: severityFor(code, primaryCode, candidate.unit.position),
            mechanism: verdict.mechanism ?? base.mechanism,
            effect: verdict.effect ?? base.effect,
            direction: verdict.direction ?? base.direction,
            gate: verdict.gate ?? base.gate
          };
        })
        .filter((finding): finding is AdjudicatedFinding => finding !== null);
      provider = "openrouter";
      cost = usage?.cost ?? 0;
    } catch {
      // Adjudication is an enhancement, never a hard dependency — fall back to
      // the scanner's own candidates rather than failing the whole gate.
      findings = candidates.map((candidate) => toFinding(candidate, "scanner"));
    }
  }

  // Base-rate check. Over half the units flagged means form is being hunted.
  // Low-confidence signals are reported but never counted (v1.2).
  const shareOf = (list: AdjudicatedFinding[]) => (units.length ? drivingFindings(list).length / units.length : 0);
  let baseRateNote: string | undefined;
  let flaggedShare = units.length ? findings.length / units.length : 0;
  if (flaggedShare > Math.max(band[1], 0.5)) {
    const reopened = findings.filter((finding) => !(finding.code && FORM_ONLY_CODES.has(finding.code)));
    if (reopened.length !== findings.length) {
      baseRateNote = `flagged ${(flaggedShare * 100).toFixed(0)}% of units — re-opened ${
        findings.length - reopened.length
      } form-only flags per the base-rate check`;
      findings = reopened;
    }
  }
  findings = withFrequency(findings);
  flaggedShare = shareOf(findings);

  const flaggedLocations = new Set(drivingFindings(findings).map((finding) => finding.location));
  return {
    format,
    unitsScanned: units.length,
    candidates: candidates.length,
    findings,
    flaggedShare,
    baseRateBand: band,
    baseRateNote,
    strength: findStrength(units, flaggedLocations),
    provider,
    cost
  };
}
