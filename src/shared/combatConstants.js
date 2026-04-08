import { BUILDER_TILE_SIZE } from './worldConstants.js';

export const WEAPON_IDS = Object.freeze({
  pistol: 'pistol'
});

export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RADIUS = 1.4;
export const PLAYER_MAX_ACCEPTED_SPEED = 22;
export const PLAYER_POSITION_FORGIVENESS = 1;
export const PICKUP_INTERACT_RADIUS = 3.2;
export const WEAPON_CLIP_SIZE = 12;
export const WEAPON_RESERVE_CAP = 36;
export const WEAPON_DAMAGE = 20;
export const WEAPON_RANGE = 45;
export const WEAPON_FIRE_INTERVAL_MS = 100;
export const WEAPON_RELOAD_MS = 1200;
export const PLAYER_RESPAWN_MS = 3000;
export const PICKUP_RESPAWN_MS = 10000;
export const DROPPED_PICKUP_DESPAWN_MS = 20000;

const T = BUILDER_TILE_SIZE;

export const COMBAT_RESPAWN_POINTS = Object.freeze([
  Object.freeze([0, 4.1 * T]),
  Object.freeze([0, -4.1 * T]),
  Object.freeze([4.1 * T, 0]),
  Object.freeze([-4.1 * T, 0])
]);

export const COMBAT_PICKUP_SPAWNS = Object.freeze([
  Object.freeze({
    id: 'pickup_spawn_pistol_1',
    weaponId: WEAPON_IDS.pistol,
    position: Object.freeze([-2.2 * T, -0.6 * T]),
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP
  }),
  Object.freeze({
    id: 'pickup_spawn_pistol_2',
    weaponId: WEAPON_IDS.pistol,
    position: Object.freeze([2.2 * T, 0.6 * T]),
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP
  }),
  Object.freeze({
    id: 'pickup_spawn_pistol_3',
    weaponId: WEAPON_IDS.pistol,
    position: Object.freeze([0, -2.2 * T]),
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP
  }),
  Object.freeze({
    id: 'pickup_spawn_pistol_4',
    weaponId: WEAPON_IDS.pistol,
    position: Object.freeze([0, 2.2 * T]),
    ammoInClip: WEAPON_CLIP_SIZE,
    reserveAmmo: WEAPON_RESERVE_CAP
  })
]);
