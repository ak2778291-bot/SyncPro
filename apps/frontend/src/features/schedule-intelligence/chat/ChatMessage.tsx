import { useState } from "react";
import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { Bot, User, Code2, Download, ThumbsDown, ThumbsUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "./chatStore";
import AnswerBlocks, { AnswerProvenance } from "./AnswerBlocks";

type CodeProps = HTMLAttributes<HTMLElement> & {
  inline?: boolean;
};

type Props = {
  message: ChatMessage;
  onSuggestion: (text: string) => void;
  onFeedback: (message: ChatMessage, rating: "up" | "down") => void;
  onExport: (rows: Record<string, unknown>[], label?: string) => void;
  onOpenTable: () => void;
  onOpenGraph: () => void;
};

export default function ChatMessage({
  message,
  onSuggestion,
  onFeedback,
  onExport,
  onOpenTable,
  onOpenGraph,
}: Props) {
  const isUser = message.sender === "user";
  const [showQuery, setShowQuery] = useState(false);
  const rows = message.meta?.tableData || [];
  const suggestions = [...(message.meta?.followUpQuestions || []), ...(message.meta?.suggestions || [])].slice(0, 5);
  // Typed blocks when the backend is on v2, the markdown string when it is not.
  // Both paths stay live so the engine flag can be flipped either way without a
  // frontend deploy.
  const blocks = message.meta?.blocks || [];
  const hasBlocks = blocks.length > 0;

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
          <Bot className="w-4 h-4 text-gray-300" />
        </div>
      )}

      <motion.div
        className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white whitespace-pre-wrap"
            : "bg-slate-800 text-gray-200 border border-white/[0.06]"
        }`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {isUser ? (
          message.text
        ) : (
          <div className="space-y-3">
            {hasBlocks ? (
              <AnswerBlocks
                blocks={blocks}
                onExport={onExport}
                onOpenTable={onOpenTable}
                onOpenGraph={onOpenGraph}
              />
            ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({ ...props }) => <ul className="list-disc list-inside mb-2 space-y-0.5" {...props} />,
                ol: ({ ...props }) => <ol className="list-decimal list-inside mb-2 space-y-0.5" {...props} />,
                li: ({ ...props }) => <li className="text-gray-300" {...props} />,
                table: ({ ...props }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="text-xs border-collapse w-full" {...props} />
                  </div>
                ),
                thead: ({ ...props }) => <thead className="bg-slate-700/50" {...props} />,
                th: ({ ...props }) => (
                  <th className="border border-white/10 px-3 py-1.5 text-left font-medium text-gray-200" {...props} />
                ),
                td: ({ ...props }) => (
                  <td className="border border-white/[0.06] px-3 py-1.5 text-gray-300" {...props} />
                ),
                code: ({ inline, ...props }: CodeProps) =>
                  inline ? (
                    <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300" {...props} />
                  ) : (
                    <pre className="bg-black/30 rounded-lg p-3 overflow-x-auto my-2">
                      <code className="text-xs font-mono text-gray-300" {...props} />
                    </pre>
                  ),
                strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
              }}
            >
              {message.text}
            </ReactMarkdown>
            )}

            {/* v1 only: v2 renders its own tables as typed blocks, and drawing
                both would show every result twice. */}
            {!hasBlocks && rows.length > 0 && (
              <ResultTable
                rows={rows}
                onExport={() => onExport(rows)}
                onOpenTable={onOpenTable}
                onOpenGraph={onOpenGraph}
              />
            )}

            <AnswerProvenance
              tier={message.meta?.tier}
              tierMeaning={message.meta?.tierMeaning}
              verified={message.meta?.confidence?.verified}
              route={message.meta?.confidence?.route}
              citations={message.meta?.citations?.length}
              caveats={message.meta?.caveats}
              asOf={message.meta?.evidence?.as_of}
              asOfIsDataDate={message.meta?.evidence?.as_of_is_data_date}
            />

            {/* Showing the work is the trust primitive this product was already
                right about. v1 has a Cypher query to show; v2 has the tools it
                ran and what each returned. Both are the same promise. */}
            {(message.meta?.cypher || message.meta?.evidence?.tool_calls?.length) && (
              <div>
                <button
                  onClick={() => setShowQuery((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-300/80 hover:text-blue-200"
                >
                  <Code2 className="w-3 h-3" />
                  {showQuery ? "Hide how this was answered" : "How was this answered?"}
                </button>
                {showQuery && (
                  <div className="mt-2 space-y-2">
                    {message.meta?.evidence?.tool_calls?.length ? (
                      <div className="rounded-lg bg-black/30 border border-white/[0.06] p-2.5 space-y-1">
                        {message.meta.evidence.tool_calls.map((call, i) => (
                          <div key={i} className="flex items-baseline gap-2 text-[11px] font-mono">
                            <span className={call.ok ? "text-emerald-400/80" : "text-red-400/80"}>
                              {call.ok ? "✓" : "✗"}
                            </span>
                            <span className="text-gray-300">{call.tool}</span>
                            <span className="text-gray-600 truncate">
                              {Object.keys(call.args || {}).length
                                ? JSON.stringify(call.args)
                                : ""}
                            </span>
                            <span className="ml-auto shrink-0 text-gray-600 tabular-nums">
                              {call.row_count} rows · {call.duration_ms}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {message.meta?.cypher ? (
                      <pre className="rounded-lg bg-black/30 border border-white/[0.06] p-3 overflow-x-auto text-[11px] text-gray-300">
                        {message.meta.cypher}
                      </pre>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSuggestion(suggestion)}
                    className="text-[11px] px-2 py-1 rounded-md border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 border-t border-white/[0.04] pt-2">
              <button
                onClick={() => onFeedback(message, "up")}
                className={`p-1 rounded hover:bg-white/[0.06] ${message.feedback === "up" ? "text-green-400" : "text-gray-500"}`}
                title="Good answer"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onFeedback(message, "down")}
                className={`p-1 rounded hover:bg-white/[0.06] ${message.feedback === "down" ? "text-red-400" : "text-gray-500"}`}
                title="Bad answer"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

function ResultTable({
  rows,
  onExport,
  onOpenTable,
  onOpenGraph,
}: {
  rows: Record<string, unknown>[];
  onExport: () => void;
  onOpenTable: () => void;
  onOpenGraph: () => void;
}) {
  const headers = Object.keys(rows[0] || {});
  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/70 border-b border-white/[0.06]">
        <span className="text-[11px] text-gray-400">{rows.length} structured result(s)</span>
        <div className="flex gap-2">
          <button onClick={onOpenTable} className="text-[11px] text-gray-500 hover:text-gray-200">Table</button>
          <button onClick={onOpenGraph} className="text-[11px] text-gray-500 hover:text-gray-200">Graph</button>
          <button onClick={onExport} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-200">
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead className="bg-slate-700/30 sticky top-0">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-medium text-gray-300 border-b border-white/[0.06]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, idx) => (
              <tr key={idx} className={isCritical(row) ? "bg-red-500/[0.06]" : ""}>
                {headers.map((header) => (
                  <td key={header} className="px-3 py-1.5 text-gray-400 border-b border-white/[0.04]">
                    {String(row[header] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isCritical(row: Record<string, unknown>) {
  return Object.values(row).some((value) => String(value).toLowerCase() === "true");
}
