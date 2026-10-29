// Who is asking to get in, and what to do about it.
//
// The mirror of Invitations.tsx: that screen answers "who has been offered
// access"; this one answers "who is asking for it". Structurally similar for
// the same reason the two backend flows are similar — same underlying
// problem (get someone into an org without the founder doing it by hand),
// approached from opposite directions.
//
// Approving is always a human action. Nothing here ever grants membership on
// its own — a request only exists because SyncPro matched the requester's
// email domain against your org's own *verified* members, and matching is a
// signal worth looking at, not a credential worth trusting blindly (a
// domain proves someone can receive mail there, not that they should be
// inside a workspace holding live schedules and counter-party trust scores).
import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, ShieldCheck, UserCheck, X, XCircle } from "lucide-react";
import {
  approveOrgJoinRequest,
  denyOrgJoinRequest,
  listOrgJoinRequests,
  type OrgJoinRequest,
} from "@/shared/api/client";
import { CAP } from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  orgId: string;
  can: (capability: string) => boolean;
};

const STATUS_STYLE: Record<OrgJoinRequest["status"], string> = {
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  approved: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  denied: "text-gray-500 bg-white/[0.03] border-white/[0.08]",
  withdrawn: "text-gray-500 bg-white/[0.03] border-white/[0.08]",
};

const STATUS_ICON: Record<OrgJoinRequest["status"], typeof Clock> = {
  pending: Clock,
  approved: Check,
  denied: XCircle,
  withdrawn: XCircle,
};

export default function JoinRequests({ orgId, can }: Props) {
  const [items, setItems] = useState<OrgJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = can(CAP.membersManage);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await listOrgJoinRequests(orgId);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load join requests.");
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
          Reviewing join requests needs the members:manage capability.
        </p>
      </div>
    );
  }

  const decide = async (req: OrgJoinRequest, approve: boolean) => {
    if (approve && !confirm(`Add ${req.user_email ?? "this person"} to the organisation?`)) return;
    setBusy(req.request_id);
    setError(null);
    try {
      if (approve) {
        await approveOrgJoinRequest(orgId, req.request_id);
      } else {
        await denyOrgJoinRequest(orgId, req.request_id);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record that decision.");
    } finally {
      setBusy(null);
    }
  };

  const pending = items.filter((r) => r.status === "pending");

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">
            {items.length} join request{items.length === 1 ? "" : "s"}
          </span>
          {pending.length > 0 && (
            <span className="text-[10px] text-amber-300/80">{pending.length} awaiting a decision</span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <UserCheck className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Nobody has asked to join yet.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              When someone signs up with an email domain matching a verified member here,
              they can ask to join instead of creating a second organisation — they'll show
              up in this list.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((req) => {
              const Icon = STATUS_ICON[req.status];
              return (
                <div key={req.request_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 truncate">
                      {req.user_name || req.user_email || "Someone"}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{req.user_email}</p>
                    <p className="text-[10px] text-gray-600">
                      Matched on @{req.domain}
                      {req.requested_at && ` · asked ${new Date(req.requested_at).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLE[req.status]}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {req.status}
                    </span>
                    {req.status === "pending" && (
                      <>
                        <button
                          onClick={() => void decide(req, true)}
                          disabled={busy === req.request_id}
                          title="Approve — adds them as a member"
                          className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                        >
                          {busy === req.request_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => void decide(req, false)}
                          disabled={busy === req.request_id}
                          title="Deny"
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        Approving adds them as a member, not an admin — upgrade their role under People if
        warranted. Denying leaves no trace of membership; they can ask again if it was a
        mistake.
      </p>
    </div>
  );
}
