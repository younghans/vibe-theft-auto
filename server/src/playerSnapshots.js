import { promises as fsp } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { logServer, logServerError } from './logger.js';

const { Pool } = pg;

const DEFAULT_PLAYER_SNAPSHOTS_PATH = new URL('../data/player-snapshots.json', import.meta.url);
const DEFAULT_WORLD_KEY = 'primary';
const DEFAULT_PLAYER_SNAPSHOT_TTL_MS = 30 * 60 * 1000;
const PLAYER_SNAPSHOT_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const PLAYER_ID_MAX_LENGTH = 96;

let playerSnapshotManager = null;

function getWorldKey() {
  const configuredKey = String(process.env.WORLD_KEY ?? DEFAULT_WORLD_KEY).trim();
  return configuredKey || DEFAULT_WORLD_KEY;
}

function getPlayerSnapshotTtlMs() {
  const value = Number(process.env.PLAYER_SNAPSHOT_TTL_MS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_PLAYER_SNAPSHOT_TTL_MS;
}

function getDatabaseSslConfig(connectionString) {
  try {
    const sslMode = new URL(connectionString).searchParams.get('sslmode')?.trim().toLowerCase();
    if (!sslMode || sslMode === 'disable') {
      return null;
    }

    if (sslMode === 'no-verify' || sslMode === 'require') {
      return { rejectUnauthorized: false };
    }
  } catch {
    return null;
  }

  return null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function normalizePlayerSnapshotId(value = '') {
  return String(value ?? '')
    .trim()
    .replace(/[^a-z0-9._:-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, PLAYER_ID_MAX_LENGTH);
}

function normalizeTimestamp(value, fallback = 0) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
}

function normalizeSnapshot(raw = {}, {
  worldKey = getWorldKey(),
  playerId = ''
} = {}) {
  const now = Date.now();
  const normalizedPlayerId = normalizePlayerSnapshotId(raw.playerId ?? playerId);
  const updatedAt = normalizeTimestamp(raw.updatedAt, now);
  const expiresAt = normalizeTimestamp(raw.expiresAt, updatedAt + getPlayerSnapshotTtlMs());
  return {
    version: 1,
    worldKey: String(raw.worldKey ?? worldKey),
    playerId: normalizedPlayerId,
    updatedAt,
    expiresAt,
    player: raw.player && typeof raw.player === 'object' ? cloneJson(raw.player) : {},
    stockPortfolio: raw.stockPortfolio && typeof raw.stockPortfolio === 'object' ? cloneJson(raw.stockPortfolio) : {}
  };
}

function isSnapshotFresh(snapshot, now = Date.now()) {
  return Boolean(snapshot?.playerId && normalizeTimestamp(snapshot.expiresAt) > now);
}

async function readSnapshotFile(filePath) {
  const text = await fsp.readFile(filePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  });

  if (!text.trim()) {
    return { version: 1, snapshots: [] };
  }

  const parsed = JSON.parse(text);
  return {
    version: 1,
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : []
  };
}

async function writeSnapshotFile(filePath, state) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tempPath, `${JSON.stringify({
    version: 1,
    snapshots: Array.isArray(state.snapshots) ? state.snapshots : []
  }, null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, filePath);
}

class FilePlayerSnapshotStore {
  constructor({
    filePath = fileURLToPath(DEFAULT_PLAYER_SNAPSHOTS_PATH),
    worldKey = getWorldKey()
  } = {}) {
    this.filePath = filePath;
    this.worldKey = worldKey;
    this.queue = Promise.resolve();
  }

  getInfo() {
    return {
      mode: 'file',
      worldKey: this.worldKey,
      path: this.filePath,
      ttlMs: getPlayerSnapshotTtlMs()
    };
  }

  async initialize() {
    await this.pruneExpired();
  }

  withStore(mutator, { write = true } = {}) {
    const operation = this.queue.then(async () => {
      const state = await readSnapshotFile(this.filePath);
      const result = await mutator(state);
      if (write) {
        await writeSnapshotFile(this.filePath, state);
      }
      return cloneJson(result);
    });

    this.queue = operation.catch(() => {});
    return operation;
  }

  async load(playerId) {
    const normalizedPlayerId = normalizePlayerSnapshotId(playerId);
    if (!normalizedPlayerId) {
      return null;
    }

    return this.withStore((state) => {
      const snapshot = state.snapshots
        .map((entry) => normalizeSnapshot(entry, { worldKey: this.worldKey }))
        .find((entry) => entry.worldKey === this.worldKey && entry.playerId === normalizedPlayerId);
      return isSnapshotFresh(snapshot) ? snapshot : null;
    }, { write: false });
  }

  async save(playerId, snapshot = {}) {
    const normalizedPlayerId = normalizePlayerSnapshotId(playerId);
    if (!normalizedPlayerId) {
      return null;
    }

    return this.withStore((state) => {
      const normalized = normalizeSnapshot({
        ...snapshot,
        worldKey: this.worldKey,
        playerId: normalizedPlayerId,
        updatedAt: Date.now(),
        expiresAt: Date.now() + getPlayerSnapshotTtlMs()
      }, {
        worldKey: this.worldKey,
        playerId: normalizedPlayerId
      });

      state.snapshots = [
        ...state.snapshots.filter((entry) => {
          const current = normalizeSnapshot(entry, { worldKey: this.worldKey });
          return current.worldKey !== this.worldKey || current.playerId !== normalizedPlayerId;
        }),
        normalized
      ].filter(isSnapshotFresh);

      return normalized;
    });
  }

  async pruneExpired() {
    return this.withStore((state) => {
      const before = state.snapshots.length;
      state.snapshots = state.snapshots
        .map((entry) => normalizeSnapshot(entry, { worldKey: this.worldKey }))
        .filter(isSnapshotFresh);
      return { pruned: before - state.snapshots.length };
    });
  }

  async dispose() {}
}

class PostgresPlayerSnapshotStore {
  constructor({
    connectionString,
    worldKey = getWorldKey()
  }) {
    this.worldKey = worldKey;
    this.pool = new Pool({
      connectionString,
      ssl: getDatabaseSslConfig(connectionString) ?? undefined
    });
    this.initialized = false;
  }

  getInfo() {
    return {
      mode: 'postgres',
      worldKey: this.worldKey,
      path: null,
      ttlMs: getPlayerSnapshotTtlMs()
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS player_snapshots (
        world_key text NOT NULL,
        player_id text NOT NULL,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        expires_at timestamptz NOT NULL,
        PRIMARY KEY (world_key, player_id)
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS player_snapshots_expires_at_idx
      ON player_snapshots (expires_at)
    `);

    this.initialized = true;
    await this.pruneExpired();
  }

  async load(playerId) {
    const normalizedPlayerId = normalizePlayerSnapshotId(playerId);
    if (!normalizedPlayerId) {
      return null;
    }

    await this.initialize();
    const result = await this.pool.query(
      `
        SELECT snapshot, EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt",
               EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
        FROM player_snapshots
        WHERE world_key = $1
          AND player_id = $2
          AND expires_at > NOW()
      `,
      [this.worldKey, normalizedPlayerId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return normalizeSnapshot({
      ...row.snapshot,
      updatedAt: Number(row.updatedAt),
      expiresAt: Number(row.expiresAt)
    }, {
      worldKey: this.worldKey,
      playerId: normalizedPlayerId
    });
  }

  async save(playerId, snapshot = {}) {
    const normalizedPlayerId = normalizePlayerSnapshotId(playerId);
    if (!normalizedPlayerId) {
      return null;
    }

    await this.initialize();
    const now = Date.now();
    const normalized = normalizeSnapshot({
      ...snapshot,
      worldKey: this.worldKey,
      playerId: normalizedPlayerId,
      updatedAt: now,
      expiresAt: now + getPlayerSnapshotTtlMs()
    }, {
      worldKey: this.worldKey,
      playerId: normalizedPlayerId
    });

    await this.pool.query(
      `
        INSERT INTO player_snapshots (world_key, player_id, snapshot, updated_at, expires_at)
        VALUES ($1, $2, $3::jsonb, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
        ON CONFLICT (world_key, player_id) DO UPDATE
        SET snapshot = EXCLUDED.snapshot,
            updated_at = EXCLUDED.updated_at,
            expires_at = EXCLUDED.expires_at
      `,
      [
        this.worldKey,
        normalizedPlayerId,
        JSON.stringify(normalized),
        normalized.updatedAt,
        normalized.expiresAt
      ]
    );

    return normalized;
  }

  async pruneExpired() {
    await this.pool.query(
      'DELETE FROM player_snapshots WHERE expires_at <= NOW()'
    );
  }

  async dispose() {
    await this.pool.end();
  }
}

class PlayerSnapshotManager {
  constructor(store) {
    this.store = store;
    this.pruneTimer = null;
  }

  getInfo() {
    return this.store.getInfo();
  }

  async initialize() {
    await this.store.initialize();
    this.pruneTimer = setInterval(() => {
      void this.store.pruneExpired().catch((error) => {
        logServerError('player-snapshots', 'Failed to prune expired player snapshots.', error);
      });
    }, PLAYER_SNAPSHOT_PRUNE_INTERVAL_MS);
    this.pruneTimer.unref?.();
  }

  async load(playerId) {
    return this.store.load(playerId);
  }

  async save(playerId, snapshot) {
    return this.store.save(playerId, snapshot);
  }

  async dispose() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    await this.store.dispose();
  }
}

function createConfiguredStore() {
  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl) {
    return new PostgresPlayerSnapshotStore({
      connectionString: databaseUrl
    });
  }

  return new FilePlayerSnapshotStore();
}

export async function initializePlayerSnapshots() {
  if (playerSnapshotManager) {
    return playerSnapshotManager;
  }

  const manager = new PlayerSnapshotManager(createConfiguredStore());
  await manager.initialize();
  playerSnapshotManager = manager;
  logServer('player-snapshots', 'Initialized player snapshot persistence.', manager.getInfo());
  return manager;
}

export function getPlayerSnapshots() {
  if (!playerSnapshotManager) {
    throw new Error('Player snapshots have not been initialized.');
  }

  return playerSnapshotManager;
}

export async function shutdownPlayerSnapshots() {
  if (!playerSnapshotManager) {
    return;
  }

  const manager = playerSnapshotManager;
  playerSnapshotManager = null;
  await manager.dispose();
}
