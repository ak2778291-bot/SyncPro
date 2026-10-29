// The Report half of the chat composer — field evidence, not a question.
//
// Two modes rather than one box that guesses. "is the footing done?" and "the
// footing is done" differ by one word and by everything: a classifier that gets it
// wrong either injects false evidence into an audit chain or silently swallows a
// real report. The same reasoning that refuses to infer a project from message
// content (Org/Workspace §8) refuses to infer intent from it.
//
// The activity picker is optional but load-bearing when used: naming the activity
// yourself skips disambiguation entirely (`web_selected`, 0.97) because there is
// nothing left to guess about *which* activity you meant. What stays uncertain is
// the claim, and corroboration scores that separately.
//
// Search runs server-side. A real programme here is ~15,000 activities, so
// shipping the whole list to filter it in the browser would be a multi-megabyte
// download to populate a dropdown.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { getShadowActivities } from "@/shared/api/client";

export type ActivityOption = { uid: string; name: string };

type Props = {
  projectId: string | null;
  selected: ActivityOption | null;
  onSelect: (activity: ActivityOption | null) => void;
  percent: string;
  onPercent: (value: string) => void;
  completedOn: string;
  onCompletedOn: (value: string) => void;
  disabled?: boolean;
};

export default function ReportComposer({
  projectId,
  selected,
  onSelect,
  percent,
  onPercent,
  completedOn,
  onCompletedOn,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (q: string) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        const { items: rows } = await getShadowActivities(projectId, q);
        setItems(rows);
      } catch (e) {
        setItems([]);
        setError(e instanceof Error ? e.message : "Could not load activities.");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  // Debounced so typing does not fire a query per keystroke.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void load(query), query ? 220 : 0);
    return () => window.clearTimeout(t);
  }, [open, query, load]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative" ref={boxRef}>
        <button
          type="button"
          disabled={disabled || !projectId}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-gray-300 hover:bg-white/[0.06] transition-colors disabled:opacity-50 max-w-[18rem]"
        >
          <span className="truncate">
            {selected ? selected.name : "Link an activity (optional)"}
          </span>
          {selected ? (
            <X
              className="w-3 h-3 shrink-0 text-gray-500 hover:text-gray-300"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
            />
          ) : (
            <ChevronDown className="w-3 h-3 shrink-0 text-gray-500" />
          )}
        </button>

        {open && (
          <div className="absolute bottom-full mb-1 left-0 z-50 w-80 rounded-xl bg-slate-800 border border-white/[0.08] shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
              <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activities…"
                className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
              />
              {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {error ? (
                <div className="px-3 py-4 text-[11px] text-red-300">{error}</div>
              ) : loading && items.length === 0 ? (
                <div className="px-3 py-4 text-[11px] text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading activities…
                </div>
              ) : items.length === 0 ? (
                <div className="px-3 py-4 text-[11px] text-gray-600">
                  {query ? "No activity matches that." : "No activities in this project."}
                </div>
              ) : (
                items.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    onClick={() => {
                      onSelect(a);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                      a.uid === selected?.uid
                        ? "bg-blue-500/10 text-blue-300"
                        : "text-gray-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="block truncate">{a.name}</span>
                    <span className="block text-[10px] text-gray-600 font-mono">{a.uid}</span>
                  </button>
                ))
              )}
            </div>
            <p className="px-3 py-2 text-[10px] text-gray-600 border-t border-white/[0.06]">
              Naming the activity skips the matching step — nothing is left to guess.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
        <input
          type="number"
          min={0}
          max={100}
          value={percent}
          disabled={disabled}
          onChange={(e) => onPercent(e.target.value)}
          placeholder="—"
          className="w-12 bg-transparent text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none tabular-nums"
        />
        <span className="text-[11px] text-gray-500">% complete</span>
      </div>

      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
        <span className="text-[11px] text-gray-500 whitespace-nowrap">Completed / observed on</span>
        <input
          type="date"
          value={completedOn}
          disabled={disabled}
          onChange={(e) => onCompletedOn(e.target.value)}
          className="w-[8.25rem] bg-transparent text-[11px] text-gray-200 [color-scheme:dark] focus:outline-none"
          title="Optional. Use a past date when this work was completed earlier and reported late."
        />
      </label>
    </div>
  );
}
