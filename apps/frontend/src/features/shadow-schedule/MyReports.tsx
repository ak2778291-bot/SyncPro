// "What happened to what I sent" — the field reporter's own record.
//
// Distinct from ReviewQueue, which is a *work list*: pending-only, because a
// planner wants what still needs ruling on. This is a *history*, and the
// difference is not cosmetic — an approved report is the success case here
// and must stay visible, where in a work queue it is exactly what should
// disappear. Before this screen, a reporter watched their submissions vanish
// on approval with no confirmation the report had landed at all.
//
// Withdrawing is offered on pending rows only. Retracting something already
// approved is rewriting an evidence record after a planner ruled on it —
// that stays with `queue:adjudicate` (see capabilities.py's note on
// QUEUE_RETRACT_OWN).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Radio, Undo2, XCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  getMyReports,
  retractEvent,
  type MyReportCounts,
  type ReviewQueueItem,
} from "@/shared/api/client";

type Props = { projectId: string };

const STATUS_STYLE: Record<string, string> = {
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  approved: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-300 bg-red-500/10 border-red-500/20",
  retracted: "text-gray-500 bg-white/[0.03] border-white/[0.08]",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  retracted: Undo2,
};

export default function MyReports({ projectId }: Props) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [counts, setCounts] = useState<MyReportCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getMyReports(projectId);
      setItems(r.items);
      setCounts(r.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your reports.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (item: ReviewQueueItem) => {
    if (!confirm("Withdraw this report? It will not be reviewed, and you can send a corrected one.")) {
      return;
    }
    setBusy(item.event_id);
    setError(null);
    try {
      await retractEvent(projectId, item.event_id, "withdrawn by reporter");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw that report.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-300">
            Your reports {counts && <span className="text-gray-600">· {items.length} total</span>}
          </span>
          {counts && (
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-amber-300/90">{counts.pending} awaiting review</span>
              <span className="text-emerald-300/90">{counts.approved} approved</span>
              {counts.rejected > 0 && (
                <span className="text-red-300/90">{counts.rejected} rejected</span>
              )}
              {counts.retracted > 0 && (
                <span className="text-gray-500">{counts.retracted} withdrawn</span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Radio className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">You haven't reported anything yet.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Progress you report from the Assistant, or over WhatsApp, shows up here with
              what happened to it.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((it) => {
              const Icon = STATUS_ICON[it.review_status] ?? Clock;
              return (
                <div key={it.event_id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200">
                      {it.resolved_activity_name ?? (
                        <span className="text-gray-500">activity not matched</span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{it.raw_text}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {it.source_channel ?? "app"}
                      {it.captured_at &&
                        ` · ${new Date(it.captured_at).toLocaleString()}`}
                    </p>
                    {/* The reason matters most on a rejection — it is how the
                        reporter knows what to fix before sending a corrected
                        one, rather than guessing. */}
                    {it.review_reason && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">
                        {it.review_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                        STATUS_STYLE[it.review_status] ?? STATUS_STYLE.retracted
                      }`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {it.review_status}
                    </span>
                    {it.review_status === "pending" && (
                      <Button
                        variant="outline"
                        disabled={busy === it.event_id}
                        onClick={() => void withdraw(it)}
                        className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] text-[11px]"
                      >
                        {busy === it.event_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Undo2 className="w-3 h-3 mr-1" />
                            Withdraw
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        You can withdraw a report while it is still awaiting review — send a corrected one
        afterwards. Once a planner has approved it, it becomes part of the project's
        evidence record and only they can change it.
      </p>
    </div>
  );
}
