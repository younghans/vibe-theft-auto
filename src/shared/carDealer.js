export const CAR_DEALER_ITEM_IDS = Object.freeze({
  toyotaAe86: 'car_toyota_ae86',
  fiatDuna: 'car_fiat_duna'
});

export const CAR_VEHICLE_SPEED_MULTIPLIER = 2;

const VEHICLE_MODEL_GROUND_NODE_NAME_PARTS = Object.freeze({
  [CAR_DEALER_ITEM_IDS.fiatDuna]: Object.freeze(['tire', 'wheel'])
});

export const CAR_DEALER_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: CAR_DEALER_ITEM_IDS.toyotaAe86,
    label: 'Toyota AE86',
    price: 10000,
    accent: '#f2cf75',
    orderLine: 'Toyota AE86 keys are yours. It is on your HUD.'
  }),
  Object.freeze({
    id: CAR_DEALER_ITEM_IDS.fiatDuna,
    label: 'Fiat Duna',
    price: 5000,
    accent: '#d85b4d',
    orderLine: 'Fiat Duna keys are yours. It is on your HUD.'
  })
]);

const CAR_DEALER_MENU_ITEM_BY_ID = new Map();
for (const item of CAR_DEALER_MENU_ITEMS) {
  CAR_DEALER_MENU_ITEM_BY_ID.set(item.id, item);
}

export function normalizeCarDealerEnabled(value = false) {
  return value === true;
}

export function isCarDealerNpc(npc = null) {
  return normalizeCarDealerEnabled(npc?.carDealerEnabled);
}

export function getCarDealerPromptRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function listCarDealerMenuItems() {
  return CAR_DEALER_MENU_ITEMS;
}

export function normalizeCarDealerItemId(value = '') {
  const itemId = String(value ?? '').trim().toLowerCase();
  return CAR_DEALER_MENU_ITEM_BY_ID.has(itemId) ? itemId : '';
}

export function getCarDealerMenuItem(itemId = '') {
  return CAR_DEALER_MENU_ITEM_BY_ID.get(normalizeCarDealerItemId(itemId)) ?? null;
}

export function normalizePlayerVehicleItemId(value = '') {
  return normalizeCarDealerItemId(value);
}

export function getVehicleModelGroundNodeNameParts(itemId = '') {
  return VEHICLE_MODEL_GROUND_NODE_NAME_PARTS[normalizePlayerVehicleItemId(itemId)] ?? [];
}

export function normalizePlayerOwnedVehicleItemIds(value = '') {
  const source = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\s,|]+/u);
  const seen = new Set();
  const ids = [];

  for (const entry of source) {
    const itemId = normalizePlayerVehicleItemId(entry);
    if (!itemId || seen.has(itemId)) {
      continue;
    }

    seen.add(itemId);
    ids.push(itemId);
  }

  const orderedIds = [];
  for (const item of CAR_DEALER_MENU_ITEMS) {
    if (seen.has(item.id)) {
      orderedIds.push(item.id);
    }
  }
  return orderedIds;
}

export function serializePlayerOwnedVehicleItemIds(value = '') {
  return normalizePlayerOwnedVehicleItemIds(value).join(',');
}

export function getPlayerVehicleItemId(player = null) {
  return normalizePlayerVehicleItemId(player?.vehicleItemId);
}

export function getPlayerDefaultVehicleItemId(player = null) {
  return normalizePlayerOwnedVehicleItemIds(player?.ownedVehicleItemIds)[0] ?? '';
}

export function getPlayerVehicleMenuItem(player = null) {
  return getCarDealerMenuItem(getPlayerVehicleItemId(player));
}

export function getPlayerOwnedVehicleItemIds(player = null) {
  const ids = normalizePlayerOwnedVehicleItemIds(player?.ownedVehicleItemIds);
  const activeItemId = normalizePlayerVehicleItemId(player?.vehicleItemId);
  if (activeItemId) {
    ids.push(activeItemId);
  }

  return normalizePlayerOwnedVehicleItemIds(ids);
}

export function getPlayerOwnedVehicleMenuItems(player = null) {
  const items = [];
  for (const itemId of getPlayerOwnedVehicleItemIds(player)) {
    const item = getCarDealerMenuItem(itemId);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

export function playerOwnsVehicleItem(player = null, itemId = '') {
  const normalizedItemId = normalizePlayerVehicleItemId(itemId);
  if (!normalizedItemId) {
    return false;
  }
  for (const ownedItemId of getPlayerOwnedVehicleItemIds(player)) {
    if (ownedItemId === normalizedItemId) {
      return true;
    }
  }
  return false;
}

export function isPlayerVehicleOwner(player = null) {
  return Boolean(getPlayerVehicleItemId(player));
}

export function setPlayerVehicleItem(player = null, itemId = '') {
  const normalizedItemId = normalizePlayerVehicleItemId(itemId);
  if (!player || !normalizedItemId) {
    return '';
  }

  player.vehicleItemId = normalizedItemId;
  player.ownedVehicleItemIds = serializePlayerOwnedVehicleItemIds([
    ...getPlayerOwnedVehicleItemIds(player),
    normalizedItemId
  ]);
  return normalizedItemId;
}

export function selectPlayerVehicleItem(player = null, itemId = '') {
  const normalizedItemId = normalizePlayerVehicleItemId(itemId);
  if (!player || !normalizedItemId || !playerOwnsVehicleItem(player, normalizedItemId)) {
    return '';
  }

  player.vehicleItemId = normalizedItemId;
  player.ownedVehicleItemIds = serializePlayerOwnedVehicleItemIds(getPlayerOwnedVehicleItemIds(player));
  return normalizedItemId;
}

export function clearPlayerVehicleItem(player = null) {
  if (!player) {
    return;
  }

  player.vehicleItemId = '';
  player.ownedVehicleItemIds = '';
}

export function getPlayerVehicleInventorySnapshot(player = null) {
  const vehicleItemId = getPlayerVehicleItemId(player);
  const ownedVehicleItemIds = getPlayerOwnedVehicleItemIds(player);
  const ownedVehicles = [];
  for (const itemId of ownedVehicleItemIds) {
    const item = getCarDealerMenuItem(itemId);
    if (item) {
      ownedVehicles.push({
        id: item.id,
        label: item.label
      });
    }
  }

  return {
    skateboardOwned: player?.skateboardOwned === true,
    vehicleItemId,
    vehicleLabel: getCarDealerMenuItem(vehicleItemId)?.label ?? '',
    ownedVehicleItemIds: serializePlayerOwnedVehicleItemIds(ownedVehicleItemIds),
    ownedVehicles
  };
}
