import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Sparkles,
  Brain,
  Monitor,
  ScanEye,
  Workflow,
  ShieldAlert,
  LayoutDashboard,
  MessageSquare,
  Network,
  Database,
  Cpu,
  Bot,
  Layers,
  Radio,
  GitBranch,
  Plug,
  Gauge,
  SlidersHorizontal,
  FileSearch,
  Upload,
  KeyRound,
  Wrench,
} from "lucide-react";
import ZoomableGraph from "@/shared/components/ZoomableGraph";
import type { GNode, GEdge, GAccent } from "@/shared/components/ZoomableGraph";

/* ════════════════════════════════════════════════════════════════════
 *  FUTURE ARCHITECTURE  (/futurearch)
 *  Derived from the Syncpro strategy corpus (Brainstorming/*). Six products,
 *  each anchored on a ranked "unsolved problem", on one shared Platform Core.
 *    1. Product constellation — how the products connect (ordered by horizon)
 *    2. Future platform stack — the agentic, event-sourced architecture
 *    3. Product blueprints — each product's real technical pipeline (sorted L→R)
 * ════════════════════════════════════════════════════════════════════ */

const ic = (Icon: typeof Brain) => <Icon className="h-5 w-5" />;

const STROKE: Record<GAccent, string> = {
  sky: "#38bdf8", blue: "#60a5fa", emerald: "#34d399", amber: "#fbbf24",
  fuchsia: "#e879f9", orange: "#fb923c", cyan: "#22d3ee", violet: "#a78bfa",
  rose: "#fb7185", teal: "#2dd4bf", indigo: "#818cf8", lime: "#a3e635",
};

/* ──────────────────────────────────────────────────────────────────
 * 1 · PRODUCT CONSTELLATION — Core hub + 6 products, ordered by horizon
 * ────────────────────────────────────────────────────────────────── */
const CONSTELLATION_NODES: GNode[] = [
  {
    id: "core", x: 450, y: 250, w: 220, h: 112,
    title: "Platform Core", sub: "Agent mesh · KG fabric · event-sourced audit",
    kind: "Foundation", accent: "indigo", icon: ic(Brain), glow: true,
  },
  { id: "p06", x: 90, y: 50, w: 200, h: 90, title: "Schedule Genesis", sub: "CPM from a conversation", kind: "H2", accent: "cyan", icon: ic(MessageSquare) },
  { id: "p01", x: 40, y: 256, w: 200, h: 100, title: "Schedule Intelligence", sub: "Health score + cited NL agent", kind: "H1 · Live", accent: "sky", icon: ic(Monitor) },
  { id: "p04", x: 110, y: 470, w: 200, h: 90, title: "Forensic Evidence", sub: "Immutable audit + TIA export", kind: "H1 infra", accent: "amber", icon: ic(ShieldAlert) },
  { id: "p02", x: 820, y: 50, w: 200, h: 90, title: "Shadow Schedule", sub: "Confidence-gated field commits", kind: "H2", accent: "blue", icon: ic(ScanEye) },
  { id: "p03", x: 880, y: 256, w: 200, h: 90, title: "Constraint Intelligence", sub: "Make-ready + zone conflicts", kind: "H2", accent: "violet", icon: ic(Workflow) },
  { id: "p05", x: 820, y: 470, w: 200, h: 90, title: "Portfolio & Benchmark", sub: "Cross-project analytics", kind: "H3", accent: "fuchsia", icon: ic(LayoutDashboard) },
];

const CONSTELLATION_EDGES: GEdge[] = [
  // platform serves every product (subtle, unlabeled)
  { from: "core", to: "p06" }, { from: "core", to: "p01" }, { from: "core", to: "p04" },
  { from: "core", to: "p02" }, { from: "core", to: "p03" }, { from: "core", to: "p05" },
  // real product dependencies (labeled)
  { from: "p06", to: "p01", label: "generates CPM" },
  { from: "p01", to: "p02", label: "baseline graph" },
  { from: "p01", to: "p03", label: "extends graph" },
  { from: "p02", to: "p04", label: "writes events" },
  { from: "p02", to: "p05", label: "rolls up" },
  { from: "p04", to: "p05", label: "evidence" },
];

/* ──────────────────────────────────────────────────────────────────
 * 2 · FUTURE PLATFORM STACK — 5 clean columns, left → right
 * ────────────────────────────────────────────────────────────────── */
const PLATFORM_NODES: GNode[] = [
  // Clients
  { id: "web", x: 40, y: 110, w: 180, h: 84, title: "Web App", sub: "React · Vite · Tailwind", kind: "Client", accent: "sky", icon: ic(Monitor) },
  { id: "mobile", x: 40, y: 320, w: 180, h: 84, title: "Mobile / Field", sub: "PWA · WhatsApp · voice", kind: "Client", accent: "amber", icon: ic(Radio) },
  { id: "ext", x: 40, y: 530, w: 180, h: 84, title: "External Systems", sub: "P6 · Procore · Autodesk", kind: "Client", accent: "teal", icon: ic(Plug) },
  // Edge
  { id: "gateway", x: 340, y: 110, w: 180, h: 84, title: "API Gateway", sub: "FastAPI · REST", kind: "Edge", accent: "blue", icon: ic(GitBranch) },
  { id: "realtime", x: 340, y: 320, w: 180, h: 84, title: "Realtime", sub: "WebSocket · SSE", kind: "Edge", accent: "cyan", icon: ic(Radio) },
  { id: "identity", x: 340, y: 530, w: 180, h: 84, title: "Identity & RBAC", sub: "OAuth · JWT · SSO", kind: "Edge", accent: "teal", icon: ic(KeyRound) },
  // Agent mesh
  { id: "orch", x: 640, y: 130, w: 190, h: 120, title: "Agent Orchestrator", sub: "LangGraph · plan → act → reflect", kind: "Core", accent: "indigo", icon: ic(Bot), glow: true },
  { id: "skills", x: 640, y: 300, w: 190, h: 80, title: "Skills Registry", sub: "Cypher · disambig · narrative", kind: "Agents", accent: "lime", icon: ic(Wrench) },
  { id: "modelgw", x: 640, y: 430, w: 190, h: 80, title: "Model Gateway", sub: "route · fallback · cache", kind: "AI", accent: "fuchsia", icon: ic(Sparkles) },
  { id: "guard", x: 640, y: 560, w: 190, h: 80, title: "Guardrails & Eval", sub: "LangSmith · confidence gate", kind: "Quality", accent: "rose", icon: ic(ShieldAlert) },
  // Knowledge fabric
  { id: "kg", x: 960, y: 90, w: 180, h: 84, title: "Neo4j KG", sub: "CPM graph · dual-state", kind: "Data", accent: "emerald", icon: ic(Network) },
  { id: "audit", x: 960, y: 250, w: 180, h: 84, title: "Postgres Audit", sub: "append-only schedule_events", kind: "Data", accent: "amber", icon: ic(Database) },
  { id: "vector", x: 960, y: 410, w: 180, h: 84, title: "Vector Store", sub: "RAG · documents", kind: "Data", accent: "violet", icon: ic(Layers) },
  { id: "object", x: 960, y: 570, w: 180, h: 84, title: "Object Store", sub: "evidence · file versions", kind: "Data", accent: "orange", icon: ic(Database) },
  // External
  { id: "llm", x: 1280, y: 250, w: 180, h: 84, title: "LLM Providers", sub: "Groq · Gemini · OpenAI", kind: "External", accent: "fuchsia", icon: ic(Sparkles) },
  { id: "obs", x: 1280, y: 430, w: 180, h: 84, title: "Observability", sub: "metrics · cost · VPRGC", kind: "Ops", accent: "blue", icon: ic(Gauge) },
];

const PLATFORM_EDGES: GEdge[] = [
  { from: "web", to: "gateway", label: "REST" },
  { from: "mobile", to: "realtime", label: "WS" },
  { from: "ext", to: "gateway", label: "webhook" },
  { from: "identity", to: "gateway", label: "auth" },
  { from: "gateway", to: "orch", label: "invoke" },
  { from: "realtime", to: "orch", label: "stream" },
  { from: "orch", to: "skills" },
  { from: "orch", to: "modelgw", label: "route" },
  { from: "orch", to: "guard", label: "verify" },
  { from: "modelgw", to: "llm" },
  { from: "orch", to: "kg", label: "Cypher" },
  { from: "orch", to: "audit", label: "events" },
  { from: "orch", to: "vector", label: "RAG" },
  { from: "orch", to: "object" },
  { from: "guard", to: "obs", label: "trace" },
];

/* ──────────────────────────────────────────────────────────────────
 * 3 · PRODUCT BLUEPRINTS — clean column layout, sorted left → right
 * ────────────────────────────────────────────────────────────────── */
const BW = 1120;
const BH = 470;
const NW = 168;
const NH = 88;
const MARGIN = 24;

function gridX(c: number, cols: number): number {
  const usable = BW - NW - MARGIN * 2;
  if (cols <= 1) return MARGIN + usable / 2;
  return MARGIN + (usable * c) / (cols - 1);
}
function gridY(r: number, n: number): number {
  const gap = 24;
  const totalH = n * NH + (n - 1) * gap;
  const y0 = (BH - totalH) / 2;
  return y0 + r * (NH + gap);
}

type BPNode = {
  id: string; c: number; r: number; n: number;
  title: string; sub: string; kind: string; accent: GAccent; icon: ReactNode; glow?: boolean;
};

interface Product {
  id: string;
  name: string;
  status: "Live" | "Beta" | "Planned" | "Infra";
  horizon: string;
  pillar: string;
  anchor: string;
  accent: GAccent;
  icon: ReactNode;
  blurb: string;
  cols: number;
  nodes: BPNode[];
  edges: GEdge[];
}

const PRODUCTS: Product[] = [
  {
    id: "p01",
    name: "Schedule Intelligence",
    status: "Live",
    horizon: "Horizon 1",
    pillar: "Know the Plan",
    anchor: "Unsolved #3 · Living CPM re-forecast & logic repair",
    accent: "sky",
    icon: ic(Monitor),
    blurb:
      "The planner's copilot, shipping today. Parse a P6/MS-Project file into a Neo4j CPM graph, score its health (DCMA-14 + 6 corruption checks), and answer natural-language questions with cited, graph-grounded results.",
    cols: 5,
    nodes: [
      { id: "upload", c: 0, r: 0, n: 1, title: "Upload", sub: "XER · MPP · XML", kind: "Ingest", accent: "cyan", icon: ic(Upload) },
      { id: "parser", c: 1, r: 0, n: 2, title: "MPXJ Parser", sub: "JPype / JVM", kind: "Parse", accent: "orange", icon: ic(Cpu) },
      { id: "diff", c: 1, r: 1, n: 2, title: "Incremental Diff", sub: "graph delta", kind: "Parse", accent: "orange", icon: ic(GitBranch) },
      { id: "graph", c: 2, r: 0, n: 1, title: "Neo4j CPM Graph", sub: "dual-state", kind: "Data", accent: "emerald", icon: ic(Network), glow: true },
      { id: "health", c: 3, r: 0, n: 3, title: "Health Scoring", sub: "DCMA-14 + 6", kind: "Skill", accent: "violet", icon: ic(ShieldAlert) },
      { id: "agent", c: 3, r: 1, n: 3, title: "NL → Cypher Agent", sub: "cited answers", kind: "Agent", accent: "blue", icon: ic(Bot), glow: true },
      { id: "whatif", c: 3, r: 2, n: 3, title: "What-if Sim", sub: "float cascade", kind: "Skill", accent: "violet", icon: ic(SlidersHorizontal) },
      { id: "report", c: 4, r: 0, n: 2, title: "Health Report", sub: "+ proposed fixes", kind: "Serve", accent: "fuchsia", icon: ic(LayoutDashboard) },
      { id: "narr", c: 4, r: 1, n: 2, title: "Weekly Narrative", sub: "what changed", kind: "Serve", accent: "sky", icon: ic(MessageSquare) },
    ],
    edges: [
      { from: "upload", to: "parser" },
      { from: "upload", to: "diff" },
      { from: "parser", to: "graph", label: "build" },
      { from: "diff", to: "graph" },
      { from: "graph", to: "health" },
      { from: "graph", to: "agent" },
      { from: "graph", to: "whatif" },
      { from: "health", to: "report" },
      { from: "whatif", to: "report" },
      { from: "agent", to: "narr" },
    ],
  },
  {
    id: "p02",
    name: "Shadow Schedule Engine",
    status: "Planned",
    horizon: "Horizon 2",
    pillar: "Know Reality",
    anchor: "Unsolved #1 + #2 · Corroborated commit & activity resolution",
    accent: "blue",
    icon: ic(ScanEye),
    blurb:
      "The product that earns the right to update the schedule. Resolves messy multilingual field signals to the correct activity, corroborates each claim across independent evidence, and commits only above a confidence gate — everything else goes to a human review queue. Never touches the contract P6.",
    cols: 6,
    nodes: [
      { id: "ingest", c: 0, r: 0, n: 1, title: "Multi-channel Ingest", sub: "WhatsApp · Procore · voice", kind: "Ingest", accent: "cyan", icon: ic(Radio) },
      { id: "extract", c: 1, r: 0, n: 1, title: "Entity Extraction", sub: "LLM", kind: "Skill", accent: "violet", icon: ic(Sparkles) },
      { id: "disambig", c: 2, r: 0, n: 1, title: "Disambiguation", sub: "4-signal → activity", kind: "Agent", accent: "blue", icon: ic(ScanEye), glow: true },
      { id: "corrob", c: 3, r: 0, n: 2, title: "Corroboration", sub: "4-signal credibility", kind: "Skill", accent: "violet", icon: ic(Layers) },
      { id: "trust", c: 3, r: 1, n: 2, title: "Trust Score", sub: "per-reporter", kind: "Data", accent: "amber", icon: ic(Gauge) },
      { id: "gate", c: 4, r: 0, n: 1, title: "Confidence Gate", sub: "≥ 0.80", kind: "Gate", accent: "rose", icon: ic(ShieldAlert) },
      { id: "shadow", c: 5, r: 0, n: 2, title: "Shadow Graph", sub: "FieldEvent nodes", kind: "Data", accent: "emerald", icon: ic(Network) },
      { id: "review", c: 5, r: 1, n: 2, title: "Review Queue", sub: "approve / reject", kind: "Serve", accent: "fuchsia", icon: ic(MessageSquare) },
    ],
    edges: [
      { from: "ingest", to: "extract" },
      { from: "extract", to: "disambig" },
      { from: "disambig", to: "corrob" },
      { from: "trust", to: "corrob", label: "signal" },
      { from: "corrob", to: "gate" },
      { from: "gate", to: "shadow", label: "auto" },
      { from: "gate", to: "review", label: "< 0.80" },
    ],
  },
  {
    id: "p03",
    name: "Constraint Intelligence",
    status: "Planned",
    horizon: "Horizon 2",
    pillar: "Know Reality",
    anchor: "Unsolved #5 + #7 · Make-ready & spatiotemporal conflict",
    accent: "violet",
    icon: ic(Workflow),
    blurb:
      "AI-assisted Last Planner. Models tasks alongside their constraints (RFI, submittal, material, crew) and spatial zones in the same graph, so 'what's blocking steel erection in 3 weeks?' and 'which trades collide on Level 3 East?' become one-hop queries.",
    cols: 4,
    nodes: [
      { id: "enrich", c: 0, r: 0, n: 2, title: "Zone + Trade NLP", sub: "SpatialZone · trade tag", kind: "Enrich", accent: "cyan", icon: ic(ScanEye) },
      { id: "cingest", c: 0, r: 1, n: 2, title: "Constraint Ingest", sub: "RFI · submittal · OAC", kind: "Ingest", accent: "orange", icon: ic(Plug) },
      { id: "graph", c: 1, r: 0, n: 1, title: "Neo4j Graph", sub: "+Constraint +Zone", kind: "Data", accent: "emerald", icon: ic(Network), glow: true },
      { id: "makeready", c: 2, r: 0, n: 2, title: "Make-ready Query", sub: "Task→BLOCKS→Constraint", kind: "Skill", accent: "violet", icon: ic(Workflow) },
      { id: "conflict", c: 2, r: 1, n: 2, title: "Conflict Detection", sub: "concurrent zone", kind: "Skill", accent: "violet", icon: ic(GitBranch) },
      { id: "board", c: 3, r: 0, n: 2, title: "Make-ready Board", sub: "+ alerts", kind: "Serve", accent: "fuchsia", icon: ic(LayoutDashboard) },
      { id: "report", c: 3, r: 1, n: 2, title: "Weekly Report", sub: "float at risk", kind: "Serve", accent: "sky", icon: ic(MessageSquare) },
    ],
    edges: [
      { from: "enrich", to: "graph" },
      { from: "cingest", to: "graph" },
      { from: "graph", to: "makeready" },
      { from: "graph", to: "conflict" },
      { from: "makeready", to: "board" },
      { from: "conflict", to: "board" },
      { from: "makeready", to: "report" },
    ],
  },
  {
    id: "p04",
    name: "Forensic Evidence",
    status: "Infra",
    horizon: "H1 infra → H2/H3",
    pillar: "Run the Project",
    anchor: "Unsolved #4 · Forensic delay & evidence graph",
    accent: "amber",
    icon: ic(ShieldAlert),
    blurb:
      "Contemporaneous, immutable, replayable schedule evidence captured as a byproduct of normal operation. Every graph change is an append-only event linked to its corroboration chain — so a TIA-ready delay narrative exports for any date range instead of being reconstructed at $350–600/hour.",
    cols: 4,
    nodes: [
      { id: "mut", c: 0, r: 0, n: 1, title: "Every Mutation", sub: "from 01 / 02 / 03", kind: "Capture", accent: "blue", icon: ic(Workflow) },
      { id: "proto", c: 1, r: 0, n: 2, title: "Write Protocol", sub: "insert → write → confirm", kind: "Capture", accent: "violet", icon: ic(GitBranch) },
      { id: "obj", c: 1, r: 1, n: 2, title: "Evidence Store", sub: "photos · hashes", kind: "Data", accent: "teal", icon: ic(Database) },
      { id: "events", c: 2, r: 0, n: 1, title: "schedule_events", sub: "append-only · immutable", kind: "Data", accent: "amber", icon: ic(Database), glow: true },
      { id: "play", c: 3, r: 0, n: 3, title: "State Playback", sub: "as-of any date", kind: "Serve", accent: "emerald", icon: ic(Layers) },
      { id: "chain", c: 3, r: 1, n: 3, title: "Evidence Chain", sub: "per update", kind: "Serve", accent: "fuchsia", icon: ic(Network) },
      { id: "tia", c: 3, r: 2, n: 3, title: "TIA Export", sub: "AACE 29R-03", kind: "Serve", accent: "rose", icon: ic(FileSearch) },
    ],
    edges: [
      { from: "mut", to: "proto" },
      { from: "proto", to: "events", label: "append" },
      { from: "obj", to: "events" },
      { from: "events", to: "play" },
      { from: "events", to: "chain" },
      { from: "events", to: "tia" },
    ],
  },
  {
    id: "p05",
    name: "Portfolio & Benchmark",
    status: "Planned",
    horizon: "Horizon 3",
    pillar: "Run the Project",
    anchor: "Unsolved #8 · Cross-project intelligence",
    accent: "fuchsia",
    icon: ic(LayoutDashboard),
    blurb:
      "Cross-project memory. Rolls every project's health, risk, and subcontractor performance into one executive view — and turns the accumulated corpus into an actuarial-grade benchmark dataset for insurers and sureties that exists nowhere else.",
    cols: 4,
    nodes: [
      { id: "perproj", c: 0, r: 0, n: 1, title: "Per-project Data", sub: "KG · events · trust", kind: "Source", accent: "sky", icon: ic(Network) },
      { id: "enrich", c: 1, r: 0, n: 2, title: "Cross-project Enrich", sub: "type · geo · trade · phase", kind: "Aggregate", accent: "violet", icon: ic(Layers) },
      { id: "wh", c: 1, r: 1, n: 2, title: "Analytics Warehouse", sub: "aggregated metrics", kind: "Data", accent: "amber", icon: ic(Database) },
      { id: "corpus", c: 2, r: 0, n: 1, title: "Benchmark Corpus", sub: "clean room · VPC", kind: "Data", accent: "emerald", icon: ic(Database), glow: true },
      { id: "dash", c: 3, r: 0, n: 3, title: "Portfolio Dashboard", sub: "float · SPI · ETA", kind: "Serve", accent: "fuchsia", icon: ic(LayoutDashboard) },
      { id: "bench", c: 3, r: 1, n: 3, title: "Benchmarking", sub: "vs similar projects", kind: "Serve", accent: "sky", icon: ic(Gauge) },
      { id: "insurer", c: 3, r: 2, n: 3, title: "Insurer Data Product", sub: "risk analytics", kind: "Serve", accent: "rose", icon: ic(ShieldAlert) },
    ],
    edges: [
      { from: "perproj", to: "enrich" },
      { from: "perproj", to: "wh" },
      { from: "enrich", to: "corpus" },
      { from: "wh", to: "corpus" },
      { from: "corpus", to: "dash" },
      { from: "corpus", to: "bench" },
      { from: "corpus", to: "insurer" },
    ],
  },
  {
    id: "p06",
    name: "Schedule Genesis",
    status: "Planned",
    horizon: "Horizon 2",
    pillar: "Know the Plan",
    anchor: "Unsolved #6 · No-planner SMB schedule genesis",
    accent: "cyan",
    icon: ic(MessageSquare),
    blurb:
      "A CPM schedule from a conversation, for the 96% of firms with no scheduler. Describe scope, duration, and trade sequence in plain language (or Hindi/Arabic) and get a logic-linked, P6-compatible schedule — then hand it straight to Schedule Intelligence.",
    cols: 4,
    nodes: [
      { id: "intake", c: 0, r: 0, n: 1, title: "Conversational Intake", sub: "scope · duration · trades", kind: "Ingest", accent: "cyan", icon: ic(MessageSquare) },
      { id: "gen", c: 1, r: 0, n: 1, title: "CPM Generation", sub: "WBS → activities → logic", kind: "Agent", accent: "blue", icon: ic(Bot), glow: true },
      { id: "qual", c: 2, r: 0, n: 2, title: "Quality Check", sub: "logic density · DCMA-lite", kind: "Skill", accent: "violet", icon: ic(ShieldAlert) },
      { id: "exp", c: 2, r: 1, n: 2, title: "P6 Export", sub: "MPXJ / XML", kind: "Tool", accent: "orange", icon: ic(Cpu) },
      { id: "handoff", c: 3, r: 0, n: 1, title: "→ Schedule Intelligence", sub: "ingest into 01", kind: "Serve", accent: "emerald", icon: ic(Network) },
    ],
    edges: [
      { from: "intake", to: "gen" },
      { from: "gen", to: "qual" },
      { from: "gen", to: "exp" },
      { from: "qual", to: "handoff" },
      { from: "exp", to: "handoff" },
    ],
  },
];

function blueprintNodes(p: Product): GNode[] {
  return p.nodes.map((bp) => ({
    id: bp.id,
    x: gridX(bp.c, p.cols),
    y: gridY(bp.r, bp.n),
    w: NW,
    h: NH,
    title: bp.title,
    sub: bp.sub,
    kind: bp.kind,
    accent: bp.accent,
    icon: bp.icon,
    glow: bp.glow,
  }));
}

/* ── status chip styles ──────────────────────────────────────────── */
const STATUS_STYLE: Record<Product["status"], string> = {
  Live: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  Beta: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  Infra: "border-blue-400/30 bg-blue-500/10 text-blue-300",
  Planned: "border-white/10 bg-white/[0.04] text-gray-400",
};

const LEGEND: { label: string; accent: GAccent }[] = [
  { label: "Client / Ingest", accent: "cyan" },
  { label: "Agent", accent: "blue" },
  { label: "Skill / Tool", accent: "violet" },
  { label: "Data / Graph", accent: "emerald" },
  { label: "Serve / Output", accent: "fuchsia" },
];

/* ── section wrapper ─────────────────────────────────────────────── */
function Section({
  eyebrow, title, desc, children,
}: {
  eyebrow: string; title: string; desc: string; children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-blue-400">{eyebrow}</p>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mb-7 max-w-2xl text-sm leading-relaxed text-gray-400">{desc}</p>
      </motion.div>
      {children}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
 *  PAGE
 * ════════════════════════════════════════════════════════════════════ */
export default function FutureArchitecture() {
  const [activeId, setActiveId] = useState(PRODUCTS[0].id);
  const active = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <motion.nav
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-slate-950/80 backdrop-blur-sm"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-fuchsia-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              Syncpro · Future Architecture
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
              to="/arch"
              className="rounded-md bg-white/[0.06] px-3 py-1.5 text-xs text-gray-200 transition-colors hover:bg-white/[0.1]"
            >
              Current Architecture
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative px-6 pb-4 pt-32">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[440px] w-[820px] -translate-x-1/2 rounded-full bg-fuchsia-600/[0.07] blur-[130px]" />
          <div className="absolute -top-20 left-1/3 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-blue-600/[0.07] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-gray-400">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
              Vision · Six products, one agentic core
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              The AI{" "}
              <span className="bg-gradient-to-r from-blue-400 to-fuchsia-400 bg-clip-text text-transparent">
                Project Controls Engineer
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-gray-400">
              Every product below is anchored on a ranked unsolved problem from the strategy
              corpus and built on one shared Platform Core. Each diagram is interactive —
              scroll to zoom, drag to pan.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="mx-auto mb-2 flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STROKE[l.accent] }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* ── 1 · Product constellation ─────────────────────────── */}
      <Section
        eyebrow="The Suite"
        title="Product constellation"
        desc="Six products on one Platform Core, ordered by horizon. Schedule Genesis feeds Schedule Intelligence (the base graph); Shadow Schedule and Constraint Intelligence extend it; everything writes to the immutable Forensic audit, which rolls up into Portfolio & Benchmark."
      >
        <ZoomableGraph nodes={CONSTELLATION_NODES} edges={CONSTELLATION_EDGES} width={1120} height={600} viewportH={560} />
      </Section>

      {/* ── 2 · Future platform stack ─────────────────────────── */}
      <Section
        eyebrow="The Platform"
        title="Future platform architecture"
        desc="The end-state stack is agent-first and event-sourced: clients flow through the gateway into an Agent Orchestrator that composes skills, routes models, and reads/writes a knowledge fabric — where every mutation lands in an append-only audit log."
      >
        <ZoomableGraph nodes={PLATFORM_NODES} edges={PLATFORM_EDGES} width={1500} height={700} viewportH={600} />
      </Section>

      {/* ── 3 · Product blueprints ────────────────────────────── */}
      <Section
        eyebrow="The Blueprints"
        title="Technical architecture, per product"
        desc="Pick a product to see its real pipeline — nodes sorted left to right in execution order, from ingestion through agents, skills, and data, to what it serves."
      >
        {/* selector */}
        <div className="mb-5 flex flex-wrap gap-2">
          {PRODUCTS.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-white/20 bg-white/[0.08] text-white"
                    : "border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:text-gray-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STROKE[p.accent] }} />
                {p.name}
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${STATUS_STYLE[p.status]}`}>
                  {p.status}
                </span>
              </button>
            );
          })}
        </div>

        {/* active product header */}
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-4 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${STROKE[active.accent]}1a`, color: STROKE[active.accent] }}
          >
            {active.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{active.name}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLE[active.status]}`}>
                {active.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-gray-400">
                {active.horizon}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-gray-400">
                {active.pillar}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-400">{active.blurb}</p>
            <p className="mt-1.5 font-mono text-[11px] text-gray-500">{active.anchor}</p>
          </div>
        </motion.div>

        <ZoomableGraph
          key={active.id}
          nodes={blueprintNodes(active)}
          edges={active.edges}
          width={BW}
          height={BH}
          viewportH={460}
        />
      </Section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-blue-600 to-fuchsia-600">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs text-gray-500">Syncpro — Future Architecture (vision)</span>
          </div>
          <p className="text-[11px] text-gray-600">
            Derived from the strategy corpus · full docs in Brainstorming/Products.
          </p>
        </div>
      </footer>
    </div>
  );
}
