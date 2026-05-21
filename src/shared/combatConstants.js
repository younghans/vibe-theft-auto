import { BUILDER_TILE_SIZE } from './worldConstants.js';

export const WEAPON_IDS = Object.freeze({
  pistol: 'pistol'
});

export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RADIUS = 1.4;
export const PLAYER_MAX_ACCEPTED_SPEED = 22;
export const PLAYER_POSITION_FORGIVENESS = 1;
export const PICKUP_INTERACT_RADIUS = 3.2;
export const PUNCH_DAMAGE = 12;
export const NPC_PUNCH_DAMAGE = 6;
export const NPC_PUNCH_HIT_CHANCE = 0.7;
export const PUNCH_HOOK_DAMAGE = 16;
export const PUNCH_UPPERCUT_DAMAGE = 20;
export const PUNCH_RANGE = 4.65;
export const PUNCH_INTERVAL_MS = 320;
export const NPC_PUNCH_INTERVAL_MS = 1100;
export const PUNCH_COMBO_MIN_INTERVAL_MS = 250;
export const PUNCH_COMBO_HOOK_RELEASE_MS = 270;
export const PUNCH_COMBO_UPPERCUT_RELEASE_MS = 320;
export const PUNCH_COMBO_BUFFER_MS = 220;
export const PUNCH_COMBO_WINDOW_MS = 640;
export const PUNCH_HIT_DELAY_MS = 90;
export const PUNCH_HOOK_HIT_DELAY_MS = 125;
export const PUNCH_UPPERCUT_HIT_DELAY_MS = 150;
export const PUNCH_JAB_IMPACT_STRENGTH = 1.45;
export const PUNCH_HOOK_IMPACT_STRENGTH = 1.78;
export const PUNCH_UPPERCUT_IMPACT_STRENGTH = 2.08;
export const PUNCH_LUNGE_DISTANCE = 0.42;
export const PUNCH_LUNGE_BACKSWING_DISTANCE = 0.06;
export const PUNCH_LUNGE_WINDUP_MS = 35;
export const PUNCH_LUNGE_PEAK_MS = 115;
export const PUNCH_LUNGE_RECOVER_MS = 260;
export const PUNCH_ASSISTED_LUNGE_BONUS = 0.38;
export const PUNCH_HIT_ORIGIN_FORWARD_OFFSET = PUNCH_LUNGE_DISTANCE * 0.75;
export const PUNCH_HITBOX_RADIUS = 0.55;
export const PUNCH_TARGET_ASSIST_MAX_ANGLE_RAD = Math.PI / 6;
export const PUNCH_TARGET_ASSIST_RANGE_BONUS = 1.25;
export const HIT_REACTION_HEAD = 'headHit';
export const HIT_REACTION_STOMACH = 'stomachHit';
export const PUNCH_HIT_REACTIONS = Object.freeze([
  HIT_REACTION_HEAD,
  HIT_REACTION_STOMACH
]);
export const WEAPON_CLIP_SIZE = 12;
export const WEAPON_RESERVE_CAP = 36;
export const WEAPON_DAMAGE = 20;
export const NPC_WEAPON_DAMAGE = 9;
export const NPC_WEAPON_HIT_CHANCE = 0.65;
export const NPC_WEAPON_MISS_MIN_ANGLE_RAD = 0.34;
export const NPC_WEAPON_MISS_MAX_ANGLE_RAD = 0.72;
export const WEAPON_RANGE = 45;
export const WEAPON_FIRE_INTERVAL_MS = 100;
export const NPC_SHOT_INTERVAL_MS = 700;
export const WEAPON_RELOAD_MS = 1200;
export const PLAYER_RESPAWN_MS = 5000;
export const PICKUP_RESPAWN_MS = 10000;
export const DROPPED_PICKUP_DESPAWN_MS = 20000;
export const COMBAT_HEALTH_REGEN_DELAY_MS = 10000;
export const COMBAT_HEALTH_REGEN_INTERVAL_MS = 500;

const T = BUILDER_TILE_SIZE;

export const COMBAT_RESPAWN_POINTS = Object.freeze([
  Object.freeze([0, 4.1 * T]),
  Object.freeze([0, -4.1 * T]),
  Object.freeze([4.1 * T, 0]),
  Object.freeze([-4.1 * T, 0])
]);
