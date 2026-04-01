import * as THREE from 'three';
import { prepareNpcRenderObject } from './npcRenderUtils.js';

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

export class NpcActor {
  constructor({ model, object, definition }) {
    this.model = model;
    this.definition = structuredClone(definition);
    this.anchor = new THREE.Group();
    this.visual = new THREE.Group();
    this.character = object;
    this.selectionIndicator = createIndicator(0xf2c871);
    this.busyIndicator = createIndicator(0xf6924c);
    this.interactRadiusIndicator = createInteractRadiusIndicator();
    this.busyIndicator.scale.setScalar(1.2);
    this.busyIndicator.position.y = 0.03;

    prepareNpcRenderObject(this.character, model);

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
}
