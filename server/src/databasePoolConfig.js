const DEFAULT_DATABASE_POOL_MAX = 2;
const DEFAULT_DATABASE_POOL_IDLE_TIMEOUT_MS = 30000;
const DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS = 10000;

function getPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getDatabaseSslConfig(connectionString) {
  try {
    const sslMode = new URL(connectionString).searchParams.get('sslmode')?.trim().toLowerCase();
    if (!sslMode || sslMode === 'disable') {
      return null;
    }

    if (sslMode === 'no-verify' || sslMode === 'require') {
      return { rejectUnauthorized: false };
    }
  } catch {
    return null;
  }

  return null;
}

export function getDatabasePoolConfig(connectionString) {
  return {
    connectionString,
    ssl: getDatabaseSslConfig(connectionString) ?? undefined,
    max: getPositiveIntegerEnv('DATABASE_POOL_MAX', DEFAULT_DATABASE_POOL_MAX),
    idleTimeoutMillis: getPositiveIntegerEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', DEFAULT_DATABASE_POOL_IDLE_TIMEOUT_MS),
    connectionTimeoutMillis: getPositiveIntegerEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', DEFAULT_DATABASE_POOL_CONNECTION_TIMEOUT_MS)
  };
}
