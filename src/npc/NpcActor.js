import * as THREE from 'three';
import { createInPlaceClip, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip } from '../animation/mixamoClips.js';
import { assets } from '../world/assetManifest.js';
import { prepareNpcRenderObject } from './npcRenderUtils.js';

let sharedIdleClip = null;

function getSharedIdleClip() {
  if (!sharedIdleClip) {
    sharedIdleClip = createInPlaceClip(getMixamoClip(assets.playerAnimationSet.idle), MIXAMO_BONES.hips);
  }

  return sharedIdleClip;
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

    const humanoid = validateMixamoHumanoid(this.character);
    if (humanoid.isHumanoid) {
      this.mixer = new THREE.AnimationMixer(this.character);
      this.idleAction = this.mixer.clipAction(getSharedIdleClip());
      this.idleAction.enabled = true;
      this.idleAction.play();
    } else {
      this.idleAction = null;
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
    this.setInteractRadius(definition.interactRadius ?? this.model.interactionRadius);
  }

  setSelected(selected) {
    this.selectionIndicator.visible = selected;
  }

  setBusy(busy) {
    this.busyIndicator.visible = busy;
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

  update(deltaSeconds) {
    this.mixer?.update(deltaSeconds);
  }
}
