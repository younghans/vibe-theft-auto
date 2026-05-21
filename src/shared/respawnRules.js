import { getTileCenterWorldPosition, getTileFootprint, rotateFootprintOffset } from './tileFootprint.js';
import { BUILDER_TILE_SIZE } from './worldConstants.js';

export const PLAYER_RESPAWN_COST = 50;
export const DR_JOE_RESPAWN_RADIUS = 10;

export const DR_JOE_RESPAWN_LINES = Object.freeze([
  'Breathe slowly after a scare. Long exhales help your heart rate settle.',
  'Hydration helps recovery. Water first, victory snacks second.',
  'If you hit your head and feel confused or nauseous, get checked right away.',
  'Wash your hands for twenty seconds. It beats most street medicine.',
  'Sleep is repair time. Your body does its best patch notes while you rest.',
  'A quick stretch after waking up helps circulation before you sprint back out.'
]);

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

function getNpcX(npc = null) {
  return Number(npc?.x ?? npc?.position?.[0]);
}

function getNpcZ(npc = null) {
  return Number(npc?.z ?? npc?.position?.[1]);
}

function getNpcCollectionValues(npcs = null) {
  if (Array.isArray(npcs)) {
    return npcs;
  }
  if (npcs && typeof npcs.values === 'function') {
    return npcs.values();
  }
  return [];
}

function getPlacementCellX(placement = null) {
  return Number(placement?.cellX ?? placement?.cell?.[0]) || 0;
}

function getPlacementCellZ(placement = null) {
  return Number(placement?.cellZ ?? placement?.cell?.[1]) || 0;
}

export function isDrJoeNpc(npc = null) {
  const id = String(npc?.id ?? '').trim().toLowerCase();
  const name = String(npc?.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return id === 'npc_dr_joe'
    || id === 'dr_joe'
    || id === 'drjoe'
    || name === 'dr. joe'
    || name === 'dr joe'
    || name === 'doctor joe';
}

export function getRandomDrJoeRespawnLine(random = Math.random) {
  const roll = Number(random?.());
  const index = Math.max(
    0,
    Math.min(
      DR_JOE_RESPAWN_LINES.length - 1,
      Math.floor((Number.isFinite(roll) ? roll : 0) * DR_JOE_RESPAWN_LINES.length)
    )
  );
  return DR_JOE_RESPAWN_LINES[index];
}

export function findDrJoeRespawnNpc(npcs = null, respawnPoint = null, radius = DR_JOE_RESPAWN_RADIUS) {
  const respawnX = Number(respawnPoint?.x);
  const respawnZ = Number(respawnPoint?.z);
  if (!Number.isFinite(respawnX) || !Number.isFinite(respawnZ)) {
    return null;
  }

  const searchRadius = Math.max(0, Number(radius) || 0);
  const maxDistanceSq = searchRadius * searchRadius;
  let bestNpc = null;
  let bestDistanceSq = Infinity;

  for (const npc of getNpcCollectionValues(npcs)) {
    if (!isDrJoeNpc(npc) || npc?.alive === false || npc?.active === false) {
      continue;
    }

    const x = getNpcX(npc);
    const z = getNpcZ(npc);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      continue;
    }

    const dx = x - respawnX;
    const dz = z - respawnZ;
    const distanceSq = (dx * dx) + (dz * dz);
    if (distanceSq > maxDistanceSq || distanceSq >= bestDistanceSq) {
      continue;
    }

    bestNpc = npc;
    bestDistanceSq = distanceSq;
  }

  return bestNpc;
}

function getHospitalPlacementScore(placement, item) {
  const [width = 1, depth = 1] = getTileFootprint(item);
  const cellX = getPlacementCellX(placement);
  const cellZ = getPlacementCellZ(placement);
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
    getPlacementCellX(placement),
    getPlacementCellZ(placement),
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
