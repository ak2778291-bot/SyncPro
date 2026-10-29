// Shadow Schedule Engine — the field-reality surface.
//
// Tab order is deliberate: the review queue comes first because it is where a
// planner spends their day and it is the only screen that produces the
// (claim -> adjudicated outcome) pairs the product learns from. Everything else
// is context for a decision made there.
//
// Every panel renders from the server's capability set, so a viewer, a planner
// and an owner see genuinely different screens — and the difference is enforced
// again on each endpoint, not just hidden here.
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GitCompareArrows,
  Inbox,
  Loader2,
  Radio,
  Settings2,
  Users,
} from "lucide-react";
import { getShadowSchedule } from "@/shared/api/client";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { useProjectCapabilities, CAP } from "./useProjectCapabilities";
import ReviewQueue from "./ReviewQueue";
import MyReports from "./MyReports";
import ShadowVsPlanned from "./ShadowVsPlanned";
import ReporterRoster from "./ReporterRoster";
import ContractModeCard from "./ContractModeCard";

type TabId = "queue" | "mine" | "diff" | "roster" | "settings";

export default function ShadowDashboard() {
  const { activeProjectId } = useSchedule();
  const { context, can, loading, error } = useProjectCapabilities(activeProjectId);
  const [tab, setTab] = useState<TabId>("queue");
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshCounts = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const s = await getShadowSchedule(activeProjectId);
      setPendingCount(s.pending_review_count);
    } catch {
      /* the panels surface their own errors; the badge just stays stale */
    }
  }, [activeProjectId]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts, refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);

  if (!activeProjectId) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
        <Radio className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">Select a project first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking your access…
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
        <Radio className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">This project isn't available to you.</p>
        <p className="text-xs text-gray-600 mt-1 max-w-sm text-center">
          Either it doesn't exist or you hold no membership on it — the API deliberately
          doesn't distinguish the two.
        </p>
      </div>
    );
  }

  if (!can(CAP.queueRead) && !can(CAP.projectRead)) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
        <Radio className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">You don't have access to field reality here.</p>
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Inbox; badge?: number; show: boolean }> = [
    { id: "queue", label: "Review queue", icon: Inbox, badge: pendingCount, show: can(CAP.queueRead) },
    // Gated on being able to *submit*, not merely to read your own: the tab
    // answers "what happened to what I sent", which is meaningless to a
    // `viewer` who never sends anything. Sits second so it is the first
    // visible tab — and therefore the landing tab — for a `field_reporter`,
    // who cannot see the review queue above it.
    {
      id: "mine",
      label: "My reports",
      icon: Radio,
      show: can(CAP.evidenceSubmit) && can(CAP.queueReadOwn),
    },
    // `queueRead`, not `projectRead`: this screen shows every activity's
    // reported-vs-planned progress, which is the aggregate of everyone's
    // claims. Someone held to `queue:read_own` precisely so they cannot read
    // other parties' claims should not get the same information summed up —
    // and a `field_reporter` does not need it to report, since the composer
    // has its own activity picker.
    { id: "diff", label: "Shadow vs planned", icon: GitCompareArrows, show: can(CAP.queueRead) },
    { id: "roster", label: "Reporters", icon: Users, show: can(CAP.enrollmentManage) },
    { id: "settings", label: "Governance", icon: Settings2, show: can(CAP.projectRead) },
  ];
  const visible = tabs.filter((t) => t.show);
  // The default tab is the review queue, which a `field_reporter` cannot see —
  // they hold `queue:read_own`, not `queue:read`. Without this fall-back the
  // content area would render nothing at all for them.
  const activeTab = visible.some((t) => t.id === tab) ? tab : visible[0]?.id;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Radio className="w-4 h-4 text-gray-500" />
            Field Reality
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            What the site is reporting, corroborated and gated before it touches anything.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-500">
            You are{" "}
            <span className="text-gray-300">
              {context.project_role ?? context.org_role}
            </span>{" "}
            here
          </p>
          <p className="text-[10px] text-gray-600">
            {context.capabilities.length} capabilities granted
          </p>
        </div>
      </div>

      {/* sub-tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {visible.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs transition border-b-2 -mb-px ${
                active
                  ? "border-blue-500 text-gray-100"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {t.badge ? (
                <span className="ml-0.5 rounded-full bg-amber-500/15 text-amber-300 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab === "queue" && (
        <ReviewQueue projectId={activeProjectId} can={can} onChanged={bump} />
      )}
      {activeTab === "mine" && <MyReports projectId={activeProjectId} />}
      {activeTab === "diff" && (
        <ShadowVsPlanned
          projectId={activeProjectId}
          refreshKey={refreshKey}
          canExport={can(CAP.scheduleExport)}
        />
      )}
      {activeTab === "roster" && <ReporterRoster projectId={activeProjectId} can={can} />}
      {activeTab === "settings" && (
        <ContractModeCard
          projectId={activeProjectId}
          can={can}
          pendingCount={pendingCount}
          onChanged={bump}
        />
      )}
    </motion.div>
  );
}
