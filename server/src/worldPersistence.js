import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { defaultWorldLayout } from '../../src/world/defaultWorldLayout.js';
import { logServer } from './logger.js';

const { Pool } = pg;

const DEFAULT_LAYOUT_PATH = new URL('../data/world-layout.json', import.meta.url);
const DEFAULT_WORLD_BACKUP_PATH = new URL('../data/world-backups/', import.meta.url);
const PROJECT_ROOT_URL = new URL('../../', import.meta.url);
const DEFAULT_WORLD_KEY = 'primary';
const DEFAULT_WORLD_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_WORLD_BACKUP_RECENT_DAYS = 3;
const DEFAULT_WORLD_BACKUP_MAX_DAILY_DAYS = 30;

let worldPersistenceManager = null;

function cloneLayout(layout = defaultWorldLayout) {
  return structuredClone({
    tiles: layout.tiles ?? [],
    props: layout.props ?? [],
    npcs: layout.npcs ?? []
  });
}

function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseNonNegativeIntegerEnv(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
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

function getWorldBackupConfig(worldKey = getWorldKey()) {
  const targetWorldKey = String(process.env.WORLD_BACKUP_WORLD_KEY ?? DEFAULT_WORLD_KEY).trim() || DEFAULT_WORLD_KEY;
  const targetMatches = targetWorldKey === '*' || targetWorldKey === worldKey;

  return {
    enabled: targetMatches && parseBooleanEnv(process.env.WORLD_BACKUP_ENABLED, true),
    targetWorldKey,
    intervalMs: parseNonNegativeIntegerEnv(process.env.WORLD_BACKUP_INTERVAL_MS, DEFAULT_WORLD_BACKUP_INTERVAL_MS),
    recentDays: parseNonNegativeIntegerEnv(process.env.WORLD_BACKUP_RECENT_DAYS, DEFAULT_WORLD_BACKUP_RECENT_DAYS),
    maxDailyDays: parseNonNegativeIntegerEnv(
      process.env.WORLD_BACKUP_MAX_DAILY_DAYS,
      DEFAULT_WORLD_BACKUP_MAX_DAILY_DAYS
    ),
    directoryUrl: resolveLayoutUrl(process.env.WORLD_BACKUP_PATH, DEFAULT_WORLD_BACKUP_PATH)
  };
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

function isProductionFileFallbackAllowed() {
  return parseBooleanEnv(process.env.WORLD_PERSISTENCE_ALLOW_FILE_FALLBACK, false);
}

function getPersistenceEnvSummary(databaseUrl) {
  return {
    nodeEnv: String(process.env.NODE_ENV ?? ''),
    databaseUrlConfigured: Boolean(databaseUrl),
    worldPersistenceAllowFileFallback: isProductionFileFallbackAllowed(),
    worldKey: getWorldKey()
  };
}

export function getLayoutBackupHash(layout) {
  return createHash('sha256')
    .update(JSON.stringify(cloneLayout(layout)))
    .digest('hex');
}

function getBackupCapturedAtMs(entry) {
  const capturedAt = entry?.capturedAt ?? entry?.captured_at ?? '';
  const capturedAtMs = capturedAt instanceof Date ? capturedAt.getTime() : Date.parse(capturedAt);
  return Number.isFinite(capturedAtMs) ? capturedAtMs : Number.NaN;
}

function getBackupDayKey(capturedAtMs) {
  return new Date(capturedAtMs).toISOString().slice(0, 10);
}

function getLatestBackupEntry(entries, worldKey) {
  return [...entries]
    .filter((entry) => entry?.worldKey === worldKey)
    .filter((entry) => Number.isFinite(getBackupCapturedAtMs(entry)))
    .sort((a, b) => getBackupCapturedAtMs(b) - getBackupCapturedAtMs(a))[0] ?? null;
}

function shouldCaptureWorldBackup({ latestEntry, layoutHash, config, nowMs = Date.now() }) {
  if (!config.enabled) {
    return false;
  }

  if (latestEntry?.layoutHash === layoutHash) {
    return false;
  }

  const latestCapturedAtMs = getBackupCapturedAtMs(latestEntry);
  if (Number.isFinite(latestCapturedAtMs) && nowMs - latestCapturedAtMs < config.intervalMs) {
    return false;
  }

  return true;
}

export function getRetainedWorldBackupEntries(entries, config, nowMs = Date.now()) {
  const parsedRecentDays = Number(config?.recentDays ?? DEFAULT_WORLD_BACKUP_RECENT_DAYS);
  const parsedMaxDailyDays = Number(config?.maxDailyDays ?? DEFAULT_WORLD_BACKUP_MAX_DAILY_DAYS);
  const recentDays = Number.isFinite(parsedRecentDays)
    ? Math.max(0, parsedRecentDays)
    : DEFAULT_WORLD_BACKUP_RECENT_DAYS;
  const maxDailyDays = Number.isFinite(parsedMaxDailyDays)
    ? Math.max(0, parsedMaxDailyDays)
    : DEFAULT_WORLD_BACKUP_MAX_DAILY_DAYS;
  const recentCutoffMs = nowMs - recentDays * 24 * 60 * 60 * 1000;
  const maxCutoffMs = maxDailyDays > 0 ? nowMs - maxDailyDays * 24 * 60 * 60 * 1000 : null;
  const keptOlderDayKeys = new Set();

  return [...entries]
    .filter((entry) => Number.isFinite(getBackupCapturedAtMs(entry)))
    .sort((a, b) => getBackupCapturedAtMs(b) - getBackupCapturedAtMs(a))
    .filter((entry) => {
      const capturedAtMs = getBackupCapturedAtMs(entry);
      if (maxCutoffMs !== null && capturedAtMs < maxCutoffMs) {
        return false;
      }

      if (capturedAtMs >= recentCutoffMs) {
        return true;
      }

      const dayKey = `${entry.worldKey ?? DEFAULT_WORLD_KEY}:${getBackupDayKey(capturedAtMs)}`;
      if (keptOlderDayKeys.has(dayKey)) {
        return false;
      }

      keptOlderDayKeys.add(dayKey);
      return true;
    });
}

function getBackupFileWorldKey(worldKey) {
  return String(worldKey ?? DEFAULT_WORLD_KEY).replace(/[^a-z0-9_-]+/gi, '-') || DEFAULT_WORLD_KEY;
}

function getBackupFileTimestamp(capturedAt) {
  return capturedAt.replace(/[:.]/g, '-');
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
    this.worldKey = getWorldKey();
    this.backupConfig = getWorldBackupConfig(this.worldKey);
  }

  getInfo() {
    return {
      mode: 'file',
      worldKey: this.worldKey,
      runtimePath: fileURLToPath(this.runtimeUrl),
      seedPath: fileURLToPath(this.seedUrl),
      backups: {
        enabled: this.backupConfig.enabled,
        targetWorldKey: this.backupConfig.targetWorldKey,
        intervalMs: this.backupConfig.intervalMs,
        recentDays: this.backupConfig.recentDays,
        maxDailyDays: this.backupConfig.maxDailyDays,
        path: fileURLToPath(this.backupConfig.directoryUrl)
      }
    };
  }

  async initializeFromSeedIfEmpty(seedLayout) {
    const existingLayout = await readLayoutFile(this.runtimeUrl);
    if (existingLayout) {
      return;
    }

    await writeLayoutFile(this.runtimeUrl, seedLayout);
    logServer('world-persistence', 'Seeded runtime world layout.', this.getInfo());
  }

  async load() {
    return readLayoutFile(this.runtimeUrl);
  }

  async save(layout) {
    await writeLayoutFile(this.runtimeUrl, layout);
    return { version: null };
  }

  getBackupDirectoryPath() {
    return fileURLToPath(this.backupConfig.directoryUrl);
  }

  getBackupIndexPath() {
    return path.join(this.getBackupDirectoryPath(), 'index.json');
  }

  async readBackupIndex() {
    try {
      const text = await fsp.readFile(this.getBackupIndexPath(), 'utf8');
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.backups) ? parsed.backups : [];
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  async writeBackupIndex(entries) {
    const directoryPath = this.getBackupDirectoryPath();
    const indexPath = this.getBackupIndexPath();
    const tempPath = `${indexPath}.tmp-${process.pid}-${Date.now()}`;

    await fsp.mkdir(directoryPath, { recursive: true });
    await fsp.writeFile(
      tempPath,
      `${JSON.stringify({ version: 1, backups: entries }, null, 2)}\n`,
      'utf8'
    );
    await fsp.rename(tempPath, indexPath);
  }

  async deletePrunedBackupFiles({ beforeEntries, afterEntries }) {
    const keptFileNames = new Set(afterEntries.map((entry) => entry.fileName).filter(Boolean));
    const prunedEntries = beforeEntries.filter((entry) => entry.fileName && !keptFileNames.has(entry.fileName));

    await Promise.all(prunedEntries.map(async (entry) => {
      try {
        await fsp.unlink(path.join(this.getBackupDirectoryPath(), entry.fileName));
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }));
  }

  async pruneBackups(entries, nowMs = Date.now()) {
    const retainedEntries = getRetainedWorldBackupEntries(entries, this.backupConfig, nowMs);
    await this.deletePrunedBackupFiles({ beforeEntries: entries, afterEntries: retainedEntries });
    return retainedEntries;
  }

  async captureBackup(layout, saveResult = {}) {
    if (!this.backupConfig.enabled) {
      return { captured: false, reason: 'disabled' };
    }

    const entries = await this.readBackupIndex();
    const layoutHash = getLayoutBackupHash(layout);
    const nowMs = Date.now();
    const latestEntry = getLatestBackupEntry(entries, this.worldKey);
    const shouldCapture = shouldCaptureWorldBackup({
      latestEntry,
      layoutHash,
      config: this.backupConfig,
      nowMs
    });

    if (!shouldCapture) {
      const retainedEntries = await this.pruneBackups(entries, nowMs);
      if (retainedEntries.length !== entries.length) {
        await this.writeBackupIndex(retainedEntries);
      }

      return { captured: false, reason: 'unchanged-or-too-soon' };
    }

    const capturedAt = new Date(nowMs).toISOString();
    const fileName = [
      getBackupFileWorldKey(this.worldKey),
      getBackupFileTimestamp(capturedAt),
      layoutHash.slice(0, 12)
    ].join('-') + '.json';
    const directoryPath = this.getBackupDirectoryPath();

    await fsp.mkdir(directoryPath, { recursive: true });
    await fsp.writeFile(
      path.join(directoryPath, fileName),
      `${JSON.stringify(cloneLayout(layout), null, 2)}\n`,
      'utf8'
    );

    const backupEntry = {
      worldKey: this.worldKey,
      capturedAt,
      layoutHash,
      sourceVersion: saveResult?.version ?? null,
      fileName
    };
    const retainedEntries = await this.pruneBackups([...entries, backupEntry], nowMs);
    await this.writeBackupIndex(retainedEntries);

    logServer('world-backup', 'Captured file world backup.', {
      worldKey: this.worldKey,
      fileName,
      layoutHash: layoutHash.slice(0, 12)
    });

    return { captured: true, backup: backupEntry };
  }

  async dispose() {}
}

class PostgresWorldPersistenceStore {
  constructor({
    connectionString,
    worldKey = getWorldKey()
  }) {
    this.worldKey = worldKey;
    this.backupConfig = getWorldBackupConfig(this.worldKey);
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
      seedPath: fileURLToPath(getConfiguredSeedLayoutUrl()),
      backups: {
        enabled: this.backupConfig.enabled,
        targetWorldKey: this.backupConfig.targetWorldKey,
        intervalMs: this.backupConfig.intervalMs,
        recentDays: this.backupConfig.recentDays,
        maxDailyDays: this.backupConfig.maxDailyDays
      }
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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS world_snapshot_backups (
        id bigserial PRIMARY KEY,
        world_key text NOT NULL,
        layout jsonb NOT NULL,
        layout_hash text NOT NULL,
        source_version bigint,
        captured_at timestamptz NOT NULL DEFAULT NOW(),
        backup_kind text NOT NULL DEFAULT 'periodic'
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS world_snapshot_backups_world_key_captured_at_idx
      ON world_snapshot_backups (world_key, captured_at DESC)
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
    const result = await this.pool.query(
      `
        INSERT INTO world_snapshots (world_key, layout, updated_at, version)
        VALUES ($1, $2::jsonb, NOW(), 1)
        ON CONFLICT (world_key) DO UPDATE
        SET layout = EXCLUDED.layout,
            updated_at = NOW(),
            version = world_snapshots.version + 1
        RETURNING version
      `,
      [this.worldKey, JSON.stringify(cloneLayout(layout))]
    );

    return { version: result.rows[0]?.version ?? null };
  }

  async pruneBackups() {
    if (!this.backupConfig.enabled) {
      return;
    }

    await this.pool.query(
      `
        WITH ranked_backups AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY world_key, DATE_TRUNC('day', captured_at AT TIME ZONE 'UTC')
              ORDER BY captured_at DESC, id DESC
            ) AS day_rank
          FROM world_snapshot_backups
          WHERE world_key = $1
            AND captured_at < NOW() - ($2::int * INTERVAL '1 day')
        )
        DELETE FROM world_snapshot_backups backups
        USING ranked_backups ranked
        WHERE backups.id = ranked.id
          AND ranked.day_rank > 1
      `,
      [this.worldKey, this.backupConfig.recentDays]
    );

    if (this.backupConfig.maxDailyDays > 0) {
      await this.pool.query(
        `
          DELETE FROM world_snapshot_backups
          WHERE world_key = $1
            AND captured_at < NOW() - ($2::int * INTERVAL '1 day')
        `,
        [this.worldKey, this.backupConfig.maxDailyDays]
      );
    }
  }

  async captureBackup(layout, saveResult = {}) {
    if (!this.backupConfig.enabled) {
      return { captured: false, reason: 'disabled' };
    }

    await this.initialize();
    const layoutHash = getLayoutBackupHash(layout);
    const latestResult = await this.pool.query(
      `
        SELECT layout_hash AS "layoutHash", captured_at AS "capturedAt"
        FROM world_snapshot_backups
        WHERE world_key = $1
        ORDER BY captured_at DESC, id DESC
        LIMIT 1
      `,
      [this.worldKey]
    );
    const latestEntry = latestResult.rows[0] ?? null;
    const shouldCapture = shouldCaptureWorldBackup({
      latestEntry,
      layoutHash,
      config: this.backupConfig
    });

    if (!shouldCapture) {
      await this.pruneBackups();
      return { captured: false, reason: 'unchanged-or-too-soon' };
    }

    const result = await this.pool.query(
      `
        INSERT INTO world_snapshot_backups (world_key, layout, layout_hash, source_version, captured_at, backup_kind)
        VALUES ($1, $2::jsonb, $3, $4, NOW(), 'periodic')
        RETURNING id, captured_at AS "capturedAt"
      `,
      [
        this.worldKey,
        JSON.stringify(cloneLayout(layout)),
        layoutHash,
        saveResult?.version ?? null
      ]
    );

    await this.pruneBackups();

    logServer('world-backup', 'Captured postgres world backup.', {
      worldKey: this.worldKey,
      backupId: result.rows[0]?.id ?? null,
      layoutHash: layoutHash.slice(0, 12)
    });

    return {
      captured: true,
      backup: {
        id: result.rows[0]?.id ?? null,
        worldKey: this.worldKey,
        capturedAt: result.rows[0]?.capturedAt ?? null,
        layoutHash,
        sourceVersion: saveResult?.version ?? null
      }
    };
  }

  async dispose() {
    await this.pool.end();
  }
}

class WorldPersistenceManager {
  constructor(store, initialLayout) {
    this.store = store;
    this.initialLayout = cloneLayout(initialLayout);
    this.latestSaveResult = { version: null };
    this.backupCapturePromise = null;
    this.backupTimer = null;
    this.startBackupTimer();
  }

  getInfo() {
    return this.store.getInfo();
  }

  getInitialLayout() {
    return cloneLayout(this.initialLayout);
  }

  startBackupTimer() {
    const backupConfig = this.store.backupConfig;
    if (!this.store.captureBackup || !backupConfig?.enabled || backupConfig.intervalMs <= 0) {
      return;
    }

    this.backupTimer = setInterval(() => {
      void this.captureCurrentBackup();
    }, backupConfig.intervalMs);
    this.backupTimer.unref?.();
  }

  async captureCurrentBackup(saveResult = this.latestSaveResult) {
    if (!this.store.captureBackup) {
      return null;
    }

    if (this.backupCapturePromise) {
      return this.backupCapturePromise;
    }

    this.backupCapturePromise = this.store.captureBackup(cloneLayout(this.initialLayout), saveResult)
      .catch((error) => {
        logServer('world-backup', 'Failed to capture world backup.', {
          error: error?.message ?? String(error)
        });
        return null;
      })
      .finally(() => {
        this.backupCapturePromise = null;
      });

    return this.backupCapturePromise;
  }

  async save(layout) {
    const nextLayout = cloneLayout(layout);
    const saveResult = await this.store.save(nextLayout) ?? { version: null };
    this.initialLayout = nextLayout;
    this.latestSaveResult = saveResult;
    await this.captureCurrentBackup(saveResult);
  }

  async dispose() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    if (this.backupCapturePromise) {
      await this.backupCapturePromise;
    }

    await this.store.dispose();
  }
}

function createConfiguredStore() {
  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl) {
    logServer('world-persistence', 'Using Postgres world persistence.', getPersistenceEnvSummary(databaseUrl));
    return new PostgresWorldPersistenceStore({
      connectionString: databaseUrl
    });
  }

  if (isProductionEnvironment()) {
    if (!isProductionFileFallbackAllowed()) {
      logServer('world-persistence', 'Missing required production DATABASE_URL.', getPersistenceEnvSummary(databaseUrl));
      throw new Error('DATABASE_URL is required in production deployments.');
    }

    logServer('world-persistence', 'DATABASE_URL is missing; using production file fallback.', getPersistenceEnvSummary(databaseUrl));
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

  logServer('world-persistence', 'Initialized world persistence.', worldPersistenceManager.getInfo());
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
  const backupConfig = getWorldBackupConfig(getWorldKey());
  return {
    mode: usingDatabase ? 'postgres' : 'file',
    worldKey: getWorldKey(),
    runtimePath: usingDatabase ? null : fileURLToPath(getConfiguredRuntimeLayoutUrl()),
    seedPath: fileURLToPath(getConfiguredSeedLayoutUrl()),
    backups: {
      enabled: backupConfig.enabled,
      targetWorldKey: backupConfig.targetWorldKey,
      intervalMs: backupConfig.intervalMs,
      recentDays: backupConfig.recentDays,
      maxDailyDays: backupConfig.maxDailyDays
    }
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
