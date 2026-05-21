import * as THREE from 'three';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { getBuilderItemById } from './builderCatalog.js';

export const PASSIVE_TRAFFIC_CAR_ITEM_IDS = Object.freeze([
  'car_sedan',
  'car_stationwagon',
  'car_taxi',
  'car_police'
]);

export const PASSIVE_TRAFFIC_CAR_SCALE = 0.68;
export const PASSIVE_TRAFFIC_SPEED = BUILDER_TILE_SIZE;
export const PASSIVE_TRAFFIC_LANE_OFFSET = BUILDER_TILE_SIZE * 0.165;
export const PASSIVE_TRAFFIC_MAX_TURN_RADIANS = Math.PI / 2;
export const PASSIVE_TRAFFIC_MIN_ROAD_NODES = 2;
export const PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH = 2.35;
export const PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH = 4.35;
export const PASSIVE_TRAFFIC_PLAYER_COLLISION_DAMAGE = 20;
export const PASSIVE_TRAFFIC_PLAYER_STUN_SECONDS = 1.5;
export const PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS = 0.36;
export const PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS = 0.48;
export const PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS = 0.95;
export const PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SPEED_FACTOR = 0.38;
export const PASSIVE_TRAFFIC_DRIVE_COMMANDS = Object.freeze({
  STRAIGHT: 'straight',
  TURN_LEFT: 'turn_left',
  TURN_RIGHT: 'turn_right',
  REVERSE: 'reverse',
  STOP: 'stop'
});

const CARDINAL_DIRECTIONS = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: -1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: 0, z: -1 })
]);
const ROAD_EXIT_DIRECTIONS = Object.freeze({
  north: Object.freeze({ x: 0, z: -1 }),
  east: Object.freeze({ x: 1, z: 0 }),
  south: Object.freeze({ x: 0, z: 1 }),
  west: Object.freeze({ x: -1, z: 0 })
});
const ROAD_ALL_EXITS = Object.freeze([
  ROAD_EXIT_DIRECTIONS.north,
  ROAD_EXIT_DIRECTIONS.east,
  ROAD_EXIT_DIRECTIONS.south,
  ROAD_EXIT_DIRECTIONS.west
]);
const ROAD_STRAIGHT_EXITS = Object.freeze([
  ROAD_EXIT_DIRECTIONS.north,
  ROAD_EXIT_DIRECTIONS.south
]);
const ROAD_CORNER_EXITS = Object.freeze([
  ROAD_EXIT_DIRECTIONS.north,
  ROAD_EXIT_DIRECTIONS.east
]);
const ROAD_TSPLIT_EXITS = Object.freeze([
  ROAD_EXIT_DIRECTIONS.north,
  ROAD_EXIT_DIRECTIONS.east,
  ROAD_EXIT_DIRECTIONS.west
]);
const PASSIVE_TRAFFIC_TURN_WAYPOINT_TIMES = Object.freeze([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
const PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE = BUILDER_TILE_SIZE * 0.5;
const PASSIVE_TRAFFIC_ROAD_TILE_EDGE_INSET = BUILDER_TILE_SIZE * 0.015;
const PASSIVE_TRAFFIC_JUNCTION_ITEM_PATTERN = /(?:road_cross|road_junction|road_tsplit)/;
const PASSIVE_TRAFFIC_CROSSWALK_ITEM_PATTERN = /(?:road_cross|road_straight_crossing)/;
const TURN_START_SCRATCH = new THREE.Vector3();
const TURN_END_SCRATCH = new THREE.Vector3();
const TURN_CONTROL_A_SCRATCH = new THREE.Vector3();
const TURN_CONTROL_B_SCRATCH = new THREE.Vector3();
const TURN_ENTRY_LANE_SCRATCH = new THREE.Vector3();
const TURN_EXIT_LANE_SCRATCH = new THREE.Vector3();

function normalizeAngleRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function getTrafficPointX(point) {
  return Number(point?.x ?? point?.[0] ?? 0) || 0;
}

function getTrafficPointZ(point) {
  return Number(point?.z ?? point?.[2] ?? point?.[1] ?? 0) || 0;
}

function getPassiveTrafficHitboxAxes(yaw = 0) {
  const rotation = Number(yaw) || 0;
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  return {
    rightX: cos,
    rightZ: -sin,
    forwardX: sin,
    forwardZ: cos
  };
}

function passiveTrafficHitboxProjectionExtent(axes, axisX, axisZ, padding = 0) {
  const halfWidth = PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH + Math.max(0, Number(padding) || 0);
  const halfLength = PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH + Math.max(0, Number(padding) || 0);
  return (halfWidth * Math.abs((axisX * axes.rightX) + (axisZ * axes.rightZ)))
    + (halfLength * Math.abs((axisX * axes.forwardX) + (axisZ * axes.forwardZ)));
}

export function isPointInsidePassiveTrafficHitbox(carPosition, carYaw = 0, point, pointRadius = 0) {
  if (!carPosition || !point) {
    return false;
  }

  const axes = getPassiveTrafficHitboxAxes(carYaw);
  const dx = getTrafficPointX(point) - getTrafficPointX(carPosition);
  const dz = getTrafficPointZ(point) - getTrafficPointZ(carPosition);
  const localX = (dx * axes.rightX) + (dz * axes.rightZ);
  const localZ = (dx * axes.forwardX) + (dz * axes.forwardZ);
  const radius = Math.max(0, Number(pointRadius) || 0);
  return Math.abs(localX) <= PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH + radius
    && Math.abs(localZ) <= PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH + radius;
}

export function passiveTrafficHitboxesOverlap(aPosition, aYaw = 0, bPosition, bYaw = 0, padding = 0) {
  if (!aPosition || !bPosition) {
    return false;
  }

  const aAxes = getPassiveTrafficHitboxAxes(aYaw);
  const bAxes = getPassiveTrafficHitboxAxes(bYaw);
  const dx = getTrafficPointX(bPosition) - getTrafficPointX(aPosition);
  const dz = getTrafficPointZ(bPosition) - getTrafficPointZ(aPosition);
  const testAxes = [
    [aAxes.rightX, aAxes.rightZ],
    [aAxes.forwardX, aAxes.forwardZ],
    [bAxes.rightX, bAxes.rightZ],
    [bAxes.forwardX, bAxes.forwardZ]
  ];

  for (const [axisX, axisZ] of testAxes) {
    const centerDistance = Math.abs((dx * axisX) + (dz * axisZ));
    const allowedDistance = passiveTrafficHitboxProjectionExtent(aAxes, axisX, axisZ, padding)
      + passiveTrafficHitboxProjectionExtent(bAxes, axisX, axisZ, padding);
    if (centerDistance > allowedDistance) {
      return false;
    }
  }

  return true;
}

export function getPassiveTrafficForwardVector(yaw = 0, target = { x: 0, z: 1 }) {
  const rotation = Number(yaw) || 0;
  target.x = Math.sin(rotation);
  target.z = Math.cos(rotation);
  return target;
}

function roadNodeKey(cellX, cellZ) {
  return `${cellX}:${cellZ}`;
}

export function getPassiveTrafficRoadNodeKey(cellX, cellZ) {
  return roadNodeKey(Math.round(Number(cellX) || 0), Math.round(Number(cellZ) || 0));
}

function normalizeRoadAssetName(item) {
  return String(item?.assetName ?? item?.id ?? '').toLowerCase();
}

function rotateRoadExitDirection(direction, rotationQuarterTurns = 0) {
  switch (((Math.round(Number(rotationQuarterTurns) || 0) % 4) + 4) % 4) {
    case 1:
      return { x: -direction.z, z: direction.x };
    case 2:
      return { x: -direction.x, z: -direction.z };
    case 3:
      return { x: direction.z, z: -direction.x };
    default:
      return { x: direction.x, z: direction.z };
  }
}

function getPassiveTrafficBaseRoadExits(item) {
  const assetName = normalizeRoadAssetName(item);
  if (!assetName.startsWith('road_')) {
    return [];
  }

  if (assetName.includes('cross') || assetName.includes('junction')) {
    return ROAD_ALL_EXITS;
  }
  if (assetName.includes('tsplit')) {
    return ROAD_TSPLIT_EXITS;
  }
  if (assetName.includes('corner')) {
    return ROAD_CORNER_EXITS;
  }
  if (assetName.includes('straight')) {
    return ROAD_STRAIGHT_EXITS;
  }

  return ROAD_ALL_EXITS;
}

export function getPassiveTrafficRoadExits(item, rotationQuarterTurns = 0) {
  const exits = [];
  for (const direction of getPassiveTrafficBaseRoadExits(item)) {
    exits.push(rotateRoadExitDirection(direction, rotationQuarterTurns));
  }
  return exits;
}

function isPassiveTrafficRoadItem(item) {
  return item?.layer === 'tile' && getPassiveTrafficBaseRoadExits(item).length > 0;
}

function makeRoadNode(cellX, cellZ, placement, item, roadExits) {
  return {
    index: -1,
    componentIndex: -1,
    key: roadNodeKey(cellX, cellZ),
    cellX,
    cellZ,
    x: cellX * BUILDER_TILE_SIZE,
    z: cellZ * BUILDER_TILE_SIZE,
    placementId: placement?.id ?? '',
    itemId: item?.id ?? placement?.itemId ?? '',
    assetName: item?.assetName ?? '',
    roadExits,
    neighbors: []
  };
}

function hasRoadExit(node, deltaX, deltaZ) {
  for (const direction of node?.roadExits ?? []) {
    if (direction.x === deltaX && direction.z === deltaZ) {
      return true;
    }
  }
  return false;
}

function isFlexiblePassiveTrafficConnectorNode(node) {
  const roadName = `${node?.itemId ?? ''} ${node?.assetName ?? ''}`.toLowerCase();
  return roadName.includes('road_corner')
    || roadName.includes('road_tsplit')
    || roadName.includes('road_junction')
    || roadName.includes('road_cross')
    || roadName.includes('road_straight_crossing');
}

function canUseRoadExitToward(node, deltaX, deltaZ) {
  return hasRoadExit(node, deltaX, deltaZ) || isFlexiblePassiveTrafficConnectorNode(node);
}

function canConnectRoadNodes(a, b) {
  const deltaX = Math.sign((b?.cellX ?? 0) - (a?.cellX ?? 0));
  const deltaZ = Math.sign((b?.cellZ ?? 0) - (a?.cellZ ?? 0));
  if (Math.abs(deltaX) + Math.abs(deltaZ) !== 1) {
    return false;
  }

  return (hasRoadExit(a, deltaX, deltaZ) && hasRoadExit(b, -deltaX, -deltaZ))
    || (canUseRoadExitToward(a, deltaX, deltaZ) && canUseRoadExitToward(b, -deltaX, -deltaZ));
}

function connectRoadNodes(nodeByKey, aKey, bKey) {
  const a = nodeByKey.get(aKey);
  const b = nodeByKey.get(bKey);
  if (!a || !b || a === b) {
    return;
  }

  if (!canConnectRoadNodes(a, b)) {
    return;
  }

  let hasNeighbor = false;
  for (const neighborIndex of a.neighbors) {
    if (neighborIndex === b.index) {
      hasNeighbor = true;
      break;
    }
  }
  if (!hasNeighbor) {
    a.neighbors.push(b.index);
  }
  hasNeighbor = false;
  for (const neighborIndex of b.neighbors) {
    if (neighborIndex === a.index) {
      hasNeighbor = true;
      break;
    }
  }
  if (!hasNeighbor) {
    b.neighbors.push(a.index);
  }
}

function collectConnectedComponents(nodes) {
  const components = [];
  const visited = new Set();

  for (const node of nodes) {
    if (visited.has(node.index)) {
      continue;
    }

    const component = [];
    const queue = [node.index];
    visited.add(node.index);

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const nodeIndex = queue[cursor];
      const current = nodes[nodeIndex];
      component.push(nodeIndex);

      for (const neighborIndex of current.neighbors) {
        if (visited.has(neighborIndex)) {
          continue;
        }

        visited.add(neighborIndex);
        queue.push(neighborIndex);
      }
    }

    components.push(component);
  }

  components.sort((a, b) => b.length - a.length);
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const component = components[componentIndex];
    for (const nodeIndex of component) {
      if (nodes[nodeIndex]) {
        nodes[nodeIndex].componentIndex = componentIndex;
      }
    }
  }
  return components;
}

function createGraphSignature(nodes, activeNodeIndices, activeNodeSet) {
  const signatures = [];
  for (const nodeIndex of activeNodeIndices) {
    const node = nodes[nodeIndex];
    if (!node) {
      continue;
    }

    const exits = [];
    for (const direction of node.roadExits) {
      exits.push(`${direction.x}:${direction.z}`);
    }
    exits.sort();

    const neighbors = [];
    for (const neighborIndex of node.neighbors) {
      if (!activeNodeSet.has(neighborIndex)) {
        continue;
      }
      const neighborKey = nodes[neighborIndex]?.key ?? '';
      if (neighborKey) {
        neighbors.push(neighborKey);
      }
    }
    neighbors.sort();
    signatures.push(`${node.key}[${exits.join(',')}]>${neighbors.join(',')}`);
  }
  signatures.sort();
  return signatures.join('|');
}

function normalizePlacementList(source) {
  if (!source) {
    return [];
  }

  const placements = [];
  const appendPlacement = (entry) => {
    const placement = entry?.placement ?? entry;
    if (placement) {
      placements.push(placement);
    }
  };

  if (typeof source.forEachPlacement === 'function') {
    source.forEachPlacement(appendPlacement);
    return placements;
  }

  if (source instanceof Map) {
    for (const entry of source.values()) {
      appendPlacement(entry);
    }
    return placements;
  }

  if (typeof source[Symbol.iterator] === 'function') {
    for (const entry of source) {
      appendPlacement(entry);
    }
    return placements;
  }

  return placements;
}

export function buildPassiveTrafficRoadGraph(source, getItem = getBuilderItemById) {
  const placements = normalizePlacementList(source);
  const nodeByKey = new Map();
  const nodeIndexByKey = new Map();
  const nodes = [];

  for (const placement of placements) {
    const item = getItem(placement?.itemId);
    if (!isPassiveTrafficRoadItem(item)) {
      continue;
    }

    for (const cell of getTileOccupiedCells(
      item,
      placement.cellX ?? placement.cell?.[0] ?? 0,
      placement.cellZ ?? placement.cell?.[1] ?? 0,
      placement.rotationQuarterTurns ?? 0
    )) {
      const key = roadNodeKey(cell.x, cell.z);
      if (nodeByKey.has(key)) {
        continue;
      }

      const node = makeRoadNode(
        cell.x,
        cell.z,
        placement,
        item,
        getPassiveTrafficRoadExits(item, placement.rotationQuarterTurns ?? 0)
      );
      node.index = nodes.length;
      nodes.push(node);
      nodeByKey.set(key, node);
      nodeIndexByKey.set(key, node.index);
    }
  }

  for (const node of nodes) {
    for (const direction of CARDINAL_DIRECTIONS) {
      connectRoadNodes(
        nodeByKey,
        node.key,
        roadNodeKey(node.cellX + direction.x, node.cellZ + direction.z)
      );
    }
    node.neighbors.sort((a, b) => a - b);
  }

  const components = collectConnectedComponents(nodes);
  const activeComponents = [];
  const activeNodeIndices = [];
  for (const component of components) {
    if (component.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      continue;
    }
    activeComponents.push(component);
    for (const nodeIndex of component) {
      activeNodeIndices.push(nodeIndex);
    }
  }
  const activeNodeSet = new Set();
  for (const nodeIndex of activeNodeIndices) {
    activeNodeSet.add(nodeIndex);
  }
  const activeNodes = [];
  for (const nodeIndex of activeNodeIndices) {
    const node = nodes[nodeIndex];
    if (node) {
      activeNodes.push(node);
    }
  }

  return {
    nodes,
    activeNodes,
    activeNodeIndices,
    activeNodeSet,
    nodeIndexByKey,
    activeComponents,
    components,
    signature: createGraphSignature(nodes, activeNodeIndices, activeNodeSet)
  };
}

function setPassiveTrafficLanePosition(anchorNode, deltaX, deltaZ, target = new THREE.Vector3()) {
  const length = Math.sqrt((deltaX * deltaX) + (deltaZ * deltaZ));
  const dirX = length > 0.0001 ? deltaX / length : 0;
  const dirZ = length > 0.0001 ? deltaZ / length : 1;
  return setPassiveTrafficLanePositionAtPoint(
    anchorNode,
    anchorNode?.x ?? 0,
    anchorNode?.z ?? 0,
    -dirZ,
    dirX,
    target
  );
}

function setPassiveTrafficLanePositionAtPoint(anchorNode, baseX, baseZ, rightX, rightZ, target = new THREE.Vector3()) {
  target.set(
    (Number(baseX) || 0) + (rightX * PASSIVE_TRAFFIC_LANE_OFFSET),
    0,
    (Number(baseZ) || 0) + (rightZ * PASSIVE_TRAFFIC_LANE_OFFSET)
  );
  clampPassiveTrafficPositionToRoadNode(anchorNode, target, target);
  return target;
}

export function getPassiveTrafficLanePositionAtNode(anchorNode, towardNode, target = new THREE.Vector3()) {
  return setPassiveTrafficLanePosition(
    anchorNode,
    (towardNode?.x ?? 0) - (anchorNode?.x ?? 0),
    (towardNode?.z ?? 0) - (anchorNode?.z ?? 0),
    target
  );
}

export function getPassiveTrafficLanePosition(fromNode, toNode, target = new THREE.Vector3()) {
  return setPassiveTrafficLanePosition(
    toNode,
    (toNode?.x ?? 0) - (fromNode?.x ?? 0),
    (toNode?.z ?? 0) - (fromNode?.z ?? 0),
    target
  );
}

export function getPassiveTrafficRoadStep(fromNode, toNode) {
  const deltaX = Math.sign((toNode?.cellX ?? 0) - (fromNode?.cellX ?? 0));
  const deltaZ = Math.sign((toNode?.cellZ ?? 0) - (fromNode?.cellZ ?? 0));
  return { x: deltaX, z: deltaZ };
}

export function getPassiveTrafficNodeYaw(fromNode, toNode) {
  return Math.atan2(
    (toNode?.x ?? 0) - (fromNode?.x ?? 0),
    (toNode?.z ?? 0) - (fromNode?.z ?? 0)
  );
}

export function clampPassiveTrafficPositionToRoadNode(node, position, target = new THREE.Vector3()) {
  const centerX = node?.x ?? 0;
  const centerZ = node?.z ?? 0;
  const limit = Math.max(0, PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE - PASSIVE_TRAFFIC_ROAD_TILE_EDGE_INSET);
  target.set(
    Math.min(centerX + limit, Math.max(centerX - limit, position?.x ?? centerX)),
    position?.y ?? 0,
    Math.min(centerZ + limit, Math.max(centerZ - limit, position?.z ?? centerZ))
  );
  return target;
}

export function clampPassiveTrafficPositionToRoadNodes(nodes, position, target = new THREE.Vector3()) {
  const roadNodes = (nodes ?? []).filter(Boolean);
  if (!roadNodes.length) {
    target.copy?.(position);
    return target;
  }

  let bestNode = roadNodes[0];
  let bestPosition = clampPassiveTrafficPositionToRoadNode(bestNode, position, new THREE.Vector3());
  let bestDistanceSq = bestPosition.distanceToSquared(position);

  for (let index = 1; index < roadNodes.length; index += 1) {
    const candidateNode = roadNodes[index];
    const candidatePosition = clampPassiveTrafficPositionToRoadNode(candidateNode, position, new THREE.Vector3());
    const candidateDistanceSq = candidatePosition.distanceToSquared(position);
    if (candidateDistanceSq < bestDistanceSq) {
      bestNode = candidateNode;
      bestPosition = candidatePosition;
      bestDistanceSq = candidateDistanceSq;
    }
  }

  return clampPassiveTrafficPositionToRoadNode(bestNode, bestPosition, target);
}

export function isPassiveTrafficPositionInsideRoadNode(node, position, inset = 0) {
  if (!node || !position) {
    return false;
  }

  const limit = Math.max(0, PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE - Math.max(0, Number(inset) || 0));
  return Math.abs((position.x ?? 0) - node.x) <= limit + 0.001
    && Math.abs((position.z ?? 0) - node.z) <= limit + 0.001;
}

function setCubicBezierPoint(start, controlA, controlB, end, time, target) {
  const inverse = 1 - time;
  target.set(
    (inverse * inverse * inverse * start.x)
      + (3 * inverse * inverse * time * controlA.x)
      + (3 * inverse * time * time * controlB.x)
      + (time * time * time * end.x),
    0,
    (inverse * inverse * inverse * start.z)
      + (3 * inverse * inverse * time * controlA.z)
      + (3 * inverse * time * time * controlB.z)
      + (time * time * time * end.z)
  );
  return target;
}

function pushDistinctPassiveTrafficWaypoint(waypoints, waypoint) {
  if (!waypoint) {
    return;
  }

  const previous = waypoints[waypoints.length - 1] ?? null;
  if (!previous || previous.distanceToSquared(waypoint) > 0.0001) {
    waypoints.push(waypoint);
  }
}

function getPassiveTrafficEdgeLanePosition(currentNode, travelDirection, edgeDirection, target = new THREE.Vector3()) {
  return setPassiveTrafficLanePositionAtPoint(
    currentNode,
    currentNode.x + (edgeDirection.x * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    currentNode.z + (edgeDirection.z * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    -travelDirection.z,
    travelDirection.x,
    target
  );
}

export function isPassiveTrafficJunctionNode(node) {
  return Boolean(
    node
    && (
      (node.neighbors?.length ?? 0) >= 3
      || PASSIVE_TRAFFIC_JUNCTION_ITEM_PATTERN.test(String(node.itemId ?? node.assetName ?? ''))
    )
  );
}

export function isPassiveTrafficTSplitNode(node) {
  const roadName = `${node?.itemId ?? ''} ${node?.assetName ?? ''}`.toLowerCase();
  return roadName.includes('road_tsplit');
}

export function isPassiveTrafficCrosswalkNode(node) {
  return PASSIVE_TRAFFIC_CROSSWALK_ITEM_PATTERN.test(String(`${node?.itemId ?? ''} ${node?.assetName ?? ''}`).toLowerCase());
}

export function getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode) {
  if (!previousNode || !currentNode || !nextNode) {
    return PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT;
  }

  const incoming = getPassiveTrafficRoadStep(previousNode, currentNode);
  const outgoing = getPassiveTrafficRoadStep(currentNode, nextNode);
  if (
    (Math.abs(incoming.x) + Math.abs(incoming.z) !== 1)
    || (Math.abs(outgoing.x) + Math.abs(outgoing.z) !== 1)
  ) {
    return PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP;
  }

  const dot = (incoming.x * outgoing.x) + (incoming.z * outgoing.z);
  if (dot > 0) {
    return PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT;
  }
  if (dot < 0) {
    return PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE;
  }

  const turn = (incoming.x * outgoing.z) - (incoming.z * outgoing.x);
  return turn > 0
    ? PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
    : PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT;
}

export function clampPassiveTrafficTurnYaw(startYaw, endYaw, targetYaw) {
  if (![startYaw, endYaw, targetYaw].every(Number.isFinite)) {
    return Number.isFinite(targetYaw) ? targetYaw : 0;
  }

  const turnDelta = normalizeAngleRadians(endYaw - startYaw);
  const turnDirection = turnDelta >= 0 ? 1 : -1;
  const turnArc = Math.min(PASSIVE_TRAFFIC_MAX_TURN_RADIANS, Math.abs(turnDelta));
  if (turnArc <= 0.0001) {
    return normalizeAngleRadians(startYaw);
  }

  const targetDelta = normalizeAngleRadians(targetYaw - startYaw) * turnDirection;
  const clampedDelta = Math.max(0, Math.min(turnArc, targetDelta));
  return normalizeAngleRadians(startYaw + (turnDirection * clampedDelta));
}

export function getPassiveTrafficTurnYawRange(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  if (
    command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
  ) {
    return null;
  }

  const startYaw = getPassiveTrafficNodeYaw(previousNode, currentNode);
  const rawEndYaw = getPassiveTrafficNodeYaw(currentNode, nextNode);
  return {
    startYaw,
    endYaw: clampPassiveTrafficTurnYaw(startYaw, rawEndYaw, rawEndYaw)
  };
}

function getPassiveTrafficStraightLaneWaypoints(previousNode, currentNode, nextNode) {
  if (!previousNode || !currentNode || !nextNode) {
    return [];
  }

  const incoming = getPassiveTrafficRoadStep(previousNode, currentNode);
  const outgoing = getPassiveTrafficRoadStep(currentNode, nextNode);
  if (
    (Math.abs(incoming.x) + Math.abs(incoming.z) !== 1)
    || (Math.abs(outgoing.x) + Math.abs(outgoing.z) !== 1)
    || ((incoming.x * outgoing.x) + (incoming.z * outgoing.z)) !== 1
  ) {
    return [];
  }

  const waypoints = [];
  pushDistinctPassiveTrafficWaypoint(
    waypoints,
    getPassiveTrafficEdgeLanePosition(
      currentNode,
      incoming,
      { x: -incoming.x, z: -incoming.z },
      new THREE.Vector3()
    )
  );
  pushDistinctPassiveTrafficWaypoint(
    waypoints,
    getPassiveTrafficEdgeLanePosition(
      currentNode,
      outgoing,
      outgoing,
      new THREE.Vector3()
    )
  );
  pushDistinctPassiveTrafficWaypoint(
    waypoints,
    getPassiveTrafficLanePosition(currentNode, nextNode, new THREE.Vector3())
  );
  return waypoints;
}

export function getPassiveTrafficTurnLaneWaypoints(previousNode, currentNode, nextNode, output = []) {
  let waypointCount = 0;
  if (!previousNode || !currentNode || !nextNode) {
    output.length = 0;
    return output;
  }

  const incomingX = Math.sign((currentNode?.cellX ?? 0) - (previousNode?.cellX ?? 0));
  const incomingZ = Math.sign((currentNode?.cellZ ?? 0) - (previousNode?.cellZ ?? 0));
  const outgoingX = Math.sign((nextNode?.cellX ?? 0) - (currentNode?.cellX ?? 0));
  const outgoingZ = Math.sign((nextNode?.cellZ ?? 0) - (currentNode?.cellZ ?? 0));
  if (
    (Math.abs(incomingX) + Math.abs(incomingZ) !== 1)
    || (Math.abs(outgoingX) + Math.abs(outgoingZ) !== 1)
    || ((incomingX * outgoingX) + (incomingZ * outgoingZ)) !== 0
  ) {
    output.length = 0;
    return output;
  }

  const incomingRightX = -incomingZ;
  const incomingRightZ = incomingX;
  const outgoingRightX = -outgoingZ;
  const outgoingRightZ = outgoingX;
  const start = setPassiveTrafficLanePositionAtPoint(
    currentNode,
    currentNode.x - (incomingX * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    currentNode.z - (incomingZ * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    incomingRightX,
    incomingRightZ,
    TURN_START_SCRATCH
  );
  const end = setPassiveTrafficLanePositionAtPoint(
    currentNode,
    currentNode.x + (outgoingX * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    currentNode.z + (outgoingZ * PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE),
    outgoingRightX,
    outgoingRightZ,
    TURN_END_SCRATCH
  );
  const controlDistance = Math.max(
    0.001,
    Math.min(
      BUILDER_TILE_SIZE * 0.42,
      PASSIVE_TRAFFIC_ROAD_TILE_HALF_SIZE - Math.abs(PASSIVE_TRAFFIC_LANE_OFFSET)
    )
  );
  const controlA = TURN_CONTROL_A_SCRATCH.set(
    start.x + (incomingX * controlDistance),
    0,
    start.z + (incomingZ * controlDistance)
  );
  const controlB = TURN_CONTROL_B_SCRATCH.set(
    end.x - (outgoingX * controlDistance),
    0,
    end.z - (outgoingZ * controlDistance)
  );
  clampPassiveTrafficPositionToRoadNode(currentNode, controlA, controlA);
  clampPassiveTrafficPositionToRoadNode(currentNode, controlB, controlB);

  const entryLane = getPassiveTrafficLanePosition(previousNode, currentNode, TURN_ENTRY_LANE_SCRATCH);
  const exitLane = getPassiveTrafficLanePosition(currentNode, nextNode, TURN_EXIT_LANE_SCRATCH);
  const writeWaypoint = (source) => {
    let waypoint = output[waypointCount];
    if (!waypoint) {
      waypoint = new THREE.Vector3();
      output[waypointCount] = waypoint;
    }
    waypoint.copy(source);
    waypointCount += 1;
    return waypoint;
  };
  if (entryLane.distanceToSquared(start) > 0.001 * 0.001) {
    writeWaypoint(start);
  }

  for (const time of PASSIVE_TRAFFIC_TURN_WAYPOINT_TIMES) {
    let waypoint = output[waypointCount];
    if (!waypoint) {
      waypoint = new THREE.Vector3();
      output[waypointCount] = waypoint;
    }
    setCubicBezierPoint(start, controlA, controlB, end, time, waypoint);
    clampPassiveTrafficPositionToRoadNode(currentNode, waypoint, waypoint);
    waypointCount += 1;
  }

  if (output[waypointCount - 1]?.distanceToSquared(exitLane) > 0.001 * 0.001) {
    writeWaypoint(exitLane);
  }

  output.length = waypointCount;
  return output;
}

export function getPassiveTrafficTurnLaneWaypointsFromPosition(previousNode, currentNode, nextNode, position, output = []) {
  const waypoints = getPassiveTrafficTurnLaneWaypoints(previousNode, currentNode, nextNode, output);
  if (!position || waypoints.length <= 1) {
    return waypoints;
  }

  let closestIndex = 0;
  let closestDistanceSq = waypoints[0].distanceToSquared(position);
  for (let index = 1; index < waypoints.length; index += 1) {
    const distanceSq = waypoints[index].distanceToSquared(position);
    if (distanceSq < closestDistanceSq) {
      closestIndex = index;
      closestDistanceSq = distanceSq;
    }
  }

  const startIndex = Math.min(waypoints.length, closestIndex + 1);
  if (startIndex <= 0) {
    return waypoints;
  }

  let writeIndex = 0;
  for (let readIndex = startIndex; readIndex < waypoints.length; readIndex += 1) {
    if (waypoints[readIndex].distanceToSquared(position) <= 0.001 * 0.001) {
      continue;
    }
    waypoints[writeIndex].copy(waypoints[readIndex]);
    writeIndex += 1;
  }
  waypoints.length = writeIndex;
  return waypoints;
}

export function shouldPassiveTrafficStopAtEntry(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  return isPassiveTrafficJunctionNode(currentNode)
    && !isPassiveTrafficCrosswalkNode(currentNode)
    && (!isPassiveTrafficTSplitNode(currentNode) || command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT)
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP;
}

export function getPassiveTrafficDriveScript(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  const shouldStopAtEntry = shouldPassiveTrafficStopAtEntry(previousNode, currentNode, nextNode);
  const waypoints = command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT
    ? getPassiveTrafficStraightLaneWaypoints(previousNode, currentNode, nextNode)
    : getPassiveTrafficTurnLaneWaypoints(previousNode, currentNode, nextNode);

  return {
    command,
    waypoints,
    shouldStopAtEntry,
    stopWaypointIndex: shouldStopAtEntry && waypoints.length ? 0 : -1
  };
}

export function findPassiveTrafficPath(graph, startIndex, goalIndex) {
  if (!graph?.activeNodeSet?.has(startIndex) || !graph.activeNodeSet.has(goalIndex)) {
    return [];
  }

  if (startIndex === goalIndex) {
    return [startIndex];
  }

  const queue = [startIndex];
  const previous = new Map();
  previous.set(startIndex, null);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeIndex = queue[cursor];
    const node = graph.nodes[nodeIndex];
    for (const neighborIndex of node.neighbors) {
      if (!graph.activeNodeSet.has(neighborIndex) || previous.has(neighborIndex)) {
        continue;
      }

      previous.set(neighborIndex, nodeIndex);
      if (neighborIndex === goalIndex) {
        const path = [goalIndex];
        let current = nodeIndex;
        while (current !== null) {
          path.push(current);
          current = previous.get(current) ?? null;
        }
        return path.reverse();
      }

      queue.push(neighborIndex);
    }
  }

  return [];
}

export function buildPassiveTrafficRouteLookahead(graph, routeNodeIndices = [], currentNodeIndex = null, cursor = 0) {
  if (!graph?.activeNodeSet?.has(currentNodeIndex)) {
    return {
      route: [],
      cursor: 0
    };
  }

  const routeNodes = [];
  for (const nodeIndex of Array.isArray(routeNodeIndices) ? routeNodeIndices : []) {
    if (!graph.activeNodeSet.has(nodeIndex)) {
      continue;
    }
    if (routeNodes[routeNodes.length - 1] !== nodeIndex) {
      routeNodes.push(nodeIndex);
    }
  }

  if (routeNodes.length > 1 && routeNodes[0] === routeNodes[routeNodes.length - 1]) {
    routeNodes.pop();
  }

  if (routeNodes.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
    return {
      route: [],
      cursor: 0
    };
  }

  const normalizedCursor = ((Math.round(Number(cursor) || 0) % routeNodes.length) + routeNodes.length) % routeNodes.length;
  const currentCursor = routeNodes.findIndex((nodeIndex) => nodeIndex === currentNodeIndex);
  let nextCursor = currentCursor >= 0
    ? (currentCursor + 1) % routeNodes.length
    : normalizedCursor;
  let currentIndex = currentNodeIndex;
  const output = [currentNodeIndex];
  const maxDestinations = Math.max(routeNodes.length + 1, 3);

  for (let offset = 0; offset < maxDestinations; offset += 1) {
    const destinationIndex = routeNodes[nextCursor];
    nextCursor = (nextCursor + 1) % routeNodes.length;
    if (destinationIndex === currentIndex) {
      continue;
    }

    const path = findPassiveTrafficPath(graph, currentIndex, destinationIndex);
    if (path.length < 2) {
      break;
    }

    for (const pathNodeIndex of path.slice(1)) {
      if (output[output.length - 1] !== pathNodeIndex) {
        output.push(pathNodeIndex);
      }
    }
    currentIndex = destinationIndex;
  }

  return {
    route: output.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES ? output : [],
    cursor: nextCursor
  };
}

function getPassiveTrafficRoutePointNodeIndex(graph, point = null) {
  if (!graph?.activeNodeSet || !point) {
    return null;
  }

  const cellX = Number(point.cellX ?? point.cell?.[0]);
  const cellZ = Number(point.cellZ ?? point.cell?.[1]);
  if (Number.isFinite(cellX) && Number.isFinite(cellZ)) {
    const index = graph.nodeIndexByKey?.get?.(getPassiveTrafficRoadNodeKey(cellX, cellZ));
    return graph.activeNodeSet.has(index) ? index : null;
  }

  const x = Number(point.x ?? point.position?.[0]);
  const z = Number(point.z ?? point.position?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }

  let bestIndex = null;
  let bestDistanceSq = Infinity;
  for (const nodeIndex of graph.activeNodeIndices ?? []) {
    const node = graph.nodes?.[nodeIndex];
    if (!node) {
      continue;
    }
    const distanceSq = ((node.x - x) * (node.x - x)) + ((node.z - z) * (node.z - z));
    if (distanceSq < bestDistanceSq) {
      bestIndex = nodeIndex;
      bestDistanceSq = distanceSq;
    }
  }
  return bestIndex;
}

export function getPassiveTrafficRouteNodeIndices(graph, route = null) {
  const indices = [];
  for (const point of Array.isArray(route?.points) ? route.points : []) {
    const nodeIndex = getPassiveTrafficRoutePointNodeIndex(graph, point);
    if (nodeIndex === null || nodeIndex === undefined) {
      continue;
    }
    if (indices[indices.length - 1] !== nodeIndex) {
      indices.push(nodeIndex);
    }
  }

  if (indices.length > 1 && indices[0] === indices[indices.length - 1]) {
    indices.pop();
  }

  return indices.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES ? indices : [];
}
