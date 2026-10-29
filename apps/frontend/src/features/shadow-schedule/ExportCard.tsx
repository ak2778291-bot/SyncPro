// Take the shadow schedule into P6 / MS Project.
//
// The two numbers shown before the download are the point of this panel, not
// decoration: what WILL be written (committed evidence) and what will NOT
// (claims still awaiting a ruling). A planner who downloads without seeing the
// second number would reasonably assume the file is complete. It isn't, and
// shouldn't be — an unadjudicated claim is not a fact — but that has to be said
// out loud rather than discovered.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Download, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  downloadShadowExport,
  getShadowExportPreview,
  type ShadowExportFormat,
  type ShadowExportPreview,
  type ShadowExportResult,
} from "@/shared/api/client";

type Props = { projectId: string; refreshKey?: number };

const FORMATS: Array<{
  id: ShadowExportFormat;
  label: string;
  hint: string;
  caveat?: string;
}> = [
  {
    id: "pmxml",
    label: "P6 XML",
    hint: "Primavera P6 · recommended",
  },
  {
    id: "xer",
    label: "P6 XER",
    hint: "Primavera P6 · native exchange",
    // This used to warn that XER could not carry progress on duration-percent
    // activities. That was a defect in the exporter, not a limit of the format:
    // P6 stores no percentage for those activities but derives one from the
    // duration fields, which the exporter now writes. Verified at the raw-column
    // level, so the warning is gone rather than softened.
    caveat:
      "Progress on duration-percent activities is written as remaining " +
      "duration, which is how P6 stores it. Anything that does not survive " +
      "the file is reported after download.",
  },
  {
    id: "mspdi",
    label: "MS Project XML",
    hint: "Microsoft Project",
  },
];

export default function ExportCard({ projectId, refreshKey }: Props) {
  const [preview, setPreview] = useState<ShadowExportPreview | null>(null);
  const [fmt, setFmt] = useState<ShadowExportFormat>("pmxml");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ShadowExportResult | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPreview(await getShadowExportPreview(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check export readiness.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setDone(await downloadShadowExport(projectId, fmt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const selected = FORMATS.find((f) => f.id === fmt);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-100 flex items-center gap-2">
            <FileDown className="w-3.5 h-3.5 text-gray-500" />
            Export to P6 / MS Project
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Your original schedule with the field-reported progress written onto it —
            open it beside your baseline to compare.
          </p>
        </div>
      </div>

      {preview && !preview.exportable ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-200/80">{preview.reason}</p>
        </div>
      ) : (
        <>
          {/* What will and will not be in the file. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] px-3 py-2.5">
              <p className="text-lg text-emerald-300 tabular-nums leading-none">
                {preview ? preview.activities_updated : "—"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">activities written</p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                from committed evidence
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] px-3 py-2.5">
              <p className="text-lg text-amber-300 tabular-nums leading-none">
                {preview ? preview.activities_withheld_pending_review : "—"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">withheld</p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                awaiting your review
              </p>
            </div>
          </div>

          {/* Which schedule the progress will be written onto. Shown before the
              download, not after: once a programme has been re-imported the file
              follows the revision, and a planner comparing the download against
              their baseline needs to know that is what happened. */}
          {preview?.source_file && (
            <p className="text-[10px] text-gray-500">
              Building on{" "}
              <span className="text-gray-400">{preview.source_file}</span>
              {preview.source_is_reimport
                ? " — your most recent re-import, so planned dates match what you see here."
                : " — your original upload. Re-import a revised programme and the export will follow it."}
            </p>
          )}

          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">Format</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFmt(f.id);
                    setDone(null);
                  }}
                  className={`text-xs rounded-lg border px-3 py-2 text-left transition ${
                    fmt === f.id
                      ? "border-blue-500/40 bg-blue-600/10 text-blue-200"
                      : "border-white/[0.06] text-gray-400 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="block">{f.label}</span>
                  <span className="block text-[10px] text-gray-600 mt-0.5">{f.hint}</span>
                </button>
              ))}
            </div>
            {selected?.caveat && (
              <p className="text-[10px] text-amber-200/70 mt-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {selected.caveat}
              </p>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {done && (
            <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2 space-y-1">
              <p className="text-[11px] text-emerald-200 flex items-center gap-1.5">
                <Check className="w-3 h-3" />
                Downloaded {done.filename}
              </p>
              <p className="text-[10px] text-emerald-200/70">
                {done.verifiedInFile ?? done.activitiesUpdated} value(s) verified present in
                the file
                {done.withheld ? `, ${done.withheld} withheld pending review` : ""}.
              </p>
              {done.sourceFile && (
                <p className="text-[10px] text-emerald-200/70">
                  Built on {done.sourceFile}.
                </p>
              )}
              {/* Shown, not hidden behind a tooltip: this is the number that lets
                  someone prove the file they hold is the file we produced, and it
                  is recorded against this download in the audit log. */}
              {done.sha256 && (
                <p className="text-[10px] text-gray-500 font-mono break-all">
                  sha256 {done.sha256}
                </p>
              )}
              {!!done.notRepresentable && (
                <p className="text-[10px] text-amber-200/80 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {done.notRepresentable} activity value(s) did not read back from the{" "}
                  {fmt.toUpperCase()} file and are missing from it. Their provenance
                  notes are still present. P6 XML stores a percentage for every
                  percent-complete type and is the most likely to carry them.
                </p>
              )}
              {/* A gap in the file being written onto, not in the evidence. Worth
                  saying loudly: the planner can see these activities on screen and
                  would otherwise assume the download carried them. */}
              {!!done.missingFromSource && (
                <p className="text-[10px] text-amber-200/80 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {done.missingFromSource} activity(ies) with committed evidence are not
                  in the stored schedule this file was built from, so they could not be
                  written. Re-upload your current programme to include them.
                </p>
              )}
              {/* Not an error: the value is in the file. It is a heads-up that P6
                  may ask about an activity the programme says never started. */}
              {!!done.withoutActualStart && (
                <p className="text-[10px] text-gray-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {done.withoutActualStart} activity(ies) carry reported progress but no
                  actual start in your programme. The progress is written; P6 may ask
                  you to confirm an actual start. No date was invented — none was
                  reported.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] text-gray-600 max-w-sm">
              Every updated activity carries a note naming the field report it came from.
              Your planned dates and percentages are untouched — this is a copy, not your
              contract programme.
            </p>
            <Button
              onClick={() => void run()}
              disabled={busy || !preview?.exportable || preview.activities_updated === 0}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              {busy ? "Building…" : "Download"}
            </Button>
          </div>

          {preview?.activities_updated === 0 && (
            <p className="text-[10px] text-gray-600">
              Nothing to export yet — approve a field report in the review queue and it
              will appear here.
            </p>
          )}
        </>
      )}
    </div>
  );
}
