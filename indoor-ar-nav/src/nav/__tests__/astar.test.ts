import { describe, expect, it } from 'vitest';
import type { NavGraph } from '../../types';
import { findPath } from '../astar';
import { buildRoute, nextTurnHint, remainingDistance } from '../route';
import { navGraph } from '../navGraph';

// A tiny deterministic graph for unit tests (independent of the shipped JSON).
//   a --1-- b --1-- c
//   |               |
//   3 - - - d - - - 1      (a-d-c long way, a-b-c short way)
const testGraph: NavGraph = {
  originNodeId: 'a',
  nodes: [
    { id: 'a', label: 'A', x: 0, z: 0, floor: 1 },
    { id: 'b', label: 'B', x: 1, z: 0, floor: 1 },
    { id: 'c', label: 'C', x: 2, z: 0, floor: 1 },
    { id: 'd', label: 'D', x: 1, z: 3, floor: 1 },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'a', to: 'd' },
    { from: 'd', to: 'c' },
  ],
  destinations: ['c'],
};

describe('findPath', () => {
  it('finds the shortest path between two connected nodes', () => {
    const result = findPath(testGraph, 'a', 'c');
    expect(result).not.toBeNull();
    expect(result?.path).toEqual(['a', 'b', 'c']);
    expect(result?.distance).toBeCloseTo(2);
  });

  it('returns a zero-length path when start === goal', () => {
    const result = findPath(testGraph, 'b', 'b');
    expect(result).toEqual({ path: ['b'], distance: 0 });
  });

  it('returns null for an unknown node', () => {
    expect(findPath(testGraph, 'a', 'zzz')).toBeNull();
    expect(findPath(testGraph, 'zzz', 'c')).toBeNull();
  });

  it('returns null when the goal is unreachable', () => {
    const disconnected: NavGraph = {
      ...testGraph,
      nodes: [...testGraph.nodes, { id: 'island', label: 'Island', x: 9, z: 9, floor: 1 }],
    };
    expect(findPath(disconnected, 'a', 'island')).toBeNull();
  });

  it('is symmetric over undirected edges', () => {
    const forward = findPath(testGraph, 'a', 'c');
    const backward = findPath(testGraph, 'c', 'a');
    expect(backward?.path).toEqual(forward?.path.slice().reverse());
    expect(backward?.distance).toBeCloseTo(forward?.distance ?? -1);
  });
});

describe('buildRoute', () => {
  it('produces waypoints with per-leg and total distances', () => {
    const route = buildRoute(testGraph, 'a', 'c');
    expect(route).not.toBeNull();
    expect(route?.waypoints.map((w) => w.nodeId)).toEqual(['a', 'b', 'c']);
    expect(route?.legDistances).toHaveLength(2);
    expect(route?.totalDistance).toBeCloseTo(2);
  });

  it('routes through the shipped building graph (entrance → meeting-room)', () => {
    const route = buildRoute(navGraph, navGraph.originNodeId, 'meeting-room');
    expect(route?.waypoints.map((w) => w.nodeId)).toEqual([
      'entrance',
      'lobby',
      'hallway-1',
      'hallway-2',
      'elevator',
      'meeting-room',
    ]);
    expect(route?.totalDistance).toBeGreaterThan(0);
  });

  it('returns null for an impossible route', () => {
    expect(buildRoute(testGraph, 'a', 'nope')).toBeNull();
  });
});

describe('route helpers', () => {
  it('remainingDistance sums from the given leg', () => {
    const route = buildRoute(testGraph, 'a', 'c')!;
    expect(remainingDistance(route, 0)).toBeCloseTo(2);
    expect(remainingDistance(route, 1)).toBeCloseTo(1);
    expect(remainingDistance(route, 2)).toBeCloseTo(0);
  });

  it('nextTurnHint describes the first move and arrival', () => {
    const route = buildRoute(testGraph, 'a', 'c')!;
    expect(nextTurnHint(route, 0)).toBe('Head toward B');
    expect(nextTurnHint(route, route.waypoints.length - 1)).toBe('You have arrived');
  });
});
