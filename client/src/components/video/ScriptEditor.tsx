import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown, Split, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import type { ProductionScript, ProductionScene, VideoProject } from "../../../../shared/src";

interface ScriptEditorProps {
  project: VideoProject;
  script: ProductionScript | null;
  onGenerateScript: () => Promise<void>;
  onUpdateScript: (scenes: ProductionScene[]) => Promise<void>;
  onRegenerateScene: (sceneIndex: number) => Promise<void>;
  onApproveScript: () => Promise<void>;
  onSaveVersion: () => Promise<void>;
  onRestoreVersion: (versionId: string) => Promise<void>;
  busy: string;
}

export function ScriptEditor({
  project,
  script,
  onGenerateScript,
  onUpdateScript,
  onRegenerateScene,
  onApproveScript,
  onSaveVersion,
  onRestoreVersion,
  busy
}: ScriptEditorProps) {
  const [localScenes, setLocalScenes] = useState<ProductionScene[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [selectedSourceLocator, setSelectedSourceLocator] = useState<string | null>(null);
  const autosaveTimerRef = useRef<any>(null);

  useEffect(() => {
    if (script?.scenes) {
      setLocalScenes(script.scenes);
    }
  }, [script]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    },
    []
  );

  const handleSceneChange = (index: number, updatedField: Partial<ProductionScene>) => {
    const updated = [...localScenes];
    updated[index] = { ...updated[index], ...updatedField };
    setLocalScenes(updated);
    setSaveStatus("unsaved");

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onUpdateScript(updated);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
  };

  const handleAddScene = (index: number) => {
    const newScene: ProductionScene = {
      sceneId: `sc-${Date.now()}`,
      index: index + 1,
      title: `Scene ${index + 2}`,
      timestampRange: "0:00 - 0:15",
      narration: "",
      visualAction: "",
      onScreenText: "",
      audioCue: "",
      evidenceReferences: [],
      generationPrompt: "",
      locked: false
    };
    const updated = [...localScenes];
    updated.splice(index + 1, 0, newScene);
    updated.forEach((s, idx) => (s.index = idx));
    setLocalScenes(updated);
    void onUpdateScript(updated);
  };

  const handleDeleteScene = (index: number) => {
    if (localScenes.length <= 1) return;
    const updated = localScenes.filter((_, idx) => idx !== index);
    updated.forEach((s, idx) => (s.index = idx));
    setLocalScenes(updated);
    void onUpdateScript(updated);
  };

  const handleMoveScene = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= localScenes.length) return;
    const updated = [...localScenes];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    updated.forEach((s, idx) => (s.index = idx));
    setLocalScenes(updated);
    void onUpdateScript(updated);
  };

  const handleSplitScene = (index: number) => {
    const current = localScenes[index];
    const midpoint = Math.floor(current.narration.length / 2);
    const sentenceBreaks = Array.from(current.narration.matchAll(/[.!?]\s+/g)).map((match) => (match.index ?? 0) + match[0].length);
    const splitAt =
      sentenceBreaks.sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0] ??
      current.narration.lastIndexOf(" ", midpoint);
    if (splitAt <= 0) return;
    const text1 = current.narration.slice(0, splitAt).trim();
    const text2 = current.narration.slice(splitAt).trim();

    const scene1 = { ...current, narration: text1 };
    const scene2 = {
      ...current,
      sceneId: `sc-split-${Date.now()}`,
      title: `${current.title} (Part 2)`,
      narration: text2,
      index: index + 1,
      locked: false
    };

    const updated = [...localScenes];
    updated.splice(index, 1, scene1, scene2);
    updated.forEach((s, idx) => (s.index = idx));
    setLocalScenes(updated);
    void onUpdateScript(updated);
  };

  if (!script) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
        <FileText className="mx-auto h-12 w-12 text-indigo-500 mb-3" />
        <h3 className="font-display text-lg font-bold text-slate-800">Master Script Not Generated</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          Generate the scene-by-scene script based on your approved treatment and visual bible.
        </p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-all"
          disabled={Boolean(busy)}
          onClick={onGenerateScript}
        >
          <RefreshCw className="h-4 w-4" /> Draft Master Script
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-slate-900">Master Script Workbench</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                saveStatus === "saved"
                  ? "bg-emerald-100 text-emerald-800"
                  : saveStatus === "saving"
                  ? "bg-amber-100 text-amber-800"
                  : saveStatus === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {saveStatus === "saved"
                ? "Draft Saved ✓"
                : saveStatus === "saving"
                  ? "Autosaving..."
                  : saveStatus === "error"
                    ? "Save failed — edit to retry"
                    : "Unsaved Changes"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Scene-based editor with 800ms autosave, scene locking, reordering, splitting, and inline evidence inspection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onSaveVersion}
          >
            Save Version
          </button>
          {project.scriptVersions.length > 1 && (
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) void onRestoreVersion(event.target.value);
                event.target.value = "";
              }}
              aria-label="Restore script version"
            >
              <option value="">Restore version…</option>
              {project.scriptVersions
                .slice()
                .reverse()
                .map((version) => (
                  <option key={version.versionId} value={version.versionId}>
                    v{version.versionNumber} · {new Date(version.createdAt).toLocaleString()}
                  </option>
                ))}
            </select>
          )}
          <button
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onGenerateScript}
          >
            <RefreshCw className="h-3.5 w-3.5 inline mr-1" /> Regenerate Script
          </button>
          <button
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all"
            onClick={onApproveScript}
          >
            Approve Master Script ✓
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {localScenes.map((scene, idx) => (
          <div
            key={scene.sceneId || idx}
            className={`rounded-2xl border p-5 transition-all ${
              scene.locked
                ? "border-amber-300 bg-amber-50/20 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-bold text-indigo-600">Scene {idx + 1}</span>
                <input
                  type="text"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800 w-44 focus:border-indigo-500 focus:outline-none"
                  value={scene.title}
                  onChange={(e) => handleSceneChange(idx, { title: e.target.value })}
                />
                <input
                  type="text"
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 w-24 text-center focus:border-indigo-500 focus:outline-none"
                  value={scene.timestampRange}
                  onChange={(e) => handleSceneChange(idx, { timestampRange: e.target.value })}
                />
              </div>

              {/* Scene Controls */}
              <div className="flex items-center gap-2">
                <button
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                    scene.locked
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={() => handleSceneChange(idx, { locked: !scene.locked })}
                >
                  {scene.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {scene.locked ? "Locked" : "Unlocked"}
                </button>

                {!scene.locked && (
                  <button
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    onClick={() => onRegenerateScene(idx)}
                  >
                    Regenerate Scene
                  </button>
                )}

                <button
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                  title="Move Up"
                  disabled={idx === 0}
                  onClick={() => handleMoveScene(idx, "up")}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                  title="Move Down"
                  disabled={idx === localScenes.length - 1}
                  onClick={() => handleMoveScene(idx, "down")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                  title="Split Scene"
                  onClick={() => handleSplitScene(idx)}
                >
                  <Split className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                  title="Add Scene Below"
                  onClick={() => handleAddScene(idx)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                  title="Delete Scene"
                  onClick={() => handleDeleteScene(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Narration / Dialogue</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-20 focus:border-indigo-500 focus:outline-none"
                  value={scene.narration}
                  onChange={(e) => handleSceneChange(idx, { narration: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Visual Action</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-20 focus:border-indigo-500 focus:outline-none"
                  value={scene.visualAction}
                  onChange={(e) => handleSceneChange(idx, { visualAction: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
              <div>
                <span className="font-bold text-slate-700">On-Screen Text:</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-xs mt-1 focus:border-indigo-500 focus:outline-none"
                  value={scene.onScreenText}
                  onChange={(e) => handleSceneChange(idx, { onScreenText: e.target.value })}
                />
              </div>
              <div>
                <span className="font-bold text-slate-700">Audio / Sound Cue:</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-xs mt-1 focus:border-indigo-500 focus:outline-none"
                  value={scene.audioCue}
                  onChange={(e) => handleSceneChange(idx, { audioCue: e.target.value })}
                />
              </div>
              <div>
                <span className="font-bold text-slate-700">Veo 3 Prompt:</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1 font-mono text-[11px] mt-1 focus:border-indigo-500 focus:outline-none"
                  value={scene.generationPrompt}
                  onChange={(e) => handleSceneChange(idx, { generationPrompt: e.target.value })}
                />
              </div>
            </div>

            {scene.evidenceReferences.length > 0 && (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900">Evidence references</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {scene.evidenceReferences.map((reference) => (
                    <button
                      key={reference}
                      className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-700 hover:border-sky-400"
                      onClick={() => setSelectedSourceLocator(reference)}
                    >
                      {reference}
                    </button>
                  ))}
                </div>
                {selectedSourceLocator && scene.evidenceReferences.includes(selectedSourceLocator) && (
                  <div className="mt-3 rounded-lg border border-sky-100 bg-white p-3 text-xs text-slate-700">
                    {(() => {
                      const source = project.sources.find(
                        (item) =>
                          item.id === selectedSourceLocator ||
                          item.extractedImages.some((image) => image.id === selectedSourceLocator)
                      );
                      if (!source) return `Evidence ID: ${selectedSourceLocator}`;
                      return `${source.filename}: ${source.extractedText.slice(0, 500) || "Image evidence"}`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
