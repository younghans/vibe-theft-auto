import {
  COMBAT_RESPAWN_POINTS,
  DROPPED_PICKUP_DESPAWN_MS,
  HIT_REACTION_HEAD,
  PICKUP_INTERACT_RADIUS,
  PUNCH_COMBO_MIN_INTERVAL_MS,
  PUNCH_DAMAGE,
  PUNCH_HITBOX_RADIUS,
  PUNCH_HIT_DELAY_MS,
  PUNCH_HIT_ORIGIN_FORWARD_OFFSET,
  PUNCH_HIT_REACTIONS,
  PUNCH_INTERVAL_MS,
  PUNCH_RANGE,
  PUNCH_TARGET_ASSIST_MAX_ANGLE_RAD,
  PUNCH_TARGET_ASSIST_RANGE_BONUS,
  PICKUP_RESPAWN_MS,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_MS,
  WEAPON_CLIP_SIZE,
  WEAPON_DAMAGE,
  WEAPON_FIRE_INTERVAL_MS,
  WEAPON_IDS,
  WEAPON_RANGE,
  WEAPON_RELOAD_MS
} from '../shared/combatConstants.js';
import {
  PLAYER_RESPAWN_COST,
  findDrJoeRespawnNpc,
  getRandomDrJoeRespawnLine,
  getHospitalRespawnPoint
} from '../shared/respawnRules.js';
import { getCombatPickupSpawnDefinitions } from '../shared/combatPickupDefinitions.js';
import {
  applyWeaponPickupToPlayerState,
  canEquipInventoryWeapon,
  normalizeEquippableWeaponId
} from '../shared/combatInventoryRules.js';
import { tickHealthRegen } from '../shared/combatRegen.js';
import { hasInventoryWeapon } from '../shared/weaponInventory.js';
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
} from '../shared/deliveryQuest.js';
import {
  GYM_CHECK_IN_PURCHASED_LINE,
  GYM_DOOR_BLOCKER_RADIUS,
  GYM_MEMBERSHIP_COST,
  getGymCheckInPromptRadius,
  isGymCheckInNpc
} from '../shared/gymMembership.js';
import {
  createInitialStockMarketState,
  executeStockTrade,
  getStockMarketPromptRadius,
  hasStockPortfolioSnapshotEntries,
  isStockMarketNpc,
  normalizeStockMarketSnapshot,
  normalizeStockPortfolioSnapshot,
  serializeStockMarket
} from '../shared/stockMarket.js';
import {
  addPlayerDrink,
  clearPlayerDrunkness,
  consumePlayerDrink,
  getBartenderMenuItem,
  getBartenderPromptRadius,
  getPlayerDrinkInventorySnapshot,
  isBartenderNpc,
  refreshPlayerDrunkness
} from '../shared/bartender.js';
import {
  PAWN_SHOP_ITEM_IDS,
  addPlayerPawnShopItem,
  consumePlayerPawnShopItem,
  getPawnShopMenuItem,
  getPawnShopPromptRadius,
  getPlayerPawnShopInventorySnapshot,
  isPlayerPawnShopItemOwned,
  isPawnShopOwnerNpc
} from '../shared/pawnShop.js';
import {
  getCarDealerMenuItem,
  getCarDealerPromptRadius,
  getPlayerVehicleInventorySnapshot,
  isCarDealerNpc,
  isPlayerVehicleOwner,
  playerOwnsVehicleItem,
  selectPlayerVehicleItem,
  setPlayerVehicleItem
} from '../shared/carDealer.js';
import { SKATEBOARD_ITEM_ID, isPlayerSkateboardOwner } from '../shared/skateboard.js';
import {
  addPlayerMarthaItem,
  consumePlayerMarthaItem,
  getMarthaMenuItem,
  getMarthaPromptRadius,
  getPlayerMarthaInventorySnapshot,
  isMarthaNpc
} from '../shared/martha.js';
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
} from '../shared/blackjack.js';
import {
  SCHOOL_MICROGAME_ALL_ID,
  getSchoolMicrogamePromptRadius,
  getSchoolMicrogameReward,
  isSchoolMicrogameNpc,
  normalizeSchoolMicrogameId
} from '../shared/schoolMicrogames.js';
import {
  OFFICE_JOB_IDS,
  OFFICE_JOB_TERMINAL_ITEM_ID,
  OFFICE_JOB_TERMINAL_RADIUS,
  canPlayerWorkOfficeJob,
  getOfficeJobDefinition,
  getOfficeJobLockedMessage,
  getPlayerOfficeJobIntelligenceLevel,
  getOfficeJobReward
} from '../shared/officeJobs.js';
import {
  OFFICE_BUILDING_ITEM_ID,
  OFFICE_INTERIOR_STATION_TYPES,
  getOfficeInteriorFloorHeight,
  getOfficeInteriorStationDefinition,
  parseOfficeInteriorStationPlacementId
} from '../shared/officeInteriorLayout.js';
import { getTileCenterWorldPosition, rotateFootprintOffset } from '../shared/tileFootprint.js';
import { resolveRentIntroPlan } from '../shared/rentIntro.js';
import {
  MISSION_IDS,
  isMissionSelectable,
  normalizeMissionId,
  resolveSelectedMissionId
} from '../shared/missions.js';
import { normalizeNpcVoice } from '../shared/npcVoice.js';
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
} from '../shared/skills.js';
import { normalizeVibeHeroSongId } from '../shared/vibeHero.js';
import {
  cloneNpcBehavior,
  NPC_DEFAULT_CALM_MS,
  NPC_DEFAULT_MAX_HEALTH,
  NPC_RUNTIME_MODES,
  normalizeNpcBehavior,
  shouldResetNpcRuntimeForBehaviorUpdate
} from './npcBehavior.js';
import { PUNCH_EMOTE_ID, PUNCH_HOOK_EMOTE_ID, PUNCH_UPPERCUT_EMOTE_ID, STAND_UP_EMOTE_ID } from '../player/emotes.js';
import { createNpcRuntimeMeta, npcSimulationMethods } from './npcSimulationMethods.js';
import { DEFAULT_PLAYABLE_CHARACTER_ID, getPlayableCharacterById } from '../player/playableCharacterCatalog.js';
import {
  chooseFarthestSpawnPoint,
  chooseAimAssistTarget,
  capsuleCircleIntersection,
  clampToWorldBounds,
  distance2D,
  distanceSquared2D,
  normalizeAimVector,
  rayCircleIntersectionDistance,
  rayRectIntersectionDistance
} from '../shared/combatMath.js';
import {
  PUNCH_COMBO_HOOK_STEP,
  PUNCH_COMBO_UPPERCUT_STEP,
  getPunchComboDamage,
  getPunchComboHitDelayMs,
  isPunchUppercutComboStep,
  normalizePunchComboStep,
  resolvePunchComboStep
} from '../shared/punchCombo.js';
import {
  quantizePosition,
  quantizeRotation,
  rotationQuarterTurnsToRadians as toRotationY,
  rotationRadiansToQuarterTurns as quantizeRotationQuarterTurnsFromRotationY
} from '../shared/numberMath.js';
import {
  getDefaultPropPlacementScale,
  normalizePropPlacementScale
} from '../shared/placementScale.js';
import { getNpcModelById } from './npcCatalog.js';
import { buildNpcRouteGraph } from './npcRouteGraph.js';
import {
  getPlacementApproachPoint,
  getPlacementWorldOrigin
} from './npcTargeting.js';
import { WorldState } from '../world/WorldState.js';
import { defaultWorldLayout } from '../world/defaultWorldLayout.js';
import { getBuilderItemById } from '../world/builderCatalog.js';
import { PassiveTrafficSimulation } from '../world/passiveTrafficSimulation.js';
import {
  PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID,
  rayPassiveTrafficHitboxIntersectionDistance
} from '../world/passiveTraffic.js';
import {
  POLICE_CAR_RESPONSE_DEAD_DESPAWN_MS,
  createPoliceCarResponseNpcDefinition,
  createPoliceCarResponseNpcId,
  createPoliceCarResponseNpcPlacement,
  getPoliceCarResponseOfficerSpawnSpecs
} from './policeCarResponse.js';

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
const MOCK_STOCK_MARKET_STORAGE_KEY = 'vta.mockStockMarket';
const MOCK_STOCK_PORTFOLIOS_STORAGE_KEY = 'vta.mockStockPortfolios';

function getRandomPunchHitReaction(comboStep = 1) {
  if (isPunchUppercutComboStep(comboStep)) {
    return HIT_REACTION_HEAD;
  }
  return PUNCH_HIT_REACTIONS[Math.floor(Math.random() * PUNCH_HIT_REACTIONS.length)] ?? '';
}

function getPunchComboEmoteId(comboStep = 1) {
  const normalizedStep = normalizePunchComboStep(comboStep);
  if (normalizedStep === PUNCH_COMBO_UPPERCUT_STEP) {
    return PUNCH_UPPERCUT_EMOTE_ID;
  }
  if (normalizedStep === PUNCH_COMBO_HOOK_STEP) {
    return PUNCH_HOOK_EMOTE_ID;
  }
  return PUNCH_EMOTE_ID;
}

function makeTranscriptEntry(id, speaker, author, text) {
  return {
    id,
    speaker,
    author,
    text,
    createdAt: Date.now()
  };
}

function clampTranscript(transcript, limit = 16) {
  const clamped = [];
  const startIndex = Math.max(0, transcript.length - limit);
  for (let index = startIndex; index < transcript.length; index += 1) {
    clamped.push(transcript[index]);
  }
  return clamped;
}

function buildMockNpcReply(definition = {}) {
  const name = String(definition.name ?? '').toLowerCase();

  if (definition.pawnShopOwnerEnabled) {
    return 'Pistol $50, smokes $20, board $200. Cash first.';
  }
  if (definition.carDealerEnabled) {
    return 'Toyota AE86 $10000, Fiat Duna $5000. Cash first.';
  }
  if (definition.marthaEnabled) {
    return 'Burger $20, glizzy $10, soda $10. Eat up.';
  }
  if (definition.blackjackDealerEnabled) {
    return 'Blackjack: hit, stand, double, split. Do not bust.';
  }
  if (definition.schoolMicrogameEnabled) {
    return 'School challenge ready. Focus.';
  }
  if (definition.policeOfficerEnabled) {
    return 'Keep it clean inside the law circle.';
  }
  if (definition.deliveryQuestEnabled) {
    return 'Package and payout. Quiet.';
  }
  if (definition.gymCheckInEnabled || name.includes('bruno')) {
    return 'Barbell first. Keep your form tight.';
  }
  return 'Head up. Pockets close.';
}

function cloneLayout(layout) {
  return structuredClone(layout);
}

function sanitizePlayerAnimationState(animationState = {}, target = {}) {
  const emoteId = typeof animationState.emoteId === 'string' ? animationState.emoteId : '';
  const aimRotationY = Number(animationState.aimRotationY);
  const output = target && typeof target === 'object' ? target : {};

  output.emoteId = emoteId;
  output.emoteActive = Boolean(animationState.emoteActive && emoteId);
  output.emoteStartedAt = Number.isFinite(animationState.emoteStartedAt) ? Math.max(0, Math.floor(animationState.emoteStartedAt)) : 0;
  output.emoteSeq = Number.isFinite(animationState.emoteSeq) ? Math.max(0, Math.floor(animationState.emoteSeq)) : 0;
  output.aimRotationY = Number.isFinite(aimRotationY) ? aimRotationY : 0;
  output.aiming = Boolean(animationState.aiming);
  output.skating = Boolean(animationState.skating);
  return output;
}

function getMockStockPortfoliosStorageKey(playerId = 'local-player') {
  const normalizedPlayerId = typeof playerId === 'string' && playerId.trim()
    ? playerId.trim()
    : 'local-player';
  return `${MOCK_STOCK_PORTFOLIOS_STORAGE_KEY}:${normalizedPlayerId}`;
}

function normalizeMockCharacterStockPortfolios(stockPortfolios = {}) {
  const output = {};
  if (!stockPortfolios || typeof stockPortfolios !== 'object' || Array.isArray(stockPortfolios)) {
    return output;
  }

  for (const characterId in stockPortfolios) {
    if (!Object.hasOwn(stockPortfolios, characterId)) {
      continue;
    }
    const normalizedCharacterId = getPlayableCharacterById(characterId).id;
    const normalizedPortfolio = normalizeStockPortfolioSnapshot(stockPortfolios[characterId]);
    if (hasStockPortfolioSnapshotEntries(normalizedPortfolio)) {
      output[normalizedCharacterId] = normalizedPortfolio;
    }
  }

  return output;
}

function readMockStockPortfolios(playerId = 'local-player') {
  try {
    const raw = window.localStorage?.getItem(getMockStockPortfoliosStorageKey(playerId));
    return normalizeMockCharacterStockPortfolios(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

function writeMockStockPortfolios(playerId = 'local-player', stockPortfolios = {}) {
  try {
    window.localStorage?.setItem(
      getMockStockPortfoliosStorageKey(playerId),
      JSON.stringify(normalizeMockCharacterStockPortfolios(stockPortfolios))
    );
  } catch {
    // Local mock persistence is best-effort.
  }
}

function readMockStockMarket() {
  try {
    const raw = window.localStorage?.getItem(MOCK_STOCK_MARKET_STORAGE_KEY);
    return normalizeStockMarketSnapshot(raw ? JSON.parse(raw) : null, Date.now());
  } catch {
    return null;
  }
}

function writeMockStockMarket(stockMarket = null) {
  try {
    const normalized = normalizeStockMarketSnapshot(stockMarket, Date.now());
    if (!normalized) {
      return;
    }
    window.localStorage?.setItem(MOCK_STOCK_MARKET_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Local mock persistence is best-effort.
  }
}

function createDefaultPlayerState(overrides = {}) {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
    aimRotationY: 0,
    aiming: false,
    skating: false,
    transformSeq: 0,
    emoteId: '',
    emoteActive: false,
    emoteStartedAt: 0,
    emoteSeq: 0,
    chatText: '',
    chatStartedAt: 0,
    chatSeq: 0,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    alive: true,
    respawnAt: 0,
    spawnProtectedUntil: 0,
    equippedWeaponId: '',
    ownedWeaponIds: '',
    ammoInClip: 0,
    reserveAmmo: 0,
    isReloading: false,
    reloadEndsAt: 0,
    kills: 0,
    deaths: 0,
    money: 0,
    beerCount: 0,
    shotCount: 0,
    cigaretteCount: 0,
    burgerCount: 0,
    glizzyCount: 0,
    sodaCount: 0,
    skateboardOwned: false,
    vehicleItemId: '',
    ownedVehicleItemIds: '',
    drunknessDose: 0,
    drunknessLevel: 0,
    drunknessEndsAt: 0,
    gymMembershipActive: false,
    rentIntroSeq: 0,
    rentIntroAmount: 0,
    rentIntroNpcId: '',
    rentIntroBuildingPlacementId: '',
    rentIntroStartedAt: 0,
    lastDamagedAt: 0,
    workoutPlacementId: '',
    deliveryQuestId: '',
    deliveryQuestStatus: DELIVERY_QUEST_STATUS.inactive,
    deliveryQuestGiverNpcId: '',
    deliveryQuestTargetNpcId: '',
    deliveryQuestAcceptedAt: 0,
    deliveryQuestCompletedAt: 0,
    deliveryQuestRecentTargetNpcIds: '',
    deliveryQuestCompletionCount: 0,
    gymPumpCompletedAt: 0,
    stockBoughtAt: 0,
    blackjackHandPlayedAt: 0,
    schoolTasksCompletedCount: 0,
    janitorTasksCompletedCount: 0,
    officeManagerCompletedAt: 0,
    ceoCompletedAt: 0,
    strengthXp: 0,
    agilityXp: 0,
    intelligenceXp: 0,
    charismaXp: 0,
    skillAwardSeq: 0,
    skillAwardSkillId: '',
    skillAwardXpGained: 0,
    skillAwardOldLevel: 1,
    skillAwardNewLevel: 1,
    skillAwardAt: 0,
    selectedMissionId: MISSION_IDS.makeMoney,
    lastPunchAt: 0,
    lastPunchComboStep: 0,
    lastShotAt: 0,
    characterId: DEFAULT_PLAYABLE_CHARACTER_ID,
    isAdmin: false,
    ...overrides
  };
}

function clonePlayerState(player) {
  return clonePlainObject(player);
}

function clonePickupState(pickup) {
  return clonePlainObject(pickup);
}

function clonePlainObject(source = null) {
  const clone = {};
  if (!source || typeof source !== 'object') {
    return clone;
  }

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      clone[key] = source[key];
    }
  }
  return clone;
}

function cloneNpcDebugState(debug = {}) {
  const path = [];
  if (Array.isArray(debug.path)) {
    for (const point of debug.path) {
      path.push(clonePlainObject(point));
    }
  }

  return {
    id: debug.id || '',
    mode: debug.mode || '',
    activity: debug.activity || '',
    currentStepIndex: debug.currentStepIndex ?? 0,
    currentStepType: debug.currentStepType || '',
    stepCount: debug.stepCount ?? 0,
    targetPlacementId: debug.targetPlacementId || '',
    targetApproach: debug.targetApproach ? clonePlainObject(debug.targetApproach) : null,
    nextPathPoint: debug.nextPathPoint ? clonePlainObject(debug.nextPathPoint) : null,
    steeringTarget: debug.steeringTarget ? clonePlainObject(debug.steeringTarget) : null,
    finalTarget: debug.finalTarget ? clonePlainObject(debug.finalTarget) : null,
    path,
    pathIndex: debug.pathIndex ?? 0,
    pathNodeCount: debug.pathNodeCount ?? 0,
    pathKey: debug.pathKey || '',
    lastRepathAt: debug.lastRepathAt ?? 0,
    idleUntil: debug.idleUntil ?? 0,
    calmEndsAt: debug.calmEndsAt ?? 0,
    hiddenUntil: debug.hiddenUntil ?? 0,
    respawnAt: debug.respawnAt ?? 0,
    wanderPoint: debug.wanderPoint ? clonePlainObject(debug.wanderPoint) : null,
    stepStartedAt: debug.stepStartedAt ?? 0,
    busy: Boolean(debug.busy),
    alive: debug.alive !== false,
    weaponId: debug.weaponId || '',
    lastAttackerId: debug.lastAttackerId || '',
    debugAgeMs: debug.debugAgeMs ?? 0,
    idleRemainingMs: debug.idleRemainingMs ?? 0,
    calmRemainingMs: debug.calmRemainingMs ?? 0,
    hiddenRemainingMs: debug.hiddenRemainingMs ?? 0,
    respawnRemainingMs: debug.respawnRemainingMs ?? 0
  };
}

export class NpcServiceMock {
  constructor({ playerId = '', displayName = '' } = {}) {
    console.info('[NPC] Mock NPC service initialized.');
    this.listeners = new Set();
    this.worldPatchListeners = new Set();
    this.combatListeners = new Set();
    this.definitions = new Map();
    this.npcRuntimeMeta = new Map();
    this.policeCarResponseNpcs = new Map();
    this.policeCarResponseSequence = 0;
    this.transcripts = new Map();
    this.playerAliases = new Map();
    this.cooldowns = new Map();
    this.worldState = new WorldState();
    this.worldState.loadLayout(defaultWorldLayout);
    this.state = {
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
    this.stockMarket = readMockStockMarket() ?? createInitialStockMarketState(Date.now());
    this.stockPortfolios = new Map();
    this.blackjackSessions = new Map();
    this.sequence = 0;
    this.lastTransformSeq = 0;
    this.nextAnimationState = {};
    this.pickupSequence = 0;
    this.playerAliasSequence = 0;
    this.npcRouteGraph = null;
    this.lastNpcSimulationAt = Date.now();
    this.passiveTrafficSimulation = new PassiveTrafficSimulation();
    this.lastPassiveTrafficSimulationAt = Date.now();
    this.gymDoorBlockers = [];
    this.gymDoorBlockersRevision = -1;
    this.playerId = typeof playerId === 'string' && playerId.trim() ? playerId.trim() : 'local-player';
    this.displayName = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : '';
    this.stockPortfolios.set(this.state.sessionId, readMockStockPortfolios(this.playerId));
    this.playerRuntimeMeta = new Map();
    this.playerAliasSequence += 1;
    this.playerAliases.set(this.state.sessionId, this.displayName || `Player ${this.playerAliasSequence}`);
    const [spawnX, spawnZ] = chooseFarthestSpawnPoint(COMBAT_RESPAWN_POINTS);
    const rentIntro = resolveRentIntroPlan(this.worldState);
    const introStartedAt = rentIntro ? Date.now() : 0;
    const introSpawn = rentIntro?.spawn ?? null;
    this.state.players.set(this.state.sessionId, createDefaultPlayerState({
      isAdmin: false,
      x: introSpawn?.x ?? spawnX,
      z: introSpawn?.z ?? spawnZ,
      rotationY: introSpawn?.rotationY ?? 0,
      aimRotationY: introSpawn?.rotationY ?? 0,
      money: rentIntro ? -Math.abs(Math.round(rentIntro.amount)) : 0,
      rentIntroSeq: introStartedAt,
      rentIntroAmount: rentIntro ? Math.abs(Math.round(rentIntro.amount)) : 0,
      rentIntroNpcId: rentIntro?.collectorNpcId ?? '',
      rentIntroBuildingPlacementId: rentIntro?.buildingPlacementId ?? '',
      rentIntroStartedAt: introStartedAt
    }));
    this.playerRuntimeMeta.set(this.state.sessionId, {
      healthRegenCarryMs: 0,
      agilityDistanceCarry: 0
    });
    this.seedCombatPickups();
    this.syncNpcStateFromWorld();
    this.resetPassiveTrafficSimulation();
    this.combatTick = window.setInterval(() => {
      this.updateCombatTimers();
    }, 100);
    this.passiveTrafficTick = window.setInterval(() => {
      this.updatePassiveTrafficSimulation();
    }, 50);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  subscribeWorldPatches(listener) {
    this.worldPatchListeners.add(listener);
    return () => this.worldPatchListeners.delete(listener);
  }

  subscribeCombatEvents(listener) {
    this.combatListeners.add(listener);
    return () => this.combatListeners.delete(listener);
  }

  getState() {
    const players = new Map();
    for (const id of this.state.players.keys()) {
      const player = this.state.players.get(id);
      players.set(id, clonePlayerState(player));
    }

    const builders = new Map();
    for (const id of this.state.builders.keys()) {
      const builder = this.state.builders.get(id);
      builders.set(id, clonePlainObject(builder));
    }

    const npcs = new Map();
    for (const id of this.state.npcs.keys()) {
      const npc = this.state.npcs.get(id);
      const clonedNpc = clonePlainObject(npc);
      clonedNpc.position = [npc.x, npc.z];
      npcs.set(id, clonedNpc);
    }

    const npcDebug = new Map();
    const debugNow = Date.now();
    for (const id of this.state.npcs.keys()) {
      const npc = this.state.npcs.get(id);
      const definition = this.getNpcDefinition(id);
      if (!definition) {
        continue;
      }
      npcDebug.set(id, cloneNpcDebugState(this.buildNpcDebugSnapshotEntry(id, npc, definition, debugNow)));
    }

    const pickups = new Map();
    for (const id of this.state.pickups.keys()) {
      const pickup = this.state.pickups.get(id);
      pickups.set(id, clonePickupState(pickup));
    }

    const passiveTraffic = new Map();
    for (const id of this.state.passiveTraffic.keys()) {
      const car = this.state.passiveTraffic.get(id);
      passiveTraffic.set(id, clonePlainObject(car));
    }

    const snapshot = clonePlainObject(this.state);
    snapshot.players = players;
    snapshot.builders = builders;
    snapshot.npcs = npcs;
    snapshot.npcDebug = npcDebug;
    snapshot.pickups = pickups;
    snapshot.passiveTraffic = passiveTraffic;
    return snapshot;
  }

  emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  emitWorldPatch(patch) {
    const snapshot = structuredClone(patch);
    for (const listener of this.worldPatchListeners) {
      listener(snapshot);
    }
  }

  emitCombatEvent(event) {
    const snapshot = structuredClone(event);
    for (const listener of this.combatListeners) {
      listener(snapshot);
    }
  }

  getPlayerRuntimeMeta(sessionId = this.state.sessionId) {
    if (!this.playerRuntimeMeta.has(sessionId)) {
      this.playerRuntimeMeta.set(sessionId, {
        healthRegenCarryMs: 0,
        agilityDistanceCarry: 0
      });
    }

    return this.playerRuntimeMeta.get(sessionId);
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
    let changed = false;

    for (const pickupId of this.state.pickups.keys()) {
      const pickup = this.state.pickups.get(pickupId);
      if (pickup.kind === 'spawn' && (reset || !nextSpawnIds.has(pickupId))) {
        this.state.pickups.delete(pickupId);
        changed = true;
      }
    }

    for (const spawn of spawnDefinitions) {
      const existing = reset ? null : this.state.pickups.get(spawn.id);
      const nextPickup = {
        id: spawn.id,
        weaponId: spawn.weaponId,
        x: spawn.position[0],
        z: spawn.position[1],
        ammoInClip: spawn.ammoInClip,
        reserveAmmo: spawn.reserveAmmo,
        kind: 'spawn',
        active: true,
        respawnAt: 0,
        despawnAt: 0
      };

      if (!existing || existing.kind !== 'spawn') {
        this.state.pickups.set(spawn.id, nextPickup);
        changed = true;
        continue;
      }

      if (
        existing.weaponId !== nextPickup.weaponId
        || existing.x !== nextPickup.x
        || existing.z !== nextPickup.z
        || existing.ammoInClip !== nextPickup.ammoInClip
        || existing.reserveAmmo !== nextPickup.reserveAmmo
      ) {
        existing.weaponId = nextPickup.weaponId;
        existing.x = nextPickup.x;
        existing.z = nextPickup.z;
        existing.ammoInClip = nextPickup.ammoInClip;
        existing.reserveAmmo = nextPickup.reserveAmmo;
        changed = true;
      }
    }

    return changed;
  }

  syncNpcStateFromWorld() {
    const nextIds = new Set();

    this.worldState.forEachNpcDefinition((npc) => {
      nextIds.add(npc.id);
      const definition = normalizeNpcBehavior(npc, {
        position: npc.position,
        rotationQuarterTurns: npc.rotationQuarterTurns
      });
      this.definitions.set(npc.id, definition);
      const previous = this.state.npcs.get(npc.id);
      const spawnPosition = definition.spawnPosition ?? definition.position ?? [0, 0];
      const spawnRotationQuarterTurns = definition.spawnRotationQuarterTurns ?? definition.rotationQuarterTurns ?? 0;
      this.state.npcs.set(npc.id, {
        id: npc.id,
        modelId: definition.modelId,
        name: definition.name,
        x: quantizePosition(previous?.x ?? spawnPosition[0]),
        z: quantizePosition(previous?.z ?? spawnPosition[1]),
        position: [quantizePosition(previous?.x ?? spawnPosition[0]), quantizePosition(previous?.z ?? spawnPosition[1])],
        rotationY: quantizeRotation(previous?.rotationY ?? toRotationY(spawnRotationQuarterTurns)),
        rotationQuarterTurns: previous?.rotationQuarterTurns ?? spawnRotationQuarterTurns,
        interactRadius: definition.interactRadius,
        policeOfficerEnabled: definition.policeOfficerEnabled === true,
        lawRadius: definition.lawRadius,
        deliveryQuestEnabled: definition.deliveryQuestEnabled === true,
        gymCheckInEnabled: definition.gymCheckInEnabled === true,
        rentCollectorEnabled: definition.rentCollectorEnabled === true,
        stockMarketEnabled: definition.stockMarketEnabled === true,
        bartenderEnabled: definition.bartenderEnabled === true,
        pawnShopOwnerEnabled: definition.pawnShopOwnerEnabled === true,
        carDealerEnabled: definition.carDealerEnabled === true,
        marthaEnabled: definition.marthaEnabled === true,
        blackjackDealerEnabled: definition.blackjackDealerEnabled === true,
        schoolMicrogameEnabled: definition.schoolMicrogameEnabled === true,
        schoolMicrogameId: definition.schoolMicrogameId || SCHOOL_MICROGAME_ALL_ID,
        health: previous?.health ?? NPC_DEFAULT_MAX_HEALTH,
        maxHealth: previous?.maxHealth ?? NPC_DEFAULT_MAX_HEALTH,
        alive: previous?.alive !== false,
        respawnAt: previous?.respawnAt ?? 0,
        active: true,
        mode: previous?.mode ?? NPC_RUNTIME_MODES.routine,
        currentStepIndex: previous?.currentStepIndex ?? 0,
        targetPlacementId: previous?.targetPlacementId ?? '',
        weaponId: previous?.weaponId ?? definition.combat?.weaponId ?? '',
        lastAttackerId: previous?.lastAttackerId ?? '',
        hiddenUntil: previous?.hiddenUntil ?? 0,
        activity: previous?.activity ?? '',
        lastDamagedAt: previous?.lastDamagedAt ?? 0,
        busy: previous?.busy ?? false,
        chatStatus: previous?.chatStatus ?? 'idle',
        chatText: previous?.chatText ?? '',
        chatStartedAt: previous?.chatStartedAt ?? 0,
        chatSeq: previous?.chatSeq ?? 0
      });
      if (!this.npcRuntimeMeta.has(npc.id)) {
        this.npcRuntimeMeta.set(npc.id, createNpcRuntimeMeta());
      }
      if (!this.transcripts.has(npc.id)) {
        this.transcripts.set(npc.id, []);
      }
    });

    for (const npcId of this.state.npcs.keys()) {
      if (nextIds.has(npcId)) {
        continue;
      }
      if (this.policeCarResponseNpcs.has(npcId)) {
        continue;
      }

      this.definitions.delete(npcId);
      this.state.npcs.delete(npcId);
      this.npcRuntimeMeta.delete(npcId);
      this.transcripts.delete(npcId);
    }

    this.syncPoliceCarResponseNpcDefinitions();
    this.npcRouteGraph = buildNpcRouteGraph(this.worldState);
  }

  syncNpcDerivedState(npc) {
    npc.position = [npc.x, npc.z];
  }

  finalizeNpcSimulationTick(now) {
    return this.cleanupPoliceCarResponseNpcs(now);
  }

  resetPassiveTrafficSimulation() {
    this.lastPassiveTrafficSimulationAt = Date.now();
    const snapshots = this.passiveTrafficSimulation.reset(
      this.worldState,
      this.worldState.getPassiveTrafficRoutes()
    );
    this.publishPassiveTrafficSnapshots(snapshots);
  }

  updatePassiveTrafficSimulation() {
    const now = Date.now();
    const deltaSeconds = Math.max(0, Math.min(0.25, (now - this.lastPassiveTrafficSimulationAt) / 1000));
    this.lastPassiveTrafficSimulationAt = now;
    const snapshots = this.passiveTrafficSimulation.update(deltaSeconds);
    this.publishPassiveTrafficSnapshots(snapshots);
    this.emit();
  }

  publishPassiveTrafficSnapshots(snapshots = []) {
    const nextIds = new Set();
    for (const snapshot of snapshots) {
      if (!snapshot?.id) {
        continue;
      }

      nextIds.add(snapshot.id);
      this.state.passiveTraffic.set(snapshot.id, {
        id: snapshot.id,
        itemId: snapshot.itemId || '',
        routeId: snapshot.routeId || '',
        carIndex: Math.max(0, Math.floor(Number(snapshot.carIndex) || 0)),
        x: Number(snapshot.x) || 0,
        y: Number(snapshot.y) || 0,
        z: Number(snapshot.z) || 0,
        rotationY: Number(snapshot.rotationY) || 0,
        speed: Number(snapshot.speed) || 0,
        active: snapshot.active !== false,
        currentNodeIndex: Math.floor(Number(snapshot.currentNodeIndex) || 0),
        targetNodeIndex: Math.floor(Number(snapshot.targetNodeIndex) || 0),
        seq: Math.max(0, Math.floor(Number(snapshot.seq) || 0))
      });
    }

    for (const id of [...this.state.passiveTraffic.keys()]) {
      if (!nextIds.has(id)) {
        this.state.passiveTraffic.delete(id);
      }
    }
  }

  getWorldLayoutWithPoliceCarResponseNpcs() {
    const layout = cloneLayout(this.worldState.serializeLayout());
    for (const [npcId, response] of this.policeCarResponseNpcs) {
      const definition = response?.definition ?? this.definitions.get(npcId);
      const npc = this.state.npcs.get(npcId);
      if (!definition || !npc || npc.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const placement = createPoliceCarResponseNpcPlacement(definition, npc);
      if (placement) {
        layout.npcs.push(placement);
      }
    }
    return layout;
  }

  syncPoliceCarResponseNpcDefinitions() {
    for (const [npcId, response] of this.policeCarResponseNpcs) {
      if (!response?.definition || !this.state.npcs.has(npcId)) {
        continue;
      }

      this.definitions.set(npcId, response.definition);
      if (!this.npcRuntimeMeta.has(npcId)) {
        this.npcRuntimeMeta.set(npcId, createNpcRuntimeMeta());
      }
      if (!this.transcripts.has(npcId)) {
        this.transcripts.set(npcId, []);
      }
    }
  }

  findNearestPoliceStationPlacementId(position = null) {
    let nearestPlacementId = '';
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    this.worldState.forEachPlacement((placement) => {
      const item = getBuilderItemById(placement?.itemId);
      if (!placement || item?.id !== 'police_station_building') {
        return;
      }

      const approach = getPlacementApproachPoint(placement, item) ?? getPlacementWorldOrigin(placement, item);
      if (!approach) {
        return;
      }

      const distanceSq = position
        ? distanceSquared2D(position.x, position.z, approach.x, approach.z)
        : 0;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestPlacementId = placement.id;
      }
    });
    return nearestPlacementId;
  }

  createPoliceCarResponseNpcState(definition, spawn, attackerId = '', now = Date.now()) {
    const rotationY = Number.isFinite(spawn?.rotationY)
      ? quantizeRotation(spawn.rotationY)
      : quantizeRotation(toRotationY(definition.spawnRotationQuarterTurns ?? 0));
    const npc = {
      id: definition.id,
      modelId: definition.modelId,
      name: definition.name,
      x: quantizePosition(spawn?.x ?? definition.spawnPosition?.[0] ?? 0),
      z: quantizePosition(spawn?.z ?? definition.spawnPosition?.[1] ?? 0),
      rotationY,
      rotationQuarterTurns: quantizeRotationQuarterTurnsFromRotationY(rotationY),
      interactRadius: definition.interactRadius,
      policeOfficerEnabled: true,
      lawRadius: definition.lawRadius,
      deliveryQuestEnabled: false,
      gymCheckInEnabled: false,
      rentCollectorEnabled: false,
      stockMarketEnabled: false,
      bartenderEnabled: false,
      pawnShopOwnerEnabled: false,
      carDealerEnabled: false,
      marthaEnabled: false,
      blackjackDealerEnabled: false,
      schoolMicrogameEnabled: false,
      schoolMicrogameId: SCHOOL_MICROGAME_ALL_ID,
      health: NPC_DEFAULT_MAX_HEALTH,
      maxHealth: NPC_DEFAULT_MAX_HEALTH,
      alive: true,
      respawnAt: 0,
      active: true,
      mode: NPC_RUNTIME_MODES.combat,
      currentStepIndex: 0,
      targetPlacementId: '',
      weaponId: definition.combat?.weaponId ?? WEAPON_IDS.pistol,
      lastAttackerId: attackerId,
      hiddenUntil: 0,
      activity: '',
      lastDamagedAt: 0,
      busy: false,
      chatStatus: 'idle',
      chatText: '',
      chatStartedAt: 0,
      chatSeq: 0
    };
    this.syncNpcDerivedState(npc);
    const meta = createNpcRuntimeMeta();
    meta.calmEndsAt = now + NPC_DEFAULT_CALM_MS;
    meta.lastCombatAt = now;
    meta.combatAnchor = {
      x: npc.x,
      z: npc.z
    };
    this.npcRuntimeMeta.set(npc.id, meta);
    return npc;
  }

  spawnPoliceCarResponseOfficers(carSnapshot, shooterSessionId = '', now = Date.now()) {
    const stationPlacementId = this.findNearestPoliceStationPlacementId(carSnapshot);
    if (!stationPlacementId) {
      return 0;
    }

    let spawnedCount = 0;
    for (const spawn of getPoliceCarResponseOfficerSpawnSpecs(carSnapshot)) {
      const npcId = createPoliceCarResponseNpcId(carSnapshot.id, spawn.side, ++this.policeCarResponseSequence);
      const definition = createPoliceCarResponseNpcDefinition({
        npcId,
        spawn,
        stationPlacementId
      });
      if (!definition) {
        continue;
      }

      const npc = this.createPoliceCarResponseNpcState(definition, spawn, shooterSessionId, now);
      this.definitions.set(npcId, definition);
      this.state.npcs.set(npcId, npc);
      this.transcripts.set(npcId, []);
      this.policeCarResponseNpcs.set(npcId, {
        npcId,
        carId: carSnapshot.id,
        definition,
        stationPlacementId,
        deadDespawnAt: 0
      });
      const placement = createPoliceCarResponseNpcPlacement(definition, npc);
      if (placement) {
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement,
          replacedPlacementId: null
        });
      }
      spawnedCount += 1;
    }

    return spawnedCount;
  }

  removePoliceCarResponseNpc(npcId = '') {
    if (!npcId || !this.policeCarResponseNpcs.has(npcId)) {
      return false;
    }

    this.policeCarResponseNpcs.delete(npcId);
    this.definitions.delete(npcId);
    this.state.npcs.delete(npcId);
    this.npcRuntimeMeta.delete(npcId);
    this.transcripts.delete(npcId);
    this.emitWorldPatch({
      type: 'deletePlacement',
      placementId: npcId
    });
    return true;
  }

  cleanupPoliceCarResponseNpcs(now = Date.now()) {
    let changed = false;
    for (const [npcId, response] of [...this.policeCarResponseNpcs]) {
      const npc = this.state.npcs.get(npcId);
      if (!npc || !this.definitions.has(npcId)) {
        changed = this.removePoliceCarResponseNpc(npcId) || changed;
        continue;
      }

      if (npc.mode === NPC_RUNTIME_MODES.hidden) {
        changed = this.removePoliceCarResponseNpc(npcId) || changed;
        continue;
      }

      if (npc.alive === false || npc.mode === NPC_RUNTIME_MODES.dead) {
        if (!response.deadDespawnAt) {
          response.deadDespawnAt = now + POLICE_CAR_RESPONSE_DEAD_DESPAWN_MS;
          changed = true;
        } else if (now >= response.deadDespawnAt) {
          changed = this.removePoliceCarResponseNpc(npcId) || changed;
        }
      }
    }
    return changed;
  }

  emitNpcCombatEvent(event) {
    this.emitCombatEvent(event);
  }

  async getWorldLayout() {
    return this.getWorldLayoutWithPoliceCarResponseNpcs();
  }

  async editWorld(op, payload = {}) {
    if (!this.isAdmin()) {
      return { ok: false, error: 'Admin access required.' };
    }

    switch (op) {
      case 'placeTile': {
        const item = getBuilderItemById(payload?.itemId);
        if (!item || item.layer !== 'tile') {
          return { ok: false, error: 'That tile is not available.' };
        }
        const result = this.worldState.placeTile(
          item,
          Math.round(Number(payload.cellX ?? 0)),
          Math.round(Number(payload.cellZ ?? 0)),
          Number(payload.rotationQuarterTurns ?? 0)
        );
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId
        });
        this.resetPassiveTrafficSimulation();
        this.emit();
        return { ok: true, placementId: result.placement.id };
      }
      case 'placeProp': {
        const item = getBuilderItemById(payload?.itemId);
        if (!item || item.layer !== 'prop') {
          return { ok: false, error: 'That prop is not available.' };
        }
        const placement = this.worldState.placeProp(
          item,
          Number(payload.x ?? 0),
          Number(payload.z ?? 0),
          Number(payload.rotationQuarterTurns ?? 0),
          null,
          normalizePropPlacementScale(payload.scale, getDefaultPropPlacementScale(item)),
          Number.isFinite(Number(payload.rotationY)) ? quantizeRotation(payload.rotationY) : null
        );
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        if (this.syncCombatPickupsFromWorld()) {
          this.emit();
        }
        return { ok: true, placementId: placement.id };
      }
      case 'placeNpc': {
        const model = getNpcModelById(payload.modelId);
        const item = model ? getBuilderItemById(model.itemId) : null;
        if (!item || item.layer !== 'npc') {
          return { ok: false, error: 'That NPC model is not available.' };
        }

        const placement = this.worldState.placeNpc(
          item,
          Number(payload.x ?? 0),
          Number(payload.z ?? 0),
          Number(payload.rotationQuarterTurns ?? 0),
          {
            modelId: payload.modelId,
            name: payload.name,
            prompt: payload.prompt,
            interactRadius: payload.interactRadius,
            policeOfficerEnabled: payload.policeOfficerEnabled,
            lawRadius: payload.lawRadius,
            speed: payload.speed,
            routine: payload.routine,
            combat: payload.combat,
            respawnDelayMs: payload.respawnDelayMs,
            deliveryQuestEnabled: payload.deliveryQuestEnabled,
            gymCheckInEnabled: payload.gymCheckInEnabled,
            rentCollectorEnabled: payload.rentCollectorEnabled,
            stockMarketEnabled: payload.stockMarketEnabled,
            bartenderEnabled: payload.bartenderEnabled,
            pawnShopOwnerEnabled: payload.pawnShopOwnerEnabled,
            carDealerEnabled: payload.carDealerEnabled,
            marthaEnabled: payload.marthaEnabled,
            blackjackDealerEnabled: payload.blackjackDealerEnabled,
            schoolMicrogameEnabled: payload.schoolMicrogameEnabled,
            schoolMicrogameId: payload.schoolMicrogameId
          }
        );
        this.syncNpcStateFromWorld();
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        this.emit();
        return { ok: true, placementId: placement.id };
      }
      case 'rotatePlacement': {
        const result = this.worldState.rotatePlacement(payload.placementId);
        if (!result?.placement) {
          return { ok: false, error: result?.error ?? 'That placement is not available.' };
        }
        const placement = result.placement;

        if (placement.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.resetNpcRuntimeState(placement.id, { restartFromSpawn: true });
          this.emit();
        } else if (placement.layer === 'tile') {
          this.resetPassiveTrafficSimulation();
          this.emit();
        } else if (this.syncCombatPickupsFromWorld()) {
          this.emit();
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'movePlacement': {
        const previousPlacement = this.worldState.getPlacement(payload.placementId);
        const result = this.worldState.movePlacement(payload.placementId, payload);
        if (!result?.placement) {
          return { ok: false, error: result?.error ?? 'That placement is not available.' };
        }

        if (previousPlacement?.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.resetNpcRuntimeState(result.placement.id, { restartFromSpawn: true });
          this.emit();
        } else if (previousPlacement?.layer === 'tile' || result.placement.layer === 'tile') {
          this.resetPassiveTrafficSimulation();
          this.emit();
        } else if (this.syncCombatPickupsFromWorld()) {
          this.emit();
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(result.placement.id),
          replacedPlacementIds: result.replacedPlacementIds ?? [],
          replacedPlacementId: result.replacedPlacementId ?? null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'deletePlacement': {
        const placement = this.worldState.deletePlacement(payload.placementId);
        if (!placement) {
          return { ok: false, error: 'That placement is not available.' };
        }

        if (placement.layer === 'npc') {
          this.syncNpcStateFromWorld();
          this.emit();
        } else if (placement.layer === 'tile') {
          this.resetPassiveTrafficSimulation();
          this.emit();
        } else if (this.syncCombatPickupsFromWorld()) {
          this.emit();
        }

        this.emitWorldPatch({
          type: 'deletePlacement',
          placementId: payload.placementId
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'updateNpc': {
        const existingPlacement = this.worldState.getPlacement(payload.placementId);
        const previousNpc = existingPlacement?.npc
          ? cloneNpcBehavior(existingPlacement.npc)
          : null;
        const nextUpdates = clonePlainObject(payload);
        delete nextUpdates.placementId;
        if (nextUpdates.modelId) {
          const model = getNpcModelById(nextUpdates.modelId);
          if (!model) {
            return { ok: false, error: 'That NPC model is not available.' };
          }
          nextUpdates.itemId = model.itemId;
        }

        const placement = this.worldState.updateNpc(payload.placementId, nextUpdates);
        if (!placement) {
          return { ok: false, error: 'That NPC is not available.' };
        }

        this.syncNpcStateFromWorld();
        if (shouldResetNpcRuntimeForBehaviorUpdate(previousNpc, placement.npc, nextUpdates)) {
          this.resetNpcRuntimeState(placement.id, { restartFromSpawn: false });
        }
        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        this.emit();
        return { ok: true, placementId: payload.placementId };
      }
      case 'updatePlacementInteractable': {
        const placement = this.worldState.updatePlacementInteractable(payload.placementId, payload.interactable ?? null);
        if (!placement) {
          return { ok: false, error: 'That placement is not available.' };
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'updatePlacementScale': {
        const existingPlacement = this.worldState.getPlacement(payload.placementId);
        const placement = this.worldState.updatePlacementScale(
          payload.placementId,
          normalizePropPlacementScale(payload.scale, getDefaultPropPlacementScale(existingPlacement))
        );
        if (!placement) {
          return { ok: false, error: 'That prop is not available.' };
        }

        if (this.syncCombatPickupsFromWorld()) {
          this.emit();
        }

        this.emitWorldPatch({
          type: 'upsertPlacement',
          placement: this.worldState.serializePlacement(placement.id),
          replacedPlacementId: null
        });
        return { ok: true, placementId: payload.placementId };
      }
      case 'updateMissionSequence': {
        const missionSequence = this.worldState.updateMissionSequence(payload.missionSequence);
        for (const player of this.state.players.values()) {
          this.normalizePlayerSelectedMission(player);
        }
        this.emitWorldPatch({
          type: 'updateMissionSequence',
          missionSequence
        });
        this.emit();
        return { ok: true };
      }
      case 'updatePassiveTrafficRoutes': {
        const passiveTrafficRoutes = this.worldState.updatePassiveTrafficRoutes(payload.passiveTrafficRoutes);
        this.emitWorldPatch({
          type: 'updatePassiveTrafficRoutes',
          passiveTrafficRoutes
        });
        this.resetPassiveTrafficSimulation();
        this.emit();
        return { ok: true };
      }
      case 'updateNpcModelVoice': {
        const model = getNpcModelById(payload.modelId);
        if (!model) {
          return { ok: false, error: 'That NPC model is not available.' };
        }
        const voice = this.worldState.updateNpcModelVoice(
          model.id,
          normalizeNpcVoice(payload.voice, model.voice)
        );
        this.emitWorldPatch({
          type: 'updateNpcModelVoice',
          modelId: model.id,
          voice
        });
        return { ok: true, modelId: model.id, voice };
      }
      default:
        return { ok: false, error: 'That world edit is not supported.' };
    }
  }

  setPlayerTransform(position, rotationY = 0, animationState = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const transformSeq = ++this.lastTransformSeq;
    const nextAnimation = sanitizePlayerAnimationState(animationState, this.nextAnimationState);
    const clamped = clampToWorldBounds(position.x, position.z);
    if (this.isGymGateBlockingPosition(player, clamped)) {
      player.transformSeq = transformSeq;
      return;
    }
    const meta = this.getPlayerRuntimeMeta(this.state.sessionId);
    const travelled = distance2D(player.x, player.z, clamped.x, clamped.z);
    this.awardAgilityXpFromDistance(player, meta, travelled);
    player.x = clamped.x;
    player.y = quantizePosition(position.y);
    player.z = clamped.z;
    player.rotationY = Number.isFinite(rotationY) ? rotationY : player.rotationY;
    player.aimRotationY = nextAnimation.aimRotationY;
    player.aiming = nextAnimation.aiming;
    player.skating = Boolean(nextAnimation.skating && (isPlayerSkateboardOwner(player) || isPlayerVehicleOwner(player)));
    player.transformSeq = transformSeq;
    player.emoteId = nextAnimation.emoteId;
    player.emoteActive = nextAnimation.emoteActive;
    player.emoteStartedAt = nextAnimation.emoteStartedAt;
    player.emoteSeq = nextAnimation.emoteSeq;
  }

  getLastTransformSeq() {
    return this.lastTransformSeq;
  }

  setCharacter(characterId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return;
    }

    const normalized = getPlayableCharacterById(characterId).id;
    if (player.characterId === normalized) {
      return;
    }

    player.characterId = normalized;
    this.emit();
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

  async selectMission(missionId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return { ok: false, error: 'Your player is not connected.' };
    }

    const normalizedMissionId = normalizeMissionId(missionId);
    if (!normalizedMissionId || !isMissionSelectable(normalizedMissionId, player, this.worldState.getMissionSequence())) {
      return { ok: false, error: 'That mission is locked or already complete.' };
    }

    player.selectedMissionId = normalizedMissionId;
    const selectedMissionId = this.normalizePlayerSelectedMission(player);
    this.emit();
    return { ok: true, selectedMissionId };
  }

  setBuilderPresence(presence = {}) {
    if (!this.isAdmin()) {
      this.state.builders.delete(this.state.sessionId);
      this.emit();
      return;
    }

    if (!presence.active) {
      this.state.builders.delete(this.state.sessionId);
      this.emit();
      return;
    }

    this.state.builders.set(this.state.sessionId, {
      active: true,
      itemId: presence.itemId ?? '',
      layer: presence.layer ?? '',
      rotationQuarterTurns: presence.rotationQuarterTurns ?? 0,
      rotationY: quantizeRotation(presence.rotationY),
      scale: normalizePropPlacementScale(presence.scale, getDefaultPropPlacementScale(presence.itemId)),
      cellX: presence.cellX ?? 0,
      cellZ: presence.cellZ ?? 0,
      x: quantizePosition(presence.x),
      z: quantizePosition(presence.z),
      selectionPlacementId: presence.selectionPlacementId ?? ''
    });
    this.emit();
  }

  setPlayerSpeech(player, text) {
    player.chatText = text;
    player.chatStartedAt = Date.now();
    player.chatSeq = (player.chatSeq ?? 0) + 1;
  }

  setNpcChatPhase(npc, status, text = npc.chatText ?? '', { bumpSeq = false } = {}) {
    npc.chatStatus = status;
    npc.chatText = text;
    npc.chatStartedAt = Date.now();
    if (bumpSeq) {
      npc.chatSeq = (npc.chatSeq ?? 0) + 1;
    }
  }

  getPlayerAlias(sessionId) {
    if (!this.playerAliases.has(sessionId)) {
      this.playerAliasSequence += 1;
      this.playerAliases.set(sessionId, `Player ${this.playerAliasSequence}`);
    }

    return this.playerAliases.get(sessionId);
  }

  appendTranscript(npcId, entry) {
    const transcript = this.transcripts.get(npcId) ?? [];
    transcript.push(entry);
    this.transcripts.set(npcId, clampTranscript(transcript));
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

  sanitizeChatMessage(message) {
    const trimmed = String(message ?? '').trim();
    if (!trimmed) {
      return { ok: false, error: 'Say something first.' };
    }

    if (trimmed.length > 280) {
      return { ok: false, error: 'Messages are capped at 280 characters.' };
    }

    const cooldownKey = `${this.state.sessionId}:chat`;
    const lastSentAt = this.cooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastSentAt < 900) {
      return { ok: false, error: 'Take a breath before sending another message.' };
    }

    this.cooldowns.set(cooldownKey, Date.now());
    return { ok: true, message: trimmed };
  }

  async say(message) {
    const sanitized = this.sanitizeChatMessage(message);
    if (!sanitized.ok) {
      return sanitized;
    }

    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return { ok: false, error: 'Your player is not connected.' };
    }

    this.setPlayerSpeech(player, sanitized.message);
    this.state.players.set(this.state.sessionId, player);
    this.emit();

    const npc = this.findNearestHeardNpc(player);
    if (!npc || npc.busy) {
      return { ok: true };
    }

    const definition = this.definitions.get(npc.id);
    if (!definition) {
      return { ok: true };
    }

    this.awardPlayerSkillXp(player, SKILL_IDS.charisma, CHARISMA_NPC_CHAT_XP);
    npc.busy = true;
    this.setNpcChatPhase(npc, 'thinking', '', { bumpSeq: true });
    this.appendTranscript(
      npc.id,
      makeTranscriptEntry(`local_${++this.sequence}`, 'player', this.getPlayerAlias(this.state.sessionId), sanitized.message)
    );
    this.emit();

    await new Promise((resolve) => window.setTimeout(resolve, 320));

    const reply = this.buildReply(definition);
    let partial = '';
    for (const word of reply.split(/\s+/)) {
      if (!word) {
        continue;
      }
      partial = partial ? `${partial} ${word}` : word;
      this.setNpcChatPhase(npc, 'streaming', partial);
      this.emit();
      await new Promise((resolve) => window.setTimeout(resolve, 75));
    }

    this.appendTranscript(
      npc.id,
      makeTranscriptEntry(`local_${++this.sequence}`, 'npc', npc.name, reply)
    );
    this.setNpcChatPhase(npc, 'done', reply, { bumpSeq: true });
    npc.busy = false;
    this.emit();
    return { ok: true };
  }

  buildReply(definition) {
    return buildMockNpcReply(definition);
  }

  pickupWeapon(pickupId) {
    const player = this.state.players.get(this.state.sessionId);
    const pickup = this.state.pickups.get(String(pickupId ?? ''));
    if (!player || !pickup?.active || player.alive === false) {
      return;
    }

    if (distanceSquared2D(player.x, player.z, pickup.x, pickup.z) > PICKUP_INTERACT_RADIUS * PICKUP_INTERACT_RADIUS) {
      return;
    }

    const result = applyWeaponPickupToPlayerState(player, pickup);
    if (!result.changed) {
      return;
    }

    this.consumePickup(pickup);
    this.emitCombatEvent({
      type: 'pickup',
      playerId: this.state.sessionId,
      pickupId: pickup.id,
      weaponId: result.weaponId
    });
    this.emit();
  }

  equipWeapon(weaponId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return;
    }

    const nextWeaponId = normalizeEquippableWeaponId(weaponId);
    if (!canEquipInventoryWeapon(player.ownedWeaponIds, nextWeaponId)) {
      return;
    }
    if (player.equippedWeaponId === nextWeaponId) {
      return;
    }

    player.equippedWeaponId = nextWeaponId;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    this.emit();
  }

  fireWeapon(aimDirection = { x: 0, z: 1 }, clientShotAt = Date.now(), origin = null) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false || !player.equippedWeaponId || player.isReloading) {
      return false;
    }

    const now = Date.now();
    if (player.ammoInClip <= 0 || (now - (player.lastShotAt ?? 0)) < WEAPON_FIRE_INTERVAL_MS) {
      return false;
    }

    const aim = normalizeAimVector(aimDirection.x, aimDirection.z);
    const shotOrigin = this.resolveShotOrigin(player, origin);
    player.lastShotAt = now;
    player.ammoInClip = Math.max(0, player.ammoInClip - 1);

    const shot = this.resolveShot(this.state.sessionId, player, aim, shotOrigin);
    this.triggerPoliceHostilityForPlayer(this.state.sessionId, player, 'shot-fired', now);
    this.emitCombatEvent({
      type: 'shot',
      shooterType: 'player',
      shooterId: this.state.sessionId,
      weaponId: player.equippedWeaponId,
      fromX: shotOrigin.x,
      fromZ: shotOrigin.z,
      toX: shot.hitX,
      toZ: shot.hitZ,
      clientShotAt
    });
    this.emitCombatEvent({
      type: 'impact',
      shooterType: 'player',
      shooterId: this.state.sessionId,
      kind: shot.kind,
      targetId: shot.targetId ?? '',
      x: shot.hitX,
      z: shot.hitZ
    });

    if (shot.kind === 'player' && shot.targetId) {
      const target = this.state.players.get(shot.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - WEAPON_DAMAGE);
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(shot.targetId, this.state.sessionId);
        }
      }
    }

    if (shot.kind === 'npc' && shot.targetId) {
      this.applyDamageToNpc(shot.targetId, WEAPON_DAMAGE, this.state.sessionId, now);
    }

    if (shot.kind === 'passiveTraffic' && shot.targetId) {
      this.handlePoliceCarShot(shot.targetId, this.state.sessionId, now);
    }

    if (player.ammoInClip <= 0 && player.reserveAmmo > 0) {
      this.startReload(player);
    }

    this.emit();
    return true;
  }

  punch(aimDirection = { x: 0, z: 1 }, clientPunchAt = Date.now(), { comboStep = 1 } = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return false;
    }

    const now = Date.now();
    const elapsedSinceLastPunch = now - (player.lastPunchAt ?? 0);
    if (elapsedSinceLastPunch < PUNCH_COMBO_MIN_INTERVAL_MS) {
      return false;
    }

    const aim = normalizeAimVector(aimDirection.x, aimDirection.z);
    const resolvedComboStep = resolvePunchComboStep({
      requestedStep: normalizePunchComboStep(comboStep),
      lastStep: player.lastPunchComboStep ?? 0,
      elapsedMs: elapsedSinceLastPunch
    });
    player.lastPunchAt = now;
    player.lastPunchComboStep = resolvedComboStep;
    player.emoteId = getPunchComboEmoteId(resolvedComboStep);
    player.emoteActive = true;
    player.emoteStartedAt = now;
    player.emoteSeq = (player.emoteSeq ?? 0) + 1;
    this.triggerPoliceHostilityForPlayer(this.state.sessionId, player, 'punch', now);
    this.emit();

    setTimeout(() => {
      this.resolvePlayerPunchImpact(this.state.sessionId, aim, clientPunchAt, resolvedComboStep);
    }, getPunchComboHitDelayMs(resolvedComboStep));

    return true;
  }

  resolvePlayerPunchImpact(sessionId, aim, clientPunchAt = Date.now(), comboStep = 1) {
    const player = this.state.players.get(sessionId);
    if (!player || player.alive === false || player.equippedWeaponId || player.isReloading) {
      return;
    }

    const now = Date.now();
    const hit = this.resolvePunch(sessionId, player, aim);
    if (hit.kind !== 'miss') {
      this.emitCombatEvent({
        type: 'impact',
        shooterType: 'player',
        shooterId: sessionId,
        attackType: 'punch',
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        assisted: hit.assisted === true,
        comboStep: normalizePunchComboStep(comboStep),
        hitReaction: getRandomPunchHitReaction(comboStep),
        clientPunchAt
      });
    }

    if (hit.kind === 'player' && hit.targetId) {
      const target = this.state.players.get(hit.targetId);
      if (target?.alive !== false) {
        target.health = Math.max(0, target.health - getPunchComboDamage(comboStep));
        target.lastDamagedAt = now;
        if (target.health <= 0) {
          this.handlePlayerDeath(hit.targetId, sessionId);
        }
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, getPunchComboDamage(comboStep), sessionId, now);
    }

    this.emit();
  }

  reloadWeapon() {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return;
    }
    this.startReload(player);
  }

  applyPassiveTrafficHit({ damage = 20, emoteId = STAND_UP_EMOTE_ID, position = null, rotationY = undefined } = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'Player is not active.' };
    }

    const now = Date.now();
    const hitDamage = Math.max(0, Math.floor(Number(damage) || 0));
    if (hitDamage <= 0) {
      return { ok: true, health: player.health, alive: player.alive !== false };
    }

    player.health = Math.max(0, player.health - hitDamage);
    player.lastDamagedAt = now;
    player.emoteId = emoteId === STAND_UP_EMOTE_ID ? STAND_UP_EMOTE_ID : '';
    player.emoteActive = player.emoteId === STAND_UP_EMOTE_ID;
    player.emoteStartedAt = player.emoteActive ? now : 0;
    player.emoteSeq = (player.emoteSeq ?? 0) + 1;
    const crashX = Number(position?.x);
    const crashZ = Number(position?.z);
    if (Number.isFinite(crashX) && Number.isFinite(crashZ)) {
      const clamped = clampToWorldBounds(crashX, crashZ);
      const crashY = Number(position?.y);
      const crashRotationY = Number(rotationY);
      player.x = clamped.x;
      player.y = Number.isFinite(crashY) ? quantizePosition(crashY) : player.y;
      player.z = clamped.z;
      if (Number.isFinite(crashRotationY)) {
        player.rotationY = quantizeRotation(crashRotationY);
        player.aimRotationY = player.rotationY;
      }
      player.transformSeq = ++this.lastTransformSeq;
      const meta = this.getPlayerRuntimeMeta(this.state.sessionId);
      meta.x = player.x;
      meta.z = player.z;
      meta.acceptedAt = now;
      meta.lastTransformSeq = player.transformSeq;
    }
    player.skating = false;
    this.getPlayerRuntimeMeta(this.state.sessionId).healthRegenCarryMs = 0;
    if (player.health <= 0) {
      this.handlePlayerDeath(this.state.sessionId, '');
    }

    this.emit();
    return { ok: true, health: player.health, alive: player.alive !== false };
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

  isPlayerInStockMarketRadius(player, npc) {
    if (!player || !npc || !isStockMarketNpc(npc)) {
      return false;
    }

    const radius = getStockMarketPromptRadius(npc);
    return distanceSquared2D(player.x, player.z, npc.x, npc.z) <= radius * radius;
  }

  getPlayerStockPortfolio(sessionId = this.state.sessionId) {
    if (!this.stockPortfolios.has(sessionId)) {
      this.stockPortfolios.set(sessionId, {});
    }

    const portfolios = this.stockPortfolios.get(sessionId);
    const player = this.state.players.get(sessionId);
    const characterId = getPlayableCharacterById(player?.characterId).id;
    if (!portfolios[characterId] || typeof portfolios[characterId] !== 'object' || Array.isArray(portfolios[characterId])) {
      portfolios[characterId] = {};
    }

    return portfolios[characterId];
  }

  persistStockPortfolios() {
    writeMockStockPortfolios(this.playerId, this.stockPortfolios.get(this.state.sessionId) ?? {});
  }

  persistStockMarket() {
    writeMockStockMarket(this.stockMarket);
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

      const radius = getStockMarketPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getStockMarketAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot trade right now.' };
    }

    const npc = this.getStockMarketNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to a stock broker.' };
    }

    return { ok: true, player, npc };
  }

  async getStockMarket(npcId = '') {
    const access = this.getStockMarketAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const portfolio = this.getPlayerStockPortfolio(this.state.sessionId);
    const market = serializeStockMarket(this.stockMarket, portfolio, access.player.money, Date.now());
    this.persistStockMarket();
    return {
      ok: true,
      market,
      money: access.player.money
    };
  }

  async tradeStock(npcId = '', symbol = '', side = '', quantity = 1, options = {}) {
    const phoneTrade = String(options?.source ?? '') === 'phone';
    const access = phoneTrade
      ? {
          ok: true,
          player: this.state.players.get(this.state.sessionId),
          npc: null
        }
      : this.getStockMarketAccess(npcId);
    if (!access.ok || !access.player || access.player.alive === false) {
      return { ok: false, error: access.error ?? 'You cannot trade right now.' };
    }

    const portfolio = this.getPlayerStockPortfolio(this.state.sessionId);
    const result = executeStockTrade({
      state: this.stockMarket,
      portfolio,
      cash: access.player.money,
      symbol,
      side,
      quantity,
      now: Date.now()
    });
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'That trade was rejected.' };
    }

    access.player.money = result.cash;
    const trade = result.trade ?? {};
    if (trade.side === 'buy' && Number(access.player.stockBoughtAt ?? 0) <= 0) {
      access.player.stockBoughtAt = Date.now();
      this.normalizePlayerSelectedMission(access.player);
    }
    this.persistStockPortfolios();
    this.persistStockMarket();
    const verb = trade.side === 'sell' ? 'Sold' : 'Bought';
    if (access.npc) {
      this.setNpcChatPhase(
        access.npc,
        'done',
        `${verb} ${trade.quantity ?? 0} ${trade.symbol ?? 'shares'} at $${Number(trade.price ?? 0).toFixed(2)}.`,
        { bumpSeq: true }
      );
    }
    this.emit();
    return {
      ok: true,
      trade,
      market: result.market,
      money: access.player.money
    };
  }

  async getWalletSnapshot() {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'Wallet is unavailable right now.' };
    }

    const portfolio = this.getPlayerStockPortfolio(this.state.sessionId);
    const wallet = serializeStockMarket(this.stockMarket, portfolio, player.money, Date.now());
    this.persistStockMarket();
    return {
      ok: true,
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

      const radius = getBartenderPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getBartenderAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot order right now.' };
    }

    const npc = this.getBartenderNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to the bartender.' };
    }

    return { ok: true, player, npc };
  }

  async buyBartenderDrink(npcId = '', itemId = '') {
    const access = this.getBartenderAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const item = getBartenderMenuItem(itemId);
    if (!item) {
      return { ok: false, error: 'That drink is not on the menu.' };
    }

    const money = Math.trunc(Number(access.player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(access.npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${item.price} for ${item.label.toLowerCase()}.` };
    }

    access.player.money = money - item.price;
    const inventoryCount = addPlayerDrink(access.player, item.id, 1);
    this.setNpcChatPhase(access.npc, 'done', item.orderLine, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount
      },
      inventory: getPlayerDrinkInventorySnapshot(access.player),
      money: access.player.money
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

      const radius = getPawnShopPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getPawnShopAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot buy that right now.' };
    }

    const npc = this.getPawnShopOwnerNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to the pawn shop owner.' };
    }

    return { ok: true, player, npc };
  }

  async buyPawnShopItem(npcId = '', itemId = '') {
    const access = this.getPawnShopAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const item = getPawnShopMenuItem(itemId);
    if (!item) {
      return { ok: false, error: 'That item is not for sale.' };
    }

    const money = Math.trunc(Number(access.player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(access.npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${item.price} for ${item.label.toLowerCase()}.` };
    }

    let inventoryCount = 0;
    let weaponResult = null;
    if (item.kind === 'weapon') {
      weaponResult = applyWeaponPickupToPlayerState(access.player, item);
      if (!weaponResult.changed) {
        const error = weaponResult.reason === 'no-ammo-space'
          ? 'You already have a fully stocked pistol.'
          : 'That weapon is not available.';
        this.setNpcChatPhase(access.npc, 'done', error, { bumpSeq: true });
        this.emit();
        return { ok: false, error };
      }
    } else if (item.kind === 'permanent') {
      if (isPlayerPawnShopItemOwned(access.player, item.id)) {
        const error = `You already own a ${item.label.toLowerCase()}.`;
        this.setNpcChatPhase(access.npc, 'done', error, { bumpSeq: true });
        this.emit();
        return { ok: false, error };
      }
      inventoryCount = addPlayerPawnShopItem(access.player, item.id, 1);
    } else {
      inventoryCount = addPlayerPawnShopItem(access.player, item.id, 1);
    }

    access.player.money = money - item.price;
    if (item.id === PAWN_SHOP_ITEM_IDS.skateboard) {
      this.normalizePlayerSelectedMission(access.player);
    }
    this.setNpcChatPhase(access.npc, 'done', item.orderLine, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount,
        weaponId: item.weaponId ?? ''
      },
      inventory: getPlayerPawnShopInventorySnapshot(access.player),
      weapon: weaponResult
        ? {
            weaponId: weaponResult.weaponId,
            alreadyOwned: weaponResult.alreadyOwned === true,
            ammoInClip: access.player.ammoInClip,
            reserveAmmo: access.player.reserveAmmo
          }
        : null,
      money: access.player.money
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

      const radius = getCarDealerPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getCarDealerAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot buy that right now.' };
    }

    const npc = this.getCarDealerNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to the car dealer.' };
    }

    return { ok: true, player, npc };
  }

  async buyCarDealerVehicle(npcId = '', itemId = '') {
    const access = this.getCarDealerAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const item = getCarDealerMenuItem(itemId);
    if (!item) {
      return { ok: false, error: 'That car is not for sale.' };
    }

    if (playerOwnsVehicleItem(access.player, item.id)) {
      const error = `You already own the ${item.label}.`;
      this.setNpcChatPhase(access.npc, 'done', error, { bumpSeq: true });
      this.emit();
      return { ok: false, error };
    }

    const money = Math.trunc(Number(access.player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(access.npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${item.price} for the ${item.label}.` };
    }

    setPlayerVehicleItem(access.player, item.id);
    access.player.money = money - item.price;
    this.setNpcChatPhase(access.npc, 'done', item.orderLine, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: 1
      },
      inventory: getPlayerVehicleInventorySnapshot(access.player),
      money: access.player.money
    };
  }

  async selectPlayerVehicle(itemId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot switch vehicles right now.' };
    }

    if (String(itemId ?? '').trim() === SKATEBOARD_ITEM_ID) {
      if (!isPlayerSkateboardOwner(player)) {
        return { ok: false, error: 'You do not own the skateboard.' };
      }

      player.vehicleItemId = '';
      player.skating = false;
      this.emit();
      return {
        ok: true,
        item: {
          id: SKATEBOARD_ITEM_ID,
          label: 'Skateboard',
          price: 0,
          count: 1
        },
        inventory: getPlayerVehicleInventorySnapshot(player)
      };
    }

    const item = getCarDealerMenuItem(itemId);
    if (!item) {
      return { ok: false, error: 'That car is not available.' };
    }

    if (!playerOwnsVehicleItem(player, item.id)) {
      return { ok: false, error: `You do not own the ${item.label}.` };
    }

    selectPlayerVehicleItem(player, item.id);
    player.skating = false;
    this.emit();
    return {
      ok: true,
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

      const radius = getMarthaPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getMarthaAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot buy that right now.' };
    }

    const npc = this.getMarthaNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to Martha.' };
    }

    return { ok: true, player, npc };
  }

  async buyMarthaItem(npcId = '', itemId = '') {
    const access = this.getMarthaAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const item = getMarthaMenuItem(itemId);
    if (!item) {
      return { ok: false, error: "That is not on Martha's menu." };
    }

    const money = Math.trunc(Number(access.player.money ?? 0) || 0);
    if (money < item.price) {
      this.setNpcChatPhase(access.npc, 'done', `${item.label} costs $${item.price}. Come back with cash.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${item.price} for ${item.label.toLowerCase()}.` };
    }

    access.player.money = money - item.price;
    const inventoryCount = addPlayerMarthaItem(access.player, item.id, 1);
    this.setNpcChatPhase(access.npc, 'done', item.orderLine, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      item: {
        id: item.id,
        label: item.label,
        price: item.price,
        count: inventoryCount
      },
      inventory: getPlayerMarthaInventorySnapshot(access.player),
      money: access.player.money
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

  async consumeInventoryItem(itemId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot use that right now.' };
    }

    const now = Date.now();
    const pawnItem = getPawnShopMenuItem(itemId);
    const marthaItem = getMarthaMenuItem(itemId);
    const isFoodItem = marthaItem?.kind === 'consumable';
    const isDrinkItem = !isFoodItem && (!pawnItem || pawnItem.kind !== 'consumable');
    let previousDrunknessLevel = 0;
    if (isDrinkItem) {
      refreshPlayerDrunkness(player, now);
      previousDrunknessLevel = player.drunknessLevel;
    }

    const result = isFoodItem
      ? consumePlayerMarthaItem(player, itemId)
      : pawnItem?.kind === 'consumable'
        ? consumePlayerPawnShopItem(player, itemId)
        : consumePlayerDrink(player, itemId, now);
    if (!result.ok) {
      return result;
    }

    const skillAward = isDrinkItem
      ? this.awardCharismaForDrink(player, result, previousDrunknessLevel)
      : null;
    this.emit();
    if (!skillAward) {
      return result;
    }
    const nextResult = clonePlainObject(result);
    nextResult.skillAward = skillAward;
    return nextResult;
  }

  async completeVibeHero(songId = '', result = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot finish Vibe Hero right now.' };
    }

    const normalizedSongId = normalizeVibeHeroSongId(songId);
    const score = Math.max(0, Math.floor(Number(result?.score ?? 0) || 0));
    const skillAward = this.awardPlayerSkillXp(player, SKILL_IDS.charisma, CHARISMA_VIBE_HERO_XP);
    this.emit();
    return {
      ok: true,
      songId: normalizedSongId,
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

      const radius = getBlackjackPromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getBlackjackAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot play blackjack right now.' };
    }

    const npc = this.getBlackjackDealerForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to a blackjack dealer.' };
    }

    return { ok: true, player, npc };
  }

  settleBlackjackSession(session, npc) {
    const player = this.state.players.get(this.state.sessionId);
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

  async startBlackjack(npcId = '', wagerValue = 0) {
    const access = this.getBlackjackAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const wager = normalizeBlackjackWager(wagerValue);
    const money = Math.trunc(Number(access.player.money ?? 0) || 0);
    if (wager > money) {
      return {
        ok: false,
        error: `You need ${wager > BLACKJACK_MAX_WAGER ? `$${BLACKJACK_MAX_WAGER} or less` : 'more cash'} for that wager.`
      };
    }

    access.player.money = money - wager;
    const session = createBlackjackSession({
      npcId: access.npc.id,
      wager,
      now: Date.now()
    });
    session.settled = false;
    this.blackjackSessions.set(this.state.sessionId, session);
    this.settleBlackjackSession(session, access.npc);
    this.emit();
    return {
      ok: true,
      blackjack: serializeBlackjackSession(session, { money: access.player.money }),
      money: access.player.money
    };
  }

  async handleBlackjackAction(npcId = '', action = '') {
    const access = this.getBlackjackAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const session = this.blackjackSessions.get(this.state.sessionId);
    if (!session || session.npcId !== access.npc.id) {
      return { ok: false, error: 'Deal a new blackjack hand first.' };
    }

    if (session.phase === 'playerTurn') {
      if (action === 'hit') {
        hitBlackjackSession(session);
      } else if (action === 'stand') {
        standBlackjackSession(session);
      } else if (action === 'double') {
        const money = Math.trunc(Number(access.player.money ?? 0) || 0);
        const extraWager = getBlackjackDoubleWager(session);
        if (!canDoubleBlackjackSession(session, money)) {
          return {
            ok: false,
            error: extraWager > money
              ? 'You need enough cash to double.'
              : 'Double is only available on the first two cards.'
          };
        }
        access.player.money = money - extraWager;
        doubleBlackjackSession(session);
      } else if (action === 'split') {
        const money = Math.trunc(Number(access.player.money ?? 0) || 0);
        const splitWager = getBlackjackSplitWager(session);
        if (!canSplitBlackjackSession(session, money)) {
          return {
            ok: false,
            error: splitWager > money
              ? 'You need enough cash to split.'
              : 'Split is only available when the first two cards are a pair.'
          };
        }
        access.player.money = money - splitWager;
        splitBlackjackSession(session);
      } else {
        return { ok: false, error: 'That blackjack action is not available.' };
      }
      this.settleBlackjackSession(session, access.npc);
    }

    this.emit();
    return {
      ok: true,
      blackjack: serializeBlackjackSession(session, { money: access.player.money }),
      money: access.player.money
    };
  }

  async hitBlackjack(npcId = '') {
    return this.handleBlackjackAction(npcId, 'hit');
  }

  async standBlackjack(npcId = '') {
    return this.handleBlackjackAction(npcId, 'stand');
  }

  async doubleBlackjack(npcId = '') {
    return this.handleBlackjackAction(npcId, 'double');
  }

  async splitBlackjack(npcId = '') {
    return this.handleBlackjackAction(npcId, 'split');
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

      const radius = getSchoolMicrogamePromptRadius(npc);
      const distanceSq = distanceSquared2D(player.x, player.z, npc.x, npc.z);
      if (distanceSq <= radius * radius && distanceSq < nearestDistanceSq) {
        nearest = npc;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  getSchoolMicrogameAccess(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot play school games right now.' };
    }

    const npc = this.getSchoolMicrogameNpcForPlayer(player, npcId);
    if (!npc) {
      return { ok: false, error: 'Move closer to a school NPC.' };
    }

    return { ok: true, player, npc };
  }

  async completeSchoolMicrogame(npcId = '', gameId = '', _result = {}) {
    const access = this.getSchoolMicrogameAccess(npcId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const normalizedGameId = normalizeSchoolMicrogameId(gameId, '');
    if (!normalizedGameId || normalizedGameId === SCHOOL_MICROGAME_ALL_ID) {
      return { ok: false, error: 'That school game is not available.' };
    }
    const npcGameId = normalizeSchoolMicrogameId(access.npc.schoolMicrogameId, SCHOOL_MICROGAME_ALL_ID);
    if (npcGameId !== SCHOOL_MICROGAME_ALL_ID && npcGameId !== normalizedGameId) {
      return { ok: false, error: 'That school game is not available here.' };
    }

    const reward = getSchoolMicrogameReward(normalizedGameId);
    const moneyAwarded = 0;
    const skillAward = this.awardPlayerSkillXp(access.player, SKILL_IDS.intelligence, reward.xp);
    access.player.schoolTasksCompletedCount = Math.max(
      0,
      Math.floor(Number(access.player.schoolTasksCompletedCount ?? 0) || 0)
    ) + 1;
    this.normalizePlayerSelectedMission(access.player);
    const rewardText = reward.xp > 0 ? `+${reward.xp} Intelligence XP` : '';
    this.setNpcChatPhase(
      access.npc,
      'done',
      `Nice work. ${rewardText}.`,
      { bumpSeq: true }
    );
    this.emit();
    return {
      ok: true,
      gameId: normalizedGameId,
      money: access.player.money,
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

  getOfficeJobAccess(placementId = '', jobId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot work office jobs right now.' };
    }

    const job = getOfficeJobDefinition(jobId);
    if (!job) {
      return { ok: false, error: 'That office job is not available.' };
    }

    const terminal = this.getOfficeJobComputerForPlayer(player, placementId, job.id);
    if (!terminal) {
      return { ok: false, error: 'Move closer to the office station.' };
    }

    return { ok: true, player, terminal, job };
  }

  async completeOfficeJob(placementId = '', jobId = '', _result = {}) {
    const access = this.getOfficeJobAccess(placementId, jobId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    const job = access.job;
    if (!job) {
      return { ok: false, error: 'That office job is not available.' };
    }

    const intelligenceLevel = getPlayerOfficeJobIntelligenceLevel(access.player);
    const charismaLevel = getSkillLevelFromXp(getPlayerSkillXp(access.player, SKILL_IDS.charisma));
    const strengthLevel = getSkillLevelFromXp(getPlayerSkillXp(access.player, SKILL_IDS.strength));
    if (!canPlayerWorkOfficeJob(intelligenceLevel, job, charismaLevel, strengthLevel)) {
      return { ok: false, error: getOfficeJobLockedMessage(job, { intelligenceLevel, charismaLevel, strengthLevel }) };
    }

    const reward = getOfficeJobReward(job.id);
    const moneyAwarded = Math.max(0, Math.trunc(Number(reward.money ?? 0) || 0));
    access.player.money = Math.trunc(Number(access.player.money ?? 0) || 0) + moneyAwarded;
    const skillAward = reward.xp > 0
      ? this.awardPlayerSkillXp(access.player, reward.skill, reward.xp)
      : null;
    if (job.id === OFFICE_JOB_IDS.janitor) {
      access.player.janitorTasksCompletedCount = Math.max(
        0,
        Math.floor(Number(access.player.janitorTasksCompletedCount ?? 0) || 0)
      ) + 1;
      this.normalizePlayerSelectedMission(access.player);
    } else if (job.id === OFFICE_JOB_IDS.officeManager) {
      access.player.officeManagerCompletedAt = Date.now();
      this.normalizePlayerSelectedMission(access.player);
    } else if (job.id === OFFICE_JOB_IDS.ceo) {
      access.player.ceoCompletedAt = Date.now();
      this.normalizePlayerSelectedMission(access.player);
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
    this.emit();
    return {
      ok: true,
      jobId: job.id,
      gameId: job.gameId,
      placementId: access.terminal.id,
      money: access.player.money,
      moneyAwarded,
      xp: reward.xp,
      ceoCompletedAt: access.player.ceoCompletedAt,
      message: rewardText,
      skillAward
    };
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

  async buyGymMembership(npcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot buy that right now.' };
    }

    if (player.gymMembershipActive === true) {
      return { ok: true, alreadyOwned: true, money: player.money ?? 0 };
    }

    const normalizedNpcId = typeof npcId === 'string'
      ? npcId.trim()
      : '';
    const npc = this.state.npcs.get(normalizedNpcId);
    if (!npc || !isGymCheckInNpc(npc)) {
      return { ok: false, error: 'That gym check-in is not available.' };
    }

    if (!this.isPlayerInGymCheckInPurchaseRadius(player, npc)) {
      return { ok: false, error: 'Move closer to the gym check-in.' };
    }

    const money = Math.trunc(Number(player.money ?? 0) || 0);
    if (money < GYM_MEMBERSHIP_COST) {
      this.setNpcChatPhase(npc, 'done', `Bring $${GYM_MEMBERSHIP_COST} and I can get you checked in.`, { bumpSeq: true });
      this.emit();
      return { ok: false, error: `You need $${GYM_MEMBERSHIP_COST} for a gym membership.` };
    }

    player.money = money - GYM_MEMBERSHIP_COST;
    player.gymMembershipActive = true;
    this.setNpcChatPhase(npc, 'done', GYM_CHECK_IN_PURCHASED_LINE, { bumpSeq: true });
    this.emit();
    return {
      ok: true,
      cost: GYM_MEMBERSHIP_COST,
      money: player.money,
      gymMembershipActive: true
    };
  }

  async acceptDeliveryQuest(giverNpcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot accept that right now.' };
    }

    const normalizedGiverNpcId = typeof giverNpcId === 'string'
      ? giverNpcId.trim()
      : '';
    const giver = this.state.npcs.get(normalizedGiverNpcId);
    if (
      !giver
      || !isNpcAvailableForDelivery(giver)
      || !isDeliveryQuestGiver(normalizedGiverNpcId, giver)
    ) {
      return { ok: false, error: 'That delivery job is not available.' };
    }

    if (!this.isPlayerInNpcInteractRadius(player, giver)) {
      return { ok: false, error: 'Move closer to accept the delivery.' };
    }

    if (isDeliveryQuestActive(player)) {
      const activeTarget = this.state.npcs.get(player.deliveryQuestTargetNpcId);
      return {
        ok: true,
        targetName: getDeliveryQuestTargetName(activeTarget),
        ...this.getDeliveryQuestPayload(player)
      };
    }

    const target = getDeliveryQuestTargetCandidate(this.state.npcs, normalizedGiverNpcId, {
      recentTargetNpcIds: player.deliveryQuestRecentTargetNpcIds
    });
    if (!target) {
      return { ok: false, error: 'There is nobody to deliver to yet.' };
    }

    const now = Date.now();
    player.deliveryQuestId = DELIVERY_QUEST_ID;
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.active;
    player.deliveryQuestGiverNpcId = normalizedGiverNpcId;
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
    this.emit();

    return {
      ok: true,
      targetName,
      ...this.getDeliveryQuestPayload(player)
    };
  }

  async completeDeliveryQuest(targetNpcId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot deliver that right now.' };
    }

    if (!isDeliveryQuestActive(player)) {
      return { ok: false, error: 'You do not have a delivery to complete.' };
    }

    const normalizedTargetNpcId = typeof targetNpcId === 'string'
      ? targetNpcId.trim()
      : '';
    if (normalizedTargetNpcId !== player.deliveryQuestTargetNpcId) {
      return { ok: false, error: 'That is not the delivery contact.' };
    }

    const target = this.state.npcs.get(normalizedTargetNpcId);
    if (!target || !isNpcAvailableForDelivery(target)) {
      return { ok: false, error: 'The delivery contact is not available.' };
    }

    if (!this.isPlayerInNpcInteractRadius(player, target)) {
      return { ok: false, error: 'Move closer to deliver the package.' };
    }

    const now = Date.now();
    player.deliveryQuestStatus = DELIVERY_QUEST_STATUS.completed;
    player.deliveryQuestCompletedAt = now;
    player.deliveryQuestRecentTargetNpcIds = addDeliveryQuestRecentTargetId(
      player.deliveryQuestRecentTargetNpcIds,
      normalizedTargetNpcId
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
    this.emit();

    return {
      ok: true,
      targetName: getDeliveryQuestTargetName(target),
      ...this.getDeliveryQuestPayload(player)
    };
  }

  async claimWorkoutPlacement(placementId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot use that right now.' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    const target = this.getNpcTargetOption(normalizedPlacementId);
    if (!normalizedPlacementId || !target?.workoutType) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    if (player.workoutPlacementId === normalizedPlacementId) {
      return { ok: true, placementId: normalizedPlacementId };
    }

    if (this.isWorkoutPlacementOccupied(normalizedPlacementId, { ignorePlayerId: this.state.sessionId })) {
      return { ok: false, error: 'That station is already in use.' };
    }

    player.workoutPlacementId = normalizedPlacementId;
    this.emit();
    return { ok: true, placementId: normalizedPlacementId };
  }

  async completeWorkoutPlacement(placementId = '', result = {}) {
    const player = this.state.players.get(this.state.sessionId);
    if (!player || player.alive === false) {
      return { ok: false, error: 'You cannot complete that workout right now.' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    const target = this.getNpcTargetOption(normalizedPlacementId);
    if (!normalizedPlacementId || !target?.workoutType) {
      return { ok: false, error: 'That workout station is not available.' };
    }

    if (player.workoutPlacementId !== normalizedPlacementId) {
      return { ok: false, error: 'That workout is not active.' };
    }

    const awardXp = result?.awardXp !== false;
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
    this.emit();
    return {
      ok: true,
      placementId: normalizedPlacementId,
      gymPumpCompletedAt: player.gymPumpCompletedAt,
      skillAward: skillAwards[0] ?? null,
      skillAwards
    };
  }

  async releaseWorkoutPlacement(placementId = '') {
    const player = this.state.players.get(this.state.sessionId);
    if (!player) {
      return { ok: true, placementId: '' };
    }

    const normalizedPlacementId = typeof placementId === 'string'
      ? placementId.trim()
      : '';
    if (!normalizedPlacementId || player.workoutPlacementId === normalizedPlacementId) {
      player.workoutPlacementId = '';
      this.emit();
    }

    return { ok: true, placementId: player.workoutPlacementId || '' };
  }

  startReload(player, { emitEvent = true } = {}) {
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

    player.isReloading = true;
    player.reloadEndsAt = Date.now() + WEAPON_RELOAD_MS;
    if (emitEvent) {
      this.emitCombatEvent({
        type: 'reload',
        playerId: this.state.sessionId,
        weaponId: player.equippedWeaponId,
        startedAt: Date.now(),
        endsAt: player.reloadEndsAt
      });
      this.emit();
    }
    return true;
  }

  updateCombatTimers() {
    const now = Date.now();
    const deltaMs = Math.max(16, now - this.lastNpcSimulationAt);
    this.lastNpcSimulationAt = now;
    let stateChanged = false;

    for (const sessionId of this.state.players.keys()) {
      const player = this.state.players.get(sessionId);
      if (player.isReloading && player.reloadEndsAt && now >= player.reloadEndsAt) {
        this.completeReload(player);
        stateChanged = true;
      }

      if (player.alive === false && player.respawnAt && now >= player.respawnAt) {
        this.finishRespawn(sessionId, player);
        stateChanged = true;
        continue;
      }

      stateChanged = this.updatePlayerHealthRegen(sessionId, player, now, deltaMs) || stateChanged;
      stateChanged = refreshPlayerDrunkness(player, now) || stateChanged;
    }

    for (const pickup of this.state.pickups.values()) {
      if (!pickup.active && pickup.kind === 'spawn' && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.active = true;
        pickup.respawnAt = 0;
        stateChanged = true;
      }

      if (!pickup.active && pickup.kind === 'drop' && pickup.despawnAt && now >= pickup.despawnAt) {
        this.state.pickups.delete(pickup.id);
        stateChanged = true;
      }
    }

    stateChanged = this.updateNpcSimulation(now, deltaMs) || stateChanged;

    if (stateChanged) {
      this.emit();
    }
  }

  completeReload(player) {
    const needed = Math.max(0, WEAPON_CLIP_SIZE - player.ammoInClip);
    const loaded = Math.min(needed, player.reserveAmmo);
    player.ammoInClip += loaded;
    player.reserveAmmo -= loaded;
    player.isReloading = false;
    player.reloadEndsAt = 0;
  }

  chooseHospitalRespawnPoint() {
    return getHospitalRespawnPoint(this.worldState, getBuilderItemById);
  }

  playDrJoeRespawnLine(spawn) {
    const npc = findDrJoeRespawnNpc(this.state.npcs, spawn);
    if (!npc) {
      return '';
    }

    const line = getRandomDrJoeRespawnLine();
    npc.busy = false;
    this.setNpcChatPhase(npc, 'done', line, { bumpSeq: true });
    this.appendTranscript(
      npc.id,
      makeTranscriptEntry(`local_${++this.sequence}`, 'npc', npc.name, line)
    );
    return line;
  }

  finishRespawn(sessionId, player) {
    const spawn = this.chooseHospitalRespawnPoint();
    player.x = quantizePosition(spawn.x);
    player.y = 0;
    player.z = quantizePosition(spawn.z);
    player.rotationY = quantizeRotation(spawn.rotationY);
    player.aimRotationY = player.rotationY;
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
    player.lastPunchAt = 0;
    player.lastPunchComboStep = 0;
    player.lastShotAt = 0;
    this.getPlayerRuntimeMeta(sessionId).healthRegenCarryMs = 0;
    player.emoteId = '';
    player.emoteActive = false;
    player.emoteStartedAt = 0;
    player.emoteSeq += 1;
    player.money = Math.trunc(Number(player.money ?? 0) || 0) - PLAYER_RESPAWN_COST;
    const drJoeLine = this.playDrJoeRespawnLine(spawn);
    this.emitCombatEvent({
      type: 'respawn',
      playerId: sessionId,
      x: player.x,
      z: player.z,
      rotationY: player.rotationY,
      drJoeLine
    });
  }

  handlePlayerDeath(playerId, killerId = '') {
    const player = this.state.players.get(playerId);
    if (!player || player.alive === false) {
      return;
    }

    this.getPlayerRuntimeMeta(playerId).healthRegenCarryMs = 0;

    player.alive = false;
    player.health = 0;
    player.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
    player.skating = false;
    player.isReloading = false;
    player.reloadEndsAt = 0;
    player.deaths += 1;
    player.workoutPlacementId = '';
    player.emoteId = 'limp';
    player.emoteActive = true;
    player.emoteStartedAt = Date.now();
    player.emoteSeq += 1;
    this.clearNpcHostilityForPlayer(playerId, { reason: 'player-death' });

    if (killerId && killerId !== playerId) {
      const killer = this.state.players.get(killerId);
      if (killer) {
        killer.kills += 1;
        this.triggerPoliceHostilityForPlayer(killerId, killer, 'player-kill', Date.now());
      }
    }

    this.dropWeaponPickup(player);
    player.equippedWeaponId = '';
    player.ownedWeaponIds = '';
    player.ammoInClip = 0;
    player.reserveAmmo = 0;
    this.emitCombatEvent({
      type: 'death',
      victimId: playerId,
      killerId,
      x: player.x,
      z: player.z
    });
  }

  dropWeaponPickup(player) {
    const totalAmmo = player.ammoInClip + player.reserveAmmo;
    const weaponId = player.equippedWeaponId || (hasInventoryWeapon(player.ownedWeaponIds, WEAPON_IDS.pistol) ? WEAPON_IDS.pistol : '');
    if (!weaponId || totalAmmo <= 0) {
      return;
    }

    const id = `pickup_drop_${++this.pickupSequence}`;
    this.state.pickups.set(id, {
      id,
      weaponId,
      x: player.x,
      z: player.z,
      ammoInClip: player.ammoInClip,
      reserveAmmo: player.reserveAmmo,
      kind: 'drop',
      active: true,
      respawnAt: 0,
      despawnAt: Date.now() + DROPPED_PICKUP_DESPAWN_MS
    });
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
      x: Number.isFinite(origin?.x) ? Number(origin.x) : player.x,
      z: Number.isFinite(origin?.z) ? Number(origin.z) : player.z
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

    const passiveTrafficHit = this.resolvePassiveTrafficShot(origin, aim, nearestDistance);
    if (passiveTrafficHit && passiveTrafficHit.distance < nearestDistance) {
      nearestDistance = passiveTrafficHit.distance;
      result = {
        kind: 'passiveTraffic',
        hitX: origin.x + aim.x * passiveTrafficHit.distance,
        hitZ: origin.z + aim.z * passiveTrafficHit.distance,
        targetId: passiveTrafficHit.carId
      };
    }

    for (const id of this.state.players.keys()) {
      const target = this.state.players.get(id);
      if (id === ignorePlayerId || target.alive === false) {
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
        targetId: id
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

  resolvePassiveTrafficShot(origin, aim, maxDistance) {
    let nearest = null;
    for (const car of this.state.passiveTraffic.values()) {
      if (
        !car
        || car.itemId !== PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID
        || car.active === false
        || this.passiveTrafficSimulation.isCarDisabled(car.id)
      ) {
        continue;
      }

      const hitDistance = rayPassiveTrafficHitboxIntersectionDistance(
        origin,
        aim,
        maxDistance,
        { x: car.x, z: car.z },
        car.rotationY,
        0.12
      );
      if (hitDistance == null || hitDistance >= maxDistance || (nearest && hitDistance >= nearest.distance)) {
        continue;
      }

      nearest = {
        carId: car.id,
        distance: hitDistance
      };
    }
    return nearest;
  }

  handlePoliceCarShot(carId = '', shooterSessionId = '', now = Date.now()) {
    const disabledCar = this.passiveTrafficSimulation.disablePoliceCar(carId);
    if (!disabledCar) {
      return false;
    }

    this.spawnPoliceCarResponseOfficers(disabledCar, shooterSessionId, now);
    this.publishPassiveTrafficSnapshots(this.passiveTrafficSimulation.getSnapshots());
    return true;
  }

  resolveShot(playerId, player, aim, origin = player) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignorePlayerId: playerId
    });
  }

  resolveShotFromNpc(npcId, npc, aim, origin = npc) {
    return this.resolveCombatShot(origin, aim, WEAPON_RANGE, {
      ignoreNpcId: npcId
    });
  }

  resolvePunchAimAssist(origin, aim, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    const targets = [];

    for (const [sessionId, target] of this.state.players.entries()) {
      if (sessionId === ignorePlayerId || target.alive === false) {
        continue;
      }

      targets.push({
        kind: 'player',
        targetId: sessionId,
        x: target.x,
        z: target.z,
        radius: PLAYER_RADIUS
      });
    }

    for (const [npcId, target] of this.state.npcs.entries()) {
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      targets.push({
        kind: 'npc',
        targetId: npcId,
        x: target.x,
        z: target.z,
        radius: model?.collider?.radius ?? PLAYER_RADIUS * 0.9
      });
    }

    return chooseAimAssistTarget(origin, aim, targets, {
      maxDistance: PUNCH_RANGE,
      maxAngleRad: PUNCH_TARGET_ASSIST_MAX_ANGLE_RAD,
      rangeBonus: PUNCH_TARGET_ASSIST_RANGE_BONUS,
      capsuleRadius: PUNCH_HITBOX_RADIUS
    });
  }

  resolveCombatPunch(origin, aim, maxDistance, {
    ignorePlayerId = '',
    ignoreNpcId = ''
  } = {}) {
    const punchOrigin = {
      x: origin.x + (aim.x * PUNCH_HIT_ORIGIN_FORWARD_OFFSET),
      z: origin.z + (aim.z * PUNCH_HIT_ORIGIN_FORWARD_OFFSET)
    };
    const punchDistance = Math.max(0.5, maxDistance - PUNCH_HIT_ORIGIN_FORWARD_OFFSET);
    let nearestDistance = punchDistance;
    let result = {
      kind: 'miss',
      hitX: punchOrigin.x + aim.x * punchDistance,
      hitZ: punchOrigin.z + aim.z * punchDistance,
      targetId: ''
    };

    this.worldState.forEachPlacementCollisionRect(({ placementId, rect }) => {
      const hitDistance = rayRectIntersectionDistance(punchOrigin.x, punchOrigin.z, aim.x, aim.z, nearestDistance, rect);
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
        hitX: punchOrigin.x + aim.x * hitDistance,
        hitZ: punchOrigin.z + aim.z * hitDistance,
        targetId: placementId
      };
    }, { collisionKey: 'blocksShots' });

    for (const sessionId of this.state.players.keys()) {
      const target = this.state.players.get(sessionId);
      if (sessionId === ignorePlayerId || target.alive === false) {
        continue;
      }

      const hit = capsuleCircleIntersection(
        punchOrigin.x,
        punchOrigin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        PLAYER_RADIUS,
        PUNCH_HITBOX_RADIUS
      );
      if (hit == null || hit.distance >= nearestDistance) {
        continue;
      }

      nearestDistance = hit.distance;
      result = {
        kind: 'player',
        hitX: hit.hitX,
        hitZ: hit.hitZ,
        targetId: sessionId
      };
    }

    for (const npcId of this.state.npcs.keys()) {
      const target = this.state.npcs.get(npcId);
      if (npcId === ignoreNpcId || target.alive === false || target.mode === NPC_RUNTIME_MODES.hidden) {
        continue;
      }

      const model = getNpcModelById(target.modelId);
      const hit = capsuleCircleIntersection(
        punchOrigin.x,
        punchOrigin.z,
        aim.x,
        aim.z,
        nearestDistance,
        target.x,
        target.z,
        model?.collider?.radius ?? PLAYER_RADIUS * 0.9,
        PUNCH_HITBOX_RADIUS
      );
      if (hit == null || hit.distance >= nearestDistance) {
        continue;
      }

      nearestDistance = hit.distance;
      result = {
        kind: 'npc',
        hitX: hit.hitX,
        hitZ: hit.hitZ,
        targetId: npcId
      };
    }

    return result;
  }

  resolvePunch(attackerId, player, aim) {
    const options = {
      ignorePlayerId: attackerId
    };
    const directHit = this.resolveCombatPunch(player, aim, PUNCH_RANGE, options);
    if (directHit.kind !== 'miss') {
      return directHit;
    }

    const assistedAim = this.resolvePunchAimAssist(player, aim, options);
    if (!assistedAim) {
      return directHit;
    }

    const assistedHit = this.resolveCombatPunch(player, assistedAim, PUNCH_RANGE, options);
    if (assistedHit.kind === assistedAim.kind && assistedHit.targetId === assistedAim.targetId) {
      return {
        ...assistedHit,
        assisted: true
      };
    }

    return directHit;
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

    this.emitCombatEvent({
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
      this.emitCombatEvent({
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
    setTimeout(() => {
      this.resolveNpcPunchImpact(npcId, aim, now);
    }, PUNCH_HIT_DELAY_MS);
  }

  resolveNpcPunchImpact(npcId, aim, clientPunchAt = Date.now()) {
    const npc = this.state.npcs.get(npcId);
    if (!npc || npc.alive === false) {
      return;
    }

    const now = Date.now();
    const hit = this.resolvePunchFromNpc(npcId, { x: npc.x, z: npc.z }, aim);

    if (hit.kind !== 'miss') {
      this.emitCombatEvent({
        type: 'impact',
        shooterType: 'npc',
        shooterId: npcId,
        attackType: 'punch',
        kind: hit.kind,
        targetId: hit.targetId ?? '',
        x: hit.hitX,
        z: hit.hitZ,
        hitReaction: getRandomPunchHitReaction(),
        clientPunchAt
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
      }
    }

    if (hit.kind === 'npc' && hit.targetId) {
      this.applyDamageToNpc(hit.targetId, PUNCH_DAMAGE, npcId, now);
    }
  }

  async destroy() {
    this.listeners.clear();
    this.worldPatchListeners.clear();
    this.combatListeners.clear();
    this.playerRuntimeMeta.clear();
    window.clearInterval(this.combatTick);
    window.clearInterval(this.passiveTrafficTick);
  }

  updatePlayerHealthRegen(sessionId, player, now, deltaMs) {
    if (!player || player.alive === false) {
      return false;
    }

    const meta = this.getPlayerRuntimeMeta(sessionId);
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

  isAdmin() {
    return this.state.players.get(this.state.sessionId)?.isAdmin === true;
  }
}

Object.assign(NpcServiceMock.prototype, npcSimulationMethods);
