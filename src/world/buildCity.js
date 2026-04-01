import * as THREE from 'three';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { defaultWorldLayout, DEFAULT_WORLD_SPAWN } from './defaultWorldLayout.js';

export async function buildCity(scene) {
  const ambientGround = new THREE.Mesh(
    new THREE.CircleGeometry(180, 64),
    new THREE.MeshStandardMaterial({ color: 0x264633, roughness: 1 })
  );
  ambientGround.rotation.x = -Math.PI / 2;
  ambientGround.position.y = -0.03;
  ambientGround.receiveShadow = true;
  scene.add(ambientGround);

  const cityBounds = new THREE.Box3(
    new THREE.Vector3(-BUILDER_TILE_SIZE * 5.1, -1, -BUILDER_TILE_SIZE * 5.1),
    new THREE.Vector3(BUILDER_TILE_SIZE * 5.1, 6, BUILDER_TILE_SIZE * 5.1)
  );

  return {
    collisionBoxes: [],
    interactables: [],
    cityBounds,
    layout: defaultWorldLayout,
    spawnPoint: new THREE.Vector3(...DEFAULT_WORLD_SPAWN)
  };
}
