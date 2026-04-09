import process from 'node:process';
import pg from 'pg';

for (const candidate of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(candidate);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[world-copy] Could not load ${candidate}: ${error.message}`);
    }
  }
}

const [, , sourceWorldKey, targetWorldKey] = process.argv;
const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();

if (!databaseUrl) {
  console.error('[world-copy] DATABASE_URL is required.');
  process.exit(1);
}

if (!sourceWorldKey || !targetWorldKey) {
  console.error('[world-copy] Usage: node scripts/copy-world-snapshot.mjs <source-world-key> <target-world-key>');
  process.exit(1);
}

if (sourceWorldKey === targetWorldKey) {
  console.error('[world-copy] Source and target world keys must be different.');
  process.exit(1);
}

function getDatabaseSslConfig(connectionString) {
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

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: getDatabaseSslConfig(databaseUrl) ?? undefined
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS world_snapshots (
      world_key text PRIMARY KEY,
      layout jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      version bigint NOT NULL DEFAULT 1
    )
  `);

  const sourceResult = await pool.query(
    'SELECT layout FROM world_snapshots WHERE world_key = $1',
    [sourceWorldKey]
  );

  if (!sourceResult.rows.length) {
    console.error(`[world-copy] Source world "${sourceWorldKey}" was not found.`);
    process.exit(1);
  }

  await pool.query(
    `
      INSERT INTO world_snapshots (world_key, layout, updated_at, version)
      VALUES ($1, $2::jsonb, NOW(), 1)
      ON CONFLICT (world_key) DO UPDATE
      SET layout = EXCLUDED.layout,
          updated_at = NOW(),
          version = world_snapshots.version + 1
    `,
    [targetWorldKey, JSON.stringify(sourceResult.rows[0].layout)]
  );

  console.info(`[world-copy] Copied world snapshot from "${sourceWorldKey}" to "${targetWorldKey}".`);
} finally {
  await pool.end();
}
