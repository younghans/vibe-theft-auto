import * as THREE from 'three';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { NpcActor } from '../npc/NpcActor.js';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import { getTileCenterWorldPosition, getTileOccupiedCells } from '../shared/tileFootprint.js';
import { assets } from './assetManifest.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';
import { instantiateItemVisual, prepareItemVisual } from './itemVisuals.js';

function setShadowFlags(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

async function createPlacementVisual(library, item) {
  const visual = await instantiateItemVisual(library, item);
  prepareItemVisual(visual, (object) => {
    setShadowFlags(object);
  });
  return visual;
}

function createBoxCollider(object, padding = 0.2) {
  object.updateWorldMatrix(true, true);
  return {
    type: 'box',
    box: new THREE.Box3().setFromObject(object).expandByScalar(padding)
  };
}

function createBoxColliderFromBounds(minX, minZ, maxX, maxZ, minY = 0, maxY = 4) {
  return {
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    )
  };
}

function rotateLocalOffset(x, z, rotationQuarterTurns = 0) {
  switch (((rotationQuarterTurns % 4) + 4) % 4) {
    case 1:
      return { x: z, z: -x };
    case 2:
      return { x: -x, z: -z };
    case 3:
      return { x: -z, z: x };
    default:
      return { x, z };
  }
}

function cloneInteriorDefinition(interior) {
  if (!interior) {
    return null;
  }

  return {
    ...interior,
    exteriorDoorOffset: [...(interior.exteriorDoorOffset ?? [0, 0])],
    exteriorSpawnOffset: [...(interior.exteriorSpawnOffset ?? [0, 0])]
  };
}

function resolvePlacementInteractable(placement, item) {
  const baseInteractable = item?.interior
    ? {
        label: item.interior.label ?? item.label,
        prompt: item.interior.prompt ?? `Enter ${item.interior.label ?? item.label}`,
        actionText: item.interior.actionText ?? `Enter ${item.interior.label ?? item.label}.`,
        radius: item.interior.exteriorInteractRadius ?? 4.4,
        localOffset: [...(item.interior.exteriorDoorOffset ?? [0, 0])],
        interior: cloneInteriorDefinition(item.interior)
      }
    : null;

  if (!placement.interactable) {
    return baseInteractable;
  }

  const mergedInteractable = {
    ...(baseInteractable ?? {}),
    ...placement.interactable
  };

  if (baseInteractable?.interior || placement.interactable?.interior) {
    mergedInteractable.interior = {
      ...(baseInteractable?.interior ?? {}),
      ...(placement.interactable?.interior ?? {})
    };
  }

  if (Array.isArray(placement.interactable?.localOffset)) {
    mergedInteractable.localOffset = [...placement.interactable.localOffset];
  } else if (Array.isArray(baseInteractable?.localOffset)) {
    mergedInteractable.localOffset = [...baseInteractable.localOffset];
  }

  return mergedInteractable;
}

function getInteractableWorldPosition(rendered, placement, interactable, defaultDistance) {
  if (Array.isArray(interactable?.localOffset) && interactable.localOffset.length >= 2) {
    const rotatedOffset = rotateLocalOffset(
      Number(interactable.localOffset[0]) || 0,
      Number(interactable.localOffset[1]) || 0,
      placement.rotationQuarterTurns
    );
    return rendered.object.position.clone().add(new THREE.Vector3(rotatedOffset.x, 0, rotatedOffset.z));
  }

  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    toRotationY(placement.rotationQuarterTurns)
  );
  return rendered.object.position.clone().addScaledVector(forward, defaultDistance);
}

function createInlineShellEntry(rendered, placement, interactable) {
  if (!rendered || !placement || !interactable?.interior?.id) {
    return null;
  }

  const doorPosition = getInteractableWorldPosition(
    rendered,
    placement,
    {
      localOffset: [...(interactable.localOffset ?? interactable.interior.exteriorDoorOffset ?? [0, 0])]
    },
    BUILDER_TILE_SIZE * 0.44
  );

  return {
    placementId: placement.id,
    itemId: placement.itemId,
    rotationQuarterTurns: placement.rotationQuarterTurns,
    originPosition: rendered.object.position.clone(),
    doorPosition,
    interior: cloneInteriorDefinition(interactable.interior)
  };
}

function createColliderFromLocalRect(rect, placement, minY = 0, maxY = 4) {
  const rotationQuarterTurns = placement?.rotationQuarterTurns ?? 0;
  const rotatedCenter = rotateLocalOffset(rect.centerX ?? 0, rect.centerZ ?? 0, rotationQuarterTurns);
  const swapDimensions = Math.abs(rotationQuarterTurns % 2) === 1;
  const halfWidth = swapDimensions ? (rect.halfDepth ?? 0) : (rect.halfWidth ?? 0);
  const halfDepth = swapDimensions ? (rect.halfWidth ?? 0) : (rect.halfDepth ?? 0);
  const tileCenter = getTileCenterWorldPosition(
    getBuilderItemById(placement?.itemId),
    placement?.cellX ?? 0,
    placement?.cellZ ?? 0,
    0
  );
  const centerX = tileCenter.x + rotatedCenter.x;
  const centerZ = tileCenter.z + rotatedCenter.z;

  return createBoxColliderFromBounds(
    centerX - halfWidth,
    centerZ - halfDepth,
    centerX + halfWidth,
    centerZ + halfDepth,
    rect.minY ?? minY,
    rect.maxY ?? maxY
  );
}

function itemBlocksMovement(item) {
  if (!item) {
    return false;
  }

  if (typeof item.blocksMovement === 'boolean') {
    return item.blocksMovement;
  }

  return item.collision === true;
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

const PARK_WALL_COLLIDER_CELL_SIZE = 1;
const PARK_WALL_COLLIDER_MIN_Y = 1.1;
const PARK_WALL_COLLIDER_MAX_Y = 4.2;

function isParkWallItem(item) {
  return item?.layer === 'tile' && item.assetName?.startsWith('park_wall_');
}

function tileContainsPosition(rendered, x, z) {
  const occupiedCells = getTileOccupiedCells(
    rendered.item,
    rendered.placement?.cellX ?? 0,
    rendered.placement?.cellZ ?? 0,
    rendered.placement?.rotationQuarterTurns ?? 0
  );
  const halfTile = BUILDER_TILE_SIZE * 0.5;

  return occupiedCells.some((cell) => (
    x >= (cell.x * BUILDER_TILE_SIZE) - halfTile
    && x <= (cell.x * BUILDER_TILE_SIZE) + halfTile
    && z >= (cell.z * BUILDER_TILE_SIZE) - halfTile
    && z <= (cell.z * BUILDER_TILE_SIZE) + halfTile
  ));
}

function markParkWallTriangleCells(occupied, tileMinX, tileMinZ, minX, maxX, minZ, maxZ) {
  const gridSize = occupied.length;
  const startX = Math.max(0, Math.min(gridSize - 1, Math.floor(minX - tileMinX)));
  const endX = Math.max(0, Math.min(gridSize - 1, Math.ceil(maxX - tileMinX) - 1));
  const startZ = Math.max(0, Math.min(gridSize - 1, Math.floor(minZ - tileMinZ)));
  const endZ = Math.max(0, Math.min(gridSize - 1, Math.ceil(maxZ - tileMinZ) - 1));

  for (let z = startZ; z <= endZ; z += 1) {
    for (let x = startX; x <= endX; x += 1) {
      occupied[z][x] = true;
    }
  }
}

function buildParkWallColliders(object) {
  const tileHalf = BUILDER_TILE_SIZE * 0.5;
  const tileMinX = object.position.x - tileHalf;
  const tileMinZ = object.position.z - tileHalf;
  const tileMaxX = object.position.x + tileHalf;
  const tileMaxZ = object.position.z + tileHalf;
  const gridSize = Math.ceil(BUILDER_TILE_SIZE / PARK_WALL_COLLIDER_CELL_SIZE);
  const occupied = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  object.updateWorldMatrix(true, true);
  object.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    const position = node.geometry?.attributes?.position;
    if (!position) {
      return;
    }

    const index = node.geometry.index;
    const readIndex = (triangleIndex, offset) => index
      ? index.getX(triangleIndex * 3 + offset)
      : (triangleIndex * 3 + offset);
    const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      a.fromBufferAttribute(position, readIndex(triangleIndex, 0)).applyMatrix4(node.matrixWorld);
      b.fromBufferAttribute(position, readIndex(triangleIndex, 1)).applyMatrix4(node.matrixWorld);
      c.fromBufferAttribute(position, readIndex(triangleIndex, 2)).applyMatrix4(node.matrixWorld);

      const triangleMinY = Math.min(a.y, b.y, c.y);
      const triangleMaxY = Math.max(a.y, b.y, c.y);
      if (triangleMaxY < PARK_WALL_COLLIDER_MIN_Y || triangleMinY > PARK_WALL_COLLIDER_MAX_Y) {
        continue;
      }

      markParkWallTriangleCells(
        occupied,
        tileMinX,
        tileMinZ,
        Math.max(tileMinX, Math.min(a.x, b.x, c.x)),
        Math.min(tileMaxX, Math.max(a.x, b.x, c.x)),
        Math.max(tileMinZ, Math.min(a.z, b.z, c.z)),
        Math.min(tileMaxZ, Math.max(a.z, b.z, c.z))
      );
    }
  });

  const colliders = [];
  const consumed = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  for (let z = 0; z < gridSize; z += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!occupied[z][x] || consumed[z][x]) {
        continue;
      }

      let width = 1;
      while (x + width < gridSize && occupied[z][x + width] && !consumed[z][x + width]) {
        width += 1;
      }

      let height = 1;
      let canGrow = true;
      while (z + height < gridSize && canGrow) {
        for (let dx = 0; dx < width; dx += 1) {
          if (!occupied[z + height][x + dx] || consumed[z + height][x + dx]) {
            canGrow = false;
            break;
          }
        }
        if (canGrow) {
          height += 1;
        }
      }

      for (let dz = 0; dz < height; dz += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          consumed[z + dz][x + dx] = true;
        }
      }

      colliders.push(
        createBoxColliderFromBounds(
          tileMinX + (x * PARK_WALL_COLLIDER_CELL_SIZE),
          tileMinZ + (z * PARK_WALL_COLLIDER_CELL_SIZE),
          tileMinX + ((x + width) * PARK_WALL_COLLIDER_CELL_SIZE),
          tileMinZ + ((z + height) * PARK_WALL_COLLIDER_CELL_SIZE)
        )
      );
    }
  }

  return colliders;
}

function createPlacementColliders(object, item, placement, actor) {
  if (actor) {
    const collider = createNpcCollider(actor, placement);
    return collider ? [collider] : [];
  }

  if (item?.movementCollisionRects?.length && placement?.layer === 'tile') {
    return item.movementCollisionRects.map((rect) => createColliderFromLocalRect(rect, placement));
  }

  if (isParkWallItem(item)) {
    // Park-wall colliders must be generated from the tile root transform. For
    // tiles, `object` is often the primary mesh under a positioned root group.
    // Using the child mesh position here snaps collider bounds back toward the
    // origin even when the actual placement is far away.
    return buildParkWallColliders(object.parent ?? object);
  }

  if (itemBlocksMovement(item)) {
    return [createBoxCollider(object, item.padding ?? 0.2)];
  }

  return [];
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

      if (tileContainsPosition(rendered, x, z)) {
        surfaceHeight = Math.max(surfaceHeight, rendered.surfaceHeight ?? 0);
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
    const visual = actor ? null : await createPlacementVisual(this.library, item);
    const object = actor?.object ?? visual.root;
    const colliderObject = actor?.object ?? visual.colliderObject;

    if (!actor) {
      if (placement.layer === 'tile') {
        const center = getTileCenterWorldPosition(item, placement.cellX, placement.cellZ, placement.rotationQuarterTurns);
        object.position.set(center.x, 0, center.z);
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
      placement,
      object,
      actor,
      hidden: false,
      visualHidden: false,
      item,
      layer: placement.layer,
      surfaceHeight: placement.layer === 'tile'
        ? (item.surfaceHeight ?? 0)
        : null,
      colliderObject,
      colliders: createPlacementColliders(colliderObject, item, placement, actor)
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

    await preloadMixamoClips([assets.playerAnimationSet.idle]);
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

  update(deltaSeconds) {
    for (const rendered of this.renderedPlacements.values()) {
      rendered.actor?.update(deltaSeconds);
    }
  }

  updatePlacement(placement) {
    const rendered = this.renderedPlacements.get(placement.id);
    if (!rendered) {
      return;
    }

    rendered.placement = placement;
    rendered.surfaceHeight = placement.layer === 'tile'
      ? (rendered.item.surfaceHeight ?? 0)
      : null;

    if (rendered.actor) {
      rendered.actor.applyPlacement({
        position: placement.position,
        y: this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        rotationQuarterTurns: placement.rotationQuarterTurns,
        interactRadius: placement.npc?.interactRadius ?? rendered.item.interactionRadius
      });
    } else if (placement.layer === 'tile') {
      const center = getTileCenterWorldPosition(rendered.item, placement.cellX, placement.cellZ, placement.rotationQuarterTurns);
      rendered.object.position.set(center.x, 0, center.z);
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
      rendered.colliders = createPlacementColliders(rendered.object, rendered.item, placement, rendered.actor);
    } else {
      rendered.colliders = createPlacementColliders(rendered.colliderObject, rendered.item, placement, null);
    }
  }

  setPlacementHidden(id, hidden) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.hidden = Boolean(hidden);
    this.applyPlacementVisibility(rendered);
  }

  setPlacementVisualHidden(id, hidden) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.visualHidden = Boolean(hidden);
    this.applyPlacementVisibility(rendered);
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
      .filter((placement) => !placement.hidden)
      .flatMap((placement) => placement.colliders ?? [])
      .filter(Boolean);
  }

  getGroundHeightAt(worldPosition, worldState) {
    return this.getSurfaceHeightAtPosition(worldPosition.x, worldPosition.z);
  }

  getInteractables(worldState) {
    return worldState.getPlacements()
      .filter((placement) => {
        if (placement.layer === 'npc') {
          return true;
        }

        const item = getBuilderItemById(placement.itemId);
        return Boolean(placement.interactable || item?.interior);
      })
      .map((placement) => {
        const rendered = this.renderedPlacements.get(placement.id);
        const item = getBuilderItemById(placement.itemId);
        if (!rendered || rendered.hidden || !item) {
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

        const interactable = resolvePlacementInteractable(placement, item);
        if (!interactable) {
          return null;
        }

        if (interactable.interior?.mode === 'inline-shell') {
          return null;
        }

        const distance = interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
        const position = getInteractableWorldPosition(rendered, placement, interactable, distance);

        return {
          kind: 'world',
          placementId: placement.id,
          itemId: item.id,
          rotationQuarterTurns: placement.rotationQuarterTurns,
          originPosition: rendered.object.position.clone(),
          position,
          radius: interactable.radius ?? 4,
          prompt: interactable.prompt ?? `Enter ${interactable.label ?? item.label}`,
          actionText: interactable.actionText ?? `${item.label} is not hooked up yet.`,
          interior: cloneInteriorDefinition(interactable.interior)
        };
      })
      .filter(Boolean);
  }

  applyPlacementVisibility(rendered) {
    const visible = !rendered.hidden && !rendered.visualHidden;
    rendered.object.visible = visible;
    if (rendered.actor?.pickProxy) {
      rendered.actor.pickProxy.visible = visible;
    }
  }

  getInlineShellEntries(worldState) {
    return worldState.getPlacements()
      .map((placement) => {
        const rendered = this.renderedPlacements.get(placement.id);
        const item = getBuilderItemById(placement.itemId);
        if (!rendered || !item) {
          return null;
        }

        const interactable = resolvePlacementInteractable(placement, item);
        if (!interactable?.interior?.id || interactable.interior.mode !== 'inline-shell') {
          return null;
        }

        return createInlineShellEntry(rendered, placement, interactable);
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

  setVisible(visible) {
    const nextVisible = Boolean(visible);
    this.tileRoot.visible = nextVisible;
    this.propRoot.visible = nextVisible;
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
    if (!rendered || rendered.hidden) {
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
