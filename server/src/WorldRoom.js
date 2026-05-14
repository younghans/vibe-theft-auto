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
import {
  createInitialStockMarketState,
  executeStockTrade,
  getStockMarketPromptRadius,
  isStockMarketNpc,
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
  OFFICE_JOB_TERMINAL_ITEM_ID,
  OFFICE_JOB_TERMINAL_RADIUS,
  canPlayerWorkOfficeJob,
  getOfficeJobDefinition,
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
  SKILL_IDS,
  STRENGTH_SNATCH_XP,
  applySkillXpToPlayer,
  getPlayerSkillXp,
  normalizeSkillId
} from '../../src/shared/skills.js';
import { getTileCenterWorldPosition, rotateFootprintOffset } from '../../src/shared/tileFootprint.js';
import {
  chooseFarthestSpawnPoint,
  clampToWorldBounds,
  distance2D,
  normalizeAimVector,
  placementToCollisionRects,
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
  NPC_DEFAULT_INTERACT_RADIUS,
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
import { EMOTES_BY_ID, PUNCH_EMOTE_ID } from '../../src/player/emotes.js';
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

function parseAdminKeys(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

const PlayerState = schema({
  x: 'number',
  z: 'number',
  rotationY: 'number',
  aimRotationY: 'number',
  aiming: 'boolean',
  emoteId: 'string',
  emoteActive: 'boolean',
  emoteStartedAt: 'number',
  emoteSeq: 'number',
  chatText: 'string',
  chatStartedAt: 'number',
  chatSeq: 'number',
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
  money: 'number',
  beerCount: 'number',
  shotCount: 'number',
  drunknessDose: 'number',
  drunknessLevel: 'number',
  drunknessEndsAt: 'number',
  gymMembershipActive: 'boolean',
  rentIntroSeq: 'number',
  rentIntroAmount: 'number',
  rentIntroNpcId: 'string',
  rentIntroBuildingPlacementId: 'string',
  rentIntroStartedAt: 'number',
  lastDamagedAt: 'number',
  workoutPlacementId: 'string',
  deliveryQuestId: 'string',
  deliveryQuestStatus: 'string',
  deliveryQuestGiverNpcId: 'string',
  deliveryQuestTargetNpcId: 'string',
  deliveryQuestAcceptedAt: 'number',
  deliveryQuestCompletedAt: 'number',
  deliveryQuestRecentTargetNpcIds: 'string',
  deliveryQuestCompletionCount: 'number',
  gymPumpCompletedAt: 'number',
  stockBoughtAt: 'number',
  blackjackHandPlayedAt: 'number',
  strengthXp: 'number',
  agilityXp: 'number',
  intelligenceXp: 'number',
  skillAwardSeq: 'number',
  skillAwardSkillId: 'string',
  skillAwardXpGained: 'number',
  skillAwardOldLevel: 'number',
  skillAwardNewLevel: 'number',
  skillAwardAt: 'number',
  selectedMissionId: 'string',
  characterId: 'string',
  isAdmin: 'boolean'
});

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
  deliveryQuestEnabled: 'boolean',
  gymCheckInEnabled: 'boolean',
  rentCollectorEnabled: 'boolean',
  stockMarketEnabled: 'boolean',
  bartenderEnabled: 'boolean',
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
  return entries.slice(Math.max(0, entries.length - MAX_TRANSCRIPT_ENTRIES));
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
    aiming: Boolean(message.aiming)
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

function isSnapshotWeaponId(value = '') {
  return Object.values(WEAPON_IDS).includes(String(value ?? '').trim());
}

function sanitizeStockPortfolioSnapshot(portfolio = {}) {
  const output = {};
  if (!portfolio || typeof portfolio !== 'object' || Array.isArray(portfolio)) {
    return output;
  }

  for (const [symbol, quantity] of Object.entries(portfolio)) {
    const normalizedSymbol = String(symbol ?? '').trim().toUpperCase().slice(0, 12);
    const normalizedQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
    if (normalizedSymbol && normalizedQuantity > 0) {
      output[normalizedSymbol] = normalizedQuantity;
    }
  }

  return output;
}

function createPlayerSnapshotPayload(player, stockPortfolio = {}) {
  return {
    player: {
      x: player.x,
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
      strengthXp: player.strengthXp,
      agilityXp: player.agilityXp,
      intelligenceXp: player.intelligenceXp,
      skillAwardSeq: player.skillAwardSeq,
      skillAwardSkillId: player.skillAwardSkillId,
      skillAwardXpGained: player.skillAwardXpGained,
      skillAwardOldLevel: player.skillAwardOldLevel,
      skillAwardNewLevel: player.skillAwardNewLevel,
      skillAwardAt: player.skillAwardAt,
      selectedMissionId: player.selectedMissionId,
      characterId: player.characterId
    },
    stockPortfolio: sanitizeStockPortfolioSnapshot(stockPortfolio)
  };
}

function applyPlayerSnapshotPayload(player, snapshot = {}) {
  const saved = snapshot?.player;
  if (!player || !saved || typeof saved !== 'object') {
    return false;
  }

  const now = Date.now();
  player.x = quantizePosition(saved.x);
  player.z = quantizePosition(saved.z);
  player.rotationY = quantizeRotation(saved.rotationY);
  player.aimRotationY = quantizeRotation(saved.aimRotationY ?? saved.rotationY);
  player.aiming = false;
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
  player.strengthXp = sanitizeSnapshotNumber(saved.strengthXp, 0, { integer: true, min: 0 });
  player.agilityXp = sanitizeSnapshotNumber(saved.agilityXp, 0, { integer: true, min: 0 });
  player.intelligenceXp = sanitizeSnapshotNumber(saved.intelligenceXp, 0, { integer: true, min: 0 });
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
    this.adminKeys = parseAdminKeys(process.env.ADMIN_KEYS ?? process.env.ADMIN_KEY ?? '');
    this.chatEngine = new NpcChatEngine();
    this.worldState = new WorldState();
    this.worldPersistence = getWorldPersistence();
    this.npcDefinitions = new Map();
    this.npcRuntimeMeta = new Map();
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.sequence = 0;
    this.playerAliasSequence = 0;
    this.playerPositionMeta = new Map();
    this.pickupSequence = 0;
    this.stockMarket = createInitialStockMarketState(Date.now());
    this.stockPortfolios = new Map();
    this.playerSnapshots = getPlayerSnapshots();
    this.playerSnapshotIds = new Map();
    this.playerSnapshotSessions = new Map();
    this.dirtyPlayerSnapshots = new Set();
    this.playerSnapshotSavePromises = new Map();
    this.playerTransformCorrectionLogAt = new Map();
    this.blackjackSessions = new Map();
    this.npcRouteGraph = null;
    this.lastNpcSimulationAt = Date.now();
    this.npcDebugEnabled = isNpcDebugEnabled();
    this.lastNpcDebugBroadcastAt = 0;
    this.lastNpcDebugPayloadSignature = '';

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
      }));
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
      void this.handleRpc(client, message.requestId, () => this.handleStockMarketRequest(client, message));
    });

    this.onMessage('stock:trade', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleStockTradeRequest(client, message));
    });

    this.onMessage('bartender:buyDrink', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleBartenderPurchase(client, message));
    });

    this.onMessage('inventory:consumeItem', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleInventoryConsumeRequest(client, message));
    });

    this.onMessage('wallet:getSnapshot', (client, message) => {
      void this.handleRpc(client, message.requestId, () => this.handleWalletSnapshotRequest(client));
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

  async onJoin(client, options = {}) {
    const playerSnapshotId = normalizePlayerSnapshotId(options?.playerId);
    let playerSnapshot = null;
    if (playerSnapshotId) {
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
    const rentIntro = resolveRentIntroPlan(this.worldState.serializeLayout());
    const introSpawn = rentIntro?.spawn ?? null;
    const introStartedAt = rentIntro ? Date.now() : 0;
    const isAdmin = this.isAdminJoin(options);
    player.x = quantizePosition(introSpawn?.x ?? spawnX);
    player.z = quantizePosition(introSpawn?.z ?? spawnZ);
    player.rotationY = Number.isFinite(introSpawn?.rotationY) ? quantizeRotation(introSpawn.rotationY) : 0;
    player.aimRotationY = player.rotationY;
    player.aiming = false;
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
    player.strengthXp = 0;
    player.agilityXp = 0;
    player.intelligenceXp = 0;
    player.skillAwardSeq = 0;
    player.skillAwardSkillId = '';
    player.skillAwardXpGained = 0;
    player.skillAwardOldLevel = 1;
    player.skillAwardNewLevel = 1;
    player.skillAwardAt = 0;
    player.selectedMissionId = resolveSelectedMissionId(player);
    player.characterId = DEFAULT_PLAYABLE_CHARACTER_ID;
    player.isAdmin = isAdmin;
    const restoredPlayerSnapshot = applyPlayerSnapshotPayload(player, playerSnapshot);
    if (restoredPlayerSnapshot) {
      this.stockPortfolios.set(client.sessionId, sanitizeStockPortfolioSnapshot(playerSnapshot.stockPortfolio));
      player.selectedMissionId = resolveSelectedMissionId(player, player.selectedMissionId);
    }
    this.state.players.set(client.sessionId, player);
    this.syncConnectedPlayerCount({ includingSessionId: client.sessionId });
    this.playerPositionMeta.set(client.sessionId, {
      x: player.x,
      z: player.z,
      acceptedAt: Date.now(),
      lastPunchAt: 0,
      lastShotAt: 0,
      healthRegenCarryMs: 0,
      agilityDistanceCarry: 0
    });
    void this.savePlayerSnapshot(client.sessionId);
    this.playerAliasSequence += 1;
    this.playerAliases.set(client.sessionId, `Player ${this.playerAliasSequence}`);
    logServer('room', 'Client joined world room.', {
      roomId: this.roomId,
      sessionId: client.sessionId,
      isAdmin,
      playerSnapshotId,
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
  }

  isClientSessionConnected(sessionId = '') {
    return this.clients.some((client) => client.sessionId === sessionId);
  }

  syncConnectedPlayerCount({ excludingSessionId = '', includingSessionId = '' } = {}) {
    const connectedSessionIds = new Set(
      (Array.isArray(this.clients) ? this.clients : [])
        .map((connectedClient) => connectedClient.sessionId)
        .filter((sessionId) => sessionId && sessionId !== excludingSessionId)
    );
    if (includingSessionId && includingSessionId !== excludingSessionId) {
      connectedSessionIds.add(includingSessionId);
    }
    this.state.connectedPlayerCount = connectedSessionIds.size;
  }

  removePlayerSession(sessionId = '') {
    const playerSnapshotId = this.getPlayerSnapshotId(sessionId);
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
    this.playerSnapshotIds.delete(sessionId);
    this.dirtyPlayerSnapshots.delete(sessionId);
    this.playerSnapshotSavePromises.delete(sessionId);
  }

  getPlayerSnapshotId(sessionId = '') {
    return this.playerSnapshotIds.get(sessionId) ?? '';
  }

  queuePlayerSnapshotSave(sessionId = '') {
    if (!this.getPlayerSnapshotId(sessionId) || !this.state.players.has(sessionId)) {
      return;
    }

    this.dirtyPlayerSnapshots.add(sessionId);
  }

  async savePlayerSnapshot(sessionId = '') {
    const playerSnapshotId = this.getPlayerSnapshotId(sessionId);
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
        const snapshot = await this.playerSnapshots.save(
          playerSnapshotId,
          snapshotPayload
        );
        return snapshot;
      } catch (error) {
        this.dirtyPlayerSnapshots.add(sessionId);
        logServerError('room', 'Failed to save player snapshot.', error, {
          roomId: this.roomId,
          sessionId,
          playerSnapshotId
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
    const sessionIds = force
      ? [...this.state.players.keys()]
      : [...this.dirtyPlayerSnapshots];
    await Promise.all(sessionIds.map((sessionId) => this.savePlayerSnapshot(sessionId)));
  }

  isAdminJoin(options = {}) {
    const providedKey = typeof options.adminKey === 'string'
      ? options.adminKey.trim()
      : '';

    return Boolean(providedKey && this.adminKeys.size > 0 && this.adminKeys.has(providedKey));
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
      this.worldState.getPlacements(),
      getBuilderItemById
    );
    const nextSpawnIds = new Set(spawnDefinitions.map((spawn) => spawn.id));

    for (const [pickupId, pickup] of [...this.state.pickups.entries()]) {
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
    const livingPlayers = [...this.state.players.entries()]
      .filter(([sessionId, player]) => sessionId !== exceptSessionId && player.alive !== false)
      .map(([, player]) => ({ x: player.x, z: player.z }));
    return chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS, livingPlayers);
  }

  chooseHospitalRespawnPoint() {
    return getHospitalRespawnPoint(this.worldState.getPlacements(), getBuilderItemById);
  }

  getPlayerMeta(sessionId) {
    if (!this.playerPositionMeta.has(sessionId)) {
      const player = this.state.players.get(sessionId);
      this.playerPositionMeta.set(sessionId, {
        x: player?.x ?? 0,
        z: player?.z ?? 0,
        acceptedAt: Date.now(),
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
    const elapsedSeconds = Math.max((now - meta.acceptedAt) / 1000, 0.016);
    const maxDistance = PLAYER_POSITION_FORGIVENESS + (PLAYER_MAX_ACCEPTED_SPEED * elapsedSeconds);
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
        elapsedMs: Math.round(elapsedSeconds * 1000)
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
      return;
    }

    this.awardAgilityXpFromDistance(player, meta, travelled);
    player.x = quantizePosition(nextPosition.x);
    player.z = quantizePosition(nextPosition.z);
    meta.x = player.x;
    meta.z = player.z;
    meta.acceptedAt = now;

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

  normalizePlayerSelectedMission(player) {
    if (!player) {
      return '';
    }

    const nextMissionId = resolveSelectedMissionId(player, player.selectedMissionId);
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

    if (!isMissionSelectable(missionId, player)) {
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
    return distance2D(player.x, player.z, npc.x, npc.z) <= radius;
  }

  isPlayerInGymCheckInPurchaseRadius(player, npc) {
    if (!player || !npc || !isGymCheckInNpc(npc)) {
      return false;
    }

    return distance2D(player.x, player.z, npc.x, npc.z) <= getGymCheckInPromptRadius(npc);
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
    return this.worldState.getPlacements()
      .map((placement) => {
        const item = getBuilderItemById(placement?.itemId);
        if (!item || placement?.layer !== 'tile' || !this.isGymDoorPlacement(placement, item)) {
          return null;
        }

        const doorOffset = item.interior?.exteriorDoorOffset
          ?? placement.interactable?.interior?.exteriorDoorOffset
          ?? item.npcRouteDoorOffset
          ?? null;
        if (!Array.isArray(doorOffset) || doorOffset.length < 2) {
          return null;
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
        return {
          x: center.x + rotatedOffset.x,
          z: center.z + rotatedOffset.z,
          radius: GYM_DOOR_BLOCKER_RADIUS
        };
      })
      .filter(Boolean);
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
      if (distance2D(position.x, position.z, blocker.x, blocker.z) <= blocker.radius + PLAYER_RADIUS) {
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

    return this.stockPortfolios.get(sessionId);
  }

  getStockMarketNpcForPlayer(player, requestedNpcId = '') {
    const normalizedNpcId = typeof requestedNpcId === 'string'
      ? requestedNpcId.trim()
      : '';
    const candidates = normalizedNpcId
      ? [this.state.npcs.get(normalizedNpcId)].filter(Boolean)
      : [...this.state.npcs.values()];

    let nearest = null;
    let nearestDistance = Infinity;
    for (const npc of candidates) {
      if (
        !isStockMarketNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distance = distance2D(player.x, player.z, npc.x, npc.z);
      const radius = getStockMarketPromptRadius(npc);
      if (distance <= radius && distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
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
    const portfolio = this.getPlayerStockPortfolio(client.sessionId);
    return {
      market: serializeStockMarket(this.stockMarket, portfolio, player.money, Date.now()),
      money: player.money
    };
  }

  handleStockTradeRequest(client, message = {}) {
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

    const portfolio = this.getPlayerStockPortfolio(client.sessionId);
    return {
      wallet: serializeStockMarket(this.stockMarket, portfolio, player.money, Date.now()),
      money: player.money
    };
  }

  getBartenderNpcForPlayer(player, requestedNpcId = '') {
    const normalizedNpcId = typeof requestedNpcId === 'string'
      ? requestedNpcId.trim()
      : '';
    const candidates = normalizedNpcId
      ? [this.state.npcs.get(normalizedNpcId)].filter(Boolean)
      : [...this.state.npcs.values()];

    let nearest = null;
    let nearestDistance = Infinity;
    for (const npc of candidates) {
      if (
        !isBartenderNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distance = distance2D(player.x, player.z, npc.x, npc.z);
      const radius = getBartenderPromptRadius(npc);
      if (distance <= radius && distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
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

  handleInventoryConsumeRequest(client, message = {}) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.alive === false) {
      throw new Error('You cannot use that right now.');
    }

    const result = consumePlayerDrink(player, message?.itemId, Date.now());
    if (!result.ok) {
      throw new Error(result.error);
    }

    this.queuePlayerSnapshotSave(client.sessionId);
    return result;
  }

  getBlackjackDealerForPlayer(player, requestedNpcId = '') {
    const normalizedNpcId = typeof requestedNpcId === 'string'
      ? requestedNpcId.trim()
      : '';
    const candidates = normalizedNpcId
      ? [this.state.npcs.get(normalizedNpcId)].filter(Boolean)
      : [...this.state.npcs.values()];

    let nearest = null;
    let nearestDistance = Infinity;
    for (const npc of candidates) {
      if (
        !isBlackjackDealerNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distance = distance2D(player.x, player.z, npc.x, npc.z);
      const radius = getBlackjackPromptRadius(npc);
      if (distance <= radius && distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
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
    const normalizedNpcId = typeof requestedNpcId === 'string'
      ? requestedNpcId.trim()
      : '';
    const candidates = normalizedNpcId
      ? [this.state.npcs.get(normalizedNpcId)].filter(Boolean)
      : [...this.state.npcs.values()];

    let nearest = null;
    let nearestDistance = Infinity;
    for (const npc of candidates) {
      if (
        !isSchoolMicrogameNpc(npc)
        || npc.alive === false
        || npc.mode === NPC_RUNTIME_MODES.hidden
        || npc.mode === NPC_RUNTIME_MODES.dead
      ) {
        continue;
      }

      const distance = distance2D(player.x, player.z, npc.x, npc.z);
      const radius = getSchoolMicrogamePromptRadius(npc);
      if (distance <= radius && distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
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
    const rewardText = [
      reward.xp > 0 ? `+${reward.xp} Intelligence XP` : ''
    ].filter(Boolean).join('  ');
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
    const distance = Math.hypot(
      (Number(player.x) || 0) - stationX,
      playerY - stationY,
      (Number(player.z) || 0) - stationZ
    );

    if (distance > radius) {
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

    const candidates = normalizedPlacementId
      ? [this.worldState.getPlacement(normalizedPlacementId)].filter(Boolean)
      : this.worldState.getPlacements();

    let nearest = null;
    let nearestDistance = Infinity;
    for (const placement of candidates) {
      if (
        placement?.layer !== 'prop'
        || placement.itemId !== OFFICE_JOB_TERMINAL_ITEM_ID
        || !Array.isArray(placement.position)
      ) {
        continue;
      }

      const radius = Math.max(
        1.5,
        Number(placement.interactable?.radius ?? getBuilderItemById(placement.itemId)?.interactable?.radius ?? OFFICE_JOB_TERMINAL_RADIUS) || OFFICE_JOB_TERMINAL_RADIUS
      ) + 1.25;
      const distance = distance2D(player.x, player.z, placement.position[0], placement.position[1]);
      if (distance <= radius && distance < nearestDistance) {
        nearest = placement;
        nearestDistance = distance;
      }
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
      throw new Error('Move closer to the office computer.');
    }

    return { player, terminal };
  }

  handleOfficeJobComplete(client, message = {}) {
    const job = getOfficeJobDefinition(message?.jobId);
    if (!job) {
      throw new Error('That office job is not available.');
    }
    const { player, terminal } = this.assertOfficeJobAccess(client, message, job.id);

    const intelligence = getPlayerSkillXp(player, SKILL_IDS.intelligence);
    if (!canPlayerWorkOfficeJob(intelligence, job)) {
      throw new Error(`${job.roleLabel} requires ${job.intelligenceRequired} Intelligence.`);
    }

    const reward = getOfficeJobReward(job.id);
    const moneyAwarded = Math.max(0, Math.trunc(Number(reward.money ?? 0) || 0));
    player.money = Math.trunc(Number(player.money ?? 0) || 0) + moneyAwarded;
    const skillAward = reward.xp > 0
      ? this.awardPlayerSkillXp(player, reward.skill, reward.xp)
      : null;
    const rewardText = [
      moneyAwarded > 0 ? `+$${moneyAwarded}` : '',
      reward.xp > 0 ? `+${reward.xp} Intelligence XP` : ''
    ].filter(Boolean).join('  ');
    return {
      ok: true,
      jobId: job.id,
      gameId: job.gameId,
      placementId: terminal.id,
      money: player.money,
      moneyAwarded,
      xp: reward.xp,
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

    let skillAward = null;
    if (target.workoutType === 'snatch') {
      player.gymPumpCompletedAt = Date.now();
      skillAward = this.awardPlayerSkillXp(player, SKILL_IDS.strength, STRENGTH_SNATCH_XP);
      this.normalizePlayerSelectedMission(player);
    }
    player.workoutPlacementId = '';
    return {
      placementId,
      gymPumpCompletedAt: player.gymPumpCompletedAt,
      skillAward
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

    for (const [sessionId, player] of this.state.players.entries()) {
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

    for (const pickup of [...this.state.pickups.values()]) {
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
    player.z = quantizePosition(spawn.z);
    player.rotationY = quantizeRotation(spawn.rotationY);
    player.aimRotationY = player.rotationY;
    player.aiming = false;
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
    if (distance2D(meta.x, meta.z, pickup.x, pickup.z) > PICKUP_INTERACT_RADIUS) {
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
    const offsetLength = Math.hypot(offsetX, offsetZ);
    if (offsetLength > SHOT_ORIGIN_MAX_OFFSET && offsetLength > 0.0001) {
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

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, maxDistance, rect);
        if (
          hitDistance == null
          || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, SHOT_WORLD_BLOCKER_GRACE_DISTANCE)
          || hitDistance >= nearestDistance
        ) {
          continue;
        }

        nearestDistance = hitDistance;
        result = {
          kind: 'world',
          hitX: origin.x + aim.x * hitDistance,
          hitZ: origin.z + aim.z * hitDistance,
          targetId: placement.id
        };
      }
    }

    for (const [sessionId, target] of this.state.players.entries()) {
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

    for (const [npcId, target] of this.state.npcs.entries()) {
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

    for (const placement of this.worldState.getPlacements()) {
      const item = getBuilderItemById(placement.itemId);
      const rects = placementToCollisionRects(placement, item, {
        collisionKey: 'blocksShots'
      });
      for (const rect of rects) {
        const hitDistance = rayRectIntersectionDistance(origin.x, origin.z, aim.x, aim.z, maxDistance, rect);
        if (
          hitDistance == null
          || hitDistance <= Math.max(SHOT_BLOCKER_EPSILON, PUNCH_WORLD_BLOCKER_GRACE_DISTANCE)
          || hitDistance >= nearestDistance
        ) {
          continue;
        }

        nearestDistance = hitDistance;
        result = {
          kind: 'world',
          hitX: origin.x + aim.x * hitDistance,
          hitZ: origin.z + aim.z * hitDistance,
          targetId: placement.id
        };
      }
    }

    for (const [sessionId, target] of this.state.players.entries()) {
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

    for (const [npcId, target] of this.state.npcs.entries()) {
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

  async handleRpc(client, requestId, handler) {
    try {
      const payload = await Promise.resolve().then(() => handler());
      client.send('rpc:response', {
        requestId,
        ok: true,
        ...payload
      });
      void this.savePlayerSnapshot(client.sessionId);
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
          next.interactable
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
        const previousNpc = structuredClone(placement.npc);
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

    return {
      active: true,
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns: normalizeRotationQuarterTurns(message.rotationQuarterTurns),
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
        speed: message.speed,
        respawnDelayMs: message.respawnDelayMs,
        deliveryQuestEnabled: message.deliveryQuestEnabled === true,
        gymCheckInEnabled: Object.hasOwn(message, 'gymCheckInEnabled')
          ? message.gymCheckInEnabled === true
          : model.id === 'remy',
        rentCollectorEnabled: message.rentCollectorEnabled === true,
        stockMarketEnabled: message.stockMarketEnabled === true,
        bartenderEnabled: message.bartenderEnabled === true,
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

    if (Object.hasOwn(message, 'name')) {
      updates.name = String(message.name ?? 'NPC').trim().slice(0, NPC_NAME_MAX_LENGTH) || 'NPC';
    }
    if (Object.hasOwn(message, 'prompt')) {
      updates.prompt = String(message.prompt ?? '').slice(0, NPC_PROMPT_MAX_LENGTH);
    }
    if (Object.hasOwn(message, 'interactRadius')) {
      updates.interactRadius = clampNpcRadius(message.interactRadius);
    }
    if (Object.hasOwn(message, 'respawnDelayMs')) {
      updates.respawnDelayMs = normalizeNpcBehavior({ respawnDelayMs: message.respawnDelayMs }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).respawnDelayMs;
    }
    if (Object.hasOwn(message, 'speed')) {
      updates.speed = normalizeNpcBehavior({ speed: message.speed }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).speed;
    }
    if (Object.hasOwn(message, 'deliveryQuestEnabled')) {
      updates.deliveryQuestEnabled = message.deliveryQuestEnabled === true;
    }
    if (Object.hasOwn(message, 'gymCheckInEnabled')) {
      updates.gymCheckInEnabled = message.gymCheckInEnabled === true;
    }
    if (Object.hasOwn(message, 'rentCollectorEnabled')) {
      updates.rentCollectorEnabled = message.rentCollectorEnabled === true;
    }
    if (Object.hasOwn(message, 'stockMarketEnabled')) {
      updates.stockMarketEnabled = message.stockMarketEnabled === true;
    }
    if (Object.hasOwn(message, 'bartenderEnabled')) {
      updates.bartenderEnabled = message.bartenderEnabled === true;
    }
    if (Object.hasOwn(message, 'blackjackDealerEnabled')) {
      updates.blackjackDealerEnabled = message.blackjackDealerEnabled === true;
    }
    if (Object.hasOwn(message, 'schoolMicrogameEnabled')) {
      updates.schoolMicrogameEnabled = message.schoolMicrogameEnabled === true;
    }
    if (Object.hasOwn(message, 'schoolMicrogameId')) {
      updates.schoolMicrogameId = normalizeSchoolMicrogameId(message.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
    }
    if (Object.hasOwn(message, 'routine')) {
      updates.routine = normalizeNpcBehavior({ routine: message.routine }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).routine;
    }
    if (Object.hasOwn(message, 'combat')) {
      updates.combat = normalizeNpcBehavior({ combat: message.combat }, {
        position: [0, 0],
        rotationQuarterTurns: 0
      }).combat;
    }
    if (Object.hasOwn(message, 'modelId')) {
      const model = getNpcModelById(message.modelId);
      if (!model) {
        throw new Error('That NPC model is not available.');
      }
      updates.modelId = model.id;
      updates.itemId = model.itemId;
    }

    if (!Object.keys(updates).length) {
      throw new Error('No NPC changes were provided.');
    }

    return updates;
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
    const definitions = this.worldState.serializeLayout().npcs ?? [];
    const nextIds = new Set(definitions.map((entry) => entry.id));

    for (const definition of definitions) {
      const normalizedDefinition = normalizeNpcBehavior(structuredClone(definition), {
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
      existing.deliveryQuestEnabled = normalizedDefinition.deliveryQuestEnabled === true;
      existing.gymCheckInEnabled = normalizedDefinition.gymCheckInEnabled === true;
      existing.rentCollectorEnabled = normalizedDefinition.rentCollectorEnabled === true;
      existing.stockMarketEnabled = normalizedDefinition.stockMarketEnabled === true;
      existing.bartenderEnabled = normalizedDefinition.bartenderEnabled === true;
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
    }

    for (const npcId of [...this.state.npcs.keys()]) {
      if (nextIds.has(npcId)) {
        continue;
      }

      this.state.npcs.delete(npcId);
      this.npcDefinitions.delete(npcId);
      this.npcRuntimeMeta.delete(npcId);
      this.transcripts.delete(npcId);
      for (const cooldownKey of [...this.cooldowns.keys()]) {
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

    for (const [npcId, npc] of this.state.npcs.entries()) {
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
    const next = trimTranscript([...current, entry]);
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
    let nearestDistance = Infinity;

    for (const npc of this.state.npcs.values()) {
      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.hidden || npc.mode === NPC_RUNTIME_MODES.dead) {
        continue;
      }
      if (isGymCheckInNpc(npc) && player.gymMembershipActive !== true) {
        continue;
      }

      const distance = distance2D(npc.x, npc.z, player.x, player.z);
      if (distance > npc.interactRadius || distance >= nearestDistance) {
        continue;
      }

      nearestNpc = npc;
      nearestDistance = distance;
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
