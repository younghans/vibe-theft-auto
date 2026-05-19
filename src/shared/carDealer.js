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
    orderLine: 'Toyota AE86 keys are yours. Hold Shift to drive.'
  }),
  Object.freeze({
    id: CAR_DEALER_ITEM_IDS.fiatDuna,
    label: 'Fiat Duna',
    price: 5000,
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

export function getPlayerVehicleItemId(player = null) {
  return normalizePlayerVehicleItemId(player?.vehicleItemId);
}

export function getPlayerVehicleMenuItem(player = null) {
  return getCarDealerMenuItem(getPlayerVehicleItemId(player));
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
  player.skateboardOwned = true;
  return normalizedItemId;
}

export function clearPlayerVehicleItem(player = null) {
  if (!player) {
    return;
  }

  player.vehicleItemId = '';
  player.skateboardOwned = true;
}

export function getPlayerVehicleInventorySnapshot(player = null) {
  const vehicleItemId = getPlayerVehicleItemId(player);
  const skateboardOwned = Boolean(player && player.skateboardOwned !== false);
  return {
    skateboardOwned,
    vehicleItemId,
    vehicleLabel: getCarDealerMenuItem(vehicleItemId)?.label ?? (skateboardOwned ? 'Skateboard' : '')
  };
}
