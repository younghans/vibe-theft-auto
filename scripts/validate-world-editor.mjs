import { Scene } from 'three';
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
    'kenney_building_a',
    'kenney_building_b',
    'kenney_building_c',
    'kenney_building_d',
    'kenney_building_e',
    'kenney_building_f',
    'kenney_building_g',
    'kenney_building_h',
    'kenney_building_i',
    'kenney_building_j',
    'kenney_building_k',
    'kenney_building_l',
    'kenney_building_m',
    'kenney_building_n',
    'kenney_building_skyscraper_a',
    'kenney_building_skyscraper_b',
    'kenney_building_skyscraper_c',
    'kenney_building_skyscraper_d',
    'kenney_building_skyscraper_e',
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

    const cellKey = `${tile.cell[0]},${tile.cell[1]}`;
    assert(!seenCells.has(cellKey), `Duplicate tile cell found at ${cellKey}`);
    seenCells.add(cellKey);
  }
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
  validateTiles();
  validateProps();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
