// Who belongs to the organisation, and at what level.
//
// Org membership is the isolation boundary: a project role can only be granted to
// someone who is already an org member, so this screen is the first step for every
// person who will ever touch a project here.
//
// Two rules the backend enforces and this UI has to make legible rather than hide:
//   * an `admin` can invite up to `admin`, never to `owner` — privilege escalation
//     requires an owner, so the owner option is withheld from admins;
//   * an org must always keep at least one active owner, so demoting or removing
//     the last one is refused. The error is surfaced verbatim rather than
//     pre-empted, because the server is the only thing that knows the live count.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  addOrgMember,
  listOrgMembers,
  removeOrgMember,
  setOrgMemberRole,
  type OrgMember,
  type OrgRole,
} from "@/shared/api/client";
import { CAP, ORG_ROLE_LABEL } from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  orgId: string;
  can: (capability: string) => boolean;
  /** The caller's own role — decides which roles they may grant. */
  myRole: OrgRole;
  myUserId: string | null;
};

const ROLE_HINT: Record<string, string> = {
  owner: "Everything, including contract mode and deleting projects.",
  admin: "Runs the org day to day. Cannot flip contract mode or delete a project.",
  member: "Belongs to the company. Reaches a project only if given a project role.",
};

export default function OrgMembers({ orgId, can, myRole, myUserId }: Props) {
  const [items, setItems] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const allowed = can(CAP.membersManage);

  // An admin may grant up to admin; only an owner can create another owner.
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
      const { items: rows } = await listOrgMembers(orgId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the member list.");
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
        <p className="text-sm text-gray-400">Managing people needs the members:manage capability.</p>
        <p className="text-xs text-gray-600 mt-1">
          Ask an owner or admin of this organisation.
        </p>
      </div>
    );
  }

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("invite");
    setError(null);
    try {
      await addOrgMember(orgId, email.trim(), role);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that person.");
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (userId: string, next: OrgRole) => {
    setBusy(userId);
    setError(null);
    try {
      await setOrgMemberRole(orgId, userId, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that role.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: OrgMember) => {
    if (
      !confirm(
        `Remove ${m.email || m.user_id} from this organisation?\n\n` +
          "This also removes their access to every project in it.",
      )
    ) {
      return;
    }
    setBusy(m.user_id);
    setError(null);
    try {
      await removeOrgMember(orgId, m.user_id);
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
        onSubmit={invite}
        className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <UserPlus className="w-3.5 h-3.5 text-gray-500" />
          Add someone to this organisation
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
            onChange={(e) => setRole(e.target.value as OrgRole)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
          >
            {grantable.map((r) => (
              <option key={r} value={r} className="bg-slate-900">
                {ORG_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy === "invite" || !email.trim()}>
            {busy === "invite" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : null}
            Add
          </Button>
        </div>
        <p className="text-[10px] text-gray-600">
          {ROLE_HINT[role]} They must already have a SyncPro account — invitations for
          unregistered emails are not built yet, so ask them to sign up first.
        </p>
      </form>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-gray-300">{items.length} people</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Nobody here yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((m) => {
              const isMe = m.user_id === myUserId;
              return (
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
                        {isMe && <span className="ml-2 text-[10px] text-gray-600">you</span>}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        {m.email || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.org_role}
                      disabled={busy === m.user_id}
                      onChange={(e) => void changeRole(m.user_id, e.target.value as OrgRole)}
                      className="rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-gray-300 px-2 py-1.5 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                    >
                      {/* Their current role always stays selectable, even if this
                          caller could not grant it — an admin must be able to see
                          that someone is an owner without being offered the power
                          to make one. */}
                      {Array.from(new Set([...grantable, m.org_role])).map((r) => (
                        <option
                          key={r}
                          value={r}
                          disabled={!grantable.includes(r as OrgRole)}
                          className="bg-slate-900"
                        >
                          {ORG_ROLE_LABEL[r] ?? r}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void remove(m)}
                      disabled={busy === m.user_id}
                      title="Remove from organisation"
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
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        Removing someone here cascades to every project in this organisation — offboarding
        is one action, so a departed colleague cannot keep approving commits on projects
        they were assigned to. The organisation must always keep at least one owner.
      </p>
    </div>
  );
}
