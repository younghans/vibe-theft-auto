import { WEAPON_IDS } from '../shared/combatConstants.js';

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
  flee: 'flee',
  hostile: 'hostile'
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
export const NPC_DEFAULT_WANDER_RADIUS = 7;
export const NPC_DEFAULT_AGGRO_RADIUS = 16;
export const NPC_DEFAULT_LEASH_RADIUS = 24;
export const NPC_DEFAULT_FLEE_HEALTH_THRESHOLD = 35;
export const NPC_DEFAULT_IDLE_MIN_MS = 900;
export const NPC_DEFAULT_IDLE_MAX_MS = 2200;
export const NPC_DEFAULT_WANDER_IDLE_MIN_MS = 1200;
export const NPC_DEFAULT_WANDER_IDLE_MAX_MS = 2800;
export const NPC_DEFAULT_RESPAWN_DELAY_MS = 15000;

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
    fleeHealthThreshold: combat.fleeHealthThreshold,
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
    fleeHealthThreshold: NPC_DEFAULT_FLEE_HEALTH_THRESHOLD,
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
      radius: Number(clampPositiveNumber(draft.radius, NPC_DEFAULT_WANDER_RADIUS, { min: 1, max: 30 }).toFixed(2))
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
      radius: Number(clampPositiveNumber(draft.radius, NPC_DEFAULT_WANDER_RADIUS, { min: 1, max: 30 }).toFixed(2))
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

export function normalizeNpcCombat(combat = null) {
  const draft = combat && typeof combat === 'object'
    ? combat
    : {};
  const requestedArchetype = draft.archetype === 'guard'
    ? NPC_COMBAT_ARCHETYPES.hostile
    : draft.archetype;
  const archetype = Object.values(NPC_COMBAT_ARCHETYPES).includes(requestedArchetype)
    ? requestedArchetype
    : NPC_COMBAT_ARCHETYPES.passive;
  const defaultWeaponId = archetype === NPC_COMBAT_ARCHETYPES.hostile
    ? WEAPON_IDS.pistol
    : '';

  return {
    archetype,
    aggroRadius: Number(clampPositiveNumber(draft.aggroRadius, NPC_DEFAULT_AGGRO_RADIUS, { min: 2, max: 80 }).toFixed(2)),
    leashRadius: Number(clampPositiveNumber(draft.leashRadius, NPC_DEFAULT_LEASH_RADIUS, { min: 0, max: 120 }).toFixed(2)),
    fleeHealthThreshold: Math.round(clampPositiveNumber(draft.fleeHealthThreshold, NPC_DEFAULT_FLEE_HEALTH_THRESHOLD, { min: 1, max: NPC_DEFAULT_MAX_HEALTH })),
    weaponId: normalizeWeaponId(draft.weaponId, defaultWeaponId)
  };
}

export function createDefaultNpcBehavior(overrides = {}) {
  return {
    routine: createDefaultNpcRoutine(),
    combat: createDefaultNpcCombat(),
    respawnDelayMs: NPC_DEFAULT_RESPAWN_DELAY_MS,
    ...overrides
  };
}

export function cloneNpcBehavior(npc = null) {
  return {
    ...(npc ?? {}),
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
        Number(Number(npc.spawnPosition[0] ?? defaults.position?.[0] ?? 0).toFixed(2)),
        Number(Number(npc.spawnPosition[1] ?? defaults.position?.[1] ?? 0).toFixed(2))
      ]
    : [
        Number(Number(defaults.position?.[0] ?? 0).toFixed(2)),
        Number(Number(defaults.position?.[1] ?? 0).toFixed(2))
      ];

  return {
    ...npc,
    routine: normalizeNpcRoutine(npc.routine),
    combat: normalizeNpcCombat(npc.combat),
    respawnDelayMs: Math.round(clampPositiveNumber(npc.respawnDelayMs, NPC_DEFAULT_RESPAWN_DELAY_MS, { min: 0, max: 600000 })),
    spawnPosition,
    spawnRotationQuarterTurns: ((Math.round(Number(npc.spawnRotationQuarterTurns ?? defaults.rotationQuarterTurns ?? 0)) % 4) + 4) % 4
  };
}

export function listNpcStepTypes() {
  return Object.values(NPC_STEP_TYPES);
}

export function listNpcCombatArchetypes() {
  return [
    NPC_COMBAT_ARCHETYPES.passive,
    NPC_COMBAT_ARCHETYPES.flee,
    NPC_COMBAT_ARCHETYPES.hostile
  ];
}
