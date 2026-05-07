import { BUILDER_TILE_SIZE } from './worldConstants.js';
import { normalizeRotationQuarterTurns } from './numberMath.js';

function normalizeFootprintValue(value) {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.round(numeric));
}

export function rotateFootprintOffset(x, z, rotationQuarterTurns = 0) {
  switch (normalizeRotationQuarterTurns(rotationQuarterTurns)) {
    case 1:
      return { x: z, z: -x };
    case 2:
      return { x: -x, z: -z };
    case 3:
      return { x: -z, z: x };
    default:
      return { x, z };
  }
}

export function getTileFootprint(item) {
  if (item?.layer !== 'tile') {
    return [1, 1];
  }

  const [width = 1, depth = 1] = item.tileFootprint ?? [1, 1];
  return [
    normalizeFootprintValue(width),
    normalizeFootprintValue(depth)
  ];
}

export function getTileFootprintWorldSize(item, rotationQuarterTurns = 0) {
  const [width, depth] = getTileFootprint(item);
  const swapAxes = Math.abs(normalizeRotationQuarterTurns(rotationQuarterTurns) % 2) === 1;
  const worldWidth = (swapAxes ? depth : width) * BUILDER_TILE_SIZE;
  const worldDepth = (swapAxes ? width : depth) * BUILDER_TILE_SIZE;
  return [worldWidth, worldDepth];
}

export function getTileLocalCenterOffset(item) {
  const [width, depth] = getTileFootprint(item);
  return {
    x: ((width - 1) * BUILDER_TILE_SIZE) * 0.5,
    z: ((depth - 1) * BUILDER_TILE_SIZE) * 0.5
  };
}

export function getTileLocalCellOffsets(item) {
  const [width, depth] = getTileFootprint(item);
  const offsets = [];

  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      offsets.push({
        x: x * BUILDER_TILE_SIZE,
        z: z * BUILDER_TILE_SIZE
      });
    }
  }

  return offsets;
}

export function getTileOccupiedCellOffsets(item, rotationQuarterTurns = 0) {
  const [width, depth] = getTileFootprint(item);
  const offsets = [];

  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      offsets.push(rotateFootprintOffset(x, z, rotationQuarterTurns));
    }
  }

  return offsets;
}

export function getTileOccupiedCells(item, cellX, cellZ, rotationQuarterTurns = 0) {
  return getTileOccupiedCellOffsets(item, rotationQuarterTurns).map((offset) => ({
    x: cellX + offset.x,
    z: cellZ + offset.z
  }));
}

export function getTileAnchorWorldPosition(cellX, cellZ) {
  return {
    x: cellX * BUILDER_TILE_SIZE,
    z: cellZ * BUILDER_TILE_SIZE
  };
}

export function getTileCenterWorldPosition(item, cellX, cellZ, rotationQuarterTurns = 0) {
  const anchor = getTileAnchorWorldPosition(cellX, cellZ);
  const localCenter = getTileLocalCenterOffset(item);
  const rotatedCenter = rotateFootprintOffset(localCenter.x, localCenter.z, rotationQuarterTurns);

  return {
    x: anchor.x + rotatedCenter.x,
    z: anchor.z + rotatedCenter.z
  };
}
