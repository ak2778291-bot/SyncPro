// Typed answer blocks.
//
// The v1 assistant returned one markdown string and a table, so a DCMA answer —
// a score, twelve findings, each with a measured value, a threshold and a
// proposed fix — arrived as a wall of prose with the structure flattened out of
// it. The backend now returns those as typed blocks, and this renders each type
// as the thing it is: a score tile, a finding card, a delay-impact card.
//
// Every block is self-describing, so an unknown type degrades to its text rather
// than disappearing: the backend can add a block type before the client knows
// about it without a deploy that breaks answers.
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ChevronDown, Download, Info, TrendingDown } from "lucide-react";
import type { AnswerBlock } from "@/shared/api/client";

type Props = {
  blocks: AnswerBlock[];
  onExport?: (rows: Record<string, unknown>[], label?: string) => void;
  onOpenTable?: () => void;
  onOpenGraph?: () => void;
};

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "border-red-500/30 bg-red-500/[0.06] text-red-300",
  Warning: "border-amber-500/30 bg-amber-500/[0.06] text-amber-300",
  Advisory: "border-sky-500/30 bg-sky-500/[0.06] text-sky-300",
};

export default function AnswerBlocks({ blocks, onExport, onOpenTable, onOpenGraph }: Props) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockView
          key={i}
          block={block}
          onExport={onExport}
          onOpenTable={onOpenTable}
          onOpenGraph={onOpenGraph}
        />
      ))}
    </div>
  );
}

function BlockView({ block, onExport, onOpenTable, onOpenGraph }: { block: AnswerBlock } & Omit<Props, "blocks">) {
  switch (block.type) {
    case "paragraph":
      return (
        <div className="text-sm leading-relaxed text-gray-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: (props) => <p className="mb-2 last:mb-0" {...props} />,
              strong: (props) => <strong className="font-semibold text-white" {...props} />,
              code: (props) => (
                <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300" {...props} />
              ),
            }}
          >
            {block.text || ""}
          </ReactMarkdown>
        </div>
      );

    case "metric_row":
      return (
        <div className="flex flex-wrap gap-2">
          {(block.items || []).map((item, i) => (
            <div
              key={i}
              className="flex-1 min-w-[120px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="text-[10px] uppercase tracking-wider text-gray-500">
                {String(item.label ?? "")}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-gray-100 tabular-nums">
                  {String(item.value ?? "")}
                </span>
                {item.grade ? (
                  <span className="text-[11px] font-medium text-gray-400">
                    grade {String(item.grade)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      );

    case "flag_card": {
      const severity = String(block.meta?.severity ?? "Advisory");
      const style = SEVERITY_STYLE[severity] || SEVERITY_STYLE.Advisory;
      return (
        <div className={`rounded-xl border px-3.5 py-3 ${style}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {block.title}
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-70">
              {severity} · {String(block.meta?.family ?? "")}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{block.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
            {block.meta?.measured ? (
              <span>
                measured <span className="text-gray-200 tabular-nums">{String(block.meta.measured)}</span>
              </span>
            ) : null}
            {block.meta?.threshold ? (
              <span>
                limit <span className="text-gray-200 tabular-nums">{String(block.meta.threshold)}</span>
              </span>
            ) : null}
          </div>
          {block.meta?.fix ? (
            <p className="mt-2 border-t border-white/[0.08] pt-2 text-[11px] text-gray-400">
              <span className="text-gray-300">Proposed fix: </span>
              {String(block.meta.fix)}
            </p>
          ) : null}
        </div>
      );
    }

    case "whatif_card":
      return (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.05] px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-violet-300">
            <TrendingDown className="w-3.5 h-3.5" />
            {block.title}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
            <Stat label="Delay applied" value={`${block.meta?.delay_days ?? "-"} d`} />
            <Stat label="Project finish" value={`+${block.meta?.project_finish_delay_days ?? 0} d`} />
            <Stat label="Downstream" value={String(block.meta?.downstream_count ?? 0)} />
            <Stat label="Newly critical" value={String(block.meta?.newly_critical_count ?? 0)} />
          </div>
          {block.meta?.method ? (
            <p className="mt-2 text-[10px] text-gray-500">{String(block.meta.method)}</p>
          ) : null}
        </div>
      );

    case "table":
      return (
        <ResultTable
          rows={block.rows || []}
          title={block.title}
          onExport={onExport}
          onOpenTable={onOpenTable}
          onOpenGraph={onOpenGraph}
        />
      );

    case "error":
      return (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-xs text-red-300">
          {block.text}
        </div>
      );

    // `clarification` is rendered by ChatWindow, which owns the chips because
    // tapping one sends a new turn. Rendering it here too would show it twice.
    case "clarification":
      return null;

    default:
      return block.text ? (
        <p className="text-sm leading-relaxed text-gray-200">{block.text}</p>
      ) : null;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-100 tabular-nums">{value}</div>
    </div>
  );
}

function ResultTable({
  rows,
  title,
  onExport,
  onOpenTable,
  onOpenGraph,
}: {
  rows: Record<string, unknown>[];
  title?: string;
} & Omit<Props, "blocks">) {
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/70 border-b border-white/[0.06]">
        <span className="text-[11px] text-gray-400">
          {title ? `${title} · ` : ""}
          {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
        <div className="flex gap-2.5">
          {onOpenTable ? (
            <button onClick={onOpenTable} className="text-[11px] text-gray-500 hover:text-gray-200">
              Table
            </button>
          ) : null}
          {onOpenGraph ? (
            <button onClick={onOpenGraph} className="text-[11px] text-gray-500 hover:text-gray-200">
              Graph
            </button>
          ) : null}
          {onExport ? (
            <button
              onClick={() => onExport(rows, title || "results")}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-200"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-700/30">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-medium text-gray-300 border-b border-white/[0.06] whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, idx) => (
              <tr key={idx} className={row.Critical === true ? "bg-red-500/[0.06]" : ""}>
                {headers.map((h) => (
                  <td key={h} className="px-3 py-1.5 text-gray-400 border-b border-white/[0.04] whitespace-nowrap">
                    {formatCell(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 ? (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300 bg-slate-900/40 border-t border-white/[0.04]"
        >
          <ChevronDown className={`inline w-3 h-3 mr-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

/** The line under an answer that says how far to trust it. */
export function AnswerProvenance({
  tier,
  tierMeaning,
  verified,
  route,
  citations,
  caveats,
  asOf,
  asOfIsDataDate,
}: {
  tier?: string;
  tierMeaning?: string;
  verified?: boolean;
  route?: string;
  citations?: number;
  caveats?: string[];
  asOf?: string | null;
  asOfIsDataDate?: boolean | null;
}) {
  const [open, setOpen] = useState(false);
  if (!tier) return null;

  // A judgement and a computed fact must not look the same. T6 is reasoning over
  // the facts; T7 is an honest refusal; everything below is computed.
  const judgement = tier === "T6";
  const refusal = tier === "T7";
  const tone = refusal
    ? "text-gray-500"
    : judgement
      ? "text-amber-400/80"
      : verified
        ? "text-emerald-400/80"
        : "text-amber-400/80";

  return (
    <div className="mt-2 space-y-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-[10px] ${tone} hover:opacity-80`}
        title={tierMeaning}
      >
        <Info className="w-3 h-3" />
        {refusal ? "Not answered" : judgement ? "Judgement" : verified ? "Verified" : "Unverified"}
        <span className="text-gray-600">
          · {tierMeaning || tier}
          {citations ? ` · ${citations} source${citations === 1 ? "" : "s"}` : ""}
        </span>
      </button>

      {asOf ? (
        <div className="text-[10px] text-gray-600">
          Read as of {asOf}
          {asOfIsDataDate === false ? " (today — this schedule has no data date)" : " (data date)"}
        </div>
      ) : null}

      {caveats?.length ? (
        <ul className="space-y-0.5">
          {caveats.map((c, i) => (
            <li key={i} className="text-[10px] text-amber-400/70 leading-relaxed">
              {c}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[10px] text-gray-500 space-y-0.5">
          <div>Coverage tier: {tier} — {tierMeaning}</div>
          <div>Answered by: {route}</div>
          <div>Verification: {verified ? "all checks passed" : "one or more checks did not pass"}</div>
        </div>
      ) : null}
    </div>
  );
}
