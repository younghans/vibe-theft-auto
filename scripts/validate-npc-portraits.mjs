import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { listPlayableCharacters } from '../src/player/playableCharacterCatalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portraitsRoot = path.join(root, 'assets', 'mixamo', 'portraits');
const portraitEntries = [];
for (const entry of listPlayableCharacters()) {
  if (!entry?.portraitFileName) {
    continue;
  }
  portraitEntries.push({
    id: entry.id,
    portraitFileName: entry.portraitFileName
  });
}

const missing = [];

for (const definition of portraitEntries) {
  const portraitPath = path.join(portraitsRoot, definition.portraitFileName);
  const exists = await fs.stat(portraitPath).then((stats) => stats.isFile()).catch(() => false);
  if (!exists) {
    missing.push({
      id: definition.id,
      portraitFileName: definition.portraitFileName
    });
  }
}

if (missing.length) {
  console.error('Missing NPC portrait PNGs:');
  for (const entry of missing) {
    console.error(`- ${entry.id} -> assets/mixamo/portraits/${entry.portraitFileName}`);
  }
  process.exit(1);
}

console.log(`Validated ${portraitEntries.length} character portrait PNGs.`);
