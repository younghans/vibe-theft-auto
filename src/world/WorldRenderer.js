import * as THREE from 'three';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { NpcActor } from '../npc/NpcActor.js';
import { NPC_RUNTIME_MODES, NPC_STEP_TYPES } from '../npc/npcBehavior.js';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import { getTileCenterWorldPosition, getTileOccupiedCells } from '../shared/tileFootprint.js';
import { assets } from './assetManifest.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';
import { instantiateItemVisual, prepareItemVisual } from './itemVisuals.js';

const CAMERA_OCCLUDED_BUILDING_OPACITY = 0.1;
const CAMERA_OCCLUSION_PLAYER_HEIGHTS = Object.freeze([1.2, 2.7, 4.1]);
const CAMERA_OCCLUSION_TARGET_PADDING = 0.05;

function setShadowFlags(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.userData.defaultCastShadow = true;
      node.userData.defaultReceiveShadow = true;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function applyShadowOverridesToNode(node, rendered, visible) {
  if (!node.isMesh) {
    return;
  }

  const defaultCastShadow = node.userData.defaultCastShadow ?? true;
  const defaultReceiveShadow = node.userData.defaultReceiveShadow ?? true;
  const castShadow = rendered.shadowOverrides?.castShadow ?? defaultCastShadow;
  const receiveShadow = rendered.shadowOverrides?.receiveShadow ?? defaultReceiveShadow;

  node.castShadow = visible ? castShadow : false;
  node.receiveShadow = visible ? receiveShadow : false;
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

function boxHasFiniteExtents(box) {
  return Boolean(
    box
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z)
  );
}

function isCameraOccludingBuildingItem(item) {
  const assetName = String(item?.assetName ?? '').toLowerCase();
  const itemId = String(item?.id ?? '').toLowerCase();
  return Boolean(
    item?.layer === 'tile'
    && item.id !== 'lot_base'
    && (
      item.underlayTileId === 'lot_base'
      || itemId.startsWith('building_')
      || itemId.startsWith('kenney_building_')
      || assetName.startsWith('building_')
      || assetName.startsWith('kenney_building_')
      || assetName.includes('_building')
    )
  );
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
    cutawayNodeNames: [...(interior.cutawayNodeNames ?? [])],
    exteriorDoorOffset: [...(interior.exteriorDoorOffset ?? [0, 0])],
    exteriorSpawnOffset: [...(interior.exteriorSpawnOffset ?? [0, 0])]
  };
}

function createNpcDebugMarker(color, radius = 0.22) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false
    })
  );
  marker.visible = false;
  marker.renderOrder = 40;
  return marker;
}

function createNpcRoutineMarker(color, radius = 0.18) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false
    })
  );
  marker.visible = false;
  marker.renderOrder = 38;
  return marker;
}

function replaceLineGeometry(line, points = []) {
  if (!line) {
    return;
  }

  const nextPoints = points.length
    ? points
    : [new THREE.Vector3(0, -9999, 0), new THREE.Vector3(0, -9999, 0)];
  const nextGeometry = new THREE.BufferGeometry().setFromPoints(nextPoints);
  line.geometry.dispose();
  line.geometry = nextGeometry;
}

function getNpcRoutineStepColor(stepType = '', activePick = false) {
  if (activePick) {
    return 0xfff07a;
  }

  switch (stepType) {
    case NPC_STEP_TYPES.travelToPlacement:
      return 0x68d9ff;
    case NPC_STEP_TYPES.usePlacement:
      return 0xff9966;
    case NPC_STEP_TYPES.loiterNearPlacement:
      return 0x6cff95;
    case NPC_STEP_TYPES.enterHideAtPlacement:
      return 0xc08cff;
    case NPC_STEP_TYPES.wanderNearPlacement:
      return 0xff6b6b;
    default:
      return 0xffffff;
  }
}

function areDebugPointsClose(a, b, epsilon = 0.08) {
  if (!a || !b) {
    return false;
  }

  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.z ?? 0) - (b.z ?? 0)) <= epsilon;
}

function cloneInteractableDefinition(interactable) {
  if (!interactable) {
    return null;
  }

  return {
    ...interactable,
    localOffset: Array.isArray(interactable.localOffset) ? [...interactable.localOffset] : undefined,
    approachLocalOffset: Array.isArray(interactable.approachLocalOffset) ? [...interactable.approachLocalOffset] : undefined,
    interior: cloneInteriorDefinition(interactable.interior)
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
    : item?.interactable
      ? cloneInteractableDefinition(item.interactable)
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

  if (Array.isArray(placement.interactable?.approachLocalOffset)) {
    mergedInteractable.approachLocalOffset = [...placement.interactable.approachLocalOffset];
  } else if (Array.isArray(baseInteractable?.approachLocalOffset)) {
    mergedInteractable.approachLocalOffset = [...baseInteractable.approachLocalOffset];
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
  if (!actor || actor.runtimeState?.mode === NPC_RUNTIME_MODES.hidden || actor.runtimeState?.alive === false) {
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

function isNodeVisibleWithinRoot(node, root) {
  let current = node;
  while (current) {
    if (!current.visible) {
      return false;
    }

    if (current === root) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function collectMaterials(material) {
  return Array.isArray(material) ? material.filter(Boolean) : [material].filter(Boolean);
}

function cloneMaterialsForCameraOcclusion(root) {
  const materialStates = [];

  root?.traverse?.((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const sourceMaterials = collectMaterials(node.material);
    const clonedMaterials = sourceMaterials.map((material) => {
      const cloned = material.clone();
      materialStates.push({
        material: cloned,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite
      });
      return cloned;
    });

    node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
  });

  return {
    materialStates,
    occluded: false
  };
}

function getVisibleObjectBounds(root, bounds, nodeBounds) {
  bounds.makeEmpty();
  root?.updateWorldMatrix?.(true, true);

  root?.traverse?.((node) => {
    if (!node.isMesh || !node.geometry || !isNodeVisibleWithinRoot(node, root)) {
      return;
    }

    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }

    nodeBounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    if (boxHasFiniteExtents(nodeBounds)) {
      bounds.union(nodeBounds);
    }
  });

  return boxHasFiniteExtents(bounds) ? bounds : null;
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
    this.cameraOcclusionRaycaster = new THREE.Raycaster();
    this.cameraOcclusionTarget = new THREE.Vector3();
    this.cameraOcclusionDirection = new THREE.Vector3();
    this.cameraOcclusionBounds = new THREE.Box3();
    this.cameraOcclusionNodeBounds = new THREE.Box3();
    this.cameraOcclusionBoundsHit = new THREE.Vector3();
    this.cameraOccludedPlacementIds = new Set();

    this.tileRoot = new THREE.Group();
    this.propRoot = new THREE.Group();
    this.scene.add(this.tileRoot);
    this.scene.add(this.propRoot);

    this.npcDebugRoot = new THREE.Group();
    this.npcDebugRoot.visible = false;
    this.scene.add(this.npcDebugRoot);
    this.npcRoutineRoot = new THREE.Group();
    this.npcRoutineRoot.visible = false;
    this.scene.add(this.npcRoutineRoot);

    this.renderedPlacements = new Map();
    this.npcRuntimeState = new Map();
    this.npcFocusTargets = new Map();
    this.npcDebugState = new Map();
    this.playerState = new Map();
    this.localWorkoutState = {
      pendingPlacementId: '',
      claimedPlacementId: '',
      activePlacementId: ''
    };
    this.npcRoutinePreview = [];
    this.npcInteractRadiusVisible = false;
    this.npcDebugVisible = false;
    this.npcRoutineVisible = false;
    this.selectedNpcDebugId = '';
    this.npcDebugPathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x68d9ff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        depthTest: false
      })
    );
    this.npcDebugPathLine.frustumCulled = false;
    this.npcDebugPathLine.renderOrder = 36;
    this.npcDebugSteeringMarker = createNpcDebugMarker(0xffd166, 0.18);
    this.npcDebugNextMarker = createNpcDebugMarker(0x68d9ff, 0.2);
    this.npcDebugTargetMarker = createNpcDebugMarker(0xff6b6b, 0.24);
    this.npcDebugApproachMarker = createNpcDebugMarker(0x6cff95, 0.18);
    this.npcDebugRoot.add(this.npcDebugPathLine);
    this.npcDebugRoot.add(this.npcDebugSteeringMarker);
    this.npcDebugRoot.add(this.npcDebugNextMarker);
    this.npcDebugRoot.add(this.npcDebugTargetMarker);
    this.npcDebugRoot.add(this.npcDebugApproachMarker);
  }

  async syncFromState(worldState) {
    this.clear();

    for (const placement of worldState.getPlacements()) {
      await this.addPlacement(placement);
    }
  }

  clear() {
    this.clearCameraOcclusion();
    for (const rendered of this.renderedPlacements.values()) {
      rendered.object.parent?.remove(rendered.object);
    }
    this.renderedPlacements.clear();
    this.tileRoot.clear();
    this.propRoot.clear();
    this.refreshNpcRoutinePreview();
    this.refreshNpcDebugGizmos();
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
      cameraOcclusionObject: actor ? null : visual.colliderObject,
      cameraOcclusionMaterialState: null,
      actor,
      hidden: false,
      visualHidden: false,
      workoutHidden: false,
      hiddenNodeNames: new Set(),
      shadowOverrides: null,
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

    this.refreshWorkoutPlacementState();

    return renderedPlacement;
  }

  async createNpcActor(placement, item) {
    const model = getNpcModelByItemId(item.id);
    if (!model) {
      return null;
    }

    await preloadMixamoClips([
      assets.playerAnimationSet.idle,
      assets.playerAnimationSet.walking,
      assets.playerAnimationSet.slowRun,
      assets.playerAnimationSet.fastRun,
      assets.playerAnimationSet.fightingIdle,
      assets.playerAnimationSet.punching,
      assets.playerAnimationSet.snatch
    ]);
    const object = await this.library.instantiate(item.asset);
    const actor = new NpcActor({
      model,
      object,
      definition: {
        position: placement.position,
        y: this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        rotationQuarterTurns: placement.rotationQuarterTurns,
        interactRadius: placement.npc?.interactRadius ?? item.interactionRadius ?? model.interactionRadius,
        speed: placement.npc?.speed
      }
    });
    actor.object.userData.editorPlacementId = placement.id;
    actor.pickProxy.userData.editorPlacementId = placement.id;
    actor.setBusy(this.npcRuntimeState.get(placement.id)?.busy ?? false);
    actor.setFocusTarget(this.npcFocusTargets.get(placement.id) ?? null);
    const runtimeState = this.npcRuntimeState.get(placement.id);
    if (runtimeState) {
      actor.setRuntimeState(runtimeState, this.getSurfaceHeightAtPosition(runtimeState.x ?? placement.position[0], runtimeState.z ?? placement.position[1]));
    }
    return actor;
  }

  update(deltaSeconds) {
    for (const rendered of this.renderedPlacements.values()) {
      rendered.actor?.update(deltaSeconds);
    }

    this.refreshNpcDebugGizmos();
  }

  isPlacementVisibleForCameraOcclusion(rendered) {
    return Boolean(
      rendered
      && this.tileRoot.visible
      && isCameraOccludingBuildingItem(rendered.item)
      && !rendered.hidden
      && !rendered.visualHidden
      && !rendered.workoutHidden
      && rendered.object.visible
      && rendered.cameraOcclusionObject
    );
  }

  getCameraOcclusionCandidates() {
    const candidates = [];

    for (const rendered of this.renderedPlacements.values()) {
      if (this.isPlacementVisibleForCameraOcclusion(rendered)) {
        candidates.push(rendered);
      }
    }

    return candidates;
  }

  setPlacementCameraOccluded(rendered, occluded) {
    const nextOccluded = Boolean(occluded);
    if (!rendered?.cameraOcclusionObject) {
      return;
    }

    if (!rendered.cameraOcclusionMaterialState && !nextOccluded) {
      return;
    }

    rendered.cameraOcclusionMaterialState ??= cloneMaterialsForCameraOcclusion(rendered.cameraOcclusionObject);
    const materialState = rendered.cameraOcclusionMaterialState;
    if (materialState.occluded === nextOccluded) {
      return;
    }

    materialState.occluded = nextOccluded;
    for (const entry of materialState.materialStates) {
      entry.material.transparent = nextOccluded ? true : entry.transparent;
      entry.material.depthWrite = nextOccluded ? false : entry.depthWrite;
      entry.material.opacity = nextOccluded
        ? Math.min(entry.opacity ?? 1, CAMERA_OCCLUDED_BUILDING_OPACITY)
        : entry.opacity;
      entry.material.needsUpdate = true;
    }
  }

  syncCameraOccludedPlacementIds(nextOccludedPlacementIds) {
    for (const placementId of [...this.cameraOccludedPlacementIds]) {
      if (nextOccludedPlacementIds.has(placementId)) {
        continue;
      }

      const rendered = this.renderedPlacements.get(placementId);
      this.setPlacementCameraOccluded(rendered, false);
      this.cameraOccludedPlacementIds.delete(placementId);
    }

    for (const placementId of nextOccludedPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!this.isPlacementVisibleForCameraOcclusion(rendered)) {
        continue;
      }

      this.setPlacementCameraOccluded(rendered, true);
      this.cameraOccludedPlacementIds.add(placementId);
    }
  }

  clearCameraOcclusion() {
    this.syncCameraOccludedPlacementIds(new Set());
  }

  updateCameraOcclusion(camera = this.camera, playerPosition = null) {
    if (!camera || !playerPosition || !this.tileRoot.visible) {
      this.clearCameraOcclusion();
      return;
    }

    const baseX = playerPosition.x ?? 0;
    const baseY = playerPosition.y ?? 0;
    const baseZ = playerPosition.z ?? 0;
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY) || !Number.isFinite(baseZ)) {
      this.clearCameraOcclusion();
      return;
    }

    const candidates = this.getCameraOcclusionCandidates();
    if (!candidates.length) {
      this.clearCameraOcclusion();
      return;
    }

    const nextOccludedPlacementIds = new Set();
    this.cameraOcclusionRaycaster.near = 0;

    for (const height of CAMERA_OCCLUSION_PLAYER_HEIGHTS) {
      this.cameraOcclusionTarget.set(baseX, baseY + height, baseZ);
      this.cameraOcclusionDirection.subVectors(this.cameraOcclusionTarget, camera.position);
      const distance = this.cameraOcclusionDirection.length();
      if (distance <= CAMERA_OCCLUSION_TARGET_PADDING) {
        continue;
      }

      this.cameraOcclusionDirection.multiplyScalar(1 / distance);
      this.cameraOcclusionRaycaster.set(camera.position, this.cameraOcclusionDirection);
      this.cameraOcclusionRaycaster.far = Math.max(0, distance - CAMERA_OCCLUSION_TARGET_PADDING);

      for (const rendered of candidates) {
        if (nextOccludedPlacementIds.has(rendered.id)) {
          continue;
        }

        const bounds = getVisibleObjectBounds(
          rendered.cameraOcclusionObject,
          this.cameraOcclusionBounds,
          this.cameraOcclusionNodeBounds
        );
        if (!bounds) {
          continue;
        }

        const hit = this.cameraOcclusionRaycaster.ray.intersectBox(
          bounds,
          this.cameraOcclusionBoundsHit
        );
        if (
          hit
          && hit.distanceTo(camera.position) <= this.cameraOcclusionRaycaster.far
        ) {
          nextOccludedPlacementIds.add(rendered.id);
        }
      }
    }

    this.syncCameraOccludedPlacementIds(nextOccludedPlacementIds);
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
        interactRadius: placement.npc?.interactRadius ?? rendered.item.interactionRadius,
        speed: placement.npc?.speed
      });
      const runtimeState = this.npcRuntimeState.get(placement.id);
      if (runtimeState) {
        rendered.actor.setRuntimeState(
          runtimeState,
          this.getSurfaceHeightAtPosition(runtimeState.x ?? placement.position[0], runtimeState.z ?? placement.position[1])
        );
      }
      rendered.actor.setFocusTarget(this.npcFocusTargets.get(placement.id) ?? null);
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

    this.refreshWorkoutPlacementState();
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

  setPlacementHiddenNodeNames(id, nodeNames = []) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.hiddenNodeNames = new Set((nodeNames ?? []).filter(Boolean));
    this.applyPlacementVisibility(rendered);
  }

  setPlacementShadowOverrides(id, overrides = null) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.shadowOverrides = overrides
      ? {
          castShadow: overrides.castShadow,
          receiveShadow: overrides.receiveShadow
        }
      : null;
    this.applyPlacementVisibility(rendered);
  }

  removePlacement(id) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    this.setPlacementCameraOccluded(rendered, false);
    this.cameraOccludedPlacementIds.delete(id);
    rendered.object.parent?.remove(rendered.object);
    this.renderedPlacements.delete(id);
    this.refreshWorkoutPlacementState();
    this.refreshNpcRoutinePreview();
    this.refreshNpcDebugGizmos();
  }

  getColliders() {
    return [...this.renderedPlacements.values()]
      .filter((placement) => !placement.hidden)
      .flatMap((placement) => {
        if (placement.actor) {
          const collider = createNpcCollider(placement.actor, placement.placement);
          return collider ? [collider] : [];
        }

        return placement.colliders ?? [];
      })
      .filter(Boolean);
  }

  getGroundHeightAt(worldPosition, worldState) {
    return this.getSurfaceHeightAtPosition(worldPosition.x, worldPosition.z);
  }

  getOccupiedWorkoutPlacementIds(worldState) {
    const occupiedPlacementIds = new Set();

    for (const npcState of this.npcRuntimeState.values()) {
      if (
        !npcState
        || npcState.alive === false
        || npcState.mode === NPC_RUNTIME_MODES.hidden
        || !npcState.targetPlacementId
        || typeof npcState.activity !== 'string'
        || !npcState.activity
      ) {
        continue;
      }

      const renderedTarget = this.renderedPlacements.get(npcState.targetPlacementId);
      const placement = renderedTarget?.placement ?? worldState?.getPlacement?.(npcState.targetPlacementId);
      const item = renderedTarget?.item ?? getBuilderItemById(placement?.itemId);
      const interactable = placement && item ? resolvePlacementInteractable(placement, item) : null;
      if (interactable?.workoutType && interactable.workoutType === npcState.activity) {
        occupiedPlacementIds.add(npcState.targetPlacementId);
      }
    }

    for (const playerState of this.playerState.values()) {
      if (playerState?.alive === false || !playerState?.workoutPlacementId) {
        continue;
      }

      occupiedPlacementIds.add(playerState.workoutPlacementId);
    }

    if (this.localWorkoutState.pendingPlacementId) {
      occupiedPlacementIds.add(this.localWorkoutState.pendingPlacementId);
    }
    if (this.localWorkoutState.claimedPlacementId) {
      occupiedPlacementIds.add(this.localWorkoutState.claimedPlacementId);
    }

    return occupiedPlacementIds;
  }

  getVisibleWorkoutPlacementIds(worldState) {
    const visiblePlacementIds = new Set();

    for (const npcState of this.npcRuntimeState.values()) {
      if (
        !npcState
        || npcState.alive === false
        || npcState.mode === NPC_RUNTIME_MODES.hidden
        || !npcState.targetPlacementId
        || typeof npcState.activity !== 'string'
        || !npcState.activity
      ) {
        continue;
      }

      const renderedTarget = this.renderedPlacements.get(npcState.targetPlacementId);
      const placement = renderedTarget?.placement ?? worldState?.getPlacement?.(npcState.targetPlacementId);
      const item = renderedTarget?.item ?? getBuilderItemById(placement?.itemId);
      const interactable = placement && item ? resolvePlacementInteractable(placement, item) : null;
      if (interactable?.workoutType && interactable.workoutType === npcState.activity) {
        visiblePlacementIds.add(npcState.targetPlacementId);
      }
    }

    for (const playerState of this.playerState.values()) {
      if (
        playerState?.alive === false
        || !playerState?.workoutPlacementId
        || !playerState?.emoteActive
        || !playerState?.emoteId
      ) {
        continue;
      }

      const placementId = playerState.workoutPlacementId;
      const renderedTarget = this.renderedPlacements.get(placementId);
      const placement = renderedTarget?.placement ?? worldState?.getPlacement?.(placementId);
      const item = renderedTarget?.item ?? getBuilderItemById(placement?.itemId);
      const interactable = placement && item ? resolvePlacementInteractable(placement, item) : null;
      if (interactable?.workoutType && interactable.workoutType === playerState.emoteId) {
        visiblePlacementIds.add(placementId);
      }
    }

    if (this.localWorkoutState.activePlacementId) {
      visiblePlacementIds.add(this.localWorkoutState.activePlacementId);
    }

    return visiblePlacementIds;
  }

  getInteractables(worldState) {
    const occupiedWorkoutPlacementIds = this.getOccupiedWorkoutPlacementIds(worldState);

    return worldState.getPlacements()
      .filter((placement) => {
        if (placement.layer === 'npc') {
          return true;
        }

        const item = getBuilderItemById(placement.itemId);
        return Boolean(placement.interactable || item?.interior || item?.interactable);
      })
      .map((placement) => {
        const rendered = this.renderedPlacements.get(placement.id);
        const item = getBuilderItemById(placement.itemId);
        if (!rendered || rendered.hidden || !item) {
          return null;
        }

        if (placement.layer === 'npc' && placement.npc) {
          const runtimeState = this.npcRuntimeState.get(placement.id);
          if (runtimeState?.mode === NPC_RUNTIME_MODES.hidden || runtimeState?.alive === false) {
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
            originPosition: rendered.object.position.clone(),
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

        if (['inline-shell', 'inline-cutaway'].includes(interactable.interior?.mode)) {
          return null;
        }

        const distance = interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
        const position = getInteractableWorldPosition(rendered, placement, interactable, distance);
        const approachPosition = Array.isArray(interactable.approachLocalOffset)
          ? getInteractableWorldPosition(
            rendered,
            placement,
            { localOffset: interactable.approachLocalOffset },
            distance
          )
          : null;
        const workoutKind = interactable.workoutType ? `${interactable.workoutType}-workout` : 'world';
        const workoutBusy = Boolean(
          interactable.workoutType
          && occupiedWorkoutPlacementIds.has(placement.id)
        );
        const defaultLabel = interactable.label ?? item.label ?? 'Workout station';
        const prompt = workoutBusy
          ? `${defaultLabel} in use`
          : (interactable.prompt ?? `Enter ${interactable.label ?? item.label}`);
        const actionText = workoutBusy
          ? `Wait until ${defaultLabel.toLowerCase()} is free.`
          : (interactable.actionText ?? `${item.label} is not hooked up yet.`);

        return {
          kind: workoutKind,
          placementId: placement.id,
          itemId: item.id,
          rotationQuarterTurns: placement.rotationQuarterTurns,
          originPosition: rendered.object.position.clone(),
          position,
          radius: interactable.radius ?? 4,
          prompt,
          actionText,
          busy: workoutBusy,
          interior: cloneInteriorDefinition(interactable.interior),
          approachPosition,
          approachRotationY: Number.isFinite(interactable.approachRotationY)
            ? toRotationY(placement.rotationQuarterTurns) + interactable.approachRotationY
            : undefined,
          barbellObject: interactable.workoutType ? rendered.object : null
        };
      })
      .filter(Boolean);
  }

  applyPlacementVisibility(rendered) {
    const visible = !rendered.hidden && !rendered.visualHidden && !rendered.workoutHidden;
    rendered.object.visible = visible;
    rendered.object.traverse((node) => {
      const nodeHidden = [...(rendered.hiddenNodeNames ?? [])]
        .some((pattern) => node.name === pattern || node.name.startsWith(`${pattern}_`));
      const nodeVisible = visible && !nodeHidden;
      if (node !== rendered.object) {
        node.visible = !nodeHidden;
      }
      applyShadowOverridesToNode(node, rendered, nodeVisible);
    });
    if (rendered.actor?.pickProxy) {
      rendered.actor.pickProxy.visible = visible;
    }
  }

  refreshWorkoutPlacementState(worldState = null) {
    const resolvedWorldState = worldState ?? {
      getPlacement: (placementId) => this.renderedPlacements.get(placementId)?.placement ?? null
    };
    const visibleWorkoutPlacementIds = this.getVisibleWorkoutPlacementIds(resolvedWorldState);
    for (const rendered of this.renderedPlacements.values()) {
      const nextWorkoutHidden = visibleWorkoutPlacementIds.has(rendered.id);
      if (rendered.workoutHidden === nextWorkoutHidden) {
        continue;
      }

      rendered.workoutHidden = nextWorkoutHidden;
      this.applyPlacementVisibility(rendered);
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
        if (
          !interactable?.interior?.id
          || !['inline-shell', 'inline-cutaway'].includes(interactable.interior.mode)
        ) {
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
      const runtimeState = this.npcRuntimeState.get(placementId) ?? {};
      rendered.actor.setBusy(runtimeState.busy ?? false);
      rendered.actor.setFocusTarget(this.npcFocusTargets.get(placementId) ?? null);
      rendered.actor.setRuntimeState(
        runtimeState,
        this.getSurfaceHeightAtPosition(
          runtimeState.x ?? rendered.placement.position?.[0] ?? rendered.object.position.x,
          runtimeState.z ?? rendered.placement.position?.[1] ?? rendered.object.position.z
        )
      );
    }

    this.refreshWorkoutPlacementState();
    this.refreshNpcDebugGizmos();
  }

  applyPlayerWorkoutState(
    playerStateMap = new Map(),
    {
      pendingPlacementId = '',
      claimedPlacementId = '',
      activePlacementId = ''
    } = {}
  ) {
    this.playerState = new Map(playerStateMap);
    this.localWorkoutState = {
      pendingPlacementId: typeof pendingPlacementId === 'string' ? pendingPlacementId : '',
      claimedPlacementId: typeof claimedPlacementId === 'string' ? claimedPlacementId : '',
      activePlacementId: typeof activePlacementId === 'string' ? activePlacementId : ''
    };
    this.refreshWorkoutPlacementState();
  }

  applyNpcFocusTargets(npcFocusTargets = new Map()) {
    this.npcFocusTargets = new Map(
      [...npcFocusTargets.entries()]
        .filter(([, target]) => target && Number.isFinite(target.x) && Number.isFinite(target.z))
        .map(([npcId, target]) => [npcId, { x: Number(target.x), z: Number(target.z) }])
    );

    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor) {
        continue;
      }

      rendered.actor.setFocusTarget(this.npcFocusTargets.get(placementId) ?? null);
    }
  }

  applyNpcDebugState(npcDebugMap = new Map()) {
    this.npcDebugState = new Map(npcDebugMap);
    this.refreshNpcDebugGizmos();
  }

  setNpcRoutinePreview(preview = [], { visible = true } = {}) {
    this.npcRoutinePreview = Array.isArray(preview)
      ? preview.map((entry) => ({
          ...entry,
          point: entry?.point ? { ...entry.point } : null,
          originPoint: entry?.originPoint ? { ...entry.originPoint } : null
        }))
      : [];
    this.npcRoutineVisible = Boolean(visible);
    this.refreshNpcRoutinePreview();
  }

  setNpcDebugSelection(placementId = '', { visible = true } = {}) {
    this.selectedNpcDebugId = placementId || '';
    this.npcDebugVisible = Boolean(visible && placementId);
    this.refreshNpcDebugGizmos();
  }

  setNpcInteractRadiusVisible(visible) {
    this.npcInteractRadiusVisible = Boolean(visible);
  }

  setVisible(visible) {
    const nextVisible = Boolean(visible);
    if (!nextVisible) {
      this.clearCameraOcclusion();
    }
    this.tileRoot.visible = nextVisible;
    this.propRoot.visible = nextVisible;
    this.npcDebugRoot.visible = nextVisible && this.npcDebugVisible;
    this.npcRoutineRoot.visible = nextVisible && this.npcRoutineVisible;
  }

  pickPlacementId(pointer, camera = this.camera) {
    const pickTargets = [];

    for (const rendered of this.renderedPlacements.values()) {
      if (rendered.hidden || rendered.visualHidden || rendered.placement?.layer === 'tile') {
        continue;
      }

      if (rendered.actor?.pickProxy) {
        pickTargets.push(rendered.actor.pickProxy);
        continue;
      }

      if (rendered.object) {
        pickTargets.push(rendered.object);
      }
    }

    if (!pickTargets.length) {
      return null;
    }

    this.raycaster.setFromCamera(pointer, camera);
    const intersections = this.raycaster.intersectObjects(pickTargets, true);
    return intersections.length ? extractPlacementId(intersections[0].object) : null;
  }

  getPlacementBounds(id) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered || rendered.hidden) {
      return null;
    }

    if (rendered.actor?.getSelectionBounds) {
      const actorBounds = rendered.actor.getSelectionBounds();
      if (boxHasFiniteExtents(actorBounds)) {
        return actorBounds;
      }
    }

    const objectBounds = new THREE.Box3().setFromObject(rendered.actor?.boundsObject ?? rendered.object);
    return boxHasFiniteExtents(objectBounds)
      ? objectBounds
      : null;
  }

  getNpcSpeechAnchors() {
    const anchors = new Map();

    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor || rendered.actor.runtimeState?.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      anchors.set(placementId, rendered.actor.getSpeechAnchorWorldPosition(new THREE.Vector3()));
    }

    return anchors;
  }

  triggerNpcDamageFeedback(npcId, options = {}) {
    this.renderedPlacements.get(npcId)?.actor?.triggerDamageFeedback?.(options);
  }

  toNpcDebugWorldPoint(point = null, elevation = 0.24) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
      return null;
    }

    return new THREE.Vector3(
      point.x,
      this.getSurfaceHeightAtPosition(point.x, point.z) + elevation,
      point.z
    );
  }

  setNpcDebugMarkerPosition(marker, point, elevation = 0.24) {
    const worldPoint = this.toNpcDebugWorldPoint(point, elevation);
    if (!marker) {
      return;
    }

    if (!worldPoint) {
      marker.visible = false;
      return;
    }

    marker.position.copy(worldPoint);
    marker.visible = true;
  }

  refreshNpcRoutinePreview() {
    this.npcRoutineRoot.clear();

    if (!this.npcRoutineVisible || !this.tileRoot.visible || !this.npcRoutinePreview.length) {
      this.npcRoutineRoot.visible = false;
      return;
    }

    this.npcRoutineRoot.visible = true;

    this.npcRoutinePreview.forEach((entry, index) => {
      if (!entry?.point) {
        return;
      }

      const marker = createNpcRoutineMarker(getNpcRoutineStepColor(entry.stepType, entry.activePick), 0.17);
      const worldPoint = this.toNpcDebugWorldPoint(entry.point, 0.26 + (index * 0.08));
      if (!worldPoint) {
        return;
      }

      marker.position.copy(worldPoint);
      marker.visible = true;
      this.npcRoutineRoot.add(marker);

      if (entry.originPoint && !areDebugPointsClose(entry.originPoint, entry.point, 0.2)) {
        const originWorldPoint = this.toNpcDebugWorldPoint(entry.originPoint, 0.08);
        if (originWorldPoint) {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([originWorldPoint, worldPoint]),
            new THREE.LineBasicMaterial({
              color: getNpcRoutineStepColor(entry.stepType, entry.activePick),
              transparent: true,
              opacity: 0.35,
              depthWrite: false,
              depthTest: false
            })
          );
          line.frustumCulled = false;
          line.renderOrder = 37;
          this.npcRoutineRoot.add(line);
        }
      }
    });
  }

  refreshNpcDebugGizmos() {
    const placementId = this.selectedNpcDebugId;
    const rendered = placementId ? this.renderedPlacements.get(placementId) : null;
    const debug = placementId ? this.npcDebugState.get(placementId) : null;
    const runtime = placementId ? this.npcRuntimeState.get(placementId) : null;
    const actorPosition = rendered?.actor
      ? {
          x: runtime?.x ?? rendered.object.position.x,
          z: runtime?.z ?? rendered.object.position.z
        }
      : null;

    if (!this.npcDebugVisible || !placementId || !rendered || !debug || !actorPosition) {
      this.npcDebugRoot.visible = false;
      this.npcDebugSteeringMarker.visible = false;
      this.npcDebugNextMarker.visible = false;
      this.npcDebugTargetMarker.visible = false;
      this.npcDebugApproachMarker.visible = false;
      replaceLineGeometry(this.npcDebugPathLine, []);
      return;
    }

    const pathPoints = [];
    const pushPoint = (point) => {
      if (!point) {
        return;
      }

      if (pathPoints.length && areDebugPointsClose(pathPoints[pathPoints.length - 1], point)) {
        return;
      }

      pathPoints.push({ x: point.x, z: point.z });
    };

    pushPoint(actorPosition);
    pushPoint(debug.steeringTarget);
    pushPoint(debug.nextPathPoint);
    for (const point of debug.path?.slice(Math.max(0, debug.pathIndex ?? 0)) ?? []) {
      pushPoint(point);
    }
    pushPoint(debug.finalTarget);

    const worldPoints = pathPoints
      .map((point, index) => this.toNpcDebugWorldPoint(point, index === 0 ? 0.34 : 0.22))
      .filter(Boolean);

    replaceLineGeometry(this.npcDebugPathLine, worldPoints);
    this.npcDebugRoot.visible = this.tileRoot.visible && this.npcDebugVisible;
    this.setNpcDebugMarkerPosition(this.npcDebugSteeringMarker, debug.steeringTarget, 0.3);
    this.setNpcDebugMarkerPosition(this.npcDebugNextMarker, debug.nextPathPoint, 0.26);
    this.setNpcDebugMarkerPosition(this.npcDebugTargetMarker, debug.finalTarget, 0.34);
    this.setNpcDebugMarkerPosition(this.npcDebugApproachMarker, debug.targetApproach, 0.24);
  }
}
