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
import {
  OFFICE_JOB_IDS,
  OFFICE_JOB_TERMINAL_ITEM_ID,
  getOfficeJobDefinition,
  listOfficeJobDefinitions
} from '../src/shared/officeJobs.js';

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
  const item = getBuilderItemById(OFFICE_JOB_TERMINAL_ITEM_ID);
  assert(item, 'Standing desk computer builder item is missing.');
  assert(item.layer === 'prop', 'Standing desk computer should be a prop.');
  assert(item.groupId === 'office', 'Standing desk computer should live in the office prop group.');
  assert(typeof item.createVisual === 'function', 'Standing desk computer should use a procedural visual.');
  assert(item.interactable?.prompt === 'Open job board', 'Standing desk computer should open the office job board.');
  assert(item.interactable?.workoutType === TYPING_EMOTE_ID, 'Standing desk computer should start the typing workout.');
  assert(item.interactable?.hideDuringWorkout === false, 'Standing desk computer should remain visible while in use.');
  assert(Array.isArray(item.interactable?.approachLocalOffset), 'Standing desk computer needs an approach offset.');
  assert(Number.isFinite(item.interactable?.approachRotationY), 'Standing desk computer needs an approach facing.');
}

async function validateOfficeJobTerminalFlow() {
  const jobs = listOfficeJobDefinitions();
  assert(jobs.length === 3, 'Office computer should expose exactly three job tiers.');

  const janitor = getOfficeJobDefinition(OFFICE_JOB_IDS.janitor);
  const manager = getOfficeJobDefinition(OFFICE_JOB_IDS.officeManager);
  const ceo = getOfficeJobDefinition(OFFICE_JOB_IDS.ceo);
  assert(janitor?.rewardMoney === 25 && janitor?.intelligenceRequired === 5, 'Janitor job should pay $25 and require 5 Intelligence.');
  assert(manager?.rewardMoney === 100 && manager?.intelligenceRequired === 50, 'Office Manager job should pay $100 and require 50 Intelligence.');
  assert(ceo?.rewardMoney === 500 && ceo?.intelligenceRequired === 200, 'CEO job should pay $500 and require 200 Intelligence.');

  const gameSource = await readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = await readFile(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const colyseusSource = await readFile(new URL('../src/npc/NpcServiceColyseus.js', import.meta.url), 'utf8');
  const mockSource = await readFile(new URL('../src/npc/NpcServiceMock.js', import.meta.url), 'utf8');

  assert(gameSource.includes('openOfficeJobMenu'), 'Game should route the office computer to the office job menu.');
  assert(gameSource.includes("office:throw"), 'Game should implement the janitor paper toss task.');
  assert(gameSource.includes('handleOfficeJobHoldEnd'), 'Game should implement the office manager hold-to-brew task.');
  assert(gameSource.includes("office:stamp"), 'Game should implement the CEO memo stamping task.');
  assert(hudSource.includes('office:select:'), 'HUD should render selectable office job tiers.');
  assert(serverSource.includes("officeJob:complete"), 'Server should expose an office job completion RPC.');
  assert(colyseusSource.includes('completeOfficeJob'), 'Colyseus service should call the office job completion RPC.');
  assert(mockSource.includes('completeOfficeJob'), 'Mock service should support office job completion.');
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
  const hasId3Header = typingAudio.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = typingAudio[0] === 0xff && (typingAudio[1] & 0xe0) === 0xe0;
  assert(hasId3Header || hasFrameSync, 'Typing audio should be an MP3 file.');
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

function validateOfficeJobs() {
  const janitor = getOfficeJobDefinition(OFFICE_JOB_IDS.janitor);
  const manager = getOfficeJobDefinition(OFFICE_JOB_IDS.officeManager);
  const ceo = getOfficeJobDefinition(OFFICE_JOB_IDS.ceo);

  assert(/paper toss/i.test(janitor.description), 'Janitor task should be based on paper toss.');
  assert(/thrower|throws?/i.test(`${janitor.description} ${janitor.prompt}`), 'Janitor paper toss should show a person throwing the paper.');
  assert(/three/i.test(`${janitor.subtitle} ${janitor.description} ${janitor.prompt}`), 'Janitor task should require multiple paper toss rounds.');
  assert(/spacebar/i.test(janitor.instructions) && /throw/i.test(janitor.instructions), 'Janitor start menu should explain Spacebar/click throwing controls.');
  assert(/coffee maker/i.test(manager.description), 'Office Manager task should mention the coffee maker.');
  assert(/mug/i.test(manager.description), 'Office Manager task should use a coffee mug.');
  assert(/hold spacebar/i.test(manager.instructions) && /release/i.test(manager.instructions), 'Office Manager start menu should explain hold/release coffee controls.');
  assert(/stamp/i.test(`${ceo.description} ${ceo.prompt}`), 'CEO task should be the new memo stamping minigame.');
  assert(/spacebar/i.test(ceo.instructions) && /stamp/i.test(ceo.instructions), 'CEO start menu should explain Spacebar/click stamping controls.');
  assert(!/sleep|nap|watcher/i.test(`${ceo.description} ${ceo.prompt}`), 'CEO task should no longer be the sleep/watcher minigame.');
}

async function validateOfficeJobHudSurfaces() {
  const hudSource = await readFile(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const gameSource = await readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const officeCountdownMatch = gameSource.match(/const\s+OFFICE_JOB_COUNTDOWN_MS\s*=\s*(\d+)/);
  const officeCountdownMs = Number(officeCountdownMatch?.[1] ?? 0);

  assert(gameSource.includes('startOfficeJobCountdown'), 'Office jobs should run a quick countdown before play starts.');
  assert(officeCountdownMs > 0 && officeCountdownMs < 2000, 'Office job countdown should finish in less than 2 seconds.');
  assert(gameSource.includes('OFFICE_JANITOR_REQUIRED_THROWS'), 'Janitor paper toss should require multiple successful throws.');
  assert(gameSource.includes('OFFICE_CEO_TARGET_WIDTH_VARIANCE'), 'CEO approval windows should have wider timing variance.');
  assert(gameSource.includes('OFFICE_CEO_STAMP_RIGHT_EXIT'), 'CEO stamp should travel off the right edge before returning.');
  assert(gameSource.includes('memoDirection'), 'CEO stamp should track a return-pass direction for two chances.');
  assert(hudSource.includes('hud__office-paper-ball'), 'Janitor HUD should render a crumpled paper toss ball.');
  assert(hudSource.includes('hud__school-instructions'), 'Selected office job start screens should show how-to-play instructions.');
  assert(hudSource.includes('hud__office-job-instruction'), 'Office job menu cards should show how-to-play instructions.');
  assert(hudSource.includes('hud__office-thrower'), 'Janitor HUD should render a person throwing the paper.');
  assert(!hudSource.includes('hud__office-fan'), 'Janitor HUD should no longer render the old desk fan.');
  assert(hudSource.includes('Janitor toss progress'), 'Janitor HUD should show multi-round toss progress.');
  assert(hudSource.includes('3..2..1.. GO!'), 'Office jobs should display the 3..2..1.. GO countdown.');
  assert(hudSource.includes('hud__office-breakroom-fridge'), 'Office Manager HUD should render a break room background.');
  assert(hudSource.includes('hud__office-coffee-maker'), 'Office Manager HUD should render a coffee maker.');
  assert(hudSource.includes('hud__office-cup'), 'Office Manager HUD should render a coffee mug.');
  assert(hudSource.includes('hud__office-ceo-stamp'), 'CEO HUD should render the new stamp minigame.');
  assert(hudSource.includes('--stamp-left'), 'CEO stamp should expose a dynamic horizontal marker position.');
  assert(hudSource.includes('is-returning'), 'CEO HUD should show the returning stamp pass.');
  assert(hudSource.includes('hud__office-board-face is-center'), 'CEO boardroom should include animated board members.');
  assert(hudSource.includes("office:stamp"), 'CEO HUD should expose the stamp action.');

  assert(cssSource.includes('@keyframes hud-office-paper-score'), 'Janitor paper toss should land made shots in the basket.');
  assert(cssSource.includes('@keyframes hud-office-coffee-stream'), 'Office Manager coffee maker should have a brewing stream animation.');
  assert(cssSource.includes('@keyframes hud-office-mug-bob'), 'Office Manager coffee mug should animate while brewing.');
  assert(cssSource.includes('hud__office-breakroom-wall'), 'Office Manager coffee station should include a break room background.');
  assert(cssSource.includes('@keyframes hud-office-stamp-slam'), 'CEO stamp should have a slam animation.');
  assert(cssSource.includes('@keyframes hud-office-stamp-mark'), 'CEO stamp should leave an approved mark animation.');
  assert(cssSource.includes('hud__office-ceo-stamp-handle'), 'CEO stamp should have a symmetrical handle.');
  assert(cssSource.includes('hud__office-ceo-stamp-pad'), 'CEO stamp should have a polished stamp pad.');
  assert(cssSource.includes('@keyframes hud-office-board-member-bob'), 'CEO board members should animate.');
  assert(cssSource.includes('left: var(--stamp-left'), 'CEO stamp visual should move with the timing marker.');
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
  await validateOfficeJobTerminalFlow();
  validateDeskModel();
  validateEmoteConfig();
  validateActivityConfig();
  validateOfficeJobs();
  await validateOfficeJobHudSurfaces();
  await validateCheckedInPlacements();
  await validateAssets();
  console.log('Computer activity validation passed.');
}

await main();
