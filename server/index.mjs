import server from './app.config.js';
import { logServer } from './src/logger.js';

const port = Number(process.env.COLOSEUS_PORT || 2567);

server.listen(port);
logServer('server', 'Colyseus NPC server listening.', {
  websocketUrl: `ws://localhost:${port}`,
  healthUrl: `http://localhost:${port}/health`,
  openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini'
});
