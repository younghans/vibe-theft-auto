import { Room } from 'colyseus';
import { MapSchema, schema } from '@colyseus/schema';
import {
  COMBAT_PICKUP_SPAWNS,
  COMBAT_RESPAWN_POINTS,
  DROPPED_PICKUP_DESPAWN_MS,
  PICKUP_INTERACT_RADIUS,
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
  placementToCollisionRect,
  rayCircleIntersectionDistance,
  rayRectIntersectionDistance
} from '../../src/shared/combatMath.js';
import { getNpcModelById } from '../../src/npc/npcCatalog.js';
import { EMOTES_BY_ID } from '../../src/player/emotes.js';
import { getBuilderItemById } from '../../src/world/builderCatalog.js';
import { WorldState } from '../../src/world/WorldState.js';
import { NpcChatEngine } from './NpcChatEngine.js';
import { logServer, logServerError } from './logger.js';
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

const PlayerState = schema({
  x: 'number',
  z: 'number',
  rotationY: 'number',
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
  lastDamagedAt: 'number'
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
  rotationQuarterTurns: 'number',
  interactRadius: 'number',
  active: 'boolean',
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

function sanitizePlayerAnimationState(message = {}) {
  const emoteId = typeof message.emoteId === 'string' ? message.emoteId.trim() : '';
  const hasValidEmote = emoteId === LIMP_EMOTE_ID || Object.hasOwn(EMOTES_BY_ID, emoteId);
  const emoteActive = Boolean(message.emoteActive && hasValidEmote);
  const emoteStartedAt = Number(message.emoteStartedAt);
  const emoteSeq = Number(message.emoteSeq);

  return {
    emoteId: emoteActive ? emoteId : '',
    emoteActive,
    emoteStartedAt: emoteActive && Number.isFinite(emoteStartedAt) ? Math.max(0, Math.floor(emoteStartedAt)) : 0,
    emoteSeq: Number.isFinite(emoteSeq) ? Math.max(0, Math.floor(emoteSeq)) : 0
  };
}

function clampNpcRadius(value) {
  const numeric = Number(value ?? 4.2);
  return Math.max(1.5, Math.min(12, Number.isFinite(numeric) ? numeric : 4.2));
}

function defaultNpcPrompt(label) {
  return `You are ${label}, an NPC in Stick RPG 3D. Stay in character, keep answers grounded in the city, and respond in short, flavorful lines.`;
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
    this.chatEngine = new NpcChatEngine();
    this.worldState = new WorldState();
    this.worldPersistence = getWorldPersistence();
    this.npcDefinitions = new Map();
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.sequence = 0;
    this.playerAliasSequence = 0;
    this.playerPositionMeta = new Map();
    this.pickupSequence = 0;

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

    this.onMessage('player:updateTransform', (client, message) => {
      this.updatePlayerTransform(client, message);
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
      void this.handleRpc(client, message.requestId, () => this.handleWorldEdit(message));
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

  onJoin(client) {
    const player = new PlayerState();
    const [spawnX, spawnZ] = this.chooseRespawnPoint(client.sessionId);
    player.x = quantizePosition(spawnX);
    player.z = quantizePosition(spawnZ);
    player.rotationY = 0;
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
    this.state.players.set(client.sessionId, player);
    this.playerPositionMeta.set(client.sessionId, {
      x: player.x,
      z: player.z,
      acceptedAt: Date.now(),
      lastShotAt: 0
    });
    this.playerAliasSequence += 1;
    this.playerAliases.set(client.sessionId, `Player ${this.playerAliasSequence}`);
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
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
  }

  updateCombatTimers() {
    const now = Date.now();

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
    meta.lastShotAt = now;
    player.ammoInClip = Math.max(0, player.ammoInClip - 1);

    const shot = this.resolveShot(client.sessionId, player, aim);
    this.broadcastCombatEvent({
      type: 'shot',
      shooterId: client.sessionId,
      weaponId: player.equippedWeaponId,
      fromX: player.x,
      fromZ: player.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt: Number.isFinite(message.clientShotAt) ? Math.max(0, Math.floor(message.clientShotAt)) : now
    });

    if (shot.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterId: client.sessionId,
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

    if (player.ammoInClip <= 0 && player.reserveAmmo > 0) {
      this.startReload(client.sessionId, player);
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

  resolveShot(shooterSessionId, player, aim) {
    let nearestDistance = WEAPON_RANGE;
    let result = {
      kind: 'miss',
      hitX: player.x + aim.x * WEAPON_RANGE,
      hitZ: player.z + aim.z * WEAPON_RANGE,
      targetId: ''
    };

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rect = placementToCollisionRect(placement, item);
      if (!rect) {
        continue;
      }

      const hitDistance = rayRectIntersectionDistance(player.x, player.z, aim.x, aim.z, WEAPON_RANGE, rect);
      if (hitDistance == null || hitDistance <= SHOT_BLOCKER_EPSILON || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'world',
        hitX: player.x + aim.x * hitDistance,
        hitZ: player.z + aim.z * hitDistance,
        targetId: placement.id
      };
    }

    for (const [sessionId, target] of this.state.players.entries()) {
      if (sessionId === shooterSessionId || target.alive === false) {
        continue;
      }

      const hitDistance = rayCircleIntersectionDistance(
        player.x,
        player.z,
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
        hitX: player.x + aim.x * hitDistance,
        hitZ: player.z + aim.z * hitDistance,
        targetId: sessionId
      };
    }

    return result;
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

  async handleWorldEdit(message = {}) {
    const { op, payload = {} } = message;
    const previousLayout = this.worldState.serializeLayout();

    switch (op) {
      case 'placeTile': {
        const next = this.sanitizeTilePlacement(payload);
        const result = this.worldState.placeTile(
          next.item,
          next.cellX,
          next.cellZ,
          next.rotationQuarterTurns
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementId: result.replacedPlacementId
        }, previousLayout);
      }
      case 'placeProp': {
        const next = this.sanitizePropPlacement(payload);
        const placement = this.worldState.placeProp(
          next.item,
          next.x,
          next.z,
          next.rotationQuarterTurns
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
        const rotated = this.worldState.rotatePlacement(placement.id);
        if (rotated?.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(rotated.id),
          replacedPlacementId: null
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
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
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
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
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
      npc: {
        modelId: model.id,
        name,
        prompt: String(message.prompt ?? defaultNpcPrompt(name)).slice(0, NPC_PROMPT_MAX_LENGTH),
        interactRadius: clampNpcRadius(message.interactRadius ?? item.interactionRadius ?? 4.2),
        active: message.active !== false
      }
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
      this.npcDefinitions.set(definition.id, structuredClone(definition));
      const existing = this.state.npcs.get(definition.id) ?? new NpcState();
      existing.id = definition.id;
      existing.modelId = definition.modelId;
      existing.name = definition.name;
      existing.x = definition.position[0];
      existing.z = definition.position[1];
      existing.rotationQuarterTurns = normalizeRotationQuarterTurns(definition.rotationQuarterTurns);
      existing.interactRadius = clampNpcRadius(definition.interactRadius);
      existing.active = definition.active !== false;
      existing.busy = existing.active ? Boolean(existing.busy) : false;
      existing.chatStatus = existing.chatStatus || 'idle';
      existing.chatText = existing.chatText || '';
      existing.chatStartedAt = Number(existing.chatStartedAt || 0);
      existing.chatSeq = Number(existing.chatSeq || 0);
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
      this.transcripts.delete(npcId);
      for (const cooldownKey of [...this.cooldowns.keys()]) {
        if (cooldownKey.endsWith(`:${npcId}`)) {
          this.cooldowns.delete(cooldownKey);
        }
      }
    }
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
      if (!npc.active) {
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
