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
  TREADMILL_DURATION_MS,
  getWorkoutActivityConfig
} from './workoutActivities.js';
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { Hud } from '../ui/Hud.js';
import { createSupabaseAuthService } from '../auth/supabaseAuth.js';
import { assets } from '../world/assetManifest.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_AIM_POSE_FIELDS,
  HELD_ITEM_IDS,
  PHONE_GRIP_DEBUG_FIELDS,
  getHeldItemAssetUrl,
  getHeldItemGripProfile,
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
  OLYMPIC_BARBELL_LENGTH,
  createOlympicBarbellVisual
} from '../world/proceduralProps.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { isPointInsidePassiveTrafficHitbox } from '../world/passiveTraffic.js';
import { createPlayer } from '../player/createPlayer.js';
import { DRINKING_EMOTE_ID, EMOTE_SLOTS, PUNCH_EMOTE_ID, PUNCH_HOOK_EMOTE_ID, PUNCH_UPPERCUT_EMOTE_ID, SMOKING_EMOTE_ID, STAND_UP_EMOTE_ID, TEXTING_EMOTE_ID } from '../player/emotes.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById,
  listPlayableCharacters
} from '../player/playableCharacterCatalog.js';
import { createNpcService } from '../npc/createNpcService.js';
import { getNpcModelById } from '../npc/npcCatalog.js';
import {
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PUNCH_ASSISTED_LUNGE_BONUS,
  PUNCH_COMBO_BUFFER_MS,
  PUNCH_COMBO_MIN_INTERVAL_MS,
  PUNCH_COMBO_WINDOW_MS,
  PUNCH_HITBOX_RADIUS,
  PUNCH_RANGE,
  PUNCH_TARGET_ASSIST_MAX_ANGLE_RAD,
  PUNCH_TARGET_ASSIST_RANGE_BONUS
} from '../shared/combatConstants.js';
import { chooseAimAssistTarget } from '../shared/combatMath.js';
import {
  PUNCH_COMBO_HOOK_STEP,
  PUNCH_COMBO_JAB_STEP,
  PUNCH_COMBO_UPPERCUT_STEP,
  getNextPunchComboStep,
  getPunchComboImpactStrength,
  getPunchComboReleaseDelayMs,
  normalizePunchComboStep,
  resolvePunchComboStep
} from '../shared/punchCombo.js';
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
  listPawnShopMenuItems,
  PAWN_SHOP_ITEM_IDS
} from '../shared/pawnShop.js';
import {
  CAR_VEHICLE_SPEED_MULTIPLIER,
  getCarDealerMenuItem,
  getCarDealerPromptRadius,
  getPlayerOwnedVehicleMenuItems,
  getPlayerVehicleItemId,
  getPlayerVehicleMenuItem,
  isCarDealerNpc,
  isPlayerVehicleOwner,
  playerOwnsVehicleItem,
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
  SKATEBOARD_ITEM_ID,
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
  createSchoolSketchGuessrRound,
  getSchoolMicrogameDefinition,
  getSchoolMicrogamePromptRadius,
  isSchoolSketchGuessAnswer,
  isSchoolMicrogameNpc,
  listSchoolMicrogames,
  normalizeSchoolMicrogameId
} from '../shared/schoolMicrogames.js';
import {
  createSchoolGeographyCountry,
  createSchoolGeographyCountryChoices,
  isSchoolGeographyCountryAnswer
} from '../shared/geographyCountries.js';
import {
  CHARISMA_VIBE_HERO_XP,
  SKILL_DEFINITIONS,
  SKILL_IDS,
  getSkillDefinition,
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
  getPlayerOfficeJobIntelligenceLevel,
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
  createDefaultVibeRadioTracks
} from '../shared/vibeRadio.js';
import { getNpcModelVoice } from '../shared/npcVoice.js';

const DEFAULT_CAMERA_FOV = 55;
const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const AIM_CAMERA_OFFSET = new THREE.Vector3(0, 27.1, 18.9);
const FIRST_PERSON_CAMERA_HEIGHT = 3.55;
const FIRST_PERSON_MOUSE_SENSITIVITY = 0.0022;
const FIRST_PERSON_MIN_PITCH = THREE.MathUtils.degToRad(-82);
const FIRST_PERSON_MAX_PITCH = THREE.MathUtils.degToRad(82);
const INTERACTION_CAMERA_FOV = 42;
const INTERACTION_CAMERA_SMOOTHING = 0.12;
const INTERACTION_CAMERA_FOV_SMOOTHING = 0.18;
const INTERACTION_CAMERA_RETURN_FOV_SMOOTHING = 0.12;
const INTERACTION_CAMERA_SHOULDER_DISTANCE = 1.35;
const INTERACTION_CAMERA_SHOULDER_OFFSET = 1.75;
const INTERACTION_CAMERA_HEIGHT = 4.05;
const INTERACTION_CAMERA_PLAYER_LOOK_HEIGHT = 3.3;
const INTERACTION_CAMERA_NPC_LOOK_HEIGHT = 3.35;
const INTERACTION_CAMERA_OBJECT_LOOK_HEIGHT = 1.55;
const INTERACTION_CAMERA_LOOK_OVER_LIFT = 0.18;
const INTERACTION_CAMERA_LOOK_SIDE_OFFSET = 0.9;
const INTERACTION_CAMERA_LOOK_SIDE_MAX_OFFSET = 1.45;
const INTERACTION_CAMERA_SIGHTLINE_CLEARANCE = 1.35;
const INTERACTION_CAMERA_MIN_MS = 900;
const INTERACTION_CAMERA_TRANSIENT_MS = 1250;
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
const PHONE_GRIP_DEBUG_ITEM_ID = HELD_ITEM_IDS.phone;
const POLICE_STATION_BUILDING_ITEM_ID = 'police_station_building';
const POLICE_STATION_GARAGE_DOOR_NODE_NAMES = Object.freeze(['police_station_garage_door_closed']);
const PHONE_GRIP_DEBUG_FIELD_BY_KEY = new Map();
for (let index = 0; index < PHONE_GRIP_DEBUG_FIELDS.length; index += 1) {
  const field = PHONE_GRIP_DEBUG_FIELDS[index];
  PHONE_GRIP_DEBUG_FIELD_BY_KEY.set(field.key, field);
}
const POSE_DEBUG_SECTIONS = new Set(['unarmed', 'weaponAim', 'phoneGrip']);
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
const SCHOOL_GEOGRAPHY_REVEAL_MS = 2000;
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
const vibeHeroLaneKeyCodes = [];
for (let index = 0; index < VIBE_HERO_LANE_COUNT; index += 1) {
  vibeHeroLaneKeyCodes.push(Object.freeze([
    `Digit${index + 1}`,
    `Numpad${index + 1}`
  ]));
}
const VIBE_HERO_LANE_KEY_CODES = Object.freeze(vibeHeroLaneKeyCodes);
const VIBE_RADIO_VOLUME_STORAGE_KEY = 'vta:vibeRadio:volume';
const VIBE_RADIO_VOLUME_STORAGE_VERSION_KEY = 'vta:vibeRadio:volumeVersion';
const VIBE_RADIO_VOLUME_STORAGE_VERSION = '3';
const VIBE_RADIO_PLAYBACK_STORAGE_KEY = 'vta:vibeRadio:playbackState';
const VIBE_RADIO_PLAYBACK_PLAYING = 'playing';
const VIBE_RADIO_PLAYBACK_PAUSED = 'paused';
const VIBE_RADIO_DEFAULT_VOLUME = 0.5;
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
const SNATCH_WORKOUT_CAMERA_SMOOTHING = 0.18;
const SNATCH_WORKOUT_CAMERA_BASE_DISTANCE = 5.15;
const SNATCH_WORKOUT_CAMERA_SIDE_OFFSET = 0.82;
const SNATCH_WORKOUT_CAMERA_HEIGHT = 1.85;
const SNATCH_WORKOUT_CAMERA_LOOK_HEIGHT = 1.42;
const SNATCH_WORKOUT_CAMERA_BAR_PADDING = 0.85;
const TREADMILL_RUN_RESULT_HOLD_MS = 980;
const TREADMILL_RUN_COUNTDOWN_MS = 3000;
const TREADMILL_RUN_REWARD_SCORE = 70;
const TREADMILL_RUN_FIRST_BEAT_MS = 260;
const TREADMILL_RUN_BEAT_WINDOW_MS = 150;
const TREADMILL_RUN_EXTRA_TAP_PENALTY = 4;
const TREADMILL_RUN_CAMERA_SMOOTHING = 0.2;
const TREADMILL_RUN_MIN_BPM = 100;
const TREADMILL_RUN_MAX_BPM = 140;

function createVibeHeroLaneLastRecordMs() {
  const lanes = [];
  for (let lane = 0; lane < VIBE_HERO_LANE_COUNT; lane += 1) {
    lanes.push(-Infinity);
  }
  return lanes;
}

function cloneVibeHeroLaneLastRecordMs(values = null) {
  const lanes = [];
  for (let lane = 0; lane < VIBE_HERO_LANE_COUNT; lane += 1) {
    const value = Number(values?.[lane]);
    lanes.push(Number.isFinite(value) ? value : -Infinity);
  }
  return lanes;
}

function createVibeHeroLaneHeldState() {
  const lanes = [];
  for (let lane = 0; lane < VIBE_HERO_LANE_COUNT; lane += 1) {
    lanes.push(false);
  }
  return lanes;
}

function cloneVibeHeroLaneHeldState(values = null) {
  const lanes = [];
  for (let lane = 0; lane < VIBE_HERO_LANE_COUNT; lane += 1) {
    lanes.push(Boolean(values?.[lane]));
  }
  return lanes;
}

function copyOwnEnumerableProperties(source = null) {
  const copy = {};
  if (!source || typeof source !== 'object') {
    return copy;
  }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      copy[key] = source[key];
    }
  }
  return copy;
}

function copyOwnEnumerablePropertiesInto(target, source = null) {
  if (!source || typeof source !== 'object') {
    return target;
  }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
}

function cloneVibeHeroChart(chart = []) {
  const cloned = [];
  for (const note of Array.isArray(chart) ? chart : []) {
    cloned.push(copyOwnEnumerableProperties(note));
  }
  return cloned;
}

function createNullResults(count = 0) {
  const results = [];
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  for (let index = 0; index < safeCount; index += 1) {
    results.push(null);
  }
  return results;
}

function cloneRoundResults(results = null, count = 0) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (!Array.isArray(results) || results.length !== safeCount) {
    return createNullResults(safeCount);
  }

  const cloned = [];
  for (let index = 0; index < safeCount; index += 1) {
    cloned.push(results[index]);
  }
  return cloned;
}

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
const OFFICE_MANAGER_COFFEE_TARGET_START = 70;
const OFFICE_MANAGER_COFFEE_TARGET_END = 84;
const OFFICE_MANAGER_COFFEE_FILL_SPEED = 32;
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
const PROJECTILE_EFFECT_POOL_LIMIT = 24;
const MUZZLE_FLASH_EFFECT_POOL_LIMIT = 16;
const IMPACT_EFFECT_POOL_LIMIT = 24;
const SOUND_EFFECT_DEFAULT_POOL_SIZE = 4;
const EFFECT_UP = new THREE.Vector3(0, 1, 0);
const BARBELL_BASE_AXIS = new THREE.Vector3(1, 0, 0);
const HIP_FIRE_AIM_LEAD_MS = 90;
const HIP_FIRE_AIM_HOLD_MS = 120;
const SHOT_COLLISION_ORIGIN_FORWARD_OFFSET = PLAYER_RADIUS * 1.15;
const EMOTE_MENU_DEADZONE = 54;
const EMOTE_MENU_DEADZONE_SQ = EMOTE_MENU_DEADZONE * EMOTE_MENU_DEADZONE;
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
const PLAYER_DISPLAY_NAME_STORAGE_KEY = 'vta.playerDisplayName';
const PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY = 'vta.pendingPlayerDisplayName';
const RANDOM_PLAYER_FIRST_NAMES = Object.freeze([
  'JELK',
  'BUNGUS',
  'MEAT',
  'DEEZ',
  'MOIST',
  'SIGNA'
]);
const RANDOM_PLAYER_LAST_NAMES = Object.freeze([
  'MASTER',
  'CHUNKER',
  'GOBLIN',
  'MAXXER',
  'RIZZLER'
]);
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
const ADMIN_PROMPT_TASK_THREAD_LIMIT = 10;
const ADMIN_PROMPT_TASK_REFRESH_MS = 5000;
const RELEASE_VERSION_ENDPOINT = '/version.json';
const RELEASE_VERSION_CHECK_MS = 45000;
const RELEASE_RELOAD_DELAY_MS = 8000;

function normalizeAngleRadians(angle = 0) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

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
const SKILL_LEVEL_UP_FEEDBACK_DEDUPE_MS = 8000;
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
const RENT_INTRO_STAND_UP_EMOTE_ID = STAND_UP_EMOTE_ID;
const RENT_INTRO_STAND_UP_CLIP_NAME = 'standUp';
const PASSIVE_TRAFFIC_PLAYER_HIT_COOLDOWN_MS = 360;
const PASSIVE_TRAFFIC_PLAYER_CAR_COLLISION_DAMAGE = 10;
const PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_SIDE_CLEARANCE = 4.65;
const PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_EXTRA_SIDE_CLEARANCE = 6.15;
const PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_FORWARD_CLEARANCE = 1.25;
const PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_HITBOX_PADDING = 0.45;
const PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_POPUP_TEXT = 'Car crash...';
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
const LOCAL_AUTHORITATIVE_PORTAL_UNLOCK_DISTANCE_SQ = LOCAL_AUTHORITATIVE_PORTAL_UNLOCK_DISTANCE ** 2;
const LOCAL_AUTHORITATIVE_SOFT_RECONCILE_DISTANCE_SQ = LOCAL_AUTHORITATIVE_SOFT_RECONCILE_DISTANCE ** 2;
const LOCAL_AUTHORITATIVE_ACTIVE_RECONCILE_DISTANCE_SQ = LOCAL_AUTHORITATIVE_ACTIVE_RECONCILE_DISTANCE ** 2;
const LOCAL_AUTHORITATIVE_HARD_SNAP_DISTANCE_SQ = LOCAL_AUTHORITATIVE_HARD_SNAP_DISTANCE ** 2;
const LOCAL_AUTHORITATIVE_RECONCILE_RATE = 5.5;
const ADAPTIVE_RENDER_SAMPLE_MIN_COUNT = 45;
const ADAPTIVE_RENDER_SLOW_FRAME_P95_MS = 44;
const ADAPTIVE_RENDER_RECOVERY_FRAME_P95_MS = 25;
const ADAPTIVE_RENDER_ADJUST_INTERVAL_MS = 3000;
const ADAPTIVE_RENDER_PIXEL_RATIO_STEP = 0.25;
const ADAPTIVE_RENDER_MIN_PIXEL_RATIO_CAP = 1;
const EMPTY_NPC_FOCUS_TARGETS = new Map();
const EMPTY_NPC_SPEECH_ANCHORS = new Map();
const EMPTY_NPC_SERVICE_PLAYERS = new Map();
const EMPTY_NPC_DEBUG_STATE = new Map();
const EMPTY_VISIBLE_OVERHEAD_HEALTH_BAR_IDS = new Set();
const EMPTY_INTERACTABLES = Object.freeze([]);
const EMPTY_COLLIDERS = Object.freeze([]);

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
    return {
      masterVolume: DEFAULT_GAME_SETTINGS.masterVolume
    };
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

function normalizePlayerDisplayName(value = '') {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 32);
}

function pickRandomListValue(values) {
  if (!Array.isArray(values) || values.length <= 0) {
    return '';
  }

  const random = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
    : Math.random();
  return values[Math.floor(random * values.length) % values.length] ?? '';
}

function createRandomPlayerDisplayName() {
  const firstName = pickRandomListValue(RANDOM_PLAYER_FIRST_NAMES);
  const lastName = pickRandomListValue(RANDOM_PLAYER_LAST_NAMES);
  return normalizePlayerDisplayName(`${firstName} ${lastName}`);
}

function readStoredPlayerDisplayName() {
  try {
    return normalizePlayerDisplayName(window.localStorage?.getItem(PLAYER_DISPLAY_NAME_STORAGE_KEY) ?? '');
  } catch {
    return '';
  }
}

function writeStoredPlayerDisplayName(displayName = '') {
  const normalized = normalizePlayerDisplayName(displayName);
  if (!normalized) {
    return '';
  }

  try {
    window.localStorage?.setItem(PLAYER_DISPLAY_NAME_STORAGE_KEY, normalized);
  } catch {
    // Local persistence is best-effort; the server still owns the canonical display name.
  }
  return normalized;
}

function readPendingPlayerDisplayName() {
  try {
    return normalizePlayerDisplayName(
      window.sessionStorage?.getItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY)
      || window.localStorage?.getItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY)
      || ''
    );
  } catch {
    return '';
  }
}

function writePendingPlayerDisplayName(displayName = '') {
  const normalized = normalizePlayerDisplayName(displayName);
  if (!normalized) {
    return '';
  }

  try {
    window.sessionStorage?.setItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY, normalized);
    window.localStorage?.setItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY, normalized);
  } catch {
    // OAuth can still continue; the account may fall back to provider metadata.
  }
  return normalized;
}

function clearPendingPlayerDisplayName() {
  try {
    window.sessionStorage?.removeItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY);
    window.localStorage?.removeItem(PLAYER_PENDING_DISPLAY_NAME_STORAGE_KEY);
  } catch {
    // Best effort cleanup only.
  }
}

function readStoredVibeRadioVolume() {
  try {
    const storage = window.localStorage;
    const raw = storage?.getItem(VIBE_RADIO_VOLUME_STORAGE_KEY);
    if (raw == null || raw === '') {
      return VIBE_RADIO_DEFAULT_VOLUME;
    }
    const stored = Number(raw);
    if (!Number.isFinite(stored)) {
      return VIBE_RADIO_DEFAULT_VOLUME;
    }

    const clamped = THREE.MathUtils.clamp(stored, 0, 1);
    if (storage?.getItem(VIBE_RADIO_VOLUME_STORAGE_VERSION_KEY) !== VIBE_RADIO_VOLUME_STORAGE_VERSION) {
      const migrated = THREE.MathUtils.clamp(clamped * 2, 0, 1);
      storage?.setItem(VIBE_RADIO_VOLUME_STORAGE_KEY, String(migrated));
      storage?.setItem(VIBE_RADIO_VOLUME_STORAGE_VERSION_KEY, VIBE_RADIO_VOLUME_STORAGE_VERSION);
      return migrated;
    }

    return clamped;
  } catch {
    return VIBE_RADIO_DEFAULT_VOLUME;
  }
}

function writeStoredVibeRadioVolume(volume = VIBE_RADIO_DEFAULT_VOLUME) {
  try {
    window.localStorage?.setItem(
      VIBE_RADIO_VOLUME_STORAGE_KEY,
      String(THREE.MathUtils.clamp(Number(volume) || 0, 0, 1))
    );
    window.localStorage?.setItem(VIBE_RADIO_VOLUME_STORAGE_VERSION_KEY, VIBE_RADIO_VOLUME_STORAGE_VERSION);
  } catch {
    // Local persistence is best-effort; radio playback should continue if storage is unavailable.
  }
}

function readStoredVibeRadioPlaybackState() {
  try {
    return window.localStorage?.getItem(VIBE_RADIO_PLAYBACK_STORAGE_KEY) === VIBE_RADIO_PLAYBACK_PAUSED
      ? VIBE_RADIO_PLAYBACK_PAUSED
      : VIBE_RADIO_PLAYBACK_PLAYING;
  } catch {
    return VIBE_RADIO_PLAYBACK_PLAYING;
  }
}

function writeStoredVibeRadioPlaybackState(state = VIBE_RADIO_PLAYBACK_PLAYING) {
  try {
    window.localStorage?.setItem(
      VIBE_RADIO_PLAYBACK_STORAGE_KEY,
      state === VIBE_RADIO_PLAYBACK_PAUSED ? VIBE_RADIO_PLAYBACK_PAUSED : VIBE_RADIO_PLAYBACK_PLAYING
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

function areHotbarItemOrdersEqual(left = DEFAULT_HOTBAR_ITEM_ORDER, right = DEFAULT_HOTBAR_ITEM_ORDER) {
  const leftOrder = Array.isArray(left) ? left : DEFAULT_HOTBAR_ITEM_ORDER;
  const rightOrder = Array.isArray(right) ? right : DEFAULT_HOTBAR_ITEM_ORDER;
  for (let index = 0; index < HOTBAR_SLOT_COUNT; index += 1) {
    if ((leftOrder[index] ?? '') !== (rightOrder[index] ?? '')) {
      return false;
    }
  }
  return true;
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

  let wordCount = 0;
  let inWord = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const charCode = normalized.charCodeAt(index);
    const isWhitespace = charCode <= 32 || charCode === 160;
    if (isWhitespace) {
      inWord = false;
    } else if (!inWord) {
      wordCount += 1;
      inWord = true;
    }
  }
  const estimatedWordCount = Math.max(wordCount, Math.ceil(normalized.length / 6));
  const lifetime = CHAT_BUBBLE_BASE_LIFETIME_MS + estimatedWordCount * CHAT_BUBBLE_MS_PER_WORD;
  return THREE.MathUtils.clamp(
    lifetime,
    CHAT_BUBBLE_MIN_LIFETIME_MS,
    CHAT_BUBBLE_MAX_LIFETIME_MS
  );
}

function getFirstFiniteNumber(first, second = undefined, third = undefined) {
  const firstNumber = Number(first);
  if (Number.isFinite(firstNumber)) {
    return firstNumber;
  }
  const secondNumber = Number(second);
  if (Number.isFinite(secondNumber)) {
    return secondNumber;
  }
  const thirdNumber = Number(third);
  return Number.isFinite(thirdNumber) ? thirdNumber : null;
}

function distanceSquared2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return (dx * dx) + (dz * dz);
}

function distanceSquared3D(a = null, b = null) {
  const distanceSq = distanceSquared2D(
    Number(a?.x ?? 0),
    Number(a?.z ?? 0),
    Number(b?.x ?? 0),
    Number(b?.z ?? 0)
  );
  const ay = Number(a?.y);
  const by = Number(b?.y);
  if (!Number.isFinite(ay) || !Number.isFinite(by)) {
    return distanceSq;
  }

  const dy = ay - by;
  return distanceSq + (dy * dy);
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

function getPortalTriggerDistanceSquared(playerPosition, interactable) {
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

  return distanceSquared2D(
    interactable.triggerPosition.x ?? 0,
    interactable.triggerPosition.z ?? 0,
    playerPosition.x ?? 0,
    playerPosition.z ?? 0
  );
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (let index = 0; index < material.length; index += 1) {
      material[index]?.dispose?.();
    }
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

  const seamRotations = [
    [0, 0, 0],
    [Math.PI * 0.5, 0, 0],
    [0, Math.PI * 0.5, 0],
    [0.58, 0, 0.34],
    [-0.58, 0, -0.34]
  ];
  for (let index = 0; index < seamRotations.length; index += 1) {
    const rotation = seamRotations[index];
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(BASKETBALL_SHOT_BALL_RADIUS * 1.012, 0.006, 5, 54),
      seamMaterial
    );
    seam.name = `BasketballShotSeam${index + 1}`;
    seam.rotation.set(rotation[0], rotation[1], rotation[2]);
    seam.castShadow = false;
    seam.receiveShadow = true;
    group.add(seam);
  }

  return group;
}

function normalizeTreadmillRunBpm(bpm = TREADMILL_RUN_MIN_BPM) {
  const parsedBpm = Math.round(Number(bpm) || TREADMILL_RUN_MIN_BPM);
  return THREE.MathUtils.clamp(parsedBpm, TREADMILL_RUN_MIN_BPM, TREADMILL_RUN_MAX_BPM);
}

function createRandomTreadmillRunBpm() {
  return TREADMILL_RUN_MIN_BPM + Math.floor(Math.random() * ((TREADMILL_RUN_MAX_BPM - TREADMILL_RUN_MIN_BPM) + 1));
}

function createTreadmillRunBeatSchedule({
  durationMs = TREADMILL_DURATION_MS,
  bpm = TREADMILL_RUN_MIN_BPM
} = {}) {
  const safeDuration = Math.max(800, Number(durationMs) || TREADMILL_DURATION_MS);
  const runBpm = normalizeTreadmillRunBpm(bpm);
  const beats = [];
  let elapsedMs = TREADMILL_RUN_FIRST_BEAT_MS;
  while (elapsedMs < safeDuration - 90) {
    const intervalMs = 60000 / Math.max(1, runBpm);
    beats.push({
      timeMs: elapsedMs,
      bpm: runBpm,
      intervalMs,
      hitAtMs: null,
      hitOffsetMs: null,
      hitScore: 0,
      status: 'pending'
    });
    elapsedMs += intervalMs;
  }
  return beats;
}

function createTreadmillRunCountdownBeatSchedule({
  countdownMs = TREADMILL_RUN_COUNTDOWN_MS,
  beats = [],
  bpm = null
} = {}) {
  const safeCountdownMs = Math.max(1000, Number(countdownMs) || TREADMILL_RUN_COUNTDOWN_MS);
  const firstRunBeatMs = Math.max(0, Number(beats?.[0]?.timeMs ?? TREADMILL_RUN_FIRST_BEAT_MS) || TREADMILL_RUN_FIRST_BEAT_MS);
  const runBpm = normalizeTreadmillRunBpm(bpm ?? beats?.[0]?.bpm);
  const intervalMs = 60000 / Math.max(1, runBpm);
  const countdownBeats = [];
  for (let timeMs = safeCountdownMs + firstRunBeatMs - intervalMs; timeMs > 0; timeMs -= intervalMs) {
    countdownBeats.push({
      timeMs,
      bpm: runBpm,
      intervalMs
    });
  }
  countdownBeats.sort((a, b) => a.timeMs - b.timeMs);
  return countdownBeats;
}

function calculateTreadmillRunScore(run = null) {
  const beats = Array.isArray(run?.beats) ? run.beats : [];
  if (!beats.length) {
    return 0;
  }
  let scoreTotal = 0;
  for (let index = 0; index < beats.length; index += 1) {
    scoreTotal += Math.max(0, Math.min(1, Number(beats[index].hitScore) || 0));
  }
  const rawScore = scoreTotal / beats.length;
  const penalty = Math.max(0, Math.floor(Number(run?.extraTaps ?? 0) || 0)) * TREADMILL_RUN_EXTRA_TAP_PENALTY;
  return Math.max(0, Math.min(100, Math.round((rawScore * 100) - penalty)));
}

function disposeObjectMaterials(root) {
  root?.traverse?.((node) => {
    disposeMaterial(node.material);
  });
}

function collectMaterialList(material) {
  if (!Array.isArray(material)) {
    return material ? [material] : [];
  }

  const materials = [];
  for (const entry of material) {
    if (entry) {
      materials.push(entry);
    }
  }
  return materials;
}

function cloneEntryList(entries = []) {
  const clonedEntries = new Array(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    clonedEntries[index] = copyOwnEnumerableProperties(entries[index]);
  }
  return clonedEntries;
}

function getSelectedIdListSignature(selectedId = '', entries = []) {
  let signature = String(selectedId ?? '');
  for (let index = 0; index < entries.length; index += 1) {
    signature += `|${entries[index]?.id ?? ''}`;
  }
  return signature;
}

function listContainsValue(values = [], value = '') {
  for (const entry of values) {
    if (entry === value) {
      return true;
    }
  }
  return false;
}

function addValuesToSet(target, values = []) {
  target.clear();
  for (const value of values) {
    target.add(value);
  }
  return target;
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
  if (
    !Number.isFinite(minX)
    || !Number.isFinite(maxX)
    || !Number.isFinite(minZ)
    || !Number.isFinite(maxZ)
    || maxX <= minX
    || maxZ <= minZ
  ) {
    return null;
  }

  return { minX, maxX, minZ, maxZ };
}

function appendCacheBuster(url = '', version = Date.now()) {
  const text = String(url ?? '').trim();
  if (!text) {
    return '';
  }

  return `${text}${text.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`;
}

function normalizeWorldMapLayoutHash(value = '') {
  const text = String(value ?? '').trim();
  return /^[a-z0-9:_-]{4,128}$/iu.test(text) ? text : '';
}

function hashWorldMapText(value = '') {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeWorldMapLayoutNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : fallback;
}

function normalizeWorldMapLayoutEntries(entries = [], layer = '') {
  const normalized = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const cell = Array.isArray(entry?.cell)
      ? [
          normalizeWorldMapLayoutNumber(entry.cell[0], 0),
          normalizeWorldMapLayoutNumber(entry.cell[1], 0)
        ]
      : null;
    const position = Array.isArray(entry?.position)
      ? [
          normalizeWorldMapLayoutNumber(entry.position[0], 0),
          normalizeWorldMapLayoutNumber(entry.position[1], 0)
        ]
      : null;
    normalized.push({
      layer,
      itemId: String(entry?.itemId ?? entry?.modelId ?? '').trim(),
      ...(cell ? { cell } : {}),
      ...(position ? { position } : {}),
      rotationQuarterTurns: normalizeWorldMapLayoutNumber(entry?.rotationQuarterTurns, 0),
      ...(Number.isFinite(Number(entry?.rotationY)) ? { rotationY: normalizeWorldMapLayoutNumber(entry.rotationY, 0) } : {}),
      ...(Number.isFinite(Number(entry?.scale)) ? { scale: normalizeWorldMapLayoutNumber(entry.scale, 1) } : {})
    });
  }
  normalized.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return normalized;
}

function createWorldMapLayoutHash(layout = null) {
  if (!layout || typeof layout !== 'object') {
    return '';
  }

  const payload = {
    tiles: normalizeWorldMapLayoutEntries(layout.tiles, 'tile'),
    props: normalizeWorldMapLayoutEntries(layout.props, 'prop'),
    npcs: normalizeWorldMapLayoutEntries(layout.npcs, 'npc')
  };
  if (!payload.tiles.length && !payload.props.length && !payload.npcs.length) {
    return '';
  }

  return `layout_${hashWorldMapText(JSON.stringify(payload))}`;
}

function normalizeWorldMapImageMetadata(metadata = {}, sourceUrl = window.location.href) {
  const bounds = normalizeWorldMapBounds(metadata?.bounds);
  const image = typeof metadata?.image === 'string' ? metadata.image.trim() : '';
  if (!bounds || !image) {
    return null;
  }

  const capturedMs = Date.parse(metadata.capturedAt ?? '');
  const layoutHash = normalizeWorldMapLayoutHash(metadata.layoutHash ?? metadata.layout_hash);
  const versionParts = [
    Number.isFinite(capturedMs) ? capturedMs : Date.now(),
    layoutHash
  ].filter(Boolean);
  let src = image;
  try {
    src = new URL(image, sourceUrl || window.location.href).toString();
  } catch {
    src = image;
  }
  return {
    src: appendCacheBuster(src, versionParts.join('-')),
    bounds,
    width: Math.max(1, Math.round(Number(metadata.width) || WORLD_MAP_CAPTURE_WIDTH)),
    height: Math.max(1, Math.round(Number(metadata.height) || WORLD_MAP_CAPTURE_HEIGHT)),
    capturedAt: typeof metadata.capturedAt === 'string' ? metadata.capturedAt : '',
    layoutHash,
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

    this.camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_FOV, window.innerWidth / window.innerHeight, 0.5, 400);
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
    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.handleFirstPersonCanvasPointerDown(event);
    }, { capture: true });
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      this.handleFirstPersonCanvasPointerDown(event);
    }, { capture: true });
    document.addEventListener('pointerlockchange', () => this.handleFirstPersonPointerLockChange());
    document.addEventListener('mousemove', (event) => this.handleFirstPersonMouseMove(event));

    this.hud = new Hud(this.root);
    this.authService = createSupabaseAuthService();
    this.authState = this.authService.getState();
    this.authUnsubscribe = null;
    this.playerDisplayName = readStoredPlayerDisplayName();
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
    this.carSelectorVisible = false;
    this.carSelectorFocusedItemId = '';
    this.carSelectorRequestInFlight = false;
    this.transportRideToggled = false;
    this.characterPreviewRenderer = null;
    this.characterPreviewRendererPromise = null;
    this.vehiclePreviewRenderer = null;
    this.vehiclePreviewRendererPromise = null;
    this.carSelectorPreviewSyncRequestId = 0;
    this.carDealerPreviewSyncRequestId = 0;
    this.lastCarSelectorPreviewSignature = '';
    this.characterPreviewWarmupQueued = false;
    this.characterSelectorSyncRequestId = 0;
    this.characterSelectorViewportSyncFrame = 0;
    this.phoneCharacterSyncRequestId = 0;
    this.phoneMenuVisible = false;
    this.phoneTextingModeActive = false;
    this.phoneTextingAnimationFrame = 0;
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
    this.projectileEffectPool = [];
    this.muzzleFlashEffectPool = [];
    this.impactEffectPools = {
      player: [],
      world: []
    };
    this.muzzleFlashDirection = new THREE.Vector3();
    this.muzzleFlashLocalDirection = new THREE.Vector3();
    this.muzzleFlashParentQuaternion = new THREE.Quaternion();
    this.currentInteractable = null;
    this.portalArrival = parsePortalArrival(window.location.search);
    this.portalRedirectInFlight = false;
    this.portalDisarmedPlacementIds = new Set();
    this.portalSpawnPlacementId = '';
    this.portalSpawnLockUntil = 0;
    this.openPoliceGaragePlacementIds = new Set();
    this.localPlayerVelocity = new THREE.Vector3();
    this.localPlayerDelta = new THREE.Vector3();
    this.localAnimationSyncState = {};
    this.activeColliders = [];
    this.worldBuilderColliders = [];
    this.gymCheckInColliders = [];
    this.activeInteractables = [];
    this.worldBuilderInteractables = [];
    this.worldBuilderInteractablesFrame = -1;
    this.activeInteractablesFrame = -1;
    this.frameCounter = 0;
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
    this.lastNpcFocusTargetStates = new Map();
    this.npcFocusTargetIdsToRemove = [];
    this.npcHudSpeechAnchors = new Map();
    this.npcInteractionHintFrame = -1;
    this.npcInteractionHintState = {
      npcInteractable: null,
      deliveryInteraction: null,
      deliveryPromptInteraction: null,
      gymCheckInInteraction: null,
      stockMarketInteraction: null,
      blackjackInteraction: null,
      schoolMicrogameInteraction: null,
      bartenderInteraction: null,
      pawnShopOwnerInteraction: null,
      carDealerInteraction: null,
      marthaInteraction: null,
      interactable: null
    };
    this.npcVendorSearchOptions = {
      npcId: '',
      worldBuilderInteractables: EMPTY_INTERACTABLES
    };
    this.npcVendorPositionScratch = new THREE.Vector3();
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
    this.taskTrackerGetActiveInteractables = () => this.getActiveInteractables(this.taskTrackerContext.worldBuilderInteractables);
    this.taskTrackerGetGymDoorBlockers = () => this.getGymDoorBlockers();
    this.pendingWorldPatches = [];
    this.pendingWorldPatchCursor = 0;
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
      pickups: new Map(),
      passiveTraffic: new Map()
    };
    this.npcRuntimeRenderState = new Map();
    this.npcRuntimeRenderIdsToRemove = [];
    this.emoteMenuOpen = false;
    this.emoteSelectionScratch = { index: -1, entry: null, hasSelection: false };
    this.projectedSpeechPosition = new THREE.Vector3();
    this.projectedSpeechScreen = { x: 0, y: 0 };
    this.speechAnchorScratch = new THREE.Vector3();
    this.visibleOverheadHealthBarIds = new Set();
    this.overheadHealthBarRecords = new Map();
    this.overheadHealthBars = [];
    this.speechBubbleRecords = new Map();
    this.speechBubbleRecordActiveIds = new Set();
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
    this.firstPersonModeActive = false;
    this.firstPersonPointerLocked = false;
    this.firstPersonYaw = 0;
    this.firstPersonPitch = 0;
    this.firstPersonDirection = new THREE.Vector3(0, 0, 1);
    this.firstPersonMovementForward = new THREE.Vector3(0, 0, 1);
    this.firstPersonLookTarget = new THREE.Vector3();
    this.lastFirstPersonModeHudSignature = '';
    this.lastFirstPersonCrosshairVisible = false;
    this.pendingHipFireShot = null;
    this.hotbarItemOrder = readStoredHotbarItemOrder();
    this.hotbarLayoutRevision = 0;
    this.hotbarSlots = createHotbarSlots({ hotbarItemOrder: this.hotbarItemOrder });
    this.selectedHotbarSlotIndex = 0;
    this.pendingHotbarWeaponId = null;
    this.pendingHotbarRequestedAt = 0;
    this.lastHotbarHudSignature = '';
    this.lastHotbarHudLayoutRevision = -1;
    this.lastHotbarHudSelectedIndex = -1;
    this.lastHotbarHudDisabled = null;
    this.lastHotbarHudOwnedWeaponIds = null;
    this.lastHotbarHudEquippedWeaponId = null;
    this.lastHotbarHudBeerCount = null;
    this.lastHotbarHudShotCount = null;
    this.lastHotbarHudCigaretteCount = null;
    this.lastHotbarHudBurgerCount = null;
    this.lastHotbarHudGlizzyCount = null;
    this.lastHotbarHudSodaCount = null;
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
    this.phoneMapPlacementFeatureRevision = null;
    this.phoneMapPlacementFeatureSource = null;
    this.phoneMapPlacementFeatures = [];
    this.worldMapImage = null;
    this.worldMapImageRequest = null;
    this.worldMapImageRequestUrl = '';
    this.worldMapImageRequestSeq = 0;
    this.worldMapImageMetadataUrl = '';
    this.worldMapCaptureInFlight = false;
    this.worldMapAutoCapturePromise = null;
    this.worldMapAutoCaptureLastHash = '';
    this.worldMapAutoCaptureLastAttemptAt = 0;
    this.worldMapLayoutHashRevision = null;
    this.worldMapLayoutHashSource = null;
    this.worldMapLayoutHashValue = '';
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
    this.lastConnectionHudStatus = null;
    this.lastConnectionHudLabel = null;
    this.lastConnectionHudDetail = null;
    this.lastConnectionHudActivePlayerCount = null;
    this.lastConnectionToastStatus = '';
    this.lastSkillAwardSeq = 0;
    this.lastSkillProgressSignature = '';
    this.lastSkillProgressStrengthXp = -1;
    this.lastSkillProgressAgilityXp = -1;
    this.lastSkillProgressIntelligenceXp = -1;
    this.lastSkillProgressCharismaXp = -1;
    this.lastSkillProgressAwardSeq = -1;
    this.lastSkillProgressAwardSkillId = '';
    this.lastSkillProgressAwardXpGained = -1;
    this.lastSkillProgressAwardOldLevel = -1;
    this.lastSkillProgressAwardNewLevel = -1;
    this.skillLevelSnapshot = new Map();
    this.recentSkillLevelUpFeedback = new Map();
    this.visibleCharacterSelectorCardIds = new Set();
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
    this.activeInteractionCamera = null;
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
    this.memoryMatchMatchedIdSet = new Set();
    this.schoolGeographyCountryModule = null;
    this.schoolGeographyCountryModulePromise = null;
    this.schoolGeographyCountrySyncPending = false;
    this.schoolGeographyCountrySyncPendingGameId = '';
    this.schoolGeographyGlobeRenderer = null;
    this.schoolGeographyGlobeRendererPromise = null;
    this.schoolGeographyGlobeSyncPending = false;
    this.schoolTeacherPreviewRenderer = null;
    this.schoolTeacherPreviewRendererPromise = null;
    this.schoolTeacherPreviewSyncPending = false;
    this.vibeHero = null;
    this.vibeHeroSelectedSongId = VIBE_HERO_DEFAULT_SONG_ID;
    this.vibeHeroSequence = 0;
    this.vibeHeroAudioContext = null;
    this.vibeHeroAudioMaster = null;
    this.vibeHeroAudioNodes = [];
    this.vibeHeroAudioElement = null;
    this.vibeHeroAudioPreloads = new Map();
    this.vibeRadioTracks = createDefaultVibeRadioTracks();
    this.vibeRadioAudio = new Audio();
    this.vibeRadioAudio.preload = 'metadata';
    this.vibeRadioSelectedTrackId = '';
    this.vibeRadioPlaying = false;
    this.vibeRadioVolume = readStoredVibeRadioVolume();
    this.vibeRadioPlaybackState = readStoredVibeRadioPlaybackState();
    this.vibeRadioError = '';
    this.vibeRadioLoadedTrackId = '';
    this.vibeRadioLoadedSourceUrl = '';
    this.vibeRadioTimeUpdateFrame = 0;
    this.vibeRadioAutoplayPending = this.vibeRadioPlaybackState !== VIBE_RADIO_PLAYBACK_PAUSED;
    this.vibeRadioAutoplayUnlockHandler = null;
    this.vibeRadioPausedForVibeHero = false;
    this.officeJobPlacementId = '';
    this.officeJanitorGameCycleIndex = 0;
    this.adminPromptOpen = false;
    this.adminPromptActiveTab = 'new';
    this.adminPromptTasks = [];
    this.adminPromptSelectedTaskId = '';
    this.adminPromptLoading = false;
    this.adminPromptLoadingVisible = false;
    this.adminPromptSubmitting = false;
    this.adminPromptPendingAction = null;
    this.adminPromptError = '';
    this.adminPromptRefreshAt = 0;
    this.adminPromptRequest = null;
    this.adminPromptThreadLimit = ADMIN_PROMPT_TASK_THREAD_LIMIT;
    this.adminPromptHasMoreThreads = false;
    this.adminPromptThreadTasks = new Map();
    this.adminPromptThreadRequests = new Map();
    this.debugMinigameRequestHandled = false;
    this.debugMinigameRequestRetryTimeout = 0;
    this.aimPoseDebugVisible = false;
    this.aimPoseDebugShowSkeleton = false;
    this.poseDebugSection = 'unarmed';
    this.shaderDebugMenuVisible = false;
    this.activeVibeShaderPresetId = DEFAULT_VIBE_SHADER_PRESET_ID;
    this.vibeShaderPresetIntensities = new Map();
    this.lastDrunknessShaderLevel = NaN;
    this.lastDrunknessShaderIntensity = NaN;
    for (let index = 0; index < VIBE_SHADER_PRESETS.length; index += 1) {
      this.vibeShaderPresetIntensities.set(VIBE_SHADER_PRESETS[index].id, DEFAULT_VIBE_SHADER_INTENSITY);
    }
    this.cameraZoomIndex = DEFAULT_CAMERA_ZOOM_INDEX;
    this.deathCameraZoomStartedAt = -Infinity;
    this.deathCameraZoomFromLevel = CAMERA_ZOOM_LEVELS[DEFAULT_CAMERA_ZOOM_INDEX];
    this.damageCameraKickStartedAt = -Infinity;
    this.damageCameraKickEndsAt = -Infinity;
    this.damageCameraDirection = new THREE.Vector3(0, 0, 1);
    this.passiveTrafficPlayerStunUntil = -Infinity;
    this.passiveTrafficPlayerHitCooldownUntil = -Infinity;
    this.passiveTrafficCrashDirection = new THREE.Vector3(0, 0, 1);
    this.passiveTrafficCrashSide = new THREE.Vector3(1, 0, 0);
    this.passiveTrafficCrashCandidate = new THREE.Vector3();
    this.passiveTrafficCrashToPlayer = new THREE.Vector3();
    this.damageCameraKickStrength = 1;
    this.localStateInitialized = false;
    this.lastLocalAlive = true;
    this.lastLocalEquippedWeaponId = '';
    this.lastLocalPunchAt = -Infinity;
    this.lastLocalPunchComboStep = 0;
    this.bufferedPunch = null;
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
    this.pistolShotSound = this.createSoundEffect(assets.combat.pistolShot, { volume: 0.5, maxVoices: 6 });
    this.punchImpactSounds = this.createSoundEffectPool(assets.combat.punchImpacts, { volume: 0.62 });
    this.punchWhiffSounds = this.createSoundEffectPool(assets.combat.punchWhiffs, { volume: 0.34 });
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
    this.moneyHudState = {
      amount: 0,
      netWorth: 0,
      stockProfit: 0
    };
    this.taskHudState = {
      visible: false,
      title: ''
    };
    this.combatHudState = {
      visible: true,
      health: PLAYER_MAX_HEALTH,
      maxHealth: PLAYER_MAX_HEALTH,
      ammoInClip: 0,
      reserveAmmo: 0,
      isReloading: false,
      reloadEndsAt: 0,
      alive: true,
      respawnAt: 0,
      kills: 0,
      deaths: 0,
      armed: false
    };
    this.mobileControlsHudState = {
      visible: true,
      armed: false,
      fireLabel: ''
    };
    this.drunknessHudState = {
      level: 0
    };
    this.skillXpFloaters = [];
    this.skillXpFloaterSequence = 0;
    this.skillXpFloaterAnchor = new THREE.Vector3();
    this.workoutLeftHandPosition = new THREE.Vector3();
    this.workoutRightHandPosition = new THREE.Vector3();
    this.workoutBarbellMidpoint = new THREE.Vector3();
    this.workoutBarbellAxis = new THREE.Vector3();
    this.workoutForward = new THREE.Vector3();
    this.workoutBarbellQuaternion = new THREE.Quaternion();
    this.snatchWorkoutForward = new THREE.Vector3();
    this.snatchWorkoutSide = new THREE.Vector3();
    this.basketballShotHandPosition = new THREE.Vector3();
    this.basketballShotRimPosition = new THREE.Vector3();
    this.basketballShotForward = new THREE.Vector3();
    this.basketballShotSide = new THREE.Vector3();
    this.treadmillRunForward = new THREE.Vector3();
    this.treadmillRunSide = new THREE.Vector3();
    this.playerBoundItemsHudState = {
      skateboardOwned: false,
      skating: false,
      vehicleItemId: '',
      vehicleLabel: ''
    };
    this.playerSkateboardState = {
      owned: false,
      skating: false,
      vehicleItemId: ''
    };
    this.playerUpdateOptions = {
      skateboardOwned: false,
      vehicleItemId: '',
      skating: false,
      speedScale: 1,
      movementCameraForward: CAMERA_MOVEMENT_FORWARD,
      stationaryRun: false,
      locomotionMode: undefined,
      locomotionPlaybackRate: undefined
    };
    this.playerWeaponStateOptions = {
      visible: true
    };
    this.playerReloadStateOptions = {
      weaponId: '',
      startedAtMs: 0,
      endsAtMs: 0,
      resetMotion: true
    };
    this.playerAliveStateOptions = {
      startedAtMs: 0
    };
    this.activeWorkoutUpdateOptions = {
      localAlive: true,
      colliders: EMPTY_COLLIDERS,
      sceneBounds: null,
      groundHeight: 0,
      now: 0
    };
    this.workoutMoveOptions = {
      speedScale: 1,
      stopDistance: SNATCH_APPROACH_STOP_DISTANCE
    };
    this.basketballShotHudGame = {
      phase: 'idle',
      progress: 0,
      released: false,
      made: null,
      release: null,
      score: 0,
      message: ''
    };
    this.basketballShotHudState = {
      visible: false,
      game: null
    };
    this.treadmillRunHudGame = {
      phase: 'idle',
      countdownMs: TREADMILL_RUN_COUNTDOWN_MS,
      countdownElapsedMs: 0,
      countdownRemainingMs: 0,
      durationMs: 0,
      elapsedMs: 0,
      remainingMs: 0,
      bpm: 0,
      score: 0,
      beatCount: 0,
      hitCount: 0,
      missedCount: 0,
      nextBeatProgress: 0,
      grade: '',
      awardXp: false,
      rewardScore: TREADMILL_RUN_REWARD_SCORE,
      message: ''
    };
    this.treadmillRunHudState = {
      visible: false,
      game: null
    };
    this.treadmillRunAudioNodes = [];
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
    this.interactionCameraBaseTarget = new THREE.Vector3();
    this.interactionCameraLookTarget = new THREE.Vector3();
    this.interactionCameraPlayerLookTarget = new THREE.Vector3();
    this.interactionCameraForward = new THREE.Vector3(0, 0, 1);
    this.interactionCameraRight = new THREE.Vector3(1, 0, 0);
    this.cameraOcclusionPreservePlacementIds = [];
    this.cameraOcclusionOptions = {
      preserveInteriorNodePlacementIds: this.cameraOcclusionPreservePlacementIds
    };
    this.cameraUpdateOptions = {
      snap: false,
      now: 0
    };
    this.interactionCameraFocusOptions = {
      snap: false,
      now: 0
    };
    this.cameraFovOptions = {
      snap: false,
      smoothing: INTERACTION_CAMERA_RETURN_FOV_SMOOTHING
    };
    this.movementFrameSummaryOptions = {
      force: false,
      now: 0
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
    this.hud.bindTreadmillRunEvents({
      onAction: (action) => this.handleTreadmillRunAction(action)
    });
    this.hud.bindAdminPromptEvents({
      onToggle: () => this.toggleAdminPromptPanel(),
      onClose: () => this.setAdminPromptOpen(false),
      onRefresh: () => void this.refreshAdminPromptTasks({ force: true }),
      onLoadMore: (limit) => void this.loadMoreAdminPromptTasks(limit),
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
      onAuthGoogleSignIn: () => void this.handleAuthGoogleSignIn(),
      onAuthSignOut: () => void this.handleAuthSignOut(),
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
    this.hud.bindFirstPersonModeEvents({
      onToggle: () => this.toggleFirstPersonMode()
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
    this.hud.bindCarSelectorEvents({
      onTogglePanel: (visible) => this.toggleCarSelector(visible),
      onCycleCar: (step) => this.cycleCarSelection(step),
      onFocusCar: (itemId) => this.focusCarSelectorVehicle(itemId),
      onSelectCar: (itemId) => void this.selectPlayerVehicle(itemId)
    });
    this.hud.bindCharacterSelectorEvents({
      onTogglePanel: (visible) => this.toggleCharacterSelector(visible),
      onCycleCharacter: (step) => this.cycleCharacterSelection(step),
      onSelectCharacter: (characterId) => this.selectCharacter(characterId),
      onViewportChange: () => this.queueCharacterSelectorViewportSync()
    });
    this.refreshHotbarHud();
    this.refreshZoomHud();
    this.refreshCarSelectorHud();
    this.refreshCharacterSelectorHud();
    this.refreshFirstPersonModeHud();
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

    const measureEntries = performance.getEntriesByType('measure');
    const measures = [];
    for (let index = 0; index < measureEntries.length; index += 1) {
      const entry = measureEntries[index];
      if (!listContainsValue(this.bootMeasureLabels, entry.name)) {
        continue;
      }

      measures.push({
        name: entry.name,
        durationMs: Number(entry.duration.toFixed(1))
      });
    }

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
      tracerMaterialTemplate: new THREE.LineBasicMaterial({
        color: 0xf6d87f,
        transparent: true,
        opacity: 0.92
      }),
      impactWorldGeometry: new THREE.SphereGeometry(0.18, 10, 10),
      impactWorldMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xf2c871,
        transparent: true,
        opacity: 0.9
      }),
      impactPlayerCoreGeometry: new THREE.SphereGeometry(0.16, 12, 12),
      impactPlayerCoreMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff8f7a,
        transparent: true,
        opacity: 0.92
      }),
      impactPlayerSparkGeometry: new THREE.OctahedronGeometry(0.23, 0),
      impactPlayerSparkMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xffddd5,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      }),
      impactPlayerRingGeometry: new THREE.RingGeometry(0.12, 0.28, 28),
      impactPlayerRingMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff6d80,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
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

  createSoundEffect(url, { volume = 1, maxVoices = SOUND_EFFECT_DEFAULT_POOL_SIZE } = {}) {
    if (!url) {
      return null;
    }

    return {
      url,
      volume: THREE.MathUtils.clamp(volume, 0, 1),
      template: null,
      voices: [],
      voiceCursor: 0,
      maxVoices: Math.max(1, Math.floor(Number(maxVoices) || SOUND_EFFECT_DEFAULT_POOL_SIZE))
    };
  }

  createSoundEffectPool(urls = [], options = {}) {
    return (Array.isArray(urls) ? urls : [])
      .map((url) => this.createSoundEffect(url, options))
      .filter(Boolean);
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

  getSoundEffectVoice(soundEffect) {
    const template = this.getSoundEffectTemplate(soundEffect);
    if (!template) {
      return null;
    }

    const voices = Array.isArray(soundEffect.voices)
      ? soundEffect.voices
      : (soundEffect.voices = []);
    const maxVoices = Math.max(1, Math.floor(Number(soundEffect.maxVoices) || SOUND_EFFECT_DEFAULT_POOL_SIZE));
    let sound = null;
    if (voices.length < maxVoices) {
      sound = template.cloneNode();
      sound.preload = 'auto';
      sound.load?.();
      voices.push(sound);
    } else {
      const cursor = Math.max(0, Math.floor(Number(soundEffect.voiceCursor) || 0)) % voices.length;
      sound = voices[cursor] ?? null;
    }

    soundEffect.voiceCursor = (Math.max(0, Math.floor(Number(soundEffect.voiceCursor) || 0)) + 1) % maxVoices;
    if (!sound) {
      return null;
    }

    try {
      sound.pause();
      sound.currentTime = 0;
    } catch {
      // Some browsers restrict media seeking before enough data has loaded.
    }
    return sound;
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
      const sound = this.getSoundEffectVoice(soundEffect);
      if (!sound) {
        return;
      }
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

  playPassiveTrafficCrashSound() {
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      this.playSoundEffect(this.playingCardSound, {
        playbackRate: 0.48,
        preservePitch: false,
        volumeScale: 1.15
      });
      return;
    }

    const resumePromise = context.resume?.();
    if (resumePromise?.catch) {
      void resumePromise.catch(() => {});
    }
    const now = context.currentTime;
    const duration = 0.34;
    const masterVolume = THREE.MathUtils.clamp(Number(this.gameSettings?.masterVolume ?? 1), 0, 1);
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const progress = index / data.length;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 2.1);
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    const crunch = context.createBiquadFilter();
    crunch.type = 'bandpass';
    crunch.frequency.setValueAtTime(780, now);
    crunch.Q.setValueAtTime(0.7, now);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.17 * masterVolume), now + 0.018);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(crunch);
    crunch.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(now);
    noise.stop(now + duration);

    const thud = context.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(92, now);
    thud.frequency.exponentialRampToValueAtTime(42, now + 0.18);
    const thudGain = context.createGain();
    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.12 * masterVolume), now + 0.012);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    thud.connect(thudGain);
    thudGain.connect(context.destination);
    thud.start(now);
    thud.stop(now + 0.25);
  }

  playPassiveTrafficCartoonCrashSound() {
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      this.playSoundEffect(this.playingCardSound, {
        playbackRate: 1.85,
        preservePitch: false,
        volumeScale: 1.1
      });
      this.playSoundEffect(this.playingCardSound, {
        playbackRate: 0.72,
        preservePitch: false,
        volumeScale: 0.72,
        delayMs: 95
      });
      return;
    }

    const resumePromise = context.resume?.();
    if (resumePromise?.catch) {
      void resumePromise.catch(() => {});
    }

    const now = context.currentTime;
    const masterVolume = THREE.MathUtils.clamp(Number(this.gameSettings?.masterVolume ?? 1), 0, 1);
    const makeGain = (peak, attackAt, releaseAt) => {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * masterVolume), now + attackAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseAt);
      gain.connect(context.destination);
      return gain;
    };

    const bonk = context.createOscillator();
    bonk.type = 'square';
    bonk.frequency.setValueAtTime(740, now);
    bonk.frequency.exponentialRampToValueAtTime(118, now + 0.19);
    bonk.connect(makeGain(0.12, 0.01, 0.24));
    bonk.start(now);
    bonk.stop(now + 0.25);

    const sproing = context.createOscillator();
    sproing.type = 'sine';
    sproing.frequency.setValueAtTime(170, now + 0.08);
    sproing.frequency.exponentialRampToValueAtTime(420, now + 0.18);
    sproing.frequency.exponentialRampToValueAtTime(260, now + 0.34);
    sproing.connect(makeGain(0.1, 0.1, 0.42));
    sproing.start(now + 0.08);
    sproing.stop(now + 0.43);

    const sampleRate = context.sampleRate;
    const duration = 0.16;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const progress = index / data.length;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 3);
    }
    const burst = context.createBufferSource();
    burst.buffer = buffer;
    const burstFilter = context.createBiquadFilter();
    burstFilter.type = 'highpass';
    burstFilter.frequency.setValueAtTime(1250, now);
    burst.connect(burstFilter);
    burstFilter.connect(makeGain(0.055, 0.005, duration));
    burst.start(now);
    burst.stop(now + duration);
  }

  isLocalPlayerUsingCarTransport(localPlayerState = this.getLocalPlayerState()) {
    return Boolean(localPlayerState?.skating === true && getPlayerVehicleItemId(localPlayerState));
  }

  doesPassiveTrafficRecoveryPositionHitCollider(candidate, radius = PLAYER_RADIUS) {
    if (!candidate) {
      return true;
    }

    const colliders = this.getActiveColliders();
    for (let index = 0; index < colliders.length; index += 1) {
      const collider = colliders[index];
      if (!collider || collider.blocksMovement === false) {
        continue;
      }

      if (collider.type === 'cylinder') {
        const combinedRadius = radius + Math.max(0, Number(collider.radius) || 0);
        const dx = candidate.x - (Number(collider.x) || 0);
        const dz = candidate.z - (Number(collider.z) || 0);
        if ((dx * dx) + (dz * dz) < combinedRadius * combinedRadius) {
          return true;
        }
        continue;
      }

      const box = collider.box ?? collider;
      if (
        box?.min
        && box?.max
        && candidate.x > box.min.x - radius
        && candidate.x < box.max.x + radius
        && candidate.z > box.min.z - radius
        && candidate.z < box.max.z + radius
      ) {
        return true;
      }
    }

    return false;
  }

  clampPassiveTrafficRecoveryPosition(candidate) {
    if (!candidate) {
      return null;
    }

    const bounds = this.getActiveSceneBounds();
    if (Number.isFinite(bounds?.min?.x) && Number.isFinite(bounds?.max?.x)) {
      candidate.x = THREE.MathUtils.clamp(candidate.x, bounds.min.x + PLAYER_RADIUS, bounds.max.x - PLAYER_RADIUS);
    }
    if (Number.isFinite(bounds?.min?.z) && Number.isFinite(bounds?.max?.z)) {
      candidate.z = THREE.MathUtils.clamp(candidate.z, bounds.min.z + PLAYER_RADIUS, bounds.max.z - PLAYER_RADIUS);
    }
    candidate.y = this.getActiveGroundHeightAt(candidate);
    return candidate;
  }

  isPassiveTrafficRecoveryPositionClear(candidate, event = {}, carYaw = 0) {
    if (!candidate) {
      return false;
    }

    if (
      event.carPosition
      && isPointInsidePassiveTrafficHitbox(
        event.carPosition,
        carYaw,
        candidate,
        PLAYER_RADIUS + PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_HITBOX_PADDING
      )
    ) {
      return false;
    }

    return !this.doesPassiveTrafficRecoveryPositionHitCollider(candidate, PLAYER_RADIUS);
  }

  resolvePassiveTrafficCarCrashRecoveryPosition(event = {}, direction = this.passiveTrafficCrashDirection) {
    if (!this.player) {
      return null;
    }

    const forward = this.passiveTrafficCrashDirection.copy(direction);
    forward.y = 0;
    if (forward.lengthSq() <= 0.0001) {
      forward.set(Math.sin(this.player.object.rotation.y), 0, Math.cos(this.player.object.rotation.y));
    }
    forward.normalize();

    const side = this.passiveTrafficCrashSide.set(forward.z, 0, -forward.x);
    if (side.lengthSq() <= 0.0001) {
      side.set(1, 0, 0);
    } else {
      side.normalize();
    }

    const carPosition = event.carPosition;
    const toPlayer = this.passiveTrafficCrashToPlayer;
    if (carPosition) {
      toPlayer.set(
        this.player.position.x - (Number(carPosition.x) || 0),
        0,
        this.player.position.z - (Number(carPosition.z) || 0)
      );
    } else {
      toPlayer.set(0, 0, 0);
    }
    const preferredSideSign = toPlayer.dot(side) >= 0 ? 1 : -1;
    const carYaw = Number.isFinite(event.carYaw)
      ? event.carYaw
      : Math.atan2(forward.x, forward.z);
    const sideSigns = [preferredSideSign, -preferredSideSign];
    const sideDistances = [
      PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_SIDE_CLEARANCE,
      PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_EXTRA_SIDE_CLEARANCE
    ];
    const forwardOffsets = [
      0,
      -PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_FORWARD_CLEARANCE,
      PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_FORWARD_CLEARANCE
    ];

    for (const sideSign of sideSigns) {
      for (const sideDistance of sideDistances) {
        for (const forwardOffset of forwardOffsets) {
          const candidate = this.passiveTrafficCrashCandidate
            .copy(this.player.position)
            .addScaledVector(side, sideSign * sideDistance)
            .addScaledVector(forward, forwardOffset);
          this.clampPassiveTrafficRecoveryPosition(candidate);
          if (this.isPassiveTrafficRecoveryPositionClear(candidate, event, carYaw)) {
            return candidate.clone();
          }
        }
      }
    }

    const fallback = this.passiveTrafficCrashCandidate
      .copy(this.player.position)
      .addScaledVector(side, preferredSideSign * PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_EXTRA_SIDE_CLEARANCE);
    this.clampPassiveTrafficRecoveryPosition(fallback);
    return fallback.clone();
  }

  startPassiveTrafficCarCrashCutscene() {
    if (!this.player || this.rentIntroCutscene) {
      return false;
    }

    const now = performance.now();
    const facing = Number.isFinite(this.player.object?.rotation?.y)
      ? this.player.object.rotation.y
      : 0;
    this.rentIntroCutscene = {
      seq: `passive-traffic-car-crash:${Math.round(now)}`,
      npcId: '',
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
    this.updateRentIntroCutsceneCamera(0);
    this.hud.setRentIntroCutsceneState({ visible: true, blink: 1 });
    return true;
  }

  getPassiveTrafficPlayerCollisionTarget() {
    const localPlayerState = this.getLocalPlayerState();
    if (
      !this.player
      || !localPlayerState
      || localPlayerState.alive === false
      || this.worldBuilder?.enabled
      || this.isRentIntroCutsceneActive()
    ) {
      return null;
    }

    const usingCar = this.isLocalPlayerUsingCarTransport(localPlayerState);
    const usingSkateboard = Boolean(localPlayerState.skating === true && !usingCar && isPlayerSkateboardOwner(localPlayerState));
    return {
      position: this.player.position,
      radius: PLAYER_RADIUS,
      yaw: Number.isFinite(this.player.object?.rotation?.y) ? this.player.object.rotation.y : 0,
      alive: true,
      transportKind: usingCar ? 'car' : (usingSkateboard ? 'skateboard' : '')
    };
  }

  handlePassiveTrafficPlayerCarCollision(event = {}, direction = this.passiveTrafficCrashDirection, now = performance.now(), localPlayerState = this.getLocalPlayerState()) {
    const recoveryPosition = this.resolvePassiveTrafficCarCrashRecoveryPosition(event, direction);
    const vehicleItemId = getPlayerVehicleItemId(localPlayerState);
    const transportOwned = isPlayerSkateboardOwner(localPlayerState) || Boolean(vehicleItemId);
    this.transportRideToggled = false;
    this.setLocalPlayerSkateboardState(transportOwned, false, vehicleItemId);

    if (recoveryPosition) {
      this.player.position.copy(recoveryPosition);
      this.resetLocalPlayerKinematics(this.player.position, now);
    }

    this.player.triggerDamageFeedback?.({ direction });
    this.triggerDamageCameraFeedback(direction);
    this.playPassiveTrafficCartoonCrashSound();
    this.hud.showToast(PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_POPUP_TEXT);
    this.startPassiveTrafficCarCrashCutscene();

    void this.npcService?.applyPassiveTrafficHit?.({
      damage: PASSIVE_TRAFFIC_PLAYER_CAR_COLLISION_DAMAGE,
      emoteId: '',
      position: recoveryPosition
        ? {
          x: recoveryPosition.x,
          y: recoveryPosition.y,
          z: recoveryPosition.z
        }
        : undefined,
      rotationY: this.player.object.rotation.y
    });
  }

  handlePassiveTrafficPlayerCollision(event = {}) {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.player || !localPlayerState || localPlayerState.alive === false) {
      return;
    }

    const now = performance.now();
    if (now < this.passiveTrafficPlayerHitCooldownUntil) {
      return;
    }
    this.passiveTrafficPlayerHitCooldownUntil = now + PASSIVE_TRAFFIC_PLAYER_HIT_COOLDOWN_MS;

    const direction = this.passiveTrafficCrashDirection.set(
      Number(event.direction?.x ?? 0) || 0,
      0,
      Number(event.direction?.z ?? 0) || 0
    );
    if (direction.lengthSq() <= 0.0001) {
      direction.set(Math.sin(this.player.object.rotation.y), 0, Math.cos(this.player.object.rotation.y));
    }
    direction.normalize();
    if (event.transportKind === 'car' || this.isLocalPlayerUsingCarTransport(localPlayerState)) {
      this.handlePassiveTrafficPlayerCarCollision(event, direction, now, localPlayerState);
      return;
    }

    const damage = Math.max(0, Math.floor(Number(event.damage) || 0));
    const stunMs = Math.max(0, Number(event.stunSeconds) || 0) * 1000;
    this.passiveTrafficPlayerStunUntil = Math.max(this.passiveTrafficPlayerStunUntil, now + stunMs);
    this.player.playEmote?.(STAND_UP_EMOTE_ID, {
      startedAtMs: Date.now(),
      trackSync: true
    });

    this.player.triggerDamageFeedback?.({ direction });
    this.triggerDamageCameraFeedback(direction);
    this.playPassiveTrafficCrashSound();

    if (damage > 0) {
      void this.npcService?.applyPassiveTrafficHit?.({
        damage,
        emoteId: STAND_UP_EMOTE_ID
      });
    }
  }

  playRandomSoundEffect(
    soundEffects = [],
    {
      volumeScale = 1,
      playbackRateMin = 1,
      playbackRateMax = 1,
      preservePitch = false,
      delayMs = 0
    } = {}
  ) {
    if (!Array.isArray(soundEffects) || soundEffects.length === 0) {
      return;
    }

    const soundEffect = soundEffects[Math.floor(Math.random() * soundEffects.length)];
    const minRate = Number(playbackRateMin) || 1;
    const maxRate = Number(playbackRateMax) || minRate;
    const playbackRate = THREE.MathUtils.randFloat(
      Math.min(minRate, maxRate),
      Math.max(minRate, maxRate)
    );
    this.playSoundEffect(soundEffect, {
      volumeScale,
      playbackRate,
      preservePitch,
      delayMs
    });
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
      for (const voice of soundEffect?.voices ?? []) {
        voice.volume = this.getEffectiveSoundVolume(soundEffect);
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

  getPunchLungeAssist(aimDirection = { x: 0, z: 1 }) {
    const origin = this.player?.position;
    if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.z)) {
      return 0;
    }

    const aimLength = Math.hypot(Number(aimDirection?.x) || 0, Number(aimDirection?.z) || 0);
    if (!Number.isFinite(aimLength) || aimLength <= 0.0001) {
      return 0;
    }

    const aim = {
      x: (Number(aimDirection.x) || 0) / aimLength,
      z: (Number(aimDirection.z) || 0) / aimLength
    };
    const targets = [];

    for (const [sessionId, target] of this.npcServiceState.players.entries()) {
      if (sessionId === this.npcServiceState.sessionId || target?.alive === false) {
        continue;
      }

      targets.push({
        kind: 'player',
        targetId: sessionId,
        x: Number(target.x),
        z: Number(target.z),
        radius: PLAYER_RADIUS
      });
    }

    for (const [npcId, target] of this.npcServiceState.npcs.entries()) {
      if (target?.alive === false || target?.mode === 'hidden') {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      targets.push({
        kind: 'npc',
        targetId: npcId,
        x: Number(target.x),
        z: Number(target.z),
        radius: model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      });
    }

    const assistedTarget = chooseAimAssistTarget(origin, aim, targets, {
      maxDistance: PUNCH_RANGE,
      maxAngleRad: PUNCH_TARGET_ASSIST_MAX_ANGLE_RAD,
      rangeBonus: PUNCH_TARGET_ASSIST_RANGE_BONUS,
      capsuleRadius: PUNCH_HITBOX_RADIUS
    });

    if (!assistedTarget) {
      return 0;
    }

    const reachPressure = THREE.MathUtils.clamp(
      (assistedTarget.distance - (PUNCH_RANGE * 0.55)) / Math.max(0.001, PUNCH_RANGE * 0.45),
      0,
      1
    );
    return PUNCH_ASSISTED_LUNGE_BONUS * THREE.MathUtils.lerp(0.45, 1, reachPressure);
  }

  normalizePunchAimPayload(aimDirection) {
    const fallback = this.currentAimDirection ?? { x: 0, z: 1 };
    const x = Number.isFinite(Number(aimDirection?.x)) ? Number(aimDirection.x) : Number(fallback.x) || 0;
    const z = Number.isFinite(Number(aimDirection?.z)) ? Number(aimDirection.z) : Number(fallback.z) || 1;
    const length = Math.hypot(x, z);
    if (length <= 0.0001) {
      return { x: 0, z: 1 };
    }

    return { x: x / length, z: z / length };
  }

  clearBufferedPunch() {
    this.bufferedPunch = null;
  }

  getPunchEmoteIdForComboStep(comboStep) {
    const normalizedStep = normalizePunchComboStep(comboStep);
    if (normalizedStep === PUNCH_COMBO_UPPERCUT_STEP) {
      return PUNCH_UPPERCUT_EMOTE_ID;
    }
    if (normalizedStep === PUNCH_COMBO_HOOK_STEP) {
      return PUNCH_HOOK_EMOTE_ID;
    }
    return PUNCH_EMOTE_ID;
  }

  queueBufferedPunch(aimDirection, comboStep = PUNCH_COMBO_JAB_STEP, now = Date.now()) {
    const elapsedSinceLastPunch = now - this.lastLocalPunchAt;
    const normalizedStep = normalizePunchComboStep(comboStep);
    const resolvedStep = resolvePunchComboStep({
      requestedStep: normalizedStep,
      lastStep: this.lastLocalPunchComboStep,
      elapsedMs: elapsedSinceLastPunch
    });
    if (
      normalizedStep === PUNCH_COMBO_JAB_STEP
      || resolvedStep !== normalizedStep
      || !Number.isFinite(elapsedSinceLastPunch)
      || elapsedSinceLastPunch < 0
      || elapsedSinceLastPunch > PUNCH_COMBO_WINDOW_MS
    ) {
      return false;
    }

    const releaseDelayMs = Math.max(PUNCH_COMBO_MIN_INTERVAL_MS, getPunchComboReleaseDelayMs(normalizedStep));
    const releaseAt = this.lastLocalPunchAt + releaseDelayMs;
    const expiresAt = Math.min(
      this.lastLocalPunchAt + PUNCH_COMBO_WINDOW_MS,
      Math.max(now, releaseAt) + PUNCH_COMBO_BUFFER_MS
    );
    const aim = this.normalizePunchAimPayload(aimDirection);
    this.bufferedPunch = {
      aimX: aim.x,
      aimZ: aim.z,
      comboStep: normalizedStep,
      releaseAt,
      expiresAt
    };
    return true;
  }

  processBufferedPunch(aimDirection, now = Date.now()) {
    if (!this.bufferedPunch) {
      return false;
    }

    const bufferedPunch = this.bufferedPunch;
    if (
      now > bufferedPunch.expiresAt
      || (now - this.lastLocalPunchAt) > PUNCH_COMBO_WINDOW_MS
      || resolvePunchComboStep({
        requestedStep: bufferedPunch.comboStep,
        lastStep: this.lastLocalPunchComboStep,
        elapsedMs: now - this.lastLocalPunchAt
      }) !== bufferedPunch.comboStep
    ) {
      this.clearBufferedPunch();
      return false;
    }

    if (now < bufferedPunch.releaseAt) {
      return false;
    }

    const aim = aimDirection
      ? this.normalizePunchAimPayload(aimDirection)
      : { x: bufferedPunch.aimX, z: bufferedPunch.aimZ };
    this.clearBufferedPunch();
    return this.punchLocal(aim, { allowBuffer: false, requestedStep: bufferedPunch.comboStep });
  }

  punchLocal(aimDirection, { allowBuffer = true, requestedStep = null } = {}) {
    const now = Date.now();
    const aim = this.normalizePunchAimPayload(aimDirection);
    const punchLungeBonus = this.getPunchLungeAssist(aim);
    const elapsedSinceLastPunch = now - this.lastLocalPunchAt;
    const nextRequestedStep = requestedStep ?? getNextPunchComboStep(
      this.lastLocalPunchComboStep,
      elapsedSinceLastPunch
    );
    const comboStep = resolvePunchComboStep({
      requestedStep: nextRequestedStep,
      lastStep: this.lastLocalPunchComboStep,
      elapsedMs: elapsedSinceLastPunch
    });
    const didPunch = this.npcService?.punch?.(
      aim,
      now,
      { comboStep }
    ) === true;

    if (didPunch) {
      this.clearBufferedPunch();
      this.lastLocalPunchAt = now;
      this.lastLocalPunchComboStep = comboStep;
      const punchEmoteId = this.getPunchEmoteIdForComboStep(comboStep);
      this.player?.playEmote(punchEmoteId, { punchLungeBonus });
      this.playRandomSoundEffect(this.punchWhiffSounds, {
        volumeScale: 0.9,
        playbackRateMin: comboStep === PUNCH_COMBO_UPPERCUT_STEP ? 0.84 : 0.94,
        playbackRateMax: comboStep === PUNCH_COMBO_UPPERCUT_STEP ? 0.98 : 1.08,
        preservePitch: false
      });
    }

    if (!didPunch && allowBuffer && comboStep !== PUNCH_COMBO_JAB_STEP) {
      this.queueBufferedPunch(aim, comboStep, now);
    }

    if (!didPunch && (now - this.lastLocalPunchAt) > PUNCH_COMBO_WINDOW_MS) {
      this.lastLocalPunchComboStep = 0;
      this.clearBufferedPunch();
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
    if (level !== this.lastDrunknessShaderLevel && this.vibeShaderPass?.uniforms?.uDrunknessLevel) {
      this.vibeShaderPass.uniforms.uDrunknessLevel.value = level;
      this.lastDrunknessShaderLevel = level;
    }
    if (intensity !== this.lastDrunknessShaderIntensity && this.vibeShaderPass?.uniforms?.uDrunknessIntensity) {
      this.vibeShaderPass.uniforms.uDrunknessIntensity.value = intensity;
      this.lastDrunknessShaderIntensity = intensity;
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
    const visibleIds = this.visibleCharacterSelectorCardIds;
    this.hud.getVisibleCharacterSelectorCardIds({
      overscanPx: 180,
      output: visibleIds
    });
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
    const entries = cloneEntryList(this.characterRoster);
    this.hud.setPhoneCharacterState({
      selectedId,
      entries
    });

    void this.syncPhoneCharacterPreview(entries, selectedId);
  }

  refreshPhoneMissionsHud() {
    this.hud.setPhoneMissionsState(this.phoneMissionState);
  }

  refreshPhoneSkillsHud(localPlayerState = this.getLocalPlayerState(), { skills = null } = {}) {
    if (localPlayerState) {
      this.phoneSkillsState = {
        skills: Array.isArray(skills) ? skills : getPlayerSkillsSnapshot(localPlayerState),
        recentAward: this.phoneSkillsState.recentAward ?? null
      };
    }
    if (!this.phoneMenuVisible || this.phoneActiveAppId !== 'skills') {
      return;
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
    if (!this.phoneMenuVisible || this.phoneActiveAppId !== 'wallet') {
      return;
    }
    this.hud.setPhoneWalletState(this.phoneWalletState);
  }

  getListedStockSymbol(stocks = [], preferredSymbol = '') {
    const normalizedPreferredSymbol = String(preferredSymbol ?? '').trim().toUpperCase();
    let fallbackSymbol = '';
    for (const stock of Array.isArray(stocks) ? stocks : []) {
      const symbol = String(stock?.symbol ?? '').trim().toUpperCase();
      if (!symbol) {
        continue;
      }

      if (!fallbackSymbol) {
        fallbackSymbol = symbol;
      }
      if (symbol === normalizedPreferredSymbol) {
        return symbol;
      }
    }

    return fallbackSymbol;
  }

  refreshPhoneStocksHud() {
    const market = this.getActiveStockMarketSnapshot()
      ?? this.phoneStocksState.market
      ?? this.phoneWalletState.wallet;
    const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
    const listedSymbol = this.getListedStockSymbol(stocks, this.stockMarketSelectedSymbol);
    if (!this.stockMarketSelectedSymbol || listedSymbol !== this.stockMarketSelectedSymbol) {
      this.stockMarketSelectedSymbol = listedSymbol;
    }
    this.phoneStocksState = {
      ...this.phoneStocksState,
      market,
      selectedSymbol: this.stockMarketSelectedSymbol,
      quantity: this.stockMarketQuantity
    };
    if (!this.phoneMenuVisible || this.phoneActiveAppId !== 'stocks') {
      return;
    }
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
    let sum = 0;
    for (let index = 0; index < stocks.length; index += 1) {
      sum += normalizeMoneyAmount(stocks[index]?.unrealizedProfit ?? 0);
    }
    return sum;
  }

  refreshPhoneMapHud(localPlayerState = this.getLocalPlayerState(), { force = false } = {}) {
    if (!this.phoneMenuVisible || this.phoneActiveAppId !== 'map') {
      return;
    }

    const metadataEndpoint = this.getWorldMapImageMetadataEndpoint();
    const mapImageFresh = this.isWorldMapImageFreshForCurrentLayout(this.worldMapImage);
    if (
      force
      || (!this.worldMapImage && !this.worldMapImageRequest)
      || (metadataEndpoint && this.worldMapImageMetadataUrl !== metadataEndpoint)
      || !mapImageFresh
    ) {
      void this.ensureFreshWorldMapImage({ force });
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
    const mapImage = this.isWorldMapImageFreshForCurrentLayout(this.worldMapImage) ? this.worldMapImage : null;
    const imageBounds = mapImage?.bounds ?? null;
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
    let hasPoint = false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const includePoint = (xValue, zValue) => {
      const x = Number(xValue);
      const z = Number(zValue);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return;
      }

      hasPoint = true;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    };

    for (const feature of features) {
      includePoint(feature.x, feature.z);
    }
    if (localPlayerState) {
      includePoint(localPlayerState.x, localPlayerState.z);
    }

    if (!hasPoint) {
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

    minX -= 8;
    maxX += 8;
    minZ -= 8;
    maxZ += 8;
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

    const length = x && z ? Math.SQRT2 : 1;
    const bounds = this.getPhoneMapBounds();
    const viewSpanX = bounds.spanX / this.phoneMapZoom;
    const viewSpanZ = bounds.spanZ / this.phoneMapZoom;
    const scale = Math.max(0, Number(deltaSeconds) || 0) * PHONE_MAP_KEY_PAN_VIEW_FRACTION_PER_SECOND;
    this.panPhoneMapByWorldDelta({
      x: (x / length) * viewSpanX * scale,
      z: (z / length) * viewSpanZ * scale
    });
  }

  getAdminAccessToken() {
    return this.authService?.getAccessToken?.() ?? '';
  }

  getAdminAuthHeaders(headers = {}) {
    const token = this.getAdminAccessToken();
    return {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    };
  }

  getWorldMapCaptureEndpoint() {
    const backendEndpoint = getBackendHttpEndpoint(this.npcService?.endpoint, WORLD_MAP_CAPTURE_ENDPOINT);
    if (backendEndpoint) {
      return backendEndpoint;
    }

    return new URL(WORLD_MAP_CAPTURE_ENDPOINT, window.location.href).toString();
  }

  getWorldMapImageMetadataEndpoint() {
    const backendEndpoint = getBackendHttpEndpoint(this.npcService?.endpoint, WORLD_MAP_CAPTURE_ENDPOINT);
    if (backendEndpoint) {
      return backendEndpoint;
    }

    return new URL(WORLD_MAP_IMAGE_METADATA_URL, window.location.href).toString();
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
      const value = String(url.searchParams.get('agentAutoDeploy') ?? '').toLowerCase();
      return value === '1' || value === 'true' || value === 'yes';
    } catch {
      return false;
    }
  }

  canUseAdminPrompt() {
    return Boolean(this.isLocalAdmin() && this.getAdminAccessToken());
  }

  getAdminPromptThreadIdForTask(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id) {
      return '';
    }

    let summaryTask = null;
    for (const task of this.adminPromptTasks) {
      if (task.id === id) {
        summaryTask = task;
        break;
      }
    }
    if (summaryTask) {
      return String(summaryTask.threadId || summaryTask.id || '').trim();
    }

    for (const threadTasks of this.adminPromptThreadTasks.values()) {
      let task = null;
      if (Array.isArray(threadTasks)) {
        for (const candidate of threadTasks) {
          if (candidate.id === id) {
            task = candidate;
            break;
          }
        }
      }
      if (task) {
        return String(task.threadId || task.id || '').trim();
      }
    }

    return id;
  }

  getAdminPromptHudTasks() {
    const selectedThreadId = this.getAdminPromptThreadIdForTask(this.adminPromptSelectedTaskId);
    const mergedTasks = new Map();
    for (const task of this.adminPromptTasks) {
      if (task?.id) {
        mergedTasks.set(task.id, task);
      }
    }

    const cachedThreadTasks = selectedThreadId
      ? this.adminPromptThreadTasks.get(selectedThreadId)
      : null;
    if (Array.isArray(cachedThreadTasks)) {
      for (const task of cachedThreadTasks) {
        if (!task?.id) {
          continue;
        }
        const summaryTask = mergedTasks.get(task.id);
        if (summaryTask) {
          const mergedTask = copyOwnEnumerableProperties(task);
          copyOwnEnumerablePropertiesInto(mergedTask, summaryTask);
          mergedTasks.set(task.id, mergedTask);
        } else {
          mergedTasks.set(task.id, task);
        }
      }
    }

    const tasks = [];
    for (const task of mergedTasks.values()) {
      tasks.push(task);
    }
    return tasks;
  }

  async loadAdminPromptThread(taskId = '', { force = false } = {}) {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }

    const initialThreadId = this.getAdminPromptThreadIdForTask(id);
    const requestKey = initialThreadId || id;
    if (!force && initialThreadId && this.adminPromptThreadTasks.has(initialThreadId)) {
      return;
    }
    if (this.adminPromptThreadRequests.has(requestKey)) {
      return this.adminPromptThreadRequests.get(requestKey);
    }

    const request = (async () => {
      try {
        const url = new URL(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/thread`));
        url.searchParams.set('compact', '1');
        url.searchParams.set('readOnly', '1');
        const response = await fetch(url.toString(), {
          cache: 'no-store',
          headers: this.getAdminAuthHeaders()
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || 'Could not load prompt thread.');
        }

        const threadTasks = Array.isArray(result.threadTasks)
          ? result.threadTasks
          : Array.isArray(result.tasks)
            ? result.tasks
            : [];
        const threadId = String(threadTasks[0]?.threadId || threadTasks[0]?.id || initialThreadId || id).trim();
        if (threadId) {
          this.adminPromptThreadTasks.set(threadId, threadTasks);
          this.refreshAdminPromptHud();
        }
      } catch (error) {
        console.warn('[AgentTasks] Thread detail refresh failed.', error);
        this.adminPromptError = error?.message ?? 'Prompt thread refresh failed.';
        this.refreshAdminPromptHud();
      }
    })();

    this.adminPromptThreadRequests.set(requestKey, request);
    try {
      await request;
    } finally {
      this.adminPromptThreadRequests.delete(requestKey);
    }
  }

  refreshAdminPromptHud() {
    const available = this.canUseAdminPrompt();
    const context = this.getAdminPromptContext();
    const hudTasks = this.getAdminPromptHudTasks();
    if (!available) {
      this.hud.setAdminPromptState({
        available: false,
        open: false,
        activeTab: this.adminPromptActiveTab,
        tasks: hudTasks,
        selectedTaskId: this.adminPromptSelectedTaskId,
        loading: false,
        submitting: false,
        error: '',
        hasMoreThreads: false,
        pendingAction: null,
        contextLabel: context.contextLabel
      });
      return;
    }

    this.hud.setAdminPromptState({
      available: true,
      open: this.adminPromptOpen,
      activeTab: this.adminPromptActiveTab,
      tasks: hudTasks,
      selectedTaskId: this.adminPromptSelectedTaskId,
      loading: this.adminPromptLoadingVisible,
      submitting: this.adminPromptSubmitting,
      error: this.adminPromptError,
      autoDeployAvailable: this.isAdminPromptAutoDeployAvailable(),
      hasMoreThreads: this.adminPromptHasMoreThreads,
      pendingAction: this.adminPromptPendingAction,
      contextLabel: context.contextLabel
    });
  }

  isAdminPromptActionPending(action = '', taskId = '') {
    const pending = this.adminPromptPendingAction;
    if (!pending || pending.action !== String(action ?? '').trim()) {
      return false;
    }

    const normalizedTaskId = String(taskId ?? '').trim();
    return !normalizedTaskId || pending.taskId === normalizedTaskId;
  }

  hasAdminPromptPendingAction() {
    return Boolean(this.adminPromptPendingAction?.action);
  }

  setAdminPromptPendingAction(action = '', taskId = '') {
    const normalizedAction = String(action ?? '').trim();
    const normalizedTaskId = String(taskId ?? '').trim();
    this.adminPromptPendingAction = normalizedAction
      ? { action: normalizedAction, taskId: normalizedTaskId }
      : null;
    this.refreshAdminPromptHud();
  }

  clearAdminPromptPendingAction(action = '', taskId = '') {
    if (!this.isAdminPromptActionPending(action, taskId)) {
      return;
    }

    this.adminPromptPendingAction = null;
    this.refreshAdminPromptHud();
  }

  mergeAdminPromptTask(task = null) {
    if (!task?.id) {
      return;
    }

    const normalizedTask = copyOwnEnumerableProperties(task);
    let taskMerged = false;
    for (let index = 0; index < this.adminPromptTasks.length; index += 1) {
      if (this.adminPromptTasks[index]?.id !== normalizedTask.id) {
        continue;
      }

      this.adminPromptTasks[index] = {
        ...copyOwnEnumerableProperties(this.adminPromptTasks[index]),
        ...normalizedTask
      };
      taskMerged = true;
      break;
    }
    if (!taskMerged) {
      this.adminPromptTasks.unshift(normalizedTask);
    }

    const threadId = String(normalizedTask.threadId || normalizedTask.id || '').trim();
    if (!threadId) {
      return;
    }

    const threadTasks = this.adminPromptThreadTasks.get(threadId);
    if (!Array.isArray(threadTasks)) {
      return;
    }

    let threadTaskMerged = false;
    const mergedThreadTasks = [];
    for (let index = 0; index < threadTasks.length; index += 1) {
      const threadTask = threadTasks[index];
      if (threadTask?.id === normalizedTask.id) {
        mergedThreadTasks.push({
          ...copyOwnEnumerableProperties(threadTask),
          ...normalizedTask
        });
        threadTaskMerged = true;
      } else {
        mergedThreadTasks.push(threadTask);
      }
    }
    if (!threadTaskMerged) {
      mergedThreadTasks.push(normalizedTask);
    }
    this.adminPromptThreadTasks.set(threadId, mergedThreadTasks);
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
    let distance = 0;
    if (position && this.player?.position) {
      const dx = position.x - this.player.position.x;
      const dz = position.z - this.player.position.z;
      distance = Math.sqrt((dx * dx) + (dz * dz));
    }
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
    const includeVibeHeroStoredCharts = Boolean(
      this.vibeHero
      || context.contextType === 'vibe_hero'
      || context.contextType === 'vibe_hero_chart_editor'
    );
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
        treadmillRunOpen: this.hud.isTreadmillRunOpen(),
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
      vibeHeroStoredEditorCharts: includeVibeHeroStoredCharts
        ? this.getVibeHeroStoredEditorChartsSnapshot()
        : [],
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
      treadmillRun: this.activeWorkout?.treadmillRun
        ? {
            phase: this.activeWorkout.treadmillRun.phase,
            score: this.activeWorkout.treadmillRun.score,
            beatCount: this.activeWorkout.treadmillRun.beats?.length ?? 0,
            hitCount: this.activeWorkout.treadmillRun.beats?.filter?.((beat) => beat.status === 'hit').length ?? 0,
            awardXp: this.activeWorkout.treadmillRun.awardXp === true
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
      this.adminPromptHasMoreThreads = false;
      this.adminPromptError = '';
      this.adminPromptLoading = false;
      this.adminPromptLoadingVisible = false;
      this.refreshAdminPromptHud();
      return;
    }
    if (this.adminPromptLoading || (!force && performance.now() < this.adminPromptRefreshAt)) {
      return;
    }

    this.adminPromptLoading = true;
    this.adminPromptLoadingVisible = Boolean(showLoading);
    this.adminPromptError = '';
    if (showLoading) {
      this.refreshAdminPromptHud();
    }
    try {
      const url = new URL(this.getAdminAgentTasksEndpoint());
      url.searchParams.set('scope', ADMIN_PROMPT_TASK_SCOPE);
      url.searchParams.set('limit', String(this.adminPromptThreadLimit));
      url.searchParams.set('view', 'threads');
      url.searchParams.set('compact', '1');
      url.searchParams.set('readOnly', '1');
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: this.getAdminAuthHeaders()
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not refresh Codex tasks.');
      }

      this.adminPromptTasks = Array.isArray(result.tasks) ? result.tasks : [];
      this.adminPromptHasMoreThreads = Boolean(result.hasMore);
      if (this.adminPromptSelectedTaskId) {
        let selectedTaskExists = false;
        for (let index = 0; index < this.adminPromptTasks.length; index += 1) {
          if (this.adminPromptTasks[index].id === this.adminPromptSelectedTaskId) {
            selectedTaskExists = true;
            break;
          }
        }
        if (!selectedTaskExists) {
          this.adminPromptSelectedTaskId = '';
        }
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
      const hasFreshTasks = this.adminPromptTasks.length > 0 && performance.now() < this.adminPromptRefreshAt;
      void this.refreshAdminPromptTasks({
        force: !hasFreshTasks,
        showLoading: !hasFreshTasks
      });
    }
  }

  toggleAdminPromptPanel() {
    this.setAdminPromptOpen(!this.adminPromptOpen);
  }

  async loadMoreAdminPromptTasks(requestedLimit = 0) {
    if (!this.canUseAdminPrompt() || this.adminPromptLoading) {
      return;
    }

    const numericLimit = Math.trunc(Number(requestedLimit) || 0);
    const nextLimit = numericLimit > this.adminPromptThreadLimit
      ? numericLimit
      : this.adminPromptThreadLimit + ADMIN_PROMPT_TASK_THREAD_LIMIT;
    this.adminPromptThreadLimit = Math.max(
      ADMIN_PROMPT_TASK_THREAD_LIMIT,
      Math.min(100, nextLimit)
    );
    await this.refreshAdminPromptTasks({ force: true, showLoading: true });
  }

  setAdminPromptTab(tabId = '') {
    const normalizedTabId = String(tabId);
    this.adminPromptActiveTab = normalizedTabId === 'new' || normalizedTabId === 'threads'
      ? normalizedTabId
      : 'threads';
    this.refreshAdminPromptHud();
  }

  selectAdminPromptTask(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id) {
      return;
    }

    let taskExists = false;
    for (let index = 0; index < this.adminPromptTasks.length; index += 1) {
      if (this.adminPromptTasks[index].id === id) {
        taskExists = true;
        break;
      }
    }
    if (!taskExists) {
      return;
    }

    this.adminPromptSelectedTaskId = id;
    this.adminPromptActiveTab = 'threads';
    this.refreshAdminPromptHud();
    void this.loadAdminPromptThread(id, { force: true });
  }

  async submitAdminPromptTask({ prompt = '', mode = 'preview' } = {}) {
    if (!this.canUseAdminPrompt()) {
      this.hud.showToast('Prompt is admin only.');
      return;
    }
    if (this.adminPromptSubmitting || this.hasAdminPromptPendingAction()) {
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
    this.setAdminPromptPendingAction('submit');
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
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
      this.mergeAdminPromptTask(result.task);
      this.hud.clearAdminPromptText();
      this.hud.showToast('Codex task queued.');
      this.refreshAdminPromptHud();
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Submit failed.', error);
      this.adminPromptError = error?.message ?? 'Codex task submit failed.';
    } finally {
      this.adminPromptSubmitting = false;
      this.clearAdminPromptPendingAction('submit');
    }
  }

  async submitAdminPromptFollowup(taskId = '', { prompt = '', mode = 'preview' } = {}) {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }
    if (this.adminPromptSubmitting || this.hasAdminPromptPendingAction()) {
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
    this.setAdminPromptPendingAction('followup', id);
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/followups`), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
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
      this.mergeAdminPromptTask(result.task);
      this.hud.showToast('Follow-up queued.');
      this.refreshAdminPromptHud();
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Follow-up failed.', error);
      this.adminPromptError = error?.message ?? 'Prompt follow-up failed.';
    } finally {
      this.adminPromptSubmitting = false;
      this.clearAdminPromptPendingAction('followup', id);
    }
  }

  async cancelAdminPromptTask(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }
    if (this.hasAdminPromptPendingAction()) {
      return;
    }

    this.adminPromptError = '';
    this.setAdminPromptPendingAction('cancel-task', id);
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/cancel`), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not cancel Codex task.');
      }
      this.mergeAdminPromptTask(result.task);
      this.refreshAdminPromptHud();
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Cancel failed.', error);
      this.adminPromptError = error?.message ?? 'Codex task cancel failed.';
      this.refreshAdminPromptHud();
    } finally {
      this.clearAdminPromptPendingAction('cancel-task', id);
    }
  }

  async approveAdminPromptDeploy(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }
    if (this.hasAdminPromptPendingAction()) {
      return;
    }

    this.adminPromptError = '';
    this.setAdminPromptPendingAction('approve-deploy', id);
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/approve-deploy`), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not approve deploy.');
      }
      this.mergeAdminPromptTask(result.task);
      this.hud.showToast('Deploy approved for worker.');
      this.refreshAdminPromptHud();
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Deploy approval failed.', error);
      this.adminPromptError = error?.message ?? 'Codex deploy approval failed.';
      this.refreshAdminPromptHud();
    } finally {
      this.clearAdminPromptPendingAction('approve-deploy', id);
    }
  }

  async approveAdminPromptRollback(taskId = '') {
    const id = String(taskId ?? '').trim();
    if (!id || !this.canUseAdminPrompt()) {
      return;
    }
    if (this.hasAdminPromptPendingAction()) {
      return;
    }

    this.adminPromptError = '';
    this.setAdminPromptPendingAction('rollback', id);
    try {
      const response = await fetch(this.getAdminAgentTasksEndpoint(`${encodeURIComponent(id)}/rollback`), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          createdBy: this.getAdminPromptCreatedBy()
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not approve rollback.');
      }
      this.mergeAdminPromptTask(result.task);
      this.hud.showToast('Rollback approved for worker.');
      this.refreshAdminPromptHud();
      await this.refreshAdminPromptTasks({ force: true });
    } catch (error) {
      console.warn('[AgentTasks] Rollback approval failed.', error);
      this.adminPromptError = error?.message ?? 'Codex rollback approval failed.';
      this.refreshAdminPromptHud();
    } finally {
      this.clearAdminPromptPendingAction('rollback', id);
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
    const preferredUrl = this.getWorldMapImageMetadataEndpoint();
    const fallbackUrl = new URL(WORLD_MAP_IMAGE_METADATA_URL, window.location.href).toString();
    const candidateUrls = preferredUrl === fallbackUrl ? [preferredUrl] : [preferredUrl, fallbackUrl];
    if (!force && this.worldMapImage && this.worldMapImageMetadataUrl === preferredUrl) {
      return this.worldMapImage;
    }
    if (!force && this.worldMapImageRequest && this.worldMapImageRequestUrl === preferredUrl) {
      return this.worldMapImageRequest;
    }

    const requestSeq = ++this.worldMapImageRequestSeq;
    this.worldMapImageRequestUrl = preferredUrl;
    this.worldMapImageRequest = (async () => {
      let lastStatus = 0;
      try {
        for (const metadataUrl of candidateUrls) {
          const response = await fetch(
            force ? appendCacheBuster(metadataUrl, Date.now()) : metadataUrl,
            { cache: 'no-store' }
          );
          if (!response.ok) {
            lastStatus = response.status;
            continue;
          }

          const image = normalizeWorldMapImageMetadata(await response.json(), metadataUrl);
          if (requestSeq !== this.worldMapImageRequestSeq) {
            return image;
          }

          this.worldMapImage = image;
          this.worldMapImageMetadataUrl = preferredUrl;
          if (this.phoneMenuVisible && this.phoneActiveAppId === 'map') {
            this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
          }

          return this.worldMapImage;
        }

        if (requestSeq === this.worldMapImageRequestSeq) {
          this.worldMapImage = null;
          this.worldMapImageMetadataUrl = '';
        }
        if (lastStatus && lastStatus !== 404) {
          console.warn('[Map] World map metadata request failed.', lastStatus);
        }
        return null;
      } catch (error) {
        console.warn('[Map] Could not load world map image metadata.', error);
        if (requestSeq === this.worldMapImageRequestSeq) {
          this.worldMapImage = null;
          this.worldMapImageMetadataUrl = '';
        }
        return null;
      } finally {
        if (requestSeq === this.worldMapImageRequestSeq) {
          this.worldMapImageRequest = null;
          this.worldMapImageRequestUrl = '';
        }
      }
    })();

    return this.worldMapImageRequest;
  }

  async ensureFreshWorldMapImage({ force = false } = {}) {
    const image = await this.loadWorldMapImageMetadata({ force });
    if (!this.isWorldMapImageFreshForCurrentLayout(image)) {
      await this.captureWorldMapIfStale(image);
    }
    return this.worldMapImage;
  }

  async captureWorldMapIfStale(image = this.worldMapImage) {
    const layoutHash = this.getWorldMapLayoutHash();
    if (
      !layoutHash
      || normalizeWorldMapLayoutHash(image?.layoutHash) === layoutHash
      || !this.worldLayoutReady
      || this.currentInterior?.scene
      || !this.isLocalAdmin()
      || !this.getAdminAccessToken()
    ) {
      return false;
    }

    if (this.worldMapAutoCapturePromise) {
      return this.worldMapAutoCapturePromise;
    }

    const now = Date.now();
    if (
      this.worldMapAutoCaptureLastHash === layoutHash
      && now - this.worldMapAutoCaptureLastAttemptAt < 30000
    ) {
      return false;
    }

    this.worldMapAutoCaptureLastHash = layoutHash;
    this.worldMapAutoCaptureLastAttemptAt = now;
    this.worldMapAutoCapturePromise = this.captureAndSaveWorldMap({ automatic: true })
      .finally(() => {
        this.worldMapAutoCapturePromise = null;
      });
    return this.worldMapAutoCapturePromise;
  }

  getWorldMapCaptureBounds({ width = WORLD_MAP_CAPTURE_WIDTH, height = WORLD_MAP_CAPTURE_HEIGHT } = {}) {
    const features = this.getPhoneMapPlacementFeatures();
    const bounds = {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity
    };
    for (let index = 0; index < features.length; index += 1) {
      const feature = features[index];
      const x = Number(feature.x);
      const z = Number(feature.z);
      const halfWidth = Math.max(0.5, Number(feature.width ?? 1) * 0.5);
      const halfDepth = Math.max(0.5, Number(feature.depth ?? 1) * 0.5);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        continue;
      }

      bounds.minX = Math.min(bounds.minX, x - halfWidth);
      bounds.maxX = Math.max(bounds.maxX, x + halfWidth);
      bounds.minZ = Math.min(bounds.minZ, z - halfDepth);
      bounds.maxZ = Math.max(bounds.maxZ, z + halfDepth);
    }

    const playerPosition = this.player?.position;
    if (Number.isFinite(playerPosition?.x) && Number.isFinite(playerPosition?.z)) {
      bounds.minX = Math.min(bounds.minX, playerPosition.x);
      bounds.maxX = Math.max(bounds.maxX, playerPosition.x);
      bounds.minZ = Math.min(bounds.minZ, playerPosition.z);
      bounds.maxZ = Math.max(bounds.maxZ, playerPosition.z);
    }

    if (
      !Number.isFinite(bounds.minX)
      || !Number.isFinite(bounds.maxX)
      || !Number.isFinite(bounds.minZ)
      || !Number.isFinite(bounds.maxZ)
    ) {
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
    return {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ,
      spanX,
      spanZ,
      centerX,
      centerZ
    };
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

    const uniqueObjects = [];
    const seenObjects = new Set();
    for (const object of objects) {
      if (object && !seenObjects.has(object)) {
        seenObjects.add(object);
        uniqueObjects.push(object);
      }
    }
    return uniqueObjects;
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
    const previousVisibility = [];
    for (const object of hiddenObjects) {
      previousVisibility.push([object, object.visible]);
    }

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

  async captureAndSaveWorldMap({ automatic = false } = {}) {
    if (this.worldMapCaptureInFlight) {
      return false;
    }

    if (!this.isLocalAdmin() || !this.getAdminAccessToken()) {
      if (!automatic) {
        this.hud.showToast('Map capture is admin only.');
      }
      return false;
    }

    if (this.currentInterior?.scene) {
      if (!automatic) {
        this.hud.showToast('Exit interiors before capturing the city map.');
      }
      return false;
    }

    this.worldMapCaptureInFlight = true;
    this.refreshMapCaptureHud();
    try {
      if (!automatic) {
        this.hud.showToast('Capturing city map...');
      }
      const width = WORLD_MAP_CAPTURE_WIDTH;
      const height = WORLD_MAP_CAPTURE_HEIGHT;
      const bounds = this.getWorldMapCaptureBounds({ width, height });
      const layoutHash = this.getWorldMapLayoutHash();
      const dataUrl = await this.captureWorldMapDataUrl({ width, height, bounds });
      const response = await fetch(this.getWorldMapCaptureEndpoint(), {
        method: 'POST',
        headers: this.getAdminAuthHeaders({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          dataUrl,
          bounds: normalizeWorldMapBounds(bounds),
          width,
          height,
          layoutHash
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not save map image.');
      }

      await this.loadWorldMapImageMetadata({ force: true });
      this.refreshPhoneMapHud(this.getLocalPlayerState(), { force: true });
      this.worldBuilder?.updateBuilderHud?.();
      const sizeKb = Math.max(1, Math.round(Number(result.bytes ?? 0) / 1024));
      this.hud.showToast(automatic ? `Phone map refreshed (${sizeKb} KB).` : `Phone map captured (${sizeKb} KB).`);
      return true;
    } catch (error) {
      console.warn('[Map] Capture failed.', error);
      if (!automatic) {
        this.hud.showToast(error?.message ?? 'Map capture failed.');
      }
      return false;
    } finally {
      this.worldMapCaptureInFlight = false;
      this.refreshMapCaptureHud();
    }
  }

  async initializeAuth() {
    if (this.authUnsubscribe) {
      return;
    }

    this.authUnsubscribe = this.authService.subscribe((state) => {
      this.authState = state;
      this.refreshPhoneSettingsHud();
    });

    try {
      this.authState = await this.authService.initialize();
    } catch (error) {
      console.warn('[Auth] Supabase auth initialization failed.', error);
    }
    this.refreshPhoneSettingsHud();
  }

  isAuthSignedIn() {
    return Boolean(
      this.authState?.configured
      && this.authState.status === 'signedIn'
      && this.authService.getAccessToken()
    );
  }

  getAuthDisplayName() {
    return normalizePlayerDisplayName(
      this.authState?.displayName
      || this.authState?.user?.user_metadata?.display_name
      || this.authState?.user?.user_metadata?.full_name
      || this.authState?.user?.user_metadata?.name
      || ''
    );
  }

  async resolveStartupPlayerProfile() {
    const pendingDisplayName = readPendingPlayerDisplayName();
    if (this.isAuthSignedIn()) {
      const displayName = normalizePlayerDisplayName(
        pendingDisplayName
        || this.playerDisplayName
        || this.getAuthDisplayName()
      );
      if (displayName) {
        this.playerDisplayName = writeStoredPlayerDisplayName(displayName);
      }
      if (pendingDisplayName) {
        clearPendingPlayerDisplayName();
      }
      return {
        displayName: this.playerDisplayName
      };
    }

    let suggestedName = createRandomPlayerDisplayName();
    while (true) {
      const selection = await this.hud.showMainMenu({
        googleEnabled: this.authState?.configured === true,
        suggestedName
      });
      const displayName = writeStoredPlayerDisplayName(
        normalizePlayerDisplayName(selection.displayName) || suggestedName || createRandomPlayerDisplayName()
      );
      this.playerDisplayName = displayName;

      if (selection.action === 'google') {
        writePendingPlayerDisplayName(displayName);
        this.authState = await this.authService.signInWithGoogle();
        this.refreshPhoneSettingsHud();
        if (this.authState.status === 'error') {
          this.hud.showToast(this.authState.message || 'Google sign-in failed.');
          suggestedName = displayName || createRandomPlayerDisplayName();
          continue;
        }

        await new Promise(() => {});
        return {
          displayName
        };
      }

      if (this.authState?.configured === true) {
        this.authState = await this.authService.signInAnonymously(displayName);
        this.refreshPhoneSettingsHud();
        if (!this.isAuthSignedIn()) {
          console.warn('[Auth] Guest play could not create an authenticated guest account.', {
            message: this.authState?.message ?? '',
            status: this.authState?.status ?? ''
          });
          this.hud.showToast(this.authState.message || 'Could not create guest account.');
          suggestedName = displayName || createRandomPlayerDisplayName();
          continue;
        }
      }

      this.hud.hideMainMenu();
      return {
        displayName
      };
    }
  }

  async handleAuthGoogleSignIn() {
    this.authState = this.authState?.isAnonymous === true
      ? await this.authService.linkGoogleIdentity()
      : await this.authService.signInWithGoogle();
    this.refreshPhoneSettingsHud();
    if (this.authState.status === 'error' && this.authState.message) {
      this.hud.showToast(this.authState.message);
    }
  }

  async handleAuthSignOut() {
    this.authState = await this.authService.signOut();
    this.refreshPhoneSettingsHud();
    if (this.authState.status === 'signedOut') {
      this.hud.showToast('Signed out.');
    } else if (this.authState.status === 'error' && this.authState.message) {
      this.hud.showToast(this.authState.message);
    }
  }

  refreshPhoneSettingsHud() {
    this.hud.setPhoneSettingsState({
      auth: this.authState,
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
    for (const track of this.vibeRadioTracks) {
      if (track.id === this.vibeRadioSelectedTrackId) {
        return track;
      }
    }

    return this.vibeRadioTracks[0] ?? null;
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
    const radioVolume = THREE.MathUtils.clamp(Number(this.vibeRadioVolume ?? VIBE_RADIO_DEFAULT_VOLUME), 0, 1);
    const rangedRadioVolume = radioVolume * 0.5;
    const curvedRadioVolume = rangedRadioVolume * rangedRadioVolume;
    return THREE.MathUtils.clamp(
      curvedRadioVolume * Number(this.gameSettings?.masterVolume ?? 1),
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

  isVibeHeroHoldingVibeRadio(game = this.vibeHero) {
    if (!game || !this.hud?.isVibeHeroOpen?.()) {
      return false;
    }

    return game.editorMode === true
      || game.phase === 'countdown'
      || game.phase === 'playing';
  }

  pauseVibeRadioForVibeHero() {
    const shouldResume = Boolean(
      this.vibeRadioPausedForVibeHero
      || this.vibeRadioPlaying
      || this.vibeRadioAutoplayPending
      || (this.vibeRadioAudio && !this.vibeRadioAudio.paused)
    );

    if (shouldResume) {
      this.vibeRadioPausedForVibeHero = true;
    }

    if (this.vibeRadioAudio && !this.vibeRadioAudio.paused) {
      this.vibeRadioAudio.pause();
    }
    this.vibeRadioPlaying = false;
    this.clearVibeRadioAutoplayUnlock();
    this.refreshVibeRadioHud();
    return shouldResume;
  }

  resumeVibeRadioAfterVibeHero() {
    if (!this.vibeRadioPausedForVibeHero || this.isVibeHeroHoldingVibeRadio()) {
      return false;
    }

    this.vibeRadioPausedForVibeHero = false;
    if (this.vibeRadioAutoplayPending) {
      void this.startDefaultVibeRadioPlayback();
      return true;
    }

    void this.playVibeRadioTrack();
    return true;
  }

  clearVibeRadioAutoplayUnlock() {
    if (!this.vibeRadioAutoplayUnlockHandler) {
      return;
    }

    window.removeEventListener('pointerdown', this.vibeRadioAutoplayUnlockHandler, true);
    window.removeEventListener('keydown', this.vibeRadioAutoplayUnlockHandler, true);
    window.removeEventListener('touchstart', this.vibeRadioAutoplayUnlockHandler, true);
    this.vibeRadioAutoplayUnlockHandler = null;
  }

  queueVibeRadioAutoplayUnlock() {
    if (this.vibeRadioAutoplayUnlockHandler) {
      return;
    }

    this.vibeRadioAutoplayUnlockHandler = () => {
      this.clearVibeRadioAutoplayUnlock();
      if (this.vibeRadioAutoplayPending && !this.vibeRadioPlaying) {
        void this.startDefaultVibeRadioPlayback();
      }
    };
    window.addEventListener('pointerdown', this.vibeRadioAutoplayUnlockHandler, true);
    window.addEventListener('keydown', this.vibeRadioAutoplayUnlockHandler, true);
    window.addEventListener('touchstart', this.vibeRadioAutoplayUnlockHandler, true);
  }

  async startDefaultVibeRadioPlayback() {
    if (!this.vibeRadioAutoplayPending || this.vibeRadioPlaying || !this.vibeRadioTracks.length) {
      return false;
    }
    if (this.isVibeHeroHoldingVibeRadio()) {
      this.pauseVibeRadioForVibeHero();
      return false;
    }

    const defaultTrack = this.vibeRadioTracks[0];
    if (!defaultTrack) {
      return false;
    }

    if (this.vibeRadioSelectedTrackId !== defaultTrack.id) {
      this.selectVibeRadioTrack(defaultTrack.id, { autoplay: false });
    }

    const played = await this.playVibeRadioTrack(defaultTrack);
    if (played) {
      return true;
    }

    if (!this.vibeRadioError) {
      this.queueVibeRadioAutoplayUnlock();
    } else {
      this.vibeRadioAutoplayPending = false;
      this.clearVibeRadioAutoplayUnlock();
    }

    return false;
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

  syncVibeRadioPlaylist() {
    const nextTracks = createDefaultVibeRadioTracks();
    const previousSelectedTrackId = this.vibeRadioSelectedTrackId;
    this.vibeRadioTracks = nextTracks;

    let selectedStillExists = false;
    for (let index = 0; index < nextTracks.length; index += 1) {
      if (nextTracks[index].id === previousSelectedTrackId) {
        selectedStillExists = true;
        break;
      }
    }
    this.vibeRadioSelectedTrackId = selectedStillExists
      ? previousSelectedTrackId
      : nextTracks[0]?.id ?? '';
    if (this.vibeRadioAutoplayPending && nextTracks[0]) {
      this.vibeRadioSelectedTrackId = nextTracks[0].id;
    }

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
    this.vibeRadioAudio.preload = 'metadata';
    this.vibeRadioLoadedTrackId = track.id;
    this.vibeRadioLoadedSourceUrl = track.sourceUrl;
    this.vibeRadioError = '';
    this.applyVibeRadioVolume();
    this.vibeRadioAudio.load();
    return true;
  }

  async playVibeRadioTrack(track = this.getVibeRadioSelectedTrack()) {
    if (this.isVibeHeroHoldingVibeRadio()) {
      this.vibeRadioPausedForVibeHero = true;
      this.pauseVibeRadioForVibeHero();
      return false;
    }

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
      if (this.isVibeHeroHoldingVibeRadio()) {
        this.vibeRadioPausedForVibeHero = true;
        this.pauseVibeRadioForVibeHero();
        return false;
      }
      this.vibeRadioPlaying = true;
      this.vibeRadioPlaybackState = VIBE_RADIO_PLAYBACK_PLAYING;
      writeStoredVibeRadioPlaybackState(this.vibeRadioPlaybackState);
      this.vibeRadioAutoplayPending = false;
      this.clearVibeRadioAutoplayUnlock();
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
    let track = null;
    for (const entry of this.vibeRadioTracks) {
      if (entry.id === normalizedTrackId) {
        track = entry;
        break;
      }
    }
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
      this.vibeRadioAutoplayPending = false;
      this.vibeRadioPlaybackState = VIBE_RADIO_PLAYBACK_PAUSED;
      writeStoredVibeRadioPlaybackState(this.vibeRadioPlaybackState);
      this.clearVibeRadioAutoplayUnlock();
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

    let currentIndex = 0;
    for (let index = 0; index < this.vibeRadioTracks.length; index += 1) {
      if (this.vibeRadioTracks[index].id === this.vibeRadioSelectedTrackId) {
        currentIndex = index;
        break;
      }
    }
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
    const entries = cloneEntryList(this.characterRoster);
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

  async ensureVehiclePreviewRenderer() {
    if (this.vehiclePreviewRenderer) {
      return this.vehiclePreviewRenderer;
    }

    if (!this.vehiclePreviewRendererPromise) {
      this.vehiclePreviewRendererPromise = import('../ui/VehiclePreviewRenderer.js')
        .then(({ VehiclePreviewRenderer }) => {
          this.vehiclePreviewRenderer = new VehiclePreviewRenderer({ library: this.library });
          return this.vehiclePreviewRenderer;
        })
        .finally(() => {
          this.vehiclePreviewRendererPromise = null;
        });
    }

    return this.vehiclePreviewRendererPromise;
  }

  async syncCarSelectorVehiclePreviews(entries = [], selectedId = '') {
    const requestId = ++this.carSelectorPreviewSyncRequestId;
    let renderer = null;
    try {
      renderer = await this.ensureVehiclePreviewRenderer();
    } catch (error) {
      console.warn('[VehicleSelector] Vehicle preview renderer failed to initialize.', error);
      return;
    }
    if (requestId !== this.carSelectorPreviewSyncRequestId || !this.carSelectorVisible) {
      return;
    }

    const resolvedSelectedId = selectedId || entries[0]?.id || '';
    renderer.mount(this.hud.getCarSelectorPreviewMount());
    renderer.setActive(true);
    await renderer.setVehicle(resolvedSelectedId);
    if (requestId !== this.carSelectorPreviewSyncRequestId || !this.carSelectorVisible) {
      return;
    }

    for (const entry of entries) {
      const mount = this.hud.getCarSelectorCardPreviewMount(entry.id);
      void renderer.mountSnapshot(entry.id, mount);
    }
  }

  async syncCarDealerVehiclePreviews(items = listCarDealerMenuItems()) {
    const requestId = ++this.carDealerPreviewSyncRequestId;
    let renderer = null;
    try {
      renderer = await this.ensureVehiclePreviewRenderer();
    } catch (error) {
      console.warn('[CarDealer] Vehicle preview renderer failed to initialize.', error);
      return;
    }
    if (requestId !== this.carDealerPreviewSyncRequestId || this.activeInteractionMenu?.kind !== 'car-dealer') {
      return;
    }

    for (const item of items) {
      const mount = this.hud.getCarDealerPreviewMount(item.id);
      void renderer.mountSnapshot(item.id, mount);
    }
  }

  getSelectedVehicleSelectorItemId(localPlayerState = this.getLocalPlayerState()) {
    const selectedCarId = getPlayerVehicleItemId(localPlayerState);
    if (selectedCarId) {
      return selectedCarId;
    }

    return isPlayerSkateboardOwner(localPlayerState) ? SKATEBOARD_ITEM_ID : '';
  }

  getCarSelectorEntries(localPlayerState = this.getLocalPlayerState(), focusedItemId = this.getSelectedVehicleSelectorItemId(localPlayerState)) {
    const activeId = this.getSelectedVehicleSelectorItemId(localPlayerState);
    const selectedId = String(focusedItemId ?? '').trim() || activeId;
    const entries = [];
    if (isPlayerSkateboardOwner(localPlayerState)) {
      entries.push({
        id: SKATEBOARD_ITEM_ID,
        label: 'Skateboard',
        kind: 'skateboard',
        accent: '#3aa686',
        selected: selectedId === SKATEBOARD_ITEM_ID,
        active: activeId === SKATEBOARD_ITEM_ID
      });
    }

    for (const entry of getPlayerOwnedVehicleMenuItems(localPlayerState)) {
      entries.push({
        ...entry,
        kind: 'car',
        selected: entry.id === selectedId,
        active: entry.id === activeId
      });
    }

    return entries;
  }

  getCarSelectorFocusedItemId(localPlayerState = this.getLocalPlayerState()) {
    const activeId = this.getSelectedVehicleSelectorItemId(localPlayerState);
    const entries = this.getCarSelectorEntries(localPlayerState, activeId);
    const focusedId = String(this.carSelectorFocusedItemId ?? '').trim();
    if (focusedId) {
      for (const entry of entries) {
        if (entry.id === focusedId) {
          return focusedId;
        }
      }
    }

    return activeId || entries[0]?.id || '';
  }

  getCarSelectorStatusText(localPlayerState = this.getLocalPlayerState()) {
    if (this.carSelectorRequestInFlight) {
      return 'Switching vehicle';
    }

    const selectedId = this.getSelectedVehicleSelectorItemId(localPlayerState);
    if (selectedId === SKATEBOARD_ITEM_ID) {
      return 'Skateboard selected';
    }

    const selectedCar = getPlayerVehicleMenuItem(localPlayerState);
    return selectedCar
      ? `${selectedCar.label} selected`
      : 'No vehicle selected';
  }

  refreshCarSelectorHud(localPlayerState = this.getLocalPlayerState()) {
    const activeId = this.getSelectedVehicleSelectorItemId(localPlayerState);
    const focusedId = this.getCarSelectorFocusedItemId(localPlayerState);
    const entries = this.getCarSelectorEntries(localPlayerState, focusedId);
    const available = this.canUseCarSelector(localPlayerState);
    const visible = available && this.carSelectorVisible;
    if (!available && this.carSelectorVisible) {
      this.carSelectorVisible = false;
    }
    this.carSelectorFocusedItemId = focusedId;

    this.hud.setCarSelectorState({
      available,
      visible,
      selectedId: focusedId,
      activeId,
      statusText: this.getCarSelectorStatusText(localPlayerState),
      entries,
      loading: this.carSelectorRequestInFlight
    });

    if (!visible) {
      this.carSelectorPreviewSyncRequestId += 1;
      this.lastCarSelectorPreviewSignature = '';
      this.vehiclePreviewRenderer?.setActive(false);
      return;
    }

    const previewSignature = getSelectedIdListSignature(focusedId, entries);
    if (previewSignature !== this.lastCarSelectorPreviewSignature) {
      this.lastCarSelectorPreviewSignature = previewSignature;
      void this.syncCarSelectorVehiclePreviews(entries, focusedId);
    }
  }

  setCarSelectorVisible(visible) {
    if (visible) {
      this.closePhoneMenu();
      this.closeInteractionMenu();
      this.characterSelectorVisible = false;
      this.refreshCharacterSelectorHud();
    }

    if (visible) {
      this.carSelectorFocusedItemId = this.getSelectedVehicleSelectorItemId() || this.carSelectorFocusedItemId;
    }
    this.carSelectorVisible = Boolean(visible) && this.canUseCarSelector();
    this.refreshCarSelectorHud();
    return this.carSelectorVisible;
  }

  toggleCarSelector(visible = !this.carSelectorVisible) {
    if (visible && !this.canUseCarSelector()) {
      this.hud.showToast('Own a skateboard or car first.');
      return this.setCarSelectorVisible(false);
    }

    return this.setCarSelectorVisible(visible);
  }

  setCharacterSelectorVisible(visible) {
    if (visible) {
      this.closePhoneMenu();
      this.carSelectorVisible = false;
      this.refreshCarSelectorHud();
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
      && !this.carSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
  }

  setPhoneTextingMode(active, { force = false } = {}) {
    const nextActive = Boolean(active && this.player);
    if (!force && this.phoneTextingModeActive === nextActive) {
      return nextActive;
    }

    const wasActive = this.phoneTextingModeActive;
    this.phoneTextingModeActive = nextActive;
    void this.player?.setPhoneTextingActive?.(nextActive);

    if (this.phoneTextingAnimationFrame) {
      window.cancelAnimationFrame(this.phoneTextingAnimationFrame);
      this.phoneTextingAnimationFrame = 0;
    }

    if (nextActive) {
      this.phoneTextingAnimationFrame = window.requestAnimationFrame(() => {
        this.phoneTextingAnimationFrame = 0;
        if (this.phoneTextingModeActive && this.phoneMenuVisible) {
          this.player?.playEmote(TEXTING_EMOTE_ID);
        }
      });
      return true;
    }

    if (wasActive || force) {
      const animationState = this.player?.getAnimationSyncState?.({});
      if (animationState?.emoteId === TEXTING_EMOTE_ID) {
        this.player?.stopEmote?.();
      }
    }

    return false;
  }

  openPhoneMenu() {
    if (!this.canOpenPhoneMenu()) {
      return false;
    }

    this.phoneMenuVisible = true;
    this.phoneActiveAppId = '';
    this.hud.setPhoneState({ visible: true, activeAppId: this.phoneActiveAppId });
    this.setPhoneTextingMode(true);
    this.playSoundEffect(this.phoneUnlockSound);
    return true;
  }

  closePhoneMenu() {
    this.phoneMenuVisible = false;
    this.phoneActiveAppId = '';
    this.setPhoneTextingMode(false);
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
    if (this.phoneActiveAppId === 'missions') {
      this.syncTaskHud(this.getLocalPlayerState(), { includeMissionList: true });
    }
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

  getPhoneMapPlacementFeatureCacheKey() {
    const source = this.worldBuilder?.worldState ?? this.currentLayout ?? null;
    const revision = Number(this.worldBuilder?.worldState?.getPlacementRevision?.());
    return {
      source,
      revision: Number.isFinite(revision) ? revision : null
    };
  }

  getWorldMapLayoutHash() {
    const cacheKey = this.getPhoneMapPlacementFeatureCacheKey();
    if (
      this.worldMapLayoutHashSource === cacheKey.source
      && this.worldMapLayoutHashRevision === cacheKey.revision
    ) {
      return this.worldMapLayoutHashValue;
    }

    const layout = this.worldBuilder?.getLayout?.() ?? this.currentLayout ?? null;
    this.worldMapLayoutHashSource = cacheKey.source;
    this.worldMapLayoutHashRevision = cacheKey.revision;
    this.worldMapLayoutHashValue = createWorldMapLayoutHash(layout);
    return this.worldMapLayoutHashValue;
  }

  invalidateWorldMapLayoutHash() {
    this.worldMapLayoutHashSource = null;
    this.worldMapLayoutHashRevision = null;
    this.worldMapLayoutHashValue = '';
  }

  isWorldMapImageFreshForCurrentLayout(image = this.worldMapImage) {
    const layoutHash = this.getWorldMapLayoutHash();
    if (!layoutHash) {
      return true;
    }

    return normalizeWorldMapLayoutHash(image?.layoutHash) === layoutHash;
  }

  appendPhoneMapPlacementFeature(features, placement = null, fallbackLayer = '') {
    const layer = placement?.layer ?? fallbackLayer;
    if (!placement || (layer !== 'tile' && layer !== 'prop')) {
      return;
    }

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
      return;
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
              : layer === 'prop'
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

  getPhoneMapPlacementFeatureCache() {
    const cacheKey = this.getPhoneMapPlacementFeatureCacheKey();
    if (
      this.phoneMapPlacementFeatureSource === cacheKey.source
      && this.phoneMapPlacementFeatureRevision === cacheKey.revision
    ) {
      return this.phoneMapPlacementFeatures;
    }

    const features = [];
    if (this.worldBuilder?.forEachPlacement) {
      this.worldBuilder.forEachPlacement((placement) => {
        this.appendPhoneMapPlacementFeature(features, placement);
      });
    } else {
      const layout = this.currentLayout ?? {};
      for (const placement of layout.tiles ?? []) {
        this.appendPhoneMapPlacementFeature(features, placement, 'tile');
      }
      for (const placement of layout.props ?? []) {
        this.appendPhoneMapPlacementFeature(features, placement, 'prop');
      }
    }

    this.phoneMapPlacementFeatureSource = cacheKey.source;
    this.phoneMapPlacementFeatureRevision = cacheKey.revision;
    this.phoneMapPlacementFeatures = features;
    return features;
  }

  getPhoneMapPlacementFeatures() {
    const features = [];
    for (const feature of this.getPhoneMapPlacementFeatureCache()) {
      features.push(feature);
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
    const mapImage = this.isWorldMapImageFreshForCurrentLayout(this.worldMapImage) ? this.worldMapImage : null;
    return {
      player: Number.isFinite(playerX) && Number.isFinite(playerZ)
        ? { x: playerX, z: playerZ, rotationY: Number.isFinite(playerRotationY) ? playerRotationY : 0 }
        : null,
      features: this.getPhoneMapPlacementFeatures(),
      image: mapImage,
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

  cycleCarSelection(step = 1) {
    const localPlayerState = this.getLocalPlayerState();
    const focusedId = this.getCarSelectorFocusedItemId(localPlayerState);
    const entries = this.getCarSelectorEntries(localPlayerState, focusedId);
    if (!entries.length) {
      this.hud.showToast('Own a skateboard or car first.');
      return;
    }

    let currentIndex = -1;
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index].id === focusedId) {
        currentIndex = index;
        break;
      }
    }
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + step + entries.length) % entries.length;
    this.focusCarSelectorVehicle(entries[nextIndex]?.id ?? focusedId);
  }

  focusCarSelectorVehicle(itemId = '') {
    const localPlayerState = this.getLocalPlayerState();
    const entries = this.getCarSelectorEntries(localPlayerState, this.getCarSelectorFocusedItemId(localPlayerState));
    const normalizedItemId = String(itemId ?? '').trim();
    let itemExists = false;
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index].id === normalizedItemId) {
        itemExists = true;
        break;
      }
    }
    if (!itemExists) {
      return false;
    }

    this.carSelectorFocusedItemId = normalizedItemId;
    this.refreshCarSelectorHud(localPlayerState);
    return true;
  }

  applyVehicleInventorySnapshot(inventory = null) {
    if (!inventory || typeof inventory !== 'object') {
      return;
    }

    const sessionId = this.npcServiceState?.sessionId;
    const localPlayerState = this.getLocalPlayerState();
    if (!sessionId || !localPlayerState) {
      return;
    }

    const nextPlayerState = {
      ...localPlayerState,
      skateboardOwned: inventory.skateboardOwned === true,
      vehicleItemId: String(inventory.vehicleItemId ?? localPlayerState.vehicleItemId ?? ''),
      ownedVehicleItemIds: String(inventory.ownedVehicleItemIds ?? localPlayerState.ownedVehicleItemIds ?? ''),
      skating: false
    };
    this.npcServiceState.players.set(sessionId, nextPlayerState);
    this.setLocalPlayerSkateboardState(
      nextPlayerState.skateboardOwned || isPlayerVehicleOwner(nextPlayerState),
      false,
      nextPlayerState.vehicleItemId
    );
  }

  async selectPlayerVehicle(itemId = '') {
    const localPlayerState = this.getLocalPlayerState();
    const normalizedItemId = String(itemId ?? '').trim();
    const item = normalizedItemId === SKATEBOARD_ITEM_ID
      ? { id: SKATEBOARD_ITEM_ID, label: 'Skateboard' }
      : getCarDealerMenuItem(normalizedItemId);
    const ownsItem = normalizedItemId === SKATEBOARD_ITEM_ID
      ? isPlayerSkateboardOwner(localPlayerState)
      : playerOwnsVehicleItem(localPlayerState, item?.id);
    if (!item || !ownsItem) {
      this.hud.showToast('That vehicle is not in your garage.');
      this.refreshCarSelectorHud(localPlayerState);
      return;
    }

    if (this.carSelectorRequestInFlight) {
      return;
    }

    if (this.getSelectedVehicleSelectorItemId(localPlayerState) === item.id) {
      this.refreshCarSelectorHud(localPlayerState);
      return;
    }

    this.carSelectorRequestInFlight = true;
    this.refreshCarSelectorHud(localPlayerState);
    try {
      const result = await this.npcService?.selectPlayerVehicle?.(item.id);
      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'Could not switch vehicles.');
        return;
      }

      this.applyVehicleInventorySnapshot(result.inventory);
      this.carSelectorFocusedItemId = item.id;
      this.syncPlayerBoundItemsHud();
      this.hud.showToast(`${item.label} selected.`);
    } catch (error) {
      console.warn('[VehicleSelector] Vehicle selection failed.', error);
      this.hud.showToast('Vehicle selection request failed.');
    } finally {
      this.carSelectorRequestInFlight = false;
      this.refreshCarSelectorHud();
    }
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
    let currentIndex = -1;
    for (let index = 0; index < this.characterRoster.length; index += 1) {
      if (this.characterRoster[index].id === selectedId) {
        currentIndex = index;
        break;
      }
    }
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
      this.setCarSelectorVisible(false);
      this.setCharacterSelectorVisible(false);
      this.setShaderDebugMenuVisible(false);
      this.setAimPoseDebugVisible(false);
      this.setFirstPersonModeActive(false, { announce: false, requestLock: false });
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

  canUseCarSelector(localPlayerState = this.getLocalPlayerState()) {
    return Boolean(this.player && this.getCarSelectorEntries(localPlayerState).length > 0);
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

  canUseFirstPersonMode() {
    return this.isLocalAdmin();
  }

  isFirstPersonPointerLockActive() {
    return document.pointerLockElement === this.renderer?.domElement;
  }

  isFirstPersonMouseBlocked() {
    return Boolean(
      !this.firstPersonModeActive
      || !this.canUseFirstPersonMode()
      || this.worldBuilder?.enabled
      || this.isRentIntroCutsceneActive()
      || this.hud.isQuickChatOpen()
      || this.hud.isAdminPromptOpen()
      || this.hud.isPhoneOpen()
      || this.hud.isStockMarketOpen()
      || this.hud.isBlackjackOpen()
      || this.hud.isSchoolMicrogameOpen()
      || this.hud.isVibeHeroOpen()
      || this.hud.isInteractionMenuOpen()
      || this.emoteMenuOpen
      || this.characterSelectorVisible
      || this.carSelectorVisible
      || this.shaderDebugMenuVisible
      || this.aimPoseDebugVisible
      || this.getLocalPlayerState()?.alive === false
    );
  }

  canCaptureFirstPersonMouse() {
    return Boolean(
      this.firstPersonModeActive
      && this.canUseFirstPersonMode()
      && this.player
      && !this.isFirstPersonMouseBlocked()
      && document.hasFocus?.() !== false
      && this.renderer?.domElement?.requestPointerLock
    );
  }

  syncFirstPersonLookFromPlayer() {
    const sourceDirection = this.currentAimDirection;
    if (sourceDirection?.lengthSq?.() > 0.000001) {
      this.firstPersonYaw = Math.atan2(sourceDirection.x, sourceDirection.z);
    } else {
      this.firstPersonYaw = this.player?.object?.rotation?.y ?? 0;
    }
    this.firstPersonYaw = normalizeAngleRadians(this.firstPersonYaw);
    this.firstPersonPitch = THREE.MathUtils.clamp(
      Number(this.firstPersonPitch) || 0,
      FIRST_PERSON_MIN_PITCH,
      FIRST_PERSON_MAX_PITCH
    );
  }

  getFirstPersonHorizontalDirection(target = this.firstPersonDirection) {
    target.set(Math.sin(this.firstPersonYaw), 0, Math.cos(this.firstPersonYaw));
    if (target.lengthSq() <= 0.000001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  }

  getFirstPersonLookDirection(target = this.firstPersonDirection) {
    const pitchCos = Math.cos(this.firstPersonPitch);
    target.set(
      Math.sin(this.firstPersonYaw) * pitchCos,
      Math.sin(this.firstPersonPitch),
      Math.cos(this.firstPersonYaw) * pitchCos
    );
    if (target.lengthSq() <= 0.000001) {
      target.set(0, 0, 1);
    }
    return target.normalize();
  }

  getFirstPersonMovementForward(target = this.firstPersonMovementForward) {
    return this.getFirstPersonHorizontalDirection(target).multiplyScalar(-1);
  }

  requestFirstPersonPointerLock() {
    if (!this.canCaptureFirstPersonMouse() || this.isFirstPersonPointerLockActive()) {
      return false;
    }

    try {
      const request = this.renderer.domElement.requestPointerLock();
      if (request?.catch) {
        request.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  releaseFirstPersonPointerLock() {
    if (!this.isFirstPersonPointerLockActive()) {
      return false;
    }

    try {
      document.exitPointerLock?.();
      return true;
    } catch {
      return false;
    }
  }

  handleFirstPersonCanvasPointerDown(event) {
    if (!this.firstPersonModeActive || this.isFirstPersonPointerLockActive()) {
      return;
    }

    if (!this.canCaptureFirstPersonMouse()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.input?.releaseAllInputs?.();
    this.requestFirstPersonPointerLock();
  }

  handleFirstPersonPointerLockChange() {
    const locked = this.isFirstPersonPointerLockActive();
    if (this.firstPersonPointerLocked === locked) {
      return;
    }

    this.firstPersonPointerLocked = locked;
    if (!locked) {
      this.input?.releaseAllInputs?.();
    }
    this.refreshFirstPersonModeHud();
  }

  handleFirstPersonMouseMove(event) {
    if (!this.firstPersonModeActive || !this.isFirstPersonPointerLockActive()) {
      return;
    }

    const movementX = Number(event.movementX) || 0;
    const movementY = Number(event.movementY) || 0;
    if (movementX === 0 && movementY === 0) {
      return;
    }

    this.firstPersonYaw = normalizeAngleRadians(
      this.firstPersonYaw - (movementX * FIRST_PERSON_MOUSE_SENSITIVITY)
    );
    this.firstPersonPitch = THREE.MathUtils.clamp(
      this.firstPersonPitch - (movementY * FIRST_PERSON_MOUSE_SENSITIVITY),
      FIRST_PERSON_MIN_PITCH,
      FIRST_PERSON_MAX_PITCH
    );
  }

  setFirstPersonPlayerHidden(hidden = this.firstPersonModeActive) {
    if (!this.player?.object || this.isRentIntroCutsceneActive()) {
      return;
    }

    this.player.object.visible = !hidden;
  }

  closeMenusForFirstPersonMode() {
    this.closeQuickChat();
    this.closePhoneMenu();
    this.closeInteractionMenu();
    this.closeStockMarket();
    this.closeBlackjack();
    this.closeVibeHero();
    this.closeSchoolMicrogame();
    this.setAdminPromptOpen(false);
    this.setCarSelectorVisible(false);
    this.setCharacterSelectorVisible(false);
    this.setShaderDebugMenuVisible(false);
    this.setAimPoseDebugVisible(false);
  }

  setFirstPersonModeActive(active, { announce = true, requestLock = true } = {}) {
    const nextActive = Boolean(active);
    if (nextActive && !this.canUseFirstPersonMode()) {
      this.hud.showToast('First person mode is admin only.');
      this.firstPersonModeActive = false;
      this.releaseFirstPersonPointerLock();
      this.setFirstPersonPlayerHidden(false);
      this.refreshFirstPersonModeHud();
      this.refreshFirstPersonCrosshairHud();
      return false;
    }

    if (nextActive === this.firstPersonModeActive) {
      if (nextActive && requestLock) {
        this.requestFirstPersonPointerLock();
      }
      this.refreshFirstPersonModeHud();
      return this.firstPersonModeActive;
    }

    this.firstPersonModeActive = nextActive;
    if (nextActive) {
      if (this.worldBuilder?.enabled) {
        void this.worldBuilder.setEnabled(false);
      }
      this.closeMenusForFirstPersonMode();
      this.syncFirstPersonLookFromPlayer();
      this.setFirstPersonPlayerHidden(true);
      if (requestLock) {
        this.requestFirstPersonPointerLock();
      }
    } else {
      this.releaseFirstPersonPointerLock();
      this.setFirstPersonPlayerHidden(false);
      this.firstPersonPitch = 0;
      if (this.player) {
        this.updateCamera(this.currentAimDirection, false, { snap: true });
      }
    }

    this.refreshFirstPersonModeHud();
    this.refreshFirstPersonCrosshairHud();
    if (announce) {
      this.hud.showToast(nextActive ? 'First person mode enabled.' : 'First person mode disabled.');
    }
    return this.firstPersonModeActive;
  }

  toggleFirstPersonMode() {
    return this.setFirstPersonModeActive(!this.firstPersonModeActive);
  }

  updateFirstPersonPointerLockAvailability() {
    if (!this.firstPersonModeActive) {
      return;
    }

    if (!this.canUseFirstPersonMode()) {
      this.setFirstPersonModeActive(false, { announce: false, requestLock: false });
      return;
    }

    if (this.isFirstPersonMouseBlocked()) {
      this.releaseFirstPersonPointerLock();
    }
    this.refreshFirstPersonModeHud();
  }

  refreshFirstPersonModeHud() {
    const available = this.canUseFirstPersonMode();
    const enabled = Boolean(this.firstPersonModeActive && available);
    const pointerLocked = this.isFirstPersonPointerLockActive();
    const signature = `${Number(available)}:${Number(enabled)}:${Number(pointerLocked)}`;
    if (signature === this.lastFirstPersonModeHudSignature) {
      return;
    }

    this.lastFirstPersonModeHudSignature = signature;
    this.hud.setFirstPersonModeState({
      available,
      enabled,
      pointerLocked
    });
  }

  refreshFirstPersonCrosshairHud(localPlayerState = this.getLocalPlayerState()) {
    const visible = Boolean(
      this.firstPersonModeActive
      && this.canUseFirstPersonMode()
      && this.currentAimMode
      && localPlayerState?.alive !== false
      && localPlayerState?.equippedWeaponId
      && !this.getSelectedHotbarDrinkItemId()
      && !this.getSelectedHotbarConsumableItemId()
    );
    if (visible === this.lastFirstPersonCrosshairVisible) {
      return;
    }

    this.lastFirstPersonCrosshairVisible = visible;
    this.hud.setFirstPersonCrosshairVisible(visible);
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

    if (!this.canUseFirstPersonMode()) {
      this.setFirstPersonModeActive(false, { announce: false, requestLock: false });
    }

    this.refreshAimPoseDebugHud();
    this.refreshShaderDebugHud();
    this.refreshFirstPersonModeHud();
    this.refreshFirstPersonCrosshairHud();
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

    while (this.pendingWorldPatchCursor < this.pendingWorldPatches.length) {
      const patch = this.pendingWorldPatches[this.pendingWorldPatchCursor];
      this.pendingWorldPatches[this.pendingWorldPatchCursor] = null;
      this.pendingWorldPatchCursor += 1;
      await this.handleWorldPatch(patch);
    }
    this.pendingWorldPatches.length = 0;
    this.pendingWorldPatchCursor = 0;
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

    if (this.pendingWorldPatchCursor >= this.pendingWorldPatches.length) {
      this.pendingWorldPatches.length = 0;
      this.pendingWorldPatchCursor = 0;
      this.worldPatchSyncRequested = false;
      return;
    }

    const nextPatch = this.pendingWorldPatches[this.pendingWorldPatchCursor];
    this.pendingWorldPatches[this.pendingWorldPatchCursor] = null;
    this.pendingWorldPatchCursor += 1;
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
        const hasMorePatches = this.pendingWorldPatchCursor < this.pendingWorldPatches.length;
        if (!hasMorePatches) {
          this.pendingWorldPatches.length = 0;
          this.pendingWorldPatchCursor = 0;
        }
        this.worldPatchSyncRequested = hasMorePatches;
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

  resetLocalPlayerKinematics(position = this.player?.position ?? null, now = performance.now()) {
    this.localPlayerVelocity.set(0, 0, 0);
    if (!position?.isVector3) {
      this.lastLocalPlayerSample = null;
      return;
    }

    if (!this.lastLocalPlayerSample) {
      this.lastLocalPlayerSample = {
        position: new THREE.Vector3(),
        timeMs: 0
      };
    }
    this.lastLocalPlayerSample.position.copy(position);
    this.lastLocalPlayerSample.timeMs = now;
  }

  updateLocalPlayerKinematics(now = performance.now()) {
    if (!this.player) {
      return;
    }

    if (!this.lastLocalPlayerSample) {
      this.resetLocalPlayerKinematics(this.player.position, now);
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
      const distanceSq = distanceSquared2D(
        origin?.x ?? 0,
        origin?.z ?? 0,
        anchorPosition.x ?? 0,
        anchorPosition.z ?? 0
      );
      if (distanceSq >= bestDistance) {
        continue;
      }

      bestCandidate = candidate;
      bestDistance = distanceSq;
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

      const triggerDistanceSq = getPortalTriggerDistanceSquared(this.player.position, portal);
      if (this.portalDisarmedPlacementIds.has(portal.placementId)) {
        const rearmRadius = (portal.triggerRadius ?? 0) + PORTAL_EXIT_REARM_PADDING;
        if (triggerDistanceSq > rearmRadius * rearmRadius) {
          this.portalDisarmedPlacementIds.delete(portal.placementId);
        }
        continue;
      }

      const triggerRadius = portal.triggerRadius ?? 0;
      if (triggerDistanceSq > triggerRadius * triggerRadius) {
        continue;
      }

      const redirectUrl = this.getPortalRedirectUrlForInteractable(portal);
      if (!redirectUrl) {
        continue;
      }

      if (triggerDistanceSq < nearestTriggerDistance) {
        nearestRedirectUrl = redirectUrl;
        nearestTriggerDistance = triggerDistanceSq;
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

      if (this.shouldRenderInteractableIndicatorLayer()) {
        this.renderInteractableIndicatorLayer();
      }
    } finally {
      this.camera.layers.set(WORLD_RENDER_LAYER);
    }
  }

  shouldRenderInteractableIndicatorLayer() {
    if (this.currentInterior?.scene || this.activeInlineShell?.scene) {
      return true;
    }

    const worldRenderer = this.worldBuilder?.worldRenderer;
    if (!worldRenderer) {
      return false;
    }

    return typeof worldRenderer.hasVisibleInteractableIndicators === 'function'
      ? worldRenderer.hasVisibleInteractableIndicators()
      : true;
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

    if (!inlineScenes.length) {
      worldRenderer.updateInteractableIndicatorVisibility();
      return;
    }

    const playerPosition = this.player?.position ?? null;
    worldRenderer.updateInteractableIndicatorVisibility((rendered, worldPosition) => {
      if (!rendered || !worldPosition) {
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

    for (let index = 0; index < worldBuilderInteractables.length; index += 1) {
      const interactable = worldBuilderInteractables[index];
      if (interactable.kind !== 'npc') {
        continue;
      }

      const npcDetails = this.getGymCheckInNpcDetails(interactable);
      if (
        isGymCheckInNpc(npcDetails)
        && npcDetails.alive !== false
        && npcDetails.mode !== 'hidden'
        && npcDetails.mode !== 'dead'
      ) {
        return true;
      }
    }

    return false;
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
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getGymCheckInPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
      return EMPTY_COLLIDERS;
    }

    const scene = this.getActiveInlineInteriorScene();
    if (scene?.id !== OFFICE_INTERIOR_ID) {
      return EMPTY_COLLIDERS;
    }

    return scene.getActiveOfficeColliders?.(this.player.position)
      ?? scene.getConditionalDoorColliders?.(this.player.position)
      ?? EMPTY_COLLIDERS;
  }

  getActiveColliders() {
    if (this.currentInterior?.scene) {
      return this.currentInterior.scene.getCollidersAt?.(this.player?.position)
        ?? this.currentInterior.scene.colliders
        ?? EMPTY_COLLIDERS;
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

    if (this.worldBuilderInteractablesFrame !== this.frameCounter) {
      this.worldBuilder.getInteractables(this.worldBuilderInteractables);
      this.worldBuilderInteractablesFrame = this.frameCounter;
    }

    return this.worldBuilderInteractables;
  }

  getActiveInteractables(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    const interactables = this.activeInteractables;
    if (this.activeInteractablesFrame === this.frameCounter) {
      return interactables;
    }

    interactables.length = 0;

    if (this.currentInterior?.scene) {
      appendList(interactables, this.currentInterior.scene.interactables);
      this.activeInteractablesFrame = this.frameCounter;
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

    this.activeInteractablesFrame = this.frameCounter;
    return interactables;
  }

  getNearestNpcInteractable(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (const interactable of worldBuilderInteractables) {
      if (interactable.kind !== 'npc' || !interactable.position) {
        continue;
      }

      const radius = Number(interactable.radius);
      if (!Number.isFinite(radius) || radius <= 0) {
        continue;
      }

      const distanceSq = distanceSquared2D(
        interactable.position.x,
        interactable.position.z,
        this.player.position.x,
        this.player.position.z
      );
      const radiusSq = radius * radius;
      if (distanceSq < radiusSq && distanceSq < nearestDistanceSq) {
        nearest = interactable;
        nearestDistanceSq = distanceSq;
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

  createTaskTrackerContext(localPlayerState = null, includeMissionList = true) {
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
    context.includeMissionList = includeMissionList;
    context.previousMissions = this.phoneMissionState.missions;
    context.activeInteractables = null;
    context.gymDoorBlockers = null;
    context.getActiveInteractables = localPlayerState
      ? this.taskTrackerGetActiveInteractables
      : null;
    context.getGymDoorBlockers = localPlayerState
      ? this.taskTrackerGetGymDoorBlockers
      : null;
    return context;
  }

  syncTaskHud(localPlayerState = null, options = null) {
    const includeMissionList = options?.includeMissionList ?? (this.phoneMenuVisible && this.phoneActiveAppId === 'missions');
    const completedTaskId = this.taskTracker.currentTaskId;
    const {
      task,
      missions,
      selectedMission,
      completedTask
    } = this.taskTracker.update(
      this.createTaskTrackerContext(localPlayerState, includeMissionList)
    );
    if (localPlayerState) {
      this.phoneMissionState = {
        missions,
        selectedMissionId: selectedMission?.id ?? ''
      };
      if (includeMissionList) {
        this.refreshPhoneMissionsHud();
      }
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
      const taskHudState = this.taskHudState;
      taskHudState.visible = task.visible;
      taskHudState.title = task.title;
      this.hud.setTaskState(taskHudState);
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
    for (const entry of skills) {
      if (entry.id === awardSkillId) {
        return entry;
      }
    }

    return getSkillDefinition(awardSkillId) ?? {
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

  getSkillLevelUpFeedbackKey({ skill = {}, newLevel = 1 } = {}) {
    const localPlayer = this.getLocalPlayerState?.();
    const sessionId = String(this.npcServiceState?.sessionId ?? 'local');
    const characterId = String(localPlayer?.characterId ?? this.desiredLocalCharacterId ?? '');
    const skillId = String(skill?.id ?? skill?.label ?? 'skill');
    const safeNewLevel = Math.max(1, Math.floor(Number(newLevel) || 1));
    return `${sessionId}:${characterId}:${skillId}:${safeNewLevel}`;
  }

  markSkillLevelUpFeedbackPresented({ skill = {}, newLevel = 1 } = {}) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cutoff = now - SKILL_LEVEL_UP_FEEDBACK_DEDUPE_MS;
    for (const key of this.recentSkillLevelUpFeedback.keys()) {
      const presentedAt = this.recentSkillLevelUpFeedback.get(key);
      if (Number(presentedAt) <= cutoff) {
        this.recentSkillLevelUpFeedback.delete(key);
      }
    }

    const key = this.getSkillLevelUpFeedbackKey({ skill, newLevel });
    if (this.recentSkillLevelUpFeedback.has(key)) {
      return false;
    }

    this.recentSkillLevelUpFeedback.set(key, now);
    return true;
  }

  showSkillLevelUpFeedback({
    skill = {},
    oldLevel = 1,
    newLevel = 1,
    dedupe = true
  } = {}) {
    if (dedupe && !this.markSkillLevelUpFeedbackPresented({ skill, newLevel })) {
      return false;
    }

    this.hud.showSkillLevelUp({
      skill,
      oldLevel,
      newLevel
    });
    this.playSkillLevelUpSound();
    return true;
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
    const leveledUp = award.newLevel > award.oldLevel;
    if (leveledUp && !this.markSkillLevelUpFeedbackPresented({
      skill,
      newLevel: award.newLevel
    })) {
      return;
    }

    this.spawnSkillXpFloater({
      skill,
      xpGained
    });
    if (!leveledUp && xpGained > 0 && this.shouldPlaySkillXpGainSound(award, skill)) {
      this.playSoundEffect(this.skillXpGainSound);
    }

    if (leveledUp) {
      this.showSkillLevelUpFeedback({
        skill,
        oldLevel: award.oldLevel,
        newLevel: award.newLevel,
        dedupe: false
      });
    }
  }

  presentSkillAwardsFromResult(result = null) {
    const awards = Array.isArray(result?.skillAwards) && result.skillAwards.length > 0
      ? result.skillAwards
      : (result?.skillAward ? [result.skillAward] : []);
    let presented = false;

    for (const award of awards) {
      if (!award?.seq || award.seq <= this.lastSkillAwardSeq) {
        continue;
      }

      this.lastSkillAwardSeq = award.seq;
      const skill = getSkillDefinition(award.skillId) ?? {
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

    const strengthXp = Math.max(0, Math.floor(Number(localPlayerState.strengthXp ?? 0) || 0));
    const agilityXp = Math.max(0, Math.floor(Number(localPlayerState.agilityXp ?? 0) || 0));
    const intelligenceXp = Math.max(0, Math.floor(Number(localPlayerState.intelligenceXp ?? 0) || 0));
    const charismaXp = Math.max(0, Math.floor(Number(localPlayerState.charismaXp ?? 0) || 0));
    const awardSeq = Math.max(0, Math.floor(Number(localPlayerState.skillAwardSeq ?? 0) || 0));
    const awardSkillId = String(localPlayerState.skillAwardSkillId ?? '');
    const awardXpGained = Math.max(0, Math.floor(Number(localPlayerState.skillAwardXpGained ?? 0) || 0));
    const awardOldLevel = Math.max(1, Math.floor(Number(localPlayerState.skillAwardOldLevel ?? 1) || 1));
    const awardNewLevel = Math.max(1, Math.floor(Number(localPlayerState.skillAwardNewLevel ?? 1) || 1));

    if (
      this.skillLevelSnapshot.size > 0
      && this.lastSkillProgressStrengthXp === strengthXp
      && this.lastSkillProgressAgilityXp === agilityXp
      && this.lastSkillProgressIntelligenceXp === intelligenceXp
      && this.lastSkillProgressCharismaXp === charismaXp
      && this.lastSkillProgressAwardSeq === awardSeq
      && this.lastSkillProgressAwardSkillId === awardSkillId
      && this.lastSkillProgressAwardXpGained === awardXpGained
      && this.lastSkillProgressAwardOldLevel === awardOldLevel
      && this.lastSkillProgressAwardNewLevel === awardNewLevel
    ) {
      return;
    }
    this.lastSkillProgressStrengthXp = strengthXp;
    this.lastSkillProgressAgilityXp = agilityXp;
    this.lastSkillProgressIntelligenceXp = intelligenceXp;
    this.lastSkillProgressCharismaXp = charismaXp;
    this.lastSkillProgressAwardSeq = awardSeq;
    this.lastSkillProgressAwardSkillId = awardSkillId;
    this.lastSkillProgressAwardXpGained = awardXpGained;
    this.lastSkillProgressAwardOldLevel = awardOldLevel;
    this.lastSkillProgressAwardNewLevel = awardNewLevel;

    const skills = getPlayerSkillsSnapshot(localPlayerState);
    const hadSnapshot = this.skillLevelSnapshot.size > 0;
    const award = awardSeq > this.lastSkillAwardSeq && awardSkillId
      ? {
          seq: awardSeq,
          skillId: awardSkillId,
          xpGained: awardXpGained,
          oldLevel: awardOldLevel,
          newLevel: awardNewLevel,
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

    this.refreshPhoneSkillsHud(localPlayerState, { skills });
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
      && distanceSquared2D(this.player.position.x, this.player.position.z, giver.position.x, giver.position.z) < radius * radius
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

  createDeliveryQuestPromptInteractable(interaction = null, interactable = null) {
    if (!interaction?.action || !interactable || interactable.kind !== 'npc') {
      return null;
    }

    const npcId = String(interaction.npcId || interactable.npcId || interactable.placementId || '').trim();
    if (!npcId) {
      return null;
    }

    const npcState = this.npcServiceState.npcs.get(npcId);
    const completingDelivery = interaction.kind === 'completeDelivery';
    return {
      ...interactable,
      kind: completingDelivery ? 'delivery-complete' : 'delivery-quest',
      npcId,
      npc: {
        ...(interactable.npc ?? {}),
        ...(npcState ?? {})
      },
      label: interaction.label || npcState?.name || interactable.npc?.name || '',
      prompt: completingDelivery ? 'Deliver package' : 'Accept delivery job',
      actionText: completingDelivery ? 'Package delivered.' : 'Delivery job accepted.',
      deliveryKind: interaction.kind
    };
  }

  async handleDeliveryQuestInteraction(interaction = null) {
    if (!interaction?.action || this.deliveryQuestRequestInFlight) {
      return;
    }

    this.startInteractionCameraFocus(interaction, {
      kind: 'delivery-quest',
      persistent: false
    });
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
      this.clearInteractionCameraFocus('delivery-quest', { afterMinimum: true });
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
      distanceSq: distanceSquared2D(this.player.position.x, this.player.position.z, x, z)
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
    if (!proximity || proximity.distanceSq > proximity.radius * proximity.radius) {
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

    this.startInteractionCameraFocus(interaction, {
      kind: 'gym-check-in',
      persistent: false
    });
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
      this.clearInteractionCameraFocus('gym-check-in', { afterMinimum: true });
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
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getStockMarketPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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

    const symbol = this.getListedStockSymbol(market?.stocks, this.stockMarketSelectedSymbol);
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
      this.stockMarketSelectedSymbol = this.getListedStockSymbol(result.market.stocks, symbol);
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
    this.startInteractionCameraFocus(interaction, { kind: 'stock-market' });
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
    this.clearInteractionCameraFocus('stock-market');
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
      const listedSymbol = this.getListedStockSymbol(result.market.stocks, this.stockMarketSelectedSymbol);
      if (!this.stockMarketSelectedSymbol || listedSymbol !== this.stockMarketSelectedSymbol) {
        this.stockMarketSelectedSymbol = listedSymbol;
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

    const symbol = this.getListedStockSymbol(this.stockMarketSnapshot?.stocks, this.stockMarketSelectedSymbol);
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
      this.stockMarketSelectedSymbol = this.getListedStockSymbol(result.market.stocks, symbol);
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

  getBartenderNpcPosition(interactable = null, npcDetails = null, target = this.npcVendorPositionScratch) {
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

    target.set(x, 0, z);
    target.y = this.getActiveGroundHeightAt(target);
    return target;
  }

  getNearestBartenderInteractable(options = null) {
    const npcId = options?.npcId ?? '';
    const worldBuilderInteractables = options?.worldBuilderInteractables ?? this.getWorldBuilderInteractables();
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getBartenderPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
    }

    return nearest;
  }

  getBartenderMenuAnchor(interaction = null) {
    const npcId = String(interaction?.npcId || interaction?.placementId || '').trim();
    const speechAnchor = npcId
      ? this.worldBuilder?.getNpcSpeechAnchor?.(npcId) ?? this.worldBuilder?.getNpcSpeechAnchors?.()?.get(npcId)
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
    menu.interaction = activeInteraction;
    this.refreshInteractionCameraFocus(activeInteraction, { kind: 'bartender' });
    this.hud.setInteractionMenuAnchor(menu.anchor);
  }

  closeInteractionMenu() {
    this.clearInteractionCameraFocus(this.activeInteractionMenu?.kind ?? '');
    this.activeInteractionMenu = null;
    this.carDealerPreviewSyncRequestId += 1;
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
    } else if (action.startsWith('vehicleSelect:')) {
      void this.selectPlayerVehicle(action.slice('vehicleSelect:'.length))
        .then(() => this.renderCarDealerMenu());
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
    const actions = [];
    const priceParts = [];
    const inventoryParts = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const count = getPlayerDrinkCount(localPlayerState, item.id);
      const shortAmount = Math.max(0, item.price - cash);
      actions.push({
        id: `bartender:${item.id}`,
        label: `Buy ${item.label} - ${formatMoneyAmount(item.price)} (${count})`,
        title: `Buy ${item.label}`,
        meta: `${formatMoneyAmount(item.price)} - Inventory: ${count}`,
        state: cash < item.price ? `${formatMoneyAmount(shortAmount)} short` : 'Ready to buy',
        iconId: item.id,
        primary: item.id === 'beer',
        disabled: this.bartenderRequestInFlight || cash < item.price
      });
      priceParts.push(`${item.label} ${formatMoneyAmount(item.price)}`);
      inventoryParts.push(`${item.label}: ${count}`);
    }

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.bartenderRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Bartender',
      subtitle: `${priceParts.join('. ')}. Cash ${formatMoneyAmount(cash)}. Inventory ${inventoryParts.join(', ')}.`,
      actions,
      anchor: menu.anchor,
      variant: 'bartender'
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
      anchor: this.getBartenderMenuAnchor(interaction),
      interaction
    };
    this.startInteractionCameraFocus(interaction, { kind: 'bartender' });
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

  getPawnShopOwnerNpcPosition(interactable = null, npcDetails = null, target = this.npcVendorPositionScratch) {
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

    target.set(x, 0, z);
    target.y = this.getActiveGroundHeightAt(target);
    return target;
  }

  getNearestPawnShopOwnerInteractable(options = null) {
    const npcId = options?.npcId ?? '';
    const worldBuilderInteractables = options?.worldBuilderInteractables ?? this.getWorldBuilderInteractables();
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getPawnShopPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
    menu.interaction = activeInteraction;
    this.refreshInteractionCameraFocus(activeInteraction, { kind: 'pawn-shop' });
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
    const actions = [];
    const priceParts = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const owned = item.kind === 'permanent' && isPlayerPawnShopItemOwned(localPlayerState, item.id);
      const count = item.kind === 'consumable'
        ? ` (${getPlayerPawnShopItemCount(localPlayerState, item.id)})`
        : '';
      const inventoryCount = item.kind === 'consumable'
        ? getPlayerPawnShopItemCount(localPlayerState, item.id)
        : 0;
      const shortAmount = Math.max(0, item.price - cash);
      actions.push({
        id: `pawnShop:${item.id}`,
        label: owned ? `${item.label} - Owned` : `Buy ${item.label} - ${formatMoneyAmount(item.price)}${count}`,
        title: owned ? item.label : `Buy ${item.label}`,
        meta: item.kind === 'consumable'
          ? `${formatMoneyAmount(item.price)} - Inventory: ${inventoryCount}`
          : `${formatMoneyAmount(item.price)} - ${item.kind === 'weapon' ? 'Weapon' : 'Permanent'}`,
        state: owned ? 'Owned' : (cash < item.price ? `${formatMoneyAmount(shortAmount)} short` : 'Ready to buy'),
        iconId: item.id,
        primary: item.id === 'cigarettes',
        disabled: this.pawnShopRequestInFlight || owned || cash < item.price
      });
      priceParts.push(`${item.label} ${formatMoneyAmount(item.price)}`);
    }

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.pawnShopRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Pawn Shop',
      subtitle: `${priceParts.join('. ')}. Cash ${formatMoneyAmount(cash)}. Cigarettes: ${getPlayerPawnShopItemCount(localPlayerState, 'cigarettes')}.`,
      actions,
      anchor: menu.anchor,
      variant: 'pawn-shop'
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
      anchor: this.getBartenderMenuAnchor(interaction),
      interaction
    };
    this.startInteractionCameraFocus(interaction, { kind: 'pawn-shop' });
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

  getNearestCarDealerInteractable(options = null) {
    const npcId = options?.npcId ?? '';
    const worldBuilderInteractables = options?.worldBuilderInteractables ?? this.getWorldBuilderInteractables();
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getCarDealerPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
    menu.interaction = activeInteraction;
    this.refreshInteractionCameraFocus(activeInteraction, { kind: 'car-dealer' });
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
    const actions = [];
    const priceParts = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const owned = playerOwnsVehicleItem(localPlayerState, item.id);
      const selected = currentVehicleItemId === item.id;
      const state = owned
        ? (selected ? 'Selected' : 'Owned')
        : cash < item.price
          ? `${formatMoneyAmount(item.price - cash)} short`
          : 'Available now';
      actions.push({
        id: owned ? `vehicleSelect:${item.id}` : `carDealer:${item.id}`,
        label: owned ? `${selected ? 'Selected' : 'Select'} ${item.label}` : `Buy ${item.label} - ${formatMoneyAmount(item.price)}`,
        title: owned ? `${selected ? 'Selected' : 'Select'} ${item.label}` : `Buy ${item.label}`,
        meta: `${formatMoneyAmount(item.price)} - ${item.label}`,
        state,
        previewItemId: item.id,
        primary: item.id === 'car_fiat_duna',
        disabled: this.carDealerRequestInFlight || this.carSelectorRequestInFlight || selected || (!owned && cash < item.price)
      });
      priceParts.push(`${item.label} ${formatMoneyAmount(item.price)}`);
    }

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.carDealerRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Car Dealer',
      subtitle: `${priceParts.join('. ')}. Cash ${formatMoneyAmount(cash)}. Current car: ${currentVehicle?.label ?? 'None'}.`,
      actions,
      anchor: menu.anchor,
      variant: 'car-dealer'
    });
    void this.syncCarDealerVehiclePreviews(items);
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
      anchor: this.getBartenderMenuAnchor(interaction),
      interaction
    };
    this.startInteractionCameraFocus(interaction, { kind: 'car-dealer' });
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
      this.applyVehicleInventorySnapshot(result.inventory);
      this.refreshPhoneWalletHud();
      this.playSoundEffect(this.rentChaChingSound);
      this.syncPlayerBoundItemsHud();
      this.refreshCarSelectorHud();
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

  getMarthaNpcPosition(interactable = null, npcDetails = null, target = this.npcVendorPositionScratch) {
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

    target.set(x, 0, z);
    target.y = this.getActiveGroundHeightAt(target);
    return target;
  }

  getNearestMarthaInteractable(options = null) {
    const npcId = options?.npcId ?? '';
    const worldBuilderInteractables = options?.worldBuilderInteractables ?? this.getWorldBuilderInteractables();
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    const targetNpcId = String(npcId ?? '').trim();
    let nearest = null;
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getMarthaPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
    menu.interaction = activeInteraction;
    this.refreshInteractionCameraFocus(activeInteraction, { kind: 'martha' });
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
    const actions = [];
    const priceParts = [];
    const inventoryParts = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const count = getPlayerMarthaItemCount(localPlayerState, item.id);
      const shortAmount = Math.max(0, item.price - cash);
      actions.push({
        id: `martha:${item.id}`,
        label: `Buy ${item.label} - ${formatMoneyAmount(item.price)} (${count})`,
        title: `Buy ${item.label}`,
        meta: `${formatMoneyAmount(item.price)} - Inventory: ${count}`,
        state: cash < item.price ? `${formatMoneyAmount(shortAmount)} short` : `Restores ${item.restorePercent}% health`,
        iconId: item.id,
        primary: item.id === 'burger',
        disabled: this.marthaRequestInFlight || cash < item.price
      });
      priceParts.push(`${item.label} ${formatMoneyAmount(item.price)}`);
      inventoryParts.push(`${item.label}: ${count}`);
    }

    actions.push({
      id: 'close',
      label: 'Maybe later',
      disabled: this.marthaRequestInFlight
    });

    this.hud.showInteractionMenu({
      title: menu.npcName || 'Martha',
      subtitle: `${priceParts.join('. ')}. Cash ${formatMoneyAmount(cash)}. Inventory ${inventoryParts.join(', ')}.`,
      actions,
      anchor: menu.anchor,
      variant: 'martha'
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
      anchor: this.getBartenderMenuAnchor(interaction),
      interaction
    };
    this.startInteractionCameraFocus(interaction, { kind: 'martha' });
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

      const emoteId = item.id === PAWN_SHOP_ITEM_IDS.cigarettes
        ? SMOKING_EMOTE_ID
        : DRINKING_EMOTE_ID;
      this.player?.playEmote(emoteId);
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
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getBlackjackPromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
    let nearestDistanceSq = Infinity;

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

      const distanceSq = distanceSquared2D(position.x, position.z, this.player.position.x, this.player.position.z);
      const promptRadius = getSchoolMicrogamePromptRadius(npcDetails, interactable.radius);
      const promptRadiusSq = promptRadius * promptRadius;
      if (distanceSq > promptRadiusSq || distanceSq >= nearestDistanceSq) {
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
      nearestDistanceSq = distanceSq;
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
    if (
      normalizedId === 'vibe-hero-editor'
      || normalizedId === 'vibeheroeditor'
      || normalizedId === 'vibe-hero-chart-editor'
    ) {
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
    this.startInteractionCameraFocus(interaction, { kind: 'blackjack' });
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
    this.clearInteractionCameraFocus('blackjack');
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

    const normalized = [];
    for (let index = 0; index < chart.length; index += 1) {
      const note = this.normalizeVibeHeroEditorChartNote(chart[index], index);
      if (note) {
        normalized.push(note);
      }
    }
    normalized.sort((left, right) => left.timeMs - right.timeMs);
    for (let index = 0; index < normalized.length; index += 1) {
      if (!normalized[index].id) {
        normalized[index].id = `editor-note-${index + 1}`;
      }
    }
    return normalized;
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
    if (!song?.id) {
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
    const normalized = this.normalizeVibeHeroEditorChart(chart);
    const serialized = [];
    for (const note of normalized) {
      serialized.push({
        id: note.id,
        timeMs: note.timeMs,
        durationMs: note.durationMs,
        lane: note.lane,
        pitch: note.pitch,
        frequency: note.frequency
      });
    }
    return serialized;
  }

  getVibeHeroStoredEditorChartsSnapshot() {
    const storedCharts = [];
    for (const song of listVibeHeroSongs()) {
      const chart = this.loadVibeHeroStoredEditorChart(song);
      if (!chart?.length) {
        continue;
      }
      storedCharts.push({
        songId: song.id,
        title: song.title,
        noteCount: chart.length,
        chart: this.serializeVibeHeroEditorChart(chart)
      });
    }
    return storedCharts;
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
    const editing = Boolean(editorMode && this.isLocalAdmin());
    const sourceChart = this.normalizeVibeHeroEditorChart(baseSong?.chart ?? []);
    const storedChart = editing ? this.loadVibeHeroStoredEditorChart(baseSong) : null;
    const activeChart = storedChart ?? sourceChart;
    const song = baseSong
      ? {
          ...baseSong,
          chart: cloneVibeHeroChart(activeChart),
          audioUrl: this.getVibeHeroSongAudioUrl(baseSong)
        }
      : null;
    const songs = [];
    for (const entry of listVibeHeroSongs()) {
      const storedEntryChart = editing ? this.loadVibeHeroStoredEditorChart(entry) : null;
      songs.push({
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
        chartEdited: Boolean(storedEntryChart) || entry.chartEdited === true,
        audioUrl: this.getVibeHeroSongAudioUrl(entry)
      });
    }
    const notes = [];
    const noteSource = song?.chart ?? [];
    for (let index = 0; index < noteSource.length; index += 1) {
      notes.push(this.createVibeHeroNoteState(noteSource[index], index));
    }

    return {
      id: `vibe_hero_${++this.vibeHeroSequence}`,
      gameId: VIBE_HERO_GAME_ID,
      laneCount: VIBE_HERO_LANE_COUNT,
      phase: editing ? 'editor-select' : 'select',
      editorMode: editing,
      selectedSongId: song?.id ?? VIBE_HERO_DEFAULT_SONG_ID,
      song,
      songs,
      sourceChart: cloneVibeHeroChart(sourceChart),
      editorChart: cloneVibeHeroChart(activeChart),
      notes,
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
      editorLaneLastRecordMs: createVibeHeroLaneLastRecordMs(),
      editorLaneHeld: createVibeHeroLaneHeldState(),
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
    this.startInteractionCameraFocus(interaction, { kind: 'vibe-hero' });
    this.stopVibeHeroAudio();
    this.vibeHero = this.createVibeHeroState(this.vibeHeroSelectedSongId, { editorMode: editing });
    if (editing) {
      this.pauseVibeRadioForVibeHero();
    }
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
    this.clearInteractionCameraFocus('vibe-hero');
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
    this.resumeVibeRadioAfterVibeHero();
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
    this.pauseVibeRadioForVibeHero();
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
    this.pauseVibeRadioForVibeHero();
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
    const pendingNotes = this.updateVibeHeroMisses(game);
    if (!pendingNotes && game.currentTimeMs >= Math.max(0, game.durationMs - VIBE_HERO_POST_SONG_MS)) {
      this.finishVibeHero();
      return;
    }
    if (game.currentTimeMs >= game.durationMs + VIBE_HERO_POST_SONG_MS) {
      this.finishVibeHero();
      return;
    }

    if (Number(deltaSeconds) >= 0) {
      this.pruneVibeHeroLaneFlashes(game, now);
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
    this.pauseVibeRadioForVibeHero();
    const now = performance.now();
    this.vibeHero.phase = 'editor';
    this.vibeHero.editorPaused = false;
    this.vibeHero.editorRecording = false;
    this.vibeHero.editorPlaybackBaseMs = 0;
    this.vibeHero.editorPlaybackStartedAt = now;
    this.vibeHero.editorLastOverwriteMs = 0;
    this.vibeHero.editorLaneLastRecordMs = createVibeHeroLaneLastRecordMs();
    this.vibeHero.editorLaneHeld = createVibeHeroLaneHeldState();
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
      this.pruneVibeHeroLaneFlashes(game, now);
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
      game.editorLaneLastRecordMs = createVibeHeroLaneLastRecordMs();
      game.editorLaneHeld = createVibeHeroLaneHeldState();
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
    game.editorLaneLastRecordMs = createVibeHeroLaneLastRecordMs();
    game.editorLaneHeld = createVibeHeroLaneHeldState();
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
    game.editorLaneLastRecordMs = createVibeHeroLaneLastRecordMs();
    game.editorLaneHeld = createVibeHeroLaneHeldState();
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
    for (let laneIndex = 0; laneIndex < VIBE_HERO_LANE_KEY_CODES.length; laneIndex += 1) {
      const codes = VIBE_HERO_LANE_KEY_CODES[laneIndex];
      let pressed = false;
      for (const code of codes) {
        if (this.input.isPressed(code)) {
          pressed = true;
          break;
        }
      }
      if (pressed) {
        lanes.push(laneIndex);
      }
    }
    return lanes;
  }

  overwriteVibeHeroEditorRange(game = this.vibeHero, fromMs = 0, toMs = 0) {
    if (!game?.editorMode) {
      return false;
    }

    const startMs = Math.max(0, Math.min(Number(fromMs) || 0, Number(toMs) || 0));
    const endMs = Math.max(startMs, Math.max(Number(fromMs) || 0, Number(toMs) || 0));
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const nextChart = [];
    for (const note of chart) {
      if (!(note.timeMs > startMs && note.timeMs <= endMs)) {
        nextChart.push(note);
      }
    }
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
    let activeLaneMask = 0;
    for (const lane of activeLanes) {
      activeLaneMask |= 1 << lane;
    }
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const retainedChart = [];
    for (const note of chart) {
      if (!(note.timeMs > startMs && note.timeMs <= endMs)) {
        retainedChart.push(note);
      }
    }
    const lastRecordMs = cloneVibeHeroLaneLastRecordMs(game.editorLaneLastRecordMs);
    const laneHeld = cloneVibeHeroLaneHeldState(game.editorLaneHeld);
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
      if ((activeLaneMask & (1 << lane)) === 0) {
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

    let laneText = '';
    for (const lane of activeLanes) {
      laneText += laneText ? ` ${lane + 1}` : String(lane + 1);
    }
    const recordedKeys = new Set();
    for (const note of recordedNotes) {
      recordedKeys.add(`${note.lane}:${note.timeMs}`);
    }
    const mergedChart = [];
    if (recordedKeys.size > 0) {
      for (const note of retainedChart) {
        if (!recordedKeys.has(`${note.lane}:${note.timeMs}`)) {
          mergedChart.push(note);
        }
      }
    } else {
      for (let index = 0; index < retainedChart.length; index += 1) {
        mergedChart.push(retainedChart[index]);
      }
    }
    const nextChart = mergedChart;
    for (const note of recordedNotes) {
      nextChart.push(note);
    }
    this.setVibeHeroEditorChart(game, nextChart, {
      save: false,
      message: recordedNotes.length > 0
        ? `Recording ${laneText} at ${formatVibeHeroTimestamp(endMs)}.`
        : game.message
    });

    if (activeLanes.length > 0) {
      const now = performance.now();
      this.pushVibeHeroLaneFlashes(game, activeLanes, 'hit', now);
    }
    return true;
  }

  setVibeHeroEditorChart(game = this.vibeHero, chart = [], { save = false, message = '' } = {}) {
    if (!game?.editorMode) {
      return false;
    }

    const normalizedChart = this.serializeVibeHeroEditorChart(chart);
    const editorChart = [];
    const notes = [];
    const songChart = [];
    for (let index = 0; index < normalizedChart.length; index += 1) {
      const note = normalizedChart[index];
      editorChart.push(copyOwnEnumerableProperties(note));
      notes.push(this.createVibeHeroNoteState(note, index));
      songChart.push(copyOwnEnumerableProperties(note));
    }
    game.editorChart = editorChart;
    game.notes = notes;
    if (game.song) {
      const nextSong = copyOwnEnumerableProperties(game.song);
      nextSong.chart = songChart;
      game.song = nextSong;
    }
    const songs = [];
    for (const song of game.songs ?? []) {
      if (song.id === game.selectedSongId) {
        const nextSong = copyOwnEnumerableProperties(song);
        nextSong.noteCount = normalizedChart.length;
        nextSong.chartEdited = true;
        songs.push(nextSong);
      } else {
        songs.push(song);
      }
    }
    game.songs = songs;
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
    this.pushVibeHeroLaneFlashes(game, [lane], game.editorRecording ? 'hit' : 'empty', now);
    this.playVibeHeroFeedbackTone(frequency, game.editorRecording ? 'great' : 'good');
    this.syncVibeHeroHud();
    return true;
  }

  pruneVibeHeroLaneFlashes(game = this.vibeHero, now = performance.now()) {
    if (!game) {
      return [];
    }

    const laneFlashes = Array.isArray(game.laneFlashes) ? game.laneFlashes : [];
    let writeIndex = 0;
    for (let index = 0; index < laneFlashes.length; index += 1) {
      const flash = laneFlashes[index];
      if (!flash || now - (Number(flash.at) || 0) >= VIBE_HERO_LANE_FLASH_MS) {
        continue;
      }
      laneFlashes[writeIndex] = flash;
      writeIndex += 1;
    }
    laneFlashes.length = writeIndex;
    game.laneFlashes = laneFlashes;
    return laneFlashes;
  }

  pushVibeHeroLaneFlashes(game = this.vibeHero, lanes = [], quality = 'hit', now = performance.now()) {
    const laneFlashes = this.pruneVibeHeroLaneFlashes(game, now);
    for (const laneIndex of lanes ?? []) {
      const lane = Math.trunc(Number(laneIndex));
      if (!Number.isInteger(lane) || lane < 0 || lane >= VIBE_HERO_LANE_COUNT) {
        continue;
      }
      laneFlashes.push({
        lane,
        at: now,
        quality
      });
    }
    return laneFlashes;
  }

  recordVibeHeroEditorLanes(laneIndexes = []) {
    const game = this.vibeHero;
    if (!game || game.phase !== 'editor') {
      return false;
    }

    const lanes = [];
    let laneMask = 0;
    for (const laneIndex of laneIndexes ?? []) {
      const lane = Math.trunc(Number(laneIndex));
      if (!Number.isInteger(lane) || lane < 0 || lane >= VIBE_HERO_LANE_COUNT) {
        continue;
      }
      const laneBit = 1 << lane;
      if ((laneMask & laneBit) !== 0) {
        continue;
      }
      laneMask |= laneBit;
      lanes.push(lane);
    }
    if (lanes.length <= 0) {
      return false;
    }

    if (!game.editorRecording) {
      for (const laneIndex of lanes) {
        this.previewVibeHeroEditorLane(laneIndex);
      }
      game.message = 'Recording is off.';
      return true;
    }

    this.updateVibeHeroEditorTime(game);
    const currentTimeMs = Math.round(Number(game.currentTimeMs ?? 0) || 0);
    const windowMs = Math.max(20, Number(game.editorRecordWindowMs ?? VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS) || VIBE_HERO_EDITOR_OVERWRITE_WINDOW_MS);
    const chart = this.serializeVibeHeroEditorChart(game.editorChart ?? game.notes ?? []);
    const retainedChart = [];
    for (const note of chart) {
      if (Math.abs(note.timeMs - currentTimeMs) > windowMs) {
        retainedChart.push(note);
      }
    }
    const recordedNotes = [];
    for (let index = 0; index < lanes.length; index += 1) {
      recordedNotes.push(this.createVibeHeroEditorRecordedNote(lanes[index], currentTimeMs, index));
    }
    const nextChart = retainedChart;
    for (const note of recordedNotes) {
      nextChart.push(note);
    }
    this.setVibeHeroEditorChart(game, nextChart, {
      save: true,
      message: `${recordedNotes.length} note${recordedNotes.length === 1 ? '' : 's'} recorded at ${formatVibeHeroTimestamp(currentTimeMs)}.`
    });
    game.editorLastOverwriteMs = currentTimeMs;
    const lastRecordMs = cloneVibeHeroLaneLastRecordMs(game.editorLaneLastRecordMs);
    for (const lane of lanes) {
      lastRecordMs[lane] = currentTimeMs;
    }
    game.editorLaneLastRecordMs = lastRecordMs;
    const now = performance.now();
    this.pushVibeHeroLaneFlashes(game, lanes, 'hit', now);
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
    for (let laneIndex = 0; laneIndex < VIBE_HERO_LANE_KEY_CODES.length; laneIndex += 1) {
      const codes = VIBE_HERO_LANE_KEY_CODES[laneIndex];
      let laneConsumed = false;
      for (let codeIndex = 0; codeIndex < codes.length; codeIndex += 1) {
        if (this.input.consume(codes[codeIndex])) {
          laneConsumed = true;
          break;
        }
      }

      if (laneConsumed) {
        if (this.vibeHero.phase === 'editor') {
          editorLaneIndexes.push(laneIndex);
        } else {
          handled = this.hitVibeHeroLane(laneIndex) || handled;
        }
      }
    }
    if (editorLaneIndexes.length > 0) {
      if (this.vibeHero.phase === 'editor' && this.vibeHero.editorRecording && !this.vibeHero.editorPaused) {
        for (let index = 0; index < editorLaneIndexes.length; index += 1) {
          this.previewVibeHeroEditorLane(editorLaneIndexes[index]);
        }
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
      return false;
    }

    let missed = 0;
    let hasPendingNotes = false;
    for (const note of game.notes) {
      if (note.status !== 'pending') {
        continue;
      }
      if (game.currentTimeMs - note.timeMs <= VIBE_HERO_HIT_WINDOW_MS) {
        hasPendingNotes = true;
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

    return hasPendingNotes;
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

    let matchNote = null;
    let matchErrorMs = Number.POSITIVE_INFINITY;
    for (const note of game.notes) {
      if (note.status !== 'pending' || note.lane !== normalizedLane) {
        continue;
      }
      const errorMs = Math.abs(game.currentTimeMs - note.timeMs);
      if (errorMs > VIBE_HERO_HIT_WINDOW_MS || errorMs >= matchErrorMs) {
        continue;
      }
      matchNote = note;
      matchErrorMs = errorMs;
    }
    const now = performance.now();

    this.pushVibeHeroLaneFlashes(game, [normalizedLane], matchNote ? 'hit' : 'empty', now);

    if (!matchNote) {
      game.message = 'Too early';
      this.syncVibeHeroHud();
      return false;
    }

    const note = matchNote;
    const errorMs = matchErrorMs;
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
        const skill = getSkillDefinition(award.skillId) ?? {
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
    this.resumeVibeRadioAfterVibeHero();
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
    for (let index = 0; index < song.chart.length; index += 1) {
      const note = song.chart[index];
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
    if (games.length > 1 && previous) {
      let choiceCount = 0;
      for (const game of games) {
        if (game.id !== previous) {
          choiceCount += 1;
        }
      }
      if (choiceCount > 0) {
        let choiceIndex = Math.floor(this.schoolRandom() * choiceCount);
        for (const game of games) {
          if (game.id === previous) {
            continue;
          }
          if (choiceIndex <= 0) {
            return game.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
          }
          choiceIndex -= 1;
        }
      }
    }

    const index = Math.floor(this.schoolRandom() * games.length);
    return games[index]?.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
  }

  isOfficeJobComputerInteractable(interactable = null) {
    return String(interactable?.itemId ?? '').trim() === OFFICE_JOB_TERMINAL_ITEM_ID;
  }

  isOpenableGarageInteractable(interactable = null) {
    return interactable?.garageDoor?.type === 'police-station-garage'
      || String(interactable?.itemId ?? '').trim() === POLICE_STATION_BUILDING_ITEM_ID;
  }

  getGarageDoorClosedNodeNames(interactable = null) {
    const nodeNames = interactable?.garageDoor?.closedNodeNames;
    return Array.isArray(nodeNames) && nodeNames.length
      ? nodeNames
      : POLICE_STATION_GARAGE_DOOR_NODE_NAMES;
  }

  isPoliceGarageOpen(placementId = '') {
    return this.openPoliceGaragePlacementIds.has(String(placementId ?? ''));
  }

  syncOpenPoliceGarageDoors() {
    if (!this.worldBuilder?.setPlacementHiddenNodeNames || !this.openPoliceGaragePlacementIds.size) {
      return;
    }

    for (const placementId of this.openPoliceGaragePlacementIds) {
      const placement = this.worldBuilder.worldState?.getPlacement?.(placementId);
      if (!placement || placement.itemId !== POLICE_STATION_BUILDING_ITEM_ID) {
        this.openPoliceGaragePlacementIds.delete(placementId);
        continue;
      }
      this.worldBuilder.setPlacementHiddenNodeNames(placementId, POLICE_STATION_GARAGE_DOOR_NODE_NAMES);
    }
  }

  getPoliceGaragePromptInteractable(interactable = null) {
    if (!interactable) {
      return null;
    }

    const open = this.isPoliceGarageOpen(interactable.placementId);
    return {
      ...interactable,
      prompt: open ? 'Close police garage' : 'Open police garage',
      actionText: open ? 'Police garage closed.' : 'Police garage opened.'
    };
  }

  togglePoliceGarage(interactable = null) {
    const placementId = String(interactable?.placementId ?? '').trim();
    if (!placementId || !this.worldBuilder?.setPlacementHiddenNodeNames) {
      return false;
    }

    this.startInteractionCameraFocus(interactable, {
      kind: 'police-garage',
      persistent: false
    });
    const open = !this.isPoliceGarageOpen(placementId);
    if (open) {
      this.openPoliceGaragePlacementIds.add(placementId);
      this.worldBuilder.setPlacementHiddenNodeNames(placementId, this.getGarageDoorClosedNodeNames(interactable));
    } else {
      this.openPoliceGaragePlacementIds.delete(placementId);
      this.worldBuilder.setPlacementHiddenNodeNames(placementId, []);
    }
    this.hud.showToast(open ? 'Police garage opened.' : 'Police garage closed.');
    return true;
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
    this.startInteractionCameraFocus(interaction, { kind: 'office-job' });
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
    return getPlayerOfficeJobIntelligenceLevel(this.getLocalPlayerState());
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
    const definitions = listOfficeJobDefinitions();
    const jobs = new Array(definitions.length);
    for (let index = 0; index < definitions.length; index += 1) {
      const job = definitions[index];
      jobs[index] = {
        ...job,
        unlocked: canPlayerWorkOfficeJob(intelligence, job, charismaLevel, strengthLevel)
      };
    }
    return jobs;
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
    this.startInteractionCameraFocus(interaction ?? this.currentInteractable, { kind: 'office-job' });
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
    const patches = new Array(OFFICE_JANITOR_MOP_DIRT_PATCHES.length);
    for (let index = 0; index < OFFICE_JANITOR_MOP_DIRT_PATCHES.length; index += 1) {
      const patch = OFFICE_JANITOR_MOP_DIRT_PATCHES[index];
      const jitterX = (this.schoolRandom() - 0.5) * 0.035;
      const jitterY = (this.schoolRandom() - 0.5) * 0.035;
      const jitterSize = (this.schoolRandom() - 0.5) * 0.025;
      patches[index] = {
        id: `mop-dirt-${index + 1}`,
        x: THREE.MathUtils.clamp(Number(patch.x ?? 0.5) + jitterX, 0.08, 0.92),
        y: THREE.MathUtils.clamp(Number(patch.y ?? 0.5) + jitterY, 0.2, 0.88),
        size: THREE.MathUtils.clamp(Number(patch.size ?? 0.14) + jitterSize, 0.1, 0.23),
        rotation: Number(patch.rotation ?? 0) + Math.round((this.schoolRandom() - 0.5) * 18),
        clean: 0
      };
    }
    return patches;
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
      round.targetStart = OFFICE_MANAGER_COFFEE_TARGET_START;
      round.targetEnd = OFFICE_MANAGER_COFFEE_TARGET_END;
      data.fill = 0;
      data.fillSpeed = OFFICE_MANAGER_COFFEE_FILL_SPEED;
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
    const next = [];
    for (const item of items) {
      next.push(item);
    }
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.schoolRandom() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  createSchoolGeographyChoiceSet(country = null) {
    const choices = createSchoolGeographyCountryChoices({
      country,
      rng: () => this.schoolRandom(),
      count: 4
    });
    const targetId = String(country?.id ?? '').trim();
    const correctChoiceIndex = Math.max(
      0,
      choices.findIndex((choice) => String(choice?.id ?? '').trim() === targetId)
    );
    return { choices, correctChoiceIndex };
  }

  isSchoolGeographyChoiceCorrect(country = null, choice = null) {
    if (!country || !choice) {
      return false;
    }
    const countryId = String(country.id ?? '').trim();
    const choiceId = String(choice.id ?? '').trim();
    return Boolean(
      (countryId && choiceId && countryId === choiceId)
      || isSchoolGeographyCountryAnswer(country, choice.name)
    );
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

  ensureSchoolGeographyCountryModule() {
    if (this.schoolGeographyCountryModule) {
      return Promise.resolve(this.schoolGeographyCountryModule);
    }

    if (!this.schoolGeographyCountryModulePromise) {
      this.schoolGeographyCountryModulePromise = import('../shared/geographyCountries.js')
        .then((module) => {
          this.schoolGeographyCountryModule = module;
          return module;
        })
        .catch((error) => {
          this.schoolGeographyCountryModulePromise = null;
          throw error;
        });
    }

    return this.schoolGeographyCountryModulePromise;
  }

  createLoadedSchoolGeographyCountry() {
    const createCountry = this.schoolGeographyCountryModule?.createSchoolGeographyCountry;
    return typeof createCountry === 'function'
      ? createCountry({ rng: () => this.schoolRandom() })
      : null;
  }

  isLoadedSchoolGeographyCountryAnswer(country, guess) {
    const isAnswer = this.schoolGeographyCountryModule?.isSchoolGeographyCountryAnswer;
    return typeof isAnswer === 'function' ? isAnswer(country, guess) : false;
  }

  loadSchoolGeographyCountryForCurrentRound(game = this.schoolMicrogame) {
    const gameInstanceId = game?.id ?? '';
    if (
      (this.schoolGeographyCountrySyncPending && this.schoolGeographyCountrySyncPendingGameId === gameInstanceId)
      || !game
      || game.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe
      || game.round?.country
    ) {
      return;
    }

    this.schoolGeographyCountrySyncPending = true;
    this.schoolGeographyCountrySyncPendingGameId = gameInstanceId;
    void this.ensureSchoolGeographyCountryModule()
      .then(() => {
        if (
          this.schoolMicrogame?.id !== gameInstanceId
          || this.schoolMicrogame.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe
          || this.schoolMicrogame.round?.country
        ) {
          return;
        }

        this.schoolMicrogame.round.country = this.createLoadedSchoolGeographyCountry();
        this.schoolMicrogame.data.geographyLoading = false;
        this.syncSchoolMicrogameHud({ loading: false });
      })
      .catch((error) => {
        console.warn('[School] Geography country data failed to load.', error);
        if (this.schoolMicrogame?.id === gameInstanceId) {
          this.schoolMicrogame.message = 'Country data is still loading. Try another round if it does not appear.';
          this.syncSchoolMicrogameHud({ loading: false });
        }
      })
      .finally(() => {
        if (this.schoolGeographyCountrySyncPendingGameId === gameInstanceId) {
          this.schoolGeographyCountrySyncPending = false;
          this.schoolGeographyCountrySyncPendingGameId = '';
        }
      });
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
      data.roundResults = createNullResults(questions.length);
      data.correctCount = 0;
      data.questionLocked = false;
      data.advanceAt = 0;
      data.completing = false;
      data.lastCountdownSecond = 0;
      data.correctImpactIndex = -1;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.geographyGlobe) {
      round.country = createSchoolGeographyCountry({ rng: () => this.schoolRandom() });
      const choiceSet = this.createSchoolGeographyChoiceSet(round.country);
      round.choices = choiceSet.choices;
      round.correctChoiceIndex = choiceSet.correctChoiceIndex;
      data.selectedChoiceIndex = -1;
      data.wrongChoiceIndexes = [];
      data.lastGuess = '';
      data.wrongCount = 0;
      data.answerLocked = false;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.lockerCombo) {
      round.combo = [];
      for (let index = 0; index < 3; index += 1) {
        round.combo.push(String(this.schoolRandomInt(0, 9)));
      }
      round.keypad = this.schoolShuffle(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
      data.entered = [];
      data.previewActive = true;
      data.previewEndsAt = performance.now() + 1500;
    } else if (definition.id === SCHOOL_MICROGAME_IDS.copyNotes) {
      const keys = ['W', 'A', 'S', 'D'];
      round.keys = keys;
      round.sequence = [];
      for (let index = 0; index < 4; index += 1) {
        round.sequence.push(this.schoolPick(keys));
      }
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
    } else if (definition.id === SCHOOL_MICROGAME_IDS.sketchGuessr) {
      const sketchRound = createSchoolSketchGuessrRound({ rng: () => this.schoolRandom() });
      round.sketch = sketchRound.sketch;
      round.answerLength = sketchRound.answerLength;
      round.drawDurationMs = sketchRound.drawDurationMs;
      round.guessDurationMs = sketchRound.guessDurationMs;
      round.revealMs = sketchRound.revealMs;
      data.sketchProgress = 0;
      data.guessText = '';
      data.lastGuess = '';
      data.wrongGuesses = 0;
      data.guessSeq = 0;
      data.revealActive = false;
      data.revealSuccess = false;
      data.revealStartedAt = 0;
      data.revealEndsAt = 0;
      data.revealStartProgress = 0;
      data.revealAnswer = '';
      data.revealResultTitle = '';
      data.revealResultDetail = '';
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
      data.remaining = [];
      for (const item of round.items) {
        data.remaining.push(item);
      }
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
      round.answerKey = [];
      for (let index = 0; index < 4; index += 1) {
        round.answerKey.push(this.schoolPick(options));
      }
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
    this.startInteractionCameraFocus(interaction, { kind: 'school-microgame' });
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
    this.loadSchoolGeographyCountryForCurrentRound(this.schoolMicrogame);
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
      this.schoolMicrogame.data.roundResults = createNullResults(questions.length);
      this.schoolMicrogame.data.correctCount = 0;
      this.schoolMicrogame.data.questionLocked = false;
      this.schoolMicrogame.data.advanceAt = 0;
      this.schoolMicrogame.data.completing = false;
      this.schoolMicrogame.data.lastCountdownSecond = Math.ceil(this.schoolMicrogame.remainingMs / 1000);
      this.schoolMicrogame.data.correctImpactIndex = -1;
      this.setCurrentPopQuizQuestion(this.schoolMicrogame, 0);
    } else if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.geographyGlobe) {
      if (!this.schoolMicrogame.round.country) {
        this.schoolMicrogame.message = 'Loading country data...';
        this.loadSchoolGeographyCountryForCurrentRound(this.schoolMicrogame);
        this.syncSchoolMicrogameHud({ loading: true });
      }
      if (!Array.isArray(this.schoolMicrogame.round.choices) || this.schoolMicrogame.round.choices.length !== 4) {
        const choiceSet = this.createSchoolGeographyChoiceSet(this.schoolMicrogame.round.country);
        this.schoolMicrogame.round.choices = choiceSet.choices;
        this.schoolMicrogame.round.correctChoiceIndex = choiceSet.correctChoiceIndex;
      }
      this.schoolMicrogame.data.selectedChoiceIndex = -1;
      this.schoolMicrogame.data.wrongChoiceIndexes = [];
      this.schoolMicrogame.data.lastGuess = '';
      this.schoolMicrogame.data.wrongCount = 0;
      this.schoolMicrogame.data.answerLocked = false;
      this.schoolMicrogame.data.revealActive = false;
      this.schoolMicrogame.data.revealSuccess = false;
      this.schoolMicrogame.data.revealStartedAt = 0;
      this.schoolMicrogame.data.revealEndsAt = 0;
      this.schoolMicrogame.data.revealAnswer = '';
      this.schoolMicrogame.data.revealResultTitle = '';
      this.schoolMicrogame.data.revealResultDetail = '';
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
    } else if (this.schoolMicrogame.round?.gameId === SCHOOL_MICROGAME_IDS.sketchGuessr) {
      this.schoolMicrogame.data.sketchProgress = 0;
      this.schoolMicrogame.data.guessText = '';
      this.schoolMicrogame.data.lastGuess = '';
      this.schoolMicrogame.data.wrongGuesses = 0;
      this.schoolMicrogame.data.guessSeq = 0;
      this.schoolMicrogame.data.revealActive = false;
      this.schoolMicrogame.data.revealSuccess = false;
      this.schoolMicrogame.data.revealStartedAt = 0;
      this.schoolMicrogame.data.revealEndsAt = 0;
      this.schoolMicrogame.data.revealStartProgress = 0;
      this.schoolMicrogame.data.revealAnswer = '';
      this.schoolMicrogame.data.revealResultTitle = '';
      this.schoolMicrogame.data.revealResultDetail = '';
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
    this.clearInteractionCameraFocus('school-microgame');
    this.clearInteractionCameraFocus('office-job');
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
    this.schoolGeographyGlobeRenderer?.setActive(false);
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
    this.syncSchoolGeographyGlobe();
    this.syncSchoolTeacherPreview();
  }

  isSchoolGeographyGameActive(game = this.schoolMicrogame) {
    return (
      this.hud.isSchoolMicrogameOpen()
      && game?.round?.gameId === SCHOOL_MICROGAME_IDS.geographyGlobe
      && game.phase === 'playing'
    );
  }

  ensureSchoolGeographyGlobeRenderer() {
    if (this.schoolGeographyGlobeRenderer) {
      return Promise.resolve(this.schoolGeographyGlobeRenderer);
    }

    if (!this.schoolGeographyGlobeRendererPromise) {
      this.schoolGeographyGlobeRendererPromise = import('../ui/SchoolGeographyGlobeRenderer.js')
        .then(({ SchoolGeographyGlobeRenderer }) => {
          this.schoolGeographyGlobeRenderer = new SchoolGeographyGlobeRenderer();
          return this.schoolGeographyGlobeRenderer;
        })
        .catch((error) => {
          this.schoolGeographyGlobeRendererPromise = null;
          throw error;
        });
    }

    return this.schoolGeographyGlobeRendererPromise;
  }

  applySchoolGeographyGlobeRenderer(renderer, game = this.schoolMicrogame) {
    const mount = this.hud.getSchoolGeographyGlobeMount?.();
    if (!renderer || !this.isSchoolGeographyGameActive(game) || !mount || !game.round?.country) {
      renderer?.setActive(false);
      return false;
    }

    renderer.mount(mount);
    renderer.setTargetCountry(game.round?.country);
    renderer.setRevealActive(game.data?.revealActive === true);
    renderer.setActive(true);
    return true;
  }

  syncSchoolGeographyGlobe() {
    const game = this.schoolMicrogame;
    if (!this.isSchoolGeographyGameActive(game)) {
      this.schoolGeographyGlobeRenderer?.setActive(false);
      return;
    }

    if (this.schoolGeographyGlobeRenderer) {
      this.applySchoolGeographyGlobeRenderer(this.schoolGeographyGlobeRenderer, game);
      return;
    }

    if (this.schoolGeographyGlobeSyncPending || !this.hud.getSchoolGeographyGlobeMount?.()) {
      return;
    }

    this.schoolGeographyGlobeSyncPending = true;
    void this.ensureSchoolGeographyGlobeRenderer()
      .then((renderer) => {
        this.applySchoolGeographyGlobeRenderer(renderer);
      })
      .catch((error) => {
        console.warn('[School] Geography globe renderer failed to initialize.', error);
      })
      .finally(() => {
        this.schoolGeographyGlobeSyncPending = false;
      });
  }

  updateSchoolGeographyGlobe(deltaSeconds = 0) {
    this.syncSchoolGeographyGlobe();
    this.schoolGeographyGlobeRenderer?.update(deltaSeconds);
  }

  isSchoolTeacherGameActive(game = this.schoolMicrogame) {
    return (
      this.hud.isSchoolMicrogameOpen()
      && game?.round?.gameId === SCHOOL_MICROGAME_IDS.teacherLooking
      && game.phase === 'playing'
    );
  }

  ensureSchoolTeacherPreviewRenderer() {
    if (this.schoolTeacherPreviewRenderer) {
      return Promise.resolve(this.schoolTeacherPreviewRenderer);
    }

    if (!this.schoolTeacherPreviewRendererPromise) {
      this.schoolTeacherPreviewRendererPromise = import('../ui/SchoolTeacherPreviewRenderer.js')
        .then(({ SchoolTeacherPreviewRenderer }) => {
          this.schoolTeacherPreviewRenderer = new SchoolTeacherPreviewRenderer({
            library: this.library
          });
          return this.schoolTeacherPreviewRenderer;
        })
        .catch((error) => {
          this.schoolTeacherPreviewRendererPromise = null;
          throw error;
        });
    }

    return this.schoolTeacherPreviewRendererPromise;
  }

  applySchoolTeacherPreviewRenderer(renderer, game = this.schoolMicrogame) {
    const mount = this.hud.getSchoolTeacherPreviewMount?.();
    if (!renderer || !this.isSchoolTeacherGameActive(game) || !mount) {
      renderer?.setActive(false);
      return false;
    }

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
    return true;
  }

  syncSchoolTeacherPreview() {
    const game = this.schoolMicrogame;
    if (!this.isSchoolTeacherGameActive(game)) {
      this.schoolTeacherPreviewRenderer?.setActive(false);
      return;
    }

    if (this.schoolTeacherPreviewRenderer) {
      this.applySchoolTeacherPreviewRenderer(this.schoolTeacherPreviewRenderer, game);
      return;
    }

    if (this.schoolTeacherPreviewSyncPending || !this.hud.getSchoolTeacherPreviewMount?.()) {
      return;
    }

    this.schoolTeacherPreviewSyncPending = true;
    void this.ensureSchoolTeacherPreviewRenderer()
      .then((renderer) => {
        this.applySchoolTeacherPreviewRenderer(renderer);
      })
      .catch((error) => {
        console.warn('[School] Teacher preview renderer failed to initialize.', error);
      })
      .finally(() => {
        this.schoolTeacherPreviewSyncPending = false;
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

  async finishSchoolMicrogame(success, resultTitle, resultDetail = '', {
    playSuccessSound = true,
    playFailureSound = true
  } = {}) {
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
      if (playFailureSound) {
        this.playSoundEffect(this.playingCardSound);
      }
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
    if (playSuccessSound) {
      this.playTaskCompleteSound();
      this.hud.playTaskConfetti();
    }
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
    const roundResults = cloneRoundResults(game.data.roundResults, questions.length);
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

    let correctCount = 0;
    for (const result of roundResults) {
      if (result === true) {
        correctCount += 1;
      }
    }
    game.data.correctCount = correctCount;
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

  isMemoryCardIdAllowed(cardId = '', cards = this.getMemoryMatchCards()) {
    for (const card of cards) {
      if (card?.id === cardId) {
        return true;
      }
    }
    return false;
  }

  normalizeMemoryCardIds(ids = [], cards = this.getMemoryMatchCards()) {
    const next = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const cardId = String(id ?? '');
      let alreadyAdded = false;
      for (const existingId of next) {
        if (existingId === cardId) {
          alreadyAdded = true;
          break;
        }
      }
      if (this.isMemoryCardIdAllowed(cardId, cards) && !alreadyAdded) {
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
    let selectedCard = null;
    for (const card of cards) {
      if (card.id === cardId) {
        selectedCard = card;
        break;
      }
    }
    if (!selectedCard) {
      return;
    }

    const matchedIds = addValuesToSet(this.memoryMatchMatchedIdSet, this.normalizeMemoryCardIds(game.data.matchedCardIds, cards));
    if (matchedIds.has(cardId)) {
      return;
    }

    const normalizedVisibleIds = this.normalizeMemoryCardIds(game.data.visibleCardIds, cards);
    let visibleIds = [];
    for (const id of normalizedVisibleIds) {
      if (!matchedIds.has(id)) {
        visibleIds.push(id);
      }
    }
    const pendingMismatchIds = this.normalizeMemoryCardIds(game.data.pendingMismatchIds, cards);
    if (pendingMismatchIds.length >= 2) {
      const retainedVisibleIds = [];
      for (const id of visibleIds) {
        let pendingMismatch = false;
        for (const pendingId of pendingMismatchIds) {
          if (pendingId === id) {
            pendingMismatch = true;
            break;
          }
        }
        if (!pendingMismatch) {
          retainedVisibleIds.push(id);
        }
      }
      visibleIds = retainedVisibleIds;
      game.data.pendingMismatchIds = [];
      game.data.celebratingCardIds = [];
      game.data.flippingBackCardIds = pendingMismatchIds;
      game.data.flipBackEndsAt = performance.now() + 340;
    }

    for (const id of visibleIds) {
      if (id === cardId) {
        return;
      }
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
    let firstCard = null;
    let secondCard = null;
    for (const card of cards) {
      if (!firstCard && card.id === firstId) {
        firstCard = card;
      }
      if (!secondCard && card.id === secondId) {
        secondCard = card;
      }
      if (firstCard && secondCard) {
        break;
      }
    }
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
    game.data.matchedCardIds = [];
    for (const id of matchedIds) {
      game.data.matchedCardIds.push(id);
    }
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

  getSchoolSketchAnswerLabel(game = this.schoolMicrogame) {
    return String(game?.round?.sketch?.label ?? 'the object').trim() || 'the object';
  }

  isSchoolSketchGuessrRevealActive(game = this.schoolMicrogame) {
    return Boolean(
      game?.phase === 'playing'
      && game.round?.gameId === SCHOOL_MICROGAME_IDS.sketchGuessr
      && game.data?.revealActive === true
    );
  }

  startSchoolSketchGuessrReveal({
    success = false,
    resultTitle = '',
    resultDetail = ''
  } = {}) {
    const game = this.schoolMicrogame;
    if (
      !game
      || game.round?.gameId !== SCHOOL_MICROGAME_IDS.sketchGuessr
      || game.phase !== 'playing'
      || game.data?.revealActive === true
    ) {
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const answer = this.getSchoolSketchAnswerLabel(game);
    const drawDuration = Math.max(
      1,
      Number(game.round?.drawDurationMs ?? ((game.round?.durationMs ?? 7000) + 5000)) || 12000
    );
    const elapsed = Math.max(0, now - (Number(game.startedAt ?? now) || now));
    const naturalProgress = elapsed / drawDuration;
    const currentProgress = THREE.MathUtils.clamp(
      Number.isFinite(Number(game.data?.sketchProgress))
        ? Number(game.data.sketchProgress)
        : naturalProgress,
      0,
      0.995
    );
    const revealMs = Math.max(450, Number(game.round?.revealMs ?? 1250) || 1250);
    const title = resultTitle || (success ? 'Guessed It' : 'Out Of Time');
    const detail = resultDetail || (success ? `It was ${answer}.` : `The sketch was ${answer}.`);

    game.data.guessText = '';
    game.data.revealActive = true;
    game.data.revealSuccess = Boolean(success);
    game.data.revealStartedAt = now;
    game.data.revealEndsAt = now + revealMs;
    game.data.revealStartProgress = currentProgress;
    game.data.revealAnswer = answer;
    game.data.revealResultTitle = title;
    game.data.revealResultDetail = detail;
    game.data.sketchProgress = currentProgress;
    game.endsAt = game.data.revealEndsAt;
    game.remainingMs = revealMs;
    game.message = success ? 'Correct. Finishing the sketch.' : `It was ${answer}. Finishing the sketch.`;

    if (success) {
      this.playTaskCompleteSound();
      this.hud.playTaskConfetti();
    } else {
      this.playSoundEffect(this.playingCardSound);
    }
    this.syncSchoolMicrogameHud();
  }

  updateSchoolSketchGuessrState(game = this.schoolMicrogame, now = performance.now()) {
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.sketchGuessr || game.phase !== 'playing') {
      return false;
    }

    if (game.data?.revealActive === true) {
      const revealEndsAt = Number(game.data.revealEndsAt ?? 0) || now;
      const revealStartedAt = Number(game.data.revealStartedAt ?? now) || now;
      const revealDuration = Math.max(1, revealEndsAt - revealStartedAt);
      const revealT = THREE.MathUtils.clamp((now - revealStartedAt) / revealDuration, 0, 1);
      const eased = 1 - ((1 - revealT) * (1 - revealT) * (1 - revealT));
      const startProgress = THREE.MathUtils.clamp(Number(game.data.revealStartProgress ?? 0) || 0, 0, 1);
      game.data.sketchProgress = THREE.MathUtils.clamp(startProgress + ((1 - startProgress) * eased), 0, 1);
      game.endsAt = Math.max(Number(game.endsAt ?? revealEndsAt) || revealEndsAt, revealEndsAt);
      game.remainingMs = Math.max(0, revealEndsAt - now);

      if (now < revealEndsAt) {
        return true;
      }

      const revealSuccess = game.data.revealSuccess === true;
      const title = game.data.revealResultTitle || (revealSuccess ? 'Guessed It' : 'Out Of Time');
      const detail = game.data.revealResultDetail || `The sketch was ${this.getSchoolSketchAnswerLabel(game)}.`;
      game.data.sketchProgress = 1;
      game.data.revealActive = false;
      void this.finishSchoolMicrogame(revealSuccess, title, detail, {
        playSuccessSound: false,
        playFailureSound: false
      });
      return true;
    }

    const drawDuration = Math.max(
      1,
      Number(game.round?.drawDurationMs ?? ((game.round?.durationMs ?? 7000) + 5000)) || 12000
    );
    const elapsed = Math.max(0, now - (Number(game.startedAt ?? now) || now));
    game.data.sketchProgress = THREE.MathUtils.clamp(elapsed / drawDuration, 0, 0.995);
    return false;
  }

  submitSchoolSketchGuess(guess = '') {
    const game = this.schoolMicrogame;
    if (
      !game
      || game.round?.gameId !== SCHOOL_MICROGAME_IDS.sketchGuessr
      || game.phase !== 'playing'
      || game.data?.revealActive === true
    ) {
      return;
    }

    const cleanGuess = String(guess ?? '').trim().slice(0, 32);
    if (!cleanGuess) {
      game.message = 'Type a guess first.';
      this.syncSchoolMicrogameHud();
      return;
    }

    game.data.lastGuess = cleanGuess;
    game.data.guessText = cleanGuess;
    game.data.guessSeq = Math.max(0, Math.floor(Number(game.data.guessSeq ?? 0) || 0)) + 1;

    if (isSchoolSketchGuessAnswer(game.round?.sketch, cleanGuess)) {
      this.startSchoolSketchGuessrReveal({
        success: true,
        resultTitle: 'Guessed It',
        resultDetail: `You called ${this.getSchoolSketchAnswerLabel(game)} before the final lines.`
      });
      return;
    }

    game.data.wrongGuesses = Math.max(0, Math.floor(Number(game.data.wrongGuesses ?? 0) || 0)) + 1;
    game.data.guessText = '';
    game.message = 'Not it. Keep watching the lines.';
    this.playSoundEffect(this.playingCardSound);
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
      const targetStart = Number(game.round.targetStart ?? OFFICE_MANAGER_COFFEE_TARGET_START) || OFFICE_MANAGER_COFFEE_TARGET_START;
      const targetEnd = Number(game.round.targetEnd ?? OFFICE_MANAGER_COFFEE_TARGET_END) || OFFICE_MANAGER_COFFEE_TARGET_END;
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

    if (gameId === SCHOOL_MICROGAME_IDS.sketchGuessr && action.startsWith('sketch:guess:')) {
      let guess = action.slice('sketch:guess:'.length);
      try {
        guess = decodeURIComponent(guess);
      } catch {
        guess = '';
      }
      this.submitSchoolSketchGuess(guess);
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.geographyGlobe) {
      if (action.startsWith('geography:choice:')) {
        this.chooseSchoolGeographyAnswer(action.slice('geography:choice:'.length));
      }
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

  getSchoolGeographyChoices(game = this.schoolMicrogame) {
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe) {
      return [];
    }
    let country = game.round.country;
    if (!country) {
      country = createSchoolGeographyCountry({ rng: () => this.schoolRandom() });
      game.round.country = country;
    }
    let choices = Array.isArray(game.round.choices) ? game.round.choices : [];
    const hasCorrectChoice = choices.some((choice) => this.isSchoolGeographyChoiceCorrect(country, choice));
    if (choices.length !== 4 || !hasCorrectChoice) {
      const choiceSet = this.createSchoolGeographyChoiceSet(country);
      game.round.choices = choiceSet.choices;
      game.round.correctChoiceIndex = choiceSet.correctChoiceIndex;
      choices = choiceSet.choices;
    } else {
      game.round.correctChoiceIndex = Math.max(
        0,
        choices.findIndex((choice) => this.isSchoolGeographyChoiceCorrect(country, choice))
      );
    }
    return choices;
  }

  isSchoolGeographyRevealActive(game = this.schoolMicrogame) {
    return Boolean(
      game?.phase === 'playing'
      && game.round?.gameId === SCHOOL_MICROGAME_IDS.geographyGlobe
      && game.data?.revealActive === true
    );
  }

  startSchoolGeographyAnswerReveal({
    success = false,
    resultTitle = '',
    resultDetail = ''
  } = {}) {
    const game = this.schoolMicrogame;
    if (!game || game.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe || game.phase !== 'playing') {
      return;
    }

    if (game.data?.revealActive === true) {
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const countryName = String(game.round?.country?.name ?? 'the target country');
    const revealSuccess = Boolean(success);
    const title = resultTitle || (revealSuccess ? 'Nice job!' : 'Missed Country');
    const detail = resultDetail || `The pinpoint was ${countryName}.`;
    game.data.answerLocked = true;
    game.data.revealActive = true;
    game.data.revealSuccess = revealSuccess;
    game.data.revealStartedAt = now;
    game.data.revealEndsAt = now + SCHOOL_GEOGRAPHY_REVEAL_MS;
    game.data.revealAnswer = countryName;
    game.data.revealResultTitle = title;
    game.data.revealResultDetail = detail;
    game.endsAt = game.data.revealEndsAt;
    game.remainingMs = SCHOOL_GEOGRAPHY_REVEAL_MS;
    game.message = revealSuccess ? 'Nice job!' : detail;

    if (revealSuccess) {
      this.playTaskCompleteSound();
      this.hud.playTaskConfetti();
    } else {
      this.playSoundEffect(this.playingCardSound);
    }
    this.syncSchoolMicrogameHud();
  }

  updateSchoolGeographyRevealState(game = this.schoolMicrogame, now = performance.now()) {
    if (!this.isSchoolGeographyRevealActive(game)) {
      return false;
    }

    const countryName = String(game.round?.country?.name ?? 'the target country');
    const revealEndsAt = Number(game.data.revealEndsAt ?? 0) || now;
    game.endsAt = Math.max(Number(game.endsAt ?? revealEndsAt) || revealEndsAt, revealEndsAt);
    game.remainingMs = Math.max(0, revealEndsAt - now);
    game.message = game.data.revealSuccess === true
      ? 'Nice job!'
      : (game.data.revealResultDetail || `The pinpoint was ${countryName}.`);

    if (now < revealEndsAt) {
      return true;
    }

    const revealSuccess = game.data.revealSuccess === true;
    const title = game.data.revealResultTitle || (revealSuccess ? 'Nice job!' : 'Missed Country');
    const detail = game.data.revealResultDetail || `The pinpoint was ${countryName}.`;
    game.data.revealActive = false;
    void this.finishSchoolMicrogame(revealSuccess, title, detail, {
      playSuccessSound: false,
      playFailureSound: false
    });
    return true;
  }

  chooseSchoolGeographyAnswer(choiceIndexValue = '') {
    const game = this.schoolMicrogame;
    if (
      !game
      || game.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe
      || game.phase !== 'playing'
      || game.data?.revealActive === true
    ) {
      return;
    }

    const choices = this.getSchoolGeographyChoices(game);
    const choiceIndex = Math.floor(Number(choiceIndexValue));
    const choice = choices[choiceIndex];
    if (!choice) {
      return;
    }

    const wrongChoiceIndexes = new Set(
      Array.isArray(game.data.wrongChoiceIndexes)
        ? game.data.wrongChoiceIndexes.map((index) => Math.floor(Number(index))).filter((index) => Number.isFinite(index))
        : []
    );
    if (wrongChoiceIndexes.has(choiceIndex)) {
      return;
    }

    const country = game.round.country;
    const choiceName = String(choice.name ?? '').trim();
    game.data.selectedChoiceIndex = choiceIndex;
    game.data.lastGuess = choiceName;
    game.data.answerLocked = true;

    if (this.isSchoolGeographyChoiceCorrect(country, choice)) {
      this.startSchoolGeographyAnswerReveal({
        success: true,
        resultTitle: 'Nice job!',
        resultDetail: `The pinpoint was ${country?.name ?? 'the right country'}.`
      });
      return;
    }

    wrongChoiceIndexes.add(choiceIndex);
    game.data.wrongChoiceIndexes = [...wrongChoiceIndexes].sort((left, right) => left - right);
    game.data.wrongCount = game.data.wrongChoiceIndexes.length;
    game.data.answerLocked = false;
    game.message = game.data.wrongCount >= 2
      ? 'Still not it. Check the needle and try another country.'
      : 'Not that country. Try another choice.';
    this.playSoundEffect(this.playingCardSound);
    this.syncSchoolMicrogameHud();
  }

  pushSchoolGeographyKey(key = '') {
    const game = this.schoolMicrogame;
    if (
      !game
      || game.round?.gameId !== SCHOOL_MICROGAME_IDS.geographyGlobe
      || game.phase !== 'playing'
      || game.data?.revealActive === true
    ) {
      return;
    }

    const inputKey = String(key ?? '').trim();
    const choiceNumber = Math.floor(Number(inputKey));
    if (!Number.isInteger(choiceNumber) || choiceNumber < 1 || choiceNumber > 4) {
      return;
    }

    this.chooseSchoolGeographyAnswer(choiceNumber - 1);
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
    let item = null;
    for (const entry of game.data.remaining ?? []) {
      if (entry.id === selectedId) {
        item = entry;
        break;
      }
    }
    if (!item) {
      return;
    }

    const remaining = [];
    for (const entry of game.data.remaining ?? []) {
      if (entry.id !== selectedId) {
        remaining.push(entry);
      }
    }
    game.data.remaining = remaining;
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

  updateSchoolMicrogame(deltaSeconds = 0, now = performance.now()) {
    const game = this.schoolMicrogame;
    if (!game || !this.hud.isSchoolMicrogameOpen()) {
      return;
    }

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

    if (!this.isSchoolGeographyRevealActive(game) && !this.isSchoolSketchGuessrRevealActive(game)) {
      this.handleSchoolMicrogameKeyboardInput();
    }
    this.updatePlayingSchoolMicrogame(dt, now);

    if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
      return;
    }

    if (this.isSchoolGeographyRevealActive(game) || this.isSchoolSketchGuessrRevealActive(game)) {
      this.syncSchoolMicrogameHud();
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
      } else if (gameId === SCHOOL_MICROGAME_IDS.geographyGlobe) {
        this.startSchoolGeographyAnswerReveal({
          success: false,
          resultTitle: 'Missed Country',
          resultDetail: `The pinpoint was ${game.round?.country?.name ?? 'the target country'}.`
        });
      } else if (gameId === SCHOOL_MICROGAME_IDS.sketchGuessr) {
        this.startSchoolSketchGuessrReveal({
          success: false,
          resultTitle: 'Out Of Time',
          resultDetail: `The sketch was ${this.getSchoolSketchAnswerLabel(game)}.`
        });
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

    if (gameId === SCHOOL_MICROGAME_IDS.geographyGlobe) {
      const choiceCodes = [
        'Digit1',
        'Digit2',
        'Digit3',
        'Digit4',
        'Numpad1',
        'Numpad2',
        'Numpad3',
        'Numpad4'
      ];

      for (let index = 0; index < 32; index += 1) {
        const keyEvent = this.input.consumeNextKeyEvent(choiceCodes);
        if (!keyEvent) {
          return;
        }

        const code = keyEvent.code;
        if (code.startsWith('Digit') || code.startsWith('Numpad')) {
          this.pushSchoolGeographyKey(code.slice(-1));
        }

        if (!this.schoolMicrogame || this.schoolMicrogame.phase !== 'playing') {
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
          let row = 0;
          for (const value of game.data.filled ?? []) {
            if (value) {
              row += 1;
            }
          }
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
        const distanceSq = distanceSquared2D(mopX, mopY, patchX, patchY);
        if (distanceSq > reach * reach) {
          continue;
        }

        const distance = Math.sqrt(distanceSq);
        const falloff = 1 - (distance / Math.max(0.001, reach));
        const clean = Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0));
        patch.clean = Math.min(1, clean + dt * OFFICE_JANITOR_MOP_CLEAN_RATE * (0.42 + falloff));
      }
    }

    let cleanTotal = 0;
    for (let index = 0; index < patches.length; index += 1) {
      cleanTotal += Math.max(0, Math.min(1, Number(patches[index].clean ?? 0) || 0));
    }
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
        game.data.fill = Math.min(110, Number(game.data.fill ?? 0) + Number(game.data.fillSpeed ?? OFFICE_MANAGER_COFFEE_FILL_SPEED) * dt);
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

    if (gameId === SCHOOL_MICROGAME_IDS.geographyGlobe && this.updateSchoolGeographyRevealState(game, now)) {
      return;
    }

    if (gameId === SCHOOL_MICROGAME_IDS.sketchGuessr && this.updateSchoolSketchGuessrState(game, now)) {
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
      const chalks = Array.isArray(game.data.chalks) ? game.data.chalks : [];
      let writeIndex = 0;
      for (let index = 0; index < chalks.length; index += 1) {
        const chalk = chalks[index];
        if (!chalk) {
          continue;
        }
        chalk.x = Number(chalk.x ?? 0) - dt * 72;
        if (chalk.x <= -8) {
          continue;
        }
        chalks[writeIndex] = chalk;
        writeIndex += 1;
      }
      chalks.length = writeIndex;
      game.data.chalks = chalks;

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

    this.worldBuilder.setPlayerWorkoutState(this.npcServiceState.players ?? EMPTY_NPC_SERVICE_PLAYERS, {
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

  completeWorkoutPlacement(placementId = '', result = {}) {
    const normalizedPlacementId = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalizedPlacementId) {
      return;
    }

    if (!this.npcService?.completeWorkoutPlacement) {
      this.releaseWorkoutPlacement(normalizedPlacementId);
      return;
    }

    void this.npcService.completeWorkoutPlacement(normalizedPlacementId, result)
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
    if (activityConfig.kind === SNATCH_WORKOUT_KIND) {
      this.updateSnatchWorkoutCamera({ snap: true });
    }
    if (activityConfig.basketballShot) {
      this.beginBasketballShotActivity();
    }
    if (activityConfig.treadmillRun) {
      this.beginTreadmillRunActivity();
    }
    return true;
  }

  getSnatchWorkoutForward(target = this.snatchWorkoutForward) {
    const facing = this.activeWorkout?.interactable?.approachRotationY
      ?? this.player?.object?.rotation?.y
      ?? 0;
    target.set(Math.sin(facing), 0, Math.cos(facing));
    if (target.lengthSq() <= 0.0001) {
      target.set(0, 0, -1);
    }
    return target.normalize();
  }

  getSnatchWorkoutSide(target = this.snatchWorkoutSide) {
    const forward = this.getSnatchWorkoutForward(this.snatchWorkoutForward);
    target.set(forward.z, 0, -forward.x);
    if (target.lengthSq() <= 0.0001) {
      target.set(1, 0, 0);
    }
    return target.normalize();
  }

  getSnatchWorkoutCameraDistance() {
    const aspect = Math.max(0.35, Number(this.camera?.aspect ?? 1) || 1);
    const verticalFov = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(Number(this.camera?.fov ?? 55) || 55, 20, 95));
    const horizontalHalfTan = Math.tan(verticalFov * 0.5) * aspect;
    const barHalfWidth = (OLYMPIC_BARBELL_LENGTH * 0.5) + SNATCH_WORKOUT_CAMERA_BAR_PADDING;
    const fitDistance = barHalfWidth / Math.max(0.18, horizontalHalfTan);
    return Math.max(SNATCH_WORKOUT_CAMERA_BASE_DISTANCE, fitDistance);
  }

  updateSnatchWorkoutCamera({ snap = false } = {}) {
    if (!this.player) {
      return;
    }

    const forward = this.getSnatchWorkoutForward(this.snatchWorkoutForward);
    const side = this.getSnatchWorkoutSide(this.snatchWorkoutSide);
    const targetPosition = this.cameraTargetPosition
      .copy(this.player.position)
      .addScaledVector(forward, -this.getSnatchWorkoutCameraDistance())
      .addScaledVector(side, SNATCH_WORKOUT_CAMERA_SIDE_OFFSET);
    targetPosition.y += SNATCH_WORKOUT_CAMERA_HEIGHT;

    const lookTarget = this.cameraLookTarget
      .copy(this.player.position)
      .addScaledVector(forward, 0.2);
    lookTarget.y += SNATCH_WORKOUT_CAMERA_LOOK_HEIGHT;

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, SNATCH_WORKOUT_CAMERA_SMOOTHING);
    }
    this.camera.lookAt(lookTarget);
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
    const state = this.basketballShotHudState;
    if (!shot) {
      state.visible = false;
      state.game = null;
      this.hud.setBasketballShotState(state);
      return;
    }

    const game = this.basketballShotHudGame;
    game.phase = shot.released ? 'result' : 'playing';
    game.progress = shot.released ? shot.releaseProgress : shot.progress;
    game.released = shot.released;
    game.made = shot.released ? shot.made : null;
    game.release = shot.release;
    game.score = shot.score;
    game.message = shot.message;
    state.visible = true;
    state.game = game;
    this.hud.setBasketballShotState(state);
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

  updateBasketballShotWorkout(deltaSeconds, options = null) {
    const colliders = options?.colliders ?? EMPTY_COLLIDERS;
    const sceneBounds = options?.sceneBounds ?? null;
    const groundHeight = options?.groundHeight ?? 0;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
    const shot = this.activeWorkout?.basketballShot;
    if (!shot || !this.player) {
      return true;
    }

    const playerUpdateOptions = this.playerUpdateOptions;
    playerUpdateOptions.skateboardOwned = false;
    playerUpdateOptions.vehicleItemId = '';
    playerUpdateOptions.skating = false;
    playerUpdateOptions.speedScale = 0;
    playerUpdateOptions.movementCameraForward = CAMERA_MOVEMENT_FORWARD;
    playerUpdateOptions.stationaryRun = false;
    playerUpdateOptions.locomotionMode = undefined;
    playerUpdateOptions.locomotionPlaybackRate = undefined;
    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight,
      playerUpdateOptions
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
        this.finishWorkout({ awardXp: false, showCompleteToast: false });
      }
    }
    return true;
  }

  beginTreadmillRunActivity() {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    const now = performance.now();
    const durationMs = Math.max(1000, Number(this.activeWorkout.activityConfig?.durationMs ?? TREADMILL_DURATION_MS) || TREADMILL_DURATION_MS);
    const countdownMs = TREADMILL_RUN_COUNTDOWN_MS;
    const treadmillObject = this.activeWorkout.interactable?.barbellObject ?? null;
    const bpm = createRandomTreadmillRunBpm();
    const beats = createTreadmillRunBeatSchedule({
      durationMs,
      bpm
    });
    const countdownBeats = createTreadmillRunCountdownBeatSchedule({
      countdownMs,
      beats,
      bpm
    });
    this.activeWorkout.treadmillRun = {
      countdownStartedAt: now,
      countdownMs,
      startedAt: now + countdownMs,
      durationMs,
      bpm,
      phase: 'countdown',
      beats,
      countdownBeats,
      taps: [],
      extraTaps: 0,
      score: 0,
      message: 'Press Spacebar to the beat of the player running.',
      lastGrade: 'listen',
      nextCountdownSoundBeatIndex: 0,
      nextSoundBeatIndex: 0,
      resultAt: 0,
      awardXp: false,
      treadmillObject
    };
    if (treadmillObject?.userData) {
      treadmillObject.userData.treadmillBeltSpeed = THREE.MathUtils.clamp(bpm / 120, 0.7, 1.7);
    }
    this.input.clearKeyPressQueue?.();
    this.startTreadmillLoopSound();
    this.updateTreadmillRunHud();
    this.updateTreadmillRunCamera({ snap: true });
    return true;
  }

  getTreadmillRunForward(target = this.treadmillRunForward) {
    const facing = this.activeWorkout?.interactable?.approachRotationY
      ?? this.player?.object?.rotation?.y
      ?? 0;
    target.set(Math.sin(facing), 0, Math.cos(facing));
    if (target.lengthSq() <= 0.0001) {
      target.set(0, 0, -1);
    }
    return target.normalize();
  }

  getTreadmillRunSide(target = this.treadmillRunSide) {
    const forward = this.getTreadmillRunForward(this.treadmillRunForward);
    target.set(forward.z, 0, -forward.x);
    if (target.lengthSq() <= 0.0001) {
      target.set(1, 0, 0);
    }
    return target.normalize();
  }

  getTreadmillRunElapsed(run = this.activeWorkout?.treadmillRun, now = performance.now()) {
    return Math.max(0, now - Number(run?.startedAt ?? now));
  }

  getTreadmillRunCountdownElapsed(run = this.activeWorkout?.treadmillRun, now = performance.now()) {
    return Math.max(0, now - Number(run?.countdownStartedAt ?? now));
  }

  getTreadmillRunBpm(run = this.activeWorkout?.treadmillRun) {
    return normalizeTreadmillRunBpm(run?.bpm ?? run?.beats?.[0]?.bpm);
  }

  syncTreadmillRunObjectSpeed(run = this.activeWorkout?.treadmillRun, now = performance.now()) {
    const treadmillObject = run?.treadmillObject;
    if (!treadmillObject?.userData) {
      return;
    }

    const runActive = run.phase === 'countdown' || run.phase === 'playing';
    if (!runActive) {
      treadmillObject.userData.treadmillBeltSpeed = 0.9;
      return;
    }

    const bpm = this.getTreadmillRunBpm(run, now);
    treadmillObject.userData.treadmillBeltSpeed = THREE.MathUtils.clamp(bpm / 120, 0.7, 1.7);
  }

  startTreadmillLoopSound() {
    this.stopTreadmillLoopSound();
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      return;
    }

    void context.resume?.().catch(() => {});
    const master = context.createGain();
    const motor = context.createOscillator();
    const belt = context.createOscillator();
    const now = context.currentTime;
    master.gain.setValueAtTime(THREE.MathUtils.clamp(0.0035 * Number(this.gameSettings?.masterVolume ?? 1), 0.0001, 0.011), now);
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(54, now);
    belt.type = 'triangle';
    belt.frequency.setValueAtTime(94, now);
    motor.connect(master);
    belt.connect(master);
    master.connect(context.destination);
    motor.start(now);
    belt.start(now);
    this.treadmillRunAudioNodes.push(motor, belt, master);
  }

  stopTreadmillLoopSound() {
    for (const node of this.treadmillRunAudioNodes) {
      try {
        node.stop?.(0);
      } catch {
        // Already stopped.
      }
      try {
        node.disconnect?.();
      } catch {
        // Already disconnected.
      }
    }
    this.treadmillRunAudioNodes = [];
  }

  playTreadmillFootstepSound(bpm = 150, { countdown = false, accent = 1 } = {}) {
    const safeBpm = Math.max(60, Number(bpm) || 150);
    const volume = Math.max(0, Number(this.gameSettings?.masterVolume ?? 1) || 0);
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      this.playSoundEffect(this.playingCardSound, {
        playbackRate: THREE.MathUtils.clamp(safeBpm / 150, 0.75, 1.45),
        preservePitch: false,
        volumeScale: countdown ? 0.82 : 1.04
      });
      return;
    }

    void context.resume?.().catch(() => {});
    const now = context.currentTime;
    const durationSeconds = 0.18;
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
    const noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const decay = 1 - (index / sampleCount);
      noiseData[index] = ((Math.random() * 2) - 1) * decay * decay;
    }

    const master = context.createGain();
    const panner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null;
    const run = this.activeWorkout?.treadmillRun;
    const panSide = Number(run?.footstepPanSide ?? -1) < 0 ? -1 : 1;
    if (run) {
      run.footstepPanSide = panSide * -1;
    }
    if (panner) {
      panner.pan.setValueAtTime(panSide * 0.14, now);
      master.connect(panner);
      panner.connect(context.destination);
    } else {
      master.connect(context.destination);
    }

    const outputGain = THREE.MathUtils.clamp((countdown ? 0.22 : 0.31) * volume * Math.max(0.35, Number(accent) || 1), 0.0001, 0.44);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(outputGain, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(92 + ((safeBpm - 132) * 0.08), now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.12);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.92, now + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(master);

    const slap = context.createBufferSource();
    const slapFilter = context.createBiquadFilter();
    const slapGain = context.createGain();
    slap.buffer = noiseBuffer;
    slapFilter.type = 'lowpass';
    slapFilter.frequency.setValueAtTime(690 + ((safeBpm - 120) * 1.4), now);
    slapFilter.frequency.exponentialRampToValueAtTime(260, now + 0.15);
    slapFilter.Q.setValueAtTime(0.82, now);
    slapGain.gain.setValueAtTime(0.0001, now);
    slapGain.gain.exponentialRampToValueAtTime(0.78, now + 0.006);
    slapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    slap.connect(slapFilter);
    slapFilter.connect(slapGain);
    slapGain.connect(master);

    const grit = context.createBufferSource();
    const gritFilter = context.createBiquadFilter();
    const gritGain = context.createGain();
    grit.buffer = noiseBuffer;
    gritFilter.type = 'highpass';
    gritFilter.frequency.setValueAtTime(1260, now);
    gritFilter.Q.setValueAtTime(0.7, now);
    gritGain.gain.setValueAtTime(0.0001, now);
    gritGain.gain.exponentialRampToValueAtTime(0.24, now + 0.003);
    gritGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    grit.connect(gritFilter);
    gritFilter.connect(gritGain);
    gritGain.connect(master);

    const cleanup = () => {
      try {
        thump.disconnect();
        thumpGain.disconnect();
        slap.disconnect();
        slapFilter.disconnect();
        slapGain.disconnect();
        grit.disconnect();
        gritFilter.disconnect();
        gritGain.disconnect();
        master.disconnect();
        panner?.disconnect();
      } catch {
        // Already disconnected.
      }
    };
    slap.onended = cleanup;
    thump.start(now);
    thump.stop(now + durationSeconds);
    slap.start(now);
    slap.stop(now + durationSeconds);
    grit.start(now);
    grit.stop(now + 0.055);
  }

  playTreadmillTapSound(hitScore = 0) {
    const context = this.getVibeHeroAudioContext();
    if (!context) {
      this.playSoundEffect(this.typingOnKeyboardSound, {
        playbackRate: 0.9 + (Math.max(0, hitScore) * 0.35),
        preservePitch: false,
        volumeScale: 0.32
      });
      return;
    }

    void context.resume?.().catch(() => {});
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = hitScore >= 0.86 ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(hitScore >= 0.86 ? 720 : 290, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(THREE.MathUtils.clamp((hitScore >= 0.86 ? 0.035 : 0.024) * Number(this.gameSettings?.masterVolume ?? 1), 0.0001, 0.07), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
    oscillator.onended = () => {
      try {
        oscillator.disconnect();
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    };
  }

  getTreadmillBeatWindowMs(beat = null) {
    return Math.max(95, Math.min(TREADMILL_RUN_BEAT_WINDOW_MS, Number(beat?.intervalMs ?? TREADMILL_RUN_BEAT_WINDOW_MS) * 0.38));
  }

  startTreadmillScoredRun(run = this.activeWorkout?.treadmillRun) {
    if (!run || run.phase !== 'countdown') {
      return false;
    }

    run.phase = 'playing';
    run.message = 'Match Spacebar taps to the running footstep beat.';
    run.lastGrade = 'ready';
    this.input.clearKeyPressQueue?.();
    this.updateTreadmillRunHud();
    return true;
  }

  recordTreadmillRunTap(now = performance.now()) {
    const run = this.activeWorkout?.treadmillRun;
    if (!run || run.phase !== 'playing') {
      return false;
    }

    const elapsedMs = this.getTreadmillRunElapsed(run, now);
    let closestBeat = null;
    let closestOffsetMs = Infinity;
    for (const beat of run.beats) {
      if (beat.status === 'hit') {
        continue;
      }
      const offsetMs = elapsedMs - beat.timeMs;
      const absOffsetMs = Math.abs(offsetMs);
      const windowMs = this.getTreadmillBeatWindowMs(beat);
      if (absOffsetMs <= windowMs && absOffsetMs < Math.abs(closestOffsetMs)) {
        closestBeat = beat;
        closestOffsetMs = offsetMs;
      }
    }

    let tapScore = 0;
    let grade = 'miss';
    if (closestBeat) {
      const windowMs = this.getTreadmillBeatWindowMs(closestBeat);
      tapScore = Math.max(0, 1 - (Math.abs(closestOffsetMs) / windowMs));
      closestBeat.status = 'hit';
      closestBeat.hitAtMs = elapsedMs;
      closestBeat.hitOffsetMs = closestOffsetMs;
      closestBeat.hitScore = tapScore;
      grade = tapScore >= 0.86 ? 'perfect' : tapScore >= 0.62 ? 'good' : closestOffsetMs < 0 ? 'early' : 'late';
      run.message = grade === 'perfect'
        ? 'Perfect stride.'
        : grade === 'good'
          ? 'Good stride.'
          : closestOffsetMs < 0
            ? 'A little early.'
            : 'A little late.';
    } else {
      run.extraTaps += 1;
      run.message = 'Off beat.';
    }

    run.lastGrade = grade;
    run.taps.push({
      timeMs: elapsedMs,
      score: tapScore,
      grade
    });
    run.score = calculateTreadmillRunScore(run);
    this.playTreadmillTapSound(tapScore);
    this.updateTreadmillRunHud();
    return true;
  }

  updateTreadmillRunBeatState(run = this.activeWorkout?.treadmillRun, now = performance.now(), { playSounds = true } = {}) {
    if (!run) {
      return;
    }

    if (run.phase === 'countdown') {
      const elapsedMs = this.getTreadmillRunCountdownElapsed(run, now);
      const countdownBeats = Array.isArray(run.countdownBeats) ? run.countdownBeats : [];
      while (
        run.nextCountdownSoundBeatIndex < countdownBeats.length
        && elapsedMs >= countdownBeats[run.nextCountdownSoundBeatIndex].timeMs
      ) {
        if (playSounds) {
          this.playTreadmillFootstepSound(countdownBeats[run.nextCountdownSoundBeatIndex].bpm, {
            countdown: true,
            accent: 0.9
          });
        }
        run.nextCountdownSoundBeatIndex += 1;
      }
      return;
    }

    const elapsedMs = this.getTreadmillRunElapsed(run, now);
    while (
      run.nextSoundBeatIndex < run.beats.length
      && elapsedMs >= run.beats[run.nextSoundBeatIndex].timeMs
    ) {
      if (playSounds) {
        this.playTreadmillFootstepSound(run.beats[run.nextSoundBeatIndex].bpm, {
          countdown: false,
          accent: 1
        });
      }
      run.nextSoundBeatIndex += 1;
    }

    for (const beat of run.beats) {
      if (beat.status !== 'pending') {
        continue;
      }
      if (elapsedMs - beat.timeMs > this.getTreadmillBeatWindowMs(beat)) {
        beat.status = 'missed';
      }
    }
    run.score = calculateTreadmillRunScore(run);
  }

  resolveTreadmillRun(now = performance.now()) {
    const run = this.activeWorkout?.treadmillRun;
    if (!run || run.phase === 'result') {
      return false;
    }

    this.updateTreadmillRunBeatState(run, run.startedAt + run.durationMs + TREADMILL_RUN_BEAT_WINDOW_MS + 1, {
      playSounds: false
    });
    run.phase = 'result';
    run.score = calculateTreadmillRunScore(run);
    run.awardXp = run.score > TREADMILL_RUN_REWARD_SCORE;
    run.resultAt = now;
    run.lastGrade = run.awardXp ? 'perfect' : 'miss';
    run.message = run.awardXp
      ? 'Nice Run!'
      : `${run.score}% rhythm. No XP.`;
    this.syncTreadmillRunObjectSpeed(run, now);
    this.stopTreadmillLoopSound();
    this.playSoundEffect(run.awardXp ? this.levelUpSound : this.playingCardSound, {
      playbackRate: run.awardXp ? 1.08 : 0.68,
      preservePitch: false,
      volumeScale: run.awardXp ? 0.45 : 0.5
    });
    this.updateTreadmillRunHud();
    return true;
  }

  updateTreadmillRunHud(now = performance.now()) {
    const run = this.activeWorkout?.treadmillRun;
    const state = this.treadmillRunHudState;
    if (!run) {
      state.visible = false;
      state.game = null;
      this.hud.setTreadmillRunState(state);
      return;
    }

    const elapsedMs = this.getTreadmillRunElapsed(run, now);
    const countdownElapsedMs = this.getTreadmillRunCountdownElapsed(run, now);
    const countdownRemainingMs = Math.max(0, Number(run.countdownMs ?? TREADMILL_RUN_COUNTDOWN_MS) - countdownElapsedMs);
    const countdownBeats = Array.isArray(run.countdownBeats) ? run.countdownBeats : [];
    let nextRunBeat = null;
    let hitCount = 0;
    let missedCount = 0;
    for (const beat of run.beats) {
      if (beat?.status === 'hit') {
        hitCount += 1;
      } else if (beat?.status === 'missed') {
        missedCount += 1;
      } else if (beat?.status === 'pending' && !nextRunBeat) {
        nextRunBeat = beat;
      }
    }
    const nextCountdownBeat = run.phase === 'countdown'
      ? countdownBeats[run.nextCountdownSoundBeatIndex] ?? null
      : null;
    const nextBeatProgress = nextCountdownBeat
      ? THREE.MathUtils.clamp(1 - (Math.abs(nextCountdownBeat.timeMs - countdownElapsedMs) / this.getTreadmillBeatWindowMs(nextCountdownBeat)), 0, 1)
      : nextRunBeat
        ? THREE.MathUtils.clamp(1 - (Math.abs(nextRunBeat.timeMs - elapsedMs) / this.getTreadmillBeatWindowMs(nextRunBeat)), 0, 1)
        : 0;
    const game = this.treadmillRunHudGame;
    game.phase = run.phase;
    game.countdownMs = run.countdownMs ?? TREADMILL_RUN_COUNTDOWN_MS;
    game.countdownElapsedMs = countdownElapsedMs;
    game.countdownRemainingMs = countdownRemainingMs;
    game.durationMs = run.durationMs;
    game.elapsedMs = elapsedMs;
    game.remainingMs = Math.max(0, run.durationMs - elapsedMs);
    game.bpm = this.getTreadmillRunBpm(run, now);
    game.score = run.score;
    game.beatCount = run.beats.length;
    game.hitCount = hitCount;
    game.missedCount = missedCount;
    game.nextBeatProgress = nextBeatProgress;
    game.grade = run.lastGrade;
    game.awardXp = run.awardXp;
    game.rewardScore = TREADMILL_RUN_REWARD_SCORE;
    game.message = run.message;
    state.visible = true;
    state.game = game;
    this.hud.setTreadmillRunState(state);
  }

  handleTreadmillRunAction(action = '') {
    if (action === 'tap') {
      this.recordTreadmillRunTap();
    }
  }

  updateTreadmillRunCamera({ snap = false } = {}) {
    if (!this.player) {
      return;
    }

    const forward = this.getTreadmillRunForward(this.treadmillRunForward);
    const side = this.getTreadmillRunSide(this.treadmillRunSide);
    const targetPosition = this.cameraTargetPosition
      .copy(this.player.position)
      .addScaledVector(forward, -4.6)
      .addScaledVector(side, 2.15);
    targetPosition.y += 2.45;

    const lookTarget = this.cameraLookTarget.copy(this.player.position);
    lookTarget.y += 1.65;
    lookTarget.addScaledVector(forward, 0.45);

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, TREADMILL_RUN_CAMERA_SMOOTHING);
    }
    this.camera.lookAt(lookTarget);
  }

  updateTreadmillRunWorkout(deltaSeconds, options = null) {
    const colliders = options?.colliders ?? EMPTY_COLLIDERS;
    const sceneBounds = options?.sceneBounds ?? null;
    const groundHeight = options?.groundHeight ?? 0;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
    const run = this.activeWorkout?.treadmillRun;
    if (!run || !this.player) {
      return true;
    }

    const bpm = this.getTreadmillRunBpm(run, now);
    const runActive = run.phase === 'countdown' || run.phase === 'playing';
    this.syncTreadmillRunObjectSpeed(run, now);
    const playerUpdateOptions = this.playerUpdateOptions;
    playerUpdateOptions.skateboardOwned = false;
    playerUpdateOptions.vehicleItemId = '';
    playerUpdateOptions.skating = false;
    playerUpdateOptions.speedScale = 1;
    playerUpdateOptions.movementCameraForward = CAMERA_MOVEMENT_FORWARD;
    playerUpdateOptions.stationaryRun = runActive;
    playerUpdateOptions.locomotionMode = undefined;
    playerUpdateOptions.locomotionPlaybackRate = THREE.MathUtils.clamp(bpm / 156, 0.78, 1.45);
    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight,
      playerUpdateOptions
    );

    if (run.phase === 'countdown') {
      this.updateTreadmillRunBeatState(run, now);
      this.input.consume('Space');
      if (now >= run.startedAt) {
        this.startTreadmillScoredRun(run);
        this.updateTreadmillRunBeatState(run, now);
      } else {
        this.updateTreadmillRunHud(now);
      }
      return true;
    }

    if (run.phase === 'playing') {
      this.updateTreadmillRunBeatState(run, now);
      if (this.input.consume('Space')) {
        this.recordTreadmillRunTap(now);
      }
      if (this.getTreadmillRunElapsed(run, now) >= run.durationMs) {
        this.resolveTreadmillRun(now);
      } else {
        this.updateTreadmillRunHud(now);
      }
      return true;
    }

    this.updateTreadmillRunHud(now);
    if (now >= run.resultAt + TREADMILL_RUN_RESULT_HOLD_MS) {
      if (run.awardXp) {
        this.hud.showToast(`Nice Run! Treadmill score ${run.score}%. XP awarded.`);
        this.finishWorkout({ showCompleteToast: false });
      } else {
        this.hud.showToast(`Treadmill score ${run.score}%. No XP awarded.`);
        this.finishWorkout({ awardXp: false, showCompleteToast: false });
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
      BARBELL_BASE_AXIS,
      this.workoutBarbellAxis
    );
    this.activeWorkout.carriedBarbell.quaternion.copy(this.workoutBarbellQuaternion);
  }

  finishWorkout({ cancelled = false, awardXp = true, showCompleteToast = true } = {}) {
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
    if (workout.treadmillRun) {
      this.stopTreadmillLoopSound();
      if (workout.treadmillRun.treadmillObject?.userData) {
        workout.treadmillRun.treadmillObject.userData.treadmillBeltSpeed = 0.9;
      }
    }
    if (workout.activityConfig?.basketballShot) {
      this.hud.setBasketballShotState({ visible: false, game: null });
    }
    if (workout.activityConfig?.treadmillRun) {
      this.hud.setTreadmillRunState({ visible: false, game: null });
    }
    if (placementId) {
      if (cancelled) {
        this.releaseWorkoutPlacement(placementId);
      } else {
        this.completeWorkoutPlacement(placementId, { awardXp });
      }
    }
    if (!cancelled && showCompleteToast) {
      this.hud.showToast(workout.activityConfig?.completeToast ?? 'Workout complete.');
    }
    return true;
  }

  updateActiveWorkout(deltaSeconds, options = null) {
    const localAlive = options?.localAlive;
    const colliders = options?.colliders ?? EMPTY_COLLIDERS;
    const sceneBounds = options?.sceneBounds ?? null;
    const groundHeight = options?.groundHeight ?? 0;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
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
      const moveOptions = this.workoutMoveOptions;
      moveOptions.speedScale = 0.82;
      moveOptions.stopDistance = activityConfig?.stopDistance ?? SNATCH_APPROACH_STOP_DISTANCE;
      const movement = this.player.moveToward(
        this.activeWorkout.interactable.approachPosition,
        deltaSeconds,
        colliders,
        sceneBounds,
        groundHeight,
        moveOptions
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
      return this.updateBasketballShotWorkout(deltaSeconds, options);
    }
    if (activityConfig?.treadmillRun) {
      return this.updateTreadmillRunWorkout(deltaSeconds, options);
    }

    const playerUpdateOptions = this.playerUpdateOptions;
    playerUpdateOptions.skateboardOwned = false;
    playerUpdateOptions.vehicleItemId = '';
    playerUpdateOptions.skating = false;
    playerUpdateOptions.speedScale = 1;
    playerUpdateOptions.movementCameraForward = CAMERA_MOVEMENT_FORWARD;
    playerUpdateOptions.stationaryRun = false;
    playerUpdateOptions.locomotionMode = undefined;
    playerUpdateOptions.locomotionPlaybackRate = undefined;
    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight,
      playerUpdateOptions
    );
    this.syncWorkoutBarbell();

    if (now >= this.activeWorkout.endsAt) {
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
      await this.initializeAuth();
      const playerProfile = await this.resolveStartupPlayerProfile();
      this.markBoot('boot:npc-service:start');
      const npcServicePromise = createNpcService({
        accessToken: this.authService.getAccessToken(),
        displayName: playerProfile.displayName
      });

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
        getWorldMapImage: () => this.worldMapImage,
        isWorldMapImageFresh: (image) => this.isWorldMapImageFreshForCurrentLayout(image),
        requestWorldMapImage: (options) => this.ensureFreshWorldMapImage(options),
        getPassiveTrafficPlayerCollisionTarget: () => this.getPassiveTrafficPlayerCollisionTarget(),
        onPassiveTrafficPlayerCollision: (event) => this.handlePassiveTrafficPlayerCollision(event),
        onToggleBuildMode: () => this.toggleBuildMode(),
        onLayoutChanged: (layout) => {
          this.currentLayout = layout;
          this.invalidateWorldMapLayoutHash();
          this.syncVibeRadioPlaylist();
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
        this.worldBuilder?.setPassiveTrafficServerState(state.passiveTraffic);
        if (this.bootCriticalReady) {
          this.requestDeferredSceneSync({
            pickups: true,
            remotePlayers: true
          });
        }
        this.refreshCarSelectorHud(this.getLocalPlayerState());
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
      this.invalidateWorldMapLayoutHash();
      this.syncVibeRadioPlaylist();
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
        const aliveStateOptions = this.playerAliveStateOptions;
        aliveStateOptions.startedAtMs = Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
          ? localPlayerState.lastDamagedAt
          : 0;
        this.player.setAliveState(localAlive, aliveStateOptions);
        const weaponStateOptions = this.playerWeaponStateOptions;
        weaponStateOptions.visible = localAlive && Boolean(localPlayerState.equippedWeaponId);
        await this.player.setWeaponState(
          localAlive ? localPlayerState.equippedWeaponId : '',
          weaponStateOptions
        );
        const reloadStateOptions = this.playerReloadStateOptions;
        reloadStateOptions.weaponId = localAlive ? localPlayerState.equippedWeaponId : '';
        reloadStateOptions.startedAtMs = 0;
        reloadStateOptions.endsAtMs = localPlayerState.reloadEndsAt ?? 0;
        reloadStateOptions.resetMotion = true;
        this.player.setReloadState(Boolean(localAlive && localPlayerState.isReloading), reloadStateOptions);
      }
      this.applyHotbarSelection({ force: true });
      if (portalSpawnApplied) {
        this.player.setAimingState(false);
        this.updateCamera(this.currentAimDirection, false, { snap: true });
      } else {
        this.syncInitialCameraState(localPlayerState);
      }
      this.resetLocalPlayerKinematics(this.player.position);
      this.rentIntroLoadingClearedAt = performance.now() + RENT_INTRO_LOADING_CLEAR_MS;
      this.primeOpeningRentIntroCutscene();
      this.enableDetailedRendering();
      this.setBootLoadingProgress(0.96, {
        render: true
      });
      this.bootCriticalReady = true;
      void this.startDefaultVibeRadioPlayback();

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
      schoolGeographyGlobe: () => ({
        active: this.schoolGeographyGlobeRenderer?.active === true,
        countryId: this.schoolGeographyGlobeRenderer?.targetCountryId ?? '',
        targetYaw: Number.isFinite(this.schoolGeographyGlobeRenderer?.targetYaw)
          ? this.schoolGeographyGlobeRenderer.targetYaw
          : null
      }),
      schoolGames: () => {
        const ids = [];
        for (const game of listSchoolMicrogames()) {
          ids.push(game.id);
        }
        return ids;
      }
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
    const clampVector = (values, fallback = [0, 0, 0]) => {
      const vector = [];
      for (let index = 0; index < 3; index += 1) {
        vector.push(Number(values?.[index] ?? fallback[index] ?? 0));
      }
      return vector;
    };
    const roundVector = (values) => {
      const vector = [];
      for (let index = 0; index < values.length; index += 1) {
        vector.push(Number(values[index].toFixed(4)));
      }
      return vector;
    };
    const listHeldItemIds = () => {
      const ids = [];
      for (const definition of listHeldItemDefinitions()) {
        ids.push(definition.id);
      }
      return ids;
    };
    const listVibeShaderPresetIds = () => {
      const ids = [];
      for (const preset of VIBE_SHADER_PRESETS) {
        ids.push(preset.id);
      }
      return ids;
    };
    const listVibeShaderPresetSummaries = () => {
      const presets = [];
      for (const preset of VIBE_SHADER_PRESETS) {
        presets.push({ id: preset.id, label: preset.label });
      }
      return presets;
    };
    const getAimPoseDebugFieldKeys = () => {
      const fields = ['punchAimYawOffset'];
      for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
        fields.push(field.key);
      }
      for (const field of PHONE_GRIP_DEBUG_FIELDS) {
        fields.push(field.key);
      }
      return fields;
    };
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
            position: roundVector(profile.position),
            rotation: roundVector(profile.rotation),
            scale: roundVector(profile.scale)
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
          const output = [];
          for (const entry of value) {
            output.push(roundDebugValue(entry));
          }
          return output;
        }

        if (value && typeof value === 'object') {
          const output = {};
          for (const key in value) {
            if (Object.hasOwn(value, key)) {
              output[key] = roundDebugValue(value[key]);
            }
          }
          return output;
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
        items: listHeldItemIds(),
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
            const delta = [deltaX, deltaY, deltaZ];
            const nextPose = [];
            for (let index = 0; index < 3; index += 1) {
              nextPose.push(Number(current[index] ?? 0) + Number(delta[index] ?? 0));
            }
            profile.pose[boneKey] = nextPose;
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
        previewPhoneTexting: () => {
          void this.player.setPhoneTextingActive?.(true);
          this.player.playEmote(TEXTING_EMOTE_ID);
          return printGrip(HELD_ITEM_IDS.phone);
        },
        stopPhoneTexting: () => {
          void this.player.setPhoneTextingActive?.(false);
          const animationState = this.player.getAnimationSyncState?.({});
          if (animationState?.emoteId === TEXTING_EMOTE_ID) {
            this.player.stopEmote?.();
          }
          return true;
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
      globalThis.previewPhoneTexting = (...args) => globalThis.__stickRpgHeldItemDebug.previewPhoneTexting(...args);
      globalThis.stopPhoneTexting = (...args) => globalThis.__stickRpgHeldItemDebug.stopPhoneTexting(...args);
      globalThis.__stickRpgShaderDebug = {
        presets: listVibeShaderPresetSummaries(),
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
        items: listHeldItemIds()
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
        presets: listVibeShaderPresetIds()
      });
    }

    if (adminAimPoseDebug) {
      globalThis.__stickRpgAimPoseDebug = {
        fields: getAimPoseDebugFieldKeys(),
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
        fields: getAimPoseDebugFieldKeys()
      });
    }
  }

  getActiveAimPoseDebugItemId() {
    return this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
  }

  getPhoneGripDebugProfile() {
    return this.player?.getHeldItemGripProfile?.(PHONE_GRIP_DEBUG_ITEM_ID)
      ?? getHeldItemGripProfile(PHONE_GRIP_DEBUG_ITEM_ID);
  }

  getPhoneGripDebugValues(profile = this.getPhoneGripDebugProfile()) {
    const values = {};
    for (const field of PHONE_GRIP_DEBUG_FIELDS) {
      values[field.key] = Number(profile?.[field.group]?.[field.axis] ?? 0);
    }
    return values;
  }

  startPhoneGripDebugPreview() {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return false;
    }

    void this.player.setPhoneTextingActive?.(true);
    this.player.playEmote?.(TEXTING_EMOTE_ID);
    return true;
  }

  stopPhoneGripDebugPreview() {
    if (!this.player) {
      return false;
    }

    void this.player.setPhoneTextingActive?.(false);
    const animationState = this.player.getAnimationSyncState?.({});
    if (animationState?.emoteId === TEXTING_EMOTE_ID) {
      this.player.stopEmote?.();
    }
    return true;
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

    const wasVisible = this.aimPoseDebugVisible;
    this.aimPoseDebugVisible = nextVisible;
    if (nextVisible && this.poseDebugSection === 'phoneGrip') {
      this.startPhoneGripDebugPreview();
    } else if (wasVisible && !nextVisible && this.poseDebugSection === 'phoneGrip') {
      this.stopPhoneGripDebugPreview();
    }
    this.refreshAimPoseDebugHud();
    return this.aimPoseDebugVisible;
  }

  toggleAimPoseDebugPanel() {
    const nextVisible = this.setAimPoseDebugVisible(!this.aimPoseDebugVisible);
    this.hud.showToast(nextVisible ? 'Pose debug opened.' : 'Pose debug hidden.');
    return nextVisible;
  }

  setPoseDebugSection(section = 'unarmed') {
    const nextSection = POSE_DEBUG_SECTIONS.has(section) ? section : 'unarmed';
    if (this.poseDebugSection === nextSection) {
      return this.poseDebugSection;
    }

    const previousSection = this.poseDebugSection;
    this.poseDebugSection = nextSection;
    if (this.aimPoseDebugVisible && nextSection === 'phoneGrip') {
      this.startPhoneGripDebugPreview();
    } else if (this.aimPoseDebugVisible && previousSection === 'phoneGrip') {
      this.stopPhoneGripDebugPreview();
    }
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

    if (PHONE_GRIP_DEBUG_FIELD_BY_KEY.has(fieldKey)) {
      return this.setPhoneGripDebugField(fieldKey, value);
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

  setPhoneGripDebugField(fieldKey, value) {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    const field = PHONE_GRIP_DEBUG_FIELD_BY_KEY.get(fieldKey);
    if (!field) {
      return null;
    }

    const current = this.getPhoneGripDebugProfile();
    const nextProfile = {
      position: cloneNumberVector3(current.position, 0),
      rotation: cloneNumberVector3(current.rotation, 0),
      scale: cloneNumberVector3(current.scale, 1)
    };
    const numericValue = Number(value);
    nextProfile[field.group][field.axis] = Number.isFinite(numericValue)
      ? THREE.MathUtils.clamp(numericValue, field.min, field.max)
      : nextProfile[field.group][field.axis];

    const baseProfile = getHeldItemGripProfile(PHONE_GRIP_DEBUG_ITEM_ID);
    const override = {
      position: [],
      rotation: [],
      scale: []
    };
    for (let index = 0; index < 3; index += 1) {
      override.position.push(nextProfile.position[index] - baseProfile.position[index]);
      override.rotation.push(nextProfile.rotation[index] - baseProfile.rotation[index]);
      override.scale.push((() => {
        const baseScale = baseProfile.scale[index] || 1;
        return nextProfile.scale[index] / baseScale;
      })());
    }
    const updatedProfile = this.player.setHeldItemGripOverride?.(PHONE_GRIP_DEBUG_ITEM_ID, override) ?? null;
    this.startPhoneGripDebugPreview();
    this.refreshAimPoseDebugHud();
    return updatedProfile;
  }

  resetAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (this.poseDebugSection === 'phoneGrip') {
      this.player.clearHeldItemGripOverride?.(PHONE_GRIP_DEBUG_ITEM_ID);
      this.startPhoneGripDebugPreview();
      const nextProfile = this.getPhoneGripDebugProfile();
      this.refreshAimPoseDebugHud();
      this.hud.showToast('Phone grip debug reset.');
      return nextProfile;
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
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (this.poseDebugSection === 'phoneGrip') {
      const grip = this.getPhoneGripDebugProfile();
      const printable = {
        section: 'phoneGrip',
        id: PHONE_GRIP_DEBUG_ITEM_ID,
        gripOffset: {
          position: [],
          rotation: [],
          scale: []
        }
      };
      for (let index = 0; index < grip.position.length; index += 1) {
        printable.gripOffset.position.push(Number(grip.position[index].toFixed(4)));
      }
      for (let index = 0; index < grip.rotation.length; index += 1) {
        printable.gripOffset.rotation.push(Number(grip.rotation[index].toFixed(4)));
      }
      for (let index = 0; index < grip.scale.length; index += 1) {
        printable.gripOffset.scale.push(Number(grip.scale[index].toFixed(4)));
      }
      console.info('[PoseDebug] Current phone grip settings.', printable);
      return printable;
    }

    if (!itemId) {
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
        aimPose: {}
      };
    if (this.poseDebugSection !== 'unarmed') {
      for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
        const fieldValue = Number(pose?.[field.key] ?? 0);
        if (Math.abs(fieldValue) > 0.000001) {
          printable.aimPose[field.key] = Number(fieldValue.toFixed(4));
        }
      }
    }
    console.info('[PoseDebug] Current pose settings.', printable);
    return printable;
  }

  refreshAimPoseDebugHud() {
    const debugAvailable = Boolean(this.player && this.canUseAimPoseDebug());
    const itemId = this.getActiveAimPoseDebugItemId();
    const pose = this.player?.getHeldItemAimPoseProfile(itemId) ?? {};
    const phoneGripProfile = this.getPhoneGripDebugProfile();
    const phoneGripValues = this.getPhoneGripDebugValues(phoneGripProfile);
    const punchFacingOffset = Number(this.player?.getEmoteDebugConfig?.(PUNCH_EMOTE_ID)?.aimYawOffset ?? 0);
    const statusParts = [];
    statusParts.push(this.poseDebugSection === 'phoneGrip' ? `Item: ${PHONE_GRIP_DEBUG_ITEM_ID}` : `Weapon: ${itemId || 'none'}`);
    statusParts.push(`Punch offset: ${punchFacingOffset.toFixed(2)}`);
    if (this.poseDebugSection === 'phoneGrip') {
      const phonePositionParts = [];
      for (const entry of phoneGripProfile.position) {
        phonePositionParts.push(Number(entry).toFixed(3));
      }
      statusParts.push(`Phone pos: ${phonePositionParts.join(', ')}`);
    }
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
      phoneGripValues,
      selectedSection: this.poseDebugSection
    };
    const valueSignatureParts = [punchFacingOffset.toFixed(3)];
    for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
      valueSignatureParts.push(Number(nextState.values?.[field.key] ?? 0).toFixed(3));
    }
    for (const field of PHONE_GRIP_DEBUG_FIELDS) {
      valueSignatureParts.push(Number(phoneGripValues?.[field.key] ?? 0).toFixed(3));
    }
    const valueSignature = valueSignatureParts.join('|');
    const signature = [
      Number(nextState.available),
      Number(nextState.visible),
      Number(nextState.showSkeleton),
      nextState.selectedSection,
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

    const runtime = this.npcRuntimeRenderState;
    const npcs = this.npcServiceState.npcs;
    const idsToRemove = this.npcRuntimeRenderIdsToRemove;
    idsToRemove.length = 0;
    for (const npcId of runtime.keys()) {
      if (!npcs.has(npcId)) {
        idsToRemove.push(npcId);
      }
    }
    for (const npcId of idsToRemove) {
      runtime.delete(npcId);
    }

    for (const npcId of npcs.keys()) {
      const npc = npcs.get(npcId);
      let entry = runtime.get(npcId);
      if (!entry) {
        entry = {};
        runtime.set(npcId, entry);
      }
      entry.x = npc.position?.[0] ?? npc.x;
      entry.z = npc.position?.[1] ?? npc.z;
      entry.rotationY = npc.rotationY ?? (npc.rotationQuarterTurns * (Math.PI / 2));
      entry.interactRadius = npc.interactRadius;
      entry.gymCheckInEnabled = npc.gymCheckInEnabled === true;
      entry.stockMarketEnabled = npc.stockMarketEnabled === true;
      entry.bartenderEnabled = npc.bartenderEnabled === true;
      entry.pawnShopOwnerEnabled = npc.pawnShopOwnerEnabled === true;
      entry.carDealerEnabled = npc.carDealerEnabled === true;
      entry.blackjackDealerEnabled = npc.blackjackDealerEnabled === true;
      entry.busy = npc.busy;
      entry.mode = npc.mode;
      entry.activity = npc.activity;
      entry.targetPlacementId = npc.targetPlacementId || '';
      entry.alive = npc.alive !== false;
      entry.lastDamagedAt = npc.lastDamagedAt ?? 0;
      entry.respawnAt = npc.respawnAt ?? 0;
      entry.snap = false;
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
    this.worldBuilder.setNpcDebugState(this.npcServiceState.npcDebug ?? EMPTY_NPC_DEBUG_STATE);
  }

  updateNpcFocusTargets() {
    if (!this.worldBuilder) {
      return;
    }

    const focusTargets = this.npcFocusTargets;
    focusTargets.clear();
    for (const npcId of this.npcServiceState.npcs.keys()) {
      const npc = this.npcServiceState.npcs.get(npcId);
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

    if (!this.rememberNpcFocusTargetsIfChanged(focusTargets)) {
      return;
    }

    this.worldBuilder.setNpcFocusTargets(focusTargets.size ? focusTargets : EMPTY_NPC_FOCUS_TARGETS);
  }

  rememberNpcFocusTargetsIfChanged(focusTargets) {
    const previousTargets = this.lastNpcFocusTargetStates;
    if (!focusTargets?.size) {
      if (!previousTargets.size) {
        return false;
      }
      previousTargets.clear();
      return true;
    }

    let changed = previousTargets.size !== focusTargets.size;
    for (const npcId of focusTargets.keys()) {
      const target = focusTargets.get(npcId);
      const roundedX = Math.round(Number(target?.x) * 20);
      const roundedZ = Math.round(Number(target?.z) * 20);
      const x = Number.isFinite(roundedX) ? roundedX : 0;
      const z = Number.isFinite(roundedZ) ? roundedZ : 0;
      const previousTarget = previousTargets.get(npcId);
      if (!previousTarget) {
        previousTargets.set(npcId, { x, z });
        changed = true;
        continue;
      }
      if (previousTarget.x !== x || previousTarget.z !== z) {
        previousTarget.x = x;
        previousTarget.z = z;
        changed = true;
      }
    }

    const idsToRemove = this.npcFocusTargetIdsToRemove;
    idsToRemove.length = 0;
    for (const npcId of previousTargets.keys()) {
      if (!focusTargets.has(npcId)) {
        idsToRemove.push(npcId);
      }
    }
    if (idsToRemove.length > 0) {
      changed = true;
      for (let index = 0; index < idsToRemove.length; index += 1) {
        previousTargets.delete(idsToRemove[index]);
      }
      idsToRemove.length = 0;
    }

    return changed;
  }

  captureAvatarSnapshot(avatar, fallbackState = null, overrides = {}) {
    const fallbackX = Number(fallbackState?.x ?? 0);
    const fallbackY = Number(fallbackState?.y ?? 0);
    const fallbackZ = Number(fallbackState?.z ?? 0);
    const fallbackRotationY = Number(fallbackState?.rotationY ?? 0);
    const fallbackAimRotationY = Number(fallbackState?.aimRotationY ?? fallbackRotationY);

    return {
      x: Number.isFinite(overrides.x) ? overrides.x : (avatar?.position.x ?? fallbackX),
      z: Number.isFinite(overrides.z) ? overrides.z : (avatar?.position.z ?? fallbackZ),
      y: Number.isFinite(overrides.y) ? overrides.y : (avatar?.position.y ?? fallbackY),
      rotationY: Number.isFinite(overrides.rotationY) ? overrides.rotationY : (avatar?.object.rotation.y ?? fallbackRotationY),
      aimRotationY: Number.isFinite(overrides.aimRotationY) ? overrides.aimRotationY : (avatar?.getAimRotation?.() ?? fallbackAimRotationY),
      aiming: overrides.aiming ?? fallbackState?.aiming ?? false
    };
  }

  getRemotePlayerGroundHeight(playerState = null, targetPosition = null) {
    const stateY = Number(playerState?.y);
    if (Number.isFinite(stateY)) {
      return stateY;
    }

    const activeGroundHeight = targetPosition
      ? this.getActiveGroundHeightAt(targetPosition)
      : null;
    if (Number.isFinite(activeGroundHeight)) {
      return activeGroundHeight;
    }

    const fallbackY = Number(targetPosition?.y);
    return Number.isFinite(fallbackY) ? fallbackY : 0;
  }

  applyAvatarSnapshot(avatar, snapshot, playerState = null) {
    const targetPosition = new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z);
    const groundHeight = this.getRemotePlayerGroundHeight(playerState, targetPosition);
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
    this.setPhoneTextingMode(this.phoneMenuVisible, { force: true });
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
    for (const sessionId of this.npcServiceState.players.keys()) {
      const playerState = this.npcServiceState.players.get(sessionId);
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
    for (const sessionId of this.remotePlayers.keys()) {
      const avatar = this.remotePlayers.get(sessionId);
      const state = this.npcServiceState.players.get(sessionId);
      if (!state) {
        continue;
      }

      const stateY = Number(state.y);
      const groundProbeY = Number.isFinite(stateY) ? stateY : avatar.position.y;
      const groundProbe = this.remotePlayerGroundProbe.set(state.x, groundProbeY, state.z);
      const groundHeight = this.getRemotePlayerGroundHeight(state, groundProbe);
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
    for (const pickupId of this.npcServiceState.pickups.keys()) {
      const pickup = this.npcServiceState.pickups.get(pickupId);
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
    for (const pickupId of this.pickupVisuals.keys()) {
      const visual = this.pickupVisuals.get(pickupId);
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

  getAnimatedMoneyAmount(targetAmount, now = performance.now()) {
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

  syncMoneyHud(targetAmount, now = performance.now()) {
    const amount = this.getAnimatedMoneyAmount(targetAmount, now);
    const wallet = this.getActiveStockMarketSnapshot();
    const portfolioValue = normalizeMoneyAmount(wallet?.portfolioValue ?? 0);
    const moneyHudState = this.moneyHudState;
    moneyHudState.amount = amount;
    moneyHudState.netWorth = amount + portfolioValue;
    moneyHudState.stockProfit = this.getStockUnrealizedProfit(wallet);
    this.hud.setMoneyState(moneyHudState);
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
    this.updateRentIntroCutsceneCamera(0);
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
    let previous = runtime.get(cutscene.npcId);
    if (!previous) {
      previous = {};
      runtime.set(cutscene.npcId, previous);
    }
    previous.x = npcPosition.x;
    previous.z = npcPosition.z;
    previous.rotationY = Math.atan2(this.player.position.x - npcPosition.x, this.player.position.z - npcPosition.z);
    previous.mode = 'routine';
    previous.activity = '';
    previous.busy = false;
    previous.alive = true;
    previous.snap = true;
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
    this.setLocalPlayerSkateboardState(undefined, false, undefined);

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

  primeOpeningRentIntroCutscene() {
    if (this.rentIntroCutscene) {
      return true;
    }

    const localPlayerState = this.getLocalPlayerState();
    if (localPlayerState) {
      this.maybeStartRentIntro(localPlayerState);
    }

    if (!this.pendingRentIntro || !this.player) {
      return false;
    }

    if (this.rentIntroLoadingClearedAt <= 0) {
      this.rentIntroLoadingClearedAt = performance.now() + RENT_INTRO_LOADING_CLEAR_MS;
    }

    return this.startRentIntroCutscene(this.pendingRentIntro);
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
    let writeIndex = 0;
    this.moneyFloaterAnchor.set(
      this.player.position.x,
      this.player.position.y + 3.3,
      this.player.position.z
    );
    const projected = this.projectSpeechAnchor(this.moneyFloaterAnchor);

    for (let readIndex = 0; readIndex < this.moneyFloaters.length; readIndex += 1) {
      const floater = this.moneyFloaters[readIndex];
      const progress = (now - floater.startedAt) / floater.durationMs;
      if (progress >= 1) {
        continue;
      }

      this.moneyFloaters[writeIndex] = floater;
      writeIndex += 1;
      if (!projected) {
        continue;
      }

      const eased = easeOutCubic(progress);
      const driftX = Math.sin(progress * Math.PI) * 16;
      bubbles.push(this.writeSpeechBubbleRecord(
        `money-floater:${floater.id}`,
        formatMoneyDelta(floater.amount),
        '',
        'money',
        'done',
        projected.x + driftX,
        projected.y - 18 - (eased * 70),
        false,
        '',
        null,
        1,
        '',
        floater.amount >= 0 ? 'positive' : 'negative',
        Math.max(0, 1 - (progress * 1.12))
      ));
    }

    this.moneyFloaters.length = writeIndex;
  }

  addSkillXpFloaterBubbles(bubbles) {
    if (!this.skillXpFloaters.length || !this.player) {
      return;
    }

    const now = performance.now();
    let writeIndex = 0;
    this.skillXpFloaterAnchor.set(
      this.player.position.x,
      this.player.position.y + 3.95,
      this.player.position.z
    );
    const projected = this.projectSpeechAnchor(this.skillXpFloaterAnchor);

    for (let readIndex = 0; readIndex < this.skillXpFloaters.length; readIndex += 1) {
      const floater = this.skillXpFloaters[readIndex];
      const progress = (now - floater.startedAt) / floater.durationMs;
      if (progress >= 1) {
        continue;
      }

      this.skillXpFloaters[writeIndex] = floater;
      writeIndex += 1;
      if (!projected) {
        continue;
      }

      const eased = easeOutCubic(progress);
      const arc = Math.sin(progress * Math.PI);
      const driftX = (Math.sin(progress * Math.PI * 1.35) * 18) + (arc * 10);
      bubbles.push(this.writeSpeechBubbleRecord(
        `skill-xp-floater:${floater.id}`,
        `+${floater.amount.toLocaleString('en-US')} ${floater.emoji}`,
        '',
        'xp',
        'done',
        projected.x + driftX,
        projected.y - 28 - (eased * 86) - (arc * 8),
        false,
        '',
        null,
        1,
        '',
        '',
        Math.max(0, 1 - (progress * 1.08))
      ));
    }

    this.skillXpFloaters.length = writeIndex;
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

  getMovementFrameSummary(options = null) {
    const force = options?.force === true;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
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

  updateAdaptiveRenderQuality(frameSummary = this.getMovementFrameSummary(), now = performance.now()) {
    if (!this.detailedRenderingEnabled || frameSummary.sampleCount < ADAPTIVE_RENDER_SAMPLE_MIN_COUNT) {
      return;
    }

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

  syncLocalPlayerState(localPlayerState, deltaSeconds = 0, now = performance.now()) {
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
    const distanceSq = distanceSquared2D(
      this.player.position.x,
      this.player.position.z,
      targetPosition.x,
      targetPosition.z
    );
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
    const portalSpawnLocked = now < this.portalSpawnLockUntil && !respawned && !died;

    if (this.currentInterior?.scene && (died || respawned || !isAlive)) {
      this.exitInterior({ showToast: false });
    }

    if (this.activeInlineShell && (died || respawned || !isAlive)) {
      this.deactivateInlineShell();
    }

    const groundHeight = this.getActiveGroundHeightAt(targetPosition);
    if (!portalSpawnLocked && distanceSq <= LOCAL_AUTHORITATIVE_PORTAL_UNLOCK_DISTANCE_SQ) {
      this.portalSpawnLockUntil = 0;
    }

    let snappedToAuthoritativePosition = false;
    if (
      (!this.currentInterior?.scene)
      && !portalSpawnLocked
      && !skipStaleAuthoritativePosition
      && (!this.localStateInitialized || respawned || died || distanceSq > LOCAL_AUTHORITATIVE_HARD_SNAP_DISTANCE_SQ)
    ) {
      this.player.position.set(localPlayerState.x, groundHeight, localPlayerState.z);
      snappedToAuthoritativePosition = true;
    } else if (
      isAlive
      && !this.currentInterior?.scene
      && !portalSpawnLocked
      && !skipStaleAuthoritativePosition
      && distanceSq > LOCAL_AUTHORITATIVE_SOFT_RECONCILE_DISTANCE_SQ
      && (
        authoritativeSample.staleMs >= LOCAL_AUTHORITATIVE_STALE_RECONCILE_MS
        || distanceSq > LOCAL_AUTHORITATIVE_ACTIVE_RECONCILE_DISTANCE_SQ
      )
    ) {
      this.gentlyReconcileLocalPlayerPosition(targetPosition, groundHeight, deltaSeconds);
    }

    const aliveStateOptions = this.playerAliveStateOptions;
    aliveStateOptions.startedAtMs = Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
      ? localPlayerState.lastDamagedAt
      : 0;
    this.player.setAliveState(isAlive, aliveStateOptions);
    const localDrunknessLevel = isAlive ? Math.max(0, Math.floor(Number(localPlayerState.drunknessLevel) || 0)) : 0;
    this.player.setDrunknessLevel(localDrunknessLevel);
    this.syncDeliveryPackageVisual(localPlayerState);
    const drunknessHudState = this.drunknessHudState;
    drunknessHudState.level = localDrunknessLevel;
    this.hud.setDrunknessState(drunknessHudState);
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
    const weaponStateOptions = this.playerWeaponStateOptions;
    weaponStateOptions.visible = isAlive && Boolean(displayedWeaponId) && !this.phoneMenuVisible;
    this.player.setWeaponState(
      displayedWeaponId,
      weaponStateOptions
    );
    const reloadStateOptions = this.playerReloadStateOptions;
    reloadStateOptions.weaponId = localWeaponId;
    reloadStateOptions.startedAtMs = 0;
    reloadStateOptions.endsAtMs = localPlayerState.reloadEndsAt ?? 0;
    reloadStateOptions.resetMotion = true;
    this.player.setReloadState(Boolean(isAlive && localPlayerState.isReloading), reloadStateOptions);

    this.maybeStartRentIntro(localPlayerState);
    this.updateRentIntroPresentation();
    this.maybeAnimateMoneyChange(localPlayerState.money ?? 0);
    this.syncMoneyHud(this.getRentIntroMoneyTargetAmount(localPlayerState.money ?? 0), now);
    this.syncPlayerBoundItemsHud(localPlayerState);
    if (this.carSelectorVisible || this.carSelectorRequestInFlight) {
      this.refreshCarSelectorHud(localPlayerState);
    }

    const combatHudState = this.combatHudState;
    combatHudState.visible = true;
    combatHudState.health = localPlayerState.health ?? PLAYER_MAX_HEALTH;
    combatHudState.maxHealth = localPlayerState.maxHealth ?? PLAYER_MAX_HEALTH;
    combatHudState.ammoInClip = localPlayerState.ammoInClip ?? 0;
    combatHudState.reserveAmmo = localPlayerState.reserveAmmo ?? 0;
    combatHudState.isReloading = Boolean(localPlayerState.isReloading);
    combatHudState.reloadEndsAt = localPlayerState.reloadEndsAt ?? 0;
    combatHudState.alive = isAlive;
    combatHudState.respawnAt = localPlayerState.respawnAt ?? 0;
    combatHudState.kills = localPlayerState.kills ?? 0;
    combatHudState.deaths = localPlayerState.deaths ?? 0;
    combatHudState.armed = Boolean(localPlayerState.equippedWeaponId && !this.getSelectedHotbarDrinkItemId() && !this.getSelectedHotbarConsumableItemId());
    this.hud.setCombatState(combatHudState);
    this.syncTaskHud(localPlayerState);
    this.syncSkillProgress(localPlayerState);
    if (this.phoneMenuVisible) {
      if (this.phoneActiveAppId === 'wallet') {
        this.refreshPhoneWalletHud();
      } else if (this.phoneActiveAppId === 'stocks') {
        this.refreshPhoneStocksHud();
      }
      if (this.phoneActiveAppId === 'map') {
        this.refreshPhoneMapHud(localPlayerState);
      }
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
    if (this.firstPersonModeActive && this.canUseFirstPersonMode()) {
      return this.getFirstPersonHorizontalDirection(target);
    }

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
        const npcAnchor = this.worldBuilder?.getNpcSpeechAnchor?.(event.targetId)
          ?? this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
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
      const npcAnchor = this.worldBuilder?.getNpcSpeechAnchor?.(event.targetId)
        ?? this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
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

  createProjectileEffectInstance() {
    const trailPositions = new Float32Array(6);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const material = this.muzzleFlashResources.tracerMaterialTemplate.clone();
    const trail = new THREE.Line(trailGeometry, material);
    trail.frustumCulled = false;
    trail.visible = false;
    return {
      type: 'projectile',
      object: trail,
      trail,
      trailGeometry,
      trailPositions,
      material,
      startX: 0,
      startY: 0,
      startZ: 0,
      directionX: 0,
      directionY: 0,
      directionZ: 1,
      distance: 0,
      startedAt: 0,
      expiresAt: 0
    };
  }

  acquireProjectileEffect() {
    return this.projectileEffectPool.pop() ?? this.createProjectileEffectInstance();
  }

  createImpactEffectInstance(kind = 'world') {
    const impactKind = kind === 'player' ? 'player' : 'world';
    const resources = this.muzzleFlashResources;
    if (impactKind === 'player') {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        resources.impactPlayerCoreGeometry,
        resources.impactPlayerCoreMaterialTemplate.clone()
      );
      const spark = new THREE.Mesh(
        resources.impactPlayerSparkGeometry,
        resources.impactPlayerSparkMaterialTemplate.clone()
      );
      const ring = new THREE.Mesh(
        resources.impactPlayerRingGeometry,
        resources.impactPlayerRingMaterialTemplate.clone()
      );
      ring.rotation.x = Math.PI / 2;
      group.add(core);
      group.add(spark);
      group.add(ring);
      group.visible = false;
      return {
        type: 'impact',
        impactKind,
        object: group,
        core,
        spark,
        ring,
        startAt: 0,
        expiresAt: 0
      };
    }

    const object = new THREE.Mesh(
      resources.impactWorldGeometry,
      resources.impactWorldMaterialTemplate.clone()
    );
    object.visible = false;
    return {
      type: 'impact',
      impactKind,
      object,
      material: object.material,
      startAt: 0,
      expiresAt: 0
    };
  }

  acquireImpactEffect(kind = 'world') {
    const impactKind = kind === 'player' ? 'player' : 'world';
    const pool = this.impactEffectPools[impactKind];
    return pool.pop() ?? this.createImpactEffectInstance(impactKind);
  }

  createMuzzleFlashEffectInstance() {
    const resources = this.muzzleFlashResources;
    const flashGroup = new THREE.Group();
    flashGroup.visible = false;
    const flashMaterial = resources.flashMaterialTemplate.clone();
    const flareMaterial = resources.flareMaterialTemplate.clone();
    const emberMaterial = resources.emberMaterialTemplate.clone();

    const core = new THREE.Mesh(resources.coreGeometry, flashMaterial);
    const plume = new THREE.Mesh(resources.plumeGeometry, flareMaterial);
    const bloom = new THREE.Mesh(resources.bloomGeometry, flareMaterial.clone());
    const emberShell = new THREE.Mesh(resources.emberShellGeometry, emberMaterial);
    const shockRing = new THREE.Mesh(resources.shockRingGeometry, flareMaterial.clone());
    const sideFlareA = new THREE.Mesh(resources.sideFlareAGeometry, flareMaterial.clone());
    const sideFlareB = new THREE.Mesh(resources.sideFlareBGeometry, emberMaterial.clone());

    const sparks = new Array(resources.sparkGeometries.length);
    for (let index = 0; index < resources.sparkGeometries.length; index += 1) {
      sparks[index] = new THREE.Mesh(
        resources.sparkGeometries[index],
        resources.sparkMaterialTemplate.clone()
      );
    }

    const light = new THREE.PointLight(0xff7a24, 2.4, 5.3, 2);
    flashGroup.add(core);
    flashGroup.add(plume);
    flashGroup.add(bloom);
    flashGroup.add(emberShell);
    flashGroup.add(shockRing);
    flashGroup.add(sideFlareA);
    flashGroup.add(sideFlareB);
    for (let index = 0; index < sparks.length; index += 1) {
      flashGroup.add(sparks[index]);
    }
    flashGroup.add(light);

    const effect = {
      type: 'muzzleFlash',
      object: flashGroup,
      core,
      plume,
      bloom,
      emberShell,
      shockRing,
      sideFlareA,
      sideFlareB,
      sparks,
      sparkOffsets: resources.sparkOffsets,
      light,
      startedAt: 0,
      expiresAt: 0
    };
    this.resetMuzzleFlashEffect(effect);
    return effect;
  }

  acquireMuzzleFlashEffect() {
    return this.muzzleFlashEffectPool.pop() ?? this.createMuzzleFlashEffectInstance();
  }

  resetMuzzleFlashEffect(effect) {
    if (!effect) {
      return;
    }

    effect.object.visible = true;
    effect.object.scale.setScalar(1);
    effect.core.scale.setScalar(1);
    effect.plume.position.y = 0.3;
    effect.plume.scale.setScalar(1);
    effect.bloom.position.y = 0.12;
    effect.bloom.scale.set(0.95, 0.54, 0.95);
    effect.emberShell.position.y = 0.08;
    effect.emberShell.scale.set(1.08, 0.42, 1.08);
    effect.shockRing.position.y = 0.12;
    effect.shockRing.rotation.set(Math.PI / 2, 0, 0);
    effect.shockRing.scale.setScalar(1);
    effect.sideFlareA.position.set(0.08, 0.2, 0.02);
    effect.sideFlareA.rotation.set(0, 0, 0.68);
    effect.sideFlareA.scale.setScalar(1);
    effect.sideFlareB.position.set(-0.075, 0.18, -0.03);
    effect.sideFlareB.rotation.set(0, 0, -0.78);
    effect.sideFlareB.scale.setScalar(1);
    for (let index = 0; index < effect.sparks.length; index += 1) {
      const spark = effect.sparks[index];
      const offset = effect.sparkOffsets[index];
      spark.position.set(offset.x, offset.y, offset.z);
      spark.rotation.set(0, 0, offset.zRot);
      spark.scale.setScalar(1);
      spark.material.opacity = 0.95;
    }
    effect.core.material.opacity = 0.98;
    effect.bloom.material.opacity = 0.72;
    effect.emberShell.material.opacity = 0.62;
    effect.shockRing.material.opacity = 0.66;
    effect.sideFlareA.material.opacity = 0.74;
    effect.sideFlareB.material.opacity = 0.55;
    effect.plume.material.opacity = 0.88;
    effect.light.position.y = 0.18;
    effect.light.intensity = 2.4;
  }

  disposeCombatEffect(effect) {
    if (effect?.type === 'muzzleFlash' || effect?.type === 'impact') {
      disposeObjectMaterials(effect.object);
      return;
    }

    disposeObjectResources(effect?.object);
  }

  releaseCombatEffect(effect) {
    effect?.object?.parent?.remove(effect.object);
    if (effect?.trail && effect.trail !== effect.object) {
      effect.trail.parent?.remove(effect.trail);
    }
    if (effect?.object) {
      effect.object.visible = false;
    }

    if (effect?.type === 'projectile') {
      if (this.projectileEffectPool.length < PROJECTILE_EFFECT_POOL_LIMIT) {
        this.projectileEffectPool.push(effect);
        return;
      }
    } else if (effect?.type === 'muzzleFlash') {
      if (this.muzzleFlashEffectPool.length < MUZZLE_FLASH_EFFECT_POOL_LIMIT) {
        this.muzzleFlashEffectPool.push(effect);
        return;
      }
    } else if (effect?.type === 'impact') {
      const impactKind = effect.impactKind === 'player' ? 'player' : 'world';
      const pool = this.impactEffectPools[impactKind];
      if (pool.length < IMPACT_EFFECT_POOL_LIMIT) {
        pool.push(effect);
        return;
      }
    }

    this.disposeCombatEffect(effect);
  }

  createTracerEffect(start, end) {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const deltaZ = end.z - start.z;
    const distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY) + (deltaZ * deltaZ));
    if (distance <= 0.001) {
      return;
    }

    const inverseDistance = 1 / distance;
    const effect = this.acquireProjectileEffect();
    const positions = effect.trailPositions;
    positions[0] = start.x;
    positions[1] = start.y;
    positions[2] = start.z;
    positions[3] = start.x;
    positions[4] = start.y;
    positions[5] = start.z;
    effect.trailGeometry.attributes.position.needsUpdate = true;
    effect.material.opacity = 0.92;
    effect.object.visible = true;
    effect.startX = start.x;
    effect.startY = start.y;
    effect.startZ = start.z;
    effect.directionX = deltaX * inverseDistance;
    effect.directionY = deltaY * inverseDistance;
    effect.directionZ = deltaZ * inverseDistance;
    effect.distance = distance;
    const durationMs = THREE.MathUtils.clamp(
      (distance / PROJECTILE_VISUAL_SPEED) * 1000,
      PROJECTILE_MIN_LIFETIME_MS,
      PROJECTILE_MAX_LIFETIME_MS
    );
    const now = performance.now();
    effect.startedAt = now;
    effect.expiresAt = now + durationMs;
    this.scene.add(effect.object);
    this.combatEffects.push(effect);
  }

  createImpactEffect(position, kind = 'world', delayMs = 0) {
    const now = performance.now();
    const impactKind = kind === 'player' ? 'player' : 'world';
    const effect = this.acquireImpactEffect(impactKind);
    const object = effect.object;
    object.parent?.remove(object);
    object.position.copy(position);
    object.scale.setScalar(1);
    object.visible = delayMs <= 0;
    if (impactKind === 'player') {
      effect.core.scale.setScalar(1);
      effect.core.material.opacity = 0.92;
      effect.spark.position.set(0, 0, 0);
      effect.spark.rotation.set(0, 0, 0);
      effect.spark.scale.setScalar(1);
      effect.spark.material.opacity = 0.85;
      effect.ring.position.set(0, 0, 0);
      effect.ring.rotation.set(Math.PI / 2, 0, 0);
      effect.ring.scale.setScalar(1);
      effect.ring.material.opacity = 0.8;
    } else {
      effect.material.opacity = 0.9;
    }
    effect.startAt = now + delayMs;
    effect.expiresAt = now + delayMs + IMPACT_EFFECT_LIFETIME_MS;
    this.scene.add(object);
    this.combatEffects.push(effect);
  }

  createMuzzleFlashEffect(avatar, start, end) {
    const direction = this.muzzleFlashDirection.copy(end).sub(start);
    if (direction.lengthSq() <= 0.0001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    const effect = this.acquireMuzzleFlashEffect();
    const flashGroup = effect.object;
    flashGroup.parent?.remove(flashGroup);
    this.resetMuzzleFlashEffect(effect);
    const attachmentNode = avatar?.getAttachmentPointNode?.('muzzle') ?? null;
    if (attachmentNode) {
      const parentWorldQuaternion = attachmentNode.getWorldQuaternion(this.muzzleFlashParentQuaternion);
      const localDirection = this.muzzleFlashLocalDirection.copy(direction).applyQuaternion(parentWorldQuaternion.invert()).normalize();
      flashGroup.position.copy(localDirection).multiplyScalar(0.04);
      flashGroup.quaternion.setFromUnitVectors(EFFECT_UP, localDirection);
      attachmentNode.add(flashGroup);
    } else {
      flashGroup.position.copy(start).addScaledVector(direction, 0.04);
      flashGroup.quaternion.setFromUnitVectors(EFFECT_UP, direction);
      this.scene.add(flashGroup);
    }

    const now = performance.now();
    effect.startedAt = now;
    effect.expiresAt = now + MUZZLE_FLASH_LIFETIME_MS;
    this.combatEffects.push(effect);
  }

  updateCombatEffects(now = performance.now()) {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.combatEffects.length; readIndex += 1) {
      const effect = this.combatEffects[readIndex];
      if (now >= effect.expiresAt) {
        this.releaseCombatEffect(effect);
        continue;
      }

      if (effect.type === 'projectile') {
        const lifetime = Math.max(1, effect.expiresAt - effect.startedAt);
        const progress = THREE.MathUtils.clamp((now - effect.startedAt) / lifetime, 0, 1);
        if (effect.trail && effect.trailGeometry) {
          const travelledDistance = effect.distance * progress;
          const tailDistance = Math.max(0, travelledDistance - PROJECTILE_TRAIL_LENGTH);
          const positions = effect.trailPositions;
          if (positions) {
            positions[0] = effect.startX + effect.directionX * tailDistance;
            positions[1] = effect.startY + effect.directionY * tailDistance;
            positions[2] = effect.startZ + effect.directionZ * tailDistance;
            positions[3] = effect.startX + effect.directionX * travelledDistance;
            positions[4] = effect.startY + effect.directionY * travelledDistance;
            positions[5] = effect.startZ + effect.directionZ * travelledDistance;
            effect.trailGeometry.attributes.position.needsUpdate = true;
          }
        }
        effect.material.opacity = THREE.MathUtils.lerp(0.92, 0.18, progress);
      } else if (effect.type === 'impact') {
        if (now < effect.startAt) {
          this.combatEffects[writeIndex] = effect;
          writeIndex += 1;
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

        for (let index = 0; index < effect.sparks.length; index += 1) {
          const spark = effect.sparks[index];
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
        for (let index = 0; index < effect.sparks.length; index += 1) {
          const spark = effect.sparks[index];
          spark.material.opacity = Math.max(0, 0.95 - progress * (1.2 + index * 0.14));
        }
        effect.light.intensity = 2.4 * Math.max(0, 1 - progress * 1.28);
      }
      this.combatEffects[writeIndex] = effect;
      writeIndex += 1;
    }
    this.combatEffects.length = writeIndex;
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
          const punchComboStep = event.attackType === 'punch'
            ? normalizePunchComboStep(event.comboStep)
            : PUNCH_COMBO_JAB_STEP;
          const punchIsFinisher = event.attackType === 'punch' && punchComboStep === PUNCH_COMBO_UPPERCUT_STEP;
          const punchIsHook = event.attackType === 'punch' && punchComboStep === PUNCH_COMBO_HOOK_STEP;
          const punchImpactStrength = event.attackType === 'punch'
            ? getPunchComboImpactStrength(punchComboStep)
            : 1;
          this.createImpactEffect(point, event.kind, delayMs);
          if (event.attackType === 'punch' && (event.kind === 'player' || event.kind === 'npc')) {
            this.playRandomSoundEffect(this.punchImpactSounds, {
              volumeScale: (event.shooterId === this.npcServiceState.sessionId ? 1 : 0.72) * (punchIsFinisher ? 1.2 : punchIsHook ? 1.12 : 1),
              playbackRateMin: punchIsFinisher ? 0.78 : punchIsHook ? 0.84 : 0.96,
              playbackRateMax: punchIsFinisher ? 0.9 : punchIsHook ? 0.96 : 1.07,
              preservePitch: false,
              delayMs
            });
          }
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

              targetAvatar?.triggerDamageFeedback?.({
                direction: damageDirection,
                hitReaction: event.attackType === 'punch' ? event.hitReaction : '',
                strength: punchImpactStrength
              });
              if (event.targetId === this.npcServiceState.sessionId) {
                this.triggerDamageCameraFeedback(damageDirection, { strength: punchIsFinisher ? 1.32 : punchIsHook ? 1.18 : 1 });
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
              this.worldBuilder?.triggerNpcDamageFeedback(event.targetId, {
                direction: damageDirection,
                hitReaction: event.attackType === 'punch' ? event.hitReaction : '',
                strength: punchImpactStrength
              });
            };

            if (delayMs > 0) {
              window.setTimeout(runFeedback, delayMs);
            } else {
              runFeedback();
            }
          }
        }
        if ((event.kind === 'player' || event.kind === 'npc') && event.shooterId === this.npcServiceState.sessionId) {
          const hitMarkerMs = event.attackType === 'punch' && normalizePunchComboStep(event.comboStep) === PUNCH_COMBO_HOOK_STEP
            ? 160
            : event.attackType === 'punch' && normalizePunchComboStep(event.comboStep) === PUNCH_COMBO_UPPERCUT_STEP
              ? 190
              : 120;
          this.hitMarkerUntil = performance.now() + hitMarkerMs;
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
    if (
      !force
      && info.status === this.lastConnectionHudStatus
      && info.label === this.lastConnectionHudLabel
      && info.detail === this.lastConnectionHudDetail
      && (info.activePlayerCount ?? null) === this.lastConnectionHudActivePlayerCount
    ) {
      return;
    }

    const previousStatus = this.lastConnectionToastStatus;
    this.lastConnectionHudStatus = info.status;
    this.lastConnectionHudLabel = info.label;
    this.lastConnectionHudDetail = info.detail;
    this.lastConnectionHudActivePlayerCount = info.activePlayerCount ?? null;
    this.hud.setConnectionStatus(info);

    if (info.status === this.lastConnectionToastStatus) {
      return;
    }

    this.lastConnectionToastStatus = info.status;
    if (
      info.status === 'reconnecting'
      || info.status === 'rejoining'
      || info.status === 'updating'
      || info.status === 'offline'
    ) {
      this.hud.showToast(info.detail);
    } else if (
      info.status === 'online'
      && previousStatus
      && previousStatus !== 'online'
      && previousStatus !== 'local'
      && previousStatus !== 'update-ready'
    ) {
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

  processPendingFrontendReload(now = performance.now()) {
    if (this.releaseReloadStarted || !this.frontendUpdateAvailable || now < this.releaseReloadScheduledAt) {
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

    if (now >= this.releaseReloadDelayToastAt) {
      this.releaseReloadDelayToastAt = now + 12000;
      this.hud.showToast('Update ready. Close active panels to reload.');
    }
  }

  getActiveEmoteSelection(target = this.emoteSelectionScratch) {
    const pointer = this.input.getPointerPosition();
    const centerX = window.innerWidth * 0.5;
    const centerY = window.innerHeight * 0.5;
    const offsetX = pointer.x - centerX;
    const offsetY = pointer.y - centerY;

    if ((offsetX * offsetX) + (offsetY * offsetY) < EMOTE_MENU_DEADZONE_SQ) {
      target.index = -1;
      target.entry = null;
      target.hasSelection = false;
      return target;
    }

    const angle = Math.atan2(offsetY, offsetX);
    const normalizedAngle = (angle + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2);
    const index = Math.floor(normalizedAngle / (Math.PI / 4));
    const entry = EMOTE_SLOTS[index] ?? null;
    target.index = index;
    target.entry = entry;
    target.hasSelection = Boolean(entry?.id);
    return target;
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
      && !this.carSelectorVisible
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

  setLocalPlayerSkateboardState(owned = undefined, skating = false, vehicleItemId = undefined) {
    const skateboardState = this.playerSkateboardState;
    skateboardState.owned = owned;
    skateboardState.skating = skating;
    skateboardState.vehicleItemId = vehicleItemId;
    this.player?.setSkateboardState?.(skateboardState);
  }

  syncPlayerBoundItemsHud(localPlayerState = this.getLocalPlayerState()) {
    const boundItemsHudState = this.playerBoundItemsHudState;
    boundItemsHudState.skateboardOwned = isPlayerSkateboardOwner(localPlayerState);
    boundItemsHudState.skating = Boolean(localPlayerState?.skating);
    boundItemsHudState.vehicleItemId = getPlayerVehicleItemId(localPlayerState);
    boundItemsHudState.vehicleLabel = getPlayerVehicleMenuItem(localPlayerState)?.label ?? '';
    this.hud.setPlayerBoundItemsState(boundItemsHudState);
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

  hasHotbarHudStateChanged(localPlayerState = this.getLocalPlayerState(), disabled = !this.canUseHotbarInput()) {
    return this.hotbarLayoutRevision !== this.lastHotbarHudLayoutRevision
      || this.selectedHotbarSlotIndex !== this.lastHotbarHudSelectedIndex
      || Boolean(disabled) !== this.lastHotbarHudDisabled
      || (localPlayerState?.ownedWeaponIds ?? '') !== this.lastHotbarHudOwnedWeaponIds
      || (localPlayerState?.equippedWeaponId ?? '') !== this.lastHotbarHudEquippedWeaponId
      || (localPlayerState?.beerCount ?? 0) !== this.lastHotbarHudBeerCount
      || (localPlayerState?.shotCount ?? 0) !== this.lastHotbarHudShotCount
      || (localPlayerState?.cigaretteCount ?? 0) !== this.lastHotbarHudCigaretteCount
      || (localPlayerState?.burgerCount ?? 0) !== this.lastHotbarHudBurgerCount
      || (localPlayerState?.glizzyCount ?? 0) !== this.lastHotbarHudGlizzyCount
      || (localPlayerState?.sodaCount ?? 0) !== this.lastHotbarHudSodaCount;
  }

  rememberHotbarHudState(localPlayerState = this.getLocalPlayerState(), disabled = !this.canUseHotbarInput()) {
    this.lastHotbarHudLayoutRevision = this.hotbarLayoutRevision;
    this.lastHotbarHudSelectedIndex = this.selectedHotbarSlotIndex;
    this.lastHotbarHudDisabled = Boolean(disabled);
    this.lastHotbarHudOwnedWeaponIds = localPlayerState?.ownedWeaponIds ?? '';
    this.lastHotbarHudEquippedWeaponId = localPlayerState?.equippedWeaponId ?? '';
    this.lastHotbarHudBeerCount = localPlayerState?.beerCount ?? 0;
    this.lastHotbarHudShotCount = localPlayerState?.shotCount ?? 0;
    this.lastHotbarHudCigaretteCount = localPlayerState?.cigaretteCount ?? 0;
    this.lastHotbarHudBurgerCount = localPlayerState?.burgerCount ?? 0;
    this.lastHotbarHudGlizzyCount = localPlayerState?.glizzyCount ?? 0;
    this.lastHotbarHudSodaCount = localPlayerState?.sodaCount ?? 0;
  }

  refreshHotbarHud({ force = false } = {}) {
    const localPlayerState = this.getLocalPlayerState();
    const disabled = !this.canUseHotbarInput();
    if (!force && !this.hasHotbarHudStateChanged(localPlayerState, disabled)) {
      return;
    }
    this.rememberHotbarHudState(localPlayerState, disabled);
    this.hotbarSlots = this.createCurrentHotbarSlots(localPlayerState);

    this.hud.setHotbarState({
      visible: true,
      slots: this.hotbarSlots,
      selectedIndex: this.selectedHotbarSlotIndex,
      disabled
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
    if (areHotbarItemOrdersEqual(nextOrder, this.hotbarItemOrder)) {
      return false;
    }

    this.hotbarItemOrder = nextOrder;
    this.hotbarLayoutRevision += 1;
    writeStoredHotbarItemOrder(this.hotbarItemOrder);
    this.hotbarSlots = this.createCurrentHotbarSlots();

    if (selectedItemId) {
      let nextSelectedIndex = -1;
      for (let index = 0; index < this.hotbarSlots.length; index += 1) {
        if (this.hotbarSlots[index].itemId === selectedItemId) {
          nextSelectedIndex = index;
          break;
        }
      }
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
    const weaponStateOptions = this.playerWeaponStateOptions;
    weaponStateOptions.visible = Boolean(desiredWeaponId);
    void this.player?.setWeaponState?.(desiredWeaponId, weaponStateOptions);
    return true;
  }

  syncSelectedHotbarEquipment(localPlayerState = this.getLocalPlayerState(), now = performance.now()) {
    if (!localPlayerState || localPlayerState.alive === false) {
      return;
    }

    const desiredWeaponId = this.getSelectedHotbarWeaponId();
    const currentWeaponId = localPlayerState.equippedWeaponId || '';
    if (this.pendingHotbarWeaponId !== null && currentWeaponId === this.pendingHotbarWeaponId) {
      this.pendingHotbarWeaponId = null;
    }
    if (this.pendingHotbarWeaponId !== null) {
      if (now - this.pendingHotbarRequestedAt < 500) {
        const weaponStateOptions = this.playerWeaponStateOptions;
        weaponStateOptions.visible = Boolean(this.pendingHotbarWeaponId);
        void this.player?.setWeaponState?.(this.pendingHotbarWeaponId, weaponStateOptions);
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
      && !this.carSelectorVisible
      && !this.shaderDebugMenuVisible
      && !this.aimPoseDebugVisible
    );
    const armed = Boolean(localPlayerState?.alive !== false && localPlayerState?.equippedWeaponId && !selectedDrinkItemId && !selectedConsumableItemId);
    const fireLabel = selectedDrinkItemId
      ? 'Drink'
      : (selectedConsumableItemId ? getItemActionLabel(this.getSelectedHotbarItemId()) : (armed ? 'Fire' : 'Hit'));

    const mobileControlsHudState = this.mobileControlsHudState;
    mobileControlsHudState.visible = visible;
    mobileControlsHudState.armed = armed;
    mobileControlsHudState.fireLabel = fireLabel;
    this.hud.setMobileControlsState(mobileControlsHudState);
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
    this.frameCounter += 1;
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
    const frameNow = performance.now();
    this.recordMovementFrameTiming(rawDeltaSeconds, deltaSeconds);
    const localPlayerState = this.getLocalPlayerState();
    this.processPendingFrontendReload(frameNow);
    this.syncMobileControlsHud(localPlayerState);
    const rentIntroCutsceneActiveAtFrameStart = this.isRentIntroCutsceneActive();
    const emoteMenuActive = rentIntroCutsceneActiveAtFrameStart ? false : this.updateEmoteMenu();
    this.refreshHotbarHud();
    if (this.hud.isStockMarketOpen()) {
      if (!this.stockMarketRequestInFlight && frameNow >= this.stockMarketRefreshAt) {
        void this.refreshStockMarket();
      }
    } else {
      if (
        localPlayerState?.alive !== false
        && !this.walletRequestInFlight
        && frameNow >= this.walletRefreshAt
      ) {
        void this.refreshWalletSnapshot({ passive: true });
      }
    }
    this.updateAdminPromptPolling();
    if (this.hud.isSchoolMicrogameOpen()) {
      this.updateSchoolMicrogame(deltaSeconds, frameNow);
      this.updateSchoolGeographyGlobe(deltaSeconds);
      this.updateSchoolTeacherPreview(deltaSeconds);
    }
    if (this.hud.isVibeHeroOpen()) {
      this.updateVibeHero(deltaSeconds, frameNow);
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
      } else if (this.carSelectorVisible) {
        this.setCarSelectorVisible(false);
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
    this.updateFirstPersonPointerLockAvailability();

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
      this.syncLocalPlayerState(localPlayerState, deltaSeconds, frameNow);
      this.syncSelectedHotbarEquipment(localPlayerState, frameNow);
    } else {
      this.syncTaskHud(null);
    }

    this.worldBuilder.update(deltaSeconds, this.input, frameNow);
    this.worldBuilderInteractablesFrame = -1;
    this.activeInteractablesFrame = -1;

    if (this.worldBuilder.enabled) {
      this.suspendInlineShellForBuilder();
      this.worldBuilder.syncInteriorPlacementPreview();
      this.clearPendingHipFireShot();
      this.clearBufferedPunch();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
      this.setLocalPlayerSkateboardState(undefined, false, undefined);
      this.updateBuilderCamera();
      this.clearInteractionCameraFocus();
      this.currentInteractable = null;
      this.hud.setPrompt(null);
    } else {
      const rentIntroCutsceneActive = this.isRentIntroCutsceneActive();
      const localAlive = localPlayerState?.alive !== false;
      const passiveTrafficStunned = localAlive && frameNow < this.passiveTrafficPlayerStunUntil;
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
      const canCursorAim = localAlive && !passiveTrafficStunned && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !interactionMenuOpen && !adminPromptOpen && !phoneOpen && !this.carSelectorVisible;
      const activeColliders = this.getActiveColliders();
      const groundHeight = this.getActiveGroundHeightAt(this.player.position);
      const activeSceneBounds = this.getActiveSceneBounds();
      const hipFirePending = this.pendingHipFireShot;
      const hipFirePoseActive = Boolean(hipFirePending && frameNow < hipFirePending.releaseAt);
      const aimDirection = canCursorAim
        ? this.getAimDirection()
        : this.aimDirectionScratch.copy(this.currentAimDirection);
      this.currentAimDirection.copy(aimDirection);
      this.player.setAimRotation(Math.atan2(aimDirection.x, aimDirection.z));
      if (localAlive && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !adminPromptOpen && !phoneOpen && this.input.consume('KeyP')) {
        const isLimp = this.player.toggleLimp();
        this.hud.showToast(isLimp ? 'Limbo mode engaged.' : 'Back on your feet.');
      }
      const playerInput = (!localAlive || passiveTrafficStunned || rentIntroCutsceneActive || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || interactionMenuOpen || adminPromptOpen || phoneOpen || this.carSelectorVisible) ? ZERO_INPUT : this.input;
      const skateboardOwned = isPlayerSkateboardOwner(localPlayerState);
      const vehicleItemId = getPlayerVehicleItemId(localPlayerState);
      const vehicleLabel = getPlayerVehicleMenuItem(localPlayerState)?.label ?? '';
      const activeCarOwned = isPlayerVehicleOwner(localPlayerState);
      const transportOwned = skateboardOwned || activeCarOwned;
      const transportInputEnabled = Boolean(transportOwned && playerInput !== ZERO_INPUT);
      if (!transportOwned) {
        this.transportRideToggled = false;
      } else if (transportInputEnabled && this.input.consumeAction('skate')) {
        this.transportRideToggled = !this.transportRideToggled;
      }
      const transportRidingActive = Boolean(transportInputEnabled && this.transportRideToggled);
      const vehicleSpeedScale = activeCarOwned ? CAR_VEHICLE_SPEED_MULTIPLIER : SKATEBOARD_SPEED_MULTIPLIER;
      const movementCameraForward = this.firstPersonModeActive && this.canUseFirstPersonMode()
        ? this.getFirstPersonMovementForward(this.firstPersonMovementForward)
        : (
            armed && playerInput !== ZERO_INPUT && this.input.isActionPressed('aim')
              ? AIM_CAMERA_MOVEMENT_FORWARD
              : CAMERA_MOVEMENT_FORWARD
          );
      const boundItemsHudState = this.playerBoundItemsHudState;
      boundItemsHudState.skateboardOwned = skateboardOwned;
      boundItemsHudState.skating = transportRidingActive;
      boundItemsHudState.vehicleItemId = vehicleItemId;
      boundItemsHudState.vehicleLabel = vehicleLabel;
      this.hud.setPlayerBoundItemsState(boundItemsHudState);

      const workoutOptions = this.activeWorkoutUpdateOptions;
      workoutOptions.localAlive = localAlive;
      workoutOptions.colliders = activeColliders;
      workoutOptions.sceneBounds = activeSceneBounds;
      workoutOptions.groundHeight = groundHeight;
      workoutOptions.now = frameNow;
      const workoutActive = this.updateActiveWorkout(deltaSeconds, workoutOptions);
      let aimingMode = false;

      if (workoutActive) {
        this.clearPendingHipFireShot();
        this.clearBufferedPunch();
        this.currentAimMode = false;
        this.setLocalPlayerSkateboardState(transportOwned, false, vehicleItemId);
        const facing = this.player.object.rotation.y;
        this.currentAimDirection.set(Math.sin(facing), 0, Math.cos(facing)).normalize();
        this.syncInlineShellState();
        if (this.activeWorkout?.activityConfig?.basketballShot) {
          this.updateBasketballShotCamera();
        } else if (this.activeWorkout?.activityConfig?.treadmillRun) {
          this.updateTreadmillRunCamera();
        } else if (this.activeWorkout?.activityConfig?.kind === SNATCH_WORKOUT_KIND) {
          this.updateSnatchWorkoutCamera();
        } else {
          const cameraOptions = this.cameraUpdateOptions;
          cameraOptions.snap = false;
          cameraOptions.now = frameNow;
          this.updateCamera(this.currentAimDirection, false, cameraOptions);
        }
        this.currentInteractable = null;
        this.hud.setPrompt(null);
      } else {
        const playerUpdateOptions = this.playerUpdateOptions;
        playerUpdateOptions.skateboardOwned = transportOwned;
        playerUpdateOptions.vehicleItemId = vehicleItemId;
        playerUpdateOptions.skating = transportRidingActive;
        playerUpdateOptions.speedScale = vehicleSpeedScale;
        playerUpdateOptions.movementCameraForward = movementCameraForward;
        playerUpdateOptions.stationaryRun = false;
        playerUpdateOptions.locomotionMode = undefined;
        playerUpdateOptions.locomotionPlaybackRate = undefined;
        this.player.update(
          deltaSeconds,
          playerInput,
          this.camera,
          activeColliders,
          activeSceneBounds,
          groundHeight,
          this.playerUpdateOptions
        );
        if (this.firstPersonModeActive && this.canUseFirstPersonMode()) {
          this.player.setFacing(this.firstPersonYaw);
        }
        this.syncInlineShellState();
        const combatInputEnabled = localAlive && !passiveTrafficStunned && !rentIntroCutsceneActive && !emoteMenuActive && !this.hud.isQuickChatOpen() && !stockMarketOpen && !blackjackOpen && !schoolMicrogameOpen && !vibeHeroOpen && !interactionMenuOpen && !adminPromptOpen && !phoneOpen;
        const primaryFirePressed = combatInputEnabled && this.input.consumeAction('fire');
        const primaryFireHeld = combatInputEnabled && this.input.isActionPressed('fire');
        const secondaryAimHeld = combatInputEnabled && this.input.isActionPressed('aim');
        if (consumableSelected) {
          this.clearPendingHipFireShot();
          this.clearBufferedPunch();
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
          this.clearBufferedPunch();
          aimingMode = secondaryAimHeld;
          this.currentAimMode = aimingMode;
          this.player.setAimingState(aimingMode || hipFirePoseActive);
          if (aimingMode ? primaryFireHeld : primaryFirePressed) {
            if (aimingMode) {
              this.fireLocalWeapon(aimDirection, this.getShotCollisionOrigin(aimDirection));
            } else if (!hipFirePending || frameNow >= hipFirePending.releaseAt) {
              this.queueHipFireShot(aimDirection);
            }
          }
          if (combatInputEnabled && this.input.consumeAction('reload')) {
            this.npcService?.reloadWeapon();
          }
        } else {
          this.clearPendingHipFireShot();
          this.currentAimMode = false;
          this.player.setAimingState(false);
          this.processBufferedPunch(aimDirection);
          if (primaryFirePressed) {
            this.punchLocal(aimDirection);
          }
        }
        if (!localAlive || passiveTrafficStunned || rentIntroCutsceneActive || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || interactionMenuOpen || adminPromptOpen || phoneOpen) {
          this.clearPendingHipFireShot();
          this.clearBufferedPunch();
        } else if (this.pendingHipFireShot) {
          this.player.setAimingState(aimingMode || frameNow < this.pendingHipFireShot.releaseAt);
          this.player.setAimRotation(Math.atan2(this.pendingHipFireShot.direction.x, this.pendingHipFireShot.direction.z));
          if (!this.pendingHipFireShot.fired && frameNow >= this.pendingHipFireShot.fireAt) {
            this.pendingHipFireShot.fired = true;
            this.fireLocalWeapon(this.pendingHipFireShot.direction, this.pendingHipFireShot.origin);
          }
          if (frameNow >= this.pendingHipFireShot.releaseAt) {
            this.clearPendingHipFireShot();
            this.player.setAimingState(aimingMode);
          }
        }
        if (rentIntroCutsceneActive) {
          this.updateRentIntroCutscene();
        } else {
          const cameraOptions = this.cameraUpdateOptions;
          cameraOptions.snap = false;
          cameraOptions.now = frameNow;
          this.updateCamera(this.currentAimDirection, this.currentAimMode && armed, cameraOptions);
        }
      }
      this.updateLocalPlayerKinematics(frameNow);
      const animationSyncState = this.player.getAnimationSyncState(this.localAnimationSyncState);
      animationSyncState.aiming = Boolean(this.currentAimMode || hipFirePoseActive);
      this.npcService?.setPlayerTransform(
        this.player.position,
        this.player.object.rotation.y,
        animationSyncState
      );
      this.updateNpcInteractRadiusIndicators();

      if (workoutActive || passiveTrafficStunned || rentIntroCutsceneActive || localAlive === false || emoteMenuActive || this.hud.isQuickChatOpen() || stockMarketOpen || blackjackOpen || schoolMicrogameOpen || vibeHeroOpen || adminPromptOpen || phoneOpen) {
        this.currentInteractable = null;
        this.hud.setPrompt(null);
      } else {
        this.updateInteraction();
      }
    }

    this.updateRemotePlayers(deltaSeconds);
    this.updatePickupVisuals(deltaSeconds);
    this.updateCombatEffects(frameNow);
    const hitMarkerVisible = frameNow < this.hitMarkerUntil;
    if (hitMarkerVisible !== this.lastHudHitMarkerVisible) {
      this.hud.setHitMarkerVisible(hitMarkerVisible);
      this.lastHudHitMarkerVisible = hitMarkerVisible;
    }
    this.refreshFirstPersonCrosshairHud(localPlayerState);
    this.updateFirstPersonPointerLockAvailability();
    const npcSpeechAnchors = this.getNpcSpeechAnchorsForHud();
    const visibleOverheadHealthBarIds = this.updateOverheadHealthBars(npcSpeechAnchors);
    this.updateSpeechBubbles(visibleOverheadHealthBarIds, npcSpeechAnchors);
    if (this.aimPoseDebugVisible) {
      this.refreshAimPoseDebugHud();
    }
    this.refreshAdminPositionHud();
    this.characterPreviewRenderer?.update(deltaSeconds);
    this.vehiclePreviewRenderer?.update(deltaSeconds);
    this.updateCameraOcclusion();
    this.updateWorldInteractableIndicatorVisibility();
    this.updateDrunknessEffects(localPlayerState);
    const movementFrameSummaryOptions = this.movementFrameSummaryOptions;
    movementFrameSummaryOptions.force = false;
    movementFrameSummaryOptions.now = frameNow;
    this.updateAdaptiveRenderQuality(this.getMovementFrameSummary(movementFrameSummaryOptions), frameNow);
    this.worldBuilderInteractablesFrame = -1;
    this.activeInteractablesFrame = -1;
    if (this.vibeShaderPass?.uniforms?.uTime) {
      this.vibeShaderPass.uniforms.uTime.value = frameNow * 0.001;
    }

    this.renderSceneFrame();
    this.processDeferredSceneWork();
    this.input.endFrame();
  }

  updateCameraFov(targetFov = DEFAULT_CAMERA_FOV, options = null) {
    if (!this.camera) {
      return;
    }

    const snap = options?.snap === true;
    const smoothing = Number.isFinite(options?.smoothing)
      ? options.smoothing
      : INTERACTION_CAMERA_RETURN_FOV_SMOOTHING;
    const nextFov = THREE.MathUtils.clamp(Number(targetFov) || DEFAULT_CAMERA_FOV, 25, DEFAULT_CAMERA_FOV);
    const previousFov = this.camera.fov;
    this.camera.fov = snap
      ? nextFov
      : THREE.MathUtils.lerp(previousFov, nextFov, smoothing);
    if (Math.abs(this.camera.fov - previousFov) > 0.01) {
      this.camera.updateProjectionMatrix();
    }
  }

  getInteractionCameraKey(kind = '', interaction = null) {
    const normalizedKind = String(kind || interaction?.kind || 'interaction').trim() || 'interaction';
    const targetId = String(
      interaction?.npcId
      || interaction?.placementId
      || interaction?.itemId
      || interaction?.gameId
      || interaction?.label
      || ''
    ).trim();
    return targetId ? `${normalizedKind}:${targetId}` : normalizedKind;
  }

  getInteractionCameraBaseTarget(interaction = null, target = this.interactionCameraBaseTarget) {
    if (!interaction || !target) {
      return null;
    }

    const npcId = String(interaction.npcId || interaction.placementId || '').trim();
    const npcState = interaction.kind !== 'world' && npcId
      ? this.npcServiceState.npcs.get(npcId)
      : null;
    const npcX = Number(npcState?.x ?? npcState?.position?.[0]);
    const npcZ = Number(npcState?.z ?? npcState?.position?.[1]);
    if (Number.isFinite(npcX) && Number.isFinite(npcZ)) {
      target.set(npcX, this.getActiveGroundHeightAt({ x: npcX, z: npcZ }), npcZ);
      return target;
    }

    const source = interaction.originPosition?.isVector3
      ? interaction.originPosition
      : interaction.position?.isVector3
        ? interaction.position
        : interaction.approachPosition?.isVector3
          ? interaction.approachPosition
          : null;
    if (!source) {
      return null;
    }

    target.copy(source);
    if (!Number.isFinite(target.y)) {
      target.y = this.getActiveGroundHeightAt(target);
    }
    return target;
  }

  getInteractionCameraLookHeight(interaction = null) {
    const kind = String(interaction?.kind ?? '');
    return (
      kind === 'npc'
      || kind.includes('delivery')
      || kind.includes('gym-check-in')
      || kind.includes('stock-market')
      || kind.includes('blackjack')
      || kind.includes('school')
      || kind.includes('bartender')
      || kind.includes('pawn-shop')
      || kind.includes('car-dealer')
      || kind.includes('martha')
    )
      ? INTERACTION_CAMERA_NPC_LOOK_HEIGHT
      : INTERACTION_CAMERA_OBJECT_LOOK_HEIGHT;
  }

  getInteractionCameraLookTarget(interaction = null, target = this.interactionCameraLookTarget) {
    const baseTarget = this.getInteractionCameraBaseTarget(interaction, target);
    if (!baseTarget) {
      return null;
    }

    baseTarget.y += this.getInteractionCameraLookHeight(interaction);
    return baseTarget;
  }

  facePlayerTowardInteraction(interaction = null) {
    if (!this.player) {
      return false;
    }

    const target = this.getInteractionCameraBaseTarget(interaction, this.interactionCameraBaseTarget);
    if (!target) {
      return false;
    }

    const dx = target.x - this.player.position.x;
    const dz = target.z - this.player.position.z;
    if ((dx * dx) + (dz * dz) <= 0.0001) {
      return false;
    }

    const rotationY = Math.atan2(dx, dz);
    this.player.setFacing(rotationY);
    this.player.setAimRotation(rotationY);
    this.currentAimDirection.set(Math.sin(rotationY), 0, Math.cos(rotationY)).normalize();
    return true;
  }

  startInteractionCameraFocus(interaction = null, {
    kind = '',
    persistent = true,
    durationMs = INTERACTION_CAMERA_TRANSIENT_MS,
    minimumMs = INTERACTION_CAMERA_MIN_MS
  } = {}) {
    if (!this.player || !interaction) {
      return false;
    }

    const now = performance.now();
    const normalizedKind = String(kind || interaction.kind || 'interaction').trim() || 'interaction';
    this.activeInteractionCamera = {
      kind: normalizedKind,
      key: this.getInteractionCameraKey(normalizedKind, interaction),
      interaction,
      persistent: Boolean(persistent),
      minUntil: now + Math.max(0, Number(minimumMs) || 0),
      releaseAt: persistent
        ? Number.POSITIVE_INFINITY
        : now + Math.max(Number(durationMs) || 0, Number(minimumMs) || 0)
    };
    this.facePlayerTowardInteraction(interaction);
    return true;
  }

  refreshInteractionCameraFocus(interaction = null, { kind = '' } = {}) {
    const activeCamera = this.activeInteractionCamera;
    if (!activeCamera || !interaction) {
      return false;
    }

    const normalizedKind = String(kind || interaction.kind || '').trim();
    if (normalizedKind && activeCamera.kind !== normalizedKind) {
      return false;
    }

    activeCamera.interaction = interaction;
    activeCamera.key = this.getInteractionCameraKey(activeCamera.kind, interaction);
    return true;
  }

  clearInteractionCameraFocus(kindOrKey = '', { afterMinimum = false } = {}) {
    const activeCamera = this.activeInteractionCamera;
    if (!activeCamera) {
      return false;
    }

    const normalized = String(kindOrKey ?? '').trim();
    if (normalized && activeCamera.kind !== normalized && activeCamera.key !== normalized) {
      return false;
    }

    const now = performance.now();
    if (afterMinimum && now < activeCamera.minUntil) {
      activeCamera.persistent = false;
      activeCamera.releaseAt = activeCamera.minUntil;
    } else {
      this.activeInteractionCamera = null;
    }
    return true;
  }

  updateInteractionCameraFocus(options = null) {
    const snap = options?.snap === true;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
    const activeCamera = this.activeInteractionCamera;
    if (!activeCamera || !this.player) {
      return false;
    }

    if (!activeCamera.persistent && now >= activeCamera.releaseAt) {
      this.activeInteractionCamera = null;
      return false;
    }
    this.facePlayerTowardInteraction(activeCamera.interaction);

    const lookTarget = this.getInteractionCameraLookTarget(activeCamera.interaction, this.interactionCameraLookTarget);
    if (!lookTarget) {
      this.activeInteractionCamera = null;
      return false;
    }

    const playerLookTarget = this.interactionCameraPlayerLookTarget
      .copy(this.player.position);
    playerLookTarget.y += INTERACTION_CAMERA_PLAYER_LOOK_HEIGHT;

    const forward = this.interactionCameraForward.copy(lookTarget).sub(playerLookTarget);
    forward.y = 0;
    if (forward.lengthSq() <= 0.0001) {
      forward.set(Math.sin(this.player.object.rotation.y), 0, Math.cos(this.player.object.rotation.y));
    }
    forward.normalize();

    const right = this.interactionCameraRight.set(forward.z, 0, -forward.x).normalize();
    const targetDistance = Math.max(
      0.1,
      Math.hypot(
        lookTarget.x - playerLookTarget.x,
        lookTarget.z - playerLookTarget.z
      )
    );
    // Keep the camera ray just outside the player's shoulder so close NPCs and props remain visible.
    const requiredLookSideOffset = (
      (INTERACTION_CAMERA_SIGHTLINE_CLEARANCE * (targetDistance + INTERACTION_CAMERA_SHOULDER_DISTANCE))
      - (INTERACTION_CAMERA_SHOULDER_OFFSET * targetDistance)
    ) / INTERACTION_CAMERA_SHOULDER_DISTANCE;
    const lookSideOffset = Math.max(
      INTERACTION_CAMERA_LOOK_SIDE_OFFSET,
      Math.min(INTERACTION_CAMERA_LOOK_SIDE_MAX_OFFSET, requiredLookSideOffset)
    );
    const targetPosition = this.cameraTargetPosition.copy(playerLookTarget)
      .addScaledVector(forward, -INTERACTION_CAMERA_SHOULDER_DISTANCE)
      .addScaledVector(right, INTERACTION_CAMERA_SHOULDER_OFFSET);
    const shoulderCameraY = this.player.position.y + INTERACTION_CAMERA_HEIGHT;
    const maximumCameraY = shoulderCameraY + 0.35;
    targetPosition.y = Math.max(
      shoulderCameraY,
      Math.min(lookTarget.y + INTERACTION_CAMERA_LOOK_OVER_LIFT, maximumCameraY)
    );

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, INTERACTION_CAMERA_SMOOTHING);
    }
    const framedLookTarget = this.cameraLookTarget.copy(lookTarget)
      .addScaledVector(right, lookSideOffset);
    this.camera.lookAt(framedLookTarget);
    const fovOptions = this.cameraFovOptions;
    fovOptions.snap = snap;
    fovOptions.smoothing = INTERACTION_CAMERA_FOV_SMOOTHING;
    this.updateCameraFov(INTERACTION_CAMERA_FOV, fovOptions);
    return true;
  }

  updateFirstPersonCamera(options = null) {
    if (!this.player) {
      return;
    }

    const snap = options?.snap === true;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
    const targetPosition = this.cameraTargetPosition.copy(this.player.position);
    targetPosition.y += FIRST_PERSON_CAMERA_HEIGHT;
    const lookDirection = this.getFirstPersonLookDirection(this.firstPersonDirection);
    const lookTarget = this.firstPersonLookTarget.copy(targetPosition).add(lookDirection);

    if (now < this.damageCameraKickEndsAt) {
      const lifetime = Math.max(1, this.damageCameraKickEndsAt - this.damageCameraKickStartedAt);
      const progress = THREE.MathUtils.clamp((now - this.damageCameraKickStartedAt) / lifetime, 0, 1);
      const envelope = Math.pow(1 - progress, 1.35);
      const wave = Math.sin(progress * Math.PI * 3.2);
      const side = this.damageCameraSide.set(-this.damageCameraDirection.z, 0, this.damageCameraDirection.x);
      targetPosition.addScaledVector(this.damageCameraDirection, envelope * 0.18);
      targetPosition.addScaledVector(side, wave * envelope * 0.12);
      targetPosition.y += Math.sin(progress * Math.PI) * envelope * 0.08;
      lookTarget.addScaledVector(this.damageCameraDirection, envelope * 0.08);
      lookTarget.addScaledVector(side, wave * envelope * -0.06);
    }

    this.camera.position.copy(targetPosition);
    this.camera.lookAt(lookTarget);
    this.setFirstPersonPlayerHidden(true);
    const fovOptions = this.cameraFovOptions;
    fovOptions.snap = snap;
    fovOptions.smoothing = INTERACTION_CAMERA_RETURN_FOV_SMOOTHING;
    this.updateCameraFov(DEFAULT_CAMERA_FOV, fovOptions);
  }

  updateCamera(aimDirection = this.currentAimDirection, isAiming = false, options = null) {
    if (this.firstPersonModeActive && this.canUseFirstPersonMode()) {
      this.updateFirstPersonCamera(options);
      return;
    }

    const snap = options?.snap === true;
    const now = Number.isFinite(options?.now) ? options.now : performance.now();
    const focusOptions = this.interactionCameraFocusOptions;
    focusOptions.snap = snap;
    focusOptions.now = now;
    if (this.updateInteractionCameraFocus(focusOptions)) {
      return;
    }

    const zoomLevel = this.getCameraZoomLevel();
    const cameraOffset = this.cameraOffsetScratch
      .copy(isAiming ? AIM_CAMERA_OFFSET : CAMERA_OFFSET)
      .multiplyScalar(zoomLevel);
    const targetPosition = this.cameraTargetPosition.copy(this.player.position).add(cameraOffset);
    const lookTarget = this.cameraLookTarget.copy(this.player.position).add(CAMERA_LOOK_OFFSET);

    if (now < this.damageCameraKickEndsAt) {
      const kickStrength = THREE.MathUtils.clamp(Number(this.damageCameraKickStrength) || 1, 0.6, 1.35);
      const lifetime = Math.max(1, this.damageCameraKickEndsAt - this.damageCameraKickStartedAt);
      const progress = THREE.MathUtils.clamp((now - this.damageCameraKickStartedAt) / lifetime, 0, 1);
      const envelope = Math.pow(1 - progress, 1.35);
      const wave = Math.sin(progress * Math.PI * 3.2);
      const side = this.damageCameraSide.set(-this.damageCameraDirection.z, 0, this.damageCameraDirection.x);
      targetPosition.addScaledVector(this.damageCameraDirection, envelope * 0.72 * kickStrength);
      targetPosition.addScaledVector(side, wave * envelope * 0.26 * kickStrength);
      targetPosition.y += Math.sin(progress * Math.PI) * envelope * 0.38 * kickStrength;
      lookTarget.addScaledVector(this.damageCameraDirection, envelope * 0.16 * kickStrength);
      lookTarget.addScaledVector(side, wave * envelope * -0.14 * kickStrength);
      lookTarget.y += envelope * 0.12 * kickStrength;
    }

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, isAiming ? 0.14 : 0.08);
    }
    this.camera.lookAt(lookTarget);
    const fovOptions = this.cameraFovOptions;
    fovOptions.snap = snap;
    fovOptions.smoothing = INTERACTION_CAMERA_RETURN_FOV_SMOOTHING;
    this.updateCameraFov(DEFAULT_CAMERA_FOV, fovOptions);
  }

  triggerDamageCameraFeedback(direction = null, { strength = 1 } = {}) {
    this.damageCameraKickStartedAt = performance.now();
    this.damageCameraKickEndsAt = this.damageCameraKickStartedAt + DAMAGE_CAMERA_KICK_MS;
    this.damageCameraKickStrength = THREE.MathUtils.clamp(Number(strength) || 1, 0.6, 1.35);
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

    if (!this.player || this.worldBuilder.enabled || this.currentInterior?.scene || this.firstPersonModeActive) {
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

  getNpcInteractionHintState(worldBuilderInteractables = this.getWorldBuilderInteractables()) {
    if (this.npcInteractionHintFrame === this.frameCounter && this.npcInteractionHintState) {
      return this.npcInteractionHintState;
    }

    const npcInteractable = this.getNearestNpcInteractable(worldBuilderInteractables);
    const deliveryInteraction = this.getDeliveryQuestInteractionForNpc(npcInteractable, worldBuilderInteractables);
    const deliveryPromptInteraction = this.createDeliveryQuestPromptInteractable(deliveryInteraction, npcInteractable);
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
    const vendorSearchOptions = this.npcVendorSearchOptions;
    vendorSearchOptions.npcId = '';
    vendorSearchOptions.worldBuilderInteractables = worldBuilderInteractables;
    const bartenderInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction
      ? null
      : this.getNearestBartenderInteractable(vendorSearchOptions);
    const pawnShopOwnerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction
      ? null
      : this.getNearestPawnShopOwnerInteractable(vendorSearchOptions);
    const carDealerInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction
      ? null
      : this.getNearestCarDealerInteractable(vendorSearchOptions);
    const marthaInteraction = deliveryInteraction || gymCheckInInteraction || stockMarketInteraction || blackjackInteraction || schoolMicrogameInteraction || bartenderInteraction || pawnShopOwnerInteraction || carDealerInteraction
      ? null
      : this.getNearestMarthaInteractable(vendorSearchOptions);
    const interactable = deliveryInteraction
      ? npcInteractable
      : (gymCheckInInteraction ?? stockMarketInteraction ?? blackjackInteraction ?? schoolMicrogameInteraction ?? bartenderInteraction ?? pawnShopOwnerInteraction ?? carDealerInteraction ?? marthaInteraction ?? npcInteractable);

    this.npcInteractionHintFrame = this.frameCounter;
    const state = this.npcInteractionHintState;
    state.npcInteractable = npcInteractable;
    state.deliveryInteraction = deliveryInteraction;
    state.deliveryPromptInteraction = deliveryPromptInteraction;
    state.gymCheckInInteraction = gymCheckInInteraction;
    state.stockMarketInteraction = stockMarketInteraction;
    state.blackjackInteraction = blackjackInteraction;
    state.schoolMicrogameInteraction = schoolMicrogameInteraction;
    state.bartenderInteraction = bartenderInteraction;
    state.pawnShopOwnerInteraction = pawnShopOwnerInteraction;
    state.carDealerInteraction = carDealerInteraction;
    state.marthaInteraction = marthaInteraction;
    state.interactable = interactable;
    return state;
  }

  updateInteraction() {
    const worldBuilderInteractables = this.getWorldBuilderInteractables();
    this.syncOpenPoliceGarageDoors();
    const localPlayerState = this.getLocalPlayerState();
    this.syncDeliveryQuestReminderGate(localPlayerState, worldBuilderInteractables);

    const interactables = this.getActiveInteractables(worldBuilderInteractables);
    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (const interactable of interactables) {
      const distanceSq = distanceSquared3D(interactable.position, this.player.position);
      const radius = Number(interactable.radius);
      const radiusSq = radius * radius;
      if (distanceSq < radiusSq && distanceSq < nearestDistanceSq) {
        nearest = interactable;
        nearestDistanceSq = distanceSq;
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

    const {
      deliveryInteraction,
      deliveryPromptInteraction,
      gymCheckInInteraction,
      stockMarketInteraction,
      blackjackInteraction,
      schoolMicrogameInteraction,
      bartenderInteraction,
      pawnShopOwnerInteraction,
      carDealerInteraction,
      marthaInteraction
    } = this.getNpcInteractionHintState(worldBuilderInteractables);
    this.syncActiveBartenderMenu(bartenderInteraction);
    this.syncActivePawnShopMenu(pawnShopOwnerInteraction);
    this.syncActiveCarDealerMenu(carDealerInteraction);
    this.syncActiveMarthaMenu(marthaInteraction);
    this.currentInteractable = deliveryPromptInteraction
      ?? gymCheckInInteraction
      ?? stockMarketInteraction
      ?? blackjackInteraction
      ?? schoolMicrogameInteraction
      ?? bartenderInteraction
      ?? pawnShopOwnerInteraction
      ?? carDealerInteraction
      ?? marthaInteraction
      ?? nearest;
    const interactPressed = this.input.consumeAction('interact');

    if (deliveryPromptInteraction) {
      this.hud.setPrompt(deliveryPromptInteraction);
      if (interactPressed) {
        void this.handleDeliveryQuestInteraction(deliveryInteraction);
      }
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

    if (this.isOpenableGarageInteractable(nearest)) {
      const garageInteraction = this.getPoliceGaragePromptInteractable(nearest);
      this.hud.setPrompt(garageInteraction);
      if (interactPressed) {
        this.togglePoliceGarage(garageInteraction);
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

    this.startInteractionCameraFocus(nearest, {
      kind: 'world-prop',
      persistent: false
    });
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
      && !this.carSelectorVisible
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

  isSpeechBubbleActive(text, startedAt, options = {}, now = Date.now()) {
    return this.isSpeechBubbleActiveState(
      text,
      startedAt,
      options.status ?? 'done',
      Boolean(options.busy),
      now
    );
  }

  isSpeechBubbleActiveState(text, startedAt, status = 'done', busy = false, now = Date.now()) {
    const isThinking = status === 'thinking';
    const isBusy = Boolean(busy);
    const hasVisibleText = Boolean(text) || isThinking;
    if (!hasVisibleText || !startedAt) {
      return false;
    }

    if (!isBusy && (now - startedAt) > getChatBubbleLifetimeMs(text)) {
      return false;
    }

    return true;
  }

  collectSpeechBubble(id, text, startedAt, anchor, variant, label = '', options = {}) {
    return this.collectSpeechBubbleRecord(
      id,
      text,
      startedAt,
      anchor,
      variant,
      label,
      options.status ?? 'done',
      Boolean(options.busy),
      Number(options.screenYOffset) || 0,
      options.chirp === true,
      options.modelId ?? '',
      options.voice ?? null,
      options.voiceVolumeScale ?? 1,
      options.speakerKey ?? label ?? id
    );
  }

  collectSpeechBubbleRecord(
    id,
    text,
    startedAt,
    anchor,
    variant,
    label = '',
    status = 'done',
    busy = false,
    screenYOffset = 0,
    chirp = false,
    modelId = '',
    voice = null,
    voiceVolumeScale = 1,
    speakerKey = '',
    tone = '',
    opacity = undefined
  ) {
    if (!this.isSpeechBubbleActiveState(text, startedAt, status, busy)) {
      return null;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return null;
    }

    return this.writeSpeechBubbleRecord(
      id,
      text,
      label,
      variant,
      status,
      projected.x,
      projected.y - screenYOffset,
      chirp,
      modelId,
      voice,
      voiceVolumeScale,
      speakerKey || label || id,
      tone,
      opacity
    );
  }

  pushSpeechBubble(bubbles, bubble) {
    if (bubble) {
      bubbles.push(bubble);
    }
  }

  writeSpeechBubbleRecord(
    id,
    text,
    label,
    variant,
    status,
    screenX,
    screenY,
    chirp = false,
    modelId = '',
    voice = null,
    voiceVolumeScale = 1,
    speakerKey = '',
    tone = '',
    opacity = undefined
  ) {
    let bubble = this.speechBubbleRecords.get(id);
    if (!bubble) {
      bubble = {
        id,
        text: '',
        label: '',
        variant: '',
        status: 'done',
        tone: '',
        chirp: false,
        modelId: '',
        voice: null,
        voiceVolumeScale: 1,
        speakerKey: '',
        visible: true,
        screenX: 0,
        screenY: 0
      };
      this.speechBubbleRecords.set(id, bubble);
    }
    this.speechBubbleRecordActiveIds.add(id);
    bubble.text = text;
    bubble.label = label;
    bubble.variant = variant;
    bubble.status = status;
    bubble.tone = tone;
    bubble.chirp = chirp;
    bubble.modelId = modelId;
    bubble.voice = voice;
    bubble.voiceVolumeScale = voiceVolumeScale;
    bubble.speakerKey = speakerKey || label || id;
    bubble.visible = true;
    bubble.screenX = screenX;
    bubble.screenY = screenY;
    bubble.opacity = Number.isFinite(Number(opacity)) ? opacity : undefined;
    return bubble;
  }

  pushSimpleSpeechBubble(bubbles, id, text, label, variant, projected, screenYOffset = 0, status = 'done') {
    bubbles.push(this.writeSpeechBubbleRecord(
      id,
      text,
      label,
      variant,
      status,
      projected.x,
      projected.y - screenYOffset
    ));
  }

  pruneSpeechBubbleRecords() {
    const activeIds = this.speechBubbleRecordActiveIds;
    for (const id of this.speechBubbleRecords.keys()) {
      if (!activeIds.has(id)) {
        this.speechBubbleRecords.delete(id);
      }
    }
  }

  addPlayerSpeechBubble(bubbles, sessionId, playerState, anchor, variant, screenYOffset = 0) {
    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubbleRecord(
        `player:${sessionId}`,
        playerState.chatText,
        playerState.chatStartedAt,
        anchor,
        variant,
        '',
        'done',
        false,
        screenYOffset
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

    const distanceSq = distanceSquared2D(playerX, playerZ, npcX, npcZ);
    if (distanceSq <= NPC_VOICE_FULL_VOLUME_DISTANCE * NPC_VOICE_FULL_VOLUME_DISTANCE) {
      return 1;
    }
    if (distanceSq >= NPC_VOICE_AUDIBLE_DISTANCE * NPC_VOICE_AUDIBLE_DISTANCE) {
      return 0;
    }

    return getNpcVoiceDistanceVolumeScale(Math.sqrt(distanceSq));
  }

  addNpcSpeechBubble(bubbles, npcId, npcState, anchor, screenYOffset = 0) {
    if (this.isRentIntroReservedNpc(npcId)) {
      return;
    }

    const status = npcState.chatStatus ?? 'done';
    const busy = Boolean(npcState.busy);
    const safeScreenYOffset = Number(screenYOffset) || 0;
    if (!this.isSpeechBubbleActiveState(npcState.chatText, npcState.chatStartedAt, status, busy)) {
      return;
    }

    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubbleRecord(
        `npc:${npcId}`,
        npcState.chatText,
        npcState.chatStartedAt,
        anchor,
        'npc',
        npcState.name,
        status,
        busy,
        safeScreenYOffset,
        true,
        npcState.modelId,
        getNpcModelVoice(this.currentLayout?.npcModelVoices, npcState.modelId),
        this.getNpcSpeechVoiceVolumeScale(npcState, anchor),
        `${npcState.modelId}:${npcState.name}`
      )
    );
  }

  addRentIntroSpeechBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds = EMPTY_VISIBLE_OVERHEAD_HEALTH_BAR_IDS) {
    const intro = this.activeRentIntro;
    if (!intro?.npcId) {
      return;
    }

    const anchor = this.getNpcHudSpeechAnchor(intro.npcId, npcSpeechAnchors);
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
    this.pushSimpleSpeechBubble(
      bubbles,
      `npc-rent-intro:${intro.seq}`,
      text,
      npcState?.name ?? '',
      'npc',
      projected,
      screenYOffset
    );
  }

  addNpcInteractionHintBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds = EMPTY_VISIBLE_OVERHEAD_HEALTH_BAR_IDS) {
    const worldBuilderInteractables = this.getWorldBuilderInteractables();
    const {
      deliveryInteraction,
      gymCheckInInteraction,
      stockMarketInteraction,
      blackjackInteraction,
      schoolMicrogameInteraction,
      bartenderInteraction,
      pawnShopOwnerInteraction,
      carDealerInteraction,
      marthaInteraction,
      interactable
    } = this.getNpcInteractionHintState(worldBuilderInteractables);
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

    const anchor = this.getNpcHudSpeechAnchor(npcId, npcSpeechAnchors);
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
      this.pushSimpleSpeechBubble(
        bubbles,
        `npc-gym-check-in:${npcId}`,
        GYM_CHECK_IN_LINE,
        npcState?.name ?? interactable?.npc?.name ?? '',
        'npc',
        projected,
        screenYOffset
      );
      return;
    }

    if (deliveryInteraction) {
      this.pushSimpleSpeechBubble(
        bubbles,
        `npc-delivery:${npcId}:${deliveryInteraction.kind}`,
        deliveryInteraction.overheadText,
        deliveryInteraction.label ?? '',
        deliveryInteraction.variant ?? 'interaction',
        projected,
        screenYOffset
      );
      return;
    }

    if (stockMarketInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-stock-market:${npcId}`, 'E to trade stocks', '', 'interaction', projected, screenYOffset);
      return;
    }

    if (blackjackInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-blackjack:${npcId}`, 'E to play blackjack', '', 'interaction', projected, screenYOffset);
      return;
    }

    if (schoolMicrogameInteraction) {
      const game = schoolMicrogameInteraction.gameId === SCHOOL_MICROGAME_ALL_ID
        ? null
        : getSchoolMicrogameDefinition(schoolMicrogameInteraction.gameId);
      this.pushSimpleSpeechBubble(
        bubbles,
        `npc-school-microgame:${npcId}`,
        game ? `E to play ${game.shortTitle ?? game.title}` : 'E to play school microgame',
        '',
        'interaction',
        projected,
        screenYOffset
      );
      return;
    }

    if (bartenderInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-bartender:${npcId}`, 'E to order drinks', '', 'interaction', projected, screenYOffset);
      return;
    }

    if (pawnShopOwnerInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-pawn-shop:${npcId}`, 'E to browse pawn shop', '', 'interaction', projected, screenYOffset);
      return;
    }

    if (carDealerInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-car-dealer:${npcId}`, 'E to browse cars', '', 'interaction', projected, screenYOffset);
      return;
    }

    if (marthaInteraction) {
      this.pushSimpleSpeechBubble(bubbles, `npc-martha:${npcId}`, 'E to order food', '', 'interaction', projected, screenYOffset);
      return;
    }

    this.pushSimpleSpeechBubble(bubbles, `npc-interaction:${npcId}`, 'Enter to chat', '', 'interaction', projected, screenYOffset);
  }

  collectOverheadHealthBar(id, anchor, health = 0, maxHealth = 100, alive = true, variant = 'npc') {
    const safeMaxHealth = Math.max(1, Number(maxHealth) || 1);
    const currentHealth = Math.max(0, Math.min(safeMaxHealth, Number(health) || 0));
    if (!alive || currentHealth >= safeMaxHealth) {
      return null;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return null;
    }

    let bar = this.overheadHealthBarRecords.get(id);
    if (!bar) {
      bar = {
        id,
        variant,
        visible: true,
        health: 0,
        maxHealth: 0,
        healthRatio: 0,
        screenX: 0,
        screenY: 0
      };
      this.overheadHealthBarRecords.set(id, bar);
    }
    bar.variant = variant;
    bar.visible = true;
    bar.health = currentHealth;
    bar.maxHealth = safeMaxHealth;
    bar.healthRatio = currentHealth / safeMaxHealth;
    bar.screenX = projected.x;
    bar.screenY = projected.y;
    return bar;
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

    this.npcHudSpeechAnchors.clear();
    return this.npcHudSpeechAnchors;
  }

  getNpcHudSpeechAnchor(npcId = '', npcSpeechAnchors = this.npcHudSpeechAnchors) {
    const id = String(npcId ?? '');
    if (!id || !this.worldBuilder || this.currentInterior?.scene) {
      return null;
    }

    if (npcSpeechAnchors?.has?.(id)) {
      return npcSpeechAnchors.get(id) ?? null;
    }

    const anchor = this.worldBuilder.getNpcSpeechAnchor?.(id)
      ?? this.worldBuilder.getNpcSpeechAnchors?.()?.get(id)
      ?? null;
    if (anchor && npcSpeechAnchors?.set) {
      npcSpeechAnchors.set(id, anchor);
    }
    return anchor;
  }

  updateOverheadHealthBars(npcSpeechAnchors = EMPTY_NPC_SPEECH_ANCHORS) {
    const visibleIds = this.visibleOverheadHealthBarIds;
    const bars = this.overheadHealthBars;
    visibleIds.clear();
    bars.length = 0;

    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      this.overheadHealthBarRecords.clear();
      this.hud.setOverheadHealthBars(bars);
      return visibleIds;
    }

    const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
    if (localPlayerState) {
      const bar = this.collectOverheadHealthBar(
        `player:${this.npcServiceState.sessionId}`,
        this.player.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        localPlayerState.health,
        localPlayerState.maxHealth,
        localPlayerState.alive !== false,
        'self'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    for (const sessionId of this.remotePlayers.keys()) {
      const avatar = this.remotePlayers.get(sessionId);
      const playerState = this.npcServiceState.players.get(sessionId);
      if (!playerState) {
        continue;
      }

      const bar = this.collectOverheadHealthBar(
        `player:${sessionId}`,
        avatar.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        playerState.health,
        playerState.maxHealth,
        playerState.alive !== false,
        'player'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    for (const npcId of this.npcServiceState.npcs.keys()) {
      const npcState = this.npcServiceState.npcs.get(npcId);
      const safeMaxHealth = Math.max(1, Number(npcState.maxHealth) || 1);
      const currentHealth = Math.max(0, Math.min(safeMaxHealth, Number(npcState.health) || 0));
      if (npcState.alive === false || currentHealth >= safeMaxHealth) {
        continue;
      }

      const anchor = this.getNpcHudSpeechAnchor(npcId, npcSpeechAnchors);
      if (!anchor) {
        continue;
      }

      const bar = this.collectOverheadHealthBar(
        `npc:${npcId}`,
        anchor,
        currentHealth,
        safeMaxHealth,
        true,
        'npc'
      );
      this.pushOverheadHealthBar(bars, bar);
      if (bar) {
        visibleIds.add(bar.id);
      }
    }

    for (const id of this.overheadHealthBarRecords.keys()) {
      if (!visibleIds.has(id)) {
        this.overheadHealthBarRecords.delete(id);
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
      this.speechBubbleRecordActiveIds.clear();
      this.speechBubbleRecords.clear();
      this.hud.setSpeechBubbles([]);
      return;
    }

    const bubbles = this.speechBubbles;
    bubbles.length = 0;
    this.speechBubbleRecordActiveIds.clear();
    const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
    if (localPlayerState) {
      this.addPlayerSpeechBubble(
        bubbles,
        this.npcServiceState.sessionId,
        localPlayerState,
        this.player.getSpeechAnchorWorldPosition(this.speechAnchorScratch),
        'self',
        visibleOverheadHealthBarIds.has(`player:${this.npcServiceState.sessionId}`)
          ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
          : 0
      );
    }

    for (const sessionId of this.remotePlayers.keys()) {
      const avatar = this.remotePlayers.get(sessionId);
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
        visibleOverheadHealthBarIds.has(`player:${sessionId}`)
          ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
          : 0
      );
    }

    for (const npcId of this.npcServiceState.npcs.keys()) {
      const npcState = this.npcServiceState.npcs.get(npcId);
      if (
        this.isRentIntroReservedNpc(npcId)
        || !this.isSpeechBubbleActiveState(
          npcState.chatText,
          npcState.chatStartedAt,
          npcState.chatStatus ?? 'done',
          Boolean(npcState.busy)
        )
      ) {
        continue;
      }

      const anchor = this.getNpcHudSpeechAnchor(npcId, npcSpeechAnchors);
      if (!anchor) {
        continue;
      }

      this.addNpcSpeechBubble(
        bubbles,
        npcId,
        npcState,
        anchor,
        visibleOverheadHealthBarIds.has(`npc:${npcId}`)
          ? OVERHEAD_HEALTH_BAR_BUBBLE_OFFSET_PX
          : 0
      );
    }

    this.addRentIntroSpeechBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds);
    this.addNpcInteractionHintBubble(bubbles, npcSpeechAnchors, visibleOverheadHealthBarIds);
    this.addMoneyFloaterBubbles(bubbles);
    this.addSkillXpFloaterBubbles(bubbles);
    this.pruneSpeechBubbleRecords();
    this.hud.setSpeechBubbles(bubbles);
  }
}
