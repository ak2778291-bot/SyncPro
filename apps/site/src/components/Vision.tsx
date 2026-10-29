import { Network, ShieldCheck, MessagesSquare } from "lucide-react";
import { useReveal } from "../lib/useReveal";

const PILLARS = [
  {
    icon: <Network className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Know the plan",
    body: "Make the schedule legible — its structure, its risks, and what's about to slip — without hours of manual analysis.",
  },
  {
    icon: <MessagesSquare className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Know reality",
    body: "Bring what's actually happening on site into the same picture as the plan, corroborated against independent evidence.",
  },
  {
    icon: <ShieldCheck className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Run the project",
    body: "Every change leaves a contemporaneous, tamper-evident record — the raw material for a schedule you can defend.",
  },
];

export function Vision() {
  const reveal = useReveal();
  return (
    <section
      id="vision"
      className="wrap-lg section-sm"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div ref={reveal.ref} className={reveal.className}>
        <div className="mb-6" style={{ maxWidth: "620px" }}>
          <div className="eyebrow mb-2">What we're building</div>
          <h2 className="h1">The AI project controls engineer.</h2>
          <p className="body mt-3 measure">
            Not a scheduling tool and not a reporting bot — the intelligence
            layer between unstructured site reality and the schedule, with
            grounded reasoning and an evidence record behind every update.
          </p>
        </div>
        <div className="grid-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="inset"
              style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div className="iconbox brand">{p.icon}</div>
              <div className="h3">{p.title}</div>
              <p className="xs dim">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
