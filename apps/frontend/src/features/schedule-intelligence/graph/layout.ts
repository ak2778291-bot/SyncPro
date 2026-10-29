// Laying out a schedule graph — kept out of the component because it is the
// only part with a right answer, and a wrong one is silent: a graph always
// renders, it just stops being readable.
//
// A schedule is a DAG of finish-to-start logic, so it lays out left-to-right in
// dependency layers rather than by a force simulation. That is not a style
// preference. A force layout of a CPM network places an activity wherever its
// neighbours pull it, which destroys the one property a planner reads the graph
// for — that everything to the left must finish before anything to the right can
// start. Layers make the critical path a straight line across the canvas.
import type { GraphEdge, GraphNode } from "@/shared/api/client";

export type PositionedNode = GraphNode & {
  x: number;
  y: number;
  r: number;
  layer: number;
};

export type Layout = {
  nodes: PositionedNode[];
  byId: Map<string, PositionedNode>;
  width: number;
  height: number;
};

const X_GAP = 200;
const Y_GAP = 78;
const PAD_X = 90;
const PAD_Y = 64;

function radiusFor(node: GraphNode): number {
  if (node.kind === "wbs") return 17;
  if (node.kind === "milestone") return 19;
  return node.critical ? 20 : 18;
}

/** Longest-path layering over the logic edges.
 *
 * Longest path rather than shortest: an activity must sit to the right of *every*
 * predecessor, not just its earliest one, or an edge would point backwards and
 * the left-to-right reading would be a lie.
 *
 * Cycles should not exist in a CPM network but do arrive in real exported files.
 * Kahn's algorithm simply never emits a node inside one, so anything left over is
 * placed after everything that was ordered. Drawn imperfectly beats not drawn.
 */
function layerNodes(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const logic = edges.filter(
    (e) => e.kind === "logic" && ids.has(e.source) && ids.has(e.target),
  );

  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const id of ids) {
    successors.set(id, []);
    inDegree.set(id, 0);
  }
  for (const e of logic) {
    successors.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  for (const id of ids) layer.set(id, 0);

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  let settled = 0;
  while (queue.length) {
    const id = queue.shift()!;
    settled += 1;
    const here = layer.get(id) ?? 0;
    for (const next of successors.get(id) ?? []) {
      if (layer.get(next)! < here + 1) layer.set(next, here + 1);
      const remaining = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (settled < ids.size) {
    // Whatever is left is inside a cycle. Park it past the ordered part rather
    // than at layer 0, where it would sit on top of the true start activities.
    const beyond = Math.max(0, ...layer.values()) + 1;
    for (const [id, deg] of inDegree) if (deg > 0) layer.set(id, beyond);
  }

  // WBS nodes carry no logic, so layering leaves them all at 0. Place each one
  // just left of the earliest thing it contains, which is where a reader expects
  // a container to sit.
  //
  // Iterated to a fixed point rather than a couple of passes. Containers nest —
  // a real programme had Construction Schedule > Construction Stage > Mechanical
  // — and with a fixed pass count the answer depends on the order the containers
  // happen to be visited, which left two of thirty-eight sitting on top of their
  // own children. Seeding high and only ever moving left makes each step
  // monotone, so it converges regardless of order; the cap is a guard against a
  // containment cycle in malformed data, not an expected exit.
  const containment = edges.filter((e) => e.kind === "contains");
  const wbsIds = new Set(nodes.filter((n) => n.kind === "wbs").map((n) => n.id));
  if (wbsIds.size) {
    const childrenOf = new Map<string, string[]>();
    for (const e of containment) {
      if (!wbsIds.has(e.source) || !ids.has(e.target)) continue;
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
      childrenOf.get(e.source)!.push(e.target);
    }

    const ceiling = Math.max(0, ...layer.values()) + wbsIds.size + 1;
    for (const id of wbsIds) layer.set(id, ceiling);

    for (let pass = 0; pass <= wbsIds.size; pass += 1) {
      let moved = false;
      for (const id of wbsIds) {
        const children = childrenOf.get(id);
        if (!children?.length) continue;
        const target = Math.min(...children.map((c) => layer.get(c) ?? 0)) - 1;
        if (target < layer.get(id)!) {
          layer.set(id, target);
          moved = true;
        }
      }
      if (!moved) break;
    }

    // A container holding nothing that is currently in view never moved. Leaving
    // it at the ceiling would stretch the canvas across empty columns.
    for (const id of wbsIds) if (layer.get(id) === ceiling) layer.set(id, 0);
  }

  const lowest = Math.min(0, ...layer.values());
  if (lowest < 0) for (const [id, v] of layer) layer.set(id, v - lowest);
  return layer;
}

/** Order within each layer to reduce edge crossings.
 *
 * Plain barycentre sweeps: put each node at the average position of its
 * neighbours in the previous layer, repeatedly. Not optimal — crossing
 * minimisation is NP-hard — but a few sweeps remove most of the visual noise for
 * a fraction of the complexity of anything better.
 */
function orderWithinLayers(
  layers: Map<number, GraphNode[]>,
  edges: GraphEdge[],
): void {
  const preds = new Map<string, string[]>();
  for (const e of edges) {
    if (!preds.has(e.target)) preds.set(e.target, []);
    preds.get(e.target)!.push(e.source);
  }

  const indexOf = new Map<string, number>();
  const reindex = () => {
    for (const group of layers.values()) {
      group.forEach((n, i) => indexOf.set(n.id, i));
    }
  };
  reindex();

  const ordered = [...layers.keys()].sort((a, b) => a - b);
  for (let sweep = 0; sweep < 3; sweep += 1) {
    for (const key of ordered) {
      const group = layers.get(key)!;
      const weight = new Map<string, number>();
      group.forEach((n, i) => {
        const parents = (preds.get(n.id) ?? [])
          .map((p) => indexOf.get(p))
          .filter((v): v is number => v !== undefined);
        // A node with no predecessor in view keeps its current position rather
        // than collapsing to zero and dragging unrelated nodes to the top.
        weight.set(n.id, parents.length
          ? parents.reduce((a, b) => a + b, 0) / parents.length
          : i);
      });
      group.sort((a, b) => weight.get(a.id)! - weight.get(b.id)!);
      reindex();
    }
  }
}

export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  if (!nodes.length) {
    return { nodes: [], byId: new Map(), width: 600, height: 400 };
  }

  const layerOf = layerNodes(nodes, edges);
  const layers = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const key = layerOf.get(n.id) ?? 0;
    if (!layers.has(key)) layers.set(key, []);
    layers.get(key)!.push(n);
  }

  // Seed the order by planned start so the first sweep begins from something a
  // planner would recognise, then let the barycentre passes refine it.
  for (const group of layers.values()) {
    group.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")
      || a.name.localeCompare(b.name));
  }
  orderWithinLayers(layers, edges);

  const keys = [...layers.keys()].sort((a, b) => a - b);
  const tallest = Math.max(...keys.map((k) => layers.get(k)!.length));
  const height = PAD_Y * 2 + Math.max(1, tallest - 1) * Y_GAP;
  const width = PAD_X * 2 + Math.max(1, keys.length - 1) * X_GAP;

  const positioned: PositionedNode[] = [];
  keys.forEach((key, column) => {
    const group = layers.get(key)!;
    // Centre each column vertically, so a short layer does not hug the top.
    const span = (group.length - 1) * Y_GAP;
    const top = (height - span) / 2;
    group.forEach((n, row) => {
      positioned.push({
        ...n,
        x: PAD_X + column * X_GAP,
        y: top + row * Y_GAP,
        r: radiusFor(n),
        layer: key,
      });
    });
  });

  return {
    nodes: positioned,
    byId: new Map(positioned.map((n) => [n.id, n])),
    width,
    height,
  };
}

/** Node ids within `depth` hops of `rootId`, following edges in either
 *  direction. Undirected on purpose: a planner asking "what is around this"
 *  means both what feeds it and what it feeds. */
export function neighbourhood(
  rootId: string,
  edges: GraphEdge[],
  depth: number,
): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }

  const seen = new Set([rootId]);
  let frontier = [rootId];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacency.get(id) ?? []) {
        if (!seen.has(neighbour)) {
          seen.add(neighbour);
          next.push(neighbour);
        }
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return seen;
}
