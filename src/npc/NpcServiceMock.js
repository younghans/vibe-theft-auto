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
import { WorldState } from '../world/WorldState.js';
import { defaultWorldLayout } from '../world/defaultWorldLayout.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

const SHOT_BLOCKER_EPSILON = PLAYER_RADIUS * 0.9;
const SHOT_ORIGIN_MAX_OFFSET = PLAYER_RADIUS * 2.4;
const SHOT_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 1.5;
const PUNCH_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 0.55;

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

export class NpcServiceMock {
  constructor({ adminKey = '' } = {}) {
    console.info('[NPC] Mock NPC service initialized.');
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.combatListeners = new Set();
    this.definitions = new Map();
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
      pickups: new Map()
    };
    this.sequence = 0;
    this.pickupSequence = 0;
    this.playerAliasSequence = 0;
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
      npcs: new Map([...this.state.npcs.entries()].map(([id, npc]) => [id, { ...npc, position: [...npc.position] }])),
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
      this.definitions.set(npc.id, structuredClone(npc));
      const previous = this.state.npcs.get(npc.id);
      this.state.npcs.set(npc.id, {
        id: npc.id,
        modelId: npc.modelId,
        name: npc.name,
        position: [...npc.position],
        rotationQuarterTurns: npc.rotationQuarterTurns,
        interactRadius: npc.interactRadius,
        active: npc.active !== false,
        busy: previous?.busy ?? false,
        chatStatus: previous?.chatStatus ?? 'idle',
        chatText: previous?.chatText ?? '',
        chatStartedAt: previous?.chatStartedAt ?? 0,
        chatSeq: previous?.chatSeq ?? 0
      });
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
      this.transcripts.delete(npcId);
    }
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
      if (npc.active === false) {
        continue;
      }

      const distance = distance2D(npc.position[0], npc.position[1], player.x, player.z);
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

    const shot = this.resolveShot(player, aim, shotOrigin);
    this.emitCombatEvent({
      type: 'shot',
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
      shooterId: this.state.sessionId,
      kind: shot.kind,
      targetId: shot.targetId ?? '',
      x: shot.hitX,
      z: shot.hitZ
    });

    if (shot.player) {
      shot.player.health = Math.max(0, shot.player.health - WEAPON_DAMAGE);
      shot.player.lastDamagedAt = now;
      if (shot.player.health <= 0) {
        this.handlePlayerDeath(shot.playerId, this.state.sessionId);
      }
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
        shooterId: this.state.sessionId,
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt
      });
    }

    if (hit.player) {
      hit.player.health = Math.max(0, hit.player.health - PUNCH_DAMAGE);
      hit.player.lastDamagedAt = now;
      if (hit.player.health <= 0) {
        this.handlePlayerDeath(hit.playerId, this.state.sessionId);
      }
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

  resolveShot(player, aim, origin = player) {
    let nearestDistance = WEAPON_RANGE;
    let result = {
      kind: 'miss',
      hitX: origin.x + aim.x * WEAPON_RANGE,
      hitZ: origin.z + aim.z * WEAPON_RANGE,
      targetId: ''
    };

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, WEAPON_RANGE, rect);
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
      if (id === this.state.sessionId || target.alive === false) {
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
        targetId: id,
        player: target,
        playerId: id
      };
    }

    return result;
  }

  resolvePunch(attackerId, player, aim) {
    let nearestDistance = PUNCH_RANGE;
    let result = {
      kind: 'miss',
      hitX: player.x + aim.x * PUNCH_RANGE,
      hitZ: player.z + aim.z * PUNCH_RANGE,
      targetId: '',
      player: null,
      playerId: ''
    };

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(player.x, player.z, aim.x, aim.z, PUNCH_RANGE, rect);
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
          hitX: player.x + aim.x * hitDistance,
          hitZ: player.z + aim.z * hitDistance,
          targetId: placement.id,
          player: null,
          playerId: ''
        };
      }
    }

    for (const [sessionId, target] of this.state.players.entries()) {
      if (sessionId === attackerId || target.alive === false) {
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
        targetId: sessionId,
        player: target,
        playerId: sessionId
      };
    }

    return result;
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
