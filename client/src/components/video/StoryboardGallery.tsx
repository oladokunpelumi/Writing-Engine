import React, { useEffect, useState } from "react";
import { Image, Layers, Copy, Sparkles } from "lucide-react";
import type { VideoProject } from "../../../../shared/src";
import { AuthenticatedImage } from "./AuthenticatedImage";

interface StoryboardGalleryProps {
  project: VideoProject;
  onGenerateShots: (scriptKind: "master" | "adaptation", scriptId?: string) => Promise<void>;
  onGenerateStoryboards: (shotIndexes: number[]) => Promise<void>;
  onProceedToExport: () => Promise<void>;
  busy: string;
}

export function StoryboardGallery({
  project,
  onGenerateShots,
  onGenerateStoryboards,
  onProceedToExport,
  busy
}: StoryboardGalleryProps) {
  const [selectedShots, setSelectedShots] = useState<number[]>([]);
  const [scriptSource, setScriptSource] = useState("master");
  useEffect(() => {
    setSelectedShots(project.shots.slice(0, 3).map((shot) => shot.index));
  }, [project.shots.length]);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Shots & Private Keyframe Storyboards</h2>
          <p className="text-xs text-slate-500">
            Veo/Flow ready generation prompts and owner-scoped private keyframe image gallery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            value={scriptSource}
            onChange={(event) => setScriptSource(event.target.value)}
            aria-label="Shot-list source script"
          >
            <option value="master">Approved master script</option>
            {project.adaptations.map((adaptation) => (
              <option key={adaptation.id} value={`adaptation:${adaptation.id}`}>
                {adaptation.platform} · {adaptation.targetSeconds}s
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all"
            disabled={Boolean(busy)}
            onClick={() => {
              const [kind, id] = scriptSource.split(":");
              void onGenerateShots(kind === "adaptation" ? "adaptation" : "master", id);
            }}
          >
            <Sparkles className="h-4 w-4" /> {project.shots?.length ? "Regenerate Shot Prompts" : "Generate Shot Prompts"}
          </button>
          {project.shots.length > 0 && (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              disabled={Boolean(busy) || selectedShots.length === 0}
              onClick={() => onGenerateStoryboards(selectedShots)}
            >
              <Image className="h-4 w-4" /> Generate {selectedShots.length} Selected Frame{selectedShots.length === 1 ? "" : "s"}
            </button>
          )}
          <button
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all"
            onClick={onProceedToExport}
          >
            Proceed to Export →
          </button>
        </div>
      </div>

      {project.shots && project.shots.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          {project.shots.map((shot, i) => {
            const sb = project.storyboards?.find((s) => s.sceneId === `sc-${i + 1}`);
            return (
              <div key={i} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div>
                  <label className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <input
                      type="checkbox"
                      checked={selectedShots.includes(shot.index)}
                      onChange={(event) =>
                        setSelectedShots((current) =>
                          event.target.checked
                            ? [...new Set([...current, shot.index])]
                            : current.filter((index) => index !== shot.index)
                        )
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Select for keyframe generation
                  </label>
                  {sb?.keyframeUrl && (
                    <AuthenticatedImage
                      src={sb.keyframeUrl}
                      alt={`Keyframe Shot ${i + 1}`}
                      className="h-48 w-full object-cover rounded-xl border border-slate-200 mb-3 bg-slate-50"
                    />
                  )}
                  {sb?.status === "failed" && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                      {sb.error || "Keyframe generation failed. Select this shot and retry."}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-indigo-600 uppercase tracking-wider">
                      Shot {i + 1} (~{shot.durationSec}s)
                    </span>
                    <button
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 font-semibold"
                      onClick={() => copyToClipboard(shot.visualPrompt)}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Prompt
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-800">🗣 {shot.spokenLine}</p>
                  <p className="mt-2 text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {shot.visualPrompt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
          No shot list generated yet. Click "Generate Shot Prompts" above to build your Veo/Flow shot package.
        </div>
      )}
    </div>
  );
}
