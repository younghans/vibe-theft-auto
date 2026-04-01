import server from './app.config.js';
import { logServer } from './src/logger.js';

const port = Number(process.env.COLYSEUS_PORT || process.env.COLOSEUS_PORT || 2567);
const resolvedPort = Number(process.env.PORT || port);

server.listen(resolvedPort);
logServer('server', 'Colyseus NPC server listening.', {
  websocketUrl: `ws://localhost:${resolvedPort}`,
  healthUrl: `http://localhost:${resolvedPort}/health`,
  openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini'
});
