/** Small presentational helpers shared by the evaluation page. */
import type { ReactNode } from "react";

export function Badge({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tone || "border-slate-600 bg-slate-800 text-slate-300"}`}>
      {children}
    </span>
  );
}

export function Card({ title, subtitle, right, children }: {
  title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      {(title || right) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
          : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

