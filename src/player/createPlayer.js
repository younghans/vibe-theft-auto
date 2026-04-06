import * as THREE from 'three';
import { createInPlaceClip, ensureMixamoSockets, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import { assets } from '../world/assetManifest.js';
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
  mergeAimPose,
  mergeAttachmentTransform,
  prepareHeldItemModel
} from '../shared/heldItemDefinitions.js';
import { EMOTES_BY_ID } from './emotes.js';
import { createRagdollController } from './ragdollController.js';
import { RAGDOLL_RECOVER_DURATION } from './ragdollRig.js';

const PLAYER_HEIGHT = 4.5;
const PLAYER_SPEED = 15;
const PLAYER_RADIUS = 1.4;
const EMOTE_FADE_IN = 0.12;
const EMOTE_FADE_OUT = 0.18;
const LIMP_EMOTE_ID = 'limp';

const LOOK_YAW_DISTRIBUTION = Object.freeze([
  Object.freeze({ bone: 'spine', weight: 0.12 }),
  Object.freeze({ bone: 'spineMiddle', weight: 0.2 }),
  Object.freeze({ bone: 'spineUpper', weight: 0.28 }),
  Object.freeze({ bone: 'neck', weight: 0.18 }),
  Object.freeze({ bone: 'head', weight: 0.22 })
]);

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

export async function createPlayer(library, {
  indicatorColor = 0xf2c871,
  indicatorOpacity = 0.85
} = {}) {
  const clipNamesToPreload = new Set([
    assets.player.idleClip,
    assets.player.walkClip,
    ...Object.values(assets.player.emotes ?? {})
  ]);

  await preloadMixamoClips([...clipNamesToPreload]);

  const character = await library.instantiate(assets.player.character);
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Mixamo player character is invalid. Missing bones: ${humanoid.missingBones.join(', ')}`);
  }

  const sockets = ensureMixamoSockets(character);
  const idleClip = createInPlaceClip(getMixamoClip(assets.player.idleClip), MIXAMO_BONES.hips);
  const walkClip = createInPlaceClip(getMixamoClip(assets.player.walkClip), MIXAMO_BONES.hips);
  const mixer = new THREE.AnimationMixer(character);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  const emoteActions = new Map();
  const skeletonHelper = new THREE.SkeletonHelper(character);
  idleAction.play();
  idleAction.enabled = true;
  idleAction.setEffectiveWeight(1);
  walkAction.play();
  walkAction.enabled = true;
  walkAction.setEffectiveWeight(0);

  hideUnusedMeshes(character);
  const characterScale = normalizeCharacter(character);

  const anchor = new THREE.Group();
  const visual = new THREE.Group();
  visual.add(character);
  anchor.add(createPlayerIndicator({
    color: indicatorColor,
    opacity: indicatorOpacity
  }));
  anchor.add(visual);

  let idleWeight = 1;
  let walkWeight = 0;
  let activeEmoteId = null;
  let activeEmoteConfig = null;
  let activeEmoteStartedAt = 0;
  let emoteSequence = 0;
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
    leftForeArm: character.getObjectByName(MIXAMO_BONES.leftForeArm) ?? null
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
  let desiredWeaponId = '';
  let aliveState = true;
  let recoilAmount = 0;
  let aimingState = false;
  let aimPoseWeight = 0;
  let upperBodyLookWeight = 0;
  let aimRotationY = 0;

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

  function getEmoteAction(emoteId) {
    if (emoteId === LIMP_EMOTE_ID) {
      return null;
    }

    if (emoteActions.has(emoteId)) {
      return emoteActions.get(emoteId);
    }

    const emoteConfig = EMOTES_BY_ID[emoteId];
    const clipName = emoteConfig?.clipName ?? assets.player.emotes?.[emoteId];
    if (!clipName) {
      return null;
    }

    const sourceClip = getMixamoClip(clipName);
    const clip = createInPlaceClip(sourceClip, MIXAMO_BONES.hips);
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(emoteConfig?.loop ? THREE.LoopRepeat : THREE.LoopOnce, emoteConfig?.loop ? Infinity : 1);
    action.setEffectiveWeight(0);
    emoteActions.set(emoteId, action);
    return action;
  }

  function stopActiveEmote() {
    if (!activeEmoteId) {
      return;
    }

    const action = getEmoteAction(activeEmoteId);
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
    if (activeEmoteId && getEmoteAction(activeEmoteId) === event.action) {
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

  function applyUpperBodyPose() {
    const activeItemId = getActiveHeldItemId(ATTACHMENT_SLOTS.handRight) || desiredWeaponId;
    const pose = activeItemId ? getMergedAimPose(activeItemId) : null;
    const hasLookPose = upperBodyLookWeight > 0.0001 && Boolean(activeItemId);
    const hasAimPose = aimPoseWeight > 0.0001 && Boolean(pose);
    const leftArmIdleLockActive = hasAimPose
      && !Object.keys(pose ?? {}).some((fieldKey) => AIM_IDLE_LOCK_FIELD_KEYS.has(fieldKey));

    if ((!hasLookPose && !hasAimPose) || !aliveState || ragdoll.isActive()) {
      return;
    }

    const rotationsByBone = new Map();
    const blendWeightsByBone = new Map();
    if (hasLookPose) {
      const aimDelta = normalizeAngle(aimRotationY - anchor.rotation.y);
      for (const entry of LOOK_YAW_DISTRIBUTION) {
        addBoneRotation(
          rotationsByBone,
          entry.bone,
          'y',
          aimDelta * entry.weight
        );
        setBoneBlendWeight(blendWeightsByBone, entry.bone, upperBodyLookWeight);
      }
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

          motionRoot.add(container);
          heldItemEntries.set(itemId, {
            id: itemId,
            slot,
            container,
            object,
            points
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
    activeItemsBySlot.delete(slot);
    slotVisibility.set(slot, false);
    if (slot === ATTACHMENT_SLOTS.handRight) {
      desiredWeaponId = '';
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
    const wantsAimPose = aimingState && aliveState && !ragdoll.isActive() && Boolean(activeAimPose);
    const wantsUpperBodyLook = aliveState && !activeEmoteId && !isLimpTransitioning() && Boolean(activeAimItemId);
    aimPoseWeight = THREE.MathUtils.damp(aimPoseWeight, wantsAimPose ? 1 : 0, 14, deltaSeconds);
    upperBodyLookWeight = THREE.MathUtils.damp(upperBodyLookWeight, wantsUpperBodyLook ? 1 : 0, 14, deltaSeconds);
    applyUpperBodyPose();
    recoilAmount = THREE.MathUtils.damp(recoilAmount, 0, aimingState ? 22 : 18, deltaSeconds);
    visual.position.set(0, recoilAmount * 0.03, 0);
    visual.rotation.set(-recoilAmount * 0.08, 0, recoilAmount * 0.015);
    const rightHandMotion = getSlotMotionRoot(ATTACHMENT_SLOTS.handRight);
    if (rightHandMotion) {
      rightHandMotion.position.set(
        SLOT_MOTION_BASE.position[0] - (recoilAmount * 0.22),
        SLOT_MOTION_BASE.position[1] + (recoilAmount * 0.02),
        SLOT_MOTION_BASE.position[2] - (recoilAmount * 0.22)
      );
      rightHandMotion.rotation.set(
        SLOT_MOTION_BASE.rotation[0] - (recoilAmount * 0.05),
        SLOT_MOTION_BASE.rotation[1] + (recoilAmount * 0.2),
        SLOT_MOTION_BASE.rotation[2] + (recoilAmount * 0.1)
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

      const action = getEmoteAction(emoteId);
      if (!action) {
        return false;
      }

      const emoteConfig = getEmoteConfig(emoteId);

      if (activeEmoteId === emoteId && emoteConfig.loop) {
        return true;
      }

      if (activeEmoteId && activeEmoteId !== emoteId) {
        getEmoteAction(activeEmoteId)?.fadeOut(activeEmoteConfig?.fadeOut ?? EMOTE_FADE_OUT);
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
    triggerShotFeedback() {
      recoilAmount = Math.max(recoilAmount, aimingState ? 1.2 : 1.05);
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
      } else if (desiredWeaponId || getActiveHeldItemId(ATTACHMENT_SLOTS.handRight)) {
        anchor.rotation.y = dampAngle(anchor.rotation.y, aimRotationY, 0.12);
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
