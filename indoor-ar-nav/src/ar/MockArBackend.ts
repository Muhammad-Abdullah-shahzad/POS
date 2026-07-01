import * as THREE from 'three';
import type { ArBackend, PoseListener } from './ArBackend';
import { addLights, objectToPose } from './poseUtils';

/**
 * Demo / fallback backend — no camera, no marker, no MindAR. It renders the
 * same Three scene over a gradient backdrop and simulates a marker detection a
 * moment after start, so the full pick-destination → A* → arrows pipeline is
 * demonstrable on any device (and when camera permission is denied).
 *
 * Because it implements the same ArBackend interface, the UI and renderer don't
 * know or care which backend is active.
 */
export class MockArBackend implements ArBackend {
  readonly kind = 'mock' as const;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
  private anchorGroup = new THREE.Group();
  private readonly listeners = new Set<PoseListener>();
  private container: HTMLElement | null = null;
  private rafActive = false;
  private detectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly originNodeId: string) {
    this.anchorGroup.name = 'mock-anchor-persistent';
  }

  async init(container: HTMLElement): Promise<void> {
    this.container = container;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene.background = new THREE.Color(0x0b1120);
    addLights(this.scene);

    // Look down slightly at the marker plane, like holding a phone over a table.
    this.camera.position.set(0, 0.9, 1.6);
    this.camera.lookAt(0, 0, -0.4);

    // Marker sits flat on the floor in front of the camera.
    this.anchorGroup.position.set(0, 0, -0.4);
    this.anchorGroup.rotation.x = -Math.PI / 2; // floor plane → camera-facing space
    this.scene.add(this.anchorGroup);

    window.addEventListener('resize', this.handleResize);
  }

  async start(): Promise<void> {
    if (!this.renderer) throw new Error('MockArBackend.start() called before init()');
    this.rafActive = true;
    this.renderLoop();

    // Simulate a marker detection shortly after start.
    this.detectTimer = setTimeout(() => {
      this.emit(objectToPose(this.anchorGroup, this.originNodeId));
    }, 600);
  }

  async stop(): Promise<void> {
    this.rafActive = false;
    if (this.detectTimer) clearTimeout(this.detectTimer);
    window.removeEventListener('resize', this.handleResize);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.listeners.clear();
  }

  getAnchorGroup(): THREE.Group {
    return this.anchorGroup;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  subscribe(listener: PoseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private renderLoop = (): void => {
    if (!this.rafActive || !this.renderer) return;
    // Gentle idle orbit so the 3D path reads as 3D in demo mode.
    this.anchorGroup.rotation.z += 0.0015;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.renderLoop);
  };

  private handleResize = (): void => {
    if (!this.renderer || !this.container) return;
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / Math.max(1, clientHeight);
    this.camera.updateProjectionMatrix();
  };

  private emit(pose: Parameters<PoseListener>[0]): void {
    for (const listener of this.listeners) listener(pose);
  }
}
