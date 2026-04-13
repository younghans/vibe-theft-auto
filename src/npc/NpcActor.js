import * as THREE from 'three';
import { createInPlaceClip, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip } from '../animation/mixamoClips.js';
import { NPC_RUNTIME_MODES } from './npcBehavior.js';
import { assets } from '../world/assetManifest.js';
import { prepareNpcRenderObject } from './npcRenderUtils.js';

let sharedIdleClip = null;
let sharedWalkClip = null;
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

export class NpcActor {
  constructor({ model, object, definition }) {
    this.model = model;
    this.definition = structuredClone(definition);
    this.anchor = new THREE.Group();
    this.visual = new THREE.Group();
    this.character = object;
    this.pickProxy = createPickProxy(model.pickCollider ?? model.collider);
    this.selectionIndicator = createIndicator(0xf2c871);
    this.busyIndicator = createIndicator(0xf6924c);
    this.interactRadiusIndicator = createInteractRadiusIndicator();
    this.busyIndicator.scale.setScalar(1.2);
    this.busyIndicator.position.y = 0.03;

    prepareNpcRenderObject(this.character, model);
    this.mixer = null;
    this.activeAnimation = 'idle';
    this.damagePulseUntil = 0;
    this.runtimeState = {
      x: definition.position[0],
      z: definition.position[1],
      rotationY: definition.rotationQuarterTurns * (Math.PI / 2),
      mode: NPC_RUNTIME_MODES.routine,
      activity: '',
      busy: false,
      alive: true,
      hidden: false
    };

    const humanoid = validateMixamoHumanoid(this.character);
    if (humanoid.isHumanoid) {
      this.mixer = new THREE.AnimationMixer(this.character);
      this.animationActions = new Map([
        ['idle', this.mixer.clipAction(getSharedIdleClip())],
        ['walk', this.mixer.clipAction(getSharedWalkClip())],
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
    this.visual.add(this.character);
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
      type: 'cylinder',
      x: this.anchor.position.x,
      z: this.anchor.position.z,
      y: this.anchor.position.y,
      radius: collider.radius,
      height: collider.height
    };
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
    this.selectionIndicator.visible = selected;
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
    this.interactRadiusIndicator.visible = visible;
  }

  getSpeechAnchorWorldPosition(target = new THREE.Vector3()) {
    this.anchor.getWorldPosition(target);
    target.y += this.model.height + 1;
    return target;
  }

  setRuntimeState(state = {}, groundY = this.anchor.position.y) {
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
  }

  triggerDamageFeedback() {
    this.damagePulseUntil = performance.now() + 240;
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
    const targetRotationY = this.runtimeState.rotationY ?? this.anchor.rotation.y;
    const lerp = 1 - Math.exp(-deltaSeconds * 10);
    this.anchor.position.x = THREE.MathUtils.lerp(this.anchor.position.x, targetX, lerp);
    this.anchor.position.z = THREE.MathUtils.lerp(this.anchor.position.z, targetZ, lerp);
    const deltaYaw = Math.atan2(
      Math.sin(targetRotationY - this.anchor.rotation.y),
      Math.cos(targetRotationY - this.anchor.rotation.y)
    );
    this.anchor.rotation.y += deltaYaw * lerp;
    this.anchor.visible = this.runtimeState.mode !== NPC_RUNTIME_MODES.hidden;
    this.visual.rotation.z = (!this.runtimeState.alive || this.runtimeState.mode === NPC_RUNTIME_MODES.dead)
      ? -1.25
      : 0;
    const damagePulse = performance.now() < this.damagePulseUntil;
    this.selectionIndicator.material.opacity = damagePulse ? 1 : 0.7;
    this.selectionIndicator.material.color.setHex(damagePulse ? 0xff6d7d : 0xf2c871);
    this.syncAnimationState();
    this.mixer?.update(deltaSeconds);
  }
}
