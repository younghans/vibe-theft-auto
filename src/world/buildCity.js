import * as THREE from 'three';
import {
  WORLD_GROUND_RADIUS,
  WORLD_HALF_EXTENT
} from '../shared/worldConstants.js';
import { defaultWorldLayout, DEFAULT_WORLD_SPAWN } from './defaultWorldLayout.js';

export async function buildCity(scene) {
  const ambientGround = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_GROUND_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0x264633, roughness: 1 })
  );
  ambientGround.rotation.x = -Math.PI / 2;
  ambientGround.position.y = -0.03;
  ambientGround.receiveShadow = true;
  scene.add(ambientGround);

  const cityBounds = new THREE.Box3(
    new THREE.Vector3(-WORLD_HALF_EXTENT, -1, -WORLD_HALF_EXTENT),
    new THREE.Vector3(WORLD_HALF_EXTENT, 6, WORLD_HALF_EXTENT)
  );

  return {
    colliders: [],
    interactables: [],
    cityBounds,
    layout: defaultWorldLayout,
    spawnPoint: new THREE.Vector3(...DEFAULT_WORLD_SPAWN)
  };
}
