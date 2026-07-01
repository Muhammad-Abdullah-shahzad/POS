import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import type { ArBackend, PoseListener } from './ArBackend';
import { addLights, objectToPose } from './poseUtils';

/**
 * MindAR image-target backend.
 *
 * MindAR keeps the camera fixed at the origin and estimates the *marker's* pose
 * each frame, writing it into `anchor.group`. We mirror that transform into a
 * separate, always-visible `anchorGroup`. When the marker leaves view we simply
 * stop updating it — so the last known pose (and therefore the arrows) persists.
 * When the marker reappears we resync, which doubles as a drift reset.
 */
export class MindArBackend implements ArBackend {
  readonly kind = 'mindar' as const;

  private mindar: MindARThree | null = null;
  private anchorGroup = new THREE.Group();
  private readonly listeners = new Set<PoseListener>();
  private isTargetVisible = false;

  constructor(
    private readonly imageTargetSrc: string,
    private readonly originNodeId: string,
  ) {
    this.anchorGroup.name = 'mindar-anchor-persistent';
  }

  async init(container: HTMLElement): Promise<void> {
    const mindar = new MindARThree({
      container,
      imageTargetSrc: this.imageTargetSrc,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      maxTrack: 1,
    });
    this.mindar = mindar;

    addLights(mindar.scene);
    // The persistent group lives in the scene (not under the anchor) so it
    // keeps rendering after the marker is lost.
    mindar.scene.add(this.anchorGroup);

    const anchor = mindar.addAnchor(0);
    anchor.onTargetFound = () => {
      this.isTargetVisible = true;
    };
    anchor.onTargetLost = () => {
      this.isTargetVisible = false;
      this.emit(null);
    };

    // Mirror the tracked anchor's transform into our persistent group.
    mindar.renderer.setAnimationLoop(() => {
      if (this.isTargetVisible) {
        anchor.group.updateWorldMatrix(true, false);
        this.anchorGroup.matrix.copy(anchor.group.matrix);
        this.anchorGroup.matrix.decompose(
          this.anchorGroup.position,
          this.anchorGroup.quaternion,
          this.anchorGroup.scale,
        );
        this.emit(objectToPose(this.anchorGroup, this.originNodeId));
      }
      mindar.renderer.render(mindar.scene, mindar.camera);
    });
  }

  async start(): Promise<void> {
    if (!this.mindar) throw new Error('MindArBackend.start() called before init()');
    await this.mindar.start();
  }

  async stop(): Promise<void> {
    if (!this.mindar) return;
    this.mindar.renderer.setAnimationLoop(null);
    this.mindar.stop();
    this.listeners.clear();
  }

  getAnchorGroup(): THREE.Group {
    return this.anchorGroup;
  }

  getScene(): THREE.Scene {
    if (!this.mindar) throw new Error('MindArBackend not initialised');
    return this.mindar.scene;
  }

  subscribe(listener: PoseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(pose: Parameters<PoseListener>[0]): void {
    for (const listener of this.listeners) listener(pose);
  }
}
