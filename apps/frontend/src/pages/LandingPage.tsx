import { motion, useInView } from "framer-motion";
import {
  BarChart3,
  Upload,
  Network,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  FileText,
  Zap,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Link } from "react-router-dom";
import { useRef } from "react";

/* ── Fade-in wrapper ─────────────────────────────────────────── */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Data ─────────────────────────────────────────────────────── */
const USE_CASES = [
  {
    num: "01",
    title: "Upload",
    description:
      "Import your project schedule in any standard format. Our parser extracts every task, dependency, and milestone automatically.",
    icon: <Upload className="w-5 h-5" />,
  },
  {
    num: "02",
    title: "Analyze",
    description:
      "Build a Neo4j Knowledge Graph from your schedule. Instantly see critical paths, WBS structures, and hidden dependencies.",
    icon: <Network className="w-5 h-5" />,
  },
  {
    num: "03",
    title: "Visualize",
    description:
      "Interactive flowline charts and Gantt views give you a complete picture of project progress across every WBS group.",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    num: "04",
    title: "Chat",
    description:
      "Ask questions in plain English. Our AI translates your query into Cypher, runs it against your graph, and returns precise answers.",
    icon: <MessageSquare className="w-5 h-5" />,
  },
];

const CAPABILITIES = [
  {
    icon: <FileText className="w-4 h-4" />,
    label: "Schedule Parsing",
    detail: "MPP · PP · XML · MSPDI",
  },
  {
    icon: <Network className="w-4 h-4" />,
    label: "Knowledge Graph",
    detail: "Neo4j-backed graph DB",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "Flowline & Gantt",
    detail: "Location-based views",
  },
  {
    icon: <MessageSquare className="w-4 h-4" />,
    label: "AI Chat",
    detail: "Natural language queries",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    label: "Multi-Project",
    detail: "Per-user isolation",
  },
  {
    icon: <Zap className="w-4 h-4" />,
    label: "Real-Time",
    detail: "Instant graph updates",
  },
];

/* ── Page ─────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-slate-950/80 backdrop-blur-sm"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">
              SyncPro
            </span>
          </div>
          <Link to="/login">
            <Button
              size="sm"
              className="text-xs px-5 py-2 bg-white text-slate-950 hover:bg-gray-200 cursor-pointer font-medium transition-colors"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-6">
        {/* Subtle top gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/[0.06] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Pill */}
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-xs text-gray-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              AI-Powered Construction Schedule Intelligence
            </div>
          </Reveal>

          {/* Heading */}
          <Reveal delay={0.05}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight mb-6">
              Upload. Analyze.
              <br />
              <span className="text-blue-400">De-risk. Deliver.</span>
            </h1>
          </Reveal>

          {/* Sub */}
          <Reveal delay={0.1}>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Transform your project schedules into interactive knowledge graphs.
              Get AI-driven critical path analysis, flowline visualizations, and
              natural-language insights — all in one platform.
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={0.15}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="text-sm px-8 py-5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer font-medium transition-colors"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-sm px-8 py-5 bg-transparent border-white/[0.1] text-gray-300 hover:bg-white/[0.04] hover:text-white cursor-pointer transition-colors"
                >
                  See How It Works
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Supported Formats ────────────────────────────────── */}
      <section className="py-12 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-widest text-gray-600 mb-6">
              Works with your existing schedules
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {[
                { name: "Microsoft Project", ext: ".mpp" },
                { name: "Powerproject", ext: ".pp" },
                { name: "Primavera XML", ext: ".xml" },
                { name: "MSPDI", ext: ".mspdi" },
              ].map((f) => (
                <div
                  key={f.ext}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]"
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-300">{f.name}</span>
                    <span className="ml-2 text-xs text-gray-600">{f.ext}</span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How It Works — Use Cases ─────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <p className="text-xs uppercase tracking-widest text-blue-400 font-medium mb-3">
              How It Works
            </p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              From schedule file to
              <br />
              actionable intelligence
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-gray-500 max-w-xl mb-16 text-base">
              Four steps to transform a static project file into a living, queryable knowledge base.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {USE_CASES.map((uc, idx) => (
              <Reveal key={uc.num} delay={0.05 * idx}>
                <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] p-7 transition-colors duration-300">
                  {/* Number */}
                  <span className="text-[64px] font-bold leading-none text-white/[0.04] absolute top-4 right-6 select-none group-hover:text-white/[0.07] transition-colors">
                    {uc.num}
                  </span>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center mb-4">
                      {uc.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{uc.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md">
                      {uc.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Capabilities ────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left — text */}
            <div>
              <Reveal>
                <p className="text-xs uppercase tracking-widest text-blue-400 font-medium mb-3">
                  One Platform
                </p>
              </Reveal>
              <Reveal delay={0.05}>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
                  All your schedule intelligence
                  <br />
                  capabilities — in one place
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
                  Upload schedules, build knowledge graphs, explore flowlines, run critical
                  path analysis, and query your data with AI — all from a unified workspace
                  designed for construction teams.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <Link to="/signup">
                  <Button className="text-sm px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer font-medium transition-colors">
                    Start Building
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Reveal>
            </div>

            {/* Right — capability grid */}
            <div className="grid grid-cols-2 gap-3">
              {CAPABILITIES.map((cap, idx) => (
                <Reveal key={cap.label} delay={0.05 * idx}>
                  <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] text-gray-400 flex items-center justify-center mb-3">
                      {cap.icon}
                    </div>
                    <h4 className="text-sm font-medium text-gray-200 mb-0.5">{cap.label}</h4>
                    <p className="text-xs text-gray-500">{cap.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats / Social Proof Bar ─────────────────────────── */}
      <section className="py-10 border-y border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {[
            { value: "Neo4j", sub: "Graph Database" },
            { value: "Groq", sub: "LLM Inference" },
            { value: "AI Chat", sub: "Natural Language" },
            { value: "Real-Time", sub: "Knowledge Graphs" },
          ].map((s) => (
            <div key={s.value} className="text-center px-2">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to transform your
              <br />
              project schedules?
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="text-gray-500 mb-8 text-base max-w-lg mx-auto">
              Upload your first schedule and get a working knowledge graph in
              minutes. No setup, no credit card.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <Link to="/signup">
              <Button
                size="lg"
                className="text-sm px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer font-medium transition-colors"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs text-gray-500">SyncPro</span>
          </div>
          <p className="text-[11px] text-gray-600">
            © {new Date().getFullYear()} SyncPro. Built for construction teams.
          </p>
        </div>
      </footer>
    </div>
  );
}
