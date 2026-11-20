import React, { useEffect, useState } from "react";
import { FileUp, FileText, Sparkles, AlertCircle } from "lucide-react";
import type { VideoProject, VideoSourceRole } from "../../../../shared/src";

interface SourceIntakeProps {
  project: VideoProject;
  posts: Array<{ id: string; title: string; body: string }>;
  onFileUpload: (files: FileList | null, roles?: VideoSourceRole[]) => Promise<void>;
  onPasteText: (text: string, title?: string, roles?: VideoSourceRole[]) => Promise<void>;
  onImportLibraryPost: (postId: string, roles?: VideoSourceRole[]) => Promise<void>;
  onSaveDirections: (narrativeDirection: string, visualDirection: string) => Promise<void>;
  onGenerateTreatments: () => Promise<void>;
  busy: string;
}

export function SourceIntake({
  project,
  posts,
  onFileUpload,
  onPasteText,
  onImportLibraryPost,
  onSaveDirections,
  onGenerateTreatments,
  busy
}: SourceIntakeProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<VideoSourceRole[]>(["evidence"]);

  // Paste Text Form
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [narrativeDirection, setNarrativeDirection] = useState(project.creativeBrief?.narrativeDirection ?? "");
  const [visualDirection, setVisualDirection] = useState(project.creativeBrief?.visualDirection ?? "");

  useEffect(() => {
    setNarrativeDirection(project.creativeBrief?.narrativeDirection ?? "");
    setVisualDirection(project.creativeBrief?.visualDirection ?? "");
  }, [
    project.id,
    project.creativeBrief?.narrativeDirection,
    project.creativeBrief?.visualDirection
  ]);

  const toggleRole = (role: VideoSourceRole) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void onFileUpload(e.dataTransfer.files, selectedRoles);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Source Intake & Creative Direction</h2>
          <p className="text-xs text-slate-500">
            Ingest up to 10 source documents (.docx, .pdf, .md, .txt; max 25MB each, 100MB total). Deduplicated by SHA-256.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all"
          disabled={!project.sources?.length || Boolean(busy)}
          onClick={onGenerateTreatments}
        >
          <Sparkles className="h-4 w-4" /> Develop 3 Treatments →
        </button>
      </div>

      {/* Role Assignment Selector before upload */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Default Intake Role Assignment:</span>
        <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-700">
          {[
            { id: "evidence", label: "Source/Evidence", desc: "Factual reference data, research, claims" },
            { id: "narrative", label: "Narrative Direction", desc: "Creative brief, key messaging, script outline" },
            { id: "visual", label: "Visual Direction", desc: "Style guide, moodboard notes, aesthetic rules" },
            { id: "reference", label: "Creative Reference", desc: "Viral video transcript, benchmark content" }
          ].map((item) => (
            <label key={item.id} className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300">
              <input
                type="checkbox"
                checked={selectedRoles.includes(item.id as any)}
                onChange={() => toggleRole(item.id as any)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-bold text-slate-800">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Narrative direction (optional)</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            placeholder="Preferred hook, structure, point of view, acts, pacing, or key beats. Leave blank for three recommended options."
            value={narrativeDirection}
            onChange={(event) => setNarrativeDirection(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Visual direction (optional)</span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
            placeholder="Palette, camera language, references, typography, lighting, or visual constraints."
            value={visualDirection}
            onChange={(event) => setVisualDirection(event.target.value)}
          />
        </label>
        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-indigo-800">
            These fields can be used alone or alongside documents tagged Narrative and Visual.
          </p>
          <button
            className="rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
            onClick={() => onSaveDirections(narrativeDirection, visualDirection)}
          >
            Save Direction
          </button>
        </div>
      </div>

      {/* Active Drag & Drop Upload Zone */}
      <div
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragOver
            ? "border-indigo-500 bg-indigo-50/60 shadow-inner"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <FileUp className={`mx-auto h-10 w-10 transition-colors ${isDragOver ? "text-indigo-600" : "text-slate-400"}`} />
        <p className="mt-3 text-sm font-bold text-slate-800">
          {isDragOver ? "Drop files now to start extraction" : "Drag & Drop source files here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Supports DOCX (prose, links, screenshots), PDF (text/scanned OCR), Markdown, and TXT files.
        </p>
        <input
          type="file"
          multiple
          accept=".docx,.pdf,.md,.txt"
          className="mt-4 mx-auto block text-xs text-slate-500 cursor-pointer"
          onChange={(e) => onFileUpload(e.target.files, selectedRoles)}
        />
      </div>

      {/* Alternative Intake Options */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="font-bold text-xs uppercase text-slate-700 mb-2">Paste Text Source</h4>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs mb-2 focus:border-indigo-500 focus:outline-none"
            placeholder="Source title or label..."
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs min-h-24 focus:border-indigo-500 focus:outline-none"
            placeholder="Paste raw research notes, quotes, or creative direction..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <button
            className="mt-2 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            disabled={!pastedText.trim()}
            onClick={async () => {
              await onPasteText(pastedText, pastedTitle, selectedRoles);
              setPastedText("");
              setPastedTitle("");
            }}
          >
            Add Text Source
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="font-bold text-xs uppercase text-slate-700 mb-2">Import from Writing Library</h4>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs mb-3 focus:border-indigo-500 focus:outline-none"
            value={selectedPostId}
            onChange={(e) => setSelectedPostId(e.target.value)}
          >
            <option value="">Select a saved piece from Library...</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <button
            className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            disabled={!selectedPostId}
            onClick={async () => {
              await onImportLibraryPost(selectedPostId, selectedRoles);
              setSelectedPostId("");
            }}
          >
            Import Saved Piece
          </button>
        </div>
      </div>
    </div>
  );
}
