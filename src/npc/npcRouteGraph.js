import { distance2D } from '../shared/combatMath.js';
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

  for (const placement of worldState.getPlacements()) {
    const item = getBuilderItemById(placement.itemId);
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

  for (const target of collectNpcTargetOptions(worldState)) {
    const targetKey = nodeKeyForTarget(target.placementId);
    const node = makeNode(targetKey, target.approachPosition.x, target.approachPosition.z, {
      kind: 'target',
      placementId: target.placementId
    });
    nodeMap.set(targetKey, node);
    placementNodeById.set(target.placementId, targetKey);

    const nearestRoadNode = findNearestNode(routeNodes, target.approachPosition);
    if (nearestRoadNode) {
      addEdge(nodeMap, targetKey, nearestRoadNode.id);
    }
  }

  return {
    nodeMap,
    nodes: [...nodeMap.values()],
    routeNodes,
    placementNodeById
  };
}

export function buildNpcPathToPlacement(graph, startPosition, targetPlacementId) {
  const goalId = graph?.placementNodeById?.get(targetPlacementId);
  if (!goalId) {
    return [];
  }

  const nodes = graph.nodes ?? [];
  const startNode = findNearestNode(nodes, startPosition);
  if (!startNode) {
    const goalNode = graph.nodeMap.get(goalId);
    return goalNode ? [{ x: goalNode.x, z: goalNode.z, id: goalNode.id }] : [];
  }

  return runAStar(graph.nodeMap, startNode.id, goalId);
}

export function buildNpcPathToPosition(graph, startPosition, targetPosition) {
  const nodes = graph?.nodes ?? [];
  const startNode = findNearestNode(nodes, startPosition);
  const goalNode = findNearestNode(nodes, targetPosition);
  if (!startNode || !goalNode) {
    return targetPosition ? [{ x: targetPosition.x, z: targetPosition.z, id: 'direct' }] : [];
  }

  const path = runAStar(graph.nodeMap, startNode.id, goalNode.id);
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
