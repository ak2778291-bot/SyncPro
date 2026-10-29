// The planner's working screen: every field claim the engine refused to commit
// on its own, with the evidence behind it and the three ways to rule on it.
//
// This is also where the product's training data comes from. An approve/reject
// closes a (field-claim -> adjudicated-outcome) tuple that nothing else in the
// system can produce, so the reject path deliberately captures *why* — an
// abandonment and a 40%-overstatement are different signals to the trust engine,
// and collapsing them into one "reject" button would throw that away.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Inbox,
  Loader2,
  MessageSquare,
  RotateCcw,
  ShieldQuestion,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  approveEvent,
  getReviewQueue,
  rejectEvent,
  retractEvent,
  type ReviewQueueItem,
} from "@/shared/api/client";
import { CAP } from "./useProjectCapabilities";
import ConfidenceBar from "./ConfidenceBar";
import ReporterTrustChip from "./ReporterTrustChip";

type Props = {
  projectId: string;
  can: (capability: string) => boolean;
  onChanged?: () => void;
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp_structured: "WhatsApp (form)",
  whatsapp_voice: "WhatsApp (voice)",
  whatsapp_text: "WhatsApp",
  procore_webhook: "Procore",
  autodesk_build: "Autodesk Build",
  csv_upload: "CSV",
  direct: "Direct API",
};

export default function ReviewQueue({ projectId, can, onChanged }: Props) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [abandoned, setAbandoned] = useState(false);
  const [revision, setRevision] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const canAdjudicate = can(CAP.queueAdjudicate);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await getReviewQueue(projectId);
      setItems(rows);
      setSelectedId((prev) =>
        prev && rows.some((r) => r.event_id === prev) ? prev : rows[0]?.event_id ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => items.find((i) => i.event_id === selectedId) ?? null,
    [items, selectedId],
  );

  const resetForm = () => {
    setNotes("");
    setRejectMode(false);
    setAbandoned(false);
    setRevision("");
  };

  const act = async (fn: () => Promise<{ message: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setFlash(res.message || "Done.");
      resetForm();
      await load();
      onChanged?.();
      window.setTimeout(() => setFlash(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading the queue…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flash && (
        <div className="text-xs text-emerald-300 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg px-3 py-2">
          {flash}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
          <Inbox className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">Nothing waiting for review.</p>
          <p className="text-xs text-gray-600 mt-1">
            Field claims that clear the confidence gate commit on their own; everything
            else lands here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-3">
          {/* ── queue list ── */}
          <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">
                {items.length} awaiting review
              </span>
              <button
                onClick={() => void load()}
                className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="max-h-[620px] overflow-y-auto divide-y divide-white/[0.04]">
              {items.map((item) => (
                <button
                  key={item.event_id}
                  onClick={() => {
                    setSelectedId(item.event_id);
                    resetForm();
                  }}
                  className={`w-full text-left px-4 py-3 transition ${
                    item.event_id === selectedId
                      ? "bg-blue-600/[0.08] border-l-2 border-l-blue-500"
                      : "border-l-2 border-l-transparent hover:bg-white/[0.02]"
                  }`}
                >
                  <p className="text-xs text-gray-200 line-clamp-2">{item.raw_text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-500">
                      {CHANNEL_LABEL[item.source_channel ?? ""] ?? item.source_channel ?? "—"}
                    </span>
                    <span className="text-[10px] text-gray-700">•</span>
                    <span className="text-[10px] text-amber-400/80">
                      {(item.resolution_confidence * 100).toFixed(0)}% match
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── evidence + adjudication ── */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.event_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-xl border border-white/[0.06] bg-slate-900 p-5 space-y-5"
              >
                {/* the claim */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1.5">
                    <MessageSquare className="w-3 h-3" />
                    What was reported
                  </div>
                  <p className="text-sm text-gray-100 leading-relaxed">
                    “{selected.raw_text}”
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                    <span>
                      {CHANNEL_LABEL[selected.source_channel ?? ""] ??
                        selected.source_channel ??
                        "unknown channel"}
                    </span>
                    {selected.captured_at && <span>· {selected.captured_at}</span>}
                    {selected.reporter_id && (
                      <ReporterTrustChip
                        projectId={projectId}
                        reporterId={selected.reporter_id}
                        can={can}
                      />
                    )}
                  </div>
                </div>

                {/* why it stopped here */}
                {selected.review_reason && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-amber-200">
                        Why this did not commit on its own
                      </p>
                      <p className="text-[11px] text-amber-200/70 mt-0.5">
                        {selected.review_reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* the match */}
                <div className="rounded-lg border border-white/[0.06] p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <ShieldQuestion className="w-3 h-3" />
                    Matched to this activity
                  </div>
                  {selected.resolved_activity_uid ? (
                    <div>
                      <p className="text-sm text-gray-100">
                        {selected.resolved_activity_name ?? "(name unavailable)"}
                      </p>
                      <p className="text-[11px] text-gray-600 font-mono mt-0.5">
                        UID {selected.resolved_activity_uid}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No activity could be resolved — approving would have nothing to write to.
                    </p>
                  )}

                  <ConfidenceBar
                    label="Activity match"
                    hint="Did we pick the RIGHT activity? Below 70% never auto-commits."
                    value={selected.resolution_confidence}
                    threshold={0.7}
                  />
                  <ConfidenceBar
                    label="Claim credibility"
                    hint="Corroboration across independent sources, predecessors, photos and reporter trust."
                    value={selected.commit_confidence}
                    threshold={0.8}
                  />
                </div>

                {/* actions */}
                {!canAdjudicate ? (
                  <p className="text-[11px] text-gray-500 border-t border-white/[0.06] pt-4">
                    You have read access to this queue. Ruling on a claim requires the
                    <span className="text-gray-400"> queue:adjudicate </span>
                    capability — ask a project admin.
                  </p>
                ) : (
                  <div className="border-t border-white/[0.06] pt-4 space-y-3">
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notes for the audit trail (optional)"
                    />

                    {rejectMode && (
                      <div className="rounded-lg border border-white/[0.06] p-3 space-y-2.5">
                        <p className="text-[11px] text-gray-400">
                          Why is this wrong? This feeds the reporter's trust score, so an
                          honest correction and an abandonment are recorded differently.
                        </p>
                        <label className="flex items-center gap-2 text-[11px] text-gray-300">
                          <input
                            type="checkbox"
                            checked={abandoned}
                            onChange={(e) => setAbandoned(e.target.checked)}
                            className="accent-blue-500"
                          />
                          The activity was abandoned, not progressed
                        </label>
                        <div>
                          <label className="block text-[11px] text-gray-400 mb-1">
                            Downward revision (0–1, e.g. 0.4 if 60% claimed was really 20%)
                          </label>
                          <Input
                            value={revision}
                            onChange={(e) => setRevision(e.target.value)}
                            placeholder="leave blank if not an overstatement"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {!rejectMode ? (
                        <>
                          <Button
                            disabled={busy || !selected.resolved_activity_uid}
                            onClick={() =>
                              void act(() =>
                                approveEvent(projectId, selected.event_id, notes),
                              )
                            }
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Approve &amp; commit
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setRejectMode(true)}
                            className="bg-transparent border-white/[0.08] text-gray-300 hover:bg-white/[0.04]"
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Reject
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                retractEvent(projectId, selected.event_id, notes),
                              )
                            }
                            className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
                          >
                            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                            Retract
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(() =>
                                rejectEvent(projectId, selected.event_id, {
                                  abandoned,
                                  downwardRevisionFraction: revision
                                    ? Number(revision)
                                    : null,
                                  notes,
                                }),
                              )
                            }
                          >
                            {busy ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Confirm rejection
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setRejectMode(false)}
                            className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>

                    <p className="text-[10px] text-gray-600">
                      Your decision is written to the append-only audit log against your
                      user id. Approving writes to the shadow schedule only — the contract
                      programme is never touched.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
