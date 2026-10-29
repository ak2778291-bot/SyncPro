import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, Pause, Play, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import {
  cancelRun, deleteRun, getResults, getRun, regradeRun, resumeRun,
  type Mode, type Result, type RunDetail,
} from "./api";
import { Badge, Card, Chip } from "./ui";
import { MODE_LABEL, downloadText, fmtMs, fmtNum, laneLabel, scoreTone, shortModel, statusTone, toCsv, errMsg } from "./format";

type Axis = "category" | "difficulty" | "skill" | "persona";

export default function RunView({ runId, onDeleted }: { runId: string; onDeleted: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [axis, setAxis] = useState<Axis>("category");
  const [winnerMode, setWinnerMode] = useState<Mode>("pipeline");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const running = detail && ["running", "queued"].includes(detail.run.status);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      getRun(runId)
        .then((d) => {
          if (!alive) return;
          setDetail(d);
          setError(null);
          if (["running", "queued"].includes(d.run.status)) timer = setTimeout(load, 4000);
        })
        .catch((e) => alive && setError(errMsg(e)));
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [runId, running]);

  useEffect(() => {
    if (detail && !detail.run.modes.includes(winnerMode)) setWinnerMode(detail.run.modes[0]);
  }, [detail, winnerMode]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!detail) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;

  const { run, summary, counts, ground_truth } = detail;
  const lanes = summary.leaderboard.map((l) => l.lane);

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      setDetail(await getRun(runId));
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function exportCsv() {
    const { results } = await getResults(runId);
    const flat = results.map((r) => ({
      model: shortModel(r.model), mode: r.mode, question_id: r.question_id, question: r.question,
      category: r.category, difficulty: r.difficulty, skill: r.skill, persona: r.persona,
      status: r.status, score: r.score, passed: r.passed, behaviour: r.behaviour,
      failed_checks: (r.checks || []).filter((c) => !c.passed).map((c) => c.name).join("; "),
      tools: (r.tool_calls || []).map((c) => c.tool).join("; "),
      latency_ms: r.latency_ms, llm_calls: r.llm_calls,
      tokens: r.prompt_tokens + r.completion_tokens, answer: r.answer,
    }));
    downloadText(`syncpro-eval-${runId}.csv`, toCsv(flat), "text/csv");
  }

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {run.label || `Run ${run.run_id}`}
            <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            {run.modes.map((m) => <Badge key={m}>{MODE_LABEL[m]}</Badge>)}
          </span>
        }
        subtitle={`${run.project_name || run.project_id} · ${run.question_count} questions · ${run.models.length} models · ${counts.results}/${counts.expected} answers · started ${new Date(run.created_at).toLocaleString()}`}
        right={
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Btn onClick={() => act(() => cancelRun(runId))} icon={<Pause className="h-3.5 w-3.5" />}>Cancel</Btn>
            ) : (
              counts.results < counts.expected || ["interrupted", "cancelled"].includes(run.status) ? (
                <Btn onClick={() => act(() => resumeRun(runId))} icon={<Play className="h-3.5 w-3.5" />}>Resume</Btn>
              ) : null
            )}
            <Btn
              onClick={() => act(() => regradeRun(runId))}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              title="Score the stored answers again against the current question bank. Spends no tokens."
            >Re-grade</Btn>
            <Btn onClick={exportCsv} icon={<Download className="h-3.5 w-3.5" />}>CSV</Btn>
            <Btn
              onClick={() => downloadText(`syncpro-eval-${runId}.json`, JSON.stringify(detail, null, 2), "application/json")}
              icon={<Download className="h-3.5 w-3.5" />}
            >JSON</Btn>
            {!running && (
              <Btn onClick={() => act(async () => { await deleteRun(runId); onDeleted(); })} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Btn>
            )}
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {run.models.map((m) => {
            const s = run.model_status[m] || { status: "queued" };
            const pct = s.total ? Math.round((100 * (s.done || 0)) / s.total) : 0;
            return (
              <div key={m} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-slate-200">{shortModel(m)}</span>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-slate-800">
                  <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>{s.done || 0}/{s.total || "?"}</span>
                  <span>{(s.tokens || 0).toLocaleString()} tokens</span>
                </div>
                {s.note && <p className="mt-1 line-clamp-2 text-[11px] text-amber-300">{s.note}</p>}
              </div>
            );
          })}
        </div>
        {run.error && <p className="mt-2 text-xs text-rose-300">{run.error}</p>}
      </Card>

      {/* ── leaderboard ────────────────────────────────────────────────── */}
      <Card title="Leaderboard" subtitle="Mean score over graded answers. Pass = every check passed. 'Model used' is the share of answers where the model was actually called.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["#", "Model", "Mode", "Score", "Pass", "Graded", "p50", "p95", "Tokens/q", "Model used", "Errors", "Unscored"].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.leaderboard.map((l, i) => (
                <tr key={l.lane} className="border-t border-slate-800">
                  <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-100">{shortModel(l.model)}</td>
                  <td className="px-2 py-1.5 text-slate-400">{MODE_LABEL[l.mode]}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded px-2 py-0.5 font-mono text-xs ${scoreTone(l.score)}`}>{fmtNum(l.score)}</span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-slate-200">{fmtNum(l.pass_rate, "%")}</td>
                  <td className="px-2 py-1.5 text-slate-400">{l.scored}/{l.n}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{fmtMs(l.p50_ms)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{fmtMs(l.p95_ms)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-300">{fmtNum(l.tokens_per_q)}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-400">{fmtNum(l.model_used_pct, "%")}</td>
                  <td className={`px-2 py-1.5 font-mono ${l.errors ? "text-rose-300" : "text-slate-500"}`}>{l.errors}</td>
                  <td className={`px-2 py-1.5 font-mono ${l.unscored ? "text-amber-300" : "text-slate-500"}`}>{l.unscored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summary.leaderboard.length && <p className="text-sm text-slate-500">No graded answers yet.</p>}
      </Card>

      {/* ── winners ────────────────────────────────────────────────────── */}
      <Card
        title="Best model per category"
        subtitle="Highest mean score, then pass rate, then speed. A tie within half a point is shown as a tie — no preference is invented."
        right={
          run.modes.length > 1 ? (
            <div className="flex gap-1.5">
              {run.modes.map((m) => <Chip key={m} active={winnerMode === m} onClick={() => setWinnerMode(m)}>{MODE_LABEL[m]}</Chip>)}
            </div>
          ) : null
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary.winners[winnerMode] || {}).sort().map(([cat, w]) => (
            <div key={cat} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{cat}</div>
              {w.score === 0 ? (
                <div className="mt-1 text-xs text-rose-300">No model passed any question here.</div>
              ) : w.tied.length > 1 ? (
                <div className="mt-1 text-xs text-slate-300">
                  Tie ({w.score}): <span className="font-mono">{w.tied.map(shortModel).join(", ")}</span>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm text-emerald-300">{shortModel(w.model)}</span>
                  <span className={`rounded px-1.5 font-mono text-xs ${scoreTone(w.score)}`}>{w.score}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── breakdown heatmap ──────────────────────────────────────────── */}
      <Card
        title="Where each model is strong and weak"
        subtitle="Mean score per cell; hover for pass rate and count."
        right={
          <div className="flex gap-1.5">
            {(["category", "difficulty", "skill", "persona"] as Axis[]).map((a) => (
              <Chip key={a} active={axis === a} onClick={() => setAxis(a)}>{a}</Chip>
            ))}
          </div>
        }
      >
        <Heatmap axis={axis} lanes={lanes} data={summary.breakdown[axis]} />
      </Card>

      {/* ── questions ──────────────────────────────────────────────────── */}
      <QuestionMatrix detail={detail} lanes={lanes} onOpen={setOpenQuestion} />

      <Card title="Ground truth this run was graded against" subtitle="Computed from the graph when the run started — never by a model.">
        <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries({ ...(ground_truth.slots || {}), ...(ground_truth.facts || {}) }).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-800/60 py-0.5">
              <span className="text-slate-500">{k}</span>
              <span className="truncate font-mono text-slate-200" title={String(v)}>{String(v)}</span>
            </div>
          ))}
        </div>
      </Card>

      {openQuestion && (
        <AnswerDrawer runId={runId} questionId={openQuestion} onClose={() => setOpenQuestion(null)} />
      )}
    </div>
  );
}

function Btn({ onClick, icon, children, title }: {
  onClick: () => void; icon: React.ReactNode; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500"
    >
      {icon}
      {children}
    </button>
  );
}

function Heatmap({ axis, lanes, data }: {
  axis: Axis; lanes: string[]; data: Record<string, Record<string, import("./api").LaneStats>>;
}) {
  const keys = useMemo(() => {
    const all = new Set<string>();
    Object.values(data || {}).forEach((row) => Object.keys(row).forEach((k) => all.add(k)));
    const order = ["easy", "medium", "hard", "expert"];
    return [...all].sort((a, b) =>
      axis === "difficulty" ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b));
  }, [data, axis]);

  if (!lanes.length) return <p className="text-sm text-slate-500">Nothing graded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th />
            {keys.map((k) => (
              <th key={k} className="max-w-[90px] px-1 pb-1 text-left align-bottom font-normal text-slate-400">
                <span className="block truncate" title={k}>{k.replace(/_/g, " ")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => {
            const { model, mode } = laneLabel(lane);
            return (
              <tr key={lane}>
                <td className="whitespace-nowrap pr-2 font-mono text-slate-300">
                  {model}
                  <span className="ml-1 text-[10px] text-slate-500">{MODE_LABEL[mode]}</span>
                </td>
                {keys.map((k) => {
                  const s = data?.[lane]?.[k];
                  return (
                    <td
                      key={k}
                      title={s ? `${k}: score ${fmtNum(s.score)}, pass ${fmtNum(s.pass_rate, "%")}, ${s.scored}/${s.n} graded` : "no data"}
                      className={`h-8 min-w-[56px] rounded text-center font-mono ${scoreTone(s?.score)}`}
                    >
                      {s?.score != null ? Math.round(s.score) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionMatrix({ detail, lanes, onOpen }: {
  detail: RunDetail; lanes: string[]; onOpen: (qid: string) => void;
}) {
  const [cat, setCat] = useState("");
  const [diff, setDiff] = useState("");
  const [only, setOnly] = useState<"" | "disagree" | "fail">("");
  const [text, setText] = useState("");

  const rows = detail.summary.questions.filter((q) => {
    if (cat && q.category !== cat) return false;
    if (diff && q.difficulty !== diff) return false;
    if (only === "disagree" && !q.disagreement) return false;
    if (only === "fail" && !Object.values(q.lanes).some((l) => l.passed === false)) return false;
    if (text && !`${q.question} ${q.question_id}`.toLowerCase().includes(text.toLowerCase())) return false;
    return true;
  });
  const cats = [...new Set(detail.summary.questions.map((q) => q.category))].sort();

  return (
    <Card
      title="Every question, every model"
      subtitle="Click a row to read each model's answer side by side, with the checks it passed and failed."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200">
          <option value="">all categories</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200">
          <option value="">all difficulties</option>
          {["easy", "medium", "hard", "expert"].map((d) => <option key={d}>{d}</option>)}
        </select>
        <Chip active={only === "disagree"} onClick={() => setOnly(only === "disagree" ? "" : "disagree")}>models disagree</Chip>
        <Chip active={only === "fail"} onClick={() => setOnly(only === "fail" ? "" : "fail")}>any failure</Chip>
        <input
          value={text} onChange={(e) => setText(e.target.value)} placeholder="search questions"
          className="ml-auto rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
        />
        <span className="text-xs text-slate-500">{rows.length} shown</span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Question</th>
              <th className="px-2 py-1.5 font-medium">Category</th>
              <th className="px-2 py-1.5 font-medium">Level</th>
              {lanes.map((lane) => {
                const { model, mode } = laneLabel(lane);
                return (
                  <th key={lane} className="px-1 py-1.5 text-center font-medium normal-case">
                    <div className="font-mono">{model}</div>
                    <div className="text-[10px] text-slate-600">{MODE_LABEL[mode]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.question_id} onClick={() => onOpen(q.question_id)} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/40">
                <td className="max-w-[360px] px-2 py-1.5">
                  <div className="truncate text-slate-200" title={q.question}>{q.question}</div>
                  <div className="text-[10px] text-slate-600">{q.question_id} · {q.skill.replace(/_/g, " ")} · {q.persona}</div>
                </td>
                <td className="px-2 py-1.5 text-slate-400">{q.category}</td>
                <td className="px-2 py-1.5 text-slate-400">{q.difficulty}</td>
                {lanes.map((lane) => {
                  const l = q.lanes[lane];
                  if (!l) return <td key={lane} className="px-1 text-center text-slate-600">·</td>;
                  if (!["ok", "model_error"].includes(l.status)) {
                    return <td key={lane} className="px-1 text-center"><Badge tone={statusTone(l.status === "skipped" ? "" : "quota")}>{l.status}</Badge></td>;
                  }
                  return (
                    <td key={lane} className="px-1 text-center">
                      <span className={`inline-block min-w-[40px] rounded px-1.5 py-0.5 font-mono ${scoreTone(l.score)}`}>
                        {l.score != null ? Math.round(l.score) : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AnswerDrawer({ runId, questionId, onClose }: { runId: string; questionId: string; onClose: () => void }) {
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    getResults(runId, { question_id: questionId }).then((r) => setResults(r.results)).catch(() => setResults([]));
  }, [runId, questionId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="h-full w-full max-w-5xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{questionId}</div>
            <h2 className="text-base font-semibold text-slate-100">{results?.[0]?.question || "…"}</h2>
            {results?.[0] && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>{results[0].category}</Badge>
                <Badge>{results[0].difficulty}</Badge>
                <Badge>{results[0].skill.replace(/_/g, " ")}</Badge>
                <Badge>asked as {results[0].persona}</Badge>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {!results ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((r) => (
              <div key={r.result_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm text-slate-100">{shortModel(r.model)}</span>
                    <span className="ml-2 text-[11px] text-slate-500">{MODE_LABEL[r.mode]}</span>
                  </div>
                  {r.score != null ? (
                    <span className={`rounded px-2 py-0.5 font-mono text-xs ${scoreTone(r.score)}`}>{r.score}</span>
                  ) : (
                    <Badge tone={statusTone("quota")}>{r.status}</Badge>
                  )}
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
                  {r.behaviour && <Badge>{r.behaviour}</Badge>}
                  {r.tier && <Badge>{r.tier}</Badge>}
                  {r.intent && <Badge>{r.intent}</Badge>}
                  <Badge>{fmtMs(r.latency_ms)}</Badge>
                  <Badge>{r.llm_calls} calls · {(r.prompt_tokens + r.completion_tokens).toLocaleString()} tok</Badge>
                  {r.retries > 0 && <Badge tone={statusTone("quota")}>{r.retries} retries</Badge>}
                </div>
                <div className="mb-2 whitespace-pre-wrap rounded-lg bg-slate-950/70 p-2.5 text-xs leading-relaxed text-slate-200">
                  {r.answer || <span className="text-slate-500">{r.note || "(no answer)"}</span>}
                </div>
                {!!r.tool_calls?.length && (
                  <div className="mb-2 space-y-1">
                    {r.tool_calls.map((c, i) => (
                      <div key={i} className="rounded bg-slate-950/50 px-2 py-1 font-mono text-[11px] text-slate-400">
                        <span className="text-sky-300">{c.tool}</span>({Object.entries(c.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}) → {c.rows} rows
                      </div>
                    ))}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {(r.checks || []).map((c, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px]">
                      {c.passed
                        ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        : <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />}
                      <span className={c.passed ? "text-slate-500" : "text-rose-200"}>
                        <b className="font-medium">{c.name}</b> — {c.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                {!!r.llm_errors?.length && (
                  <p className="mt-2 line-clamp-3 text-[11px] text-rose-300" title={r.llm_errors.join("\n")}>
                    model error: {r.llm_errors[r.llm_errors.length - 1]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
