import { WEAPON_IDS, WEAPON_RELOAD_MS } from './combatConstants.js';
import { DRINK_ITEM_IDS, getBartenderMenuItem } from './bartender.js';
import { PAWN_SHOP_ITEM_IDS, getPawnShopMenuItem } from './pawnShop.js';
import { MARTHA_ITEM_IDS, getMarthaMenuItem } from './martha.js';

export const ITEM_IDS = Object.freeze({
  pistol: WEAPON_IDS.pistol,
  beer: DRINK_ITEM_IDS.beer,
  shot: DRINK_ITEM_IDS.shot,
  cigarettes: PAWN_SHOP_ITEM_IDS.cigarettes,
  burger: MARTHA_ITEM_IDS.burger,
  glizzy: MARTHA_ITEM_IDS.glizzy,
  soda: MARTHA_ITEM_IDS.soda
});

export const ITEM_KINDS = Object.freeze({
  empty: 'empty',
  weapon: 'weapon',
  drink: 'drink',
  consumable: 'consumable'
});

export const ITEM_HOTBAR_ICON_IDS = Object.freeze({
  pistol: 'hotbarPistol',
  beer: 'drinkBeer',
  shot: 'drinkShot',
  cigarettes: 'consumableCigarettes',
  burger: 'foodBurger',
  glizzy: 'foodGlizzy',
  soda: 'foodSoda'
});

export const ITEM_EQUIP_ANIMATION_IDS = Object.freeze({
  pistolCock: 'pistol-cock'
});

const ITEM_DEFINITIONS = Object.freeze({
  [ITEM_IDS.pistol]: Object.freeze({
    id: ITEM_IDS.pistol,
    kind: ITEM_KINDS.weapon,
    label: 'Pistol',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.pistol,
    equippedWeaponId: WEAPON_IDS.pistol,
    maxOwned: 1,
    equip: Object.freeze({
      animation: Object.freeze({
        id: ITEM_EQUIP_ANIMATION_IDS.pistolCock,
        durationMs: Math.min(850, WEAPON_RELOAD_MS),
        previewReload: true,
        lockUse: true,
        soundId: 'pistolCock'
      })
    })
  })
  ,
  [ITEM_IDS.beer]: Object.freeze({
    id: ITEM_IDS.beer,
    kind: ITEM_KINDS.drink,
    label: getBartenderMenuItem(DRINK_ITEM_IDS.beer)?.label ?? 'Beer',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.beer,
    drinkItemId: DRINK_ITEM_IDS.beer,
    maxStack: 999
  }),
  [ITEM_IDS.shot]: Object.freeze({
    id: ITEM_IDS.shot,
    kind: ITEM_KINDS.drink,
    label: getBartenderMenuItem(DRINK_ITEM_IDS.shot)?.label ?? 'Shot',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.shot,
    drinkItemId: DRINK_ITEM_IDS.shot,
    maxStack: 999
  }),
  [ITEM_IDS.cigarettes]: Object.freeze({
    id: ITEM_IDS.cigarettes,
    kind: ITEM_KINDS.consumable,
    label: getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.cigarettes)?.label ?? 'Cigarettes',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.cigarettes,
    consumableItemId: PAWN_SHOP_ITEM_IDS.cigarettes,
    actionLabel: 'Smoke',
    maxStack: 999
  }),
  [ITEM_IDS.burger]: Object.freeze({
    id: ITEM_IDS.burger,
    kind: ITEM_KINDS.consumable,
    label: getMarthaMenuItem(MARTHA_ITEM_IDS.burger)?.label ?? 'Burger',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.burger,
    consumableItemId: MARTHA_ITEM_IDS.burger,
    actionLabel: 'Eat',
    maxStack: 999
  }),
  [ITEM_IDS.glizzy]: Object.freeze({
    id: ITEM_IDS.glizzy,
    kind: ITEM_KINDS.consumable,
    label: getMarthaMenuItem(MARTHA_ITEM_IDS.glizzy)?.label ?? 'Glizzy',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.glizzy,
    consumableItemId: MARTHA_ITEM_IDS.glizzy,
    actionLabel: 'Eat',
    maxStack: 999
  }),
  [ITEM_IDS.soda]: Object.freeze({
    id: ITEM_IDS.soda,
    kind: ITEM_KINDS.consumable,
    label: getMarthaMenuItem(MARTHA_ITEM_IDS.soda)?.label ?? 'Soda',
    hotbarIconId: ITEM_HOTBAR_ICON_IDS.soda,
    consumableItemId: MARTHA_ITEM_IDS.soda,
    actionLabel: 'Drink',
    maxStack: 999
  })
});

const ITEM_DEFINITION_ENTRIES = [];
for (const key in ITEM_DEFINITIONS) {
  if (Object.hasOwn(ITEM_DEFINITIONS, key)) {
    ITEM_DEFINITION_ENTRIES.push(ITEM_DEFINITIONS[key]);
  }
}
const ITEM_DEFINITION_LIST = Object.freeze(ITEM_DEFINITION_ENTRIES);
const ITEM_BY_EQUIPPED_WEAPON_ID = new Map();
const ITEM_BY_DRINK_ITEM_ID = new Map();

for (const item of ITEM_DEFINITION_LIST) {
  if (item.equippedWeaponId) {
    ITEM_BY_EQUIPPED_WEAPON_ID.set(item.equippedWeaponId, item);
  }
  if (item.drinkItemId) {
    ITEM_BY_DRINK_ITEM_ID.set(item.drinkItemId, item);
  }
}

export function normalizeItemId(itemId = '') {
  const normalizedItemId = String(itemId ?? '').trim();
  return ITEM_DEFINITIONS[normalizedItemId]?.id ?? '';
}

export function getItemDefinition(itemId = '') {
  return ITEM_DEFINITIONS[normalizeItemId(itemId)] ?? null;
}

export function listItemDefinitions() {
  return ITEM_DEFINITION_LIST;
}

export function getItemKind(itemId = '') {
  return getItemDefinition(itemId)?.kind ?? ITEM_KINDS.empty;
}

export function getItemLabel(itemId = '', fallback = '') {
  return getItemDefinition(itemId)?.label ?? fallback;
}

export function getItemHotbarIconId(itemId = '') {
  return getItemDefinition(itemId)?.hotbarIconId ?? '';
}

export function getItemEquippedWeaponId(itemId = '') {
  return getItemDefinition(itemId)?.equippedWeaponId ?? '';
}

export function getItemDrinkItemId(itemId = '') {
  return getItemDefinition(itemId)?.drinkItemId ?? '';
}

export function getItemConsumableItemId(itemId = '') {
  return getItemDefinition(itemId)?.consumableItemId ?? '';
}

export function getItemActionLabel(itemId = '', fallback = 'Use') {
  return getItemDefinition(itemId)?.actionLabel ?? fallback;
}

export function getItemByEquippedWeaponId(weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  return ITEM_BY_EQUIPPED_WEAPON_ID.get(normalizedWeaponId) ?? null;
}

export function getItemByDrinkItemId(drinkItemId = '') {
  const normalizedDrinkItemId = String(drinkItemId ?? '').trim();
  return ITEM_BY_DRINK_ITEM_ID.get(normalizedDrinkItemId) ?? null;
}

export function getItemEquipAnimation(itemId = '') {
  return getItemDefinition(itemId)?.equip?.animation ?? null;
}

export function getItemEquipAnimationForWeapon(weaponId = '') {
  return getItemByEquippedWeaponId(weaponId)?.equip?.animation ?? null;
}
