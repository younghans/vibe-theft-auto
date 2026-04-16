import {
  PUNCH_INTERVAL_MS,
  PUNCH_RANGE,
  WEAPON_FIRE_INTERVAL_MS,
  WEAPON_IDS,
  WEAPON_RANGE
} from '../shared/combatConstants.js';
import { distance2D } from '../shared/combatMath.js';
import {
  NPC_COMBAT_ARCHETYPES,
  NPC_DEFAULT_CALM_MS,
  NPC_DEFAULT_IDLE_MAX_MS,
  NPC_DEFAULT_IDLE_MIN_MS,
  NPC_DEFAULT_MAX_HEALTH,
  NPC_DEFAULT_MOVE_SPEED,
  NPC_DEFAULT_WANDER_IDLE_MAX_MS,
  NPC_DEFAULT_WANDER_IDLE_MIN_MS,
  NPC_RUNTIME_MODES,
  NPC_STEP_TYPES,
  getNpcUsePlacementDurationMs,
  getNpcRunSpeed
} from './npcBehavior.js';
import {
  buildNpcPathToPlacement,
  buildNpcPathToPosition,
  findFarthestRouteNodeFrom
} from './npcRouteGraph.js';
import {
  collectNpcTargetOptions,
  resolveNpcTargetOption
} from './npcTargeting.js';

const NPC_REPATH_MS = 900;
const NPC_SHOT_INTERVAL_MS = WEAPON_FIRE_INTERVAL_MS * 2;
const NPC_PUNCH_INTERVAL_MS = PUNCH_INTERVAL_MS * 2;
const NPC_COMBAT_REACH_BUFFER = 1.2;
const NPC_TARGET_STOP_DISTANCE = 0.7;
const NPC_PATH_TURN_LOOKAHEAD_DISTANCE = 3.6;
const NPC_PATH_TURN_BLEND_MAX = 0.26;
const NPC_PATH_TURN_MIN_ANGLE_DOT = 0.92;

function normalizeRotationQuarterTurns(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return ((Math.round(numeric) % 4) + 4) % 4;
}

function quantizePosition(value) {
  const numeric = Number(value ?? 0);
  return Number((Number.isFinite(numeric) ? numeric : 0).toFixed(2));
}

function quantizeRotation(value) {
  const numeric = Number(value ?? 0);
  return Number((Number.isFinite(numeric) ? numeric : 0).toFixed(3));
}

function toRotationY(rotationQuarterTurns = 0) {
  return normalizeRotationQuarterTurns(rotationQuarterTurns) * (Math.PI / 2);
}

function quantizeRotationQuarterTurnsFromRotationY(rotationY) {
  return normalizeRotationQuarterTurns(Math.round(Number(rotationY ?? 0) / (Math.PI / 2)));
}

function clonePoint(point = null) {
  if (!point) {
    return null;
  }

  return {
    x: quantizePosition(point.x),
    z: quantizePosition(point.z)
  };
}

function randomBetween(min, max) {
  const safeMin = Math.max(0, Number(min) || 0);
  const safeMax = Math.max(safeMin, Number(max) || safeMin);
  return Math.round(safeMin + (Math.random() * (safeMax - safeMin)));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function smoothstep(value) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - (2 * clamped));
}

function cloneDebugPath(points = []) {
  return points.map((point) => clonePoint(point)).filter(Boolean);
}

function getDefinitionStore(host) {
  return host.npcDefinitions ?? host.definitions ?? null;
}

export function createNpcRuntimeMeta(overrides = {}) {
  return {
    path: [],
    pathIndex: 0,
    pathKey: '',
    lastRepathAt: 0,
    stepStartedAt: 0,
    idleUntil: 0,
    calmEndsAt: 0,
    lastAttackAt: 0,
    wanderPoint: null,
    combatAnchor: null,
    ...overrides
  };
}

export const npcSimulationMethods = {
  getNpcRuntimeMeta(npcId) {
    if (!this.npcRuntimeMeta.has(npcId)) {
      this.npcRuntimeMeta.set(npcId, createNpcRuntimeMeta());
    }

    return this.npcRuntimeMeta.get(npcId);
  },

  clearNpcPath(npcId) {
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.path = [];
    meta.pathIndex = 0;
    meta.pathKey = '';
    meta.wanderPoint = null;
  },

  beginNpcIdlePause(npcId, now, {
    minMs = NPC_DEFAULT_IDLE_MIN_MS,
    maxMs = NPC_DEFAULT_IDLE_MAX_MS
  } = {}) {
    const meta = this.getNpcRuntimeMeta(npcId);
    if ((meta.idleUntil ?? 0) > 0) {
      return meta.idleUntil;
    }

    meta.idleUntil = now + randomBetween(minMs, maxMs);
    return meta.idleUntil;
  },

  isNpcIdling(npcId, now) {
    const meta = this.getNpcRuntimeMeta(npcId);
    return (meta.idleUntil ?? 0) > now;
  },

  clearNpcIdlePause(npcId) {
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.idleUntil = 0;
  },

  resetNpcRuntimeState(npcId, {
    restartFromSpawn = false,
    reason = 'runtime-reset'
  } = {}) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.getNpcDefinition(npcId);
    if (!npc || !definition) {
      return;
    }

    const meta = this.getNpcRuntimeMeta(npcId);
    meta.path = [];
    meta.pathIndex = 0;
    meta.pathKey = '';
    meta.lastRepathAt = 0;
    meta.stepStartedAt = 0;
    meta.idleUntil = 0;
    meta.calmEndsAt = 0;
    meta.lastAttackAt = 0;
    meta.wanderPoint = null;
    meta.combatAnchor = null;

    npc.currentStepIndex = 0;
    npc.targetPlacementId = '';
    npc.activity = '';
    npc.hiddenUntil = 0;
    npc.lastAttackerId = '';
    npc.busy = false;
    npc.mode = npc.alive === false ? NPC_RUNTIME_MODES.dead : NPC_RUNTIME_MODES.routine;

    if (restartFromSpawn) {
      const spawnPoint = this.getNpcSpawnPoint(definition);
      npc.x = quantizePosition(spawnPoint.x);
      npc.z = quantizePosition(spawnPoint.z);
      npc.rotationY = quantizeRotation(toRotationY(definition.spawnRotationQuarterTurns ?? 0));
      npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
      this.syncNpcDerivedState?.(npc);
    }

    this.logNpcDebugEvent?.(npcId, 'runtime-reset', {
      reason,
      restartFromSpawn
    });
  },

  finishNpcRespawn(npcId, npc, definition, now = Date.now()) {
    if (!npc || !definition) {
      return false;
    }

    const respawnTarget = this.getNpcRespawnTarget(definition);
    const respawnPosition = respawnTarget.position ?? this.getNpcSpawnPoint(definition);
    npc.maxHealth = Math.max(1, Number(definition?.combat?.maxHealth ?? npc.maxHealth ?? NPC_DEFAULT_MAX_HEALTH));
    npc.health = npc.maxHealth;
    npc.alive = true;
    npc.respawnAt = 0;
    npc.active = definition.active !== false;
    npc.lastDamagedAt = 0;
    npc.lastAttackerId = '';
    npc.hiddenUntil = 0;
    npc.activity = '';
    npc.busy = false;
    npc.chatStatus = 'idle';
    npc.chatText = '';
    npc.chatStartedAt = 0;
    npc.weaponId = definition.combat?.weaponId ?? '';
    npc.x = quantizePosition(respawnPosition.x);
    npc.z = quantizePosition(respawnPosition.z);
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? toRotationY(definition.spawnRotationQuarterTurns ?? 0));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    this.syncNpcDerivedState?.(npc);
    this.resetNpcRuntimeState(npcId, { restartFromSpawn: false, reason: 'npc-respawned' });
    npc.x = quantizePosition(respawnPosition.x);
    npc.z = quantizePosition(respawnPosition.z);
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? npc.rotationY);
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    npc.mode = npc.active === false ? NPC_RUNTIME_MODES.dead : NPC_RUNTIME_MODES.routine;
    npc.targetPlacementId = '';
    npc.activity = '';
    npc.respawnAt = 0;
    this.syncNpcDerivedState?.(npc);
    this.logNpcDebugEvent?.(npcId, 'respawned', {
      placementId: respawnTarget.placementId,
      source: respawnTarget.source,
      x: npc.x,
      z: npc.z,
      respawnDelayMs: Math.max(0, Number(definition.respawnDelayMs ?? 0)),
      now
    });
    this.emitNpcCombatEvent?.({
      type: 'respawn',
      victimId: npcId,
      victimType: 'npc',
      x: npc.x,
      z: npc.z,
      placementId: respawnTarget.placementId ?? ''
    });
    return true;
  },

  getNpcDefinition(npcId) {
    const definitions = getDefinitionStore(this);
    return definitions?.get(npcId) ?? null;
  },

  getNpcSpawnPoint(definition) {
    const position = definition?.spawnPosition ?? definition?.position ?? [0, 0];
    return {
      x: quantizePosition(position[0]),
      z: quantizePosition(position[1])
    };
  },

  getNpcHomeAnchor(definition) {
    const routineSteps = definition?.routine?.steps ?? [];
    for (const step of routineSteps) {
      if (step?.type !== NPC_STEP_TYPES.enterHideAtPlacement) {
        continue;
      }

      const target = this.getNpcTargetOption(step.targetPlacementId);
      if (target?.approachPosition) {
        return clonePoint(target.approachPosition);
      }
    }

    return this.getNpcSpawnPoint(definition);
  },

  getNpcRespawnTarget(definition) {
    const spawnPoint = this.getNpcSpawnPoint(definition);
    const spawnRotationQuarterTurns = normalizeRotationQuarterTurns(
      definition?.spawnRotationQuarterTurns ?? definition?.rotationQuarterTurns ?? 0
    );
    const routineSteps = definition?.routine?.steps ?? [];

    for (const step of routineSteps) {
      if (step?.type !== NPC_STEP_TYPES.enterHideAtPlacement || !step.targetPlacementId) {
        continue;
      }

      const placement = this.worldState.getPlacement(step.targetPlacementId);
      const target = placement ? resolveNpcTargetOption(placement, undefined, this.worldState) : null;
      if (!placement || !target?.approachPosition) {
        continue;
      }

      return {
        placementId: placement.id,
        source: 'enterHideAtPlacement',
        position: clonePoint(target.approachPosition) ?? spawnPoint,
        rotationY: quantizeRotation(toRotationY(placement.rotationQuarterTurns ?? 0))
      };
    }

    const buildingTargets = collectNpcTargetOptions(this.worldState)
      .filter((entry) => entry.hideCapable && entry.approachPosition);
    let nearestBuildingTarget = null;
    let nearestDistance = Infinity;
    for (const target of buildingTargets) {
      const distance = distance2D(
        spawnPoint.x,
        spawnPoint.z,
        target.approachPosition.x,
        target.approachPosition.z
      );
      if (distance >= nearestDistance) {
        continue;
      }
      nearestBuildingTarget = target;
      nearestDistance = distance;
    }

    if (nearestBuildingTarget) {
      const placement = this.worldState.getPlacement(nearestBuildingTarget.placementId);
      return {
        placementId: nearestBuildingTarget.placementId,
        source: 'nearestBuilding',
        position: clonePoint(nearestBuildingTarget.approachPosition) ?? spawnPoint,
        rotationY: quantizeRotation(toRotationY(placement?.rotationQuarterTurns ?? 0))
      };
    }

    return {
      placementId: '',
      source: 'spawn',
      position: spawnPoint,
      rotationY: quantizeRotation(toRotationY(spawnRotationQuarterTurns))
    };
  },

  getNpcTargetOption(targetPlacementId = '') {
    const placement = this.worldState.getPlacement(targetPlacementId);
    return placement ? resolveNpcTargetOption(placement, undefined, this.worldState) : null;
  },

  isWorkoutPlacementOccupied(targetPlacementId = '', {
    ignoreNpcId = '',
    ignorePlayerId = ''
  } = {}) {
    if (!targetPlacementId) {
      return false;
    }

    const target = this.getNpcTargetOption(targetPlacementId);
    if (!target?.workoutType) {
      return false;
    }

    for (const [playerId, player] of this.state.players.entries()) {
      if (
        playerId !== ignorePlayerId
        && player?.alive !== false
        && player?.workoutPlacementId === targetPlacementId
      ) {
        return true;
      }
    }

    for (const [npcId, npc] of this.state.npcs.entries()) {
      if (
        npcId !== ignoreNpcId
        && npc?.alive !== false
        && npc?.mode !== NPC_RUNTIME_MODES.hidden
        && npc?.targetPlacementId === targetPlacementId
        && npc?.activity === target.workoutType
      ) {
        return true;
      }
    }

    return false;
  },

  getCurrentNpcRoutineStep(definition, npc) {
    const steps = definition?.routine?.steps ?? [];
    if (!steps.length) {
      return null;
    }

    const index = Math.max(0, Math.floor(npc.currentStepIndex ?? 0)) % steps.length;
    return {
      step: steps[index],
      index,
      count: steps.length
    };
  },

  getNpcDebugFinalTarget(npcId, npc, definition) {
    const meta = this.getNpcRuntimeMeta(npcId);
    const routineState = this.getCurrentNpcRoutineStep(definition, npc);
    const currentStep = routineState?.step ?? null;
    const currentTarget = npc.targetPlacementId
      ? this.getNpcTargetOption(npc.targetPlacementId)
      : null;

    if (npc.mode === NPC_RUNTIME_MODES.combat || npc.mode === NPC_RUNTIME_MODES.flee) {
      const targetPlayer = npc.lastAttackerId ? this.state.players.get(npc.lastAttackerId) : null;
      if (targetPlayer?.alive !== false && targetPlayer) {
        return clonePoint({ x: targetPlayer.x, z: targetPlayer.z });
      }

      return clonePoint(this.getNpcHomeAnchor(definition));
    }

    if (npc.mode === NPC_RUNTIME_MODES.hidden) {
      return clonePoint(currentTarget?.approachPosition);
    }

    if (!currentStep) {
      return clonePoint(this.getNpcSpawnPoint(definition));
    }

    if (currentStep.type === NPC_STEP_TYPES.loiterNearPlacement || currentStep.type === NPC_STEP_TYPES.wanderNearPlacement) {
      return clonePoint(meta.wanderPoint ?? currentTarget?.approachPosition ?? this.getNpcSpawnPoint(definition));
    }

    return clonePoint(currentTarget?.approachPosition ?? this.getNpcSpawnPoint(definition));
  },

  buildNpcDebugSnapshotEntry(npcId, npc, definition, now = Date.now()) {
    const meta = this.getNpcRuntimeMeta(npcId);
    const routineState = this.getCurrentNpcRoutineStep(definition, npc);
    const nextPathPoint = meta.path?.[meta.pathIndex] ?? null;
    const finalTarget = this.getNpcDebugFinalTarget(npcId, npc, definition);
    const steeringTarget = nextPathPoint
      ? clonePoint(this.getNpcSteeringTarget(meta.path ?? [], meta.pathIndex ?? 0, npc, nextPathPoint))
      : finalTarget;
    const currentTarget = npc.targetPlacementId
      ? this.getNpcTargetOption(npc.targetPlacementId)
      : null;

    return {
      id: npcId,
      mode: npc.mode,
      activity: npc.activity || '',
      currentStepIndex: routineState?.index ?? Math.max(0, Math.floor(npc.currentStepIndex ?? 0)),
      currentStepType: routineState?.step?.type ?? '',
      stepCount: routineState?.count ?? (definition?.routine?.steps?.length ?? 0),
      targetPlacementId: npc.targetPlacementId || '',
      targetApproach: clonePoint(currentTarget?.approachPosition),
      nextPathPoint: clonePoint(nextPathPoint),
      steeringTarget,
      finalTarget,
      path: cloneDebugPath(meta.path ?? []),
      pathIndex: Math.max(0, Math.floor(meta.pathIndex ?? 0)),
      pathNodeCount: meta.path?.length ?? 0,
      pathKey: meta.pathKey || '',
      lastRepathAt: meta.lastRepathAt ?? 0,
      idleUntil: meta.idleUntil ?? 0,
      calmEndsAt: meta.calmEndsAt ?? 0,
      hiddenUntil: npc.hiddenUntil ?? 0,
      respawnAt: npc.respawnAt ?? 0,
      wanderPoint: clonePoint(meta.wanderPoint),
      stepStartedAt: meta.stepStartedAt ?? 0,
      busy: Boolean(npc.busy),
      alive: npc.alive !== false,
      weaponId: npc.weaponId || '',
      lastAttackerId: npc.lastAttackerId || '',
      debugAgeMs: 0,
      idleRemainingMs: Math.max(0, Math.floor((meta.idleUntil ?? 0) - now)),
      calmRemainingMs: Math.max(0, Math.floor((meta.calmEndsAt ?? 0) - now)),
      hiddenRemainingMs: Math.max(0, Math.floor((npc.hiddenUntil ?? 0) - now)),
      respawnRemainingMs: Math.max(0, Math.floor((npc.respawnAt ?? 0) - now))
    };
  },

  buildNpcDebugSnapshotMap(now = Date.now()) {
    const next = new Map();

    for (const [npcId, npc] of this.state.npcs.entries()) {
      const definition = this.getNpcDefinition(npcId);
      if (!definition) {
        continue;
      }

      next.set(npcId, this.buildNpcDebugSnapshotEntry(npcId, npc, definition, now));
    }

    return next;
  },

  advanceNpcRoutineStep(npcId, npc) {
    const definition = this.getNpcDefinition(npcId);
    const steps = definition?.routine?.steps ?? [];
    npc.currentStepIndex = steps.length
      ? ((Math.max(0, Math.floor(npc.currentStepIndex ?? 0)) + 1) % steps.length)
      : 0;
    npc.targetPlacementId = '';
    npc.activity = '';
    this.clearNpcPath(npcId);
    this.clearNpcIdlePause(npcId);
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.stepStartedAt = 0;
    const nextRoutineState = this.getCurrentNpcRoutineStep(definition, npc);
    this.logNpcDebugEvent?.(npcId, 'step-advanced', {
      currentStepIndex: npc.currentStepIndex,
      nextStepType: nextRoutineState?.step?.type ?? '',
      nextTargetPlacementId: nextRoutineState?.step?.targetPlacementId ?? ''
    });
  },

  setNpcMode(npcId, npc, mode, {
    targetPlacementId = '',
    activity = '',
    hiddenUntil = 0,
    lastAttackerId = npc.lastAttackerId || ''
  } = {}) {
    const previousMode = npc.mode;
    npc.mode = mode;
    npc.targetPlacementId = targetPlacementId;
    npc.activity = activity;
    npc.hiddenUntil = Math.max(0, Math.floor(hiddenUntil));
    npc.lastAttackerId = lastAttackerId;
    if (mode !== NPC_RUNTIME_MODES.hidden) {
      npc.hiddenUntil = 0;
    }
    if (mode !== NPC_RUNTIME_MODES.routine) {
      this.clearNpcIdlePause(npcId);
    }
    if (mode === NPC_RUNTIME_MODES.dead) {
      npc.alive = false;
      npc.health = 0;
      npc.activity = '';
    }

    if (previousMode !== mode) {
      this.logNpcDebugEvent?.(npcId, 'mode-changed', {
        from: previousMode,
        to: mode,
        targetPlacementId: npc.targetPlacementId || '',
        activity: npc.activity || '',
        hiddenUntil: npc.hiddenUntil ?? 0,
        lastAttackerId: npc.lastAttackerId || ''
      });
    }
  },

  ensureNpcPathToPosition(npcId, startPosition, targetPosition, pathKey, now, {
    placementId = '',
    force = false
  } = {}) {
    const meta = this.getNpcRuntimeMeta(npcId);
    if (
      !force
      && meta.pathKey === pathKey
      && meta.path.length
      && (now - meta.lastRepathAt) < NPC_REPATH_MS
    ) {
      return;
    }

    meta.path = placementId
      ? buildNpcPathToPlacement(this.npcRouteGraph, startPosition, placementId)
      : buildNpcPathToPosition(this.npcRouteGraph, startPosition, targetPosition);
    meta.pathIndex = 0;
    meta.pathKey = pathKey;
    meta.lastRepathAt = now;
    this.logNpcDebugEvent?.(npcId, 'path-rebuilt', {
      pathKey,
      placementId,
      targetPosition: clonePoint(targetPosition),
      nodeCount: meta.path.length
    });
  },

  moveNpcAlongPath(npcId, npc, targetPosition, deltaMs, {
    stopDistance = NPC_TARGET_STOP_DISTANCE,
    speed = NPC_DEFAULT_MOVE_SPEED
  } = {}) {
    const meta = this.getNpcRuntimeMeta(npcId);
    const path = meta.path ?? [];
    const finalTarget = targetPosition ?? clonePoint({ x: npc.x, z: npc.z });
    let nextPoint = path[meta.pathIndex] ?? finalTarget;

    while (nextPoint) {
      const reachDistance = meta.pathIndex < path.length
        ? this.getNpcWaypointReachDistance(path, meta.pathIndex, npc, stopDistance)
        : stopDistance;
      if (distance2D(npc.x, npc.z, nextPoint.x, nextPoint.z) > reachDistance) {
        break;
      }

      if (meta.pathIndex < Math.max(0, path.length - 1)) {
        meta.pathIndex += 1;
        nextPoint = path[meta.pathIndex] ?? finalTarget;
        continue;
      }

      if (meta.pathIndex < path.length) {
        meta.pathIndex = path.length;
        nextPoint = finalTarget;
        continue;
      }

      break;
    }

    if (!nextPoint) {
      return true;
    }

    const steeringTarget = this.getNpcSteeringTarget(path, meta.pathIndex, npc, nextPoint);
    const toTargetX = steeringTarget.x - npc.x;
    const toTargetZ = steeringTarget.z - npc.z;
    const distance = Math.hypot(toTargetX, toTargetZ);
    if (distance <= stopDistance) {
      npc.x = quantizePosition(nextPoint.x);
      npc.z = quantizePosition(nextPoint.z);
    } else {
      const maxStep = Math.max(0.1, speed) * (deltaMs / 1000);
      const step = Math.min(distance, maxStep);
      npc.x = quantizePosition(npc.x + (toTargetX / distance) * step);
      npc.z = quantizePosition(npc.z + (toTargetZ / distance) * step);
      npc.rotationY = quantizeRotation(Math.atan2(toTargetX, toTargetZ));
      npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    }

    this.syncNpcDerivedState?.(npc);
    return distance2D(npc.x, npc.z, finalTarget.x, finalTarget.z) <= stopDistance;
  },

  getNpcSteeringTarget(path, pathIndex, npc, nextPoint) {
    const upcomingPoint = path[pathIndex + 1];
    if (!upcomingPoint) {
      return nextPoint;
    }

    const inX = nextPoint.x - npc.x;
    const inZ = nextPoint.z - npc.z;
    const inLength = Math.hypot(inX, inZ);
    const outX = upcomingPoint.x - nextPoint.x;
    const outZ = upcomingPoint.z - nextPoint.z;
    const outLength = Math.hypot(outX, outZ);
    if (inLength <= 0.0001 || outLength <= 0.0001) {
      return nextPoint;
    }

    const inDirX = inX / inLength;
    const inDirZ = inZ / inLength;
    const outDirX = outX / outLength;
    const outDirZ = outZ / outLength;
    const turnDot = (inDirX * outDirX) + (inDirZ * outDirZ);
    if (turnDot >= NPC_PATH_TURN_MIN_ANGLE_DOT) {
      return nextPoint;
    }

    const lookaheadDistance = Math.min(NPC_PATH_TURN_LOOKAHEAD_DISTANCE, outLength * 0.5);
    const anticipation = smoothstep((lookaheadDistance - inLength) / Math.max(0.001, lookaheadDistance));
    if (anticipation <= 0.0001) {
      return nextPoint;
    }

    const turnAmount = clamp01((NPC_PATH_TURN_MIN_ANGLE_DOT - turnDot) / (NPC_PATH_TURN_MIN_ANGLE_DOT + 1));
    const blend = Math.min(
      NPC_PATH_TURN_BLEND_MAX,
      anticipation * turnAmount * NPC_PATH_TURN_BLEND_MAX * 3.1
    );
    if (blend <= 0.0001) {
      return nextPoint;
    }

    return {
      x: nextPoint.x + (upcomingPoint.x - nextPoint.x) * blend,
      z: nextPoint.z + (upcomingPoint.z - nextPoint.z) * blend
    };
  },

  getNpcWaypointReachDistance(path, pathIndex, npc, stopDistance) {
    const nextPoint = path[pathIndex];
    const upcomingPoint = path[pathIndex + 1];
    if (!nextPoint || !upcomingPoint) {
      return stopDistance;
    }

    const inX = nextPoint.x - npc.x;
    const inZ = nextPoint.z - npc.z;
    const inLength = Math.hypot(inX, inZ);
    const outX = upcomingPoint.x - nextPoint.x;
    const outZ = upcomingPoint.z - nextPoint.z;
    const outLength = Math.hypot(outX, outZ);
    if (inLength <= 0.0001 || outLength <= 0.0001) {
      return stopDistance;
    }

    const turnDot = ((inX / inLength) * (outX / outLength)) + ((inZ / inLength) * (outZ / outLength));
    if (turnDot >= NPC_PATH_TURN_MIN_ANGLE_DOT) {
      return stopDistance;
    }

    const lookaheadDistance = Math.min(NPC_PATH_TURN_LOOKAHEAD_DISTANCE, outLength * 0.5);
    const anticipation = smoothstep((lookaheadDistance - inLength) / Math.max(0.001, lookaheadDistance));
    const turnAmount = clamp01((NPC_PATH_TURN_MIN_ANGLE_DOT - turnDot) / (NPC_PATH_TURN_MIN_ANGLE_DOT + 1));
    return stopDistance + (anticipation * turnAmount * 1.8);
  },

  pickNpcWanderPoint(anchorPosition, radius = 6, npcId = '') {
    const angleSeed = (Date.now() / 1000) + npcId.length;
    const angle = angleSeed % (Math.PI * 2);
    const distance = Math.max(1, Number(radius) || 6) * 0.68;
    return {
      x: quantizePosition(anchorPosition.x + Math.cos(angle) * distance),
      z: quantizePosition(anchorPosition.z + Math.sin(angle) * distance)
    };
  },

  updateNpcRoutine(npcId, npc, definition, now, deltaMs) {
    const routineState = this.getCurrentNpcRoutineStep(definition, npc);
    if (!routineState?.step) {
      this.clearNpcPath(npcId);
      return false;
    }

    const { step } = routineState;
    const target = this.getNpcTargetOption(step.targetPlacementId);
    const meta = this.getNpcRuntimeMeta(npcId);
    const targetAnchor = target?.approachPosition ?? this.getNpcSpawnPoint(definition);

    if (!target && step.targetPlacementId) {
      this.logNpcDebugEvent?.(npcId, 'missing-target-skip-step', {
        stepType: step.type,
        targetPlacementId: step.targetPlacementId
      });
      this.advanceNpcRoutineStep(npcId, npc);
      return true;
    }

    npc.targetPlacementId = step.targetPlacementId ?? '';

    if (step.type === NPC_STEP_TYPES.travelToPlacement) {
      this.ensureNpcPathToPosition(
        npcId,
        { x: npc.x, z: npc.z },
        targetAnchor,
        `travel:${npc.targetPlacementId}`,
        now,
        { placementId: npc.targetPlacementId }
      );
      const arrived = this.moveNpcAlongPath(npcId, npc, targetAnchor, deltaMs);
      npc.activity = '';
      if (arrived) {
        this.beginNpcIdlePause(npcId, now);
        if (this.isNpcIdling(npcId, now)) {
          return true;
        }
        this.clearNpcIdlePause(npcId);
        this.advanceNpcRoutineStep(npcId, npc);
      }
      return true;
    }

    if (step.type === NPC_STEP_TYPES.enterHideAtPlacement) {
      this.ensureNpcPathToPosition(
        npcId,
        { x: npc.x, z: npc.z },
        targetAnchor,
        `hide:${npc.targetPlacementId}`,
        now,
        { placementId: npc.targetPlacementId }
      );
      const arrived = this.moveNpcAlongPath(npcId, npc, targetAnchor, deltaMs);
      npc.activity = '';
      if (arrived) {
        this.beginNpcIdlePause(npcId, now);
        if (this.isNpcIdling(npcId, now)) {
          return true;
        }
        this.clearNpcIdlePause(npcId);
        const hiddenDurationMs = Math.max(500, Math.floor(Number(step.hiddenDurationMs ?? 0) || 0));
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.hidden, {
          targetPlacementId: npc.targetPlacementId,
          hiddenUntil: now + hiddenDurationMs
        });
        this.clearNpcPath(npcId);
      }
      return true;
    }

    if (step.type === NPC_STEP_TYPES.usePlacement) {
      const useDurationMs = getNpcUsePlacementDurationMs(step, target);
      this.ensureNpcPathToPosition(
        npcId,
        { x: npc.x, z: npc.z },
        targetAnchor,
        `use:${npc.targetPlacementId}`,
        now,
        { placementId: npc.targetPlacementId }
      );
      const arrived = this.moveNpcAlongPath(npcId, npc, targetAnchor, deltaMs);
      if (arrived) {
        npc.x = quantizePosition(targetAnchor.x);
        npc.z = quantizePosition(targetAnchor.z);
        if (Number.isFinite(target?.approachRotationY)) {
          npc.rotationY = quantizeRotation(target.approachRotationY);
          npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
        }
        this.syncNpcDerivedState?.(npc);
        if (target?.workoutType && this.isWorkoutPlacementOccupied(npc.targetPlacementId, { ignoreNpcId: npcId })) {
          npc.activity = '';
          meta.stepStartedAt = 0;
          return true;
        }
        npc.activity = target?.workoutType ?? 'use';
        if (!meta.stepStartedAt) {
          meta.stepStartedAt = now;
        }
        if ((now - meta.stepStartedAt) >= useDurationMs) {
          this.advanceNpcRoutineStep(npcId, npc);
        }
      } else {
        npc.activity = '';
        meta.stepStartedAt = 0;
      }
      return true;
    }

    if (step.type === NPC_STEP_TYPES.loiterNearPlacement || step.type === NPC_STEP_TYPES.wanderNearPlacement) {
      if (!meta.stepStartedAt) {
        meta.stepStartedAt = now;
      }
      const radius = Math.max(1, Number(step.radius ?? 0) || 6);
      const durationMs = Math.max(500, Math.floor(Number(step.durationMs ?? 0) || 0));
      const isWanderStep = step.type === NPC_STEP_TYPES.wanderNearPlacement;
      if (!meta.wanderPoint) {
        meta.wanderPoint = isWanderStep
          ? this.pickNpcWanderPoint(targetAnchor, radius, npcId)
          : clonePoint(targetAnchor);
        this.ensureNpcPathToPosition(
          npcId,
          { x: npc.x, z: npc.z },
          meta.wanderPoint,
          `${step.type}:${npc.targetPlacementId}:${meta.wanderPoint.x},${meta.wanderPoint.z}`,
          now
        );
      }
      const arrived = this.moveNpcAlongPath(npcId, npc, meta.wanderPoint, deltaMs);
      npc.activity = '';
      if (arrived) {
        this.beginNpcIdlePause(npcId, now, {
          minMs: NPC_DEFAULT_WANDER_IDLE_MIN_MS,
          maxMs: NPC_DEFAULT_WANDER_IDLE_MAX_MS
        });
        if (this.isNpcIdling(npcId, now)) {
          if ((now - meta.stepStartedAt) >= durationMs) {
            this.clearNpcIdlePause(npcId);
            this.advanceNpcRoutineStep(npcId, npc);
          }
          return true;
        }
        this.clearNpcIdlePause(npcId);
      }
      if ((now - meta.stepStartedAt) >= durationMs) {
        this.advanceNpcRoutineStep(npcId, npc);
      }
      return true;
    }

    return false;
  },

  updateNpcCombatBehavior(npcId, npc, definition, now, deltaMs) {
    const combat = definition?.combat ?? {};
    const meta = this.getNpcRuntimeMeta(npcId);
    const targetPlayer = npc.lastAttackerId ? this.state.players.get(npc.lastAttackerId) : null;
    const homeAnchor = this.getNpcHomeAnchor(definition);
    const leashAnchor = meta.combatAnchor ?? homeAnchor;

    if (!targetPlayer || targetPlayer.alive === false) {
      if (meta.calmEndsAt && now < meta.calmEndsAt) {
        return false;
      }
      meta.combatAnchor = null;
      this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine, { targetPlacementId: '', activity: '' });
      this.clearNpcPath(npcId);
      return true;
    }

    const threatPosition = { x: targetPlayer.x, z: targetPlayer.z };
    const distanceToThreat = distance2D(npc.x, npc.z, threatPosition.x, threatPosition.z);
    const distanceFromHome = distance2D(npc.x, npc.z, leashAnchor.x, leashAnchor.z);

    if (combat.archetype === NPC_COMBAT_ARCHETYPES.passive) {
      const runSpeed = getNpcRunSpeed(definition?.speed);
      const fleeTarget = findFarthestRouteNodeFrom(this.npcRouteGraph, threatPosition, homeAnchor) ?? homeAnchor;
      this.ensureNpcPathToPosition(
        npcId,
        { x: npc.x, z: npc.z },
        fleeTarget,
        `flee:${npc.lastAttackerId}:${fleeTarget.x},${fleeTarget.z}`,
        now
      );
      this.moveNpcAlongPath(npcId, npc, fleeTarget, deltaMs, { speed: runSpeed });
      npc.activity = '';
      if (distanceToThreat >= (combat.aggroRadius ?? 0) && now >= meta.calmEndsAt) {
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
        this.clearNpcPath(npcId);
      }
      return true;
    }

    const leashRadius = Number(combat.leashRadius ?? 0);
    if (leashRadius > 0 && distanceFromHome > leashRadius) {
      meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
      meta.combatAnchor = null;
      this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
      this.clearNpcPath(npcId);
      return true;
    }

    meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
    npc.activity = '';
    const runSpeed = getNpcRunSpeed(definition?.speed);
    if (combat.weaponId === WEAPON_IDS.pistol) {
      if (distanceToThreat <= WEAPON_RANGE * 0.72 && (now - meta.lastAttackAt) >= NPC_SHOT_INTERVAL_MS) {
        this.performNpcShot(npcId, npc, threatPosition, now);
        meta.lastAttackAt = now;
      } else {
        this.ensureNpcPathToPosition(
          npcId,
          { x: npc.x, z: npc.z },
          threatPosition,
          `combat:${npc.lastAttackerId}`,
          now
        );
        this.moveNpcAlongPath(npcId, npc, threatPosition, deltaMs, {
          stopDistance: WEAPON_RANGE * 0.35,
          speed: runSpeed
        });
      }
      return true;
    }

    if (distanceToThreat <= (PUNCH_RANGE + NPC_COMBAT_REACH_BUFFER) && (now - meta.lastAttackAt) >= NPC_PUNCH_INTERVAL_MS) {
      this.performNpcPunch(npcId, npc, threatPosition, now);
      meta.lastAttackAt = now;
      npc.activity = 'punch';
      return true;
    }

    this.ensureNpcPathToPosition(
      npcId,
      { x: npc.x, z: npc.z },
      threatPosition,
      `combat:${npc.lastAttackerId}`,
      now
    );
    this.moveNpcAlongPath(npcId, npc, threatPosition, deltaMs, {
      stopDistance: PUNCH_RANGE * 0.72,
      speed: runSpeed
    });
    return true;
  },

  updateNpcSimulation(now, deltaMs) {
    let changed = false;

    for (const [npcId, npc] of this.state.npcs.entries()) {
      const definition = this.getNpcDefinition(npcId);
      if (!definition || npc.active === false) {
        continue;
      }

      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.dead) {
        if (npc.respawnAt && now >= npc.respawnAt) {
          changed = this.finishNpcRespawn(npcId, npc, definition, now) || changed;
          this.syncNpcDerivedState?.(npc);
          continue;
        }
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead);
        this.syncNpcDerivedState?.(npc);
        continue;
      }

      if (npc.mode === NPC_RUNTIME_MODES.hidden) {
        npc.activity = '';
        if (npc.hiddenUntil && now >= npc.hiddenUntil) {
          const target = this.getNpcTargetOption(npc.targetPlacementId);
          if (target?.approachPosition) {
            npc.x = quantizePosition(target.approachPosition.x);
            npc.z = quantizePosition(target.approachPosition.z);
            this.syncNpcDerivedState?.(npc);
          }
          this.logNpcDebugEvent?.(npcId, 'hidden-exit', {
            targetPlacementId: npc.targetPlacementId || '',
            reappearAt: clonePoint(target?.approachPosition)
          });
          this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
          this.advanceNpcRoutineStep(npcId, npc);
          changed = true;
        }
        continue;
      }

      const before = `${npc.x}|${npc.z}|${npc.mode}|${npc.currentStepIndex}|${npc.targetPlacementId}|${npc.activity}|${npc.hiddenUntil}`;
      if (npc.mode === NPC_RUNTIME_MODES.combat || npc.mode === NPC_RUNTIME_MODES.flee) {
        changed = this.updateNpcCombatBehavior(npcId, npc, definition, now, deltaMs) || changed;
      } else {
        changed = this.updateNpcRoutine(npcId, npc, definition, now, deltaMs) || changed;
      }
      this.syncNpcDerivedState?.(npc);
      const after = `${npc.x}|${npc.z}|${npc.mode}|${npc.currentStepIndex}|${npc.targetPlacementId}|${npc.activity}|${npc.hiddenUntil}`;
      changed = changed || before !== after;
    }

    this.finalizeNpcSimulationTick?.(now);
    return changed;
  },

  applyDamageToNpc(npcId, damage, attackerId = '', now = Date.now()) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.getNpcDefinition(npcId);
    if (!npc || !definition || npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden) {
      return false;
    }

    npc.health = Math.max(0, npc.health - Math.max(0, Math.floor(damage)));
    npc.lastDamagedAt = now;
    npc.lastAttackerId = attackerId || npc.lastAttackerId || '';
    this.logNpcDebugEvent?.(npcId, 'damaged', {
      damage: Math.max(0, Math.floor(damage)),
      attackerSessionId: attackerId || '',
      health: npc.health,
      mode: npc.mode
    });
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
    this.clearNpcPath(npcId);

    if (npc.health <= 0) {
      this.handleNpcDeath(npcId, attackerId);
      return true;
    }

    const combat = definition.combat ?? {};
    const shouldFlee = combat.archetype === NPC_COMBAT_ARCHETYPES.passive;
    meta.combatAnchor = shouldFlee
      ? null
      : {
          x: quantizePosition(npc.x),
          z: quantizePosition(npc.z)
        };
    this.setNpcMode(
      npcId,
      npc,
      shouldFlee ? NPC_RUNTIME_MODES.flee : NPC_RUNTIME_MODES.combat,
      { lastAttackerId: attackerId, activity: '' }
    );
    return true;
  },

  handleNpcDeath(npcId, killerId = '') {
    const npc = this.state.npcs.get(npcId);
    const definition = this.getNpcDefinition(npcId);
    if (!npc || !definition || npc.alive === false) {
      return;
    }

    const now = Date.now();
    npc.alive = false;
    npc.health = 0;
    npc.activity = '';
    npc.busy = false;
    npc.chatStatus = 'idle';
    npc.chatText = '';
    npc.chatStartedAt = 0;
    npc.respawnAt = Math.max(0, Number(definition.respawnDelayMs ?? 0))
      ? now + Math.max(0, Math.floor(Number(definition.respawnDelayMs ?? 0)))
      : 0;
    this.logNpcDebugEvent?.(npcId, 'died', {
      killerId,
      x: npc.x,
      z: npc.z,
      respawnAt: npc.respawnAt
    });
    this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead, { lastAttackerId: killerId });
    this.syncNpcDerivedState?.(npc);
    this.emitNpcCombatEvent?.({
      type: 'death',
      victimId: npcId,
      victimType: 'npc',
      killerId,
      x: npc.x,
      z: npc.z
    });
  }
};
