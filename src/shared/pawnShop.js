import {
  WEAPON_CLIP_SIZE,
  WEAPON_IDS,
  WEAPON_RESERVE_CAP
} from './combatConstants.js';

export const PAWN_SHOP_ITEM_IDS = Object.freeze({
  cigarettes: 'cigarettes',
  pistol: WEAPON_IDS.pistol
});

export const PAWN_SHOP_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: PAWN_SHOP_ITEM_IDS.cigarettes,
    label: 'Cigarettes',
    price: 20,
    orderLine: 'Pack of cigarettes. Twenty bucks.',
    consumeLine: 'Smoked a cigarette.',
    inventoryField: 'cigaretteCount',
    kind: 'consumable'
  }),
  Object.freeze({
    id: PAWN_SHOP_ITEM_IDS.pistol,
    label: 'Pistol',
    price: 50,
    orderLine: 'Pistol sold. Fifty bucks.',
    weaponId: WEAPON_IDS.pistol,
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP,
    kind: 'weapon'
  })
]);

const PAWN_SHOP_MENU_ITEM_BY_ID = new Map(
  PAWN_SHOP_MENU_ITEMS.map((item) => [item.id, item])
);

const PAWN_SHOP_INVENTORY_FIELDS = Object.freeze(
  Object.fromEntries(
    PAWN_SHOP_MENU_ITEMS
      .filter((item) => item.inventoryField)
      .map((item) => [item.id, item.inventoryField])
  )
);

const PAWN_SHOP_OWNED_FIELDS = Object.freeze(
  Object.fromEntries(
    PAWN_SHOP_MENU_ITEMS
      .filter((item) => item.ownedField)
      .map((item) => [item.id, item.ownedField])
  )
);

export function normalizePawnShopOwnerEnabled(value = false) {
  return value === true;
}

export function isPawnShopOwnerNpc(npc = null) {
  return normalizePawnShopOwnerEnabled(npc?.pawnShopOwnerEnabled);
}

export function getPawnShopPromptRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function listPawnShopMenuItems() {
  return PAWN_SHOP_MENU_ITEMS;
}

export function normalizePawnShopMenuItemId(value = '') {
  const itemId = String(value ?? '').trim().toLowerCase();
  return PAWN_SHOP_MENU_ITEM_BY_ID.has(itemId) ? itemId : '';
}

export function getPawnShopMenuItem(itemId = '') {
  return PAWN_SHOP_MENU_ITEM_BY_ID.get(normalizePawnShopMenuItemId(itemId)) ?? null;
}

export function getPawnShopInventoryField(itemId = '') {
  return PAWN_SHOP_INVENTORY_FIELDS[normalizePawnShopMenuItemId(itemId)] ?? '';
}

export function getPawnShopOwnedField(itemId = '') {
  return PAWN_SHOP_OWNED_FIELDS[normalizePawnShopMenuItemId(itemId)] ?? '';
}

export function normalizePawnShopInventoryCount(value = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(999, Math.floor(numeric)));
}

export function getPlayerPawnShopItemCount(player = null, itemId = '') {
  const field = getPawnShopInventoryField(itemId);
  return field ? normalizePawnShopInventoryCount(player?.[field]) : 0;
}

export function isPlayerPawnShopItemOwned(player = null, itemId = '') {
  const normalizedItemId = normalizePawnShopMenuItemId(itemId);
  const field = getPawnShopOwnedField(normalizedItemId);
  if (!field) {
    return false;
  }

  return player?.[field] === true;
}

export function getPlayerPawnShopInventorySnapshot(player = null) {
  return {
    cigaretteCount: getPlayerPawnShopItemCount(player, PAWN_SHOP_ITEM_IDS.cigarettes)
  };
}

export function setPlayerPawnShopItemCount(player = null, itemId = '', count = 0) {
  const field = getPawnShopInventoryField(itemId);
  if (!player || !field) {
    return 0;
  }

  const nextCount = normalizePawnShopInventoryCount(count);
  player[field] = nextCount;
  return nextCount;
}

export function addPlayerPawnShopItem(player = null, itemId = '', quantity = 1) {
  const field = getPawnShopInventoryField(itemId);
  const ownedField = getPawnShopOwnedField(itemId);
  if (!player || (!field && !ownedField)) {
    return 0;
  }

  if (ownedField) {
    player[ownedField] = true;
    return 1;
  }

  const nextCount = normalizePawnShopInventoryCount(
    normalizePawnShopInventoryCount(player[field]) + Math.max(1, Math.floor(Number(quantity) || 1))
  );
  player[field] = nextCount;
  return nextCount;
}

export function normalizePawnShopPlayerBoundItems(player = null) {
  return {
    skateboardOwned: player?.skateboardOwned === true
  };
}

export function consumePlayerPawnShopItem(player = null, itemId = '') {
  const item = getPawnShopMenuItem(itemId);
  if (!player || !item || item.kind !== 'consumable') {
    return { ok: false, error: 'That item is not in your inventory.' };
  }

  const currentCount = getPlayerPawnShopItemCount(player, item.id);
  if (currentCount <= 0) {
    return { ok: false, error: `You do not have any ${item.label.toLowerCase()} left.` };
  }

  setPlayerPawnShopItemCount(player, item.id, currentCount - 1);
  return {
    ok: true,
    item: {
      id: item.id,
      label: item.label
    },
    inventory: getPlayerPawnShopInventorySnapshot(player),
    message: item.consumeLine
  };
}
