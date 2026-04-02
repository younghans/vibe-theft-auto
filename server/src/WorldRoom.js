import { Room } from 'colyseus';
import { MapSchema, schema } from '@colyseus/schema';
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
  chatSeq: 'number'
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
  }
});

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

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

function sanitizePlayerAnimationState(message = {}) {
  const emoteId = typeof message.emoteId === 'string' ? message.emoteId.trim() : '';
  const hasValidEmote = Object.hasOwn(EMOTES_BY_ID, emoteId);
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

    this.worldState.loadLayout(this.worldPersistence.getInitialLayout());
    this.syncNpcDefinitionsFromWorld();
    logServer('room', 'World room created.', {
      roomId: this.roomId,
      maxClients: this.maxClients,
      npcCount: this.state.npcs.size
    });

    this.onMessage('player:updateTransform', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      player.x = Number(message.x) || 0;
      player.z = Number(message.z) || 0;
      const rotationY = Number(message.rotationY);
      if (Number.isFinite(rotationY)) {
        player.rotationY = rotationY;
      }

      const animationState = sanitizePlayerAnimationState(message);
      player.emoteId = animationState.emoteId;
      player.emoteActive = animationState.emoteActive;
      player.emoteStartedAt = animationState.emoteStartedAt;
      player.emoteSeq = animationState.emoteSeq;
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
  }

  onJoin(client) {
    const player = new PlayerState();
    player.x = 0;
    player.z = 0;
    player.rotationY = 0;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq = 0;
    player.chatText = '';
    player.chatStartedAt = 0;
    player.chatSeq = 0;
    this.state.players.set(client.sessionId, player);
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
    logServer('room', 'Client left world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  async onDispose() {}

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

      const distance = distanceBetween({ x: npc.x, z: npc.z }, player);
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
