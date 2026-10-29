import { useReveal } from "../lib/useReveal";

const FIGURES = [
  { v: "$1.85T", l: "lost annually to bad data" },
  { v: "98%", l: "of megaprojects overrun" },
  { v: "12%", l: "of baselines pass quality" },
  { v: "$60M", l: "average dispute value" },
];

export function Problem() {
  const reveal = useReveal();
  return (
    <section id="problem" className="wrap-lg section-sm">
      <div ref={reveal.ref} className={reveal.className}>
        <div className="inset" style={{ padding: 34 }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "1.1fr 1fr",
              gap: 44,
              alignItems: "center",
            }}
          >
            <div>
              <div className="eyebrow mb-2">The wound</div>
              <h2 className="h1">
                The plan-to-reality loop is where schedules break — and where
                software hasn't gone.
              </h2>
              <p className="body mt-3 measure">
                The schedule reflects intent. The field knows what happened.
                Nothing in between translates one to the other in real time,
                grounded, for the live project. SyncPro closes that loop.
              </p>
            </div>
            <div className="row gap-8 wrapf">
              {FIGURES.map((f) => (
                <div key={f.v}>
                  <div className="figure">{f.v}</div>
                  <div className="xs dim mt-1">
                    {f.l}
                    <sup>*</sup>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="hint mt-3">
          <sup>*</sup> Directional analyst estimates — McKinsey Global Institute,
          Autodesk/FMI, Arcadis, SmartPM.
        </p>
      </div>
    </section>
  );
}
