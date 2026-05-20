import { WEAPON_IDS } from './combatConstants.js';

const VALID_WEAPON_ID_ENTRIES = new Set();
for (const key in WEAPON_IDS) {
  if (Object.hasOwn(WEAPON_IDS, key)) {
    VALID_WEAPON_ID_ENTRIES.add(WEAPON_IDS[key]);
  }
}
const VALID_WEAPON_IDS = Object.freeze(VALID_WEAPON_ID_ENTRIES);
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
  if (!VALID_WEAPON_IDS.has(normalizedWeaponId)) {
    return false;
  }

  if (Array.isArray(value)) {
    for (const rawId of value) {
      if (String(rawId ?? '').trim() === normalizedWeaponId) {
        return true;
      }
    }
    return false;
  }

  const rawValue = String(value ?? '');
  let start = 0;
  for (let index = 0; index <= rawValue.length; index += 1) {
    if (index !== rawValue.length && rawValue[index] !== INVENTORY_SEPARATOR) {
      continue;
    }

    if (rawValue.slice(start, index).trim() === normalizedWeaponId) {
      return true;
    }
    start = index + 1;
  }

  return false;
}

export function addInventoryWeapon(value = '', weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  const weaponIds = normalizeWeaponInventoryIds(value);
  let alreadyOwned = false;
  for (const id of weaponIds) {
    if (id === normalizedWeaponId) {
      alreadyOwned = true;
      break;
    }
  }
  if (!VALID_WEAPON_IDS.has(normalizedWeaponId) || alreadyOwned) {
    return weaponIds.join(INVENTORY_SEPARATOR);
  }

  weaponIds.push(normalizedWeaponId);
  return weaponIds.join(INVENTORY_SEPARATOR);
}

export function removeInventoryWeapon(value = '', weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  const weaponIds = normalizeWeaponInventoryIds(value);
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < weaponIds.length; readIndex += 1) {
    if (weaponIds[readIndex] !== normalizedWeaponId) {
      weaponIds[writeIndex] = weaponIds[readIndex];
      writeIndex += 1;
    }
  }
  weaponIds.length = writeIndex;
  return weaponIds.join(INVENTORY_SEPARATOR);
}
