import * as THREE from 'three';
import { WEAPON_IDS } from './combatConstants.js';
import { assets } from '../world/assetManifest.js';

export const ATTACHMENT_SLOTS = Object.freeze({
  handRight: 'handRight',
  handLeft: 'handLeft',
  back: 'back'
});

export const HELD_ITEM_IDS = Object.freeze({
  pistol: WEAPON_IDS.pistol,
  crateA: 'crate_a'
});

const DEFAULT_SCALE = Object.freeze([1, 1, 1]);
const EMPTY_TRANSFORM = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0]),
  scale: DEFAULT_SCALE
});

const HELD_ITEM_DEFINITIONS = Object.freeze({
  [HELD_ITEM_IDS.pistol]: Object.freeze({
    id: HELD_ITEM_IDS.pistol,
    assetUrl: assets.combat.pistol,
    attachmentSlot: ATTACHMENT_SLOTS.handRight,
    normalize: Object.freeze({
      maxDimension: 0.95,
      center: true
    }),
    gripOffset: Object.freeze({
      position: Object.freeze([0.4, 0.185, 0.1]),
      rotation: Object.freeze([0.1257, Math.PI, 1.5708]),
      scale: DEFAULT_SCALE
    }),
    points: Object.freeze({
      muzzle: Object.freeze({
        position: Object.freeze([0.46, 0.055, 0.01]),
        rotation: Object.freeze([0, 0, 0]),
        scale: DEFAULT_SCALE
      })
    }),
    pickupDisplay: Object.freeze({
      maxDimension: 0.4,
      transform: Object.freeze({
        position: Object.freeze([0, 0.35, 0]),
        rotation: Object.freeze([Math.PI / 2, Math.PI / 2, -Math.PI / 2]),
        scale: Object.freeze([0.4, 0.4, 0.4])
      })
    }),
    aimPose: Object.freeze({
      spineUpperX: -0.02,
      spineUpperY: 0.08,
      rightArmX: -0.02,
      rightArmY: -0.48,
      rightArmZ: -0.04,
      rightArmPositionZ: -0.1,
      rightForeArmX: -0.01,
      rightForeArmY: -0.24,
      rightForeArmPositionZ: -0.18,
      rightHandPositionZ: -0.08,
      leftArmX: -0.02,
      leftArmY: -0.08,
      leftArmZ: 0.02,
      leftForeArmX: -0.02
    })
  }),
  [HELD_ITEM_IDS.crateA]: Object.freeze({
    id: HELD_ITEM_IDS.crateA,
    assetUrl: assets.city.boxA,
    attachmentSlot: ATTACHMENT_SLOTS.handLeft,
    normalize: Object.freeze({
      maxDimension: 1.35,
      center: true
    }),
    gripOffset: Object.freeze({
      position: Object.freeze([0.02, -0.08, 0.02]),
      rotation: Object.freeze([Math.PI * 0.06, Math.PI * 0.14, 0]),
      scale: DEFAULT_SCALE
    }),
    points: Object.freeze({}),
    pickupDisplay: Object.freeze({
      maxDimension: 2.2,
      transform: Object.freeze({
        position: Object.freeze([0, 0.82, 0]),
        rotation: Object.freeze([0, Math.PI / 4, 0]),
        scale: DEFAULT_SCALE
      })
    }),
    aimPose: null
  })
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

function applyTransform(target, transform = EMPTY_TRANSFORM) {
  const position = transform.position ?? EMPTY_TRANSFORM.position;
  const rotation = transform.rotation ?? EMPTY_TRANSFORM.rotation;
  const scale = transform.scale ?? EMPTY_TRANSFORM.scale;
  target.position.set(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
  target.rotation.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0);
  target.scale.set(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
}

function markRenderable(root, { disableCulling = false } = {}) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
    if (disableCulling) {
      node.frustumCulled = false;
    }
  });
}

export function getHeldItemDefinition(itemId) {
  return HELD_ITEM_DEFINITIONS[itemId] ?? null;
}

export function listHeldItemDefinitions() {
  return Object.values(HELD_ITEM_DEFINITIONS);
}

export function getHeldItemAssetUrl(itemId) {
  return getHeldItemDefinition(itemId)?.assetUrl ?? null;
}

export function getHeldItemAttachmentSlot(itemId) {
  return getHeldItemDefinition(itemId)?.attachmentSlot ?? null;
}

export function getHeldItemGripProfile(itemId) {
  const gripOffset = getHeldItemDefinition(itemId)?.gripOffset ?? EMPTY_TRANSFORM;
  return {
    position: [...(gripOffset.position ?? EMPTY_TRANSFORM.position)],
    rotation: [...(gripOffset.rotation ?? EMPTY_TRANSFORM.rotation)],
    scale: [...(gripOffset.scale ?? EMPTY_TRANSFORM.scale)]
  };
}

export function getHeldItemAimPose(itemId) {
  return getHeldItemDefinition(itemId)?.aimPose ?? null;
}

export function getHeldItemPointOffset(itemId, pointName) {
  const point = getHeldItemDefinition(itemId)?.points?.[pointName];
  if (!point) {
    return null;
  }

  return {
    position: [...(point.position ?? EMPTY_TRANSFORM.position)],
    rotation: [...(point.rotation ?? EMPTY_TRANSFORM.rotation)],
    scale: [...(point.scale ?? EMPTY_TRANSFORM.scale)]
  };
}

export function prepareHeldItemModel(root, itemId, mode = 'equipped') {
  const definition = getHeldItemDefinition(itemId);
  if (!definition) {
    return root;
  }

  const normalize = definition.normalize ?? {};
  if (normalize.maxDimension) {
    scaleModel(root, normalize.maxDimension);
  }
  if (normalize.center !== false) {
    centerModel(root);
  }

  if (mode === 'pickup' && definition.pickupDisplay) {
    if (definition.pickupDisplay.maxDimension) {
      scaleModel(root, definition.pickupDisplay.maxDimension);
    }
    if (normalize.center !== false) {
      centerModel(root);
    }
    applyTransform(root, definition.pickupDisplay.transform);
    markRenderable(root);
    return root;
  }

  markRenderable(root, { disableCulling: true });
  return root;
}

export function applyHeldItemGripTransform(target, itemId, override = null) {
  const base = getHeldItemGripProfile(itemId);
  const next = mergeAttachmentTransform(base, override);
  applyTransform(target, next);
  return next;
}

export function applyAttachmentTransform(target, transform) {
  applyTransform(target, transform);
}

export function mergeAttachmentTransform(base = EMPTY_TRANSFORM, override = null) {
  if (!override) {
    return {
      position: [...(base.position ?? EMPTY_TRANSFORM.position)],
      rotation: [...(base.rotation ?? EMPTY_TRANSFORM.rotation)],
      scale: [...(base.scale ?? EMPTY_TRANSFORM.scale)]
    };
  }

  return {
    position: [0, 1, 2].map((index) => (base.position?.[index] ?? EMPTY_TRANSFORM.position[index]) + (override.position?.[index] ?? 0)),
    rotation: [0, 1, 2].map((index) => (base.rotation?.[index] ?? EMPTY_TRANSFORM.rotation[index]) + (override.rotation?.[index] ?? 0)),
    scale: [0, 1, 2].map((index) => (base.scale?.[index] ?? EMPTY_TRANSFORM.scale[index]) * (override.scale?.[index] ?? 1))
  };
}
