/** Formatting and small pure helpers for the evaluation page. */
import type { Mode } from "./api";

/** An error's message, whatever was thrown. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function shortModel(id: string): string {
  return id.replace(/^groq\//, "").replace(/^(openai|qwen|meta-llama|moonshotai)\//, "");
}

export const MODE_LABEL: Record<Mode, string> = {
  pipeline: "pipeline",
  model_first: "model-first",
};

export function laneLabel(lane: string): { model: string; mode: Mode } {
  const [model, mode] = lane.split("|");
  return { model: shortModel(model), mode: mode as Mode };
}

/** Score → a cell colour. Banded rather than a gradient so two cells that read
 * as the same colour really are in the same band. */
export function scoreTone(score: number | null | undefined): string {
  if (score == null) return "bg-slate-800/60 text-slate-500";
  if (score >= 90) return "bg-emerald-500/80 text-white";
  if (score >= 75) return "bg-emerald-700/70 text-emerald-50";
  if (score >= 60) return "bg-amber-500/70 text-white";
  if (score >= 40) return "bg-orange-600/70 text-white";
  return "bg-rose-600/75 text-white";
}

export function statusTone(status: string): string {
  switch (status) {
    case "running":
    case "queued":
      return "bg-sky-500/15 text-sky-300 border-sky-400/30";
    case "completed":
    case "done":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    case "quota":
    case "interrupted":
    case "cancelled":
      return "bg-amber-500/15 text-amber-300 border-amber-400/30";
    case "failed":
    case "error":
      return "bg-rose-500/15 text-rose-300 border-rose-400/30";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-400/30";
  }
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function fmtNum(n: number | null | undefined, suffix = ""): string {
  return n == null ? "—" : `${n}${suffix}`;
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
