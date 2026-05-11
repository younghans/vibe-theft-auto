import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const distIndexPath = path.join(projectRoot, 'dist', 'index.html');
const colyseusToolsPackagePath = path.join(projectRoot, 'node_modules', '@colyseus', 'tools', 'package.json');

function runNpm(args, label) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, args, {
    cwd: projectRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function ensureHostedDependencies() {
  if (existsSync(colyseusToolsPackagePath)) {
    return;
  }

  console.warn('[startup] @colyseus/tools is missing from node_modules. Running `npm install --omit=dev` before starting the server.');
  runNpm(['install', '--omit=dev', '--no-audit', '--no-fund'], 'Production dependency install');
}

ensureHostedDependencies();

if (!existsSync(distIndexPath)) {
  console.warn('[startup] Frontend build artifacts are missing. Running `npm run build` before starting the server.');
  runNpm(['run', 'build'], 'Frontend build');
}

await import('./index.mjs');
