import assert from 'node:assert/strict';
import {
  getLayoutBackupHash,
  getRetainedWorldBackupEntries
} from '../server/src/worldPersistence.js';

const nowMs = Date.parse('2026-05-07T12:00:00.000Z');
const retentionConfig = {
  recentDays: 3,
  maxDailyDays: 10
};

const backupEntries = [
  { worldKey: 'primary', capturedAt: '2026-05-07T11:50:00.000Z', layoutHash: 'recent-primary' },
  { worldKey: 'primary', capturedAt: '2026-05-06T09:00:00.000Z', layoutHash: 'recent-primary-2' },
  { worldKey: 'primary', capturedAt: '2026-05-03T10:00:00.000Z', layoutHash: 'older-primary-latest' },
  { worldKey: 'primary', capturedAt: '2026-05-03T09:00:00.000Z', layoutHash: 'older-primary-earlier' },
  { worldKey: 'primary', capturedAt: '2026-04-20T09:00:00.000Z', layoutHash: 'too-old-primary' },
  { worldKey: 'staging', capturedAt: '2026-05-03T08:00:00.000Z', layoutHash: 'older-staging-latest' },
  { worldKey: 'staging', capturedAt: '2026-05-03T07:00:00.000Z', layoutHash: 'older-staging-earlier' },
  { worldKey: 'primary', capturedAt: 'not-a-date', layoutHash: 'malformed' }
];

const retainedHashes = new Set();
for (const entry of getRetainedWorldBackupEntries(backupEntries, retentionConfig, nowMs)) {
  retainedHashes.add(entry.layoutHash);
}

assert(retainedHashes.has('recent-primary'), 'recent backups should be retained');
assert(retainedHashes.has('recent-primary-2'), 'all backups inside the recent window should be retained');
assert(retainedHashes.has('older-primary-latest'), 'older backups should retain the latest entry per world per day');
assert(!retainedHashes.has('older-primary-earlier'), 'older backups should prune extra entries for the same day');
assert(retainedHashes.has('older-staging-latest'), 'daily pruning should be scoped per world');
assert(!retainedHashes.has('older-staging-earlier'), 'older same-day backups should prune per world');
assert(!retainedHashes.has('too-old-primary'), 'backups older than the max daily window should be pruned');
assert(!retainedHashes.has('malformed'), 'malformed backup index entries should not be retained');

const retainedWithoutMax = new Set();
for (const entry of getRetainedWorldBackupEntries(
  backupEntries,
  { ...retentionConfig, maxDailyDays: 0 },
  nowMs
)) {
  retainedWithoutMax.add(entry.layoutHash);
}
assert(retainedWithoutMax.has('too-old-primary'), 'maxDailyDays=0 should keep daily backups without a max age');

const layoutA = {
  tiles: [],
  props: [{ id: 'bank', x: 1, y: 0, z: 2 }],
  npcs: []
};
const layoutB = structuredClone(layoutA);
const layoutC = {
  ...layoutA,
  props: [{ id: 'bank', x: 1, y: 0, z: 3 }]
};

assert.equal(getLayoutBackupHash(layoutA), getLayoutBackupHash(layoutB), 'equal layouts should hash the same');
assert.notEqual(getLayoutBackupHash(layoutA), getLayoutBackupHash(layoutC), 'changed layouts should hash differently');

console.log('World backup validation passed.');
