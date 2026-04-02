import './src/loadEnv.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineRoom, defineServer } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom } from './src/WorldRoom.js';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_ROOT, 'index.html');

function normalizeAssetPath(requestPath = '/') {
  const withoutLeadingSlash = String(requestPath).replace(/^\/+/, '');
  const normalized = path.posix.normalize(withoutLeadingSlash || '.');
  if (normalized === '..' || normalized.startsWith('../')) {
    return null;
  }

  return normalized === '.' ? '' : normalized;
}

async function resolveDistAssetPath(requestPath) {
  const normalizedPath = normalizeAssetPath(requestPath);
  if (normalizedPath == null) {
    return null;
  }

  let candidatePath = path.join(DIST_ROOT, normalizedPath);
  const stats = await fsp.stat(candidatePath).catch(() => null);
  if (stats?.isDirectory()) {
    candidatePath = path.join(candidatePath, 'index.html');
  } else if (!stats?.isFile()) {
    return null;
  }

  const distRelativePath = path.relative(DIST_ROOT, candidatePath);
  if (distRelativePath.startsWith('..') || path.isAbsolute(distRelativePath)) {
    return null;
  }

  return candidatePath;
}

const server = defineServer({
  gracefullyShutdown: false,
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

    app.get(/.*/, async (req, res, next) => {
      try {
        const assetPath = await resolveDistAssetPath(req.path);
        if (assetPath) {
          res.sendFile(assetPath);
          return;
        }

        if (!path.posix.extname(req.path || '')) {
          const indexStats = await fsp.stat(DIST_INDEX_PATH).catch(() => null);
          if (!indexStats?.isFile()) {
            res.status(503).json({
              ok: false,
              error: 'Frontend build artifacts are missing. Run `npm run build` before starting the server.'
            });
            return;
          }

          res.sendFile(DIST_INDEX_PATH);
          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    });
  }
});

export default server;
