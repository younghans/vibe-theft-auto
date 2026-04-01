import { Room } from 'colyseus';
import { MapSchema, schema } from '@colyseus/schema';
import { getNpcModelById } from '../../src/npc/npcCatalog.js';
import { getBuilderItemById } from '../../src/world/builderCatalog.js';
import { WorldState } from '../../src/world/WorldState.js';
import { NpcChatEngine } from './NpcChatEngine.js';
import { logServer, logServerError } from './logger.js';
import { WorldLayoutPersistence, loadPersistedWorldLayoutSync } from './worldPersistence.js';

const MAX_MESSAGE_LENGTH = 280;
const MAX_TRANSCRIPT_ENTRIES = 18;
const CHAT_COOLDOWN_MS = 900;
const NPC_NAME_MAX_LENGTH = 40;
const NPC_PROMPT_MAX_LENGTH = 1600;

const PlayerState = schema({
  x: 'number',
  z: 'number',
  rotationY: 'number'
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
  currentSpeakerSessionId: 'string',
  latestUtterance: 'string',
  transcriptVersion: 'number'
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

function clampNpcRadius(value) {
  const numeric = Number(value ?? 4.2);
  return Math.max(1.5, Math.min(12, Number.isFinite(numeric) ? numeric : 4.2));
}

function serializeTranscripts(transcripts) {
  return Object.fromEntries(transcripts.entries());
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
    this.worldPersistence = new WorldLayoutPersistence();
    this.npcDefinitions = new Map();
    this.transcripts = new Map();
    this.cooldowns = new Map();
    this.disconnectedSessionsNeedingRelease = new Set();
    this.sequence = 0;

    this.worldState.loadLayout(loadPersistedWorldLayoutSync());
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
      this.handleRpc(client, message.requestId, () => ({
        layout: this.worldState.serializeLayout()
      }));
    });

    this.onMessage('world:placeTile', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const payload = this.sanitizeTilePlacement(message);
        const result = this.worldState.placeTile(
          payload.item,
          payload.cellX,
          payload.cellZ,
          payload.rotationQuarterTurns
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementId: result.replacedPlacementId
        });
      });
    });

    this.onMessage('world:placeProp', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const payload = this.sanitizePropPlacement(message);
        const placement = this.worldState.placeProp(
          payload.item,
          payload.x,
          payload.z,
          payload.rotationQuarterTurns
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
      });
    });

    this.onMessage('world:placeNpc', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const payload = this.sanitizeNpcPlacement(message);
        const placement = this.worldState.placeNpc(
          payload.item,
          payload.x,
          payload.z,
          payload.rotationQuarterTurns,
          payload.npc
        );
        this.syncNpcDefinitionsFromWorld();
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
      });
    });

    this.onMessage('world:rotatePlacement', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const placement = this.assertEditablePlacement(message.placementId);
        const rotated = this.worldState.rotatePlacement(placement.id);
        if (rotated?.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(rotated.id),
          replacedPlacementId: null
        });
      });
    });

    this.onMessage('world:deletePlacement', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const placement = this.assertEditablePlacement(message.placementId);
        this.worldState.deletePlacement(placement.id);
        if (placement.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
        }
        return this.commitWorldPatch({
          type: 'deletePlacement',
          placementId: placement.id
        });
      });
    });

    this.onMessage('world:updateNpc', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const placement = this.assertEditablePlacement(message.placementId, 'npc');
        const updates = this.sanitizeNpcUpdates(message);
        const updatedPlacement = this.worldState.updateNpc(placement.id, updates);
        if (!updatedPlacement) {
          throw new Error('That NPC is not available.');
        }

        this.syncNpcDefinitionsFromWorld();
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        });
      });
    });

    this.onMessage('npc:beginInteract', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const npc = this.assertNpcAvailable(client, message.npcId);
        if (npc.currentSpeakerSessionId && npc.currentSpeakerSessionId !== client.sessionId) {
          throw new Error(`${npc.name} is already talking to someone else.`);
        }

        npc.currentSpeakerSessionId = client.sessionId;
        logServer('room', 'NPC interaction started.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          npcId: npc.id,
          npcName: npc.name
        });
        return { npcId: npc.id };
      });
    });

    this.onMessage('npc:endInteract', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const npc = this.state.npcs.get(message.npcId);
        if (npc && npc.currentSpeakerSessionId === client.sessionId && !npc.busy) {
          npc.currentSpeakerSessionId = '';
          logServer('room', 'NPC interaction ended.', {
            roomId: this.roomId,
            sessionId: client.sessionId,
            npcId: npc.id,
            npcName: npc.name
          });
        }
        return { npcId: message.npcId };
      });
    });

    this.onMessage('npc:chat', async (client, message) => {
      try {
        const result = await this.handleNpcChat(client, message);
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: true,
          ...result
        });
      } catch (error) {
        logServerError('room', 'NPC chat request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId,
          npcId: message.npcId
        });
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: false,
          error: error.message || 'NPC chat failed.'
        });
      }
    });
  }

  onJoin(client) {
    const player = new PlayerState();
    player.x = 0;
    player.z = 0;
    player.rotationY = 0;
    this.state.players.set(client.sessionId, player);
    client.send('npc:transcripts', {
      transcripts: serializeTranscripts(this.transcripts)
    });
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.state.builders.delete(client.sessionId);
    let needsDeferredRelease = false;
    for (const npc of this.state.npcs.values()) {
      if (npc.currentSpeakerSessionId !== client.sessionId) {
        continue;
      }

      if (npc.busy) {
        needsDeferredRelease = true;
      } else {
        npc.currentSpeakerSessionId = '';
      }
    }
    if (needsDeferredRelease) {
      this.disconnectedSessionsNeedingRelease.add(client.sessionId);
    }
    logServer('room', 'Client left world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  async onDispose() {
    await this.worldPersistence.dispose();
  }

  releaseDisconnectedSpeakerSession(sessionId) {
    if (!this.disconnectedSessionsNeedingRelease.has(sessionId)) {
      return;
    }

    for (const npc of this.state.npcs.values()) {
      if (npc.currentSpeakerSessionId === sessionId && !npc.busy) {
        npc.currentSpeakerSessionId = '';
      }
    }

    const stillBusy = [...this.state.npcs.values()].some((npc) => npc.currentSpeakerSessionId === sessionId && npc.busy);
    if (!stillBusy) {
      this.disconnectedSessionsNeedingRelease.delete(sessionId);
    }
  }

  handleRpc(client, requestId, handler) {
    try {
      const payload = handler();
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

  commitWorldPatch(patch) {
    this.broadcast('world:patch', patch);
    this.worldPersistence.scheduleSave(this.worldState.serializeLayout());
    return {
      placementId: patch.placement?.id ?? patch.placementId ?? null
    };
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
      existing.currentSpeakerSessionId = existing.active ? (existing.currentSpeakerSessionId || '') : '';
      existing.latestUtterance = existing.latestUtterance || '';
      existing.transcriptVersion = Number(existing.transcriptVersion || 0);
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

  assertNpcAvailable(client, npcId) {
    const npc = this.state.npcs.get(npcId);
    const player = this.state.players.get(client.sessionId);
    if (!npc || !player || !npc.active) {
      throw new Error('That NPC is not available.');
    }

    if (distanceBetween({ x: npc.x, z: npc.z }, player) > npc.interactRadius + 1) {
      throw new Error(`Move closer to ${npc.name} first.`);
    }

    return npc;
  }

  appendTranscript(npcId, entry, npc) {
    const current = this.transcripts.get(npcId) ?? [];
    const next = trimTranscript([...current, entry]);
    this.transcripts.set(npcId, next);
    npc.transcriptVersion += 1;
    this.broadcast('npc:transcript', {
      npcId,
      entries: next
    });
  }

  async handleNpcChat(client, message) {
    const npc = this.assertNpcAvailable(client, message.npcId);
    const definition = this.npcDefinitions.get(message.npcId);
    const trimmedMessage = String(message.message ?? '').trim();
    if (!trimmedMessage) {
      throw new Error('Say something first.');
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are capped at ${MAX_MESSAGE_LENGTH} characters.`);
    }

    if (npc.currentSpeakerSessionId && npc.currentSpeakerSessionId !== client.sessionId) {
      throw new Error(`${npc.name} is already talking to someone else.`);
    }

    const cooldownKey = `${client.sessionId}:${npc.id}`;
    const lastSentAt = this.cooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastSentAt < CHAT_COOLDOWN_MS) {
      throw new Error('Take a breath before sending another message.');
    }

    if (npc.busy) {
      throw new Error(`${npc.name} is thinking right now.`);
    }

    logServer('room', 'NPC chat accepted.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      npcId: npc.id,
      npcName: npc.name,
      messageLength: trimmedMessage.length
    });
    this.cooldowns.set(cooldownKey, Date.now());
    npc.currentSpeakerSessionId = client.sessionId;
    npc.busy = true;

    this.appendTranscript(
      npc.id,
      createTranscriptEntry(`entry_${++this.sequence}`, 'player', 'You', trimmedMessage),
      npc
    );

    try {
      const transcript = this.transcripts.get(npc.id) ?? [];
      const reply = await this.chatEngine.generateReply({
        npc: definition,
        transcript,
        playerMessage: trimmedMessage
      });

      const liveNpc = this.state.npcs.get(npc.id);
      if (liveNpc) {
        liveNpc.latestUtterance = reply;
        this.appendTranscript(
          liveNpc.id,
          createTranscriptEntry(`entry_${++this.sequence}`, 'npc', liveNpc.name, reply),
          liveNpc
        );
      }
      logServer('room', 'NPC chat completed.', {
        roomId: this.roomId,
        sessionId: client.sessionId,
        npcId: npc.id,
        npcName: npc.name
      });
    } catch (error) {
      const liveNpc = this.state.npcs.get(npc.id);
      if (liveNpc) {
        const fallback = `${liveNpc.name} pauses, then says they need a moment to gather their thoughts.`;
        liveNpc.latestUtterance = fallback;
        this.appendTranscript(
          liveNpc.id,
          createTranscriptEntry(`entry_${++this.sequence}`, 'npc', liveNpc.name, fallback),
          liveNpc
        );
      }
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
      }
      this.releaseDisconnectedSpeakerSession(client.sessionId);
    }

    return { npcId: npc.id };
  }
}
