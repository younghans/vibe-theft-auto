import { distance2D, distanceSquared2D } from '../shared/combatMath.js';
import { quantizePosition } from '../shared/numberMath.js';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from '../world/builderCatalog.js';
import { collectNpcTargetOptions } from './npcTargeting.js';

function isRoutePlacement(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!placement || placement.layer !== 'tile' || !item?.assetName) {
    return false;
  }

  return item.assetName.startsWith('road_') || item.assetName.startsWith('park_road_');
}

function nodeKeyForCell(cellX, cellZ) {
  return `cell:${cellX},${cellZ}`;
}

function nodeKeyForTarget(targetPlacementId) {
  return `target:${targetPlacementId}`;
}

function makeNode(id, x, z, meta = {}) {
  return {
    id,
    x: quantizePosition(x),
    z: quantizePosition(z),
    neighbors: new Set(),
    ...meta
  };
}

function addEdge(nodeMap, a, b) {
  if (!nodeMap.has(a) || !nodeMap.has(b) || a === b) {
    return;
  }

  nodeMap.get(a).neighbors.add(b);
  nodeMap.get(b).neighbors.add(a);
}

function collectMapValues(map) {
  const values = [];
  for (const value of map.values()) {
    values.push(value);
  }
  return values;
}

function findNearestNode(nodes = [], position = null, filter = () => true) {
  if (!position) {
    return null;
  }

  let nearest = null;
  let nearestDistanceSq = Infinity;

  for (const node of nodes) {
    if (!filter(node)) {
      continue;
    }

    const distanceSq = distanceSquared2D(position.x, position.z, node.x, node.z);
    if (distanceSq >= nearestDistanceSq) {
      continue;
    }

    nearest = node;
    nearestDistanceSq = distanceSq;
  }

  return nearest;
}

const NPC_LOCAL_DIRECT_PATH_DISTANCE = BUILDER_TILE_SIZE * 1.35;
const NPC_START_NODE_SKIP_DISTANCE = BUILDER_TILE_SIZE * 0.82;
const NPC_PLACEMENT_CHAIN_START_DISTANCE = BUILDER_TILE_SIZE * 2.2;
const NPC_LOCAL_DIRECT_PATH_DISTANCE_SQ = NPC_LOCAL_DIRECT_PATH_DISTANCE * NPC_LOCAL_DIRECT_PATH_DISTANCE;
const NPC_START_NODE_SKIP_DISTANCE_SQ = NPC_START_NODE_SKIP_DISTANCE * NPC_START_NODE_SKIP_DISTANCE;
const NPC_PLACEMENT_CHAIN_START_DISTANCE_SQ = NPC_PLACEMENT_CHAIN_START_DISTANCE * NPC_PLACEMENT_CHAIN_START_DISTANCE;

function trimPathFromStart(path = [], startPosition = null) {
  if (!startPosition || path.length <= 1) {
    return path;
  }

  let trimCount = 0;
  while (
    trimCount < (path.length - 1)
    && distanceSquared2D(startPosition.x, startPosition.z, path[trimCount].x, path[trimCount].z) <= NPC_START_NODE_SKIP_DISTANCE_SQ
  ) {
    trimCount += 1;
  }

  if (trimCount <= 0) {
    return path;
  }

  const trimmedPath = [];
  for (let index = trimCount; index < path.length; index += 1) {
    trimmedPath.push(path[index]);
  }
  return trimmedPath;
}

function cloneNodePoint(node, id = node?.id ?? 'direct') {
  if (!node) {
    return null;
  }

  return {
    x: quantizePosition(node.x),
    z: quantizePosition(node.z),
    id
  };
}

function cloneOptionalNodePath(...nodes) {
  const path = [];
  for (const node of nodes) {
    const point = cloneNodePoint(node);
    if (point) {
      path.push(point);
    }
  }
  return path;
}

function isPointInsideTilePlacement(point, placementMeta = null) {
  if (!point || !placementMeta?.occupiedCells?.length) {
    return false;
  }

  const halfTile = BUILDER_TILE_SIZE * 0.5;
  for (let index = 0; index < placementMeta.occupiedCells.length; index += 1) {
    const cell = placementMeta.occupiedCells[index];
    if (
      point.x >= ((cell.x * BUILDER_TILE_SIZE) - halfTile)
      && point.x <= ((cell.x * BUILDER_TILE_SIZE) + halfTile)
      && point.z >= ((cell.z * BUILDER_TILE_SIZE) - halfTile)
      && point.z <= ((cell.z * BUILDER_TILE_SIZE) + halfTile)
    ) {
      return true;
    }
  }

  return false;
}

function getPlacementStartNode(graph, startPosition, goalNode) {
  const allNodes = graph?.nodes ?? [];
  const routeNodes = graph?.routeNodes ?? [];
  const nearestRouteNode = findNearestNode(routeNodes.length ? routeNodes : allNodes, startPosition);

  if (!goalNode || !startPosition) {
    return nearestRouteNode ?? findNearestNode(allNodes, startPosition);
  }

  const placementChainNodes = [goalNode];
  for (const neighborId of goalNode.neighbors ?? []) {
    const neighbor = graph?.nodeMap?.get(neighborId);
    if (neighbor?.kind === 'target') {
      placementChainNodes.push(neighbor);
    }
  }

  const nearestPlacementChainNode = findNearestNode(placementChainNodes, startPosition);
  if (
    nearestPlacementChainNode
    && distanceSquared2D(
      startPosition.x,
      startPosition.z,
      nearestPlacementChainNode.x,
      nearestPlacementChainNode.z
    ) <= NPC_PLACEMENT_CHAIN_START_DISTANCE_SQ
  ) {
    return nearestPlacementChainNode;
  }

  return nearestRouteNode ?? nearestPlacementChainNode ?? findNearestNode(allNodes, startPosition);
}

function reconstructPath(previousById, nodeMap, goalId) {
  const path = [];
  let current = goalId;

  while (current && nodeMap.has(current)) {
    const node = nodeMap.get(current);
    path.push({ x: node.x, z: node.z, id: node.id });
    current = previousById.get(current) ?? null;
  }

  return path.reverse();
}

function runAStar(nodeMap, startId, goalId) {
  if (!nodeMap.has(startId) || !nodeMap.has(goalId)) {
    return [];
  }

  const startNode = nodeMap.get(startId);
  const goalNode = nodeMap.get(goalId);
  const open = new Set();
  open.add(startId);
  const previousById = new Map();
  const gScore = new Map();
  gScore.set(startId, 0);
  const fScore = new Map();
  fScore.set(startId, distance2D(
    startNode.x,
    startNode.z,
    goalNode.x,
    goalNode.z
  ));

  while (open.size) {
    let currentId = null;
    let currentScore = Infinity;

    for (const candidateId of open) {
      const score = fScore.get(candidateId) ?? Infinity;
      if (score < currentScore) {
        currentId = candidateId;
        currentScore = score;
      }
    }

    if (!currentId) {
      break;
    }

    if (currentId === goalId) {
      return reconstructPath(previousById, nodeMap, goalId);
    }

    open.delete(currentId);
    const current = nodeMap.get(currentId);
    for (const neighborId of current.neighbors) {
      const neighbor = nodeMap.get(neighborId);
      if (!neighbor) {
        continue;
      }

      const tentativeG = (gScore.get(currentId) ?? Infinity)
        + distance2D(current.x, current.z, neighbor.x, neighbor.z);
      if (tentativeG >= (gScore.get(neighborId) ?? Infinity)) {
        continue;
      }

      previousById.set(neighborId, currentId);
      gScore.set(neighborId, tentativeG);
      fScore.set(
        neighborId,
        tentativeG + distance2D(neighbor.x, neighbor.z, goalNode.x, goalNode.z)
      );
      open.add(neighborId);
    }
  }

  return [];
}

export function buildNpcRouteGraph(worldState) {
  const nodeMap = new Map();
  const routeNodes = [];
  const placementNodeById = new Map();
  const placementMetaById = new Map();
  const targets = collectNpcTargetOptions(worldState);

  worldState.forEachPlacement((placement) => {
    const item = getBuilderItemById(placement.itemId);
    if (placement?.layer === 'tile' && item) {
      placementMetaById.set(placement.id, {
        id: placement.id,
        layer: placement.layer,
        itemId: placement.itemId,
        cellX: placement.cellX ?? 0,
        cellZ: placement.cellZ ?? 0,
        rotationQuarterTurns: placement.rotationQuarterTurns ?? 0,
        occupiedCells: getTileOccupiedCells(
          item,
          placement.cellX ?? 0,
          placement.cellZ ?? 0,
          placement.rotationQuarterTurns ?? 0
        )
      });
    }

    if (!isRoutePlacement(placement, item)) {
      return;
    }

    const key = nodeKeyForCell(placement.cellX ?? 0, placement.cellZ ?? 0);
    if (!nodeMap.has(key)) {
      const centerX = (placement.cellX ?? 0) * BUILDER_TILE_SIZE;
      const centerZ = (placement.cellZ ?? 0) * BUILDER_TILE_SIZE;
      const node = makeNode(key, centerX, centerZ, {
        kind: 'road',
        cellX: placement.cellX,
        cellZ: placement.cellZ
      });
      nodeMap.set(key, node);
      routeNodes.push(node);
    }
  });

  for (const node of routeNodes) {
    addEdge(nodeMap, node.id, nodeKeyForCell((node.cellX ?? 0) + 1, node.cellZ ?? 0));
    addEdge(nodeMap, node.id, nodeKeyForCell((node.cellX ?? 0) - 1, node.cellZ ?? 0));
    addEdge(nodeMap, node.id, nodeKeyForCell(node.cellX ?? 0, (node.cellZ ?? 0) + 1));
    addEdge(nodeMap, node.id, nodeKeyForCell(node.cellX ?? 0, (node.cellZ ?? 0) - 1));
  }

  for (const target of targets) {
    const targetKey = nodeKeyForTarget(target.placementId);
    const node = makeNode(targetKey, target.approachPosition.x, target.approachPosition.z, {
      kind: 'target',
      placementId: target.placementId,
      routeViaPlacementId: target.routeViaPlacementId ?? ''
    });
    nodeMap.set(targetKey, node);
    placementNodeById.set(target.placementId, targetKey);
  }

  for (const target of targets) {
    const targetKey = placementNodeById.get(target.placementId);
    const viaPlacementNodeId = target.routeViaPlacementId
      ? placementNodeById.get(target.routeViaPlacementId)
      : null;

    if (targetKey && viaPlacementNodeId) {
      addEdge(nodeMap, targetKey, viaPlacementNodeId);
      continue;
    }

    const nearestRoadNode = findNearestNode(routeNodes, target.approachPosition);
    if (nearestRoadNode) {
      addEdge(nodeMap, targetKey, nearestRoadNode.id);
    }
  }

  return {
    nodeMap,
    nodes: collectMapValues(nodeMap),
    routeNodes,
    placementNodeById,
    placementMetaById
  };
}

export function buildNpcPathToPlacement(graph, startPosition, targetPlacementId) {
  const goalId = graph?.placementNodeById?.get(targetPlacementId);
  if (!goalId) {
    return [];
  }

  const goalNode = graph?.nodeMap?.get(goalId);
  if (!goalNode) {
    return [];
  }

  const routeViaPlacementId = goalNode.routeViaPlacementId || '';
  const routeViaPlacementMeta = routeViaPlacementId
    ? graph?.placementMetaById?.get(routeViaPlacementId)
    : null;
  const startInsideRouteViaPlacement = routeViaPlacementMeta
    ? isPointInsideTilePlacement(startPosition, routeViaPlacementMeta)
    : false;
  const requiresRouteViaEntry = Boolean(routeViaPlacementId && !startInsideRouteViaPlacement);

  if (
    !requiresRouteViaEntry
    &&
    startPosition
    && distanceSquared2D(startPosition.x, startPosition.z, goalNode.x, goalNode.z) <= NPC_LOCAL_DIRECT_PATH_DISTANCE_SQ
  ) {
    return [cloneNodePoint(goalNode)];
  }

  const startNode = requiresRouteViaEntry
    ? findNearestNode((graph?.routeNodes?.length ? graph.routeNodes : graph?.nodes) ?? [], startPosition)
    : getPlacementStartNode(graph, startPosition, goalNode);
  if (!startNode) {
    if (requiresRouteViaEntry) {
      const viaNodeId = graph?.placementNodeById?.get(routeViaPlacementId);
      const viaNode = viaNodeId ? graph?.nodeMap?.get(viaNodeId) : null;
      return cloneOptionalNodePath(viaNode, goalNode);
    }

    return [cloneNodePoint(goalNode)];
  }

  const path = trimPathFromStart(runAStar(graph.nodeMap, startNode.id, goalId), startPosition);
  if (!path.length) {
    if (requiresRouteViaEntry) {
      const viaNodeId = graph?.placementNodeById?.get(routeViaPlacementId);
      const viaNode = viaNodeId ? graph?.nodeMap?.get(viaNodeId) : null;
      return cloneOptionalNodePath(viaNode, goalNode);
    }

    return [cloneNodePoint(goalNode)];
  }

  const lastPoint = path[path.length - 1];
  if (distanceSquared2D(lastPoint.x, lastPoint.z, goalNode.x, goalNode.z) > 0.25 * 0.25) {
    path.push(cloneNodePoint(goalNode));
  }

  return path;
}

export function buildNpcPathToPosition(graph, startPosition, targetPosition) {
  if (!targetPosition) {
    return [];
  }

  if (
    startPosition
    && distanceSquared2D(startPosition.x, startPosition.z, targetPosition.x, targetPosition.z) <= NPC_LOCAL_DIRECT_PATH_DISTANCE_SQ
  ) {
    return [{ x: quantizePosition(targetPosition.x), z: quantizePosition(targetPosition.z), id: 'direct' }];
  }

  const allNodes = graph?.nodes ?? [];
  const routeNodes = graph?.routeNodes ?? [];
  const startNode = findNearestNode(allNodes, startPosition);
  const goalNode = findNearestNode(routeNodes.length ? routeNodes : allNodes, targetPosition);
  if (!startNode || !goalNode) {
    return targetPosition ? [{ x: targetPosition.x, z: targetPosition.z, id: 'direct' }] : [];
  }

  const path = trimPathFromStart(runAStar(graph.nodeMap, startNode.id, goalNode.id), startPosition);
  if (!path.length) {
    return [{ x: targetPosition.x, z: targetPosition.z, id: 'direct' }];
  }

  const lastPoint = path[path.length - 1];
  if (distanceSquared2D(lastPoint.x, lastPoint.z, targetPosition.x, targetPosition.z) > 0.25 * 0.25) {
    path.push({ x: quantizePosition(targetPosition.x), z: quantizePosition(targetPosition.z), id: 'direct' });
  }

  return path;
}

export function findNearestRoutePosition(graph, position) {
  const nearest = findNearestNode(graph?.routeNodes ?? [], position);
  return nearest
    ? { x: nearest.x, z: nearest.z }
    : null;
}

export function findFarthestRouteNodeFrom(graph, threatPosition, anchorPosition = null) {
  const routeNodes = graph?.routeNodes ?? [];
  if (!routeNodes.length) {
    return anchorPosition
      ? { x: anchorPosition.x, z: anchorPosition.z }
      : null;
  }

  let best = null;
  let bestScore = -Infinity;

  for (const node of routeNodes) {
    const threatDistance = distance2D(node.x, node.z, threatPosition?.x ?? 0, threatPosition?.z ?? 0);
    const anchorBias = anchorPosition
      ? distance2D(node.x, node.z, anchorPosition.x, anchorPosition.z) * -0.25
      : 0;
    const score = threatDistance + anchorBias;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  return best
    ? { x: best.x, z: best.z }
    : null;
}
