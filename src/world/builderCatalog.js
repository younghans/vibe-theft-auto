import { assetUrl, cityAsset } from './assetManifest.js';
import { NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

export { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

const TILE_GROUPS = Object.freeze({
  streets: 'Streets',
  lots: 'Lots & Buildings',
  parks: 'Parks'
});

const PROP_GROUPS = Object.freeze({
  street: 'Street',
  greenery: 'Greenery',
  storage: 'Storage',
  vehicles: 'Vehicles',
  utilities: 'Utilities'
});

const KENNEY_CITY_PACK = 'kenney_city-kit-commercial_2.1';
const KENNEY_TILE_SIZE = Object.freeze([BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]);
const DEFAULT_TILE_SURFACE_HEIGHT = 0.7;
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

function createKenneyBuildingDefinition({ id, label, fileName }) {
  return {
    id,
    assetName: id,
    label,
    asset: kenneyAsset(fileName),
    group: 'lots',
    size: KENNEY_TILE_SIZE,
    collision: true,
    padding: 0.5
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

const CITY_TILE_DEFINITIONS = Object.freeze([
  { id: 'road_straight', assetName: 'road_straight', group: 'streets' },
  { id: 'road_corner', assetName: 'road_corner', group: 'streets' },
  { assetName: 'road_corner_curved', group: 'streets' },
  { id: 'road_tsplit', assetName: 'road_tsplit', group: 'streets' },
  { id: 'road_cross', assetName: 'road_straight_crossing', label: 'Road Cross', group: 'streets' },
  { id: 'road_junction', assetName: 'road_junction', label: 'Road Junction', group: 'streets' },
  { id: 'lot_base', assetName: 'base', label: 'Base Lot', group: 'lots' },
  { id: 'building_a', assetName: 'building_A', group: 'lots' },
  { id: 'building_a_without_base', assetName: 'building_A_withoutBase', group: 'lots' },
  { id: 'building_b', assetName: 'building_B', group: 'lots' },
  { id: 'building_b_without_base', assetName: 'building_B_withoutBase', group: 'lots' },
  { id: 'building_c', assetName: 'building_C', group: 'lots' },
  { id: 'building_c_without_base', assetName: 'building_C_withoutBase', group: 'lots' },
  { id: 'building_d', assetName: 'building_D', group: 'lots' },
  { id: 'building_d_without_base', assetName: 'building_D_withoutBase', group: 'lots' },
  { id: 'building_e', assetName: 'building_E', group: 'lots' },
  { id: 'building_e_without_base', assetName: 'building_E_withoutBase', group: 'lots' },
  { id: 'building_f', assetName: 'building_F', group: 'lots' },
  { id: 'building_f_without_base', assetName: 'building_F_withoutBase', group: 'lots' },
  { id: 'building_g', assetName: 'building_G', group: 'lots' },
  { id: 'building_g_without_base', assetName: 'building_G_withoutBase', group: 'lots' },
  { id: 'building_h', assetName: 'building_H', group: 'lots' },
  { id: 'building_h_without_base', assetName: 'building_H_withoutBase', group: 'lots' },
  { assetName: 'park_base', group: 'parks' },
  { assetName: 'park_base_decorated_bushes', group: 'parks' },
  { assetName: 'park_base_decorated_trees', group: 'parks' },
  { assetName: 'park_road_corner', group: 'parks' },
  { assetName: 'park_road_corner_decorated', group: 'parks' },
  { assetName: 'park_road_junction', group: 'parks' },
  { assetName: 'park_road_junction_decorated_A', group: 'parks' },
  { assetName: 'park_road_junction_decorated_B', group: 'parks' },
  { assetName: 'park_road_junction_decorated_C', group: 'parks' },
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

  return {
    id: definition.id ?? definition.assetName.toLowerCase(),
    assetName: definition.assetName,
    label: definition.label ?? formatCityLabel(definition.assetName),
    asset: definition.asset ?? cityAsset(definition.assetName),
    size: definition.size ?? tileSizeForAsset(definition.assetName),
    surfaceHeight: definition.surfaceHeight ?? DEFAULT_TILE_SURFACE_HEIGHT,
    layer: 'tile',
    collision: blocksMovement,
    blocksMovement,
    blocksShots,
    padding: definition.padding ?? tilePaddingForAsset(definition.assetName),
    groupId: definition.group,
    groupLabel: TILE_GROUPS[definition.group]
  };
}

function createCityProp(definition) {
  const blocksMovement = definition.blocksMovement ?? definition.collision ?? propCollisionForAsset(definition.assetName);
  const blocksShots = definition.blocksShots ?? definition.collision ?? propCollisionForAsset(definition.assetName);

  return {
    id: definition.id ?? definition.assetName.toLowerCase(),
    assetName: definition.assetName,
    label: definition.label ?? formatCityLabel(definition.assetName),
    asset: definition.asset ?? cityAsset(definition.assetName),
    size: definition.size ?? propSizeForAsset(definition.assetName),
    layer: 'prop',
    collision: blocksMovement,
    blocksMovement,
    blocksShots,
    padding: definition.padding ?? propPaddingForAsset(definition.assetName),
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
