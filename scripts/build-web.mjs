import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const stagingDist = path.join(root, '.dist-staging');
const assetsRoot = path.join(root, 'assets');
const defaultWorldLayoutPath = path.join(root, 'server', 'data', 'world-layout.json');
const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const DIST_TOTAL_BUDGET_BYTES = getByteBudget('STICKRPG_DIST_TOTAL_BUDGET_BYTES', (35 * 1024 + 1792) * 1024);
const DIST_FILE_BUDGET_BYTES = getByteBudget('STICKRPG_DIST_FILE_BUDGET_BYTES', 5 * 1024 * 1024);
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.glb',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt'
]);

function getByteBudget(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function resetStagingDist() {
  await fs.rm(stagingDist, { recursive: true, force: true });
  await fs.mkdir(stagingDist, { recursive: true });
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyOptimizedTextAsset(source, target) {
  const extension = path.extname(source).toLowerCase();
  if (extension !== '.json' && extension !== '.gltf') {
    await copyFile(source, target);
    return;
  }

  try {
    const document = JSON.parse(await fs.readFile(source, 'utf8'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(document), 'utf8');
  } catch {
    await copyFile(source, target);
  }
}

async function copyOptionalFile(source, target) {
  const stats = await fs.stat(source).catch(() => null);
  if (!stats?.isFile()) {
    return;
  }

  await copyFile(source, target);
}

function isAssetUrl(value) {
  return typeof value === 'string' && value.startsWith('file:');
}

function parseGlbJsonChunk(buffer) {
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') {
    throw new Error('Invalid GLB header.');
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  const totalLength = buffer.readUInt32LE(8);
  let offset = 12;

  while (offset + 8 <= totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkType === 'JSON') {
      const jsonText = buffer.toString('utf8', chunkStart, chunkEnd).replace(/\u0000+$/u, '');
      return JSON.parse(jsonText);
    }

    offset = chunkEnd;
  }

  return null;
}

async function getReferencedAssetUris(normalizedPath) {
  const extension = path.extname(normalizedPath).toLowerCase();

  if (extension === '.gltf') {
    const contents = await fs.readFile(normalizedPath, 'utf8');
    const document = JSON.parse(contents);
    return [
      ...(document.buffers ?? []).map((entry) => entry.uri),
      ...(document.images ?? []).map((entry) => entry.uri)
    ];
  }

  if (extension === '.glb') {
    const contents = await fs.readFile(normalizedPath);
    const document = parseGlbJsonChunk(contents);
    return [
      ...(document?.buffers ?? []).map((entry) => entry.uri),
      ...(document?.images ?? []).map((entry) => entry.uri)
    ];
  }

  return [];
}

function collectAssetUrls(value, output = new Set()) {
  if (!value) {
    return output;
  }

  if (isAssetUrl(value)) {
    output.add(value);
    return output;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAssetUrls(entry, output);
    }
    return output;
  }

  if (typeof value === 'object') {
    for (const entry of Object.values(value)) {
      collectAssetUrls(entry, output);
    }
  }

  return output;
}

async function addRuntimeAsset(filePath, filesToCopy, copiedLicenses) {
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(assetsRoot)) {
    return;
  }

  filesToCopy.add(normalizedPath);

  const extension = path.extname(normalizedPath).toLowerCase();
  if (extension === '.gltf' || extension === '.glb') {
    const referencedUris = await getReferencedAssetUris(normalizedPath);
    for (const uri of referencedUris) {
      if (!uri || /^data:/i.test(uri)) {
        continue;
      }
      await addRuntimeAsset(path.resolve(path.dirname(normalizedPath), uri), filesToCopy, copiedLicenses);
    }
  }

  let current = path.dirname(normalizedPath);
  while (current.startsWith(assetsRoot) && current !== assetsRoot) {
    const licensePath = path.join(current, 'License.txt');
    try {
      await fs.access(licensePath);
      copiedLicenses.add(licensePath);
      break;
    } catch {
      current = path.dirname(current);
    }
  }
}

async function buildAssetCopyList() {
  const assetManifestModule = await import(pathToFileURL(path.join(root, 'src', 'world', 'assetManifest.js')).href);
  const builderCatalogModule = await import(pathToFileURL(path.join(root, 'src', 'world', 'builderCatalog.js')).href);
  const playableCharacterCatalogModule = await import(pathToFileURL(path.join(root, 'src', 'player', 'playableCharacterCatalog.js')).href);
  const npcCatalogModule = await import(pathToFileURL(path.join(root, 'src', 'npc', 'npcCatalog.js')).href);

  const assetUrls = new Set();
  collectAssetUrls(assetManifestModule.assets, assetUrls);
  collectAssetUrls(builderCatalogModule.BUILDER_ITEMS.map((item) => item.asset), assetUrls);
  const startupMixamoCharacterPaths = await getStartupMixamoCharacterPaths({
    assets: assetManifestModule.assets,
    getNpcModelByItemId: npcCatalogModule.getNpcModelByItemId,
    getPlayableCharacterById: playableCharacterCatalogModule.getPlayableCharacterById,
    defaultPlayableCharacterId: playableCharacterCatalogModule.DEFAULT_PLAYABLE_CHARACTER_ID
  });

  const filesToCopy = new Set();
  const licenseFiles = new Set();

  for (const assetUrl of assetUrls) {
    const assetPath = fileURLToPath(assetUrl);
    if (shouldSkipStartupCopy(assetPath, startupMixamoCharacterPaths)) {
      continue;
    }
    await addRuntimeAsset(assetPath, filesToCopy, licenseFiles);
  }

  return {
    files: [...filesToCopy].sort(),
    licenses: [...licenseFiles].sort()
  };
}

async function readWorldLayoutCandidate(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function worldLayoutHasPlacements(layout) {
  return ['tiles', 'props', 'npcs'].some((key) => Array.isArray(layout?.[key]) && layout[key].length > 0);
}

async function loadWorldLayoutForBuild() {
  const configuredLayoutPath = String(process.env.WORLD_LAYOUT_PATH ?? process.env.WORLD_LAYOUT_SEED_PATH ?? '').trim();
  const candidatePaths = [
    configuredLayoutPath
      ? (path.isAbsolute(configuredLayoutPath) ? configuredLayoutPath : path.resolve(root, configuredLayoutPath))
      : null,
    defaultWorldLayoutPath
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    const layout = await readWorldLayoutCandidate(candidatePath);
    if (worldLayoutHasPlacements(layout)) {
      return layout;
    }
  }

  const defaultWorldLayoutModule = await import(pathToFileURL(path.join(root, 'src', 'world', 'defaultWorldLayout.js')).href);
  return defaultWorldLayoutModule.defaultWorldLayout;
}

async function getStartupMixamoCharacterPaths({
  assets,
  getNpcModelByItemId,
  getPlayableCharacterById,
  defaultPlayableCharacterId
}) {
  const layout = await loadWorldLayoutForBuild();
  const startupCharacterUrls = new Set();
  const defaultPlayableCharacter = getPlayableCharacterById(defaultPlayableCharacterId);

  collectAssetUrls(defaultPlayableCharacter?.characterRig, startupCharacterUrls);

  for (const npc of layout?.npcs ?? []) {
    if (typeof npc?.modelId === 'string' && assets.mixamo.characters[npc.modelId]) {
      startupCharacterUrls.add(assets.mixamo.characters[npc.modelId]);
      continue;
    }

    if (typeof npc?.itemId === 'string') {
      const npcModel = getNpcModelByItemId(npc.itemId);
      collectAssetUrls(npcModel?.asset, startupCharacterUrls);
    }
  }

  return new Set(
    [...startupCharacterUrls]
      .filter(isAssetUrl)
      .map((assetUrl) => path.normalize(fileURLToPath(assetUrl)))
  );
}

function shouldSkipStartupCopy(filePath, startupMixamoCharacterPaths) {
  const normalizedPath = path.normalize(filePath);
  const relativeAssetPath = path.relative(assetsRoot, normalizedPath);
  if (relativeAssetPath.startsWith('..') || path.isAbsolute(relativeAssetPath)) {
    return false;
  }

  const assetSegments = relativeAssetPath.split(path.sep);
  const isSourceMixamoCharacter = assetSegments[0] === 'mixamo' && assetSegments[1] === 'characters';
  if (!isSourceMixamoCharacter) {
    return false;
  }

  return !startupMixamoCharacterPaths.has(normalizedPath);
}

async function copyRuntimeAssets(outputDirectory = stagingDist) {
  const assetCopyList = await buildAssetCopyList();

  for (const licensePath of assetCopyList.licenses) {
    const relativePath = path.relative(root, licensePath);
    await copyFile(licensePath, path.join(outputDirectory, relativePath));
  }

  for (const sourcePath of assetCopyList.files) {
    const relativePath = path.relative(root, sourcePath);
    await copyOptimizedTextAsset(sourcePath, path.join(outputDirectory, relativePath));
  }
}

async function copyOptionalDirectory(relativeDirectory, outputDirectory = stagingDist) {
  const sourceDirectory = path.join(root, relativeDirectory);
  const stats = await fs.stat(sourceDirectory).catch(() => null);
  if (!stats?.isDirectory()) {
    return;
  }

  const files = await walkFiles(sourceDirectory);
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath);
    await copyFile(filePath, path.join(outputDirectory, relativePath));
  }
}

function buildHtmlFromTemplate(template, { appScript, stylesheet }) {
  let html = template;
  html = html.replace(/\s*<link\s+rel="stylesheet"\s+href="\.\/styles\.css"\s*\/?>\s*/u, '\n');
  html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>\s*/u, '\n');
  html = html.replace(
    /\s*<script type="module" src="\.\/src\/main\.js"><\/script>\s*/u,
    `\n    <script type="module" src="./${appScript}"></script>\n`
  );

  if (stylesheet) {
    html = html.replace(
      '</head>',
      `    <link rel="stylesheet" href="./${stylesheet}" />\n  </head>`
    );
  }

  return html;
}

async function bundleClient() {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    chunkNames: 'assets/chunks/[name]-[hash]',
    entryNames: 'assets/[name]-[hash]',
    entryPoints: {
      app: path.join(root, 'src', 'main.js'),
      styles: path.join(root, 'styles.css')
    },
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    minify: true,
    outdir: stagingDist,
    platform: 'browser',
    sourcemap: false,
    splitting: true,
    target: ['es2022']
  });

  const outputs = Object.keys(result.metafile.outputs)
    .map((file) => {
      const normalized = path.normalize(file);
      const relative = path.relative(
        stagingDist,
        path.resolve(root, normalized)
      );
      return relative.split(path.sep).join('/');
    });
  const appScript = outputs.find((file) => /assets\/app-[^/]+\.js$/u.test(file));
  const stylesheet = outputs.find((file) => /assets\/styles-[^/]+\.css$/u.test(file));

  if (!appScript) {
    throw new Error('Bundled app entry was not generated.');
  }

  return {
    appScript,
    stylesheet: stylesheet ?? ''
  };
}

async function copyStaticShell({ appScript, stylesheet }) {
  const htmlTemplate = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const builtHtml = buildHtmlFromTemplate(htmlTemplate, { appScript, stylesheet });
  await fs.writeFile(path.join(stagingDist, 'index.html'), builtHtml, 'utf8');
  await copyOptionalFile(path.join(root, 'favicon.svg'), path.join(stagingDist, 'favicon.svg'));
  await copyFile(path.join(root, 'favicon.ico'), path.join(stagingDist, 'favicon.ico'));
  await copyFile(
    path.join(root, 'vendor', 'colyseus-sdk', 'colyseus.js'),
    path.join(stagingDist, 'vendor', 'colyseus-sdk', 'colyseus.js')
  );
}

async function walkFiles(directory) {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readFileWithRetry(filePath, { attempts = 3, retryDelayMs = 50 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      const isRetriableMissingFile = error?.code === 'ENOENT' && attempt < attempts;
      if (!isRetriableMissingFile) {
        throw error;
      }
      await delay(retryDelayMs * attempt);
    }
  }

  throw new Error(`Failed to read file after ${attempts} attempts: ${filePath}`);
}

async function writeCompressedVariant(filePath, source, encoding) {
  const compressed = encoding === 'br'
    ? await brotliCompressAsync(source, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 11
      }
    })
    : await gzipAsync(source, { level: 9 });
  const compressedPath = `${filePath}.${encoding}`;
  await fs.mkdir(path.dirname(compressedPath), { recursive: true });
  await fs.writeFile(compressedPath, compressed);
}

async function compressDistFiles(outputDirectory = stagingDist) {
  const files = await walkFiles(outputDirectory);

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (!COMPRESSIBLE_EXTENSIONS.has(extension)) {
      continue;
    }

    let source;
    try {
      source = await readFileWithRetry(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }

      const relativePath = path.relative(outputDirectory, filePath).split(path.sep).join('/');
      console.warn(`Skipping precompression for missing file: ${relativePath}`);
      continue;
    }

    await writeCompressedVariant(filePath, source, 'gz');
    await writeCompressedVariant(filePath, source, 'br');
  }
}

async function enforceDistBudget(outputDirectory = stagingDist) {
  const files = await walkFiles(outputDirectory);
  const runtimeFiles = files.filter((filePath) => !filePath.endsWith('.gz') && !filePath.endsWith('.br'));
  let totalBytes = 0;
  const oversizedFiles = [];

  for (const filePath of runtimeFiles) {
    const stats = await fs.stat(filePath);
    totalBytes += stats.size;

    if (stats.size > DIST_FILE_BUDGET_BYTES) {
      oversizedFiles.push({
        path: path.relative(outputDirectory, filePath).split(path.sep).join('/'),
        bytes: stats.size
      });
    }
  }

  const errors = [];
  if (totalBytes > DIST_TOTAL_BUDGET_BYTES) {
    errors.push(
      `Dist payload is ${Math.round(totalBytes / 1024)} KiB, budget is ${Math.round(DIST_TOTAL_BUDGET_BYTES / 1024)} KiB.`
    );
  }

  if (oversizedFiles.length > 0) {
    const details = oversizedFiles
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 10)
      .map((entry) => `${entry.path} (${Math.round(entry.bytes / 1024)} KiB)`)
      .join(', ');
    errors.push(
      `Files exceed the single-file budget of ${Math.round(DIST_FILE_BUDGET_BYTES / 1024)} KiB: ${details}.`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Build asset budget failed. ${errors.join(' ')}`);
  }

  return totalBytes;
}

async function deployStagingDist() {
  await fs.mkdir(dist, { recursive: true });
  const stagingFiles = await walkFiles(stagingDist);
  const stagingRelativePaths = new Set(
    stagingFiles.map((sourcePath) => path.relative(stagingDist, sourcePath))
  );
  const orderedFiles = stagingFiles.sort((left, right) => {
    const leftPriority = left.endsWith(`${path.sep}index.html`) ? 1 : 0;
    const rightPriority = right.endsWith(`${path.sep}index.html`) ? 1 : 0;
    return leftPriority - rightPriority;
  });

  for (const sourcePath of orderedFiles) {
    const relativePath = path.relative(stagingDist, sourcePath);
    const targetPath = path.join(dist, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    try {
      await fs.copyFile(sourcePath, targetPath);
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error?.code)) {
        throw error;
      }

      const [sourceStats, targetStats] = await Promise.all([
        fs.stat(sourcePath),
        fs.stat(targetPath).catch(() => null)
      ]);
      if (targetStats && sourceStats.size === targetStats.size) {
        continue;
      }
      throw error;
    }
  }

  const existingDistFiles = await walkFiles(dist);
  for (const targetPath of existingDistFiles) {
    const relativePath = path.relative(dist, targetPath);
    if (!stagingRelativePaths.has(relativePath) && !shouldKeepStaleDistFile(relativePath)) {
      await fs.rm(targetPath, { force: true });
    }
  }
}

function shouldKeepStaleDistFile(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join('/');
  return /^assets\/(?:app|styles)-[a-z0-9]+\.(?:js|css)(?:\.(?:br|gz))?$/iu.test(normalizedPath);
}

await resetStagingDist();

const bundleOutputs = await bundleClient();
await copyStaticShell(bundleOutputs);
await copyRuntimeAssets();
await copyOptionalDirectory(path.join('assets', 'generated'));
await copyOptionalDirectory(path.join('assets', 'mixamo', 'portraits'));
await compressDistFiles();
const totalBytes = await enforceDistBudget();
await deployStagingDist();

console.log(`Built bundled web app into ${dist} (${Math.round(totalBytes / 1024)} KiB before precompressed variants).`);
