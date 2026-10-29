import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  submitWaitlist,
  type WaitlistKind,
  type WaitlistPayload,
} from "../lib/waitlist";

const EMPTY: WaitlistPayload = {
  kind: "early-access",
  name: "",
  email: "",
  company: "",
  role: "",
  message: "",
};

export function Waitlist() {
  const [form, setForm] = useState<WaitlistPayload>(EMPTY);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const set = (k: keyof WaitlistPayload, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setKind = (kind: WaitlistKind) => setForm((f) => ({ ...f, kind }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await submitWaitlist(form);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const isInvestor = form.kind === "investor";

  return (
    <section id="waitlist" className="wrap-sm section">
      <div className="form-card">
        {status === "done" ? (
          <div className="row gap-3" style={{ alignItems: "flex-start" }}>
            <CheckCircle2 className="ico" style={{ color: "var(--success)" }} />
            <div>
              <h3 className="h2">You're on the list.</h3>
              <p className="body mt-2 measure">
                Thanks — we'll be in touch as we open up the first cohort. If you
                have a live project you'd like us to look at, just reply to our
                email.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="eyebrow mb-2">Get early access</div>
            <h2 className="h1">
              Be first to put SyncPro on a live project.
            </h2>
            <p className="body mt-2 mb-6 measure">
              Tell us a little about your work. We're onboarding a small first
              cohort of design partners and reviewing every request personally.
            </p>

            <div className="seg mb-6" role="tablist" aria-label="Enquiry type">
              <button
                type="button"
                role="tab"
                aria-selected={!isInvestor}
                onClick={() => setKind("early-access")}
              >
                I run / support projects
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isInvestor}
                onClick={() => setKind("investor")}
              >
                Investor / advisor
              </button>
            </div>

            <form onSubmit={onSubmit} className="stack-lg">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">Work email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="jane@company.com"
                  />
                </div>
                <div className="field">
                  <label htmlFor="company">Company</label>
                  <input
                    id="company"
                    value={form.company}
                    onChange={(e) => set("company", e.target.value)}
                    placeholder={isInvestor ? "Fund / firm" : "GC / contractor"}
                  />
                </div>
                <div className="field">
                  <label htmlFor="role">Role</label>
                  <input
                    id="role"
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    placeholder={
                      isInvestor ? "Partner" : "Project controls lead"
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="message">
                  {isInvestor
                    ? "What would you like to know?"
                    : "Anything about your projects? (optional)"}
                </label>
                <textarea
                  id="message"
                  rows={3}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder={
                    isInvestor
                      ? "Stage, focus, how you'd like to engage…"
                      : "Schedule formats, portfolio size, where it hurts…"
                  }
                />
              </div>

              {status === "error" && (
                <p className="xs" style={{ color: "var(--danger)" }}>
                  Something went wrong sending that. Please email{" "}
                  <a className="t-brand" href="mailto:founders@syncpro.org">
                    founders@syncpro.org
                  </a>{" "}
                  instead.
                </p>
              )}

              <div className="row between wrapf gap-3">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Sending…" : "Request early access"}
                  <ArrowRight className="ico" />
                </button>
                <span className="hint">
                  No spam. We'll only use this to get in touch about SyncPro.
                </span>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
