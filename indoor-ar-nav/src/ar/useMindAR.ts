import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import type { ArBackendKind } from '../types';
import { useNavStore } from '../store/useNavStore';
import type { ArBackend } from './ArBackend';
import { createArBackend } from './createArBackend';
import { navGraph } from '../nav/navGraph';

interface UseArResult {
  backend: ArBackend | null;
  /** The marker-anchored group to render the path into (null until ready). */
  anchorGroup: THREE.Group | null;
}

/**
 * Owns the AR backend lifecycle: create → init → start, wire pose updates into
 * the store, and tear everything down on unmount or backend switch.
 *
 * Despite the name it is backend-agnostic (MindAR or mock) — kept as
 * `useMindAR` to match the project's AR-hook naming.
 */
export function useMindAR(
  containerRef: React.RefObject<HTMLElement>,
  kind: ArBackendKind,
): UseArResult {
  const setStatus = useNavStore((s) => s.setStatus);
  const setPose = useNavStore((s) => s.setPose);
  const [backend, setBackend] = useState<ArBackend | null>(null);
  const [anchorGroup, setAnchorGroup] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    const instance = createArBackend(kind, { originNodeId: navGraph.originNodeId });
    const unsubscribe = instance.subscribe((pose) => {
      if (active) setPose(pose);
    });

    setStatus('initializing');

    (async () => {
      try {
        await instance.init(container);
        if (!active) return;
        await instance.start();
        if (!active) return;
        setBackend(instance);
        setAnchorGroup(instance.getAnchorGroup());
        setStatus('ready');
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Failed to start AR session';
        setStatus(kind === 'mock' ? 'error' : 'error', message);
      }
    })();

    return () => {
      active = false;
      unsubscribe();
      void instance.stop();
      setBackend(null);
      setAnchorGroup(null);
    };
  }, [containerRef, kind, setPose, setStatus]);

  return { backend, anchorGroup };
}
