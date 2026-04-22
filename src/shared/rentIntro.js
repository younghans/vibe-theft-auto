import { getTileCenterWorldPosition, rotateFootprintOffset } from './tileFootprint.js';
import { BUILDER_TILE_SIZE } from './worldConstants.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

export const RENT_INTRO_AMOUNT = 100;
export const RENT_INTRO_LINE = "Hey, buddy, rent's due.";

function normalizeRotationQuarterTurns(value = 0) {
  return ((Math.round(Number(value ?? 0)) % 4) + 4) % 4;
}

export function normalizeRentCollectorEnabled(value = false) {
  return value === true;
}

function getNpcPosition(npc = null) {
  if (!npc) {
    return null;
  }

  const x = Number(npc.position?.[0] ?? npc.x);
  const z = Number(npc.position?.[1] ?? npc.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }

  return { x, z };
}

function getTileCell(placement = null) {
  const cellX = Number(placement?.cell?.[0] ?? placement?.cellX);
  const cellZ = Number(placement?.cell?.[1] ?? placement?.cellZ);
  if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) {
    return null;
  }

  return {
    x: Math.round(cellX),
    z: Math.round(cellZ)
  };
}

function getTileCenter(placement = null) {
  const item = getBuilderItemById(placement?.itemId);
  const cell = getTileCell(placement);
  if (!item || !cell) {
    return null;
  }

  return getTileCenterWorldPosition(
    item,
    cell.x,
    cell.z,
    normalizeRotationQuarterTurns(placement?.rotationQuarterTurns)
  );
}

export function isRentIntroCollector(npc = null) {
  return normalizeRentCollectorEnabled(npc?.rentCollectorEnabled);
}

export function isRentIntroBuilding(placement = null) {
  const item = getBuilderItemById(placement?.itemId);
  return Boolean(
    placement
    && item
    && (!placement.layer || placement.layer === 'tile')
    && item.groupId === 'lots'
    && item.underlayTileId
  );
}

export function getRentIntroSpawnForBuilding(placement = null) {
  const center = getTileCenter(placement);
  if (!center) {
    return null;
  }

  const rotationQuarterTurns = normalizeRotationQuarterTurns(placement?.rotationQuarterTurns);
  const exitOffset = rotateFootprintOffset(0, BUILDER_TILE_SIZE * 0.68, rotationQuarterTurns);
  const facingOffset = rotateFootprintOffset(0, 1, rotationQuarterTurns);

  return {
    x: Number((center.x + exitOffset.x).toFixed(2)),
    z: Number((center.z + exitOffset.z).toFixed(2)),
    rotationY: Number(Math.atan2(facingOffset.x, facingOffset.z).toFixed(3))
  };
}

export function resolveRentIntroPlan(layout = null) {
  const npcs = [...(layout?.npcs ?? [])];
  const tiles = [...(layout?.tiles ?? [])];
  const collector = npcs.find((npc) => isRentIntroCollector(npc)) ?? null;
  const collectorPosition = getNpcPosition(collector);
  if (!collector || !collectorPosition) {
    return null;
  }

  const building = tiles
    .filter((placement) => isRentIntroBuilding(placement))
    .map((placement) => ({
      placement,
      center: getTileCenter(placement)
    }))
    .filter((entry) => entry.center)
    .sort((a, b) => {
      const distanceA = Math.hypot(a.center.x - collectorPosition.x, a.center.z - collectorPosition.z);
      const distanceB = Math.hypot(b.center.x - collectorPosition.x, b.center.z - collectorPosition.z);
      return distanceA - distanceB;
    })[0]?.placement ?? null;

  const spawn = getRentIntroSpawnForBuilding(building);
  if (!building || !spawn) {
    return null;
  }

  return {
    amount: RENT_INTRO_AMOUNT,
    line: RENT_INTRO_LINE,
    collectorNpcId: collector.id ?? '',
    buildingPlacementId: building.id ?? '',
    spawn
  };
}
