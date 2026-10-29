// "Confirm your email" — a banner, never a modal.
//
// Verification gates two capabilities (creating an organisation, and domain
// discovery once it exists), not access. A modal would make a transactional email
// arriving a precondition for using the product at all, which turns every delayed
// or spam-filtered message into a support ticket. A banner states the cost of not
// doing it and lets the person carry on.
//
// See `docs/architecture/02_Shadow_Schedule_Engine/frontend_docs/UX_FLOW.md` §8.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, MailWarning, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useAuth } from "@/shared/context/AuthContext";
import { confirmEmailCode, requestEmailCode } from "@/shared/api/client";

export default function VerifyEmailBanner() {
  const { user, markEmailVerified } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user || user.email_verified || dismissed || done) return null;

  const send = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await requestEmailCode();
      setOpen(true);
      setNote(`Sent to ${user.email}. It expires in ${r.expires_in_minutes} minutes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmEmailCode(code.trim());
      // Synchronous, not a re-fetch: the confirm call above already proved
      // the account is verified. A second round-trip to re-derive that fact
      // could silently fail (see AuthContext.refreshUser's swallowed catch)
      // and leave the *global* user stale while this screen — via `done` —
      // wrongly looked verified, which is exactly what showed the banner
      // again on a fresh mount elsewhere (the Organisation tab) afterward.
      markEmailVerified();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm that code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5 min-w-0">
            <MailWarning className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm text-amber-100">Confirm your email address</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Everything works without it except creating a new organisation — that
                treats your address as proof of who you work for.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!open && (
              <Button onClick={() => void send()} disabled={busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Send me a code
              </Button>
            )}
            <button
              onClick={() => setDismissed(true)}
              title="Hide for now"
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-3 pl-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && code.trim() && void confirm()}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="w-36"
              />
              <Button onClick={() => void confirm()} disabled={busy || !code.trim()}>
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                Confirm
              </Button>
              <button
                onClick={() => void send()}
                disabled={busy}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                Resend
              </button>
            </div>
            {note && <p className="text-[11px] text-gray-400">{note}</p>}
          </div>
        )}

        {error && <p className="text-[11px] text-red-300 mt-2 pl-6">{error}</p>}
      </motion.div>
    </AnimatePresence>
  );
}
