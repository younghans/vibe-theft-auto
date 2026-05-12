import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const AGENT_STATE_TABLE = 'agent_json_state';

let agentStatePool = null;
let agentStateInitialized = false;
let agentStateInitializationPromise = null;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
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

function getAgentStatePool() {
  if (!agentStatePool) {
    const connectionString = String(process.env.DATABASE_URL ?? '').trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for Postgres-backed agent state.');
    }

    agentStatePool = new Pool({
      connectionString,
      ssl: getDatabaseSslConfig(connectionString) ?? undefined
    });
  }

  return agentStatePool;
}

async function ensureAgentStateTable(client = getAgentStatePool()) {
  if (agentStateInitialized) {
    return;
  }

  if (!agentStateInitializationPromise) {
    agentStateInitializationPromise = client.query(`
      CREATE TABLE IF NOT EXISTS ${AGENT_STATE_TABLE} (
        state_key text PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `).then(() => {
      agentStateInitialized = true;
    }).finally(() => {
      agentStateInitializationPromise = null;
    });
  }

  await agentStateInitializationPromise;
}

export function shouldUsePostgresAgentState({
  filePath = '',
  defaultFilePath = '',
  filePathConfigured = false
} = {}) {
  const configuredStore = String(process.env.AGENT_STATE_STORE ?? '').trim().toLowerCase();
  if (configuredStore === 'file') {
    return false;
  }

  if (filePathConfigured) {
    return false;
  }

  const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    return false;
  }

  return path.resolve(filePath) === path.resolve(defaultFilePath);
}

export async function readPostgresAgentState(stateKey, fallbackState = {}) {
  const pool = getAgentStatePool();
  await ensureAgentStateTable(pool);

  await pool.query(
    `INSERT INTO ${AGENT_STATE_TABLE} (state_key, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (state_key) DO NOTHING`,
    [stateKey, JSON.stringify(fallbackState)]
  );

  const result = await pool.query(
    `SELECT payload FROM ${AGENT_STATE_TABLE} WHERE state_key = $1`,
    [stateKey]
  );

  return cloneJson(result.rows[0]?.payload ?? fallbackState);
}

export async function withPostgresAgentState(stateKey, fallbackState, mutator, {
  write = true
} = {}) {
  if (!write) {
    const state = await readPostgresAgentState(stateKey, fallbackState);
    return mutator(state);
  }

  const pool = getAgentStatePool();
  const client = await pool.connect();
  try {
    await ensureAgentStateTable(client);
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ${AGENT_STATE_TABLE} (state_key, payload)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (state_key) DO NOTHING`,
      [stateKey, JSON.stringify(fallbackState)]
    );
    const result = await client.query(
      `SELECT payload FROM ${AGENT_STATE_TABLE} WHERE state_key = $1 FOR UPDATE`,
      [stateKey]
    );
    const state = cloneJson(result.rows[0]?.payload ?? fallbackState);
    const mutationResult = await mutator(state);
    await client.query(
      `UPDATE ${AGENT_STATE_TABLE}
       SET payload = $2::jsonb, updated_at = NOW()
       WHERE state_key = $1`,
      [stateKey, JSON.stringify(state)]
    );
    await client.query('COMMIT');
    return mutationResult;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
