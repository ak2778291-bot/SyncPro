// The project graph, drawn from data rather than served as a picture.
//
// This replaced an iframe holding a pyvis-rendered `graph.html`. The picture
// could not be searched, filtered, selected into, or styled with the rest of the
// product — and, more to the point, it could not show the thing this product
// exists to show. A planner opening the graph is asking two questions: what
// depends on what, and which of this has anyone actually reported on. The second
// question needs the as-reported state on the node, next to the as-planned one,
// which a rendered picture of the contract programme cannot carry.
//
// So committed field evidence is drawn on the node: a progress arc sized by the
// reported percentage and coloured by its variance against the time-phased plan.
// An activity nobody has reported on looks plainly different from one three
// people have, which is the whole point of putting it here instead of in a table.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileJson,
  Loader2,
  Maximize2,
  Minus,
  Network,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSchedule } from "@/features/projects/ScheduleContext";
import {
  getGraphData,
  type GraphEdge,
  type GraphNode,
  type GraphView,
} from "@/shared/api/client";
import { exceedsDragSlop, selectionAfterPress } from "./interaction";
import { layoutGraph, neighbourhood, type PositionedNode } from "./layout";

interface KGViewerProps {
  mode: "KG" | "JSON";
  setMode: React.Dispatch<React.SetStateAction<"KG" | "JSON">>;
  data: any[];
  graphReady: boolean;
}

type DepthOption = 1 | 2 | 3 | "all";
type ViewOption = "tasks" | "wbs" | "all";

/* ── palette ───────────────────────────────────────────────────────────────
 * Held as constants rather than Tailwind classes: these are SVG paint values,
 * and a class name that silently fails to apply to `stroke` would render an
 * invisible graph with no error. */
const C = {
  line: "rgba(148,163,184,0.22)",
  lineStrong: "rgba(148,163,184,0.38)",
  task: { fill: "#1e293b", stroke: "#64748b" },
  wbs: { fill: "#0f172a", stroke: "#94a3b8" },
  milestone: { fill: "rgba(56,189,248,0.14)", stroke: "#38bdf8" },
  critical: { fill: "rgba(244,63,94,0.14)", stroke: "#f43f5e" },
  selected: "#60a5fa",
  ahead: "#34d399",
  behind: "#fbbf24",
  onPlan: "#34d399",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textFaint: "#64748b",
};

function paintFor(node: PositionedNode) {
  if (node.critical) return C.critical;
  if (node.kind === "milestone") return C.milestone;
  if (node.kind === "wbs") return C.wbs;
  return C.task;
}

/** Colour of the reported-progress arc. Amber means the field is reporting less
 *  progress than the programme assumes at that date — the case worth noticing. */
function varianceColour(variance: number | null | undefined): string {
  if (variance == null) return C.onPlan;
  return variance < 0 ? C.behind : C.ahead;
}

/** P6 writes lag as a duration with a unit ("16.0h"), and a zero lag is the
 *  common case — printing "0.0h" against every link is noise that buries the
 *  handful that actually carry one. */
function formatLag(lag: string | null): string {
  if (!lag) return "";
  const magnitude = parseFloat(lag);
  if (!Number.isNaN(magnitude) && magnitude === 0) return "";
  return ` ${magnitude > 0 ? "+" : ""}${lag}`;
}

/** An SVG arc from 12 o'clock, clockwise, covering `percent` of the circle. */
function arcPath(cx: number, cy: number, r: number, percent: number): string {
  const fraction = Math.max(0, Math.min(100, percent)) / 100;
  if (fraction <= 0) return "";
  // A full circle cannot be expressed as a single arc — the start and end points
  // coincide and the renderer draws nothing at all.
  if (fraction >= 0.9999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
  }
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.08] overflow-hidden">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-2 py-1 text-[11px] transition-colors ${
            o.id === value
              ? "bg-white/[0.08] text-gray-100"
              : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-baseline py-[5px] border-b border-white/[0.05] last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-[11px] font-mono text-gray-300 whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-gray-500">
        {children}
      </span>
      {count !== undefined && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400 font-mono">
          {count}
        </span>
      )}
    </div>
  );
}

const KGViewer: React.FC<KGViewerProps> = ({ mode, setMode, data, graphReady }) => {
  const { activeProjectId } = useSchedule();
  const [graph, setGraph] = useState<GraphView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<DepthOption>(2);
  const [view, setView] = useState<ViewOption>("tasks");
  const [reportedOnly, setReportedOnly] = useState(false);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // The canvas captures the pointer so a pan keeps tracking outside the element.
  // Capture also retargets the compatibility mouse events, so a `click` handler
  // on a node never fires — pressing a node did nothing at all. Selection is
  // therefore resolved here: the node records its intent on pointerdown, and the
  // canvas commits it on pointerup if the pointer did not travel.
  const movedRef = useRef(false);
  const pendingSelectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setGraph(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getGraphData(activeProjectId)
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        setSelectedId(null);
        setTransform({ x: 0, y: 0, k: 1 });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setGraph(null);
        setError(e instanceof Error ? e.message : "Could not load the graph.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  /* ── which nodes are on screen ─────────────────────────────────────────── */
  const visible = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] as GraphEdge[] };

    let nodes = graph.nodes.filter((n) => {
      if (view === "tasks") return n.kind !== "wbs";
      if (view === "wbs") return n.kind === "wbs";
      return true;
    });
    if (reportedOnly) {
      // Keep WBS containers out of a "reported" view entirely — a container has
      // no evidence of its own and would render as an unexplained empty node.
      nodes = nodes.filter((n) => n.evidence_count > 0);
    }

    const term = query.trim().toLowerCase();
    if (term) {
      nodes = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(term) || n.uid.toLowerCase().includes(term),
      );
    }

    let ids = new Set(nodes.map((n) => n.id));
    // Depth applies only around a selection. With nothing selected it would have
    // no centre, and silently showing a subset of an unfiltered graph is worse
    // than showing all of it.
    if (selectedId && depth !== "all" && ids.has(selectedId)) {
      const near = neighbourhood(selectedId, graph.edges, depth);
      ids = new Set([...ids].filter((id) => near.has(id)));
      nodes = nodes.filter((n) => ids.has(n.id));
    }

    return {
      nodes,
      edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  }, [graph, view, query, depth, selectedId, reportedOnly]);

  const layout = useMemo(
    () => layoutGraph(visible.nodes, visible.edges),
    [visible],
  );

  // P6 ladders two activities together with an SS *and* an FF link, so a pair can
  // carry more than one relationship. Drawn as-is they stack exactly on top of
  // one another and the second is invisible — the picture says "one dependency"
  // where the programme says two. Collapsed to one line carrying both labels;
  // the detail panel still lists them separately, which is where the difference
  // between SS and FF actually matters.
  const drawnEdges = useMemo(() => {
    const merged = new Map<string, GraphEdge & { types: string[] }>();
    for (const e of visible.edges) {
      const key = `${e.kind}:${e.source}->${e.target}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...e, types: e.rel_type ? [e.rel_type] : [] });
        continue;
      }
      if (e.rel_type && !existing.types.includes(e.rel_type)) {
        existing.types.push(e.rel_type);
      }
      // A pair is critical if any of the links between them is.
      existing.critical = existing.critical || e.critical;
    }
    return [...merged.values()];
  }, [visible.edges]);

  // Resolved from the full node set, not from the laid-out (visible) one. A node
  // stays selected when a filter hides it, and blanking the panel in that case
  // reads as "the selection was lost" when it was not.
  const selected: GraphNode | null = useMemo(
    () => (selectedId && graph ? graph.nodes.find((n) => n.id === selectedId) ?? null : null),
    [graph, selectedId],
  );
  const selectedIsVisible = selectedId ? layout.byId.has(selectedId) : true;

  const relations = useMemo(() => {
    if (!graph || !selectedId) return { preds: [], succs: [] };
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const preds = graph.edges
      .filter((e) => e.kind === "logic" && e.target === selectedId)
      .map((e) => ({ node: byId.get(e.source), edge: e }))
      .filter((r) => r.node);
    const succs = graph.edges
      .filter((e) => e.kind === "logic" && e.source === selectedId)
      .map((e) => ({ node: byId.get(e.target), edge: e }))
      .filter((r) => r.node);
    return { preds, succs };
  }, [graph, selectedId]);

  /* ── pan / zoom ────────────────────────────────────────────────────────── */
  const fit = useCallback(() => setTransform({ x: 0, y: 0, k: 1 }), []);
  const zoomBy = useCallback((factor: number) => {
    setTransform((t) => ({ ...t, k: Math.max(0.25, Math.min(4, t.k * factor)) }));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Non-passive so the page does not scroll out from under the graph.
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setTransform((t) => {
        const k = Math.max(0.25, Math.min(4, t.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        // Keep the point under the cursor fixed while the scale changes.
        const ratio = k / t.k;
        return { k, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y };
    movedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // Panning only starts past the slop, so a node press that wobbles by a pixel
    // still selects instead of nudging the canvas.
    if (!movedRef.current && exceedsDragSlop(dx, dy)) movedRef.current = true;
    if (movedRef.current) setTransform((t) => ({ ...t, x: d.ox + dx, y: d.oy + dy }));
  };
  const onPointerUp = () => {
    const pending = pendingSelectRef.current;
    const moved = movedRef.current;
    setSelectedId((cur) => selectionAfterPress(pending, moved, cur));
    pendingSelectRef.current = null;
    dragRef.current = null;
    movedRef.current = false;
  };

  /* ── states before the graph ───────────────────────────────────────────── */
  const header = (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Network className="w-4 h-4 text-gray-500" />
          Knowledge Graph
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Project relationships, dependencies and what the field has reported
        </p>
      </div>
      <div className="flex items-center gap-2">
        {mode === "KG" && graph && (
          <div className="flex items-center gap-1">
            <Button variant="outline" onClick={() => zoomBy(1.2)}
              className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 h-8 w-8 p-0"
              title="Zoom in">
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" onClick={() => zoomBy(1 / 1.2)}
              className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 h-8 w-8 p-0"
              title="Zoom out">
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" onClick={fit}
              className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 h-8 w-8 p-0"
              title="Reset view">
              <Maximize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        <Button
          onClick={() => setMode(mode === "KG" ? "JSON" : "KG")}
          variant="outline"
          className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 text-xs"
        >
          {mode === "KG" ? <FileJson className="w-3.5 h-3.5 mr-1.5" /> : <Network className="w-3.5 h-3.5 mr-1.5" />}
          {mode === "KG" ? "JSON" : "Graph"}
        </Button>
      </div>
    </div>
  );

  if (mode === "JSON") {
    return (
      <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {header}
        <div className="rounded-xl bg-slate-900 border border-white/[0.06] p-5 overflow-auto max-h-[700px]">
          <pre className="text-xs text-gray-400 font-mono">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </motion.div>
    );
  }

  if (!graphReady || (!graph && !loading && !error)) {
    return (
      <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {header}
        <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
          <Network className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">Upload a schedule to generate the graph</p>
          <p className="text-xs text-gray-600 mt-1">Supported: .xer, .mpp, .pp, .xml, .mspdi</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {header}
        <div className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]">
          <Network className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </motion.div>
    );
  }

  const counts = graph?.counts;

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {header}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        {/* ── canvas ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900 flex flex-col overflow-hidden min-h-[560px]">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="text-sm text-gray-200">Project graph</span>
              {counts && (
                <span className="text-[11px] text-gray-500 truncate">
                  {counts.tasks} Task · {counts.wbs} WBS · {counts.relationships} rels
                  {counts.with_evidence > 0 && (
                    <span className="text-emerald-400/80"> · {counts.with_evidence} reported</span>
                  )}
                </span>
              )}
            </div>
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes…"
                className="w-48 bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/[0.16]"
              />
            </div>
          </div>

          <div
            ref={canvasRef}
            className="relative flex-1 overflow-hidden bg-[#0a0f1c] cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading graph…
              </div>
            ) : layout.nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <Network className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs text-gray-500">
                  {reportedOnly
                    ? "No activity has committed field evidence yet."
                    : "Nothing matches the current filters."}
                </p>
              </div>
            ) : (
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                preserveAspectRatio="xMidYMid meet"
                className="block select-none"
              >
                <defs>
                  <marker id="kg-arrow" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill={C.lineStrong} />
                  </marker>
                  <marker id="kg-arrow-crit" markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill={C.critical.stroke} opacity="0.7" />
                  </marker>
                </defs>

                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
                  {/* edges first, so nodes sit over them */}
                  {drawnEdges.map((e, i) => {
                    const a = layout.byId.get(e.source);
                    const b = layout.byId.get(e.target);
                    if (!a || !b) return null;
                    // Stop the line at the node's edge so the arrowhead is not
                    // buried under the circle it points at.
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const ux = dx / len;
                    const uy = dy / len;
                    const touching =
                      selectedId && (e.source === selectedId || e.target === selectedId);
                    return (
                      <line
                        key={`${e.source}-${e.target}-${e.kind}-${i}`}
                        x1={a.x + ux * (a.r + 2)}
                        y1={a.y + uy * (a.r + 2)}
                        x2={b.x - ux * (b.r + 7)}
                        y2={b.y - uy * (b.r + 7)}
                        stroke={e.critical ? C.critical.stroke : C.lineStrong}
                        strokeWidth={e.critical ? 1.8 : 1.1}
                        strokeDasharray={e.kind === "contains" ? "4 3" : undefined}
                        opacity={touching ? 1 : selectedId ? 0.35 : e.critical ? 0.7 : 0.55}
                        markerEnd={`url(#${e.critical ? "kg-arrow-crit" : "kg-arrow"})`}
                      />
                    );
                  })}

                  {layout.nodes.map((n) => {
                    const paint = paintFor(n);
                    const isSelected = n.id === selectedId;
                    const reported = n.shadow_percent_complete;
                    return (
                      <g
                        key={n.id}
                        // Not onClick: the canvas captures the pointer for
                        // panning, which retargets the click away from this
                        // element. The canvas commits the selection on pointerup.
                        onPointerDown={() => {
                          pendingSelectRef.current = n.id;
                        }}
                        className="cursor-pointer"
                        opacity={selectedId && !isSelected ? 0.82 : 1}
                      >
                        {isSelected && (
                          <circle cx={n.x} cy={n.y} r={n.r + 7} fill="none"
                            stroke={C.selected} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
                        )}
                        <circle cx={n.x} cy={n.y} r={n.r}
                          fill={paint.fill} stroke={paint.stroke}
                          strokeWidth={n.critical ? 2 : 1.5} />

                        {/* Reported progress, drawn on the node itself. The ring
                            is the reported percentage; its colour is the sign of
                            the variance against the time-phased plan. */}
                        {reported != null && (
                          <path
                            d={arcPath(n.x, n.y, n.r + 3.5, reported)}
                            fill="none"
                            stroke={varianceColour(n.variance)}
                            strokeWidth={2.4}
                            strokeLinecap="round"
                          />
                        )}

                        {n.kind === "wbs" && (
                          <text x={n.x} y={n.y + 3} textAnchor="middle"
                            fill={C.textDim} fontSize={7.5} fontWeight={600}
                            className="font-mono pointer-events-none">WBS</text>
                        )}
                        {n.kind === "milestone" && (
                          <text x={n.x} y={n.y + 3.5} textAnchor="middle"
                            fill={C.milestone.stroke} fontSize={8} fontWeight={700}
                            className="font-mono pointer-events-none">M</text>
                        )}
                        {n.kind === "task" && n.reporter_count > 1 && (
                          // Distinct people, not events — corroboration is what a
                          // planner is asking about, and it is a different number.
                          <text x={n.x} y={n.y + 3} textAnchor="middle"
                            fill={C.text} fontSize={8} fontWeight={600}
                            className="font-mono pointer-events-none">
                            {n.reporter_count}
                          </text>
                        )}

                        <text x={n.x} y={n.y + n.r + 14} textAnchor="middle"
                          fill={isSelected ? C.text : C.textDim} fontSize={8.5}
                          className="pointer-events-none">
                          {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            {/* legend */}
            <div className="absolute bottom-3 left-3 rounded-lg border border-white/[0.08] bg-slate-900/90 backdrop-blur px-2.5 py-2 flex flex-col gap-1.5 pointer-events-none">
              {[
                { label: "Task", fill: C.task.fill, stroke: C.task.stroke },
                { label: "WBS", fill: C.wbs.fill, stroke: C.wbs.stroke },
                { label: "Milestone", fill: C.milestone.fill, stroke: C.milestone.stroke },
                { label: "Critical", fill: C.critical.fill, stroke: C.critical.stroke },
                { label: "Selected", fill: "transparent", stroke: C.selected, dashed: true },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2 text-[10.5px] text-gray-400 whitespace-nowrap">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: l.fill, border: `1.5px ${l.dashed ? "dashed" : "solid"} ${l.stroke}` }} />
                  {l.label}
                </div>
              ))}
              <div className="h-px bg-white/[0.08] my-0.5" />
              <div className="flex items-center gap-2 text-[10.5px] text-gray-400 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ border: `2px solid ${C.ahead}` }} />
                Reported, at or ahead of plan
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-gray-400 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ border: `2px solid ${C.behind}` }} />
                Reported, behind plan
              </div>
            </div>
          </div>

          {/* foot toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2 border-t border-white/[0.06]">
            <span className="text-[11px] text-gray-500">Depth</span>
            <Seg<DepthOption>
              value={depth}
              onChange={setDepth}
              options={[
                { id: 1, label: "1" },
                { id: 2, label: "2" },
                { id: 3, label: "3" },
                { id: "all", label: "All" },
              ]}
            />
            <span className="w-px h-4 bg-white/[0.08]" />
            <span className="text-[11px] text-gray-500">View</span>
            <Seg<ViewOption>
              value={view}
              onChange={setView}
              options={[
                { id: "tasks", label: "Tasks" },
                { id: "wbs", label: "WBS" },
                { id: "all", label: "All" },
              ]}
            />
            <span className="w-px h-4 bg-white/[0.08]" />
            <button
              type="button"
              onClick={() => setReportedOnly((v) => !v)}
              disabled={!graph?.evidence_visible}
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors disabled:opacity-40 ${
                reportedOnly
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] text-gray-500 hover:text-gray-300"
              }`}
              title={
                graph?.evidence_visible
                  ? "Show only activities with committed field evidence"
                  : "Reported state is not visible with your access"
              }
            >
              Reported only
            </button>
            <div className="flex-1" />
            {depth !== "all" && !selectedId && (
              <span className="text-[10px] text-gray-600">
                Select a node to apply depth
              </span>
            )}
            {graph?.truncated && (
              <span className="text-[10px] text-amber-300/80">
                showing {graph.max_nodes} of {counts?.total_tasks} activities
              </span>
            )}
          </div>
        </div>

        {/* ── detail ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-slate-900 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-sm text-gray-200">Node detail</span>
            {selected && (
              <button onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selected && !selectedIsVisible && (
            <p className="px-4 py-2 text-[10.5px] text-amber-200/80 border-b border-white/[0.06]">
              Hidden by the current filters — still selected.
            </p>
          )}

          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Network className="w-7 h-7 text-gray-700 mb-2" />
              <p className="text-xs text-gray-500">Select a node to inspect it</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Its properties, logic and reported state appear here.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 pt-3.5 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-300 capitalize">
                    {selected.kind}
                  </span>
                  {selected.critical && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Critical
                    </span>
                  )}
                  {selected.evidence_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                      {selected.evidence_count} report{selected.evidence_count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-100 leading-snug mt-2">{selected.name}</p>
                <p className="text-[11px] font-mono text-gray-600 mt-1.5">
                  :{selected.kind === "wbs" ? "WBS" : "Task"}
                </p>
              </div>

              <div className="px-4 py-3 border-b border-white/[0.06]">
                <SectionLabel>Properties</SectionLabel>
                <Row label="UID">{selected.uid}</Row>
                {selected.duration_days != null && (
                  <Row label="Duration">{selected.duration_days}d</Row>
                )}
                <Row label="Start">{selected.start ?? "—"}</Row>
                <Row label="Finish">{selected.finish ?? "—"}</Row>
                {selected.total_float_days != null && (
                  <Row label="Total float">
                    <span className={selected.total_float_days <= 0 ? "text-rose-300" : ""}>
                      {selected.total_float_days}d
                    </span>
                  </Row>
                )}
                <Row label="Critical path">
                  <span className={selected.critical ? "text-rose-300" : "text-gray-500"}>
                    {String(selected.critical)}
                  </span>
                </Row>
                {selected.wbs_name && (
                  <Row label="WBS">{selected.wbs_name}</Row>
                )}
              </div>

              {/* The reason this panel exists on a graph rather than only in a
                  table: planned and reported side by side, with who said so. */}
              {graph?.evidence_visible && selected.kind !== "wbs" && (
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <SectionLabel count={selected.reporter_count || undefined}>
                    Field reality
                  </SectionLabel>
                  {selected.evidence_count === 0 ? (
                    <p className="text-[11px] text-gray-600">
                      Nothing has been reported against this activity yet.
                    </p>
                  ) : (
                    <>
                      <Row label="Planned at report date">
                        {selected.planned_percent_complete == null
                          ? "—"
                          : `${selected.planned_percent_complete}%`}
                      </Row>
                      <Row label="Reported">
                        <span className="text-gray-100">
                          {selected.shadow_percent_complete == null
                            ? "—"
                            : `${selected.shadow_percent_complete}%`}
                        </span>
                      </Row>
                      <Row label="Variance">
                        <span style={{ color: varianceColour(selected.variance) }}>
                          {selected.variance == null
                            ? "—"
                            : `${selected.variance > 0 ? "+" : ""}${selected.variance}%`}
                        </span>
                      </Row>
                      <Row label="Reported by">
                        {selected.last_reported_by ?? (
                          <span className="text-gray-600 italic">unknown</span>
                        )}
                      </Row>
                      <Row label="Channel">{selected.last_source_channel ?? "—"}</Row>
                      <Row label="As of">
                        {selected.shadow_reported_at?.slice(0, 10) ?? "—"}
                      </Row>
                      <Row label="Distinct reporters">{selected.reporter_count}</Row>
                    </>
                  )}
                </div>
              )}

              <div className="px-4 py-3 border-b border-white/[0.06]">
                <SectionLabel count={relations.preds.length}>Predecessors</SectionLabel>
                {relations.preds.length === 0 ? (
                  <p className="text-[11px] text-gray-600">None.</p>
                ) : (
                  relations.preds.map(({ node, edge }) => (
                    <button
                      key={`p-${node!.id}`}
                      onClick={() => setSelectedId(node!.id)}
                      className="w-full grid grid-cols-[1fr_auto] gap-2 items-center py-1.5 border-b border-white/[0.05] last:border-0 text-left hover:bg-white/[0.02]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] text-gray-300 truncate">{node!.name}</span>
                        <span className="block text-[10px] font-mono text-gray-600">{node!.uid}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400">
                        {edge.rel_type ?? "—"}{formatLag(edge.lag)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-3 border-b border-white/[0.06]">
                <SectionLabel count={relations.succs.length}>Successors</SectionLabel>
                {relations.succs.length === 0 ? (
                  <p className="text-[11px] text-gray-600">None.</p>
                ) : (
                  relations.succs.map(({ node, edge }) => (
                    <button
                      key={`s-${node!.id}`}
                      onClick={() => setSelectedId(node!.id)}
                      className="w-full grid grid-cols-[1fr_auto] gap-2 items-center py-1.5 border-b border-white/[0.05] last:border-0 text-left hover:bg-white/[0.02]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] text-gray-300 truncate">{node!.name}</span>
                        <span className="block text-[10px] font-mono text-gray-600">{node!.uid}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400">
                        {edge.rel_type ?? "—"}{formatLag(edge.lag)}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-3">
                <SectionLabel>Relationship</SectionLabel>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2.5">
                  <pre className="text-[10.5px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap break-all">
{`(:${selected.kind === "wbs" ? "WBS" : "Task"} {UID: "${selected.uid}"})`}
{selected.wbs_name ? `\n  <-[:HAS]-\n  (:WBS {name: "${selected.wbs_name}"})` : ""}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default KGViewer;
