import process from 'node:process';
import pg from 'pg';
import { logServer, logServerError } from './logger.js';

const { Pool } = pg;
const DEFAULT_WORLD_KEY = 'primary';
const ACCOUNT_SAVE_SCHEMA_VERSION = 1;
const DEFAULT_ACCOUNT_SAVE_MAX_BYTES = 128 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACCOUNT_SAVE_TOP_LEVEL_KEYS = new Set([
  'version',
  'worldKey',
  'playerId',
  'userId',
  'updatedAt',
  'player',
  'stockPortfolio',
  'stockPortfolios'
]);
const ACCOUNT_SAVE_REQUIRED_PLAYER_KEYS = [
  'x',
  'z',
  'rotationY',
  'health',
  'money',
  'characterId'
];
const SENSITIVE_SNAPSHOT_KEY_PATTERN = /token|secret|password|authorization|cookie|credential/iu;

let playerAccountManager = null;

function getWorldKey() {
  const configuredKey = String(process.env.WORLD_KEY ?? DEFAULT_WORLD_KEY).trim();
  return configuredKey || DEFAULT_WORLD_KEY;
}

function getAccountSaveMaxBytes() {
  const value = Number(process.env.PLAYER_ACCOUNT_SAVE_MAX_BYTES);
  return Number.isFinite(value) && value >= 4096
    ? Math.floor(value)
    : DEFAULT_ACCOUNT_SAVE_MAX_BYTES;
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUserId(value = '') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : '';
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? Math.floor(timestamp) : fallback;
}

function normalizeWorldKey(value = '', fallback = getWorldKey()) {
  const normalized = String(value ?? '').trim().slice(0, 120);
  return normalized || fallback;
}

function clonePlainObject(value) {
  return isPlainObject(value) ? cloneJson(value) : {};
}

function collectSensitiveSnapshotKeyPaths(value, path = '$', output = []) {
  if (output.length >= 10 || !value || typeof value !== 'object') {
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (SENSITIVE_SNAPSHOT_KEY_PATTERN.test(key)) {
      output.push(childPath);
      if (output.length >= 10) {
        return output;
      }
    }

    if (child && typeof child === 'object') {
      collectSensitiveSnapshotKeyPaths(child, childPath, output);
      if (output.length >= 10) {
        return output;
      }
    }
  }

  return output;
}

export class AccountSaveValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AccountSaveValidationError';
    this.details = details;
  }
}

function normalizeDisplayName(authUser = {}) {
  const metadata = authUser?.userMetadata && typeof authUser.userMetadata === 'object'
    ? authUser.userMetadata
    : {};
  const candidates = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
    authUser.email ? String(authUser.email).split('@')[0] : ''
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) {
      return value.slice(0, 80);
    }
  }

  return null;
}

export function normalizeAccountSaveSnapshot(raw = {}, {
  worldKey = getWorldKey(),
  userId = '',
  now = Date.now()
} = {}) {
  const normalizedWorldKey = normalizeWorldKey(worldKey, DEFAULT_WORLD_KEY);
  const expectedUserId = normalizeUserId(userId);
  const snapshotUserId = raw?.userId == null ? expectedUserId : normalizeUserId(raw.userId);
  const expectedPlayerId = expectedUserId ? `auth:${expectedUserId}` : '';
  const snapshotPlayerId = raw?.playerId == null ? expectedPlayerId : String(raw.playerId ?? '').trim();
  const snapshotWorldKey = raw?.worldKey == null ? normalizedWorldKey : normalizeWorldKey(raw.worldKey, normalizedWorldKey);

  if (!expectedUserId) {
    throw new AccountSaveValidationError('Account save requires a valid Supabase user id.');
  }

  if (snapshotUserId !== expectedUserId) {
    throw new AccountSaveValidationError('Account save user id does not match the storage key.', {
      expectedUserId,
      snapshotUserId: snapshotUserId || null
    });
  }

  if (snapshotPlayerId !== expectedPlayerId) {
    throw new AccountSaveValidationError('Account save player id does not match the authenticated user.', {
      expectedPlayerId,
      snapshotPlayerId: snapshotPlayerId || null
    });
  }

  if (snapshotWorldKey !== normalizedWorldKey) {
    throw new AccountSaveValidationError('Account save world key does not match the storage key.', {
      expectedWorldKey: normalizedWorldKey,
      snapshotWorldKey
    });
  }

  return {
    version: ACCOUNT_SAVE_SCHEMA_VERSION,
    worldKey: normalizedWorldKey,
    playerId: expectedPlayerId,
    userId: expectedUserId,
    updatedAt: normalizeTimestamp(raw?.updatedAt, now),
    player: clonePlainObject(raw?.player),
    stockPortfolio: clonePlainObject(raw?.stockPortfolio),
    stockPortfolios: clonePlainObject(raw?.stockPortfolios)
  };
}

export function validateAccountSaveSnapshot(snapshot = {}, {
  worldKey = getWorldKey(),
  userId = '',
  maxBytes = getAccountSaveMaxBytes()
} = {}) {
  if (!isPlainObject(snapshot)) {
    throw new AccountSaveValidationError('Account save snapshot must be a JSON object.');
  }

  const expectedWorldKey = normalizeWorldKey(worldKey, DEFAULT_WORLD_KEY);
  const expectedUserId = normalizeUserId(userId);
  const unexpectedTopLevelKeys = Object.keys(snapshot).filter((key) => !ACCOUNT_SAVE_TOP_LEVEL_KEYS.has(key));
  if (unexpectedTopLevelKeys.length > 0) {
    throw new AccountSaveValidationError('Account save snapshot contains unsupported top-level keys.', {
      unexpectedTopLevelKeys
    });
  }

  if (snapshot.version !== ACCOUNT_SAVE_SCHEMA_VERSION) {
    throw new AccountSaveValidationError('Account save snapshot has an unsupported schema version.', {
      expectedVersion: ACCOUNT_SAVE_SCHEMA_VERSION,
      snapshotVersion: snapshot.version
    });
  }

  if (!expectedUserId || snapshot.userId !== expectedUserId || snapshot.playerId !== `auth:${expectedUserId}`) {
    throw new AccountSaveValidationError('Account save snapshot identity does not match the authenticated user.', {
      expectedUserId,
      snapshotUserId: snapshot.userId || null,
      snapshotPlayerId: snapshot.playerId || null
    });
  }

  if (snapshot.worldKey !== expectedWorldKey) {
    throw new AccountSaveValidationError('Account save snapshot world key does not match the current world.', {
      expectedWorldKey,
      snapshotWorldKey: snapshot.worldKey || null
    });
  }

  if (!Number.isFinite(Number(snapshot.updatedAt)) || Number(snapshot.updatedAt) < 0) {
    throw new AccountSaveValidationError('Account save snapshot updatedAt must be a positive timestamp.');
  }

  if (!isPlainObject(snapshot.player)) {
    throw new AccountSaveValidationError('Account save snapshot player payload must be a JSON object.');
  }

  const missingPlayerKeys = ACCOUNT_SAVE_REQUIRED_PLAYER_KEYS.filter((key) => !Object.hasOwn(snapshot.player, key));
  if (missingPlayerKeys.length > 0) {
    throw new AccountSaveValidationError('Account save snapshot is missing required player fields.', {
      missingPlayerKeys
    });
  }

  if (!isPlainObject(snapshot.stockPortfolio) || !isPlainObject(snapshot.stockPortfolios)) {
    throw new AccountSaveValidationError('Account save stock payloads must be JSON objects.');
  }

  const sensitiveKeyPaths = collectSensitiveSnapshotKeyPaths(snapshot);
  if (sensitiveKeyPaths.length > 0) {
    throw new AccountSaveValidationError('Account save snapshot contains secret-like keys.', {
      sensitiveKeyPaths
    });
  }

  const json = JSON.stringify(snapshot);
  const byteLength = Buffer.byteLength(json, 'utf8');
  if (byteLength > maxBytes) {
    throw new AccountSaveValidationError('Account save snapshot exceeds the configured size limit.', {
      byteLength,
      maxBytes
    });
  }

  return {
    byteLength,
    json
  };
}

class DisabledPlayerAccountStore {
  getInfo() {
    return {
      mode: 'disabled',
      worldKey: getWorldKey(),
      schemaVersion: ACCOUNT_SAVE_SCHEMA_VERSION,
      maxSaveBytes: getAccountSaveMaxBytes()
    };
  }

  async initialize() {}

  async ensureUser() {
    return null;
  }

  async loadSave() {
    return null;
  }

  async saveSave() {
    return null;
  }

  async dispose() {}
}

class PostgresPlayerAccountStore {
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
      schemaVersion: ACCOUNT_SAVE_SCHEMA_VERSION,
      maxSaveBytes: getAccountSaveMaxBytes()
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS public.player_saves (
        world_key text NOT NULL,
        user_id uuid NOT NULL REFERENCES public.game_users(id) ON DELETE CASCADE,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (world_key, user_id)
      )
    `);

    this.initialized = true;
  }

  async ensureUser(authUser = {}) {
    const userId = normalizeUserId(authUser.id);
    if (!userId) {
      return null;
    }

    await this.initialize();
    const displayName = normalizeDisplayName(authUser);
    const result = await this.pool.query(
      `
        INSERT INTO public.game_users (id, display_name, last_seen_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE
        SET display_name = COALESCE(public.game_users.display_name, EXCLUDED.display_name),
            last_seen_at = NOW()
        RETURNING id, display_name, is_admin
      `,
      [userId, displayName]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      displayName: typeof row.display_name === 'string' ? row.display_name : '',
      isAdmin: row.is_admin === true,
      userId: row.id
    };
  }

  async loadSave(userId = '') {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      return null;
    }

    await this.initialize();
    const result = await this.pool.query(
      `
        SELECT snapshot, EXTRACT(EPOCH FROM updated_at) * 1000 AS "updatedAt"
        FROM public.player_saves
        WHERE world_key = $1
          AND user_id = $2
      `,
      [this.worldKey, normalizedUserId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    try {
      const normalized = normalizeAccountSaveSnapshot({
        ...row.snapshot,
        updatedAt: Number(row.updatedAt)
      }, {
        worldKey: this.worldKey,
        userId: normalizedUserId
      });
      validateAccountSaveSnapshot(normalized, {
        worldKey: this.worldKey,
        userId: normalizedUserId
      });
      return normalized;
    } catch (error) {
      logServerError('player-accounts', 'Ignoring invalid authenticated player save.', error, {
        worldKey: this.worldKey,
        userId: normalizedUserId
      });
      return null;
    }
  }

  async saveSave(userId = '', snapshot = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      return null;
    }

    await this.initialize();
    const normalized = normalizeAccountSaveSnapshot({
      ...snapshot,
      worldKey: this.worldKey,
      userId: normalizedUserId,
      updatedAt: Date.now()
    }, {
      worldKey: this.worldKey,
      userId: normalizedUserId
    });
    const validation = validateAccountSaveSnapshot(normalized, {
      worldKey: this.worldKey,
      userId: normalizedUserId
    });

    await this.pool.query(
      `
        INSERT INTO public.player_saves (world_key, user_id, snapshot, updated_at)
        VALUES ($1, $2, $3::jsonb, to_timestamp($4 / 1000.0))
        ON CONFLICT (world_key, user_id) DO UPDATE
        SET snapshot = EXCLUDED.snapshot,
            updated_at = EXCLUDED.updated_at
      `,
      [
        this.worldKey,
        normalizedUserId,
        validation.json,
        normalized.updatedAt
      ]
    );

    return normalized;
  }

  async dispose() {
    await this.pool.end();
  }
}

class PlayerAccountManager {
  constructor(store) {
    this.store = store;
  }

  getInfo() {
    return this.store.getInfo();
  }

  async initialize() {
    await this.store.initialize();
  }

  async ensureUser(authUser) {
    return this.store.ensureUser(authUser);
  }

  async loadSave(userId) {
    return this.store.loadSave(userId);
  }

  async saveSave(userId, snapshot) {
    return this.store.saveSave(userId, snapshot);
  }

  async dispose() {
    await this.store.dispose();
  }
}

function createConfiguredStore() {
  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl) {
    return new PostgresPlayerAccountStore({
      connectionString: databaseUrl
    });
  }

  return new DisabledPlayerAccountStore();
}

export async function initializePlayerAccounts() {
  if (playerAccountManager) {
    return playerAccountManager;
  }

  const manager = new PlayerAccountManager(createConfiguredStore());
  try {
    await manager.initialize();
  } catch (error) {
    logServerError('player-accounts', 'Failed to initialize account save persistence. Authenticated saves are disabled.', error);
    playerAccountManager = new PlayerAccountManager(new DisabledPlayerAccountStore());
    return playerAccountManager;
  }

  playerAccountManager = manager;
  logServer('player-accounts', 'Initialized account save persistence.', manager.getInfo());
  return manager;
}

export function getPlayerAccounts() {
  if (!playerAccountManager) {
    throw new Error('Player accounts have not been initialized.');
  }

  return playerAccountManager;
}

export function getPlayerAccountsInfo() {
  return playerAccountManager?.getInfo() ?? {
    mode: 'uninitialized',
    worldKey: getWorldKey()
  };
}

export async function shutdownPlayerAccounts() {
  if (!playerAccountManager) {
    return;
  }

  await playerAccountManager.dispose();
  playerAccountManager = null;
}
