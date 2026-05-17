import { promises as fsp } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  createInitialStockMarketState,
  normalizeStockMarketSnapshot
} from '../../src/shared/stockMarket.js';
import { logServer } from './logger.js';

const { Pool } = pg;

const DEFAULT_STOCK_MARKET_PATH = new URL('../data/stock-market.json', import.meta.url);
const DEFAULT_WORLD_KEY = 'primary';

let stockMarketPersistenceManager = null;

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

function normalizeMarketRecord(raw = {}, {
  worldKey = getWorldKey(),
  now = Date.now()
} = {}) {
  const normalizedWorldKey = String(raw.worldKey ?? worldKey);
  const market = normalizeStockMarketSnapshot(raw.market ?? raw.snapshot ?? raw, now)
    ?? createInitialStockMarketState(now);
  const rawUpdatedAt = Number(raw.updatedAt ?? now);
  const updatedAt = Number.isFinite(rawUpdatedAt) && rawUpdatedAt >= 0
    ? Math.floor(rawUpdatedAt)
    : now;

  return {
    version: 1,
    worldKey: normalizedWorldKey,
    updatedAt,
    market
  };
}

async function readMarketFile(filePath) {
  const text = await fsp.readFile(filePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  });

  if (!text.trim()) {
    return { version: 1, markets: [] };
  }

  const parsed = JSON.parse(text);
  return {
    version: 1,
    markets: Array.isArray(parsed.markets)
      ? parsed.markets
      : parsed.market
        ? [parsed]
        : []
  };
}

async function writeMarketFile(filePath, state) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tempPath, `${JSON.stringify({
    version: 1,
    markets: Array.isArray(state.markets) ? state.markets : []
  }, null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, filePath);
}

class FileStockMarketStore {
  constructor({
    filePath = fileURLToPath(DEFAULT_STOCK_MARKET_PATH),
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
      path: this.filePath
    };
  }

  async initialize() {}

  withStore(mutator, { write = true } = {}) {
    const operation = this.queue.then(async () => {
      const state = await readMarketFile(this.filePath);
      const result = await mutator(state);
      if (write) {
        await writeMarketFile(this.filePath, state);
      }
      return cloneJson(result);
    });

    this.queue = operation.catch(() => {});
    return operation;
  }

  async load() {
    return this.withStore((state) => {
      const record = state.markets
        .map((entry) => normalizeMarketRecord(entry, { worldKey: this.worldKey }))
        .find((entry) => entry.worldKey === this.worldKey);
      return record?.market ?? null;
    }, { write: false });
  }

  async save(market) {
    const normalized = normalizeMarketRecord({
      worldKey: this.worldKey,
      updatedAt: Date.now(),
      market
    }, { worldKey: this.worldKey });

    return this.withStore((state) => {
      state.markets = [
        ...state.markets.filter((entry) => {
          const current = normalizeMarketRecord(entry, { worldKey: this.worldKey });
          return current.worldKey !== this.worldKey;
        }),
        normalized
      ];
      return normalized.market;
    });
  }

  async dispose() {}
}

class PostgresStockMarketStore {
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
      path: null
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS stock_market_snapshots (
        world_key text PRIMARY KEY,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    this.initialized = true;
  }

  async load() {
    await this.initialize();
    const result = await this.pool.query(
      'SELECT snapshot FROM stock_market_snapshots WHERE world_key = $1',
      [this.worldKey]
    );
    return normalizeStockMarketSnapshot(result.rows[0]?.snapshot) ?? null;
  }

  async save(market) {
    await this.initialize();
    const normalizedMarket = normalizeStockMarketSnapshot(market) ?? createInitialStockMarketState(Date.now());
    await this.pool.query(
      `
        INSERT INTO stock_market_snapshots (world_key, snapshot, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (world_key) DO UPDATE
        SET snapshot = EXCLUDED.snapshot,
            updated_at = NOW()
      `,
      [this.worldKey, JSON.stringify(normalizedMarket)]
    );

    return normalizedMarket;
  }

  async dispose() {
    await this.pool.end();
  }
}

class StockMarketPersistenceManager {
  constructor(store, initialMarket) {
    this.store = store;
    this.initialMarket = normalizeStockMarketSnapshot(initialMarket) ?? createInitialStockMarketState(Date.now());
    this.pendingMarket = null;
    this.savePromise = null;
  }

  getInfo() {
    return this.store.getInfo();
  }

  getInitialMarket(now = Date.now()) {
    return normalizeStockMarketSnapshot(this.initialMarket, now) ?? createInitialStockMarketState(now);
  }

  async save(market) {
    const normalizedMarket = normalizeStockMarketSnapshot(market) ?? createInitialStockMarketState(Date.now());
    this.pendingMarket = normalizedMarket;
    if (!this.savePromise) {
      this.savePromise = this.flushPendingSave();
    }

    return this.savePromise;
  }

  async flushPendingSave() {
    try {
      while (this.pendingMarket) {
        const market = this.pendingMarket;
        this.pendingMarket = null;
        this.initialMarket = await this.store.save(market);
      }
      return this.initialMarket;
    } finally {
      this.savePromise = null;
      if (this.pendingMarket) {
        this.savePromise = this.flushPendingSave();
      }
    }
  }

  async dispose() {
    if (this.savePromise) {
      await this.savePromise;
    }
    await this.store.dispose();
  }
}

function createConfiguredStore() {
  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl) {
    return new PostgresStockMarketStore({
      connectionString: databaseUrl
    });
  }

  return new FileStockMarketStore();
}

export async function initializeStockMarketPersistence() {
  if (stockMarketPersistenceManager) {
    return stockMarketPersistenceManager;
  }

  const store = createConfiguredStore();
  await store.initialize();
  const savedMarket = await store.load();
  const initialMarket = savedMarket ?? createInitialStockMarketState(Date.now());
  stockMarketPersistenceManager = new StockMarketPersistenceManager(store, initialMarket);
  if (!savedMarket) {
    await stockMarketPersistenceManager.save(initialMarket);
  }
  logServer('stock-market-persistence', 'Initialized stock market persistence.', stockMarketPersistenceManager.getInfo());
  return stockMarketPersistenceManager;
}

export function getStockMarketPersistence() {
  if (!stockMarketPersistenceManager) {
    throw new Error('Stock market persistence has not been initialized.');
  }

  return stockMarketPersistenceManager;
}

export function getStockMarketPersistenceInfo() {
  if (stockMarketPersistenceManager) {
    return stockMarketPersistenceManager.getInfo();
  }

  const usingDatabase = Boolean(String(process.env.DATABASE_URL ?? '').trim());
  return {
    mode: usingDatabase ? 'postgres' : 'file',
    worldKey: getWorldKey(),
    path: usingDatabase ? null : fileURLToPath(DEFAULT_STOCK_MARKET_PATH)
  };
}

export async function shutdownStockMarketPersistence() {
  if (!stockMarketPersistenceManager) {
    return;
  }

  const manager = stockMarketPersistenceManager;
  stockMarketPersistenceManager = null;
  await manager.dispose();
}
