import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { defaultWorldLayout } from '../../src/world/defaultWorldLayout.js';

const DEFAULT_LAYOUT_PATH = new URL('../data/world-layout.json', import.meta.url);
const PROJECT_ROOT_URL = new URL('../../', import.meta.url);
const WRITE_DEBOUNCE_MS = 180;

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

function getResolvedWorldLayoutPaths() {
  return {
    runtimeUrl: resolveLayoutUrl(process.env.WORLD_LAYOUT_PATH, DEFAULT_LAYOUT_PATH),
    seedUrl: resolveLayoutUrl(process.env.WORLD_LAYOUT_SEED_PATH, DEFAULT_LAYOUT_PATH)
  };
}

function readLayoutFileSync(layoutUrl) {
  const layoutPath = fileURLToPath(layoutUrl);
  if (!fs.existsSync(layoutPath)) {
    return null;
  }

  const text = fs.readFileSync(layoutPath, 'utf8');
  return cloneLayout(JSON.parse(text));
}

function writeLayoutFileSync(layoutUrl, layout) {
  const destinationPath = fileURLToPath(layoutUrl);
  const directoryPath = path.dirname(destinationPath);
  const tempPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;

  fs.mkdirSync(directoryPath, { recursive: true });
  fs.writeFileSync(tempPath, `${JSON.stringify(cloneLayout(layout), null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, destinationPath);
}

function ensureRuntimeLayoutSeededSync() {
  const { runtimeUrl, seedUrl } = getResolvedWorldLayoutPaths();
  const runtimePath = fileURLToPath(runtimeUrl);
  if (fs.existsSync(runtimePath)) {
    return { runtimeUrl, seedUrl };
  }

  const seedLayout = readLayoutFileSync(seedUrl) ?? cloneLayout(defaultWorldLayout);
  writeLayoutFileSync(runtimeUrl, seedLayout);
  console.info('[world-persistence] Seeded runtime world layout.', {
    runtimePath,
    seedPath: fileURLToPath(seedUrl)
  });
  return { runtimeUrl, seedUrl };
}

export function getWorldLayoutPath() {
  return getResolvedWorldLayoutPaths().runtimeUrl;
}

export function getWorldLayoutSeedPath() {
  return getResolvedWorldLayoutPaths().seedUrl;
}

export function loadPersistedWorldLayoutSync() {
  try {
    const { runtimeUrl } = ensureRuntimeLayoutSeededSync();
    const layout = readLayoutFileSync(runtimeUrl);
    if (layout) {
      return layout;
    }

    return cloneLayout(defaultWorldLayout);
  } catch (error) {
    console.warn('[world-persistence] Falling back to default layout after load failure.', error);
    return cloneLayout(defaultWorldLayout);
  }
}

export class WorldLayoutPersistence {
  constructor(layoutUrl = getWorldLayoutPath()) {
    this.layoutUrl = layoutUrl;
    this.pendingLayout = null;
    this.saveTimer = null;
    this.flushPromise = Promise.resolve();
  }

  scheduleSave(layout) {
    this.pendingLayout = cloneLayout(layout);
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushPromise = this.flushPromise
        .then(() => this.flushPending())
        .catch((error) => {
          console.error('[world-persistence] Failed to persist layout.', error);
        });
    }, WRITE_DEBOUNCE_MS);
  }

  async flushPending() {
    if (!this.pendingLayout) {
      return;
    }

    const layout = this.pendingLayout;
    this.pendingLayout = null;
    const destinationPath = fileURLToPath(this.layoutUrl);
    const directoryPath = path.dirname(destinationPath);
    const tempPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;

    await fsp.mkdir(directoryPath, { recursive: true });
    await fsp.writeFile(tempPath, `${JSON.stringify(layout, null, 2)}\n`, 'utf8');
    await fsp.rename(tempPath, destinationPath);
  }

  async dispose() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    await this.flushPromise;
    await this.flushPending();
  }
}
