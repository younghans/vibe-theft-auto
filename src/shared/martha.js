import { PLAYER_MAX_HEALTH } from './combatConstants.js';

export const MARTHA_ITEM_IDS = Object.freeze({
  burger: 'burger',
  glizzy: 'glizzy',
  soda: 'soda'
});

export const MARTHA_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: MARTHA_ITEM_IDS.burger,
    label: 'Burger',
    price: 20,
    orderLine: 'Burger hot off the grill. Twenty bucks, sugar.',
    consumeLine: 'Ate a burger.',
    inventoryField: 'burgerCount',
    restorePercent: 35,
    kind: 'consumable'
  }),
  Object.freeze({
    id: MARTHA_ITEM_IDS.glizzy,
    label: 'Glizzy',
    price: 10,
    orderLine: 'Glizzy served. Ten bucks.',
    consumeLine: 'Ate a glizzy.',
    inventoryField: 'glizzyCount',
    restorePercent: 25,
    kind: 'consumable'
  }),
  Object.freeze({
    id: MARTHA_ITEM_IDS.soda,
    label: 'Soda',
    price: 10,
    orderLine: 'Soda poured. Ten bucks.',
    consumeLine: 'Drank a soda.',
    inventoryField: 'sodaCount',
    restorePercent: 20,
    kind: 'consumable'
  })
]);

const MARTHA_MENU_ITEM_BY_ID = new Map();
const MARTHA_INVENTORY_FIELD_ENTRIES = {};
for (const item of MARTHA_MENU_ITEMS) {
  MARTHA_MENU_ITEM_BY_ID.set(item.id, item);
  MARTHA_INVENTORY_FIELD_ENTRIES[item.id] = item.inventoryField;
}

const MARTHA_INVENTORY_FIELDS = Object.freeze(MARTHA_INVENTORY_FIELD_ENTRIES);

export function normalizeMarthaEnabled(value = false) {
  return value === true;
}

export function isMarthaNpc(npc = null) {
  return normalizeMarthaEnabled(npc?.marthaEnabled);
}

export function getMarthaPromptRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function listMarthaMenuItems() {
  return MARTHA_MENU_ITEMS;
}

export function normalizeMarthaMenuItemId(value = '') {
  const itemId = String(value ?? '').trim().toLowerCase();
  return MARTHA_MENU_ITEM_BY_ID.has(itemId) ? itemId : '';
}

export function getMarthaMenuItem(itemId = '') {
  return MARTHA_MENU_ITEM_BY_ID.get(normalizeMarthaMenuItemId(itemId)) ?? null;
}

export function getMarthaInventoryField(itemId = '') {
  return MARTHA_INVENTORY_FIELDS[normalizeMarthaMenuItemId(itemId)] ?? '';
}

export function normalizeMarthaInventoryCount(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(999, Math.floor(numeric)));
}

export function getPlayerMarthaItemCount(player = null, itemId = '') {
  const field = getMarthaInventoryField(itemId);
  return field ? normalizeMarthaInventoryCount(player?.[field]) : 0;
}

export function getPlayerMarthaInventorySnapshot(player = null) {
  return {
    burgerCount: getPlayerMarthaItemCount(player, MARTHA_ITEM_IDS.burger),
    glizzyCount: getPlayerMarthaItemCount(player, MARTHA_ITEM_IDS.glizzy),
    sodaCount: getPlayerMarthaItemCount(player, MARTHA_ITEM_IDS.soda)
  };
}

export function setPlayerMarthaItemCount(player = null, itemId = '', count = 0) {
  const field = getMarthaInventoryField(itemId);
  if (!player || !field) {
    return 0;
  }

  const nextCount = normalizeMarthaInventoryCount(count);
  player[field] = nextCount;
  return nextCount;
}

export function addPlayerMarthaItem(player = null, itemId = '', quantity = 1) {
  const field = getMarthaInventoryField(itemId);
  if (!player || !field) {
    return 0;
  }

  const nextCount = normalizeMarthaInventoryCount(
    normalizeMarthaInventoryCount(player[field]) + Math.max(1, Math.floor(Number(quantity) || 1))
  );
  player[field] = nextCount;
  return nextCount;
}

function getPlayerFoodHealth(player = null) {
  const maxHealth = Math.max(1, Math.floor(Number(player?.maxHealth ?? PLAYER_MAX_HEALTH) || PLAYER_MAX_HEALTH));
  const health = Math.max(0, Math.min(maxHealth, Math.floor(Number(player?.health ?? maxHealth) || 0)));
  return { health, maxHealth };
}

export function consumePlayerMarthaItem(player = null, itemId = '') {
  const item = getMarthaMenuItem(itemId);
  if (!player || !item || item.kind !== 'consumable') {
    return { ok: false, error: 'That item is not in your inventory.' };
  }

  const currentCount = getPlayerMarthaItemCount(player, item.id);
  if (currentCount <= 0) {
    return { ok: false, error: `You do not have any ${item.label.toLowerCase()} left.` };
  }

  const { health, maxHealth } = getPlayerFoodHealth(player);
  if (health >= maxHealth) {
    return { ok: false, error: 'You are already at full health.' };
  }

  const healed = Math.max(1, Math.ceil(maxHealth * (item.restorePercent / 100)));
  const nextHealth = Math.min(maxHealth, health + healed);
  setPlayerMarthaItemCount(player, item.id, currentCount - 1);
  player.health = nextHealth;

  return {
    ok: true,
    item: {
      id: item.id,
      label: item.label
    },
    inventory: getPlayerMarthaInventorySnapshot(player),
    health: {
      health: nextHealth,
      maxHealth,
      healed: nextHealth - health,
      restorePercent: item.restorePercent
    },
    message: item.consumeLine
  };
}
