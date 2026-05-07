import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { assets } from '../src/world/assetManifest.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import {
  STANDING_DESK_COMPUTER_FOOTPRINT,
  createStandingDeskComputerVisual
} from '../src/world/proceduralProps.js';
import { EMOTES_BY_ID, TYPING_EMOTE_ID } from '../src/player/emotes.js';
import {
  SNATCH_WORKOUT_KIND,
  TYPING_WORKOUT_DURATION_MS,
  TYPING_WORKOUT_KIND,
  getWorkoutActivityConfig
} from '../src/game/workoutActivities.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getAssetPath(assetUrl) {
  return fileURLToPath(assetUrl);
}

function getBoundsForObject(root, name) {
  const object = root.getObjectByName(name);
  assert(object, `Missing required model node "${name}".`);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function validateBuilderDefinition() {
  const item = getBuilderItemById('standing_desk_computer');
  assert(item, 'Standing desk computer builder item is missing.');
  assert(item.layer === 'prop', 'Standing desk computer should be a prop.');
  assert(item.groupId === 'office', 'Standing desk computer should live in the office prop group.');
  assert(typeof item.createVisual === 'function', 'Standing desk computer should use a procedural visual.');
  assert(item.interactable?.workoutType === TYPING_EMOTE_ID, 'Standing desk computer should start the typing workout.');
  assert(item.interactable?.hideDuringWorkout === false, 'Standing desk computer should remain visible while in use.');
  assert(Array.isArray(item.interactable?.approachLocalOffset), 'Standing desk computer needs an approach offset.');
  assert(Number.isFinite(item.interactable?.approachRotationY), 'Standing desk computer needs an approach facing.');
}

function validateDeskModel() {
  const visual = createStandingDeskComputerVisual();
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());

  assert(size.x >= 3.8 && size.x <= STANDING_DESK_COMPUTER_FOOTPRINT[0] + 0.05, 'Standing desk width is outside the footprint.');
  assert(size.z >= 2.1 && size.z <= STANDING_DESK_COMPUTER_FOOTPRINT[1] + 0.05, 'Standing desk depth is outside the footprint.');
  assert(size.y >= 3.9 && size.y <= 4.5, 'Standing desk computer height should fit the player scale.');

  const desktopBounds = getBoundsForObject(visual, 'standingDeskDesktop');
  const monitorBounds = getBoundsForObject(visual, 'standingDeskMonitor');
  const screenBounds = getBoundsForObject(visual, 'standingDeskScreen');
  const keyboardBounds = getBoundsForObject(visual, 'standingDeskKeyboard');
  const mouseBounds = getBoundsForObject(visual, 'standingDeskMouse');

  assert(monitorBounds.min.y > desktopBounds.max.y, 'Monitor should sit above the desktop.');
  assert(screenBounds.min.y > desktopBounds.max.y, 'Screen should sit above the desktop.');
  assert(keyboardBounds.min.y >= desktopBounds.max.y - 0.02, 'Keyboard should sit on top of the desktop.');
  assert(mouseBounds.min.y >= desktopBounds.max.y - 0.04, 'Mouse should sit on top of the desktop.');
  assert(keyboardBounds.max.z > screenBounds.max.z, 'Keyboard should be in front of the monitor for the player-facing side.');

  const screen = visual.getObjectByName('standingDeskScreen');
  assert(screen?.material?.emissiveIntensity > 0, 'Screen should use an emissive material.');
}

async function validateAssets() {
  const typingClipPath = getAssetPath(assets.mixamo.animations.typing);
  const typingClipRaw = await readFile(typingClipPath, 'utf8');
  const typingClip = THREE.AnimationClip.parse(JSON.parse(typingClipRaw));
  assert(typingClip.name === 'typing', 'Typing clip should be named "typing".');
  assert(typingClip.duration >= 3 && typingClip.duration <= 30, 'Typing clip duration is outside the expected range.');
  assert(typingClip.tracks.length >= 13, 'Typing clip should include the core upper-body tracks.');
  const trackNames = typingClip.tracks.map((track) => track.name);
  for (const requiredTrack of ['mixamorigSpine.quaternion', 'mixamorigRightHand.quaternion', 'mixamorigLeftHand.quaternion']) {
    assert(trackNames.includes(requiredTrack), `Typing clip missing required track "${requiredTrack}".`);
  }

  const typingAudioPath = getAssetPath(assets.audio.typingOnKeyboard);
  const typingAudio = await readFile(typingAudioPath);
  assert(typingAudio.subarray(0, 4).toString('ascii') === 'RIFF', 'Typing audio should be a RIFF WAV file.');
  assert(typingAudio.subarray(8, 12).toString('ascii') === 'WAVE', 'Typing audio should be a WAV file.');
}

function validateEmoteConfig() {
  const emote = EMOTES_BY_ID[TYPING_EMOTE_ID];
  assert(emote, 'Typing emote config is missing.');
  assert(emote.clipName === 'typing', 'Typing emote should use the typing clip.');
  assert(emote.loop === true, 'Typing emote should loop during the activity.');
  assert(emote.upperBodyOnly === true, 'Typing emote should be upper-body only.');
  assert(assets.playerAnimationSet.emotes[TYPING_EMOTE_ID] === 'typing', 'Typing emote should be included in the player animation set.');
}

function validateActivityConfig() {
  const typingActivity = getWorkoutActivityConfig(TYPING_WORKOUT_KIND);
  assert(typingActivity, 'Typing workout activity config is missing.');
  assert(typingActivity.kind === TYPING_WORKOUT_KIND, 'Typing activity should use the typing workout kind.');
  assert(typingActivity.emoteId === TYPING_EMOTE_ID, 'Typing activity should play the typing emote.');
  assert(typingActivity.durationMs === TYPING_WORKOUT_DURATION_MS, 'Typing activity duration should match the configured typing duration.');
  assert(typingActivity.durationMs >= 3000 && typingActivity.durationMs <= 7000, 'Typing activity should complete after a few seconds.');
  assert(typingActivity.playTypingSound === true, 'Typing activity should play the keyboard sound at start.');
  assert(typingActivity.stopEmoteOnFinish === true, 'Typing activity should stop its looping emote when complete.');
  assert(typingActivity.attachBarbell !== true, 'Typing activity should not create a carried barbell.');

  const snatchActivity = getWorkoutActivityConfig(SNATCH_WORKOUT_KIND);
  assert(snatchActivity?.attachBarbell === true, 'Snatch activity should preserve the carried barbell flow.');
}

async function validateCheckedInPlacements() {
  assert(
    defaultWorldLayout.props.some((placement) => placement.itemId === 'standing_desk_computer'),
    'Default world should include a standing desk computer placement.'
  );

  const savedLayout = JSON.parse(await readFile(new URL('../server/data/world-layout.json', import.meta.url), 'utf8'));
  assert(
    savedLayout.props?.some((placement) => placement.itemId === 'standing_desk_computer'),
    'Fallback saved world layout should include a standing desk computer placement.'
  );
}

async function main() {
  validateBuilderDefinition();
  validateDeskModel();
  validateEmoteConfig();
  validateActivityConfig();
  await validateCheckedInPlacements();
  await validateAssets();
  console.log('Computer activity validation passed.');
}

await main();
