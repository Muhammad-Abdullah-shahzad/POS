import * as THREE from 'three';
import { COLORS } from './constants';

export interface ArrowOptions {
  /** Length of the arrow along its forward (+Z) axis, in world units. */
  length?: number;
  /** Shaft + head colour. */
  color?: number;
  headColor?: number;
}

/**
 * Factory for a single floor arrow mesh, modelled pointing along +Z so callers
 * can orient it by aiming +Z at the next waypoint. Returns a Group (shaft +
 * head) laid flat on the floor plane.
 *
 * Keeping mesh construction behind a factory means the visual style can change
 * (or be themed/strategised) without touching the renderer or nav layers.
 */
export function createArrow(options: ArrowOptions = {}): THREE.Group {
  const { length = 0.14, color = COLORS.arrow, headColor = COLORS.arrowHead } = options;

  const group = new THREE.Group();
  group.name = 'nav-arrow';

  const shaftLength = length * 0.6;
  const headLength = length * 0.4;
  const width = length * 0.18;

  const shaftGeo = new THREE.BoxGeometry(width, 0.012, shaftLength);
  const shaftMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.1,
    roughness: 0.6,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.z = shaftLength / 2;
  group.add(shaft);

  const headGeo = new THREE.ConeGeometry(width * 1.6, headLength, 4);
  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    emissive: headColor,
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.5,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  // Cone points up +Y by default; rotate so it points forward along +Z.
  head.rotation.x = Math.PI / 2;
  head.rotation.y = Math.PI / 4; // square base aligned to arrow axis
  head.position.z = shaftLength + headLength / 2;
  group.add(head);

  return group;
}

/** A small glowing marker placed at the destination node. */
export function createDestinationMarker(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'destination-marker';

  const ringGeo = new THREE.TorusGeometry(0.1, 0.012, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: COLORS.destination,
    emissive: COLORS.destination,
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2; // lay flat on the floor
  group.add(ring);

  const pinGeo = new THREE.ConeGeometry(0.05, 0.16, 16);
  const pinMat = new THREE.MeshStandardMaterial({
    color: COLORS.destination,
    emissive: COLORS.destination,
    emissiveIntensity: 0.5,
  });
  const pin = new THREE.Mesh(pinGeo, pinMat);
  pin.position.y = 0.1;
  group.add(pin);

  return group;
}
