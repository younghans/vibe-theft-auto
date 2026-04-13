import {
  COMBAT_PICKUP_SPAWNS,
  COMBAT_RESPAWN_POINTS,
  DROPPED_PICKUP_DESPAWN_MS,
  PICKUP_INTERACT_RADIUS,
  PUNCH_DAMAGE,
  PUNCH_INTERVAL_MS,
  PUNCH_RANGE,
  PICKUP_RESPAWN_MS,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  WEAPON_CLIP_SIZE,
  WEAPON_DAMAGE,
  WEAPON_FIRE_INTERVAL_MS,
  WEAPON_IDS,
  WEAPON_RANGE,
  WEAPON_RELOAD_MS,
  WEAPON_RESERVE_CAP
} from '../shared/combatConstants.js';
import {
  NPC_COMBAT_ARCHETYPES,
  NPC_DEFAULT_CALM_MS,
  NPC_DEFAULT_IDLE_MAX_MS,
  NPC_DEFAULT_IDLE_MIN_MS,
  NPC_DEFAULT_MAX_HEALTH,
  NPC_DEFAULT_MOVE_SPEED,
  NPC_RUNTIME_MODES,
  NPC_STEP_TYPES,
  NPC_DEFAULT_WANDER_IDLE_MAX_MS,
  NPC_DEFAULT_WANDER_IDLE_MIN_MS,
  getNpcRunSpeed,
  normalizeNpcBehavior
} from './npcBehavior.js';
import { PUNCH_EMOTE_ID } from '../player/emotes.js';
import { DEFAULT_PLAYABLE_CHARACTER_ID, getPlayableCharacterById } from '../player/playableCharacterCatalog.js';
import {
  chooseFarthestSpawnPoint,
  clampToWorldBounds,
  distance2D,
  normalizeAimVector,
  placementToCollisionRects,
  rayCircleIntersectionDistance,
  rayRectIntersectionDistance
} from '../shared/combatMath.js';
import { getNpcModelById } from './npcCatalog.js';
import {
  buildNpcPathToPlacement,
  buildNpcPathToPosition,
  buildNpcRouteGraph,
  findFarthestRouteNodeFrom
} from './npcRouteGraph.js';
import { collectNpcTargetOptions, resolveNpcTargetOption } from './npcTargeting.js';
import { WorldState } from '../world/WorldState.js';
import { defaultWorldLayout } from '../world/defaultWorldLayout.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

const SHOT_BLOCKER_EPSILON = PLAYER_RADIUS * 0.9;
const SHOT_ORIGIN_MAX_OFFSET = PLAYER_RADIUS * 2.4;
const SHOT_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 1.5;
const PUNCH_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 0.55;
const NPC_REPATH_MS = 900;
const NPC_SHOT_INTERVAL_MS = WEAPON_FIRE_INTERVAL_MS * 2;
const NPC_PUNCH_INTERVAL_MS = PUNCH_INTERVAL_MS * 2;
const NPC_COMBAT_REACH_BUFFER = 1.2;
const NPC_TARGET_STOP_DISTANCE = 0.7;
const NPC_SHOT_ORIGIN_FORWARD_OFFSET = PLAYER_RADIUS * 1.15;
const NPC_PATH_TURN_LOOKAHEAD_DISTANCE = 3.6;
const NPC_PATH_TURN_BLEND_MAX = 0.26;
const NPC_PATH_TURN_MIN_ANGLE_DOT = 0.92;

function makeTranscriptEntry(id, speaker, author, text) {
  return {
    id,
    speaker,
    author,
    text,
    createdAt: Date.now()
  };
}

function clampTranscript(transcript, limit = 16) {
  return transcript.slice(Math.max(0, transcript.length - limit));
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function cloneLayout(layout) {
  return structuredClone(layout);
}

function sanitizePlayerAnimationState(animationState = {}) {
  const emoteId = typeof animationState.emoteId === 'string' ? animationState.emoteId : '';
  const aimRotationY = Number(animationState.aimRotationY);

  return {
    emoteId,
    emoteActive: Boolean(animationState.emoteActive && emoteId),
    emoteStartedAt: Number.isFinite(animationState.emoteStartedAt) ? Math.max(0, Math.floor(animationState.emoteStartedAt)) : 0,
    emoteSeq: Number.isFinite(animationState.emoteSeq) ? Math.max(0, Math.floor(animationState.emoteSeq)) : 0,
    aimRotationY: Number.isFinite(aimRotationY) ? aimRotationY : 0,
    aiming: Boolean(animationState.aiming)
  };
}

function createDefaultPlayerState(overrides = {}) {
  return {
    x: 0,
    z: 0,
    rotationY: 0,
    aimRotationY: 0,
    aiming: false,
    emoteId: '',
    emoteActive: false,
    emoteStartedAt: 0,
    emoteSeq: 0,
    chatText: '',
    chatStartedAt: 0,
    chatSeq: 0,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    alive: true,
    respawnAt: 0,
    spawnProtectedUntil: 0,
    equippedWeaponId: '',
    ammoInClip: 0,
    reserveAmmo: 0,
    isReloading: false,
    reloadEndsAt: 0,
    kills: 0,
    deaths: 0,
    lastDamagedAt: 0,
    lastPunchAt: 0,
    lastShotAt: 0,
    characterId: DEFAULT_PLAYABLE_CHARACTER_ID,
    isAdmin: false,
    ...overrides
  };
}

function clonePlayerState(player) {
  return { ...player };
}

function clonePickupState(pickup) {
  return { ...pickup };
}

function cloneNpcDebugState(debug = {}) {
  return {
    id: debug.id || '',
    mode: debug.mode || '',
    activity: debug.activity || '',
    currentStepIndex: debug.currentStepIndex ?? 0,
    currentStepType: debug.currentStepType || '',
    stepCount: debug.stepCount ?? 0,
    targetPlacementId: debug.targetPlacementId || '',
    targetApproach: debug.targetApproach ? { ...debug.targetApproach } : null,
    nextPathPoint: debug.nextPathPoint ? { ...debug.nextPathPoint } : null,
    steeringTarget: debug.steeringTarget ? { ...debug.steeringTarget } : null,
    finalTarget: debug.finalTarget ? { ...debug.finalTarget } : null,
    path: Array.isArray(debug.path) ? debug.path.map((point) => ({ ...point })) : [],
    pathIndex: debug.pathIndex ?? 0,
    pathNodeCount: debug.pathNodeCount ?? 0,
    pathKey: debug.pathKey || '',
    lastRepathAt: debug.lastRepathAt ?? 0,
    idleUntil: debug.idleUntil ?? 0,
    calmEndsAt: debug.calmEndsAt ?? 0,
    hiddenUntil: debug.hiddenUntil ?? 0,
    respawnAt: debug.respawnAt ?? 0,
    wanderPoint: debug.wanderPoint ? { ...debug.wanderPoint } : null,
    stepStartedAt: debug.stepStartedAt ?? 0,
    busy: Boolean(debug.busy),
    alive: debug.alive !== false,
    weaponId: debug.weaponId || '',
    lastAttackerId: debug.lastAttackerId || '',
    debugAgeMs: debug.debugAgeMs ?? 0,
    idleRemainingMs: debug.idleRemainingMs ?? 0,
    calmRemainingMs: debug.calmRemainingMs ?? 0,
    hiddenRemainingMs: debug.hiddenRemainingMs ?? 0,
    respawnRemainingMs: debug.respawnRemainingMs ?? 0
  };
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
  return (((Math.round(Number(rotationQuarterTurns) || 0) % 4) + 4) % 4) * (Math.PI / 2);
}

function quantizeRotationQuarterTurnsFromRotationY(rotationY) {
  return ((Math.round(Number(rotationY ?? 0) / (Math.PI / 2)) % 4) + 4) % 4;
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

function createNpcRuntimeMeta(overrides = {}) {
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

export class NpcServiceMock {
  constructor({ adminKey = '' } = {}) {
    console.info('[NPC] Mock NPC service initialized.');
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.combatListeners = new Set();
    this.definitions = new Map();
    this.npcRuntimeMeta = new Map();
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.worldState = new WorldState();
    this.worldState.loadLayout(defaultWorldLayout);
    this.state = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      npcDebug: new Map(),
      pickups: new Map()
    };
    this.sequence = 0;
    this.pickupSequence = 0;
    this.playerAliasSequence = 0;
    this.npcRouteGraph = null;
    this.lastNpcSimulationAt = Date.now();
    this.adminKey = typeof adminKey === 'string' ? adminKey.trim() : '';
    this.playerAliasSequence += 1;
    this.playerAliases.set(this.state.sessionId, `Player ${this.playerAliasSequence}`);
    const [spawnX, spawnZ] = chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS);
    this.state.players.set(this.state.sessionId, createDefaultPlayerState({
      isAdmin: Boolean(this.adminKey),
      x: spawnX,
      z: spawnZ
    }));
    this.seedCombatPickups();
    this.syncNpcStateFromWorld();
    this.combatTick = window.setInterval(() => {
      this.updateCombatTimers();
    }, 100);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  subscribeWorldPatches(listener) {
    this.worldPatchListeners.add(listener);
    return () => this.worldPatchListeners.delete(listener);
  }

  subscribeCombatEvents(listener) {
    this.combatListeners.add(listener);
    return () => this.combatListeners.delete(listener);
  }

  getState() {
    return {
      ...this.state,
      players: new Map([...this.state.players.entries()].map(([id, player]) => [id, clonePlayerState(player)])),
      builders: new Map([...this.state.builders.entries()].map(([id, builder]) => [id, { ...builder }])),
      npcs: new Map([...this.state.npcs.entries()].map(([id, npc]) => [id, {
        ...npc,
        position: [npc.x, npc.z]
      }])),
      npcDebug: new Map([...this.buildNpcDebugSnapshotMap().entries()].map(([id, debug]) => [id, cloneNpcDebugState(debug)])),
      pickups: new Map([...this.state.pickups.entries()].map(([id, pickup]) => [id, clonePickupState(pickup)]))
    };
  }

  emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  emitWorldPatch(patch) {
    const snapshot = structuredClone(patch);
    for (const listener of this.worldPatchListeners) {
      listener(snapshot);
    }
  }

  emitCombatEvent(event) {
    const snapshot = structuredClone(event);
    for (const listener of this.combatListeners) {
      listener(snapshot);
    }
  }

  seedCombatPickups() {
    this.state.pickups.clear();
    for (const spawn of COMBAT_PICKUP_SPAWNS) {
      this.state.pickups.set(spawn.id, {
        id: spawn.id,
        weaponId: spawn.weaponId,
        x: spawn.position[0],
        z: spawn.position[1],
        ammoInClip: spawn.ammoInClip,
        reserveAmmo: spawn.reserveAmmo,
        kind: 'spawn',
        active: true,
        respawnAt: 0,
        despawnAt: 0
      });
    }
  }

  syncNpcStateFromWorld() {
    const layout = this.worldState.serializeLayout();
    const nextIds = new Set(layout.npcs.map((npc) => npc.id));

    for (const npc of layout.npcs) {
      const definition = normalizeNpcBehavior(structuredClone(npc), {
        position: npc.position,
        rotationQuarterTurns: npc.rotationQuarterTurns
      });
      this.definitions.set(npc.id, definition);
      const previous = this.state.npcs.get(npc.id);
      const spawnPosition = definition.spawnPosition ?? definition.position ?? [0, 0];
      const spawnRotationQuarterTurns = definition.spawnRotationQuarterTurns ?? definition.rotationQuarterTurns ?? 0;
      this.state.npcs.set(npc.id, {
        id: npc.id,
        modelId: definition.modelId,
        name: definition.name,
        x: quantizePosition(previous?.x ?? spawnPosition[0]),
        z: quantizePosition(previous?.z ?? spawnPosition[1]),
        position: [quantizePosition(previous?.x ?? spawnPosition[0]), quantizePosition(previous?.z ?? spawnPosition[1])],
        rotationY: quantizeRotation(previous?.rotationY ?? toRotationY(spawnRotationQuarterTurns)),
        rotationQuarterTurns: previous?.rotationQuarterTurns ?? spawnRotationQuarterTurns,
        interactRadius: definition.interactRadius,
        health: previous?.health ?? NPC_DEFAULT_MAX_HEALTH,
        maxHealth: previous?.maxHealth ?? NPC_DEFAULT_MAX_HEALTH,
        alive: previous?.alive !== false,
        respawnAt: previous?.respawnAt ?? 0,
        active: definition.active !== false,
        mode: previous?.mode ?? NPC_RUNTIME_MODES.routine,
        currentStepIndex: previous?.currentStepIndex ?? 0,
        targetPlacementId: previous?.targetPlacementId ?? '',
        weaponId: previous?.weaponId ?? definition.combat?.weaponId ?? '',
        lastAttackerId: previous?.lastAttackerId ?? '',
        hiddenUntil: previous?.hiddenUntil ?? 0,
        activity: previous?.activity ?? '',
        lastDamagedAt: previous?.lastDamagedAt ?? 0,
        busy: previous?.busy ?? false,
        chatStatus: previous?.chatStatus ?? 'idle',
        chatText: previous?.chatText ?? '',
        chatStartedAt: previous?.chatStartedAt ?? 0,
        chatSeq: previous?.chatSeq ?? 0
      });
      if (!this.npcRuntimeMeta.has(npc.id)) {
        this.npcRuntimeMeta.set(npc.id, createNpcRuntimeMeta());
      }
      if (!this.transcripts.has(npc.id)) {
        this.transcripts.set(npc.id, []);
      }
    }

    for (const npcId of [...this.state.npcs.keys()]) {
      if (nextIds.has(npcId)) {
        continue;
      }

      this.definitions.delete(npcId);
      this.state.npcs.delete(npcId);
      this.npcRuntimeMeta.delete(npcId);
      this.transcripts.delete(npcId);
    }

    this.npcRouteGraph = buildNpcRouteGraph(this.worldState);
  }

  getNpcRuntimeMeta(npcId) {
    if (!this.npcRuntimeMeta.has(npcId)) {
      this.npcRuntimeMeta.set(npcId, createNpcRuntimeMeta());
    }

    return this.npcRuntimeMeta.get(npcId);
  }

  clearNpcPath(npcId) {
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.path = [];
    meta.pathIndex = 0;
    meta.pathKey = '';
    meta.wanderPoint = null;
  }

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
  }

  isNpcIdling(npcId, now) {
    const meta = this.getNpcRuntimeMeta(npcId);
    return (meta.idleUntil ?? 0) > now;
  }

  clearNpcIdlePause(npcId) {
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.idleUntil = 0;
  }

  resetNpcRuntimeState(npcId, {
    restartFromSpawn = false
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
      npc.position = [npc.x, npc.z];
      npc.rotationY = quantizeRotation(toRotationY(definition.spawnRotationQuarterTurns ?? 0));
      npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    }
  }

  finishNpcRespawn(npcId, npc, definition, now = Date.now()) {
    if (!npc || !definition) {
      return false;
    }

    const respawnTarget = this.getNpcRespawnTarget(definition);
    const respawnPosition = respawnTarget.position ?? this.getNpcSpawnPoint(definition);
    npc.maxHealth = Math.max(1, Number(npc.maxHealth ?? NPC_DEFAULT_MAX_HEALTH));
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
    npc.position = [npc.x, npc.z];
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? toRotationY(definition.spawnRotationQuarterTurns ?? 0));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    this.resetNpcRuntimeState(npcId, { restartFromSpawn: false });
    npc.x = quantizePosition(respawnPosition.x);
    npc.z = quantizePosition(respawnPosition.z);
    npc.position = [npc.x, npc.z];
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? npc.rotationY);
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    npc.mode = npc.active === false ? NPC_RUNTIME_MODES.dead : NPC_RUNTIME_MODES.routine;
    npc.targetPlacementId = '';
    npc.respawnAt = 0;
    this.emitCombatEvent({
      type: 'respawn',
      victimId: npcId,
      victimType: 'npc',
      x: npc.x,
      z: npc.z,
      placementId: respawnTarget.placementId ?? ''
    });
    return true;
  }

  getNpcDefinition(npcId) {
    return this.definitions.get(npcId) ?? null;
  }

  getNpcSpawnPoint(definition) {
    const spawn = definition?.spawnPosition ?? definition?.position ?? [0, 0];
    return {
      x: quantizePosition(spawn[0]),
      z: quantizePosition(spawn[1])
    };
  }

  getNpcHomeAnchor(definition) {
    for (const step of definition?.routine?.steps ?? []) {
      if (step?.type !== NPC_STEP_TYPES.enterHideAtPlacement) {
        continue;
      }

      const target = this.getNpcTargetOption(step.targetPlacementId);
      if (target?.approachPosition) {
        return clonePoint(target.approachPosition);
      }
    }

    return this.getNpcSpawnPoint(definition);
  }

  getNpcRespawnTarget(definition) {
    const spawnPoint = this.getNpcSpawnPoint(definition);
    const spawnRotationQuarterTurns = ((Math.round(Number(
      definition?.spawnRotationQuarterTurns ?? definition?.rotationQuarterTurns ?? 0
    )) % 4) + 4) % 4;

    for (const step of definition?.routine?.steps ?? []) {
      if (step?.type !== NPC_STEP_TYPES.enterHideAtPlacement || !step.targetPlacementId) {
        continue;
      }

      const placement = this.worldState.getPlacement(step.targetPlacementId);
      const target = placement ? resolveNpcTargetOption(placement) : null;
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
  }

  getNpcTargetOption(targetPlacementId = '') {
    const placement = this.worldState.getPlacement(targetPlacementId);
    return placement ? resolveNpcTargetOption(placement) : null;
  }

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
  }

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
  }

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
      path: (meta.path ?? []).map((point) => clonePoint(point)).filter(Boolean),
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
  }

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
  }

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
  }

  setNpcMode(npcId, npc, mode, {
    targetPlacementId = '',
    activity = '',
    hiddenUntil = 0,
    lastAttackerId = npc.lastAttackerId || ''
  } = {}) {
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
  }

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
  }

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

    npc.position = [npc.x, npc.z];
    return distance2D(npc.x, npc.z, finalTarget.x, finalTarget.z) <= stopDistance;
  }

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
  }

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
  }

  pickNpcWanderPoint(anchorPosition, radius = 6, npcId = '') {
    const angleSeed = (Date.now() / 1000) + npcId.length;
    const angle = angleSeed % (Math.PI * 2);
    const distance = Math.max(1, Number(radius) || 6) * 0.68;
    return {
      x: quantizePosition(anchorPosition.x + Math.cos(angle) * distance),
      z: quantizePosition(anchorPosition.z + Math.sin(angle) * distance)
    };
  }

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
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.hidden, {
          targetPlacementId: npc.targetPlacementId,
          hiddenUntil: now + Math.max(500, Math.floor(Number(step.hiddenDurationMs ?? 0) || 0))
        });
        this.clearNpcPath(npcId);
      }
      return true;
    }

    if (step.type === NPC_STEP_TYPES.usePlacement) {
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
        this.beginNpcIdlePause(npcId, now);
        if (this.isNpcIdling(npcId, now)) {
          npc.activity = '';
          return true;
        }
        this.clearNpcIdlePause(npcId);
        npc.activity = target?.workoutType ?? 'use';
        if (!meta.stepStartedAt) {
          meta.stepStartedAt = now;
        }
        if ((now - meta.stepStartedAt) >= Math.max(500, Math.floor(Number(step.durationMs ?? 0) || 0))) {
          this.advanceNpcRoutineStep(npcId, npc);
        }
      } else {
        npc.activity = '';
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
  }

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
  }

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
          npc.position = [npc.x, npc.z];
          continue;
        }
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead);
        npc.position = [npc.x, npc.z];
        continue;
      }

      if (npc.mode === NPC_RUNTIME_MODES.hidden) {
        npc.activity = '';
        if (npc.hiddenUntil && now >= npc.hiddenUntil) {
          const target = this.getNpcTargetOption(npc.targetPlacementId);
          if (target?.approachPosition) {
            npc.x = quantizePosition(target.approachPosition.x);
            npc.z = quantizePosition(target.approachPosition.z);
            npc.position = [npc.x, npc.z];
          }
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
      npc.position = [npc.x, npc.z];
      const after = `${npc.x}|${npc.z}|${npc.mode}|${npc.currentStepIndex}|${npc.targetPlacementId}|${npc.activity}|${npc.hiddenUntil}`;
      changed = changed || before !== after;
    }

    return changed;
  }

  applyDamageToNpc(npcId, damage, attackerId = '', now = Date.now()) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.getNpcDefinition(npcId);
    if (!npc || !definition || npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden) {
      return false;
    }

    npc.health = Math.max(0, npc.health - Math.max(0, Math.floor(damage)));
    npc.lastDamagedAt = now;
    npc.lastAttackerId = attackerId || npc.lastAttackerId || '';
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
  }

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
    this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead, { lastAttackerId: killerId });
    this.emitCombatEvent({
      type: 'death',
      victimId: npcId,
      victimType: 'npc',
      killerId,
      x: npc.x,
      z: npc.z
    });
  }

  async getWorldLayout() {
    return cloneLayout(this.worldState.serializeLayout());
  }

  async editWorld(op, payload = {}) {
    if (!this.isAdmin()) {
      return { ok: false, error: 'Admin access required.' };
    }

    switch (op) {
      case 'placeTile': {
        const item = getBuilderItemById(payload?.itemId);
        if (!item || item.layer !== 'tile') {
          return { ok: false, error: 'That tile is not available.' };
        }
        const result = this.worldState.placeTile(
          item,
          Math.round(Number(payload.cellX ?? 0)),
          Math.round(Number(payload.cellZ ?? 0)),
          Number(payload.rotationQuarterTurns ?? 0)
        );
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId
        });
        return { ok: true, placementId: result.placement.id };
      }
      case 'placeProp': {
        const item = getBuilderItemById(payload?.itemId);
        if (!item || item.layer !== 'prop') {
          return { ok: false, error: 'That prop is not available.' };
        }
        const placement = this.worldState.placeProp(
          item,
          Number(payload.x ?? 0),
          Number(payload.z ?? 0),
          Number(payload.rotationQuarterTurns ?? 0)
        );
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: placement.id };
      }
      case 'placeNpc': {
        const model = getNpcModelById(payload.modelId);
        const item = model ? getBuilderItemById(model.itemId) : null;
        if (!item || item.layer !== 'npc') {
          return { ok: false, error: 'That NPC model is not available.' };
        }

        const placement = this.worldState.placeNpc(
          item,
          Number(payload.x ?? 0),
          Number(payload.z ?? 0),
          Number(payload.rotationQuarterTurns ?? 0),
          {
            modelId: payload.modelId,
            name: payload.name,
            prompt: payload.prompt,
            interactRadius: payload.interactRadius,
            respawnDelayMs: payload.respawnDelayMs,
            active: payload.active !== false
          }
        );
        this.syncNpcStateFromWorld();
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        this.emit();
        return { ok: true, placementId: placement.id };
      }
      case 'rotatePlacement': {
        const result = this.worldState.rotatePlacement(payload.placementId);
        if (!result?.placement) {
          return { ok: false, error: result?.error ?? 'That placement is not available.' };
        }
        const placement = result.placement;

        if (placement.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.resetNpcRuntimeState(placement.id, { restartFromSpawn: true });
          this.emit();
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'movePlacement': {
        const previousPlacement = this.worldState.getPlacement(payload.placementId);
        const result = this.worldState.movePlacement(payload.placementId, payload);
        if (!result?.placement) {
          return { ok: false, error: result?.error ?? 'That placement is not available.' };
        }

        if (previousPlacement?.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.resetNpcRuntimeState(result.placement.id, { restartFromSpawn: true });
          this.emit();
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId ?? null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'deletePlacement': {
        const placement = this.worldState.deletePlacement(payload.placementId);
        if (!placement) {
          return { ok: false, error: 'That placement is not available.' };
        }

        if (placement.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.emit();
        }

        this.emitWorldPatch({
          type: 'deletePlacement',
          placementId: payload.placementId
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'updateNpc': {
        const nextUpdates = { ...payload };
        delete nextUpdates.placementId;
        if (nextUpdates.modelId) {
          const model = getNpcModelById(nextUpdates.modelId);
          if (!model) {
            return { ok: false, error: 'That NPC model is not available.' };
          }
          nextUpdates.itemId = model.itemId;
        }

        const placement = this.worldState.updateNpc(payload.placementId, nextUpdates);
        if (!placement) {
          return { ok: false, error: 'That NPC is not available.' };
        }

        this.syncNpcStateFromWorld();
        this.resetNpcRuntimeState(placement.id, { restartFromSpawn: false });
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        this.emit();
        return { ok: true, placementId: payload.placementId };
      }
      case 'updatePlacementInteractable': {
        const placement = this.worldState.updatePlacementInteractable(payload.placementId, payload.interactable ?? null);
        if (!placement) {
          return { ok: false, error: 'That placement is not available.' };
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: payload.placementId };
      }
      default:
        return { ok: false, error: 'That world edit is not supported.' };
    }
  }

  setPlayerTransform(position, rotationY = 0, animationState = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const nextAnimation = sanitizePlayerAnimationState(animationState);
    const clamped = clampToWorldBounds(position.x, position.z);
    player.x = clamped.x;
    player.z = clamped.z;
    player.rotationY = Number.isFinite(rotationY) ? rotationY : player.rotationY;
    player.aimRotationY = nextAnimation.aimRotationY;
    player.aiming = nextAnimation.aiming;
    player.emoteId = nextAnimation.emoteId;
    player.emoteActive = nextAnimation.emoteActive;
    player.emoteStartedAt = nextAnimation.emoteStartedAt;
    player.emoteSeq = nextAnimation.emoteSeq;
  }

  setCharacter(characterId = '') {
    if (!this.isAdmin()) {
      return;
    }

    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return;
    }

    const normalized = getPlayableCharacterById(characterId).id;
    if (player.characterId === normalized) {
      return;
    }

    player.characterId = normalized;
    this.emit();
  }

  setBuilderPresence(presence = {}) {
    if (!this.isAdmin()) {
      this.state.builders.delete(this.state.sessionId);
      this.emit();
      return;
    }

    if (!presence.active) {
      this.state.builders.delete(this.state.sessionId);
      this.emit();
      return;
    }

    this.state.builders.set(this.state.sessionId, {
      active: true,
      itemId: presence.itemId ?? '',
      layer: presence.layer ?? '',
      rotationQuarterTurns: presence.rotationQuarterTurns ?? 0,
      cellX: presence.cellX ?? 0,
      cellZ: presence.cellZ ?? 0,
      x: Number(Number(presence.x ?? 0).toFixed(2)),
      z: Number(Number(presence.z ?? 0).toFixed(2)),
      selectionPlacementId: presence.selectionPlacementId ?? ''
    });
    this.emit();
  }

  setPlayerSpeech(player, text) {
    player.chatText = text;
    player.chatStartedAt = Date.now();
    player.chatSeq = (player.chatSeq ?? 0) + 1;
  }

  setNpcChatPhase(npc, status, text = npc.chatText ?? '', { bumpSeq = false } = {}) {
    npc.chatStatus = status;
    npc.chatText = text;
    npc.chatStartedAt = Date.now();
    if (bumpSeq) {
      npc.chatSeq = (npc.chatSeq ?? 0) + 1;
    }
  }

  getPlayerAlias(sessionId) {
    if (!this.playerAliases.has(sessionId)) {
      this.playerAliasSequence += 1;
      this.playerAliases.set(sessionId, `Player ${this.playerAliasSequence}`);
    }

    return this.playerAliases.get(sessionId);
  }

  appendTranscript(npcId, entry) {
    const transcript = this.transcripts.get(npcId) ?? [];
    transcript.push(entry);
    this.transcripts.set(npcId, clampTranscript(transcript));
  }

  findNearestHeardNpc(player) {
    let nearestNpc = null;
    let nearestDistance = Infinity;

    for (const npc of this.state.npcs.values()) {
      if (npc.active === false || npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden || npc.mode === NPC_RUNTIME_MODES.dead) {
        continue;
      }

      const distance = distance2D(npc.x, npc.z, player.x, player.z);
      if (distance > npc.interactRadius || distance >= nearestDistance) {
        continue;
      }

      nearestNpc = npc;
      nearestDistance = distance;
    }

    return nearestNpc;
  }

  sanitizeChatMessage(message) {
    const trimmed = String(message ?? '').trim();
    if (!trimmed) {
      return { ok: false, error: 'Say something first.' };
    }

    if (trimmed.length > 280) {
      return { ok: false, error: 'Messages are capped at 280 characters.' };
    }

    const cooldownKey = `${this.state.sessionId}:chat`;
    const lastSentAt = this.cooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastSentAt < 900) {
      return { ok: false, error: 'Take a breath before sending another message.' };
    }

    this.cooldowns.set(cooldownKey, Date.now());
    return { ok: true, message: trimmed };
  }

  async say(message) {
    const sanitized = this.sanitizeChatMessage(message);
    if (!sanitized.ok) {
      return sanitized;
    }

    console.info('[NPC] Mock say.', {
      messageLength: sanitized.message.length
    });

    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return { ok: false, error: 'Your player is not connected.' };
    }

    this.setPlayerSpeech(player, sanitized.message);
    this.state.players.set(this.state.sessionId, player);
    this.emit();

    const npc = this.findNearestHeardNpc(player);
    if (!npc || npc.busy) {
      return { ok: true };
    }

    const definition = this.definitions.get(npc.id);
    if (!definition) {
      return { ok: true };
    }

    npc.busy = true;
    this.setNpcChatPhase(npc, 'thinking', '', { bumpSeq: true });
    this.appendTranscript(
      npc.id,
      makeTranscriptEntry(`local_${++this.sequence}`, 'player', this.getPlayerAlias(this.state.sessionId), sanitized.message)
    );
    this.emit();

    await new Promise((resolve) => window.setTimeout(resolve, 320));

    const reply = this.buildReply(definition, sanitized.message);
    const words = reply.split(/\s+/).filter(Boolean);
    let partial = '';
    for (const word of words) {
      partial = partial ? `${partial} ${word}` : word;
      this.setNpcChatPhase(npc, 'streaming', partial);
      this.emit();
      await new Promise((resolve) => window.setTimeout(resolve, 75));
    }

    this.appendTranscript(
      npc.id,
      makeTranscriptEntry(`local_${++this.sequence}`, 'npc', npc.name, reply)
    );
    this.setNpcChatPhase(npc, 'done', reply, { bumpSeq: true });
    npc.busy = false;
    this.emit();
    return { ok: true };
  }

  buildReply(definition, message) {
    const signatures = [
      'Keep your head up and your money tucked away.',
      'Town remembers everything, so move smart.',
      'That block talks louder at night than it does by day.',
      'You did not hear this from me, but that sounds like a real opportunity.'
    ];
    const signature = signatures[hashText(`${definition.name}:${message}`) % signatures.length];
    return `${message.trim()}? ${signature}`;
  }

  pickupWeapon(pickupId) {
    const player = this.state.players.get(this.state.sessionId);
    const pickup = this.state.pickups.get(String(pickupId ?? ''));
    if (!player || !pickup?.active || player.alive === false) {
      return;
    }

    const distance = distance2D(player.x, player.z, pickup.x, pickup.z);
    if (distance > PICKUP_INTERACT_RADIUS) {
      return;
    }

    if (player.equippedWeaponId && player.equippedWeaponId !== pickup.weaponId) {
      return;
    }

    if (pickup.weaponId === WEAPON_IDS.pistol && player.equippedWeaponId === WEAPON_IDS.pistol) {
      const nextClip = Math.min(WEAPON_CLIP_SIZE, player.ammoInClip + pickup.ammoInClip);
      const clipDelta = nextClip - player.ammoInClip;
      const remainingReserveFromPickup = Math.max(0, pickup.ammoInClip - clipDelta) + pickup.reserveAmmo;
      const nextReserve = Math.min(WEAPON_RESERVE_CAP, player.reserveAmmo + remainingReserveFromPickup);
      if (nextClip === player.ammoInClip && nextReserve === player.reserveAmmo) {
        return;
      }
      player.ammoInClip = nextClip;
      player.reserveAmmo = nextReserve;
    } else {
      player.equippedWeaponId = pickup.weaponId;
      player.ammoInClip = Math.min(WEAPON_CLIP_SIZE, pickup.ammoInClip);
      player.reserveAmmo = Math.min(WEAPON_RESERVE_CAP, pickup.reserveAmmo);
    }

    player.isReloading = false;
    player.reloadEndsAt = 0;
    this.consumePickup(pickup);
    this.emitCombatEvent({
      type: 'pickup',
      playerId: this.state.sessionId,
      pickupId: pickup.id,
      weaponId: pickup.weaponId
    });
    this.emit();
  }

  fireWeapon(aimDirection = { x: 0, z: 1 }, clientShotAt = Date.now(), origin = null) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false || !player.equippedWeaponId || player.isReloading) {
      return false;
    }

    const now = Date.now();
    if (player.ammoInClip <= 0 || (now - (player.lastShotAt ?? 0)) < WEAPON_FIRE_INTERVAL_MS) {
      return false;
    }

    const aim = normalizeAimVector(aimDirection.x, aimDirection.z);
    const shotOrigin = this.resolveShotOrigin(player, origin);
    player.lastShotAt = now;
    player.ammoInClip = Math.max(0, player.ammoInClip - 1);

    const shot = this.resolveShot(this.state.sessionId, player, aim, shotOrigin);
    this.emitCombatEvent({
      type: 'shot',
      shooterType: 'player',
      shooterId: this.state.sessionId,
      weaponId: player.equippedWeaponId,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt
    });
    this.emitCombatEvent({
      type: 'impact',
      shooterType: 'player',
      shooterId: this.state.sessionId,
      kind: shot.kind,
      targetId: shot.targetId ?? '',
      x: shot.hitX,
      z: shot.hitZ
    });

    if (shot.kind === 'player' && shot.targetId) {
      const target = this.state.players.get(shot.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - WEAPON_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(shot.targetId, this.state.sessionId);
        }
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, this.state.sessionId, now);
    }

    if (player.ammoInClip <= 0 && player.reserveAmmo > 0) {
      this.startReload(player);
    }

    this.emit();
    return true;
  }

  punch(aimDirection = { x: 0, z: 1 }, clientPunchAt = Date.now()) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return false;
    }

    const now = Date.now();
    if ((now - (player.lastPunchAt ?? 0)) < PUNCH_INTERVAL_MS) {
      return false;
    }

    const aim = normalizeAimVector(aimDirection.x, aimDirection.z);
    player.lastPunchAt = now;
    player.emoteId = PUNCH_EMOTE_ID;
    player.emoteActive = true;
    player.emoteStartedAt = now;
    player.emoteSeq = (player.emoteSeq ?? 0) + 1;

    const hit = this.resolvePunch(this.state.sessionId, player, aim);
    if (hit.kind !== 'miss') {
      this.emitCombatEvent({
        type: 'impact',
        shooterType: 'player',
        shooterId: this.state.sessionId,
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - PUNCH_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, this.state.sessionId);
        }
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, this.state.sessionId, now);
    }

    this.emit();
    return true;
  }

  reloadWeapon() {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return;
    }
    this.startReload(player);
  }

  startReload(player, { emitEvent = true } = {}) {
    if (
      !player
      || player.alive === false
      || !player.equippedWeaponId
      || player.isReloading
      || player.ammoInClip >= WEAPON_CLIP_SIZE
      || player.reserveAmmo <= 0
    ) {
      return false;
    }

    player.isReloading = true;
    player.reloadEndsAt = Date.now() + WEAPON_RELOAD_MS;
    if (emitEvent) {
      this.emitCombatEvent({
        type: 'reload',
        playerId: this.state.sessionId,
        weaponId: player.equippedWeaponId,
        startedAt: Date.now(),
        endsAt: player.reloadEndsAt
      });
      this.emit();
    }
    return true;
  }

  updateCombatTimers() {
    const now = Date.now();
    const deltaMs = Math.max(16, now - this.lastNpcSimulationAt);
    this.lastNpcSimulationAt = now;
    let stateChanged = false;

    for (const player of this.state.players.values()) {
      if (player.isReloading && player.reloadEndsAt && now >= player.reloadEndsAt) {
        this.completeReload(player);
        stateChanged = true;
      }

      if (player.alive === false && player.respawnAt && now >= player.respawnAt) {
        this.finishRespawn(player);
        stateChanged = true;
      }
    }

    for (const pickup of this.state.pickups.values()) {
      if (!pickup.active && pickup.kind === 'spawn' && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.active = true;
        pickup.respawnAt = 0;
        stateChanged = true;
      }

      if (!pickup.active && pickup.kind === 'drop' && pickup.despawnAt && now >= pickup.despawnAt) {
        this.state.pickups.delete(pickup.id);
        stateChanged = true;
      }
    }

    stateChanged = this.updateNpcSimulation(now, deltaMs) || stateChanged;

    if (stateChanged) {
      this.emit();
    }
  }

  completeReload(player) {
    const needed = Math.max(0, WEAPON_CLIP_SIZE - player.ammoInClip);
    const loaded = Math.min(needed, player.reserveAmmo);
    player.ammoInClip += loaded;
    player.reserveAmmo -= loaded;
    player.isReloading = false;
    player.reloadEndsAt = 0;
  }

  finishRespawn(player) {
    const livingOthers = [...this.state.players.entries()]
      .filter(([id, candidate]) => id !== this.state.sessionId && candidate.alive !== false)
      .map(([, candidate]) => candidate);
    const [spawnX, spawnZ] = chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS, livingOthers);
    player.x = spawnX;
    player.z = spawnZ;
    player.rotationY = 0;
    player.aimRotationY = 0;
    player.health = PLAYER_MAX_HEALTH;
    player.maxHealth = PLAYER_MAX_HEALTH;
    player.alive = true;
    player.respawnAt = 0;
    player.spawnProtectedUntil = 0;
    player.equippedWeaponId = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.lastDamagedAt = 0;
    player.lastPunchAt = 0;
    player.lastShotAt = 0;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq += 1;
    this.emitCombatEvent({
      type: 'respawn',
      playerId: this.state.sessionId,
      x: spawnX,
      z: spawnZ
    });
  }

  handlePlayerDeath(playerId, killerId = '') {
    const player = this.state.players.get(playerId);
    if (!player || player.alive === false) {
      return;
    }

    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.deaths += 1;
    player.emoteId = 'limp';
    player.emoteActive = true;
    player.emoteStartedAt = Date.now();
    player.emoteSeq += 1;

    if (killerId && killerId !== playerId) {
      const killer = this.state.players.get(killerId);
      if (killer) {
        killer.kills += 1;
      }
    }

    this.dropWeaponPickup(player);
    player.equippedWeaponId = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;
    this.emitCombatEvent({
      type: 'death',
      victimId: playerId,
      killerId,
      x: player.x,
      z: player.z
    });
  }

  dropWeaponPickup(player) {
    const totalAmmo = player.ammoInClip + player.reserveAmmo;
    if (!player.equippedWeaponId || totalAmmo <= 0) {
      return;
    }

    const id = `pickup_drop_${++this.pickupSequence}`;
    this.state.pickups.set(id, {
      id,
      weaponId: player.equippedWeaponId,
      x: player.x,
      z: player.z,
      ammoInClip: player.ammoInClip,
      reserveAmmo: player.reserveAmmo,
      kind: 'drop',
      active: true,
      respawnAt: 0,
      despawnAt: Date.now() + DROPPED_PICKUP_DESPAWN_MS
    });
  }

  consumePickup(pickup) {
    if (pickup.kind === 'spawn') {
      pickup.active = false;
      pickup.respawnAt = Date.now() + PICKUP_RESPAWN_MS;
      pickup.despawnAt = 0;
      return;
    }

    this.state.pickups.delete(pickup.id);
  }

  resolveShotOrigin(player, origin = null) {
    const nextOrigin = {
      x: Number.isFinite(origin?.x) ? Number(origin.x) : player.x,
      z: Number.isFinite(origin?.z) ? Number(origin.z) : player.z
    };
    const offsetX = nextOrigin.x - player.x;
    const offsetZ = nextOrigin.z - player.z;
    const offsetLength = Math.hypot(offsetX, offsetZ);
    if (offsetLength > SHOT_ORIGIN_MAX_OFFSET && offsetLength > 0.0001) {
      const scale = SHOT_ORIGIN_MAX_OFFSET / offsetLength;
      nextOrigin.x = player.x + offsetX * scale;
      nextOrigin.z = player.z + offsetZ * scale;
    }

    return nextOrigin;
  }

  resolveCombatShot(origin, aim, maxDistance, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    let nearestDistance = maxDistance;
    let result = {
      kind: 'miss',
      hitX: origin.x + aim.x * maxDistance,
      hitZ: origin.z + aim.z * maxDistance,
      targetId: ''
    };

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, maxDistance, rect);
        if (
          hitDistance == null
          || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, SHOT_WORLD_BLOCKER_GRACE_DISTANCE)
          || hitDistance >= nearestDistance
        ) {
          continue;
        }

        nearestDistance = hitDistance;
        result = {
          kind: 'world',
          hitX: origin.x + aim.x * hitDistance,
          hitZ: origin.z + aim.z * hitDistance,
          targetId: placement.id
        };
      }
    }

    for (const [id, target] of this.state.players.entries()) {
      if (id === ignorePlayerId || target.alive === false) {
        continue;
      }

      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        PLAYER_RADIUS
      );

      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'player',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: id
      };
    }

    for (const [npcId, target] of this.state.npcs.entries()) {
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      );

      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'npc',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: npcId
      };
    }

    return result;
  }

  resolveShot(playerId, player, aim, origin = player) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignorePlayerId: playerId
    });
  }

  resolveShotFromNpc(npcId, npc, aim, origin = npc) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignoreNpcId: npcId
    });
  }

  resolveCombatPunch(origin, aim, maxDistance, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    let nearestDistance = maxDistance;
    let result = {
      kind: 'miss',
      hitX: origin.x + aim.x * maxDistance,
      hitZ: origin.z + aim.z * maxDistance,
      targetId: ''
    };

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, maxDistance, rect);
        if (
          hitDistance == null
          || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, PUNCH_WORLD_BLOCKER_GRACE_DISTANCE)
          || hitDistance >= nearestDistance
        ) {
          continue;
        }

        nearestDistance = hitDistance;
        result = {
          kind: 'world',
          hitX: origin.x + aim.x * hitDistance,
          hitZ: origin.z + aim.z * hitDistance,
          targetId: placement.id
        };
      }
    }

    for (const [sessionId, target] of this.state.players.entries()) {
      if (sessionId === ignorePlayerId || target.alive === false) {
        continue;
      }

      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        PLAYER_RADIUS
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'player',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: sessionId
      };
    }

    for (const [npcId, target] of this.state.npcs.entries()) {
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'npc',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: npcId
      };
    }

    return result;
  }

  resolvePunch(attackerId, player, aim) {
    return this.resolveCombatPunch(player, aim, PUNCH_RANGE, {
      ignorePlayerId: attackerId
    });
  }

  resolvePunchFromNpc(npcId, npc, aim) {
    return this.resolveCombatPunch(npc, aim, PUNCH_RANGE, {
      ignoreNpcId: npcId
    });
  }

  performNpcShot(npcId, npc, targetPosition, now = Date.now()) {
    const aim = normalizeAimVector(targetPosition.x - npc.x, targetPosition.z - npc.z);
    const shotOrigin = {
      x: npc.x + aim.x * NPC_SHOT_ORIGIN_FORWARD_OFFSET,
      z: npc.z + aim.z * NPC_SHOT_ORIGIN_FORWARD_OFFSET
    };
    npc.rotationY = quantizeRotation(Math.atan2(aim.x, aim.z));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    const shot = this.resolveShotFromNpc(npcId, npc, aim, shotOrigin);

    this.emitCombatEvent({
      type: 'shot',
      shooterType: 'npc',
      shooterId: npcId,
      weaponId: npc.weaponId || WEAPON_IDS.pistol,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt: now
    });

    if (shot.kind !== 'miss') {
      this.emitCombatEvent({
        type: 'impact',
        shooterType: 'npc',
        shooterId: npcId,
        kind: shot.kind,
        targetId: shot.targetId ?? '',
        x: shot.hitX,
        z: shot.hitZ
      });
    }

    if (shot.kind === 'player' && shot.targetId) {
      const target = this.state.players.get(shot.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - WEAPON_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(shot.targetId, npcId);
        }
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, npcId, now);
    }
  }

  performNpcPunch(npcId, npc, targetPosition, now = Date.now()) {
    const aim = normalizeAimVector(targetPosition.x - npc.x, targetPosition.z - npc.z);
    npc.rotationY = quantizeRotation(Math.atan2(aim.x, aim.z));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    const hit = this.resolvePunchFromNpc(npcId, { x: npc.x, z: npc.z }, aim);

    if (hit.kind !== 'miss') {
      this.emitCombatEvent({
        type: 'impact',
        shooterType: 'npc',
        shooterId: npcId,
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt: now
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - PUNCH_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, npcId);
        }
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, npcId, now);
    }
  }

  async destroy() {
    this.listeners.clear();
    this.worldPatchListeners.clear();
    this.combatListeners.clear();
    window.clearInterval(this.combatTick);
  }

  isAdmin() {
    return this.state.players.get(this.state.sessionId)?.isAdmin === true;
  }
}
