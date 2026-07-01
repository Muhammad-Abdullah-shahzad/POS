import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useNavStore } from '../store/useNavStore';
import { navGraph } from '../nav/navGraph';
import { PathRenderer } from './pathRenderer';

/**
 * Bridges the store's route into the AR scene: whenever the route changes, the
 * PathRenderer rebuilds arrows inside the marker-anchored group. Reads from the
 * store, writes only Three.js geometry — no AR or nav logic here.
 */
export function useArrowRenderer(anchorGroup: THREE.Group | null): void {
  const route = useNavStore((s) => s.route);
  const rendererRef = useRef<PathRenderer | null>(null);

  // Create/destroy the renderer alongside the anchor group.
  useEffect(() => {
    if (!anchorGroup) return;
    const renderer = new PathRenderer(anchorGroup, navGraph.originNodeId);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [anchorGroup]);

  // Re-render whenever the route changes.
  useEffect(() => {
    rendererRef.current?.render(route);
  }, [route]);
}
