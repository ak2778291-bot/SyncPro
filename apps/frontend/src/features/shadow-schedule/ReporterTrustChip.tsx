// Counter-party trust, shown at whatever grade the caller is entitled to.
//
// The server returns two different shapes: a numeric score for org/project
// admins, a qualitative band for planners. This renders whichever arrived and
// never asks for more — a trust score is an assessment of a named subcontractor,
// and showing it to the wrong person turns an internal signal into a commercial
// dispute. Callers without either capability get a 403, which renders as nothing.
import { useEffect, useState } from "react";
import { getReporterTrust } from "@/shared/api/client";
import { CAP } from "./useProjectCapabilities";

type Props = {
  projectId: string;
  reporterId: string;
  can: (capability: string) => boolean;
};

const BAND_STYLE: Record<string, string> = {
  established: "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/20",
  calibrating: "text-sky-300 bg-sky-500/[0.08] border-sky-500/20",
  watch: "text-amber-300 bg-amber-500/[0.08] border-amber-500/20",
};

const BAND_HINT: Record<string, string> = {
  established: "Track record of accurate reports.",
  calibrating: "Too few reports yet to judge — score is withheld, not applied.",
  watch: "Reports have needed material downward correction.",
};

export default function ReporterTrustChip({ projectId, reporterId, can }: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [band, setBand] = useState<string>("calibrating");

  const allowed = can(CAP.trustRead) || can(CAP.trustReadBand);

  useEffect(() => {
    if (!allowed) {
      setLabel(null);
      return;
    }
    let cancelled = false;
    getReporterTrust(projectId, reporterId)
      .then((t) => {
        if (cancelled) return;
        if ("trust_current" in t) {
          const derived = t.calibration_active
            ? "calibrating"
            : t.trust_current < 0.4
              ? "watch"
              : "established";
          setBand(derived);
          setLabel(`trust ${(t.trust_current * 100).toFixed(0)}%`);
          setTitle(
            `${t.events_observed} reports observed. ${
              t.calibration_active
                ? "Still inside the calibration window — the score is computed but not applied to routing."
                : BAND_HINT[derived]
            }`,
          );
        } else {
          setBand(t.band);
          setLabel(t.band);
          setTitle(BAND_HINT[t.band] ?? "");
        }
      })
      .catch(() => {
        // 403/404 — not entitled, or no such reporter on this project. Show nothing
        // rather than an error: absence is the correct rendering of "not for you".
        if (!cancelled) setLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, projectId, reporterId]);

  if (!label) return null;

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${
        BAND_STYLE[band] ?? BAND_STYLE.calibrating
      }`}
    >
      {label}
    </span>
  );
}
