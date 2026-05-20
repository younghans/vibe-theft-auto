function cloneOffsetValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

export function cloneInteriorDefinition(interior) {
  if (!interior) {
    return null;
  }

  return {
    ...interior,
    cutawayNodeNames: [...(interior.cutawayNodeNames ?? [])],
    cutawayFadeNodeNames: [...(interior.cutawayFadeNodeNames ?? [])],
    cutawayVisibleNodeNames: [...(interior.cutawayVisibleNodeNames ?? [])],
    exteriorDoorOffset: [...(interior.exteriorDoorOffset ?? [0, 0])],
    exteriorSpawnOffset: [...(interior.exteriorSpawnOffset ?? [0, 0])]
  };
}

export function clonePortalDefinition(portal) {
  if (!portal) {
    return null;
  }

  return {
    ...portal,
    triggerLocalOffset: cloneOffsetValue(portal.triggerLocalOffset),
    spawnLocalOffset: cloneOffsetValue(portal.spawnLocalOffset)
  };
}

export function cloneGarageDoorDefinition(garageDoor) {
  if (!garageDoor) {
    return null;
  }

  return {
    ...garageDoor,
    closedNodeNames: [...(garageDoor.closedNodeNames ?? [])],
    openNodeNames: [...(garageDoor.openNodeNames ?? [])]
  };
}

export function cloneInteractableDefinition(interactable) {
  if (!interactable) {
    return null;
  }

  return {
    ...interactable,
    localOffset: cloneOffsetValue(interactable.localOffset),
    approachLocalOffset: cloneOffsetValue(interactable.approachLocalOffset),
    interior: cloneInteriorDefinition(interactable.interior),
    portal: clonePortalDefinition(interactable.portal),
    garageDoor: cloneGarageDoorDefinition(interactable.garageDoor)
  };
}

export function resolvePlacementInteractableDefinition(placement, item) {
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

  if (baseInteractable?.portal || placement.interactable?.portal) {
    mergedInteractable.portal = {
      ...(baseInteractable?.portal ?? {}),
      ...(placement.interactable?.portal ?? {})
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
