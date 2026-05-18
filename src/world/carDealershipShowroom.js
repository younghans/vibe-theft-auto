import {
  normalizeRotationQuarterTurns,
  quantizePosition,
  quantizeRotation,
  rotationRadiansToQuarterTurns
} from '../shared/numberMath.js';
import {
  getTileCenterWorldPosition,
  rotateFootprintOffset
} from '../shared/tileFootprint.js';
import { getBuilderItemById } from './builderCatalog.js';

export const CAR_DEALERSHIP_SHOWROOM_CAR_SCALE = 0.75;
export const CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_Z = 5.35;
export const CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X = 5.9;
export const CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X = 3.0;
export const CAR_DEALERSHIP_DOOR_LOCAL_Z = 10.74;

export const CAR_DEALERSHIP_SHOWROOM_CARS = Object.freeze([
  {
    itemId: 'car_fiat_duna',
    label: 'Fiat Duna',
    idSuffix: 'fiat_duna',
    localX: -CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X,
    doorTargetLocalX: -CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X
  },
  {
    itemId: 'car_toyota_ae86',
    label: 'Toyota AE86',
    idSuffix: 'toyota_ae86',
    localX: CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X,
    doorTargetLocalX: CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X
  }
]);

function signedRotationQuarterTurnsToRadians(rotationQuarterTurns = 0) {
  const normalized = normalizeRotationQuarterTurns(rotationQuarterTurns);
  const radians = normalized * (Math.PI / 2);
  return radians > Math.PI ? radians - (Math.PI * 2) : radians;
}

function getPlacementIdSet(layout = {}) {
  return new Set([
    ...(layout.tiles ?? []).map((placement) => placement.id),
    ...(layout.props ?? []).map((placement) => placement.id),
    ...(layout.npcs ?? []).map((placement) => placement.id)
  ].filter(Boolean));
}

function getUniquePlacementId(layout, preferredId) {
  const ids = getPlacementIdSet(layout);
  if (!ids.has(preferredId)) {
    return preferredId;
  }

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${preferredId}_${index}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
  }

  return `${preferredId}_fallback`;
}

function getDealershipPlacement(layout = {}) {
  return (layout.tiles ?? []).find((placement) => placement.itemId === 'car_dealership_building') ?? null;
}

function getLocalPositionFromDealership(dealershipPlacement, dealershipItem, position = []) {
  if (!dealershipPlacement || !dealershipItem || !Array.isArray(position) || position.length < 2) {
    return null;
  }

  const rotationQuarterTurns = normalizeRotationQuarterTurns(dealershipPlacement.rotationQuarterTurns);
  const center = getTileCenterWorldPosition(
    dealershipItem,
    dealershipPlacement.cell?.[0] ?? 0,
    dealershipPlacement.cell?.[1] ?? 0,
    rotationQuarterTurns
  );
  return rotateFootprintOffset(
    (Number(position[0]) || 0) - center.x,
    (Number(position[1]) || 0) - center.z,
    -rotationQuarterTurns
  );
}

function isShowroomPlacementCandidate(prop, spec, dealershipPlacement, dealershipItem) {
  if (prop?.itemId !== spec.itemId) {
    return false;
  }

  const local = getLocalPositionFromDealership(dealershipPlacement, dealershipItem, prop.position);
  return Boolean(
    local
    && local.x >= -10.35
    && local.x <= 10.35
    && local.z >= 0.2
    && local.z <= 10.55
  );
}

function positionsMatch(left = [], right = [], epsilon = 0.05) {
  return Math.abs((left?.[0] ?? Number.NaN) - (right?.[0] ?? Number.NaN)) <= epsilon
    && Math.abs((left?.[1] ?? Number.NaN) - (right?.[1] ?? Number.NaN)) <= epsilon;
}

function propMatchesShowroomPlacement(prop, placement) {
  return Boolean(
    prop
    && prop.itemId === placement.itemId
    && positionsMatch(prop.position, placement.position)
    && prop.rotationQuarterTurns === placement.rotationQuarterTurns
    && Number(prop.rotationY) === placement.rotationY
    && Number(prop.scale) === placement.scale
  );
}

export function getCarDealershipShowroomCarPlacements(layout = {}) {
  const dealershipPlacement = getDealershipPlacement(layout);
  const dealershipItem = getBuilderItemById('car_dealership_building');
  if (!dealershipPlacement || !dealershipItem) {
    return [];
  }

  const rotationQuarterTurns = normalizeRotationQuarterTurns(dealershipPlacement.rotationQuarterTurns);
  const dealershipCenter = getTileCenterWorldPosition(
    dealershipItem,
    dealershipPlacement.cell?.[0] ?? 0,
    dealershipPlacement.cell?.[1] ?? 0,
    rotationQuarterTurns
  );
  const baseRotationY = signedRotationQuarterTurnsToRadians(rotationQuarterTurns);
  const idPrefix = dealershipPlacement.id || 'car_dealership';

  return CAR_DEALERSHIP_SHOWROOM_CARS.map((car) => {
    const localZ = CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_Z;
    const rotatedOffset = rotateFootprintOffset(car.localX, localZ, rotationQuarterTurns);
    const localRotationY = Math.atan2(
      car.doorTargetLocalX - car.localX,
      CAR_DEALERSHIP_DOOR_LOCAL_Z - localZ
    );
    const rotationY = quantizeRotation(baseRotationY + localRotationY);

    return {
      id: `${idPrefix}_showroom_${car.idSuffix}`,
      itemId: car.itemId,
      label: car.label,
      position: [
        quantizePosition(dealershipCenter.x + rotatedOffset.x),
        quantizePosition(dealershipCenter.z + rotatedOffset.z)
      ],
      rotationQuarterTurns: rotationRadiansToQuarterTurns(rotationY),
      rotationY,
      scale: CAR_DEALERSHIP_SHOWROOM_CAR_SCALE,
      localX: car.localX,
      localZ,
      localRotationY
    };
  });
}

export function ensureCarDealershipShowroomCars(layout = {}) {
  const showroomPlacements = getCarDealershipShowroomCarPlacements(layout);
  if (!showroomPlacements.length) {
    return { layout, changed: false, placements: [] };
  }

  const dealershipPlacement = getDealershipPlacement(layout);
  const dealershipItem = getBuilderItemById('car_dealership_building');
  const nextProps = (layout.props ?? []).map((prop) => ({ ...prop }));
  const usedIndexes = new Set();
  let changed = false;

  for (const placement of showroomPlacements) {
    const spec = CAR_DEALERSHIP_SHOWROOM_CARS.find((car) => car.itemId === placement.itemId);
    let existingIndex = nextProps.findIndex((prop, index) => (
      !usedIndexes.has(index)
      && prop.id === placement.id
    ));

    if (existingIndex < 0) {
      existingIndex = nextProps.findIndex((prop, index) => (
        !usedIndexes.has(index)
        && prop.itemId === placement.itemId
        && positionsMatch(prop.position, placement.position, 0.2)
      ));
    }

    if (existingIndex < 0 && spec) {
      existingIndex = nextProps.findIndex((prop, index) => (
        !usedIndexes.has(index)
        && isShowroomPlacementCandidate(prop, spec, dealershipPlacement, dealershipItem)
      ));
    }

    const existing = existingIndex >= 0 ? nextProps[existingIndex] : null;
    const nextPlacement = {
      ...(existing ?? {}),
      id: existing?.id ?? getUniquePlacementId({ ...layout, props: nextProps }, placement.id),
      itemId: placement.itemId,
      position: [...placement.position],
      rotationQuarterTurns: placement.rotationQuarterTurns,
      rotationY: placement.rotationY,
      scale: placement.scale
    };

    if (existingIndex >= 0) {
      usedIndexes.add(existingIndex);
      if (!propMatchesShowroomPlacement(existing, nextPlacement)) {
        nextProps[existingIndex] = nextPlacement;
        changed = true;
      }
      continue;
    }

    nextProps.push(nextPlacement);
    usedIndexes.add(nextProps.length - 1);
    changed = true;
  }

  if (!changed) {
    return { layout, changed: false, placements: showroomPlacements };
  }

  return {
    layout: {
      ...layout,
      props: nextProps
    },
    changed: true,
    placements: showroomPlacements
  };
}
