import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, Loader2, Sparkles, UploadCloud, FlaskConical, FileClock,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSchedule } from "@/features/projects/ScheduleContext";
import {
  getProjectTasks, postWhatIf, postReimport, getWeeklyNarrative,
  type WhatIfResult, type ReimportChangeset, type WeeklyNarrative,
} from "@/shared/api/client";

const Card = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
    <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-blue-400" /> {title}
    </h3>
    {children}
  </div>
);

const ReforecastDashboard = () => {
  const { activeProjectId } = useSchedule();

  // What-if state
  const [activities, setActivities] = useState<string[]>([]);
  const [activity, setActivity] = useState("");
  const [delay, setDelay] = useState(5);
  const [whatif, setWhatif] = useState<WhatIfResult | null>(null);
  const [whatifLoading, setWhatifLoading] = useState(false);
  const [whatifErr, setWhatifErr] = useState<string | null>(null);

  // Narrative state
  const [narrative, setNarrative] = useState<WeeklyNarrative | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);

  // Re-import state
  const [file, setFile] = useState<File | null>(null);
  const [changeset, setChangeset] = useState<ReimportChangeset | null>(null);
  const [reimportLoading, setReimportLoading] = useState(false);
  const [reimportErr, setReimportErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    getProjectTasks(activeProjectId)
      .then((res) => {
        const names = (res.tasks || [])
          .map((t: any) => t.Task_Name)
          .filter((n: any): n is string => typeof n === "string" && n.length > 0);
        setActivities(names);
        if (names.length) setActivity((a) => a || names[0]);
      })
      .catch(() => setActivities([]));
  }, [activeProjectId]);

  const runWhatIf = async () => {
    if (!activeProjectId || !activity) return;
    setWhatifLoading(true);
    setWhatifErr(null);
    try {
      setWhatif(await postWhatIf({ projectId: activeProjectId, delayDays: delay, activityName: activity }));
    } catch (e: any) {
      setWhatifErr(e?.message || "Simulation failed");
    } finally {
      setWhatifLoading(false);
    }
  };

  const runNarrative = async () => {
    if (!activeProjectId) return;
    setNarrLoading(true);
    try {
      setNarrative(await getWeeklyNarrative(activeProjectId));
    } finally {
      setNarrLoading(false);
    }
  };

  const runReimport = async () => {
    if (!activeProjectId || !file) return;
    setReimportLoading(true);
    setReimportErr(null);
    try {
      setChangeset(await postReimport(file, activeProjectId));
      await runNarrative(); // auto-refresh the narrative after a re-status
    } catch (e: any) {
      setReimportErr(e?.message || "Re-import failed");
    } finally {
      setReimportLoading(false);
    }
  };

  if (!activeProjectId) {
    return <div className="text-gray-400 text-sm">Select a project to use the re-forecast tools.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" /> Living Re-forecast
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Simulate a delay, re-import an updated schedule, and read what changed.
        </p>
      </div>

      {/* What-if */}
      <Card title="What-if: delay an activity" icon={FlaskConical}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-gray-500">Activity</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full mt-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
            >
              {activities.length === 0 && <option value="">No activities</option>}
              {activities.map((n, i) => (
                <option key={i} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500">Delay (days)</label>
            <input
              type="number"
              value={delay}
              min={0}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full mt-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
            />
          </div>
          <Button size="sm" onClick={runWhatIf} disabled={whatifLoading || !activity}>
            {whatifLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            <span className="ml-1.5">Simulate</span>
          </Button>
        </div>

        {whatifErr && <p className="text-sm text-red-400 mt-3">{whatifErr}</p>}

        {whatif && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className={`rounded-xl border px-4 py-3 ${whatif.project_finish_delay_days > 0 ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                <div className="text-2xl font-bold">+{whatif.project_finish_delay_days}d</div>
                <div className="text-[11px] opacity-80">project finish impact</div>
              </div>
              <div className="rounded-xl border border-white/10 px-4 py-3 text-gray-300">
                <div className="text-2xl font-bold">{whatif.newly_critical_count}</div>
                <div className="text-[11px] opacity-70">newly critical (of {whatif.downstream_count} downstream)</div>
              </div>
            </div>
            <p className="text-sm text-gray-300">{whatif.summary}</p>
            <p className="text-[11px] text-gray-600 italic">{whatif.method}</p>
            {whatif.impacts.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">Downstream activity</th>
                      <th className="text-right px-3 py-2">Float before</th>
                      <th className="text-right px-3 py-2">Float after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatif.impacts.map((im) => (
                      <tr key={im.uid} className="border-t border-white/[0.04]">
                        <td className="px-3 py-1.5 text-gray-300">
                          {im.becomes_critical && <span className="text-red-400 mr-1">●</span>}
                          {im.name}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{im.float_before_days ?? "—"}</td>
                        <td className={`px-3 py-1.5 text-right ${im.float_after_days !== null && im.float_after_days <= 0 ? "text-red-400" : "text-gray-400"}`}>
                          {im.float_after_days ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </Card>

      {/* Weekly narrative */}
      <Card title="Weekly narrative" icon={FileClock}>
        {narrative ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300 leading-relaxed bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
              {narrative.narrative}
            </p>
            <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
              <span>{narrative.events_considered} logged changes</span>
              <span>{narrative.critical_count} critical</span>
              <span>{narrative.upcoming_count} starting in 14 days</span>
              {narrative.data_date && <span>data date {narrative.data_date}</span>}
              <span className="italic">source: {narrative.source}</span>
            </div>
            <Button variant="outline" size="sm" onClick={runNarrative} disabled={narrLoading}>
              {narrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="ml-1.5">Regenerate</span>
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={runNarrative} disabled={narrLoading}>
            {narrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-1.5">Generate weekly briefing</span>
          </Button>
        )}
      </Card>

      {/* Re-import */}
      <Card title="Incremental re-import" icon={UploadCloud}>
        <p className="text-xs text-gray-500 mb-3">
          Upload an updated version of this schedule. We diff it against the current state,
          apply status/date/float changes, and log every change to the audit trail.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xer,.mpp,.xml,.pp,.mspdi"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white"
          />
          <Button size="sm" onClick={runReimport} disabled={reimportLoading || !file}>
            {reimportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span className="ml-1.5">Re-import & diff</span>
          </Button>
        </div>

        {reimportErr && <p className="text-sm text-red-400 mt-3">{reimportErr}</p>}

        {changeset && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">{changeset.modified_count} modified</span>
              <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">{changeset.added_count} added</span>
              <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300">{changeset.removed_count} removed</span>
              <span className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-gray-300">{changeset.events_recorded} events logged</span>
            </div>
            <p className="text-sm text-gray-400">{changeset.summary}</p>
            {changeset.modified.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.04]">
                {changeset.modified.map((m) => (
                  <div key={m.uid} className="px-3 py-2">
                    <div className="text-sm text-gray-200">{m.name}</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {m.changes.map((c, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-gray-400">
                          {c.field}: <span className="text-gray-500">{c.previous ?? "∅"}</span> → <span className="text-gray-300">{c.current ?? "∅"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReforecastDashboard;
