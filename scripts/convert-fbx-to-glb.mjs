import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const sourceRoot = process.argv[2];
const outputRoot = process.argv[3];

if (!sourceRoot || !outputRoot) {
  console.error('Usage: node scripts/convert-fbx-to-glb.mjs <sourceRoot> <outputRoot>');
  process.exit(1);
}

const textureDir = path.resolve(path.dirname(sourceRoot), 'Textures');
const textureMap = new Map();

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function getFilesRecursive(rootDir, extension) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await getFilesRecursive(fullPath, extension));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function buildTextureMap() {
  const textureFiles = await getFilesRecursive(textureDir, '.png');

  for (const filePath of textureFiles) {
    textureMap.set(path.basename(filePath).toLowerCase(), filePath);
  }
}

function pickTextureForMaterial(materialName = '') {
  const lower = materialName.toLowerCase();

  if (lower.includes('plane_01')) return textureMap.get('polygon_plane_texture_01.png');
  if (lower.includes('plane_02')) return textureMap.get('polygon_plane_texture_02.png');
  if (lower.includes('plane_03')) return textureMap.get('polygon_plane_texture_03.png');
  if (lower.includes('plane_04')) return textureMap.get('polygon_plane_texture_04.png');
  if (lower.includes('mat_01')) return textureMap.get('polygonstarter_texture_01.png');
  if (lower.includes('mat_02')) return textureMap.get('polygonstarter_texture_02.png');
  if (lower.includes('mat_03')) return textureMap.get('polygonstarter_texture_03.png');
  if (lower.includes('mat_04')) return textureMap.get('polygonstarter_texture_04.png');
  if (lower.includes('sky')) return textureMap.get('simple_sky_texture_01.png');

  return null;
}

async function loadTexture(texturePath) {
  const bytes = await fs.readFile(texturePath);
  const blob = new Blob([bytes], { type: 'image/png' });
  const image = await createImageBitmap(blob);
  const texture = new THREE.Texture(image);

  texture.name = path.basename(texturePath);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

async function remapMaterials(root) {
  const cache = new Map();
  const pending = [];

  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = [];

    for (const material of materials) {
      const texturePath = pickTextureForMaterial(material.name);

      if (!texturePath) {
        replacements.push(Promise.resolve(material));
        continue;
      }

      replacements.push((async () => {
        if (cache.has(material.name)) {
          return cache.get(material.name);
        }

        const map = await loadTexture(texturePath);
        const standardMaterial = new THREE.MeshStandardMaterial({
          name: material.name,
          map,
          color: material.color ?? new THREE.Color(0xffffff),
          transparent: material.transparent ?? false,
          opacity: material.opacity ?? 1,
          side: material.side ?? THREE.FrontSide,
        });

        cache.set(material.name, standardMaterial);
        return standardMaterial;
      })());
    }

    pending.push(Promise.all(replacements).then((resolved) => {
      node.material = Array.isArray(node.material) ? resolved : resolved[0];
      node.castShadow = true;
      node.receiveShadow = true;
    }));
  });

  await Promise.all(pending);
}

function sanitizeScene(root, sourceFile) {
  root.name = path.basename(sourceFile, path.extname(sourceFile));

  root.traverse((node) => {
    if (node.isMesh) {
      node.frustumCulled = true;
      if (node.geometry) {
        node.geometry.computeBoundingBox();
        node.geometry.computeBoundingSphere();
      }
    }
  });
}

async function exportGlb(root, outputFile) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: true,
    trs: false,
    maxTextureSize: 2048,
  });

  await fs.writeFile(outputFile, Buffer.from(arrayBuffer));
}

async function convertFile(loader, sourceFile) {
  const relativePath = path.relative(path.resolve(sourceRoot), sourceFile);
  const outputFile = path.join(path.resolve(outputRoot), relativePath).replace(/\.fbx$/i, '.glb');

  await ensureDir(path.dirname(outputFile));

  const object = await loader.loadAsync(pathToFileURL(sourceFile).href);
  await remapMaterials(object);
  sanitizeScene(object, sourceFile);
  await exportGlb(object, outputFile);

  return outputFile;
}

async function main() {
  await buildTextureMap();
  await ensureDir(path.resolve(outputRoot));

  const loader = new FBXLoader();
  const sourceFiles = await getFilesRecursive(path.resolve(sourceRoot), '.fbx');
  const converted = [];

  for (const sourceFile of sourceFiles) {
    const outputFile = await convertFile(loader, sourceFile);
    converted.push(outputFile);
    console.log(`Converted ${path.relative(process.cwd(), sourceFile)} -> ${path.relative(process.cwd(), outputFile)}`);
  }

  console.log(`Done. Converted ${converted.length} FBX files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
