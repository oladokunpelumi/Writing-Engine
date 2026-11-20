import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ExternalLink, Trash2, ShieldCheck } from "lucide-react";
import type { VideoSource, VideoSourceRole } from "../../../../shared/src";
import { AuthenticatedImage } from "./AuthenticatedImage";

interface ExtractionReviewProps {
  sources: VideoSource[];
  onUpdateSourceRoles: (sourceId: string, roles: VideoSourceRole[]) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onVerifyLinks: () => Promise<void>;
}

export function ExtractionReview({
  sources,
  onUpdateSourceRoles,
  onDeleteSource,
  onVerifyLinks
}: ExtractionReviewProps) {
  const [verifying, setVerifying] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await onVerifyLinks();
    } finally {
      setVerifying(false);
    }
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
        No source documents ingested yet. Upload files or paste text above to review extraction.
      </div>
    );
  }

  return (
    <div className="grid gap-4 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h3 className="font-display text-base font-bold text-slate-800">
          Extracted Ingestion Review ({sources.length})
        </h3>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50 transition-colors"
          disabled={verifying}
          onClick={handleVerify}
        >
          <ShieldCheck className="h-4 w-4" /> {verifying ? "Verifying Links..." : "Verify Discovered Links (Opt-In)"}
        </button>
      </div>

      <div className="grid gap-4">
        {sources.map((src) => (
          <div key={src.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="font-bold text-sm text-slate-800">{src.filename}</span>
                <span className="ml-2 text-xs text-slate-400">({(src.sizeBytes / 1024).toFixed(1)} KB)</span>
                <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                  {src.extractionStatus}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Roles:</span>
                {(["evidence", "narrative", "visual", "reference"] as VideoSourceRole[]).map((r) => (
                  <label key={r} className="text-xs text-slate-700 inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={src.roles?.includes(r)}
                      onChange={(e) => {
                        const newRoles = e.target.checked
                          ? [...(src.roles || []), r]
                          : (src.roles || []).filter((x) => x !== r);
                        void onUpdateSourceRoles(src.id, newRoles);
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="capitalize">{r}</span>
                  </label>
                ))}
                <button
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Delete Source"
                  onClick={() => setConfirmDeleteId(src.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Warnings */}
            {src.warnings && src.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Warnings ({src.warnings.length}):
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {src.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Extracted Text Snippet */}
            <div className="mt-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Extracted Prose ({src.extractedText.length} chars):</span>
              <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {src.extractedText || "No text extracted."}
              </p>
            </div>

            {/* Embedded Screenshots & OCR Evidence */}
            {src.extractedImages && src.extractedImages.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Extracted Screenshots & OCR Evidence ({src.extractedImages.length}):
                </span>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {src.extractedImages.map((img) => (
                    <div key={img.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      {img.dataUrl && (
                        <AuthenticatedImage
                          src={img.dataUrl}
                          alt={img.name}
                          className="h-28 w-full object-cover rounded-md border border-slate-200 mb-2 bg-white"
                        />
                      )}
                      <div className="font-bold text-slate-800 truncate">{img.name}</div>
                      {img.ocrText && (
                        <div className="mt-1 text-[11px] text-slate-600 line-clamp-3 bg-white p-2 rounded border border-slate-200">
                          {img.ocrText}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discovered Hyperlinks */}
            {src.extractedLinks && src.extractedLinks.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Discovered Hyperlinks ({src.extractedLinks.length}):
                </span>
                <div className="mt-1 grid gap-1.5 text-xs">
                  {src.extractedLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 border border-slate-100">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            link.status === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {link.status}
                        </span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline truncate"
                        >
                          {link.title || link.url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {link.summary && <span className="text-[11px] text-slate-400 truncate max-w-xs">{link.summary}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Source Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h4 className="font-display text-base font-bold text-slate-900">Delete Source Document</h4>
            <p className="mt-2 text-xs text-slate-600">
              Are you sure you want to remove this source document and its extracted passage chunks?
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
                  await onDeleteSource(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
