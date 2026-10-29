import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";

/* ──────────────────────────────────────────────────────────────────
 * ZoomableGraph — a pan/zoom canvas that renders a node-and-edge graph.
 *   • wheel to zoom toward the cursor
 *   • drag to pan
 *   • +/−/fit controls (top-right)
 *   • curved, auto-routed, animated "flow" edges with arrowheads
 * Coordinates are in a fixed virtual stage (width × height); the canvas
 * scales the whole stage to fit, so any layout just works.
 * ────────────────────────────────────────────────────────────────── */

export type GAccent =
  | "sky"
  | "blue"
  | "emerald"
  | "amber"
  | "fuchsia"
  | "orange"
  | "cyan"
  | "violet"
  | "rose"
  | "teal"
  | "indigo"
  | "lime";

const G_ACCENT: Record<
  GAccent,
  { border: string; iconBg: string; iconText: string; stroke: string }
> = {
  sky: { border: "border-sky-400/30", iconBg: "bg-sky-500/10", iconText: "text-sky-300", stroke: "#38bdf8" },
  blue: { border: "border-blue-400/40", iconBg: "bg-blue-500/15", iconText: "text-blue-300", stroke: "#60a5fa" },
  emerald: { border: "border-emerald-400/30", iconBg: "bg-emerald-500/10", iconText: "text-emerald-300", stroke: "#34d399" },
  amber: { border: "border-amber-400/30", iconBg: "bg-amber-500/10", iconText: "text-amber-300", stroke: "#fbbf24" },
  fuchsia: { border: "border-fuchsia-400/30", iconBg: "bg-fuchsia-500/10", iconText: "text-fuchsia-300", stroke: "#e879f9" },
  orange: { border: "border-orange-400/30", iconBg: "bg-orange-500/10", iconText: "text-orange-300", stroke: "#fb923c" },
  cyan: { border: "border-cyan-400/30", iconBg: "bg-cyan-500/10", iconText: "text-cyan-300", stroke: "#22d3ee" },
  violet: { border: "border-violet-400/30", iconBg: "bg-violet-500/10", iconText: "text-violet-300", stroke: "#a78bfa" },
  rose: { border: "border-rose-400/30", iconBg: "bg-rose-500/10", iconText: "text-rose-300", stroke: "#fb7185" },
  teal: { border: "border-teal-400/30", iconBg: "bg-teal-500/10", iconText: "text-teal-300", stroke: "#2dd4bf" },
  indigo: { border: "border-indigo-400/40", iconBg: "bg-indigo-500/15", iconText: "text-indigo-300", stroke: "#818cf8" },
  lime: { border: "border-lime-400/30", iconBg: "bg-lime-500/10", iconText: "text-lime-300", stroke: "#a3e635" },
};

export interface GNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  kind?: string;
  accent: GAccent;
  icon?: ReactNode;
  glow?: boolean;
}

export interface GEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

/* ── Geometry ─────────────────────────────────────────────────────── */
type Pt = { x: number; y: number };

function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Route an edge between two node boxes, exiting/entering on the sides
 *  that face each other for a clean, readable curve. */
function edgePath(a: GNode, b: GNode) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;

  let s: Pt, e: Pt, c1: Pt, c2: Pt;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sx = dx >= 0 ? a.x + a.w : a.x;
    const ex = dx >= 0 ? b.x : b.x + b.w;
    s = { x: sx, y: ac.y };
    e = { x: ex, y: bc.y };
    const k = Math.max(40, Math.abs(ex - sx) * 0.5);
    c1 = { x: sx + (dx >= 0 ? k : -k), y: s.y };
    c2 = { x: ex - (dx >= 0 ? k : -k), y: e.y };
  } else {
    const sy = dy >= 0 ? a.y + a.h : a.y;
    const ey = dy >= 0 ? b.y : b.y + b.h;
    s = { x: ac.x, y: sy };
    e = { x: bc.x, y: ey };
    const k = Math.max(40, Math.abs(ey - sy) * 0.5);
    c1 = { x: s.x, y: sy + (dy >= 0 ? k : -k) };
    c2 = { x: e.x, y: ey - (dy >= 0 ? k : -k) };
  }
  const d = `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
  return { d, mid: bezierAt(s, c1, c2, e, 0.5) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  nodes: GNode[];
  edges: GEdge[];
  width: number;
  height: number;
  /** canvas viewport height in px (default 540) */
  viewportH?: number;
  minScale?: number;
  maxScale?: number;
}

export default function ZoomableGraph({
  nodes,
  edges,
  width,
  height,
  viewportH = 540,
  minScale = 0.35,
  maxScale = 2.4,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const nodeById = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, GNode>,
    [nodes],
  );

  /* fit the whole stage into the viewport */
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const pad = 56;
    const s = clamp(Math.min((cw - pad) / width, (ch - pad) / height), minScale, maxScale);
    setView({ scale: s, tx: (cw - width * s) / 2, ty: (ch - height * s) / 2 });
  }, [width, height, minScale, maxScale]);

  // re-fit on mount and whenever the graph data changes (e.g. product switch)
  useLayoutEffect(() => {
    fit();
  }, [fit, nodes, edges]);

  // non-passive wheel listener so we can preventDefault page scroll
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const ns = clamp(v.scale * (1 - e.deltaY * 0.0012), minScale, maxScale);
        const k = ns / v.scale;
        return { scale: ns, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [minScale, maxScale]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: viewRef.current.tx, ty: viewRef.current.ty };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const zoomBy = (f: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    setView((v) => {
      const ns = clamp(v.scale * f, minScale, maxScale);
      const k = ns / v.scale;
      return { scale: ns, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
    });
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full cursor-grab touch-none overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.012] active:cursor-grabbing"
      style={{ height: viewportH }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      <style>{`@keyframes zgFlow { to { stroke-dashoffset: -120; } }
        .zg-flow { animation: zgFlow 1.6s linear infinite; }`}</style>

      {/* transformed stage */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width,
          height,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        {/* edges */}
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} fill="none">
          <defs>
            <marker
              id="zg-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="3"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L7,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const from = nodeById[edge.from];
            const to = nodeById[edge.to];
            if (!from || !to) return null;
            const { d } = edgePath(from, to);
            const stroke = G_ACCENT[to.accent].stroke;
            return (
              <g key={i}>
                <path
                  d={d}
                  stroke={stroke}
                  strokeOpacity={0.28}
                  strokeWidth={1.5}
                  strokeDasharray={edge.dashed ? "5 6" : undefined}
                  markerEnd="url(#zg-arrow)"
                />
                <path
                  className="zg-flow"
                  d={d}
                  stroke={stroke}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray="0.1 11"
                  style={{ animationDelay: `${(i % 6) * 0.18}s` }}
                />
              </g>
            );
          })}
        </svg>

        {/* edge labels */}
        {edges.map((edge, i) => {
          const from = nodeById[edge.from];
          const to = nodeById[edge.to];
          if (!from || !to || !edge.label) return null;
          const { mid } = edgePath(from, to);
          return (
            <div
              key={`lbl-${i}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/[0.08] bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] text-gray-300 backdrop-blur-sm"
              style={{ left: mid.x, top: mid.y }}
            >
              {edge.label}
            </div>
          );
        })}

        {/* nodes */}
        {nodes.map((n, i) => {
          const a = G_ACCENT[n.accent];
          return (
            <motion.div
              key={n.id}
              className={`absolute z-20 flex flex-col justify-center rounded-2xl border bg-slate-900/80 p-4 shadow-xl shadow-black/30 backdrop-blur-sm ${a.border}`}
              style={{
                left: n.x,
                top: n.y,
                width: n.w,
                height: n.h,
                boxShadow: n.glow ? `0 0 40px -8px ${a.stroke}` : undefined,
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.5) }}
            >
              <div className="mb-2 flex items-center gap-2.5">
                {n.icon && (
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.iconBg} ${a.iconText}`}>
                    {n.icon}
                  </div>
                )}
                {n.kind && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${a.iconBg} ${a.iconText}`}>
                    {n.kind}
                  </span>
                )}
              </div>
              <div className="text-[15px] font-semibold leading-tight text-white">{n.title}</div>
              {n.sub && <div className="mt-0.5 text-xs leading-snug text-gray-400">{n.sub}</div>}
            </motion.div>
          );
        })}
      </div>

      {/* controls */}
      <div className="absolute right-3 top-3 z-30 flex flex-col gap-1.5">
        <button
          onClick={() => zoomBy(1.25)}
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-slate-900/80 text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-slate-900/80 text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={fit}
          aria-label="Fit to view"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-slate-900/80 text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* hint + zoom level */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex items-center gap-2 rounded-full border border-white/[0.06] bg-slate-950/70 px-2.5 py-1 text-[10px] text-gray-500 backdrop-blur-sm">
        <span>scroll to zoom · drag to pan</span>
        <span className="text-gray-600">·</span>
        <span className="tabular-nums text-gray-400">{Math.round(view.scale * 100)}%</span>
      </div>
    </div>
  );
}
