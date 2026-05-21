import { PUNCH_INTERVAL_MS, WEAPON_FIRE_INTERVAL_MS } from '../shared/combatConstants.js';
import { DELIVERY_QUEST_STATUS } from '../shared/deliveryQuest.js';
import { quantizeNumber as quantize } from '../shared/numberMath.js';
import {
  getDefaultPropPlacementScale,
  normalizePropPlacementScale
} from '../shared/placementScale.js';
import { NPC_DEFAULT_LAW_RADIUS } from './npcBehavior.js';

const PLAYER_TRANSFORM_SEND_INTERVAL_MS = 50;
const PLAYER_TRANSFORM_MOVE_EPSILON = 0.08;
const PLAYER_TRANSFORM_ROTATION_EPSILON = 0.08;

function forEachSchemaMapEntry(schemaMap, callback) {
  if (!schemaMap) {
    return;
  }

  if (typeof schemaMap.keys === 'function' && typeof schemaMap.get === 'function') {
    for (const key of schemaMap.keys()) {
      callback(key, schemaMap.get(key));
    }
    return;
  }

  const forEachEntry = schemaMap.forEach;
  if (typeof forEachEntry === 'function') {
    forEachEntry.call(schemaMap, (value, key) => {
      callback(key, value);
    });
    return;
  }

  for (const key in schemaMap) {
    if (Object.hasOwn(schemaMap, key)) {
      callback(key, schemaMap[key]);
    }
  }
}

function normalizeTransformSeq(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
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
    policeOfficerEnabled: npc.policeOfficerEnabled === true,
    lawRadius: npc.lawRadius ?? NPC_DEFAULT_LAW_RADIUS,
    deliveryQuestEnabled: npc.deliveryQuestEnabled === true,
    gymCheckInEnabled: npc.gymCheckInEnabled === true,
    rentCollectorEnabled: npc.rentCollectorEnabled === true,
    stockMarketEnabled: npc.stockMarketEnabled === true,
    bartenderEnabled: npc.bartenderEnabled === true,
    pawnShopOwnerEnabled: npc.pawnShopOwnerEnabled === true,
    carDealerEnabled: npc.carDealerEnabled === true,
    marthaEnabled: npc.marthaEnabled === true,
    blackjackDealerEnabled: npc.blackjackDealerEnabled === true,
    schoolMicrogameEnabled: npc.schoolMicrogameEnabled === true,
    schoolMicrogameId: npc.schoolMicrogameId || '',
    health: npc.health ?? 100,
    maxHealth: npc.maxHealth ?? 100,
    alive: npc.alive !== false,
    active: true,
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
  const transform = player?.transform ?? player ?? {};
  const animation = player?.animation ?? player ?? {};
  const chat = player?.chat ?? player ?? {};
  const combat = player?.combat ?? player ?? {};
  const inventory = player?.inventory ?? player ?? {};
  const rentIntro = player?.rentIntro ?? player ?? {};
  const deliveryQuest = player?.deliveryQuest ?? player ?? {};
  const activity = player?.activity ?? player ?? {};
  const skills = player?.skills ?? player ?? {};
  const profile = player?.profile ?? player ?? {};

  return {
    x: transform.x ?? player?.x ?? 0,
    y: transform.y ?? player?.y ?? 0,
    z: transform.z ?? player?.z ?? 0,
    rotationY: transform.rotationY ?? player?.rotationY ?? 0,
    aimRotationY: transform.aimRotationY ?? player?.aimRotationY ?? transform.rotationY ?? player?.rotationY ?? 0,
    aiming: Boolean(transform.aiming ?? player?.aiming),
    skating: Boolean(transform.skating ?? player?.skating),
    transformSeq: normalizeTransformSeq(transform.transformSeq ?? player?.transformSeq, null),
    emoteId: animation.emoteId || player?.emoteId || '',
    emoteActive: Boolean((animation.emoteActive ?? player?.emoteActive) && (animation.emoteId || player?.emoteId)),
    emoteStartedAt: animation.emoteStartedAt ?? player?.emoteStartedAt ?? 0,
    emoteSeq: animation.emoteSeq ?? player?.emoteSeq ?? 0,
    chatText: chat.chatText || player?.chatText || '',
    chatStartedAt: chat.chatStartedAt ?? player?.chatStartedAt ?? 0,
    chatSeq: chat.chatSeq ?? player?.chatSeq ?? 0,
    health: combat.health ?? player?.health ?? 100,
    maxHealth: combat.maxHealth ?? player?.maxHealth ?? 100,
    alive: (combat.alive ?? player?.alive) !== false,
    respawnAt: combat.respawnAt ?? player?.respawnAt ?? 0,
    spawnProtectedUntil: combat.spawnProtectedUntil ?? player?.spawnProtectedUntil ?? 0,
    equippedWeaponId: combat.equippedWeaponId || player?.equippedWeaponId || '',
    ownedWeaponIds: combat.ownedWeaponIds || player?.ownedWeaponIds || '',
    ammoInClip: combat.ammoInClip ?? player?.ammoInClip ?? 0,
    reserveAmmo: combat.reserveAmmo ?? player?.reserveAmmo ?? 0,
    isReloading: Boolean(combat.isReloading ?? player?.isReloading),
    reloadEndsAt: combat.reloadEndsAt ?? player?.reloadEndsAt ?? 0,
    kills: combat.kills ?? player?.kills ?? 0,
    deaths: combat.deaths ?? player?.deaths ?? 0,
    money: inventory.money ?? player?.money ?? 0,
    beerCount: inventory.beerCount ?? player?.beerCount ?? 0,
    shotCount: inventory.shotCount ?? player?.shotCount ?? 0,
    cigaretteCount: inventory.cigaretteCount ?? player?.cigaretteCount ?? 0,
    burgerCount: inventory.burgerCount ?? player?.burgerCount ?? 0,
    glizzyCount: inventory.glizzyCount ?? player?.glizzyCount ?? 0,
    sodaCount: inventory.sodaCount ?? player?.sodaCount ?? 0,
    skateboardOwned: (inventory.skateboardOwned ?? player?.skateboardOwned) === true,
    vehicleItemId: inventory.vehicleItemId ?? player?.vehicleItemId ?? '',
    ownedVehicleItemIds: inventory.ownedVehicleItemIds ?? player?.ownedVehicleItemIds ?? '',
    drunknessDose: inventory.drunknessDose ?? player?.drunknessDose ?? 0,
    drunknessLevel: inventory.drunknessLevel ?? player?.drunknessLevel ?? 0,
    drunknessEndsAt: inventory.drunknessEndsAt ?? player?.drunknessEndsAt ?? 0,
    gymMembershipActive: (inventory.gymMembershipActive ?? player?.gymMembershipActive) === true,
    rentIntroSeq: rentIntro.rentIntroSeq ?? player?.rentIntroSeq ?? 0,
    rentIntroAmount: rentIntro.rentIntroAmount ?? player?.rentIntroAmount ?? 0,
    rentIntroNpcId: rentIntro.rentIntroNpcId || player?.rentIntroNpcId || '',
    rentIntroBuildingPlacementId: rentIntro.rentIntroBuildingPlacementId || player?.rentIntroBuildingPlacementId || '',
    rentIntroStartedAt: rentIntro.rentIntroStartedAt ?? player?.rentIntroStartedAt ?? 0,
    lastDamagedAt: combat.lastDamagedAt ?? player?.lastDamagedAt ?? 0,
    workoutPlacementId: activity.workoutPlacementId || player?.workoutPlacementId || '',
    deliveryQuestId: deliveryQuest.deliveryQuestId || player?.deliveryQuestId || '',
    deliveryQuestStatus: deliveryQuest.deliveryQuestStatus || player?.deliveryQuestStatus || DELIVERY_QUEST_STATUS.inactive,
    deliveryQuestGiverNpcId: deliveryQuest.deliveryQuestGiverNpcId || player?.deliveryQuestGiverNpcId || '',
    deliveryQuestTargetNpcId: deliveryQuest.deliveryQuestTargetNpcId || player?.deliveryQuestTargetNpcId || '',
    deliveryQuestAcceptedAt: deliveryQuest.deliveryQuestAcceptedAt ?? player?.deliveryQuestAcceptedAt ?? 0,
    deliveryQuestCompletedAt: deliveryQuest.deliveryQuestCompletedAt ?? player?.deliveryQuestCompletedAt ?? 0,
    deliveryQuestRecentTargetNpcIds: deliveryQuest.deliveryQuestRecentTargetNpcIds || player?.deliveryQuestRecentTargetNpcIds || '',
    deliveryQuestCompletionCount: deliveryQuest.deliveryQuestCompletionCount ?? player?.deliveryQuestCompletionCount ?? 0,
    gymPumpCompletedAt: activity.gymPumpCompletedAt ?? player?.gymPumpCompletedAt ?? 0,
    stockBoughtAt: activity.stockBoughtAt ?? player?.stockBoughtAt ?? 0,
    blackjackHandPlayedAt: activity.blackjackHandPlayedAt ?? player?.blackjackHandPlayedAt ?? 0,
    schoolTasksCompletedCount: activity.schoolTasksCompletedCount ?? player?.schoolTasksCompletedCount ?? 0,
    janitorTasksCompletedCount: activity.janitorTasksCompletedCount ?? player?.janitorTasksCompletedCount ?? 0,
    officeManagerCompletedAt: activity.officeManagerCompletedAt ?? player?.officeManagerCompletedAt ?? 0,
    ceoCompletedAt: activity.ceoCompletedAt ?? player?.ceoCompletedAt ?? 0,
    strengthXp: skills.strengthXp ?? player?.strengthXp ?? 0,
    agilityXp: skills.agilityXp ?? player?.agilityXp ?? 0,
    intelligenceXp: skills.intelligenceXp ?? player?.intelligenceXp ?? 0,
    charismaXp: skills.charismaXp ?? player?.charismaXp ?? 0,
    skillAwardSeq: skills.skillAwardSeq ?? player?.skillAwardSeq ?? 0,
    skillAwardSkillId: skills.skillAwardSkillId || player?.skillAwardSkillId || '',
    skillAwardXpGained: skills.skillAwardXpGained ?? player?.skillAwardXpGained ?? 0,
    skillAwardOldLevel: skills.skillAwardOldLevel ?? player?.skillAwardOldLevel ?? 1,
    skillAwardNewLevel: skills.skillAwardNewLevel ?? player?.skillAwardNewLevel ?? 1,
    skillAwardAt: skills.skillAwardAt ?? player?.skillAwardAt ?? 0,
    selectedMissionId: profile.selectedMissionId || player?.selectedMissionId || '',
    characterId: profile.characterId || player?.characterId || '',
    isAdmin: player?.isAdmin === true
  };
}

function clonePlainObject(source = null) {
  const clone = {};
  if (!source || typeof source !== 'object') {
    return clone;
  }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      clone[key] = source[key];
    }
  }
  return clone;
}

function cloneNpcDebugState(debug = {}) {
  const path = [];
  if (Array.isArray(debug.path)) {
    for (const point of debug.path) {
      path.push(clonePlainObject(point));
    }
  }

  return {
    id: debug.id || '',
    mode: debug.mode || '',
    activity: debug.activity || '',
    currentStepIndex: debug.currentStepIndex ?? 0,
    currentStepType: debug.currentStepType || '',
    stepCount: debug.stepCount ?? 0,
    targetPlacementId: debug.targetPlacementId || '',
    targetApproach: debug.targetApproach ? clonePlainObject(debug.targetApproach) : null,
    nextPathPoint: debug.nextPathPoint ? clonePlainObject(debug.nextPathPoint) : null,
    steeringTarget: debug.steeringTarget ? clonePlainObject(debug.steeringTarget) : null,
    finalTarget: debug.finalTarget ? clonePlainObject(debug.finalTarget) : null,
    path,
    pathIndex: debug.pathIndex ?? 0,
    pathNodeCount: debug.pathNodeCount ?? 0,
    pathKey: debug.pathKey || '',
    lastRepathAt: debug.lastRepathAt ?? 0,
    idleUntil: debug.idleUntil ?? 0,
    calmEndsAt: debug.calmEndsAt ?? 0,
    hiddenUntil: debug.hiddenUntil ?? 0,
    respawnAt: debug.respawnAt ?? 0,
    wanderPoint: debug.wanderPoint ? clonePlainObject(debug.wanderPoint) : null,
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
    rotationY: builder.rotationY ?? 0,
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

function getBuilderPresenceSignature(presence) {
  return `${presence.active ? '1' : '0'}|${presence.itemId}|${presence.rotationQuarterTurns}|${presence.rotationY}|${presence.scale}|${presence.cellX}|${presence.cellZ}|${presence.x}|${presence.z}|${presence.selectionPlacementId}`;
}

function parseEndpointUrl(endpoint) {
  try {
    if (String(endpoint).startsWith('/')) {
      const baseUrl = globalThis.location?.href ?? 'http://localhost/';
      return new URL(endpoint, baseUrl);
    }

    return new URL(endpoint);
  } catch {
    return null;
  }
}

function getMatchingProtocol(sourceProtocol, secure) {
  if (sourceProtocol === 'http:' || sourceProtocol === 'https:') {
    return secure ? 'https:' : 'http:';
  }

  return secure ? 'wss:' : 'ws:';
}

function createColyseusUrlBuilder(endpoint) {
  const endpointUrl = parseEndpointUrl(endpoint);
  if (!endpointUrl) {
    return undefined;
  }

  const endpointSecure = endpointUrl.protocol === 'https:' || endpointUrl.protocol === 'wss:';
  const endpointHost = endpointUrl.host;
  let hasLoggedCloudRewrite = false;

  return (url) => {
    if (!url.hostname.endsWith('.colyseus.cloud') || url.host === endpointHost) {
      return url.href;
    }

    const rewrittenUrl = new URL(url.href);
    rewrittenUrl.protocol = getMatchingProtocol(url.protocol, endpointSecure);
    rewrittenUrl.host = endpointHost;

    if (!hasLoggedCloudRewrite) {
      hasLoggedCloudRewrite = true;
      console.info('[NPC] Rewriting Colyseus Cloud room address to the configured endpoint host.', {
        from: url.host,
        to: endpointHost
      });
    }

    return rewrittenUrl.href;
  };
}

function getBackendHttpUrl(serviceEndpoint, endpointPath = '/') {
  if (typeof serviceEndpoint !== 'string' || !/^(https?|wss?):\/\//iu.test(serviceEndpoint)) {
    return '';
  }

  try {
    const url = new URL(serviceEndpoint);
    if (url.protocol === 'wss:') {
      url.protocol = 'https:';
    } else if (url.protocol === 'ws:') {
      url.protocol = 'http:';
    }
    url.pathname = endpointPath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function getReconnectDelayMs(attempt) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  return Math.min(8000, Math.round(700 * Math.pow(1.55, safeAttempt - 1)));
}

export class NpcServiceColyseus {
  constructor({ endpoint, playerId = '', accessToken = '', displayName = '' }) {
    const ClientCtor = globalThis.Colyseus?.Client;
    if (!ClientCtor) {
      throw new Error('Colyseus browser SDK is not loaded.');
    }

    this.endpoint = endpoint;
    this.playerId = typeof playerId === 'string' ? playerId.trim() : '';
    this.accessToken = typeof accessToken === 'string' ? accessToken.trim() : '';
    this.displayName = typeof displayName === 'string' ? displayName.trim() : '';
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.combatListeners = new Set();
    this.pendingRequests = new Map();
    this.sequence = 0;
    const urlBuilder = createColyseusUrlBuilder(endpoint);
    this.client = new ClientCtor(endpoint, urlBuilder ? { urlBuilder } : undefined);
    this.destroyed = false;
    this.room = null;
    this.rejoinAttempt = 0;
    this.rejoinTimer = 0;
    this.rejoinInFlight = false;
    this.handleBeforeUnload = () => {
      if (!this.room || this.destroyed) {
        return;
      }

      try {
        this.room.leave(true);
      } catch {
        // The page is unloading; best-effort consented leave is enough.
      }
    };
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.state = {
      transport: 'colyseus',
      connected: false,
      connectionStatus: 'connecting',
      connectionMessage: 'Connecting to multiplayer...',
      reconnectAttempt: 0,
      sessionId: null,
      connectedPlayerCount: 0,
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      npcDebug: new Map(),
      pickups: new Map()
    };
    this.lastTransformSentAt = 0;
    this.lastTransform = null;
    this.nextTransform = {
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      aimRotationY: 0,
      aiming: false,
      skating: false,
      emoteId: '',
      emoteActive: false,
      emoteStartedAt: 0,
      emoteSeq: 0,
      seq: 0
    };
    this.lastTransformSeq = 0;
    this.lastBuilderPresenceSentAt = 0;
    this.lastBuilderPresenceSignature = '';
    this.lastFireSentAt = 0;
    this.lastPunchSentAt = 0;
  }

  async connect() {
    this.setConnectionState({
      connected: false,
      connectionStatus: 'connecting',
      connectionMessage: 'Connecting to multiplayer...',
      reconnectAttempt: 0
    });
    await this.joinRoom({ reason: 'initial' });
  }

  getJoinOptions() {
    return {
      ...(this.accessToken ? { accessToken: this.accessToken } : {}),
      ...(this.displayName ? { displayName: this.displayName } : {}),
      ...(this.playerId ? { playerId: this.playerId } : {})
    };
  }

  async joinRoom({ reason = 'rejoin' } = {}) {
    const room = await this.client.joinOrCreate('world', this.getJoinOptions());
    if (this.destroyed) {
      room.leave();
      return;
    }

    this.attachRoom(room, { reason });
  }

  attachRoom(room, { reason = 'join' } = {}) {
    this.clearRejoinTimer();
    this.rejoinAttempt = 0;
    this.rejoinInFlight = false;
    this.room = room;

    if (room.reconnection) {
      room.reconnection.enabled = true;
      room.reconnection.maxRetries = 8;
      room.reconnection.minUptime = 1000;
      room.reconnection.delay = 250;
      room.reconnection.maxDelay = 3500;
      room.reconnection.maxEnqueuedMessages = 20;
    }

    this.setConnectionState({
      connected: true,
      connectionStatus: 'online',
      connectionMessage: 'Connected to multiplayer.',
      reconnectAttempt: 0,
      sessionId: room.sessionId,
      connectedPlayerCount: this.getOptimisticConnectedPlayerCount()
    });
    console.info('[NPC] Joined Colyseus room.', {
      reason,
      roomName: room.name,
      roomId: room.roomId,
      sessionId: room.sessionId
    });

    room.onStateChange((state) => {
      const nextPlayers = new Map();
      forEachSchemaMapEntry(state.players, (id, player) => {
        nextPlayers.set(id, clonePlayerState(player));
      });
      const nextBuilders = new Map();
      forEachSchemaMapEntry(state.builders, (id, builder) => {
        nextBuilders.set(id, cloneBuilderState(builder));
      });

      const nextNpcs = new Map();
      forEachSchemaMapEntry(state.npcs, (id, npc) => {
        nextNpcs.set(id, cloneNpcState(npc));
      });

      const nextPickups = new Map();
      forEachSchemaMapEntry(state.pickups, (id, pickup) => {
        nextPickups.set(id, clonePickupState(pickup));
      });

      this.state.players = nextPlayers;
      this.state.builders = nextBuilders;
      this.state.npcs = nextNpcs;
      this.state.pickups = nextPickups;
      this.state.connectedPlayerCount = Number.isFinite(Number(state.connectedPlayerCount))
        ? Math.max(0, Math.floor(Number(state.connectedPlayerCount)))
        : nextPlayers.size;
      this.emit();
    });

    room.onMessage('world:patch', (message) => {
      const snapshot = structuredClone(message);
      for (const listener of this.worldPatchListeners) {
        listener(snapshot);
      }
    });

    room.onMessage('rpc:response', (message) => {
      const pending = this.pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      this.pendingRequests.delete(message.requestId);
      pending.resolve(message);
    });

    room.onMessage('combat:event', (message) => {
      const snapshot = structuredClone(message);
      for (const listener of this.combatListeners) {
        listener(snapshot);
      }
    });

    room.onMessage('npc:debugSnapshot', (message = {}) => {
      const nextNpcDebug = new Map();
      const npcs = message?.npcs ?? {};
      for (const id in npcs) {
        if (!Object.hasOwn(npcs, id)) {
          continue;
        }

        const debug = npcs[id];
        nextNpcDebug.set(id, cloneNpcDebugState(debug));
      }
      this.state.npcDebug = nextNpcDebug;
      this.emit();
    });

    if (typeof room.onDrop === 'function') {
      room.onDrop((code, reasonText) => {
        if (this.destroyed || this.room !== room) {
          return;
        }
        this.setConnectionState({
          connected: false,
          connectionStatus: 'reconnecting',
          connectionMessage: 'Connection lost. Reconnecting...',
          reconnectAttempt: room.reconnection?.retryCount ?? 0
        });
        console.warn('[NPC] Colyseus connection dropped; SDK reconnect is active.', {
          code,
          reason: reasonText,
          roomId: room.roomId,
          sessionId: room.sessionId
        });
      });
    }

    if (typeof room.onReconnect === 'function') {
      room.onReconnect(() => {
        if (this.destroyed || this.room !== room) {
          return;
        }
        this.setConnectionState({
          connected: true,
          connectionStatus: 'online',
          connectionMessage: 'Reconnected to multiplayer.',
          reconnectAttempt: 0,
          sessionId: room.sessionId,
          connectedPlayerCount: this.getOptimisticConnectedPlayerCount()
        });
        console.info('[NPC] Reconnected to Colyseus room.', {
          roomId: room.roomId,
          sessionId: room.sessionId
        });
      });
    }

    room.onError((code, message) => {
      if (this.destroyed || this.room !== room) {
        return;
      }
      console.warn('[NPC] Colyseus room error.', { code, message });
    });

    room.onLeave((code, reasonText) => {
      if (this.destroyed || this.room !== room) {
        return;
      }
      this.room = null;
      this.failPendingRequests('The multiplayer connection was interrupted.');
      this.setConnectionState({
        connected: false,
        connectionStatus: 'reconnecting',
        connectionMessage: 'Rejoining the multiplayer server...',
        reconnectAttempt: Math.max(1, this.rejoinAttempt)
      });
      console.warn('[NPC] Left Colyseus room; starting fallback rejoin loop.', {
        code,
        reason: reasonText
      });
      this.startRejoinLoop();
    });

    this.emit();
  }

  setConnectionState(updates = {}) {
    this.state = {
      ...this.state,
      ...updates
    };
    this.emit();
  }

  getOptimisticConnectedPlayerCount() {
    return Math.max(1, Math.floor(Number(this.state.connectedPlayerCount) || this.state.players.size || 1));
  }

  clearRejoinTimer() {
    if (!this.rejoinTimer) {
      return;
    }
    window.clearTimeout(this.rejoinTimer);
    this.rejoinTimer = 0;
  }

  startRejoinLoop() {
    if (this.destroyed || this.rejoinInFlight || this.rejoinTimer) {
      return;
    }

    this.scheduleRejoin(0);
  }

  getLastTransformSeq() {
    return this.lastTransformSeq;
  }

  scheduleRejoin(delayMs) {
    this.clearRejoinTimer();
    this.rejoinTimer = window.setTimeout(() => {
      this.rejoinTimer = 0;
      void this.tryRejoin();
    }, Math.max(0, delayMs));
  }

  async isServerHealthy() {
    const healthUrl = getBackendHttpUrl(this.endpoint, '/health');
    if (!healthUrl) {
      return null;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(`${healthUrl}?_=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async tryRejoin() {
    if (this.destroyed || this.room || this.rejoinInFlight) {
      return;
    }

    this.rejoinInFlight = true;
    this.rejoinAttempt += 1;
    const attempt = this.rejoinAttempt;
    this.setConnectionState({
      connected: false,
      connectionStatus: 'reconnecting',
      connectionMessage: `Rejoining multiplayer... attempt ${attempt}`,
      reconnectAttempt: attempt
    });

    try {
      const healthy = await this.isServerHealthy();
      if (healthy === false) {
        this.setConnectionState({
          connected: false,
          connectionStatus: 'updating',
          connectionMessage: 'Game server is updating. Waiting for it to return...',
          reconnectAttempt: attempt
        });
        throw new Error('Health check failed while rejoining.');
      }

      await this.joinRoom({ reason: 'fallback-rejoin' });
      this.setConnectionState({
        connected: true,
        connectionStatus: 'online',
        connectionMessage: 'Rejoined multiplayer.',
        reconnectAttempt: 0,
        connectedPlayerCount: this.getOptimisticConnectedPlayerCount()
      });
    } catch (error) {
      if (!this.destroyed && !this.room) {
        const delayMs = getReconnectDelayMs(attempt);
        const serverStillUpdating = error?.message === 'Health check failed while rejoining.';
        console.warn('[NPC] Rejoin attempt failed; retrying.', {
          attempt,
          delayMs,
          error: error?.message || String(error)
        });
        this.setConnectionState({
          connected: false,
          connectionStatus: serverStillUpdating ? 'updating' : 'reconnecting',
          connectionMessage: serverStillUpdating
            ? `Game server is updating. Retrying in ${Math.ceil(delayMs / 1000)}s`
            : `Still reconnecting... retrying in ${Math.ceil(delayMs / 1000)}s`,
          reconnectAttempt: attempt
        });
        this.scheduleRejoin(delayMs);
      }
    } finally {
      this.rejoinInFlight = false;
    }
  }

  failPendingRequests(message = 'The multiplayer server did not respond.') {
    for (const requestId of this.pendingRequests.keys()) {
      const pending = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      pending.reject?.(new Error(message));
    }
  }

  canSendRoomMessage() {
    return Boolean(this.room && this.state.connected);
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
    const players = new Map();
    for (const id of this.state.players.keys()) {
      const player = this.state.players.get(id);
      players.set(id, clonePlainObject(player));
    }

    const builders = new Map();
    for (const id of this.state.builders.keys()) {
      const builder = this.state.builders.get(id);
      builders.set(id, clonePlainObject(builder));
    }

    const npcs = new Map();
    for (const id of this.state.npcs.keys()) {
      const npc = this.state.npcs.get(id);
      npcs.set(id, clonePlainObject(npc));
    }

    const npcDebug = new Map();
    for (const id of this.state.npcDebug.keys()) {
      const debug = this.state.npcDebug.get(id);
      npcDebug.set(id, cloneNpcDebugState(debug));
    }

    const pickups = new Map();
    for (const id of this.state.pickups.keys()) {
      const pickup = this.state.pickups.get(id);
      pickups.set(id, clonePlainObject(pickup));
    }

    const snapshot = clonePlainObject(this.state);
    snapshot.players = players;
    snapshot.builders = builders;
    snapshot.npcs = npcs;
    snapshot.npcDebug = npcDebug;
    snapshot.pickups = pickups;
    return snapshot;
  }

  async rpc(type, payload = {}) {
    if (!this.canSendRoomMessage()) {
      return { ok: false, error: 'The multiplayer server is reconnecting.' };
    }

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
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
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
    if (!this.canSendRoomMessage()) {
      return;
    }

    const now = performance.now();
    const emoteId = typeof animationState.emoteId === 'string' ? animationState.emoteId : '';
    const aimRotationY = Number(animationState.aimRotationY);
    const next = this.nextTransform;
    next.x = quantize(position.x);
    next.y = quantize(position.y);
    next.z = quantize(position.z);
    next.rotationY = quantize(rotationY, 3);
    next.aimRotationY = quantize(Number.isFinite(aimRotationY) ? aimRotationY : rotationY, 3);
    next.aiming = Boolean(animationState.aiming);
    next.skating = Boolean(animationState.skating);
    next.emoteId = emoteId;
    next.emoteActive = Boolean(animationState.emoteActive && emoteId);
    next.emoteStartedAt = Number.isFinite(animationState.emoteStartedAt) ? Math.max(0, Math.floor(animationState.emoteStartedAt)) : 0;
    next.emoteSeq = Number.isFinite(animationState.emoteSeq) ? Math.max(0, Math.floor(animationState.emoteSeq)) : 0;
    const moved = !this.lastTransform
      || Math.abs(this.lastTransform.x - next.x) > PLAYER_TRANSFORM_MOVE_EPSILON
      || Math.abs((this.lastTransform.y ?? 0) - next.y) > PLAYER_TRANSFORM_MOVE_EPSILON
      || Math.abs(this.lastTransform.z - next.z) > PLAYER_TRANSFORM_MOVE_EPSILON;
    const rotated = !this.lastTransform
      || Math.abs(angleDifference(this.lastTransform.rotationY, next.rotationY)) > PLAYER_TRANSFORM_ROTATION_EPSILON;
    const aimRotated = !this.lastTransform
      || Math.abs(angleDifference(this.lastTransform.aimRotationY, next.aimRotationY)) > PLAYER_TRANSFORM_ROTATION_EPSILON;
    const emoteChanged = !this.lastTransform
      || this.lastTransform.emoteId !== next.emoteId
      || this.lastTransform.emoteActive !== next.emoteActive
      || this.lastTransform.emoteStartedAt !== next.emoteStartedAt
      || this.lastTransform.emoteSeq !== next.emoteSeq;
    const aimStateChanged = !this.lastTransform
      || this.lastTransform.aiming !== next.aiming;
    const skatingStateChanged = !this.lastTransform
      || this.lastTransform.skating !== next.skating;

    if (
      (!moved && !rotated && !aimRotated && !emoteChanged && !aimStateChanged && !skatingStateChanged)
      || (
        !emoteChanged
        && !aimRotated
        && !aimStateChanged
        && !skatingStateChanged
        && now - this.lastTransformSentAt < PLAYER_TRANSFORM_SEND_INTERVAL_MS
      )
    ) {
      return;
    }

    const transformSeq = ++this.lastTransformSeq;
    if (!this.lastTransform) {
      this.lastTransform = {};
    }
    next.seq = transformSeq;
    Object.assign(this.lastTransform, next);
    this.lastTransformSentAt = now;
    this.room.send('player:updateTransform', next);
  }

  setCharacter(characterId = '') {
    const normalized = typeof characterId === 'string' ? characterId.trim() : '';
    if (!this.canSendRoomMessage() || !normalized) {
      return;
    }

    const localPlayer = this.state.players.get(this.state.sessionId);
    if (localPlayer?.characterId === normalized) {
      return;
    }

    this.room.send('player:setCharacter', {
      characterId: normalized
    });
  }

  setBuilderPresence(presence = {}) {
    if (!this.canSendRoomMessage()) {
      return;
    }

    const next = {
      active: Boolean(presence.active),
      itemId: presence.itemId ?? '',
      rotationQuarterTurns: presence.rotationQuarterTurns ?? 0,
      rotationY: quantize(presence.rotationY, 3),
      scale: normalizePropPlacementScale(presence.scale, getDefaultPropPlacementScale(presence.itemId)),
      cellX: presence.cellX ?? 0,
      cellZ: presence.cellZ ?? 0,
      x: quantize(presence.x),
      z: quantize(presence.z),
      selectionPlacementId: presence.selectionPlacementId ?? ''
    };
    const signature = getBuilderPresenceSignature(next);
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

  async acceptDeliveryQuest(giverNpcId = '') {
    return this.rpc('quest:acceptDelivery', {
      giverNpcId: String(giverNpcId ?? '').trim()
    });
  }

  async completeDeliveryQuest(targetNpcId = '') {
    return this.rpc('quest:completeDelivery', {
      targetNpcId: String(targetNpcId ?? '').trim()
    });
  }

  async buyGymMembership(npcId = '') {
    return this.rpc('gym:buyMembership', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async getStockMarket(npcId = '') {
    return this.rpc('stock:getMarket', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async tradeStock(npcId = '', symbol = '', side = '', quantity = 1, options = {}) {
    return this.rpc('stock:trade', {
      npcId: String(npcId ?? '').trim(),
      symbol: String(symbol ?? '').trim(),
      side: String(side ?? '').trim(),
      quantity,
      source: options?.source ? String(options.source) : undefined
    });
  }

  async getWalletSnapshot() {
    return this.rpc('wallet:getSnapshot');
  }

  async buyBartenderDrink(npcId = '', itemId = '') {
    return this.rpc('bartender:buyDrink', {
      npcId: String(npcId ?? '').trim(),
      itemId: String(itemId ?? '').trim()
    });
  }

  async buyPawnShopItem(npcId = '', itemId = '') {
    return this.rpc('pawnShop:buyItem', {
      npcId: String(npcId ?? '').trim(),
      itemId: String(itemId ?? '').trim()
    });
  }

  async buyCarDealerVehicle(npcId = '', itemId = '') {
    return this.rpc('carDealer:buyVehicle', {
      npcId: String(npcId ?? '').trim(),
      itemId: String(itemId ?? '').trim()
    });
  }

  async selectPlayerVehicle(itemId = '') {
    return this.rpc('vehicle:select', {
      itemId: String(itemId ?? '').trim()
    });
  }

  async buyMarthaItem(npcId = '', itemId = '') {
    return this.rpc('martha:buyItem', {
      npcId: String(npcId ?? '').trim(),
      itemId: String(itemId ?? '').trim()
    });
  }

  async consumeInventoryItem(itemId = '') {
    return this.rpc('inventory:consumeItem', {
      itemId: String(itemId ?? '').trim()
    });
  }

  async completeVibeHero(songId = '', result = {}) {
    return this.rpc('vibeHero:complete', {
      songId: String(songId ?? '').trim(),
      score: result?.score,
      accuracy: result?.accuracy,
      hits: result?.hits,
      misses: result?.misses
    });
  }

  async startBlackjack(npcId = '', wager = 0) {
    return this.rpc('blackjack:start', {
      npcId: String(npcId ?? '').trim(),
      wager
    });
  }

  async hitBlackjack(npcId = '') {
    return this.rpc('blackjack:hit', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async standBlackjack(npcId = '') {
    return this.rpc('blackjack:stand', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async doubleBlackjack(npcId = '') {
    return this.rpc('blackjack:double', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async splitBlackjack(npcId = '') {
    return this.rpc('blackjack:split', {
      npcId: String(npcId ?? '').trim()
    });
  }

  async completeSchoolMicrogame(npcId = '', gameId = '', result = {}) {
    return this.rpc('schoolMicrogame:complete', {
      npcId: String(npcId ?? '').trim(),
      gameId: String(gameId ?? '').trim(),
      score: result?.score
    });
  }

  async completeOfficeJob(placementId = '', jobId = '', result = {}) {
    return this.rpc('officeJob:complete', {
      placementId: String(placementId ?? '').trim(),
      jobId: String(jobId ?? '').trim(),
      score: result?.score
    });
  }

  async selectMission(missionId = '') {
    return this.rpc('mission:select', {
      missionId: String(missionId ?? '').trim()
    });
  }

  pickupWeapon(pickupId) {
    if (!this.canSendRoomMessage()) {
      return;
    }

    this.room?.send('combat:pickupRequest', {
      pickupId: String(pickupId ?? '')
    });
  }

  equipWeapon(weaponId = '') {
    if (!this.canSendRoomMessage()) {
      return;
    }

    this.room?.send('combat:equipRequest', {
      weaponId: String(weaponId ?? '').trim()
    });
  }

  fireWeapon(aimDirection = { x: 0, z: 0 }, clientShotAt = Date.now(), origin = null) {
    if (!this.canSendRoomMessage()) {
      return false;
    }

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
    if (!this.canSendRoomMessage()) {
      return false;
    }

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
    if (!this.canSendRoomMessage()) {
      return;
    }

    this.room?.send('combat:reloadRequest', {});
  }

  async claimWorkoutPlacement(placementId = '') {
    const normalized = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalized) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    return this.rpc('workout:claim', { placementId: normalized });
  }

  async completeWorkoutPlacement(placementId = '', result = {}) {
    const normalized = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalized) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    return this.rpc('workout:complete', {
      placementId: normalized,
      awardXp: result?.awardXp !== false
    });
  }

  async releaseWorkoutPlacement(placementId = '') {
    return this.rpc('workout:release', {
      placementId: typeof placementId === 'string' ? placementId.trim() : ''
    });
  }

  async destroy() {
    this.destroyed = true;
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.clearRejoinTimer();
    this.failPendingRequests('The multiplayer connection was closed.');
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
