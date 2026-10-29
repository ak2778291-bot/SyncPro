// The safety switch, and the calibration status that gives its numbers meaning.
//
// `proposal_only` means nothing is written without a human ruling on it.
// `standard` lets a claim that clears the gate commit by itself. That is the
// highest-consequence setting in the product — it permits an algorithm to write
// to a schedule a delay claim may later rest on — so it is owner-only and asks
// for a typed confirmation. Switching while the queue is dirty is refused by the
// server unless forced, because queued proposals would otherwise silently begin
// auto-committing.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  getCalibration,
  getContractMode,
  setContractMode,
  type CalibrationInfo,
  type ContractModeConfig,
} from "@/shared/api/client";
import { CAP } from "./useProjectCapabilities";

type Props = {
  projectId: string;
  can: (capability: string) => boolean;
  pendingCount: number;
  onChanged?: () => void;
};

const CONFIRM_PHRASE = "ENABLE AUTO-COMMIT";

export default function ContractModeCard({
  projectId,
  can,
  pendingCount,
  onChanged,
}: Props) {
  const [config, setConfig] = useState<ContractModeConfig | null>(null);
  const [calibration, setCalibration] = useState<CalibrationInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const allowed = can(CAP.contractModeSet);

  const load = useCallback(async () => {
    try {
      const [cfg, cal] = await Promise.all([
        getContractMode(projectId),
        getCalibration(projectId).catch(() => null),
      ]);
      setConfig(cfg);
      setCalibration(cal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load contract mode.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (mode: "proposal_only" | "standard", force = false) => {
    setBusy(true);
    setError(null);
    try {
      setConfig(await setContractMode(projectId, mode, force));
      setConfirming(false);
      setTyped("");
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change contract mode.");
    } finally {
      setBusy(false);
    }
  };

  if (!config) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-5 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-2" /> Loading…
      </div>
    );
  }

  const isProposalOnly = config.contract_mode === "proposal_only";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-100">Contract mode</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Whether a confident claim may commit without a human.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              isProposalOnly
                ? "text-emerald-300 bg-emerald-500/[0.08] border-emerald-500/20"
                : "text-amber-300 bg-amber-500/[0.08] border-amber-500/20"
            }`}
          >
            {isProposalOnly ? "Proposal only" : "Standard (auto-commit)"}
          </span>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {isProposalOnly
            ? "Nothing is written to the shadow schedule until a planner approves it. This is the safe default and the right setting for any project whose programme may end up in a dispute."
            : "Claims that clear both confidence gates commit on their own. Everything below the gate still comes to the review queue."}
        </p>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!allowed ? (
          <div className="flex items-start gap-2 border-t border-white/[0.06] pt-4">
            <Lock className="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-500">
              Only an organisation <span className="text-gray-400">owner</span> can change
              this. It sits with whoever carries commercial liability, not with whoever
              administers the project.
            </p>
          </div>
        ) : isProposalOnly ? (
          <div className="border-t border-white/[0.06] pt-4 space-y-3">
            {!confirming ? (
              <Button
                variant="outline"
                onClick={() => setConfirming(true)}
                className="bg-transparent border-amber-500/30 text-amber-300 hover:bg-amber-500/[0.06]"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                Enable auto-commit…
              </Button>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-amber-200/90 space-y-1">
                    <p>
                      This permits the engine to write to the shadow schedule with no human
                      in the loop. The change is recorded in the audit log against your
                      user id.
                    </p>
                    {pendingCount > 0 && (
                      <p className="text-amber-200">
                        {pendingCount} claim{pendingCount === 1 ? " is" : "s are"} queued
                        right now. Switching will be refused unless you force it — those
                        proposals would otherwise start committing silently.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-amber-200/70 mb-1">
                    Type <code className="text-amber-200">{CONFIRM_PHRASE}</code> to confirm
                  </label>
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || typed !== CONFIRM_PHRASE}
                    onClick={() => void change("standard", false)}
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Enable
                  </Button>
                  {pendingCount > 0 && (
                    <Button
                      variant="outline"
                      disabled={busy || typed !== CONFIRM_PHRASE}
                      onClick={() => void change("standard", true)}
                      className="bg-transparent border-amber-500/30 text-amber-300 hover:bg-amber-500/[0.06]"
                    >
                      Enable and accept the {pendingCount} queued
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConfirming(false);
                      setTyped("");
                    }}
                    className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-white/[0.06] pt-4">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void change("proposal_only")}
              className="bg-transparent border-white/[0.08] text-gray-300 hover:bg-white/[0.04]"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Return to proposal-only
            </Button>
          </div>
        )}
      </div>

      {/* Calibration — what the confidence numbers actually mean. */}
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-5">
        <h3 className="text-sm font-medium text-gray-100">Confidence calibration</h3>
        {calibration && calibration.calibrated ? (
          <div className="mt-2 space-y-1 text-xs text-gray-400">
            <p>
              Fitted on {calibration.n_examples} labelled examples
              {calibration.precision_at_threshold != null && (
                <>
                  {" "}
                  — precision at the {((calibration.threshold ?? 0.8) * 100).toFixed(0)}%
                  gate is {(calibration.precision_at_threshold * 100).toFixed(0)}%
                </>
              )}
              .
            </p>
            <p className="text-[11px] text-gray-600">
              Commit confidence is a real probability on this project.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-400">
              No curve fitted yet — commit confidence is a raw score, not a probability.
            </p>
            <p className="text-[11px] text-gray-600">
              The system says so rather than dressing the number up. Fitting is a platform
              operation performed against held-out ground truth, so that a confidence
              figure means the same thing for every customer; no tenant role can change it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
