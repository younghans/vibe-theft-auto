import { Box3, Scene, Vector3 } from 'three';
import { BUILDER_TILE_SIZE } from '../src/shared/worldConstants.js';
import { placementToCollisionRects } from '../src/shared/combatMath.js';
import { getTileFootprintWorldSize, getTileOccupiedCells } from '../src/shared/tileFootprint.js';
import { buildCity } from '../src/world/buildCity.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import {
  BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT,
  BASKETBALL_HOOP_RIM_HEIGHT
} from '../src/world/proceduralProps.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import { TASK_IDS, TaskTracker, resolvePlayerTask } from '../src/game/TaskTracker.js';

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

function validateCustomTileCatalogItems() {
  const basketballCourt = getBuilderItemById('basketball_court_half');
  assert(basketballCourt, 'Basketball half-court tile should exist');
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

function validateTaskSequence() {
  const basePlayer = {
    deliveryQuestCompletionCount: 1,
    deliveryQuestStatus: '',
    gymPumpCompletedAt: 0,
    stockBoughtAt: 0,
    blackjackHandPlayedAt: 0
  };

  assert(
    resolvePlayerTask({ localPlayerState: basePlayer }).id === TASK_IDS.gymPump,
    'Task sequence should route to the gym after first delivery.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: { ...basePlayer, gymPumpCompletedAt: 1000 } }).id === TASK_IDS.stockBuy,
    'Task sequence should route to buying a stock after gym pump.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: { ...basePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } }).id === TASK_IDS.blackjackHand,
    'Task sequence should route to blackjack after buying a stock.'
  );
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...basePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000
      }
    }).id === TASK_IDS.makeMoney,
    'Task sequence should return to the make-money prompt after blackjack.'
  );

  const stockTracker = new TaskTracker();
  stockTracker.update({ localPlayerState: { ...basePlayer, gymPumpCompletedAt: 1000 } });
  assert(
    stockTracker.update({ localPlayerState: { ...basePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } }).completedTask,
    'Task tracker should complete the stock-buy task when a stock is bought.'
  );

  const blackjackTracker = new TaskTracker();
  blackjackTracker.update({ localPlayerState: { ...basePlayer, gymPumpCompletedAt: 1000, stockBoughtAt: 2000 } });
  assert(
    blackjackTracker.update({
      localPlayerState: {
        ...basePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000
      }
    }).completedTask,
    'Task tracker should complete the blackjack task when a hand is played.'
  );
}

async function main() {
  validateKenneyCatalogItems();
  validateCustomTileCatalogItems();
  validateCustomPropCatalogItems();
  validateFootprintSupport();
  validateTiles();
  validateProps();
  validateTaskSequence();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
