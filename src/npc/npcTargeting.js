import { getTileCenterWorldPosition } from '../shared/tileFootprint.js';
import { BUILDER_TILE_SIZE, getBuilderItemById } from '../world/builderCatalog.js';
import { NPC_STEP_TYPES } from './npcBehavior.js';

function rotateLocalOffset(x, z, rotationQuarterTurns = 0) {
  switch (((rotationQuarterTurns % 4) + 4) % 4) {
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

function cloneInteriorDefinition(interior) {
  if (!interior) {
    return null;
  }

  return {
    ...interior,
    cutawayNodeNames: [...(interior.cutawayNodeNames ?? [])],
    exteriorDoorOffset: [...(interior.exteriorDoorOffset ?? [0, 0])],
    exteriorSpawnOffset: [...(interior.exteriorSpawnOffset ?? [0, 0])]
  };
}

function cloneInteractableDefinition(interactable) {
  if (!interactable) {
    return null;
  }

  return {
    ...interactable,
    localOffset: Array.isArray(interactable.localOffset) ? [...interactable.localOffset] : undefined,
    approachLocalOffset: Array.isArray(interactable.approachLocalOffset) ? [...interactable.approachLocalOffset] : undefined,
    interior: cloneInteriorDefinition(interactable.interior)
  };
}

function resolvePlacementInteractable(placement, item) {
  const baseInteractable = item?.interior
    ? {
        label: item.interior.label ?? item.label,
        prompt: item.interior.prompt ?? `Enter ${item.interior.label ?? item.label}`,
        actionText: item.interior.actionText ?? `Enter ${item.interior.label ?? item.label}.`,
        radius: item.interior.exteriorInteractRadius ?? 4.4,
        localOffset: [...(item.interior.exteriorDoorOffset ?? [0, 0])],
        interior: cloneInteriorDefinition(item.interior)
      }
    : item?.interactable
      ? cloneInteractableDefinition(item.interactable)
      : null;

  if (!placement?.interactable) {
    return baseInteractable;
  }

  const mergedInteractable = {
    ...(baseInteractable ?? {}),
    ...placement.interactable
  };

  if (baseInteractable?.interior || placement.interactable?.interior) {
    mergedInteractable.interior = {
      ...(baseInteractable?.interior ?? {}),
      ...(placement.interactable?.interior ?? {})
    };
  }

  if (Array.isArray(placement.interactable?.localOffset)) {
    mergedInteractable.localOffset = [...placement.interactable.localOffset];
  } else if (Array.isArray(baseInteractable?.localOffset)) {
    mergedInteractable.localOffset = [...baseInteractable.localOffset];
  }

  if (Array.isArray(placement.interactable?.approachLocalOffset)) {
    mergedInteractable.approachLocalOffset = [...placement.interactable.approachLocalOffset];
  } else if (Array.isArray(baseInteractable?.approachLocalOffset)) {
    mergedInteractable.approachLocalOffset = [...baseInteractable.approachLocalOffset];
  }

  return mergedInteractable;
}

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
    x: Number((origin.x + rotated.x).toFixed(2)),
    z: Number((origin.z + rotated.z).toFixed(2))
  };
}

export function getPlacementApproachPoint(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!placement || !item) {
    return null;
  }

  const interactable = resolvePlacementInteractable(placement, item);
  if (Array.isArray(interactable?.approachLocalOffset) && interactable.approachLocalOffset.length >= 2) {
    return getPlacementWorldPoint(placement, interactable.approachLocalOffset, item);
  }

  if (Array.isArray(interactable?.localOffset) && interactable.localOffset.length >= 2) {
    return getPlacementWorldPoint(placement, interactable.localOffset, item);
  }

  if (isBuildingPlacement(placement, item)) {
    return getPlacementWorldPoint(placement, [0, BUILDER_TILE_SIZE * 0.42], item);
  }

  return getPlacementWorldOrigin(placement, item);
}

export function resolveNpcTargetOption(placement, item = getBuilderItemById(placement?.itemId)) {
  if (!isNpcTargetablePlacement(placement, item)) {
    return null;
  }

  const origin = getPlacementWorldOrigin(placement, item);
  const approachPosition = getPlacementApproachPoint(placement, item) ?? origin;
  const interactable = resolvePlacementInteractable(placement, item);
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
    label: placement.interactable?.label ?? interactable?.label ?? item.label,
    layer: placement.layer,
    groupLabel: item.groupLabel ?? '',
    supportedStepTypes,
    hideCapable: supportedStepTypes.includes(NPC_STEP_TYPES.enterHideAtPlacement),
    loiterCapable: true,
    activityCapable: supportedStepTypes.includes(NPC_STEP_TYPES.usePlacement),
    workoutType: interactable?.workoutType ?? '',
    approachPosition,
    originPosition: origin,
    distance: interactable?.distance ?? BUILDER_TILE_SIZE * 0.44
  };
}

export function collectNpcTargetOptions(worldState) {
  if (!worldState?.getPlacements) {
    return [];
  }

  return worldState.getPlacements()
    .map((placement) => resolveNpcTargetOption(placement))
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}
