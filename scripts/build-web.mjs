import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dist = path.join(root, 'dist');

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

await resetDist();

await copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await copyFile(path.join(root, 'styles.css'), path.join(dist, 'styles.css'));
await copyFile(path.join(root, 'favicon.ico'), path.join(dist, 'favicon.ico'));
await copyDirectory(path.join(root, 'src'), path.join(dist, 'src'));
await copyDirectory(path.join(root, 'vendor'), path.join(dist, 'vendor'));
await copyDirectory(path.join(root, 'assets', 'KayKit_City_Builder_Bits_1.0_FREE'), path.join(dist, 'assets', 'KayKit_City_Builder_Bits_1.0_FREE'));
await copyDirectory(path.join(root, 'assets', 'PolygonStarter-web'), path.join(dist, 'assets', 'PolygonStarter-web'));

console.log(`Built static app into ${dist}`);