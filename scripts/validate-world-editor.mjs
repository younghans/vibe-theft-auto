import { readFileSync } from 'node:fs';
import { Box3, Scene, Vector3 } from 'three';
import { BUILDER_TILE_SIZE } from '../src/shared/worldConstants.js';
import { WEAPON_CLIP_SIZE, WEAPON_IDS, WEAPON_RESERVE_CAP } from '../src/shared/combatConstants.js';
import {
  COMBAT_PICKUP_PROP_ITEM_IDS,
  getCombatPickupSpawnDefinitions
} from '../src/shared/combatPickupDefinitions.js';
import { placementToCollisionRects } from '../src/shared/combatMath.js';
import { getTileFootprintWorldSize, getTileOccupiedCells } from '../src/shared/tileFootprint.js';
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
  createHotbarSlots,
  getHotbarDrinkItemId,
  moveHotbarItemOrderSlot
} from '../src/shared/hotbarInventory.js';
import {
  VIBE_HERO_GAME_ID,
  VIBE_HERO_LANE_COUNT,
  listVibeHeroSongs
} from '../src/shared/vibeHero.js';
import { normalizeNpcBehavior } from '../src/npc/npcBehavior.js';
import { buildCity } from '../src/world/buildCity.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { getInteriorTemplateById } from '../src/world/InteriorScene.js';
import {
  BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT,
  BASKETBALL_HOOP_RIM_HEIGHT,
  INSTRUMENT_CLUSTER_FOOTPRINT
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
    'pawn_building',
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

function validateVibeHero() {
  const songs = listVibeHeroSongs();
  assert(songs.length === 2, 'Vibe Hero should include exactly two starter songs');
  for (const song of songs) {
    assert(song.id && song.title, 'Vibe Hero songs should have stable ids and titles');
    assert(song.durationMs >= 20000 && song.durationMs <= 30000, `${song.title}: duration should be 20-30 seconds`);
    assert(String(song.publicDomainBasis ?? '').toLowerCase().includes('traditional'), `${song.title}: should document a traditional/public-domain basis`);
    assert(Array.isArray(song.chart) && song.chart.length >= 24, `${song.title}: chart should have enough notes to be playable`);
    let previousTime = -1;
    for (const [index, note] of song.chart.entries()) {
      assert(note.timeMs > previousTime, `${song.title} note ${index + 1}: chart timings should be sorted`);
      previousTime = note.timeMs;
      assert(Number.isFinite(note.frequency) && note.frequency > 0, `${song.title} note ${index + 1}: frequency should be playable`);
      assert(Number.isInteger(note.lane) && note.lane >= 0 && note.lane < VIBE_HERO_LANE_COUNT, `${song.title} note ${index + 1}: lane should be 0-3`);
      assert(note.timeMs >= 0 && note.timeMs < song.durationMs, `${song.title} note ${index + 1}: note should fit inside the song`);
    }
    const lanes = new Set(song.chart.map((note) => note.lane));
    assert(lanes.size === VIBE_HERO_LANE_COUNT, `${song.title}: chart should use all four Vibe Hero lanes`);
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
  const pawnShop = getBuilderItemById('pawn_building');
  const districtBuildings = [
    'school_building',
    'bar_building',
    'bank_building',
    'casino_building',
    'pawn_building',
    'offices_building'
  ].map((itemId) => getBuilderItemById(itemId));

  assert(baseLot, 'Base lot tile should exist');
  assert(bar, 'Wide bar tile should exist');
  assert(gym, 'Gym tile should exist');
  assert(largeGym, 'Large gym tile should exist');
  assert(pawnShop, 'Pawn shop tile should exist');
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
    assert(getInteriorTemplateById(item.interior?.id), `${item.id} should have a registered inline interior template`);
    assert(item.movementCollisionRects?.length >= 5, `${item.id} should define hull-wall movement collision`);
  }
  assert(pawnShop.asset === null, 'Pawn shop should use its procedural building visual instead of increasing the static asset payload');
  assert(typeof pawnShop.createVisual === 'function', 'Pawn shop should define a procedural building visual');
  assert(
    pawnShop.cameraOcclusionPreserveNodeNames?.includes('pawn_hull_wall'),
    'Pawn shop hull walls should stay visible during active cutaway camera occlusion'
  );
  assert(pawnShop.movementCollisionRects?.length >= 8, 'Pawn shop should block movement with hull and counter/table collision');
  assert(pawnShop.shotCollisionRects?.length === pawnShop.movementCollisionRects.length, 'Pawn shop counter/table collision should also block shots');
  const pawnCounterRects = pawnShop.movementCollisionRects.slice(-3);
  assert(
    pawnCounterRects.some((rect) => rect.centerZ === -7.2 && rect.halfWidth > 8 && rect.halfDepth >= 0.67),
    'Pawn shop back counter/table should have movement collision'
  );
  assert(
    pawnCounterRects.filter((rect) => rect.centerZ === -4.1 && rect.halfWidth >= 0.67 && rect.halfDepth > 3).length === 2,
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
  assert(pawnVisual.getObjectByName('pawnShopBackCounter'), 'Pawn shop interior should include a back counter');
  assert(pawnVisual.getObjectByName('pawnShopLeftCounterReturn'), 'Pawn shop counter should wrap along the left back side');
  assert(pawnVisual.getObjectByName('pawnShopRightCounterReturn'), 'Pawn shop counter should wrap along the right back side');
  assert(pawnVisual.getObjectByName('pawnShopEntranceSignPanel'), 'Pawn shop should include a front entrance sign panel');
  const pawnGlassMeshes = [
    'pawnShopFrontWindow-7.6',
    'pawnShopFrontWindow-5.25',
    'pawnShopFrontWindow5.25',
    'pawnShopFrontWindow7.6',
    'pawnShopBackCounterGlass',
    'pawnShopLeftCounterReturnGlass',
    'pawnShopRightCounterReturnGlass'
  ].map((name) => pawnVisual.getObjectByName(name));
  assert(pawnGlassMeshes.every(Boolean), 'Pawn shop should expose named glass meshes for depth validation');
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
  for (const [index, prop] of defaultWorldLayout.props.entries()) {
    const item = getBuilderItemById(prop.itemId);
    assert(item, `Prop ${index}: unknown itemId "${prop.itemId}"`);
    assert(item.layer === 'prop', `Prop ${index}: "${prop.itemId}" is not a prop catalog item`);
    assert(Array.isArray(prop.position) && prop.position.length === 2, `Prop ${index}: position must be [x, z]`);
    assert(prop.position.every((value) => Number.isFinite(value)), `Prop ${index}: position values must be finite numbers`);
    validateRotationQuarterTurns(prop.rotationQuarterTurns, `Prop ${index}`);
  }

  const pickupProps = defaultWorldLayout.props.filter((prop) => prop.itemId === COMBAT_PICKUP_PROP_ITEM_IDS.pistol);
  const pickupSpawns = getCombatPickupSpawnDefinitions(defaultWorldLayout.props, getBuilderItemById);
  assert(pickupProps.length >= 4, 'Default world should seed pistol pickups as placeable props');
  assert(pickupSpawns.length === pickupProps.length, 'Every default pistol pickup prop should resolve to a combat spawn');
  assert(
    pickupSpawns.every((spawn) => spawn.weaponId === WEAPON_IDS.pistol),
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
  assert(
    /\.hud__interaction\.is-world-anchored\s*\{[^}]*bottom:\s*auto/s.test(styles),
    'Bartender interaction menu should support anchored in-world placement'
  );
  assert(
    /setInteractionMenuAnchor\(anchor = null\)/.test(hudSource),
    'HUD interaction menu should expose an anchor updater'
  );
  assert(
    /showInteractionMenu\(\{\s*title,\s*subtitle,\s*actions,\s*anchor = null\s*\}\)/.test(hudSource),
    'HUD interaction menu should accept a world anchor'
  );
  assert(
    /getNearestBartenderInteractable\(\{\s*npcId = ''\s*\} = \{\}\)/.test(gameSource),
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
    defaultWorldLayout.npcs.every((npc) => Object.hasOwn(npc, 'bartenderEnabled')),
    'Default NPC layout should serialize bartenderEnabled for world-builder compatibility'
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
  validateTaskSequence();
  validateBartenderFunction();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
