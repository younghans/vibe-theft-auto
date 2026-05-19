import * as THREE from 'three';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { getBuilderItemById } from './builderCatalog.js';

export const PASSIVE_TRAFFIC_CAR_ITEM_IDS = Object.freeze([
  'car_sedan',
  'car_stationwagon',
  'car_taxi'
]);

export const PASSIVE_TRAFFIC_CAR_SCALE = 0.7;
export const PASSIVE_TRAFFIC_SPEED = BUILDER_TILE_SIZE;
export const PASSIVE_TRAFFIC_LANE_OFFSET = BUILDER_TILE_SIZE * 0.22;
export const PASSIVE_TRAFFIC_MIN_ROAD_NODES = 2;

const CARDINAL_DIRECTIONS = Object.freeze([
  Object.freeze({ x: 1, z: 0 }),
  Object.freeze({ x: -1, z: 0 }),
  Object.freeze({ x: 0, z: 1 }),
  Object.freeze({ x: 0, z: -1 })
]);

function roadNodeKey(cellX, cellZ) {
  return `${cellX}:${cellZ}`;
}

function isPassiveTrafficRoadItem(item) {
  const assetName = String(item?.assetName ?? item?.id ?? '').toLowerCase();
  return item?.layer === 'tile' && assetName.startsWith('road_');
}

function makeRoadNode(cellX, cellZ, placement, item) {
  return {
    index: -1,
    key: roadNodeKey(cellX, cellZ),
    cellX,
    cellZ,
    x: cellX * BUILDER_TILE_SIZE,
    z: cellZ * BUILDER_TILE_SIZE,
    placementId: placement?.id ?? '',
    itemId: item?.id ?? placement?.itemId ?? '',
    neighbors: []
  };
}

function connectRoadNodes(nodeByKey, aKey, bKey) {
  const a = nodeByKey.get(aKey);
  const b = nodeByKey.get(bKey);
  if (!a || !b || a === b) {
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
      const neighbors = node.neighbors
        .filter((neighborIndex) => activeNodeIndices.includes(neighborIndex))
        .map((neighborIndex) => nodes[neighborIndex]?.key ?? '')
        .filter(Boolean)
        .sort()
        .join(',');
      return `${node.key}>${neighbors}`;
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

      const node = makeRoadNode(cell.x, cell.z, placement, item);
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

function setPassiveTrafficLanePosition(anchorNode, deltaX, deltaZ, target = new THREE.Vector3()) {
  const length = Math.hypot(deltaX, deltaZ);
  const dirX = length > 0.0001 ? deltaX / length : 0;
  const dirZ = length > 0.0001 ? deltaZ / length : 1;
  const rightX = dirZ;
  const rightZ = -dirX;

  target.set(
    (anchorNode?.x ?? 0) + (rightX * PASSIVE_TRAFFIC_LANE_OFFSET),
    0,
    (anchorNode?.z ?? 0) + (rightZ * PASSIVE_TRAFFIC_LANE_OFFSET)
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
