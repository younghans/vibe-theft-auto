import {
  NPC_COMBAT_ARCHETYPES,
  NPC_DEFAULT_INTERACT_RADIUS,
  NPC_DEFAULT_LAW_RADIUS,
  NPC_DEFAULT_POLICE_AGGRO_RADIUS,
  NPC_SPEED_TIERS,
  NPC_STEP_TYPES,
  normalizeNpcBehavior
} from './npcBehavior.js';
import { WEAPON_IDS } from '../shared/combatConstants.js';
import {
  quantizePosition,
  normalizeRotationQuarterTurns,
  rotationRadiansToQuarterTurns
} from '../shared/numberMath.js';
import {
  PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH,
  PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID,
  PASSIVE_TRAFFIC_POLICE_TANK_ITEM_ID
} from '../world/passiveTraffic.js';

export const POLICE_CAR_RESPONSE_NPC_PREFIX = 'npc_police_car_response_';
export const POLICE_CAR_RESPONSE_FLAG = 'policeCarResponse';
export const POLICE_CAR_RESPONSE_DEAD_DESPAWN_MS = 10000;
export const POLICE_CAR_RESPONSE_OFFICER_COUNT = 2;

const POLICE_CAR_RESPONSE_PROMPT = 'You are a police officer responding to a cruiser being shot. Stop the suspect, then return to the police station garage.';
const POLICE_CAR_RESPONSE_SIDE_OFFSET = PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH + 1.35;
const POLICE_CAR_RESPONSE_REAR_BIAS = 0.65;

function sanitizeIdPart(value = '') {
  return String(value || 'unknown').replace(/[^a-z0-9_-]+/giu, '-').slice(0, 96) || 'unknown';
}

export function isPoliceCarResponseNpcId(npcId = '') {
  return String(npcId || '').startsWith(POLICE_CAR_RESPONSE_NPC_PREFIX);
}

export function createPoliceCarResponseNpcId(carId = '', side = 'driver', sequence = 0) {
  return `${POLICE_CAR_RESPONSE_NPC_PREFIX}${sanitizeIdPart(carId)}_${side}_${Math.max(0, Math.floor(Number(sequence) || 0))}`;
}

export function getPoliceCarResponseOfficerSpawnSpecs(car = null) {
  if (!car || (car.itemId !== PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID && car.itemId !== PASSIVE_TRAFFIC_POLICE_TANK_ITEM_ID)) {
    return [];
  }

  const yaw = Number(car.rotationY ?? car.yaw) || 0;
  const carX = Number(car.x ?? car.position?.x);
  const carZ = Number(car.z ?? car.position?.z);
  if (!Number.isFinite(carX) || !Number.isFinite(carZ)) {
    return [];
  }

  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return [
    { side: 'driver', sideSign: -1 },
    { side: 'passenger', sideSign: 1 }
  ].map(({ side, sideSign }) => ({
    side,
    x: quantizePosition(carX + (rightX * sideSign * POLICE_CAR_RESPONSE_SIDE_OFFSET) - (forwardX * POLICE_CAR_RESPONSE_REAR_BIAS)),
    z: quantizePosition(carZ + (rightZ * sideSign * POLICE_CAR_RESPONSE_SIDE_OFFSET) - (forwardZ * POLICE_CAR_RESPONSE_REAR_BIAS)),
    rotationY: yaw
  }));
}

export function createPoliceCarResponseNpcDefinition({
  npcId = '',
  spawn = null,
  stationPlacementId = ''
} = {}) {
  if (!npcId || !spawn || !stationPlacementId) {
    return null;
  }

  const rotationQuarterTurns = normalizeRotationQuarterTurns(rotationRadiansToQuarterTurns(spawn.rotationY ?? 0));
  const position = [
    quantizePosition(spawn.x),
    quantizePosition(spawn.z)
  ];
  return normalizeNpcBehavior({
    id: npcId,
    modelId: 'policeOfficer',
    name: 'Police Officer',
    prompt: POLICE_CAR_RESPONSE_PROMPT,
    interactRadius: NPC_DEFAULT_INTERACT_RADIUS,
    policeOfficerEnabled: true,
    lawRadius: NPC_DEFAULT_LAW_RADIUS,
    speed: NPC_SPEED_TIERS.fast,
    [POLICE_CAR_RESPONSE_FLAG]: true,
    routine: {
      mode: 'loop',
      resumePolicy: 'restart-at-home',
      steps: [
        {
          type: NPC_STEP_TYPES.enterHideAtPlacement,
          targetPlacementId: stationPlacementId,
          hiddenDurationMs: 1000
        }
      ]
    },
    combat: {
      archetype: NPC_COMBAT_ARCHETYPES.police,
      aggroRadius: NPC_DEFAULT_POLICE_AGGRO_RADIUS,
      leashRadius: 54,
      weaponId: WEAPON_IDS.pistol
    },
    respawnDelayMs: 0,
    spawnPosition: position,
    spawnRotationQuarterTurns: rotationQuarterTurns
  }, {
    position,
    rotationQuarterTurns
  });
}

export function createPoliceCarResponseNpcPlacement(definition = null, runtime = null) {
  if (!definition?.id) {
    return null;
  }

  const x = Number(runtime?.x ?? definition.position?.[0] ?? definition.spawnPosition?.[0]);
  const z = Number(runtime?.z ?? definition.position?.[1] ?? definition.spawnPosition?.[1]);
  const rotationY = Number(runtime?.rotationY);
  const rotationQuarterTurns = Number.isFinite(rotationY)
    ? normalizeRotationQuarterTurns(rotationRadiansToQuarterTurns(rotationY))
    : normalizeRotationQuarterTurns(definition.spawnRotationQuarterTurns ?? 0);
  return {
    id: definition.id,
    layer: 'npc',
    modelId: 'policeOfficer',
    position: [
      quantizePosition(Number.isFinite(x) ? x : 0),
      quantizePosition(Number.isFinite(z) ? z : 0)
    ],
    rotationQuarterTurns,
    name: definition.name,
    prompt: definition.prompt,
    interactRadius: definition.interactRadius,
    policeOfficerEnabled: true,
    lawRadius: definition.lawRadius,
    speed: definition.speed,
    routine: definition.routine,
    combat: definition.combat,
    respawnDelayMs: definition.respawnDelayMs,
    spawnPosition: definition.spawnPosition,
    spawnRotationQuarterTurns: definition.spawnRotationQuarterTurns
  };
}
