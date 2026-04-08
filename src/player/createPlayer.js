import * as THREE from 'three';
import { createInPlaceClip, ensureMixamoSockets, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import { createClassicBotCharacter } from './classicBotCharacter.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById
} from './playableCharacterCatalog.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_AIM_POSE_FIELDS,
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
import { EMOTES_BY_ID } from './emotes.js';
import { createRagdollController } from './ragdollController.js';
import { RAGDOLL_RECOVER_DURATION } from './ragdollRig.js';
import { WEAPON_RELOAD_MS } from '../shared/combatConstants.js';

const PLAYER_HEIGHT = 4.5;
const PLAYER_SPEED = 15;
const PLAYER_RADIUS = 1.4;
const EMOTE_FADE_IN = 0.12;
const EMOTE_FADE_OUT = 0.18;
const LIMP_EMOTE_ID = 'limp';
const DAMAGE_FEEDBACK_DURATION_MS = 380;
const DAMAGE_FLASH_COLOR = new THREE.Color(0xff5b73);
const DAMAGE_EMISSIVE_COLOR = new THREE.Color(0xff3154);
const DAMAGE_RING_COLOR = new THREE.Color(0xff7b88);
const DAMAGE_BURST_COLOR = new THREE.Color(0xffd6cd);

const UPPER_BODY_ROOT_BONE = 'spine';

const SLOT_MOTION_BASE = Object.freeze({
  position: Object.freeze([-0.12, 0.03, -0.08]),
  rotation: Object.freeze([-0.06, 0, 0.05])
});

const EMPTY_VECTOR_OVERRIDE = Object.freeze([0, 0, 0]);
const AIM_IDLE_LOCK_BONES = Object.freeze(['leftArm', 'leftForeArm']);
const AIM_IDLE_LOCK_FIELD_KEYS = new Set(
  HELD_ITEM_AIM_POSE_FIELDS
    .filter((field) => AIM_IDLE_LOCK_BONES.includes(field.bone))
    .map((field) => field.key)
);
const AIM_STABILIZE_BONES = Object.freeze(
  Array.from(new Set([
    UPPER_BODY_ROOT_BONE,
    ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.bone)
  ]))
);
const RELOAD_POSE_BONES = Object.freeze(['spineUpper', 'leftShoulder', 'leftArm', 'leftForeArm', 'leftHand']);
const RELOAD_IK_DRIVEN_BONES = new Set(['leftArm', 'leftForeArm', 'leftHand']);

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

function projectMoveOnCamera(camera, inputVector) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  forward.multiplyScalar(-1);
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const movement = new THREE.Vector3();
  movement.addScaledVector(right, inputVector.x);
  movement.addScaledVector(forward, inputVector.z);

  if (movement.lengthSq() > 1) {
    movement.normalize();
  }

  return movement;
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
  return colliders.some((collider) => {
    if (!collider) {
      return false;
    }

    if (collider.type === 'cylinder') {
      return collidesWithCylinder(candidate, collider, radius);
    }

    return collidesWithBox(candidate, collider, radius);
  });
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
      node.material = node.material.map((entry) => {
        const { material, tracked } = cloneTrackedMaterial(entry);
        if (tracked) {
          trackedMaterials.push(tracked);
        }
        return material;
      });
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

export async function createPlayer(library, {
  characterId = DEFAULT_PLAYABLE_CHARACTER_ID,
  indicatorColor = 0xf2c871,
  indicatorOpacity = 0.85
} = {}) {
  const characterDefinition = getPlayableCharacterById(characterId);
  const clipNamesToPreload = new Set([
    characterDefinition.idleClip,
    characterDefinition.walkClip
  ]);

  await preloadMixamoClips([...clipNamesToPreload]);

  const characterRig = await library.instantiate(characterDefinition.characterRig);
  const character = characterDefinition.characterVariant === 'classicBot'
    ? createClassicBotCharacter(characterRig)
    : characterRig;
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Mixamo player character is invalid. Missing bones: ${humanoid.missingBones.join(', ')}`);
  }

  const sockets = ensureMixamoSockets(character);
  const idleClip = createInPlaceClip(getMixamoClip(characterDefinition.idleClip), MIXAMO_BONES.hips);
  const walkClip = createInPlaceClip(getMixamoClip(characterDefinition.walkClip), MIXAMO_BONES.hips);
  const mixer = new THREE.AnimationMixer(character);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  const emoteActions = new Map();
  const emoteLoadPromises = new Map();
  const skeletonHelper = new THREE.SkeletonHelper(character);
  idleAction.play();
  idleAction.enabled = true;
  idleAction.setEffectiveWeight(1);
  walkAction.play();
  walkAction.enabled = true;
  walkAction.setEffectiveWeight(0);

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
  anchor.add(visual);

  let idleWeight = 1;
  let walkWeight = 0;
  let activeEmoteId = null;
  let activeEmoteConfig = null;
  let activeEmoteStartedAt = 0;
  let emoteSequence = 0;
  let emotePlaybackRequestId = 0;
  let lastRemoteEmoteSignature = '';
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
  const aimPoseBoneBases = Object.fromEntries(
    Object.entries(aimPoseBones).map(([key, bone]) => [key, bone ? { quaternion: bone.quaternion.clone() } : null])
  );
  mixer.setTime(0);
  const aimPoseIdleBases = Object.fromEntries(
    AIM_IDLE_LOCK_BONES.map((boneKey) => {
      const bone = aimPoseBones[boneKey];
      return [boneKey, bone ? { quaternion: bone.quaternion.clone() } : null];
    })
  );
  const aimPoseEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  const aimPoseQuaternion = new THREE.Quaternion();
  const reloadIkTargetPosition = new THREE.Vector3();
  const reloadIkBonePosition = new THREE.Vector3();
  const reloadIkEndPosition = new THREE.Vector3();
  const reloadIkToEnd = new THREE.Vector3();
  const reloadIkToTarget = new THREE.Vector3();
  const reloadIkAxisWorld = new THREE.Vector3();
  const reloadIkAxisLocal = new THREE.Vector3();
  const reloadIkParentWorldQuaternion = new THREE.Quaternion();
  const reloadIkDeltaQuaternion = new THREE.Quaternion();
  const reloadIkTargetQuaternion = new THREE.Quaternion();
  const reloadIkParentInverseQuaternion = new THREE.Quaternion();
  const reloadIkLocalTargetQuaternion = new THREE.Quaternion();
  let desiredWeaponId = '';
  let aliveState = true;
  let recoilAmount = 0;
  let aimingState = false;
  let aimPoseWeight = 0;
  let upperBodyLookWeight = 0;
  let aimRotationY = 0;
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
  const damageDirection = new THREE.Vector3(0, 0, 1);
  const indicatorBaseColor = new THREE.Color(indicatorColor);

  skeletonHelper.visible = false;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = 0.9;

  for (const slot of Object.values(ATTACHMENT_SLOTS)) {
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

  function getLoadedEmoteAction(emoteId) {
    if (emoteId === LIMP_EMOTE_ID) {
      return null;
    }

    return emoteActions.get(emoteId) ?? null;
  }

  function ensureEmoteAction(emoteId) {
    const loadedAction = getLoadedEmoteAction(emoteId);
    if (loadedAction) {
      return Promise.resolve(loadedAction);
    }

    const emoteConfig = EMOTES_BY_ID[emoteId];
    const clipName = emoteConfig?.clipName ?? characterDefinition.emotes?.[emoteId];
    if (!clipName) {
      return Promise.resolve(null);
    }

    if (!emoteLoadPromises.has(emoteId)) {
      emoteLoadPromises.set(
        emoteId,
        preloadMixamoClips([clipName])
          .then(() => {
            const sourceClip = getMixamoClip(clipName);
            const clip = createInPlaceClip(sourceClip, MIXAMO_BONES.hips);
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
    activeEmoteId = null;
    activeEmoteConfig = null;
    activeEmoteStartedAt = 0;
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
  });

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
      position: [...(override.position ?? EMPTY_VECTOR_OVERRIDE)],
      rotation: [...(override.rotation ?? EMPTY_VECTOR_OVERRIDE)],
      scale: [...(override.scale ?? [1, 1, 1])]
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
    for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
      const value = Number(override[field.key]);
      if (Number.isFinite(value) && Math.abs(value) > 0.000001) {
        next[field.key] = value;
      }
    }

    return Object.keys(next).length > 0 ? next : null;
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
          position: [0, 1, 2].map((index) => Number(profile.handTarget.position?.[index] ?? 0)),
          rotation: [0, 1, 2].map((index) => Number(profile.handTarget.rotation?.[index] ?? 0)),
          scale: [0, 1, 2].map((index) => Number(profile.handTarget.scale?.[index] ?? 1))
        }
        : null,
      slide: profile.slide
        ? {
          nodeName: profile.slide.nodeName ?? '',
          start: Number(profile.slide.start ?? 0),
          peak: Number(profile.slide.peak ?? 0),
          end: Number(profile.slide.end ?? 0),
          position: [0, 1, 2].map((index) => Number(profile.slide.position?.[index] ?? 0))
        }
        : null,
      weaponMotion: profile.weaponMotion
        ? {
          position: [0, 1, 2].map((index) => Number(profile.weaponMotion.position?.[index] ?? 0)),
          rotation: [0, 1, 2].map((index) => Number(profile.weaponMotion.rotation?.[index] ?? 0))
        }
        : null,
      pose: Object.fromEntries(
        Object.entries(profile.pose ?? {}).map(([boneKey, values]) => [
          boneKey,
          [0, 1, 2].map((index) => Number(values?.[index] ?? 0))
        ])
      )
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
        position: [0, 1, 2].map((index) => Number(override?.handTarget?.position?.[index] ?? base?.handTarget?.position?.[index] ?? 0)),
        rotation: [0, 1, 2].map((index) => Number(override?.handTarget?.rotation?.[index] ?? base?.handTarget?.rotation?.[index] ?? 0)),
        scale: [0, 1, 2].map((index) => Number(override?.handTarget?.scale?.[index] ?? base?.handTarget?.scale?.[index] ?? 1))
      },
      slide: {
        nodeName: override?.slide?.nodeName ?? base?.slide?.nodeName ?? '',
        start: Number(override?.slide?.start ?? base?.slide?.start ?? 0),
        peak: Number(override?.slide?.peak ?? base?.slide?.peak ?? 0),
        end: Number(override?.slide?.end ?? base?.slide?.end ?? 0),
        position: [0, 1, 2].map((index) => Number(override?.slide?.position?.[index] ?? base?.slide?.position?.[index] ?? 0))
      },
      weaponMotion: {
        position: [0, 1, 2].map((index) => Number(override?.weaponMotion?.position?.[index] ?? base?.weaponMotion?.position?.[index] ?? 0)),
        rotation: [0, 1, 2].map((index) => Number(override?.weaponMotion?.rotation?.[index] ?? base?.weaponMotion?.rotation?.[index] ?? 0))
      },
      pose: {}
    };

    const poseKeys = new Set([
      ...Object.keys(base?.pose ?? {}),
      ...Object.keys(override?.pose ?? {})
    ]);
    for (const boneKey of poseKeys) {
      next.pose[boneKey] = [0, 1, 2].map((index) => Number(override?.pose?.[boneKey]?.[index] ?? base?.pose?.[boneKey]?.[index] ?? 0));
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
    for (const [itemId, entry] of heldItemEntries.entries()) {
      const activeItemId = activeItemsBySlot.get(entry.slot);
      const slotShown = slotVisibility.get(entry.slot) !== false;
      entry.container.visible = aliveState && itemId === activeItemId && slotShown;
    }
  }

  function setHeldItemAimPoseFieldOverride(itemId, fieldKey, value = 0) {
    if (!itemId || !HELD_ITEM_AIM_POSE_FIELDS.some((field) => field.key === fieldKey)) {
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

    if (Object.keys(nextOverride).length === 0) {
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

  function setReloadState(reloading, {
    weaponId = '',
    startedAtMs = 0,
    endsAtMs = 0,
    resetMotion = true
  } = {}) {
    const previousWeaponId = reloadState.weaponId;

    if (!reloading) {
      reloadState = {
        active: false,
        weaponId: '',
        startedAtMs: 0,
        endsAtMs: 0
      };
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

    reloadState = {
      active: true,
      weaponId: nextWeaponId,
      startedAtMs: resolvedStartedAtMs,
      endsAtMs: resolvedEndsAtMs
    };
    if (previousWeaponId && previousWeaponId !== nextWeaponId) {
      resetHeldItemReloadMotion(previousWeaponId);
    }
    return true;
  }

  function setReloadPreviewState(previewing, {
    weaponId = '',
    startedAtMs = 0,
    endsAtMs = 0,
    resetMotion = true
  } = {}) {
    const previousWeaponId = reloadPreviewState.weaponId;

    if (!previewing) {
      reloadPreviewState = {
        active: false,
        weaponId: '',
        startedAtMs: 0,
        endsAtMs: 0
      };
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

    reloadPreviewState = {
      active: true,
      weaponId: nextWeaponId,
      startedAtMs: resolvedStartedAtMs,
      endsAtMs: resolvedEndsAtMs
    };
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
      && !Object.keys(pose ?? {}).some((fieldKey) => AIM_IDLE_LOCK_FIELD_KEYS.has(fieldKey));

    if ((!hasLookPose && !hasAimPose && !hasReloadPose) || !aliveState || ragdoll.isActive()) {
      return;
    }

    const rotationsByBone = new Map();
    const blendWeightsByBone = new Map();
    if (hasLookPose) {
      const aimDelta = normalizeAngle(aimRotationY - anchor.rotation.y);
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
      for (const boneKey of AIM_STABILIZE_BONES) {
        const bone = aimPoseBones[boneKey];
        const base = aimPoseBoneBases[boneKey];
        if (!bone || !base) {
          continue;
        }

        bone.quaternion.copy(base.quaternion);
      }
    }

    for (const [boneKey, rotation] of rotationsByBone.entries()) {
      const bone = aimPoseBones[boneKey];
      const base = aimPoseBoneBases[boneKey];
      const blendWeight = blendWeightsByBone.get(boneKey) ?? 0;
      if (!bone || !base || blendWeight <= 0.0001) {
        continue;
      }

      aimPoseEuler.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
      aimPoseQuaternion.setFromEuler(aimPoseEuler);
      const targetQuaternion = base.quaternion.clone().multiply(aimPoseQuaternion);
      bone.quaternion.slerp(targetQuaternion, blendWeight);
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
      if (!definition || !assetUrl || !motionRoot) {
        return null;
      }

      heldItemLoads.set(itemId, library.instantiate(assetUrl)
        .then((object) => {
          prepareHeldItemModel(object, itemId, 'equipped');
          const container = new THREE.Group();
          container.name = `HeldItem_${itemId}`;
          container.visible = false;
          container.add(object);

          const points = new Map();
          for (const pointName of Object.keys(definition.points ?? {})) {
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
    if (slot === ATTACHMENT_SLOTS.handRight) {
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

  function updateAnimationState(deltaSeconds, moving, groundHeight = 0) {
    const locomotionEnabled = aliveState && !activeEmoteId && !isLimpTransitioning();
    const smoothing = locomotionEnabled ? 12 : 22;
    idleWeight = THREE.MathUtils.damp(idleWeight, locomotionEnabled && !moving ? 1 : 0, smoothing, deltaSeconds);
    walkWeight = THREE.MathUtils.damp(walkWeight, locomotionEnabled && moving ? 1 : 0, smoothing, deltaSeconds);
    idleAction.setEffectiveWeight(idleWeight);
    walkAction.setEffectiveWeight(walkWeight);
    idleAction.setEffectiveTimeScale(locomotionEnabled ? 1 : 0);
    walkAction.setEffectiveTimeScale(locomotionEnabled && moving ? 1 : 0.35);
    mixer.update(deltaSeconds);
    anchor.position.y = groundHeight;
    ragdoll.update(deltaSeconds);
    ragdoll.applyToSkeleton();
    const activeAimItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || desiredWeaponId;
    const activeAimPose = activeAimItemId ? getMergedAimPose(activeAimItemId) : null;
    const reloadProfile = updateReloadOverlayState(deltaSeconds, activeAimItemId);
    const reloadForcesAimPose = reloadDisplayedPoseAmount > 0.0001 && Boolean(reloadProfile);
    const wantsAimPose = (aimingState || reloadForcesAimPose) && aliveState && !ragdoll.isActive() && Boolean(activeAimPose);
    const wantsUpperBodyLook = aliveState && !activeEmoteId && !isLimpTransitioning();
    aimPoseWeight = THREE.MathUtils.damp(aimPoseWeight, wantsAimPose ? 1 : 0, 14, deltaSeconds);
    upperBodyLookWeight = THREE.MathUtils.damp(upperBodyLookWeight, wantsUpperBodyLook ? 1 : 0, 14, deltaSeconds);
    applyUpperBodyPose();
    applyHeldItemReloadMotion(activeAimItemId, reloadProfile);
    applyReloadArmIk(activeAimItemId, reloadProfile);
    recoilAmount = THREE.MathUtils.damp(recoilAmount, 0, wantsAimPose ? 22 : 18, deltaSeconds);
    const now = performance.now();
    const damageLifetime = Math.max(1, damageFeedbackEndsAt - damageFeedbackStartedAt);
    const damageProgress = THREE.MathUtils.clamp((now - damageFeedbackStartedAt) / damageLifetime, 0, 1);
    const damageActive = damageProgress < 1;
    const damageEnvelope = damageActive ? Math.pow(1 - damageProgress, 1.25) : 0;
    const damageWave = damageActive ? Math.sin(damageProgress * Math.PI * 3.4) : 0;
    const damagePulse = damageActive ? Math.sin(damageProgress * Math.PI) : 0;
    const damageSideX = -damageDirection.z;
    const damageSideZ = damageDirection.x;
    const damageJolt = damageEnvelope * 0.18;
    const damageShimmy = damageWave * damageEnvelope * 0.09;
    const damageFlashAmount = damageActive
      ? Math.min(1, (damageEnvelope * 0.72) + (Math.abs(damageWave) * 0.2))
      : 0;

    visual.position.set(
      (damageDirection.x * damageJolt) + (damageSideX * damageShimmy),
      (recoilAmount * 0.03) + (damagePulse * 0.12),
      (damageDirection.z * damageJolt) + (damageSideZ * damageShimmy)
    );
    visual.rotation.set(
      (-recoilAmount * 0.08) - (damageDirection.z * damageEnvelope * 0.12) + (damageWave * 0.025),
      damageWave * damageEnvelope * 0.025,
      (recoilAmount * 0.015) + (damageDirection.x * damageEnvelope * 0.14) + (damageWave * 0.045)
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
  }

  async function setWeaponState(weaponId = '', { visible = true } = {}) {
    const nextWeaponId = weaponId || '';
    const nextVisible = Boolean(visible && nextWeaponId);
    if (desiredWeaponId === nextWeaponId && slotVisibility.get(ATTACHMENT_SLOTS.handRight) === nextVisible) {
      updateHeldItemVisibility();
      return;
    }

    desiredWeaponId = nextWeaponId;
    if (!desiredWeaponId) {
      setReloadPreviewState(false);
      setReloadState(false);
      detachHeldItem(ATTACHMENT_SLOTS.handRight);
      return;
    }

    await attachHeldItem(desiredWeaponId, { visible: nextVisible });
  }

  function setAliveState(nextAlive, { startedAtMs = Date.now() } = {}) {
    if (aliveState === nextAlive) {
      return;
    }

    aliveState = nextAlive;
    if (!nextAlive) {
      setReloadPreviewState(false);
      setReloadState(false);
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

  function triggerDamageFeedback({ direction = null } = {}) {
    damageFeedbackStartedAt = performance.now();
    damageFeedbackEndsAt = damageFeedbackStartedAt + DAMAGE_FEEDBACK_DURATION_MS;

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
      position: [0, 1, 2].map((index) => (existing.position?.[index] ?? 0) + (delta.position?.[index] ?? 0)),
      rotation: [0, 1, 2].map((index) => (existing.rotation?.[index] ?? 0) + (delta.rotation?.[index] ?? 0)),
      scale: [0, 1, 2].map((index) => (existing.scale?.[index] ?? 1) * (delta.scale?.[index] ?? 1))
    };
    gripOverrides.set(itemId, nextOverride);
    applyHeldItemProfile(itemId);
    updateHeldItemVisibility();
    return getMergedGripProfile(itemId);
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
      for (const slot of Object.values(ATTACHMENT_SLOTS)) {
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
      for (const slot of Object.values(ATTACHMENT_SLOTS)) {
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
    getAnimationSyncState() {
      if (ragdoll.isActive()) {
        return {
          emoteId: LIMP_EMOTE_ID,
          emoteActive: true,
          emoteStartedAt: limpStartedAt,
          emoteSeq: emoteSequence,
          aimRotationY
        };
      }

      return {
        emoteId: activeEmoteId ?? '',
        emoteActive: Boolean(activeEmoteId),
        emoteStartedAt: activeEmoteId ? activeEmoteStartedAt : 0,
        emoteSeq: emoteSequence,
        aimRotationY
      };
    },
    playEmote(emoteId, { startedAtMs = Date.now(), trackSync = true } = {}) {
      if (emoteId === LIMP_EMOTE_ID) {
        return setLimpActive(true, { startedAtMs, trackSync });
      }

      if (isLimpTransitioning()) {
        setLimpActive(false, { trackSync: false });
      }

      const emoteConfig = getEmoteConfig(emoteId);
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
          }

          activeEmoteId = emoteId;
          activeEmoteConfig = emoteConfig;
          activeEmoteStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : Date.now();
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
    setAimingState(aiming) {
      aimingState = Boolean(aiming);
    },
    setReloadState(reloading, options = {}) {
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
        position: [...(override.position ?? EMPTY_VECTOR_OVERRIDE)],
        rotation: [...(override.rotation ?? EMPTY_VECTOR_OVERRIDE)],
        scale: [...(override.scale ?? [1, 1, 1])]
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
    setWeaponState(weaponId, { visible = true } = {}) {
      void setWeaponState(weaponId, { visible });
    },
    setAliveState(alive, options = {}) {
      setAliveState(Boolean(alive), options);
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
    update(deltaSeconds, input, camera, colliders, cityBounds, groundHeight = 0) {
      if (!aliveState) {
        updateAnimationState(deltaSeconds, false, groundHeight);
        return;
      }

      const rawInput = input.getMovementVector();
      const wantsToMove = rawInput.x !== 0 || rawInput.z !== 0;

      if (wantsToMove && isLimpTransitioning()) {
        setLimpActive(false, { trackSync: false });
      }

      if (wantsToMove) {
        stopActiveEmote();
      }

      const moving = wantsToMove && !ragdoll.isActive();
      const movement = moving ? projectMoveOnCamera(camera, rawInput) : new THREE.Vector3();

      if (moving) {
        const step = PLAYER_SPEED * deltaSeconds;
        const proposedX = anchor.position.clone().addScaledVector(new THREE.Vector3(movement.x, 0, 0), step);
        if (!collidesWithColliders(proposedX, colliders, PLAYER_RADIUS)) {
          anchor.position.x = THREE.MathUtils.clamp(proposedX.x, cityBounds.min.x, cityBounds.max.x);
        }

        const proposedZ = anchor.position.clone().addScaledVector(new THREE.Vector3(0, 0, movement.z), step);
        if (!collidesWithColliders(proposedZ, colliders, PLAYER_RADIUS)) {
          anchor.position.z = THREE.MathUtils.clamp(proposedZ.z, cityBounds.min.z, cityBounds.max.z);
        }

        const targetYaw = Math.atan2(movement.x, movement.z);
        anchor.rotation.y = dampAngle(anchor.rotation.y, targetYaw, 0.18);
      }

      updateAnimationState(deltaSeconds, moving, groundHeight);
    },
    applyRemoteState(state, deltaSeconds, groundHeight = 0) {
      const remoteAlive = state?.alive !== false;
      setAliveState(remoteAlive, {
        startedAtMs: Number.isFinite(state?.lastDamagedAt) && state.lastDamagedAt > 0
          ? state.lastDamagedAt
          : Date.now()
      });
      void setWeaponState(
        remoteAlive ? (typeof state?.equippedWeaponId === 'string' ? state.equippedWeaponId : '') : '',
        { visible: remoteAlive && Boolean(state?.equippedWeaponId) }
      );

      if (!remoteAlive) {
        aimingState = false;
        setReloadState(false);
        updateAnimationState(deltaSeconds, false, groundHeight);
        return;
      }

      const remoteEmoteId = typeof state?.emoteId === 'string' ? state.emoteId : '';
      const remoteEmoteActive = Boolean(state?.emoteActive && remoteEmoteId);
      const remoteEmoteSeq = Number.isFinite(state?.emoteSeq) ? Math.max(0, Math.floor(state.emoteSeq)) : 0;
      const remoteEmoteSignature = `${Number(remoteEmoteActive)}:${remoteEmoteId}:${remoteEmoteSeq}`;
      const remoteIsLimp = remoteEmoteActive && remoteEmoteId === LIMP_EMOTE_ID;

      if (
        remoteEmoteSignature !== lastRemoteEmoteSignature
        || (remoteEmoteActive && !remoteIsLimp && activeEmoteId !== remoteEmoteId)
        || (remoteIsLimp !== ragdoll.isActive())
        || (!remoteEmoteActive && activeEmoteId)
      ) {
        lastRemoteEmoteSignature = remoteEmoteSignature;
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
      setReloadState(Boolean(state?.isReloading), {
        weaponId: typeof state?.equippedWeaponId === 'string' ? state.equippedWeaponId : '',
        endsAtMs: Number(state?.reloadEndsAt ?? 0)
      });

      if (Number.isFinite(state?.aimRotationY)) {
        aimRotationY = state.aimRotationY;
      }

      const targetX = Number.isFinite(state?.x) ? state.x : anchor.position.x;
      const targetZ = Number.isFinite(state?.z) ? state.z : anchor.position.z;
      const targetRotationY = Number.isFinite(state?.rotationY) ? state.rotationY : anchor.rotation.y;
      const deltaX = targetX - anchor.position.x;
      const deltaZ = targetZ - anchor.position.z;
      const distance = Math.hypot(deltaX, deltaZ);

      if (distance > 8) {
        anchor.position.x = targetX;
        anchor.position.z = targetZ;
      } else {
        const positionLerp = 1 - Math.exp(-deltaSeconds * 12);
        anchor.position.x = THREE.MathUtils.lerp(anchor.position.x, targetX, positionLerp);
        anchor.position.z = THREE.MathUtils.lerp(anchor.position.z, targetZ, positionLerp);
      }

      const rotationLerp = 1 - Math.exp(-deltaSeconds * 14);
      anchor.rotation.y = dampAngle(anchor.rotation.y, targetRotationY, rotationLerp);
      updateAnimationState(deltaSeconds, !showingRemoteLimp && !showingRemoteEmote && distance > 0.05, groundHeight);
    }
  };
}
