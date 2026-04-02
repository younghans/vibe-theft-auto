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

function createBoxCollider(object, padding = 0.2) {
  return {
    type: 'box',
    box: new THREE.Box3().setFromObject(object).expandByScalar(padding)
  };
}

function createNpcCollider(actor, placement) {
  if (!actor || placement?.npc?.active === false) {
    return null;
  }

  return actor.getCollider();
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
    this.npcInteractRadiusVisible = false;
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

  syncNpcInteractRadiusIndicators(worldState, playerPosition = null) {
    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor) {
        continue;
      }

      const placement = worldState.getPlacement(placementId);
      const withinRadius = Boolean(
        playerPosition
        && placement?.layer === 'npc'
        && placement.npc?.active !== false
        && rendered.object.position.distanceTo(playerPosition) < (placement.npc?.interactRadius ?? rendered.item.interactionRadius ?? 4.2)
      );

      rendered.actor.setInteractRadiusVisible(this.npcInteractRadiusVisible || withinRadius);
    }
  }

  getSurfaceHeightAtPosition(x, z) {
    let surfaceHeight = 0;

    for (const rendered of this.renderedPlacements.values()) {
      if (rendered.layer !== 'tile') {
        continue;
      }

      const bounds = new THREE.Box3().setFromObject(rendered.object);
      if (x >= bounds.min.x && x <= bounds.max.x && z >= bounds.min.z && z <= bounds.max.z) {
        surfaceHeight = Math.max(surfaceHeight, bounds.max.y);
      }
    }

    return surfaceHeight;
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
        object.position.set(
          placement.position[0],
          this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
          placement.position[1]
        );
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
      collider: actor
        ? createNpcCollider(actor, placement)
        : (item.collision ? createBoxCollider(object, item.padding ?? 0.2) : null)
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
        y: this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        rotationQuarterTurns: placement.rotationQuarterTurns,
        interactRadius: placement.npc?.interactRadius ?? item.interactionRadius ?? model.interactionRadius
      }
    });
    actor.object.userData.editorPlacementId = placement.id;
    actor.pickProxy.userData.editorPlacementId = placement.id;
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
        y: this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        rotationQuarterTurns: placement.rotationQuarterTurns,
        interactRadius: placement.npc?.interactRadius ?? rendered.item.interactionRadius
      });
    } else if (placement.layer === 'tile') {
      rendered.object.position.set(placement.cellX * BUILDER_TILE_SIZE, 0, placement.cellZ * BUILDER_TILE_SIZE);
    } else {
      rendered.object.position.set(
        placement.position[0],
        this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        placement.position[1]
      );
    }

    if (!rendered.actor) {
      rendered.object.rotation.y = toRotationY(placement.rotationQuarterTurns);
    }

    if (rendered.actor) {
      rendered.collider = createNpcCollider(rendered.actor, placement);
    } else if (rendered.item.collision) {
      rendered.collider = createBoxCollider(rendered.object, rendered.item.padding ?? 0.2);
    } else {
      rendered.collider = null;
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

  getColliders() {
    return [...this.renderedPlacements.values()]
      .map((placement) => placement.collider)
      .filter(Boolean);
  }

  getGroundHeightAt(worldPosition, worldState) {
    return this.getSurfaceHeightAtPosition(worldPosition.x, worldPosition.z);
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
          if (placement.npc.active === false) {
            return null;
          }

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

  setNpcInteractRadiusVisible(visible) {
    this.npcInteractRadiusVisible = Boolean(visible);
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
    if (!rendered) {
      return null;
    }

    return new THREE.Box3().setFromObject(rendered.actor?.boundsObject ?? rendered.object);
  }

  getNpcSpeechAnchors() {
    const anchors = new Map();

    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor) {
        continue;
      }

      anchors.set(placementId, rendered.actor.getSpeechAnchorWorldPosition(new THREE.Vector3()));
    }

    return anchors;
  }
}
