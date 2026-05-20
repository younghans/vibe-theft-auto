import assert from 'node:assert/strict';
import {
  AccountSaveValidationError,
  normalizeAccountSaveSnapshot,
  validateAccountSaveSnapshot
} from '../server/src/playerAccounts.js';

const worldKey = 'primary';
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';

function createRawSnapshot(overrides = {}) {
  return {
    player: {
      x: 1,
      z: 2,
      rotationY: 0,
      health: 100,
      money: 42,
      characterId: 'ch01',
      ...overrides.player
    },
    stockPortfolio: {},
    stockPortfolios: {},
    ...overrides
  };
}

function assertValidationError(fn, message) {
  assert.throws(fn, AccountSaveValidationError, message);
}

const normalized = normalizeAccountSaveSnapshot(createRawSnapshot({
  ignoredTopLevelKey: 'removed by normalization'
}), {
  worldKey,
  userId,
  now: 1_763_000_000_000
});
const validation = validateAccountSaveSnapshot(normalized, { worldKey, userId });

assert.equal(normalized.version, 1);
assert.equal(normalized.worldKey, worldKey);
assert.equal(normalized.userId, userId);
assert.equal(normalized.playerId, `auth:${userId}`);
assert.equal(normalized.updatedAt, 1_763_000_000_000);
assert.equal(Object.hasOwn(normalized, 'ignoredTopLevelKey'), false);
assert.equal(typeof validation.json, 'string');
assert.ok(validation.byteLength > 0);

assertValidationError(() => normalizeAccountSaveSnapshot(createRawSnapshot({
  userId: otherUserId
}), {
  worldKey,
  userId
}), 'rejects mismatched user ids');

assertValidationError(() => normalizeAccountSaveSnapshot(createRawSnapshot({
  playerId: `auth:${otherUserId}`
}), {
  worldKey,
  userId
}), 'rejects mismatched player ids');

assertValidationError(() => normalizeAccountSaveSnapshot(createRawSnapshot({
  worldKey: 'staging'
}), {
  worldKey,
  userId
}), 'rejects mismatched world keys');

assertValidationError(() => validateAccountSaveSnapshot({
  ...normalized,
  extra: 'not allowed'
}, {
  worldKey,
  userId
}), 'rejects unsupported top-level keys');

assertValidationError(() => validateAccountSaveSnapshot({
  ...normalized,
  player: {
    x: 1,
    z: 2
  }
}, {
  worldKey,
  userId
}), 'rejects missing required player fields');

assertValidationError(() => validateAccountSaveSnapshot({
  ...normalized,
  player: {
    ...normalized.player,
    accessToken: 'do-not-save'
  }
}, {
  worldKey,
  userId
}), 'rejects secret-like keys');

assertValidationError(() => validateAccountSaveSnapshot({
  ...normalized,
  player: {
    ...normalized.player,
    notes: 'x'.repeat(140_000)
  }
}, {
  worldKey,
  userId
}), 'rejects oversized account saves');

console.log('Account save validation checks passed.');
