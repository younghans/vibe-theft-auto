import server from './app.config.js';
import { logServer } from './src/logger.js';

const port = Number(process.env.COLYSEUS_PORT || process.env.COLOSEUS_PORT || 2567);
const resolvedPort = Number(process.env.PORT || port);

let shutdownPromise = null;

async function shutdown(signal, { exitCode = 0 } = {}) {
  if (!shutdownPromise) {
    logServer('server', 'Received shutdown signal. Closing server gracefully.', {
      signal,
      port: resolvedPort
    });
    shutdownPromise = server.gracefullyShutdown(false).catch((error) => {
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
logServer('server', 'Colyseus NPC server listening.', {
  port: resolvedPort,
  websocketUrl: `ws://localhost:${resolvedPort}`,
  healthUrl: `http://localhost:${resolvedPort}/health`,
  servingFrontend: true,
  worldLayoutPath: process.env.WORLD_LAYOUT_PATH || 'server/data/world-layout.json',
  worldLayoutSeedPath: process.env.WORLD_LAYOUT_SEED_PATH || 'server/data/world-layout.json',
  openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini'
});
