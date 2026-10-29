import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartPulse, AlertTriangle, AlertCircle, Info, RefreshCw, Loader2,
  Wrench, ThumbsUp, ThumbsDown, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSchedule } from "@/features/projects/ScheduleContext";
import {
  getHealthScore, getHealthNarrative, postHealthDecision, getHealthDecisions,
  type ScheduleHealthReport, type HealthFlag, type HealthSeverity,
} from "@/shared/api/client";

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  B: "text-lime-400 border-lime-500/40 bg-lime-500/10",
  C: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  D: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  F: "text-red-400 border-red-500/40 bg-red-500/10",
};

const SEVERITY_META: Record<HealthSeverity, { color: string; icon: typeof AlertTriangle }> = {
  Critical: { color: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
  Warning: { color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: AlertCircle },
  Advisory: { color: "text-sky-400 bg-sky-500/10 border-sky-500/20", icon: Info },
};

const FlagCard = ({
  flag, onDecision, decided,
}: {
  flag: HealthFlag;
  onDecision: (d: "accept" | "reject") => void;
  decided?: "accept" | "reject";
}) => {
  const [open, setOpen] = useState(false);
  const meta = SEVERITY_META[flag.severity];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 rounded-lg border p-1.5 ${meta.color}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-100">{flag.category}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>
              {flag.severity}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-gray-400">
              {flag.family}
            </span>
            <span className="text-[11px] text-gray-500 ml-auto">
              {flag.measured} <span className="text-gray-600">/ limit {flag.threshold}</span>
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            {flag.plain_english_description}
          </p>
          <div className="mt-2 flex items-start gap-2 text-sm text-emerald-300/90">
            <Wrench className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{flag.proposed_fix}</span>
          </div>

          {flag.affected_activity_ids.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {flag.affected_activity_ids.length} affected activit
                {flag.affected_activity_ids.length === 1 ? "y" : "ies"}
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {flag.affected_activity_ids.map((a, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-gray-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onDecision("accept")}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                decided === "accept"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "border-white/10 text-gray-400 hover:text-emerald-300 hover:border-emerald-500/30"
              }`}
            >
              <ThumbsUp className="w-3 h-3" /> Accept fix
            </button>
            <button
              onClick={() => onDecision("reject")}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${
                decided === "reject"
                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                  : "border-white/10 text-gray-400 hover:text-red-300 hover:border-red-500/30"
              }`}
            >
              <ThumbsDown className="w-3 h-3" /> Dismiss
            </button>
            {decided && (
              <span className="text-[10px] text-gray-500">recorded — thanks, this trains the model</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const HealthDashboard = () => {
  const { activeProjectId } = useSchedule();
  const [report, setReport] = useState<ScheduleHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "accept" | "reject">>({});

  const fetchReport = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError(null);
    setNarrative(null);
    try {
      setReport(await getHealthScore(activeProjectId));
    } catch (e: any) {
      setError(e?.message || "Failed to compute health score");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  // Rulings already recorded on this project. Without this the dashboard only
  // knows what was decided in the current session, so a refresh made every flag
  // look unruled even though the decision was persisted — and re-deciding it
  // wrote a second record for the same flag.
  const fetchDecisions = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const { decisions: rows } = await getHealthDecisions(activeProjectId);
      // Newest first from the server, so the first row per flag is the live one.
      const latest: Record<string, "accept" | "reject"> = {};
      for (const d of rows) {
        if (d.flag_id && !(d.flag_id in latest)) latest[d.flag_id] = d.decision;
      }
      setDecisions(latest);
    } catch {
      /* the flags still render; they just show as undecided */
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchReport();
    void fetchDecisions();
  }, [fetchReport, fetchDecisions]);

  const loadNarrative = async () => {
    if (!activeProjectId) return;
    setNarrLoading(true);
    try {
      const res = await getHealthNarrative(activeProjectId);
      setNarrative(res.narrative);
    } catch {
      setNarrative("Narrative unavailable.");
    } finally {
      setNarrLoading(false);
    }
  };

  const decide = async (flagId: string, decision: "accept" | "reject", repairId = "") => {
    setDecisions((d) => ({ ...d, [flagId]: decision }));
    try {
      await postHealthDecision({
        projectId: activeProjectId!, flagId, decision, repairId,
      });
    } catch {
      /* optimistic — keep the UI state even if persistence hiccups */
    }
  };

  if (!activeProjectId) {
    return <div className="text-gray-400 text-sm">Select a project to see its health score.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-red-400" /> Schedule Health
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            DCMA 14-point + 6 corruption-pattern checks, with plain-English fixes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1.5">Re-run</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-3">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Scoring schedule…
        </div>
      )}

      {report && (
        <>
          {/* Score header */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className={`w-28 h-28 rounded-2xl border flex flex-col items-center justify-center ${GRADE_COLOR[report.grade]}`}>
              <span className="text-4xl font-bold leading-none">{report.score}</span>
              <span className="text-xs opacity-70 mt-1">/ 100</span>
              <span className="text-lg font-semibold mt-1">Grade {report.grade}</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-200">{report.summary}</p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                <span>{report.total_activities} activities</span>
                <span>{report.checks_applicable}/{report.checks_total} checks applicable</span>
                {report.data_date && <span>Data date: {report.data_date}</span>}
              </div>
              <div>
                {narrative ? (
                  <div className="text-sm text-gray-300 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 leading-relaxed">
                    {narrative}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadNarrative} disabled={narrLoading}>
                    {narrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span className="ml-1.5">Explain for the PM</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Flags */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              {report.flags.length} issue{report.flags.length === 1 ? "" : "s"} found
            </h3>
            {report.flags.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm p-4">
                No issues on the applicable checks. 🎉
              </div>
            ) : (
              <div className="space-y-3">
                {report.flags.map((f) => (
                  <FlagCard
                    key={f.flag_id}
                    flag={f}
                    decided={decisions[f.flag_id]}
                    onDecision={(d) => decide(f.flag_id, d)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Ranked repairs */}
          {report.repairs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                Logic-repair proposals (ranked by float recovery)
              </h3>
              <div className="space-y-2">
                {report.repairs.map((r) => (
                  <div
                    key={r.repair_id}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <span className="shrink-0 text-[11px] font-mono px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      +{r.estimated_float_recovery_days}d
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300">{r.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                        <span className="uppercase tracking-wide">{r.repair_type.replace(/_/g, " ")}</span>
                        <span>confidence {Math.round(r.confidence * 100)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => decide(r.flag_id, "accept", r.repair_id)}
                        className="p-1.5 rounded border border-white/10 text-gray-400 hover:text-emerald-300 hover:border-emerald-500/30"
                        title="Accept repair"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => decide(r.flag_id, "reject", r.repair_id)}
                        className="p-1.5 rounded border border-white/10 text-gray-400 hover:text-red-300 hover:border-red-500/30"
                        title="Reject repair"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HealthDashboard;
