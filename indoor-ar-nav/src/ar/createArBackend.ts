import type { ArBackend } from './ArBackend';
import type { ArBackendKind } from '../types';
import { MindArBackend } from './MindArBackend';
import { MockArBackend } from './MockArBackend';

/**
 * Default compiled MindAR image target. This is MindAR's well-known example
 * card so the app works out of the box — print the matching image (see README)
 * or replace this with your own `.mind` file in `public/targets/`.
 */
export const DEFAULT_IMAGE_TARGET_SRC =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind';

/** True when a camera + getUserMedia are plausibly available. */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export interface BackendConfig {
  originNodeId: string;
  imageTargetSrc?: string;
}

/** Factory: pick the AR strategy for the requested kind. */
export function createArBackend(kind: ArBackendKind, config: BackendConfig): ArBackend {
  if (kind === 'mock') {
    return new MockArBackend(config.originNodeId);
  }
  return new MindArBackend(config.imageTargetSrc ?? DEFAULT_IMAGE_TARGET_SRC, config.originNodeId);
}
