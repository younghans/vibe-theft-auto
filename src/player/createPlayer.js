import * as THREE from 'three';
import { createInPlaceClip, ensureMixamoSockets, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip } from '../animation/mixamoClips.js';
import { assets } from '../world/assetManifest.js';
import { EMOTES_BY_ID } from './emotes.js';

const PLAYER_HEIGHT = 4.5;
const PLAYER_SPEED = 15;
const PLAYER_RADIUS = 1.4;
const EMOTE_FADE_IN = 0.12;
const EMOTE_FADE_OUT = 0.18;

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
  const character = await library.instantiate(assets.player.character);
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Mixamo player character is invalid. Missing bones: ${humanoid.missingBones.join(', ')}`);
  }

  const sockets = ensureMixamoSockets(character);
  const walkClip = createInPlaceClip(getMixamoClip(assets.player.walkClip), MIXAMO_BONES.hips);
  const mixer = new THREE.AnimationMixer(character);
  const walkAction = mixer.clipAction(walkClip);
  const emoteActions = new Map();
  walkAction.play();
  walkAction.enabled = true;
  walkAction.setEffectiveWeight(0);

  hideUnusedMeshes(character);
  normalizeCharacter(character);

  const anchor = new THREE.Group();
  const visual = new THREE.Group();
  visual.add(character);
  anchor.add(createPlayerIndicator({
    color: indicatorColor,
    opacity: indicatorOpacity
  }));
  anchor.add(visual);

  let walkWeight = 0;
  let activeEmoteId = null;
  let activeEmoteConfig = null;
  let activeEmoteStartedAt = 0;
  let emoteSequence = 0;
  let lastRemoteEmoteSignature = '';

  function getEmoteAction(emoteId) {
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

  mixer.addEventListener('finished', (event) => {
    if (activeEmoteId && getEmoteAction(activeEmoteId) === event.action) {
      stopActiveEmote();
    }
  });

  function updateAnimationState(deltaSeconds, moving, groundHeight = 0) {
    walkWeight = THREE.MathUtils.damp(walkWeight, moving ? 1 : 0, 12, deltaSeconds);
    walkAction.setEffectiveWeight(walkWeight);
    walkAction.setEffectiveTimeScale(moving ? 1 : 0.35);
    mixer.update(deltaSeconds);
    anchor.position.y = groundHeight;
    visual.position.y = 0;
    visual.rotation.z = 0;
    visual.rotation.x = 0;
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
    getAnimationSyncState() {
      return {
        emoteId: activeEmoteId ?? '',
        emoteActive: Boolean(activeEmoteId),
        emoteStartedAt: activeEmoteId ? activeEmoteStartedAt : 0,
        emoteSeq: emoteSequence
      };
    },
    playEmote(emoteId, { startedAtMs = Date.now(), trackSync = true } = {}) {
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
    update(deltaSeconds, input, camera, colliders, cityBounds, groundHeight = 0) {
      const rawInput = input.getMovementVector();
      const wantsToMove = rawInput.x !== 0 || rawInput.z !== 0;

      if (wantsToMove) {
        stopActiveEmote();
      }

      const moving = wantsToMove;
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
      const remoteEmoteId = typeof state?.emoteId === 'string' ? state.emoteId : '';
      const remoteEmoteActive = Boolean(state?.emoteActive && remoteEmoteId);
      const remoteEmoteSeq = Number.isFinite(state?.emoteSeq) ? Math.max(0, Math.floor(state.emoteSeq)) : 0;
      const remoteEmoteSignature = `${Number(remoteEmoteActive)}:${remoteEmoteId}:${remoteEmoteSeq}`;

      if (
        remoteEmoteSignature !== lastRemoteEmoteSignature
        || (remoteEmoteActive && activeEmoteId !== remoteEmoteId)
        || (!remoteEmoteActive && activeEmoteId)
      ) {
        lastRemoteEmoteSignature = remoteEmoteSignature;
        if (remoteEmoteActive) {
          this.playEmote(remoteEmoteId, {
            startedAtMs: Number.isFinite(state?.emoteStartedAt) ? state.emoteStartedAt : Date.now(),
            trackSync: false
          });
        } else {
          stopActiveEmote();
        }
      }

      const showingRemoteEmote = remoteEmoteActive && activeEmoteId === remoteEmoteId;

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
      updateAnimationState(deltaSeconds, !showingRemoteEmote && distance > 0.05, groundHeight);
    }
  };
}
