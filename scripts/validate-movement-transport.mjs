import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const gameSource = fs.readFileSync(`${root}/src/game/Game.js`, 'utf8');
const inputSource = fs.readFileSync(`${root}/src/game/Input.js`, 'utf8');
const colyseusSource = fs.readFileSync(`${root}/src/npc/NpcServiceColyseus.js`, 'utf8');
const mockSource = fs.readFileSync(`${root}/src/npc/NpcServiceMock.js`, 'utf8');
const playerSource = fs.readFileSync(`${root}/src/player/createPlayer.js`, 'utf8');
const rendererSource = fs.readFileSync(`${root}/src/world/WorldRenderer.js`, 'utf8');
const worldRoomSource = fs.readFileSync(`${root}/server/src/WorldRoom.js`, 'utf8');

assert.match(worldRoomSource, /transformSeq:\s*'number'/, 'server player transform schema should sync transform sequence numbers');
assert.match(worldRoomSource, /fields:\s*\[[^\]]*'transformSeq'/, 'transform state section should include transformSeq');
assert.match(worldRoomSource, /function normalizeTransformSeq/, 'server should normalize transform sequence values in one place');
assert.match(worldRoomSource, /Number\.isFinite\(numeric\)/, 'server transform sequence normalization should reject non-finite values');
assert.match(worldRoomSource, /message\.seq\s*\?\?\s*message\.transformSeq/, 'server should accept current and legacy transform sequence fields');
assert.match(worldRoomSource, /nextTransformSeq <= normalizeTransformSeq\(meta\.lastTransformSeq\)/, 'server should drop stale transform updates');

assert.match(colyseusSource, /function normalizeTransformSeq/, 'client transport should normalize authoritative transform sequence values');
assert.match(colyseusSource, /getLastTransformSeq/, 'client transport should expose the latest local transform sequence');
assert.match(colyseusSource, /next\.seq\s*=\s*transformSeq/, 'client transport should send transform sequence numbers');
assert.match(mockSource, /getLastTransformSeq/, 'mock transport should expose the latest local transform sequence');

assert.match(gameSource, /LOCAL_AUTHORITATIVE_MAX_TRANSFORM_SEQ_LAG/, 'game should guard local reconciliation against stale authoritative transforms');
assert.match(gameSource, /skipStaleAuthoritativePosition/, 'game should skip stale authoritative position samples');
assert.match(gameSource, /updateAdaptiveRenderQuality/, 'game should adapt render quality from frame timing');
assert.match(gameSource, /getNpcSpeechAnchorsForHud/, 'game should gather NPC HUD anchors once per frame');

assert.match(inputSource, /releaseAllInputs/, 'input should release held controls on blur and visibility changes');
assert.match(inputSource, /this\.movementVector/, 'input movement vector should reuse an output object');
assert.match(playerSource, /getAnimationSyncState\(target = \{\}\)/, 'player animation sync should support a reusable output object');
assert.match(rendererSource, /npcSpeechAnchorVectors/, 'world renderer should reuse NPC speech anchor vectors');
assert.match(rendererSource, /interactableCache/, 'world renderer should reuse placement interactable objects');

console.log('Movement transport validation passed.');
