export const CAR_DEALER_ITEM_IDS = Object.freeze({
  toyotaAe86: 'car_toyota_ae86',
  fiatDuna: 'car_fiat_duna'
});

export const DEFAULT_PLAYER_VEHICLE_ITEM_ID = CAR_DEALER_ITEM_IDS.fiatDuna;
export const PLAYER_VEHICLE_SCALE = 0.75;
export const PLAYER_VEHICLE_SPEED_MULTIPLIER = 2;

export const CAR_DEALER_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: CAR_DEALER_ITEM_IDS.toyotaAe86,
    label: 'Toyota AE86',
    price: 10000,
    accent: '#f2cf75',
    orderLine: 'Toyota AE86 keys are yours. Hold Shift to drive.'
  }),
  Object.freeze({
    id: CAR_DEALER_ITEM_IDS.fiatDuna,
    label: 'Fiat Duna',
    price: 5000,
    accent: '#d85b4d',
    orderLine: 'Fiat Duna keys are yours. Hold Shift to drive.'
  })
]);

const CAR_DEALER_MENU_ITEM_BY_ID = new Map(
  CAR_DEALER_MENU_ITEMS.map((item) => [item.id, item])
);

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

  return CAR_DEALER_MENU_ITEMS
    .map((item) => item.id)
    .filter((itemId) => seen.has(itemId));
}

export function serializePlayerOwnedVehicleItemIds(value = '') {
  return normalizePlayerOwnedVehicleItemIds(value).join(',');
}

export function getPlayerVehicleItemId(player = null) {
  const itemId = normalizePlayerVehicleItemId(player?.vehicleItemId);
  if (itemId) {
    return itemId;
  }

  const ownedItemId = normalizePlayerOwnedVehicleItemIds(player?.ownedVehicleItemIds)[0] ?? '';
  if (ownedItemId) {
    return ownedItemId;
  }

  return player?.skateboardOwned === true ? DEFAULT_PLAYER_VEHICLE_ITEM_ID : '';
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

  if (ids.length === 0 && player?.skateboardOwned === true) {
    ids.push(DEFAULT_PLAYER_VEHICLE_ITEM_ID);
  }

  return normalizePlayerOwnedVehicleItemIds(ids);
}

export function getPlayerOwnedVehicleMenuItems(player = null) {
  return getPlayerOwnedVehicleItemIds(player)
    .map((itemId) => getCarDealerMenuItem(itemId))
    .filter(Boolean);
}

export function playerOwnsVehicleItem(player = null, itemId = '') {
  const normalizedItemId = normalizePlayerVehicleItemId(itemId);
  return Boolean(normalizedItemId && getPlayerOwnedVehicleItemIds(player).includes(normalizedItemId));
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
  player.skateboardOwned = true;
  return normalizedItemId;
}

export function selectPlayerVehicleItem(player = null, itemId = '') {
  const normalizedItemId = normalizePlayerVehicleItemId(itemId);
  if (!player || !normalizedItemId || !playerOwnsVehicleItem(player, normalizedItemId)) {
    return '';
  }

  player.vehicleItemId = normalizedItemId;
  player.ownedVehicleItemIds = serializePlayerOwnedVehicleItemIds(getPlayerOwnedVehicleItemIds(player));
  player.skateboardOwned = true;
  return normalizedItemId;
}

export function clearPlayerVehicleItem(player = null) {
  if (!player) {
    return;
  }

  player.vehicleItemId = '';
  player.ownedVehicleItemIds = '';
  player.skateboardOwned = false;
}

export function getPlayerVehicleInventorySnapshot(player = null) {
  const vehicleItemId = getPlayerVehicleItemId(player);
  const ownedVehicleItemIds = getPlayerOwnedVehicleItemIds(player);
  return {
    skateboardOwned: Boolean(vehicleItemId),
    vehicleItemId,
    vehicleLabel: getCarDealerMenuItem(vehicleItemId)?.label ?? '',
    ownedVehicleItemIds: serializePlayerOwnedVehicleItemIds(ownedVehicleItemIds),
    ownedVehicles: ownedVehicleItemIds
      .map((itemId) => getCarDealerMenuItem(itemId))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        label: item.label
      }))
  };
}
