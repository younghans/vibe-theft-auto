import { getPlayerDrinkCount } from './bartender.js';
import { getPlayerMarthaItemCount } from './martha.js';
import { getPlayerPawnShopItemCount } from './pawnShop.js';
import {
  ITEM_IDS,
  ITEM_KINDS,
  getItemConsumableItemId,
  getItemDefinition,
  getItemDrinkItemId,
  getItemEquippedWeaponId
} from './itemDefinitions.js';
import { hasInventoryWeapon } from './weaponInventory.js';

export const HOTBAR_SLOT_COUNT = 8;
export const DEFAULT_HOTBAR_ITEM_ORDER = Object.freeze([
  ITEM_IDS.pistol,
  ITEM_IDS.beer,
  ITEM_IDS.shot,
  ITEM_IDS.cigarettes,
  ITEM_IDS.burger,
  ITEM_IDS.glizzy,
  ITEM_IDS.soda,
  '',
]);
const HOTBAR_ITEM_IDS = new Set();
for (const itemId of DEFAULT_HOTBAR_ITEM_ORDER) {
  if (itemId) {
    HOTBAR_ITEM_IDS.add(itemId);
  }
}

export const DEFAULT_HOTBAR_ASSIGNMENTS = Object.freeze([
  Object.freeze({ slotIndex: 0, itemId: ITEM_IDS.pistol }),
  Object.freeze({ slotIndex: 1, itemId: ITEM_IDS.beer }),
  Object.freeze({ slotIndex: 2, itemId: ITEM_IDS.shot }),
  Object.freeze({ slotIndex: 3, itemId: ITEM_IDS.cigarettes }),
  Object.freeze({ slotIndex: 4, itemId: ITEM_IDS.burger }),
  Object.freeze({ slotIndex: 5, itemId: ITEM_IDS.glizzy }),
  Object.freeze({ slotIndex: 6, itemId: ITEM_IDS.soda })
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
    drinkItemId: '',
    consumableItemId: ''
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
    drinkItemId: definition.drinkItemId ?? '',
    consumableItemId: definition.consumableItemId ?? ''
  });
}

function normalizeHotbarItemId(value = '') {
  const itemId = getItemDefinition(value)?.id ?? '';
  return HOTBAR_ITEM_IDS.has(itemId) ? itemId : '';
}

export function normalizeHotbarItemOrder(value = DEFAULT_HOTBAR_ITEM_ORDER) {
  const source = Array.isArray(value) ? value : [];
  const order = [];
  for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
    order.push('');
  }
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

    let emptyIndex = -1;
    for (let index = 0; index < order.length; index += 1) {
      if (!order[index]) {
        emptyIndex = index;
        break;
      }
    }
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
  const normalizedOrder = normalizeHotbarItemOrder(order);
  const nextOrder = [];
  for (const itemId of normalizedOrder) {
    nextOrder.push(itemId);
  }
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
  shotCount = 0,
  cigaretteCount = 0,
  burgerCount = 0,
  glizzyCount = 0,
  sodaCount = 0
} = {}) {
  const definition = getItemDefinition(itemId);
  if (!definition) {
    return 0;
  }

  if (definition.kind === ITEM_KINDS.drink) {
    return getPlayerDrinkCount({ beerCount, shotCount }, definition.drinkItemId);
  }

  if (definition.kind === ITEM_KINDS.consumable) {
    return Math.max(
      getPlayerPawnShopItemCount({ cigaretteCount }, definition.consumableItemId),
      getPlayerMarthaItemCount({ burgerCount, glizzyCount, sodaCount }, definition.consumableItemId)
    );
  }

  return 1;
}

function canShowHotbarItem(itemId = '', {
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0,
  cigaretteCount = 0,
  burgerCount = 0,
  glizzyCount = 0,
  sodaCount = 0
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

  if (definition.kind === ITEM_KINDS.consumable) {
    return getHotbarItemQuantity(definition.id, { cigaretteCount, burgerCount, glizzyCount, sodaCount }) > 0;
  }

  return false;
}

export function createHotbarSlots({
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0,
  cigaretteCount = 0,
  burgerCount = 0,
  glizzyCount = 0,
  sodaCount = 0,
  hotbarItemOrder = DEFAULT_HOTBAR_ITEM_ORDER
} = {}) {
  const inventoryState = { ownedWeaponIds, equippedWeaponId, beerCount, shotCount, cigaretteCount, burgerCount, glizzyCount, sodaCount };
  const itemOrder = normalizeHotbarItemOrder(hotbarItemOrder);

  const slots = [];
  for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
    const itemId = itemOrder[index];
    slots.push(itemId && canShowHotbarItem(itemId, inventoryState)
      ? createItemSlot(index, itemId, { quantity: getHotbarItemQuantity(itemId, inventoryState) })
      : createEmptySlot(index));
  }
  return Object.freeze(slots);
}

export const HOTBAR_SLOTS = createHotbarSlots();

const HOTBAR_KEY_CODE_ENTRIES = [];
for (const slot of HOTBAR_SLOTS) {
  HOTBAR_KEY_CODE_ENTRIES.push(`Digit${slot.key}`, `Numpad${slot.key}`);
}
export const HOTBAR_KEY_CODES = Object.freeze(HOTBAR_KEY_CODE_ENTRIES);

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

export function getHotbarConsumableItemId(slotOrIndex, slots = HOTBAR_SLOTS) {
  const slot = typeof slotOrIndex === 'object' && slotOrIndex
    ? slotOrIndex
    : getHotbarSlot(slotOrIndex, slots);

  const quantity = Math.max(0, Math.floor(Number(slot?.quantity ?? slot?.count) || 0));
  return slot?.kind === ITEM_KINDS.consumable && quantity > 0
    ? getItemConsumableItemId(slot.itemId)
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

  const order = normalizeHotbarItemOrder(hotbarItemOrder);
  let orderedIndex = -1;
  for (let index = 0; index < order.length; index += 1) {
    if (order[index] === normalizedItemId) {
      orderedIndex = index;
      break;
    }
  }
  if (orderedIndex >= 0) {
    return normalizeHotbarSlotIndex(orderedIndex);
  }

  let assignment = null;
  for (const entry of DEFAULT_HOTBAR_ASSIGNMENTS) {
    if (entry.itemId === normalizedItemId) {
      assignment = entry;
      break;
    }
  }
  return assignment ? normalizeHotbarSlotIndex(assignment.slotIndex) : -1;
}
