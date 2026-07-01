/**
 * Shared domain types. These are intentionally framework-agnostic so the
 * `nav/` layer can stay pure (no React, no Three.js) and unit-testable.
 */

/** A point of interest in the building, measured in metres on a floor plan. */
export interface NavNode {
  id: string;
  label: string;
  /** Metres east of the floor-plan origin. */
  x: number;
  /** Metres north of the floor-plan origin. */
  z: number;
  /** Floor index (single floor in this MVP). */
  floor: number;
}

/** An undirected, walkable connection between two nodes. */
export interface NavEdge {
  from: string;
  to: string;
}

/** The whole mock building: nodes, edges, the marker's node and destinations. */
export interface NavGraph {
  /** Node the scanned marker physically corresponds to ("you are here"). */
  originNodeId: string;
  nodes: NavNode[];
  edges: NavEdge[];
  /** Node ids offered to the user in the destination picker. */
  destinations: string[];
}

/** One stop along a computed route. */
export interface Waypoint {
  nodeId: string;
  label: string;
  x: number;
  z: number;
  floor: number;
}

/** An ordered path produced by A* plus pre-computed distances. */
export interface Route {
  waypoints: Waypoint[];
  /** Distance in metres for each leg (length === waypoints.length - 1). */
  legDistances: number[];
  /** Total walking distance in metres. */
  totalDistance: number;
}

/**
 * The marker's world transform in the AR scene, captured on detection.
 * Stored as plain numbers (not Three.js objects) so the store stays
 * serialisable and decoupled from the rendering layer.
 */
export interface Pose {
  position: [number, number, number];
  /** Quaternion [x, y, z, w]. */
  quaternion: [number, number, number, number];
  /** Column-major 4x4 matrix (Three.js convention), 16 elements. */
  matrix: number[];
  /** Node this pose anchors to. */
  originNodeId: string;
  /** epoch ms when the pose was captured. */
  timestamp: number;
}

/** Lifecycle/health of the AR session, surfaced in the HUD. */
export type ArStatus =
  | 'idle'
  | 'initializing'
  | 'ready' // backend running, marker not yet seen
  | 'tracking' // marker currently in view
  | 'lost' // was seen, now out of view (arrows persist)
  | 'error'
  | 'unsupported';

/** Which AR backend is active (strategy selection). */
export type ArBackendKind = 'mindar' | 'mock';
