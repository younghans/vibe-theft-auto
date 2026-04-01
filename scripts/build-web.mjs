import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');
const KAYKIT_CITY_MODELS = [
  'base',
  'bench',
  'box_A',
  'box_B',
  'bush',
  'building_A',
  'building_A_withoutBase',
  'building_B',
  'building_B_withoutBase',
  'building_C',
  'building_C_withoutBase',
  'building_D',
  'building_D_withoutBase',
  'building_E',
  'building_E_withoutBase',
  'building_F',
  'building_F_withoutBase',
  'building_G',
  'building_G_withoutBase',
  'building_H',
  'building_H_withoutBase',
  'car_hatchback',
  'car_police',
  'car_sedan',
  'car_stationwagon',
  'car_taxi',
  'dumpster',
  'firehydrant',
  'road_corner',
  'road_corner_curved',
  'road_junction',
  'road_straight',
  'road_straight_crossing',
  'road_tsplit',
  'streetlight',
  'trafficlight_A',
  'trafficlight_B',
  'trafficlight_C',
  'trash_A',
  'trash_B',
  'watertower'
];

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

async function copyKayKitCityBits() {
  const sourceRoot = path.join(root, 'assets', 'KayKit_City_Builder_Bits_1.0_FREE');
  const targetRoot = path.join(dist, 'assets', 'KayKit_City_Builder_Bits_1.0_FREE');
  const sourceGltf = path.join(sourceRoot, 'Assets', 'gltf');
  const targetGltf = path.join(targetRoot, 'Assets', 'gltf');

  await copyFile(path.join(sourceRoot, 'License.txt'), path.join(targetRoot, 'License.txt'));
  await copyFile(path.join(sourceGltf, 'citybits_texture.png'), path.join(targetGltf, 'citybits_texture.png'));

  for (const modelName of KAYKIT_CITY_MODELS) {
    await copyFile(path.join(sourceGltf, `${modelName}.gltf`), path.join(targetGltf, `${modelName}.gltf`));
    await copyFile(path.join(sourceGltf, `${modelName}.bin`), path.join(targetGltf, `${modelName}.bin`));
  }
}

await resetDist();

await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await copyFile(path.join(root, 'styles.css'), path.join(dist, 'styles.css'));
await copyFile(path.join(root, 'favicon.ico'), path.join(dist, 'favicon.ico'));
await copyDirectory(path.join(root, 'src'), path.join(dist, 'src'));
await copyDirectory(path.join(root, 'vendor'), path.join(dist, 'vendor'));
await copyKayKitCityBits();
await copyDirectory(path.join(root, 'assets', 'PolygonStarter-web'), path.join(dist, 'assets', 'PolygonStarter-web'));
await copyDirectory(path.join(root, 'assets', 'mixamo'), path.join(dist, 'assets', 'mixamo'));

console.log(`Built static app into ${dist}`);
