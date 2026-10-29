// Who can reach one project, and what they may do there.
//
// Belonging to the company is not access to its projects: an org `member` holds
// nothing at project scope and reaches a project only through a row on this
// screen. That is the whole point of the two-tier model, and it is why this is
// separate from the organisation member list rather than a column on it.
//
// The role choice here is the separation-of-duties decision (arch §6.5). A
// `field_reporter` submits progress and rules on nothing; a `planner` rules on
// the queue. Getting this wrong is how a site engineer ends up approving their
// own reports, so each role carries its consequence in plain words rather than a
// name the user has to interpret.
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  addProjectMember,
  listProjectMembers,
  removeProjectMember,
  type ProjectMember,
  type ProjectRole,
} from "@/shared/api/client";
import { CAP, PROJECT_ROLE_LABEL } from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  projectId: string;
  projectName?: string;
  can: (capability: string) => boolean;
  myUserId: string | null;
};

const ROLES: ProjectRole[] = ["project_admin", "planner", "field_reporter", "viewer"];

/** What each role actually means in consequences, not job titles. */
const ROLE_HINT: Record<ProjectRole, string> = {
  project_admin:
    "Runs this project: rules on the queue, manages people and the reporter roster.",
  planner:
    "Owns the programme. Rules on the review queue and can re-import the schedule.",
  field_reporter:
    "Submits progress from site and tracks their own reports. Approves nothing — not even their own.",
  viewer: "Reads the schedule and the queue. Changes nothing.",
};

const ROLE_TONE: Record<ProjectRole, string> = {
  project_admin: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  planner: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  field_reporter: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  viewer: "text-gray-400 bg-white/[0.04] border-white/[0.08]",
};

export default function ProjectAccess({ projectId, projectName, can, myUserId }: Props) {
  const [items, setItems] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("viewer");

  const allowed = can(CAP.membersManage);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await listProjectMembers(projectId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load project access.");
    } finally {
      setLoading(false);
    }
  }, [allowed, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-8 text-center">
        <ShieldCheck className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-400">
          Managing access to this project needs the members:manage capability.
        </p>
      </div>
    );
  }

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("grant");
    setError(null);
    try {
      await addProjectMember(projectId, email.trim(), role);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grant that access.");
    } finally {
      setBusy(null);
    }
  };

  // Re-granting is how a role changes: the backend upserts on (project, user),
  // so there is no separate "change role" endpoint to call.
  const changeRole = async (m: ProjectMember, next: ProjectRole) => {
    setBusy(m.user_id);
    setError(null);
    try {
      if (!m.email) throw new Error("This member has no email on file to re-grant against.");
      await addProjectMember(projectId, m.email, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that role.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: ProjectMember) => {
    if (!confirm(`Remove ${m.email || m.user_id} from this project?`)) return;
    setBusy(m.user_id);
    setError(null);
    try {
      await removeProjectMember(projectId, m.user_id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that person.");
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

      <form
        onSubmit={grant}
        className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <UserPlus className="w-3.5 h-3.5 text-gray-500" />
          Give someone access to {projectName ? `“${projectName}”` : "this project"}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectRole)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-slate-900">
                {PROJECT_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy === "grant" || !email.trim()}>
            {busy === "grant" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Grant
          </Button>
        </div>
        <p className="text-[10px] text-gray-600">{ROLE_HINT[role]}</p>
      </form>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-gray-300">
            {items.length} with access
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              Nobody has been given access to this project yet.
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              Org owners and admins reach it anyway — everyone else needs a row here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((m) => (
              <div
                key={m.user_id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-semibold text-white ring-1 ring-white/10 uppercase shrink-0">
                    {(m.name || m.email || "?").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 truncate">
                      {m.name || m.email || m.user_id}
                      {m.user_id === myUserId && (
                        <span className="ml-2 text-[10px] text-gray-600">you</span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{m.email || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`hidden md:inline-block rounded-full border px-2 py-0.5 text-[10px] ${
                      ROLE_TONE[m.project_role] ?? ROLE_TONE.viewer
                    }`}
                  >
                    {PROJECT_ROLE_LABEL[m.project_role] ?? m.project_role}
                  </span>
                  <select
                    value={m.project_role}
                    disabled={busy === m.user_id || !m.email}
                    onChange={(e) => void changeRole(m, e.target.value as ProjectRole)}
                    className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-slate-900">
                        {PROJECT_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void remove(m)}
                    disabled={busy === m.user_id}
                    title="Remove from project"
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {busy === m.user_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-4">
        <p className="text-[11px] text-gray-400 mb-2">What the roles mean</p>
        <div className="space-y-1.5">
          {ROLES.map((r) => (
            <div key={r} className="flex items-start gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] shrink-0 w-28 text-center ${ROLE_TONE[r]}`}
              >
                {PROJECT_ROLE_LABEL[r]}
              </span>
              <span className="text-[10px] text-gray-600 pt-0.5">{ROLE_HINT[r]}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-3 pt-3 border-t border-white/[0.06]">
          Nobody can approve a field report they submitted themselves, whatever their role.
          A field reporter is not the same thing as an enrolled WhatsApp number — that is a
          phone with no account at all, managed under Field Reality → Reporters.
        </p>
      </div>
    </div>
  );
}
