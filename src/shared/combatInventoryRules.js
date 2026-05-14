import {
  WEAPON_CLIP_SIZE,
  WEAPON_RESERVE_CAP
} from './combatConstants.js';
import { getItemByEquippedWeaponId } from './itemDefinitions.js';
import {
  addInventoryWeapon,
  hasInventoryWeapon
} from './weaponInventory.js';

export function normalizeEquippableWeaponId(weaponId = '') {
  const normalizedWeaponId = String(weaponId ?? '').trim();
  return getItemByEquippedWeaponId(normalizedWeaponId)?.equippedWeaponId ?? '';
}

export function canEquipInventoryWeapon(ownedWeaponIds = '', weaponId = '') {
  const normalizedWeaponId = normalizeEquippableWeaponId(weaponId);
  return !normalizedWeaponId || hasInventoryWeapon(ownedWeaponIds, normalizedWeaponId);
}

export function applyWeaponPickupToPlayerState(player, pickup) {
  const weaponId = normalizeEquippableWeaponId(pickup?.weaponId);
  if (!player || !pickup || !weaponId) {
    return { changed: false, weaponId: '' };
  }

  const pickupAmmoInClip = Math.max(0, Math.floor(Number(pickup.ammoInClip) || 0));
  const pickupReserveAmmo = Math.max(0, Math.floor(Number(pickup.reserveAmmo) || 0));
  const currentAmmoInClip = Math.max(0, Math.floor(Number(player.ammoInClip) || 0));
  const currentReserveAmmo = Math.max(0, Math.floor(Number(player.reserveAmmo) || 0));

  if (
    player.equippedWeaponId
    && player.equippedWeaponId !== weaponId
    && !hasInventoryWeapon(player.ownedWeaponIds, weaponId)
  ) {
    return { changed: false, weaponId, reason: 'blocked-by-equipped-weapon' };
  }

  const alreadyOwned = hasInventoryWeapon(player.ownedWeaponIds, weaponId);
  if (alreadyOwned) {
    const nextClip = Math.min(WEAPON_CLIP_SIZE, currentAmmoInClip + pickupAmmoInClip);
    const clipDelta = nextClip - currentAmmoInClip;
    const remainingReserveFromPickup = Math.max(0, pickupAmmoInClip - clipDelta) + pickupReserveAmmo;
    const nextReserve = Math.min(WEAPON_RESERVE_CAP, currentReserveAmmo + remainingReserveFromPickup);
    if (nextClip === currentAmmoInClip && nextReserve === currentReserveAmmo) {
      return { changed: false, weaponId, reason: 'no-ammo-space' };
    }

    player.ammoInClip = nextClip;
    player.reserveAmmo = nextReserve;
  } else {
    player.ownedWeaponIds = addInventoryWeapon(player.ownedWeaponIds, weaponId);
    player.equippedWeaponId = weaponId;
    player.ammoInClip = Math.min(WEAPON_CLIP_SIZE, pickupAmmoInClip);
    player.reserveAmmo = Math.min(WEAPON_RESERVE_CAP, pickupReserveAmmo);
  }

  player.isReloading = false;
  player.reloadEndsAt = 0;
  return { changed: true, weaponId, alreadyOwned };
}
