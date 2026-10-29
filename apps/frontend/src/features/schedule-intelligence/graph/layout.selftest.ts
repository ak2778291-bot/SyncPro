// Layout invariants, checked against a graph shaped like the ones that broke it.
//
// Not imported by the app — nothing references this file, so it never reaches a
// bundle. Run it directly:
//
//   cd apps/frontend
//   ./node_modules/.bin/esbuild src/features/schedule-intelligence/graph/layout.selftest.ts \
//       --bundle --platform=node --format=cjs --outfile=/tmp/layout.cjs && node /tmp/layout.cjs
//
// It exists because a bad layout is silent. The graph always draws; it just
// stops telling the truth, and the specific lie — a dependency arrow pointing
// leftwards, or a WBS container sitting on top of its own children — is the kind
// of thing you stop seeing after looking at the screen for ten minutes. Two of
// thirty-eight containers were misplaced on a real 254-activity programme and
// nothing about the picture announced it.
import type { GraphEdge, GraphNode } from "@/shared/api/client";
import { layoutGraph, neighbourhood } from "./layout";

let failures = 0;

function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
  );
}

function section(title: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n-- ${title} ${"-".repeat(Math.max(0, 56 - title.length))}`);
}

function task(id: string, over: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    kind: "task",
    name: `Task ${id}`,
    uid: id,
    critical: false,
    start: null,
    finish: null,
    evidence_count: 0,
    reporter_count: 0,
    ...over,
  };
}

function wbs(id: string, name: string): GraphNode {
  return {
    id,
    kind: "wbs",
    name,
    uid: id,
    critical: false,
    start: null,
    finish: null,
    evidence_count: 0,
    reporter_count: 0,
  };
}

function logic(source: string, target: string, critical = false): GraphEdge {
  return { source, target, kind: "logic", rel_type: "FS", lag: null, critical };
}

function contains(source: string, target: string): GraphEdge {
  return { source, target, kind: "contains", rel_type: "HAS", lag: null, critical: false };
}

/* ── a chain with a branch that rejoins ──────────────────────────────────── */
section("longest-path layering");
{
  // a -> b -> c -> e  and  a -> d -> e. `e` must sit behind the LONGER path, or
  // the edge from `c` would point backwards.
  const nodes = ["a", "b", "c", "d", "e"].map((id) => task(id));
  const edges = [
    logic("a", "b"), logic("b", "c"), logic("c", "e"),
    logic("a", "d"), logic("d", "e"),
  ];
  const l = layoutGraph(nodes, edges);
  const at = (id: string) => l.byId.get(id)!;
  check("a chain lays out in order", at("a").layer < at("b").layer, true);
  check("a rejoining branch sits behind the longest path", at("e").layer, 3);
  check("no edge points backwards",
    edges.filter((e) => at(e.target).x <= at(e.source).x).length, 0);
}

/* ── containers, nested three deep ───────────────────────────────────────── */
section("WBS containers sit left of what they contain");
{
  // The shape that exposed the bug: Schedule > Stage > Mechanical > activity.
  const nodes = [
    wbs("W1", "Construction Schedule"),
    wbs("W2", "Construction Stage"),
    wbs("W3", "Mechanical"),
    task("t1"), task("t2"),
  ];
  const edges = [
    contains("W1", "W2"), contains("W2", "W3"),
    contains("W3", "t1"), contains("W1", "t2"),
    logic("t1", "t2"),
  ];
  const l = layoutGraph(nodes, edges);
  const at = (id: string) => l.byId.get(id)!;
  const misplaced = edges
    .filter((e) => e.kind === "contains")
    .filter((e) => at(e.source).x >= at(e.target).x);
  check("every container is left of its children", misplaced.length, 0);
  check("nesting order is preserved",
    at("W1").layer < at("W2").layer && at("W2").layer < at("W3").layer, true);
  check("a container never lands on a negative column",
    l.nodes.filter((n) => n.x < 0).length, 0);
}

/* ── malformed input must still draw ─────────────────────────────────────── */
section("degenerate input");
{
  check("an empty graph is an empty layout", layoutGraph([], []).nodes.length, 0);

  const cyc = layoutGraph(
    [task("a"), task("b")],
    [logic("a", "b"), logic("b", "a")],
  );
  check("a logic cycle still places both nodes", cyc.nodes.length, 2);
  check("a logic cycle produces finite coordinates",
    cyc.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), true);

  // A container cycle cannot terminate by agreement, only by the cap.
  const cycW = layoutGraph(
    [wbs("W1", "one"), wbs("W2", "two")],
    [contains("W1", "W2"), contains("W2", "W1")],
  );
  check("a containment cycle terminates", cycW.nodes.length, 2);
  check("a containment cycle produces finite coordinates",
    cycW.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), true);

  const orphan = layoutGraph([wbs("W9", "holds nothing")], []);
  check("a container with nothing in view does not stretch the canvas",
    orphan.width < 400, true);
}

/* ── no two nodes may occupy one point ───────────────────────────────────── */
section("no overlapping nodes");
{
  const nodes = Array.from({ length: 40 }, (_, i) => task(`n${i}`));
  // A wide fan: one root into 39 leaves, so a whole layer stacks vertically.
  const edges = nodes.slice(1).map((n) => logic("n0", n.id));
  const l = layoutGraph(nodes, edges);
  check("40 nodes occupy 40 distinct points",
    new Set(l.nodes.map((n) => `${n.x}:${n.y}`)).size, 40);
  check("the stage is tall enough for the widest layer", l.height > 39 * 40, true);
}

/* ── depth ───────────────────────────────────────────────────────────────── */
section("neighbourhood depth");
{
  const edges = [logic("a", "b"), logic("b", "c"), logic("c", "d")];
  check("depth 1 is the node and its immediate neighbours",
    [...neighbourhood("b", edges, 1)].sort(), ["a", "b", "c"]);
  check("depth 2 reaches two hops", [...neighbourhood("b", edges, 2)].sort(),
    ["a", "b", "c", "d"]);
  check("depth is undirected — it reaches predecessors too",
    neighbourhood("c", edges, 1).has("b"), true);
  check("an isolated node is its own neighbourhood",
    [...neighbourhood("z", [], 3)], ["z"]);
}

// eslint-disable-next-line no-console
console.log(
  failures ? `\nLAYOUT SELFTEST FAILED — ${failures} check(s)` : "\nLAYOUT SELFTEST PASSED",
);
if (typeof process !== "undefined") process.exit(failures ? 1 : 0);
