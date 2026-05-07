import { Scene } from 'three';
import { BUILDER_TILE_SIZE } from '../src/shared/worldConstants.js';
import { getTileFootprintWorldSize, getTileOccupiedCells } from '../src/shared/tileFootprint.js';
import { buildCity } from '../src/world/buildCity.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateRotationQuarterTurns(value, context) {
  assert(Number.isInteger(value), `${context}: rotationQuarterTurns must be an integer`);
  assert(value >= 0 && value <= 3, `${context}: rotationQuarterTurns must be between 0 and 3`);
}

function validateKenneyCatalogItems() {
  const expectedIds = [
    'bar_building_wide',
    'school_building',
    'bar_building',
    'bank_building',
    'casino_building',
    'offices_building',
    'gym_building',
    'gym_building_large',
    'hospital_building',
    'hospital_building_wide',
    ...'abcdefghijklmn'.split('').map((variant) => `kenney_building_${variant}`),
    ...'abcde'.split('').map((variant) => `kenney_building_skyscraper_${variant}`),
    'kenney_detail_awning',
    'kenney_detail_awning_wide',
    'kenney_detail_overhang',
    'kenney_detail_overhang_wide',
    'kenney_detail_parasol_a',
    'kenney_detail_parasol_b'
  ];

  for (const itemId of expectedIds) {
    const item = getBuilderItemById(itemId);
    assert(item, `Kenney catalog item "${itemId}" should exist`);
  }
}

function validateTiles() {
  const seenCells = new Set();

  for (const [index, tile] of defaultWorldLayout.tiles.entries()) {
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

function sortedCellKeys(cells) {
  return cells
    .map((cell) => `${cell.x},${cell.z}`)
    .sort();
}

function validateFootprintSupport() {
  const baseLot = getBuilderItemById('lot_base');
  const bar = getBuilderItemById('bar_building_wide');
  const gym = getBuilderItemById('gym_building');
  const largeGym = getBuilderItemById('gym_building_large');
  const districtBuildings = [
    'school_building',
    'bar_building',
    'bank_building',
    'casino_building',
    'offices_building'
  ].map((itemId) => getBuilderItemById(itemId));

  assert(baseLot, 'Base lot tile should exist');
  assert(bar, 'Wide bar tile should exist');
  assert(gym, 'Gym tile should exist');
  assert(largeGym, 'Large gym tile should exist');
  for (const [index, item] of districtBuildings.entries()) {
    assert(item, `District 2x2 building ${index} should exist`);
  }

  assert(baseLot.tileFootprint[0] === 1 && baseLot.tileFootprint[1] === 1, 'Base lot should remain 1x1');
  assert(bar.tileFootprint[0] === 2 && bar.tileFootprint[1] === 1, 'Wide bar should remain 2x1');
  assert(gym.tileFootprint[0] === 1 && gym.tileFootprint[1] === 1, 'Original gym should remain 1x1');
  assert(largeGym.tileFootprint[0] === 2 && largeGym.tileFootprint[1] === 2, 'Large gym should use a 2x2 footprint');
  for (const item of districtBuildings) {
    assert(item.tileFootprint[0] === 2 && item.tileFootprint[1] === 2, `${item.id} should use a 2x2 footprint`);
    assert(item.interior?.mode === 'inline-cutaway', `${item.id} should expose an inline cutaway interior`);
    assert(item.movementCollisionRects?.length >= 5, `${item.id} should define hull-wall movement collision`);
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
  for (const [index, prop] of defaultWorldLayout.props.entries()) {
    const item = getBuilderItemById(prop.itemId);
    assert(item, `Prop ${index}: unknown itemId "${prop.itemId}"`);
    assert(item.layer === 'prop', `Prop ${index}: "${prop.itemId}" is not a prop catalog item`);
    assert(Array.isArray(prop.position) && prop.position.length === 2, `Prop ${index}: position must be [x, z]`);
    assert(prop.position.every((value) => Number.isFinite(value)), `Prop ${index}: position values must be finite numbers`);
    validateRotationQuarterTurns(prop.rotationQuarterTurns, `Prop ${index}`);
  }
}

async function validateBuildCity() {
  const scene = new Scene();
  const city = await buildCity(scene);
  assert(city.layout === defaultWorldLayout, 'buildCity should return the checked-in default world layout');
  assert(scene.children.length > 0, 'buildCity should add scene content');
}

async function main() {
  validateKenneyCatalogItems();
  validateFootprintSupport();
  validateTiles();
  validateProps();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
