import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import { validateMixamoHumanoid } from '../../src/animation/humanoid.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../../src/shared/mixamoCharacterCatalog.js';
import { DEFAULT_PLAYABLE_CHARACTER_ID } from '../../src/player/playableCharacterCatalog.js';

const require = createRequire(import.meta.url);
const convertFbxToGltf = require('fbx2gltf');
const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolRoot, '..', '..');
const sourceCharacterRoot = resolveProjectPath(
  process.env.MIXAMO_SOURCE_CHARACTER_DIR,
  path.join(root, 'assets', 'mixamo', 'characters')
);
const runtimeCharacterRoot = path.join(root, 'assets', 'runtime', 'mixamo', 'characters');
const tempRoot = path.join(root, '.tmp-gltf-estimate', 'runtime-mixamo');
const worldLayoutPath = path.join(root, 'server', 'data', 'world-layout.json');
const gltfTransformExecutable = path.join(
  toolRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform'
);
const optimizerArgs = Object.freeze([
  'optimize',
  '',
  '',
  '--compress',
  'meshopt',
  '--meshopt-level',
  'high',
  '--texture-compress',
  'webp',
  '--texture-size',
  '1024'
]);

const definitionById = new Map(MIXAMO_CHARACTER_DEFINITIONS.map((entry) => [entry.id, entry]));
const definitionByItemId = new Map(MIXAMO_CHARACTER_DEFINITIONS.map((entry) => [entry.itemId, entry]));
const cliArgs = process.argv.slice(2);
const flags = new Set(cliArgs.filter((arg) => arg.startsWith('--')));
const requestedIds = cliArgs.filter((arg) => !arg.startsWith('--'));

installDomShims();

function resolveProjectPath(value, fallback) {
  const configured = String(value ?? '').trim();
  if (!configured) {
    return fallback;
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(root, configured);
}

function installDomShims() {
  globalThis.self = globalThis;
  globalThis.window = globalThis.window ?? {
    URL: {
      createObjectURL() {
        return 'blob:mock';
      },
      revokeObjectURL() {}
    }
  };
  globalThis.document = globalThis.document ?? {
    createElementNS() {
      return {
        setAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        style: {},
        src: '',
        width: 0,
        height: 0
      };
    },
    createElement() {
      return this.createElementNS();
    }
  };
  globalThis.Image = globalThis.Image ?? class {};
  globalThis.ProgressEvent = globalThis.ProgressEvent ?? class {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  };
  globalThis.createImageBitmap = globalThis.createImageBitmap ?? (async () => ({ close() {} }));
  globalThis.FileReader = globalThis.FileReader ?? class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      }).catch((error) => {
        this.error = error;
        this.onerror?.(error);
      });
    }
  };
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  }
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function getArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function readJsonCandidate(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function getStartupCharacterIds() {
  const ids = new Set();
  const defaultPlayableId = DEFAULT_PLAYABLE_CHARACTER_ID === 'classicBot'
    ? 'xBot'
    : DEFAULT_PLAYABLE_CHARACTER_ID;
  if (definitionById.has(defaultPlayableId)) {
    ids.add(defaultPlayableId);
  }

  const layout = await readJsonCandidate(worldLayoutPath);
  for (const npc of layout?.npcs ?? []) {
    if (typeof npc?.modelId === 'string' && definitionById.has(npc.modelId)) {
      ids.add(npc.modelId);
    }
    if (typeof npc?.itemId === 'string') {
      const definition = definitionByItemId.get(npc.itemId);
      if (definition) {
        ids.add(definition.id);
      }
    }
  }

  return ids;
}

async function getDefinitionsToOptimize() {
  if (requestedIds.length > 0) {
    return requestedIds.map((id) => {
      const definition = definitionById.get(id);
      if (!definition) {
        throw new Error(`Unknown Mixamo character id: ${id}`);
      }
      return definition;
    });
  }

  if (flags.has('--startup-only')) {
    const startupIds = await getStartupCharacterIds();
    return MIXAMO_CHARACTER_DEFINITIONS.filter((entry) => startupIds.has(entry.id));
  }

  return [...MIXAMO_CHARACTER_DEFINITIONS];
}

async function isRuntimeAssetCurrent(sourcePath, outputPath) {
  if (flags.has('--force')) {
    return false;
  }

  const [sourceStats, outputStats] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(outputPath).catch(() => null)
  ]);

  return Boolean(outputStats?.isFile() && outputStats.mtimeMs >= sourceStats.mtimeMs);
}

async function stripUnusedRuntimeData(glbPath) {
  const io = new NodeIO();
  const document = await io.read(glbPath);
  const rootNode = document.getRoot();

  for (const animation of rootNode.listAnimations()) {
    animation.dispose();
  }

  await document.transform(prune());
  await io.write(glbPath, document);
}

async function exportRawGlb(_definition, sourcePath, rawOutputPath) {
  await fs.mkdir(path.dirname(rawOutputPath), { recursive: true });
  await convertFbxToGltf(sourcePath, rawOutputPath, ['--binary']);
  await stripUnusedRuntimeData(rawOutputPath);
}

function runGltfTransform(rawInputPath, outputPath) {
  const args = [...optimizerArgs];
  args[1] = rawInputPath;
  args[2] = outputPath;

  return new Promise((resolve, reject) => {
    const child = spawn(gltfTransformExecutable, args, {
      cwd: root,
      shell: process.platform === 'win32',
      stdio: flags.has('--verbose') ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`gltf-transform exited with code ${code}.${stderr ? `\n${stderr}` : ''}`));
    });
  });
}

async function validateOptimizedGlb(outputPath) {
  const bytes = await fs.readFile(outputPath);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(getArrayBuffer(bytes), '');
  const humanoid = validateMixamoHumanoid(gltf.scene);

  if (!humanoid.isHumanoid || humanoid.skinnedMeshes.length === 0) {
    throw new Error(
      `${path.basename(outputPath)} failed optimized GLB validation. Missing bones: ${humanoid.missingBones.join(', ')}`
    );
  }
}

async function optimizeDefinition(definition) {
  const sourcePath = path.join(sourceCharacterRoot, definition.fileName);
  const outputPath = path.join(runtimeCharacterRoot, `${definition.id}.glb`);
  const rawOutputPath = path.join(tempRoot, `${definition.id}.raw.glb`);

  if (await isRuntimeAssetCurrent(sourcePath, outputPath)) {
    const [sourceStats, outputStats] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(outputPath)
    ]);
    return {
      id: definition.id,
      sourceBytes: sourceStats.size,
      runtimeBytes: outputStats.size,
      skipped: true
    };
  }

  await exportRawGlb(definition, sourcePath, rawOutputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runGltfTransform(rawOutputPath, outputPath);
  await validateOptimizedGlb(outputPath);

  const [sourceStats, rawStats, outputStats] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(rawOutputPath),
    fs.stat(outputPath)
  ]);

  if (!flags.has('--keep-temp')) {
    await fs.rm(rawOutputPath, { force: true });
  }

  return {
    id: definition.id,
    rawGlbBytes: rawStats.size,
    sourceBytes: sourceStats.size,
    runtimeBytes: outputStats.size,
    skipped: false
  };
}

const definitions = await getDefinitionsToOptimize();
if (definitions.length === 0) {
  throw new Error('No Mixamo character assets selected for optimization.');
}

await fs.mkdir(runtimeCharacterRoot, { recursive: true });

const results = [];
for (const definition of definitions) {
  const result = await optimizeDefinition(definition);
  results.push(result);
  const ratio = result.sourceBytes > 0
    ? `${((1 - (result.runtimeBytes / result.sourceBytes)) * 100).toFixed(1)}% smaller`
    : 'n/a';
  const action = result.skipped ? 'current' : 'optimized';
  console.log(
    `[assets] ${definition.id}: ${action} ${formatBytes(result.sourceBytes)} -> ${formatBytes(result.runtimeBytes)} (${ratio})`
  );
}

const totalSourceBytes = results.reduce((sum, entry) => sum + entry.sourceBytes, 0);
const totalRuntimeBytes = results.reduce((sum, entry) => sum + entry.runtimeBytes, 0);
const totalRatio = totalSourceBytes > 0
  ? `${((1 - (totalRuntimeBytes / totalSourceBytes)) * 100).toFixed(1)}% smaller`
  : 'n/a';

console.log(
  `[assets] Mixamo runtime set: ${formatBytes(totalSourceBytes)} -> ${formatBytes(totalRuntimeBytes)} (${totalRatio}).`
);
