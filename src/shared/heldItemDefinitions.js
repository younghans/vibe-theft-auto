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
  deliveryBox: 'delivery_box',
  phone: 'phone'
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

export const PHONE_GRIP_DEBUG_FIELDS = Object.freeze([
  Object.freeze({ key: 'phonePositionX', label: 'Phone X', group: 'position', axis: 0, min: -0.8, max: 1.2, step: 0.005, precision: 3 }),
  Object.freeze({ key: 'phonePositionY', label: 'Phone Y', group: 'position', axis: 1, min: -0.8, max: 0.8, step: 0.005, precision: 3 }),
  Object.freeze({ key: 'phonePositionZ', label: 'Phone Z', group: 'position', axis: 2, min: -0.8, max: 0.8, step: 0.005, precision: 3 }),
  Object.freeze({ key: 'phoneRotationX', label: 'Phone Pitch', group: 'rotation', axis: 0, min: -3.142, max: 3.142, step: 0.005, precision: 3 }),
  Object.freeze({ key: 'phoneRotationY', label: 'Phone Yaw', group: 'rotation', axis: 1, min: -3.142, max: 3.142, step: 0.005, precision: 3 }),
  Object.freeze({ key: 'phoneRotationZ', label: 'Phone Roll', group: 'rotation', axis: 2, min: -3.142, max: 3.142, step: 0.005, precision: 3 })
]);

const DEFAULT_SCALE = Object.freeze([1, 1, 1]);
const CARDBOARD_FACE_COLOR = 0xb9793f;
const CARDBOARD_SIDE_COLOR = 0x96602f;
const CARDBOARD_EDGE_COLOR = 0x6f4724;
const CARDBOARD_TAPE_COLOR = 0xd6b56f;
const PHONE_FRAME_COLOR = 0x1f2328;
const PHONE_BACK_COLOR = 0xe8e5df;
const PHONE_SCREEN_COLOR = 0x05070a;
const PHONE_SCREEN_GLOW_COLOR = 0x7de4ff;
const PHONE_BUTTON_COLOR = 0xb8bec7;
const PHONE_CAMERA_COLOR = 0x10131a;
const PHONE_LENS_COLOR = 0x1a2330;
const EMPTY_TRANSFORM = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0]),
  scale: DEFAULT_SCALE
});

function cloneTransformVector(values, fallback) {
  const source = values ?? fallback;
  return [source[0], source[1], source[2]];
}

function createBoxMesh(size, position, material, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

function createRoundedRectGeometry(width, height, depth, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
  shape.lineTo(halfWidth - cornerRadius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + cornerRadius);
  shape.lineTo(halfWidth, halfHeight - cornerRadius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - cornerRadius, halfHeight);
  shape.lineTo(-halfWidth + cornerRadius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - cornerRadius);
  shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + cornerRadius, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8
  });
  geometry.center();
  return geometry;
}

function createRoundedRectMesh(size, position, radius, material, name) {
  const mesh = new THREE.Mesh(
    createRoundedRectGeometry(size[0], size[1], size[2], radius),
    material
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

function createCameraLens(position, material, name) {
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 24), material);
  lens.name = name;
  lens.rotation.x = Math.PI / 2;
  lens.position.set(position[0], position[1], position[2]);
  return lens;
}

function createPhoneModel() {
  const root = new THREE.Group();
  root.name = 'TextingPhone';

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_FRAME_COLOR,
    roughness: 0.34,
    metalness: 0.72
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_BACK_COLOR,
    roughness: 0.36,
    metalness: 0.18
  });
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_SCREEN_COLOR,
    emissive: 0x061018,
    emissiveIntensity: 0.32,
    roughness: 0.18,
    metalness: 0.02
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_SCREEN_GLOW_COLOR,
    emissive: PHONE_SCREEN_GLOW_COLOR,
    emissiveIntensity: 0.9,
    roughness: 0.4,
    metalness: 0
  });
  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_BUTTON_COLOR,
    roughness: 0.28,
    metalness: 0.74
  });
  const cameraBumpMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_BACK_COLOR,
    roughness: 0.42,
    metalness: 0.18
  });
  const cameraRingMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_CAMERA_COLOR,
    roughness: 0.2,
    metalness: 0.76
  });
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: PHONE_LENS_COLOR,
    emissive: 0x07111d,
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.3
  });

  const body = createRoundedRectMesh([0.42, 0.82, 0.058], [0, 0, 0], 0.07, frameMaterial, 'TextingPhone_Frame');
  const back = createRoundedRectMesh([0.37, 0.76, 0.014], [0, 0, -0.031], 0.055, backMaterial, 'TextingPhone_BackGlass');
  const screen = createRoundedRectMesh([0.35, 0.72, 0.012], [0, 0, 0.034], 0.045, screenMaterial, 'TextingPhone_Screen');
  root.add(body, back, screen);

  const island = createRoundedRectMesh([0.11, 0.028, 0.008], [0, 0.305, 0.044], 0.014, frameMaterial, 'TextingPhone_DynamicIsland');
  root.add(island);

  const messageLineA = createBoxMesh([0.17, 0.012, 0.007], [-0.03, 0.13, 0.047], glowMaterial, 'TextingPhone_MessageLineA');
  const messageLineB = createBoxMesh([0.22, 0.012, 0.007], [0.015, 0.08, 0.047], glowMaterial, 'TextingPhone_MessageLineB');
  const messageBubble = createRoundedRectMesh([0.19, 0.055, 0.007], [-0.025, -0.005, 0.047], 0.018, glowMaterial, 'TextingPhone_MessageBubble');
  root.add(messageLineA, messageLineB, messageBubble);

  const cameraBump = createRoundedRectMesh([0.15, 0.15, 0.018], [-0.085, 0.285, -0.048], 0.032, cameraBumpMaterial, 'TextingPhone_CameraBump');
  const lensA = createCameraLens([-0.118, 0.315, -0.062], cameraRingMaterial, 'TextingPhone_CameraRingA');
  const lensB = createCameraLens([-0.055, 0.262, -0.062], cameraRingMaterial, 'TextingPhone_CameraRingB');
  const lensGlassA = createCameraLens([-0.118, 0.315, -0.071], lensMaterial, 'TextingPhone_CameraLensA');
  const lensGlassB = createCameraLens([-0.055, 0.262, -0.071], lensMaterial, 'TextingPhone_CameraLensB');
  root.add(cameraBump, lensA, lensB, lensGlassA, lensGlassB);

  const volumeButton = createBoxMesh([0.012, 0.16, 0.026], [-0.222, 0.12, 0], buttonMaterial, 'TextingPhone_VolumeButton');
  const powerButton = createBoxMesh([0.012, 0.18, 0.026], [0.222, 0.08, 0], buttonMaterial, 'TextingPhone_PowerButton');
  root.add(volumeButton, powerButton);

  return root;
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
      maxDimension: 0.98,
      center: true
    }),
    gripOffset: Object.freeze({
      position: Object.freeze([0.46, 0.186, 0.385]),
      rotation: Object.freeze([1.304, 0.168, 0.922]),
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
  }),
  [HELD_ITEM_IDS.phone]: Object.freeze({
    id: HELD_ITEM_IDS.phone,
    assetUrl: null,
    createModel: createPhoneModel,
    attachmentSlot: ATTACHMENT_SLOTS.handRight,
    normalize: Object.freeze({
      maxDimension: 0.62,
      center: true
    }),
    gripOffset: Object.freeze({
      position: Object.freeze([0.205, 0.2, 0.22]),
      rotation: Object.freeze([0.321, 0.214, -1.145]),
      scale: DEFAULT_SCALE
    }),
    points: Object.freeze({}),
    pickupDisplay: Object.freeze({
      maxDimension: 0.72,
      transform: Object.freeze({
        position: Object.freeze([0, 0.48, 0]),
        rotation: Object.freeze([0, Math.PI / 8, 0]),
        scale: DEFAULT_SCALE
      })
    }),
    aimPose: null
  })
});

const HELD_ITEM_DEFINITION_ENTRIES = [];
for (const key in HELD_ITEM_DEFINITIONS) {
  if (Object.hasOwn(HELD_ITEM_DEFINITIONS, key)) {
    HELD_ITEM_DEFINITION_ENTRIES.push(HELD_ITEM_DEFINITIONS[key]);
  }
}
const HELD_ITEM_DEFINITION_LIST = Object.freeze(HELD_ITEM_DEFINITION_ENTRIES);

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
  const resolvedTransform = transform ?? EMPTY_TRANSFORM;
  const position = resolvedTransform.position ?? EMPTY_TRANSFORM.position;
  const rotation = resolvedTransform.rotation ?? EMPTY_TRANSFORM.rotation;
  const scale = resolvedTransform.scale ?? EMPTY_TRANSFORM.scale;
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
  return HELD_ITEM_DEFINITION_LIST;
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
    position: cloneTransformVector(gripOffset.position, EMPTY_TRANSFORM.position),
    rotation: cloneTransformVector(gripOffset.rotation, EMPTY_TRANSFORM.rotation),
    scale: cloneTransformVector(gripOffset.scale, EMPTY_TRANSFORM.scale)
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
    position: cloneTransformVector(point.position, EMPTY_TRANSFORM.position),
    rotation: cloneTransformVector(point.rotation, EMPTY_TRANSFORM.rotation),
    scale: cloneTransformVector(point.scale, EMPTY_TRANSFORM.scale)
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
      position: cloneTransformVector(base.position, EMPTY_TRANSFORM.position),
      rotation: cloneTransformVector(base.rotation, EMPTY_TRANSFORM.rotation),
      scale: cloneTransformVector(base.scale, EMPTY_TRANSFORM.scale)
    };
  }

  const position = [];
  const rotation = [];
  const scale = [];
  for (let index = 0; index < 3; index += 1) {
    position.push((base.position?.[index] ?? EMPTY_TRANSFORM.position[index]) + (override.position?.[index] ?? 0));
    rotation.push((base.rotation?.[index] ?? EMPTY_TRANSFORM.rotation[index]) + (override.rotation?.[index] ?? 0));
    scale.push((base.scale?.[index] ?? EMPTY_TRANSFORM.scale[index]) * (override.scale?.[index] ?? 1));
  }
  return {
    position,
    rotation,
    scale
  };
}

export function cloneAimPose(pose = null) {
  if (!pose) {
    return null;
  }

  const next = {};
  let hasValues = false;
  for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
    const value = Number(pose[field.key]);
    if (Number.isFinite(value)) {
      next[field.key] = value;
      hasValues = true;
    }
  }

  return hasValues ? next : null;
}

export function mergeAimPose(base = null, override = null) {
  const merged = {};
  let hasValues = false;

  for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
    const value = Number(base?.[field.key] ?? 0) + Number(override?.[field.key] ?? 0);
    if (Number.isFinite(value) && Math.abs(value) > 0.000001) {
      merged[field.key] = value;
      hasValues = true;
    }
  }

  return hasValues ? merged : null;
}
