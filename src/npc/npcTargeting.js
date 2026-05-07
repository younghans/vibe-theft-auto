import {
  getTileCenterWorldPosition,
  getTileOccupiedCells,
  rotateFootprintOffset as rotateLocalOffset
} from '../shared/tileFootprint.js';
import {
  quantizePosition,
  quantizeRotation,
  rotationQuarterTurnsToRadians as toRotationY
} from '../shared/numberMath.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from '../world/builderCatalog.js';
import { resolvePlacementInteractableDefinition } from '../world/interactableMetadata.js';
import { NPC_STEP_TYPES } from './npcBehavior.js';

export function isBuildingPlacement(placement, item = getBuilderItemById(placement?.itemId)) {
  return Boolean(
    placement
    && item
    && placement.layer === 'tile'
    && item.groupId === 'lots'
    && item.underlayTileId
  );
}

export function isNpcTargetablePlacement(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!placement || !item || placement.layer === 'npc') {
    return false;
  }

  if (resolvePlacementInteractableDefinition(placement, item)?.portal) {
    return false;
  }

  if (isBuildingPlacement(placement, item)) {
    return true;
  }

  return placement.layer === 'prop';
}

export function getPlacementWorldOrigin(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!placement || !item) {
    return null;
  }

  if (placement.layer === 'tile') {
    const center = getTileCenterWorldPosition(
      item,
      placement.cellX ?? 0,
      placement.cellZ ?? 0,
      placement.rotationQuarterTurns ?? 0
    );
    return { x: center.x, z: center.z };
  }

  return {
    x: placement.position?.[0] ?? 0,
    z: placement.position?.[1] ?? 0
  };
}

export function getPlacementWorldPoint(placement, offset = [0, 0], item = getBuilderItemById(placement?.itemId)) {
  const origin = getPlacementWorldOrigin(placement, item);
  if (!origin) {
    return null;
  }

  const rotated = rotateLocalOffset(
    Number(offset?.[0] ?? 0),
    Number(offset?.[1] ?? 0),
    placement.rotationQuarterTurns ?? 0
  );

  return {
    x: quantizePosition(origin.x + rotated.x),
    z: quantizePosition(origin.z + rotated.z)
  };
}

export function getPlacementApproachPoint(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!placement || !item) {
    return null;
  }

  const interactable = resolvePlacementInteractableDefinition(placement, item);
  if (Array.isArray(interactable?.approachLocalOffset) && interactable.approachLocalOffset.length >= 2) {
    return getPlacementWorldPoint(placement, interactable.approachLocalOffset, item);
  }

  if (Array.isArray(interactable?.localOffset) && interactable.localOffset.length >= 2) {
    return getPlacementWorldPoint(placement, interactable.localOffset, item);
  }

  if (Array.isArray(item?.npcRouteDoorOffset) && item.npcRouteDoorOffset.length >= 2) {
    return getPlacementWorldPoint(placement, item.npcRouteDoorOffset, item);
  }

  if (isBuildingPlacement(placement, item)) {
    return getPlacementWorldPoint(placement, [0, BUILDER_TILE_SIZE * 0.42], item);
  }

  return getPlacementWorldOrigin(placement, item);
}

function placementContainsWorldPoint(placement, item, point) {
  if (!placement || !item || !point || placement.layer !== 'tile') {
    return false;
  }

  const halfTile = BUILDER_TILE_SIZE * 0.5;
  const occupiedCells = getTileOccupiedCells(
    item,
    placement.cellX ?? 0,
    placement.cellZ ?? 0,
    placement.rotationQuarterTurns ?? 0
  );

  return occupiedCells.some((cell) => (
    point.x >= ((cell.x * BUILDER_TILE_SIZE) - halfTile)
    && point.x <= ((cell.x * BUILDER_TILE_SIZE) + halfTile)
    && point.z >= ((cell.z * BUILDER_TILE_SIZE) - halfTile)
    && point.z <= ((cell.z * BUILDER_TILE_SIZE) + halfTile)
  ));
}

function findContainingBuildingPlacement(worldState, placement, originPosition) {
  if (!worldState?.getPlacements || placement?.layer !== 'prop' || !originPosition) {
    return null;
  }

  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of worldState.getPlacements()) {
    if (!candidate || candidate.id === placement.id) {
      continue;
    }

    const candidateItem = getBuilderItemById(candidate.itemId);
    if (!isBuildingPlacement(candidate, candidateItem) || !placementContainsWorldPoint(candidate, candidateItem, originPosition)) {
      continue;
    }

    const candidateOrigin = getPlacementWorldOrigin(candidate, candidateItem);
    const distance = candidateOrigin
      ? Math.hypot(candidateOrigin.x - originPosition.x, candidateOrigin.z - originPosition.z)
      : 0;
    if (distance >= bestDistance) {
      continue;
    }

    bestMatch = {
      placement: candidate,
      item: candidateItem
    };
    bestDistance = distance;
  }

  return bestMatch;
}

export function resolveNpcTargetOption(
  placement,
  item = getBuilderItemById(placement?.itemId),
  worldState = null
) {
  if (!isNpcTargetablePlacement(placement, item)) {
    return null;
  }

  const origin = getPlacementWorldOrigin(placement, item);
  const approachPosition = getPlacementApproachPoint(placement, item) ?? origin;
  const interactable = resolvePlacementInteractableDefinition(placement, item);
  const container = findContainingBuildingPlacement(worldState, placement, origin);
  const supportedStepTypes = [
    NPC_STEP_TYPES.travelToPlacement,
    NPC_STEP_TYPES.loiterNearPlacement,
    NPC_STEP_TYPES.wanderNearPlacement
  ];

  if (isBuildingPlacement(placement, item)) {
    supportedStepTypes.push(NPC_STEP_TYPES.enterHideAtPlacement);
  }

  if (interactable?.workoutType || interactable?.actionText || interactable?.prompt) {
    supportedStepTypes.push(NPC_STEP_TYPES.usePlacement);
  }

  return {
    placementId: placement.id,
    itemId: placement.itemId,
    containerPlacementId: container?.placement?.id ?? '',
    label: placement.interactable?.label ?? interactable?.label ?? item.label,
    layer: placement.layer,
    groupLabel: item.groupLabel ?? '',
    supportedStepTypes,
    hideCapable: supportedStepTypes.includes(NPC_STEP_TYPES.enterHideAtPlacement),
    loiterCapable: true,
    activityCapable: supportedStepTypes.includes(NPC_STEP_TYPES.usePlacement),
    workoutType: interactable?.workoutType ?? '',
    approachRotationY: Number.isFinite(interactable?.approachRotationY)
      ? quantizeRotation(toRotationY(placement.rotationQuarterTurns ?? 0) + interactable.approachRotationY)
      : undefined,
    approachPosition,
    originPosition: origin,
    routeViaPlacementId: container?.placement?.id ?? '',
    distance: interactable?.distance ?? BUILDER_TILE_SIZE * 0.44
  };
}

export function collectNpcTargetOptions(worldState) {
  if (!worldState?.getPlacements) {
    return [];
  }

  return worldState.getPlacements()
    .map((placement) => resolveNpcTargetOption(placement, undefined, worldState))
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}
