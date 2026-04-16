import { distance2D } from '../shared/combatMath.js';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE } from '../world/builderCatalog.js';
import { getBuilderItemById } from '../world/builderCatalog.js';
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
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
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

function findNearestNode(nodes = [], position = null, filter = () => true) {
  if (!position) {
    return null;
  }

  let nearest = null;
  let nearestDistance = Infinity;

  for (const node of nodes) {
    if (!filter(node)) {
      continue;
    }

    const distance = distance2D(position.x, position.z, node.x, node.z);
    if (distance >= nearestDistance) {
      continue;
    }

    nearest = node;
    nearestDistance = distance;
  }

  return nearest;
}

const NPC_LOCAL_DIRECT_PATH_DISTANCE = BUILDER_TILE_SIZE * 1.35;
const NPC_START_NODE_SKIP_DISTANCE = BUILDER_TILE_SIZE * 0.82;
const NPC_PLACEMENT_CHAIN_START_DISTANCE = BUILDER_TILE_SIZE * 2.2;

function trimPathFromStart(path = [], startPosition = null) {
  if (!startPosition || path.length <= 1) {
    return path;
  }

  let trimCount = 0;
  while (
    trimCount < (path.length - 1)
    && distance2D(startPosition.x, startPosition.z, path[trimCount].x, path[trimCount].z) <= NPC_START_NODE_SKIP_DISTANCE
  ) {
    trimCount += 1;
  }

  return trimCount > 0
    ? path.slice(trimCount)
    : path;
}

function cloneNodePoint(node, id = node?.id ?? 'direct') {
  if (!node) {
    return null;
  }

  return {
    x: Number(node.x.toFixed(2)),
    z: Number(node.z.toFixed(2)),
    id
  };
}

function isPointInsideTilePlacement(point, placementMeta = null) {
  if (!point || !placementMeta?.occupiedCells?.length) {
    return false;
  }

  const halfTile = BUILDER_TILE_SIZE * 0.5;
  return placementMeta.occupiedCells.some((cell) => (
    point.x >= ((cell.x * BUILDER_TILE_SIZE) - halfTile)
    && point.x <= ((cell.x * BUILDER_TILE_SIZE) + halfTile)
    && point.z >= ((cell.z * BUILDER_TILE_SIZE) - halfTile)
    && point.z <= ((cell.z * BUILDER_TILE_SIZE) + halfTile)
  ));
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
    && distance2D(
      startPosition.x,
      startPosition.z,
      nearestPlacementChainNode.x,
      nearestPlacementChainNode.z
    ) <= NPC_PLACEMENT_CHAIN_START_DISTANCE
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

  const open = new Set([startId]);
  const previousById = new Map();
  const gScore = new Map([[startId, 0]]);
  const fScore = new Map([
    [
      startId,
      distance2D(
        nodeMap.get(startId).x,
        nodeMap.get(startId).z,
        nodeMap.get(goalId).x,
        nodeMap.get(goalId).z
      )
    ]
  ]);

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
        tentativeG + distance2D(neighbor.x, neighbor.z, nodeMap.get(goalId).x, nodeMap.get(goalId).z)
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

  for (const placement of worldState.getPlacements()) {
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
      continue;
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
  }

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
    nodes: [...nodeMap.values()],
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
    && distance2D(startPosition.x, startPosition.z, goalNode.x, goalNode.z) <= NPC_LOCAL_DIRECT_PATH_DISTANCE
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
      return [viaNode, goalNode].filter(Boolean).map((node) => cloneNodePoint(node));
    }

    return [cloneNodePoint(goalNode)];
  }

  const path = trimPathFromStart(runAStar(graph.nodeMap, startNode.id, goalId), startPosition);
  if (!path.length) {
    if (requiresRouteViaEntry) {
      const viaNodeId = graph?.placementNodeById?.get(routeViaPlacementId);
      const viaNode = viaNodeId ? graph?.nodeMap?.get(viaNodeId) : null;
      return [viaNode, goalNode].filter(Boolean).map((node) => cloneNodePoint(node));
    }

    return [cloneNodePoint(goalNode)];
  }

  const lastPoint = path[path.length - 1];
  if (distance2D(lastPoint.x, lastPoint.z, goalNode.x, goalNode.z) > 0.25) {
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
    && distance2D(startPosition.x, startPosition.z, targetPosition.x, targetPosition.z) <= NPC_LOCAL_DIRECT_PATH_DISTANCE
  ) {
    return [{ x: Number(targetPosition.x.toFixed(2)), z: Number(targetPosition.z.toFixed(2)), id: 'direct' }];
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
  if (distance2D(lastPoint.x, lastPoint.z, targetPosition.x, targetPosition.z) > 0.25) {
    path.push({ x: Number(targetPosition.x.toFixed(2)), z: Number(targetPosition.z.toFixed(2)), id: 'direct' });
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
