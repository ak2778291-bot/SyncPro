// What the field says, next to what the programme says.
//
// The two are deliberately never merged. The shadow schedule is a parallel,
// evidence-linked view built only from committed field claims; the contract
// programme is untouched. The gap between the columns is the product.
import { useCallback, useEffect, useState } from "react";
import { GitCompareArrows, Loader2 } from "lucide-react";
import {
  getShadowSchedule,
  type ShadowActivity,
  type ShadowSchedule,
} from "@/shared/api/client";
import ExportCard from "./ExportCard";

// `canExport` is threaded in rather than checked here because the export is
// gated on `schedule:export`, which is narrower than the `project:read` that
// lets you view this comparison at all — a viewer may read the gap without
// being handed the whole programme as a portable file.
type Props = { projectId: string; refreshKey?: number; canExport?: boolean };

function variance(a: ShadowActivity): number | null {
  if (a.shadow_percent_complete == null || a.planned_percent_complete == null) return null;
  return a.shadow_percent_complete - a.planned_percent_complete;
}

export default function ShadowVsPlanned({ projectId, refreshKey, canExport = false }: Props) {
  const [data, setData] = useState<ShadowSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getShadowSchedule(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the shadow schedule.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
        {error}
      </div>
    );
  }
  if (!data || data.activities.length === 0) {
    // The export panel still belongs here: with nothing committed it shows
    // "0 written / N withheld", which tells a planner that approving the queue
    // is what unlocks the export — more useful than hiding it entirely.
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center p-12 rounded-xl bg-slate-900 border border-white/[0.06]">
          <GitCompareArrows className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">No field-reported activities yet.</p>
          <p className="text-xs text-gray-600 mt-1">
            Activities appear here once a field claim is committed against them.
          </p>
        </div>
        {canExport && <ExportCard projectId={projectId} refreshKey={refreshKey} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.summary && <p className="text-xs text-gray-400">{data.summary}</p>}

      {/* Export lives here rather than under Governance: this is the screen where
          a planner is already comparing reported against planned, and the export
          is that same comparison in a container they can open in P6. */}
      {canExport && <ExportCard projectId={projectId} refreshKey={refreshKey} />}

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-gray-500">
                <th className="text-left font-medium px-4 py-2.5">Activity</th>
                <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">
                  Planned at report date
                </th>
                <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">
                  Reported
                </th>
                <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">
                  Variance
                </th>
                <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">
                  Reported by
                </th>
                <th className="text-right font-medium px-4 py-2.5 whitespace-nowrap">
                  Evidence
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data.activities.map((a) => {
                const v = variance(a);
                return (
                  <tr key={a.uid} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <p className="text-gray-200">{a.name}</p>
                      <p className="text-[10px] text-gray-600 font-mono">{a.uid}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-400">
                      {a.planned_percent_complete == null
                        ? "—"
                        : `${a.planned_percent_complete}%`}
                      {a.last_reported_at && (
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          as of {a.last_reported_at.slice(0, 10)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-100">
                      {a.shadow_percent_complete == null
                        ? "—"
                        : `${a.shadow_percent_complete}%`}
                      {a.last_reported_at && (
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {a.last_reported_at.slice(0, 10)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        v == null
                          ? "text-gray-600"
                          : v < 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                    </td>
                    <td className="px-4 py-2.5">
                      {a.last_reported_by ? (
                        <p className="text-gray-300 truncate max-w-[12rem]">
                          {a.last_reported_by}
                        </p>
                      ) : (
                        // Never fall back to the raw identity key — it is a
                        // pseudonymous uuid, and showing it would read as data
                        // rather than as the absence of it.
                        <p className="text-gray-600 italic">unknown</p>
                      )}
                      <p className="text-[10px] text-gray-600">
                        {a.last_source_channel ?? "—"}
                        {/* Distinct people, not events: two reports from one
                            person is not corroboration, and a planner reading
                            this column is asking exactly that question. */}
                        {a.distinct_reporter_count > 1 &&
                          ` · ${a.distinct_reporter_count} people`}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500 tabular-nums">
                      {a.committed_event_count}
                      <span className="text-gray-700">
                        {a.committed_event_count === 1 ? " report" : " reports"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-600">
        Planned progress is calculated linearly from each activity's start and finish on the
        field report date. A negative variance means the field is reporting less progress than the programme
        assumes. These values live on parallel <code>Shadow_*</code> properties — the
        contract programme's own dates and percentages are never written to.
      </p>
    </div>
  );
}
