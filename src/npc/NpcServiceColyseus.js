import { PUNCH_INTERVAL_MS, WEAPON_FIRE_INTERVAL_MS } from '../shared/combatConstants.js';

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
    x: npc.x,
    z: npc.z,
    rotationY: npc.rotationY ?? (npc.rotationQuarterTurns * (Math.PI / 2)),
    rotationQuarterTurns: npc.rotationQuarterTurns,
    interactRadius: npc.interactRadius,
    health: npc.health ?? 100,
    maxHealth: npc.maxHealth ?? 100,
    alive: npc.alive !== false,
    active: npc.active !== false,
    mode: npc.mode || 'routine',
    currentStepIndex: npc.currentStepIndex ?? 0,
    targetPlacementId: npc.targetPlacementId || '',
    weaponId: npc.weaponId || '',
    lastAttackerId: npc.lastAttackerId || '',
    hiddenUntil: npc.hiddenUntil ?? 0,
    respawnAt: npc.respawnAt ?? 0,
    activity: npc.activity || '',
    lastDamagedAt: npc.lastDamagedAt ?? 0,
    busy: npc.busy,
    chatStatus: npc.chatStatus || 'idle',
    chatText: npc.chatText || '',
    chatStartedAt: npc.chatStartedAt || 0,
    chatSeq: npc.chatSeq || 0
  };
}

function clonePlayerState(player) {
  return {
    x: player.x,
    z: player.z,
    rotationY: player.rotationY ?? 0,
    aimRotationY: player.aimRotationY ?? player.rotationY ?? 0,
    aiming: Boolean(player.aiming),
    emoteId: player.emoteId || '',
    emoteActive: Boolean(player.emoteActive && player.emoteId),
    emoteStartedAt: player.emoteStartedAt ?? 0,
    emoteSeq: player.emoteSeq ?? 0,
    chatText: player.chatText || '',
    chatStartedAt: player.chatStartedAt || 0,
    chatSeq: player.chatSeq || 0,
    health: player.health ?? 100,
    maxHealth: player.maxHealth ?? 100,
    alive: player.alive !== false,
    respawnAt: player.respawnAt ?? 0,
    spawnProtectedUntil: player.spawnProtectedUntil ?? 0,
    equippedWeaponId: player.equippedWeaponId || '',
    ammoInClip: player.ammoInClip ?? 0,
    reserveAmmo: player.reserveAmmo ?? 0,
    isReloading: Boolean(player.isReloading),
    reloadEndsAt: player.reloadEndsAt ?? 0,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    lastDamagedAt: player.lastDamagedAt ?? 0,
    workoutPlacementId: player.workoutPlacementId || '',
    characterId: player.characterId || '',
    isAdmin: player.isAdmin === true
  };
}

function cloneNpcDebugState(debug = {}) {
  return {
    id: debug.id || '',
    mode: debug.mode || '',
    activity: debug.activity || '',
    currentStepIndex: debug.currentStepIndex ?? 0,
    currentStepType: debug.currentStepType || '',
    stepCount: debug.stepCount ?? 0,
    targetPlacementId: debug.targetPlacementId || '',
    targetApproach: debug.targetApproach ? { ...debug.targetApproach } : null,
    nextPathPoint: debug.nextPathPoint ? { ...debug.nextPathPoint } : null,
    steeringTarget: debug.steeringTarget ? { ...debug.steeringTarget } : null,
    finalTarget: debug.finalTarget ? { ...debug.finalTarget } : null,
    path: Array.isArray(debug.path) ? debug.path.map((point) => ({ ...point })) : [],
    pathIndex: debug.pathIndex ?? 0,
    pathNodeCount: debug.pathNodeCount ?? 0,
    pathKey: debug.pathKey || '',
    lastRepathAt: debug.lastRepathAt ?? 0,
    idleUntil: debug.idleUntil ?? 0,
    calmEndsAt: debug.calmEndsAt ?? 0,
    hiddenUntil: debug.hiddenUntil ?? 0,
    respawnAt: debug.respawnAt ?? 0,
    wanderPoint: debug.wanderPoint ? { ...debug.wanderPoint } : null,
    stepStartedAt: debug.stepStartedAt ?? 0,
    busy: Boolean(debug.busy),
    alive: debug.alive !== false,
    weaponId: debug.weaponId || '',
    lastAttackerId: debug.lastAttackerId || '',
    debugAgeMs: debug.debugAgeMs ?? 0,
    idleRemainingMs: debug.idleRemainingMs ?? 0,
    calmRemainingMs: debug.calmRemainingMs ?? 0,
    hiddenRemainingMs: debug.hiddenRemainingMs ?? 0,
    respawnRemainingMs: debug.respawnRemainingMs ?? 0
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

function clonePickupState(pickup) {
  return {
    id: pickup.id,
    weaponId: pickup.weaponId || '',
    x: pickup.x ?? 0,
    z: pickup.z ?? 0,
    ammoInClip: pickup.ammoInClip ?? 0,
    reserveAmmo: pickup.reserveAmmo ?? 0,
    kind: pickup.kind || 'spawn',
    active: pickup.active !== false,
    respawnAt: pickup.respawnAt ?? 0,
    despawnAt: pickup.despawnAt ?? 0
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
  constructor({ endpoint, adminKey = '' }) {
    const ClientCtor = globalThis.Colyseus?.Client;
    if (!ClientCtor) {
      throw new Error('Colyseus browser SDK is not loaded.');
    }

    this.endpoint = endpoint;
    this.adminKey = typeof adminKey === 'string' ? adminKey.trim() : '';
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.combatListeners = new Set();
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
      npcDebug: new Map(),
      pickups: new Map()
    };
    this.lastTransformSentAt = 0;
    this.lastTransform = null;
    this.lastBuilderPresenceSentAt = 0;
    this.lastBuilderPresenceSignature = '';
    this.lastFireSentAt = 0;
    this.lastPunchSentAt = 0;
  }

  async connect() {
    this.room = await this.client.joinOrCreate('world', this.adminKey ? { adminKey: this.adminKey } : {});
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

      const nextPickups = new Map();
      for (const [id, pickup] of schemaMapToEntries(state.pickups)) {
        nextPickups.set(id, clonePickupState(pickup));
      }

      this.state.players = nextPlayers;
      this.state.builders = nextBuilders;
      this.state.npcs = nextNpcs;
      this.state.pickups = nextPickups;
      this.emit();
    });

    this.room.onMessage('world:patch', (message) => {
      const snapshot = structuredClone(message);
      for (const listener of this.worldPatchListeners) {
        listener(snapshot);
      }
    });

    this.room.onMessage('rpc:response', (message) => {
      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pendingRequests.delete(message.requestId);
      pending.resolve(message);
    });

    this.room.onMessage('combat:event', (message) => {
      const snapshot = structuredClone(message);
      for (const listener of this.combatListeners) {
        listener(snapshot);
      }
    });

    this.room.onMessage('npc:debugSnapshot', (message = {}) => {
      const nextNpcDebug = new Map();
      for (const [id, debug] of Object.entries(message?.npcs ?? {})) {
        nextNpcDebug.set(id, cloneNpcDebugState(debug));
      }
      this.state.npcDebug = nextNpcDebug;
      this.emit();
    });

    this.room.onLeave(() => {
      this.state.connected = false;
      this.state.players = new Map();
      this.state.builders = new Map();
      this.state.npcs = new Map();
      this.state.npcDebug = new Map();
      this.state.pickups = new Map();
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

  subscribeCombatEvents(listener) {
    this.combatListeners.add(listener);
    return () => this.combatListeners.delete(listener);
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
      npcDebug: new Map([...this.state.npcDebug.entries()].map(([id, debug]) => [id, cloneNpcDebugState(debug)])),
      pickups: new Map([...this.state.pickups.entries()].map(([id, pickup]) => [id, { ...pickup }]))
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

  async editWorld(op, payload = {}) {
    return this.rpc('world:edit', {
      op,
      payload
    });
  }

  setPlayerTransform(position, rotationY = 0, animationState = {}) {
    if (!this.room) {
      return;
    }

    const now = performance.now();
    const emoteId = typeof animationState.emoteId === 'string' ? animationState.emoteId : '';
    const aimRotationY = Number(animationState.aimRotationY);
    const next = {
      x: quantize(position.x),
      z: quantize(position.z),
      rotationY: quantize(rotationY, 3),
      aimRotationY: quantize(Number.isFinite(aimRotationY) ? aimRotationY : rotationY, 3),
      aiming: Boolean(animationState.aiming),
      emoteId,
      emoteActive: Boolean(animationState.emoteActive && emoteId),
      emoteStartedAt: Number.isFinite(animationState.emoteStartedAt) ? Math.max(0, Math.floor(animationState.emoteStartedAt)) : 0,
      emoteSeq: Number.isFinite(animationState.emoteSeq) ? Math.max(0, Math.floor(animationState.emoteSeq)) : 0
    };
    const moved = !this.lastTransform
      || Math.abs(this.lastTransform.x - next.x) > 0.15
      || Math.abs(this.lastTransform.z - next.z) > 0.15;
    const rotated = !this.lastTransform
      || Math.abs(angleDifference(this.lastTransform.rotationY, next.rotationY)) > 0.08;
    const aimRotated = !this.lastTransform
      || Math.abs(angleDifference(this.lastTransform.aimRotationY, next.aimRotationY)) > 0.08;
    const emoteChanged = !this.lastTransform
      || this.lastTransform.emoteId !== next.emoteId
      || this.lastTransform.emoteActive !== next.emoteActive
      || this.lastTransform.emoteStartedAt !== next.emoteStartedAt
      || this.lastTransform.emoteSeq !== next.emoteSeq;
    const aimStateChanged = !this.lastTransform
      || this.lastTransform.aiming !== next.aiming;

    if ((!moved && !rotated && !aimRotated && !emoteChanged && !aimStateChanged) || (!emoteChanged && !aimRotated && !aimStateChanged && now - this.lastTransformSentAt < 90)) {
      return;
    }

    this.lastTransform = next;
    this.lastTransformSentAt = now;
    this.room.send('player:updateTransform', next);
  }

  setCharacter(characterId = '') {
    const normalized = typeof characterId === 'string' ? characterId.trim() : '';
    if (!this.room || !normalized) {
      return;
    }

    const localPlayer = this.state.players.get(this.state.sessionId);
    if (localPlayer?.isAdmin !== true) {
      return;
    }

    if (localPlayer?.characterId === normalized) {
      return;
    }

    this.room.send('player:setCharacter', {
      characterId: normalized
    });
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

  async say(message) {
    return this.rpc('chat:say', { message });
  }

  pickupWeapon(pickupId) {
    this.room?.send('combat:pickupRequest', {
      pickupId: String(pickupId ?? '')
    });
  }

  fireWeapon(aimDirection = { x: 0, z: 0 }, clientShotAt = Date.now(), origin = null) {
    const player = this.state.players.get(this.state.sessionId);
    const now = Date.now();
    if (!player || player.alive === false || !player.equippedWeaponId || player.isReloading) {
      return false;
    }
    if (player.ammoInClip <= 0 || (now - this.lastFireSentAt) < WEAPON_FIRE_INTERVAL_MS) {
      return false;
    }

    this.lastFireSentAt = now;
    this.room?.send('combat:fireRequest', {
      aimX: quantize(aimDirection.x, 4),
      aimZ: quantize(aimDirection.z, 4),
      originX: Number.isFinite(origin?.x) ? quantize(origin.x, 4) : undefined,
      originZ: Number.isFinite(origin?.z) ? quantize(origin.z, 4) : undefined,
      clientShotAt: Number.isFinite(clientShotAt) ? Math.max(0, Math.floor(clientShotAt)) : now
    });
    return true;
  }

  punch(aimDirection = { x: 0, z: 1 }, clientPunchAt = Date.now()) {
    const player = this.state.players.get(this.state.sessionId);
    const now = Date.now();
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return false;
    }
    if ((now - this.lastPunchSentAt) < PUNCH_INTERVAL_MS) {
      return false;
    }

    this.lastPunchSentAt = now;
    this.room?.send('combat:punchRequest', {
      aimX: quantize(aimDirection.x, 4),
      aimZ: quantize(aimDirection.z, 4),
      clientPunchAt: Number.isFinite(clientPunchAt) ? Math.max(0, Math.floor(clientPunchAt)) : now
    });
    return true;
  }

  reloadWeapon() {
    this.room?.send('combat:reloadRequest', {});
  }

  async claimWorkoutPlacement(placementId = '') {
    const normalized = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalized) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    return this.rpc('workout:claim', { placementId: normalized });
  }

  async releaseWorkoutPlacement(placementId = '') {
    return this.rpc('workout:release', {
      placementId: typeof placementId === 'string' ? placementId.trim() : ''
    });
  }

  async destroy() {
    this.destroyed = true;
    this.lastFireSentAt = 0;
    this.lastPunchSentAt = 0;
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.listeners.clear();
    this.worldPatchListeners.clear();
    this.combatListeners.clear();
  }
}
