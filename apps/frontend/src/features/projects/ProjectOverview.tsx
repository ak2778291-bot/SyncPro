// What state is this job in, and what needs me?
//
// Every other screen is a *tool*. Nothing answered the question a returning user
// actually arrives with, so the landing destination was an empty file uploader
// (UX_FLOW §2 F5, §9.1).
//
// The top row is the product's whole thesis on one line: what the programme
// claims, what the field reports, and the gap between them. Both numbers already
// existed in an endpoint; nothing put them side by side.
//
// Composed from capabilities, like everything else — a `field_reporter` sees the
// programme and their own reports, not the review queue.
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GitCompareArrows,
  Inbox,
  Loader2,
  Radio,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useSchedule } from "@/features/projects/ScheduleContext";
import {
  getReviewQueue,
  getShadowSchedule,
  type ReviewQueueItem,
  type ShadowSchedule,
} from "@/shared/api/client";
import { CAP } from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  can: (capability: string) => boolean;
  onNavigate: (tab: string) => void;
};

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const colour =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-gray-100";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${colour}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ProjectOverview({ can, onNavigate }: Props) {
  const { activeProjectId, projects } = useSchedule();
  const project = projects.find((p) => p.id === activeProjectId);

  const [shadow, setShadow] = useState<ShadowSchedule | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const canSeeWholeQueue = can(CAP.queueRead);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    // Settled, not all: an overview that fails wholesale because one panel's
    // endpoint is unavailable is worse than one with a gap in it.
    const [s, q] = await Promise.allSettled([
      getShadowSchedule(activeProjectId),
      // `mine` is not a preference here — a field_reporter holds queue:read_own
      // and the unfiltered call would 403.
      getReviewQueue(activeProjectId, !canSeeWholeQueue),
    ]);
    if (s.status === "fulfilled") setShadow(s.value);
    if (q.status === "fulfilled") setQueue(q.value.items ?? []);
    setLoading(false);
  }, [activeProjectId, canSeeWholeQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading this project…
      </div>
    );
  }

  const activities = shadow?.activities ?? [];
  const reported = activities.filter((a) => a.shadow_percent_complete != null);
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  // Averaged over activities the field has actually reported on. Averaging over
  // the whole programme would silently read "not yet reported" as "0% done",
  // which is a different and untrue claim.
  const plannedAvg = avg(
    reported.map((a) => a.planned_percent_complete).filter((n): n is number => n != null),
  );
  const reportedAvg = avg(
    reported.map((a) => a.shadow_percent_complete).filter((n): n is number => n != null),
  );
  const gap = plannedAvg != null && reportedAvg != null ? reportedAvg - plannedAvg : null;
  const pending = shadow?.pending_review_count ?? 0;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-200">{project?.name ?? "Project"}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {project?.taskCount ?? 0} activities
          {reported.length > 0 && ` · ${reported.length} with field reports`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Programme says"
          value={plannedAvg != null ? `${plannedAvg.toFixed(0)}%` : "—"}
          sub={reported.length ? "on reported activities" : "no field reports yet"}
        />
        <Stat
          label="The field says"
          value={reportedAvg != null ? `${reportedAvg.toFixed(0)}%` : "—"}
          sub={reported.length ? `across ${reported.length} activities` : undefined}
        />
        <Stat
          label="Gap"
          value={gap == null ? "—" : `${gap > 0 ? "+" : ""}${gap.toFixed(0)} pts`}
          sub={
            gap == null
              ? "needs committed reports"
              : gap < 0
                ? "field is behind the programme"
                : "field is ahead of the programme"
          }
          tone={gap == null ? "neutral" : gap < 0 ? "warn" : "good"}
        />
      </div>

      {canSeeWholeQueue && pending > 0 && (
        <button
          onClick={() => onNavigate("shadow")}
          className="w-full text-left rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-amber-500/[0.09] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4 text-amber-300 shrink-0" />
            <div>
              <p className="text-sm text-amber-100">
                {pending} claim{pending === 1 ? "" : "s"} waiting on you
              </p>
              <p className="text-[11px] text-gray-400">
                Nothing commits to the shadow schedule until someone rules on them.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-300/70 shrink-0" />
        </button>
      )}

      {can(CAP.evidenceSubmit) && (
        <button
          onClick={() => onNavigate("llm")}
          className="w-full text-left rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-emerald-500/[0.09] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-emerald-300 shrink-0" />
            <div>
              <p className="text-sm text-emerald-100">Report progress from site</p>
              <p className="text-[11px] text-gray-400">
                Same checks a WhatsApp message runs — matched, corroborated, then gated.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-300/70 shrink-0" />
        </button>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">
            {canSeeWholeQueue ? "Awaiting review" : "Your recent reports"}
          </span>
          <button
            onClick={() => onNavigate("shadow")}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Open Field Reality
          </button>
        </div>
        {queue.length === 0 ? (
          <div className="p-8 text-center">
            <Radio className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              {canSeeWholeQueue ? "Nothing is waiting." : "You have not reported yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {queue.slice(0, 5).map((e) => (
              <div key={e.event_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-200 truncate">{e.raw_text || "(no text)"}</p>
                  <p className="text-[10px] text-gray-600">
                    {e.resolved_activity_name ?? "unmatched"} · {e.source_channel}
                  </p>
                </div>
                <span className="text-[10px] text-gray-600 tabular-nums shrink-0">
                  {e.commit_confidence > 0 ? e.commit_confidence.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {reported.length > 0 && (
        <button
          onClick={() => onNavigate("shadow")}
          className="w-full text-left rounded-xl border border-white/[0.06] bg-slate-900 px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <GitCompareArrows className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className="text-sm text-gray-200">Shadow vs planned</p>
              <p className="text-[11px] text-gray-500">
                Activity by activity, and export it back to P6 or MS Project.
              </p>
            </div>
          </div>
          {gap != null &&
            (gap < 0 ? (
              <TrendingDown className="w-4 h-4 text-amber-400/70 shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-400/70 shrink-0" />
            ))}
        </button>
      )}

      <p className="text-[10px] text-gray-600">
        Reported figures live on parallel <code>Shadow_*</code> properties — the contract
        programme's own dates and percentages are never written to.
      </p>
    </motion.div>
  );
}
