// Who has been offered access, and what happened to each offer.
//
// The member list answers "who is in"; this answers "who was asked". Without it an
// admin who invites someone has no way to see that it is outstanding, no way to
// withdraw it before it is acted on, and no way to tell "they never joined" from
// "I never actually invited them".
//
// An invitation grants nothing until accepted, so a pending row is a *promise*,
// not access. That distinction is why revoking one is a different act from
// removing a member, and why the two live in different panels.
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Link2,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  createOrgInvitation,
  listOrgInvitations,
  revokeOrgInvitation,
  type OrgInvitation,
  type OrgRole,
  type ProjectRole,
} from "@/shared/api/client";
import {
  CAP,
  ORG_ROLE_LABEL,
  PROJECT_ROLE_LABEL,
} from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  orgId: string;
  can: (capability: string) => boolean;
  myRole: OrgRole;
  projects: Array<{ project_id: string; name: string }>;
};

const STATUS_STYLE: Record<OrgInvitation["status"], string> = {
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  accepted: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  expired: "text-gray-500 bg-white/[0.03] border-white/[0.08]",
  revoked: "text-gray-500 bg-white/[0.03] border-white/[0.08]",
};

const STATUS_ICON: Record<OrgInvitation["status"], typeof Clock> = {
  pending: Clock,
  accepted: Check,
  expired: XCircle,
  revoked: XCircle,
};

const PROJECT_ROLES: ProjectRole[] = [
  "project_admin",
  "planner",
  "field_reporter",
  "viewer",
];

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

export default function Invitations({ orgId, can, myRole, projects }: Props) {
  const [items, setItems] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [orgRole, setOrgRole] = useState<OrgRole>("member");
  const [projectId, setProjectId] = useState("");
  const [projectRole, setProjectRole] = useState<ProjectRole>("field_reporter");
  // The token is returned exactly once, on create. Held here so the admin can
  // copy the link — it is never retrievable again from the list.
  const [freshLink, setFreshLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const allowed = can(CAP.membersManage);
  const grantable: OrgRole[] =
    myRole === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await listOrgInvitations(orgId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invitations.");
    } finally {
      setLoading(false);
    }
  }, [allowed, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-8 text-center">
        <ShieldCheck className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-400">
          Inviting people needs the members:manage capability.
        </p>
      </div>
    );
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("invite");
    setError(null);
    setCopied(false);
    try {
      const created = await createOrgInvitation({
        orgId,
        email: email.trim(),
        orgRole,
        projectId: projectId || undefined,
        projectRole: projectId ? projectRole : undefined,
      });
      if (created.token) {
        setFreshLink({ email: created.email, url: inviteUrl(created.token) });
      }
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that invitation.");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (inv: OrgInvitation) => {
    if (!confirm(`Withdraw the invitation to ${inv.email}?`)) return;
    setBusy(inv.invitation_id);
    setError(null);
    try {
      await revokeOrgInvitation(orgId, inv.invitation_id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw it.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  };

  const pending = items.filter((i) => i.status === "pending");

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form
        onSubmit={invite}
        className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <UserPlus className="w-3.5 h-3.5 text-gray-500" />
          Invite someone — they do not need an account yet
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
          />
          <select
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value as OrgRole)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
          >
            {grantable.map((r) => (
              <option key={r} value={r} className="bg-slate-900">
                {ORG_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        {/* The project grant rides along, because "add them to the company" on its
            own leaves someone who can reach nothing — the most common way the
            two-tier model confuses people. */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
          >
            <option value="" className="bg-slate-900">
              No project access yet
            </option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id} className="bg-slate-900">
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={projectRole}
            disabled={!projectId}
            onChange={(e) => setProjectRole(e.target.value as ProjectRole)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
          >
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r} className="bg-slate-900">
                {PROJECT_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-gray-600">
            Nothing is emailed — you get a link to send them yourself. It grants nothing
            until they accept, and expires in 14 days.
          </p>
          <Button type="submit" disabled={busy === "invite" || !email.trim()} className="shrink-0">
            {busy === "invite" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Create invite
          </Button>
        </div>
      </form>

      {freshLink && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4 space-y-2">
          <p className="text-xs text-blue-200 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            Send this link to {freshLink.email}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[11px] text-gray-300 bg-black/30 rounded-lg px-2.5 py-2 font-mono">
              {freshLink.url}
            </code>
            <Button
              variant="outline"
              onClick={() => void copy(freshLink.url)}
              className="bg-transparent border-white/[0.08] text-gray-300 hover:bg-white/[0.04] text-xs shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            <button
              onClick={() => setFreshLink(null)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            Shown once. The link is a bearer credential — anyone holding it can join as{" "}
            {freshLink.email}, so send it directly rather than posting it in a group.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">
            {items.length} invitation{items.length === 1 ? "" : "s"}
          </span>
          {pending.length > 0 && (
            <span className="text-[10px] text-amber-300/80">
              {pending.length} awaiting a reply
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Nobody has been invited yet.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              People who already have an account can be added directly under People.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((inv) => {
              const Icon = STATUS_ICON[inv.status];
              return (
                <div
                  key={inv.invitation_id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 truncate">{inv.email}</p>
                    <p className="text-[11px] text-gray-500">
                      {ORG_ROLE_LABEL[inv.org_role] ?? inv.org_role}
                      {inv.project_role && (
                        <>
                          {" · "}
                          {PROJECT_ROLE_LABEL[inv.project_role] ?? inv.project_role} on this
                          project
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {inv.status === "accepted" && inv.accepted_at
                        ? `Joined ${new Date(inv.accepted_at).toLocaleDateString()}`
                        : inv.expires_at
                          ? `Expires ${new Date(inv.expires_at).toLocaleDateString()}`
                          : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLE[inv.status]}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {inv.status}
                    </span>
                    {inv.status === "pending" && (
                      <button
                        onClick={() => void revoke(inv)}
                        disabled={busy === inv.invitation_id}
                        title="Withdraw invitation"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {busy === inv.invitation_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        A pending invitation grants nothing — withdrawing one is not the same as removing a
        member, which is why they are separate actions. Re-inviting the same address
        refreshes the existing invitation rather than creating a second live link.
      </p>
    </div>
  );
}
