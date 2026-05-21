import * as THREE from 'three';
import {
  createBoneFilteredClip,
  createInPlaceClip,
  createTargetFilteredClip,
  ensureMixamoSockets,
  MIXAMO_BONES,
  validateMixamoHumanoid
} from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import { createClassicBotCharacter } from './classicBotCharacter.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById
} from './playableCharacterCatalog.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_AIM_POSE_FIELDS,
  HELD_ITEM_IDS,
  applyAttachmentTransform,
  applyHeldItemGripTransform,
  getHeldItemAssetUrl,
  getHeldItemAttachmentSlot,
  getHeldItemAimPose,
  getHeldItemDefinition,
  getHeldItemGripProfile,
  getHeldItemPointOffset,
  getHeldItemReloadProfile,
  mergeAimPose,
  mergeAttachmentTransform,
  prepareHeldItemModel
} from '../shared/heldItemDefinitions.js';
import { EMOTES_BY_ID, PUNCH_EMOTE_ID, PUNCH_HOOK_EMOTE_ID, PUNCH_UPPERCUT_EMOTE_ID, TEXTING_EMOTE_ID } from './emotes.js';
import { createRagdollController } from './ragdollController.js';
import { RAGDOLL_RECOVER_DURATION } from './ragdollRig.js';
import {
  HIT_REACTION_HEAD,
  HIT_REACTION_STOMACH,
  PUNCH_ASSISTED_LUNGE_BONUS,
  PUNCH_LUNGE_BACKSWING_DISTANCE,
  PUNCH_LUNGE_DISTANCE,
  PUNCH_LUNGE_PEAK_MS,
  PUNCH_LUNGE_RECOVER_MS,
  PUNCH_LUNGE_WINDUP_MS,
  WEAPON_RELOAD_MS
} from '../shared/combatConstants.js';
import {
  DRUNKNESS_MAX_LEVEL,
  DRUNKNESS_MIN_ANIMATION_LEVEL,
  normalizeDrunknessLevel
} from '../shared/bartender.js';
import { isDeliveryQuestActive } from '../shared/deliveryQuest.js';
import {
  CAR_DEALER_ITEM_IDS,
  getVehicleModelGroundNodeNameParts,
  normalizePlayerVehicleItemId
} from '../shared/carDealer.js';
import { createSkateboardModel } from '../shared/skateboardModel.js';
import { centerObjectOnXZAndSnapToGround, fitObjectToFootprint } from '../shared/threeModelBounds.js';
import { assets } from '../world/assetManifest.js';

const PLAYER_HEIGHT = 4.5;
const PLAYER_SPEED = 15;
const PLAYER_RADIUS = 1.4;
const PLAYER_MOVEMENT_MAX_SUBSTEP_SECONDS = 1 / 60;
const PLAYER_TURN_RESPONSE = 12;
const PUNCH_LUNGE_EMOTE_IDS = new Set([PUNCH_EMOTE_ID, PUNCH_HOOK_EMOTE_ID, PUNCH_UPPERCUT_EMOTE_ID]);
const PUNCH_STANCE_TURN_MS = 330;
const PUNCH_LOWER_BODY_OVERLAY_MS = 420;
const PUNCH_LOWER_BODY_OVERLAY_WEIGHT = 0.92;
const PLAYER_CAR_MODEL_SCALE = 0.75;
const PLAYER_CAR_MODEL_FOOTPRINT = Object.freeze([6.5, 12]);
const PLAYER_SKATEBOARD_REST_Y = 0.1;
const PLAYER_CAR_ASSET_URLS = Object.freeze({
  [CAR_DEALER_ITEM_IDS.fiatDuna]: assets.vehicles.fiatDuna,
  [CAR_DEALER_ITEM_IDS.toyotaAe86]: assets.vehicles.toyotaAe86
});
const EMOTE_FADE_IN = 0.12;
const EMOTE_FADE_OUT = 0.18;
const LIMP_EMOTE_ID = 'limp';
const DAMAGE_FEEDBACK_DURATION_MS = 380;
const DAMAGE_STAGGER_DISTANCE_PER_STRENGTH = 0.38;
const DAMAGE_STAGGER_TURN_PER_STRENGTH = 0.34;
const DAMAGE_FLASH_COLOR = new THREE.Color(0xff5b73);
const DAMAGE_EMISSIVE_COLOR = new THREE.Color(0xff3154);
const DAMAGE_RING_COLOR = new THREE.Color(0xff7b88);
const DAMAGE_BURST_COLOR = new THREE.Color(0xffd6cd);
const DELIVERY_CARRY_CLIP_NAME = 'carrying';
const HIT_REACTION_CLIP_BY_ID = Object.freeze({
  [HIT_REACTION_HEAD]: 'headHit',
  [HIT_REACTION_STOMACH]: 'stomachHit'
});
const HIT_REACTION_PLAYBACK_RATE_BY_ID = Object.freeze({
  [HIT_REACTION_HEAD]: 4.6,
  [HIT_REACTION_STOMACH]: 3.8
});
const HIT_REACTION_FADE_IN = 0.015;
const HIT_REACTION_FADE_OUT = 0.11;
const HIT_REACTION_BASE_ANIMATION_WEIGHT = 0.16;
const HIT_REACTION_SUPPRESS_BASE_MS = 260;

const UPPER_BODY_ROOT_BONE = 'spine';

const SLOT_MOTION_BASE = Object.freeze({
  position: Object.freeze([-0.12, 0.03, -0.08]),
  rotation: Object.freeze([-0.06, 0, 0.05])
});

const EMPTY_VECTOR_OVERRIDE = Object.freeze([0, 0, 0]);
const ATTACHMENT_SLOT_LIST = Object.freeze([
  ATTACHMENT_SLOTS.handRight,
  ATTACHMENT_SLOTS.handLeft,
  ATTACHMENT_SLOTS.back
]);
const AIM_IDLE_LOCK_BONES = Object.freeze(['leftArm', 'leftForeArm', 'leftHand']);
const HELD_ITEM_AIM_POSE_FIELD_KEYS = new Set();
const AIM_IDLE_LOCK_FIELD_KEYS = new Set();
const AIM_STABILIZE_BONE_SET = new Set([UPPER_BODY_ROOT_BONE]);
function copyIterableValues(values) {
  const copied = [];
  for (const value of values) {
    copied.push(value);
  }
  return copied;
}

function combineIterableValues(first, second) {
  const combined = [];
  for (const value of first) {
    combined.push(value);
  }
  for (const value of second) {
    combined.push(value);
  }
  return combined;
}

for (let index = 0; index < HELD_ITEM_AIM_POSE_FIELDS.length; index += 1) {
  const field = HELD_ITEM_AIM_POSE_FIELDS[index];
  HELD_ITEM_AIM_POSE_FIELD_KEYS.add(field.key);
  AIM_STABILIZE_BONE_SET.add(field.bone);
  let locksAimIdle = false;
  for (const boneName of AIM_IDLE_LOCK_BONES) {
    if (boneName === field.bone) {
      locksAimIdle = true;
      break;
    }
  }
  if (locksAimIdle) {
    AIM_IDLE_LOCK_FIELD_KEYS.add(field.key);
  }
}
const AIM_STABILIZE_BONES = Object.freeze(copyIterableValues(AIM_STABILIZE_BONE_SET));
const RELOAD_POSE_BONES = Object.freeze(['spineUpper', 'leftShoulder', 'leftArm', 'leftForeArm', 'leftHand']);
const RELOAD_IK_DRIVEN_BONES = new Set(['leftArm', 'leftForeArm', 'leftHand']);
const UPPER_BODY_EMOTE_BONES = Object.freeze([
  MIXAMO_BONES.spine,
  MIXAMO_BONES.spineMiddle,
  MIXAMO_BONES.spineUpper,
  MIXAMO_BONES.neck,
  MIXAMO_BONES.head,
  MIXAMO_BONES.leftShoulder,
  MIXAMO_BONES.rightShoulder,
  MIXAMO_BONES.leftArm,
  MIXAMO_BONES.rightArm,
  MIXAMO_BONES.leftForeArm,
  MIXAMO_BONES.rightForeArm,
  MIXAMO_BONES.leftHand,
  MIXAMO_BONES.rightHand
]);

function poseHasAimIdleLockField(pose = null) {
  if (!pose) {
    return false;
  }

  for (const fieldKey of AIM_IDLE_LOCK_FIELD_KEYS) {
    if (Object.hasOwn(pose, fieldKey)) {
      return true;
    }
  }
  return false;
}
const LOWER_BODY_LOCOMOTION_BONES = Object.freeze([
  MIXAMO_BONES.hips,
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase'
]);
const SKATEBOARD_SIDEWAYS_FOOT_YAW = Math.PI / 2;
const SKATEBOARD_LOWER_BODY_TURN_YAW = Math.PI / 2;
const SKATEBOARD_LOWER_BODY_STILL_BONES = Object.freeze(copyIterableValues(LOWER_BODY_LOCOMOTION_BONES));
const SKATEBOARD_UPPER_BODY_STILL_BONES = Object.freeze(copyIterableValues(UPPER_BODY_EMOTE_BONES));
const SKATEBOARD_STILL_BODY_BONES = Object.freeze(combineIterableValues(
  SKATEBOARD_LOWER_BODY_STILL_BONES,
  SKATEBOARD_UPPER_BODY_STILL_BONES
));
const SKATEBOARD_STILL_BODY_POSE_ROTATIONS = Object.freeze({
  [MIXAMO_BONES.hips]: Object.freeze([0, SKATEBOARD_LOWER_BODY_TURN_YAW, 0]),
  [MIXAMO_BONES.spine]: Object.freeze([0, -SKATEBOARD_LOWER_BODY_TURN_YAW, 0]),
  mixamorigLeftUpLeg: Object.freeze([0.04, 0, -0.04]),
  mixamorigLeftLeg: Object.freeze([0.05, 0, 0.02]),
  mixamorigLeftFoot: Object.freeze([0, SKATEBOARD_SIDEWAYS_FOOT_YAW, 0]),
  mixamorigLeftToeBase: Object.freeze([0, 0, 0]),
  mixamorigRightUpLeg: Object.freeze([0.04, 0, 0.04]),
  mixamorigRightLeg: Object.freeze([0.05, 0, -0.02]),
  mixamorigRightFoot: Object.freeze([0, SKATEBOARD_SIDEWAYS_FOOT_YAW, 0]),
  mixamorigRightToeBase: Object.freeze([0, 0, 0])
});
const FOOT_PLANT_BONE_NAMES = Object.freeze([
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightFoot',
  'mixamorigRightToeBase'
]);

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function inverseLerp(start, end, value) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || Math.abs(end - start) < 0.000001) {
    return 0;
  }

  return clamp01((value - start) / (end - start));
}

function smooth01(value) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - (2 * clamped));
}

function trianglePulse(value, start, peak, end) {
  if (!Number.isFinite(value) || !Number.isFinite(start) || !Number.isFinite(peak) || !Number.isFinite(end)) {
    return 0;
  }

  if (value <= start || value >= end) {
    return 0;
  }

  if (value <= peak) {
    return smooth01(inverseLerp(start, peak, value));
  }

  return smooth01(1 - inverseLerp(peak, end, value));
}

function getEmoteConfig(emoteId) {
  return EMOTES_BY_ID[emoteId] ?? {
    fadeIn: EMOTE_FADE_IN,
    fadeOut: EMOTE_FADE_OUT,
    loop: false,
    playbackRate: 1
  };
}

function applyEmoteStartOffset(action, emoteConfig, startedAtMs) {
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return;
  }

  const clip = typeof action.getClip === 'function' ? action.getClip() : null;
  const duration = clip?.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const elapsedSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000);
  action.time = emoteConfig.loop
    ? elapsedSeconds % duration
    : Math.min(elapsedSeconds, duration);
}

function getJabLungeOffset(elapsedMs, lungeBonus = 0) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= PUNCH_LUNGE_RECOVER_MS) {
    return 0;
  }

  const lungeDistance = PUNCH_LUNGE_DISTANCE + THREE.MathUtils.clamp(Number(lungeBonus) || 0, 0, PUNCH_ASSISTED_LUNGE_BONUS);

  if (elapsedMs < PUNCH_LUNGE_WINDUP_MS) {
    return -PUNCH_LUNGE_BACKSWING_DISTANCE * smooth01(elapsedMs / PUNCH_LUNGE_WINDUP_MS);
  }

  if (elapsedMs < PUNCH_LUNGE_PEAK_MS) {
    const progress = smooth01((elapsedMs - PUNCH_LUNGE_WINDUP_MS) / (PUNCH_LUNGE_PEAK_MS - PUNCH_LUNGE_WINDUP_MS));
    return THREE.MathUtils.lerp(-PUNCH_LUNGE_BACKSWING_DISTANCE, lungeDistance, progress);
  }

  const progress = smooth01((elapsedMs - PUNCH_LUNGE_PEAK_MS) / (PUNCH_LUNGE_RECOVER_MS - PUNCH_LUNGE_PEAK_MS));
  return THREE.MathUtils.lerp(lungeDistance, 0, progress);
}

function normalizeCharacter(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? PLAYER_HEIGHT / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
  return scale;
}

function hideUnusedMeshes(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function copyHorizontalDirection(source, target) {
  const x = Number(source?.x);
  const z = Number(source?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return false;
  }

  target.set(x, 0, z);
  return target.lengthSq() > 0.000001;
}

export function projectMoveOnCamera(
  camera,
  inputVector,
  target = new THREE.Vector3(),
  forward = new THREE.Vector3(),
  right = new THREE.Vector3(),
  stableForward = null
) {
  if (!copyHorizontalDirection(stableForward, forward)) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.multiplyScalar(-1);
  }

  if (forward.lengthSq() <= 0.000001) {
    forward.set(0, 0, 1);
  } else {
    forward.normalize();
  }

  right.set(forward.z, 0, -forward.x).normalize();
  target.set(0, 0, 0);
  target.addScaledVector(right, inputVector.x);
  target.addScaledVector(forward, inputVector.z);

  if (target.lengthSq() > 1) {
    target.normalize();
  }

  return target;
}

function collidesWithBox(candidate, collider, radius) {
  const box = collider?.box ?? collider;
  if (!box?.min || !box?.max) {
    return false;
  }

  return (
    candidate.x > box.min.x - radius &&
    candidate.x < box.max.x + radius &&
    candidate.z > box.min.z - radius &&
    candidate.z < box.max.z + radius
  );
}

function collidesWithCylinder(candidate, collider, radius) {
  if (!collider || !Number.isFinite(collider.x) || !Number.isFinite(collider.z) || !Number.isFinite(collider.radius)) {
    return false;
  }

  const combinedRadius = radius + collider.radius;
  const deltaX = candidate.x - collider.x;
  const deltaZ = candidate.z - collider.z;
  return (deltaX * deltaX) + (deltaZ * deltaZ) < combinedRadius * combinedRadius;
}

function collidesWithColliders(candidate, colliders, radius) {
  for (let index = 0; index < colliders.length; index += 1) {
    const collider = colliders[index];
    if (!collider || collider.blocksMovement === false) {
      continue;
    }

    if (collider.type === 'cylinder') {
      if (collidesWithCylinder(candidate, collider, radius)) {
        return true;
      }
      continue;
    }

    if (collidesWithBox(candidate, collider, radius)) {
      return true;
    }
  }

  return false;
}

function dampAngle(current, target, smoothing) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * smoothing;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function createPlayerIndicator({ color = 0xf2c871, opacity = 0.85 } = {}) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.9, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  return ring;
}

function createPlayerTaskArrow(material) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -2.78);
  shape.lineTo(0.46, -1.92);
  shape.lineTo(-0.46, -1.92);
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    material
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.065;

  const group = new THREE.Group();
  group.visible = false;
  group.add(mesh);
  return group;
}

function createPlayerSkateboardVisual() {
  const group = createSkateboardModel({ namePrefix: 'Player', visible: false });
  group.position.y = PLAYER_SKATEBOARD_REST_Y;
  return group;
}

function preparePlayerVehicleModel(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    }
  });
}

function fitPlayerVehicleModelToFootprint(root) {
  fitObjectToFootprint(root, PLAYER_CAR_MODEL_FOOTPRINT[0], PLAYER_CAR_MODEL_FOOTPRINT[1]);
  root.scale.multiplyScalar(PLAYER_CAR_MODEL_SCALE);
}

function centerAndGroundVehicleModel(root, itemId = '') {
  centerObjectOnXZAndSnapToGround(root, {
    groundNodeNameParts: getVehicleModelGroundNodeNameParts(itemId)
  });
}

function createSkateboardStaticBodyPose(root) {
  const offsetEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const offsetQuaternion = new THREE.Quaternion();
  const pose = [];
  for (let index = 0; index < SKATEBOARD_STILL_BODY_BONES.length; index += 1) {
    const boneName = SKATEBOARD_STILL_BODY_BONES[index];
    const bone = root.getObjectByName(boneName);
    if (!bone) {
      continue;
    }

    const targetQuaternion = bone.quaternion.clone();
    const rotation = SKATEBOARD_STILL_BODY_POSE_ROTATIONS[boneName];
    if (rotation) {
      offsetEuler.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0);
      offsetQuaternion.setFromEuler(offsetEuler);
      targetQuaternion.multiply(offsetQuaternion);
    }

    pose.push({
      bone,
      targetQuaternion
    });
  }

  return pose;
}

function cloneTrackedMaterial(material) {
  if (!material?.clone) {
    return { material, tracked: null };
  }

  const cloned = material.clone();
  return {
    material: cloned,
    tracked: {
      material: cloned,
      baseColor: cloned.color?.clone?.() ?? null,
      baseEmissive: cloned.emissive?.clone?.() ?? null,
      baseEmissiveIntensity: Number.isFinite(cloned.emissiveIntensity) ? cloned.emissiveIntensity : 1
    }
  };
}

function collectDamageTintMaterials(root) {
  const trackedMaterials = [];

  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    if (Array.isArray(node.material)) {
      const clonedMaterials = new Array(node.material.length);
      for (let index = 0; index < node.material.length; index += 1) {
        const entry = node.material[index];
        const { material, tracked } = cloneTrackedMaterial(entry);
        if (tracked) {
          trackedMaterials.push(tracked);
        }
        clonedMaterials[index] = material;
      }
      node.material = clonedMaterials;
      return;
    }

    const { material, tracked } = cloneTrackedMaterial(node.material);
    node.material = material;
    if (tracked) {
      trackedMaterials.push(tracked);
    }
  });

  return trackedMaterials;
}

function cloneNumberVector3(values = null, fallback = 0) {
  return [
    Number(values?.[0] ?? fallback),
    Number(values?.[1] ?? fallback),
    Number(values?.[2] ?? fallback)
  ];
}

function mergeNumberVector3(overrideValues = null, baseValues = null, fallback = 0) {
  return [
    Number(overrideValues?.[0] ?? baseValues?.[0] ?? fallback),
    Number(overrideValues?.[1] ?? baseValues?.[1] ?? fallback),
    Number(overrideValues?.[2] ?? baseValues?.[2] ?? fallback)
  ];
}

function addNumberVector3(baseValues = null, deltaValues = null, fallback = 0) {
  return [
    (baseValues?.[0] ?? fallback) + (deltaValues?.[0] ?? 0),
    (baseValues?.[1] ?? fallback) + (deltaValues?.[1] ?? 0),
    (baseValues?.[2] ?? fallback) + (deltaValues?.[2] ?? 0)
  ];
}

function multiplyNumberVector3(baseValues = null, deltaValues = null, fallback = 1) {
  return [
    (baseValues?.[0] ?? fallback) * (deltaValues?.[0] ?? 1),
    (baseValues?.[1] ?? fallback) * (deltaValues?.[1] ?? 1),
    (baseValues?.[2] ?? fallback) * (deltaValues?.[2] ?? 1)
  ];
}

function cloneReloadPose(pose = null) {
  const nextPose = {};
  for (const boneKey in pose ?? {}) {
    if (Object.hasOwn(pose, boneKey)) {
      nextPose[boneKey] = cloneNumberVector3(pose[boneKey], 0);
    }
  }
  return nextPose;
}

function hasOwnEnumerableProperties(value = null) {
  if (!value) {
    return false;
  }

  for (const key in value) {
    if (Object.hasOwn(value, key)) {
      return true;
    }
  }
  return false;
}

export async function createPlayer(library, {
  characterId = DEFAULT_PLAYABLE_CHARACTER_ID,
  indicatorColor = 0xf2c871,
  indicatorOpacity = 0.85
} = {}) {
  const characterDefinition = getPlayableCharacterById(characterId);
  const clipNamesToPreload = new Set([
    characterDefinition.idleClip,
    characterDefinition.walkClip,
    characterDefinition.fastRunClip ?? assets.playerAnimationSet.fastRun,
    characterDefinition.drunkIdleClip,
    characterDefinition.drunkWalkClip,
    DELIVERY_CARRY_CLIP_NAME
  ]);
  const leadPunchClipName = characterDefinition.emotes?.[PUNCH_EMOTE_ID];
  for (const punchEmoteId of PUNCH_LUNGE_EMOTE_IDS) {
    const punchClipName = characterDefinition.emotes?.[punchEmoteId];
    if (punchClipName) {
      clipNamesToPreload.add(punchClipName);
    }
  }
  for (const clipName of assets.playerAnimationSet.hitReactions ?? []) {
    clipNamesToPreload.add(clipName);
  }

  await preloadMixamoClips(clipNamesToPreload);

  const characterRig = await library.instantiate(characterDefinition.characterRig);
  const character = characterDefinition.characterVariant === 'classicBot'
    ? createClassicBotCharacter(characterRig)
    : characterRig;
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Mixamo player character is invalid. Missing bones: ${humanoid.missingBones.join(', ')}`);
  }

  const createRigSafeClip = (clip, clipName) => createTargetFilteredClip(clip, character, clipName);
  const sockets = ensureMixamoSockets(character);
  const idleClip = createInPlaceClip(createRigSafeClip(getMixamoClip(characterDefinition.idleClip), `${characterDefinition.idleClip}_RigSafe`), MIXAMO_BONES.hips);
  const walkClip = createInPlaceClip(createRigSafeClip(getMixamoClip(characterDefinition.walkClip), `${characterDefinition.walkClip}_RigSafe`), MIXAMO_BONES.hips);
  const fastRunClipName = characterDefinition.fastRunClip ?? assets.playerAnimationSet.fastRun;
  const fastRunClip = createInPlaceClip(createRigSafeClip(getMixamoClip(fastRunClipName), `${fastRunClipName}_RigSafe`), MIXAMO_BONES.hips);
  const drunkIdleClip = createInPlaceClip(createRigSafeClip(getMixamoClip(characterDefinition.drunkIdleClip ?? characterDefinition.idleClip), `${characterDefinition.drunkIdleClip ?? characterDefinition.idleClip}_RigSafe`), MIXAMO_BONES.hips);
  const drunkWalkClip = createInPlaceClip(createRigSafeClip(getMixamoClip(characterDefinition.drunkWalkClip ?? characterDefinition.walkClip), `${characterDefinition.drunkWalkClip ?? characterDefinition.walkClip}_RigSafe`), MIXAMO_BONES.hips);
  const idleLowerBodyClip = createBoneFilteredClip(idleClip, LOWER_BODY_LOCOMOTION_BONES, `${characterDefinition.idleClip}_LowerBody`);
  const walkLowerBodyClip = createBoneFilteredClip(walkClip, LOWER_BODY_LOCOMOTION_BONES, `${characterDefinition.walkClip}_LowerBody`);
  const drunkIdleLowerBodyClip = createBoneFilteredClip(drunkIdleClip, LOWER_BODY_LOCOMOTION_BONES, `${characterDefinition.drunkIdleClip}_LowerBody`);
  const drunkWalkLowerBodyClip = createBoneFilteredClip(drunkWalkClip, LOWER_BODY_LOCOMOTION_BONES, `${characterDefinition.drunkWalkClip}_LowerBody`);
  const punchSourceClip = leadPunchClipName
    ? createRigSafeClip(getMixamoClip(leadPunchClipName), `${leadPunchClipName}_RigSafe`)
    : null;
  const punchUpperBodyClip = punchSourceClip
    ? createBoneFilteredClip(punchSourceClip, UPPER_BODY_EMOTE_BONES, `${leadPunchClipName}_UpperBody`)
    : null;
  const deliveryCarryUpperBodyClip = createBoneFilteredClip(
    createRigSafeClip(getMixamoClip(DELIVERY_CARRY_CLIP_NAME), `${DELIVERY_CARRY_CLIP_NAME}_RigSafe`),
    UPPER_BODY_EMOTE_BONES,
    `${DELIVERY_CARRY_CLIP_NAME}_UpperBody`
  );
  const mixer = new THREE.AnimationMixer(character);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  const fastRunAction = mixer.clipAction(fastRunClip);
  const drunkIdleAction = mixer.clipAction(drunkIdleClip);
  const drunkWalkAction = mixer.clipAction(drunkWalkClip);
  const idleLowerBodyAction = mixer.clipAction(idleLowerBodyClip);
  const walkLowerBodyAction = mixer.clipAction(walkLowerBodyClip);
  const drunkIdleLowerBodyAction = mixer.clipAction(drunkIdleLowerBodyClip);
  const drunkWalkLowerBodyAction = mixer.clipAction(drunkWalkLowerBodyClip);
  const deliveryCarryAction = mixer.clipAction(deliveryCarryUpperBodyClip);
  const hitReactionActions = new Map();
  const emoteActions = new Map();
  const emoteLowerBodyActions = new Map();
  const emoteLoadPromises = new Map();
  const emoteConfigOverrides = new Map();
  const skeletonHelper = new THREE.SkeletonHelper(character);
  idleAction.play();
  idleAction.enabled = true;
  idleAction.setEffectiveWeight(1);
  walkAction.play();
  walkAction.enabled = true;
  walkAction.setEffectiveWeight(0);
  fastRunAction.play();
  fastRunAction.enabled = true;
  fastRunAction.setEffectiveWeight(0);
  drunkIdleAction.play();
  drunkIdleAction.enabled = true;
  drunkIdleAction.setEffectiveWeight(0);
  drunkWalkAction.play();
  drunkWalkAction.enabled = true;
  drunkWalkAction.setEffectiveWeight(0);
  idleLowerBodyAction.play();
  idleLowerBodyAction.enabled = true;
  idleLowerBodyAction.setEffectiveWeight(0);
  walkLowerBodyAction.play();
  walkLowerBodyAction.enabled = true;
  walkLowerBodyAction.setEffectiveWeight(0);
  drunkIdleLowerBodyAction.play();
  drunkIdleLowerBodyAction.enabled = true;
  drunkIdleLowerBodyAction.setEffectiveWeight(0);
  drunkWalkLowerBodyAction.play();
  drunkWalkLowerBodyAction.enabled = true;
  drunkWalkLowerBodyAction.setEffectiveWeight(0);
  deliveryCarryAction.enabled = true;
  deliveryCarryAction.clampWhenFinished = false;
  deliveryCarryAction.setLoop(THREE.LoopRepeat, Infinity);
  deliveryCarryAction.setEffectiveWeight(0);
  deliveryCarryAction.play();
  for (const [reactionId, clipName] of Object.entries(HIT_REACTION_CLIP_BY_ID)) {
    const sourceClip = createRigSafeClip(getMixamoClip(clipName), `${clipName}_RigSafe`);
    const reactionClip = createInPlaceClip(sourceClip, MIXAMO_BONES.hips);
    const action = mixer.clipAction(reactionClip);
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(HIT_REACTION_PLAYBACK_RATE_BY_ID[reactionId] ?? 4);
    hitReactionActions.set(reactionId, action);
  }

  hideUnusedMeshes(character);
  const characterScale = normalizeCharacter(character);
  const damageTintMaterials = collectDamageTintMaterials(character);

  const anchor = new THREE.Group();
  const visual = new THREE.Group();
  visual.add(character);
  const indicatorRing = createPlayerIndicator({
    color: indicatorColor,
    opacity: indicatorOpacity
  });
  anchor.add(indicatorRing);
  const taskArrow = createPlayerTaskArrow(indicatorRing.material);
  anchor.add(taskArrow);
  const damageRipple = new THREE.Mesh(
    new THREE.RingGeometry(1.65, 2.55, 36),
    new THREE.MeshBasicMaterial({
      color: DAMAGE_RING_COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  damageRipple.rotation.x = -Math.PI / 2;
  damageRipple.position.y = 0.06;
  damageRipple.visible = false;
  anchor.add(damageRipple);
  const damageBurst = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34, 0),
    new THREE.MeshBasicMaterial({
      color: DAMAGE_BURST_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  damageBurst.position.set(0, PLAYER_HEIGHT * 0.58, 0);
  damageBurst.visible = false;
  visual.add(damageBurst);
  const skateboard = createPlayerSkateboardVisual();
  const vehicleRoot = new THREE.Group();
  vehicleRoot.name = 'PlayerVehicleRoot';
  vehicleRoot.visible = false;
  visual.add(skateboard);
  visual.add(vehicleRoot);
  anchor.add(visual);

  let idleWeight = 1;
  let walkWeight = 0;
  let fastRunWeight = 0;
  let drunknessLevel = 0;
  let drunkLocomotionWeight = 0;
  let activeEmoteId = null;
  let activeEmoteConfig = null;
  let activeEmoteStartedAt = 0;
  let activePunchLungeBonus = 0;
  let emoteSequence = 0;
  let emotePlaybackRequestId = 0;
  let lastRemoteEmoteActive = false;
  let lastRemoteEmoteId = '';
  let lastRemoteEmoteSeq = -1;
  let limpStartedAt = 0;
  let limpRecoverUntilMs = 0;
  const ragdoll = createRagdollController(character);
  const inverseCharacterScale = characterScale > 0 ? (1 / characterScale) : 1;
  const equipmentRoots = {};
  const equipmentMotionRoots = {};
  const heldItemEntries = new Map();
  const heldItemLoads = new Map();
  const activeItemsBySlot = new Map();
  const slotVisibility = new Map();
  const gripOverrides = new Map();
  const aimPoseOverrides = new Map();
  const reloadProfileOverrides = new Map();
  const aimPoseBones = {
    spine: character.getObjectByName(MIXAMO_BONES.spine) ?? null,
    spineMiddle: character.getObjectByName(MIXAMO_BONES.spineMiddle) ?? null,
    head: character.getObjectByName(MIXAMO_BONES.head) ?? null,
    neck: character.getObjectByName(MIXAMO_BONES.neck) ?? null,
    spineUpper: character.getObjectByName(MIXAMO_BONES.spineUpper) ?? null,
    leftShoulder: character.getObjectByName(MIXAMO_BONES.leftShoulder) ?? null,
    rightShoulder: character.getObjectByName(MIXAMO_BONES.rightShoulder) ?? null,
    rightArm: character.getObjectByName(MIXAMO_BONES.rightArm) ?? null,
    rightForeArm: character.getObjectByName(MIXAMO_BONES.rightForeArm) ?? null,
    rightHand: character.getObjectByName(MIXAMO_BONES.rightHand) ?? null,
    leftArm: character.getObjectByName(MIXAMO_BONES.leftArm) ?? null,
    leftForeArm: character.getObjectByName(MIXAMO_BONES.leftForeArm) ?? null,
    leftHand: character.getObjectByName(MIXAMO_BONES.leftHand) ?? null
  };
  const aimPoseBoneBases = {};
  for (const key in aimPoseBones) {
    if (Object.hasOwn(aimPoseBones, key)) {
      const bone = aimPoseBones[key];
      aimPoseBoneBases[key] = bone ? { quaternion: bone.quaternion.clone() } : null;
    }
  }
  mixer.setTime(0);
  const skateboardStaticBodyPose = createSkateboardStaticBodyPose(character);
  const aimPoseIdleBases = {};
  for (let index = 0; index < AIM_IDLE_LOCK_BONES.length; index += 1) {
    const boneKey = AIM_IDLE_LOCK_BONES[index];
    const bone = aimPoseBones[boneKey];
    aimPoseIdleBases[boneKey] = bone ? { quaternion: bone.quaternion.clone() } : null;
  }
  const aimPoseEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const aimPoseQuaternion = new THREE.Quaternion();
  const aimPoseTargetQuaternion = new THREE.Quaternion();
  const aimPoseRotationsByBone = new Map();
  const aimPoseBlendWeightsByBone = new Map();
  const activeAimBones = new Set();
  const footPlantBones = [];
  for (let index = 0; index < FOOT_PLANT_BONE_NAMES.length; index += 1) {
    const bone = character.getObjectByName(FOOT_PLANT_BONE_NAMES[index]);
    if (bone) {
      footPlantBones.push(bone);
    }
  }
  const footPlantWorldPosition = new THREE.Vector3();
  const footPlantLocalPosition = new THREE.Vector3();
  const reloadIkTargetPosition = new THREE.Vector3();
  const reloadIkBonePosition = new THREE.Vector3();
  const reloadIkEndPosition = new THREE.Vector3();
  const reloadIkToEnd = new THREE.Vector3();
  const reloadIkToTarget = new THREE.Vector3();
  const reloadIkAxisWorld = new THREE.Vector3();
  const reloadIkAxisLocal = new THREE.Vector3();
  const moveCameraForward = new THREE.Vector3();
  const moveCameraRight = new THREE.Vector3();
  const moveDirection = new THREE.Vector3();
  const moveProposedPosition = new THREE.Vector3();
  const moveTarget = new THREE.Vector3();
  const moveToTarget = new THREE.Vector3();
  const reloadIkParentWorldQuaternion = new THREE.Quaternion();
  const reloadIkDeltaQuaternion = new THREE.Quaternion();
  const reloadIkTargetQuaternion = new THREE.Quaternion();
  const reloadIkParentInverseQuaternion = new THREE.Quaternion();
  const reloadIkLocalTargetQuaternion = new THREE.Quaternion();
  let desiredWeaponId = '';
  let deliveryPackageActive = false;
  let phoneTextingActive = false;
  let leftHandEquipmentRequestId = 0;
  let phoneEquipmentRequestId = 0;
  const managedLeftHandItemIds = new Set([HELD_ITEM_IDS.deliveryBox]);
  let deliveryCarryWeight = 0;
  let aliveState = true;
  let recoilAmount = 0;
  let aimingState = false;
  let aimPoseWeight = 0;
  let upperBodyLookWeight = 0;
  let taskArrowTarget = null;
  let aimRotationY = 0;
  let skateboardOwned = false;
  let skateboardSkating = false;
  let activeVehicleItemId = '';
  let skateboardMotion = 0;
  let skateboardStaticBodyPoseWeight = 0;
  const skateboardStateScratch = {
    owned: false,
    skating: false,
    vehicleItemId: ''
  };
  const animationOptionsScratch = {
    locomotionMode: undefined,
    locomotionPlaybackRate: undefined
  };
  const aliveStateOptionsScratch = {
    startedAtMs: 0
  };
  const weaponStateOptionsScratch = {
    visible: true
  };
  const reloadStateOptionsScratch = {
    weaponId: '',
    startedAtMs: 0,
    endsAtMs: 0,
    resetMotion: true
  };
  const moveTowardResultScratch = {
    arrived: false,
    moving: false,
    distance: Infinity
  };
  const playerVehicleModels = new Map();
  const playerVehicleModelLoads = new Map();
  let reloadPoseWeight = 0;
  let reloadPoseAmount = 0;
  let reloadSlideAmount = 0;
  let reloadWeaponMotionAmount = 0;
  let reloadDisplayedPoseAmount = 0;
  let reloadDisplayedSlideAmount = 0;
  let reloadDisplayedWeaponMotionAmount = 0;
  let lastReloadProfile = null;
  let reloadState = {
    active: false,
    weaponId: '',
    startedAtMs: 0,
    endsAtMs: 0
  };
  let reloadPreviewState = {
    active: false,
    weaponId: '',
    startedAtMs: 0,
    endsAtMs: 0
  };
  let damageFeedbackStartedAt = -Infinity;
  let damageFeedbackEndsAt = -Infinity;
  let damageFeedbackStrength = 1;
  let activeHitReactionAction = null;
  let hitReactionSuppressUntilMs = -Infinity;
  const damageDirection = new THREE.Vector3(0, 0, 1);
  const indicatorBaseColor = new THREE.Color(indicatorColor);

  skeletonHelper.visible = false;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = 0.9;

  for (const slot of ATTACHMENT_SLOT_LIST) {
    const socket = sockets[slot];
    const root = new THREE.Group();
    root.name = `EquipmentRoot_${slot}`;
    root.scale.setScalar(inverseCharacterScale);
    const motionRoot = new THREE.Group();
    motionRoot.name = `EquipmentMotion_${slot}`;
    root.add(motionRoot);
    socket?.add(root);
    equipmentRoots[slot] = root;
    equipmentMotionRoots[slot] = motionRoot;
    slotVisibility.set(slot, true);
  }

  function isLimpTransitioning() {
    return ragdoll.isActive() || Date.now() < limpRecoverUntilMs;
  }

  function getResolvedEmoteConfig(emoteId) {
    const baseConfig = getEmoteConfig(emoteId);
    const overrideConfig = emoteConfigOverrides.get(emoteId) ?? null;
    return overrideConfig ? { ...baseConfig, ...overrideConfig } : baseConfig;
  }

  function getLoadedEmoteAction(emoteId) {
    if (emoteId === LIMP_EMOTE_ID) {
      return null;
    }

    return emoteActions.get(emoteId) ?? null;
  }

  function getLoadedEmoteLowerBodyAction(emoteId) {
    if (emoteId === LIMP_EMOTE_ID) {
      return null;
    }

    return emoteLowerBodyActions.get(emoteId) ?? null;
  }

  function ensureEmoteAction(emoteId) {
    const loadedAction = getLoadedEmoteAction(emoteId);
    if (loadedAction) {
      return Promise.resolve(loadedAction);
    }

    const emoteConfig = getResolvedEmoteConfig(emoteId);
    const clipName = emoteConfig?.clipName ?? characterDefinition.emotes?.[emoteId];
    if (!clipName) {
      return Promise.resolve(null);
    }

    if (!emoteLoadPromises.has(emoteId)) {
      emoteLoadPromises.set(
        emoteId,
        preloadMixamoClips([clipName])
          .then(() => {
            const sourceClip = createRigSafeClip(getMixamoClip(clipName), `${clipName}_RigSafe`);
            let clip = null;
            if (emoteConfig?.upperBodyOnly) {
              if (emoteId === PUNCH_EMOTE_ID && punchUpperBodyClip) {
                clip = punchUpperBodyClip;
              } else {
                clip = createBoneFilteredClip(sourceClip, UPPER_BODY_EMOTE_BONES, `${clipName}_UpperBody`);
              }
              if (emoteConfig?.lowerBodyOverlay) {
                const lowerBodySourceClip = createInPlaceClip(sourceClip, MIXAMO_BONES.hips);
                const lowerBodyClip = createBoneFilteredClip(
                  lowerBodySourceClip,
                  LOWER_BODY_LOCOMOTION_BONES,
                  `${clipName}_LowerBodyOverlay`
                );
                const lowerBodyAction = mixer.clipAction(lowerBodyClip);
                lowerBodyAction.enabled = true;
                lowerBodyAction.clampWhenFinished = true;
                lowerBodyAction.setLoop(emoteConfig?.loop ? THREE.LoopRepeat : THREE.LoopOnce, emoteConfig?.loop ? Infinity : 1);
                lowerBodyAction.setEffectiveWeight(0);
                emoteLowerBodyActions.set(emoteId, lowerBodyAction);
              }
            } else {
              clip = createInPlaceClip(sourceClip, MIXAMO_BONES.hips);
            }
            const action = mixer.clipAction(clip);
            action.enabled = true;
            action.clampWhenFinished = true;
            action.setLoop(emoteConfig?.loop ? THREE.LoopRepeat : THREE.LoopOnce, emoteConfig?.loop ? Infinity : 1);
            action.setEffectiveWeight(0);
            emoteActions.set(emoteId, action);
            return action;
          })
          .finally(() => {
            emoteLoadPromises.delete(emoteId);
          })
      );
    }

    return emoteLoadPromises.get(emoteId);
  }

  function stopActiveEmote() {
    emotePlaybackRequestId += 1;
    if (!activeEmoteId) {
      return;
    }

    const action = getLoadedEmoteAction(activeEmoteId);
    action?.fadeOut(activeEmoteConfig?.fadeOut ?? EMOTE_FADE_OUT);
    getLoadedEmoteLowerBodyAction(activeEmoteId)?.fadeOut(activeEmoteConfig?.fadeOut ?? EMOTE_FADE_OUT);
    activeEmoteId = null;
    activeEmoteConfig = null;
    activeEmoteStartedAt = 0;
    activePunchLungeBonus = 0;
  }

  function setLimpActive(nextActive, { startedAtMs = Date.now(), trackSync = true } = {}) {
    if (nextActive) {
      if (ragdoll.isActive()) {
        return true;
      }

      stopActiveEmote();
      limpStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
      limpRecoverUntilMs = 0;
      ragdoll.activate({ startedAtMs: limpStartedAt });
      if (trackSync) {
        emoteSequence += 1;
      }
      return true;
    }

    if (!isLimpTransitioning()) {
      return false;
    }

    ragdoll.deactivate();
    limpRecoverUntilMs = Date.now() + (RAGDOLL_RECOVER_DURATION * 1000);
    return false;
  }

  mixer.addEventListener('finished', (event) => {
    if (activeEmoteId && getLoadedEmoteAction(activeEmoteId) === event.action) {
      stopActiveEmote();
    }
    if (activeHitReactionAction && activeHitReactionAction === event.action) {
      event.action.fadeOut(HIT_REACTION_FADE_OUT);
      activeHitReactionAction = null;
    }
  });

  function triggerHitReaction(reactionId = '') {
    if (!aliveState || ragdoll.isActive() || !HIT_REACTION_CLIP_BY_ID[reactionId]) {
      return false;
    }

    const action = hitReactionActions.get(reactionId);
    if (!action) {
      return false;
    }

    if (activeHitReactionAction && activeHitReactionAction !== action) {
      activeHitReactionAction.fadeOut(0.035);
    }

    activeHitReactionAction = action;
    hitReactionSuppressUntilMs = performance.now() + HIT_REACTION_SUPPRESS_BASE_MS;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.setEffectiveTimeScale(HIT_REACTION_PLAYBACK_RATE_BY_ID[reactionId] ?? 4);
    action.setEffectiveWeight(1);
    action.fadeIn(HIT_REACTION_FADE_IN);
    action.play();
    return true;
  }

  function getSlotMotionRoot(slot) {
    return equipmentMotionRoots[slot] ?? null;
  }

  function getActiveHeldItemId(slot = ATTACHMENT_SLOTS.handRight) {
    return activeItemsBySlot.get(slot) ?? '';
  }

  function getGripOverride(itemId) {
    const override = gripOverrides.get(itemId);
    if (!override) {
      return null;
    }

    return {
      position: cloneNumberVector3(override.position, 0),
      rotation: cloneNumberVector3(override.rotation, 0),
      scale: cloneNumberVector3(override.scale, 1)
    };
  }

  function getMergedGripProfile(itemId) {
    return mergeAttachmentTransform(getHeldItemGripProfile(itemId), getGripOverride(itemId));
  }

  function getAimPoseOverride(itemId) {
    const override = aimPoseOverrides.get(itemId);
    if (!override) {
      return null;
    }

    const next = {};
    let hasOverride = false;
    for (let index = 0; index < HELD_ITEM_AIM_POSE_FIELDS.length; index += 1) {
      const field = HELD_ITEM_AIM_POSE_FIELDS[index];
      const value = Number(override[field.key]);
      if (Number.isFinite(value) && Math.abs(value) > 0.000001) {
        next[field.key] = value;
        hasOverride = true;
      }
    }

    return hasOverride ? next : null;
  }

  function getMergedAimPose(itemId) {
    return mergeAimPose(getHeldItemAimPose(itemId), getAimPoseOverride(itemId));
  }

  function cloneReloadProfile(profile = null) {
    if (!profile) {
      return null;
    }

    return {
      envelope: profile.envelope
        ? {
          start: Number(profile.envelope.start ?? 0),
          peak: Number(profile.envelope.peak ?? 0),
          end: Number(profile.envelope.end ?? 0)
        }
        : null,
      handTarget: profile.handTarget
        ? {
          nodeName: profile.handTarget.nodeName ?? '',
          position: cloneNumberVector3(profile.handTarget.position, 0),
          rotation: cloneNumberVector3(profile.handTarget.rotation, 0),
          scale: cloneNumberVector3(profile.handTarget.scale, 1)
        }
        : null,
      slide: profile.slide
        ? {
          nodeName: profile.slide.nodeName ?? '',
          start: Number(profile.slide.start ?? 0),
          peak: Number(profile.slide.peak ?? 0),
          end: Number(profile.slide.end ?? 0),
          position: cloneNumberVector3(profile.slide.position, 0)
        }
        : null,
      weaponMotion: profile.weaponMotion
        ? {
          position: cloneNumberVector3(profile.weaponMotion.position, 0),
          rotation: cloneNumberVector3(profile.weaponMotion.rotation, 0)
        }
        : null,
      pose: cloneReloadPose(profile.pose)
    };
  }

  function mergeReloadProfile(base = null, override = null) {
    if (!base && !override) {
      return null;
    }

    const next = {
      envelope: {
        start: Number(override?.envelope?.start ?? base?.envelope?.start ?? 0),
        peak: Number(override?.envelope?.peak ?? base?.envelope?.peak ?? 0),
        end: Number(override?.envelope?.end ?? base?.envelope?.end ?? 0)
      },
      handTarget: {
        nodeName: override?.handTarget?.nodeName ?? base?.handTarget?.nodeName ?? '',
        position: mergeNumberVector3(override?.handTarget?.position, base?.handTarget?.position, 0),
        rotation: mergeNumberVector3(override?.handTarget?.rotation, base?.handTarget?.rotation, 0),
        scale: mergeNumberVector3(override?.handTarget?.scale, base?.handTarget?.scale, 1)
      },
      slide: {
        nodeName: override?.slide?.nodeName ?? base?.slide?.nodeName ?? '',
        start: Number(override?.slide?.start ?? base?.slide?.start ?? 0),
        peak: Number(override?.slide?.peak ?? base?.slide?.peak ?? 0),
        end: Number(override?.slide?.end ?? base?.slide?.end ?? 0),
        position: mergeNumberVector3(override?.slide?.position, base?.slide?.position, 0)
      },
      weaponMotion: {
        position: mergeNumberVector3(override?.weaponMotion?.position, base?.weaponMotion?.position, 0),
        rotation: mergeNumberVector3(override?.weaponMotion?.rotation, base?.weaponMotion?.rotation, 0)
      },
      pose: {}
    };

    const poseKeys = new Set();
    const basePose = base?.pose ?? {};
    const overridePose = override?.pose ?? {};
    for (const boneKey in basePose) {
      if (Object.hasOwn(basePose, boneKey)) {
        poseKeys.add(boneKey);
      }
    }
    for (const boneKey in overridePose) {
      if (Object.hasOwn(overridePose, boneKey)) {
        poseKeys.add(boneKey);
      }
    }
    for (const boneKey of poseKeys) {
      next.pose[boneKey] = mergeNumberVector3(override?.pose?.[boneKey], base?.pose?.[boneKey], 0);
    }

    return next;
  }

  function getReloadProfileOverride(itemId) {
    return cloneReloadProfile(reloadProfileOverrides.get(itemId) ?? null);
  }

  function getMergedReloadProfile(itemId) {
    return mergeReloadProfile(getHeldItemReloadProfile(itemId), getReloadProfileOverride(itemId));
  }

  function applyHeldItemProfile(itemId) {
    const entry = heldItemEntries.get(itemId);
    if (!entry) {
      return null;
    }

    return applyHeldItemGripTransform(entry.container, itemId, getGripOverride(itemId));
  }

  function updateHeldItemVisibility() {
    for (const itemId of heldItemEntries.keys()) {
      const entry = heldItemEntries.get(itemId);
      const activeItemId = activeItemsBySlot.get(entry.slot);
      const slotShown = slotVisibility.get(entry.slot) !== false;
      entry.container.visible = aliveState && itemId === activeItemId && slotShown;
    }
  }

  function setHeldItemAimPoseFieldOverride(itemId, fieldKey, value = 0) {
    if (!itemId || !HELD_ITEM_AIM_POSE_FIELD_KEYS.has(fieldKey)) {
      return itemId ? getMergedAimPose(itemId) : null;
    }

    const nextOverride = {
      ...(getAimPoseOverride(itemId) ?? {})
    };
    const baseValue = Number(getHeldItemAimPose(itemId)?.[fieldKey] ?? 0);
    const numericValue = Number(value);
    const overrideValue = numericValue - baseValue;
    if (!Number.isFinite(overrideValue) || Math.abs(overrideValue) < 0.000001) {
      delete nextOverride[fieldKey];
    } else {
      nextOverride[fieldKey] = overrideValue;
    }

    if (!hasOwnEnumerableProperties(nextOverride)) {
      aimPoseOverrides.delete(itemId);
    } else {
      aimPoseOverrides.set(itemId, nextOverride);
    }

    return getMergedAimPose(itemId);
  }

  function addBoneRotation(rotationsByBone, boneKey, axis, value) {
    if (!Number.isFinite(value) || Math.abs(value) < 0.000001) {
      return;
    }

    const nextRotation = rotationsByBone.get(boneKey) ?? { x: 0, y: 0, z: 0 };
    nextRotation[axis] = (nextRotation[axis] ?? 0) + value;
    rotationsByBone.set(boneKey, nextRotation);
  }

  function setBoneBlendWeight(weightsByBone, boneKey, value) {
    if (!Number.isFinite(value) || value <= 0.0001) {
      return;
    }

    weightsByBone.set(boneKey, Math.max(weightsByBone.get(boneKey) ?? 0, value));
  }

  function findReloadNode(root, nodeName) {
    if (!root || !nodeName) {
      return null;
    }

    const direct = root.getObjectByName(nodeName);
    if (direct) {
      return direct;
    }

    const normalizedTarget = String(nodeName).trim().toLowerCase();
    let fallback = null;
    root.traverse((node) => {
      if (fallback || !node?.name) {
        return;
      }

      if (String(node.name).trim().toLowerCase() === normalizedTarget) {
        fallback = node;
      }
    });
    return fallback;
  }

  function resetHeldItemReloadMotion(itemId) {
    const entry = heldItemEntries.get(itemId);
    const slideNode = entry?.reload?.slideNode;
    const slideBasePosition = entry?.reload?.slideBasePosition;
    if (slideNode && slideBasePosition) {
      slideNode.position.copy(slideBasePosition);
    }
  }

  function setReloadState(reloading, options = null) {
    const weaponId = options?.weaponId ?? '';
    const startedAtMs = options?.startedAtMs ?? 0;
    const endsAtMs = options?.endsAtMs ?? 0;
    const resetMotion = options?.resetMotion !== false;
    const previousWeaponId = reloadState.weaponId;

    if (!reloading) {
      if (!reloadState.active && !previousWeaponId && reloadState.startedAtMs === 0 && reloadState.endsAtMs === 0) {
        return false;
      }
      reloadState.active = false;
      reloadState.weaponId = '';
      reloadState.startedAtMs = 0;
      reloadState.endsAtMs = 0;
      if (previousWeaponId && resetMotion) {
        resetHeldItemReloadMotion(previousWeaponId);
      }
      return false;
    }

    const nextWeaponId = weaponId || desiredWeaponId || getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || '';
    if (!nextWeaponId) {
      return false;
    }

    const resolvedEndsAtMs = Number.isFinite(endsAtMs) && endsAtMs > 0
      ? endsAtMs
      : (Date.now() + WEAPON_RELOAD_MS);
    const resolvedStartedAtMs = Number.isFinite(startedAtMs) && startedAtMs > 0
      ? startedAtMs
      : Math.max(0, resolvedEndsAtMs - WEAPON_RELOAD_MS);

    reloadState.active = true;
    reloadState.weaponId = nextWeaponId;
    reloadState.startedAtMs = resolvedStartedAtMs;
    reloadState.endsAtMs = resolvedEndsAtMs;
    if (previousWeaponId && previousWeaponId !== nextWeaponId) {
      resetHeldItemReloadMotion(previousWeaponId);
    }
    return true;
  }

  function setReloadPreviewState(previewing, options = null) {
    const weaponId = options?.weaponId ?? '';
    const startedAtMs = options?.startedAtMs ?? 0;
    const endsAtMs = options?.endsAtMs ?? 0;
    const resetMotion = options?.resetMotion !== false;
    const previousWeaponId = reloadPreviewState.weaponId;

    if (!previewing) {
      if (
        !reloadPreviewState.active
        && !previousWeaponId
        && reloadPreviewState.startedAtMs === 0
        && reloadPreviewState.endsAtMs === 0
      ) {
        return false;
      }
      reloadPreviewState.active = false;
      reloadPreviewState.weaponId = '';
      reloadPreviewState.startedAtMs = 0;
      reloadPreviewState.endsAtMs = 0;
      if (previousWeaponId && !reloadState.active && resetMotion) {
        resetHeldItemReloadMotion(previousWeaponId);
      }
      return false;
    }

    const nextWeaponId = weaponId || desiredWeaponId || getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || '';
    if (!nextWeaponId) {
      return false;
    }

    const resolvedEndsAtMs = Number.isFinite(endsAtMs) && endsAtMs > 0
      ? endsAtMs
      : (Date.now() + WEAPON_RELOAD_MS);
    const resolvedStartedAtMs = Number.isFinite(startedAtMs) && startedAtMs > 0
      ? startedAtMs
      : Math.max(0, resolvedEndsAtMs - WEAPON_RELOAD_MS);

    reloadPreviewState.active = true;
    reloadPreviewState.weaponId = nextWeaponId;
    reloadPreviewState.startedAtMs = resolvedStartedAtMs;
    reloadPreviewState.endsAtMs = resolvedEndsAtMs;
    if (previousWeaponId && previousWeaponId !== nextWeaponId) {
      resetHeldItemReloadMotion(previousWeaponId);
    }
    return true;
  }

  function getEffectiveReloadState() {
    return reloadPreviewState.active ? reloadPreviewState : reloadState;
  }

  function updateReloadOverlayState(deltaSeconds, activeItemId) {
    const profile = activeItemId ? getMergedReloadProfile(activeItemId) : null;
    const activeReloadState = getEffectiveReloadState();
    const shouldAnimateReload = Boolean(
      activeReloadState.active
      && activeReloadState.weaponId === activeItemId
      && profile
      && aliveState
      && !ragdoll.isActive()
    );

    const nowMs = Date.now();
    const reloadExpired = shouldAnimateReload
      && Number.isFinite(activeReloadState.endsAtMs)
      && activeReloadState.endsAtMs > 0
      && nowMs >= activeReloadState.endsAtMs;
    if (reloadExpired) {
      if (reloadPreviewState.active) {
        setReloadPreviewState(false, { resetMotion: false });
      } else {
        setReloadState(false, { resetMotion: false });
      }
    }

    const activeProfile = shouldAnimateReload && !reloadExpired ? profile : null;
    const targetWeight = activeProfile ? 1 : 0;
    reloadPoseWeight = THREE.MathUtils.damp(reloadPoseWeight, targetWeight, targetWeight > 0 ? 18 : 24, deltaSeconds);

    if (activeProfile) {
      const durationMs = Math.max(1, activeReloadState.endsAtMs - activeReloadState.startedAtMs);
      const reloadProgress = clamp01((nowMs - activeReloadState.startedAtMs) / durationMs);
      const envelope = activeProfile.envelope ?? {};
      const envelopeAmount = trianglePulse(
        reloadProgress,
        Number(envelope.start ?? 0.14),
        Number(envelope.peak ?? 0.4),
        Number(envelope.end ?? 0.88)
      );
      const slide = activeProfile.slide ?? {};
      const slideAmount = trianglePulse(
        reloadProgress,
        Number(slide.start ?? 0.34),
        Number(slide.peak ?? 0.48),
        Number(slide.end ?? 0.68)
      );

      reloadPoseAmount = envelopeAmount * reloadPoseWeight;
      reloadSlideAmount = slideAmount * reloadPoseWeight;
      reloadWeaponMotionAmount = Math.max(reloadPoseAmount * 0.85, reloadSlideAmount);
      lastReloadProfile = activeProfile;
    } else {
      reloadPoseAmount = 0;
      reloadSlideAmount = 0;
      reloadWeaponMotionAmount = 0;
    }

    reloadDisplayedPoseAmount = THREE.MathUtils.damp(reloadDisplayedPoseAmount, reloadPoseAmount, activeProfile ? 18 : 12, deltaSeconds);
    reloadDisplayedSlideAmount = THREE.MathUtils.damp(reloadDisplayedSlideAmount, reloadSlideAmount, activeProfile ? 22 : 14, deltaSeconds);
    reloadDisplayedWeaponMotionAmount = THREE.MathUtils.damp(reloadDisplayedWeaponMotionAmount, reloadWeaponMotionAmount, activeProfile ? 18 : 12, deltaSeconds);

    const displayActive = reloadDisplayedPoseAmount > 0.0001
      || reloadDisplayedSlideAmount > 0.0001
      || reloadDisplayedWeaponMotionAmount > 0.0001;
    if (!displayActive) {
      if (activeItemId) {
        resetHeldItemReloadMotion(activeItemId);
      }
      lastReloadProfile = activeProfile ?? null;
      return activeProfile;
    }

    return activeProfile ?? lastReloadProfile;
  }

  function applyHeldItemReloadMotion(itemId, profile) {
    if (!itemId) {
      return;
    }

    const entry = heldItemEntries.get(itemId);
    if (!entry) {
      return;
    }

    const slideNode = entry.reload?.slideNode;
    const slideBasePosition = entry.reload?.slideBasePosition;
    if (!slideNode || !slideBasePosition) {
      return;
    }

    slideNode.position.copy(slideBasePosition);
    const slidePosition = profile?.slide?.position ?? EMPTY_VECTOR_OVERRIDE;
    slideNode.position.x += (slidePosition[0] ?? 0) * reloadSlideAmount;
    slideNode.position.y += (slidePosition[1] ?? 0) * reloadSlideAmount;
    slideNode.position.z += (slidePosition[2] ?? 0) * reloadSlideAmount;
  }

  function applyReloadArmIk(itemId, profile) {
    if (!itemId || !profile || reloadDisplayedPoseAmount <= 0.0001) {
      return;
    }

    const leftShoulder = aimPoseBones.leftShoulder;
    const leftArm = aimPoseBones.leftArm;
    const leftForeArm = aimPoseBones.leftForeArm;
    const leftHand = aimPoseBones.leftHand;
    const handTarget = heldItemEntries.get(itemId)?.reload?.handTarget;
    if (!leftShoulder || !leftArm || !leftForeArm || !leftHand || !handTarget) {
      return;
    }

    const ikChain = [leftForeArm, leftArm, leftShoulder];
    handTarget.getWorldPosition(reloadIkTargetPosition);
    character.updateMatrixWorld(true);

    for (let iteration = 0; iteration < 7; iteration += 1) {
      for (const bone of ikChain) {
        bone.getWorldPosition(reloadIkBonePosition);
        leftHand.getWorldPosition(reloadIkEndPosition);

        reloadIkToEnd.subVectors(reloadIkEndPosition, reloadIkBonePosition);
        reloadIkToTarget.subVectors(reloadIkTargetPosition, reloadIkBonePosition);
        if (reloadIkToEnd.lengthSq() <= 0.000001 || reloadIkToTarget.lengthSq() <= 0.000001) {
          continue;
        }

        reloadIkToEnd.normalize();
        reloadIkToTarget.normalize();
        const dot = THREE.MathUtils.clamp(reloadIkToEnd.dot(reloadIkToTarget), -1, 1);
        const angle = Math.acos(dot);
        if (!Number.isFinite(angle) || angle <= 0.0001) {
          continue;
        }

        reloadIkAxisWorld.crossVectors(reloadIkToEnd, reloadIkToTarget);
        if (reloadIkAxisWorld.lengthSq() <= 0.000001) {
          continue;
        }

        reloadIkAxisWorld.normalize();
        if (bone.parent) {
          bone.parent.getWorldQuaternion(reloadIkParentWorldQuaternion);
          reloadIkAxisLocal.copy(reloadIkAxisWorld).applyQuaternion(reloadIkParentWorldQuaternion.invert()).normalize();
        } else {
          reloadIkAxisLocal.copy(reloadIkAxisWorld);
        }

        reloadIkDeltaQuaternion.setFromAxisAngle(
          reloadIkAxisLocal,
          Math.min(angle, 0.65) * reloadDisplayedPoseAmount
        );
        bone.quaternion.premultiply(reloadIkDeltaQuaternion);
        bone.updateMatrixWorld(true);
      }

      leftHand.getWorldPosition(reloadIkEndPosition);
      if (reloadIkEndPosition.distanceToSquared(reloadIkTargetPosition) <= 0.0004) {
        break;
      }
    }

    handTarget.getWorldQuaternion(reloadIkTargetQuaternion);
    if (leftHand.parent) {
      leftHand.parent.getWorldQuaternion(reloadIkParentInverseQuaternion).invert();
      reloadIkLocalTargetQuaternion.copy(reloadIkParentInverseQuaternion).multiply(reloadIkTargetQuaternion);
      leftHand.quaternion.slerp(reloadIkLocalTargetQuaternion, 0.75 * reloadDisplayedPoseAmount);
    }
  }

  function applyUpperBodyPose() {
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || desiredWeaponId;
    const pose = activeItemId ? getMergedAimPose(activeItemId) : null;
    const hasLookPose = upperBodyLookWeight > 0.0001;
    const hasAimPose = aimPoseWeight > 0.0001 && Boolean(pose);
    const reloadProfile = activeItemId ? getMergedReloadProfile(activeItemId) : null;
    const hasReloadPose = reloadDisplayedPoseAmount > 0.0001 && Boolean(reloadProfile?.pose);
    const stabilizeUpperBody = aimingState && Boolean(pose);
    const leftArmIdleLockActive = hasAimPose
      && !hasReloadPose
      && !poseHasAimIdleLockField(pose);

    if ((!hasLookPose && !hasAimPose && !hasReloadPose) || !aliveState || ragdoll.isActive()) {
      return;
    }

    const rotationsByBone = aimPoseRotationsByBone;
    const blendWeightsByBone = aimPoseBlendWeightsByBone;
    rotationsByBone.clear();
    blendWeightsByBone.clear();
    activeAimBones.clear();
    if (hasLookPose) {
      const emoteAimYawOffset = Number(
        activeEmoteConfig?.aimYawOffset ?? 0
      );
      const aimDelta = normalizeAngle(aimRotationY - anchor.rotation.y + emoteAimYawOffset);
      addBoneRotation(rotationsByBone, UPPER_BODY_ROOT_BONE, 'y', aimDelta);
      setBoneBlendWeight(blendWeightsByBone, UPPER_BODY_ROOT_BONE, upperBodyLookWeight);
    }

    if (hasAimPose) {
      for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
        const value = Number(pose?.[field.key] ?? 0);
        if (!Number.isFinite(value) || Math.abs(value) < 0.000001) {
          continue;
        }

        addBoneRotation(rotationsByBone, field.bone, field.axis, value);
        setBoneBlendWeight(blendWeightsByBone, field.bone, aimPoseWeight);
        activeAimBones.add(field.bone);
      }
    }

    if (hasReloadPose) {
      for (const boneKey of RELOAD_POSE_BONES) {
        if (RELOAD_IK_DRIVEN_BONES.has(boneKey)) {
          continue;
        }

        const rotation = reloadProfile.pose?.[boneKey];
        if (!rotation) {
          continue;
        }

        addBoneRotation(rotationsByBone, boneKey, 'x', Number(rotation[0] ?? 0) * reloadDisplayedPoseAmount);
        addBoneRotation(rotationsByBone, boneKey, 'y', Number(rotation[1] ?? 0) * reloadDisplayedPoseAmount);
        addBoneRotation(rotationsByBone, boneKey, 'z', Number(rotation[2] ?? 0) * reloadDisplayedPoseAmount);
        setBoneBlendWeight(blendWeightsByBone, boneKey, reloadDisplayedPoseAmount);
      }
    }

    if (stabilizeUpperBody) {
      const rootBone = aimPoseBones[UPPER_BODY_ROOT_BONE];
      const rootBase = aimPoseBoneBases[UPPER_BODY_ROOT_BONE];
      if (rootBone && rootBase) {
        rootBone.quaternion.copy(rootBase.quaternion);
      }

      for (const boneKey of activeAimBones) {
        if (boneKey === UPPER_BODY_ROOT_BONE) {
          continue;
        }
        const bone = aimPoseBones[boneKey];
        const base = aimPoseBoneBases[boneKey];
        if (!bone || !base) {
          continue;
        }

        bone.quaternion.copy(base.quaternion);
      }
    }

    for (const boneKey of rotationsByBone.keys()) {
      const rotation = rotationsByBone.get(boneKey);
      const bone = aimPoseBones[boneKey];
      const base = aimPoseBoneBases[boneKey];
      const blendWeight = blendWeightsByBone.get(boneKey) ?? 0;
      if (!bone || !base || blendWeight <= 0.0001) {
        continue;
      }

      aimPoseEuler.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
      aimPoseQuaternion.setFromEuler(aimPoseEuler);
      aimPoseTargetQuaternion.copy(base.quaternion).multiply(aimPoseQuaternion);
      bone.quaternion.slerp(aimPoseTargetQuaternion, blendWeight);
    }

    if (leftArmIdleLockActive) {
      for (const boneKey of AIM_IDLE_LOCK_BONES) {
        const bone = aimPoseBones[boneKey];
        const base = aimPoseIdleBases[boneKey];
        if (!bone || !base) {
          continue;
        }

        bone.quaternion.slerp(base.quaternion, aimPoseWeight);
      }
    }
  }

  async function ensureHeldItemEntry(itemId) {
    if (heldItemEntries.has(itemId)) {
      return heldItemEntries.get(itemId);
    }

    if (!heldItemLoads.has(itemId)) {
      const definition = getHeldItemDefinition(itemId);
      const assetUrl = getHeldItemAssetUrl(itemId);
      const slot = getHeldItemAttachmentSlot(itemId);
      const motionRoot = getSlotMotionRoot(slot);
      if (!definition || (!assetUrl && typeof definition.createModel !== 'function') || !motionRoot) {
        return null;
      }

      const modelPromise = typeof definition.createModel === 'function'
        ? Promise.resolve(definition.createModel())
        : library.instantiate(assetUrl);

      heldItemLoads.set(itemId, modelPromise
        .then((object) => {
          prepareHeldItemModel(object, itemId, 'equipped');
          const container = new THREE.Group();
          container.name = `HeldItem_${itemId}`;
          container.visible = false;
          container.add(object);

          const points = new Map();
          const definitionPoints = definition.points ?? {};
          for (const pointName in definitionPoints) {
            if (!Object.hasOwn(definitionPoints, pointName)) {
              continue;
            }

            const pointNode = new THREE.Group();
            pointNode.name = `HeldItemPoint_${pointName}`;
            applyAttachmentTransform(pointNode, getHeldItemPointOffset(itemId, pointName));
            container.add(pointNode);
            points.set(pointName, pointNode);
          }

          const reloadProfile = getMergedReloadProfile(itemId);
          const slideNode = reloadProfile?.slide?.nodeName
            ? findReloadNode(object, reloadProfile.slide.nodeName)
            : null;
          const handTargetParent = reloadProfile?.handTarget?.nodeName
            ? findReloadNode(object, reloadProfile.handTarget.nodeName)
            : (slideNode ?? object);
          const handTarget = new THREE.Group();
          handTarget.name = `HeldItemReloadTarget_${itemId}`;
          applyAttachmentTransform(handTarget, reloadProfile?.handTarget ?? null);
          handTargetParent?.add(handTarget);

          motionRoot.add(container);
          heldItemEntries.set(itemId, {
            id: itemId,
            slot,
            container,
            object,
            points,
            reload: {
              slideNode,
              slideBasePosition: slideNode?.position?.clone?.() ?? null,
              handTarget
            }
          });
          applyHeldItemProfile(itemId);
          return heldItemEntries.get(itemId);
        })
        .catch((error) => {
          heldItemLoads.delete(itemId);
          console.warn(`[Player] Failed to load held item ${itemId}.`, error);
          return null;
        }));
    }

    return heldItemLoads.get(itemId);
  }

  function detachHeldItem(slot = ATTACHMENT_SLOTS.handRight) {
    const itemId = getActiveHeldItemId(slot);
    activeItemsBySlot.delete(slot);
    slotVisibility.set(slot, false);
    if (slot === ATTACHMENT_SLOTS.handRight && itemId !== HELD_ITEM_IDS.phone) {
      desiredWeaponId = '';
    }
    if (itemId) {
      resetHeldItemReloadMotion(itemId);
    }
    updateHeldItemVisibility();
  }

  async function attachHeldItem(itemId, { visible = true } = {}) {
    const definition = getHeldItemDefinition(itemId);
    if (!definition) {
      return null;
    }

    const slot = definition.attachmentSlot;
    const entry = await ensureHeldItemEntry(itemId);
    if (!entry) {
      return null;
    }

    activeItemsBySlot.set(slot, itemId);
    slotVisibility.set(slot, Boolean(visible && itemId));
    applyHeldItemProfile(itemId);
    updateHeldItemVisibility();
    return entry;
  }

  function getDesiredLeftHandItemId() {
    if (deliveryPackageActive) {
      return HELD_ITEM_IDS.deliveryBox;
    }

    return '';
  }

  function isLeftHandEquipmentSynced() {
    const desiredItemId = getDesiredLeftHandItemId();
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handLeft);
    return desiredItemId
      ? activeItemId === desiredItemId
      : !managedLeftHandItemIds.has(activeItemId);
  }

  async function syncLeftHandEquipment() {
    const requestId = ++leftHandEquipmentRequestId;
    const desiredItemId = getDesiredLeftHandItemId();
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handLeft);

    if (!desiredItemId) {
      if (managedLeftHandItemIds.has(activeItemId)) {
        detachHeldItem(ATTACHMENT_SLOTS.handLeft);
      } else {
        updateHeldItemVisibility();
      }
      return getActiveHeldItemId(ATTACHMENT_SLOTS.handLeft);
    }

    if (activeItemId === desiredItemId) {
      slotVisibility.set(ATTACHMENT_SLOTS.handLeft, aliveState);
      applyHeldItemProfile(desiredItemId);
      updateHeldItemVisibility();
      return activeItemId;
    }

    await attachHeldItem(desiredItemId, { visible: aliveState });
    if (requestId !== leftHandEquipmentRequestId || getDesiredLeftHandItemId() !== desiredItemId) {
      void syncLeftHandEquipment();
      return getActiveHeldItemId(ATTACHMENT_SLOTS.handLeft);
    }

    updateHeldItemVisibility();
    return getActiveHeldItemId(ATTACHMENT_SLOTS.handLeft);
  }

  function isPhoneEquipmentSynced() {
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);
    return phoneTextingActive
      ? activeItemId === HELD_ITEM_IDS.phone
      : activeItemId !== HELD_ITEM_IDS.phone;
  }

  async function syncPhoneEquipment() {
    const requestId = ++phoneEquipmentRequestId;
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);

    if (!phoneTextingActive) {
      if (activeItemId === HELD_ITEM_IDS.phone) {
        activeItemsBySlot.delete(ATTACHMENT_SLOTS.handRight);
        slotVisibility.set(ATTACHMENT_SLOTS.handRight, false);
        resetHeldItemReloadMotion(HELD_ITEM_IDS.phone);
      }
      updateHeldItemVisibility();
      if (desiredWeaponId && aliveState) {
        void setWeaponState(desiredWeaponId, { visible: true });
      }
      return getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);
    }

    if (activeItemId === HELD_ITEM_IDS.phone) {
      slotVisibility.set(ATTACHMENT_SLOTS.handRight, aliveState);
      applyHeldItemProfile(HELD_ITEM_IDS.phone);
      updateHeldItemVisibility();
      return activeItemId;
    }

    await attachHeldItem(HELD_ITEM_IDS.phone, { visible: aliveState });
    if (requestId !== phoneEquipmentRequestId || !phoneTextingActive) {
      void syncPhoneEquipment();
      return getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);
    }

    updateHeldItemVisibility();
    return getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);
  }

  async function setDeliveryPackageActive(active) {
    const nextActive = Boolean(active);
    if (deliveryPackageActive === nextActive && isLeftHandEquipmentSynced()) {
      updateHeldItemVisibility();
      return deliveryPackageActive;
    }

    deliveryPackageActive = nextActive;
    await syncLeftHandEquipment();
    return deliveryPackageActive;
  }

  async function setPhoneTextingActive(active) {
    const nextActive = Boolean(active);
    if (phoneTextingActive === nextActive && isPhoneEquipmentSynced()) {
      updateHeldItemVisibility();
      return phoneTextingActive;
    }

    phoneTextingActive = nextActive;
    await syncPhoneEquipment();
    return phoneTextingActive;
  }

  async function ensurePlayerVehicleModel(itemId = '') {
    const normalizedItemId = normalizePlayerVehicleItemId(itemId);
    if (!normalizedItemId) {
      return null;
    }

    if (playerVehicleModels.has(normalizedItemId)) {
      return playerVehicleModels.get(normalizedItemId);
    }

    if (!playerVehicleModelLoads.has(normalizedItemId)) {
      const assetUrl = PLAYER_CAR_ASSET_URLS[normalizedItemId];
      if (!assetUrl) {
        return null;
      }

      const load = library.instantiate(assetUrl)
        .then((object) => {
          object.name = `PlayerVehicle:${normalizedItemId}`;
          object.visible = false;
          preparePlayerVehicleModel(object);
          fitPlayerVehicleModelToFootprint(object);
          centerAndGroundVehicleModel(object, normalizedItemId);
          vehicleRoot.add(object);
          playerVehicleModels.set(normalizedItemId, object);
          return object;
        })
        .catch((error) => {
          playerVehicleModelLoads.delete(normalizedItemId);
          console.warn('[Player] Failed to load selected vehicle model.', {
            itemId: normalizedItemId,
            error
          });
          return null;
        });
      playerVehicleModelLoads.set(normalizedItemId, load);
    }

    return playerVehicleModelLoads.get(normalizedItemId);
  }

  function hidePlayerVehicleModels() {
    for (const model of playerVehicleModels.values()) {
      model.visible = false;
    }
    vehicleRoot.visible = false;
  }

  function setSkateboardState({
    owned = skateboardOwned,
    skating = skateboardSkating,
    vehicleItemId = activeVehicleItemId
  } = {}) {
    activeVehicleItemId = normalizePlayerVehicleItemId(vehicleItemId);
    skateboardOwned = owned === true;
    skateboardSkating = Boolean((skateboardOwned || activeVehicleItemId) && skating && aliveState && !ragdoll.isActive());
    if (!skateboardSkating) {
      skateboard.visible = false;
      hidePlayerVehicleModels();
      character.visible = true;
    }
    return skateboardSkating;
  }

  function clearSkateboardMotionState() {
    skateboardStateScratch.owned = skateboardOwned;
    skateboardStateScratch.skating = false;
    skateboardStateScratch.vehicleItemId = activeVehicleItemId;
    return setSkateboardState(skateboardStateScratch);
  }

  function updateSkateboardVisual(deltaSeconds, moving = false) {
    const active = Boolean((skateboardOwned || activeVehicleItemId) && skateboardSkating && aliveState && !ragdoll.isActive());
    const activeCar = Boolean(active && activeVehicleItemId);
    if (activeCar) {
      skateboard.visible = false;
      const vehicleModel = playerVehicleModels.get(activeVehicleItemId);
      if (!vehicleModel) {
        void ensurePlayerVehicleModel(activeVehicleItemId);
        hidePlayerVehicleModels();
        character.visible = true;
        return;
      }

      hidePlayerVehicleModels();
      vehicleRoot.visible = true;
      vehicleModel.visible = true;
      character.visible = false;
      return;
    }

    hidePlayerVehicleModels();
    character.visible = true;
    skateboard.visible = active;
    if (!active) {
      return;
    }

    if (!moving) {
      skateboard.position.y = PLAYER_SKATEBOARD_REST_Y;
      skateboard.rotation.x = 0;
      skateboard.rotation.z = 0;
      return;
    }

    skateboardMotion += deltaSeconds * 12;
    skateboard.position.y = PLAYER_SKATEBOARD_REST_Y + (Math.sin(skateboardMotion * 2.4) * 0.018);
    skateboard.rotation.x = Math.sin(skateboardMotion * 1.6) * 0.035;
    skateboard.rotation.z = Math.sin(skateboardMotion * 1.9) * 0.045;
    for (const child of skateboard.children) {
      if (child.name?.startsWith('PlayerSkateboardWheel_')) {
        child.rotation.x -= deltaSeconds * 11;
      }
    }
  }

  function applySkateboardStaticBodyPose(deltaSeconds, active) {
    if (skateboardStaticBodyPose.length === 0) {
      skateboardStaticBodyPoseWeight = 0;
      return;
    }

    skateboardStaticBodyPoseWeight = active
      ? 1
      : THREE.MathUtils.damp(skateboardStaticBodyPoseWeight, 0, 18, deltaSeconds);
    if (skateboardStaticBodyPoseWeight <= 0.0001) {
      return;
    }

    for (const { bone, targetQuaternion } of skateboardStaticBodyPose) {
      bone.quaternion.slerp(targetQuaternion, skateboardStaticBodyPoseWeight);
    }
  }

  function updateAnimationState(deltaSeconds, moving, groundHeight = 0, options = {}) {
    const now = performance.now();
    const hitReactionActive = now < hitReactionSuppressUntilMs && aliveState && !ragdoll.isActive();
    const baseAnimationWeight = hitReactionActive ? HIT_REACTION_BASE_ANIMATION_WEIGHT : 1;
    const activeAimItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || desiredWeaponId;
    const upperBodyOnlyEmoteActive = Boolean(activeEmoteConfig?.upperBodyOnly);
    const punchEmoteActive = PUNCH_LUNGE_EMOTE_IDS.has(activeEmoteId);
    const punchElapsedMs = punchEmoteActive
      ? Math.max(0, Date.now() - activeEmoteStartedAt)
      : Infinity;
    const punchStanceActive = punchEmoteActive && punchElapsedMs < PUNCH_STANCE_TURN_MS;
    const punchStanceProgress = punchStanceActive
      ? THREE.MathUtils.clamp(punchElapsedMs / PUNCH_STANCE_TURN_MS, 0, 1)
      : 1;
    const punchStanceWeight = punchStanceActive ? 1 - smooth01(punchStanceProgress) : 0;
    const activePunchLowerBodyAction = punchEmoteActive
      ? getLoadedEmoteLowerBodyAction(activeEmoteId)
      : null;
    const punchLowerBodyProgress = punchEmoteActive
      ? THREE.MathUtils.clamp(punchElapsedMs / PUNCH_LOWER_BODY_OVERLAY_MS, 0, 1)
      : 1;
    const punchLowerBodyFade = punchLowerBodyProgress < 0.72
      ? 1
      : 1 - smooth01((punchLowerBodyProgress - 0.72) / 0.28);
    const punchLowerBodyWeight = activePunchLowerBodyAction && !moving && !ragdoll.isActive()
      ? PUNCH_LOWER_BODY_OVERLAY_WEIGHT * punchLowerBodyFade
      : 0;
    const skateboardPoseActive = Boolean(skateboardOwned && !activeVehicleItemId && skateboardSkating && aliveState && !ragdoll.isActive());
    const wantsDeliveryCarry = Boolean(
      deliveryPackageActive
      && aliveState
      && !activeEmoteId
      && !aimingState
      && !reloadState.active
      && !reloadPreviewState.active
      && !isLimpTransitioning()
    );
    deliveryCarryWeight = THREE.MathUtils.damp(deliveryCarryWeight, wantsDeliveryCarry ? 1 : 0, wantsDeliveryCarry ? 12 : 16, deltaSeconds);
    const upperBodyOverlayActive = upperBodyOnlyEmoteActive || deliveryCarryWeight > 0.0001;
    const locomotionEnabled = aliveState && (!activeEmoteId || upperBodyOverlayActive) && !isLimpTransitioning();
    const smoothing = locomotionEnabled ? 12 : 22;
    const drunkBlendSpan = Math.max(1, DRUNKNESS_MAX_LEVEL - DRUNKNESS_MIN_ANIMATION_LEVEL + 1);
    const targetDrunkLocomotionWeight = drunknessLevel >= DRUNKNESS_MIN_ANIMATION_LEVEL
      ? THREE.MathUtils.clamp((drunknessLevel - DRUNKNESS_MIN_ANIMATION_LEVEL + 1) / drunkBlendSpan, 0, 1)
      : 0;
    drunkLocomotionWeight = THREE.MathUtils.damp(
      drunkLocomotionWeight,
      targetDrunkLocomotionWeight,
      targetDrunkLocomotionWeight > drunkLocomotionWeight ? 7 : 10,
      deltaSeconds
    );
    const soberLocomotionWeight = 1 - drunkLocomotionWeight;
    const runLocomotionActive = options.locomotionMode === 'run';
    const locomotionPlaybackRate = THREE.MathUtils.clamp(Number(options.locomotionPlaybackRate ?? 1) || 1, 0.65, 1.65);
    idleWeight = THREE.MathUtils.damp(idleWeight, locomotionEnabled && !moving ? 1 : 0, smoothing, deltaSeconds);
    walkWeight = THREE.MathUtils.damp(walkWeight, locomotionEnabled && moving && !runLocomotionActive ? 1 : 0, smoothing, deltaSeconds);
    fastRunWeight = THREE.MathUtils.damp(fastRunWeight, locomotionEnabled && moving && runLocomotionActive ? 1 : 0, smoothing, deltaSeconds);
    const fullBodyLocomotionWeight = upperBodyOverlayActive ? 0 : 1;
    const lowerBodyLocomotionWeight = upperBodyOverlayActive ? Math.max(0, 1 - punchLowerBodyWeight) : 0;
    idleAction.setEffectiveWeight(idleWeight * fullBodyLocomotionWeight * soberLocomotionWeight * baseAnimationWeight);
    walkAction.setEffectiveWeight(walkWeight * fullBodyLocomotionWeight * soberLocomotionWeight * baseAnimationWeight);
    fastRunAction.setEffectiveWeight(fastRunWeight * fullBodyLocomotionWeight * soberLocomotionWeight * baseAnimationWeight);
    drunkIdleAction.setEffectiveWeight(idleWeight * fullBodyLocomotionWeight * drunkLocomotionWeight * baseAnimationWeight);
    drunkWalkAction.setEffectiveWeight(walkWeight * fullBodyLocomotionWeight * drunkLocomotionWeight * baseAnimationWeight);
    idleLowerBodyAction.setEffectiveWeight(idleWeight * lowerBodyLocomotionWeight * soberLocomotionWeight * baseAnimationWeight);
    walkLowerBodyAction.setEffectiveWeight(walkWeight * lowerBodyLocomotionWeight * soberLocomotionWeight * baseAnimationWeight);
    drunkIdleLowerBodyAction.setEffectiveWeight(idleWeight * lowerBodyLocomotionWeight * drunkLocomotionWeight * baseAnimationWeight);
    drunkWalkLowerBodyAction.setEffectiveWeight(walkWeight * lowerBodyLocomotionWeight * drunkLocomotionWeight * baseAnimationWeight);
    idleAction.setEffectiveTimeScale(locomotionEnabled ? 1 : 0);
    walkAction.setEffectiveTimeScale(locomotionEnabled && moving ? 1 : 0.35);
    fastRunAction.setEffectiveTimeScale(locomotionEnabled && moving && runLocomotionActive ? locomotionPlaybackRate : 0.35);
    drunkIdleAction.setEffectiveTimeScale(locomotionEnabled ? 1 : 0);
    drunkWalkAction.setEffectiveTimeScale(locomotionEnabled && moving ? 1 : 0.35);
    idleLowerBodyAction.setEffectiveTimeScale(locomotionEnabled ? 1 : 0);
    walkLowerBodyAction.setEffectiveTimeScale(locomotionEnabled && moving ? 1 : 0.35);
    drunkIdleLowerBodyAction.setEffectiveTimeScale(locomotionEnabled ? 1 : 0);
    drunkWalkLowerBodyAction.setEffectiveTimeScale(locomotionEnabled && moving ? 1 : 0.35);
    for (const [emoteId, action] of emoteLowerBodyActions) {
      if (emoteId !== activeEmoteId) {
        action.setEffectiveWeight(0);
        continue;
      }

      action.setEffectiveWeight(punchLowerBodyWeight * baseAnimationWeight);
      action.setEffectiveTimeScale(activeEmoteConfig?.playbackRate ?? 1);
    }
    deliveryCarryAction.setEffectiveWeight(deliveryCarryWeight * baseAnimationWeight);
    deliveryCarryAction.setEffectiveTimeScale(deliveryPackageActive ? 1 : 0.8);
    mixer.update(deltaSeconds);
    anchor.position.y = groundHeight;
    updateSkateboardVisual(deltaSeconds, moving);
    ragdoll.update(deltaSeconds);
    ragdoll.applyToSkeleton();
    const activeAimPose = activeAimItemId ? getMergedAimPose(activeAimItemId) : null;
    const reloadProfile = updateReloadOverlayState(deltaSeconds, activeAimItemId);
    const reloadForcesAimPose = reloadDisplayedPoseAmount > 0.0001 && Boolean(reloadProfile);
    const wantsAimPose = (aimingState || reloadForcesAimPose) && aliveState && !ragdoll.isActive() && Boolean(activeAimPose);
    const wantsUpperBodyLook = aliveState && (!activeEmoteId || upperBodyOverlayActive) && !isLimpTransitioning();
    aimPoseWeight = THREE.MathUtils.damp(aimPoseWeight, wantsAimPose ? 1 : 0, 14, deltaSeconds);
    upperBodyLookWeight = THREE.MathUtils.damp(upperBodyLookWeight, wantsUpperBodyLook ? 1 : 0, 14, deltaSeconds);
    if (punchStanceWeight > 0.0001) {
      const turnSmoothing = 1 - Math.exp(-24 * punchStanceWeight * deltaSeconds);
      anchor.rotation.y = dampAngle(anchor.rotation.y, aimRotationY, turnSmoothing);
    }
    applyUpperBodyPose();
    applyHeldItemReloadMotion(activeAimItemId, reloadProfile);
    applyReloadArmIk(activeAimItemId, reloadProfile);
    applySkateboardStaticBodyPose(deltaSeconds, skateboardPoseActive);
    recoilAmount = THREE.MathUtils.damp(recoilAmount, 0, wantsAimPose ? 22 : 18, deltaSeconds);
    const damageLifetime = Math.max(1, damageFeedbackEndsAt - damageFeedbackStartedAt);
    const damageProgress = THREE.MathUtils.clamp((now - damageFeedbackStartedAt) / damageLifetime, 0, 1);
    const damageActive = damageProgress < 1;
    const damageEnvelope = damageActive ? Math.pow(1 - damageProgress, 1.25) : 0;
    const damageWave = damageActive ? Math.sin(damageProgress * Math.PI * 3.4) : 0;
    const damagePulse = damageActive ? Math.sin(damageProgress * Math.PI) : 0;
    const damageSideX = -damageDirection.z;
    const damageSideZ = damageDirection.x;
    const damageJolt = damageEnvelope * 0.18 * damageFeedbackStrength;
    const damageShimmy = damageWave * damageEnvelope * 0.09 * damageFeedbackStrength;
    const damageStaggerScale = Math.max(0, damageFeedbackStrength - 1);
    const damageStagger = damageEnvelope * damageStaggerScale * DAMAGE_STAGGER_DISTANCE_PER_STRENGTH;
    const damageYaw = damageActive
      ? normalizeAngle(Math.atan2(damageDirection.x, damageDirection.z) - anchor.rotation.y)
      : 0;
    const damageTurn = THREE.MathUtils.clamp(damageYaw, -1.1, 1.1) * damageEnvelope * damageStaggerScale * DAMAGE_STAGGER_TURN_PER_STRENGTH;
    const damageLift = damagePulse * 0.12 * Math.min(1.35, damageFeedbackStrength);
    const footPlantGroundingOffsetY = getFootPlantGroundingOffset();
    const jabLungeOffset = PUNCH_LUNGE_EMOTE_IDS.has(activeEmoteId)
      ? getJabLungeOffset(Date.now() - activeEmoteStartedAt, activePunchLungeBonus)
      : 0;
    const jabLungeLocalYaw = normalizeAngle(aimRotationY - anchor.rotation.y);
    const jabLungeLocalX = Math.sin(jabLungeLocalYaw) * jabLungeOffset;
    const jabLungeLocalZ = Math.cos(jabLungeLocalYaw) * jabLungeOffset;
    const damageFlashAmount = damageActive
      ? Math.min(1, (damageEnvelope * 0.72) + (Math.abs(damageWave) * 0.2))
      : 0;

    visual.position.set(
      (damageDirection.x * (damageJolt + damageStagger)) + (damageSideX * damageShimmy) + jabLungeLocalX,
      (recoilAmount * 0.03) + damageLift - footPlantGroundingOffsetY,
      (damageDirection.z * (damageJolt + damageStagger)) + (damageSideZ * damageShimmy) + jabLungeLocalZ
    );
    visual.rotation.set(
      (-recoilAmount * 0.08) - (damageDirection.z * damageEnvelope * 0.12 * damageFeedbackStrength) + (damageWave * 0.025),
      damageTurn + (damageWave * damageEnvelope * 0.025),
      (recoilAmount * 0.015) + (damageDirection.x * damageEnvelope * 0.14 * damageFeedbackStrength) + (damageWave * 0.045)
    );

    indicatorRing.material.color.copy(indicatorBaseColor).lerp(DAMAGE_FLASH_COLOR, damageFlashAmount * 0.85);
    indicatorRing.material.opacity = THREE.MathUtils.lerp(indicatorOpacity, 1, damageFlashAmount * 0.5);
    indicatorRing.scale.setScalar(1 + (damagePulse * 0.24));

    damageRipple.visible = damageActive;
    damageRipple.material.opacity = damageActive ? Math.max(0, 0.78 - (damageProgress * 0.92)) : 0;
    damageRipple.scale.setScalar(0.82 + (damageProgress * 1.45));
    damageRipple.position.x = damageDirection.x * 0.08;
    damageRipple.position.z = damageDirection.z * 0.08;

    damageBurst.visible = damageActive;
    damageBurst.material.opacity = damageActive ? Math.max(0, 0.88 - (damageProgress * 1.08)) : 0;
    damageBurst.position.set(
      damageDirection.x * 0.18,
      (PLAYER_HEIGHT * 0.58) + (damagePulse * 0.16),
      damageDirection.z * 0.18
    );
    damageBurst.scale.setScalar(0.6 + (damagePulse * 1.45));
    damageBurst.rotation.x = damageProgress * 1.8;
    damageBurst.rotation.y = damageProgress * 3.1;

    for (const trackedMaterial of damageTintMaterials) {
      if (trackedMaterial.baseColor) {
        trackedMaterial.material.color.copy(trackedMaterial.baseColor).lerp(DAMAGE_FLASH_COLOR, damageFlashAmount * 0.3);
      }
      if (trackedMaterial.baseEmissive) {
        trackedMaterial.material.emissive.copy(trackedMaterial.baseEmissive).lerp(DAMAGE_EMISSIVE_COLOR, damageFlashAmount);
        trackedMaterial.material.emissiveIntensity = trackedMaterial.baseEmissiveIntensity + (damageFlashAmount * 1.45);
      }
    }

    const rightHandMotion = getSlotMotionRoot(ATTACHMENT_SLOTS.handRight);
    if (rightHandMotion) {
      const reloadMotionPosition = reloadProfile?.weaponMotion?.position ?? EMPTY_VECTOR_OVERRIDE;
      const reloadMotionRotation = reloadProfile?.weaponMotion?.rotation ?? EMPTY_VECTOR_OVERRIDE;
      rightHandMotion.position.set(
        SLOT_MOTION_BASE.position[0] - (recoilAmount * 0.22) + ((reloadMotionPosition[0] ?? 0) * reloadDisplayedWeaponMotionAmount),
        SLOT_MOTION_BASE.position[1] + (recoilAmount * 0.02) + ((reloadMotionPosition[1] ?? 0) * reloadDisplayedWeaponMotionAmount),
        SLOT_MOTION_BASE.position[2] - (recoilAmount * 0.22) + ((reloadMotionPosition[2] ?? 0) * reloadDisplayedWeaponMotionAmount)
      );
      rightHandMotion.rotation.set(
        SLOT_MOTION_BASE.rotation[0] - (recoilAmount * 0.05) + ((reloadMotionRotation[0] ?? 0) * reloadDisplayedWeaponMotionAmount),
        SLOT_MOTION_BASE.rotation[1] + (recoilAmount * 0.2) + ((reloadMotionRotation[1] ?? 0) * reloadDisplayedWeaponMotionAmount),
        SLOT_MOTION_BASE.rotation[2] + (recoilAmount * 0.1) + ((reloadMotionRotation[2] ?? 0) * reloadDisplayedWeaponMotionAmount)
      );
    }

    syncTaskArrow();
  }

  function syncTaskArrow() {
    if (!taskArrowTarget || !aliveState) {
      taskArrow.visible = false;
      return;
    }

    const deltaX = taskArrowTarget.x - anchor.position.x;
    const deltaZ = taskArrowTarget.z - anchor.position.z;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaZ) || ((deltaX * deltaX) + (deltaZ * deltaZ)) < 1) {
      taskArrow.visible = false;
      return;
    }

    taskArrow.rotation.y = normalizeAngle(Math.atan2(deltaX, deltaZ) - anchor.rotation.y);
    taskArrow.visible = true;
  }

  async function setWeaponState(weaponId = '', options = null) {
    const visible = options?.visible !== false;
    const nextWeaponId = weaponId || '';
    const nextVisible = Boolean(visible && nextWeaponId);
    const activeRightItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight);
    if (
      !phoneTextingActive
      && desiredWeaponId === nextWeaponId
      && activeRightItemId === nextWeaponId
      && slotVisibility.get(ATTACHMENT_SLOTS.handRight) === nextVisible
    ) {
      updateHeldItemVisibility();
      return;
    }

    desiredWeaponId = nextWeaponId;
    if (phoneTextingActive) {
      if (!desiredWeaponId) {
        setReloadPreviewState(false);
        setReloadState(false);
      }
      await syncPhoneEquipment();
      return;
    }

    if (!desiredWeaponId) {
      setReloadPreviewState(false);
      setReloadState(false);
      detachHeldItem(ATTACHMENT_SLOTS.handRight);
      return;
    }

    await attachHeldItem(desiredWeaponId, { visible: nextVisible });
  }

  function setAliveState(nextAlive, options = null) {
    if (aliveState === nextAlive) {
      return;
    }

    const startedAtMs = Number.isFinite(options?.startedAtMs) && options.startedAtMs > 0
      ? options.startedAtMs
      : Date.now();
    aliveState = nextAlive;
    updateHeldItemVisibility();
    if (!nextAlive) {
      setReloadPreviewState(false);
      setReloadState(false);
      clearSkateboardMotionState();
      setLimpActive(true, { startedAtMs, trackSync: false });
      if (desiredWeaponId) {
        void setWeaponState(desiredWeaponId, { visible: false });
      }
      return;
    }

    setLimpActive(false, { trackSync: false });
    if (desiredWeaponId) {
      void setWeaponState(desiredWeaponId, { visible: true });
    }
  }

  function triggerDamageFeedback({ direction = null, hitReaction = '', strength = 1 } = {}) {
    damageFeedbackStartedAt = performance.now();
    damageFeedbackEndsAt = damageFeedbackStartedAt + DAMAGE_FEEDBACK_DURATION_MS;
    damageFeedbackStrength = THREE.MathUtils.clamp(Number(strength) || 1, 0.6, 1.8);
    triggerHitReaction(hitReaction);

    if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)) {
      damageDirection.set(direction.x, 0, direction.z);
    } else {
      damageDirection.set(Math.sin(anchor.rotation.y), 0, Math.cos(anchor.rotation.y));
    }

    if (damageDirection.lengthSq() <= 0.0001) {
      damageDirection.set(0, 0, 1);
    } else {
      damageDirection.normalize();
    }
  }

  function getAttachmentSocket(slot) {
    return sockets[slot] ?? null;
  }

  function nudgeHeldItemGripOverride(itemId, delta = {}) {
    if (!itemId) {
      return null;
    }

    const existing = getGripOverride(itemId) ?? {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };
    const nextOverride = {
      position: addNumberVector3(existing.position, delta.position, 0),
      rotation: addNumberVector3(existing.rotation, delta.rotation, 0),
      scale: multiplyNumberVector3(existing.scale, delta.scale, 1)
    };
    gripOverrides.set(itemId, nextOverride);
    applyHeldItemProfile(itemId);
    updateHeldItemVisibility();
    return getMergedGripProfile(itemId);
  }

  function getFootPlantGroundingOffset() {
    if (!activeEmoteConfig?.groundFeet || footPlantBones.length === 0) {
      return 0;
    }

    character.updateWorldMatrix(true, true);
    visual.updateWorldMatrix(true, true);

    let lowestLocalY = Infinity;
    for (const bone of footPlantBones) {
      bone.getWorldPosition(footPlantWorldPosition);
      footPlantLocalPosition.copy(footPlantWorldPosition);
      visual.worldToLocal(footPlantLocalPosition);
      lowestLocalY = Math.min(lowestLocalY, footPlantLocalPosition.y);
    }

    if (!Number.isFinite(lowestLocalY)) {
      return 0;
    }

    return Math.max(0, lowestLocalY);
  }

  function moveWithWorldVector(direction, deltaSeconds, colliders, cityBounds, speedScale = 1) {
    const movement = moveDirection.copy(direction);
    movement.y = 0;
    if (movement.lengthSq() > 1) {
      movement.normalize();
    }

    if (movement.lengthSq() <= 0.000001) {
      return false;
    }

    const safeDeltaSeconds = Math.max(0, Number(deltaSeconds) || 0);
    const substepCount = Math.max(1, Math.ceil(safeDeltaSeconds / PLAYER_MOVEMENT_MAX_SUBSTEP_SECONDS));
    const substepSeconds = safeDeltaSeconds / substepCount;
    const step = PLAYER_SPEED * Math.max(0, speedScale) * substepSeconds;
    const hasFiniteXBounds = Number.isFinite(cityBounds?.min?.x) && Number.isFinite(cityBounds?.max?.x);
    const hasFiniteZBounds = Number.isFinite(cityBounds?.min?.z) && Number.isFinite(cityBounds?.max?.z);
    const minX = hasFiniteXBounds ? cityBounds.min.x : anchor.position.x;
    const maxX = hasFiniteXBounds ? cityBounds.max.x : anchor.position.x;
    const minZ = hasFiniteZBounds ? cityBounds.min.z : anchor.position.z;
    const maxZ = hasFiniteZBounds ? cityBounds.max.z : anchor.position.z;

    for (let index = 0; index < substepCount; index += 1) {
      moveProposedPosition.copy(anchor.position);
      moveProposedPosition.x += movement.x * step;
      if (!collidesWithColliders(moveProposedPosition, colliders, PLAYER_RADIUS)) {
        anchor.position.x = THREE.MathUtils.clamp(moveProposedPosition.x, minX, maxX);
      }

      moveProposedPosition.copy(anchor.position);
      moveProposedPosition.z += movement.z * step;
      if (!collidesWithColliders(moveProposedPosition, colliders, PLAYER_RADIUS)) {
        anchor.position.z = THREE.MathUtils.clamp(moveProposedPosition.z, minZ, maxZ);
      }
    }

    const targetYaw = Math.atan2(movement.x, movement.z);
    const turnSmoothing = 1 - Math.exp(-PLAYER_TURN_RESPONSE * safeDeltaSeconds);
    anchor.rotation.y = dampAngle(anchor.rotation.y, targetYaw, turnSmoothing);
    return true;
  }

  return {
    characterId: characterDefinition.id,
    characterDefinition,
    object: anchor,
    radius: PLAYER_RADIUS,
    position: anchor.position,
    sockets,
    getSpeechAnchorWorldPosition(target = new THREE.Vector3()) {
      anchor.getWorldPosition(target);
      target.y += PLAYER_HEIGHT + 1.4;
      return target;
    },
    getAttachmentWorldPoint(pointName = 'muzzle', target = new THREE.Vector3()) {
      for (const slot of ATTACHMENT_SLOT_LIST) {
        const activeItemId = activeItemsBySlot.get(slot);
        if (!activeItemId || slotVisibility.get(slot) === false) {
          continue;
        }

        const entry = heldItemEntries.get(activeItemId);
        const pointNode = entry?.points?.get(pointName);
        if (pointNode) {
          pointNode.getWorldPosition(target);
          return target;
        }
      }

      const handSocket = getAttachmentSocket(ATTACHMENT_SLOTS.handRight);
      if (handSocket) {
        handSocket.getWorldPosition(target);
        target.x += 0.2;
        target.y += 0.05;
        target.z += 0.2;
        return target;
      }

      anchor.getWorldPosition(target);
      target.y += PLAYER_HEIGHT * 0.7;
      return target;
    },
    getAttachmentPointNode(pointName = 'muzzle') {
      for (const slot of ATTACHMENT_SLOT_LIST) {
        const activeItemId = activeItemsBySlot.get(slot);
        if (!activeItemId || slotVisibility.get(slot) === false) {
          continue;
        }

        const entry = heldItemEntries.get(activeItemId);
        const pointNode = entry?.points?.get(pointName);
        if (pointNode) {
          return pointNode;
        }
      }

      return getAttachmentSocket(ATTACHMENT_SLOTS.handRight) ?? anchor;
    },
    getHeldItemMuzzleWorldPosition(target = new THREE.Vector3()) {
      return this.getAttachmentWorldPoint('muzzle', target);
    },
    getWeaponMuzzleWorldPosition(target = new THREE.Vector3()) {
      return this.getAttachmentWorldPoint('muzzle', target);
    },
    getAnimationSyncState(target = {}) {
      const output = target && typeof target === 'object' ? target : {};
      if (ragdoll.isActive()) {
        output.emoteId = LIMP_EMOTE_ID;
        output.emoteActive = true;
        output.emoteStartedAt = limpStartedAt;
        output.emoteSeq = emoteSequence;
        output.aimRotationY = aimRotationY;
        output.skating = false;
        return output;
      }

      output.emoteId = activeEmoteId ?? '';
      output.emoteActive = Boolean(activeEmoteId);
      output.emoteStartedAt = activeEmoteId ? activeEmoteStartedAt : 0;
      output.emoteSeq = emoteSequence;
      output.aimRotationY = aimRotationY;
      output.skating = skateboardSkating;
      return output;
    },
    playEmote(emoteId, { startedAtMs = Date.now(), trackSync = true, punchLungeBonus = 0 } = {}) {
      if (emoteId === LIMP_EMOTE_ID) {
        return setLimpActive(true, { startedAtMs, trackSync });
      }

      if (isLimpTransitioning()) {
        setLimpActive(false, { trackSync: false });
      }

      const emoteConfig = getResolvedEmoteConfig(emoteId);
      const clipName = emoteConfig?.clipName ?? characterDefinition.emotes?.[emoteId];
      if (!clipName) {
        return false;
      }

      const playbackRequestId = ++emotePlaybackRequestId;
      void ensureEmoteAction(emoteId)
        .then((action) => {
          if (!action || playbackRequestId !== emotePlaybackRequestId) {
            return;
          }

          if (activeEmoteId === emoteId && emoteConfig.loop) {
            return;
          }

          if (activeEmoteId && activeEmoteId !== emoteId) {
            getLoadedEmoteAction(activeEmoteId)?.fadeOut(activeEmoteConfig?.fadeOut ?? EMOTE_FADE_OUT);
            getLoadedEmoteLowerBodyAction(activeEmoteId)?.fadeOut(activeEmoteConfig?.fadeOut ?? EMOTE_FADE_OUT);
          }

          activeEmoteId = emoteId;
          activeEmoteConfig = emoteConfig;
          activeEmoteStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
          activePunchLungeBonus = PUNCH_LUNGE_EMOTE_IDS.has(emoteId)
            ? THREE.MathUtils.clamp(Number(punchLungeBonus) || 0, 0, PUNCH_ASSISTED_LUNGE_BONUS)
            : 0;
          if (trackSync) {
            emoteSequence += 1;
          }
          action.reset();
          action.enabled = true;
          action.setLoop(emoteConfig.loop ? THREE.LoopRepeat : THREE.LoopOnce, emoteConfig.loop ? Infinity : 1);
          action.clampWhenFinished = !emoteConfig.loop;
          action.setEffectiveTimeScale(emoteConfig.playbackRate ?? 1);
          action.setEffectiveWeight(1);
          applyEmoteStartOffset(action, emoteConfig, activeEmoteStartedAt);
          action.fadeIn(emoteConfig.fadeIn ?? EMOTE_FADE_IN);
          action.play();
          const lowerBodyAction = getLoadedEmoteLowerBodyAction(emoteId);
          if (lowerBodyAction) {
            lowerBodyAction.reset();
            lowerBodyAction.enabled = true;
            lowerBodyAction.setLoop(emoteConfig.loop ? THREE.LoopRepeat : THREE.LoopOnce, emoteConfig.loop ? Infinity : 1);
            lowerBodyAction.clampWhenFinished = !emoteConfig.loop;
            lowerBodyAction.setEffectiveTimeScale(emoteConfig.playbackRate ?? 1);
            lowerBodyAction.setEffectiveWeight(0);
            applyEmoteStartOffset(lowerBodyAction, emoteConfig, activeEmoteStartedAt);
            lowerBodyAction.play();
          }
        })
        .catch((error) => {
          console.error('[Player] Failed to load emote clip.', {
            characterId: characterDefinition.id,
            emoteId,
            error
          });
        });

      return true;
    },
    toggleLimp({ startedAtMs = Date.now(), trackSync = true } = {}) {
      return setLimpActive(!ragdoll.isActive(), { startedAtMs, trackSync });
    },
    clearLimp() {
      return setLimpActive(false, { trackSync: false });
    },
    isLimp() {
      return ragdoll.isActive();
    },
    setAimRotation(rotationY) {
      if (Number.isFinite(rotationY)) {
        aimRotationY = rotationY;
      }
    },
    getAimRotation() {
      return aimRotationY;
    },
    getEmoteDebugConfig(emoteId = '') {
      return emoteId ? getResolvedEmoteConfig(emoteId) : null;
    },
    setEmoteDebugConfigField(emoteId = '', fieldKey = '', value = 0) {
      if (!emoteId || !fieldKey) {
        return null;
      }

      const baseConfig = EMOTES_BY_ID[emoteId];
      if (!baseConfig) {
        return null;
      }

      const numericValue = Number(value);
      const nextOverride = {
        ...(emoteConfigOverrides.get(emoteId) ?? {})
      };
      if (!Number.isFinite(numericValue)) {
        delete nextOverride[fieldKey];
      } else {
        nextOverride[fieldKey] = numericValue;
      }

      if (!hasOwnEnumerableProperties(nextOverride)) {
        emoteConfigOverrides.delete(emoteId);
      } else {
        emoteConfigOverrides.set(emoteId, nextOverride);
      }

      if (activeEmoteId === emoteId) {
        activeEmoteConfig = getResolvedEmoteConfig(emoteId);
      }

      return getResolvedEmoteConfig(emoteId);
    },
    clearEmoteDebugConfig(emoteId = '') {
      if (!emoteId) {
        return null;
      }

      emoteConfigOverrides.delete(emoteId);
      if (activeEmoteId === emoteId) {
        activeEmoteConfig = getResolvedEmoteConfig(emoteId);
      }
      return getResolvedEmoteConfig(emoteId);
    },
    setAimingState(aiming) {
      aimingState = Boolean(aiming);
    },
    setDrunknessLevel(level = 0) {
      drunknessLevel = normalizeDrunknessLevel(level);
    },
    stopEmote() {
      stopActiveEmote();
    },
    setFacing(rotationY) {
      if (Number.isFinite(rotationY)) {
        anchor.rotation.y = rotationY;
      }
    },
    setReloadState(reloading, options = null) {
      return setReloadState(Boolean(reloading), options);
    },
    triggerShotFeedback() {
      recoilAmount = Math.max(recoilAmount, aimingState ? 1.2 : 1.05);
    },
    triggerDamageFeedback(options = {}) {
      triggerDamageFeedback(options);
    },
    attachHeldItem(itemId, options = {}) {
      return attachHeldItem(itemId, options);
    },
    detachHeldItem(slot = ATTACHMENT_SLOTS.handRight) {
      detachHeldItem(slot);
    },
    setDeliveryPackageActive(active) {
      return setDeliveryPackageActive(active);
    },
    setPhoneTextingActive(active) {
      return setPhoneTextingActive(active);
    },
    setSkateboardState(options = {}) {
      return setSkateboardState(options);
    },
    getHeldItemGripProfile(itemId = desiredWeaponId) {
      return itemId ? getMergedGripProfile(itemId) : null;
    },
    getHeldItemAimPoseProfile(itemId = desiredWeaponId) {
      return itemId ? getMergedAimPose(itemId) : null;
    },
    getHeldItemReloadProfile(itemId = desiredWeaponId) {
      return itemId ? getMergedReloadProfile(itemId) : null;
    },
    setHeldItemGripOverride(itemId, override = null) {
      if (!itemId) {
        return null;
      }

      if (!override) {
        gripOverrides.delete(itemId);
        applyHeldItemProfile(itemId);
        updateHeldItemVisibility();
        return this.getHeldItemGripProfile(itemId);
      }

      gripOverrides.set(itemId, {
        position: cloneNumberVector3(override.position, 0),
        rotation: cloneNumberVector3(override.rotation, 0),
        scale: cloneNumberVector3(override.scale, 1)
      });
      applyHeldItemProfile(itemId);
      updateHeldItemVisibility();
      return this.getHeldItemGripProfile(itemId);
    },
    nudgeHeldItemGripOverride(itemId, delta = {}) {
      return nudgeHeldItemGripOverride(itemId, delta);
    },
    clearHeldItemGripOverride(itemId) {
      if (!itemId) {
        return;
      }

      gripOverrides.delete(itemId);
      applyHeldItemProfile(itemId);
      updateHeldItemVisibility();
    },
    setHeldItemAimPoseFieldOverride(itemId, fieldKey, value = 0) {
      return setHeldItemAimPoseFieldOverride(itemId, fieldKey, value);
    },
    clearHeldItemAimPoseOverride(itemId) {
      if (!itemId) {
        return;
      }

      aimPoseOverrides.delete(itemId);
    },
    setHeldItemReloadProfileOverride(itemId, override = null) {
      if (!itemId) {
        return null;
      }

      if (!override) {
        reloadProfileOverrides.delete(itemId);
        resetHeldItemReloadMotion(itemId);
        return this.getHeldItemReloadProfile(itemId);
      }

      reloadProfileOverrides.set(itemId, cloneReloadProfile(override));
      return this.getHeldItemReloadProfile(itemId);
    },
    clearHeldItemReloadProfileOverride(itemId) {
      if (!itemId) {
        return;
      }

      reloadProfileOverrides.delete(itemId);
      resetHeldItemReloadMotion(itemId);
    },
    setAimPoseDebugVisible(visible) {
      skeletonHelper.visible = Boolean(visible);
    },
    getAimPoseDebugHelper() {
      return skeletonHelper;
    },
    setWeaponState(weaponId, options = null) {
      return setWeaponState(weaponId, options);
    },
    preloadWeapon(weaponId, { visible = true } = {}) {
      if (!weaponId) {
        return Promise.resolve(null);
      }

      return attachHeldItem(weaponId, { visible });
    },
    setAliveState(alive, options = null) {
      setAliveState(Boolean(alive), options);
    },
    setTaskArrowTarget(targetPosition) {
      const x = Number(targetPosition?.x);
      const z = Number(targetPosition?.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        taskArrowTarget = null;
        syncTaskArrow();
        return false;
      }

      if (!taskArrowTarget) {
        taskArrowTarget = new THREE.Vector3();
      }
      taskArrowTarget.set(x, 0, z);
      syncTaskArrow();
      return true;
    },
    clearTaskArrowTarget() {
      taskArrowTarget = null;
      taskArrow.visible = false;
    },
    previewReload(itemId = desiredWeaponId, durationMs = WEAPON_RELOAD_MS) {
      if (!itemId) {
        return false;
      }

      const now = Date.now();
      return setReloadPreviewState(true, {
        weaponId: itemId,
        startedAtMs: now,
        endsAtMs: now + Math.max(100, Number(durationMs) || WEAPON_RELOAD_MS)
      });
    },
    stopReloadPreview() {
      return setReloadPreviewState(false);
    },
    update(deltaSeconds, input, camera, colliders, cityBounds, groundHeight = 0, options = {}) {
      if (!aliveState) {
        clearSkateboardMotionState();
        updateAnimationState(deltaSeconds, false, groundHeight);
        return;
      }

      const rawInput = input.getMovementVector();
      const wantsToMove = rawInput.x !== 0 || rawInput.z !== 0;
      const stationaryRun = Boolean(options.stationaryRun);
      const selectedVehicleItemId = normalizePlayerVehicleItemId(options.vehicleItemId);
      const transportOwned = Boolean(options.skateboardOwned || selectedVehicleItemId);
      const wantsTransportVisible = Boolean(transportOwned && options.skating && !ragdoll.isActive());
      const movementSpeedScale = wantsTransportVisible && wantsToMove && Number.isFinite(options.speedScale)
        ? options.speedScale
        : 1;

      if (wantsToMove && isLimpTransitioning()) {
        setLimpActive(false, { trackSync: false });
      }

      if (wantsToMove && (activeEmoteConfig?.cancelOnMove ?? true)) {
        stopActiveEmote();
      }

      const moving = (wantsToMove || stationaryRun) && !ragdoll.isActive();
      const movement = moving
        ? (
            wantsToMove
              ? projectMoveOnCamera(camera, rawInput, moveDirection, moveCameraForward, moveCameraRight, options.movementCameraForward)
              : moveDirection.set(Math.sin(anchor.rotation.y), 0, Math.cos(anchor.rotation.y))
          )
        : moveDirection.set(0, 0, 0);
      skateboardStateScratch.owned = transportOwned;
      skateboardStateScratch.skating = wantsTransportVisible;
      skateboardStateScratch.vehicleItemId = selectedVehicleItemId;
      setSkateboardState(skateboardStateScratch);

      if (moving && wantsToMove) {
        moveWithWorldVector(movement, deltaSeconds, colliders, cityBounds, movementSpeedScale);
      }

      animationOptionsScratch.locomotionMode = stationaryRun ? 'run' : options.locomotionMode;
      animationOptionsScratch.locomotionPlaybackRate = options.locomotionPlaybackRate;
      updateAnimationState(deltaSeconds, moving, groundHeight, animationOptionsScratch);
    },
    moveToward(targetPosition, deltaSeconds, colliders, cityBounds, groundHeight = 0, options = {}) {
      if (!aliveState) {
        clearSkateboardMotionState();
        updateAnimationState(deltaSeconds, false, groundHeight);
        moveTowardResultScratch.arrived = false;
        moveTowardResultScratch.moving = false;
        moveTowardResultScratch.distance = Infinity;
        return moveTowardResultScratch;
      }

      if (isLimpTransitioning()) {
        setLimpActive(false, { trackSync: false });
      }

      if (activeEmoteConfig?.cancelOnMove ?? true) {
        stopActiveEmote();
      }

      const target = targetPosition?.isVector3
        ? moveTarget.copy(targetPosition)
        : moveTarget.set(
          targetPosition?.x ?? anchor.position.x,
          targetPosition?.y ?? anchor.position.y,
          targetPosition?.z ?? anchor.position.z
        );
      const stopDistance = Math.max(0.05, Number(options.stopDistance) || 0.18);
      const speedScale = Number.isFinite(options.speedScale) ? options.speedScale : 1;
      const toTarget = moveToTarget.copy(target).sub(anchor.position);
      toTarget.y = 0;
      const distance = toTarget.length();
      clearSkateboardMotionState();

      if (distance <= stopDistance) {
        updateAnimationState(deltaSeconds, false, groundHeight);
        moveTowardResultScratch.arrived = true;
        moveTowardResultScratch.moving = false;
        moveTowardResultScratch.distance = distance;
        return moveTowardResultScratch;
      }

      const moving = moveWithWorldVector(toTarget.normalize(), deltaSeconds, colliders, cityBounds, speedScale);
      updateAnimationState(deltaSeconds, moving, groundHeight);

      const remaining = moveToTarget.copy(target).sub(anchor.position).setY(0).length();
      moveTowardResultScratch.arrived = remaining <= stopDistance;
      moveTowardResultScratch.moving = moving;
      moveTowardResultScratch.distance = remaining;
      return moveTowardResultScratch;
    },
    applyRemoteState(state, deltaSeconds, groundHeight = 0) {
      const remoteAlive = state?.alive !== false;
      this.setDrunknessLevel(remoteAlive ? state?.drunknessLevel : 0);
      aliveStateOptionsScratch.startedAtMs = Number.isFinite(state?.lastDamagedAt) && state.lastDamagedAt > 0
        ? state.lastDamagedAt
        : 0;
      setAliveState(remoteAlive, aliveStateOptionsScratch);
      const remoteVehicleItemId = normalizePlayerVehicleItemId(state?.vehicleItemId);
      skateboardStateScratch.owned = remoteAlive && (state?.skateboardOwned === true || Boolean(remoteVehicleItemId));
      skateboardStateScratch.skating = remoteAlive && state?.skating === true;
      skateboardStateScratch.vehicleItemId = remoteVehicleItemId;
      setSkateboardState(skateboardStateScratch);
      const remoteEmoteId = typeof state?.emoteId === 'string' ? state.emoteId : '';
      const remoteEmoteActive = Boolean(state?.emoteActive && remoteEmoteId);
      const remoteTextingActive = remoteAlive && remoteEmoteActive && remoteEmoteId === TEXTING_EMOTE_ID;
      void setDeliveryPackageActive(remoteAlive && isDeliveryQuestActive(state));
      void setPhoneTextingActive(remoteTextingActive);
      const remoteWeaponId = remoteAlive && typeof state?.equippedWeaponId === 'string' ? state.equippedWeaponId : '';
      weaponStateOptionsScratch.visible = remoteAlive && Boolean(state?.equippedWeaponId) && !remoteTextingActive;
      void setWeaponState(remoteWeaponId, weaponStateOptionsScratch);

      if (!remoteAlive) {
        aimingState = false;
        clearSkateboardMotionState();
        setReloadState(false);
        updateAnimationState(deltaSeconds, false, groundHeight);
        return;
      }

      const remoteEmoteSeq = Number.isFinite(state?.emoteSeq) ? Math.max(0, Math.floor(state.emoteSeq)) : 0;
      const remoteIsLimp = remoteEmoteActive && remoteEmoteId === LIMP_EMOTE_ID;

      if (
        remoteEmoteActive !== lastRemoteEmoteActive
        || remoteEmoteId !== lastRemoteEmoteId
        || remoteEmoteSeq !== lastRemoteEmoteSeq
        || (remoteEmoteActive && !remoteIsLimp && activeEmoteId !== remoteEmoteId)
        || (remoteIsLimp !== ragdoll.isActive())
        || (!remoteEmoteActive && activeEmoteId)
      ) {
        lastRemoteEmoteActive = remoteEmoteActive;
        lastRemoteEmoteId = remoteEmoteId;
        lastRemoteEmoteSeq = remoteEmoteSeq;
        if (remoteIsLimp) {
          setLimpActive(true, {
            startedAtMs: Number.isFinite(state?.emoteStartedAt) ? state.emoteStartedAt : Date.now(),
            trackSync: false
          });
        } else {
          setLimpActive(false, { trackSync: false });
        }

        if (remoteEmoteActive && !remoteIsLimp) {
          this.playEmote(remoteEmoteId, {
            startedAtMs: Number.isFinite(state?.emoteStartedAt) ? state.emoteStartedAt : Date.now(),
            trackSync: false
          });
        } else {
          stopActiveEmote();
        }
      }

      const showingRemoteLimp = remoteIsLimp && ragdoll.isActive();
      const showingRemoteEmote = remoteEmoteActive && activeEmoteId === remoteEmoteId;
      aimingState = remoteAlive && Boolean(state?.aiming);
      reloadStateOptionsScratch.weaponId = typeof state?.equippedWeaponId === 'string' ? state.equippedWeaponId : '';
      reloadStateOptionsScratch.startedAtMs = 0;
      reloadStateOptionsScratch.endsAtMs = Number(state?.reloadEndsAt ?? 0);
      reloadStateOptionsScratch.resetMotion = true;
      setReloadState(Boolean(state?.isReloading), reloadStateOptionsScratch);

      if (Number.isFinite(state?.aimRotationY)) {
        aimRotationY = state.aimRotationY;
      }

      const targetX = Number.isFinite(state?.x) ? state.x : anchor.position.x;
      const targetZ = Number.isFinite(state?.z) ? state.z : anchor.position.z;
      const targetRotationY = Number.isFinite(state?.rotationY) ? state.rotationY : anchor.rotation.y;
      const deltaX = targetX - anchor.position.x;
      const deltaZ = targetZ - anchor.position.z;
      const distanceSq = (deltaX * deltaX) + (deltaZ * deltaZ);

      if (distanceSq > 8 * 8) {
        anchor.position.x = targetX;
        anchor.position.z = targetZ;
      } else {
        const positionLerp = 1 - Math.exp(-deltaSeconds * 12);
        anchor.position.x = THREE.MathUtils.lerp(anchor.position.x, targetX, positionLerp);
        anchor.position.z = THREE.MathUtils.lerp(anchor.position.z, targetZ, positionLerp);
      }

      const rotationLerp = 1 - Math.exp(-deltaSeconds * 14);
      anchor.rotation.y = dampAngle(anchor.rotation.y, targetRotationY, rotationLerp);
      updateAnimationState(deltaSeconds, !showingRemoteLimp && !showingRemoteEmote && distanceSq > 0.05 * 0.05, groundHeight);
    }
  };
}
