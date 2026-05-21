import * as THREE from 'three';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { NpcActor } from '../npc/NpcActor.js';
import {
  NPC_RUNTIME_MODES,
  NPC_STEP_TYPES,
  getNpcLawRadius,
  isPoliceOfficerNpc
} from '../npc/npcBehavior.js';
import { getNpcModelByItemId } from '../npc/npcCatalog.js';
import { segmentRectIntersectionDistance } from '../shared/combatMath.js';
import {
  getTileCenterWorldPosition,
  getTileOccupiedCells,
  rotateFootprintOffset as rotateLocalOffset
} from '../shared/tileFootprint.js';
import { getPlacementScale } from '../shared/placementScale.js';
import { clonePassiveTrafficRoutes } from '../shared/passiveTrafficRoutes.js';
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
  PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SPEED_FACTOR,
  PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS,
  PASSIVE_TRAFFIC_CAR_SCALE,
  PASSIVE_TRAFFIC_DRIVE_COMMANDS,
  PASSIVE_TRAFFIC_MIN_ROAD_NODES,
  PASSIVE_TRAFFIC_PLAYER_COLLISION_DAMAGE,
  PASSIVE_TRAFFIC_PLAYER_STUN_SECONDS,
  PASSIVE_TRAFFIC_SPEED,
  buildPassiveTrafficRoadGraph,
  buildPassiveTrafficRouteLookahead,
  clampPassiveTrafficTurnYaw,
  clampPassiveTrafficPositionToRoadNodes,
  findPassiveTrafficPath,
  getPassiveTrafficDriveCommand,
  getPassiveTrafficDriveScript,
  getPassiveTrafficForwardVector,
  getPassiveTrafficLanePosition,
  getPassiveTrafficLanePositionAtNode,
  getPassiveTrafficRouteNodeIndices,
  getPassiveTrafficTurnLaneWaypointsFromPosition,
  getPassiveTrafficTurnYawRange,
  isPointInsidePassiveTrafficHitbox,
  isPassiveTrafficCrosswalkNode,
  isPassiveTrafficJunctionNode,
  isPassiveTrafficTSplitNode,
  isPassiveTrafficPositionInsideRoadNode,
  passiveTrafficHitboxesOverlap
} from './passiveTraffic.js';

const CAMERA_OCCLUDED_BUILDING_OPACITY = 0;
const CAMERA_OCCLUSION_PLAYER_HEIGHTS = Object.freeze([1.2, 2.7, 4.1]);
const CAMERA_OCCLUSION_TARGET_PADDING = 0.05;
const NPC_LAW_VISIBILITY_BLOCKER_GRACE_DISTANCE = 0.05;
const STATIC_INSTANCE_BATCH_MIN_COUNT = 2;
const NON_SHADOW_CASTING_TILE_IDS = new Set([
  'lot_base',
  'basketball_court_half'
]);
const NON_SHADOW_CASTING_TILE_ASSET_PREFIXES = Object.freeze([
  'road_',
  'park_road_',
  'park_base'
]);
const NON_SHADOW_CASTING_PROP_IDS = new Set([
  'sidewalk',
  'stone_path',
  'dirt_path'
]);
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
const EMPTY_NODE_NAME_SET = new Set();
const EMPTY_MAP = new Map();
const NPC_CORE_ANIMATION_CLIPS = Object.freeze([
  assets.playerAnimationSet.idle,
  assets.playerAnimationSet.walking,
  assets.playerAnimationSet.slowRun,
  assets.playerAnimationSet.fastRun,
  assets.playerAnimationSet.fightingIdle,
  assets.playerAnimationSet.punching,
  ...assets.playerAnimationSet.hitReactions,
  assets.playerAnimationSet.snatch
]);
const PASSIVE_TRAFFIC_TURN_RESPONSE = 8.5;
const PASSIVE_TRAFFIC_ACCEL_RESPONSE = 5.5;
const PASSIVE_TRAFFIC_BRAKE_RESPONSE = 14;
const PASSIVE_TRAFFIC_TURN_SPEED_FACTOR = 0.58;
const PASSIVE_TRAFFIC_SEDAN_TURN_SPEED_FACTOR = 0.46;
const PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE = BUILDER_TILE_SIZE * 0.55;
const PASSIVE_TRAFFIC_TURN_STOP_SECONDS = 0.38;
const PASSIVE_TRAFFIC_TURN_STOP_STEP_SECONDS = 0.06;
const PASSIVE_TRAFFIC_SPEED_FACTORS = Object.freeze([0.94, 1, 1.06]);
const PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT = 14;
const PASSIVE_TRAFFIC_POSITION_EPSILON = 0.08;
const PASSIVE_TRAFFIC_STUCK_SECONDS = 1.15;
const PASSIVE_TRAFFIC_STUCK_DISTANCE = 0.018;
const PASSIVE_TRAFFIC_REVERSE_SPEED_FACTOR = 0.48;
const PASSIVE_TRAFFIC_SERVER_RENDER_RESPONSE = 18;
const PASSIVE_TRAFFIC_SERVER_SNAP_DISTANCE = BUILDER_TILE_SIZE * 0.75;

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

function createPassiveTrafficRouteSignature(routes = []) {
  return clonePassiveTrafficRoutes(routes)
    .map((route) => [
      route.id,
      route.itemId,
      route.points.map((point) => `${point.cellX ?? ''}:${point.cellZ ?? ''}:${point.x ?? ''}:${point.z ?? ''}`).join(';')
    ].join('='))
    .sort()
    .join('|');
}

function createPassiveTrafficCarSpecs(routes = []) {
  const normalizedRoutes = clonePassiveTrafficRoutes(routes);
  const assignedRouteIds = new Set();
  const specs = [];

  for (const itemId of PASSIVE_TRAFFIC_CAR_ITEM_IDS) {
    const route = normalizedRoutes.find((entry) => entry.itemId === itemId && !assignedRouteIds.has(entry.id)) ?? null;
    if (route) {
      assignedRouteIds.add(route.id);
    }
    specs.push({
      itemId,
      routeId: route?.id ?? '',
      route
    });
  }

  for (const route of normalizedRoutes) {
    if (assignedRouteIds.has(route.id) || !PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(route.itemId)) {
      continue;
    }
    assignedRouteIds.add(route.id);
    specs.push({
      itemId: route.itemId,
      routeId: route.id,
      route
    });
  }

  return specs;
}

function getPassiveTrafficTurnSpeedFactor(car) {
  return car?.itemId === 'car_sedan'
    ? PASSIVE_TRAFFIC_SEDAN_TURN_SPEED_FACTOR
    : PASSIVE_TRAFFIC_TURN_SPEED_FACTOR;
}

function isPassiveTrafficIntersectionNode(node) {
  return isPassiveTrafficJunctionNode(node);
}

function isPassiveTrafficTurningThroughNode(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  return command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
    || command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT;
}

function shouldPassiveTrafficStopForTurn(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  return isPassiveTrafficIntersectionNode(currentNode)
    && !isPassiveTrafficCrosswalkNode(currentNode)
    && (!isPassiveTrafficTSplitNode(currentNode) || command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT)
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP;
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
    for (let index = 0; index < fragments.length; index += 1) {
      if (name.includes(fragments[index])) {
        return true;
      }
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
  const castShadow = options.castShadow !== false;
  const receiveShadow = options.receiveShadow !== false;
  root.traverse((node) => {
    if (node.isMesh) {
      node.userData.defaultCastShadow = castShadow;
      node.userData.defaultReceiveShadow = receiveShadow;
      node.castShadow = castShadow;
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
    const partItem = part?.item ?? item;
    const stabilizeSolidColors = shouldStabilizeSolidBuildingColors(partItem);
    setShadowFlags(object, {
      castShadow: shouldWorldItemCastShadow(partItem),
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

function valueStartsWithAny(value = '', prefixes = []) {
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function shouldWorldItemCastShadow(item) {
  const itemId = String(item?.id ?? '').toLowerCase();
  const assetName = String(item?.assetName ?? '').toLowerCase();
  if (item?.layer === 'tile') {
    return !(
      NON_SHADOW_CASTING_TILE_IDS.has(itemId)
      || assetName === 'base'
      || valueStartsWithAny(assetName, NON_SHADOW_CASTING_TILE_ASSET_PREFIXES)
    );
  }

  if (item?.layer === 'prop') {
    return !NON_SHADOW_CASTING_PROP_IDS.has(itemId);
  }

  return true;
}

function isLocalWorldDebugHost() {
  const hostname = globalThis.location?.hostname ?? '';
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isInlineInteriorMode(mode = '') {
  return mode === 'inline-shell' || mode === 'inline-cutaway';
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

  const pointCount = points.length || 2;
  const positions = new Float32Array(pointCount * 3);
  if (points.length) {
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const offset = index * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
    }
  } else {
    positions[1] = -9999;
    positions[4] = -9999;
  }
  const nextGeometry = new THREE.BufferGeometry();
  nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  line.geometry.dispose();
  line.geometry = nextGeometry;
}

function createDebugLineGeometry(startPoint, endPoint) {
  const positions = new Float32Array(6);
  positions[0] = startPoint.x;
  positions[1] = startPoint.y;
  positions[2] = startPoint.z;
  positions[3] = endPoint.x;
  positions[4] = endPoint.y;
  positions[5] = endPoint.z;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function copyDebugPlainObject(source = null) {
  const copy = {};
  if (!source || typeof source !== 'object') {
    return copy;
  }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      copy[key] = source[key];
    }
  }
  return copy;
}

function copyNpcRoutinePreviewEntry(entry) {
  const copy = copyDebugPlainObject(entry);
  copy.point = entry?.point ? copyDebugPlainObject(entry.point) : null;
  copy.originPoint = entry?.originPoint ? copyDebugPlainObject(entry.originPoint) : null;
  return copy;
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

  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return (dx * dx) + (dz * dz) <= epsilon * epsilon;
}

function getReusableVector(value) {
  return value?.isVector3 ? value : new THREE.Vector3();
}

function syncPlainObject(target, source = {}) {
  for (const key in target) {
    if (!Object.hasOwn(target, key)) {
      continue;
    }

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

function getInstancedPlacementId(intersection) {
  const object = intersection?.object;
  if (!object?.isInstancedMesh || !Number.isInteger(intersection.instanceId)) {
    return null;
  }

  return object.userData?.instancePlacementIds?.[intersection.instanceId] ?? null;
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
  if (!Array.isArray(material)) {
    return material ? [material] : [];
  }

  const materials = [];
  for (const entry of material) {
    if (entry) {
      materials.push(entry);
    }
  }
  return materials;
}

function nodeNameMatches(node, nodeNames = EMPTY_NODE_NAME_SET) {
  for (const pattern of nodeNames ?? []) {
    if (node.name === pattern || node.name.startsWith(`${pattern}_`)) {
      return true;
    }
  }
  return false;
}

function nodeOrAncestorNameMatches(node, nodeNames = EMPTY_NODE_NAME_SET, root = null) {
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

function nodeOrDescendantNameMatches(node, nodeNames = EMPTY_NODE_NAME_SET) {
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

function nodeWithinVisibleNameFilter(node, nodeNames = EMPTY_NODE_NAME_SET, root = null) {
  return nodeOrAncestorNameMatches(node, nodeNames, root)
    || nodeOrDescendantNameMatches(node, nodeNames);
}

function nodeNameSetsEqual(a = EMPTY_NODE_NAME_SET, b = EMPTY_NODE_NAME_SET) {
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
  const normalized = new Set();
  if (!nodeNames) {
    return normalized;
  }

  if (typeof nodeNames === 'string') {
    if (nodeNames) {
      normalized.add(nodeNames);
    }
    return normalized;
  }

  if (typeof nodeNames[Symbol.iterator] !== 'function') {
    return normalized;
  }

  for (const nodeName of nodeNames) {
    if (nodeName) {
      normalized.add(nodeName);
    }
  }
  return normalized;
}

function createBooleanGrid(size) {
  const grid = [];
  for (let z = 0; z < size; z += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      row.push(false);
    }
    grid.push(row);
  }
  return grid;
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
    const clonedMaterials = [];
    for (const material of sourceMaterials) {
      const cloned = material.clone();
      materialStates.set(cloned, {
        material: cloned,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite
      });
      clonedMaterials.push(cloned);
    }

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
  const preservedNames = normalizeNodeNameSet(preservedNodeNames);

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

    const clonedMaterials = [];
    for (const material of sourceMaterials) {
      const cloned = material.clone();
      if (!nodePreserved) {
        materialStates.push({
          material: cloned,
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite
        });
      }
      clonedMaterials.push(cloned);
    }

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

function collectRenderableMeshes(root, target = []) {
  target.length = 0;
  root?.updateWorldMatrix?.(true, true);
  root?.traverse?.((node) => {
    if (!node.isMesh || node.isSkinnedMesh || !node.geometry || !node.material) {
      return;
    }
    target.push(node);
  });
  return target;
}

function getMaterialSignature(material) {
  if (Array.isArray(material)) {
    return material.map((entry) => entry?.uuid ?? '').join(',');
  }
  return material?.uuid ?? '';
}

function getRenderedVisualBatchSignature(rendered, target = []) {
  const meshes = collectRenderableMeshes(rendered?.object, target);
  if (!meshes.length) {
    return '';
  }

  return meshes
    .map((mesh) => [
      mesh.geometry?.uuid ?? '',
      getMaterialSignature(mesh.material),
      mesh.castShadow ? 'c1' : 'c0',
      mesh.receiveShadow ? 'r1' : 'r0'
    ].join(':'))
    .join('|');
}

function getRenderedPlacementBaseVisible(rendered) {
  return Boolean(
    rendered
    && !rendered.hidden
    && !rendered.visualHidden
    && !rendered.workoutHidden
  );
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
  const occupied = createBooleanGrid(gridSize);
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
  const consumed = createBooleanGrid(gridSize);

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
    const colliders = [];
    for (let index = 0; index < item.movementCollisionRects.length; index += 1) {
      colliders.push(createColliderFromLocalRect(item.movementCollisionRects[index], placement, item));
    }
    return colliders;
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
  constructor({
    scene,
    camera,
    library,
    getPassiveTrafficPlayerCollisionTarget = null,
    onPassiveTrafficPlayerCollision = null
  }) {
    this.scene = scene;
    this.camera = camera;
    this.library = library;
    this.getPassiveTrafficPlayerCollisionTarget = typeof getPassiveTrafficPlayerCollisionTarget === 'function'
      ? getPassiveTrafficPlayerCollisionTarget
      : null;
    this.onPassiveTrafficPlayerCollision = typeof onPassiveTrafficPlayerCollision === 'function'
      ? onPassiveTrafficPlayerCollision
      : null;
    this.raycaster = new THREE.Raycaster();
    this.cameraOcclusionRaycaster = new THREE.Raycaster();
    this.cameraOcclusionTarget = new THREE.Vector3();
    this.cameraOcclusionDirection = new THREE.Vector3();
    this.cameraOcclusionBounds = new THREE.Box3();
    this.cameraOcclusionNodeBounds = new THREE.Box3();
    this.cameraOcclusionBoundsHit = new THREE.Vector3();
    this.cameraOccludedPlacementIds = new Set();
    this.cameraOcclusionCandidates = [];
    this.cameraOcclusionBoundedCandidates = [];
    this.cameraOcclusionRenderedPlacements = new Set();
    this.cameraOcclusionIdsToClear = [];
    this.nextCameraOccludedPlacementIds = new Set();
    this.excludedCameraOcclusionPlacementIds = new Set();
    this.preserveInteriorNodePlacementIds = new Set();
    this.emptyCameraOcclusionPlacementIds = new Set();
    this.emptyCameraOcclusionNodeNames = new Set();

    this.tileRoot = new THREE.Group();
    this.propRoot = new THREE.Group();
    this.staticInstanceRoot = new THREE.Group();
    this.staticInstanceRoot.name = 'StaticInstanceRoot';
    this.passiveTrafficRoot = new THREE.Group();
    this.passiveTrafficRoot.name = 'PassiveTrafficRoot';
    this.scene.add(this.tileRoot);
    this.scene.add(this.propRoot);
    this.scene.add(this.staticInstanceRoot);
    this.scene.add(this.passiveTrafficRoot);

    this.npcDebugRoot = new THREE.Group();
    this.npcDebugRoot.visible = false;
    this.scene.add(this.npcDebugRoot);
    this.npcRoutineRoot = new THREE.Group();
    this.npcRoutineRoot.visible = false;
    this.scene.add(this.npcRoutineRoot);

    this.renderedPlacements = new Map();
    this.updatingRenderedPlacements = new Set();
    this.interactableIndicatorRenderedPlacements = new Set();
    this.visibleInteractableIndicatorCount = 0;
    this.staticInstanceBatches = new Map();
    this.staticInstanceBatchedPlacementIds = new Set();
    this.staticInstancedPropPickTargets = [];
    this.staticVisualBatchingSuspended = false;
    this.staticVisualBatchesDirty = false;
    this.staticVisualBatchMeshScratch = [];
    this.staticVisualBatchGroupScratch = new Map();
    this.staticVisualBatchStats = {
      batchCount: 0,
      instancedMeshCount: 0,
      placementCount: 0
    };
    this.staticVisualBatchStatsSignature = '';
    this.interactablePlacementIds = new Set();
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
    this.hiddenWorkoutPlacementIds = new Set();
    this.workoutPlacementIdsToSync = new Set();
    this.lastVisibleWorkoutPlacementIds = new Set();
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
    this.passiveTrafficRoutes = [];
    this.passiveTrafficRoutesById = new Map();
    this.passiveTrafficRoutesByItemId = new Map();
    this.passiveTrafficVisitCounter = 0;
    this.passiveTrafficNodeVisits = new Map();
    this.passiveTrafficNodeVisitOrder = new Map();
    this.passiveTrafficScratch = new THREE.Vector3();
    this.passiveTrafficTargetScratch = new THREE.Vector3();
    this.passiveTrafficForwardScratch = { x: 0, z: 1 };
    this.passiveTrafficActiveDestinations = new Set();
    this.passiveTrafficDestinationCandidates = [];
    this.passiveTrafficDestinationCandidatePool = [];
    this.passiveTrafficDestinationCandidateNodeIndices = [];
    this.indicatorVisibilityPosition = new THREE.Vector3();
    this.passiveTrafficActiveNeighbors = [];
    this.passiveTrafficRefreshSuspended = false;
    this.passiveTrafficLoadRequestId = 0;
    this.passiveTrafficServerStates = new Map();
    this.passiveTrafficServerActive = false;
    this.passiveTrafficServerSpecSignature = '';
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
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes(worldState?.getPassiveTrafficRoutes?.() ?? []);
    this.syncPassiveTrafficRouteLookups();
    const placements = [];
    worldState.forEachPlacement((placement) => {
      placements.push(placement);
    });
    await this.preloadPlacementAssets(placements);

    this.passiveTrafficRefreshSuspended = true;
    this.staticVisualBatchingSuspended = true;
    try {
      for (const placement of placements) {
        await this.addPlacement(placement);
      }
    } finally {
      this.passiveTrafficRefreshSuspended = false;
      this.staticVisualBatchingSuspended = false;
    }
    this.refreshStaticVisualBatches();
    this.refreshPassiveTraffic();
  }

  syncPassiveTrafficRouteLookups() {
    this.passiveTrafficRoutesById = new Map();
    this.passiveTrafficRoutesByItemId = new Map();
    for (const route of this.passiveTrafficRoutes) {
      this.passiveTrafficRoutesById.set(route.id, route);
      if (!this.passiveTrafficRoutesByItemId.has(route.itemId)) {
        this.passiveTrafficRoutesByItemId.set(route.itemId, route);
      }
    }
  }

  isStaticVisualBatchEligible(rendered) {
    return Boolean(
      rendered
      && rendered.object
      && !rendered.actor
      && rendered.item?.asset
      && !rendered.item?.underlayTileId
      && !isCameraOccludingBuildingItem(rendered.item)
      && !rendered.interactableIndicator
      && !this.interactablePlacementIds.has(rendered.id)
      && !rendered.object?.userData?.onWorldUpdate
      && !rendered.cameraOcclusionMaterialState
      && !rendered.shadowOverrides
      && getRenderedPlacementBaseVisible(rendered)
      && !(rendered.hiddenNodeNames?.size)
      && !(rendered.fadedNodeNames?.size)
      && !(rendered.visibleNodeNames?.size)
    );
  }

  requestStaticVisualBatchRefresh() {
    this.staticVisualBatchesDirty = true;
    if (!this.staticVisualBatchingSuspended) {
      this.refreshStaticVisualBatches();
    }
  }

  clearStaticVisualBatches({ restorePlacementObjects = true } = {}) {
    for (const batch of this.staticInstanceBatches.values()) {
      batch.root?.parent?.remove(batch.root);
      for (const mesh of batch.instancedMeshes ?? []) {
        mesh.dispose?.();
      }
    }

    this.staticInstanceBatches.clear();
    this.staticInstancedPropPickTargets.length = 0;
    this.staticInstanceRoot.clear();
    if (restorePlacementObjects) {
      for (const placementId of this.staticInstanceBatchedPlacementIds) {
        const rendered = this.renderedPlacements.get(placementId);
        if (!rendered?.object) {
          continue;
        }
        rendered.staticInstanceBatchKey = '';
        rendered.object.visible = getRenderedPlacementBaseVisible(rendered);
      }
    }
    this.staticInstanceBatchedPlacementIds.clear();
    this.staticVisualBatchStats.batchCount = 0;
    this.staticVisualBatchStats.instancedMeshCount = 0;
    this.staticVisualBatchStats.placementCount = 0;
  }

  createStaticVisualBatch(batchKey, entries) {
    const template = entries[0];
    const templateMeshes = collectRenderableMeshes(template.object, []);
    if (!templateMeshes.length) {
      return null;
    }

    const batchRoot = new THREE.Group();
    batchRoot.name = `StaticBatch:${template.layer}:${template.item.id}`;
    batchRoot.visible = true;
    const instancedMeshes = [];
    const placementIds = entries.map((entry) => entry.id);

    for (let meshIndex = 0; meshIndex < templateMeshes.length; meshIndex += 1) {
      const templateMesh = templateMeshes[meshIndex];
      const instancedMesh = new THREE.InstancedMesh(
        templateMesh.geometry,
        templateMesh.material,
        entries.length
      );
      instancedMesh.name = `${batchRoot.name}:mesh:${meshIndex}`;
      instancedMesh.castShadow = templateMesh.castShadow;
      instancedMesh.receiveShadow = templateMesh.receiveShadow;
      instancedMesh.renderOrder = templateMesh.renderOrder;
      instancedMesh.frustumCulled = false;
      instancedMesh.matrixAutoUpdate = false;
      instancedMesh.layers.mask = templateMesh.layers.mask;
      instancedMesh.userData.staticVisualBatch = true;
      instancedMesh.userData.instancePlacementIds = placementIds;

      for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const rendered = entries[entryIndex];
        const meshes = collectRenderableMeshes(rendered.object, this.staticVisualBatchMeshScratch);
        const sourceMesh = meshes[meshIndex];
        if (!sourceMesh) {
          continue;
        }
        instancedMesh.setMatrixAt(entryIndex, sourceMesh.matrixWorld);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      batchRoot.add(instancedMesh);
      instancedMeshes.push(instancedMesh);
      if (template.layer === 'prop') {
        this.staticInstancedPropPickTargets.push(instancedMesh);
      }
    }

    this.staticInstanceRoot.add(batchRoot);
    for (const rendered of entries) {
      rendered.staticInstanceBatchKey = batchKey;
      rendered.object.visible = false;
      this.staticInstanceBatchedPlacementIds.add(rendered.id);
    }

    return {
      key: batchKey,
      root: batchRoot,
      placementIds,
      instancedMeshes
    };
  }

  refreshStaticVisualBatches() {
    if (this.staticVisualBatchingSuspended) {
      this.staticVisualBatchesDirty = true;
      return;
    }

    this.staticVisualBatchesDirty = false;
    this.clearStaticVisualBatches();
    const groups = this.staticVisualBatchGroupScratch;
    groups.clear();

    for (const rendered of this.renderedPlacements.values()) {
      if (!this.isStaticVisualBatchEligible(rendered)) {
        continue;
      }

      const signature = getRenderedVisualBatchSignature(rendered, this.staticVisualBatchMeshScratch);
      if (!signature) {
        continue;
      }

      const key = `${rendered.layer}:${rendered.item.id}:${signature}`;
      let group = groups.get(key);
      if (!group) {
        group = [];
        groups.set(key, group);
      }
      group.push(rendered);
    }

    for (const [key, entries] of groups) {
      if (entries.length < STATIC_INSTANCE_BATCH_MIN_COUNT) {
        continue;
      }

      const batch = this.createStaticVisualBatch(key, entries);
      if (!batch) {
        continue;
      }
      this.staticInstanceBatches.set(key, batch);
      this.staticVisualBatchStats.batchCount += 1;
      this.staticVisualBatchStats.instancedMeshCount += batch.instancedMeshes.length;
      this.staticVisualBatchStats.placementCount += batch.placementIds.length;
    }

    groups.clear();
    this.reportStaticVisualBatchStats();
  }

  getStaticVisualBatchStats() {
    return {
      batchCount: this.staticVisualBatchStats.batchCount,
      instancedMeshCount: this.staticVisualBatchStats.instancedMeshCount,
      placementCount: this.staticVisualBatchStats.placementCount
    };
  }

  reportStaticVisualBatchStats() {
    if (!isLocalWorldDebugHost()) {
      return;
    }

    const stats = this.getStaticVisualBatchStats();
    const signature = `${stats.batchCount}:${stats.instancedMeshCount}:${stats.placementCount}`;
    if (signature === this.staticVisualBatchStatsSignature) {
      return;
    }

    this.staticVisualBatchStatsSignature = signature;
    console.info('[WorldRenderer] Static visual batching refreshed.', stats);
  }

  clear() {
    this.clearStaticVisualBatches({ restorePlacementObjects: false });
    this.clearCameraOcclusion();
    this.clearPassiveTraffic();
    for (const rendered of this.cameraOcclusionRenderedPlacements) {
      rendered.object.parent?.remove(rendered.object);
    }
    this.renderedPlacements.clear();
    this.updatingRenderedPlacements.clear();
    this.interactableIndicatorRenderedPlacements.clear();
    this.interactablePlacementIds.clear();
    this.cameraOcclusionRenderedPlacements.clear();
    this.actorPlacementIds.clear();
    this.staticColliderEntries.clear();
    this.interactableCache.clear();
    this.activeInteractableCacheKeys.clear();
    this.visibleStaticColliders = [];
    this.staticCollidersDirty = true;
    this.hiddenWorkoutPlacementIds.clear();
    this.lastVisibleWorkoutPlacementIds.clear();
    this.surfaceHeightByCell.clear();
    this.surfaceHeightIndexDirty = true;
    this.tileRoot.clear();
    this.propRoot.clear();
    this.staticInstanceRoot.clear();
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
      this.library.preload(modelUrls),
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
    for (const placementId of this.staticColliderEntries.keys()) {
      const entryColliders = this.staticColliderEntries.get(placementId);
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered || rendered.hidden) {
        continue;
      }
      for (let index = 0; index < entryColliders.length; index += 1) {
        colliders.push(entryColliders[index]);
      }
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

  hasUnobstructedLawSight(worldState, originX, originZ, targetX, targetZ) {
    if (!worldState?.forEachPlacementCollisionRect) {
      return true;
    }

    let blocked = false;
    worldState.forEachPlacementCollisionRect(({ rect }) => {
      if (blocked) {
        return;
      }

      const hitDistance = segmentRectIntersectionDistance(originX, originZ, targetX, targetZ, rect, {
        minDistance: NPC_LAW_VISIBILITY_BLOCKER_GRACE_DISTANCE
      });
      if (hitDistance != null) {
        blocked = true;
      }
    }, { collisionKey: 'blocksShots' });

    return !blocked;
  }

  syncNpcInteractRadiusIndicators(worldState, playerPosition = null) {
    for (const placementId of this.actorPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered?.actor) {
        continue;
      }

      const placement = worldState.getPlacement(placementId);
      const radius = placement?.npc?.interactRadius ?? rendered.item.interactionRadius ?? 4.2;
      const dx = (rendered.object.position.x ?? 0) - (playerPosition?.x ?? 0);
      const dz = (rendered.object.position.z ?? 0) - (playerPosition?.z ?? 0);
      const withinRadius = Boolean(
        playerPosition
        && placement?.layer === 'npc'
        && ((dx * dx) + (dz * dz)) < (radius * radius)
      );

      rendered.actor.setInteractRadiusVisible(this.npcInteractRadiusVisible || withinRadius);

      const lawRadius = getNpcLawRadius(placement?.npc);
      const lawDistanceSq = (dx * dx) + (dz * dz);
      const hasVisibleLawRadius = Boolean(
        placement?.layer === 'npc'
        && isPoliceOfficerNpc(placement.npc)
        && (
          this.npcInteractRadiusVisible
          || (
            playerPosition
            && lawDistanceSq <= lawRadius * lawRadius
            && this.hasUnobstructedLawSight(
              worldState,
              rendered.object.position.x ?? 0,
              rendered.object.position.z ?? 0,
              playerPosition.x,
              playerPosition.z
            )
          )
        )
      );
      rendered.actor.setLawRadiusVisible(hasVisibleLawRadius);
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
      cameraOcclusionBounds: actor ? null : new THREE.Box3(),
      cameraOcclusionBoundsDirty: true,
      cameraOcclusionMaterialState: null,
      staticInstanceBatchKey: '',
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
    this.trackUpdatingRenderedPlacement(renderedPlacement);
    this.trackCameraOcclusionRenderedPlacement(renderedPlacement);
    this.trackInteractablePlacement(renderedPlacement);
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
    this.requestStaticVisualBatchRefresh();

    this.refreshWorkoutPlacementState();
    if (placement.layer === 'tile') {
      this.refreshPassiveTraffic();
    }

    return renderedPlacement;
  }

  trackUpdatingRenderedPlacement(rendered) {
    if (
      rendered?.actor
      || typeof rendered?.object?.userData?.onWorldUpdate === 'function'
    ) {
      this.updatingRenderedPlacements.add(rendered);
    }
  }

  trackCameraOcclusionRenderedPlacement(rendered) {
    if (
      rendered?.cameraOcclusionObject
      && isCameraOccludingBuildingItem(rendered.item)
    ) {
      this.cameraOcclusionRenderedPlacements.add(rendered);
    }
  }

  trackInteractablePlacement(rendered) {
    if (!rendered?.id) {
      return;
    }

    const placement = rendered.placement;
    const item = rendered.item;
    if (
      placement?.layer === 'npc'
      || placement?.interactable
      || item?.interior
      || item?.interactable
    ) {
      this.interactablePlacementIds.add(rendered.id);
      return;
    }

    this.interactablePlacementIds.delete(rendered.id);
  }

  syncPlacementInteractableIndicator(rendered) {
    if (!rendered) {
      return;
    }

    const indicatorText = getPlacementInteractableIndicatorText(rendered.placement, rendered.item);
    const existingIndicator = rendered.interactableIndicator ?? null;
    if (existingIndicator?.userData?.indicatorText === indicatorText) {
      this.interactableIndicatorRenderedPlacements.add(rendered);
      return;
    }

    if (existingIndicator) {
      existingIndicator.parent?.remove(existingIndicator);
      rendered.interactableIndicator = null;
      this.interactableIndicatorRenderedPlacements.delete(rendered);
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
    this.interactableIndicatorRenderedPlacements.add(rendered);
  }

  updateInteractableIndicatorVisibility(resolver = null) {
    const hasResolver = typeof resolver === 'function';
    const worldPosition = this.indicatorVisibilityPosition;
    let visibleCount = 0;

    for (const rendered of this.interactableIndicatorRenderedPlacements) {
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
      if (visible) {
        visibleCount += 1;
      }
    }

    this.visibleInteractableIndicatorCount = visibleCount;
    return visibleCount;
  }

  hasVisibleInteractableIndicators() {
    return this.visibleInteractableIndicatorCount > 0;
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
        policeOfficerEnabled: placement.npc?.policeOfficerEnabled === true,
        lawRadius: placement.npc?.lawRadius,
        combat: placement.npc?.combat,
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
    this.passiveTrafficRoutesById.clear();
    this.passiveTrafficVisitCounter = 0;
    this.passiveTrafficNodeVisits.clear();
    this.passiveTrafficNodeVisitOrder.clear();
  }

  normalizePassiveTrafficServerStates(passiveTrafficState = EMPTY_MAP) {
    const nextStates = new Map();
    const appendState = (id, state) => {
      if (!state) {
        return;
      }
      const normalizedId = String(state.id || id || '');
      const itemId = String(state.itemId || '');
      if (!normalizedId || !PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(itemId)) {
        return;
      }
      nextStates.set(normalizedId, {
        id: normalizedId,
        itemId,
        routeId: String(state.routeId || ''),
        carIndex: Math.max(0, Math.floor(Number(state.carIndex) || 0)),
        x: Number(state.x) || 0,
        y: Number(state.y) || 0,
        z: Number(state.z) || 0,
        rotationY: Number(state.rotationY) || 0,
        speed: Number(state.speed) || 0,
        currentNodeIndex: Math.floor(Number(state.currentNodeIndex) || 0),
        targetNodeIndex: Math.floor(Number(state.targetNodeIndex) || 0),
        seq: Math.max(0, Math.floor(Number(state.seq) || 0))
      });
    };

    if (passiveTrafficState instanceof Map) {
      for (const [id, state] of passiveTrafficState) {
        appendState(id, state);
      }
      return nextStates;
    }

    if (passiveTrafficState && typeof passiveTrafficState === 'object') {
      for (const id in passiveTrafficState) {
        if (Object.hasOwn(passiveTrafficState, id)) {
          appendState(id, passiveTrafficState[id]);
        }
      }
    }

    return nextStates;
  }

  createPassiveTrafficServerSpecSignature(states = this.passiveTrafficServerStates) {
    return [...states.values()]
      .map((state) => `${state.carIndex}:${state.id}:${state.itemId}:${state.routeId}`)
      .sort()
      .join('|');
  }

  getPassiveTrafficCarSpecs() {
    if (this.passiveTrafficServerActive) {
      return [...this.passiveTrafficServerStates.values()]
        .sort((a, b) => (a.carIndex - b.carIndex) || a.id.localeCompare(b.id))
        .map((state) => ({
          id: state.id,
          itemId: state.itemId,
          routeId: state.routeId,
          route: null
        }));
    }

    return createPassiveTrafficCarSpecs(this.passiveTrafficRoutes);
  }

  setPassiveTrafficServerState(passiveTrafficState = EMPTY_MAP) {
    const nextStates = this.normalizePassiveTrafficServerStates(passiveTrafficState);
    const nextActive = nextStates.size > 0;
    const nextSpecSignature = this.createPassiveTrafficServerSpecSignature(nextStates);
    const shouldRefresh = nextActive !== this.passiveTrafficServerActive
      || nextSpecSignature !== this.passiveTrafficServerSpecSignature;

    this.passiveTrafficServerStates = nextStates;
    this.passiveTrafficServerActive = nextActive;
    this.passiveTrafficServerSpecSignature = nextSpecSignature;

    if (shouldRefresh) {
      this.passiveTrafficSignature = '';
      this.refreshPassiveTraffic();
    }
    if (this.passiveTrafficServerActive) {
      this.applyPassiveTrafficServerState();
    }
  }

  setPassiveTrafficRoutes(routes = []) {
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes(routes);
    this.syncPassiveTrafficRouteLookups();
    this.passiveTrafficSignature = '';
    this.refreshPassiveTraffic();
  }

  refreshPassiveTraffic() {
    if (this.passiveTrafficRefreshSuspended) {
      return;
    }

    const graph = buildPassiveTrafficRoadGraph(this.renderedPlacements);
    const hasTrafficRoads = graph.activeNodeIndices.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES;
    const routeSignature = createPassiveTrafficRouteSignature(this.passiveTrafficRoutes);
    const carSpecs = this.getPassiveTrafficCarSpecs();
    const carSignature = this.passiveTrafficServerActive
      ? `server:${this.passiveTrafficServerSpecSignature}`
      : `local:${carSpecs.map((spec, index) => `${index}:${spec.itemId}:${spec.routeId}`).join('|')}`;
    const nextSignature = hasTrafficRoads ? `${graph.signature}|routes:${routeSignature}|cars:${carSignature}` : '';
    if (
      nextSignature === this.passiveTrafficSignature
      && this.passiveTrafficCars.length === carSpecs.length
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

    void this.createPassiveTrafficCars(requestId, graph, nextSignature, carSpecs);
  }

  async createPassiveTrafficObject(itemId, carIndex, routeId = '') {
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
    object.userData.passiveTrafficRouteId = routeId;
    object.scale.multiplyScalar(PASSIVE_TRAFFIC_CAR_SCALE);
    object.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
      }
    });
    return object;
  }

  async createPassiveTrafficCars(requestId, graph, expectedSignature = graph?.signature ?? '', carSpecs = createPassiveTrafficCarSpecs(this.passiveTrafficRoutes)) {
    const carPromises = [];
    for (let carIndex = 0; carIndex < carSpecs.length; carIndex += 1) {
      const spec = carSpecs[carIndex];
      const itemId = spec.itemId;
      carPromises.push((async () => {
        try {
          const object = await this.createPassiveTrafficObject(itemId, carIndex, spec.routeId);
          return object ? this.createPassiveTrafficCarState(object, itemId, carIndex, graph, spec.routeId, spec.id ?? '') : null;
        } catch (error) {
          console.warn('[WorldRenderer] Failed to create passive traffic car.', {
            itemId,
            error
          });
          return null;
        }
      })());
    }
    const cars = await Promise.all(carPromises);

    if (requestId !== this.passiveTrafficLoadRequestId || expectedSignature !== this.passiveTrafficSignature) {
      for (const car of cars) {
        car?.object?.parent?.remove(car.object);
      }
      return;
    }

    this.passiveTrafficCars = [];
    for (const car of cars) {
      if (car) {
        this.passiveTrafficCars.push(car);
      }
    }
    for (const car of this.passiveTrafficCars) {
      this.passiveTrafficRoot.add(car.object);
    }
    if (this.passiveTrafficServerActive) {
      this.applyPassiveTrafficServerState(0, { snap: true });
    }
  }

  getPassiveTrafficCustomRouteNodeIndices(itemId, routeId = '', graph = this.passiveTrafficGraph) {
    const route = routeId
      ? this.passiveTrafficRoutesById.get(routeId)
      : this.passiveTrafficRoutesByItemId.get(itemId);
    if (!route || !graph) {
      return [];
    }

    const nodeIndices = getPassiveTrafficRouteNodeIndices(graph, route);
    if (nodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return [];
    }

    const componentIndex = graph.nodes?.[nodeIndices[0]]?.componentIndex;
    if (componentIndex === undefined) {
      return [];
    }

    return nodeIndices.every((nodeIndex) => graph.nodes?.[nodeIndex]?.componentIndex === componentIndex)
      ? nodeIndices
      : [];
  }

  createPassiveTrafficCarState(object, itemId, carIndex, graph, routeId = '', serverStateId = '') {
    const activeNodeIndices = graph?.activeNodeIndices ?? [];
    if (activeNodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return null;
    }

    const customRouteNodeIndices = this.getPassiveTrafficCustomRouteNodeIndices(itemId, routeId, graph);
    const activeComponents = graph.activeComponents?.length ? graph.activeComponents : [activeNodeIndices];
    const startComponent = activeComponents[carIndex % activeComponents.length] ?? activeNodeIndices;
    const componentCarSlot = Math.floor(carIndex / Math.max(1, activeComponents.length));
    const componentCarCount = Math.max(1, Math.ceil(PASSIVE_TRAFFIC_CAR_ITEM_IDS.length / Math.max(1, activeComponents.length)));
    const startOffset = (componentCarSlot + 0.18) / componentCarCount;
    const startIndex = customRouteNodeIndices[0]
      ?? startComponent[Math.floor(startOffset * startComponent.length) % startComponent.length];
    const car = {
      itemId,
      routeId,
      serverStateId,
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
      customRouteNodeIndices,
      customRouteCursor: 0,
      turnThroughNodeIndex: null,
      visitedNodeIndices: new Set(),
      speed: PASSIVE_TRAFFIC_SPEED * (PASSIVE_TRAFFIC_SPEED_FACTORS[carIndex % PASSIVE_TRAFFIC_SPEED_FACTORS.length] ?? 1),
      currentSpeed: 0,
      yaw: object.rotation.y,
      driveCommand: PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT,
      turnStopSeconds: 0,
      turnStopWaypointIndex: -1,
      turnStopSatisfied: false,
      turnWaypointActive: false,
      turnWaypointIndex: 0,
      turnWaypointQueue: [],
      turnWaypointCursor: 0,
      turnStartYaw: null,
      turnEndYaw: null,
      stuckSeconds: 0,
      collisionReverseSeconds: 0,
      collisionStopSeconds: 0,
      collisionCooldownSeconds: 0,
      playerCollisionActive: false,
      serverTargetPosition: new THREE.Vector3(),
      serverTargetYaw: object.rotation.y,
      serverStateSeq: -1,
      serverStateInitialized: false,
      lastPosition: new THREE.Vector3()
    };

    this.markPassiveTrafficNodeVisited(startIndex, car);
    this.assignPassiveTrafficRoute(car);
    if (car.targetNodeIndex === null) {
      return null;
    }

    const currentNode = graph.nodes[car.currentNodeIndex];
    const targetNode = graph.nodes[car.turnThroughNodeIndex ?? car.targetNodeIndex];
    getPassiveTrafficLanePositionAtNode(currentNode, targetNode, object.position);
    object.position.y = this.getSurfaceHeightAtPosition(object.position.x, object.position.z);
    car.yaw = Math.atan2(
      (targetNode?.x ?? currentNode.x) - currentNode.x,
      (targetNode?.z ?? currentNode.z) - currentNode.z
    );
    object.rotation.y = car.yaw;
    car.lastPosition.copy(object.position);
    return car;
  }

  markPassiveTrafficNodeVisited(nodeIndex, car = null) {
    this.passiveTrafficVisitCounter += 1;
    this.passiveTrafficNodeVisits.set(
      nodeIndex,
      (this.passiveTrafficNodeVisits.get(nodeIndex) ?? 0) + 1
    );
    this.passiveTrafficNodeVisitOrder.set(nodeIndex, this.passiveTrafficVisitCounter);
    car?.visitedNodeIndices?.add(nodeIndex);
  }

  getPassiveTrafficActiveNeighbors(nodeIndex) {
    const graph = this.passiveTrafficGraph;
    const node = graph?.nodes?.[nodeIndex];
    const neighbors = this.passiveTrafficActiveNeighbors;
    neighbors.length = 0;
    if (!node) {
      return neighbors;
    }

    for (const neighborIndex of node.neighbors) {
      if (graph.activeNodeSet.has(neighborIndex)) {
        neighbors.push(neighborIndex);
      }
    }
    return neighbors;
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
      desiredSpeed *= getPassiveTrafficTurnSpeedFactor(car);
    } else if (this.isPassiveTrafficApproachingTurn(car)) {
      const approachRatio = Math.max(0.28, Math.min(1, distanceToTarget / PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE));
      desiredSpeed *= approachRatio;
    }

    if (car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE) {
      desiredSpeed *= PASSIVE_TRAFFIC_REVERSE_SPEED_FACTOR;
    }

    return desiredSpeed;
  }

  getPassiveTrafficDestinationCandidates(car) {
    const graph = this.passiveTrafficGraph;
    const currentNode = graph?.nodes?.[car.currentNodeIndex];
    if (!graph || !currentNode) {
      return [];
    }

    const activeDestinations = this.passiveTrafficActiveDestinations;
    activeDestinations.clear();
    for (const otherCar of this.passiveTrafficCars) {
      if (!otherCar || otherCar === car) {
        continue;
      }
      const nodeIndex = otherCar.routeDestinationIndex ?? otherCar.targetNodeIndex;
      if (nodeIndex !== null && nodeIndex !== undefined) {
        activeDestinations.add(nodeIndex);
      }
    }
    const componentIndex = currentNode.componentIndex;
    const candidates = this.passiveTrafficDestinationCandidates;
    const candidatePool = this.passiveTrafficDestinationCandidatePool;
    const candidateNodeIndices = this.passiveTrafficDestinationCandidateNodeIndices;
    let candidateCount = 0;
    candidates.length = 0;
    candidateNodeIndices.length = 0;
    for (const nodeIndex of graph.activeNodeIndices) {
      const node = graph.nodes[nodeIndex];
      if (nodeIndex === car.currentNodeIndex || node?.componentIndex !== componentIndex) {
        continue;
      }

      const visitCount = this.passiveTrafficNodeVisits.get(nodeIndex) ?? 0;
      const lastVisitOrder = this.passiveTrafficNodeVisitOrder.get(nodeIndex) ?? -100000;
      let candidate = candidatePool[candidateCount];
      if (!candidate) {
        candidate = {
          nodeIndex: -1,
          carVisited: 0,
          visitCount: 0,
          lastVisitOrder: 0,
          distance: 0,
          activeDestination: 0,
          tieBreak: 0
        };
        candidatePool[candidateCount] = candidate;
      }
      candidate.nodeIndex = nodeIndex;
      candidate.carVisited = car.visitedNodeIndices?.has(nodeIndex) ? 1 : 0;
      candidate.visitCount = visitCount;
      candidate.lastVisitOrder = lastVisitOrder;
      candidate.distance = Math.abs(node.cellX - currentNode.cellX) + Math.abs(node.cellZ - currentNode.cellZ);
      candidate.activeDestination = activeDestinations.has(nodeIndex) ? 1 : 0;
      candidate.tieBreak = passiveTrafficTieBreak(nodeIndex, car.carIndex);
      candidates.push(candidate);
      candidateCount += 1;
    }

    if (!candidates.length) {
      return candidateNodeIndices;
    }

    candidates.sort((a, b) => (
      (a.carVisited - b.carVisited)
      || (a.visitCount - b.visitCount)
      || (a.activeDestination - b.activeDestination)
      || (a.lastVisitOrder - b.lastVisitOrder)
      || (b.distance - a.distance)
      || (a.tieBreak - b.tieBreak)
    ));
    candidates.length = Math.min(candidates.length, PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT);
    candidates.sort((a, b) => (
      (b.distance - a.distance)
      || (a.carVisited - b.carVisited)
      || (a.visitCount - b.visitCount)
      || (a.activeDestination - b.activeDestination)
      || (a.lastVisitOrder - b.lastVisitOrder)
      || (a.tieBreak - b.tieBreak)
    ));
    for (const candidate of candidates) {
      candidateNodeIndices.push(candidate.nodeIndex);
    }
    return candidateNodeIndices;
  }

  choosePassiveTrafficDestination(car) {
    return this.getPassiveTrafficDestinationCandidates(car)[0] ?? null;
  }

  isPassiveTrafficImmediateReverse(car, nextNodeIndex) {
    if (car.previousNodeIndex === null || car.previousNodeIndex === undefined || nextNodeIndex !== car.previousNodeIndex) {
      return false;
    }

    return this.getPassiveTrafficActiveNeighbors(car.currentNodeIndex)
      .some((neighborIndex) => neighborIndex !== car.previousNodeIndex);
  }

  choosePassiveTrafficFallbackNeighbor(car) {
    const graph = this.passiveTrafficGraph;
    const neighbors = this.getPassiveTrafficActiveNeighbors(car.currentNodeIndex);
    if (!graph || !neighbors.length) {
      return null;
    }

    return neighbors
      .map((nodeIndex) => ({
        nodeIndex,
        immediateReverse: this.isPassiveTrafficImmediateReverse(car, nodeIndex) ? 1 : 0,
        carVisited: car.visitedNodeIndices?.has(nodeIndex) ? 1 : 0,
        visitCount: this.passiveTrafficNodeVisits.get(nodeIndex) ?? 0,
        tieBreak: passiveTrafficTieBreak(nodeIndex, car.carIndex)
      }))
      .sort((a, b) => (
        (a.immediateReverse - b.immediateReverse)
        || (a.carVisited - b.carVisited)
        || (a.visitCount - b.visitCount)
        || (a.tieBreak - b.tieBreak)
      ))[0]?.nodeIndex ?? null;
  }

  assignPassiveTrafficCustomRoute(car) {
    const graph = this.passiveTrafficGraph;
    const routeNodes = car?.customRouteNodeIndices ?? [];
    if (!graph || routeNodes.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return false;
    }

    const lookahead = buildPassiveTrafficRouteLookahead(
      graph,
      routeNodes,
      car.currentNodeIndex,
      car.customRouteCursor
    );
    if (lookahead.route.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return false;
    }

    car.route = lookahead.route;
    car.routeCursor = 1;
    car.routeDestinationIndex = car.route[car.route.length - 1] ?? null;
    car.customRouteCursor = lookahead.cursor;
    return this.advancePassiveTrafficTarget(car);
  }

  assignPassiveTrafficRoute(car) {
    const graph = this.passiveTrafficGraph;
    if (!graph || !car) {
      return false;
    }

    if ((car.customRouteNodeIndices?.length ?? 0) >= PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      if (this.assignPassiveTrafficCustomRoute(car)) {
        return true;
      }
    }

    const destinationCandidates = this.getPassiveTrafficDestinationCandidates(car);
    let reverseRoute = null;
    let reverseDestinationIndex = null;
    for (const destinationIndex of destinationCandidates) {
      const route = findPassiveTrafficPath(graph, car.currentNodeIndex, destinationIndex);
      if (route.length < 2) {
        continue;
      }

      if (this.isPassiveTrafficImmediateReverse(car, route[1])) {
        reverseRoute ??= route;
        reverseDestinationIndex ??= destinationIndex;
        continue;
      }

      car.route = route;
      car.routeCursor = 1;
      car.routeDestinationIndex = destinationIndex;
      return this.advancePassiveTrafficTarget(car);
    }

    if (reverseRoute?.length >= 2) {
      car.route = reverseRoute;
      car.routeCursor = 1;
      car.routeDestinationIndex = reverseDestinationIndex;
      return this.advancePassiveTrafficTarget(car);
    }

    const fallback = this.choosePassiveTrafficFallbackNeighbor(car);
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

    const previousNode = graph.nodes?.[car.previousNodeIndex] ?? null;
    const departureScript = previousNode
      ? getPassiveTrafficDriveScript(previousNode, currentNode, routeNode)
      : null;
    const shouldScriptLeavingCurrentNode = Boolean(
      departureScript
      && (
        departureScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
        || departureScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
      )
      && departureScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
      && departureScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP
    );
    const nextRouteNodeIndex = car.route?.[car.routeCursor + 1] ?? null;
    const canScriptThroughRouteNode = nextRouteNodeIndex !== null
      && graph.activeNodeSet.has(nextRouteNodeIndex);
    const routeScript = canScriptThroughRouteNode
      ? getPassiveTrafficDriveScript(currentNode, routeNode, graph.nodes[nextRouteNodeIndex])
      : null;
    const shouldScriptThroughRouteNode = Boolean(
      !shouldScriptLeavingCurrentNode
      && routeScript
      && (
        routeScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
        || routeScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
        || routeScript.shouldStopAtEntry
      )
      && routeScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
      && routeScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP
    );
    const activeDriveScript = shouldScriptLeavingCurrentNode ? departureScript : routeScript;
    const finalNodeIndex = shouldScriptThroughRouteNode ? nextRouteNodeIndex : routeNodeIndex;
    const finalNode = graph.nodes[finalNodeIndex];
    if (!finalNode) {
      car.targetNodeIndex = null;
      return false;
    }

    car.targetNodeIndex = finalNodeIndex;
    car.routeAdvanceCount = shouldScriptThroughRouteNode ? 2 : 1;
    car.turnThroughNodeIndex = shouldScriptThroughRouteNode ? routeNodeIndex : null;
    car.driveCommand = (shouldScriptLeavingCurrentNode || shouldScriptThroughRouteNode)
      ? activeDriveScript.command
      : getPassiveTrafficDriveCommand(
        previousNode,
        currentNode,
        finalNode
      );
    car.turnWaypointActive = false;
    car.turnWaypointIndex = 0;
    car.turnStopWaypointIndex = -1;
    car.turnStopSatisfied = false;
    car.turnWaypointQueue.length = 0;
    car.turnWaypointCursor = 0;
    const turnYawRange = shouldScriptLeavingCurrentNode
      ? getPassiveTrafficTurnYawRange(previousNode, currentNode, finalNode)
      : (shouldScriptThroughRouteNode
        ? getPassiveTrafficTurnYawRange(currentNode, routeNode, finalNode)
        : null);
    car.turnStartYaw = turnYawRange?.startYaw ?? null;
    car.turnEndYaw = turnYawRange?.endYaw ?? null;
    getPassiveTrafficLanePosition(
      shouldScriptThroughRouteNode ? routeNode : currentNode,
      finalNode,
      car.finalTargetPosition
    );
    car.finalTargetPosition.y = this.getSurfaceHeightAtPosition(car.finalTargetPosition.x, car.finalTargetPosition.z);

    if (shouldScriptLeavingCurrentNode || shouldScriptThroughRouteNode) {
      const turnWaypoints = shouldScriptLeavingCurrentNode
        ? getPassiveTrafficTurnLaneWaypointsFromPosition(previousNode, currentNode, finalNode, car.object.position)
        : activeDriveScript.waypoints;
      for (const waypoint of turnWaypoints) {
        waypoint.y = this.getSurfaceHeightAtPosition(waypoint.x, waypoint.z);
        car.turnWaypointQueue.push(waypoint);
      }
      car.turnStopWaypointIndex = shouldScriptThroughRouteNode ? activeDriveScript.stopWaypointIndex : -1;
      const nextTurnWaypoint = car.turnWaypointCursor < car.turnWaypointQueue.length
        ? car.turnWaypointQueue[car.turnWaypointCursor]
        : null;
      car.turnWaypointCursor += nextTurnWaypoint ? 1 : 0;
      if (nextTurnWaypoint) {
        car.targetPosition.copy(nextTurnWaypoint);
        car.turnWaypointActive = true;
      } else {
        car.targetPosition.copy(car.finalTargetPosition);
        car.targetPosition.y = this.getSurfaceHeightAtPosition(car.targetPosition.x, car.targetPosition.z);
        car.turnWaypointActive = true;
      }
    } else {
      car.targetPosition.copy(car.finalTargetPosition);
    }

    return true;
  }

  getPassiveTrafficCarRoadNodes(car) {
    const graph = this.passiveTrafficGraph;
    if (!graph || !car) {
      return [];
    }

    return [
      graph.nodes?.[car.currentNodeIndex],
      graph.nodes?.[car.turnThroughNodeIndex],
      graph.nodes?.[car.targetNodeIndex],
      graph.nodes?.[car.previousNodeIndex]
    ].filter(Boolean);
  }

  keepPassiveTrafficCarOnRoad(car) {
    const roadNodes = this.getPassiveTrafficCarRoadNodes(car);
    if (!roadNodes.length) {
      return;
    }

    if (roadNodes.some((node) => isPassiveTrafficPositionInsideRoadNode(node, car.object.position))) {
      return;
    }

    clampPassiveTrafficPositionToRoadNodes(roadNodes, car.object.position, car.object.position);
    car.object.position.y = this.getSurfaceHeightAtPosition(car.object.position.x, car.object.position.z);
  }

  recoverPassiveTrafficIfStuck(car) {
    const graph = this.passiveTrafficGraph;
    if (!graph || !car) {
      return false;
    }

    const currentNode = graph.nodes?.[car.currentNodeIndex];
    if (!currentNode) {
      return false;
    }

    const reverseNeighbor = this.getPassiveTrafficActiveNeighbors(car.currentNodeIndex)
      .find((nodeIndex) => nodeIndex === car.previousNodeIndex)
      ?? this.choosePassiveTrafficFallbackNeighbor(car);
    if (reverseNeighbor === null || reverseNeighbor === undefined) {
      car.targetNodeIndex = null;
      return false;
    }

    car.route = [car.currentNodeIndex, reverseNeighbor];
    car.routeCursor = 1;
    car.routeDestinationIndex = reverseNeighbor;
    car.targetNodeIndex = null;
    car.turnThroughNodeIndex = null;
    car.routeAdvanceCount = 1;
    car.turnWaypointActive = false;
    car.turnWaypointQueue.length = 0;
    car.turnStartYaw = null;
    car.turnEndYaw = null;
    car.turnStopSeconds = 0;
    car.turnStopWaypointIndex = -1;
    car.turnStopSatisfied = false;
    car.stuckSeconds = 0;
    return this.advancePassiveTrafficTarget(car);
  }

  updatePassiveTrafficStuckState(car, deltaSeconds, movedDistance) {
    if (!car || car.targetNodeIndex === null || car.turnStopSeconds > 0) {
      return;
    }

    if (movedDistance <= PASSIVE_TRAFFIC_STUCK_DISTANCE && car.currentSpeed > car.speed * 0.2) {
      car.stuckSeconds += deltaSeconds;
    } else {
      car.stuckSeconds = Math.max(0, car.stuckSeconds - (deltaSeconds * 2));
    }

    if (car.stuckSeconds >= PASSIVE_TRAFFIC_STUCK_SECONDS) {
      this.recoverPassiveTrafficIfStuck(car);
    }
  }

  updatePassiveTrafficCollisionTimers(car, deltaSeconds) {
    car.collisionCooldownSeconds = Math.max(0, (car.collisionCooldownSeconds ?? 0) - deltaSeconds);
  }

  updatePassiveTrafficCollisionYield(car, remainingTime) {
    if (!car || remainingTime <= 0) {
      return 0;
    }

    if ((car.collisionReverseSeconds ?? 0) > 0) {
      const reverseSeconds = Math.min(remainingTime, car.collisionReverseSeconds);
      car.collisionReverseSeconds = Math.max(0, car.collisionReverseSeconds - reverseSeconds);
      const reverseDistance = car.speed * PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SPEED_FACTOR * reverseSeconds;
      const forward = getPassiveTrafficForwardVector(car.yaw, this.passiveTrafficForwardScratch);
      car.object.position.x -= forward.x * reverseDistance;
      car.object.position.z -= forward.z * reverseDistance;
      this.keepPassiveTrafficCarOnRoad(car);
      car.object.position.y = this.getSurfaceHeightAtPosition(car.object.position.x, car.object.position.z);
      car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, reverseSeconds);
      car.stuckSeconds = 0;
      if (car.collisionReverseSeconds <= 0) {
        car.collisionStopSeconds = Math.max(car.collisionStopSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS);
      }
      return reverseSeconds;
    }

    if ((car.collisionStopSeconds ?? 0) > 0) {
      const stopSeconds = Math.min(remainingTime, car.collisionStopSeconds);
      car.collisionStopSeconds = Math.max(0, car.collisionStopSeconds - stopSeconds);
      car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, stopSeconds);
      car.stuckSeconds = 0;
      return stopSeconds;
    }

    return 0;
  }

  choosePassiveTrafficCollisionYieldCar(a, b) {
    const aForward = getPassiveTrafficForwardVector(a.yaw, { x: 0, z: 1 });
    const bForward = getPassiveTrafficForwardVector(b.yaw, { x: 0, z: 1 });
    const dx = b.object.position.x - a.object.position.x;
    const dz = b.object.position.z - a.object.position.z;
    const bAheadOfA = (dx * aForward.x) + (dz * aForward.z);
    const aAheadOfB = ((-dx) * bForward.x) + ((-dz) * bForward.z);

    if (bAheadOfA > 0.2 && aAheadOfB <= 0.2) {
      return a;
    }
    if (aAheadOfB > 0.2 && bAheadOfA <= 0.2) {
      return b;
    }

    if ((a.currentSpeed ?? 0) < (b.currentSpeed ?? 0) - 0.05) {
      return a;
    }
    if ((b.currentSpeed ?? 0) < (a.currentSpeed ?? 0) - 0.05) {
      return b;
    }

    return (a.carIndex ?? 0) > (b.carIndex ?? 0) ? a : b;
  }

  triggerPassiveTrafficCarCollisionYield(car) {
    if (!car) {
      return;
    }

    car.collisionReverseSeconds = Math.max(car.collisionReverseSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS);
    car.collisionStopSeconds = Math.max(car.collisionStopSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS);
    car.collisionCooldownSeconds = Math.max(car.collisionCooldownSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS);
    car.turnStopSeconds = 0;
    car.currentSpeed = 0;
    car.stuckSeconds = 0;
  }

  updatePassiveTrafficCarCollisions() {
    if (this.passiveTrafficCars.length < 2) {
      return;
    }

    for (let aIndex = 0; aIndex < this.passiveTrafficCars.length - 1; aIndex += 1) {
      const a = this.passiveTrafficCars[aIndex];
      if (!a?.object) {
        continue;
      }

      for (let bIndex = aIndex + 1; bIndex < this.passiveTrafficCars.length; bIndex += 1) {
        const b = this.passiveTrafficCars[bIndex];
        if (
          !b?.object
          || (a.collisionCooldownSeconds ?? 0) > 0
          || (b.collisionCooldownSeconds ?? 0) > 0
        ) {
          continue;
        }

        if (!passiveTrafficHitboxesOverlap(a.object.position, a.yaw, b.object.position, b.yaw, 0.08)) {
          continue;
        }

        const yieldCar = this.choosePassiveTrafficCollisionYieldCar(a, b);
        const continueCar = yieldCar === a ? b : a;
        this.triggerPassiveTrafficCarCollisionYield(yieldCar);
        continueCar.collisionCooldownSeconds = Math.max(
          continueCar.collisionCooldownSeconds ?? 0,
          PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS
        );
      }
    }
  }

  updatePassiveTrafficPlayerCollisions() {
    const target = this.getPassiveTrafficPlayerCollisionTarget?.() ?? null;
    const targetPosition = target?.position ?? target;
    const targetAlive = target?.alive !== false;
    const targetRadius = Number.isFinite(target?.radius) ? Math.max(0, target.radius) : 0;
    const targetTransportKind = String(target?.transportKind ?? '');
    const targetYaw = Number.isFinite(target?.yaw) ? target.yaw : 0;
    if (!targetPosition || !targetAlive || !this.onPassiveTrafficPlayerCollision) {
      for (const car of this.passiveTrafficCars) {
        car.playerCollisionActive = false;
      }
      return;
    }

    for (const car of this.passiveTrafficCars) {
      if (!car?.object) {
        continue;
      }

      const overlapping = targetTransportKind === 'car'
        ? passiveTrafficHitboxesOverlap(car.object.position, car.yaw, targetPosition, targetYaw)
        : isPointInsidePassiveTrafficHitbox(
          car.object.position,
          car.yaw,
          targetPosition,
          targetRadius
        );
      if (!overlapping) {
        car.playerCollisionActive = false;
        continue;
      }
      if (car.playerCollisionActive) {
        continue;
      }

      car.playerCollisionActive = true;
      const forward = getPassiveTrafficForwardVector(car.yaw, { x: 0, z: 1 });
      this.onPassiveTrafficPlayerCollision({
        carIndex: car.carIndex,
        itemId: car.itemId,
        routeId: car.routeId,
        damage: PASSIVE_TRAFFIC_PLAYER_COLLISION_DAMAGE,
        stunSeconds: PASSIVE_TRAFFIC_PLAYER_STUN_SECONDS,
        transportKind: targetTransportKind,
        carPosition: {
          x: car.object.position.x,
          y: car.object.position.y,
          z: car.object.position.z
        },
        carYaw: car.yaw,
        direction: {
          x: forward.x,
          z: forward.z
        }
      });
    }
  }

  getPassiveTrafficServerStateForCar(car) {
    if (!this.passiveTrafficServerActive || !car) {
      return null;
    }

    if (car.serverStateId && this.passiveTrafficServerStates.has(car.serverStateId)) {
      return this.passiveTrafficServerStates.get(car.serverStateId);
    }

    for (const state of this.passiveTrafficServerStates.values()) {
      if (state.carIndex === car.carIndex && state.itemId === car.itemId && state.routeId === car.routeId) {
        return state;
      }
    }

    return null;
  }

  applyPassiveTrafficServerState(deltaSeconds = 0, options = {}) {
    if (!this.passiveTrafficServerActive) {
      return;
    }

    const snapAll = Boolean(options.snap);
    const dt = Math.max(0, Math.min(0.12, Number(deltaSeconds) || 0));
    const renderAlpha = snapAll || dt <= 0
      ? 0
      : 1 - Math.exp(-PASSIVE_TRAFFIC_SERVER_RENDER_RESPONSE * dt);
    const snapDistanceSq = PASSIVE_TRAFFIC_SERVER_SNAP_DISTANCE * PASSIVE_TRAFFIC_SERVER_SNAP_DISTANCE;

    for (const car of this.passiveTrafficCars) {
      const state = this.getPassiveTrafficServerStateForCar(car);
      if (!state || !car?.object) {
        continue;
      }

      const targetY = this.getSurfaceHeightAtPosition(state.x, state.z);
      this.passiveTrafficTargetScratch.set(state.x, targetY, state.z);
      if (!car.serverTargetPosition) {
        car.serverTargetPosition = new THREE.Vector3();
      }
      const targetChanged = car.serverStateSeq !== state.seq
        || car.serverTargetPosition.distanceToSquared(this.passiveTrafficTargetScratch) > 0.001 * 0.001
        || Math.abs(normalizeAngleRadians((car.serverTargetYaw ?? 0) - state.rotationY)) > 0.001;
      if (targetChanged) {
        car.serverTargetPosition.copy(this.passiveTrafficTargetScratch);
        car.serverTargetYaw = state.rotationY;
        car.serverStateSeq = state.seq;
      }

      const shouldSnap = snapAll
        || !car.serverStateInitialized
        || car.object.position.distanceToSquared(car.serverTargetPosition) > snapDistanceSq;
      if (shouldSnap) {
        car.object.position.copy(car.serverTargetPosition);
        car.yaw = car.serverTargetYaw;
        car.object.rotation.y = car.yaw;
        car.serverStateInitialized = true;
      } else if (renderAlpha > 0) {
        car.object.position.lerp(car.serverTargetPosition, renderAlpha);
        car.object.position.y = this.getSurfaceHeightAtPosition(car.object.position.x, car.object.position.z);
        car.yaw = dampAngleRadians(car.yaw, car.serverTargetYaw, PASSIVE_TRAFFIC_SERVER_RENDER_RESPONSE, dt);
        car.object.rotation.y = car.yaw;
      }

      car.currentSpeed = state.speed;
      car.currentNodeIndex = state.currentNodeIndex;
      car.targetNodeIndex = state.targetNodeIndex >= 0 ? state.targetNodeIndex : null;
      car.lastPosition.copy(car.object.position);
    }
  }

  updatePassiveTraffic(deltaSeconds) {
    if (!this.passiveTrafficCars.length || !this.passiveTrafficGraph) {
      return;
    }

    if (this.passiveTrafficServerActive) {
      this.applyPassiveTrafficServerState(deltaSeconds);
      this.updatePassiveTrafficPlayerCollisions();
      return;
    }

    const dt = Math.max(0, Math.min(0.08, Number(deltaSeconds) || 0));
    if (dt <= 0) {
      return;
    }

    for (const car of this.passiveTrafficCars) {
      this.updatePassiveTrafficCollisionTimers(car, dt);
      const startX = car.object.position.x;
      const startZ = car.object.position.z;
      let remainingTime = dt;
      let guard = 0;

      while (remainingTime > 0.0001 && guard < 6) {
        guard += 1;
        const collisionYieldSeconds = this.updatePassiveTrafficCollisionYield(car, remainingTime);
        if (collisionYieldSeconds > 0) {
          remainingTime -= collisionYieldSeconds;
          if ((car.collisionReverseSeconds ?? 0) > 0 || (car.collisionStopSeconds ?? 0) > 0) {
            break;
          }
          continue;
        }

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
          this.keepPassiveTrafficCarOnRoad(car);
          if (car.turnWaypointActive) {
            if (
              car.turnWaypointIndex === car.turnStopWaypointIndex
              && !car.turnStopSatisfied
            ) {
              car.turnStopSatisfied = true;
              car.turnStopSeconds = Math.max(car.turnStopSeconds, this.getPassiveTrafficTurnStopSeconds(car));
              car.currentSpeed = 0;
              break;
            }

            const nextTurnWaypoint = car.turnWaypointCursor < car.turnWaypointQueue.length
              ? car.turnWaypointQueue[car.turnWaypointCursor]
              : null;
            car.turnWaypointCursor += nextTurnWaypoint ? 1 : 0;
            if (nextTurnWaypoint) {
              car.turnWaypointIndex += 1;
              car.targetPosition.copy(nextTurnWaypoint);
              continue;
            }

            car.turnWaypointActive = false;
            car.turnWaypointCursor = 0;
            car.turnWaypointQueue.length = 0;
            car.targetPosition.copy(car.finalTargetPosition);
            continue;
          }

          const arrivedNodeIndex = car.targetNodeIndex;
          const throughNodeIndex = car.turnThroughNodeIndex;
          const routeAdvanceCount = Math.max(1, car.routeAdvanceCount ?? 1);
          if (throughNodeIndex !== null && throughNodeIndex !== undefined && throughNodeIndex !== car.currentNodeIndex) {
            this.markPassiveTrafficNodeVisited(throughNodeIndex, car);
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
          this.markPassiveTrafficNodeVisited(car.currentNodeIndex, car);
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
        this.keepPassiveTrafficCarOnRoad(car);
        car.object.position.y = this.getSurfaceHeightAtPosition(car.object.position.x, car.object.position.z);
        const stepDuration = step / moveSpeed;
        remainingTime -= stepDuration;

        let targetYaw = Math.atan2(toTarget.x, toTarget.z);
        if (
          car.turnWaypointActive
          && (
            car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
            || car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
          )
          && Number.isFinite(car.turnStartYaw)
          && Number.isFinite(car.turnEndYaw)
        ) {
          targetYaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, targetYaw);
          car.yaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, car.yaw);
        }
        car.yaw = dampAngleRadians(car.yaw, targetYaw, PASSIVE_TRAFFIC_TURN_RESPONSE, stepDuration);
        if (
          car.turnWaypointActive
          && Number.isFinite(car.turnStartYaw)
          && Number.isFinite(car.turnEndYaw)
        ) {
          car.yaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, car.yaw);
        }
        car.object.rotation.y = car.yaw;

        if (step < distance) {
          break;
        }
      }

      const movedDistance = Math.hypot(car.object.position.x - startX, car.object.position.z - startZ);
      this.updatePassiveTrafficStuckState(car, dt, movedDistance);
      car.lastPosition.copy(car.object.position);
    }

    this.updatePassiveTrafficCarCollisions();
    this.updatePassiveTrafficPlayerCollisions();
  }

  update(deltaSeconds, now = performance.now()) {
    const timeSeconds = now * 0.001;
    for (const rendered of this.updatingRenderedPlacements) {
      rendered.actor?.update(deltaSeconds);
      const onWorldUpdate = rendered.object?.userData?.onWorldUpdate;
      if (typeof onWorldUpdate === 'function') {
        onWorldUpdate(deltaSeconds, timeSeconds);
      }
    }
    this.updatePassiveTraffic(deltaSeconds);

    if (this.npcDebugVisible) {
      this.refreshNpcDebugGizmos();
    }
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

    for (const rendered of this.cameraOcclusionRenderedPlacements) {
      if (excludedPlacementIds.has(rendered.id)) {
        continue;
      }

      if (this.isPlacementVisibleForCameraOcclusion(rendered)) {
        candidates.push(rendered);
      }
    }

    return candidates;
  }

  getRenderedCameraOcclusionBounds(rendered) {
    if (!rendered?.cameraOcclusionObject || !rendered.cameraOcclusionBounds) {
      return null;
    }

    if (
      !rendered.cameraOcclusionBoundsDirty
      && boxHasFiniteExtents(rendered.cameraOcclusionBounds)
    ) {
      return rendered.cameraOcclusionBounds;
    }

    const bounds = getVisibleObjectBounds(
      rendered.cameraOcclusionObject,
      rendered.cameraOcclusionBounds,
      this.cameraOcclusionNodeBounds
    );
    rendered.cameraOcclusionBoundsDirty = false;
    return bounds;
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

    const boundedCandidates = this.cameraOcclusionBoundedCandidates;
    boundedCandidates.length = 0;
    for (const rendered of candidates) {
      if (this.getRenderedCameraOcclusionBounds(rendered)) {
        boundedCandidates.push(rendered);
      }
    }
    if (!boundedCandidates.length) {
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

      for (const rendered of boundedCandidates) {
        if (nextOccludedPlacementIds.has(rendered.id)) {
          continue;
        }

        const bounds = rendered.cameraOcclusionBounds;
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
          && hit.distanceToSquared(camera.position) <= this.cameraOcclusionRaycaster.far * this.cameraOcclusionRaycaster.far
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
    this.trackInteractablePlacement(rendered);
    rendered.surfaceHeight = placement.layer === 'tile'
      ? (rendered.item.surfaceHeight ?? 0)
      : null;

    if (rendered.actor) {
      rendered.actor.applyPlacement({
        position: placement.position,
        y: this.getSurfaceHeightAtPosition(placement.position[0], placement.position[1]),
        rotationQuarterTurns: placement.rotationQuarterTurns,
        interactRadius: placement.npc?.interactRadius ?? rendered.item.interactionRadius,
        policeOfficerEnabled: placement.npc?.policeOfficerEnabled === true,
        lawRadius: placement.npc?.lawRadius,
        combat: placement.npc?.combat,
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
      rendered.cameraOcclusionBoundsDirty = true;
    }

    if (rendered.actor) {
      rendered.colliders = createPlacementColliders(rendered.object, rendered.item, placement, rendered.actor);
    } else {
      rendered.colliders = createPlacementColliders(rendered.colliderObject, rendered.item, placement, null);
      this.refreshStaticColliderEntry(rendered);
    }

    this.syncPlacementInteractableIndicator(rendered);
    this.requestStaticVisualBatchRefresh();

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
    this.requestStaticVisualBatchRefresh();
  }

  setPlacementVisualHidden(id, hidden) {
    const rendered = this.renderedPlacements.get(id);
    if (!rendered) {
      return;
    }

    rendered.visualHidden = Boolean(hidden);
    this.applyPlacementVisibility(rendered);
    this.requestStaticVisualBatchRefresh();
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
      rendered.cameraOcclusionBoundsDirty = true;
    }

    rendered.hiddenNodeNames = nextHiddenNodeNames;
    rendered.fadedNodeNames = nextFadedNodeNames;
    rendered.fadedNodeOpacity = nextFadedNodeOpacity;
    rendered.visibleNodeNames = nextVisibleNodeNames;
    rendered.shadowOverrides = nextShadowOverrides;
    this.applyPlacementVisibility(rendered);
    this.requestStaticVisualBatchRefresh();
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
    this.updatingRenderedPlacements.delete(rendered);
    this.interactableIndicatorRenderedPlacements.delete(rendered);
    this.interactablePlacementIds.delete(id);
    this.cameraOcclusionRenderedPlacements.delete(rendered);
    this.actorPlacementIds.delete(id);
    this.npcSpeechAnchorVectors.delete(id);
    this.staticColliderEntries.delete(id);
    this.markStaticCollidersDirty();
    if (rendered.layer === 'tile') {
      this.markSurfaceHeightIndexDirty();
      this.refreshPassiveTraffic();
    }
    this.requestStaticVisualBatchRefresh();
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

    for (const placementId of this.interactablePlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      const placement = rendered?.placement ?? worldState?.getPlacement?.(placementId);
      const item = rendered?.item ?? getBuilderItemById(placement?.itemId);
      if (!rendered || rendered.hidden || !item) {
        continue;
      }

      if (placement.layer === 'npc' && placement.npc) {
        const runtimeState = this.npcRuntimeState.get(placement.id);
        if (runtimeState?.mode === NPC_RUNTIME_MODES.hidden || runtimeState?.alive === false) {
          continue;
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
        continue;
      }

      const interactable = resolvePlacementInteractableDefinition(placement, item);
      if (!interactable || isInlineInteriorMode(interactable.interior?.mode)) {
        continue;
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
        continue;
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
    }

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

    rendered.object.visible = visible && !rendered.staticInstanceBatchKey;
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
    rendered.cameraOcclusionBoundsDirty = true;
    if (rendered.actor?.pickProxy) {
      rendered.actor.pickProxy.visible = visible;
    }
  }

  refreshWorkoutPlacementState(worldState = null) {
    const resolvedWorldState = worldState ?? {
      getPlacement: (placementId) => this.renderedPlacements.get(placementId)?.placement ?? null
    };
    const visibleWorkoutPlacementIds = this.getVisibleWorkoutPlacementIds(resolvedWorldState);
    if (nodeNameSetsEqual(visibleWorkoutPlacementIds, this.lastVisibleWorkoutPlacementIds)) {
      return;
    }

    const idsToSync = this.workoutPlacementIdsToSync;
    idsToSync.clear();
    for (const placementId of this.hiddenWorkoutPlacementIds) {
      idsToSync.add(placementId);
    }
    for (const placementId of visibleWorkoutPlacementIds) {
      idsToSync.add(placementId);
    }

    for (const placementId of idsToSync) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered) {
        continue;
      }

      const nextWorkoutHidden = visibleWorkoutPlacementIds.has(rendered.id);
      if (rendered.workoutHidden === nextWorkoutHidden) {
        continue;
      }

      rendered.workoutHidden = nextWorkoutHidden;
      this.applyPlacementVisibility(rendered);
    }

    this.hiddenWorkoutPlacementIds.clear();
    for (const placementId of visibleWorkoutPlacementIds) {
      this.hiddenWorkoutPlacementIds.add(placementId);
    }
    this.lastVisibleWorkoutPlacementIds.clear();
    for (const placementId of visibleWorkoutPlacementIds) {
      this.lastVisibleWorkoutPlacementIds.add(placementId);
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
        || !isInlineInteriorMode(interactable.interior.mode)
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

  applyNpcRuntimeState(npcStateMap = EMPTY_MAP) {
    this.npcRuntimeState = npcStateMap instanceof Map ? npcStateMap : new Map(npcStateMap);

    for (const placementId of this.actorPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered?.actor) {
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
    playerStateMap = EMPTY_MAP,
    {
      pendingPlacementId = '',
      claimedPlacementId = '',
      activePlacementId = ''
    } = {}
  ) {
    this.playerState = playerStateMap instanceof Map ? playerStateMap : new Map(playerStateMap);
    this.localWorkoutState = {
      pendingPlacementId: typeof pendingPlacementId === 'string' ? pendingPlacementId : '',
      claimedPlacementId: typeof claimedPlacementId === 'string' ? claimedPlacementId : '',
      activePlacementId: typeof activePlacementId === 'string' ? activePlacementId : ''
    };
    this.refreshWorkoutPlacementState();
  }

  applyNpcFocusTargets(npcFocusTargets = EMPTY_MAP) {
    this.npcFocusTargets.clear();
    for (const npcId of npcFocusTargets.keys()) {
      const target = npcFocusTargets.get(npcId);
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
        continue;
      }
      this.npcFocusTargets.set(npcId, {
        x: Number(target.x),
        z: Number(target.z)
      });
    }

    for (const placementId of this.actorPlacementIds) {
      const rendered = this.renderedPlacements.get(placementId);
      if (!rendered?.actor) {
        continue;
      }

      rendered.actor.setFocusTarget(this.npcFocusTargets.get(placementId) ?? null);
    }
  }

  applyNpcDebugState(npcDebugMap = EMPTY_MAP) {
    this.npcDebugState = npcDebugMap instanceof Map ? npcDebugMap : new Map(npcDebugMap);
    this.refreshNpcDebugGizmos();
  }

  setNpcRoutinePreview(preview = [], { visible = true } = {}) {
    this.npcRoutinePreview = [];
    if (Array.isArray(preview)) {
      for (const entry of preview) {
        this.npcRoutinePreview.push(copyNpcRoutinePreviewEntry(entry));
      }
    }
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
    this.staticInstanceRoot.visible = nextVisible;
    this.npcDebugRoot.visible = nextVisible && this.npcDebugVisible;
    this.npcRoutineRoot.visible = nextVisible && this.npcRoutineVisible;
  }

  pickPlacementId(pointer, camera = this.camera) {
    const pickTargets = [];

    for (const rendered of this.renderedPlacements.values()) {
      if (
        rendered.hidden
        || rendered.visualHidden
        || rendered.staticInstanceBatchKey
        || rendered.placement?.layer === 'tile'
      ) {
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
    for (const instancedMesh of this.staticInstancedPropPickTargets) {
      if (this.staticInstanceRoot.visible && instancedMesh.visible && instancedMesh.parent?.visible !== false) {
        pickTargets.push(instancedMesh);
      }
    }

    if (!pickTargets.length) {
      return null;
    }

    this.raycaster.setFromCamera(pointer, camera);
    const intersections = this.raycaster.intersectObjects(pickTargets, true);
    for (const intersection of intersections) {
      const instancedPlacementId = getInstancedPlacementId(intersection);
      if (instancedPlacementId) {
        return instancedPlacementId;
      }
      const placementId = extractPlacementId(intersection.object);
      if (placementId) {
        return placementId;
      }
    }
    return null;
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

  getNpcSpeechAnchor(placementId, target = null) {
    const id = String(placementId ?? '');
    const rendered = id ? this.renderedPlacements.get(id) : null;
    if (!rendered?.actor || rendered.actor.runtimeState?.mode === NPC_RUNTIME_MODES.hidden) {
      if (id && !rendered) {
        this.npcSpeechAnchorVectors.delete(id);
      }
      return null;
    }

    let anchor = target;
    if (!anchor) {
      anchor = this.npcSpeechAnchorVectors.get(id);
      if (!anchor) {
        anchor = new THREE.Vector3();
        this.npcSpeechAnchorVectors.set(id, anchor);
      }
    }

    return rendered.actor.getSpeechAnchorWorldPosition(anchor);
  }

  getNpcSpeechAnchors() {
    const anchors = this.npcSpeechAnchors;
    anchors.clear();

    for (const placementId of this.actorPlacementIds) {
      const anchor = this.getNpcSpeechAnchor(placementId);
      if (anchor) {
        anchors.set(placementId, anchor);
      }
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

    for (let index = 0; index < this.npcRoutinePreview.length; index += 1) {
      const entry = this.npcRoutinePreview[index];
      if (!entry?.point) {
        continue;
      }

      const marker = createNpcRoutineMarker(getNpcRoutineStepColor(entry.stepType, entry.activePick), 0.17);
      const worldPoint = this.toNpcDebugWorldPoint(entry.point, 0.26 + (index * 0.08));
      if (!worldPoint) {
        continue;
      }

      marker.position.copy(worldPoint);
      marker.visible = true;
      this.npcRoutineRoot.add(marker);

      if (entry.originPoint && !areDebugPointsClose(entry.originPoint, entry.point, 0.2)) {
        const originWorldPoint = this.toNpcDebugWorldPoint(entry.originPoint, 0.08);
        if (originWorldPoint) {
          const line = new THREE.Line(
            createDebugLineGeometry(originWorldPoint, worldPoint),
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
    }
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
    const path = Array.isArray(debug.path) ? debug.path : [];
    for (let index = Math.max(0, debug.pathIndex ?? 0); index < path.length; index += 1) {
      pushPoint(path[index]);
    }
    pushPoint(debug.finalTarget);

    const worldPoints = [];
    for (let index = 0; index < pathPoints.length; index += 1) {
      const worldPoint = this.toNpcDebugWorldPoint(pathPoints[index], index === 0 ? 0.34 : 0.22);
      if (worldPoint) {
        worldPoints.push(worldPoint);
      }
    }

    replaceLineGeometry(this.npcDebugPathLine, worldPoints);
    this.npcDebugRoot.visible = this.tileRoot.visible && this.npcDebugVisible;
    this.setNpcDebugMarkerPosition(this.npcDebugSteeringMarker, debug.steeringTarget, 0.3);
    this.setNpcDebugMarkerPosition(this.npcDebugNextMarker, debug.nextPathPoint, 0.26);
    this.setNpcDebugMarkerPosition(this.npcDebugTargetMarker, debug.finalTarget, 0.34);
    this.setNpcDebugMarkerPosition(this.npcDebugApproachMarker, debug.targetApproach, 0.24);
  }
}
