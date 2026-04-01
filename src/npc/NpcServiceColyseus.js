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
    busy: npc.busy,
    currentSpeakerSessionId: npc.currentSpeakerSessionId || null,
    latestUtterance: npc.latestUtterance || '',
    transcriptVersion: npc.transcriptVersion || 0
  };
}

export class NpcServiceColyseus {
  constructor({ endpoint }) {
    const ClientCtor = globalThis.Colyseus?.Client;
    if (!ClientCtor) {
      throw new Error('Colyseus browser SDK is not loaded.');
    }

    this.endpoint = endpoint;
    this.listeners = new Set();
    this.pendingRequests = new Map();
    this.sequence = 0;
    this.client = new ClientCtor(endpoint);
    this.state = {
      transport: 'colyseus',
      connected: false,
      sessionId: null,
      npcs: new Map(),
      transcripts: new Map()
    };
    this.lastTransformSentAt = 0;
    this.lastTransform = null;
  }

  async connect() {
    this.room = await this.client.joinOrCreate('world');
    this.state.connected = true;
    this.state.sessionId = this.room.sessionId;
    console.info('[NPC] Joined Colyseus room.', {
      roomName: this.room.name,
      roomId: this.room.roomId,
      sessionId: this.room.sessionId
    });

    this.room.onStateChange((state) => {
      const nextNpcs = new Map();
      for (const [id, npc] of schemaMapToEntries(state.npcs)) {
        nextNpcs.set(id, cloneNpcState(npc));
      }
      this.state.npcs = nextNpcs;
      console.debug('[NPC] Colyseus state update.', {
        npcCount: nextNpcs.size
      });
      this.emit();
    });

    this.room.onMessage('npc:transcripts', (message) => {
      this.state.transcripts = new Map(Object.entries(message.transcripts ?? {}));
      console.debug('[NPC] Received transcript snapshot.', {
        npcCount: this.state.transcripts.size
      });
      this.emit();
    });

    this.room.onMessage('npc:transcript', (message) => {
      this.state.transcripts.set(message.npcId, message.entries ?? []);
      console.debug('[NPC] Received transcript update.', {
        npcId: message.npcId,
        entryCount: message.entries?.length ?? 0
      });
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
      console.warn('[NPC] Left Colyseus room.');
      this.emit();
    });

    this.emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
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

  async syncDefinitions(npcs = []) {
    if (!this.room) {
      return;
    }

    console.info('[NPC] Syncing NPC definitions to Colyseus.', {
      npcCount: npcs.length
    });
    await this.rpc('npc:syncDefinitions', {
      npcs
    });
  }

  setPlayerTransform(position) {
    if (!this.room) {
      return;
    }

    const now = performance.now();
    const next = {
      x: Number(position.x.toFixed(2)),
      z: Number(position.z.toFixed(2))
    };
    const changed = !this.lastTransform
      || Math.abs(this.lastTransform.x - next.x) > 0.15
      || Math.abs(this.lastTransform.z - next.z) > 0.15;

    if (!changed || now - this.lastTransformSentAt < 90) {
      return;
    }

    this.lastTransform = next;
    this.lastTransformSentAt = now;
    this.room.send('player:updateTransform', next);
  }

  async beginInteract(npcId) {
    console.info('[NPC] Colyseus beginInteract.', { npcId });
    return this.rpc('npc:beginInteract', { npcId });
  }

  async sendChat(npcId, message) {
    console.info('[NPC] Colyseus sendChat.', {
      npcId,
      messageLength: message.trim().length
    });
    return this.rpc('npc:chat', { npcId, message });
  }

  async endInteract(npcId) {
    console.info('[NPC] Colyseus endInteract.', { npcId });
    return this.rpc('npc:endInteract', { npcId });
  }

  async destroy() {
    if (this.room) {
      this.room.leave();
    }
    this.listeners.clear();
  }
}
