import * as THREE from 'three';

function normalizeCharacter(root, targetHeight) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
}

function markRenderable(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
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
    this.busyIndicator.scale.setScalar(1.2);
    this.busyIndicator.position.y = 0.03;

    markRenderable(this.character);
    normalizeCharacter(this.character, model.height);

    this.visual.add(this.character);
    this.anchor.add(this.busyIndicator);
    this.anchor.add(this.selectionIndicator);
    this.anchor.add(this.visual);
    this.applyPlacement(definition);
  }

  get object() {
    return this.anchor;
  }

  applyPlacement(definition) {
    this.definition = structuredClone(definition);
    this.anchor.position.set(definition.position[0], 0, definition.position[1]);
    this.anchor.rotation.y = definition.rotationQuarterTurns * (Math.PI / 2);
  }

  setSelected(selected) {
    this.selectionIndicator.visible = selected;
  }

  setBusy(busy) {
    this.busyIndicator.visible = busy;
  }
}
