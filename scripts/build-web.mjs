import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');
const assetsRoot = path.join(root, 'assets');

async function resetDist() {
  await fs.rm(dist, { recursive: true, force: true });
  await fs.mkdir(dist, { recursive: true });
}

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await copyFile(sourcePath, targetPath);
    }
  }
}

function isAssetUrl(value) {
  return typeof value === 'string' && value.startsWith('file:');
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
  if (extension === '.gltf') {
    const contents = await fs.readFile(normalizedPath, 'utf8');
    const document = JSON.parse(contents);
    const referencedUris = [
      ...(document.buffers ?? []).map((entry) => entry.uri),
      ...(document.images ?? []).map((entry) => entry.uri)
    ];

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

await resetDist();

await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await copyFile(path.join(root, 'styles.css'), path.join(dist, 'styles.css'));
await copyFile(path.join(root, 'favicon.ico'), path.join(dist, 'favicon.ico'));
await copyDirectory(path.join(root, 'src'), path.join(dist, 'src'));
await copyDirectory(path.join(root, 'vendor'), path.join(dist, 'vendor'));
await copyRuntimeAssets();

console.log(`Built static app into ${dist}`);
