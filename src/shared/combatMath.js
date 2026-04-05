import { BUILDER_TILE_SIZE, WORLD_HALF_EXTENT } from './worldConstants.js';

export function distance2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function normalizeAimVector(x, z) {
  const length = Math.hypot(x, z);
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
  let bestDistance = -Infinity;

  for (const spawn of spawnPoints) {
    let nearest = Infinity;

    for (const player of livingPlayers) {
      nearest = Math.min(nearest, distance2D(spawn[0], spawn[1], player.x, player.z));
    }

    const score = Number.isFinite(nearest) ? nearest : Infinity;
    if (score > bestDistance) {
      bestDistance = score;
      bestSpawn = spawn;
    }
  }

  return [...bestSpawn];
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

export function placementToCollisionRect(placement, item, { collisionKey = 'blocksShots' } = {}) {
  if (!placement || !itemBlocksCollision(item, collisionKey)) {
    return null;
  }

  const size = item.size ?? [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE];
  const padding = item.padding ?? 0;
  const width = size[0] + padding * 2;
  const depth = size[1] + padding * 2;
  const centerX = placement.layer === 'tile'
    ? placement.cellX * BUILDER_TILE_SIZE
    : placement.position[0];
  const centerZ = placement.layer === 'tile'
    ? placement.cellZ * BUILDER_TILE_SIZE
    : placement.position[1];

  return {
    x: centerX,
    z: centerZ,
    halfWidth: width * 0.5,
    halfDepth: depth * 0.5,
    rotationQuarterTurns: placement.rotationQuarterTurns ?? 0
  };
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

  const xHit = clipRayToAxis(localOriginX, localDirX, -rect.halfWidth, rect.halfWidth, tMin, tMax);
  if (!xHit) {
    return null;
  }
  tMin = xHit.tMin;
  tMax = xHit.tMax;

  const zHit = clipRayToAxis(localOriginZ, localDirZ, -rect.halfDepth, rect.halfDepth, tMin, tMax);
  if (!zHit) {
    return null;
  }
  tMin = zHit.tMin;
  tMax = zHit.tMax;

  if (tMin < 0 || tMin > maxDistance) {
    return null;
  }

  return tMin;
}

function clipRayToAxis(origin, direction, min, max, tMin, tMax) {
  if (Math.abs(direction) < 0.000001) {
    if (origin < min || origin > max) {
      return null;
    }
    return { tMin, tMax };
  }

  const invDirection = 1 / direction;
  let nextMin = (min - origin) * invDirection;
  let nextMax = (max - origin) * invDirection;
  if (nextMin > nextMax) {
    [nextMin, nextMax] = [nextMax, nextMin];
  }

  const clipped = {
    tMin: Math.max(tMin, nextMin),
    tMax: Math.min(tMax, nextMax)
  };

  return clipped.tMin <= clipped.tMax ? clipped : null;
}
