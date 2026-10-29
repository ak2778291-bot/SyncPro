import { Server, TrainFront, Building2, Factory } from "lucide-react";
import { useReveal } from "../lib/useReveal";

const SECTORS = [
  {
    icon: <Server className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Data centers",
    body: "Hyperscale fit-out, fast cycles, heavy MEP logic.",
  },
  {
    icon: <TrainFront className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Infrastructure & rail",
    body: "Long programmes, claims exposure, public scrutiny.",
  },
  {
    icon: <Building2 className="ico" style={{ color: "var(--text-3)" }} />,
    title: "High-rise & commercial",
    body: "Repeating floor cycles ideal for line-of-balance.",
  },
  {
    icon: <Factory className="ico" style={{ color: "var(--text-3)" }} />,
    title: "Industrial & energy",
    body: "Megaprojects where 40%+ run late.",
  },
];

export function Sectors() {
  const reveal = useReveal();
  return (
    <section className="wrap-lg section-sm">
      <div ref={reveal.ref} className={reveal.className}>
        <div className="mb-5">
          <div className="eyebrow mb-2">Where it works</div>
          <h2 className="h2">Schedule-intensive, dispute-prone delivery.</h2>
        </div>
        <div className="sectors">
          {SECTORS.map((s) => (
            <div key={s.title}>
              {s.icon}
              <div className="h4">{s.title}</div>
              <div className="xs dim">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
