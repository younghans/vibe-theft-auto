import { rotationQuarterTurnsToRadians } from '../shared/numberMath.js';
import {
  getDefaultPropPlacementScale,
  getPlacementScale,
  normalizePropPlacementScale
} from '../shared/placementScale.js';

const PROP_SNAP_SEARCH_SCALE = 1.15;
const PROP_SNAP_MIN_SEARCH_RADIUS = 1.5;
const PROP_SNAP_OCCUPIED_EPSILON = 0.08;

function getPropPlacementRotationY(placement = null) {
  const rotationY = Number(placement?.rotationY);
  return Number.isFinite(rotationY)
    ? rotationY
    : rotationQuarterTurnsToRadians(placement?.rotationQuarterTurns ?? 0);
}

function normalizeFootprintValue(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

export function getScaledPropFootprint(item, scale = undefined) {
  const normalizedScale = normalizePropPlacementScale(scale, getDefaultPropPlacementScale(item));
  const width = normalizeFootprintValue(item?.size?.[0]);
  const depth = normalizeFootprintValue(item?.size?.[1], width);
  return [width * normalizedScale, depth * normalizedScale];
}

export function getPropSnapSearchRadius(item, scale = undefined) {
  const [width, depth] = getScaledPropFootprint(item, scale);
  return Math.max(
    PROP_SNAP_MIN_SEARCH_RADIUS,
    Math.max(width, depth) * PROP_SNAP_SEARCH_SCALE
  );
}

function rotateLocalOffset(x, z, rotationY) {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: (x * cos) + (z * sin),
    z: (-x * sin) + (z * cos)
  };
}

export function getAdjacentPropSnapCandidates({
  activeItem,
  activeScale = undefined,
  activeRotationY = 0,
  anchorPlacement,
  anchorItem
} = {}) {
  if (
    !activeItem
    || activeItem.layer !== 'prop'
    || !anchorPlacement
    || anchorPlacement.layer !== 'prop'
    || !Array.isArray(anchorPlacement.position)
  ) {
    return [];
  }

  const itemForAnchor = anchorItem ?? activeItem;
  const [activeWidth, activeDepth] = getScaledPropFootprint(activeItem, activeScale);
  const [anchorWidth, anchorDepth] = getScaledPropFootprint(itemForAnchor, getPlacementScale(anchorPlacement));
  const activeHalfWidth = activeWidth * 0.5;
  const activeHalfDepth = activeDepth * 0.5;
  const anchorHalfWidth = anchorWidth * 0.5;
  const anchorHalfDepth = anchorDepth * 0.5;
  const anchorRotationY = getPropPlacementRotationY(anchorPlacement);
  const relativeRotationY = activeRotationY - anchorRotationY;
  const absCos = Math.abs(Math.cos(relativeRotationY));
  const absSin = Math.abs(Math.sin(relativeRotationY));
  const activeExtentAlongAnchorX = (activeHalfWidth * absCos) + (activeHalfDepth * absSin);
  const activeExtentAlongAnchorZ = (activeHalfWidth * absSin) + (activeHalfDepth * absCos);
  const anchorX = Number(anchorPlacement.position[0]);
  const anchorZ = Number(anchorPlacement.position[1]);

  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorZ)) {
    return [];
  }

  return [
    {
      side: 'right',
      offsetX: anchorHalfWidth + activeExtentAlongAnchorX,
      offsetZ: 0
    },
    {
      side: 'left',
      offsetX: -(anchorHalfWidth + activeExtentAlongAnchorX),
      offsetZ: 0
    },
    {
      side: 'front',
      offsetX: 0,
      offsetZ: anchorHalfDepth + activeExtentAlongAnchorZ
    },
    {
      side: 'back',
      offsetX: 0,
      offsetZ: -(anchorHalfDepth + activeExtentAlongAnchorZ)
    }
  ].map((candidate) => {
    const rotated = rotateLocalOffset(candidate.offsetX, candidate.offsetZ, anchorRotationY);
    return {
      x: anchorX + rotated.x,
      z: anchorZ + rotated.z,
      side: candidate.side,
      anchorPlacementId: anchorPlacement.id
    };
  });
}

function isCandidateOccupied(candidate, placements, activeItemId, ignorePlacementId = null) {
  for (const placement of placements) {
    if (
      !placement
      || placement.id === ignorePlacementId
      || placement.layer !== 'prop'
      || placement.itemId !== activeItemId
      || !Array.isArray(placement.position)
    ) {
      continue;
    }

    const dx = Number(placement.position[0]) - candidate.x;
    const dz = Number(placement.position[1]) - candidate.z;
    if (Number.isFinite(dx) && Number.isFinite(dz) && Math.hypot(dx, dz) <= PROP_SNAP_OCCUPIED_EPSILON) {
      return true;
    }
  }
  return false;
}

export function findNearestAdjacentPropSnapPoint({
  point,
  placements = [],
  activeItem,
  activeScale = undefined,
  activeRotationY = 0,
  ignorePlacementId = null,
  getItemById = () => null,
  maxDistance = undefined
} = {}) {
  if (!point || !activeItem || activeItem.layer !== 'prop') {
    return null;
  }

  const pointX = Number(point.x);
  const pointZ = Number(point.z);
  if (!Number.isFinite(pointX) || !Number.isFinite(pointZ)) {
    return null;
  }

  const placementList = Array.from(placements ?? []);
  const searchRadius = Number.isFinite(Number(maxDistance))
    ? Number(maxDistance)
    : getPropSnapSearchRadius(activeItem, activeScale);
  let best = null;
  let bestDistanceSq = searchRadius * searchRadius;

  for (const placement of placementList) {
    if (
      !placement
      || placement.id === ignorePlacementId
      || placement.layer !== 'prop'
      || placement.itemId !== activeItem.id
      || !Array.isArray(placement.position)
    ) {
      continue;
    }

    const anchorItem = getItemById(placement.itemId) ?? activeItem;
    const candidates = getAdjacentPropSnapCandidates({
      activeItem,
      activeScale,
      activeRotationY,
      anchorPlacement: placement,
      anchorItem
    });

    for (const candidate of candidates) {
      if (isCandidateOccupied(candidate, placementList, activeItem.id, ignorePlacementId)) {
        continue;
      }

      const dx = candidate.x - pointX;
      const dz = candidate.z - pointZ;
      const distanceSq = (dx * dx) + (dz * dz);
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        best = {
          ...candidate,
          distance: Math.sqrt(distanceSq)
        };
      }
    }
  }

  return best;
}
