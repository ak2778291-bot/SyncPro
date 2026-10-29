// Account settings — the `@you` menu's destination (UX_FLOW §4.1, build item 8).
//
// Scope is deliberate. This holds the things that belong to *you*, not to a
// company: your name, your handle, your password, and the invitations and
// join requests addressed to you. Anything org-scoped stays on the
// Organisation screen — that separation is the whole point of §1's three
// scopes, and putting "leave this organisation" here would quietly merge two
// of them again.
//
// Three things are deliberately absent:
//
//   * **Changing your email.** It is the identity key for invitations, for
//     join-request domain matching, and for sign-in. Changing it silently
//     re-points all three, so it needs a verify-the-new-address flow of its
//     own rather than a text box here.
//   * **Deleting your account.** A one-way door that cascades into evidence
//     records the same way deleting an organisation does, and it deserves the
//     same considered design rather than a corner of this page.
//   * **Notifications, theme, 2FA.** No infrastructure behind any of them yet;
//     they would be controls that do nothing.
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useAuth } from "@/shared/context/AuthContext";
import { useOrg } from "@/shared/context/OrgContext";
import {
  acceptInvitation,
  cancelMyJoinRequest,
  changePassword,
  getMyInvitations,
  getMyJoinRequests,
  updateProfile,
  type OrgJoinRequest,
} from "@/shared/api/client";
import { ORG_ROLE_LABEL } from "@/features/shadow-schedule/useProjectCapabilities";
import VerifyEmailBanner from "@/features/auth/VerifyEmailBanner";

type Invite = {
  invitation_id: string;
  org_name: string | null;
  org_role: string;
  token?: string;
};

export default function Profile() {
  const { user, markProfileUpdated } = useAuth();
  const { orgs, refreshOrgs } = useOrg();

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<OrgJoinRequest[]>([]);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // A Google account has no password to change. Checked here so the section
  // explains itself rather than letting someone fill in a form the server
  // will refuse.
  const isGoogleOnly = user?.provider === "google";

  useEffect(() => {
    setName(user?.name ?? "");
    setUsername(user?.username ?? "");
  }, [user?.name, user?.username]);

  const loadPending = useCallback(async () => {
    try {
      const [inv, req] = await Promise.all([getMyInvitations(), getMyJoinRequests()]);
      setInvites(inv.items ?? []);
      setRequests(req.items ?? []);
    } catch {
      setInvites([]);
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      const { user: fresh } = await updateProfile({
        name: name.trim(),
        username: username.trim(),
      });
      markProfileUpdated(fresh);
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setProfileBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    setPwBusy(true);
    setPwError(null);
    setPwDone(false);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPwDone(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setPwBusy(false);
    }
  };

  const accept = async (token: string) => {
    setPendingBusy(token);
    setPendingError(null);
    try {
      await acceptInvitation(token);
      await Promise.all([refreshOrgs(), loadPending()]);
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : "Could not accept that.");
    } finally {
      setPendingBusy(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setPendingBusy(requestId);
    setPendingError(null);
    try {
      await cancelMyJoinRequest(requestId);
      await loadPending();
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : "Could not cancel that.");
    } finally {
      setPendingBusy(null);
    }
  };

  if (!user) return null;

  const card = "rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3";

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-gray-500" />
          Your account
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Settings that belong to you, not to any one organisation.
        </p>
      </div>

      {!user.email_verified && <VerifyEmailBanner />}

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <form onSubmit={saveProfile} className={card}>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <UserCircle className="w-3.5 h-3.5 text-gray-500" />
          Profile
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[10px] text-gray-600">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] text-gray-600">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-handle"
              required
            />
            <p className="text-[10px] text-gray-600">
              Letters, numbers and single hyphens. You can sign in with this instead of
              your email.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] text-gray-600">Email</label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={user.email} disabled className="max-w-xs opacity-70" />
            {user.email_verified ? (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="text-[10px] text-amber-300">Not verified</span>
            )}
          </div>
          <p className="text-[10px] text-gray-600">
            Your email can't be changed here — it identifies you to invitations, to the
            organisations that match your company domain, and at sign-in. Ask support if
            you need it moved.
          </p>
        </div>

        {profileError && <p className="text-xs text-red-400">{profileError}</p>}

        <div className="flex items-center justify-end gap-2">
          {profileSaved && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          )}
          <Button type="submit" disabled={profileBusy || !name.trim() || !username.trim()}>
            {profileBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>

      {/* ── Password ────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <KeyRound className="w-3.5 h-3.5 text-gray-500" />
          Password
        </div>

        {isGoogleOnly ? (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <p className="text-xs text-gray-400">You sign in with Google.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              There's no SyncPro password on this account to change.
            </p>
          </div>
        ) : (
          <form onSubmit={savePassword} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] text-gray-600">Current password</label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] text-gray-600">New password</label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((v) => !v)}
                    title={showPasswords ? "Hide passwords" : "Show passwords"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {pwError && <p className="text-xs text-red-400">{pwError}</p>}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] text-gray-600">
                Your current password is required — being signed in isn't proof of who's
                at the keyboard.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {pwDone && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Changed
                  </span>
                )}
                <Button
                  type="submit"
                  disabled={pwBusy || !currentPassword || newPassword.length < 8}
                >
                  {pwBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  Change password
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── Invitations & join requests ─────────────────────────────────── */}
      {/* These live here because they are addressed to *you*, and because the
          onboarding screen that used to be their only home is unreachable once
          you belong to an organisation — so a request to join a second one had
          nowhere to be tracked. */}
      {(invites.length > 0 || requests.length > 0) && (
        <div className={card}>
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <Mail className="w-3.5 h-3.5 text-gray-500" />
            Waiting on you
          </div>

          {pendingError && <p className="text-xs text-red-400">{pendingError}</p>}

          {invites.map((inv) => (
            <div
              key={inv.invitation_id}
              className="rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-gray-100 truncate">
                  {inv.org_name ?? "An organisation"}
                </p>
                <p className="text-[10px] text-gray-400">
                  Invited as {ORG_ROLE_LABEL[inv.org_role] ?? inv.org_role}
                </p>
              </div>
              <Button
                disabled={!inv.token || pendingBusy === inv.token}
                onClick={() => inv.token && void accept(inv.token)}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                {pendingBusy === inv.token ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          ))}

          {requests.map((req) => (
            <div
              key={req.request_id}
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-gray-100 truncate">
                  {req.org_name ?? "An organisation"}
                </p>
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Waiting for an admin there to approve
                </p>
              </div>
              <Button
                variant="outline"
                disabled={pendingBusy === req.request_id}
                onClick={() => void cancelRequest(req.request_id)}
                className="shrink-0 bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] text-xs"
              >
                {pendingBusy === req.request_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Cancel"
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Organisations ───────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          Your organisations
        </div>
        {orgs.length === 0 ? (
          <p className="text-xs text-gray-500">You don't belong to an organisation yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {orgs.map((o) => (
              <div key={o.org_id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-200 truncate">{o.name}</span>
                <span className="text-[10px] text-gray-500 shrink-0 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-gray-600" />
                  {ORG_ROLE_LABEL[o.org_role] ?? o.org_role}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-600">
          People and settings for each organisation live on its own screen — this is just
          where you belong and as what.
        </p>
      </div>
    </motion.div>
  );
}
