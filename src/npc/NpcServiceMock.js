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
import { tickHealthRegen } from '../shared/combatRegen.js';
import {
  DELIVERY_QUEST_ID,
  DELIVERY_QUEST_REWARD_AMOUNT,
  DELIVERY_QUEST_STATUS,
  addDeliveryQuestRecentTargetId,
  getDeliveryQuestTargetCandidate,
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver,
  isNpcAvailableForDelivery
} from '../shared/deliveryQuest.js';
import {
  GYM_CHECK_IN_PURCHASED_LINE,
  GYM_DOOR_BLOCKER_RADIUS,
  GYM_MEMBERSHIP_COST,
  getGymCheckInPromptRadius,
  isGymCheckInNpc
} from '../shared/gymMembership.js';
import { getTileCenterWorldPosition, rotateFootprintOffset } from '../shared/tileFootprint.js';
import { resolveRentIntroPlan } from '../shared/rentIntro.js';
import {
  NPC_DEFAULT_MAX_HEALTH,
  NPC_RUNTIME_MODES,
  normalizeNpcBehavior,
  shouldResetNpcRuntimeForBehaviorUpdate
} from './npcBehavior.js';
import { PUNCH_EMOTE_ID } from '../player/emotes.js';
import { createNpcRuntimeMeta, npcSimulationMethods } from './npcSimulationMethods.js';
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
import { buildNpcRouteGraph } from './npcRouteGraph.js';
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
    money: 0,
    gymMembershipActive: false,
    rentIntroSeq: 0,
    rentIntroAmount: 0,
    rentIntroNpcId: '',
    rentIntroBuildingPlacementId: '',
    rentIntroStartedAt: 0,
    lastDamagedAt: 0,
    workoutPlacementId: '',
    deliveryQuestId: '',
    deliveryQuestStatus: DELIVERY_QUEST_STATUS.inactive,
    deliveryQuestGiverNpcId: '',
    deliveryQuestTargetNpcId: '',
    deliveryQuestAcceptedAt: 0,
    deliveryQuestCompletedAt: 0,
    deliveryQuestRecentTargetNpcIds: '',
    deliveryQuestCompletionCount: 0,
    gymPumpCompletedAt: 0,
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
    this.playerRuntimeMeta = new Map();
    this.playerAliasSequence += 1;
    this.playerAliases.set(this.state.sessionId, `Player ${this.playerAliasSequence}`);
    const [spawnX, spawnZ] = chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS);
    const rentIntro = resolveRentIntroPlan(this.worldState.serializeLayout());
    const introStartedAt = rentIntro ? Date.now() : 0;
    const introSpawn = rentIntro?.spawn ?? null;
    this.state.players.set(this.state.sessionId, createDefaultPlayerState({
      isAdmin: Boolean(this.adminKey),
      x: introSpawn?.x ?? spawnX,
      z: introSpawn?.z ?? spawnZ,
      rotationY: introSpawn?.rotationY ?? 0,
      aimRotationY: introSpawn?.rotationY ?? 0,
      money: rentIntro ? -Math.abs(Math.round(rentIntro.amount)) : 0,
      rentIntroSeq: introStartedAt,
      rentIntroAmount: rentIntro ? Math.abs(Math.round(rentIntro.amount)) : 0,
      rentIntroNpcId: rentIntro?.collectorNpcId ?? '',
      rentIntroBuildingPlacementId: rentIntro?.buildingPlacementId ?? '',
      rentIntroStartedAt: introStartedAt
    }));
    this.playerRuntimeMeta.set(this.state.sessionId, {
      healthRegenCarryMs: 0
    });
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

  getPlayerRuntimeMeta(sessionId = this.state.sessionId) {
    if (!this.playerRuntimeMeta.has(sessionId)) {
      this.playerRuntimeMeta.set(sessionId, {
        healthRegenCarryMs: 0
      });
    }

    return this.playerRuntimeMeta.get(sessionId);
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
        deliveryQuestEnabled: definition.deliveryQuestEnabled === true,
        gymCheckInEnabled: definition.gymCheckInEnabled === true,
        rentCollectorEnabled: definition.rentCollectorEnabled === true,
        health: previous?.health ?? NPC_DEFAULT_MAX_HEALTH,
        maxHealth: previous?.maxHealth ?? NPC_DEFAULT_MAX_HEALTH,
        alive: previous?.alive !== false,
        respawnAt: previous?.respawnAt ?? 0,
        active: true,
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

  syncNpcDerivedState(npc) {
    npc.position = [npc.x, npc.z];
  }

  finalizeNpcSimulationTick(_now) {}

  emitNpcCombatEvent(event) {
    this.emitCombatEvent(event);
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
            speed: payload.speed,
            routine: payload.routine,
            combat: payload.combat,
            respawnDelayMs: payload.respawnDelayMs,
            deliveryQuestEnabled: payload.deliveryQuestEnabled,
            gymCheckInEnabled: payload.gymCheckInEnabled,
            rentCollectorEnabled: payload.rentCollectorEnabled
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
        const existingPlacement = this.worldState.getPlacement(payload.placementId);
        const previousNpc = existingPlacement?.npc
          ? structuredClone(existingPlacement.npc)
          : null;
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
        if (shouldResetNpcRuntimeForBehaviorUpdate(previousNpc, placement.npc, nextUpdates)) {
          this.resetNpcRuntimeState(placement.id, { restartFromSpawn: false });
        }
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
    if (this.isGymGateBlockingPosition(player, clamped)) {
      return;
    }
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
      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden || npc.mode === NPC_RUNTIME_MODES.dead) {
        continue;
      }
      if (isGymCheckInNpc(npc) && player.gymMembershipActive !== true) {
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

  getDeliveryQuestPayload(player) {
    return {
      questId: player.deliveryQuestId || '',
      status: player.deliveryQuestStatus || DELIVERY_QUEST_STATUS.inactive,
      giverNpcId: player.deliveryQuestGiverNpcId || '',
      targetNpcId: player.deliveryQuestTargetNpcId || '',
      acceptedAt: player.deliveryQuestAcceptedAt || 0,
      completedAt: player.deliveryQuestCompletedAt || 0,
      recentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds || '',
      completionCount: player.deliveryQuestCompletionCount || 0,
      rewardAmount: DELIVERY_QUEST_REWARD_AMOUNT
    };
  }

  isPlayerInNpcInteractRadius(player, npc) {
    if (!player || !npc) {
      return false;
    }

    const radius = Math.max(1.5, Number(npc.interactRadius ?? 4.2) || 4.2);
    return distance2D(player.x, player.z, npc.x, npc.z) <= radius;
  }

  isPlayerInGymCheckInPurchaseRadius(player, npc) {
    if (!player || !npc || !isGymCheckInNpc(npc)) {
      return false;
    }

    return distance2D(player.x, player.z, npc.x, npc.z) <= getGymCheckInPromptRadius(npc);
  }

  hasActiveGymCheckInNpc() {
    for (const npc of this.state.npcs.values()) {
      if (
        isGymCheckInNpc(npc)
        && npc.alive !== false
        && npc.mode !== NPC_RUNTIME_MODES.hidden
        && npc.mode !== NPC_RUNTIME_MODES.dead
      ) {
        return true;
      }
    }

    return false;
  }

  isGymDoorPlacement(placement = null, item = null) {
    const itemId = String(item?.id ?? placement?.itemId ?? '').toLowerCase();
    const interiorId = String(item?.interior?.id ?? placement?.interactable?.interior?.id ?? '').toLowerCase();
    const label = String(item?.interior?.label ?? placement?.interactable?.label ?? item?.label ?? '').toLowerCase();
    return itemId.includes('gym') || interiorId.includes('gym') || label.includes('gym');
  }

  getGymDoorBlockers() {
    return this.worldState.getPlacements()
      .map((placement) => {
        const item = getBuilderItemById(placement?.itemId);
        if (!item || placement?.layer !== 'tile' || !this.isGymDoorPlacement(placement, item)) {
          return null;
        }

        const doorOffset = item.interior?.exteriorDoorOffset
          ?? placement.interactable?.interior?.exteriorDoorOffset
          ?? item.npcRouteDoorOffset
          ?? null;
        if (!Array.isArray(doorOffset) || doorOffset.length < 2) {
          return null;
        }

        const center = getTileCenterWorldPosition(
          item,
          placement.cellX,
          placement.cellZ,
          placement.rotationQuarterTurns
        );
        const rotatedOffset = rotateFootprintOffset(
          Number(doorOffset[0]) || 0,
          Number(doorOffset[1]) || 0,
          placement.rotationQuarterTurns
        );
        return {
          x: center.x + rotatedOffset.x,
          z: center.z + rotatedOffset.z,
          radius: GYM_DOOR_BLOCKER_RADIUS
        };
      })
      .filter(Boolean);
  }

  isGymGateBlockingPosition(player, position) {
    if (
      !player
      || player.gymMembershipActive === true
      || !position
      || !this.hasActiveGymCheckInNpc()
    ) {
      return false;
    }

    for (const blocker of this.getGymDoorBlockers()) {
      if (distance2D(position.x, position.z, blocker.x, blocker.z) <= blocker.radius + PLAYER_RADIUS) {
        return true;
      }
    }

    return false;
  }

  async buyGymMembership(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot buy that right now.' };
    }

    if (player.gymMembershipActive === true) {
      return { ok: true, alreadyOwned: true, money: player.money ?? 0 };
    }

    const normalizedNpcId = typeof npcId === 'string'
      ? npcId.trim()
      : '';
    const npc = this.state.npcs.get(normalizedNpcId);
    if (!npc || !isGymCheckInNpc(npc)) {
      return { ok: false, error: 'That gym check-in is not available.' };
    }

    if (!this.isPlayerInGymCheckInPurchaseRadius(player, npc)) {
      return { ok: false, error: 'Move closer to the gym check-in.' };
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < GYM_MEMBERSHIP_COST) {
      this.setNpcChatPhase(npc, 'done', `Bring $${GYM_MEMBERSHIP_COST} and I can get you checked in.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${GYM_MEMBERSHIP_COST} for a gym membership.` };
    }

    player.money = money - GYM_MEMBERSHIP_COST;
    player.gymMembershipActive = true;
    this.setNpcChatPhase(npc, 'done', GYM_CHECK_IN_PURCHASED_LINE, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      cost: GYM_MEMBERSHIP_COST,
      money: player.money,
      gymMembershipActive: true
    };
  }

  async acceptDeliveryQuest(giverNpcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot accept that right now.' };
    }

    const normalizedGiverNpcId = typeof giverNpcId === 'string'
      ? giverNpcId.trim()
      : '';
    const giver = this.state.npcs.get(normalizedGiverNpcId);
    if (
      !giver
      || !isNpcAvailableForDelivery(giver)
      || !isDeliveryQuestGiver(normalizedGiverNpcId, giver)
    ) {
      return { ok: false, error: 'That delivery job is not available.' };
    }

    if (!this.isPlayerInNpcInteractRadius(player, giver)) {
      return { ok: false, error: 'Move closer to accept the delivery.' };
    }

    if (isDeliveryQuestActive(player)) {
      const activeTarget = this.state.npcs.get(player.deliveryQuestTargetNpcId);
      return {
        ok: true,
        targetName: getDeliveryQuestTargetName(activeTarget),
        ...this.getDeliveryQuestPayload(player)
      };
    }

    const target = getDeliveryQuestTargetCandidate(this.state.npcs, normalizedGiverNpcId, {
      recentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds
    });
    if (!target) {
      return { ok: false, error: 'There is nobody to deliver to yet.' };
    }

    const now = Date.now();
    player.deliveryQuestId = DELIVERY_QUEST_ID;
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.active;
    player.deliveryQuestGiverNpcId = normalizedGiverNpcId;
    player.deliveryQuestTargetNpcId = target.id;
    player.deliveryQuestAcceptedAt = now;
    player.deliveryQuestCompletedAt = 0;

    const targetName = getDeliveryQuestTargetName(target.npc);
    this.setNpcChatPhase(
      giver,
      'done',
      `Hey, can you help me make this delivery to ${targetName}? Good. Take it straight there and do not open it.`,
      { bumpSeq: true }
    );
    this.emit();

    return {
      ok: true,
      targetName,
      ...this.getDeliveryQuestPayload(player)
    };
  }

  async completeDeliveryQuest(targetNpcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot deliver that right now.' };
    }

    if (!isDeliveryQuestActive(player)) {
      return { ok: false, error: 'You do not have a delivery to complete.' };
    }

    const normalizedTargetNpcId = typeof targetNpcId === 'string'
      ? targetNpcId.trim()
      : '';
    if (normalizedTargetNpcId !== player.deliveryQuestTargetNpcId) {
      return { ok: false, error: 'That is not the delivery contact.' };
    }

    const target = this.state.npcs.get(normalizedTargetNpcId);
    if (!target || !isNpcAvailableForDelivery(target)) {
      return { ok: false, error: 'The delivery contact is not available.' };
    }

    if (!this.isPlayerInNpcInteractRadius(player, target)) {
      return { ok: false, error: 'Move closer to deliver the package.' };
    }

    const now = Date.now();
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.completed;
    player.deliveryQuestCompletedAt = now;
    player.deliveryQuestRecentTargetNpcIds = addDeliveryQuestRecentTargetId(
      player.deliveryQuestRecentTargetNpcIds,
      normalizedTargetNpcId
    );
    player.deliveryQuestCompletionCount = Math.max(
      0,
      Math.floor(Number(player.deliveryQuestCompletionCount ?? 0) || 0)
    ) + 1;
    const currentMoney = Number(player.money ?? 0);
    player.money = (Number.isFinite(currentMoney) ? Math.trunc(currentMoney) : 0) + DELIVERY_QUEST_REWARD_AMOUNT;

    const giver = this.state.npcs.get(player.deliveryQuestGiverNpcId);
    const giverName = giver?.name || 'your friend';
    this.setNpcChatPhase(
      target,
      'done',
      `Got it. Tell ${giverName} the package landed.`,
      { bumpSeq: true }
    );
    this.emit();

    return {
      ok: true,
      targetName: getDeliveryQuestTargetName(target),
      ...this.getDeliveryQuestPayload(player)
    };
  }

  async claimWorkoutPlacement(placementId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot use that right now.' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    const target = this.getNpcTargetOption(normalizedPlacementId);
    if (!normalizedPlacementId || !target?.workoutType) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    if (player.workoutPlacementId === normalizedPlacementId) {
      return { ok: true, placementId: normalizedPlacementId };
    }

    if (this.isWorkoutPlacementOccupied(normalizedPlacementId, { ignorePlayerId: this.state.sessionId })) {
      return { ok: false, error: 'That barbell is already in use.' };
    }

    player.workoutPlacementId = normalizedPlacementId;
    this.emit();
    return { ok: true, placementId: normalizedPlacementId };
  }

  async completeWorkoutPlacement(placementId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot complete that workout right now.' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    const target = this.getNpcTargetOption(normalizedPlacementId);
    if (!normalizedPlacementId || !target?.workoutType) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    if (player.workoutPlacementId !== normalizedPlacementId) {
      return { ok: false, error: 'That workout is not active.' };
    }

    player.gymPumpCompletedAt = Date.now();
    player.workoutPlacementId = '';
    this.emit();
    return {
      ok: true,
      placementId: normalizedPlacementId,
      gymPumpCompletedAt: player.gymPumpCompletedAt
    };
  }

  async releaseWorkoutPlacement(placementId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return { ok: true, placementId: '' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    if (!normalizedPlacementId || player.workoutPlacementId === normalizedPlacementId) {
      player.workoutPlacementId = '';
      this.emit();
    }

    return { ok: true, placementId: player.workoutPlacementId || '' };
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

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isReloading && player.reloadEndsAt && now >= player.reloadEndsAt) {
        this.completeReload(player);
        stateChanged = true;
      }

      if (player.alive === false && player.respawnAt && now >= player.respawnAt) {
        this.finishRespawn(sessionId, player);
        stateChanged = true;
        continue;
      }

      stateChanged = this.updatePlayerHealthRegen(sessionId, player, now, deltaMs) || stateChanged;
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

  finishRespawn(sessionId, player) {
    const livingOthers = [...this.state.players.entries()]
      .filter(([id, candidate]) => id !== sessionId && candidate.alive !== false)
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
    player.workoutPlacementId = '';
    player.lastPunchAt = 0;
    player.lastShotAt = 0;
    this.getPlayerRuntimeMeta(sessionId).healthRegenCarryMs = 0;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq += 1;
    this.emitCombatEvent({
      type: 'respawn',
      playerId: sessionId,
      x: spawnX,
      z: spawnZ
    });
  }

  handlePlayerDeath(playerId, killerId = '') {
    const player = this.state.players.get(playerId);
    if (!player || player.alive === false) {
      return;
    }

    this.getPlayerRuntimeMeta(playerId).healthRegenCarryMs = 0;

    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.deaths += 1;
    player.workoutPlacementId = '';
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
    this.playerRuntimeMeta.clear();
    window.clearInterval(this.combatTick);
  }

  updatePlayerHealthRegen(sessionId, player, now, deltaMs) {
    if (!player || player.alive === false) {
      return false;
    }

    const meta = this.getPlayerRuntimeMeta(sessionId);
    const regen = tickHealthRegen({
      health: player.health,
      maxHealth: player.maxHealth,
      alive: player.alive !== false,
      deltaMs,
      now,
      lastDamagedAt: player.lastDamagedAt,
      lastCombatAt: Math.max(player.lastShotAt ?? 0, player.lastPunchAt ?? 0),
      carryMs: meta.healthRegenCarryMs
    });

    meta.healthRegenCarryMs = regen.carryMs;
    if (regen.healed <= 0 || regen.health === player.health) {
      return false;
    }

    player.health = regen.health;
    return true;
  }

  isAdmin() {
    return this.state.players.get(this.state.sessionId)?.isAdmin === true;
  }
}

Object.assign(NpcServiceMock.prototype, npcSimulationMethods);
