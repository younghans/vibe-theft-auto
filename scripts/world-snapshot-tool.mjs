import process from 'node:process';
import pg from 'pg';
import { getBuilderItemById } from '../src/world/builderCatalog.js';

for (const candidate of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(candidate);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[world-tool] Could not load ${candidate}: ${error.message}`);
    }
  }
}

const [, , command, ...args] = process.argv;
const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();

if (!databaseUrl) {
  console.error('[world-tool] DATABASE_URL is required.');
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

function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getPlacementItem(placement) {
  if (!placement?.itemId) {
    return null;
  }
  return getBuilderItemById(placement.itemId);
}

function placementBlocksMovement(placement) {
  return Boolean(getPlacementItem(placement)?.blocksMovement);
}

function placementSummary(placement) {
  const item = getPlacementItem(placement);
  return {
    id: placement.id,
    layer: placement.layer,
    itemId: placement.itemId,
    cell: placement.cell ?? null,
    position: placement.position ?? null,
    rotationQuarterTurns: placement.rotationQuarterTurns ?? 0,
    blocksMovement: item?.blocksMovement ?? false,
    blocksShots: item?.blocksShots ?? false,
    hasMovementRects: Boolean(item?.movementCollisionRects?.length),
    hasShotRects: Boolean(item?.shotCollisionRects?.length)
  };
}

async function loadWorldSnapshot(pool, worldKey) {
  const result = await pool.query(
    'SELECT layout, updated_at, version FROM world_snapshots WHERE world_key = $1',
    [worldKey]
  );

  if (!result.rows.length) {
    console.error(`[world-tool] World "${worldKey}" was not found.`);
    process.exit(1);
  }

  return result.rows[0];
}

function flattenLayout(layout = {}) {
  return [
    ...(layout.tiles ?? []).map((placement) => ({ ...placement, layer: 'tile' })),
    ...(layout.props ?? []).map((placement) => ({ ...placement, layer: 'prop' })),
    ...(layout.npcs ?? []).map((placement) => ({ ...placement, layer: 'npc' }))
  ];
}

function inspectAroundOrigin(layout, radiusCells = 2, radiusWorld = 28) {
  const allPlacements = flattenLayout(layout);
  const tiles = allPlacements
    .filter((placement) =>
      placement.layer === 'tile'
      && Array.isArray(placement.cell)
      && Math.abs(placement.cell[0]) <= radiusCells
      && Math.abs(placement.cell[1]) <= radiusCells
    )
    .map(placementSummary);

  const props = allPlacements
    .filter((placement) =>
      placement.layer === 'prop'
      && Array.isArray(placement.position)
      && Math.abs(placement.position[0]) <= radiusWorld
      && Math.abs(placement.position[1]) <= radiusWorld
    )
    .map(placementSummary);

  const npcs = allPlacements
    .filter((placement) =>
      placement.layer === 'npc'
      && Array.isArray(placement.position)
      && Math.abs(placement.position[0]) <= radiusWorld
      && Math.abs(placement.position[1]) <= radiusWorld
    )
    .map(placementSummary);

  const blockers = [...tiles, ...props].filter((placement) => placement.blocksMovement);
  return { tiles, props, npcs, blockers };
}

async function inspectCommand(pool, worldKey, radiusCellsArg, radiusWorldArg) {
  const snapshot = await loadWorldSnapshot(pool, worldKey);
  const radiusCells = Math.max(0, Math.floor(toNumber(radiusCellsArg, 2)));
  const radiusWorld = Math.max(0, toNumber(radiusWorldArg, radiusCells * 14));
  const inspection = inspectAroundOrigin(snapshot.layout, radiusCells, radiusWorld);

  console.log(JSON.stringify({
    worldKey,
    updatedAt: snapshot.updated_at,
    version: snapshot.version,
    radiusCells,
    radiusWorld,
    ...inspection
  }, null, 2));
}

async function removePlacementCommand(pool, worldKey, placementId) {
  if (!placementId) {
    console.error('[world-tool] Usage: node scripts/world-snapshot-tool.mjs remove-placement <world-key> <placement-id>');
    process.exit(1);
  }

  const snapshot = await loadWorldSnapshot(pool, worldKey);
  const layout = structuredClone(snapshot.layout ?? { tiles: [], props: [], npcs: [] });
  const before = flattenLayout(layout);
  const placement = before.find((entry) => entry.id === placementId);

  if (!placement) {
    console.error(`[world-tool] Placement "${placementId}" was not found in world "${worldKey}".`);
    process.exit(1);
  }

  layout.tiles = (layout.tiles ?? []).filter((entry) => entry.id !== placementId);
  layout.props = (layout.props ?? []).filter((entry) => entry.id !== placementId);
  layout.npcs = (layout.npcs ?? []).filter((entry) => entry.id !== placementId);

  await pool.query(
    `
      INSERT INTO world_snapshots (world_key, layout, updated_at, version)
      VALUES ($1, $2::jsonb, NOW(), 1)
      ON CONFLICT (world_key) DO UPDATE
      SET layout = EXCLUDED.layout,
          updated_at = NOW(),
          version = world_snapshots.version + 1
    `,
    [worldKey, JSON.stringify(layout)]
  );

  console.info(`[world-tool] Removed placement "${placementId}" from world "${worldKey}".`);
  console.info(JSON.stringify(placementSummary(placement), null, 2));
}

if (!command || command === '--help' || command === '-h') {
  console.log('Usage:');
  console.log('  node scripts/world-snapshot-tool.mjs inspect <world-key> [radius-cells] [radius-world]');
  console.log('  node scripts/world-snapshot-tool.mjs remove-placement <world-key> <placement-id>');
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: getDatabaseSslConfig(databaseUrl) ?? undefined
});

try {
  if (command === 'inspect') {
    const [worldKey = process.env.WORLD_KEY || 'primary', radiusCellsArg, radiusWorldArg] = args;
    await inspectCommand(pool, worldKey, radiusCellsArg, radiusWorldArg);
  } else if (command === 'remove-placement') {
    const [worldKey = process.env.WORLD_KEY || 'primary', placementId] = args;
    await removePlacementCommand(pool, worldKey, placementId);
  } else {
    console.error(`[world-tool] Unknown command "${command}".`);
    process.exit(1);
  }
} finally {
  await pool.end();
}
