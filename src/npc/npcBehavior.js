import { WEAPON_IDS } from '../shared/combatConstants.js';
import { normalizeDeliveryQuestEnabled } from '../shared/deliveryQuest.js';
import { normalizeGymCheckInEnabled } from '../shared/gymMembership.js';
import { normalizeRentCollectorEnabled } from '../shared/rentIntro.js';
import { normalizeStockMarketEnabled } from '../shared/stockMarket.js';
import { isBlackjackDealerNpc } from '../shared/blackjack.js';
import {
  SCHOOL_MICROGAME_ALL_ID,
  isSchoolMicrogameNpc,
  normalizeSchoolMicrogameNpcId
} from '../shared/schoolMicrogames.js';
import { normalizeRotationQuarterTurns, quantizeNumber, quantizePosition } from '../shared/numberMath.js';

export const NPC_ROUTINE_MODES = Object.freeze({
  loop: 'loop'
});

export const NPC_STEP_TYPES = Object.freeze({
  travelToPlacement: 'travelToPlacement',
  usePlacement: 'usePlacement',
  loiterNearPlacement: 'loiterNearPlacement',
  enterHideAtPlacement: 'enterHideAtPlacement',
  wanderNearPlacement: 'wanderNearPlacement'
});

export const NPC_COMBAT_ARCHETYPES = Object.freeze({
  passive: 'passive',
  hostile: 'hostile'
});

export const NPC_SPEED_TIERS = Object.freeze({
  slow: 'slow',
  fast: 'fast'
});

export const NPC_RUNTIME_MODES = Object.freeze({
  routine: 'routine',
  combat: 'combat',
  flee: 'flee',
  hidden: 'hidden',
  dead: 'dead'
});

export const NPC_DEFAULT_MAX_HEALTH = 100;
export const NPC_DEFAULT_MOVE_SPEED = 4.8;
export const NPC_DEFAULT_CALM_MS = 5500;
export const NPC_DEFAULT_HIDE_DURATION_MS = 6000;
export const NPC_DEFAULT_USE_DURATION_MS = 3500;
export const NPC_DEFAULT_LOITER_DURATION_MS = 5000;
export const NPC_DEFAULT_WANDER_DURATION_MS = 7000;
export const NPC_DEFAULT_INTERACT_RADIUS = 10;
export const NPC_DEFAULT_WANDER_RADIUS = 7;
export const NPC_DEFAULT_AGGRO_RADIUS = 16;
export const NPC_DEFAULT_LEASH_RADIUS = 24;
export const NPC_DEFAULT_IDLE_MIN_MS = 900;
export const NPC_DEFAULT_IDLE_MAX_MS = 2200;
export const NPC_DEFAULT_WANDER_IDLE_MIN_MS = 1200;
export const NPC_DEFAULT_WANDER_IDLE_MAX_MS = 2800;
export const NPC_DEFAULT_RESPAWN_DELAY_MS = 15000;
export const NPC_DEFAULT_SPEED_TIER = NPC_SPEED_TIERS.slow;
export const NPC_SLOW_RUN_SPEED = 8.8;
export const NPC_FAST_RUN_SPEED = 15;
export const NPC_ACTIVITY_MIN_DURATIONS_MS = Object.freeze({
  snatch: 5435
});

function clampPositiveNumber(value, fallback, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numeric));
}

function sanitizeTargetPlacementId(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function normalizeWeaponId(value, fallback = '') {
  const normalized = typeof value === 'string'
    ? value.trim()
    : '';

  if (!normalized || normalized === 'none') {
    return '';
  }

  return normalized === WEAPON_IDS.pistol
    ? normalized
    : fallback;
}

export function normalizeNpcSpeedTier(value, fallback = NPC_DEFAULT_SPEED_TIER) {
  return Object.values(NPC_SPEED_TIERS).includes(value)
    ? value
    : fallback;
}

export function getNpcRunSpeed(speedTier = NPC_DEFAULT_SPEED_TIER) {
  return normalizeNpcSpeedTier(speedTier) === NPC_SPEED_TIERS.fast
    ? NPC_FAST_RUN_SPEED
    : NPC_SLOW_RUN_SPEED;
}

export function getNpcUsePlacementDurationMs(step = null, target = null) {
  const configuredDurationMs = Math.max(
    500,
    Math.floor(Number(step?.durationMs ?? 0) || NPC_DEFAULT_USE_DURATION_MS)
  );
  const activityKey = typeof target?.workoutType === 'string' && target.workoutType.trim()
    ? target.workoutType.trim()
    : '';
  const minimumActivityDurationMs = Math.max(
    0,
    Math.floor(Number(NPC_ACTIVITY_MIN_DURATIONS_MS[activityKey] ?? 0) || 0)
  );

  return Math.max(configuredDurationMs, minimumActivityDurationMs);
}

export function cloneNpcRoutineStep(step = null) {
  if (!step || typeof step !== 'object') {
    return null;
  }

  return {
    ...step
  };
}

export function cloneNpcRoutine(routine = null) {
  if (!routine || typeof routine !== 'object') {
    return createDefaultNpcRoutine();
  }

  return {
    mode: routine.mode ?? NPC_ROUTINE_MODES.loop,
    resumePolicy: routine.resumePolicy ?? 'resume-step',
    steps: (routine.steps ?? [])
      .map((step) => cloneNpcRoutineStep(step))
      .filter(Boolean)
  };
}

export function cloneNpcCombat(combat = null) {
  if (!combat || typeof combat !== 'object') {
    return createDefaultNpcCombat();
  }

  return {
    archetype: combat.archetype ?? NPC_COMBAT_ARCHETYPES.passive,
    aggroRadius: combat.aggroRadius,
    leashRadius: combat.leashRadius,
    weaponId: combat.weaponId ?? ''
  };
}

export function createDefaultNpcRoutineStep(type = NPC_STEP_TYPES.travelToPlacement, overrides = {}) {
  switch (type) {
    case NPC_STEP_TYPES.usePlacement:
      return {
        type,
        targetPlacementId: '',
        durationMs: NPC_DEFAULT_USE_DURATION_MS,
        ...overrides
      };
    case NPC_STEP_TYPES.loiterNearPlacement:
      return {
        type,
        targetPlacementId: '',
        durationMs: NPC_DEFAULT_LOITER_DURATION_MS,
        radius: NPC_DEFAULT_WANDER_RADIUS,
        ...overrides
      };
    case NPC_STEP_TYPES.enterHideAtPlacement:
      return {
        type,
        targetPlacementId: '',
        hiddenDurationMs: NPC_DEFAULT_HIDE_DURATION_MS,
        ...overrides
      };
    case NPC_STEP_TYPES.wanderNearPlacement:
      return {
        type,
        targetPlacementId: '',
        durationMs: NPC_DEFAULT_WANDER_DURATION_MS,
        radius: NPC_DEFAULT_WANDER_RADIUS,
        ...overrides
      };
    case NPC_STEP_TYPES.travelToPlacement:
    default:
      return {
        type: NPC_STEP_TYPES.travelToPlacement,
        targetPlacementId: '',
        ...overrides
      };
  }
}

export function createDefaultNpcRoutine(overrides = {}) {
  return {
    mode: NPC_ROUTINE_MODES.loop,
    resumePolicy: 'resume-step',
    steps: [],
    ...overrides
  };
}

export function createDefaultNpcCombat(overrides = {}) {
  return {
    archetype: NPC_COMBAT_ARCHETYPES.passive,
    aggroRadius: NPC_DEFAULT_AGGRO_RADIUS,
    leashRadius: NPC_DEFAULT_LEASH_RADIUS,
    weaponId: '',
    ...overrides
  };
}

export function normalizeNpcRoutineStep(step = null) {
  const draft = step && typeof step === 'object'
    ? step
    : {};
  const type = Object.values(NPC_STEP_TYPES).includes(draft.type)
    ? draft.type
    : NPC_STEP_TYPES.travelToPlacement;

  if (type === NPC_STEP_TYPES.usePlacement) {
    return {
      type,
      targetPlacementId: sanitizeTargetPlacementId(draft.targetPlacementId),
      durationMs: Math.round(clampPositiveNumber(draft.durationMs, NPC_DEFAULT_USE_DURATION_MS, { min: 500, max: 60000 }))
    };
  }

  if (type === NPC_STEP_TYPES.loiterNearPlacement) {
    return {
      type,
      targetPlacementId: sanitizeTargetPlacementId(draft.targetPlacementId),
      durationMs: Math.round(clampPositiveNumber(draft.durationMs, NPC_DEFAULT_LOITER_DURATION_MS, { min: 500, max: 60000 })),
      radius: quantizeNumber(clampPositiveNumber(draft.radius, NPC_DEFAULT_WANDER_RADIUS, { min: 1, max: 30 }), 2)
    };
  }

  if (type === NPC_STEP_TYPES.enterHideAtPlacement) {
    return {
      type,
      targetPlacementId: sanitizeTargetPlacementId(draft.targetPlacementId),
      hiddenDurationMs: Math.round(clampPositiveNumber(draft.hiddenDurationMs, NPC_DEFAULT_HIDE_DURATION_MS, { min: 500, max: 120000 }))
    };
  }

  if (type === NPC_STEP_TYPES.wanderNearPlacement) {
    return {
      type,
      targetPlacementId: sanitizeTargetPlacementId(draft.targetPlacementId),
      durationMs: Math.round(clampPositiveNumber(draft.durationMs, NPC_DEFAULT_WANDER_DURATION_MS, { min: 500, max: 120000 })),
      radius: quantizeNumber(clampPositiveNumber(draft.radius, NPC_DEFAULT_WANDER_RADIUS, { min: 1, max: 30 }), 2)
    };
  }

  return {
    type: NPC_STEP_TYPES.travelToPlacement,
    targetPlacementId: sanitizeTargetPlacementId(draft.targetPlacementId)
  };
}

export function normalizeNpcRoutine(routine = null) {
  const draft = routine && typeof routine === 'object'
    ? routine
    : {};

  return {
    mode: draft.mode === NPC_ROUTINE_MODES.loop
      ? draft.mode
      : NPC_ROUTINE_MODES.loop,
    resumePolicy: typeof draft.resumePolicy === 'string' && draft.resumePolicy.trim()
      ? draft.resumePolicy.trim()
      : 'resume-step',
    steps: (draft.steps ?? [])
      .map((step) => normalizeNpcRoutineStep(step))
      .filter(Boolean)
  };
}

function getNpcRoutineRuntimeStructure(routine = null) {
  const normalizedRoutine = normalizeNpcRoutine(routine);
  return {
    mode: normalizedRoutine.mode,
    resumePolicy: normalizedRoutine.resumePolicy,
    steps: normalizedRoutine.steps.map((step) => ({
      type: step.type,
      targetPlacementId: step.targetPlacementId ?? ''
    }))
  };
}

export function shouldResetNpcRuntimeForBehaviorUpdate(previousNpc = null, nextNpc = null, updates = {}) {
  if (Object.keys(updates ?? {}).length === 1 && Object.hasOwn(updates, 'routine')) {
    return JSON.stringify(getNpcRoutineRuntimeStructure(previousNpc?.routine))
      !== JSON.stringify(getNpcRoutineRuntimeStructure(nextNpc?.routine));
  }

  if (
    Object.keys(updates ?? {}).length === 1
    && (
      Object.hasOwn(updates, 'deliveryQuestEnabled')
      || Object.hasOwn(updates, 'gymCheckInEnabled')
      || Object.hasOwn(updates, 'rentCollectorEnabled')
      || Object.hasOwn(updates, 'stockMarketEnabled')
      || Object.hasOwn(updates, 'blackjackDealerEnabled')
      || Object.hasOwn(updates, 'schoolMicrogameEnabled')
      || Object.hasOwn(updates, 'schoolMicrogameId')
    )
  ) {
    return false;
  }

  return true;
}

export function normalizeNpcCombat(combat = null) {
  const draft = combat && typeof combat === 'object'
    ? combat
    : {};
  const requestedArchetype = draft.archetype === 'guard'
    ? NPC_COMBAT_ARCHETYPES.hostile
    : draft.archetype === 'flee'
      ? NPC_COMBAT_ARCHETYPES.passive
      : draft.archetype;
  const archetype = Object.values(NPC_COMBAT_ARCHETYPES).includes(requestedArchetype)
    ? requestedArchetype
    : NPC_COMBAT_ARCHETYPES.passive;
  const defaultWeaponId = archetype === NPC_COMBAT_ARCHETYPES.hostile
    ? WEAPON_IDS.pistol
    : '';

  return {
    archetype,
    aggroRadius: quantizeNumber(clampPositiveNumber(draft.aggroRadius, NPC_DEFAULT_AGGRO_RADIUS, { min: 2, max: 80 }), 2),
    leashRadius: quantizeNumber(clampPositiveNumber(draft.leashRadius, NPC_DEFAULT_LEASH_RADIUS, { min: 0, max: 120 }), 2),
    weaponId: normalizeWeaponId(draft.weaponId, defaultWeaponId)
  };
}

export function createDefaultNpcBehavior(overrides = {}) {
  return {
    routine: createDefaultNpcRoutine(),
    combat: createDefaultNpcCombat(),
    respawnDelayMs: NPC_DEFAULT_RESPAWN_DELAY_MS,
    speed: NPC_DEFAULT_SPEED_TIER,
    deliveryQuestEnabled: false,
    gymCheckInEnabled: false,
    rentCollectorEnabled: false,
    stockMarketEnabled: false,
    blackjackDealerEnabled: false,
    schoolMicrogameEnabled: false,
    schoolMicrogameId: SCHOOL_MICROGAME_ALL_ID,
    ...overrides
  };
}

export function cloneNpcBehavior(npc = null) {
  return {
    ...(npc ?? {}),
    active: true,
    routine: cloneNpcRoutine(npc?.routine),
    combat: cloneNpcCombat(npc?.combat),
    spawnPosition: Array.isArray(npc?.spawnPosition)
      ? [...npc.spawnPosition]
      : null
  };
}

export function normalizeNpcBehavior(npc = {}, defaults = {}) {
  const spawnPosition = Array.isArray(npc.spawnPosition) && npc.spawnPosition.length >= 2
    ? [
        quantizePosition(npc.spawnPosition[0] ?? defaults.position?.[0] ?? 0),
        quantizePosition(npc.spawnPosition[1] ?? defaults.position?.[1] ?? 0)
      ]
    : [
        quantizePosition(defaults.position?.[0] ?? 0),
        quantizePosition(defaults.position?.[1] ?? 0)
      ];

  return {
    ...npc,
    active: true,
    routine: normalizeNpcRoutine(npc.routine),
    combat: normalizeNpcCombat(npc.combat),
    respawnDelayMs: Math.round(clampPositiveNumber(npc.respawnDelayMs, NPC_DEFAULT_RESPAWN_DELAY_MS, { min: 0, max: 600000 })),
    speed: normalizeNpcSpeedTier(npc.speed),
    deliveryQuestEnabled: normalizeDeliveryQuestEnabled(npc.deliveryQuestEnabled),
    gymCheckInEnabled: normalizeGymCheckInEnabled(npc.gymCheckInEnabled ?? (npc.modelId === 'remy')),
    rentCollectorEnabled: normalizeRentCollectorEnabled(npc.rentCollectorEnabled),
    stockMarketEnabled: normalizeStockMarketEnabled(npc.stockMarketEnabled),
    blackjackDealerEnabled: isBlackjackDealerNpc(npc),
    schoolMicrogameEnabled: isSchoolMicrogameNpc(npc),
    schoolMicrogameId: normalizeSchoolMicrogameNpcId(npc.schoolMicrogameId),
    spawnPosition,
    spawnRotationQuarterTurns: normalizeRotationQuarterTurns(
      npc.spawnRotationQuarterTurns ?? defaults.rotationQuarterTurns ?? 0
    )
  };
}

export function listNpcStepTypes() {
  return Object.values(NPC_STEP_TYPES);
}

export function listNpcCombatArchetypes() {
  return [
    NPC_COMBAT_ARCHETYPES.passive,
    NPC_COMBAT_ARCHETYPES.hostile
  ];
}

export function listNpcSpeedTiers() {
  return Object.values(NPC_SPEED_TIERS);
}
