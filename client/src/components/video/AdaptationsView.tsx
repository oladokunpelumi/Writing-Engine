import React, { useState } from "react";
import { Sparkles, Layers } from "lucide-react";
import type { VideoProject, VideoAdaptation } from "../../../../shared/src";

interface AdaptationsViewProps {
  project: VideoProject;
  onGenerateAdaptation: (platform: "tiktok" | "reels" | "shorts" | "youtube", targetSeconds: number) => Promise<void>;
  onProceedToShots: () => Promise<void>;
  busy: string;
}

export function AdaptationsView({
  project,
  onGenerateAdaptation,
  onProceedToShots,
  busy
}: AdaptationsViewProps) {
  const [platform, setPlatform] = useState<"tiktok" | "reels" | "shorts" | "youtube">("tiktok");
  const [targetSeconds, setTargetSeconds] = useState<number>(60);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Short-Form Adaptations</h2>
          <p className="text-xs text-slate-500">
            Adapt approved master script into platform-native 30s, 60s, or 90s cuts for TikTok, Instagram Reels, and YouTube Shorts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as any)}
          >
            <option value="tiktok">TikTok</option>
            <option value="reels">Instagram Reels</option>
            <option value="shorts">YouTube Shorts</option>
            <option value="youtube">YouTube Alternate Cut</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
            value={targetSeconds}
            onChange={(e) => setTargetSeconds(Number(e.target.value))}
          >
            <option value={30}>30 Seconds</option>
            <option value={60}>60 Seconds (Default)</option>
            <option value={90}>90 Seconds</option>
          </select>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => onGenerateAdaptation(platform, targetSeconds)}
          >
            <Sparkles className="h-4 w-4" /> Adapt Script
          </button>
        </div>
      </div>

      {project.adaptations && project.adaptations.length > 0 ? (
        <div className="grid gap-6">
          {project.adaptations.map((ad) => (
            <div key={ad.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-800">
                    {ad.platform}
                  </span>
                  <h3 className="font-display text-base font-bold text-slate-800">{ad.title || `${ad.platform} Cut`}</h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">{ad.targetSeconds}s Runtime</span>
              </div>

              <div className="grid gap-3">
                {ad.scenes?.map((sc, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>[{sc.timestampRange}] {sc.title}</span>
                    </div>
                    <p className="text-slate-700">🗣 {sc.narration}</p>
                    <p className="mt-1 text-slate-500 italic">Visual: {sc.visualAction}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all"
              onClick={onProceedToShots}
            >
              Proceed to Shots & Storyboards →
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
          <p>No adaptations created yet. Select a target platform and runtime above, or continue with the approved master.</p>
          <button
            className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            onClick={onProceedToShots}
          >
            Continue with Master Script →
          </button>
        </div>
      )}
    </div>
  );
}
