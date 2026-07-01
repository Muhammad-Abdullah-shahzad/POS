import type * as THREE from 'three';
import type { ArBackendKind, Pose } from '../types';

/** Called on every pose update. `null` means the marker is currently lost. */
export type PoseListener = (pose: Pose | null) => void;

/**
 * Strategy interface for an AR tracking backend. The rest of the app talks only
 * to this surface, so MindAR (image-target tracking, now) can later be swapped
 * for WebXR / 8th Wall world tracking without touching `nav/`, `three/` or `ui/`.
 *
 * Contract:
 *  - `getAnchorGroup()` returns a group anchored to the marker's *last known*
 *    pose. Backends keep it at the last good transform when tracking is lost,
 *    which is what lets the arrows persist.
 *  - `subscribe()` reports pose changes for the store/HUD.
 */
export interface ArBackend {
  readonly kind: ArBackendKind;

  /** Build renderer/scene/camera and attach to the container. */
  init(container: HTMLElement): Promise<void>;

  /** Begin the camera + tracking + render loop. */
  start(): Promise<void>;

  /** Stop tracking and release the camera/GL resources. */
  stop(): Promise<void>;

  /** The marker-anchored group that the PathRenderer draws into. */
  getAnchorGroup(): THREE.Group;

  /** The scene being rendered (for lights/debug if needed). */
  getScene(): THREE.Scene;

  /** Subscribe to pose updates. Returns an unsubscribe function. */
  subscribe(listener: PoseListener): () => void;
}
