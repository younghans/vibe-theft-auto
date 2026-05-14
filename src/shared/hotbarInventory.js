import { WEAPON_IDS } from './combatConstants.js';
import {
  DRINK_ITEM_IDS,
  getPlayerDrinkCount,
  listDrinkInventoryItems
} from './bartender.js';
import { hasInventoryWeapon } from './weaponInventory.js';

export const HOTBAR_SLOT_COUNT = 5;

function createEmptySlot(index) {
  return Object.freeze({
    index,
    key: String(index + 1),
    itemId: '',
    label: 'Empty',
    kind: 'empty'
  });
}

function createPistolSlot() {
  return Object.freeze({
    index: 0,
    key: '1',
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

export function createHotbarSlots({
  ownedWeaponIds = '',
  equippedWeaponId = '',
  beerCount = 0,
  shotCount = 0
} = {}) {
  const hasPistol = hasInventoryWeapon(ownedWeaponIds, WEAPON_IDS.pistol)
    || String(equippedWeaponId ?? '').trim() === WEAPON_IDS.pistol;
  const drinkCounts = {
    [DRINK_ITEM_IDS.beer]: getPlayerDrinkCount({ beerCount, shotCount }, DRINK_ITEM_IDS.beer),
    [DRINK_ITEM_IDS.shot]: getPlayerDrinkCount({ beerCount, shotCount }, DRINK_ITEM_IDS.shot)
  };
  const drinkItems = listDrinkInventoryItems();

  return Object.freeze(
    Array.from({ length: HOTBAR_SLOT_COUNT }, (_, index) => {
      if (index === 0 && hasPistol) {
        return createPistolSlot();
      }

      const drink = drinkItems[index - 1] ?? null;
      const count = drink ? drinkCounts[drink.id] ?? 0 : 0;
      if (drink && count > 0) {
        return createDrinkSlot(index, drink, count);
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
