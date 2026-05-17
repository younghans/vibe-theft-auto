export const SKATEBOARD_ITEM_ID = 'skateboard';
export const SKATEBOARD_SPEED_MULTIPLIER = 1.6;

export function normalizeSkateboardOwned(value = false) {
  return value === true;
}

export function isPlayerSkateboardOwner(player = null) {
  return normalizeSkateboardOwned(player?.skateboardOwned);
}
