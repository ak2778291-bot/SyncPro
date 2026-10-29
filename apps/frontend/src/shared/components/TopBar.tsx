// Org / project breadcrumb, and the account menu.
//
// This bar exists because the product has three scopes and the interface had one
// (UX_FLOW §1). Organisation used to be the ninth tab in a *project* sidebar,
// which meant a company-wide setting was reached through a project it had nothing
// to do with — and was unreachable entirely before a project existed.
//
// Making both scopes permanently visible and switchable is the smallest change
// that fixes that: you can always see which company and which job you are looking
// at, and you can always leave. Someone in two organisations (their own, plus a
// client's who invited them) previously landed in whichever the list returned
// first with no way out.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Check,
  ChevronDown,
  FolderOpen,
  LogOut,
  Settings2,
  UserCircle,
  Users,
} from "lucide-react";
import { useOrg } from "@/shared/context/OrgContext";
import { useAuth } from "@/shared/context/AuthContext";
import { useSchedule } from "@/features/projects/ScheduleContext";

type Props = {
  /** Opens the org screen — the destination that left the project sidebar. */
  onOpenOrg?: () => void;
  /** Clears the active project, returning to the hub. */
  onLeaveProject?: () => void;
  /** Opens account settings. Available in `minimal` mode too — the onboarding
   * screen is exactly where someone may need to fix the handle or password on
   * an account they just created. */
  onOpenProfile?: () => void;
  /** Brand + account menu only, no org/project breadcrumb.
   *
   * For onboarding, where the user belongs to no organisation and has no
   * project: a breadcrumb reading "No organisation ▾" over an empty dropdown
   * is noise, and its "People & settings" item would point at nothing. What
   * is genuinely needed on that screen is the account menu — someone who
   * signed up with the wrong Google account currently has no way out of it
   * except clearing storage. */
  minimal?: boolean;
};

function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onDismiss]);
  return ref;
}

export default function TopBar({
  onOpenOrg,
  onLeaveProject,
  onOpenProfile,
  minimal = false,
}: Props) {
  const navigate = useNavigate();
  const { orgs, activeOrg, activeOrgId, setActiveOrgId } = useOrg();
  const { projects, activeProjectId, setActiveProjectId } = useSchedule();
  const { user, logout } = useAuth();

  const [menu, setMenu] = useState<"org" | "project" | "account" | null>(null);
  const ref = useDismiss(() => setMenu(null));

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const item =
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06]";

  return (
    <header
      ref={ref}
      className="h-14 shrink-0 border-b border-white/[0.06] bg-slate-950 flex items-center justify-between px-4 gap-3 relative z-30"
    >
      <div className="flex items-center gap-1 min-w-0">
        <button
          onClick={onLeaveProject}
          disabled={minimal}
          title={minimal ? "SyncPro" : "SyncPro — all projects"}
          className="flex items-center gap-2 px-1.5 py-1 rounded-lg shrink-0 transition-colors enabled:hover:bg-white/[0.06] disabled:cursor-default"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="hidden md:block text-sm font-semibold text-white tracking-tight">
            SyncPro
          </span>
        </button>

        {/* organisation */}
        {!minimal && (
        <div className="relative">
          <button
            onClick={() => setMenu(menu === "org" ? null : "org")}
            className={`${item} text-gray-200 max-w-[16rem]`}
          >
            <span className="truncate">{activeOrg?.name ?? "No organisation"}</span>
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
          </button>
          {menu === "org" && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-xl bg-slate-800 border border-white/[0.08] shadow-xl overflow-hidden">
              {orgs.length > 1 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wider bg-slate-900/50">
                  Switch organisation
                </div>
              )}
              {orgs.map((o) => (
                <button
                  key={o.org_id}
                  onClick={() => {
                    setActiveOrgId(o.org_id);
                    setMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] flex items-center justify-between gap-2"
                >
                  <span className="truncate">{o.name}</span>
                  {o.org_id === activeOrgId && (
                    <Check className="w-3 h-3 text-blue-400 shrink-0" />
                  )}
                </button>
              ))}
              <div className="border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    setMenu(null);
                    onOpenOrg?.();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] flex items-center gap-2"
                >
                  <Users className="w-3 h-3 text-gray-500" />
                  People &amp; settings
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* project — only meaningful once one is open */}
        {!minimal && activeProject && (
          <>
            <span className="text-gray-700 select-none">/</span>
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "project" ? null : "project")}
                className={`${item} text-gray-200 max-w-[20rem]`}
              >
                <span className="truncate">{activeProject.name}</span>
                <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
              </button>
              {menu === "project" && (
                <div className="absolute left-0 top-full mt-1 w-80 rounded-xl bg-slate-800 border border-white/[0.08] shadow-xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-gray-300 truncate">{p.name}</span>
                          <span className="block text-[10px] text-gray-600">
                            {p.taskCount} activities
                          </span>
                        </span>
                        {p.id === activeProjectId && (
                          <Check className="w-3 h-3 text-blue-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.06]">
                    <button
                      onClick={() => {
                        setMenu(null);
                        onLeaveProject?.();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] flex items-center gap-2"
                    >
                      <FolderOpen className="w-3 h-3 text-gray-500" />
                      All projects
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* account */}
      <div className="relative shrink-0">
        <button
          onClick={() => setMenu(menu === "account" ? null : "account")}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          <span className="hidden sm:block text-[11px] text-gray-400">
            {user?.username ? `@${user.username}` : user?.email}
          </span>
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-semibold text-white ring-1 ring-white/10 uppercase">
            {(user?.name || user?.email || "?").charAt(0)}
          </div>
        </button>
        {menu === "account" && (
          <div className="absolute right-0 top-full mt-1 w-60 rounded-xl bg-slate-800 border border-white/[0.08] shadow-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <p className="text-xs text-gray-200 truncate">{user?.name || "Signed in"}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
              {user?.username && (
                <p className="text-[10px] text-gray-600 font-mono">@{user.username}</p>
              )}
            </div>
            {onOpenProfile && (
              <button
                onClick={() => {
                  setMenu(null);
                  onOpenProfile();
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] flex items-center gap-2"
              >
                <UserCircle className="w-3 h-3 text-gray-500" />
                Account settings
              </button>
            )}
            {!minimal && (
              <button
                onClick={() => {
                  setMenu(null);
                  onOpenOrg?.();
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.05] flex items-center gap-2"
              >
                <Settings2 className="w-3 h-3 text-gray-500" />
                Organisation
              </button>
            )}
            <button
              onClick={() => {
                setMenu(null);
                logout();
                navigate("/", { replace: true });
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-white/[0.05] hover:text-gray-200 flex items-center gap-2 border-t border-white/[0.06]"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
