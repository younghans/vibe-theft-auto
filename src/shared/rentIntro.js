import { getTileCenterWorldPosition, rotateFootprintOffset } from './tileFootprint.js';
import { BUILDER_TILE_SIZE } from './worldConstants.js';
import {
  normalizeRotationQuarterTurns,
  quantizePosition,
  quantizeRotation
} from './numberMath.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

export const RENT_INTRO_AMOUNT = 100;
export const RENT_INTRO_LINE = "Hey, buddy, rent's due. You got my money?";

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
    x: quantizePosition(center.x + exitOffset.x),
    z: quantizePosition(center.z + exitOffset.z),
    rotationY: quantizeRotation(Math.atan2(facingOffset.x, facingOffset.z))
  };
}

function forEachRentIntroNpc(source = null, callback) {
  if (typeof source?.forEachPlacement === 'function') {
    source.forEachPlacement((placement) => {
      if (placement?.layer === 'npc') {
        callback(placement, placement.npc ?? placement);
      }
    });
    return;
  }

  for (const npc of source?.npcs ?? []) {
    callback(npc, npc);
  }
}

function forEachRentIntroBuilding(source = null, callback) {
  if (typeof source?.forEachPlacement === 'function') {
    source.forEachPlacement((placement) => {
      if (placement?.layer === 'tile') {
        callback(placement);
      }
    });
    return;
  }

  for (const placement of source?.tiles ?? []) {
    callback(placement);
  }
}

export function resolveRentIntroPlan(layout = null) {
  let collector = null;
  let collectorNpcId = '';
  let collectorPosition = null;
  forEachRentIntroNpc(layout, (placement, npc) => {
    if (collector || !isRentIntroCollector(npc)) {
      return;
    }

    const position = getNpcPosition(placement);
    if (!position) {
      return;
    }

    collector = npc;
    collectorNpcId = placement.id ?? npc.id ?? '';
    collectorPosition = position;
  });

  if (!collector || !collectorPosition) {
    return null;
  }

  let building = null;
  let buildingDistanceSq = Infinity;
  forEachRentIntroBuilding(layout, (placement) => {
    if (!isRentIntroBuilding(placement)) {
      return;
    }

    const center = getTileCenter(placement);
    if (!center) {
      return;
    }

    const dx = center.x - collectorPosition.x;
    const dz = center.z - collectorPosition.z;
    const distanceSq = (dx * dx) + (dz * dz);
    if (distanceSq < buildingDistanceSq) {
      building = placement;
      buildingDistanceSq = distanceSq;
    }
  });

  const spawn = getRentIntroSpawnForBuilding(building);
  if (!building || !spawn) {
    return null;
  }

  return {
    amount: RENT_INTRO_AMOUNT,
    line: RENT_INTRO_LINE,
    collectorNpcId,
    buildingPlacementId: building.id ?? '',
    spawn
  };
}
