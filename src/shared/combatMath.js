import { BUILDER_TILE_SIZE, WORLD_HALF_EXTENT } from './worldConstants.js';
import {
  getTileCenterWorldPosition,
  rotateFootprintOffset as rotateLocalOffset
} from './tileFootprint.js';
import { getPlacementScale } from './placementScale.js';

export function distance2D(ax, az, bx, bz) {
  return Math.sqrt(distanceSquared2D(ax, az, bx, bz));
}

export function distanceSquared2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return (dx * dx) + (dz * dz);
}

export function normalizeAimVector(x, z) {
  const length = Math.sqrt((x * x) + (z * z));
  if (!Number.isFinite(length) || length <= 0.0001) {
    return { x: 0, z: 1 };
  }

  return {
    x: x / length,
    z: z / length
  };
}

export function clampToWorldBounds(x, z) {
  return {
    x: Math.min(WORLD_HALF_EXTENT, Math.max(-WORLD_HALF_EXTENT, Number.isFinite(x) ? x : 0)),
    z: Math.min(WORLD_HALF_EXTENT, Math.max(-WORLD_HALF_EXTENT, Number.isFinite(z) ? z : 0))
  };
}

export function chooseFarthestSpawnPoint(spawnPoints, livingPlayers = []) {
  let bestSpawn = spawnPoints[0] ?? [0, 0];
  let bestDistanceSq = -Infinity;

  for (const spawn of spawnPoints) {
    let nearestSq = Infinity;

    for (const player of livingPlayers) {
      nearestSq = Math.min(nearestSq, distanceSquared2D(spawn[0], spawn[1], player.x, player.z));
    }

    const scoreSq = Number.isFinite(nearestSq) ? nearestSq : Infinity;
    if (scoreSq > bestDistanceSq) {
      bestDistanceSq = scoreSq;
      bestSpawn = spawn;
    }
  }

  return [bestSpawn[0], bestSpawn[1]];
}

function itemBlocksCollision(item, collisionKey = 'blocksShots') {
  if (!item) {
    return false;
  }

  if (typeof item[collisionKey] === 'boolean') {
    return item[collisionKey];
  }

  return item.collision === true;
}

function getCustomCollisionRects(item, collisionKey = 'blocksShots') {
  if (!item) {
    return null;
  }

  if (collisionKey === 'blocksMovement') {
    return item.movementCollisionRects ?? null;
  }

  if (collisionKey === 'blocksShots') {
    return item.shotCollisionRects ?? null;
  }

  return null;
}

function localRectToWorldRect(placement, item, rect) {
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
  const tileCenter = placement.layer === 'tile'
    ? getTileCenterWorldPosition(
        item,
        placement.cellX ?? 0,
        placement.cellZ ?? 0,
        0
      )
    : null;
  const centerX = placement.layer === 'tile'
    ? tileCenter.x + rotatedCenter.x
    : placement.position[0] + rotatedCenter.x;
  const centerZ = placement.layer === 'tile'
    ? tileCenter.z + rotatedCenter.z
    : placement.position[1] + rotatedCenter.z;

  return {
    x: centerX,
    z: centerZ,
    halfWidth,
    halfDepth,
    rotationQuarterTurns: 0
  };
}

export function placementToCollisionRects(placement, item, { collisionKey = 'blocksShots' } = {}) {
  if (!placement) {
    return [];
  }

  const customRects = getCustomCollisionRects(item, collisionKey);
  if (customRects?.length) {
    const rects = [];
    for (const rect of customRects) {
      rects.push(localRectToWorldRect(placement, item, rect));
    }
    return rects;
  }

  if (!itemBlocksCollision(item, collisionKey)) {
    return [];
  }

  const size = item.size ?? [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE];
  const scale = getPlacementScale(placement);
  const padding = (item.padding ?? 0) * scale;
  const width = (size[0] * scale) + padding * 2;
  const depth = (size[1] * scale) + padding * 2;
  const tileCenter = placement.layer === 'tile'
    ? getTileCenterWorldPosition(
        item,
        placement.cellX ?? 0,
        placement.cellZ ?? 0,
        placement.rotationQuarterTurns ?? 0
      )
    : null;
  const centerX = placement.layer === 'tile'
    ? tileCenter.x
    : placement.position[0];
  const centerZ = placement.layer === 'tile'
    ? tileCenter.z
    : placement.position[1];

  return [{
    x: centerX,
    z: centerZ,
    halfWidth: width * 0.5,
    halfDepth: depth * 0.5,
    rotationQuarterTurns: placement.rotationQuarterTurns ?? 0
  }];
}

export function placementToCollisionRect(placement, item, options = {}) {
  return placementToCollisionRects(placement, item, options)[0] ?? null;
}

export function rayCircleIntersectionDistance(originX, originZ, dirX, dirZ, maxDistance, circleX, circleZ, radius) {
  const relX = originX - circleX;
  const relZ = originZ - circleZ;
  const b = 2 * ((relX * dirX) + (relZ * dirZ));
  const c = (relX * relX) + (relZ * relZ) - (radius * radius);
  const discriminant = (b * b) - (4 * c);

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const near = (-b - sqrtDiscriminant) / 2;
  const far = (-b + sqrtDiscriminant) / 2;
  const distance = near >= 0 ? near : far >= 0 ? far : null;

  if (distance == null || distance > maxDistance) {
    return null;
  }

  return distance;
}

export function capsuleCircleIntersection(originX, originZ, dirX, dirZ, maxDistance, circleX, circleZ, radius, capsuleRadius = 0) {
  const relX = circleX - originX;
  const relZ = circleZ - originZ;
  const projectedDistance = (relX * dirX) + (relZ * dirZ);
  const totalRadius = Math.max(0, radius + capsuleRadius);

  if (
    !Number.isFinite(projectedDistance)
    || projectedDistance < -totalRadius
    || projectedDistance > maxDistance + totalRadius
  ) {
    return null;
  }

  const closestDistance = Math.min(maxDistance, Math.max(0, projectedDistance));
  const closestX = originX + (dirX * closestDistance);
  const closestZ = originZ + (dirZ * closestDistance);
  const lateralDistance = Math.hypot(circleX - closestX, circleZ - closestZ);

  if (!Number.isFinite(lateralDistance) || lateralDistance > totalRadius) {
    return null;
  }

  return {
    distance: closestDistance,
    closestDistance,
    hitX: closestX,
    hitZ: closestZ
  };
}

export function chooseAimAssistTarget(origin, aim, targets = [], {
  maxDistance = 0,
  maxAngleRad = 0,
  rangeBonus = 0,
  capsuleRadius = 0
} = {}) {
  if (
    !origin
    || !aim
    || !Number.isFinite(origin.x)
    || !Number.isFinite(origin.z)
    || !Number.isFinite(aim.x)
    || !Number.isFinite(aim.z)
    || !Number.isFinite(maxDistance)
    || maxDistance <= 0
    || !Number.isFinite(maxAngleRad)
    || maxAngleRad <= 0
  ) {
    return null;
  }

  const minDot = Math.cos(maxAngleRad);
  let best = null;

  for (const target of targets ?? []) {
    const targetX = Number(target?.x);
    const targetZ = Number(target?.z);
    const radius = Math.max(0, Number(target?.radius) || 0);
    const deltaX = targetX - origin.x;
    const deltaZ = targetZ - origin.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (!Number.isFinite(distance) || distance <= 0.0001) {
      continue;
    }

    const maxReach = maxDistance + Math.max(0, Number(rangeBonus) || 0) + radius + Math.max(0, Number(capsuleRadius) || 0);
    if (distance > maxReach) {
      continue;
    }

    const dirX = deltaX / distance;
    const dirZ = deltaZ / distance;
    const dot = (aim.x * dirX) + (aim.z * dirZ);
    if (!Number.isFinite(dot) || dot < minDot) {
      continue;
    }

    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const lateralDistance = Math.sin(angle) * distance;
    const edgeDistance = Math.max(0, distance - radius);
    const score = (angle / maxAngleRad * 2)
      + (edgeDistance / Math.max(0.001, maxReach))
      + (lateralDistance / Math.max(0.001, radius + Math.max(0, Number(capsuleRadius) || 0))) * 0.12;

    if (!best || score < best.score) {
      best = {
        kind: target.kind ?? '',
        targetId: target.targetId ?? '',
        x: dirX,
        z: dirZ,
        angle,
        distance,
        score
      };
    }
  }

  return best;
}

export function rayRectIntersectionDistance(originX, originZ, dirX, dirZ, maxDistance, rect) {
  if (!rect) {
    return null;
  }

  const rotation = (rect.rotationQuarterTurns ?? 0) * (Math.PI / 2);
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localOriginX = ((originX - rect.x) * cos) - ((originZ - rect.z) * sin);
  const localOriginZ = ((originX - rect.x) * sin) + ((originZ - rect.z) * cos);
  const localDirX = (dirX * cos) - (dirZ * sin);
  const localDirZ = (dirX * sin) + (dirZ * cos);

  let tMin = 0;
  let tMax = maxDistance;

  if (Math.abs(localDirX) < 0.000001) {
    if (localOriginX < -rect.halfWidth || localOriginX > rect.halfWidth) {
      return null;
    }
  } else {
    const invDirection = 1 / localDirX;
    let nextMin = (-rect.halfWidth - localOriginX) * invDirection;
    let nextMax = (rect.halfWidth - localOriginX) * invDirection;
    if (nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }
    tMin = Math.max(tMin, nextMin);
    tMax = Math.min(tMax, nextMax);
    if (tMin > tMax) {
      return null;
    }
  }

  if (Math.abs(localDirZ) < 0.000001) {
    if (localOriginZ < -rect.halfDepth || localOriginZ > rect.halfDepth) {
      return null;
    }
  } else {
    const invDirection = 1 / localDirZ;
    let nextMin = (-rect.halfDepth - localOriginZ) * invDirection;
    let nextMax = (rect.halfDepth - localOriginZ) * invDirection;
    if (nextMin > nextMax) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }
    tMin = Math.max(tMin, nextMin);
    tMax = Math.min(tMax, nextMax);
    if (tMin > tMax) {
      return null;
    }
  }

  return tMin >= 0 && tMin <= maxDistance ? tMin : null;
}
