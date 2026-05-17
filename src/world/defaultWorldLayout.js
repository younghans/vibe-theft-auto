import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import { rotationRadiansToQuarterTurns as toQuarterTurns } from '../shared/numberMath.js';
import { createDefaultMissionSequence } from '../shared/missions.js';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { COMBAT_PICKUP_PROP_ITEM_IDS } from '../shared/combatPickupDefinitions.js';
import { getBuilderItemById } from './builderCatalog.js';

export const DEFAULT_WORLD_SPAWN = [0, 0, BUILDER_TILE_SIZE * 4.1];

const GRID_RADIUS = 4;
const ROAD_CELLS = new Set();

for (let x = -3; x <= 3; x += 1) {
  ROAD_CELLS.add(`${x},-3`);
  ROAD_CELLS.add(`${x},3`);
  ROAD_CELLS.add(`${x},0`);
}

for (let z = -3; z <= 3; z += 1) {
  ROAD_CELLS.add(`-3,${z}`);
  ROAD_CELLS.add(`3,${z}`);
  ROAD_CELLS.add(`0,${z}`);
}

for (let z = -1; z <= 3; z += 1) {
  ROAD_CELLS.add(`-1,${z}`);
}

for (let z = -3; z <= 1; z += 1) {
  ROAD_CELLS.add(`1,${z}`);
}

const BUILDING_PLANS = [
  { cell: [0, -5], itemId: 'offices_building', angle: 0, label: 'Vibe Offices', action: 'The lobby, cubicles, break room, and CEO floor are open.' },
  { cell: [-4, -4], itemId: 'building_d', angle: Math.PI / 2, label: 'Loan office', action: 'Debt and hustle systems will live here later.' },
  { cell: [-3, -4], itemId: 'real_estate_office_building', angle: 0, label: 'Real Estate Office', action: 'Walk in to meet a broker or use the desks inside.' },
  { cell: [-2, -4], itemId: 'marthas_grille_building', angle: 0, label: "Martha's Grille", action: 'The counter is open, and the kitchen is visible behind the register.' },
  { cell: [2, -4], itemId: 'building_f', angle: 0, label: 'Convenience mart', action: 'Shelves and item pickups are a future pass.' },
  { cell: [4, -4], itemId: 'pawn_building', angle: 0, label: 'Pawn Shop', action: 'The pawn shop owner buys and sells street gear.' },
  { cell: [-4, -2], itemId: 'building_a', angle: Math.PI / 2, label: 'Motel strip', action: 'Room rentals are on the roadmap.' },
  { cell: [4, -2], itemId: 'building_g', angle: -Math.PI / 2, label: 'Arcade block', action: 'The arcade is all atmosphere for now.' },
  { cell: [-4, 2], itemId: 'building_e', angle: Math.PI / 2, label: 'Corner pharmacy', action: 'Health items can plug into this storefront later.' },
  { cell: [4, 2], itemId: 'gym_building', angle: -Math.PI / 2, label: 'Neighborhood gym', action: 'The weight room is finally open for NPC routines.' },
  { cell: [-4, 4], itemId: 'building_g', angle: Math.PI, label: 'Night club', action: 'The club is closed until nightlife systems exist.' },
  { cell: [-2, 4], itemId: 'building_a', angle: Math.PI, label: 'Coffee loft', action: 'A social hub can grow out of this block.' },
  { cell: [2, 4], itemId: 'building_e', angle: Math.PI, label: 'Taxi dispatch', action: 'Taxi missions can route through this office.' },
  { cell: [4, 4], itemId: 'building_b', angle: -Math.PI / 2, label: 'Pool hall', action: 'Mini-games can anchor this corner later.' },
  { cell: [2, 2], itemId: 'building_h', angle: Math.PI, label: 'Downtown apartments', action: 'Interiors will open up in a later milestone.' },
  { cell: [-2, -2], itemId: 'building_c', angle: 0, label: 'Quick cash loans', action: 'This slot is ready for shady finance interactions.' }
];

const DISTRICT_PROPS = [
  { itemId: 'crate_a', position: [-2.4 * BUILDER_TILE_SIZE, 1.8 * BUILDER_TILE_SIZE], angle: Math.PI / 4 },
  { itemId: 'crate_b', position: [-1.0 * BUILDER_TILE_SIZE, 2.4 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'bench', position: [-2.0 * BUILDER_TILE_SIZE, 0.5 * BUILDER_TILE_SIZE], angle: Math.PI / 2 },
  { itemId: 'bench', position: [-0.7 * BUILDER_TILE_SIZE, 1.0 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'bush', position: [2.1 * BUILDER_TILE_SIZE, -1.85 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'bush', position: [1.0 * BUILDER_TILE_SIZE, -2.45 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'bush', position: [2.55 * BUILDER_TILE_SIZE, -0.8 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'bench', position: [1.7 * BUILDER_TILE_SIZE, -1.1 * BUILDER_TILE_SIZE], angle: -Math.PI / 3 },
  { itemId: 'hydrant', position: [0.55 * BUILDER_TILE_SIZE, -1.2 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'standing_desk_computer', position: [-2.3 * BUILDER_TILE_SIZE, -1.15 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'blackjack_table', position: [2.05 * BUILDER_TILE_SIZE, 1.18 * BUILDER_TILE_SIZE], angle: Math.PI },
  { itemId: 'olympic_barbell', position: [3.85 * BUILDER_TILE_SIZE, 2.35 * BUILDER_TILE_SIZE], angle: 0 }
];

const STREET_PROPS = [
  { itemId: 'car_taxi', position: [-3.55 * BUILDER_TILE_SIZE, -1.7 * BUILDER_TILE_SIZE], angle: Math.PI / 2 },
  { itemId: 'car_sedan', position: [-3.55 * BUILDER_TILE_SIZE, 1.8 * BUILDER_TILE_SIZE], angle: Math.PI / 2 },
  { itemId: 'car_sedan', position: [3.55 * BUILDER_TILE_SIZE, -1.8 * BUILDER_TILE_SIZE], angle: -Math.PI / 2 },
  { itemId: 'car_taxi', position: [3.55 * BUILDER_TILE_SIZE, 1.7 * BUILDER_TILE_SIZE], angle: -Math.PI / 2 },
  { itemId: 'car_sedan', position: [-1.75 * BUILDER_TILE_SIZE, -3.55 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'car_taxi', position: [1.75 * BUILDER_TILE_SIZE, 3.55 * BUILDER_TILE_SIZE], angle: Math.PI },
  { itemId: 'tower', position: [4.1 * BUILDER_TILE_SIZE, -0.4 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'dumpster', position: [-4.15 * BUILDER_TILE_SIZE, -0.85 * BUILDER_TILE_SIZE], angle: Math.PI / 5 },
  { itemId: 'dumpster', position: [4.0 * BUILDER_TILE_SIZE, 0.9 * BUILDER_TILE_SIZE], angle: -Math.PI / 6 },
  { itemId: 'bench', position: [-2.15 * BUILDER_TILE_SIZE, 2.75 * BUILDER_TILE_SIZE], angle: Math.PI / 2 },
  { itemId: 'bench', position: [2.2 * BUILDER_TILE_SIZE, -2.75 * BUILDER_TILE_SIZE], angle: -Math.PI / 4 },
  { itemId: 'hydrant', position: [-0.55 * BUILDER_TILE_SIZE, -3.45 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: 'hydrant', position: [0.55 * BUILDER_TILE_SIZE, 3.45 * BUILDER_TILE_SIZE], angle: 0 }
];

const LIGHT_POSITIONS = [
  [-3.35, -3.35], [-0.35, -3.35], [3.35, -3.35],
  [-3.35, 0.35], [3.35, 0.35],
  [-3.35, 3.35], [-0.35, 3.35], [3.35, 3.35],
  [-1.35, 1.35], [1.35, -1.35]
];

const SIGNAL_CELLS = [
  [-3, 0, 0],
  [3, 0, Math.PI],
  [0, -3, Math.PI / 2],
  [0, 3, -Math.PI / 2],
  [-1, 0, Math.PI],
  [1, 0, 0]
];

const PERIMETER_BUSHES = [
  [-4.6, -4.4], [-3.7, -4.7], [4.4, -4.5], [4.8, -3.4],
  [-4.7, 4.3], [-3.4, 4.75], [4.45, 4.55], [3.35, 4.8]
];

const PICKUP_PROPS = [
  { itemId: COMBAT_PICKUP_PROP_ITEM_IDS.pistol, position: [-2.2 * BUILDER_TILE_SIZE, -0.6 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: COMBAT_PICKUP_PROP_ITEM_IDS.pistol, position: [2.2 * BUILDER_TILE_SIZE, 0.6 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: COMBAT_PICKUP_PROP_ITEM_IDS.pistol, position: [0, -2.2 * BUILDER_TILE_SIZE], angle: 0 },
  { itemId: COMBAT_PICKUP_PROP_ITEM_IDS.pistol, position: [0, 2.2 * BUILDER_TILE_SIZE], angle: 0 }
];

const NPC_PLANS = [
  {
    id: 'npc_shady_figure',
    modelId: 'maynard',
    position: [-1.35 * BUILDER_TILE_SIZE, -1.65 * BUILDER_TILE_SIZE],
    angle: Math.PI / 2,
    name: 'Shady Figure',
    prompt: 'You are Shady Figure, a quiet fixer working the edge of the quick cash block. Keep answers short, wary, and transactional. You offer small delivery work without explaining too much.',
    interactRadius: 5.2,
    deliveryQuestEnabled: true
  },
  {
    id: 'npc_bruno',
    modelId: 'brute',
    position: [2.65 * BUILDER_TILE_SIZE, 2.85 * BUILDER_TILE_SIZE],
    angle: Math.PI,
    name: 'Bruno',
    prompt: 'You are Bruno, a broad-shouldered neighborhood regular who treats the gym like a second home. Speak like a streetwise local, keep answers short, and steer people toward training, discipline, and city gossip.',
    interactRadius: 4.8,
    routineKey: 'brunoGymLoop',
    combat: {
        archetype: 'hostile',
      aggroRadius: 14,
      leashRadius: 22,
      weaponId: ''
    }
  },
  {
    id: 'npc_maya',
    modelId: 'ch18NonPbr',
    position: [1.3 * BUILDER_TILE_SIZE, -2.05 * BUILDER_TILE_SIZE],
    angle: Math.PI,
    name: 'Maya',
    prompt: 'You are Maya, a quick-thinking hustler who knows every rumor in town. Be playful, observant, and a little sarcastic, but stay helpful.',
    interactRadius: 4.4
  },
  {
    id: 'npc_martha',
    modelId: 'martha',
    position: [-2.05 * BUILDER_TILE_SIZE, -3.98 * BUILDER_TILE_SIZE],
    angle: 0,
    name: 'Martha',
    prompt: "You are Martha, the warm owner of Martha's Grille. You sell burgers for $20, glizzies for $10, and soda for $10. Greet people with a huge smile and keep answers short, kind, and food-focused.",
    interactRadius: 5.6,
    marthaEnabled: true
  },
  {
    id: 'npc_sketch',
    modelId: 'xBot',
    position: [2.35 * BUILDER_TILE_SIZE, 1.5 * BUILDER_TILE_SIZE],
    angle: -Math.PI / 2,
    name: 'Sketch',
    prompt: 'You are Sketch, an eccentric prototype android who narrates the city like it is an unfinished game level. You are curious, earnest, and lightly comedic.',
    interactRadius: 5.2,
    blackjackDealerEnabled: true
  },
  {
    id: 'npc_professor_byte',
    modelId: 'martha',
    position: [-0.4 * BUILDER_TILE_SIZE, -2.2 * BUILDER_TILE_SIZE],
    angle: 0,
    name: 'Professor Byte',
    prompt: 'You are Professor Byte, a sharp school teacher who runs fast classroom challenges. Keep answers short, witty, and focused on school microgames.',
    interactRadius: 5.4,
    schoolMicrogameEnabled: true,
    schoolMicrogameId: 'all'
  },
  {
    id: 'npc_roth',
    modelId: 'maynard',
    position: [4.5 * BUILDER_TILE_SIZE, -4.0 * BUILDER_TILE_SIZE],
    angle: 0,
    name: 'Roth',
    prompt: 'You are Roth, the pawn shop owner in Vibe Theft Auto. Keep answers short, guarded, and transactional. You sell cigarettes for twenty bucks and pistols for fifty.',
    interactRadius: 5.4,
    pawnShopOwnerEnabled: true
  }
];

function key(x, z) {
  return `${x},${z}`;
}

function hasRoad(x, z) {
  return ROAD_CELLS.has(key(x, z));
}

function createRoadTile(x, z) {
  const north = hasRoad(x, z - 1);
  const east = hasRoad(x + 1, z);
  const south = hasRoad(x, z + 1);
  const west = hasRoad(x - 1, z);
  const count = [north, east, south, west].filter(Boolean).length;

  if (count === 4) {
    return { itemId: 'road_cross', rotationQuarterTurns: 0 };
  }

  if (count === 3) {
    if (!south) return { itemId: 'road_tsplit', rotationQuarterTurns: 0 };
    if (!west) return { itemId: 'road_tsplit', rotationQuarterTurns: 1 };
    if (!north) return { itemId: 'road_tsplit', rotationQuarterTurns: 2 };
    return { itemId: 'road_tsplit', rotationQuarterTurns: 3 };
  }

  if (count === 2 && ((north && south) || (east && west))) {
    return { itemId: 'road_straight', rotationQuarterTurns: north && south ? 0 : 1 };
  }

  if (count === 2) {
    if (north && east) return { itemId: 'road_corner', rotationQuarterTurns: 0 };
    if (east && south) return { itemId: 'road_corner', rotationQuarterTurns: 1 };
    if (south && west) return { itemId: 'road_corner', rotationQuarterTurns: 2 };
    return { itemId: 'road_corner', rotationQuarterTurns: 3 };
  }

  return { itemId: 'road_junction', rotationQuarterTurns: 0 };
}

function createTileLayout() {
  const tiles = new Map();
  let tileSequence = 0;

  for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z += 1) {
    for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x += 1) {
      if (hasRoad(x, z)) {
        const roadTile = createRoadTile(x, z);
        tiles.set(key(x, z), {
          id: `placement_${++tileSequence}`,
          itemId: roadTile.itemId,
          cell: [x, z],
          rotationQuarterTurns: roadTile.rotationQuarterTurns
        });
      } else {
        tiles.set(key(x, z), {
          id: `placement_${++tileSequence}`,
          itemId: 'lot_base',
          cell: [x, z],
          rotationQuarterTurns: 0
        });
      }
    }
  }

  for (const plan of BUILDING_PLANS) {
    const item = getBuilderItemById(plan.itemId);
    const rotationQuarterTurns = toQuarterTurns(plan.angle);
    if (item) {
      for (const occupiedCell of getTileOccupiedCells(item, plan.cell[0], plan.cell[1], rotationQuarterTurns)) {
        tiles.delete(key(occupiedCell.x, occupiedCell.z));
      }
    }

    tiles.set(key(plan.cell[0], plan.cell[1]), {
      id: `placement_${++tileSequence}`,
      itemId: plan.itemId,
      cell: [...plan.cell],
      rotationQuarterTurns,
      interactable: {
        label: plan.label,
        actionText: plan.action,
        radius: 4,
        distance: BUILDER_TILE_SIZE * 0.44
      }
    });
  }

  return [...tiles.values()];
}

function createPropLayout() {
  const props = [];
  let propSequence = 95;

  const pushProp = (itemId, position, angle = 0) => {
    props.push({
      id: `placement_${++propSequence}`,
      itemId,
      position: [...position],
      rotationQuarterTurns: toQuarterTurns(angle)
    });
  };

  for (const plan of DISTRICT_PROPS) {
    pushProp(plan.itemId, plan.position, plan.angle);
  }

  for (const plan of STREET_PROPS) {
    pushProp(plan.itemId, plan.position, plan.angle);
  }

  for (const [x, z] of LIGHT_POSITIONS) {
    pushProp('streetlight', [x * BUILDER_TILE_SIZE, z * BUILDER_TILE_SIZE], 0);
  }

  for (const [x, z, angle] of SIGNAL_CELLS) {
    pushProp(
      'traffic_light',
      [x * BUILDER_TILE_SIZE + BUILDER_TILE_SIZE * 0.34, z * BUILDER_TILE_SIZE - BUILDER_TILE_SIZE * 0.34],
      angle
    );
  }

  for (const [x, z] of PERIMETER_BUSHES) {
    pushProp('bush', [x * BUILDER_TILE_SIZE * 0.9, z * BUILDER_TILE_SIZE * 0.9], 0);
  }

  for (const plan of PICKUP_PROPS) {
    pushProp(plan.itemId, plan.position, plan.angle);
  }

  return props;
}

function findTilePlacementIdByCell(tiles, [cellX, cellZ]) {
  return tiles.find((tile) => tile.cell?.[0] === cellX && tile.cell?.[1] === cellZ)?.id ?? '';
}

function findPropPlacementId(props, itemId) {
  return props.find((prop) => prop.itemId === itemId)?.id ?? '';
}

function buildNpcRoutine(plan, references) {
  if (plan.routineKey !== 'brunoGymLoop') {
    return undefined;
  }

  return {
    mode: 'loop',
    resumePolicy: 'resume-step',
    steps: [
      { type: 'travelToPlacement', targetPlacementId: references.barbellId },
      { type: 'usePlacement', targetPlacementId: references.barbellId, durationMs: 5435 },
      { type: 'loiterNearPlacement', targetPlacementId: references.gymId, durationMs: 3600, radius: 4.5 },
      { type: 'enterHideAtPlacement', targetPlacementId: references.apartmentId, hiddenDurationMs: 6500 },
      { type: 'wanderNearPlacement', targetPlacementId: references.gymId, durationMs: 5200, radius: 8 }
    ].filter((step) => step.targetPlacementId)
  };
}

function createNpcLayout(tiles, props) {
  const references = {
    apartmentId: findTilePlacementIdByCell(tiles, [2, 2]),
    gymId: findTilePlacementIdByCell(tiles, [4, 2]),
    barbellId: findPropPlacementId(props, 'olympic_barbell')
  };

  return NPC_PLANS.map((plan) => ({
    id: plan.id,
    modelId: plan.modelId,
    position: [...plan.position],
    rotationQuarterTurns: toQuarterTurns(plan.angle),
    name: plan.name,
    prompt: plan.prompt,
    interactRadius: plan.interactRadius,
    deliveryQuestEnabled: plan.deliveryQuestEnabled === true,
    gymCheckInEnabled: plan.gymCheckInEnabled === true,
    rentCollectorEnabled: plan.rentCollectorEnabled === true,
    stockMarketEnabled: plan.stockMarketEnabled === true,
    bartenderEnabled: plan.bartenderEnabled === true,
    pawnShopOwnerEnabled: plan.pawnShopOwnerEnabled === true,
    marthaEnabled: plan.marthaEnabled === true,
    blackjackDealerEnabled: plan.blackjackDealerEnabled === true,
    schoolMicrogameEnabled: plan.schoolMicrogameEnabled === true,
    schoolMicrogameId: plan.schoolMicrogameId ?? 'all',
    ...(plan.combat ? { combat: plan.combat } : {}),
    ...(buildNpcRoutine(plan, references) ? { routine: buildNpcRoutine(plan, references) } : {})
  }));
}

const defaultTiles = createTileLayout();
const defaultProps = createPropLayout();
const defaultNpcs = createNpcLayout(defaultTiles, defaultProps);

export const defaultWorldLayout = Object.freeze({
  tiles: defaultTiles,
  props: defaultProps,
  npcs: defaultNpcs,
  missionSequence: createDefaultMissionSequence()
});
