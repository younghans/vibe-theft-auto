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

export class NpcServiceMock {
  constructor() {
    console.info('[NPC] Mock NPC service initialized.');
    this.listeners = new Set();
    this.definitions = new Map();
    this.state = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      npcs: new Map(),
      transcripts: new Map()
    };
    this.sequence = 0;
    this.playerPosition = { x: 0, z: 0 };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState() {
    return {
      ...this.state,
      npcs: new Map([...this.state.npcs.entries()].map(([id, npc]) => [id, { ...npc }])),
      transcripts: new Map([...this.state.transcripts.entries()].map(([id, entries]) => [id, entries.map((entry) => ({ ...entry }))]))
    };
  }

  emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  syncDefinitions(npcs = []) {
    console.info('[NPC] Mock NPC definitions synchronized.', {
      npcCount: npcs.length
    });
    const nextIds = new Set(npcs.map((npc) => npc.id));

    for (const npc of npcs) {
      this.definitions.set(npc.id, structuredClone(npc));
      const previous = this.state.npcs.get(npc.id);
      this.state.npcs.set(npc.id, {
        id: npc.id,
        modelId: npc.modelId,
        name: npc.name,
        position: [...npc.position],
        rotationQuarterTurns: npc.rotationQuarterTurns,
        interactRadius: npc.interactRadius,
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

    this.emit();
  }

  setPlayerTransform(position) {
    this.playerPosition = {
      x: position.x,
      z: position.z
    };
  }

  async beginInteract(npcId) {
    console.info('[NPC] Mock beginInteract.', { npcId });
    const npc = this.state.npcs.get(npcId);
    if (!npc) {
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
    if (!npc || !definition) {
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
  }
}
