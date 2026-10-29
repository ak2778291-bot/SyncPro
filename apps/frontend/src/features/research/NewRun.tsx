import { useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { getProjects, type Project } from "@/shared/api/client";
import { createRun, getModels, type Bank, type BenchModel, type Mode, type Run } from "./api";
import { Card, Chip } from "./ui";
import { shortModel, errMsg } from "./format";

type Preset = "smoke" | "standard" | "full" | "custom";

// Measured on the live schedule (2026-09-30): the production path spends
// ~0.3–9k tokens a question depending on whether the tool loop runs; the
// model-first path 6–20k. These are planning figures, not promises.
const TOKENS_PER_Q: Record<Mode, number> = { pipeline: 1500, model_first: 9000 };
// Groq's free tier caps several models at ~200k tokens a day. A run that
// exceeds it is not lost — that model pauses and the run can be resumed.
const DAILY_CAP_HINT = 200_000;

export default function NewRun({ bank, onStarted }: { bank: Bank; onStarted: (run: Run) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [models, setModels] = useState<BenchModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [modes, setModes] = useState<Mode[]>(["pipeline"]);
  const [preset, setPreset] = useState<Preset>("smoke");
  const [cats, setCats] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [tpm, setTpm] = useState(6000);
  const [label, setLabel] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProjects()
      .then((r) => {
        setProjects(r.projects);
        if (r.projects[0]) setProjectId((p) => p || r.projects[0].id);
      })
      .catch((e) => setError(errMsg(e)));
    getModels()
      .then((r) => {
        setModels(r.models);
        setSelected(r.models.filter((m) => m.default).map((m) => m.id));
      })
      .catch((e) => setModelsError(errMsg(e)));
  }, []);

  // The questions this selection resolves to — the same filtering the backend
  // does, so the count and the estimate are what will actually run.
  const questionIds = useMemo(() => {
    const qs = bank.questions;
    if (preset === "smoke") {
      const seen = new Set<string>();
      return qs.filter((q) => (seen.has(q.category) ? false : (seen.add(q.category), true))).map((q) => q.id);
    }
    if (preset === "standard") return qs.filter((q) => q.difficulty === "easy" || q.difficulty === "medium").map((q) => q.id);
    if (preset === "full") return qs.map((q) => q.id);
    return qs
      .filter((q) => (!cats.length || cats.includes(q.category))
        && (!diffs.length || diffs.includes(q.difficulty))
        && (!skills.length || skills.includes(q.skill)))
      .map((q) => q.id);
  }, [bank, preset, cats, diffs, skills]);

  const perModel = modes.reduce((sum, m) => sum + questionIds.length * TOKENS_PER_Q[m], 0);
  const minutesPerModel = Math.ceil(perModel / tpm);

  const toggle = <T,>(list: T[], v: T, set: (x: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const run = await createRun({
        project_id: projectId,
        models: selected,
        modes,
        question_ids: questionIds,
        tpm_budget: tpm,
        label: label || undefined,
      });
      onStarted(run);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const visibleModels = models.filter((m) => showAll || m.chat);
  const canStart = projectId && selected.length && modes.length && questionIds.length && !busy;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Project" subtitle="Questions are templates filled from this schedule; ground truth is computed from it.">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.taskCount} activities
              </option>
            ))}
          </select>
        </Card>

        <Card
          title="Models"
          subtitle="Read live from Groq for this API key, so a retired model never appears."
          right={
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              show non-chat models
            </label>
          }
        >
          {modelsError && <p className="text-sm text-rose-300">{modelsError}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleModels.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                  selected.includes(m.id) ? "border-sky-500/50 bg-sky-500/5" : "border-slate-800 bg-slate-950/40"
                } ${m.chat ? "" : "opacity-50"}`}
              >
                <input
                  type="checkbox"
                  disabled={!m.chat}
                  checked={selected.includes(m.id)}
                  onChange={() => toggle(selected, m.id, setSelected)}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-slate-100">{shortModel(m.id)}</div>
                  <div className="text-[11px] text-slate-500">
                    {m.owned_by} · {m.context_window ? `${Math.round(m.context_window / 1000)}k ctx` : "?"}
                  </div>
                  {m.note && <div className="mt-1 text-xs text-slate-400">{m.note}</div>}
                </div>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Mode" subtitle="What the model is asked to do.">
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["pipeline", "Production pipeline",
                "Exactly what users get. Most questions are routed and planned deterministically; the model writes the answer. Cheap. Measures prose and the model's share of production."],
              ["model_first", "Model-first",
                "Skips the deterministic router and fixed plans: the model reads the question, picks tools and arguments itself. 5–10× the tokens. This is the mode that tells models apart."],
            ] as [Mode, string, string][]).map(([m, title, body]) => (
              <label
                key={m}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                  modes.includes(m) ? "border-sky-500/50 bg-sky-500/5" : "border-slate-800 bg-slate-950/40"
                }`}
              >
                <input type="checkbox" checked={modes.includes(m)} onChange={() => toggle(modes, m, setModes)} className="mt-1" />
                <div>
                  <div className="text-sm font-medium text-slate-100">{title}</div>
                  <div className="mt-1 text-xs text-slate-400">{body}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Questions" subtitle={`${bank.summary.total} in the bank.`}>
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ["smoke", `Smoke — 1 per category`],
              ["standard", "Standard — easy + medium"],
              ["full", "Full bank"],
              ["custom", "Custom"],
            ] as [Preset, string][]).map(([p, l]) => (
              <Chip key={p} active={preset === p} onClick={() => setPreset(p)}>{l}</Chip>
            ))}
          </div>
          {preset === "custom" && (
            <div className="space-y-3">
              {([
                ["Category", bank.vocabulary.categories, cats, setCats],
                ["Difficulty", bank.vocabulary.difficulties, diffs, setDiffs],
                ["Skill", bank.vocabulary.skills, skills, setSkills],
              ] as [string, string[], string[], (x: string[]) => void][]).map(([name, all, cur, set]) => (
                <div key={name}>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {all.map((v) => (
                      <Chip key={v} active={cur.includes(v)} onClick={() => toggle(cur, v, set)}>{v.replace(/_/g, " ")}</Chip>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">No chips in a row means "all" for that row.</p>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Plan">
          <dl className="space-y-2 text-sm">
            <Row k="Questions" v={questionIds.length} />
            <Row k="Models" v={selected.length} />
            <Row k="Modes" v={modes.length} />
            <Row k="Answers to grade" v={questionIds.length * selected.length * modes.length} />
            <Row k="≈ tokens per model" v={perModel.toLocaleString()} />
            <Row k="≈ time (models run in parallel)" v={`${minutesPerModel}–${minutesPerModel * 2} min`} />
          </dl>
          {perModel > DAILY_CAP_HINT && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
              Above the ~200k tokens/day free cap several models have. The run
              is not lost: a model that hits its cap pauses, its remaining
              questions are marked <em>quota</em> (not failed), and <b>Resume</b> tomorrow continues it.
            </p>
          )}
          <label className="mt-4 block text-xs text-slate-400">
            Tokens-per-minute budget per model
            <input
              type="number" min={1000} step={500} value={tpm}
              onChange={(e) => setTpm(Number(e.target.value) || 6000)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="mt-3 block text-xs text-slate-400">
            Label (optional)
            <input
              value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. after stopword fix"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
            />
          </label>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          <button
            type="button" disabled={!canStart} onClick={start}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start run
          </button>
        </Card>
        <Card title="How grading works">
          <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
            <li>No model grades another. Every check is deterministic and shows why it passed or failed.</li>
            <li><b>Behaviour</b> (answer / ask / decline) is weighted highest; getting it wrong caps the score at 25.</li>
            <li><b>Facts</b> come from the graph, not a model — the answer must state the real count, date or name.</li>
            <li>Rate-limited answers are retried, never scored: the agent's fallbacks would otherwise earn a model credit for work it did not do.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-mono text-slate-100">{v}</dd>
    </div>
  );
}
