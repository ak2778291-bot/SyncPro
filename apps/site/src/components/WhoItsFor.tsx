import { HardHat, CalendarClock, ClipboardList, Landmark } from "lucide-react";
import { useReveal } from "../lib/useReveal";

const PERSONAS = [
  {
    icon: <HardHat className="ico" />,
    title: "Project controls lead",
    tag: "Primary user",
    body: "Stop hand-reconciling the schedule. Plan, risk and field reality in one place.",
  },
  {
    icon: <CalendarClock className="ico" />,
    title: "Planner / scheduler",
    body: "Schedule health and fixes, explained in plain English and ranked by impact.",
  },
  {
    icon: <ClipboardList className="ico" />,
    title: "Project manager",
    body: "Plain-English weekly briefings and what's at risk on the critical path.",
  },
  {
    icon: <Landmark className="ico" />,
    title: "Owner / PMO",
    body: "A defensible, tamper-evident record across the whole portfolio.",
  },
];

export function WhoItsFor() {
  const reveal = useReveal();
  return (
    <section
      id="who"
      className="wrap-lg section-sm"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div ref={reveal.ref} className={reveal.className}>
        <div className="eyebrow mb-2">Who it's for</div>
        <h2 className="h1 mb-6">
          Built first for the person drowning in schedule reconciliation.
        </h2>
        <div className="persona">
          {PERSONAS.map((p) => (
            <div key={p.title}>
              <div className="iconbox brand mb-3">{p.icon}</div>
              <div className="h4">{p.title}</div>
              {p.tag && (
                <span className="tag tag-brand" style={{ margin: "6px 0" }}>
                  {p.tag}
                </span>
              )}
              <p className="xs dim mt-1">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
