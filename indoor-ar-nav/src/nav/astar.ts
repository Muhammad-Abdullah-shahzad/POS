import type { NavGraph, NavNode } from '../types';

export interface PathResult {
  /** Ordered node ids from start to goal (inclusive). */
  path: string[];
  /** Total cost (metres, plus floor-change penalty). */
  distance: number;
}

/** Penalty added per floor changed, so the planner prefers same-floor routes. */
const FLOOR_CHANGE_PENALTY = 10;

/** Straight-line cost between two nodes — also the A* heuristic (admissible). */
function cost(a: NavNode, b: NavNode): number {
  const planar = Math.hypot(a.x - b.x, a.z - b.z);
  return planar + Math.abs(a.floor - b.floor) * FLOOR_CHANGE_PENALTY;
}

function buildAdjacency(graph: NavGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from); // edges are undirected
  }
  return adjacency;
}

function reconstruct(cameFrom: Map<string, string>, goalId: string): string[] {
  const path = [goalId];
  let current = goalId;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

/**
 * A* shortest path over the nav-graph. Pure: no AR, DOM or Three.js.
 * Returns `null` if either endpoint is unknown or no path exists.
 */
export function findPath(graph: NavGraph, startId: string, goalId: string): PathResult | null {
  const nodes = new Map<string, NavNode>(graph.nodes.map((n) => [n.id, n]));
  const start = nodes.get(startId);
  const goal = nodes.get(goalId);
  if (!start || !goal) return null;
  if (startId === goalId) return { path: [startId], distance: 0 };

  const adjacency = buildAdjacency(graph);
  const gScore = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, string>();
  const open = new Set<string>([startId]);
  const heuristic = (id: string): number => cost(nodes.get(id)!, goal);

  while (open.size > 0) {
    // Pick the open node with the lowest f = g + h.
    let current: string | null = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = (gScore.get(id) ?? Infinity) + heuristic(id);
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }
    if (current === null) break;

    if (current === goalId) {
      return { path: reconstruct(cameFrom, goalId), distance: gScore.get(goalId)! };
    }

    open.delete(current);
    const currentNode = nodes.get(current)!;
    for (const neighbor of adjacency.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Infinity) + cost(currentNode, nodes.get(neighbor)!);
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        open.add(neighbor);
      }
    }
  }

  return null; // goal unreachable
}
