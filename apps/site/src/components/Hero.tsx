import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <header className="wrap-lg" style={{ paddingTop: 88, paddingBottom: 56 }}>
      <div style={{ maxWidth: "62ch" }}>
        <div className="eyebrow mb-4" style={{ letterSpacing: ".06em" }}>
          KNOW THE PLAN · KNOW REALITY · RUN THE PROJECT
        </div>
        <h1 className="display">
          Earn the <span className="it">right</span> to update the construction
          schedule.
        </h1>
        <p className="lead mt-5 measure">
          SyncPro is the AI project controls engineer for construction. It closes
          the gap between the schedule and what actually happens on site — so
          every update is a defensible fact, not a data-entry event.
        </p>
        <div className="row gap-3 mt-8 wrapf">
          <a className="btn btn-primary btn-lg" href="#waitlist">
            Request early access
            <ArrowRight className="ico" />
          </a>
          <a className="btn btn-outline btn-lg" href="#problem">
            Why this matters
          </a>
        </div>
        <div className="status mt-6">
          <span className="sdot sdot-live pulse" /> In active development ·
          onboarding a first cohort of design partners
        </div>
      </div>
    </header>
  );
}
