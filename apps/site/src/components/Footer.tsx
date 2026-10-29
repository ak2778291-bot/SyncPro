import { Brand } from "./Brand";
import { CONTACT_EMAIL } from "../lib/waitlist";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop: "1px solid var(--line)" }}>
      <div className="wrap-lg" style={{ paddingBlock: 40 }}>
        <div className="between wrapf gap-6">
          <div style={{ maxWidth: "34ch" }}>
            <Brand />
            <p className="xs dim mt-3 measure">
              The AI project controls engineer for construction.
            </p>
          </div>
          <div className="row gap-6 wrapf">
            <a className="small dim" href="#problem">
              The problem
            </a>
            <a className="small dim" href="#vision">
              What we're building
            </a>
            <a className="small dim" href="#waitlist">
              Early access
            </a>
            <a className="small dim" href={`mailto:${CONTACT_EMAIL}`}>
              Contact
            </a>
          </div>
        </div>
        <div
          className="between wrapf gap-3 mt-8"
          style={{ paddingTop: 20, borderTop: "1px solid var(--line)" }}
        >
          <span className="hint">
            © {year} SyncPro — built for construction project controls.
          </span>
          <span className="hint">
            Directional figures are analyst estimates; not legal advice.
          </span>
        </div>
      </div>
    </footer>
  );
}
