import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Input } from './Input.js';
import { TASK_IDS, TaskTracker } from './TaskTracker.js';
import {
  DEFAULT_VIBE_SHADER_INTENSITY,
  DEFAULT_VIBE_SHADER_PRESET_ID,
  NO_VIBE_SHADER_PRESET_ID,
  VIBE_SHADER_PRESETS,
  createVibeShaderDefinition,
  getVibeShaderPreset
} from './vibeShaderPresets.js';
import {
  VIBE_JAM_PORTAL_URL,
  buildPortalRedirectUrl,
  getCurrentGameBaseUrl,
  parsePortalArrival
} from './vibeJamPortal.js';
import {
  SNATCH_APPROACH_STOP_DISTANCE,
  SNATCH_WORKOUT_KIND,
  getWorkoutActivityConfig
} from './workoutActivities.js';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { Hud } from '../ui/Hud.js';
import { SchoolTeacherPreviewRenderer } from '../ui/SchoolTeacherPreviewRenderer.js';
import { assets } from '../world/assetManifest.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_AIM_POSE_FIELDS,
  HELD_ITEM_IDS,
  getHeldItemAssetUrl,
  listHeldItemDefinitions,
  prepareHeldItemModel
} from '../shared/heldItemDefinitions.js';
import {
  DEFAULT_HOTBAR_ITEM_ORDER,
  HOTBAR_KEY_CODES,
  createHotbarSlots,
  getHotbarConsumableItemId,
  getHotbarDrinkItemId,
  getHotbarEquippedWeaponId,
  getPreferredHotbarSlotIndexForItem,
  getHotbarSlot,
  getHotbarSlotIndexFromKeyCode,
  moveHotbarItemOrderSlot,
  normalizeHotbarItemOrder,
  normalizeHotbarSlotIndex
} from '../shared/hotbarInventory.js';
import {
  getItemEquipAnimation,
  getItemEquipAnimationForWeapon,
  getItemActionLabel,
  getItemLabel
} from '../shared/itemDefinitions.js';
import {
  WORLD_FOG_FAR,
  WORLD_FOG_NEAR,
  WORLD_GROUND_RADIUS,
  WORLD_SHADOW_EXTENT
} from '../shared/worldConstants.js';
import {
  getTileCenterWorldPosition,
  getTileFootprintWorldSize,
  rotateFootprintOffset
} from '../shared/tileFootprint.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { buildCity } from '../world/buildCity.js';
import { getBuilderItemById } from '../world/builderCatalog.js';
import { INTERACTABLE_INDICATOR_LAYER } from '../world/interactableIndicators.js';
import { createInteriorScene } from '../world/InteriorScene.js';
import {
  BASKETBALL_HOOP_RIM_HEIGHT,
  createOlympicBarbellVisual
} from '../world/proceduralProps.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { createPlayer } from '../player/createPlayer.js';
import { DRINKING_EMOTE_ID, EMOTE_SLOTS, PUNCH_ALT_EMOTE_ID, PUNCH_EMOTE_ID } from '../player/emotes.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById,
  listPlayableCharacters
} from '../player/playableCharacterCatalog.js';
import { createNpcService } from '../npc/createNpcService.js';
import { PLAYER_MAX_HEALTH, PLAYER_RADIUS } from '../shared/combatConstants.js';
import {
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver
} from '../shared/deliveryQuest.js';
import {
  GYM_CHECK_IN_LINE,
  GYM_DOOR_BLOCKER_RADIUS,
  GYM_MEMBERSHIP_COST,
  getGymCheckInPromptRadius,
  isGymCheckInNpc
} from '../shared/gymMembership.js';
import { RENT_INTRO_LINE } from '../shared/rentIntro.js';
import {
  STOCK_MARKET_TICK_MS,
  getStockMarketPromptRadius,
  isStockMarketNpc,
  normalizeStockTradeQuantity
} from '../shared/stockMarket.js';
import {
  DRUNKNESS_MAX_LEVEL,
  getBartenderMenuItem,
  getBartenderPromptRadius,
  getPlayerDrinkCount,
  isBartenderNpc,
  listBartenderMenuItems
} from '../shared/bartender.js';
import {
  getPawnShopMenuItem,
  getPawnShopPromptRadius,
  getPlayerPawnShopItemCount,
  isPlayerPawnShopItemOwned,
  isPawnShopOwnerNpc,
  listPawnShopMenuItems
} from '../shared/pawnShop.js';
import {
  getCarDealerMenuItem,
  getCarDealerPromptRadius,
  getPlayerVehicleItemId,
  getPlayerVehicleMenuItem,
  isCarDealerNpc,
  listCarDealerMenuItems
} from '../shared/carDealer.js';
import {
  getMarthaMenuItem,
  getMarthaPromptRadius,
  getPlayerMarthaItemCount,
  isMarthaNpc,
  listMarthaMenuItems
} from '../shared/martha.js';
import {
  SKATEBOARD_SPEED_MULTIPLIER,
  isPlayerSkateboardOwner
} from '../shared/skateboard.js';
import {
  BLACKJACK_DEFAULT_WAGER,
  createBlackjackSession,
  doubleBlackjackSession,
  getBlackjackPromptRadius,
  hitBlackjackSession,
  isBlackjackDealerNpc,
  normalizeBlackjackWager,
  serializeBlackjackSession,
  splitBlackjackSession,
  standBlackjackSession
} from '../shared/blackjack.js';
import {
  SCHOOL_MICROGAME_ALL_ID,
  SCHOOL_MICROGAME_DEFAULT_ID,
  SCHOOL_MICROGAME_IDS,
  SCHOOL_POP_QUIZ_ROUND_COUNT,
  createSchoolMemoryMatchCards,
  createSchoolPopQuizQuestions,
  getSchoolMicrogameDefinition,
  getSchoolMicrogamePromptRadius,
  isSchoolMicrogameNpc,
  listSchoolMicrogames,
  normalizeSchoolMicrogameId
} from '../shared/schoolMicrogames.js';
import {
  CHARISMA_VIBE_HERO_XP,
  SKILL_DEFINITIONS,
  SKILL_IDS,
  getSkillLevelFromXp,
  getPlayerSkillXp,
  getPlayerSkillsSnapshot
} from '../shared/skills.js';
import {
  OFFICE_JANITOR_GAME_IDS,
  OFFICE_JOB_GAME_IDS,
  OFFICE_JOB_IDS,
  OFFICE_JOB_TERMINAL_ITEM_ID,
  canPlayerWorkOfficeJob,
  getOfficeJobDefinition,
  getOfficeJobDefinitionByGameId,
  getOfficeJobLockedMessage,
  listOfficeJobDefinitions
} from '../shared/officeJobs.js';
import {
  OFFICE_INTERIOR_ID
} from '../shared/officeInteriorLayout.js';
import {
  VIBE_HERO_DEFAULT_SONG_ID,
  VIBE_HERO_GAME_ID,
  VIBE_HERO_LANE_COUNT,
  VIBE_HERO_NOTE_TRAVEL_MS,
  getVibeHeroSong,
  listVibeHeroSongs,
  normalizeVibeHeroSongId
} from '../shared/vibeHero.js';
import {
  cloneVibeRadioTracks
} from '../shared/vibeRadio.js';
import { getNpcModelVoice } from '../shared/npcVoice.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const AIM_CAMERA_OFFSET = new THREE.Vector3(0, 27.1, 18.9);
function createCameraMovementForward(cameraOffset) {
  const forward = new THREE.Vector3(
    cameraOffset.x - CAMERA_LOOK_OFFSET.x,
    0,
    cameraOffset.z - CAMERA_LOOK_OFFSET.z
  );
  return forward.lengthSq() > 0.000001 ? forward.normalize() : forward.set(0, 0, 1);
}
const CAMERA_MOVEMENT_FORWARD = createCameraMovementForward(CAMERA_OFFSET);
const AIM_CAMERA_MOVEMENT_FORWARD = createCameraMovementForward(AIM_CAMERA_OFFSET);
const WORLD_RENDER_LAYER = 0;
const CAMERA_ZOOM_LEVELS = [0.67, 0.74, 0.82, 0.92, 1, 1.12, 1.26];
const DEFAULT_CAMERA_ZOOM_INDEX = 4;
const STOCK_SNAPSHOT_TICK_GRACE_MS = 180;
const STOCK_SNAPSHOT_RETRY_MS = 3500;
const DEATH_CAMERA_ZOOM_LEVEL = 3.25;
const DEATH_CAMERA_ZOOM_TRANSITION_MS = 2600;
const AIM_DIRECTION_MIN_DISTANCE = 3;
const PROJECTILE_VISUAL_SPEED = 48;
const PROJECTILE_MIN_LIFETIME_MS = 120;
const SCHOOL_MICROGAME_COUNTDOWN_MS = 3000;
const VIBE_HERO_COUNTDOWN_MS = 2400;
const VIBE_HERO_COUNTDOWN_GO_MS = 450;
const VIBE_HERO_HIT_WINDOW_MS = 185;
const VIBE_HERO_PERFECT_WINDOW_MS = 58;
const VIBE_HERO_GREAT_WINDOW_MS = 112;
const VIBE_HERO_POST_SONG_MS = 900;
const VIBE_HERO_LANE_FLASH_MS = 420;
const VIBE_HERO_EDITOR_SEEK_MS = 5000;
const VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS = 120;
const VIBE_HERO_EDITOR_RECORD_STEP_MS = 95;
const VIBE_HERO_EDITOR_HOLD_REPEAT_DELAY_MS = 220;
const VIBE_HERO_EDITOR_NOTE_DURATION_MS = 150;
const VIBE_HERO_EDITOR_STORAGE_PREFIX = 'vta:vibeHero:chart-editor:v1:';
const VIBE_HERO_EDITOR_LANE_PITCHES = Object.freeze(['C4', 'D4', 'E4', 'G4', 'A4']);
const VIBE_HERO_EDITOR_LANE_FREQUENCIES = Object.freeze([261.63, 293.66, 329.63, 392, 440]);
const VIBE_HERO_LANE_KEY_CODES = Object.freeze(Array.from({ length: VIBE_HERO_LANE_COUNT }, (_, index) => Object.freeze([
  `Digit${index + 1}`,
  `Numpad${index + 1}`
])));
const VIBE_RADIO_VOLUME_STORAGE_KEY = 'vta:vibeRadio:volume';
const VIBE_RADIO_SEEK_SECONDS = 10;
const BASKETBALL_SHOT_SWEEP_MS = 1320;
const BASKETBALL_SHOT_CLEAN_WINDOW = 0.055;
const BASKETBALL_SHOT_GREAT_WINDOW = 0.13;
const BASKETBALL_SHOT_FLIGHT_MS = 920;
const BASKETBALL_SHOT_RESULT_HOLD_MS = 980;
const BASKETBALL_SHOT_RIM_LOCAL_Z = 0.44;
const BASKETBALL_SHOT_RIM_WORLD_HEIGHT = BASKETBALL_HOOP_RIM_HEIGHT * 1.045;
const BASKETBALL_SHOT_BALL_RADIUS = 0.23;
const BASKETBALL_SHOT_CAMERA_SMOOTHING = 0.18;

function formatVibeHeroTimestamp(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function smoothstep01(value) {
  const t = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
  return t * t * (3 - (2 * t));
}

function getTimedEnvelope(elapsedMs, startMs, endMs, fadeInMs = 120, fadeOutMs = 160) {
  if (elapsedMs < startMs || elapsedMs > endMs) {
    return 0;
  }

  const fadeIn = fadeInMs <= 0 ? 1 : smoothstep01((elapsedMs - startMs) / fadeInMs);
  const fadeOut = fadeOutMs <= 0 ? 1 : smoothstep01((endMs - elapsedMs) / fadeOutMs);
  return Math.min(fadeIn, fadeOut);
}

function getRentIntroBlinkClosure(elapsedMs = 0) {
  return Math.max(
    getTimedEnvelope(elapsedMs, -240, 1120, 1, 260),
    getTimedEnvelope(elapsedMs, 1540, 1840, 90, 130),
    getTimedEnvelope(elapsedMs, 2460, 2740, 80, 120),
    getTimedEnvelope(elapsedMs, 3060, 3520, 110, 180),
    getTimedEnvelope(elapsedMs, 5000, 6100, 180, 340)
  );
}

const OFFICE_JOB_COUNTDOWN_MS = 1600;
const OFFICE_JOB_COUNTDOWN_GO_MS = 250;
const OFFICE_JANITOR_REQUIRED_THROWS = 3;
const OFFICE_JANITOR_THROW_RESOLVE_MS = 820;
const OFFICE_JANITOR_BASE_TARGET_WIDTH = 0.2;
const OFFICE_JANITOR_TARGET_WIDTH_STEP = 0.02;
const OFFICE_JANITOR_MIN_TARGET_WIDTH = 0.15;
const OFFICE_JANITOR_BASE_MARKER_SPEED = 1.12;
const OFFICE_JANITOR_MARKER_SPEED_STEP = 0.18;
const OFFICE_JANITOR_MOP_HERO_DURATION_MS = 8000;
const OFFICE_JANITOR_MOP_BRUSH_RADIUS = 0.16;
const OFFICE_JANITOR_MOP_CLEAN_RATE = 3.4;
const OFFICE_JANITOR_MOP_COMPLETE_PROGRESS = 0.985;
const OFFICE_JANITOR_MOP_CLEAN_SHOWCASE_MS = 1000;
const OFFICE_JANITOR_MOP_DIRT_PATCHES = Object.freeze([
  Object.freeze({ x: 0.16, y: 0.74, size: 0.19, rotation: -14 }),
  Object.freeze({ x: 0.29, y: 0.61, size: 0.15, rotation: 18 }),
  Object.freeze({ x: 0.41, y: 0.78, size: 0.18, rotation: 9 }),
  Object.freeze({ x: 0.53, y: 0.66, size: 0.14, rotation: -21 }),
  Object.freeze({ x: 0.66, y: 0.77, size: 0.2, rotation: 12 }),
  Object.freeze({ x: 0.82, y: 0.63, size: 0.16, rotation: -8 }),
  Object.freeze({ x: 0.2, y: 0.46, size: 0.13, rotation: 22 }),
  Object.freeze({ x: 0.35, y: 0.38, size: 0.12, rotation: -17 }),
  Object.freeze({ x: 0.49, y: 0.49, size: 0.16, rotation: 4 }),
  Object.freeze({ x: 0.61, y: 0.39, size: 0.13, rotation: 19 }),
  Object.freeze({ x: 0.75, y: 0.48, size: 0.15, rotation: -24 }),
  Object.freeze({ x: 0.88, y: 0.79, size: 0.12, rotation: 15 })
]);
const OFFICE_CEO_STAMP_RESOLVE_MS = 680;
const OFFICE_CEO_STAMP_LEFT_EXIT = -0.14;
const OFFICE_CEO_STAMP_RIGHT_EXIT = 1.14;
const OFFICE_CEO_TARGET_MIN_WIDTH = 0.1;
const OFFICE_CEO_TARGET_WIDTH_VARIANCE = 0.14;
const PROJECTILE_MAX_LIFETIME_MS = 260;
const IMPACT_EFFECT_LIFETIME_MS = 140;
const MUZZLE_FLASH_LIFETIME_MS = 95;
const DAMAGE_CAMERA_KICK_MS = 260;
const PROJECTILE_TRAIL_LENGTH = 1.9;
const HIP_FIRE_AIM_LEAD_MS = 90;
const HIP_FIRE_AIM_HOLD_MS = 120;
const SHOT_COLLISION_ORIGIN_FORWARD_OFFSET = PLAYER_RADIUS * 1.15;
const EMOTE_MENU_DEADZONE = 54;
const CHAT_BUBBLE_MIN_LIFETIME_MS = 2600;
const CHAT_BUBBLE_MAX_LIFETIME_MS = 12000;
const CHAT_BUBBLE_BASE_LIFETIME_MS = 1800;
const CHAT_BUBBLE_MS_PER_WORD = 360;
const NPC_VOICE_FULL_VOLUME_DISTANCE = 4.5;
const NPC_VOICE_AUDIBLE_DISTANCE = 30;
const ZERO_MOVEMENT_VECTOR = Object.freeze({ x: 0, z: 0 });
const ZERO_INPUT = { getMovementVector: () => ZERO_MOVEMENT_VECTOR };
const CHARACTER_STORAGE_KEY = 'vta.selectedCharacterId';
const LEGACY_CHARACTER_STORAGE_KEY = 'stickrpg.selectedCharacterId';
const GAME_SETTINGS_STORAGE_KEY = 'vta.gameSettings';
const LEGACY_GAME_SETTINGS_STORAGE_KEY = 'stickrpg.gameSettings';
const HOTBAR_LAYOUT_STORAGE_KEY = 'vta.hotbarItemOrder';
const DEFAULT_GAME_SETTINGS = Object.freeze({
  masterVolume: 0.82
});
const SKILL_XP_EMOJIS = Object.freeze({
  strength: String.fromCodePoint(0x1f4aa),
  agility: String.fromCodePoint(0x1f3c3),
  intelligence: String.fromCodePoint(0x1f9e0),
  charisma: String.fromCodePoint(0x1f60e)
});
const OFFICE_CEO_MEMOS = Object.freeze([
  'Synergy Budget',
  'Emergency Pivot',
  'Golden Slide Deck',
  'KPI Sandwich',
  'Merger Napkin',
  'Vision Refund',
  'Bonus Forecast',
  'Town Hall Escape'
]);
const TEACHER_TYPING_SENTENCES = Object.freeze([
  'MEET ME AFTER CLASS WHEN THE HALLWAYS ARE QUIET',
  'THE ANSWER IS HIDDEN BEHIND THE LOCKER DOOR',
  'KEEP YOUR PENCIL MOVING UNTIL THE BELL RINGS',
  'THE BELL RINGS TOO SOON FOR SLOW NOTE TAKERS',
  'STAY COOL AND TYPE FAST WHILE THE ROOM IS QUIET',
  'COPY THE FORMULA BEFORE THE CHALK DUST SETTLES',
  'THE CAFETERIA LINE MOVES FASTER THAN THIS CLASS',
  'NEVER TRUST A POP QUIZ WITH A FRIENDLY TITLE',
  'THE PRINCIPAL IS PATROLLING THE EAST HALLWAY',
  'WRITE THE SECRET MESSAGE BEFORE I TURN AROUND',
  'A CLEAN NOTEBOOK CAN HIDE A DANGEROUS PLAN',
  'THE CLOCK ABOVE THE DOOR IS RUNNING AGAINST YOU',
  'THREE SHARP KNOCKS MEAN THE HALL PASS IS READY',
  'THE SCIENCE LAB SMELLS LIKE TROUBLE AND GLUE',
  'EVERY GOOD STUDENT KNOWS WHEN TO STOP WRITING',
  'THE CHALKBOARD CODE CHANGES AFTER SECOND PERIOD',
  'PUT THE CONTRABAND COMIC UNDER THE MATH HOMEWORK',
  'THE SUBSTITUTE TEACHER NEVER CHECKS THE BACK ROW',
  'A PERFECT SENTENCE CAN STILL GET YOU DETENTION',
  'THE WINDOW SEAT HAS THE BEST VIEW OF ESCAPE',
  'DO NOT DROP THE PENCIL WHEN THE TEACHER TURNS',
  'THE FINAL ANSWER IS WRITTEN IN BLUE NOTEBOOK INK',
  'SAVE YOUR QUESTIONS UNTIL THE DANGER LIGHT IS GREEN',
  'THE LOCKER COMBINATION STARTS WITH A LUCKY SEVEN',
  'QUIET SHOES MAKE THE BEST HALLWAY STRATEGY',
  'THE CLASSROOM MAP POINTS TOWARD THE OLD GYM',
  'FINISH THE LINE BEFORE THE ERASER HITS THE FLOOR',
  'THE TEACHER HEARS EVERY SUSPICIOUS KEYSTROKE',
  'A SECRET PLAN WORKS BEST WITH PERFECT SPELLING',
  'THE HOMEWORK STACK IS TALLER THAN THE TEACHER',
  'FAST TYPING BEATS A SLOW GLANCE EVERY TIME',
  'THE BACK ROW RUNS ON WHISPERS AND BORROWED PENS',
  'ONLY WRITE WHEN THE TEACHER FACES THE BOARD',
  'THE GOLD STAR STICKERS ARE LOCKED IN THE DESK',
  'A SHARP PENCIL IS WORTH TWO LUCKY ANSWERS',
  'THE HALL MONITOR KNOWS WHO BORROWED THE PASS',
  'NEVER CELEBRATE UNTIL THE SENTENCE IS COMPLETE',
  'THE OLD BELL BUZZES BEFORE ANYONE IS READY',
  'COPY THE LAST LINE AND PRETEND YOU UNDERSTAND',
  'THE TEACHER TURNS FASTER WHEN THE ROOM GETS QUIET',
  'GREEN LIGHT MEANS WRITE LIKE THE WIND TODAY',
  'RED LIGHT MEANS FREEZE LIKE A STATUE IN CLASS',
  'YELLOW LIGHT MEANS FINISH THE LETTER AND WATCH',
  'THE BOARD SQUEAKS LOUDER WHEN THE STAKES ARE HIGH',
  'A MISSING ERASER CAN RUIN THE PERFECT COVER STORY',
  'THE QUIETEST DESK HIDES THE LOUDEST PLAN',
  'WRITE THE LINE CLEANLY AND KEEP YOUR EYES UP',
  'THE SCHOOL BUS LEAVES BEFORE THE FINAL WARNING',
  'A GOOD ALIBI STARTS WITH NEAT HANDWRITING',
  'THE ANSWER KEY IS NOT WHERE YOU THINK IT IS',
  'THE GYM WHISTLE ECHOES THROUGH THE CLASSROOM WALL',
  'KEEP THE MESSAGE SHORT BUT MAKE EVERY LETTER COUNT',
  'THE TEACHER IS LOOKING FOR MOVEMENT NOT MISTAKES',
  'A CROOKED SENTENCE STILL COUNTS IF IT IS FINISHED',
  'THE CLASS PET KNOWS TOO MUCH ABOUT THE PLAN',
  'THE BINDER CLIPS ARE GUARDING THE SECRET NOTES',
  'WAIT FOR GREEN BEFORE YOU WRITE THE NEXT WORD',
  'THE WINDOW REFLECTION SHOWS THE TEACHERS SHOULDERS',
  'A QUICK BACKSPACE CAN SAVE A SUSPICIOUS SENTENCE',
  'THE STUDENT DESK SHAKES WHEN THE DANGER LIGHT GLOWS',
  'CHALK DUST FLOATS LIKE A WARNING IN THE AIR',
  'THE LESSON PLAN SAYS NOTHING ABOUT THIS MESSAGE',
  'TYPE THE LETTERS CLEANLY BEFORE THE RED LIGHT',
  'THE FRONT ROW NEVER SEES THE BEST ESCAPE ROUTE',
  'THE TEACHER SPINS WHEN THE CLASS GETS TOO BRAVE',
  'A PERFECT RUN NEEDS PATIENCE MORE THAN SPEED',
  'THE ANNOUNCEMENT SPEAKER CRACKLES AT THE WORST TIME',
  'THE QUIZ ANSWERS ARE SAFE INSIDE THE MARGIN',
  'STOP WRITING WHEN THE TEACHER FINISHES TURNING',
  'THE BLUE PEN LEAKS BUT THE SECRET STILL WORKS',
  'A FAST START CAN SURVIVE A LONG RED LIGHT',
  'THE CHALK TRAY HOLDS CLUES AND ONE LOST COIN',
  'EVERY LETTER MATTERS WHEN THE TIMER IS RUNNING',
  'THE CLOCK TICKS LOUDER AFTER THE YELLOW LIGHT',
  'THE NOTE PASSES LEFT WHEN THE TEACHER LOOKS RIGHT',
  'A CLEAN ESCAPE REQUIRES CAREFUL PENCIL TIMING',
  'THE HISTORY TEST IS HIDING UNDER THE RULER',
  'KEEP YOUR HANDS STILL WHEN THE RED LIGHT FLASHES',
  'THE TEACHER WRITES SLOWLY UNTIL THE ROOM RELAXES',
  'ONE MORE WORD CAN BE THE DIFFERENCE BETWEEN PASSING',
  'THE FINAL BELL LOVES TO INTERRUPT GOOD IDEAS',
  'A SECRET SENTENCE NEEDS BOTH NERVE AND TIMING',
  'THE DESK DRAWER SQUEAKS LOUDER THAN EXPECTED',
  'THE BOARD ERASER IS COVERED IN YESTERDAYS CLUES',
  'GREEN LIGHT GIVES YOU PERMISSION NOT IMMUNITY',
  'THE RED LIGHT CATCHES EVERY EXTRA LETTER',
  'THE SCHOOL MAP FOLDS INTO A PAPER AIRPLANE',
  'A BORROWED PENCIL CAN START A CLASSROOM LEGEND',
  'THE TEACHER PAUSES BEFORE THE DANGEROUS TURN',
  'KEEP THE SENTENCE STEADY THROUGH THE WARNING',
  'THE BACKPACK ZIPPER IS TOO LOUD FOR THIS MISSION',
  'THE CLASSROOM DOOR CREAKS LIKE A FINAL WARNING',
  'A LATE LETTER IS WORSE THAN AN EMPTY SPACE',
  'THE HALLWAY TROPHY CASE REFLECTS THE WHOLE ROOM',
  'WRITE BRAVELY WHILE THE TEACHER FACES THE BOARD',
  'THE SAFEST STUDENTS KNOW WHEN TO STOP TYPING',
  'THE BLACKBOARD HOLDS MORE SECRETS THAN HOMEWORK',
  'A LONG SENTENCE MAKES THE GREEN LIGHT PRECIOUS',
  'THE TEACHERS SHADOW MOVES BEFORE THE RED LIGHT',
  'FINISH STRONG BUT NEVER TYPE UNDER THE RED LIGHT'
]);
const PHONE_MAP_REFRESH_MS = 140;
const PHONE_MAP_DEFAULT_ZOOM = 1.7;
const PHONE_MAP_MIN_ZOOM = 1.7;
const PHONE_MAP_MAX_ZOOM = 4;
const PHONE_MAP_ZOOM_STEP = 0.35;
const PHONE_MAP_WIDTH = 280;
const PHONE_MAP_HEIGHT = 430;
const PHONE_MAP_KEY_PAN_VIEW_FRACTION_PER_SECOND = 0.82;
const WORLD_MAP_IMAGE_METADATA_URL = '/assets/generated/world-map.json';
const WORLD_MAP_CAPTURE_ENDPOINT = '/admin/world-map';
const WORLD_MAP_CAPTURE_WIDTH = 1024;
const WORLD_MAP_CAPTURE_HEIGHT = 1536;
const WORLD_MAP_CAPTURE_QUALITY = 0.84;
const ADMIN_AGENT_TASKS_ENDPOINT = '/admin/agent-tasks';
const ADMIN_PROMPT_TASK_SCOPE = 'game';
const ADMIN_PROMPT_TASK_REFRESH_MS = 5000;
const RELEASE_VERSION_ENDPOINT = '/version.json';
const RELEASE_VERSION_CHECK_MS = 45000;
const RELEASE_RELOAD_DELAY_MS = 8000;
const PHONE_CHARACTER_PREVIEW_PROFILE = Object.freeze({
  fitHeightFraction: 0.96,
  fitWidthFraction: 0.96,
  bottomPaddingRatio: 0.22,
  distanceMultiplier: 0.58,
  cameraLiftRatio: 0,
  cameraXRatio: 0
});
const BOOT_PIXEL_RATIO_CAP = 1.25;
const RUNTIME_PIXEL_RATIO_CAP = 2;
const RENT_INTRO_MONEY_ANIMATION_MS = 1250;
const RENT_INTRO_MONEY_FLOATER_MS = 1500;
const MONEY_REWARD_ANIMATION_MS = 900;
const SKILL_XP_FLOATER_MS = 1550;
const SKILL_LEVEL_UP_SOUND_SUPPRESS_MS = 500;
const TASK_COMPLETE_SOUND_COOLDOWN_MS = 1800;
const TASK_COMPLETE_CHA_CHING_DELAY_MS = 760;
const TASK_COMPLETE_MONEY_SOUND_SUPPRESS_MS = 1750;
const TASK_COMPLETE_MAJOR_KEY_PITCH_CLASSES = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
const TASK_COMPLETE_MAJOR_KEY_LAYERS = Object.freeze([
  Object.freeze({ rawPlaybackRate: 0.72, volumeScale: 1.05, delayMs: 0 }),
  Object.freeze({ rawPlaybackRate: 0.84, volumeScale: 0.34, delayMs: 135 }),
  Object.freeze({ rawPlaybackRate: 0.98, volumeScale: 0.2, delayMs: 310 })
]);
const RENT_INTRO_LOADING_CLEAR_MS = 900;
const RENT_INTRO_AFTER_LOADING_DELAY_MS = 500;
const RENT_INTRO_TYPE_MS_PER_CHAR = 42;
const RENT_INTRO_MIN_TYPING_MS = 900;
const RENT_INTRO_AFTER_LINE_DELAY_MS = 650;
const RENT_INTRO_SPEECH_HOLD_MS = 1700;
const RENT_INTRO_CUTSCENE_TOTAL_MS = 6200;
const RENT_INTRO_CUTSCENE_FIRST_PERSON_MS = 3300;
const RENT_INTRO_CUTSCENE_GET_UP_START_MS = 3150;
const RENT_INTRO_CUTSCENE_CAMERA_BLEND_MS = 760;
const RENT_INTRO_CUTSCENE_NPC_DISTANCE = 2.75;
const RENT_INTRO_STAND_UP_EMOTE_ID = 'standUp';
const RENT_INTRO_STAND_UP_CLIP_NAME = 'standUp';
const OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX = 18;
const CAMERA_OCCLUDED_PLAYER_RENDER_ORDER = 90;
const PORTAL_EXIT_REARM_PADDING = PLAYER_RADIUS + 0.75;
const PORTAL_SPAWN_LOCK_MS = 1500;
const FRAME_DELTA_MAX_SECONDS = 0.12;
const FRAME_TIMING_SAMPLE_LIMIT = 120;
const FRAME_TIMING_SUMMARY_INTERVAL_MS = 250;
const LOCAL_AUTHORITATIVE_MAX_TRANSFORM_SEQ_LAG = 2;
const LOCAL_AUTHORITATIVE_PORTAL_UNLOCK_DISTANCE = 2.5;
const LOCAL_AUTHORITATIVE_SOFT_RECONCILE_DISTANCE = 3;
const LOCAL_AUTHORITATIVE_ACTIVE_RECONCILE_DISTANCE = 5;
const LOCAL_AUTHORITATIVE_STALE_RECONCILE_MS = 220;
const LOCAL_AUTHORITATIVE_HARD_SNAP_DISTANCE = 8;
const LOCAL_AUTHORITATIVE_RECONCILE_RATE = 5.5;
const ADAPTIVE_RENDER_SAMPLE_MIN_COUNT = 45;
const ADAPTIVE_RENDER_SLOW_FRAME_P95_MS = 44;
const ADAPTIVE_RENDER_RECOVERY_FRAME_P95_MS = 25;
const ADAPTIVE_RENDER_ADJUST_INTERVAL_MS = 3000;
const ADAPTIVE_RENDER_PIXEL_RATIO_STEP = 0.25;
const ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP = 1;
const EMPTY_NPC_FOCUS_TARGETS = new Map();
const EMPTY_NPC_SPEECH_ANCHORS = new Map();
const EMPTY_VISIBLE_OVERHEAD_HEALTH_BAR_IDS = new Set();
const EMPTY_INTERACTABLES = Object.freeze([]);

function getSortedPercentile(values, percentile) {
  if (!values.length) {
    return 0;
  }

  const sorted = values.sort((a, b) => a - b);
  const index = THREE.MathUtils.clamp(Math.ceil(sorted.length * percentile) - 1, 0, sorted.length - 1);
  return sorted[index];
}

function appendList(target, values) {
  if (!values?.length) {
    return target;
  }

  for (const value of values) {
    target.push(value);
  }
  return target;
}

function getNearestMajorKeySemitone(semitones = 0) {
  const safeSemitones = Number.isFinite(semitones) ? semitones : 0;
  const baseOctave = Math.floor(safeSemitones / 12);
  let nearestSemitone = 0;
  let nearestDistance = Infinity;

  for (let octaveOffset = -1; octaveOffset <= 1; octaveOffset += 1) {
    const octave = baseOctave + octaveOffset;
    for (const pitchClass of TASK_COMPLETE_MAJOR_KEY_PITCH_CLASSES) {
      const candidate = octave * 12 + pitchClass;
      const distance = Math.abs(candidate - safeSemitones);
      if (distance < nearestDistance) {
        nearestSemitone = candidate;
        nearestDistance = distance;
      }
    }
  }

  return nearestSemitone;
}

function tunePlaybackRateToNearestMajorKey(playbackRate = 1) {
  const safePlaybackRate = Math.min(4, Math.max(0.25, Number(playbackRate) || 1));
  const semitones = 12 * Math.log2(safePlaybackRate);
  const tunedSemitones = getNearestMajorKeySemitone(semitones);
  return Number((2 ** (tunedSemitones / 12)).toFixed(6));
}

function getBackendHttpEndpoint(serviceEndpoint, endpointPath) {
  if (typeof serviceEndpoint !== 'string' || !/^(https?|wss?):\/\//iu.test(serviceEndpoint)) {
    return '';
  }

  try {
    const url = new URL(serviceEndpoint);
    if (url.protocol === 'wss:') {
      url.protocol = 'https:';
    } else if (url.protocol === 'ws:') {
      url.protocol = 'http:';
    }
    url.pathname = endpointPath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function getClientBuildCommitSha() {
  const value = globalThis.VTA_BUILD_COMMIT_SHA ?? globalThis.STICKRPG_BUILD_COMMIT_SHA;
  return typeof value === 'string' ? value.trim() : '';
}

function clampVibeShaderIntensity(value) {
  return THREE.MathUtils.clamp(
    Number.isFinite(value) ? value : DEFAULT_VIBE_SHADER_INTENSITY,
    0,
    1
  );
}

function readStoredCharacterId() {
  try {
    const stored = window.localStorage?.getItem(CHARACTER_STORAGE_KEY)
      || window.localStorage?.getItem(LEGACY_CHARACTER_STORAGE_KEY)
      || '';
    if (stored) {
      window.localStorage?.setItem(CHARACTER_STORAGE_KEY, stored);
    }
    return getPlayableCharacterById(stored).id;
  } catch {
    return DEFAULT_PLAYABLE_CHARACTER_ID;
  }
}

function readStoredGameSettings() {
  try {
    const raw = window.localStorage?.getItem(GAME_SETTINGS_STORAGE_KEY)
      || window.localStorage?.getItem(LEGACY_GAME_SETTINGS_STORAGE_KEY);
    if (raw) {
      window.localStorage?.setItem(GAME_SETTINGS_STORAGE_KEY, raw);
    }
    const parsed = raw ? JSON.parse(raw) : {};
    const masterVolume = Number(parsed?.masterVolume);
    return {
      masterVolume: Number.isFinite(masterVolume)
        ? THREE.MathUtils.clamp(masterVolume, 0, 1)
        : DEFAULT_GAME_SETTINGS.masterVolume
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

function writeStoredGameSettings(settings = DEFAULT_GAME_SETTINGS) {
  try {
    window.localStorage?.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify({
      masterVolume: THREE.MathUtils.clamp(Number(settings.masterVolume), 0, 1)
    }));
  } catch {
    // Local persistence is best-effort; gameplay should continue if storage is unavailable.
  }
}

function readStoredVibeRadioVolume() {
  try {
    const raw = window.localStorage?.getItem(VIBE_RADIO_VOLUME_STORAGE_KEY);
    if (raw == null || raw === '') {
      return 0.75;
    }
    const stored = Number(raw);
    return Number.isFinite(stored) ? THREE.MathUtils.clamp(stored, 0, 1) : 0.75;
  } catch {
    return 0.75;
  }
}

function writeStoredVibeRadioVolume(volume = 0.75) {
  try {
    window.localStorage?.setItem(
      VIBE_RADIO_VOLUME_STORAGE_KEY,
      String(THREE.MathUtils.clamp(Number(volume) || 0, 0, 1))
    );
  } catch {
    // Local persistence is best-effort; radio playback should continue if storage is unavailable.
  }
}

function readStoredHotbarItemOrder() {
  try {
    const raw = window.localStorage?.getItem(HOTBAR_LAYOUT_STORAGE_KEY);
    return normalizeHotbarItemOrder(raw ? JSON.parse(raw) : DEFAULT_HOTBAR_ITEM_ORDER);
  } catch {
    return normalizeHotbarItemOrder(DEFAULT_HOTBAR_ITEM_ORDER);
  }
}

function writeStoredHotbarItemOrder(order = DEFAULT_HOTBAR_ITEM_ORDER) {
  try {
    window.localStorage?.setItem(HOTBAR_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeHotbarItemOrder(order)));
  } catch {
    // Local persistence is best-effort; gameplay should continue if storage is unavailable.
  }
}

function isLocalDebugHost() {
  const hostname = globalThis.location?.hostname ?? '';
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getChatBubbleLifetimeMs(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return CHAT_BUBBLE_MIN_LIFETIME_MS;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const estimatedWordCount = Math.max(wordCount, Math.ceil(normalized.length / 6));
  const lifetime = CHAT_BUBBLE_BASE_LIFETIME_MS + estimatedWordCount * CHAT_BUBBLE_MS_PER_WORD;
  return THREE.MathUtils.clamp(
    lifetime,
    CHAT_BUBBLE_MIN_LIFETIME_MS,
    CHAT_BUBBLE_MAX_LIFETIME_MS
  );
}

function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function getNpcVoiceDistanceVolumeScale(distance) {
  const numericDistance = Number(distance);
  if (!Number.isFinite(numericDistance) || numericDistance <= NPC_VOICE_FULL_VOLUME_DISTANCE) {
    return 1;
  }
  if (numericDistance >= NPC_VOICE_AUDIBLE_DISTANCE) {
    return 0;
  }

  const fadeProgress = THREE.MathUtils.clamp(
    (numericDistance - NPC_VOICE_FULL_VOLUME_DISTANCE)
      / (NPC_VOICE_AUDIBLE_DISTANCE - NPC_VOICE_FULL_VOLUME_DISTANCE),
    0,
    1
  );
  const smoothFade = fadeProgress * fadeProgress * (3 - (2 * fadeProgress));
  return THREE.MathUtils.clamp(1 - smoothFade, 0, 1);
}

function easeOutCubic(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - ((1 - clamped) ** 3);
}

function normalizeMoneyAmount(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function formatMoneyAmount(value) {
  const amount = normalizeMoneyAmount(value);
  const formattedAmount = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${formattedAmount}` : `$${formattedAmount}`;
}

function formatMoneyDelta(value) {
  const amount = normalizeMoneyAmount(value);
  const formattedAmount = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${formattedAmount}` : `+$${formattedAmount}`;
}

function formatPortalNumber(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return String(Number(numeric.toFixed(digits)));
}

function getPortalTriggerDistance(playerPosition, interactable) {
  if (!playerPosition || !interactable?.triggerPosition) {
    return Number.POSITIVE_INFINITY;
  }

  const triggerHalfHeight = Number(interactable.triggerHalfHeight);
  if (
    Number.isFinite(triggerHalfHeight)
    && Math.abs((interactable.triggerPosition.y ?? 0) - (playerPosition.y ?? 0)) > triggerHalfHeight
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot(
    (interactable.triggerPosition.x ?? 0) - (playerPosition.x ?? 0),
    (interactable.triggerPosition.z ?? 0) - (playerPosition.z ?? 0)
  );
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }

  material?.dispose?.();
}

function disposeObjectResources(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    disposeMaterial(node.material);
  });
}

function createBasketballShotBall() {
  const group = new THREE.Group();
  group.name = 'BasketballShotBall';

  const ballMaterial = new THREE.MeshStandardMaterial({
    color: 0xc86822,
    roughness: 0.58,
    metalness: 0.03
  });
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x20120b,
    roughness: 0.72,
    metalness: 0.02
  });
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BASKETBALL_SHOT_BALL_RADIUS, 28, 18),
    ballMaterial
  );
  ball.castShadow = true;
  ball.receiveShadow = true;
  group.add(ball);

  [
    [0, 0, 0],
    [Math.PI * 0.5, 0, 0],
    [0, Math.PI * 0.5, 0],
    [0.58, 0, 0.34],
    [-0.58, 0, -0.34]
  ].forEach((rotation, index) => {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(BASKETBALL_SHOT_BALL_RADIUS * 1.012, 0.006, 5, 54),
      seamMaterial
    );
    seam.name = `BasketballShotSeam${index + 1}`;
    seam.rotation.set(rotation[0], rotation[1], rotation[2]);
    seam.castShadow = false;
    seam.receiveShadow = true;
    group.add(seam);
  });

  return group;
}

function disposeObjectMaterials(root) {
  root?.traverse?.((node) => {
    disposeMaterial(node.material);
  });
}

function collectMaterialList(material) {
  return Array.isArray(material) ? material.filter(Boolean) : [material].filter(Boolean);
}

function cloneVector3Like(point = { x: 0, y: 0, z: 0 }) {
  return new THREE.Vector3(point.x ?? 0, point.y ?? 0, point.z ?? 0);
}

function cloneOffset(offset = [0, 0]) {
  return [
    Number(offset?.[0]) || 0,
    Number(offset?.[1]) || 0
  ];
}

function normalizeWorldMapBounds(bounds = {}) {
  const minX = Number(bounds.minX);
  const maxX = Number(bounds.maxX);
  const minZ = Number(bounds.minZ);
  const maxZ = Number(bounds.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || maxX <= minX || maxZ <= minZ) {
    return null;
  }

  return { minX, maxX, minZ, maxZ };
}

function normalizeWorldMapImageMetadata(metadata = {}) {
  const bounds = normalizeWorldMapBounds(metadata?.bounds);
  const image = typeof metadata?.image === 'string' ? metadata.image.trim() : '';
  if (!bounds || !image) {
    return null;
  }

  const capturedMs = Date.parse(metadata.capturedAt ?? '');
  const version = Number.isFinite(capturedMs) ? capturedMs : Date.now();
  return {
    src: `${image}${image.includes('?') ? '&' : '?'}v=${version}`,
    bounds,
    width: Math.max(1, Math.round(Number(metadata.width) || WORLD_MAP_CAPTURE_WIDTH)),
    height: Math.max(1, Math.round(Number(metadata.height) || WORLD_MAP_CAPTURE_HEIGHT)),
    capturedAt: typeof metadata.capturedAt === 'string' ? metadata.capturedAt : '',
    worldKey: typeof metadata.worldKey === 'string' ? metadata.worldKey : ''
  };
}

export class Game {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da6c8);
    this.scene.fog = new THREE.Fog(0x7da6c8, WORLD_FOG_NEAR, WORLD_FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 400);
    this.camera.position.copy(CAMERA_OFFSET);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.postProcessingResolution = new THREE.Vector2();

    this.root.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.hud = new Hud(this.root);
    this.input = new Input();
    this.input.attachMobileControls(this.hud.getMobileControlsRoot());
    this.input.bindActionPress('chat', () => this.maybeOpenQuickChatFromInput());
    this.frameTimingMs = new Array(FRAME_TIMING_SAMPLE_LIMIT);
    this.frameTimingSortedMs = [];
    this.frameTimingCursor = 0;
    this.frameTimingCount = 0;
    this.frameTimingSummary = {
      sampleCount: 0,
      p95Ms: 0
    };
    this.frameTimingLastSummaryAt = 0;
    this.lastAuthoritativeTransformLag = 0;
    this.lastSkippedStaleAuthoritativePosition = false;
    this.dynamicPixelRatioCap = RUNTIME_PIXEL_RATIO_CAP;
    this.lastAdaptiveRenderAdjustAt = 0;
    this.library = new ModelLibrary();
    this.characterRoster = listPlayableCharacters();
    this.desiredLocalCharacterId = readStoredCharacterId();
    this.pendingCharacterRequestId = '';
    this.characterSelectorVisible = false;
    this.characterPreviewRenderer = null;
    this.characterPreviewRendererPromise = null;
    this.characterPreviewWarmupQueued = false;
    this.characterSelectorSyncRequestId = 0;
    this.characterSelectorViewportSyncFrame = 0;
    this.phoneCharacterSyncRequestId = 0;
    this.phoneMenuVisible = false;
    this.phoneActiveAppId = '';
    this.phoneAppRefreshFrame = 0;
    this.phoneAppRefreshTimeout = 0;
    this.localCharacterSwapSequence = 0;
    this.remoteAvatarBuildRequests = new Map();
    this.remotePlayers = new Map();
    this.pendingRemotePlayers = new Set();
    this.desiredRemoteSessionIds = new Set();
    this.remoteSessionIdsToRemove = [];
    this.pickupVisuals = new Map();
    this.pendingPickupVisuals = new Set();
    this.desiredPickupIds = new Set();
    this.pickupIdsToRemove = [];
    this.combatEffects = [];
    this.currentInteractable = null;
    this.portalArrival = parsePortalArrival(window.location.search);
    this.portalRedirectInFlight = false;
    this.portalDisarmedPlacementIds = new Set();
    this.portalSpawnPlacementId = '';
    this.portalSpawnLockUntil = 0;
    this.localPlayerVelocity = new THREE.Vector3();
    this.localPlayerDelta = new THREE.Vector3();
    this.localAnimationSyncState = {};
    this.activeColliders = [];
    this.worldBuilderColliders = [];
    this.gymCheckInColliders = [];
    this.activeInteractables = [];
    this.worldBuilderInteractables = [];
    this.portalInteractables = [];
    this.gymDoorBlockers = [];
    this.gymDoorBlockersDirty = true;
    this.pickupInteractables = new Map();
    this.lastLocalPlayerSample = null;
    this.authoritativeLocalPosition = new THREE.Vector3();
    this.localAuthoritativeTargetPosition = new THREE.Vector3();
    this.remotePlayerGroundProbe = new THREE.Vector3();
    this.pickupGroundProbe = new THREE.Vector3();
    this.authoritativeLocalPositionInitialized = false;
    this.authoritativeLocalPositionChangedAt = 0;
    this.currentLayout = null;
    this.cityVisualRoot = null;
    this.currentInterior = null;
    this.interiorScenes = new Map();
    this.activeInlineShell = null;
    this.inlineShellScenes = new Map();
    this.inlineShellEntries = [];
    this.inlineShellPlacementIds = new Set();
    this.inlineShellScenesToRemove = [];
    this.worldInteractableIndicatorInlineScenes = [];
    this.builderInlineShellPreviewPlacementIds = new Set();
    this.builderInlineShellPreviewNextPlacementIds = new Set();
    this.builderInlineShellPreviewIdsToClear = [];
    this.inlineInteriorLight = null;
    this.inlineInteriorLightCenter = new THREE.Vector3();
    this.lastNpcTransportSignature = '';
    this.lastNpcFocusTargetSignature = '';
    this.npcFocusTargets = new Map();
    this.npcFocusTargetValues = new Map();
    this.taskTrackerRentIntroState = {
      pendingSeq: 0,
      activeSeq: 0,
      activeCharged: false,
      handledSeq: 0
    };
    this.taskTrackerContext = {
      localPlayerState: null,
      npcStates: null,
      worldBuilder: null,
      worldBuilderInteractables: EMPTY_INTERACTABLES,
      missionSequence: null,
      activeInteractables: EMPTY_INTERACTABLES,
      gymDoorBlockers: EMPTY_INTERACTABLES,
      rentIntroState: this.taskTrackerRentIntroState,
      getGroundHeightAt: (position) => this.getActiveGroundHeightAt(position)
    };
    this.pendingWorldPatches = [];
    this.worldLayoutReady = false;
    this.worldPatchUnsubscribe = null;
    this.combatEventUnsubscribe = null;
    this.npcService = null;
    this.npcServiceState = {
      transport: 'mock',
      connected: true,
      connectionStatus: 'local',
      connectionMessage: 'Local mock transport is active.',
      reconnectAttempt: 0,
      sessionId: 'local-player',
      connectedPlayerCount: 1,
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      npcDebug: new Map(),
      pickups: new Map()
    };
    this.emoteMenuOpen = false;
    this.projectedSpeechPosition = new THREE.Vector3();
    this.projectedSpeechScreen = { x: 0, y: 0 };
    this.speechAnchorScratch = new THREE.Vector3();
    this.visibleOverheadHealthBarIds = new Set();
    this.overheadHealthBars = [];
    this.speechBubbles = [];
    this.bartenderMenuAnchorPosition = new THREE.Vector3();
    this.aimRaycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.aimTarget = new THREE.Vector3();
    this.aimNdc = new THREE.Vector2();
    this.aimDirectionScratch = new THREE.Vector3(0, 0, 1);
    this.aimCameraForward = new THREE.Vector3();
    this.aimCameraRight = new THREE.Vector3();
    this.currentAimDirection = new THREE.Vector3(0, 0, 1);
    this.muzzleFlashResources = this.createMuzzleFlashResources();
    this.muzzleFlashPrewarmed = false;
    this.currentAimMode = false;
    this.nextPunchEmoteId = PUNCH_EMOTE_ID;
    this.pendingHipFireShot = null;
    this.hotbarItemOrder = readStoredHotbarItemOrder();
    this.hotbarSlots = createHotbarSlots({ hotbarItemOrder: this.hotbarItemOrder });
    this.selectedHotbarSlotIndex = 0;
    this.pendingHotbarWeaponId = null;
    this.pendingHotbarRequestedAt = 0;
    this.hotbarEquipIntro = {
      weaponId: '',
      startedAtMs: 0,
      endsAtMs: 0,
      token: 0,
      revealTimeoutId: 0,
      animation: null
    };
    this.activeWorkout = null;
    this.pendingWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = '';
    this.activeWorkoutPlacementId = '';
    this.gymPumpTaskConfettiPlayed = false;
    this.taskTracker = new TaskTracker();
    this.phoneMissionState = {
      missions: [],
      selectedMissionId: ''
    };
    this.phoneSkillsState = {
      skills: [],
      recentAward: null
    };
    this.phoneWalletState = {
      wallet: null,
      cash: 0,
      loading: false,
      error: ''
    };
    this.phoneStocksState = {
      market: null,
      selectedSymbol: '',
      quantity: 1,
      loading: false,
      error: ''
    };
    this.phoneMapState = {
      player: null,
      features: [],
      image: null,
      zoom: PHONE_MAP_DEFAULT_ZOOM,
      pan: { x: 0, z: 0 },
      updatedAt: 0
    };
    this.phoneMapZoom = PHONE_MAP_DEFAULT_ZOOM;
    this.phoneMapPan = { x: 0, z: 0 };
    this.worldMapImage = null;
    this.worldMapImageRequest = null;
    this.worldMapCaptureInFlight = false;
    this.gameSettings = readStoredGameSettings();
    this.hud.setSpeechAudioVolume?.(this.gameSettings.masterVolume);
    this.currentBuildCommitSha = getClientBuildCommitSha();
    this.frontendUpdateAvailable = false;
    this.frontendUpdateCommitSha = '';
    this.releaseVersionTimer = 0;
    this.releaseVersionCheckInFlight = false;
    this.releaseReloadScheduledAt = 0;
    this.releaseReloadDelayToastAt = 0;
    this.releaseReloadStarted = false;
    this.releaseVersionVisibilityHandler = null;
    this.lastConnectionHudSignature = '';
    this.lastConnectionToastStatus = '';
    this.lastSkillAwardSeq = 0;
    this.skillLevelSnapshot = new Map();
    this.lastSkillLevelUpSoundAt = -Infinity;
    this.walletRequestInFlight = false;
    this.walletRefreshAt = 0;
    this.lastPhoneMapRefreshAt = 0;
    this.missionSelectRequestInFlight = false;
    this.deliveryQuestRequestInFlight = false;
    this.deliveryQuestAutoCompleteAttemptKey = '';
    this.deliveryQuestAutoCompleteAttemptAt = 0;
    this.deliveryQuestReminderSuppressedKey = '';
    this.deliveryQuestReminderSuppressionExpiresAt = 0;
    this.gymMembershipRequestInFlight = false;
    this.stockMarketNpcId = '';
    this.stockMarketSnapshot = null;
    this.stockMarketSnapshotCharacterId = '';
    this.stockMarketSelectedSymbol = '';
    this.stockMarketQuantity = 1;
    this.stockMarketRequestInFlight = false;
    this.stockMarketRefreshAt = 0;
    this.activeInteractionMenu = null;
    this.bartenderRequestInFlight = false;
    this.pawnShopRequestInFlight = false;
    this.carDealerRequestInFlight = false;
    this.marthaRequestInFlight = false;
    this.inventoryRequestInFlight = false;
    this.blackjackNpcId = '';
    this.blackjackDealerName = 'Dealer';
    this.blackjackState = null;
    this.blackjackWager = BLACKJACK_DEFAULT_WAGER;
    this.blackjackRequestInFlight = false;
    this.blackjackPreviewMode = false;
    this.blackjackPreviewSession = null;
    this.schoolMicrogameNpcId = '';
    this.schoolMicrogameNpcName = 'Teacher';
    this.schoolMicrogameNpcModelId = 'martha';
    this.schoolMicrogamePreviewMode = false;
    this.schoolMicrogame = null;
    this.schoolMicrogameRequestInFlight = false;
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameLastTickAt = 0;
    this.schoolMicrogameSequence = 0;
    this.schoolMicrogameRandomCursor = 0;
    this.schoolMicrogameSessionActive = false;
    this.schoolMicrogameSessionRoundCount = 0;
    this.schoolMicrogameSessionXpEarned = 0;
    this.schoolTeacherPreviewRenderer = null;
    this.vibeHero = null;
    this.vibeHeroSelectedSongId = VIBE_HERO_DEFAULT_SONG_ID;
    this.vibeHeroSequence = 0;
    this.vibeHeroAudioContext = null;
    this.vibeHeroAudioMaster = null;
    this.vibeHeroAudioNodes = [];
    this.vibeHeroAudioElement = null;
    this.vibeHeroAudioPreloads = new Map();
    this.vibeRadioTracks = cloneVibeRadioTracks();
    this.vibeRadioAudio = new Audio();
    this.vibeRadioAudio.preload = 'auto';
    this.vibeRadioSelectedTrackId = '';
    this.vibeRadioPlaying = false;
    this.vibeRadioVolume = readStoredVibeRadioVolume();
    this.vibeRadioError = '';
    this.vibeRadioLoadedTrackId = '';
    this.vibeRadioLoadedSourceUrl = '';
    this.vibeRadioTimeUpdateFrame = 0;
    this.officeJobPlacementId = '';
    this.officeJanitorGameCycleIndex = 0;
    this.adminPromptOpen = false;
    this.adminPromptActiveTab = 'new';
    this.adminPromptTasks = [];
    this.adminPromptSelectedTaskId = '';
    this.adminPromptLoading = false;
    this.adminPromptLoadingVisible = false;
    this.adminPromptSubmitting = false;
    this.adminPromptError = '';
    this.adminPromptRefreshAt = 0;
    this.adminPromptRequest = null;
    this.debugMinigameRequestHandled = false;
    this.debugMinigameRequestRetryTimeout = 0;
    this.aimPoseDebugVisible = false;
    this.aimPoseDebugShowSkeleton = false;
    this.poseDebugSection = 'unarmed';
    this.shaderDebugMenuVisible = false;
    this.activeVibeShaderPresetId = DEFAULT_VIBE_SHADER_PRESET_ID;
    this.vibeShaderPresetIntensities = new Map(
      VIBE_SHADER_PRESETS.map((preset) => [preset.id, DEFAULT_VIBE_SHADER_INTENSITY])
    );
    this.cameraZoomIndex = DEFAULT_CAMERA_ZOOM_INDEX;
    this.deathCameraZoomStartedAt = -Infinity;
    this.deathCameraZoomFromLevel = CAMERA_ZOOM_LEVELS[DEFAULT_CAMERA_ZOOM_INDEX];
    this.damageCameraKickStartedAt = -Infinity;
    this.damageCameraKickEndsAt = -Infinity;
    this.damageCameraDirection = new THREE.Vector3(0, 0, 1);
    this.localStateInitialized = false;
    this.lastLocalAlive = true;
    this.lastLocalEquippedWeaponId = '';
    this.lastHudHitMarkerVisible = false;
    this.hitMarkerUntil = 0;
    this.bootCriticalReady = false;
    this.loadingProgress = 0;
    this.deferredStartupPromise = null;
    this.detailedRenderingEnabled = false;
    this.firstFrameMarked = false;
    this.lastAimPoseDebugSignature = '';
    this.bootMeasureLabels = [];
    this.worldPatchSyncRequested = false;
    this.worldPatchDrainPromise = null;
    this.remotePlayerSyncRequested = false;
    this.pickupVisualSyncRequested = false;
    this.deferredMuzzleFlashWarmupId = 0;
    this.pistolCockSound = this.createSoundEffect(assets.combat.pistolCock, { volume: 0.35 });
    this.pistolShotSound = this.createSoundEffect(assets.combat.pistolShot, { volume: 0.5 });
    this.rentChaChingSound = this.createSoundEffect(assets.audio?.chaChing, { volume: 0.75 });
    this.skillXpGainSound = this.createSoundEffect(assets.audio?.skillXpGain, { volume: 0.62 });
    this.levelUpSound = this.createSoundEffect(assets.audio?.levelUp, { volume: 0.72 });
    this.levelUpCelebrationSound = this.createSoundEffect(assets.audio?.levelUpCelebration, { volume: 0.7 });
    this.popQuizClockTickSound = this.createSoundEffect(assets.audio?.clockTick, { volume: 0.52 });
    this.phoneUnlockSound = this.createSoundEffect(assets.audio?.phoneUnlock, { volume: 0.58 });
    this.playingCardSound = this.createSoundEffect(assets.audio?.playingCard, { volume: 0.6 });
    this.typingOnKeyboardSound = this.createSoundEffect(assets.audio?.typingOnKeyboard, { volume: 0.45 });
    this.lastTaskCompleteSoundAt = -Infinity;
    this.lastTaskCompleteChaChingAt = -Infinity;
    this.moneyChangeChaChingSuppressedUntil = 0;
    this.handledRentIntroSeq = 0;
    this.rentIntroLoadingClearedAt = 0;
    this.pendingRentIntro = null;
    this.activeRentIntro = null;
    this.rentIntroCutscene = null;
    this.rentIntroCutsceneRestoreSnapNpcId = '';
    this.lastAuthoritativeMoneyAmount = null;
    this.moneyDisplayAmount = 0;
    this.moneyAnimation = null;
    this.moneyFloaters = [];
    this.moneyFloaterSequence = 0;
    this.moneyFloaterAnchor = new THREE.Vector3();
    this.skillXpFloaters = [];
    this.skillXpFloaterSequence = 0;
    this.skillXpFloaterAnchor = new THREE.Vector3();
    this.workoutLeftHandPosition = new THREE.Vector3();
    this.workoutRightHandPosition = new THREE.Vector3();
    this.workoutBarbellMidpoint = new THREE.Vector3();
    this.workoutBarbellAxis = new THREE.Vector3();
    this.workoutForward = new THREE.Vector3();
    this.workoutBarbellQuaternion = new THREE.Quaternion();
    this.basketballShotHandPosition = new THREE.Vector3();
    this.basketballShotRimPosition = new THREE.Vector3();
    this.basketballShotForward = new THREE.Vector3();
    this.basketballShotSide = new THREE.Vector3();
    this.rentIntroCutsceneForward = new THREE.Vector3();
    this.rentIntroCutsceneSide = new THREE.Vector3();
    this.rentIntroCutsceneNpcPosition = new THREE.Vector3();
    this.rentIntroCutsceneGroundCamera = new THREE.Vector3();
    this.rentIntroCutsceneThirdCamera = new THREE.Vector3();
    this.rentIntroCutsceneGroundLook = new THREE.Vector3();
    this.rentIntroCutsceneThirdLook = new THREE.Vector3();
    this.cameraOffsetScratch = new THREE.Vector3();
    this.cameraTargetPosition = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3();
    this.damageCameraSide = new THREE.Vector3();
    this.cameraOcclusionPreservePlacementIds = [];
    this.cameraOcclusionOptions = {
      preserveInteriorNodePlacementIds: this.cameraOcclusionPreservePlacementIds
    };
    this.playerCameraOcclusionRenderState = null;

    this.bindVibeRadioAudioEvents();
    this.applyVibeRadioVolume();
    this.refreshVibeRadioHud();

    this.hud.bindInteractionEvents({
      onAction: (action) => this.handleInteractionMenuAction(action),
      onCloseInteraction: () => this.closeInteractionMenu()
    });
    this.hud.bindStockMarketEvents({
      onClose: () => this.closeStockMarket(),
      onRefresh: () => void this.refreshStockMarket({ force: true }),
      onSelectStock: (symbol) => this.selectStockMarketSymbol(symbol),
      onQuantityChange: (quantity) => this.setStockMarketQuantity(quantity),
      onBuy: () => void this.handleStockTrade('buy'),
      onSell: () => void this.handleStockTrade('sell')
    });
    this.hud.bindBlackjackEvents({
      onClose: () => this.closeBlackjack(),
      onWagerChange: (wager) => this.setBlackjackWager(wager),
      onDeal: () => void this.startBlackjackRound(),
      onHit: () => void this.handleBlackjackAction('hit'),
      onStand: () => void this.handleBlackjackAction('stand'),
      onDouble: () => void this.handleBlackjackAction('double'),
      onSplit: () => void this.handleBlackjackAction('split')
    });
    this.hud.bindSchoolMicrogameEvents({
      onClose: () => this.closeSchoolMicrogame(),
      onAction: (action) => this.handleSchoolMicrogameAction(action)
    });
    this.hud.bindVibeHeroEvents({
      onClose: () => this.closeVibeHero(),
      onAction: (action) => this.handleVibeHeroAction(action)
    });
    this.hud.bindVibeRadioEvents({
      onAction: (action) => this.handleVibeRadioAction(action),
      onVolumeChange: (value) => this.setVibeRadioVolume(value)
    });
    this.hud.bindBasketballShotEvents({
      onAction: (action) => this.handleBasketballShotAction(action)
    });
    this.hud.bindAdminPromptEvents({
      onToggle: () => this.toggleAdminPromptPanel(),
      onClose: () => this.setAdminPromptOpen(false),
      onRefresh: () => void this.refreshAdminPromptTasks({ force: true }),
      onSubmit: (payload) => void this.submitAdminPromptTask(payload),
      onFollowup: (taskId, payload) => void this.submitAdminPromptFollowup(taskId, payload),
      onSelect: (taskId) => this.selectAdminPromptTask(taskId),
      onCancel: (taskId) => void this.cancelAdminPromptTask(taskId),
      onApproveDeploy: (taskId) => void this.approveAdminPromptDeploy(taskId),
      onRollback: (taskId) => void this.approveAdminPromptRollback(taskId),
      onTab: (tabId) => this.setAdminPromptTab(tabId)
    });
    this.hud.bindPhoneEvents({
      onToggle: () => this.togglePhoneMenu(),
      onClose: () => this.closePhoneMenu(),
      onOpenApp: (appId) => this.openPhoneApp(appId),
      onHome: () => this.showPhoneHome(),
      onCycleCharacter: (step) => this.cycleCharacterSelection(step),
      onSelectMission: (missionId) => void this.selectPhoneMission(missionId),
      onOpenWalletStocks: () => void this.openWalletStocks(),
      onPhoneStockRefresh: () => void this.refreshPhoneStocksSnapshot({ force: true }),
      onPhoneStockSelect: (symbol) => this.selectPhoneStockSymbol(symbol),
      onPhoneStockQuantityChange: (quantity) => this.setPhoneStockQuantity(quantity),
      onPhoneStockTrade: (side) => void this.handlePhoneStockTrade(side),
      onMapZoom: (step) => this.stepPhoneMapZoom(step),
      onMapPan: (delta) => this.panPhoneMapByScreenDelta(delta),
      onMasterVolumeChange: (value) => this.setMasterVolume(value),
      onVibeRadioAction: (action) => this.handleVibeRadioAction(action),
      onVibeRadioTrackSelect: (trackId) => this.selectVibeRadioTrack(trackId, { autoplay: true }),
      onVibeRadioVolumeChange: (value) => this.setVibeRadioVolume(value)
    });
    this.hud.bindQuickChatEvents({
      onSubmit: (message) => void this.handleQuickChatSubmit(message),
      onCancel: () => this.closeQuickChat()
    });
    this.hud.bindAimPoseDebugEvents({
      onTogglePanel: () => this.toggleAimPoseDebugPanel(),
      onFieldChange: (fieldKey, value) => this.setAimPoseDebugField(fieldKey, value),
      onReset: () => this.resetAimPoseDebug(),
      onPrint: () => this.printAimPoseDebug(),
      onToggleBones: () => this.toggleAimPoseSkeletonDebug(),
      onSelectSection: (section) => this.setPoseDebugSection(section)
    });
    this.hud.bindShaderDebugEvents({
      onToggleMenu: () => this.toggleShaderDebugMenu(),
      onCloseMenu: () => this.setShaderDebugMenuVisible(false),
      onSelectPreset: (presetId) => this.setVibeShaderPreset(presetId),
      onSetIntensity: (intensity) => this.setVibeShaderIntensity(intensity),
      onResetIntensity: () => this.resetVibeShaderIntensity()
    });
    this.hud.bindMapCaptureEvents({
      onCapture: () => void this.captureAndSaveWorldMap()
    });
    this.hud.bindZoomEvents({
      onZoomIn: () => this.stepCameraZoom(-1),
      onZoomOut: () => this.stepCameraZoom(1)
    });
    this.hud.bindHotbarEvents({
      onSelectSlot: (slotIndex) => this.selectHotbarSlot(slotIndex, { source: 'pointer' }),
      onMoveSlot: (fromSlotIndex, toSlotIndex) => this.moveHotbarSlot(fromSlotIndex, toSlotIndex)
    });
    this.hud.bindCharacterSelectorEvents({
      onTogglePanel: (visible) => this.toggleCharacterSelector(visible),
      onCycleCharacter: (step) => this.cycleCharacterSelection(step),
      onSelectCharacter: (characterId) => this.selectCharacter(characterId),
      onViewportChange: () => this.queueCharacterSelectorViewportSync()
    });
    this.refreshHotbarHud();
    this.refreshZoomHud();
    this.refreshCharacterSelectorHud();
    this.setVibeShaderPreset(DEFAULT_VIBE_SHADER_PRESET_ID, { announce: false });
    this.hud.setLoadingProgress(0);
    void this.loadWorldMapImageMetadata();

    window.addEventListener('resize', () => this.onResize());
  }

  getTargetPixelRatio() {
    const runtimeCap = Math.min(
      RUNTIME_PIXEL_RATIO_CAP,
      Math.max(ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP, Number(this.dynamicPixelRatioCap) || RUNTIME_PIXEL_RATIO_CAP)
    );
    const cap = this.detailedRenderingEnabled ? runtimeCap : BOOT_PIXEL_RATIO_CAP;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  markBoot(name) {
    try {
      performance.mark(name);
    } catch {
      // Ignore mark errors in unsupported environments.
    }
  }

  measureBoot(label, startMark, endMark) {
    try {
      performance.measure(label, startMark, endMark);
      this.bootMeasureLabels.push(label);
    } catch {
      // Ignore measure errors when a mark is missing.
    }
  }

  reportBootMetrics() {
    if (!this.bootMeasureLabels.length) {
      return;
    }

    const measures = performance.getEntriesByType('measure')
      .filter((entry) => this.bootMeasureLabels.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        durationMs: Number(entry.duration.toFixed(1))
      }));

    if (measures.length) {
      console.info('[Boot] Performance measures.', measures);
    }
  }

  mapBootLoadingProgress(progress) {
    const clampedProgress = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
    if (clampedProgress >= 1) {
      return 1;
    }

    const normalized = THREE.MathUtils.clamp(clampedProgress / 0.72, 0, 1);
    return 1 - Math.pow(1 - normalized, 1.9);
  }

  setBootLoadingProgress(progress, { render = false } = {}) {
    const nextProgress = this.mapBootLoadingProgress(progress);
    const clampedProgress = Math.max(this.loadingProgress, nextProgress);
    if (clampedProgress === this.loadingProgress) {
      if (render) {
        this.renderCurrentView();
      }
      return;
    }

    this.loadingProgress = clampedProgress;
    this.hud.setLoadingProgress(clampedProgress);
    if (render) {
      this.renderCurrentView();
    }
  }

  async warmBootPreviewFrames({ frames = 4, minDurationMs = 180 } = {}) {
    const targetFrames = Math.max(1, Math.floor(frames));
    const targetDuration = Math.max(0, Number(minDurationMs) || 0);
    const startedAt = performance.now();

    await new Promise((resolve) => {
      let completedFrames = 0;

      const step = () => {
        completedFrames += 1;
        const elapsed = performance.now() - startedAt;
        if (completedFrames >= targetFrames && elapsed >= targetDuration) {
          resolve();
          return;
        }

        window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    });
  }

  setupPostProcessing() {
    if (this.composer) {
      return;
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.getTargetPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.vibeShaderPass = new ShaderPass(createVibeShaderDefinition());
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.vibeShaderPass);
    this.composer.addPass(this.outputPass);
    this.updatePostProcessingResolution();
    this.setVibeShaderPreset(this.activeVibeShaderPresetId, { announce: false });
  }

  createMuzzleFlashResources() {
    return {
      flashMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xfff0c4,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      flareMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff7a24,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      emberMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff4a24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      sparkMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xffb161,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      coreGeometry: new THREE.SphereGeometry(0.1, 12, 12),
      plumeGeometry: new THREE.ConeGeometry(0.24, 0.9, 12, 1, true),
      bloomGeometry: new THREE.SphereGeometry(0.19, 12, 12),
      emberShellGeometry: new THREE.SphereGeometry(0.21, 10, 10),
      shockRingGeometry: new THREE.TorusGeometry(0.12, 0.022, 8, 20),
      sideFlareAGeometry: new THREE.BoxGeometry(0.045, 0.46, 0.045),
      sideFlareBGeometry: new THREE.BoxGeometry(0.04, 0.4, 0.04),
      sparkGeometries: [
        new THREE.BoxGeometry(0.035, 0.58, 0.035),
        new THREE.BoxGeometry(0.028, 0.48, 0.028),
        new THREE.BoxGeometry(0.024, 0.38, 0.024)
      ],
      sparkOffsets: [
        Object.freeze({ x: 0.12, y: 0.22, z: 0.04, zRot: 0.42 }),
        Object.freeze({ x: -0.1, y: 0.18, z: -0.05, zRot: -0.55 }),
        Object.freeze({ x: 0.03, y: 0.3, z: -0.1, zRot: 0.18 })
      ]
    };
  }

  prewarmMuzzleFlashEffect() {
    if (this.muzzleFlashPrewarmed || !this.player) {
      return;
    }

    const start = this.player.position.clone().add(new THREE.Vector3(0, 2.1, 0.55));
    const end = start.clone().add(new THREE.Vector3(0, 0, 1));
    this.createMuzzleFlashEffect(null, start, end);
    this.updateCamera();

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    for (const effect of this.combatEffects) {
      if (effect.type === 'muzzleFlash') {
        effect.expiresAt = performance.now() - 1;
      }
    }
    this.updateCombatEffects();
    this.muzzleFlashPrewarmed = true;
  }

  createSoundEffect(url, { volume = 1 } = {}) {
    if (!url) {
      return null;
    }

    return {
      url,
      volume: THREE.MathUtils.clamp(volume, 0, 1),
      template: null
    };
  }

  getEffectiveSoundVolume(soundEffect) {
    return THREE.MathUtils.clamp(
      Number(soundEffect?.volume ?? 1) * Number(this.gameSettings?.masterVolume ?? 1),
      0,
      1
    );
  }

  getSoundEffectTemplate(soundEffect) {
    if (!soundEffect) {
      return null;
    }

    if (!soundEffect.template) {
      const sound = new Audio(soundEffect.url);
      sound.preload = 'auto';
      sound.volume = this.getEffectiveSoundVolume(soundEffect);
      sound.load();
      soundEffect.template = sound;
    }

    return soundEffect.template;
  }

  playSoundEffect(
    soundEffect,
    {
      volumeScale = 1,
      playbackRate = 1,
      preservePitch = true,
      delayMs = 0
    } = {}
  ) {
    const play = () => {
      const template = this.getSoundEffectTemplate(soundEffect);
      if (!template) {
        return;
      }

      const sound = template.cloneNode();
      const rate = THREE.MathUtils.clamp(Number(playbackRate) || 1, 0.25, 4);
      const shouldPreservePitch = preservePitch !== false;
      try {
        sound.playbackRate = rate;
      } catch {
        // Some embedded browsers expose read-only media playback controls.
      }
      for (const pitchProperty of ['preservesPitch', 'mozPreservesPitch', 'webkitPreservesPitch']) {
        if (pitchProperty in sound) {
          try {
            sound[pitchProperty] = shouldPreservePitch;
          } catch {
            // Ignore unsupported pitch-preservation flags.
          }
        }
      }
      sound.volume = THREE.MathUtils.clamp(
        this.getEffectiveSoundVolume(soundEffect) * (Number(volumeScale) || 1),
        0,
        1
      );
      void sound.play().catch(() => {});
    };

    const safeDelayMs = Math.max(0, Number(delayMs) || 0);
    if (safeDelayMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(play, safeDelayMs);
      return;
    }

    play();
  }

  playOfficeJobLockError() {
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      this.playSoundEffect(this.playingCardSound, {
        playbackRate: 0.55,
        preservePitch: false,
        volumeScale: 0.7
      });
      return;
    }

    void context.resume?.().catch(() => {});
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(230, now);
    oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.34);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      THREE.MathUtils.clamp(0.14 * Number(this.gameSettings?.masterVolume ?? 1), 0.0001, 0.18),
      now + 0.012
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.38);
  }

  playTaskCompleteChaChing(delayMs = TASK_COMPLETE_CHA_CHING_DELAY_MS) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const safeDelayMs = Math.max(0, Number(delayMs) || 0);
    const scheduledAt = now + safeDelayMs;
    const lastChaChingAt = Number(this.lastTaskCompleteChaChingAt ?? -Infinity);
    if (scheduledAt - lastChaChingAt < TASK_COMPLETE_MONEY_SOUND_SUPPRESS_MS) {
      return;
    }

    this.lastTaskCompleteChaChingAt = scheduledAt;
    this.moneyChangeChaChingSuppressedUntil = Math.max(
      Number(this.moneyChangeChaChingSuppressedUntil ?? 0) || 0,
      scheduledAt + TASK_COMPLETE_MONEY_SOUND_SUPPRESS_MS
    );
    this.playSoundEffect(this.rentChaChingSound, {
      delayMs: safeDelayMs,
      volumeScale: 0.9
    });
  }

  playTaskCompleteSound({ withMoney = false } = {}) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastPlayedAt = Number(this.lastTaskCompleteSoundAt ?? -Infinity);
    if (now - lastPlayedAt >= TASK_COMPLETE_SOUND_COOLDOWN_MS) {
      this.lastTaskCompleteSoundAt = now;
      for (const layer of TASK_COMPLETE_MAJOR_KEY_LAYERS) {
        this.playSoundEffect(this.levelUpSound, {
          playbackRate: tunePlaybackRateToNearestMajorKey(layer.rawPlaybackRate),
          preservePitch: false,
          volumeScale: layer.volumeScale,
          delayMs: layer.delayMs
        });
      }
    }

    if (withMoney) {
      this.playTaskCompleteChaChing(TASK_COMPLETE_CHA_CHING_DELAY_MS);
    }
  }

  applyAudioSettings() {
    for (const soundEffect of [
      this.pistolCockSound,
      this.pistolShotSound,
      this.rentChaChingSound,
      this.skillXpGainSound,
      this.levelUpSound,
      this.levelUpCelebrationSound,
      this.popQuizClockTickSound,
      this.phoneUnlockSound,
      this.playingCardSound,
      this.typingOnKeyboardSound
    ]) {
      if (soundEffect?.template) {
        soundEffect.template.volume = this.getEffectiveSoundVolume(soundEffect);
      }
    }
    if (this.vibeHeroAudioMaster) {
      this.vibeHeroAudioMaster.gain.value = THREE.MathUtils.clamp(0.16 * Number(this.gameSettings?.masterVolume ?? 1), 0, 0.26);
    }
    if (this.vibeHeroAudioElement) {
      this.vibeHeroAudioElement.volume = this.getVibeHeroMusicVolume(this.vibeHero);
    }
    for (const audio of this.vibeHeroAudioPreloads?.values?.() ?? []) {
      audio.volume = this.getVibeHeroMusicVolume(this.vibeHero);
    }
    this.applyVibeRadioVolume();
    this.hud.setSpeechAudioVolume?.(Number(this.gameSettings?.masterVolume ?? 1));
  }

  fireLocalWeapon(aimDirection, origin = null) {
    const localPlayerState = this.getLocalPlayerState();
    if (this.isHotbarEquipIntroUseLocked(localPlayerState?.equippedWeaponId || this.getSelectedHotbarWeaponId())) {
      return false;
    }

    const didFire = this.npcService?.fireWeapon(
      { x: aimDirection?.x ?? 0, z: aimDirection?.z ?? 0 },
      Date.now(),
      origin
    ) === true;

    if (didFire && localPlayerState?.equippedWeaponId === HELD_ITEM_IDS.pistol) {
      this.playSoundEffect(this.pistolShotSound);
    }

    return didFire;
  }

  punchLocal(aimDirection) {
    const didPunch = this.npcService?.punch?.(
      { x: aimDirection?.x ?? 0, z: aimDirection?.z ?? 0 },
      Date.now()
    ) === true;

    if (didPunch) {
      const emoteId = this.nextPunchEmoteId;
      this.player?.playEmote(emoteId);
      this.nextPunchEmoteId = emoteId === PUNCH_EMOTE_ID ? PUNCH_ALT_EMOTE_ID : PUNCH_EMOTE_ID;
    }

    return didPunch;
  }

  updatePostProcessingResolution() {
    if (!this.vibeShaderPass?.uniforms?.uResolution) {
      return;
    }

    this.renderer.getDrawingBufferSize(this.postProcessingResolution);
    this.vibeShaderPass.uniforms.uResolution.value.copy(this.postProcessingResolution);
  }

  updateDrunknessEffects(localPlayerState = this.getLocalPlayerState()) {
    const level = Math.max(0, Math.min(DRUNKNESS_MAX_LEVEL, Math.floor(Number(localPlayerState?.drunknessLevel) || 0)));
    const intensity = level > 0 ? level / DRUNKNESS_MAX_LEVEL : 0;
    if (this.vibeShaderPass?.uniforms?.uDrunknessLevel) {
      this.vibeShaderPass.uniforms.uDrunknessLevel.value = level;
    }
    if (this.vibeShaderPass?.uniforms?.uDrunknessIntensity) {
      this.vibeShaderPass.uniforms.uDrunknessIntensity.value = intensity;
    }
  }

  getActiveVibeShaderPreset() {
    return getVibeShaderPreset(this.activeVibeShaderPresetId);
  }

  getVibeShaderIntensity(presetId = this.activeVibeShaderPresetId) {
    return clampVibeShaderIntensity(
      this.vibeShaderPresetIntensities.get(getVibeShaderPreset(presetId).id)
    );
  }

  setVibeShaderIntensity(intensity, { presetId = this.activeVibeShaderPresetId, announce = false } = {}) {
    const preset = getVibeShaderPreset(presetId);
    const nextIntensity = clampVibeShaderIntensity(intensity);
    this.vibeShaderPresetIntensities.set(preset.id, nextIntensity);

    if (preset.id === this.activeVibeShaderPresetId && this.vibeShaderPass?.uniforms?.uIntensity) {
      this.vibeShaderPass.uniforms.uIntensity.value = nextIntensity;
      this.characterPreviewRenderer?.setVibeShaderState({
        presetId: preset.id,
        intensity: nextIntensity
      });
    }

    this.refreshShaderDebugHud();

    if (announce && preset.id !== NO_VIBE_SHADER_PRESET_ID) {
      this.hud.showToast(`${preset.label} intensity set to ${Math.round(nextIntensity * 100)}%.`);
    }

    return nextIntensity;
  }

  resetVibeShaderIntensity(options = {}) {
    return this.setVibeShaderIntensity(DEFAULT_VIBE_SHADER_INTENSITY, options);
  }

  setShaderDebugMenuVisible(visible) {
    const nextVisible = Boolean(visible && this.canUseShaderDebug());
    if (nextVisible) {
      this.closePhoneMenu();
      this.setAimPoseDebugVisible(false);
      if (this.worldBuilder?.enabled) {
        void this.worldBuilder.setEnabled(false);
      }
    }

    this.shaderDebugMenuVisible = nextVisible;
    this.refreshShaderDebugHud();
    return this.shaderDebugMenuVisible;
  }

  toggleShaderDebugMenu() {
    if (!this.shaderDebugMenuVisible && !this.canUseShaderDebug()) {
      this.hud.showToast('Shader vibe menu is admin only.');
      return this.setShaderDebugMenuVisible(false);
    }

    const nextVisible = this.setShaderDebugMenuVisible(!this.shaderDebugMenuVisible);
    this.hud.showToast(nextVisible ? 'Shader vibe menu opened.' : 'Shader vibe menu hidden.');
    return nextVisible;
  }

  setVibeShaderPreset(presetId, { announce = true } = {}) {
    const preset = getVibeShaderPreset(presetId);
    this.activeVibeShaderPresetId = preset.id;
    const intensity = this.getVibeShaderIntensity(preset.id);

    if (this.vibeShaderPass?.uniforms?.uPreset) {
      this.vibeShaderPass.uniforms.uPreset.value = preset.index;
    }
    if (this.vibeShaderPass?.uniforms?.uIntensity) {
      this.vibeShaderPass.uniforms.uIntensity.value = intensity;
    }
    this.characterPreviewRenderer?.setVibeShaderState({
      presetId: preset.id,
      intensity
    });

    this.refreshShaderDebugHud();

    if (announce) {
      if (preset.id === NO_VIBE_SHADER_PRESET_ID) {
        this.hud.showToast('Default render pipeline restored.');
      } else {
        this.hud.showToast(`${preset.label} vibe enabled.`);
      }
    }

    return preset;
  }

  refreshShaderDebugHud() {
    const available = this.canUseShaderDebug();
    const activePreset = this.getActiveVibeShaderPreset();
    const intensity = this.getVibeShaderIntensity(activePreset.id);
    const statusText = activePreset.id === NO_VIBE_SHADER_PRESET_ID
      ? 'Default render pipeline active. Pick a preset to remix the whole scene.'
      : `${activePreset.label} is live at ${Math.round(intensity * 100)}%. Switch presets anytime to totally restyle the city.`;

    this.hud.setShaderDebugState({
      available,
      visible: Boolean(this.shaderDebugMenuVisible && available),
      activePresetId: activePreset.id,
      statusText,
      presets: VIBE_SHADER_PRESETS,
      intensity,
      intensityEnabled: activePreset.id !== NO_VIBE_SHADER_PRESET_ID
    });
  }

  storeSelectedCharacterId(characterId) {
    try {
      window.localStorage?.setItem(CHARACTER_STORAGE_KEY, characterId);
    } catch {
      // Ignore storage failures and keep the in-memory selection.
    }
  }

  getCharacterSelectorStatusText() {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.player) {
      return 'Loading fighter';
    }

    if (this.pendingCharacterRequestId && localPlayerState?.characterId !== this.pendingCharacterRequestId) {
      return 'Switching fighter';
    }

    return 'Currently selected';
  }

  async ensureCharacterPreviewRenderer() {
    if (this.characterPreviewRenderer) {
      return this.characterPreviewRenderer;
    }

    if (!this.characterPreviewRendererPromise) {
      this.characterPreviewRendererPromise = import('../ui/CharacterPreviewRenderer.js')
        .then(({ CharacterPreviewRenderer }) => {
          this.characterPreviewRenderer = new CharacterPreviewRenderer({ library: this.library });
          this.hud.setCharacterSelectorPreviewCanvas(this.characterPreviewRenderer.livePreview.renderer.domElement);
          this.characterPreviewRenderer.setVibeShaderState({
            presetId: this.activeVibeShaderPresetId,
            intensity: this.getVibeShaderIntensity(this.activeVibeShaderPresetId)
          });
          return this.characterPreviewRenderer;
        })
        .finally(() => {
          this.characterPreviewRendererPromise = null;
        });
    }

    return this.characterPreviewRendererPromise;
  }

  queueCharacterPreviewWarmup() {
    if (this.characterPreviewWarmupQueued || this.characterPreviewRenderer || this.characterPreviewRendererPromise) {
      return;
    }

    this.characterPreviewWarmupQueued = true;
    const warm = () => {
      void this.warmCharacterPreviewRenderer();
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(warm, { timeout: 5000 });
    } else {
      window.setTimeout(warm, 2200);
    }
  }

  async warmCharacterPreviewRenderer() {
    try {
      const renderer = await this.ensureCharacterPreviewRenderer();
      const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
      await renderer.setCharacter(selectedId);
      if (!this.characterSelectorVisible && !this.isPhoneCharacterAppOpen()) {
        renderer.setActive(false);
      }
    } catch (error) {
      console.warn('[CharacterSelector] Preview warmup failed.', error);
    }
  }

  async syncCharacterSelectorPreview(entries, selectedId) {
    const requestId = ++this.characterSelectorSyncRequestId;
    const renderer = await this.ensureCharacterPreviewRenderer();
    if (requestId !== this.characterSelectorSyncRequestId) {
      return;
    }

    renderer.mount(this.hud.getCharacterSelectorPreviewMount());
    renderer.setLivePreviewProfile();
    renderer.setActive(this.characterSelectorVisible);
    await renderer.setCharacter(selectedId);
    if (requestId !== this.characterSelectorSyncRequestId || !this.characterSelectorVisible) {
      return;
    }

    this.syncVisibleCharacterSelectorPortraits(entries, renderer, selectedId);
  }

  queueCharacterSelectorViewportSync() {
    if (!this.characterSelectorVisible || this.characterSelectorViewportSyncFrame) {
      return;
    }

    this.characterSelectorViewportSyncFrame = window.requestAnimationFrame(() => {
      this.characterSelectorViewportSyncFrame = 0;
      if (!this.characterSelectorVisible || !this.characterPreviewRenderer) {
        return;
      }

      const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
      this.syncVisibleCharacterSelectorPortraits(
        this.characterRoster,
        this.characterPreviewRenderer,
        selectedId
      );
    });
  }

  syncVisibleCharacterSelectorPortraits(entries, renderer, selectedId) {
    const visibleIds = new Set(
      this.hud.getVisibleCharacterSelectorCardIds({ overscanPx: 180 })
    );
    visibleIds.add(selectedId);

    for (const entry of entries) {
      if (!visibleIds.has(entry.id)) {
        continue;
      }

      const mount = this.hud.getCharacterSelectorCardPreviewMount(entry.id);
      void renderer.mountPortraitCanvas(entry.id, mount);
    }
  }

  isPhoneCharacterAppOpen() {
    return Boolean(this.phoneMenuVisible && this.phoneActiveAppId === 'character' && this.hud.isPhoneOpen());
  }

  cancelPhoneCharacterPreviewSync() {
    this.phoneCharacterSyncRequestId += 1;
    if (!this.characterSelectorVisible) {
      this.characterPreviewRenderer?.setActive(false);
    }
  }

  async syncPhoneCharacterPreview(entries, selectedId) {
    const requestId = ++this.phoneCharacterSyncRequestId;
    const renderer = await this.ensureCharacterPreviewRenderer();
    if (requestId !== this.phoneCharacterSyncRequestId || !this.isPhoneCharacterAppOpen()) {
      return;
    }

    renderer.mount(this.hud.getPhoneCharacterPreviewMount());
    renderer.setLivePreviewProfile(PHONE_CHARACTER_PREVIEW_PROFILE);
    renderer.setActive(true);
    await renderer.setCharacter(selectedId);
    if (requestId !== this.phoneCharacterSyncRequestId || !this.isPhoneCharacterAppOpen()) {
      return;
    }
  }

  refreshPhoneCharacterHud() {
    if (!this.isPhoneCharacterAppOpen()) {
      this.cancelPhoneCharacterPreviewSync();
      return;
    }

    const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    const entries = this.characterRoster.map((entry) => ({ ...entry }));
    this.hud.setPhoneCharacterState({
      selectedId,
      entries
    });

    void this.syncPhoneCharacterPreview(entries, selectedId);
  }

  refreshPhoneMissionsHud() {
    this.hud.setPhoneMissionsState(this.phoneMissionState);
  }

  refreshPhoneSkillsHud(localPlayerState = this.getLocalPlayerState()) {
    if (localPlayerState) {
      this.phoneSkillsState = {
        skills: getPlayerSkillsSnapshot(localPlayerState),
        recentAward: this.phoneSkillsState.recentAward ?? null
      };
    }
    this.hud.setPhoneSkillsState(this.phoneSkillsState);
  }

  refreshPhoneWalletHud() {
    const localPlayerState = this.getLocalPlayerState();
    this.phoneWalletState = {
      ...this.phoneWalletState,
      wallet: this.getActiveStockMarketSnapshot(localPlayerState) ?? this.phoneWalletState.wallet,
      cash: normalizeMoneyAmount(localPlayerState?.money ?? this.phoneWalletState.cash ?? 0)
    };
    this.hud.setPhoneWalletState(this.phoneWalletState);
  }

  refreshPhoneStocksHud() {
    const market = this.getActiveStockMarketSnapshot()
      ?? this.phoneStocksState.market
      ?? this.phoneWalletState.wallet;
    const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
    const listedSymbols = new Set(stocks.map((stock) => stock.symbol));
    if (!this.stockMarketSelectedSymbol || !listedSymbols.has(this.stockMarketSelectedSymbol)) {
      this.stockMarketSelectedSymbol = stocks[0]?.symbol ?? '';
    }
    this.phoneStocksState = {
      ...this.phoneStocksState,
      market,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity
    };
    this.hud.setPhoneStocksState(this.phoneStocksState);
  }

  getLocalPlayerCharacterId(localPlayerState = this.getLocalPlayerState()) {
    return getPlayableCharacterById(
      localPlayerState?.characterId
      ?? this.player?.characterId
      ?? this.desiredLocalCharacterId
    ).id;
  }

  setStockMarketSnapshot(snapshot = null, characterId = this.getLocalPlayerCharacterId()) {
    this.stockMarketSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
    this.stockMarketSnapshotCharacterId = this.stockMarketSnapshot
      ? getPlayableCharacterById(characterId).id
      : '';
  }

  clearStockMarketSnapshot() {
    this.setStockMarketSnapshot(null);
    this.phoneWalletState = {
      ...this.phoneWalletState,
      wallet: null
    };
    this.phoneStocksState = {
      ...this.phoneStocksState,
      market: null
    };
    this.walletRefreshAt = 0;
    this.stockMarketRefreshAt = 0;
  }

  getActiveStockMarketSnapshot(localPlayerState = this.getLocalPlayerState()) {
    if (!this.stockMarketSnapshot) {
      return null;
    }

    const characterId = this.getLocalPlayerCharacterId(localPlayerState);
    return this.stockMarketSnapshotCharacterId === characterId
      ? this.stockMarketSnapshot
      : null;
  }

  getStockSnapshotRefreshDelay(snapshot = null, fallbackMs = STOCK_SNAPSHOT_RETRY_MS) {
    const nextTickAt = Number(snapshot?.nextTickAt ?? 0);
    if (Number.isFinite(nextTickAt) && nextTickAt > 0) {
      const delayUntilTick = nextTickAt - Date.now() + STOCK_SNAPSHOT_TICK_GRACE_MS;
      if (delayUntilTick > 0) {
        return Math.max(750, delayUntilTick);
      }
    }

    return Math.max(750, Number(fallbackMs) || STOCK_MARKET_TICK_MS);
  }

  scheduleWalletSnapshotRefresh(snapshot = null, fallbackMs = STOCK_SNAPSHOT_RETRY_MS) {
    this.walletRefreshAt = performance.now() + this.getStockSnapshotRefreshDelay(snapshot, fallbackMs);
  }

  scheduleStockMarketRefresh(snapshot = null, fallbackMs = STOCK_MARKET_TICK_MS) {
    this.stockMarketRefreshAt = performance.now() + this.getStockSnapshotRefreshDelay(snapshot, fallbackMs);
  }

  getStockUnrealizedProfit(snapshot = null) {
    const stocks = Array.isArray(snapshot?.stocks) ? snapshot.stocks : [];
    return stocks.reduce(
      (sum, stock) => sum + normalizeMoneyAmount(stock?.unrealizedProfit ?? 0),
      0
    );
  }

  refreshPhoneMapHud(localPlayerState = this.getLocalPlayerState(), { force = false } = {}) {
    if (!this.phoneMenuVisible || this.phoneActiveAppId !== 'map') {
      return;
    }

    if (!this.worldMapImage && !this.worldMapImageRequest) {
      void this.loadWorldMapImageMetadata();
    }

    const now = performance.now();
    if (!force && now - this.lastPhoneMapRefreshAt < PHONE_MAP_REFRESH_MS) {
      return;
    }
    this.lastPhoneMapRefreshAt = now;

    this.phoneMapState = this.createPhoneMapState(localPlayerState);
    this.hud.setPhoneMapState(this.phoneMapState);
  }

  setPhoneMapZoom(zoom = this.phoneMapZoom) {
    const nextZoom = THREE.MathUtils.clamp(
      Number.isFinite(Number(zoom)) ? Number(zoom) : PHONE_MAP_DEFAULT_ZOOM,
      PHONE_MAP_MIN_ZOOM,
      PHONE_MAP_MAX_ZOOM
    );
    if (Math.abs(nextZoom - this.phoneMapZoom) < 0.001) {
      return this.phoneMapZoom;
    }

    this.phoneMapZoom = nextZoom;
    this.phoneMapPan = this.clampPhoneMapPan(this.phoneMapPan);
    this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
    return this.phoneMapZoom;
  }

  stepPhoneMapZoom(step = 0) {
    const direction = Math.sign(Number(step) || 0);
    if (!direction) {
      return this.phoneMapZoom;
    }

    return this.setPhoneMapZoom(this.phoneMapZoom + direction * PHONE_MAP_ZOOM_STEP);
  }

  isPhoneMapAppOpen() {
    return Boolean(this.phoneMenuVisible && this.phoneActiveAppId === 'map' && this.hud.isPhoneOpen());
  }

  getPhoneMapBounds(localPlayerState = this.getLocalPlayerState()) {
    const imageBounds = this.worldMapImage?.bounds ?? null;
    if (
      Number.isFinite(Number(imageBounds?.minX))
      && Number.isFinite(Number(imageBounds?.maxX))
      && Number.isFinite(Number(imageBounds?.minZ))
      && Number.isFinite(Number(imageBounds?.maxZ))
      && Number(imageBounds.maxX) > Number(imageBounds.minX)
      && Number(imageBounds.maxZ) > Number(imageBounds.minZ)
    ) {
      const minX = Number(imageBounds.minX);
      const maxX = Number(imageBounds.maxX);
      const minZ = Number(imageBounds.minZ);
      const maxZ = Number(imageBounds.maxZ);
      return {
        minX,
        maxX,
        minZ,
        maxZ,
        spanX: Math.max(1, maxX - minX),
        spanZ: Math.max(1, maxZ - minZ)
      };
    }

    const features = this.getPhoneMapPlacementFeatures();
    const points = [
      ...features.map((feature) => ({ x: Number(feature.x), z: Number(feature.z) })),
      localPlayerState ? { x: Number(localPlayerState.x), z: Number(localPlayerState.z) } : null
    ].filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z));

    if (!points.length) {
      const minX = -WORLD_GROUND_RADIUS * 0.5;
      const maxX = WORLD_GROUND_RADIUS * 0.5;
      const minZ = -WORLD_GROUND_RADIUS * 0.5;
      const maxZ = WORLD_GROUND_RADIUS * 0.5;
      return {
        minX,
        maxX,
        minZ,
        maxZ,
        spanX: Math.max(1, maxX - minX),
        spanZ: Math.max(1, maxZ - minZ)
      };
    }

    const minX = Math.min(...points.map((point) => point.x)) - 8;
    const maxX = Math.max(...points.map((point) => point.x)) + 8;
    const minZ = Math.min(...points.map((point) => point.z)) - 8;
    const maxZ = Math.max(...points.map((point) => point.z)) + 8;
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      spanX: Math.max(1, maxX - minX),
      spanZ: Math.max(1, maxZ - minZ)
    };
  }

  getPhoneMapBaseCenter(bounds = this.getPhoneMapBounds(), localPlayerState = this.getLocalPlayerState()) {
    const playerPosition = this.player?.position ?? null;
    const playerX = Number(localPlayerState?.x ?? playerPosition?.x);
    const playerZ = Number(localPlayerState?.z ?? playerPosition?.z);
    return {
      x: Number.isFinite(playerX) ? playerX : (bounds.minX + bounds.maxX) * 0.5,
      z: Number.isFinite(playerZ) ? playerZ : (bounds.minZ + bounds.maxZ) * 0.5
    };
  }

  clampPhoneMapPan(pan = this.phoneMapPan, localPlayerState = this.getLocalPlayerState()) {
    const bounds = this.getPhoneMapBounds(localPlayerState);
    const baseCenter = this.getPhoneMapBaseCenter(bounds, localPlayerState);
    const viewSpanX = bounds.spanX / this.phoneMapZoom;
    const viewSpanZ = bounds.spanZ / this.phoneMapZoom;
    const clampCenter = (value, min, max, viewSpan) => {
      if (viewSpan >= max - min) {
        return (min + max) * 0.5;
      }
      const halfSpan = viewSpan * 0.5;
      return Math.max(min + halfSpan, Math.min(max - halfSpan, value));
    };
    const centerX = clampCenter(baseCenter.x + Number(pan?.x ?? 0), bounds.minX, bounds.maxX, viewSpanX);
    const centerZ = clampCenter(baseCenter.z + Number(pan?.z ?? 0), bounds.minZ, bounds.maxZ, viewSpanZ);
    return {
      x: centerX - baseCenter.x,
      z: centerZ - baseCenter.z
    };
  }

  setPhoneMapPan(pan = this.phoneMapPan) {
    const nextPan = this.clampPhoneMapPan(pan);
    if (
      Math.abs(nextPan.x - this.phoneMapPan.x) < 0.001
      && Math.abs(nextPan.z - this.phoneMapPan.z) < 0.001
    ) {
      return this.phoneMapPan;
    }

    this.phoneMapPan = nextPan;
    this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
    return this.phoneMapPan;
  }

  panPhoneMapByWorldDelta({ x = 0, z = 0 } = {}) {
    if (!this.isPhoneMapAppOpen()) {
      return this.phoneMapPan;
    }

    return this.setPhoneMapPan({
      x: this.phoneMapPan.x + (Number(x) || 0),
      z: this.phoneMapPan.z + (Number(z) || 0)
    });
  }

  panPhoneMapByScreenDelta({
    pixelDeltaX = 0,
    pixelDeltaY = 0,
    width = PHONE_MAP_WIDTH,
    height = PHONE_MAP_HEIGHT
  } = {}) {
    if (!this.isPhoneMapAppOpen()) {
      return this.phoneMapPan;
    }

    const bounds = this.getPhoneMapBounds();
    const safeWidth = Math.max(1, Number(width) || PHONE_MAP_WIDTH);
    const safeHeight = Math.max(1, Number(height) || PHONE_MAP_HEIGHT);
    const viewSpanX = bounds.spanX / this.phoneMapZoom;
    const viewSpanZ = bounds.spanZ / this.phoneMapZoom;
    return this.panPhoneMapByWorldDelta({
      x: -((Number(pixelDeltaX) || 0) / safeWidth) * viewSpanX,
      z: -((Number(pixelDeltaY) || 0) / safeHeight) * viewSpanZ
    });
  }

  handlePhoneMapKeyboardInput(deltaSeconds = 0) {
    if (!this.isPhoneMapAppOpen()) {
      return;
    }

    const x = (this.input.isPressed('KeyD') ? 1 : 0) - (this.input.isPressed('KeyA') ? 1 : 0);
    const z = (this.input.isPressed('KeyS') ? 1 : 0) - (this.input.isPressed('KeyW') ? 1 : 0);
    if (!x && !z) {
      return;
    }

    const length = Math.hypot(x, z) || 1;
    const bounds = this.getPhoneMapBounds();
    const viewSpanX = bounds.spanX / this.phoneMapZoom;
    const viewSpanZ = bounds.spanZ / this.phoneMapZoom;
    const scale = Math.max(0, Number(deltaSeconds) || 0) * PHONE_MAP_KEY_PAN_VIEW_FRACTION_PER_SECOND;
    this.panPhoneMapByWorldDelta({
      x: (x / length) * viewSpanX * scale,
      z: (z / length) * viewSpanZ * scale
    });
  }

  getAdminKey() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('adminKey')?.trim() ?? '';
    } catch {
      return '';
    }
  }

  getWorldMapCaptureEndpoint() {
    const backendEndpoint = getBackendHttpEndpoint(this.npcService?.endpoint, WORLD_MAP_CAPTURE_ENDPOINT);
    if (backendEndpoint) {
      return backendEndpoint;
    }

    return new URL(WORLD_MAP_CAPTURE_ENDPOINT, window.location.href).toString();
  }

  getAdminAgentTasksEndpoint(pathname = '') {
    const serviceEndpoint = this.npcService?.endpoint;
    const suffix = String(pathname ?? '').trim();
    const endpointPath = `${ADMIN_AGENT_TASKS_ENDPOINT}${suffix ? `/${suffix.replace(/^\/+/, '')}` : ''}`;
    const backendEndpoint = getBackendHttpEndpoint(serviceEndpoint, endpointPath);
    if (backendEndpoint) {
      return backendEndpoint;
    }

    return new URL(endpointPath, window.location.href).toString();
  }

  isAdminPromptAutoDeployAvailable() {
    try {
      const url = new URL(window.location.href);
      return ['1', 'true', 'yes'].includes(String(url.searchParams.get('agentAutoDeploy') ?? '').toLowerCase());
    } catch {
      return false;
    }
  }

  canUseAdminPrompt() {
    return Boolean(this.isLocalAdmin() && this.getAdminKey());
  }

  refreshAdminPromptHud() {
    const available = this.canUseAdminPrompt();
    const context = this.getAdminPromptContext();
    if (!available) {
      this.hud.setAdminPromptState({
        available: false,
        open: false,
        activeTab: this.adminPromptActiveTab,
        tasks: this.adminPromptTasks,
        selectedTaskId: this.adminPromptSelectedTaskId,
        loading: false,
        submitting: false,
        error: '',
        contextLabel: context.contextLabel
      });
      return;
    }

    this.hud.setAdminPromptState({
      available: true,
      open: this.adminPromptOpen,
      activeTab: this.adminPromptActiveTab,
      tasks: this.adminPromptTasks,
      selectedTaskId: this.adminPromptSelectedTaskId,
      loading: this.adminPromptLoadingVisible,
      submitting: this.adminPromptSubmitting,
      error: this.adminPromptError,
      autoDeployAvailable: this.isAdminPromptAutoDeployAvailable(),
      contextLabel: context.contextLabel
    });
  }

  getAdminPromptVectorSnapshot(vector = null) {
    if (!vector) {
      return null;
    }

    return {
      x: Number(vector.x) || 0,
      y: Number(vector.y) || 0,
      z: Number(vector.z) || 0
    };
  }

  getAdminPromptInteractableSnapshot(interactable = null) {
    if (!interactable) {
      return null;
    }

    const position = this.getAdminPromptVectorSnapshot(interactable.position);
    const distance = position && this.player?.position
      ? Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z)
      : 0;
    return {
      kind: String(interactable.kind ?? ''),
      prompt: String(interactable.prompt ?? ''),
      actionText: String(interactable.actionText ?? ''),
      label: String(interactable.label ?? interactable.npc?.name ?? interactable.item?.label ?? ''),
      placementId: String(interactable.placementId ?? ''),
      npcId: String(interactable.npcId ?? ''),
      pickupId: String(interactable.pickupId ?? ''),
      gameId: String(interactable.gameId ?? ''),
      itemId: String(interactable.itemId ?? interactable.item?.id ?? ''),
      position,
      distance: Number(distance.toFixed(2)) || 0
    };
  }

  getAdminPromptContext() {
    if (this.hud.isVibeHeroOpen()) {
      const editorMode = this.vibeHero?.editorMode === true;
      return {
        contextType: editorMode ? 'vibe_hero_chart_editor' : 'vibe_hero',
        contextLabel: `${editorMode ? 'Vibe Hero Editor' : 'Vibe Hero'}: ${this.vibeHero?.song?.title ?? 'Song Select'}`,
        gameId: VIBE_HERO_GAME_ID
      };
    }

    if (this.hud.isSchoolMicrogameOpen()) {
      const gameId = this.schoolMicrogame?.round?.gameId ?? SCHOOL_MICROGAME_DEFAULT_ID;
      const definition = getSchoolMicrogameDefinition(gameId);
      return {
        contextType: 'school_minigame',
        contextLabel: `School: ${definition?.shortTitle ?? definition?.title ?? gameId}`,
        gameId
      };
    }

    if (this.hud.isBlackjackOpen()) {
      return {
        contextType: 'blackjack',
        contextLabel: `Blackjack: ${this.blackjackDealerName || 'Dealer'}`,
        gameId: 'blackjack'
      };
    }

    if (this.hud.isStockMarketOpen()) {
      return {
        contextType: 'stock_market',
        contextLabel: this.stockMarketSelectedSymbol ? `Stocks: ${this.stockMarketSelectedSymbol}` : 'Stock Market',
        gameId: 'stock-market'
      };
    }

    if (this.activeWorkout) {
      const activityConfig = this.activeWorkout.activityConfig ?? getWorkoutActivityConfig(this.activeWorkout);
      return {
        contextType: 'gym',
        contextLabel: `Gym: ${activityConfig?.label ?? this.activeWorkout.phase ?? 'Workout'}`,
        gameId: activityConfig?.id ?? 'gym'
      };
    }

    if (this.hud.isPhoneOpen()) {
      return {
        contextType: this.phoneActiveAppId ? `phone_${this.phoneActiveAppId}` : 'phone',
        contextLabel: this.phoneActiveAppId ? `Phone: ${this.phoneActiveAppId}` : 'Phone',
        gameId: this.phoneActiveAppId || 'phone'
      };
    }

    if (this.worldBuilder?.enabled) {
      const selectedPlacement = this.worldBuilder.getSelectedPlacement?.();
      const hoveredPlacement = this.worldBuilder.getHoveredPlacement?.();
      const activeItem = this.worldBuilder.activeItem;
      const label = selectedPlacement?.label
        || hoveredPlacement?.label
        || activeItem?.label
        || this.worldBuilder.activeCategory?.label
        || 'World Builder';
      return {
        contextType: 'world_builder',
        contextLabel: `Builder: ${label}`,
        gameId: 'world-builder'
      };
    }

    const interactable = this.getAdminPromptInteractableSnapshot(this.currentInteractable);
    if (interactable) {
      return {
        contextType: interactable.kind || 'interaction',
        contextLabel: interactable.prompt || interactable.actionText || interactable.label || interactable.kind || 'Interaction',
        gameId: interactable.gameId || interactable.kind || 'interaction'
      };
    }

    return {
      contextType: 'game',
      contextLabel: 'Game',
      gameId: ''
    };
  }

  getAdminPromptSnapshot() {
    const context = this.getAdminPromptContext();
    const playerPosition = this.player?.position;
    const localPlayerState = this.getLocalPlayerState();
    const selectedPlacement = this.worldBuilder?.getSelectedPlacement?.();
    const hoveredPlacement = this.worldBuilder?.getHoveredPlacement?.();
    const activeStockMarketSnapshot = this.getActiveStockMarketSnapshot(localPlayerState);
    const selectedStock = activeStockMarketSnapshot?.stocks?.find?.((stock) => stock.symbol === this.stockMarketSelectedSymbol) ?? null;
    const snapshot = {
      url: window.location.href,
      buildVersion: this.currentBuildCommitSha,
      context,
      admin: {
        sessionId: this.npcServiceState?.sessionId ?? '',
        isAdmin: this.isLocalAdmin(),
        position: this.getAdminPromptVectorSnapshot(playerPosition),
        rotationY: Number(this.player?.object?.rotation?.y ?? 0) || 0,
        characterId: this.desiredLocalCharacterId,
        money: Number(localPlayerState?.money ?? 0) || 0,
        health: Number(localPlayerState?.health ?? 0) || 0,
        selectedMissionId: String(localPlayerState?.selectedMissionId ?? '')
      },
      ui: {
        phoneOpen: this.hud.isPhoneOpen(),
        phoneActiveAppId: this.phoneActiveAppId,
        stockMarketOpen: this.hud.isStockMarketOpen(),
        blackjackOpen: this.hud.isBlackjackOpen(),
        schoolMicrogameOpen: this.hud.isSchoolMicrogameOpen(),
        vibeHeroOpen: this.hud.isVibeHeroOpen(),
        basketballShotOpen: this.hud.isBasketballShotOpen(),
        worldBuilderEnabled: Boolean(this.worldBuilder?.enabled),
        quickChatOpen: this.hud.isQuickChatOpen()
      },
      nearestInteractable: this.getAdminPromptInteractableSnapshot(this.currentInteractable),
      vibeHero: this.vibeHero
        ? {
            gameId: VIBE_HERO_GAME_ID,
            songId: this.vibeHero.selectedSongId ?? '',
            title: this.vibeHero.song?.title ?? '',
            phase: this.vibeHero.phase ?? '',
            editorMode: this.vibeHero.editorMode === true,
            editorPaused: this.vibeHero.editorPaused === true,
            editorRecording: this.vibeHero.editorRecording === true,
            noteCount: Array.isArray(this.vibeHero.notes) ? this.vibeHero.notes.length : 0,
            currentTimeMs: this.vibeHero.currentTimeMs ?? 0,
            remainingMs: this.vibeHero.remainingMs ?? 0,
            score: this.vibeHero.score ?? 0,
            combo: this.vibeHero.combo ?? 0,
            hits: this.vibeHero.hits ?? 0,
            misses: this.vibeHero.misses ?? 0,
            resultTitle: this.vibeHero.resultTitle ?? '',
            resultDetail: this.vibeHero.resultDetail ?? ''
          }
        : null,
      schoolMicrogame: this.schoolMicrogame
        ? {
            gameId: this.schoolMicrogame.round?.gameId ?? '',
            round: this.schoolMicrogame.round ?? null,
            data: this.schoolMicrogame.data ?? null,
            phase: this.schoolMicrogame.phase ?? '',
            remainingMs: this.schoolMicrogame.remainingMs ?? 0,
            resultTitle: this.schoolMicrogame.resultTitle ?? '',
            resultDetail: this.schoolMicrogame.resultDetail ?? '',
            npcId: this.schoolMicrogameNpcId,
            npcName: this.schoolMicrogameNpcName,
            npcModelId: this.schoolMicrogameNpcModelId
          }
        : null,
      blackjack: this.blackjackState
        ? {
            dealerName: this.blackjackDealerName,
            wager: this.blackjackWager,
            state: this.blackjackState
          }
        : null,
      stockMarket: activeStockMarketSnapshot
        ? {
            selectedSymbol: this.stockMarketSelectedSymbol,
            quantity: this.stockMarketQuantity,
            marketMood: activeStockMarketSnapshot.marketMood ?? '',
            netWorth: activeStockMarketSnapshot.netWorth ?? 0,
            stockProfit: this.getStockUnrealizedProfit(activeStockMarketSnapshot),
            selectedStock
          }
        : null,
      phone: {
        activeAppId: this.phoneActiveAppId,
        selectedMissionId: String(localPlayerState?.selectedMissionId ?? ''),
        selectedStockSymbol: this.phoneStocksState?.selectedSymbol ?? '',
        walletCash: this.phoneWalletState?.cash ?? 0
      },
      worldBuilder: this.worldBuilder
        ? {
            enabled: this.worldBuilder.enabled,
            activeCategoryId: this.worldBuilder.state?.activeCategoryId ?? '',
            activeGroupId: this.worldBuilder.activeGroupId ?? '',
            activeItem: this.worldBuilder.activeItem
              ? {
                  id: this.worldBuilder.activeItem.id,
                  label: this.worldBuilder.activeItem.label,
                  layer: this.worldBuilder.activeItem.layer
                }
              : null,
            selectedPlacement,
            hoveredPlacement,
            activeNpcEditorPlacementId: this.worldBuilder.activeNpcEditorPlacementId ?? '',
            activeBuildingEditorPlacementId: this.worldBuilder.activeBuildingEditorPlacementId ?? ''
          }
        : null,
      workout: this.activeWorkout
        ? {
            phase: this.activeWorkout.phase ?? '',
            placementId: this.activeWorkoutPlacementId,
            activityId: this.activeWorkout.activityConfig?.id ?? '',
            label: this.activeWorkout.activityConfig?.label ?? ''
          }
        : null,
      recentTaskTargetLabel: context.contextLabel
    };

    try {
      return JSON.parse(JSON.stringify(snapshot));
    } catch {
      return snapshot;
    }
  }

  getAdminPromptCreatedBy() {
    return String(this.npcServiceState?.sessionId ?? 'in-game-admin');
  }

  async refreshAdminPromptTasks({ force = false, showLoading = true } = {}) {
    if (!this.canUseAdminPrompt()) {
      this.adminPromptTasks = [];
      this.adminPromptError = '';
      this.adminPromptLoading = false;
      this.adminPromptLoadingVisible = false;
      this.refreshAdminPromptHud();
      return;
    }
    if (this.adminPromptLoading || (!force && performance.now() < this.adminPromptRefreshAt)) {
      return;
    }

    const adminKey = this.getAdminKey();
    this.adminPromptLoading = true;
    this.adminPromptLoadingVisible = Boolean(showLoading);
    this.adminPromptError = '';
    if (showLoading) {
      this.refreshAdminPromptHud();
    }
    try {
      const url = new URL(this.getAdminAgentTasksEndpoint());
      url.searchParams.set('adminKey', adminKey);
      url.searchParams.set('limit', '80');
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not refresh Codex tasks.');
      }

      this.adminPromptTasks = Array.isArray(result.tasks) ? result.tasks : [];
      if (
        this.adminPromptSelectedTaskId
        && !this.adminPromptTasks.some((task) => task.id === this.adminPromptSelectedTaskId)
      ) {
        this.adminPromptSelectedTaskId = '';
      }
      if (this.adminPromptActiveTab !== 'new' && !this.adminPromptSelectedTaskId && this.adminPromptTasks.length > 0) {
        this.adminPromptSelectedTaskId = this.adminPromptTasks[0].id;
      }
      this.adminPromptRefreshAt = performance.now() + ADMIN_PROMPT_TASK_REFRESH_MS;
    } catch (error) {
      console.warn('[AgentTasks] Refresh failed.', error);
      this.adminPromptError = error?.message ?? 'Codex task refresh failed.';
    } finally {
      this.adminPromptLoading = false;
      this.adminPromptLoadingVisible = false;
      this.refreshAdminPromptHud();
    }
  }

  setAdminPromptOpen(open) {
    const nextOpen = Boolean(open && this.canUseAdminPrompt());
    if (open && !nextOpen) {
      this.hud.showToast('Prompt is admin only.');
    }
    this.adminPromptOpen = nextOpen;
    this.refreshAdminPromptHud();
    if (nextOpen) {
      void this.refreshAdminPromptTasks({ force: true });
    }
  }

  toggleAdminPromptPanel() {
    this.setAdminPromptOpen(!this.adminPromptOpen);
  }

  setAdminPromptTab(tabId = '') {
    this.adminPromptActiveTab = ['new', 'threads'].includes(String(tabId))
      ? String(tabId)
      : 'threads';
    this.refreshAdminPromptHud();
  }

  selectAdminPromptTask(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.adminPromptTasks.some((task) => task.id === id)) {
      return;
    }

    this.adminPromptSelectedTaskId = id;
    this.adminPromptActiveTab = 'threads';
    this.refreshAdminPromptHud();
  }

  async submitAdminPromptTask({ prompt = '', mode = 'preview' } = {}) {
    if (!this.canUseAdminPrompt()) {
      this.hud.showToast('Prompt is admin only.');
      return;
    }
    if (this.adminPromptSubmitting) {
      return;
    }

    const cleanedPrompt = String(prompt ?? '').trim();
    if (cleanedPrompt.length < 8) {
      this.adminPromptError = 'Add a longer prompt.';
      this.refreshAdminPromptHud();
      return;
    }

    const requestedMode = String(mode ?? 'preview') === 'auto' && this.isAdminPromptAutoDeployAvailable()
      ? 'auto'
      : 'preview';
    const context = this.getAdminPromptContext();
    this.adminPromptSubmitting = true;
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: this.getAdminKey(),
          createdBy: this.getAdminPromptCreatedBy(),
          scope: ADMIN_PROMPT_TASK_SCOPE,
          contextType: context.contextType,
          contextLabel: context.contextLabel,
          gameId: context.gameId,
          prompt: cleanedPrompt,
          mode: requestedMode,
          snapshot: this.getAdminPromptSnapshot()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not submit Codex task.');
      }

      this.adminPromptOpen = true;
      this.adminPromptActiveTab = 'threads';
      this.adminPromptSelectedTaskId = result.task?.id ?? '';
      this.hud.clearAdminPromptText();
      this.hud.showToast('Codex task queued.');
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Submit failed.', error);
      this.adminPromptError = error?.message ?? 'Codex task submit failed.';
    } finally {
      this.adminPromptSubmitting = false;
      this.refreshAdminPromptHud();
    }
  }

  async submitAdminPromptFollowup(taskId = '', { prompt = '', mode = 'preview' } = {}) {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }
    if (this.adminPromptSubmitting) {
      return;
    }

    const cleanedPrompt = String(prompt ?? '').trim();
    if (cleanedPrompt.length < 8) {
      this.adminPromptError = 'Add a longer follow-up.';
      this.refreshAdminPromptHud();
      return;
    }

    const requestedMode = String(mode ?? 'preview') === 'auto' && this.isAdminPromptAutoDeployAvailable()
      ? 'auto'
      : 'preview';
    const context = this.getAdminPromptContext();
    this.adminPromptSubmitting = true;
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/followups`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: this.getAdminKey(),
          createdBy: this.getAdminPromptCreatedBy(),
          scope: ADMIN_PROMPT_TASK_SCOPE,
          contextType: context.contextType,
          contextLabel: context.contextLabel,
          gameId: context.gameId,
          prompt: cleanedPrompt,
          mode: requestedMode,
          snapshot: this.getAdminPromptSnapshot()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not submit follow-up.');
      }

      this.adminPromptActiveTab = 'threads';
      this.adminPromptSelectedTaskId = result.task?.id ?? id;
      this.hud.showToast('Follow-up queued.');
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Follow-up failed.', error);
      this.adminPromptError = error?.message ?? 'Prompt follow-up failed.';
    } finally {
      this.adminPromptSubmitting = false;
      this.refreshAdminPromptHud();
    }
  }

  async cancelAdminPromptTask(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }

    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/cancel`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: this.getAdminKey(),
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not cancel Codex task.');
      }
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Cancel failed.', error);
      this.adminPromptError = error?.message ?? 'Codex task cancel failed.';
      this.refreshAdminPromptHud();
    }
  }

  async approveAdminPromptDeploy(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }

    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/approve-deploy`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: this.getAdminKey(),
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not approve deploy.');
      }
      this.hud.showToast('Deploy approved for worker.');
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Deploy approval failed.', error);
      this.adminPromptError = error?.message ?? 'Codex deploy approval failed.';
      this.refreshAdminPromptHud();
    }
  }

  async approveAdminPromptRollback(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }

    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/rollback`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey: this.getAdminKey(),
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not approve rollback.');
      }
      this.hud.showToast('Rollback approved for worker.');
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Rollback approval failed.', error);
      this.adminPromptError = error?.message ?? 'Codex rollback approval failed.';
      this.refreshAdminPromptHud();
    }
  }

  updateAdminPromptPolling() {
    if (!this.adminPromptOpen || !this.canUseAdminPrompt()) {
      return;
    }

    void this.refreshAdminPromptTasks({ showLoading: false });
  }

  refreshMapCaptureHud() {
    this.hud.setMapCaptureState({
      visible: this.isLocalAdmin(),
      busy: this.worldMapCaptureInFlight
    });
  }

  async loadWorldMapImageMetadata({ force = false } = {}) {
    if (this.worldMapImageRequest) {
      return this.worldMapImageRequest;
    }

    this.worldMapImageRequest = (async () => {
      try {
        const url = `${WORLD_MAP_IMAGE_METADATA_URL}${force ? `?v=${Date.now()}` : ''}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          if (response.status !== 404) {
            console.warn('[Map] World map metadata request failed.', response.status);
          }
          this.worldMapImage = null;
          return null;
        }

        this.worldMapImage = normalizeWorldMapImageMetadata(await response.json());
        if (this.phoneMenuVisible && this.phoneActiveAppId === 'map') {
          this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
        }
        return this.worldMapImage;
      } catch (error) {
        console.warn('[Map] Could not load world map image metadata.', error);
        this.worldMapImage = null;
        return null;
      } finally {
        this.worldMapImageRequest = null;
      }
    })();

    return this.worldMapImageRequest;
  }

  getWorldMapCaptureBounds({ width = WORLD_MAP_CAPTURE_WIDTH, height = WORLD_MAP_CAPTURE_HEIGHT } = {}) {
    const features = this.getPhoneMapPlacementFeatures();
    const bounds = features.reduce((box, feature) => {
      const x = Number(feature.x);
      const z = Number(feature.z);
      const halfWidth = Math.max(0.5, Number(feature.width ?? 1) * 0.5);
      const halfDepth = Math.max(0.5, Number(feature.depth ?? 1) * 0.5);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return box;
      }

      box.minX = Math.min(box.minX, x - halfWidth);
      box.maxX = Math.max(box.maxX, x + halfWidth);
      box.minZ = Math.min(box.minZ, z - halfDepth);
      box.maxZ = Math.max(box.maxZ, z + halfDepth);
      return box;
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    });

    const playerPosition = this.player?.position;
    if (Number.isFinite(playerPosition?.x) && Number.isFinite(playerPosition?.z)) {
      bounds.minX = Math.min(bounds.minX, playerPosition.x);
      bounds.maxX = Math.max(bounds.maxX, playerPosition.x);
      bounds.minZ = Math.min(bounds.minZ, playerPosition.z);
      bounds.maxZ = Math.max(bounds.maxZ, playerPosition.z);
    }

    if (![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)) {
      bounds.minX = -WORLD_GROUND_RADIUS * 0.5;
      bounds.maxX = WORLD_GROUND_RADIUS * 0.5;
      bounds.minZ = -WORLD_GROUND_RADIUS * 0.5;
      bounds.maxZ = WORLD_GROUND_RADIUS * 0.5;
    }

    const padding = 9;
    bounds.minX -= padding;
    bounds.maxX += padding;
    bounds.minZ -= padding;
    bounds.maxZ += padding;

    const targetAspect = Math.max(0.1, Number(width) / Math.max(1, Number(height)));
    let spanX = Math.max(1, bounds.maxX - bounds.minX);
    let spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
    const currentAspect = spanX / spanZ;
    if (currentAspect > targetAspect) {
      const nextSpanZ = spanX / targetAspect;
      const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
      bounds.minZ = centerZ - nextSpanZ * 0.5;
      bounds.maxZ = centerZ + nextSpanZ * 0.5;
    } else {
      const nextSpanX = spanZ * targetAspect;
      const centerX = (bounds.minX + bounds.maxX) * 0.5;
      bounds.minX = centerX - nextSpanX * 0.5;
      bounds.maxX = centerX + nextSpanX * 0.5;
    }

    spanX = Math.max(1, bounds.maxX - bounds.minX);
    spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
    return { ...bounds, spanX, spanZ, centerX, centerZ };
  }

  collectWorldMapCaptureHiddenObjects() {
    const objects = [
      this.player?.object,
      this.worldBuilder?.gridHelper,
      this.worldBuilder?.previewRoot,
      this.worldBuilder?.selectionRing,
      this.worldBuilder?.npcTargetPickMarker,
      this.worldBuilder?.worldRenderer?.npcDebugRoot
    ];

    for (const avatar of this.remotePlayers?.values?.() ?? []) {
      objects.push(avatar?.object, avatar?.debugHelper);
    }

    for (const visual of this.pickupVisuals?.values?.() ?? []) {
      objects.push(visual?.object);
    }

    for (const rendered of this.worldBuilder?.worldRenderer?.renderedPlacements?.values?.() ?? []) {
      if (rendered?.actor?.object) {
        objects.push(rendered.actor.object);
      }
      if (rendered?.actor?.pickProxy) {
        objects.push(rendered.actor.pickProxy);
      }
    }

    return [...new Set(objects.filter(Boolean))];
  }

  async captureWorldMapDataUrl({
    width = WORLD_MAP_CAPTURE_WIDTH,
    height = WORLD_MAP_CAPTURE_HEIGHT,
    bounds = this.getWorldMapCaptureBounds({ width, height })
  } = {}) {
    if (!this.renderer || !this.scene) {
      throw new Error('Renderer is not ready.');
    }

    const outputWidth = Math.max(256, Math.min(4096, Math.round(Number(width) || WORLD_MAP_CAPTURE_WIDTH)));
    const outputHeight = Math.max(256, Math.min(4096, Math.round(Number(height) || WORLD_MAP_CAPTURE_HEIGHT)));
    const mapCamera = new THREE.OrthographicCamera(
      -bounds.spanX * 0.5,
      bounds.spanX * 0.5,
      bounds.spanZ * 0.5,
      -bounds.spanZ * 0.5,
      1,
      1000
    );
    mapCamera.position.set(bounds.centerX, 420, bounds.centerZ);
    mapCamera.up.set(0, 0, -1);
    mapCamera.lookAt(bounds.centerX, 0, bounds.centerZ);
    mapCamera.updateProjectionMatrix();

    const previousSize = this.renderer.getSize(new THREE.Vector2());
    const previousPixelRatio = this.renderer.getPixelRatio();
    const previousRenderTarget = this.renderer.getRenderTarget();
    const previousFog = this.scene.fog;
    const hiddenObjects = this.collectWorldMapCaptureHiddenObjects();
    const previousVisibility = hiddenObjects.map((object) => [object, object.visible]);

    try {
      this.worldBuilder?.clearCameraOcclusion?.();
      for (const object of hiddenObjects) {
        object.visible = false;
      }
      this.scene.fog = null;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(outputWidth, outputHeight, false);
      this.renderer.setRenderTarget(null);
      this.renderWorldMapCaptureFrame(mapCamera, {
        width: outputWidth,
        height: outputHeight
      });

      const dataUrl = this.renderer.domElement.toDataURL('image/webp', WORLD_MAP_CAPTURE_QUALITY);
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        throw new Error('This browser could not export the map as WebP.');
      }
      return dataUrl;
    } finally {
      for (const [object, visible] of previousVisibility) {
        object.visible = visible;
      }
      this.scene.fog = previousFog;
      this.renderer.setRenderTarget(previousRenderTarget);
      this.renderer.setPixelRatio(previousPixelRatio);
      this.renderer.setSize(previousSize.x, previousSize.y, false);
      this.composer?.setPixelRatio?.(this.getTargetPixelRatio());
      this.composer?.setSize?.(window.innerWidth, window.innerHeight);
      this.updatePostProcessingResolution();
      this.renderCurrentView();
    }
  }

  renderWorldMapCaptureFrame(mapCamera, { width, height } = {}) {
    let mapComposer = null;
    let mapVibeShaderPass = null;
    let mapOutputPass = null;

    try {
      mapComposer = new EffectComposer(this.renderer);
      mapComposer.setPixelRatio(1);
      mapComposer.setSize(width, height);

      const mapRenderPass = new RenderPass(this.scene, mapCamera);
      mapVibeShaderPass = new ShaderPass(createVibeShaderDefinition());
      mapOutputPass = new OutputPass();
      mapComposer.addPass(mapRenderPass);
      mapComposer.addPass(mapVibeShaderPass);
      mapComposer.addPass(mapOutputPass);

      const defaultPreset = getVibeShaderPreset(DEFAULT_VIBE_SHADER_PRESET_ID);
      if (mapVibeShaderPass.uniforms?.uPreset) {
        mapVibeShaderPass.uniforms.uPreset.value = defaultPreset.index;
      }
      if (mapVibeShaderPass.uniforms?.uIntensity) {
        mapVibeShaderPass.uniforms.uIntensity.value = DEFAULT_VIBE_SHADER_INTENSITY;
      }
      if (mapVibeShaderPass.uniforms?.uResolution) {
        mapVibeShaderPass.uniforms.uResolution.value.set(width, height);
      }
      if (mapVibeShaderPass.uniforms?.uTime) {
        mapVibeShaderPass.uniforms.uTime.value = performance.now() * 0.001;
      }

      mapComposer.render();
    } catch (error) {
      console.error('[WorldMap] Satellite map shader render failed. Falling back to plain map render.', error);
      this.renderer.render(this.scene, mapCamera);
    } finally {
      mapVibeShaderPass?.dispose?.();
      mapOutputPass?.dispose?.();
      mapComposer?.dispose?.();
    }
  }

  async captureAndSaveWorldMap() {
    if (this.worldMapCaptureInFlight) {
      return;
    }

    const adminKey = this.getAdminKey();
    if (!this.isLocalAdmin() || !adminKey) {
      this.hud.showToast('Map capture is admin only.');
      return;
    }

    if (this.currentInterior?.scene) {
      this.hud.showToast('Exit interiors before capturing the city map.');
      return;
    }

    this.worldMapCaptureInFlight = true;
    this.refreshMapCaptureHud();
    try {
      this.hud.showToast('Capturing city map...');
      const width = WORLD_MAP_CAPTURE_WIDTH;
      const height = WORLD_MAP_CAPTURE_HEIGHT;
      const bounds = this.getWorldMapCaptureBounds({ width, height });
      const dataUrl = await this.captureWorldMapDataUrl({ width, height, bounds });
      const response = await fetch(this.getWorldMapCaptureEndpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adminKey,
          dataUrl,
          bounds: normalizeWorldMapBounds(bounds),
          width,
          height
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not save map image.');
      }

      await this.loadWorldMapImageMetadata({ force: true });
      this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
      const sizeKb = Math.max(1, Math.round(Number(result.bytes ?? 0) / 1024));
      this.hud.showToast(`Phone map captured (${sizeKb} KB).`);
    } catch (error) {
      console.warn('[Map] Capture failed.', error);
      this.hud.showToast(error?.message ?? 'Map capture failed.');
    } finally {
      this.worldMapCaptureInFlight = false;
      this.refreshMapCaptureHud();
    }
  }

  refreshPhoneSettingsHud() {
    this.hud.setPhoneSettingsState({
      masterVolume: this.gameSettings.masterVolume
    });
  }

  bindVibeRadioAudioEvents() {
    if (!this.vibeRadioAudio) {
      return;
    }

    const refresh = () => this.scheduleVibeRadioHudRefresh();
    this.vibeRadioAudio.addEventListener('timeupdate', refresh);
    this.vibeRadioAudio.addEventListener('durationchange', refresh);
    this.vibeRadioAudio.addEventListener('loadedmetadata', refresh);
    this.vibeRadioAudio.addEventListener('play', () => {
      this.vibeRadioPlaying = true;
      this.vibeRadioError = '';
      this.refreshVibeRadioHud();
    });
    this.vibeRadioAudio.addEventListener('pause', () => {
      this.vibeRadioPlaying = false;
      this.refreshVibeRadioHud();
    });
    this.vibeRadioAudio.addEventListener('ended', () => {
      this.playNextVibeRadioTrack({ wrap: true });
    });
    this.vibeRadioAudio.addEventListener('error', () => {
      this.vibeRadioPlaying = false;
      this.vibeRadioError = 'Track unavailable';
      this.refreshVibeRadioHud();
    });
  }

  getVibeRadioSelectedTrack() {
    return this.vibeRadioTracks.find((track) => track.id === this.vibeRadioSelectedTrackId)
      ?? this.vibeRadioTracks[0]
      ?? null;
  }

  getVibeRadioAudioDuration() {
    const duration = Number(this.vibeRadioAudio?.duration ?? 0);
    return Number.isFinite(duration) ? duration : 0;
  }

  getVibeRadioAudioCurrentTime() {
    const currentTime = Number(this.vibeRadioAudio?.currentTime ?? 0);
    return Number.isFinite(currentTime) ? currentTime : 0;
  }

  getEffectiveVibeRadioVolume() {
    return THREE.MathUtils.clamp(
      Number(this.vibeRadioVolume ?? 0.75) * Number(this.gameSettings?.masterVolume ?? 1),
      0,
      1
    );
  }

  applyVibeRadioVolume() {
    if (!this.vibeRadioAudio) {
      return;
    }

    this.vibeRadioAudio.volume = this.getEffectiveVibeRadioVolume();
  }

  getVibeRadioHudState() {
    return {
      tracks: this.vibeRadioTracks,
      selectedTrackId: this.vibeRadioSelectedTrackId,
      playing: this.vibeRadioPlaying,
      volume: this.vibeRadioVolume,
      currentTime: this.getVibeRadioAudioCurrentTime(),
      duration: this.getVibeRadioAudioDuration(),
      error: this.vibeRadioError
    };
  }

  refreshVibeRadioHud() {
    this.hud.setVibeRadioState(this.getVibeRadioHudState());
  }

  scheduleVibeRadioHudRefresh() {
    if (this.vibeRadioTimeUpdateFrame) {
      return;
    }

    this.vibeRadioTimeUpdateFrame = window.requestAnimationFrame(() => {
      this.vibeRadioTimeUpdateFrame = 0;
      this.refreshVibeRadioHud();
    });
  }

  syncVibeRadioTracksFromLayout(layout = this.currentLayout) {
    const nextTracks = cloneVibeRadioTracks(layout?.vibeRadioTracks);
    const previousSelectedTrackId = this.vibeRadioSelectedTrackId;
    this.vibeRadioTracks = nextTracks;

    const selectedStillExists = nextTracks.some((track) => track.id === previousSelectedTrackId);
    this.vibeRadioSelectedTrackId = selectedStillExists
      ? previousSelectedTrackId
      : nextTracks[0]?.id ?? '';

    const selectedTrack = this.getVibeRadioSelectedTrack();
    const loadedSourceChanged = Boolean(
      this.vibeRadioLoadedTrackId
      && selectedTrack?.id === this.vibeRadioLoadedTrackId
      && selectedTrack.sourceUrl !== this.vibeRadioLoadedSourceUrl
    );

    if (!this.vibeRadioSelectedTrackId) {
      this.stopVibeRadioPlayback({ clearSource: true });
    } else if (
      loadedSourceChanged
      || (this.vibeRadioLoadedTrackId && this.vibeRadioLoadedTrackId !== this.vibeRadioSelectedTrackId)
    ) {
      this.stopVibeRadioPlayback({ clearSource: true });
    }

    this.refreshVibeRadioHud();
  }

  stopVibeRadioPlayback({ clearSource = false } = {}) {
    if (this.vibeRadioAudio) {
      this.vibeRadioAudio.pause();
      if (clearSource) {
        this.vibeRadioAudio.removeAttribute('src');
        this.vibeRadioAudio.load();
        this.vibeRadioLoadedTrackId = '';
        this.vibeRadioLoadedSourceUrl = '';
      }
    }
    this.vibeRadioPlaying = false;
    this.refreshVibeRadioHud();
  }

  loadVibeRadioTrack(track = this.getVibeRadioSelectedTrack()) {
    if (!track?.id || !track.sourceUrl || !this.vibeRadioAudio) {
      return false;
    }

    if (
      this.vibeRadioLoadedTrackId === track.id
      && this.vibeRadioLoadedSourceUrl === track.sourceUrl
      && this.vibeRadioAudio.src
    ) {
      return true;
    }

    this.vibeRadioAudio.pause();
    this.vibeRadioAudio.src = track.sourceUrl;
    this.vibeRadioAudio.preload = 'auto';
    this.vibeRadioLoadedTrackId = track.id;
    this.vibeRadioLoadedSourceUrl = track.sourceUrl;
    this.vibeRadioError = '';
    this.applyVibeRadioVolume();
    this.vibeRadioAudio.load();
    return true;
  }

  async playVibeRadioTrack(track = this.getVibeRadioSelectedTrack()) {
    if (!track) {
      this.hud.showToast('Vibe radio has no tracks yet.');
      this.refreshVibeRadioHud();
      return false;
    }

    if (!this.loadVibeRadioTrack(track)) {
      this.vibeRadioError = 'Missing track source';
      this.hud.showToast('This Vibe Radio track needs a source.');
      this.refreshVibeRadioHud();
      return false;
    }

    try {
      await this.vibeRadioAudio.play();
      this.vibeRadioPlaying = true;
      this.vibeRadioError = '';
      this.refreshVibeRadioHud();
      return true;
    } catch (error) {
      console.warn('[VibeRadio] Playback failed.', error);
      this.vibeRadioPlaying = false;
      this.vibeRadioError = error?.name === 'NotAllowedError' ? '' : 'Track unavailable';
      this.refreshVibeRadioHud();
      if (this.vibeRadioError) {
        this.hud.showToast('Could not play that Vibe Radio track.');
      }
      return false;
    }
  }

  selectVibeRadioTrack(trackId = '', { autoplay = false } = {}) {
    const normalizedTrackId = String(trackId ?? '').trim();
    const track = this.vibeRadioTracks.find((entry) => entry.id === normalizedTrackId) ?? null;
    if (!track) {
      return false;
    }

    const changed = this.vibeRadioSelectedTrackId !== track.id;
    this.vibeRadioSelectedTrackId = track.id;
    this.vibeRadioError = '';
    if (changed) {
      this.vibeRadioLoadedTrackId = '';
      this.vibeRadioLoadedSourceUrl = '';
      if (this.vibeRadioAudio) {
        this.vibeRadioAudio.pause();
        this.vibeRadioAudio.removeAttribute('src');
        this.vibeRadioAudio.load();
      }
      this.vibeRadioPlaying = false;
    }

    this.refreshVibeRadioHud();
    if (autoplay) {
      void this.playVibeRadioTrack(track);
    }
    return true;
  }

  toggleVibeRadioPlayback() {
    if (this.vibeRadioPlaying && !this.vibeRadioAudio?.paused) {
      this.vibeRadioAudio.pause();
      this.vibeRadioPlaying = false;
      this.refreshVibeRadioHud();
      return;
    }

    void this.playVibeRadioTrack();
  }

  playNextVibeRadioTrack({ direction = 1, wrap = true, autoplay = true } = {}) {
    if (!this.vibeRadioTracks.length) {
      this.refreshVibeRadioHud();
      return false;
    }

    const currentIndex = Math.max(
      0,
      this.vibeRadioTracks.findIndex((track) => track.id === this.vibeRadioSelectedTrackId)
    );
    const nextIndex = currentIndex + Math.sign(direction || 1);
    const resolvedIndex = wrap
      ? (nextIndex + this.vibeRadioTracks.length) % this.vibeRadioTracks.length
      : THREE.MathUtils.clamp(nextIndex, 0, this.vibeRadioTracks.length - 1);
    return this.selectVibeRadioTrack(this.vibeRadioTracks[resolvedIndex]?.id ?? '', { autoplay });
  }

  rewindVibeRadio() {
    if (!this.vibeRadioTracks.length) {
      return;
    }

    if (this.getVibeRadioAudioCurrentTime() > 3 && this.vibeRadioAudio) {
      this.vibeRadioAudio.currentTime = 0;
      this.refreshVibeRadioHud();
      return;
    }

    this.playNextVibeRadioTrack({ direction: -1, wrap: true, autoplay: this.vibeRadioPlaying });
  }

  fastForwardVibeRadio() {
    if (!this.vibeRadioTracks.length) {
      return;
    }

    if (this.vibeRadioTracks.length === 1 && this.vibeRadioAudio) {
      const duration = this.getVibeRadioAudioDuration();
      this.vibeRadioAudio.currentTime = duration
        ? Math.min(duration, this.getVibeRadioAudioCurrentTime() + VIBE_RADIO_SEEK_SECONDS)
        : this.getVibeRadioAudioCurrentTime() + VIBE_RADIO_SEEK_SECONDS;
      this.refreshVibeRadioHud();
      return;
    }

    this.playNextVibeRadioTrack({ direction: 1, wrap: true, autoplay: this.vibeRadioPlaying });
  }

  setVibeRadioVolume(volume = this.vibeRadioVolume) {
    this.vibeRadioVolume = THREE.MathUtils.clamp(Number(volume) || 0, 0, 1);
    writeStoredVibeRadioVolume(this.vibeRadioVolume);
    this.applyVibeRadioVolume();
    this.refreshVibeRadioHud();
  }

  handleVibeRadioAction(action = '') {
    switch (String(action ?? '').trim()) {
      case 'rewind':
        this.rewindVibeRadio();
        break;
      case 'forward':
        this.fastForwardVibeRadio();
        break;
      case 'play':
        this.toggleVibeRadioPlayback();
        break;
      default:
        break;
    }
  }

  refreshActivePhoneAppHud(localPlayerState = this.getLocalPlayerState(), { forceMap = false } = {}) {
    if (this.phoneActiveAppId !== 'character') {
      this.cancelPhoneCharacterPreviewSync();
    }

    switch (this.phoneActiveAppId) {
      case 'character':
        this.refreshPhoneCharacterHud();
        break;
      case 'missions':
        this.refreshPhoneMissionsHud();
        break;
      case 'vibe-radio':
        this.refreshVibeRadioHud();
        break;
      case 'skills':
        this.refreshPhoneSkillsHud(localPlayerState);
        break;
      case 'wallet':
        this.refreshPhoneWalletHud();
        break;
      case 'stocks':
        this.refreshPhoneStocksHud();
        break;
      case 'map':
        this.refreshPhoneMapHud(localPlayerState, { force: forceMap });
        break;
      case 'settings':
        this.refreshPhoneSettingsHud();
        break;
      default:
        break;
    }
  }

  scheduleActivePhoneAppHudRefresh(localPlayerState = this.getLocalPlayerState(), { forceMap = false } = {}) {
    if (this.phoneAppRefreshFrame) {
      window.cancelAnimationFrame(this.phoneAppRefreshFrame);
    }
    if (this.phoneAppRefreshTimeout) {
      window.clearTimeout(this.phoneAppRefreshTimeout);
      this.phoneAppRefreshTimeout = 0;
    }

    const scheduledAppId = this.phoneActiveAppId;
    this.phoneAppRefreshFrame = window.requestAnimationFrame(() => {
      this.phoneAppRefreshFrame = 0;
      if (!this.phoneMenuVisible || !scheduledAppId || this.phoneActiveAppId !== scheduledAppId) {
        return;
      }

      const refresh = () => {
        if (!this.phoneMenuVisible || this.phoneActiveAppId !== scheduledAppId) {
          return;
        }
        this.refreshActivePhoneAppHud(localPlayerState, { forceMap });
      };
      const queueRefresh = () => {
        this.phoneAppRefreshTimeout = window.setTimeout(() => {
          this.phoneAppRefreshTimeout = 0;
          refresh();
        }, 0);
      };

      if (scheduledAppId === 'character') {
        this.phoneAppRefreshFrame = window.requestAnimationFrame(() => {
          this.phoneAppRefreshFrame = 0;
          queueRefresh();
        });
        return;
      }

      this.phoneAppRefreshTimeout = window.setTimeout(() => {
        this.phoneAppRefreshTimeout = 0;
        refresh();
      }, 0);
    });
  }

  refreshPhoneAppHud(localPlayerState = this.getLocalPlayerState(), { forceMap = false } = {}) {
    if (this.phoneMenuVisible) {
      if (this.phoneActiveAppId) {
        this.refreshActivePhoneAppHud(localPlayerState, { forceMap });
      }
      return;
    }

    this.cancelPhoneCharacterPreviewSync();
    this.refreshPhoneCharacterHud();
    this.refreshPhoneMissionsHud();
    this.refreshVibeRadioHud();
    this.refreshPhoneSkillsHud(localPlayerState);
    this.refreshPhoneWalletHud();
    this.refreshPhoneStocksHud();
    this.refreshPhoneMapHud(localPlayerState, { force: forceMap });
    this.refreshPhoneSettingsHud();
  }

  refreshCharacterSelectorHud() {
    const available = this.canUseCharacterSelector();
    const visible = available && this.characterSelectorVisible;
    const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    const entries = this.characterRoster.map((entry) => ({ ...entry }));
    this.hud.setCharacterSelectorState({
      available,
      visible,
      selectedId,
      statusText: this.getCharacterSelectorStatusText(),
      entries
    });

    if (!visible) {
      this.characterSelectorSyncRequestId += 1;
      if (this.characterSelectorViewportSyncFrame) {
        window.cancelAnimationFrame(this.characterSelectorViewportSyncFrame);
        this.characterSelectorViewportSyncFrame = 0;
      }
      if (!this.isPhoneCharacterAppOpen()) {
        this.characterPreviewRenderer?.setActive(false);
      }
      return;
    }

    void this.syncCharacterSelectorPreview(entries, selectedId);
  }

  setCharacterSelectorVisible(visible) {
    if (visible) {
      this.closePhoneMenu();
    }

    this.characterSelectorVisible = Boolean(visible) && this.canUseCharacterSelector();
    this.refreshCharacterSelectorHud();
    return this.characterSelectorVisible;
  }

  toggleCharacterSelector(visible = !this.characterSelectorVisible) {
    if (visible && !this.canUseCharacterSelector()) {
      this.hud.showToast('Character selector is admin only.');
      return this.setCharacterSelectorVisible(false);
    }

    return this.setCharacterSelectorVisible(visible);
  }

  canOpenPhoneMenu() {
    return Boolean(
      this.player
      && !this.hud.isLoadingVisible()
      && !this.worldBuilder?.enabled
      && !this.hud.isPhoneOpen()
      && !this.hud.isQuickChatOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen()
      && !this.hud.isAdminPromptOpen()
      && !this.characterSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
  }

  openPhoneMenu() {
    if (!this.canOpenPhoneMenu()) {
      return false;
    }

    this.phoneMenuVisible = true;
    this.phoneActiveAppId = '';
    this.hud.setPhoneState({ visible: true, activeAppId: this.phoneActiveAppId });
    this.playSoundEffect(this.phoneUnlockSound);
    return true;
  }

  closePhoneMenu() {
    this.phoneMenuVisible = false;
    this.phoneActiveAppId = '';
    if (this.phoneAppRefreshFrame) {
      window.cancelAnimationFrame(this.phoneAppRefreshFrame);
      this.phoneAppRefreshFrame = 0;
    }
    if (this.phoneAppRefreshTimeout) {
      window.clearTimeout(this.phoneAppRefreshTimeout);
      this.phoneAppRefreshTimeout = 0;
    }
    this.cancelPhoneCharacterPreviewSync();
    this.hud.setPhoneState({ visible: false, activeAppId: '' });
    return false;
  }

  togglePhoneMenu() {
    if (this.hud.isPhoneOpen() || this.phoneMenuVisible) {
      return this.closePhoneMenu();
    }

    return this.openPhoneMenu();
  }

  openPhoneApp(appId = '') {
    if (!this.phoneMenuVisible) {
      return;
    }

    this.phoneActiveAppId = String(appId ?? '');
    if (this.phoneActiveAppId !== 'character') {
      this.cancelPhoneCharacterPreviewSync();
    }
    this.hud.setPhoneState({ visible: true, activeAppId: this.phoneActiveAppId });
    this.scheduleActivePhoneAppHudRefresh(this.getLocalPlayerState(), { forceMap: true });
    if (this.phoneActiveAppId === 'wallet' || this.phoneActiveAppId === 'stocks') {
      void this.refreshWalletSnapshot({ force: true });
    }
  }

  showPhoneHome() {
    if (!this.phoneMenuVisible) {
      return;
    }

    this.phoneActiveAppId = '';
    if (this.phoneAppRefreshFrame) {
      window.cancelAnimationFrame(this.phoneAppRefreshFrame);
      this.phoneAppRefreshFrame = 0;
    }
    if (this.phoneAppRefreshTimeout) {
      window.clearTimeout(this.phoneAppRefreshTimeout);
      this.phoneAppRefreshTimeout = 0;
    }
    this.cancelPhoneCharacterPreviewSync();
    this.hud.setPhoneState({ visible: true, activeAppId: '' });
  }

  async selectPhoneMission(missionId = '') {
    if (this.missionSelectRequestInFlight) {
      return;
    }

    const normalizedMissionId = String(missionId ?? '').trim();
    if (!normalizedMissionId || !this.npcService?.selectMission) {
      return;
    }

    this.missionSelectRequestInFlight = true;
    try {
      const result = await this.npcService.selectMission(normalizedMissionId);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That mission is not available.');
        return;
      }

      const selectedMissionId = String(result.selectedMissionId ?? normalizedMissionId).trim();
      const localPlayerState = this.getLocalPlayerState();
      if (localPlayerState) {
        const nextLocalPlayerState = {
          ...localPlayerState,
          selectedMissionId
        };
        if (this.npcServiceState.sessionId) {
          this.npcServiceState.players.set(this.npcServiceState.sessionId, nextLocalPlayerState);
        }
        this.syncTaskHud(nextLocalPlayerState);
      }
    } catch (error) {
      this.hud.showToast(error?.message ?? 'Could not select that mission.');
    } finally {
      this.missionSelectRequestInFlight = false;
    }
  }

  getPhoneMapPlacementFeatures() {
    const layout = this.worldBuilder?.getLayout?.() ?? this.currentLayout ?? {};
    const features = [];
    for (const placement of [...(layout.tiles ?? []), ...(layout.props ?? [])]) {
      const item = getBuilderItemById(placement?.itemId);
      const cellX = Number(placement?.cell?.[0] ?? placement?.cellX);
      const cellZ = Number(placement?.cell?.[1] ?? placement?.cellZ);
      const center = Number.isFinite(cellX) && Number.isFinite(cellZ) && item
        ? getTileCenterWorldPosition(item, cellX, cellZ, placement.rotationQuarterTurns ?? 0)
        : {
            x: Number(placement?.x ?? placement?.position?.[0]),
            z: Number(placement?.z ?? placement?.position?.[1])
          };
      if (!Number.isFinite(center?.x) || !Number.isFinite(center?.z)) {
        continue;
      }

      const label = String(item?.label ?? placement?.label ?? placement?.itemId ?? '').trim();
      const key = `${placement?.itemId ?? ''} ${label}`.toLowerCase();
      const [footprintWidth = 1, footprintDepth = 1] = item?.layer === 'tile'
        ? getTileFootprintWorldSize(item, placement.rotationQuarterTurns ?? 0)
        : (item?.size ?? [1, 1]);
      const width = Math.max(1, Number(footprintWidth) || 1);
      const depth = Math.max(1, Number(footprintDepth) || 1);
      const kind = key.includes('road')
        ? 'road'
        : key.includes('gym')
          ? 'gym'
          : key.includes('bank')
            ? 'bank'
            : key.includes('casino')
              ? 'casino'
              : key.includes('barbell') || key.includes('snatch')
                ? 'workout'
                : placement?.layer === 'prop'
                  ? 'prop'
                  : 'building';
      features.push({
        id: placement?.id ?? `${placement?.itemId}:${features.length}`,
        kind,
        label,
        x: center.x,
        z: center.z,
        width,
        depth
      });
    }

    for (const npc of this.npcServiceState.npcs?.values?.() ?? []) {
      if (npc.alive === false || npc.mode === 'hidden' || npc.mode === 'dead') {
        continue;
      }

      const x = Number(npc.x ?? npc.position?.[0]);
      const z = Number(npc.z ?? npc.position?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        continue;
      }

      const kind = isDeliveryQuestGiver(npc.id, npc)
        ? 'shady'
        : isStockMarketNpc(npc)
          ? 'stock'
          : isBlackjackDealerNpc(npc)
            ? 'blackjack'
            : 'npc';
      if (kind === 'npc') {
        continue;
      }

      features.push({
        id: npc.id,
        kind,
        label: npc.name ?? '',
        x,
        z,
        width: 1,
        depth: 1
      });
    }

    return features;
  }

  createPhoneMapState(localPlayerState = this.getLocalPlayerState()) {
    const playerPosition = this.player?.position ?? null;
    const playerX = Number(localPlayerState?.x ?? playerPosition?.x);
    const playerZ = Number(localPlayerState?.z ?? playerPosition?.z);
    const playerRotationY = Number(localPlayerState?.rotationY ?? this.player?.rotationY ?? 0);
    return {
      player: Number.isFinite(playerX) && Number.isFinite(playerZ)
        ? { x: playerX, z: playerZ, rotationY: Number.isFinite(playerRotationY) ? playerRotationY : 0 }
        : null,
      features: this.getPhoneMapPlacementFeatures(),
      image: this.worldMapImage,
      zoom: this.phoneMapZoom,
      minZoom: PHONE_MAP_MIN_ZOOM,
      maxZoom: PHONE_MAP_MAX_ZOOM,
      pan: this.phoneMapPan,
      updatedAt: Date.now()
    };
  }

  async refreshWalletSnapshot({ force = false, passive = false } = {}) {
    if (this.walletRequestInFlight || !this.npcService?.getWalletSnapshot || !this.npcServiceState?.sessionId) {
      return;
    }

    const now = performance.now();
    if (!force && now < this.walletRefreshAt) {
      if (!passive) {
        this.refreshPhoneWalletHud();
        this.refreshPhoneStocksHud();
      }
      return;
    }

    this.walletRequestInFlight = true;
    this.walletRefreshAt = now + STOCK_SNAPSHOT_RETRY_MS;
    const requestCharacterId = this.getLocalPlayerCharacterId();
    if (!passive) {
      this.phoneWalletState = {
        ...this.phoneWalletState,
        loading: true,
        error: ''
      };
      this.phoneStocksState = {
        ...this.phoneStocksState,
        loading: true,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.refreshPhoneStocksHud();
    }

    try {
      const result = await this.npcService?.getWalletSnapshot?.();
      if (!result?.ok || !result.wallet) {
        const error = result?.error ?? 'Wallet sync failed.';
        this.scheduleWalletSnapshotRefresh(null, STOCK_SNAPSHOT_RETRY_MS);
        if (!passive) {
          this.phoneWalletState = {
            ...this.phoneWalletState,
            loading: false,
            error
          };
          this.phoneStocksState = {
            ...this.phoneStocksState,
            loading: false,
            error
          };
          this.refreshPhoneWalletHud();
          this.refreshPhoneStocksHud();
        }
        return;
      }

      if (requestCharacterId !== this.getLocalPlayerCharacterId()) {
        this.scheduleWalletSnapshotRefresh(null, 750);
        if (!passive) {
          this.phoneWalletState = {
            ...this.phoneWalletState,
            loading: false
          };
          this.phoneStocksState = {
            ...this.phoneStocksState,
            loading: false
          };
          this.refreshPhoneWalletHud();
          this.refreshPhoneStocksHud();
        }
        return;
      }

      this.setStockMarketSnapshot(result.wallet, requestCharacterId);
      this.scheduleWalletSnapshotRefresh(result.wallet, STOCK_MARKET_TICK_MS);
      this.phoneWalletState = {
        ...this.phoneWalletState,
        wallet: result.wallet,
        cash: normalizeMoneyAmount(result.wallet.cash ?? result.money ?? 0),
        loading: false,
        error: ''
      };
      this.phoneStocksState = {
        ...this.phoneStocksState,
        market: result.wallet,
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.refreshPhoneStocksHud();
    } catch (error) {
      console.warn('[Wallet] Snapshot failed.', error);
      this.scheduleWalletSnapshotRefresh(null, STOCK_SNAPSHOT_RETRY_MS);
      if (!passive) {
        this.phoneWalletState = {
          ...this.phoneWalletState,
          loading: false,
          error: 'Wallet sync failed.'
        };
        this.phoneStocksState = {
          ...this.phoneStocksState,
          loading: false,
          error: 'Wallet sync failed.'
        };
        this.refreshPhoneWalletHud();
        this.refreshPhoneStocksHud();
      }
    } finally {
      this.walletRequestInFlight = false;
    }
  }

  async refreshPhoneStocksSnapshot({ force = false } = {}) {
    await this.refreshWalletSnapshot({ force });
  }

  openWalletStocks() {
    this.openPhoneApp('stocks');
  }

  setMasterVolume(value = DEFAULT_GAME_SETTINGS.masterVolume) {
    const masterVolume = THREE.MathUtils.clamp(Number(value), 0, 1);
    this.gameSettings = {
      ...this.gameSettings,
      masterVolume
    };
    writeStoredGameSettings(this.gameSettings);
    this.applyAudioSettings();
    this.refreshPhoneSettingsHud();
  }

  cycleCharacterSelection(step = 1) {
    if (!this.canChangeCharacter()) {
      this.hud.showToast('Character selection is not ready.');
      return;
    }

    const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    const currentIndex = this.characterRoster.findIndex((entry) => entry.id === selectedId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + step + this.characterRoster.length) % this.characterRoster.length;
    this.selectCharacter(this.characterRoster[nextIndex]?.id ?? selectedId);
  }

  syncPreferredCharacterSelection() {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.npcService || !this.npcServiceState.sessionId) {
      return;
    }

    const desiredId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    if (localPlayerState?.characterId === desiredId) {
      this.pendingCharacterRequestId = '';
      return;
    }

    if (this.pendingCharacterRequestId === desiredId) {
      return;
    }

    this.pendingCharacterRequestId = desiredId;
    this.npcService.setCharacter?.(desiredId);
    this.refreshCharacterSelectorHud();
    this.refreshPhoneCharacterHud();
  }

  selectCharacter(characterId) {
    if (!this.canChangeCharacter()) {
      this.hud.showToast('Character selection is not ready.');
      return;
    }

    const nextCharacterId = getPlayableCharacterById(characterId).id;
    if (this.desiredLocalCharacterId === nextCharacterId && this.player?.characterId === nextCharacterId) {
      this.refreshCharacterSelectorHud();
      this.refreshPhoneCharacterHud();
      return;
    }

    this.desiredLocalCharacterId = nextCharacterId;
    this.storeSelectedCharacterId(nextCharacterId);
    this.pendingCharacterRequestId = '';
    this.clearStockMarketSnapshot();
    this.refreshCharacterSelectorHud();
    this.refreshPhoneCharacterHud();
    this.refreshPhoneWalletHud();
    this.refreshPhoneStocksHud();
    void this.swapLocalPlayerCharacter(nextCharacterId);
    this.syncPreferredCharacterSelection();
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    if (!this.isLocalAdmin()) {
      this.hud.showToast('World builder is admin only.');
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
    if (nextEnabled) {
      this.closePhoneMenu();
      this.closeQuickChat();
      this.setCharacterSelectorVisible(false);
      this.setShaderDebugMenuVisible(false);
      this.setAimPoseDebugVisible(false);
      this.worldBuilder.setFocusFromWorldPosition(this.player?.position);
    }
    void this.worldBuilder.setEnabled(nextEnabled);
    if (nextEnabled) {
      this.refreshShaderDebugHud();
    }
    this.refreshZoomHud();
    this.hud.showToast(nextEnabled ? 'World builder enabled.' : 'World builder disabled.');
  }

  isLocalAdmin() {
    return this.getLocalPlayerState()?.isAdmin === true;
  }

  canUseCharacterSelector() {
    return this.isLocalAdmin();
  }

  canChangeCharacter() {
    return Boolean(this.player);
  }

  canUseAimPoseDebug() {
    return this.isLocalAdmin();
  }

  canUseShaderDebug() {
    return this.isLocalAdmin();
  }

  syncAdminAccess() {
    const isAdmin = this.isLocalAdmin();
    void this.worldBuilder?.setCanEdit(isAdmin);

    if (!this.canUseCharacterSelector()) {
      this.characterSelectorVisible = false;
    }

    if (!this.canUseAimPoseDebug()) {
      this.aimPoseDebugVisible = false;
      this.aimPoseDebugShowSkeleton = false;
      this.player?.setAimPoseDebugVisible(false);
    }

    if (!this.canUseShaderDebug()) {
      this.shaderDebugMenuVisible = false;
    }

    this.refreshAimPoseDebugHud();
    this.refreshShaderDebugHud();
    this.refreshAdminPositionHud();
    this.refreshMapCaptureHud();
    this.refreshAdminPromptHud();
  }

  refreshAdminPositionHud() {
    const isAdmin = this.isLocalAdmin();
    const position = this.player?.position;
    const rotationY = this.player?.object?.rotation?.y ?? 0;

    this.hud.setAdminPositionState({
      visible: Boolean(isAdmin && position),
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      z: position?.z ?? 0,
      heading: THREE.MathUtils.radToDeg(rotationY)
    });
  }

  async drainPendingWorldPatches() {
    if (!this.worldBuilder || !this.worldLayoutReady) {
      return;
    }

    for (const patch of this.pendingWorldPatches.splice(0)) {
      await this.handleWorldPatch(patch);
    }
  }

  requestDeferredSceneSync({ worldPatches = false, pickups = false, remotePlayers = false } = {}) {
    this.worldPatchSyncRequested = this.worldPatchSyncRequested || Boolean(worldPatches);
    this.pickupVisualSyncRequested = this.pickupVisualSyncRequested || Boolean(pickups);
    this.remotePlayerSyncRequested = this.remotePlayerSyncRequested || Boolean(remotePlayers);
  }

  processDeferredWorldPatch() {
    if (
      !this.worldPatchSyncRequested
      || this.worldPatchDrainPromise
      || !this.worldBuilder
      || !this.worldLayoutReady
    ) {
      return;
    }

    const nextPatch = this.pendingWorldPatches.shift();
    if (!nextPatch) {
      this.worldPatchSyncRequested = false;
      return;
    }

    this.worldPatchDrainPromise = this.handleWorldPatch(nextPatch)
      .catch((error) => {
        console.error('[World] Failed to apply deferred world patch.', error);
      })
      .finally(() => {
        this.worldPatchDrainPromise = null;
        this.worldPatchSyncRequested = this.pendingWorldPatches.length > 0;
      });
  }

  processDeferredSceneWork() {
    if (!this.bootCriticalReady) {
      return;
    }

    this.processDeferredWorldPatch();

    if (this.pickupVisualSyncRequested) {
      this.pickupVisualSyncRequested = !this.syncPickupVisuals({ maxCreates: 1 });
    }

    if (this.remotePlayerSyncRequested) {
      this.remotePlayerSyncRequested = !this.syncRemotePlayers({ maxCreates: 1, maxSwaps: 1 });
    }
  }

  scheduleMuzzleFlashWarmup() {
    if (this.muzzleFlashPrewarmed || this.deferredMuzzleFlashWarmupId || !this.player) {
      return;
    }

    const runWarmup = () => {
      this.deferredMuzzleFlashWarmupId = 0;
      if (!this.bootCriticalReady) {
        return;
      }

      this.prewarmMuzzleFlashEffect();
    };

    if (typeof window.requestIdleCallback === 'function') {
      this.deferredMuzzleFlashWarmupId = window.requestIdleCallback(runWarmup, { timeout: 1500 });
      return;
    }

    this.deferredMuzzleFlashWarmupId = window.setTimeout(runWarmup, 900);
  }

  scheduleDeferredStartup() {
    if (this.deferredStartupPromise) {
      return this.deferredStartupPromise;
    }

    this.deferredStartupPromise = (async () => {
      this.markBoot('boot:deferred:start');
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      this.requestDeferredSceneSync({
        worldPatches: true,
        pickups: true,
        remotePlayers: true
      });
      this.scheduleMuzzleFlashWarmup();
      this.markBoot('boot:deferred:end');
      this.measureBoot('deferredStartupQueued', 'boot:deferred:start', 'boot:deferred:end');
      this.reportBootMetrics();
    })();

    return this.deferredStartupPromise;
  }

  syncInitialCameraState(localPlayerState = null) {
    if (!this.player) {
      return;
    }

    const baseRotation = Number.isFinite(localPlayerState?.rotationY)
      ? localPlayerState.rotationY
      : this.player.object.rotation.y;
    const aimRotation = Number.isFinite(localPlayerState?.aimRotationY)
      ? localPlayerState.aimRotationY
      : baseRotation;

    this.player.object.rotation.y = baseRotation;
    this.player.setAimRotation(aimRotation);
    this.currentAimDirection.set(Math.sin(aimRotation), 0, Math.cos(aimRotation));
    if (this.currentAimDirection.lengthSq() <= 0.0001) {
      this.currentAimDirection.set(0, 0, 1);
    } else {
      this.currentAimDirection.normalize();
    }
    this.currentAimMode = false;
    this.player.setAimingState(false);
    this.updateCamera(this.currentAimDirection, false, { snap: true });
  }

  resetLocalPlayerKinematics(position = this.player?.position ?? null) {
    this.localPlayerVelocity.set(0, 0, 0);
    if (!position?.isVector3) {
      this.lastLocalPlayerSample = null;
      return;
    }

    this.lastLocalPlayerSample = {
      position: position.clone(),
      timeMs: performance.now()
    };
  }

  updateLocalPlayerKinematics() {
    if (!this.player) {
      return;
    }

    const now = performance.now();
    if (!this.lastLocalPlayerSample) {
      this.resetLocalPlayerKinematics(this.player.position);
      return;
    }

    const elapsedMs = now - (this.lastLocalPlayerSample.timeMs ?? now);
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      this.lastLocalPlayerSample.position.copy(this.player.position);
      this.lastLocalPlayerSample.timeMs = now;
      return;
    }

    const delta = this.localPlayerDelta.copy(this.player.position).sub(this.lastLocalPlayerSample.position);
    if (delta.lengthSq() > 900) {
      this.localPlayerVelocity.set(0, 0, 0);
    } else {
      this.localPlayerVelocity.copy(delta).divideScalar(elapsedMs / 1000);
    }

    this.lastLocalPlayerSample.position.copy(this.player.position);
    this.lastLocalPlayerSample.timeMs = now;
  }

  getPortalInteractables(target = this.portalInteractables) {
    target.length = 0;
    for (const interactable of this.getWorldBuilderInteractables()) {
      if (interactable?.kind === 'portal') {
        target.push(interactable);
      }
    }
    return target;
  }

  getStartPortalSpawnInteractable(anchorPosition = null) {
    const candidates = this.getPortalInteractables();
    let firstCandidate = null;
    let bestCandidate = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      if (candidate?.portalRole !== 'start' || !candidate.spawnPosition?.isVector3) {
        continue;
      }

      if (!firstCandidate) {
        firstCandidate = candidate;
      }

      if (!anchorPosition) {
        return candidate;
      }

      const origin = candidate.originPosition?.isVector3
        ? candidate.originPosition
        : candidate.spawnPosition;
      const distance = Math.hypot(
        (origin?.x ?? 0) - (anchorPosition.x ?? 0),
        (origin?.z ?? 0) - (anchorPosition.z ?? 0)
      );
      if (distance >= bestDistance) {
        continue;
      }

      bestCandidate = candidate;
      bestDistance = distance;
    }

    return bestCandidate ?? firstCandidate;
  }

  applyInitialPortalSpawn(fallbackSpawnPoint = null) {
    if (!this.player || !this.portalArrival.viaPortal) {
      return false;
    }

    const startPortal = this.getStartPortalSpawnInteractable(fallbackSpawnPoint);
    if (!startPortal?.spawnPosition?.isVector3) {
      this.portalSpawnPlacementId = '';
      this.portalDisarmedPlacementIds.clear();
      this.portalSpawnLockUntil = 0;
      return false;
    }

    this.player.position.copy(startPortal.spawnPosition);
    this.player.position.y = this.getActiveGroundHeightAt(this.player.position) ?? this.player.position.y;

    const spawnRotationY = Number.isFinite(startPortal.spawnRotationY)
      ? startPortal.spawnRotationY
      : Math.PI;
    this.player.setFacing(spawnRotationY);
    this.player.setAimRotation(spawnRotationY);
    this.currentAimDirection.set(Math.sin(spawnRotationY), 0, Math.cos(spawnRotationY));
    if (this.currentAimDirection.lengthSq() <= 0.0001) {
      this.currentAimDirection.set(0, 0, 1);
    } else {
      this.currentAimDirection.normalize();
    }

    this.portalSpawnPlacementId = startPortal.placementId ?? '';
    this.portalDisarmedPlacementIds.clear();
    if (this.portalSpawnPlacementId) {
      this.portalDisarmedPlacementIds.add(this.portalSpawnPlacementId);
    }
    this.portalSpawnLockUntil = performance.now() + PORTAL_SPAWN_LOCK_MS;
    this.resetLocalPlayerKinematics(this.player.position);
    return true;
  }

  getPortalContinuityParams() {
    const localPlayerState = this.getLocalPlayerState();
    const character = getPlayableCharacterById(
      localPlayerState?.characterId
      ?? this.player?.characterId
      ?? this.desiredLocalCharacterId
    );
    const bodyRotationY = Number.isFinite(localPlayerState?.rotationY)
      ? localPlayerState.rotationY
      : (this.player?.object?.rotation?.y ?? 0);

    return {
      username: character?.label || undefined,
      avatar_url: character?.portraitStaticSrc || undefined,
      hp: localPlayerState
        ? String(THREE.MathUtils.clamp(Math.round(localPlayerState.health ?? PLAYER_MAX_HEALTH), 1, 100))
        : undefined,
      speed: formatPortalNumber(this.localPlayerVelocity.length()),
      speed_x: formatPortalNumber(this.localPlayerVelocity.x),
      speed_y: '0',
      speed_z: formatPortalNumber(this.localPlayerVelocity.z),
      rotation_x: '0',
      rotation_y: formatPortalNumber(bodyRotationY),
      rotation_z: '0'
    };
  }

  getPortalRedirectUrlForInteractable(interactable = null) {
    if (!interactable || interactable.kind !== 'portal') {
      return null;
    }

    const targetUrl = interactable.portalRole === 'start'
      ? this.portalArrival.refUrl
      : (interactable.targetUrl || VIBE_JAM_PORTAL_URL);
    if (!targetUrl) {
      return null;
    }

    return buildPortalRedirectUrl({
      targetUrl,
      currentSearch: window.location.search,
      currentBaseUrl: getCurrentGameBaseUrl(),
      continuity: this.getPortalContinuityParams()
    });
  }

  getNearestTriggeredPortalRedirectUrl(interactables = []) {
    if (!this.player) {
      return null;
    }

    let nearestRedirectUrl = '';
    let nearestTriggerDistance = Number.POSITIVE_INFINITY;

    for (const portal of interactables) {
      if (portal?.kind !== 'portal') {
        continue;
      }

      const triggerDistance = getPortalTriggerDistance(this.player.position, portal);
      if (this.portalDisarmedPlacementIds.has(portal.placementId)) {
        if (triggerDistance > ((portal.triggerRadius ?? 0) + PORTAL_EXIT_REARM_PADDING)) {
          this.portalDisarmedPlacementIds.delete(portal.placementId);
        }
        continue;
      }

      if (triggerDistance > (portal.triggerRadius ?? 0)) {
        continue;
      }

      const redirectUrl = this.getPortalRedirectUrlForInteractable(portal);
      if (!redirectUrl) {
        continue;
      }

      if (triggerDistance < nearestTriggerDistance) {
        nearestRedirectUrl = redirectUrl;
        nearestTriggerDistance = triggerDistance;
      }
    }

    return nearestRedirectUrl || null;
  }

  maybeActivatePortalInteractable(interactables = []) {
    if (
      !this.player
      || this.portalRedirectInFlight
      || this.worldBuilder?.enabled
      || this.currentInterior?.scene
      || this.activeWorkout
    ) {
      return false;
    }

    const redirectUrl = this.getNearestTriggeredPortalRedirectUrl(interactables);
    if (!redirectUrl) {
      return false;
    }

    this.portalRedirectInFlight = true;
    try {
      window.location.assign(redirectUrl);
    } catch (error) {
      console.warn('[Portal] Redirect failed.', error);
      this.portalRedirectInFlight = false;
    }

    return true;
  }

  renderCurrentView() {
    this.renderSceneFrame();
  }

  renderSceneFrame() {
    this.camera.layers.set(WORLD_RENDER_LAYER);

    try {
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      this.renderInteractableIndicatorLayer();
    } finally {
      this.camera.layers.set(WORLD_RENDER_LAYER);
    }
  }

  renderInteractableIndicatorLayer() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    const previousAutoClear = this.renderer.autoClear;
    const previousBackground = this.scene.background;

    try {
      this.renderer.autoClear = false;
      this.scene.background = null;
      this.renderer.clearDepth();
      this.camera.layers.set(INTERACTABLE_INDICATOR_LAYER);
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.scene.background = previousBackground;
      this.camera.layers.set(WORLD_RENDER_LAYER);
      this.renderer.autoClear = previousAutoClear;
    }
  }

  getOrCreateInteriorScene(interiorId = '') {
    if (!interiorId) {
      return null;
    }

    if (!this.interiorScenes.has(interiorId)) {
      const interiorScene = createInteriorScene(interiorId);
      if (!interiorScene) {
        return null;
      }

      interiorScene.setVisible(false);
      this.scene.add(interiorScene.group);
      this.interiorScenes.set(interiorId, interiorScene);
    }

    return this.interiorScenes.get(interiorId) ?? null;
  }

  createInlineShellSignature(entry) {
    const origin = entry?.originPosition ?? { x: 0, y: 0, z: 0 };
    return [
      entry?.placementId ?? '',
      entry?.interior?.id ?? '',
      entry?.rotationQuarterTurns ?? 0,
      Number(origin.x ?? 0).toFixed(2),
      Number(origin.y ?? 0).toFixed(2),
      Number(origin.z ?? 0).toFixed(2)
    ].join(':');
  }

  getInlineInteriorMode(entry) {
    return entry?.interior?.mode ?? 'inline-shell';
  }

  clearInlineCutawayPlacement(placementId) {
    this.worldBuilder?.setPlacementCutawayState(placementId);
  }

  applyInlineCutawayPlacement(entry) {
    this.worldBuilder?.setPlacementCutawayState(entry.placementId, {
      hiddenNodeNames: entry?.interior?.cutawayNodeNames ?? [],
      fadedNodeNames: entry?.interior?.cutawayFadeNodeNames ?? [],
      fadedNodeOpacity: entry?.interior?.cutawayFadeOpacity ?? 0.1,
      visibleNodeNames: entry?.interior?.cutawayVisibleNodeNames ?? [],
      shadowOverrides: {
        castShadow: false,
        receiveShadow: false
      }
    });
  }

  removeInlineShellScene(placementId) {
    const instance = this.inlineShellScenes.get(placementId);
    if (!instance) {
      return;
    }

    instance.scene?.setInteractableIndicatorsVisible?.(false);
    if (this.activeInlineShell?.placementId === placementId) {
      if (this.activeInlineShell.mode === 'inline-cutaway') {
        this.clearInlineCutawayPlacement(placementId);
        this.setInlineInteriorLightActive(false);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
      this.activeInlineShell = null;
    }

    this.builderInlineShellPreviewPlacementIds.delete(placementId);

    if (instance.attached) {
      this.scene.remove(instance.scene.group);
    }
    disposeObjectResources(instance.scene.group);
    this.inlineShellScenes.delete(placementId);
  }

  getOrCreateInlineShellScene(entry) {
    const placementId = entry?.placementId ?? '';
    const signature = this.createInlineShellSignature(entry);
    const existing = this.inlineShellScenes.get(placementId) ?? null;
    if (existing?.signature === signature) {
      return existing.scene;
    }

    if (existing) {
      this.removeInlineShellScene(placementId);
    }

    const shellScene = createInteriorScene(entry?.interior?.id, {
      origin: [
        entry?.originPosition?.x ?? 0,
        entry?.originPosition?.y ?? 0,
        entry?.originPosition?.z ?? 0
      ],
      rotationQuarterTurns: entry?.rotationQuarterTurns ?? 0,
      placementId,
      visible: false,
      includeExitInteractable: false
    });
    if (!shellScene) {
      return null;
    }

    shellScene.setInteractableIndicatorsVisible?.(false);
    const mode = this.getInlineInteriorMode(entry);
    const attached = mode === 'inline-shell' || shellScene.inlineOverlay === true;
    if (attached) {
      this.scene.add(shellScene.group);
    }
    this.inlineShellScenes.set(placementId, {
      signature,
      scene: shellScene,
      attached,
      mode
    });
    return shellScene;
  }

  setInlineInteriorLightActive(active, shellScene = null) {
    if (!this.inlineInteriorLight) {
      return;
    }

    if (!active || !shellScene?.bounds) {
      this.inlineInteriorLight.visible = false;
      return;
    }

    const center = shellScene.bounds.getCenter(this.inlineInteriorLightCenter);
    const height = Math.max(4.5, shellScene.bounds.max.y - 2.2);
    this.inlineInteriorLight.position.set(center.x, height, center.z);
    this.inlineInteriorLight.visible = true;
  }

  deactivateInlineShell() {
    if (!this.activeInlineShell) {
      return false;
    }

    const { placementId, scene, mode } = this.activeInlineShell;
    scene?.setInteractableIndicatorsVisible?.(false);
    scene?.setVisible(false);
    if (mode === 'inline-cutaway') {
      this.clearInlineCutawayPlacement(placementId);
      this.setInlineInteriorLightActive(false);
    } else {
      this.worldBuilder?.setPlacementVisualHidden(placementId, false);
    }
    this.activeInlineShell = null;
    return true;
  }

  suspendInlineShellForBuilder() {
    if (!this.activeInlineShell) {
      return false;
    }

    const { placementId, mode } = this.activeInlineShell;
    this.activeInlineShell.scene?.setInteractableIndicatorsVisible?.(false);
    this.activeInlineShell.scene?.setVisible(false);
    if (mode === 'inline-cutaway') {
      this.clearInlineCutawayPlacement(placementId);
    } else {
      this.worldBuilder?.setPlacementVisualHidden(placementId, false);
    }
    this.activeInlineShell = null;
    this.setInlineInteriorLightActive(false);
    return true;
  }

  clearBuilderInlineShellPreview() {
    if (!this.builderInlineShellPreviewPlacementIds.size) {
      return;
    }

    const idsToClear = this.builderInlineShellPreviewIdsToClear;
    idsToClear.length = 0;
    for (const placementId of this.builderInlineShellPreviewPlacementIds) {
      idsToClear.push(placementId);
    }

    for (const placementId of idsToClear) {
      const instance = this.inlineShellScenes.get(placementId);
      instance?.scene?.setInteractableIndicatorsVisible?.(false);
      instance?.scene?.setVisible(false);
      if (instance?.mode === 'inline-cutaway') {
        this.clearInlineCutawayPlacement(placementId);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
    }

    this.builderInlineShellPreviewPlacementIds.clear();
    this.setInlineInteriorLightActive(false);
  }

  syncBuilderInlineShellPreview(entries = []) {
    const nextPlacementIds = this.builderInlineShellPreviewNextPlacementIds;
    nextPlacementIds.clear();
    for (const entry of entries) {
      nextPlacementIds.add(entry.placementId);
    }

    const idsToClear = this.builderInlineShellPreviewIdsToClear;
    idsToClear.length = 0;
    for (const placementId of this.builderInlineShellPreviewPlacementIds) {
      if (nextPlacementIds.has(placementId)) {
        continue;
      }
      idsToClear.push(placementId);
    }

    for (const placementId of idsToClear) {
      const instance = this.inlineShellScenes.get(placementId);
      instance?.scene?.setInteractableIndicatorsVisible?.(false);
      instance?.scene?.setVisible(false);
      if (instance?.mode === 'inline-cutaway') {
        this.clearInlineCutawayPlacement(placementId);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
      this.builderInlineShellPreviewPlacementIds.delete(placementId);
    }

    for (const entry of entries) {
      const shellScene = this.getOrCreateInlineShellScene(entry);
      if (!shellScene) {
        continue;
      }

      const mode = this.getInlineInteriorMode(entry);
      shellScene.setInteractableIndicatorsVisible?.(false);
      shellScene.setVisible(mode !== 'inline-cutaway' || shellScene.inlineOverlay === true);
      if (mode === 'inline-cutaway') {
        this.applyInlineCutawayPlacement(entry);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(entry.placementId, true);
      }

      const instance = this.inlineShellScenes.get(entry.placementId);
      if (instance) {
        instance.mode = mode;
      }
      this.builderInlineShellPreviewPlacementIds.add(entry.placementId);
    }

    this.setInlineInteriorLightActive(false);
  }

  activateInlineShell(entry) {
    const shellScene = this.getOrCreateInlineShellScene(entry);
    if (!shellScene) {
      this.deactivateInlineShell();
      return false;
    }

    if (this.activeInlineShell?.placementId !== entry.placementId) {
      this.deactivateInlineShell();
    }

    this.activeInlineShell = {
      placementId: entry.placementId,
      scene: shellScene,
      mode: this.getInlineInteriorMode(entry)
    };
    if (this.activeInlineShell.mode === 'inline-cutaway') {
      shellScene.setVisible(shellScene.inlineOverlay === true);
      this.applyInlineCutawayPlacement(entry);
      this.setInlineInteriorLightActive(true, shellScene);
    } else {
      shellScene.setVisible(true);
      this.worldBuilder?.setPlacementVisualHidden(entry.placementId, true);
    }
    this.updateActiveInlineShellIndicatorVisibility();
    return true;
  }

  updateActiveInlineShellIndicatorVisibility() {
    const shellScene = this.activeInlineShell?.scene ?? null;
    if (!shellScene) {
      return;
    }

    shellScene.setInteractableIndicatorsVisible?.(
      Boolean(this.player && shellScene.bounds?.containsPoint(this.player.position))
    );
  }

  updateWorldInteractableIndicatorVisibility() {
    const worldRenderer = this.worldBuilder?.worldRenderer;
    if (!worldRenderer?.updateInteractableIndicatorVisibility) {
      return;
    }

    const inlineScenes = this.worldInteractableIndicatorInlineScenes;
    inlineScenes.length = 0;
    for (const instance of this.inlineShellScenes.values()) {
      if (instance?.scene?.bounds) {
        inlineScenes.push(instance.scene);
      }
    }

    const playerPosition = this.player?.position ?? null;
    worldRenderer.updateInteractableIndicatorVisibility((rendered, worldPosition) => {
      if (!rendered || !worldPosition || !inlineScenes.length) {
        return true;
      }

      for (const scene of inlineScenes) {
        if (!scene.bounds.containsPoint(worldPosition)) {
          continue;
        }

        return Boolean(playerPosition && scene.bounds.containsPoint(playerPosition));
      }

      return true;
    });
  }

  findInlineShellTarget(entries = []) {
    if (!this.player) {
      return null;
    }

    let nearestTriggerEntry = null;
    let nearestTriggerDistance = Infinity;

    for (const entry of entries) {
      const shellScene = this.getOrCreateInlineShellScene(entry);
      if (!shellScene) {
        continue;
      }

      if (shellScene.bounds.containsPoint(this.player.position)) {
        return entry;
      }

      if (!shellScene.doorwayTriggerBounds?.containsPoint(this.player.position)) {
        continue;
      }

      const triggerDistance = shellScene.doorwayThresholdPosition.distanceToSquared(this.player.position);
      if (triggerDistance < nearestTriggerDistance) {
        nearestTriggerDistance = triggerDistance;
        nearestTriggerEntry = entry;
      }
    }

    return nearestTriggerEntry;
  }

  syncInlineShellState() {
    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      this.deactivateInlineShell();
      this.clearBuilderInlineShellPreview();
      return;
    }

    const entries = this.worldBuilder.getInlineShellEntries(this.inlineShellEntries);
    const placementIds = this.inlineShellPlacementIds;
    placementIds.clear();
    for (const entry of entries) {
      placementIds.add(entry.placementId);
    }

    const scenesToRemove = this.inlineShellScenesToRemove;
    scenesToRemove.length = 0;
    for (const placementId of this.inlineShellScenes.keys()) {
      if (!placementIds.has(placementId)) {
        scenesToRemove.push(placementId);
      }
    }
    for (const placementId of scenesToRemove) {
      this.removeInlineShellScene(placementId);
    }

    if (this.worldBuilder.enabled) {
      this.deactivateInlineShell();
      this.syncBuilderInlineShellPreview(entries);
      return;
    }

    this.clearBuilderInlineShellPreview();

    const desiredEntry = this.findInlineShellTarget(entries);
    if (!desiredEntry) {
      this.deactivateInlineShell();
      return;
    }

    this.activateInlineShell(desiredEntry);
    this.activeInlineShell?.scene?.setActiveFloorForWorldPosition?.(this.player.position);
    this.updateActiveInlineShellIndicatorVisibility();
  }

  setRemotePlayersVisible(visible) {
    const nextVisible = Boolean(visible);
    for (const avatar of this.remotePlayers.values()) {
      avatar.object.visible = nextVisible;
    }
  }

  setPickupVisualsVisible(visible) {
    const nextVisible = Boolean(visible);
    for (const visual of this.pickupVisuals.values()) {
      visual.object.visible = nextVisible;
    }
  }

  setOutdoorSceneVisible(visible) {
    const nextVisible = Boolean(visible);
    if (this.cityVisualRoot) {
      this.cityVisualRoot.visible = nextVisible;
    }
    this.worldBuilder?.setVisible(nextVisible);
    this.setRemotePlayersVisible(nextVisible);
    this.setPickupVisualsVisible(nextVisible);
  }

  getActiveSceneBounds() {
    return this.currentInterior?.scene?.bounds ?? this.cityBounds;
  }

  getActiveInlineInteriorScene(worldPosition = this.player?.position ?? null) {
    const scene = this.activeInlineShell?.scene ?? null;
    if (!scene || !worldPosition) {
      return null;
    }

    if (scene.bounds?.containsPoint(worldPosition) || scene.doorwayTriggerBounds?.containsPoint(worldPosition)) {
      return scene;
    }

    return null;
  }

  getActiveGroundHeightAt(worldPosition) {
    if (this.currentInterior?.scene) {
      return this.currentInterior.scene.getGroundHeightAt(worldPosition);
    }

    const inlineScene = this.getActiveInlineInteriorScene(worldPosition);
    if (inlineScene) {
      return inlineScene.getGroundHeightAt(worldPosition);
    }

    return this.worldBuilder?.getGroundHeightAt(worldPosition) ?? 0;
  }

  hasGymMembership(playerState = this.getLocalPlayerState()) {
    return playerState?.gymMembershipActive === true;
  }

  getGymCheckInNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      gymCheckInEnabled: npcState?.gymCheckInEnabled === true || interactable?.npc?.gymCheckInEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getGymCheckInNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  hasActiveGymCheckInNpc(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.worldBuilder) {
      return false;
    }

    return worldBuilderInteractables.some((interactable) => {
      if (interactable.kind !== 'npc') {
        return false;
      }

      const npcDetails = this.getGymCheckInNpcDetails(interactable);
      return Boolean(
        isGymCheckInNpc(npcDetails)
        && npcDetails.alive !== false
        && npcDetails.mode !== 'hidden'
        && npcDetails.mode !== 'dead'
      );
    });
  }

  isGymDoorPlacement(placement = null, item = null) {
    const itemId = String(item?.id ?? placement?.itemId ?? '').toLowerCase();
    const interiorId = String(item?.interior?.id ?? placement?.interactable?.interior?.id ?? '').toLowerCase();
    const label = String(item?.interior?.label ?? placement?.interactable?.label ?? item?.label ?? '').toLowerCase();
    return itemId.includes('gym') || interiorId.includes('gym') || label.includes('gym');
  }

  rebuildGymDoorBlockers(target = this.gymDoorBlockers) {
    if (!this.worldBuilder) {
      target.length = 0;
      return target;
    }

    let blockerCount = 0;
    this.worldBuilder.forEachPlacement((placement) => {
      if (placement?.layer !== 'tile') {
        return;
      }

      const item = getBuilderItemById(placement.itemId);
      if (!item || !this.isGymDoorPlacement(placement, item)) {
        return;
      }

      const doorOffset = item.interior?.exteriorDoorOffset
        ?? placement.interactable?.interior?.exteriorDoorOffset
        ?? item.npcRouteDoorOffset
        ?? null;
      if (!Array.isArray(doorOffset) || doorOffset.length < 2) {
        return;
      }

      const cellX = Number(placement.cell?.[0] ?? placement.cellX);
      const cellZ = Number(placement.cell?.[1] ?? placement.cellZ);
      if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) {
        return;
      }

      const rotationQuarterTurns = placement.rotationQuarterTurns ?? 0;
      const center = getTileCenterWorldPosition(item, cellX, cellZ, rotationQuarterTurns);
      const rotatedOffset = rotateFootprintOffset(
        Number(doorOffset[0]) || 0,
        Number(doorOffset[1]) || 0,
        rotationQuarterTurns
      );
      const blocker = target[blockerCount] ?? {};
      blocker.x = center.x + rotatedOffset.x;
      blocker.z = center.z + rotatedOffset.z;
      blocker.radius = GYM_DOOR_BLOCKER_RADIUS;
      target[blockerCount] = blocker;
      blockerCount += 1;
    });

    target.length = blockerCount;
    return target;
  }

  getGymDoorBlockers(target = this.gymDoorBlockers) {
    if (this.gymDoorBlockersDirty) {
      this.rebuildGymDoorBlockers(this.gymDoorBlockers);
      this.gymDoorBlockersDirty = false;
    }

    if (target !== this.gymDoorBlockers) {
      target.length = 0;
      appendList(target, this.gymDoorBlockers);
      return target;
    }

    return this.gymDoorBlockers;
  }

  getNearestGymCheckInInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder || this.hasGymMembership()) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const npcDetails = this.getGymCheckInNpcDetails(interactable);
      if (
        !isGymCheckInNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getGymCheckInNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getGymCheckInPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'gym-check-in',
        npcId: interactable.npcId || interactable.placementId || '',
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: `Buy gym membership ($${GYM_MEMBERSHIP_COST})`,
        actionText: 'Gym membership purchased.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  getGymCheckInColliders(target = this.gymCheckInColliders) {
    if (
      !this.player
      || this.currentInterior?.scene
      || !this.worldBuilder
      || this.hasGymMembership()
      || !this.hasActiveGymCheckInNpc()
    ) {
      target.length = 0;
      return target;
    }

    const blockers = this.getGymDoorBlockers();
    for (let index = 0; index < blockers.length; index += 1) {
      const blocker = blockers[index];
      const collider = target[index] ?? {};
      collider.kind = 'gym-door-membership-gate';
      collider.blocksMovement = true;
      collider.type = 'cylinder';
      collider.x = blocker.x;
      collider.z = blocker.z;
      collider.y = this.getActiveGroundHeightAt(blocker);
      collider.radius = blocker.radius;
      collider.height = 5;
      target[index] = collider;
    }
    target.length = blockers.length;
    return target;
  }

  getInlineOfficeDoorBlockers() {
    if (!this.player || this.currentInterior?.scene) {
      return [];
    }

    const scene = this.getActiveInlineInteriorScene();
    if (scene?.id !== OFFICE_INTERIOR_ID) {
      return [];
    }

    return scene.getActiveOfficeColliders?.(this.player.position)
      ?? scene.getConditionalDoorColliders?.(this.player.position)
      ?? [];
  }

  getActiveColliders() {
    if (this.currentInterior?.scene) {
      return this.currentInterior.scene.getCollidersAt?.(this.player?.position)
        ?? this.currentInterior.scene.colliders
        ?? [];
    }

    const colliders = this.activeColliders;
    colliders.length = 0;
    appendList(colliders, this.baseColliders);
    appendList(colliders, this.worldBuilder?.getColliders(this.worldBuilderColliders));
    appendList(colliders, this.getInlineOfficeDoorBlockers());
    appendList(colliders, this.getGymCheckInColliders());
    return colliders;
  }

  getWorldBuilderInteractables() {
    if (!this.worldBuilder) {
      return EMPTY_INTERACTABLES;
    }

    return this.worldBuilder.getInteractables(this.worldBuilderInteractables);
  }

  getActiveInteractables(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    const interactables = this.activeInteractables;
    interactables.length = 0;

    if (this.currentInterior?.scene) {
      appendList(interactables, this.currentInterior.scene.interactables);
      return interactables;
    }

    for (const interactable of this.staticInteractables ?? []) {
      if (interactable?.kind !== 'npc') {
        interactables.push(interactable);
      }
    }

    for (const interactable of worldBuilderInteractables) {
      if (interactable?.kind !== 'npc') {
        interactables.push(interactable);
      }
    }

    if (this.getActiveInlineInteriorScene()) {
      appendList(interactables, this.activeInlineShell?.scene?.interactables);
    }

    for (const pickup of this.npcServiceState.pickups.values()) {
      if (!pickup?.active) {
        continue;
      }

      let interactable = this.pickupInteractables.get(pickup.id);
      if (!interactable) {
        interactable = {
          kind: 'pickup',
          pickupId: pickup.id,
          position: new THREE.Vector3(),
          radius: 3.2,
          prompt: 'Pick up pistol',
          actionText: 'Pistol secured.'
        };
        this.pickupInteractables.set(pickup.id, interactable);
      }
      const groundProbe = this.pickupGroundProbe.set(pickup.x, 0, pickup.z);
      interactable.position.set(
        pickup.x,
        this.getActiveGroundHeightAt(groundProbe),
        pickup.z
      );
      interactables.push(interactable);
    }

    for (const pickupId of this.pickupInteractables.keys()) {
      if (!this.npcServiceState.pickups.get(pickupId)?.active) {
        this.pickupInteractables.delete(pickupId);
      }
    }

    return interactables;
  }

  getNearestNpcInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc' || !interactable.position) {
        continue;
      }

      const radius = Number(interactable.radius);
      if (!Number.isFinite(radius) || radius <= 0) {
        continue;
      }

      const distance = interactable.position.distanceTo(this.player.position);
      if (distance < radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  getNpcInteractableById(npcId = '', worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!npcId || !this.worldBuilder) {
      return null;
    }

    for (const interactable of worldBuilderInteractables) {
      if (
        interactable.kind === 'npc'
        && (interactable.npcId === npcId || interactable.placementId === npcId)
      ) {
        return interactable;
      }
    }

    return null;
  }

  createTaskTrackerContext(localPlayerState = null) {
    const worldBuilderInteractables = localPlayerState
      ? this.getWorldBuilderInteractables()
      : EMPTY_INTERACTABLES;
    const rentIntroState = this.taskTrackerRentIntroState;
    rentIntroState.pendingSeq = this.pendingRentIntro?.seq ?? 0;
    rentIntroState.activeSeq = this.activeRentIntro?.seq ?? 0;
    rentIntroState.activeCharged = this.activeRentIntro?.charged === true;
    rentIntroState.handledSeq = this.handledRentIntroSeq;

    const context = this.taskTrackerContext;
    context.localPlayerState = localPlayerState;
    context.npcStates = this.npcServiceState.npcs;
    context.worldBuilder = this.worldBuilder;
    context.worldBuilderInteractables = worldBuilderInteractables;
    context.missionSequence = this.currentLayout?.missionSequence ?? null;
    context.activeInteractables = localPlayerState
      ? this.getActiveInteractables(worldBuilderInteractables)
      : EMPTY_INTERACTABLES;
    context.gymDoorBlockers = localPlayerState
      ? this.getGymDoorBlockers()
      : EMPTY_INTERACTABLES;
    return context;
  }

  syncTaskHud(localPlayerState = null) {
    const completedTaskId = this.taskTracker.currentTaskId;
    const {
      task,
      missions,
      selectedMission,
      completedTask
    } = this.taskTracker.update(
      this.createTaskTrackerContext(localPlayerState)
    );
    if (localPlayerState) {
      this.phoneMissionState = {
        missions,
        selectedMissionId: selectedMission?.id ?? ''
      };
      this.refreshPhoneMissionsHud();
    }

    if (completedTask) {
      const skipConfetti = completedTaskId === TASK_IDS.gymPump && this.gymPumpTaskConfettiPlayed;
      this.hud.playTaskCompletion({
        visible: task.visible,
        nextTitle: task.title,
        withConfetti: !skipConfetti
      });
      this.playTaskCompleteSound();
      if (completedTaskId === TASK_IDS.gymPump) {
        this.gymPumpTaskConfettiPlayed = false;
      }
    } else {
      this.hud.setTaskState({
        visible: task.visible,
        title: task.title
      });
      if (task.id !== TASK_IDS.gymPump && completedTaskId !== TASK_IDS.gymPump) {
        this.gymPumpTaskConfettiPlayed = false;
      }
    }

    if (task.visible && task.target) {
      this.player?.setTaskArrowTarget?.(task.target);
    } else {
      this.player?.clearTaskArrowTarget?.();
    }
  }

  resolveSkillAwardDefinition(award = null, skills = []) {
    const awardSkillId = String(award?.skillId ?? '');
    return skills.find((entry) => entry.id === awardSkillId)
      ?? SKILL_DEFINITIONS.find((entry) => entry.id === awardSkillId)
      ?? {
        id: awardSkillId,
        label: award?.label || 'Skill',
        icon: award?.icon || awardSkillId,
        accent: award?.accent || '#58b8ff'
      };
  }

  getSkillXpEmoji(skill = null) {
    const skillId = String(skill?.id ?? '');
    const iconId = String(skill?.icon ?? '');
    return SKILL_XP_EMOJIS[skillId] ?? SKILL_XP_EMOJIS[iconId] ?? '*';
  }

  spawnSkillXpFloater({ skill = null, xpGained = 0 } = {}) {
    const amount = Math.max(0, Math.floor(Number(xpGained) || 0));
    if (amount <= 0) {
      return;
    }

    this.skillXpFloaters.push({
      id: `skill-xp:${++this.skillXpFloaterSequence}`,
      amount,
      emoji: this.getSkillXpEmoji(skill),
      accent: skill?.accent ?? '#58b8ff',
      startedAt: performance.now(),
      durationMs: SKILL_XP_FLOATER_MS
    });
  }

  showSkillLevelUpFeedback({ skill = {}, oldLevel = 1, newLevel = 1 } = {}) {
    this.hud.showSkillLevelUp({
      skill,
      oldLevel,
      newLevel
    });
    this.playSkillLevelUpSound();
  }

  playSkillLevelUpSound() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastPlayedAt = Number(this.lastSkillLevelUpSoundAt ?? -Infinity);
    if (now - lastPlayedAt < SKILL_LEVEL_UP_SOUND_SUPPRESS_MS) {
      return;
    }

    this.lastSkillLevelUpSoundAt = now;
    this.playSoundEffect(this.levelUpSound);
  }

  shouldPlaySkillXpGainSound(award = null, skill = null) {
    const skillId = String(skill?.id ?? award?.skillId ?? '');
    return skillId !== SKILL_IDS.agility;
  }

  presentSkillAwardFeedback(award = null, skill = null) {
    if (!award || !skill) {
      return;
    }

    const xpGained = Math.max(0, Math.floor(Number(award.xpGained) || 0));
    this.spawnSkillXpFloater({
      skill,
      xpGained
    });
    if (xpGained > 0 && this.shouldPlaySkillXpGainSound(award, skill)) {
      this.playSoundEffect(this.skillXpGainSound);
    }

    if (award.newLevel > award.oldLevel) {
      this.showSkillLevelUpFeedback({
        skill,
        oldLevel: award.oldLevel,
        newLevel: award.newLevel
      });
    }
  }

  presentSkillAwardsFromResult(result = null) {
    const awards = Array.isArray(result?.skillAwards) && result.skillAwards.length > 0
      ? result.skillAwards
      : [result?.skillAward].filter(Boolean);
    let presented = false;

    for (const award of awards) {
      if (!award?.seq || award.seq <= this.lastSkillAwardSeq) {
        continue;
      }

      this.lastSkillAwardSeq = award.seq;
      const skill = SKILL_DEFINITIONS.find((entry) => entry.id === award.skillId) ?? {
        id: award.skillId,
        label: award.label,
        icon: award.icon,
        accent: award.accent
      };
      this.phoneSkillsState = {
        ...this.phoneSkillsState,
        recentAward: {
          ...award,
          skill
        }
      };
      this.presentSkillAwardFeedback(award, skill);
      presented = true;
    }

    if (presented) {
      this.refreshPhoneSkillsHud();
    }
    return presented;
  }

  syncSkillProgress(localPlayerState = null) {
    if (!localPlayerState) {
      return;
    }

    const skills = getPlayerSkillsSnapshot(localPlayerState);
    const hadSnapshot = this.skillLevelSnapshot.size > 0;
    const awardSeq = Math.max(0, Math.floor(Number(localPlayerState.skillAwardSeq ?? 0) || 0));
    const awardSkillId = String(localPlayerState.skillAwardSkillId ?? '');
    const award = awardSeq > this.lastSkillAwardSeq && awardSkillId
      ? {
          seq: awardSeq,
          skillId: awardSkillId,
          xpGained: Math.max(0, Math.floor(Number(localPlayerState.skillAwardXpGained ?? 0) || 0)),
          oldLevel: Math.max(1, Math.floor(Number(localPlayerState.skillAwardOldLevel ?? 1) || 1)),
          newLevel: Math.max(1, Math.floor(Number(localPlayerState.skillAwardNewLevel ?? 1) || 1)),
          awardedAt: Number(localPlayerState.skillAwardAt ?? 0) || Date.now()
        }
      : null;

    for (const skill of skills) {
      const previousLevel = this.skillLevelSnapshot.get(skill.id);
      this.skillLevelSnapshot.set(skill.id, skill.level);
      if (!award && hadSnapshot && previousLevel && skill.level > previousLevel) {
        this.showSkillLevelUpFeedback({
          skill,
          oldLevel: previousLevel,
          newLevel: skill.level
        });
      }
    }

    if (award) {
      this.lastSkillAwardSeq = award.seq;
      const skill = this.resolveSkillAwardDefinition(award, skills);
      this.phoneSkillsState = {
        skills,
        recentAward: {
          ...award,
          skill
        }
      };
      this.presentSkillAwardFeedback(award, skill);
      if (award.newLevel <= award.oldLevel && skill && this.phoneMenuVisible && this.phoneActiveAppId === 'skills') {
        this.hud.showToast(`+${award.xpGained} ${skill.label} XP`);
      }
    } else {
      this.phoneSkillsState = {
        skills,
        recentAward: this.phoneSkillsState.recentAward
      };
    }

    this.refreshPhoneSkillsHud(localPlayerState);
  }

  getDeliveryQuestReminderKey(questState = null) {
    if (!questState?.giverNpcId && !questState?.deliveryQuestGiverNpcId) {
      return '';
    }

    const giverNpcId = questState.giverNpcId ?? questState.deliveryQuestGiverNpcId ?? '';
    const targetNpcId = questState.targetNpcId ?? questState.deliveryQuestTargetNpcId ?? '';
    const acceptedAt = questState.acceptedAt ?? questState.deliveryQuestAcceptedAt ?? 0;
    return `${giverNpcId}:${targetNpcId}:${acceptedAt}`;
  }

  syncDeliveryPackageVisual(localPlayerState = this.getLocalPlayerState()) {
    if (!this.player) {
      return;
    }

    void this.player.setDeliveryPackageActive?.(
      localPlayerState?.alive !== false && isDeliveryQuestActive(localPlayerState)
    );
  }

  suppressCurrentDeliveryReminder(questState = null) {
    const key = this.getDeliveryQuestReminderKey(questState);
    if (key) {
      this.deliveryQuestReminderSuppressedKey = key;
      this.deliveryQuestReminderSuppressionExpiresAt = performance.now() + 5000;
    }
  }

  syncDeliveryQuestReminderGate(
    playerState = this.getLocalPlayerState(),
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  ) {
    if (!isDeliveryQuestActive(playerState)) {
      if (
        this.deliveryQuestReminderSuppressedKey
        && performance.now() < this.deliveryQuestReminderSuppressionExpiresAt
      ) {
        return false;
      }

      this.deliveryQuestReminderSuppressedKey = '';
      this.deliveryQuestReminderSuppressionExpiresAt = 0;
      return false;
    }

    const key = this.getDeliveryQuestReminderKey(playerState);
    if (!key || this.deliveryQuestReminderSuppressedKey !== key) {
      return false;
    }

    const giver = this.getNpcInteractableById(playerState.deliveryQuestGiverNpcId, worldBuilderInteractables);
    const radius = Number(giver?.radius);
    const insideGiverRadius = Boolean(
      this.player
      && giver?.position
      && Number.isFinite(radius)
      && this.player.position.distanceTo(giver.position) < radius
    );

    if (!insideGiverRadius) {
      this.deliveryQuestReminderSuppressedKey = '';
      this.deliveryQuestReminderSuppressionExpiresAt = 0;
      return false;
    }

    return true;
  }

  getDeliveryQuestInteractionForNpc(
    interactable = null,
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  ) {
    const resolvedInteractable = interactable ?? this.getNearestNpcInteractable(worldBuilderInteractables);
    const npcId = resolvedInteractable?.kind === 'npc'
      ? (resolvedInteractable.npcId || resolvedInteractable.placementId || '')
      : '';
    if (!npcId) {
      return null;
    }

    const playerState = this.getLocalPlayerState();
    const npcState = this.npcServiceState.npcs.get(npcId);
    if (!playerState || playerState.alive === false || !npcState || npcState.alive === false) {
      return null;
    }
    const npcDetails = {
      ...npcState,
      deliveryQuestEnabled: npcState.deliveryQuestEnabled === true || resolvedInteractable?.npc?.deliveryQuestEnabled === true
    };

    if (isDeliveryQuestActive(playerState)) {
      if (npcId === playerState.deliveryQuestTargetNpcId) {
        return {
          kind: 'completeDelivery',
          action: true,
          npcId,
          label: '',
          overheadText: 'Delivering package...',
          variant: 'interaction'
        };
      }

      if (
        npcId === playerState.deliveryQuestGiverNpcId
        && isDeliveryQuestGiver(npcId, npcDetails)
      ) {
        if (this.syncDeliveryQuestReminderGate(playerState, worldBuilderInteractables)) {
          return null;
        }

        const targetName = getDeliveryQuestTargetName(
          this.npcServiceState.npcs.get(playerState.deliveryQuestTargetNpcId)
        );
        return {
          kind: 'deliveryReminder',
          action: false,
          npcId,
          label: npcState.name,
          overheadText: `Hey, I am still waiting. Did you deliver that package to ${targetName}?`,
          variant: 'npc'
        };
      }

      return null;
    }

    if (!isDeliveryQuestGiver(npcId, npcDetails)) {
      return null;
    }

    return {
      kind: 'acceptDelivery',
      action: true,
      npcId,
      label: npcState.name,
      overheadText: 'Hey, can you help me make a delivery? Press E to accept.',
      variant: 'npc'
    };
  }

  async handleDeliveryQuestInteraction(interaction = null) {
    if (!interaction?.action || this.deliveryQuestRequestInFlight) {
      return;
    }

    this.deliveryQuestRequestInFlight = true;
    try {
      const service = this.npcService;
      const result = interaction.kind === 'completeDelivery'
        ? await service?.completeDeliveryQuest?.(interaction.npcId)
        : await service?.acceptDeliveryQuest?.(interaction.npcId);

      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That delivery cannot be handled right now.');
        return;
      }

      if (interaction.kind === 'completeDelivery') {
        void this.player?.setDeliveryPackageActive?.(false);
        this.hud.showToast(`Delivered to ${result.targetName ?? 'the contact'}.`);
        return;
      }

      this.suppressCurrentDeliveryReminder(result);
      void this.player?.setDeliveryPackageActive?.(true);
      this.hud.showToast(`Delivery accepted. Find ${result.targetName ?? interaction.targetName ?? 'the contact'}.`);
    } catch (error) {
      console.warn('[Quest] Delivery interaction failed.', error);
      this.hud.showToast('Delivery request failed.');
    } finally {
      this.deliveryQuestRequestInFlight = false;
    }
  }

  getActiveDeliveryTargetProximity(
    playerState = this.getLocalPlayerState(),
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  ) {
    if (!this.player || !isDeliveryQuestActive(playerState)) {
      return null;
    }

    const targetNpcId = String(playerState.deliveryQuestTargetNpcId ?? '').trim();
    if (!targetNpcId) {
      return null;
    }

    const npcState = this.npcServiceState.npcs.get(targetNpcId);
    const interactable = this.getNpcInteractableById(targetNpcId, worldBuilderInteractables);
    if (!npcState || !interactable) {
      return null;
    }

    const radius = Math.max(1.5, Number(npcState.interactRadius ?? interactable.radius ?? 4.2) || 4.2);
    const x = Number.isFinite(npcState.x) ? npcState.x : (interactable.originPosition?.x ?? interactable.position?.x);
    const z = Number.isFinite(npcState.z) ? npcState.z : (interactable.originPosition?.z ?? interactable.position?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return {
      npcId: targetNpcId,
      npcState,
      interactable,
      radius,
      distance: Math.hypot(this.player.position.x - x, this.player.position.z - z)
    };
  }

  maybeAutoCompleteDelivery(
    playerState = this.getLocalPlayerState(),
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  ) {
    if (!isDeliveryQuestActive(playerState)) {
      this.deliveryQuestAutoCompleteAttemptKey = '';
      this.deliveryQuestAutoCompleteAttemptAt = 0;
      return false;
    }

    const proximity = this.getActiveDeliveryTargetProximity(playerState, worldBuilderInteractables);
    if (!proximity || proximity.distance > proximity.radius) {
      this.deliveryQuestAutoCompleteAttemptKey = '';
      this.deliveryQuestAutoCompleteAttemptAt = 0;
      return false;
    }

    if (this.deliveryQuestRequestInFlight) {
      return true;
    }

    const interaction = this.getDeliveryQuestInteractionForNpc(proximity.interactable, worldBuilderInteractables);
    if (interaction?.kind !== 'completeDelivery' || !interaction.action) {
      return false;
    }

    const now = performance.now();
    const attemptKey = `complete:${this.getDeliveryQuestReminderKey(playerState)}`;
    if (
      this.deliveryQuestAutoCompleteAttemptKey === attemptKey
      && now - this.deliveryQuestAutoCompleteAttemptAt < 1200
    ) {
      return true;
    }

    this.deliveryQuestAutoCompleteAttemptKey = attemptKey;
    this.deliveryQuestAutoCompleteAttemptAt = now;
    void this.handleDeliveryQuestInteraction(interaction);
    return true;
  }

  async handleGymCheckInInteraction(interaction = null) {
    if (!interaction?.npcId || this.gymMembershipRequestInFlight) {
      return;
    }

    this.gymMembershipRequestInFlight = true;
    try {
      const result = await this.npcService?.buyGymMembership?.(interaction.npcId);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'Gym membership could not be purchased.');
        return;
      }

      this.playSoundEffect(this.rentChaChingSound);
      this.hud.showToast(result.alreadyOwned ? 'Gym membership already active.' : 'Gym membership active.');
    } catch (error) {
      console.warn('[Gym] Membership purchase failed.', error);
      this.hud.showToast('Gym membership request failed.');
    } finally {
      this.gymMembershipRequestInFlight = false;
    }
  }

  getStockMarketNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      stockMarketEnabled: npcState?.stockMarketEnabled === true || interactable?.npc?.stockMarketEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getStockMarketNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestStockMarketInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const npcDetails = this.getStockMarketNpcDetails(interactable);
      if (
        !isStockMarketNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getStockMarketNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getStockMarketPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'stock-market',
        npcId: interactable.npcId || interactable.placementId || '',
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Trade stocks',
        actionText: 'Market opened.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  selectPhoneStockSymbol(symbol = '') {
    this.stockMarketSelectedSymbol = String(symbol ?? '').trim().toUpperCase();
    this.refreshPhoneStocksHud();
  }

  setPhoneStockQuantity(quantity = 1) {
    this.stockMarketQuantity = normalizeStockTradeQuantity(quantity);
    this.refreshPhoneStocksHud();
  }

  async handlePhoneStockTrade(side = '') {
    if (this.stockMarketRequestInFlight) {
      return;
    }

    let market = this.getActiveStockMarketSnapshot() ?? this.phoneStocksState.market ?? this.phoneWalletState.wallet;
    if (!Array.isArray(market?.stocks) || !market.stocks.length) {
      await this.refreshPhoneStocksSnapshot({ force: true });
      market = this.getActiveStockMarketSnapshot() ?? this.phoneStocksState.market ?? this.phoneWalletState.wallet;
    }

    const listedSymbols = new Set((market?.stocks ?? []).map((stock) => stock.symbol));
    const symbol = listedSymbols.has(this.stockMarketSelectedSymbol)
      ? this.stockMarketSelectedSymbol
      : market?.stocks?.[0]?.symbol ?? '';
    if (!symbol) {
      this.hud.showToast('Market data is still syncing.');
      return;
    }

    this.stockMarketRequestInFlight = true;
    this.phoneStocksState = {
      ...this.phoneStocksState,
      loading: true,
      error: ''
    };
    this.refreshPhoneStocksHud();

    try {
      const result = await this.npcService?.tradeStock?.(
        '',
        symbol,
        side,
        this.stockMarketQuantity,
        { source: 'phone' }
      );
      if (!result?.ok || !result.market) {
        const error = result?.error ?? 'That trade did not go through.';
        this.phoneStocksState = {
          ...this.phoneStocksState,
          loading: false,
          error
        };
        this.refreshPhoneStocksHud();
        this.hud.showToast(error);
        return;
      }

      this.setStockMarketSnapshot(result.market);
      this.scheduleWalletSnapshotRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.phoneWalletState = {
        ...this.phoneWalletState,
        wallet: result.market,
        cash: normalizeMoneyAmount(result.market.cash ?? result.money ?? 0),
        loading: false,
        error: ''
      };
      this.phoneStocksState = {
        ...this.phoneStocksState,
        market: result.market,
        loading: false,
        error: ''
      };
      const listedAfterTrade = new Set((result.market.stocks ?? []).map((stock) => stock.symbol));
      this.stockMarketSelectedSymbol = listedAfterTrade.has(symbol)
        ? symbol
        : result.market.stocks?.[0]?.symbol ?? '';
      this.scheduleStockMarketRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.refreshPhoneStocksHud();
      this.refreshPhoneWalletHud();
      this.hud.setStockMarketState({
        visible: this.hud.isStockMarketOpen(),
        market: this.stockMarketSnapshot,
        selectedSymbol: this.stockMarketSelectedSymbol,
        quantity: this.stockMarketQuantity,
        loading: false,
        error: ''
      });
      const trade = result.trade ?? {};
      const verb = trade.side === 'sell' ? 'Sold' : 'Bought';
      this.hud.showToast(`${verb} ${trade.quantity ?? this.stockMarketQuantity} ${trade.symbol ?? symbol}.`);
      this.playSoundEffect(this.rentChaChingSound);
    } catch (error) {
      console.warn('[PhoneStocks] Trade failed.', error);
      this.phoneStocksState = {
        ...this.phoneStocksState,
        loading: false,
        error: 'Trade request failed.'
      };
      this.refreshPhoneStocksHud();
      this.hud.showToast('Trade request failed.');
    } finally {
      this.stockMarketRequestInFlight = false;
    }
  }

  selectStockMarketSymbol(symbol = '') {
    this.stockMarketSelectedSymbol = String(symbol ?? '').trim().toUpperCase();
    this.hud.setStockMarketState({
      visible: true,
      market: this.stockMarketSnapshot,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity
    });
  }

  setStockMarketQuantity(quantity = 1) {
    this.stockMarketQuantity = normalizeStockTradeQuantity(quantity);
    this.hud.setStockMarketState({
      visible: true,
      market: this.stockMarketSnapshot,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity
    });
  }

  async openStockMarket(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.stockMarketNpcId = npcId;
    this.stockMarketRefreshAt = 0;
    this.hud.setStockMarketState({
      visible: true,
      market: this.stockMarketSnapshot,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity,
      loading: true,
      error: ''
    });
    await this.refreshStockMarket({ force: true });
  }

  closeStockMarket() {
    this.hud.setStockMarketState({
      visible: false,
      market: this.stockMarketSnapshot,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity,
      loading: false,
      error: ''
    });
  }

  async refreshStockMarket({ force = false } = {}) {
    if (!this.stockMarketNpcId || this.stockMarketRequestInFlight) {
      return;
    }

    const now = performance.now();
    if (!force && now < this.stockMarketRefreshAt) {
      return;
    }

    this.stockMarketRequestInFlight = true;
    this.stockMarketRefreshAt = now + STOCK_SNAPSHOT_RETRY_MS;
    if (force) {
      this.hud.setStockMarketState({
        visible: true,
        market: this.stockMarketSnapshot,
        selectedSymbol: this.stockMarketSelectedSymbol,
        quantity: this.stockMarketQuantity,
        loading: true,
        error: ''
      });
    }

    try {
      const result = await this.npcService?.getStockMarket?.(this.stockMarketNpcId);
      if (!result?.ok || !result.market) {
        const error = result?.error ?? 'Market data is unavailable.';
        this.hud.setStockMarketState({
          visible: this.hud.isStockMarketOpen(),
          market: this.stockMarketSnapshot,
          selectedSymbol: this.stockMarketSelectedSymbol,
          quantity: this.stockMarketQuantity,
          loading: false,
          error
        });
        this.hud.showToast(error);
        return;
      }

      this.setStockMarketSnapshot(result.market);
      this.scheduleStockMarketRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.scheduleWalletSnapshotRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.phoneWalletState = {
        ...this.phoneWalletState,
        wallet: result.market,
        cash: normalizeMoneyAmount(result.market.cash ?? result.money ?? 0),
        loading: false,
        error: ''
      };
      this.phoneStocksState = {
        ...this.phoneStocksState,
        market: result.market,
        loading: false,
        error: ''
      };
      const listedSymbols = new Set((result.market.stocks ?? []).map((stock) => stock.symbol));
      if (!this.stockMarketSelectedSymbol || !listedSymbols.has(this.stockMarketSelectedSymbol)) {
        this.stockMarketSelectedSymbol = result.market.stocks?.[0]?.symbol ?? '';
      }
      this.hud.setStockMarketState({
        visible: this.hud.isStockMarketOpen(),
        market: this.stockMarketSnapshot,
        selectedSymbol: this.stockMarketSelectedSymbol,
        quantity: this.stockMarketQuantity,
        loading: false,
        error: ''
      });
      this.refreshPhoneStocksHud();
    } catch (error) {
      console.warn('[StockMarket] Refresh failed.', error);
      this.hud.setStockMarketState({
        visible: this.hud.isStockMarketOpen(),
        market: this.stockMarketSnapshot,
        selectedSymbol: this.stockMarketSelectedSymbol,
        quantity: this.stockMarketQuantity,
        loading: false,
        error: 'Market request failed.'
      });
      this.hud.showToast('Market request failed.');
    } finally {
      this.stockMarketRequestInFlight = false;
    }
  }

  async handleStockTrade(side = '') {
    if (!this.stockMarketNpcId || this.stockMarketRequestInFlight) {
      return;
    }

    const listedSymbols = new Set((this.stockMarketSnapshot?.stocks ?? []).map((stock) => stock.symbol));
    const symbol = listedSymbols.has(this.stockMarketSelectedSymbol)
      ? this.stockMarketSelectedSymbol
      : this.stockMarketSnapshot?.stocks?.[0]?.symbol ?? '';
    if (!symbol) {
      return;
    }

    this.stockMarketRequestInFlight = true;
    this.hud.setStockMarketState({
      visible: true,
      market: this.stockMarketSnapshot,
      selectedSymbol: symbol,
      quantity: this.stockMarketQuantity,
      loading: true,
      error: ''
    });

    try {
      const result = await this.npcService?.tradeStock?.(
        this.stockMarketNpcId,
        symbol,
        side,
        this.stockMarketQuantity
      );
      if (!result?.ok || !result.market) {
        const error = result?.error ?? 'That trade did not go through.';
        this.hud.setStockMarketState({
          visible: true,
          market: this.stockMarketSnapshot,
          selectedSymbol: symbol,
          quantity: this.stockMarketQuantity,
          loading: false,
          error
        });
        this.hud.showToast(error);
        return;
      }

      this.setStockMarketSnapshot(result.market);
      this.scheduleWalletSnapshotRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.phoneWalletState = {
        ...this.phoneWalletState,
        wallet: result.market,
        cash: normalizeMoneyAmount(result.market.cash ?? result.money ?? 0),
        loading: false,
        error: ''
      };
      this.phoneStocksState = {
        ...this.phoneStocksState,
        market: result.market,
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      const listedSymbols = new Set((result.market.stocks ?? []).map((stock) => stock.symbol));
      this.stockMarketSelectedSymbol = listedSymbols.has(symbol)
        ? symbol
        : result.market.stocks?.[0]?.symbol ?? '';
      this.scheduleStockMarketRefresh(result.market, STOCK_MARKET_TICK_MS);
      this.hud.setStockMarketState({
        visible: this.hud.isStockMarketOpen(),
        market: this.stockMarketSnapshot,
        selectedSymbol: this.stockMarketSelectedSymbol,
        quantity: this.stockMarketQuantity,
        loading: false,
        error: ''
      });
      this.refreshPhoneStocksHud();
      const trade = result.trade ?? {};
      const verb = trade.side === 'sell' ? 'Sold' : 'Bought';
      this.hud.showToast(`${verb} ${trade.quantity ?? this.stockMarketQuantity} ${trade.symbol ?? symbol}.`);
      this.playSoundEffect(this.rentChaChingSound);
      this.refreshPhoneWalletHud();
    } catch (error) {
      console.warn('[StockMarket] Trade failed.', error);
      this.hud.setStockMarketState({
        visible: true,
        market: this.stockMarketSnapshot,
        selectedSymbol: symbol,
        quantity: this.stockMarketQuantity,
        loading: false,
        error: 'Trade request failed.'
      });
      this.hud.showToast('Trade request failed.');
    } finally {
      this.stockMarketRequestInFlight = false;
    }
  }

  getBartenderNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      bartenderEnabled: npcState?.bartenderEnabled === true || interactable?.npc?.bartenderEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getBartenderNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestBartenderInteractable({
    npcId = '',
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  } = {}) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const resolvedNpcId = String(interactable.npcId || interactable.placementId || '').trim();
      if (targetNpcId && resolvedNpcId !== targetNpcId) {
        continue;
      }

      const npcDetails = this.getBartenderNpcDetails(interactable);
      if (
        !isBartenderNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getBartenderNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getBartenderPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'bartender',
        npcId: resolvedNpcId,
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Order drinks',
        actionText: 'Bar menu opened.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  getBartenderMenuAnchor(interaction = null) {
    const npcId = String(interaction?.npcId || interaction?.placementId || '').trim();
    const speechAnchor = npcId
      ? this.worldBuilder?.getNpcSpeechAnchors?.()?.get(npcId)
      : null;
    const speechScreenPosition = speechAnchor ? this.projectSpeechAnchor(speechAnchor) : null;
    if (speechScreenPosition) {
      return {
        screenX: speechScreenPosition.x,
        screenY: speechScreenPosition.y
      };
    }

    if (!interaction?.position) {
      return null;
    }

    this.bartenderMenuAnchorPosition.copy(interaction.position);
    this.bartenderMenuAnchorPosition.y += 2.35;
    const fallbackScreenPosition = this.projectSpeechAnchor(this.bartenderMenuAnchorPosition);
    return fallbackScreenPosition
      ? {
          screenX: fallbackScreenPosition.x,
          screenY: fallbackScreenPosition.y
        }
      : null;
  }

  syncActiveBartenderMenu(bartenderInteraction = null) {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'bartender') {
      return;
    }

    const npcId = String(menu.npcId ?? '').trim();
    const activeInteraction = String(bartenderInteraction?.npcId ?? '').trim() === npcId
      ? bartenderInteraction
      : this.getNearestBartenderInteractable({ npcId });
    if (!activeInteraction) {
      this.closeInteractionMenu();
      return;
    }

    menu.npcName = String(activeInteraction?.npc?.name ?? menu.npcName ?? 'Bartender');
    menu.anchor = this.getBartenderMenuAnchor(activeInteraction);
    this.hud.setInteractionMenuAnchor(menu.anchor);
  }

  closeInteractionMenu() {
    this.activeInteractionMenu = null;
    this.hud.hideInteractionMenu();
  }

  handleInteractionMenuAction(action = '') {
    if (action === 'close') {
      this.closeInteractionMenu();
      return;
    }

    if (action.startsWith('bartender:')) {
      void this.buyBartenderDrink(action.slice('bartender:'.length));
    } else if (action.startsWith('pawnShop:')) {
      void this.buyPawnShopItem(action.slice('pawnShop:'.length));
    } else if (action.startsWith('carDealer:')) {
      void this.buyCarDealerVehicle(action.slice('carDealer:'.length));
    } else if (action.startsWith('martha:')) {
      void this.buyMarthaItem(action.slice('martha:'.length));
    }
  }

  renderBartenderMenu() {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'bartender') {
      return;
    }

    const cash = normalizeMoneyAmount(this.getLocalPlayerState()?.money ?? 0);
    const localPlayerState = this.getLocalPlayerState();
    const items = listBartenderMenuItems();
    const actions = items.map((item) => ({
      id: `bartender:${item.id}`,
      label: `Buy ${item.label} - ${formatMoneyAmount(item.price)} (${getPlayerDrinkCount(localPlayerState, item.id)})`,
      primary: item.id === 'beer',
      disabled: this.bartenderRequestInFlight || cash < item.price
    }));

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.bartenderRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Bartender',
      subtitle: `${items.map((item) => `${item.label} ${formatMoneyAmount(item.price)}`).join('. ')}. Cash ${formatMoneyAmount(cash)}. Inventory ${items.map((item) => `${item.label}: ${getPlayerDrinkCount(localPlayerState, item.id)}`).join(', ')}.`,
      actions,
      anchor: menu.anchor
    });
  }

  openBartenderMenu(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.activeInteractionMenu = {
      kind: 'bartender',
      npcId,
      npcName: String(interaction?.npc?.name ?? 'Bartender'),
      anchor: this.getBartenderMenuAnchor(interaction)
    };
    this.renderBartenderMenu();
  }

  async buyBartenderDrink(itemId = '') {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'bartender' || !menu.npcId || this.bartenderRequestInFlight) {
      return;
    }

    const item = getBartenderMenuItem(itemId);
    if (!item) {
      return;
    }

    this.bartenderRequestInFlight = true;
    this.renderBartenderMenu();
    try {
      const result = await this.npcService?.buyBartenderDrink?.(menu.npcId, item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That drink could not be purchased.');
        return;
      }

      this.phoneWalletState = {
        ...this.phoneWalletState,
        cash: normalizeMoneyAmount(result.money ?? this.phoneWalletState.cash ?? 0),
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.playSoundEffect(this.rentChaChingSound);
      this.refreshHotbarHud();
      this.hud.showToast(`Bought ${item.label.toLowerCase()} for ${formatMoneyAmount(item.price)}.`);
      this.renderBartenderMenu();
    } catch (error) {
      console.warn('[Bartender] Drink purchase failed.', error);
      this.hud.showToast('Drink purchase request failed.');
    } finally {
      this.bartenderRequestInFlight = false;
      if (this.activeInteractionMenu?.kind === 'bartender') {
        this.renderBartenderMenu();
      }
    }
  }

  getPawnShopOwnerNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      pawnShopOwnerEnabled: npcState?.pawnShopOwnerEnabled === true
        || interactable?.npc?.pawnShopOwnerEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getPawnShopOwnerNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestPawnShopOwnerInteractable({
    npcId = '',
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  } = {}) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const resolvedNpcId = String(interactable.npcId || interactable.placementId || '').trim();
      if (targetNpcId && resolvedNpcId !== targetNpcId) {
        continue;
      }

      const npcDetails = this.getPawnShopOwnerNpcDetails(interactable);
      if (
        !isPawnShopOwnerNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getPawnShopOwnerNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getPawnShopPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'pawn-shop-owner',
        npcId: resolvedNpcId,
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Browse pawn shop',
        actionText: 'Pawn shop menu opened.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  syncActivePawnShopMenu(pawnShopOwnerInteraction = null) {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'pawn-shop') {
      return;
    }

    const npcId = String(menu.npcId ?? '').trim();
    const activeInteraction = String(pawnShopOwnerInteraction?.npcId ?? '').trim() === npcId
      ? pawnShopOwnerInteraction
      : this.getNearestPawnShopOwnerInteractable({ npcId });
    if (!activeInteraction) {
      this.closeInteractionMenu();
      return;
    }

    menu.npcName = String(activeInteraction?.npc?.name ?? menu.npcName ?? 'Pawn Shop');
    menu.anchor = this.getBartenderMenuAnchor(activeInteraction);
    this.hud.setInteractionMenuAnchor(menu.anchor);
  }

  renderPawnShopMenu() {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'pawn-shop') {
      return;
    }

    const cash = normalizeMoneyAmount(this.getLocalPlayerState()?.money ?? 0);
    const localPlayerState = this.getLocalPlayerState();
    const items = listPawnShopMenuItems();
    const actions = items.map((item) => {
      const owned = item.kind === 'permanent' && isPlayerPawnShopItemOwned(localPlayerState, item.id);
      const count = item.kind === 'consumable'
        ? ` (${getPlayerPawnShopItemCount(localPlayerState, item.id)})`
        : '';
      return {
        id: `pawnShop:${item.id}`,
        label: owned ? `${item.label} - Owned` : `Buy ${item.label} - ${formatMoneyAmount(item.price)}${count}`,
        primary: item.id === 'cigarettes',
        disabled: this.pawnShopRequestInFlight || owned || cash < item.price
      };
    });

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.pawnShopRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Pawn Shop',
      subtitle: `${items.map((item) => `${item.label} ${formatMoneyAmount(item.price)}`).join('. ')}. Cash ${formatMoneyAmount(cash)}. Cigarettes: ${getPlayerPawnShopItemCount(localPlayerState, 'cigarettes')}.`,
      actions,
      anchor: menu.anchor
    });
  }

  openPawnShopMenu(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.activeInteractionMenu = {
      kind: 'pawn-shop',
      npcId,
      npcName: String(interaction?.npc?.name ?? 'Pawn Shop'),
      anchor: this.getBartenderMenuAnchor(interaction)
    };
    this.renderPawnShopMenu();
  }

  async buyPawnShopItem(itemId = '') {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'pawn-shop' || !menu.npcId || this.pawnShopRequestInFlight) {
      return;
    }

    const item = getPawnShopMenuItem(itemId);
    if (!item) {
      return;
    }

    this.pawnShopRequestInFlight = true;
    this.renderPawnShopMenu();
    try {
      const result = await this.npcService?.buyPawnShopItem?.(menu.npcId, item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That item could not be purchased.');
        return;
      }

      this.phoneWalletState = {
        ...this.phoneWalletState,
        cash: normalizeMoneyAmount(result.money ?? this.phoneWalletState.cash ?? 0),
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.playSoundEffect(this.rentChaChingSound);
      this.refreshHotbarHud();
      this.syncPlayerBoundItemsHud();
      this.hud.showToast(`Bought ${item.label.toLowerCase()} for ${formatMoneyAmount(item.price)}.`);
      this.renderPawnShopMenu();
    } catch (error) {
      console.warn('[PawnShop] Purchase failed.', error);
      this.hud.showToast('Pawn shop purchase request failed.');
    } finally {
      this.pawnShopRequestInFlight = false;
      if (this.activeInteractionMenu?.kind === 'pawn-shop') {
        this.renderPawnShopMenu();
      }
    }
  }

  getCarDealerNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      carDealerEnabled: npcState?.carDealerEnabled === true
        || interactable?.npc?.carDealerEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getNearestCarDealerInteractable({
    npcId = '',
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  } = {}) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const resolvedNpcId = String(interactable.npcId || interactable.placementId || '').trim();
      if (targetNpcId && resolvedNpcId !== targetNpcId) {
        continue;
      }

      const npcDetails = this.getCarDealerNpcDetails(interactable);
      if (
        !isCarDealerNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getPawnShopOwnerNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getCarDealerPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'car-dealer',
        npcId: resolvedNpcId,
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Browse cars',
        actionText: 'Car dealer menu opened.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  syncActiveCarDealerMenu(carDealerInteraction = null) {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'car-dealer') {
      return;
    }

    const npcId = String(menu.npcId ?? '').trim();
    const activeInteraction = String(carDealerInteraction?.npcId ?? '').trim() === npcId
      ? carDealerInteraction
      : this.getNearestCarDealerInteractable({ npcId });
    if (!activeInteraction) {
      this.closeInteractionMenu();
      return;
    }

    menu.npcName = String(activeInteraction?.npc?.name ?? menu.npcName ?? 'Car Dealer');
    menu.anchor = this.getBartenderMenuAnchor(activeInteraction);
    this.hud.setInteractionMenuAnchor(menu.anchor);
  }

  renderCarDealerMenu() {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'car-dealer') {
      return;
    }

    const cash = normalizeMoneyAmount(this.getLocalPlayerState()?.money ?? 0);
    const localPlayerState = this.getLocalPlayerState();
    const currentVehicleItemId = getPlayerVehicleItemId(localPlayerState);
    const currentVehicle = getPlayerVehicleMenuItem(localPlayerState);
    const items = listCarDealerMenuItems();
    const actions = items.map((item) => {
      const owned = currentVehicleItemId === item.id;
      return {
        id: `carDealer:${item.id}`,
        label: owned ? `${item.label} - Owned` : `Buy ${item.label} - ${formatMoneyAmount(item.price)}`,
        primary: item.id === 'car_fiat_duna',
        disabled: this.carDealerRequestInFlight || owned || cash < item.price
      };
    });

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.carDealerRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Car Dealer',
      subtitle: `${items.map((item) => `${item.label} ${formatMoneyAmount(item.price)}`).join('. ')}. Cash ${formatMoneyAmount(cash)}. Current car: ${currentVehicle?.label ?? 'None'}.`,
      actions,
      anchor: menu.anchor
    });
  }

  openCarDealerMenu(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.activeInteractionMenu = {
      kind: 'car-dealer',
      npcId,
      npcName: String(interaction?.npc?.name ?? 'Car Dealer'),
      anchor: this.getBartenderMenuAnchor(interaction)
    };
    this.renderCarDealerMenu();
  }

  async buyCarDealerVehicle(itemId = '') {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'car-dealer' || !menu.npcId || this.carDealerRequestInFlight) {
      return;
    }

    const item = getCarDealerMenuItem(itemId);
    if (!item) {
      return;
    }

    this.carDealerRequestInFlight = true;
    this.renderCarDealerMenu();
    try {
      const result = await this.npcService?.buyCarDealerVehicle?.(menu.npcId, item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That car could not be purchased.');
        return;
      }

      this.phoneWalletState = {
        ...this.phoneWalletState,
        cash: normalizeMoneyAmount(result.money ?? this.phoneWalletState.cash ?? 0),
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.playSoundEffect(this.rentChaChingSound);
      this.syncPlayerBoundItemsHud();
      this.hud.showToast(`Bought ${item.label} for ${formatMoneyAmount(item.price)}.`);
      this.renderCarDealerMenu();
    } catch (error) {
      console.warn('[CarDealer] Purchase failed.', error);
      this.hud.showToast('Car dealer purchase request failed.');
    } finally {
      this.carDealerRequestInFlight = false;
      if (this.activeInteractionMenu?.kind === 'car-dealer') {
        this.renderCarDealerMenu();
      }
    }
  }

  getMarthaNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      marthaEnabled: npcState?.marthaEnabled === true
        || interactable?.npc?.marthaEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getMarthaNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestMarthaInteractable({
    npcId = '',
    worldBuilderInteractables = this.getWorldBuilderInteractables()
  } = {}) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const resolvedNpcId = String(interactable.npcId || interactable.placementId || '').trim();
      if (targetNpcId && resolvedNpcId !== targetNpcId) {
        continue;
      }

      const npcDetails = this.getMarthaNpcDetails(interactable);
      if (
        !isMarthaNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getMarthaNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getMarthaPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'martha',
        npcId: resolvedNpcId,
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Order food',
        actionText: "Martha's menu opened."
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  syncActiveMarthaMenu(marthaInteraction = null) {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'martha') {
      return;
    }

    const npcId = String(menu.npcId ?? '').trim();
    const activeInteraction = String(marthaInteraction?.npcId ?? '').trim() === npcId
      ? marthaInteraction
      : this.getNearestMarthaInteractable({ npcId });
    if (!activeInteraction) {
      this.closeInteractionMenu();
      return;
    }

    menu.npcName = String(activeInteraction?.npc?.name ?? menu.npcName ?? 'Martha');
    menu.anchor = this.getBartenderMenuAnchor(activeInteraction);
    this.hud.setInteractionMenuAnchor(menu.anchor);
  }

  renderMarthaMenu() {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'martha') {
      return;
    }

    const cash = normalizeMoneyAmount(this.getLocalPlayerState()?.money ?? 0);
    const localPlayerState = this.getLocalPlayerState();
    const items = listMarthaMenuItems();
    const actions = items.map((item) => ({
      id: `martha:${item.id}`,
      label: `Buy ${item.label} - ${formatMoneyAmount(item.price)} (${getPlayerMarthaItemCount(localPlayerState, item.id)})`,
      primary: item.id === 'burger',
      disabled: this.marthaRequestInFlight || cash < item.price
    }));

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.marthaRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Martha',
      subtitle: `${items.map((item) => `${item.label} ${formatMoneyAmount(item.price)}`).join('. ')}. Cash ${formatMoneyAmount(cash)}. Inventory ${items.map((item) => `${item.label}: ${getPlayerMarthaItemCount(localPlayerState, item.id)}`).join(', ')}.`,
      actions,
      anchor: menu.anchor
    });
  }

  openMarthaMenu(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.activeInteractionMenu = {
      kind: 'martha',
      npcId,
      npcName: String(interaction?.npc?.name ?? 'Martha'),
      anchor: this.getBartenderMenuAnchor(interaction)
    };
    this.renderMarthaMenu();
  }

  async buyMarthaItem(itemId = '') {
    const menu = this.activeInteractionMenu;
    if (menu?.kind !== 'martha' || !menu.npcId || this.marthaRequestInFlight) {
      return;
    }

    const item = getMarthaMenuItem(itemId);
    if (!item) {
      return;
    }

    this.marthaRequestInFlight = true;
    this.renderMarthaMenu();
    try {
      const result = await this.npcService?.buyMarthaItem?.(menu.npcId, item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That item could not be purchased.');
        return;
      }

      this.phoneWalletState = {
        ...this.phoneWalletState,
        cash: normalizeMoneyAmount(result.money ?? this.phoneWalletState.cash ?? 0),
        loading: false,
        error: ''
      };
      this.refreshPhoneWalletHud();
      this.playSoundEffect(this.rentChaChingSound);
      this.refreshHotbarHud();
      this.hud.showToast(`Bought ${item.label.toLowerCase()} for ${formatMoneyAmount(item.price)}.`);
      this.renderMarthaMenu();
    } catch (error) {
      console.warn('[Martha] Purchase failed.', error);
      this.hud.showToast("Martha's purchase request failed.");
    } finally {
      this.marthaRequestInFlight = false;
      if (this.activeInteractionMenu?.kind === 'martha') {
        this.renderMarthaMenu();
      }
    }
  }

  async consumeInventoryDrink(itemId = '') {
    const item = getBartenderMenuItem(itemId);
    if (!item || this.inventoryRequestInFlight) {
      return false;
    }

    this.inventoryRequestInFlight = true;
    try {
      const result = await this.npcService?.consumeInventoryItem?.(item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? `Could not drink ${item.label.toLowerCase()}.`);
        return false;
      }

      const level = Math.max(0, Math.floor(Number(result.drunkness?.drunknessLevel) || 0));
      this.player?.playEmote(DRINKING_EMOTE_ID);
      this.hud.setDrunknessState({ level });
      this.updateDrunknessEffects({ drunknessLevel: level });
      this.hud.showToast(level > 0
        ? `Drank ${item.label.toLowerCase()}. Drunkness level ${level}.`
        : `Drank ${item.label.toLowerCase()}.`);
      this.refreshHotbarHud();
      return true;
    } catch (error) {
      console.warn('[Inventory] Drink consumption failed.', error);
      this.hud.showToast('Could not use that drink.');
      return false;
    } finally {
      this.inventoryRequestInFlight = false;
    }
  }

  async consumeInventoryConsumable(itemId = '') {
    const item = getPawnShopMenuItem(itemId) ?? getMarthaMenuItem(itemId);
    if (!item || item.kind !== 'consumable' || this.inventoryRequestInFlight) {
      return false;
    }

    this.inventoryRequestInFlight = true;
    try {
      const result = await this.npcService?.consumeInventoryItem?.(item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? `Could not use ${item.label.toLowerCase()}.`);
        return false;
      }

      this.player?.playEmote(DRINKING_EMOTE_ID);
      const healed = Math.max(0, Math.floor(Number(result.health?.healed) || 0));
      this.hud.showToast(result.message
        ? `${result.message}${healed > 0 ? ` +${healed} health.` : ''}`
        : `Used ${item.label.toLowerCase()}.`);
      this.refreshHotbarHud();
      return true;
    } catch (error) {
      console.warn('[Inventory] Consumable use failed.', error);
      this.hud.showToast('Could not use that item.');
      return false;
    } finally {
      this.inventoryRequestInFlight = false;
    }
  }

  getBlackjackNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      blackjackDealerEnabled: npcState?.blackjackDealerEnabled === true
        || interactable?.npc?.blackjackDealerEnabled === true,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getBlackjackNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestBlackjackDealerInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const npcDetails = this.getBlackjackNpcDetails(interactable);
      if (
        !isBlackjackDealerNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getBlackjackNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getBlackjackPromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      nearest = {
        ...interactable,
        kind: 'blackjack',
        npcId: interactable.npcId || interactable.placementId || '',
        npc: npcDetails,
        position,
        radius: promptRadius,
        prompt: 'Play blackjack',
        actionText: 'Sat at the blackjack table.'
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  getSchoolMicrogameNpcDetails(interactable = null) {
    const npcId = interactable?.npcId || interactable?.placementId || '';
    const npcState = npcId ? this.npcServiceState.npcs.get(npcId) : null;
    return {
      ...(interactable?.npc ?? {}),
      ...(npcState ?? {}),
      schoolMicrogameEnabled: npcState?.schoolMicrogameEnabled === true
        || interactable?.npc?.schoolMicrogameEnabled === true,
      schoolMicrogameId: npcState?.schoolMicrogameId
        ?? interactable?.npc?.schoolMicrogameId
        ?? SCHOOL_MICROGAME_ALL_ID,
      interactRadius: npcState?.interactRadius ?? interactable?.npc?.interactRadius ?? interactable?.radius
    };
  }

  getSchoolMicrogameNpcPosition(interactable = null, npcDetails = null) {
    const x = Number(
      npcDetails?.x
      ?? npcDetails?.position?.[0]
      ?? interactable?.originPosition?.x
      ?? interactable?.position?.x
    );
    const z = Number(
      npcDetails?.z
      ?? npcDetails?.position?.[1]
      ?? interactable?.originPosition?.z
      ?? interactable?.position?.z
    );
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return new THREE.Vector3(x, this.getActiveGroundHeightAt({ x, z }), z);
  }

  getNearestSchoolMicrogameInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc') {
        continue;
      }

      const npcDetails = this.getSchoolMicrogameNpcDetails(interactable);
      if (
        !isSchoolMicrogameNpc(npcDetails)
        || npcDetails.alive === false
        || npcDetails.mode === 'hidden'
        || npcDetails.mode === 'dead'
      ) {
        continue;
      }

      const position = this.getSchoolMicrogameNpcPosition(interactable, npcDetails);
      if (!position) {
        continue;
      }

      const distance = Math.hypot(position.x - this.player.position.x, position.z - this.player.position.z);
      const promptRadius = getSchoolMicrogamePromptRadius(npcDetails, interactable.radius);
      if (distance > promptRadius || distance >= nearestDistance) {
        continue;
      }

      const gameId = normalizeSchoolMicrogameId(npcDetails.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
      const gameDefinition = gameId === SCHOOL_MICROGAME_ALL_ID ? null : getSchoolMicrogameDefinition(gameId);
      nearest = {
        ...interactable,
        kind: 'school-microgame',
        npcId: interactable.npcId || interactable.placementId || '',
        npc: npcDetails,
        gameId,
        position,
        radius: promptRadius,
        schoolMicrogameId: gameId,
        prompt: gameDefinition?.prompt ?? 'Play school microgame',
        actionText: `${gameDefinition?.title ?? 'School microgame'} started.`
      };
      nearestDistance = distance;
    }

    return nearest;
  }

  getDebugMinigameRequest() {
    if (!isLocalDebugHost()) {
      return '';
    }

    try {
      const url = new URL(window.location.href);
      return String(
        url.searchParams.get('debugMinigame')
        ?? url.searchParams.get('previewMinigame')
        ?? ''
      ).trim().toLowerCase();
    } catch {
      return '';
    }
  }

  maybeOpenRequestedDebugMinigame() {
    if (this.debugMinigameRequestHandled) {
      return;
    }

    const requestedMinigame = this.getDebugMinigameRequest();
    if (!requestedMinigame) {
      return;
    }

    if (!this.bootCriticalReady || this.hud?.isLoadingVisible?.()) {
      window.clearTimeout(this.debugMinigameRequestRetryTimeout);
      this.debugMinigameRequestRetryTimeout = window.setTimeout(() => {
        this.maybeOpenRequestedDebugMinigame();
      }, 120);
      return;
    }

    this.debugMinigameRequestHandled = true;
    window.clearTimeout(this.debugMinigameRequestRetryTimeout);
    window.setTimeout(() => {
      this.openDebugMinigameHud(requestedMinigame);
    }, 0);
  }

  getBlackjackPreviewMoney() {
    return Math.max(1000, Number(this.getLocalPlayerState()?.money ?? 0));
  }

  openDebugMinigameHud(minigameId = 'blackjack') {
    const normalizedId = String(minigameId ?? '').trim().toLowerCase();
    if (['vibe-hero-editor', 'vibeheroeditor', 'vibe-hero-chart-editor'].includes(normalizedId)) {
      const opened = this.openVibeHeroChartEditor();
      if (opened) {
        this.hud.showToast('Vibe Hero chart editor opened.');
      }
      return opened;
    }

    if (normalizedId === VIBE_HERO_GAME_ID || normalizedId === 'vibehero') {
      this.openVibeHero();
      this.hud.showToast('Vibe Hero HUD preview opened.');
      return true;
    }

    if (normalizedId !== 'blackjack') {
      const schoolId = normalizeSchoolMicrogameId(normalizedId, '');
      if (schoolId) {
        return this.openDebugSchoolMicrogame(schoolId);
      }
      this.hud.showToast(`No ${normalizedId || 'minigame'} HUD preview exists yet.`);
      return false;
    }

    this.closePhoneMenu();
    this.blackjackPreviewMode = true;
    this.blackjackPreviewSession = null;
    this.blackjackNpcId = 'debug-blackjack';
    this.blackjackDealerName = 'Preview Dealer';
    this.blackjackState = null;
    this.hud.setBlackjackState({
      visible: true,
      game: null,
      wager: this.blackjackWager,
      loading: false,
      error: '',
      dealerName: this.blackjackDealerName
    });
    this.hud.showToast('Blackjack HUD preview opened.');
    return true;
  }

  startBlackjackPreviewRound() {
    this.blackjackPreviewSession = createBlackjackSession({
      npcId: 'debug-blackjack',
      wager: this.blackjackWager,
      now: Date.now()
    });
    this.blackjackState = serializeBlackjackSession(this.blackjackPreviewSession, {
      money: this.getBlackjackPreviewMoney()
    });
    this.syncBlackjackHud({ loading: false, error: '' });
    this.playBlackjackCardSound();
    this.playBlackjackWinSound(this.blackjackState);
  }

  handleBlackjackPreviewAction(action = '') {
    if (!this.blackjackPreviewSession) {
      this.startBlackjackPreviewRound();
      return;
    }

    if (action === 'hit') {
      hitBlackjackSession(this.blackjackPreviewSession);
    } else if (action === 'stand') {
      standBlackjackSession(this.blackjackPreviewSession);
    } else if (action === 'double') {
      doubleBlackjackSession(this.blackjackPreviewSession);
    } else if (action === 'split') {
      splitBlackjackSession(this.blackjackPreviewSession);
    } else {
      return;
    }

    this.blackjackState = serializeBlackjackSession(this.blackjackPreviewSession, {
      money: this.getBlackjackPreviewMoney()
    });
    this.syncBlackjackHud({ loading: false, error: '' });
    this.playBlackjackCardSound();
    this.playBlackjackWinSound(this.blackjackState);
  }

  setBlackjackWager(wager = BLACKJACK_DEFAULT_WAGER) {
    this.blackjackWager = normalizeBlackjackWager(wager);
    this.syncBlackjackHud();
  }

  syncBlackjackHud({ loading = this.blackjackRequestInFlight, error = '' } = {}) {
    this.hud.setBlackjackState({
      visible: this.hud.isBlackjackOpen(),
      game: this.blackjackState,
      wager: this.blackjackWager,
      loading,
      error,
      dealerName: this.blackjackDealerName
    });
  }

  playBlackjackCardSound() {
    this.playSoundEffect(this.playingCardSound);
  }

  playBlackjackWinSound(game = null) {
    const outcome = String(game?.outcome ?? '');
    if (game?.phase === 'complete' && (outcome === 'blackjack' || outcome === 'win')) {
      this.playSoundEffect(this.rentChaChingSound);
    }
  }

  openBlackjack(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.blackjackPreviewMode = false;
    this.blackjackPreviewSession = null;
    this.blackjackNpcId = npcId;
    this.blackjackDealerName = String(interaction?.npc?.name ?? 'Dealer');
    this.hud.setBlackjackState({
      visible: true,
      game: this.blackjackState,
      wager: this.blackjackWager,
      loading: false,
      error: '',
      dealerName: this.blackjackDealerName
    });
  }

  closeBlackjack() {
    const closingPreview = this.blackjackPreviewMode;
    this.blackjackPreviewMode = false;
    this.blackjackPreviewSession = null;
    if (closingPreview) {
      this.blackjackState = null;
      this.blackjackNpcId = '';
      this.blackjackDealerName = 'Dealer';
    }
    this.hud.setBlackjackState({
      visible: false,
      game: this.blackjackState,
      wager: this.blackjackWager,
      loading: false,
      error: '',
      dealerName: this.blackjackDealerName
    });
  }

  getVibeHeroChartEditorStorage() {
    try {
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  getVibeHeroStoredChartKey(songId = '') {
    const normalizedSongId = normalizeVibeHeroSongId(songId);
    return `${VIBE_HERO_EDITOR_STORAGE_PREFIX}${normalizedSongId}`;
  }

  normalizeVibeHeroEditorChart(chart = []) {
    if (!Array.isArray(chart)) {
      return [];
    }

    return chart
      .map((note, index) => this.normalizeVibeHeroEditorChartNote(note, index))
      .filter(Boolean)
      .sort((left, right) => left.timeMs - right.timeMs)
      .map((note, index) => ({
        ...note,
        id: note.id || `editor-note-${index + 1}`
      }));
  }

  normalizeVibeHeroEditorChartNote(note = null, index = 0) {
    if (!note || typeof note !== 'object') {
      return null;
    }

    const timeMs = Math.round(Number(note.timeMs));
    if (!Number.isFinite(timeMs) || timeMs < 0) {
      return null;
    }

    const lane = THREE.MathUtils.clamp(
      Math.trunc(Number(note.lane) || 0),
      0,
      VIBE_HERO_LANE_COUNT - 1
    );
    const fallbackPitch = VIBE_HERO_EDITOR_LANE_PITCHES[lane] ?? 'A4';
    const fallbackFrequency = VIBE_HERO_EDITOR_LANE_FREQUENCIES[lane] ?? 440;
    const frequency = Math.max(80, Number(note.frequency ?? fallbackFrequency) || fallbackFrequency);
    return {
      id: String(note.id ?? `editor-note-${index + 1}`),
      timeMs,
      durationMs: Math.max(60, Math.min(900, Math.round(Number(note.durationMs ?? VIBE_HERO_EDITOR_NOTE_DURATION_MS) || VIBE_HERO_EDITOR_NOTE_DURATION_MS))),
      lane,
      pitch: String(note.pitch ?? fallbackPitch),
      frequency
    };
  }

  createVibeHeroNoteState(note = null, index = 0) {
    return {
      ...note,
      id: note?.id || `note-${index + 1}`,
      status: 'pending',
      hitErrorMs: null,
      hitQuality: ''
    };
  }

  loadVibeHeroStoredEditorChart(song = null) {
    if (!song?.id || !this.isLocalAdmin()) {
      return null;
    }

    const storage = this.getVibeHeroChartEditorStorage();
    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(this.getVibeHeroStoredChartKey(song.id));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const chart = this.normalizeVibeHeroEditorChart(parsed?.chart ?? parsed);
      return chart.length > 0 ? chart : null;
    } catch (error) {
      console.warn('[VibeHero] Stored chart could not be loaded.', error);
      return null;
    }
  }

  serializeVibeHeroEditorChart(chart = []) {
    return this.normalizeVibeHeroEditorChart(chart).map((note) => ({
      id: note.id,
      timeMs: note.timeMs,
      durationMs: note.durationMs,
      lane: note.lane,
      pitch: note.pitch,
      frequency: note.frequency
    }));
  }

  saveVibeHeroEditorChart(game = this.vibeHero, { force = false } = {}) {
    if (!game?.editorMode || !game?.song?.id || !this.isLocalAdmin()) {
      return false;
    }
    if (!force && game.editorDirty !== true) {
      return false;
    }

    const storage = this.getVibeHeroChartEditorStorage();
    if (!storage) {
      return false;
    }

    try {
      const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
      storage.setItem(
        this.getVibeHeroStoredChartKey(game.song.id),
        JSON.stringify({
          songId: game.song.id,
          savedAt: new Date().toISOString(),
          chart
        })
      );
      game.editorDirty = false;
      game.editorSavedAt = performance.now();
      return true;
    } catch (error) {
      console.warn('[VibeHero] Stored chart could not be saved.', error);
      return false;
    }
  }

  createVibeHeroState(songId = this.vibeHeroSelectedSongId, { editorMode = false } = {}) {
    const normalizedSongId = normalizeVibeHeroSongId(songId);
    const baseSong = getVibeHeroSong(normalizedSongId) ?? getVibeHeroSong(VIBE_HERO_DEFAULT_SONG_ID);
    const sourceChart = this.normalizeVibeHeroEditorChart(baseSong?.chart ?? []);
    const storedChart = this.loadVibeHeroStoredEditorChart(baseSong);
    const activeChart = storedChart ?? sourceChart;
    const song = baseSong
      ? {
          ...baseSong,
          chart: activeChart.map((note) => ({ ...note })),
          audioUrl: this.getVibeHeroSongAudioUrl(baseSong)
        }
      : null;
    const songs = listVibeHeroSongs().map((entry) => {
      const storedEntryChart = this.loadVibeHeroStoredEditorChart(entry);
      return {
        id: entry.id,
        title: entry.title,
        artist: entry.artist,
        performer: entry.performer,
        sourceTitle: entry.sourceTitle,
        sourceUrl: entry.sourceUrl,
        publicDomainBasis: entry.publicDomainBasis,
        sourceLicense: entry.sourceLicense,
        durationMs: entry.durationMs,
        bpm: entry.bpm,
        difficulty: entry.difficulty,
        previewColor: entry.previewColor,
        noteCount: (storedEntryChart ?? entry.chart).length,
        chartEdited: Boolean(storedEntryChart),
        audioUrl: this.getVibeHeroSongAudioUrl(entry)
      };
    });
    const editing = Boolean(editorMode && this.isLocalAdmin());

    return {
      id: `vibe_hero_${++this.vibeHeroSequence}`,
      gameId: VIBE_HERO_GAME_ID,
      laneCount: VIBE_HERO_LANE_COUNT,
      phase: editing ? 'editor-select' : 'select',
      editorMode: editing,
      selectedSongId: song?.id ?? VIBE_HERO_DEFAULT_SONG_ID,
      song,
      songs,
      sourceChart: sourceChart.map((note) => ({ ...note })),
      editorChart: activeChart.map((note) => ({ ...note })),
      notes: (song?.chart ?? []).map((note, index) => this.createVibeHeroNoteState(note, index)),
      noteTravelMs: VIBE_HERO_NOTE_TRAVEL_MS,
      hitWindowMs: VIBE_HERO_HIT_WINDOW_MS,
      durationMs: song?.durationMs ?? 0,
      currentTimeMs: 0,
      remainingMs: song?.durationMs ?? 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      streak: 0,
      startedAt: 0,
      countdownStartedAt: 0,
      countdownEndsAt: 0,
      countdownMs: 0,
      resultTitle: '',
      resultDetail: '',
      charismaRewardClaimed: false,
      charismaRewardPending: false,
      editorPaused: true,
      editorRecording: false,
      editorPlaybackStartedAt: 0,
      editorPlaybackBaseMs: 0,
      editorLastOverwriteMs: 0,
      editorSeekStepMs: VIBE_HERO_EDITOR_SEEK_MS,
      editorRecordWindowMs: VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS,
      editorRecordStepMs: VIBE_HERO_EDITOR_RECORD_STEP_MS,
      editorHoldRepeatDelayMs: VIBE_HERO_EDITOR_HOLD_REPEAT_DELAY_MS,
      editorLaneLastRecordMs: Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity),
      editorLaneHeld: Array.from({ length: VIBE_HERO_LANE_COUNT }, () => false),
      editorDirty: false,
      editorSavedAt: 0,
      message: editing ? 'Pick a song to edit.' : 'Pick a song and take the stage.',
      laneFlashes: []
    };
  }

  getVibeHeroSongAudioUrl(song = null) {
    const audioAssetKey = String(song?.audioAssetKey ?? '').trim();
    if (audioAssetKey && assets.audio?.vibeHero?.[audioAssetKey]) {
      return assets.audio.vibeHero[audioAssetKey];
    }
    return String(song?.sourceDownloadUrl ?? '').trim();
  }

  preloadVibeHeroSongAudio(song = null) {
    const audioUrl = this.getVibeHeroSongAudioUrl(song);
    if (!audioUrl || this.vibeHeroAudioPreloads.has(audioUrl)) {
      return false;
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.volume = this.getVibeHeroMusicVolume(this.vibeHero);
    audio.load();
    this.vibeHeroAudioPreloads.set(audioUrl, audio);
    return true;
  }

  canUseVibeHeroChartEditor() {
    return this.isLocalAdmin();
  }

  openVibeHero(interaction = null, { editorMode = false } = {}) {
    const editing = Boolean(editorMode && this.canUseVibeHeroChartEditor());
    if (editorMode && !editing) {
      this.hud.showToast('Chart editor is admin only.');
      return false;
    }

    this.closePhoneMenu();
    this.stopVibeHeroAudio();
    this.vibeHero = this.createVibeHeroState(this.vibeHeroSelectedSongId, { editorMode: editing });
    this.preloadVibeHeroSongAudio(this.vibeHero.song);
    this.hud.hideLoading();
    this.hud.setVibeHeroState({
      visible: true,
      game: this.vibeHero
    });
    this.currentInteractable = interaction ?? this.currentInteractable;
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
    return true;
  }

  openVibeHeroChartEditor(interaction = null) {
    return this.openVibeHero(interaction, { editorMode: true });
  }

  closeVibeHero() {
    this.saveVibeHeroEditorChart(this.vibeHero);
    this.stopVibeHeroAudio();
    this.vibeHero = this.vibeHero
      ? {
          ...this.vibeHero,
          phase: this.vibeHero.phase === 'playing' ? 'complete' : this.vibeHero.phase,
          message: this.vibeHero.phase === 'playing' ? 'Set finished.' : this.vibeHero.message
        }
      : null;
    this.hud.setVibeHeroState({
      visible: false,
      game: this.vibeHero
    });
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
  }

  syncVibeHeroHud() {
    this.hud.setVibeHeroState({
      visible: this.hud.isVibeHeroOpen(),
      game: this.vibeHero
    });
  }

  selectVibeHeroSong(songId = VIBE_HERO_DEFAULT_SONG_ID) {
    if (!this.vibeHero || this.vibeHero.phase === 'playing' || this.vibeHero.phase === 'countdown') {
      return false;
    }

    this.saveVibeHeroEditorChart(this.vibeHero);
    const normalizedSongId = normalizeVibeHeroSongId(songId);
    const editorMode = this.vibeHero.editorMode === true;
    this.vibeHeroSelectedSongId = normalizedSongId;
    this.vibeHero = this.createVibeHeroState(normalizedSongId, { editorMode });
    this.vibeHero.message = editorMode
      ? `${this.vibeHero.song?.title ?? 'Song'} ready to edit.`
      : `${this.vibeHero.song?.title ?? 'Song'} loaded.`;
    this.preloadVibeHeroSongAudio(this.vibeHero.song);
    this.syncVibeHeroHud();
    return true;
  }

  startVibeHeroCountdown() {
    if (this.vibeHero?.editorMode) {
      return this.startVibeHeroChartEditor();
    }

    if (!this.vibeHero) {
      this.vibeHero = this.createVibeHeroState(this.vibeHeroSelectedSongId);
    }

    this.stopVibeHeroAudio();
    const songId = this.vibeHero.selectedSongId ?? this.vibeHeroSelectedSongId;
    this.vibeHero = this.createVibeHeroState(songId);
    this.preloadVibeHeroSongAudio(this.vibeHero.song);
    const now = performance.now();
    this.vibeHero.phase = 'countdown';
    this.vibeHero.countdownStartedAt = now;
    this.vibeHero.countdownEndsAt = now + VIBE_HERO_COUNTDOWN_MS;
    this.vibeHero.countdownGoMs = VIBE_HERO_COUNTDOWN_GO_MS;
    this.vibeHero.countdownMs = VIBE_HERO_COUNTDOWN_MS;
    this.vibeHero.remainingMs = VIBE_HERO_COUNTDOWN_MS;
    this.vibeHero.message = 'Ready.';
    this.input.clearKeyPressQueue?.();
    this.playSoundEffect(this.phoneUnlockSound);
    this.syncVibeHeroHud();
    return true;
  }

  beginVibeHeroSong() {
    if (!this.vibeHero || this.vibeHero.phase === 'playing') {
      return false;
    }

    const now = performance.now();
    this.vibeHero.phase = 'playing';
    this.vibeHero.startedAt = now;
    this.vibeHero.currentTimeMs = 0;
    this.vibeHero.remainingMs = this.vibeHero.durationMs;
    this.vibeHero.message = this.vibeHero.song?.title ?? 'Vibe Hero';
    this.vibeHero.resultTitle = '';
    this.vibeHero.resultDetail = '';
    this.scheduleVibeHeroSong(this.vibeHero.song);
    this.syncVibeHeroHud();
    return true;
  }

  handleVibeHeroAction(action = '') {
    const normalizedAction = String(action ?? '').trim();
    if (!normalizedAction) {
      return false;
    }

    if (normalizedAction === 'start' || normalizedAction === 'restart') {
      return this.startVibeHeroCountdown();
    }

    if (normalizedAction === 'editor:play-pause') {
      return this.toggleVibeHeroEditorPlayback();
    }

    if (normalizedAction === 'editor:record') {
      return this.toggleVibeHeroEditorRecording();
    }

    if (normalizedAction === 'editor:rewind') {
      return this.seekVibeHeroEditor(-VIBE_HERO_EDITOR_SEEK_MS);
    }

    if (normalizedAction === 'editor:forward') {
      return this.seekVibeHeroEditor(VIBE_HERO_EDITOR_SEEK_MS);
    }

    if (normalizedAction.startsWith('song:')) {
      return this.selectVibeHeroSong(normalizedAction.slice(5));
    }

    if (normalizedAction.startsWith('lane:')) {
      const laneIndex = Math.trunc(Number(normalizedAction.slice(5)));
      if (this.vibeHero?.phase === 'editor') {
        return this.recordVibeHeroEditorLanes([laneIndex]);
      }
      return this.hitVibeHeroLane(laneIndex);
    }

    return false;
  }

  updateVibeHero(deltaSeconds = 0, now = performance.now()) {
    const game = this.vibeHero;
    if (!game || !this.hud.isVibeHeroOpen()) {
      return;
    }

    if (game.phase === 'editor') {
      this.updateVibeHeroEditor(deltaSeconds, now);
      return;
    }

    if (game.phase !== 'playing') {
      this.handleVibeHeroKeyboardInput();
    }

    if (game.phase === 'countdown') {
      game.countdownMs = Math.max(0, game.countdownEndsAt - now);
      game.remainingMs = game.countdownMs;
      if (game.countdownMs <= 0) {
        this.beginVibeHeroSong();
      } else {
        this.syncVibeHeroHud();
      }
      return;
    }

    if (game.phase !== 'playing') {
      return;
    }

    game.currentTimeMs = Math.max(0, now - game.startedAt);
    game.remainingMs = Math.max(0, game.durationMs - game.currentTimeMs);
    this.updateVibeHeroAudioFade(game);
    this.handleVibeHeroKeyboardInput();
    this.updateVibeHeroMisses(game);
    const pendingNotes = game.notes.some((note) => note.status === 'pending');
    if (!pendingNotes && game.currentTimeMs >= Math.max(0, game.durationMs - VIBE_HERO_POST_SONG_MS)) {
      this.finishVibeHero();
      return;
    }
    if (game.currentTimeMs >= game.durationMs + VIBE_HERO_POST_SONG_MS) {
      this.finishVibeHero();
      return;
    }

    if (Number(deltaSeconds) >= 0) {
      game.laneFlashes = (game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS);
    }
    this.syncVibeHeroHud();
  }

  startVibeHeroChartEditor() {
    if (!this.vibeHero?.editorMode) {
      return false;
    }

    this.saveVibeHeroEditorChart(this.vibeHero);
    this.stopVibeHeroAudio();
    const songId = this.vibeHero.selectedSongId ?? this.vibeHeroSelectedSongId;
    this.vibeHero = this.createVibeHeroState(songId, { editorMode: true });
    const now = performance.now();
    this.vibeHero.phase = 'editor';
    this.vibeHero.editorPaused = false;
    this.vibeHero.editorRecording = false;
    this.vibeHero.editorPlaybackBaseMs = 0;
    this.vibeHero.editorPlaybackStartedAt = now;
    this.vibeHero.editorLastOverwriteMs = 0;
    this.vibeHero.editorLaneLastRecordMs = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
    this.vibeHero.editorLaneHeld = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => false);
    this.vibeHero.currentTimeMs = 0;
    this.vibeHero.remainingMs = this.vibeHero.durationMs;
    this.vibeHero.message = `${this.vibeHero.song?.title ?? 'Song'} chart editor.`;
    this.input.clearKeyPressQueue?.();
    this.scheduleVibeHeroSong(this.vibeHero.song, { offsetMs: 0 });
    this.syncVibeHeroHud();
    return true;
  }

  updateVibeHeroEditor(deltaSeconds = 0, now = performance.now()) {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const previousTimeMs = Math.max(0, Number(game.currentTimeMs ?? 0) || 0);
    this.updateVibeHeroEditorTime(game, now);
    if (game.editorRecording && !game.editorPaused) {
      const fromMs = Math.max(0, Number(game.editorLastOverwriteMs ?? previousTimeMs) || 0);
      const toMs = Math.max(0, Number(game.currentTimeMs ?? previousTimeMs) || 0);
      if (toMs > fromMs) {
        this.recordVibeHeroEditorPlaybackRange(game, fromMs, toMs);
      }
      game.editorLastOverwriteMs = toMs;
    }

    this.updateVibeHeroAudioFade(game);
    this.handleVibeHeroKeyboardInput();
    if (Number(deltaSeconds) >= 0) {
      game.laneFlashes = (game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS);
    }
    this.syncVibeHeroHud();
    return true;
  }

  updateVibeHeroEditorTime(game = this.vibeHero, now = performance.now()) {
    if (!game || game.phase !== 'editor') {
      return 0;
    }

    if (!game.editorPaused) {
      const baseMs = Math.max(0, Number(game.editorPlaybackBaseMs ?? game.currentTimeMs ?? 0) || 0);
      const startedAt = Math.max(0, Number(game.editorPlaybackStartedAt ?? now) || now);
      const elapsedMs = Math.max(0, now - startedAt);
      game.currentTimeMs = THREE.MathUtils.clamp(baseMs + elapsedMs, 0, game.durationMs);
      if (game.currentTimeMs >= game.durationMs) {
        game.editorPaused = true;
        game.editorPlaybackBaseMs = game.durationMs;
        game.editorPlaybackStartedAt = now;
        game.editorLastOverwriteMs = game.durationMs;
        this.stopVibeHeroAudio();
        this.saveVibeHeroEditorChart(game);
        game.message = 'Reached the end of the chart.';
      }
    }

    game.remainingMs = Math.max(0, game.durationMs - game.currentTimeMs);
    return game.currentTimeMs;
  }

  toggleVibeHeroEditorPlayback() {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const now = performance.now();
    this.updateVibeHeroEditorTime(game, now);
    if (game.editorPaused) {
      game.editorPaused = false;
      game.editorPlaybackBaseMs = THREE.MathUtils.clamp(game.currentTimeMs, 0, game.durationMs);
      game.editorPlaybackStartedAt = now;
      game.editorLastOverwriteMs = game.editorRecording ? Math.max(0, game.currentTimeMs - 1) : game.currentTimeMs;
      game.editorLaneLastRecordMs = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
      game.editorLaneHeld = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => false);
      game.message = game.editorRecording ? 'Recording.' : 'Playing.';
      this.scheduleVibeHeroSong(game.song, { offsetMs: game.currentTimeMs });
    } else {
      game.editorPaused = true;
      game.editorPlaybackBaseMs = THREE.MathUtils.clamp(game.currentTimeMs, 0, game.durationMs);
      game.editorPlaybackStartedAt = now;
      game.message = game.editorRecording ? 'Recording paused.' : 'Paused.';
      this.stopVibeHeroAudio();
      this.saveVibeHeroEditorChart(game);
    }
    this.syncVibeHeroHud();
    return true;
  }

  toggleVibeHeroEditorRecording() {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    this.updateVibeHeroEditorTime(game);
    game.editorRecording = !game.editorRecording;
    const currentTimeMs = Math.max(0, Number(game.currentTimeMs ?? 0) || 0);
    game.editorLastOverwriteMs = game.editorRecording ? Math.max(0, currentTimeMs - 1) : currentTimeMs;
    game.editorLaneLastRecordMs = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
    game.editorLaneHeld = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => false);
    game.message = game.editorRecording ? 'Recording.' : 'Recording stopped.';
    if (!game.editorRecording) {
      this.saveVibeHeroEditorChart(game);
    }
    this.syncVibeHeroHud();
    return true;
  }

  seekVibeHeroEditor(deltaMs = 0) {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const now = performance.now();
    const wasPlaying = !game.editorPaused;
    this.updateVibeHeroEditorTime(game, now);
    const nextTimeMs = THREE.MathUtils.clamp(
      Math.round((Number(game.currentTimeMs ?? 0) || 0) + (Number(deltaMs) || 0)),
      0,
      game.durationMs
    );
    game.currentTimeMs = nextTimeMs;
    game.remainingMs = Math.max(0, game.durationMs - nextTimeMs);
    game.editorPlaybackBaseMs = nextTimeMs;
    game.editorPlaybackStartedAt = now;
    game.editorLastOverwriteMs = game.editorRecording ? Math.max(0, nextTimeMs - 1) : nextTimeMs;
    game.editorLaneLastRecordMs = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
    game.editorLaneHeld = Array.from({ length: VIBE_HERO_LANE_COUNT }, () => false);
    game.message = `${deltaMs < 0 ? 'Rewind' : 'Fast forward'} to ${formatVibeHeroTimestamp(nextTimeMs)}.`;
    if (wasPlaying) {
      this.scheduleVibeHeroSong(game.song, { offsetMs: nextTimeMs });
    } else {
      this.stopVibeHeroAudio();
    }
    this.syncVibeHeroHud();
    return true;
  }

  getVibeHeroEditorPressedLaneIndexes() {
    const lanes = [];
    VIBE_HERO_LANE_KEY_CODES.forEach((codes, laneIndex) => {
      if (codes.some((code) => this.input.isPressed(code))) {
        lanes.push(laneIndex);
      }
    });
    return lanes;
  }

  overwriteVibeHeroEditorRange(game = this.vibeHero, fromMs = 0, toMs = 0) {
    if (!game?.editorMode) {
      return false;
    }

    const startMs = Math.max(0, Math.min(Number(fromMs) || 0, Number(toMs) || 0));
    const endMs = Math.max(startMs, Math.max(Number(fromMs) || 0, Number(toMs) || 0));
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const nextChart = chart.filter((note) => !(note.timeMs > startMs && note.timeMs <= endMs));
    if (nextChart.length === chart.length) {
      return false;
    }

    this.setVibeHeroEditorChart(game, nextChart, { save: false, message: game.message });
    return true;
  }

  recordVibeHeroEditorPlaybackRange(game = this.vibeHero, fromMs = 0, toMs = 0) {
    if (!game?.editorMode) {
      return false;
    }

    const startMs = Math.max(0, Math.min(Number(fromMs) || 0, Number(toMs) || 0));
    const endMs = Math.max(startMs, Math.max(Number(fromMs) || 0, Number(toMs) || 0));
    if (endMs <= startMs) {
      return false;
    }

    const activeLanes = this.getVibeHeroEditorPressedLaneIndexes();
    const activeLaneSet = new Set(activeLanes);
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const retainedChart = chart.filter((note) => !(note.timeMs > startMs && note.timeMs <= endMs));
    const lastRecordMs = Array.isArray(game.editorLaneLastRecordMs)
      ? [...game.editorLaneLastRecordMs]
      : Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
    const laneHeld = Array.from({ length: VIBE_HERO_LANE_COUNT }, (_, lane) => Boolean(game.editorLaneHeld?.[lane]));
    const stepMs = Math.max(50, Math.min(
      220,
      Number(game.editorRecordStepMs ?? VIBE_HERO_EDITOR_RECORD_STEP_MS) || VIBE_HERO_EDITOR_RECORD_STEP_MS
    ));
    const holdRepeatDelayMs = Math.max(stepMs, Math.min(
      420,
      Number(game.editorHoldRepeatDelayMs ?? VIBE_HERO_EDITOR_HOLD_REPEAT_DELAY_MS) || VIBE_HERO_EDITOR_HOLD_REPEAT_DELAY_MS
    ));
    const recordedNotes = [];

    for (let lane = 0; lane < VIBE_HERO_LANE_COUNT; lane += 1) {
      if (!activeLaneSet.has(lane)) {
        laneHeld[lane] = false;
        continue;
      }

      const previousLaneRecordMs = Number(lastRecordMs[lane]);
      const laneWasHeld = laneHeld[lane] === true;
      let nextTimeMs = startMs;
      if (!laneWasHeld || !Number.isFinite(previousLaneRecordMs)) {
        const recordedAtMs = Math.round(startMs);
        recordedNotes.push(this.createVibeHeroEditorRecordedNote(lane, recordedAtMs, recordedNotes.length));
        lastRecordMs[lane] = recordedAtMs + holdRepeatDelayMs - stepMs;
        nextTimeMs = recordedAtMs + holdRepeatDelayMs;
      } else {
        nextTimeMs = Math.max(previousLaneRecordMs + stepMs, startMs);
      }
      while (nextTimeMs <= endMs + 0.5) {
        const recordedAtMs = Math.round(nextTimeMs);
        recordedNotes.push(this.createVibeHeroEditorRecordedNote(lane, recordedAtMs, recordedNotes.length));
        lastRecordMs[lane] = recordedAtMs;
        nextTimeMs += stepMs;
      }
      laneHeld[lane] = true;
    }

    game.editorLaneLastRecordMs = lastRecordMs;
    game.editorLaneHeld = laneHeld;
    if (recordedNotes.length <= 0 && retainedChart.length === chart.length) {
      return false;
    }

    const laneText = activeLanes.map((lane) => String(lane + 1)).join(' ');
    const recordedKeys = new Set(recordedNotes.map((note) => `${note.lane}:${note.timeMs}`));
    const mergedChart = recordedKeys.size > 0
      ? retainedChart.filter((note) => !recordedKeys.has(`${note.lane}:${note.timeMs}`))
      : retainedChart;
    this.setVibeHeroEditorChart(game, [...mergedChart, ...recordedNotes], {
      save: false,
      message: recordedNotes.length > 0
        ? `Recording ${laneText} at ${formatVibeHeroTimestamp(endMs)}.`
        : game.message
    });

    if (activeLanes.length > 0) {
      const now = performance.now();
      game.laneFlashes = [
        ...(game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS),
        ...activeLanes.map((lane) => ({
          lane,
          at: now,
          quality: 'hit'
        }))
      ];
    }
    return true;
  }

  setVibeHeroEditorChart(game = this.vibeHero, chart = [], { save = false, message = '' } = {}) {
    if (!game?.editorMode) {
      return false;
    }

    const normalizedChart = this.serializeVibeHeroEditorChart(chart);
    game.editorChart = normalizedChart.map((note) => ({ ...note }));
    game.notes = normalizedChart.map((note, index) => this.createVibeHeroNoteState(note, index));
    game.song = game.song
      ? {
          ...game.song,
          chart: normalizedChart.map((note) => ({ ...note }))
        }
      : game.song;
    game.songs = (game.songs ?? []).map((song) => song.id === game.selectedSongId
      ? {
          ...song,
          noteCount: normalizedChart.length,
          chartEdited: true
        }
      : song);
    game.editorDirty = true;
    if (message) {
      game.message = message;
    }
    if (save) {
      this.saveVibeHeroEditorChart(game);
    }
    return true;
  }

  getVibeHeroEditorReferenceNote(laneIndex = 0, timeMs = 0) {
    const game = this.vibeHero;
    const sourceChart = Array.isArray(game?.sourceChart) ? game.sourceChart : [];
    let bestNote = null;
    let bestDistance = Infinity;
    for (const note of sourceChart) {
      if (note.lane !== laneIndex) {
        continue;
      }
      const distance = Math.abs((Number(note.timeMs) || 0) - timeMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNote = note;
      }
    }
    return bestDistance <= 420 ? bestNote : null;
  }

  createVibeHeroEditorRecordedNote(laneIndex = 0, timeMs = 0, sequence = 0) {
    const lane = THREE.MathUtils.clamp(
      Math.trunc(Number(laneIndex) || 0),
      0,
      VIBE_HERO_LANE_COUNT - 1
    );
    const recordedAtMs = THREE.MathUtils.clamp(
      Math.round(Number(timeMs) || 0),
      0,
      Math.max(0, Number(this.vibeHero?.durationMs ?? 0) || 0)
    );
    const referenceNote = this.getVibeHeroEditorReferenceNote(lane, recordedAtMs);
    const pitch = referenceNote?.pitch ?? VIBE_HERO_EDITOR_LANE_PITCHES[lane] ?? 'A4';
    const frequency = referenceNote?.frequency ?? VIBE_HERO_EDITOR_LANE_FREQUENCIES[lane] ?? 440;
    return {
      id: `editor-${this.vibeHero?.selectedSongId ?? 'song'}-${recordedAtMs}-${lane}-${sequence}`,
      timeMs: recordedAtMs,
      durationMs: referenceNote?.durationMs ?? VIBE_HERO_EDITOR_NOTE_DURATION_MS,
      lane,
      pitch,
      frequency
    };
  }

  previewVibeHeroEditorLane(laneIndex = 0) {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const lane = THREE.MathUtils.clamp(Math.trunc(Number(laneIndex) || 0), 0, VIBE_HERO_LANE_COUNT - 1);
    const now = performance.now();
    const frequency = VIBE_HERO_EDITOR_LANE_FREQUENCIES[lane] ?? 440;
    game.laneFlashes = [
      ...(game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS),
      {
        lane,
        at: now,
        quality: game.editorRecording ? 'hit' : 'empty'
      }
    ];
    this.playVibeHeroFeedbackTone(frequency, game.editorRecording ? 'great' : 'good');
    this.syncVibeHeroHud();
    return true;
  }

  recordVibeHeroEditorLanes(laneIndexes = []) {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const lanes = [...new Set(laneIndexes
      .map((laneIndex) => Math.trunc(Number(laneIndex)))
      .filter((laneIndex) => Number.isInteger(laneIndex) && laneIndex >= 0 && laneIndex < VIBE_HERO_LANE_COUNT))];
    if (lanes.length <= 0) {
      return false;
    }

    if (!game.editorRecording) {
      lanes.forEach((laneIndex) => this.previewVibeHeroEditorLane(laneIndex));
      game.message = 'Recording is off.';
      return true;
    }

    this.updateVibeHeroEditorTime(game);
    const currentTimeMs = Math.round(Number(game.currentTimeMs ?? 0) || 0);
    const windowMs = Math.max(20, Number(game.editorRecordWindowMs ?? VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS) || VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS);
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const retainedChart = chart.filter((note) => Math.abs(note.timeMs - currentTimeMs) > windowMs);
    const recordedNotes = lanes.map((laneIndex, index) => this.createVibeHeroEditorRecordedNote(laneIndex, currentTimeMs, index));
    this.setVibeHeroEditorChart(game, [...retainedChart, ...recordedNotes], {
      save: true,
      message: `${recordedNotes.length} note${recordedNotes.length === 1 ? '' : 's'} recorded at ${formatVibeHeroTimestamp(currentTimeMs)}.`
    });
    game.editorLastOverwriteMs = currentTimeMs;
    const lastRecordMs = Array.isArray(game.editorLaneLastRecordMs)
      ? [...game.editorLaneLastRecordMs]
      : Array.from({ length: VIBE_HERO_LANE_COUNT }, () => -Infinity);
    for (const lane of lanes) {
      lastRecordMs[lane] = currentTimeMs;
    }
    game.editorLaneLastRecordMs = lastRecordMs;
    const now = performance.now();
    game.laneFlashes = [
      ...(game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS),
      ...lanes.map((lane) => ({
        lane,
        at: now,
        quality: 'hit'
      }))
    ];
    for (const note of recordedNotes) {
      this.playVibeHeroFeedbackTone(note.frequency, 'perfect');
    }
    this.syncVibeHeroHud();
    return true;
  }

  handleVibeHeroKeyboardInput() {
    if (!this.vibeHero || !this.hud.isVibeHeroOpen()) {
      return false;
    }

    let handled = false;
    if (this.vibeHero.phase === 'editor') {
      if (this.input.consume('KeyR')) {
        handled = this.toggleVibeHeroEditorRecording() || handled;
      }
      if (this.input.consume('KeyN')) {
        handled = this.seekVibeHeroEditor(-VIBE_HERO_EDITOR_SEEK_MS) || handled;
      }
      if (this.input.consume('KeyM')) {
        handled = this.seekVibeHeroEditor(VIBE_HERO_EDITOR_SEEK_MS) || handled;
      }
      if (this.input.consume('Space')) {
        handled = this.toggleVibeHeroEditorPlayback() || handled;
      }
    }

    const editorLaneIndexes = [];
    VIBE_HERO_LANE_KEY_CODES.forEach((codes, laneIndex) => {
      if (codes.some((code) => this.input.consume(code))) {
        if (this.vibeHero.phase === 'editor') {
          editorLaneIndexes.push(laneIndex);
        } else {
          handled = this.hitVibeHeroLane(laneIndex) || handled;
        }
      }
    });
    if (editorLaneIndexes.length > 0) {
      if (this.vibeHero.phase === 'editor' && this.vibeHero.editorRecording && !this.vibeHero.editorPaused) {
        editorLaneIndexes.forEach((laneIndex) => this.previewVibeHeroEditorLane(laneIndex));
        handled = true;
      } else {
        handled = this.recordVibeHeroEditorLanes(editorLaneIndexes) || handled;
      }
    }

    if (
      (
        this.vibeHero.phase === 'select'
        || this.vibeHero.phase === 'editor-select'
        || this.vibeHero.phase === 'complete'
      )
      && this.input.consume('Space')
    ) {
      handled = this.startVibeHeroCountdown() || handled;
    }

    return handled;
  }

  updateVibeHeroMisses(game = this.vibeHero) {
    if (!game || game.phase !== 'playing') {
      return;
    }

    let missed = 0;
    for (const note of game.notes) {
      if (note.status !== 'pending') {
        continue;
      }
      if (game.currentTimeMs - note.timeMs <= VIBE_HERO_HIT_WINDOW_MS) {
        continue;
      }
      note.status = 'missed';
      game.misses += 1;
      missed += 1;
    }

    if (missed > 0) {
      game.combo = 0;
      game.message = missed === 1 ? 'Miss' : `${missed} missed notes`;
    }
  }

  hitVibeHeroLane(laneIndex = 0) {
    const game = this.vibeHero;
    const normalizedLane = Math.trunc(Number(laneIndex));
    if (
      !game
      || game.phase !== 'playing'
      || normalizedLane < 0
      || normalizedLane >= VIBE_HERO_LANE_COUNT
    ) {
      return false;
    }

    const candidates = game.notes
      .filter((note) => note.status === 'pending' && note.lane === normalizedLane)
      .map((note) => ({
        note,
        errorMs: Math.abs(game.currentTimeMs - note.timeMs)
      }))
      .filter((entry) => entry.errorMs <= VIBE_HERO_HIT_WINDOW_MS)
      .sort((a, b) => a.errorMs - b.errorMs);
    const match = candidates[0] ?? null;
    const now = performance.now();

    game.laneFlashes = [
      ...(game.laneFlashes ?? []).filter((flash) => now - flash.at < VIBE_HERO_LANE_FLASH_MS),
      {
        lane: normalizedLane,
        at: now,
        quality: match ? 'hit' : 'empty'
      }
    ];

    if (!match) {
      game.message = 'Too early';
      this.syncVibeHeroHud();
      return false;
    }

    const { note, errorMs } = match;
    const quality = errorMs <= VIBE_HERO_PERFECT_WINDOW_MS
      ? 'perfect'
      : errorMs <= VIBE_HERO_GREAT_WINDOW_MS
        ? 'great'
        : 'good';
    const baseScore = quality === 'perfect' ? 1000 : quality === 'great' ? 700 : 450;
    const nextCombo = game.combo + 1;
    note.status = 'hit';
    note.hitErrorMs = Math.round(game.currentTimeMs - note.timeMs);
    note.hitQuality = quality;
    game.combo = nextCombo;
    game.maxCombo = Math.max(game.maxCombo, nextCombo);
    game.streak = nextCombo;
    game.hits += 1;
    game.score += baseScore + Math.min(250, nextCombo * 12);
    game.message = `${quality.toUpperCase()} x${nextCombo}`;
    this.playVibeHeroFeedbackTone(note.frequency, quality);
    this.syncVibeHeroHud();
    return true;
  }

  getVibeHeroAccuracy(game = this.vibeHero) {
    const totalResolved = Math.max(0, Number(game?.hits ?? 0) + Number(game?.misses ?? 0));
    if (totalResolved <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, Number(game?.hits ?? 0) / totalResolved));
  }

  async claimVibeHeroCharismaReward(game = this.vibeHero, accuracy = this.getVibeHeroAccuracy(game)) {
    if (
      !game
      || game.charismaRewardClaimed === true
      || typeof this.npcService?.completeVibeHero !== 'function'
    ) {
      return false;
    }

    game.charismaRewardClaimed = true;
    game.charismaRewardPending = true;
    this.syncVibeHeroHud();

    try {
      const result = await this.npcService.completeVibeHero(
        game.selectedSongId ?? game.song?.id ?? '',
        {
          score: game.score,
          accuracy,
          hits: game.hits,
          misses: game.misses
        }
      );
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'Vibe Hero reward failed.');
        return false;
      }

      const xp = Math.max(0, Math.floor(Number(result.xp ?? CHARISMA_VIBE_HERO_XP) || 0));
      const rewardText = xp > 0 ? `+${xp} Charisma XP` : 'Charisma gained';
      if (this.vibeHero === game) {
        game.resultDetail = game.resultDetail.includes('Charisma XP')
          ? game.resultDetail
          : `${game.resultDetail} | ${rewardText}`;
        game.message = game.resultDetail;
      }
      this.hud.showToast(rewardText);

      const award = result.skillAward;
      if (award?.seq && award.seq > this.lastSkillAwardSeq) {
        this.lastSkillAwardSeq = award.seq;
        const skill = SKILL_DEFINITIONS.find((entry) => entry.id === award.skillId) ?? {
          id: award.skillId,
          label: award.label,
          icon: award.icon,
          accent: award.accent
        };
        this.phoneSkillsState = {
          ...this.phoneSkillsState,
          recentAward: {
            ...award,
            skill
          }
        };
        this.presentSkillAwardFeedback(award, skill);
        this.refreshPhoneSkillsHud();
      }
      return true;
    } catch (error) {
      console.warn('[VibeHero] Reward failed.', error);
      this.hud.showToast('Vibe Hero reward failed.');
      return false;
    } finally {
      if (this.vibeHero === game) {
        game.charismaRewardPending = false;
        this.syncVibeHeroHud();
      }
    }
  }

  finishVibeHero() {
    const game = this.vibeHero;
    if (!game || game.phase === 'complete') {
      return false;
    }

    this.updateVibeHeroMisses(game);
    const accuracy = this.getVibeHeroAccuracy(game);
    game.phase = 'complete';
    game.currentTimeMs = game.durationMs;
    game.remainingMs = 0;
    this.stopVibeHeroAudio();
    game.resultTitle = accuracy >= 0.9
      ? 'Encore'
      : accuracy >= 0.72
        ? 'Set Complete'
        : 'Keep Practicing';
    game.resultDetail = `${game.hits}/${game.notes.length} notes - ${Math.round(accuracy * 100)}% accuracy - max combo ${game.maxCombo}`;
    game.message = game.resultDetail;
    if (accuracy >= 0.72) {
      this.playTaskCompleteSound();
    } else {
      this.playSoundEffect(this.playingCardSound);
    }
    void this.claimVibeHeroCharismaReward(game, accuracy);
    this.syncVibeHeroHud();
    return true;
  }

  getVibeHeroAudioContext() {
    if (this.vibeHeroAudioContext) {
      return this.vibeHeroAudioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    this.vibeHeroAudioContext = new AudioContextClass();
    return this.vibeHeroAudioContext;
  }

  stopVibeHeroAudio() {
    if (this.vibeHeroAudioElement) {
      try {
        this.vibeHeroAudioElement.pause();
        this.vibeHeroAudioElement.currentTime = 0;
      } catch {
        // Already stopped.
      }
      this.vibeHeroAudioElement = null;
    }
    for (const node of this.vibeHeroAudioNodes) {
      try {
        node.stop(0);
      } catch {
        // Already stopped.
      }
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    this.vibeHeroAudioNodes = [];
    if (this.vibeHeroAudioMaster) {
      try {
        this.vibeHeroAudioMaster.disconnect();
      } catch {
        // Already disconnected.
      }
      this.vibeHeroAudioMaster = null;
    }
  }

  getVibeHeroMusicVolume(game = this.vibeHero) {
    const masterVolume = Number(this.gameSettings?.masterVolume ?? 1);
    const baseVolume = THREE.MathUtils.clamp(0.68 * masterVolume, 0, 0.86);
    const durationMs = Math.max(1, Number(game?.durationMs ?? 0) || 0);
    const currentTimeMs = Math.max(0, Number(game?.currentTimeMs ?? 0) || 0);
    const remainingMs = Math.max(0, durationMs - currentTimeMs);
    const fadeMultiplier = remainingMs < 2200 ? THREE.MathUtils.clamp(remainingMs / 2200, 0.04, 1) : 1;
    return THREE.MathUtils.clamp(baseVolume * fadeMultiplier, 0, 0.86);
  }

  updateVibeHeroAudioFade(game = this.vibeHero) {
    if (
      !this.vibeHeroAudioElement
      || !game
      || (
        game.phase !== 'playing'
        && !(game.phase === 'editor' && game.editorPaused !== true)
      )
    ) {
      return;
    }
    this.vibeHeroAudioElement.volume = this.getVibeHeroMusicVolume(game);
  }

  playVibeHeroSongAudio(song = null, { offsetMs = 0 } = {}) {
    const audioUrl = String(song?.audioUrl ?? '').trim();
    if (!audioUrl) {
      return false;
    }

    this.stopVibeHeroAudio();
    const audio = this.vibeHeroAudioPreloads.get(audioUrl) ?? new Audio(audioUrl);
    this.vibeHeroAudioPreloads.delete(audioUrl);
    audio.preload = 'auto';
    audio.volume = this.getVibeHeroMusicVolume(this.vibeHero);
    audio.currentTime = (
      Math.max(0, Number(song?.snippetStartMs ?? 0) || 0)
      + Math.max(0, Number(offsetMs) || 0)
    ) / 1000;
    this.vibeHeroAudioElement = audio;
    void audio.play().catch((error) => {
      console.warn('[VibeHero] MP3 playback failed; using fallback synth chart.', error);
      if (this.vibeHeroAudioElement === audio) {
        this.vibeHeroAudioElement = null;
      }
      this.scheduleVibeHeroSynthSong(song, { offsetMs });
    });
    return true;
  }

  scheduleVibeHeroSong(song = null, { offsetMs = 0 } = {}) {
    if (this.playVibeHeroSongAudio(song, { offsetMs })) {
      return true;
    }
    return this.scheduleVibeHeroSynthSong(song, { offsetMs });
  }

  scheduleVibeHeroSynthSong(song = null, { offsetMs = 0 } = {}) {
    const context = this.getVibeHeroAudioContext();
    if (!context || !song?.chart?.length) {
      return false;
    }

    void context.resume?.().catch(() => {});
    this.stopVibeHeroAudio();
    const master = context.createGain();
    master.gain.value = THREE.MathUtils.clamp(0.16 * Number(this.gameSettings?.masterVolume ?? 1), 0, 0.26);
    master.connect(context.destination);
    this.vibeHeroAudioMaster = master;
    const startAt = context.currentTime + 0.055;
    const safeOffsetMs = Math.max(0, Number(offsetMs) || 0);
    for (const [index, note] of song.chart.entries()) {
      const offsetNoteTimeMs = Math.max(0, Number(note.timeMs) || 0) - safeOffsetMs;
      if (offsetNoteTimeMs < -VIBE_HERO_HIT_WINDOW_MS) {
        continue;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + (Math.max(0, offsetNoteTimeMs) / 1000);
      const noteDuration = Math.max(0.12, Math.min(0.72, Number(note.durationMs ?? 320) / 1000));
      oscillator.type = index % 3 === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(Math.max(80, Number(note.frequency ?? 261.63) || 261.63), noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.78, noteStart + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteDuration + 0.04);
      this.vibeHeroAudioNodes.push(oscillator);
    }
    return true;
  }

  playVibeHeroFeedbackTone(frequency = 440, quality = 'good') {
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      return;
    }

    void context.resume?.().catch(() => {});
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = quality === 'perfect' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(Math.max(80, Number(frequency) || 440) * 2, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(THREE.MathUtils.clamp(0.045 * Number(this.gameSettings?.masterVolume ?? 1), 0.0001, 0.08), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  async startBlackjackRound() {
    if (this.blackjackPreviewMode) {
      this.startBlackjackPreviewRound();
      return;
    }

    if (!this.blackjackNpcId || this.blackjackRequestInFlight) {
      return;
    }

    this.blackjackRequestInFlight = true;
    this.syncBlackjackHud({ loading: true, error: '' });
    let syncedResult = false;
    try {
      const result = await this.npcService?.startBlackjack?.(this.blackjackNpcId, this.blackjackWager);
      if (!result?.ok || !result.blackjack) {
        const error = result?.error ?? 'Blackjack table is unavailable.';
        this.syncBlackjackHud({ loading: false, error });
        this.hud.showToast(error);
        return;
      }

      this.blackjackState = result.blackjack;
      this.blackjackRequestInFlight = false;
      this.syncBlackjackHud({ loading: false, error: '' });
      syncedResult = true;
      this.playBlackjackCardSound();
      this.playBlackjackWinSound(result.blackjack);
    } catch (error) {
      console.warn('[Blackjack] Deal failed.', error);
      this.syncBlackjackHud({ loading: false, error: 'Blackjack request failed.' });
      this.hud.showToast('Blackjack request failed.');
    } finally {
      if (!syncedResult) {
        this.blackjackRequestInFlight = false;
        this.syncBlackjackHud();
      }
    }
  }

  async handleBlackjackAction(action = '') {
    if (this.blackjackPreviewMode) {
      this.handleBlackjackPreviewAction(action);
      return;
    }

    if (!this.blackjackNpcId || this.blackjackRequestInFlight) {
      return;
    }

    const methodByAction = {
      hit: 'hitBlackjack',
      stand: 'standBlackjack',
      double: 'doubleBlackjack',
      split: 'splitBlackjack'
    };
    const methodName = methodByAction[action];
    if (!methodName || typeof this.npcService?.[methodName] !== 'function') {
      return;
    }

    this.blackjackRequestInFlight = true;
    this.syncBlackjackHud({ loading: true, error: '' });
    let syncedResult = false;
    try {
      const result = await this.npcService[methodName](this.blackjackNpcId);
      if (!result?.ok || !result.blackjack) {
        const error = result?.error ?? 'That blackjack move was rejected.';
        this.syncBlackjackHud({ loading: false, error });
        this.hud.showToast(error);
        return;
      }

      this.blackjackState = result.blackjack;
      this.blackjackRequestInFlight = false;
      this.syncBlackjackHud({ loading: false, error: '' });
      syncedResult = true;
      this.playBlackjackCardSound();
      this.playBlackjackWinSound(result.blackjack);
    } catch (error) {
      console.warn('[Blackjack] Action failed.', error);
      this.syncBlackjackHud({ loading: false, error: 'Blackjack request failed.' });
      this.hud.showToast('Blackjack request failed.');
    } finally {
      if (!syncedResult) {
        this.blackjackRequestInFlight = false;
        this.syncBlackjackHud();
      }
    }
  }

  chooseSchoolMicrogameId(requestedId = SCHOOL_MICROGAME_ALL_ID) {
    const normalizedId = normalizeSchoolMicrogameId(requestedId, SCHOOL_MICROGAME_ALL_ID);
    if (normalizedId !== SCHOOL_MICROGAME_ALL_ID) {
      return normalizedId;
    }

    const games = listSchoolMicrogames();
    if (!games.length) {
      return SCHOOL_MICROGAME_DEFAULT_ID;
    }

    const index = Math.floor(Math.random() * games.length);
    return games[index]?.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
  }

  chooseRandomSchoolSessionGameId(previousId = '', preferredId = SCHOOL_MICROGAME_ALL_ID) {
    const preferred = normalizeSchoolMicrogameId(preferredId, SCHOOL_MICROGAME_ALL_ID);
    if (preferred !== SCHOOL_MICROGAME_ALL_ID && getSchoolMicrogameDefinition(preferred)) {
      return preferred;
    }

    const games = listSchoolMicrogames();
    if (!games.length) {
      return SCHOOL_MICROGAME_DEFAULT_ID;
    }

    const previous = normalizeSchoolMicrogameId(previousId, '');
    const choices = games.length > 1
      ? games.filter((game) => game.id !== previous)
      : games;
    const index = Math.floor(this.schoolRandom() * choices.length);
    return choices[index]?.id ?? games[0]?.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
  }

  isOfficeJobComputerInteractable(interactable = null) {
    return String(interactable?.itemId ?? '').trim() === OFFICE_JOB_TERMINAL_ITEM_ID;
  }

  isOfficeInteriorJobStationInteractable(interactable = null) {
    return interactable?.kind === 'office-job-station'
      && Boolean(getOfficeJobDefinition(interactable?.officeJobId));
  }

  isOfficeInteriorTransportInteractable(interactable = null) {
    return interactable?.kind === 'office-floor-transition'
      && interactable?.targetPosition?.isVector3;
  }

  openOfficeInteriorJobStation(interaction = null) {
    const job = getOfficeJobDefinition(interaction?.officeJobId);
    if (!job) {
      this.hud.showToast('That office job is not available.');
      return false;
    }

    this.closePhoneMenu();
    this.officeJobPlacementId = String(interaction?.placementId ?? '').trim();
    this.schoolMicrogameNpcId = '';
    this.schoolMicrogameNpcName = interaction?.label ?? job.roleLabel ?? 'Office Station';
    this.schoolMicrogameNpcModelId = 'martha';
    this.schoolMicrogamePreviewMode = false;
    return this.prepareOfficeJobMicrogame(job.id, { visible: true });
  }

  useOfficeInteriorTransport(interaction = null) {
    if (!this.player || !interaction?.targetPosition?.isVector3) {
      return false;
    }

    this.finishWorkout({ cancelled: true });
    this.player.position.copy(interaction.targetPosition);
    this.player.position.y = this.getActiveGroundHeightAt(this.player.position);
    this.activeInlineShell?.scene?.setActiveFloorForWorldPosition?.(this.player.position);
    this.resetLocalPlayerKinematics(this.player.position);
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    this.hud.showToast(interaction.actionText ?? 'Changed floors.');
    this.updateCamera(this.currentAimDirection, this.currentAimMode, { snap: true });
    return true;
  }

  isOfficeJobGame(game = this.schoolMicrogame) {
    return game?.context === 'office-job' || game?.round?.domain === 'office-job';
  }

  getOfficeJobIntelligence() {
    return getPlayerSkillXp(this.getLocalPlayerState(), SKILL_IDS.intelligence);
  }

  getOfficeJobCharismaLevel() {
    return getSkillLevelFromXp(getPlayerSkillXp(this.getLocalPlayerState(), SKILL_IDS.charisma));
  }

  getOfficeJobStrengthLevel() {
    return getSkillLevelFromXp(getPlayerSkillXp(this.getLocalPlayerState(), SKILL_IDS.strength));
  }

  getOfficeJobMenuJobs() {
    const intelligence = this.getOfficeJobIntelligence();
    const charismaLevel = this.getOfficeJobCharismaLevel();
    const strengthLevel = this.getOfficeJobStrengthLevel();
    return listOfficeJobDefinitions().map((job) => ({
      ...job,
      unlocked: canPlayerWorkOfficeJob(intelligence, job, charismaLevel, strengthLevel)
    }));
  }

  createOfficeJobMenuState() {
    return {
      id: `office_jobs_${++this.schoolMicrogameSequence}`,
      context: 'office-job',
      phase: 'menu',
      round: {
        gameId: 'office-job-menu',
        title: 'Office Computer',
        eyebrow: 'Work Terminal',
        description: 'Choose a job tier and complete the task with no mistakes.',
        accent: '#8cd6ff',
        secondaryAccent: '#73f2d0',
        icon: 'JOB',
        rewardMoney: 0,
        rewardXp: 0
      },
      data: {
        intelligence: this.getOfficeJobIntelligence(),
        charismaLevel: this.getOfficeJobCharismaLevel(),
        strengthLevel: this.getOfficeJobStrengthLevel(),
        jobs: this.getOfficeJobMenuJobs()
      },
      remainingMs: 0,
      message: 'Choose work as Janitor, Office Manager, or CEO.',
      resultTitle: '',
      resultDetail: '',
      preview: false
    };
  }

  openOfficeJobMenu(interaction = null) {
    this.closePhoneMenu();
    const placementId = String(interaction?.placementId ?? this.officeJobPlacementId ?? '').trim();
    this.officeJobPlacementId = placementId;
    this.schoolMicrogameSessionActive = false;
    this.schoolMicrogameNpcId = '';
    this.schoolMicrogameNpcName = 'Office Computer';
    this.schoolMicrogameNpcModelId = 'martha';
    this.schoolMicrogamePreviewMode = false;
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameRequestInFlight = false;
    this.schoolMicrogame = this.createOfficeJobMenuState();
    this.hud.hideLoading();
    this.hud.setSchoolMicrogameState({
      visible: true,
      game: this.schoolMicrogame,
      loading: false,
      error: ''
    });
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
  }

  getOfficeJanitorGameCycle() {
    return OFFICE_JANITOR_GAME_IDS.length
      ? OFFICE_JANITOR_GAME_IDS
      : [
        OFFICE_JOB_GAME_IDS.janitorTrashToss,
        OFFICE_JOB_GAME_IDS.janitorMopHero
      ];
  }

  getNextOfficeJanitorGameId() {
    const games = this.getOfficeJanitorGameCycle();
    const index = Math.max(0, Math.floor(Number(this.officeJanitorGameCycleIndex ?? 0) || 0)) % games.length;
    return games[index] ?? OFFICE_JOB_GAME_IDS.janitorTrashToss;
  }

  advanceOfficeJanitorGameCycle(game = this.schoolMicrogame) {
    if (!this.isOfficeJobGame(game) || game?.round?.officeJobId !== OFFICE_JOB_IDS.janitor) {
      return;
    }
    if (game.data?.officeJanitorCycleConsumed) {
      return;
    }

    const games = this.getOfficeJanitorGameCycle();
    const gameId = String(game.round?.gameId ?? '');
    const currentIndex = games.indexOf(gameId);
    const normalizedIndex = currentIndex >= 0
      ? currentIndex
      : Math.max(0, Math.floor(Number(this.officeJanitorGameCycleIndex ?? 0) || 0)) % games.length;
    this.officeJanitorGameCycleIndex = (normalizedIndex + 1) % games.length;
    game.data = {
      ...(game.data ?? {}),
      officeJanitorCycleConsumed: true
    };
  }

  isOfficeJanitorTrashTossGame(game = this.schoolMicrogame) {
    return this.isOfficeJobGame(game)
      && game?.round?.officeJobId === OFFICE_JOB_IDS.janitor
      && game?.round?.gameId !== OFFICE_JOB_GAME_IDS.janitorMopHero;
  }

  isOfficeJanitorMopHeroGame(game = this.schoolMicrogame) {
    return this.isOfficeJobGame(game)
      && game?.round?.officeJobId === OFFICE_JOB_IDS.janitor
      && game?.round?.gameId === OFFICE_JOB_GAME_IDS.janitorMopHero;
  }

  applyJanitorTrashTossRoundDetails(round = {}) {
    round.gameId = OFFICE_JOB_GAME_IDS.janitorTrashToss;
    round.shortTitle = 'Paper Toss';
    round.title = 'Work as Janitor: Paper Toss';
    round.subtitle = 'Sink three paper toss rounds from the janitor closet.';
    round.description = 'Paper toss three crumpled reports into the basket from the office thrower\'s janitor closet.';
    round.prompt = 'Land three clean throws. Watch the arc settle on the basket before tossing.';
    round.instructions = 'Press Spacebar or click Throw when the marker is inside the target zone and the arc lines up with the basket.';
    round.durationMs = 14000;
    round.icon = 'TRASH';
  }

  configureJanitorTrashTossShot(round = {}, data = {}, shotNumber = 1) {
    const currentShot = Math.max(1, Math.floor(Number(shotNumber ?? 1) || 1));
    const difficulty = Math.max(0, Math.min(2, currentShot - 1));
    const wind = (this.schoolRandom() - 0.5) * (0.26 + difficulty * 0.07);
    const targetWidth = Math.max(OFFICE_JANITOR_MIN_TARGET_WIDTH, OFFICE_JANITOR_BASE_TARGET_WIDTH - difficulty * OFFICE_JANITOR_TARGET_WIDTH_STEP);
    const targetStart = 0.39 + this.schoolRandom() * 0.22 - wind * 0.26;
    round.targetStart = THREE.MathUtils.clamp(targetStart, 0.12, 0.88 - targetWidth);
    round.targetEnd = round.targetStart + targetWidth;
    round.wind = wind;
    data.marker = this.schoolRandom() * 0.22;
    data.direction = this.schoolRandom() > 0.5 ? -1 : 1;
    data.speed = OFFICE_JANITOR_BASE_MARKER_SPEED + difficulty * OFFICE_JANITOR_MARKER_SPEED_STEP + this.schoolRandom() * 0.26;
    data.shotNumber = currentShot;
    data.thrown = false;
    data.throwMade = false;
    data.throwResolveAt = 0;
    data.throwMissSide = '';
  }

  createJanitorMopDirtPatches() {
    return OFFICE_JANITOR_MOP_DIRT_PATCHES.map((patch, index) => {
      const jitterX = (this.schoolRandom() - 0.5) * 0.035;
      const jitterY = (this.schoolRandom() - 0.5) * 0.035;
      const jitterSize = (this.schoolRandom() - 0.5) * 0.025;
      return {
        id: `mop-dirt-${index + 1}`,
        x: THREE.MathUtils.clamp(Number(patch.x ?? 0.5) + jitterX, 0.08, 0.92),
        y: THREE.MathUtils.clamp(Number(patch.y ?? 0.5) + jitterY, 0.2, 0.88),
        size: THREE.MathUtils.clamp(Number(patch.size ?? 0.14) + jitterSize, 0.1, 0.23),
        rotation: Number(patch.rotation ?? 0) + Math.round((this.schoolRandom() - 0.5) * 18),
        clean: 0
      };
    });
  }

  configureJanitorMopHero(round = {}, data = {}) {
    round.gameId = OFFICE_JOB_GAME_IDS.janitorMopHero;
    round.shortTitle = 'Mop Hero';
    round.title = 'Work as Janitor: Mop Hero';
    round.subtitle = 'Mop every dirt patch from the office floor.';
    round.description = 'Mop Hero: clean an office room covered in brown dirt until the floor sparkles.';
    round.prompt = 'Move the mouse like a mop. Clean every brown dirt patch before time runs out.';
    round.instructions = 'Move your mouse over the brown dirt. The janitor and mop follow the cursor as each patch gets scrubbed clean.';
    round.durationMs = OFFICE_JANITOR_MOP_HERO_DURATION_MS;
    round.icon = 'MOP';
    data.dirtPatches = this.createJanitorMopDirtPatches();
    data.cleanProgress = 0;
    data.mopX = 0.5;
    data.mopY = 0.66;
    data.mopActive = false;
    data.mopMoved = false;
    data.sparklyClean = false;
    data.mopCleanShowcaseAt = 0;
    data.dirtSeq = Math.max(0, Math.floor(Number(data.dirtSeq ?? 0) || 0)) + 1;
  }

  configureCeoMemoStamp(round = {}, data = {}, approvedCount = 0) {
    const targetWidth = OFFICE_CEO_TARGET_MIN_WIDTH + this.schoolRandom() * OFFICE_CEO_TARGET_WIDTH_VARIANCE;
    const maxTargetStart = 0.92 - targetWidth;
    round.targetStart = 0.08 + this.schoolRandom() * Math.max(0.01, maxTargetStart - 0.08);
    round.targetEnd = round.targetStart + targetWidth;
    data.memoPosition = OFFICE_CEO_STAMP_LEFT_EXIT;
    data.memoDirection = 1;
    data.memoTurned = false;
    data.memoSpeed = 0.66 + this.schoolRandom() * 0.22 + Math.max(0, Number(approvedCount ?? 0) || 0) * 0.04;
  }

  startOfficeJobCountdown(game = this.schoolMicrogame) {
    if (!this.isOfficeJobGame(game) || game.phase !== 'ready') {
      this.beginSchoolMicrogame();
      return;
    }

    const now = performance.now();
    game.phase = 'countdown';
    game.data = {
      ...(game.data ?? {}),
      countdownStartedAt: now,
      countdownEndsAt: now + OFFICE_JOB_COUNTDOWN_MS,
      countdownMs: OFFICE_JOB_COUNTDOWN_MS,
      countdownGoMs: OFFICE_JOB_COUNTDOWN_GO_MS,
      countdownStepMs: Math.max(1, (OFFICE_JOB_COUNTDOWN_MS - OFFICE_JOB_COUNTDOWN_GO_MS) / 3),
      roundNumber: 1,
      sessionXpEarned: 0
    };
    game.remainingMs = OFFICE_JOB_COUNTDOWN_MS;
    game.message = '3..2..1.. GO!';
    game.resultTitle = '';
    game.resultDetail = '';
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameLastTickAt = now;
    this.playSoundEffect(this.phoneUnlockSound);
    this.syncSchoolMicrogameHud();
  }

  createOfficeJobRound(jobId = OFFICE_JOB_IDS.janitor) {
    const job = getOfficeJobDefinition(jobId) ?? getOfficeJobDefinition(OFFICE_JOB_IDS.janitor);
    const round = {
      ...job,
      domain: 'office-job',
      jobId: job.id,
      officeJobId: job.id,
      gameId: job.gameId,
      title: `Work as ${job.roleLabel}`,
      shortTitle: job.shortTitle,
      eyebrow: job.eyebrow ?? 'Office Job',
      description: job.description,
      prompt: job.prompt,
      instructions: job.instructions,
      durationMs: job.durationMs ?? (job.id === OFFICE_JOB_IDS.ceo ? 14000 : 7000),
      rewardMoney: job.rewardMoney,
      rewardXp: job.rewardXp,
      intelligenceRequired: job.intelligenceRequired,
      charismaLevelRequired: job.charismaLevelRequired,
      strengthLevelRequired: job.strengthLevelRequired,
      accent: job.accent,
      secondaryAccent: job.secondaryAccent,
      icon: job.icon
    };
    const data = {
      keyboardHolding: false
    };

    if (job.id === OFFICE_JOB_IDS.janitor) {
      const janitorGameId = this.getNextOfficeJanitorGameId();
      data.officeJanitorCycleConsumed = false;
      if (janitorGameId === OFFICE_JOB_GAME_IDS.janitorMopHero) {
        this.configureJanitorMopHero(round, data);
      } else {
        this.applyJanitorTrashTossRoundDetails(round);
        round.requiredThrows = OFFICE_JANITOR_REQUIRED_THROWS;
        data.requiredThrows = OFFICE_JANITOR_REQUIRED_THROWS;
        data.madeThrows = 0;
        data.throwSeq = 0;
        this.configureJanitorTrashTossShot(round, data, 1);
      }
    } else if (job.id === OFFICE_JOB_IDS.officeManager) {
      round.targetStart = 72;
      round.targetEnd = 82;
      data.fill = 0;
      data.fillSpeed = 32;
      data.released = false;
      data.brewing = false;
    } else if (job.id === OFFICE_JOB_IDS.ceo) {
      round.requiredApprovals = 3;
      this.configureCeoMemoStamp(round, data, 0);
      data.approved = 0;
      data.requiredApprovals = round.requiredApprovals;
      data.memoLabel = this.schoolPick(OFFICE_CEO_MEMOS);
      data.stamped = false;
      data.stampSuccess = false;
      data.stampResolveAt = 0;
      data.stampSeq = 0;
      data.stampMissSide = '';
    }

    return { round, data };
  }

  prepareOfficeJobMicrogame(jobId = OFFICE_JOB_IDS.janitor, { visible = true } = {}) {
    const job = getOfficeJobDefinition(jobId);
    if (!job) {
      this.hud.showToast('That office job is not available.');
      return false;
    }

    const intelligence = this.getOfficeJobIntelligence();
    const charismaLevel = this.getOfficeJobCharismaLevel();
    const strengthLevel = this.getOfficeJobStrengthLevel();
    if (!canPlayerWorkOfficeJob(intelligence, job, charismaLevel, strengthLevel)) {
      const message = getOfficeJobLockedMessage(job, { intelligence, charismaLevel, strengthLevel });
      const alertMessage = message
        .replace(`${job.roleLabel} requires `, 'You need ')
        .replace(/(\d+) Intelligence/g, 'Level $1 Intelligence')
        .replace(/\.$/, ` to do ${job.roleLabel} job.`);
      if (this.schoolMicrogame?.context === 'office-job') {
        this.schoolMicrogame.data = {
          ...(this.schoolMicrogame.data ?? {}),
          intelligence,
          charismaLevel,
          strengthLevel,
          jobs: this.getOfficeJobMenuJobs()
        };
        this.schoolMicrogame.message = alertMessage;
      }
      this.playOfficeJobLockError();
      this.hud.showOfficeJobLockAlert(alertMessage);
      this.syncSchoolMicrogameHud();
      return false;
    }

    this.schoolMicrogameSequence += 1;
    this.schoolMicrogameRandomCursor = (Date.now() + this.schoolMicrogameSequence * 2654435761) >>> 0;
    this.schoolMicrogameSessionActive = false;
    const { round, data } = this.createOfficeJobRound(job.id);
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameLastTickAt = performance.now();
    this.schoolMicrogame = {
      id: `office_${round.jobId}_${this.schoolMicrogameSequence}`,
      context: 'office-job',
      phase: 'ready',
      round,
      data,
      remainingMs: round.durationMs,
      message: `${round.description} Perfect work only.`,
      resultTitle: '',
      resultDetail: '',
      preview: false
    };
    this.hud.setSchoolMicrogameState({
      visible,
      game: this.schoolMicrogame,
      loading: false,
      error: ''
    });
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
    return true;
  }

  schoolRandom() {
    this.schoolMicrogameRandomCursor = (Math.imul(this.schoolMicrogameRandomCursor || 1, 1664525) + 1013904223) >>> 0;
    return this.schoolMicrogameRandomCursor / 4294967296;
  }

  schoolRandomInt(min, max) {
    const low = Math.ceil(Number(min) || 0);
    const high = Math.floor(Number(max) || low);
    return low + Math.floor(this.schoolRandom() * Math.max(1, high - low + 1));
  }

  schoolPick(items = []) {
    return items[Math.floor(this.schoolRandom() * items.length)] ?? items[0];
  }

  schoolShuffle(items = []) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.schoolRandom() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  normalizeTeacherTypingText(value = '') {
    return String(value ?? '')
      .toUpperCase()
      .replace(/[^A-Z ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  chooseTeacherTypingSentence() {
    return this.schoolPick(TEACHER_TYPING_SENTENCES);
  }

  createSchoolMicrogameRound(gameId = SCHOOL_MICROGAME_DEFAULT_ID) {
    const definition = getSchoolMicrogameDefinition(gameId) ?? getSchoolMicrogameDefinition(SCHOOL_MICROGAME_DEFAULT_ID);
    const round = {
      ...definition,
      gameId: definition.id,
      icon: definition.shortTitle ?? 'GO',
      secondaryAccent: definition.secondaryAccent ?? definition.accent2 ?? '#ffce5b'
    };
    const data = {};

    if (definition.id === SCHOOL_MICROGAME_IDS.popQuiz) {
      const questions = createSchoolPopQuizQuestions({
        rng: () => this.schoolRandom(),
        count: SCHOOL_POP_QUIZ_ROUND_COUNT
      });
      const question = questions[0];
      round.questionCount = questions.length;
      round.questions = questions;
      round.question = question.question;
      round.answers = question.answers;
      round.correctIndex = question.correctIndex;
      data.currentQuestionIndex = 0;
      data.selectedIndex = -1;
      data.roundResults = Array.from({ length: questions.length }, () => null);
      data.correctCount = 0;
      data.questionLocked = false;
      data.advanceAt = 0;
      data.completing = false;
      data.lastCountdownSecond = 0;
      data.correctImpactIndex = -1;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.lockerCombo) {
      round.combo = Array.from({ length: 3 }, () => String(this.schoolRandomInt(0, 9)));
      round.keypad = this.schoolShuffle(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
      data.entered = [];
      data.previewActive = true;
      data.previewEndsAt = performance.now() + 1500;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.copyNotes) {
      const keys = ['W', 'A', 'S', 'D'];
      round.keys = keys;
      round.sequence = Array.from({ length: 4 }, () => this.schoolPick(keys));
      data.enteredCount = 0;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.teacherLooking) {
      round.sentence = this.normalizeTeacherTypingText(this.chooseTeacherTypingSentence());
      data.progress = 0;
      data.typedText = '';
      data.mistakes = 0;
      data.teacherLooking = false;
      data.teacherMode = 'away';
      data.nextLookAt = performance.now() + this.schoolRandomInt(3000, 4100);
      data.turnStartedAt = 0;
      data.turnEndsAt = 0;
      data.lookStartedAt = 0;
      data.lookEndsAt = 0;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.memoryMatch) {
      round.cards = createSchoolMemoryMatchCards({ rng: () => this.schoolRandom() });
      round.gridSize = 4;
      round.pairCount = round.cards.length / 2;
      data.visibleCardIds = [];
      data.matchedCardIds = [];
      data.pendingMismatchIds = [];
      data.celebratingCardIds = [];
      data.flippingBackCardIds = [];
      data.lastFlippedCardId = '';
      data.moves = 0;
      data.matchesFound = 0;
      data.flipCount = 0;
      data.matchBurstSeq = 0;
      data.celebrationEndsAt = 0;
      data.flipBackEndsAt = 0;
      data.lastFlipEndsAt = 0;
      data.completing = false;
      data.completeAt = 0;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.dodgeChalk) {
      round.lanes = ['Left', 'Center', 'Right'];
      data.playerLane = 1;
      data.chalks = [];
      data.lives = 2;
      data.spawnIn = 0.45;
      data.hitCooldownMs = 0;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.sortBackpack) {
      round.bins = ['Book', 'Snack', 'Contraband'];
      round.items = this.schoolShuffle([
        { id: 'math-book', label: 'Math Book', bin: 'Book' },
        { id: 'comic', label: 'Comic', bin: 'Book' },
        { id: 'chips', label: 'Chips', bin: 'Snack' },
        { id: 'juice', label: 'Juice', bin: 'Snack' },
        { id: 'spray', label: 'Spray Can', bin: 'Contraband' },
        { id: 'fireworks', label: 'Fireworks', bin: 'Contraband' }
      ]);
      data.remaining = [...round.items];
      data.selectedItemId = data.remaining[0]?.id ?? '';
      data.correct = 0;
      data.wrong = 0;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.bellSprint) {
      const targetStart = 0.38 + this.schoolRandom() * 0.18;
      round.targetStart = targetStart;
      round.targetEnd = Math.min(0.94, targetStart + 0.24);
      data.marker = this.schoolRandom() * 0.14;
      data.direction = 1;
      data.speed = 1.12 + this.schoolRandom() * 0.3;
      data.stopped = false;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.scantron) {
      const options = ['A', 'B', 'C', 'D'];
      round.options = options;
      round.answerKey = Array.from({ length: 4 }, () => this.schoolPick(options));
      data.filled = [];
      data.correct = 0;
      data.wrong = 0;
    }

    return { round, data };
  }

  openSchoolMicrogame(interaction = null) {
    const npcId = String(interaction?.npcId ?? '').trim();
    if (!npcId) {
      return;
    }

    this.closePhoneMenu();
    this.schoolMicrogameNpcId = npcId;
    this.schoolMicrogameNpcName = String(interaction?.npc?.name ?? 'Teacher');
    this.schoolMicrogameNpcModelId = String(interaction?.npc?.modelId ?? this.schoolMicrogameNpcModelId ?? 'martha');
    this.schoolMicrogamePreviewMode = false;
    this.schoolMicrogameSessionActive = true;
    this.schoolMicrogameSessionRoundCount = 0;
    this.schoolMicrogameSessionXpEarned = 0;
    this.schoolMicrogameRandomCursor = (Date.now() + (++this.schoolMicrogameSequence * 2654435761)) >>> 0;
    const gameId = this.chooseRandomSchoolSessionGameId('', SCHOOL_MICROGAME_ALL_ID);
    this.prepareSchoolMicrogame(gameId, { countdown: true, visible: true });
  }

  openDebugSchoolMicrogame(gameId = SCHOOL_MICROGAME_DEFAULT_ID) {
    this.closePhoneMenu();
    this.schoolMicrogameNpcId = 'debug-school';
    this.schoolMicrogameNpcName = 'Debug Teacher';
    this.schoolMicrogameNpcModelId = 'martha';
    this.schoolMicrogamePreviewMode = true;
    this.schoolMicrogameSessionActive = true;
    this.schoolMicrogameSessionRoundCount = 0;
    this.schoolMicrogameSessionXpEarned = 0;
    this.schoolMicrogameRandomCursor = (Date.now() + (++this.schoolMicrogameSequence * 2654435761)) >>> 0;
    this.prepareSchoolMicrogame(this.chooseRandomSchoolSessionGameId('', gameId), { countdown: true, visible: true });
    this.hud.showToast('School microgame HUD preview opened.');
    return true;
  }

  prepareSchoolMicrogame(
    gameId = SCHOOL_MICROGAME_DEFAULT_ID,
    {
      visible = this.hud.isSchoolMicrogameOpen(),
      countdown = this.schoolMicrogameSessionActive,
      previousResultTitle = '',
      previousResultDetail = '',
      previousSuccess = null
    } = {}
  ) {
    this.schoolMicrogameSequence += 1;
    this.schoolMicrogameRandomCursor = (Date.now() + this.schoolMicrogameSequence * 2654435761) >>> 0;
    const { round, data } = this.createSchoolMicrogameRound(gameId);
    const now = performance.now();
    round.teacherName = this.schoolMicrogameNpcName;
    round.teacherModelId = this.schoolMicrogameNpcModelId;
    data.roundNumber = Math.max(1, this.schoolMicrogameSessionRoundCount + 1);
    data.sessionXpEarned = Math.max(0, Math.floor(Number(this.schoolMicrogameSessionXpEarned ?? 0) || 0));
    data.previousResultTitle = previousResultTitle;
    data.previousResultDetail = previousResultDetail;
    data.previousSuccess = previousSuccess;
    if (countdown) {
      data.countdownStartedAt = now;
      data.countdownEndsAt = now + SCHOOL_MICROGAME_COUNTDOWN_MS;
      data.countdownMs = SCHOOL_MICROGAME_COUNTDOWN_MS;
    }
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameLastTickAt = now;
    this.schoolMicrogame = {
      id: `school_${round.gameId}_${this.schoolMicrogameSequence}`,
      context: 'school-minigame',
      phase: countdown ? 'countdown' : 'ready',
      round,
      data,
      remainingMs: countdown ? SCHOOL_MICROGAME_COUNTDOWN_MS : round.durationMs,
      message: countdown ? `Round ${data.roundNumber} starts soon.` : round.description,
      resultTitle: '',
      resultDetail: '',
      preview: this.schoolMicrogamePreviewMode === true
    };
    if (visible) {
      this.hud.hideLoading();
    }
    this.hud.setSchoolMicrogameState({
      visible,
      game: this.schoolMicrogame,
      loading: false,
      error: ''
    });
    this.adminPromptError = '';
    this.refreshAdminPromptHud();
  }

  beginSchoolMicrogame() {
    if (!this.schoolMicrogame || this.schoolMicrogame.phase === 'playing') {
      return;
    }

    const now = performance.now();
    this.advanceOfficeJanitorGameCycle(this.schoolMicrogame);
    this.schoolMicrogame.phase = 'playing';
    this.schoolMicrogame.startedAt = now;
    this.schoolMicrogame.endsAt = now + Math.max(1, Number(this.schoolMicrogame.round?.durationMs ?? 7000) || 7000);
    this.schoolMicrogame.remainingMs = this.schoolMicrogame.endsAt - now;
    this.schoolMicrogame.message = this.schoolMicrogame.round?.prompt ?? 'Go.';
    this.schoolMicrogame.resultTitle = '';
    this.schoolMicrogame.resultDetail = '';
    if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.popQuiz) {
      const questions = this.getPopQuizQuestions(this.schoolMicrogame);
      this.schoolMicrogame.data.roundResults = Array.from({ length: questions.length }, () => null);
      this.schoolMicrogame.data.correctCount = 0;
      this.schoolMicrogame.data.questionLocked = false;
      this.schoolMicrogame.data.advanceAt = 0;
      this.schoolMicrogame.data.completing = false;
      this.schoolMicrogame.data.lastCountdownSecond = Math.ceil(this.schoolMicrogame.remainingMs / 1000);
      this.schoolMicrogame.data.correctImpactIndex = -1;
      this.setCurrentPopQuizQuestion(this.schoolMicrogame, 0);
    } else if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.lockerCombo) {
      this.schoolMicrogame.data.entered = [];
      this.schoolMicrogame.data.previewActive = true;
      this.schoolMicrogame.data.previewEndsAt = now + 1500;
    } else if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.teacherLooking) {
      this.schoolMicrogame.data.progress = 0;
      this.schoolMicrogame.data.typedText = '';
      this.schoolMicrogame.data.mistakes = 0;
      this.schoolMicrogame.data.teacherLooking = false;
      this.schoolMicrogame.data.teacherMode = 'away';
      this.schoolMicrogame.data.nextLookAt = now + this.schoolRandomInt(3000, 4100);
      this.schoolMicrogame.data.turnStartedAt = 0;
      this.schoolMicrogame.data.turnEndsAt = 0;
      this.schoolMicrogame.data.lookStartedAt = 0;
      this.schoolMicrogame.data.lookEndsAt = 0;
    } else if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.memoryMatch) {
      this.schoolMicrogame.data.visibleCardIds = [];
      this.schoolMicrogame.data.matchedCardIds = [];
      this.schoolMicrogame.data.pendingMismatchIds = [];
      this.schoolMicrogame.data.celebratingCardIds = [];
      this.schoolMicrogame.data.flippingBackCardIds = [];
      this.schoolMicrogame.data.lastFlippedCardId = '';
      this.schoolMicrogame.data.moves = 0;
      this.schoolMicrogame.data.matchesFound = 0;
      this.schoolMicrogame.data.flipCount = 0;
      this.schoolMicrogame.data.matchBurstSeq = 0;
      this.schoolMicrogame.data.celebrationEndsAt = 0;
      this.schoolMicrogame.data.flipBackEndsAt = 0;
      this.schoolMicrogame.data.lastFlipEndsAt = 0;
      this.schoolMicrogame.data.completing = false;
      this.schoolMicrogame.data.completeAt = 0;
    } else if (this.isOfficeJanitorTrashTossGame(this.schoolMicrogame)) {
      this.applyJanitorTrashTossRoundDetails(this.schoolMicrogame.round);
      this.schoolMicrogame.round.requiredThrows = OFFICE_JANITOR_REQUIRED_THROWS;
      this.schoolMicrogame.data.requiredThrows = OFFICE_JANITOR_REQUIRED_THROWS;
      this.schoolMicrogame.data.madeThrows = 0;
      this.schoolMicrogame.data.throwSeq = 0;
      this.configureJanitorTrashTossShot(this.schoolMicrogame.round, this.schoolMicrogame.data, 1);
    } else if (this.isOfficeJanitorMopHeroGame(this.schoolMicrogame)) {
      this.configureJanitorMopHero(this.schoolMicrogame.round, this.schoolMicrogame.data);
    } else if (this.schoolMicrogame.round?.gameId === OFFICE_JOB_GAME_IDS.officeManager) {
      this.schoolMicrogame.data.fill = 0;
      this.schoolMicrogame.data.released = false;
      this.schoolMicrogame.data.brewing = false;
      this.schoolMicrogame.data.keyboardHolding = false;
    } else if (this.schoolMicrogame.round?.gameId === OFFICE_JOB_GAME_IDS.ceo) {
      this.configureCeoMemoStamp(this.schoolMicrogame.round, this.schoolMicrogame.data, 0);
      this.schoolMicrogame.data.approved = 0;
      this.schoolMicrogame.data.requiredApprovals = this.schoolMicrogame.round.requiredApprovals ?? 3;
      this.schoolMicrogame.data.memoLabel = this.schoolPick(OFFICE_CEO_MEMOS);
      this.schoolMicrogame.data.stamped = false;
      this.schoolMicrogame.data.stampSuccess = false;
      this.schoolMicrogame.data.stampResolveAt = 0;
      this.schoolMicrogame.data.stampSeq = 0;
      this.schoolMicrogame.data.stampMissSide = '';
    }
    this.input.clearKeyPressQueue?.();
    this.schoolMicrogameLastTickAt = now;
    this.playSoundEffect(this.phoneUnlockSound);
    this.syncSchoolMicrogameHud();
  }

  closeSchoolMicrogame() {
    this.schoolMicrogameSessionActive = false;
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogameRequestInFlight = false;
    this.adminPromptError = '';
    this.hud.setSchoolMicrogameState({
      visible: false,
      game: this.schoolMicrogame,
      loading: false,
      error: ''
    });
    this.refreshAdminPromptHud();
    this.schoolTeacherPreviewRenderer?.setActive(false);
  }

  updateSchoolMicrogameCountdown(game = this.schoolMicrogame, now = performance.now()) {
    if (!game || game.phase !== 'countdown') {
      return false;
    }

    const countdownEndsAt = Number(game.data?.countdownEndsAt ?? 0) || now;
    game.remainingMs = Math.max(0, countdownEndsAt - now);
    game.data.countdownMs = game.remainingMs;
    if (game.remainingMs > 0) {
      this.syncSchoolMicrogameHud();
      return true;
    }

    this.beginSchoolMicrogame();
    return true;
  }

  continueSchoolMicrogameSession({
    previousGameId = '',
    previousSuccess = null,
    previousResultTitle = '',
    previousResultDetail = ''
  } = {}) {
    if (!this.schoolMicrogameSessionActive || !this.hud.isSchoolMicrogameOpen()) {
      return;
    }

    const nextGameId = this.chooseRandomSchoolSessionGameId(previousGameId, SCHOOL_MICROGAME_ALL_ID);
    this.prepareSchoolMicrogame(nextGameId, {
      countdown: true,
      visible: true,
      previousSuccess,
      previousResultTitle,
      previousResultDetail
    });
  }

  syncSchoolMicrogameHud({ loading = this.schoolMicrogameRequestInFlight, error = '' } = {}) {
    this.hud.setSchoolMicrogameState({
      visible: this.hud.isSchoolMicrogameOpen(),
      game: this.schoolMicrogame,
      loading,
      error
    });
    this.syncSchoolTeacherPreview();
  }

  getOrCreateSchoolTeacherPreviewRenderer() {
    if (!this.schoolTeacherPreviewRenderer) {
      this.schoolTeacherPreviewRenderer = new SchoolTeacherPreviewRenderer({
        library: this.library
      });
    }

    return this.schoolTeacherPreviewRenderer;
  }

  syncSchoolTeacherPreview() {
    const game = this.schoolMicrogame;
    const isTeacherGame = (
      this.hud.isSchoolMicrogameOpen()
      && game?.round?.gameId === SCHOOL_MICROGAME_IDS.teacherLooking
      && game.phase === 'playing'
    );
    if (!isTeacherGame) {
      this.schoolTeacherPreviewRenderer?.setActive(false);
      return;
    }

    const mount = this.hud.getSchoolTeacherPreviewMount?.();
    if (!mount) {
      return;
    }

    const renderer = this.getOrCreateSchoolTeacherPreviewRenderer();
    renderer.mount(mount);
    renderer.setActive(true);
    void renderer.setTeacherModel(game.round?.teacherModelId ?? this.schoolMicrogameNpcModelId);
    const sentence = this.normalizeTeacherTypingText(game.round?.sentence ?? '');
    const typedText = this.normalizeTeacherTypingText(game.data?.typedText ?? '');
    renderer.setState({
      phase: game.phase,
      teacherMode: String(game.data?.teacherMode ?? (game.data?.teacherLooking ? 'looking' : 'away')),
      sentence,
      typedText,
      progress: sentence.length > 0 ? Math.min(100, (typedText.length / sentence.length) * 100) : 0,
      turnStartedAt: Number(game.data?.turnStartedAt ?? 0) || 0,
      turnEndsAt: Number(game.data?.turnEndsAt ?? 0) || 0,
      lookStartedAt: Number(game.data?.lookStartedAt ?? 0) || 0,
      lookEndsAt: Number(game.data?.lookEndsAt ?? 0) || 0,
      remainingMs: Number(game.remainingMs ?? 0) || 0
    });
  }

  updateSchoolTeacherPreview(deltaSeconds = 0) {
    this.syncSchoolTeacherPreview();
    this.schoolTeacherPreviewRenderer?.update(deltaSeconds);
  }

  getSchoolMicrogameDebugState() {
    const game = this.schoolMicrogame;
    if (!game) {
      return null;
    }

    const snapshot = {
      visible: this.hud.isSchoolMicrogameOpen(),
      loading: this.schoolMicrogameRequestInFlight,
      phase: game.phase,
      remainingMs: game.remainingMs,
      message: game.message,
      resultTitle: game.resultTitle,
      resultDetail: game.resultDetail,
      round: game.round,
      data: game.data
    };
    try {
      return JSON.parse(JSON.stringify(snapshot));
    } catch {
      return snapshot;
    }
  }

  async finishSchoolMicrogame(success, resultTitle, resultDetail = '') {
    if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
      return;
    }

    const completedGame = this.schoolMicrogame;
    const completedGameId = completedGame.round?.gameId ?? '';
    const isSchoolSession = completedGame.context === 'school-minigame';
    const completingOfficeJob = completedGame.context === 'office-job';
    const officeJobRewardMoney = completingOfficeJob
      ? Math.max(0, Math.floor(Number(completedGame.round?.rewardMoney ?? 0) || 0))
      : 0;
    this.schoolMicrogame.phase = success ? 'success' : 'failure';
    this.schoolMicrogame.remainingMs = 0;
    this.schoolMicrogame.resultTitle = resultTitle || (success ? 'Passed' : 'Try again');
    this.schoolMicrogame.resultDetail = resultDetail || (success ? 'Clean work.' : 'The bell got you.');
    this.schoolMicrogame.message = this.schoolMicrogame.resultDetail;
    this.schoolMicrogameHoldActive = false;
    this.schoolMicrogame.data = {
      ...(this.schoolMicrogame.data ?? {}),
      brewing: false,
      keyboardHolding: false
    };

    if (!success) {
      if (isSchoolSession) {
        this.schoolMicrogameSessionRoundCount += 1;
      }
      this.playSoundEffect(this.playingCardSound);
      this.syncSchoolMicrogameHud();
      if (isSchoolSession) {
        this.continueSchoolMicrogameSession({
          previousGameId: completedGameId,
          previousSuccess: false,
          previousResultTitle: this.schoolMicrogame.resultTitle,
          previousResultDetail: this.schoolMicrogame.resultDetail
        });
      }
      return;
    }

    const completionSoundStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.playTaskCompleteSound();
    this.hud.playTaskConfetti();
    this.syncSchoolMicrogameHud();

    const canCompleteReward = completingOfficeJob
      ? typeof this.npcService?.completeOfficeJob === 'function'
      : typeof this.npcService?.completeSchoolMicrogame === 'function';
    if (this.schoolMicrogamePreviewMode || !canCompleteReward) {
      if (isSchoolSession) {
        const previewXp = Math.max(0, Math.floor(Number(this.schoolMicrogame.round?.rewardXp ?? 0) || 0));
        this.schoolMicrogameSessionRoundCount += 1;
        this.schoolMicrogameSessionXpEarned += previewXp;
        const rewardText = previewXp > 0 ? `+${previewXp} Intelligence XP` : 'Nice work.';
        this.schoolMicrogame.resultDetail = rewardText;
        this.schoolMicrogame.message = rewardText;
        this.hud.showToast(rewardText);
        this.continueSchoolMicrogameSession({
          previousGameId: completedGameId,
          previousSuccess: true,
          previousResultTitle: this.schoolMicrogame.resultTitle,
          previousResultDetail: rewardText
        });
      }
      return;
    }

    this.schoolMicrogameRequestInFlight = true;
    this.syncSchoolMicrogameHud({ loading: true, error: '' });
    try {
      const officeJob = this.schoolMicrogame.context === 'office-job'
        ? (getOfficeJobDefinition(this.schoolMicrogame.round?.jobId) ?? getOfficeJobDefinitionByGameId(this.schoolMicrogame.round?.gameId))
        : null;
      const result = officeJob && typeof this.npcService?.completeOfficeJob === 'function'
        ? await this.npcService.completeOfficeJob(
          this.officeJobPlacementId,
          officeJob.id,
          { score: 1 }
        )
        : await this.npcService.completeSchoolMicrogame(
          this.schoolMicrogameNpcId,
          this.schoolMicrogame.round?.gameId,
          { score: 1 }
        );
      if (!result?.ok) {
        const fallbackError = officeJob ? 'Office payroll failed.' : 'School reward failed.';
        this.syncSchoolMicrogameHud({ loading: false, error: result?.error ?? fallbackError });
        this.hud.showToast(result?.error ?? fallbackError);
        if (isSchoolSession && this.schoolMicrogame === completedGame) {
          this.schoolMicrogameSessionRoundCount += 1;
          this.continueSchoolMicrogameSession({
            previousGameId: completedGameId,
            previousSuccess: false,
            previousResultTitle: this.schoolMicrogame.resultTitle,
            previousResultDetail: result?.error ?? fallbackError
          });
        }
        return;
      }

      const xp = Math.max(0, Math.floor(Number(result.xp ?? this.schoolMicrogame.round?.rewardXp ?? 0) || 0));
      const rewardText = xp > 0 ? `+${xp} Intelligence XP` : 'Nice work.';
      if (isSchoolSession) {
        this.schoolMicrogameSessionRoundCount += 1;
        this.schoolMicrogameSessionXpEarned += xp;
      }
      this.schoolMicrogame.resultDetail = rewardText;
      this.schoolMicrogame.message = this.schoolMicrogame.resultDetail;
      this.hud.showToast(rewardText);
      if (result.money !== undefined) {
        this.phoneWalletState = {
          ...this.phoneWalletState,
          cash: result.money
        };
        this.refreshPhoneWalletHud();
        if (officeJob && officeJobRewardMoney > 0) {
          const elapsedSinceCompletionSound = (
            typeof performance !== 'undefined' ? performance.now() : Date.now()
          ) - completionSoundStartedAt;
          this.playTaskCompleteChaChing(
            Math.max(0, TASK_COMPLETE_CHA_CHING_DELAY_MS - elapsedSinceCompletionSound)
          );
        }
      }
      this.syncSchoolMicrogameHud({ loading: false, error: '' });
      if (isSchoolSession && this.schoolMicrogame === completedGame) {
        this.continueSchoolMicrogameSession({
          previousGameId: completedGameId,
          previousSuccess: true,
          previousResultTitle: this.schoolMicrogame.resultTitle,
          previousResultDetail: rewardText
        });
      }
    } catch (error) {
      console.warn('[SchoolMicrogame] Completion failed.', error);
      const fallbackError = this.schoolMicrogame?.context === 'office-job'
        ? 'Office payroll failed.'
        : 'School reward failed.';
      this.syncSchoolMicrogameHud({ loading: false, error: fallbackError });
      this.hud.showToast(fallbackError);
      if (isSchoolSession && this.schoolMicrogame === completedGame) {
        this.schoolMicrogameSessionRoundCount += 1;
        this.continueSchoolMicrogameSession({
          previousGameId: completedGameId,
          previousSuccess: false,
          previousResultTitle: this.schoolMicrogame.resultTitle,
          previousResultDetail: fallbackError
        });
      }
    } finally {
      this.schoolMicrogameRequestInFlight = false;
      this.syncSchoolMicrogameHud();
    }
  }

  handleSchoolMicrogameAction(action = '') {
    const game = this.schoolMicrogame;
    if (!game) {
      return;
    }

    if (action === 'office:menu') {
      this.openOfficeJobMenu();
      return;
    }

    if (action.startsWith('office:select:')) {
      this.prepareOfficeJobMicrogame(action.slice('office:select:'.length), { visible: true });
      return;
    }

    if (action === 'start' && game.context !== 'school-minigame') {
      if (this.isOfficeJobGame(game)) {
        this.startOfficeJobCountdown(game);
        return;
      }
      this.beginSchoolMicrogame();
      return;
    }

    if (action === 'restart') {
      if (game.context === 'office-job') {
        this.prepareOfficeJobMicrogame(game.round?.jobId ?? OFFICE_JOB_IDS.janitor, { visible: true });
      } else {
        this.prepareSchoolMicrogame(game.round?.gameId ?? SCHOOL_MICROGAME_DEFAULT_ID, { visible: true });
      }
      return;
    }

    if (action === 'hold:start') {
      this.schoolMicrogameHoldActive = true;
      if (this.isOfficeJobGame(game)) {
        this.handleOfficeJobHoldStart();
      }
      return;
    }

    if (action === 'hold:end') {
      const wasHolding = this.schoolMicrogameHoldActive;
      this.schoolMicrogameHoldActive = false;
      if (this.isOfficeJobGame(game)) {
        this.handleOfficeJobHoldEnd(wasHolding);
        return;
      }
      this.syncSchoolMicrogameHud();
      return;
    }

    if (game.phase !== 'playing') {
      return;
    }

    this.handlePlayingSchoolMicrogameAction(action);
  }

  getPopQuizQuestions(game = this.schoolMicrogame) {
    const round = game?.round ?? {};
    if (Array.isArray(round.questions) && round.questions.length > 0) {
      return round.questions;
    }

    return [{
      question: round.question ?? 'Question',
      answers: Array.isArray(round.answers) ? round.answers : [],
      correctIndex: Number(round.correctIndex ?? -1)
    }];
  }

  setCurrentPopQuizQuestion(game = this.schoolMicrogame, questionIndex = 0) {
    const questions = this.getPopQuizQuestions(game);
    const nextIndex = Math.max(0, Math.min(questions.length - 1, Math.floor(Number(questionIndex) || 0)));
    const question = questions[nextIndex] ?? questions[0];
    if (!game || !question) {
      return;
    }

    game.data.currentQuestionIndex = nextIndex;
    game.data.selectedIndex = -1;
    game.data.questionLocked = false;
    game.data.advanceAt = 0;
    game.data.completing = false;
    game.data.correctImpactIndex = -1;
    game.round.question = question.question;
    game.round.answers = question.answers;
    game.round.correctIndex = question.correctIndex;
    game.message = `Question ${nextIndex + 1} of ${questions.length}.`;
  }

  handlePopQuizAnswer(index) {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.popQuiz || game.data.questionLocked) {
      return;
    }

    const questions = this.getPopQuizQuestions(game);
    const currentIndex = Math.max(0, Math.min(questions.length - 1, Math.floor(Number(game.data.currentQuestionIndex ?? 0) || 0)));
    const question = questions[currentIndex] ?? {};
    const selectedIndex = Math.floor(Number(index));
    const roundResults = Array.isArray(game.data.roundResults) && game.data.roundResults.length === questions.length
      ? [...game.data.roundResults]
      : Array.from({ length: questions.length }, () => null);
    const isCorrect = selectedIndex === Number(question.correctIndex ?? -1);

    game.data.selectedIndex = selectedIndex;
    game.data.questionLocked = true;
    roundResults[currentIndex] = isCorrect;
    game.data.roundResults = roundResults;

    if (!isCorrect) {
      this.syncSchoolMicrogameHud();
      void this.finishSchoolMicrogame(false, 'Wrong answer', 'You needed a perfect 3-for-3 to pass.');
      return;
    }

    game.data.correctCount = roundResults.filter((result) => result === true).length;
    game.data.correctImpactIndex = currentIndex;
    game.data.advanceAt = performance.now() + 900;
    game.data.completing = currentIndex >= questions.length - 1;
    game.message = game.data.completing
      ? 'Perfect. Turning it in...'
      : `Correct. Question ${currentIndex + 2} is up next.`;
    this.playSoundEffect(this.levelUpSound);
    this.syncSchoolMicrogameHud();
  }

  getMemoryMatchCards(game = this.schoolMicrogame) {
    return Array.isArray(game?.round?.cards) ? game.round.cards : [];
  }

  normalizeMemoryCardIds(ids = [], cards = this.getMemoryMatchCards()) {
    const allowed = new Set(cards.map((card) => card.id));
    const next = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const cardId = String(id ?? '');
      if (allowed.has(cardId) && !next.includes(cardId)) {
        next.push(cardId);
      }
    }
    return next;
  }

  handleMemoryMatchFlip(cardId = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.memoryMatch || game.data.completing) {
      return;
    }

    const cards = this.getMemoryMatchCards(game);
    const selectedCard = cards.find((card) => card.id === cardId);
    if (!selectedCard) {
      return;
    }

    const matchedIds = new Set(this.normalizeMemoryCardIds(game.data.matchedCardIds, cards));
    if (matchedIds.has(cardId)) {
      return;
    }

    let visibleIds = this.normalizeMemoryCardIds(game.data.visibleCardIds, cards)
      .filter((id) => !matchedIds.has(id));
    const pendingMismatchIds = this.normalizeMemoryCardIds(game.data.pendingMismatchIds, cards);
    if (pendingMismatchIds.length >= 2) {
      visibleIds = visibleIds.filter((id) => !pendingMismatchIds.includes(id));
      game.data.pendingMismatchIds = [];
      game.data.celebratingCardIds = [];
      game.data.flippingBackCardIds = pendingMismatchIds;
      game.data.flipBackEndsAt = performance.now() + 340;
    }

    if (visibleIds.includes(cardId)) {
      return;
    }

    if (visibleIds.length >= 2) {
      visibleIds = [];
    }

    visibleIds.push(cardId);
    game.data.visibleCardIds = visibleIds;
    game.data.lastFlippedCardId = cardId;
    game.data.lastFlipEndsAt = performance.now() + 360;
    game.data.flipCount = Math.max(0, Math.floor(Number(game.data.flipCount ?? 0) || 0)) + 1;
    this.playSoundEffect(this.playingCardSound);

    if (visibleIds.length < 2) {
      game.message = 'Flip one more card.';
      this.syncSchoolMicrogameHud();
      return;
    }

    game.data.moves = Math.max(0, Math.floor(Number(game.data.moves ?? 0) || 0)) + 1;
    const [firstId, secondId] = visibleIds;
    const firstCard = cards.find((card) => card.id === firstId);
    const secondCard = cards.find((card) => card.id === secondId);
    const isMatch = Boolean(firstCard && secondCard && firstCard.pairId === secondCard.pairId);

    if (!isMatch) {
      game.data.pendingMismatchIds = [firstId, secondId];
      game.message = 'Not a match. Flip another card to reset them.';
      this.syncSchoolMicrogameHud();
      return;
    }

    matchedIds.add(firstId);
    matchedIds.add(secondId);
    const pairCount = Math.max(1, Math.floor(Number(game.round.pairCount ?? cards.length / 2) || 1));
    game.data.matchedCardIds = [...matchedIds];
    game.data.visibleCardIds = [];
    game.data.pendingMismatchIds = [];
    game.data.celebratingCardIds = [firstId, secondId];
    game.data.matchesFound = Math.floor(matchedIds.size / 2);
    game.data.matchBurstSeq = Math.max(0, Math.floor(Number(game.data.matchBurstSeq ?? 0) || 0)) + 1;
    game.data.celebrationEndsAt = performance.now() + 950;
    this.playSoundEffect(this.levelUpSound);

    if (game.data.matchesFound >= pairCount) {
      game.data.completing = true;
      game.data.completeAt = performance.now() + 900;
      game.message = 'Every pair is locked in.';
    } else {
      game.message = `${game.data.matchesFound}/${pairCount} pairs matched.`;
    }
    this.syncSchoolMicrogameHud();
  }

  finishOfficeJob(success = false, title = '', detail = '') {
    return this.finishSchoolMicrogame(success, title, detail);
  }

  handleOfficeJobHoldStart() {
    const game = this.schoolMicrogame;
    if (!this.isOfficeJobGame(game) || game.phase !== 'playing') {
      return;
    }

    if (game.round?.officeJobId === OFFICE_JOB_IDS.officeManager && !game.data.released) {
      game.data.brewing = true;
      game.message = 'Brewing. Release on the perfect mug line.';
      this.syncSchoolMicrogameHud();
    }
  }

  handleOfficeJobHoldEnd(wasHolding = false) {
    const game = this.schoolMicrogame;
    if (!this.isOfficeJobGame(game) || game.phase !== 'playing') {
      return;
    }

    const jobId = game.round?.officeJobId;
    if (jobId === OFFICE_JOB_IDS.officeManager && wasHolding && !game.data.released) {
      game.data.released = true;
      game.data.brewing = false;
      const fill = Number(game.data.fill ?? 0) || 0;
      const targetStart = Number(game.round.targetStart ?? 72) || 72;
      const targetEnd = Number(game.round.targetEnd ?? 82) || 82;
      const perfect = fill >= targetStart && fill <= targetEnd;
      void this.finishOfficeJob(
        perfect,
        perfect ? 'Perfect Pour' : 'Bad Pour',
        perfect ? 'The cup lands exactly on the line.' : 'The coffee missed the perfect amount.'
      );
      return;
    }

    if (jobId === OFFICE_JOB_IDS.officeManager) {
      game.data.brewing = false;
    }
    this.syncSchoolMicrogameHud();
  }

  handlePlayingOfficeJobAction(action = '') {
    const game = this.schoolMicrogame;
    if (!this.isOfficeJobGame(game) || game.phase !== 'playing') {
      return;
    }

    if (this.isOfficeJanitorTrashTossGame(game) && action === 'office:throw') {
      if (game.data.thrown) {
        return;
      }
      game.data.thrown = true;
      const marker = Number(game.data.marker ?? 0) || 0;
      const targetStart = Number(game.round.targetStart ?? 0) || 0;
      const targetEnd = Number(game.round.targetEnd ?? 1) || 1;
      const made = marker >= targetStart && marker <= targetEnd;
      const targetMid = (targetStart + targetEnd) / 2;
      const now = performance.now();
      game.data.throwMade = made;
      game.data.throwSeq = Math.max(0, Math.floor(Number(game.data.throwSeq ?? 0) || 0)) + 1;
      game.data.throwMissSide = made ? '' : marker < targetMid ? 'left' : 'right';
      game.data.throwResolveAt = now + OFFICE_JANITOR_THROW_RESOLVE_MS;
      game.endsAt = Math.max(Number(game.endsAt ?? now) || now, game.data.throwResolveAt + 100);
      const shot = Math.max(1, Math.floor(Number(game.data.shotNumber ?? 1) || 1));
      game.message = made ? `Shot ${shot} is clean. Keep the streak alive.` : 'That arc is trouble.';
      this.playSoundEffect(made ? this.levelUpSound : this.playingCardSound);
      this.syncSchoolMicrogameHud();
      return;
    }

    if (game.round?.officeJobId === OFFICE_JOB_IDS.ceo && action === 'office:stamp') {
      if (game.data.stamped) {
        return;
      }
      const marker = Number(game.data.memoPosition ?? 0) || 0;
      const targetStart = Number(game.round.targetStart ?? 0) || 0;
      const targetEnd = Number(game.round.targetEnd ?? 1) || 1;
      const made = marker >= targetStart && marker <= targetEnd;
      const targetMid = (targetStart + targetEnd) / 2;
      const now = performance.now();
      game.data.stamped = true;
      game.data.stampSuccess = made;
      game.data.stampSeq = Math.max(0, Math.floor(Number(game.data.stampSeq ?? 0) || 0)) + 1;
      game.data.stampMissSide = made ? '' : marker < targetMid ? 'early' : 'late';
      game.data.stampResolveAt = now + OFFICE_CEO_STAMP_RESOLVE_MS;
      game.endsAt = Math.max(Number(game.endsAt ?? now) || now, game.data.stampResolveAt + 120);

      if (made) {
        game.data.approved = Math.min(
          Math.max(1, Math.floor(Number(game.data.requiredApprovals ?? game.round.requiredApprovals ?? 3) || 3)),
          Math.max(0, Math.floor(Number(game.data.approved ?? 0) || 0)) + 1
        );
        game.message = 'Approved. Shareholders are pretending to understand.';
        this.playSoundEffect(this.levelUpSound);
      } else {
        game.message = game.data.stampMissSide === 'early'
          ? 'Too early. Legal saw that.'
          : 'Too late. The quarter has moved on.';
        this.playSoundEffect(this.playingCardSound);
      }
      this.syncSchoolMicrogameHud();
      return;
    }
  }

  handlePlayingSchoolMicrogameAction(action = '') {
    const game = this.schoolMicrogame;
    const gameId = game?.round?.gameId;
    if (!game || !gameId) {
      return;
    }

    if (this.isOfficeJobGame(game)) {
      this.handlePlayingOfficeJobAction(action);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.popQuiz && action.startsWith('answer:')) {
      this.handlePopQuizAnswer(action.split(':')[1]);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.lockerCombo && action.startsWith('digit:')) {
      this.pushLockerComboDigit(action.split(':')[1] ?? '');
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.copyNotes && action.startsWith('note:')) {
      this.pushCopyNotesKey(action.slice('note:'.length));
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.memoryMatch && action.startsWith('memory:flip:')) {
      this.handleMemoryMatchFlip(action.slice('memory:flip:'.length));
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.dodgeChalk) {
      if (action === 'move:left') {
        game.data.playerLane = Math.max(0, Math.floor(Number(game.data.playerLane ?? 1) || 1) - 1);
      } else if (action === 'move:right') {
        game.data.playerLane = Math.min(2, Math.floor(Number(game.data.playerLane ?? 1) || 1) + 1);
      }
      this.syncSchoolMicrogameHud();
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.sortBackpack) {
      this.handleSortBackpackAction(action);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.bellSprint && action === 'stop') {
      const marker = Number(game.data.marker ?? 0);
      const inside = marker >= Number(game.round.targetStart ?? 0) && marker <= Number(game.round.targetEnd ?? 0);
      game.data.stopped = true;
      void this.finishSchoolMicrogame(inside, inside ? 'Made It' : 'Late Bell', inside ? 'You hit the door right on the bell.' : 'So close you can hear the attendance sheet.');
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.scantron && action.startsWith('bubble:')) {
      const [, rowText, option] = action.split(':');
      this.fillScantronBubble(Math.floor(Number(rowText)), option);
      return;
    }

  }

  pushLockerComboDigit(digit = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.lockerCombo) {
      return;
    }

    const combo = Array.isArray(game.round.combo) ? game.round.combo : [];
    const entered = Array.isArray(game.data.entered) ? game.data.entered : [];
    if (game.data.previewActive) {
      game.message = 'Memorize the flash, then punch it in.';
      this.syncSchoolMicrogameHud();
      return;
    }

    const expected = combo[entered.length];
    entered.push(String(digit));
    game.data.entered = entered;
    this.playSoundEffect(this.playingCardSound);
    if (String(digit) !== String(expected)) {
      void this.finishSchoolMicrogame(false, 'Jammed Lock', 'The dial snaps back to zero.');
      return;
    }
    if (entered.length >= combo.length) {
      void this.finishSchoolMicrogame(true, 'Unlocked', 'Clean memory. Cleaner click.');
      return;
    }
    this.syncSchoolMicrogameHud();
  }

  pushCopyNotesKey(key = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.copyNotes) {
      return;
    }

    const sequence = Array.isArray(game.round.sequence) ? game.round.sequence : [];
    const enteredCount = Math.max(0, Math.floor(Number(game.data.enteredCount ?? 0) || 0));
    const expected = sequence[enteredCount];
    if (String(key).toUpperCase() !== String(expected).toUpperCase()) {
      void this.finishSchoolMicrogame(false, 'Smudged Notes', 'One wrong letter and the whole board tilts.');
      return;
    }

    game.data.enteredCount = enteredCount + 1;
    this.playSoundEffect(this.typingOnKeyboardSound);
    if (game.data.enteredCount >= sequence.length) {
      void this.finishSchoolMicrogame(true, 'Copied', 'Every mark lands in the right place.');
      return;
    }
    this.syncSchoolMicrogameHud();
  }

  updateTeacherLookingState(game = this.schoolMicrogame, now = performance.now()) {
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.teacherLooking || game.phase !== 'playing') {
      return false;
    }

    const teacherMode = String(game.data.teacherMode ?? (game.data.teacherLooking ? 'looking' : 'away'));
    if (teacherMode === 'away' && now >= Number(game.data.nextLookAt ?? 0)) {
      game.data.teacherMode = 'turning';
      game.data.teacherLooking = false;
      game.data.turnStartedAt = now;
      game.data.turnEndsAt = now + this.schoolRandomInt(880, 1120);
      game.message = 'Yellow light. Stop.';
      return true;
    }
    if (teacherMode === 'turning' && now >= Number(game.data.turnEndsAt ?? 0)) {
      game.data.teacherMode = 'looking';
      game.data.teacherLooking = true;
      game.data.lookStartedAt = now;
      game.data.lookEndsAt = now + this.schoolRandomInt(900, 1250);
      game.message = 'Red light. Freeze.';
      return true;
    }
    if (teacherMode === 'looking' && now >= Number(game.data.lookEndsAt ?? 0)) {
      game.data.teacherMode = 'away';
      game.data.teacherLooking = false;
      game.data.nextLookAt = now + this.schoolRandomInt(2100, 3100);
      game.message = 'Green light. Type.';
      return true;
    }

    return false;
  }

  pushTeacherTypingKey(key = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.teacherLooking || game.phase !== 'playing') {
      return;
    }

    const inputKey = String(key ?? '').toUpperCase();
    const isBackspace = inputKey === 'BACKSPACE';
    const isTextKey = isBackspace || inputKey === ' ' || /^[A-Z]$/.test(inputKey);
    if (!isTextKey) {
      return;
    }

    const teacherMode = String(game.data.teacherMode ?? (game.data.teacherLooking ? 'looking' : 'away'));
    if (teacherMode === 'looking') {
      void this.finishSchoolMicrogame(false, 'Caught', 'The teacher saw every suspicious keystroke.');
      return;
    }

    const sentence = this.normalizeTeacherTypingText(game.round.sentence ?? '');
    let typedText = String(game.data.typedText ?? '').toUpperCase().replace(/[^A-Z ]+/g, '');
    if (isBackspace) {
      typedText = typedText.slice(0, -1);
      game.data.typedText = typedText;
      game.data.progress = sentence.length > 0 ? Math.min(100, (typedText.length / sentence.length) * 100) : 0;
      game.message = typedText ? 'Green light. Clean correction.' : 'Green light. Fresh page.';
      this.syncSchoolMicrogameHud();
      return;
    }

    const expected = sentence[typedText.length] ?? '';
    if (inputKey !== expected) {
      game.data.mistakes = Math.min(99, Math.floor(Number(game.data.mistakes ?? 0) || 0) + 1);
      game.message = expected === ' ' ? 'Green light. Leave a gap.' : `Green light. Next: ${expected}`;
      this.playSoundEffect(this.playingCardSound);
      this.syncSchoolMicrogameHud();
      return;
    }

    typedText += expected;
    game.data.typedText = typedText;
    game.data.progress = sentence.length > 0 ? Math.min(100, (typedText.length / sentence.length) * 100) : 100;
    this.playSoundEffect(this.typingOnKeyboardSound);
    if (typedText.length >= sentence.length) {
      void this.finishSchoolMicrogame(true, 'Finished', 'Sentence finished. The teacher never saw the pencil move.');
      return;
    }

    game.message = 'Green light. Keep typing.';
    this.syncSchoolMicrogameHud();
  }

  handleSortBackpackAction(action = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.sortBackpack) {
      return;
    }

    if (action.startsWith('item:')) {
      game.data.selectedItemId = action.slice('item:'.length);
      this.syncSchoolMicrogameHud();
      return;
    }

    if (!action.startsWith('bin:')) {
      return;
    }

    const selectedId = String(game.data.selectedItemId || game.data.remaining?.[0]?.id || '');
    if (!selectedId) {
      game.message = 'Pick an item first.';
      this.syncSchoolMicrogameHud();
      return;
    }

    const bin = action.slice('bin:'.length);
    const item = (game.data.remaining ?? []).find((entry) => entry.id === selectedId);
    if (!item) {
      return;
    }

    game.data.remaining = game.data.remaining.filter((entry) => entry.id !== selectedId);
    if (item.bin === bin) {
      game.data.correct += 1;
      this.playSoundEffect(this.typingOnKeyboardSound);
    } else {
      game.data.wrong += 1;
      this.playSoundEffect(this.playingCardSound);
    }

    if (game.data.correct >= 2) {
      void this.finishSchoolMicrogame(true, 'Packed', 'The backpack finally has a filing system.');
      return;
    }
    if (game.data.wrong >= 2) {
      void this.finishSchoolMicrogame(false, 'Bag Search', 'That pile is now evidence.');
      return;
    }
    game.data.selectedItemId = game.data.remaining[0]?.id ?? '';
    this.syncSchoolMicrogameHud();
  }

  fillScantronBubble(rowIndex = 0, option = '') {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.scantron) {
      return;
    }

    const row = Math.max(0, Math.min((game.round.answerKey?.length ?? 1) - 1, rowIndex));
    if (game.data.filled[row]) {
      return;
    }

    game.data.filled[row] = option;
    if (game.round.answerKey[row] === option) {
      game.data.correct += 1;
      this.playSoundEffect(this.typingOnKeyboardSound);
    } else {
      game.data.wrong += 1;
      this.playSoundEffect(this.playingCardSound);
    }

    if (game.data.correct >= game.round.answerKey.length) {
      void this.finishSchoolMicrogame(true, 'Aced', 'Bubbles filled. Pencil intact.');
      return;
    }
    if (game.data.wrong >= 2) {
      void this.finishSchoolMicrogame(false, 'Bad Bubbles', 'The answer sheet looks haunted.');
      return;
    }
    this.syncSchoolMicrogameHud();
  }

  updateSchoolMicrogame(deltaSeconds = 0) {
    const game = this.schoolMicrogame;
    if (!game || !this.hud.isSchoolMicrogameOpen()) {
      return;
    }

    const now = performance.now();
    if (game.phase === 'countdown') {
      this.updateSchoolMicrogameCountdown(game, now);
      return;
    }

    if (game.phase !== 'playing') {
      return;
    }

    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || ((now - this.schoolMicrogameLastTickAt) / 1000)));
    this.schoolMicrogameLastTickAt = now;
    game.remainingMs = Math.max(0, Number(game.endsAt ?? now) - now);

    this.handleSchoolMicrogameKeyboardInput();
    this.updatePlayingSchoolMicrogame(dt, now);

    if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
      return;
    }

    if (game.remainingMs <= 0) {
      const gameId = game.round?.gameId;
      if (this.isOfficeJobGame(game)) {
        const officeJobId = game.round?.officeJobId ?? game.round?.jobId;
        const resolvingOfficeAction = (
          (officeJobId === OFFICE_JOB_IDS.janitor && this.isOfficeJanitorTrashTossGame(game) && game.data.thrown && Number(game.data.throwResolveAt ?? 0) > now)
          || (officeJobId === OFFICE_JOB_IDS.ceo && game.data.stamped && Number(game.data.stampResolveAt ?? 0) > now)
        );
        if (resolvingOfficeAction) {
          game.remainingMs = Math.max(1, Number(game.endsAt ?? now) - now);
          this.syncSchoolMicrogameHud();
          return;
        }
        void this.finishOfficeJob(false, 'Out Of Time', 'Office work still has deadlines.');
      } else if (gameId === SCHOOL_MICROGAME_IDS.dodgeChalk) {
        void this.finishSchoolMicrogame(true, 'Survived', 'The bell saves the day.');
      } else if (gameId === SCHOOL_MICROGAME_IDS.bellSprint) {
        const marker = Number(game.data.marker ?? 0);
        const inside = marker >= Number(game.round.targetStart ?? 0) && marker <= Number(game.round.targetEnd ?? 0);
        void this.finishSchoolMicrogame(inside, inside ? 'Made It' : 'Out Of Time', inside ? 'You hit the door right on the bell.' : 'The bell does not negotiate.');
      } else if (gameId === SCHOOL_MICROGAME_IDS.teacherLooking) {
        void this.finishSchoolMicrogame(false, 'Unfinished', 'The bell rang before the sentence was finished.');
      } else if (gameId === SCHOOL_MICROGAME_IDS.memoryMatch) {
        void this.finishSchoolMicrogame(false, 'Still Hidden', 'The last pairs stayed face down when the bell rang.');
      } else {
        void this.finishSchoolMicrogame(false, 'Out Of Time', 'The bell does not negotiate.');
      }
      return;
    }

    this.syncSchoolMicrogameHud();
  }

  handleOfficeJobKeyboardInput(game = this.schoolMicrogame) {
    if (!this.isOfficeJobGame(game) || game.phase !== 'playing') {
      return;
    }

    const jobId = game.round?.officeJobId;
    if (jobId === OFFICE_JOB_IDS.janitor) {
      if (this.isOfficeJanitorTrashTossGame(game) && (this.input.consume('Space') || this.input.consume('Enter') || this.input.consume('KeyE'))) {
        this.handlePlayingOfficeJobAction('office:throw');
      }
      return;
    }

    if (jobId === OFFICE_JOB_IDS.ceo) {
      if (this.input.consume('Space') || this.input.consume('Enter') || this.input.consume('KeyE')) {
        this.handlePlayingOfficeJobAction('office:stamp');
      }
      return;
    }

    if (jobId !== OFFICE_JOB_IDS.officeManager) {
      return;
    }

    const holding = this.input.isPressed('Space');
    const wasHolding = Boolean(game.data.keyboardHolding);
    if (holding && !wasHolding) {
      game.data.keyboardHolding = true;
      this.schoolMicrogameHoldActive = true;
      this.handleOfficeJobHoldStart();
    } else if (!holding && wasHolding) {
      game.data.keyboardHolding = false;
      this.schoolMicrogameHoldActive = false;
      this.handleOfficeJobHoldEnd(true);
    }
  }

  handleSchoolMicrogameKeyboardInput() {
    const game = this.schoolMicrogame;
    const gameId = game?.round?.gameId;
    if (!game || game.phase !== 'playing') {
      return;
    }

    if (this.isOfficeJobGame(game)) {
      this.handleOfficeJobKeyboardInput(game);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.copyNotes) {
      for (const key of game.round.keys ?? []) {
        if (this.input.consume(`Key${key}`)) {
          this.pushCopyNotesKey(key);
          return;
        }
      }
    }

    if (gameId === SCHOOL_MICROGAME_IDS.lockerCombo) {
      for (let digit = 0; digit <= 9; digit += 1) {
        if (this.input.consume(`Digit${digit}`) || this.input.consume(`Numpad${digit}`)) {
          this.pushLockerComboDigit(String(digit));
          return;
        }
      }
    }

    if (gameId === SCHOOL_MICROGAME_IDS.dodgeChalk) {
      if (this.input.consume('KeyA') || this.input.consume('ArrowLeft')) {
        this.handlePlayingSchoolMicrogameAction('move:left');
      }
      if (this.input.consume('KeyD') || this.input.consume('ArrowRight')) {
        this.handlePlayingSchoolMicrogameAction('move:right');
      }
    }

    if (gameId === SCHOOL_MICROGAME_IDS.teacherLooking) {
      const typingCodes = ['Backspace', 'Space'];
      for (let charCode = 65; charCode <= 90; charCode += 1) {
        typingCodes.push(`Key${String.fromCharCode(charCode)}`);
      }

      for (let index = 0; index < 32; index += 1) {
        const keyEvent = this.input.consumeNextKeyEvent(typingCodes);
        if (!keyEvent) {
          return;
        }

        this.updateTeacherLookingState(game, Number(keyEvent.at ?? performance.now()));
        if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
          return;
        }

        const code = keyEvent.code;
        if (code === 'Backspace') {
          this.pushTeacherTypingKey('Backspace');
        } else if (code === 'Space') {
          this.pushTeacherTypingKey(' ');
        } else if (code.startsWith('Key')) {
          this.pushTeacherTypingKey(code.slice(3));
        }

        if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
          return;
        }
      }
    }

    if (gameId === SCHOOL_MICROGAME_IDS.bellSprint) {
      if (this.input.consume('Space') || this.input.consume('Enter') || this.input.consume('KeyE')) {
        this.handlePlayingSchoolMicrogameAction('stop');
      }
    }

    if (gameId === SCHOOL_MICROGAME_IDS.scantron) {
      for (const option of ['A', 'B', 'C', 'D']) {
        if (this.input.consume(`Key${option}`)) {
          const row = (game.data.filled ?? []).filter(Boolean).length;
          this.fillScantronBubble(row, option);
          return;
        }
      }
    }

  }

  playPopQuizCountdownTick(game = this.schoolMicrogame) {
    if (!game || game.phase !== 'playing' || game.round?.gameId !== SCHOOL_MICROGAME_IDS.popQuiz) {
      return;
    }

    const currentSecond = Math.ceil(Math.max(0, Number(game.remainingMs ?? 0) || 0) / 1000);
    if (currentSecond <= 0) {
      return;
    }

    const lastSecond = Number(game.data.lastCountdownSecond);
    if (!Number.isFinite(lastSecond)) {
      game.data.lastCountdownSecond = currentSecond;
      return;
    }

    if (currentSecond < lastSecond) {
      game.data.lastCountdownSecond = currentSecond;
      this.playSoundEffect(this.popQuizClockTickSound);
    }
  }

  updatePopQuizState(game = this.schoolMicrogame, now = performance.now()) {
    this.playPopQuizCountdownTick(game);

    if (!game?.data?.questionLocked || Number(game.data.advanceAt ?? 0) <= 0 || now < Number(game.data.advanceAt ?? 0)) {
      return;
    }

    const questions = this.getPopQuizQuestions(game);
    const currentIndex = Math.max(0, Math.min(questions.length - 1, Math.floor(Number(game.data.currentQuestionIndex ?? 0) || 0)));
    if (game.data.completing || currentIndex >= questions.length - 1) {
      void this.finishSchoolMicrogame(true, 'Perfect Score', 'All three answers landed.');
      return;
    }

    this.setCurrentPopQuizQuestion(game, currentIndex + 1);
  }

  updateMemoryMatchState(game = this.schoolMicrogame, now = performance.now()) {
    if (Number(game?.data?.lastFlipEndsAt ?? 0) > 0 && now >= Number(game.data.lastFlipEndsAt ?? 0)) {
      game.data.lastFlipEndsAt = 0;
      game.data.lastFlippedCardId = '';
    }

    if (Number(game?.data?.flipBackEndsAt ?? 0) > 0 && now >= Number(game.data.flipBackEndsAt ?? 0)) {
      game.data.flipBackEndsAt = 0;
      game.data.flippingBackCardIds = [];
    }

    if (Number(game?.data?.celebrationEndsAt ?? 0) > 0 && now >= Number(game.data.celebrationEndsAt ?? 0)) {
      game.data.celebrationEndsAt = 0;
      game.data.celebratingCardIds = [];
    }

    if (game?.data?.completing && Number(game.data.completeAt ?? 0) > 0 && now >= Number(game.data.completeAt ?? 0)) {
      void this.finishSchoolMicrogame(true, 'Matched', 'Every card found its partner.');
    }
  }

  advanceJanitorTrashToss(game = this.schoolMicrogame) {
    if (!this.isOfficeJanitorTrashTossGame(game) || game.phase !== 'playing') {
      return;
    }

    const madeThrows = Math.max(0, Math.floor(Number(game.data.madeThrows ?? 0) || 0)) + 1;
    const required = Math.max(1, Math.floor(Number(game.data.requiredThrows ?? game.round.requiredThrows ?? OFFICE_JANITOR_REQUIRED_THROWS) || OFFICE_JANITOR_REQUIRED_THROWS));
    game.data.madeThrows = madeThrows;
    if (madeThrows >= required) {
      void this.finishOfficeJob(true, 'Clean Sweep', 'Three wind-bent paper shots land in the basket.');
      return;
    }

    this.configureJanitorTrashTossShot(game.round, game.data, madeThrows + 1);
    game.message = `Round ${madeThrows + 1}. The throwing lane gets tighter.`;
    this.syncSchoolMicrogameHud();
  }

  updateJanitorMopHeroState(game = this.schoolMicrogame, dt = 0, now = performance.now()) {
    if (!this.isOfficeJanitorMopHeroGame(game) || game.phase !== 'playing') {
      return;
    }

    const pointer = this.input.getPointerPosition();
    const mopPointer = this.hud.getOfficeMopHeroPointerPosition?.(pointer) ?? null;
    if (mopPointer) {
      game.data.mopX = THREE.MathUtils.clamp(Number(mopPointer.x ?? 0.5), 0.04, 0.96);
      game.data.mopY = THREE.MathUtils.clamp(Number(mopPointer.y ?? 0.66), 0.12, 0.9);
      game.data.mopActive = mopPointer.inside === true;
      game.data.mopMoved = game.data.mopMoved === true || mopPointer.inside === true;
    } else {
      game.data.mopActive = false;
    }

    const patches = Array.isArray(game.data.dirtPatches) ? game.data.dirtPatches : [];
    if (!patches.length) {
      this.configureJanitorMopHero(game.round, game.data);
      return;
    }

    const mopCleanShowcaseAt = Number(game.data.mopCleanShowcaseAt ?? 0) || 0;
    if (mopCleanShowcaseAt > 0) {
      for (const patch of patches) {
        patch.clean = 1;
      }
      game.data.cleanProgress = 1;
      game.data.sparklyClean = true;
      game.data.mopActive = false;
      game.message = 'Squeaky clean floor. Enjoy the shine.';
      if (now >= mopCleanShowcaseAt) {
        game.data.mopCleanShowcaseAt = 0;
        void this.finishOfficeJob(true, 'Sparkly Clean', 'The office floor is 100% clean and sparkling.');
        return;
      }
      game.endsAt = Math.max(Number(game.endsAt ?? now) || now, mopCleanShowcaseAt + 80);
      game.remainingMs = Math.max(1, Number(game.endsAt ?? now) - now);
      return;
    }

    if (game.data.mopActive === true) {
      const mopX = Number(game.data.mopX ?? 0.5) || 0.5;
      const mopY = Number(game.data.mopY ?? 0.66) || 0.66;
      for (const patch of patches) {
        const patchX = Number(patch.x ?? 0.5) || 0.5;
        const patchY = Number(patch.y ?? 0.5) || 0.5;
        const patchSize = Number(patch.size ?? 0.14) || 0.14;
        const reach = OFFICE_JANITOR_MOP_BRUSH_RADIUS + patchSize * 0.34;
        const distance = Math.hypot(mopX - patchX, mopY - patchY);
        if (distance > reach) {
          continue;
        }

        const falloff = 1 - (distance / Math.max(0.001, reach));
        const clean = Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0));
        patch.clean = Math.min(1, clean + dt * OFFICE_JANITOR_MOP_CLEAN_RATE * (0.42 + falloff));
      }
    }

    const cleanTotal = patches.reduce((sum, patch) => sum + Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0)), 0);
    const cleanProgress = patches.length > 0 ? cleanTotal / patches.length : 0;
    game.data.cleanProgress = cleanProgress;
    if (cleanProgress >= 0.72 && !game.data.sparkleHinted) {
      game.data.sparkleHinted = true;
      game.message = 'Almost there. Keep sweeping the last brown spots.';
    } else if (game.data.mopMoved !== true) {
      game.message = 'Move your mouse over the dirt to start mopping.';
    } else if (game.data.mopActive === true) {
      const messageBucket = Math.floor(cleanProgress * 10);
      if (messageBucket !== Number(game.data.lastMopMessageBucket ?? -1)) {
        game.data.lastMopMessageBucket = messageBucket;
        game.message = `Mopping ${Math.floor(cleanProgress * 100)}% clean.`;
      }
    }

    if (cleanProgress >= OFFICE_JANITOR_MOP_COMPLETE_PROGRESS) {
      for (const patch of patches) {
        patch.clean = 1;
      }
      game.data.cleanProgress = 1;
      game.data.sparklyClean = true;
      game.data.mopActive = false;
      game.data.mopCleanShowcaseAt = now + OFFICE_JANITOR_MOP_CLEAN_SHOWCASE_MS;
      game.endsAt = Math.max(Number(game.endsAt ?? now) || now, game.data.mopCleanShowcaseAt + 80);
      game.remainingMs = Math.max(1, Number(game.endsAt ?? now) - now);
      game.message = 'Squeaky clean floor. Enjoy the shine.';
    }
  }

  advanceCeoMemo(game = this.schoolMicrogame) {
    if (!this.isOfficeJobGame(game) || game.round?.officeJobId !== OFFICE_JOB_IDS.ceo || game.phase !== 'playing') {
      return;
    }

    const approvedCount = Math.max(0, Number(game.data.approved ?? 0) || 0);
    this.configureCeoMemoStamp(game.round, game.data, approvedCount);
    game.data.memoLabel = this.schoolPick(OFFICE_CEO_MEMOS);
    game.data.stamped = false;
    game.data.stampSuccess = false;
    game.data.stampResolveAt = 0;
    game.data.stampMissSide = '';
    game.message = 'Next memo. Stamp the approval window.';
  }

  updateCeoStampState(game = this.schoolMicrogame, dt = 0, now = performance.now()) {
    if (!this.isOfficeJobGame(game) || game.round?.officeJobId !== OFFICE_JOB_IDS.ceo || game.phase !== 'playing') {
      return;
    }

    if (game.data.stamped) {
      const resolveAt = Number(game.data.stampResolveAt ?? 0) || 0;
      if (resolveAt > 0 && now >= resolveAt) {
        const required = Math.max(1, Math.floor(Number(game.data.requiredApprovals ?? game.round.requiredApprovals ?? 3) || 3));
        if (!game.data.stampSuccess) {
          void this.finishOfficeJob(false, 'Bad Optics', 'The board watched you stamp nonsense outside the window.');
          return;
        }
        if (Number(game.data.approved ?? 0) >= required) {
          void this.finishOfficeJob(true, 'Executive Approval', 'Three ridiculous memos approved with total confidence.');
          return;
        }
        this.advanceCeoMemo(game);
      }
      return;
    }

    const speed = Math.max(0.1, Number(game.data.memoSpeed ?? 0.7) || 0.7);
    const rawPosition = Number(game.data.memoPosition);
    const currentPosition = Number.isFinite(rawPosition) ? rawPosition : OFFICE_CEO_STAMP_LEFT_EXIT;
    const direction = Number(game.data.memoDirection ?? 1) >= 0 ? 1 : -1;
    let nextPosition = currentPosition + speed * direction * dt;

    if (direction > 0 && nextPosition >= OFFICE_CEO_STAMP_RIGHT_EXIT) {
      nextPosition = OFFICE_CEO_STAMP_RIGHT_EXIT;
      game.data.memoDirection = -1;
      game.data.memoTurned = true;
      game.message = 'Return pass. Last chance to stamp this memo.';
    } else if (direction < 0 && nextPosition <= OFFICE_CEO_STAMP_LEFT_EXIT) {
      game.data.memoPosition = OFFICE_CEO_STAMP_LEFT_EXIT;
      void this.finishOfficeJob(false, 'Missed Quarter', 'The stamp left the boardroom unstamped.');
      return;
    } else {
      game.message = direction > 0
        ? 'Stamp the memo when the moving stamp reaches the approval window.'
        : 'Return pass. Last chance to stamp this memo.';
    }

    game.data.memoPosition = nextPosition;
  }

  updatePlayingOfficeJob(dt, now) {
    const game = this.schoolMicrogame;
    if (!this.isOfficeJobGame(game) || game.phase !== 'playing') {
      return;
    }

    const jobId = game.round?.officeJobId;
    if (jobId === OFFICE_JOB_IDS.janitor) {
      if (this.isOfficeJanitorMopHeroGame(game)) {
        this.updateJanitorMopHeroState(game, dt, now);
        return;
      }

      if (game.data.thrown) {
        const resolveAt = Number(game.data.throwResolveAt ?? 0) || 0;
        if (resolveAt > 0 && now >= resolveAt) {
          if (game.data.throwMade) {
            this.advanceJanitorTrashToss(game);
          } else {
            void this.finishOfficeJob(false, 'Rim Disaster', 'The paper ricochets off corporate furniture.');
          }
        }
        return;
      }

      const nextMarker = Number(game.data.marker ?? 0) + Number(game.data.direction ?? 1) * Number(game.data.speed ?? 1) * dt;
      if (nextMarker >= 1) {
        game.data.marker = 1;
        game.data.direction = -1;
      } else if (nextMarker <= 0) {
        game.data.marker = 0;
        game.data.direction = 1;
      } else {
        game.data.marker = nextMarker;
      }
      return;
    }

    if (jobId === OFFICE_JOB_IDS.officeManager) {
      if (this.schoolMicrogameHoldActive && !game.data.released) {
        game.data.brewing = true;
        game.data.fill = Math.min(110, Number(game.data.fill ?? 0) + Number(game.data.fillSpeed ?? 32) * dt);
        if (game.data.fill >= 100) {
          game.data.released = true;
          game.data.brewing = false;
          void this.finishOfficeJob(false, 'Overflow', 'The cup overflows before you stop pouring.');
        }
      } else if (!this.schoolMicrogameHoldActive) {
        game.data.brewing = false;
      }
      return;
    }

    if (jobId === OFFICE_JOB_IDS.ceo) {
      this.updateCeoStampState(game, dt, now);
    }
  }

  updatePlayingSchoolMicrogame(dt, now) {
    const game = this.schoolMicrogame;
    const gameId = game?.round?.gameId;
    if (!game || game.phase !== 'playing') {
      return;
    }

    if (this.isOfficeJobGame(game)) {
      this.updatePlayingOfficeJob(dt, now);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.lockerCombo && game.data.previewActive && now >= Number(game.data.previewEndsAt ?? 0)) {
      game.data.previewActive = false;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.popQuiz) {
      this.updatePopQuizState(game, now);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.teacherLooking) {
      this.updateTeacherLookingState(game, now);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.memoryMatch) {
      this.updateMemoryMatchState(game, now);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.dodgeChalk) {
      game.data.hitCooldownMs = Math.max(0, Number(game.data.hitCooldownMs ?? 0) - dt * 1000);
      game.data.spawnIn = Number(game.data.spawnIn ?? 0) - dt;
      if (game.data.spawnIn <= 0) {
        game.data.chalks.push({
          id: `chalk_${now}_${this.schoolRandomInt(0, 9999)}`,
          lane: this.schoolRandomInt(0, 2),
          x: 100
        });
        game.data.spawnIn = Math.max(0.42, 0.92 - ((game.round.durationMs - game.remainingMs) / game.round.durationMs) * 0.34);
      }
      game.data.chalks = game.data.chalks
        .map((chalk) => ({ ...chalk, x: Number(chalk.x ?? 0) - dt * 72 }))
        .filter((chalk) => chalk.x > -8);

      for (const chalk of game.data.chalks) {
        const inHitZone = chalk.x >= 9 && chalk.x <= 21;
        if (inHitZone && chalk.lane === game.data.playerLane && game.data.hitCooldownMs <= 0) {
          game.data.lives = Math.max(0, Number(game.data.lives ?? 0) - 1);
          game.data.hitCooldownMs = 620;
          this.playSoundEffect(this.playingCardSound);
          if (game.data.lives <= 0) {
            void this.finishSchoolMicrogame(false, 'Chalked', 'Direct hit. The board wins.');
          }
          break;
        }
      }
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.bellSprint && !game.data.stopped) {
      const nextMarker = Number(game.data.marker ?? 0) + Number(game.data.direction ?? 1) * Number(game.data.speed ?? 1) * dt;
      if (nextMarker >= 1) {
        game.data.marker = 1;
        game.data.direction = -1;
      } else if (nextMarker <= 0) {
        game.data.marker = 0;
        game.data.direction = 1;
      } else {
        game.data.marker = nextMarker;
      }
    }

  }

  resolveRotatedOffsetPosition(originPosition, rotationQuarterTurns = 0, offset = [0, 0]) {
    const [offsetX, offsetZ] = cloneOffset(offset);
    const rotatedOffset = rotateFootprintOffset(offsetX, offsetZ, rotationQuarterTurns);
    return new THREE.Vector3(
      (originPosition?.x ?? 0) + rotatedOffset.x,
      this.player?.position?.y ?? 0,
      (originPosition?.z ?? 0) + rotatedOffset.z
    );
  }

  enterInterior(interactable) {
    const interiorId = interactable?.interior?.id ?? '';
    const interiorScene = this.getOrCreateInteriorScene(interiorId);
    if (!interiorScene || !this.player) {
      return false;
    }

    this.finishWorkout({ cancelled: true });
    if (this.currentInterior?.scene) {
      this.currentInterior.scene.setInteractableIndicatorsVisible?.(false);
      this.currentInterior.scene.setVisible(false);
    }

    this.deactivateInlineShell();

    const exteriorReturnPosition = this.resolveRotatedOffsetPosition(
      interactable.originPosition,
      interactable.rotationQuarterTurns,
      interactable.interior?.exteriorSpawnOffset ?? [0, 0]
    );

    this.currentInterior = {
      scene: interiorScene,
      returnPosition: exteriorReturnPosition
    };
    this.currentInterior.scene.setInteractableIndicatorsVisible?.(true);
    this.currentInterior.scene.setVisible(true);
    this.setOutdoorSceneVisible(false);
    this.player.position.copy(interiorScene.spawnPoint);
    this.player.position.y = this.getActiveGroundHeightAt(this.player.position);
    this.resetLocalPlayerKinematics(this.player.position);
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    this.hud.showToast(`Entered ${interiorScene.label}.`);
    return true;
  }

  exitInterior({ showToast = true } = {}) {
    if (!this.currentInterior?.scene || !this.player) {
      return false;
    }

    this.finishWorkout({ cancelled: true });
    const { scene, returnPosition } = this.currentInterior;
    scene.setInteractableIndicatorsVisible?.(false);
    scene.setVisible(false);
    this.currentInterior = null;
    this.setOutdoorSceneVisible(true);
    if (returnPosition) {
      this.player.position.copy(returnPosition);
      this.player.position.y = this.getActiveGroundHeightAt(this.player.position);
      this.resetLocalPlayerKinematics(this.player.position);
    }
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    if (showToast) {
      this.hud.showToast('Back outside.');
    }
    return true;
  }

  syncWorkoutState() {
    if (!this.worldBuilder) {
      return;
    }

    this.worldBuilder.setPlayerWorkoutState(this.npcServiceState.players ?? new Map(), {
      pendingPlacementId: this.pendingWorkoutPlacementId,
      claimedPlacementId: this.claimedWorkoutPlacementId,
      activePlacementId: this.activeWorkoutPlacementId
    });
  }

  releaseWorkoutPlacement(placementId = '') {
    const normalizedPlacementId = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalizedPlacementId || !this.npcService?.releaseWorkoutPlacement) {
      return;
    }

    void this.npcService.releaseWorkoutPlacement(normalizedPlacementId).catch(() => {});
  }

  completeWorkoutPlacement(placementId = '') {
    const normalizedPlacementId = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalizedPlacementId) {
      return;
    }

    if (!this.npcService?.completeWorkoutPlacement) {
      this.releaseWorkoutPlacement(normalizedPlacementId);
      return;
    }

    void this.npcService.completeWorkoutPlacement(normalizedPlacementId)
      .then((result) => {
        if (!result?.ok) {
          this.releaseWorkoutPlacement(normalizedPlacementId);
          return;
        }
        this.presentSkillAwardsFromResult(result);
      })
      .catch(() => {
        this.releaseWorkoutPlacement(normalizedPlacementId);
      });
  }

  async startWorkout(interactable) {
    const activityConfig = getWorkoutActivityConfig(interactable);
    if (
      !this.player
      || !interactable
      || !activityConfig
      || this.activeWorkout
      || this.pendingWorkoutPlacementId
      || this.claimedWorkoutPlacementId
    ) {
      return false;
    }

    if (interactable.busy) {
      this.hud.showToast(activityConfig.busyToast);
      return false;
    }

    const placementId = typeof interactable.placementId === 'string'
      ? interactable.placementId
      : '';
    if (!placementId || !this.npcService?.claimWorkoutPlacement) {
      return false;
    }

    this.pendingWorkoutPlacementId = placementId;
    this.syncWorkoutState();
    let claimResult = null;
    try {
      claimResult = await this.npcService.claimWorkoutPlacement(placementId);
    } catch (error) {
      this.pendingWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.hud.showToast(error?.message || activityConfig.unavailableToast);
      return false;
    }
    if (!claimResult?.ok) {
      this.pendingWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.hud.showToast(claimResult?.error ?? activityConfig.busyToast);
      return false;
    }

    this.pendingWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = placementId;
    this.syncWorkoutState();

    if (!this.player || this.getLocalPlayerState()?.alive === false) {
      this.claimedWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.releaseWorkoutPlacement(placementId);
      return false;
    }

    if (activityConfig.emoteId) {
      void preloadMixamoClips([activityConfig.emoteId]);
    }
    this.clearPendingHipFireShot();
    this.currentAimMode = false;
    this.player.setAimingState(false);
    this.player.stopEmote?.();
    this.activeWorkout = {
      kind: interactable.kind,
      phase: 'approach',
      interactable,
      activityConfig,
      carriedBarbell: null,
      endsAt: 0
    };
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    return true;
  }

  beginWorkoutActivity() {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    const { activityConfig = getWorkoutActivityConfig(this.activeWorkout), interactable } = this.activeWorkout;
    if (!activityConfig) {
      return false;
    }

    let carriedBarbell = null;
    if (activityConfig.attachBarbell) {
      carriedBarbell = createOlympicBarbellVisual({ origin: 'center' });
      this.scene.add(carriedBarbell);
    }

    this.activeWorkout.phase = activityConfig.activePhase;
    this.activeWorkout.carriedBarbell = carriedBarbell;
    this.activeWorkout.endsAt = performance.now() + activityConfig.durationMs;
    this.activeWorkoutPlacementId = interactable?.placementId ?? '';
    this.syncWorkoutState();
    this.player.setFacing(interactable?.approachRotationY ?? this.player.object.rotation.y);
    this.player.setAimRotation(interactable?.approachRotationY ?? this.player.object.rotation.y);
    this.player.stopEmote?.();
    if (activityConfig.emoteId && activityConfig.playEmoteOnBegin !== false) {
      this.player.playEmote(activityConfig.emoteId);
    }
    if (activityConfig.playTypingSound) {
      this.playSoundEffect(this.typingOnKeyboardSound);
    }
    if (activityConfig.kind === SNATCH_WORKOUT_KIND && this.taskTracker.currentTaskId === TASK_IDS.gymPump && !this.gymPumpTaskConfettiPlayed) {
      this.gymPumpTaskConfettiPlayed = true;
      this.hud.playTaskConfetti();
    }
    this.syncWorkoutBarbell();
    if (activityConfig.basketballShot) {
      this.beginBasketballShotActivity();
    }
    return true;
  }

  beginBasketballShotActivity() {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    const ball = createBasketballShotBall();
    this.scene.add(ball);
    const now = performance.now();
    const rimPosition = this.getBasketballShotRimPosition(
      this.activeWorkout.interactable,
      this.basketballShotRimPosition
    );
    this.activeWorkout.basketballShot = {
      ball,
      startedAt: now,
      phase: 'playing',
      progress: 0,
      released: false,
      release: 'set',
      releaseProgress: 0,
      made: null,
      score: 0,
      message: 'Release at the top of the meter.',
      releaseAt: 0,
      resolveAt: 0,
      shotStart: new THREE.Vector3(),
      shotControl: new THREE.Vector3(),
      shotEnd: new THREE.Vector3(),
      rimPosition: rimPosition.clone()
    };
    this.syncBasketballShotBall(now);
    this.updateBasketballShotHud();
    this.updateBasketballShotCamera({ snap: true });
    return true;
  }

  getBasketballShotRimPosition(interactable = this.activeWorkout?.interactable, target = this.basketballShotRimPosition) {
    const origin = interactable?.originPosition ?? interactable?.position ?? this.player?.position;
    const rotatedOffset = rotateFootprintOffset(
      0,
      BASKETBALL_SHOT_RIM_LOCAL_Z,
      interactable?.rotationQuarterTurns ?? 0
    );
    target.set(
      (origin?.x ?? 0) + rotatedOffset.x,
      (origin?.y ?? 0) + BASKETBALL_SHOT_RIM_WORLD_HEIGHT,
      (origin?.z ?? 0) + rotatedOffset.z
    );
    return target;
  }

  getBasketballShotForward(target = this.basketballShotForward) {
    const shot = this.activeWorkout?.basketballShot;
    if (shot?.rimPosition && this.player) {
      target.subVectors(shot.rimPosition, this.player.position);
      target.y = 0;
    } else {
      const facing = this.player?.object?.rotation?.y ?? 0;
      target.set(Math.sin(facing), 0, Math.cos(facing));
    }

    if (target.lengthSq() <= 0.0001) {
      const facing = this.player?.object?.rotation?.y ?? 0;
      target.set(Math.sin(facing), 0, Math.cos(facing));
    }
    return target.normalize();
  }

  getBasketballShotSide(target = this.basketballShotSide) {
    const forward = this.getBasketballShotForward(this.basketballShotForward);
    target.set(forward.z, 0, -forward.x);
    if (target.lengthSq() <= 0.0001) {
      target.set(1, 0, 0);
    }
    return target.normalize();
  }

  syncBasketballShotBall(now = performance.now()) {
    const shot = this.activeWorkout?.basketballShot;
    if (!shot?.ball || !this.player || shot.released) {
      return;
    }

    const forward = this.getBasketballShotForward(this.basketballShotForward);
    const side = this.getBasketballShotSide(this.basketballShotSide);
    const leftHand = this.player.sockets?.handLeft;
    const rightHand = this.player.sockets?.handRight;
    if (leftHand && rightHand) {
      leftHand.getWorldPosition(this.workoutLeftHandPosition);
      rightHand.getWorldPosition(this.workoutRightHandPosition);
      this.basketballShotHandPosition
        .copy(this.workoutLeftHandPosition)
        .add(this.workoutRightHandPosition)
        .multiplyScalar(0.5)
        .addScaledVector(forward, 0.12);
    } else if (rightHand) {
      rightHand.getWorldPosition(this.basketballShotHandPosition);
      this.basketballShotHandPosition.addScaledVector(forward, 0.12);
    } else {
      this.basketballShotHandPosition
        .copy(this.player.position)
        .addScaledVector(forward, 0.48)
        .addScaledVector(side, 0.08);
      this.basketballShotHandPosition.y += 1.58;
    }

    shot.ball.position.copy(this.basketballShotHandPosition);
    shot.ball.rotation.set(now * 0.004, now * 0.0025, now * 0.0016);
  }

  getBasketballShotProgress(shot = this.activeWorkout?.basketballShot, now = performance.now()) {
    if (!shot || shot.released) {
      return Math.max(0, Math.min(1, Number(shot?.releaseProgress ?? shot?.progress ?? 0) || 0));
    }

    const elapsed = Math.max(0, now - Number(shot.startedAt ?? now));
    const cycle = (elapsed % (BASKETBALL_SHOT_SWEEP_MS * 2)) / BASKETBALL_SHOT_SWEEP_MS;
    return cycle <= 1 ? cycle : 2 - cycle;
  }

  evaluateBasketballShotRelease(progress = 0.5, { forced = false } = {}) {
    const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
    const offset = clamped - 0.5;
    const error = Math.abs(offset);
    const clean = !forced && error <= BASKETBALL_SHOT_CLEAN_WINDOW;
    const great = !clean && !forced && error <= BASKETBALL_SHOT_GREAT_WINDOW;
    const score = Math.max(0, Math.min(100, Math.round(100 - (error * 190))));
    return {
      made: clean,
      release: clean ? 'clean' : great ? 'great' : offset < 0 ? 'early' : 'late',
      score,
      offset
    };
  }

  releaseBasketballShot({ forced = false } = {}) {
    const shot = this.activeWorkout?.basketballShot;
    if (!shot || shot.released) {
      return false;
    }

    const now = performance.now();
    const progress = forced ? 1 : this.getBasketballShotProgress(shot, now);
    const result = this.evaluateBasketballShotRelease(progress, { forced });
    const rimPosition = this.getBasketballShotRimPosition(
      this.activeWorkout.interactable,
      this.basketballShotRimPosition
    );
    shot.rimPosition.copy(rimPosition);
    shot.released = true;
    shot.phase = 'result';
    shot.releaseAt = now;
    shot.releaseProgress = progress;
    shot.progress = progress;
    shot.made = result.made;
    shot.release = result.release;
    shot.score = result.score;
    shot.message = result.made ? 'Green release. Shot made.' : 'Rimmed out.';
    shot.resolveAt = now + BASKETBALL_SHOT_FLIGHT_MS + BASKETBALL_SHOT_RESULT_HOLD_MS;
    shot.shotStart.copy(shot.ball.position);
    shot.shotEnd.copy(rimPosition);

    const forward = this.getBasketballShotForward(this.basketballShotForward);
    const side = this.getBasketballShotSide(this.basketballShotSide);
    if (result.made) {
      shot.shotEnd.y -= 0.18;
    } else {
      const missSide = result.offset < 0 ? -1 : 1;
      shot.shotEnd
        .addScaledVector(side, missSide * 0.88)
        .addScaledVector(forward, -0.24);
      shot.shotEnd.y += 0.18;
    }

    shot.shotControl
      .copy(shot.shotStart)
      .add(shot.shotEnd)
      .multiplyScalar(0.5);
    shot.shotControl.y = Math.max(shot.shotStart.y, shot.shotEnd.y) + (result.made ? 2.7 : 2.25);

    this.player?.playEmote?.(PUNCH_EMOTE_ID);
    this.updateBasketballShotHud();
    return true;
  }

  updateBasketballShotBallFlight(now = performance.now()) {
    const shot = this.activeWorkout?.basketballShot;
    if (!shot?.ball || !shot.released) {
      return;
    }

    const t = Math.max(0, Math.min(1, (now - shot.releaseAt) / BASKETBALL_SHOT_FLIGHT_MS));
    const oneMinusT = 1 - t;
    shot.ball.position.set(
      (oneMinusT * oneMinusT * shot.shotStart.x) + (2 * oneMinusT * t * shot.shotControl.x) + (t * t * shot.shotEnd.x),
      (oneMinusT * oneMinusT * shot.shotStart.y) + (2 * oneMinusT * t * shot.shotControl.y) + (t * t * shot.shotEnd.y),
      (oneMinusT * oneMinusT * shot.shotStart.z) + (2 * oneMinusT * t * shot.shotControl.z) + (t * t * shot.shotEnd.z)
    );

    if (t >= 1) {
      const settle = Math.max(0, Math.min(1, (now - shot.releaseAt - BASKETBALL_SHOT_FLIGHT_MS) / BASKETBALL_SHOT_RESULT_HOLD_MS));
      shot.ball.position.y += shot.made ? -0.55 * settle : -1.4 * settle * settle;
    }

    shot.ball.rotation.x += 0.18;
    shot.ball.rotation.y += shot.made ? 0.08 : 0.16;
  }

  updateBasketballShotHud() {
    const shot = this.activeWorkout?.basketballShot;
    if (!shot) {
      this.hud.setBasketballShotState({ visible: false, game: null });
      return;
    }

    this.hud.setBasketballShotState({
      visible: true,
      game: {
        phase: shot.released ? 'result' : 'playing',
        progress: shot.released ? shot.releaseProgress : shot.progress,
        released: shot.released,
        made: shot.released ? shot.made : null,
        release: shot.release,
        score: shot.score,
        message: shot.message
      }
    });
  }

  handleBasketballShotAction(action = '') {
    if (action === 'release') {
      this.releaseBasketballShot();
    }
  }

  updateBasketballShotCamera({ snap = false } = {}) {
    if (!this.player) {
      return;
    }

    const shot = this.activeWorkout?.basketballShot;
    const rimPosition = shot?.rimPosition
      ? this.basketballShotRimPosition.copy(shot.rimPosition)
      : this.getBasketballShotRimPosition(this.activeWorkout?.interactable, this.basketballShotRimPosition);
    const forward = this.getBasketballShotForward(this.basketballShotForward);
    const side = this.getBasketballShotSide(this.basketballShotSide);
    const targetPosition = this.cameraTargetPosition
      .copy(this.player.position)
      .addScaledVector(forward, -5.2)
      .addScaledVector(side, 2.05);
    targetPosition.y += 2.85;

    const lookTarget = this.cameraLookTarget
      .copy(this.player.position);
    lookTarget.y += 1.42;
    lookTarget.lerp(rimPosition, 0.46);

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, BASKETBALL_SHOT_CAMERA_SMOOTHING);
    }
    this.camera.lookAt(lookTarget);
  }

  updateBasketballShotWorkout(deltaSeconds, { colliders, sceneBounds, groundHeight } = {}) {
    const shot = this.activeWorkout?.basketballShot;
    if (!shot || !this.player) {
      return true;
    }

    const now = performance.now();
    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight,
      { speedScale: 0 }
    );

    if (!shot.released) {
      shot.progress = this.getBasketballShotProgress(shot, now);
      this.syncBasketballShotBall(now);
      if (
        this.input.consumeAction('interact')
        || this.input.consumeAction('fire')
        || this.input.consume('Space')
        || this.input.consume('Enter')
      ) {
        this.releaseBasketballShot();
      } else if (now >= this.activeWorkout.endsAt) {
        this.releaseBasketballShot({ forced: true });
      }
      this.updateBasketballShotHud();
      return true;
    }

    this.updateBasketballShotBallFlight(now);
    this.updateBasketballShotHud();
    if (now >= shot.resolveAt) {
      if (shot.made) {
        this.finishWorkout();
      } else {
        this.hud.showToast('Shot missed. No XP awarded.');
        this.finishWorkout({ cancelled: true });
      }
    }
    return true;
  }

  syncWorkoutBarbell() {
    if (!this.activeWorkout?.carriedBarbell || !this.player?.sockets) {
      return;
    }

    const leftHand = this.player.sockets.handLeft;
    const rightHand = this.player.sockets.handRight;
    if (!leftHand || !rightHand) {
      return;
    }

    leftHand.getWorldPosition(this.workoutLeftHandPosition);
    rightHand.getWorldPosition(this.workoutRightHandPosition);
    this.workoutBarbellMidpoint
      .copy(this.workoutLeftHandPosition)
      .add(this.workoutRightHandPosition)
      .multiplyScalar(0.5);
    this.workoutBarbellAxis
      .subVectors(this.workoutRightHandPosition, this.workoutLeftHandPosition)
      .setY(0);

    if (this.workoutBarbellAxis.lengthSq() <= 0.0001) {
      const facing = this.player.object.rotation.y;
      this.workoutBarbellAxis.set(Math.cos(facing), 0, -Math.sin(facing));
    } else {
      this.workoutBarbellAxis.normalize();
    }

    this.workoutForward.set(
      Math.sin(this.player.object.rotation.y),
      0,
      Math.cos(this.player.object.rotation.y)
    );
    this.activeWorkout.carriedBarbell.position
      .copy(this.workoutBarbellMidpoint)
      .addScaledVector(this.workoutForward, 0.08);
    this.workoutBarbellQuaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      this.workoutBarbellAxis
    );
    this.activeWorkout.carriedBarbell.quaternion.copy(this.workoutBarbellQuaternion);
  }

  finishWorkout({ cancelled = false } = {}) {
    if (!this.activeWorkout) {
      return false;
    }

    const workout = this.activeWorkout;
    const placementId = workout.interactable?.placementId
      ?? this.activeWorkoutPlacementId
      ?? this.claimedWorkoutPlacementId
      ?? '';
    this.activeWorkout = null;
    this.activeWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = '';
    if (this.pendingWorkoutPlacementId === placementId) {
      this.pendingWorkoutPlacementId = '';
    }
    this.syncWorkoutState();
    if (cancelled || workout.activityConfig?.stopEmoteOnFinish) {
      this.player?.stopEmote?.();
    }
    if (workout.carriedBarbell) {
      workout.carriedBarbell.parent?.remove(workout.carriedBarbell);
      disposeObjectResources(workout.carriedBarbell);
    }
    if (workout.basketballShot?.ball) {
      workout.basketballShot.ball.parent?.remove(workout.basketballShot.ball);
      disposeObjectResources(workout.basketballShot.ball);
    }
    if (workout.activityConfig?.basketballShot) {
      this.hud.setBasketballShotState({ visible: false, game: null });
    }
    if (placementId) {
      if (cancelled) {
        this.releaseWorkoutPlacement(placementId);
      } else {
        this.completeWorkoutPlacement(placementId);
      }
    }
    if (!cancelled) {
      this.hud.showToast(workout.activityConfig?.completeToast ?? 'Workout complete.');
    }
    return true;
  }

  updateActiveWorkout(deltaSeconds, { localAlive, colliders, sceneBounds, groundHeight } = {}) {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    if (localAlive === false) {
      this.finishWorkout({ cancelled: true });
      return false;
    }

    this.player.setAimingState(false);
    const activityConfig = this.activeWorkout.activityConfig ?? getWorkoutActivityConfig(this.activeWorkout);

    if (this.activeWorkout.phase === 'approach') {
      const movement = this.player.moveToward(
        this.activeWorkout.interactable.approachPosition,
        deltaSeconds,
        colliders,
        sceneBounds,
        groundHeight,
        {
          speedScale: 0.82,
          stopDistance: activityConfig?.stopDistance ?? SNATCH_APPROACH_STOP_DISTANCE
        }
      );
      if (movement.arrived) {
        this.player.position.copy(this.activeWorkout.interactable.approachPosition);
        this.player.position.y = groundHeight;
        this.player.setFacing(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
        this.player.setAimRotation(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
        this.resetLocalPlayerKinematics(this.player.position);
        this.beginWorkoutActivity();
      }
      return true;
    }

    this.player.setFacing(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
    this.player.setAimRotation(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
    if (activityConfig?.basketballShot) {
      return this.updateBasketballShotWorkout(deltaSeconds, {
        colliders,
        sceneBounds,
        groundHeight
      });
    }

    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight
    );
    this.syncWorkoutBarbell();

    if (performance.now() >= this.activeWorkout.endsAt) {
      this.finishWorkout();
    }

    return true;
  }

  async start() {
    try {
      this.markBoot('boot:start');
      this.setBootLoadingProgress(0.05);
      console.info('[Game] Starting game bootstrap.');
      this.setupLights();
      this.setupAtmosphere();
      this.setBootLoadingProgress(0.12);
      this.markBoot('boot:npc-service:start');
      const npcServicePromise = createNpcService();

      const cityState = await buildCity(this.scene);
      this.setBootLoadingProgress(0.24);
      console.info('[Game] City built.', {
        colliderCount: cityState.colliders?.length ?? 0,
        interactableCount: cityState.interactables?.length ?? 0
      });
      this.cityVisualRoot = cityState.root ?? null;
      this.baseColliders = cityState.colliders;
      this.staticInteractables = cityState.interactables;
      this.cityBounds = cityState.cityBounds;
      this.npcService = await npcServicePromise;
      this.setBootLoadingProgress(0.36);
      this.markBoot('boot:npc-service:end');
      this.measureBoot('npcServiceReady', 'boot:npc-service:start', 'boot:npc-service:end');
      console.info('[Game] NPC service ready.', {
        transport: this.npcService?.getState?.()?.transport ?? 'unknown'
      });
      this.combatEventUnsubscribe = this.npcService.subscribeCombatEvents((event) => {
        this.handleCombatEvent(event);
      });
      this.worldPatchUnsubscribe = this.npcService.subscribeWorldPatches((patch) => {
        this.pendingWorldPatches.push(patch);
        if (this.bootCriticalReady) {
          this.requestDeferredSceneSync({ worldPatches: true });
        }
      });

      this.worldBuilder = new WorldBuilder({
        scene: this.scene,
        camera: this.camera,
        domElement: this.renderer.domElement,
        library: this.library,
        hud: this.hud,
        worldTransport: this.npcService,
        onToggleBuildMode: () => this.toggleBuildMode(),
        onLayoutChanged: (layout) => {
          this.currentLayout = layout;
          this.syncVibeRadioTracksFromLayout(layout);
          this.gymDoorBlockersDirty = true;
        }
      });
      this.refreshZoomHud();

      this.npcService.subscribe((state) => {
        this.npcServiceState = state;
        this.reportNpcTransportState();
        this.refreshConnectionHud();
        this.syncPreferredCharacterSelection();
        this.syncAdminAccess();
        this.registerHeldItemDebugTools();
        this.applyNpcRuntimeState();
        this.worldBuilder?.setRemoteBuilders(state.builders, state.sessionId);
        if (this.bootCriticalReady) {
          this.requestDeferredSceneSync({
            pickups: true,
            remotePlayers: true
          });
        }
        this.refreshCharacterSelectorHud();
        this.refreshPhoneAppHud(this.getLocalPlayerState());
      });

      this.markBoot('boot:layout:start');
      const sharedLayout = await this.npcService.getWorldLayout();
      this.setBootLoadingProgress(0.5);
      this.markBoot('boot:layout:end');
      this.measureBoot('worldLayoutReady', 'boot:layout:start', 'boot:layout:end');
      console.info('[Game] Shared world layout loaded.', {
        tiles: sharedLayout.tiles?.length ?? 0,
        props: sharedLayout.props?.length ?? 0,
        npcs: sharedLayout.npcs?.length ?? 0
      });
      this.currentLayout = sharedLayout;
      this.syncVibeRadioTracksFromLayout(sharedLayout);
      this.gymDoorBlockersDirty = true;
      this.markBoot('boot:avatar:start');
      const avatarPromise = this.buildAvatar(this.desiredLocalCharacterId)
        .then((avatar) => ({ avatar }), (error) => ({ error }));
      await this.worldBuilder.loadLayout(sharedLayout);
      this.worldLayoutReady = true;
      this.setBootLoadingProgress(0.72);

      const avatarResult = await avatarPromise;
      if (avatarResult.error) {
        throw avatarResult.error;
      }
      this.player = avatarResult.avatar;
      this.setBootLoadingProgress(0.88);
      this.markBoot('boot:avatar:end');
      this.measureBoot('localAvatarReady', 'boot:avatar:start', 'boot:avatar:end');
      console.info('[Game] Local player loaded.');
      const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
      const fallbackSpawnPoint = cityState.spawnPoint.clone();
      if (localPlayerState) {
        this.player.position.set(localPlayerState.x, 0, localPlayerState.z);
      } else {
        this.player.position.copy(fallbackSpawnPoint);
      }
      const portalSpawnApplied = this.applyInitialPortalSpawn(fallbackSpawnPoint);
      this.player.position.y = this.getActiveGroundHeightAt(this.player.position) ?? fallbackSpawnPoint.y;
      this.scene.add(this.player.object);
      const aimPoseDebugHelper = this.player.getAimPoseDebugHelper?.();
      if (aimPoseDebugHelper) {
        this.scene.add(aimPoseDebugHelper);
      }
      this.syncAdminAccess();
      this.registerHeldItemDebugTools();
      this.player.setAimPoseDebugVisible(this.canUseAimPoseDebug() && this.aimPoseDebugShowSkeleton);
      this.refreshAimPoseDebugHud();
      if (localPlayerState) {
        const localAlive = localPlayerState.alive !== false;
        this.player.setAliveState(localAlive, {
          startedAtMs: Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
            ? localPlayerState.lastDamagedAt
            : Date.now()
        });
        await this.player.setWeaponState(
          localAlive ? localPlayerState.equippedWeaponId : '',
          { visible: localAlive && Boolean(localPlayerState.equippedWeaponId) }
        );
        this.player.setReloadState(Boolean(localAlive && localPlayerState.isReloading), {
          weaponId: localAlive ? localPlayerState.equippedWeaponId : '',
          endsAtMs: localPlayerState.reloadEndsAt ?? 0
        });
      }
      this.applyHotbarSelection({ force: true });
      if (portalSpawnApplied) {
        this.player.setAimingState(false);
        this.updateCamera(this.currentAimDirection, false, { snap: true });
      } else {
        this.syncInitialCameraState(localPlayerState);
      }
      this.resetLocalPlayerKinematics(this.player.position);
      this.enableDetailedRendering();
      this.setBootLoadingProgress(0.96, {
        render: true
      });
      this.bootCriticalReady = true;

      if (this.npcServiceState.transport === 'colyseus') {
        this.hud.showToast('Connected to the multiplayer room. Shared building, world chat, NPC replies, and player presence are live.');
      } else {
        this.hud.showToast('Running local mock multiplayer. World chat and NPC replies work locally without Colyseus.');
      }

      console.info('[Game] Entering render loop.');
      this.renderer.setAnimationLoop(() => this.frame());
      void this.scheduleDeferredStartup();
      await this.warmBootPreviewFrames({
        frames: 5,
        minDurationMs: 220
      });
      this.markBoot('boot:loading-hide');
      this.setBootLoadingProgress(1, {
        render: true
      });
      this.hud.hideLoading();
      this.startReleaseVersionPolling();
      this.queueCharacterPreviewWarmup();
      this.rentIntroLoadingClearedAt = performance.now() + RENT_INTRO_LOADING_CLEAR_MS;
      this.measureBoot('loadingOverlayHidden', 'boot:start', 'boot:loading-hide');
    } catch (error) {
      console.error('[Game] Failed during bootstrap.', error);
      this.hud.showToast('Failed to load part of the city. Check the console for details.');
      throw error;
    }
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xd8efff, 0x35503d, 1.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0cf, 2.6);
    this.sunLight.position.set(45, 70, 30);
    this.sunLight.castShadow = this.detailedRenderingEnabled;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.right = WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.top = WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.bottom = -WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = WORLD_GROUND_RADIUS + 40;
    this.scene.add(this.sunLight);

    this.inlineInteriorLight = new THREE.PointLight(0xfff6ea, 7.5, 30, 2);
    this.inlineInteriorLight.castShadow = false;
    this.inlineInteriorLight.visible = false;
    this.scene.add(this.inlineInteriorLight);
  }

  setupAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(WORLD_GROUND_RADIUS + 60, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x95bfde, side: THREE.BackSide })
    );
    sky.position.y = 30;
    this.scene.add(sky);
  }

  enableDetailedRendering() {
    if (this.detailedRenderingEnabled) {
      return;
    }

    this.detailedRenderingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    if (this.sunLight) {
      this.sunLight.castShadow = true;
    }
    this.setupPostProcessing();
    this.onResize();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setPixelRatio(this.getTargetPixelRatio());
    this.composer?.setSize(window.innerWidth, window.innerHeight);
    this.updatePostProcessingResolution();
  }

  registerMinigameDebugTools() {
    if (!isLocalDebugHost()) {
      return;
    }

    globalThis.__stickRpgMinigameDebug = {
      open: (minigameId = 'blackjack') => this.openDebugMinigameHud(minigameId),
      openBlackjack: () => this.openDebugMinigameHud('blackjack'),
      openSchool: (minigameId = SCHOOL_MICROGAME_DEFAULT_ID) => this.openDebugSchoolMicrogame(minigameId),
      schoolAction: (action = '') => this.handleSchoolMicrogameAction(action),
      schoolState: () => this.getSchoolMicrogameDebugState(),
      schoolTeacherPreview: () => ({
        active: this.schoolTeacherPreviewRenderer?.active === true,
        mode: this.schoolTeacherPreviewRenderer?.state?.teacherMode ?? '',
        yaw: Number.isFinite(this.schoolTeacherPreviewRenderer?.teacherYaw)
          ? this.schoolTeacherPreviewRenderer.teacherYaw
          : null,
        targetYaw: Number.isFinite(this.schoolTeacherPreviewRenderer?.resolveTeacherYaw?.())
          ? this.schoolTeacherPreviewRenderer.resolveTeacherYaw()
          : null
      }),
      schoolGames: () => listSchoolMicrogames().map((game) => game.id)
    };
    globalThis.openMinigameHud = (...args) => globalThis.__stickRpgMinigameDebug.open(...args);
    globalThis.openBlackjackHud = () => globalThis.__stickRpgMinigameDebug.openBlackjack();
    globalThis.openSchoolMicrogameHud = (...args) => globalThis.__stickRpgMinigameDebug.openSchool(...args);
    this.maybeOpenRequestedDebugMinigame();
  }

  registerHeldItemDebugTools() {
    this.registerMinigameDebugTools();

    if (!this.player) {
      return;
    }

    const localDebugHost = isLocalDebugHost();
    const adminAimPoseDebug = this.canUseAimPoseDebug();
    const getActiveItemId = () => this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
    const clampVector = (values, fallback = [0, 0, 0]) => [0, 1, 2].map((index) => Number(values?.[index] ?? fallback[index] ?? 0));
    if (localDebugHost) {
      const printGrip = (itemId = getActiveItemId()) => {
        const profile = this.player.getHeldItemGripProfile(itemId);
        if (!profile) {
          console.info('[HeldItemDebug] No grip profile found.', { itemId });
          return null;
        }

        const printable = {
          id: itemId,
          gripOffset: {
            position: profile.position.map((value) => Number(value.toFixed(4))),
            rotation: profile.rotation.map((value) => Number(value.toFixed(4))),
            scale: profile.scale.map((value) => Number(value.toFixed(4)))
          }
        };
        console.info('[HeldItemDebug] Current grip profile.', printable);
        return printable;
      };

      const cloneDebugValue = (value) => {
        if (typeof structuredClone === 'function') {
          return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
      };

      const roundDebugValue = (value) => {
        if (Array.isArray(value)) {
          return value.map((entry) => roundDebugValue(entry));
        }

        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, roundDebugValue(entry)])
          );
        }

        return Number.isFinite(value) ? Number(value.toFixed(4)) : value;
      };

      const printReload = (itemId = getActiveItemId()) => {
        const profile = this.player.getHeldItemReloadProfile?.(itemId);
        if (!profile) {
          console.info('[ReloadDebug] No reload profile found.', { itemId });
          return null;
        }

        const printable = {
          id: itemId,
          reloadProfile: roundDebugValue(profile)
        };
        console.info('[ReloadDebug] Current reload profile.', printable);
        return printable;
      };

      const updateReloadProfile = (mutator, itemId = getActiveItemId()) => {
        const current = this.player.getHeldItemReloadProfile?.(itemId);
        if (!current) {
          console.info('[ReloadDebug] No reload profile found.', { itemId });
          return null;
        }

        const nextProfile = cloneDebugValue(current);
        mutator(nextProfile);
        const applied = this.player.setHeldItemReloadProfileOverride?.(itemId, nextProfile) ?? null;
        console.info('[ReloadDebug] Updated reload profile.', {
          itemId,
          reloadProfile: roundDebugValue(applied)
        });
        return applied;
      };

      globalThis.__stickRpgHeldItemDebug = {
        items: listHeldItemDefinitions().map((definition) => definition.id),
        printGrip,
        nudgePosition: (deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) => {
          const next = this.player.nudgeHeldItemGripOverride(itemId, {
            position: clampVector([deltaX, deltaY, deltaZ]),
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
          });
          console.info('[HeldItemDebug] Nudged grip position.', { itemId, gripOffset: next });
          return next;
        },
        nudgeRotation: (deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) => {
          const next = this.player.nudgeHeldItemGripOverride(itemId, {
            position: [0, 0, 0],
            rotation: clampVector([deltaX, deltaY, deltaZ]),
            scale: [1, 1, 1]
          });
          console.info('[HeldItemDebug] Nudged grip rotation.', { itemId, gripOffset: next });
          return next;
        },
        scaleBy: (scaleX = 1, scaleY = scaleX, scaleZ = scaleX, itemId = getActiveItemId()) => {
          const next = this.player.nudgeHeldItemGripOverride(itemId, {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: clampVector([scaleX, scaleY, scaleZ], [1, 1, 1])
          });
          console.info('[HeldItemDebug] Adjusted grip scale.', { itemId, gripOffset: next });
          return next;
        },
        reset: (itemId = getActiveItemId()) => {
          this.player.clearHeldItemGripOverride(itemId);
          return printGrip(itemId);
        },
        printReload,
        previewReload: (itemId = getActiveItemId(), durationMs = 1200) => {
          const previewed = this.player.previewReload?.(itemId, durationMs) === true;
          if (previewed && itemId === HELD_ITEM_IDS.pistol) {
            this.playSoundEffect(this.pistolCockSound);
          }
          return previewed;
        },
        stopReloadPreview: () => this.player.stopReloadPreview?.(),
        setReloadPose: (boneKey = 'leftArm', x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.pose ??= {};
            profile.pose[boneKey] = clampVector([x, y, z]);
          }, itemId),
        nudgeReloadPose: (boneKey = 'leftArm', deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.pose ??= {};
            const current = profile.pose[boneKey] ?? [0, 0, 0];
            profile.pose[boneKey] = [0, 1, 2].map((index) => Number(current[index] ?? 0) + Number([deltaX, deltaY, deltaZ][index] ?? 0));
          }, itemId),
        setReloadEnvelope: (start = 0.14, peak = 0.4, end = 0.88, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.envelope = {
              start: Number(start),
              peak: Number(peak),
              end: Number(end)
            };
          }, itemId),
        setReloadSlideTiming: (start = 0.34, peak = 0.48, end = 0.68, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.slide ??= { nodeName: 'slide_Armature', position: [0, 0, 0] };
            profile.slide.start = Number(start);
            profile.slide.peak = Number(peak);
            profile.slide.end = Number(end);
          }, itemId),
        setReloadSlidePosition: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.slide ??= { nodeName: 'slide_Armature', start: 0.34, peak: 0.48, end: 0.68 };
            profile.slide.position = clampVector([x, y, z]);
          }, itemId),
        setReloadWeaponPosition: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.weaponMotion ??= { position: [0, 0, 0], rotation: [0, 0, 0] };
            profile.weaponMotion.position = clampVector([x, y, z]);
          }, itemId),
        setReloadWeaponRotation: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.weaponMotion ??= { position: [0, 0, 0], rotation: [0, 0, 0] };
            profile.weaponMotion.rotation = clampVector([x, y, z]);
          }, itemId),
        resetReload: (itemId = getActiveItemId()) => {
          this.player.clearHeldItemReloadProfileOverride?.(itemId);
          return printReload(itemId);
        },
        previewCrateLeftHand: () => this.player.attachHeldItem(HELD_ITEM_IDS.crateA, { visible: true }),
        clearLeftHand: () => this.player.detachHeldItem(ATTACHMENT_SLOTS.handLeft)
      };
      globalThis.printGrip = (...args) => globalThis.__stickRpgHeldItemDebug.printGrip(...args);
      globalThis.printReload = (...args) => globalThis.__stickRpgHeldItemDebug.printReload(...args);
      globalThis.previewReload = (...args) => globalThis.__stickRpgHeldItemDebug.previewReload(...args);
      globalThis.stopReloadPreview = (...args) => globalThis.__stickRpgHeldItemDebug.stopReloadPreview(...args);
      globalThis.setReloadPose = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadPose(...args);
      globalThis.nudgeReloadPose = (...args) => globalThis.__stickRpgHeldItemDebug.nudgeReloadPose(...args);
      globalThis.setReloadEnvelope = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadEnvelope(...args);
      globalThis.setReloadSlideTiming = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadSlideTiming(...args);
      globalThis.setReloadSlidePosition = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadSlidePosition(...args);
      globalThis.setReloadWeaponPosition = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadWeaponPosition(...args);
      globalThis.setReloadWeaponRotation = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadWeaponRotation(...args);
      globalThis.resetReload = (...args) => globalThis.__stickRpgHeldItemDebug.resetReload(...args);
      globalThis.nudgePosition = (...args) => globalThis.__stickRpgHeldItemDebug.nudgePosition(...args);
      globalThis.nudgeRotation = (...args) => globalThis.__stickRpgHeldItemDebug.nudgeRotation(...args);
      globalThis.scaleBy = (...args) => globalThis.__stickRpgHeldItemDebug.scaleBy(...args);
      globalThis.resetGrip = (...args) => globalThis.__stickRpgHeldItemDebug.reset(...args);
      globalThis.__stickRpgShaderDebug = {
        presets: VIBE_SHADER_PRESETS.map(({ id, label }) => ({ id, label })),
        getActivePreset: () => this.getActiveVibeShaderPreset().id,
        setPreset: (presetId = DEFAULT_VIBE_SHADER_PRESET_ID) => this.setVibeShaderPreset(presetId, { announce: false }),
        getIntensity: (presetId = this.activeVibeShaderPresetId) => this.getVibeShaderIntensity(presetId),
        setIntensity: (intensity = DEFAULT_VIBE_SHADER_INTENSITY, presetId = this.activeVibeShaderPresetId) =>
          this.setVibeShaderIntensity(intensity, { presetId }),
        resetIntensity: (presetId = this.activeVibeShaderPresetId) =>
          this.resetVibeShaderIntensity({ presetId }),
        toggleMenu: (visible = !this.shaderDebugMenuVisible) => this.setShaderDebugMenuVisible(visible)
      };

      console.info('[HeldItemDebug] Attached window.__stickRpgHeldItemDebug helpers.', {
        items: listHeldItemDefinitions().map((definition) => definition.id)
      });
      console.info('[ReloadDebug] Attached window.__stickRpgHeldItemDebug reload helpers.', {
        methods: [
          'printReload',
          'previewReload',
          'stopReloadPreview',
          'setReloadPose',
          'nudgeReloadPose',
          'setReloadEnvelope',
          'setReloadSlideTiming',
          'setReloadSlidePosition',
          'setReloadWeaponPosition',
          'setReloadWeaponRotation',
          'resetReload'
        ]
      });
      console.info('[ShaderDebug] Attached window.__stickRpgShaderDebug helpers.', {
        presets: VIBE_SHADER_PRESETS.map(({ id }) => id)
      });
    }

    if (adminAimPoseDebug) {
      globalThis.__stickRpgAimPoseDebug = {
        fields: ['punchAimYawOffset', ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key)],
        setSection: (section = 'unarmed') => this.setPoseDebugSection(section),
        print: (itemId = getActiveItemId()) => this.printAimPoseDebug(itemId),
        setField: (fieldKey, value = 0, itemId = getActiveItemId()) => this.setAimPoseDebugField(fieldKey, value, itemId),
        reset: (itemId = getActiveItemId()) => this.resetAimPoseDebug(itemId),
        togglePanel: (visible = !this.aimPoseDebugVisible) => this.setAimPoseDebugVisible(visible),
        toggleBones: (visible = !this.aimPoseDebugShowSkeleton) => this.setAimPoseSkeletonDebugVisible(visible)
      };
      globalThis.printAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.print(...args);
      globalThis.setAimPoseField = (...args) => globalThis.__stickRpgAimPoseDebug.setField(...args);
      globalThis.resetAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.reset(...args);

      console.info('[PoseDebug] Attached window.__stickRpgAimPoseDebug helpers.', {
        fields: ['punchAimYawOffset', ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key)]
      });
    }
  }

  getActiveAimPoseDebugItemId() {
    return this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
  }

  setAimPoseDebugVisible(visible) {
    const nextVisible = Boolean(visible && this.canUseAimPoseDebug());
    if (nextVisible) {
      this.closePhoneMenu();
      this.setShaderDebugMenuVisible(false);
      if (this.worldBuilder?.enabled) {
        void this.worldBuilder.setEnabled(false);
      }
    }

    this.aimPoseDebugVisible = nextVisible;
    this.refreshAimPoseDebugHud();
    return this.aimPoseDebugVisible;
  }

  toggleAimPoseDebugPanel() {
    const nextVisible = this.setAimPoseDebugVisible(!this.aimPoseDebugVisible);
    this.hud.showToast(nextVisible ? 'Pose debug opened.' : 'Pose debug hidden.');
    return nextVisible;
  }

  setPoseDebugSection(section = 'unarmed') {
    const nextSection = section === 'weaponAim' ? 'weaponAim' : 'unarmed';
    if (this.poseDebugSection === nextSection) {
      return this.poseDebugSection;
    }

    this.poseDebugSection = nextSection;
    this.refreshAimPoseDebugHud();
    return this.poseDebugSection;
  }

  setAimPoseSkeletonDebugVisible(visible) {
    this.aimPoseDebugShowSkeleton = Boolean(visible && this.canUseAimPoseDebug());
    this.player?.setAimPoseDebugVisible(this.aimPoseDebugShowSkeleton);
    this.refreshAimPoseDebugHud();
    return this.aimPoseDebugShowSkeleton;
  }

  toggleAimPoseSkeletonDebug() {
    const nextVisible = !this.aimPoseDebugShowSkeleton;
    this.setAimPoseSkeletonDebugVisible(nextVisible);
    this.hud.showToast(nextVisible ? 'Aim skeleton helper enabled.' : 'Aim skeleton helper hidden.');
  }

  setAimPoseDebugField(fieldKey, value, itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (fieldKey === 'punchAimYawOffset') {
      const nextConfig = this.player.setEmoteDebugConfigField?.(PUNCH_EMOTE_ID, 'aimYawOffset', value) ?? null;
      this.refreshAimPoseDebugHud();
      return nextConfig;
    }

    if (!itemId) {
      return null;
    }

    const nextPose = this.player.setHeldItemAimPoseFieldOverride(itemId, fieldKey, value);
    this.refreshAimPoseDebugHud();
    return nextPose;
  }

  resetAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (this.poseDebugSection === 'unarmed') {
      const nextConfig = this.player.clearEmoteDebugConfig?.(PUNCH_EMOTE_ID) ?? null;
      this.refreshAimPoseDebugHud();
      this.hud.showToast('Unarmed pose debug reset.');
      return nextConfig;
    }

    if (!itemId) {
      return null;
    }

    this.player.clearHeldItemAimPoseOverride(itemId);
    const nextPose = this.player.getHeldItemAimPoseProfile(itemId);
    this.refreshAimPoseDebugHud();
    this.hud.showToast('Weapon aim pose debug reset.');
    return nextPose;
  }

  printAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !itemId || !this.canUseAimPoseDebug()) {
      return null;
    }

    const pose = this.player.getHeldItemAimPoseProfile(itemId);
    const printable = this.poseDebugSection === 'unarmed'
      ? {
        section: 'unarmed',
        punchFacingOffset: Number(this.player.getEmoteDebugConfig?.(PUNCH_EMOTE_ID)?.aimYawOffset ?? 0)
      }
      : {
        section: 'weaponAim',
        id: itemId,
        aimPose: Object.fromEntries(
          HELD_ITEM_AIM_POSE_FIELDS
            .map((field) => [field.key, Number(pose?.[field.key] ?? 0)])
            .filter(([, value]) => Math.abs(value) > 0.000001)
            .map(([key, value]) => [key, Number(value.toFixed(4))])
        )
      };
    console.info('[PoseDebug] Current pose settings.', printable);
    return printable;
  }

  refreshAimPoseDebugHud() {
    const debugAvailable = Boolean(this.player && this.canUseAimPoseDebug());
    const itemId = this.getActiveAimPoseDebugItemId();
    const pose = this.player?.getHeldItemAimPoseProfile(itemId) ?? {};
    const punchFacingOffset = Number(this.player?.getEmoteDebugConfig?.(PUNCH_EMOTE_ID)?.aimYawOffset ?? 0);
    const statusParts = [];
    statusParts.push(`Weapon: ${itemId || 'none'}`);
    statusParts.push(`Punch offset: ${punchFacingOffset.toFixed(2)}`);
    statusParts.push(this.currentAimMode ? 'Previewing right-click aim.' : 'Press O to open pose debug. Left click punch to test facing.');
    const nextState = {
      available: debugAvailable,
      visible: Boolean(this.aimPoseDebugVisible && debugAvailable),
      statusText: statusParts.join(' | '),
      showSkeleton: this.aimPoseDebugShowSkeleton,
      values: pose,
      extraValues: {
        punchAimYawOffset: punchFacingOffset
      },
      selectedSection: this.poseDebugSection
    };
    const valueSignature = [
      punchFacingOffset.toFixed(3),
      ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => Number(nextState.values?.[field.key] ?? 0).toFixed(3))
    ].join('|');
    const signature = [
      Number(nextState.available),
      Number(nextState.visible),
      Number(nextState.showSkeleton),
      nextState.statusText,
      valueSignature
    ].join('::');

    if (signature === this.lastAimPoseDebugSignature) {
      return;
    }

    this.lastAimPoseDebugSignature = signature;
    this.hud.setAimPoseDebugState(nextState);
  }

  queueHipFireShot(aimDirection) {
    if (!aimDirection) {
      return;
    }

    const now = performance.now();
    this.pendingHipFireShot = {
      direction: { x: aimDirection.x, z: aimDirection.z },
      origin: this.getShotCollisionOrigin(aimDirection),
      fireAt: now + HIP_FIRE_AIM_LEAD_MS,
      releaseAt: now + HIP_FIRE_AIM_LEAD_MS + HIP_FIRE_AIM_HOLD_MS,
      fired: false
    };
  }

  clearPendingHipFireShot() {
    this.pendingHipFireShot = null;
  }

  getShotCollisionOrigin(aimDirection) {
    if (!this.player || !aimDirection) {
      return null;
    }

    return {
      x: this.player.position.x + (aimDirection.x * SHOT_COLLISION_ORIGIN_FORWARD_OFFSET),
      z: this.player.position.z + (aimDirection.z * SHOT_COLLISION_ORIGIN_FORWARD_OFFSET)
    };
  }

  applyNpcRuntimeState() {
    if (!this.worldBuilder) {
      return;
    }

    const runtime = new Map();
    for (const [npcId, npc] of this.npcServiceState.npcs.entries()) {
      runtime.set(npcId, {
        x: npc.position?.[0] ?? npc.x,
        z: npc.position?.[1] ?? npc.z,
        rotationY: npc.rotationY ?? (npc.rotationQuarterTurns * (Math.PI / 2)),
        interactRadius: npc.interactRadius,
        gymCheckInEnabled: npc.gymCheckInEnabled === true,
        stockMarketEnabled: npc.stockMarketEnabled === true,
        bartenderEnabled: npc.bartenderEnabled === true,
        pawnShopOwnerEnabled: npc.pawnShopOwnerEnabled === true,
        carDealerEnabled: npc.carDealerEnabled === true,
        blackjackDealerEnabled: npc.blackjackDealerEnabled === true,
        busy: npc.busy,
        mode: npc.mode,
        activity: npc.activity,
        targetPlacementId: npc.targetPlacementId || '',
        alive: npc.alive !== false,
        lastDamagedAt: npc.lastDamagedAt ?? 0,
        respawnAt: npc.respawnAt ?? 0
      });
    }
    if (this.rentIntroCutsceneRestoreSnapNpcId) {
      const restoreState = runtime.get(this.rentIntroCutsceneRestoreSnapNpcId);
      if (restoreState) {
        restoreState.snap = true;
      }
      this.rentIntroCutsceneRestoreSnapNpcId = '';
    }
    this.applyRentIntroNpcRuntimeOverride(runtime);
    this.worldBuilder.setNpcRuntimeState(runtime);
    this.syncWorkoutState();
    this.worldBuilder.setNpcDebugState(this.npcServiceState.npcDebug ?? new Map());
  }

  updateNpcFocusTargets() {
    if (!this.worldBuilder) {
      return;
    }

    const focusTargets = this.npcFocusTargets;
    focusTargets.clear();
    for (const [npcId, npc] of this.npcServiceState.npcs.entries()) {
      if (
        !npc
        || npc.alive === false
        || npc.mode !== 'combat'
        || typeof npc.lastAttackerId !== 'string'
        || !npc.lastAttackerId
      ) {
        continue;
      }

      const targetAvatar = this.getAvatarForSessionId(npc.lastAttackerId);
      if (targetAvatar?.position) {
        const target = this.npcFocusTargetValues.get(npcId) ?? { x: 0, z: 0 };
        target.x = targetAvatar.position.x;
        target.z = targetAvatar.position.z;
        this.npcFocusTargetValues.set(npcId, target);
        focusTargets.set(npcId, target);
        continue;
      }

      const targetPlayerState = this.npcServiceState.players.get(npc.lastAttackerId);
      if (!targetPlayerState || targetPlayerState.alive === false) {
        continue;
      }

      const target = this.npcFocusTargetValues.get(npcId) ?? { x: 0, z: 0 };
      target.x = Number(targetPlayerState.x ?? 0);
      target.z = Number(targetPlayerState.z ?? 0);
      this.npcFocusTargetValues.set(npcId, target);
      focusTargets.set(npcId, target);
    }

    const focusSignature = this.getNpcFocusTargetSignature(focusTargets);
    if (focusSignature === this.lastNpcFocusTargetSignature) {
      return;
    }

    this.lastNpcFocusTargetSignature = focusSignature;
    this.worldBuilder.setNpcFocusTargets(focusTargets.size ? focusTargets : EMPTY_NPC_FOCUS_TARGETS);
  }

  getNpcFocusTargetSignature(focusTargets) {
    if (!focusTargets?.size) {
      return '';
    }

    let signature = '';
    for (const [npcId, target] of focusTargets.entries()) {
      if (signature) {
        signature += '|';
      }
      signature += `${npcId}:${Math.round(Number(target.x) * 20)}:${Math.round(Number(target.z) * 20)}`;
    }
    return signature;
  }

  captureAvatarSnapshot(avatar, fallbackState = null, overrides = {}) {
    const fallbackX = Number(fallbackState?.x ?? 0);
    const fallbackZ = Number(fallbackState?.z ?? 0);
    const fallbackRotationY = Number(fallbackState?.rotationY ?? 0);
    const fallbackAimRotationY = Number(fallbackState?.aimRotationY ?? fallbackRotationY);

    return {
      x: Number.isFinite(overrides.x) ? overrides.x : (avatar?.position.x ?? fallbackX),
      z: Number.isFinite(overrides.z) ? overrides.z : (avatar?.position.z ?? fallbackZ),
      y: Number.isFinite(overrides.y) ? overrides.y : (avatar?.position.y ?? 0),
      rotationY: Number.isFinite(overrides.rotationY) ? overrides.rotationY : (avatar?.object.rotation.y ?? fallbackRotationY),
      aimRotationY: Number.isFinite(overrides.aimRotationY) ? overrides.aimRotationY : (avatar?.getAimRotation?.() ?? fallbackAimRotationY),
      aiming: overrides.aiming ?? fallbackState?.aiming ?? false
    };
  }

  applyAvatarSnapshot(avatar, snapshot, playerState = null) {
    const targetPosition = new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z);
    const groundHeight = this.worldBuilder?.getGroundHeightAt(targetPosition) ?? snapshot.y ?? 0;
    const appliedState = playerState
      ? {
        ...playerState,
        x: snapshot.x,
        z: snapshot.z,
        rotationY: snapshot.rotationY,
        aimRotationY: snapshot.aimRotationY,
        aiming: snapshot.aiming
      }
      : null;

    if (appliedState) {
      avatar.applyRemoteState(appliedState, 0, groundHeight);
    }

    avatar.position.set(snapshot.x, groundHeight, snapshot.z);
    avatar.object.rotation.y = snapshot.rotationY;
    avatar.setAimRotation(snapshot.aimRotationY);
    avatar.setAimingState(Boolean(snapshot.aiming));
  }

  async buildAvatar(characterId, options = {}) {
    return createPlayer(this.library, {
      characterId,
      ...options
    });
  }

  removeAvatarFromScene(avatar) {
    if (!avatar) {
      return;
    }

    this.scene.remove(avatar.object);
    disposeObjectResources(avatar.object);
  }

  async swapLocalPlayerCharacter(characterId) {
    if (!this.worldBuilder) {
      return;
    }

    const targetCharacterId = getPlayableCharacterById(characterId).id;
    const requestId = ++this.localCharacterSwapSequence;
    const currentPlayer = this.player ?? null;
    const localPlayerState = this.getLocalPlayerState();
    const snapshot = this.captureAvatarSnapshot(currentPlayer, localPlayerState, {
      aiming: this.currentAimMode && Boolean(localPlayerState?.equippedWeaponId)
    });
    const nextAvatar = await this.buildAvatar(targetCharacterId);

    if (requestId !== this.localCharacterSwapSequence) {
      disposeObjectResources(nextAvatar.object);
      return;
    }

    const previousDebugHelper = currentPlayer?.getAimPoseDebugHelper?.() ?? null;
    if (previousDebugHelper) {
      this.scene.remove(previousDebugHelper);
    }

    if (currentPlayer) {
      this.removeAvatarFromScene(currentPlayer);
    }

    this.player = nextAvatar;
    this.applyAvatarSnapshot(nextAvatar, snapshot, localPlayerState);
    this.scene.add(nextAvatar.object);

    const nextDebugHelper = nextAvatar.getAimPoseDebugHelper?.();
    if (nextDebugHelper) {
      this.scene.add(nextDebugHelper);
    }

    this.registerHeldItemDebugTools();
    this.player.setAimPoseDebugVisible(this.canUseAimPoseDebug() && this.aimPoseDebugShowSkeleton);
    this.refreshAimPoseDebugHud();
    this.refreshCharacterSelectorHud();
    this.refreshPhoneCharacterHud();
  }

  async swapRemotePlayerCharacter(sessionId, state, {
    indicatorColor = 0x68c7ff,
    indicatorOpacity = 0.65
  } = {}) {
    const targetCharacterId = getPlayableCharacterById(state?.characterId).id;
    const requestId = (this.remoteAvatarBuildRequests.get(sessionId) ?? 0) + 1;
    this.remoteAvatarBuildRequests.set(sessionId, requestId);
    this.pendingRemotePlayers.add(sessionId);

    try {
      const previousAvatar = this.remotePlayers.get(sessionId) ?? null;
      const snapshot = this.captureAvatarSnapshot(previousAvatar, state, {
        x: Number(state?.x ?? previousAvatar?.position.x ?? 0),
        z: Number(state?.z ?? previousAvatar?.position.z ?? 0),
        rotationY: Number(state?.rotationY ?? previousAvatar?.object.rotation.y ?? 0),
        aimRotationY: Number(state?.aimRotationY ?? previousAvatar?.getAimRotation?.() ?? 0),
        aiming: Boolean(state?.aiming)
      });
      const nextAvatar = await this.buildAvatar(targetCharacterId, {
        indicatorColor,
        indicatorOpacity
      });

      if (this.remoteAvatarBuildRequests.get(sessionId) !== requestId) {
        disposeObjectResources(nextAvatar.object);
        return;
      }

      if (previousAvatar) {
        this.removeAvatarFromScene(previousAvatar);
      }

      this.applyAvatarSnapshot(nextAvatar, snapshot, state);
      nextAvatar.object.visible = !this.currentInterior?.scene;
      this.scene.add(nextAvatar.object);
      this.remotePlayers.set(sessionId, nextAvatar);
    } finally {
      this.pendingRemotePlayers.delete(sessionId);
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ remotePlayers: true });
      }
    }
  }

  async handleWorldPatch(patch) {
    if (!this.worldBuilder) {
      return;
    }

    await this.worldBuilder.applyWorldPatch(patch);
    this.currentLayout = this.worldBuilder.getLayout();
    this.syncVibeRadioTracksFromLayout(this.currentLayout);
    this.gymDoorBlockersDirty = true;
  }

  async ensureRemotePlayer(sessionId, initialState) {
    if (this.remotePlayers.has(sessionId) || this.pendingRemotePlayers.has(sessionId)) {
      return;
    }

    this.pendingRemotePlayers.add(sessionId);
    try {
      const latestState = this.npcServiceState.players.get(sessionId) ?? initialState;
      const stillPresent = this.npcServiceState.players.has(sessionId) && sessionId !== this.npcServiceState.sessionId;
      if (!stillPresent) {
        return;
      }
      await this.swapRemotePlayerCharacter(sessionId, latestState);
    } catch (error) {
      console.error('[Multiplayer] Failed to create remote player avatar.', {
        sessionId,
        error
      });
    } finally {
      this.pendingRemotePlayers.delete(sessionId);
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ remotePlayers: true });
      }
    }
  }

  removeRemotePlayer(sessionId) {
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }

    this.removeAvatarFromScene(avatar);
    this.remotePlayers.delete(sessionId);
    this.remoteAvatarBuildRequests.delete(sessionId);
  }

  syncRemotePlayers({ maxCreates = Infinity, maxSwaps = Infinity } = {}) {
    if (!this.player) {
      return true;
    }

    let createsStarted = 0;
    let swapsStarted = 0;
    let hasMoreWork = false;
    const desiredSessionIds = this.desiredRemoteSessionIds;
    desiredSessionIds.clear();
    for (const [sessionId, playerState] of this.npcServiceState.players.entries()) {
      if (sessionId === this.npcServiceState.sessionId) {
        continue;
      }

      desiredSessionIds.add(sessionId);
      if (!this.remotePlayers.has(sessionId) && !this.pendingRemotePlayers.has(sessionId)) {
        if (createsStarted < maxCreates) {
          createsStarted += 1;
          void this.ensureRemotePlayer(sessionId, playerState);
        } else {
          hasMoreWork = true;
        }
        continue;
      }

      const avatar = this.remotePlayers.get(sessionId);
      if (avatar && avatar.characterId !== getPlayableCharacterById(playerState?.characterId).id && !this.pendingRemotePlayers.has(sessionId)) {
        if (swapsStarted < maxSwaps) {
          swapsStarted += 1;
          void this.swapRemotePlayerCharacter(sessionId, playerState);
        } else {
          hasMoreWork = true;
        }
      }
    }

    const sessionIdsToRemove = this.remoteSessionIdsToRemove;
    sessionIdsToRemove.length = 0;
    for (const sessionId of this.remotePlayers.keys()) {
      if (!desiredSessionIds.has(sessionId)) {
        sessionIdsToRemove.push(sessionId);
      }
    }
    for (const sessionId of sessionIdsToRemove) {
      this.removeRemotePlayer(sessionId);
    }

    return !hasMoreWork;
  }

  updateRemotePlayers(deltaSeconds) {
    for (const [sessionId, avatar] of this.remotePlayers.entries()) {
      const state = this.npcServiceState.players.get(sessionId);
      if (!state) {
        continue;
      }

      const groundProbe = this.remotePlayerGroundProbe.set(state.x, avatar.position.y, state.z);
      const groundHeight = this.worldBuilder?.getGroundHeightAt(groundProbe) ?? 0;
      avatar.applyRemoteState(state, deltaSeconds, groundHeight);
    }
  }

  getLocalPlayerState() {
    return this.npcServiceState.players.get(this.npcServiceState.sessionId) ?? null;
  }

  getAvatarForSessionId(sessionId) {
    if (!sessionId) {
      return null;
    }

    if (sessionId === this.npcServiceState.sessionId) {
      return this.player ?? null;
    }

    return this.remotePlayers.get(sessionId) ?? null;
  }

  syncPickupVisuals({ maxCreates = Infinity } = {}) {
    if (!this.library) {
      return true;
    }

    let createsStarted = 0;
    let hasMoreWork = false;
    const desiredIds = this.desiredPickupIds;
    desiredIds.clear();
    for (const [pickupId, pickup] of this.npcServiceState.pickups.entries()) {
      if (!pickup?.active) {
        continue;
      }

      desiredIds.add(pickupId);
      if (!this.pickupVisuals.has(pickupId) && !this.pendingPickupVisuals.has(pickupId)) {
        if (createsStarted < maxCreates) {
          createsStarted += 1;
          void this.ensurePickupVisual(pickupId, pickup);
        } else {
          hasMoreWork = true;
        }
      }
    }

    const pickupIdsToRemove = this.pickupIdsToRemove;
    pickupIdsToRemove.length = 0;
    for (const pickupId of this.pickupVisuals.keys()) {
      if (!desiredIds.has(pickupId)) {
        pickupIdsToRemove.push(pickupId);
      }
    }
    for (const pickupId of pickupIdsToRemove) {
      this.removePickupVisual(pickupId);
    }

    return !hasMoreWork;
  }

  async ensurePickupVisual(pickupId, pickup) {
    const assetUrl = getHeldItemAssetUrl(pickup.weaponId);
    if (!assetUrl) {
      return;
    }

    this.pendingPickupVisuals.add(pickupId);
    try {
      const weapon = await this.library.instantiate(assetUrl);
      const latestPickup = this.npcServiceState.pickups.get(pickupId);
      if (!latestPickup?.active) {
        return;
      }

      prepareHeldItemModel(weapon, pickup.weaponId, 'pickup');
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.05, 1.45, 28),
        new THREE.MeshBasicMaterial({
          color: 0xf2c871,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);
      group.add(weapon);
      const groundProbe = this.pickupGroundProbe.set(latestPickup.x, 0, latestPickup.z);
      const groundHeight = this.worldBuilder?.getGroundHeightAt(groundProbe) ?? 0;
      group.position.set(latestPickup.x, groundHeight, latestPickup.z);
      group.visible = !this.currentInterior?.scene;
      this.scene.add(group);
      this.pickupVisuals.set(pickupId, {
        object: group,
        ring,
        weapon,
        phase: Math.random() * Math.PI * 2,
        spin: Math.random() * Math.PI * 2
      });
    } catch (error) {
      console.warn(`[Combat] Failed to create pickup visual for ${pickupId}.`, error);
    } finally {
      this.pendingPickupVisuals.delete(pickupId);
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ pickups: true });
      }
    }
  }

  removePickupVisual(pickupId) {
    const visual = this.pickupVisuals.get(pickupId);
    if (!visual) {
      return;
    }

    this.scene.remove(visual.object);
    this.pickupVisuals.delete(pickupId);
  }

  updatePickupVisuals(deltaSeconds) {
    for (const [pickupId, visual] of this.pickupVisuals.entries()) {
      const pickup = this.npcServiceState.pickups.get(pickupId);
      if (!pickup?.active) {
        this.removePickupVisual(pickupId);
        continue;
      }

      const groundProbe = this.pickupGroundProbe.set(pickup.x, 0, pickup.z);
      const groundHeight = this.worldBuilder?.getGroundHeightAt(groundProbe) ?? 0;
      visual.phase += deltaSeconds * 2.4;
      visual.spin += deltaSeconds * 1.8;
      visual.object.position.set(pickup.x, groundHeight, pickup.z);
      visual.object.rotation.y = visual.spin;
      visual.weapon.position.y = 0.9 + Math.sin(visual.phase) * 0.12;
      visual.ring.material.opacity = 0.56 + ((Math.sin(visual.phase * 1.6) + 1) * 0.12);
    }
  }

  startMoneyAnimation(targetAmount, { fromAmount = this.moneyDisplayAmount, durationMs = RENT_INTRO_MONEY_ANIMATION_MS } = {}) {
    const from = normalizeMoneyAmount(fromAmount);
    const to = normalizeMoneyAmount(targetAmount);
    if (from === to) {
      this.moneyAnimation = null;
      this.moneyDisplayAmount = to;
      return;
    }

    this.moneyAnimation = {
      from,
      to,
      startedAt: performance.now(),
      durationMs: Math.max(120, Number(durationMs) || RENT_INTRO_MONEY_ANIMATION_MS)
    };
    this.moneyDisplayAmount = from;
  }

  getAnimatedMoneyAmount(targetAmount) {
    const target = normalizeMoneyAmount(targetAmount);
    if (!this.moneyAnimation) {
      this.moneyDisplayAmount = target;
      return target;
    }

    if (this.moneyAnimation.to !== target) {
      this.startMoneyAnimation(target, {
        fromAmount: this.moneyDisplayAmount,
        durationMs: 420
      });
      if (!this.moneyAnimation) {
        return this.moneyDisplayAmount;
      }
    }

    const now = performance.now();
    const progress = (now - this.moneyAnimation.startedAt) / this.moneyAnimation.durationMs;
    if (progress >= 1) {
      this.moneyDisplayAmount = this.moneyAnimation.to;
      this.moneyAnimation = null;
      return this.moneyDisplayAmount;
    }

    const eased = easeOutCubic(progress);
    this.moneyDisplayAmount = Math.round(
      this.moneyAnimation.from + ((this.moneyAnimation.to - this.moneyAnimation.from) * eased)
    );
    return this.moneyDisplayAmount;
  }

  syncMoneyHud(targetAmount) {
    const amount = this.getAnimatedMoneyAmount(targetAmount);
    const wallet = this.getActiveStockMarketSnapshot();
    const portfolioValue = normalizeMoneyAmount(wallet?.portfolioValue ?? 0);
    this.hud.setMoneyState({
      amount,
      netWorth: amount + portfolioValue,
      stockProfit: this.getStockUnrealizedProfit(wallet)
    });
  }

  maybeAnimateMoneyChange(authoritativeAmount) {
    const amount = normalizeMoneyAmount(authoritativeAmount);
    if (this.lastAuthoritativeMoneyAmount === null) {
      this.lastAuthoritativeMoneyAmount = amount;
      return;
    }

    const previousAmount = this.lastAuthoritativeMoneyAmount;
    if (amount === previousAmount) {
      return;
    }

    this.lastAuthoritativeMoneyAmount = amount;
    if (this.pendingRentIntro || (this.activeRentIntro && !this.activeRentIntro.charged)) {
      return;
    }

    const delta = amount - previousAmount;
    this.startMoneyAnimation(amount, {
      fromAmount: this.moneyDisplayAmount,
      durationMs: delta > 0 ? MONEY_REWARD_ANIMATION_MS : 420
    });
    this.spawnMoneyFloater(delta);
    if (delta > 0) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now >= Number(this.moneyChangeChaChingSuppressedUntil ?? 0)) {
        this.playSoundEffect(this.rentChaChingSound);
      }
    }
  }

  spawnMoneyFloater(amount) {
    this.moneyFloaters.push({
      id: `money:${++this.moneyFloaterSequence}`,
      amount: normalizeMoneyAmount(amount),
      startedAt: performance.now(),
      durationMs: RENT_INTRO_MONEY_FLOATER_MS
    });
  }

  isRentIntroCutsceneActive() {
    return Boolean(this.rentIntroCutscene);
  }

  startRentIntroCutscene(intro = this.pendingRentIntro ?? this.activeRentIntro) {
    if (!intro?.npcId || !this.player || this.rentIntroCutscene?.seq === intro.seq) {
      return false;
    }

    const now = performance.now();
    const facing = Number.isFinite(this.player.object?.rotation?.y)
      ? this.player.object.rotation.y
      : 0;
    this.rentIntroCutscene = {
      seq: intro.seq,
      npcId: intro.npcId,
      startedAt: now,
      endsAt: now + RENT_INTRO_CUTSCENE_TOTAL_MS,
      facing,
      standUpPlayed: false,
      playerVisibleBefore: this.player.object?.visible !== false
    };
    void preloadMixamoClips([RENT_INTRO_STAND_UP_CLIP_NAME]);
    this.player.object.visible = false;
    this.player.setAimingState(false);
    this.clearPendingHipFireShot();
    this.hud.setRentIntroCutsceneState({ visible: true, blink: 1 });
    this.applyNpcRuntimeState();
    return true;
  }

  endRentIntroCutscene() {
    const cutscene = this.rentIntroCutscene;
    if (!cutscene) {
      return;
    }

    if (this.player?.object) {
      this.player.object.visible = cutscene.playerVisibleBefore !== false;
    }
    this.rentIntroCutsceneRestoreSnapNpcId = cutscene.npcId;
    this.rentIntroCutscene = null;
    this.hud.setRentIntroCutsceneState({ visible: false, blink: 0 });
    this.applyNpcRuntimeState();
  }

  getRentIntroCutsceneForward(target = this.rentIntroCutsceneForward) {
    const facing = Number.isFinite(this.rentIntroCutscene?.facing)
      ? this.rentIntroCutscene.facing
      : (this.player?.object?.rotation?.y ?? 0);
    target.set(Math.sin(facing), 0, Math.cos(facing));
    if (target.lengthSq() <= 0.0001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  }

  getRentIntroCutsceneNpcPosition(target = this.rentIntroCutsceneNpcPosition) {
    if (!this.player) {
      return target.set(0, 0, 0);
    }

    const forward = this.getRentIntroCutsceneForward(this.rentIntroCutsceneForward);
    return target
      .copy(this.player.position)
      .addScaledVector(forward, RENT_INTRO_CUTSCENE_NPC_DISTANCE);
  }

  applyRentIntroNpcRuntimeOverride(runtime) {
    const cutscene = this.rentIntroCutscene;
    if (!cutscene?.npcId || !this.player) {
      return;
    }

    const npcPosition = this.getRentIntroCutsceneNpcPosition(this.rentIntroCutsceneNpcPosition);
    const previous = runtime.get(cutscene.npcId) ?? {};
    runtime.set(cutscene.npcId, {
      ...previous,
      x: npcPosition.x,
      z: npcPosition.z,
      rotationY: Math.atan2(this.player.position.x - npcPosition.x, this.player.position.z - npcPosition.z),
      mode: 'routine',
      activity: '',
      busy: false,
      alive: true,
      snap: true
    });
  }

  updateRentIntroCutscene() {
    const cutscene = this.rentIntroCutscene;
    if (!cutscene || !this.player) {
      return false;
    }

    const now = performance.now();
    if (now >= cutscene.endsAt) {
      this.endRentIntroCutscene();
      return false;
    }

    const elapsedMs = Math.max(0, now - cutscene.startedAt);
    const blink = getRentIntroBlinkClosure(elapsedMs);
    const firstPerson = elapsedMs < RENT_INTRO_CUTSCENE_FIRST_PERSON_MS;
    this.hud.setRentIntroCutsceneState({ visible: true, blink });
    this.player.object.visible = !firstPerson && cutscene.playerVisibleBefore !== false;
    this.player.setAimingState(false);
    this.player.setSkateboardState?.({ skating: false });

    if (!cutscene.standUpPlayed && elapsedMs >= RENT_INTRO_CUTSCENE_GET_UP_START_MS) {
      cutscene.standUpPlayed = true;
      this.player.object.visible = cutscene.playerVisibleBefore !== false;
      this.player.playEmote?.(RENT_INTRO_STAND_UP_EMOTE_ID, {
        startedAtMs: Date.now(),
        trackSync: false
      });
    }

    this.updateRentIntroCutsceneCamera(elapsedMs);
    return true;
  }

  updateRentIntroCutsceneCamera(elapsedMs = 0) {
    if (!this.player) {
      return;
    }

    const forward = this.getRentIntroCutsceneForward(this.rentIntroCutsceneForward);
    const side = this.rentIntroCutsceneSide.set(forward.z, 0, -forward.x).normalize();
    const npcPosition = this.getRentIntroCutsceneNpcPosition(this.rentIntroCutsceneNpcPosition);
    const sway = Math.sin(elapsedMs * 0.0032) * 0.045;
    const groundCamera = this.rentIntroCutsceneGroundCamera
      .copy(this.player.position)
      .addScaledVector(forward, 0.2)
      .addScaledVector(side, sway);
    groundCamera.y += 0.46 + (Math.sin(elapsedMs * 0.0055) * 0.018);
    const groundLook = this.rentIntroCutsceneGroundLook
      .copy(npcPosition)
      .addScaledVector(side, sway * 0.45);
    groundLook.y = this.player.position.y + 3.35;

    const thirdCamera = this.rentIntroCutsceneThirdCamera
      .copy(this.player.position)
      .addScaledVector(forward, -4.95)
      .addScaledVector(side, 1.95);
    thirdCamera.y += 2.7;
    const thirdLook = this.rentIntroCutsceneThirdLook.copy(this.player.position);
    thirdLook.y += 1.38;

    const blend = smoothstep01(
      (elapsedMs - RENT_INTRO_CUTSCENE_FIRST_PERSON_MS) / RENT_INTRO_CUTSCENE_CAMERA_BLEND_MS
    );
    this.camera.position.copy(groundCamera).lerp(thirdCamera, blend);
    this.cameraLookTarget.copy(groundLook).lerp(thirdLook, blend);
    this.camera.lookAt(this.cameraLookTarget);
  }

  maybeStartRentIntro(localPlayerState) {
    const seq = Number(localPlayerState?.rentIntroSeq ?? 0);
    if (!Number.isFinite(seq) || seq <= 0 || seq === this.handledRentIntroSeq) {
      return;
    }

    this.handledRentIntroSeq = seq;
    const rentAmount = Math.abs(normalizeMoneyAmount(localPlayerState.rentIntroAmount || 100)) || 100;
    const targetAmount = normalizeMoneyAmount(localPlayerState.money ?? -rentAmount);
    this.pendingRentIntro = {
      seq,
      rentAmount,
      targetAmount,
      npcId: String(localPlayerState.rentIntroNpcId ?? ''),
      line: RENT_INTRO_LINE,
      readyAt: 0
    };
    this.activeRentIntro = null;
    this.moneyAnimation = null;
    this.moneyDisplayAmount = 0;
  }

  updateRentIntroPresentation() {
    const now = performance.now();
    if (this.pendingRentIntro) {
      if (this.rentIntroLoadingClearedAt <= 0) {
        return;
      }

      this.startRentIntroCutscene(this.pendingRentIntro);

      if (!this.pendingRentIntro.readyAt) {
        this.pendingRentIntro.readyAt = this.rentIntroLoadingClearedAt + RENT_INTRO_AFTER_LOADING_DELAY_MS;
      }

      if (now < this.pendingRentIntro.readyAt) {
        return;
      }

      const line = this.pendingRentIntro.line || RENT_INTRO_LINE;
      const typeDurationMs = Math.max(
        RENT_INTRO_MIN_TYPING_MS,
        line.length * RENT_INTRO_TYPE_MS_PER_CHAR
      );
      const chargeAt = now + typeDurationMs + RENT_INTRO_AFTER_LINE_DELAY_MS;
      this.activeRentIntro = {
        ...this.pendingRentIntro,
        line,
        startedAt: now,
        typeDurationMs,
        chargeAt,
        charged: false,
        expiresAt: chargeAt + RENT_INTRO_SPEECH_HOLD_MS
      };
      this.pendingRentIntro = null;
    }

    if (!this.activeRentIntro) {
      return;
    }

    if (!this.activeRentIntro.charged && now >= this.activeRentIntro.chargeAt) {
      this.activeRentIntro.charged = true;
      this.startMoneyAnimation(this.activeRentIntro.targetAmount, {
        fromAmount: this.moneyDisplayAmount,
        durationMs: RENT_INTRO_MONEY_ANIMATION_MS
      });
      this.spawnMoneyFloater(-this.activeRentIntro.rentAmount);
      this.playSoundEffect(this.rentChaChingSound);
    }

    if (this.activeRentIntro.charged && now >= this.activeRentIntro.expiresAt) {
      this.activeRentIntro = null;
    }
  }

  getRentIntroMoneyTargetAmount(authoritativeAmount) {
    if (this.pendingRentIntro || (this.activeRentIntro && !this.activeRentIntro.charged)) {
      return this.moneyDisplayAmount;
    }

    return authoritativeAmount;
  }

  getRentIntroSpeechText() {
    if (!this.activeRentIntro) {
      return '';
    }

    const line = this.activeRentIntro.line || RENT_INTRO_LINE;
    const elapsedMs = Math.max(0, performance.now() - this.activeRentIntro.startedAt);
    const progress = THREE.MathUtils.clamp(elapsedMs / this.activeRentIntro.typeDurationMs, 0, 1);
    const characterCount = Math.max(1, Math.ceil(line.length * progress));
    return line.slice(0, characterCount);
  }

  isRentIntroReservedNpc(npcId) {
    const normalizedNpcId = String(npcId ?? '');
    return Boolean(
      normalizedNpcId
      && (
        this.pendingRentIntro?.npcId === normalizedNpcId
        || this.activeRentIntro?.npcId === normalizedNpcId
      )
    );
  }

  addMoneyFloaterBubbles(bubbles) {
    if (!this.moneyFloaters.length || !this.player) {
      return;
    }

    const now = performance.now();
    const activeFloaters = [];
    this.moneyFloaterAnchor.set(
      this.player.position.x,
      this.player.position.y + 3.3,
      this.player.position.z
    );
    const projected = this.projectSpeechAnchor(this.moneyFloaterAnchor);

    for (const floater of this.moneyFloaters) {
      const progress = (now - floater.startedAt) / floater.durationMs;
      if (progress >= 1) {
        continue;
      }

      activeFloaters.push(floater);
      if (!projected) {
        continue;
      }

      const eased = easeOutCubic(progress);
      const driftX = Math.sin(progress * Math.PI) * 16;
      bubbles.push({
        id: `money-floater:${floater.id}`,
        text: formatMoneyDelta(floater.amount),
        label: '',
        variant: 'money',
        tone: floater.amount >= 0 ? 'positive' : 'negative',
        status: 'done',
        visible: true,
        screenX: projected.x + driftX,
        screenY: projected.y - 18 - (eased * 70),
        opacity: Math.max(0, 1 - (progress * 1.12))
      });
    }

    this.moneyFloaters = activeFloaters;
  }

  addSkillXpFloaterBubbles(bubbles) {
    if (!this.skillXpFloaters.length || !this.player) {
      return;
    }

    const now = performance.now();
    const activeFloaters = [];
    this.skillXpFloaterAnchor.set(
      this.player.position.x,
      this.player.position.y + 3.95,
      this.player.position.z
    );
    const projected = this.projectSpeechAnchor(this.skillXpFloaterAnchor);

    for (const floater of this.skillXpFloaters) {
      const progress = (now - floater.startedAt) / floater.durationMs;
      if (progress >= 1) {
        continue;
      }

      activeFloaters.push(floater);
      if (!projected) {
        continue;
      }

      const eased = easeOutCubic(progress);
      const arc = Math.sin(progress * Math.PI);
      const driftX = (Math.sin(progress * Math.PI * 1.35) * 18) + (arc * 10);
      bubbles.push({
        id: `skill-xp-floater:${floater.id}`,
        text: `+${floater.amount.toLocaleString('en-US')} ${floater.emoji}`,
        label: '',
        variant: 'xp',
        status: 'done',
        visible: true,
        screenX: projected.x + driftX,
        screenY: projected.y - 28 - (eased * 86) - (arc * 8),
        opacity: Math.max(0, 1 - (progress * 1.08))
      });
    }

    this.skillXpFloaters = activeFloaters;
  }

  recordMovementFrameTiming(rawDeltaSeconds, deltaSeconds) {
    const frameMs = Math.max(0, Number(deltaSeconds) || 0) * 1000;
    this.frameTimingMs[this.frameTimingCursor] = frameMs;
    this.frameTimingCursor = (this.frameTimingCursor + 1) % FRAME_TIMING_SAMPLE_LIMIT;
    this.frameTimingCount = Math.min(
      FRAME_TIMING_SAMPLE_LIMIT,
      this.frameTimingCount + 1
    );
  }

  getMovementFrameSummary({ force = false } = {}) {
    const now = performance.now();
    if (
      !force
      && this.frameTimingSummary
      && now - this.frameTimingLastSummaryAt < FRAME_TIMING_SUMMARY_INTERVAL_MS
    ) {
      return this.frameTimingSummary;
    }

    const samples = this.frameTimingMs;
    const sampleCount = this.frameTimingCount;
    const summary = this.frameTimingSummary;
    if (!sampleCount) {
      summary.sampleCount = 0;
      summary.p95Ms = 0;
      this.frameTimingLastSummaryAt = now;
      return summary;
    }

    const sortedSamples = this.frameTimingSortedMs;
    sortedSamples.length = sampleCount;
    for (let index = 0; index < sampleCount; index += 1) {
      const value = Number(samples[index]) || 0;
      sortedSamples[index] = value;
    }
    summary.sampleCount = sampleCount;
    summary.p95Ms = getSortedPercentile(sortedSamples, 0.95);
    this.frameTimingLastSummaryAt = now;
    return summary;
  }

  updateAdaptiveRenderQuality(frameSummary = this.getMovementFrameSummary()) {
    if (!this.detailedRenderingEnabled || frameSummary.sampleCount < ADAPTIVE_RENDER_SAMPLE_MIN_COUNT) {
      return;
    }

    const now = performance.now();
    if (now - this.lastAdaptiveRenderAdjustAt < ADAPTIVE_RENDER_ADJUST_INTERVAL_MS) {
      return;
    }

    const currentCap = Math.max(ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP, Number(this.dynamicPixelRatioCap) || RUNTIME_PIXEL_RATIO_CAP);
    let nextCap = currentCap;
    if (frameSummary.p95Ms >= ADAPTIVE_RENDER_SLOW_FRAME_P95_MS && currentCap > ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP) {
      nextCap = Math.max(ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP, currentCap - ADAPTIVE_RENDER_PIXEL_RATIO_STEP);
    } else if (
      frameSummary.p95Ms <= ADAPTIVE_RENDER_RECOVERY_FRAME_P95_MS
      && currentCap < RUNTIME_PIXEL_RATIO_CAP
    ) {
      nextCap = Math.min(RUNTIME_PIXEL_RATIO_CAP, currentCap + ADAPTIVE_RENDER_PIXEL_RATIO_STEP);
    }

    if (nextCap === currentCap) {
      return;
    }

    this.dynamicPixelRatioCap = nextCap;
    this.lastAdaptiveRenderAdjustAt = now;
    this.onResize();
  }

  getAuthoritativeTransformLag(localPlayerState = this.getLocalPlayerState()) {
    const rawAuthoritativeSeq = localPlayerState?.transformSeq;
    const authoritativeValue = Number(rawAuthoritativeSeq);
    const hasAuthoritativeSeq = rawAuthoritativeSeq !== null
      && rawAuthoritativeSeq !== undefined
      && Number.isFinite(authoritativeValue);
    const authoritativeSeq = hasAuthoritativeSeq
      ? Math.max(0, Math.floor(authoritativeValue))
      : null;
    const localSeq = Math.max(0, Math.floor(Number(this.npcService?.getLastTransformSeq?.() ?? 0) || 0));

    return {
      hasAuthoritativeSeq,
      authoritativeSeq,
      localSeq,
      lag: hasAuthoritativeSeq ? Math.max(0, localSeq - authoritativeSeq) : 0
    };
  }

  updateAuthoritativeLocalPositionSample(targetPosition) {
    const now = performance.now();
    const changed = !this.authoritativeLocalPositionInitialized
      || Math.abs(this.authoritativeLocalPosition.x - targetPosition.x) > 0.001
      || Math.abs(this.authoritativeLocalPosition.z - targetPosition.z) > 0.001;

    if (changed) {
      this.authoritativeLocalPosition.copy(targetPosition);
      this.authoritativeLocalPositionInitialized = true;
      this.authoritativeLocalPositionChangedAt = now;
    }

    return {
      changed,
      staleMs: now - this.authoritativeLocalPositionChangedAt
    };
  }

  gentlyReconcileLocalPlayerPosition(targetPosition, groundHeight, deltaSeconds = 0) {
    const safeDeltaSeconds = Math.max(1 / 120, Math.min(0.05, Number(deltaSeconds) || (1 / 60)));
    const alpha = 1 - Math.exp(-LOCAL_AUTHORITATIVE_RECONCILE_RATE * safeDeltaSeconds);
    this.player.position.x = THREE.MathUtils.lerp(this.player.position.x, targetPosition.x, alpha);
    this.player.position.z = THREE.MathUtils.lerp(this.player.position.z, targetPosition.z, alpha);
    this.player.position.y = this.getActiveGroundHeightAt(this.player.position) ?? groundHeight;
  }

  syncLocalPlayerState(localPlayerState, deltaSeconds = 0) {
    if (!this.player || !localPlayerState) {
      return;
    }

    const authoritativeCharacterId = getPlayableCharacterById(localPlayerState.characterId).id;
    if (authoritativeCharacterId === this.desiredLocalCharacterId) {
      this.pendingCharacterRequestId = '';
    }

    if (this.player.characterId !== authoritativeCharacterId) {
      if (!this.pendingCharacterRequestId || authoritativeCharacterId === this.desiredLocalCharacterId) {
        this.clearStockMarketSnapshot();
        this.desiredLocalCharacterId = authoritativeCharacterId;
        this.storeSelectedCharacterId(authoritativeCharacterId);
        this.refreshCharacterSelectorHud();
        this.refreshPhoneCharacterHud();
        this.refreshPhoneWalletHud();
        this.refreshPhoneStocksHud();
        void this.swapLocalPlayerCharacter(authoritativeCharacterId);
        return;
      }
    }

    const isAlive = localPlayerState.alive !== false;
    const targetPosition = this.localAuthoritativeTargetPosition.set(
      localPlayerState.x,
      this.player.position.y,
      localPlayerState.z
    );
    const authoritativeSample = this.updateAuthoritativeLocalPositionSample(targetPosition);
    const distance = this.player.position.distanceTo(targetPosition);
    const respawned = this.localStateInitialized && !this.lastLocalAlive && isAlive;
    const died = this.localStateInitialized && this.lastLocalAlive && !isAlive;
    const transformLag = this.getAuthoritativeTransformLag(localPlayerState);
    const skipStaleAuthoritativePosition = Boolean(
      isAlive
      && this.localStateInitialized
      && !respawned
      && !died
      && transformLag.hasAuthoritativeSeq
      && transformLag.lag > LOCAL_AUTHORITATIVE_MAX_TRANSFORM_SEQ_LAG
    );
    this.lastAuthoritativeTransformLag = transformLag.lag;
    this.lastSkippedStaleAuthoritativePosition = skipStaleAuthoritativePosition;
    if (died) {
      this.startDeathCameraZoomTransition();
    } else if (respawned) {
      this.resetDeathCameraZoomTransition();
    }
    const portalSpawnLocked = (performance.now() < this.portalSpawnLockUntil) && !respawned && !died;

    if (this.currentInterior?.scene && (died || respawned || !isAlive)) {
      this.exitInterior({ showToast: false });
    }

    if (this.activeInlineShell && (died || respawned || !isAlive)) {
      this.deactivateInlineShell();
    }

    const groundHeight = this.getActiveGroundHeightAt(targetPosition);
    if (!portalSpawnLocked && distance <= LOCAL_AUTHORITATIVE_PORTAL_UNLOCK_DISTANCE) {
      this.portalSpawnLockUntil = 0;
    }

    let snappedToAuthoritativePosition = false;
    if (
      (!this.currentInterior?.scene)
      && !portalSpawnLocked
      && !skipStaleAuthoritativePosition
      && (!this.localStateInitialized || respawned || died || distance > LOCAL_AUTHORITATIVE_HARD_SNAP_DISTANCE)
    ) {
      this.player.position.set(localPlayerState.x, groundHeight, localPlayerState.z);
      snappedToAuthoritativePosition = true;
    } else if (
      isAlive
      && !this.currentInterior?.scene
      && !portalSpawnLocked
      && !skipStaleAuthoritativePosition
      && distance > LOCAL_AUTHORITATIVE_SOFT_RECONCILE_DISTANCE
      && (
        authoritativeSample.staleMs >= LOCAL_AUTHORITATIVE_STALE_RECONCILE_MS
        || distance > LOCAL_AUTHORITATIVE_ACTIVE_RECONCILE_DISTANCE
      )
    ) {
      this.gentlyReconcileLocalPlayerPosition(targetPosition, groundHeight, deltaSeconds);
    }

    this.player.setAliveState(isAlive, {
      startedAtMs: Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
        ? localPlayerState.lastDamagedAt
        : Date.now()
    });
    const localDrunknessLevel = isAlive ? Math.max(0, Math.floor(Number(localPlayerState.drunknessLevel) || 0)) : 0;
    this.player.setDrunknessLevel(localDrunknessLevel);
    this.syncDeliveryPackageVisual(localPlayerState);
    this.hud.setDrunknessState({ level: localDrunknessLevel });
    const localWeaponId = isAlive ? (localPlayerState.equippedWeaponId || '') : '';
    const selectedHotbarWeaponId = this.getSelectedHotbarWeaponId();
    if (
      this.localStateInitialized
      && this.lastLocalAlive
      && isAlive
      && this.lastLocalEquippedWeaponId !== localWeaponId
      && Boolean(localWeaponId)
      && selectedHotbarWeaponId === localWeaponId
      && this.getHotbarEquipAnimationForWeapon(localWeaponId)
      && !this.isHotbarEquipIntroActive(localWeaponId)
    ) {
      this.startHotbarEquipIntro(localWeaponId);
    }
    if (!isAlive) {
      this.cancelHotbarEquipIntro();
    }
    const introWeaponId = this.isHotbarEquipIntroActive() ? (this.hotbarEquipIntro.weaponId || '') : '';
    const displayedWeaponId = introWeaponId && !localWeaponId ? introWeaponId : localWeaponId;
    this.player.setWeaponState(
      displayedWeaponId,
      { visible: isAlive && Boolean(displayedWeaponId) }
    );
    this.player.setReloadState(Boolean(isAlive && localPlayerState.isReloading), {
      weaponId: localWeaponId,
      endsAtMs: localPlayerState.reloadEndsAt ?? 0
    });

    this.maybeStartRentIntro(localPlayerState);
    this.updateRentIntroPresentation();
    this.maybeAnimateMoneyChange(localPlayerState.money ?? 0);
    this.syncMoneyHud(this.getRentIntroMoneyTargetAmount(localPlayerState.money ?? 0));
    this.syncPlayerBoundItemsHud(localPlayerState);

    this.hud.setCombatState({
      visible: true,
      health: localPlayerState.health ?? PLAYER_MAX_HEALTH,
      maxHealth: localPlayerState.maxHealth ?? PLAYER_MAX_HEALTH,
      ammoInClip: localPlayerState.ammoInClip ?? 0,
      reserveAmmo: localPlayerState.reserveAmmo ?? 0,
      isReloading: Boolean(localPlayerState.isReloading),
      reloadEndsAt: localPlayerState.reloadEndsAt ?? 0,
      alive: isAlive,
      respawnAt: localPlayerState.respawnAt ?? 0,
      kills: localPlayerState.kills ?? 0,
      deaths: localPlayerState.deaths ?? 0,
      armed: Boolean(localPlayerState.equippedWeaponId && !this.getSelectedHotbarDrinkItemId() && !this.getSelectedHotbarConsumableItemId())
    });
    this.syncTaskHud(localPlayerState);
    this.syncSkillProgress(localPlayerState);
    if (this.phoneMenuVisible) {
      this.refreshPhoneWalletHud();
      this.refreshPhoneMapHud(localPlayerState);
    }

    if (respawned) {
      this.closeQuickChat();
      this.playSoundEffect(this.rentChaChingSound);
      this.hud.showToast('Respawned.');
      this.updateCamera(this.currentAimDirection, false, { snap: true });
    }

    if (!this.localStateInitialized || respawned || died) {
      this.refreshZoomHud();
    }

    if (snappedToAuthoritativePosition || respawned || died) {
      this.resetLocalPlayerKinematics(this.player.position);
    }

    this.lastLocalAlive = isAlive;
    this.lastLocalEquippedWeaponId = localWeaponId;
    this.localStateInitialized = true;
  }

  projectInputVectorOnCamera(inputVector, target = this.aimDirectionScratch) {
    const forward = this.aimCameraForward;
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() <= 0.000001) {
      return target.set(0, 0, 1);
    }

    forward.normalize().multiplyScalar(-1);
    const right = this.aimCameraRight.set(forward.z, 0, -forward.x).normalize();
    target.set(0, 0, 0);
    target.addScaledVector(right, inputVector.x);
    target.addScaledVector(forward, inputVector.z);
    if (target.lengthSq() > 1) {
      target.normalize();
    }
    return target;
  }

  getAimDirection(target = this.aimDirectionScratch) {
    const aimInputVector = this.input.getAimVector();
    if (aimInputVector) {
      const aimDirection = this.projectInputVectorOnCamera(aimInputVector, target);
      if (aimDirection.lengthSq() > 0.000001) {
        return aimDirection.normalize();
      }
    }

    const pointer = this.input.getPointerPosition();
    this.aimNdc.set(
      (pointer.x / window.innerWidth) * 2 - 1,
      -((pointer.y / window.innerHeight) * 2 - 1)
    );
    this.aimRaycaster.setFromCamera(this.aimNdc, this.camera);
    const groundHeight = this.player?.position.y ?? 0;
    this.aimPlane.constant = -groundHeight;
    if (this.aimRaycaster.ray.intersectPlane(this.aimPlane, this.aimTarget)) {
      target.set(
        this.aimTarget.x - this.player.position.x,
        0,
        this.aimTarget.z - this.player.position.z
      );
      if (target.lengthSq() > AIM_DIRECTION_MIN_DISTANCE * AIM_DIRECTION_MIN_DISTANCE) {
        target.normalize();
        return target;
      }
    }

    return target.copy(this.currentAimDirection);
  }

  getShotVisualPoints(event = {}) {
    const shooterAvatar = this.getAvatarForSessionId(event.shooterId);
    const start = shooterAvatar?.getWeaponMuzzleWorldPosition(new THREE.Vector3())
      ?? new THREE.Vector3(Number(event.fromX) || 0, 2.2, Number(event.fromZ) || 0);
    const end = new THREE.Vector3(Number(event.toX) || start.x, start.y, Number(event.toZ) || start.z);

    if (event.targetId) {
      const targetAvatar = this.getAvatarForSessionId(event.targetId);
      if (targetAvatar) {
        end.y = targetAvatar.position.y + 2.4;
      } else if (event.kind === 'npc') {
        const npcAnchor = this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
        if (npcAnchor) {
          end.y = npcAnchor.y - 2;
        }
      }
    }

    return { start, end };
  }

  getImpactEffectSpec(event = {}) {
    const shooterAvatar = this.getAvatarForSessionId(event.shooterId);
    const origin = shooterAvatar?.getWeaponMuzzleWorldPosition(new THREE.Vector3())
      ?? new THREE.Vector3(Number(event.x) || 0, 2.2, Number(event.z) || 0);
    const point = new THREE.Vector3(Number(event.x) || origin.x, origin.y, Number(event.z) || origin.z);

    if (event.kind === 'player' && event.targetId) {
      const targetAvatar = this.getAvatarForSessionId(event.targetId);
      if (targetAvatar) {
        point.y = targetAvatar.position.y + 2.4;
      }
    } else if (event.kind === 'npc' && event.targetId) {
      const npcAnchor = this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
      if (npcAnchor) {
        point.y = npcAnchor.y - 2;
      }
    } else {
      const groundHeight = this.worldBuilder?.getGroundHeightAt(point) ?? 0;
      point.y = groundHeight + 1.05;
    }

    const travelDistance = origin.distanceTo(point);
    const delayMs = THREE.MathUtils.clamp(
      (travelDistance / PROJECTILE_VISUAL_SPEED) * 1000,
      0,
      PROJECTILE_MAX_LIFETIME_MS
    );

    return { origin, point, delayMs };
  }

  createTracerEffect(start, end) {
    const travel = end.clone().sub(start);
    const distance = travel.length();
    if (distance <= 0.001) {
      return;
    }

    const direction = travel.clone().normalize();
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6d87f,
      transparent: true,
      opacity: 0.92
    });
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([start, start]);
    const trail = new THREE.Line(
      trailGeometry,
      trailMaterial
    );
    this.scene.add(trail);
    const durationMs = THREE.MathUtils.clamp(
      (distance / PROJECTILE_VISUAL_SPEED) * 1000,
      PROJECTILE_MIN_LIFETIME_MS,
      PROJECTILE_MAX_LIFETIME_MS
    );
    this.combatEffects.push({
      type: 'projectile',
      object: trail,
      trail,
      trailGeometry,
      material: trailMaterial,
      start: start.clone(),
      end: end.clone(),
      direction,
      distance,
      startedAt: performance.now(),
      expiresAt: performance.now() + durationMs
    });
  }

  createImpactEffect(position, kind = 'world', delayMs = 0) {
    const now = performance.now();
    let object = null;

    if (kind === 'player') {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0xff8f7a,
          transparent: true,
          opacity: 0.92
        })
      );
      const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.23, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffddd5,
          transparent: true,
          opacity: 0.85,
          depthWrite: false
        })
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.28, 28),
        new THREE.MeshBasicMaterial({
          color: 0xff6d80,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      group.add(core);
      group.add(spark);
      group.add(ring);
      group.position.copy(position);
      group.visible = delayMs <= 0;
      object = group;
      this.scene.add(group);
      this.combatEffects.push({
        type: 'impact',
        object: group,
        core,
        spark,
        ring,
        startAt: now + delayMs,
        expiresAt: now + delayMs + IMPACT_EFFECT_LIFETIME_MS
      });
      return;
    }

    object = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xf2c871,
        transparent: true,
        opacity: 0.9
      })
    );
    object.position.copy(position);
    object.visible = delayMs <= 0;
    this.scene.add(object);
    this.combatEffects.push({
      type: 'impact',
      object,
      material: object.material,
      startAt: now + delayMs,
      expiresAt: now + delayMs + IMPACT_EFFECT_LIFETIME_MS
    });
  }

  createMuzzleFlashEffect(avatar, start, end) {
    const direction = end.clone().sub(start);
    if (direction.lengthSq() <= 0.0001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    const flashGroup = new THREE.Group();
    const attachmentNode = avatar?.getAttachmentPointNode?.('muzzle') ?? null;
    if (attachmentNode) {
      const parentWorldQuaternion = attachmentNode.getWorldQuaternion(new THREE.Quaternion());
      const localDirection = direction.clone().applyQuaternion(parentWorldQuaternion.invert()).normalize();
      flashGroup.position.copy(localDirection).multiplyScalar(0.04);
      flashGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localDirection);
      attachmentNode.add(flashGroup);
    } else {
      flashGroup.position.copy(start).addScaledVector(direction, 0.04);
      flashGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      this.scene.add(flashGroup);
    }

    const resources = this.muzzleFlashResources;
    const flashMaterial = resources.flashMaterialTemplate.clone();
    const flareMaterial = resources.flareMaterialTemplate.clone();
    const emberMaterial = resources.emberMaterialTemplate.clone();

    const core = new THREE.Mesh(resources.coreGeometry, flashMaterial);
    const plume = new THREE.Mesh(resources.plumeGeometry, flareMaterial);
    plume.position.y = 0.3;
    const bloom = new THREE.Mesh(resources.bloomGeometry, flareMaterial.clone());
    bloom.position.y = 0.12;
    bloom.scale.set(0.95, 0.54, 0.95);
    const emberShell = new THREE.Mesh(resources.emberShellGeometry, emberMaterial);
    emberShell.position.y = 0.08;
    emberShell.scale.set(1.08, 0.42, 1.08);
    const shockRing = new THREE.Mesh(
      resources.shockRingGeometry,
      flareMaterial.clone()
    );
    shockRing.position.y = 0.12;
    shockRing.rotation.x = Math.PI / 2;
    const sideFlareA = new THREE.Mesh(
      resources.sideFlareAGeometry,
      flareMaterial.clone()
    );
    sideFlareA.position.set(0.08, 0.2, 0.02);
    sideFlareA.rotation.z = 0.68;
    const sideFlareB = new THREE.Mesh(
      resources.sideFlareBGeometry,
      emberMaterial.clone()
    );
    sideFlareB.position.set(-0.075, 0.18, -0.03);
    sideFlareB.rotation.z = -0.78;

    const sparks = resources.sparkGeometries.map((geometry, index) => {
      const spark = new THREE.Mesh(geometry, resources.sparkMaterialTemplate.clone());
      const offset = resources.sparkOffsets[index];
      spark.position.set(offset.x, offset.y, offset.z);
      spark.rotation.z = offset.zRot;
      return spark;
    });

    const light = new THREE.PointLight(0xff7a24, 2.4, 5.3, 2);
    light.position.y = 0.18;

    flashGroup.add(core);
    flashGroup.add(plume);
    flashGroup.add(bloom);
    flashGroup.add(emberShell);
    flashGroup.add(shockRing);
    flashGroup.add(sideFlareA);
    flashGroup.add(sideFlareB);
    sparks.forEach((spark) => flashGroup.add(spark));
    flashGroup.add(light);
    const now = performance.now();
    this.combatEffects.push({
      type: 'muzzleFlash',
      object: flashGroup,
      sharedGeometry: true,
      core,
      plume,
      bloom,
      emberShell,
      shockRing,
      sideFlareA,
      sideFlareB,
      sparks,
      sparkOffsets: resources.sparkOffsets.map((offset) => cloneVector3Like(offset)),
      light,
      startedAt: now,
      expiresAt: now + MUZZLE_FLASH_LIFETIME_MS
    });
  }

  updateCombatEffects() {
    const now = performance.now();
    const next = [];
    for (const effect of this.combatEffects) {
      if (now >= effect.expiresAt) {
        effect.object.parent?.remove(effect.object);
        if (effect.trail) {
          effect.trail.parent?.remove(effect.trail);
        }
        if (effect.sharedGeometry) {
          disposeObjectMaterials(effect.object);
        } else {
          disposeObjectResources(effect.object);
        }
        effect.trailGeometry?.dispose?.();
        disposeMaterial(effect.material);
        disposeMaterial(effect.secondaryMaterial);
        continue;
      }

      if (effect.type === 'projectile') {
        const lifetime = Math.max(1, effect.expiresAt - effect.startedAt);
        const progress = THREE.MathUtils.clamp((now - effect.startedAt) / lifetime, 0, 1);
        if (effect.trail && effect.trailGeometry) {
          const travelledDistance = effect.distance * progress;
          const tailDistance = Math.max(0, travelledDistance - PROJECTILE_TRAIL_LENGTH);
          const tail = effect.start.clone().addScaledVector(effect.direction, tailDistance);
          const head = effect.start.clone().addScaledVector(effect.direction, travelledDistance);
          effect.trailGeometry.setFromPoints([tail, head]);
        }
        effect.material.opacity = THREE.MathUtils.lerp(0.92, 0.18, progress);
      } else if (effect.type === 'impact') {
        if (now < effect.startAt) {
          next.push(effect);
          continue;
        }

        if (!effect.object.visible) {
          effect.object.visible = true;
        }

        const lifetime = Math.max(1, effect.expiresAt - effect.startAt);
        const progress = THREE.MathUtils.clamp((now - effect.startAt) / lifetime, 0, 1);
        if (effect.core && effect.spark && effect.ring) {
          const burst = 1 + Math.sin(progress * Math.PI) * 0.85;
          effect.object.scale.setScalar(1 + (progress * 0.16));
          effect.core.scale.setScalar(0.92 + (progress * 0.58));
          effect.spark.scale.set(0.78 + (burst * 0.92), 1.18 + (progress * 0.2), 0.78 + (burst * 0.92));
          effect.spark.rotation.x = progress * 1.35;
          effect.spark.rotation.y = progress * 2.6;
          effect.ring.scale.setScalar(0.7 + (progress * 2.35));
          effect.ring.position.y = 0.02 + (progress * 0.06);
          effect.core.material.opacity = Math.max(0, 0.92 - (progress * 1.1));
          effect.spark.material.opacity = Math.max(0, 0.85 - (progress * 1.04));
          effect.ring.material.opacity = Math.max(0, 0.8 - (progress * 1.24));
        } else {
          effect.object.scale.setScalar(1 + (progress * 0.75));
          effect.material.opacity = Math.max(0, 1 - progress);
        }
      } else if (effect.type === 'muzzleFlash') {
        const lifetime = Math.max(1, effect.expiresAt - effect.startedAt);
        const progress = THREE.MathUtils.clamp((now - effect.startedAt) / lifetime, 0, 1);
        const burst = 1 + Math.sin(progress * Math.PI) * 0.92;
        const taper = Math.max(0, 1 - progress);

        effect.core.scale.setScalar(0.56 + burst * 0.62);
        effect.bloom.scale.set(0.86 + burst * 0.62, 0.4 + taper * 0.42, 0.86 + burst * 0.62);
        effect.emberShell.scale.set(0.9 + burst * 0.74, 0.32 + taper * 0.34, 0.9 + burst * 0.74);
        effect.plume.scale.set(1.05 - progress * 0.08, 0.62 + burst * 0.72, 1.05 - progress * 0.08);
        effect.plume.position.y = 0.25 + progress * 0.22;
        effect.bloom.position.y = 0.08 + progress * 0.08;
        effect.emberShell.position.y = 0.04 + progress * 0.05;
        effect.shockRing.scale.setScalar(0.68 + progress * 1.35);
        effect.shockRing.position.y = 0.1 + progress * 0.07;
        effect.shockRing.rotation.z = progress * 0.45;
        effect.sideFlareA.scale.set(1, 0.9 + burst * 0.52, 1);
        effect.sideFlareB.scale.set(1, 0.84 + burst * 0.44, 1);
        effect.sideFlareA.position.y = 0.18 + progress * 0.12;
        effect.sideFlareB.position.y = 0.16 + progress * 0.11;
        effect.object.scale.setScalar(1 + progress * 0.12);

        for (const [index, spark] of effect.sparks.entries()) {
          const offset = effect.sparkOffsets[index];
          const sparkGrowth = 1 + progress * (1.45 + index * 0.34);
          spark.scale.set(1, sparkGrowth, 1);
          spark.position.set(offset.x, offset.y + progress * (0.16 + index * 0.045), offset.z);
        }

        effect.core.material.opacity = 0.98 * taper;
        effect.bloom.material.opacity = 0.72 * taper;
        effect.emberShell.material.opacity = 0.62 * Math.max(0, 1 - progress * 0.9);
        effect.shockRing.material.opacity = 0.66 * Math.max(0, 1 - progress * 1.25);
        effect.sideFlareA.material.opacity = 0.74 * Math.max(0, 1 - progress * 1.15);
        effect.sideFlareB.material.opacity = 0.55 * Math.max(0, 1 - progress);
        effect.plume.material.opacity = 0.88 * Math.max(0, 1 - progress * 1.2);
        effect.sparks.forEach((spark, index) => {
          spark.material.opacity = Math.max(0, 0.95 - progress * (1.2 + index * 0.14));
        });
        effect.light.intensity = 2.4 * Math.max(0, 1 - progress * 1.28);
      }
      next.push(effect);
    }
    this.combatEffects = next;
  }

  handleCombatEvent(event = {}) {
    if (!event?.type) {
      return;
    }

    switch (event.type) {
      case 'shot':
        {
          const shooterAvatar = event.shooterType === 'npc'
            ? null
            : this.getAvatarForSessionId(event.shooterId);
          shooterAvatar?.triggerShotFeedback?.();
          const { start, end } = this.getShotVisualPoints(event);
          if (event.weaponId === HELD_ITEM_IDS.pistol) {
            this.createMuzzleFlashEffect(shooterAvatar, start, end);
          }
          this.createTracerEffect(start, end);
        }
        break;
      case 'impact':
        {
          const { origin, point, delayMs } = this.getImpactEffectSpec(event);
          this.createImpactEffect(point, event.kind, delayMs);
          if (event.kind === 'player' && event.targetId) {
            const runFeedback = () => {
              const targetAvatar = this.getAvatarForSessionId(event.targetId);
              const damageDirection = point.clone().sub(origin);
              damageDirection.y = 0;
              if (damageDirection.lengthSq() <= 0.0001 && targetAvatar?.position) {
                damageDirection.subVectors(targetAvatar.position, origin);
                damageDirection.y = 0;
              }
              if (damageDirection.lengthSq() <= 0.0001) {
                damageDirection.set(0, 0, 1);
              } else {
                damageDirection.normalize();
              }

              targetAvatar?.triggerDamageFeedback?.({ direction: damageDirection });
              if (event.targetId === this.npcServiceState.sessionId) {
                this.triggerDamageCameraFeedback(damageDirection);
              }
            };

            if (delayMs > 0) {
              window.setTimeout(runFeedback, delayMs);
            } else {
              runFeedback();
            }
          } else if (event.kind === 'npc' && event.targetId) {
            const runFeedback = () => {
              const damageDirection = point.clone().sub(origin);
              damageDirection.y = 0;
              if (damageDirection.lengthSq() <= 0.0001) {
                damageDirection.set(0, 0, 1);
              } else {
                damageDirection.normalize();
              }
              this.worldBuilder?.triggerNpcDamageFeedback(event.targetId, { direction: damageDirection });
            };

            if (delayMs > 0) {
              window.setTimeout(runFeedback, delayMs);
            } else {
              runFeedback();
            }
          }
        }
        if ((event.kind === 'player' || event.kind === 'npc') && event.shooterId === this.npcServiceState.sessionId) {
          this.hitMarkerUntil = performance.now() + 120;
        }
        break;
      case 'pickup':
        if (event.playerId === this.npcServiceState.sessionId) {
          const preferredSlotIndex = getPreferredHotbarSlotIndexForItem(event.weaponId, this.hotbarItemOrder);
          if (preferredSlotIndex >= 0) {
            this.selectedHotbarSlotIndex = preferredSlotIndex;
            this.pendingHotbarWeaponId = null;
            this.refreshHotbarHud();
            if (this.getHotbarEquipAnimationForWeapon(event.weaponId) && !this.isHotbarEquipIntroActive(event.weaponId)) {
              this.startHotbarEquipIntro(event.weaponId);
            }
          }
          this.hud.showToast(`${getItemLabel(event.weaponId, 'Item')} equipped.`);
        }
        break;
      case 'reload':
        {
          const avatar = this.getAvatarForSessionId(event.playerId);
          avatar?.setReloadState?.(true, {
            weaponId: event.weaponId,
            startedAtMs: Number(event.startedAt ?? 0),
            endsAtMs: Number(event.endsAt ?? 0)
          });
          this.playHotbarEquipSound(getItemEquipAnimationForWeapon(event.weaponId)?.soundId ?? '');
        }
        break;
      case 'death':
        if (event.victimType === 'npc') {
          this.worldBuilder?.triggerNpcDamageFeedback(event.victimId);
        } else if (event.victimId === this.npcServiceState.sessionId) {
          this.hud.showToast('You are down.');
        }
        break;
      case 'respawn':
        break;
      default:
        break;
    }
  }

  reportNpcTransportState() {
    const signature = `${this.npcServiceState.transport}:${this.npcServiceState.connected}:${this.npcServiceState.sessionId ?? ''}`;
    if (signature === this.lastNpcTransportSignature) {
      return;
    }

    this.lastNpcTransportSignature = signature;
    console.info('[NPC] Active transport state changed.', {
      transport: this.npcServiceState.transport,
      connected: this.npcServiceState.connected,
      sessionId: this.npcServiceState.sessionId ?? null,
      npcCount: this.npcServiceState.npcs.size,
      connectedPlayerCount: this.npcServiceState.connectedPlayerCount ?? this.npcServiceState.players.size
    });
  }

  getConnectionHudInfo() {
    const state = this.npcServiceState ?? {};
    const transport = String(state.transport ?? '');
    const connected = state.connected !== false;
    const statePlayerCount = Number(state.connectedPlayerCount);
    const fallbackPlayerCount = state.players instanceof Map ? state.players.size : 0;
    const activePlayerCount = Math.max(0, Math.floor(
      Number.isFinite(statePlayerCount) ? statePlayerCount : fallbackPlayerCount
    ));
    const rawStatus = String(
      state.connectionStatus
      || (connected ? 'online' : 'offline')
    ).toLowerCase();

    if (transport === 'mock') {
      return {
        status: 'local',
        label: 'Local',
        detail: state.connectionMessage || 'Local mock transport is active.'
      };
    }

    if (this.frontendUpdateAvailable && connected) {
      const shortSha = this.frontendUpdateCommitSha ? this.frontendUpdateCommitSha.slice(0, 7) : '';
      return {
        status: 'update-ready',
        label: 'Update ready',
        detail: shortSha ? `New frontend build ${shortSha} is live.` : 'A new frontend build is live.',
        activePlayerCount
      };
    }

    const fallbackLabels = {
      connecting: 'Connecting',
      online: 'Online',
      reconnecting: 'Reconnecting',
      rejoining: 'Rejoining',
      updating: 'Server updating',
      offline: 'Offline'
    };
    return {
      status: rawStatus,
      label: fallbackLabels[rawStatus] || (connected ? 'Online' : 'Offline'),
      detail: state.connectionMessage || (connected ? 'Connected to multiplayer.' : 'Disconnected from multiplayer.'),
      activePlayerCount: connected && rawStatus === 'online' ? activePlayerCount : null
    };
  }

  refreshConnectionHud({ force = false } = {}) {
    const info = this.getConnectionHudInfo();
    const signature = JSON.stringify(info);
    if (!force && signature === this.lastConnectionHudSignature) {
      return;
    }

    const previousStatus = this.lastConnectionToastStatus;
    this.lastConnectionHudSignature = signature;
    this.hud.setConnectionStatus(info);

    if (info.status === this.lastConnectionToastStatus) {
      return;
    }

    this.lastConnectionToastStatus = info.status;
    if (['reconnecting', 'rejoining', 'updating', 'offline'].includes(info.status)) {
      this.hud.showToast(info.detail);
    } else if (info.status === 'online' && previousStatus && !['online', 'local', 'update-ready'].includes(previousStatus)) {
      this.hud.showToast('Back online.');
    }
  }

  startReleaseVersionPolling() {
    if (this.releaseVersionTimer || !this.currentBuildCommitSha) {
      return;
    }

    this.releaseVersionTimer = window.setInterval(() => {
      void this.checkReleaseVersion();
    }, RELEASE_VERSION_CHECK_MS);
    this.releaseVersionVisibilityHandler = () => {
      if (!document.hidden) {
        void this.checkReleaseVersion({ force: true });
      }
    };
    document.addEventListener('visibilitychange', this.releaseVersionVisibilityHandler);
    window.addEventListener('focus', this.releaseVersionVisibilityHandler);
    void this.checkReleaseVersion({ force: true });
  }

  async checkReleaseVersion({ force = false } = {}) {
    if (this.releaseVersionCheckInFlight || !this.currentBuildCommitSha || (this.frontendUpdateAvailable && !force)) {
      return;
    }

    this.releaseVersionCheckInFlight = true;
    try {
      const response = await fetch(`${RELEASE_VERSION_ENDPOINT}?_=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }

      const version = await response.json();
      const latestCommitSha = String(version?.commitSha ?? version?.buildCommitSha ?? '').trim();
      if (!latestCommitSha || latestCommitSha === this.currentBuildCommitSha) {
        return;
      }

      this.markFrontendUpdateAvailable(latestCommitSha);
    } catch {
      // Version polling is opportunistic; connection state handles hard server failures.
    } finally {
      this.releaseVersionCheckInFlight = false;
    }
  }

  markFrontendUpdateAvailable(commitSha = '') {
    if (this.frontendUpdateAvailable) {
      return;
    }

    this.frontendUpdateAvailable = true;
    this.frontendUpdateCommitSha = String(commitSha ?? '').trim();
    this.releaseReloadScheduledAt = performance.now() + RELEASE_RELOAD_DELAY_MS;
    this.hud.showToast('New game update is live. Reloading when safe...');
    this.refreshConnectionHud({ force: true });
  }

  isSafeToAutoReloadFrontend() {
    if (document.hidden) {
      return true;
    }

    if (this.npcServiceState.transport === 'colyseus' && this.npcServiceState.connected === false) {
      return true;
    }

    return !this.worldBuilder?.enabled
      && !this.activeWorkout
      && !this.emoteMenuOpen
      && !this.hud.isQuickChatOpen()
      && !this.hud.isAdminPromptOpen()
      && !this.hud.isPhoneOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen();
  }

  processPendingFrontendReload() {
    if (this.releaseReloadStarted || !this.frontendUpdateAvailable || performance.now() < this.releaseReloadScheduledAt) {
      return;
    }

    if (this.isSafeToAutoReloadFrontend()) {
      this.releaseReloadStarted = true;
      void this.npcService?.destroy?.();
      window.setTimeout(() => {
        window.location.reload();
      }, 120);
      return;
    }

    if (performance.now() >= this.releaseReloadDelayToastAt) {
      this.releaseReloadDelayToastAt = performance.now() + 12000;
      this.hud.showToast('Update ready. Close active panels to reload.');
    }
  }

  getActiveEmoteSelection() {
    const pointer = this.input.getPointerPosition();
    const centerX = window.innerWidth * 0.5;
    const centerY = window.innerHeight * 0.5;
    const offsetX = pointer.x - centerX;
    const offsetY = pointer.y - centerY;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance < EMOTE_MENU_DEADZONE) {
      return { index: -1, entry: null, hasSelection: false };
    }

    const angle = Math.atan2(offsetY, offsetX);
    const normalizedAngle = (angle + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2);
    const index = Math.floor(normalizedAngle / (Math.PI / 4));
    const entry = EMOTE_SLOTS[index] ?? null;
    const hasSelection = Boolean(entry?.id);
    return { index, entry, hasSelection };
  }

  updateEmoteMenu() {
    const holdingEmoteKey = this.input.isActionPressed('emote');

    if (
      holdingEmoteKey
      && !this.worldBuilder.enabled
      && !this.hud.isPhoneOpen()
      && !this.hud.isQuickChatOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen()
    ) {
      const selection = this.getActiveEmoteSelection();
      this.emoteMenuOpen = true;
      this.hud.setEmoteMenuState({
        open: true,
        activeIndex: selection.index,
        selectedLabel: selection.entry?.label ?? '',
        hasSelection: selection.hasSelection
      });
      return true;
    }

    if (this.emoteMenuOpen) {
      const selection = this.getActiveEmoteSelection();
      if (selection.hasSelection) {
        const played = this.player.playEmote(selection.entry.id);
        this.hud.showToast(played ? `${selection.entry.label} emote` : `${selection.entry.label} is unavailable right now.`);
      }
    }

    this.emoteMenuOpen = false;
    this.hud.setEmoteMenuState({ open: false });
    return false;
  }

  getBaseCameraZoomLevel() {
    return CAMERA_ZOOM_LEVELS[this.cameraZoomIndex] ?? CAMERA_ZOOM_LEVELS[DEFAULT_CAMERA_ZOOM_INDEX];
  }

  isDeathCameraActive() {
    return Boolean(!this.worldBuilder?.enabled && this.getLocalPlayerState()?.alive === false);
  }

  startDeathCameraZoomTransition() {
    this.deathCameraZoomStartedAt = performance.now();
    this.deathCameraZoomFromLevel = this.getBaseCameraZoomLevel();
  }

  resetDeathCameraZoomTransition() {
    this.deathCameraZoomStartedAt = -Infinity;
    this.deathCameraZoomFromLevel = this.getBaseCameraZoomLevel();
  }

  getDeathCameraZoomLevel() {
    if (!Number.isFinite(this.deathCameraZoomStartedAt) || this.deathCameraZoomStartedAt < 0) {
      return DEATH_CAMERA_ZOOM_LEVEL;
    }

    const progress = THREE.MathUtils.clamp(
      (performance.now() - this.deathCameraZoomStartedAt) / DEATH_CAMERA_ZOOM_TRANSITION_MS,
      0,
      1
    );
    const easedProgress = progress * progress * (3 - (2 * progress));
    return THREE.MathUtils.lerp(this.deathCameraZoomFromLevel, DEATH_CAMERA_ZOOM_LEVEL, easedProgress);
  }

  getCameraZoomLevel() {
    return this.isDeathCameraActive() ? this.getDeathCameraZoomLevel() : this.getBaseCameraZoomLevel();
  }

  setCameraZoomIndex(nextIndex) {
    const clampedIndex = THREE.MathUtils.clamp(nextIndex, 0, CAMERA_ZOOM_LEVELS.length - 1);
    if (clampedIndex === this.cameraZoomIndex) {
      this.refreshZoomHud();
      return false;
    }

    this.cameraZoomIndex = clampedIndex;
    this.refreshZoomHud();
    return true;
  }

  stepCameraZoom(step) {
    return this.setCameraZoomIndex(this.cameraZoomIndex + step);
  }

  getSelectedHotbarSlot() {
    return getHotbarSlot(this.selectedHotbarSlotIndex, this.hotbarSlots) ?? this.hotbarSlots[0] ?? null;
  }

  getSelectedHotbarItemId() {
    return this.getSelectedHotbarSlot()?.itemId || '';
  }

  getSelectedHotbarWeaponId() {
    return getHotbarEquippedWeaponId(this.getSelectedHotbarSlot());
  }

  getSelectedHotbarDrinkItemId() {
    return getHotbarDrinkItemId(this.getSelectedHotbarSlot());
  }

  getSelectedHotbarConsumableItemId() {
    return getHotbarConsumableItemId(this.getSelectedHotbarSlot());
  }

  getSelectedHotbarEquipAnimation() {
    return getItemEquipAnimation(this.getSelectedHotbarItemId());
  }

  getHotbarEquipAnimationForWeapon(weaponId = '') {
    const normalizedWeaponId = String(weaponId ?? '').trim();
    if (!normalizedWeaponId) {
      return null;
    }

    const selectedSlot = this.getSelectedHotbarSlot();
    if (getHotbarEquippedWeaponId(selectedSlot) === normalizedWeaponId) {
      return this.getSelectedHotbarEquipAnimation();
    }

    return getItemEquipAnimationForWeapon(normalizedWeaponId);
  }

  canUseHotbarInput() {
    return Boolean(
      this.player
      && !this.hud.isLoadingVisible()
      && !this.worldBuilder?.enabled
      && !this.emoteMenuOpen
      && !this.hud.isPhoneOpen()
      && !this.hud.isQuickChatOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen()
      && !this.hud.isAdminPromptOpen()
      && !this.characterSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
  }

  isHotbarEquipIntroActive(weaponId = '') {
    const intro = this.hotbarEquipIntro;
    if (!intro?.weaponId) {
      return false;
    }
    if (weaponId && intro.weaponId !== weaponId) {
      return false;
    }
    return !Number.isFinite(intro.endsAtMs) || Date.now() < intro.endsAtMs;
  }

  cancelHotbarEquipIntro() {
    const intro = this.hotbarEquipIntro;
    const weaponId = intro?.weaponId || '';
    if (intro?.revealTimeoutId) {
      window.clearTimeout(intro.revealTimeoutId);
    }
    this.hotbarEquipIntro = {
      weaponId: '',
      startedAtMs: 0,
      endsAtMs: 0,
      token: (intro?.token ?? 0) + 1,
      revealTimeoutId: 0,
      animation: null
    };
    if (weaponId) {
      this.player?.stopReloadPreview?.();
    }
  }

  isHotbarEquipIntroUseLocked(weaponId = '') {
    if (!this.isHotbarEquipIntroActive(weaponId)) {
      return false;
    }

    return this.hotbarEquipIntro?.animation?.lockUse !== false;
  }

  completeHotbarEquipIntro(token) {
    const intro = this.hotbarEquipIntro;
    if (!intro?.weaponId || intro.token !== token) {
      return;
    }

    const weaponId = intro.weaponId;
    const localPlayerState = this.getLocalPlayerState();
    const shouldReveal = Boolean(
      this.player
      && localPlayerState
      && localPlayerState.alive !== false
      && localPlayerState.equippedWeaponId === weaponId
      && this.getSelectedHotbarWeaponId() === weaponId
    );

    this.hotbarEquipIntro = {
      weaponId: '',
      startedAtMs: 0,
      endsAtMs: 0,
      token: token + 1,
      revealTimeoutId: 0,
      animation: null
    };
    this.player?.stopReloadPreview?.();
    if (shouldReveal) {
      void this.player.setWeaponState(weaponId, { visible: true });
    } else {
      const fallbackWeaponId = localPlayerState?.alive !== false ? (localPlayerState?.equippedWeaponId || '') : '';
      void this.player?.setWeaponState?.(fallbackWeaponId, { visible: Boolean(fallbackWeaponId) });
    }
  }

  playHotbarEquipSound(soundId = '') {
    if (soundId === 'pistolCock') {
      this.playSoundEffect(this.pistolCockSound);
    }
  }

  startHotbarEquipIntro(weaponId) {
    const animation = this.getHotbarEquipAnimationForWeapon(weaponId);
    if (!animation || !this.player) {
      return false;
    }

    this.cancelHotbarEquipIntro();
    this.clearPendingHipFireShot();
    this.currentAimMode = false;
    this.player.setAimingState(false);

    const token = (this.hotbarEquipIntro?.token ?? 0) + 1;
    const durationMs = Math.max(100, Number(animation.durationMs) || 0);
    this.hotbarEquipIntro = {
      weaponId,
      startedAtMs: 0,
      endsAtMs: Number.POSITIVE_INFINITY,
      token,
      revealTimeoutId: 0,
      animation
    };

    void Promise.resolve(this.player.setWeaponState(weaponId, { visible: true }))
      .then(() => {
        if (!this.hotbarEquipIntro?.weaponId || this.hotbarEquipIntro.token !== token) {
          return;
        }

        const startedAtMs = Date.now();
        const endsAtMs = startedAtMs + durationMs;
        this.hotbarEquipIntro = {
          weaponId,
          startedAtMs,
          endsAtMs,
          token,
          revealTimeoutId: window.setTimeout(
            () => this.completeHotbarEquipIntro(token),
            durationMs
          ),
          animation
        };
        if (!animation.previewReload || this.player.previewReload?.(weaponId, durationMs) !== false) {
          this.playHotbarEquipSound(animation.soundId);
        }
      })
      .catch((error) => {
        console.warn('[Combat] Failed to play hotbar equip intro.', error);
        if (this.hotbarEquipIntro?.token === token) {
          this.completeHotbarEquipIntro(token);
        }
      });

    return true;
  }

  syncPlayerBoundItemsHud(localPlayerState = this.getLocalPlayerState()) {
    this.hud.setPlayerBoundItemsState({
      skateboardOwned: isPlayerSkateboardOwner(localPlayerState),
      skating: Boolean(localPlayerState?.skating),
      vehicleItemId: getPlayerVehicleItemId(localPlayerState),
      vehicleLabel: getPlayerVehicleMenuItem(localPlayerState)?.label ?? ''
    });
  }

  createCurrentHotbarSlots(localPlayerState = this.getLocalPlayerState()) {
    return createHotbarSlots({
      ownedWeaponIds: localPlayerState?.ownedWeaponIds ?? '',
      equippedWeaponId: localPlayerState?.equippedWeaponId ?? '',
      beerCount: localPlayerState?.beerCount ?? 0,
      shotCount: localPlayerState?.shotCount ?? 0,
      cigaretteCount: localPlayerState?.cigaretteCount ?? 0,
      burgerCount: localPlayerState?.burgerCount ?? 0,
      glizzyCount: localPlayerState?.glizzyCount ?? 0,
      sodaCount: localPlayerState?.sodaCount ?? 0,
      hotbarItemOrder: this.hotbarItemOrder
    });
  }

  refreshHotbarHud() {
    this.hotbarSlots = this.createCurrentHotbarSlots();

    this.hud.setHotbarState({
      visible: true,
      slots: this.hotbarSlots,
      selectedIndex: this.selectedHotbarSlotIndex,
      disabled: !this.canUseHotbarInput()
    });
  }

  moveHotbarSlot(fromSlotIndex, toSlotIndex) {
    if (!this.canUseHotbarInput()) {
      return false;
    }

    const normalizedFromIndex = normalizeHotbarSlotIndex(fromSlotIndex);
    const normalizedToIndex = normalizeHotbarSlotIndex(toSlotIndex);
    if (
      normalizedFromIndex < 0
      || normalizedToIndex < 0
      || normalizedFromIndex === normalizedToIndex
    ) {
      return false;
    }

    const selectedItemId = this.getSelectedHotbarSlot()?.itemId || '';
    const nextOrder = moveHotbarItemOrderSlot(
      this.hotbarItemOrder,
      normalizedFromIndex,
      normalizedToIndex
    );
    if (nextOrder.join('|') === this.hotbarItemOrder.join('|')) {
      return false;
    }

    this.hotbarItemOrder = nextOrder;
    writeStoredHotbarItemOrder(this.hotbarItemOrder);
    this.hotbarSlots = this.createCurrentHotbarSlots();

    if (selectedItemId) {
      const nextSelectedIndex = this.hotbarSlots.findIndex((slot) => slot.itemId === selectedItemId);
      if (nextSelectedIndex >= 0) {
        this.selectedHotbarSlotIndex = nextSelectedIndex;
      }
    }

    this.refreshHotbarHud();
    this.applyHotbarSelection({ force: true });
    return true;
  }

  selectHotbarSlot(slotIndex, { source = 'keyboard' } = {}) {
    if (!this.canUseHotbarInput()) {
      return false;
    }

    const normalizedIndex = normalizeHotbarSlotIndex(slotIndex);
    if (normalizedIndex < 0) {
      return false;
    }

    const previousWeaponId = this.getSelectedHotbarWeaponId();
    const changed = normalizedIndex !== this.selectedHotbarSlotIndex;
    this.selectedHotbarSlotIndex = normalizedIndex;
    this.refreshHotbarHud();
    const nextWeaponId = this.getSelectedHotbarWeaponId();
    this.applyHotbarSelection({ force: changed || source === 'pointer' });

    const nextEquipAnimation = this.getHotbarEquipAnimationForWeapon(nextWeaponId);
    if (changed && previousWeaponId !== nextWeaponId && !nextEquipAnimation) {
      this.clearPendingHipFireShot();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
    }

    return true;
  }

  handleHotbarKeyboardInput() {
    if (!this.canUseHotbarInput()) {
      return false;
    }

    const keyEvent = this.input.consumeNextKeyEvent(HOTBAR_KEY_CODES);
    if (!keyEvent) {
      return false;
    }

    const slotIndex = getHotbarSlotIndexFromKeyCode(keyEvent.code);
    return this.selectHotbarSlot(slotIndex, { source: 'keyboard' });
  }

  applyHotbarSelection({ force = false } = {}) {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.npcService || !localPlayerState || localPlayerState.alive === false) {
      return false;
    }

    const desiredWeaponId = this.getSelectedHotbarWeaponId();
    const currentWeaponId = localPlayerState.equippedWeaponId || '';
    const desiredEquipAnimation = this.getHotbarEquipAnimationForWeapon(desiredWeaponId);
    if (!force && currentWeaponId === desiredWeaponId) {
      this.pendingHotbarWeaponId = null;
      return false;
    }

    const now = performance.now();
    if (
      this.pendingHotbarWeaponId === desiredWeaponId
      && now - this.pendingHotbarRequestedAt < 500
    ) {
      return false;
    }

    this.pendingHotbarWeaponId = desiredWeaponId;
    this.pendingHotbarRequestedAt = now;
    this.npcService.equipWeapon?.(desiredWeaponId);

    if (!desiredWeaponId) {
      this.cancelHotbarEquipIntro();
      this.clearPendingHipFireShot();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
    } else if (desiredEquipAnimation && currentWeaponId !== desiredWeaponId) {
      this.startHotbarEquipIntro(desiredWeaponId);
      return true;
    } else if (!desiredEquipAnimation || !this.isHotbarEquipIntroActive(desiredWeaponId)) {
      this.cancelHotbarEquipIntro();
    }
    void this.player?.setWeaponState?.(desiredWeaponId, {
      visible: Boolean(desiredWeaponId)
    });
    return true;
  }

  syncSelectedHotbarEquipment(localPlayerState = this.getLocalPlayerState()) {
    if (!localPlayerState || localPlayerState.alive === false) {
      return;
    }

    const desiredWeaponId = this.getSelectedHotbarWeaponId();
    const currentWeaponId = localPlayerState.equippedWeaponId || '';
    if (this.pendingHotbarWeaponId !== null && currentWeaponId === this.pendingHotbarWeaponId) {
      this.pendingHotbarWeaponId = null;
    }
    if (this.pendingHotbarWeaponId !== null) {
      if (performance.now() - this.pendingHotbarRequestedAt < 500) {
        void this.player?.setWeaponState?.(this.pendingHotbarWeaponId, {
          visible: Boolean(this.pendingHotbarWeaponId)
        });
      }
      return;
    }
    if (currentWeaponId === desiredWeaponId) {
      return;
    }

    this.applyHotbarSelection({ force: true });
  }

  refreshZoomHud() {
    const builderEnabled = Boolean(this.worldBuilder?.enabled);
    const deathCameraActive = this.isDeathCameraActive();
    const zoomPercent = Math.round((1 / (deathCameraActive ? DEATH_CAMERA_ZOOM_LEVEL : this.getBaseCameraZoomLevel())) * 100);
    this.hud.setZoomState({
      label: `${zoomPercent}%`,
      hint: deathCameraActive ? 'Respawning' : (builderEnabled ? 'Builder wheel' : 'Wheel / +/-'),
      disabled: builderEnabled || deathCameraActive,
      canZoomIn: this.cameraZoomIndex > 0,
      canZoomOut: this.cameraZoomIndex < CAMERA_ZOOM_LEVELS.length - 1
    });
  }

  syncMobileControlsHud(localPlayerState = this.getLocalPlayerState()) {
    const selectedDrinkItemId = this.getSelectedHotbarDrinkItemId();
    const selectedConsumableItemId = this.getSelectedHotbarConsumableItemId();
    const visible = Boolean(
      this.player
      && !this.hud.isLoadingVisible()
      && !this.worldBuilder?.enabled
      && !this.hud.isPhoneOpen()
      && !this.hud.isQuickChatOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen()
      && !this.characterSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
    const armed = Boolean(localPlayerState?.alive !== false && localPlayerState?.equippedWeaponId && !selectedDrinkItemId && !selectedConsumableItemId);
    const fireLabel = selectedDrinkItemId
      ? 'Drink'
      : (selectedConsumableItemId ? getItemActionLabel(this.getSelectedHotbarItemId()) : (armed ? 'Fire' : 'Hit'));

    this.hud.setMobileControlsState({ visible, armed, fireLabel });
    this.input.setTouchControlsEnabled(visible);
  }

  handleCameraZoomInput(localPlayerState = this.getLocalPlayerState()) {
    if (this.worldBuilder?.enabled || this.hud.isPhoneOpen() || this.hud.isVibeHeroOpen() || localPlayerState?.alive === false) {
      this.input.consumeAction('zoomIn');
      this.input.consumeAction('zoomOut');
      this.input.consumeWheelDirection();
      return;
    }

    if (this.input.consumeAction('zoomIn')) {
      this.stepCameraZoom(-1);
    }

    if (this.input.consumeAction('zoomOut')) {
      this.stepCameraZoom(1);
    }

    const wheelDirection = this.input.consumeWheelDirection();
    if (wheelDirection !== 0) {
      this.stepCameraZoom(Math.sign(wheelDirection));
    }
  }

  frame() {
    if (!this.firstFrameMarked) {
      this.firstFrameMarked = true;
      this.markBoot('boot:first-frame');
      this.measureBoot('timeToFirstFrame', 'boot:start', 'boot:first-frame');
      if (this.deferredStartupPromise) {
        queueMicrotask(() => this.reportBootMetrics());
      }
    }

    const rawDeltaSeconds = this.clock.getDelta();
    const deltaSeconds = Math.min(rawDeltaSeconds, FRAME_DELTA_MAX_SECONDS);
    this.recordMovementFrameTiming(rawDeltaSeconds, deltaSeconds);
    const localPlayerState = this.getLocalPlayerState();
    this.processPendingFrontendReload();
    this.syncMobileControlsHud(localPlayerState);
    const rentIntroCutsceneActiveAtFrameStart = this.isRentIntroCutsceneActive();
    const emoteMenuActive = rentIntroCutsceneActiveAtFrameStart ? false : this.updateEmoteMenu();
    this.refreshHotbarHud();
    if (this.hud.isStockMarketOpen()) {
      void this.refreshStockMarket();
    } else if (localPlayerState?.alive !== false) {
      void this.refreshWalletSnapshot({ passive: true });
    }
    this.updateAdminPromptPolling();
    if (this.hud.isSchoolMicrogameOpen()) {
      this.updateSchoolMicrogame(deltaSeconds);
      this.updateSchoolTeacherPreview(deltaSeconds);
    }
    if (this.hud.isVibeHeroOpen()) {
      this.updateVibeHero(deltaSeconds);
    }

    if (!rentIntroCutsceneActiveAtFrameStart && this.input.consume('KeyO') && this.canUseAimPoseDebug()) {
      this.toggleAimPoseDebugPanel();
    }

    if (!rentIntroCutsceneActiveAtFrameStart && this.input.consumeAction('escape')) {
      if (this.hud.isQuickChatOpen()) {
        this.closeQuickChat();
      } else if (this.hud.isAdminPromptOpen()) {
        this.setAdminPromptOpen(false);
      } else if (this.hud.isPhoneOpen()) {
        this.closePhoneMenu();
      } else if (this.hud.isStockMarketOpen()) {
        this.closeStockMarket();
      } else if (this.hud.isBlackjackOpen()) {
        this.closeBlackjack();
      } else if (this.hud.isVibeHeroOpen()) {
        this.closeVibeHero();
      } else if (this.hud.isSchoolMicrogameOpen()) {
        this.closeSchoolMicrogame();
      } else if (this.hud.isInteractionMenuOpen()) {
        this.closeInteractionMenu();
      } else if (this.characterSelectorVisible) {
        this.setCharacterSelectorVisible(false);
      } else if (this.shaderDebugMenuVisible) {
        this.setShaderDebugMenuVisible(false);
      }
    }

    if (
      !this.worldBuilder?.enabled
      && !rentIntroCutsceneActiveAtFrameStart
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.hud.isInteractionMenuOpen()
      && this.input.consumeAction('phone')
    ) {
      this.togglePhoneMenu();
    }

    if (!rentIntroCutsceneActiveAtFrameStart) {
      this.handleCameraZoomInput(localPlayerState);
      this.handlePhoneMapKeyboardInput(deltaSeconds);
      this.handleHotbarKeyboardInput();
    }
    this.updateNpcFocusTargets();

    if (
      this.input.consumeAction('chat')
      && !rentIntroCutsceneActiveAtFrameStart
      && this.canOpenQuickChatFromInput({ emoteMenuActive })
    ) {
      this.openQuickChat();
    }

    if (localPlayerState) {
      this.syncLocalPlayerState(localPlayerState, deltaSeconds);
      this.syncSelectedHotbarEquipment(localPlayerState);
    } else {
      this.syncTaskHud(null);
    }

    this.worldBuilder.update(deltaSeconds, this.input);

    if (this.worldBuilder.enabled) {
      this.suspendInlineShellForBuilder();
      this.worldBuilder.syncInteriorPlacementPreview();
      this.clearPendingHipFireShot();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
      this.player?.setSkateboardState?.({ skating: false });
      this.updateBuilderCamera();
      this.currentInteractable = null;
      this.hud.setPrompt(null);
    } else {
      const rentIntroCutsceneActive = this.isRentIntroCutsceneActive();
      const localAlive = localPlayerState?.alive !== false;
      const stockMarketOpen = this.hud.isStockMarketOpen();
      const blackjackOpen = this.hud.isBlackjackOpen();
      const schoolMicrogameOpen = this.hud.isSchoolMicrogameOpen();
      const vibeHeroOpen = this.hud.isVibeHeroOpen();
      const interactionMenuOpen = this.hud.isInteractionMenuOpen();
      const adminPromptOpen = this.hud.isAdminPromptOpen();
      const phoneOpen = this.hud.isPhoneOpen();
      const selectedDrinkItemId = this.getSelectedHotbarDrinkItemId();
      const selectedConsumableItemId = this.getSelectedHotbarConsumableItemId();
      const consumableSelected = Boolean(selectedDrinkItemId || selectedConsumableItemId);
      const armed = Boolean(localAlive && localPlayerState?.equippedWeaponId && !consumableSelected);
      const canCursorAim = localAlive && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !interactionMenuOpen && !adminPromptOpen && !phoneOpen;
      const activeColliders = this.getActiveColliders();
      const groundHeight = this.getActiveGroundHeightAt(this.player.position);
      const activeSceneBounds = this.getActiveSceneBounds();
      const hipFirePending = this.pendingHipFireShot;
      const hipFirePoseActive = Boolean(hipFirePending && performance.now() < hipFirePending.releaseAt);
      const aimDirection = canCursorAim
        ? this.getAimDirection()
        : this.aimDirectionScratch.copy(this.currentAimDirection);
      this.currentAimDirection.copy(aimDirection);
      this.player.setAimRotation(Math.atan2(aimDirection.x, aimDirection.z));
      if (localAlive && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !adminPromptOpen && !phoneOpen && this.input.consume('KeyP')) {
        const isLimp = this.player.toggleLimp();
        this.hud.showToast(isLimp ? 'Limbo mode engaged.' : 'Back on your feet.');
      }
      const playerInput = (!localAlive || rentIntroCutsceneActive || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || adminPromptOpen || phoneOpen) ? ZERO_INPUT : this.input;
      const skateboardOwned = isPlayerSkateboardOwner(localPlayerState);
      const vehicleItemId = getPlayerVehicleItemId(localPlayerState);
      const vehicleLabel = getPlayerVehicleMenuItem(localPlayerState)?.label ?? '';
      const skateboardMovementInput = playerInput !== ZERO_INPUT ? this.input.getMovementVector() : ZERO_MOVEMENT_VECTOR;
      const skatingInputHeld = Boolean(
        skateboardOwned
        && playerInput !== ZERO_INPUT
        && this.input.isActionPressed('skate')
        && (skateboardMovementInput.x !== 0 || skateboardMovementInput.z !== 0)
      );
      const movementCameraForward = armed && playerInput !== ZERO_INPUT && this.input.isActionPressed('aim')
        ? AIM_CAMERA_MOVEMENT_FORWARD
        : CAMERA_MOVEMENT_FORWARD;
      this.hud.setPlayerBoundItemsState({ skateboardOwned, skating: skatingInputHeld, vehicleItemId, vehicleLabel });
      const workoutActive = this.updateActiveWorkout(deltaSeconds, {
        localAlive,
        colliders: activeColliders,
        sceneBounds: activeSceneBounds,
        groundHeight
      });
      let aimingMode = false;

      if (workoutActive) {
        this.clearPendingHipFireShot();
        this.currentAimMode = false;
        this.player.setSkateboardState?.({ owned: skateboardOwned, skating: false, vehicleItemId });
        const facing = this.player.object.rotation.y;
        this.currentAimDirection.set(Math.sin(facing), 0, Math.cos(facing)).normalize();
        this.syncInlineShellState();
        if (this.activeWorkout?.activityConfig?.basketballShot) {
          this.updateBasketballShotCamera();
        } else {
          this.updateCamera(this.currentAimDirection, false);
        }
        this.currentInteractable = null;
        this.hud.setPrompt(null);
      } else {
        this.player.update(
          deltaSeconds,
          playerInput,
          this.camera,
          activeColliders,
          activeSceneBounds,
          groundHeight,
          {
            skateboardOwned,
            vehicleItemId,
            skating: skatingInputHeld,
            speedScale: SKATEBOARD_SPEED_MULTIPLIER,
            movementCameraForward
          }
        );
        this.syncInlineShellState();
        const combatInputEnabled = localAlive && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !adminPromptOpen && !phoneOpen;
        const primaryFirePressed = combatInputEnabled && this.input.consumeAction('fire');
        const primaryFireHeld = combatInputEnabled && this.input.isActionPressed('fire');
        const secondaryAimHeld = combatInputEnabled && this.input.isActionPressed('aim');
        if (consumableSelected) {
          this.clearPendingHipFireShot();
          aimingMode = false;
          this.currentAimMode = false;
          this.player.setAimingState(false);
          if (primaryFirePressed) {
            if (selectedDrinkItemId) {
              void this.consumeInventoryDrink(selectedDrinkItemId);
            } else {
              void this.consumeInventoryConsumable(selectedConsumableItemId);
            }
          }
        } else if (armed) {
          aimingMode = secondaryAimHeld;
          this.currentAimMode = aimingMode;
          this.player.setAimingState(aimingMode || hipFirePoseActive);
          if (aimingMode ? primaryFireHeld : primaryFirePressed) {
            if (aimingMode) {
              this.fireLocalWeapon(aimDirection, this.getShotCollisionOrigin(aimDirection));
            } else if (!hipFirePending || performance.now() >= hipFirePending.releaseAt) {
              this.queueHipFireShot(aimDirection);
            }
          }
          if (combatInputEnabled && this.input.consumeAction('reload')) {
            this.npcService?.reloadWeapon();
          }
        } else {
          this.clearPendingHipFireShot();
          aimingMode = secondaryAimHeld;
          this.currentAimMode = aimingMode;
          this.player.setAimingState(aimingMode);
          if (primaryFirePressed) {
            this.punchLocal(aimDirection);
          }
        }
        if (!localAlive || rentIntroCutsceneActive || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || adminPromptOpen || phoneOpen) {
          this.clearPendingHipFireShot();
        } else if (this.pendingHipFireShot) {
          const now = performance.now();
          this.player.setAimingState(aimingMode || now < this.pendingHipFireShot.releaseAt);
          this.player.setAimRotation(Math.atan2(this.pendingHipFireShot.direction.x, this.pendingHipFireShot.direction.z));
          if (!this.pendingHipFireShot.fired && now >= this.pendingHipFireShot.fireAt) {
            this.pendingHipFireShot.fired = true;
            this.fireLocalWeapon(this.pendingHipFireShot.direction, this.pendingHipFireShot.origin);
          }
          if (now >= this.pendingHipFireShot.releaseAt) {
            this.clearPendingHipFireShot();
            this.player.setAimingState(aimingMode);
          }
        }
        if (rentIntroCutsceneActive) {
          this.updateRentIntroCutscene();
        } else {
          this.updateCamera(this.currentAimDirection, this.currentAimMode && armed);
        }
      }
      this.updateLocalPlayerKinematics();
      const animationSyncState = this.player.getAnimationSyncState(this.localAnimationSyncState);
      animationSyncState.aiming = Boolean(this.currentAimMode || hipFirePoseActive);
      this.npcService?.setPlayerTransform(
        this.player.position,
        this.player.object.rotation.y,
        animationSyncState
      );
      this.updateNpcInteractRadiusIndicators();

      if (workoutActive || rentIntroCutsceneActive || localAlive === false || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || adminPromptOpen || phoneOpen) {
        this.currentInteractable = null;
        this.hud.setPrompt(null);
      } else {
        this.updateInteraction();
      }
    }

    this.updateRemotePlayers(deltaSeconds);
    this.updatePickupVisuals(deltaSeconds);
    this.updateCombatEffects();
    const hitMarkerVisible = performance.now() < this.hitMarkerUntil;
    if (hitMarkerVisible !== this.lastHudHitMarkerVisible) {
      this.hud.setHitMarkerVisible(hitMarkerVisible);
      this.lastHudHitMarkerVisible = hitMarkerVisible;
    }
    const npcSpeechAnchors = this.getNpcSpeechAnchorsForHud();
    const visibleOverheadHealthBarIds = this.updateOverheadHealthBars(npcSpeechAnchors);
    this.updateSpeechBubbles(visibleOverheadHealthBarIds, npcSpeechAnchors);
    if (this.aimPoseDebugVisible) {
      this.refreshAimPoseDebugHud();
    }
    this.refreshAdminPositionHud();
    this.characterPreviewRenderer?.update(deltaSeconds);
    this.updateCameraOcclusion();
    this.updateWorldInteractableIndicatorVisibility();
    this.updateDrunknessEffects(localPlayerState);
    this.updateAdaptiveRenderQuality(this.getMovementFrameSummary());
    if (this.vibeShaderPass?.uniforms?.uTime) {
      this.vibeShaderPass.uniforms.uTime.value = performance.now() * 0.001;
    }

    this.renderSceneFrame();
    this.processDeferredSceneWork();
    this.input.endFrame();
  }

  updateCamera(aimDirection = this.currentAimDirection, isAiming = false, { snap = false } = {}) {
    const zoomLevel = this.getCameraZoomLevel();
    const cameraOffset = this.cameraOffsetScratch
      .copy(isAiming ? AIM_CAMERA_OFFSET : CAMERA_OFFSET)
      .multiplyScalar(zoomLevel);
    const targetPosition = this.cameraTargetPosition.copy(this.player.position).add(cameraOffset);
    const lookTarget = this.cameraLookTarget.copy(this.player.position).add(CAMERA_LOOK_OFFSET);
    const now = performance.now();

    if (now < this.damageCameraKickEndsAt) {
      const lifetime = Math.max(1, this.damageCameraKickEndsAt - this.damageCameraKickStartedAt);
      const progress = THREE.MathUtils.clamp((now - this.damageCameraKickStartedAt) / lifetime, 0, 1);
      const envelope = Math.pow(1 - progress, 1.35);
      const wave = Math.sin(progress * Math.PI * 3.2);
      const side = this.damageCameraSide.set(-this.damageCameraDirection.z, 0, this.damageCameraDirection.x);
      targetPosition.addScaledVector(this.damageCameraDirection, envelope * 0.72);
      targetPosition.addScaledVector(side, wave * envelope * 0.26);
      targetPosition.y += Math.sin(progress * Math.PI) * envelope * 0.38;
      lookTarget.addScaledVector(this.damageCameraDirection, envelope * 0.16);
      lookTarget.addScaledVector(side, wave * envelope * -0.14);
      lookTarget.y += envelope * 0.12;
    }

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, isAiming ? 0.14 : 0.08);
    }
    this.camera.lookAt(lookTarget);
  }

  triggerDamageCameraFeedback(direction = null) {
    this.damageCameraKickStartedAt = performance.now();
    this.damageCameraKickEndsAt = this.damageCameraKickStartedAt + DAMAGE_CAMERA_KICK_MS;
    if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)) {
      this.damageCameraDirection.set(direction.x, 0, direction.z);
    } else {
      this.damageCameraDirection.set(this.currentAimDirection.x, 0, this.currentAimDirection.z);
    }

    if (this.damageCameraDirection.lengthSq() <= 0.0001) {
      this.damageCameraDirection.set(0, 0, 1);
    } else {
      this.damageCameraDirection.normalize();
    }
  }

  updateBuilderCamera() {
    this.worldBuilder.updateCamera(this.camera);
  }

  updateNpcInteractRadiusIndicators() {
    if (!this.player || !this.worldBuilder) {
      return;
    }

    this.worldBuilder.syncNpcInteractRadiusIndicators(this.player.position);
  }

  clearLocalPlayerCameraOcclusionRenderState() {
    const state = this.playerCameraOcclusionRenderState;
    if (!state) {
      return;
    }

    for (const entry of state.entries) {
      if (entry.type === 'object') {
        entry.object.renderOrder = entry.renderOrder;
        continue;
      }

      entry.material.transparent = entry.transparent;
      entry.material.depthWrite = entry.depthWrite;
      entry.material.needsUpdate = true;
    }

    this.playerCameraOcclusionRenderState = null;
  }

  setLocalPlayerCameraOcclusionRenderActive(active) {
    const playerObject = this.player?.object ?? null;
    if (!active || !playerObject) {
      this.clearLocalPlayerCameraOcclusionRenderState();
      return;
    }

    if (this.playerCameraOcclusionRenderState?.object !== playerObject) {
      this.clearLocalPlayerCameraOcclusionRenderState();
    }

    if (!this.playerCameraOcclusionRenderState) {
      const entries = [];
      playerObject.traverse((node) => {
        if (!node.isMesh) {
          return;
        }

        entries.push({
          type: 'object',
          object: node,
          renderOrder: node.renderOrder
        });

        for (const material of collectMaterialList(node.material)) {
          entries.push({
            type: 'material',
            material,
            transparent: material.transparent,
            depthWrite: material.depthWrite
          });
        }
      });

      this.playerCameraOcclusionRenderState = {
        object: playerObject,
        entries
      };
    }

    for (const entry of this.playerCameraOcclusionRenderState.entries) {
      if (entry.type === 'object') {
        entry.object.renderOrder = CAMERA_OCCLUDED_PLAYER_RENDER_ORDER;
        continue;
      }

      entry.material.transparent = true;
      entry.material.depthWrite = entry.depthWrite;
      entry.material.needsUpdate = true;
    }
  }

  updateCameraOcclusion() {
    if (!this.worldBuilder) {
      this.setLocalPlayerCameraOcclusionRenderActive(false);
      return;
    }

    if (!this.player || this.worldBuilder.enabled || this.currentInterior?.scene) {
      this.worldBuilder.clearCameraOcclusion();
      this.setLocalPlayerCameraOcclusionRenderActive(false);
      return;
    }

    const preservePlacementIds = this.cameraOcclusionPreservePlacementIds;
    preservePlacementIds.length = 0;
    if (this.activeInlineShell?.mode === 'inline-cutaway' && this.activeInlineShell.placementId) {
      preservePlacementIds.push(this.activeInlineShell.placementId);
    }
    const occludedBuildingCount = this.worldBuilder.updateCameraOcclusion(
      this.camera,
      this.player.position,
      this.cameraOcclusionOptions
    );
    this.setLocalPlayerCameraOcclusionRenderActive(occludedBuildingCount > 0);
  }

  updateInteraction() {
    const worldBuilderInteractables = this.getWorldBuilderInteractables();
    const localPlayerState = this.getLocalPlayerState();
    this.syncDeliveryQuestReminderGate(localPlayerState, worldBuilderInteractables);

    const interactables = this.getActiveInteractables(worldBuilderInteractables);
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of interactables) {
      const distance = interactable.position.distanceTo(this.player.position);
      if (distance < interactable.radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    if (this.maybeActivatePortalInteractable(interactables)) {
      return;
    }

    this.currentInteractable = nearest;
    if (this.maybeAutoCompleteDelivery(localPlayerState, worldBuilderInteractables)) {
      this.hud.setPrompt(null);
      return;
    }

    const npcInteractable = this.getNearestNpcInteractable(worldBuilderInteractables);
    const deliveryInteraction = this.getDeliveryQuestInteractionForNpc(npcInteractable, worldBuilderInteractables);
    const gymCheckInInteraction = deliveryInteraction
      ? null
      : this.getNearestGymCheckInInteractable(worldBuilderInteractables);
    const stockMarketInteraction = deliveryInteraction || gymCheckInInteraction
      ? null
      : this.getNearestStockMarketInteractable(worldBuilderInteractables);
    const blackjackInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction
      ? null
      : this.getNearestBlackjackDealerInteractable(worldBuilderInteractables);
    const schoolMicrogameInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction
      ? null
      : this.getNearestSchoolMicrogameInteractable(worldBuilderInteractables);
    const bartenderInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction
      ? null
      : this.getNearestBartenderInteractable({ worldBuilderInteractables });
    const pawnShopOwnerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction
      ? null
      : this.getNearestPawnShopOwnerInteractable({ worldBuilderInteractables });
    const carDealerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction
      ? null
      : this.getNearestCarDealerInteractable({ worldBuilderInteractables });
    const marthaInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction || carDealerInteraction
      ? null
      : this.getNearestMarthaInteractable({ worldBuilderInteractables });
    this.syncActiveBartenderMenu(bartenderInteraction);
    this.syncActivePawnShopMenu(pawnShopOwnerInteraction);
    this.syncActiveCarDealerMenu(carDealerInteraction);
    this.syncActiveMarthaMenu(marthaInteraction);
    const interactPressed = this.input.consumeAction('interact');

    if (deliveryInteraction?.action && interactPressed) {
      void this.handleDeliveryQuestInteraction(deliveryInteraction);
      return;
    }

    if (gymCheckInInteraction) {
      this.hud.setPrompt(gymCheckInInteraction);
      if (interactPressed) {
        void this.handleGymCheckInInteraction(gymCheckInInteraction);
      }
      return;
    }

    if (stockMarketInteraction) {
      this.hud.setPrompt(stockMarketInteraction);
      if (interactPressed) {
        void this.openStockMarket(stockMarketInteraction);
      }
      return;
    }

    if (blackjackInteraction) {
      this.hud.setPrompt(blackjackInteraction);
      if (interactPressed) {
        this.openBlackjack(blackjackInteraction);
      }
      return;
    }

    if (schoolMicrogameInteraction) {
      this.hud.setPrompt(schoolMicrogameInteraction);
      if (interactPressed) {
        this.openSchoolMicrogame(schoolMicrogameInteraction);
      }
      return;
    }

    if (bartenderInteraction) {
      this.hud.setPrompt(bartenderInteraction);
      if (interactPressed) {
        this.openBartenderMenu(bartenderInteraction);
      }
      return;
    }

    if (pawnShopOwnerInteraction) {
      this.hud.setPrompt(pawnShopOwnerInteraction);
      if (interactPressed) {
        this.openPawnShopMenu(pawnShopOwnerInteraction);
      }
      return;
    }

    if (carDealerInteraction) {
      this.hud.setPrompt(carDealerInteraction);
      if (interactPressed) {
        this.openCarDealerMenu(carDealerInteraction);
      }
      return;
    }

    if (marthaInteraction) {
      this.hud.setPrompt(marthaInteraction);
      if (interactPressed) {
        this.openMarthaMenu(marthaInteraction);
      }
      return;
    }

    if (this.isOfficeInteriorTransportInteractable(nearest)) {
      this.hud.setPrompt(nearest);
      if (interactPressed) {
        this.useOfficeInteriorTransport(nearest);
      }
      return;
    }

    if (this.isOfficeInteriorJobStationInteractable(nearest)) {
      this.hud.setPrompt(nearest);
      if (interactPressed) {
        this.openOfficeInteriorJobStation(nearest);
      }
      return;
    }

    if (this.isOfficeJobComputerInteractable(nearest)) {
      const officeComputerInteraction = {
        ...nearest,
        kind: 'office-job-terminal',
        prompt: 'Open job board',
        actionText: 'Opened the office job board.'
      };
      this.hud.setPrompt(officeComputerInteraction);
      if (interactPressed) {
        this.openOfficeJobMenu(officeComputerInteraction);
      }
      return;
    }

    const vibeHeroChartEditorPressed = Boolean(
      nearest?.gameId === VIBE_HERO_GAME_ID
      && this.canUseVibeHeroChartEditor()
      && this.input.consume('KeyF')
    );
    const promptInteractable = nearest?.gameId === VIBE_HERO_GAME_ID && this.canUseVibeHeroChartEditor()
      ? {
          ...nearest,
          prompt: `${nearest.prompt ?? 'Play Vibe Hero'} / F Chart Editor`
        }
      : nearest;
    this.hud.setPrompt(promptInteractable);

    if (vibeHeroChartEditorPressed) {
      this.openVibeHeroChartEditor(nearest);
      return;
    }

    if (!nearest || !interactPressed) {
      return;
    }

    if (nearest.kind === 'pickup') {
      this.npcService?.pickupWeapon(nearest.pickupId);
      return;
    }

    if (nearest.kind === 'interior-exit') {
      this.exitInterior();
      return;
    }

    if (nearest.kind === 'portal') {
      return;
    }

    if (nearest.kind === 'world' && nearest.interior?.id) {
      this.enterInterior(nearest);
      return;
    }

    if (nearest.gameId === VIBE_HERO_GAME_ID) {
      this.openVibeHero(nearest);
      return;
    }

    if (getWorkoutActivityConfig(nearest)) {
      void this.startWorkout(nearest);
      return;
    }

    this.hud.showToast(nearest.actionText);
  }

  canOpenQuickChatFromInput({ emoteMenuActive = this.emoteMenuOpen } = {}) {
    const localPlayerState = this.getLocalPlayerState();
    return Boolean(
      this.player
      && localPlayerState?.alive !== false
      && !this.worldBuilder?.enabled
      && !emoteMenuActive
      && !this.hud.isPhoneOpen()
      && !this.hud.isQuickChatOpen()
      && !this.hud.isStockMarketOpen()
      && !this.hud.isBlackjackOpen()
      && !this.hud.isSchoolMicrogameOpen()
      && !this.hud.isVibeHeroOpen()
      && !this.characterSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
  }

  maybeOpenQuickChatFromInput() {
    if (this.canOpenQuickChatFromInput()) {
      this.openQuickChat();
    }
  }

  openQuickChat() {
    this.closePhoneMenu();
    this.hud.setQuickChatState({ visible: true });
    this.hud.focusQuickChatInput();
  }

  closeQuickChat() {
    this.hud.setQuickChatState({ visible: false });
    this.hud.clearQuickChatInput();
    this.hud.blurQuickChatInput();
  }

  async handleQuickChatSubmit(message) {
    const trimmed = message.trim();
    if (!trimmed) {
      this.closeQuickChat();
      return;
    }

    const result = await this.npcService.say(trimmed);
    if (!result.ok) {
      this.hud.showToast(result.error);
      return;
    }

    this.closeQuickChat();
  }

  collectSpeechBubble(id, text, startedAt, anchor, variant, label = '', options = {}) {
    const isThinking = options.status === 'thinking';
    const isBusy = Boolean(options.busy);
    const hasVisibleText = Boolean(text) || isThinking;
    if (!hasVisibleText || !startedAt) {
      return null;
    }

    if (!isBusy && (Date.now() - startedAt) > getChatBubbleLifetimeMs(text)) {
      return null;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return null;
    }

    return {
      id,
      text,
      label,
      variant,
      status: options.status ?? 'done',
      chirp: options.chirp === true,
      modelId: options.modelId ?? '',
      voice: options.voice ?? null,
      voiceVolumeScale: options.voiceVolumeScale ?? 1,
      speakerKey: options.speakerKey ?? label ?? id,
      visible: true,
      screenX: projected.x,
      screenY: projected.y - (Number(options.screenYOffset) || 0)
    };
  }

  pushSpeechBubble(bubbles, bubble) {
    if (bubble) {
      bubbles.push(bubble);
    }
  }

  addPlayerSpeechBubble(bubbles, sessionId, playerState, anchor, variant, options = {}) {
    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubble(
        `player:${sessionId}`,
        playerState.chatText,
        playerState.chatStartedAt,
        anchor,
        variant,
        '',
        options
      )
    );
  }

  getNpcSpeechVoiceVolumeScale(npcState, anchor = null) {
    const localPlayerState = this.getLocalPlayerState();
    const playerX = getFirstFiniteNumber(this.player?.position?.x, localPlayerState?.x);
    const playerZ = getFirstFiniteNumber(this.player?.position?.z, localPlayerState?.z);
    const npcX = getFirstFiniteNumber(npcState?.x, npcState?.position?.[0], anchor?.x);
    const npcZ = getFirstFiniteNumber(npcState?.z, npcState?.position?.[1], anchor?.z);

    if (playerX === null || playerZ === null || npcX === null || npcZ === null) {
      return 1;
    }

    return getNpcVoiceDistanceVolumeScale(Math.hypot(playerX - npcX, playerZ - npcZ));
  }

  addNpcSpeechBubble(bubbles, npcId, npcState, anchor, options = {}) {
    if (this.isRentIntroReservedNpc(npcId)) {
      return;
    }

    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubble(
        `npc:${npcId}`,
        npcState.chatText,
        npcState.chatStartedAt,
        anchor,
        'npc',
        npcState.name,
        {
          status: npcState.chatStatus,
          busy: npcState.busy,
          chirp: true,
          modelId: npcState.modelId,
          voice: getNpcModelVoice(this.currentLayout?.npcModelVoices, npcState.modelId),
          voiceVolumeScale: this.getNpcSpeechVoiceVolumeScale(npcState, anchor),
          speakerKey: `${npcState.modelId}:${npcState.name}`,
          screenYOffset: options.screenYOffset
        }
      )
    );
  }

  addRentIntroSpeechBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds = new Set()) {
    const intro = this.activeRentIntro;
    if (!intro?.npcId) {
      return;
    }

    const anchor = npcSpeechAnchors.get(intro.npcId);
    if (!anchor) {
      return;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return;
    }

    const text = this.getRentIntroSpeechText();
    if (!text) {
      return;
    }

    const npcState = this.npcServiceState.npcs.get(intro.npcId);
    const screenYOffset = visibleOverheadHealthBarIds.has(`npc:${intro.npcId}`)
      ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
      : 0;
    bubbles.push({
      id: `npc-rent-intro:${intro.seq}`,
      text,
      label: npcState?.name ?? '',
      variant: 'npc',
      status: 'done',
      visible: true,
      screenX: projected.x,
      screenY: projected.y - screenYOffset
    });
  }

  addNpcInteractionHintBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds = new Set()) {
    const worldBuilderInteractables = this.getWorldBuilderInteractables();
    const npcInteractable = this.getNearestNpcInteractable(worldBuilderInteractables);
    const deliveryInteraction = this.getDeliveryQuestInteractionForNpc(npcInteractable, worldBuilderInteractables);
    const gymCheckInInteraction = deliveryInteraction
      ? null
      : this.getNearestGymCheckInInteractable(worldBuilderInteractables);
    const stockMarketInteraction = deliveryInteraction || gymCheckInInteraction
      ? null
      : this.getNearestStockMarketInteractable(worldBuilderInteractables);
    const blackjackInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction
      ? null
      : this.getNearestBlackjackDealerInteractable(worldBuilderInteractables);
    const schoolMicrogameInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction
      ? null
      : this.getNearestSchoolMicrogameInteractable(worldBuilderInteractables);
    const bartenderInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction
      ? null
      : this.getNearestBartenderInteractable({ worldBuilderInteractables });
    const pawnShopOwnerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction
      ? null
      : this.getNearestPawnShopOwnerInteractable({ worldBuilderInteractables });
    const carDealerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction
      ? null
      : this.getNearestCarDealerInteractable({ worldBuilderInteractables });
    const marthaInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction || carDealerInteraction
      ? null
      : this.getNearestMarthaInteractable({ worldBuilderInteractables });
    const interactable = deliveryInteraction
      ? npcInteractable
      : (gymCheckInInteraction ?? stockMarketInteraction ?? blackjackInteraction ?? schoolMicrogameInteraction ?? bartenderInteraction ?? pawnShopOwnerInteraction ?? carDealerInteraction ?? marthaInteraction ?? npcInteractable);
    const npcId = interactable
      ? (interactable.npcId || interactable.placementId || '')
      : '';
    if (
      !npcId
      || this.worldBuilder?.enabled
      || this.hud.isQuickChatOpen()
      || this.hud.isStockMarketOpen()
      || this.hud.isBlackjackOpen()
      || this.hud.isSchoolMicrogameOpen()
      || this.hud.isVibeHeroOpen()
      || this.hud.isInteractionMenuOpen()
      || this.isRentIntroReservedNpc(npcId)
    ) {
      return;
    }

    const npcState = this.npcServiceState.npcs.get(npcId);
    if (!deliveryInteraction && !gymCheckInInteraction && !stockMarketInteraction && !blackjackInteraction && !schoolMicrogameInteraction && !bartenderInteraction && !pawnShopOwnerInteraction && !carDealerInteraction && !marthaInteraction && npcState?.busy) {
      return;
    }

    const hasVisibleNpcSpeech = Boolean(
      npcState
      && (npcState.chatText || npcState.chatStatus === 'thinking')
      && npcState.chatStartedAt
      && (Date.now() - npcState.chatStartedAt) <= getChatBubbleLifetimeMs(npcState.chatText)
    );
    if (
      hasVisibleNpcSpeech
      && deliveryInteraction?.kind !== 'completeDelivery'
      && deliveryInteraction?.kind !== 'deliveryReminder'
    ) {
      return;
    }

    const anchor = npcSpeechAnchors.get(npcId);
    if (!anchor) {
      return;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return;
    }

    const screenYOffset = visibleOverheadHealthBarIds.has(`npc:${npcId}`)
      ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
      : 0;

    if (gymCheckInInteraction) {
      bubbles.push({
        id: `npc-gym-check-in:${npcId}`,
        text: GYM_CHECK_IN_LINE,
        label: npcState?.name ?? interactable?.npc?.name ?? '',
        variant: 'npc',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (deliveryInteraction) {
      bubbles.push({
        id: `npc-delivery:${npcId}:${deliveryInteraction.kind}`,
        text: deliveryInteraction.overheadText,
        label: deliveryInteraction.label ?? '',
        variant: deliveryInteraction.variant ?? 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (stockMarketInteraction) {
      bubbles.push({
        id: `npc-stock-market:${npcId}`,
        text: 'E to trade stocks',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (blackjackInteraction) {
      bubbles.push({
        id: `npc-blackjack:${npcId}`,
        text: 'E to play blackjack',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (schoolMicrogameInteraction) {
      const game = schoolMicrogameInteraction.gameId === SCHOOL_MICROGAME_ALL_ID
        ? null
        : getSchoolMicrogameDefinition(schoolMicrogameInteraction.gameId);
      bubbles.push({
        id: `npc-school-microgame:${npcId}`,
        text: game ? `E to play ${game.shortTitle ?? game.title}` : 'E to play school microgame',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (bartenderInteraction) {
      bubbles.push({
        id: `npc-bartender:${npcId}`,
        text: 'E to order drinks',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (pawnShopOwnerInteraction) {
      bubbles.push({
        id: `npc-pawn-shop:${npcId}`,
        text: 'E to browse pawn shop',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (carDealerInteraction) {
      bubbles.push({
        id: `npc-car-dealer:${npcId}`,
        text: 'E to browse cars',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    if (marthaInteraction) {
      bubbles.push({
        id: `npc-martha:${npcId}`,
        text: 'E to order food',
        label: '',
        variant: 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y - screenYOffset
      });
      return;
    }

    bubbles.push({
      id: `npc-interaction:${npcId}`,
      text: 'Enter to chat',
      label: '',
      variant: 'interaction',
      status: 'done',
      visible: true,
      screenX: projected.x,
      screenY: projected.y - screenYOffset
    });
  }

  collectOverheadHealthBar(id, anchor, { health = 0, maxHealth = 100, alive = true } = {}, variant = 'npc') {
    const safeMaxHealth = Math.max(1, Number(maxHealth) || 1);
    const currentHealth = Math.max(0, Math.min(safeMaxHealth, Number(health) || 0));
    if (!alive || currentHealth >= safeMaxHealth) {
      return null;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return null;
    }

    return {
      id,
      variant,
      visible: true,
      health: currentHealth,
      maxHealth: safeMaxHealth,
      healthRatio: currentHealth / safeMaxHealth,
      screenX: projected.x,
      screenY: projected.y
    };
  }

  pushOverheadHealthBar(bars, bar) {
    if (bar) {
      bars.push(bar);
    }
  }

  getNpcSpeechAnchorsForHud() {
    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      return EMPTY_NPC_SPEECH_ANCHORS;
    }

    return this.worldBuilder.getNpcSpeechAnchors();
  }

  updateOverheadHealthBars(npcSpeechAnchors = EMPTY_NPC_SPEECH_ANCHORS) {
    const visibleIds = this.visibleOverheadHealthBarIds;
    const bars = this.overheadHealthBars;
    visibleIds.clear();
    bars.length = 0;

    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      this.hud.setOverheadHealthBars(bars);
      return visibleIds;
    }

    const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
    if (localPlayerState) {
      const bar = this.collectOverheadHealthBar(
        `player:${this.npcServiceState.sessionId}`,
        this.player.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        {
          health: localPlayerState.health,
          maxHealth: localPlayerState.maxHealth,
          alive: localPlayerState.alive !== false
        },
        'self'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    for (const [sessionId, avatar] of this.remotePlayers.entries()) {
      const playerState = this.npcServiceState.players.get(sessionId);
      if (!playerState) {
        continue;
      }

      const bar = this.collectOverheadHealthBar(
        `player:${sessionId}`,
        avatar.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        {
          health: playerState.health,
          maxHealth: playerState.maxHealth,
          alive: playerState.alive !== false
        },
        'player'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    for (const [npcId, npcState] of this.npcServiceState.npcs.entries()) {
      const anchor = npcSpeechAnchors.get(npcId);
      if (!anchor) {
        continue;
      }

      const bar = this.collectOverheadHealthBar(
        `npc:${npcId}`,
        anchor,
        {
          health: npcState.health,
          maxHealth: npcState.maxHealth,
          alive: npcState.alive !== false
        },
        'npc'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    this.hud.setOverheadHealthBars(bars);
    return visibleIds;
  }

  projectSpeechAnchor(worldPosition, target = this.projectedSpeechScreen) {
    const projected = this.projectedSpeechPosition.copy(worldPosition).project(this.camera);
    if (projected.z < -1 || projected.z > 1) {
      return null;
    }

    const x = ((projected.x + 1) * 0.5) * window.innerWidth;
    const y = ((-projected.y + 1) * 0.5) * window.innerHeight;
    if (x < -160 || x > window.innerWidth + 160 || y < -160 || y > window.innerHeight + 160) {
      return null;
    }

    target.x = x;
    target.y = y;
    return target;
  }

  updateSpeechBubbles(
    visibleOverheadHealthBarIds = EMPTY_VISIBLE_OVERHEAD_HEALTH_BAR_IDS,
    npcSpeechAnchors = EMPTY_NPC_SPEECH_ANCHORS
  ) {
    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      this.hud.setSpeechBubbles([]);
      return;
    }

    const bubbles = this.speechBubbles;
    bubbles.length = 0;
    const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
    if (localPlayerState) {
      this.addPlayerSpeechBubble(
        bubbles,
        this.npcServiceState.sessionId,
        localPlayerState,
        this.player.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        'self',
        {
          screenYOffset: visibleOverheadHealthBarIds.has(`player:${this.npcServiceState.sessionId}`)
            ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
            : 0
        }
      );
    }

    for (const [sessionId, avatar] of this.remotePlayers.entries()) {
      const playerState = this.npcServiceState.players.get(sessionId);
      if (!playerState) {
        continue;
      }

      this.addPlayerSpeechBubble(
        bubbles,
        sessionId,
        playerState,
        avatar.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        'player',
        {
          screenYOffset: visibleOverheadHealthBarIds.has(`player:${sessionId}`)
            ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
            : 0
        }
      );
    }

    for (const [npcId, npcState] of this.npcServiceState.npcs.entries()) {
      const anchor = npcSpeechAnchors.get(npcId);
      if (!anchor) {
        continue;
      }

      this.addNpcSpeechBubble(bubbles, npcId, npcState, anchor, {
        screenYOffset: visibleOverheadHealthBarIds.has(`npc:${npcId}`)
          ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
          : 0
      });
    }

    this.addRentIntroSpeechBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds);
    this.addNpcInteractionHintBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds);
    this.addMoneyFloaterBubbles(bubbles);
    this.addSkillXpFloaterBubbles(bubbles);
    this.hud.setSpeechBubbles(bubbles);
  }
}
