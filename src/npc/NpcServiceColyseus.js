function schemaMapToEntries(schemaMap) {
  const entries = [];
  if (!schemaMap) {
    return entries;
  }

  if (typeof schemaMap.forEach === 'function') {
    schemaMap.forEach((value, key) => {
      entries.push([key, value]);
    });
    return entries;
  }

  return Object.entries(schemaMap);
}

function cloneNpcState(npc) {
  return {
    id: npc.id,
    modelId: npc.modelId,
    name: npc.name,
    position: [npc.x, npc.z],
    rotationQuarterTurns: npc.rotationQuarterTurns,
    interactRadius: npc.interactRadius,
    active: npc.active !== false,
    busy: npc.busy,
    currentSpeakerSessionId: npc.currentSpeakerSessionId || null,
    latestUtterance: npc.latestUtterance || '',
    transcriptVersion: npc.transcriptVersion || 0
  };
}

function clonePlayerState(player) {
  return {
    x: player.x,
    z: player.z,
    rotationY: player.rotationY ?? 0
  };
}

function cloneBuilderState(builder) {
  return {
    active: Boolean(builder.active),
    itemId: builder.itemId || '',
    layer: builder.layer || '',
    rotationQuarterTurns: builder.rotationQuarterTurns ?? 0,
    cellX: builder.cellX ?? 0,
    cellZ: builder.cellZ ?? 0,
    x: builder.x ?? 0,
    z: builder.z ?? 0,
    selectionPlacementId: builder.selectionPlacementId || ''
  };
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function quantize(value, digits = 2) {
  const numeric = Number(value ?? 0);
  return Number((Number.isFinite(numeric) ? numeric : 0).toFixed(digits));
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

export class NpcServiceColyseus {
  constructor({ endpoint }) {
    const ClientCtor = globalThis.Colyseus?.Client;
    if (!ClientCtor) {
      throw new Error('Colyseus browser SDK is not loaded.');
    }

    this.endpoint = endpoint;
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.pendingRequests = new Map();
    this.sequence = 0;
    this.client = new ClientCtor(endpoint);
    this.destroyed = false;
    this.state = {
      transport: 'colyseus',
      connected: false,
      sessionId: null,
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      transcripts: new Map()
    };
    this.lastTransformSentAt = 0;
    this.lastTransform = null;
    this.lastBuilderPresenceSentAt = 0;
    this.lastBuilderPresenceSignature = '';
  }

  async connect() {
    this.room = await this.client.joinOrCreate('world');
    if (this.destroyed) {
      this.room.leave();
      this.room = null;
      return;
    }

    this.state.connected = true;
    this.state.sessionId = this.room.sessionId;
    console.info('[NPC] Joined Colyseus room.', {
      roomName: this.room.name,
      roomId: this.room.roomId,
      sessionId: this.room.sessionId
    });

    this.room.onStateChange((state) => {
      const nextPlayers = new Map();
      for (const [id, player] of schemaMapToEntries(state.players)) {
        nextPlayers.set(id, clonePlayerState(player));
      }

      const nextBuilders = new Map();
      for (const [id, builder] of schemaMapToEntries(state.builders)) {
        nextBuilders.set(id, cloneBuilderState(builder));
      }

      const nextNpcs = new Map();
      for (const [id, npc] of schemaMapToEntries(state.npcs)) {
        nextNpcs.set(id, cloneNpcState(npc));
      }

      this.state.players = nextPlayers;
      this.state.builders = nextBuilders;
      this.state.npcs = nextNpcs;
      this.emit();
    });

    this.room.onMessage('world:patch', (message) => {
      const snapshot = structuredClone(message);
      for (const listener of this.worldPatchListeners) {
        listener(snapshot);
      }
    });

    this.room.onMessage('npc:transcripts', (message) => {
      this.state.transcripts = new Map(Object.entries(message.transcripts ?? {}));
      this.emit();
    });

    this.room.onMessage('npc:transcript', (message) => {
      this.state.transcripts.set(message.npcId, message.entries ?? []);
      this.emit();
    });

    this.room.onMessage('rpc:response', (message) => {
      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pendingRequests.delete(message.requestId);
      pending.resolve(message);
    });

    this.room.onLeave(() => {
      this.state.connected = false;
      this.state.players = new Map();
      this.state.builders = new Map();
      this.emit();
    });

    this.emit();
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

  emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  getState() {
    return {
      ...this.state,
      players: new Map([...this.state.players.entries()].map(([id, player]) => [id, { ...player }])),
      builders: new Map([...this.state.builders.entries()].map(([id, builder]) => [id, { ...builder }])),
      npcs: new Map([...this.state.npcs.entries()].map(([id, npc]) => [id, { ...npc }])),
      transcripts: new Map([...this.state.transcripts.entries()].map(([id, entries]) => [id, entries.map((entry) => ({ ...entry }))]))
    };
  }

  async rpc(type, payload = {}) {
    const requestId = `rpc_${++this.sequence}`;
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('The NPC server did not respond in time.'));
      }, 6000);

      this.pendingRequests.set(requestId, {
        resolve: (message) => {
          window.clearTimeout(timeout);
          resolve(message);
        }
      });
    });

    this.room.send(type, {
      requestId,
      ...payload
    });

    const response = await responsePromise;
    if (!response.ok) {
      return { ok: false, error: response.error ?? 'The request was rejected.' };
    }

    return response;
  }

  async getWorldLayout() {
    if (!this.room) {
      return { tiles: [], props: [], npcs: [] };
    }

    const response = await this.rpc('world:getLayout');
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Could not load the shared world layout.');
    }
    return response.layout ?? { tiles: [], props: [], npcs: [] };
  }

  async placeTile(payload) {
    return this.rpc('world:placeTile', payload);
  }

  async placeProp(payload) {
    return this.rpc('world:placeProp', payload);
  }

  async placeNpc(payload) {
    return this.rpc('world:placeNpc', payload);
  }

  async rotatePlacement(placementId) {
    return this.rpc('world:rotatePlacement', { placementId });
  }

  async deletePlacement(placementId) {
    return this.rpc('world:deletePlacement', { placementId });
  }

  async updateNpc(placementId, updates = {}) {
    return this.rpc('world:updateNpc', {
      placementId,
      ...updates
    });
  }

  setPlayerTransform(position, rotationY = 0) {
    if (!this.room) {
      return;
    }

    const now = performance.now();
    const next = {
      x: quantize(position.x),
      z: quantize(position.z),
      rotationY: quantize(rotationY, 3)
    };
    const moved = !this.lastTransform
      || Math.abs(this.lastTransform.x - next.x) > 0.15
      || Math.abs(this.lastTransform.z - next.z) > 0.15;
    const rotated = !this.lastTransform
      || Math.abs(angleDifference(this.lastTransform.rotationY, next.rotationY)) > 0.08;

    if ((!moved && !rotated) || now - this.lastTransformSentAt < 90) {
      return;
    }

    this.lastTransform = next;
    this.lastTransformSentAt = now;
    this.room.send('player:updateTransform', next);
  }

  setBuilderPresence(presence = {}) {
    if (!this.room) {
      return;
    }

    const next = {
      active: Boolean(presence.active),
      itemId: presence.itemId ?? '',
      rotationQuarterTurns: presence.rotationQuarterTurns ?? 0,
      cellX: presence.cellX ?? 0,
      cellZ: presence.cellZ ?? 0,
      x: quantize(presence.x),
      z: quantize(presence.z),
      selectionPlacementId: presence.selectionPlacementId ?? ''
    };
    const signature = stableStringify(next);
    const now = performance.now();

    if (signature === this.lastBuilderPresenceSignature && now - this.lastBuilderPresenceSentAt < 120) {
      return;
    }

    this.lastBuilderPresenceSignature = signature;
    this.lastBuilderPresenceSentAt = now;
    this.room.send('builder:updatePresence', next);
  }

  async beginInteract(npcId) {
    return this.rpc('npc:beginInteract', { npcId });
  }

  async sendChat(npcId, message) {
    return this.rpc('npc:chat', { npcId, message });
  }

  async endInteract(npcId) {
    return this.rpc('npc:endInteract', { npcId });
  }

  async destroy() {
    this.destroyed = true;
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.listeners.clear();
    this.worldPatchListeners.clear();
  }
}
