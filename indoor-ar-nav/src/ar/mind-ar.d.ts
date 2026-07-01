/**
 * Minimal ambient types for `mind-ar` (which ships no TypeScript types).
 * Only the surface we actually use is declared here.
 */
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type * as THREE from 'three';

  export interface MindARAnchor {
    group: THREE.Group;
    targetIndex: number;
    onTargetFound?: () => void;
    onTargetLost?: () => void;
  }

  export interface MindARThreeOptions {
    container: HTMLElement;
    imageTargetSrc: string;
    maxTrack?: number;
    uiLoading?: 'yes' | 'no';
    uiScanning?: 'yes' | 'no';
    uiError?: 'yes' | 'no';
    filterMinCF?: number;
    filterBeta?: number;
  }

  export class MindARThree {
    constructor(options: MindARThreeOptions);
    readonly renderer: THREE.WebGLRenderer;
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;
    readonly video: HTMLVideoElement;
    addAnchor(targetIndex: number): MindARAnchor;
    start(): Promise<void>;
    stop(): void;
  }
}
