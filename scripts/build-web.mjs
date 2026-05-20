import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const stagingDist = path.join(root, '.dist-staging');
const assetsRoot = path.join(root, 'assets');
const defaultWorldLayoutPath = path.join(root, 'server', 'data', 'world-layout.json');
const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const DIST_TOTAL_BUDGET_BYTES = getByteBudget(['VTA_DIST_TOTAL_BUDGET_BYTES', 'STICKRPG_DIST_TOTAL_BUDGET_BYTES'], 80 * 1024 * 1024);
const DIST_OPTIONAL_MEDIA_BUDGET_BYTES = getByteBudget(['VTA_DIST_OPTIONAL_MEDIA_BUDGET_BYTES', 'STICKRPG_DIST_OPTIONAL_MEDIA_BUDGET_BYTES'], 32 * 1024 * 1024);
const DIST_FILE_BUDGET_BYTES = getByteBudget(['VTA_DIST_FILE_BUDGET_BYTES', 'STICKRPG_DIST_FILE_BUDGET_BYTES'], 8 * 1024 * 1024);
const DIST_STALE_FRONTEND_KEEP_COUNT = getIntegerBudget(['VTA_DIST_STALE_FRONTEND_KEEP_COUNT', 'STICKRPG_DIST_STALE_FRONTEND_KEEP_COUNT'], 2);
const DIST_COPY_CONCURRENCY = getIntegerBudget(['VTA_DIST_COPY_CONCURRENCY', 'STICKRPG_DIST_COPY_CONCURRENCY'], 16);
const DIST_PRECOMPRESS_CONCURRENCY = getIntegerBudget(['VTA_DIST_PRECOMPRESS_CONCURRENCY', 'STICKRPG_DIST_PRECOMPRESS_CONCURRENCY'], 4);
const DIST_BUDGET_DETAIL_LIMIT = 10;
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

for (const envFile of ['.env.local', '.env']) {
  loadDotenv({ path: path.join(root, envFile), override: false, quiet: true });
}

function getByteBudget(names, fallback) {
  const envNames = Array.isArray(names) ? names : [names];
  for (const name of envNames) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return fallback;
}

function getIntegerBudget(names, fallback) {
  const envNames = Array.isArray(names) ? names : [names];
  for (const name of envNames) {
    const value = Number(process.env[name]);
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
  }
  return fallback;
}

function readEnvString(names) {
  const envNames = Array.isArray(names) ? names : [names];
  for (const name of envNames) {
    const value = String(process.env[name] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function formatKiB(bytes) {
  return `${Math.round(bytes / 1024)} KiB`;
}

function copyIterable(iterable) {
  const copied = [];
  for (const value of iterable) {
    copied.push(value);
  }
  return copied;
}

function copySortedIterable(iterable) {
  return copyIterable(iterable).sort();
}

function formatFileSizeList(files = []) {
  const sortedFiles = copyIterable(files).sort((left, right) => right.bytes - left.bytes);
  const limit = Math.min(sortedFiles.length, DIST_BUDGET_DETAIL_LIMIT);
  let text = '';
  for (let index = 0; index < limit; index += 1) {
    const entry = sortedFiles[index];
    text += `${index > 0 ? ', ' : ''}${entry.path} (${formatKiB(entry.bytes)})`;
  }
  return text;
}

function isOptionalMediaDistPath(relativePath = '') {
  return /^assets\/audio\/vibe-radio\/[^/]+\.mp3$/iu.test(relativePath);
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
    return getGltfReferencedUris(document);
  }

  if (extension === '.glb') {
    const contents = await fs.readFile(normalizedPath);
    const document = parseGlbJsonChunk(contents);
    return getGltfReferencedUris(document);
  }

  return [];
}

function getGltfReferencedUris(document = null) {
  const uris = [];
  const buffers = document?.buffers ?? [];
  for (let index = 0; index < buffers.length; index += 1) {
    uris.push(buffers[index].uri);
  }
  const images = document?.images ?? [];
  for (let index = 0; index < images.length; index += 1) {
    uris.push(images[index].uri);
  }
  return uris;
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
    for (const key in value) {
      if (Object.hasOwn(value, key)) {
        collectAssetUrls(value[key], output);
      }
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
  for (let index = 0; index < builderCatalogModule.BUILDER_ITEMS.length; index += 1) {
    collectAssetUrls(builderCatalogModule.BUILDER_ITEMS[index].asset, assetUrls);
  }
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
    files: copySortedIterable(filesToCopy),
    licenses: copySortedIterable(licenseFiles)
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
  return (
    (Array.isArray(layout?.tiles) && layout.tiles.length > 0)
    || (Array.isArray(layout?.props) && layout.props.length > 0)
    || (Array.isArray(layout?.npcs) && layout.npcs.length > 0)
  );
}

async function loadWorldLayoutForBuild() {
  const configuredLayoutPath = String(process.env.WORLD_LAYOUT_PATH ?? process.env.WORLD_LAYOUT_SEED_PATH ?? '').trim();
  const candidatePaths = [
    configuredLayoutPath
      ? (path.isAbsolute(configuredLayoutPath) ? configuredLayoutPath : path.resolve(root, configuredLayoutPath))
      : null,
    defaultWorldLayoutPath
  ];

  for (const candidatePath of candidatePaths) {
    if (!candidatePath) {
      continue;
    }

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

  const startupCharacterPaths = new Set();
  for (const assetUrl of startupCharacterUrls) {
    if (isAssetUrl(assetUrl)) {
      startupCharacterPaths.add(path.normalize(fileURLToPath(assetUrl)));
    }
  }
  return startupCharacterPaths;
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

  await runWithConcurrency(assetCopyList.licenses, DIST_COPY_CONCURRENCY, async (licensePath) => {
    const relativePath = path.relative(root, licensePath);
    await copyFile(licensePath, path.join(outputDirectory, relativePath));
  });

  await runWithConcurrency(assetCopyList.files, DIST_COPY_CONCURRENCY, async (sourcePath) => {
    const relativePath = path.relative(root, sourcePath);
    await copyOptimizedTextAsset(sourcePath, path.join(outputDirectory, relativePath));
  });
}

async function copyOptionalDirectory(relativeDirectory, outputDirectory = stagingDist) {
  const sourceDirectory = path.join(root, relativeDirectory);
  const stats = await fs.stat(sourceDirectory).catch(() => null);
  if (!stats?.isDirectory()) {
    return;
  }

  const files = await walkFiles(sourceDirectory);
  await runWithConcurrency(files, DIST_COPY_CONCURRENCY, async (filePath) => {
    const relativePath = path.relative(root, filePath);
    await copyFile(filePath, path.join(outputDirectory, relativePath));
  });
}

function readFrontendServerUrl() {
  return readEnvString([
    'VTA_SERVER_URL',
    'VITE_VTA_SERVER_URL',
    'STICKRPG_SERVER_URL',
    'VITE_STICKRPG_SERVER_URL'
  ]);
}

function readFrontendBuildCommitSha() {
  return readEnvString([
    'VTA_BUILD_COMMIT_SHA',
    'STICKRPG_BUILD_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_SHA',
    'GITHUB_SHA'
  ]);
}

function readFrontendSupabaseConfig() {
  const url = readEnvString([
    'VTA_SUPABASE_URL',
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'STICKRPG_SUPABASE_URL',
    'SUPABASE_URL'
  ]);
  const publishableKey = readEnvString([
    'VTA_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'STICKRPG_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'VTA_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'STICKRPG_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY'
  ]);
  return { publishableKey, url };
}

function getRuntimeConfigScript() {
  const serverUrl = readFrontendServerUrl();
  const buildCommitSha = readFrontendBuildCommitSha();
  const supabaseConfig = readFrontendSupabaseConfig();
  const assignments = [];
  if (serverUrl) {
    assignments.push(`globalThis.VTA_SERVER_URL = ${JSON.stringify(serverUrl)};`);
    assignments.push(`globalThis.STICKRPG_SERVER_URL = ${JSON.stringify(serverUrl)};`);
  }
  if (buildCommitSha) {
    assignments.push(`globalThis.VTA_BUILD_COMMIT_SHA = ${JSON.stringify(buildCommitSha)};`);
    assignments.push(`globalThis.STICKRPG_BUILD_COMMIT_SHA = ${JSON.stringify(buildCommitSha)};`);
  }
  if (supabaseConfig.url && supabaseConfig.publishableKey) {
    assignments.push(`globalThis.VTA_SUPABASE_URL = ${JSON.stringify(supabaseConfig.url)};`);
    assignments.push(`globalThis.STICKRPG_SUPABASE_URL = ${JSON.stringify(supabaseConfig.url)};`);
    assignments.push(`globalThis.VTA_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(supabaseConfig.publishableKey)};`);
    assignments.push(`globalThis.STICKRPG_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(supabaseConfig.publishableKey)};`);
  }
  if (assignments.length === 0) {
    return '';
  }

  return `    <script>${assignments.join('')}</script>\n`;
}

function buildHtmlFromTemplate(template, { appScript, stylesheet, modulePreloads = [] }) {
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

  if (modulePreloads.length > 0) {
    let preloadTags = '';
    for (let index = 0; index < modulePreloads.length; index += 1) {
      preloadTags += `${index > 0 ? '\n' : ''}    <link rel="modulepreload" href="./${modulePreloads[index]}" />`;
    }
    html = html.replace('</head>', `${preloadTags}\n  </head>`);
  }

  const runtimeConfigScript = getRuntimeConfigScript();
  if (runtimeConfigScript) {
    html = html.replace('</head>', runtimeConfigScript + '  </head>');
  }

  return html;
}

function normalizeOutputPath(filePath) {
  return String(filePath ?? '').split(path.sep).join('/');
}

function getStagingRelativeOutputPath(filePath) {
  const normalized = path.normalize(filePath);
  const relative = path.relative(
    stagingDist,
    path.resolve(root, normalized)
  );
  return normalizeOutputPath(relative);
}

function resolveMetafileImportPath(fromRelativePath, importPath, outputByRelativePath) {
  const rawImportPath = String(importPath ?? '');
  if (!rawImportPath) {
    return '';
  }

  const candidates = new Set();
  candidates.add(normalizeOutputPath(rawImportPath));
  candidates.add(getStagingRelativeOutputPath(rawImportPath));
  if (path.isAbsolute(rawImportPath)) {
    candidates.add(getStagingRelativeOutputPath(rawImportPath));
  } else {
    candidates.add(path.posix.normalize(rawImportPath));
    candidates.add(path.posix.normalize(path.posix.join(path.posix.dirname(fromRelativePath), rawImportPath)));
  }

  for (const candidate of candidates) {
    if (outputByRelativePath.has(candidate)) {
      return candidate;
    }
  }
  return '';
}

function getStaticModulePreloads(metafile, entryRelativePath) {
  const outputByRelativePath = new Map();
  for (const filePath in metafile.outputs) {
    if (Object.hasOwn(metafile.outputs, filePath)) {
      outputByRelativePath.set(getStagingRelativeOutputPath(filePath), metafile.outputs[filePath]);
    }
  }
  const visited = new Set();
  const preloadPaths = new Set();

  function visit(relativePath) {
    if (visited.has(relativePath)) {
      return;
    }
    visited.add(relativePath);

    const output = outputByRelativePath.get(relativePath);
    for (const imported of output?.imports ?? []) {
      if (imported.external || imported.kind === 'dynamic-import') {
        continue;
      }

      const importedRelativePath = resolveMetafileImportPath(
        relativePath,
        imported.path,
        outputByRelativePath
      );
      if (!importedRelativePath || !/assets\/chunks\/[^/]+\.js$/u.test(importedRelativePath)) {
        continue;
      }

      preloadPaths.add(importedRelativePath);
      visit(importedRelativePath);
    }
  }

  visit(entryRelativePath);
  return copySortedIterable(preloadPaths);
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

  let appScript = '';
  let stylesheet = '';
  for (const file in result.metafile.outputs) {
    if (!Object.hasOwn(result.metafile.outputs, file)) {
      continue;
    }

    const outputPath = getStagingRelativeOutputPath(file);
    if (!appScript && /assets\/app-[^/]+\.js$/u.test(outputPath)) {
      appScript = outputPath;
    } else if (!stylesheet && /assets\/styles-[^/]+\.css$/u.test(outputPath)) {
      stylesheet = outputPath;
    }
  }

  if (!appScript) {
    throw new Error('Bundled app entry was not generated.');
  }

  return {
    appScript,
    stylesheet: stylesheet ?? '',
    modulePreloads: getStaticModulePreloads(result.metafile, appScript)
  };
}

async function copyStaticShell({ appScript, stylesheet, modulePreloads = [] }) {
  const htmlTemplate = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const builtHtml = buildHtmlFromTemplate(htmlTemplate, { appScript, stylesheet, modulePreloads });
  await fs.writeFile(path.join(stagingDist, 'index.html'), builtHtml, 'utf8');
  await copyOptionalFile(path.join(root, 'favicon.svg'), path.join(stagingDist, 'favicon.svg'));
  await copyFile(path.join(root, 'favicon.ico'), path.join(stagingDist, 'favicon.ico'));
  await copyFile(
    path.join(root, 'vendor', 'colyseus-sdk', 'colyseus.js'),
    path.join(stagingDist, 'vendor', 'colyseus-sdk', 'colyseus.js')
  );
}

async function writeVersionManifest(outputDirectory = stagingDist) {
  const commitSha = readFrontendBuildCommitSha();
  const manifest = {
    version: 1,
    commitSha,
    buildCommitSha: commitSha,
    builtAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(outputDirectory, 'version.json'), `${JSON.stringify(manifest)}\n`, 'utf8');
}

async function walkFiles(directory) {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await walkFiles(fullPath);
      for (let index = 0; index < childFiles.length; index += 1) {
        files.push(childFiles[index]);
      }
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

async function runWithConcurrency(items, concurrency, worker) {
  const limit = Math.max(1, Math.min(items.length, concurrency));
  let nextIndex = 0;
  const workers = new Array(limit);
  for (let workerIndex = 0; workerIndex < limit; workerIndex += 1) {
    workers[workerIndex] = (async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await worker(items[index], index);
      }
    })();
  }
  await Promise.all(workers);
}

async function compressDistFiles(outputDirectory = stagingDist) {
  const files = await walkFiles(outputDirectory);
  const compressibleFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    if (COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      compressibleFiles.push(filePath);
    }
  }

  await runWithConcurrency(compressibleFiles, DIST_PRECOMPRESS_CONCURRENCY, async (filePath) => {
    let source;
    try {
      source = await readFileWithRetry(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }

      const relativePath = path.relative(outputDirectory, filePath).split(path.sep).join('/');
      console.warn(`Skipping precompression for missing file: ${relativePath}`);
      return;
    }

    await Promise.all([
      writeCompressedVariant(filePath, source, 'gz'),
      writeCompressedVariant(filePath, source, 'br')
    ]);
  });
}

async function enforceDistBudget(outputDirectory = stagingDist) {
  const files = await walkFiles(outputDirectory);
  const runtimeFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    if (!filePath.endsWith('.gz') && !filePath.endsWith('.br')) {
      runtimeFiles.push(filePath);
    }
  }
  let totalBytes = 0;
  let coreBytes = 0;
  let optionalMediaBytes = 0;
  const coreFileSizes = [];
  const optionalMediaFileSizes = [];
  const oversizedFiles = [];

  for (const filePath of runtimeFiles) {
    const stats = await fs.stat(filePath);
    const relativePath = path.relative(outputDirectory, filePath).split(path.sep).join('/');
    totalBytes += stats.size;
    const sizeEntry = {
      path: relativePath,
      bytes: stats.size
    };

    if (isOptionalMediaDistPath(relativePath)) {
      optionalMediaBytes += stats.size;
      optionalMediaFileSizes.push(sizeEntry);
    } else {
      coreBytes += stats.size;
      coreFileSizes.push(sizeEntry);
    }

    if (stats.size > DIST_FILE_BUDGET_BYTES) {
      oversizedFiles.push({
        path: relativePath,
        bytes: stats.size
      });
    }
  }

  const errors = [];
  if (coreBytes > DIST_TOTAL_BUDGET_BYTES) {
    const largestFiles = formatFileSizeList(coreFileSizes);
    errors.push(
      `Core dist payload is ${formatKiB(coreBytes)}, budget is ${formatKiB(DIST_TOTAL_BUDGET_BYTES)}.`
        + (largestFiles ? ` Largest core runtime files: ${largestFiles}.` : '')
    );
  }

  if (optionalMediaBytes > DIST_OPTIONAL_MEDIA_BUDGET_BYTES) {
    const largestFiles = formatFileSizeList(optionalMediaFileSizes);
    errors.push(
      `Optional media payload is ${formatKiB(optionalMediaBytes)}, budget is ${formatKiB(DIST_OPTIONAL_MEDIA_BUDGET_BYTES)}.`
        + (largestFiles ? ` Largest optional media files: ${largestFiles}.` : '')
    );
  }

  if (oversizedFiles.length > 0) {
    const details = formatFileSizeList(oversizedFiles);
    errors.push(
      `Files exceed the single-file budget of ${formatKiB(DIST_FILE_BUDGET_BYTES)}: ${details}.`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Build asset budget failed. ${errors.join(' ')}`);
  }

  return {
    coreBytes,
    optionalMediaBytes,
    totalBytes
  };
}

async function deployStagingDist() {
  await fs.mkdir(dist, { recursive: true });
  const stagingFiles = await walkFiles(stagingDist);
  const stagingRelativePaths = new Set();
  const htmlFiles = [];
  const assetFiles = [];
  for (const sourcePath of stagingFiles) {
    stagingRelativePaths.add(path.relative(stagingDist, sourcePath));
    if (sourcePath.endsWith(`${path.sep}index.html`)) {
      htmlFiles.push(sourcePath);
    } else {
      assetFiles.push(sourcePath);
    }
  }

  const copyStagingFile = async (sourcePath) => {
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
        return;
      }
      throw error;
    }
  };

  await runWithConcurrency(assetFiles, DIST_COPY_CONCURRENCY, copyStagingFile);
  for (const sourcePath of htmlFiles) {
    await copyStagingFile(sourcePath);
  }

  const existingDistFiles = await walkFiles(dist);
  const staleFrontendAssetKeysToKeep = await getStaleFrontendAssetKeysToKeep(existingDistFiles, stagingRelativePaths);
  for (const targetPath of existingDistFiles) {
    const relativePath = path.relative(dist, targetPath);
    if (!stagingRelativePaths.has(relativePath) && !shouldKeepStaleDistFile(relativePath, staleFrontendAssetKeysToKeep)) {
      await fs.rm(targetPath, { force: true });
    }
  }
}

function getStaleFrontendAssetInfo(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join('/');
  const match = /^assets\/((app|styles)-[a-z0-9]+\.(?:js|css))(?:\.(?:br|gz))?$/iu.exec(normalizedPath);
  return match
    ? {
        key: match[1].toLowerCase(),
        kind: match[2].toLowerCase()
      }
    : null;
}

async function getStaleFrontendAssetKeysToKeep(existingDistFiles, stagingRelativePaths) {
  if (DIST_STALE_FRONTEND_KEEP_COUNT <= 0) {
    return new Set();
  }

  const entriesByKey = new Map();
  for (const filePath of existingDistFiles) {
    const relativePath = path.relative(dist, filePath);
    if (stagingRelativePaths.has(relativePath)) {
      continue;
    }

    const info = getStaleFrontendAssetInfo(relativePath);
    if (!info) {
      continue;
    }

    const stats = await fs.stat(filePath).catch(() => null);
    const existing = entriesByKey.get(info.key);
    if (!existing || (stats?.mtimeMs ?? 0) > existing.mtimeMs) {
      entriesByKey.set(info.key, {
        kind: info.kind,
        mtimeMs: stats?.mtimeMs ?? 0
      });
    }
  }

  const keepKeys = new Set();
  for (const kind of ['app', 'styles']) {
    const candidates = [];
    for (const [key, entry] of entriesByKey) {
      if (entry.kind === kind) {
        candidates.push([key, entry]);
      }
    }
    candidates.sort((left, right) => right[1].mtimeMs - left[1].mtimeMs);
    const keepCount = Math.min(DIST_STALE_FRONTEND_KEEP_COUNT, candidates.length);
    for (let index = 0; index < keepCount; index += 1) {
      keepKeys.add(candidates[index][0]);
    }
  }
  return keepKeys;
}

function shouldKeepStaleDistFile(relativePath, staleFrontendAssetKeysToKeep = new Set()) {
  const info = getStaleFrontendAssetInfo(relativePath);
  return Boolean(info && staleFrontendAssetKeysToKeep.has(info.key));
}

await resetStagingDist();

const bundleOutputs = await bundleClient();
await copyStaticShell(bundleOutputs);
await writeVersionManifest();
await copyRuntimeAssets();
await copyOptionalDirectory(path.join('assets', 'audio', 'vibe-radio'));
await copyOptionalDirectory(path.join('assets', 'generated'));
await copyOptionalDirectory(path.join('assets', 'mixamo', 'portraits'));
await compressDistFiles();
const budget = await enforceDistBudget();
await deployStagingDist();

console.log(
  `Built bundled web app into ${dist}`
    + ` (${Math.round(budget.totalBytes / 1024)} KiB before precompressed variants;`
    + ` core ${Math.round(budget.coreBytes / 1024)} KiB,`
    + ` optional media ${Math.round(budget.optionalMediaBytes / 1024)} KiB).`
);
