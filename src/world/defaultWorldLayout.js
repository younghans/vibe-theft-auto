import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

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
  { cell: [-4, -4], itemId: 'building_d', angle: Math.PI / 2, label: 'Loan office', action: 'Debt and hustle systems will live here later.' },
  { cell: [-2, -4], itemId: 'building_b', angle: 0, label: 'Greasy spoon diner', action: 'The coffee is not implemented yet, but the sign is trying.' },
  { cell: [2, -4], itemId: 'building_f', angle: 0, label: 'Convenience mart', action: 'Shelves and item pickups are a future pass.' },
  { cell: [4, -4], itemId: 'building_h', angle: -Math.PI / 2, label: 'Pawn and trade', action: 'Trading hooks will branch out from this corner.' },
  { cell: [-4, -2], itemId: 'building_a', angle: Math.PI / 2, label: 'Motel strip', action: 'Room rentals are on the roadmap.' },
  { cell: [4, -2], itemId: 'building_g', angle: -Math.PI / 2, label: 'Arcade block', action: 'The arcade is all atmosphere for now.' },
  { cell: [-4, 2], itemId: 'building_e', angle: Math.PI / 2, label: 'Corner pharmacy', action: 'Health items can plug into this storefront later.' },
  { cell: [4, 2], itemId: 'building_c', angle: -Math.PI / 2, label: 'ATM lobby', action: 'The ATM prompt is ready for a money system.' },
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
  { itemId: 'hydrant', position: [0.55 * BUILDER_TILE_SIZE, -1.2 * BUILDER_TILE_SIZE], angle: 0 }
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

const NPC_PLANS = [
  {
    id: 'npc_bruno',
    modelId: 'brute',
    position: [-1.35 * BUILDER_TILE_SIZE, 2.15 * BUILDER_TILE_SIZE],
    angle: 0,
    name: 'Bruno',
    prompt: 'You are Bruno, a broad-shouldered neighborhood bouncer with a surprising soft side. Speak like a streetwise local, keep answers short, and gently point people toward the city nightlife.',
    interactRadius: 4.8
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
    id: 'npc_sketch',
    modelId: 'xBot',
    position: [2.35 * BUILDER_TILE_SIZE, 1.5 * BUILDER_TILE_SIZE],
    angle: -Math.PI / 2,
    name: 'Sketch',
    prompt: 'You are Sketch, an eccentric prototype android who narrates the city like it is an unfinished game level. You are curious, earnest, and lightly comedic.',
    interactRadius: 4.2
  }
];

function key(x, z) {
  return `${x},${z}`;
}

function hasRoad(x, z) {
  return ROAD_CELLS.has(key(x, z));
}

function toQuarterTurns(angle = 0) {
  return ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4;
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
    tiles.set(key(plan.cell[0], plan.cell[1]), {
      id: `placement_${++tileSequence}`,
      itemId: plan.itemId,
      cell: [...plan.cell],
      rotationQuarterTurns: toQuarterTurns(plan.angle),
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

  return props;
}

function createNpcLayout() {
  return NPC_PLANS.map((plan) => ({
    id: plan.id,
    modelId: plan.modelId,
    position: [...plan.position],
    rotationQuarterTurns: toQuarterTurns(plan.angle),
    name: plan.name,
    prompt: plan.prompt,
    interactRadius: plan.interactRadius
  }));
}

export const defaultWorldLayout = Object.freeze({
  tiles: createTileLayout(),
  props: createPropLayout(),
  npcs: createNpcLayout()
});
