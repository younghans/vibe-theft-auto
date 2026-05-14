import { WEAPON_IDS } from './combatConstants.js';
import {
  DRINK_ITEM_IDS,
  getPlayerDrinkCount,
  listDrinkInventoryItems
} from './bartender.js';
import { hasInventoryWeapon } from './weaponInventory.js';

export const HOTBAR_SLOT_COUNT = 5;
export const DEFAULT_HOTBAR_ITEM_ORDER = Object.freeze([
  WEAPON_IDS.pistol,
  DRINK_ITEM_IDS.beer,
  DRINK_ITEM_IDS.shot,
  '',
  ''
]);
const HOTBAR_ITEM_IDS = new Set(DEFAULT_HOTBAR_ITEM_ORDER.filter(Boolean));

function createEmptySlot(index) {
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: '',
    label: 'Empty',
    kind: 'empty'
  });
}

function createPistolSlot(index) {
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: WEAPON_IDS.pistol,
    label: 'Pistol',
    kind: 'weapon'
  });
}

function createDrinkSlot(index, item, count) {
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: item.id,
    label: item.label,
    kind: 'drink',
    count
  });
}

function normalizeHotbarItemId(value = '') {
  const itemId = String(value ?? '').trim();
  return HOTBAR_ITEM_IDS.has(itemId) ? itemId : '';
}

export function normalizeHotbarItemOrder(value = DEFAULT_HOTBAR_ITEM_ORDER) {
  const source = Array.isArray(value) ? value : [];
  const order = Array.from({ length: HOTBAR_SLOT_COUNT }, () => '');
  const usedItemIds = new Set();

  for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
    const itemId = normalizeHotbarItemId(source[index]);
    if (!itemId || usedItemIds.has(itemId)) {
      continue;
    }

    order[index] = itemId;
    usedItemIds.add(itemId);
  }

  for (const itemId of DEFAULT_HOTBAR_ITEM_ORDER) {
    if (!itemId || usedItemIds.has(itemId)) {
      continue;
    }

    const emptyIndex = order.findIndex((slotItemId) => !slotItemId);
    if (emptyIndex < 0) {
      break;
    }

    order[emptyIndex] = itemId;
    usedItemIds.add(itemId);
  }

  return Object.freeze(order);
}

export function moveHotbarItemOrderSlot(order = DEFAULT_HOTBAR_ITEM_ORDER, fromIndex, toIndex) {
  const normalizedFromIndex = normalizeHotbarSlotIndex(fromIndex);
  const normalizedToIndex = normalizeHotbarSlotIndex(toIndex);
  const nextOrder = [...normalizeHotbarItemOrder(order)];
  if (
    normalizedFromIndex < 0
    || normalizedToIndex < 0
    || normalizedFromIndex === normalizedToIndex
    || !nextOrder[normalizedFromIndex]
  ) {
    return Object.freeze(nextOrder);
  }

  const movedItemId = nextOrder[normalizedFromIndex];
  nextOrder[normalizedFromIndex] = nextOrder[normalizedToIndex] || '';
  nextOrder[normalizedToIndex] = movedItemId;
  return Object.freeze(nextOrder);
}

export function createHotbarSlots({
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0,
  hotbarItemOrder = DEFAULT_HOTBAR_ITEM_ORDER
} = {}) {
  const hasPistol = hasInventoryWeapon(ownedWeaponIds, WEAPON_IDS.pistol)
    || String(equippedWeaponId ?? '').trim() === WEAPON_IDS.pistol;
  const drinkCounts = {
    [DRINK_ITEM_IDS.beer]: getPlayerDrinkCount({ beerCount, shotCount }, DRINK_ITEM_IDS.beer),
    [DRINK_ITEM_IDS.shot]: getPlayerDrinkCount({ beerCount, shotCount }, DRINK_ITEM_IDS.shot)
  };
  const drinkItems = listDrinkInventoryItems();
  const itemSlots = new Map();

  if (hasPistol) {
    itemSlots.set(WEAPON_IDS.pistol, (index) => createPistolSlot(index));
  }

  for (const drink of drinkItems) {
    const count = drinkCounts[drink.id] ?? 0;
    if (count > 0) {
      itemSlots.set(drink.id, (index) => createDrinkSlot(index, drink, count));
    }
  }

  const itemOrder = normalizeHotbarItemOrder(hotbarItemOrder);

  return Object.freeze(
    Array.from({ length: HOTBAR_SLOT_COUNT }, (_, index) => {
      const createSlot = itemSlots.get(itemOrder[index]);
      if (createSlot) {
        return createSlot(index);
      }

      return createEmptySlot(index);
    })
  );
}

export const HOTBAR_SLOTS = createHotbarSlots();

export const HOTBAR_KEY_CODES = Object.freeze(
  HOTBAR_SLOTS.flatMap((slot) => [`Digit${slot.key}`, `Numpad${slot.key}`])
);

export function normalizeHotbarSlotIndex(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return -1;
  }

  const index = Math.trunc(numeric);
  return index >= 0 && index < HOTBAR_SLOT_COUNT ? index : -1;
}

export function getHotbarSlot(index, slots = HOTBAR_SLOTS) {
  const normalizedIndex = normalizeHotbarSlotIndex(index);
  return normalizedIndex >= 0 ? slots?.[normalizedIndex] ?? null : null;
}

export function getHotbarSlotIndexFromKeyCode(code = '') {
  const match = String(code).match(/^(?:Digit|Numpad)([0-9])$/u);
  if (!match) {
    return -1;
  }

  return normalizeHotbarSlotIndex(Number(match[1]) - 1);
}

export function getHotbarEquippedWeaponId(slotOrIndex, slots = HOTBAR_SLOTS) {
  const slot = typeof slotOrIndex === 'object' && slotOrIndex
    ? slotOrIndex
    : getHotbarSlot(slotOrIndex, slots);

  return slot?.kind === 'weapon' && slot.itemId === WEAPON_IDS.pistol
    ? WEAPON_IDS.pistol
    : '';
}

export function getHotbarDrinkItemId(slotOrIndex, slots = HOTBAR_SLOTS) {
  const slot = typeof slotOrIndex === 'object' && slotOrIndex
    ? slotOrIndex
    : getHotbarSlot(slotOrIndex, slots);

  return slot?.kind === 'drink' && getPlayerDrinkCount({ [`${slot.itemId}Count`]: slot.count }, slot.itemId) > 0
    ? slot.itemId
    : '';
}
