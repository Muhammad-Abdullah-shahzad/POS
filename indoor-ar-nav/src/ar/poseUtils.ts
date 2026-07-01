import * as THREE from 'three';
import type { Pose } from '../types';

/** Add soft ambient + directional lighting so MeshStandardMaterial arrows show. */
export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(1, 2, 1);
  scene.add(directional);
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

/** Decompose an object's world matrix into a serialisable Pose for the store. */
export function objectToPose(object: THREE.Object3D, originNodeId: string): Pose {
  object.updateWorldMatrix(true, false);
  object.matrixWorld.decompose(_pos, _quat, _scale);
  return {
    position: [_pos.x, _pos.y, _pos.z],
    quaternion: [_quat.x, _quat.y, _quat.z, _quat.w],
    matrix: object.matrixWorld.toArray(),
    originNodeId,
    timestamp: Date.now(),
  };
}
