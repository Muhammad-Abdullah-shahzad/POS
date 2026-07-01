import type { NavGraph, NavNode } from '../types';
import rawGraph from './navGraph.json';

/**
 * The mock building graph. Edit `navGraph.json` to reshape the floor plan —
 * this module just types it and exposes small lookup helpers.
 */
export const navGraph: NavGraph = rawGraph as NavGraph;

const nodeIndex: ReadonlyMap<string, NavNode> = new Map(
  navGraph.nodes.map((node) => [node.id, node]),
);

export function getNode(id: string): NavNode | undefined {
  return nodeIndex.get(id);
}

export function requireNode(id: string): NavNode {
  const node = nodeIndex.get(id);
  if (!node) throw new Error(`Unknown nav node: ${id}`);
  return node;
}

/** Destination nodes, in declaration order, for the picker UI. */
export function getDestinations(graph: NavGraph = navGraph): NavNode[] {
  return graph.destinations.map((id) => requireNode(id));
}
