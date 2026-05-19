import {
  PLAYER_VEHICLE_SPEED_MULTIPLIER,
  isPlayerVehicleOwner
} from './carDealer.js';

export const SKATEBOARD_ITEM_ID = 'skateboard';
export const SKATEBOARD_SPEED_MULTIPLIER = PLAYER_VEHICLE_SPEED_MULTIPLIER;

export function normalizeSkateboardOwned(value = false) {
  return value === true;
}

export function isPlayerSkateboardOwner(player = null) {
  return isPlayerVehicleOwner(player) || normalizeSkateboardOwned(player?.skateboardOwned);
}
