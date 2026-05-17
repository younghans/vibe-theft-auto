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
  crateA: 'crate_a',
  deliveryBox: 'delivery_box'
});

export const HELD_ITEM_AIM_POSE_FIELDS = Object.freeze([
  Object.freeze({ key: 'spineUpperX', label: 'Spine Pitch', bone: 'spineUpper', mode: 'rotation', axis: 'x', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'spineUpperY', label: 'Spine Yaw', bone: 'spineUpper', mode: 'rotation', axis: 'y', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'spineUpperZ', label: 'Spine Roll', bone: 'spineUpper', mode: 'rotation', axis: 'z', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'rightShoulderX', label: 'R Shoulder Pitch', bone: 'rightShoulder', mode: 'rotation', axis: 'x', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'rightShoulderY', label: 'R Shoulder Yaw', bone: 'rightShoulder', mode: 'rotation', axis: 'y', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'rightShoulderZ', label: 'R Shoulder Roll', bone: 'rightShoulder', mode: 'rotation', axis: 'z', min: -1.2, max: 1.2, step: 0.01 }),
  Object.freeze({ key: 'rightArmX', label: 'R Arm Pitch', bone: 'rightArm', mode: 'rotation', axis: 'x', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightArmY', label: 'R Arm Yaw', bone: 'rightArm', mode: 'rotation', axis: 'y', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightArmZ', label: 'R Arm Roll', bone: 'rightArm', mode: 'rotation', axis: 'z', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightForeArmX', label: 'R Forearm Pitch', bone: 'rightForeArm', mode: 'rotation', axis: 'x', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightForeArmY', label: 'R Forearm Yaw', bone: 'rightForeArm', mode: 'rotation', axis: 'y', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightForeArmZ', label: 'R Forearm Roll', bone: 'rightForeArm', mode: 'rotation', axis: 'z', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightHandX', label: 'R Hand Pitch', bone: 'rightHand', mode: 'rotation', axis: 'x', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightHandY', label: 'R Hand Yaw', bone: 'rightHand', mode: 'rotation', axis: 'y', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'rightHandZ', label: 'R Hand Roll', bone: 'rightHand', mode: 'rotation', axis: 'z', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftArmX', label: 'L Arm Pitch', bone: 'leftArm', mode: 'rotation', axis: 'x', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftArmY', label: 'L Arm Yaw', bone: 'leftArm', mode: 'rotation', axis: 'y', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftArmZ', label: 'L Arm Roll', bone: 'leftArm', mode: 'rotation', axis: 'z', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftForeArmX', label: 'L Forearm Pitch', bone: 'leftForeArm', mode: 'rotation', axis: 'x', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftForeArmY', label: 'L Forearm Yaw', bone: 'leftForeArm', mode: 'rotation', axis: 'y', min: -1.4, max: 1.4, step: 0.01 }),
  Object.freeze({ key: 'leftForeArmZ', label: 'L Forearm Roll', bone: 'leftForeArm', mode: 'rotation', axis: 'z', min: -1.4, max: 1.4, step: 0.01 })
]);

const DEFAULT_SCALE = Object.freeze([1, 1, 1]);
const CARDBOARD_FACE_COLOR = 0xb9793f;
const CARDBOARD_SIDE_COLOR = 0x96602f;
const CARDBOARD_EDGE_COLOR = 0x6f4724;
const CARDBOARD_TAPE_COLOR = 0xd6b56f;
const EMPTY_TRANSFORM = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0]),
  scale: DEFAULT_SCALE
});

function createBoxMesh(size, position, material, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

function createCardboardBoxModel() {
  const root = new THREE.Group();
  root.name = 'DeliveryCardboardBox';

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: CARDBOARD_FACE_COLOR,
    roughness: 0.92,
    metalness: 0.02
  });
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: CARDBOARD_SIDE_COLOR,
    roughness: 0.95,
    metalness: 0
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: CARDBOARD_EDGE_COLOR,
    roughness: 0.98,
    metalness: 0
  });
  const tapeMaterial = new THREE.MeshStandardMaterial({
    color: CARDBOARD_TAPE_COLOR,
    roughness: 0.72,
    metalness: 0.01
  });

  const body = createBoxMesh([1.08, 0.66, 0.78], [0, 0, 0], faceMaterial, 'DeliveryBox_Body');
  root.add(body);

  const topY = 0.348;
  const flapThickness = 0.035;
  const frontFlap = createBoxMesh([1.04, flapThickness, 0.29], [0, topY, 0.2], sideMaterial, 'DeliveryBox_FrontTopFlap');
  const rearFlap = createBoxMesh([1.04, flapThickness, 0.29], [0, topY, -0.2], sideMaterial, 'DeliveryBox_RearTopFlap');
  root.add(frontFlap, rearFlap);

  const centerTape = createBoxMesh([0.12, 0.045, 0.86], [0, topY + 0.02, 0], tapeMaterial, 'DeliveryBox_TopTape');
  const crossTape = createBoxMesh([1.12, 0.043, 0.075], [0, topY + 0.021, 0.01], tapeMaterial, 'DeliveryBox_CrossTape');
  root.add(centerTape, crossTape);

  const edgeSize = 0.028;
  const edgeY = 0;
  for (const x of [-0.555, 0.555]) {
    for (const z of [-0.405, 0.405]) {
      root.add(createBoxMesh([edgeSize, 0.7, edgeSize], [x, edgeY, z], edgeMaterial, 'DeliveryBox_VerticalEdge'));
    }
  }
  for (const y of [-0.345, 0.345]) {
    for (const z of [-0.405, 0.405]) {
      root.add(createBoxMesh([1.12, edgeSize, edgeSize], [0, y, z], edgeMaterial, 'DeliveryBox_LongEdge'));
    }
    for (const x of [-0.555, 0.555]) {
      root.add(createBoxMesh([edgeSize, edgeSize, 0.82], [x, y, 0], edgeMaterial, 'DeliveryBox_ShortEdge'));
    }
  }

  const frontLabel = createBoxMesh([0.36, 0.22, 0.014], [-0.21, -0.05, 0.398], tapeMaterial, 'DeliveryBox_FrontLabel');
  const frontLabelLineA = createBoxMesh([0.25, 0.018, 0.018], [-0.21, -0.02, 0.411], edgeMaterial, 'DeliveryBox_FrontLabelLineA');
  const frontLabelLineB = createBoxMesh([0.18, 0.018, 0.018], [-0.245, -0.085, 0.411], edgeMaterial, 'DeliveryBox_FrontLabelLineB');
  root.add(frontLabel, frontLabelLineA, frontLabelLineB);

  return root;
}

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
      rightShoulderX: 1.2,
      rightShoulderY: -0.42,
      rightShoulderZ: -1.2,
      rightArmX: -0.02,
      rightArmY: -0.48,
      rightArmZ: -0.04,
      rightForeArmX: -0.02,
      rightForeArmY: 0.8,
      rightForeArmZ: -0.29,
      rightHandY: -1.4
    }),
    reloadProfile: Object.freeze({
      envelope: Object.freeze({
        start: 0.1,
        peak: 0.34,
        end: 0.9
      }),
      handTarget: Object.freeze({
        nodeName: 'slide_Armature',
        position: Object.freeze([0.075, 0.175, 0]),
        rotation: Object.freeze([-0.34, 0, -0.08]),
        scale: DEFAULT_SCALE
      }),
      slide: Object.freeze({
        nodeName: 'slide_Armature',
        start: 0.2,
        peak: 0.52,
        end: 0.84,
        position: Object.freeze([-0.28, 0.02, 0])
      }),
      weaponMotion: Object.freeze({
        position: Object.freeze([0.075, 0.04, 0.1]),
        rotation: Object.freeze([0.24, -0.24, -0.1])
      }),
      pose: Object.freeze({
        spineUpper: Object.freeze([0.14, 0.24, 0.1]),
        leftShoulder: Object.freeze([-0.06, 0.32, 0.38])
      })
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
  }),
  [HELD_ITEM_IDS.deliveryBox]: Object.freeze({
    id: HELD_ITEM_IDS.deliveryBox,
    assetUrl: null,
    createModel: createCardboardBoxModel,
    attachmentSlot: ATTACHMENT_SLOTS.handLeft,
    normalize: Object.freeze({
      maxDimension: 0.82,
      center: true
    }),
    gripOffset: Object.freeze({
      position: Object.freeze([0.04, -0.06, 0.03]),
      rotation: Object.freeze([Math.PI * 0.06, Math.PI * 0.14, 0]),
      scale: DEFAULT_SCALE
    }),
    points: Object.freeze({}),
    pickupDisplay: Object.freeze({
      maxDimension: 1.2,
      transform: Object.freeze({
        position: Object.freeze([0, 0.54, 0]),
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
  return cloneAimPose(getHeldItemDefinition(itemId)?.aimPose ?? null);
}

export function getHeldItemReloadProfile(itemId) {
  return getHeldItemDefinition(itemId)?.reloadProfile ?? null;
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

export function cloneAimPose(pose = null) {
  if (!pose) {
    return null;
  }

  const next = {};
  for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
    const value = Number(pose[field.key]);
    if (Number.isFinite(value)) {
      next[field.key] = value;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function mergeAimPose(base = null, override = null) {
  const merged = {};

  for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
    const value = Number(base?.[field.key] ?? 0) + Number(override?.[field.key] ?? 0);
    if (Number.isFinite(value) && Math.abs(value) > 0.000001) {
      merged[field.key] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}
