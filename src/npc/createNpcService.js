import { NpcServiceColyseus } from './NpcServiceColyseus.js';
import { NpcServiceMock } from './NpcServiceMock.js';

const PLAYER_ID_STORAGE_KEY = 'stickrpg.playerId';

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isLocalEnvironment(url) {
  return url.protocol === 'file:'
    || url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]';
}

function readConfiguredEndpoint(url) {
  const queryValue = url.searchParams.get('server');
  if (queryValue) {
    return queryValue;
  }

  const metaValue = document
    .querySelector('meta[name="stickrpg-server-url"]')
    ?.getAttribute('content')
    ?.trim();
  if (metaValue) {
    return metaValue;
  }

  const globalValue = globalThis.STICKRPG_SERVER_URL;
  if (typeof globalValue === 'string' && globalValue.trim()) {
    return globalValue.trim();
  }

  if (isLocalEnvironment(url)) {
    return 'ws://localhost:2567';
  }

  const transport = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${transport}//${url.host}`;
}

function readAdminKey(url) {
  const value = url.searchParams.get('adminKey');
  return typeof value === 'string' ? value.trim() : '';
}

function createPlayerId() {
  if (globalThis.crypto?.randomUUID) {
    return `player:${globalThis.crypto.randomUUID()}`;
  }

  return `player:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readPersistentPlayerId() {
  try {
    const stored = window.localStorage?.getItem(PLAYER_ID_STORAGE_KEY);
    const normalized = typeof stored === 'string' ? stored.trim() : '';
    if (normalized) {
      return normalized;
    }

    const next = createPlayerId();
    window.localStorage?.setItem(PLAYER_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createPlayerId();
  }
}

export async function createNpcService({
  endpoint = null,
  connectTimeoutMs = 1200,
  retryWindowMs = 2500,
  retryDelayMs = 250
} = {}) {
  const url = new URL(window.location.href);
  const resolvedEndpoint = endpoint ?? readConfiguredEndpoint(url);
  const adminKey = readAdminKey(url);
  const playerId = readPersistentPlayerId();
  const allowMockFallback = url.searchParams.get('allowMockFallback') === '1' || isLocalEnvironment(url);

  if (url.searchParams.get('npcTransport') === 'mock') {
    console.info('[NPC] Using local mock transport because ?npcTransport=mock is set.');
    return new NpcServiceMock({ adminKey, playerId });
  }

  const deadline = performance.now() + retryWindowMs;
  let attempt = 0;
  let lastError = null;

  while (performance.now() < deadline) {
    attempt += 1;
    const service = new NpcServiceColyseus({
      endpoint: resolvedEndpoint,
      adminKey,
      playerId
    });
    try {
      await Promise.race([
        service.connect(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('Timed out connecting to Colyseus.')), connectTimeoutMs))
      ]);
      console.info(`[NPC] Connected to Colyseus transport at ${resolvedEndpoint}.`, {
        attempt
      });
      return service;
    } catch (error) {
      lastError = error;
      await service.destroy();

      const remainingMs = Math.max(0, Math.ceil(deadline - performance.now()));
      if (!remainingMs) {
        break;
      }
      await wait(Math.min(retryDelayMs, remainingMs));
    }
  }

  const reason = lastError instanceof Error
    ? lastError.message
    : String(lastError ?? 'Unable to connect to Colyseus.');

  if (!allowMockFallback) {
    throw new Error(`Could not connect to the multiplayer server at ${resolvedEndpoint}. ${reason}`);
  }

  console.warn('[NPC] Falling back to local mock transport.', {
    endpoint: resolvedEndpoint,
    reason
  });
  return new NpcServiceMock({ adminKey, playerId });
}
