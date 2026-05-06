import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distIndexPath = path.join(projectRoot, 'dist', 'index.html');

function runBuild() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'build'], {
    cwd: projectRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Frontend build failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

if (!existsSync(distIndexPath)) {
  console.warn('[startup] Frontend build artifacts are missing. Running `npm run build` before starting the server.');
  runBuild();
}

await import('./index.mjs');
