import * as THREE from 'three';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { getBuilderItemById } from './builderCatalog.js';

export const PASSIVE_TRAFFIC_CAR_ITEM_IDS = Object.freeze([
  'car_sedan',
  'car_stationwagon',
  'car_taxi'
]);

export const PASSIVE_TRAFFIC_CAR_SCALE = 0.8;
export const PASSIVE_TRAFFIC_SPEED = BUILDER_TILE_SIZE;
export const PASSIVE_TRAFFIC_LANE_OFFSET = BUILDER_TILE_SIZE * 0.22;
export const PASSIVE_TRAFFIC_MIN_ROAD_NODES = 2;

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
const PASSIVE_TRAFFIC_TURN_WAYPOINT_TIMES = Object.freeze([0.32, 0.62, 1]);

function roadNodeKey(cellX, cellZ) {
  return `${cellX}:${cellZ}`;
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
  const activeNodeIndices = components[0] ?? [];
  const activeNodeSet = new Set(activeNodeIndices);
  const activeNodes = activeNodeIndices.map((nodeIndex) => nodes[nodeIndex]);

  return {
    nodes,
    activeNodes,
    activeNodeIndices,
    activeNodeSet,
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
  const right = getPassiveTrafficDriverRightDirection(deltaX, deltaZ);

  target.set(
    (anchorNode?.x ?? 0) + (right.x * PASSIVE_TRAFFIC_LANE_OFFSET),
    0,
    (anchorNode?.z ?? 0) + (right.z * PASSIVE_TRAFFIC_LANE_OFFSET)
  );
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

function getRoadStep(fromNode, toNode) {
  const deltaX = Math.sign((toNode?.cellX ?? 0) - (fromNode?.cellX ?? 0));
  const deltaZ = Math.sign((toNode?.cellZ ?? 0) - (fromNode?.cellZ ?? 0));
  return { x: deltaX, z: deltaZ };
}

function setQuadraticBezierPoint(start, control, end, time, target) {
  const inverse = 1 - time;
  target.set(
    (inverse * inverse * start.x) + (2 * inverse * time * control.x) + (time * time * end.x),
    0,
    (inverse * inverse * start.z) + (2 * inverse * time * control.z) + (time * time * end.z)
  );
  return target;
}

export function getPassiveTrafficTurnLaneWaypoints(previousNode, currentNode, nextNode) {
  if (!previousNode || !currentNode || !nextNode) {
    return [];
  }

  const incoming = getRoadStep(previousNode, currentNode);
  const outgoing = getRoadStep(currentNode, nextNode);
  if (
    (Math.abs(incoming.x) + Math.abs(incoming.z) !== 1)
    || (Math.abs(outgoing.x) + Math.abs(outgoing.z) !== 1)
    || ((incoming.x * outgoing.x) + (incoming.z * outgoing.z)) !== 0
  ) {
    return [];
  }

  const start = getPassiveTrafficLanePosition(previousNode, currentNode, new THREE.Vector3());
  const end = getPassiveTrafficLanePositionAtNode(currentNode, nextNode, new THREE.Vector3());
  const incomingRight = getPassiveTrafficDriverRightDirection(incoming.x, incoming.z);
  const outgoingRight = getPassiveTrafficDriverRightDirection(outgoing.x, outgoing.z);
  const isRightTurn = ((outgoing.x * incomingRight.x) + (outgoing.z * incomingRight.z)) > 0;
  const control = new THREE.Vector3(
    currentNode.x + (isRightTurn ? (incomingRight.x + outgoingRight.x) * PASSIVE_TRAFFIC_LANE_OFFSET : 0),
    0,
    currentNode.z + (isRightTurn ? (incomingRight.z + outgoingRight.z) * PASSIVE_TRAFFIC_LANE_OFFSET : 0)
  );

  return PASSIVE_TRAFFIC_TURN_WAYPOINT_TIMES.map((time) => (
    setQuadraticBezierPoint(start, control, end, time, new THREE.Vector3())
  ));
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
