import * as THREE from 'three';
import type { Route, Waypoint } from '../types';
import { requireNode } from '../nav/navGraph';
import { createArrow, createDestinationMarker } from './arrowFactory';
import { ARROW_HEIGHT, ARROW_SPACING, COLORS, METERS_TO_WORLD } from './constants';

/**
 * Renders a Route as 3D arrows + a path line into a target group (the marker
 * anchor). All geometry is expressed in marker-local space: nav coordinates are
 * translated so the origin node sits at the marker, then scaled to world units.
 *
 * The renderer owns only what it creates, so `render()` / `clear()` are safe to
 * call repeatedly as the destination changes.
 */
export class PathRenderer {
  private readonly root = new THREE.Group();
  private originX = 0;
  private originZ = 0;

  constructor(
    private readonly parent: THREE.Object3D,
    originNodeId: string,
  ) {
    this.root.name = 'path-renderer';
    parent.add(this.root);
    const origin = requireNode(originNodeId);
    this.originX = origin.x;
    this.originZ = origin.z;
  }

  /** Convert a building waypoint (metres) to marker-local world coordinates. */
  private toLocal(wp: Waypoint): THREE.Vector3 {
    return new THREE.Vector3(
      (wp.x - this.originX) * METERS_TO_WORLD,
      ARROW_HEIGHT,
      (wp.z - this.originZ) * METERS_TO_WORLD,
    );
  }

  render(route: Route | null): void {
    this.clear();
    if (!route || route.waypoints.length < 2) return;

    const points = route.waypoints.map((wp) => this.toLocal(wp));

    this.addPathLine(points);
    this.addArrows(points);
    this.addDestinationMarker(points[points.length - 1]);
  }

  private addPathLine(points: THREE.Vector3[]): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: COLORS.path, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(geometry, material);
    line.name = 'path-line';
    this.root.add(line);
  }

  private addArrows(points: THREE.Vector3[]): void {
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      const segment = new THREE.Vector3().subVectors(to, from);
      const legLength = segment.length();
      if (legLength < 1e-4) continue;
      const direction = segment.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

      // Place repeated arrows along the leg, leaving a margin at each node.
      const count = Math.max(1, Math.floor(legLength / ARROW_SPACING));
      for (let a = 1; a <= count; a += 1) {
        const t = a / (count + 1);
        const position = from.clone().addScaledVector(segment, t);
        const arrow = createArrow();
        arrow.position.copy(position);
        arrow.quaternion.copy(quaternion);
        arrow.up.copy(up);
        this.root.add(arrow);
      }
    }
  }

  private addDestinationMarker(at: THREE.Vector3): void {
    const marker = createDestinationMarker();
    marker.position.copy(at);
    marker.position.y = 0;
    this.root.add(marker);
  }

  /** Remove and dispose every object created by the last render. */
  clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      disposeObject(child);
    }
  }

  dispose(): void {
    this.clear();
    this.parent.remove(this.root);
  }
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh> & Partial<THREE.Line>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}
