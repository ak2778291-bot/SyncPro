// Project navigation, rendered from the server's capability set.
//
// Two changes from the flat nine-tab list this replaces (UX_FLOW §4.2):
//
// **It is grouped.** Daily surfaces, interpretation, and administration are
// different kinds of work, and three short lists read faster than one long one.
// The grouping also makes the capability rule legible — "no MANAGE section"
// says something, where a silently shorter list does not.
//
// **It is filtered.** A `field_reporter` — a site engineer whose whole job is
// reporting progress — was being shown Upload, Re-forecast, Flowline and Graph,
// none of which they can act on. They now see four items instead of nine.
// Hiding a control the caller cannot use is a courtesy; every endpoint behind it
// refuses the call again regardless (ORG_WORKSPACE §6.2), so this is never the
// access control itself.
//
// Organisation is deliberately absent: it is org-scoped and now lives in the top
// bar, reachable without a project open.
import React from "react";
import {
  Activity,
  BarChart3,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Network,
  Radio,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { CAP } from "@/features/shadow-schedule/useProjectCapabilities";

export type NavItem = {
  id: string;
  label: string;
  icon: typeof Upload;
  /** Capability required to see it. Undefined = always visible. */
  cap?: string;
};

export type NavGroup = { title: string; items: NavItem[] };

/** The full navigation, before filtering. Exported so the landing-destination
 * logic can ask "what is the first thing this person can actually open?" rather
 * than duplicating the list. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Project",
    items: [
      { id: "overview", label: "Overview", icon: LayoutGrid, cap: CAP.projectRead },
      { id: "table", label: "Schedule", icon: LayoutDashboard, cap: CAP.projectRead },
      { id: "shadow", label: "Field Reality", icon: Radio, cap: CAP.projectRead },
      { id: "llm", label: "Assistant", icon: MessageSquare, cap: CAP.projectRead },
    ],
  },
  {
    title: "Analysis",
    items: [
      // Interpretation, not operation. Gated on queue:read rather than
      // project:read: it is the closest existing capability that separates
      // "works the programme" from "reports against it", and a field reporter
      // has no use for float analysis.
      { id: "health", label: "Health", icon: HeartPulse, cap: CAP.queueRead },
      { id: "reforecast", label: "Re-forecast", icon: Activity, cap: CAP.queueRead },
      { id: "graph", label: "Graph", icon: Network, cap: CAP.queueRead },
      { id: "flowline", label: "Flowline", icon: BarChart3, cap: CAP.queueRead },
    ],
  },
  {
    title: "Manage",
    items: [
      { id: "access", label: "Project access", icon: Users, cap: CAP.membersManage },
      { id: "upload", label: "Import schedule", icon: Upload, cap: CAP.scheduleWrite },
    ],
  },
];

export function visibleGroups(can: (c: string) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.cap || can(i.cap)),
  })).filter((g) => g.items.length > 0);
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  can: (capability: string) => boolean;
  /** Shown while the capability set is still loading, so the nav does not flash
   * from empty to full on every project switch. */
  loading?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, can, loading }) => {
  const { projects, activeProjectId } = useSchedule();
  const groups = visibleGroups(can);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <aside className="w-56 shrink-0 h-full bg-slate-950 border-r border-white/[0.06] flex flex-col overflow-y-auto">
      {activeProject && (
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">
            Project
          </div>
          <div className="text-xs text-gray-300 truncate mt-0.5" title={activeProject.name}>
            {activeProject.name}
          </div>
          <div className="text-[10px] text-gray-600 mt-0.5">
            {activeProject.taskCount} activities
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-4 py-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : (
        <nav className="py-3 space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="px-4 pb-1 text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="px-2 space-y-0.5">
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-xs transition-colors",
                      activeTab === id
                        ? "bg-white/[0.08] text-white"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
};

export default Sidebar;
