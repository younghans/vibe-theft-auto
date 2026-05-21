import { readFileSync, statSync } from 'node:fs';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { BUILDER_TILE_SIZE } from '../src/shared/worldConstants.js';
import { PLAYER_RADIUS, WEAPON_CLIP_SIZE, WEAPON_IDS, WEAPON_RESERVE_CAP } from '../src/shared/combatConstants.js';
import {
  COMBAT_PICKUP_PROP_ITEM_IDS,
  getCombatPickupSpawnDefinitions
} from '../src/shared/combatPickupDefinitions.js';
import { placementToCollisionRects } from '../src/shared/combatMath.js';
import {
  getDefaultPropPlacementScale,
  getPlacementScale,
  isVehiclePropItemId,
  PROP_PLACEMENT_SCALE_MAX,
  PROP_PLACEMENT_SCALE_MIN,
  VEHICLE_PROP_PLACEMENT_SCALE,
  normalizePropPlacementScale
} from '../src/shared/placementScale.js';
import {
  getTileCenterWorldPosition,
  getTileFootprintWorldSize,
  getTileOccupiedCells,
  rotateFootprintOffset
} from '../src/shared/tileFootprint.js';
import {
  rotationEighthTurnsToRadians,
  rotationRadiansToQuarterTurns
} from '../src/shared/numberMath.js';
import {
  DRINK_ITEM_IDS,
  DRUNKNESS_LEVEL_LABELS,
  DRUNKNESS_MAX_DURATION_MS,
  addPlayerDrink,
  consumePlayerDrink,
  getBartenderMenuItem,
  getDrunknessDoseForLevel,
  getDrunknessDurationMs,
  getDrunknessLevelForDose,
  getDrunknessLevelLabel,
  getDrunknessLevelForTimeRemaining,
  isBartenderNpc,
  listBartenderMenuItems,
  refreshPlayerDrunkness
} from '../src/shared/bartender.js';
import {
  PAWN_SHOP_ITEM_IDS,
  addPlayerPawnShopItem,
  consumePlayerPawnShopItem,
  getPawnShopMenuItem,
  isPlayerPawnShopItemOwned,
  isPawnShopOwnerNpc,
  listPawnShopMenuItems
} from '../src/shared/pawnShop.js';
import {
  CAR_VEHICLE_SPEED_MULTIPLIER,
  CAR_DEALER_ITEM_IDS,
  getCarDealerMenuItem,
  getPlayerDefaultVehicleItemId,
  getPlayerOwnedVehicleItemIds,
  getPlayerOwnedVehicleMenuItems,
  getPlayerVehicleInventorySnapshot,
  getPlayerVehicleItemId,
  getVehicleModelGroundNodeNameParts,
  isCarDealerNpc,
  listCarDealerMenuItems,
  playerOwnsVehicleItem,
  selectPlayerVehicleItem,
  setPlayerVehicleItem
} from '../src/shared/carDealer.js';
import { snapObjectToGround } from '../src/shared/threeModelBounds.js';
import {
  SKATEBOARD_MODEL_COLORS,
  SKATEBOARD_MODEL_DIMENSIONS,
  createSkateboardModel
} from '../src/shared/skateboardModel.js';
import {
  MARTHA_ITEM_IDS,
  addPlayerMarthaItem,
  consumePlayerMarthaItem,
  getMarthaMenuItem,
  getPlayerMarthaInventorySnapshot,
  isMarthaNpc,
  listMarthaMenuItems
} from '../src/shared/martha.js';
import { SKATEBOARD_SPEED_MULTIPLIER, isPlayerSkateboardOwner } from '../src/shared/skateboard.js';
import {
  createHotbarSlots,
  getHotbarConsumableItemId,
  getHotbarDrinkItemId,
  moveHotbarItemOrderSlot
} from '../src/shared/hotbarInventory.js';
import { SMOKING_EMOTE_ID } from '../src/player/emotes.js';
import {
  VIBE_HERO_GAME_ID,
  VIBE_HERO_LANE_COUNT,
  VIBE_HERO_NOTE_TRAVEL_MS,
  listVibeHeroSongs
} from '../src/shared/vibeHero.js';
import { VIBE_HERO_EDITED_CHART_ROWS } from '../src/shared/vibeHeroEditedCharts.js';
import {
  NPC_COMBAT_ARCHETYPES,
  NPC_DEFAULT_LAW_RADIUS,
  getNpcLawRadius,
  isPoliceOfficerNpc,
  normalizeNpcBehavior
} from '../src/npc/npcBehavior.js';
import { getNpcModelById } from '../src/npc/npcCatalog.js';
import {
  RENT_INTRO_LINE,
  isRentIntroCollector,
  resolveRentIntroPlan
} from '../src/shared/rentIntro.js';
import {
  applyMarthaNpcBaseStyle,
  createMarthaNpcAdornment,
  shouldApplyMarthaNpcAdornment
} from '../src/npc/npcRenderUtils.js';
import { buildCity } from '../src/world/buildCity.js';
import { findNearestAdjacentPropSnapPoint } from '../src/world/builderPropSnap.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { getInteriorTemplateById } from '../src/world/InteriorScene.js';
import {
  BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT,
  BASKETBALL_HOOP_RIM_HEIGHT,
  BANK_LOBBY_TABLE_FOOTPRINT,
  BANK_SITTING_CHAIR_FOOTPRINT,
  BANK_TELLER_COUNTER_FOOTPRINT,
  CAR_DEALERSHIP_BUILDING_FOOTPRINT,
  DIRT_PATH_PROP_FOOTPRINT,
  INSTRUMENT_CLUSTER_FOOTPRINT,
  MARTHAS_GRILLE_BUILDING_FOOTPRINT,
  OLYMPIC_BARBELL_FOOTPRINT,
  REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT,
  SIDEWALK_PROP_FOOTPRINT,
  STONE_PATH_PROP_FOOTPRINT,
  TREADMILL_FOOTPRINT,
  VIBE_JAM_PORTAL_INTERACTABLE
} from '../src/world/proceduralProps.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import { assets } from '../src/world/assetManifest.js';
import {
  PASSIVE_TRAFFIC_CAR_ITEM_IDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_HITBOX_SCALE,
  PASSIVE_TRAFFIC_CAR_SCALE,
  PASSIVE_TRAFFIC_DRIVE_COMMANDS,
  PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH,
  PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH,
  PASSIVE_TRAFFIC_LANE_OFFSET,
  PASSIVE_TRAFFIC_MAX_TURN_RADIANS,
  PASSIVE_TRAFFIC_PLAYER_COLLISION_DAMAGE,
  PASSIVE_TRAFFIC_PLAYER_STUN_SECONDS,
  PASSIVE_TRAFFIC_SPEED,
  buildPassiveTrafficRoadGraph,
  buildPassiveTrafficRouteLookahead,
  clampPassiveTrafficTurnYaw,
  clampPassiveTrafficPositionToRoadNodes,
  findPassiveTrafficPath,
  getPassiveTrafficDriveCommand,
  getPassiveTrafficDriveScript,
  getPassiveTrafficLanePosition,
  getPassiveTrafficLanePositionAtNode,
  getPassiveTrafficRouteNodeIndices,
  getPassiveTrafficRoadExits,
  getPassiveTrafficTurnLaneWaypointsFromPosition,
  getPassiveTrafficTurnYawRange,
  getPassiveTrafficTurnLaneWaypoints,
  isPointInsidePassiveTrafficHitbox,
  isPassiveTrafficCrosswalkNode,
  isPassiveTrafficJunctionNode,
  isPassiveTrafficPositionInsideRoadNode,
  passiveTrafficHitboxesOverlap
} from '../src/world/passiveTraffic.js';
import { PassiveTrafficSimulation } from '../src/world/passiveTrafficSimulation.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_IDS,
  applyAttachmentTransform,
  getHeldItemDefinition
} from '../src/shared/heldItemDefinitions.js';
import {
  DELIVERY_QUEST_ID,
  DELIVERY_QUEST_STATUS
} from '../src/shared/deliveryQuest.js';
import { TASK_IDS, TaskTracker, resolvePlayerTask } from '../src/game/TaskTracker.js';
import {
  BASKETBALL_SHOT_DURATION_MS,
  BASKETBALL_SHOT_WORKOUT_KIND,
  SNATCH_WORKOUT_KIND,
  TREADMILL_DURATION_MS,
  TREADMILL_WORKOUT_KIND
} from '../src/game/workoutActivities.js';
import {
  CHARISMA_LEVEL_MISSION_DESCRIPTION,
  CHARISMA_LEVEL_MISSION_TARGET_LEVEL,
  FOUR_MORE_WHEELS_LEGACY_MISSION_ID,
  FOUR_MORE_WHEELS_MISSION_TITLE,
  JANITOR_TASKS_REQUIRED,
  MISSION_CATALOG,
  MISSION_SEQUENCE_SECTIONS,
  MISSION_STATUS,
  SCHOOL_TEACHER_TASKS_REQUIRED,
  appendMissionSequencePromptEntry,
  getMissionSnapshots,
  getMissionSequenceViewModel,
  moveMissionSequenceEntry,
  normalizeMissionSequenceConfig,
  updateMissionSequenceEntry
} from '../src/shared/missions.js';
import { getNpcModelVoice } from '../src/shared/npcVoice.js';
import { getSkillXpForLevel } from '../src/shared/skills.js';
import { WorldState } from '../src/world/WorldState.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readGlbJson(relativePath) {
  const buffer = readFileSync(new URL(`../${relativePath}`, import.meta.url));
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${relativePath} should be a GLB file`);

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    offset += 4;
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    offset += 4;
    if (chunkType === 'JSON') {
      return JSON.parse(buffer.toString('utf8', offset, offset + chunkLength).trim());
    }
    offset += chunkLength;
  }

  throw new Error(`${relativePath} should contain a JSON chunk`);
}

function readGlbNodeNames(relativePath) {
  const json = readGlbJson(relativePath);
  const nodeNames = new Set();
  for (const node of json.nodes ?? []) {
    if (node.name) {
      nodeNames.add(node.name);
    }
  }
  return nodeNames;
}

function getGlbNodeByName(json, nodeName) {
  for (const node of json.nodes ?? []) {
    if (node.name === nodeName) {
      return node;
    }
  }
  return null;
}

function getGlbMaterialNames(json) {
  const materialNames = new Set();
  for (const material of json.materials ?? []) {
    if (material.name) {
      materialNames.add(material.name);
    }
  }
  return materialNames;
}

function getGlbNodeNameSet(json) {
  const nodeNames = new Set();
  for (const node of json.nodes ?? []) {
    if (node.name) {
      nodeNames.add(node.name);
    }
  }
  return nodeNames;
}

function isGlbNodeQuarterTurnAroundY(node) {
  const rotation = node?.rotation;
  if (Array.isArray(rotation) && rotation.length === 4) {
    const expected = Math.SQRT1_2;
    return Math.abs(Math.abs(rotation[1]) - expected) < 0.02
      && Math.abs(Math.abs(rotation[3]) - expected) < 0.02
      && Math.abs(rotation[0]) < 0.02
      && Math.abs(rotation[2]) < 0.02;
  }

  const matrix = node?.matrix;
  if (Array.isArray(matrix) && matrix.length === 16) {
    return Math.abs(matrix[0]) < 0.02
      && Math.abs(matrix[10]) < 0.02
      && Math.abs(Math.abs(matrix[2]) - 1) < 0.02
      && Math.abs(Math.abs(matrix[8]) - 1) < 0.02
      && Math.abs(matrix[1]) < 0.02
      && Math.abs(matrix[4]) < 0.02
      && Math.abs(matrix[6]) < 0.02
      && Math.abs(matrix[9]) < 0.02;
  }

  return false;
}

function getGlbNodeYBounds(json, node) {
  const mesh = Number.isInteger(node?.mesh) ? json.meshes?.[node.mesh] : null;
  if (!mesh) {
    return null;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const primitive of mesh.primitives ?? []) {
    const positionAccessorIndex = primitive.attributes?.POSITION;
    const positionAccessor = Number.isInteger(positionAccessorIndex)
      ? json.accessors?.[positionAccessorIndex]
      : null;
    const primitiveMinY = Number(positionAccessor?.min?.[1]);
    const primitiveMaxY = Number(positionAccessor?.max?.[1]);
    if (Number.isFinite(primitiveMinY)) {
      minY = Math.min(minY, primitiveMinY);
    }
    if (Number.isFinite(primitiveMaxY)) {
      maxY = Math.max(maxY, primitiveMaxY);
    }
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  const matrix = node.matrix;
  const translationY = Array.isArray(matrix) && matrix.length === 16
    ? Number(matrix[13])
    : Number(node.translation?.[1] ?? 0);
  const matrixScaleY = Array.isArray(matrix) && matrix.length === 16
    ? Math.hypot(Number(matrix[1] ?? 0), Number(matrix[5] ?? 1), Number(matrix[9] ?? 0))
    : null;
  const scaleY = Number.isFinite(matrixScaleY) && matrixScaleY > 0
    ? matrixScaleY
    : Number(node.scale?.[1] ?? 1);

  return {
    minY: translationY + (minY * scaleY),
    maxY: translationY + (maxY * scaleY)
  };
}

function getGlbNodePatternYBounds(json, pattern) {
  const bounds = { minY: Infinity, maxY: -Infinity };
  for (const node of json.nodes ?? []) {
    if (!pattern.test(String(node.name ?? ''))) {
      continue;
    }
    const nodeBounds = getGlbNodeYBounds(json, node);
    if (!nodeBounds) {
      continue;
    }
    bounds.minY = Math.min(bounds.minY, nodeBounds.minY);
    bounds.maxY = Math.max(bounds.maxY, nodeBounds.maxY);
  }
  return Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxY) ? bounds : null;
}

function getGlbMaxPositionY(json) {
  let maxY = -Infinity;

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      const positionAccessor = Number.isInteger(positionAccessorIndex)
        ? json.accessors?.[positionAccessorIndex]
        : null;
      const primitiveMaxY = Number(positionAccessor?.max?.[1]);
      if (Number.isFinite(primitiveMaxY)) {
        maxY = Math.max(maxY, primitiveMaxY);
      }
    }
  }

  return maxY;
}

function readRepoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function getGlbNodeLocalScale(node) {
  if (Array.isArray(node?.scale)) {
    return node.scale;
  }

  if (Array.isArray(node?.matrix) && node.matrix.length === 16) {
    const matrix = node.matrix;
    return [
      Math.hypot(matrix[0], matrix[1], matrix[2]),
      Math.hypot(matrix[4], matrix[5], matrix[6]),
      Math.hypot(matrix[8], matrix[9], matrix[10])
    ];
  }

  return [1, 1, 1];
}

function collectMeshMaterials(root) {
  const entries = [];
  root.traverse?.((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      entries.push({ node, material });
    }
  });
  return entries;
}

function validateRotationQuarterTurns(value, context) {
  assert(Number.isInteger(value), `${context}: rotationQuarterTurns must be an integer`);
  assert(value >= 0 && value <= 3, `${context}: rotationQuarterTurns must be between 0 and 3`);
}

const CAR_DEALERSHIP_SHOWROOM_CAR_SCALE = VEHICLE_PROP_PLACEMENT_SCALE;
const CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_Z = 5.35;
const CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X = 5.9;
const CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X = 3.0;
const CAR_DEALERSHIP_DOOR_LOCAL_Z = 10.74;
const CAR_DEALERSHIP_DEALER_LOCAL_X = 0;
const CAR_DEALERSHIP_DEALER_LOCAL_Z = -5.75;
const CAR_DEALERSHIP_SHOWROOM_CARS = Object.freeze([
  {
    itemId: 'car_fiat_duna',
    label: 'Fiat Duna',
    localX: -CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X,
    doorTargetLocalX: -CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X
  },
  {
    itemId: 'car_toyota_ae86',
    label: 'Toyota AE86',
    localX: CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_X,
    doorTargetLocalX: CAR_DEALERSHIP_SHOWROOM_CAR_DOOR_TARGET_LOCAL_X
  }
]);

function angleDelta(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function normalizeQuarterTurnsFromRotationY(rotationY) {
  return ((Math.round(rotationY / (Math.PI / 2)) % 4) + 4) % 4;
}

function findPlacementByItemId(placements, itemId) {
  for (const placement of placements ?? []) {
    if (placement.itemId === itemId) {
      return placement;
    }
  }
  return null;
}

function hasPlacementWithItemId(placements, itemId) {
  return Boolean(findPlacementByItemId(placements, itemId));
}

function findNpcById(npcs, npcId) {
  for (const npc of npcs ?? []) {
    if (npc.id === npcId) {
      return npc;
    }
  }
  return null;
}

function findShowroomProp(layout, itemId, expectedPosition) {
  for (const placement of layout.props ?? []) {
    if (
      placement.itemId === itemId
      && Math.abs((placement.position?.[0] ?? Number.NaN) - expectedPosition[0]) <= 0.01
      && Math.abs((placement.position?.[1] ?? Number.NaN) - expectedPosition[1]) <= 0.01
    ) {
      return placement;
    }
  }
  return null;
}

function countVehicleProps(placements) {
  let count = 0;
  for (const placement of placements ?? []) {
    if (isVehiclePropItemId(placement.itemId)) {
      count += 1;
    }
  }
  return count;
}

function pushLetteredBuildingIds(target, prefix, variants) {
  for (const variant of variants) {
    target.push(`${prefix}${variant}`);
  }
}

function getGlbNodesByName(json, nodeName) {
  const matchingNodes = [];
  for (const node of json.nodes ?? []) {
    if (node.name === nodeName) {
      matchingNodes.push(node);
    }
  }
  return matchingNodes;
}

function countGlbTransparentPrimitivesUnderNode(json, nodeName) {
  const stack = [];
  for (let index = 0; index < (json.nodes ?? []).length; index += 1) {
    if (json.nodes[index]?.name === nodeName) {
      stack.push(index);
    }
  }

  let count = 0;
  while (stack.length) {
    const nodeIndex = stack.pop();
    const node = json.nodes?.[nodeIndex];
    for (const childIndex of node?.children ?? []) {
      stack.push(childIndex);
    }

    const mesh = Number.isInteger(node?.mesh) ? json.meshes?.[node.mesh] : null;
    for (const primitive of mesh?.primitives ?? []) {
      const material = Number.isInteger(primitive?.material) ? json.materials?.[primitive.material] : null;
      const colorFactor = material?.pbrMetallicRoughness?.baseColorFactor ?? [];
      const alpha = Number(colorFactor[3] ?? 1);
      if (material?.alphaMode === 'BLEND' && alpha < 1) {
        count += 1;
      }
    }
  }

  return count;
}

function getMaxCollisionRectY(rects) {
  let maxY = -Infinity;
  for (const rect of rects ?? []) {
    maxY = Math.max(maxY, rect.maxY ?? 0);
  }
  return maxY;
}

function getRectSpan(rects, axis) {
  const centerKey = axis === 'x' ? 'x' : 'z';
  const halfKey = axis === 'x' ? 'halfWidth' : 'halfDepth';
  let min = Infinity;
  let max = -Infinity;
  for (const rect of rects ?? []) {
    min = Math.min(min, rect[centerKey] - rect[halfKey]);
    max = Math.max(max, rect[centerKey] + rect[halfKey]);
  }
  return max - min;
}

function countBankTransparentGlassMaterials(materials) {
  let count = 0;
  for (const material of materials ?? []) {
    const colorFactor = material.pbrMetallicRoughness?.baseColorFactor ?? [];
    const alpha = Number(colorFactor[3] ?? 1);
    if (material.alphaMode === 'BLEND' && alpha >= 0.35 && alpha <= 0.45) {
      count += 1;
    }
  }
  return count;
}

function findCollisionRectByCenterZ(rects, centerZ) {
  for (const rect of rects ?? []) {
    if (rect.centerZ === centerZ) {
      return rect;
    }
  }
  return null;
}

function hasBlockedFrontOpening(rects) {
  for (const rect of rects ?? []) {
    if (rect.centerZ > 4.5 && Math.abs(rect.centerX) < 2.5) {
      return true;
    }
  }
  return false;
}

function countSmallDeskCollisionRects(rects) {
  let count = 0;
  for (const rect of rects ?? []) {
    if (rect.centerZ < -3 && rect.halfWidth <= 0.9) {
      count += 1;
    }
  }
  return count;
}

function collectTransparentMeshNames(root) {
  const names = [];
  for (const { node, material } of collectMeshMaterials(root)) {
    if (material.transparent === true || (material.opacity ?? 1) < 1) {
      names.push(node.name || '(unnamed mesh)');
    }
  }
  return names;
}

function collectUnexpectedTransparentMeshNames(root, allowedNames) {
  const names = [];
  for (const { node, material } of collectMeshMaterials(root)) {
    if (
      (material.transparent === true || (material.opacity ?? 1) < 1)
      && !allowedNames.has(node.name || '(unnamed mesh)')
    ) {
      names.push(node.name || '(unnamed mesh)');
    }
  }
  return names;
}

function hasSavedMarthaNpc(npcs) {
  for (const npc of npcs ?? []) {
    if (
      npc.id === 'npc_martha'
      && npc.modelId === 'martha'
      && npc.name === 'Martha'
      && npc.marthaEnabled === true
      && /fat old white lady/.test(npc.prompt ?? '')
      && /fluffy white hair/.test(npc.prompt ?? '')
      && /round glasses/.test(npc.prompt ?? '')
    ) {
      return true;
    }
  }
  return false;
}

function hasPawnBackCounterRect(rects) {
  for (const rect of rects ?? []) {
    if (rect.centerZ === -7.2 && rect.halfWidth > 8 && rect.halfDepth >= 0.67) {
      return true;
    }
  }
  return false;
}

function countPawnCounterReturnRects(rects) {
  let count = 0;
  for (const rect of rects ?? []) {
    if (rect.centerZ === -4.1 && rect.halfWidth >= 0.67 && rect.halfDepth > 3) {
      count += 1;
    }
  }
  return count;
}

function getRequiredPawnGlassMeshes(pawnVisual) {
  const names = [
    'pawnShopFrontWindow-7.6',
    'pawnShopFrontWindow-5.25',
    'pawnShopFrontWindow5.25',
    'pawnShopFrontWindow7.6',
    'pawnShopBackCounterGlass',
    'pawnShopLeftCounterReturnGlass',
    'pawnShopRightCounterReturnGlass'
  ];
  const meshes = [];
  for (const name of names) {
    meshes.push(pawnVisual.getObjectByName(name));
  }
  return meshes;
}

function assertAllMeshesPresent(meshes, message) {
  for (const mesh of meshes) {
    assert(mesh, message);
  }
}

function positionValuesAreFinite(position) {
  for (const value of position) {
    if (!Number.isFinite(value)) {
      return false;
    }
  }
  return true;
}

function collectPickupProps(props) {
  const pickupProps = [];
  for (const prop of props ?? []) {
    if (prop.itemId === COMBAT_PICKUP_PROP_ITEM_IDS.pistol) {
      pickupProps.push(prop);
    }
  }
  return pickupProps;
}

function allPickupSpawnsArePistol(pickupSpawns) {
  for (const spawn of pickupSpawns) {
    if (spawn.weaponId !== WEAPON_IDS.pistol) {
      return false;
    }
  }
  return true;
}

function deliveryCarryClipHasOnlyUpperBodyTracks(tracks) {
  for (const track of tracks ?? []) {
    if (/^mixamorig(?:Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot)/u.test(track.name ?? '')) {
      return false;
    }
  }
  return true;
}

function sequenceMissionIdsMatch(sequence, expectedOrder) {
  if (sequence.length !== expectedOrder.length) {
    return false;
  }
  for (let index = 0; index < expectedOrder.length; index += 1) {
    if (sequence[index]?.missionId !== expectedOrder[index]) {
      return false;
    }
  }
  return true;
}

function findCatalogMissionById(missionId) {
  for (const mission of MISSION_CATALOG) {
    if (mission.id === missionId) {
      return mission;
    }
  }
  return null;
}

function findMissionSnapshotById(snapshots, missionId) {
  for (const mission of snapshots) {
    if (mission.id === missionId) {
      return mission;
    }
  }
  return null;
}

function findMissionSequenceEntry(sequence, missionId) {
  for (const mission of sequence) {
    if (mission.missionId === missionId) {
      return mission;
    }
  }
  return null;
}

function rowsHaveStableMissionNumbers(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].missionNumber !== index + 1) {
      return false;
    }
  }
  return true;
}

function fourMoreWheelsFieldsAreRetitled(mission) {
  const values = [
    mission?.title,
    mission?.label,
    mission?.description,
    mission?.prompt
  ];
  for (const value of values) {
    if (!String(value ?? '').startsWith(FOUR_MORE_WHEELS_MISSION_TITLE)) {
      return false;
    }
  }
  return true;
}

function allNpcsHaveFlag(npcs, flagName) {
  for (const npc of npcs ?? []) {
    if (!Object.hasOwn(npc, flagName)) {
      return false;
    }
  }
  return true;
}

function hasNpcWithFlag(npcs, npcId, flagName) {
  for (const npc of npcs ?? []) {
    if (npc.id === npcId && npc[flagName] === true) {
      return true;
    }
  }
  return false;
}

function ownedVehicleMenuHasItem(menuItems, itemId) {
  for (const item of menuItems) {
    if (item.id === itemId) {
      return true;
    }
  }
  return false;
}

function hotbarSlotsExcludeItem(slots, itemId) {
  for (const slot of slots) {
    if (slot.itemId === itemId) {
      return false;
    }
  }
  return true;
}

function parsePlayerSchemas(serverSource) {
  const playerSchemas = [];
  const schemaPattern = /const (?<name>Player[A-Za-z0-9]*State) = schema\(\{(?<body>[\s\S]*?)\n\}\);/g;
  let schemaMatch = schemaPattern.exec(serverSource);
  while (schemaMatch) {
    const fields = [];
    const fieldPattern = /^\s+([A-Za-z0-9_]+):/gm;
    let fieldMatch = fieldPattern.exec(schemaMatch.groups.body);
    while (fieldMatch) {
      fields.push(fieldMatch[1]);
      fieldMatch = fieldPattern.exec(schemaMatch.groups.body);
    }
    playerSchemas.push({
      name: schemaMatch.groups.name,
      fields
    });
    schemaMatch = schemaPattern.exec(serverSource);
  }
  return playerSchemas;
}

function findPlayerSchemaByName(playerSchemas, name) {
  for (const entry of playerSchemas) {
    if (entry.name === name) {
      return entry;
    }
  }
  return null;
}

function playerStateHasNestedSchemaFields(fields) {
  const requiredFields = ['transform', 'combat', 'inventory', 'deliveryQuest', 'skills', 'profile'];
  for (const field of requiredFields) {
    if (!fields.includes(field)) {
      return false;
    }
  }
  return true;
}

function getStonePaverSizeSpread(pavers) {
  const size = new Vector3();
  let minWidth = Infinity;
  let maxWidth = -Infinity;
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  for (const paver of pavers) {
    new Box3().setFromObject(paver).getSize(size);
    minWidth = Math.min(minWidth, size.x);
    maxWidth = Math.max(maxWidth, size.x);
    minDepth = Math.min(minDepth, size.z);
    maxDepth = Math.max(maxDepth, size.z);
  }
  return {
    width: maxWidth - minWidth,
    depth: maxDepth - minDepth
  };
}

function findRentCollector(npcs) {
  for (const npc of npcs ?? []) {
    if (isRentIntroCollector(npc)) {
      return npc;
    }
  }
  return null;
}

function chartUsesAllLanes(chart) {
  const lanes = new Set();
  for (const note of chart) {
    lanes.add(note.lane);
  }
  return lanes.size === VIBE_HERO_LANE_COUNT;
}

function pushLayeredPlacementEntries(entries, placements, layer) {
  if (!Array.isArray(placements)) {
    return;
  }
  for (const placement of placements) {
    entries.push({ ...placement, layer });
  }
}

function hasAllNames(container, names) {
  for (const name of names) {
    if (!container?.includes(name)) {
      return false;
    }
  }
  return true;
}

function hasPoliceFrontCollisionWall(rects) {
  for (const rect of rects ?? []) {
    if (rect.centerZ === 5.4 && rect.halfWidth > 8) {
      return true;
    }
  }
  return false;
}

function collectSourceEntries(relativePaths) {
  const entries = [];
  for (const relativePath of relativePaths) {
    entries.push({
      relativePath,
      source: readRepoText(relativePath)
    });
  }
  return entries;
}

function findSourceEntry(entries, relativePath) {
  for (const entry of entries) {
    if (entry.relativePath === relativePath) {
      return entry;
    }
  }
  return null;
}

function collectPassiveTrafficRoadExitKeys(item, rotationQuarterTurns) {
  const exits = new Set();
  for (const direction of getPassiveTrafficRoadExits(item, rotationQuarterTurns)) {
    exits.add(`${direction.x}:${direction.z}`);
  }
  return exits;
}

function findTrafficNodeIndex(graph, cellX, cellZ) {
  for (const node of graph.nodes) {
    if (node.cellX === cellX && node.cellZ === cellZ) {
      return node.index;
    }
  }
  return undefined;
}

function findTrafficNode(graph, cellX, cellZ) {
  const index = findTrafficNodeIndex(graph, cellX, cellZ);
  return index === undefined ? null : graph.nodes[index] ?? null;
}

function assertAllActiveNodesAreRoads(trafficGraph) {
  for (const node of trafficGraph.activeNodes) {
    assert(
      String(node.itemId).startsWith('road_') && !String(node.assetName).startsWith('park_road_'),
      'Passive traffic graph should be built specifically from drivable street road tiles'
    );
  }
}

function assertPathInsideActiveNodeSet(path, activeNodeSet) {
  for (const nodeIndex of path) {
    assert(activeNodeSet.has(nodeIndex), 'Passive traffic paths should stay on road graph nodes');
  }
}

function findPassiveTrafficTurnCandidate(trafficGraph) {
  for (const node of trafficGraph.activeNodes) {
    for (const incomingIndex of node.neighbors) {
      for (const outgoingIndex of node.neighbors) {
        if (
          incomingIndex === outgoingIndex
          || !trafficGraph.activeNodeSet.has(incomingIndex)
          || !trafficGraph.activeNodeSet.has(outgoingIndex)
        ) {
          continue;
        }

        const incomingNode = trafficGraph.nodes[incomingIndex];
        const outgoingNode = trafficGraph.nodes[outgoingIndex];
        const incomingX = Math.sign(node.cellX - incomingNode.cellX);
        const incomingZ = Math.sign(node.cellZ - incomingNode.cellZ);
        const outgoingX = Math.sign(outgoingNode.cellX - node.cellX);
        const outgoingZ = Math.sign(outgoingNode.cellZ - node.cellZ);
        if (((incomingX * outgoingX) + (incomingZ * outgoingZ)) === 0) {
          return { incomingNode, node, outgoingNode };
        }
      }
    }
  }
  return null;
}

function assertTurnWaypointsStayOnRoad(turnCandidate, turnWaypoints) {
  let touchesIntersection = false;
  for (const waypoint of turnWaypoints) {
    assert(
      isPassiveTrafficPositionInsideRoadNode(turnCandidate.incomingNode, waypoint)
        || isPassiveTrafficPositionInsideRoadNode(turnCandidate.node, waypoint)
        || isPassiveTrafficPositionInsideRoadNode(turnCandidate.outgoingNode, waypoint),
      'Passive traffic 90-degree turn waypoints should stay inside the connected street tiles'
    );
    if (isPassiveTrafficPositionInsideRoadNode(turnCandidate.node, waypoint, BUILDER_TILE_SIZE * 0.12)) {
      touchesIntersection = true;
    }
  }
  assert(touchesIntersection, 'Passive traffic 90-degree turns should arc through the intersection street tile before exiting');
}

function assertTurnSteeringStaysWithinQuarterTurn(previousNode, currentNode, nextNode, turnWaypoints) {
  const yawRange = getPassiveTrafficTurnYawRange(previousNode, currentNode, nextNode);
  assert(yawRange, 'Passive traffic 90-degree turns should expose a bounded yaw range');
  assert(
    angleDelta(yawRange.startYaw, yawRange.endYaw) <= PASSIVE_TRAFFIC_MAX_TURN_RADIANS + 0.001,
    'Passive traffic turn yaw range should be capped at 90 degrees'
  );

  const turnDirection = Math.atan2(
    Math.sin(yawRange.endYaw - yawRange.startYaw),
    Math.cos(yawRange.endYaw - yawRange.startYaw)
  ) >= 0 ? 1 : -1;
  const oversizedYaw = yawRange.startYaw + (turnDirection * (PASSIVE_TRAFFIC_MAX_TURN_RADIANS + (Math.PI / 3)));
  assert(
    angleDelta(
      clampPassiveTrafficTurnYaw(yawRange.startYaw, yawRange.endYaw, oversizedYaw),
      yawRange.endYaw
    ) < 0.001,
    'Passive traffic steering should clamp over-rotated turn targets to the 90-degree exit heading'
  );

  let previousPoint = getPassiveTrafficLanePositionAtNode(previousNode, currentNode, new Vector3());
  for (const waypoint of turnWaypoints) {
    const targetYaw = Math.atan2(waypoint.x - previousPoint.x, waypoint.z - previousPoint.z);
    const clampedYaw = clampPassiveTrafficTurnYaw(yawRange.startYaw, yawRange.endYaw, targetYaw);
    assert(
      angleDelta(targetYaw, clampedYaw) < 0.01,
      'Passive traffic turn waypoints should not ask steering outside the capped 90-degree turn arc'
    );
    previousPoint = waypoint;
  }
}

function assertDealershipShowroomCars(layout, layoutLabel, carDealershipItem) {
  const dealershipPlacement = findPlacementByItemId(layout.tiles, 'car_dealership_building');
  assert(dealershipPlacement, `${layoutLabel} should include a Car Dealership tile for showroom cars`);
  const rotationQuarterTurns = dealershipPlacement.rotationQuarterTurns ?? 0;
  const dealershipCenter = getTileCenterWorldPosition(
    carDealershipItem,
    dealershipPlacement.cell?.[0] ?? 0,
    dealershipPlacement.cell?.[1] ?? 0,
    rotationQuarterTurns
  );

  for (const spec of CAR_DEALERSHIP_SHOWROOM_CARS) {
    const carItem = getBuilderItemById(spec.itemId);
    assert(carItem, `${spec.label} should exist in the vehicle catalog`);

    const localZ = CAR_DEALERSHIP_SHOWROOM_CAR_LOCAL_Z;
    const offset = rotateFootprintOffset(spec.localX, localZ, rotationQuarterTurns);
    const expectedPosition = [
      Number((dealershipCenter.x + offset.x).toFixed(2)),
      Number((dealershipCenter.z + offset.z).toFixed(2))
    ];
    const localRotationY = Math.atan2(spec.doorTargetLocalX - spec.localX, CAR_DEALERSHIP_DOOR_LOCAL_Z - localZ);
    const expectedRotationY = (rotationQuarterTurns * (Math.PI / 2)) + localRotationY;
    const expectedRotationQuarterTurns = normalizeQuarterTurnsFromRotationY(expectedRotationY);
    const prop = findShowroomProp(layout, spec.itemId, expectedPosition);

    assert(prop, `${layoutLabel} should place the ${spec.label} in the dealership showroom bay`);
    assert(
      getPlacementScale({ layer: 'prop', ...prop }) === CAR_DEALERSHIP_SHOWROOM_CAR_SCALE,
      `${layoutLabel} ${spec.label} should render at 0.75x standard size`
    );
    assert(prop.rotationQuarterTurns === expectedRotationQuarterTurns, `${layoutLabel} ${spec.label} should preserve a compatible quarter-turn fallback`);
    assert(Number.isFinite(Number(prop.rotationY)), `${layoutLabel} ${spec.label} should use exact rotationY for diagonal showroom staging`);
    assert(angleDelta(Number(prop.rotationY), expectedRotationY) <= 0.002, `${layoutLabel} ${spec.label} should face diagonally toward the dealership door`);

    const halfWidth = (carItem.size[0] * CAR_DEALERSHIP_SHOWROOM_CAR_SCALE) * 0.5;
    const halfDepth = (carItem.size[1] * CAR_DEALERSHIP_SHOWROOM_CAR_SCALE) * 0.5;
    const localHalfX = (Math.abs(Math.cos(localRotationY)) * halfWidth) + (Math.abs(Math.sin(localRotationY)) * halfDepth);
    const localHalfZ = (Math.abs(Math.sin(localRotationY)) * halfWidth) + (Math.abs(Math.cos(localRotationY)) * halfDepth);
    const localMinX = spec.localX - localHalfX;
    const localMaxX = spec.localX + localHalfX;
    const localMinZ = localZ - localHalfZ;
    const localMaxZ = localZ + localHalfZ;
    assert(localMinX >= -10.35 && localMaxX <= 10.35, `${layoutLabel} ${spec.label} should fit inside the dealership glass side walls`);
    assert(localMinZ >= 0.2 && localMaxZ <= 10.55, `${layoutLabel} ${spec.label} should fit between the back showroom seam and front door`);
    assert(
      spec.localX < 0 ? localMaxX <= -PLAYER_RADIUS : localMinX >= PLAYER_RADIUS,
      `${layoutLabel} ${spec.label} should leave a player-width center aisle through the showroom`
    );
  }
}

function assertVehiclePropScales(layout, layoutLabel) {
  let vehiclePropCount = 0;
  for (const prop of layout.props ?? []) {
    if (!isVehiclePropItemId(prop.itemId)) {
      continue;
    }
    vehiclePropCount += 1;
    assert(
      getDefaultPropPlacementScale(prop) === VEHICLE_PROP_PLACEMENT_SCALE,
      `${layoutLabel} ${prop.itemId} should resolve a 0.75x default vehicle scale`
    );
    assert(
      getPlacementScale({ layer: 'prop', ...prop }) === VEHICLE_PROP_PLACEMENT_SCALE,
      `${layoutLabel} ${prop.itemId} should render at 0.75x standard size`
    );
  }
  assert(vehiclePropCount >= 2, `${layoutLabel} should include vehicle props to validate car scale`);
}

function assertVehicleModelGrounding() {
  const fiatGroundParts = getVehicleModelGroundNodeNameParts(CAR_DEALER_ITEM_IDS.fiatDuna);
  assert(
    fiatGroundParts.includes('tire') && fiatGroundParts.includes('wheel'),
    'Fiat Duna model grounding should snap to wheel/tire mesh bounds instead of the bad low license-plate bounds'
  );

  const fiatItem = getBuilderItemById(CAR_DEALER_ITEM_IDS.fiatDuna);
  const toyotaItem = getBuilderItemById(CAR_DEALER_ITEM_IDS.toyotaAe86);
  assert(fiatItem?.modelTransformRoot === true, 'Fiat Duna prop should keep model-prep transforms under a placement root');
  assert(toyotaItem?.modelTransformRoot === true, 'Toyota AE86 prop should keep model-prep transforms under a placement root');
  assert(
    fiatItem.groundSnapNodeNameParts?.includes('tire') && fiatItem.groundSnapNodeNameParts?.includes('wheel'),
    'Fiat Duna prop should carry wheel/tire grounding metadata into world rendering'
  );

  const root = new Group();
  const material = new MeshStandardMaterial();
  const badLowBounds = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), material);
  badLowBounds.name = 'front_license_plate_bad_bounds';
  badLowBounds.position.y = -2;
  const wheel = new Mesh(new BoxGeometry(1, 1, 1), material);
  wheel.name = 'fiat_duna_test_wheel';
  wheel.position.y = 1.25;
  root.add(badLowBounds, wheel);

  snapObjectToGround(root, { groundNodeNameParts: fiatGroundParts });
  const wheelBounds = new Box3().setFromObject(wheel);
  const fullBounds = new Box3().setFromObject(root);
  assert(Math.abs(wheelBounds.min.y) <= 0.000001, 'Fiat Duna wheel/tire grounding should put the wheel bottom on the ground');
  assert(fullBounds.min.y < -1, 'Fiat Duna wheel/tire grounding should ignore the known bad low license-plate-style bound');
}

function validatePassiveTraffic() {
  assert(
    PASSIVE_TRAFFIC_CAR_ITEM_IDS.length >= 4
      && PASSIVE_TRAFFIC_CAR_ITEM_IDS[0] === 'car_sedan'
      && PASSIVE_TRAFFIC_CAR_ITEM_IDS[1] === 'car_stationwagon'
      && PASSIVE_TRAFFIC_CAR_ITEM_IDS[2] === 'car_taxi'
      && PASSIVE_TRAFFIC_CAR_ITEM_IDS[3] === 'car_police',
    'Passive traffic should expose Sedan, Station wagon, Taxi, and Car Police as routeable passive cars'
  );
  for (const itemId of PASSIVE_TRAFFIC_CAR_ITEM_IDS) {
    const item = getBuilderItemById(itemId);
    assert(item?.layer === 'prop' && item.groupId === 'vehicles', `Passive traffic car ${itemId} should resolve to a vehicle prop`);
    assert(item.size?.[0] === 6.5 && item.size?.[1] === 12, `Passive traffic car ${itemId} should use the standard vehicle prop footprint`);
  }
  assert(PASSIVE_TRAFFIC_CAR_SCALE === 0.68, 'Passive traffic cars should render at 0.85x their previous passive size');
  assert(PASSIVE_TRAFFIC_CAR_SCALE < VEHICLE_PROP_PLACEMENT_SCALE, 'Passive traffic cars should no longer render larger than player-owned vehicle props');
  assert(PASSIVE_TRAFFIC_SPEED === BUILDER_TILE_SIZE, 'Passive traffic should drive at roughly player walking speed');
  assert(PASSIVE_TRAFFIC_CAR_COLLISION_HITBOX_SCALE === 0.9, 'Passive traffic car-on-car collision hitboxes should be 10% more forgiving');
  assert(
    PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH > 2
      && PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH < 2.6
      && PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH > 4
      && PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH < 4.7,
    'Passive traffic car hitboxes should match the scaled vehicle footprint closely'
  );
  assert(PASSIVE_TRAFFIC_PLAYER_COLLISION_DAMAGE === 20, 'Passive traffic should take 20 health when it runs over the player');
  assert(PASSIVE_TRAFFIC_PLAYER_STUN_SECONDS === 1.5, 'Passive traffic player hit stun should immobilize the player for 1.5 seconds');
  assert(
    PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS > 0
      && PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS > 0,
    'Passive car collisions should make one car reverse and pause before continuing'
  );
  assert(
    isPointInsidePassiveTrafficHitbox({ x: 0, z: 0 }, 0, { x: 0.5, z: PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH - 0.2 }, 0.1),
    'Passive traffic player collision should detect a player inside the front of the car hitbox'
  );
  assert(
    !isPointInsidePassiveTrafficHitbox({ x: 0, z: 0 }, 0, { x: PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH + 2, z: 0 }, 0.1),
    'Passive traffic player collision should ignore players outside the side of the car hitbox'
  );
  assert(
    passiveTrafficHitboxesOverlap({ x: 0, z: 0 }, 0, { x: 0, z: PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH * 1.6 }, 0),
    'Passive traffic car hitboxes should overlap when passive cars nose into each other'
  );
  assert(
    !passiveTrafficHitboxesOverlap({ x: 0, z: 0 }, 0, { x: 0, z: PASSIVE_TRAFFIC_HITBOX_HALF_LENGTH * 1.9 }, 0),
    'Passive traffic car hitboxes should leave about 10% more nose-to-nose clearance'
  );
  assert(
    !passiveTrafficHitboxesOverlap({ x: 0, z: 0 }, 0, { x: PASSIVE_TRAFFIC_HITBOX_HALF_WIDTH * 3, z: 0 }, 0),
    'Passive traffic car hitboxes should not overlap when passive cars are safely side-by-side'
  );

  const directionKey = (direction) => `${direction.x}:${direction.z}`;
  const assertRoadExits = (itemId, rotationQuarterTurns, expectedDirections) => {
    const item = getBuilderItemById(itemId);
    assert(item?.layer === 'tile', `Passive traffic road type ${itemId} should resolve to a tile`);
    const exits = collectPassiveTrafficRoadExitKeys(item, rotationQuarterTurns);
    for (const expectedDirection of expectedDirections) {
      assert(
        exits.has(directionKey(expectedDirection)),
        `Passive traffic should understand ${itemId} rotation ${rotationQuarterTurns} road exits`
      );
    }
    assert(exits.size === expectedDirections.length, `Passive traffic should not add extra exits for ${itemId} rotation ${rotationQuarterTurns}`);
  };
  const assertNoRoadExits = (itemId, rotationQuarterTurns) => {
    const item = getBuilderItemById(itemId);
    assert(item?.layer === 'tile', `Passive traffic non-road type ${itemId} should resolve to a tile`);
    const exits = collectPassiveTrafficRoadExitKeys(item, rotationQuarterTurns);
    assert(exits.size === 0, `Passive traffic should not treat ${itemId} rotation ${rotationQuarterTurns} as a drivable road`);
  };
  assertRoadExits('road_straight', 0, [{ x: 0, z: -1 }, { x: 0, z: 1 }]);
  assertRoadExits('road_straight', 1, [{ x: 1, z: 0 }, { x: -1, z: 0 }]);
  assertRoadExits('road_corner', 0, [{ x: 0, z: -1 }, { x: 1, z: 0 }]);
  assertRoadExits('road_corner', 2, [{ x: 0, z: 1 }, { x: -1, z: 0 }]);
  assertRoadExits('road_corner_curved', 3, [{ x: -1, z: 0 }, { x: 0, z: -1 }]);
  assertRoadExits('road_tsplit', 1, [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }]);
  assertRoadExits('road_cross', 0, [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }]);
  assertRoadExits('road_junction', 0, [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }]);
  assertNoRoadExits('park_road_straight', 1);
  assertNoRoadExits('park_road_corner_decorated', 1);
  assertNoRoadExits('park_road_tsplit_decorated', 0);
  assertNoRoadExits('park_road_junction_decorated_C', 0);

  const mixedRoadTypeTiles = [
    { id: 'traffic_road_type_1', itemId: 'road_straight', cell: [0, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_road_type_2', itemId: 'road_corner', cell: [1, 0], rotationQuarterTurns: 2 },
    { id: 'traffic_road_type_3', itemId: 'road_tsplit', cell: [1, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_road_type_4', itemId: 'road_cross', cell: [2, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_road_type_5', itemId: 'road_junction', cell: [3, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_road_type_6', itemId: 'road_corner_curved', cell: [4, 1], rotationQuarterTurns: 3 }
  ];
  const mixedRoadTypeGraph = buildPassiveTrafficRoadGraph(mixedRoadTypeTiles);
  const mixedRoadStart = findTrafficNodeIndex(mixedRoadTypeGraph, 0, 0);
  const mixedRoadEnd = findTrafficNodeIndex(mixedRoadTypeGraph, 4, 1);
  const mixedRoadPath = findPassiveTrafficPath(mixedRoadTypeGraph, mixedRoadStart, mixedRoadEnd);
  assert(
    mixedRoadPath.length === mixedRoadTypeTiles.length,
    'Passive traffic should route continuously through straight, corner, curved, T, cross, and junction street road tiles'
  );
  const tolerantCornerGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_tolerant_corner_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_tolerant_corner_node', itemId: 'road_corner', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_tolerant_corner_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const tolerantCornerSouth = findTrafficNode(tolerantCornerGraph, 0, 1);
  const tolerantCornerNode = findTrafficNode(tolerantCornerGraph, 0, 0);
  const tolerantCornerEast = findTrafficNode(tolerantCornerGraph, 1, 0);
  assert(
    tolerantCornerSouth && tolerantCornerNode && tolerantCornerEast,
    'Passive traffic tolerant corner fixture should expose all route nodes'
  );
  const tolerantCornerPath = findPassiveTrafficPath(
    tolerantCornerGraph,
    tolerantCornerSouth.index,
    tolerantCornerEast.index
  );
  assert(
    tolerantCornerPath.length === 3
      && tolerantCornerPath[1] === tolerantCornerNode.index,
    'Passive traffic route lines should be able to select and path through street corner tiles even when the corner rotation is finicky'
  );
  assert(
    getPassiveTrafficDriveScript(tolerantCornerSouth, tolerantCornerNode, tolerantCornerEast).waypoints.length >= 10,
    'Passive traffic cars should still receive a curved turn script when a custom route passes through a tolerant corner'
  );
  const tolerantTSplitGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_tolerant_tsplit_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_tolerant_tsplit_node', itemId: 'road_tsplit', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_tolerant_tsplit_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const tolerantTSplitSouth = findTrafficNode(tolerantTSplitGraph, 0, 1);
  const tolerantTSplitNode = findTrafficNode(tolerantTSplitGraph, 0, 0);
  const tolerantTSplitEast = findTrafficNode(tolerantTSplitGraph, 1, 0);
  assert(
    tolerantTSplitGraph.activeNodeIndices.length === 3
      && tolerantTSplitSouth
      && tolerantTSplitNode
      && tolerantTSplitEast,
    'Passive traffic T-split fixtures should keep visually adjacent street road tiles clickable'
  );
  const tolerantTSplitPath = findPassiveTrafficPath(
    tolerantTSplitGraph,
    tolerantTSplitSouth.index,
    tolerantTSplitEast.index
  );
  assert(
    tolerantTSplitPath.length === 3
      && tolerantTSplitPath[1] === tolerantTSplitNode.index,
    'Passive traffic route lines should path through finicky T intersections when adjacent road tiles are selectable'
  );
  const parkOnlyTrafficGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_park_road_type_1', itemId: 'park_road_straight', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_park_road_type_2', itemId: 'park_road_corner_decorated', cell: [0, -1], rotationQuarterTurns: 1 },
    { id: 'traffic_park_road_type_3', itemId: 'park_road_tsplit_decorated', cell: [1, -1], rotationQuarterTurns: 0 }
  ]);
  assert(
    parkOnlyTrafficGraph.nodes.length === 0 && parkOnlyTrafficGraph.activeNodeIndices.length === 0,
    'Passive traffic should not add park path tiles to the drivable route graph'
  );
  const streetBesideParkGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_street_beside_park_1', itemId: 'road_straight', cell: [0, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_street_beside_park_2', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_street_beside_park_3', itemId: 'road_straight', cell: [2, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_park_path_beside_street_1', itemId: 'park_road_straight', cell: [0, 1], rotationQuarterTurns: 1 },
    { id: 'traffic_park_path_beside_street_2', itemId: 'park_road_straight', cell: [2, 1], rotationQuarterTurns: 1 }
  ]);
  assert(
    getPassiveTrafficRouteNodeIndices(streetBesideParkGraph, {
      points: [
        { cellX: 0, cellZ: 1, x: 0, z: BUILDER_TILE_SIZE },
        { cellX: 2, cellZ: 1, x: BUILDER_TILE_SIZE * 2, z: BUILDER_TILE_SIZE },
        { cellX: 0, cellZ: 1, x: 0, z: BUILDER_TILE_SIZE }
      ]
    }).length === 0,
    'Passive traffic saved route points with explicit park cells should not snap to neighboring street roads'
  );

  const trafficGraph = buildPassiveTrafficRoadGraph(defaultWorldLayout.tiles);
  assert(trafficGraph.activeNodeIndices.length >= 30, 'Default world should expose a broad road-tile network for passive traffic');
  assert(trafficGraph.activeComponents?.length >= 1, 'Passive traffic should expose active road components for broad map coverage');
  assertAllActiveNodesAreRoads(trafficGraph);

  const startIndex = trafficGraph.activeNodeIndices[0];
  const endIndex = trafficGraph.activeNodeIndices[trafficGraph.activeNodeIndices.length - 1];
  const path = findPassiveTrafficPath(trafficGraph, startIndex, endIndex);
  assert(path.length >= 2, 'Passive traffic should be able to route across the default road network');
  assertPathInsideActiveNodeSet(path, trafficGraph.activeNodeSet);

  const multiComponentTrafficGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_component_a_1', itemId: 'road_straight', cell: [0, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_component_a_2', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_component_b_1', itemId: 'road_straight', cell: [10, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_component_b_2', itemId: 'road_straight', cell: [11, 0], rotationQuarterTurns: 1 }
  ]);
  assert(multiComponentTrafficGraph.activeComponents.length === 2, 'Passive traffic should keep every drivable road component active for map coverage');
  assert(multiComponentTrafficGraph.activeNodeIndices.length === 4, 'Passive traffic should not drop smaller connected street groups from the active graph');
  const componentAStart = findTrafficNodeIndex(multiComponentTrafficGraph, 0, 0);
  const componentAEnd = findTrafficNodeIndex(multiComponentTrafficGraph, 1, 0);
  const componentBEnd = findTrafficNodeIndex(multiComponentTrafficGraph, 11, 0);
  assert(findPassiveTrafficPath(multiComponentTrafficGraph, componentAStart, componentAEnd).length === 2, 'Passive traffic should route inside each active road component');
  assert(findPassiveTrafficPath(multiComponentTrafficGraph, componentAStart, componentBEnd).length === 0, 'Passive traffic should not path through non-road gaps between disconnected street components');

  const fromNode = trafficGraph.nodes[path[0]];
  const toNode = trafficGraph.nodes[path[1]];
  const lanePosition = getPassiveTrafficLanePosition(fromNode, toNode, new Vector3());
  const deltaX = toNode.x - fromNode.x;
  const deltaZ = toNode.z - fromNode.z;
  const length = Math.hypot(deltaX, deltaZ);
  const rightX = -deltaZ / length;
  const rightZ = deltaX / length;
  const laneDot = ((lanePosition.x - toNode.x) * rightX) + ((lanePosition.z - toNode.z) * rightZ);
  assert(Math.abs(laneDot - PASSIVE_TRAFFIC_LANE_OFFSET) < 0.001, 'Passive traffic lane targets should stay on the right side of travel');
  assert(
    PASSIVE_TRAFFIC_LANE_OFFSET > 0
      && PASSIVE_TRAFFIC_LANE_OFFSET < BUILDER_TILE_SIZE * 0.18,
    'Passive traffic default lane offset should sit slightly left of the outer road line while staying in the right lane'
  );
  const leftDot = ((lanePosition.x - toNode.x) * (deltaZ / length)) + ((lanePosition.z - toNode.z) * (-deltaX / length));
  assert(leftDot < 0, 'Passive traffic should not use the driver-left lane normal');
  assert(
    isPassiveTrafficPositionInsideRoadNode(toNode, lanePosition),
    'Passive traffic lane targets should be bounded inside the destination street tile'
  );

  const straightTrafficGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_straight_1', itemId: 'road_straight', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_straight_2', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_straight_3', itemId: 'road_straight', cell: [0, 2], rotationQuarterTurns: 0 }
  ]);
  const straightNodes = [
    findTrafficNode(straightTrafficGraph, 0, 0),
    findTrafficNode(straightTrafficGraph, 0, 1),
    findTrafficNode(straightTrafficGraph, 0, 2)
  ];
  const firstStraightLane = getPassiveTrafficLanePosition(straightNodes[0], straightNodes[1], new Vector3());
  const secondStraightLane = getPassiveTrafficLanePosition(straightNodes[1], straightNodes[2], new Vector3());
  assert(
    Math.abs(firstStraightLane.x - secondStraightLane.x) < 0.001
      && Math.abs((secondStraightLane.z - firstStraightLane.z) - BUILDER_TILE_SIZE) < 0.001,
    'Passive traffic should hold a straight center-of-lane line across consecutive straight road tiles'
  );

  const straightJunctionGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_junction_north', itemId: 'road_straight', cell: [0, -1], rotationQuarterTurns: 0 },
    { id: 'traffic_junction_center', itemId: 'road_junction', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_junction_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 }
  ]);
  const straightJunctionNorth = straightJunctionGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === -1);
  const straightJunctionCenter = straightJunctionGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === 0);
  const straightJunctionSouth = straightJunctionGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === 1);
  const straightJunctionScript = getPassiveTrafficDriveScript(straightJunctionNorth, straightJunctionCenter, straightJunctionSouth);
  assert(
    getPassiveTrafficDriveCommand(straightJunctionNorth, straightJunctionCenter, straightJunctionSouth) === PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT,
    'Passive traffic should script straight-through junction driving as a straight command'
  );
  assert(isPassiveTrafficJunctionNode(straightJunctionCenter), 'Passive traffic should recognize Road Junction tiles as junction nodes');
  assert(
    straightJunctionScript.shouldStopAtEntry
      && straightJunctionScript.stopWaypointIndex === 0
      && straightJunctionScript.waypoints.length >= 3,
    'Passive traffic should stop briefly at the entry edge before traversing a Road Junction tile'
  );
  assert(
    Math.abs(straightJunctionScript.waypoints[0].z - straightJunctionCenter.z) > BUILDER_TILE_SIZE * 0.4
      && isPassiveTrafficPositionInsideRoadNode(straightJunctionCenter, straightJunctionScript.waypoints[0]),
    'Passive traffic junction stop waypoint should be at the road tile edge, not the tile center'
  );

  const roadCrossTurnGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_cross_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_cross_center', itemId: 'road_cross', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_cross_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const roadCrossSouth = findTrafficNode(roadCrossTurnGraph, 0, 1);
  const roadCrossCenter = findTrafficNode(roadCrossTurnGraph, 0, 0);
  const roadCrossEast = findTrafficNode(roadCrossTurnGraph, 1, 0);
  const roadCrossTurnScript = getPassiveTrafficDriveScript(roadCrossSouth, roadCrossCenter, roadCrossEast);
  assert(
    isPassiveTrafficJunctionNode(roadCrossCenter)
      && isPassiveTrafficCrosswalkNode(roadCrossCenter),
    'Passive traffic should recognize Road Cross tiles as crosswalk intersections'
  );
  assert(
    roadCrossTurnScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
      && !roadCrossTurnScript.shouldStopAtEntry
      && roadCrossTurnScript.stopWaypointIndex === -1
      && roadCrossTurnScript.waypoints.length >= 10,
    'Passive traffic should turn smoothly through Road Cross crosswalk tiles without stopping'
  );
  assertTurnSteeringStaysWithinQuarterTurn(
    roadCrossSouth,
    roadCrossCenter,
    roadCrossEast,
    roadCrossTurnScript.waypoints
  );
  const roadCrossDeparturePosition = getPassiveTrafficLanePosition(roadCrossSouth, roadCrossCenter, new Vector3());
  const roadCrossDepartureWaypoints = getPassiveTrafficTurnLaneWaypointsFromPosition(
    roadCrossSouth,
    roadCrossCenter,
    roadCrossEast,
    roadCrossDeparturePosition,
    []
  );
  assert(
    roadCrossDepartureWaypoints.length > 0
      && roadCrossDepartureWaypoints.length < roadCrossTurnScript.waypoints.length
      && roadCrossDepartureWaypoints[0].distanceTo(roadCrossDeparturePosition) < roadCrossTurnScript.waypoints[0].distanceTo(roadCrossDeparturePosition),
    'Passive traffic should trim departure turn waypoints so first-segment turns continue forward smoothly instead of pivoting back to the entry edge'
  );

  const straightTSplitGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_tsplit_west', itemId: 'road_straight', cell: [-1, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_tsplit_center', itemId: 'road_tsplit', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_tsplit_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const straightTSplitWest = findTrafficNode(straightTSplitGraph, -1, 0);
  const straightTSplitCenter = findTrafficNode(straightTSplitGraph, 0, 0);
  const straightTSplitEast = findTrafficNode(straightTSplitGraph, 1, 0);
  const straightTSplitScript = getPassiveTrafficDriveScript(straightTSplitWest, straightTSplitCenter, straightTSplitEast);
  assert(
    straightTSplitScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT
      && !straightTSplitScript.shouldStopAtEntry
      && straightTSplitScript.stopWaypointIndex === -1,
    'Passive traffic should not stop at a Road T Split tile when driving straight through'
  );

  const turningTSplitGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_tsplit_north', itemId: 'road_straight', cell: [0, -1], rotationQuarterTurns: 0 },
    { id: 'traffic_tsplit_turn_center', itemId: 'road_tsplit', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_tsplit_turn_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const turningTSplitNorth = findTrafficNode(turningTSplitGraph, 0, -1);
  const turningTSplitCenter = findTrafficNode(turningTSplitGraph, 0, 0);
  const turningTSplitEast = findTrafficNode(turningTSplitGraph, 1, 0);
  const turningTSplitScript = getPassiveTrafficDriveScript(turningTSplitNorth, turningTSplitCenter, turningTSplitEast);
  assert(
    turningTSplitScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
      && turningTSplitScript.shouldStopAtEntry
      && turningTSplitScript.stopWaypointIndex === 0,
    'Passive traffic should still stop at a Road T Split tile before turning'
  );

  const rightCornerGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_right_turn_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
    { id: 'traffic_right_turn_corner', itemId: 'road_corner', cell: [0, 0], rotationQuarterTurns: 1 },
    { id: 'traffic_right_turn_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const rightCornerSouth = rightCornerGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === 1);
  const rightCornerNode = rightCornerGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === 0);
  const rightCornerEast = rightCornerGraph.nodes.find((node) => node.cellX === 1 && node.cellZ === 0);
  const rightCornerScript = getPassiveTrafficDriveScript(rightCornerSouth, rightCornerNode, rightCornerEast);
  assert(
    rightCornerScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
      && !rightCornerScript.shouldStopAtEntry
      && rightCornerScript.waypoints.length >= 10,
    'Passive traffic should use a non-stopping right-turn script for Road Corner tiles'
  );
  assertTurnSteeringStaysWithinQuarterTurn(
    rightCornerSouth,
    rightCornerNode,
    rightCornerEast,
    rightCornerScript.waypoints
  );

  const routeState = new WorldState();
  routeState.loadLayout({
    tiles: [
      { id: 'route_south', itemId: 'road_straight', cell: [0, 1], rotationQuarterTurns: 0 },
      { id: 'route_corner', itemId: 'road_corner', cell: [0, 0], rotationQuarterTurns: 1 },
      { id: 'route_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
    ],
    passiveTrafficRoutes: [
      {
        itemId: 'car_sedan',
        points: [
          { cellX: 0, cellZ: 1, x: 0, z: BUILDER_TILE_SIZE },
          { cellX: 0, cellZ: 0, x: 0, z: 0 },
          { cellX: 1, cellZ: 0, x: BUILDER_TILE_SIZE, z: 0 },
          { cellX: 0, cellZ: 1, x: 0, z: BUILDER_TILE_SIZE }
        ]
      }
    ]
  });
  const serializedRoutes = routeState.serializeLayout().passiveTrafficRoutes;
  assert(
    serializedRoutes.length === 1
      && serializedRoutes[0].itemId === 'car_sedan'
      && serializedRoutes[0].closed === true
      && serializedRoutes[0].points.length === 4,
    'World state should persist closed passive traffic routes by passive car item id'
  );
  const duplicateRouteState = new WorldState();
  duplicateRouteState.loadLayout({
    tiles: routeState.serializeLayout().tiles,
    passiveTrafficRoutes: [
      { ...serializedRoutes[0], id: 'traffic_route_car_sedan_a' },
      { ...serializedRoutes[0], id: 'traffic_route_car_sedan_b' }
    ]
  });
  const duplicateSerializedRoutes = duplicateRouteState.serializeLayout().passiveTrafficRoutes;
  assert(
    duplicateSerializedRoutes.length === 2
      && duplicateSerializedRoutes[0].itemId === 'car_sedan'
      && duplicateSerializedRoutes[1].itemId === 'car_sedan'
      && duplicateSerializedRoutes[0].id !== duplicateSerializedRoutes[1].id,
    'Passive traffic route persistence should allow multiple route cars of the same vehicle type'
  );
  const rightCornerRouteNodeIndices = getPassiveTrafficRouteNodeIndices(rightCornerGraph, serializedRoutes[0]);
  assert(
    rightCornerRouteNodeIndices.length === 3,
    'Passive traffic should resolve saved route points onto road graph nodes for route-following cars'
  );
  const rightCornerLookahead = buildPassiveTrafficRouteLookahead(
    rightCornerGraph,
    rightCornerRouteNodeIndices,
    rightCornerSouth.index,
    0
  );
  assert(
    rightCornerLookahead.route[0] === rightCornerSouth.index
      && rightCornerLookahead.route[1] === rightCornerNode.index
      && rightCornerLookahead.route[2] === rightCornerEast.index,
    'Custom passive traffic routes should provide enough route lookahead for cars to script through corners'
  );
  const rightCornerLookaheadScript = getPassiveTrafficDriveScript(
    rightCornerGraph.nodes[rightCornerLookahead.route[0]],
    rightCornerGraph.nodes[rightCornerLookahead.route[1]],
    rightCornerGraph.nodes[rightCornerLookahead.route[2]]
  );
  assert(
    rightCornerLookaheadScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
      && rightCornerLookaheadScript.waypoints.length >= 10,
    'Custom passive traffic route lookahead should preserve curved right-turn navigation'
  );

  const serverTrafficSimulationA = new PassiveTrafficSimulation();
  const serverTrafficSimulationB = new PassiveTrafficSimulation();
  const initialServerTrafficA = serverTrafficSimulationA.reset(routeState, routeState.getPassiveTrafficRoutes());
  const initialServerTrafficB = serverTrafficSimulationB.reset(routeState, routeState.getPassiveTrafficRoutes());
  assert(
    initialServerTrafficA.length === initialServerTrafficB.length
      && initialServerTrafficA.length >= PASSIVE_TRAFFIC_CAR_ITEM_IDS.length,
    'Server passive traffic simulation should spawn the shared passive car set from the route graph'
  );
  for (let index = 0; index < 16; index += 1) {
    serverTrafficSimulationA.update(0.05);
    serverTrafficSimulationB.update(0.05);
  }
  assert(
    JSON.stringify(serverTrafficSimulationA.getSnapshots()) === JSON.stringify(serverTrafficSimulationB.getSnapshots()),
    'Server passive traffic simulation should be deterministic so every player receives the same passive cars'
  );

  const leftCurvedCornerGraph = buildPassiveTrafficRoadGraph([
    { id: 'traffic_left_turn_north', itemId: 'road_straight', cell: [0, -1], rotationQuarterTurns: 0 },
    { id: 'traffic_left_turn_corner', itemId: 'road_corner_curved', cell: [0, 0], rotationQuarterTurns: 0 },
    { id: 'traffic_left_turn_east', itemId: 'road_straight', cell: [1, 0], rotationQuarterTurns: 1 }
  ]);
  const leftCurvedCornerNorth = leftCurvedCornerGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === -1);
  const leftCurvedCornerNode = leftCurvedCornerGraph.nodes.find((node) => node.cellX === 0 && node.cellZ === 0);
  const leftCurvedCornerEast = leftCurvedCornerGraph.nodes.find((node) => node.cellX === 1 && node.cellZ === 0);
  const leftCurvedCornerScript = getPassiveTrafficDriveScript(leftCurvedCornerNorth, leftCurvedCornerNode, leftCurvedCornerEast);
  assert(
    leftCurvedCornerScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
      && !leftCurvedCornerScript.shouldStopAtEntry
      && leftCurvedCornerScript.waypoints.every((waypoint) => (
        isPassiveTrafficPositionInsideRoadNode(leftCurvedCornerNode, waypoint)
        || isPassiveTrafficPositionInsideRoadNode(leftCurvedCornerEast, waypoint)
      )),
    'Passive traffic should use a bounded left-turn script for Road Corner Curved tiles'
  );

  assert(
    getPassiveTrafficDriveCommand(straightJunctionNorth, straightJunctionCenter, straightJunctionNorth) === PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE,
    'Passive traffic should classify a U-turn as reverse instead of a normal turn'
  );
  assert(
    getPassiveTrafficTurnLaneWaypoints(straightJunctionNorth, straightJunctionCenter, straightJunctionNorth).length === 0,
    'Passive traffic should not run the 90-degree turn script for reverse recovery'
  );
  assert(
    isPassiveTrafficPositionInsideRoadNode(
      straightJunctionCenter,
      clampPassiveTrafficPositionToRoadNodes(
        [straightJunctionCenter],
        new Vector3(straightJunctionCenter.x + BUILDER_TILE_SIZE * 2, 0, straightJunctionCenter.z + BUILDER_TILE_SIZE * 2),
        new Vector3()
      )
    ),
    'Passive traffic should clamp recovery positions back inside the mapped road tile'
  );

  const turnCandidate = findPassiveTrafficTurnCandidate(trafficGraph);
  assert(turnCandidate, 'Default road graph should include a passive-traffic turn candidate');
  const incomingTurnLane = getPassiveTrafficLanePosition(turnCandidate.incomingNode, turnCandidate.node, new Vector3());
  const outgoingIntersectionLane = getPassiveTrafficLanePositionAtNode(turnCandidate.node, turnCandidate.outgoingNode, new Vector3());
  const outgoingTurnLane = getPassiveTrafficLanePosition(turnCandidate.node, turnCandidate.outgoingNode, new Vector3());
  const turnLaneShift = incomingTurnLane.distanceTo(outgoingIntersectionLane);
  assert(
    turnLaneShift > PASSIVE_TRAFFIC_LANE_OFFSET * 0.5 && turnLaneShift < BUILDER_TILE_SIZE,
    'Passive traffic turns should transition between incoming and outgoing right-lane points inside the intersection'
  );
  const turnWaypoints = getPassiveTrafficTurnLaneWaypoints(
    turnCandidate.incomingNode,
    turnCandidate.node,
    turnCandidate.outgoingNode
  );
  assert(turnWaypoints.length >= 8, 'Passive traffic should sample enough curved 90-degree turn waypoints instead of hard-pivoting once');
  assert(
    turnWaypoints[turnWaypoints.length - 1].distanceTo(outgoingTurnLane) < 0.001,
    'Passive traffic turn waypoints should finish on the outgoing right-hand lane'
  );
  assertTurnWaypointsStayOnRoad(turnCandidate, turnWaypoints);

  const worldRendererSource = readRepoText('src/world/WorldRenderer.js');
  assert(
    /PassiveTrafficRoot/.test(worldRendererSource)
      && /updatePassiveTraffic/.test(worldRendererSource)
      && /PASSIVE_TRAFFIC_CAR_SCALE/.test(worldRendererSource)
      && /turnStopSeconds/.test(worldRendererSource)
      && /turnStopWaypointIndex/.test(worldRendererSource)
      && /turnWaypointActive/.test(worldRendererSource)
      && /turnWaypointQueue/.test(worldRendererSource)
      && /driveCommand/.test(worldRendererSource)
      && /turnStartYaw/.test(worldRendererSource)
      && /clampPassiveTrafficTurnYaw/.test(worldRendererSource)
      && /visitedNodeIndices/.test(worldRendererSource)
      && /stuckSeconds/.test(worldRendererSource)
      && /clampPassiveTrafficPositionToRoadNodes/.test(worldRendererSource)
      && /routeAdvanceCount/.test(worldRendererSource)
      && /setPassiveTrafficRoutes/.test(worldRendererSource)
      && /passiveTrafficRoutesById/.test(worldRendererSource)
      && /createPassiveTrafficCarSpecs/.test(worldRendererSource)
      && /routeId/.test(worldRendererSource)
      && /customRouteNodeIndices/.test(worldRendererSource)
      && /buildPassiveTrafficRouteLookahead/.test(worldRendererSource)
      && /shouldPassiveTrafficStopForTurn/.test(worldRendererSource)
      && /PASSIVE_TRAFFIC_SEDAN_TURN_SPEED_FACTOR/.test(worldRendererSource)
      && /getPassiveTrafficTurnSpeedFactor\(car\)/.test(worldRendererSource)
      && /isPassiveTrafficCrosswalkNode/.test(worldRendererSource)
      && /shouldScriptLeavingCurrentNode/.test(worldRendererSource)
      && /getPassiveTrafficTurnLaneWaypointsFromPosition/.test(worldRendererSource)
      && /updatePassiveTrafficCarCollisions/.test(worldRendererSource)
      && /passiveTrafficHitboxesOverlap/.test(worldRendererSource)
      && /updatePassiveTrafficPlayerCollisions/.test(worldRendererSource)
      && /onPassiveTrafficPlayerCollision/.test(worldRendererSource)
      && /targetTransportKind/.test(worldRendererSource)
      && /transportKind: targetTransportKind/.test(worldRendererSource)
      && /carYaw: car\.yaw/.test(worldRendererSource)
      && /collisionReverseSeconds/.test(worldRendererSource)
      && /collisionStopSeconds/.test(worldRendererSource)
      && /createPassiveTrafficCars\(requestId,\s*graph,\s*nextSignature,\s*carSpecs\)/.test(worldRendererSource)
      && /async createPassiveTrafficCars\(requestId,\s*graph,\s*expectedSignature/.test(worldRendererSource)
      && /expectedSignature !== this\.passiveTrafficSignature/.test(worldRendererSource),
    'World renderer should mount and update passive traffic cars with bounded intersection stop-and-turn handling, hitboxes, and route-aware async car loads'
  );

  const hudSource = readRepoText('src/ui/Hud.js');
  const worldBuilderSource = readRepoText('src/world/WorldBuilder.js');
  const worldEditAdapterSource = readRepoText('src/world/createWorldEditAdapter.js');
  const gameSource = readRepoText('src/game/Game.js');
  const passiveTrafficSimulationSource = readRepoText('src/world/passiveTrafficSimulation.js');
  const worldRoomSource = readRepoText('server/src/WorldRoom.js');
  const colyseusServiceSource = readRepoText('src/npc/NpcServiceColyseus.js');
  const appConfigSource = readRepoText('server/app.config.js');
  const devServerSource = readRepoText('scripts/dev-server.mjs');
  const styleSource = readRepoText('styles.css');
  assert(
    passiveTrafficSimulationSource.includes('export class PassiveTrafficSimulation')
      && passiveTrafficSimulationSource.includes('createPassiveTrafficCarSpecs')
      && worldRoomSource.includes('PassiveTrafficCarState')
      && worldRoomSource.includes('passiveTraffic: {')
      && worldRoomSource.includes('updatePassiveTrafficSimulation')
      && worldRoomSource.includes('publishPassiveTrafficSnapshots')
      && worldRendererSource.includes('setPassiveTrafficServerState')
      && worldRendererSource.includes('passiveTrafficServerActive')
      && worldBuilderSource.includes('setPassiveTrafficServerState')
      && gameSource.includes('state.passiveTraffic')
      && colyseusServiceSource.includes('clonePassiveTrafficCarState'),
    'Passive traffic cars should be server-authored through Colyseus state and rendered from the shared server snapshots'
  );
  assert(
    worldBuilderSource.includes("id: 'traffic-routes'")
      && worldBuilderSource.includes('beginTrafficRouteFromCar')
      && worldBuilderSource.includes('addTrafficRouteCar')
      && worldBuilderSource.includes('selectTrafficRoute')
      && worldBuilderSource.includes('findPassiveTrafficPath')
      && hudSource.includes('data-builder-traffic-map')
      && hudSource.includes('data-builder-traffic-add-car')
      && hudSource.includes('data-builder-traffic-route')
      && hudSource.includes('application/x-vta-traffic-car'),
    'World builder should expose a Traffic Routes tab with map drawing, a route list, and draggable add-new passive car icons'
  );
  assert(
    worldBuilderSource.includes('getPassiveTrafficPlayerCollisionTarget')
      && worldBuilderSource.includes('onPassiveTrafficPlayerCollision')
      && gameSource.includes('handlePassiveTrafficPlayerCollision')
      && gameSource.includes('playPassiveTrafficCrashSound')
      && gameSource.includes('playPassiveTrafficCartoonCrashSound')
      && gameSource.includes('PASSIVE_TRAFFIC_PLAYER_CAR_COLLISION_DAMAGE = 10')
      && gameSource.includes('PASSIVE_TRAFFIC_PLAYER_CAR_CRASH_POPUP_TEXT')
      && gameSource.includes('yaw: Number.isFinite(this.player.object?.rotation?.y)')
      && gameSource.includes('startPassiveTrafficCarCrashCutscene')
      && gameSource.includes('resolvePassiveTrafficCarCrashRecoveryPosition')
      && gameSource.includes('passiveTrafficPlayerStunUntil')
      && gameSource.includes('applyPassiveTrafficHit')
      && worldRendererSource.includes("targetTransportKind === 'car'")
      && worldRendererSource.includes('passiveTrafficHitboxesOverlap(car.object.position, car.yaw, targetPosition, targetYaw)')
      && styleSource.includes('.hud.is-rent-cutscene-active .hud__toast')
      && readRepoText('src/npc/NpcServiceMock.js').includes('position = null')
      && readRepoText('src/npc/NpcServiceColyseus.js').includes("player:passiveTrafficHit")
      && readRepoText('server/src/WorldRoom.js').includes('message.position ?? message'),
    'Passive traffic player collisions should preserve skateboard hits, handle car crashes with a cartoon popup/cutscene, and round-trip health plus recovery position through local and server state'
  );
  assert(
    worldBuilderSource.includes('getTrafficRouteMapDimensions')
      && worldBuilderSource.includes('requestTrafficRouteMapImage({ force: true })')
      && worldBuilderSource.includes('isWorldMapImageFresh')
      && worldBuilderSource.includes('requestWorldMapImage({ force: shouldForce || !imageFresh })')
      && gameSource.includes('ensureFreshWorldMapImage({ force })')
      && gameSource.includes('captureWorldMapIfStale(image)')
      && gameSource.includes('layoutHash')
      && gameSource.includes('createWorldMapLayoutHash')
      && gameSource.includes('isWorldMapImageFreshForCurrentLayout')
      && gameSource.includes('requestWorldMapImage: (options) => this.ensureFreshWorldMapImage(options)'),
    'Phone map and traffic route editor should refresh or recapture the current-layout map image when opened'
  );
  assert(
    appConfigSource.includes('layoutHash: normalizeWorldMapLayoutHash(payload?.layoutHash)')
      && appConfigSource.includes('world-map\\.')
      && devServerSource.includes('world-map\\.'),
    'Generated phone map metadata should persist the layout hash and serve generated map assets without stale cache headers'
  );
  assert(
    hudSource.includes('--traffic-route-map-aspect')
      && hudSource.includes('hud__traffic-route-end')
      && hudSource.includes('hud__traffic-route-waypoint')
      && hudSource.includes('hud__traffic-route-path--preview')
      && hudSource.includes('data-builder-traffic-map-content')
      && hudSource.includes('data-builder-traffic-zoom')
      && hudSource.includes('Add New Car')
      && hudSource.includes('Route List')
      && styleSource.includes('aspect-ratio: var(--traffic-route-map-aspect')
      && styleSource.includes('.hud__traffic-route-path .hud__traffic-route-end')
      && styleSource.includes('.hud__traffic-route-path .hud__traffic-route-waypoint')
      && styleSource.includes('.hud__traffic-route-list-item')
      && styleSource.includes('.hud__traffic-route-car-count')
      && styleSource.includes('overflow: auto;')
      && styleSource.includes('.hud__traffic-route-zoom'),
    'Traffic route editor should render the captured phone map without squashing it, support map zoom/scroll, list saved route cars, add new cars, and mark unfinished route endpoints'
  );
  assert(
    /draftItemId[\s\S]*activeItemId = draftItemId/.test(worldBuilderSource)
      && /activeTrafficRouteId/.test(worldBuilderSource)
      && /createPassiveTrafficRouteId/.test(worldBuilderSource)
      && /trafficRoutePreview/.test(worldBuilderSource)
      && /createTrafficRouteDraftPreview/.test(worldBuilderSource)
      && /waypointNodeIndices/.test(worldBuilderSource)
      && /removeTrafficRouteDraftWaypoint/.test(worldBuilderSource)
      && /trafficRoutePendingRemoveNodeIndex/.test(worldBuilderSource)
      && /rebuildTrafficRouteDraftFromWaypoints/.test(worldBuilderSource)
      && /getTrafficRouteDraftWaypointPoints/.test(worldBuilderSource)
      && /preferredComponentIndex/.test(worldBuilderSource)
      && /selectTrafficRouteCar\(itemId = ''\)[\s\S]*trafficRouteDraft\?\.itemId[\s\S]*trafficRouteDraft = null/.test(worldBuilderSource)
      && /createTrafficRouteDraftPreview\(nodeIndex[\s\S]*if \(nodeIndex === lastNodeIndex\) \{[\s\S]*return null;/.test(worldBuilderSource)
      && /appendTrafficRouteDraftNode\(nodeIndex[\s\S]*if \(nodeIndex === lastNodeIndex\) \{[\s\S]*return false;/.test(worldBuilderSource)
      && /const closingRoute = nodeIndex === firstNodeIndex/.test(worldBuilderSource)
      && /beginTrafficRouteDrawing\(point = null\)[\s\S]*hadOpenDraft[\s\S]*trafficRoutePendingRemoveNodeIndex/.test(worldBuilderSource)
      && /continueTrafficRouteDrawing\(point = null\)[\s\S]*trafficRoutePendingRemoveNodeIndex/.test(worldBuilderSource)
      && /finishTrafficRouteDrawing\(point = null\)[\s\S]*shouldRemoveWaypoint[\s\S]*removeTrafficRouteDraftWaypoint/.test(worldBuilderSource)
      && /beginTrafficRouteDrawing\(point = null\)[\s\S]*activeTrafficRouteCarItemId = this\.state\.trafficRouteDraft\.itemId[\s\S]*continueTrafficRouteDrawing\(point\)/.test(worldBuilderSource)
      && /finishTrafficRouteDrawing\(point = null\)[\s\S]*this\.state\.trafficRouteDrawing = false[\s\S]*this\.updateBuilderHud\(\)/.test(worldBuilderSource),
    'Traffic route editor should keep unfinished drafts selected per route car, prefer reachable road components, preview drag routes, close only at the start node, remove previous waypoints on click release, and leave clicks resumable after pointer-up'
  );
  assert(
    worldEditAdapterSource.includes('updatePassiveTrafficRoutes')
      && readRepoText('server/src/WorldRoom.js').includes('updatePassiveTrafficRoutes')
      && readRepoText('src/npc/NpcServiceMock.js').includes('updatePassiveTrafficRoutes'),
    'Traffic routes should persist through local and multiplayer world edit transports'
  );
}

function assertCarDealerNpc(layout, layoutLabel, carDealershipItem) {
  const dealershipPlacement = findPlacementByItemId(layout.tiles, 'car_dealership_building');
  assert(dealershipPlacement, `${layoutLabel} should include a Car Dealership tile for the car dealer NPC`);
  const rotationQuarterTurns = dealershipPlacement.rotationQuarterTurns ?? 0;
  const dealershipCenter = getTileCenterWorldPosition(
    carDealershipItem,
    dealershipPlacement.cell?.[0] ?? 0,
    dealershipPlacement.cell?.[1] ?? 0,
    rotationQuarterTurns
  );
  const offset = rotateFootprintOffset(
    CAR_DEALERSHIP_DEALER_LOCAL_X,
    CAR_DEALERSHIP_DEALER_LOCAL_Z,
    rotationQuarterTurns
  );
  const expectedPosition = [
    Number((dealershipCenter.x + offset.x).toFixed(2)),
    Number((dealershipCenter.z + offset.z).toFixed(2))
  ];
  const carDealerNpc = findNpcById(layout.npcs, 'npc_car_dealer');
  assert(carDealerNpc, `${layoutLabel} should seed the Car Dealer NPC`);
  assert(carDealerNpc.carDealerEnabled === true, `${layoutLabel} Car Dealer NPC should enable carDealerEnabled`);
  assert(carDealerNpc.name === 'Car Dealer', `${layoutLabel} Car Dealer NPC should be named Car Dealer`);
  assert(carDealerNpc.position?.[0] === expectedPosition[0] && carDealerNpc.position?.[1] === expectedPosition[1], `${layoutLabel} Car Dealer NPC should stand by the dealership counter`);
  assert(carDealerNpc.rotationQuarterTurns === rotationQuarterTurns, `${layoutLabel} Car Dealer NPC should face the showroom door`);
}

function validateKenneyCatalogItems() {
  const expectedIds = [
    'bar_building_wide',
    'school_building',
    'bar_building',
    'bank_building',
    'casino_building',
    'car_dealership_building',
    'pawn_building',
    'offices_building',
    'marthas_grille_building',
    'real_estate_office_building',
    'gym_building',
    'gym_building_large',
    'hospital_building',
    'hospital_building_wide',
    'kenney_detail_awning',
    'kenney_detail_awning_wide',
    'kenney_detail_overhang',
    'kenney_detail_overhang_wide',
    'kenney_detail_parasol_a',
    'kenney_detail_parasol_b'
  ];
  pushLetteredBuildingIds(expectedIds, 'kenney_building_', 'abcdefghijklmn');
  pushLetteredBuildingIds(expectedIds, 'kenney_building_skyscraper_', 'abcde');

  for (const itemId of expectedIds) {
    const item = getBuilderItemById(itemId);
    assert(item, `Kenney catalog item "${itemId}" should exist`);
  }
}

function validateCustomTileCatalogItems() {
  const hospital = getBuilderItemById('hospital_building');
  const wideHospital = getBuilderItemById('hospital_building_wide');
  const assertClose = (actual, expected, message) => {
    assert(Math.abs(Number(actual) - expected) < 0.001, message);
  };
  const assertHospitalGlbProfile = (relativePath, profileNodeName, label) => {
    const glbJson = readGlbJson(relativePath);
    const profileNode = getGlbNodeByName(glbJson, profileNodeName);
    const crossNodes = getGlbNodesByName(glbJson, 'hospital_cross_symbol');
    assert(profileNode, `${label} GLB should expose the form-fitting profile node`);
    assertClose(getGlbNodeLocalScale(profileNode)[1], 1.7, `${label} profile should stretch vertically by 1.7x`);
    assert(crossNodes.length >= 2, `${label} GLB should keep separate hospital cross symbol nodes`);
    for (const crossNode of crossNodes) {
      const crossScale = getGlbNodeLocalScale(crossNode);
      assertClose(crossScale[0], 1 / 0.9, `${label} cross symbol should compensate the profile width scale`);
      assertClose(crossScale[1], 1 / 1.7, `${label} cross symbol should compensate the profile height stretch`);
      assertClose(crossScale[2], 1 / 0.93, `${label} cross symbol should compensate the profile depth scale`);
    }
  };

  assert(hospital, 'Hospital tile should exist');
  assert(wideHospital, 'Wide hospital tile should exist');
  assert(hospital.movementCollisionRects?.length === 3, 'Hospital should use form-fitting movement colliders instead of the full lot footprint');
  assert(wideHospital.movementCollisionRects?.length === 5, 'Wide hospital should use form-fitting movement colliders instead of a full 2x1 box');
  assert(hospital.shotCollisionRects?.length === hospital.movementCollisionRects.length, 'Hospital shot collision should match its rebuilt silhouette');
  assert(wideHospital.shotCollisionRects?.length === wideHospital.movementCollisionRects.length, 'Wide hospital shot collision should match its rebuilt silhouette');
  assert(getMaxCollisionRectY(hospital.movementCollisionRects) >= 29, 'Hospital collision height should cover the 1.7x rebuilt profile');
  assert(getMaxCollisionRectY(wideHospital.movementCollisionRects) >= 29, 'Wide hospital collision height should cover the 1.7x rebuilt profile');
  assertHospitalGlbProfile(
    'assets/vibe_theft_auto_custom/models/hospital-building.glb',
    'hospital_building_form_fit',
    'Hospital'
  );
  assertHospitalGlbProfile(
    'assets/vibe_theft_auto_custom/models/hospital-building-wide.glb',
    'hospital_building_wide_form_fit',
    'Wide hospital'
  );

  const hospitalCollisionRects = placementToCollisionRects(
    { itemId: hospital.id, layer: 'tile', cellX: 0, cellZ: 0, rotationQuarterTurns: 0 },
    hospital,
    { collisionKey: 'blocksMovement' }
  );
  const wideHospitalCollisionRects = placementToCollisionRects(
    { itemId: wideHospital.id, layer: 'tile', cellX: 0, cellZ: 0, rotationQuarterTurns: 0 },
    wideHospital,
    { collisionKey: 'blocksMovement' }
  );
  assert(getRectSpan(hospitalCollisionRects, 'x') < hospital.size[0] * 0.82, 'Hospital collision width should leave lot margin around the rebuilt structure');
  assert(getRectSpan(hospitalCollisionRects, 'z') < hospital.size[1] * 0.82, 'Hospital collision depth should leave lot margin around the rebuilt structure');
  assert(getRectSpan(wideHospitalCollisionRects, 'x') < wideHospital.size[0] * 0.9, 'Wide hospital collision width should leave lot margin around the rebuilt structure');
  assert(getRectSpan(wideHospitalCollisionRects, 'z') < wideHospital.size[1] * 0.82, 'Wide hospital collision depth should leave lot margin around the rebuilt structure');

  const basketballCourt = getBuilderItemById('basketball_court_half');
  assert(basketballCourt, 'Basketball half-court tile should exist');
  assert(getBuilderItemById('basketball_half_court') === basketballCourt, 'Basketball half court should resolve from the natural slug alias');
  assert(getBuilderItemById('half_basketball_court') === basketballCourt, 'Basketball half court should resolve from the half-court slug alias');
  assert(getBuilderItemById('Basketball Half Court') === basketballCourt, 'Basketball half court should resolve from the label used in builder workflows');
  assert(basketballCourt.layer === 'tile', 'Basketball half court should be a tile catalog item');
  assert(basketballCourt.groupId === 'parks', 'Basketball half court should be grouped under Parks');
  assert(basketballCourt.asset === null, 'Basketball half court should use a procedural visual');
  assert(typeof basketballCourt.createVisual === 'function', 'Basketball half court should define a procedural visual');
  assert(basketballCourt.collision === false, 'Basketball half court should not block movement');
  assert(basketballCourt.blocksMovement === false, 'Basketball half court should keep movement open');
  assert(basketballCourt.blocksShots === false, 'Basketball half court should not block shots');
  assert(basketballCourt.tileFootprint[0] === 1 && basketballCourt.tileFootprint[1] === 1, 'Basketball half court should remain a 1x1 tile');
  assert(basketballCourt.size[0] === BUILDER_TILE_SIZE && basketballCourt.size[1] === BUILDER_TILE_SIZE, 'Basketball half court should fill one builder tile');
  assert(basketballCourt.surfaceHeight === BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT, 'Basketball half court should expose a stable tile surface height');

  const courtVisual = basketballCourt.createVisual();
  const surface = courtVisual.getObjectByName('basketballCourtHalfSurface');
  const centerLine = courtVisual.getObjectByName('basketballCourtHalfCenterLine');
  const centerArc = courtVisual.getObjectByName('basketballCourtHalfCenterCircleArc');
  const keyPaint = courtVisual.getObjectByName('basketballCourtHalfKeyPaint');
  const threePointArc = courtVisual.getObjectByName('basketballCourtHalfThreePointArc');
  const hoopMarker = courtVisual.getObjectByName('basketballCourtHalfHoopMarker');

  assert(surface, 'Basketball half court visual should include a named slab surface');
  assert(centerLine, 'Basketball half court visual should include a half-court center line');
  assert(centerArc, 'Basketball half court visual should include the center-circle half arc');
  assert(keyPaint, 'Basketball half court visual should include painted key area');
  assert(threePointArc, 'Basketball half court visual should include a three-point arc');
  assert(hoopMarker, 'Basketball half court visual should include a centered hoop placement marker');
  assert(centerLine.position.z > 6, 'Basketball half court center line should sit on the pairing edge of the tile');
  assert(keyPaint.position.z < 0, 'Basketball half court key should sit on the hoop half of the tile');

  const bounds = new Box3().setFromObject(courtVisual);
  const size = bounds.getSize(new Vector3());
  assert(Math.abs(size.x - BUILDER_TILE_SIZE) < 0.001, 'Basketball half court visual should fill one tile width');
  assert(Math.abs(size.z - BUILDER_TILE_SIZE) < 0.001, 'Basketball half court visual should fill one tile depth');
  assert(Math.abs(bounds.min.x + bounds.max.x) < 0.001, 'Basketball half court visual should be symmetrical left-to-right');

  const arcBounds = new Box3().setFromObject(threePointArc);
  assert(Math.abs(arcBounds.min.x + arcBounds.max.x) < 0.05, 'Basketball half court three-point arc should be symmetrical');
}

function validateCustomPropCatalogItems() {
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = readFileSync(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const worldBuilderSource = readFileSync(new URL('../src/world/WorldBuilder.js', import.meta.url), 'utf8');
  const worldStateSource = readFileSync(new URL('../src/world/WorldState.js', import.meta.url), 'utf8');

  const portal = VIBE_JAM_PORTAL_INTERACTABLE.portal;
  const portalSpawnOffset = portal.spawnLocalOffset ?? [0, 0];
  const portalSpawnDistance = Math.hypot(portalSpawnOffset[0] ?? 0, portalSpawnOffset[1] ?? 0);
  const portalSafeRearmDistance = (portal.triggerRadius ?? 0) + PLAYER_RADIUS + 0.75;
  assert(
    portalSpawnDistance > portalSafeRearmDistance,
    'Vibe Jam portal spawn point should be outside the trigger re-arm radius to prevent return loops'
  );
  assert(
    /writeSpeechBubbleRecord\([\s\S]*speakerKey = '',\s*tone = '',\s*opacity = undefined[\s\S]*bubble\.tone = tone[\s\S]*bubble\.opacity = Number\.isFinite\(Number\(opacity\)\)/.test(gameSource)
      && /speakerKey \|\| label \|\| id,\s*tone,\s*opacity/.test(gameSource),
    'Speech bubble records should accept and forward tone/opacity parameters so floaters cannot crash the frame loop'
  );

  const pistolPickup = getBuilderItemById(COMBAT_PICKUP_PROP_ITEM_IDS.pistol);
  assert(pistolPickup, 'Pistol pickup prop should exist');
  assert(pistolPickup.layer === 'prop', 'Pistol pickup should be a prop catalog item');
  assert(pistolPickup.groupId === 'combat', 'Pistol pickup should be grouped under Combat');
  assert(pistolPickup.collision === false, 'Pistol pickup should not block movement');
  assert(pistolPickup.blocksShots === false, 'Pistol pickup should not block shots');
  assert(typeof pistolPickup.createVisual === 'function', 'Pistol pickup should define a procedural builder visual');
  assert(pistolPickup.combatPickup?.weaponId === WEAPON_IDS.pistol, 'Pistol pickup should spawn pistol ammo');
  assert(pistolPickup.combatPickup?.ammoInClip === WEAPON_CLIP_SIZE, 'Pistol pickup should spawn a full clip');
  assert(pistolPickup.combatPickup?.reserveAmmo === WEAPON_RESERVE_CAP, 'Pistol pickup should spawn full reserve ammo');
  const pickupVisual = pistolPickup.createVisual();
  assert(pickupVisual.getObjectByName('pistolPickupSpawnRing'), 'Pistol pickup visual should include a placement ring');
  assert(pickupVisual.getObjectByName('pistolPickupSpawnBase'), 'Pistol pickup visual should include a small base');
  const propRotationState = new WorldState();
  const propPlacement = propRotationState.placeProp(pistolPickup, 0, 0, 0);
  const firstRotatedProp = propRotationState.rotatePlacement(propPlacement.id).placement;
  const expectedFirstPropRotationY = rotationEighthTurnsToRadians(1);
  assert(
    angleDelta(firstRotatedProp.rotationY, expectedFirstPropRotationY) <= 0.002,
    'World state should rotate selected props in 45-degree increments'
  );
  assert(
    firstRotatedProp.rotationQuarterTurns === rotationRadiansToQuarterTurns(expectedFirstPropRotationY),
    'World state should keep a compatible quarter-turn fallback when selected props rotate diagonally'
  );
  const secondRotatedProp = propRotationState.rotatePlacement(propPlacement.id).placement;
  assert(
    angleDelta(secondRotatedProp.rotationY, Math.PI / 2) <= 0.002,
    'Two selected prop rotations should equal a 90-degree turn'
  );
  assert(
    /propRotationEighthTurns/.test(worldBuilderSource)
      && /rotationY:\s*quantizeRotation\(rotationY\)/.test(worldBuilderSource),
    'World builder should place props with exact 45-degree rotationY values'
  );
  assert(
    /if\s*\(this\.shouldPlaceActiveItemOverHoveredPlacement\(hoveredPlacement\)\)\s*\{[\s\S]*?void this\.placeCurrentItem\(\);[\s\S]*?\}\s*if\s*\(hoveredPlacement\)/.test(worldBuilderSource),
    'World builder should let active prop placement win over hovered object selection'
  );
  const propOverlapPreviewUsages = worldBuilderSource.match(/shouldPreviewHoveredPlacement\(hoveredPlacement\)/g)?.length ?? 0;
  assert(
    propOverlapPreviewUsages >= 2,
    'World builder should keep the active prop preview when placing over hovered objects'
  );
  assert(
    /PROP_ROTATION_STEP_RADIANS\s*=\s*Math\.PI\s*\/\s*4/.test(worldStateSource),
    'World state selected prop rotation should use a 45-degree step'
  );
  assert(
    worldBuilderSource.includes("input?.isPressed?.('ShiftLeft')")
      && worldBuilderSource.includes("input?.isPressed?.('ShiftRight')")
      && worldBuilderSource.includes('findNearestAdjacentPropSnapPoint'),
    'World builder should support holding Shift to snap active props to adjacent identical props'
  );
  assert(
    worldBuilderSource.includes("input?.isPressed?.('CapsLock')")
      && /if\s*\(this\.isIdentifyModifierActive\(\)\)\s*\{[\s\S]*?this\.selectPlacement\(hoveredPlacement\.id\)[\s\S]*?return;[\s\S]*?\}/.test(worldBuilderSource),
    'World builder should support holding Caps Lock to identify hovered placements instead of placing the active prop'
  );

  const bankFurnitureProps = [
    {
      id: 'bank_teller_counter',
      label: 'Bank Teller Counter',
      size: BANK_TELLER_COUNTER_FOOTPRINT,
      collision: true,
      blocksMovement: true,
      blocksShots: true,
      padding: 0.28,
      requiredParts: ['bankTellerCounterBase', 'bankTellerCounterTop', 'bankTellerCounterPrivacyWall'],
      whitePart: 'bankTellerCounterBase',
      minHeight: 1.9,
      visualMovementBlocker: true
    },
    {
      id: 'bank_sitting_chair',
      label: 'Bank Sitting Chair',
      size: BANK_SITTING_CHAIR_FOOTPRINT,
      collision: false,
      blocksMovement: false,
      blocksShots: false,
      requiredParts: ['bankSittingChairSeat', 'bankSittingChairBack', 'bankSittingChairLeg'],
      whitePart: 'bankSittingChairSeat',
      minHeight: 1.35
    },
    {
      id: 'bank_lobby_table',
      label: 'Bank Lobby Table',
      size: BANK_LOBBY_TABLE_FOOTPRINT,
      collision: true,
      blocksMovement: true,
      blocksShots: true,
      requiredParts: ['bankLobbyTableTop', 'bankLobbyTablePedestal', 'bankLobbyTableBase'],
      whitePart: 'bankLobbyTableTop',
      minHeight: 0.82
    }
  ];
  for (const definition of bankFurnitureProps) {
    const item = getBuilderItemById(definition.id);
    assert(item, `${definition.label} builder prop should exist`);
    assert(getBuilderItemById(definition.label) === item, `${definition.label} should resolve from its display label`);
    assert(item.layer === 'prop', `${definition.label} should be a prop catalog item`);
    assert(item.groupId === 'bank', `${definition.label} should be grouped under Bank props`);
    assert(item.asset === null, `${definition.label} should use a procedural visual`);
    assert(typeof item.createVisual === 'function', `${definition.label} should define a procedural visual`);
    assert(item.collision === definition.collision, `${definition.label} collision flag should match its intended use`);
    assert(item.blocksMovement === definition.blocksMovement, `${definition.label} movement blocking should match its intended use`);
    assert(item.blocksShots === definition.blocksShots, `${definition.label} shot blocking should match its intended use`);
    if (typeof definition.padding === 'number') {
      assert(item.padding === definition.padding, `${definition.label} should reserve extra collision padding`);
    }
    const propTestPlacement = {
      id: `validate-${definition.id}`,
      itemId: definition.id,
      layer: 'prop',
      position: [0, 0],
      rotationY: 0,
      scale: 1
    };
    assert(
      (placementToCollisionRects(propTestPlacement, item, { collisionKey: 'blocksMovement' }).length > 0) === definition.blocksMovement,
      `${definition.label} should resolve movement collision from its catalog definition`
    );
    assert(
      (placementToCollisionRects(propTestPlacement, item, { collisionKey: 'blocksShots' }).length > 0) === definition.blocksShots,
      `${definition.label} should resolve shot collision from its catalog definition`
    );
    assert(
      Math.abs(item.size[0] - definition.size[0]) < 0.001
        && Math.abs(item.size[1] - definition.size[1]) < 0.001,
      `${definition.label} should use its procedural footprint`
    );

    const visual = item.createVisual();
    assert(visual.userData.footprint?.[0] === definition.size[0], `${definition.label} visual should expose footprint width metadata`);
    assert(visual.userData.footprint?.[1] === definition.size[1], `${definition.label} visual should expose footprint depth metadata`);
    if (definition.visualMovementBlocker) {
      assert(visual.userData.blocksMovement === true, `${definition.label} visual should mark itself as movement-blocking metadata`);
      assert(visual.userData.blocksShots === true, `${definition.label} visual should mark itself as shot-blocking metadata`);
    }
    for (const partName of definition.requiredParts) {
      assert(visual.getObjectByName(partName), `${definition.label} visual should include ${partName}`);
    }
    const whitePart = visual.getObjectByName(definition.whitePart);
    assert(
      whitePart?.material?.color?.getHex() === 0xf7f8f3 || whitePart?.material?.color?.getHex() === 0xfffff8,
      `${definition.label} should render as white bank furniture`
    );
    const bounds = new Box3().setFromObject(visual);
    const visualSize = bounds.getSize(new Vector3());
    assert(bounds.min.y >= -0.001, `${definition.label} should sit on local ground`);
    assert(visualSize.y >= definition.minHeight, `${definition.label} should have practical in-world height`);
    assert(visualSize.x <= definition.size[0] + 0.001, `${definition.label} should stay inside its footprint width`);
    assert(visualSize.z <= definition.size[1] + 0.001, `${definition.label} should stay inside its footprint depth`);
  }

  const sidewalkItem = getBuilderItemById('sidewalk');
  const sidewalkSnap = findNearestAdjacentPropSnapPoint({
    point: { x: SIDEWALK_PROP_FOOTPRINT[0] - 0.2, z: 0.15 },
    placements: [
      {
        id: 'snap-sidewalk-a',
        itemId: sidewalkItem.id,
        layer: 'prop',
        position: [0, 0],
        rotationY: 0,
        scale: 1
      }
    ],
    activeItem: sidewalkItem,
    activeScale: 1,
    activeRotationY: 0,
    getItemById: getBuilderItemById
  });
  assert(
    Math.abs(sidewalkSnap?.x - SIDEWALK_PROP_FOOTPRINT[0]) <= 0.001 && Math.abs(sidewalkSnap?.z) <= 0.001,
    'Shift snapping should connect a new sidewalk directly to the nearest sidewalk edge'
  );
  const sidewalkCrossSnap = findNearestAdjacentPropSnapPoint({
    point: { x: 0.1, z: -SIDEWALK_PROP_FOOTPRINT[1] + 0.2 },
    placements: [
      {
        id: 'snap-sidewalk-a',
        itemId: sidewalkItem.id,
        layer: 'prop',
        position: [0, 0],
        rotationY: 0,
        scale: 1
      }
    ],
    activeItem: sidewalkItem,
    activeScale: 1,
    activeRotationY: 0,
    getItemById: getBuilderItemById
  });
  assert(
    Math.abs(sidewalkCrossSnap?.x) <= 0.001 && Math.abs(sidewalkCrossSnap?.z + SIDEWALK_PROP_FOOTPRINT[1]) <= 0.001,
    'Shift snapping should also connect matching props across their depth edge'
  );
  const farSidewalkSnap = findNearestAdjacentPropSnapPoint({
    point: { x: 80, z: 80 },
    placements: [
      {
        id: 'snap-sidewalk-a',
        itemId: sidewalkItem.id,
        layer: 'prop',
        position: [0, 0],
        rotationY: 0,
        scale: 1
      }
    ],
    activeItem: sidewalkItem,
    activeScale: 1,
    activeRotationY: 0,
    getItemById: getBuilderItemById
  });
  assert(farSidewalkSnap === null, 'Shift snapping should leave distant prop placement under the cursor');

  const flatSurfaceProps = [
    {
      id: 'sidewalk',
      label: 'Sidewalk',
      size: SIDEWALK_PROP_FOOTPRINT,
      surfaceName: 'sidewalkSurface'
    },
    {
      id: 'stone_path',
      label: 'Stone Path',
      size: STONE_PATH_PROP_FOOTPRINT,
      surfaceName: 'stonePathGroundUnderlay'
    },
    {
      id: 'dirt_path',
      label: 'Dirt Path',
      size: DIRT_PATH_PROP_FOOTPRINT,
      surfaceName: 'dirtPathSurface'
    }
  ];

  for (const { id, label, size: expectedSize, surfaceName } of flatSurfaceProps) {
    const item = getBuilderItemById(id);
    assert(item, `${label} prop should exist`);
    assert(getBuilderItemById(label) === item, `${label} should resolve from the label used in builder workflows`);
    assert(item.layer === 'prop', `${label} should be a prop catalog item`);
    assert(item.groupId === 'street', `${label} should be grouped under Street props`);
    assert(item.asset === null, `${label} should use a procedural visual`);
    assert(typeof item.createVisual === 'function', `${label} should define a procedural visual`);
    assert(item.collision === false, `${label} should not block movement`);
    assert(item.blocksMovement === false, `${label} should keep movement open`);
    assert(item.blocksShots === false, `${label} should not block shots`);
    assert(item.groundClearance > 0 && item.groundClearance <= 0.03, `${label} should render just above the ground to avoid z-fighting`);
    assert(
      item.size[0] === expectedSize[0] && item.size[1] === expectedSize[1],
      `${label} should use its flat path footprint`
    );

    const movementRects = placementToCollisionRects(
      { itemId: item.id, layer: 'prop', position: [4, -8], rotationQuarterTurns: 1 },
      item,
      { collisionKey: 'blocksMovement' }
    );
    const shotRects = placementToCollisionRects(
      { itemId: item.id, layer: 'prop', position: [4, -8], rotationQuarterTurns: 1 },
      item,
      { collisionKey: 'blocksShots' }
    );
    assert(movementRects.length === 0, `${label} should not create movement colliders`);
    assert(shotRects.length === 0, `${label} should not create shot colliders`);

    const visual = item.createVisual();
    assert(visual.userData.flatGroundProp === true, `${label} visual should mark itself as a flat ground prop`);
    assert(visual.getObjectByName(surfaceName), `${label} visual should include a named flat surface`);
    const bounds = new Box3().setFromObject(visual);
    const visualSize = bounds.getSize(new Vector3());
    assert(visualSize.y <= 0.03, `${label} visual should stay completely flat`);
    assert(bounds.min.y >= -0.001, `${label} visual should sit on or just above local ground`);
    assert(visualSize.x <= expectedSize[0] + 0.001, `${label} visual should stay inside its footprint width`);
    assert(visualSize.z <= expectedSize[1] + 0.001, `${label} visual should stay inside its footprint depth`);
  }

  const dirtPathVisual = getBuilderItemById('dirt_path').createVisual();
  const dirtPathMeshes = [];
  dirtPathVisual.traverse((node) => {
    if (node.isMesh) {
      dirtPathMeshes.push(node);
    }
  });
  const dirtPathSurface = dirtPathVisual.getObjectByName('dirtPathSurface');
  assert(dirtPathMeshes.length === 1, 'Dirt Path visual should be one simple flat surface without middle designs');
  assert(
    dirtPathSurface?.material?.color?.getHex() === 0xd9bd73,
    'Dirt Path should use a light yellow park-path color'
  );
  assert(!dirtPathVisual.getObjectByName('dirtPathPackedTrackLeft'), 'Dirt Path should not include dark packed track strips');
  assert(!dirtPathVisual.getObjectByName('dirtPathDryCenter'), 'Dirt Path should not include a center design strip');

  const stonePathVisual = getBuilderItemById('stone_path').createVisual();
  const stonePathPavers = [];
  stonePathVisual.traverse((node) => {
    if (node.isMesh && /^stonePathPaver\d+$/u.test(node.name)) {
      stonePathPavers.push(node);
    }
  });
  assert(stonePathPavers.length === 21, 'Stone Path visual should use a full uniform grid of pavers');
  assert(!stonePathVisual.getObjectByName('stonePathMossLeftEdge'), 'Stone Path should not rely on moss edge decoration');
  const stonePaverSizeSpread = getStonePaverSizeSpread(stonePathPavers);
  assert(stonePaverSizeSpread.width < 0.001 && stonePaverSizeSpread.depth < 0.001, 'Stone Path pavers should be uniform in size');

  const vibeJamExitPortal = getBuilderItemById('vibe_jam_exit_portal');
  const vibeJamStartPortal = getBuilderItemById('vibe_jam_start_portal');
  const vibeJamPortals = [
    { item: vibeJamExitPortal, role: 'exit' },
    { item: vibeJamStartPortal, role: 'start' }
  ];
  for (const { item, role } of vibeJamPortals) {
    assert(item, `Vibe Jam ${role} portal prop should exist`);
    assert(item.layer === 'prop', `Vibe Jam ${role} portal should be a prop catalog item`);
    assert(item.groupId === 'portals', `Vibe Jam ${role} portal should be grouped under Portals`);
    assert(item.interactable?.portal?.role === role, `Vibe Jam ${role} portal should preserve its portal role`);
    const spawnOffset = item.interactable?.portal?.spawnLocalOffset;
    const triggerRadius = Number(item.interactable?.portal?.triggerRadius);
    const promptRadius = Number(item.interactable?.radius);
    const spawnDistance = Array.isArray(spawnOffset)
      ? Math.hypot(Number(spawnOffset[0]), Number(spawnOffset[1]))
      : 0;
    assert(
      spawnDistance >= triggerRadius + PLAYER_RADIUS + 4,
      `Vibe Jam ${role} portal spawn should place arrivals far enough outside the redirect trigger`
    );
    assert(
      spawnDistance > promptRadius,
      `Vibe Jam ${role} portal spawn should place arrivals beyond the portal prompt halo`
    );
  }

  const olympicBarbell = getBuilderItemById('olympic_barbell');
  assert(olympicBarbell, 'Olympic barbell prop should exist');
  assert(olympicBarbell.layer === 'prop', 'Olympic barbell should be a prop catalog item');
  assert(olympicBarbell.groupId === 'fitness', 'Olympic barbell should be grouped under Fitness');
  assert(olympicBarbell.interactable?.workoutType === 'snatch', 'Olympic barbell should launch the snatch workout');
  assert(olympicBarbell.interactable?.prompt === 'Snatch barbell', 'Olympic barbell should prompt the player to snatch');
  assert(Array.isArray(olympicBarbell.interactable?.approachLocalOffset), 'Olympic barbell should define a lift approach point');
  assert(Math.abs(olympicBarbell.size[0] - OLYMPIC_BARBELL_FOOTPRINT[0]) < 0.001, 'Olympic barbell catalog size should match the procedural footprint width');
  assert(Math.abs(olympicBarbell.size[1] - OLYMPIC_BARBELL_FOOTPRINT[1]) < 0.001, 'Olympic barbell catalog size should match the procedural footprint depth');
  assert(SNATCH_WORKOUT_KIND === 'snatch-workout', 'Snatch workout kind should match prop interactable naming');
  assert(gameSource.includes('updateSnatchWorkoutCamera'), 'Game should use a zoomed horizontal snatch workout camera');
  assert(gameSource.includes('getSnatchWorkoutCameraDistance'), 'Snatch camera should fit the full barbell across the frame');

  const basketballHoop = getBuilderItemById('basketball_hoop');
  assert(basketballHoop, 'Basketball hoop prop should exist');
  assert(basketballHoop.layer === 'prop', 'Basketball hoop should be a prop catalog item');
  assert(basketballHoop.groupId === 'fitness', 'Basketball hoop should be grouped under Fitness');
  assert(basketballHoop.collision === true, 'Basketball hoop should block movement like a grounded prop');
  assert(basketballHoop.movementCollisionRects?.length === 1, 'Basketball hoop movement collision should use a custom base/pole rect');
  assert(basketballHoop.shotCollisionRects?.length === 1, 'Basketball hoop shot collision should use the same base/pole rect');
  const hoopCollisionRect = basketballHoop.movementCollisionRects[0];
  assert(hoopCollisionRect.halfWidth <= 0.4 && hoopCollisionRect.halfDepth <= 0.4, 'Basketball hoop movement collision should stay tight to the base/pole');
  assert(hoopCollisionRect.centerZ < -1.2, 'Basketball hoop movement collision should be centered on the rear pole, not the backboard footprint');
  assert(basketballHoop.interactable?.workoutType === 'basketball-shot', 'Basketball hoop should launch the basketball shot workout');
  assert(basketballHoop.interactable?.prompt === 'Shoot basketball', 'Basketball hoop should prompt the player to shoot');
  assert(basketballHoop.interactable?.hideDuringWorkout === false, 'Basketball hoop should stay visible during the shot game');
  assert(Array.isArray(basketballHoop.interactable?.approachLocalOffset), 'Basketball hoop should define a shot approach point');
  assert(basketballHoop.interactable.approachLocalOffset[1] > 4, 'Basketball hoop approach point should put the shooter in front of the rim');
  assert(typeof basketballHoop.createVisual === 'function', 'Basketball hoop should define a procedural visual');
  assert(
    Array.isArray(basketballHoop.size)
      && basketballHoop.size[0] >= 3.4
      && basketballHoop.size[1] >= 3.4,
    'Basketball hoop should reserve a practical world-builder footprint'
  );

  const hoopVisual = basketballHoop.createVisual();
  const rim = hoopVisual.getObjectByName('basketballHoopOrangeRim');
  const pole = hoopVisual.getObjectByName('basketballHoopGroundPole');
  const removedPortableParts = [
    'basketballHoopWeightedBase',
    'basketballHoopBaseTopPanel',
    'basketballHoopBaseFrontSlope',
    'basketballHoopInnerPole',
    'basketballHoopHeightCollarLower',
    'basketballHoopHeightCollarUpper'
  ];

  assert(rim, 'Basketball hoop visual should include a named rim');
  assert(pole, 'Basketball hoop visual should use a grounded metal pole');
  assert(Math.abs(rim.position.y - BASKETBALL_HOOP_RIM_HEIGHT) < 0.001, 'Basketball hoop rim height should stay anchored to the regulation-scale constant');
  for (const partName of removedPortableParts) {
    assert(!hoopVisual.getObjectByName(partName), `Basketball hoop should not include portable-base part "${partName}"`);
  }
  let portableWheelName = '';
  hoopVisual.traverse((child) => {
    if (!portableWheelName && typeof child.name === 'string' && child.name.startsWith('basketballHoopBaseWheel')) {
      portableWheelName = child.name;
    }
  });
  assert(!portableWheelName, `Basketball hoop should not include portable-base wheel "${portableWheelName}"`);

  const bounds = new Box3().setFromObject(hoopVisual);
  const poleBounds = new Box3().setFromObject(pole);
  const size = bounds.getSize(new Vector3());
  const footprintScale = Math.min(basketballHoop.size[0] / size.x, basketballHoop.size[1] / size.z);
  const preparedRimHeight = rim.position.y * footprintScale;
  assert(poleBounds.min.y >= -0.001 && poleBounds.min.y <= 0.001, 'Basketball hoop pole should begin at ground level');
  assert(preparedRimHeight >= 7.45 && preparedRimHeight <= 7.65, 'Basketball hoop rim should read as a 10ft hoop against the character model after footprint fitting');

  const hoopTestPlacement = {
    itemId: basketballHoop.id,
    layer: 'prop',
    position: [12, -5],
    rotationQuarterTurns: 0
  };
  const [worldCollisionRect] = placementToCollisionRects(
    hoopTestPlacement,
    basketballHoop,
    { collisionKey: 'blocksMovement' }
  );
  assert(worldCollisionRect, 'Basketball hoop movement collision should resolve for prop placements');
  assert(Math.abs(worldCollisionRect.x - hoopTestPlacement.position[0]) < 0.001, 'Basketball hoop prop collision should be relative to placement x');
  assert(
    Math.abs(worldCollisionRect.z - (hoopTestPlacement.position[1] + hoopCollisionRect.centerZ)) < 0.001,
    'Basketball hoop prop collision should be relative to the pole position'
  );
  const scaledHoopPlacement = {
    ...hoopTestPlacement,
    scale: 1.5
  };
  const [scaledWorldCollisionRect] = placementToCollisionRects(
    scaledHoopPlacement,
    basketballHoop,
    { collisionKey: 'blocksMovement' }
  );
  assert(scaledWorldCollisionRect, 'Scaled basketball hoop movement collision should resolve');
  assert(normalizePropPlacementScale(999) === PROP_PLACEMENT_SCALE_MAX, 'Prop placement scale should clamp oversized inputs');
  assert(normalizePropPlacementScale(0) === PROP_PLACEMENT_SCALE_MIN, 'Prop placement scale should clamp undersized inputs');
  assert(
    Math.abs(scaledWorldCollisionRect.halfWidth - (worldCollisionRect.halfWidth * scaledHoopPlacement.scale)) < 0.001,
    'Scaled prop movement collision should grow with the placement size'
  );
  assert(hudSource.includes('data-builder-prop-size'), 'World builder HUD should expose a prop size slider');
  assert(worldBuilderSource.includes('onPropSizeChange'), 'World builder should bind prop size slider input');
  assert(worldStateSource.includes('updatePlacementScale'), 'World state should support persisted prop scale updates');
  assert(BASKETBALL_SHOT_WORKOUT_KIND === 'basketball-shot-workout', 'Basketball shot workout kind should match prop interactable naming');
  assert(BASKETBALL_SHOT_DURATION_MS >= 5000, 'Basketball shot should leave enough time to read the NBA2K-style release meter');
  assert(gameSource.includes('BASKETBALL_SHOT_CLEAN_WINDOW'), 'Game should define a clean-release timing window');
  assert(gameSource.includes('updateBasketballShotCamera'), 'Game should use a zoomed 3D basketball shot camera');
  assert(gameSource.includes('createBasketballShotBall'), 'Game should spawn a 3D basketball for shot attempts');
  assert(hudSource.includes('hud__basketball-shot-meter'), 'HUD should render the basketball half-circle shot meter');

  const treadmill = getBuilderItemById('treadmill');
  assert(treadmill, 'Treadmill prop should exist');
  assert(treadmill.layer === 'prop', 'Treadmill should be a prop catalog item');
  assert(treadmill.groupId === 'fitness', 'Treadmill should be grouped under Fitness');
  assert(treadmill.collision === false, 'Treadmill should keep the belt walkable for the running minigame');
  assert(treadmill.blocksMovement === false, 'Treadmill should not block movement while approaching the belt');
  assert(treadmill.blocksShots === false, 'Treadmill should not block shots');
  assert(treadmill.interactable?.workoutType === 'treadmill', 'Treadmill should launch the treadmill workout');
  assert(treadmill.interactable?.prompt === 'Run treadmill', 'Treadmill should prompt the player to run');
  assert(treadmill.interactable?.hideDuringWorkout === false, 'Treadmill should stay visible during the rhythm run');
  assert(Array.isArray(treadmill.interactable?.approachLocalOffset), 'Treadmill should define an on-belt approach point');
  assert(Math.abs(treadmill.size[0] - TREADMILL_FOOTPRINT[0]) < 0.001, 'Treadmill catalog size should match the procedural footprint width');
  assert(Math.abs(treadmill.size[1] - TREADMILL_FOOTPRINT[1]) < 0.001, 'Treadmill catalog size should match the procedural footprint depth');
  assert(typeof treadmill.createVisual === 'function', 'Treadmill should define a procedural visual');
  const treadmillVisual = treadmill.createVisual();
  assert(treadmillVisual.getObjectByName('treadmillRunningBelt'), 'Treadmill visual should include a named running belt');
  assert(treadmillVisual.getObjectByName('treadmillFrontRoller'), 'Treadmill visual should include a named front roller');
  assert(treadmillVisual.getObjectByName('treadmillConsoleScreen'), 'Treadmill visual should include a console screen');
  assert(typeof treadmillVisual.userData.onWorldUpdate === 'function', 'Treadmill visual should animate its belt in world updates');
  assert(TREADMILL_WORKOUT_KIND === 'treadmill-workout', 'Treadmill workout kind should match prop interactable naming');
  assert(TREADMILL_DURATION_MS === 3000, 'Treadmill rhythm run should last exactly three seconds');
  assert(gameSource.includes('TREADMILL_RUN_COUNTDOWN_MS = 3000'), 'Treadmill run should include a three second countdown before scoring starts');
  assert(gameSource.includes('TREADMILL_RUN_MIN_BPM = 100'), 'Treadmill rhythm run should choose BPM no lower than 100');
  assert(gameSource.includes('TREADMILL_RUN_MAX_BPM = 140'), 'Treadmill rhythm run should choose BPM no higher than 140');
  assert(gameSource.includes('TREADMILL_RUN_REWARD_SCORE = 70'), 'Treadmill rhythm run should complete on scores over 70%');
  assert(gameSource.includes('run.awardXp = run.score > TREADMILL_RUN_REWARD_SCORE'), 'Treadmill rhythm run should require scores over the completion threshold');
  assert(gameSource.includes("'Nice Run!'"), 'Successful treadmill rhythm runs should say Nice Run');
  assert(gameSource.includes('Nice Run! Treadmill score'), 'Successful treadmill rhythm completion toasts should say Nice Run');
  assert(hudSource.includes("'Nice Run!'"), 'HUD should label successful treadmill rhythm completions as Nice Run');
  assert(!gameSource.includes('TREADMILL_RUN_BPM_PATTERN'), 'Treadmill rhythm run should not change BPM through an elapsed-time pattern');
  assert(/const bpm = createRandomTreadmillRunBpm\(\)[\s\S]*createTreadmillRunBeatSchedule\(\{[\s\S]*bpm[\s\S]*createTreadmillRunCountdownBeatSchedule\(\{[\s\S]*bpm[\s\S]*this\.activeWorkout\.treadmillRun = \{[\s\S]*bpm,/.test(gameSource), 'Treadmill rhythm run should store one randomly chosen BPM for countdown and scoring');
  assert(/getTreadmillRunBpm\(run = this\.activeWorkout\?\.treadmillRun[\s\S]*return normalizeTreadmillRunBpm\(run\?\.bpm/.test(gameSource), 'Treadmill rhythm run should report the stored BPM instead of recalculating a new speed');
  assert(gameSource.includes("phase: 'countdown'"), 'Treadmill run should begin in a countdown phase before the scored run');
  assert(gameSource.includes('createTreadmillRunCountdownBeatSchedule'), 'Treadmill countdown should use a BPM-matched footstep guide schedule');
  assert(gameSource.includes('Press Spacebar to the beat of the player running'), 'Treadmill countdown should instruct players to match Spacebar to the running beat');
  assert(gameSource.includes('createBuffer(1, sampleCount, context.sampleRate)'), 'Treadmill footstep sound should use a synthesized running footstep noise burst');
  assert(gameSource.includes('createTreadmillRunBeatSchedule'), 'Game should create a treadmill rhythm beat schedule');
  assert(gameSource.includes('recordTreadmillRunTap'), 'Game should score spacebar taps for the treadmill run');
  assert(gameSource.includes('stationaryRun'), 'Game should force a stationary running animation during the treadmill run');
  assert(gameSource.includes("run.phase === 'countdown' || run.phase === 'playing'"), 'Treadmill character should run during both countdown and scoring');
  assert(hudSource.includes('is-countdown'), 'HUD should render a distinct treadmill countdown state');
  assert(hudSource.includes('hud__treadmill-run-hit'), 'HUD should render the treadmill rhythm hit target');
  assert(hasPlacementWithItemId(defaultWorldLayout.props, 'treadmill'), 'Default world should seed a treadmill prop');

  const rentCollector = findRentCollector(defaultWorldLayout.npcs);
  const rentIntroPlan = resolveRentIntroPlan(defaultWorldLayout);
  assert(rentCollector?.id === 'npc_landlord', 'Default world should seed the landlord as the rent collector');
  assert(rentIntroPlan?.collectorNpcId === 'npc_landlord', 'Rent intro should resolve to the landlord collector');
  assert(rentIntroPlan?.spawn && Number.isFinite(rentIntroPlan.spawn.x) && Number.isFinite(rentIntroPlan.spawn.z), 'Rent intro should resolve a finite opening spawn');
  assert(/rent/i.test(RENT_INTRO_LINE) && /money/i.test(RENT_INTRO_LINE), 'Rent intro line should ask for rent money');
  assert(gameSource.includes('updateRentIntroCutsceneCamera'), 'Game should drive a 3D rent intro cutscene camera');
  assert(gameSource.includes('getRentIntroBlinkClosure'), 'Game should animate full-screen blinking during the rent intro cutscene');
  assert(hudSource.includes('hud__rent-cutscene'), 'HUD should include the rent intro blink layer');
  const openingRentIntroPrimeIndex = gameSource.indexOf('this.primeOpeningRentIntroCutscene();');
  const loadingHideAfterPrimeIndex = gameSource.indexOf('this.hud.hideLoading();', openingRentIntroPrimeIndex);
  assert(
    openingRentIntroPrimeIndex >= 0 && loadingHideAfterPrimeIndex > openingRentIntroPrimeIndex,
    'Opening rent intro cutscene should prime before the loading screen hides'
  );
  const rentIntroCameraSnapIndex = gameSource.indexOf('this.updateRentIntroCutsceneCamera(0);');
  const rentIntroVisibleIndex = gameSource.indexOf('this.hud.setRentIntroCutsceneState({ visible: true, blink: 1 });');
  assert(
    rentIntroCameraSnapIndex >= 0 && rentIntroVisibleIndex > rentIntroCameraSnapIndex,
    'Rent intro cutscene should snap to its opening camera before revealing the blink layer'
  );
  const rentIntroNpcDistance = Number(
    gameSource.match(/const\s+RENT_INTRO_CUTSCENE_NPC_DISTANCE\s*=\s*([0-9.]+);/)?.[1]
  );
  assert(rentIntroNpcDistance >= 2.4, 'Rent intro landlord staging should leave first-person breathing room');

  const instrumentCluster = getBuilderItemById('instrument_cluster');
  assert(instrumentCluster, 'Instrument cluster prop should exist');
  assert(getBuilderItemById('Instrument Cluster') === instrumentCluster, 'Instrument cluster should resolve from the label used in builder workflows');
  assert(getBuilderItemById('guitar_piano_microphone') === instrumentCluster, 'Instrument cluster should resolve from the descriptive alias');
  assert(instrumentCluster.layer === 'prop', 'Instrument cluster should be a prop catalog item');
  assert(instrumentCluster.groupId === 'music', 'Instrument cluster should be grouped under Music');
  assert(instrumentCluster.asset === null, 'Instrument cluster should use a procedural visual');
  assert(instrumentCluster.collision === false, 'Instrument cluster should not block movement in tight interior corners');
  assert(typeof instrumentCluster.createVisual === 'function', 'Instrument cluster should define a procedural visual');
  assert(instrumentCluster.interactable?.gameId === VIBE_HERO_GAME_ID, 'Instrument cluster should open Vibe Hero');
  assert(instrumentCluster.interactable?.prompt === 'Play Vibe Hero', 'Instrument cluster should advertise the Vibe Hero interaction');
  assert(Number(instrumentCluster.interactable?.radius) >= 4, 'Instrument cluster Vibe Hero prompt should be reachable');
  assert(
    instrumentCluster.size[0] === INSTRUMENT_CLUSTER_FOOTPRINT[0]
      && instrumentCluster.size[1] === INSTRUMENT_CLUSTER_FOOTPRINT[1],
    'Instrument cluster should use the larger corner footprint constant'
  );
  assert(INSTRUMENT_CLUSTER_FOOTPRINT[0] > 3.2, 'Instrument cluster should be slightly wider than the original compact prop');
  assert(INSTRUMENT_CLUSTER_FOOTPRINT[1] > 2.4, 'Instrument cluster should be slightly deeper than the original compact prop');

  const instrumentVisual = instrumentCluster.createVisual();
  assert(instrumentVisual.getObjectByName('instrumentClusterGuitar'), 'Instrument cluster visual should include a guitar');
  assert(instrumentVisual.getObjectByName('instrumentClusterGuitarBody'), 'Instrument cluster guitar should include a body');
  assert(instrumentVisual.getObjectByName('instrumentClusterPianoKeyboard'), 'Instrument cluster visual should include a piano keyboard');
  assert(instrumentVisual.getObjectByName('instrumentClusterMicrophoneStandPole'), 'Instrument cluster visual should include a microphone stand');
  assert(instrumentVisual.getObjectByName('instrumentClusterMicrophone'), 'Instrument cluster visual should include a microphone');

  const instrumentBounds = new Box3().setFromObject(instrumentVisual);
  const instrumentSize = instrumentBounds.getSize(new Vector3());
  assert(instrumentSize.x <= INSTRUMENT_CLUSTER_FOOTPRINT[0] + 0.05, 'Instrument cluster visual should stay inside the larger corner footprint width');
  assert(instrumentSize.z <= INSTRUMENT_CLUSTER_FOOTPRINT[1] + 0.05, 'Instrument cluster visual should stay inside the larger corner footprint depth');
  assert(instrumentSize.y <= 2.4, 'Instrument cluster visual should stay below normal room height');
}

const MP3_BITRATES_KBPS = Object.freeze({
  1: Object.freeze({
    1: Object.freeze([null, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448]),
    2: Object.freeze([null, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384]),
    3: Object.freeze([null, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320])
  }),
  2: Object.freeze({
    1: Object.freeze([null, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256]),
    2: Object.freeze([null, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]),
    3: Object.freeze([null, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])
  })
});
const MP3_SAMPLE_RATES = Object.freeze({
  1: Object.freeze([44100, 48000, 32000]),
  2: Object.freeze([22050, 24000, 16000]),
  2.5: Object.freeze([11025, 12000, 8000])
});

function readSynchsafeUInt32(buffer, offset) {
  return ((buffer[offset] & 0x7f) << 21)
    | ((buffer[offset + 1] & 0x7f) << 14)
    | ((buffer[offset + 2] & 0x7f) << 7)
    | (buffer[offset + 3] & 0x7f);
}

function getId3v2Length(buffer) {
  if (buffer.length < 10 || buffer.toString('latin1', 0, 3) !== 'ID3') {
    return 0;
  }
  const footerLength = (buffer[5] & 0x10) ? 10 : 0;
  return 10 + readSynchsafeUInt32(buffer, 6) + footerLength;
}

function parseMp3Frame(buffer, offset) {
  if (offset + 4 > buffer.length) {
    return null;
  }

  const header = buffer.readUInt32BE(offset);
  if (((header & 0xffe00000) >>> 0) !== 0xffe00000) {
    return null;
  }

  const versionBits = (header >>> 19) & 0x3;
  const layerBits = (header >>> 17) & 0x3;
  const bitrateIndex = (header >>> 12) & 0xf;
  const sampleRateIndex = (header >>> 10) & 0x3;
  const padding = (header >>> 9) & 0x1;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 0xf || sampleRateIndex === 3) {
    return null;
  }

  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = 4 - layerBits;
  const bitrateKbps = MP3_BITRATES_KBPS[version === 1 ? 1 : 2]?.[layer]?.[bitrateIndex];
  const sampleRate = MP3_SAMPLE_RATES[version]?.[sampleRateIndex];
  if (!bitrateKbps || !sampleRate) {
    return null;
  }

  const bitrate = bitrateKbps * 1000;
  const samples = layer === 1 ? 384 : (layer === 3 && version !== 1 ? 576 : 1152);
  const frameLength = layer === 1
    ? Math.floor(((12 * bitrate) / sampleRate + padding) * 4)
    : Math.floor((((layer === 3 && version !== 1 ? 72 : 144) * bitrate) / sampleRate) + padding);
  if (frameLength <= 4 || offset + frameLength > buffer.length) {
    return null;
  }
  return {
    durationMs: (samples / sampleRate) * 1000,
    frameLength
  };
}

function getMp3DurationMs(fileUrl) {
  const buffer = readFileSync(fileUrl);
  let offset = getId3v2Length(buffer);
  let durationMs = 0;
  while (offset + 4 <= buffer.length) {
    const frame = parseMp3Frame(buffer, offset);
    if (!frame) {
      offset += 1;
      continue;
    }
    durationMs += frame.durationMs;
    offset += frame.frameLength;
  }
  return durationMs;
}

function validateVibeHero() {
  const licenseNotice = readFileSync(new URL('../assets/audio/vibe-hero/License.txt', import.meta.url), 'utf8');
  const vibeHeroSource = readFileSync(new URL('../src/shared/vibeHero.js', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = readFileSync(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const songs = listVibeHeroSongs();
  assert(VIBE_HERO_LANE_COUNT === 5, 'Vibe Hero should expose five lanes for keys 1-5');
  assert(VIBE_HERO_NOTE_TRAVEL_MS <= 950, 'Vibe Hero notes should use hyperspeed travel timing');
  assert(gameSource.includes('VIBE_HERO_LANE_FLASH_MS'), 'Vibe Hero hit flashes should last long enough for the hit animation to play');
  assert(gameSource.includes('openVibeHeroChartEditor'), 'Vibe Hero should expose a dedicated chart editor opener');
  assert(gameSource.includes('this.canUseVibeHeroChartEditor()') && gameSource.includes("this.input.consume('KeyF')"), 'Instrument cluster chart editor should be gated to admins on F');
  assert(gameSource.includes("this.input.consume('KeyR')"), 'Vibe Hero chart editor should toggle recording with R');
  assert(gameSource.includes("this.input.consume('KeyN')") && gameSource.includes("this.input.consume('KeyM')"), 'Vibe Hero chart editor should support N/M seek controls');
  assert(gameSource.includes("this.input.consume('Space')") && gameSource.includes('toggleVibeHeroEditorPlayback'), 'Vibe Hero chart editor should pause/play with Space');
  assert(gameSource.includes('overwriteVibeHeroEditorRange') && gameSource.includes('recordVibeHeroEditorLanes'), 'Vibe Hero chart editor should overwrite chart ranges from keyboard lane recording');
  assert(gameSource.includes('recordVibeHeroEditorPlaybackRange') && gameSource.includes('getVibeHeroEditorPressedLaneIndexes'), 'Vibe Hero chart editor should continuously record held 1-5 keys across the elapsed playback range');
  assert(gameSource.includes('pauseVibeRadioForVibeHero') && gameSource.includes('resumeVibeRadioAfterVibeHero'), 'Vibe Hero should pause Vibe Radio while active and resume it afterward');
  assert(/startVibeHeroCountdown\(\)\s*\{[\s\S]*?this\.pauseVibeRadioForVibeHero\(\)/.test(gameSource), 'Starting Vibe Hero play should pause Vibe Radio');
  assert(/startVibeHeroChartEditor\(\)\s*\{[\s\S]*?this\.pauseVibeRadioForVibeHero\(\)/.test(gameSource), 'Starting the Vibe Hero chart editor should pause Vibe Radio');
  assert(/finishVibeHero\(\)\s*\{[\s\S]*?this\.resumeVibeRadioAfterVibeHero\(\)/.test(gameSource), 'Finishing Vibe Hero should resume Vibe Radio when it was paused by Vibe Hero');
  assert(/closeVibeHero\(\)\s*\{[\s\S]*?this\.resumeVibeRadioAfterVibeHero\(\)/.test(gameSource), 'Closing Vibe Hero should resume Vibe Radio when it was paused by Vibe Hero');
  assert(gameSource.includes('VIBE_HERO_EDITOR_RECORD_STEP_MS') && gameSource.includes('this.input.isPressed(code)'), 'Vibe Hero chart editor should sample held note keys instead of only single keydown events');
  assert(gameSource.includes('VIBE_HERO_EDITOR_HOLD_REPEAT_DELAY_MS') && gameSource.includes('editorLaneHeld'), 'Vibe Hero chart editor should debounce fresh taps before held-key repeat notes are recorded');
  assert(gameSource.includes('recordedKeys') && gameSource.includes('mergedChart'), 'Vibe Hero chart editor should avoid preserving exact duplicates when merging recorded notes');
  assert(gameSource.includes('VIBE_HERO_EDITOR_STORAGE_PREFIX'), 'Vibe Hero chart editor should persist edited charts locally for admins');
  assert(gameSource.includes('entry.chartEdited === true'), 'Vibe Hero public song list should preserve shipped edited-chart metadata without requiring admin local storage');
  assert(gameSource.includes('const storedChart = editing ? this.loadVibeHeroStoredEditorChart(baseSong) : null') && gameSource.includes('const storedEntryChart = editing ? this.loadVibeHeroStoredEditorChart(entry) : null'), 'Vibe Hero normal play should use shipped edited charts; localStorage editor charts should only override inside editor mode');
  assert(gameSource.includes('vibeHeroStoredEditorCharts: includeVibeHeroStoredCharts') && gameSource.includes('this.getVibeHeroStoredEditorChartsSnapshot()'), 'Admin task snapshots should include exact saved Vibe Hero editor chart payloads for source promotion');
  assert(vibeHeroSource.includes('createRecordedEditorChart') && vibeHeroSource.includes('VIBE_HERO_EDITED_CHART_ROWS'), 'Vibe Hero main songs should be built from the exact recorded editor chart rows');
  assert(!vibeHeroSource.includes('SOURCE_ONSET') && !vibeHeroSource.includes('createSourceOnsetChart'), 'Vibe Hero should not keep the old source-onset chart generator as a playable main chart');
  assert(hudSource.includes('editor-select') && hudSource.includes('data-vibe-hero-action="editor:record"'), 'Vibe Hero HUD should render admin chart editor controls');
  assert(!hudSource.includes('| Edited'), 'Vibe Hero song select should not show edited-chart text to players');
  assert(hudSource.includes('hud__vibe-hero-fret') && styleSource.includes('.hud__vibe-hero-fret'), 'Vibe Hero HUD should render oval timing frets above the lane number buttons');
  assert(hudSource.includes('hud__vibe-hero-hit-fire') && styleSource.includes('@keyframes hud-vibe-hero-fire-burst'), 'Vibe Hero HUD should animate a small fire burst when a note is hit correctly');
  assert(songs.length === 2, 'Vibe Hero should include exactly two starter songs');
  for (const song of songs) {
    assert(song.id && song.title, 'Vibe Hero songs should have stable ids and titles');
    assert(song.durationMs >= 45000 && song.durationMs <= 120000, `${song.title}: duration should be a 45-120 second snippet`);
    assert(String(song.sourceUrl ?? '').startsWith('https://'), `${song.title}: should document the source page`);
    assert(/^https:\/\/.+\.mp3(?:$|\?)/u.test(String(song.sourceDownloadUrl ?? '')), `${song.title}: should document a playable original MP3 URL`);
    assert(String(song.publicDomainBasis ?? '').toLowerCase().includes('public domain'), `${song.title}: should document the composition/public-domain basis`);
    assert(String(song.sourceLicense ?? '').length > 20, `${song.title}: should document the recording license/source terms`);
    assert(String(song.chartSource ?? '').toLowerCase().includes('admin-recorded editor chart'), `${song.title}: should document the admin-recorded editor chart source`);
    assert(String(song.chartSource ?? '').toLowerCase().includes('shipped main chart'), `${song.title}: main chart should be the admin-edited chart, not only an admin local-storage override`);
    assert(song.chartEdited === true, `${song.title}: public song metadata should mark the shipped main chart as edited`);
    assert(licenseNotice.includes(song.sourceDownloadUrl), `${song.title}: source MP3 should be listed in the Vibe Hero audio notice`);
    const localAudioFile = new URL(`../assets/audio/vibe-hero/${song.id}.mp3`, import.meta.url);
    const localAudioSize = statSync(localAudioFile).size;
    assert(localAudioSize >= 1000000, `${song.title}: local MP3 should use a high-quality source excerpt, not a tiny compressed placeholder`);
    const localAudioDurationMs = getMp3DurationMs(localAudioFile);
    const expectedLocalAudioDurationMs = Number(song.snippetStartMs ?? 0) + song.durationMs;
    assert(
      Math.abs(localAudioDurationMs - expectedLocalAudioDurationMs) <= 80,
      `${song.title}: local MP3 duration should preserve the charted source window`
    );
    if (song.id === 'debussy-arabesque-no-1') {
      assert(song.chart.length === 326, 'Debussy - Arabesque No. 1 should ship the 326-note editor-polished chart');
    }
    if (song.id === 'vivaldi-winter') {
      assert(song.snippetStartMs === 30000, 'Vivaldi - Winter should skip the first 30 seconds of the MP3');
      assert(song.durationMs === 95000, 'Vivaldi - Winter should chart a 95 second snippet after the 30 second skip');
      assert(song.chart.length === 667, 'Vivaldi - Winter should ship the 667-note admin-edited chart');
    }
    const expectedChartRows = VIBE_HERO_EDITED_CHART_ROWS[song.id] ?? [];
    assert(expectedChartRows.length === song.chart.length, `${song.title}: shipped chart should exactly match the promoted editor recording length`);
    for (let index = 0; index < expectedChartRows.length; index += 1) {
      const [expectedId, expectedTimeMs, expectedLane, expectedPitch, expectedDurationMs] = expectedChartRows[index];
      const note = song.chart[index];
      assert(note.id === expectedId, `${song.title} note ${index + 1}: should preserve the recorded editor note id`);
      assert(note.timeMs === expectedTimeMs, `${song.title} note ${index + 1}: should preserve the recorded editor timing`);
      assert(note.lane === expectedLane, `${song.title} note ${index + 1}: should preserve the recorded editor lane`);
      assert(note.pitch === expectedPitch, `${song.title} note ${index + 1}: should preserve the recorded editor pitch`);
      assert(note.durationMs === expectedDurationMs, `${song.title} note ${index + 1}: should preserve the recorded editor duration`);
    }

    assert(Array.isArray(song.chart) && song.chart.length >= 120, `${song.title}: expert chart should have enough notes to be difficult`);
    let previousTime = -1;
    let totalGapMs = 0;
    let minGapMs = Infinity;
    let positiveGapCount = 0;
    let currentTimeLaneKeys = new Set();
    for (let index = 0; index < song.chart.length; index += 1) {
      const note = song.chart[index];
      assert(note.timeMs >= previousTime, `${song.title} note ${index + 1}: chart timings should be sorted`);
      if (note.timeMs !== previousTime) {
        currentTimeLaneKeys = new Set();
      }
      const sameTimeLaneKey = `${note.timeMs}:${note.lane}`;
      assert(!currentTimeLaneKeys.has(sameTimeLaneKey), `${song.title} note ${index + 1}: chart should not duplicate a lane at one timestamp`);
      currentTimeLaneKeys.add(sameTimeLaneKey);
      if (previousTime >= 0 && note.timeMs > previousTime) {
        const gapMs = note.timeMs - previousTime;
        totalGapMs += gapMs;
        minGapMs = Math.min(minGapMs, gapMs);
        positiveGapCount += 1;
      }
      previousTime = note.timeMs;
      assert(Number.isFinite(note.frequency) && note.frequency > 0, `${song.title} note ${index + 1}: frequency should be playable`);
      assert(Number.isInteger(note.lane) && note.lane >= 0 && note.lane < VIBE_HERO_LANE_COUNT, `${song.title} note ${index + 1}: lane should be 0-4`);
      assert(note.timeMs >= 0 && note.timeMs < song.durationMs, `${song.title} note ${index + 1}: note should fit inside the song`);
    }
    const averageGapMs = totalGapMs / Math.max(1, positiveGapCount);
    const notesPerSecond = song.chart.length / Math.max(1, song.durationMs / 1000);
    const maxNotesPerSecond = song.id === 'vivaldi-winter' ? 7.2 : 5.6;
    assert(minGapMs >= 8, `${song.title}: chart should keep positive note timings playable`);
    assert(averageGapMs >= 120, `${song.title}: chart should emphasize substantial attacks`);
    assert(notesPerSecond <= maxNotesPerSecond, `${song.title}: chart should stay within a playable expert density`);
    assert(chartUsesAllLanes(song.chart), `${song.title}: chart should use all five Vibe Hero lanes`);
  }
}

function validateTiles() {
  const seenCells = new Set();

  for (let index = 0; index < defaultWorldLayout.tiles.length; index += 1) {
    const tile = defaultWorldLayout.tiles[index];
    const item = getBuilderItemById(tile.itemId);
    assert(item, `Tile ${index}: unknown itemId "${tile.itemId}"`);
    assert(item.layer === 'tile', `Tile ${index}: "${tile.itemId}" is not a tile catalog item`);
    assert(Array.isArray(tile.cell) && tile.cell.length === 2, `Tile ${index}: cell must be [x, z]`);
    validateRotationQuarterTurns(tile.rotationQuarterTurns, `Tile ${index}`);

    for (const occupiedCell of getTileOccupiedCells(item, tile.cell[0], tile.cell[1], tile.rotationQuarterTurns)) {
      const cellKey = `${occupiedCell.x},${occupiedCell.z}`;
      assert(!seenCells.has(cellKey), `Duplicate tile cell found at ${cellKey}`);
      seenCells.add(cellKey);
    }
  }
}

function getLayoutPlacementEntries(layout = {}) {
  const entries = [];
  pushLayeredPlacementEntries(entries, layout.tiles, 'tile');
  pushLayeredPlacementEntries(entries, layout.props, 'prop');
  pushLayeredPlacementEntries(entries, layout.npcs, 'npc');
  return entries;
}

function validateUniquePlacementIds(layout, layoutLabel) {
  const seen = new Map();
  for (const placement of getLayoutPlacementEntries(layout)) {
    const id = String(placement.id ?? '').trim();
    assert(id, `${layoutLabel}: every placement must have an id`);
    const existing = seen.get(id);
    assert(
      !existing,
      `${layoutLabel}: duplicate placement id "${id}" used by ${existing?.layer}:${existing?.itemId ?? existing?.modelId ?? 'unknown'} and ${placement.layer}:${placement.itemId ?? placement.modelId ?? 'unknown'}`
    );
    seen.set(id, placement);
  }
}

function sortedCellKeys(cells) {
  const keys = [];
  for (const cell of cells) {
    keys.push(`${cell.x},${cell.z}`);
  }
  return keys.sort();
}

function validateFootprintSupport() {
  const baseLot = getBuilderItemById('lot_base');
  const bar = getBuilderItemById('bar_building_wide');
  const gym = getBuilderItemById('gym_building');
  const largeGym = getBuilderItemById('gym_building_large');
  const pawnShop = getBuilderItemById('pawn_building');
  const marthasGrille = getBuilderItemById('marthas_grille_building');
  const realEstateOffice = getBuilderItemById('real_estate_office_building');
  const policeStation = getBuilderItemById('police_station_building');
  const districtBuildings = [
    { key: 'school', item: getBuilderItemById('school_building') },
    { key: 'bar', item: getBuilderItemById('bar_building') },
    { key: 'bank', item: getBuilderItemById('bank_building') },
    { key: 'casino', item: getBuilderItemById('casino_building') },
    { key: 'pawn', item: getBuilderItemById('pawn_building') },
    { key: 'offices', item: getBuilderItemById('offices_building') },
    { key: 'car_dealership', item: getBuilderItemById('car_dealership_building') }
  ];
  const cutawayVisibleWallNames = (key) => [
    `${key}_hull_wall_back`,
    `${key}_hull_wall_left`,
    `${key}_hull_wall_right`
  ];

  assert(baseLot, 'Base lot tile should exist');
  assert(bar, 'Wide bar tile should exist');
  assert(gym, 'Gym tile should exist');
  assert(largeGym, 'Large gym tile should exist');
  assert(pawnShop, 'Pawn shop tile should exist');
  assert(marthasGrille, "Martha's Grille tile should exist");
  assert(realEstateOffice, 'Real Estate Office tile should exist');
  assert(policeStation, 'Police Station tile should exist');
  for (let index = 0; index < districtBuildings.length; index += 1) {
    const { item } = districtBuildings[index];
    assert(item, `District 2x2 building ${index} should exist`);
  }

  const savedWorldLayout = JSON.parse(readRepoText('server/data/world-layout.json'));
  validateUniquePlacementIds(defaultWorldLayout, 'Default world layout');
  validateUniquePlacementIds(savedWorldLayout, 'Fallback saved world layout');

  assert(baseLot.tileFootprint[0] === 1 && baseLot.tileFootprint[1] === 1, 'Base lot should remain 1x1');
  assert(bar.tileFootprint[0] === 2 && bar.tileFootprint[1] === 1, 'Wide bar should remain 2x1');
  assert(gym.tileFootprint[0] === 1 && gym.tileFootprint[1] === 1, 'Original gym should remain 1x1');
  assert(largeGym.tileFootprint[0] === 2 && largeGym.tileFootprint[1] === 2, 'Large gym should use a 2x2 footprint');
  assert(
    largeGym.interior?.cutawayVisibleNodeNames?.includes('gym_foundation')
      && largeGym.interior?.cutawayVisibleNodeNames?.includes('gym_interior')
      && hasAllNames(largeGym.interior?.cutawayVisibleNodeNames, cutawayVisibleWallNames('gym')),
    'Large gym should keep its floor, interior, and back/side walls visible while the exterior is transparent'
  );
  assert(
    largeGym.interior?.cutawayNodeNames?.includes('gym_hull_wall_front')
      && largeGym.interior?.cutawayNodeNames?.includes('gym_exterior_detail'),
    'Large gym should hide its front exterior wall and outside detail during cutaway'
  );
  assert(marthasGrille.tileFootprint[0] === 1 && marthasGrille.tileFootprint[1] === 1, "Martha's Grille should remain a 1x1 building");
  assert(marthasGrille.size[0] === MARTHAS_GRILLE_BUILDING_FOOTPRINT[0], "Martha's Grille should use the standard compact building width");
  assert(marthasGrille.size[1] === MARTHAS_GRILLE_BUILDING_FOOTPRINT[1], "Martha's Grille should use the standard compact building depth");
  assert(realEstateOffice.tileFootprint[0] === 1 && realEstateOffice.tileFootprint[1] === 1, 'Real Estate Office should be a 1x1 building');
  assert(realEstateOffice.size[0] === REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT[0], 'Real Estate Office should use the standard compact building width');
  assert(realEstateOffice.size[1] === REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT[1], 'Real Estate Office should use the standard compact building depth');
  assert(policeStation.tileFootprint[0] === 2 && policeStation.tileFootprint[1] === 1, 'Police Station should use a 2x1 footprint');
  assert(!policeStation.interior, 'Police Station should not define an interior');
  assert(policeStation.interactable?.garageDoor?.type === 'police-station-garage', 'Police Station should expose an openable garage interaction');
  assert(
    policeStation.interactable?.garageDoor?.closedNodeNames?.includes('police_station_garage_door_closed'),
    'Police Station garage interaction should target the closed garage door node'
  );
  assert(
    hasPoliceFrontCollisionWall(policeStation.movementCollisionRects),
    'Police Station should keep a front collision wall so the open garage is not enterable'
  );
  assert(getBuilderItemById('Police Station') === policeStation, 'Police Station should resolve from its display label');
  assert(getBuilderItemById('Car Dealership')?.id === 'car_dealership_building', 'Car Dealership should resolve from its display label');
  assert(getBuilderItemById('auto showroom')?.id === 'car_dealership_building', 'Car Dealership should resolve from its showroom alias');
  for (const { key, item } of districtBuildings) {
    assert(item.tileFootprint[0] === 2 && item.tileFootprint[1] === 2, `${item.id} should use a 2x2 footprint`);
    assert(item.interior?.mode === 'inline-cutaway', `${item.id} should expose an inline cutaway interior`);
    assert(getInteriorTemplateById(item.interior?.id), `${item.id} should have a registered inline interior template`);
    assert(item.movementCollisionRects?.length >= 5, `${item.id} should define hull-wall movement collision`);
    assert(
      item.interior?.cutawayVisibleNodeNames?.includes(`${key}_foundation`),
      `${item.id} should keep its floor/foundation visible while the exterior is transparent`
    );
    assert(
      hasAllNames(item.interior?.cutawayVisibleNodeNames, cutawayVisibleWallNames(key)),
      `${item.id} should keep its back and side walls visible while the exterior is transparent`
    );
    assert(
      item.interior?.cutawayNodeNames?.includes(`${key}_hull_wall_front`)
        && item.interior?.cutawayNodeNames?.includes(`${key}_exterior_detail`),
      `${item.id} should hide its front exterior wall and outside detail during cutaway`
    );
    assert(
      hasAllNames(item.cameraOcclusionPreserveNodeNames, cutawayVisibleWallNames(key)),
      `${item.id} should preserve its back and side walls during active camera occlusion`
    );
    if (key !== 'offices') {
      assert(
        item.interior?.cutawayVisibleNodeNames?.includes(`${key}_interior`),
        `${item.id} should keep its interior props visible while the exterior is transparent`
      );
    }
    assert(
      !item.interior?.cutawayFadeNodeNames?.length,
      `${item.id} should not leave a faded exterior shell after entering`
    );
  }
  for (const { key, item } of districtBuildings) {
    if (!item.asset) {
      continue;
    }
    const nodeNames = readGlbNodeNames(`assets/vibe_theft_auto_custom/models/${key}-building.glb`);
    for (const nodeName of [
      `${key}_hull_wall_back`,
      `${key}_hull_wall_left`,
      `${key}_hull_wall_right`,
      `${key}_hull_wall_front`
    ]) {
      assert(nodeNames.has(nodeName), `${key} GLB should expose ${nodeName} for cutaway visibility`);
    }
  }
  const largeGymNodeNames = readGlbNodeNames('assets/vibe_theft_auto_custom/models/gym-building-large.glb');
  for (const nodeName of ['gym_hull_wall_back', 'gym_hull_wall_left', 'gym_hull_wall_right', 'gym_hull_wall_front']) {
    assert(largeGymNodeNames.has(nodeName), `Large gym GLB should expose ${nodeName} for cutaway visibility`);
  }
  const policeStationGlbJson = readGlbJson('assets/vibe_theft_auto_custom/models/police-station-building.glb');
  const policeStationNodeNames = getGlbNodeNameSet(policeStationGlbJson);
  const policeStationMaterialNames = getGlbMaterialNames(policeStationGlbJson);
  assert(policeStationNodeNames.has('police_station_garage_door_closed'), 'Police Station GLB should expose the closed garage door node');
  assert(policeStationNodeNames.has('car_police'), 'Police Station GLB should include the car_police roof prop node');
  assert(policeStationNodeNames.has('policeStationSignPanel'), 'Police Station GLB should include the front sign panel');
  assert(policeStationNodeNames.has('policeStationSignDivider'), 'Police Station GLB should include a divider that separates the two sign lines');
  const policeStationSignPanelBounds = getGlbNodeYBounds(policeStationGlbJson, getGlbNodeByName(policeStationGlbJson, 'policeStationSignPanel'));
  const policeStationPoliceTextBounds = getGlbNodePatternYBounds(policeStationGlbJson, /^policeStationSignPolice_\d+_/);
  const policeStationStationTextBounds = getGlbNodePatternYBounds(policeStationGlbJson, /^policeStationSignStation_\d+_/);
  assert(
    policeStationSignPanelBounds
      && policeStationPoliceTextBounds
      && policeStationStationTextBounds
      && policeStationSignPanelBounds.minY < policeStationStationTextBounds.minY - 0.1
      && policeStationSignPanelBounds.maxY > policeStationPoliceTextBounds.maxY + 0.1,
    'Police Station sign text should fit fully inside the sign panel'
  );
  assert(
    policeStationStationTextBounds.maxY < policeStationPoliceTextBounds.minY - 0.3,
    'Police Station sign text lines should be separated and readable'
  );
  assert(policeStationNodeNames.has('policeStationRoofCarBlueHoodPanel'), 'Police Station roof car should restore visible blue body color');
  assert(policeStationNodeNames.has('policeStationRoofCarBlueTrunkPanel'), 'Police Station roof car should restore visible rear blue body color');
  assert(policeStationNodeNames.has('policeStationRoofCarBlackWindshield'), 'Police Station roof car should include dark windshield paint');
  assert(
    isGlbNodeQuarterTurnAroundY(getGlbNodeByName(policeStationGlbJson, 'policeStationRoofCarProp')),
    'Police Station roof car prop should be rotated 90 degrees on the roof'
  );
  assert(
    policeStationMaterialNames.has('policeStationBlueWindowGlass')
      && policeStationMaterialNames.has('policeStationBrightBlueWindowGlass'),
    'Police Station GLB should use blue window glass materials'
  );
  assert(
    policeStationMaterialNames.has('policeStationRoofCarBluePaint')
      && policeStationMaterialNames.has('policeStationRoofCarWhitePaint'),
    'Police Station roof car should keep police car paint colors'
  );
  assert(pawnShop.asset === null, 'Pawn shop should use its procedural building visual instead of increasing the static asset payload');
  assert(typeof pawnShop.createVisual === 'function', 'Pawn shop should define a procedural building visual');
  assert(marthasGrille.asset === null, "Martha's Grille should use a procedural building visual");
  assert(typeof marthasGrille.createVisual === 'function', "Martha's Grille should define a procedural building visual");
  assert(getBuilderItemById("Martha's Grille") === marthasGrille, "Martha's Grille should resolve from its display label");
  assert(realEstateOffice.asset === null, 'Real Estate Office should use a procedural building visual');
  assert(typeof realEstateOffice.createVisual === 'function', 'Real Estate Office should define a procedural building visual');
  assert(getBuilderItemById('Real Estate Office') === realEstateOffice, 'Real Estate Office should resolve from its display label');
  const carDealership = getBuilderItemById('car_dealership_building');
  assert(carDealership.asset === null, 'Car Dealership should use a procedural building visual');
  assert(typeof carDealership.createVisual === 'function', 'Car Dealership should define a procedural building visual');
  assert(carDealership.size[0] === CAR_DEALERSHIP_BUILDING_FOOTPRINT[0], 'Car Dealership should use a 2x2 building width');
  assert(carDealership.size[1] === CAR_DEALERSHIP_BUILDING_FOOTPRINT[1], 'Car Dealership should use a 2x2 building depth');
  assert(
    hasPlacementWithItemId(defaultWorldLayout.tiles, 'marthas_grille_building'),
    "Default world should place Martha's Grille"
  );
  assert(
    hasPlacementWithItemId(defaultWorldLayout.tiles, 'real_estate_office_building'),
    'Default world should place the Real Estate Office'
  );
  assert(
    hasPlacementWithItemId(savedWorldLayout.tiles, 'real_estate_office_building'),
    'Fallback saved world layout should place the Real Estate Office'
  );
  assert(
    hasPlacementWithItemId(defaultWorldLayout.tiles, 'police_station_building'),
    'Default world should place the Police Station'
  );
  assert(
    hasPlacementWithItemId(savedWorldLayout.tiles, 'police_station_building'),
    'Fallback saved world layout should place the Police Station'
  );
  assert(
    hasPlacementWithItemId(defaultWorldLayout.tiles, 'car_dealership_building'),
    'Default world should place the Car Dealership'
  );
  assert(
    hasPlacementWithItemId(savedWorldLayout.tiles, 'car_dealership_building'),
    'Fallback saved world layout should place the Car Dealership'
  );
  assertDealershipShowroomCars(defaultWorldLayout, 'Default world layout', carDealership);
  assertDealershipShowroomCars(savedWorldLayout, 'Fallback saved world layout', carDealership);
  assertVehiclePropScales(defaultWorldLayout, 'Default world layout');
  assertVehiclePropScales(savedWorldLayout, 'Fallback saved world layout');
  assertVehicleModelGrounding();
  assertCarDealerNpc(defaultWorldLayout, 'Default world layout', carDealership);
  assertCarDealerNpc(savedWorldLayout, 'Fallback saved world layout', carDealership);

  const diagonalRotationState = new WorldState();
  diagonalRotationState.loadLayout({
    tiles: [],
    props: [{
      id: 'validation-diagonal-showroom-car',
      itemId: 'car_fiat_duna',
      position: [1, 2],
      rotationQuarterTurns: 3,
      rotationY: -0.815,
      scale: CAR_DEALERSHIP_SHOWROOM_CAR_SCALE
    }],
    npcs: []
  });
  const diagonalRotationProp = diagonalRotationState.serializeLayout().props[0];
  assert(
    diagonalRotationProp?.rotationY === -0.815
      && getPlacementScale({ layer: 'prop', ...diagonalRotationProp }) === CAR_DEALERSHIP_SHOWROOM_CAR_SCALE,
    'World state should preserve exact prop rotationY and 0.75x scale for diagonal showroom cars'
  );
  const implicitVehicleScaleState = new WorldState();
  implicitVehicleScaleState.loadLayout({
    tiles: [],
    props: [{
      id: 'validation-implicit-vehicle-scale',
      itemId: 'car_taxi',
      position: [0, 0],
      rotationQuarterTurns: 0
    }],
    npcs: []
  });
  assert(
    getPlacementScale(implicitVehicleScaleState.getPlacement('validation-implicit-vehicle-scale')) === VEHICLE_PROP_PLACEMENT_SCALE,
    'World state should load persisted vehicle props without explicit scale at 0.75x'
  );
  const placedVehicleScaleState = new WorldState();
  const placedVehicle = placedVehicleScaleState.placeProp(getBuilderItemById('car_sedan'), 0, 0, 0);
  assert(
    getPlacementScale(placedVehicle) === VEHICLE_PROP_PLACEMENT_SCALE,
    'Newly placed vehicle props should default to 0.75x'
  );
  assert(
    marthasGrille.cameraOcclusionPreserveNodeNames?.includes('marthas_grille_kitchen_detail'),
    "Martha's Grille kitchen should stay visible when the exterior becomes transparent"
  );
  assert(
    marthasGrille.cameraOcclusionPreserveNodeNames?.includes('marthasGrilleBackWallMenu')
      && marthasGrille.cameraOcclusionAlwaysPreserveNodeNames?.includes('marthasGrilleBackWallMenu'),
    "Martha's Grille back-wall menu should stay visible when the exterior becomes transparent"
  );
  assert(
    hasAllNames(marthasGrille.cameraOcclusionPreserveNodeNames, cutawayVisibleWallNames('marthas_grille')),
    "Martha's Grille should keep its back and side walls visible during camera occlusion"
  );
  assert(
    !marthasGrille.cameraOcclusionAlwaysPreserveNodeNames?.includes('marthas_grille_hull_wall'),
    "Martha's Grille exterior hull should not stay opaque during camera occlusion"
  );
  const worldRendererSource = readRepoText('src/world/WorldRenderer.js');
  const mainGameSource = readRepoText('src/game/Game.js');
  const stableWindowGeneratorSources = collectSourceEntries([
    'scripts/generate-district-buildings.mjs',
    'scripts/generate-gym-building.mjs',
    'scripts/generate-gym-building-large.mjs',
    'scripts/generate-bar-building.mjs'
  ]);
  assert(
    /const CAMERA_OCCLUDED_BUILDING_OPACITY = 0;/.test(worldRendererSource),
    'World renderer should make occluding building exteriors fully transparent'
  );
  assert(
    /PerspectiveCamera\(DEFAULT_CAMERA_FOV,\s*window\.innerWidth \/ window\.innerHeight,\s*0\.5,\s*400\)/.test(mainGameSource),
    'Main game camera should use a tighter near plane so shallow building detail remains depth-stable'
  );
  assert(
    /startInteractionCameraFocus\(interaction[\s\S]*updateInteractionCameraFocus\((?:\{\s*snap(?:,\s*now)?\s*\}|focusOptions)\)/.test(mainGameSource)
      && /openStockMarket\(interaction[\s\S]*startInteractionCameraFocus\(interaction,\s*\{ kind: 'stock-market' \}/.test(mainGameSource)
      && /closeStockMarket\(\)\s*\{[\s\S]*clearInteractionCameraFocus\('stock-market'\)/.test(mainGameSource)
      && /openBlackjack\(interaction[\s\S]*startInteractionCameraFocus\(interaction,\s*\{ kind: 'blackjack' \}/.test(mainGameSource)
      && /openSchoolMicrogame\(interaction[\s\S]*startInteractionCameraFocus\(interaction,\s*\{ kind: 'school-microgame' \}/.test(mainGameSource),
    'NPC and prop function interactions should route through the cutscene-style interaction camera'
  );
  const getMainGameNumericConst = (name) => {
    const match = mainGameSource.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+);`));
    return match ? Number(match[1]) : NaN;
  };
  const interactionCameraShoulderDistance = getMainGameNumericConst('INTERACTION_CAMERA_SHOULDER_DISTANCE');
  const interactionCameraShoulderOffset = getMainGameNumericConst('INTERACTION_CAMERA_SHOULDER_OFFSET');
  const interactionCameraHeight = getMainGameNumericConst('INTERACTION_CAMERA_HEIGHT');
  const interactionCameraNpcLookHeight = getMainGameNumericConst('INTERACTION_CAMERA_NPC_LOOK_HEIGHT');
  const interactionCameraLookSideOffset = getMainGameNumericConst('INTERACTION_CAMERA_LOOK_SIDE_OFFSET');
  const interactionCameraLookSideMaxOffset = getMainGameNumericConst('INTERACTION_CAMERA_LOOK_SIDE_MAX_OFFSET');
  const interactionCameraSightlineClearance = getMainGameNumericConst('INTERACTION_CAMERA_SIGHTLINE_CLEARANCE');
  assert(
    interactionCameraShoulderDistance >= 1.1
      && interactionCameraShoulderDistance <= 1.7
      && interactionCameraShoulderOffset >= 1.55
      && interactionCameraShoulderOffset <= 2.05
      && interactionCameraHeight >= 3.85
      && interactionCameraHeight <= 4.25
      && interactionCameraNpcLookHeight >= 3.1
      && interactionCameraLookSideOffset >= 0.75
      && interactionCameraLookSideOffset <= 1.1
      && interactionCameraLookSideMaxOffset >= interactionCameraSightlineClearance
      && interactionCameraSightlineClearance >= 1.25
      && interactionCameraSightlineClearance <= 1.55
      && /requiredLookSideOffset/.test(mainGameSource)
      && /INTERACTION_CAMERA_SIGHTLINE_CLEARANCE[\s\S]*INTERACTION_CAMERA_SHOULDER_DISTANCE/.test(mainGameSource)
      && /Math\.max\(\s*INTERACTION_CAMERA_LOOK_SIDE_OFFSET,\s*[\s\S]*Math\.min\(INTERACTION_CAMERA_LOOK_SIDE_MAX_OFFSET,\s*requiredLookSideOffset\)/.test(mainGameSource)
      && /cameraLookTarget\.copy\(lookTarget\)[\s\S]*addScaledVector\(right,\s*lookSideOffset\)[\s\S]*camera\.lookAt\(framedLookTarget\)/.test(mainGameSource),
    'Interaction camera should clear the player shoulder so the interaction target stays visible'
  );
  assert(
    /cloneGarageDoorDefinition/.test(worldRendererSource),
    'World renderer should preserve garage-door interaction metadata'
  );
  assert(
    /togglePoliceGarage/.test(mainGameSource) && /setPlacementHiddenNodeNames\(placementId/.test(mainGameSource),
    'Main game should toggle the Police Station garage door without entering an interior'
  );
  for (const { relativePath, source } of stableWindowGeneratorSources) {
    assert(
      source.includes('WINDOW_FACE_GAP'),
      `${relativePath} should separate raised window/edge detail from glass and wall faces`
    );
    assert(
      !/z\s*-\s*0\.08\]\s*,\s*frameMaterial/.test(source),
      `${relativePath} should not place full window frame panels into the glass depth range`
    );
  }
  const districtBuildingSource = findSourceEntry(stableWindowGeneratorSources, 'scripts/generate-district-buildings.mjs')?.source ?? '';
  const getSourceSection = (source, startNeedle, endNeedle) => {
    const startIndex = source.indexOf(startNeedle);
    const endIndex = startIndex >= 0 ? source.indexOf(endNeedle, startIndex) : -1;
    return startIndex >= 0 && endIndex > startIndex ? source.slice(startIndex, endIndex) : '';
  };
  const bankDetailsSource = getSourceSection(
    districtBuildingSource,
    'function addBankDetails(groups, materials)',
    'function addModernBankGlassFacade(groups, materials)'
  );
  const bankFacadeSource = getSourceSection(
    districtBuildingSource,
    'function addModernBankGlassFacade(groups, materials)',
    'function addCasinoDetails(groups, materials)'
  );
  assert(
    /addModernBankGlassFacade\(groups,\s*materials\);/.test(bankDetailsSource)
      && !/groups\.interior/.test(bankDetailsSource),
    'Bank generator should remove bank interior props while keeping the exterior facade pass'
  );
  assert(
    !/addBankTellerCounter\(groups\.interior/.test(bankDetailsSource)
      && !/addBankSittingChair\(groups\.interior/.test(bankDetailsSource)
      && !/addBankLobbyTable\(groups\.interior/.test(bankDetailsSource)
      && !/addDesk\(groups\.interior/.test(bankDetailsSource),
    'Bank generator should not embed teller counters, chairs, tables, desks, or other clutter inside the bank GLB'
  );
  assert(
    /createGlassMaterial\(0xc7f3fb,\s*0\.38\)/.test(bankFacadeSource)
      && /createGlassMaterial\(0x9bd7e6,\s*0\.44\)/.test(bankFacadeSource)
      && /const lowerFrontRows = \[5\.18,\s*7\.14,\s*9\.1,\s*11\.06,\s*13\.02,\s*14\.98\]/.test(bankFacadeSource)
      && /17\.86,\s*19\.78,\s*21\.7,\s*23\.42/.test(bankFacadeSource),
    'Bank exterior generator should use multi-floor transparent glass on the front, sides, and back'
  );
  assert(
    /const BANK_LOBBY_SIDE_WINDOW_Y = 5\.28;/.test(districtBuildingSource)
      && /const BANK_LOBBY_SIDE_WINDOW_ZS = Object\.freeze\(\[-7\.25,\s*-2\.42,\s*2\.42,\s*7\.25\]\);/.test(districtBuildingSource)
      && /sideWallOpenings:\s*\{[\s\S]*left:\s*BANK_LOBBY_SIDE_WINDOW_OPENINGS,[\s\S]*right:\s*BANK_LOBBY_SIDE_WINDOW_OPENINGS[\s\S]*\}/.test(districtBuildingSource)
      && /sideWallOpenings = null/.test(districtBuildingSource)
      && /uniqueZCuts/.test(districtBuildingSource)
      && /overlapsBankLobbySideWindow\(z,\s*y,\s*1\.46,\s*1\.2\)/.test(bankFacadeSource)
      && /for \(const sideX of \[-11\.16,\s*11\.16\]\)/.test(bankFacadeSource)
      && /const sideWindowGroup = sideX < 0 \? groups\.shellLeft : groups\.shellRight;/.test(bankFacadeSource)
      && /for \(const z of BANK_LOBBY_SIDE_WINDOW_ZS\)/.test(bankFacadeSource)
      && /y:\s*BANK_LOBBY_SIDE_WINDOW_Y/.test(bankFacadeSource)
      && /height:\s*BANK_LOBBY_SIDE_WINDOW_HEIGHT/.test(bankFacadeSource)
      && /mullions:\s*1/.test(bankFacadeSource),
    'Bank exterior generator should cut real wall openings and add eight raised transparent side windows'
  );
  assert(
    /const BANK_WALL_HEIGHT = 15\.6;/.test(districtBuildingSource)
      && /const BANK_UPPER_HEIGHT = 8\.8;/.test(districtBuildingSource)
      && /wallHeight:\s*BANK_WALL_HEIGHT/.test(districtBuildingSource)
      && /height:\s*BANK_UPPER_HEIGHT/.test(districtBuildingSource),
    'Bank generator should keep the exterior tower roughly twice as tall as the previous modern bank'
  );
  assert(
    /BANK_FRONT_DOOR_CLEAR_HALF_WIDTH = 3\.74/.test(districtBuildingSource)
      && /BANK_FRONT_DOOR_GLASS_CLEAR_TOP_Y = 4\.42/.test(districtBuildingSource)
      && /function addBankFrontGlassPanel/.test(districtBuildingSource)
      && /Bank front glass panel overlaps the entrance door clearance/.test(districtBuildingSource)
      && !/\[-1\.85,\s*-0\.62,\s*0\.62,\s*1\.85\]/.test(bankFacadeSource),
    'Bank front glass should leave the entrance doorway clear'
  );
  assert(
    !/addStandardSideWindows\(groups,\s*materials\)/.test(bankDetailsSource)
      && !/createCylinder\(0\.34,\s*0\.42,\s*4\.0/.test(bankDetailsSource),
    'Bank exterior generator should not restore the old classical columns or sparse side-window pass'
  );
  const bankGlbJson = readGlbJson('assets/vibe_theft_auto_custom/models/bank-building.glb');
  const bankNodeNames = getGlbNodeNameSet(bankGlbJson);
  assert(
    bankNodeNames.has('bank_interior') && bankNodeNames.has('bank_exterior_detail'),
    'Bank GLB should keep separate interior and exterior-detail nodes for cutaway rendering'
  );
  assert(
    getGlbMaxPositionY(bankGlbJson) >= 24.5,
    'Bank GLB should be regenerated with the taller exterior tower'
  );
  assert(
    countBankTransparentGlassMaterials(bankGlbJson.materials) >= 2,
    'Bank GLB should include transparent modern glass materials in the generated exterior asset'
  );
  assert(
    countGlbTransparentPrimitivesUnderNode(bankGlbJson, 'bank_hull_wall_left') >= 1
      && countGlbTransparentPrimitivesUnderNode(bankGlbJson, 'bank_hull_wall_right') >= 1,
    'Bank GLB should keep raised transparent side-window glass under the visible side-wall nodes for interior and exterior views'
  );
  assert(
    /visibleNodeNames/.test(worldRendererSource),
    'World renderer should support interior-only cutaway visibility'
  );
  assert(
    /getPlacementRotationY/.test(worldRendererSource),
    'World renderer should support exact prop rotationY for diagonal showroom staging'
  );
  assert(
    /nodeWithinVisibleNameFilter/.test(worldRendererSource),
    'World renderer should keep parent containers visible when a cutaway preserves descendant interior nodes'
  );
  assert(
    realEstateOffice.cameraOcclusionPreserveNodeNames?.includes('real_estate_office_foundation'),
    'Real Estate Office foundation should stay visible during camera occlusion'
  );
  assert(
    realEstateOffice.cameraOcclusionPreserveNodeNames?.includes('real_estate_office_interior'),
    'Real Estate Office interior should stay visible during camera occlusion'
  );
  assert(
    hasAllNames(realEstateOffice.cameraOcclusionPreserveNodeNames, cutawayVisibleWallNames('real_estate_office')),
    'Real Estate Office should keep its back and side walls visible during camera occlusion'
  );
  assert(
    !realEstateOffice.cameraOcclusionAlwaysPreserveNodeNames?.includes('real_estate_office_hull_wall'),
    'Real Estate Office hull walls should become transparent during camera occlusion'
  );
  assert(marthasGrille.movementCollisionRects?.length === 6, "Martha's Grille should define wall and counter movement collision");
  assert(marthasGrille.shotCollisionRects?.length === marthasGrille.movementCollisionRects.length, "Martha's Grille wall and counter collision should also block shots");
  const grilleCounterRect = findCollisionRectByCenterZ(marthasGrille.movementCollisionRects, 1.05);
  assert(grilleCounterRect?.halfWidth > 4.4 && grilleCounterRect?.halfDepth >= 0.72, "Martha's Grille counter should be impervious across the service line");
  assert(
    !hasBlockedFrontOpening(marthasGrille.movementCollisionRects),
    "Martha's Grille should leave a large unblocked front opening"
  );
  assert(realEstateOffice.movementCollisionRects?.length === 8, 'Real Estate Office should define wall and desk movement collision');
  assert(realEstateOffice.shotCollisionRects?.length === realEstateOffice.movementCollisionRects.length, 'Real Estate Office collision should also block shots');
  assert(
    !hasBlockedFrontOpening(realEstateOffice.movementCollisionRects),
    'Real Estate Office should leave a large unblocked front opening'
  );
  assert(
    countSmallDeskCollisionRects(realEstateOffice.movementCollisionRects) === 3,
    'Real Estate Office should give its three small desks focused collision'
  );
  const grillePlacement = {
    id: 'validation-marthas-grille',
    itemId: 'marthas_grille_building',
    layer: 'tile',
    cellX: -2,
    cellZ: -4,
    rotationQuarterTurns: 0
  };
  assert(
    placementToCollisionRects(grillePlacement, marthasGrille, { collisionKey: 'blocksMovement' }).length === marthasGrille.movementCollisionRects.length,
    "Martha's Grille movement collision should resolve all wall and counter blockers"
  );
  const realEstatePlacement = {
    id: 'validation-real-estate-office',
    itemId: 'real_estate_office_building',
    layer: 'tile',
    cellX: -3,
    cellZ: -4,
    rotationQuarterTurns: 0
  };
  assert(
    placementToCollisionRects(realEstatePlacement, realEstateOffice, { collisionKey: 'blocksMovement' }).length === realEstateOffice.movementCollisionRects.length,
    'Real Estate Office movement collision should resolve all wall and desk blockers'
  );
  const grilleVisual = marthasGrille.createVisual();
  grilleVisual.updateWorldMatrix(true, true);
  assert(grilleVisual.getObjectByName('marthasGrilleCounterBase'), "Martha's Grille visual should include a counter");
  assert(grilleVisual.getObjectByName('marthasGrilleRegisterScreen'), "Martha's Grille visual should include a register");
  assert(grilleVisual.getObjectByName('marthasGrilleFlatTopGrill'), "Martha's Grille visual should include kitchen equipment behind the counter");
  assert(grilleVisual.getObjectByName('marthas_grille_kitchen_detail'), "Martha's Grille visual should include a detailed kitchen group");
  for (const nodeName of cutawayVisibleWallNames('marthas_grille')) {
    assert(grilleVisual.getObjectByName(nodeName), `Martha's Grille visual should expose ${nodeName} for transparent exterior views`);
  }
  assert(grilleVisual.getObjectByName('marthasGrilleFryerBody'), "Martha's Grille kitchen should include a fryer station");
  assert(grilleVisual.getObjectByName('marthasGrillePrepCounter'), "Martha's Grille kitchen should include a prep counter");
  assert(grilleVisual.getObjectByName('marthasGrilleBurgerPatty1'), "Martha's Grille flat top should include visible grill food detail");
  assert(grilleVisual.getObjectByName('marthasGrilleTicketRail'), "Martha's Grille kitchen should include an order ticket rail");
  const grilleSignPanel = grilleVisual.getObjectByName('marthasGrilleSignPanel');
  assert(grilleSignPanel, "Martha's Grille visual should include a front sign panel");
  const grilleSignPanelSize = new Box3().setFromObject(grilleSignPanel).getSize(new Vector3());
  assert(grilleSignPanelSize.x >= 10 && grilleSignPanelSize.y >= 2.2, "Martha's Grille sign panel should be much larger so the full text fits");
  assert(grilleVisual.getObjectByName('marthasGrillePavilionRoof'), "Martha's Grille visual should include a pavilion-style roof group");
  assert(grilleVisual.getObjectByName('marthasGrillePavilionRoofHip'), "Martha's Grille pavilion roof should include a hipped roof surface");
  assert(grilleVisual.getObjectByName('marthasGrillePavilionPostFrontLeft'), "Martha's Grille pavilion roof should read as post-supported");
  assert(grilleVisual.getObjectByName('marthasGrilleFrontLeftWindow'), "Martha's Grille front wall should include a window");
  assert(grilleVisual.getObjectByName('marthasGrilleBackWindow1'), "Martha's Grille back wall should include windows");
  assert(grilleVisual.getObjectByName('marthasGrilleLeftWindow1'), "Martha's Grille side wall should include windows");
  assert(grilleVisual.getObjectByName('marthasGrilleRightWindow1'), "Martha's Grille side wall should include windows");
  const grilleBackWall = grilleVisual.getObjectByName('mgBackWall');
  assert(grilleBackWall?.material?.color?.getHex() === 0xf2dc9d, "Martha's Grille should use a creamy yellow building facade");
  const grilleBackWallMenu = grilleVisual.getObjectByName('marthasGrilleBackWallMenu');
  const grilleBackWallMenuBoard = grilleVisual.getObjectByName('marthasGrilleBackWallMenuBoard');
  const grilleBackWallMenuLabel = grilleVisual.getObjectByName('marthasGrilleBackWallMenuLabel');
  assert(grilleBackWallMenu, "Martha's Grille should include a menu on the back wall");
  assert(grilleBackWallMenuBoard, "Martha's Grille back-wall menu should include a physical board");
  assert(grilleBackWallMenuLabel, "Martha's Grille back-wall menu should include readable item text");
  assert(
    grilleBackWallMenuLabel?.userData?.itemIds?.join('|') === [
      MARTHA_ITEM_IDS.glizzy,
      MARTHA_ITEM_IDS.burger,
      MARTHA_ITEM_IDS.soda
    ].join('|'),
    "Martha's Grille back-wall menu should display glizzy, burger, and soda"
  );
  assert(
    /Glizzy/.test(grilleBackWallMenuLabel?.userData?.menuText ?? '')
      && /Burger/.test(grilleBackWallMenuLabel?.userData?.menuText ?? '')
      && /Soda/.test(grilleBackWallMenuLabel?.userData?.menuText ?? ''),
    "Martha's Grille back-wall menu label metadata should name all three items"
  );
  assert(grilleBackWallMenuLabel?.material?.transparent !== true, "Martha's Grille back-wall menu should stay opaque");
  assert(grilleBackWallMenuLabel?.material?.depthWrite !== false, "Martha's Grille back-wall menu should write depth as an opaque sign");
  const grilleBackWallBounds = new Box3().setFromObject(grilleBackWall);
  const grilleBackWallMenuBounds = new Box3().setFromObject(grilleBackWallMenu);
  assert(grilleBackWallMenuBounds.min.z > grilleBackWallBounds.max.z - 0.08, "Martha's Grille menu should sit on the inside face of the back wall");
  assert(grilleBackWallMenuBounds.min.y > 4.25 && grilleBackWallMenuBounds.max.y < grilleBackWallBounds.max.y, "Martha's Grille menu should fit high on the back wall above the kitchen windows");
  const grilleSignLabel = grilleVisual.getObjectByName('marthasGrilleSignLabel');
  assert(grilleSignLabel, "Martha's Grille visual should include readable sign text");
  const grilleSignLabelSize = new Box3().setFromObject(grilleSignLabel).getSize(new Vector3());
  assert(grilleSignLabelSize.x >= 9.4 && grilleSignLabelSize.y >= 1.8, "Martha's Grille sign label should be scaled up to fit the restaurant name");
  assert(grilleSignLabel?.material?.transparent !== true, "Martha's Grille sign label should avoid transparent material sorting");
  assert(grilleSignLabel?.material?.depthWrite !== false, "Martha's Grille sign label should write depth as an opaque sign");
  const grilleMarthaBillboard = grilleVisual.getObjectByName('marthasGrilleMarthaBillboard');
  const grilleMarthaBillboardPanel = grilleVisual.getObjectByName('marthasGrilleMarthaBillboardPanel');
  const grilleMarthaPortrait = grilleVisual.getObjectByName('marthasGrilleMarthaBillboardPortrait');
  assert(grilleMarthaBillboard, "Martha's Grille should include a Martha portrait billboard above the sign");
  assert(grilleMarthaBillboardPanel, "Martha's Grille Martha billboard should include a framed panel");
  assert(grilleMarthaPortrait?.userData?.depiction === 'Martha wearing a chef hat', "Martha's Grille billboard portrait should depict Martha in a chef hat");
  assert(
    /fat old white lady/.test(grilleMarthaPortrait?.userData?.appearance ?? '') && /fluffy white hair/.test(grilleMarthaPortrait?.userData?.appearance ?? ''),
    "Martha's Grille billboard portrait should match Martha's requested appearance"
  );
  const grilleSignPanelBounds = new Box3().setFromObject(grilleSignPanel);
  const grilleMarthaPortraitBounds = new Box3().setFromObject(grilleMarthaPortrait);
  assert(grilleMarthaPortraitBounds.min.y > grilleSignPanelBounds.max.y, "Martha's Grille Martha billboard should sit above the main sign");
  const grilleTransparentMeshes = collectTransparentMeshNames(grilleVisual);
  assert(grilleTransparentMeshes.length === 0, `Martha's Grille should not use transparent materials that can tint the building blue: ${grilleTransparentMeshes.join(', ')}`);
  assert(grilleVisual.getObjectByName('marthasGrilleOpenFrontThreshold'), "Martha's Grille visual should mark the open front threshold");
  const grilleBounds = new Box3().setFromObject(grilleVisual);
  const grilleSize = grilleBounds.getSize(new Vector3());
  assert(grilleSize.y >= 8, "Martha's Grille visual should be taller with the pavilion roof");
  assert(grilleSize.x <= MARTHAS_GRILLE_BUILDING_FOOTPRINT[0] + 0.02, "Martha's Grille visual should stay within one tile width before fitting");
  assert(grilleSize.z <= MARTHAS_GRILLE_BUILDING_FOOTPRINT[1] + 0.02, "Martha's Grille visual should stay within one tile depth before fitting");
  const defaultMartha = findNpcById(defaultWorldLayout.npcs, 'npc_martha');
  assert(defaultMartha?.modelId === 'martha', 'Default world should create Martha using the Martha model');
  assert(defaultMartha?.name === 'Martha', 'Default world should expose Martha as a named NPC');
  assert(defaultMartha?.marthaEnabled === true, 'Default world should enable the Martha NPC food function');
  assert(defaultWorldLayout.npcModelVoices?.martha, 'Default world should include model-level NPC voice settings');
  assert(
    getNpcModelVoice(defaultWorldLayout.npcModelVoices, 'martha').basePitchHz
      > getNpcModelVoice(defaultWorldLayout.npcModelVoices, 'brute').basePitchHz,
    'Default model voices should give Martha a higher chirp than the large Brute model'
  );
  assert(
    /fat old white lady/.test(defaultMartha?.prompt ?? '')
      && /fluffy white hair/.test(defaultMartha?.prompt ?? '')
      && /round glasses/.test(defaultMartha?.prompt ?? ''),
    'Default Martha prompt should describe her requested in-game appearance'
  );
  assert(
    hasSavedMarthaNpc(savedWorldLayout.npcs),
    'Saved world layout should include Martha near the grille'
  );
  const marthaAdornment = createMarthaNpcAdornment({ height: 4.8 });
  assert(
    /fat old white lady/.test(marthaAdornment.userData?.appearance ?? '') && /round glasses/.test(marthaAdornment.userData?.appearance ?? ''),
    'Martha NPC adornment metadata should preserve the requested appearance'
  );
  const marthaRoundFace = marthaAdornment.getObjectByName('marthaRoundFace');
  assert(marthaRoundFace?.material?.color?.getHex() === 0xf1c9ad, 'Martha NPC adornment should use pale white skin');
  assert(marthaAdornment.getObjectByName('marthaFluffyHairHalo'), 'Martha NPC adornment should include fluffy hair');
  assert(marthaAdornment.getObjectByName('marthaFluffyHairCrownLeft'), 'Martha NPC adornment should make the white hair extra fluffy');
  assert(marthaAdornment.getObjectByName('marthaFluffyHairForeheadCenter'), 'Martha NPC adornment should add front hair puffs for extremely fluffy white hair');
  assert(marthaAdornment.getObjectByName('marthaFluffyHairOuterLeft'), 'Martha NPC adornment should widen the fluffy white hair silhouette');
  assert(marthaAdornment.getObjectByName('marthaLeftGlassesLens'), 'Martha NPC adornment should include glasses');
  assert(marthaAdornment.getObjectByName('marthaSoftDoubleChin'), 'Martha NPC adornment should read as an older heavyset face');
  assert(marthaAdornment.getObjectByName('marthaWideTorso'), 'Martha NPC adornment should widen Martha into a fat old lady silhouette');
  assert(marthaAdornment.getObjectByName('marthaRoundBelly'), 'Martha NPC adornment should give Martha a heavier silhouette');
  assert(marthaAdornment.getObjectByName('marthaApronBellyCurve'), 'Martha NPC apron should curve over the round belly');
  assert(marthaAdornment.getObjectByName('marthaBigSmile'), 'Martha NPC adornment should include a big smile');
  assert(marthaAdornment.getObjectByName('marthaApronPanel'), 'Martha NPC adornment should include a cook apron');
  assert(
    shouldApplyMarthaNpcAdornment({ id: 'martha' }, defaultMartha),
    'Martha NPC adornment should apply to the named Martha NPC'
  );
  assert(
    shouldApplyMarthaNpcAdornment({ id: 'martha' }, { name: 'Grille Owner', marthaEnabled: true }),
    'Martha NPC adornment should apply to Martha food-function NPCs even if their display name changes'
  );
  assert(isMarthaNpc(defaultMartha), 'Martha NPC food function should be detected from the default NPC definition');
  assert(
    !shouldApplyMarthaNpcAdornment({ id: 'martha' }, findNpcById(defaultWorldLayout.npcs, 'npc_professor_byte')),
    'Martha NPC adornment should not affect the school teacher using the same base model'
  );
  const marthaBaseMock = new Group();
  const marthaBaseSkinMaterial = new MeshStandardMaterial({ color: 0x777777 });
  const marthaBaseHairMaterial = new MeshStandardMaterial({ color: 0x202020 });
  const marthaBaseBody = new Mesh(new BoxGeometry(1, 1, 1), marthaBaseSkinMaterial);
  const marthaBaseHair = new Mesh(new BoxGeometry(1, 1, 1), marthaBaseHairMaterial);
  marthaBaseBody.name = 'Ch27_Body';
  marthaBaseHair.name = 'Ch27_Hair';
  marthaBaseMock.add(marthaBaseBody, marthaBaseHair);
  assert(applyMarthaNpcBaseStyle(marthaBaseMock, { id: 'martha' }, defaultMartha), 'Martha base GLB styling should apply to the in-game Martha NPC');
  assert(marthaBaseBody.material !== marthaBaseSkinMaterial, 'Martha base skin styling should clone shared GLB materials before tinting');
  assert(marthaBaseBody.material?.color?.getHex() === 0xf1c9ad, 'Martha base body mesh should be styled as a white lady');
  assert(marthaBaseBody.material?.transparent !== true && marthaBaseBody.material?.opacity === 1, 'Martha base body style should remain opaque');
  assert(marthaBaseBody.material?.userData?.marthaAppearanceStyle === 'paleSkin', 'Martha base body mesh should carry pale skin styling metadata');
  assert(marthaBaseHair.material?.color?.getHex() === 0xf8f4e8, 'Martha base hair mesh should be styled white');
  assert(marthaBaseHair.material?.transparent !== true && marthaBaseHair.material?.opacity === 1, 'Martha base white hair style should be visible and opaque');
  assert(marthaBaseHair.material?.userData?.marthaAppearanceStyle === 'whiteHair', 'Martha base hair mesh should carry white hair styling metadata');
  const professorBaseMock = new Group();
  const professorBaseSkinMaterial = new MeshStandardMaterial({ color: 0x777777 });
  const professorBaseBody = new Mesh(new BoxGeometry(1, 1, 1), professorBaseSkinMaterial);
  professorBaseBody.name = 'Ch27_Body';
  professorBaseMock.add(professorBaseBody);
  assert(
    !applyMarthaNpcBaseStyle(professorBaseMock, { id: 'martha' }, findNpcById(defaultWorldLayout.npcs, 'npc_professor_byte'))
      && professorBaseBody.material === professorBaseSkinMaterial,
    'Martha base styling should not affect Professor Byte even though he uses the same GLB'
  );
  const npcActorSource = readFileSync(new URL('../src/npc/NpcActor.js', import.meta.url), 'utf8');
  assert(
    /applyMarthaNpcBaseStyle\(this\.character,\s*model,\s*definition\);[\s\S]*this\.materialFeedbackEntries = collectDamageTintMaterials\(this\.character\);/.test(npcActorSource),
    'Martha base styling should run before NPC damage-feedback materials are captured'
  );
  assert(
    /applyNpcCharacterAdornment\(this\.visual,\s*model,\s*definition\)/.test(npcActorSource),
    'Martha NPC adornment should be attached to the unscaled NPC visual parent'
  );
  const realEstateVisual = realEstateOffice.createVisual();
  realEstateVisual.updateWorldMatrix(true, true);
  assert(realEstateVisual.getObjectByName('real_estate_office_tall_facade'), 'Real Estate Office visual should include a tall Kenney Building L-style facade');
  assert(realEstateVisual.getObjectByName('realEstateOfficeOpenFrontThreshold'), 'Real Estate Office visual should mark the open front threshold');
  assert(realEstateVisual.getObjectByName('realEstateOfficeSignPanel'), 'Real Estate Office visual should include a front sign panel');
  assert(realEstateVisual.getObjectByName('realEstateOfficeDesk1'), 'Real Estate Office should include a first small desk');
  assert(realEstateVisual.getObjectByName('realEstateOfficeDesk2'), 'Real Estate Office should include a second small desk');
  assert(realEstateVisual.getObjectByName('realEstateOfficeDesk3'), 'Real Estate Office should include a third small desk');
  for (const nodeName of cutawayVisibleWallNames('real_estate_office')) {
    assert(realEstateVisual.getObjectByName(nodeName), `Real Estate Office visual should expose ${nodeName} for transparent exterior views`);
  }
  assert(realEstateVisual.getObjectByName('realEstateOfficeTallWindow1_1'), 'Real Estate Office facade should include named upper window panels');
  const assertRealEstateColor = (nodeName, expectedColor, message) => {
    const node = realEstateVisual.getObjectByName(nodeName);
    assert(node?.material?.color?.getHex() === expectedColor, message);
  };
  assertRealEstateColor('realEstateOfficeBackWall', 0xf4f5f5, 'Real Estate Office walls should use the new white exterior palette');
  assertRealEstateColor('realEstateOfficeTowerLowerBlock', 0xbcc2c7, 'Real Estate Office tower tiers should use the new gray exterior palette');
  assertRealEstateColor('realEstateOfficeSignPanel', 0x4c535a, 'Real Estate Office sign panel should be gray instead of green');
  assertRealEstateColor('realEstateOfficeGoldAwning', 0xcfd5d9, 'Real Estate Office awning should be silver/white instead of yellow');
  const getRealEstateBounds = (nodeName) => {
    const node = realEstateVisual.getObjectByName(nodeName);
    assert(node, `Real Estate Office visual should include ${nodeName}`);
    return new Box3().setFromObject(node);
  };
  const assertRealEstateFrontWindowAttached = (windowName, blockName) => {
    const windowBounds = getRealEstateBounds(windowName);
    const blockBounds = getRealEstateBounds(blockName);
    const frontGap = windowBounds.min.z - blockBounds.max.z;
    assert(
      frontGap >= -0.03 && frontGap <= 0.08,
      `${windowName} should sit on ${blockName}'s front face instead of floating off the building`
    );
  };
  const assertRealEstateSideWindowAttached = (windowName, blockName, side) => {
    const windowBounds = getRealEstateBounds(windowName);
    const blockBounds = getRealEstateBounds(blockName);
    const sideGap = side === 'left'
      ? blockBounds.min.x - windowBounds.max.x
      : windowBounds.min.x - blockBounds.max.x;
    assert(
      sideGap >= -0.03 && sideGap <= 0.08,
      `${windowName} should sit on ${blockName}'s ${side} face instead of floating off the building`
    );
  };
  for (const { blockName, frontRows, sideRows } of [
    { blockName: 'realEstateOfficeTowerLowerBlock', frontRows: [1, 2], sideRows: [1, 2] },
    { blockName: 'realEstateOfficeTowerMidBlock', frontRows: [3, 4], sideRows: [3, 4] },
    { blockName: 'realEstateOfficeTowerTopBlock', frontRows: [5, 6], sideRows: [5, 6] }
  ]) {
    for (const rowNumber of frontRows) {
      const frontWindowNames = [];
      realEstateVisual.traverse((node) => {
        if (node.isMesh && new RegExp(`^realEstateOfficeTallWindow${rowNumber}_\\d+$`).test(node.name)) {
          frontWindowNames.push(node.name);
        }
      });
      assert(frontWindowNames.length >= 4, `Real Estate Office facade row ${rowNumber} should include window panels`);
      for (const windowName of frontWindowNames) {
        assertRealEstateFrontWindowAttached(windowName, blockName);
      }
    }
    for (const rowNumber of sideRows) {
      assertRealEstateSideWindowAttached(`realEstateOfficeSideWindowLeft${rowNumber}`, blockName, 'left');
      assertRealEstateSideWindowAttached(`realEstateOfficeSideWindowRight${rowNumber}`, blockName, 'right');
    }
  }
  const realEstateSignLabel = realEstateVisual.getObjectByName('realEstateOfficeSignLabel');
  assert(realEstateSignLabel?.material?.color?.getHex() === 0x4c535a, 'Real Estate Office fallback sign label should be gray instead of green');
  assert(realEstateSignLabel?.material?.transparent !== true, 'Real Estate Office sign label should avoid transparent material sorting');
  assert(realEstateSignLabel?.material?.depthWrite !== false, 'Real Estate Office sign label should write depth as an opaque sign');
  const realEstateTransparentMeshes = collectTransparentMeshNames(realEstateVisual);
  assert(realEstateTransparentMeshes.length === 0, `Real Estate Office should not use transparent materials that can tint the building blue: ${realEstateTransparentMeshes.join(', ')}`);
  const realEstateBounds = new Box3().setFromObject(realEstateVisual);
  const realEstateSize = realEstateBounds.getSize(new Vector3());
  assert(realEstateSize.x <= REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT[0] + 0.02, 'Real Estate Office visual should stay within one tile width before fitting');
  assert(realEstateSize.z <= REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT[1] + 0.02, 'Real Estate Office visual should stay within one tile depth before fitting');
  assert(realEstateSize.y >= 26.8, 'Real Estate Office upper floors should be about 1.5x taller and better proportioned');
  const carDealershipVisual = carDealership.createVisual();
  carDealershipVisual.updateWorldMatrix(true, true);
  assert(carDealershipVisual.getObjectByName('carDealershipBackCounter'), 'Car Dealership should include a back counter');
  assert(carDealershipVisual.getObjectByName('carDealershipFrontShowroomLeftTile'), 'Car Dealership should leave the left front tile as showroom floor');
  assert(carDealershipVisual.getObjectByName('carDealershipFrontShowroomRightTile'), 'Car Dealership should leave the right front tile as showroom floor');
  assert(carDealershipVisual.getObjectByName('carDealershipOpenFrontThreshold'), 'Car Dealership should include a broad open showroom threshold');
  for (const nodeName of cutawayVisibleWallNames('car_dealership')) {
    assert(carDealershipVisual.getObjectByName(nodeName), `Car Dealership visual should expose ${nodeName} for cutaway visibility`);
  }
  const carDealershipTransparentGlassNames = new Set([
    'carDealershipBackCounterGlassFront',
    'carDealershipBackFeatureWall',
    'carDealershipBackGlassWall',
    'carDealershipLeftGlassWall',
    'carDealershipRightGlassWall',
    'carDealershipFrontGlassWallLeft',
    'carDealershipFrontGlassWallRight',
    'carDealershipFrontGlassHeader',
    'carDealershipGlassRoof',
    'carDealershipFrontGlassCrown',
    'carDealershipBackGlassCrown',
    'carDealershipLeftGlassCrown',
    'carDealershipRightGlassCrown',
    'carDealershipGlassEntryCanopy'
  ]);
  for (const nodeName of carDealershipTransparentGlassNames) {
    const node = carDealershipVisual.getObjectByName(nodeName);
    assert(node, `Car Dealership should include transparent glass panel ${nodeName}`);
    assert(node.material?.transparent === true, `${nodeName} should use a transparent panel material`);
    assert(node.material?.depthWrite === false, `${nodeName} should avoid depth-writing while transparent`);
    assert((node.material?.opacity ?? 1) >= 0.3 && (node.material?.opacity ?? 1) <= 0.45, `${nodeName} should stay visibly transparent instead of opaque blue`);
    assert(node.castShadow !== true, `${nodeName} should not cast solid shadows as transparent glass`);
  }
  const counterBounds = new Box3().setFromObject(carDealershipVisual.getObjectByName('carDealershipBackCounter'));
  const counterCenter = counterBounds.getCenter(new Vector3());
  assert(counterCenter.z > -7.95 && counterCenter.z < -7.5, 'Car Dealership counter should sit slightly further down from the rear wall');
  for (const nodeName of [
    'carDealershipRegisterBase',
    'carDealershipRegisterScreen',
    'carDealershipBrochureStack1',
    'carDealershipBrochureStack2',
    'carDealershipBrochureStack3',
    'carDealershipBrochureStack4'
  ]) {
    assert(!carDealershipVisual.getObjectByName(nodeName), `${nodeName} should be removed so no laptop-like props sit on the dealership floor or counter`);
  }
  for (const nodeName of [
    'carDealershipBackCounter',
    'carDealershipChair1',
    'carDealershipChair2',
    'carDealershipChair3',
    'carDealershipChair4',
    'carDealershipPlantBackLeft',
    'carDealershipPlantBackRight',
    'carDealershipPlantSideLeft',
    'carDealershipPlantSideRight'
  ]) {
    const bounds = new Box3().setFromObject(carDealershipVisual.getObjectByName(nodeName));
    assert(bounds.max.z <= -1.4, `${nodeName} should stay in the back half so the bottom two showroom tiles remain empty`);
  }
  const unexpectedCarDealershipTransparentMeshes = collectUnexpectedTransparentMeshNames(carDealershipVisual, carDealershipTransparentGlassNames);
  assert(
    unexpectedCarDealershipTransparentMeshes.length === 0,
    `Only Car Dealership glass panels should use transparent materials: ${unexpectedCarDealershipTransparentMeshes.join(', ')}`
  );
  const carDealershipBounds = new Box3().setFromObject(carDealershipVisual);
  const carDealershipSize = carDealershipBounds.getSize(new Vector3());
  assert(carDealershipSize.x <= CAR_DEALERSHIP_BUILDING_FOOTPRINT[0] + 0.02, 'Car Dealership visual should stay within the 2x2 tile width before fitting');
  assert(carDealershipSize.z <= CAR_DEALERSHIP_BUILDING_FOOTPRINT[1] + 0.02, 'Car Dealership visual should stay within the 2x2 tile depth before fitting');
  assert(
    !pawnShop.cameraOcclusionPreserveNodeNames?.includes('pawn_hull_wall'),
    'Pawn shop exterior hull walls should become transparent during active cutaway camera occlusion'
  );
  assert(pawnShop.movementCollisionRects?.length >= 8, 'Pawn shop should block movement with hull and counter/table collision');
  assert(pawnShop.shotCollisionRects?.length === pawnShop.movementCollisionRects.length, 'Pawn shop counter/table collision should also block shots');
  const pawnCounterRects = [];
  const pawnCounterStart = Math.max(0, pawnShop.movementCollisionRects.length - 3);
  for (let index = pawnCounterStart; index < pawnShop.movementCollisionRects.length; index += 1) {
    pawnCounterRects.push(pawnShop.movementCollisionRects[index]);
  }
  assert(
    hasPawnBackCounterRect(pawnCounterRects),
    'Pawn shop back counter/table should have movement collision'
  );
  assert(
    countPawnCounterReturnRects(pawnCounterRects) === 2,
    'Pawn shop counter/table returns should have movement collision'
  );
  const pawnPlacement = {
    id: 'validation-pawn-shop',
    itemId: 'pawn_building',
    layer: 'tile',
    cellX: 0,
    cellZ: 0,
    rotationQuarterTurns: 0
  };
  assert(
    placementToCollisionRects(pawnPlacement, pawnShop, { collisionKey: 'blocksMovement' }).length === pawnShop.movementCollisionRects.length,
    'Pawn shop movement collision should resolve all hull and counter/table blockers'
  );
  assert(
    placementToCollisionRects(pawnPlacement, pawnShop, { collisionKey: 'blocksShots' }).length === pawnShop.shotCollisionRects.length,
    'Pawn shop shot collision should resolve all hull and counter/table blockers'
  );
  const pawnVisual = pawnShop.createVisual();
  for (const nodeName of cutawayVisibleWallNames('pawn')) {
    assert(pawnVisual.getObjectByName(nodeName), `Pawn shop visual should expose ${nodeName} for cutaway visibility`);
  }
  assert(pawnVisual.getObjectByName('pawn_hull_wall_front'), 'Pawn shop visual should expose its front wall for cutaway hiding');
  assert(pawnVisual.getObjectByName('pawnShopBackCounter'), 'Pawn shop interior should include a back counter');
  assert(pawnVisual.getObjectByName('pawnShopLeftCounterReturn'), 'Pawn shop counter should wrap along the left back side');
  assert(pawnVisual.getObjectByName('pawnShopRightCounterReturn'), 'Pawn shop counter should wrap along the right back side');
  assert(pawnVisual.getObjectByName('pawnShopEntranceSignPanel'), 'Pawn shop should include a front entrance sign panel');
  const pawnGlassMeshes = getRequiredPawnGlassMeshes(pawnVisual);
  assertAllMeshesPresent(pawnGlassMeshes, 'Pawn shop should expose named glass meshes for depth validation');
  for (const glassMesh of pawnGlassMeshes) {
    assert(glassMesh.material?.transparent === true, `${glassMesh.name} should use a transparent material`);
    assert(glassMesh.material?.depthWrite === false, `${glassMesh.name} should not write depth while transparent`);
  }
  const pawnLetters = pawnVisual.getObjectByName('pawnShopPawnLetters');
  if (pawnLetters) {
    assert(pawnLetters.material?.depthWrite === false, 'Pawn shop sign letters should not write depth through transparent canvas pixels');
  }

  const rotatedBarSize = getTileFootprintWorldSize(bar, 1);
  assert(rotatedBarSize[0] === BUILDER_TILE_SIZE, '2x1 tiles should swap world width when rotated');
  assert(rotatedBarSize[1] === BUILDER_TILE_SIZE * 2, '2x1 tiles should swap world depth when rotated');

  const gymCells = sortedCellKeys(getTileOccupiedCells(largeGym, 10, 20, 0));
  assert(
    JSON.stringify(gymCells) === JSON.stringify(['10,20', '10,21', '11,20', '11,21']),
    '2x2 tiles should occupy four adjacent cells when unrotated'
  );

  const rotatedGymCells = sortedCellKeys(getTileOccupiedCells(largeGym, 10, 20, 1));
  assert(
    JSON.stringify(rotatedGymCells) === JSON.stringify(['10,19', '10,20', '11,19', '11,20']),
    '2x2 tiles should occupy the correct four cells when rotated'
  );

  const rotatedGymSize = getTileFootprintWorldSize(largeGym, 1);
  assert(rotatedGymSize[0] === BUILDER_TILE_SIZE * 2, '2x2 tiles should keep world width when rotated');
  assert(rotatedGymSize[1] === BUILDER_TILE_SIZE * 2, '2x2 tiles should keep world depth when rotated');
}

function validateProps() {
  for (let index = 0; index < defaultWorldLayout.props.length; index += 1) {
    const prop = defaultWorldLayout.props[index];
    const item = getBuilderItemById(prop.itemId);
    assert(item, `Prop ${index}: unknown itemId "${prop.itemId}"`);
    assert(item.layer === 'prop', `Prop ${index}: "${prop.itemId}" is not a prop catalog item`);
    assert(Array.isArray(prop.position) && prop.position.length === 2, `Prop ${index}: position must be [x, z]`);
    assert(positionValuesAreFinite(prop.position), `Prop ${index}: position values must be finite numbers`);
    validateRotationQuarterTurns(prop.rotationQuarterTurns, `Prop ${index}`);
  }

  const pickupProps = collectPickupProps(defaultWorldLayout.props);
  const pickupSpawns = getCombatPickupSpawnDefinitions(defaultWorldLayout.props, getBuilderItemById);
  assert(pickupProps.length >= 4, 'Default world should seed pistol pickups as placeable props');
  assert(pickupSpawns.length === pickupProps.length, 'Every default pistol pickup prop should resolve to a combat spawn');
  assert(
    allPickupSpawnsArePistol(pickupSpawns),
    'Default pickup props should resolve to pistol pickup spawns'
  );
}

async function validateBuildCity() {
  const scene = new Scene();
  const city = await buildCity(scene);
  assert(city.layout === defaultWorldLayout, 'buildCity should return the checked-in default world layout');
  assert(scene.children.length > 0, 'buildCity should add scene content');
}

function validateTaskSequence() {
  const charismaLevel5Xp = getSkillXpForLevel(CHARISMA_LEVEL_MISSION_TARGET_LEVEL);
  const charismaLevel4Xp = Math.max(0, charismaLevel5Xp - 1);
  const basePlayer = {
    deliveryQuestCompletionCount: 1,
    deliveryQuestStatus: '',
    gymPumpCompletedAt: 0,
    stockBoughtAt: 0,
    blackjackHandPlayedAt: 0,
    schoolTasksCompletedCount: 0,
    janitorTasksCompletedCount: 0,
    skateboardOwned: false,
    officeManagerCompletedAt: 0,
    ceoCompletedAt: 0,
    charismaXp: 0
  };
  const schoolCompletePlayer = {
    ...basePlayer,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED
  };
  const janitorCompletePlayer = {
    ...schoolCompletePlayer,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED
  };
  const acceptedDeliveryPlayer = {
    ...basePlayer,
    deliveryQuestId: DELIVERY_QUEST_ID,
    deliveryQuestStatus: DELIVERY_QUEST_STATUS.active,
    deliveryQuestTargetNpcId: 'npc_delivery_target',
    deliveryQuestCompletionCount: 0,
    deliveryQuestCompletedAt: 0
  };
  const completedDeliveryPlayer = {
    ...acceptedDeliveryPlayer,
    deliveryQuestStatus: DELIVERY_QUEST_STATUS.completed,
    deliveryQuestCompletionCount: 1,
    deliveryQuestCompletedAt: 1000
  };

  assert(JANITOR_TASKS_REQUIRED === 4, 'Get a job mission should require four janitor tasks.');
  assert(
    resolvePlayerTask({ localPlayerState: basePlayer }).id === TASK_IDS.schoolTeacherTasks,
    'Task sequence should route to school after first delivery.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: schoolCompletePlayer }).id === TASK_IDS.janitorTasks,
    'Task sequence should route to janitor work after school.'
  );
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...schoolCompletePlayer,
        janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED - 1
      }
    }).id === TASK_IDS.janitorTasks,
    'Task sequence should keep routing to janitor work after only three janitor tasks.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: janitorCompletePlayer }).id === TASK_IDS.gymPump,
    'Task sequence should route to the gym after janitor work.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000 } }).id === TASK_IDS.stockBuy,
    'Task sequence should route to buying a stock after the lift-or-shoot mission.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } }).id === TASK_IDS.blackjackHand,
    'Task sequence should route to blackjack after buying a stock.'
  );
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000
      }
    }).id === TASK_IDS.transportationUpgrade,
    'Task sequence should route to buying a skateboard after blackjack.'
  );
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000,
        skateboardOwned: true
      }
    }).id === TASK_IDS.officeManagerPromotion,
    'Task sequence should route to office manager after buying a skateboard.'
  );
  const officeManagerCompletePlayer = {
    ...janitorCompletePlayer,
    gymPumpCompletedAt: 1000,
    stockBoughtAt: 2000,
    blackjackHandPlayedAt: 3000,
    skateboardOwned: true,
    officeManagerCompletedAt: 4000
  };
  assert(
    resolvePlayerTask({ localPlayerState: officeManagerCompletePlayer }).id === TASK_IDS.charismaLevel5,
    'Task sequence should route to the Charisma level mission after office manager.'
  );
  const charismaCompletePlayer = {
    ...officeManagerCompletePlayer,
    charismaXp: charismaLevel5Xp
  };
  assert(
    resolvePlayerTask({ localPlayerState: charismaCompletePlayer }).id === TASK_IDS.becomeCeo,
    'Task sequence should route to the CEO mission after Charisma level 5.'
  );
  const allSequencedMissionsCompletePlayer = {
    ...charismaCompletePlayer,
    ceoCompletedAt: 5000
  };
  assert(
    resolvePlayerTask({ localPlayerState: allSequencedMissionsCompletePlayer }).id === '',
    'Task sequence should stop showing Shady Figure delivery work after the sequenced missions are complete.'
  );
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...allSequencedMissionsCompletePlayer,
        selectedMissionId: TASK_IDS.makeMoney
      }
    }).id === '',
    'A stale selected make-money mission should not keep the Shady Figure delivery prompt alive after completion.'
  );

  const deliveryTracker = new TaskTracker();
  deliveryTracker.update({
    localPlayerState: {
      ...basePlayer,
      deliveryQuestCompletionCount: 0
    }
  });
  assert(
    deliveryTracker.update({ localPlayerState: acceptedDeliveryPlayer }).completedTask === false,
    'Task tracker should not complete the Shady Figure delivery task when delivery work is only accepted.'
  );
  assert(
    deliveryTracker.update({ localPlayerState: completedDeliveryPlayer }).completedTask,
    'Task tracker should complete the Shady Figure delivery task when the delivery is completed.'
  );

  const schoolTracker = new TaskTracker();
  schoolTracker.update({ localPlayerState: basePlayer });
  assert(
    schoolTracker.update({ localPlayerState: { ...basePlayer, schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED - 1 } }).completedTask === false,
    'Task tracker should not complete the school mission before all teacher tasks are done.'
  );
  assert(
    schoolTracker.update({ localPlayerState: schoolCompletePlayer }).completedTask,
    'Task tracker should complete the school mission when all teacher tasks are done.'
  );

  const janitorTracker = new TaskTracker();
  janitorTracker.update({ localPlayerState: schoolCompletePlayer });
  assert(
    janitorTracker.update({ localPlayerState: { ...schoolCompletePlayer, janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED - 1 } }).completedTask === false,
    'Task tracker should not complete the janitor mission before all janitor tasks are done.'
  );
  assert(
    janitorTracker.update({ localPlayerState: janitorCompletePlayer }).completedTask,
    'Task tracker should complete the janitor mission when all janitor tasks are done.'
  );

  const stockTracker = new TaskTracker();
  stockTracker.update({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000 } });
  assert(
    stockTracker.update({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } }).completedTask,
    'Task tracker should complete the stock-buy task when a stock is bought.'
  );

  const blackjackTracker = new TaskTracker();
  blackjackTracker.update({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } });
  assert(
    blackjackTracker.update({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000
      }
    }).completedTask,
    'Task tracker should complete the blackjack task when a hand is played.'
  );

  const skateboardTracker = new TaskTracker();
  skateboardTracker.update({
    localPlayerState: {
      ...janitorCompletePlayer,
      gymPumpCompletedAt: 1000,
      stockBoughtAt: 2000,
      blackjackHandPlayedAt: 3000
    }
  });
  assert(
    skateboardTracker.update({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000,
        skateboardOwned: true
      }
    }).completedTask,
    'Task tracker should complete the transportation mission when a skateboard is bought.'
  );

  const managerTracker = new TaskTracker();
  managerTracker.update({
    localPlayerState: {
      ...janitorCompletePlayer,
      gymPumpCompletedAt: 1000,
      stockBoughtAt: 2000,
      blackjackHandPlayedAt: 3000,
      skateboardOwned: true
    }
  });
  assert(
    managerTracker.update({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000,
        skateboardOwned: true,
        officeManagerCompletedAt: 4000
      }
    }).completedTask,
    'Task tracker should complete the promotion mission when office manager work is completed.'
  );

  const charismaTracker = new TaskTracker();
  charismaTracker.update({
    localPlayerState: {
      ...officeManagerCompletePlayer,
      charismaXp: charismaLevel4Xp
    }
  });
  assert(
    charismaTracker.update({
      localPlayerState: {
        ...officeManagerCompletePlayer,
        charismaXp: charismaLevel5Xp
      }
    }).completedTask,
    'Task tracker should complete the Charisma mission when Charisma reaches level 5.'
  );

  const ceoTracker = new TaskTracker();
  ceoTracker.update({ localPlayerState: charismaCompletePlayer });
  assert(
    ceoTracker.update({
      localPlayerState: {
        ...charismaCompletePlayer,
        ceoCompletedAt: 5000
      }
    }).completedTask,
    'Task tracker should complete the CEO mission when CEO work is completed.'
  );
}

function validateDeliveryQuestCarry() {
  const deliveryBox = getHeldItemDefinition(HELD_ITEM_IDS.deliveryBox);
  assert(
    String(assets.mixamo.animations.carrying ?? '').includes('/mixamo/animations/carrying-upper-body.json'),
    'Delivery carry animation should use the optimized upper-body asset.'
  );
  const carryingClip = JSON.parse(readFileSync(new URL('../assets/mixamo/animations/carrying-upper-body.json', import.meta.url), 'utf8'));
  assert(
    Array.isArray(carryingClip.tracks) && carryingClip.tracks.length > 0,
    'Optimized delivery carry clip should include animation tracks.'
  );
  assert(
    deliveryCarryClipHasOnlyUpperBodyTracks(carryingClip.tracks),
    'Optimized delivery carry clip should not include lower-body tracks.'
  );
  assert(deliveryBox, 'Delivery quest should define a held delivery box item.');
  assert(
    deliveryBox.attachmentSlot === ATTACHMENT_SLOTS.handLeft,
    'Delivery box should attach to the left hand so it can ride the carrying pose.'
  );
  assert(
    Number(deliveryBox.normalize?.maxDimension) >= 0.95 && Number(deliveryBox.normalize?.maxDimension) <= 1,
    'Delivery box should be sized wide enough for the two-hand carry pose.'
  );
  assert(
    deliveryBox.gripOffset?.position?.[0] > 0.35
      && deliveryBox.gripOffset?.position?.[1] > 0.12
      && deliveryBox.gripOffset?.position?.[2] > 0.3,
    'Delivery box grip should place the package between the carry-pose hands instead of on one palm.'
  );
  assert(
    deliveryBox.gripOffset?.rotation?.[0] > 1
      && deliveryBox.gripOffset?.rotation?.[1] > 0.05
      && deliveryBox.gripOffset?.rotation?.[2] > 0.7,
    'Delivery box grip should rotate the box width across the two carry-pose hands.'
  );
  assert(
    typeof deliveryBox.createModel === 'function',
    'Delivery quest should use a dedicated cardboard-box 3D model.'
  );
  const nullTransformTarget = new Group();
  applyAttachmentTransform(nullTransformTarget, null);
  assert(
    nullTransformTarget.position.lengthSq() === 0
      && nullTransformTarget.rotation.x === 0
      && nullTransformTarget.rotation.y === 0
      && nullTransformTarget.rotation.z === 0,
    'Held item attachment transforms should tolerate optional/null profiles.'
  );
  const deliveryBoxModel = deliveryBox.createModel();
  const deliveryBoxBounds = new Box3().setFromObject(deliveryBoxModel);
  const deliveryBoxSize = deliveryBoxBounds.getSize(new Vector3());
  const deliveryBoxMeshes = [];
  deliveryBoxModel.traverse((node) => {
    if (node.isMesh) {
      deliveryBoxMeshes.push(node);
    }
  });
  assert(deliveryBoxMeshes.length >= 8, 'Delivery box model should include visible 3D box, tape, and edge detail meshes.');
  assert(
    deliveryBoxSize.x > 0.8 && deliveryBoxSize.y > 0.5 && deliveryBoxSize.z > 0.6,
    'Delivery box model should have package-like 3D proportions before normalization.'
  );

  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const playerSource = readFileSync(new URL('../src/player/createPlayer.js', import.meta.url), 'utf8');
  assert(
    /maybeAutoCompleteDelivery\(/.test(gameSource),
    'Game client should auto-complete active deliveries in the target NPC interact radius.'
  );
  assert(
    /setDeliveryPackageActive/.test(playerSource) && /DELIVERY_CARRY_CLIP_NAME = 'carrying'/.test(playerSource),
    'Player avatar should expose delivery package visuals backed by the carrying animation.'
  );
  assert(
    /import\s*\{[^}]*HELD_ITEM_IDS[^}]*\}\s*from '\.\.\/shared\/heldItemDefinitions\.js'/su.test(playerSource),
    'Player delivery package logic should import held item ids before attaching the delivery box.'
  );
}

function validateMissionSequencer() {
  const sequence = normalizeMissionSequenceConfig(defaultWorldLayout.missionSequence);
  const expectedOrder = [
    TASK_IDS.makeMoney,
    TASK_IDS.delivery,
    TASK_IDS.schoolTeacherTasks,
    TASK_IDS.janitorTasks,
    TASK_IDS.gymPump,
    TASK_IDS.stockBuy,
    TASK_IDS.blackjackHand,
    TASK_IDS.transportationUpgrade,
    TASK_IDS.officeManagerPromotion,
    TASK_IDS.charismaLevel5,
    TASK_IDS.becomeCeo
  ];
  const expectedGateNumbers = [0, 1, 2, 3, 4, 4, 4, 4, 7, 9, 10];
  assert(sequence.length === MISSION_CATALOG.length, 'Mission sequencer should include every catalog mission');
  assert(
    sequenceMissionIdsMatch(sequence, expectedOrder),
    'Mission sequencer should use the admin-authored mission order'
  );
  const janitorMission = findCatalogMissionById(TASK_IDS.janitorTasks);
  assert(janitorMission?.title === 'Get a job: Complete 4 janitor tasks', 'Janitor mission should require four tasks in the catalog title');
  assert(janitorMission?.description === 'Work four janitor tasks from the office job board.', 'Janitor mission should require four tasks in the catalog description');
  assert(sequence[3]?.title === 'Get a job : Complete 4 janitor tasks', 'Janitor sequencer row should show four janitor tasks');
  const charismaMission = findCatalogMissionById(TASK_IDS.charismaLevel5);
  assert(charismaMission?.title === 'Get Charisma level 5', 'Sequenced Charisma mission should use the admin title');
  assert(
    charismaMission?.description === CHARISMA_LEVEL_MISSION_DESCRIPTION,
    'Sequenced Charisma mission should preserve the admin description'
  );
  const gymMission = findCatalogMissionById(TASK_IDS.gymPump);
  assert(gymMission?.title === 'Lift at the gym, shoot hoops, or run the treadmill', 'Gym mission should mention lifting, shooting hoops, or running');
  assert(/basketball/i.test(gymMission?.description ?? ''), 'Gym mission description should include the basketball completion path');
  assert(/treadmill/i.test(gymMission?.description ?? ''), 'Gym mission description should include the treadmill completion path');
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const serverSource = readFileSync(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const mockServiceSource = readFileSync(new URL('../src/npc/NpcServiceMock.js', import.meta.url), 'utf8');
  assert(
    /Shot missed\. No XP awarded\.[\s\S]*finishWorkout\(\{ awardXp: false, showCompleteToast: false \}\)/.test(gameSource),
    'Missed basketball shots should still report the shot attempt without XP'
  );
  assert(
    /target\.workoutType === 'basketball-shot'[\s\S]*player\.gymPumpCompletedAt = Date\.now\(\)/.test(serverSource),
    'Server basketball shots should complete the lift-or-shoot mission'
  );
  assert(
    /target\.workoutType === 'basketball-shot' \|\| target\.workoutType === 'treadmill'[\s\S]*BASKETBALL_SHOT_STRENGTH_XP[\s\S]*BASKETBALL_SHOT_AGILITY_XP/.test(serverSource),
    'Server treadmill runs should share the basketball strength and agility XP reward'
  );
  assert(
    /target\.workoutType === 'basketball-shot'[\s\S]*player\.gymPumpCompletedAt = Date\.now\(\)/.test(mockServiceSource),
    'Mock basketball shots should complete the lift-or-shoot mission'
  );
  assert(
    /target\.workoutType === 'basketball-shot' \|\| target\.workoutType === 'treadmill'[\s\S]*BASKETBALL_SHOT_STRENGTH_XP[\s\S]*BASKETBALL_SHOT_AGILITY_XP/.test(mockServiceSource),
    'Mock treadmill runs should share the basketball strength and agility XP reward'
  );
  const ceoMission = findCatalogMissionById(TASK_IDS.becomeCeo);
  assert(ceoMission?.label === 'Become CEO', 'Sequenced CEO mission should be promoted into the playable mission catalog');
  assert(sequence[0].makeAvailableAfterMission === false, 'The first mission should be available without a prior mission');
  for (let index = 1; index < sequence.length; index += 1) {
    assert(sequence[index].makeAvailableAfterMission === true, `Mission ${index + 1} should default to a sequence gate`);
    assert(
      sequence[index].availableAfterMissionNumber === expectedGateNumbers[index],
      `Mission ${index + 1} should preserve its authored gate`
    );
  }

  const moved = moveMissionSequenceEntry(sequence, 5, 1);
  assert(moved[1].missionId === TASK_IDS.stockBuy, 'Mission sequencer drag reorder should move missions by index');
  assert(moved[1].availableAfterMissionNumber === 1, 'Moved missions should clamp their gate to an earlier mission number');

  const ungatedStock = updateMissionSequenceEntry(moved, TASK_IDS.stockBuy, {
    makeAvailableAfterMission: false
  });
  const noProgressPlayer = {
    deliveryQuestCompletionCount: 0,
    deliveryQuestStatus: '',
    gymPumpCompletedAt: 0,
    stockBoughtAt: 0,
    blackjackHandPlayedAt: 0,
    schoolTasksCompletedCount: 0,
    janitorTasksCompletedCount: 0,
    skateboardOwned: false,
    officeManagerCompletedAt: 0,
    charismaXp: 0
  };
  const stockSnapshot = findMissionSnapshotById(getMissionSnapshots(noProgressPlayer, '', ungatedStock), TASK_IDS.stockBuy);
  assert(stockSnapshot?.status === MISSION_STATUS.available, 'Unchecked mission gates should make that mission available when its own task is unfinished');

  const editedStockText = 'Buy one share from any bank terminal.';
  const editedStockSequence = updateMissionSequenceEntry(sequence, TASK_IDS.stockBuy, {
    text: editedStockText
  });
  const editedStockSnapshot = findMissionSnapshotById(getMissionSnapshots(noProgressPlayer, '', editedStockSequence), TASK_IDS.stockBuy);
  assert(editedStockSnapshot?.title === editedStockText, 'Mission text edits should override player-facing catalog mission titles');

  const defaultSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1
  }, '', sequence);
  const schoolSnapshot = findMissionSnapshotById(defaultSnapshots, TASK_IDS.schoolTeacherTasks);
  const janitorLockedSnapshot = findMissionSnapshotById(defaultSnapshots, TASK_IDS.janitorTasks);
  const stockLockedSnapshot = findMissionSnapshotById(defaultSnapshots, TASK_IDS.stockBuy);
  const makeMoneySnapshot = findMissionSnapshotById(defaultSnapshots, TASK_IDS.makeMoney);
  assert(makeMoneySnapshot?.status === MISSION_STATUS.completed, 'Default sequence should complete the make-money prompt after the first delivery');
  assert(makeMoneySnapshot?.selectable === false, 'Completed make-money prompt should not remain selectable as a repeatable Shady Figure mission');
  assert(schoolSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock school after delivery');
  assert(janitorLockedSnapshot?.status === MISSION_STATUS.locked, 'Default sequence should keep janitor work locked until school is complete');
  assert(stockLockedSnapshot?.status === MISSION_STATUS.locked, 'Default sequence should keep stock locked until janitor work is complete');

  const postJanitorSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED
  }, '', sequence);
  const gymSnapshot = findMissionSnapshotById(postJanitorSnapshots, TASK_IDS.gymPump);
  const transportationSnapshot = findMissionSnapshotById(postJanitorSnapshots, TASK_IDS.transportationUpgrade);
  assert(gymSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock gym after janitor work');
  assert(transportationSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock the skateboard mission after janitor work');

  const postOfficeSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED,
    gymPumpCompletedAt: 1,
    stockBoughtAt: 1,
    blackjackHandPlayedAt: 1,
    skateboardOwned: true,
    officeManagerCompletedAt: 1
  }, '', sequence);
  const charismaSnapshot = findMissionSnapshotById(postOfficeSnapshots, TASK_IDS.charismaLevel5);
  assert(charismaSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock the Charisma mission after office manager work');
  assert(charismaSnapshot?.selectable === true, 'Unlocked Charisma mission should be selectable before level 5');

  const postCharismaSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED,
    gymPumpCompletedAt: 1,
    stockBoughtAt: 1,
    blackjackHandPlayedAt: 1,
    skateboardOwned: true,
    officeManagerCompletedAt: 1,
    charismaXp: getSkillXpForLevel(CHARISMA_LEVEL_MISSION_TARGET_LEVEL)
  }, '', sequence);
  const completedCharismaSnapshot = findMissionSnapshotById(postCharismaSnapshots, TASK_IDS.charismaLevel5);
  const availableCeoSnapshot = findMissionSnapshotById(postCharismaSnapshots, TASK_IDS.becomeCeo);
  assert(completedCharismaSnapshot?.status === MISSION_STATUS.completed, 'Charisma mission should complete at level 5');
  assert(availableCeoSnapshot?.status === MISSION_STATUS.available, 'CEO mission should unlock after the Charisma mission');

  const postCeoSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED,
    gymPumpCompletedAt: 1,
    stockBoughtAt: 1,
    blackjackHandPlayedAt: 1,
    skateboardOwned: true,
    officeManagerCompletedAt: 1,
    charismaXp: getSkillXpForLevel(CHARISMA_LEVEL_MISSION_TARGET_LEVEL),
    ceoCompletedAt: 1
  }, '', sequence);
  const completedCeoSnapshot = findMissionSnapshotById(postCeoSnapshots, TASK_IDS.becomeCeo);
  assert(completedCeoSnapshot?.status === MISSION_STATUS.completed, 'CEO mission should complete after a CEO shift');

  const rows = getMissionSequenceViewModel(sequence);
  assert(rowsHaveStableMissionNumbers(rows), 'Mission sequencer view model should expose stable mission numbers');
  assert(rows[0].canRequireMission === false, 'The opening mission row should not allow a self dependency');

  const customPrompt = 'Win a street race behind the casino.';
  const sequenceWithCustomMission = appendMissionSequencePromptEntry(sequence, customPrompt);
  assert(sequenceWithCustomMission.length === sequence.length + 1, 'Mission prompt form should append a custom mission');
  const customMission = sequenceWithCustomMission.at(-1);
  assert(customMission?.custom === true, 'Prompt-created missions should be marked as custom sequence entries');
  assert(customMission?.description === customPrompt, 'Prompt-created missions should preserve the admin text');
  assert(customMission?.makeAvailableAfterMission === true, 'Prompt-created missions should default to a prior-mission gate');
  assert(customMission?.availableAfterMissionNumber === sequence.length, 'Prompt-created missions should default to the previous mission number');

  const customRows = getMissionSequenceViewModel(sequenceWithCustomMission);
  assert(customRows.at(-1)?.label, 'Custom mission rows should expose a display label');

  const bonusPrompt = 'Find the rooftop stash behind the gym.';
  const sequenceWithBonusMission = appendMissionSequencePromptEntry(sequenceWithCustomMission, bonusPrompt, {
    bonusQuest: true
  });
  assert(sequenceWithBonusMission.length === sequenceWithCustomMission.length + 1, 'Bonus quest prompts should append a mission entry');
  const bonusMission = sequenceWithBonusMission.at(-1);
  assert(bonusMission?.bonusQuest === true, 'Bonus quest prompts should mark the entry as a bonus quest');
  assert(bonusMission?.makeAvailableAfterMission === false, 'Bonus quests should default to always available');
  assert(bonusMission?.availableAfterMissionNumber === 0, 'Bonus quests should not default to a sequence gate');
  const mainAfterBonusPrompt = 'Open the mainline finale.';
  const mainAfterBonusSequence = appendMissionSequencePromptEntry(sequenceWithBonusMission, mainAfterBonusPrompt);
  assert(
    mainAfterBonusSequence.at(-2)?.prompt === mainAfterBonusPrompt
    && mainAfterBonusSequence.at(-1)?.missionId === bonusMission.missionId,
    'Main sequence prompts added after bonus quests should stay above the bonus quest section'
  );
  assert(
    mainAfterBonusSequence.at(-1)?.bonusQuest === true,
    `Bonus quest rows should stay in the ${MISSION_SEQUENCE_SECTIONS.bonus} section`
  );

  const completePlayer = {
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED,
    gymPumpCompletedAt: 1,
    stockBoughtAt: 1,
    blackjackHandPlayedAt: 1,
    skateboardOwned: true,
    officeManagerCompletedAt: 1,
    ceoCompletedAt: 1,
    charismaXp: getSkillXpForLevel(CHARISMA_LEVEL_MISSION_TARGET_LEVEL)
  };

  const legacyTwoMoreWheelsPrompt = 'Two more wheels : Purchase a car from the car dealer.';
  const retitledFourMoreWheelsSequence = normalizeMissionSequenceConfig([
    ...sequence,
    {
      missionId: FOUR_MORE_WHEELS_LEGACY_MISSION_ID,
      custom: true,
      title: legacyTwoMoreWheelsPrompt,
      label: legacyTwoMoreWheelsPrompt,
      description: legacyTwoMoreWheelsPrompt,
      prompt: legacyTwoMoreWheelsPrompt,
      makeAvailableAfterMission: true,
      availableAfterMissionNumber: sequence.length
    }
  ]);
  const fourMoreWheelsMission = retitledFourMoreWheelsSequence.at(-1);
  assert(
    fourMoreWheelsMission?.missionId === FOUR_MORE_WHEELS_LEGACY_MISSION_ID,
    'Legacy Two more wheels custom mission id should stay selectable after retitling'
  );
  assert(
    fourMoreWheelsFieldsAreRetitled(fourMoreWheelsMission),
    'Legacy Two more wheels custom mission should display as Four more wheels everywhere'
  );
  const fourMoreWheelsSnapshot = findMissionSnapshotById(getMissionSnapshots(
    completePlayer,
    FOUR_MORE_WHEELS_LEGACY_MISSION_ID,
    retitledFourMoreWheelsSequence
  ), FOUR_MORE_WHEELS_LEGACY_MISSION_ID);
  assert(
    fourMoreWheelsSnapshot?.title.startsWith(FOUR_MORE_WHEELS_MISSION_TITLE),
    'Mission snapshots should expose the Four more wheels retitle'
  );
  assert(fourMoreWheelsSnapshot?.selectable === true, 'Four more wheels should remain selectable under the legacy custom mission id');

  const customSnapshot = findMissionSnapshotById(getMissionSnapshots(completePlayer, customMission.missionId, sequenceWithCustomMission), customMission.missionId);
  assert(customSnapshot?.status === MISSION_STATUS.available, 'Custom missions should become available when their sequence gate is satisfied');
  assert(customSnapshot?.selectable === true, 'Available custom missions should be selectable from the mission app');

  const hiddenBonusText = 'Steal the velvet briefcase from the club office.';
  const hiddenBonusSequence = updateMissionSequenceEntry(sequenceWithBonusMission, bonusMission.missionId, {
    hiddenForPlayers: true,
    text: hiddenBonusText
  });
  const hiddenBonusEntry = findMissionSequenceEntry(hiddenBonusSequence, bonusMission.missionId);
  assert(hiddenBonusEntry?.textOverride === true, 'Edited bonus quests should persist an explicit text override');
  assert(hiddenBonusEntry?.prompt === hiddenBonusText, 'Edited bonus quests should preserve the admin-authored text');
  const hiddenBonusRows = getMissionSequenceViewModel(hiddenBonusSequence);
  const hiddenBonusRow = findMissionSequenceEntry(hiddenBonusRows, bonusMission.missionId);
  assert(hiddenBonusRow?.bonusQuest === true, 'Bonus quest rows should expose their bonus section to the sequencer view model');
  assert(hiddenBonusRow?.hiddenForPlayers === true, 'Sequencer rows should expose the hidden-for-players flag');
  const hiddenBonusSnapshot = findMissionSnapshotById(getMissionSnapshots(completePlayer, bonusMission.missionId, hiddenBonusSequence), bonusMission.missionId);
  assert(hiddenBonusSnapshot?.bonusQuest === true, 'Bonus quest snapshots should remain marked for the player mission section');
  assert(hiddenBonusSnapshot?.hiddenForPlayers === true, 'Hidden bonus quest snapshots should preserve the hidden flag');
  assert(hiddenBonusSnapshot?.title === 'Hidden', 'Hidden bonus quests should display a hidden title to players');
  assert(hiddenBonusSnapshot?.description === 'Hidden', 'Hidden bonus quests should display hidden details to players');

  const chainedCustomSequence = appendMissionSequencePromptEntry(sequenceWithCustomMission, 'Check off the crew board.');
  const chainedCustomMission = chainedCustomSequence.at(-1);
  const chainedCustomSnapshot = findMissionSnapshotById(getMissionSnapshots(completePlayer, chainedCustomMission.missionId, chainedCustomSequence), chainedCustomMission.missionId);
  assert(chainedCustomSnapshot?.status === MISSION_STATUS.available, 'Custom missions should not permanently block later sequenced missions');
}

function validateBartenderFunction() {
  const beer = getBartenderMenuItem('beer');
  const shot = getBartenderMenuItem('shot');
  assert(beer?.price === 20, 'Bartender beer should cost $20');
  assert(shot?.price === 50, 'Bartender shot should cost $50');
  assert(beer?.dose === 1, 'Beer should count as one drunkness dose');
  assert(shot?.dose === 2, 'Shot should count as two drunkness doses');
  assert(listBartenderMenuItems().length === 2, 'Bartender menu should include exactly beer and shot');
  assert(getDrunknessLevelForDose(1) === 1, 'One drink dose should create drunkness level 1');
  assert(getDrunknessLevelForDose(5) === 2, 'Five drink doses should create drunkness level 2');
  assert(getDrunknessLevelForDose(10) === 3, 'Ten drink doses should create drunkness level 3');
  assert(getDrunknessLevelForDose(15) === 4, 'Fifteen drink doses should create drunkness level 4');
  assert(getDrunknessLevelForDose(20) === 5, 'Twenty drink doses should create drunkness level 5');
  assert(DRUNKNESS_LEVEL_LABELS.length === 6, 'Drunkness labels should include sober plus five drunkness levels');
  assert(getDrunknessLevelLabel(1) === 'buzzed', 'Drunkness level 1 should be labeled buzzed');
  assert(getDrunknessLevelLabel(2) === 'tipsy', 'Drunkness level 2 should be labeled tipsy');
  assert(getDrunknessLevelLabel(3) === 'drunk', 'Drunkness level 3 should be labeled drunk');
  assert(getDrunknessLevelLabel(4) === 'wasted', 'Drunkness level 4 should be labeled wasted');
  assert(getDrunknessLevelLabel(5) === 'plastered', 'Drunkness level 5 should be labeled plastered');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = readFileSync(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const vehiclePreviewSource = readFileSync(new URL('../src/ui/VehiclePreviewRenderer.js', import.meta.url), 'utf8');
  const playerSource = readFileSync(new URL('../src/player/createPlayer.js', import.meta.url), 'utf8');
  const skateboardModelSource = readFileSync(new URL('../src/shared/skateboardModel.js', import.meta.url), 'utf8');
  const serverSource = readFileSync(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const worldRendererSource = readFileSync(new URL('../src/world/WorldRenderer.js', import.meta.url), 'utf8');
  const npcBehaviorSource = readFileSync(new URL('../src/npc/npcBehavior.js', import.meta.url), 'utf8');
  const npcSimulationSource = readFileSync(new URL('../src/npc/npcSimulationMethods.js', import.meta.url), 'utf8');
  const npcActorSource = readFileSync(new URL('../src/npc/NpcActor.js', import.meta.url), 'utf8');
  const mockNpcServiceSource = readFileSync(new URL('../src/npc/NpcServiceMock.js', import.meta.url), 'utf8');
  const worldBuilderSource = readFileSync(new URL('../src/world/WorldBuilder.js', import.meta.url), 'utf8');
  const worldEditAdapterSource = readFileSync(new URL('../src/world/createWorldEditAdapter.js', import.meta.url), 'utf8');

  const skateboardModel = createSkateboardModel({ namePrefix: 'Validation' });
  skateboardModel.updateWorldMatrix(true, true);
  const skateboardDeck = skateboardModel.getObjectByName('ValidationSkateboardDeck');
  const skateboardBackside = skateboardModel.getObjectByName('ValidationSkateboardBackside');
  const skateboardGrip = skateboardModel.getObjectByName('ValidationSkateboardGrip');
  const skateboardNoseStripe = skateboardModel.getObjectByName('ValidationSkateboardNoseStripe');
  const skateboardTailStripe = skateboardModel.getObjectByName('ValidationSkateboardTailStripe');
  const skateboardDeckSize = new Box3().setFromObject(skateboardDeck).getSize(new Vector3());
  const skateboardModelSize = new Box3().setFromObject(skateboardModel).getSize(new Vector3());
  const skateboardWheels = skateboardModel.children.filter((child) => /^ValidationSkateboardWheel_[LR]_[BF]$/.test(child.name));
  const skateboardHubs = skateboardModel.children.filter((child) => /^ValidationSkateboardWheelHub_[LR]_[BF]$/.test(child.name));
  const skateboardBolts = skateboardModel.children.filter((child) => /^ValidationSkateboardBolt_/.test(child.name));
  assert(
    skateboardDeck?.geometry?.type === 'ExtrudeGeometry'
      && skateboardGrip?.geometry?.type === 'ShapeGeometry'
      && skateboardDeckSize.x <= 0.78
      && skateboardDeckSize.z >= 2.35
      && skateboardDeckSize.x / skateboardDeckSize.z < 0.34
      && SKATEBOARD_MODEL_DIMENSIONS.deckWidth === 0.72,
    'Skateboard model should use a skinny rounded deck with inset grip tape instead of a wide box deck'
  );
  assert(
    skateboardNoseStripe
      && skateboardTailStripe
      && skateboardBolts.length === 8,
    'Skateboard model should include top-side stripe and bolt details'
  );
  assert(
    skateboardDeck?.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.deck
      && skateboardBackside?.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.backside
      && skateboardGrip?.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.grip
      && skateboardNoseStripe?.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.stripe
      && skateboardWheels.every((wheel) => wheel.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.wheel)
      && skateboardHubs.every((hub) => hub.material?.color?.getHex() === SKATEBOARD_MODEL_COLORS.hub),
    'Skateboard model should use a classic black-and-tan palette with a tan backside and cream wheels'
  );
  assert(
    skateboardModel.getObjectByName('ValidationSkateboardTruckFront')
      && skateboardModel.getObjectByName('ValidationSkateboardTruckBack')
      && skateboardWheels.length === 4
      && skateboardHubs.length === 4
      && skateboardModelSize.x > skateboardDeckSize.x
      && skateboardModelSize.x <= 1.26,
    'Skateboard model should keep slim trucks with four outboard wheels and visible hubs'
  );
  assert(
    /\.hud__interaction\.is-world-anchored\s*\{[^}]*bottom:\s*auto/s.test(styles),
    'Bartender interaction menu should support anchored in-world placement'
  );
  assert(
    /getNpcInteractableIndicatorText/.test(worldRendererSource)
      && /npc\.pawnShopOwnerEnabled === true[\s\S]*Browse pawn shop/.test(worldRendererSource)
      && /npc\.carDealerEnabled === true[\s\S]*Browse cars/.test(worldRendererSource)
      && /rendered\.actor\.runtimeState/.test(worldRendererSource),
    'NPC service providers should expose prop-style interactable indicators while alive'
  );
  assert(
    /createDeliveryQuestPromptInteractable/.test(gameSource)
      && /Accept delivery job/.test(gameSource)
      && /this\.currentInteractable = deliveryPromptInteraction[\s\S]*\?\? carDealerInteraction[\s\S]*\?\? marthaInteraction[\s\S]*\?\? nearest/.test(gameSource),
    'NPC service interactions should feed the active HUD/admin interactable context'
  );
  assert(
    /setInteractionMenuAnchor\(anchor = null\)/.test(hudSource),
    'HUD interaction menu should expose an anchor updater'
  );
  assert(
    /showInteractionMenu\(\{\s*title,\s*subtitle,\s*actions,\s*anchor = null,\s*variant = ''\s*\}\)/.test(hudSource),
    'HUD interaction menu should accept a world anchor'
  );
  assert(
    /getNearestBartenderInteractable\((?:\{\s*npcId = ''[\s\S]*?worldBuilderInteractables = this\.getWorldBuilderInteractables\(\)[\s\S]*?\} = \{\}|options = null\)[\s\S]*?options\?\.npcId)/.test(gameSource),
    'Bartender proximity lookup should support the active NPC id'
  );
  assert(
    /this\.syncActiveBartenderMenu\(bartenderInteraction\);/.test(gameSource),
    'Bartender menu should resync and close during interaction updates'
  );
  assert(
    /anchor:\s*menu\.anchor/.test(gameSource),
    'Bartender menu should pass its in-world anchor to the HUD'
  );
  assert(
    /\.hud__drunkness-label\.is-active\s*\{[^}]*animation:\s*hud-drunkness-label-wobble/s.test(styles),
    'Only the active drunkness label should receive the wobble animation'
  );
  assert(
    /\.hud__drunkness-label\.is-filled\s*\{[^}]*animation:/s.test(styles) === false,
    'Filled inactive drunkness labels should not animate'
  );
  assert(
    /\.hud__drunkness-label\[data-drunkness-label-level="5"\]\s*\{[^}]*--drunkness-label-active-scale:\s*1\.2/s.test(styles),
    'Plastered should have the largest active drunkness label scale'
  );
  assert(
    /\.hud__drunkness-label\[data-drunkness-label-level="5"\]\.is-active\s*\{[^}]*animation-name:\s*hud-drunkness-label-plastered/s.test(styles),
    'Plastered should use the goofiest drunkness label animation'
  );
  assert(getDrunknessDurationMs(1) === 30000, 'Level 1 drunkness should last 30 seconds');
  assert(getDrunknessDurationMs(5) === DRUNKNESS_MAX_DURATION_MS, 'Level 5 drunkness should last the max duration');
  assert(DRUNKNESS_MAX_DURATION_MS === 150000, 'Level 5 drunkness should last two and a half minutes');
  assert(getDrunknessDoseForLevel(4) === 15, 'Level 4 drunkness should decay to the level 4 dose floor');
  assert(getDrunknessLevelForTimeRemaining(151000, 1000) === 5, 'Level 5 drunkness should show for the first 30 seconds');
  assert(getDrunknessLevelForTimeRemaining(151000, 31000) === 4, 'Drunkness should drop from level 5 to 4 after 30 seconds');
  assert(getDrunknessLevelForTimeRemaining(151000, 61000) === 3, 'Drunkness should drop one level every 30 seconds');
  assert(getDrunknessLevelForTimeRemaining(151000, 121000) === 1, 'Level 5 drunkness should scale down to level 1 before clearing');

  const beerPlayer = { beerCount: 0, shotCount: 0, drunknessDose: 0, drunknessLevel: 0, drunknessEndsAt: 0 };
  addPlayerDrink(beerPlayer, DRINK_ITEM_IDS.beer, 20);
  for (let index = 0; index < 20; index += 1) {
    consumePlayerDrink(beerPlayer, DRINK_ITEM_IDS.beer, 1000);
  }
  assert(beerPlayer.beerCount === 0, 'Consuming beers should remove them from inventory');
  assert(beerPlayer.drunknessLevel === 5, 'Twenty beers should reach max drunkness');

  const shotPlayer = { beerCount: 0, shotCount: 0, drunknessDose: 0, drunknessLevel: 0, drunknessEndsAt: 0 };
  addPlayerDrink(shotPlayer, DRINK_ITEM_IDS.shot, 10);
  for (let index = 0; index < 10; index += 1) {
    consumePlayerDrink(shotPlayer, DRINK_ITEM_IDS.shot, 1000);
  }
  assert(shotPlayer.shotCount === 0, 'Consuming shots should remove them from inventory');
  assert(shotPlayer.drunknessLevel === 5, 'Ten shots should reach max drunkness');

  const decayingPlayer = { beerCount: 0, shotCount: 0, drunknessDose: 20, drunknessLevel: 5, drunknessEndsAt: 151000 };
  refreshPlayerDrunkness(decayingPlayer, 31000);
  assert(decayingPlayer.drunknessLevel === 4, 'Refreshing drunkness after 30 seconds should lower level 5 to level 4');
  assert(decayingPlayer.drunknessDose === 15, 'Refreshing drunkness should lower the dose floor with the visible level');
  refreshPlayerDrunkness(decayingPlayer, 121000);
  assert(decayingPlayer.drunknessLevel === 1, 'Refreshing drunkness after two minutes should lower level 5 to level 1');

  const hotbarSlots = createHotbarSlots({ beerCount: 2, shotCount: 1 });
  assert(getHotbarDrinkItemId(hotbarSlots[1]) === DRINK_ITEM_IDS.beer, 'Beer should appear as a hotbar drink item');
  assert(getHotbarDrinkItemId(hotbarSlots[2]) === DRINK_ITEM_IDS.shot, 'Shot should appear as a hotbar drink item');
  const movedBeerOrder = moveHotbarItemOrderSlot(undefined, 1, 4);
  const movedBeerSlots = createHotbarSlots({
    beerCount: 2,
    shotCount: 1,
    hotbarItemOrder: movedBeerOrder
  });
  assert(!movedBeerSlots[1].itemId, 'Moving beer away from slot two should leave that slot empty');
  assert(getHotbarDrinkItemId(movedBeerSlots[4]) === DRINK_ITEM_IDS.beer, 'Beer should move to the target hotbar slot');
  const swappedDrinkOrder = moveHotbarItemOrderSlot(movedBeerOrder, 4, 2);
  const swappedDrinkSlots = createHotbarSlots({
    beerCount: 2,
    shotCount: 1,
    hotbarItemOrder: swappedDrinkOrder
  });
  assert(getHotbarDrinkItemId(swappedDrinkSlots[2]) === DRINK_ITEM_IDS.beer, 'Dropping on an occupied slot should swap hotbar items');
  assert(getHotbarDrinkItemId(swappedDrinkSlots[4]) === DRINK_ITEM_IDS.shot, 'The displaced hotbar item should move into the source slot');

  const bartender = normalizeNpcBehavior({
    modelId: 'brute',
    name: 'Bartender',
    bartenderEnabled: true,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  assert(isBartenderNpc(bartender), 'Normalized NPC should preserve bartenderEnabled');
  assert(
    allNpcsHaveFlag(defaultWorldLayout.npcs, 'bartenderEnabled'),
    'Default NPC layout should serialize bartenderEnabled for world-builder compatibility'
  );

  const policeNpc = normalizeNpcBehavior({
    modelId: 'policeOfficer',
    name: 'Police Officer',
    policeOfficerEnabled: true,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  const customRadiusPoliceNpc = normalizeNpcBehavior({
    modelId: 'policeOfficer',
    name: 'Police Officer',
    policeOfficerEnabled: true,
    lawRadius: 48,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  const savedWorldLayout = JSON.parse(readRepoText('server/data/world-layout.json'));
  const savedPoliceChief = findNpcById(savedWorldLayout.npcs, 'placement_164');
  const policeOfficerModel = getNpcModelById('policeOfficer');
  const policeOfficerGlbJson = readGlbJson('assets/runtime/mixamo/characters/policeOfficer.glb');
  const policeOfficerNodeNames = getGlbNodeNameSet(policeOfficerGlbJson);
  const policeOfficerMaterialNames = getGlbMaterialNames(policeOfficerGlbJson);
  const policeOfficerPortraitStats = statSync(new URL('../assets/mixamo/portraits/police_officer.png', import.meta.url));
  assert(policeOfficerModel?.label === 'Police Officer', 'NPC catalog should include the Police Officer model');
  assert(policeOfficerModel?.height === 4.8, 'Police Officer should stay scaled like the other human NPC models');
  assert(policeOfficerModel?.footprint?.[0] === 4 && policeOfficerModel?.footprint?.[1] === 4, 'Police Officer should use a stocky cartoon footprint');
  assert(policeOfficerModel?.portraitFileName === 'police_officer.png', 'Police Officer should expose a static NPC portrait');
  assert(policeOfficerPortraitStats.isFile() && policeOfficerPortraitStats.size > 1000, 'Police Officer portrait PNG should be generated');
  assert(policeOfficerNodeNames.has('PoliceOfficer_uniform'), 'Police Officer GLB should include a skinned navy uniform mesh');
  assert(policeOfficerNodeNames.has('PoliceOfficer_gold'), 'Police Officer GLB should include gold badge details');
  assert(policeOfficerNodeNames.has('PoliceOfficer_belt'), 'Police Officer GLB should include a utility belt');
  assert(policeOfficerNodeNames.has('mixamorigHead'), 'Police Officer GLB should preserve the Mixamo head bone');
  assert(policeOfficerNodeNames.has('mixamorigRightHand'), 'Police Officer GLB should preserve Mixamo hand bones for weapons');
  assert(
    policeOfficerMaterialNames.has('policeOfficerNavyUniform')
      && policeOfficerMaterialNames.has('policeOfficerGoldBadge')
      && policeOfficerMaterialNames.has('policeOfficerGoofyEyes'),
    'Police Officer GLB should use named cartoon police materials'
  );
  assert(isPoliceOfficerNpc(policeNpc), 'Normalized police NPCs should preserve policeOfficerEnabled');
  assert(
    policeNpc.combat?.archetype === NPC_COMBAT_ARCHETYPES.police
      && policeNpc.combat?.weaponId === WEAPON_IDS.pistol,
    'Police NPCs should normalize into the police combat archetype with a pistol fallback'
  );
  assert(getNpcLawRadius(policeNpc) === NPC_DEFAULT_LAW_RADIUS, 'Police NPCs should default to the standard law radius');
  assert(getNpcLawRadius(customRadiusPoliceNpc) === 48, 'Police NPC law radius should be configurable');
  assert(
    allNpcsHaveFlag(defaultWorldLayout.npcs, 'policeOfficerEnabled')
      && allNpcsHaveFlag(defaultWorldLayout.npcs, 'lawRadius'),
    'Default NPC layout should serialize police settings for world-builder compatibility'
  );
  assert(
    savedPoliceChief?.modelId === 'policeOfficer'
      && savedPoliceChief?.policeOfficerEnabled === true
      && savedPoliceChief?.lawRadius === NPC_DEFAULT_LAW_RADIUS
      && savedPoliceChief?.combat?.archetype === NPC_COMBAT_ARCHETYPES.police,
    'Fallback saved world layout should seed Gary with the Police Officer model and a visible law radius'
  );
  assert(
    /police:\s*'police'/.test(npcBehaviorSource)
      && /NPC_DEFAULT_LAW_RADIUS\s*=\s*32/.test(npcBehaviorSource),
    'NPC behavior should define a police combat archetype and default law radius'
  );
  assert(
    /triggerPoliceHostilityForPlayer/.test(npcSimulationSource)
      && /lawRadius/.test(npcSimulationSource)
      && /'npc-kill'/.test(npcSimulationSource),
    'NPC simulation should escalate police hostility for hostile player actions inside law radius'
  );
  assert(
    /triggerPoliceHostilityForPlayer[\s\S]*'shot-fired'/.test(serverSource)
      && /triggerPoliceHostilityForPlayer[\s\S]*'punch'/.test(serverSource)
      && /triggerPoliceHostilityForPlayer[\s\S]*'player-kill'/.test(serverSource)
      && /policeOfficerEnabled:\s*'boolean'/.test(serverSource)
      && /lawRadius:\s*'number'/.test(serverSource),
    'Server police NPC state should persist law settings and react to player shots, punches, and kills'
  );
  assert(
    /triggerPoliceHostilityForPlayer[\s\S]*'shot-fired'/.test(mockNpcServiceSource)
      && /triggerPoliceHostilityForPlayer[\s\S]*'punch'/.test(mockNpcServiceSource)
      && /triggerPoliceHostilityForPlayer[\s\S]*'player-kill'/.test(mockNpcServiceSource),
    'Mock NPC service should match server police hostility triggers'
  );
  assert(
    /lawRadiusIndicator/.test(npcActorSource)
      && /RingGeometry/.test(npcActorSource)
      && /policeOfficerEnabled/.test(worldRendererSource),
    'NPC rendering should expose a visible law-radius circle for police officers'
  );
  assert(
    /data-builder-npc-police-officer/.test(hudSource)
      && /data-builder-npc-law-radius/.test(hudSource)
      && /onNpcPoliceOfficerChange/.test(worldBuilderSource)
      && /policeOfficer/.test(worldBuilderSource)
      && /NPC_COMBAT_ARCHETYPES\.police/.test(worldBuilderSource)
      && /combat:\s*edit\.npc\.combat/.test(worldEditAdapterSource),
    'World builder should expose police officer settings and auto-place police model NPCs with the police combat profile'
  );

  const cigarettes = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.cigarettes);
  const pawnPistol = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.pistol);
  assert(cigarettes?.price === 20, 'Pawn shop cigarettes should cost $20');
  assert(cigarettes?.kind === 'consumable', 'Pawn shop cigarettes should be a consumable item');
  assert(pawnPistol?.price === 50, 'Pawn shop pistol should cost $50');
  assert(pawnPistol?.weaponId === WEAPON_IDS.pistol, 'Pawn shop pistol should sell the standard pistol');
  const pawnSkateboard = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.skateboard);
  assert(pawnSkateboard?.price === 200, 'Pawn shop skateboard should cost $200');
  assert(pawnSkateboard?.kind === 'permanent', 'Pawn shop skateboard should be a permanent item');
  assert(listPawnShopMenuItems().length === 3, 'Pawn shop menu should include cigarettes, pistol, and skateboard');

  const cigarettePlayer = { cigaretteCount: 0, skateboardOwned: false };
  addPlayerPawnShopItem(cigarettePlayer, PAWN_SHOP_ITEM_IDS.cigarettes, 2);
  assert(cigarettePlayer.cigaretteCount === 2, 'Pawn shop cigarettes should add to player inventory');
  const smokeResult = consumePlayerPawnShopItem(cigarettePlayer, PAWN_SHOP_ITEM_IDS.cigarettes);
  assert(smokeResult.ok && cigarettePlayer.cigaretteCount === 1, 'Smoking should consume one cigarette');
  addPlayerPawnShopItem(cigarettePlayer, PAWN_SHOP_ITEM_IDS.skateboard, 1);
  assert(isPlayerSkateboardOwner(cigarettePlayer), 'Pawn shop skateboard purchase should set skateboard ownership');
  assert(isPlayerPawnShopItemOwned(cigarettePlayer, PAWN_SHOP_ITEM_IDS.skateboard), 'Pawn shop ownership checks should recognize the skateboard');
  const cigaretteSlots = createHotbarSlots({ cigaretteCount: 3 });
  assert(
    getHotbarConsumableItemId(cigaretteSlots[3]) === PAWN_SHOP_ITEM_IDS.cigarettes,
    'Cigarettes should appear as a hotbar consumable'
  );
  assert(
    SMOKING_EMOTE_ID === 'smoking'
      && /item\.id\s*===\s*PAWN_SHOP_ITEM_IDS\.cigarettes[\s\S]*\?\s*SMOKING_EMOTE_ID[\s\S]*:\s*DRINKING_EMOTE_ID/.test(gameSource),
    'Smoking cigarettes should play the smoking emote instead of the drinking emote'
  );
  assert(
    /hud__hotbar-cigarette-ember/.test(hudSource)
      && !/hud__hotbar-cigarette-pack/.test(hudSource)
      && !/\.hud__hotbar-cigarette-pack/.test(styles),
    'Cigarette hotbar icon should render as a single cigarette instead of a pack'
  );
  const toyota = getCarDealerMenuItem(CAR_DEALER_ITEM_IDS.toyotaAe86);
  const fiat = getCarDealerMenuItem(CAR_DEALER_ITEM_IDS.fiatDuna);
  assert(toyota?.price === 10000, 'Car dealer Toyota AE86 should cost $10000');
  assert(fiat?.price === 5000, 'Car dealer Fiat Duna should cost $5000');
  assert(listCarDealerMenuItems().length === 2, 'Car dealer menu should include Toyota AE86 and Fiat Duna');
  const vehiclePlayer = { skateboardOwned: false, vehicleItemId: '' };
  setPlayerVehicleItem(vehiclePlayer, CAR_DEALER_ITEM_IDS.fiatDuna);
  assert(vehiclePlayer.skateboardOwned === false, 'Car purchase should not overwrite skateboard ownership');
  assert(getPlayerVehicleItemId(vehiclePlayer) === CAR_DEALER_ITEM_IDS.fiatDuna, 'Car ownership should preserve the purchased vehicle id');
  assert(playerOwnsVehicleItem(vehiclePlayer, CAR_DEALER_ITEM_IDS.fiatDuna), 'Purchased cars should be tracked in the owned car list');
  setPlayerVehicleItem(vehiclePlayer, CAR_DEALER_ITEM_IDS.toyotaAe86);
  assert(getPlayerOwnedVehicleItemIds(vehiclePlayer).length === 2, 'Player vehicle inventory should retain multiple owned cars');
  assert(ownedVehicleMenuHasItem(getPlayerOwnedVehicleMenuItems(vehiclePlayer), CAR_DEALER_ITEM_IDS.fiatDuna), 'Owned car selector entries should include the Fiat Duna');
  vehiclePlayer.vehicleItemId = '';
  assert(getPlayerVehicleItemId(vehiclePlayer) === '', 'Clearing the active car should preserve a skateboard selection even when cars are owned');
  assert(getPlayerDefaultVehicleItemId(vehiclePlayer) === CAR_DEALER_ITEM_IDS.toyotaAe86, 'Persisted owned cars should still expose a default active car for migration');
  selectPlayerVehicleItem(vehiclePlayer, CAR_DEALER_ITEM_IDS.fiatDuna);
  assert(getPlayerVehicleItemId(vehiclePlayer) === CAR_DEALER_ITEM_IDS.fiatDuna, 'Selecting an owned car should switch the active vehicle id');
  assert(
    getPlayerVehicleInventorySnapshot(vehiclePlayer).vehicleItemId === CAR_DEALER_ITEM_IDS.fiatDuna,
    'Vehicle inventory snapshot should include the owned car id'
  );
  assert(
    getPlayerVehicleInventorySnapshot(vehiclePlayer).ownedVehicleItemIds.includes(CAR_DEALER_ITEM_IDS.toyotaAe86),
    'Vehicle inventory snapshot should include every owned car id'
  );
  assert(
    hotbarSlotsExcludeItem(createHotbarSlots({ skateboardOwned: true }), CAR_DEALER_ITEM_IDS.fiatDuna),
    'Owned cars should not occupy a hotbar slot'
  );
  const burger = getMarthaMenuItem(MARTHA_ITEM_IDS.burger);
  const glizzy = getMarthaMenuItem(MARTHA_ITEM_IDS.glizzy);
  const soda = getMarthaMenuItem(MARTHA_ITEM_IDS.soda);
  assert(burger?.price === 20, 'Martha burger should cost $20');
  assert(glizzy?.price === 10, 'Martha glizzy should cost $10');
  assert(soda?.price === 10, 'Martha soda should cost $10');
  assert(burger?.kind === 'consumable' && glizzy?.kind === 'consumable' && soda?.kind === 'consumable', 'All Martha menu items should be consumable');
  assert(burger?.restorePercent === 35, 'Martha burger should restore the most health at 35%');
  assert(glizzy?.restorePercent === 25, 'Martha glizzy should restore 25% health');
  assert(soda?.restorePercent === 20, 'Martha soda should restore 20% health');
  assert(listMarthaMenuItems().length === 3, 'Martha menu should include burger, glizzy, and soda');

  const marthaFoodPlayer = { health: 50, maxHealth: 100, burgerCount: 0, glizzyCount: 0, sodaCount: 0 };
  addPlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.burger, 1);
  addPlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.glizzy, 1);
  addPlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.soda, 1);
  assert(getPlayerMarthaInventorySnapshot(marthaFoodPlayer).burgerCount === 1, 'Martha food should add burgers to inventory');
  const burgerResult = consumePlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.burger);
  assert(burgerResult.ok && marthaFoodPlayer.health === 85, 'Eating a Martha burger should restore 35 health from a 100 max-health player');
  const glizzyResult = consumePlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.glizzy);
  assert(glizzyResult.ok && marthaFoodPlayer.health === 100, 'Eating a Martha glizzy should restore health and cap at max health');
  const sodaAtFull = consumePlayerMarthaItem(marthaFoodPlayer, MARTHA_ITEM_IDS.soda);
  assert(!sodaAtFull.ok && marthaFoodPlayer.sodaCount === 1, 'Martha food should not be wasted at full health');
  const marthaFoodSlots = createHotbarSlots({ burgerCount: 1, glizzyCount: 1, sodaCount: 1 });
  assert(getHotbarConsumableItemId(marthaFoodSlots[4]) === MARTHA_ITEM_IDS.burger, 'Martha burgers should appear as a hotbar consumable');
  assert(getHotbarConsumableItemId(marthaFoodSlots[5]) === MARTHA_ITEM_IDS.glizzy, 'Martha glizzies should appear as a hotbar consumable');
  assert(getHotbarConsumableItemId(marthaFoodSlots[6]) === MARTHA_ITEM_IDS.soda, 'Martha soda should appear as a hotbar consumable');

  assert(SKATEBOARD_SPEED_MULTIPLIER === 1.6, 'Skateboard transport should keep the original speed multiplier');

  const pawnOwner = normalizeNpcBehavior({
    modelId: 'maynard',
    name: 'Roth',
    pawnShopOwnerEnabled: true,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  assert(isPawnShopOwnerNpc(pawnOwner), 'Normalized NPC should preserve pawnShopOwnerEnabled');
  assert(
    hasNpcWithFlag(defaultWorldLayout.npcs, 'npc_roth', 'pawnShopOwnerEnabled'),
    'Default NPC layout should seed Roth as the pawn shop owner'
  );
  assert(
    allNpcsHaveFlag(defaultWorldLayout.npcs, 'pawnShopOwnerEnabled'),
    'Default NPC layout should serialize pawnShopOwnerEnabled for world-builder compatibility'
  );
  const carDealer = normalizeNpcBehavior({
    modelId: 'ch18NonPbr',
    name: 'Car Dealer',
    carDealerEnabled: true,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  assert(isCarDealerNpc(carDealer), 'Normalized NPC should preserve carDealerEnabled');
  assert(
    hasNpcWithFlag(defaultWorldLayout.npcs, 'npc_car_dealer', 'carDealerEnabled'),
    'Default NPC layout should seed a Car Dealer NPC'
  );
  assert(
    allNpcsHaveFlag(defaultWorldLayout.npcs, 'carDealerEnabled'),
    'Default NPC layout should serialize carDealerEnabled for world-builder compatibility'
  );
  const marthaNpc = normalizeNpcBehavior({
    modelId: 'martha',
    name: 'Martha',
    marthaEnabled: true,
    spawnPosition: [0, 0]
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });
  assert(isMarthaNpc(marthaNpc), 'Normalized NPC should preserve marthaEnabled');
  assert(
    allNpcsHaveFlag(defaultWorldLayout.npcs, 'marthaEnabled'),
    'Default NPC layout should serialize marthaEnabled for world-builder compatibility'
  );
  assert(
    /this\.syncActivePawnShopMenu\(pawnShopOwnerInteraction\);/.test(gameSource),
    'Pawn shop owner menu should resync and close during interaction updates'
  );
  assert(
    /this\.syncActiveCarDealerMenu\(carDealerInteraction\);/.test(gameSource)
      && /buyCarDealerVehicle/.test(gameSource),
    'Car dealer menu should resync and route car purchases'
  );
  assert(
    /bindCarSelectorEvents/.test(gameSource)
      && /selectPlayerVehicle/.test(gameSource)
      && /focusCarSelectorVehicle/.test(gameSource)
      && /getPlayerOwnedVehicleMenuItems/.test(gameSource),
    'Game client should expose a click-to-select owned-car selector'
  );
  assert(
    /SKATEBOARD_ITEM_ID/.test(gameSource)
      && /getSelectedVehicleSelectorItemId/.test(gameSource)
      && /id:\s*SKATEBOARD_ITEM_ID/.test(gameSource)
      && /player\.vehicleItemId\s*=\s*''/.test(serverSource),
    'Vehicle selector should include the owned skateboard and select it by clearing the active car'
  );
  assert(
    /VehiclePreviewRenderer/.test(gameSource)
      && /syncCarSelectorVehiclePreviews/.test(gameSource)
      && /syncCarDealerVehiclePreviews/.test(gameSource)
      && /this\.vehiclePreviewRenderer\?\.update\(deltaSeconds\)/.test(gameSource),
    'Game client should mount real 3D vehicle previews in the selector and dealer shop'
  );
  assert(
    /assets\.vehicles\.fiatDuna/.test(vehiclePreviewSource)
      && /assets\.vehicles\.toyotaAe86/.test(vehiclePreviewSource)
      && /CAR_PREVIEW_MODEL_SCALE\s*=\s*0\.75/.test(vehiclePreviewSource)
      && /CAR_PREVIEW_MODEL_FOOTPRINT\s*=\s*Object\.freeze\(\[6\.5,\s*12\]\)/.test(vehiclePreviewSource)
      && /fitVehiclePreviewModelToFootprint\(object\)/.test(vehiclePreviewSource)
      && /BASE_VEHICLE_YAW\s*=\s*Math\.PI\s*\*\s*0\.23/.test(vehiclePreviewSource)
      && /LIVE_VEHICLE_ROTATION_SPEED\s*=\s*1\.65/.test(vehiclePreviewSource)
      && /getVehicleModelGroundNodeNameParts/.test(vehiclePreviewSource)
      && /createSkateboardPreviewModel/.test(vehiclePreviewSource)
      && /createSkateboardModel/.test(vehiclePreviewSource)
      && /library\.instantiate\(definition\.assetUrl\)/.test(vehiclePreviewSource),
    'Vehicle preview renderer should load real footprint-normalized grounded forward-facing rotating car GLB models and procedurally render the skateboard'
  );
  assert(
    /ExtrudeGeometry/.test(skateboardModelSource)
      && /bevelEnabled:\s*true/.test(skateboardModelSource)
      && /WheelHub/.test(skateboardModelSource),
    'Shared skateboard model should keep rounded deck geometry and visible wheel hub detail'
  );
  assert(
    /this\.syncActiveMarthaMenu\(marthaInteraction\);/.test(gameSource) && /buyMarthaItem/.test(gameSource),
    'Game client should route Martha food menu actions to a purchase handler'
  );
  assert(
    /buyPawnShopItem/.test(gameSource),
    'Game client should route pawn shop menu actions to a purchase handler'
  );
  assert(
    /burgerCount:\s*'number'/.test(serverSource)
      && /glizzyCount:\s*'number'/.test(serverSource)
      && /sodaCount:\s*'number'/.test(serverSource)
      && /martha:buyItem/.test(serverSource),
    'Server state should persist Martha food inventory and expose the Martha purchase RPC'
  );
  assert(
    /setPlayerBoundItemsState/.test(hudSource) && /\.hud__bound-items/.test(styles),
    'HUD should display permanent skateboard and car ownership outside the hotbar'
  );
  assert(
    /data-bound-item-vehicle[\s\S]*aria-haspopup="dialog"/.test(hudSource)
      && /data-car-selector/.test(hudSource)
      && /data-car-selector-preview/.test(hudSource)
      && /onFocusCar\?\.\(itemId\)/.test(hudSource)
      && /onSelectCar\?\.\(itemId\)/.test(hudSource)
      && !/data-car-selector-select/.test(hudSource)
      && !/\.hud__car-selector-select/.test(styles)
      && /\.hud__car-selector/.test(styles),
    'HUD car badge should open an owned-car selector menu where clicking a vehicle selects it without a separate Select button'
  );
  assert(
    /data-bound-item-vehicle[\s\S]*\$\{getVehicleBadgeMarkup\(\)\}/.test(hudSource)
      && !/data-bound-item-vehicle-label/.test(hudSource)
      && /#ff594d/.test(styles)
      && /#c91f1f/.test(styles),
    'HUD vehicle badge should be a simple red car icon with no visible text when a car is active'
  );
  assert(
    /data-car-preview-card/.test(hudSource)
      && /data-car-dealer-preview/.test(hudSource)
      && /hud__dialog-button--vehicle/.test(hudSource)
      && /vehicleSelect:/.test(gameSource)
      && !/getCarSelectorVehicleMarkup/.test(hudSource)
      && !/hud__car-selector-vehicle/.test(styles),
    'Vehicle selector and dealer shop should expose 3D model preview mounts and click-to-select owned-car entries'
  );
  assert(
    /\.hud__vibe-radio-widget\s*\{[\s\S]*left:\s*calc\(230px \+ var\(--safe-left\)\)/.test(styles)
      && /left:\s*calc\(184px \+ var\(--safe-left\)\)/.test(styles),
    'Vibe Radio mini player should sit to the right of the permanent car badge'
  );
  assert(
    /createSkateboardModel/.test(playerSource)
      && /namePrefix:\s*'Player'/.test(playerSource)
      && /PlayerVehicleRoot/.test(playerSource)
      && /PLAYER_CAR_MODEL_SCALE\s*=\s*0\.75/.test(playerSource)
      && /PLAYER_CAR_MODEL_FOOTPRINT\s*=\s*Object\.freeze\(\[6\.5,\s*12\]\)/.test(playerSource)
      && /fitPlayerVehicleModelToFootprint\(object\)/.test(playerSource)
      && /getVehicleModelGroundNodeNameParts/.test(playerSource)
      && /centerAndGroundVehicleModel\(object,\s*normalizedItemId\)/.test(playerSource)
      && /character\.visible\s*=\s*false/.test(playerSource),
    'Player avatar should render the procedural skateboard and replace the character with a footprint-normalized grounded 0.75x selected car while car-driving'
  );
  assert(
    /SKATEBOARD_LOWER_BODY_STILL_BONES\s*=\s*Object\.freeze\(copyIterableValues\(LOWER_BODY_LOCOMOTION_BONES\)\)/.test(playerSource)
      && /SKATEBOARD_UPPER_BODY_STILL_BONES\s*=\s*Object\.freeze\(copyIterableValues\(UPPER_BODY_EMOTE_BONES\)\)/.test(playerSource)
      && /SKATEBOARD_STILL_BODY_BONES\s*=\s*Object\.freeze\(combineIterableValues\(\s*SKATEBOARD_LOWER_BODY_STILL_BONES,\s*SKATEBOARD_UPPER_BODY_STILL_BONES\s*\)\)/.test(playerSource)
      && /SKATEBOARD_SIDEWAYS_FOOT_YAW\s*=\s*Math\.PI\s*\/\s*2/.test(playerSource)
      && /SKATEBOARD_LOWER_BODY_TURN_YAW\s*=\s*Math\.PI\s*\/\s*2/.test(playerSource)
      && /\[MIXAMO_BONES\.hips\]:\s*Object\.freeze\(\[0,\s*SKATEBOARD_LOWER_BODY_TURN_YAW,\s*0\]\)/.test(playerSource)
      && /\[MIXAMO_BONES\.spine\]:\s*Object\.freeze\(\[0,\s*-SKATEBOARD_LOWER_BODY_TURN_YAW,\s*0\]\)/.test(playerSource)
      && /mixamorigLeftFoot:\s*Object\.freeze\(\[0,\s*SKATEBOARD_SIDEWAYS_FOOT_YAW,\s*0\]\)/.test(playerSource)
      && /mixamorigRightFoot:\s*Object\.freeze\(\[0,\s*SKATEBOARD_SIDEWAYS_FOOT_YAW,\s*0\]\)/.test(playerSource),
    'Skateboarding should keep the legacy static body pose available for transport animation compatibility'
  );
  assert(
    /function applySkateboardStaticBodyPose\(deltaSeconds,\s*active\)/.test(playerSource)
      && /skateboardStaticBodyPoseWeight\s*=\s*active\s*\?\s*1\s*:\s*THREE\.MathUtils\.damp/.test(playerSource)
      && /applyReloadArmIk\(activeAimItemId,\s*reloadProfile\);\s*applySkateboardStaticBodyPose\(deltaSeconds,\s*skateboardPoseActive\)/.test(playerSource),
    'Skating should apply the static full-body stance after upper-body overlays every active skating frame'
  );
  assert(
    /this\.transportRideToggled\s*=\s*false/.test(gameSource)
      && /this\.input\.consumeAction\('skate'\)/.test(gameSource)
      && /this\.transportRideToggled\s*=\s*!this\.transportRideToggled/.test(gameSource)
      && /const transportRidingActive = Boolean\(transportInputEnabled && this\.transportRideToggled\)/.test(gameSource)
      && /CAR_VEHICLE_SPEED_MULTIPLIER/.test(gameSource)
      && /vehicleSpeedScale/.test(gameSource)
      && !/skateboardMovementInput/.test(gameSource)
      && /classList\.toggle\('is-active', visible && skating === true\)/.test(hudSource)
      && /wantsTransportVisible/.test(playerSource)
      && /const active = Boolean\(\(skateboardOwned \|\| activeVehicleItemId\) && skateboardSkating && aliveState/.test(playerSource),
    'Game client should toggle Shift transport mode for skateboards and selected cars even while stationary, with the correct speed multiplier when moving'
  );
  assert(
    /function updateSkateboardVisual\(deltaSeconds,\s*moving = false\)/.test(playerSource)
      && /updateSkateboardVisual\(deltaSeconds,\s*moving\)/.test(playerSource)
      && /if \(!moving\)\s*\{\s*skateboard\.position\.y\s*=\s*PLAYER_SKATEBOARD_REST_Y;\s*skateboard\.rotation\.x\s*=\s*0;\s*skateboard\.rotation\.z\s*=\s*0;\s*return;\s*\}/s.test(playerSource)
      && /skateboard\.position\.y\s*=\s*PLAYER_SKATEBOARD_REST_Y \+ \(Math\.sin\(skateboardMotion \* 2\.4\) \* 0\.018\)/.test(playerSource),
    'Player skateboard visual should hold a still pose while transport is active but the player is not moving, and only wobble while moving'
  );
  assert(
    /skateboardOwned:\s*'boolean'/.test(serverSource)
      && /vehicleItemId:\s*'string'/.test(serverSource)
      && /ownedVehicleItemIds:\s*'string'/.test(serverSource)
      && /skating:\s*'boolean'/.test(serverSource)
      && /carDealer:buyVehicle/.test(serverSource)
      && /vehicle:select/.test(serverSource)
      && /CAR_VEHICLE_SPEED_MULTIPLIER/.test(serverSource)
      && /SKATEBOARD_SPEED_MULTIPLIER/.test(serverSource)
      && /!Object\.hasOwn\(saved,\s*'vehicleItemId'\)/.test(serverSource),
    'Server player state should persist skateboard and car ownership while authorizing skateboard and car speed'
  );
  assert(CAR_VEHICLE_SPEED_MULTIPLIER === 2, 'Selected cars should move at 2x speed');
}

function validatePlayerSchemaFieldBudget() {
  const serverSource = readFileSync(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const playerSchemas = parsePlayerSchemas(serverSource);
  const playerState = findPlayerSchemaByName(playerSchemas, 'PlayerState');
  assert(playerState, 'WorldRoom should define a PlayerState schema');

  for (const { name, fields } of playerSchemas) {
    assert(fields.length <= 64, `${name} schema should stay at or below 64 fields; found ${fields.length}`);
  }

  const adminIndex = playerState.fields.indexOf('isAdmin');
  assert(adminIndex >= 0 && adminIndex < 64, 'PlayerState isAdmin must be inside the Colyseus schema field budget');
  assert(
    playerStateHasNestedSchemaFields(playerState.fields),
    'PlayerState should remain grouped into nested schemas so future features do not overflow the top-level field budget'
  );
}

async function main() {
  validateKenneyCatalogItems();
  validateCustomTileCatalogItems();
  validateCustomPropCatalogItems();
  validateFootprintSupport();
  validateVibeHero();
  validateTiles();
  validateProps();
  validatePassiveTraffic();
  validateTaskSequence();
  validateDeliveryQuestCarry();
  validateMissionSequencer();
  validateBartenderFunction();
  validatePlayerSchemaFieldBudget();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
