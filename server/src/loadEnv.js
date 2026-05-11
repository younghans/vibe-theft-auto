import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
const region = String(process.env.REGION ?? '').trim();

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
  const envPath = path.join(projectRoot, candidate);
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[env] Could not load ${candidate}: ${error.message}`);
    }
  }
}
