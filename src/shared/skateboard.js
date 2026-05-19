import {
  PLAYER_VEHICLE_SPEED_MULTIPLIER,
  getPlayerVehicleItemId,
  getPlayerVehicleMenuItem,
  isPlayerVehicleOwner
} from './carDealer.js';

export const SKATEBOARD_ITEM_ID = 'skateboard';
export const SKATEBOARD_SPEED_MULTIPLIER = 1.6;

export function normalizeSkateboardOwned(value = false) {
  return value === true;
}

export function isPlayerSkateboardOwner(player = null) {
  return Boolean(player)
    && !isPlayerVehicleOwner(player)
    && normalizeSkateboardOwned(player?.skateboardOwned);
}

export function isPlayerRideableTransportOwner(player = null) {
  return isPlayerVehicleOwner(player) || isPlayerSkateboardOwner(player);
}

export function getPlayerRideableTransportItemId(player = null) {
  const vehicleItemId = getPlayerVehicleItemId(player);
  return vehicleItemId || (isPlayerSkateboardOwner(player) ? SKATEBOARD_ITEM_ID : '');
}

export function getPlayerRideableTransportLabel(player = null) {
  const vehicle = getPlayerVehicleMenuItem(player);
  if (vehicle) {
    return vehicle.label;
  }

  return isPlayerSkateboardOwner(player) ? 'Skateboard' : '';
}

export function getPlayerRideableSpeedMultiplier(player = null) {
  if (isPlayerVehicleOwner(player)) {
    return PLAYER_VEHICLE_SPEED_MULTIPLIER;
  }

  return isPlayerSkateboardOwner(player) ? SKATEBOARD_SPEED_MULTIPLIER : 1;
}
