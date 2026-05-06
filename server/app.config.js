import './src/loadEnv.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineRoom, defineServer } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom } from './src/WorldRoom.js';
import { getWorldPersistenceInfo } from './src/worldPersistence.js';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_ROOT, 'index.html');
const ASSETS_ROOT = path.join(PROJECT_ROOT, 'assets');
const MIME_TYPES = {
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav'
};
const COMPRESSIBLE_EXTENSIONS = new Set(['.css', '.glb', '.html', '.js', '.json', '.svg', '.txt']);

function normalizeAssetPath(requestPath = '/') {
  let decodedPath = String(requestPath);
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch {
    return null;
  }

  const withoutLeadingSlash = decodedPath.replace(/^\/+/, '');
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

async function resolveSourceAssetPath(requestPath) {
  const normalizedPath = normalizeAssetPath(requestPath);
  if (normalizedPath == null || (!normalizedPath.startsWith('assets/') && normalizedPath !== 'assets')) {
    return null;
  }

  const relativeAssetPath = normalizedPath === 'assets'
    ? ''
    : normalizedPath.slice('assets/'.length);
  let candidatePath = path.join(ASSETS_ROOT, relativeAssetPath);
  const stats = await fsp.stat(candidatePath).catch(() => null);
  if (stats?.isDirectory()) {
    return null;
  }
  if (!stats?.isFile()) {
    return null;
  }

  const assetRelativePath = path.relative(ASSETS_ROOT, candidatePath);
  if (assetRelativePath.startsWith('..') || path.isAbsolute(assetRelativePath)) {
    return null;
  }

  return candidatePath;
}

function isFingerprinted(filePath) {
  return /-[a-z0-9]{8,}\./iu.test(path.basename(filePath));
}

function getCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') {
    return 'no-cache';
  }

  if (isFingerprinted(filePath)) {
    return 'public, max-age=31536000, immutable';
  }

  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return 'public, max-age=86400';
  }

  return 'public, max-age=3600';
}

async function resolveCompressedVariant(filePath, acceptEncoding = '') {
  const extension = path.extname(filePath).toLowerCase();
  if (!COMPRESSIBLE_EXTENSIONS.has(extension)) {
    return { path: filePath, encoding: null };
  }

  if (/\bbr\b/u.test(acceptEncoding)) {
    const brotliPath = `${filePath}.br`;
    if (await fsp.stat(brotliPath).catch(() => null)) {
      return { path: brotliPath, encoding: 'br' };
    }
  }

  if (/\bgzip\b/u.test(acceptEncoding)) {
    const gzipPath = `${filePath}.gz`;
    if (await fsp.stat(gzipPath).catch(() => null)) {
      return { path: gzipPath, encoding: 'gzip' };
    }
  }

  return { path: filePath, encoding: null };
}

async function sendDistAsset(req, res, filePath) {
  const variant = await resolveCompressedVariant(filePath, req.headers['accept-encoding'] ?? '');
  res.setHeader('Cache-Control', getCacheControl(filePath));
  res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream');
  res.setHeader('Vary', 'Accept-Encoding');
  if (variant.encoding) {
    res.setHeader('Content-Encoding', variant.encoding);
  }
  res.sendFile(variant.path);
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
      const persistence = getWorldPersistenceInfo();
      res.json({
        ok: true,
        service: 'stickrpg-colyseus',
        transport: 'websocket',
        persistenceMode: persistence.mode,
        worldKey: persistence.worldKey,
        openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
        openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini',
        timestamp: new Date().toISOString()
      });
    });

    app.get(/.*/, async (req, res, next) => {
      try {
        const assetPath = await resolveDistAssetPath(req.path);
        if (assetPath) {
          await sendDistAsset(req, res, assetPath);
          return;
        }

        const sourceAssetPath = await resolveSourceAssetPath(req.path);
        if (sourceAssetPath) {
          await sendDistAsset(req, res, sourceAssetPath);
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

          await sendDistAsset(req, res, DIST_INDEX_PATH);
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
