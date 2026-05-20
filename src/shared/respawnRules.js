import { getTileCenterWorldPosition, getTileFootprint, rotateFootprintOffset } from './tileFootprint.js';
import { BUILDER_TILE_SIZE } from './worldConstants.js';

export const PLAYER_RESPAWN_COST = 50;

const HOSPITAL_ITEM_IDS = new Set([
  'hospital_building',
  'hospital_building_wide'
]);

const HOSPITAL_RESPAWN_FRONT_OFFSET = BUILDER_TILE_SIZE * 0.3;
const FALLBACK_HOSPITAL_RESPAWN_POINT = Object.freeze({
  x: BUILDER_TILE_SIZE * 3.5,
  z: BUILDER_TILE_SIZE * 5.8,
  rotationY: Math.PI
});

function getHospitalPlacementScore(placement, item) {
  const [width = 1, depth = 1] = getTileFootprint(item);
  const cellX = Number(placement.cellX) || 0;
  const cellZ = Number(placement.cellZ) || 0;
  const distanceFromCenter = Math.sqrt((cellX * cellX) + (cellZ * cellZ));
  return (width * depth * 1000) - distanceFromCenter;
}

export function getHospitalRespawnPoint(placements = [], getItemById = () => null) {
  let best = null;
  let bestScore = -Infinity;

  const visitPlacement = (placement) => {
    if (
      !placement
      || placement.layer !== 'tile'
      || !HOSPITAL_ITEM_IDS.has(placement.itemId)
    ) {
      return;
    }

    const item = getItemById(placement.itemId);
    if (!item) {
      return;
    }

    const score = getHospitalPlacementScore(placement, item);
    if (score > bestScore) {
      best = { placement, item };
      bestScore = score;
    }
  };

  if (placements && typeof placements.forEachPlacement === 'function') {
    placements.forEachPlacement(visitPlacement);
  } else {
    for (const placement of placements ?? []) {
      visitPlacement(placement);
    }
  }

  if (!best) {
    return { ...FALLBACK_HOSPITAL_RESPAWN_POINT };
  }

  const { placement, item } = best;
  const center = getTileCenterWorldPosition(
    item,
    placement.cellX ?? 0,
    placement.cellZ ?? 0,
    placement.rotationQuarterTurns ?? 0
  );
  const [, footprintDepth = 1] = getTileFootprint(item);
  const frontOffset = rotateFootprintOffset(
    0,
    (footprintDepth * BUILDER_TILE_SIZE * 0.5) + HOSPITAL_RESPAWN_FRONT_OFFSET,
    placement.rotationQuarterTurns ?? 0
  );
  const x = center.x + frontOffset.x;
  const z = center.z + frontOffset.z;

  return {
    x,
    z,
    rotationY: Math.atan2(center.x - x, center.z - z)
  };
}
