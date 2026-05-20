import server from './app.config.js';
import { logServer } from './src/logger.js';
import {
  getWorldPersistenceInfo,
  initializeWorldPersistence,
  shutdownWorldPersistence
} from './src/worldPersistence.js';
import {
  initializePlayerSnapshots,
  shutdownPlayerSnapshots
} from './src/playerSnapshots.js';
import {
  getPlayerAccountsInfo,
  initializePlayerAccounts,
  shutdownPlayerAccounts
} from './src/playerAccounts.js';
import {
  getStockMarketPersistenceInfo,
  initializeStockMarketPersistence,
  shutdownStockMarketPersistence
} from './src/stockMarketPersistence.js';

const cliPort = Number(process.argv[2]);
const port = Number.isFinite(cliPort) && cliPort > 0
  ? cliPort
  : Number(process.env.COLYSEUS_PORT || process.env.COLOSEUS_PORT || 2567);
const resolvedPort = Number(process.env.PORT || port);
await initializeWorldPersistence();
await initializeStockMarketPersistence();
await initializePlayerSnapshots();
await initializePlayerAccounts();
const persistence = getWorldPersistenceInfo();
const stockMarketPersistence = getStockMarketPersistenceInfo();
const playerAccounts = getPlayerAccountsInfo();

let shutdownPromise = null;

async function shutdown(signal, { exitCode = 0 } = {}) {
  if (!shutdownPromise) {
    logServer('server', 'Received shutdown signal. Closing server gracefully.', {
      signal,
      port: resolvedPort
    });
    shutdownPromise = server.gracefullyShutdown(false)
      .then(() => shutdownWorldPersistence())
      .then(() => shutdownStockMarketPersistence())
      .then(() => shutdownPlayerSnapshots())
      .then(() => shutdownPlayerAccounts())
      .catch((error) => {
        console.error('[server] Graceful shutdown failed.', error);
        process.exitCode = 1;
      });
  }

  await shutdownPromise;
  process.exit(process.exitCode ?? exitCode);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT', { exitCode: 0 });
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM', { exitCode: 0 });
});

await server.listen(resolvedPort);
if (typeof process.send === 'function') {
  process.send('ready');
}

logServer('server', 'Colyseus NPC server listening.', {
  port: resolvedPort,
  websocketUrl: `ws://localhost:${resolvedPort}`,
  healthUrl: `http://localhost:${resolvedPort}/health`,
  servingFrontend: true,
  persistenceMode: persistence.mode,
  worldKey: persistence.worldKey,
  stockMarketPersistenceMode: stockMarketPersistence.mode,
  playerAccountPersistenceMode: playerAccounts.mode,
  worldBackupsEnabled: Boolean(persistence.backups?.enabled),
  worldBackupIntervalMs: persistence.backups?.intervalMs ?? null,
  worldLayoutPath: persistence.runtimePath,
  worldLayoutSeedPath: persistence.seedPath,
  openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini'
});
