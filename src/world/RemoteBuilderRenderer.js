import * as THREE from 'three';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import { prepareNpcRenderObject } from '../npc/npcRenderUtils.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';

const REMOTE_PREVIEW_COLOR = new THREE.Color(0x68c7ff);

function clonePreviewMaterial(material, opacity = 0.42) {
  const next = material.clone();
  next.transparent = true;
  next.opacity = opacity;
  next.depthWrite = false;

  if ('emissive' in next) {
    next.emissive = next.emissive.clone().lerp(REMOTE_PREVIEW_COLOR, 0.78);
    next.emissiveIntensity = 1;
  } else if ('color' in next) {
    next.color = next.color.clone().lerp(REMOTE_PREVIEW_COLOR, 0.5);
  }

  return next;
}

function applyPreviewMaterial(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clonedMaterials = materials.map((material) => clonePreviewMaterial(material));
    node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
    node.renderOrder = 9;
  });
}

function fitToFootprint(root, targetWidth, targetDepth) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scaleX = size.x > 0 ? targetWidth / size.x : 1;
  const scaleZ = size.z > 0 ? targetDepth / size.z : 1;
  root.scale.multiplyScalar(Math.min(scaleX, scaleZ));
}

function snapToGround(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.y -= bounds.min.y;
}

function preparePreviewObject(root, item) {
  const npcModel = item.layer === 'npc'
    ? getNpcModelByItemId(item.id)
    : null;

  if (npcModel) {
    prepareNpcRenderObject(root, npcModel, { enableShadows: false });
    return;
  }

  fitToFootprint(root, item.size[0], item.size[1]);
  snapToGround(root);
}

function toRotationY(rotationQuarterTurns) {
  return rotationQuarterTurns * (Math.PI / 2);
}

export class RemoteBuilderRenderer {
  constructor({ scene, library, worldRenderer }) {
    this.scene = scene;
    this.library = library;
    this.worldRenderer = worldRenderer;
    this.entries = new Map();
    this.loadTokens = new Map();
  }

  clear() {
    for (const sessionId of [...this.entries.keys()]) {
      this.remove(sessionId);
    }
  }

  sync(builders = new Map()) {
    const nextIds = new Set();
    for (const [sessionId, presence] of builders.entries()) {
      if (!presence?.active) {
        continue;
      }

      nextIds.add(sessionId);
      void this.upsert(sessionId, presence);
    }

    for (const sessionId of [...this.entries.keys()]) {
      if (!nextIds.has(sessionId)) {
        this.remove(sessionId);
      }
    }
  }

  remove(sessionId) {
    const entry = this.entries.get(sessionId);
    if (!entry) {
      return;
    }

    entry.root.parent?.remove(entry.root);
    entry.selectionRing.parent?.remove(entry.selectionRing);
    this.entries.delete(sessionId);
    this.loadTokens.delete(sessionId);
  }

  ensureEntry(sessionId) {
    let entry = this.entries.get(sessionId);
    if (entry) {
      return entry;
    }

    const root = new THREE.Group();
    const footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: REMOTE_PREVIEW_COLOR,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = 0.04;
    root.add(footprint);

    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.1, 40),
      new THREE.MeshBasicMaterial({
        color: REMOTE_PREVIEW_COLOR,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.visible = false;

    this.scene.add(root);
    this.scene.add(selectionRing);

    entry = {
      sessionId,
      itemId: '',
      root,
      footprint,
      selectionRing,
      previewObject: null
    };
    this.entries.set(sessionId, entry);
    return entry;
  }

  async upsert(sessionId, presence) {
    const item = getBuilderItemById(presence.itemId);
    if (!item) {
      this.remove(sessionId);
      return;
    }

    const entry = this.ensureEntry(sessionId);
    if (entry.itemId !== item.id) {
      entry.itemId = item.id;
      await this.loadPreview(entry, item);
    }

    this.updateTransform(entry, item, presence);
  }

  async loadPreview(entry, item) {
    const token = (this.loadTokens.get(entry.sessionId) ?? 0) + 1;
    this.loadTokens.set(entry.sessionId, token);
    const preview = await this.library.instantiate(item.asset);
    if (this.loadTokens.get(entry.sessionId) !== token) {
      return;
    }

    applyPreviewMaterial(preview);
    preparePreviewObject(preview, item);
    preview.position.y = 0.08;

    if (entry.previewObject) {
      entry.root.remove(entry.previewObject);
    }
    entry.previewObject = preview;
    entry.root.add(preview);
  }

  updateTransform(entry, item, presence) {
    if (item.layer === 'tile') {
      entry.root.position.set(
        presence.cellX * BUILDER_TILE_SIZE,
        0,
        presence.cellZ * BUILDER_TILE_SIZE
      );
      entry.footprint.scale.set(BUILDER_TILE_SIZE - 0.5, BUILDER_TILE_SIZE - 0.5, 1);
    } else {
      entry.root.position.set(presence.x ?? 0, 0, presence.z ?? 0);
      entry.footprint.scale.set(item.size[0] + 0.25, item.size[1] + 0.25, 1);
    }

    entry.root.rotation.y = toRotationY(presence.rotationQuarterTurns ?? 0);
    entry.root.visible = true;

    if (!presence.selectionPlacementId) {
      entry.selectionRing.visible = false;
      return;
    }

    const bounds = this.worldRenderer.getPlacementBounds(presence.selectionPlacementId);
    if (!bounds) {
      entry.selectionRing.position.set(entry.root.position.x, 0.08, entry.root.position.z);
      entry.selectionRing.scale.setScalar(1);
      entry.selectionRing.visible = true;
      return;
    }

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const ringScale = Math.max(1, Math.max(size.x, size.z) / 4.5);
    entry.selectionRing.position.set(center.x, 0.08, center.z);
    entry.selectionRing.scale.setScalar(ringScale);
    entry.selectionRing.visible = true;
  }
}
