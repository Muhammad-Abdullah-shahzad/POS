import type { NavGraph, NavNode, Route, Waypoint } from '../types';
import { findPath } from './astar';

function toWaypoint(node: NavNode): Waypoint {
  return { nodeId: node.id, label: node.label, x: node.x, z: node.z, floor: node.floor };
}

function planarDistance(a: Waypoint, b: Waypoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Plan a route between two nodes: A* path → ordered waypoints with per-leg and
 * total walking distance. Pure and framework-agnostic.
 */
export function buildRoute(graph: NavGraph, startId: string, goalId: string): Route | null {
  const result = findPath(graph, startId, goalId);
  if (!result) return null;

  const nodes = new Map<string, NavNode>(graph.nodes.map((n) => [n.id, n]));
  const waypoints = result.path.map((id) => toWaypoint(nodes.get(id)!));

  const legDistances: number[] = [];
  for (let i = 1; i < waypoints.length; i += 1) {
    legDistances.push(planarDistance(waypoints[i - 1], waypoints[i]));
  }
  const totalDistance = legDistances.reduce((sum, d) => sum + d, 0);

  return { waypoints, legDistances, totalDistance };
}

/** Distance still to walk, counting from the given leg onward. */
export function remainingDistance(route: Route, fromLeg = 0): number {
  return route.legDistances.slice(Math.max(0, fromLeg)).reduce((sum, d) => sum + d, 0);
}

/**
 * Human-friendly "next turn" hint for the leg starting at `legIndex`.
 * Uses the signed turn angle between the incoming and outgoing leg directions.
 */
export function nextTurnHint(route: Route, legIndex = 0): string {
  const wps = route.waypoints;
  if (wps.length < 2) return 'You have arrived';
  if (legIndex >= wps.length - 1) return 'You have arrived';

  const next = wps[legIndex + 1];
  if (legIndex === 0) return `Head toward ${next.label}`;

  const prev = wps[legIndex - 1];
  const cur = wps[legIndex];
  const inDir = { x: cur.x - prev.x, z: cur.z - prev.z };
  const outDir = { x: next.x - cur.x, z: next.z - cur.z };

  const cross = inDir.x * outDir.z - inDir.z * outDir.x;
  const dot = inDir.x * outDir.x + inDir.z * outDir.z;
  const angle = (Math.atan2(cross, dot) * 180) / Math.PI;

  if (Math.abs(angle) < 25) return `Continue to ${next.label}`;
  return `Turn ${angle > 0 ? 'right' : 'left'} toward ${next.label}`;
}
