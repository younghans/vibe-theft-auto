import { NpcServiceColyseus } from './NpcServiceColyseus.js';
import { NpcServiceMock } from './NpcServiceMock.js';

export async function createNpcService({ endpoint = 'ws://localhost:2567' } = {}) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('npcTransport') === 'mock') {
    console.info('[NPC] Using local mock transport because ?npcTransport=mock is set.');
    return new NpcServiceMock();
  }

  const service = new NpcServiceColyseus({ endpoint });
  try {
    await Promise.race([
      service.connect(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('Timed out connecting to Colyseus.')), 1500))
    ]);
    console.info(`[NPC] Connected to Colyseus transport at ${endpoint}.`);
    return service;
  } catch (error) {
    console.warn('[NPC] Falling back to local mock transport.', {
      endpoint,
      reason: error instanceof Error ? error.message : String(error)
    });
    await service.destroy();
    return new NpcServiceMock();
  }
}
