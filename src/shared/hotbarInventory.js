import { getPlayerDrinkCount } from './bartender.js';
import {
  ITEM_IDS,
  ITEM_KINDS,
  getItemDefinition,
  getItemDrinkItemId,
  getItemEquippedWeaponId
} from './itemDefinitions.js';
import { hasInventoryWeapon } from './weaponInventory.js';

export const HOTBAR_SLOT_COUNT = 5;
export const DEFAULT_HOTBAR_ITEM_ORDER = Object.freeze([
  ITEM_IDS.pistol,
  ITEM_IDS.beer,
  ITEM_IDS.shot,
  '',
  ''
]);
const HOTBAR_ITEM_IDS = new Set(DEFAULT_HOTBAR_ITEM_ORDER.filter(Boolean));

export const DEFAULT_HOTBAR_ASSIGNMENTS = Object.freeze([
  Object.freeze({ slotIndex: 0, itemId: ITEM_IDS.pistol }),
  Object.freeze({ slotIndex: 1, itemId: ITEM_IDS.beer }),
  Object.freeze({ slotIndex: 2, itemId: ITEM_IDS.shot })
]);

function createEmptySlot(index) {
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: '',
    quantity: 0,
    count: 0,
    label: 'Empty',
    kind: ITEM_KINDS.empty,
    hotbarIconId: '',
    equippedWeaponId: '',
    drinkItemId: ''
  });
}

function createItemSlot(index, itemId, { quantity = 1 } = {}) {
  const definition = getItemDefinition(itemId);
  if (!definition) {
    return createEmptySlot(index);
  }

  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: definition.id,
    quantity: safeQuantity,
    count: safeQuantity,
    label: definition.label,
    kind: definition.kind,
    hotbarIconId: definition.hotbarIconId ?? '',
    equippedWeaponId: definition.equippedWeaponId ?? '',
    drinkItemId: definition.drinkItemId ?? ''
  });
}

function normalizeHotbarItemId(value = '') {
  const itemId = getItemDefinition(value)?.id ?? '';
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

function getHotbarItemQuantity(itemId = '', {
  beerCount = 0,
  shotCount = 0
} = {}) {
  const definition = getItemDefinition(itemId);
  if (!definition) {
    return 0;
  }

  if (definition.kind === ITEM_KINDS.drink) {
    return getPlayerDrinkCount({ beerCount, shotCount }, definition.drinkItemId);
  }

  return 1;
}

function canShowHotbarItem(itemId = '', {
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0
} = {}) {
  const definition = getItemDefinition(itemId);
  if (!definition) {
    return false;
  }

  if (definition.kind === ITEM_KINDS.weapon) {
    const weaponId = definition.equippedWeaponId ?? '';
    return hasInventoryWeapon(ownedWeaponIds, weaponId)
      || String(equippedWeaponId ?? '').trim() === weaponId;
  }

  if (definition.kind === ITEM_KINDS.drink) {
    return getHotbarItemQuantity(definition.id, { beerCount, shotCount }) > 0;
  }

  return false;
}

export function createHotbarSlots({
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0,
  hotbarItemOrder = DEFAULT_HOTBAR_ITEM_ORDER
} = {}) {
  const inventoryState = { ownedWeaponIds, equippedWeaponId, beerCount, shotCount };
  const itemOrder = normalizeHotbarItemOrder(hotbarItemOrder);

  return Object.freeze(
    Array.from({ length: HOTBAR_SLOT_COUNT }, (_, index) => {
      const itemId = itemOrder[index];
      return itemId && canShowHotbarItem(itemId, inventoryState)
        ? createItemSlot(index, itemId, { quantity: getHotbarItemQuantity(itemId, inventoryState) })
        : createEmptySlot(index);
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

  return slot?.kind === ITEM_KINDS.weapon
    ? getItemEquippedWeaponId(slot.itemId)
    : '';
}

export function getHotbarDrinkItemId(slotOrIndex, slots = HOTBAR_SLOTS) {
  const slot = typeof slotOrIndex === 'object' && slotOrIndex
    ? slotOrIndex
    : getHotbarSlot(slotOrIndex, slots);

  const quantity = Math.max(0, Math.floor(Number(slot?.quantity ?? slot?.count) || 0));
  return slot?.kind === ITEM_KINDS.drink && quantity > 0
    ? getItemDrinkItemId(slot.itemId)
    : '';
}

export function getPreferredHotbarSlotIndexForItem(
  itemId = '',
  hotbarItemOrder = DEFAULT_HOTBAR_ITEM_ORDER
) {
  const normalizedItemId = getItemDefinition(itemId)?.id ?? '';
  if (!normalizedItemId) {
    return -1;
  }

  const orderedIndex = normalizeHotbarItemOrder(hotbarItemOrder).findIndex((entry) => entry === normalizedItemId);
  if (orderedIndex >= 0) {
    return normalizeHotbarSlotIndex(orderedIndex);
  }

  const assignment = DEFAULT_HOTBAR_ASSIGNMENTS.find((entry) => entry.itemId === normalizedItemId);
  return assignment ? normalizeHotbarSlotIndex(assignment.slotIndex) : -1;
}
