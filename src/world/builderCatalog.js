import { assetUrl, cityAsset } from './assetManifest.js';
import { NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import {
  OFFICE_CEO_MEETING_TABLE_ITEM_ID,
  OFFICE_JOB_IDS
} from '../shared/officeJobs.js';
import { VIBE_JAM_PORTAL_URL } from '../shared/vibeJamPortalConfig.js';
import { VIBE_HERO_GAME_ID } from '../shared/vibeHero.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import {
  COMBAT_PICKUP_ITEM_DEFINITIONS,
  COMBAT_PICKUP_PROP_ITEM_IDS,
  cloneCombatPickupDefinition
} from '../shared/combatPickupDefinitions.js';
import {
  cloneInteractableDefinition,
  cloneInteriorDefinition
} from './interactableMetadata.js';
import {
  BASKETBALL_HALF_COURT_TILE_FOOTPRINT,
  BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT,
  BASKETBALL_HOOP_FOOTPRINT,
  BLACKJACK_TABLE_FOOTPRINT,
  createBasketballHalfCourtTileVisual,
  createBasketballHoopVisual,
  createBlackjackTableVisual,
  createInstrumentClusterVisual,
  createMarthasGrilleBuildingVisual,
  createOlympicBarbellVisual,
  createOfficeCeoMeetingTableVisual,
  createOfficeCubicleWorkstationVisual,
  createOfficeLobbyChairVisual,
  createOfficeLobbySideTableVisual,
  createOfficeLobbyTableVisual,
  createPawnShopBuildingVisual,
  createPistolPickupSpawnVisual,
  createRealEstateOfficeBuildingVisual,
  createStandingDeskComputerVisual,
  createVibeJamExitPortalVisual,
  createVibeJamStartPortalVisual,
  INSTRUMENT_CLUSTER_FOOTPRINT,
  MARTHAS_GRILLE_BUILDING_FOOTPRINT,
  OFFICE_CEO_MEETING_TABLE_FOOTPRINT,
  OFFICE_CUBICLE_WORKSTATION_FOOTPRINT,
  OFFICE_LOBBY_CHAIR_FOOTPRINT,
  OFFICE_LOBBY_SIDE_TABLE_FOOTPRINT,
  OFFICE_LOBBY_TABLE_FOOTPRINT,
  OLYMPIC_BARBELL_FOOTPRINT,
  PISTOL_PICKUP_SPAWN_FOOTPRINT,
  REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT,
  STANDING_DESK_COMPUTER_FOOTPRINT,
  VIBE_JAM_PORTAL_FOOTPRINT,
  VIBE_JAM_PORTAL_INTERACTABLE
} from './proceduralProps.js';

export { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

function npcPortraitPath(fileName = '') {
  return fileName ? `/assets/mixamo/portraits/${fileName}` : '';
}

const TILE_GROUPS = Object.freeze({
  streets: 'Streets',
  lots: 'Lots & Buildings',
  parks: 'Parks'
});

const PROP_GROUPS = Object.freeze({
  street: 'Street',
  greenery: 'Greenery',
  combat: 'Combat',
  casino: 'Casino',
  fitness: 'Fitness',
  music: 'Music',
  office: 'Office',
  portals: 'Portals',
  storage: 'Storage',
  vehicles: 'Vehicles',
  utilities: 'Utilities'
});

const KENNEY_CITY_PACK = 'kenney_city-kit-commercial_2.1';
const CUSTOM_CITY_PACK = 'vibe_theft_auto_custom';
const KENNEY_TILE_SIZE = Object.freeze([BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]);
const CUSTOM_2X2_BUILDING_SIZE = Object.freeze([BUILDER_TILE_SIZE * 0.82 * 2, BUILDER_TILE_SIZE * 0.82 * 2]);
const DEFAULT_TILE_SURFACE_HEIGHT = 0.7;
const BUILDING_UNDERLAY_TILE_ID = 'lot_base';
const STANDARD_2X2_HULL_COLLISION_RECTS = Object.freeze([
  { centerX: 0, centerZ: -10.1, halfWidth: 10.85, halfDepth: 0.36, minY: 0, maxY: 12 },
  { centerX: -10.85, centerZ: 0.35, halfWidth: 0.36, halfDepth: 10.45, minY: 0, maxY: 12 },
  { centerX: 10.85, centerZ: 0.35, halfWidth: 0.36, halfDepth: 10.45, minY: 0, maxY: 12 },
  { centerX: -7.25, centerZ: 10.8, halfWidth: 3.6, halfDepth: 0.36, minY: 0, maxY: 8 },
  { centerX: 7.25, centerZ: 10.8, halfWidth: 3.6, halfDepth: 0.36, minY: 0, maxY: 8 }
]);
const PAWN_SHOP_COUNTER_COLLISION_RECTS = Object.freeze([
  { centerX: 0, centerZ: -7.2, halfWidth: 8.04, halfDepth: 0.67, minY: 0, maxY: 2.4 },
  { centerX: -7.55, centerZ: -4.1, halfWidth: 0.67, halfDepth: 3.34, minY: 0, maxY: 2.4 },
  { centerX: 7.55, centerZ: -4.1, halfWidth: 0.67, halfDepth: 3.34, minY: 0, maxY: 2.4 }
]);
const PAWN_SHOP_COLLISION_RECTS = Object.freeze([
  ...STANDARD_2X2_HULL_COLLISION_RECTS,
  ...PAWN_SHOP_COUNTER_COLLISION_RECTS
]);
const MARTHAS_GRILLE_COLLISION_RECTS = Object.freeze([
  { centerX: 0, centerZ: -5.14, halfWidth: 5.32, halfDepth: 0.24, minY: 0, maxY: 7.2 },
  { centerX: -5.15, centerZ: -0.1, halfWidth: 0.24, halfDepth: 5.08, minY: 0, maxY: 7.2 },
  { centerX: 5.15, centerZ: -0.1, halfWidth: 0.24, halfDepth: 5.08, minY: 0, maxY: 7.2 },
  { centerX: -4.05, centerZ: 5.03, halfWidth: 1.22, halfDepth: 0.24, minY: 0, maxY: 5.9 },
  { centerX: 4.05, centerZ: 5.03, halfWidth: 1.22, halfDepth: 0.24, minY: 0, maxY: 5.9 },
  { centerX: 0, centerZ: 1.05, halfWidth: 4.52, halfDepth: 0.72, minY: 0, maxY: 2.45 }
]);
const REAL_ESTATE_OFFICE_COLLISION_RECTS = Object.freeze([
  { centerX: 0, centerZ: -5.14, halfWidth: 5.32, halfDepth: 0.24, minY: 0, maxY: 27.8 },
  { centerX: -5.15, centerZ: -0.1, halfWidth: 0.24, halfDepth: 5.08, minY: 0, maxY: 6.5 },
  { centerX: 5.15, centerZ: -0.1, halfWidth: 0.24, halfDepth: 5.08, minY: 0, maxY: 6.5 },
  { centerX: -4.32, centerZ: 5.03, halfWidth: 0.92, halfDepth: 0.24, minY: 0, maxY: 4.6 },
  { centerX: 4.32, centerZ: 5.03, halfWidth: 0.92, halfDepth: 0.24, minY: 0, maxY: 4.6 },
  { centerX: -3.05, centerZ: -3.25, halfWidth: 0.86, halfDepth: 0.54, minY: 0, maxY: 1.65 },
  { centerX: 0, centerZ: -3.35, halfWidth: 0.86, halfDepth: 0.54, minY: 0, maxY: 1.65 },
  { centerX: 3.05, centerZ: -3.25, halfWidth: 0.86, halfDepth: 0.54, minY: 0, maxY: 1.65 }
]);
const BASKETBALL_HOOP_BASE_POLE_COLLISION_RECTS = Object.freeze([
  { centerX: 0, centerZ: -1.6, halfWidth: 0.34, halfDepth: 0.34, minY: 0, maxY: 8.8 }
]);
const KENNEY_BUILDING_VARIANTS = Object.freeze('abcdefghijklmn'.split(''));
const KENNEY_SKYSCRAPER_VARIANTS = Object.freeze('abcde'.split(''));
const KENNEY_DETAIL_DEFINITIONS = Object.freeze([
  { key: 'awning', label: 'Kenney Awning', fileName: 'detail-awning.glb', size: [4.5, 1.6] },
  { key: 'awning_wide', label: 'Kenney Awning Wide', fileName: 'detail-awning-wide.glb', size: [8, 1.6] },
  { key: 'overhang', label: 'Kenney Overhang', fileName: 'detail-overhang.glb', size: [4.5, 1.6] },
  { key: 'overhang_wide', label: 'Kenney Overhang Wide', fileName: 'detail-overhang-wide.glb', size: [8, 1.6] },
  { key: 'parasol_a', label: 'Kenney Parasol A', fileName: 'detail-parasol-a.glb', size: [2.6, 2.6] },
  { key: 'parasol_b', label: 'Kenney Parasol B', fileName: 'detail-parasol-b.glb', size: [2.6, 2.6] }
]);

function kenneyAsset(fileName) {
  return assetUrl(KENNEY_CITY_PACK, 'Models', 'GLB format', fileName);
}

function customCityAsset(...parts) {
  return assetUrl(CUSTOM_CITY_PACK, ...parts);
}

function createKenneyBuildingDefinition({ id, label, fileName }) {
  return {
    id,
    assetName: id,
    label,
    asset: kenneyAsset(fileName),
    group: 'lots',
    size: KENNEY_TILE_SIZE,
    tileFootprint: [1, 1],
    collision: true,
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  };
}

function createKenneyPropDefinition({ key, label, fileName, size }) {
  return {
    id: `kenney_detail_${key}`,
    assetName: `kenney_detail_${key}`,
    label,
    asset: kenneyAsset(fileName),
    group: 'street',
    size,
    collision: false
  };
}

function createCutawayInteriorWallNodeNames(key) {
  return [
    `${key}_hull_wall_back`,
    `${key}_hull_wall_left`,
    `${key}_hull_wall_right`
  ];
}

function createCutawayVisibleNodeNames(key, { includeInterior = true } = {}) {
  return [
    `${key}_foundation`,
    ...(includeInterior ? [`${key}_interior`] : []),
    ...createCutawayInteriorWallNodeNames(key)
  ];
}

function createCutawayHiddenNodeNames(key) {
  return [
    `${key}_cutaway_roof`,
    `${key}_cutaway_upper`,
    `${key}_exterior_detail`,
    `${key}_hull_wall_front`
  ];
}

function createCustom2x2BuildingDefinition({
  key,
  label,
  fileName,
  asset = customCityAsset('models', fileName),
  createVisual,
  prompt,
  movementCollisionRects = STANDARD_2X2_HULL_COLLISION_RECTS,
  shotCollisionRects = STANDARD_2X2_HULL_COLLISION_RECTS,
  interiorOverrides = {},
  cameraOcclusionPreserveNodeNames = createCutawayVisibleNodeNames(key)
}) {
  const cutawayNodeNames = interiorOverrides.cutawayNodeNames
    ?? createCutawayHiddenNodeNames(key);
  const cutawayVisibleNodeNames = interiorOverrides.cutawayVisibleNodeNames
    ?? createCutawayVisibleNodeNames(key);

  return {
    id: `${key}_building`,
    assetName: `${key}_building`,
    label,
    asset,
    group: 'lots',
    size: CUSTOM_2X2_BUILDING_SIZE,
    tileFootprint: [2, 2],
    surfaceHeight: 0.76,
    collision: true,
    blocksShots: true,
    movementCollisionRects,
    shotCollisionRects,
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID,
    cameraOcclusionPreserveNodeNames,
    createVisual,
    interior: {
      id: `${key}_interior`,
      mode: 'inline-cutaway',
      label,
      prompt: prompt ?? `Enter ${label}`,
      ...interiorOverrides,
      cutawayNodeNames,
      cutawayVisibleNodeNames,
      exteriorDoorOffset: [0, 10.95],
      exteriorSpawnOffset: [0, 16.05],
      exteriorInteractRadius: 4.8
    }
  };
}

const KENNEY_TILE_DEFINITIONS = Object.freeze([
  ...KENNEY_BUILDING_VARIANTS.map((variant) =>
    createKenneyBuildingDefinition({
      id: `kenney_building_${variant}`,
      label: `Kenney Building ${variant.toUpperCase()}`,
      fileName: `building-${variant}.glb`
    })
  ),
  ...KENNEY_SKYSCRAPER_VARIANTS.map((variant) =>
    createKenneyBuildingDefinition({
      id: `kenney_building_skyscraper_${variant}`,
      label: `Kenney Skyscraper ${variant.toUpperCase()}`,
      fileName: `building-skyscraper-${variant}.glb`
    })
  )
]);

const KENNEY_PROP_DEFINITIONS = Object.freeze(
  KENNEY_DETAIL_DEFINITIONS.map(createKenneyPropDefinition)
);

const CUSTOM_2X2_BUILDING_DEFINITIONS = Object.freeze([
  createCustom2x2BuildingDefinition({
    key: 'school',
    label: 'School',
    fileName: 'school-building.glb',
    prompt: 'Enter school'
  }),
  createCustom2x2BuildingDefinition({
    key: 'bar',
    label: 'Bar',
    fileName: 'bar-building.glb',
    prompt: 'Enter bar'
  }),
  createCustom2x2BuildingDefinition({
    key: 'bank',
    label: 'Bank',
    fileName: 'bank-building.glb',
    prompt: 'Enter bank'
  }),
  createCustom2x2BuildingDefinition({
    key: 'casino',
    label: 'Casino',
    fileName: 'casino-building.glb',
    prompt: 'Enter casino'
  }),
  createCustom2x2BuildingDefinition({
    key: 'pawn',
    label: 'Pawn Shop',
    fileName: 'pawn-building.glb',
    asset: null,
    createVisual: createPawnShopBuildingVisual,
    prompt: 'Enter pawn shop',
    movementCollisionRects: PAWN_SHOP_COLLISION_RECTS,
    shotCollisionRects: PAWN_SHOP_COLLISION_RECTS
  }),
  createCustom2x2BuildingDefinition({
    key: 'offices',
    label: 'Offices',
    fileName: 'offices-building.glb',
    prompt: 'Enter offices',
    cameraOcclusionPreserveNodeNames: createCutawayVisibleNodeNames('offices', { includeInterior: false }),
    interiorOverrides: {
      cutawayNodeNames: [...createCutawayHiddenNodeNames('offices'), 'offices_interior'],
      cutawayVisibleNodeNames: createCutawayVisibleNodeNames('offices', { includeInterior: false })
    }
  })
]);

const CITY_TILE_DEFINITIONS = Object.freeze([
  { id: 'road_straight', assetName: 'road_straight', group: 'streets' },
  { id: 'road_corner', assetName: 'road_corner', group: 'streets' },
  { assetName: 'road_corner_curved', group: 'streets' },
  { id: 'road_tsplit', assetName: 'road_tsplit', group: 'streets' },
  { id: 'road_cross', assetName: 'road_straight_crossing', label: 'Road Cross', group: 'streets' },
  { id: 'road_junction', assetName: 'road_junction', label: 'Road Junction', group: 'streets' },
  { id: 'lot_base', assetName: 'base', label: 'Base Lot', group: 'lots' },
  { id: 'building_a', assetName: 'building_A_withoutBase', label: 'Building A', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_a_without_base', assetName: 'building_A_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_b', assetName: 'building_B_withoutBase', label: 'Building B', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_b_without_base', assetName: 'building_B_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_c', assetName: 'building_C_withoutBase', label: 'Building C', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_c_without_base', assetName: 'building_C_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_d', assetName: 'building_D_withoutBase', label: 'Building D', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_d_without_base', assetName: 'building_D_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_e', assetName: 'building_E_withoutBase', label: 'Building E', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_e_without_base', assetName: 'building_E_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_f', assetName: 'building_F_withoutBase', label: 'Building F', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_f_without_base', assetName: 'building_F_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_g', assetName: 'building_G_withoutBase', label: 'Building G', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_g_without_base', assetName: 'building_G_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_h', assetName: 'building_H_withoutBase', label: 'Building H', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  { id: 'building_h_without_base', assetName: 'building_H_withoutBase', group: 'lots', underlayTileId: BUILDING_UNDERLAY_TILE_ID },
  {
    id: 'marthas_grille_building',
    assetName: 'marthas_grille_building',
    aliases: ["Martha's Grille"],
    label: "Martha's Grille",
    asset: null,
    group: 'lots',
    size: MARTHAS_GRILLE_BUILDING_FOOTPRINT,
    tileFootprint: [1, 1],
    collision: true,
    blocksShots: true,
    movementCollisionRects: MARTHAS_GRILLE_COLLISION_RECTS,
    shotCollisionRects: MARTHAS_GRILLE_COLLISION_RECTS,
    padding: 0.5,
    npcRouteDoorOffset: [0, BUILDER_TILE_SIZE * 0.38],
    cameraOcclusionPreserveNodeNames: [
      'mgSlab',
      'marthasGrilleDiningFloor',
      'marthasGrilleCounterBase',
      'mgCounterTop',
      'mgRegisterBase',
      'marthasGrilleRegisterScreen',
      'marthasGrilleFlatTopGrill',
      'mgRangeHood',
      'marthas_grille_kitchen_detail',
      'marthasGrilleOpenFrontThreshold',
      ...createCutawayInteriorWallNodeNames('marthas_grille')
    ],
    cameraOcclusionAlwaysPreserveNodeNames: [
      'mgSlab',
      'marthasGrilleDiningFloor',
      'marthasGrilleCounterBase',
      'mgCounterTop',
      'mgRegisterBase',
      'marthasGrilleRegisterScreen',
      'marthasGrilleFlatTopGrill',
      'mgRangeHood',
      'marthas_grille_kitchen_detail',
      'marthasGrilleOpenFrontThreshold',
      ...createCutawayInteriorWallNodeNames('marthas_grille')
    ],
    createVisual: createMarthasGrilleBuildingVisual,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  {
    id: 'real_estate_office_building',
    assetName: 'real_estate_office_building',
    aliases: ['Real Estate Office', 'real_estate_office'],
    label: 'Real Estate Office',
    asset: null,
    group: 'lots',
    size: REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT,
    tileFootprint: [1, 1],
    collision: true,
    blocksShots: true,
    movementCollisionRects: REAL_ESTATE_OFFICE_COLLISION_RECTS,
    shotCollisionRects: REAL_ESTATE_OFFICE_COLLISION_RECTS,
    padding: 0.5,
    npcRouteDoorOffset: [0, BUILDER_TILE_SIZE * 0.38],
    cameraOcclusionPreserveNodeNames: createCutawayVisibleNodeNames('real_estate_office'),
    cameraOcclusionAlwaysPreserveNodeNames: createCutawayVisibleNodeNames('real_estate_office'),
    createVisual: createRealEstateOfficeBuildingVisual,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  {
    id: 'bar_building_wide',
    assetName: 'bar_building_wide',
    label: 'Bar Wide',
    asset: customCityAsset('models', 'bar-building-wide.glb'),
    group: 'lots',
    size: [BUILDER_TILE_SIZE * 0.82 * 2, BUILDER_TILE_SIZE * 0.82],
    tileFootprint: [2, 1],
    collision: true,
    blocksShots: true,
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  ...CUSTOM_2X2_BUILDING_DEFINITIONS,
  {
    id: 'hospital_building',
    assetName: 'hospital_building',
    label: 'Hospital',
    asset: customCityAsset('models', 'hospital-building.glb'),
    group: 'lots',
    size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82],
    tileFootprint: [1, 1],
    collision: true,
    blocksShots: true,
    movementCollisionRects: [
      { centerX: 0.1, centerZ: -0.35, halfWidth: 4.5, halfDepth: 3.55, minY: 0, maxY: 18 },
      { centerX: 3.92, centerZ: 0.25, halfWidth: 1.43, halfDepth: 1.78, minY: 0, maxY: 18 },
      { centerX: 1.2, centerZ: 3.85, halfWidth: 3.8, halfDepth: 1.55, minY: 0, maxY: 18 }
    ],
    shotCollisionRects: [
      { centerX: 0.1, centerZ: -0.35, halfWidth: 4.5, halfDepth: 3.55 },
      { centerX: 3.92, centerZ: 0.25, halfWidth: 1.43, halfDepth: 1.78 },
      { centerX: 1.2, centerZ: 3.85, halfWidth: 3.8, halfDepth: 1.55 }
    ],
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  {
    id: 'gym_building',
    assetName: 'gym_building',
    label: 'Fitness Gym',
    asset: customCityAsset('models', 'gym-building.glb'),
    group: 'lots',
    size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82],
    tileFootprint: [1, 1],
    collision: true,
    blocksShots: true,
    padding: 0.5,
    npcRouteDoorOffset: [0, BUILDER_TILE_SIZE * 0.46],
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  {
    id: 'gym_building_large',
    assetName: 'gym_building_large',
    label: 'Fitness Gym Large',
    asset: customCityAsset('models', 'gym-building-large.glb'),
    group: 'lots',
    size: [BUILDER_TILE_SIZE * 0.82 * 2, BUILDER_TILE_SIZE * 0.82 * 2],
    tileFootprint: [2, 2],
    surfaceHeight: 0.76,
    collision: true,
    blocksShots: true,
    movementCollisionRects: [
      { centerX: 0, centerZ: -7.63, halfWidth: 10.83, halfDepth: 0.34, minY: 0, maxY: 7.4 },
      { centerX: -10.83, centerZ: 1.65, halfWidth: 0.34, halfDepth: 9.28, minY: 0, maxY: 7.4 },
      { centerX: 10.83, centerZ: 1.65, halfWidth: 0.34, halfDepth: 9.28, minY: 0, maxY: 7.4 },
      { centerX: -7.2, centerZ: 10.93, halfWidth: 3.8, halfDepth: 0.34, minY: 0, maxY: 3.7 },
      { centerX: 7.2, centerZ: 10.93, halfWidth: 3.8, halfDepth: 0.34, minY: 0, maxY: 3.7 }
    ],
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID,
    cameraOcclusionPreserveNodeNames: createCutawayVisibleNodeNames('gym'),
    interior: {
      id: 'gym_large_blank',
      mode: 'inline-cutaway',
      label: 'Fitness Gym',
      prompt: 'Enter gym',
      cutawayNodeNames: ['gym_cutaway_roof', 'gym_cutaway_upper', 'gym_cutaway_corner', 'gym_exterior_detail', 'gym_hull_wall_front'],
      cutawayVisibleNodeNames: createCutawayVisibleNodeNames('gym'),
      exteriorDoorOffset: [0, 10.95],
      exteriorSpawnOffset: [0, 16.05],
      exteriorInteractRadius: 4.8
    }
  },
  {
    id: 'hospital_building_wide',
    assetName: 'hospital_building_wide',
    label: 'Hospital Wide',
    asset: customCityAsset('models', 'hospital-building-wide.glb'),
    group: 'lots',
    size: [BUILDER_TILE_SIZE * 0.82 * 2, BUILDER_TILE_SIZE * 0.82],
    tileFootprint: [2, 1],
    collision: true,
    blocksShots: true,
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID
  },
  {
    id: 'basketball_court_half',
    assetName: 'basketball_court_half',
    aliases: ['basketball_half_court', 'half_basketball_court', 'Basketball Half Court'],
    label: 'Basketball Half Court',
    asset: null,
    group: 'parks',
    size: BASKETBALL_HALF_COURT_TILE_FOOTPRINT,
    tileFootprint: [1, 1],
    surfaceHeight: BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT,
    collision: false,
    createVisual: createBasketballHalfCourtTileVisual
  },
  { assetName: 'park_base', group: 'parks' },
  { assetName: 'park_base_decorated_bushes', group: 'parks' },
  { assetName: 'park_base_decorated_trees', group: 'parks' },
  { assetName: 'park_road_corner', group: 'parks' },
  { assetName: 'park_road_corner_decorated', group: 'parks' },
  { assetName: 'park_road_junction', group: 'parks' },
  { assetName: 'park_road_junction_decorated_A', group: 'parks' },
  { assetName: 'park_road_junction_decorated_B', group: 'parks' },
  {
    assetName: 'park_road_junction_decorated_C',
    group: 'parks',
    movementCollisionRects: [
      { centerX: 0, centerZ: 0, halfWidth: 3.2, halfDepth: 3.2 }
    ],
    shotCollisionRects: [
      { centerX: 0, centerZ: 0, halfWidth: 3.2, halfDepth: 3.2 }
    ]
  },
  { assetName: 'park_road_straight', group: 'parks' },
  { assetName: 'park_road_straight_decorated_A', group: 'parks' },
  { assetName: 'park_road_straight_decorated_B', group: 'parks' },
  { assetName: 'park_road_tsplit', group: 'parks' },
  { assetName: 'park_road_tsplit_decorated', group: 'parks' },
  { assetName: 'park_wall_entry', group: 'parks' },
  { assetName: 'park_wall_entry_decorated', group: 'parks' },
  { assetName: 'park_wall_innerCorner', group: 'parks' },
  { assetName: 'park_wall_innerCorner_decorated', group: 'parks' },
  { assetName: 'park_wall_outerCorner', group: 'parks' },
  { assetName: 'park_wall_outerCorner_decorated', group: 'parks' },
  { assetName: 'park_wall_straight', group: 'parks' },
  { assetName: 'park_wall_straight_decorated', group: 'parks' },
  ...KENNEY_TILE_DEFINITIONS
]);

const CITY_PROP_DEFINITIONS = Object.freeze([
  { id: 'bench', assetName: 'bench', group: 'street', collision: false },
  { id: 'bush', assetName: 'bush', group: 'greenery', collision: false },
  { assetName: 'bush_A', group: 'greenery', collision: false },
  { assetName: 'bush_B', group: 'greenery', collision: false },
  { assetName: 'bush_C', group: 'greenery', collision: false },
  { id: 'crate_a', assetName: 'box_A', group: 'storage' },
  { id: 'crate_b', assetName: 'box_B', group: 'storage' },
  { assetName: 'trash_A', group: 'storage' },
  { assetName: 'trash_B', group: 'storage' },
  { id: 'car_hatchback', assetName: 'car_hatchback', group: 'vehicles' },
  { id: 'car_police', assetName: 'car_police', group: 'vehicles' },
  { id: 'car_sedan', assetName: 'car_sedan', group: 'vehicles' },
  { id: 'car_stationwagon', assetName: 'car_stationwagon', group: 'vehicles' },
  { id: 'car_taxi', assetName: 'car_taxi', group: 'vehicles' },
  { id: 'dumpster', assetName: 'dumpster', group: 'storage' },
  { id: 'hydrant', assetName: 'firehydrant', label: 'Hydrant', group: 'utilities', collision: false },
  { id: 'streetlight', assetName: 'streetlight', group: 'utilities', collision: false },
  { assetName: 'streetlight_old_single', group: 'utilities', collision: false },
  { assetName: 'streetlight_old_double', group: 'utilities', collision: false },
  { id: 'traffic_light', assetName: 'trafficlight_A', label: 'Traffic Light A', group: 'utilities', collision: false },
  { assetName: 'trafficlight_B', group: 'utilities', collision: false },
  { assetName: 'trafficlight_C', group: 'utilities', collision: false, size: [6.6, 2.3] },
  { assetName: 'tree_A', group: 'greenery' },
  { assetName: 'tree_B', group: 'greenery' },
  { assetName: 'tree_C', group: 'greenery' },
  { assetName: 'tree_D', group: 'greenery' },
  { assetName: 'tree_E', group: 'greenery' },
  { id: 'tower', assetName: 'watertower', label: 'Water Tower', group: 'utilities' },
  {
    id: COMBAT_PICKUP_PROP_ITEM_IDS.pistol,
    assetName: COMBAT_PICKUP_PROP_ITEM_IDS.pistol,
    aliases: ['pistol_pickup', 'pick_up_pistol', 'Pick Up Pistol'],
    label: 'Pistol Pickup',
    asset: null,
    group: 'combat',
    size: PISTOL_PICKUP_SPAWN_FOOTPRINT,
    collision: false,
    blocksMovement: false,
    blocksShots: false,
    createVisual: createPistolPickupSpawnVisual,
    combatPickup: COMBAT_PICKUP_ITEM_DEFINITIONS[COMBAT_PICKUP_PROP_ITEM_IDS.pistol]
  },
  {
    id: 'basketball_hoop',
    assetName: 'basketball_hoop',
    label: 'Basketball Hoop',
    asset: null,
    group: 'fitness',
    size: BASKETBALL_HOOP_FOOTPRINT,
    collision: true,
    movementCollisionRects: BASKETBALL_HOOP_BASE_POLE_COLLISION_RECTS,
    shotCollisionRects: BASKETBALL_HOOP_BASE_POLE_COLLISION_RECTS,
    padding: 0.16,
    createVisual: createBasketballHoopVisual
  },
  {
    id: 'olympic_barbell',
    assetName: 'olympic_barbell',
    label: 'Olympic Barbell',
    asset: null,
    group: 'fitness',
    size: OLYMPIC_BARBELL_FOOTPRINT,
    collision: false,
    createVisual: createOlympicBarbellVisual,
    interactable: {
      label: 'Olympic Barbell',
      prompt: 'Snatch barbell',
      actionText: 'Step in and perform a snatch.',
      radius: 3.6,
      localOffset: [0, 0],
      workoutType: 'snatch',
      approachLocalOffset: [0, 1.2],
      approachRotationY: Math.PI
    }
  },
  {
    id: 'standing_desk_computer',
    assetName: 'standing_desk_computer',
    label: 'Standing Desk Computer',
    asset: null,
    group: 'office',
    size: STANDING_DESK_COMPUTER_FOOTPRINT,
    collision: false,
    createVisual: createStandingDeskComputerVisual,
    interactable: {
      label: 'Standing Desk Computer',
      prompt: 'Open job board',
      actionText: 'Opened the office job board.',
      radius: 3.8,
      localOffset: [0, 0.1],
      workoutType: 'typing',
      hideDuringWorkout: false,
      approachLocalOffset: [0, 1.35],
      approachRotationY: Math.PI
    }
  },
  {
    id: 'office_lobby_chair',
    assetName: 'office_lobby_chair',
    aliases: ['office chair', 'lobby chair', 'Office Lobby Chair'],
    label: 'Office Lobby Chair',
    asset: null,
    group: 'office',
    size: OFFICE_LOBBY_CHAIR_FOOTPRINT,
    collision: false,
    createVisual: createOfficeLobbyChairVisual
  },
  {
    id: 'office_lobby_table',
    assetName: 'office_lobby_table',
    aliases: ['office table', 'lobby table', 'office coffee table', 'Office Lobby Table'],
    label: 'Office Lobby Table',
    asset: null,
    group: 'office',
    size: OFFICE_LOBBY_TABLE_FOOTPRINT,
    collision: true,
    padding: 0.12,
    createVisual: createOfficeLobbyTableVisual
  },
  {
    id: 'office_lobby_side_table',
    assetName: 'office_lobby_side_table',
    aliases: ['office side table', 'lobby side table', 'Office Lobby Side Table'],
    label: 'Office Lobby Side Table',
    asset: null,
    group: 'office',
    size: OFFICE_LOBBY_SIDE_TABLE_FOOTPRINT,
    collision: true,
    padding: 0.1,
    createVisual: createOfficeLobbySideTableVisual
  },
  {
    id: 'office_cubicle_workstation',
    assetName: 'office_cubicle_workstation',
    aliases: ['office cubicle', 'cubicle', 'cubicle workstation', 'Office Cubicle'],
    label: 'Office Cubicle Workstation',
    asset: null,
    group: 'office',
    size: OFFICE_CUBICLE_WORKSTATION_FOOTPRINT,
    collision: true,
    padding: 0.14,
    createVisual: createOfficeCubicleWorkstationVisual
  },
  {
    id: OFFICE_CEO_MEETING_TABLE_ITEM_ID,
    assetName: OFFICE_CEO_MEETING_TABLE_ITEM_ID,
    aliases: ['ceo table', 'ceo meeting table', 'meeting table', 'ceo game', 'CEO Meeting Table'],
    label: 'CEO Meeting Table',
    asset: null,
    group: 'office',
    size: OFFICE_CEO_MEETING_TABLE_FOOTPRINT,
    collision: true,
    padding: 0.18,
    createVisual: createOfficeCeoMeetingTableVisual,
    interactable: {
      label: 'CEO Meeting Table',
      prompt: 'Start CEO shift',
      actionText: 'Stamp memos from the executive meeting table.',
      radius: 4.1,
      localOffset: [0, 0],
      officeJobId: OFFICE_JOB_IDS.ceo
    }
  },
  {
    id: 'instrument_cluster',
    assetName: 'instrument_cluster',
    aliases: ['music_cluster', 'instrument_corner', 'guitar_piano_microphone', 'Instrument Cluster'],
    label: 'Instrument Cluster',
    asset: null,
    group: 'music',
    size: INSTRUMENT_CLUSTER_FOOTPRINT,
    collision: false,
    createVisual: createInstrumentClusterVisual,
    interactable: {
      label: 'Instrument Cluster',
      prompt: 'Play Vibe Hero',
      actionText: 'Vibe Hero is ready.',
      radius: 4.2,
      localOffset: [0, 0.35],
      gameId: VIBE_HERO_GAME_ID
    }
  },
  {
    id: 'blackjack_table',
    assetName: 'blackjack_table',
    label: 'Blackjack Table',
    asset: null,
    group: 'casino',
    size: BLACKJACK_TABLE_FOOTPRINT,
    collision: true,
    padding: 0.2,
    createVisual: createBlackjackTableVisual
  },
  {
    id: 'vibe_jam_exit_portal',
    assetName: 'vibe_jam_exit_portal',
    label: 'Vibe Jam Exit Portal',
    asset: null,
    group: 'portals',
    size: VIBE_JAM_PORTAL_FOOTPRINT,
    collision: false,
    createVisual: createVibeJamExitPortalVisual,
    interactable: {
      ...VIBE_JAM_PORTAL_INTERACTABLE,
      label: 'Vibe Jam Exit Portal',
      prompt: 'Walk into the Vibe Jam portal',
      actionText: 'Step through to visit the Vibe Jam webring hub.',
      portal: {
        ...VIBE_JAM_PORTAL_INTERACTABLE.portal,
        role: 'exit',
        destinationUrl: VIBE_JAM_PORTAL_URL
      }
    }
  },
  {
    id: 'vibe_jam_start_portal',
    assetName: 'vibe_jam_start_portal',
    label: 'Vibe Jam Start Portal',
    asset: null,
    group: 'portals',
    size: VIBE_JAM_PORTAL_FOOTPRINT,
    collision: false,
    createVisual: createVibeJamStartPortalVisual,
    interactable: {
      ...VIBE_JAM_PORTAL_INTERACTABLE,
      label: 'Vibe Jam Start Portal',
      prompt: 'Walk into the start portal',
      actionText: 'Step through to return to the last jam world.',
      portal: {
        ...VIBE_JAM_PORTAL_INTERACTABLE.portal,
        role: 'start'
      }
    }
  },
  ...KENNEY_PROP_DEFINITIONS
]);

function titleCaseWords(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();

      if (lower === 'tsplit') return 'T-Split';
      if (lower === 'watertower') return 'Water Tower';
      if (lower === 'firehydrant') return 'Fire Hydrant';
      if (lower === 'streetlight') return 'Streetlight';
      if (lower === 'trafficlight') return 'Traffic Light';
      if (lower === 'without') return 'Without';
      if (lower === 'base') return 'Base';
      if (/^[a-h]$/i.test(part)) return part.toUpperCase();

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatCityLabel(assetName) {
  return titleCaseWords(assetName).replace('Without Base', 'Without Base');
}

function tileSizeForAsset(assetName) {
  return assetName.startsWith('building_')
    ? [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]
    : [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE];
}

function tileCollisionForAsset(assetName) {
  if (assetName.startsWith('park_wall_entry')) {
    return false;
  }

  return assetName.startsWith('building_')
    || assetName.includes('_withoutBase')
    || assetName.startsWith('park_wall_');
}

function tileBallisticCollisionForAsset(assetName) {
  if (assetName.startsWith('park_wall_entry')) {
    return false;
  }

  return assetName.startsWith('building_')
    || assetName.includes('_withoutBase')
    || assetName.startsWith('park_wall_')
    || assetName.startsWith('kenney_building_');
}

function tilePaddingForAsset(assetName) {
  if (assetName.startsWith('building_') || assetName.includes('_withoutBase')) {
    return 0.5;
  }

  return tileCollisionForAsset(assetName) ? 0.24 : undefined;
}

function propSizeForAsset(assetName) {
  if (assetName === 'bench') return [5, 2];
  if (assetName === 'box_A' || assetName === 'box_B') return [3.2, 3.2];
  if (assetName === 'dumpster') return [4.2, 4.2];
  if (assetName === 'firehydrant') return [1.6, 1.6];
  if (assetName.startsWith('car_')) return [6.5, 12];
  if (assetName.startsWith('bush')) return [4, 4];
  if (assetName.startsWith('tree_')) return [5.2, 5.2];
  if (assetName.startsWith('streetlight_old_double')) return [3.8, 2.8];
  if (assetName.startsWith('streetlight_old_single')) return [2.6, 2.6];
  if (assetName.startsWith('streetlight')) return [2.3, 2.3];
  if (assetName.startsWith('trafficlight')) return [2.3, 2.3];
  if (assetName.startsWith('trash_')) return [1.8, 1.8];
  if (assetName === 'watertower') return [9, 9];
  return [4, 4];
}

function propCollisionForAsset(assetName) {
  return assetName === 'box_A'
    || assetName === 'box_B'
    || assetName.startsWith('car_')
    || assetName === 'dumpster'
    || assetName.startsWith('tree_')
    || assetName.startsWith('trash_')
    || assetName === 'watertower';
}

function propPaddingForAsset(assetName) {
  if (assetName.startsWith('car_')) {
    return 0.25;
  }

  if (assetName === 'box_A' || assetName === 'box_B' || assetName === 'dumpster') {
    return 0.2;
  }

  if (assetName === 'watertower') {
    return 0.3;
  }

  if (assetName.startsWith('tree_') || assetName.startsWith('trash_')) {
    return 0.18;
  }

  return undefined;
}

function createCityTile(definition) {
  const blocksMovement = definition.blocksMovement ?? definition.collision ?? tileCollisionForAsset(definition.assetName);
  const blocksShots = definition.blocksShots ?? definition.collision ?? tileBallisticCollisionForAsset(definition.assetName);
  const asset = Object.prototype.hasOwnProperty.call(definition, 'asset')
    ? definition.asset
    : cityAsset(definition.assetName);

  return {
    id: definition.id ?? definition.assetName.toLowerCase(),
    assetName: definition.assetName,
    label: definition.label ?? formatCityLabel(definition.assetName),
    asset,
    size: definition.size ?? tileSizeForAsset(definition.assetName),
    tileFootprint: definition.tileFootprint ?? [1, 1],
    surfaceHeight: definition.surfaceHeight ?? DEFAULT_TILE_SURFACE_HEIGHT,
    movementCollisionRects: definition.movementCollisionRects?.map((rect) => ({ ...rect })) ?? null,
    shotCollisionRects: definition.shotCollisionRects?.map((rect) => ({ ...rect })) ?? null,
    layer: 'tile',
    collision: blocksMovement,
    blocksMovement,
    blocksShots,
    padding: definition.padding ?? tilePaddingForAsset(definition.assetName),
    npcRouteDoorOffset: Array.isArray(definition.npcRouteDoorOffset)
      ? [...definition.npcRouteDoorOffset]
      : undefined,
    cameraOcclusionPreserveNodeNames: [...(definition.cameraOcclusionPreserveNodeNames ?? [])],
    cameraOcclusionAlwaysPreserveNodeNames: [...(definition.cameraOcclusionAlwaysPreserveNodeNames ?? [])],
    interior: cloneInteriorDefinition(definition.interior),
    interactable: cloneInteractableDefinition(definition.interactable),
    createVisual: typeof definition.createVisual === 'function' ? definition.createVisual : undefined,
    underlayTileId: definition.underlayTileId ?? null,
    aliases: [...(definition.aliases ?? [])],
    groupId: definition.group,
    groupLabel: TILE_GROUPS[definition.group]
  };
}

function createCityProp(definition) {
  const blocksMovement = definition.blocksMovement ?? definition.collision ?? propCollisionForAsset(definition.assetName);
  const blocksShots = definition.blocksShots ?? definition.collision ?? propCollisionForAsset(definition.assetName);
  const asset = Object.prototype.hasOwnProperty.call(definition, 'asset')
    ? definition.asset
    : cityAsset(definition.assetName);

  return {
    id: definition.id ?? definition.assetName.toLowerCase(),
    assetName: definition.assetName,
    label: definition.label ?? formatCityLabel(definition.assetName),
    asset,
    size: definition.size ?? propSizeForAsset(definition.assetName),
    layer: 'prop',
    movementCollisionRects: definition.movementCollisionRects?.map((rect) => ({ ...rect })) ?? null,
    shotCollisionRects: definition.shotCollisionRects?.map((rect) => ({ ...rect })) ?? null,
    collision: blocksMovement,
    blocksMovement,
    blocksShots,
    padding: definition.padding ?? propPaddingForAsset(definition.assetName),
    interactable: cloneInteractableDefinition(definition.interactable),
    combatPickup: cloneCombatPickupDefinition(definition.combatPickup),
    createVisual: typeof definition.createVisual === 'function' ? definition.createVisual : undefined,
    aliases: [...(definition.aliases ?? [])],
    groupId: definition.group,
    groupLabel: PROP_GROUPS[definition.group]
  };
}

export const BUILDER_CATEGORIES = [
  {
    id: 'tiles',
    label: 'Tiles',
    description: 'Snapped tile pieces for roads, lots, parks, and blockout structures.',
    items: CITY_TILE_DEFINITIONS.map(createCityTile)
  },
  {
    id: 'props',
    label: 'Props',
    description: 'Free-place dressing pieces for streets, greenery, storage, vehicles, and utilities.',
    items: CITY_PROP_DEFINITIONS.map(createCityProp)
  },
  {
    id: 'npcs',
    label: 'NPCs',
    description: 'Author character models with names and prompts for AI-driven interactions.',
    items: NPC_MODEL_CATALOG.map((model) => ({
      id: model.itemId,
      modelId: model.id,
      label: model.label,
      asset: model.asset,
      previewMode: 'static',
      previewImageSrc: npcPortraitPath(model.portraitFileName),
      size: model.footprint,
      layer: 'npc',
      collision: false,
      blocksMovement: false,
      blocksShots: false,
      padding: 0.1,
      groupId: 'citizens',
      groupLabel: 'Citizens',
      interactionOffset: model.interactionOffset,
      interactionRadius: model.interactionRadius,
      collider: { ...model.collider },
      pickCollider: { ...model.pickCollider }
    }))
  }
];

export const BUILDER_ITEMS = BUILDER_CATEGORIES.flatMap((category) =>
  category.items.map((item) => ({ ...item, categoryId: category.id }))
);

const CATEGORY_BY_ID = new Map(BUILDER_CATEGORIES.map((category) => [category.id, category]));
const ITEM_BY_ID = new Map(BUILDER_ITEMS.map((item) => [item.id, item]));
const ITEM_BY_LOOKUP_KEY = new Map();

function normalizeBuilderItemLookupKey(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || '';
}

function addBuilderItemLookupKey(key, item) {
  if (!key) {
    return;
  }

  const exactKey = String(key).trim();
  const normalizedKey = normalizeBuilderItemLookupKey(key);

  if (exactKey && !ITEM_BY_LOOKUP_KEY.has(exactKey)) {
    ITEM_BY_LOOKUP_KEY.set(exactKey, item);
  }

  if (normalizedKey && !ITEM_BY_LOOKUP_KEY.has(normalizedKey)) {
    ITEM_BY_LOOKUP_KEY.set(normalizedKey, item);
  }
}

for (const item of BUILDER_ITEMS) {
  addBuilderItemLookupKey(item.id, item);
  addBuilderItemLookupKey(item.assetName, item);
  for (const alias of item.aliases ?? []) {
    addBuilderItemLookupKey(alias, item);
  }
}

export function getBuilderItem(categoryId, index) {
  const category = CATEGORY_BY_ID.get(categoryId);
  return category?.items[index] ?? null;
}

export function getBuilderItemById(itemId) {
  return ITEM_BY_ID.get(itemId)
    ?? ITEM_BY_LOOKUP_KEY.get(String(itemId ?? '').trim())
    ?? ITEM_BY_LOOKUP_KEY.get(normalizeBuilderItemLookupKey(itemId))
    ?? null;
}

export { assetUrl, cityAsset } from './assetManifest.js';
