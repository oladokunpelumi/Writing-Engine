import React, { useState } from "react";
import { CheckCircle2, Sparkles, BookOpen, Layers } from "lucide-react";
import type { VideoTreatment, VisualBible } from "../../../../shared/src";

interface TreatmentComparisonProps {
  treatments: VideoTreatment[];
  selectedTreatmentId?: string;
  visualBible?: VisualBible;
  onSelectTreatment: (treatmentId: string) => Promise<void>;
  busy: string;
}

export function TreatmentComparison({
  treatments,
  selectedTreatmentId,
  visualBible,
  onSelectTreatment,
  busy
}: TreatmentComparisonProps) {
  if (!treatments || treatments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
        No treatments developed yet. Return to Sources and click "Develop 3 Treatments".
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Three Creative Treatments ({treatments.length})</h2>
          <p className="text-xs text-slate-500">
            Compare creative directions: Faithful (follows direction), Recommended (preselected structural improvement), and Bold (alternative approach).
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {treatments.map((t) => {
          const isSelected = selectedTreatmentId === t.id;
          const isRecommended = t.type === "recommended";

          return (
            <div
              key={t.id}
              className={`flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                      t.type === "faithful"
                        ? "bg-slate-100 text-slate-700"
                        : t.type === "recommended"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {t.type}
                  </span>
                  {isRecommended && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                      <Sparkles className="h-3.5 w-3.5" /> Preselected
                    </span>
                  )}
                </div>

                <h3 className="font-display text-lg font-bold text-slate-900">{t.title}</h3>
                <p className="mt-2 text-xs italic text-slate-600 leading-relaxed">{t.logline}</p>

                <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-100 text-xs text-slate-700">
                  <strong className="font-bold text-slate-900">Key Metaphor:</strong> {t.keyMetaphor}
                </div>

                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Act Structure:</span>
                  <ol className="mt-2 grid gap-2 text-xs text-slate-600 list-decimal pl-4">
                    {t.structure?.map((act, idx) => (
                      <li key={idx}>
                        <strong className="text-slate-900">{act.actTitle}:</strong> {act.description}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-4 text-xs text-slate-600">
                  <strong className="font-bold text-slate-800">Rationale:</strong> {t.rationale}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                  disabled={Boolean(busy)}
                  onClick={() => onSelectTreatment(t.id)}
                >
                  {isSelected ? "Approved & Selected ✓" : "Select & Approve Treatment"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Bible Preview */}
      {visualBible && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <h3 className="font-display text-base font-bold text-slate-900">Reusable Visual Bible</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <strong className="block text-slate-900 font-bold mb-1">Visual Style:</strong>
              <span className="text-slate-600">{visualBible.visualStyle}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <strong className="block text-slate-900 font-bold mb-1">Lighting:</strong>
              <span className="text-slate-600">{visualBible.lighting}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <strong className="block text-slate-900 font-bold mb-1">Camera Language:</strong>
              <span className="text-slate-600">{visualBible.cameraLanguage}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <strong className="block text-slate-900 font-bold mb-1">Audio Theme:</strong>
              <span className="text-slate-600">{visualBible.audioTheme}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
