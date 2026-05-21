import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { projectMoveOnCamera } from '../src/player/createPlayer.js';

const root = process.cwd();
const gameSource = fs.readFileSync(`${root}/src/game/Game.js`, 'utf8');
const inputSource = fs.readFileSync(`${root}/src/game/Input.js`, 'utf8');
const colyseusSource = fs.readFileSync(`${root}/src/npc/NpcServiceColyseus.js`, 'utf8');
const mockSource = fs.readFileSync(`${root}/src/npc/NpcServiceMock.js`, 'utf8');
const playerSource = fs.readFileSync(`${root}/src/player/createPlayer.js`, 'utf8');
const rendererSource = fs.readFileSync(`${root}/src/world/WorldRenderer.js`, 'utf8');
const worldRoomSource = fs.readFileSync(`${root}/server/src/WorldRoom.js`, 'utf8');

function assertNearlyEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= 0.000001, `${message}: expected ${expected}, got ${actual}`);
}

const shiftedCamera = new THREE.PerspectiveCamera(55, 1, 0.5, 400);
shiftedCamera.position.set(8, 26, 18);
shiftedCamera.lookAt(new THREE.Vector3(0, 3, 0));
shiftedCamera.updateMatrixWorld(true);

const stableCameraForward = new THREE.Vector3(0, 0, 1);
const projectedRight = projectMoveOnCamera(
  shiftedCamera,
  { x: 1, z: 0 },
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  stableCameraForward
);
assertNearlyEqual(projectedRight.x, 1, 'horizontal movement should stay on the world X axis with a shifted camera');
assertNearlyEqual(projectedRight.z, 0, 'horizontal movement should not drift down the world Z axis with a shifted camera');

const projectedForwardRight = projectMoveOnCamera(
  shiftedCamera,
  { x: 1, z: -1 },
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  stableCameraForward
);
const diagonalComponent = 1 / Math.sqrt(2);
assertNearlyEqual(projectedForwardRight.x, diagonalComponent, 'diagonal movement should preserve normalized X travel');
assertNearlyEqual(projectedForwardRight.z, -diagonalComponent, 'diagonal movement should preserve normalized Z travel');

const firstPersonLookForward = new THREE.Vector3(0, 0, 1);
const firstPersonMovementCameraForward = firstPersonLookForward.clone().multiplyScalar(-1);
const projectedFirstPersonForward = projectMoveOnCamera(
  shiftedCamera,
  { x: 0, z: -1 },
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
  firstPersonMovementCameraForward
);
assertNearlyEqual(projectedFirstPersonForward.x, firstPersonLookForward.x, 'first-person W should follow the look direction on X');
assertNearlyEqual(projectedFirstPersonForward.z, firstPersonLookForward.z, 'first-person W should follow the look direction on Z');
assert.match(
  gameSource,
  /getFirstPersonMovementForward\(target = this\.firstPersonMovementForward\)\s*{\s*return this\.getFirstPersonHorizontalDirection\(target\)\.multiplyScalar\(-1\);/,
  'first-person movement should pass camera-back direction so W moves along the look direction'
);

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
