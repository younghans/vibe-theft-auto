export const BARTENDER_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: 'beer',
    label: 'Beer',
    price: 20,
    orderLine: 'Beer served. Twenty bucks.',
    inventoryField: 'beerCount',
    dose: 1
  }),
  Object.freeze({
    id: 'shot',
    label: 'Shot',
    price: 50,
    orderLine: 'Shot poured. Fifty bucks.',
    inventoryField: 'shotCount',
    dose: 2
  })
]);

export const DRINK_ITEM_IDS = Object.freeze({
  beer: 'beer',
  shot: 'shot'
});

export const DRUNKNESS_MAX_LEVEL = 5;
export const DRUNKNESS_MIN_ANIMATION_LEVEL = 3;
export const DRUNKNESS_MAX_DOSE = 20;
export const DRUNKNESS_LEVEL_DURATION_MS = 30000;
export const DRUNKNESS_MAX_DURATION_MS = DRUNKNESS_MAX_LEVEL * DRUNKNESS_LEVEL_DURATION_MS;
export const DRUNKNESS_DOSE_THRESHOLDS = Object.freeze([1, 5, 10, 15, DRUNKNESS_MAX_DOSE]);
export const DRUNKNESS_LEVEL_LABELS = Object.freeze(['sober', 'buzzed', 'tipsy', 'drunk', 'wasted', 'plastered']);

const BARTENDER_MENU_ITEM_BY_ID = new Map(
  BARTENDER_MENU_ITEMS.map((item) => [item.id, item])
);

const DRINK_INVENTORY_FIELDS = Object.freeze(
  Object.fromEntries(BARTENDER_MENU_ITEMS.map((item) => [item.id, item.inventoryField]))
);

const DRINK_DOSES = Object.freeze(
  Object.fromEntries(BARTENDER_MENU_ITEMS.map((item) => [item.id, item.dose]))
);

export function normalizeBartenderEnabled(value = false) {
  return value === true;
}

export function isBartenderNpc(npc = null) {
  return normalizeBartenderEnabled(npc?.bartenderEnabled);
}

export function getBartenderPromptRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function listBartenderMenuItems() {
  return BARTENDER_MENU_ITEMS;
}

export function normalizeBartenderMenuItemId(value = '') {
  const itemId = String(value ?? '').trim().toLowerCase();
  return BARTENDER_MENU_ITEM_BY_ID.has(itemId) ? itemId : '';
}

export function getBartenderMenuItem(itemId = '') {
  return BARTENDER_MENU_ITEM_BY_ID.get(normalizeBartenderMenuItemId(itemId)) ?? null;
}

export function listDrinkInventoryItems() {
  return BARTENDER_MENU_ITEMS;
}

export function getDrinkInventoryField(itemId = '') {
  return DRINK_INVENTORY_FIELDS[normalizeBartenderMenuItemId(itemId)] ?? '';
}

export function getDrinkDose(itemId = '') {
  return Math.max(0, Math.floor(Number(DRINK_DOSES[normalizeBartenderMenuItemId(itemId)]) || 0));
}

export function normalizeDrinkInventoryCount(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(999, Math.floor(numeric)));
}

export function normalizeDrunknessDose(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(DRUNKNESS_MAX_DOSE, Math.floor(numeric)));
}

export function normalizeDrunknessLevel(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(DRUNKNESS_MAX_LEVEL, Math.floor(numeric)));
}

export function getDrunknessLevelLabel(level = 0) {
  return DRUNKNESS_LEVEL_LABELS[normalizeDrunknessLevel(level)] ?? DRUNKNESS_LEVEL_LABELS[0];
}

export function getDrunknessLevelForDose(dose = 0) {
  const normalizedDose = normalizeDrunknessDose(dose);
  if (normalizedDose <= 0) {
    return 0;
  }

  const thresholdIndex = DRUNKNESS_DOSE_THRESHOLDS.findIndex((threshold) => normalizedDose < threshold);
  return thresholdIndex < 0
    ? DRUNKNESS_MAX_LEVEL
    : normalizeDrunknessLevel(thresholdIndex);
}

export function getDrunknessDurationMs(level = 0) {
  return normalizeDrunknessLevel(level) * DRUNKNESS_LEVEL_DURATION_MS;
}

export function getDrunknessDoseForLevel(level = 0) {
  const normalizedLevel = normalizeDrunknessLevel(level);
  return normalizedLevel > 0
    ? DRUNKNESS_DOSE_THRESHOLDS[normalizedLevel - 1] ?? DRUNKNESS_MAX_DOSE
    : 0;
}

export function getDrunknessLevelForTimeRemaining(endsAt = 0, now = Date.now()) {
  const normalizedEndsAt = Math.max(0, Math.floor(Number(endsAt) || 0));
  const normalizedNow = Math.max(0, Math.floor(Number(now) || 0));
  const remainingMs = Math.max(0, normalizedEndsAt - normalizedNow);
  if (remainingMs <= 0) {
    return 0;
  }

  return normalizeDrunknessLevel(Math.ceil(remainingMs / DRUNKNESS_LEVEL_DURATION_MS));
}

export function getPlayerDrinkCount(player = null, itemId = '') {
  const field = getDrinkInventoryField(itemId);
  return field ? normalizeDrinkInventoryCount(player?.[field]) : 0;
}

export function getPlayerDrinkInventorySnapshot(player = null) {
  return {
    beerCount: getPlayerDrinkCount(player, DRINK_ITEM_IDS.beer),
    shotCount: getPlayerDrinkCount(player, DRINK_ITEM_IDS.shot)
  };
}

export function getPlayerDrunknessSnapshot(player = null) {
  return {
    drunknessDose: normalizeDrunknessDose(player?.drunknessDose),
    drunknessLevel: normalizeDrunknessLevel(player?.drunknessLevel),
    drunknessEndsAt: Math.max(0, Math.floor(Number(player?.drunknessEndsAt) || 0))
  };
}

export function setPlayerDrinkCount(player = null, itemId = '', count = 0) {
  const field = getDrinkInventoryField(itemId);
  if (!player || !field) {
    return 0;
  }

  const nextCount = normalizeDrinkInventoryCount(count);
  player[field] = nextCount;
  return nextCount;
}

export function addPlayerDrink(player = null, itemId = '', quantity = 1) {
  const field = getDrinkInventoryField(itemId);
  if (!player || !field) {
    return 0;
  }

  const nextCount = normalizeDrinkInventoryCount(
    normalizeDrinkInventoryCount(player[field]) + Math.max(1, Math.floor(Number(quantity) || 1))
  );
  player[field] = nextCount;
  return nextCount;
}

export function clearPlayerDrunkness(player = null) {
  if (!player) {
    return false;
  }

  const wasDrunk = normalizeDrunknessLevel(player.drunknessLevel) > 0
    || normalizeDrunknessDose(player.drunknessDose) > 0
    || Math.max(0, Math.floor(Number(player.drunknessEndsAt) || 0)) > 0;
  player.drunknessDose = 0;
  player.drunknessLevel = 0;
  player.drunknessEndsAt = 0;
  return wasDrunk;
}

export function refreshPlayerDrunkness(player = null, now = Date.now()) {
  if (!player) {
    return false;
  }

  const level = normalizeDrunknessLevel(player.drunknessLevel);
  const endsAt = Math.max(0, Math.floor(Number(player.drunknessEndsAt) || 0));
  const dose = normalizeDrunknessDose(player.drunknessDose);
  if ((level <= 0 && endsAt <= 0) || endsAt <= 0 || dose <= 0) {
    return clearPlayerDrunkness(player);
  }

  const timeLevel = getDrunknessLevelForTimeRemaining(endsAt, now);
  if (timeLevel <= 0) {
    return clearPlayerDrunkness(player);
  }

  const doseLevel = getDrunknessLevelForDose(dose);
  const nextLevel = Math.min(timeLevel, doseLevel || timeLevel);
  const nextDose = timeLevel < level
    ? Math.min(dose, getDrunknessDoseForLevel(nextLevel))
    : dose;
  const changed = player.drunknessDose !== nextDose
    || player.drunknessLevel !== nextLevel
    || player.drunknessEndsAt !== endsAt;
  player.drunknessDose = nextDose;
  player.drunknessLevel = nextLevel;
  player.drunknessEndsAt = endsAt;
  return changed;
}

export function consumePlayerDrink(player = null, itemId = '', now = Date.now()) {
  const item = getBartenderMenuItem(itemId);
  if (!player || !item) {
    return { ok: false, error: 'That drink is not in your inventory.' };
  }

  const currentCount = getPlayerDrinkCount(player, item.id);
  if (currentCount <= 0) {
    return { ok: false, error: `You do not have any ${item.label.toLowerCase()} left.` };
  }

  refreshPlayerDrunkness(player, now);
  setPlayerDrinkCount(player, item.id, currentCount - 1);
  const nextDose = normalizeDrunknessDose(normalizeDrunknessDose(player.drunknessDose) + getDrinkDose(item.id));
  const nextLevel = getDrunknessLevelForDose(nextDose);
  player.drunknessDose = nextDose;
  player.drunknessLevel = nextLevel;
  player.drunknessEndsAt = nextLevel > 0 ? now + getDrunknessDurationMs(nextLevel) : 0;

  return {
    ok: true,
    item: {
      id: item.id,
      label: item.label
    },
    inventory: getPlayerDrinkInventorySnapshot(player),
    drunkness: getPlayerDrunknessSnapshot(player)
  };
}
