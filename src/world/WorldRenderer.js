import * as THREE from 'three';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { NpcActor } from '../npc/NpcActor.js';
import { NPC_RUNTIME_MODES, NPC_STEP_TYPES } from '../npc/npcBehavior.js';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import {
  getTileCenterWorldPosition,
  getTileOccupiedCells,
  rotateFootprintOffset as rotateLocalOffset
} from '../shared/tileFootprint.js';
import { getPlacementScale } from '../shared/placementScale.js';
import { rotationQuarterTurnsToRadians as toRotationY } from '../shared/numberMath.js';
import { assets } from './assetManifest.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';
import {
  cloneGarageDoorDefinition,
  cloneInteriorDefinition,
  clonePortalDefinition,
  resolvePlacementInteractableDefinition
} from './interactableMetadata.js';
import {
  addInteractableIndicatorToObject,
  formatInteractableIndicatorText
} from './interactableIndicators.js';
import { instantiateItemVisual, prepareItemVisual } from './itemVisuals.js';
import {
  PASSIVE_TRAFFIC_CAR_ITEM_IDS,
  PASSIVE_TRAFFIC_CAR_SCALE,
  PASSIVE_TRAFFIC_MIN_ROAD_NODES,
  PASSIVE_TRAFFIC_SPEED,
  buildPassiveTrafficRoadGraph,
  findPassiveTrafficPath,
  getPassiveTrafficLanePosition,
  getPassiveTrafficLanePositionAtNode,
  getPassiveTrafficTurnLaneWaypoints
} from './passiveTraffic.js';

const CAMERA_OCCLUDED_BUILDING_OPACITY = 0;
const CAMERA_OCCLUSION_PLAYER_HEIGHTS = Object.freeze([1.2, 2.7, 4.1]);
const CAMERA_OCCLUSION_TARGET_PADDING = 0.05;
const SOLID_COLOR_BUILDING_ASSET_NAMES = new Set([
  'bar_building',
  'bar_building_wide',
  'bank_building',
  'casino_building',
  'gym_building',
  'gym_building_large',
  'offices_building',
  'police_station_building',
  'school_building'
]);
const SOLID_COLOR_BUILDING_DETAIL_NAME_PARTS = Object.freeze([
  'exterior_detail',
  'cutaway_tower',
  'cutaway_upper',
  'cutaway_corner'
]);
const SOLID_COLOR_BUILDING_GLASS_COLORS = new Set([
  0x586f73,
  0x5d6e73,
  0x6c6a8a,
  0x6f9bb4,
  0x6f9eb7,
  0x789eb2,
  0x84b5c9,
  0x9bd7e6,
  0xb7dce8,
  0xbfdfe8,
  0xbfe4ef,
  0xc7f3fb,
  0xd29f56,
  0xd2aa44,
  0xdcc76a,
  0xe0c172
]);
const NPC_CORE_ANIMATION_CLIPS = Object.freeze([
  assets.playerAnimationSet.idle,
  assets.playerAnimationSet.walking,
  assets.playerAnimationSet.slowRun,
  assets.playerAnimationSet.fastRun,
  assets.playerAnimationSet.fightingIdle,
  assets.playerAnimationSet.punching,
  assets.playerAnimationSet.snatch
]);
const PASSIVE_TRAFFIC_TURN_RESPONSE = 8.5;
const PASSIVE_TRAFFIC_ACCEL_RESPONSE = 5.5;
const PASSIVE_TRAFFIC_BRAKE_RESPONSE = 14;
const PASSIVE_TRAFFIC_TURN_SPEED_FACTOR = 0.58;
const PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE = BUILDER_TILE_SIZE * 0.55;
const PASSIVE_TRAFFIC_TURN_STOP_SECONDS = 0.38;
const PASSIVE_TRAFFIC_TURN_STOP_STEP_SECONDS = 0.06;
const PASSIVE_TRAFFIC_SPEED_FACTORS = Object.freeze([0.94, 1, 1.06]);
const PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT = 14;
const PASSIVE_TRAFFIC_POSITION_EPSILON = 0.08;
const PASSIVE_TRAFFIC_INTERSECTION_ITEM_PATTERN = /(?:road_cross|road_junction|road_tsplit)/;

function getCellKey(cellX, cellZ) {
  return `${cellX}:${cellZ}`;
}

function normalizeAngleRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function dampAngleRadians(current, target, lambda, deltaSeconds) {
  const lerp = 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, deltaSeconds));
  return normalizeAngleRadians(current + (normalizeAngleRadians(target - current) * lerp));
}

function dampNumber(current, target, lambda, deltaSeconds) {
  const lerp = 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, deltaSeconds));
  return current + ((target - current) * lerp);
}

function passiveTrafficTieBreak(nodeIndex, carIndex) {
  const x = Math.sin(((nodeIndex + 1) * 12.9898) + ((carIndex + 1) * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

function getPassiveTrafficNodeStep(fromNode, toNode) {
  const deltaX = (toNode?.cellX ?? 0) - (fromNode?.cellX ?? 0);
  const deltaZ = (toNode?.cellZ ?? 0) - (fromNode?.cellZ ?? 0);
  return {
    x: Math.sign(deltaX),
    z: Math.sign(deltaZ)
  };
}

function isPassiveTrafficIntersectionNode(node) {
  return Boolean(
    node
    && (
      (node.neighbors?.length ?? 0) >= 3
      || PASSIVE_TRAFFIC_INTERSECTION_ITEM_PATTERN.test(String(node.itemId ?? ''))
    )
  );
}

function isPassiveTrafficTurningThroughNode(previousNode, currentNode, nextNode) {
  if (!previousNode || !currentNode || !nextNode) {
    return false;
  }

  const incoming = getPassiveTrafficNodeStep(previousNode, currentNode);
  const outgoing = getPassiveTrafficNodeStep(currentNode, nextNode);
  if (
    (incoming.x === 0 && incoming.z === 0)
    || (outgoing.x === 0 && outgoing.z === 0)
  ) {
    return false;
  }

  return ((incoming.x * outgoing.x) + (incoming.z * outgoing.z)) < 1;
}

function shouldPassiveTrafficStopForTurn(previousNode, currentNode, nextNode) {
  return isPassiveTrafficIntersectionNode(currentNode)
    && isPassiveTrafficTurningThroughNode(previousNode, currentNode, nextNode);
}

function worldToCellCoord(value) {
  return Math.round((Number(value) || 0) / BUILDER_TILE_SIZE);
}

function collectItemAssetUrls(item, output = new Set()) {
  if (!item) {
    return output;
  }

  if (typeof item.asset === 'string' && item.asset) {
    output.add(item.asset);
  }

  if (item.layer === 'tile' && item.underlayTileId) {
    collectItemAssetUrls(getBuilderItemById(item.underlayTileId), output);
  }

  return output;
}

function shouldStabilizeSolidBuildingColors(item) {
  return SOLID_COLOR_BUILDING_ASSET_NAMES.has(String(item?.assetName ?? item?.id ?? '').toLowerCase());
}

function nodeNameIncludesAny(node, root, fragments) {
  let current = node;
  while (current && current !== root.parent) {
    const name = String(current.name ?? '').toLowerCase();
    if (fragments.some((fragment) => name.includes(fragment))) {
      return true;
    }
    if (current === root) {
      break;
    }
    current = current.parent;
  }
  return false;
}

function getMaterialColorHex(material) {
  return material?.color?.isColor ? material.color.getHex() : null;
}

function stabilizeSolidBuildingMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const decorativeNode = nodeNameIncludesAny(node, root, SOLID_COLOR_BUILDING_DETAIL_NAME_PARTS);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      const colorHex = getMaterialColorHex(material);
      const glassLike = colorHex !== null && SOLID_COLOR_BUILDING_GLASS_COLORS.has(colorHex);
      if (!decorativeNode && !glassLike) {
        continue;
      }

      material.polygonOffset = true;
      material.polygonOffsetFactor = -0.35;
      material.polygonOffsetUnits = glassLike ? -8 : -3;
      material.needsUpdate = true;
    }
  });
}

function setShadowFlags(root, options = {}) {
  const receiveShadow = options.receiveShadow !== false;
  root.traverse((node) => {
    if (node.isMesh) {
      node.userData.defaultCastShadow = true;
      node.userData.defaultReceiveShadow = receiveShadow;
      node.castShadow = true;
      node.receiveShadow = receiveShadow;
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
  prepareItemVisual(visual, (object, part) => {
    const stabilizeSolidColors = shouldStabilizeSolidBuildingColors(part?.item ?? item);
    setShadowFlags(object, {
      receiveShadow: !stabilizeSolidColors
    });
    if (stabilizeSolidColors) {
      stabilizeSolidBuildingMaterials(object);
    }
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

function getReusableVector(value) {
  return value?.isVector3 ? value : new THREE.Vector3();
}

function syncPlainObject(target, source = {}) {
  for (const key of Object.keys(target)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      delete target[key];
    }
  }
  Object.assign(target, source);
  return target;
}

function getPlacementRotationY(placement) {
  const rotationY = Number(placement?.rotationY);
  return Number.isFinite(rotationY)
    ? rotationY
    : toRotationY(placement?.rotationQuarterTurns ?? 0);
}

function getCachedInteractable(cache, key) {
  let interactable = cache.get(key);
  if (!interactable) {
    interactable = {};
    cache.set(key, interactable);
  }
  return interactable;
}

function getPlacementOffsetWorldPosition(rendered, placement, localOffset = null, target = new THREE.Vector3()) {
  if (Array.isArray(localOffset) && localOffset.length >= 2) {
    const scale = getPlacementScale(placement);
    const rotatedOffset = rotateLocalOffset(
      (Number(localOffset[0]) || 0) * scale,
      (Number(localOffset[1]) || 0) * scale,
      placement.rotationQuarterTurns
    );
    const position = target.copy(rendered.object.position);
    position.x += rotatedOffset.x;
    position.z += rotatedOffset.z;
    return position;
  }

  return null;
}

function getInteractableWorldPosition(rendered, placement, interactable, defaultDistance, target = new THREE.Vector3()) {
  const offsetPosition = getPlacementOffsetWorldPosition(rendered, placement, interactable?.localOffset, target);
  if (offsetPosition) {
    return offsetPosition;
  }

  const rotationY = toRotationY(placement.rotationQuarterTurns);
  const scale = getPlacementScale(placement);
  const position = target.copy(rendered.object.position);
  position.x += Math.sin(rotationY) * defaultDistance * scale;
  position.z += Math.cos(rotationY) * defaultDistance * scale;
  return position;
}

function createPortalInteractable(rendered, placement, item, interactable, target = {}) {
  const portal = clonePortalDefinition(interactable?.portal);
  if (!portal) {
    return null;
  }

  const distance = interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
  const position = getInteractableWorldPosition(
    rendered,
    placement,
    interactable,
    distance,
    getReusableVector(target.position)
  );
  const triggerPosition = getReusableVector(target.triggerPosition);
  if (!getPlacementOffsetWorldPosition(rendered, placement, portal.triggerLocalOffset, triggerPosition)) {
    triggerPosition.copy(rendered.object.position);
  }
  const spawnPosition = getReusableVector(target.spawnPosition);
  if (!getPlacementOffsetWorldPosition(rendered, placement, portal.spawnLocalOffset, spawnPosition)) {
    spawnPosition.copy(rendered.object.position);
  }

  target.kind = 'portal';
  target.placementId = placement.id;
  target.itemId = item.id;
  target.rotationQuarterTurns = placement.rotationQuarterTurns;
  target.originPosition = getReusableVector(target.originPosition).copy(rendered.object.position);
  target.position = position;
  target.radius = interactable.radius ?? 4;
  target.prompt = interactable.prompt ?? `Enter ${interactable.label ?? item.label}`;
  target.actionText = interactable.actionText ?? `${interactable.label ?? item.label} is shimmering nearby.`;
  target.portalRole = portal.role ?? '';
  target.targetUrl = portal.destinationUrl ?? '';
  target.portal = portal;
  target.triggerPosition = triggerPosition;
  target.triggerRadius = Number.isFinite(portal.triggerRadius) ? portal.triggerRadius : 2.2;
  target.triggerHalfHeight = Number.isFinite(portal.triggerHalfHeight) ? portal.triggerHalfHeight : 4.5;
  target.spawnPosition = spawnPosition;
  target.spawnRotationY = toRotationY(placement.rotationQuarterTurns)
    + (Number.isFinite(portal.spawnRotationOffsetY) ? portal.spawnRotationOffsetY : Math.PI);
  return target;
}

function createInlineShellEntry(rendered, placement, interactable) {
  if (!rendered || !placement || !interactable?.interior?.id) {
    return null;
  }

  const doorPosition = getInteractableWorldPosition(
    rendered,
    placement,
    {
      localOffset: interactable.localOffset ?? interactable.interior.exteriorDoorOffset ?? [0, 0]
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

function getNpcInteractableIndicatorText(placement) {
  const npc = placement?.npc ?? null;
  if (!npc) {
    return '';
  }

  if (npc.deliveryQuestEnabled === true) {
    return 'Delivery job';
  }
  if (npc.gymCheckInEnabled === true) {
    return 'Buy gym membership';
  }
  if (npc.stockMarketEnabled === true) {
    return 'Trade stocks';
  }
  if (npc.blackjackDealerEnabled === true) {
    return 'Play blackjack';
  }
  if (npc.schoolMicrogameEnabled === true) {
    return 'Play school challenge';
  }
  if (npc.bartenderEnabled === true) {
    return 'Order drinks';
  }
  if (npc.pawnShopOwnerEnabled === true) {
    return 'Browse pawn shop';
  }
  if (npc.carDealerEnabled === true) {
    return 'Browse cars';
  }
  if (npc.marthaEnabled === true) {
    return 'Order food';
  }

  return '';
}

function getPlacementInteractableIndicatorText(placement, item) {
  if (!placement) {
    return '';
  }

  if (placement.layer === 'npc') {
    return formatInteractableIndicatorText(getNpcInteractableIndicatorText(placement));
  }

  if (placement.layer !== 'prop') {
    return '';
  }

  const interactable = resolvePlacementInteractableDefinition(placement, item);
  if (!interactable || interactable.portal) {
    return '';
  }

  return formatInteractableIndicatorText(
    interactable.indicatorText
    ?? interactable.prompt
    ?? interactable.label
    ?? item?.label
  );
}

function createColliderFromLocalRect(rect, placement, item = null, minY = 0, maxY = 4) {
  const rotationQuarterTurns = placement?.rotationQuarterTurns ?? 0;
  const scale = getPlacementScale(placement);
  const rotatedCenter = rotateLocalOffset(
    (rect.centerX ?? 0) * scale,
    (rect.centerZ ?? 0) * scale,
    rotationQuarterTurns
  );
  const swapDimensions = Math.abs(rotationQuarterTurns % 2) === 1;
  const halfWidth = (swapDimensions ? (rect.halfDepth ?? 0) : (rect.halfWidth ?? 0)) * scale;
  const halfDepth = (swapDimensions ? (rect.halfWidth ?? 0) : (rect.halfDepth ?? 0)) * scale;
  const isTilePlacement = placement?.layer === 'tile';
  const tileCenter = isTilePlacement
    ? getTileCenterWorldPosition(
        item ?? getBuilderItemById(placement?.itemId),
        placement?.cellX ?? 0,
        placement?.cellZ ?? 0,
        0
      )
    : null;
  const centerX = isTilePlacement
    ? tileCenter.x + rotatedCenter.x
    : (placement?.position?.[0] ?? 0) + rotatedCenter.x;
  const centerZ = isTilePlacement
    ? tileCenter.z + rotatedCenter.z
    : (placement?.position?.[1] ?? 0) + rotatedCenter.z;

  return createBoxColliderFromBounds(
    centerX - halfWidth,
    centerZ - halfDepth,
    centerX + halfWidth,
    centerZ + halfDepth,
    (rect.minY ?? minY) * scale,
    (rect.maxY ?? maxY) * scale
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

function nodeNameMatches(node, nodeNames = new Set()) {
  for (const pattern of nodeNames ?? []) {
    if (node.name === pattern || node.name.startsWith(`${pattern}_`)) {
      return true;
    }
  }
  return false;
}

function nodeOrAncestorNameMatches(node, nodeNames = new Set(), root = null) {
  let current = node;
  while (current) {
    if (nodeNameMatches(current, nodeNames)) {
      return true;
    }

    if (current === root) {
      break;
    }

    current = current.parent;
  }

  return false;
}

function nodeOrDescendantNameMatches(node, nodeNames = new Set()) {
  if (nodeNameMatches(node, nodeNames)) {
    return true;
  }

  let matched = false;
  node.traverse?.((child) => {
    if (matched || child === node) {
      return;
    }
    if (nodeNameMatches(child, nodeNames)) {
      matched = true;
    }
  });
  return matched;
}

function nodeWithinVisibleNameFilter(node, nodeNames = new Set(), root = null) {
  return nodeOrAncestorNameMatches(node, nodeNames, root)
    || nodeOrDescendantNameMatches(node, nodeNames);
}

function nodeNameSetsEqual(a = new Set(), b = new Set()) {
  if ((a?.size ?? 0) !== (b?.size ?? 0)) {
    return false;
  }

  for (const value of a ?? []) {
    if (!b.has(value)) {
      return false;
    }
  }

  return true;
}

function normalizeNodeNameSet(nodeNames = []) {
  if (!nodeNames) {
    return new Set();
  }

  const values = typeof nodeNames === 'string' ? [nodeNames] : Array.from(nodeNames);
  return new Set(values.filter(Boolean));
}

function hasNodeNameEntries(nodeNames = null) {
  if (!nodeNames) {
    return false;
  }

  if (typeof nodeNames === 'string') {
    return Boolean(nodeNames);
  }

  if (typeof nodeNames[Symbol.iterator] !== 'function') {
    return false;
  }

  for (const nodeName of nodeNames) {
    if (nodeName) {
      return true;
    }
  }

  return false;
}

function normalizeOpacity(opacity = 1) {
  const numericOpacity = Number(opacity);
  return Number.isFinite(numericOpacity)
    ? THREE.MathUtils.clamp(numericOpacity, 0, 1)
    : 1;
}

function normalizeShadowOverrides(overrides = null) {
  return overrides
    ? {
        castShadow: overrides.castShadow,
        receiveShadow: overrides.receiveShadow
      }
    : null;
}

function shadowOverridesEqual(a = null, b = null) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.castShadow === b.castShadow
    && a.receiveShadow === b.receiveShadow;
}

function cloneMaterialsForNodeFade(root) {
  const materialStates = new Map();

  root?.traverse?.((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const sourceMaterials = collectMaterials(node.material);
    const clonedMaterials = sourceMaterials.map((material) => {
      const cloned = material.clone();
      materialStates.set(cloned, {
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
    active: false
  };
}

function restoreNodeFadeMaterials(rendered) {
  const state = rendered?.nodeFadeMaterialState;
  if (!state?.active) {
    return;
  }

  for (const entry of state.materialStates.values()) {
    entry.material.opacity = entry.opacity;
    entry.material.transparent = entry.transparent;
    entry.material.depthWrite = entry.depthWrite;
    entry.material.needsUpdate = true;
  }
  state.active = false;
}

function cloneMaterialsForCameraOcclusion(root, {
  cloneMaterials = true,
  preservedNodeNames = new Set()
} = {}) {
  const materialStates = [];
  const preservedNames = new Set(Array.from(preservedNodeNames ?? []).filter(Boolean));

  root?.traverse?.((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const sourceMaterials = collectMaterials(node.material);
    const nodePreserved = nodeOrAncestorNameMatches(node, preservedNames, root);
    if (!cloneMaterials) {
      if (nodePreserved) {
        return;
      }

      for (const material of sourceMaterials) {
        materialStates.push({
          material,
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite
        });
      }
      return;
    }

    const clonedMaterials = sourceMaterials.map((material) => {
      const cloned = material.clone();
      if (!nodePreserved) {
        materialStates.push({
          material: cloned,
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite
        });
      }
      return cloned;
    });

    node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
  });

  return {
    materialStates,
    occluded: false,
    preservedNodeNames: preservedNames
  };
}

function restoreCameraOcclusionMaterials(rendered) {
  const state = rendered?.cameraOcclusionMaterialState;
  if (!state) {
    return;
  }

  for (const entry of state.materialStates) {
    entry.material.opacity = entry.opacity;
    entry.material.transparent = entry.transparent;
    entry.material.depthWrite = entry.depthWrite;
    entry.material.needsUpdate = true;
  }

  rendered.cameraOcclusionMaterialState = null;
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

  if (item?.movementCollisionRects?.length) {
    return item.movementCollisionRects.map((rect) => createColliderFromLocalRect(rect, placement, item));
  }

  if (isParkWallItem(item)) {
    // Park-wall colliders must be generated from the tile root transform. For
    // tiles, `object` is often the primary mesh under a positioned root group.
    // Using the child mesh position here snaps collider bounds back toward the
    // origin even when the actual placement is far away.
    return buildParkWallColliders(object.parent ?? object);
  }

  if (itemBlocksMovement(item)) {
    return [createBoxCollider(object, (item.padding ?? 0.2) * getPlacementScale(placement))];
  }

  return [];
}

function applyRenderedPlacementScale(rendered, placement) {
  if (!rendered?.object || rendered.actor) {
    return;
  }

  const baseScale = rendered.baseObjectScale ?? rendered.object.scale;
  rendered.object.scale.copy(baseScale).multiplyScalar(getPlacementScale(placement));
  rendered.object.updateWorldMatrix(true, true);
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
    this.cameraOcclusionCandidates = [];
    this.cameraOcclusionIdsToClear = [];
    this.nextCameraOccludedPlacementIds = new Set();
    this.excludedCameraOcclusionPlacementIds = new Set();
    this.preserveInteriorNodePlacementIds = new Set();
    this.emptyCameraOcclusionPlacementIds = new Set();
    this.emptyCameraOcclusionNodeNames = new Set();

    this.tileRoot = new THREE.Group();
    this.propRoot = new THREE.Group();
    this.passiveTrafficRoot = new THREE.Group();
    this.passiveTrafficRoot.name = 'PassiveTrafficRoot';
    this.scene.add(this.tileRoot);
    this.scene.add(this.propRoot);
    this.scene.add(this.passiveTrafficRoot);

    this.npcDebugRoot = new THREE.Group();
    this.npcDebugRoot.visible = false;
    this.scene.add(this.npcDebugRoot);
    this.npcRoutineRoot = new THREE.Group();
    this.npcRoutineRoot.visible = false;
    this.scene.add(this.npcRoutineRoot);

    this.renderedPlacements = new Map();
    this.actorPlacementIds = new Set();
    this.staticColliderEntries = new Map();
    this.visibleStaticColliders = [];
    this.staticCollidersDirty = true;
    this.surfaceHeightByCell = new Map();
    this.surfaceHeightIndexDirty = true;
    this.npcRuntimeState = new Map();
    this.npcFocusTargets = new Map();
    this.npcDebugState = new Map();
    this.npcSpeechAnchors = new Map();
    this.npcSpeechAnchorVectors = new Map();
    this.interactableCache = new Map();
    this.activeInteractableCacheKeys = new Set();
    this.occupiedWorkoutPlacementIds = new Set();
    this.visibleWorkoutPlacementIds = new Set();
    this.playerState = new Map();
    this.localWorkoutState = {
      pendingPlacementId: '',
      claimedPlacementId: '',
      activePlacementId: ''
    };
    this.npcRoutinePreview = [];
    this.passiveTrafficCars = [];
    this.passiveTrafficGraph = null;
    this.passiveTrafficSignature = '';
    this.passiveTrafficVisitCounter = 0;
    this.passiveTrafficNodeVisits = new Map();
    this.passiveTrafficNodeVisitOrder = new Map();
    this.passiveTrafficScratch = new THREE.Vector3();
    this.passiveTrafficTargetScratch = new THREE.Vector3();
    this.passiveTrafficRefreshSuspended = false;
    this.passiveTrafficLoadRequestId = 0;
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
    const placements = [...worldState.getPlacements()];
    await this.preloadPlacementAssets(placements);

    this.passiveTrafficRefreshSuspended = true;
    try {
      for (const placement of placements) {
        await this.addPlacement(placement);
      }
    } finally {
      this.passiveTrafficRefreshSuspended = false;
    }
    this.refreshPassiveTraffic();
  }

  clear() {
    this.clearCameraOcclusion();
    this.clearPassiveTraffic();
    for (const rendered of this.renderedPlacements.values()) {
      rendered.object.parent?.remove(rendered.object);
    }
    this.renderedPlacements.clear();
    this.actorPlacementIds.clear();
    this.staticColliderEntries.clear();
    this.interactableCache.clear();
    this.activeInteractableCacheKeys.clear();
    this.visibleStaticColliders = [];
    this.staticCollidersDirty = true;
    this.surfaceHeightByCell.clear();
    this.surfaceHeightIndexDirty = true;
    this.tileRoot.clear();
    this.propRoot.clear();
    this.passiveTrafficRoot.clear();
    this.refreshNpcRoutinePreview();
    this.refreshNpcDebugGizmos();
  }

  async preloadPlacementAssets(placements = []) {
    const modelUrls = new Set();
    let hasNpc = false;

    for (const placement of placements) {
      const item = getBuilderItemById(placement.itemId);
      collectItemAssetUrls(item, modelUrls);
      hasNpc = hasNpc || placement.layer === 'npc';
    }

    await Promise.all([
      this.library.preload([...modelUrls]),
      hasNpc ? preloadMixamoClips(NPC_CORE_ANIMATION_CLIPS) : Promise.resolve()
    ]);
  }

  markStaticCollidersDirty() {
    this.staticCollidersDirty = true;
  }

  refreshStaticColliderEntry(rendered) {
    if (!rendered || rendered.actor) {
      return;
    }

    if (rendered.colliders?.length) {
      this.staticColliderEntries.set(rendered.id, rendered.colliders);
    } else {
      this.staticColliderEntries.delete(rendered.id);
    }
    this.markStaticCollidersDirty();
  }

  getVisibleStaticColliders() {
    if (!this.staticCollidersDirty) {
      return this.visibleStaticColliders;
    }

    const colliders = [];
    for (const [placementId, entryColliders] of this.staticColliderEntries.entries()) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered || rendered.hidden) {
        continue;
      }
      colliders.push(...entryColliders);
    }

    this.visibleStaticColliders = colliders;
    this.staticCollidersDirty = false;
    return this.visibleStaticColliders;
  }

  markSurfaceHeightIndexDirty() {
    this.surfaceHeightIndexDirty = true;
  }

  rebuildSurfaceHeightIndex() {
    this.surfaceHeightByCell.clear();

    for (const rendered of this.renderedPlacements.values()) {
      if (rendered.layer !== 'tile') {
        continue;
      }

      const surfaceHeight = rendered.surfaceHeight ?? 0;
      for (const cell of getTileOccupiedCells(
        rendered.item,
        rendered.placement?.cellX ?? 0,
        rendered.placement?.cellZ ?? 0,
        rendered.placement?.rotationQuarterTurns ?? 0
      )) {
        const key = getCellKey(cell.x, cell.z);
        this.surfaceHeightByCell.set(
          key,
          Math.max(this.surfaceHeightByCell.get(key) ?? 0, surfaceHeight)
        );
      }
    }

    this.surfaceHeightIndexDirty = false;
  }

  ensureSurfaceHeightIndex() {
    if (this.surfaceHeightIndexDirty) {
      this.rebuildSurfaceHeightIndex();
    }
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
    this.ensureSurfaceHeightIndex();
    return this.surfaceHeightByCell.get(getCellKey(worldToCellCoord(x), worldToCellCoord(z))) ?? 0;
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
      object.rotation.y = getPlacementRotationY(placement);
    }

    object.userData.editorPlacementId = placement.id;

    const renderedPlacement = {
      id: placement.id,
      placement,
      object,
      baseObjectScale: object.scale.clone(),
      cameraOcclusionObject: actor ? null : visual.colliderObject,
      cameraOcclusionMaterialState: null,
      actor,
      hidden: false,
      visualHidden: false,
      workoutHidden: false,
      hiddenNodeNames: new Set(),
      fadedNodeNames: new Set(),
      fadedNodeOpacity: 1,
      visibleNodeNames: new Set(),
      nodeFadeMaterialState: null,
      shadowOverrides: null,
      item,
      layer: placement.layer,
      surfaceHeight: placement.layer === 'tile'
        ? (item.surfaceHeight ?? 0)
        : null,
      colliderObject,
      colliders: []
    };
    applyRenderedPlacementScale(renderedPlacement, placement);
    renderedPlacement.colliders = createPlacementColliders(colliderObject, item, placement, actor);

    this.renderedPlacements.set(placement.id, renderedPlacement);
    this.syncPlacementInteractableIndicator(renderedPlacement);
    if (actor) {
      this.actorPlacementIds.add(placement.id);
    } else {
      this.refreshStaticColliderEntry(renderedPlacement);
    }
    if (placement.layer === 'tile') {
      this.markSurfaceHeightIndexDirty();
    }
    if (placement.layer === 'tile') {
      this.tileRoot.add(object);
    } else {
      this.propRoot.add(object);
    }

    this.refreshWorkoutPlacementState();
    if (placement.layer === 'tile') {
      this.refreshPassiveTraffic();
    }

    return renderedPlacement;
  }

  syncPlacementInteractableIndicator(rendered) {
    if (!rendered) {
      return;
    }

    const indicatorText = getPlacementInteractableIndicatorText(rendered.placement, rendered.item);
    const existingIndicator = rendered.interactableIndicator ?? null;
    if (existingIndicator?.userData?.indicatorText === indicatorText) {
      return;
    }

    if (existingIndicator) {
      existingIndicator.parent?.remove(existingIndicator);
      rendered.interactableIndicator = null;
    }

    if (!indicatorText) {
      return;
    }

    const indicatorOptions = {
      indicatorHeight: 0.07
    };
    if (rendered.actor) {
      indicatorOptions.localPosition = [
        0,
        Math.max(2.6, Number(rendered.actor.model?.height ?? 1.8) + 1.25),
        0
      ];
      indicatorOptions.preserveWorldScale = false;
    }

    rendered.interactableIndicator = addInteractableIndicatorToObject(
      rendered.object,
      indicatorText,
      indicatorOptions
    );
  }

  updateInteractableIndicatorVisibility(resolver = null) {
    const hasResolver = typeof resolver === 'function';
    const worldPosition = this.indicatorVisibilityPosition ?? new THREE.Vector3();
    this.indicatorVisibilityPosition = worldPosition;

    for (const rendered of this.renderedPlacements.values()) {
      if (!rendered?.interactableIndicator) {
        continue;
      }

      let visible = !rendered.hidden && !rendered.visualHidden && !rendered.workoutHidden;
      if (visible && rendered.actor) {
        visible = rendered.actor.runtimeState?.mode !== NPC_RUNTIME_MODES.hidden
          && rendered.actor.runtimeState?.mode !== NPC_RUNTIME_MODES.dead
          && rendered.actor.runtimeState?.alive !== false;
      }
      if (visible && hasResolver) {
        rendered.object.getWorldPosition(worldPosition);
        visible = resolver(rendered, worldPosition) !== false;
      }
      rendered.interactableIndicator.visible = visible;
    }
  }

  async createNpcActor(placement, item) {
    const model = getNpcModelByItemId(item.id);
    if (!model) {
      return null;
    }

    await preloadMixamoClips(NPC_CORE_ANIMATION_CLIPS);
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

  removePassiveTrafficCars() {
    for (const car of this.passiveTrafficCars) {
      car.object?.parent?.remove(car.object);
    }
    this.passiveTrafficCars = [];
    this.passiveTrafficRoot.clear();
  }

  clearPassiveTraffic() {
    this.passiveTrafficLoadRequestId += 1;
    this.removePassiveTrafficCars();
    this.passiveTrafficGraph = null;
    this.passiveTrafficSignature = '';
    this.passiveTrafficVisitCounter = 0;
    this.passiveTrafficNodeVisits.clear();
    this.passiveTrafficNodeVisitOrder.clear();
  }

  refreshPassiveTraffic() {
    if (this.passiveTrafficRefreshSuspended) {
      return;
    }

    const graph = buildPassiveTrafficRoadGraph(this.renderedPlacements);
    const hasTrafficRoads = graph.activeNodeIndices.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES;
    const nextSignature = hasTrafficRoads ? graph.signature : '';
    if (
      nextSignature === this.passiveTrafficSignature
      && this.passiveTrafficCars.length === PASSIVE_TRAFFIC_CAR_ITEM_IDS.length
    ) {
      return;
    }

    const requestId = ++this.passiveTrafficLoadRequestId;
    this.removePassiveTrafficCars();
    this.passiveTrafficGraph = hasTrafficRoads ? graph : null;
    this.passiveTrafficSignature = nextSignature;
    this.passiveTrafficVisitCounter = 0;
    this.passiveTrafficNodeVisits.clear();
    this.passiveTrafficNodeVisitOrder.clear();

    if (!hasTrafficRoads) {
      return;
    }

    void this.createPassiveTrafficCars(requestId, graph);
  }

  async createPassiveTrafficObject(itemId, carIndex) {
    const item = getBuilderItemById(itemId);
    if (!item) {
      return null;
    }

    const visual = await createPlacementVisual(this.library, item);
    const object = visual.root;
    object.name = `PassiveTraffic:${itemId}`;
    object.userData.passiveTraffic = true;
    object.userData.passiveTrafficItemId = itemId;
    object.userData.passiveTrafficIndex = carIndex;
    object.scale.multiplyScalar(PASSIVE_TRAFFIC_CAR_SCALE);
    object.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
      }
    });
    return object;
  }

  async createPassiveTrafficCars(requestId, graph) {
    const cars = await Promise.all(PASSIVE_TRAFFIC_CAR_ITEM_IDS.map(async (itemId, carIndex) => {
      try {
        const object = await this.createPassiveTrafficObject(itemId, carIndex);
        return object ? this.createPassiveTrafficCarState(object, itemId, carIndex, graph) : null;
      } catch (error) {
        console.warn('[WorldRenderer] Failed to create passive traffic car.', {
          itemId,
          error
        });
        return null;
      }
    }));

    if (requestId !== this.passiveTrafficLoadRequestId || graph.signature !== this.passiveTrafficSignature) {
      for (const car of cars) {
        car?.object?.parent?.remove(car.object);
      }
      return;
    }

    this.passiveTrafficCars = cars.filter(Boolean);
    for (const car of this.passiveTrafficCars) {
      this.passiveTrafficRoot.add(car.object);
    }
  }

  createPassiveTrafficCarState(object, itemId, carIndex, graph) {
    const activeNodeIndices = graph?.activeNodeIndices ?? [];
    if (activeNodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return null;
    }

    const activeComponents = graph.activeComponents?.length ? graph.activeComponents : [activeNodeIndices];
    const startComponent = activeComponents[carIndex % activeComponents.length] ?? activeNodeIndices;
    const componentCarSlot = Math.floor(carIndex / Math.max(1, activeComponents.length));
    const componentCarCount = Math.max(1, Math.ceil(PASSIVE_TRAFFIC_CAR_ITEM_IDS.length / Math.max(1, activeComponents.length)));
    const startOffset = (componentCarSlot + 0.18) / componentCarCount;
    const startIndex = startComponent[Math.floor(startOffset * startComponent.length) % startComponent.length];
    const car = {
      itemId,
      carIndex,
      object,
      currentNodeIndex: startIndex,
      previousNodeIndex: null,
      targetNodeIndex: null,
      route: [],
      routeCursor: 0,
      targetPosition: new THREE.Vector3(),
      finalTargetPosition: new THREE.Vector3(),
      routeDestinationIndex: null,
      routeAdvanceCount: 1,
      turnThroughNodeIndex: null,
      speed: PASSIVE_TRAFFIC_SPEED * (PASSIVE_TRAFFIC_SPEED_FACTORS[carIndex % PASSIVE_TRAFFIC_SPEED_FACTORS.length] ?? 1),
      currentSpeed: 0,
      yaw: object.rotation.y,
      turnStopSeconds: 0,
      turnWaypointActive: false,
      turnWaypointQueue: []
    };

    this.markPassiveTrafficNodeVisited(startIndex);
    this.assignPassiveTrafficRoute(car);
    if (car.targetNodeIndex === null) {
      return null;
    }

    const currentNode = graph.nodes[car.currentNodeIndex];
    const targetNode = graph.nodes[car.targetNodeIndex];
    getPassiveTrafficLanePositionAtNode(currentNode, targetNode, object.position);
    object.position.y = this.getSurfaceHeightAtPosition(object.position.x, object.position.z);
    car.yaw = Math.atan2(
      (targetNode?.x ?? currentNode.x) - currentNode.x,
      (targetNode?.z ?? currentNode.z) - currentNode.z
    );
    object.rotation.y = car.yaw;
    return car;
  }

  markPassiveTrafficNodeVisited(nodeIndex) {
    this.passiveTrafficVisitCounter += 1;
    this.passiveTrafficNodeVisits.set(
      nodeIndex,
      (this.passiveTrafficNodeVisits.get(nodeIndex) ?? 0) + 1
    );
    this.passiveTrafficNodeVisitOrder.set(nodeIndex, this.passiveTrafficVisitCounter);
  }

  getPassiveTrafficActiveNeighbors(nodeIndex) {
    const graph = this.passiveTrafficGraph;
    const node = graph?.nodes?.[nodeIndex];
    if (!node) {
      return [];
    }

    return node.neighbors.filter((neighborIndex) => graph.activeNodeSet.has(neighborIndex));
  }

  isPassiveTrafficTurn(previousNodeIndex, currentNodeIndex, nextNodeIndex) {
    const graph = this.passiveTrafficGraph;
    if (!graph) {
      return false;
    }

    return isPassiveTrafficTurningThroughNode(
      graph.nodes?.[previousNodeIndex],
      graph.nodes?.[currentNodeIndex],
      graph.nodes?.[nextNodeIndex]
    );
  }

  shouldPassiveTrafficStopForTurn(previousNodeIndex, currentNodeIndex, nextNodeIndex) {
    const graph = this.passiveTrafficGraph;
    if (!graph) {
      return false;
    }

    return shouldPassiveTrafficStopForTurn(
      graph.nodes?.[previousNodeIndex],
      graph.nodes?.[currentNodeIndex],
      graph.nodes?.[nextNodeIndex]
    );
  }

  isPassiveTrafficApproachingTurn(car) {
    const nextNodeIndex = car.route?.[car.routeCursor + 1] ?? null;
    return this.isPassiveTrafficTurn(car.currentNodeIndex, car.targetNodeIndex, nextNodeIndex);
  }

  getPassiveTrafficTurnStopSeconds(car) {
    return PASSIVE_TRAFFIC_TURN_STOP_SECONDS
      + ((car.carIndex % PASSIVE_TRAFFIC_SPEED_FACTORS.length) * PASSIVE_TRAFFIC_TURN_STOP_STEP_SECONDS);
  }

  getPassiveTrafficDesiredSpeed(car, distanceToTarget) {
    let desiredSpeed = car.speed;

    if (car.turnWaypointActive) {
      desiredSpeed *= PASSIVE_TRAFFIC_TURN_SPEED_FACTOR;
    } else if (this.isPassiveTrafficApproachingTurn(car)) {
      const approachRatio = Math.max(0.28, Math.min(1, distanceToTarget / PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE));
      desiredSpeed *= approachRatio;
    }

    return desiredSpeed;
  }

  choosePassiveTrafficDestination(car) {
    const graph = this.passiveTrafficGraph;
    const currentNode = graph?.nodes?.[car.currentNodeIndex];
    if (!graph || !currentNode) {
      return null;
    }

    const activeDestinations = new Set(this.passiveTrafficCars
      .filter((otherCar) => otherCar && otherCar !== car)
      .map((otherCar) => otherCar.routeDestinationIndex ?? otherCar.targetNodeIndex)
      .filter((nodeIndex) => nodeIndex !== null && nodeIndex !== undefined));
    const componentIndex = currentNode.componentIndex;
    const candidates = graph.activeNodeIndices
      .filter((nodeIndex) => nodeIndex !== car.currentNodeIndex)
      .filter((nodeIndex) => graph.nodes[nodeIndex]?.componentIndex === componentIndex)
      .map((nodeIndex) => {
        const node = graph.nodes[nodeIndex];
        const visitCount = this.passiveTrafficNodeVisits.get(nodeIndex) ?? 0;
        const lastVisitOrder = this.passiveTrafficNodeVisitOrder.get(nodeIndex) ?? -100000;
        const distance = Math.abs(node.cellX - currentNode.cellX) + Math.abs(node.cellZ - currentNode.cellZ);
        return {
          nodeIndex,
          visitCount,
          lastVisitOrder,
          distance,
          activeDestination: activeDestinations.has(nodeIndex) ? 1 : 0,
          tieBreak: passiveTrafficTieBreak(nodeIndex, car.carIndex)
        };
      })
      .sort((a, b) => (
        (a.visitCount - b.visitCount)
        || (a.activeDestination - b.activeDestination)
        || (a.lastVisitOrder - b.lastVisitOrder)
        || (b.distance - a.distance)
        || (a.tieBreak - b.tieBreak)
      ));

    const candidatePool = candidates.slice(0, PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT);
    if (!candidatePool.length) {
      return null;
    }

    candidatePool.sort((a, b) => (
      (b.distance - a.distance)
      || (a.visitCount - b.visitCount)
      || (a.activeDestination - b.activeDestination)
      || (a.lastVisitOrder - b.lastVisitOrder)
      || (a.tieBreak - b.tieBreak)
    ));
    return candidatePool[0].nodeIndex;
  }

  assignPassiveTrafficRoute(car) {
    const graph = this.passiveTrafficGraph;
    if (!graph || !car) {
      return false;
    }

    const destinationIndex = this.choosePassiveTrafficDestination(car);
    const route = destinationIndex !== null
      ? findPassiveTrafficPath(graph, car.currentNodeIndex, destinationIndex)
      : [];
    if (route.length >= 2) {
      car.route = route;
      car.routeCursor = 1;
      car.routeDestinationIndex = destinationIndex;
      return this.advancePassiveTrafficTarget(car);
    }

    const neighbors = this.getPassiveTrafficActiveNeighbors(car.currentNodeIndex);
    const fallback = neighbors.find((nodeIndex) => nodeIndex !== car.previousNodeIndex) ?? neighbors[0] ?? null;
    if (fallback === null) {
      car.targetNodeIndex = null;
      return false;
    }

    car.route = [car.currentNodeIndex, fallback];
    car.routeCursor = 1;
    car.routeDestinationIndex = fallback;
    return this.advancePassiveTrafficTarget(car);
  }

  advancePassiveTrafficTarget(car) {
    const graph = this.passiveTrafficGraph;
    if (!graph || !car) {
      return false;
    }

    while (car.routeCursor < car.route.length && car.route[car.routeCursor] === car.currentNodeIndex) {
      car.routeCursor += 1;
    }

    if (car.routeCursor >= car.route.length) {
      return this.assignPassiveTrafficRoute(car);
    }

    const routeNodeIndex = car.route[car.routeCursor];
    if (!graph.activeNodeSet.has(routeNodeIndex)) {
      return this.assignPassiveTrafficRoute(car);
    }

    const currentNode = graph.nodes[car.currentNodeIndex];
    const routeNode = graph.nodes[routeNodeIndex];
    if (!currentNode || !routeNode) {
      car.targetNodeIndex = null;
      return false;
    }

    const nextRouteNodeIndex = car.route?.[car.routeCursor + 1] ?? null;
    const shouldTurnThroughRouteNode = nextRouteNodeIndex !== null
      && graph.activeNodeSet.has(nextRouteNodeIndex)
      && this.isPassiveTrafficTurn(car.currentNodeIndex, routeNodeIndex, nextRouteNodeIndex);
    const finalNodeIndex = shouldTurnThroughRouteNode ? nextRouteNodeIndex : routeNodeIndex;
    const finalNode = graph.nodes[finalNodeIndex];
    if (!finalNode) {
      car.targetNodeIndex = null;
      return false;
    }

    car.targetNodeIndex = finalNodeIndex;
    car.routeAdvanceCount = shouldTurnThroughRouteNode ? 2 : 1;
    car.turnThroughNodeIndex = shouldTurnThroughRouteNode ? routeNodeIndex : null;
    car.turnWaypointActive = false;
    car.turnWaypointQueue.length = 0;
    getPassiveTrafficLanePosition(
      shouldTurnThroughRouteNode ? routeNode : currentNode,
      finalNode,
      car.finalTargetPosition
    );
    car.finalTargetPosition.y = this.getSurfaceHeightAtPosition(car.finalTargetPosition.x, car.finalTargetPosition.z);

    if (shouldTurnThroughRouteNode) {
      car.turnWaypointQueue = getPassiveTrafficTurnLaneWaypoints(
        currentNode,
        routeNode,
        finalNode
      ).map((waypoint) => {
        waypoint.y = this.getSurfaceHeightAtPosition(waypoint.x, waypoint.z);
        return waypoint;
      });
      const nextTurnWaypoint = car.turnWaypointQueue.shift() ?? null;
      if (nextTurnWaypoint) {
        car.targetPosition.copy(nextTurnWaypoint);
        car.turnWaypointActive = true;
      } else {
        car.targetPosition.copy(car.finalTargetPosition);
        car.targetPosition.y = this.getSurfaceHeightAtPosition(car.targetPosition.x, car.targetPosition.z);
        car.turnWaypointActive = true;
      }
      if (this.shouldPassiveTrafficStopForTurn(car.currentNodeIndex, routeNodeIndex, finalNodeIndex)) {
        car.turnStopSeconds = Math.max(car.turnStopSeconds, this.getPassiveTrafficTurnStopSeconds(car));
        car.currentSpeed = 0;
      }
    } else {
      car.targetPosition.copy(car.finalTargetPosition);
    }

    return true;
  }

  updatePassiveTraffic(deltaSeconds) {
    if (!this.passiveTrafficCars.length || !this.passiveTrafficGraph) {
      return;
    }

    const dt = Math.max(0, Math.min(0.08, Number(deltaSeconds) || 0));
    if (dt <= 0) {
      return;
    }

    for (const car of this.passiveTrafficCars) {
      let remainingTime = dt;
      let guard = 0;

      while (remainingTime > 0.0001 && guard < 6) {
        guard += 1;
        if (car.turnStopSeconds > 0) {
          car.turnStopSeconds = Math.max(0, car.turnStopSeconds - remainingTime);
          car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, remainingTime);
          break;
        }

        if (car.targetNodeIndex === null && !this.advancePassiveTrafficTarget(car)) {
          break;
        }

        if (car.turnStopSeconds > 0) {
          car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, remainingTime);
          break;
        }

        const toTarget = this.passiveTrafficScratch.subVectors(car.targetPosition, car.object.position);
        toTarget.y = 0;
        const distance = toTarget.length();
        if (distance <= PASSIVE_TRAFFIC_POSITION_EPSILON) {
          car.object.position.copy(car.targetPosition);
          if (car.turnWaypointActive) {
            const nextTurnWaypoint = car.turnWaypointQueue.shift() ?? null;
            if (nextTurnWaypoint) {
              car.targetPosition.copy(nextTurnWaypoint);
              continue;
            }

            car.turnWaypointActive = false;
            car.targetPosition.copy(car.finalTargetPosition);
            continue;
          }

          const arrivedNodeIndex = car.targetNodeIndex;
          const throughNodeIndex = car.turnThroughNodeIndex;
          const routeAdvanceCount = Math.max(1, car.routeAdvanceCount ?? 1);
          if (throughNodeIndex !== null && throughNodeIndex !== undefined && throughNodeIndex !== car.currentNodeIndex) {
            this.markPassiveTrafficNodeVisited(throughNodeIndex);
          }
          car.previousNodeIndex = throughNodeIndex ?? car.currentNodeIndex;
          car.currentNodeIndex = arrivedNodeIndex;
          car.routeCursor += routeAdvanceCount;
          car.targetNodeIndex = null;
          car.turnThroughNodeIndex = null;
          car.routeAdvanceCount = 1;
          if (car.routeCursor >= car.route.length) {
            car.routeDestinationIndex = null;
          }
          this.markPassiveTrafficNodeVisited(car.currentNodeIndex);
          continue;
        }

        const desiredSpeed = this.getPassiveTrafficDesiredSpeed(car, distance);
        car.currentSpeed = dampNumber(car.currentSpeed, desiredSpeed, PASSIVE_TRAFFIC_ACCEL_RESPONSE, remainingTime);
        const moveSpeed = Math.max(0, car.currentSpeed);
        if (moveSpeed <= 0.001) {
          break;
        }

        const step = Math.min(moveSpeed * remainingTime, distance);
        toTarget.multiplyScalar(1 / distance);
        this.passiveTrafficTargetScratch.copy(toTarget).multiplyScalar(step);
        car.object.position.add(this.passiveTrafficTargetScratch);
        car.object.position.y = this.getSurfaceHeightAtPosition(car.object.position.x, car.object.position.z);
        const stepDuration = step / moveSpeed;
        remainingTime -= stepDuration;

        const targetYaw = Math.atan2(toTarget.x, toTarget.z);
        car.yaw = dampAngleRadians(car.yaw, targetYaw, PASSIVE_TRAFFIC_TURN_RESPONSE, stepDuration);
        car.object.rotation.y = car.yaw;

        if (step < distance) {
          break;
        }
      }
    }
  }

  update(deltaSeconds) {
    const timeSeconds = performance.now() * 0.001;
    for (const rendered of this.renderedPlacements.values()) {
      rendered.actor?.update(deltaSeconds);
      rendered.object?.userData?.onWorldUpdate?.(deltaSeconds, timeSeconds);
    }
    this.updatePassiveTraffic(deltaSeconds);

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

  getCameraOcclusionCandidates(
    excludedPlacementIds = this.emptyCameraOcclusionPlacementIds,
    candidates = this.cameraOcclusionCandidates
  ) {
    candidates.length = 0;

    for (const rendered of this.renderedPlacements.values()) {
      if (excludedPlacementIds.has(rendered.id)) {
        continue;
      }

      if (this.isPlacementVisibleForCameraOcclusion(rendered)) {
        candidates.push(rendered);
      }
    }

    return candidates;
  }

  setPlacementCameraOccluded(rendered, occluded, options = {}) {
    const nextOccluded = Boolean(occluded);
    if (!rendered?.cameraOcclusionObject) {
      return;
    }

    if (!rendered.cameraOcclusionMaterialState && !nextOccluded) {
      return;
    }

    const preservedNodeNames = hasNodeNameEntries(options.preservedNodeNames)
      ? normalizeNodeNameSet(options.preservedNodeNames)
      : this.emptyCameraOcclusionNodeNames;
    if (
      rendered.cameraOcclusionMaterialState
      && nextOccluded
      && !nodeNameSetsEqual(
        rendered.cameraOcclusionMaterialState.preservedNodeNames,
        preservedNodeNames
      )
    ) {
      restoreCameraOcclusionMaterials(rendered);
    }

    rendered.cameraOcclusionMaterialState ??= cloneMaterialsForCameraOcclusion(
      rendered.cameraOcclusionObject,
      {
        cloneMaterials: !rendered.nodeFadeMaterialState,
        preservedNodeNames
      }
    );
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

  getCameraOcclusionPreservedNodeNames(
    rendered,
    preserveInteriorNodePlacementIds = this.emptyCameraOcclusionPlacementIds
  ) {
    const alwaysPreservedNames = normalizeNodeNameSet(
      rendered?.item?.cameraOcclusionAlwaysPreserveNodeNames
    );
    if (!preserveInteriorNodePlacementIds.has(rendered?.id)) {
      return alwaysPreservedNames.size ? alwaysPreservedNames : this.emptyCameraOcclusionNodeNames;
    }

    const preservedNames = normalizeNodeNameSet(rendered?.item?.cameraOcclusionPreserveNodeNames);
    for (const nodeName of alwaysPreservedNames) {
      preservedNames.add(nodeName);
    }
    return preservedNames.size ? preservedNames : this.emptyCameraOcclusionNodeNames;
  }

  syncCameraOccludedPlacementIds(nextOccludedPlacementIds, options = {}) {
    const preserveInteriorNodePlacementIds = this.preserveInteriorNodePlacementIds;
    preserveInteriorNodePlacementIds.clear();
    for (const placementId of options.preserveInteriorNodePlacementIds ?? []) {
      if (placementId) {
        preserveInteriorNodePlacementIds.add(placementId);
      }
    }

    this.cameraOcclusionIdsToClear.length = 0;
    for (const placementId of this.cameraOccludedPlacementIds) {
      if (!nextOccludedPlacementIds.has(placementId)) {
        this.cameraOcclusionIdsToClear.push(placementId);
      }
    }

    for (const placementId of this.cameraOcclusionIdsToClear) {
      const rendered = this.renderedPlacements.get(placementId);
      this.setPlacementCameraOccluded(rendered, false);
      this.cameraOccludedPlacementIds.delete(placementId);
    }

    for (const placementId of nextOccludedPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!this.isPlacementVisibleForCameraOcclusion(rendered)) {
        continue;
      }

      this.setPlacementCameraOccluded(rendered, true, {
        preservedNodeNames: this.getCameraOcclusionPreservedNodeNames(
          rendered,
          preserveInteriorNodePlacementIds
        )
      });
      this.cameraOccludedPlacementIds.add(placementId);
    }

    return this.cameraOccludedPlacementIds.size;
  }

  clearCameraOcclusion() {
    return this.syncCameraOccludedPlacementIds(this.emptyCameraOcclusionPlacementIds);
  }

  updateCameraOcclusion(camera = this.camera, playerPosition = null, options = {}) {
    if (!camera || !playerPosition || !this.tileRoot.visible) {
      return this.clearCameraOcclusion();
    }

    const baseX = playerPosition.x ?? 0;
    const baseY = playerPosition.y ?? 0;
    const baseZ = playerPosition.z ?? 0;
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY) || !Number.isFinite(baseZ)) {
      return this.clearCameraOcclusion();
    }

    const excludedPlacementIds = this.excludedCameraOcclusionPlacementIds;
    excludedPlacementIds.clear();
    for (const placementId of options.excludedPlacementIds ?? []) {
      if (placementId) {
        excludedPlacementIds.add(placementId);
      }
    }
    const candidates = this.getCameraOcclusionCandidates(excludedPlacementIds);
    if (!candidates.length) {
      return this.clearCameraOcclusion();
    }

    const nextOccludedPlacementIds = this.nextCameraOccludedPlacementIds;
    nextOccludedPlacementIds.clear();
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

        if (
          bounds.containsPoint(camera.position)
          || bounds.containsPoint(this.cameraOcclusionTarget)
        ) {
          nextOccludedPlacementIds.add(rendered.id);
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

    return this.syncCameraOccludedPlacementIds(nextOccludedPlacementIds, options);
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
      rendered.object.rotation.y = getPlacementRotationY(placement);
      applyRenderedPlacementScale(rendered, placement);
    }

    if (rendered.actor) {
      rendered.colliders = createPlacementColliders(rendered.object, rendered.item, placement, rendered.actor);
    } else {
      rendered.colliders = createPlacementColliders(rendered.colliderObject, rendered.item, placement, null);
      this.refreshStaticColliderEntry(rendered);
    }

    this.syncPlacementInteractableIndicator(rendered);

    if (placement.layer === 'tile') {
      this.markSurfaceHeightIndexDirty();
    }

    this.refreshWorkoutPlacementState();
    if (placement.layer === 'tile') {
      this.refreshPassiveTraffic();
    }
  }

  setPlacementHidden(id, hidden) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.hidden = Boolean(hidden);
    if (!rendered.actor) {
      this.markStaticCollidersDirty();
    }
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

    this.setPlacementCutawayState(id, {
      hiddenNodeNames: nodeNames,
      fadedNodeNames: rendered.fadedNodeNames,
      fadedNodeOpacity: rendered.fadedNodeOpacity,
      visibleNodeNames: rendered.visibleNodeNames,
      shadowOverrides: rendered.shadowOverrides
    });
  }

  setPlacementFadedNodeNames(id, nodeNames = [], opacity = 1) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    this.setPlacementCutawayState(id, {
      hiddenNodeNames: rendered.hiddenNodeNames,
      fadedNodeNames: nodeNames,
      fadedNodeOpacity: opacity,
      visibleNodeNames: rendered.visibleNodeNames,
      shadowOverrides: rendered.shadowOverrides
    });
  }

  setPlacementShadowOverrides(id, overrides = null) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    this.setPlacementCutawayState(id, {
      hiddenNodeNames: rendered.hiddenNodeNames,
      fadedNodeNames: rendered.fadedNodeNames,
      fadedNodeOpacity: rendered.fadedNodeOpacity,
      visibleNodeNames: rendered.visibleNodeNames,
      shadowOverrides: overrides
    });
  }

  setPlacementCutawayState(id, state = {}) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    const {
      hiddenNodeNames = [],
      fadedNodeNames = [],
      fadedNodeOpacity = 1,
      visibleNodeNames = [],
      shadowOverrides = null
    } = state ?? {};

    const nextHiddenNodeNames = normalizeNodeNameSet(hiddenNodeNames);
    const nextFadedNodeNames = normalizeNodeNameSet(fadedNodeNames);
    const nextFadedNodeOpacity = normalizeOpacity(fadedNodeOpacity);
    const nextVisibleNodeNames = normalizeNodeNameSet(visibleNodeNames);
    const nextShadowOverrides = normalizeShadowOverrides(shadowOverrides);

    const hiddenChanged = !nodeNameSetsEqual(rendered.hiddenNodeNames, nextHiddenNodeNames);
    const fadedChanged = !nodeNameSetsEqual(rendered.fadedNodeNames, nextFadedNodeNames)
      || rendered.fadedNodeOpacity !== nextFadedNodeOpacity;
    const visibleChanged = !nodeNameSetsEqual(rendered.visibleNodeNames, nextVisibleNodeNames);
    const shadowChanged = !shadowOverridesEqual(rendered.shadowOverrides, nextShadowOverrides);

    if (!hiddenChanged && !fadedChanged && !visibleChanged && !shadowChanged) {
      return;
    }

    if (hiddenChanged || fadedChanged || visibleChanged) {
      restoreCameraOcclusionMaterials(rendered);
      this.cameraOccludedPlacementIds.delete(id);
    }

    rendered.hiddenNodeNames = nextHiddenNodeNames;
    rendered.fadedNodeNames = nextFadedNodeNames;
    rendered.fadedNodeOpacity = nextFadedNodeOpacity;
    rendered.visibleNodeNames = nextVisibleNodeNames;
    rendered.shadowOverrides = nextShadowOverrides;
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
    this.actorPlacementIds.delete(id);
    this.staticColliderEntries.delete(id);
    this.markStaticCollidersDirty();
    if (rendered.layer === 'tile') {
      this.markSurfaceHeightIndexDirty();
      this.refreshPassiveTraffic();
    }
    this.refreshWorkoutPlacementState();
    this.refreshNpcRoutinePreview();
    this.refreshNpcDebugGizmos();
  }

  getColliders(target = []) {
    const colliders = target;
    colliders.length = 0;
    for (const collider of this.getVisibleStaticColliders()) {
      colliders.push(collider);
    }

    for (const placementId of this.actorPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered || rendered.hidden) {
        continue;
      }

      const collider = createNpcCollider(rendered.actor, rendered.placement);
      if (collider) {
        colliders.push(collider);
      }
    }

    return colliders;
  }

  getGroundHeightAt(worldPosition, worldState) {
    return this.getSurfaceHeightAtPosition(worldPosition.x, worldPosition.z);
  }

  getOccupiedWorkoutPlacementIds(worldState, target = this.occupiedWorkoutPlacementIds) {
    const occupiedPlacementIds = target;
    occupiedPlacementIds.clear();

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
      const interactable = placement && item ? resolvePlacementInteractableDefinition(placement, item) : null;
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

  shouldHideActiveWorkoutPlacement(placementId = '', worldState = null) {
    if (!placementId) {
      return false;
    }

    const renderedTarget = this.renderedPlacements.get(placementId);
    const placement = renderedTarget?.placement ?? worldState?.getPlacement?.(placementId);
    const item = renderedTarget?.item ?? getBuilderItemById(placement?.itemId);
    const interactable = placement && item ? resolvePlacementInteractableDefinition(placement, item) : null;
    return Boolean(interactable?.workoutType && interactable.hideDuringWorkout !== false);
  }

  getVisibleWorkoutPlacementIds(worldState, target = this.visibleWorkoutPlacementIds) {
    const visiblePlacementIds = target;
    visiblePlacementIds.clear();

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
      const interactable = placement && item ? resolvePlacementInteractableDefinition(placement, item) : null;
      if (
        interactable?.workoutType
        && interactable.workoutType === npcState.activity
        && this.shouldHideActiveWorkoutPlacement(npcState.targetPlacementId, worldState)
      ) {
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
      const interactable = placement && item ? resolvePlacementInteractableDefinition(placement, item) : null;
      if (
        interactable?.workoutType
        && interactable.workoutType === playerState.emoteId
        && this.shouldHideActiveWorkoutPlacement(placementId, worldState)
      ) {
        visiblePlacementIds.add(placementId);
      }
    }

    if (
      this.localWorkoutState.activePlacementId
      && this.shouldHideActiveWorkoutPlacement(this.localWorkoutState.activePlacementId, worldState)
    ) {
      visiblePlacementIds.add(this.localWorkoutState.activePlacementId);
    }

    return visiblePlacementIds;
  }

  getInteractables(worldState, target = []) {
    const occupiedWorkoutPlacementIds = this.getOccupiedWorkoutPlacementIds(worldState);
    const interactables = target;
    const activeKeys = this.activeInteractableCacheKeys;
    interactables.length = 0;
    activeKeys.clear();

    worldState.forEachPlacement((placement) => {
      if (placement.layer !== 'npc') {
        const placementItem = getBuilderItemById(placement.itemId);
        if (!placement.interactable && !placementItem?.interior && !placementItem?.interactable) {
          return;
        }
      }

      const rendered = this.renderedPlacements.get(placement.id);
      const item = getBuilderItemById(placement.itemId);
      if (!rendered || rendered.hidden || !item) {
        return;
      }

      if (placement.layer === 'npc' && placement.npc) {
        const runtimeState = this.npcRuntimeState.get(placement.id);
        if (runtimeState?.mode === NPC_RUNTIME_MODES.hidden || runtimeState?.alive === false) {
          return;
        }

        const rotationY = toRotationY(placement.rotationQuarterTurns);
        const distance = item.interactionOffset ?? BUILDER_TILE_SIZE * 0.16;
        const cacheKey = `npc:${placement.id}`;
        const npcInteractable = getCachedInteractable(this.interactableCache, cacheKey);
        const originPosition = getReusableVector(npcInteractable.originPosition).copy(rendered.object.position);
        const position = getReusableVector(npcInteractable.position).copy(rendered.object.position);
        position.x += Math.sin(rotationY) * distance;
        position.z += Math.cos(rotationY) * distance;
        activeKeys.add(cacheKey);
        npcInteractable.kind = 'npc';
        npcInteractable.placementId = placement.id;
        npcInteractable.npcId = placement.id;
        npcInteractable.npc = syncPlainObject(npcInteractable.npc ?? {}, placement.npc);
        npcInteractable.originPosition = originPosition;
        npcInteractable.position = position;
        npcInteractable.radius = placement.npc.interactRadius ?? item.interactionRadius ?? 4.2;
        npcInteractable.prompt = `Talk to ${placement.npc.name}`;
        npcInteractable.actionText = `Talk to ${placement.npc.name}`;
        interactables.push(npcInteractable);
        return;
      }

      const interactable = resolvePlacementInteractableDefinition(placement, item);
      if (!interactable || ['inline-shell', 'inline-cutaway'].includes(interactable.interior?.mode)) {
        return;
      }

      if (interactable.portal) {
        const cacheKey = `portal:${placement.id}`;
        const portalInteractable = createPortalInteractable(
          rendered,
          placement,
          item,
          interactable,
          getCachedInteractable(this.interactableCache, cacheKey)
        );
        if (portalInteractable) {
          activeKeys.add(cacheKey);
          interactables.push(portalInteractable);
        }
        return;
      }

      const distance = interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
      const cacheKey = `world:${placement.id}`;
      const worldInteractable = getCachedInteractable(this.interactableCache, cacheKey);
      const position = getInteractableWorldPosition(
        rendered,
        placement,
        interactable,
        distance,
        getReusableVector(worldInteractable.position)
      );
      let approachPosition = null;
      if (Array.isArray(interactable.approachLocalOffset)) {
        approachPosition = getInteractableWorldPosition(
          rendered,
          placement,
          { localOffset: interactable.approachLocalOffset },
          distance,
          getReusableVector(worldInteractable.approachPosition)
        );
      }
      const officeJobId = String(interactable.officeJobId ?? '').trim();
      const workoutKind = interactable.workoutType
        ? `${interactable.workoutType}-workout`
        : (officeJobId ? 'office-job-station' : 'world');
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

      activeKeys.add(cacheKey);
      worldInteractable.kind = workoutKind;
      worldInteractable.placementId = placement.id;
      worldInteractable.itemId = item.id;
      worldInteractable.rotationQuarterTurns = placement.rotationQuarterTurns;
      worldInteractable.originPosition = getReusableVector(worldInteractable.originPosition).copy(rendered.object.position);
      worldInteractable.position = position;
      worldInteractable.radius = interactable.radius ?? 4;
      worldInteractable.label = defaultLabel;
      worldInteractable.prompt = prompt;
      worldInteractable.actionText = actionText;
      worldInteractable.busy = workoutBusy;
      worldInteractable.gameId = String(interactable.gameId ?? '');
      worldInteractable.officeJobId = officeJobId;
      worldInteractable.interior = cloneInteriorDefinition(interactable.interior);
      worldInteractable.garageDoor = cloneGarageDoorDefinition(interactable.garageDoor);
      worldInteractable.approachPosition = approachPosition;
      worldInteractable.approachRotationY = Number.isFinite(interactable.approachRotationY)
        ? toRotationY(placement.rotationQuarterTurns) + interactable.approachRotationY
        : undefined;
      worldInteractable.barbellObject = interactable.workoutType ? rendered.object : null;
      interactables.push(worldInteractable);
    });

    for (const cacheKey of this.interactableCache.keys()) {
      if (!activeKeys.has(cacheKey)) {
        this.interactableCache.delete(cacheKey);
      }
    }

    return interactables;
  }

  applyPlacementVisibility(rendered) {
    const visible = !rendered.hidden && !rendered.visualHidden && !rendered.workoutHidden;
    const hasVisibleNodeFilter = visible && (rendered.visibleNodeNames?.size ?? 0) > 0;
    const hasFadedNodes = visible
      && (rendered.fadedNodeNames?.size ?? 0) > 0
      && rendered.fadedNodeOpacity < 1;
    if (hasFadedNodes && !rendered.nodeFadeMaterialState) {
      rendered.nodeFadeMaterialState = cloneMaterialsForNodeFade(rendered.object);
    } else if (!hasFadedNodes) {
      restoreNodeFadeMaterials(rendered);
    }

    rendered.object.visible = visible;
    rendered.object.traverse((node) => {
      const nodeHidden = nodeNameMatches(node, rendered.hiddenNodeNames)
        || (
          hasVisibleNodeFilter
          && node !== rendered.object
          && !nodeWithinVisibleNameFilter(node, rendered.visibleNodeNames, rendered.object)
        );
      const nodeVisible = visible && !nodeHidden;
      if (node !== rendered.object) {
        node.visible = nodeVisible;
      }
      if (node.isMesh && rendered.nodeFadeMaterialState) {
        const nodeFaded = hasFadedNodes
          && nodeVisible
          && nodeNameMatches(node, rendered.fadedNodeNames);
        for (const material of collectMaterials(node.material)) {
          const entry = rendered.nodeFadeMaterialState.materialStates.get(material);
          if (!entry) {
            continue;
          }
          material.transparent = nodeFaded ? true : entry.transparent;
          material.depthWrite = nodeFaded ? false : entry.depthWrite;
          material.opacity = nodeFaded ? rendered.fadedNodeOpacity : entry.opacity;
          material.needsUpdate = true;
        }
        if (nodeFaded) {
          rendered.nodeFadeMaterialState.active = true;
        }
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

  getInlineShellEntries(worldState, target = []) {
    const entries = target;
    entries.length = 0;

    worldState.forEachPlacement((placement) => {
      const rendered = this.renderedPlacements.get(placement.id);
      const item = getBuilderItemById(placement.itemId);
      if (!rendered || !item) {
        return;
      }

      const interactable = resolvePlacementInteractableDefinition(placement, item);
      if (
        !interactable?.interior?.id
        || !['inline-shell', 'inline-cutaway'].includes(interactable.interior.mode)
      ) {
        return;
      }

      const entry = createInlineShellEntry(rendered, placement, interactable);
      if (entry) {
        entries.push(entry);
      }
    });

    return entries;
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
    this.npcFocusTargets.clear();
    for (const [npcId, target] of npcFocusTargets.entries()) {
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
        continue;
      }
      this.npcFocusTargets.set(npcId, {
        x: Number(target.x),
        z: Number(target.z)
      });
    }

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
    const anchors = this.npcSpeechAnchors;
    anchors.clear();

    for (const [placementId, rendered] of this.renderedPlacements.entries()) {
      if (!rendered.actor || rendered.actor.runtimeState?.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      let anchor = this.npcSpeechAnchorVectors.get(placementId);
      if (!anchor) {
        anchor = new THREE.Vector3();
        this.npcSpeechAnchorVectors.set(placementId, anchor);
      }
      anchors.set(placementId, rendered.actor.getSpeechAnchorWorldPosition(anchor));
    }

    for (const placementId of this.npcSpeechAnchorVectors.keys()) {
      if (!this.renderedPlacements.has(placementId)) {
        this.npcSpeechAnchorVectors.delete(placementId);
      }
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
