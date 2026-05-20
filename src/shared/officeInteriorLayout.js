import { OFFICE_JOB_IDS } from './officeJobs.js';

export const OFFICE_BUILDING_ITEM_ID = 'offices_building';
export const OFFICE_INTERIOR_ID = 'offices_interior';

export const OFFICE_INTERIOR_STATION_PLACEMENT_PREFIX = 'office-interior';

export const OFFICE_INTERIOR_FLOOR_IDS = Object.freeze({
  lobby: 'lobby',
  cubicles: 'cubicles',
  ceo: 'ceo'
});

export const OFFICE_INTERIOR_STATION_TYPES = Object.freeze({
  job: 'job',
  transport: 'transport'
});

export const OFFICE_INTERIOR_FLOORS = Object.freeze([
  Object.freeze({
    id: OFFICE_INTERIOR_FLOOR_IDS.lobby,
    label: 'Lobby',
    height: 0.76
  }),
  Object.freeze({
    id: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    label: 'Cubicles',
    height: 9.16
  }),
  Object.freeze({
    id: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    label: 'CEO Office',
    height: 47.28
  })
]);

export const OFFICE_INTERIOR_WALL_THICKNESS = 0.46;

export const OFFICE_INTERIOR_FLOOR_LAYOUTS = Object.freeze({
  [OFFICE_INTERIOR_FLOOR_IDS.lobby]: Object.freeze({
    width: 20.4,
    depth: 18.6,
    centerZ: 0.35
  }),
  [OFFICE_INTERIOR_FLOOR_IDS.cubicles]: Object.freeze({
    width: 20.4,
    depth: 18.6,
    centerZ: 0.35
  }),
  [OFFICE_INTERIOR_FLOOR_IDS.ceo]: Object.freeze({
    width: 15.8,
    depth: 10.2,
    centerZ: -2.75
  })
});

export const OFFICE_INTERIOR_ELEVATOR_SIZE = Object.freeze({
  width: 2.9,
  depth: 2.7,
  height: 3.05
});

export const OFFICE_INTERIOR_JANITOR_CLOSET_SIZE = Object.freeze({
  width: 4.35,
  depth: 3.65,
  height: 3.05
});

export const OFFICE_INTERIOR_CEO_MEETING_TABLE = Object.freeze({
  centerX: 0,
  centerZ: -0.95,
  width: 7.0,
  depth: 2.0,
  rugWidth: 8.4,
  rugDepth: 3.9
});

export const OFFICE_INTERIOR_CEO_ROOFTOP_DECK = Object.freeze({
  centerX: 0,
  centerZ: 5.1,
  width: 15.8,
  depth: 5.5,
  railingHeight: 1.12,
  railingThickness: 0.16
});

export const OFFICE_INTERIOR_CEO_GLASS_WALL = Object.freeze({
  centerX: 0,
  centerZ: 2.35,
  width: 14.9,
  depth: 0.16,
  height: 2.72,
  doorWidth: 4.2
});

export const OFFICE_INTERIOR_BREAK_ROOM_RIGHT_WALL = Object.freeze({
  centerX: -4.62,
  centerZ: -6.2,
  width: 0.14,
  depth: 5.5,
  height: 2.5
});

export const OFFICE_INTERIOR_CUBICLE_WORKSTATIONS = Object.freeze([
  Object.freeze({ centerX: -5.35, centerZ: -0.35, rotationY: 0 }),
  Object.freeze({ centerX: -1.15, centerZ: -0.35, rotationY: 0 }),
  Object.freeze({ centerX: 3.05, centerZ: -0.35, rotationY: 0 }),
  Object.freeze({ centerX: -5.35, centerZ: 2.9, rotationY: Math.PI }),
  Object.freeze({ centerX: -1.15, centerZ: 2.9, rotationY: Math.PI }),
  Object.freeze({ centerX: 3.05, centerZ: 2.9, rotationY: Math.PI }),
  Object.freeze({ centerX: -5.35, centerZ: 6.05, rotationY: 0 }),
  Object.freeze({ centerX: -1.15, centerZ: 6.05, rotationY: 0 }),
  Object.freeze({ centerX: 3.05, centerZ: 6.05, rotationY: 0 })
]);

const OFFICE_INTERIOR_ELEVATOR_TOP_WALL_GAP = 0.12;
const OFFICE_INTERIOR_ELEVATOR_DOOR_CLEARANCE = 0.72;
const OFFICE_INTERIOR_ELEVATOR_ARRIVAL_CLEARANCE = 1.78;

const OFFICE_INTERIOR_FLOOR_BY_ID = new Map();
for (let index = 0; index < OFFICE_INTERIOR_FLOORS.length; index += 1) {
  const floor = OFFICE_INTERIOR_FLOORS[index];
  OFFICE_INTERIOR_FLOOR_BY_ID.set(floor.id, floor);
}

export function getOfficeInteriorFloorLayout(floorId = '') {
  return OFFICE_INTERIOR_FLOOR_LAYOUTS[floorId] ?? OFFICE_INTERIOR_FLOOR_LAYOUTS[OFFICE_INTERIOR_FLOOR_IDS.lobby];
}

export function getOfficeInteriorElevatorCenter(floorId = OFFICE_INTERIOR_FLOOR_IDS.cubicles) {
  const layout = getOfficeInteriorFloorLayout(floorId);
  const topWallInnerZ = layout.centerZ - (layout.depth * 0.5) + OFFICE_INTERIOR_WALL_THICKNESS;
  return [
    0,
    topWallInnerZ + (OFFICE_INTERIOR_ELEVATOR_SIZE.depth * 0.5) + OFFICE_INTERIOR_ELEVATOR_TOP_WALL_GAP
  ];
}

export function getOfficeInteriorElevatorDoorPosition(floorId = OFFICE_INTERIOR_FLOOR_IDS.cubicles) {
  const [x, z] = getOfficeInteriorElevatorCenter(floorId);
  return [
    x,
    z + (OFFICE_INTERIOR_ELEVATOR_SIZE.depth * 0.5) + OFFICE_INTERIOR_ELEVATOR_DOOR_CLEARANCE
  ];
}

export function getOfficeInteriorElevatorArrivalPosition(floorId = OFFICE_INTERIOR_FLOOR_IDS.cubicles) {
  const [x, z] = getOfficeInteriorElevatorCenter(floorId);
  return [
    x,
    z + (OFFICE_INTERIOR_ELEVATOR_SIZE.depth * 0.5) + OFFICE_INTERIOR_ELEVATOR_ARRIVAL_CLEARANCE
  ];
}

const OFFICE_CUBICLES_ELEVATOR_DOOR_POSITION = Object.freeze(
  getOfficeInteriorElevatorDoorPosition(OFFICE_INTERIOR_FLOOR_IDS.cubicles)
);
const OFFICE_CEO_ELEVATOR_DOOR_POSITION = Object.freeze(
  getOfficeInteriorElevatorDoorPosition(OFFICE_INTERIOR_FLOOR_IDS.ceo)
);
const OFFICE_CUBICLES_ELEVATOR_ARRIVAL_POSITION = Object.freeze(
  getOfficeInteriorElevatorArrivalPosition(OFFICE_INTERIOR_FLOOR_IDS.cubicles)
);
const OFFICE_CEO_ELEVATOR_ARRIVAL_POSITION = Object.freeze(
  getOfficeInteriorElevatorArrivalPosition(OFFICE_INTERIOR_FLOOR_IDS.ceo)
);

export const OFFICE_INTERIOR_STATIONS = Object.freeze([
  Object.freeze({
    id: 'janitor-closet',
    type: OFFICE_INTERIOR_STATION_TYPES.job,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.lobby,
    localPosition: [-7.55, -5.28],
    radius: 3.0,
    label: 'Janitor Closet',
    prompt: 'Start janitor shift',
    actionText: 'Started janitor work from the closet prop.',
    jobId: OFFICE_JOB_IDS.janitor
  }),
  Object.freeze({
    id: 'stairs-to-cubicles',
    type: OFFICE_INTERIOR_STATION_TYPES.transport,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.lobby,
    localPosition: [7.35, -7.35],
    radius: 3.2,
    label: 'Lobby Staircase',
    prompt: 'Use stairs',
    actionText: 'Went upstairs to the cubicle floor.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    targetLocalPosition: [7.05, -1.45]
  }),
  Object.freeze({
    id: 'stairs-to-lobby',
    type: OFFICE_INTERIOR_STATION_TYPES.transport,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    localPosition: [7.05, -1.45],
    radius: 3.2,
    label: 'Cubicle Staircase',
    prompt: 'Return to lobby',
    actionText: 'Returned to the office lobby.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.lobby,
    targetLocalPosition: [7.35, -7.35]
  }),
  Object.freeze({
    id: 'break-room-coffee',
    type: OFFICE_INTERIOR_STATION_TYPES.job,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    localPosition: [-7.2, -6.35],
    radius: 3.4,
    label: 'Break Room Coffee',
    prompt: 'Start manager shift',
    actionText: 'Brew coffee from the second-floor break room.',
    jobId: OFFICE_JOB_IDS.officeManager
  }),
  Object.freeze({
    id: 'elevator-to-ceo',
    type: OFFICE_INTERIOR_STATION_TYPES.transport,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    localPosition: OFFICE_CUBICLES_ELEVATOR_DOOR_POSITION,
    radius: 3.1,
    label: 'Second-Floor Elevator',
    prompt: 'Ride elevator to top floor',
    actionText: 'Rode the elevator to the top-floor meeting room.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    targetLocalPosition: OFFICE_CEO_ELEVATOR_ARRIVAL_POSITION
  }),
  Object.freeze({
    id: 'ceo-meeting-table',
    type: OFFICE_INTERIOR_STATION_TYPES.job,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    localPosition: [
      OFFICE_INTERIOR_CEO_MEETING_TABLE.centerX,
      OFFICE_INTERIOR_CEO_MEETING_TABLE.centerZ
    ],
    radius: 3.5,
    label: 'CEO Meeting Table',
    prompt: 'Start CEO shift',
    actionText: 'Stamp memos from the executive meeting table.',
    jobId: OFFICE_JOB_IDS.ceo
  }),
  Object.freeze({
    id: 'elevator-to-cubicles',
    type: OFFICE_INTERIOR_STATION_TYPES.transport,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    localPosition: OFFICE_CEO_ELEVATOR_DOOR_POSITION,
    radius: 3.1,
    label: 'CEO Elevator',
    prompt: 'Return to cubicles',
    actionText: 'Rode the elevator back to the cubicle floor.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    targetLocalPosition: OFFICE_CUBICLES_ELEVATOR_ARRIVAL_POSITION
  })
]);

const OFFICE_INTERIOR_STATION_BY_ID = new Map();
for (let index = 0; index < OFFICE_INTERIOR_STATIONS.length; index += 1) {
  const station = OFFICE_INTERIOR_STATIONS[index];
  OFFICE_INTERIOR_STATION_BY_ID.set(station.id, station);
}

export function listOfficeInteriorStations() {
  return OFFICE_INTERIOR_STATIONS;
}

export function getOfficeInteriorFloorDefinition(floorId = '') {
  return OFFICE_INTERIOR_FLOOR_BY_ID.get(String(floorId ?? '').trim()) ?? null;
}

export function getOfficeInteriorFloorHeight(floorId = '') {
  return getOfficeInteriorFloorDefinition(floorId)?.height ?? OFFICE_INTERIOR_FLOORS[0].height;
}

export function getNearestOfficeInteriorFloorDefinition(height = 0) {
  const numericHeight = Number(height);
  const targetHeight = Number.isFinite(numericHeight) ? numericHeight : OFFICE_INTERIOR_FLOORS[0].height;
  let nearest = OFFICE_INTERIOR_FLOORS[0];
  let nearestDistance = Math.abs(targetHeight - nearest.height);

  for (let index = 1; index < OFFICE_INTERIOR_FLOORS.length; index += 1) {
    const floor = OFFICE_INTERIOR_FLOORS[index];
    const distance = Math.abs(targetHeight - floor.height);
    if (distance < nearestDistance) {
      nearest = floor;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getOfficeInteriorTopHeight() {
  let topHeight = OFFICE_INTERIOR_FLOORS[0].height;
  for (let index = 1; index < OFFICE_INTERIOR_FLOORS.length; index += 1) {
    topHeight = Math.max(topHeight, OFFICE_INTERIOR_FLOORS[index].height);
  }
  return topHeight;
}

export function getOfficeInteriorStationDefinition(stationId = '') {
  return OFFICE_INTERIOR_STATION_BY_ID.get(String(stationId ?? '').trim()) ?? null;
}

export function makeOfficeInteriorStationPlacementId(buildingPlacementId = '', stationId = '') {
  const buildingId = String(buildingPlacementId ?? '').trim();
  const normalizedStationId = String(stationId ?? '').trim();
  if (!buildingId || !normalizedStationId) {
    return '';
  }

  return `${OFFICE_INTERIOR_STATION_PLACEMENT_PREFIX}:${buildingId}:${normalizedStationId}`;
}

export function parseOfficeInteriorStationPlacementId(value = '') {
  const parts = String(value ?? '').trim().split(':');
  if (parts.length !== 3 || parts[0] !== OFFICE_INTERIOR_STATION_PLACEMENT_PREFIX) {
    return null;
  }

  const buildingPlacementId = parts[1]?.trim() ?? '';
  const stationId = parts[2]?.trim() ?? '';
  if (!buildingPlacementId || !stationId) {
    return null;
  }

  return {
    buildingPlacementId,
    stationId
  };
}
