import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlibConstants, gzip } from 'node:zlib';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assetsRoot = path.join(root, 'assets');
const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt'
]);

async function resetDist() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
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

  const assetUrls = new Set();
  collectAssetUrls(assetManifestModule.assets, assetUrls);
  collectAssetUrls(builderCatalogModule.BUILDER_ITEMS.map((item) => item.asset), assetUrls);

  const filesToCopy = new Set();
  const licenseFiles = new Set();

  for (const assetUrl of assetUrls) {
    await addRuntimeAsset(fileURLToPath(assetUrl), filesToCopy, licenseFiles);
  }

  return {
    files: [...filesToCopy].sort(),
    licenses: [...licenseFiles].sort()
  };
}

async function copyRuntimeAssets() {
  const assetCopyList = await buildAssetCopyList();

  for (const licensePath of assetCopyList.licenses) {
    const relativePath = path.relative(root, licensePath);
    await copyFile(licensePath, path.join(dist, relativePath));
  }

  for (const sourcePath of assetCopyList.files) {
    const relativePath = path.relative(root, sourcePath);
    await copyFile(sourcePath, path.join(dist, relativePath));
  }
}

function toPosixRelative(filePath) {
  return path.relative(dist, filePath).split(path.sep).join('/');
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
    outdir: dist,
    platform: 'browser',
    sourcemap: false,
    splitting: true,
    target: ['es2022']
  });

  const outputs = Object.keys(result.metafile.outputs)
    .map((file) => file.split(path.sep).join('/'));
  const appScript = outputs.find((file) => /assets\/app-[^/]+\.js$/u.test(file));
  const stylesheet = outputs.find((file) => /assets\/styles-[^/]+\.css$/u.test(file));

  if (!appScript) {
    throw new Error('Bundled app entry was not generated.');
  }

  return {
    appScript: appScript.replace(/^dist\//u, ''),
    stylesheet: (stylesheet ?? '').replace(/^dist\//u, '')
  };
}

async function copyStaticShell({ appScript, stylesheet }) {
  const htmlTemplate = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const builtHtml = buildHtmlFromTemplate(htmlTemplate, { appScript, stylesheet });
  await fs.writeFile(path.join(dist, 'index.html'), builtHtml, 'utf8');
  await copyFile(path.join(root, 'favicon.ico'), path.join(dist, 'favicon.ico'));
  await copyFile(
    path.join(root, 'vendor', 'colyseus-sdk', 'colyseus.js'),
    path.join(dist, 'vendor', 'colyseus-sdk', 'colyseus.js')
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

async function writeCompressedVariant(filePath, encoding) {
  const source = await fs.readFile(filePath);
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

async function compressDistFiles() {
  const files = await walkFiles(dist);

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (!COMPRESSIBLE_EXTENSIONS.has(extension)) {
      continue;
    }

    await writeCompressedVariant(filePath, 'gz');
    await writeCompressedVariant(filePath, 'br');
  }
}

await resetDist();

const bundleOutputs = await bundleClient();
await copyStaticShell(bundleOutputs);
await copyRuntimeAssets();
await compressDistFiles();

const distFiles = await walkFiles(dist);
const totalBytes = distFiles
  .filter((filePath) => !filePath.endsWith('.gz') && !filePath.endsWith('.br'))
  .reduce(async (sumPromise, filePath) => {
    const sum = await sumPromise;
    const stats = await fs.stat(filePath);
    return sum + stats.size;
  }, Promise.resolve(0));

console.log(`Built bundled web app into ${dist} (${Math.round((await totalBytes) / 1024)} KiB before precompressed variants).`);
