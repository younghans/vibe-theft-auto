import * as THREE from 'three';
import { createInPlaceClip, ensureMixamoSockets, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip } from '../animation/mixamoClips.js';
import { createRagdollController } from '../player/ragdollController.js';
import { NPC_RUNTIME_MODES, NPC_SPEED_TIERS, normalizeNpcSpeedTier } from './npcBehavior.js';
import { assets } from '../world/assetManifest.js';
import { createOlympicBarbellVisual } from '../world/proceduralProps.js';
import { prepareNpcRenderObject } from './npcRenderUtils.js';

const DAMAGE_FEEDBACK_DURATION_MS = 380;
const DAMAGE_FLASH_COLOR = new THREE.Color(0xff5b73);
const DAMAGE_EMISSIVE_COLOR = new THREE.Color(0xff3154);
const DAMAGE_RING_COLOR = new THREE.Color(0xff7b88);
const DAMAGE_BURST_COLOR = new THREE.Color(0xffd6cd);
const NPC_FOCUS_MIN_DISTANCE = 0.18;
const FOOT_PLANT_BONE_NAMES = Object.freeze([
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightFoot',
  'mixamorigRightToeBase'
]);
const NPC_GROUNDED_ANIMATIONS = new Set(['snatch']);

let sharedIdleClip = null;
let sharedWalkClip = null;
let sharedSlowRunClip = null;
let sharedFastRunClip = null;
let sharedFightIdleClip = null;
let sharedPunchClip = null;
let sharedSnatchClip = null;

function getSharedIdleClip() {
  if (!sharedIdleClip) {
    sharedIdleClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.idle), MIXAMO_BONES.hips);
  }

  return sharedIdleClip;
}

function getSharedWalkClip() {
  if (!sharedWalkClip) {
    sharedWalkClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.walking), MIXAMO_BONES.hips);
  }

  return sharedWalkClip;
}

function getSharedSlowRunClip() {
  if (!sharedSlowRunClip) {
    sharedSlowRunClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.slowRun), MIXAMO_BONES.hips);
  }

  return sharedSlowRunClip;
}

function getSharedFastRunClip() {
  if (!sharedFastRunClip) {
    sharedFastRunClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.fastRun), MIXAMO_BONES.hips);
  }

  return sharedFastRunClip;
}

function getSharedFightIdleClip() {
  if (!sharedFightIdleClip) {
    sharedFightIdleClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.fightingIdle), MIXAMO_BONES.hips);
  }

  return sharedFightIdleClip;
}

function getSharedPunchClip() {
  if (!sharedPunchClip) {
    sharedPunchClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.punching), MIXAMO_BONES.hips);
  }

  return sharedPunchClip;
}

function getSharedSnatchClip() {
  if (!sharedSnatchClip) {
    sharedSnatchClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.snatch), MIXAMO_BONES.hips);
  }

  return sharedSnatchClip;
}

function createIndicator(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.65, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ring.visible = false;
  ring.raycast = () => {};
  return ring;
}

function createInteractRadiusIndicator() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 96),
    new THREE.MeshBasicMaterial({
      color: 0x68c7ff,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.renderOrder = 4;
  ring.visible = false;
  ring.raycast = () => {};
  return ring;
}

function createPickProxy(collider) {
  const pickProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(collider.radius, collider.radius, collider.height, 18, 1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })
  );
  pickProxy.position.y = collider.height * 0.5;
  return pickProxy;
}

function cloneColor(color) {
  return color?.isColor ? color.clone() : null;
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
    if (!node?.isMesh || !node.material) {
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

export class NpcActor {
  constructor({ model, object, definition }) {
    this.model = model;
    this.definition = structuredClone(definition);
    this.anchor = new THREE.Group();
    this.visual = new THREE.Group();
    this.character = object;
    this.sockets = null;
    this.pickProxy = createPickProxy(model.pickCollider ?? model.collider);
    this.selectionIndicator = createIndicator(0xf2c871);
    this.busyIndicator = createIndicator(0xf6924c);
    this.interactRadiusIndicator = createInteractRadiusIndicator();
    this.busyIndicator.scale.setScalar(1.2);
    this.busyIndicator.position.y = 0.03;
    this.interactRadiusVisible = false;

    prepareNpcRenderObject(this.character, model);
    this.mixer = null;
    this.activeAnimation = 'idle';
    this.ragdoll = null;
    this.damageFeedbackStartedAt = -Infinity;
    this.damageFeedbackEndsAt = -Infinity;
    this.damageDirection = new THREE.Vector3(0, 0, 1);
    this.selected = false;
    this.focusTarget = null;
    this.footPlantBones = [];
    this.footPlantWorldPosition = new THREE.Vector3();
    this.footPlantLocalPosition = new THREE.Vector3();
    this.workoutLeftHandPosition = new THREE.Vector3();
    this.workoutRightHandPosition = new THREE.Vector3();
    this.workoutBarbellMidpoint = new THREE.Vector3();
    this.workoutBarbellAxis = new THREE.Vector3();
    this.workoutForward = new THREE.Vector3();
    this.workoutBarbellQuaternion = new THREE.Quaternion();
    this.anchorWorldQuaternion = new THREE.Quaternion();
    this.anchorWorldQuaternionInverse = new THREE.Quaternion();
    this.workoutBarbellLocalPosition = new THREE.Vector3();
    this.workoutBarbellLocalQuaternion = new THREE.Quaternion();
    this.runtimeState = {
      x: definition.position[0],
      z: definition.position[1],
      rotationY: definition.rotationQuarterTurns * (Math.PI / 2),
      mode: NPC_RUNTIME_MODES.routine,
      activity: '',
      busy: false,
      alive: true,
      hidden: false,
      lastDamagedAt: 0,
      respawnAt: 0
    };
    this.materialFeedbackEntries = collectDamageTintMaterials(this.character);
    this.damageRipple = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.85, 32),
      new THREE.MeshBasicMaterial({
        color: DAMAGE_RING_COLOR,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.damageRipple.rotation.x = -Math.PI / 2;
    this.damageRipple.position.y = 0.06;
    this.damageRipple.visible = false;
    this.damageBurst = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({
        color: DAMAGE_BURST_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    this.damageBurst.position.set(0, this.model.height * 0.58, 0);
    this.damageBurst.visible = false;
    this.carriedBarbell = createOlympicBarbellVisual({ origin: 'center' });
    this.carriedBarbell.visible = false;

    const humanoid = validateMixamoHumanoid(this.character);
    if (humanoid.isHumanoid) {
      this.sockets = ensureMixamoSockets(this.character);
      this.footPlantBones = FOOT_PLANT_BONE_NAMES
        .map((boneName) => this.character.getObjectByName(boneName))
        .filter(Boolean);
      this.mixer = new THREE.AnimationMixer(this.character);
      this.ragdoll = createRagdollController(this.character);
      this.animationActions = new Map([
        ['idle', this.mixer.clipAction(getSharedIdleClip())],
        ['walk', this.mixer.clipAction(getSharedWalkClip())],
        ['slowRun', this.mixer.clipAction(getSharedSlowRunClip())],
        ['fastRun', this.mixer.clipAction(getSharedFastRunClip())],
        ['fightIdle', this.mixer.clipAction(getSharedFightIdleClip())],
        ['punch', this.mixer.clipAction(getSharedPunchClip())],
        ['snatch', this.mixer.clipAction(getSharedSnatchClip())]
      ]);
      for (const [key, action] of this.animationActions.entries()) {
        action.enabled = true;
        action.setLoop(
          key === 'punch'
            ? THREE.LoopRepeat
            : THREE.LoopRepeat,
          Infinity
        );
        action.setEffectiveWeight(key === 'idle' ? 1 : 0);
        action.play();
      }
    } else {
      this.animationActions = new Map();
      console.warn(`[NPC] ${model.label} is missing Mixamo humanoid bones for idle animation.`, {
        missingBones: humanoid.missingBones
      });
    }

    this.anchor.add(this.pickProxy);
    this.anchor.add(this.interactRadiusIndicator);
    this.anchor.add(this.damageRipple);
    this.anchor.add(this.carriedBarbell);
    this.visual.add(this.character);
    this.visual.add(this.damageBurst);
    this.anchor.add(this.busyIndicator);
    this.anchor.add(this.selectionIndicator);
    this.anchor.add(this.visual);
    this.applyPlacement(definition);
  }

  get object() {
    return this.anchor;
  }

  get boundsObject() {
    return this.visual;
  }

  getCollider() {
    const collider = this.model.collider ?? this.model.pickCollider;
    return {
      kind: 'npc',
      blocksMovement: false,
      type: 'cylinder',
      x: this.anchor.position.x,
      z: this.anchor.position.z,
      y: this.anchor.position.y,
      radius: collider.radius,
      height: collider.height
    };
  }

  getFootPlantGroundingOffset() {
    if (!NPC_GROUNDED_ANIMATIONS.has(this.activeAnimation) || this.footPlantBones.length === 0) {
      return 0;
    }

    this.character.updateWorldMatrix(true, true);
    this.visual.updateWorldMatrix(true, true);

    let lowestLocalY = Infinity;
    for (const bone of this.footPlantBones) {
      bone.getWorldPosition(this.footPlantWorldPosition);
      this.footPlantLocalPosition.copy(this.footPlantWorldPosition);
      this.visual.worldToLocal(this.footPlantLocalPosition);
      lowestLocalY = Math.min(lowestLocalY, this.footPlantLocalPosition.y);
    }

    if (!Number.isFinite(lowestLocalY)) {
      return 0;
    }

    return Math.max(0, lowestLocalY);
  }

  syncWorkoutBarbell() {
    const workoutActive = (
      this.runtimeState.alive !== false
      && this.runtimeState.mode !== NPC_RUNTIME_MODES.hidden
      && this.runtimeState.activity === 'snatch'
      && this.sockets?.handLeft
      && this.sockets?.handRight
    );

    this.carriedBarbell.visible = Boolean(workoutActive);
    if (!workoutActive) {
      return;
    }

    const leftHand = this.sockets.handLeft;
    const rightHand = this.sockets.handRight;
    leftHand.getWorldPosition(this.workoutLeftHandPosition);
    rightHand.getWorldPosition(this.workoutRightHandPosition);
    this.workoutBarbellMidpoint
      .copy(this.workoutLeftHandPosition)
      .add(this.workoutRightHandPosition)
      .multiplyScalar(0.5);
    this.workoutBarbellAxis
      .subVectors(this.workoutRightHandPosition, this.workoutLeftHandPosition)
      .setY(0);

    if (this.workoutBarbellAxis.lengthSq() <= 0.0001) {
      const facing = this.anchor.rotation.y;
      this.workoutBarbellAxis.set(Math.cos(facing), 0, -Math.sin(facing));
    } else {
      this.workoutBarbellAxis.normalize();
    }

    this.workoutForward.set(
      Math.sin(this.anchor.rotation.y),
      0,
      Math.cos(this.anchor.rotation.y)
    );

    this.workoutBarbellMidpoint.addScaledVector(this.workoutForward, 0.08);
    this.workoutBarbellQuaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      this.workoutBarbellAxis
    );

    this.workoutBarbellLocalPosition.copy(this.workoutBarbellMidpoint);
    this.anchor.worldToLocal(this.workoutBarbellLocalPosition);
    this.anchor.getWorldQuaternion(this.anchorWorldQuaternion);
    this.anchorWorldQuaternionInverse.copy(this.anchorWorldQuaternion).invert();
    this.workoutBarbellLocalQuaternion
      .copy(this.anchorWorldQuaternionInverse)
      .multiply(this.workoutBarbellQuaternion);

    this.carriedBarbell.position.copy(this.workoutBarbellLocalPosition);
    this.carriedBarbell.quaternion.copy(this.workoutBarbellLocalQuaternion);
  }

  getSelectionBounds() {
    const collider = this.model.pickCollider ?? this.model.collider;
    const radius = Math.max(0.5, Number(collider?.radius ?? this.model.colliderRadius ?? 1));
    const height = Math.max(
      Number(collider?.height ?? 0),
      Number(this.model.height ?? 0),
      1
    );

    return new THREE.Box3(
      new THREE.Vector3(
        this.anchor.position.x - radius,
        this.anchor.position.y,
        this.anchor.position.z - radius
      ),
      new THREE.Vector3(
        this.anchor.position.x + radius,
        this.anchor.position.y + height,
        this.anchor.position.z + radius
      )
    );
  }

  applyPlacement(definition) {
    this.definition = structuredClone(definition);
    this.anchor.position.set(definition.position[0], definition.y ?? 0, definition.position[1]);
    this.anchor.rotation.y = definition.rotationQuarterTurns * (Math.PI / 2);
    this.runtimeState.x = definition.position[0];
    this.runtimeState.z = definition.position[1];
    this.runtimeState.rotationY = this.anchor.rotation.y;
    this.setInteractRadius(definition.interactRadius ?? this.model.interactionRadius);
  }

  setSelected(selected) {
    this.selected = Boolean(selected);
    this.selectionIndicator.visible = this.selected;
  }

  setBusy(busy) {
    this.busyIndicator.visible = busy;
    this.runtimeState.busy = busy;
  }

  setInteractRadius(radius) {
    const nextRadius = Math.max(0.5, Number(radius ?? this.model.interactionRadius ?? 4.2));
    this.interactRadiusIndicator.scale.setScalar(nextRadius);
  }

  setInteractRadiusVisible(visible) {
    this.interactRadiusVisible = Boolean(visible);
    this.syncInteractRadiusVisibility();
  }

  syncInteractRadiusVisibility() {
    const isInteractable = this.runtimeState.alive !== false && this.runtimeState.mode !== NPC_RUNTIME_MODES.dead;
    this.interactRadiusIndicator.visible = this.interactRadiusVisible && isInteractable;
  }

  setFocusTarget(target = null) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
      this.focusTarget = null;
      return;
    }

    this.focusTarget = {
      x: Number(target.x),
      z: Number(target.z)
    };
  }

  getSpeechAnchorWorldPosition(target = new THREE.Vector3()) {
    this.anchor.getWorldPosition(target);
    target.y += this.model.height + 1;
    return target;
  }

  setRuntimeState(state = {}, groundY = this.anchor.position.y) {
    const wasAlive = this.runtimeState.alive !== false;
    const nextAlive = state.alive !== false;
    this.runtimeState = {
      ...this.runtimeState,
      ...state,
      x: Number.isFinite(state.x) ? state.x : this.runtimeState.x,
      z: Number.isFinite(state.z) ? state.z : this.runtimeState.z,
      rotationY: Number.isFinite(state.rotationY) ? state.rotationY : this.runtimeState.rotationY,
      hidden: state.mode === NPC_RUNTIME_MODES.hidden,
      alive: state.alive !== false
    };
    this.anchor.position.y = groundY;
    this.setBusy(Boolean(state.busy));
    this.setInteractRadius(state.interactRadius ?? this.model.interactionRadius);
    this.syncInteractRadiusVisibility();

    if (wasAlive && !nextAlive) {
      this.ragdoll?.activate({
        startedAtMs: Number.isFinite(state.lastDamagedAt) && state.lastDamagedAt > 0
          ? state.lastDamagedAt
          : Date.now()
      });
    } else if (!wasAlive && nextAlive) {
      this.ragdoll?.reset();
      this.anchor.position.x = this.runtimeState.x;
      this.anchor.position.z = this.runtimeState.z;
      this.anchor.rotation.y = this.runtimeState.rotationY;
      this.visual.position.set(0, 0, 0);
      this.visual.rotation.set(0, 0, 0);
      this.damageFeedbackStartedAt = -Infinity;
      this.damageFeedbackEndsAt = -Infinity;
    }
  }

  triggerDamageFeedback({ direction = null } = {}) {
    this.damageFeedbackStartedAt = performance.now();
    this.damageFeedbackEndsAt = this.damageFeedbackStartedAt + DAMAGE_FEEDBACK_DURATION_MS;

    if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)) {
      this.damageDirection.set(direction.x, 0, direction.z);
    } else {
      this.damageDirection.set(Math.sin(this.anchor.rotation.y), 0, Math.cos(this.anchor.rotation.y));
    }

    if (this.damageDirection.lengthSq() <= 0.0001) {
      this.damageDirection.set(0, 0, 1);
    } else {
      this.damageDirection.normalize();
    }
  }

  syncAnimationState() {
    if (!this.animationActions?.size) {
      return;
    }

    const moving = Math.hypot(
      this.runtimeState.x - this.anchor.position.x,
      this.runtimeState.z - this.anchor.position.z
    ) > 0.12;
    let nextAnimation = 'idle';

    if (!this.runtimeState.alive || this.runtimeState.mode === NPC_RUNTIME_MODES.dead) {
      nextAnimation = 'idle';
    } else if (this.runtimeState.activity === 'snatch') {
      nextAnimation = 'snatch';
    } else if (this.runtimeState.activity === 'punch') {
      nextAnimation = 'punch';
    } else if (
      moving
      && (this.runtimeState.mode === NPC_RUNTIME_MODES.combat || this.runtimeState.mode === NPC_RUNTIME_MODES.flee)
    ) {
      nextAnimation = normalizeNpcSpeedTier(this.definition?.speed) === NPC_SPEED_TIERS.fast
        ? 'fastRun'
        : 'slowRun';
    } else if (moving) {
      nextAnimation = 'walk';
    } else if (this.runtimeState.mode === NPC_RUNTIME_MODES.combat) {
      nextAnimation = 'fightIdle';
    }

    if (nextAnimation === this.activeAnimation) {
      return;
    }

    for (const [key, action] of this.animationActions.entries()) {
      action.setEffectiveWeight(key === nextAnimation ? 1 : 0);
    }
    this.activeAnimation = nextAnimation;
  }

  update(deltaSeconds) {
    const targetX = this.runtimeState.x ?? this.anchor.position.x;
    const targetZ = this.runtimeState.z ?? this.anchor.position.z;
    let targetRotationY = this.runtimeState.rotationY ?? this.anchor.rotation.y;
    if (
      this.focusTarget
      && this.runtimeState.alive !== false
      && this.runtimeState.mode === NPC_RUNTIME_MODES.combat
      && this.ragdoll?.isActive?.() !== true
    ) {
      const focusDeltaX = this.focusTarget.x - this.anchor.position.x;
      const focusDeltaZ = this.focusTarget.z - this.anchor.position.z;
      if (Math.hypot(focusDeltaX, focusDeltaZ) > NPC_FOCUS_MIN_DISTANCE) {
        targetRotationY = Math.atan2(focusDeltaX, focusDeltaZ);
      }
    }
    const lerp = 1 - Math.exp(-deltaSeconds * 10);
    this.anchor.position.x = THREE.MathUtils.lerp(this.anchor.position.x, targetX, lerp);
    this.anchor.position.z = THREE.MathUtils.lerp(this.anchor.position.z, targetZ, lerp);
    const deltaYaw = Math.atan2(
      Math.sin(targetRotationY - this.anchor.rotation.y),
      Math.cos(targetRotationY - this.anchor.rotation.y)
    );
    this.anchor.rotation.y += deltaYaw * lerp;
    this.anchor.visible = this.runtimeState.mode !== NPC_RUNTIME_MODES.hidden;
    const now = performance.now();
    const damageLifetime = Math.max(1, this.damageFeedbackEndsAt - this.damageFeedbackStartedAt);
    const damageProgress = THREE.MathUtils.clamp((now - this.damageFeedbackStartedAt) / damageLifetime, 0, 1);
    const damageActive = damageProgress < 1;
    const damageEnvelope = damageActive ? Math.pow(1 - damageProgress, 1.25) : 0;
    const damageWave = damageActive ? Math.sin(damageProgress * Math.PI * 3.4) : 0;
    const damagePulse = damageActive ? Math.sin(damageProgress * Math.PI) : 0;
    const damageSideX = -this.damageDirection.z;
    const damageSideZ = this.damageDirection.x;
    const damageJolt = damageEnvelope * 0.18;
    const damageShimmy = damageWave * damageEnvelope * 0.09;
    const damageFlashAmount = damageActive
      ? Math.min(1, (damageEnvelope * 0.72) + (Math.abs(damageWave) * 0.2))
      : 0;

    this.syncAnimationState();
    this.mixer?.update(deltaSeconds);
    this.ragdoll?.update(deltaSeconds);
    this.ragdoll?.applyToSkeleton();
    const footPlantGroundingOffsetY = this.getFootPlantGroundingOffset();

    this.visual.position.set(
      (this.damageDirection.x * damageJolt) + (damageSideX * damageShimmy),
      (damagePulse * 0.12) - footPlantGroundingOffsetY,
      (this.damageDirection.z * damageJolt) + (damageSideZ * damageShimmy)
    );
    this.visual.rotation.set(
      -(this.damageDirection.z * damageEnvelope * 0.12) + (damageWave * 0.025),
      damageWave * damageEnvelope * 0.025,
      (this.damageDirection.x * damageEnvelope * 0.14)
        + (damageWave * 0.045)
    );

    this.selectionIndicator.material.opacity = damageActive
      ? THREE.MathUtils.lerp(0.7, 1, damageFlashAmount * 0.5)
      : 0.7;
    this.selectionIndicator.material.color.setHex(damageActive ? 0xff6d7d : 0xf2c871);
    this.selectionIndicator.visible = this.selected || damageActive;
    this.selectionIndicator.scale.setScalar(1 + (damagePulse * 0.24));

    this.damageRipple.visible = damageActive;
    this.damageRipple.material.opacity = damageActive ? Math.max(0, 0.78 - (damageProgress * 0.92)) : 0;
    this.damageRipple.scale.setScalar(0.82 + (damageProgress * 1.45));
    this.damageRipple.position.x = this.damageDirection.x * 0.08;
    this.damageRipple.position.z = this.damageDirection.z * 0.08;

    this.damageBurst.visible = damageActive;
    this.damageBurst.material.opacity = damageActive ? Math.max(0, 0.88 - (damageProgress * 1.08)) : 0;
    this.damageBurst.position.set(
      this.damageDirection.x * 0.18,
      (this.model.height * 0.58) + (damagePulse * 0.16),
      this.damageDirection.z * 0.18
    );
    this.damageBurst.scale.setScalar(0.6 + (damagePulse * 1.45));
    this.damageBurst.rotation.x = damageProgress * 1.8;
    this.damageBurst.rotation.y = damageProgress * 3.1;

    for (const entry of this.materialFeedbackEntries) {
      const { material, baseColor, baseEmissive, baseEmissiveIntensity } = entry;
      if (baseColor && material.color) {
        material.color.copy(baseColor).lerp(DAMAGE_FLASH_COLOR, damageFlashAmount * 0.3);
      }
      if (baseEmissive && material.emissive) {
        material.emissive.copy(baseEmissive).lerp(DAMAGE_EMISSIVE_COLOR, damageFlashAmount);
      }
      if (Number.isFinite(baseEmissiveIntensity) && Number.isFinite(material.emissiveIntensity)) {
        material.emissiveIntensity = baseEmissiveIntensity + (damageFlashAmount * 1.45);
      }
    }

    this.syncWorkoutBarbell();
  }
}
