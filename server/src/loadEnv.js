import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
const region = String(process.env.REGION ?? '').trim();

const loadedEnvPaths = new Set();

function loadEnvPath(envPath, { override = false } = {}) {
  const resolvedEnvPath = envPath ? path.resolve(envPath) : '';
  if (!resolvedEnvPath || loadedEnvPaths.has(resolvedEnvPath)) {
    return false;
  }

  if (!existsSync(resolvedEnvPath)) {
    return false;
  }

  const result = dotenv.config({
    path: resolvedEnvPath,
    override,
    quiet: true
  });

  loadedEnvPaths.add(resolvedEnvPath);
  if (result.error) {
    console.warn(`[env] Could not load ${path.basename(resolvedEnvPath)}: ${result.error.message}`);
    return false;
  }

  return true;
}

function loadEnvFile(candidate, options = {}) {
  return loadEnvPath(path.join(projectRoot, candidate), options);
}

const candidates = nodeEnv === 'production'
  ? [
      region ? `.env.${region}.production` : '',
      '.env.production',
      '.env'
    ]
  : [
      '.env.local',
      '.env'
    ];

for (const candidate of candidates.filter(Boolean)) {
  loadEnvFile(candidate);
}

if (process.env.COLYSEUS_CLOUD !== undefined) {
  const cloudEnvPaths = [
    process.env.APP_ROOT_PATH ? path.join(process.env.APP_ROOT_PATH, '.env.cloud') : '',
    path.resolve(projectRoot, '..', 'current', '.env.cloud'),
    path.resolve(process.cwd(), '..', 'current', '.env.cloud'),
    path.join(projectRoot, '.env.cloud'),
    path.resolve(process.cwd(), '.env.cloud')
  ].filter(Boolean);

  for (const envPath of cloudEnvPaths) {
    loadEnvPath(envPath, { override: true });
  }
}
