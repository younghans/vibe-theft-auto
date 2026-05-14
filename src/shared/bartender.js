export const BARTENDER_MENU_ITEMS = Object.freeze([
  Object.freeze({
    id: 'beer',
    label: 'Beer',
    price: 20,
    orderLine: 'Beer served. Twenty bucks.'
  }),
  Object.freeze({
    id: 'shot',
    label: 'Shot',
    price: 50,
    orderLine: 'Shot poured. Fifty bucks.'
  })
]);

const BARTENDER_MENU_ITEM_BY_ID = new Map(
  BARTENDER_MENU_ITEMS.map((item) => [item.id, item])
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
