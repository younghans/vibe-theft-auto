import { assets } from './assetManifest.js';
import { NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

export { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

export const BUILDER_CATEGORIES = [
  {
    id: 'tiles',
    label: 'Tiles',
    description: 'Snapped tilemap pieces for roads, lots, and buildings.',
    items: [
      { id: 'road_straight', label: 'Road Straight', asset: assets.city.roadStraight, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'road_corner', label: 'Road Corner', asset: assets.city.roadCorner, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'road_tsplit', label: 'Road T', asset: assets.city.roadTSplit, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'road_cross', label: 'Road Cross', asset: assets.city.roadCrossing, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'road_junction', label: 'Road End', asset: assets.city.roadJunction, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'lot_base', label: 'Base Lot', asset: assets.city.base, size: [BUILDER_TILE_SIZE, BUILDER_TILE_SIZE], layer: 'tile', collision: false },
      { id: 'building_a', label: 'Building A', asset: assets.city.buildingA, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_b', label: 'Building B', asset: assets.city.buildingB, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_c', label: 'Building C', asset: assets.city.buildingC, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_d', label: 'Building D', asset: assets.city.buildingD, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_e', label: 'Building E', asset: assets.city.buildingE, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_f', label: 'Building F', asset: assets.city.buildingF, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_g', label: 'Building G', asset: assets.city.buildingG, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 },
      { id: 'building_h', label: 'Building H', asset: assets.city.buildingH, size: [BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82], layer: 'tile', collision: true, padding: 0.5 }
    ]
  },
  {
    id: 'props',
    label: 'Props',
    description: 'Freely placed street dressing that sits on top of the tilemap.',
    items: [
      { id: 'bench', label: 'Bench', asset: assets.city.bench, size: [5, 2], layer: 'prop', collision: false },
      { id: 'bush', label: 'Bush', asset: assets.city.bush, size: [4, 4], layer: 'prop', collision: false },
      { id: 'crate_a', label: 'Crate A', asset: assets.city.boxA, size: [3.2, 3.2], layer: 'prop', collision: true, padding: 0.2 },
      { id: 'crate_b', label: 'Crate B', asset: assets.city.boxB, size: [3.2, 3.2], layer: 'prop', collision: true, padding: 0.2 },
      { id: 'car_sedan', label: 'Car Sedan', asset: assets.city.carSedan, size: [6.5, 12], layer: 'prop', collision: true, padding: 0.25 },
      { id: 'car_taxi', label: 'Car Taxi', asset: assets.city.carTaxi, size: [6.5, 12], layer: 'prop', collision: true, padding: 0.25 },
      { id: 'dumpster', label: 'Dumpster', asset: assets.city.dumpster, size: [4.2, 4.2], layer: 'prop', collision: true, padding: 0.2 },
      { id: 'hydrant', label: 'Hydrant', asset: assets.city.firehydrant, size: [1.6, 1.6], layer: 'prop', collision: false },
      { id: 'streetlight', label: 'Streetlight', asset: assets.city.streetlight, size: [2.3, 2.3], layer: 'prop', collision: false },
      { id: 'traffic_light', label: 'Traffic Light', asset: assets.city.trafficLight, size: [2.3, 2.3], layer: 'prop', collision: false },
      { id: 'tower', label: 'Watertower', asset: assets.city.watertower, size: [9, 9], layer: 'prop', collision: true, padding: 0.3 }
    ]
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
      collision: true,
      padding: 0.1,
      interactionOffset: model.interactionOffset,
      interactionRadius: model.interactionRadius,
      collisionRadius: model.collisionRadius
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
