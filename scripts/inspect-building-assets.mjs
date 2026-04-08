import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDER_TILE_SIZE } from '../src/shared/worldConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const TARGET_FOOTPRINT = BUILDER_TILE_SIZE * 0.82;

const DEFAULT_REFERENCE_FILES = [
  'assets/stickrpg_custom/models/bar-building-wide.glb',
  'assets/stickrpg_custom/models/hospital-building.glb',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_A.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_B.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_C.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_D.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_E.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_F.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_G.gltf',
  'assets/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/building_H.gltf',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-a.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-b.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-c.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-d.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-e.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-f.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-g.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-h.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-skyscraper-a.glb',
  'assets/kenney_city-kit-commercial_2.1/Models/GLB format/building-skyscraper-b.glb'
];

function usage() {
  console.log([
    'Inspect custom and reference building assets.',
    '',
    'Usage:',
    '  npm run inspect:buildings',
    '  npm run inspect:buildings -- assets/stickrpg_custom/models/my-building.glb',
    ''
  ].join('\n'));
}

function resolveInputFiles(args) {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  if (!args.length) {
    return DEFAULT_REFERENCE_FILES.map((file) => path.resolve(repoRoot, file));
  }

  return args.map((file) => path.resolve(repoRoot, file));
}

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  const magic = buffer.toString('utf8', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`Expected GLB file: ${filePath}`);
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version ${version}: ${filePath}`);
  }

  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.toString('utf8', 16, 20);
  if (jsonChunkType !== 'JSON') {
    throw new Error(`Missing JSON chunk: ${filePath}`);
  }

  const jsonText = buffer.toString('utf8', 20, 20 + jsonChunkLength);
  return JSON.parse(jsonText);
}

function readGltf(filePath) {
  if (filePath.toLowerCase().endsWith('.glb')) {
    return readGlbJson(filePath);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getFamilyLabel(filePath) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  if (relativePath.includes('stickrpg_custom')) return 'custom';
  if (relativePath.includes('KayKit')) return 'kaykit';
  if (relativePath.includes('kenney')) return 'kenney';
  return 'other';
}

function round(value) {
  return Number(value.toFixed(2));
}

function inspectAsset(filePath) {
  const json = readGltf(filePath);
  let min = null;
  let max = null;
  let primitiveCount = 0;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitiveCount += 1;
      const accessor = json.accessors?.[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) {
        continue;
      }

      if (!min) {
        min = [...accessor.min];
        max = [...accessor.max];
        continue;
      }

      for (let index = 0; index < 3; index += 1) {
        min[index] = Math.min(min[index], accessor.min[index]);
        max[index] = Math.max(max[index], accessor.max[index]);
      }
    }
  }

  if (!min || !max) {
    throw new Error(`Could not determine POSITION bounds: ${filePath}`);
  }

  const width = max[0] - min[0];
  const height = max[1] - min[1];
  const depth = max[2] - min[2];
  const fitScale = Math.min(
    width > 0 ? TARGET_FOOTPRINT / width : 1,
    depth > 0 ? TARGET_FOOTPRINT / depth : 1
  );

  return {
    family: getFamilyLabel(filePath),
    file: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
    width: round(width),
    height: round(height),
    depth: round(depth),
    fitScale: round(fitScale),
    renderedHeight: round(height * fitScale),
    materials: json.materials?.length ?? 0,
    meshes: json.meshes?.length ?? 0,
    primitives: primitiveCount
  };
}

function summarizeFamily(rows) {
  const families = new Map();

  for (const row of rows) {
    const familyRows = families.get(row.family) ?? [];
    familyRows.push(row);
    families.set(row.family, familyRows);
  }

  const summaries = [];

  for (const [family, familyRows] of families.entries()) {
    const renderedHeights = familyRows.map((row) => row.renderedHeight);
    const meshCounts = familyRows.map((row) => row.meshes);
    summaries.push({
      family,
      count: familyRows.length,
      minRenderedHeight: round(Math.min(...renderedHeights)),
      maxRenderedHeight: round(Math.max(...renderedHeights)),
      avgRenderedHeight: round(renderedHeights.reduce((sum, value) => sum + value, 0) / familyRows.length),
      maxMeshes: Math.max(...meshCounts)
    });
  }

  return summaries;
}

function main() {
  const files = resolveInputFiles(process.argv.slice(2));
  const missing = files.filter((file) => !fs.existsSync(file));

  if (missing.length) {
    console.error('Missing files:');
    for (const file of missing) {
      console.error(`- ${path.relative(repoRoot, file)}`);
    }
    process.exit(1);
  }

  const rows = files.map(inspectAsset);
  console.log(`Target lot footprint: ${TARGET_FOOTPRINT.toFixed(2)} x ${TARGET_FOOTPRINT.toFixed(2)}`);
  console.log('');
  console.table(rows);
  console.log('Family summary:');
  console.table(summarizeFamily(rows));
}

main();
