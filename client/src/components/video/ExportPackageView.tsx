import React from "react";
import { Download, Copy, FileText } from "lucide-react";
import type { VideoProject } from "../../../../shared/src";

interface ExportPackageViewProps {
  project: VideoProject;
  exportPkg: { markdown: string; json: any } | null;
  onBuildExport: () => Promise<void>;
}

export function ExportPackageView({
  project,
  exportPkg,
  onBuildExport
}: ExportPackageViewProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Export Production Package</h2>
          <p className="text-xs text-slate-500">
            Export copyable/downloadable Markdown and JSON production packages containing scripts, evidence notes, shot lists, and provider-neutral plus Veo/Flow prompts.
          </p>
        </div>

        <button
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all"
          onClick={onBuildExport}
        >
          <FileText className="h-4 w-4" /> Build Latest Export
        </button>
      </div>

      {exportPkg ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Markdown Export Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h4 className="font-bold text-sm text-slate-800">Markdown Production Package</h4>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                  onClick={() => copyToClipboard(exportPkg.markdown)}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                  onClick={() => downloadFile(exportPkg.markdown, `${project.title}.md`, "text/markdown")}
                >
                  <Download className="h-3.5 w-3.5" /> Download .md
                </button>
              </div>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700 min-h-96 focus:outline-none"
              readOnly
              value={exportPkg.markdown}
            />
          </div>

          {/* JSON Export Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h4 className="font-bold text-sm text-slate-800">Structured JSON Package</h4>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                  onClick={() => copyToClipboard(JSON.stringify(exportPkg.json, null, 2))}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                  onClick={() => downloadFile(JSON.stringify(exportPkg.json, null, 2), `${project.title}.json`, "application/json")}
                >
                  <Download className="h-3.5 w-3.5" /> Download .json
                </button>
              </div>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700 min-h-96 focus:outline-none"
              readOnly
              value={JSON.stringify(exportPkg.json, null, 2)}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
          Click "Build Latest Export" to assemble your Markdown and JSON packages.
        </div>
      )}
    </div>
  );
}
