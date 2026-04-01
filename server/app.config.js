import './src/loadEnv.js';
import { defineRoom, defineServer } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom } from './src/WorldRoom.js';

const server = defineServer({
  transport: new WebSocketTransport({
    pingInterval: 10000
  }),
  rooms: {
    world: defineRoom(WorldRoom)
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      res.json({
        ok: true,
        service: 'stickrpg-colyseus',
        transport: 'websocket',
        openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
        openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini',
        timestamp: new Date().toISOString()
      });
    });
  }
});

export default server;
