import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'supabase', 'migrations', '20260519225000_baseline_game_persistence.sql');

dotenv.config({ path: path.join(repoRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(repoRoot, '.env.migration.local'), quiet: true });

const tables = [
  {
    name: 'agent_json_state',
    columns: ['state_key', 'payload', 'updated_at'],
    jsonb: new Set(['payload']),
    orderBy: 'state_key',
    conflict: ['state_key']
  },
  {
    name: 'world_snapshots',
    columns: ['world_key', 'layout', 'updated_at', 'version'],
    jsonb: new Set(['layout']),
    orderBy: 'world_key',
    conflict: ['world_key']
  },
  {
    name: 'world_snapshot_backups',
    columns: ['id', 'world_key', 'layout', 'layout_hash', 'source_version', 'captured_at', 'backup_kind'],
    jsonb: new Set(['layout']),
    orderBy: 'id',
    conflict: ['id']
  },
  {
    name: 'stock_market_snapshots',
    columns: ['world_key', 'snapshot', 'updated_at'],
    jsonb: new Set(['snapshot']),
    orderBy: 'world_key',
    conflict: ['world_key']
  },
  {
    name: 'player_snapshots',
    columns: ['world_key', 'player_id', 'snapshot', 'updated_at', 'expires_at'],
    jsonb: new Set(['snapshot']),
    orderBy: 'world_key, player_id',
    conflict: ['world_key', 'player_id']
  }
];

function createPool(connectionString) {
  if (!connectionString) {
    throw new Error('Missing database connection string.');
  }

  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');
  return new pg.Pool({
    connectionString,
    ssl: sslMode && sslMode !== 'disable' ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 10000
  });
}

function quoted(name) {
  return pg.escapeIdentifier(name);
}

function upsertSql(table) {
  const columns = table.columns.map(quoted).join(', ');
  const values = table.columns.map((column, index) => (
    table.jsonb.has(column) ? `$${index + 1}::jsonb` : `$${index + 1}`
  )).join(', ');
  const conflict = table.conflict.map(quoted).join(', ');
  const updates = table.columns
    .filter((column) => !table.conflict.includes(column))
    .map((column) => `${quoted(column)} = excluded.${quoted(column)}`)
    .join(', ');

  return `insert into public.${quoted(table.name)} (${columns}) values (${values}) on conflict (${conflict}) do update set ${updates}`;
}

function rowValues(table, row) {
  return table.columns.map((column) => (
    table.jsonb.has(column) ? JSON.stringify(row[column]) : row[column]
  ));
}

function normalize(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])])
    );
  }

  return value;
}

function stable(row) {
  return JSON.stringify(normalize(row));
}

function rowKey(table, row) {
  return table.conflict.map((column) => String(row[column])).join('\u0000');
}

async function readSourceSnapshot(sourceClient) {
  const sourceData = new Map();
  for (const table of tables) {
    const result = await sourceClient.query(
      `select ${table.columns.map(quoted).join(', ')} from public.${quoted(table.name)} order by ${table.orderBy}`
    );
    sourceData.set(table.name, result.rows);
  }
  return sourceData;
}

async function applySnapshot(targetClient, sourceData) {
  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await targetClient.query(schemaSql);

  for (const table of tables) {
    const rows = sourceData.get(table.name) ?? [];
    const seenKeys = new Set(rows.map((row) => rowKey(table, row)));
    const sql = upsertSql(table);

    for (const row of rows) {
      await targetClient.query(sql, rowValues(table, row));
    }

    const targetRows = await targetClient.query(
      `select ${table.conflict.map(quoted).join(', ')} from public.${quoted(table.name)}`
    );
    for (const row of targetRows.rows) {
      if (seenKeys.has(rowKey(table, row))) {
        continue;
      }

      const where = table.conflict.map((column, index) => `${quoted(column)} = $${index + 1}`).join(' and ');
      await targetClient.query(
        `delete from public.${quoted(table.name)} where ${where}`,
        table.conflict.map((column) => row[column])
      );
    }
  }

  await targetClient.query(`
    select setval(
      pg_get_serial_sequence('public.world_snapshot_backups', 'id'),
      coalesce((select max(id) from public.world_snapshot_backups), 1),
      (select max(id) is not null from public.world_snapshot_backups)
    )
  `);
}

async function verifySnapshot(targetPool, sourceData) {
  const verification = [];
  for (const table of tables) {
    const targetRows = await targetPool.query(
      `select ${table.columns.map(quoted).join(', ')} from public.${quoted(table.name)} order by ${table.orderBy}`
    );
    const sourceRows = sourceData.get(table.name) ?? [];
    const sourceStable = sourceRows.map(stable);
    const targetStable = targetRows.rows.map(stable);

    verification.push({
      table: table.name,
      sourceRows: sourceRows.length,
      targetRows: targetRows.rows.length,
      snapshotMatch: sourceStable.length === targetStable.length
        && sourceStable.every((entry, index) => entry === targetStable[index])
    });
  }
  return verification;
}

const sourceUrl = process.env.RENDER_DATABASE_URL;
const targetUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const verifyOnly = process.argv.includes('--verify-only');

const source = createPool(sourceUrl);
const target = createPool(targetUrl);

try {
  let sourceData;
  if (verifyOnly) {
    const sourceClient = await source.connect();
    try {
      await sourceClient.query('begin isolation level repeatable read read only');
      sourceData = await readSourceSnapshot(sourceClient);
      await sourceClient.query('commit');
    } catch (error) {
      await sourceClient.query('rollback').catch(() => {});
      throw error;
    } finally {
      sourceClient.release();
    }
  } else {
    const sourceClient = await source.connect();
    const targetClient = await target.connect();
    try {
      await sourceClient.query('begin isolation level repeatable read read only');
      sourceData = await readSourceSnapshot(sourceClient);
      await targetClient.query('begin');
      await applySnapshot(targetClient, sourceData);
      await targetClient.query('commit');
      await sourceClient.query('commit');
    } catch (error) {
      await targetClient.query('rollback').catch(() => {});
      await sourceClient.query('rollback').catch(() => {});
      throw error;
    } finally {
      sourceClient.release();
      targetClient.release();
    }
  }

  const verification = await verifySnapshot(target, sourceData);
  console.log(JSON.stringify({
    ok: verification.every((entry) => entry.snapshotMatch),
    mode: verifyOnly ? 'verify-only' : 'sync',
    verification
  }, null, 2));
} finally {
  await source.end();
  await target.end();
}
