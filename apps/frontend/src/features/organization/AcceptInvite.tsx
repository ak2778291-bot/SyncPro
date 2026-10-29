// The landing page for an invitation link.
//
// Deliberately readable before signing in. Someone handed a link has to be able to
// see *which company is inviting them, to what* before deciding whether to create
// an account — asking them to sign up first and find out afterwards is how invites
// get ignored. The preview endpoint is unauthenticated for exactly this reason and
// returns only the org and project names.
//
// Accepting is separate from previewing and requires a session, because acceptance
// is what actually creates the membership.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Check, Loader2, XCircle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/shared/context/AuthContext";
import { useOrg } from "@/shared/context/OrgContext";
import {
  acceptInvitation,
  peekInvitation,
  type InvitationPreview,
} from "@/shared/api/client";
import {
  ORG_ROLE_LABEL,
  PROJECT_ROLE_LABEL,
} from "@/features/shadow-schedule/useProjectCapabilities";

export default function AcceptInvite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, isLoaded: authLoaded } = useAuth();
  const { refreshOrgs, setActiveOrgId } = useOrg();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    peekInvitation(token)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Invalid link."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setAccepting(true);
    setError(null);
    try {
      await acceptInvitation(token);
      // Land them *in* the org they just joined rather than wherever they were —
      // otherwise someone with their own org accepts an invite and sees no change.
      await refreshOrgs();
      if (preview?.org_id) setActiveOrgId(preview.org_id);
      setDone(true);
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept that invitation.");
    } finally {
      setAccepting(false);
    }
  }, [token, preview, refreshOrgs, setActiveOrgId, navigate]);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-xl border border-white/[0.06] bg-white/[0.02] p-7"
      >
        {children}
      </motion.div>
    </div>
  );

  if (loading || !authLoaded) {
    return shell(
      <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking that link…
      </div>,
    );
  }

  if (error && !preview) {
    return shell(
      <div className="text-center py-4">
        <XCircle className="w-9 h-9 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-300">{error}</p>
        <Link to="/" className="text-xs text-blue-400 hover:text-blue-300 mt-4 inline-block">
          Back to sign in
        </Link>
      </div>,
    );
  }

  if (preview && preview.status !== "pending") {
    const message =
      preview.status === "accepted"
        ? "This invitation has already been used."
        : preview.status === "expired"
          ? "This invitation has expired. Ask for a new one."
          : "This invitation was withdrawn.";
    return shell(
      <div className="text-center py-4">
        <XCircle className="w-9 h-9 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-300">{message}</p>
        <Link to="/dashboard" className="text-xs text-blue-400 hover:text-blue-300 mt-4 inline-block">
          Go to SyncPro
        </Link>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="text-center py-4">
        <Check className="w-9 h-9 text-emerald-400 mx-auto mb-3" />
        <p className="text-sm text-gray-200">You're in. Taking you there…</p>
      </div>,
    );
  }

  return shell(
    <>
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4 text-gray-500" />
        <h1 className="text-lg font-semibold">{preview?.org_name ?? "An organisation"}</h1>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        has invited <span className="text-gray-200">{preview?.email}</span> to join.
      </p>

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-1.5 mb-5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Organisation role</span>
          <span className="text-gray-200">
            {ORG_ROLE_LABEL[preview?.org_role ?? ""] ?? preview?.org_role}
          </span>
        </div>
        {preview?.project_name && (
          <div className="flex justify-between text-xs gap-4">
            <span className="text-gray-500 shrink-0">On</span>
            <span className="text-gray-200 text-right truncate">
              {preview.project_name}
              {preview.project_role && (
                <span className="text-gray-500">
                  {" · "}
                  {PROJECT_ROLE_LABEL[preview.project_role] ?? preview.project_role}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {user ? (
        <>
          <Button onClick={() => void accept()} disabled={accepting} className="w-full">
            {accepting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Accept invitation
          </Button>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            You are signed in as {user.email}
            {user.email.toLowerCase() !== (preview?.email ?? "").toLowerCase() && (
              <>
                {" "}
                — this invite was sent to {preview?.email}, and joining as yourself is
                recorded either way.
              </>
            )}
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 text-center mb-3">
            Sign in or create an account to accept.
          </p>
          <Link to={`/login?next=/invite/${token}`}>
            <Button className="w-full">Sign in</Button>
          </Link>
          <Link to={`/signup?next=/invite/${token}&email=${encodeURIComponent(preview?.email ?? "")}`}>
            <Button
              variant="outline"
              className="w-full bg-transparent border-white/[0.08] text-gray-300 hover:bg-white/[0.04]"
            >
              Create an account
            </Button>
          </Link>
        </div>
      )}
    </>,
  );
}
