import { rotateFootprintOffset } from './tileFootprint.js';
import {
  WEAPON_CLIP_SIZE,
  WEAPON_IDS,
  WEAPON_RESERVE_CAP
} from './combatConstants.js';
import { normalizeRotationQuarterTurns, quantizePosition } from './numberMath.js';
import { getPlacementScale } from './placementScale.js';

export const COMBAT_PICKUP_PROP_ITEM_IDS = Object.freeze({
  pistol: 'pickup_pistol'
});

export const COMBAT_PICKUP_ITEM_DEFINITIONS = Object.freeze({
  [COMBAT_PICKUP_PROP_ITEM_IDS.pistol]: Object.freeze({
    weaponId: WEAPON_IDS.pistol,
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP,
    localOffset: Object.freeze([0, 0])
  })
});

function cloneOffset(offset) {
  return Array.isArray(offset) ? [...offset] : null;
}

export function cloneCombatPickupDefinition(definition) {
  if (!definition) {
    return null;
  }

  return {
    ...definition,
    localOffset: cloneOffset(definition.localOffset)
  };
}

export function getCombatPickupItemDefinition(itemOrId) {
  const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  return cloneCombatPickupDefinition(COMBAT_PICKUP_ITEM_DEFINITIONS[itemId]);
}

function isValidWeaponId(weaponId) {
  return Object.values(WEAPON_IDS).includes(String(weaponId ?? '').trim());
}

function normalizeAmmo(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.floor(numeric));
}

export function createCombatPickupSpawnDefinition(placement, item) {
  const pickupDefinition = item?.combatPickup ?? getCombatPickupItemDefinition(item?.id);
  if (!placement || !item || item.layer !== 'prop' || !pickupDefinition || !Array.isArray(placement.position)) {
    return null;
  }

  const placementId = String(placement.id ?? '').trim();
  const weaponId = String(pickupDefinition.weaponId ?? '').trim();
  if (!placementId || !isValidWeaponId(weaponId)) {
    return null;
  }

  const localOffset = Array.isArray(pickupDefinition.localOffset)
    ? pickupDefinition.localOffset
    : [0, 0];
  const scale = getPlacementScale(placement);
  const rotatedOffset = rotateFootprintOffset(
    (Number(localOffset[0]) || 0) * scale,
    (Number(localOffset[1]) || 0) * scale,
    normalizeRotationQuarterTurns(placement.rotationQuarterTurns)
  );

  return {
    id: `pickup_spawn_${placementId}`,
    placementId,
    weaponId,
    position: [
      quantizePosition((Number(placement.position[0]) || 0) + rotatedOffset.x),
      quantizePosition((Number(placement.position[1]) || 0) + rotatedOffset.z)
    ],
    ammoInClip: normalizeAmmo(pickupDefinition.ammoInClip, WEAPON_CLIP_SIZE),
    reserveAmmo: normalizeAmmo(pickupDefinition.reserveAmmo, WEAPON_RESERVE_CAP)
  };
}

export function getCombatPickupSpawnDefinitions(placements = [], getItemById = () => null) {
  return [...(placements ?? [])]
    .map((placement) => createCombatPickupSpawnDefinition(placement, getItemById(placement?.itemId)))
    .filter(Boolean);
}
