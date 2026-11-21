import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Film, RefreshCw, ShieldCheck, Type } from "lucide-react";
import type { MotionBeat, MotionLookId, MotionStory, MotionTransition, MotionTreatment, MotionVisual, VideoProject } from "../../../../shared/src";
import { DEFAULT_MOTION_LOOK, MOTION_LOOKS, MOTION_LOOK_IDS, MOTION_TREATMENTS, MOTION_TREATMENT_NOTES } from "../../../../shared/src";

// Kept in step with server/src/motionStory.ts.
const WORDS_PER_SECOND = 3;
const SETTLE_SECONDS = 0.6;
const TRANSITIONS: MotionTransition[] = ["cut", "hold", "zoom-through", "inverse-zoom", "cut-the-curve", "waterfall", "rack-focus"];
const LENGTHS = [15, 30, 45, 60] as const;
const ASPECTS = ["9:16", "1:1", "16:9"] as const;

const ROLE_STYLE: Record<MotionBeat["role"], string> = {
  hook: "bg-ember text-white",
  turn: "bg-slate-500 text-white",
  proof: "bg-tide text-white",
  payoff: "bg-dusk text-white",
  cta: "bg-ink text-white"
};

const wordCount = (lines: string[]) => lines.reduce((sum, line) => sum + line.trim().split(/\s+/).filter(Boolean).length, 0);
const readingSeconds = (lines: string[]) => Math.round((SETTLE_SECONDS + wordCount(lines) / WORDS_PER_SECOND) * 10) / 10;

interface MotionStoryStageProps {
  project: VideoProject;
  busy: string;
  onRegenerate: (targetSeconds: 15 | 30 | 45 | 60, aspect: "9:16" | "1:1" | "16:9") => Promise<void>;
  onSave: (beats: MotionBeat[], oneThing: string, look: MotionLookId) => Promise<void>;
  onCheck: () => Promise<void>;
  onApprove: () => Promise<void>;
  onDownload: () => Promise<void>;
  onPlanPictures: () => Promise<void>;
  onGeneratePictures: () => Promise<void>;
}

export function MotionStoryStage({ project, busy, onRegenerate, onSave, onCheck, onApprove, onDownload, onPlanPictures, onGeneratePictures }: MotionStoryStageProps) {
  const story: MotionStory | undefined = project.motionStory;
  const [beats, setBeats] = useState<MotionBeat[]>(story?.beats ?? []);
  const [oneThing, setOneThing] = useState(story?.oneThing ?? "");
  const [look, setLook] = useState<MotionLookId>(story?.look ?? DEFAULT_MOTION_LOOK);
  const [length, setLength] = useState<15 | 30 | 45 | 60>(nearestLength(story?.totalSeconds ?? 30));
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">(story?.aspect ?? "9:16");

  useEffect(() => {
    setBeats(story?.beats ?? []);
    setOneThing(story?.oneThing ?? "");
    setLook(story?.look ?? DEFAULT_MOTION_LOOK);
  }, [story?.id, story?.version, story?.updatedAt]);

  const dirty = useMemo(
    () =>
      JSON.stringify(beats) !== JSON.stringify(story?.beats ?? []) ||
      oneThing !== (story?.oneThing ?? "") ||
      look !== (story?.look ?? DEFAULT_MOTION_LOOK),
    [beats, oneThing, look, story]
  );
  const total = beats.length ? beats[beats.length - 1].end : 0;
  const gate = story?.wordsGate;
  // The server clears the gate on every saved edit, so a gate that exists belongs
  // to the saved story; unsaved local edits make it stale.
  const gateFresh = Boolean(gate) && !dirty;
  const issuesFor = (sceneId: string) => gate?.issues.filter((issue) => issue.sceneId === sceneId) ?? [];

  const editBeat = (index: number, patch: Partial<MotionBeat>) => {
    setBeats((current) => {
      const next = current.map((beat, i) => (i === index ? { ...beat, ...patch } : beat));
      // Keep the timeline contiguous as holds change.
      let clock = 0;
      return next.map((beat) => {
        const hold = Math.max(0.5, Math.round((beat.end - beat.start) * 10) / 10);
        const start = Math.round(clock * 10) / 10;
        clock += hold;
        return { ...beat, start, end: Math.round(clock * 10) / 10, onScreenText: beat.lines.join(" / ") };
      });
    });
  };

  const setHold = (index: number, hold: number) => {
    const beat = beats[index];
    editBeat(index, { end: beat.start + Math.max(0.5, hold) });
  };

  const useHook = (text: string) => {
    const words = text.trim().split(/\s+/);
    const perLine = Math.min(5, Math.max(2, Math.ceil(words.length / 3)));
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine).join(" "));
    editBeat(0, { lines: lines.slice(0, 3) });
  };

  if (!story) {
    return (
      <div className="grid gap-4">
        <StageHeader />
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <Type className="mx-auto text-indigo-600" size={36} />
          <p className="mt-2 text-sm text-slate-600">Tell this project's piece as a kinetic-type story: timed beats of on-screen words, read with the sound off.</p>
          <LengthAspect length={length} aspect={aspect} onLength={setLength} onAspect={setAspect} />
          <button
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => onRegenerate(length, aspect)}
          >
            Tell it as a story
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <StageHeader />

      <div className="rounded-xl border border-slate-200 p-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="badge">v{story.version}</span>
          <span>{story.aspect} · {total.toFixed(1)}s · {beats.length} beats · text only, sound off</span>
          <span>{story.provider === "openrouter" ? "drafted by the model" : "offline draft from the piece's own sentences"}</span>
          {story.approved ? <span className="badge bg-tide/10 text-tide">approved</span> : null}
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">The one thing</span>
          <input className="input" value={oneThing} onChange={(event) => setOneThing(event.target.value)} />
        </label>
        <Timeline beats={beats} total={total} />
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase text-slate-500">Look</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {MOTION_LOOK_IDS.map((id) => {
            const option = MOTION_LOOKS[id];
            const chosen = look === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLook(id)}
                className={`rounded-lg border p-3 text-left transition ${chosen ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-400"}`}
                aria-pressed={chosen}
              >
                <div
                  className="flex h-16 items-end justify-between rounded-md px-3 pb-2"
                  style={{ background: option.palette.ground, color: option.palette.ink, fontFamily: `"${option.display.family}", sans-serif` }}
                >
                  <span className="text-2xl font-bold leading-none" style={{ textTransform: option.display.caps ? "uppercase" : "none" }}>
                    Look <span style={{ color: option.palette.accentText }}>back</span>
                  </span>
                  <span className="mb-1 h-3 w-10 rounded-full" style={{ background: option.palette.accent }} />
                </div>
                <p className="mt-2 text-sm font-bold text-slate-800">{option.name}</p>
                <p className="text-xs text-slate-500">{option.bestFor}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">Music for this look: {MOTION_LOOKS[look].music.suggestion}. Changing the look or a treatment keeps the words check.</p>
      </div>

      <PicturesPanel story={story} busy={busy} dirty={dirty} onPlan={onPlanPictures} onGenerate={onGeneratePictures} />

      {story.hookCandidates.length > 1 ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Hook options (ranked by the Hook Lab scorer)</p>
          <div className="mt-2 grid gap-1.5">
            {story.hookCandidates.map((hook) => (
              <div className="flex items-center justify-between gap-3 text-sm" key={hook.text}>
                <span className="text-slate-700">
                  <span className="mr-2 text-xs font-bold text-slate-400">{hook.score}/10</span>
                  {hook.text}
                </span>
                <button className="btn text-xs" onClick={() => useHook(hook.text)}>Use</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {beats.map((beat, index) => {
          const hold = Math.round((beat.end - beat.start) * 10) / 10;
          const need = readingSeconds(beat.lines);
          const tooFast = hold + 0.05 < need;
          const beatIssues = gateFresh ? issuesFor(beat.sceneId) : [];
          return (
            <div className="rounded-xl border border-slate-200 p-4 grid gap-2" key={beat.sceneId}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${ROLE_STYLE[beat.role]}`}>{beat.title}</span>
                <span className="text-xs text-slate-500">{beat.start.toFixed(1)}–{beat.end.toFixed(1)}s</span>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  hold
                  <input
                    className="input w-20 py-1 text-xs"
                    type="number"
                    step={0.1}
                    min={0.5}
                    value={hold}
                    onChange={(event) => setHold(index, Number(event.target.value))}
                  />
                  s
                </label>
                <span className={`text-xs ${tooFast ? "font-bold text-ember" : "text-slate-400"}`}>
                  {wordCount(beat.lines)} words · needs {need}s{tooFast ? " — too fast to read" : ""}
                </span>
              </div>
              <textarea
                className="input min-h-[72px] font-display text-base"
                value={beat.lines.join("\n")}
                onChange={(event) => editBeat(index, { lines: event.target.value.split("\n") })}
              />
              <label className="grid gap-1 text-xs text-slate-500">
                Treatment
                <select
                  className="input w-auto py-1 text-xs"
                  value={beat.treatment ?? ""}
                  onChange={(event) => editBeat(index, { treatment: (event.target.value || undefined) as MotionTreatment | undefined })}
                >
                  <option value="">Look default ({MOTION_LOOKS[look].defaults[beat.role]})</option>
                  {MOTION_TREATMENTS.map((treatment) => <option key={treatment} value={treatment}>{treatment}</option>)}
                </select>
                <span className="text-[11px] text-slate-400">{MOTION_TREATMENT_NOTES[beat.treatment ?? MOTION_LOOKS[look].defaults[beat.role]]}</span>
              </label>
              <PictureRow beat={beat} onChange={(visual) => editBeat(index, { visual })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-slate-500">
                  Seam out
                  <select
                    className="input py-1 text-xs"
                    value={beat.transitionOut}
                    disabled={index === beats.length - 1}
                    onChange={(event) => editBeat(index, { transitionOut: event.target.value as MotionTransition })}
                  >
                    {TRANSITIONS.map((transition) => <option key={transition} value={transition}>{transition}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-slate-500">
                  Land on (comma-separated words)
                  <input
                    className="input py-1 text-xs"
                    value={beat.emphasis.join(", ")}
                    onChange={(event) => editBeat(index, { emphasis: event.target.value.split(",").map((word) => word.trim()).filter(Boolean) })}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs text-slate-500">
                Motion
                <input className="input py-1 text-xs" value={beat.visualAction} onChange={(event) => editBeat(index, { visualAction: event.target.value })} />
              </label>
              <p className="text-xs text-slate-500">
                From the piece: <span className="italic text-slate-700">&ldquo;{beat.sourceQuote || "no source sentence"}&rdquo;</span>
              </p>
              {beatIssues.map((issue, i) => (
                <p className={`text-xs ${issue.blocking ? "font-bold text-ember" : "text-dusk"}`} key={i}>
                  {issue.blocking ? "Blocks approval: " : "Note: "}
                  {issue.message}
                  {issue.direction ? <span className="block font-normal text-tide">→ {issue.direction}</span> : null}
                </p>
              ))}
            </div>
          );
        })}
      </div>

      {gate ? <GateSummary gate={gate} fresh={gateFresh} /> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        {dirty ? (
          <button
            className="btn btn-primary text-xs"
            disabled={Boolean(busy)}
            onClick={() => onSave(beats.map((beat) => ({ ...beat, lines: beat.lines.map((line) => line.trim()).filter(Boolean) })), oneThing, look)}
          >
            Save edits
          </button>
        ) : null}
        <button className="btn text-xs" disabled={Boolean(busy) || dirty} onClick={onCheck} title={dirty ? "Save your edits first" : ""}>
          <ShieldCheck size={14} className="mr-1 inline" /> Check the words
        </button>
        <button
          className="btn text-xs"
          disabled={Boolean(busy) || dirty || !gateFresh || !gate?.pass || story.approved}
          onClick={onApprove}
          title={!gateFresh ? "Run the words check on this version first" : !gate?.pass ? "Fix the blocking issues first" : ""}
        >
          <CheckCircle2 size={14} className="mr-1 inline" /> {story.approved ? "Approved" : "Approve story"}
        </button>
        <button className="btn text-xs" disabled={Boolean(busy) || !story.approved || dirty} onClick={onDownload}>
          <Download size={14} className="mr-1 inline" /> Download piece folder
        </button>
        <span className="ml-auto flex items-center gap-2">
          <LengthAspect length={length} aspect={aspect} onLength={setLength} onAspect={setAspect} compact />
          <button className="btn text-xs" disabled={Boolean(busy)} onClick={() => onRegenerate(length, aspect)}>
            <RefreshCw size={14} className="mr-1 inline" /> Retell
          </button>
        </span>
      </div>
      {story.approved ? (
        <p className="text-xs text-slate-500">
          The folder follows the content-studio layout (brief.md, story.json, CLAUDE.md, source/, brand/, video/, review/, deliver/). Unzip it and open Claude Code in it to build the reel in HyperFrames.
        </p>
      ) : null}
    </div>
  );
}

type PictureChoice = "none" | "plate" | "object" | "icon" | "video-shot";

function pictureChoice(beat: MotionBeat): PictureChoice {
  const v = beat.visual;
  if (!v) return "none";
  if (v.kind === "icon") return "icon";
  if (v.kind === "video-shot") return "video-shot";
  return v.placement === "object" ? "object" : "plate";
}

function PictureRow({ beat, onChange }: { beat: MotionBeat; onChange: (visual: MotionVisual | undefined) => void }) {
  const v = beat.visual;
  const choice = pictureChoice(beat);
  const setChoice = (next: PictureChoice) => {
    if (next === "none") return onChange(undefined);
    const base: MotionVisual = {
      kind: next === "icon" ? "icon" : next === "video-shot" ? "video-shot" : "still",
      placement: next === "object" ? "object" : next === "icon" ? "object" : "plate",
      subject: v?.subject ?? "",
      prompt: "",
      icon: next === "icon" ? v?.icon ?? "" : undefined,
      motion: v?.motion ?? "slow push in",
      seconds: v?.seconds ?? 5,
      status: next === "icon" ? "generated" : "planned",
      cost: 0
    };
    // Keep a generated still when only its placement changes.
    if (v && v.kind !== "icon" && next !== "icon" && v.imageId && (next === "video-shot" || v.placement === base.placement)) {
      onChange({ ...v, kind: base.kind, placement: base.placement });
    } else onChange(base);
  };
  return (
    <div className="rounded-lg bg-slate-50 p-2 grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold uppercase">Picture</span>
        <select className="input w-auto py-1 text-xs" value={choice} onChange={(event) => setChoice(event.target.value as PictureChoice)}>
          <option value="none">None (words only)</option>
          <option value="plate">Still behind the words</option>
          <option value="object">Object below the words</option>
          <option value="icon">Icon (Lucide)</option>
          <option value="video-shot">Hero video shot</option>
        </select>
        {v && v.kind !== "icon" ? <span className={v.status === "generated" ? "text-tide" : v.status === "failed" || v.status === "over-budget" ? "text-ember" : ""}>{v.status}</span> : null}
      </div>
      {v && v.kind === "icon" ? (
        <div className="flex items-center gap-2">
          <input className="input py-1 text-xs" placeholder="lucide icon name, e.g. weight" value={v.icon ?? ""} onChange={(event) => onChange({ ...v, icon: event.target.value.trim().toLowerCase(), subject: event.target.value })} />
          {v.icon ? <img src={`/api/icons/${encodeURIComponent(v.icon)}`} alt="" className="h-8 w-8" /> : null}
        </div>
      ) : null}
      {v && v.kind !== "icon" ? (
        <div className="flex items-start gap-2">
          <label className="grid flex-1 gap-1 text-xs text-slate-500">
            What to picture (no words in pictures)
            <input className="input py-1 text-xs" value={v.subject} onChange={(event) => onChange({ ...v, subject: event.target.value, status: v.imageId ? v.status : "planned" })} />
            {v.kind === "video-shot" ? (
              <input className="input py-1 text-xs" value={v.motion} onChange={(event) => onChange({ ...v, motion: event.target.value })} title="Camera move for the hero shot" />
            ) : null}
            {v.error ? <span className="text-ember">{v.error}</span> : null}
          </label>
          {v.imageId ? <img src={`/api/images/${v.imageId}`} alt="" className="h-28 rounded object-cover" style={{ aspectRatio: v.placement === "object" ? "1 / 1" : "9 / 16" }} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PicturesPanel({
  story,
  busy,
  dirty,
  onPlan,
  onGenerate
}: {
  story: MotionStory;
  busy: string;
  dirty: boolean;
  onPlan: () => Promise<void>;
  onGenerate: () => Promise<void>;
}) {
  const stills = story.beats.filter((beat) => beat.visual && beat.visual.kind !== "icon");
  const pending = stills.filter((beat) => beat.visual?.status !== "generated").length;
  const icons = story.beats.filter((beat) => beat.visual?.kind === "icon").length;
  const budget = story.visualBudgetUsd ?? 3;
  const spent = story.visualSpendUsd ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 p-4 grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-slate-500">Pictures</p>
        <span className="text-xs text-slate-500">${spent.toFixed(2)} of ${budget.toFixed(2)} cap</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-slate-100">
        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        {stills.length} picture{stills.length === 1 ? "" : "s"} planned ({pending} to generate), {icons} icon{icons === 1 ? "" : "s"}. Pictures carry no words; they are finished in the {MOTION_LOOKS[story.look ?? DEFAULT_MOTION_LOOK].name} style, and switching looks re-finishes them for free. Hero shots are made at build time from their still (needs HyperFrames Pro); without one, the still plays instead.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn text-xs" disabled={Boolean(busy) || dirty} onClick={onPlan} title={dirty ? "Save your edits first" : ""}>Plan pictures</button>
        <button className="btn btn-primary text-xs" disabled={Boolean(busy) || dirty || pending === 0} onClick={onGenerate} title={dirty ? "Save your edits first" : ""}>
          Generate {pending || ""} picture{pending === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

function StageHeader() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">
          <Film size={18} className="mr-1.5 inline text-indigo-600" /> Motion story
        </h2>
        <p className="text-xs text-slate-500">
          Writing → narrative → kinetic type. Every card traces to a sentence of the piece and must read in its hold time.
        </p>
      </div>
    </div>
  );
}

function Timeline({ beats, total }: { beats: MotionBeat[]; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-md border border-slate-200" aria-label="Beat timeline">
      {beats.map((beat) => (
        <div
          className={`flex items-center justify-center truncate border-r border-white/40 px-1 text-[10px] font-bold uppercase ${ROLE_STYLE[beat.role]}`}
          key={beat.sceneId}
          style={{ width: `${((beat.end - beat.start) / total) * 100}%` }}
          title={`${beat.title}: ${beat.start.toFixed(1)}–${beat.end.toFixed(1)}s`}
        >
          {beat.role}
        </div>
      ))}
    </div>
  );
}

function GateSummary({ gate, fresh }: { gate: NonNullable<MotionStory["wordsGate"]>; fresh: boolean }) {
  const blocking = gate.issues.filter((issue) => issue.blocking).length;
  return (
    <div className={`rounded-xl border p-4 text-sm ${gate.pass && fresh ? "border-tide/40 bg-tide/5" : "border-ember/40 bg-ember-wash"}`}>
      <p className="font-bold">
        {!fresh
          ? "The story changed since the last words check. Run it again."
          : gate.pass
            ? "Words check passed. Every card reads in its hold and traces to the piece."
            : `Words check: ${blocking} blocking issue${blocking === 1 ? "" : "s"}.`}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {gate.issues.length} note{gate.issues.length === 1 ? "" : "s"} · {gate.findings.length} anti-slop finding{gate.findings.length === 1 ? "" : "s"}
        {gate.provider === "openrouter" ? " · adjudicated" : " · scanner only"}
      </p>
    </div>
  );
}

function LengthAspect({
  length,
  aspect,
  onLength,
  onAspect,
  compact
}: {
  length: 15 | 30 | 45 | 60;
  aspect: "9:16" | "1:1" | "16:9";
  onLength: (value: 15 | 30 | 45 | 60) => void;
  onAspect: (value: "9:16" | "1:1" | "16:9") => void;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${compact ? "" : "mt-3"}`}>
      <select className="input w-auto py-1 text-xs" value={length} onChange={(event) => onLength(Number(event.target.value) as 15 | 30 | 45 | 60)}>
        {LENGTHS.map((value) => <option key={value} value={value}>{value}s</option>)}
      </select>
      <select className="input w-auto py-1 text-xs" value={aspect} onChange={(event) => onAspect(event.target.value as "9:16" | "1:1" | "16:9")}>
        {ASPECTS.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </span>
  );
}

function nearestLength(seconds: number): 15 | 30 | 45 | 60 {
  return LENGTHS.reduce((best, value) => (Math.abs(value - seconds) < Math.abs(best - seconds) ? value : best), 30 as 15 | 30 | 45 | 60);
}
