import process from 'node:process';
import pg from 'pg';
import { logServer, logServerError } from './logger.js';

const { Pool } = pg;
const DEFAULT_WORLD_KEY = 'primary';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

let playerAccountManager = null;

function getWorldKey() {
  const configuredKey = String(process.env.WORLD_KEY ?? DEFAULT_WORLD_KEY).trim();
  return configuredKey || DEFAULT_WORLD_KEY;
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

function normalizeUserId(value = '') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : '';
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

function normalizeSnapshot(raw = {}, { worldKey = getWorldKey(), userId = '' } = {}) {
  return {
    version: 1,
    worldKey: String(raw?.worldKey ?? worldKey),
    playerId: `auth:${normalizeUserId(raw?.userId ?? userId)}`,
    userId: normalizeUserId(raw?.userId ?? userId),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
    player: raw?.player && typeof raw.player === 'object' ? cloneJson(raw.player) : {},
    stockPortfolio: raw?.stockPortfolio && typeof raw.stockPortfolio === 'object' ? cloneJson(raw.stockPortfolio) : {},
    stockPortfolios: raw?.stockPortfolios && typeof raw.stockPortfolios === 'object' ? cloneJson(raw.stockPortfolios) : {}
  };
}

class DisabledPlayerAccountStore {
  getInfo() {
    return {
      mode: 'disabled',
      worldKey: getWorldKey()
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
      worldKey: this.worldKey
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

    return normalizeSnapshot({
      ...row.snapshot,
      updatedAt: Number(row.updatedAt),
      userId: normalizedUserId
    }, {
      worldKey: this.worldKey,
      userId: normalizedUserId
    });
  }

  async saveSave(userId = '', snapshot = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) {
      return null;
    }

    await this.initialize();
    const normalized = normalizeSnapshot({
      ...snapshot,
      worldKey: this.worldKey,
      userId: normalizedUserId,
      updatedAt: Date.now()
    }, {
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
        JSON.stringify(normalized),
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
