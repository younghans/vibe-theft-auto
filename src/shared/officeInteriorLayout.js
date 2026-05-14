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

const OFFICE_INTERIOR_FLOOR_BY_ID = new Map(
  OFFICE_INTERIOR_FLOORS.map((floor) => [floor.id, floor])
);

export const OFFICE_INTERIOR_STATIONS = Object.freeze([
  Object.freeze({
    id: 'janitor-closet',
    type: OFFICE_INTERIOR_STATION_TYPES.job,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.lobby,
    localPosition: [-8.1, -5.65],
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
    localPosition: [-4.85, -5.55],
    radius: 2.8,
    label: 'Break Room Elevator',
    prompt: 'Ride elevator to top floor',
    actionText: 'Rode the elevator to the top-floor meeting room.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    targetLocalPosition: [-5.95, -5.55]
  }),
  Object.freeze({
    id: 'ceo-meeting-table',
    type: OFFICE_INTERIOR_STATION_TYPES.job,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    localPosition: [0, -0.8],
    radius: 4.0,
    label: 'CEO Meeting Table',
    prompt: 'Start CEO shift',
    actionText: 'Stamp memos from the executive meeting table.',
    jobId: OFFICE_JOB_IDS.ceo
  }),
  Object.freeze({
    id: 'elevator-to-cubicles',
    type: OFFICE_INTERIOR_STATION_TYPES.transport,
    floorId: OFFICE_INTERIOR_FLOOR_IDS.ceo,
    localPosition: [-5.95, -5.55],
    radius: 2.8,
    label: 'CEO Elevator',
    prompt: 'Return to cubicles',
    actionText: 'Rode the elevator back to the cubicle floor.',
    targetFloorId: OFFICE_INTERIOR_FLOOR_IDS.cubicles,
    targetLocalPosition: [-4.85, -5.55]
  })
]);

const OFFICE_INTERIOR_STATION_BY_ID = new Map(
  OFFICE_INTERIOR_STATIONS.map((station) => [station.id, station])
);

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

  for (const floor of OFFICE_INTERIOR_FLOORS.slice(1)) {
    const distance = Math.abs(targetHeight - floor.height);
    if (distance < nearestDistance) {
      nearest = floor;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getOfficeInteriorTopHeight() {
  return Math.max(...OFFICE_INTERIOR_FLOORS.map((floor) => floor.height));
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
