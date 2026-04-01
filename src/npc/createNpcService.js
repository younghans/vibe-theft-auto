import { NpcServiceColyseus } from './NpcServiceColyseus.js';
import { NpcServiceMock } from './NpcServiceMock.js';

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function createNpcService({
  endpoint = 'ws://localhost:2567',
  connectTimeoutMs = 1500,
  retryWindowMs = 8000,
  retryDelayMs = 500
} = {}) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('npcTransport') === 'mock') {
    console.info('[NPC] Using local mock transport because ?npcTransport=mock is set.');
    return new NpcServiceMock();
  }

  const deadline = performance.now() + retryWindowMs;
  let attempt = 0;
  let lastError = null;

  while (performance.now() < deadline) {
    attempt += 1;
    const service = new NpcServiceColyseus({ endpoint });
    try {
      await Promise.race([
        service.connect(),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('Timed out connecting to Colyseus.')), connectTimeoutMs))
      ]);
      console.info(`[NPC] Connected to Colyseus transport at ${endpoint}.`, {
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

  console.warn('[NPC] Falling back to local mock transport.', {
    endpoint,
    reason: lastError instanceof Error ? lastError.message : String(lastError ?? 'Unable to connect to Colyseus.')
  });
  return new NpcServiceMock();
}
