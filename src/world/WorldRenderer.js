import * as THREE from 'three';
import { NpcActor } from '../npc/NpcActor.js';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';

function setShadowFlags(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
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

function createCollisionBox(object, padding = 0.2) {
  return new THREE.Box3().setFromObject(object).expandByScalar(padding);
}

function toRotationY(rotationQuarterTurns) {
  return rotationQuarterTurns * (Math.PI / 2);
}

function extractPlacementId(node) {
  let current = node;
  while (current) {
    if (current.userData?.editorPlacementId) {
      return current.userData.editorPlacementId;
    }
    current = current.parent;
  }
  return null;
}

export class WorldRenderer {
  constructor({ scene, camera, library }) {
    this.scene = scene;
    this.camera = camera;
    this.library = library;
    this.raycaster = new THREE.Raycaster();

    this.tileRoot = new THREE.Group();
    this.propRoot = new THREE.Group();
    this.scene.add(this.tileRoot);
    this.scene.add(this.propRoot);

    this.renderedPlacements = new Map();
    this.npcRuntimeState = new Map();
  }

  async syncFromState(worldState) {
    this.clear();

    for (const placement of worldState.getPlacements()) {
      await this.addPlacement(placement);
    }
  }

  clear() {
    for (const rendered of this.renderedPlacements.values()) {
      rendered.object.parent?.remove(rendered.object);
    }
    this.renderedPlacements.clear();
    this.tileRoot.clear();
    this.propRoot.clear();
  }

  async addPlacement(placement) {
    const item = getBuilderItemById(placement.itemId);
    if (!item) {
      return null;
    }

    const actor = placement.layer === 'npc'
      ? await this.createNpcActor(placement, item)
      : null;
    const object = actor?.object ?? await this.library.instantiate(item.asset);

    if (!actor) {
      setShadowFlags(object);
      fitToFootprint(object, item.size[0], item.size[1]);
      snapToGround(object);

      if (placement.layer === 'tile') {
        object.position.set(placement.cellX * BUILDER_TILE_SIZE, 0, placement.cellZ * BUILDER_TILE_SIZE);
      } else {
        object.position.set(placement.position[0], 0, placement.position[1]);
      }
      object.rotation.y = toRotationY(placement.rotationQuarterTurns);
    }

    object.userData.editorPlacementId = placement.id;

    const renderedPlacement = {
      id: placement.id,
      object,
      actor,
      item,
      layer: placement.layer,
      collisionBox: item.collision ? createCollisionBox(object, item.padding ?? 0.2) : null
    };

    this.renderedPlacements.set(placement.id, renderedPlacement);
    if (placement.layer === 'tile') {
      this.tileRoot.add(object);
    } else {
      this.propRoot.add(object);
    }

    return renderedPlacement;
  }

  async createNpcActor(placement, item) {
    const model = getNpcModelByItemId(item.id);
    if (!model) {
      return null;
    }

    const object = await this.library.instantiate(item.asset);
    const actor = new NpcActor({
      model,
      object,
      definition: {
        position: placement.position,
        rotationQuarterTurns: placement.rotationQuarterTurns
      }
    });
    actor.object.userData.editorPlacementId = placement.id;
    actor.setBusy(this.npcRuntimeState.get(placement.id)?.busy ?? false);
    return actor;
  }

  updatePlacement(placement) {
    const rendered = this.renderedPlacements.get(placement.id);
    if (!rendered) {
      return;
    }

    if (rendered.actor) {
      rendered.actor.applyPlacement({
        position: placement.position,
        rotationQuarterTurns: placement.rotationQuarterTurns
      });
    } else if (placement.layer === 'tile') {
      rendered.object.position.set(placement.cellX * BUILDER_TILE_SIZE, 0, placement.cellZ * BUILDER_TILE_SIZE);
    } else {
      rendered.object.position.set(placement.position[0], 0, placement.position[1]);
    }

    if (!rendered.actor) {
      rendered.object.rotation.y = toRotationY(placement.rotationQuarterTurns);
    }

    if (rendered.item.collision) {
      rendered.collisionBox = createCollisionBox(rendered.object, rendered.item.padding ?? 0.2);
    }
  }

  removePlacement(id) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.object.parent?.remove(rendered.object);
    this.renderedPlacements.delete(id);
  }

  getCollisionBoxes() {
    return [...this.renderedPlacements.values()]
      .map((placement) => placement.collisionBox)
      .filter(Boolean);
  }

  getGroundHeightAt(worldPosition, worldState) {
    let surfaceHeight = 0;

    for (const placement of worldState.getPlacements()) {
      if (placement.layer !== 'tile') {
        continue;
      }

      const rendered = this.renderedPlacements.get(placement.id);
      if (!rendered) {
        continue;
      }

      const bounds = new THREE.Box3().setFromObject(rendered.object);
      if (
        worldPosition.x >= bounds.min.x &&
        worldPosition.x <= bounds.max.x &&
        worldPosition.z >= bounds.min.z &&
        worldPosition.z <= bounds.max.z
      ) {
        surfaceHeight = Math.max(surfaceHeight, bounds.max.y);
      }
    }

    return surfaceHeight;
  }

  getInteractables(worldState) {
    return worldState.getPlacements()
      .filter((placement) => placement.interactable || placement.layer === 'npc')
      .map((placement) => {
        const rendered = this.renderedPlacements.get(placement.id);
        const item = getBuilderItemById(placement.itemId);
        if (!rendered || !item) {
          return null;
        }

        if (placement.layer === 'npc' && placement.npc) {
          const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            toRotationY(placement.rotationQuarterTurns)
          );
          const distance = item.interactionOffset ?? BUILDER_TILE_SIZE * 0.16;
          return {
            kind: 'npc',
            placementId: placement.id,
            npcId: placement.id,
            npc: { ...placement.npc },
            position: rendered.object.position.clone().addScaledVector(forward, distance),
            radius: placement.npc.interactRadius ?? item.interactionRadius ?? 4.2,
            prompt: `Talk to ${placement.npc.name}`,
            actionText: `Talk to ${placement.npc.name}`
          };
        }

        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          toRotationY(placement.rotationQuarterTurns)
        );
        const distance = placement.interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
        const position = rendered.object.position.clone().addScaledVector(forward, distance);

        return {
          kind: 'world',
          placementId: placement.id,
          position,
          radius: placement.interactable.radius ?? 4,
          prompt: placement.interactable.prompt ?? `Enter ${placement.interactable.label ?? item.label}`,
          actionText: placement.interactable.actionText ?? `${item.label} is not hooked up yet.`
        };
      })
      .filter(Boolean);
  }

  applyNpcRuntimeState(npcStateMap = new Map()) {
    this.npcRuntimeState = new Map(npcStateMap);

    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor) {
        continue;
      }
      rendered.actor.setBusy(this.npcRuntimeState.get(placementId)?.busy ?? false);
    }
  }

  pickPlacementId(pointer, camera = this.camera) {
    if (!this.propRoot.children.length) {
      return null;
    }

    this.raycaster.setFromCamera(pointer, camera);
    const intersections = this.raycaster.intersectObjects([...this.propRoot.children], true);
    return intersections.length ? extractPlacementId(intersections[0].object) : null;
  }

  getPlacementBounds(id) {
    const rendered = this.renderedPlacements.get(id);
    return rendered ? new THREE.Box3().setFromObject(rendered.object) : null;
  }
}
