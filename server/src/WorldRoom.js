import { Room } from 'colyseus';
import { MapSchema, schema } from '@colyseus/schema';
import {
  COMBAT_PICKUP_SPAWNS,
  COMBAT_RESPAWN_POINTS,
  DROPPED_PICKUP_DESPAWN_MS,
  PICKUP_INTERACT_RADIUS,
  PUNCH_DAMAGE,
  PUNCH_INTERVAL_MS,
  PUNCH_RANGE,
  PICKUP_RESPAWN_MS,
  PLAYER_MAX_ACCEPTED_SPEED,
  PLAYER_MAX_HEALTH,
  PLAYER_POSITION_FORGIVENESS,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  WEAPON_CLIP_SIZE,
  WEAPON_DAMAGE,
  WEAPON_FIRE_INTERVAL_MS,
  WEAPON_IDS,
  WEAPON_RANGE,
  WEAPON_RELOAD_MS,
  WEAPON_RESERVE_CAP
} from '../../src/shared/combatConstants.js';
import {
  chooseFarthestSpawnPoint,
  clampToWorldBounds,
  distance2D,
  normalizeAimVector,
  placementToCollisionRects,
  rayCircleIntersectionDistance,
  rayRectIntersectionDistance
} from '../../src/shared/combatMath.js';
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
  normalizeNpcBehavior
} from '../../src/npc/npcBehavior.js';
import { getNpcModelById } from '../../src/npc/npcCatalog.js';
import {
  buildNpcPathToPlacement,
  buildNpcPathToPosition,
  buildNpcRouteGraph,
  findFarthestRouteNodeFrom
} from '../../src/npc/npcRouteGraph.js';
import {
  collectNpcTargetOptions,
  getPlacementApproachPoint,
  getPlacementWorldOrigin,
  isBuildingPlacement,
  resolveNpcTargetOption
} from '../../src/npc/npcTargeting.js';
import { EMOTES_BY_ID, PUNCH_EMOTE_ID } from '../../src/player/emotes.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById,
  isPlayableCharacterId
} from '../../src/player/playableCharacterCatalog.js';
import { getBuilderItemById } from '../../src/world/builderCatalog.js';
import { WorldState } from '../../src/world/WorldState.js';
import { NpcChatEngine } from './NpcChatEngine.js';
import { isNpcDebugEnabled, logNpcDebug, logServer, logServerError } from './logger.js';
import { getWorldPersistence } from './worldPersistence.js';

const MAX_MESSAGE_LENGTH = 280;
const MAX_TRANSCRIPT_ENTRIES = 18;
const CHAT_COOLDOWN_MS = 900;
const NPC_NAME_MAX_LENGTH = 40;
const NPC_PROMPT_MAX_LENGTH = 1600;
const NPC_STREAM_THROTTLE_MS = 80;
const COMBAT_TICK_MS = 100;
const LIMP_EMOTE_ID = 'limp';
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
const NPC_DEBUG_BROADCAST_INTERVAL_MS = 120;

function parseAdminKeys(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

const PlayerState = schema({
  x: 'number',
  z: 'number',
  rotationY: 'number',
  aimRotationY: 'number',
  aiming: 'boolean',
  emoteId: 'string',
  emoteActive: 'boolean',
  emoteStartedAt: 'number',
  emoteSeq: 'number',
  chatText: 'string',
  chatStartedAt: 'number',
  chatSeq: 'number',
  health: 'number',
  maxHealth: 'number',
  alive: 'boolean',
  respawnAt: 'number',
  spawnProtectedUntil: 'number',
  equippedWeaponId: 'string',
  ammoInClip: 'number',
  reserveAmmo: 'number',
  isReloading: 'boolean',
  reloadEndsAt: 'number',
  kills: 'number',
  deaths: 'number',
  lastDamagedAt: 'number',
  characterId: 'string',
  isAdmin: 'boolean'
});

const PickupState = schema({
  id: 'string',
  weaponId: 'string',
  x: 'number',
  z: 'number',
  ammoInClip: 'number',
  reserveAmmo: 'number',
  kind: 'string',
  active: 'boolean',
  respawnAt: 'number',
  despawnAt: 'number'
});

const BuilderPresenceState = schema({
  active: 'boolean',
  itemId: 'string',
  layer: 'string',
  rotationQuarterTurns: 'number',
  cellX: 'number',
  cellZ: 'number',
  x: 'number',
  z: 'number',
  selectionPlacementId: 'string'
});

const NpcState = schema({
  id: 'string',
  modelId: 'string',
  name: 'string',
  x: 'number',
  z: 'number',
  rotationY: 'number',
  rotationQuarterTurns: 'number',
  interactRadius: 'number',
  health: 'number',
  maxHealth: 'number',
  alive: 'boolean',
  respawnAt: 'number',
  active: 'boolean',
  mode: 'string',
  currentStepIndex: 'number',
  targetPlacementId: 'string',
  weaponId: 'string',
  lastAttackerId: 'string',
  hiddenUntil: 'number',
  activity: 'string',
  lastDamagedAt: 'number',
  busy: 'boolean',
  chatStatus: 'string',
  chatText: 'string',
  chatStartedAt: 'number',
  chatSeq: 'number'
});

const WorldRoomState = schema({
  players: {
    map: PlayerState,
    default: new MapSchema()
  },
  builders: {
    map: BuilderPresenceState,
    default: new MapSchema()
  },
  npcs: {
    map: NpcState,
    default: new MapSchema()
  },
  pickups: {
    map: PickupState,
    default: new MapSchema()
  }
});

function trimTranscript(entries) {
  return entries.slice(Math.max(0, entries.length - MAX_TRANSCRIPT_ENTRIES));
}

function createTranscriptEntry(id, speaker, author, text) {
  return {
    id,
    speaker,
    author,
    text,
    createdAt: Date.now()
  };
}

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

function toRotationY(rotationQuarterTurns) {
  return normalizeRotationQuarterTurns(rotationQuarterTurns) * (Math.PI / 2);
}

function quantizeRotationQuarterTurnsFromRotationY(rotationY) {
  return normalizeRotationQuarterTurns(Math.round(Number(rotationY ?? 0) / (Math.PI / 2)));
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
    attackTargetPlayerId: '',
    attackTargetNpcId: '',
    ...overrides
  };
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

function sanitizePlayerAnimationState(message = {}) {
  const emoteId = typeof message.emoteId === 'string' ? message.emoteId.trim() : '';
  const hasValidEmote = emoteId === LIMP_EMOTE_ID || Object.hasOwn(EMOTES_BY_ID, emoteId);
  const emoteActive = Boolean(message.emoteActive && hasValidEmote);
  const emoteStartedAt = Number(message.emoteStartedAt);
  const emoteSeq = Number(message.emoteSeq);
  const aimRotationY = Number(message.aimRotationY);

  return {
    emoteId: emoteActive ? emoteId : '',
    emoteActive,
    emoteStartedAt: emoteActive && Number.isFinite(emoteStartedAt) ? Math.max(0, Math.floor(emoteStartedAt)) : 0,
    emoteSeq: Number.isFinite(emoteSeq) ? Math.max(0, Math.floor(emoteSeq)) : 0,
    aimRotationY: Number.isFinite(aimRotationY) ? quantizeRotation(aimRotationY) : 0,
    aiming: Boolean(message.aiming)
  };
}

function sanitizeCharacterId(characterId) {
  if (typeof characterId !== 'string') {
    return DEFAULT_PLAYABLE_CHARACTER_ID;
  }

  const normalized = characterId.trim();
  return isPlayableCharacterId(normalized)
    ? normalized
    : getPlayableCharacterById(DEFAULT_PLAYABLE_CHARACTER_ID).id;
}

function clampNpcRadius(value) {
  const numeric = Number(value ?? 4.2);
  return Math.max(1.5, Math.min(12, Number.isFinite(numeric) ? numeric : 4.2));
}

function defaultNpcPrompt(label) {
  return `You are ${label}, an NPC in Vibe Theft Auto. Stay in character, keep answers grounded in the city, and respond in short, flavorful lines.`;
}

function createPickupState(definition, {
  kind = 'spawn',
  active = true,
  respawnAt = 0,
  despawnAt = 0
} = {}) {
  const pickup = new PickupState();
  pickup.id = definition.id;
  pickup.weaponId = definition.weaponId;
  pickup.x = quantizePosition(definition.x ?? definition.position?.[0]);
  pickup.z = quantizePosition(definition.z ?? definition.position?.[1]);
  pickup.ammoInClip = Math.max(0, Math.floor(definition.ammoInClip ?? 0));
  pickup.reserveAmmo = Math.max(0, Math.floor(definition.reserveAmmo ?? 0));
  pickup.kind = kind;
  pickup.active = active;
  pickup.respawnAt = Math.max(0, Math.floor(respawnAt));
  pickup.despawnAt = Math.max(0, Math.floor(despawnAt));
  return pickup;
}

export class WorldRoom extends Room {
  onCreate() {
    this.maxClients = 16;
    this.setState(new WorldRoomState());
    this.adminKeys = parseAdminKeys(process.env.ADMIN_KEYS ?? process.env.ADMIN_KEY ?? '');
    this.chatEngine = new NpcChatEngine();
    this.worldState = new WorldState();
    this.worldPersistence = getWorldPersistence();
    this.npcDefinitions = new Map();
    this.npcRuntimeMeta = new Map();
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.sequence = 0;
    this.playerAliasSequence = 0;
    this.playerPositionMeta = new Map();
    this.pickupSequence = 0;
    this.npcRouteGraph = null;
    this.lastNpcSimulationAt = Date.now();
    this.npcDebugEnabled = isNpcDebugEnabled();
    this.lastNpcDebugBroadcastAt = 0;
    this.lastNpcDebugPayloadSignature = '';

    this.worldState.loadLayout(this.worldPersistence.getInitialLayout());
    this.syncNpcDefinitionsFromWorld();
    this.seedCombatPickups();
    this.clock.setInterval(() => {
      this.updateCombatTimers();
    }, COMBAT_TICK_MS);
    logServer('room', 'World room created.', {
      roomId: this.roomId,
      maxClients: this.maxClients,
      npcCount: this.state.npcs.size,
      pickupCount: this.state.pickups.size
    });
    this.logNpcDebugEvent('', 'room-created', {
      roomId: this.roomId,
      npcCount: this.state.npcs.size
    });

    this.onMessage('player:updateTransform', (client, message) => {
      this.updatePlayerTransform(client, message);
    });

    this.onMessage('player:setCharacter', (client, message) => {
      this.updatePlayerCharacter(client, message);
    });

    this.onMessage('builder:updatePresence', (client, message) => {
      try {
        this.updateBuilderPresence(client, message);
      } catch (error) {
        logServerError('room', 'Builder presence update failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('world:getLayout', (client, message) => {
      void this.handleRpc(client, message.requestId, () => ({
        layout: this.worldState.serializeLayout()
      }));
    });

    this.onMessage('world:edit', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWorldEdit(client, message));
    });

    this.onMessage('chat:say', async (client, message) => {
      try {
        const result = await this.handlePublicChat(client, message);
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: true,
          ...result
        });
      } catch (error) {
        logServerError('room', 'Public chat request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: false,
          error: error.message || 'Chat failed.'
        });
      }
    });

    this.onMessage('combat:pickupRequest', (client, message) => {
      try {
        this.handlePickupRequest(client, message);
      } catch (error) {
        logServerError('room', 'Pickup request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:fireRequest', (client, message) => {
      try {
        this.handleFireRequest(client, message);
      } catch (error) {
        logServerError('room', 'Fire request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:punchRequest', (client, message) => {
      try {
        this.handlePunchRequest(client, message);
      } catch (error) {
        logServerError('room', 'Punch request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:reloadRequest', (client) => {
      try {
        this.handleReloadRequest(client);
      } catch (error) {
        logServerError('room', 'Reload request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });
  }

  onJoin(client, options = {}) {
    const player = new PlayerState();
    const [spawnX, spawnZ] = this.chooseRespawnPoint(client.sessionId);
    const isAdmin = this.isAdminJoin(options);
    player.x = quantizePosition(spawnX);
    player.z = quantizePosition(spawnZ);
    player.rotationY = 0;
    player.aimRotationY = 0;
    player.aiming = false;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq = 0;
    player.chatText = '';
    player.chatStartedAt = 0;
    player.chatSeq = 0;
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
    player.kills = 0;
    player.deaths = 0;
    player.lastDamagedAt = 0;
    player.characterId = DEFAULT_PLAYABLE_CHARACTER_ID;
    player.isAdmin = isAdmin;
    this.state.players.set(client.sessionId, player);
    this.playerPositionMeta.set(client.sessionId, {
      x: player.x,
      z: player.z,
      acceptedAt: Date.now(),
      lastPunchAt: 0,
      lastShotAt: 0
    });
    this.playerAliasSequence += 1;
    this.playerAliases.set(client.sessionId, `Player ${this.playerAliasSequence}`);
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      isAdmin,
      connectedClients: this.clients.length
    });
    this.broadcastNpcDebugSnapshot(Date.now(), { force: true });
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.state.builders.delete(client.sessionId);
    this.playerAliases.delete(client.sessionId);
    this.playerPositionMeta.delete(client.sessionId);
    logServer('room', 'Client left world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  async onDispose() {}

  isAdminJoin(options = {}) {
    const providedKey = typeof options.adminKey === 'string'
      ? options.adminKey.trim()
      : '';

    return Boolean(providedKey && this.adminKeys.size > 0 && this.adminKeys.has(providedKey));
  }

  isAdminClient(client) {
    return this.state.players.get(client.sessionId)?.isAdmin === true;
  }

  assertAdminClient(client) {
    if (!this.isAdminClient(client)) {
      throw new Error('Admin access required.');
    }
  }

  seedCombatPickups() {
    this.state.pickups.clear();
    for (const spawn of COMBAT_PICKUP_SPAWNS) {
      const pickup = createPickupState({
        id: spawn.id,
        weaponId: spawn.weaponId,
        position: spawn.position,
        ammoInClip: spawn.ammoInClip,
        reserveAmmo: spawn.reserveAmmo
      });
      this.state.pickups.set(pickup.id, pickup);
    }
  }

  chooseRespawnPoint(exceptSessionId = '') {
    const livingPlayers = [...this.state.players.entries()]
      .filter(([sessionId, player]) => sessionId !== exceptSessionId && player.alive !== false)
      .map(([, player]) => ({ x: player.x, z: player.z }));
    return chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS, livingPlayers);
  }

  getPlayerMeta(sessionId) {
    if (!this.playerPositionMeta.has(sessionId)) {
      const player = this.state.players.get(sessionId);
      this.playerPositionMeta.set(sessionId, {
        x: player?.x ?? 0,
        z: player?.z ?? 0,
        acceptedAt: Date.now(),
        lastPunchAt: 0,
        lastShotAt: 0
      });
    }

    return this.playerPositionMeta.get(sessionId);
  }

  updatePlayerTransform(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const now = Date.now();
    const nextPosition = clampToWorldBounds(Number(message.x), Number(message.z));
    const meta = this.getPlayerMeta(client.sessionId);
    const elapsedSeconds = Math.max((now - meta.acceptedAt) / 1000, 0.016);
    const maxDistance = PLAYER_POSITION_FORGIVENESS + (PLAYER_MAX_ACCEPTED_SPEED * elapsedSeconds);
    const travelled = distance2D(meta.x, meta.z, nextPosition.x, nextPosition.z);
    if (travelled > maxDistance) {
      return;
    }

    player.x = quantizePosition(nextPosition.x);
    player.z = quantizePosition(nextPosition.z);
    meta.x = player.x;
    meta.z = player.z;
    meta.acceptedAt = now;

    const rotationY = Number(message.rotationY);
    if (Number.isFinite(rotationY)) {
      player.rotationY = quantizeRotation(rotationY);
    }

    const animationState = sanitizePlayerAnimationState(message);
    player.emoteId = animationState.emoteId;
    player.emoteActive = animationState.emoteActive;
    player.emoteStartedAt = animationState.emoteStartedAt;
    player.emoteSeq = animationState.emoteSeq;
    player.aimRotationY = animationState.aimRotationY;
    player.aiming = animationState.aiming;
  }

  updatePlayerCharacter(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isAdminClient(client)) {
      return;
    }

    player.characterId = sanitizeCharacterId(message?.characterId);
  }

  updateCombatTimers() {
    const now = Date.now();
    const deltaMs = Math.max(16, now - this.lastNpcSimulationAt);
    this.lastNpcSimulationAt = now;

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isReloading && player.reloadEndsAt && now >= player.reloadEndsAt) {
        this.completeReload(player);
      }

      if (player.alive === false && player.respawnAt && now >= player.respawnAt) {
        this.finishRespawn(sessionId, player);
      }
    }

    for (const pickup of [...this.state.pickups.values()]) {
      if (!pickup.active && pickup.kind === 'spawn' && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.active = true;
        pickup.respawnAt = 0;
      }

      if (pickup.kind === 'drop' && pickup.despawnAt && now >= pickup.despawnAt) {
        this.state.pickups.delete(pickup.id);
      }
    }

    this.updateNpcSimulation(now, deltaMs);
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
    const [spawnX, spawnZ] = this.chooseRespawnPoint(sessionId);
    player.x = quantizePosition(spawnX);
    player.z = quantizePosition(spawnZ);
    player.rotationY = 0;
    player.aimRotationY = 0;
    player.aiming = false;
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
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq += 1;
    const meta = this.getPlayerMeta(sessionId);
    meta.x = player.x;
    meta.z = player.z;
    meta.acceptedAt = Date.now();
    meta.lastPunchAt = 0;
    meta.lastShotAt = 0;
    this.broadcastCombatEvent({
      type: 'respawn',
      playerId: sessionId,
      x: player.x,
      z: player.z
    });
  }

  startReload(sessionId, player, { emitEvent = true } = {}) {
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

    const now = Date.now();
    player.isReloading = true;
    player.reloadEndsAt = now + WEAPON_RELOAD_MS;
    if (emitEvent) {
      this.broadcastCombatEvent({
        type: 'reload',
        playerId: sessionId,
        weaponId: player.equippedWeaponId,
        startedAt: now,
        endsAt: player.reloadEndsAt
      });
    }
    return true;
  }

  handleReloadRequest(client) {
    const player = this.state.players.get(client.sessionId);
    this.startReload(client.sessionId, player);
  }

  handlePickupRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const pickup = this.state.pickups.get(String(message.pickupId ?? ''));
    if (!pickup?.active) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    if (distance2D(meta.x, meta.z, pickup.x, pickup.z) > PICKUP_INTERACT_RADIUS) {
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
    this.broadcastCombatEvent({
      type: 'pickup',
      playerId: client.sessionId,
      pickupId: pickup.id,
      weaponId: pickup.weaponId
    });
  }

  handleFireRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false || !player.equippedWeaponId || player.isReloading) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    const now = Date.now();
    if (player.ammoInClip <= 0 || (now - (meta.lastShotAt ?? 0)) < WEAPON_FIRE_INTERVAL_MS) {
      return;
    }

    const aim = normalizeAimVector(Number(message.aimX), Number(message.aimZ));
    const shotOrigin = this.resolveShotOrigin(player, {
      x: Number(message.originX),
      z: Number(message.originZ)
    });
    meta.lastShotAt = now;
    player.ammoInClip = Math.max(0, player.ammoInClip - 1);

    const shot = this.resolveShot(client.sessionId, player, aim, shotOrigin);
    this.broadcastCombatEvent({
      type: 'shot',
      shooterType: 'player',
      shooterId: client.sessionId,
      weaponId: player.equippedWeaponId,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt: Number.isFinite(message.clientShotAt) ? Math.max(0, Math.floor(message.clientShotAt)) : now
    });

    if (shot.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterId: client.sessionId,
        shooterType: 'player',
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
          this.handlePlayerDeath(shot.targetId, client.sessionId);
        }
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, client.sessionId, now);
    }

    if (player.ammoInClip <= 0 && player.reserveAmmo > 0) {
      this.startReload(client.sessionId, player);
    }
  }

  handlePunchRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    const now = Date.now();
    if ((now - (meta.lastPunchAt ?? 0)) < PUNCH_INTERVAL_MS) {
      return;
    }

    const aim = normalizeAimVector(Number(message.aimX), Number(message.aimZ));
    meta.lastPunchAt = now;
    player.emoteId = PUNCH_EMOTE_ID;
    player.emoteActive = true;
    player.emoteStartedAt = now;
    player.emoteSeq += 1;

    const hit = this.resolvePunch(client.sessionId, player, aim);
    if (hit.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterId: client.sessionId,
        shooterType: 'player',
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt: Number.isFinite(message.clientPunchAt) ? Math.max(0, Math.floor(message.clientPunchAt)) : now
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - PUNCH_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, client.sessionId);
        }
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, client.sessionId, now);
    }
  }

  handlePlayerDeath(victimId, killerId = '') {
    const player = this.state.players.get(victimId);
    if (!player || player.alive === false) {
      return;
    }

    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.deaths += 1;
    player.emoteId = LIMP_EMOTE_ID;
    player.emoteActive = true;
    player.emoteStartedAt = Date.now();
    player.emoteSeq += 1;
    this.dropWeaponPickup(player);
    player.equippedWeaponId = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;

    if (killerId && killerId !== victimId) {
      const killer = this.state.players.get(killerId);
      if (killer) {
        killer.kills += 1;
      }
    }

    this.broadcastCombatEvent({
      type: 'death',
      victimId,
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

    const pickup = createPickupState({
      id: `pickup_drop_${++this.pickupSequence}`,
      weaponId: player.equippedWeaponId,
      x: player.x,
      z: player.z,
      ammoInClip: player.ammoInClip,
      reserveAmmo: player.reserveAmmo
    }, {
      kind: 'drop',
      active: true,
      despawnAt: Date.now() + DROPPED_PICKUP_DESPAWN_MS
    });
    this.state.pickups.set(pickup.id, pickup);
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
      x: Number.isFinite(origin?.x) ? origin.x : player.x,
      z: Number.isFinite(origin?.z) ? origin.z : player.z
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
    let nearestDistance = WEAPON_RANGE;
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

  resolveShot(shooterSessionId, player, aim, origin = player) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignorePlayerId: shooterSessionId
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

  resolvePunch(attackerSessionId, player, aim) {
    return this.resolveCombatPunch(player, aim, PUNCH_RANGE, {
      ignorePlayerId: attackerSessionId
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
    this.broadcastCombatEvent({
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
      this.broadcastCombatEvent({
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
      this.broadcastCombatEvent({
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

  broadcastCombatEvent(event) {
    this.broadcast('combat:event', event);
  }

  async handleRpc(client, requestId, handler) {
    try {
      const payload = await Promise.resolve().then(() => handler());
      client.send('rpc:response', {
        requestId,
        ok: true,
        ...payload
      });
    } catch (error) {
      logServerError('room', 'RPC request failed.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        requestId
      });
      client.send('rpc:response', {
        requestId,
        ok: false,
        error: error.message || 'Request failed.'
      });
    }
  }

  async commitWorldPatch(patch, previousLayout) {
    const nextLayout = this.worldState.serializeLayout();

    try {
      await this.worldPersistence.save(nextLayout);
    } catch (error) {
      this.worldState.loadLayout(previousLayout);
      this.syncNpcDefinitionsFromWorld();
      throw error;
    }

    this.broadcast('world:patch', patch);
    return {
      placementId: patch.placement?.id ?? patch.placementId ?? null
    };
  }

  async handleWorldEdit(client, message = {}) {
    this.assertAdminClient(client);
    const { op, payload = {} } = message;
    const previousLayout = this.worldState.serializeLayout();

    switch (op) {
      case 'placeTile': {
        const next = this.sanitizeTilePlacement(payload);
        const result = this.worldState.placeTile(
          next.item,
          next.cellX,
          next.cellZ,
          next.rotationQuarterTurns,
          next.interactable
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId
        }, previousLayout);
      }
      case 'placeProp': {
        const next = this.sanitizePropPlacement(payload);
        const placement = this.worldState.placeProp(
          next.item,
          next.x,
          next.z,
          next.rotationQuarterTurns,
          next.interactable
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'placeNpc': {
        const next = this.sanitizeNpcPlacement(payload);
        const placement = this.worldState.placeNpc(
          next.item,
          next.x,
          next.z,
          next.rotationQuarterTurns,
          next.npc
        );
        this.syncNpcDefinitionsFromWorld();
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'rotatePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        const result = this.worldState.rotatePlacement(placement.id);
        if (!result?.placement) {
          throw new Error(result?.error ?? 'That placement is not available.');
        }
        const rotated = result.placement;
        if (rotated.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
          this.resetNpcRuntimeState(rotated.id, { restartFromSpawn: true, reason: 'placement-rotated' });
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(rotated.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'movePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        const next = placement.layer === 'tile'
          ? this.sanitizeMovedTilePlacement(payload)
          : this.sanitizeMovedFreePlacement(payload);
        const result = this.worldState.movePlacement(placement.id, next);
        if (!result?.placement) {
          throw new Error(result?.error ?? 'That placement is not available.');
        }
        if (placement.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
          this.resetNpcRuntimeState(result.placement.id, { restartFromSpawn: true, reason: 'placement-moved' });
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId ?? null
        }, previousLayout);
      }
      case 'deletePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        this.worldState.deletePlacement(placement.id);
        if (placement.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
        }
        return this.commitWorldPatch({
          type: 'deletePlacement',
          placementId: placement.id
        }, previousLayout);
      }
      case 'updateNpc': {
        const placement = this.assertEditablePlacement(payload.placementId, 'npc');
        const updates = this.sanitizeNpcUpdates(payload);
        const updatedPlacement = this.worldState.updateNpc(placement.id, updates);
        if (!updatedPlacement) {
          throw new Error('That NPC is not available.');
        }

        this.syncNpcDefinitionsFromWorld();
        this.resetNpcRuntimeState(updatedPlacement.id, { restartFromSpawn: false, reason: 'npc-updated' });
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'updatePlacementInteractable': {
        const placement = this.assertEditablePlacement(payload.placementId);
        if (placement.layer === 'npc') {
          throw new Error('That placement cannot be edited this way.');
        }

        const interactable = this.sanitizePlacementInteractable(payload.interactable);
        const updatedPlacement = this.worldState.updatePlacementInteractable(placement.id, interactable);
        if (!updatedPlacement) {
          throw new Error('That placement is not available.');
        }

        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      default:
        throw new Error('That world edit is not supported.');
    }
  }

  updateBuilderPresence(client, message) {
    this.assertAdminClient(client);
    const sanitized = this.sanitizeBuilderPresence(message);
    if (!sanitized.active) {
      this.state.builders.delete(client.sessionId);
      return { active: false };
    }

    const presence = this.state.builders.get(client.sessionId) ?? new BuilderPresenceState();
    presence.active = true;
    presence.itemId = sanitized.itemId;
    presence.layer = sanitized.layer;
    presence.rotationQuarterTurns = sanitized.rotationQuarterTurns;
    presence.cellX = sanitized.cellX;
    presence.cellZ = sanitized.cellZ;
    presence.x = sanitized.x;
    presence.z = sanitized.z;
    presence.selectionPlacementId = sanitized.selectionPlacementId;
    this.state.builders.set(client.sessionId, presence);
    return { active: true };
  }

  sanitizeBuilderPresence(message = {}) {
    const active = Boolean(message.active);
    if (!active) {
      return { active: false };
    }

    const item = getBuilderItemById(message.itemId);
    if (!item) {
      throw new Error('That builder item is not available.');
    }

    return {
      active: true,
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      cellX: Math.round(Number(message.cellX ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? 0)),
      x: quantizePosition(message.x),
      z: quantizePosition(message.z),
      selectionPlacementId: typeof message.selectionPlacementId === 'string' ? message.selectionPlacementId : ''
    };
  }

  sanitizeTilePlacement(message = {}) {
    const item = getBuilderItemById(message.itemId);
    if (!item || item.layer !== 'tile') {
      throw new Error('That tile is not available.');
    }

    return {
      item,
      cellX: Math.round(Number(message.cellX ?? message.cell?.[0] ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? message.cell?.[1] ?? 0)),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      interactable: this.sanitizePlacementInteractable(message.interactable ?? item.interactable ?? null)
    };
  }

  sanitizePropPlacement(message = {}) {
    const item = getBuilderItemById(message.itemId);
    if (!item || item.layer !== 'prop') {
      throw new Error('That prop is not available.');
    }

    return {
      item,
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1]),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      interactable: this.sanitizePlacementInteractable(message.interactable ?? item.interactable ?? null)
    };
  }

  sanitizeNpcPlacement(message = {}) {
    const model = getNpcModelById(message.modelId);
    if (!model) {
      throw new Error('That NPC model is not available.');
    }

    const item = getBuilderItemById(model.itemId);
    if (!item || item.layer !== 'npc') {
      throw new Error('That NPC is not available.');
    }

    const name = String(message.name ?? item.label ?? 'NPC').trim().slice(0, NPC_NAME_MAX_LENGTH) || 'NPC';
    return {
      item,
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1]),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      npc: normalizeNpcBehavior({
        modelId: model.id,
        name,
        prompt: String(message.prompt ?? defaultNpcPrompt(name)).slice(0, NPC_PROMPT_MAX_LENGTH),
        interactRadius: clampNpcRadius(message.interactRadius ?? item.interactionRadius ?? 4.2),
        active: message.active !== false,
        respawnDelayMs: message.respawnDelayMs,
        routine: message.routine,
        combat: message.combat,
        spawnPosition: [quantizePosition(message.x ?? message.position?.[0]), quantizePosition(message.z ?? message.position?.[1])],
        spawnRotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
      }, {
        position: [quantizePosition(message.x ?? message.position?.[0]), quantizePosition(message.z ?? message.position?.[1])],
        rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
      })
    };
  }

  sanitizeNpcUpdates(message = {}) {
    const updates = {};

    if (Object.hasOwn(message, 'name')) {
      updates.name = String(message.name ?? 'NPC').trim().slice(0, NPC_NAME_MAX_LENGTH) || 'NPC';
    }
    if (Object.hasOwn(message, 'prompt')) {
      updates.prompt = String(message.prompt ?? '').slice(0, NPC_PROMPT_MAX_LENGTH);
    }
    if (Object.hasOwn(message, 'interactRadius')) {
      updates.interactRadius = clampNpcRadius(message.interactRadius);
    }
    if (Object.hasOwn(message, 'active')) {
      updates.active = message.active !== false;
    }
    if (Object.hasOwn(message, 'respawnDelayMs')) {
      updates.respawnDelayMs = normalizeNpcBehavior({ respawnDelayMs: message.respawnDelayMs }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).respawnDelayMs;
    }
    if (Object.hasOwn(message, 'routine')) {
      updates.routine = normalizeNpcBehavior({ routine: message.routine }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).routine;
    }
    if (Object.hasOwn(message, 'combat')) {
      updates.combat = normalizeNpcBehavior({ combat: message.combat }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).combat;
    }
    if (Object.hasOwn(message, 'modelId')) {
      const model = getNpcModelById(message.modelId);
      if (!model) {
        throw new Error('That NPC model is not available.');
      }
      updates.modelId = model.id;
      updates.itemId = model.itemId;
    }

    if (!Object.keys(updates).length) {
      throw new Error('No NPC changes were provided.');
    }

    return updates;
  }

  sanitizeMovedTilePlacement(message = {}) {
    return {
      cellX: Math.round(Number(message.cellX ?? message.cell?.[0] ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? message.cell?.[1] ?? 0))
    };
  }

  sanitizeMovedFreePlacement(message = {}) {
    return {
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1])
    };
  }

  sanitizePlacementInteractable(interactable = null) {
    if (!interactable || typeof interactable !== 'object') {
      return null;
    }

    const next = {};

    if (Object.hasOwn(interactable, 'label')) {
      const value = String(interactable.label ?? '').trim().slice(0, 48);
      if (value) {
        next.label = value;
      }
    }
    if (Object.hasOwn(interactable, 'prompt')) {
      const value = String(interactable.prompt ?? '').trim().slice(0, 80);
      if (value) {
        next.prompt = value;
      }
    }
    if (Object.hasOwn(interactable, 'actionText')) {
      const value = String(interactable.actionText ?? '').trim().slice(0, 240);
      if (value) {
        next.actionText = value;
      }
    }

    next.radius = clampNpcRadius(interactable.radius ?? 4);
    next.distance = Math.max(1, Math.min(28, Number(interactable.distance ?? 6.16) || 6.16));

    if (Array.isArray(interactable.localOffset) && interactable.localOffset.length >= 2) {
      next.localOffset = [
        quantizePosition(interactable.localOffset[0]),
        quantizePosition(interactable.localOffset[1])
      ];
    }

    if (Array.isArray(interactable.approachLocalOffset) && interactable.approachLocalOffset.length >= 2) {
      next.approachLocalOffset = [
        quantizePosition(interactable.approachLocalOffset[0]),
        quantizePosition(interactable.approachLocalOffset[1])
      ];
    }

    if (typeof interactable.workoutType === 'string' && interactable.workoutType.trim()) {
      next.workoutType = interactable.workoutType.trim().slice(0, 32);
    }

    if (Number.isFinite(Number(interactable.approachRotationY))) {
      next.approachRotationY = quantizeRotation(Number(interactable.approachRotationY));
    }

    return next;
  }

  assertEditablePlacement(placementId, expectedLayer = null) {
    const placement = this.worldState.getPlacement(String(placementId ?? ''));
    if (!placement) {
      throw new Error('That placement is not available.');
    }

    if (expectedLayer && placement.layer !== expectedLayer) {
      throw new Error('That placement cannot be edited this way.');
    }

    return placement;
  }

  syncNpcDefinitionsFromWorld() {
    const definitions = this.worldState.serializeLayout().npcs ?? [];
    const nextIds = new Set(definitions.map((entry) => entry.id));

    for (const definition of definitions) {
      const normalizedDefinition = normalizeNpcBehavior(structuredClone(definition), {
        position: definition.position,
        rotationQuarterTurns: definition.rotationQuarterTurns
      });
      this.npcDefinitions.set(definition.id, normalizedDefinition);
      const existing = this.state.npcs.get(definition.id) ?? new NpcState();
      const spawnPosition = normalizedDefinition.spawnPosition ?? normalizedDefinition.position ?? definition.position;
      const spawnRotationQuarterTurns = normalizeRotationQuarterTurns(
        normalizedDefinition.spawnRotationQuarterTurns ?? definition.rotationQuarterTurns
      );
      const isExistingRuntimeValid = this.state.npcs.has(definition.id)
        && existing.alive !== false
        && existing.mode !== NPC_RUNTIME_MODES.hidden;
      existing.id = definition.id;
      existing.modelId = normalizedDefinition.modelId;
      existing.name = normalizedDefinition.name;
      existing.x = isExistingRuntimeValid ? quantizePosition(existing.x) : quantizePosition(spawnPosition[0]);
      existing.z = isExistingRuntimeValid ? quantizePosition(existing.z) : quantizePosition(spawnPosition[1]);
      existing.rotationY = isExistingRuntimeValid
        ? quantizeRotation(existing.rotationY)
        : quantizeRotation(toRotationY(spawnRotationQuarterTurns));
      existing.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(existing.rotationY);
      existing.interactRadius = clampNpcRadius(normalizedDefinition.interactRadius);
      existing.health = Math.max(0, Number(existing.health || NPC_DEFAULT_MAX_HEALTH));
      existing.maxHealth = Math.max(1, Number(existing.maxHealth || NPC_DEFAULT_MAX_HEALTH));
      existing.alive = existing.alive !== false && existing.health > 0;
      existing.respawnAt = Math.max(0, Math.floor(existing.respawnAt || 0));
      existing.active = normalizedDefinition.active !== false;
      existing.mode = existing.active
        ? (existing.alive === false ? NPC_RUNTIME_MODES.dead : (existing.mode || NPC_RUNTIME_MODES.routine))
        : NPC_RUNTIME_MODES.dead;
      existing.currentStepIndex = Math.max(0, Math.floor(existing.currentStepIndex || 0));
      existing.targetPlacementId = existing.targetPlacementId || '';
      existing.weaponId = normalizedDefinition.combat?.weaponId ?? '';
      existing.lastAttackerId = existing.lastAttackerId || '';
      existing.hiddenUntil = Math.max(0, Math.floor(existing.hiddenUntil || 0));
      existing.activity = existing.activity || '';
      existing.lastDamagedAt = Math.max(0, Math.floor(existing.lastDamagedAt || 0));
      existing.busy = existing.active ? Boolean(existing.busy) : false;
      existing.chatStatus = existing.chatStatus || 'idle';
      existing.chatText = existing.chatText || '';
      existing.chatStartedAt = Number(existing.chatStartedAt || 0);
      existing.chatSeq = Number(existing.chatSeq || 0);
      if (!this.npcRuntimeMeta.has(definition.id)) {
        this.npcRuntimeMeta.set(definition.id, createNpcRuntimeMeta());
      }
      if (!this.transcripts.has(definition.id)) {
        this.transcripts.set(definition.id, []);
      }
      this.state.npcs.set(definition.id, existing);
    }

    for (const npcId of [...this.state.npcs.keys()]) {
      if (nextIds.has(npcId)) {
        continue;
      }

      this.state.npcs.delete(npcId);
      this.npcDefinitions.delete(npcId);
      this.npcRuntimeMeta.delete(npcId);
      this.transcripts.delete(npcId);
      for (const cooldownKey of [...this.cooldowns.keys()]) {
        if (cooldownKey.endsWith(`:${npcId}`)) {
          this.cooldowns.delete(cooldownKey);
        }
      }
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
    meta.attackTargetPlayerId = '';
    meta.attackTargetNpcId = '';

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
    }

    this.logNpcDebugEvent(npcId, 'runtime-reset', {
      reason,
      restartFromSpawn
    });
  }

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
    npc.busy = false;
    npc.chatStatus = 'idle';
    npc.chatText = '';
    npc.chatStartedAt = 0;
    npc.chatSeq = Number(npc.chatSeq || 0);
    npc.weaponId = definition.combat?.weaponId ?? '';
    npc.x = quantizePosition(respawnPosition.x);
    npc.z = quantizePosition(respawnPosition.z);
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? toRotationY(definition.spawnRotationQuarterTurns ?? 0));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    this.resetNpcRuntimeState(npcId, { restartFromSpawn: false, reason: 'npc-respawned' });
    npc.x = quantizePosition(respawnPosition.x);
    npc.z = quantizePosition(respawnPosition.z);
    npc.rotationY = quantizeRotation(respawnTarget.rotationY ?? npc.rotationY);
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    npc.mode = npc.active === false ? NPC_RUNTIME_MODES.dead : NPC_RUNTIME_MODES.routine;
    npc.targetPlacementId = '';
    npc.activity = '';
    npc.respawnAt = 0;
    this.logNpcDebugEvent(npcId, 'respawned', {
      placementId: respawnTarget.placementId,
      source: respawnTarget.source,
      x: npc.x,
      z: npc.z,
      respawnDelayMs: Math.max(0, Number(definition.respawnDelayMs ?? 0)),
      now
    });
    this.broadcastCombatEvent({
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
    return this.npcDefinitions.get(npcId) ?? null;
  }

  getNpcSpawnPoint(definition) {
    const position = definition?.spawnPosition ?? definition?.position ?? [0, 0];
    return {
      x: quantizePosition(position[0]),
      z: quantizePosition(position[1])
    };
  }

  getNpcHomeAnchor(definition) {
    const routineSteps = definition?.routine?.steps ?? [];
    for (const step of routineSteps) {
      if (step?.type !== NPC_STEP_TYPES.enterHideAtPlacement) {
        continue;
      }

      const target = this.getNpcTargetOption(step.targetPlacementId);
      if (target) {
        return clonePoint(target.approachPosition);
      }
    }

    return this.getNpcSpawnPoint(definition);
  }

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

  logNpcDebugEvent(npcId, message, meta = null) {
    if (!this.npcDebugEnabled) {
      return;
    }

    const npc = npcId ? this.state.npcs.get(npcId) : null;
    logNpcDebug(message, {
      npcId: npcId || undefined,
      npcName: npc?.name || undefined,
      ...(meta ?? {})
    });
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
  }

  buildNpcDebugPayload(now = Date.now()) {
    const npcs = {};

    for (const [npcId, npc] of this.state.npcs.entries()) {
      const definition = this.getNpcDefinition(npcId);
      if (!definition) {
        continue;
      }

      npcs[npcId] = this.buildNpcDebugSnapshotEntry(npcId, npc, definition, now);
    }

    return {
      enabled: true,
      generatedAt: now,
      npcs
    };
  }

  broadcastNpcDebugSnapshot(now = Date.now(), { force = false } = {}) {
    if (!this.npcDebugEnabled) {
      return;
    }

    if (!force && (now - this.lastNpcDebugBroadcastAt) < NPC_DEBUG_BROADCAST_INTERVAL_MS) {
      return;
    }

    const payload = this.buildNpcDebugPayload(now);
    const signature = JSON.stringify(payload.npcs);
    if (!force && signature === this.lastNpcDebugPayloadSignature) {
      return;
    }

    this.lastNpcDebugPayloadSignature = signature;
    this.lastNpcDebugBroadcastAt = now;
    this.broadcast('npc:debugSnapshot', payload);
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
    const nextRoutineState = this.getCurrentNpcRoutineStep(definition, npc);
    this.logNpcDebugEvent(npcId, 'step-advanced', {
      currentStepIndex: npc.currentStepIndex,
      nextStepType: nextRoutineState?.step?.type ?? '',
      nextTargetPlacementId: nextRoutineState?.step?.targetPlacementId ?? ''
    });
  }

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
      this.logNpcDebugEvent(npcId, 'mode-changed', {
        from: previousMode,
        to: mode,
        targetPlacementId: npc.targetPlacementId || '',
        activity: npc.activity || '',
        hiddenUntil: npc.hiddenUntil ?? 0,
        lastAttackerId: npc.lastAttackerId || ''
      });
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
    this.logNpcDebugEvent(npcId, 'path-rebuilt', {
      pathKey,
      placementId,
      targetPosition: clonePoint(targetPosition),
      nodeCount: meta.path.length
    });
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
      return;
    }

    const { step } = routineState;
    const target = this.getNpcTargetOption(step.targetPlacementId);
    const meta = this.getNpcRuntimeMeta(npcId);
    const targetAnchor = target?.approachPosition ?? this.getNpcSpawnPoint(definition);

    if (!target && step.targetPlacementId) {
      this.logNpcDebugEvent(npcId, 'missing-target-skip-step', {
        stepType: step.type,
        targetPlacementId: step.targetPlacementId
      });
      this.advanceNpcRoutineStep(npcId, npc);
      return;
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
          return;
        }
        this.clearNpcIdlePause(npcId);
        this.advanceNpcRoutineStep(npcId, npc);
      }
      return;
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
          return;
        }
        this.clearNpcIdlePause(npcId);
        const hiddenDurationMs = Math.max(500, Math.floor(Number(step.hiddenDurationMs ?? 0) || 0));
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.hidden, {
          targetPlacementId: npc.targetPlacementId,
          hiddenUntil: now + hiddenDurationMs
        });
        this.clearNpcPath(npcId);
      }
      return;
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
          return;
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
      return;
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
          return;
        }
        this.clearNpcIdlePause(npcId);
      }
      if ((now - meta.stepStartedAt) >= durationMs) {
        this.advanceNpcRoutineStep(npcId, npc);
      }
    }
  }

  updateNpcCombatBehavior(npcId, npc, definition, now, deltaMs) {
    const combat = definition?.combat ?? {};
    const meta = this.getNpcRuntimeMeta(npcId);
    const targetPlayer = npc.lastAttackerId ? this.state.players.get(npc.lastAttackerId) : null;
    const homeAnchor = this.getNpcHomeAnchor(definition);

    if (!targetPlayer || targetPlayer.alive === false) {
      if (meta.calmEndsAt && now < meta.calmEndsAt) {
        return;
      }
      this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine, { targetPlacementId: '', activity: '' });
      this.clearNpcPath(npcId);
      return;
    }

    const threatPosition = { x: targetPlayer.x, z: targetPlayer.z };
    const distanceToThreat = distance2D(npc.x, npc.z, threatPosition.x, threatPosition.z);
    const distanceFromHome = distance2D(npc.x, npc.z, homeAnchor.x, homeAnchor.z);

    if (combat.archetype === NPC_COMBAT_ARCHETYPES.passive || combat.archetype === NPC_COMBAT_ARCHETYPES.flee) {
      const fleeTarget = findFarthestRouteNodeFrom(this.npcRouteGraph, threatPosition, homeAnchor) ?? homeAnchor;
      this.ensureNpcPathToPosition(
        npcId,
        { x: npc.x, z: npc.z },
        fleeTarget,
        `flee:${npc.lastAttackerId}:${fleeTarget.x},${fleeTarget.z}`,
        now
      );
      this.moveNpcAlongPath(npcId, npc, fleeTarget, deltaMs, { speed: NPC_DEFAULT_MOVE_SPEED * 1.15 });
      npc.activity = '';
      if (distanceToThreat >= combat.aggroRadius && now >= meta.calmEndsAt) {
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
        this.clearNpcPath(npcId);
      }
      return;
    }

    if (distanceFromHome > combat.leashRadius) {
      meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
      this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
      this.clearNpcPath(npcId);
      return;
    }

    meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
    npc.activity = '';
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
        this.moveNpcAlongPath(npcId, npc, threatPosition, deltaMs, { stopDistance: WEAPON_RANGE * 0.35 });
      }
      return;
    }

    if (distanceToThreat <= (PUNCH_RANGE + NPC_COMBAT_REACH_BUFFER) && (now - meta.lastAttackAt) >= NPC_PUNCH_INTERVAL_MS) {
      this.performNpcPunch(npcId, npc, threatPosition, now);
      meta.lastAttackAt = now;
      npc.activity = 'punch';
      return;
    }

    this.ensureNpcPathToPosition(
      npcId,
      { x: npc.x, z: npc.z },
      threatPosition,
      `combat:${npc.lastAttackerId}`,
      now
    );
    this.moveNpcAlongPath(npcId, npc, threatPosition, deltaMs, { stopDistance: PUNCH_RANGE * 0.72 });
  }

  updateNpcSimulation(now, deltaMs) {
    for (const [npcId, npc] of this.state.npcs.entries()) {
      const definition = this.getNpcDefinition(npcId);
      if (!definition || npc.active === false) {
        continue;
      }

      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.dead) {
        if (npc.respawnAt && now >= npc.respawnAt) {
          this.finishNpcRespawn(npcId, npc, definition, now);
          continue;
        }
        this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead);
        continue;
      }

      if (npc.mode === NPC_RUNTIME_MODES.hidden) {
        npc.activity = '';
        if (npc.hiddenUntil && now >= npc.hiddenUntil) {
          const target = this.getNpcTargetOption(npc.targetPlacementId);
          if (target?.approachPosition) {
            npc.x = quantizePosition(target.approachPosition.x);
            npc.z = quantizePosition(target.approachPosition.z);
          }
          this.logNpcDebugEvent(npcId, 'hidden-exit', {
            targetPlacementId: npc.targetPlacementId || '',
            reappearAt: clonePoint(target?.approachPosition)
          });
          this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.routine);
          this.advanceNpcRoutineStep(npcId, npc);
        }
        continue;
      }

      if (npc.mode === NPC_RUNTIME_MODES.combat || npc.mode === NPC_RUNTIME_MODES.flee) {
        this.updateNpcCombatBehavior(npcId, npc, definition, now, deltaMs);
      } else {
        this.updateNpcRoutine(npcId, npc, definition, now, deltaMs);
      }
    }

    this.broadcastNpcDebugSnapshot(now);
  }

  applyDamageToNpc(npcId, damage, attackerSessionId = '', now = Date.now()) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.getNpcDefinition(npcId);
    if (!npc || !definition || npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden) {
      return false;
    }

    npc.health = Math.max(0, npc.health - Math.max(0, Math.floor(damage)));
    npc.lastDamagedAt = now;
    npc.lastAttackerId = attackerSessionId || npc.lastAttackerId || '';
    this.logNpcDebugEvent(npcId, 'damaged', {
      damage: Math.max(0, Math.floor(damage)),
      attackerSessionId: attackerSessionId || '',
      health: npc.health,
      mode: npc.mode
    });
    const meta = this.getNpcRuntimeMeta(npcId);
    meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
    this.clearNpcPath(npcId);

    if (npc.health <= 0) {
      this.handleNpcDeath(npcId, attackerSessionId);
      return true;
    }

    const combat = definition.combat ?? {};
    const shouldFlee = combat.archetype === NPC_COMBAT_ARCHETYPES.passive
      || combat.archetype === NPC_COMBAT_ARCHETYPES.flee
      || npc.health <= Math.max(1, combat.fleeHealthThreshold ?? 0);
    this.setNpcMode(
      npcId,
      npc,
      shouldFlee ? NPC_RUNTIME_MODES.flee : NPC_RUNTIME_MODES.combat,
      { lastAttackerId: attackerSessionId, activity: '' }
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
    this.logNpcDebugEvent(npcId, 'died', {
      killerId,
      x: npc.x,
      z: npc.z,
      respawnAt: npc.respawnAt
    });
    this.setNpcMode(npcId, npc, NPC_RUNTIME_MODES.dead, { lastAttackerId: killerId });
    this.broadcastCombatEvent({
      type: 'death',
      victimId: npcId,
      victimType: 'npc',
      killerId,
      x: npc.x,
      z: npc.z
    });
  }

  appendTranscript(npcId, entry) {
    const current = this.transcripts.get(npcId) ?? [];
    const next = trimTranscript([...current, entry]);
    this.transcripts.set(npcId, next);
  }

  setPlayerSpeech(player, text) {
    player.chatText = text;
    player.chatStartedAt = Date.now();
    player.chatSeq += 1;
  }

  setNpcChatPhase(npc, status, text = npc.chatText || '', { bumpSeq = false } = {}) {
    npc.chatStatus = status;
    npc.chatText = text;
    npc.chatStartedAt = Date.now();
    if (bumpSeq) {
      npc.chatSeq += 1;
    }
  }

  getPlayerAlias(sessionId) {
    if (!this.playerAliases.has(sessionId)) {
      this.playerAliasSequence += 1;
      this.playerAliases.set(sessionId, `Player ${this.playerAliasSequence}`);
    }

    return this.playerAliases.get(sessionId);
  }

  sanitizeChatMessage(message) {
    const trimmedMessage = String(message ?? '').trim();
    if (!trimmedMessage) {
      throw new Error('Say something first.');
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are capped at ${MAX_MESSAGE_LENGTH} characters.`);
    }

    return trimmedMessage;
  }

  findNearestHeardNpc(player) {
    let nearestNpc = null;
    let nearestDistance = Infinity;

    for (const npc of this.state.npcs.values()) {
      if (!npc.active || npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden || npc.mode === NPC_RUNTIME_MODES.dead) {
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

  createNpcStreamPublisher(npcId) {
    let lastPublishedText = '';
    let lastPublishedAt = 0;

    return async (partialText) => {
      const liveNpc = this.state.npcs.get(npcId);
      if (!liveNpc || !liveNpc.busy) {
        return;
      }

      const now = Date.now();
      if (partialText === lastPublishedText || (now - lastPublishedAt) < NPC_STREAM_THROTTLE_MS) {
        return;
      }

      lastPublishedText = partialText;
      lastPublishedAt = now;
      this.setNpcChatPhase(liveNpc, 'streaming', partialText);
    };
  }

  appendNpcReplyTranscript(npc, text) {
    this.appendTranscript(
      npc.id,
      createTranscriptEntry(`entry_${++this.sequence}`, 'npc', npc.name, text)
    );
  }

  finalizeNpcReply(npcId, text, { bumpSeq = true } = {}) {
    const npc = this.state.npcs.get(npcId);
    if (!npc) {
      return null;
    }

    this.setNpcChatPhase(npc, 'done', text, { bumpSeq });
    this.appendNpcReplyTranscript(npc, text);
    return npc;
  }

  async handlePublicChat(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      throw new Error('Your player is not connected.');
    }

    const trimmedMessage = this.sanitizeChatMessage(message.message);
    const cooldownKey = `${client.sessionId}:chat`;
    const lastSentAt = this.cooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastSentAt < CHAT_COOLDOWN_MS) {
      throw new Error('Take a breath before sending another message.');
    }

    this.cooldowns.set(cooldownKey, Date.now());
    this.setPlayerSpeech(player, trimmedMessage);
    const playerAlias = this.getPlayerAlias(client.sessionId);

    logServer('room', 'Public chat accepted.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      messageLength: trimmedMessage.length
    });

    const npc = this.findNearestHeardNpc(player);
    if (npc && !npc.busy) {
      npc.busy = true;
      this.setNpcChatPhase(npc, 'thinking', '', { bumpSeq: true });
      void this.handleNpcReply({
        client,
        npcId: npc.id,
        playerMessage: trimmedMessage,
        playerAlias
      });
    }

    return {};
  }

  async handleNpcReply({ client, npcId, playerMessage, playerAlias }) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.npcDefinitions.get(npcId);
    if (!npc) {
      return;
    }
    if (!definition || !npc.active) {
      npc.busy = false;
      npc.chatStatus = 'idle';
      return;
    }

    try {
      this.appendTranscript(
        npc.id,
        createTranscriptEntry(`entry_${++this.sequence}`, 'player', playerAlias, playerMessage)
      );

      const replyResult = await this.chatEngine.streamReply({
        npc: definition,
        transcript: this.transcripts.get(npc.id) ?? [],
        playerMessage,
        onDelta: this.createNpcStreamPublisher(npc.id)
      });

      const liveNpc = this.finalizeNpcReply(npc.id, replyResult.text);
      if (liveNpc) {
        logServer('room', 'NPC ambient reply completed.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          npcId: npc.id,
          npcName: npc.name,
          usedFallback: replyResult.usedFallback,
          usedRetry: replyResult.usedRetry,
          endedWithPartial: replyResult.endedWithPartial,
          attemptCount: replyResult.attemptCount
        });
      }
    } catch (error) {
      const fallback = `${npc.name} pauses, then says they need a moment to gather their thoughts.`;
      this.finalizeNpcReply(npc.id, fallback);
      logServerError('room', 'NPC chat provider failed; fallback reply used.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        npcId: npc.id,
        npcName: npc.name
      });
    } finally {
      const liveNpc = this.state.npcs.get(npc.id);
      if (liveNpc) {
        liveNpc.busy = false;
        if (!liveNpc.chatStatus) {
          liveNpc.chatStatus = 'idle';
        }
      }
    }
  }
}
