/** /evaluation — internal model benchmark for the schedule assistant.
 *
 * Deliberately not linked from the dashboard or any user navigation: it spends
 * the deployment's shared model quota and reads every answer the agent gives,
 * so it is operator tooling. The backend enforces that (platform operators
 * only); this page only reflects it. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import { ForbiddenError, getBank, listRuns, type Bank, type Run } from "@/features/research/api";
import NewRun from "@/features/research/NewRun";
import RunView from "@/features/research/RunView";
import BankView from "@/features/research/BankView";
import { Badge } from "@/features/research/ui";
import { MODE_LABEL, shortModel, statusTone, errMsg } from "@/features/research/format";

type Tab = "runs" | "new" | "bank";

export default function Evaluation() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<Tab>("runs");
  const [selected, setSelected] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshRuns = () =>
    listRuns()
      .then((r) => {
        setRuns(r.runs);
        setSelected((s) => s ?? r.runs[0]?.run_id ?? null);
      })
      .catch((e) => (e instanceof ForbiddenError ? setForbidden(e.message) : setError(errMsg(e))));

  useEffect(() => {
    getBank()
      .then(setBank)
      .catch((e) => (e instanceof ForbiddenError ? setForbidden(e.message) : setError(errMsg(e))));
    refreshRuns();
  }, []);

  // Keep the run list's statuses fresh while anything is running.
  useEffect(() => {
    if (!runs.some((r) => ["running", "queued"].includes(r.status))) return;
    const t = setInterval(refreshRuns, 6000);
    return () => clearInterval(t);
  }, [runs]);

  if (forbidden) {
    return (
      <Shell>
        <div className="mx-auto mt-16 max-w-lg rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-300" />
          <h2 className="mt-3 text-lg font-semibold text-slate-100">Operator access required</h2>
          <p className="mt-2 text-sm text-slate-400">
            This page is internal research tooling. Add your account's email to{" "}
            <code className="rounded bg-slate-800 px-1 text-slate-200">PLATFORM_OPERATOR_EMAILS</code> in{" "}
            <code className="rounded bg-slate-800 px-1 text-slate-200">apps/backend/.env</code> and restart the backend.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {([["runs", "Runs"], ["new", "New run"], ["bank", "Question bank"]] as [Tab, string][]).map(([t, l]) => (
          <button
            key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            {l}
            {t === "bank" && bank && <span className="ml-1.5 text-xs text-slate-500">{bank.summary.total}</span>}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {!bank ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : tab === "bank" ? (
        <BankView bank={bank} />
      ) : tab === "new" ? (
        <NewRun
          bank={bank}
          onStarted={(run) => {
            setRuns((rs) => [run, ...rs]);
            setSelected(run.run_id);
            setTab("runs");
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-1.5">
            {!runs.length && (
              <p className="text-sm text-slate-500">
                No runs yet. <button type="button" className="text-sky-300 underline" onClick={() => setTab("new")}>Start one</button>.
              </p>
            )}
            {runs.map((r) => (
              <button
                key={r.run_id} type="button" onClick={() => setSelected(r.run_id)}
                className={`w-full rounded-lg border p-2.5 text-left ${
                  selected === r.run_id ? "border-sky-500/50 bg-sky-500/5" : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-100">{r.label || r.run_id}</span>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-500">
                  {r.question_count}q · {r.modes.map((m) => MODE_LABEL[m]).join(" + ")} · {new Date(r.created_at).toLocaleDateString()}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-slate-600">{r.models.map(shortModel).join(", ")}</div>
              </button>
            ))}
          </aside>
          <main className="min-w-0">
            {selected ? (
              <RunView
                key={selected}
                runId={selected}
                onDeleted={() => {
                  setSelected(null);
                  refreshRuns();
                }}
              />
            ) : null}
          </main>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 bg-slate-950/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Link to="/dashboard" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" title="Back to the app">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <FlaskConical className="h-5 w-5 text-sky-300" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Model evaluation</h1>
            <p className="text-[11px] text-slate-500">
              Internal research — how the schedule assistant answers, per model, per kind of question.
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
