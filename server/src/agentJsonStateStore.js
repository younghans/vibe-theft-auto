import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

export const AGENT_STATE_TABLE = 'agent_json_state';

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

export async function withPostgresAgentStateTransaction(operation) {
  const pool = getAgentStatePool();
  const client = await pool.connect();
  try {
    await ensureAgentStateTable(client);
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function getTaskNumberExpression(field) {
  return `COALESCE(NULLIF(task->>'${field}', '')::numeric, 0)`;
}

function getTaskActivityExpression() {
  return `GREATEST(
    ${getTaskNumberExpression('updatedAt')},
    ${getTaskNumberExpression('workCompletedAt')},
    ${getTaskNumberExpression('workStartedAt')},
    ${getTaskNumberExpression('deployStartedAt')},
    ${getTaskNumberExpression('deployedAt')},
    ${getTaskNumberExpression('rollbackStartedAt')},
    ${getTaskNumberExpression('rolledBackAt')},
    ${getTaskNumberExpression('deployApprovedAt')},
    ${getTaskNumberExpression('rollbackApprovedAt')},
    ${getTaskNumberExpression('claimedAt')},
    ${getTaskNumberExpression('createdAt')}
  )`;
}

function getProjectedAgentTaskJson({ includeMessages = false } = {}) {
  const baseFields = `
    'id', task->>'id',
    'type', COALESCE(task->>'type', 'code_change'),
    'threadId', COALESCE(NULLIF(task->>'threadId', ''), task->>'id'),
    'parentTaskId', COALESCE(task->>'parentTaskId', ''),
    'threadTitle', COALESCE(task->>'threadTitle', ''),
    'scope', COALESCE(NULLIF(task->>'scope', ''), 'game'),
    'gameId', COALESCE(task->>'gameId', ''),
    'contextType', COALESCE(NULLIF(task->>'contextType', ''), 'game'),
    'contextLabel', COALESCE(task->>'contextLabel', ''),
    'prompt', COALESCE(task->>'prompt', ''),
    'mode', COALESCE(NULLIF(task->>'mode', ''), 'preview'),
    'status', COALESCE(NULLIF(task->>'status', ''), 'queued'),
    'createdBy', COALESCE(task->>'createdBy', ''),
    'createdAt', ${getTaskNumberExpression('createdAt')},
    'updatedAt', ${getTaskNumberExpression('updatedAt')},
    'claimedBy', COALESCE(task->>'claimedBy', ''),
    'claimedAt', ${getTaskNumberExpression('claimedAt')},
    'workerHeartbeatAt', ${getTaskNumberExpression('workerHeartbeatAt')},
    'workerHeartbeatStatus', COALESCE(task->>'workerHeartbeatStatus', ''),
    'workStartedAt', ${getTaskNumberExpression('workStartedAt')},
    'workCompletedAt', ${getTaskNumberExpression('workCompletedAt')},
    'branch', COALESCE(task->>'branch', ''),
    'commitSha', COALESCE(task->>'commitSha', ''),
    'previewUrl', COALESCE(task->>'previewUrl', ''),
    'deployUrl', COALESCE(task->>'deployUrl', ''),
    'changedFiles', COALESCE(task->'changedFiles', '[]'::jsonb),
    'deployTargets', COALESCE(task->'deployTargets', '[]'::jsonb),
    'deployApprovedAt', ${getTaskNumberExpression('deployApprovedAt')},
    'deployApprovedBy', COALESCE(task->>'deployApprovedBy', ''),
    'deployStartedAt', ${getTaskNumberExpression('deployStartedAt')},
    'deployedAt', ${getTaskNumberExpression('deployedAt')},
    'previousDeployCommitSha', COALESCE(task->>'previousDeployCommitSha', ''),
    'newDeployCommitSha', COALESCE(task->>'newDeployCommitSha', ''),
    'rollbackApprovedAt', ${getTaskNumberExpression('rollbackApprovedAt')},
    'rollbackApprovedBy', COALESCE(task->>'rollbackApprovedBy', ''),
    'rollbackStartedAt', ${getTaskNumberExpression('rollbackStartedAt')},
    'rolledBackAt', ${getTaskNumberExpression('rolledBackAt')},
    'rollbackCommitSha', COALESCE(task->>'rollbackCommitSha', '')
  `;
  const messageFields = includeMessages
    ? `,
    'error', COALESCE(task->>'error', ''),
    'summary', COALESCE(task->>'summary', ''),
    'agentMessage', COALESCE(task->>'agentMessage', '')`
    : `,
    'error', COALESCE(task->>'error', '')`;

  return `jsonb_build_object(${baseFields}${messageFields})`;
}

export async function readPostgresAgentTaskThreadSummaries(stateKey, {
  fallbackState = { version: 1, tasks: [] },
  scope = '',
  gameId = '',
  limit = 10,
  offset = 0
} = {}) {
  const pool = getAgentStatePool();
  await ensureAgentStateTable(pool);
  await pool.query(
    `INSERT INTO ${AGENT_STATE_TABLE} (state_key, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (state_key) DO NOTHING`,
    [stateKey, JSON.stringify(fallbackState)]
  );

  const safeLimit = Math.max(1, Math.min(101, Math.trunc(Number(limit) || 10)));
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  const normalizedScope = String(scope ?? '').trim().toLowerCase();
  const normalizedGameId = String(gameId ?? '').trim();
  const result = await pool.query(`
    WITH raw_tasks AS (
      SELECT task
      FROM ${AGENT_STATE_TABLE}
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload->'tasks', '[]'::jsonb)) AS raw(task)
      WHERE state_key = $1
    ),
    filtered_tasks AS (
      SELECT
        task,
        COALESCE(NULLIF(task->>'threadId', ''), task->>'id') AS thread_id,
        ${getTaskNumberExpression('createdAt')} AS created_at,
        ${getTaskActivityExpression()} AS activity_at
      FROM raw_tasks
      WHERE ($2 = '' OR COALESCE(NULLIF(task->>'scope', ''), 'game') = $2)
        AND ($3 = '' OR COALESCE(task->>'gameId', '') = $3)
    ),
    ranked_tasks AS (
      SELECT
        task,
        activity_at,
        MAX(activity_at) OVER (PARTITION BY thread_id) AS thread_activity_at,
        ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at DESC) AS thread_rank
      FROM filtered_tasks
    )
    SELECT ${getProjectedAgentTaskJson()} AS task
    FROM ranked_tasks
    WHERE thread_rank = 1
    ORDER BY thread_activity_at DESC
    LIMIT $4 OFFSET $5
  `, [stateKey, normalizedScope, normalizedGameId, safeLimit, safeOffset]);

  return result.rows.map((row) => row.task).filter(Boolean);
}

export async function readPostgresAgentTaskThread(stateKey, {
  fallbackState = { version: 1, tasks: [] },
  taskId = ''
} = {}) {
  const pool = getAgentStatePool();
  await ensureAgentStateTable(pool);
  await pool.query(
    `INSERT INTO ${AGENT_STATE_TABLE} (state_key, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (state_key) DO NOTHING`,
    [stateKey, JSON.stringify(fallbackState)]
  );

  const result = await pool.query(`
    WITH raw_tasks AS (
      SELECT task
      FROM ${AGENT_STATE_TABLE}
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload->'tasks', '[]'::jsonb)) AS raw(task)
      WHERE state_key = $1
    ),
    selected_thread AS (
      SELECT COALESCE(NULLIF(task->>'threadId', ''), task->>'id') AS thread_id
      FROM raw_tasks
      WHERE task->>'id' = $2
      LIMIT 1
    )
    SELECT ${getProjectedAgentTaskJson({ includeMessages: true })} AS task
    FROM raw_tasks, selected_thread
    WHERE COALESCE(NULLIF(task->>'threadId', ''), task->>'id') = selected_thread.thread_id
    ORDER BY ${getTaskNumberExpression('createdAt')} ASC
  `, [stateKey, String(taskId ?? '').trim()]);

  return result.rows.map((row) => row.task).filter(Boolean);
}
