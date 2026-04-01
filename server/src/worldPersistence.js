import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defaultWorldLayout } from '../../src/world/defaultWorldLayout.js';

const DEFAULT_LAYOUT_PATH = new URL('../data/world-layout.json', import.meta.url);
const WRITE_DEBOUNCE_MS = 180;

function cloneLayout(layout = defaultWorldLayout) {
  return structuredClone({
    tiles: layout.tiles ?? [],
    props: layout.props ?? [],
    npcs: layout.npcs ?? []
  });
}

export function getWorldLayoutPath() {
  return DEFAULT_LAYOUT_PATH;
}

export function loadPersistedWorldLayoutSync() {
  try {
    const destinationPath = fileURLToPath(DEFAULT_LAYOUT_PATH);
    if (!fs.existsSync(destinationPath)) {
      return cloneLayout(defaultWorldLayout);
    }

    const text = fs.readFileSync(destinationPath, 'utf8');
    const parsed = JSON.parse(text);
    return cloneLayout(parsed);
  } catch (error) {
    console.warn('[world-persistence] Falling back to default layout after load failure.', error);
    return cloneLayout(defaultWorldLayout);
  }
}

export class WorldLayoutPersistence {
  constructor(layoutUrl = DEFAULT_LAYOUT_PATH) {
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
