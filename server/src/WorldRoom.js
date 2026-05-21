import { CloseCode, Room } from '@colyseus/core';
import { MapSchema, schema } from '@colyseus/schema';
import {
  COMBAT_RESPAWN_POINTS,
  DROPPED_PICKUP_DESPAWN_MS,
  PICKUP_INTERACT_RADIUS,
  PUNCH_DAMAGE,
  PUNCH_INTERVAL_MS,
  PUNCH_RANGE,
  PICKUP_RESPAWN_MS,
  PLAYER_MAX_ACCEPTED_SPEED,
  PLAYER_MAX_HEALTH,
  PLAYER_POSITION_FORGIVENESS,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  WEAPON_CLIP_SIZE,
  WEAPON_DAMAGE,
  WEAPON_FIRE_INTERVAL_MS,
  WEAPON_IDS,
  WEAPON_RANGE,
  WEAPON_RELOAD_MS,
  WEAPON_RESERVE_CAP
} from '../../src/shared/combatConstants.js';
import {
  PLAYER_RESPAWN_COST,
  getHospitalRespawnPoint
} from '../../src/shared/respawnRules.js';
import { getCombatPickupSpawnDefinitions } from '../../src/shared/combatPickupDefinitions.js';
import {
  applyWeaponPickupToPlayerState,
  canEquipInventoryWeapon,
  normalizeEquippableWeaponId
} from '../../src/shared/combatInventoryRules.js';
import { tickHealthRegen } from '../../src/shared/combatRegen.js';
import {
  hasInventoryWeapon,
  serializeWeaponInventoryIds
} from '../../src/shared/weaponInventory.js';
import {
  DELIVERY_QUEST_ID,
  DELIVERY_QUEST_REWARD_AMOUNT,
  DELIVERY_QUEST_STATUS,
  addDeliveryQuestRecentTargetId,
  getDeliveryQuestTargetCandidate,
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver,
  isNpcAvailableForDelivery
} from '../../src/shared/deliveryQuest.js';
import {
  GYM_CHECK_IN_PURCHASED_LINE,
  GYM_DOOR_BLOCKER_RADIUS,
  GYM_MEMBERSHIP_COST,
  getGymCheckInPromptRadius,
  isGymCheckInNpc
} from '../../src/shared/gymMembership.js';
import { resolveRentIntroPlan } from '../../src/shared/rentIntro.js';
import {
  isMissionSelectable,
  normalizeMissionId,
  resolveSelectedMissionId
} from '../../src/shared/missions.js';
import { normalizeNpcVoice } from '../../src/shared/npcVoice.js';
import {
  executeStockTrade,
  getStockMarketPromptRadius,
  hasStockPortfolioSnapshotEntries,
  isStockMarketNpc,
  normalizeStockPortfolioSnapshot,
  serializeStockMarket
} from '../../src/shared/stockMarket.js';
import {
  addPlayerDrink,
  clearPlayerDrunkness,
  consumePlayerDrink,
  getBartenderMenuItem,
  getBartenderPromptRadius,
  getPlayerDrinkInventorySnapshot,
  getDrunknessLevelForDose,
  isBartenderNpc,
  normalizeDrinkInventoryCount,
  normalizeDrunknessDose,
  refreshPlayerDrunkness
} from '../../src/shared/bartender.js';
import {
  addPlayerPawnShopItem,
  consumePlayerPawnShopItem,
  getPawnShopMenuItem,
  getPawnShopPromptRadius,
  getPlayerPawnShopInventorySnapshot,
  isPlayerPawnShopItemOwned,
  isPawnShopOwnerNpc,
  normalizePawnShopInventoryCount
} from '../../src/shared/pawnShop.js';
import {
  addPlayerMarthaItem,
  consumePlayerMarthaItem,
  getMarthaMenuItem,
  getMarthaPromptRadius,
  getPlayerMarthaInventorySnapshot,
  isMarthaNpc,
  normalizeMarthaInventoryCount
} from '../../src/shared/martha.js';
import {
  SKATEBOARD_ITEM_ID,
  SKATEBOARD_SPEED_MULTIPLIER,
  isPlayerSkateboardOwner,
  normalizeSkateboardOwned
} from '../../src/shared/skateboard.js';
import {
  CAR_VEHICLE_SPEED_MULTIPLIER,
  getCarDealerMenuItem,
  getCarDealerPromptRadius,
  getPlayerDefaultVehicleItemId,
  getPlayerVehicleInventorySnapshot,
  isCarDealerNpc,
  isPlayerVehicleOwner,
  normalizePlayerVehicleItemId,
  playerOwnsVehicleItem,
  selectPlayerVehicleItem,
  serializePlayerOwnedVehicleItemIds,
  setPlayerVehicleItem
} from '../../src/shared/carDealer.js';
import {
  BLACKJACK_MAX_WAGER,
  canDoubleBlackjackSession,
  canSplitBlackjackSession,
  createBlackjackSession,
  doubleBlackjackSession,
  getBlackjackDoubleWager,
  getBlackjackPromptRadius,
  getBlackjackSplitWager,
  hitBlackjackSession,
  isBlackjackDealerNpc,
  normalizeBlackjackWager,
  serializeBlackjackSession,
  splitBlackjackSession,
  standBlackjackSession
} from '../../src/shared/blackjack.js';
import {
  SCHOOL_MICROGAME_ALL_ID,
  getSchoolMicrogamePromptRadius,
  getSchoolMicrogameReward,
  isSchoolMicrogameNpc,
  normalizeSchoolMicrogameId
} from '../../src/shared/schoolMicrogames.js';
import {
  OFFICE_JOB_IDS,
  OFFICE_JOB_TERMINAL_ITEM_ID,
  OFFICE_JOB_TERMINAL_RADIUS,
  canPlayerWorkOfficeJob,
  getOfficeJobDefinition,
  getOfficeJobLockedMessage,
  getPlayerOfficeJobIntelligenceLevel,
  getOfficeJobReward
} from '../../src/shared/officeJobs.js';
import {
  OFFICE_BUILDING_ITEM_ID,
  OFFICE_INTERIOR_STATION_TYPES,
  getOfficeInteriorFloorHeight,
  getOfficeInteriorStationDefinition,
  parseOfficeInteriorStationPlacementId
} from '../../src/shared/officeInteriorLayout.js';
import {
  AGILITY_DISTANCE_PER_XP,
  AGILITY_MAX_XP_PER_UPDATE,
  AGILITY_MIN_DISTANCE,
  BASKETBALL_SHOT_AGILITY_XP,
  BASKETBALL_SHOT_STRENGTH_XP,
  CHARISMA_NPC_CHAT_XP,
  CHARISMA_VIBE_HERO_XP,
  SKILL_IDS,
  STRENGTH_SNATCH_XP,
  applySkillXpToPlayer,
  getCharismaDrinkXp,
  getPlayerSkillXp,
  getSkillLevelFromXp,
  normalizeSkillId
} from '../../src/shared/skills.js';
import { normalizeVibeHeroSongId } from '../../src/shared/vibeHero.js';
import { getTileCenterWorldPosition, rotateFootprintOffset } from '../../src/shared/tileFootprint.js';
import {
  chooseFarthestSpawnPoint,
  clampToWorldBounds,
  distance2D,
  distanceSquared2D,
  normalizeAimVector,
  rayCircleIntersectionDistance,
  rayRectIntersectionDistance
} from '../../src/shared/combatMath.js';
import {
  normalizeRotationQuarterTurns,
  quantizePosition,
  quantizeRotation,
  rotationQuarterTurnsToRadians as toRotationY,
  rotationRadiansToQuarterTurns as quantizeRotationQuarterTurnsFromRotationY
} from '../../src/shared/numberMath.js';
import {
  getDefaultPropPlacementScale,
  normalizePropPlacementScale
} from '../../src/shared/placementScale.js';
import {
  cloneNpcBehavior,
  NPC_DEFAULT_INTERACT_RADIUS,
  NPC_DEFAULT_LAW_RADIUS,
  NPC_DEFAULT_MAX_HEALTH,
  NPC_RUNTIME_MODES,
  normalizeNpcBehavior,
  shouldResetNpcRuntimeForBehaviorUpdate
} from '../../src/npc/npcBehavior.js';
import { getNpcModelById } from '../../src/npc/npcCatalog.js';
import { createNpcRuntimeMeta, npcSimulationMethods } from '../../src/npc/npcSimulationMethods.js';
import { buildNpcRouteGraph } from '../../src/npc/npcRouteGraph.js';
import {
  getPlacementApproachPoint,
  getPlacementWorldOrigin,
  isBuildingPlacement
} from '../../src/npc/npcTargeting.js';
import { EMOTES_BY_ID, PUNCH_EMOTE_ID, STAND_UP_EMOTE_ID } from '../../src/player/emotes.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById,
  isPlayableCharacterId
} from '../../src/player/playableCharacterCatalog.js';
import { getBuilderItemById } from '../../src/world/builderCatalog.js';
import { WorldState } from '../../src/world/WorldState.js';
import { NpcChatEngine } from './NpcChatEngine.js';
import { isNpcDebugEnabled, logNpcDebug, logServer, logServerError } from './logger.js';
import { getWorldPersistence } from './worldPersistence.js';
import { getPlayerSnapshots, normalizePlayerSnapshotId } from './playerSnapshots.js';
import { getPlayerAccounts } from './playerAccounts.js';
import { getSupabaseAuthInfo, verifySupabaseAccessToken } from './supabaseAuth.js';
import { getStockMarketPersistence } from './stockMarketPersistence.js';

const MAX_MESSAGE_LENGTH = 280;
const MAX_TRANSCRIPT_ENTRIES = 18;
const CHAT_COOLDOWN_MS = 900;
const NPC_NAME_MAX_LENGTH = 40;
const NPC_PROMPT_MAX_LENGTH = 1600;
const NPC_STREAM_THROTTLE_MS = 80;
const COMBAT_TICK_MS = 100;
const LIMP_EMOTE_ID = 'limp';
const SHOT_BLOCKER_EPSILON = PLAYER_RADIUS * 0.9;
const SHOT_ORIGIN_MAX_OFFSET = PLAYER_RADIUS * 2.4;
const SHOT_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 1.5;
const PUNCH_WORLD_BLOCKER_GRACE_DISTANCE = PLAYER_RADIUS * 0.55;
const NPC_REPATH_MS = 900;
const NPC_SHOT_INTERVAL_MS = WEAPON_FIRE_INTERVAL_MS * 2;
const NPC_PUNCH_INTERVAL_MS = PUNCH_INTERVAL_MS * 2;
const NPC_COMBAT_REACH_BUFFER = 1.2;
const NPC_TARGET_STOP_DISTANCE = 0.7;
const NPC_SHOT_ORIGIN_FORWARD_OFFSET = PLAYER_RADIUS * 1.15;
const NPC_PATH_TURN_LOOKAHEAD_DISTANCE = 3.6;
const NPC_PATH_TURN_BLEND_MAX = 0.26;
const NPC_PATH_TURN_MIN_ANGLE_DOT = 0.92;
const NPC_DEBUG_BROADCAST_INTERVAL_MS = 120;
const PLAYER_RECONNECTION_GRACE_SECONDS = 30;
const PLAYER_SNAPSHOT_AUTOSAVE_MS = 5000;

const ADMIN_JOIN_DIAGNOSTIC_LIMIT = 20;
const adminJoinDiagnostics = [];

function removeFirstArrayEntry(values) {
  if (!Array.isArray(values) || !values.length) {
    return null;
  }
  const entry = values[0];
  for (let index = 1; index < values.length; index += 1) {
    values[index - 1] = values[index];
  }
  values.length -= 1;
  return entry;
}

function recordAdminJoinDiagnostic(diagnostic = {}) {
  adminJoinDiagnostics.push({
    at: new Date().toISOString(),
    ...diagnostic
  });
  while (adminJoinDiagnostics.length > ADMIN_JOIN_DIAGNOSTIC_LIMIT) {
    removeFirstArrayEntry(adminJoinDiagnostics);
  }
}

function normalizeTransformSeq(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function getWorldRoomAdminDiagnostics() {
  const recentJoins = [];
  const startIndex = Math.max(0, adminJoinDiagnostics.length - ADMIN_JOIN_DIAGNOSTIC_LIMIT);
  for (let index = startIndex; index < adminJoinDiagnostics.length; index += 1) {
    recentJoins.push(adminJoinDiagnostics[index]);
  }
  return {
    adminSource: 'supabase',
    urlAdminKeysAccepted: false,
    recentJoins
  };
}

const PlayerTransformState = schema({
  x: 'number',
  y: 'number',
  z: 'number',
  rotationY: 'number',
  aimRotationY: 'number',
  aiming: 'boolean',
  skating: 'boolean',
  transformSeq: 'number'
});

const PlayerAnimationState = schema({
  emoteId: 'string',
  emoteActive: 'boolean',
  emoteStartedAt: 'number',
  emoteSeq: 'number'
});

const PlayerChatState = schema({
  chatText: 'string',
  chatStartedAt: 'number',
  chatSeq: 'number'
});

const PlayerCombatState = schema({
  health: 'number',
  maxHealth: 'number',
  alive: 'boolean',
  respawnAt: 'number',
  spawnProtectedUntil: 'number',
  equippedWeaponId: 'string',
  ownedWeaponIds: 'string',
  ammoInClip: 'number',
  reserveAmmo: 'number',
  isReloading: 'boolean',
  reloadEndsAt: 'number',
  kills: 'number',
  deaths: 'number',
  lastDamagedAt: 'number'
});

const PlayerInventoryState = schema({
  money: 'number',
  beerCount: 'number',
  shotCount: 'number',
  cigaretteCount: 'number',
  burgerCount: 'number',
  glizzyCount: 'number',
  sodaCount: 'number',
  skateboardOwned: 'boolean',
  vehicleItemId: 'string',
  ownedVehicleItemIds: 'string',
  drunknessDose: 'number',
  drunknessLevel: 'number',
  drunknessEndsAt: 'number',
  gymMembershipActive: 'boolean'
});

const PlayerRentIntroState = schema({
  rentIntroSeq: 'number',
  rentIntroAmount: 'number',
  rentIntroNpcId: 'string',
  rentIntroBuildingPlacementId: 'string',
  rentIntroStartedAt: 'number'
});

const PlayerDeliveryQuestState = schema({
  deliveryQuestId: 'string',
  deliveryQuestStatus: 'string',
  deliveryQuestGiverNpcId: 'string',
  deliveryQuestTargetNpcId: 'string',
  deliveryQuestAcceptedAt: 'number',
  deliveryQuestCompletedAt: 'number',
  deliveryQuestRecentTargetNpcIds: 'string',
  deliveryQuestCompletionCount: 'number'
});

const PlayerActivityState = schema({
  workoutPlacementId: 'string',
  gymPumpCompletedAt: 'number',
  stockBoughtAt: 'number',
  blackjackHandPlayedAt: 'number',
  schoolTasksCompletedCount: 'number',
  janitorTasksCompletedCount: 'number',
  officeManagerCompletedAt: 'number',
  ceoCompletedAt: 'number'
});

const PlayerSkillState = schema({
  strengthXp: 'number',
  agilityXp: 'number',
  intelligenceXp: 'number',
  charismaXp: 'number',
  skillAwardSeq: 'number',
  skillAwardSkillId: 'string',
  skillAwardXpGained: 'number',
  skillAwardOldLevel: 'number',
  skillAwardNewLevel: 'number',
  skillAwardAt: 'number'
});

const PlayerProfileState = schema({
  selectedMissionId: 'string',
  characterId: 'string'
});

// Colyseus schema fields use 6-bit indexes. Keep PlayerState grouped so future
// feature fields expand nested schemas instead of overflowing the top-level budget.
const PlayerState = schema({
  isAdmin: 'boolean',
  transform: PlayerTransformState,
  animation: PlayerAnimationState,
  chat: PlayerChatState,
  combat: PlayerCombatState,
  inventory: PlayerInventoryState,
  rentIntro: PlayerRentIntroState,
  deliveryQuest: PlayerDeliveryQuestState,
  activity: PlayerActivityState,
  skills: PlayerSkillState,
  profile: PlayerProfileState
});

const PLAYER_STATE_SECTIONS = [
  {
    section: 'transform',
    type: PlayerTransformState,
    fields: ['x', 'y', 'z', 'rotationY', 'aimRotationY', 'aiming', 'skating', 'transformSeq']
  },
  {
    section: 'animation',
    type: PlayerAnimationState,
    fields: ['emoteId', 'emoteActive', 'emoteStartedAt', 'emoteSeq']
  },
  {
    section: 'chat',
    type: PlayerChatState,
    fields: ['chatText', 'chatStartedAt', 'chatSeq']
  },
  {
    section: 'combat',
    type: PlayerCombatState,
    fields: [
      'health',
      'maxHealth',
      'alive',
      'respawnAt',
      'spawnProtectedUntil',
      'equippedWeaponId',
      'ownedWeaponIds',
      'ammoInClip',
      'reserveAmmo',
      'isReloading',
      'reloadEndsAt',
      'kills',
      'deaths',
      'lastDamagedAt'
    ]
  },
  {
    section: 'inventory',
    type: PlayerInventoryState,
    fields: [
      'money',
      'beerCount',
      'shotCount',
      'cigaretteCount',
      'burgerCount',
      'glizzyCount',
      'sodaCount',
      'skateboardOwned',
      'vehicleItemId',
      'ownedVehicleItemIds',
      'drunknessDose',
      'drunknessLevel',
      'drunknessEndsAt',
      'gymMembershipActive'
    ]
  },
  {
    section: 'rentIntro',
    type: PlayerRentIntroState,
    fields: ['rentIntroSeq', 'rentIntroAmount', 'rentIntroNpcId', 'rentIntroBuildingPlacementId', 'rentIntroStartedAt']
  },
  {
    section: 'deliveryQuest',
    type: PlayerDeliveryQuestState,
    fields: [
      'deliveryQuestId',
      'deliveryQuestStatus',
      'deliveryQuestGiverNpcId',
      'deliveryQuestTargetNpcId',
      'deliveryQuestAcceptedAt',
      'deliveryQuestCompletedAt',
      'deliveryQuestRecentTargetNpcIds',
      'deliveryQuestCompletionCount'
    ]
  },
  {
    section: 'activity',
    type: PlayerActivityState,
    fields: [
      'workoutPlacementId',
      'gymPumpCompletedAt',
      'stockBoughtAt',
      'blackjackHandPlayedAt',
      'schoolTasksCompletedCount',
      'janitorTasksCompletedCount',
      'officeManagerCompletedAt',
      'ceoCompletedAt'
    ]
  },
  {
    section: 'skills',
    type: PlayerSkillState,
    fields: [
      'strengthXp',
      'agilityXp',
      'intelligenceXp',
      'charismaXp',
      'skillAwardSeq',
      'skillAwardSkillId',
      'skillAwardXpGained',
      'skillAwardOldLevel',
      'skillAwardNewLevel',
      'skillAwardAt'
    ]
  },
  {
    section: 'profile',
    type: PlayerProfileState,
    fields: ['selectedMissionId', 'characterId']
  }
];

function getPlayerStateSection(player, section, SectionState) {
  if (!player[section]) {
    player[section] = new SectionState();
  }
  return player[section];
}

function definePlayerStateAliases() {
  for (const { section, type, fields } of PLAYER_STATE_SECTIONS) {
    for (const field of fields) {
      Object.defineProperty(PlayerState.prototype, field, {
        get() {
          return getPlayerStateSection(this, section, type)[field];
        },
        set(value) {
          getPlayerStateSection(this, section, type)[field] = value;
        },
        enumerable: false,
        configurable: true
      });
    }
  }
}

definePlayerStateAliases();

const PickupState = schema({
  id: 'string',
  weaponId: 'string',
  x: 'number',
  z: 'number',
  ammoInClip: 'number',
  reserveAmmo: 'number',
  kind: 'string',
  active: 'boolean',
  respawnAt: 'number',
  despawnAt: 'number'
});

const BuilderPresenceState = schema({
  active: 'boolean',
  itemId: 'string',
  layer: 'string',
  rotationQuarterTurns: 'number',
  rotationY: 'number',
  scale: 'number',
  cellX: 'number',
  cellZ: 'number',
  x: 'number',
  z: 'number',
  selectionPlacementId: 'string'
});

const NpcState = schema({
  id: 'string',
  modelId: 'string',
  name: 'string',
  x: 'number',
  z: 'number',
  rotationY: 'number',
  rotationQuarterTurns: 'number',
  interactRadius: 'number',
  policeOfficerEnabled: 'boolean',
  lawRadius: 'number',
  deliveryQuestEnabled: 'boolean',
  gymCheckInEnabled: 'boolean',
  rentCollectorEnabled: 'boolean',
  stockMarketEnabled: 'boolean',
  bartenderEnabled: 'boolean',
  pawnShopOwnerEnabled: 'boolean',
  carDealerEnabled: 'boolean',
  marthaEnabled: 'boolean',
  blackjackDealerEnabled: 'boolean',
  schoolMicrogameEnabled: 'boolean',
  schoolMicrogameId: 'string',
  health: 'number',
  maxHealth: 'number',
  alive: 'boolean',
  respawnAt: 'number',
  active: 'boolean',
  mode: 'string',
  currentStepIndex: 'number',
  targetPlacementId: 'string',
  weaponId: 'string',
  lastAttackerId: 'string',
  hiddenUntil: 'number',
  activity: 'string',
  lastDamagedAt: 'number',
  busy: 'boolean',
  chatStatus: 'string',
  chatText: 'string',
  chatStartedAt: 'number',
  chatSeq: 'number'
});

const WorldRoomState = schema({
  connectedPlayerCount: 'number',
  players: {
    map: PlayerState,
    default: new MapSchema()
  },
  builders: {
    map: BuilderPresenceState,
    default: new MapSchema()
  },
  npcs: {
    map: NpcState,
    default: new MapSchema()
  },
  pickups: {
    map: PickupState,
    default: new MapSchema()
  }
});

function trimTranscript(entries) {
  const trimmed = [];
  const startIndex = Math.max(0, entries.length - MAX_TRANSCRIPT_ENTRIES);
  for (let index = startIndex; index < entries.length; index += 1) {
    trimmed.push(entries[index]);
  }
  return trimmed;
}

function createTranscriptEntry(id, speaker, author, text) {
  return {
    id,
    speaker,
    author,
    text,
    createdAt: Date.now()
  };
}

function sanitizePlayerAnimationState(message = {}) {
  const emoteId = typeof message.emoteId === 'string' ? message.emoteId.trim() : '';
  const hasValidEmote = emoteId === LIMP_EMOTE_ID || Object.hasOwn(EMOTES_BY_ID, emoteId);
  const emoteActive = Boolean(message.emoteActive && hasValidEmote);
  const emoteStartedAt = Number(message.emoteStartedAt);
  const emoteSeq = Number(message.emoteSeq);
  const aimRotationY = Number(message.aimRotationY);

  return {
    emoteId: emoteActive ? emoteId : '',
    emoteActive,
    emoteStartedAt: emoteActive && Number.isFinite(emoteStartedAt) ? Math.max(0, Math.floor(emoteStartedAt)) : 0,
    emoteSeq: Number.isFinite(emoteSeq) ? Math.max(0, Math.floor(emoteSeq)) : 0,
    aimRotationY: Number.isFinite(aimRotationY) ? quantizeRotation(aimRotationY) : 0,
    aiming: Boolean(message.aiming),
    skating: Boolean(message.skating)
  };
}

function sanitizeCharacterId(characterId) {
  if (typeof characterId !== 'string') {
    return DEFAULT_PLAYABLE_CHARACTER_ID;
  }

  const normalized = characterId.trim();
  return isPlayableCharacterId(normalized)
    ? normalized
    : getPlayableCharacterById(DEFAULT_PLAYABLE_CHARACTER_ID).id;
}

function clampNpcRadius(value) {
  const numeric = Number(value ?? 4.2);
  return Math.max(1.5, Math.min(12, Number.isFinite(numeric) ? numeric : 4.2));
}

function clampNpcLawRadius(value) {
  const numeric = Number(value ?? NPC_DEFAULT_LAW_RADIUS);
  return Math.max(4, Math.min(120, Number.isFinite(numeric) ? numeric : NPC_DEFAULT_LAW_RADIUS));
}

function defaultNpcPrompt(label) {
  return `You are ${label}, an NPC in Vibe Theft Auto. Stay in character, keep answers grounded in the city, and respond in short, flavorful lines.`;
}

function createPickupState(definition, {
  kind = 'spawn',
  active = true,
  respawnAt = 0,
  despawnAt = 0
} = {}) {
  const pickup = new PickupState();
  pickup.id = definition.id;
  pickup.weaponId = definition.weaponId;
  pickup.x = quantizePosition(definition.x ?? definition.position?.[0]);
  pickup.z = quantizePosition(definition.z ?? definition.position?.[1]);
  pickup.ammoInClip = Math.max(0, Math.floor(definition.ammoInClip ?? 0));
  pickup.reserveAmmo = Math.max(0, Math.floor(definition.reserveAmmo ?? 0));
  pickup.kind = kind;
  pickup.active = active;
  pickup.respawnAt = Math.max(0, Math.floor(respawnAt));
  pickup.despawnAt = Math.max(0, Math.floor(despawnAt));
  return pickup;
}

function sanitizeSnapshotNumber(value, fallback = 0, {
  integer = false,
  min = -Infinity,
  max = Infinity
} = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const clamped = Math.max(min, Math.min(max, numeric));
  return integer ? Math.floor(clamped) : clamped;
}

function sanitizeSnapshotBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeSnapshotString(value, fallback = '', maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback;
}

function sanitizeJoinDisplayName(value = '') {
  const normalized = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return normalized ? normalized.slice(0, 32) : '';
}

function clonePlainObject(value = null) {
  const clone = {};
  if (!value || typeof value !== 'object') {
    return clone;
  }

  for (const key in value) {
    if (Object.hasOwn(value, key)) {
      clone[key] = value[key];
    }
  }
  return clone;
}

const SNAPSHOT_WEAPON_IDS = new Set([
  WEAPON_IDS.pistol
]);

function isSnapshotWeaponId(value = '') {
  return SNAPSHOT_WEAPON_IDS.has(String(value ?? '').trim());
}

function sanitizeCharacterStockPortfoliosSnapshot(stockPortfolios = {}) {
  const output = {};
  if (!stockPortfolios || typeof stockPortfolios !== 'object' || Array.isArray(stockPortfolios)) {
    return output;
  }

  for (const characterId in stockPortfolios) {
    if (!Object.hasOwn(stockPortfolios, characterId)) {
      continue;
    }
    const normalizedCharacterId = sanitizeCharacterId(characterId);
    const normalizedPortfolio = normalizeStockPortfolioSnapshot(stockPortfolios[characterId]);
    if (hasStockPortfolioSnapshotEntries(normalizedPortfolio)) {
      output[normalizedCharacterId] = normalizedPortfolio;
    }
  }

  return output;
}

function restoreCharacterStockPortfoliosSnapshot(snapshot = {}, fallbackCharacterId = DEFAULT_PLAYABLE_CHARACTER_ID) {
  const output = sanitizeCharacterStockPortfoliosSnapshot(snapshot?.stockPortfolios);
  const legacyPortfolio = normalizeStockPortfolioSnapshot(snapshot?.stockPortfolio);
  if (hasStockPortfolioSnapshotEntries(legacyPortfolio)) {
    const legacyCharacterId = sanitizeCharacterId(snapshot?.player?.characterId ?? fallbackCharacterId);
    output[legacyCharacterId] = {
      ...(output[legacyCharacterId] ?? {}),
      ...legacyPortfolio
    };
  }

  return output;
}

function createPlayerSnapshotPayload(player, stockPortfolios = {}) {
  const characterId = sanitizeCharacterId(player?.characterId);
  const normalizedStockPortfolios = sanitizeCharacterStockPortfoliosSnapshot(stockPortfolios);
  const vehicleInventory = getPlayerVehicleInventorySnapshot(player);
  return {
    player: {
      x: player.x,
      y: player.y,
      z: player.z,
      rotationY: player.rotationY,
      aimRotationY: player.aimRotationY,
      health: player.health,
      maxHealth: player.maxHealth,
      alive: player.alive,
      respawnAt: player.respawnAt,
      spawnProtectedUntil: player.spawnProtectedUntil,
      equippedWeaponId: player.equippedWeaponId,
      ownedWeaponIds: player.ownedWeaponIds,
      ammoInClip: player.ammoInClip,
      reserveAmmo: player.reserveAmmo,
      isReloading: player.isReloading,
      reloadEndsAt: player.reloadEndsAt,
      kills: player.kills,
      deaths: player.deaths,
      money: player.money,
      beerCount: player.beerCount,
      shotCount: player.shotCount,
      cigaretteCount: player.cigaretteCount,
      burgerCount: player.burgerCount,
      glizzyCount: player.glizzyCount,
      sodaCount: player.sodaCount,
      skateboardOwned: vehicleInventory.skateboardOwned,
      vehicleItemId: vehicleInventory.vehicleItemId,
      ownedVehicleItemIds: vehicleInventory.ownedVehicleItemIds,
      drunknessDose: player.drunknessDose,
      drunknessLevel: player.drunknessLevel,
      drunknessEndsAt: player.drunknessEndsAt,
      gymMembershipActive: player.gymMembershipActive,
      rentIntroSeq: player.rentIntroSeq,
      rentIntroAmount: player.rentIntroAmount,
      rentIntroNpcId: player.rentIntroNpcId,
      rentIntroBuildingPlacementId: player.rentIntroBuildingPlacementId,
      rentIntroStartedAt: player.rentIntroStartedAt,
      lastDamagedAt: player.lastDamagedAt,
      deliveryQuestId: player.deliveryQuestId,
      deliveryQuestStatus: player.deliveryQuestStatus,
      deliveryQuestGiverNpcId: player.deliveryQuestGiverNpcId,
      deliveryQuestTargetNpcId: player.deliveryQuestTargetNpcId,
      deliveryQuestAcceptedAt: player.deliveryQuestAcceptedAt,
      deliveryQuestCompletedAt: player.deliveryQuestCompletedAt,
      deliveryQuestRecentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds,
      deliveryQuestCompletionCount: player.deliveryQuestCompletionCount,
      gymPumpCompletedAt: player.gymPumpCompletedAt,
      stockBoughtAt: player.stockBoughtAt,
      blackjackHandPlayedAt: player.blackjackHandPlayedAt,
      schoolTasksCompletedCount: player.schoolTasksCompletedCount,
      janitorTasksCompletedCount: player.janitorTasksCompletedCount,
      officeManagerCompletedAt: player.officeManagerCompletedAt,
      ceoCompletedAt: player.ceoCompletedAt,
      strengthXp: player.strengthXp,
      agilityXp: player.agilityXp,
      intelligenceXp: player.intelligenceXp,
      charismaXp: player.charismaXp,
      skillAwardSeq: player.skillAwardSeq,
      skillAwardSkillId: player.skillAwardSkillId,
      skillAwardXpGained: player.skillAwardXpGained,
      skillAwardOldLevel: player.skillAwardOldLevel,
      skillAwardNewLevel: player.skillAwardNewLevel,
      skillAwardAt: player.skillAwardAt,
      selectedMissionId: player.selectedMissionId,
      characterId: player.characterId
    },
    stockPortfolio: normalizedStockPortfolios[characterId] ?? {},
    stockPortfolios: normalizedStockPortfolios
  };
}

function applyPlayerSnapshotPayload(player, snapshot = {}) {
  const saved = snapshot?.player;
  if (!player || !saved || typeof saved !== 'object') {
    return false;
  }

  const now = Date.now();
  player.x = quantizePosition(saved.x);
  player.y = quantizePosition(saved.y);
  player.z = quantizePosition(saved.z);
  player.rotationY = quantizeRotation(saved.rotationY);
  player.aimRotationY = quantizeRotation(saved.aimRotationY ?? saved.rotationY);
  player.aiming = false;
  player.skating = false;
  player.emoteId = '';
  player.emoteActive = false;
  player.emoteStartedAt = 0;
  player.emoteSeq = Math.max(0, Math.floor(Number(player.emoteSeq ?? 0) || 0)) + 1;
  player.chatText = '';
  player.chatStartedAt = 0;
  player.chatSeq = 0;
  player.health = sanitizeSnapshotNumber(saved.health, PLAYER_MAX_HEALTH, { integer: true, min: 0, max: PLAYER_MAX_HEALTH });
  player.maxHealth = sanitizeSnapshotNumber(saved.maxHealth, PLAYER_MAX_HEALTH, { integer: true, min: 1, max: PLAYER_MAX_HEALTH });
  player.alive = sanitizeSnapshotBoolean(saved.alive, true);
  player.respawnAt = sanitizeSnapshotNumber(saved.respawnAt, 0, { integer: true, min: 0 });
  player.spawnProtectedUntil = sanitizeSnapshotNumber(saved.spawnProtectedUntil, 0, { integer: true, min: 0 });
  player.equippedWeaponId = isSnapshotWeaponId(saved.equippedWeaponId) ? saved.equippedWeaponId : '';
  player.ownedWeaponIds = serializeWeaponInventoryIds(saved.ownedWeaponIds || player.equippedWeaponId);
  player.ammoInClip = sanitizeSnapshotNumber(saved.ammoInClip, 0, { integer: true, min: 0, max: WEAPON_CLIP_SIZE });
  player.reserveAmmo = sanitizeSnapshotNumber(saved.reserveAmmo, 0, { integer: true, min: 0, max: WEAPON_RESERVE_CAP });
  player.isReloading = sanitizeSnapshotBoolean(saved.isReloading, false) && sanitizeSnapshotNumber(saved.reloadEndsAt, 0) > now;
  player.reloadEndsAt = player.isReloading ? sanitizeSnapshotNumber(saved.reloadEndsAt, 0, { integer: true, min: 0 }) : 0;
  player.kills = sanitizeSnapshotNumber(saved.kills, 0, { integer: true, min: 0 });
  player.deaths = sanitizeSnapshotNumber(saved.deaths, 0, { integer: true, min: 0 });
  player.money = sanitizeSnapshotNumber(saved.money, 0, { integer: true });
  player.beerCount = normalizeDrinkInventoryCount(saved.beerCount);
  player.shotCount = normalizeDrinkInventoryCount(saved.shotCount);
  player.cigaretteCount = normalizePawnShopInventoryCount(saved.cigaretteCount);
  player.burgerCount = normalizeMarthaInventoryCount(saved.burgerCount);
  player.glizzyCount = normalizeMarthaInventoryCount(saved.glizzyCount);
  player.sodaCount = normalizeMarthaInventoryCount(saved.sodaCount);
  player.skateboardOwned = normalizeSkateboardOwned(saved.skateboardOwned);
  player.ownedVehicleItemIds = serializePlayerOwnedVehicleItemIds(saved.ownedVehicleItemIds);
  player.vehicleItemId = normalizePlayerVehicleItemId(saved.vehicleItemId);
  if (player.vehicleItemId) {
    setPlayerVehicleItem(player, player.vehicleItemId);
  } else if (!Object.hasOwn(saved, 'vehicleItemId') && player.ownedVehicleItemIds) {
    player.vehicleItemId = getPlayerDefaultVehicleItemId(player);
  }
  player.drunknessDose = normalizeDrunknessDose(saved.drunknessDose);
  player.drunknessLevel = getDrunknessLevelForDose(player.drunknessDose);
  player.drunknessEndsAt = sanitizeSnapshotNumber(saved.drunknessEndsAt, 0, { integer: true, min: 0 });
  refreshPlayerDrunkness(player, now);
  player.gymMembershipActive = sanitizeSnapshotBoolean(saved.gymMembershipActive, false);
  player.rentIntroSeq = 0;
  player.rentIntroAmount = 0;
  player.rentIntroNpcId = '';
  player.rentIntroBuildingPlacementId = '';
  player.rentIntroStartedAt = 0;
  player.lastDamagedAt = sanitizeSnapshotNumber(saved.lastDamagedAt, 0, { integer: true, min: 0 });
  player.workoutPlacementId = '';
  player.deliveryQuestId = sanitizeSnapshotString(saved.deliveryQuestId, '', 80);
  player.deliveryQuestStatus = sanitizeSnapshotString(saved.deliveryQuestStatus, DELIVERY_QUEST_STATUS.inactive, 40) || DELIVERY_QUEST_STATUS.inactive;
  player.deliveryQuestGiverNpcId = sanitizeSnapshotString(saved.deliveryQuestGiverNpcId, '', 80);
  player.deliveryQuestTargetNpcId = sanitizeSnapshotString(saved.deliveryQuestTargetNpcId, '', 80);
  player.deliveryQuestAcceptedAt = sanitizeSnapshotNumber(saved.deliveryQuestAcceptedAt, 0, { integer: true, min: 0 });
  player.deliveryQuestCompletedAt = sanitizeSnapshotNumber(saved.deliveryQuestCompletedAt, 0, { integer: true, min: 0 });
  player.deliveryQuestRecentTargetNpcIds = sanitizeSnapshotString(saved.deliveryQuestRecentTargetNpcIds, '', 500);
  player.deliveryQuestCompletionCount = sanitizeSnapshotNumber(saved.deliveryQuestCompletionCount, 0, { integer: true, min: 0 });
  player.gymPumpCompletedAt = sanitizeSnapshotNumber(saved.gymPumpCompletedAt, 0, { integer: true, min: 0 });
  player.stockBoughtAt = sanitizeSnapshotNumber(saved.stockBoughtAt, 0, { integer: true, min: 0 });
  player.blackjackHandPlayedAt = sanitizeSnapshotNumber(saved.blackjackHandPlayedAt, 0, { integer: true, min: 0 });
  player.schoolTasksCompletedCount = sanitizeSnapshotNumber(saved.schoolTasksCompletedCount, 0, { integer: true, min: 0 });
  player.janitorTasksCompletedCount = sanitizeSnapshotNumber(saved.janitorTasksCompletedCount, 0, { integer: true, min: 0 });
  player.officeManagerCompletedAt = sanitizeSnapshotNumber(saved.officeManagerCompletedAt, 0, { integer: true, min: 0 });
  player.ceoCompletedAt = sanitizeSnapshotNumber(saved.ceoCompletedAt, 0, { integer: true, min: 0 });
  player.strengthXp = sanitizeSnapshotNumber(saved.strengthXp, 0, { integer: true, min: 0 });
  player.agilityXp = sanitizeSnapshotNumber(saved.agilityXp, 0, { integer: true, min: 0 });
  player.intelligenceXp = sanitizeSnapshotNumber(saved.intelligenceXp, 0, { integer: true, min: 0 });
  player.charismaXp = sanitizeSnapshotNumber(saved.charismaXp, 0, { integer: true, min: 0 });
  player.skillAwardSeq = sanitizeSnapshotNumber(saved.skillAwardSeq, 0, { integer: true, min: 0 });
  player.skillAwardSkillId = normalizeSkillId(saved.skillAwardSkillId);
  player.skillAwardXpGained = sanitizeSnapshotNumber(saved.skillAwardXpGained, 0, { integer: true, min: 0 });
  player.skillAwardOldLevel = sanitizeSnapshotNumber(saved.skillAwardOldLevel, 1, { integer: true, min: 1 });
  player.skillAwardNewLevel = sanitizeSnapshotNumber(saved.skillAwardNewLevel, 1, { integer: true, min: 1 });
  player.skillAwardAt = sanitizeSnapshotNumber(saved.skillAwardAt, 0, { integer: true, min: 0 });
  player.selectedMissionId = normalizeMissionId(saved.selectedMissionId);
  player.characterId = sanitizeCharacterId(saved.characterId);

  if (!player.alive || player.health <= 0) {
    player.alive = false;
    player.health = 0;
    if (!player.respawnAt) {
      player.respawnAt = now + PLAYER_RESPAWN_MS;
    }
  }

  return true;
}

export class WorldRoom extends Room {
  onCreate() {
    this.maxClients = 16;
    this.setState(new WorldRoomState());
    this.syncConnectedPlayerCount();
    this.chatEngine = new NpcChatEngine();
    this.worldState = new WorldState();
    this.worldPersistence = getWorldPersistence();
    this.stockMarketPersistence = getStockMarketPersistence();
    this.npcDefinitions = new Map();
    this.npcRuntimeMeta = new Map();
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.sequence = 0;
    this.playerAliasSequence = 0;
    this.playerPositionMeta = new Map();
    this.pickupSequence = 0;
    this.stockMarket = this.stockMarketPersistence.getInitialMarket(Date.now());
    this.stockPortfolios = new Map();
    this.playerSnapshots = getPlayerSnapshots();
    this.playerAccounts = getPlayerAccounts();
    this.playerSnapshotIds = new Map();
    this.playerSnapshotSessions = new Map();
    this.playerAccountSessions = new Map();
    this.playerSaveTargets = new Map();
    this.dirtyPlayerSnapshots = new Set();
    this.playerSnapshotSavePromises = new Map();
    this.playerTransformCorrectionLogAt = new Map();
    this.blackjackSessions = new Map();
    this.npcRouteGraph = null;
    this.lastNpcSimulationAt = Date.now();
    this.npcDebugEnabled = isNpcDebugEnabled();
    this.lastNpcDebugBroadcastAt = 0;
    this.lastNpcDebugPayloadSignature = '';
    this.gymDoorBlockers = [];
    this.gymDoorBlockersRevision = -1;

    this.worldState.loadLayout(this.worldPersistence.getInitialLayout());
    this.syncNpcDefinitionsFromWorld();
    this.seedCombatPickups();
    this.clock.setInterval(() => {
      this.updateCombatTimers();
    }, COMBAT_TICK_MS);
    this.clock.setInterval(() => {
      void this.flushDirtyPlayerSnapshots();
    }, PLAYER_SNAPSHOT_AUTOSAVE_MS);
    logServer('room', 'World room created.', {
      roomId: this.roomId,
      maxClients: this.maxClients,
      npcCount: this.state.npcs.size,
      pickupCount: this.state.pickups.size
    });
    this.logNpcDebugEvent('', 'room-created', {
      roomId: this.roomId,
      npcCount: this.state.npcs.size
    });

    this.onMessage('player:updateTransform', (client, message) => {
      this.updatePlayerTransform(client, message);
    });

    this.onMessage('player:setCharacter', (client, message) => {
      this.updatePlayerCharacter(client, message);
    });

    this.onMessage('player:passiveTrafficHit', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handlePassiveTrafficHit(client, message));
    });

    this.onMessage('mission:select', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleMissionSelect(client, message));
    });

    this.onMessage('builder:updatePresence', (client, message) => {
      try {
        this.updateBuilderPresence(client, message);
      } catch (error) {
        logServerError('room', 'Builder presence update failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('world:getLayout', (client, message) => {
      void this.handleRpc(client, message.requestId, () => ({
        layout: this.worldState.serializeLayout()
      }), { persistSnapshot: false });
    });

    this.onMessage('world:edit', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWorldEdit(client, message));
    });

    this.onMessage('chat:say', async (client, message) => {
      try {
        const result = await this.handlePublicChat(client, message);
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: true,
          ...result
        });
      } catch (error) {
        logServerError('room', 'Public chat request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
        client.send('rpc:response', {
          requestId: message.requestId,
          ok: false,
          error: error.message || 'Chat failed.'
        });
      }
    });

    this.onMessage('quest:acceptDelivery', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleDeliveryQuestAccept(client, message));
    });

    this.onMessage('quest:completeDelivery', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleDeliveryQuestComplete(client, message));
    });

    this.onMessage('gym:buyMembership', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleGymMembershipPurchase(client, message));
    });

    this.onMessage('stock:getMarket', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleStockMarketRequest(client, message), {
        persistSnapshot: false
      });
    });

    this.onMessage('stock:trade', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleStockTradeRequest(client, message));
    });

    this.onMessage('bartender:buyDrink', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBartenderPurchase(client, message));
    });

    this.onMessage('pawnShop:buyItem', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handlePawnShopPurchase(client, message));
    });

    this.onMessage('carDealer:buyVehicle', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleCarDealerPurchase(client, message));
    });

    this.onMessage('vehicle:select', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handlePlayerVehicleSelect(client, message));
    });

    this.onMessage('martha:buyItem', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleMarthaPurchase(client, message));
    });

    this.onMessage('inventory:consumeItem', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleInventoryConsumeRequest(client, message));
    });

    this.onMessage('vibeHero:complete', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleVibeHeroComplete(client, message));
    });

    this.onMessage('wallet:getSnapshot', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWalletSnapshotRequest(client), {
        persistSnapshot: false
      });
    });

    this.onMessage('blackjack:start', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBlackjackStart(client, message));
    });

    this.onMessage('blackjack:hit', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBlackjackAction(client, message, 'hit'));
    });

    this.onMessage('blackjack:stand', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBlackjackAction(client, message, 'stand'));
    });

    this.onMessage('blackjack:double', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBlackjackAction(client, message, 'double'));
    });

    this.onMessage('blackjack:split', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBlackjackAction(client, message, 'split'));
    });

    this.onMessage('schoolMicrogame:complete', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleSchoolMicrogameComplete(client, message));
    });

    this.onMessage('officeJob:complete', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleOfficeJobComplete(client, message));
    });

    this.onMessage('combat:pickupRequest', (client, message) => {
      try {
        this.handlePickupRequest(client, message);
      } catch (error) {
        logServerError('room', 'Pickup request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:equipRequest', (client, message) => {
      try {
        this.handleEquipRequest(client, message);
      } catch (error) {
        logServerError('room', 'Equip request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:fireRequest', (client, message) => {
      try {
        this.handleFireRequest(client, message);
      } catch (error) {
        logServerError('room', 'Fire request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:punchRequest', (client, message) => {
      try {
        this.handlePunchRequest(client, message);
      } catch (error) {
        logServerError('room', 'Punch request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('combat:reloadRequest', (client) => {
      try {
        this.handleReloadRequest(client);
      } catch (error) {
        logServerError('room', 'Reload request failed.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId
        });
      }
    });

    this.onMessage('workout:claim', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWorkoutClaim(client, message));
    });

    this.onMessage('workout:complete', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWorkoutComplete(client, message));
    });

    this.onMessage('workout:release', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWorkoutRelease(client, message));
    });
  }

  async resolveAuthenticatedAccount(client, options = {}) {
    const accessToken = typeof options?.accessToken === 'string' ? options.accessToken.trim() : '';
    if (!accessToken) {
      return null;
    }
    const displayName = sanitizeJoinDisplayName(options?.displayName);

    let authUser = null;
    try {
      authUser = await verifySupabaseAccessToken(accessToken);
    } catch (error) {
      logServerError('room', 'Supabase auth token verification failed.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        authConfigured: getSupabaseAuthInfo().configured
      });
      throw new Error('Authentication failed.');
    }

    let account = null;
    try {
      account = await this.playerAccounts.ensureUser(authUser, { displayName });
    } catch (error) {
      logServerError('room', 'Failed to ensure authenticated game user.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        userId: authUser.id
      });
      throw new Error('Could not prepare player account.');
    }

    if (!account?.userId) {
      throw new Error('Could not prepare player account.');
    }

    return {
      displayName: account.displayName,
      email: authUser.email,
      isAdmin: account.isAdmin === true,
      userId: account.userId
    };
  }

  async onJoin(client, options = {}) {
    const authenticatedAccount = await this.resolveAuthenticatedAccount(client, options);
    const requestedDisplayName = sanitizeJoinDisplayName(options?.displayName);
    let playerSnapshotId = '';
    let playerSnapshot = null;
    let saveTarget = null;

    if (authenticatedAccount?.userId) {
      playerSnapshotId = `auth:${authenticatedAccount.userId}`;
      const previousSessionId = this.playerAccountSessions.get(authenticatedAccount.userId);
      if (previousSessionId && previousSessionId !== client.sessionId) {
        if (this.state.players.has(previousSessionId) && this.isClientSessionConnected(previousSessionId)) {
          throw new Error('This account is already connected.');
        }

        if (this.state.players.has(previousSessionId)) {
          await this.savePlayerSnapshot(previousSessionId);
          this.removePlayerSession(previousSessionId);
        }
      }

      saveTarget = {
        displayName: authenticatedAccount.displayName,
        email: authenticatedAccount.email,
        id: playerSnapshotId,
        isAdmin: authenticatedAccount.isAdmin,
        kind: 'account',
        userId: authenticatedAccount.userId
      };
      this.playerSaveTargets.set(client.sessionId, saveTarget);
      this.playerAccountSessions.set(authenticatedAccount.userId, client.sessionId);
      try {
        playerSnapshot = await this.playerAccounts.loadSave(authenticatedAccount.userId);
      } catch (error) {
        logServerError('room', 'Failed to load authenticated player save.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId,
          userId: authenticatedAccount.userId
        });
      }
    } else {
      playerSnapshotId = normalizePlayerSnapshotId(options?.playerId);
    }

    if (!authenticatedAccount && playerSnapshotId) {
      const previousSessionId = this.playerSnapshotSessions.get(playerSnapshotId);
      if (
        previousSessionId
        && previousSessionId !== client.sessionId
        && this.state.players.has(previousSessionId)
        && !this.isClientSessionConnected(previousSessionId)
      ) {
        await this.savePlayerSnapshot(previousSessionId);
        this.removePlayerSession(previousSessionId);
      }

      this.playerSnapshotIds.set(client.sessionId, playerSnapshotId);
      this.playerSnapshotSessions.set(playerSnapshotId, client.sessionId);
      saveTarget = {
        displayName: requestedDisplayName,
        id: playerSnapshotId,
        kind: 'guest'
      };
      this.playerSaveTargets.set(client.sessionId, saveTarget);
      try {
        playerSnapshot = await this.playerSnapshots.load(playerSnapshotId);
      } catch (error) {
        logServerError('room', 'Failed to load player snapshot.', error, {
          roomId: this.roomId,
          sessionId: client.sessionId,
          playerSnapshotId
        });
      }
    }

    const player = new PlayerState();
    const [spawnX, spawnZ] = this.chooseRespawnPoint(client.sessionId);
    const rentIntro = resolveRentIntroPlan(this.worldState);
    const introSpawn = rentIntro?.spawn ?? null;
    const introStartedAt = rentIntro ? Date.now() : 0;
    const isAdmin = authenticatedAccount?.isAdmin === true;
    player.x = quantizePosition(introSpawn?.x ?? spawnX);
    player.y = 0;
    player.z = quantizePosition(introSpawn?.z ?? spawnZ);
    player.rotationY = Number.isFinite(introSpawn?.rotationY) ? quantizeRotation(introSpawn.rotationY) : 0;
    player.aimRotationY = player.rotationY;
    player.aiming = false;
    player.skating = false;
    player.transformSeq = 0;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq = 0;
    player.chatText = '';
    player.chatStartedAt = 0;
    player.chatSeq = 0;
    player.health = PLAYER_MAX_HEALTH;
    player.maxHealth = PLAYER_MAX_HEALTH;
    player.alive = true;
    player.respawnAt = 0;
    player.spawnProtectedUntil = 0;
    player.equippedWeaponId = '';
    player.ownedWeaponIds = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.kills = 0;
    player.deaths = 0;
    player.money = rentIntro ? -Math.abs(Math.round(rentIntro.amount)) : 0;
    player.beerCount = 0;
    player.shotCount = 0;
    player.cigaretteCount = 0;
    player.burgerCount = 0;
    player.glizzyCount = 0;
    player.sodaCount = 0;
    player.skateboardOwned = false;
    player.vehicleItemId = '';
    player.ownedVehicleItemIds = '';
    player.drunknessDose = 0;
    player.drunknessLevel = 0;
    player.drunknessEndsAt = 0;
    player.gymMembershipActive = false;
    player.rentIntroSeq = introStartedAt;
    player.rentIntroAmount = rentIntro ? Math.abs(Math.round(rentIntro.amount)) : 0;
    player.rentIntroNpcId = rentIntro?.collectorNpcId ?? '';
    player.rentIntroBuildingPlacementId = rentIntro?.buildingPlacementId ?? '';
    player.rentIntroStartedAt = introStartedAt;
    player.lastDamagedAt = 0;
    player.workoutPlacementId = '';
    player.deliveryQuestId = '';
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.inactive;
    player.deliveryQuestGiverNpcId = '';
    player.deliveryQuestTargetNpcId = '';
    player.deliveryQuestAcceptedAt = 0;
    player.deliveryQuestCompletedAt = 0;
    player.deliveryQuestRecentTargetNpcIds = '';
    player.deliveryQuestCompletionCount = 0;
    player.gymPumpCompletedAt = 0;
    player.stockBoughtAt = 0;
    player.blackjackHandPlayedAt = 0;
    player.schoolTasksCompletedCount = 0;
    player.janitorTasksCompletedCount = 0;
    player.officeManagerCompletedAt = 0;
    player.ceoCompletedAt = 0;
    player.strengthXp = 0;
    player.agilityXp = 0;
    player.intelligenceXp = 0;
    player.charismaXp = 0;
    player.skillAwardSeq = 0;
    player.skillAwardSkillId = '';
    player.skillAwardXpGained = 0;
    player.skillAwardOldLevel = 1;
    player.skillAwardNewLevel = 1;
    player.skillAwardAt = 0;
    player.selectedMissionId = resolveSelectedMissionId(player, player.selectedMissionId, this.worldState.getMissionSequence());
    player.characterId = DEFAULT_PLAYABLE_CHARACTER_ID;
    player.isAdmin = isAdmin;
    const restoredPlayerSnapshot = applyPlayerSnapshotPayload(player, playerSnapshot);
    if (restoredPlayerSnapshot) {
      this.stockPortfolios.set(
        client.sessionId,
        restoreCharacterStockPortfoliosSnapshot(playerSnapshot, player.characterId)
      );
      player.selectedMissionId = resolveSelectedMissionId(player, player.selectedMissionId, this.worldState.getMissionSequence());
    }
    this.state.players.set(client.sessionId, player);
    this.syncConnectedPlayerCount({ includingSessionId: client.sessionId });
    this.playerPositionMeta.set(client.sessionId, {
      x: player.x,
      z: player.z,
      acceptedAt: Date.now(),
      lastTransformSeq: player.transformSeq,
      lastPunchAt: 0,
      lastShotAt: 0,
      healthRegenCarryMs: 0,
      agilityDistanceCarry: 0
    });
    void this.savePlayerSnapshot(client.sessionId);
    if (authenticatedAccount?.displayName) {
      this.playerAliases.set(client.sessionId, authenticatedAccount.displayName);
    } else if (requestedDisplayName) {
      this.playerAliases.set(client.sessionId, requestedDisplayName);
    } else {
      this.playerAliasSequence += 1;
      this.playerAliases.set(client.sessionId, `Player ${this.playerAliasSequence}`);
    }
    recordAdminJoinDiagnostic({
      roomId: this.roomId,
      sessionId: client.sessionId,
      authenticated: Boolean(authenticatedAccount),
      isAdmin,
      userId: authenticatedAccount?.userId ?? ''
    });
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      isAdmin,
      authenticated: Boolean(authenticatedAccount),
      playerSnapshotId,
      saveKind: saveTarget?.kind ?? 'none',
      restoredPlayerSnapshot,
      connectedClients: this.clients.length
    });
    this.broadcastNpcDebugSnapshot(Date.now(), { force: true });
  }

  async onLeave(client, code = 0) {
    this.syncConnectedPlayerCount({ excludingSessionId: client.sessionId });
    const player = this.state.players.get(client.sessionId);
    const isConsentedLeave = code === CloseCode.CONSENTED || code === 1000;

    if (player && !isConsentedLeave) {
      logServer('room', 'Client dropped; allowing short reconnection window.', {
        roomId: this.roomId,
        sessionId: client.sessionId,
        code,
        graceSeconds: PLAYER_RECONNECTION_GRACE_SECONDS,
        connectedClients: this.clients.length
      });

      try {
        await this.allowReconnection(client, PLAYER_RECONNECTION_GRACE_SECONDS);
        logServer('room', 'Client reconnected to world room.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          connectedClients: this.clients.length
        });
        this.syncConnectedPlayerCount({ includingSessionId: client.sessionId });
        this.broadcastNpcDebugSnapshot(Date.now(), { force: true });
        return;
      } catch {
        logServer('room', 'Client reconnection window expired.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          code,
          connectedClients: this.clients.length
        });
      }
    }

    await this.savePlayerSnapshot(client.sessionId);
    this.removePlayerSession(client.sessionId);
    this.syncConnectedPlayerCount();
    logServer('room', 'Client left world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      connectedClients: this.clients.length
    });
  }

  async onDispose() {
    await this.flushDirtyPlayerSnapshots({ force: true });
    await this.persistStockMarket('room-dispose');
  }

  isClientSessionConnected(sessionId = '') {
    for (const client of this.clients) {
      if (client.sessionId === sessionId) {
        return true;
      }
    }
    return false;
  }

  syncConnectedPlayerCount({ excludingSessionId = '', includingSessionId = '' } = {}) {
    const connectedSessionIds = new Set();
    for (const connectedClient of Array.isArray(this.clients) ? this.clients : []) {
      const sessionId = connectedClient.sessionId;
      if (sessionId && sessionId !== excludingSessionId) {
        connectedSessionIds.add(sessionId);
      }
    }
    if (includingSessionId && includingSessionId !== excludingSessionId) {
      connectedSessionIds.add(includingSessionId);
    }
    this.state.connectedPlayerCount = connectedSessionIds.size;
  }

  removePlayerSession(sessionId = '') {
    const playerSnapshotId = this.getPlayerSnapshotId(sessionId);
    const saveTarget = this.getPlayerSaveTarget(sessionId);
    this.state.players.delete(sessionId);
    this.state.builders.delete(sessionId);
    this.playerAliases.delete(sessionId);
    this.playerPositionMeta.delete(sessionId);
    this.stockPortfolios.delete(sessionId);
    this.blackjackSessions.delete(sessionId);
    for (const key of this.playerTransformCorrectionLogAt.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.playerTransformCorrectionLogAt.delete(key);
      }
    }
    if (playerSnapshotId && this.playerSnapshotSessions.get(playerSnapshotId) === sessionId) {
      this.playerSnapshotSessions.delete(playerSnapshotId);
    }
    if (saveTarget?.kind === 'account' && this.playerAccountSessions.get(saveTarget.userId) === sessionId) {
      this.playerAccountSessions.delete(saveTarget.userId);
    }
    this.playerSnapshotIds.delete(sessionId);
    this.playerSaveTargets.delete(sessionId);
    this.dirtyPlayerSnapshots.delete(sessionId);
    this.playerSnapshotSavePromises.delete(sessionId);
  }

  getPlayerSaveTarget(sessionId = '') {
    return this.playerSaveTargets.get(sessionId) ?? null;
  }

  getPlayerSnapshotId(sessionId = '') {
    return this.getPlayerSaveTarget(sessionId)?.id ?? this.playerSnapshotIds.get(sessionId) ?? '';
  }

  queuePlayerSnapshotSave(sessionId = '') {
    if (!this.getPlayerSnapshotId(sessionId) || !this.state.players.has(sessionId)) {
      return;
    }

    this.dirtyPlayerSnapshots.add(sessionId);
  }

  async savePlayerSnapshot(sessionId = '') {
    const saveTarget = this.getPlayerSaveTarget(sessionId);
    const playerSnapshotId = saveTarget?.id ?? this.getPlayerSnapshotId(sessionId);
    const player = this.state.players.get(sessionId);
    if (!playerSnapshotId || !player) {
      return null;
    }

    const existingSave = this.playerSnapshotSavePromises.get(sessionId);
    if (existingSave) {
      this.dirtyPlayerSnapshots.add(sessionId);
      return existingSave;
    }

    let savePromise = null;
    savePromise = (async () => {
      try {
        const snapshotPayload = createPlayerSnapshotPayload(
          player,
          this.stockPortfolios.get(sessionId) ?? {}
        );
        this.dirtyPlayerSnapshots.delete(sessionId);
        const snapshot = saveTarget?.kind === 'account'
          ? await this.playerAccounts.saveSave(saveTarget.userId, snapshotPayload)
          : await this.playerSnapshots.save(playerSnapshotId, snapshotPayload);
        return snapshot;
      } catch (error) {
        this.dirtyPlayerSnapshots.add(sessionId);
        logServerError('room', 'Failed to save player snapshot.', error, {
          roomId: this.roomId,
          sessionId,
          playerSnapshotId,
          saveKind: saveTarget?.kind ?? 'guest'
        });
        return null;
      } finally {
        if (this.playerSnapshotSavePromises.get(sessionId) === savePromise) {
          this.playerSnapshotSavePromises.delete(sessionId);
        }
      }
    })();
    this.playerSnapshotSavePromises.set(sessionId, savePromise);
    return savePromise;
  }

  async flushDirtyPlayerSnapshots({ force = false } = {}) {
    const sessionIds = [];
    if (force) {
      for (const sessionId of this.state.players.keys()) {
        sessionIds.push(sessionId);
      }
    } else {
      for (const sessionId of this.dirtyPlayerSnapshots) {
        sessionIds.push(sessionId);
      }
    }
    const savePromises = new Array(sessionIds.length);
    for (let index = 0; index < sessionIds.length; index += 1) {
      savePromises[index] = this.savePlayerSnapshot(sessionIds[index]);
    }
    await Promise.all(savePromises);
  }

  async persistStockMarket(reason = 'update') {
    try {
      return await this.stockMarketPersistence.save(this.stockMarket);
    } catch (error) {
      logServerError('room', 'Failed to persist stock market.', error, {
        roomId: this.roomId,
        reason
      });
      return null;
    }
  }

  serializeStockMarketForPlayer(sessionId, player, now = Date.now(), persistReason = 'market-refresh') {
    const portfolio = this.getPlayerStockPortfolio(sessionId);
    const previousLastUpdatedAt = Number(this.stockMarket?.lastUpdatedAt ?? 0) || 0;
    const previousNextTickAt = Number(this.stockMarket?.nextTickAt ?? 0) || 0;
    const market = serializeStockMarket(this.stockMarket, portfolio, player.money, now);
    const nextLastUpdatedAt = Number(this.stockMarket?.lastUpdatedAt ?? 0) || 0;
    const nextNextTickAt = Number(this.stockMarket?.nextTickAt ?? 0) || 0;

    if (nextLastUpdatedAt !== previousLastUpdatedAt || nextNextTickAt !== previousNextTickAt) {
      if (persistReason === 'wallet-snapshot') {
        void this.persistStockMarket('wallet-snapshot');
      } else {
        void this.persistStockMarket(persistReason);
      }
    }

    return market;
  }

  isAdminClient(client) {
    return this.state.players.get(client.sessionId)?.isAdmin === true;
  }

  assertAdminClient(client) {
    if (!this.isAdminClient(client)) {
      throw new Error('Admin access required.');
    }
  }

  seedCombatPickups() {
    this.state.pickups.clear();
    this.syncCombatPickupsFromWorld({ reset: true });
  }

  syncCombatPickupsFromWorld({ reset = false } = {}) {
    const spawnDefinitions = getCombatPickupSpawnDefinitions(
      this.worldState,
      getBuilderItemById
    );
    const nextSpawnIds = new Set();
    for (const spawn of spawnDefinitions) {
      nextSpawnIds.add(spawn.id);
    }

    for (const pickupId of this.state.pickups.keys()) {
      const pickup = this.state.pickups.get(pickupId);
      if (pickup.kind === 'spawn' && (reset || !nextSpawnIds.has(pickupId))) {
        this.state.pickups.delete(pickupId);
      }
    }

    for (const spawn of spawnDefinitions) {
      const existing = reset ? null : this.state.pickups.get(spawn.id);
      if (!existing || existing.kind !== 'spawn') {
        this.state.pickups.set(spawn.id, createPickupState(spawn));
        continue;
      }

      const nextX = quantizePosition(spawn.position[0]);
      const nextZ = quantizePosition(spawn.position[1]);
      const nextAmmoInClip = Math.max(0, Math.floor(spawn.ammoInClip ?? 0));
      const nextReserveAmmo = Math.max(0, Math.floor(spawn.reserveAmmo ?? 0));
      if (existing.weaponId !== spawn.weaponId) existing.weaponId = spawn.weaponId;
      if (existing.x !== nextX) existing.x = nextX;
      if (existing.z !== nextZ) existing.z = nextZ;
      if (existing.ammoInClip !== nextAmmoInClip) existing.ammoInClip = nextAmmoInClip;
      if (existing.reserveAmmo !== nextReserveAmmo) existing.reserveAmmo = nextReserveAmmo;
    }
  }

  chooseRespawnPoint(exceptSessionId = '') {
    const livingPlayers = [];
    for (const sessionId of this.state.players.keys()) {
      const player = this.state.players.get(sessionId);
      if (sessionId !== exceptSessionId && player.alive !== false) {
        livingPlayers.push({ x: player.x, z: player.z });
      }
    }
    return chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS, livingPlayers);
  }

  chooseHospitalRespawnPoint() {
    return getHospitalRespawnPoint(this.worldState, getBuilderItemById);
  }

  getPlayerMeta(sessionId) {
    if (!this.playerPositionMeta.has(sessionId)) {
      const player = this.state.players.get(sessionId);
      this.playerPositionMeta.set(sessionId, {
        x: player?.x ?? 0,
        z: player?.z ?? 0,
        acceptedAt: Date.now(),
        lastTransformSeq: player?.transformSeq ?? 0,
        lastPunchAt: 0,
        lastShotAt: 0,
        healthRegenCarryMs: 0,
        agilityDistanceCarry: 0
      });
    }

    return this.playerPositionMeta.get(sessionId);
  }

  awardPlayerSkillXp(player, skillId = '', amount = 0) {
    const id = normalizeSkillId(skillId);
    const xpAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (!player || !id || xpAmount <= 0) {
      return null;
    }

    const award = applySkillXpToPlayer(player, id, xpAmount);
    if (!award) {
      return null;
    }

    player.skillAwardSeq = Math.max(0, Math.floor(Number(player.skillAwardSeq ?? 0) || 0)) + 1;
    player.skillAwardSkillId = award.skillId;
    player.skillAwardXpGained = award.xpGained;
    player.skillAwardOldLevel = award.oldLevel;
    player.skillAwardNewLevel = award.newLevel;
    player.skillAwardAt = Date.now();
    return {
      ...award,
      seq: player.skillAwardSeq,
      awardedAt: player.skillAwardAt
    };
  }

  awardAgilityXpFromDistance(player, meta, acceptedDistance = 0) {
    const distance = Number(acceptedDistance);
    if (
      !player
      || !meta
      || !Number.isFinite(distance)
      || distance < AGILITY_MIN_DISTANCE
    ) {
      return null;
    }

    const totalDistance = Math.max(0, Number(meta.agilityDistanceCarry ?? 0) || 0) + distance;
    const rawXp = Math.floor(totalDistance / AGILITY_DISTANCE_PER_XP);
    if (rawXp <= 0) {
      meta.agilityDistanceCarry = totalDistance;
      return null;
    }

    const awardedXp = Math.min(rawXp, AGILITY_MAX_XP_PER_UPDATE);
    meta.agilityDistanceCarry = totalDistance - (rawXp * AGILITY_DISTANCE_PER_XP);
    return this.awardPlayerSkillXp(player, SKILL_IDS.agility, awardedXp);
  }

  logPlayerTransformCorrection(sessionId = '', reason = '', meta = {}) {
    const key = `${sessionId}:${reason}`;
    const now = Date.now();
    const previousLogAt = this.playerTransformCorrectionLogAt.get(key) ?? 0;
    if (now - previousLogAt < 2000) {
      return;
    }

    this.playerTransformCorrectionLogAt.set(key, now);
    logServer('movement', 'Player transform corrected.', {
      roomId: this.roomId,
      sessionId,
      reason,
      ...meta
    });
  }

  updatePlayerTransform(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const now = Date.now();
    const requestedPosition = clampToWorldBounds(Number(message.x), Number(message.z));
    const meta = this.getPlayerMeta(client.sessionId);
    const messageSeq = normalizeTransformSeq(message.seq ?? message.transformSeq);
    const nextTransformSeq = messageSeq > 0
      ? messageSeq
      : normalizeTransformSeq(meta.lastTransformSeq ?? player.transformSeq ?? 0) + 1;
    if (nextTransformSeq <= normalizeTransformSeq(meta.lastTransformSeq)) {
      return;
    }
    const elapsedSeconds = Math.max((now - meta.acceptedAt) / 1000, 0.016);
    const activeVehicleOwned = isPlayerVehicleOwner(player);
    const requestedSkating = (isPlayerSkateboardOwner(player) || activeVehicleOwned) && message?.skating === true;
    const transportSpeedMultiplier = activeVehicleOwned ? CAR_VEHICLE_SPEED_MULTIPLIER : SKATEBOARD_SPEED_MULTIPLIER;
    const maxAcceptedSpeed = PLAYER_MAX_ACCEPTED_SPEED * (requestedSkating ? transportSpeedMultiplier : 1);
    const maxDistance = PLAYER_POSITION_FORGIVENESS + (maxAcceptedSpeed * elapsedSeconds);
    let nextPosition = requestedPosition;
    let travelled = distance2D(meta.x, meta.z, nextPosition.x, nextPosition.z);
    if (travelled > maxDistance) {
      const scale = maxDistance / travelled;
      nextPosition = clampToWorldBounds(
        meta.x + ((requestedPosition.x - meta.x) * scale),
        meta.z + ((requestedPosition.z - meta.z) * scale)
      );
      this.logPlayerTransformCorrection(client.sessionId, 'speed-clamped', {
        requestedDistance: quantizePosition(travelled),
        acceptedDistance: quantizePosition(distance2D(meta.x, meta.z, nextPosition.x, nextPosition.z)),
        maxDistance: quantizePosition(maxDistance),
        elapsedMs: Math.round(elapsedSeconds * 1000),
        skating: requestedSkating
      });
      travelled = distance2D(meta.x, meta.z, nextPosition.x, nextPosition.z);
    }
    if (this.isGymGateBlockingPosition(player, nextPosition)) {
      this.logPlayerTransformCorrection(client.sessionId, 'gym-gate-blocked', {
        requestedX: quantizePosition(requestedPosition.x),
        requestedZ: quantizePosition(requestedPosition.z),
        acceptedX: quantizePosition(meta.x),
        acceptedZ: quantizePosition(meta.z)
      });
      meta.lastTransformSeq = nextTransformSeq;
      meta.acceptedAt = now;
      player.transformSeq = nextTransformSeq;
      return;
    }

    this.awardAgilityXpFromDistance(player, meta, travelled);
    player.x = quantizePosition(nextPosition.x);
    const requestedY = Number(message.y);
    player.y = Number.isFinite(requestedY) ? quantizePosition(requestedY) : player.y;
    player.z = quantizePosition(nextPosition.z);
    player.transformSeq = nextTransformSeq;
    meta.x = player.x;
    meta.z = player.z;
    meta.acceptedAt = now;
    meta.lastTransformSeq = nextTransformSeq;

    const rotationY = Number(message.rotationY);
    if (Number.isFinite(rotationY)) {
      player.rotationY = quantizeRotation(rotationY);
    }

    const animationState = sanitizePlayerAnimationState(message);
    player.emoteId = animationState.emoteId;
    player.emoteActive = animationState.emoteActive;
    player.emoteStartedAt = animationState.emoteStartedAt;
    player.emoteSeq = animationState.emoteSeq;
    player.aimRotationY = animationState.aimRotationY;
    player.aiming = animationState.aiming;
    player.skating = Boolean(animationState.skating && (isPlayerSkateboardOwner(player) || isPlayerVehicleOwner(player)));
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  updatePlayerCharacter(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    player.characterId = sanitizeCharacterId(message?.characterId);
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  handlePassiveTrafficHit(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'Player is not active.' };
    }

    const damage = Math.max(0, Math.min(PLAYER_MAX_HEALTH, Math.floor(Number(message.damage) || 0)));
    if (damage <= 0) {
      return { ok: true, health: player.health, alive: player.alive !== false };
    }

    const now = Date.now();
    player.health = Math.max(0, player.health - damage);
    player.lastDamagedAt = now;
    player.emoteId = message.emoteId === STAND_UP_EMOTE_ID ? STAND_UP_EMOTE_ID : '';
    player.emoteActive = player.emoteId === STAND_UP_EMOTE_ID;
    player.emoteStartedAt = player.emoteActive ? now : 0;
    player.emoteSeq += 1;
    player.skating = false;
    this.getPlayerMeta(client.sessionId).healthRegenCarryMs = 0;
    if (player.health <= 0) {
      this.handlePlayerDeath(client.sessionId, '');
    } else {
      this.queuePlayerSnapshotSave(client.sessionId);
    }

    return { ok: true, health: player.health, alive: player.alive !== false };
  }

  normalizePlayerSelectedMission(player) {
    if (!player) {
      return '';
    }

    const nextMissionId = resolveSelectedMissionId(
      player,
      player.selectedMissionId,
      this.worldState.getMissionSequence()
    );
    if (player.selectedMissionId !== nextMissionId) {
      player.selectedMissionId = nextMissionId;
    }
    return nextMissionId;
  }

  handleMissionSelect(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      throw new Error('Your player is not connected.');
    }

    const missionId = normalizeMissionId(message?.missionId);
    if (!missionId) {
      throw new Error('That mission is not available.');
    }

    if (!isMissionSelectable(missionId, player, this.worldState.getMissionSequence())) {
      throw new Error('That mission is locked or already complete.');
    }

    player.selectedMissionId = missionId;
    return {
      selectedMissionId: this.normalizePlayerSelectedMission(player)
    };
  }

  getDeliveryQuestPayload(player) {
    return {
      questId: player.deliveryQuestId || '',
      status: player.deliveryQuestStatus || DELIVERY_QUEST_STATUS.inactive,
      giverNpcId: player.deliveryQuestGiverNpcId || '',
      targetNpcId: player.deliveryQuestTargetNpcId || '',
      acceptedAt: player.deliveryQuestAcceptedAt || 0,
      completedAt: player.deliveryQuestCompletedAt || 0,
      recentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds || '',
      completionCount: player.deliveryQuestCompletionCount || 0,
      rewardAmount: DELIVERY_QUEST_REWARD_AMOUNT
    };
  }

  isPlayerInNpcInteractRadius(player, npc) {
    if (!player || !npc) {
      return false;
    }

    const radius = Math.max(1.5, Number(npc.interactRadius ?? 4.2) || 4.2);
    return distanceSquared2D(player.x, player.z, npc.x, npc.z) <= radius * radius;
  }

  isPlayerInGymCheckInPurchaseRadius(player, npc) {
    if (!player || !npc || !isGymCheckInNpc(npc)) {
      return false;
    }

    const radius = getGymCheckInPromptRadius(npc);
    return distanceSquared2D(player.x, player.z, npc.x, npc.z) <= radius * radius;
  }

  hasActiveGymCheckInNpc() {
    for (const npc of this.state.npcs.values()) {
      if (
        isGymCheckInNpc(npc)
        && npc.alive !== false
        && npc.mode !== NPC_RUNTIME_MODES.hidden
        && npc.mode !== NPC_RUNTIME_MODES.dead
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

  getGymDoorBlockers() {
    const revision = this.worldState.getPlacementRevision?.() ?? 0;
    if (this.gymDoorBlockersRevision === revision) {
      return this.gymDoorBlockers;
    }

    const blockers = [];
    this.worldState.forEachPlacement((placement) => {
      const item = getBuilderItemById(placement?.itemId);
      if (!item || placement?.layer !== 'tile' || !this.isGymDoorPlacement(placement, item)) {
        return;
      }

      const doorOffset = item.interior?.exteriorDoorOffset
        ?? placement.interactable?.interior?.exteriorDoorOffset
        ?? item.npcRouteDoorOffset
        ?? null;
      if (!Array.isArray(doorOffset) || doorOffset.length < 2) {
        return;
      }

      const center = getTileCenterWorldPosition(
        item,
        placement.cellX,
        placement.cellZ,
        placement.rotationQuarterTurns
      );
      const rotatedOffset = rotateFootprintOffset(
        Number(doorOffset[0]) || 0,
        Number(doorOffset[1]) || 0,
        placement.rotationQuarterTurns
      );
      blockers.push({
        x: center.x + rotatedOffset.x,
        z: center.z + rotatedOffset.z,
        radius: GYM_DOOR_BLOCKER_RADIUS
      });
    });
    this.gymDoorBlockers = blockers;
    this.gymDoorBlockersRevision = revision;
    return this.gymDoorBlockers;
  }

  isGymGateBlockingPosition(player, position) {
    if (
      !player
      || player.gymMembershipActive === true
      || !position
      || !this.hasActiveGymCheckInNpc()
    ) {
      return false;
    }

    for (const blocker of this.getGymDoorBlockers()) {
      const radius = blocker.radius + PLAYER_RADIUS;
      if (distanceSquared2D(position.x, position.z, blocker.x, blocker.z) <= radius * radius) {
        return true;
      }
    }

    return false;
  }

  handleGymMembershipPurchase(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot buy that right now.');
    }

    if (player.gymMembershipActive === true) {
      return {
        alreadyOwned: true,
        money: player.money ?? 0,
        gymMembershipActive: true
      };
    }

    const npcId = typeof message?.npcId === 'string'
      ? message.npcId.trim()
      : '';
    const npc = this.state.npcs.get(npcId);
    if (!npc || !isGymCheckInNpc(npc)) {
      throw new Error('That gym check-in is not available.');
    }

    if (!this.isPlayerInGymCheckInPurchaseRadius(player, npc)) {
      throw new Error('Move closer to the gym check-in.');
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < GYM_MEMBERSHIP_COST) {
      this.setNpcChatPhase(npc, 'done', `Bring $${GYM_MEMBERSHIP_COST} and I can get you checked in.`, { bumpSeq: true });
      throw new Error(`You need $${GYM_MEMBERSHIP_COST} for a gym membership.`);
    }

    player.money = money - GYM_MEMBERSHIP_COST;
    player.gymMembershipActive = true;
    this.setNpcChatPhase(npc, 'done', GYM_CHECK_IN_PURCHASED_LINE, { bumpSeq: true });
    return {
      cost: GYM_MEMBERSHIP_COST,
      money: player.money,
      gymMembershipActive: true
    };
  }

  getPlayerStockPortfolio(sessionId = '') {
    if (!this.stockPortfolios.has(sessionId)) {
      this.stockPortfolios.set(sessionId, {});
    }

    const portfolios = this.stockPortfolios.get(sessionId);
    const player = this.state.players.get(sessionId);
    const characterId = sanitizeCharacterId(player?.characterId);
    if (!portfolios[characterId] || typeof portfolios[characterId] !== 'object' || Array.isArray(portfolios[characterId])) {
      portfolios[characterId] = {};
    }

    return portfolios[characterId];
  }

  *iterateNpcCandidates(requestedNpcId = '') {
    const normalizedNpcId = typeof requestedNpcId === 'string'
      ? requestedNpcId.trim()
      : '';
    if (normalizedNpcId) {
      const npc = this.state.npcs.get(normalizedNpcId);
      if (npc) {
        yield npc;
      }
      return;
    }

    yield* this.state.npcs.values();
  }

  getStockMarketNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isStockMarketNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getStockMarketPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertStockMarketAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot trade right now.');
    }

    const npc = this.getStockMarketNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to a stock broker.');
    }

    return { player, npc };
  }

  getStockTradeAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot trade right now.');
    }

    if (String(message?.source ?? '') === 'phone') {
      return { player, npc: null };
    }

    return this.assertStockMarketAccess(client, message);
  }

  handleStockMarketRequest(client, message = {}) {
    const { player } = this.assertStockMarketAccess(client, message);
    const market = this.serializeStockMarketForPlayer(client.sessionId, player, Date.now(), 'market-request');
    return {
      market,
      money: player.money
    };
  }

  async handleStockTradeRequest(client, message = {}) {
    const { player, npc } = this.getStockTradeAccess(client, message);
    const portfolio = this.getPlayerStockPortfolio(client.sessionId);
    const result = executeStockTrade({
      state: this.stockMarket,
      portfolio,
      cash: player.money,
      symbol: message?.symbol,
      side: message?.side,
      quantity: message?.quantity,
      now: Date.now()
    });
    if (!result.ok) {
      throw new Error(result.error || 'That trade was rejected.');
    }

    player.money = result.cash;
    const trade = result.trade ?? {};
    if (trade.side === 'buy' && Number(player.stockBoughtAt ?? 0) <= 0) {
      player.stockBoughtAt = Date.now();
      this.normalizePlayerSelectedMission(player);
    }
    this.queuePlayerSnapshotSave(client.sessionId);
    await this.savePlayerSnapshot(client.sessionId);
    if (this.dirtyPlayerSnapshots.has(client.sessionId)) {
      await this.savePlayerSnapshot(client.sessionId);
    }
    await this.persistStockMarket('stock-trade');
    const verb = trade.side === 'sell' ? 'Sold' : 'Bought';
    if (npc) {
      this.setNpcChatPhase(
        npc,
        'done',
        `${verb} ${trade.quantity ?? 0} ${trade.symbol ?? 'shares'} at $${Number(trade.price ?? 0).toFixed(2)}.`,
        { bumpSeq: true }
      );
    }
    return {
      trade,
      market: result.market,
      money: player.money
    };
  }

  handleWalletSnapshotRequest(client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('Wallet is unavailable right now.');
    }

    const wallet = this.serializeStockMarketForPlayer(client.sessionId, player, Date.now(), 'wallet-snapshot');
    return {
      wallet,
      money: player.money
    };
  }

  getBartenderNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isBartenderNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getBartenderPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertBartenderAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot order right now.');
    }

    const npc = this.getBartenderNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to the bartender.');
    }

    return { player, npc };
  }

  handleBartenderPurchase(client, message = {}) {
    const { player, npc } = this.assertBartenderAccess(client, message);
    const item = getBartenderMenuItem(message?.itemId);
    if (!item) {
      throw new Error('That drink is not on the menu.');
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      throw new Error(`You need $${item.price} for ${item.label.toLowerCase()}.`);
    }

    player.money = money - item.price;
    const inventoryCount = addPlayerDrink(player, item.id, 1);
    this.setNpcChatPhase(npc, 'done', item.orderLine, { bumpSeq: true });
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount
      },
      inventory: getPlayerDrinkInventorySnapshot(player),
      money: player.money
    };
  }

  getPawnShopOwnerNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isPawnShopOwnerNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getPawnShopPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertPawnShopAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot buy that right now.');
    }

    const npc = this.getPawnShopOwnerNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to the pawn shop owner.');
    }

    return { player, npc };
  }

  handlePawnShopPurchase(client, message = {}) {
    const { player, npc } = this.assertPawnShopAccess(client, message);
    const item = getPawnShopMenuItem(message?.itemId);
    if (!item) {
      throw new Error('That item is not for sale.');
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      throw new Error(`You need $${item.price} for ${item.label.toLowerCase()}.`);
    }

    let inventoryCount = 0;
    let weaponResult = null;
    if (item.kind === 'weapon') {
      weaponResult = applyWeaponPickupToPlayerState(player, item);
      if (!weaponResult.changed) {
        const error = weaponResult.reason === 'no-ammo-space'
          ? 'You already have a fully stocked pistol.'
          : 'That weapon is not available.';
        this.setNpcChatPhase(npc, 'done', error, { bumpSeq: true });
        throw new Error(error);
      }
    } else if (item.kind === 'permanent') {
      if (isPlayerPawnShopItemOwned(player, item.id)) {
        const error = `You already own a ${item.label.toLowerCase()}.`;
        this.setNpcChatPhase(npc, 'done', error, { bumpSeq: true });
        throw new Error(error);
      }
      inventoryCount = addPlayerPawnShopItem(player, item.id, 1);
    } else {
      inventoryCount = addPlayerPawnShopItem(player, item.id, 1);
    }

    player.money = money - item.price;
    if (item.id === PAWN_SHOP_ITEM_IDS.skateboard) {
      this.normalizePlayerSelectedMission(player);
    }
    this.setNpcChatPhase(npc, 'done', item.orderLine, { bumpSeq: true });
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount,
        weaponId: item.weaponId ?? ''
      },
      inventory: getPlayerPawnShopInventorySnapshot(player),
      weapon: weaponResult
        ? {
            weaponId: weaponResult.weaponId,
            alreadyOwned: weaponResult.alreadyOwned === true,
            ammoInClip: player.ammoInClip,
            reserveAmmo: player.reserveAmmo
          }
        : null,
      money: player.money
    };
  }

  getCarDealerNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isCarDealerNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getCarDealerPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertCarDealerAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot buy that right now.');
    }

    const npc = this.getCarDealerNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to the car dealer.');
    }

    return { player, npc };
  }

  handleCarDealerPurchase(client, message = {}) {
    const { player, npc } = this.assertCarDealerAccess(client, message);
    const item = getCarDealerMenuItem(message?.itemId);
    if (!item) {
      throw new Error('That car is not for sale.');
    }

    if (playerOwnsVehicleItem(player, item.id)) {
      const error = `You already own the ${item.label}.`;
      this.setNpcChatPhase(npc, 'done', error, { bumpSeq: true });
      throw new Error(error);
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      throw new Error(`You need $${item.price} for the ${item.label}.`);
    }

    setPlayerVehicleItem(player, item.id);
    player.money = money - item.price;
    this.setNpcChatPhase(npc, 'done', item.orderLine, { bumpSeq: true });
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: 1
      },
      inventory: getPlayerVehicleInventorySnapshot(player),
      money: player.money
    };
  }

  handlePlayerVehicleSelect(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot switch vehicles right now.');
    }

    if (String(message?.itemId ?? '').trim() === SKATEBOARD_ITEM_ID) {
      if (!isPlayerSkateboardOwner(player)) {
        throw new Error('You do not own the skateboard.');
      }

      player.vehicleItemId = '';
      player.skating = false;
      this.queuePlayerSnapshotSave(client.sessionId);
      return {
        item: {
          id: SKATEBOARD_ITEM_ID,
          label: 'Skateboard',
          price: 0,
          count: 1
        },
        inventory: getPlayerVehicleInventorySnapshot(player)
      };
    }

    const item = getCarDealerMenuItem(message?.itemId);
    if (!item) {
      throw new Error('That car is not available.');
    }

    if (!playerOwnsVehicleItem(player, item.id)) {
      throw new Error(`You do not own the ${item.label}.`);
    }

    selectPlayerVehicleItem(player, item.id);
    player.skating = false;
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: 1
      },
      inventory: getPlayerVehicleInventorySnapshot(player)
    };
  }

  getMarthaNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isMarthaNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getMarthaPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertMarthaAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot buy that right now.');
    }

    const npc = this.getMarthaNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to Martha.');
    }

    return { player, npc };
  }

  handleMarthaPurchase(client, message = {}) {
    const { player, npc } = this.assertMarthaAccess(client, message);
    const item = getMarthaMenuItem(message?.itemId);
    if (!item) {
      throw new Error("That is not on Martha's menu.");
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      throw new Error(`You need $${item.price} for ${item.label.toLowerCase()}.`);
    }

    player.money = money - item.price;
    const inventoryCount = addPlayerMarthaItem(player, item.id, 1);
    this.setNpcChatPhase(npc, 'done', item.orderLine, { bumpSeq: true });
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount
      },
      inventory: getPlayerMarthaInventorySnapshot(player),
      money: player.money
    };
  }

  awardCharismaForDrink(player, result = null, previousDrunknessLevel = 0) {
    const xp = getCharismaDrinkXp({
      itemId: result?.item?.id ?? '',
      previousDrunknessLevel,
      nextDrunknessLevel: result?.drunkness?.drunknessLevel ?? 0
    });
    return this.awardPlayerSkillXp(player, SKILL_IDS.charisma, xp);
  }

  handleInventoryConsumeRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot use that right now.');
    }

    const now = Date.now();
    const pawnItem = getPawnShopMenuItem(message?.itemId);
    const marthaItem = getMarthaMenuItem(message?.itemId);
    const isFoodItem = marthaItem?.kind === 'consumable';
    const isDrinkItem = !isFoodItem && (!pawnItem || pawnItem.kind !== 'consumable');
    let previousDrunknessLevel = 0;
    if (isDrinkItem) {
      refreshPlayerDrunkness(player, now);
      previousDrunknessLevel = player.drunknessLevel;
    }

    const result = isFoodItem
      ? consumePlayerMarthaItem(player, message?.itemId)
      : pawnItem?.kind === 'consumable'
        ? consumePlayerPawnShopItem(player, message?.itemId)
        : consumePlayerDrink(player, message?.itemId, now);
    if (!result.ok) {
      throw new Error(result.error);
    }

    const skillAward = isDrinkItem
      ? this.awardCharismaForDrink(player, result, previousDrunknessLevel)
      : null;
    this.queuePlayerSnapshotSave(client.sessionId);
    if (!skillAward) {
      return result;
    }
    const nextResult = clonePlainObject(result);
    nextResult.skillAward = skillAward;
    return nextResult;
  }

  handleVibeHeroComplete(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot finish Vibe Hero right now.');
    }

    const songId = normalizeVibeHeroSongId(message?.songId);
    const score = Math.max(0, Math.floor(Number(message?.score ?? 0) || 0));
    const skillAward = this.awardPlayerSkillXp(player, SKILL_IDS.charisma, CHARISMA_VIBE_HERO_XP);
    this.queuePlayerSnapshotSave(client.sessionId);
    return {
      songId,
      score,
      xp: CHARISMA_VIBE_HERO_XP,
      skillAward
    };
  }

  getBlackjackDealerForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isBlackjackDealerNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getBlackjackPromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertBlackjackAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot play blackjack right now.');
    }

    const npc = this.getBlackjackDealerForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to a blackjack dealer.');
    }

    return { player, npc };
  }

  settleBlackjackSession(client, session, npc) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !session || session.phase !== 'complete' || session.settled === true) {
      return;
    }

    session.settled = true;
    session.completedAt = Date.now();
    if (Number(player.blackjackHandPlayedAt ?? 0) <= 0) {
      player.blackjackHandPlayedAt = session.completedAt;
      this.normalizePlayerSelectedMission(player);
    }
    const payout = Math.max(0, Math.trunc(Number(session.payout ?? 0) || 0));
    player.money = Math.trunc(Number(player.money ?? 0) || 0) + payout;
    if (npc) {
      this.setNpcChatPhase(npc, 'done', session.message || 'Hand complete.', { bumpSeq: true });
    }
  }

  handleBlackjackStart(client, message = {}) {
    const { player, npc } = this.assertBlackjackAccess(client, message);
    const wager = normalizeBlackjackWager(message?.wager);
    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (wager > money) {
      throw new Error(`You need ${wager > BLACKJACK_MAX_WAGER ? `$${BLACKJACK_MAX_WAGER} or less` : 'more cash'} for that wager.`);
    }

    player.money = money - wager;
    const session = createBlackjackSession({
      npcId: npc.id,
      wager,
      now: Date.now()
    });
    session.settled = false;
    this.blackjackSessions.set(client.sessionId, session);
    this.settleBlackjackSession(client, session, npc);
    return {
      blackjack: serializeBlackjackSession(session, { money: player.money }),
      money: player.money
    };
  }

  handleBlackjackAction(client, message = {}, action = '') {
    const { player, npc } = this.assertBlackjackAccess(client, message);
    const session = this.blackjackSessions.get(client.sessionId);
    if (!session || session.npcId !== npc.id) {
      throw new Error('Deal a new blackjack hand first.');
    }
    if (session.phase !== 'playerTurn') {
      return {
        blackjack: serializeBlackjackSession(session, { money: player.money }),
        money: player.money
      };
    }

    if (action === 'hit') {
      hitBlackjackSession(session);
    } else if (action === 'stand') {
      standBlackjackSession(session);
    } else if (action === 'double') {
      const money = Math.trunc(Number(player.money ?? 0) || 0);
      const extraWager = getBlackjackDoubleWager(session);
      if (!canDoubleBlackjackSession(session, money)) {
        if (extraWager > money) {
          throw new Error('You need enough cash to double.');
        }
        throw new Error('Double is only available on the first two cards.');
      }
      player.money = money - extraWager;
      doubleBlackjackSession(session);
    } else if (action === 'split') {
      const money = Math.trunc(Number(player.money ?? 0) || 0);
      const splitWager = getBlackjackSplitWager(session);
      if (!canSplitBlackjackSession(session, money)) {
        if (splitWager > money) {
          throw new Error('You need enough cash to split.');
        }
        throw new Error('Split is only available when the first two cards are a pair.');
      }
      player.money = money - splitWager;
      splitBlackjackSession(session);
    } else {
      throw new Error('That blackjack action is not available.');
    }

    this.settleBlackjackSession(client, session, npc);
    return {
      blackjack: serializeBlackjackSession(session, { money: player.money }),
      money: player.money
    };
  }

  getSchoolMicrogameNpcForPlayer(player, requestedNpcId = '') {
    let nearest = null;
    let nearestDistanceSq = Infinity;
    for (const npc of this.iterateNpcCandidates(requestedNpcId)) {
      if (
        !isSchoolMicrogameNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      const radius = getSchoolMicrogamePromptRadius(npc);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  assertSchoolMicrogameAccess(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot play school games right now.');
    }

    const npc = this.getSchoolMicrogameNpcForPlayer(player, message?.npcId);
    if (!npc) {
      throw new Error('Move closer to a school NPC.');
    }

    return { player, npc };
  }

  handleSchoolMicrogameComplete(client, message = {}) {
    const { player, npc } = this.assertSchoolMicrogameAccess(client, message);
    const gameId = normalizeSchoolMicrogameId(message?.gameId, '');
    if (!gameId || gameId === SCHOOL_MICROGAME_ALL_ID) {
      throw new Error('That school game is not available.');
    }
    const npcGameId = normalizeSchoolMicrogameId(npc.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
    if (npcGameId !== SCHOOL_MICROGAME_ALL_ID && npcGameId !== gameId) {
      throw new Error('That school game is not available here.');
    }

    const reward = getSchoolMicrogameReward(gameId);
    const moneyAwarded = 0;
    const skillAward = this.awardPlayerSkillXp(player, SKILL_IDS.intelligence, reward.xp);
    player.schoolTasksCompletedCount = Math.max(
      0,
      Math.floor(Number(player.schoolTasksCompletedCount ?? 0) || 0)
    ) + 1;
    this.normalizePlayerSelectedMission(player);
    const rewardText = reward.xp > 0 ? `+${reward.xp} Intelligence XP` : '';
    this.setNpcChatPhase(
      npc,
      'done',
      `Nice work. ${rewardText}.`,
      { bumpSeq: true }
    );
    return {
      gameId,
      money: player.money,
      moneyAwarded,
      xp: reward.xp,
      message: rewardText,
      skillAward
    };
  }

  getOfficeInteriorJobStationForPlayer(player, requestedPlacementId = '', requestedJobId = '') {
    if (!player) {
      return null;
    }

    const parsedPlacementId = parseOfficeInteriorStationPlacementId(requestedPlacementId);
    if (!parsedPlacementId) {
      return null;
    }

    const station = getOfficeInteriorStationDefinition(parsedPlacementId.stationId);
    if (
      !station
      || station.type !== OFFICE_INTERIOR_STATION_TYPES.job
      || (requestedJobId && station.jobId !== requestedJobId)
    ) {
      return null;
    }

    const building = this.worldState.getPlacement(parsedPlacementId.buildingPlacementId);
    const buildingItem = getBuilderItemById(building?.itemId);
    if (
      !building
      || building.layer !== 'tile'
      || buildingItem?.id !== OFFICE_BUILDING_ITEM_ID
    ) {
      return null;
    }

    const center = getTileCenterWorldPosition(
      buildingItem,
      building.cellX,
      building.cellZ,
      building.rotationQuarterTurns
    );
    const stationLocalPosition = station.localPosition ?? [0, 0];
    const stationOffset = rotateFootprintOffset(
      Number(stationLocalPosition[0]) || 0,
      Number(stationLocalPosition[1]) || 0,
      building.rotationQuarterTurns
    );
    const stationX = center.x + stationOffset.x;
    const stationY = getOfficeInteriorFloorHeight(station.floorId);
    const stationZ = center.z + stationOffset.z;
    const playerY = Number.isFinite(Number(player.y)) ? Number(player.y) : stationY;
    const radius = Math.max(1.5, Number(station.radius ?? OFFICE_JOB_TERMINAL_RADIUS) || OFFICE_JOB_TERMINAL_RADIUS) + 1.25;
    const dx = (Number(player.x) || 0) - stationX;
    const dy = playerY - stationY;
    const dz = (Number(player.z) || 0) - stationZ;

    if (((dx * dx) + (dy * dy) + (dz * dz)) > (radius * radius)) {
      return null;
    }

    return {
      ...building,
      id: requestedPlacementId,
      itemId: OFFICE_JOB_TERMINAL_ITEM_ID,
      position: [stationX, stationZ],
      officeInteriorStationId: station.id,
      officeJobId: station.jobId,
      virtualOfficeStation: true
    };
  }

  getOfficeJobComputerForPlayer(player, requestedPlacementId = '', requestedJobId = '') {
    if (!player) {
      return null;
    }

    const normalizedPlacementId = typeof requestedPlacementId === 'string'
      ? requestedPlacementId.trim()
      : '';
    if (parseOfficeInteriorStationPlacementId(normalizedPlacementId)) {
      return this.getOfficeInteriorJobStationForPlayer(player, normalizedPlacementId, requestedJobId);
    }

    let nearest = null;
    let nearestDistanceSq = Infinity;
    const requestedOfficeJobId = getOfficeJobDefinition(requestedJobId)?.id ?? '';
    const evaluatePlacement = (placement) => {
      const item = getBuilderItemById(placement?.itemId);
      const placementOfficeJobId = getOfficeJobDefinition(
        placement?.interactable?.officeJobId ?? item?.interactable?.officeJobId
      )?.id ?? '';
      const canUseOfficeJobPlacement = placement?.itemId === OFFICE_JOB_TERMINAL_ITEM_ID
        || Boolean(placementOfficeJobId);
      const placementMatchesRequestedJob = !placementOfficeJobId
        || !requestedOfficeJobId
        || placementOfficeJobId === requestedOfficeJobId;
      if (
        placement?.layer !== 'prop'
        || !canUseOfficeJobPlacement
        || !placementMatchesRequestedJob
        || !Array.isArray(placement.position)
      ) {
        return;
      }

      const radius = Math.max(
        1.5,
        Number(placement.interactable?.radius ?? item?.interactable?.radius ?? OFFICE_JOB_TERMINAL_RADIUS) || OFFICE_JOB_TERMINAL_RADIUS
      ) + 1.25;
      const distanceSq = distanceSquared2D(player.x, player.z, placement.position[0], placement.position[1]);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = placement;
        nearestDistanceSq = distanceSq;
      }
    };

    if (normalizedPlacementId) {
      evaluatePlacement(this.worldState.getPlacement(normalizedPlacementId));
    } else {
      this.worldState.forEachPlacement(evaluatePlacement);
    }

    return nearest;
  }

  assertOfficeJobAccess(client, message = {}, jobId = '') {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot work office jobs right now.');
    }

    const terminal = this.getOfficeJobComputerForPlayer(player, message?.placementId, jobId);
    if (!terminal) {
      throw new Error('Move closer to the office station.');
    }

    return { player, terminal };
  }

  handleOfficeJobComplete(client, message = {}) {
    const job = getOfficeJobDefinition(message?.jobId);
    if (!job) {
      throw new Error('That office job is not available.');
    }
    const { player, terminal } = this.assertOfficeJobAccess(client, message, job.id);

    const intelligenceLevel = getPlayerOfficeJobIntelligenceLevel(player);
    const charismaLevel = getSkillLevelFromXp(getPlayerSkillXp(player, SKILL_IDS.charisma));
    const strengthLevel = getSkillLevelFromXp(getPlayerSkillXp(player, SKILL_IDS.strength));
    if (!canPlayerWorkOfficeJob(intelligenceLevel, job, charismaLevel, strengthLevel)) {
      throw new Error(getOfficeJobLockedMessage(job, { intelligenceLevel, charismaLevel, strengthLevel }));
    }

    const reward = getOfficeJobReward(job.id);
    const moneyAwarded = Math.max(0, Math.trunc(Number(reward.money ?? 0) || 0));
    player.money = Math.trunc(Number(player.money ?? 0) || 0) + moneyAwarded;
    const skillAward = reward.xp > 0
      ? this.awardPlayerSkillXp(player, reward.skill, reward.xp)
      : null;
    if (job.id === OFFICE_JOB_IDS.janitor) {
      player.janitorTasksCompletedCount = Math.max(
        0,
        Math.floor(Number(player.janitorTasksCompletedCount ?? 0) || 0)
      ) + 1;
      this.normalizePlayerSelectedMission(player);
    } else if (job.id === OFFICE_JOB_IDS.officeManager) {
      player.officeManagerCompletedAt = Date.now();
      this.normalizePlayerSelectedMission(player);
    } else if (job.id === OFFICE_JOB_IDS.ceo) {
      player.ceoCompletedAt = Date.now();
      this.normalizePlayerSelectedMission(player);
    }
    let rewardText = '';
    if (moneyAwarded > 0) {
      rewardText = `+$${moneyAwarded}`;
    }
    if (reward.xp > 0) {
      rewardText = rewardText
        ? `${rewardText}  +${reward.xp} Intelligence XP`
        : `+${reward.xp} Intelligence XP`;
    }
    return {
      ok: true,
      jobId: job.id,
      gameId: job.gameId,
      placementId: terminal.id,
      money: player.money,
      moneyAwarded,
      xp: reward.xp,
      ceoCompletedAt: player.ceoCompletedAt,
      message: rewardText,
      skillAward
    };
  }

  handleDeliveryQuestAccept(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot accept that right now.');
    }

    const giverNpcId = typeof message?.giverNpcId === 'string'
      ? message.giverNpcId.trim()
      : '';
    const giver = this.state.npcs.get(giverNpcId);
    if (
      !giver
      || !isNpcAvailableForDelivery(giver)
      || !isDeliveryQuestGiver(giverNpcId, giver)
    ) {
      throw new Error('That delivery job is not available.');
    }

    if (!this.isPlayerInNpcInteractRadius(player, giver)) {
      throw new Error('Move closer to accept the delivery.');
    }

    if (isDeliveryQuestActive(player)) {
      const activeTarget = this.state.npcs.get(player.deliveryQuestTargetNpcId);
      return {
        targetName: getDeliveryQuestTargetName(activeTarget),
        ...this.getDeliveryQuestPayload(player)
      };
    }

    const target = getDeliveryQuestTargetCandidate(this.state.npcs, giverNpcId, {
      recentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds
    });
    if (!target) {
      throw new Error('There is nobody to deliver to yet.');
    }

    const now = Date.now();
    player.deliveryQuestId = DELIVERY_QUEST_ID;
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.active;
    player.deliveryQuestGiverNpcId = giverNpcId;
    player.deliveryQuestTargetNpcId = target.id;
    player.deliveryQuestAcceptedAt = now;
    player.deliveryQuestCompletedAt = 0;
    this.normalizePlayerSelectedMission(player);

    const targetName = getDeliveryQuestTargetName(target.npc);
    this.setNpcChatPhase(
      giver,
      'done',
      `Hey, can you help me make this delivery to ${targetName}? Good. Take it straight there and do not open it.`,
      { bumpSeq: true }
    );

    return {
      targetName,
      ...this.getDeliveryQuestPayload(player)
    };
  }

  handleDeliveryQuestComplete(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot deliver that right now.');
    }

    if (!isDeliveryQuestActive(player)) {
      throw new Error('You do not have a delivery to complete.');
    }

    const targetNpcId = typeof message?.targetNpcId === 'string'
      ? message.targetNpcId.trim()
      : '';
    if (targetNpcId !== player.deliveryQuestTargetNpcId) {
      throw new Error('That is not the delivery contact.');
    }

    const target = this.state.npcs.get(targetNpcId);
    if (!target || !isNpcAvailableForDelivery(target)) {
      throw new Error('The delivery contact is not available.');
    }

    if (!this.isPlayerInNpcInteractRadius(player, target)) {
      throw new Error('Move closer to deliver the package.');
    }

    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.completed;
    player.deliveryQuestCompletedAt = Date.now();
    player.deliveryQuestRecentTargetNpcIds = addDeliveryQuestRecentTargetId(
      player.deliveryQuestRecentTargetNpcIds,
      targetNpcId
    );
    player.deliveryQuestCompletionCount = Math.max(
      0,
      Math.floor(Number(player.deliveryQuestCompletionCount ?? 0) || 0)
    ) + 1;
    this.normalizePlayerSelectedMission(player);
    const currentMoney = Number(player.money ?? 0);
    player.money = (Number.isFinite(currentMoney) ? Math.trunc(currentMoney) : 0) + DELIVERY_QUEST_REWARD_AMOUNT;

    const giver = this.state.npcs.get(player.deliveryQuestGiverNpcId);
    const giverName = giver?.name || 'your friend';
    this.setNpcChatPhase(
      target,
      'done',
      `Got it. Tell ${giverName} the package landed.`,
      { bumpSeq: true }
    );

    return {
      targetName: getDeliveryQuestTargetName(target),
      ...this.getDeliveryQuestPayload(player)
    };
  }

  handleWorkoutClaim(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot use that right now.');
    }

    const placementId = typeof message?.placementId === 'string'
      ? message.placementId.trim()
      : '';
    const target = this.getNpcTargetOption(placementId);
    if (!placementId || !target?.workoutType) {
      throw new Error('That workout station is not available.');
    }

    if (player.workoutPlacementId === placementId) {
      return { placementId };
    }

    if (this.isWorkoutPlacementOccupied(placementId, { ignorePlayerId: client.sessionId })) {
      throw new Error('That station is already in use.');
    }

    player.workoutPlacementId = placementId;
    return { placementId };
  }

  handleWorkoutComplete(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot complete that workout right now.');
    }

    const placementId = typeof message?.placementId === 'string'
      ? message.placementId.trim()
      : '';
    const target = this.getNpcTargetOption(placementId);
    if (!placementId || !target?.workoutType) {
      throw new Error('That workout station is not available.');
    }

    if (player.workoutPlacementId !== placementId) {
      throw new Error('That workout is not active.');
    }

    const awardXp = message?.awardXp !== false;
    const skillAwards = [];
    if (target.workoutType === 'snatch') {
      player.gymPumpCompletedAt = Date.now();
      const skillAward = awardXp
        ? this.awardPlayerSkillXp(player, SKILL_IDS.strength, STRENGTH_SNATCH_XP)
        : null;
      if (skillAward) {
        skillAwards.push(skillAward);
      }
      this.normalizePlayerSelectedMission(player);
    } else if (target.workoutType === 'basketball-shot' || target.workoutType === 'treadmill') {
      player.gymPumpCompletedAt = Date.now();
      const strengthAward = awardXp
        ? this.awardPlayerSkillXp(player, SKILL_IDS.strength, BASKETBALL_SHOT_STRENGTH_XP)
        : null;
      if (strengthAward) {
        skillAwards.push(strengthAward);
      }
      const agilityAward = awardXp
        ? this.awardPlayerSkillXp(player, SKILL_IDS.agility, BASKETBALL_SHOT_AGILITY_XP)
        : null;
      if (agilityAward) {
        skillAwards.push(agilityAward);
      }
      this.normalizePlayerSelectedMission(player);
    }
    player.workoutPlacementId = '';
    return {
      placementId,
      gymPumpCompletedAt: player.gymPumpCompletedAt,
      skillAward: skillAwards[0] ?? null,
      skillAwards
    };
  }

  handleWorkoutRelease(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return { placementId: '' };
    }

    const placementId = typeof message?.placementId === 'string'
      ? message.placementId.trim()
      : '';
    if (!placementId || player.workoutPlacementId === placementId) {
      player.workoutPlacementId = '';
    }

    return { placementId: player.workoutPlacementId || '' };
  }

  updateCombatTimers() {
    const now = Date.now();
    const deltaMs = Math.max(16, now - this.lastNpcSimulationAt);
    this.lastNpcSimulationAt = now;

    for (const sessionId of this.state.players.keys()) {
      const player = this.state.players.get(sessionId);
      if (player.isReloading && player.reloadEndsAt && now >= player.reloadEndsAt) {
        this.completeReload(player);
        this.queuePlayerSnapshotSave(sessionId);
      }

      if (player.alive === false && player.respawnAt && now >= player.respawnAt) {
        this.finishRespawn(sessionId, player);
        continue;
      }

      if (this.updatePlayerHealthRegen(sessionId, player, now, deltaMs)) {
        this.queuePlayerSnapshotSave(sessionId);
      }

      if (refreshPlayerDrunkness(player, now)) {
        this.queuePlayerSnapshotSave(sessionId);
      }
    }

    for (const pickup of this.state.pickups.values()) {
      if (!pickup.active && pickup.kind === 'spawn' && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.active = true;
        pickup.respawnAt = 0;
      }

      if (pickup.kind === 'drop' && pickup.despawnAt && now >= pickup.despawnAt) {
        this.state.pickups.delete(pickup.id);
      }
    }

    this.updateNpcSimulation(now, deltaMs);
  }

  completeReload(player) {
    const needed = Math.max(0, WEAPON_CLIP_SIZE - player.ammoInClip);
    const loaded = Math.min(needed, player.reserveAmmo);
    player.ammoInClip += loaded;
    player.reserveAmmo -= loaded;
    player.isReloading = false;
    player.reloadEndsAt = 0;
  }

  finishRespawn(sessionId, player) {
    const spawn = this.chooseHospitalRespawnPoint();
    player.x = quantizePosition(spawn.x);
    player.y = 0;
    player.z = quantizePosition(spawn.z);
    player.rotationY = quantizeRotation(spawn.rotationY);
    player.aimRotationY = player.rotationY;
    player.aiming = false;
    player.skating = false;
    player.health = PLAYER_MAX_HEALTH;
    player.maxHealth = PLAYER_MAX_HEALTH;
    player.alive = true;
    player.respawnAt = 0;
    player.spawnProtectedUntil = 0;
    player.equippedWeaponId = '';
    player.ownedWeaponIds = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    clearPlayerDrunkness(player);
    player.lastDamagedAt = 0;
    player.workoutPlacementId = '';
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq += 1;
    player.money = Math.trunc(Number(player.money ?? 0) || 0) - PLAYER_RESPAWN_COST;
    const meta = this.getPlayerMeta(sessionId);
    meta.x = player.x;
    meta.z = player.z;
    meta.acceptedAt = Date.now();
    meta.lastTransformSeq = normalizeTransformSeq(meta.lastTransformSeq ?? player.transformSeq ?? 0);
    player.transformSeq = meta.lastTransformSeq;
    meta.lastPunchAt = 0;
    meta.lastShotAt = 0;
    meta.healthRegenCarryMs = 0;
    this.broadcastCombatEvent({
      type: 'respawn',
      playerId: sessionId,
      x: player.x,
      z: player.z
    });
    this.queuePlayerSnapshotSave(sessionId);
  }

  startReload(sessionId, player, { emitEvent = true } = {}) {
    if (
      !player
      || player.alive === false
      || !player.equippedWeaponId
      || player.isReloading
      || player.ammoInClip >= WEAPON_CLIP_SIZE
      || player.reserveAmmo <= 0
    ) {
      return false;
    }

    const now = Date.now();
    player.isReloading = true;
    player.reloadEndsAt = now + WEAPON_RELOAD_MS;
    if (emitEvent) {
      this.broadcastCombatEvent({
        type: 'reload',
        playerId: sessionId,
        weaponId: player.equippedWeaponId,
        startedAt: now,
        endsAt: player.reloadEndsAt
      });
    }
    this.queuePlayerSnapshotSave(sessionId);
    return true;
  }

  handleReloadRequest(client) {
    const player = this.state.players.get(client.sessionId);
    this.startReload(client.sessionId, player);
  }

  handlePickupRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const pickup = this.state.pickups.get(String(message.pickupId ?? ''));
    if (!pickup?.active) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    if (distanceSquared2D(meta.x, meta.z, pickup.x, pickup.z) > PICKUP_INTERACT_RADIUS * PICKUP_INTERACT_RADIUS) {
      return;
    }

    const result = applyWeaponPickupToPlayerState(player, pickup);
    if (!result.changed) {
      return;
    }

    this.consumePickup(pickup);
    this.broadcastCombatEvent({
      type: 'pickup',
      playerId: client.sessionId,
      pickupId: pickup.id,
      weaponId: result.weaponId
    });
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  handleEquipRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const nextWeaponId = normalizeEquippableWeaponId(message?.weaponId);
    if (!canEquipInventoryWeapon(player.ownedWeaponIds, nextWeaponId)) {
      return;
    }
    if (player.equippedWeaponId === nextWeaponId) {
      return;
    }

    player.equippedWeaponId = nextWeaponId;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  handleFireRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false || !player.equippedWeaponId || player.isReloading) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    const now = Date.now();
    if (player.ammoInClip <= 0 || (now - (meta.lastShotAt ?? 0)) < WEAPON_FIRE_INTERVAL_MS) {
      return;
    }

    const aim = normalizeAimVector(Number(message.aimX), Number(message.aimZ));
    const shotOrigin = this.resolveShotOrigin(player, {
      x: Number(message.originX),
      z: Number(message.originZ)
    });
    meta.lastShotAt = now;
    player.ammoInClip = Math.max(0, player.ammoInClip - 1);

    const shot = this.resolveShot(client.sessionId, player, aim, shotOrigin);
    this.triggerPoliceHostilityForPlayer(client.sessionId, player, 'shot-fired', now);
    this.broadcastCombatEvent({
      type: 'shot',
      shooterType: 'player',
      shooterId: client.sessionId,
      weaponId: player.equippedWeaponId,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt: Number.isFinite(message.clientShotAt) ? Math.max(0, Math.floor(message.clientShotAt)) : now
    });

    if (shot.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterId: client.sessionId,
        shooterType: 'player',
        kind: shot.kind,
        targetId: shot.targetId ?? '',
        x: shot.hitX,
        z: shot.hitZ
      });
    }

    if (shot.kind === 'player' && shot.targetId) {
      const target = this.state.players.get(shot.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - WEAPON_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(shot.targetId, client.sessionId);
        }
        this.queuePlayerSnapshotSave(shot.targetId);
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, client.sessionId, now);
    }

    if (player.ammoInClip <= 0 && player.reserveAmmo > 0) {
      this.startReload(client.sessionId, player);
    }
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  handlePunchRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return;
    }

    const meta = this.getPlayerMeta(client.sessionId);
    const now = Date.now();
    if ((now - (meta.lastPunchAt ?? 0)) < PUNCH_INTERVAL_MS) {
      return;
    }

    const aim = normalizeAimVector(Number(message.aimX), Number(message.aimZ));
    meta.lastPunchAt = now;
    player.emoteId = PUNCH_EMOTE_ID;
    player.emoteActive = true;
    player.emoteStartedAt = now;
    player.emoteSeq += 1;
    this.triggerPoliceHostilityForPlayer(client.sessionId, player, 'punch', now);

    const hit = this.resolvePunch(client.sessionId, player, aim);
    if (hit.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterId: client.sessionId,
        shooterType: 'player',
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt: Number.isFinite(message.clientPunchAt) ? Math.max(0, Math.floor(message.clientPunchAt)) : now
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - PUNCH_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, client.sessionId);
        }
        this.queuePlayerSnapshotSave(hit.targetId);
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, client.sessionId, now);
    }
    this.queuePlayerSnapshotSave(client.sessionId);
  }

  handlePlayerDeath(victimId, killerId = '') {
    const player = this.state.players.get(victimId);
    if (!player || player.alive === false) {
      return;
    }

    this.getPlayerMeta(victimId).healthRegenCarryMs = 0;

    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
    player.skating = false;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.deaths += 1;
    player.workoutPlacementId = '';
    player.emoteId = LIMP_EMOTE_ID;
    player.emoteActive = true;
    player.emoteStartedAt = Date.now();
    player.emoteSeq += 1;
    this.dropWeaponPickup(player);
    player.equippedWeaponId = '';
    player.ownedWeaponIds = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;

    if (killerId && killerId !== victimId) {
      const killer = this.state.players.get(killerId);
      if (killer) {
        killer.kills += 1;
        this.triggerPoliceHostilityForPlayer(killerId, killer, 'player-kill', Date.now());
      }
    }

    this.broadcastCombatEvent({
      type: 'death',
      victimId,
      killerId,
      x: player.x,
      z: player.z
    });
    this.queuePlayerSnapshotSave(victimId);
    this.queuePlayerSnapshotSave(killerId);
  }

  dropWeaponPickup(player) {
    const totalAmmo = player.ammoInClip + player.reserveAmmo;
    const weaponId = player.equippedWeaponId || (hasInventoryWeapon(player.ownedWeaponIds, WEAPON_IDS.pistol) ? WEAPON_IDS.pistol : '');
    if (!weaponId || totalAmmo <= 0) {
      return;
    }

    const pickup = createPickupState({
      id: `pickup_drop_${++this.pickupSequence}`,
      weaponId,
      x: player.x,
      z: player.z,
      ammoInClip: player.ammoInClip,
      reserveAmmo: player.reserveAmmo
    }, {
      kind: 'drop',
      active: true,
      despawnAt: Date.now() + DROPPED_PICKUP_DESPAWN_MS
    });
    this.state.pickups.set(pickup.id, pickup);
  }

  consumePickup(pickup) {
    if (pickup.kind === 'spawn') {
      pickup.active = false;
      pickup.respawnAt = Date.now() + PICKUP_RESPAWN_MS;
      pickup.despawnAt = 0;
      return;
    }

    this.state.pickups.delete(pickup.id);
  }

  resolveShotOrigin(player, origin = null) {
    const nextOrigin = {
      x: Number.isFinite(origin?.x) ? origin.x : player.x,
      z: Number.isFinite(origin?.z) ? origin.z : player.z
    };
    const offsetX = nextOrigin.x - player.x;
    const offsetZ = nextOrigin.z - player.z;
    const offsetLengthSq = (offsetX * offsetX) + (offsetZ * offsetZ);
    if (offsetLengthSq > SHOT_ORIGIN_MAX_OFFSET * SHOT_ORIGIN_MAX_OFFSET && offsetLengthSq > 0.0001 * 0.0001) {
      const offsetLength = Math.sqrt(offsetLengthSq);
      const scale = SHOT_ORIGIN_MAX_OFFSET / offsetLength;
      nextOrigin.x = player.x + offsetX * scale;
      nextOrigin.z = player.z + offsetZ * scale;
    }

    return nextOrigin;
  }

  resolveCombatShot(origin, aim, maxDistance, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    let nearestDistance = WEAPON_RANGE;
    let result = {
      kind: 'miss',
      hitX: origin.x + aim.x * maxDistance,
      hitZ: origin.z + aim.z * maxDistance,
      targetId: ''
    };

    this.worldState.forEachPlacementCollisionRect(({ placementId, rect }) => {
      const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, nearestDistance, rect);
      if (
        hitDistance == null
        || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, SHOT_WORLD_BLOCKER_GRACE_DISTANCE)
        || hitDistance >= nearestDistance
      ) {
        return;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'world',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: placementId
      };
    }, { collisionKey: 'blocksShots' });

    for (const sessionId of this.state.players.keys()) {
      const target = this.state.players.get(sessionId);
      if (sessionId === ignorePlayerId || target.alive === false) {
        continue;
      }

      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        PLAYER_RADIUS
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'player',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: sessionId
      };
    }

    for (const npcId of this.state.npcs.keys()) {
      const target = this.state.npcs.get(npcId);
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'npc',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: npcId
      };
    }

    return result;
  }

  resolveShot(shooterSessionId, player, aim, origin = player) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignorePlayerId: shooterSessionId
    });
  }

  resolveShotFromNpc(npcId, npc, aim, origin = npc) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignoreNpcId: npcId
    });
  }

  resolveCombatPunch(origin, aim, maxDistance, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    let nearestDistance = maxDistance;
    let result = {
      kind: 'miss',
      hitX: origin.x + aim.x * maxDistance,
      hitZ: origin.z + aim.z * maxDistance,
      targetId: ''
    };

    this.worldState.forEachPlacementCollisionRect(({ placementId, rect }) => {
      const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, nearestDistance, rect);
      if (
        hitDistance == null
        || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, PUNCH_WORLD_BLOCKER_GRACE_DISTANCE)
        || hitDistance >= nearestDistance
      ) {
        return;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'world',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: placementId
      };
    }, { collisionKey: 'blocksShots' });

    for (const sessionId of this.state.players.keys()) {
      const target = this.state.players.get(sessionId);
      if (sessionId === ignorePlayerId || target.alive === false) {
        continue;
      }

      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        PLAYER_RADIUS
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'player',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: sessionId
      };
    }

    for (const npcId of this.state.npcs.keys()) {
      const target = this.state.npcs.get(npcId);
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      const hitDistance = rayCircleIntersectionDistance(
        origin.x,
        origin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      );
      if (hitDistance == null || hitDistance >= nearestDistance) {
        continue;
      }

      nearestDistance = hitDistance;
      result = {
        kind: 'npc',
        hitX: origin.x + aim.x * hitDistance,
        hitZ: origin.z + aim.z * hitDistance,
        targetId: npcId
      };
    }

    return result;
  }

  resolvePunch(attackerSessionId, player, aim) {
    return this.resolveCombatPunch(player, aim, PUNCH_RANGE, {
      ignorePlayerId: attackerSessionId
    });
  }

  resolvePunchFromNpc(npcId, npc, aim) {
    return this.resolveCombatPunch(npc, aim, PUNCH_RANGE, {
      ignoreNpcId: npcId
    });
  }

  performNpcShot(npcId, npc, targetPosition, now = Date.now()) {
    const aim = normalizeAimVector(targetPosition.x - npc.x, targetPosition.z - npc.z);
    const shotOrigin = {
      x: npc.x + aim.x * NPC_SHOT_ORIGIN_FORWARD_OFFSET,
      z: npc.z + aim.z * NPC_SHOT_ORIGIN_FORWARD_OFFSET
    };
    npc.rotationY = quantizeRotation(Math.atan2(aim.x, aim.z));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    const shot = this.resolveShotFromNpc(npcId, npc, aim, shotOrigin);
    this.broadcastCombatEvent({
      type: 'shot',
      shooterType: 'npc',
      shooterId: npcId,
      weaponId: npc.weaponId || WEAPON_IDS.pistol,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt: now
    });

    if (shot.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterType: 'npc',
        shooterId: npcId,
        kind: shot.kind,
        targetId: shot.targetId ?? '',
        x: shot.hitX,
        z: shot.hitZ
      });
    }

    if (shot.kind === 'player' && shot.targetId) {
      const target = this.state.players.get(shot.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - WEAPON_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(shot.targetId, npcId);
        }
        this.queuePlayerSnapshotSave(shot.targetId);
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, npcId, now);
    }
  }

  performNpcPunch(npcId, npc, targetPosition, now = Date.now()) {
    const aim = normalizeAimVector(targetPosition.x - npc.x, targetPosition.z - npc.z);
    npc.rotationY = quantizeRotation(Math.atan2(aim.x, aim.z));
    npc.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(npc.rotationY);
    const hit = this.resolvePunchFromNpc(npcId, { x: npc.x, z: npc.z }, aim);
    if (hit.kind !== 'miss') {
      this.broadcastCombatEvent({
        type: 'impact',
        shooterType: 'npc',
        shooterId: npcId,
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        clientPunchAt: now
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - PUNCH_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, npcId);
        }
        this.queuePlayerSnapshotSave(hit.targetId);
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, npcId, now);
    }
  }

  broadcastCombatEvent(event) {
    this.broadcast('combat:event', event);
  }

  updatePlayerHealthRegen(sessionId, player, now, deltaMs) {
    if (!player || player.alive === false) {
      return false;
    }

    const meta = this.getPlayerMeta(sessionId);
    const regen = tickHealthRegen({
      health: player.health,
      maxHealth: player.maxHealth,
      alive: player.alive !== false,
      deltaMs,
      now,
      lastDamagedAt: player.lastDamagedAt,
      lastCombatAt: 0,
      carryMs: meta.healthRegenCarryMs
    });

    meta.healthRegenCarryMs = regen.carryMs;
    if (regen.healed <= 0 || regen.health === player.health) {
      return false;
    }

    player.health = regen.health;
    return true;
  }

  async handleRpc(client, requestId, handler, options = {}) {
    try {
      const persistSnapshot = options?.persistSnapshot !== false;
      const payload = await Promise.resolve().then(() => handler());
      client.send('rpc:response', {
        requestId,
        ok: true,
        ...payload
      });
      if (persistSnapshot) {
        void this.savePlayerSnapshot(client.sessionId);
      }
    } catch (error) {
      logServerError('room', 'RPC request failed.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        requestId
      });
      client.send('rpc:response', {
        requestId,
        ok: false,
        error: error.message || 'Request failed.'
      });
    }
  }

  async commitWorldPatch(patch, previousLayout) {
    const nextLayout = this.worldState.serializeLayout();

    try {
      await this.worldPersistence.save(nextLayout);
    } catch (error) {
      this.worldState.loadLayout(previousLayout);
      this.syncNpcDefinitionsFromWorld();
      this.syncCombatPickupsFromWorld();
      throw error;
    }

    this.syncCombatPickupsFromWorld();
    this.broadcast('world:patch', patch);
    return {
      placementId: patch.placement?.id ?? patch.placementId ?? null
    };
  }

  async handleWorldEdit(client, message = {}) {
    this.assertAdminClient(client);
    const { op, payload = {} } = message;
    const previousLayout = this.worldState.serializeLayout();

    switch (op) {
      case 'placeTile': {
        const next = this.sanitizeTilePlacement(payload);
        const result = this.worldState.placeTile(
          next.item,
          next.cellX,
          next.cellZ,
          next.rotationQuarterTurns,
          next.interactable
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId
        }, previousLayout);
      }
      case 'placeProp': {
        const next = this.sanitizePropPlacement(payload);
        const placement = this.worldState.placeProp(
          next.item,
          next.x,
          next.z,
          next.rotationQuarterTurns,
          next.interactable,
          next.scale,
          next.rotationY
        );
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'placeNpc': {
        const next = this.sanitizeNpcPlacement(payload);
        const placement = this.worldState.placeNpc(
          next.item,
          next.x,
          next.z,
          next.rotationQuarterTurns,
          next.npc
        );
        this.syncNpcDefinitionsFromWorld();
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'rotatePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        const result = this.worldState.rotatePlacement(placement.id);
        if (!result?.placement) {
          throw new Error(result?.error ?? 'That placement is not available.');
        }
        const rotated = result.placement;
        if (rotated.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
          this.resetNpcRuntimeState(rotated.id, { restartFromSpawn: true, reason: 'placement-rotated' });
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(rotated.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'movePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        const next = placement.layer === 'tile'
          ? this.sanitizeMovedTilePlacement(payload)
          : this.sanitizeMovedFreePlacement(payload);
        const result = this.worldState.movePlacement(placement.id, next);
        if (!result?.placement) {
          throw new Error(result?.error ?? 'That placement is not available.');
        }
        if (placement.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
          this.resetNpcRuntimeState(result.placement.id, { restartFromSpawn: true, reason: 'placement-moved' });
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId ?? null
        }, previousLayout);
      }
      case 'deletePlacement': {
        const placement = this.assertEditablePlacement(payload.placementId);
        this.worldState.deletePlacement(placement.id);
        if (placement.layer === 'npc') {
          this.syncNpcDefinitionsFromWorld();
        }
        return this.commitWorldPatch({
          type: 'deletePlacement',
          placementId: placement.id
        }, previousLayout);
      }
      case 'updateNpc': {
        const placement = this.assertEditablePlacement(payload.placementId, 'npc');
        const previousNpc = cloneNpcBehavior(placement.npc);
        const updates = this.sanitizeNpcUpdates(payload);
        const updatedPlacement = this.worldState.updateNpc(placement.id, updates);
        if (!updatedPlacement) {
          throw new Error('That NPC is not available.');
        }

        this.syncNpcDefinitionsFromWorld();
        if (shouldResetNpcRuntimeForBehaviorUpdate(previousNpc, updatedPlacement.npc, updates)) {
          this.resetNpcRuntimeState(updatedPlacement.id, { restartFromSpawn: false, reason: 'npc-updated' });
        }
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'updatePlacementInteractable': {
        const placement = this.assertEditablePlacement(payload.placementId);
        if (placement.layer === 'npc') {
          throw new Error('That placement cannot be edited this way.');
        }

        const interactable = this.sanitizePlacementInteractable(payload.interactable);
        const updatedPlacement = this.worldState.updatePlacementInteractable(placement.id, interactable);
        if (!updatedPlacement) {
          throw new Error('That placement is not available.');
        }

        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'updatePlacementScale': {
        const placement = this.assertEditablePlacement(payload.placementId, 'prop');
        const scale = normalizePropPlacementScale(payload.scale, getDefaultPropPlacementScale(placement));
        const updatedPlacement = this.worldState.updatePlacementScale(placement.id, scale);
        if (!updatedPlacement) {
          throw new Error('That prop is not available.');
        }

        this.syncCombatPickupsFromWorld();
        return this.commitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(updatedPlacement.id),
          replacedPlacementId: null
        }, previousLayout);
      }
      case 'updateMissionSequence': {
        const missionSequence = this.worldState.updateMissionSequence(payload.missionSequence);
        for (const player of this.state.players.values()) {
          this.normalizePlayerSelectedMission(player);
        }

        return this.commitWorldPatch({
          type: 'updateMissionSequence',
          missionSequence
        }, previousLayout);
      }
      case 'updatePassiveTrafficRoutes': {
        const passiveTrafficRoutes = this.worldState.updatePassiveTrafficRoutes(payload.passiveTrafficRoutes);
        return this.commitWorldPatch({
          type: 'updatePassiveTrafficRoutes',
          passiveTrafficRoutes
        }, previousLayout);
      }
      case 'updateNpcModelVoice': {
        const { modelId, voice } = this.sanitizeNpcModelVoiceUpdate(payload);
        const updatedVoice = this.worldState.updateNpcModelVoice(modelId, voice);

        return this.commitWorldPatch({
          type: 'updateNpcModelVoice',
          modelId,
          voice: updatedVoice
        }, previousLayout);
      }
      default:
        throw new Error('That world edit is not supported.');
    }
  }

  updateBuilderPresence(client, message) {
    this.assertAdminClient(client);
    const sanitized = this.sanitizeBuilderPresence(message);
    if (!sanitized.active) {
      this.state.builders.delete(client.sessionId);
      return { active: false };
    }

    const presence = this.state.builders.get(client.sessionId) ?? new BuilderPresenceState();
    presence.active = true;
    presence.itemId = sanitized.itemId;
    presence.layer = sanitized.layer;
    presence.rotationQuarterTurns = sanitized.rotationQuarterTurns;
    presence.rotationY = sanitized.rotationY;
    presence.scale = sanitized.scale;
    presence.cellX = sanitized.cellX;
    presence.cellZ = sanitized.cellZ;
    presence.x = sanitized.x;
    presence.z = sanitized.z;
    presence.selectionPlacementId = sanitized.selectionPlacementId;
    this.state.builders.set(client.sessionId, presence);
    return { active: true };
  }

  sanitizeBuilderPresence(message = {}) {
    const active = Boolean(message.active);
    if (!active) {
      return { active: false };
    }

    const item = getBuilderItemById(message.itemId);
    if (!item) {
      throw new Error('That builder item is not available.');
    }

    const rotationQuarterTurns = normalizeRotationQuarterTurns(message.rotationQuarterTurns);
    const exactRotationY = Number(message.rotationY);

    return {
      active: true,
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns,
      rotationY: item.layer === 'prop' && Number.isFinite(exactRotationY)
        ? quantizeRotation(exactRotationY)
        : quantizeRotation(toRotationY(rotationQuarterTurns)),
      scale: item.layer === 'prop'
        ? normalizePropPlacementScale(message.scale, getDefaultPropPlacementScale(item))
        : 1,
      cellX: Math.round(Number(message.cellX ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? 0)),
      x: quantizePosition(message.x),
      z: quantizePosition(message.z),
      selectionPlacementId: typeof message.selectionPlacementId === 'string' ? message.selectionPlacementId : ''
    };
  }

  sanitizeTilePlacement(message = {}) {
    const item = getBuilderItemById(message.itemId);
    if (!item || item.layer !== 'tile') {
      throw new Error('That tile is not available.');
    }

    return {
      item,
      cellX: Math.round(Number(message.cellX ?? message.cell?.[0] ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? message.cell?.[1] ?? 0)),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      interactable: this.sanitizePlacementInteractable(message.interactable ?? item.interactable ?? null)
    };
  }

  sanitizePropPlacement(message = {}) {
    const item = getBuilderItemById(message.itemId);
    if (!item || item.layer !== 'prop') {
      throw new Error('That prop is not available.');
    }

    return {
      item,
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1]),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      rotationY: Number.isFinite(Number(message.rotationY)) ? quantizeRotation(message.rotationY) : null,
      scale: normalizePropPlacementScale(message.scale, getDefaultPropPlacementScale(item)),
      interactable: this.sanitizePlacementInteractable(message.interactable ?? item.interactable ?? null)
    };
  }

  sanitizeNpcPlacement(message = {}) {
    const model = getNpcModelById(message.modelId);
    if (!model) {
      throw new Error('That NPC model is not available.');
    }

    const item = getBuilderItemById(model.itemId);
    if (!item || item.layer !== 'npc') {
      throw new Error('That NPC is not available.');
    }

    const name = String(message.name ?? item.label ?? 'NPC').trim().slice(0, NPC_NAME_MAX_LENGTH) || 'NPC';
    return {
      item,
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1]),
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
      npc: normalizeNpcBehavior({
        modelId: model.id,
        name,
        prompt: String(message.prompt ?? defaultNpcPrompt(name)).slice(0, NPC_PROMPT_MAX_LENGTH),
        interactRadius: clampNpcRadius(message.interactRadius ?? NPC_DEFAULT_INTERACT_RADIUS),
        policeOfficerEnabled: message.policeOfficerEnabled === true,
        lawRadius: clampNpcLawRadius(message.lawRadius),
        speed: message.speed,
        respawnDelayMs: message.respawnDelayMs,
        deliveryQuestEnabled: message.deliveryQuestEnabled === true,
        gymCheckInEnabled: Object.hasOwn(message, 'gymCheckInEnabled')
          ? message.gymCheckInEnabled === true
          : model.id === 'remy',
        rentCollectorEnabled: message.rentCollectorEnabled === true,
        stockMarketEnabled: message.stockMarketEnabled === true,
        bartenderEnabled: message.bartenderEnabled === true,
        pawnShopOwnerEnabled: message.pawnShopOwnerEnabled === true,
        carDealerEnabled: message.carDealerEnabled === true,
        marthaEnabled: message.marthaEnabled === true,
        blackjackDealerEnabled: message.blackjackDealerEnabled === true,
        schoolMicrogameEnabled: message.schoolMicrogameEnabled === true,
        schoolMicrogameId: normalizeSchoolMicrogameId(message.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID),
        routine: message.routine,
        combat: message.combat,
        spawnPosition: [quantizePosition(message.x ?? message.position?.[0]), quantizePosition(message.z ?? message.position?.[1])],
        spawnRotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
      }, {
        position: [quantizePosition(message.x ?? message.position?.[0]), quantizePosition(message.z ?? message.position?.[1])],
        rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns)
      })
    };
  }

  sanitizeNpcUpdates(message = {}) {
    const updates = {};
    let hasUpdates = false;

    if (Object.hasOwn(message, 'name')) {
      updates.name = String(message.name ?? 'NPC').trim().slice(0, NPC_NAME_MAX_LENGTH) || 'NPC';
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'prompt')) {
      updates.prompt = String(message.prompt ?? '').slice(0, NPC_PROMPT_MAX_LENGTH);
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'interactRadius')) {
      updates.interactRadius = clampNpcRadius(message.interactRadius);
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'policeOfficerEnabled')) {
      updates.policeOfficerEnabled = message.policeOfficerEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'lawRadius')) {
      updates.lawRadius = clampNpcLawRadius(message.lawRadius);
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'respawnDelayMs')) {
      updates.respawnDelayMs = normalizeNpcBehavior({ respawnDelayMs: message.respawnDelayMs }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).respawnDelayMs;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'speed')) {
      updates.speed = normalizeNpcBehavior({ speed: message.speed }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).speed;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'deliveryQuestEnabled')) {
      updates.deliveryQuestEnabled = message.deliveryQuestEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'gymCheckInEnabled')) {
      updates.gymCheckInEnabled = message.gymCheckInEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'rentCollectorEnabled')) {
      updates.rentCollectorEnabled = message.rentCollectorEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'stockMarketEnabled')) {
      updates.stockMarketEnabled = message.stockMarketEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'bartenderEnabled')) {
      updates.bartenderEnabled = message.bartenderEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'pawnShopOwnerEnabled')) {
      updates.pawnShopOwnerEnabled = message.pawnShopOwnerEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'carDealerEnabled')) {
      updates.carDealerEnabled = message.carDealerEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'marthaEnabled')) {
      updates.marthaEnabled = message.marthaEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'blackjackDealerEnabled')) {
      updates.blackjackDealerEnabled = message.blackjackDealerEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'schoolMicrogameEnabled')) {
      updates.schoolMicrogameEnabled = message.schoolMicrogameEnabled === true;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'schoolMicrogameId')) {
      updates.schoolMicrogameId = normalizeSchoolMicrogameId(message.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'routine')) {
      updates.routine = normalizeNpcBehavior({ routine: message.routine }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).routine;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'combat')) {
      updates.combat = normalizeNpcBehavior({ combat: message.combat }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).combat;
      hasUpdates = true;
    }
    if (Object.hasOwn(message, 'modelId')) {
      const model = getNpcModelById(message.modelId);
      if (!model) {
        throw new Error('That NPC model is not available.');
      }
      updates.modelId = model.id;
      updates.itemId = model.itemId;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      throw new Error('No NPC changes were provided.');
    }

    return updates;
  }

  sanitizeNpcModelVoiceUpdate(message = {}) {
    const model = getNpcModelById(message.modelId);
    if (!model) {
      throw new Error('That NPC model is not available.');
    }

    return {
      modelId: model.id,
      voice: normalizeNpcVoice(message.voice, model.voice)
    };
  }

  sanitizeMovedTilePlacement(message = {}) {
    return {
      cellX: Math.round(Number(message.cellX ?? message.cell?.[0] ?? 0)),
      cellZ: Math.round(Number(message.cellZ ?? message.cell?.[1] ?? 0))
    };
  }

  sanitizeMovedFreePlacement(message = {}) {
    return {
      x: quantizePosition(message.x ?? message.position?.[0]),
      z: quantizePosition(message.z ?? message.position?.[1])
    };
  }

  sanitizePlacementInteractable(interactable = null) {
    if (!interactable || typeof interactable !== 'object') {
      return null;
    }

    const next = {};

    if (Object.hasOwn(interactable, 'label')) {
      const value = String(interactable.label ?? '').trim().slice(0, 48);
      if (value) {
        next.label = value;
      }
    }
    if (Object.hasOwn(interactable, 'prompt')) {
      const value = String(interactable.prompt ?? '').trim().slice(0, 80);
      if (value) {
        next.prompt = value;
      }
    }
    if (Object.hasOwn(interactable, 'actionText')) {
      const value = String(interactable.actionText ?? '').trim().slice(0, 240);
      if (value) {
        next.actionText = value;
      }
    }

    next.radius = clampNpcRadius(interactable.radius ?? 4);
    next.distance = Math.max(1, Math.min(28, Number(interactable.distance ?? 6.16) || 6.16));

    if (Array.isArray(interactable.localOffset) && interactable.localOffset.length >= 2) {
      next.localOffset = [
        quantizePosition(interactable.localOffset[0]),
        quantizePosition(interactable.localOffset[1])
      ];
    }

    if (Array.isArray(interactable.approachLocalOffset) && interactable.approachLocalOffset.length >= 2) {
      next.approachLocalOffset = [
        quantizePosition(interactable.approachLocalOffset[0]),
        quantizePosition(interactable.approachLocalOffset[1])
      ];
    }

    if (typeof interactable.workoutType === 'string' && interactable.workoutType.trim()) {
      next.workoutType = interactable.workoutType.trim().slice(0, 32);
    }

    if (Number.isFinite(Number(interactable.approachRotationY))) {
      next.approachRotationY = quantizeRotation(Number(interactable.approachRotationY));
    }

    return next;
  }

  assertEditablePlacement(placementId, expectedLayer = null) {
    const placement = this.worldState.getPlacement(String(placementId ?? ''));
    if (!placement) {
      throw new Error('That placement is not available.');
    }

    if (expectedLayer && placement.layer !== expectedLayer) {
      throw new Error('That placement cannot be edited this way.');
    }

    return placement;
  }

  syncNpcDefinitionsFromWorld() {
    const nextIds = new Set();

    this.worldState.forEachNpcDefinition((definition) => {
      nextIds.add(definition.id);
      const normalizedDefinition = normalizeNpcBehavior(definition, {
        position: definition.position,
        rotationQuarterTurns: definition.rotationQuarterTurns
      });
      this.npcDefinitions.set(definition.id, normalizedDefinition);
      const existing = this.state.npcs.get(definition.id) ?? new NpcState();
      const spawnPosition = normalizedDefinition.spawnPosition ?? normalizedDefinition.position ?? definition.position;
      const spawnRotationQuarterTurns = normalizeRotationQuarterTurns(
        normalizedDefinition.spawnRotationQuarterTurns ?? definition.rotationQuarterTurns
      );
      const isExistingRuntimeValid = this.state.npcs.has(definition.id)
        && existing.alive !== false
        && existing.mode !== NPC_RUNTIME_MODES.hidden;
      existing.id = definition.id;
      existing.modelId = normalizedDefinition.modelId;
      existing.name = normalizedDefinition.name;
      existing.x = isExistingRuntimeValid ? quantizePosition(existing.x) : quantizePosition(spawnPosition[0]);
      existing.z = isExistingRuntimeValid ? quantizePosition(existing.z) : quantizePosition(spawnPosition[1]);
      existing.rotationY = isExistingRuntimeValid
        ? quantizeRotation(existing.rotationY)
        : quantizeRotation(toRotationY(spawnRotationQuarterTurns));
      existing.rotationQuarterTurns = quantizeRotationQuarterTurnsFromRotationY(existing.rotationY);
      existing.interactRadius = clampNpcRadius(normalizedDefinition.interactRadius);
      existing.policeOfficerEnabled = normalizedDefinition.policeOfficerEnabled === true;
      existing.lawRadius = clampNpcLawRadius(normalizedDefinition.lawRadius);
      existing.deliveryQuestEnabled = normalizedDefinition.deliveryQuestEnabled === true;
      existing.gymCheckInEnabled = normalizedDefinition.gymCheckInEnabled === true;
      existing.rentCollectorEnabled = normalizedDefinition.rentCollectorEnabled === true;
      existing.stockMarketEnabled = normalizedDefinition.stockMarketEnabled === true;
      existing.bartenderEnabled = normalizedDefinition.bartenderEnabled === true;
      existing.pawnShopOwnerEnabled = normalizedDefinition.pawnShopOwnerEnabled === true;
      existing.carDealerEnabled = normalizedDefinition.carDealerEnabled === true;
      existing.marthaEnabled = normalizedDefinition.marthaEnabled === true;
      existing.blackjackDealerEnabled = normalizedDefinition.blackjackDealerEnabled === true;
      existing.schoolMicrogameEnabled = normalizedDefinition.schoolMicrogameEnabled === true;
      existing.schoolMicrogameId = normalizeSchoolMicrogameId(normalizedDefinition.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
      existing.health = Math.max(0, Number(existing.health || NPC_DEFAULT_MAX_HEALTH));
      existing.maxHealth = Math.max(1, Number(existing.maxHealth || NPC_DEFAULT_MAX_HEALTH));
      existing.alive = existing.alive !== false && existing.health > 0;
      existing.respawnAt = Math.max(0, Math.floor(existing.respawnAt || 0));
      existing.active = true;
      existing.mode = existing.alive === false ? NPC_RUNTIME_MODES.dead : (existing.mode || NPC_RUNTIME_MODES.routine);
      existing.currentStepIndex = Math.max(0, Math.floor(existing.currentStepIndex || 0));
      existing.targetPlacementId = existing.targetPlacementId || '';
      existing.weaponId = normalizedDefinition.combat?.weaponId ?? '';
      existing.lastAttackerId = existing.lastAttackerId || '';
      existing.hiddenUntil = Math.max(0, Math.floor(existing.hiddenUntil || 0));
      existing.activity = existing.activity || '';
      existing.lastDamagedAt = Math.max(0, Math.floor(existing.lastDamagedAt || 0));
      existing.busy = Boolean(existing.busy);
      existing.chatStatus = existing.chatStatus || 'idle';
      existing.chatText = existing.chatText || '';
      existing.chatStartedAt = Number(existing.chatStartedAt || 0);
      existing.chatSeq = Number(existing.chatSeq || 0);
      if (!this.npcRuntimeMeta.has(definition.id)) {
        this.npcRuntimeMeta.set(definition.id, createNpcRuntimeMeta());
      }
      if (!this.transcripts.has(definition.id)) {
        this.transcripts.set(definition.id, []);
      }
      this.state.npcs.set(definition.id, existing);
    });

    for (const npcId of this.state.npcs.keys()) {
      if (nextIds.has(npcId)) {
        continue;
      }

      this.state.npcs.delete(npcId);
      this.npcDefinitions.delete(npcId);
      this.npcRuntimeMeta.delete(npcId);
      this.transcripts.delete(npcId);
      for (const cooldownKey of this.cooldowns.keys()) {
        if (cooldownKey.endsWith(`:${npcId}`)) {
          this.cooldowns.delete(cooldownKey);
        }
      }
    }

    this.npcRouteGraph = buildNpcRouteGraph(this.worldState);
  }

  logNpcDebugEvent(npcId, message, meta = null) {
    if (!this.npcDebugEnabled) {
      return;
    }

    const npc = npcId ? this.state.npcs.get(npcId) : null;
    logNpcDebug(message, {
      npcId: npcId || undefined,
      npcName: npc?.name || undefined,
      ...(meta ?? {})
    });
  }

  buildNpcDebugPayload(now = Date.now()) {
    const npcs = {};

    for (const npcId of this.state.npcs.keys()) {
      const npc = this.state.npcs.get(npcId);
      const definition = this.getNpcDefinition(npcId);
      if (!definition) {
        continue;
      }

      npcs[npcId] = this.buildNpcDebugSnapshotEntry(npcId, npc, definition, now);
    }

    return {
      enabled: true,
      generatedAt: now,
      npcs
    };
  }

  broadcastNpcDebugSnapshot(now = Date.now(), { force = false } = {}) {
    if (!this.npcDebugEnabled) {
      return;
    }

    if (!force && (now - this.lastNpcDebugBroadcastAt) < NPC_DEBUG_BROADCAST_INTERVAL_MS) {
      return;
    }

    const payload = this.buildNpcDebugPayload(now);
    const signature = JSON.stringify(payload.npcs);
    if (!force && signature === this.lastNpcDebugPayloadSignature) {
      return;
    }

    this.lastNpcDebugPayloadSignature = signature;
    this.lastNpcDebugBroadcastAt = now;
    this.broadcast('npc:debugSnapshot', payload);
  }

  syncNpcDerivedState(_npc) {}

  finalizeNpcSimulationTick(now) {
    this.broadcastNpcDebugSnapshot(now);
  }

  emitNpcCombatEvent(event) {
    this.broadcastCombatEvent(event);
  }

  appendTranscript(npcId, entry) {
    const current = this.transcripts.get(npcId) ?? [];
    const startIndex = Math.max(0, current.length + 1 - MAX_TRANSCRIPT_ENTRIES);
    const next = [];
    for (let index = startIndex; index < current.length; index += 1) {
      next.push(current[index]);
    }
    next.push(entry);
    this.transcripts.set(npcId, next);
  }

  setPlayerSpeech(player, text) {
    player.chatText = text;
    player.chatStartedAt = Date.now();
    player.chatSeq += 1;
  }

  setNpcChatPhase(npc, status, text = npc.chatText || '', { bumpSeq = false } = {}) {
    npc.chatStatus = status;
    npc.chatText = text;
    npc.chatStartedAt = Date.now();
    if (bumpSeq) {
      npc.chatSeq += 1;
    }
  }

  getPlayerAlias(sessionId) {
    if (!this.playerAliases.has(sessionId)) {
      this.playerAliasSequence += 1;
      this.playerAliases.set(sessionId, `Player ${this.playerAliasSequence}`);
    }

    return this.playerAliases.get(sessionId);
  }

  sanitizeChatMessage(message) {
    const trimmedMessage = String(message ?? '').trim();
    if (!trimmedMessage) {
      throw new Error('Say something first.');
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are capped at ${MAX_MESSAGE_LENGTH} characters.`);
    }

    return trimmedMessage;
  }

  findNearestHeardNpc(player) {
    let nearestNpc = null;
    let nearestDistanceSq = Infinity;

    for (const npc of this.state.npcs.values()) {
      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden || npc.mode === NPC_RUNTIME_MODES.dead) {
        continue;
      }
      if (isGymCheckInNpc(npc) && player.gymMembershipActive !== true) {
        continue;
      }

      const radius = Math.max(0, Number(npc.interactRadius ?? 0) || 0);
      const distanceSq = distanceSquared2D(npc.x, npc.z, player.x, player.z);
      if (distanceSq > radius * radius || distanceSq >= nearestDistanceSq) {
        continue;
      }

      nearestNpc = npc;
      nearestDistanceSq = distanceSq;
    }

    return nearestNpc;
  }

  createNpcStreamPublisher(npcId) {
    let lastPublishedText = '';
    let lastPublishedAt = 0;

    return async (partialText) => {
      const liveNpc = this.state.npcs.get(npcId);
      if (!liveNpc || !liveNpc.busy) {
        return;
      }

      const now = Date.now();
      if (partialText === lastPublishedText || (now - lastPublishedAt) < NPC_STREAM_THROTTLE_MS) {
        return;
      }

      lastPublishedText = partialText;
      lastPublishedAt = now;
      this.setNpcChatPhase(liveNpc, 'streaming', partialText);
    };
  }

  appendNpcReplyTranscript(npc, text) {
    this.appendTranscript(
      npc.id,
      createTranscriptEntry(`entry_${++this.sequence}`, 'npc', npc.name, text)
    );
  }

  finalizeNpcReply(npcId, text, { bumpSeq = true } = {}) {
    const npc = this.state.npcs.get(npcId);
    if (!npc) {
      return null;
    }

    this.setNpcChatPhase(npc, 'done', text, { bumpSeq });
    this.appendNpcReplyTranscript(npc, text);
    return npc;
  }

  async handlePublicChat(client, message) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      throw new Error('Your player is not connected.');
    }

    const trimmedMessage = this.sanitizeChatMessage(message.message);
    const cooldownKey = `${client.sessionId}:chat`;
    const lastSentAt = this.cooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastSentAt < CHAT_COOLDOWN_MS) {
      throw new Error('Take a breath before sending another message.');
    }

    this.cooldowns.set(cooldownKey, Date.now());
    this.setPlayerSpeech(player, trimmedMessage);
    const playerAlias = this.getPlayerAlias(client.sessionId);

    logServer('room', 'Public chat accepted.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      messageLength: trimmedMessage.length
    });

    const npc = this.findNearestHeardNpc(player);
    if (npc && !npc.busy) {
      this.awardPlayerSkillXp(player, SKILL_IDS.charisma, CHARISMA_NPC_CHAT_XP);
      this.queuePlayerSnapshotSave(client.sessionId);
      npc.busy = true;
      this.setNpcChatPhase(npc, 'thinking', '', { bumpSeq: true });
      void this.handleNpcReply({
        client,
        npcId: npc.id,
        playerMessage: trimmedMessage,
        playerAlias
      });
    }

    return {};
  }

  async handleNpcReply({ client, npcId, playerMessage, playerAlias }) {
    const npc = this.state.npcs.get(npcId);
    const definition = this.npcDefinitions.get(npcId);
    if (!npc) {
      return;
    }
    if (!definition) {
      npc.busy = false;
      npc.chatStatus = 'idle';
      return;
    }

    try {
      this.appendTranscript(
        npc.id,
        createTranscriptEntry(`entry_${++this.sequence}`, 'player', playerAlias, playerMessage)
      );

      const replyResult = await this.chatEngine.streamReply({
        npc: definition,
        transcript: this.transcripts.get(npc.id) ?? [],
        playerMessage,
        onDelta: this.createNpcStreamPublisher(npc.id)
      });

      const liveNpc = this.finalizeNpcReply(npc.id, replyResult.text);
      if (liveNpc) {
        logServer('room', 'NPC ambient reply completed.', {
          roomId: this.roomId,
          sessionId: client.sessionId,
          npcId: npc.id,
          npcName: npc.name,
          usedFallback: replyResult.usedFallback,
          usedRetry: replyResult.usedRetry,
          endedWithPartial: replyResult.endedWithPartial,
          attemptCount: replyResult.attemptCount
        });
      }
    } catch (error) {
      const fallback = `${npc.name} pauses, then says they need a moment to gather their thoughts.`;
      this.finalizeNpcReply(npc.id, fallback);
      logServerError('room', 'NPC chat provider failed; fallback reply used.', error, {
        roomId: this.roomId,
        sessionId: client.sessionId,
        npcId: npc.id,
        npcName: npc.name
      });
    } finally {
      const liveNpc = this.state.npcs.get(npc.id);
      if (liveNpc) {
        liveNpc.busy = false;
        if (!liveNpc.chatStatus) {
          liveNpc.chatStatus = 'idle';
        }
      }
    }
  }
}

Object.assign(WorldRoom.prototype, npcSimulationMethods);
