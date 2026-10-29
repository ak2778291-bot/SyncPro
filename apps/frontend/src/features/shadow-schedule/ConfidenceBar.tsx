// A confidence reading with its gate marked on the track.
//
// The gate matters more than the number: a planner needs to see *how far short*
// a claim fell, not just that it fell short. The marker is drawn at the threshold
// so the distance is readable at a glance.
type Props = {
  label: string;
  hint?: string;
  /** 0–1. */
  value: number;
  /** 0–1. The line below which the engine will not auto-commit. */
  threshold: number;
};

export default function ConfidenceBar({ label, hint, value, threshold }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const gate = Math.max(0, Math.min(1, threshold)) * 100;
  const clears = value >= threshold;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-gray-400">{label}</span>
        <span
          className={`text-[11px] font-medium tabular-nums ${
            clears ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {pct.toFixed(0)}%
          <span className="text-gray-600 font-normal"> / {gate.toFixed(0)}% needed</span>
        </span>
      </div>

      <div className="relative h-1.5 mt-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full ${clears ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Gate marker sits outside the clipped track so it stays visible at 0%. */}
      <div className="relative h-0">
        <div
          className="absolute -top-1.5 w-px h-1.5 bg-gray-400/70"
          style={{ left: `${gate}%` }}
          aria-hidden
        />
      </div>

      {hint && <p className="text-[10px] text-gray-600 mt-1.5">{hint}</p>}
    </div>
  );
}
