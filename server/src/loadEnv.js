import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

for (const candidate of ['.env.local', '.env']) {
  const envPath = path.join(projectRoot, candidate);
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[env] Could not load ${candidate}: ${error.message}`);
    }
  }
}
