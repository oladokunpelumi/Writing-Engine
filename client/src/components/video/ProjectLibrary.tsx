import React, { useState } from "react";
import { Plus, Copy, Trash2, Library, X } from "lucide-react";
import type { VideoProject, VideoFormat } from "../../../../shared/src";

interface ProjectLibraryProps {
  projects: VideoProject[];
  currentProject: VideoProject | null;
  onSelectProject: (project: VideoProject) => void;
  onCreateProject: (input: {
    title: string;
    format: VideoFormat;
    audience: string;
    objective: string;
    primaryOutput: "4-8 min" | "8-12 min" | "12-20 min";
    privacyState: "private" | "public";
    externalAiConsent: boolean;
  }) => Promise<void>;
  onDuplicateProject: (id: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ProjectLibrary({
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onClose
}: ProjectLibraryProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State with Neutral Placeholders
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<VideoFormat>("documentary");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [primaryOutput, setPrimaryOutput] = useState<"4-8 min" | "8-12 min" | "12-20 min">("8-12 min");
  const [privacyState, setPrivacyState] = useState<"private" | "public">("private");
  const [externalAiConsent, setExternalAiConsent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateProject({
      title: title.trim() || "Untitled Video Project",
      format,
      audience: audience.trim(),
      objective: objective.trim(),
      primaryOutput,
      privacyState,
      externalAiConsent
    });
    setShowNewModal(false);
    setTitle("");
    setAudience("");
    setObjective("");
    setExternalAiConsent(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Library className="h-5 w-5 text-indigo-600" />
          <h3 className="font-display text-lg font-bold text-slate-800">Project Library</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {projects.length} {projects.length === 1 ? "Project" : "Projects"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            onClick={() => setShowNewModal(true)}
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
          <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const isCurrent = currentProject?.id === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                isCurrent
                  ? "border-indigo-500 bg-indigo-50/50 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    {p.format}
                  </span>
                  <span className="text-[11px] text-slate-400">{p.primaryOutput}</span>
                </div>
                <h4 className="mt-2 font-display text-base font-bold text-slate-800 line-clamp-1">{p.title}</h4>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {p.objective || "No objective set."}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>{p.sources?.length || 0} Sources</span>
                  <span>•</span>
                  <span className="capitalize">Stage: {p.currentStage || "sources"}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                  onClick={() => onSelectProject(p)}
                >
                  {isCurrent ? "Active Workspace" : "Open Workspace"}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                    title="Duplicate Project"
                    onClick={() => onDuplicateProject(p.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                    title="Delete Project"
                    onClick={() => setConfirmDeleteId(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-800">Create Video Project</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowNewModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Project Title</span>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. AI & The Future of Journalism"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Format</span>
                  <select
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as VideoFormat)}
                  >
                    <option value="documentary">Documentary</option>
                    <option value="cinematic">Cinematic brand film</option>
                    <option value="explainer">Explainer</option>
                    <option value="faceless">Faceless</option>
                    <option value="interview">Interview</option>
                    <option value="educational">Educational</option>
                    <option value="ugc">UGC</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Primary Output Target</span>
                  <select
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                    value={primaryOutput}
                    onChange={(e) => setPrimaryOutput(e.target.value as any)}
                  >
                    <option value="4-8 min">4–8 min YouTube</option>
                    <option value="8-12 min">8–12 min YouTube (Default)</option>
                    <option value="12-20 min">12–20 min YouTube</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Target Audience</span>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Tech analysts, sports fans, general public"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Core Objective / Thesis</span>
                <textarea
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-16 focus:border-indigo-500 focus:outline-none"
                  placeholder="What is the key claim or viewer takeaway?"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </label>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                🔒 <strong>Private & Confidential:</strong> Projects default to <strong>Private</strong>. Extracted document evidence and OCR previews are kept strictly owner-isolated and binary uploads are deleted post-extraction.
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-[11px] text-indigo-900">
                <input
                  type="checkbox"
                  checked={externalAiConsent}
                  onChange={(event) => setExternalAiConsent(event.target.checked)}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong>External AI processing consent.</strong> Allow relevant extracted passages and selected downscaled previews
                  to be sent to the configured AI provider. Link verification remains a separate opt-in action.
                </span>
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Project Deletion */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h4 className="font-display text-base font-bold text-slate-900">Confirm Secure Deletion</h4>
            <p className="mt-2 text-xs text-slate-600">
              Are you sure you want to delete this project? This will permanently remove all source documents, extracted chunks, treatments, master script versions, and private storyboards.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                onClick={async () => {
                  await onDeleteProject(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
