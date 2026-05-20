import * as THREE from 'three';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { getBuilderItemById } from './builderCatalog.js';

export const PASSIVE_TRAFFIC_CAR_ITEM_IDS = Object.freeze([
  'car_sedan',
  'car_stationwagon',
  'car_taxi'
]);

export const PASSIVE_TRAFFIC_CAR_SCALE = 0.68;
export const PASSIVE_TRAFFIC_SPEED = BUILDER_TILE_SIZE;
export const PASSIVE_TRAFFIC_LANE_OFFSET = BUILDER_TILE_SIZE * 0.22;
export const PASSIVE_TRAFFIC_MIN_ROAD_NODES = 2;
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
  if (!assetName.startsWith('road_') && !assetName.startsWith('park_road_')) {
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
  return getPassiveTrafficBaseRoadExits(item)
    .map((direction) => rotateRoadExitDirection(direction, rotationQuarterTurns));
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
  return Boolean(node?.roadExits?.some((direction) => direction.x === deltaX && direction.z === deltaZ));
}

function canConnectRoadNodes(a, b) {
  const deltaX = Math.sign((b?.cellX ?? 0) - (a?.cellX ?? 0));
  const deltaZ = Math.sign((b?.cellZ ?? 0) - (a?.cellZ ?? 0));
  if (Math.abs(deltaX) + Math.abs(deltaZ) !== 1) {
    return false;
  }

  return hasRoadExit(a, deltaX, deltaZ) && hasRoadExit(b, -deltaX, -deltaZ);
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

  if (!a.neighbors.includes(b.index)) {
    a.neighbors.push(b.index);
  }
  if (!b.neighbors.includes(a.index)) {
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
  components.forEach((component, componentIndex) => {
    for (const nodeIndex of component) {
      if (nodes[nodeIndex]) {
        nodes[nodeIndex].componentIndex = componentIndex;
      }
    }
  });
  return components;
}

function createGraphSignature(nodes, activeNodeIndices) {
  return activeNodeIndices
    .map((nodeIndex) => {
      const node = nodes[nodeIndex];
      const exits = node.roadExits
        .map((direction) => `${direction.x}:${direction.z}`)
        .sort()
        .join(',');
      const neighbors = node.neighbors
        .filter((neighborIndex) => activeNodeIndices.includes(neighborIndex))
        .map((neighborIndex) => nodes[neighborIndex]?.key ?? '')
        .filter(Boolean)
        .sort()
        .join(',');
      return `${node.key}[${exits}]>${neighbors}`;
    })
    .sort()
    .join('|');
}

function normalizePlacementList(source) {
  if (!source) {
    return [];
  }

  if (source instanceof Map) {
    return [...source.values()].map((entry) => entry?.placement ?? entry).filter(Boolean);
  }

  if (typeof source[Symbol.iterator] === 'function') {
    return [...source].map((entry) => entry?.placement ?? entry).filter(Boolean);
  }

  return [];
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
  const activeComponents = components.filter((component) => component.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES);
  const activeNodeIndices = activeComponents.flat();
  const activeNodeSet = new Set(activeNodeIndices);
  const activeNodes = activeNodeIndices.map((nodeIndex) => nodes[nodeIndex]);

  return {
    nodes,
    activeNodes,
    activeNodeIndices,
    activeNodeSet,
    nodeIndexByKey,
    activeComponents,
    components,
    signature: createGraphSignature(nodes, activeNodeIndices)
  };
}

function getPassiveTrafficDriverRightDirection(deltaX, deltaZ) {
  const length = Math.hypot(deltaX, deltaZ);
  const dirX = length > 0.0001 ? deltaX / length : 0;
  const dirZ = length > 0.0001 ? deltaZ / length : 1;
  return {
    x: -dirZ,
    z: dirX
  };
}

function setPassiveTrafficLanePosition(anchorNode, deltaX, deltaZ, target = new THREE.Vector3()) {
  return setPassiveTrafficLanePositionAtPoint(
    anchorNode,
    anchorNode?.x ?? 0,
    anchorNode?.z ?? 0,
    deltaX,
    deltaZ,
    target
  );
}

function setPassiveTrafficLanePositionAtPoint(anchorNode, baseX, baseZ, deltaX, deltaZ, target = new THREE.Vector3()) {
  const right = getPassiveTrafficDriverRightDirection(deltaX, deltaZ);

  target.set(
    (Number(baseX) || 0) + (right.x * PASSIVE_TRAFFIC_LANE_OFFSET),
    0,
    (Number(baseZ) || 0) + (right.z * PASSIVE_TRAFFIC_LANE_OFFSET)
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
    travelDirection.x,
    travelDirection.z,
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

export function getPassiveTrafficTurnLaneWaypoints(previousNode, currentNode, nextNode) {
  if (!previousNode || !currentNode || !nextNode) {
    return [];
  }

  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  if (
    command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
  ) {
    return [];
  }

  const incoming = getPassiveTrafficRoadStep(previousNode, currentNode);
  const outgoing = getPassiveTrafficRoadStep(currentNode, nextNode);
  if (
    (Math.abs(incoming.x) + Math.abs(incoming.z) !== 1)
    || (Math.abs(outgoing.x) + Math.abs(outgoing.z) !== 1)
    || ((incoming.x * outgoing.x) + (incoming.z * outgoing.z)) !== 0
  ) {
    return [];
  }

  const start = getPassiveTrafficEdgeLanePosition(
    currentNode,
    incoming,
    { x: -incoming.x, z: -incoming.z },
    new THREE.Vector3()
  );
  const end = getPassiveTrafficEdgeLanePosition(
    currentNode,
    outgoing,
    outgoing,
    new THREE.Vector3()
  );
  const controlDistance = BUILDER_TILE_SIZE * 0.42;
  const controlA = new THREE.Vector3(
    start.x + (incoming.x * controlDistance),
    0,
    start.z + (incoming.z * controlDistance)
  );
  const controlB = new THREE.Vector3(
    end.x - (outgoing.x * controlDistance),
    0,
    end.z - (outgoing.z * controlDistance)
  );
  clampPassiveTrafficPositionToRoadNode(currentNode, controlA, controlA);
  clampPassiveTrafficPositionToRoadNode(currentNode, controlB, controlB);

  const entryLane = getPassiveTrafficLanePosition(previousNode, currentNode, new THREE.Vector3());
  const exitLane = getPassiveTrafficLanePosition(currentNode, nextNode, new THREE.Vector3());
  const waypoints = [];
  if (entryLane.distanceTo(start) > 0.001) {
    pushDistinctPassiveTrafficWaypoint(waypoints, start.clone());
  }

  for (const time of PASSIVE_TRAFFIC_TURN_WAYPOINT_TIMES) {
    pushDistinctPassiveTrafficWaypoint(
      waypoints,
      clampPassiveTrafficPositionToRoadNode(
        currentNode,
        setCubicBezierPoint(start, controlA, controlB, end, time, new THREE.Vector3()),
        new THREE.Vector3()
      )
    );
  }

  if (waypoints[waypoints.length - 1]?.distanceTo(exitLane) > 0.001) {
    pushDistinctPassiveTrafficWaypoint(waypoints, exitLane);
  }

  return waypoints;
}

export function getPassiveTrafficDriveScript(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  const shouldStopAtEntry = isPassiveTrafficJunctionNode(currentNode)
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP;
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
  const previous = new Map([[startIndex, null]]);

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

function getPassiveTrafficRoutePointNodeIndex(graph, point = null) {
  if (!graph?.activeNodeSet || !point) {
    return null;
  }

  const cellX = Number(point.cellX ?? point.cell?.[0]);
  const cellZ = Number(point.cellZ ?? point.cell?.[1]);
  if (Number.isFinite(cellX) && Number.isFinite(cellZ)) {
    const index = graph.nodeIndexByKey?.get?.(getPassiveTrafficRoadNodeKey(cellX, cellZ));
    if (graph.activeNodeSet.has(index)) {
      return index;
    }
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
