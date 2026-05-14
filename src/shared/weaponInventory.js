import { WEAPON_IDS } from './combatConstants.js';

const VALID_WEAPON_IDS = Object.freeze(new Set(Object.values(WEAPON_IDS)));
const INVENTORY_SEPARATOR = ',';

export function normalizeWeaponInventoryIds(value = '') {
  const rawIds = Array.isArray(value)
    ? value
    : String(value ?? '').split(INVENTORY_SEPARATOR);
  const seen = new Set();
  const normalizedIds = [];

  for (const rawId of rawIds) {
    const weaponId = String(rawId ?? '').trim();
    if (!VALID_WEAPON_IDS.has(weaponId) || seen.has(weaponId)) {
      continue;
    }

    seen.add(weaponId);
    normalizedIds.push(weaponId);
  }

  return normalizedIds;
}

export function serializeWeaponInventoryIds(value = '') {
  return normalizeWeaponInventoryIds(value).join(INVENTORY_SEPARATOR);
}

export function hasInventoryWeapon(value = '', weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  return normalizeWeaponInventoryIds(value).includes(normalizedWeaponId);
}

export function addInventoryWeapon(value = '', weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  const weaponIds = normalizeWeaponInventoryIds(value);
  if (!VALID_WEAPON_IDS.has(normalizedWeaponId) || weaponIds.includes(normalizedWeaponId)) {
    return weaponIds.join(INVENTORY_SEPARATOR);
  }

  return [...weaponIds, normalizedWeaponId].join(INVENTORY_SEPARATOR);
}

export function removeInventoryWeapon(value = '', weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  return normalizeWeaponInventoryIds(value)
    .filter((id) => id !== normalizedWeaponId)
    .join(INVENTORY_SEPARATOR);
}
