import { assetUrl, cityAsset } from './assetManifest.js';
import { NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { VIBE_JAM_PORTAL_URL } from '../shared/vibeJamPortalConfig.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import {
  cloneInteractableDefinition,
  cloneInteriorDefinition
} from './interactableMetadata.js';
import {
  BASKETBALL_HOOP_FOOTPRINT,
  BLACKJACK_TABLE_FOOTPRINT,
  createBasketballHoopVisual,
  createBlackjackTableVisual,
  createOlympicBarbellVisual,
  createStandingDeskComputerVisual,
  createVibeJamExitPortalVisual,
  createVibeJamStartPortalVisual,
  OLYMPIC_BARBELL_FOOTPRINT,
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
  casino: 'Casino',
  fitness: 'Fitness',
  office: 'Office',
  portals: 'Portals',
  storage: 'Storage',
  vehicles: 'Vehicles',
  utilities: 'Utilities'
});

const KENNEY_CITY_PACK = 'kenney_city-kit-commercial_2.1';
const CUSTOM_CITY_PACK = 'stickrpg_custom';
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

function createCustom2x2BuildingDefinition({
  key,
  label,
  fileName,
  prompt,
  interiorOverrides = {},
  cameraOcclusionPreserveNodeNames = [`${key}_interior`, `${key}_foundation`]
}) {
  const cutawayNodeNames = interiorOverrides.cutawayNodeNames
    ?? [`${key}_cutaway_roof`, `${key}_cutaway_upper`];

  return {
    id: `${key}_building`,
    assetName: `${key}_building`,
    label,
    asset: customCityAsset('models', fileName),
    group: 'lots',
    size: CUSTOM_2X2_BUILDING_SIZE,
    tileFootprint: [2, 2],
    surfaceHeight: 0.76,
    collision: true,
    blocksShots: true,
    movementCollisionRects: STANDARD_2X2_HULL_COLLISION_RECTS,
    shotCollisionRects: STANDARD_2X2_HULL_COLLISION_RECTS,
    padding: 0.5,
    underlayTileId: BUILDING_UNDERLAY_TILE_ID,
    cameraOcclusionPreserveNodeNames,
    interior: {
      id: `${key}_interior`,
      mode: 'inline-cutaway',
      label,
      prompt: prompt ?? `Enter ${label}`,
      ...interiorOverrides,
      cutawayNodeNames,
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
    key: 'offices',
    label: 'Offices',
    fileName: 'offices-building.glb',
    prompt: 'Enter offices',
    interiorOverrides: {
      cutawayFadeNodeNames: ['offices_cutaway_tower'],
      cutawayFadeOpacity: 0.1
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
    cameraOcclusionPreserveNodeNames: ['gym_interior', 'gym_foundation'],
    interior: {
      id: 'gym_large_blank',
      mode: 'inline-cutaway',
      label: 'Fitness Gym',
      prompt: 'Enter gym',
      cutawayNodeNames: ['gym_cutaway_roof', 'gym_cutaway_upper', 'gym_cutaway_corner'],
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
    id: 'basketball_hoop',
    assetName: 'basketball_hoop',
    label: 'Basketball Hoop',
    asset: null,
    group: 'fitness',
    size: BASKETBALL_HOOP_FOOTPRINT,
    collision: true,
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
      prompt: 'Work on computer',
      actionText: 'Type up some work.',
      radius: 3.8,
      localOffset: [0, 0.1],
      workoutType: 'typing',
      hideDuringWorkout: false,
      approachLocalOffset: [0, 1.35],
      approachRotationY: Math.PI
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
    interior: cloneInteriorDefinition(definition.interior),
    interactable: cloneInteractableDefinition(definition.interactable),
    createVisual: typeof definition.createVisual === 'function' ? definition.createVisual : undefined,
    underlayTileId: definition.underlayTileId ?? null,
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
    collision: blocksMovement,
    blocksMovement,
    blocksShots,
    padding: definition.padding ?? propPaddingForAsset(definition.assetName),
    interactable: cloneInteractableDefinition(definition.interactable),
    createVisual: typeof definition.createVisual === 'function' ? definition.createVisual : undefined,
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

export function getBuilderItem(categoryId, index) {
  const category = CATEGORY_BY_ID.get(categoryId);
  return category?.items[index] ?? null;
}

export function getBuilderItemById(itemId) {
  return ITEM_BY_ID.get(itemId) ?? null;
}

export { assetUrl, cityAsset } from './assetManifest.js';
