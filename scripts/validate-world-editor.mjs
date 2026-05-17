import { readFileSync } from 'node:fs';
import { Box3, Group, Scene, Vector3 } from 'three';
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
  PAWN_SHOP_ITEM_IDS,
  addPlayerPawnShopItem,
  consumePlayerPawnShopItem,
  getPawnShopMenuItem,
  getPlayerPawnShopInventorySnapshot,
  isPlayerPawnShopItemOwned,
  isPawnShopOwnerNpc,
  listPawnShopMenuItems
} from '../src/shared/pawnShop.js';
import { SKATEBOARD_SPEED_MULTIPLIER } from '../src/shared/skateboard.js';
import {
  createHotbarSlots,
  getHotbarConsumableItemId,
  getHotbarDrinkItemId,
  moveHotbarItemOrderSlot
} from '../src/shared/hotbarInventory.js';
import {
  VIBE_HERO_GAME_ID,
  VIBE_HERO_LANE_COUNT,
  VIBE_HERO_NOTE_TRAVEL_MS,
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
import { assets } from '../src/world/assetManifest.js';
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
  JANITOR_TASKS_REQUIRED,
  MISSION_CATALOG,
  MISSION_STATUS,
  SCHOOL_TEACHER_TASKS_REQUIRED,
  appendMissionSequencePromptEntry,
  getMissionSnapshots,
  getMissionSequenceViewModel,
  moveMissionSequenceEntry,
  normalizeMissionSequenceConfig,
  updateMissionSequenceEntry
} from '../src/shared/missions.js';

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
  const licenseNotice = readFileSync(new URL('../assets/audio/vibe-hero/License.txt', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = readFileSync(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const songs = listVibeHeroSongs();
  assert(VIBE_HERO_LANE_COUNT === 5, 'Vibe Hero should expose five lanes for keys 1-5');
  assert(VIBE_HERO_NOTE_TRAVEL_MS <= 950, 'Vibe Hero notes should use hyperspeed travel timing');
  assert(gameSource.includes('openVibeHeroChartEditor'), 'Vibe Hero should expose a dedicated chart editor opener');
  assert(gameSource.includes('this.canUseVibeHeroChartEditor()') && gameSource.includes("this.input.consume('KeyF')"), 'Instrument cluster chart editor should be gated to admins on F');
  assert(gameSource.includes("this.input.consume('KeyR')"), 'Vibe Hero chart editor should toggle recording with R');
  assert(gameSource.includes("this.input.consume('KeyN')") && gameSource.includes("this.input.consume('KeyM')"), 'Vibe Hero chart editor should support N/M seek controls');
  assert(gameSource.includes("this.input.consume('Space')") && gameSource.includes('toggleVibeHeroEditorPlayback'), 'Vibe Hero chart editor should pause/play with Space');
  assert(gameSource.includes('overwriteVibeHeroEditorRange') && gameSource.includes('recordVibeHeroEditorLanes'), 'Vibe Hero chart editor should overwrite chart ranges from keyboard lane recording');
  assert(gameSource.includes('VIBE_HERO_EDITOR_STORAGE_PREFIX'), 'Vibe Hero chart editor should persist edited charts locally for admins');
  assert(hudSource.includes('editor-select') && hudSource.includes('data-vibe-hero-action="editor:record"'), 'Vibe Hero HUD should render admin chart editor controls');
  assert(songs.length === 2, 'Vibe Hero should include exactly two starter songs');
  for (const song of songs) {
    assert(song.id && song.title, 'Vibe Hero songs should have stable ids and titles');
    assert(song.durationMs >= 45000 && song.durationMs <= 120000, `${song.title}: duration should be a 45-120 second snippet`);
    assert(String(song.sourceUrl ?? '').startsWith('https://'), `${song.title}: should document the source page`);
    assert(/^https:\/\/.+\.mp3(?:$|\?)/u.test(String(song.sourceDownloadUrl ?? '')), `${song.title}: should document a playable original MP3 URL`);
    assert(String(song.publicDomainBasis ?? '').toLowerCase().includes('public domain'), `${song.title}: should document the composition/public-domain basis`);
    assert(String(song.sourceLicense ?? '').length > 20, `${song.title}: should document the recording license/source terms`);
    assert(String(song.chartSource ?? '').toLowerCase().includes('source-mp3 onset'), `${song.title}: should document source-MP3 onset charting`);
    assert(licenseNotice.includes(song.sourceDownloadUrl), `${song.title}: source MP3 should be listed in the Vibe Hero audio notice`);
    if (song.id === 'vivaldi-winter') {
      assert(song.snippetStartMs === 30000, 'Vivaldi - Winter should skip the first 30 seconds of the MP3');
      assert(song.durationMs === 95000, 'Vivaldi - Winter should chart a 95 second snippet after the 30 second skip');
    }

    assert(Array.isArray(song.chart) && song.chart.length >= 120, `${song.title}: expert chart should have enough notes to be difficult`);
    let previousTime = -1;
    let totalGapMs = 0;
    let minGapMs = Infinity;
    for (const [index, note] of song.chart.entries()) {
      assert(note.timeMs > previousTime, `${song.title} note ${index + 1}: chart timings should be sorted`);
      if (previousTime >= 0) {
        const gapMs = note.timeMs - previousTime;
        totalGapMs += gapMs;
        minGapMs = Math.min(minGapMs, gapMs);
      }
      previousTime = note.timeMs;
      assert(Number.isFinite(note.frequency) && note.frequency > 0, `${song.title} note ${index + 1}: frequency should be playable`);
      assert(Number.isInteger(note.lane) && note.lane >= 0 && note.lane < VIBE_HERO_LANE_COUNT, `${song.title} note ${index + 1}: lane should be 0-4`);
      assert(note.timeMs >= 0 && note.timeMs < song.durationMs, `${song.title} note ${index + 1}: note should fit inside the song`);
    }
    const averageGapMs = totalGapMs / Math.max(1, song.chart.length - 1);
    const notesPerSecond = song.chart.length / Math.max(1, song.durationMs / 1000);
    assert(minGapMs >= 70, `${song.title}: onset chart should avoid stacked filler notes`);
    assert(averageGapMs >= 140, `${song.title}: chart should emphasize substantial attacks`);
    assert(notesPerSecond <= 5.6, `${song.title}: chart should not fill quiet music with extra notes`);
    const lanes = new Set(song.chart.map((note) => note.lane));
    assert(lanes.size === VIBE_HERO_LANE_COUNT, `${song.title}: chart should use all five Vibe Hero lanes`);
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
    blackjackHandPlayedAt: 0,
    schoolTasksCompletedCount: 0,
    janitorTasksCompletedCount: 0,
    skateboardOwned: false,
    officeManagerCompletedAt: 0
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

  assert(
    resolvePlayerTask({ localPlayerState: basePlayer }).id === TASK_IDS.schoolTeacherTasks,
    'Task sequence should route to school after first delivery.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: schoolCompletePlayer }).id === TASK_IDS.janitorTasks,
    'Task sequence should route to janitor work after school.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: janitorCompletePlayer }).id === TASK_IDS.gymPump,
    'Task sequence should route to the gym after janitor work.'
  );
  assert(
    resolvePlayerTask({ localPlayerState: { ...janitorCompletePlayer, gymPumpCompletedAt: 1000 } }).id === TASK_IDS.stockBuy,
    'Task sequence should route to buying a stock after gym pump.'
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
  assert(
    resolvePlayerTask({
      localPlayerState: {
        ...janitorCompletePlayer,
        gymPumpCompletedAt: 1000,
        stockBoughtAt: 2000,
        blackjackHandPlayedAt: 3000,
        skateboardOwned: true,
        officeManagerCompletedAt: 4000
      }
    }).id === TASK_IDS.makeMoney,
    'Task sequence should return to the make-money prompt after the sequenced missions.'
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
    carryingClip.tracks.every((track) => !/^mixamorig(?:Hips|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot)/u.test(track.name ?? '')),
    'Optimized delivery carry clip should not include lower-body tracks.'
  );
  assert(deliveryBox, 'Delivery quest should define a held delivery box item.');
  assert(
    deliveryBox.attachmentSlot === ATTACHMENT_SLOTS.handLeft,
    'Delivery box should attach to the left hand so it can ride the carrying pose.'
  );
  assert(
    Number(deliveryBox.normalize?.maxDimension) > 0 && Number(deliveryBox.normalize?.maxDimension) < 1,
    'Delivery box should be scaled as a small package.'
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
    TASK_IDS.officeManagerPromotion
  ];
  const expectedGateNumbers = [0, 1, 2, 3, 4, 4, 4, 4, 7];
  assert(sequence.length === MISSION_CATALOG.length, 'Mission sequencer should include every catalog mission');
  assert(
    JSON.stringify(sequence.map((entry) => entry.missionId)) === JSON.stringify(expectedOrder),
    'Mission sequencer should use the admin-authored mission order'
  );
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
    officeManagerCompletedAt: 0
  };
  const stockSnapshot = getMissionSnapshots(noProgressPlayer, '', ungatedStock)
    .find((mission) => mission.id === TASK_IDS.stockBuy);
  assert(stockSnapshot?.status === MISSION_STATUS.available, 'Unchecked mission gates should make that mission available when its own task is unfinished');

  const defaultSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1
  }, '', sequence);
  const schoolSnapshot = defaultSnapshots.find((mission) => mission.id === TASK_IDS.schoolTeacherTasks);
  const janitorLockedSnapshot = defaultSnapshots.find((mission) => mission.id === TASK_IDS.janitorTasks);
  const stockLockedSnapshot = defaultSnapshots.find((mission) => mission.id === TASK_IDS.stockBuy);
  assert(schoolSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock school after delivery');
  assert(janitorLockedSnapshot?.status === MISSION_STATUS.locked, 'Default sequence should keep janitor work locked until school is complete');
  assert(stockLockedSnapshot?.status === MISSION_STATUS.locked, 'Default sequence should keep stock locked until janitor work is complete');

  const postJanitorSnapshots = getMissionSnapshots({
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED
  }, '', sequence);
  const gymSnapshot = postJanitorSnapshots.find((mission) => mission.id === TASK_IDS.gymPump);
  const skateboardSnapshot = postJanitorSnapshots.find((mission) => mission.id === TASK_IDS.transportationUpgrade);
  assert(gymSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock gym after janitor work');
  assert(skateboardSnapshot?.status === MISSION_STATUS.available, 'Default sequence should unlock the skateboard mission after janitor work');

  const rows = getMissionSequenceViewModel(sequence);
  assert(rows.every((row, index) => row.missionNumber === index + 1), 'Mission sequencer view model should expose stable mission numbers');
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

  const completePlayer = {
    ...noProgressPlayer,
    deliveryQuestCompletionCount: 1,
    schoolTasksCompletedCount: SCHOOL_TEACHER_TASKS_REQUIRED,
    janitorTasksCompletedCount: JANITOR_TASKS_REQUIRED,
    gymPumpCompletedAt: 1,
    stockBoughtAt: 1,
    blackjackHandPlayedAt: 1,
    skateboardOwned: true,
    officeManagerCompletedAt: 1
  };
  const customSnapshot = getMissionSnapshots(completePlayer, customMission.missionId, sequenceWithCustomMission)
    .find((mission) => mission.id === customMission.missionId);
  assert(customSnapshot?.status === MISSION_STATUS.available, 'Custom missions should become available when their sequence gate is satisfied');
  assert(customSnapshot?.selectable === true, 'Available custom missions should be selectable from the mission app');

  const chainedCustomSequence = appendMissionSequencePromptEntry(sequenceWithCustomMission, 'Check off the crew board.');
  const chainedCustomMission = chainedCustomSequence.at(-1);
  const chainedCustomSnapshot = getMissionSnapshots(completePlayer, chainedCustomMission.missionId, chainedCustomSequence)
    .find((mission) => mission.id === chainedCustomMission.missionId);
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
  const playerSource = readFileSync(new URL('../src/player/createPlayer.js', import.meta.url), 'utf8');
  const serverSource = readFileSync(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
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

  const cigarettes = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.cigarettes);
  const pawnPistol = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.pistol);
  const skateboard = getPawnShopMenuItem(PAWN_SHOP_ITEM_IDS.skateboard);
  assert(cigarettes?.price === 20, 'Pawn shop cigarettes should cost $20');
  assert(cigarettes?.kind === 'consumable', 'Pawn shop cigarettes should be a consumable item');
  assert(pawnPistol?.price === 50, 'Pawn shop pistol should cost $50');
  assert(pawnPistol?.weaponId === WEAPON_IDS.pistol, 'Pawn shop pistol should sell the standard pistol');
  assert(skateboard?.price === 200, 'Pawn shop skateboard should cost $200');
  assert(skateboard?.kind === 'permanent', 'Pawn shop skateboard should be a permanent item');
  assert(listPawnShopMenuItems().length === 3, 'Pawn shop menu should include cigarettes, pistol, and skateboard');

  const cigarettePlayer = { cigaretteCount: 0 };
  addPlayerPawnShopItem(cigarettePlayer, PAWN_SHOP_ITEM_IDS.cigarettes, 2);
  assert(cigarettePlayer.cigaretteCount === 2, 'Pawn shop cigarettes should add to player inventory');
  const smokeResult = consumePlayerPawnShopItem(cigarettePlayer, PAWN_SHOP_ITEM_IDS.cigarettes);
  assert(smokeResult.ok && cigarettePlayer.cigaretteCount === 1, 'Smoking should consume one cigarette');
  const cigaretteSlots = createHotbarSlots({ cigaretteCount: 3 });
  assert(
    getHotbarConsumableItemId(cigaretteSlots[3]) === PAWN_SHOP_ITEM_IDS.cigarettes,
    'Cigarettes should appear as a hotbar consumable'
  );
  const skateboardPlayer = { skateboardOwned: false };
  addPlayerPawnShopItem(skateboardPlayer, PAWN_SHOP_ITEM_IDS.skateboard, 1);
  assert(skateboardPlayer.skateboardOwned === true, 'Pawn shop skateboard should set a permanent owned flag');
  assert(isPlayerPawnShopItemOwned(skateboardPlayer, PAWN_SHOP_ITEM_IDS.skateboard), 'Pawn shop skateboard ownership should be readable');
  assert(
    getPlayerPawnShopInventorySnapshot(skateboardPlayer).skateboardOwned === true,
    'Pawn shop inventory snapshot should include skateboard ownership'
  );
  assert(
    createHotbarSlots({ skateboardOwned: true }).every((slot) => slot.itemId !== PAWN_SHOP_ITEM_IDS.skateboard),
    'Skateboard should not occupy one of the five hotbar slots'
  );
  assert(SKATEBOARD_SPEED_MULTIPLIER === 1.6, 'Skateboard skating speed multiplier should be 1.6x');

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
    defaultWorldLayout.npcs.some((npc) => npc.id === 'npc_roth' && npc.pawnShopOwnerEnabled === true),
    'Default NPC layout should seed Roth as the pawn shop owner'
  );
  assert(
    defaultWorldLayout.npcs.every((npc) => Object.hasOwn(npc, 'pawnShopOwnerEnabled')),
    'Default NPC layout should serialize pawnShopOwnerEnabled for world-builder compatibility'
  );
  assert(
    /this\.syncActivePawnShopMenu\(pawnShopOwnerInteraction\);/.test(gameSource),
    'Pawn shop owner menu should resync and close during interaction updates'
  );
  assert(
    /buyPawnShopItem/.test(gameSource),
    'Game client should route pawn shop menu actions to a purchase handler'
  );
  assert(
    /setPlayerBoundItemsState/.test(hudSource) && /\.hud__bound-items/.test(styles),
    'HUD should display permanent skateboard ownership outside the hotbar'
  );
  assert(
    /PlayerSkateboardDeck/.test(playerSource) && /setSkateboardState/.test(playerSource),
    'Player avatar should include a simple skateboard visual below the feet'
  );
  assert(
    /SKATEBOARD_LOWER_BODY_STILL_BONES\s*=\s*Object\.freeze\(\[\.\.\.LOWER_BODY_LOCOMOTION_BONES\]\)/.test(playerSource)
      && /SKATEBOARD_UPPER_BODY_STILL_BONES\s*=\s*Object\.freeze\(\[\.\.\.UPPER_BODY_EMOTE_BONES\]\)/.test(playerSource)
      && /SKATEBOARD_STILL_BODY_BONES\s*=\s*Object\.freeze\(\[\s*\.\.\.SKATEBOARD_LOWER_BODY_STILL_BONES,\s*\.\.\.SKATEBOARD_UPPER_BODY_STILL_BONES\s*\]\)/.test(playerSource)
      && /SKATEBOARD_SIDEWAYS_FOOT_YAW\s*=\s*Math\.PI\s*\/\s*2/.test(playerSource)
      && /mixamorigLeftFoot:\s*Object\.freeze\(\[0,\s*SKATEBOARD_SIDEWAYS_FOOT_YAW,\s*0\]\)/.test(playerSource)
      && /mixamorigRightFoot:\s*Object\.freeze\(\[0,\s*SKATEBOARD_SIDEWAYS_FOOT_YAW,\s*0\]\)/.test(playerSource),
    'Skating should hold the full player body still with both feet perpendicular to the skateboard'
  );
  assert(
    /function applySkateboardStaticBodyPose\(deltaSeconds,\s*active\)/.test(playerSource)
      && /skateboardStaticBodyPoseWeight\s*=\s*active\s*\?\s*1\s*:\s*THREE\.MathUtils\.damp/.test(playerSource)
      && /applyReloadArmIk\(activeAimItemId,\s*reloadProfile\);\s*applySkateboardStaticBodyPose\(deltaSeconds,\s*skateboardPoseActive\)/.test(playerSource),
    'Skating should apply the static full-body stance after upper-body overlays every active skating frame'
  );
  assert(
    /this\.input\.isActionPressed\('skate'\)/.test(gameSource)
      && /speedScale:\s*SKATEBOARD_SPEED_MULTIPLIER/.test(gameSource),
    'Game client should use Shift skating input and the shared speed multiplier'
  );
  assert(
    /skateboardOwned:\s*'boolean'/.test(serverSource)
      && /skating:\s*'boolean'/.test(serverSource)
      && /SKATEBOARD_SPEED_MULTIPLIER/.test(serverSource),
    'Server player state should persist skateboard ownership and authorize skating speed'
  );
}

function validatePlayerSchemaFieldBudget() {
  const serverSource = readFileSync(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const playerSchemas = [...serverSource.matchAll(/const (?<name>Player[A-Za-z0-9]*State) = schema\(\{(?<body>[\s\S]*?)\n\}\);/g)]
    .map((match) => ({
      name: match.groups.name,
      fields: [...match.groups.body.matchAll(/^\s+([A-Za-z0-9_]+):/gm)]
        .map((fieldMatch) => fieldMatch[1])
    }));
  const playerState = playerSchemas.find((entry) => entry.name === 'PlayerState');
  assert(playerState, 'WorldRoom should define a PlayerState schema');

  for (const { name, fields } of playerSchemas) {
    assert(fields.length <= 64, `${name} schema should stay at or below 64 fields; found ${fields.length}`);
  }

  const adminIndex = playerState.fields.indexOf('isAdmin');
  assert(adminIndex >= 0 && adminIndex < 64, 'PlayerState isAdmin must be inside the Colyseus schema field budget');
  assert(
    ['transform', 'combat', 'inventory', 'deliveryQuest', 'skills', 'profile'].every((field) => playerState.fields.includes(field)),
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
  validateTaskSequence();
  validateDeliveryQuestCarry();
  validateMissionSequencer();
  validateBartenderFunction();
  validatePlayerSchemaFieldBudget();
  await validateBuildCity();
  console.log('World editor validation passed.');
}

await main();
