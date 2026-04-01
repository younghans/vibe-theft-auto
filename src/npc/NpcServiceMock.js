import { getNpcModelById } from './npcCatalog.js';
import { WorldState } from '../world/WorldState.js';
import { defaultWorldLayout } from '../world/defaultWorldLayout.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

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

export class NpcServiceMock {
  constructor() {
    console.info('[NPC] Mock NPC service initialized.');
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.definitions = new Map();
    this.worldState = new WorldState();
    this.worldState.loadLayout(defaultWorldLayout);
    this.state = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      transcripts: new Map()
    };
    this.sequence = 0;
    this.playerPosition = { x: 0, z: 0 };
    this.syncNpcStateFromWorld();
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

  getState() {
    return {
      ...this.state,
      players: new Map([...this.state.players.entries()].map(([id, player]) => [id, { ...player }])),
      builders: new Map([...this.state.builders.entries()].map(([id, builder]) => [id, { ...builder }])),
      npcs: new Map([...this.state.npcs.entries()].map(([id, npc]) => [id, { ...npc, position: [...npc.position] }])),
      transcripts: new Map([...this.state.transcripts.entries()].map(([id, entries]) => [id, entries.map((entry) => ({ ...entry }))]))
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
        currentSpeakerSessionId: previous?.currentSpeakerSessionId ?? null,
        latestUtterance: previous?.latestUtterance ?? '',
        transcriptVersion: previous?.transcriptVersion ?? 0
      });
      if (!this.state.transcripts.has(npc.id)) {
        this.state.transcripts.set(npc.id, []);
      }
    }

    for (const npcId of [...this.state.npcs.keys()]) {
      if (nextIds.has(npcId)) {
        continue;
      }

      this.definitions.delete(npcId);
      this.state.npcs.delete(npcId);
      this.state.transcripts.delete(npcId);
    }
  }

  async getWorldLayout() {
    return cloneLayout(this.worldState.serializeLayout());
  }

  async placeTile(payload) {
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
    const patch = {
      type: 'upsertPlacement',
      placement: this.worldState.serializePlacement(result.placement.id),
      replacedPlacementId: result.replacedPlacementId
    };
    this.emitWorldPatch(patch);
    return { ok: true, placementId: result.placement.id };
  }

  async placeProp(payload) {
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
    const patch = {
      type: 'upsertPlacement',
      placement: this.worldState.serializePlacement(placement.id),
      replacedPlacementId: null
    };
    this.emitWorldPatch(patch);
    return { ok: true, placementId: placement.id };
  }

  async placeNpc(payload) {
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
    const patch = {
      type: 'upsertPlacement',
      placement: this.worldState.serializePlacement(placement.id),
      replacedPlacementId: null
    };
    this.emitWorldPatch(patch);
    this.emit();
    return { ok: true, placementId: placement.id };
  }

  async rotatePlacement(placementId) {
    const placement = this.worldState.rotatePlacement(placementId);
    if (!placement) {
      return { ok: false, error: 'That placement is not available.' };
    }

    if (placement.layer === 'npc') {
      this.syncNpcStateFromWorld();
      this.emit();
    }

    const patch = {
      type: 'upsertPlacement',
      placement: this.worldState.serializePlacement(placement.id),
      replacedPlacementId: null
    };
    this.emitWorldPatch(patch);
    return { ok: true, placementId };
  }

  async deletePlacement(placementId) {
    const placement = this.worldState.deletePlacement(placementId);
    if (!placement) {
      return { ok: false, error: 'That placement is not available.' };
    }

    if (placement.layer === 'npc') {
      this.syncNpcStateFromWorld();
      this.emit();
    }

    const patch = {
      type: 'deletePlacement',
      placementId
    };
    this.emitWorldPatch(patch);
    return { ok: true, placementId };
  }

  async updateNpc(placementId, updates = {}) {
    const nextUpdates = { ...updates };
    if (updates.modelId) {
      const model = getNpcModelById(updates.modelId);
      if (!model) {
        return { ok: false, error: 'That NPC model is not available.' };
      }
      nextUpdates.itemId = model.itemId;
    }

    const placement = this.worldState.updateNpc(placementId, nextUpdates);
    if (!placement) {
      return { ok: false, error: 'That NPC is not available.' };
    }

    this.syncNpcStateFromWorld();
    const patch = {
      type: 'upsertPlacement',
      placement: this.worldState.serializePlacement(placement.id),
      replacedPlacementId: null
    };
    this.emitWorldPatch(patch);
    this.emit();
    return { ok: true, placementId };
  }

  setPlayerTransform(position, rotationY = 0) {
    this.playerPosition = {
      x: position.x,
      z: position.z,
      rotationY
    };
  }

  setBuilderPresence(presence = {}) {
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

  async beginInteract(npcId) {
    console.info('[NPC] Mock beginInteract.', { npcId });
    const npc = this.state.npcs.get(npcId);
    if (!npc || npc.active === false) {
      return { ok: false, error: 'That NPC is not available.' };
    }

    if (npc.currentSpeakerSessionId && npc.currentSpeakerSessionId !== this.state.sessionId) {
      return { ok: false, error: `${npc.name} is already talking to someone else.` };
    }

    npc.currentSpeakerSessionId = this.state.sessionId;
    this.emit();
    return { ok: true };
  }

  async sendChat(npcId, message) {
    console.info('[NPC] Mock sendChat.', {
      npcId,
      messageLength: message.trim().length
    });
    const npc = this.state.npcs.get(npcId);
    const definition = this.definitions.get(npcId);
    if (!npc || !definition || npc.active === false) {
      return { ok: false, error: 'That NPC is not available.' };
    }

    if (npc.currentSpeakerSessionId && npc.currentSpeakerSessionId !== this.state.sessionId) {
      return { ok: false, error: `${npc.name} is already talking to someone else.` };
    }

    const transcript = this.state.transcripts.get(npcId) ?? [];
    transcript.push(makeTranscriptEntry(`local_${++this.sequence}`, 'player', 'You', message.trim()));
    npc.currentSpeakerSessionId = this.state.sessionId;
    npc.busy = true;
    npc.transcriptVersion += 1;
    this.state.transcripts.set(npcId, clampTranscript(transcript));
    this.emit();

    await new Promise((resolve) => window.setTimeout(resolve, 420));

    const reply = this.buildReply(definition, message);
    const nextTranscript = this.state.transcripts.get(npcId) ?? [];
    nextTranscript.push(makeTranscriptEntry(`local_${++this.sequence}`, 'npc', npc.name, reply));
    this.state.transcripts.set(npcId, clampTranscript(nextTranscript));
    npc.latestUtterance = reply;
    npc.busy = false;
    npc.transcriptVersion += 1;
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
    return `${definition.name}: ${message.trim()}? ${signature}`;
  }

  async endInteract(npcId) {
    console.info('[NPC] Mock endInteract.', { npcId });
    const npc = this.state.npcs.get(npcId);
    if (!npc) {
      return { ok: true };
    }

    if (npc.currentSpeakerSessionId === this.state.sessionId) {
      npc.currentSpeakerSessionId = null;
      npc.busy = false;
      this.emit();
    }

    return { ok: true };
  }

  async destroy() {
    this.listeners.clear();
    this.worldPatchListeners.clear();
  }
}
