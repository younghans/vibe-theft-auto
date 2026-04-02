import { promises as fsp } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { defaultWorldLayout } from '../../src/world/defaultWorldLayout.js';

const { Pool } = pg;

const DEFAULT_LAYOUT_PATH = new URL('../data/world-layout.json', import.meta.url);
const PROJECT_ROOT_URL = new URL('../../', import.meta.url);
const DEFAULT_WORLD_KEY = 'primary';

let worldPersistenceManager = null;

function cloneLayout(layout = defaultWorldLayout) {
  return structuredClone({
    tiles: layout.tiles ?? [],
    props: layout.props ?? [],
    npcs: layout.npcs ?? []
  });
}

function resolveLayoutUrl(configuredPath, fallbackUrl) {
  if (!configuredPath) {
    return fallbackUrl;
  }

  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(fileURLToPath(PROJECT_ROOT_URL), configuredPath);

  return pathToFileURL(resolvedPath);
}

function getWorldKey() {
  const configuredKey = String(process.env.WORLD_KEY ?? DEFAULT_WORLD_KEY).trim();
  return configuredKey || DEFAULT_WORLD_KEY;
}

function getConfiguredSeedLayoutUrl() {
  return resolveLayoutUrl(process.env.WORLD_LAYOUT_SEED_PATH, DEFAULT_LAYOUT_PATH);
}

function getConfiguredRuntimeLayoutUrl() {
  return resolveLayoutUrl(process.env.WORLD_LAYOUT_PATH, DEFAULT_LAYOUT_PATH);
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

async function readLayoutFile(layoutUrl) {
  try {
    const layoutPath = fileURLToPath(layoutUrl);
    const text = await fsp.readFile(layoutPath, 'utf8');
    return cloneLayout(JSON.parse(text));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function writeLayoutFile(layoutUrl, layout) {
  const destinationPath = fileURLToPath(layoutUrl);
  const directoryPath = path.dirname(destinationPath);
  const tempPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;

  await fsp.mkdir(directoryPath, { recursive: true });
  await fsp.writeFile(tempPath, `${JSON.stringify(cloneLayout(layout), null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, destinationPath);
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

class FileWorldPersistenceStore {
  constructor({
    runtimeUrl = getConfiguredRuntimeLayoutUrl(),
    seedUrl = getConfiguredSeedLayoutUrl()
  } = {}) {
    this.runtimeUrl = runtimeUrl;
    this.seedUrl = seedUrl;
  }

  getInfo() {
    return {
      mode: 'file',
      worldKey: getWorldKey(),
      runtimePath: fileURLToPath(this.runtimeUrl),
      seedPath: fileURLToPath(this.seedUrl)
    };
  }

  async initializeFromSeedIfEmpty(seedLayout) {
    const existingLayout = await readLayoutFile(this.runtimeUrl);
    if (existingLayout) {
      return;
    }

    await writeLayoutFile(this.runtimeUrl, seedLayout);
    console.info('[world-persistence] Seeded runtime world layout.', this.getInfo());
  }

  async load() {
    return readLayoutFile(this.runtimeUrl);
  }

  async save(layout) {
    await writeLayoutFile(this.runtimeUrl, layout);
  }

  async dispose() {}
}

class PostgresWorldPersistenceStore {
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
      runtimePath: null,
      seedPath: fileURLToPath(getConfiguredSeedLayoutUrl())
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS world_snapshots (
        world_key text PRIMARY KEY,
        layout jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        version bigint NOT NULL DEFAULT 1
      )
    `);

    this.initialized = true;
  }

  async initializeFromSeedIfEmpty(seedLayout) {
    await this.initialize();
    await this.pool.query(
      `
        INSERT INTO world_snapshots (world_key, layout, updated_at, version)
        VALUES ($1, $2::jsonb, NOW(), 1)
        ON CONFLICT (world_key) DO NOTHING
      `,
      [this.worldKey, JSON.stringify(cloneLayout(seedLayout))]
    );
  }

  async load() {
    await this.initialize();
    const result = await this.pool.query(
      'SELECT layout FROM world_snapshots WHERE world_key = $1',
      [this.worldKey]
    );

    if (!result.rows.length) {
      return null;
    }

    return cloneLayout(result.rows[0].layout);
  }

  async save(layout) {
    await this.initialize();
    await this.pool.query(
      `
        INSERT INTO world_snapshots (world_key, layout, updated_at, version)
        VALUES ($1, $2::jsonb, NOW(), 1)
        ON CONFLICT (world_key) DO UPDATE
        SET layout = EXCLUDED.layout,
            updated_at = NOW(),
            version = world_snapshots.version + 1
      `,
      [this.worldKey, JSON.stringify(cloneLayout(layout))]
    );
  }

  async dispose() {
    await this.pool.end();
  }
}

class WorldPersistenceManager {
  constructor(store, initialLayout) {
    this.store = store;
    this.initialLayout = cloneLayout(initialLayout);
  }

  getInfo() {
    return this.store.getInfo();
  }

  getInitialLayout() {
    return cloneLayout(this.initialLayout);
  }

  async save(layout) {
    const nextLayout = cloneLayout(layout);
    await this.store.save(nextLayout);
    this.initialLayout = nextLayout;
  }

  async dispose() {
    await this.store.dispose();
  }
}

function createConfiguredStore() {
  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl) {
    return new PostgresWorldPersistenceStore({
      connectionString: databaseUrl
    });
  }

  if (isProductionEnvironment()) {
    throw new Error('DATABASE_URL is required in production deployments.');
  }

  return new FileWorldPersistenceStore();
}

export async function initializeWorldPersistence() {
  if (worldPersistenceManager) {
    return worldPersistenceManager;
  }

  const seedLayout = await readLayoutFile(getConfiguredSeedLayoutUrl()) ?? cloneLayout(defaultWorldLayout);
  const store = createConfiguredStore();
  await store.initializeFromSeedIfEmpty(seedLayout);

  const initialLayout = await store.load() ?? seedLayout;
  worldPersistenceManager = new WorldPersistenceManager(store, initialLayout);

  console.info('[world-persistence] Initialized world persistence.', worldPersistenceManager.getInfo());
  return worldPersistenceManager;
}

export function getWorldPersistence() {
  if (!worldPersistenceManager) {
    throw new Error('World persistence has not been initialized.');
  }

  return worldPersistenceManager;
}

export function getWorldPersistenceInfo() {
  if (worldPersistenceManager) {
    return worldPersistenceManager.getInfo();
  }

  const usingDatabase = Boolean(String(process.env.DATABASE_URL ?? '').trim());
  return {
    mode: usingDatabase ? 'postgres' : 'file',
    worldKey: getWorldKey(),
    runtimePath: usingDatabase ? null : fileURLToPath(getConfiguredRuntimeLayoutUrl()),
    seedPath: fileURLToPath(getConfiguredSeedLayoutUrl())
  };
}

export async function shutdownWorldPersistence() {
  if (!worldPersistenceManager) {
    return;
  }

  const manager = worldPersistenceManager;
  worldPersistenceManager = null;
  await manager.dispose();
}
