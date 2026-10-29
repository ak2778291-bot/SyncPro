// Organisation & team — the screen that decides who can do what.
//
// Two scopes live here because the product has two, and conflating them is the
// mistake this layout exists to prevent. Org membership says which company you
// belong to; a project role says what you may do on one job. An org `member`
// holds nothing at project scope, so adding someone under People is necessary but
// never sufficient — they also need a row under Project access.
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, FolderOpen, Loader2, Mail, Settings2, Upload, Users } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useOrg } from "@/shared/context/OrgContext";
import { useAuth } from "@/shared/context/AuthContext";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { getOrgProjects } from "@/shared/api/client";
import { useProjectCapabilities, CAP, ORG_ROLE_LABEL } from "@/features/shadow-schedule/useProjectCapabilities";
import { useOrgCapabilities } from "./useOrgCapabilities";
import VerifyEmailBanner from "@/features/auth/VerifyEmailBanner";
import OrgMembers from "./OrgMembers";
import Invitations from "./Invitations";
import JoinRequests from "./JoinRequests";
import ProjectAccess from "./ProjectAccess";
import OrgSettings from "./OrgSettings";

type TabId = "people" | "invites" | "projects" | "settings";

type Props = {
  /** Leaves this screen for the upload flow, which is how a project gets
   * created. Optional because the org screen is also rendered in contexts
   * that have nowhere to send you; the empty state degrades to explaining
   * the route rather than offering a button that does nothing. */
  onCreateProject?: () => void;
};

export default function OrganizationDashboard({ onCreateProject }: Props = {}) {
  const { activeOrgId, setActiveOrgId, orgs, refreshOrgs } = useOrg();
  const { user } = useAuth();
  const { activeProjectId } = useSchedule();
  const { org, can, loading, error, refresh } = useOrgCapabilities(activeOrgId);
  const [tab, setTab] = useState<TabId>("people");
  const [projects, setProjects] = useState<Array<{ project_id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string | null>(activeProjectId);

  const loadProjects = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const { items } = await getOrgProjects(activeOrgId);
      setProjects(items);
      setSelected((cur) => cur ?? items[0]?.project_id ?? null);
    } catch {
      setProjects([]);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Project-scope capabilities for whichever project is selected: `members:manage`
  // can come from a project_admin row as well as from being an org owner/admin,
  // so it must be asked per project rather than inferred from the org answer.
  const projectCaps = useProjectCapabilities(selected);

  const selectedName = useMemo(
    () => projects.find((p) => p.project_id === selected)?.name,
    [projects, selected],
  );

  const onOrgChanged = useCallback(() => {
    void refresh();
    void refreshOrgs();
  }, [refresh, refreshOrgs]);

  if (!activeOrgId) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
        <Building2 className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">No organisation selected.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading your organisation…
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
        <Building2 className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">This organisation isn't available to you.</p>
        <p className="text-xs text-gray-600 mt-1">{error}</p>
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Users }> = [
    { id: "people", label: "People", icon: Users },
    { id: "invites", label: "Invitations", icon: Mail },
    { id: "projects", label: "Project access", icon: FolderOpen },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <VerifyEmailBanner />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            {/* A switcher only when there is something to switch between. Someone
                who belongs to two companies — their own, plus a client's who
                invited them — otherwise lands in whichever the list returned
                first and has no way out of it. */}
            {orgs.length > 1 ? (
              <select
                value={activeOrgId ?? ""}
                onChange={(e) => setActiveOrgId(e.target.value)}
                className="bg-transparent text-lg font-semibold text-gray-200 focus:outline-none cursor-pointer -ml-1"
              >
                {orgs.map((o) => (
                  <option key={o.org_id} value={o.org_id} className="bg-slate-900 text-base">
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              org.name
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Who belongs to this organisation, and what they may do on each project.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-500">
            You are{" "}
            <span className="text-gray-300">{ORG_ROLE_LABEL[org.org_role] ?? org.org_role}</span>{" "}
            here
          </p>
          <p className="text-[10px] text-gray-600">
            {org.capabilities.length} capabilities granted
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
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
            </button>
          );
        })}
      </div>

      {tab === "people" && (
        <OrgMembers
          orgId={org.org_id}
          can={can}
          myRole={org.org_role}
          myUserId={user?.id ?? null}
        />
      )}

      {tab === "invites" && (
        <div className="space-y-6">
          <Invitations orgId={org.org_id} can={can} myRole={org.org_role} projects={projects} />
          <div>
            <p className="text-xs font-medium text-gray-300 mb-2">Join requests</p>
            <JoinRequests orgId={org.org_id} can={can} />
          </div>
        </div>
      )}

      {tab === "projects" && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-8 text-center">
              <FolderOpen className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No projects in this organisation yet.</p>
              {/* A project is created by importing a programme — there is no
                  "blank project" to make, because the schedule *is* the
                  project (its id is the Neo4j graph's id). So this offers the
                  upload route rather than a create dialog. */}
              {can(CAP.projectCreate) && onCreateProject ? (
                <>
                  <p className="text-xs text-gray-600 mt-1 mb-4">
                    A project starts from its programme — import one to create it, then
                    come back here to give people access.
                  </p>
                  <Button
                    onClick={onCreateProject}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Import a schedule
                  </Button>
                </>
              ) : (
                <p className="text-xs text-gray-600 mt-1">
                  {can(CAP.projectCreate)
                    ? "Import a schedule to create one, then come back to give people access."
                    : "Creating projects needs the project:create capability — an owner or admin can import the first programme."}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/[0.06] bg-slate-900 px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400 shrink-0">Project</span>
                <select
                  value={selected ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                  className="flex-1 min-w-[12rem] rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
                >
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id} className="bg-slate-900">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selected && !projectCaps.loading && (
                <ProjectAccess
                  projectId={selected}
                  projectName={selectedName}
                  can={projectCaps.can}
                  myUserId={user?.id ?? null}
                />
              )}
              {projectCaps.loading && (
                <div className="flex items-center justify-center p-12 text-gray-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking your access…
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "settings" && (
        <OrgSettings org={org} can={can} onChanged={onOrgChanged} />
      )}
    </motion.div>
  );
}
