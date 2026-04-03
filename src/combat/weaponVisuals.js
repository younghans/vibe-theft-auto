import * as THREE from 'three';
import { assets } from '../world/assetManifest.js';
import { WEAPON_IDS } from '../shared/combatConstants.js';

const WEAPON_ASSET_BY_ID = Object.freeze({
  [WEAPON_IDS.pistol]: assets.combat.pistol
});

function scaleModel(root, targetMaxDimension) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) {
    root.scale.multiplyScalar(targetMaxDimension / maxDimension);
  }
}

function centerModel(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.sub(center);
}

export function getWeaponAssetUrl(weaponId) {
  return WEAPON_ASSET_BY_ID[weaponId] ?? null;
}

export function prepareEquippedWeaponModel(root) {
  scaleModel(root, 0.95);
  centerModel(root);
  root.rotation.set(Math.PI * 0.04, Math.PI, Math.PI * 0.5);
  root.position.set(0.12, -0.02, 0.12);
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;
    }
  });
  return root;
}

export function preparePickupWeaponModel(root) {
  scaleModel(root, 2.6);
  centerModel(root);
  root.rotation.set(0, Math.PI / 2, Math.PI / 2);
  root.position.y = 0.9;
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return root;
}
