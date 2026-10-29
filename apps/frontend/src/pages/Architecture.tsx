import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  Monitor,
  Server,
  Network,
  Database,
  Sparkles,
  Cpu,
  Globe,
} from "lucide-react";

/* ── Diagram stage size (fixed coords; scrolls on small screens) ─── */
const STAGE_W = 960;
const STAGE_H = 660;

/* ── Accent palette ──────────────────────────────────────────────── */
type AccentKey = "sky" | "blue" | "emerald" | "amber" | "fuchsia" | "orange" | "cyan";
const ACCENT: Record<AccentKey, { border: string; iconBg: string; iconText: string; stroke: string }> = {
  sky: { border: "border-sky-400/30", iconBg: "bg-sky-500/10", iconText: "text-sky-300", stroke: "#38bdf8" },
  blue: { border: "border-blue-400/40", iconBg: "bg-blue-500/15", iconText: "text-blue-300", stroke: "#60a5fa" },
  emerald: { border: "border-emerald-400/30", iconBg: "bg-emerald-500/10", iconText: "text-emerald-300", stroke: "#34d399" },
  amber: { border: "border-amber-400/30", iconBg: "bg-amber-500/10", iconText: "text-amber-300", stroke: "#fbbf24" },
  fuchsia: { border: "border-fuchsia-400/30", iconBg: "bg-fuchsia-500/10", iconText: "text-fuchsia-300", stroke: "#e879f9" },
  orange: { border: "border-orange-400/30", iconBg: "bg-orange-500/10", iconText: "text-orange-300", stroke: "#fb923c" },
  cyan: { border: "border-cyan-400/30", iconBg: "bg-cyan-500/10", iconText: "text-cyan-300", stroke: "#22d3ee" },
};

/* ── Nodes ───────────────────────────────────────────────────────── */
type NodeDef = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  kind: string;
  accent: AccentKey;
  icon: ReactNode;
};

const NODES: NodeDef[] = [
  {
    id: "frontend",
    x: 40, y: 270, w: 215, h: 120,
    title: "Frontend",
    sub: "React 19 · Vite · Tailwind",
    kind: "Client",
    accent: "sky",
    icon: <Monitor className="h-5 w-5" />,
  },
  {
    id: "backend",
    x: 375, y: 258, w: 210, h: 144,
    title: "Backend",
    sub: "FastAPI · Python",
    kind: "Server",
    accent: "blue",
    icon: <Server className="h-5 w-5" />,
  },
  {
    id: "neo4j",
    x: 720, y: 44, w: 215, h: 86,
    title: "Neo4j",
    sub: "Knowledge Graph",
    kind: "Database",
    accent: "emerald",
    icon: <Network className="h-5 w-5" />,
  },
  {
    id: "postgres",
    x: 720, y: 172, w: 215, h: 86,
    title: "PostgreSQL",
    sub: "Users / Auth",
    kind: "Database",
    accent: "amber",
    icon: <Database className="h-5 w-5" />,
  },
  {
    id: "llm",
    x: 720, y: 300, w: 215, h: 86,
    title: "LLM Providers",
    sub: "Groq · Gemini · OpenAI",
    kind: "External · AI",
    accent: "fuchsia",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "mpxj",
    x: 720, y: 428, w: 215, h: 86,
    title: "MPXJ Parser",
    sub: "Schedule files → tasks",
    kind: "External · JVM",
    accent: "orange",
    icon: <Cpu className="h-5 w-5" />,
  },
  {
    id: "oauth",
    x: 720, y: 556, w: 215, h: 86,
    title: "Google OAuth",
    sub: "Sign-in",
    kind: "External",
    accent: "cyan",
    icon: <Globe className="h-5 w-5" />,
  },
];

const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));

/* ── Edges (source → target, labeled) ────────────────────────────── */
const EDGES: { from: string; to: string; label: string }[] = [
  { from: "frontend", to: "backend", label: "REST · JWT" },
  { from: "backend", to: "neo4j", label: "Cypher · Bolt" },
  { from: "backend", to: "postgres", label: "SQLAlchemy" },
  { from: "backend", to: "llm", label: "LangChain" },
  { from: "backend", to: "mpxj", label: "JPype / JVM" },
  { from: "backend", to: "oauth", label: "verify token" },
];

/* ── Geometry helpers ────────────────────────────────────────────── */
const rightMid = (n: NodeDef) => ({ x: n.x + n.w, y: n.y + n.h / 2 });
const leftMid = (n: NodeDef) => ({ x: n.x, y: n.y + n.h / 2 });

type Pt = { x: number; y: number };
function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function buildEdge(from: NodeDef, to: NodeDef) {
  const s = rightMid(from);
  const e = leftMid(to);
  const dx = Math.max(60, (e.x - s.x) * 0.5);
  const c1 = { x: s.x + dx, y: s.y };
  const c2 = { x: e.x - dx, y: e.y };
  const d = `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
  const mid = bezierAt(s, c1, c2, e, 0.5);
  return { d, mid };
}

const LEGEND: { label: string; accent: AccentKey }[] = [
  { label: "Client", accent: "sky" },
  { label: "Server", accent: "blue" },
  { label: "Database", accent: "emerald" },
  { label: "External", accent: "fuchsia" },
];

/* ── Page ────────────────────────────────────────────────────────── */
export default function Architecture() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      {/* keyframes for the moving dots along edges */}
      <style>{`@keyframes archFlow { to { stroke-dashoffset: -120; } }
        .arch-flow { animation: archFlow 1.6s linear infinite; }`}</style>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <motion.nav
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-slate-950/80 backdrop-blur-sm"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              Syncpro · Architecture
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <Link
              to="/futurearch"
              className="rounded-md border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1.5 text-xs text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20"
            >
              Future Vision →
            </Link>
            <Link
              to="/dashboard"
              className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-gray-200 transition-colors hover:bg-white/[0.1]"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative px-6 pb-6 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[440px] w-[740px] -translate-x-1/2 rounded-full bg-blue-600/[0.06] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              System Architecture
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              How <span className="text-blue-400">Syncpro</span> connects
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-gray-400">
              The high-level pieces and how they talk to each other.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="mx-auto mb-2 flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT[l.accent].stroke }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* ── Node graph ────────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-6xl overflow-x-auto pb-4">
          <div
            className="relative mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.012]"
            style={{
              width: STAGE_W,
              height: STAGE_H,
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {/* edges */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
              fill="none"
            >
              <defs>
                <marker
                  id="arch-arrow"
                  markerWidth="9"
                  markerHeight="9"
                  refX="7"
                  refY="3"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L7,3 L0,6 Z" fill="#94a3b8" />
                </marker>
              </defs>

              {EDGES.map((edge, i) => {
                const from = NODE_BY_ID[edge.from];
                const to = NODE_BY_ID[edge.to];
                const { d } = buildEdge(from, to);
                const stroke = ACCENT[to.accent].stroke;
                return (
                  <g key={i}>
                    {/* base line */}
                    <path
                      d={d}
                      stroke={stroke}
                      strokeOpacity={0.3}
                      strokeWidth={1.5}
                      markerEnd="url(#arch-arrow)"
                    />
                    {/* animated flow dots */}
                    <path
                      className="arch-flow"
                      d={d}
                      stroke={stroke}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray="0.1 11"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* edge labels */}
            {EDGES.map((edge, i) => {
              const { mid } = buildEdge(NODE_BY_ID[edge.from], NODE_BY_ID[edge.to]);
              return (
                <motion.div
                  key={`lbl-${i}`}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/[0.08] bg-slate-950/90 px-2.5 py-0.5 font-mono text-[11px] text-gray-300 backdrop-blur-sm"
                  style={{ left: mid.x, top: mid.y }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: 0.5 + i * 0.08 }}
                >
                  {edge.label}
                </motion.div>
              );
            })}

            {/* nodes */}
            {NODES.map((n, i) => {
              const a = ACCENT[n.accent];
              return (
                <motion.div
                  key={n.id}
                  className={`absolute z-20 flex flex-col justify-center rounded-2xl border bg-slate-900/80 p-4 shadow-xl shadow-black/30 backdrop-blur-sm ${a.border}`}
                  style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.iconBg} ${a.iconText}`}>
                      {n.icon}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${a.iconBg} ${a.iconText}`}>
                      {n.kind}
                    </span>
                  </div>
                  <div className="text-base font-semibold leading-tight text-white">{n.title}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{n.sub}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <p className="mt-1 text-center text-[11px] text-gray-600 sm:hidden">
          Scroll horizontally to see the full diagram →
        </p>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
              <BarChart3 className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs text-gray-500">Syncpro — System Architecture</span>
          </div>
          <p className="text-[11px] text-gray-600">High-level component map.</p>
        </div>
      </footer>
    </div>
  );
}
