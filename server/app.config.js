import './src/loadEnv.js';
import { existsSync, promises as fsp, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WorldRoom, getWorldRoomAdminDiagnostics } from './src/WorldRoom.js';
import {
  appendAgentTaskLog,
  approveAgentTaskDeploy,
  approveAgentTaskRollback,
  cancelAgentTask,
  claimNextAgentTask,
  createAgentTask,
  getAgentTask,
  getAgentTaskThread,
  listAgentTaskThreads,
  listAgentTasks,
  updateAgentTask
} from './src/agentTasks.js';
import {
  getAgentDeploymentState,
  recordAgentDeploymentState
} from './src/agentDeployments.js';
import { getWorldPersistenceInfo } from './src/worldPersistence.js';
import { getPlayerSnapshotsInfo } from './src/playerSnapshots.js';
import { getStockMarketPersistenceInfo } from './src/stockMarketPersistence.js';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');
const DIST_INDEX_PATH = path.join(DIST_ROOT, 'index.html');
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
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.wav': 'audio/wav'
};
const COMPRESSIBLE_EXTENSIONS = new Set(['.css', '.glb', '.html', '.js', '.json', '.svg', '.txt']);
const SOURCE_FILE_ALLOWLIST = new Set([
  'favicon.ico',
  'favicon.svg',
  'index.html',
  'npc-portrait-studio.html',
  'styles.css'
]);
const SOURCE_DIRECTORY_ALLOWLIST = ['animations/', 'assets/', 'src/', 'vendor/'];
const GENERATED_WORLD_MAP_IMAGE_PATH = path.join('assets', 'generated', 'world-map.webp');
const GENERATED_WORLD_MAP_METADATA_PATH = path.join('assets', 'generated', 'world-map.json');
const ADMIN_WORLD_MAP_MAX_BYTES = 14 * 1024 * 1024;

function readGitCommitSha() {
  try {
    let gitDirectory = path.join(PROJECT_ROOT, '.git');
    try {
      const gitMetadata = readFileSync(gitDirectory, 'utf8').trim();
      if (gitMetadata.startsWith('gitdir:')) {
        const gitDirPath = gitMetadata.slice(7).trim();
        gitDirectory = path.isAbsolute(gitDirPath)
          ? gitDirPath
          : path.resolve(PROJECT_ROOT, gitDirPath);
      }
    } catch {}
    const gitHeadPath = path.join(gitDirectory, 'HEAD');
    const head = readFileSync(gitHeadPath, 'utf8').trim();
    if (!head.startsWith('ref:')) {
      return head;
    }

    const refPath = head.slice(4).trim();
    return readFileSync(path.join(gitDirectory, refPath), 'utf8').trim();
  } catch {
    return '';
  }
}

function readBackendCommitSha() {
  return String(
    process.env.VTA_BUILD_COMMIT_SHA
    ?? process.env.STICKRPG_BUILD_COMMIT_SHA
    ?? process.env.COLYSEUS_GIT_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? readGitCommitSha()
    ?? ''
  ).trim();
}

const BACKEND_COMMIT_SHA = readBackendCommitSha();

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
  if (
    normalizedPath == null
    || (
      !SOURCE_FILE_ALLOWLIST.has(normalizedPath)
      && !SOURCE_DIRECTORY_ALLOWLIST.some((prefix) => normalizedPath.startsWith(prefix))
    )
  ) {
    return null;
  }

  let candidatePath = path.join(PROJECT_ROOT, normalizedPath);
  const stats = await fsp.stat(candidatePath).catch(() => null);
  if (stats?.isDirectory()) {
    return null;
  }
  if (!stats?.isFile()) {
    return null;
  }

  const sourceRelativePath = path.relative(PROJECT_ROOT, candidatePath);
  if (sourceRelativePath.startsWith('..') || path.isAbsolute(sourceRelativePath)) {
    return null;
  }

  return candidatePath;
}

function isFingerprinted(filePath) {
  if (['.mp3', '.wav'].includes(path.extname(filePath).toLowerCase())) {
    return false;
  }

  return /-[a-z0-9]{8,}\./iu.test(path.basename(filePath));
}

function getCacheControl(filePath) {
  if (path.basename(filePath).toLowerCase() === 'version.json') {
    return 'no-store, max-age=0';
  }

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

function parseAdminKeys(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function getNonNegativeIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

const AGENT_ACTIVE_TASK_STALE_AFTER_MS = getNonNegativeIntegerEnv(
  'AGENT_ACTIVE_TASK_STALE_AFTER_MS',
  4 * 60 * 1000
);

function isValidAdminKey(value = '') {
  const adminKeys = parseAdminKeys(process.env.ADMIN_KEYS ?? process.env.ADMIN_KEY ?? '');
  const normalized = typeof value === 'string' ? value.trim() : '';
  return Boolean(normalized && adminKeys.size > 0 && adminKeys.has(normalized));
}

function isValidAgentWorkerToken(value = '') {
  const workerTokens = parseAdminKeys(process.env.AGENT_WORKER_TOKENS ?? process.env.AGENT_WORKER_TOKEN ?? '');
  const normalized = typeof value === 'string' ? value.trim() : '';
  return Boolean(normalized && workerTokens.size > 0 && workerTokens.has(normalized));
}

function getAccessRuntimeDiagnostics() {
  const adminKeys = parseAdminKeys(process.env.ADMIN_KEYS ?? process.env.ADMIN_KEY ?? '');
  const workerTokens = parseAdminKeys(process.env.AGENT_WORKER_TOKENS ?? process.env.AGENT_WORKER_TOKEN ?? '');

  return {
    adminKeysConfigured: adminKeys.size > 0,
    adminKeyCount: adminKeys.size,
    adminKeyEnvNames: [
      'ADMIN_KEYS',
      'ADMIN_KEY'
    ].filter((key) => process.env[key] !== undefined),
    workerTokensConfigured: workerTokens.size > 0,
    workerTokenCount: workerTokens.size,
    workerTokenEnvNames: [
      'AGENT_WORKER_TOKENS',
      'AGENT_WORKER_TOKEN'
    ].filter((key) => process.env[key] !== undefined)
  };
}

function normalizePublicAddress(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/^wss?:\/\//iu, '')
    .replace(/^https?:\/\//iu, '')
    .replace(/\/+$/u, '');
}

const colyseusPublicAddress = normalizePublicAddress(
  process.env.COLYSEUS_PUBLIC_ADDRESS ?? process.env.VTA_PUBLIC_ADDRESS ?? process.env.STICKRPG_PUBLIC_ADDRESS ?? ''
);

function getBearerToken(req) {
  const authorization = typeof req.headers.authorization === 'string'
    ? req.headers.authorization
    : '';
  const match = authorization.match(/^Bearer\s+(.+)$/iu);
  return match?.[1]?.trim() ?? '';
}

function getAdminKeyFromRequest(req, payload = null) {
  const payloadKey = typeof payload?.adminKey === 'string' ? payload.adminKey.trim() : '';
  if (payloadKey) {
    return payloadKey;
  }

  const queryKey = typeof req.query?.adminKey === 'string' ? req.query.adminKey.trim() : '';
  if (queryKey) {
    return queryKey;
  }

  const headerKey = typeof req.headers['x-admin-key'] === 'string'
    ? req.headers['x-admin-key'].trim()
    : '';
  return headerKey;
}

function isTruthyRequestValue(value = '') {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function setAdminWorldMapCorsHeaders(req, res) {
  const origin = typeof req.headers.origin === 'string' && req.headers.origin
    ? req.headers.origin
    : '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function setAdminAgentTaskCorsHeaders(req, res) {
  const origin = typeof req.headers.origin === 'string' && req.headers.origin
    ? req.headers.origin
    : '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-admin-key,x-agent-worker-id,x-agent-worker-heartbeat');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function readJsonRequest(req, { maxBytes = ADMIN_WORLD_MAP_MAX_BYTES } = {}) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function truncateDiagnosticText(value = '', maxLength = 2000) {
  const text = String(value ?? '');
  return text.length <= maxLength
    ? text
    : `${text.slice(0, Math.max(0, maxLength - 24))}\n...[truncated]`;
}

function getErrorDiagnostic(error) {
  return {
    name: String(error?.name ?? 'Error'),
    message: truncateDiagnosticText(error?.message ?? String(error ?? ''), 1200),
    stack: truncateDiagnosticText(error?.stack ?? '', 4000),
    code: error?.code == null ? '' : String(error.code)
  };
}

function getSafePromptPayloadDiagnostic(payload = null) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    promptLength: String(payload.prompt ?? '').length,
    mode: String(payload.mode ?? ''),
    scope: String(payload.scope ?? ''),
    gameId: String(payload.gameId ?? ''),
    contextType: String(payload.contextType ?? ''),
    contextLabel: String(payload.contextLabel ?? ''),
    parentTaskId: String(payload.parentTaskId ?? ''),
    createdBy: String(payload.createdBy ?? ''),
    deployTargets: Array.isArray(payload.deployTargets) ? payload.deployTargets : []
  };
}

async function recordAdminAgentRouteFailure(req, routeLabel, error, {
  taskId = '',
  payload = null
} = {}) {
  const diagnostic = {
    route: routeLabel,
    method: req.method,
    path: req.path,
    taskId: String(taskId || req.params?.id || ''),
    workerId: typeof req.headers['x-agent-worker-id'] === 'string' ? req.headers['x-agent-worker-id'] : '',
    hasAdminKey: Boolean(getAdminKeyFromRequest(req, payload)),
    hasWorkerToken: Boolean(getBearerToken(req)),
    payload: getSafePromptPayloadDiagnostic(payload),
    error: getErrorDiagnostic(error)
  };
  console.warn(`[admin-agent] ${routeLabel} failed.`, diagnostic);
  const canWriteTaskLog = isValidAdminKey(getAdminKeyFromRequest(req, payload))
    || isValidAgentWorkerToken(getBearerToken(req));
  if (!diagnostic.taskId || !canWriteTaskLog) {
    return;
  }

  try {
    await appendAgentTaskLog(diagnostic.taskId, {
      level: 'error',
      message: `${routeLabel} failed: ${diagnostic.error.message || 'unknown error'}`,
      data: diagnostic
    });
  } catch (logError) {
    console.warn('[admin-agent] Could not append route failure to task log.', {
      taskId: diagnostic.taskId,
      error: getErrorDiagnostic(logError)
    });
  }
}

function normalizeWorldMapBounds(bounds = {}) {
  const minX = Number(bounds.minX);
  const maxX = Number(bounds.maxX);
  const minZ = Number(bounds.minZ);
  const maxZ = Number(bounds.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || maxX <= minX || maxZ <= minZ) {
    throw new Error('Invalid map bounds.');
  }

  return { minX, maxX, minZ, maxZ };
}

function normalizeWorldMapDimension(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(1, Math.min(8192, Math.round(numeric)));
}

async function writeGeneratedWorldMapFile(relativePath, contents) {
  const sourceTarget = path.join(PROJECT_ROOT, relativePath);
  await fsp.mkdir(path.dirname(sourceTarget), { recursive: true });
  await fsp.writeFile(sourceTarget, contents);
  await removeCompressedVariants(sourceTarget);

  const distStats = await fsp.stat(DIST_ROOT).catch(() => null);
  if (distStats?.isDirectory()) {
    const distTarget = path.join(DIST_ROOT, relativePath);
    await fsp.mkdir(path.dirname(distTarget), { recursive: true });
    await fsp.writeFile(distTarget, contents);
    await removeCompressedVariants(distTarget);
  }
}

async function removeCompressedVariants(filePath) {
  await Promise.all([
    fsp.rm(`${filePath}.br`, { force: true }),
    fsp.rm(`${filePath}.gz`, { force: true })
  ]);
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
  ...(colyseusPublicAddress ? { publicAddress: colyseusPublicAddress } : {}),
  transport: new WebSocketTransport({
    pingInterval: 10000
  }),
  rooms: {
    world: defineRoom(WorldRoom)
  },
  express: (app) => {
    app.get('/health', (_req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      const persistence = getWorldPersistenceInfo();
      const playerSnapshots = getPlayerSnapshotsInfo();
      const stockMarketPersistence = getStockMarketPersistenceInfo();
      res.json({
        ok: true,
        service: 'vibe-theft-auto-colyseus',
        transport: 'websocket',
        commitSha: BACKEND_COMMIT_SHA,
        buildCommitSha: BACKEND_COMMIT_SHA,
        publicAddressConfigured: Boolean(colyseusPublicAddress),
        persistenceMode: persistence.mode,
        worldKey: persistence.worldKey,
        stockMarketPersistenceMode: stockMarketPersistence.mode,
        playerSnapshotPersistenceMode: playerSnapshots.mode,
        playerSnapshotTtlMs: playerSnapshots.ttlMs,
        worldBackupsEnabled: Boolean(persistence.backups?.enabled),
        worldBackupIntervalMs: persistence.backups?.intervalMs ?? null,
        worldBackupRecentDays: persistence.backups?.recentDays ?? null,
        worldBackupMaxDailyDays: persistence.backups?.maxDailyDays ?? null,
        openAiEnabled: Boolean(process.env.OPENAI_API_KEY),
        openAiModel: process.env.OPENAI_NPC_MODEL || 'gpt-5.4-mini',
        release: 'vercel-frontend-backend-only',
        distReady: existsSync(DIST_INDEX_PATH),
        timestamp: new Date().toISOString()
      });
    });

    app.options('/admin/world-map', (req, res) => {
      setAdminWorldMapCorsHeaders(req, res);
      res.status(204).end();
    });

    app.post('/admin/world-map', async (req, res) => {
      setAdminWorldMapCorsHeaders(req, res);

      try {
        const payload = await readJsonRequest(req);
        if (!isValidAdminKey(payload?.adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const dataUrl = String(payload?.dataUrl ?? '');
        const imageMatch = dataUrl.match(/^data:image\/webp;base64,([a-z0-9+/=]+)$/iu);
        if (!imageMatch?.[1]) {
          sendJson(res, 400, { ok: false, error: 'Expected a WebP data URL.' });
          return;
        }

        const imageBuffer = Buffer.from(imageMatch[1], 'base64');
        if (imageBuffer.length <= 0 || imageBuffer.length > ADMIN_WORLD_MAP_MAX_BYTES) {
          sendJson(res, 400, { ok: false, error: 'Invalid map image size.' });
          return;
        }

        const capturedAt = new Date().toISOString();
        const persistence = getWorldPersistenceInfo();
        const metadata = {
          image: '/assets/generated/world-map.webp',
          bounds: normalizeWorldMapBounds(payload?.bounds),
          width: normalizeWorldMapDimension(payload?.width, 1024),
          height: normalizeWorldMapDimension(payload?.height, 1536),
          capturedAt,
          worldKey: persistence.worldKey ?? null
        };

        await writeGeneratedWorldMapFile(GENERATED_WORLD_MAP_IMAGE_PATH, imageBuffer);
        await writeGeneratedWorldMapFile(
          GENERATED_WORLD_MAP_METADATA_PATH,
          Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
        );

        sendJson(res, 200, {
          ok: true,
          image: metadata.image,
          metadata: `/assets/generated/${path.basename(GENERATED_WORLD_MAP_METADATA_PATH)}`,
          bytes: imageBuffer.length,
          capturedAt,
          worldKey: metadata.worldKey
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not save world map.'
        });
      }
    });

    for (const route of [
      '/admin/agent-tasks',
      '/admin/agent-tasks/next',
      '/admin/agent-tasks/:id',
      '/admin/agent-tasks/:id/thread',
      '/admin/agent-tasks/:id/followups',
      '/admin/agent-tasks/:id/logs',
      '/admin/agent-tasks/:id/cancel',
      '/admin/agent-tasks/:id/approve-deploy',
      '/admin/agent-tasks/:id/rollback',
      '/admin/runtime-diagnostics',
      '/admin/agent-deployments'
    ]) {
      app.options(route, (req, res) => {
        setAdminAgentTaskCorsHeaders(req, res);
        res.status(204).end();
      });
    }

    app.post('/admin/agent-tasks', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        payload = await readJsonRequest(req, { maxBytes: 128 * 1024 });
        const adminKey = getAdminKeyFromRequest(req, payload);
        if (!isValidAdminKey(adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const task = await createAgentTask(payload, {
          createdBy: String(payload?.createdBy ?? 'in-game-admin'),
          staleActiveAfterMs: AGENT_ACTIVE_TASK_STALE_AFTER_MS
        });
        sendJson(res, 201, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Queue agent task', error, { payload });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not queue agent task.'
        });
      }
    });

    app.get('/admin/agent-tasks', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        if (!isValidAdminKey(getAdminKeyFromRequest(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const listThreads = String(req.query?.view ?? '').trim().toLowerCase() === 'threads'
          || isTruthyRequestValue(req.query?.threads);
        const compact = isTruthyRequestValue(req.query?.compact);
        const readOnly = isTruthyRequestValue(req.query?.readOnly) || compact || listThreads;
        const taskListOptions = {
          scope: typeof req.query?.scope === 'string' ? req.query.scope : '',
          gameId: typeof req.query?.gameId === 'string' ? req.query.gameId : '',
          limit: typeof req.query?.limit === 'string' ? Number(req.query.limit) : 25,
          staleActiveAfterMs: readOnly ? 0 : AGENT_ACTIVE_TASK_STALE_AFTER_MS
        };
        const tasks = listThreads
          ? await listAgentTaskThreads({
            ...taskListOptions,
            limit: typeof req.query?.limit === 'string' ? Number(req.query.limit) : 10,
            compact
          })
          : await listAgentTasks(taskListOptions);
        sendJson(res, 200, { ok: true, tasks, view: listThreads ? 'threads' : 'tasks' });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'List agent tasks', error);
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not list agent tasks.'
        });
      }
    });

    app.post('/admin/agent-tasks/:id/followups', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        payload = await readJsonRequest(req, { maxBytes: 128 * 1024 });
        const adminKey = getAdminKeyFromRequest(req, payload);
        if (!isValidAdminKey(adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const task = await createAgentTask({
          ...payload,
          parentTaskId: req.params.id
        }, {
          createdBy: String(payload?.createdBy ?? 'in-game-admin'),
          staleActiveAfterMs: AGENT_ACTIVE_TASK_STALE_AFTER_MS
        });
        sendJson(res, 201, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Queue follow-up task', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not queue follow-up task.'
        });
      }
    });

    app.get('/admin/agent-tasks/next', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        if (!isValidAgentWorkerToken(getBearerToken(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid worker token.' });
          return;
        }

        const result = await claimNextAgentTask({
          scope: typeof req.query?.scope === 'string' ? req.query.scope : '',
          deployEnabled: ['1', 'true', 'yes'].includes(String(req.query?.deployEnabled ?? '').toLowerCase()),
          codeEnabled: !['0', 'false', 'no'].includes(String(req.query?.codeEnabled ?? 'true').toLowerCase()),
          staleDeployingAfterMs: typeof req.query?.staleDeployingAfterMs === 'string'
            ? Number(req.query.staleDeployingAfterMs)
            : 0,
          staleActiveAfterMs: typeof req.query?.staleActiveAfterMs === 'string'
            ? Number(req.query.staleActiveAfterMs)
            : AGENT_ACTIVE_TASK_STALE_AFTER_MS,
          workerHeartbeatEnabled: isTruthyRequestValue(req.headers['x-agent-worker-heartbeat']),
          workerId: typeof req.headers['x-agent-worker-id'] === 'string'
            ? req.headers['x-agent-worker-id']
            : ''
        });
        sendJson(res, 200, {
          ok: true,
          action: result.action,
          task: result.task
        });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Claim next agent task', error);
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not claim agent task.'
        });
      }
    });

    app.get('/admin/agent-tasks/:id/thread', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        const isAuthorized = isValidAdminKey(getAdminKeyFromRequest(req))
          || isValidAgentWorkerToken(getBearerToken(req));
        if (!isAuthorized) {
          sendJson(res, 403, { ok: false, error: 'Invalid credentials.' });
          return;
        }

        const compact = isTruthyRequestValue(req.query?.compact);
        const readOnly = isTruthyRequestValue(req.query?.readOnly) || compact;
        const tasks = await getAgentTaskThread(req.params.id, {
          compact,
          staleActiveAfterMs: readOnly ? 0 : AGENT_ACTIVE_TASK_STALE_AFTER_MS
        });
        if (!tasks.length) {
          sendJson(res, 404, { ok: false, error: 'Task thread not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, tasks, threadTasks: tasks });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Read agent task thread', error, {
          taskId: req.params.id
        });
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not read agent task thread.'
        });
      }
    });

    app.get('/admin/agent-tasks/:id', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        const isAuthorized = isValidAdminKey(getAdminKeyFromRequest(req))
          || isValidAgentWorkerToken(getBearerToken(req));
        if (!isAuthorized) {
          sendJson(res, 403, { ok: false, error: 'Invalid credentials.' });
          return;
        }

        const task = await getAgentTask(req.params.id, {
          staleActiveAfterMs: AGENT_ACTIVE_TASK_STALE_AFTER_MS
        });
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Read agent task', error, {
          taskId: req.params.id
        });
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not read agent task.'
        });
      }
    });

    app.patch('/admin/agent-tasks/:id', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        if (!isValidAgentWorkerToken(getBearerToken(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid worker token.' });
          return;
        }

        payload = await readJsonRequest(req, { maxBytes: 128 * 1024 });
        const task = await updateAgentTask(req.params.id, payload);
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Update agent task', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not update agent task.'
        });
      }
    });

    app.post('/admin/agent-tasks/:id/logs', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        if (!isValidAgentWorkerToken(getBearerToken(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid worker token.' });
          return;
        }

        payload = await readJsonRequest(req, { maxBytes: 128 * 1024 });
        const task = await appendAgentTaskLog(req.params.id, payload);
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Append agent task log', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not append agent task log.'
        });
      }
    });

    app.post('/admin/agent-tasks/:id/cancel', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        payload = await readJsonRequest(req, { maxBytes: 16 * 1024 });
        const adminKey = getAdminKeyFromRequest(req, payload);
        if (!isValidAdminKey(adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const task = await cancelAgentTask(req.params.id, {
          cancelledBy: String(payload?.createdBy ?? 'in-game-admin')
        });
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Cancel agent task', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not cancel agent task.'
        });
      }
    });

    app.post('/admin/agent-tasks/:id/approve-deploy', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        payload = await readJsonRequest(req, { maxBytes: 16 * 1024 });
        const adminKey = getAdminKeyFromRequest(req, payload);
        if (!isValidAdminKey(adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const task = await approveAgentTaskDeploy(req.params.id, {
          approvedBy: String(payload?.createdBy ?? 'in-game-admin')
        });
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Approve deploy', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not approve deploy.'
        });
      }
    });

    app.post('/admin/agent-tasks/:id/rollback', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        payload = await readJsonRequest(req, { maxBytes: 16 * 1024 });
        const adminKey = getAdminKeyFromRequest(req, payload);
        if (!isValidAdminKey(adminKey)) {
          sendJson(res, 403, { ok: false, error: 'Invalid admin key.' });
          return;
        }

        const task = await approveAgentTaskRollback(req.params.id, {
          approvedBy: String(payload?.createdBy ?? 'in-game-admin')
        });
        if (!task) {
          sendJson(res, 404, { ok: false, error: 'Task not found.' });
          return;
        }

        sendJson(res, 200, { ok: true, task });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Approve rollback', error, {
          taskId: req.params.id,
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not approve rollback.'
        });
      }
    });

    app.get('/admin/runtime-diagnostics', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        if (!isValidAgentWorkerToken(getBearerToken(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid worker token.' });
          return;
        }

        sendJson(res, 200, {
          ok: true,
          access: getAccessRuntimeDiagnostics(),
          worldRoomAccess: getWorldRoomAdminDiagnostics(),
          commitSha: BACKEND_COMMIT_SHA,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not read runtime diagnostics.'
        });
      }
    });

    app.get('/admin/agent-deployments', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      try {
        const isAuthorized = isValidAdminKey(getAdminKeyFromRequest(req))
          || isValidAgentWorkerToken(getBearerToken(req));
        if (!isAuthorized) {
          sendJson(res, 403, { ok: false, error: 'Invalid credentials.' });
          return;
        }

        const deployment = await getAgentDeploymentState();
        sendJson(res, 200, { ok: true, deployment });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Read agent deployment state', error);
        sendJson(res, 500, {
          ok: false,
          error: error?.message || 'Could not read agent deployment state.'
        });
      }
    });

    app.patch('/admin/agent-deployments', async (req, res) => {
      setAdminAgentTaskCorsHeaders(req, res);

      let payload = null;
      try {
        if (!isValidAgentWorkerToken(getBearerToken(req))) {
          sendJson(res, 403, { ok: false, error: 'Invalid worker token.' });
          return;
        }

        payload = await readJsonRequest(req, { maxBytes: 64 * 1024 });
        const deployment = await recordAgentDeploymentState(payload);
        sendJson(res, 200, { ok: true, deployment });
      } catch (error) {
        await recordAdminAgentRouteFailure(req, 'Update agent deployment state', error, {
          payload
        });
        sendJson(res, 400, {
          ok: false,
          error: error?.message || 'Could not update agent deployment state.'
        });
      }
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
            const sourceIndexPath = await resolveSourceAssetPath('index.html');
            if (sourceIndexPath) {
              await sendDistAsset(req, res, sourceIndexPath);
              return;
            }

            res.status(503).json({
              ok: false,
              error: 'Frontend build artifacts are missing. Run `npm run build` before starting the server.'
            });
            return;
          }

          await sendDistAsset(req, res, DIST_INDEX_PATH);
          return;
        }

        res.setHeader('Cache-Control', 'no-store');
        next();
      } catch (error) {
        next(error);
      }
    });
  }
});

export default server;
