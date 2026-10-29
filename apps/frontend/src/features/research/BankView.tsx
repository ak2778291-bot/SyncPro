import { useState } from "react";
import type { Bank } from "./api";
import { Badge, Card, Chip } from "./ui";

/** The bank, with what each question expects — so a score can be read against
 * the standard it was held to. */
export default function BankView({ bank }: { bank: Bank }) {
  const [cat, setCat] = useState("");
  const [diff, setDiff] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const qs = bank.questions.filter((q) => (!cat || q.category === cat) && (!diff || q.difficulty === diff));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["by_category", "by_difficulty", "by_skill", "by_persona"] as const).map((k) => (
          <Card key={k} title={k.replace("by_", "By ")}>
            <div className="space-y-0.5 text-xs">
              {Object.entries(bank.summary[k]).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-slate-400">{name.replace(/_/g, " ")}</span>
                  <span className="font-mono text-slate-200">{n}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card title={`${qs.length} of ${bank.summary.total} questions`} subtitle="Templates in {braces} are filled from the project a run targets.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip active={!cat} onClick={() => setCat("")}>all</Chip>
          {bank.vocabulary.categories.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          <span className="mx-2 border-l border-slate-700" />
          {bank.vocabulary.difficulties.map((d) => <Chip key={d} active={diff === d} onClick={() => setDiff(diff === d ? "" : d)}>{d}</Chip>)}
        </div>
        <div className="divide-y divide-slate-800">
          {qs.map((q) => (
            <div key={q.id} className="py-2">
              <button type="button" onClick={() => setOpen(open === q.id ? null : q.id)} className="flex w-full items-start gap-3 text-left">
                <span className="w-20 shrink-0 font-mono text-[11px] text-slate-500">{q.id}</span>
                <span className="flex-1 text-sm text-slate-200">{q.text}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Badge>{q.difficulty}</Badge>
                  <Badge>{q.skill.replace(/_/g, " ")}</Badge>
                  <Badge>{q.behaviour.replace(/_/g, " ")}</Badge>
                </span>
              </button>
              {open === q.id && (
                <dl className="ml-[92px] mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <Exp k="asked as" v={q.persona} />
                  <Exp k="acceptable tools" v={q.tools_any.join(", ")} />
                  <Exp k="forbidden tools" v={q.tools_none.join(", ")} />
                  <Exp k="required arguments" v={Object.entries(q.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")} />
                  <Exp k="forbidden arguments" v={q.args_absent.join(", ")} />
                  <Exp k="facts it must state" v={q.facts.join(", ")} />
                  <Exp k="terms" v={q.terms.map((t) => t.join("/")).join("; ")} />
                  <Exp k="must not say" v={q.forbid.join("  |  ")} />
                  <Exp k="must not affirm" v={(q.forbid_affirmed || []).join("  |  ")} />
                  <Exp k="withheld columns" v={q.forbid_columns.join(", ")} />
                  <Exp k="earlier turns" v={q.setup.join("  →  ")} />
                  <Exp k="needs" v={q.needs.join(", ")} />
                  {q.note && <div className="sm:col-span-2 text-slate-400"><span className="text-slate-500">why: </span>{q.note}</div>}
                </dl>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Exp({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{k}:</dt>
      <dd className="break-all font-mono text-slate-300">{v}</dd>
    </div>
  );
}
