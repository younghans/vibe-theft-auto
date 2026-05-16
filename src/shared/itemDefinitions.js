import { WEAPON_IDS, WEAPON_RELOAD_MS } from './combatConstants.js';
import { DRINK_ITEM_IDS, getBartenderMenuItem } from './bartender.js';
import { PAWN_SHOP_ITEM_IDS, getPawnShopMenuItem } from './pawnShop.js';

export const ITEM_IDS = Object.freeze({
  pistol: WEAPON_IDS.pistol,
  beer: DRINK_ITEM_IDS.beer,
  shot: DRINK_ITEM_IDS.shot,
  cigarettes: PAWN_SHOP_ITEM_IDS.cigarettes
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
  cigarettes: 'consumableCigarettes'
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
  })
});

export function normalizeItemId(itemId = '') {
  const normalizedItemId = String(itemId ?? '').trim();
  return ITEM_DEFINITIONS[normalizedItemId]?.id ?? '';
}

export function getItemDefinition(itemId = '') {
  return ITEM_DEFINITIONS[normalizeItemId(itemId)] ?? null;
}

export function listItemDefinitions() {
  return Object.freeze(Object.values(ITEM_DEFINITIONS));
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

export function getItemByEquippedWeaponId(weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  return Object.values(ITEM_DEFINITIONS).find((item) => item.equippedWeaponId === normalizedWeaponId) ?? null;
}

export function getItemByDrinkItemId(drinkItemId = '') {
  const normalizedDrinkItemId = String(drinkItemId ?? '').trim();
  return Object.values(ITEM_DEFINITIONS).find((item) => item.drinkItemId === normalizedDrinkItemId) ?? null;
}

export function getItemEquipAnimation(itemId = '') {
  return getItemDefinition(itemId)?.equip?.animation ?? null;
}

export function getItemEquipAnimationForWeapon(weaponId = '') {
  return getItemByEquippedWeaponId(weaponId)?.equip?.animation ?? null;
}
