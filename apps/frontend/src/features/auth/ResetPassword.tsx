// Password reset — two steps, one screen: request a code, then use it.
//
// Unlike Signup's confirm-password field, this form does not need one. Confirm
// Password exists there only because a mistyped password was, until this screen
// shipped, unrecoverable (see `frontend_docs/UX_FLOW.md` F6). Here a typo is
// self-healing — request another code — so a show/hide toggle covers the same
// risk without a duplicate field. (Dropping Confirm Password from Signup itself
// is a separate, not-yet-done item: UX_FLOW.md build-order item 13.)
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { confirmPasswordReset, requestPasswordReset } from "@/shared/api/client";

type Step = "request" | "confirm" | "done";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await requestPasswordReset(email.trim());
      setNote(r.message);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a code.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(email.trim(), code.trim(), newPassword);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await requestPasswordReset(email.trim());
      setNote(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend a code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-sm"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">SyncPro</span>
        </Link>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-7">
          {step === "request" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Reset your password</h1>
              <p className="text-sm text-gray-400 mb-6">
                Enter your account email and we'll send you a code.
              </p>

              <form onSubmit={requestCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">Email</label>
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <Button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send me a code"}
                </Button>
              </form>
            </>
          )}

          {step === "confirm" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Check your code</h1>
              <p className="text-sm text-gray-400 mb-1">
                Enter the code sent to <span className="text-gray-200">{email}</span> and choose a
                new password.
              </p>
              {note && <p className="text-[11px] text-gray-500 mb-4">{note}</p>}

              <form onSubmit={resetPassword} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">6-digit code</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">New password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <Button type="submit" disabled={busy} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
                </Button>

                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <button type="button" onClick={() => setStep("request")} className="hover:text-gray-300">
                    Use a different email
                  </button>
                  <button type="button" onClick={() => void resend()} disabled={busy} className="hover:text-gray-300 disabled:opacity-50">
                    Resend code
                  </button>
                </div>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-4">
              <Check className="w-9 h-9 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-200 mb-1">Your password has been reset.</p>
              <p className="text-xs text-gray-500 mb-5">Sign in with your new password.</p>
              <Button onClick={() => navigate("/login", { replace: true })} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                Go to sign in
              </Button>
            </div>
          )}

          {step !== "done" && (
            <p className="text-sm text-gray-400 text-center mt-6">
              Remembered it?{" "}
              <Link to="/login" className="text-blue-400 hover:text-blue-300">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
