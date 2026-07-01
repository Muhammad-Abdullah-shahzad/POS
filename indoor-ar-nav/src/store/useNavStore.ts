import { create } from 'zustand';
import type { ArStatus, NavGraph, Pose, Route } from '../types';
import { navGraph } from '../nav/navGraph';
import { buildRoute } from '../nav/route';

interface NavState {
  /** Static building data (single graph for the MVP). */
  graph: NavGraph;

  status: ArStatus;
  /** Live marker pose while tracking; null when never seen or currently lost. */
  pose: Pose | null;
  /** Most recent good pose — arrows persist from this when the marker is lost. */
  lastKnownPose: Pose | null;
  errorMessage: string | null;

  destinationId: string | null;
  route: Route | null;
  /** Index of the leg the user is currently on (0-based). */
  currentLeg: number;

  // --- actions (the AR layer and UI write through these) ---
  setStatus: (status: ArStatus, errorMessage?: string | null) => void;
  /** Called by the AR backend each detection; null signals "marker lost". */
  setPose: (pose: Pose | null) => void;
  setDestination: (destinationId: string | null) => void;
  setCurrentLeg: (leg: number) => void;
  reset: () => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  graph: navGraph,
  status: 'idle',
  pose: null,
  lastKnownPose: null,
  errorMessage: null,
  destinationId: null,
  route: null,
  currentLeg: 0,

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

  setPose: (pose) => {
    if (pose) {
      // Detected / re-detected → tracking, and refresh the persistent pose.
      set({ pose, lastKnownPose: pose, status: 'tracking', errorMessage: null });
      return;
    }
    // Lost: keep lastKnownPose so arrows persist; only downgrade if we had it.
    const hadPose = get().lastKnownPose !== null;
    set({ pose: null, status: hadPose ? 'lost' : get().status });
  },

  setDestination: (destinationId) => {
    if (!destinationId) {
      set({ destinationId: null, route: null, currentLeg: 0 });
      return;
    }
    const { graph } = get();
    const route = buildRoute(graph, graph.originNodeId, destinationId);
    set({ destinationId, route, currentLeg: 0 });
  },

  setCurrentLeg: (leg) => set({ currentLeg: Math.max(0, leg) }),

  reset: () =>
    set({
      status: 'idle',
      pose: null,
      lastKnownPose: null,
      errorMessage: null,
      destinationId: null,
      route: null,
      currentLeg: 0,
    }),
}));
