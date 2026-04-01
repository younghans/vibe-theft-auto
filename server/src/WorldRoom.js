import { Room } from 'colyseus';
import { MapSchema, schema } from '@colyseus/schema';
import { defaultWorldLayout } from '../../src/world/defaultWorldLayout.js';
import { NpcChatEngine } from './NpcChatEngine.js';
import { logServer, logServerError } from './logger.js';

const MAX_MESSAGE_LENGTH = 280;
const MAX_TRANSCRIPT_ENTRIES = 18;
const CHAT_COOLDOWN_MS = 900;

const PlayerState = schema({
  x: 'number',
  z: 'number',
  rotationY: 'number'
});

const NpcState = schema({
  id: 'string',
  modelId: 'string',
  name: 'string',
  x: 'number',
  z: 'number',
  rotationQuarterTurns: 'number',
  interactRadius: 'number',
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

export class WorldRoom extends Room {
  onCreate() {
    this.maxClients = 16;
    this.setState(new WorldRoomState());
    this.chatEngine = new NpcChatEngine();
    this.npcDefinitions = new Map();
    this.transcripts = new Map();
    this.cooldowns = new Map();
    this.disconnectedSessionsNeedingRelease = new Set();
    this.sequence = 0;

    this.replaceNpcDefinitions(defaultWorldLayout.npcs ?? []);
    logServer('room', 'World room created.', {
      roomId: this.roomId,
      maxClients: this.maxClients,
      defaultNpcCount: this.state.npcs.size
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

    this.onMessage('npc:syncDefinitions', (client, message) => {
      this.handleRpc(client, message.requestId, () => {
        const definitions = this.sanitizeNpcDefinitions(message.npcs ?? []);
        this.replaceNpcDefinitions(definitions);
        this.broadcastTranscriptSnapshot();
        logServer('room', 'NPC definitions synchronized.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          npcCount: definitions.length
        });
        return { count: definitions.length };
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
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
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

  sanitizeNpcDefinitions(definitions) {
    return definitions
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.modelId === 'string')
      .map((entry) => ({
        id: entry.id,
        modelId: entry.modelId,
        position: [
          Number(entry.position?.[0] ?? 0),
          Number(entry.position?.[1] ?? 0)
        ],
        rotationQuarterTurns: Number(entry.rotationQuarterTurns ?? 0),
        name: String(entry.name ?? 'NPC').slice(0, 40),
        prompt: String(entry.prompt ?? '').slice(0, 1600),
        interactRadius: Math.max(1.5, Math.min(12, Number(entry.interactRadius ?? 4.2)))
      }));
  }

  replaceNpcDefinitions(definitions) {
    const nextIds = new Set(definitions.map((entry) => entry.id));

    for (const definition of definitions) {
      this.npcDefinitions.set(definition.id, structuredClone(definition));
      const existing = this.state.npcs.get(definition.id) ?? new NpcState();
      existing.id = definition.id;
      existing.modelId = definition.modelId;
      existing.name = definition.name;
      existing.x = definition.position[0];
      existing.z = definition.position[1];
      existing.rotationQuarterTurns = definition.rotationQuarterTurns;
      existing.interactRadius = definition.interactRadius;
      existing.busy = Boolean(existing.busy);
      existing.currentSpeakerSessionId = existing.currentSpeakerSessionId || '';
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
    }
  }

  assertNpcAvailable(client, npcId) {
    const npc = this.state.npcs.get(npcId);
    const player = this.state.players.get(client.sessionId);
    if (!npc || !player) {
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

  broadcastTranscriptSnapshot() {
    logServer('room', 'Broadcasting transcript snapshot.', {
      roomId: this.roomId,
      npcCount: this.transcripts.size
    });
    this.broadcast('npc:transcripts', {
      transcripts: Object.fromEntries(this.transcripts.entries())
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

      npc.latestUtterance = reply;
      this.appendTranscript(
        npc.id,
        createTranscriptEntry(`entry_${++this.sequence}`, 'npc', npc.name, reply),
        npc
      );
      logServer('room', 'NPC chat completed.', {
        roomId: this.roomId,
        sessionId: client.sessionId,
        npcId: npc.id,
        npcName: npc.name
      });
    } catch (error) {
      const fallback = `${npc.name} pauses, then says they need a moment to gather their thoughts.`;
      npc.latestUtterance = fallback;
      this.appendTranscript(
        npc.id,
        createTranscriptEntry(`entry_${++this.sequence}`, 'npc', npc.name, fallback),
        npc
      );
      logServerError('room', 'NPC chat provider failed; fallback reply used.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        npcId: npc.id,
        npcName: npc.name
      });
    } finally {
      npc.busy = false;
      this.releaseDisconnectedSpeakerSession(client.sessionId);
    }

    return { npcId: npc.id };
  }
}
