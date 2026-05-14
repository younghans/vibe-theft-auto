import * as THREE from 'three';
import {
  createOlympicBarbellVisual
} from './proceduralProps.js';
import {
  OFFICE_INTERIOR_ID,
  OFFICE_INTERIOR_STATION_TYPES,
  getNearestOfficeInteriorFloorDefinition,
  getOfficeInteriorFloorHeight,
  getOfficeInteriorTopHeight,
  listOfficeInteriorStations,
  makeOfficeInteriorStationPlacementId
} from '../shared/officeInteriorLayout.js';
import { normalizeRotationQuarterTurns } from '../shared/numberMath.js';
import { rotateFootprintOffset as rotateLocalOffset } from '../shared/tileFootprint.js';

const INTERIOR_WORLD_ORIGIN = Object.freeze([1000, 0, 1000]);
const INLINE_SHELL_TRIGGER_DEPTH = 4.4;
const INLINE_SHELL_TRIGGER_WIDTH_PADDING = 0.8;

function createDistrictInteriorTemplate(id, label, palette) {
  return {
    id,
    label,
    floorSize: [22, 22],
    wallHeight: 12,
    wallThickness: 0.9,
    doorwayWidth: 5.8,
    spawnOffset: [0, 5.9],
    exitOffset: [0, 8.2],
    boundsPadding: 1.25,
    workoutStations: Object.freeze([]),
    palette: Object.freeze(palette)
  };
}

const INTERIOR_TEMPLATES = Object.freeze([
  {
    id: 'gym_large_blank',
    label: 'Fitness Gym',
    floorSize: [22, 22],
    wallHeight: 12,
    wallThickness: 0.9,
    doorwayWidth: 5.2,
    spawnOffset: [0, 5.9],
    exitOffset: [0, 8.2],
    boundsPadding: 1.25,
    workoutStations: Object.freeze([
      {
        id: 'snatch_platform',
        type: 'snatch',
        platformSize: [7.2, 3.6],
        platformPosition: [0, -1.15],
        barbellPosition: [0, -1.15],
        approachPosition: [0, 1.2],
        approachRotationY: Math.PI
      }
    ]),
    palette: Object.freeze({
      floor: 0x50565d,
      wall: 0xd8d5ce,
      trim: 0x9e988f
    })
  },
  createDistrictInteriorTemplate('school_interior', 'School', {
    floor: 0x66766f,
    wall: 0xd9ded4,
    trim: 0xa7a091
  }),
  createDistrictInteriorTemplate('bar_interior', 'Bar', {
    floor: 0x58483a,
    wall: 0xc6ad87,
    trim: 0x7a5531
  }),
  createDistrictInteriorTemplate('bank_interior', 'Bank', {
    floor: 0x74756f,
    wall: 0xd8d4c8,
    trim: 0x9a9a92
  }),
  createDistrictInteriorTemplate('casino_interior', 'Casino', {
    floor: 0x463d50,
    wall: 0x8f3942,
    trim: 0xd2aa44
  }),
  {
    ...createDistrictInteriorTemplate(OFFICE_INTERIOR_ID, 'Offices', {
      floor: 0x5d666c,
      wall: 0xc8d0d5,
      trim: 0x66727a
    }),
    wallHeight: getOfficeInteriorTopHeight() + 7.2
  }
]);

const TEMPLATE_BY_ID = new Map(INTERIOR_TEMPLATES.map((template) => [template.id, template]));

function transformLocalPoint(origin, rotationQuarterTurns, x, y, z) {
  const rotated = rotateLocalOffset(x, z, rotationQuarterTurns);
  return new THREE.Vector3(
    (origin?.[0] ?? 0) + rotated.x,
    (origin?.[1] ?? 0) + y,
    (origin?.[2] ?? 0) + rotated.z
  );
}

function createWallSegment(width, depth, height, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.02
    })
  );
}

function createInteriorMaterial(color, roughness = 0.94, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function createInteriorBox(size, position, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createInteriorCylinder(radiusTop, radiusBottom, height, segments, position, material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createOfficeChairVisual(materials, floorY, x, z, rotationY = 0) {
  const chair = new THREE.Group();
  chair.position.set(x, floorY, z);
  chair.rotation.y = rotationY;
  chair.add(createInteriorBox([0.78, 0.14, 0.74], [0, 0.55, 0], materials.chair));
  chair.add(createInteriorBox([0.78, 0.86, 0.12], [0, 1.0, -0.34], materials.chair));
  for (const [legX, legZ] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.24], [0.28, 0.24]]) {
    chair.add(createInteriorBox([0.08, 0.5, 0.08], [legX, 0.26, legZ], materials.metal));
  }
  return chair;
}

function createOfficeCubicleVisual(materials, floorY, x, z, rotationY = 0) {
  const cubicle = new THREE.Group();
  cubicle.position.set(x, floorY, z);
  cubicle.rotation.y = rotationY;
  cubicle.add(createInteriorBox([2.6, 0.16, 1.08], [0, 0.92, 0], materials.wood));
  cubicle.add(createInteriorBox([2.82, 1.36, 0.12], [0, 1.2, -0.76], materials.partition));
  cubicle.add(createInteriorBox([0.12, 1.36, 1.64], [-1.46, 1.2, 0], materials.partition));
  cubicle.add(createInteriorBox([0.74, 0.46, 0.08], [-0.52, 1.24, 0.58], materials.screen));
  cubicle.add(createInteriorBox([0.18, 0.28, 0.14], [-0.52, 0.92, 0.5], materials.metalDark));
  cubicle.add(createInteriorBox([0.7, 0.1, 0.48], [0.76, 0.54, 0.9], materials.chair));
  cubicle.add(createInteriorBox([0.7, 0.8, 0.1], [0.76, 0.98, 1.16], materials.chair));
  return cubicle;
}

function addOfficeFloorVisual(group, materials, floorY, {
  width = 20.4,
  depth = 18.6,
  centerZ = 0.35,
  material = materials.floor
} = {}) {
  group.add(createInteriorBox([width, 0.16, depth], [0, floorY - 0.08, centerZ], material));
  group.add(createInteriorBox([width - 0.9, 0.035, 0.18], [0, floorY + 0.015, centerZ - 5.8], materials.floorStripe));
  group.add(createInteriorBox([width - 0.9, 0.035, 0.18], [0, floorY + 0.015, centerZ], materials.floorStripe));
  group.add(createInteriorBox([width - 0.9, 0.035, 0.18], [0, floorY + 0.015, centerZ + 5.8], materials.floorStripe));
}

function addOfficeElevatorVisual(group, materials, floorY, x, z, rotationY = 0) {
  const elevator = new THREE.Group();
  elevator.position.set(x, 0, z);
  elevator.rotation.y = rotationY;
  elevator.add(createInteriorBox([2.7, 3.3, 0.22], [0, floorY + 1.78, 0], materials.metalDark));
  elevator.add(createInteriorBox([1.16, 2.72, 0.1], [-0.6, floorY + 1.54, 0.16], materials.metal));
  elevator.add(createInteriorBox([1.16, 2.72, 0.1], [0.6, floorY + 1.54, 0.16], materials.metal));
  elevator.add(createInteriorBox([0.08, 2.76, 0.14], [0, floorY + 1.54, 0.22], materials.trimDark));
  elevator.add(createInteriorBox([0.28, 0.72, 0.12], [1.72, floorY + 1.55, 0.2], materials.sign));
  elevator.add(createInteriorCylinder(0.08, 0.08, 0.04, 12, [1.72, floorY + 1.72, 0.28], materials.gold));
  elevator.add(createInteriorCylinder(0.08, 0.08, 0.04, 12, [1.72, floorY + 1.42, 0.28], materials.glass));
  group.add(elevator);
}

function addOfficeStairsVisual(group, materials, floorY, x, z, rotationY = 0) {
  const stairs = new THREE.Group();
  stairs.position.set(x, 0, z);
  stairs.rotation.y = rotationY;
  for (let step = 0; step < 8; step += 1) {
    stairs.add(createInteriorBox(
      [3.2, 0.18, 0.55],
      [0, floorY + 0.12 + (step * 0.16), step * 0.46],
      step % 2 === 0 ? materials.trimDark : materials.metalDark
    ));
  }
  stairs.add(createInteriorBox([0.12, 1.65, 4.2], [-1.76, floorY + 0.9, 1.62], materials.metalDark));
  stairs.add(createInteriorBox([0.12, 1.65, 4.2], [1.76, floorY + 0.9, 1.62], materials.metalDark));
  group.add(stairs);
}

function addOfficeLobbyVisuals(group, materials) {
  const floorY = getOfficeInteriorFloorHeight('lobby');
  addOfficeFloorVisual(group, materials, floorY);
  for (const [x, z, rotationY] of [
    [-3.2, 4.7, Math.PI],
    [-1.25, 4.7, Math.PI],
    [1.25, 4.7, Math.PI],
    [3.2, 4.7, Math.PI],
    [-4.35, 1.8, Math.PI * 0.5],
    [4.35, 1.8, -Math.PI * 0.5]
  ]) {
    group.add(createOfficeChairVisual(materials, floorY, x, z, rotationY));
  }

  group.add(createInteriorBox([5.8, 0.2, 1.25], [0, floorY + 0.82, 7.05], materials.wood));
  group.add(createInteriorBox([4.8, 2.8, 0.16], [-7.35, floorY + 1.55, -9.05], materials.partition));
  group.add(createInteriorBox([0.16, 2.8, 4.3], [-9.72, floorY + 1.55, -6.9], materials.partition));
  group.add(createInteriorBox([0.16, 2.8, 4.3], [-4.98, floorY + 1.55, -6.9], materials.partition));
  group.add(createInteriorBox([1.46, 2.35, 0.12], [-7.35, floorY + 1.42, -4.62], materials.door));
  group.add(createInteriorBox([3.35, 0.12, 0.58], [-7.35, floorY + 1.55, -8.55], materials.metalDark));
  group.add(createInteriorCylinder(0.06, 0.06, 2.35, 8, [-8.75, floorY + 1.45, -5.72], materials.wood));
  group.add(createInteriorCylinder(0.24, 0.34, 0.44, 10, [-8.95, floorY + 0.34, -5.42], materials.green));
  addOfficeStairsVisual(group, materials, floorY, 7.35, -6.95, 0);
}

function addOfficeCubicleFloorVisuals(group, materials) {
  const floorY = getOfficeInteriorFloorHeight('cubicles');
  addOfficeFloorVisual(group, materials, floorY);
  for (const [x, z, rotationY] of [
    [-1.6, -3.35, 0],
    [2.6, -3.35, 0],
    [6.45, -1.15, Math.PI * 0.5],
    [-1.6, 0.4, Math.PI],
    [2.6, 0.4, Math.PI],
    [-5.1, 4.35, Math.PI],
    [-1.0, 4.35, Math.PI],
    [3.1, 4.35, Math.PI],
    [6.7, 4.15, -Math.PI * 0.5]
  ]) {
    group.add(createOfficeCubicleVisual(materials, floorY, x, z, rotationY));
  }

  group.add(createInteriorBox([5.4, 2.5, 0.14], [-7.25, floorY + 1.52, -8.98], materials.partition));
  group.add(createInteriorBox([0.14, 2.5, 5.5], [-9.78, floorY + 1.52, -6.2], materials.partition));
  group.add(createInteriorBox([3.4, 0.22, 0.92], [-7.45, floorY + 1.22, -7.86], materials.wood));
  group.add(createInteriorBox([1.1, 2.45, 0.88], [-9.0, floorY + 1.34, -7.82], materials.metal));
  group.add(createInteriorBox([0.82, 1.1, 0.64], [-6.46, floorY + 1.78, -7.62], materials.screen));
  group.add(createInteriorCylinder(0.24, 0.28, 0.46, 14, [-5.8, floorY + 1.55, -7.46], materials.gold));
  addOfficeElevatorVisual(group, materials, floorY, -8.55, -3.25, Math.PI);
  addOfficeStairsVisual(group, materials, floorY, 7.05, -4.55, Math.PI);
}

function addOfficeCeoFloorVisuals(group, materials) {
  const floorY = getOfficeInteriorFloorHeight('ceo');
  addOfficeFloorVisual(group, materials, floorY, {
    width: 15.8,
    depth: 10.2,
    centerZ: -2.75,
    material: materials.floorAccent
  });
  group.add(createInteriorBox([9.4, 0.05, 4.7], [0, floorY + 0.04, -0.8], materials.accentDark));
  group.add(createInteriorBox([8.0, 0.24, 2.3], [0, floorY + 1.02, -0.8], materials.wood));
  group.add(createInteriorBox([7.5, 0.08, 1.84], [0, floorY + 1.18, -0.8], materials.woodDark));
  for (const [x, z, rotationY] of [
    [-3.2, -2.72, 0],
    [-1.05, -2.72, 0],
    [1.05, -2.72, 0],
    [3.2, -2.72, 0],
    [-3.2, 1.12, Math.PI],
    [-1.05, 1.12, Math.PI],
    [1.05, 1.12, Math.PI],
    [3.2, 1.12, Math.PI]
  ]) {
    group.add(createOfficeChairVisual(materials, floorY, x, z, rotationY));
  }
  group.add(createInteriorBox([10.4, 0.12, 0.18], [0, floorY + 3.35, -7.34], materials.gold));
  group.add(createInteriorCylinder(0.62, 0.62, 1.7, 12, [6.2, floorY + 1.18, -5.9], materials.green));
  addOfficeElevatorVisual(group, materials, floorY, -8.1, -4.45, Math.PI * 0.5);
}

function addOfficeInteriorVisuals(group) {
  const materials = {
    floor: createInteriorMaterial(0x5d666c),
    floorStripe: createInteriorMaterial(0x68737a),
    floorAccent: createInteriorMaterial(0x525a60),
    partition: createInteriorMaterial(0xaeb8be),
    trimDark: createInteriorMaterial(0x66727a),
    metal: createInteriorMaterial(0xc4ccd2, 0.84, 0.18),
    metalDark: createInteriorMaterial(0x59636b, 0.86, 0.16),
    wood: createInteriorMaterial(0xa97948),
    woodDark: createInteriorMaterial(0x68452b),
    chair: createInteriorMaterial(0x415565),
    screen: createInteriorMaterial(0x253542, 0.76, 0.08),
    glass: createInteriorMaterial(0xb7dce8, 0.62, 0.02),
    sign: createInteriorMaterial(0x263746),
    door: createInteriorMaterial(0x27313a),
    gold: createInteriorMaterial(0xd2aa44, 0.58, 0.18),
    green: createInteriorMaterial(0x5e8d58),
    accentDark: createInteriorMaterial(0x355a78)
  };

  addOfficeLobbyVisuals(group, materials);
  addOfficeCubicleFloorVisuals(group, materials);
  addOfficeCeoFloorVisuals(group, materials);
}

function createWorkoutPlatform(width, depth) {
  const platform = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.2, depth),
    new THREE.MeshStandardMaterial({
      color: 0x2a2c30,
      roughness: 0.94,
      metalness: 0.02
    })
  );
  base.position.y = 0.1;
  base.receiveShadow = true;
  platform.add(base);

  const woodStrip = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.32, 0.04, depth * 0.92),
    new THREE.MeshStandardMaterial({
      color: 0xa67c52,
      roughness: 0.88,
      metalness: 0.04
    })
  );
  woodStrip.position.y = 0.22;
  woodStrip.receiveShadow = true;
  platform.add(woodStrip);

  return platform;
}

function createColliderFromLocalRect(
  origin,
  rotationQuarterTurns,
  centerX,
  centerZ,
  halfWidth,
  halfDepth,
  minY = 0,
  maxY = 14
) {
  const rotatedCenter = rotateLocalOffset(centerX, centerZ, rotationQuarterTurns);
  const swapDimensions = Math.abs(normalizeRotationQuarterTurns(rotationQuarterTurns) % 2) === 1;
  const worldHalfWidth = swapDimensions ? halfDepth : halfWidth;
  const worldHalfDepth = swapDimensions ? halfWidth : halfDepth;
  const worldCenterX = (origin?.[0] ?? 0) + rotatedCenter.x;
  const worldCenterY = (origin?.[1] ?? 0) + ((minY + maxY) * 0.5);
  const worldCenterZ = (origin?.[2] ?? 0) + rotatedCenter.z;

  return {
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(
        worldCenterX - worldHalfWidth,
        worldCenterY - ((maxY - minY) * 0.5),
        worldCenterZ - worldHalfDepth
      ),
      new THREE.Vector3(
        worldCenterX + worldHalfWidth,
        worldCenterY + ((maxY - minY) * 0.5),
        worldCenterZ + worldHalfDepth
      )
    )
  };
}

function createBoundsFromLocalRect(
  origin,
  rotationQuarterTurns,
  centerX,
  centerZ,
  halfWidth,
  halfDepth,
  minY = -1,
  maxY = 14
) {
  return createColliderFromLocalRect(
    origin,
    rotationQuarterTurns,
    centerX,
    centerZ,
    halfWidth,
    halfDepth,
    minY,
    maxY
  ).box;
}

export function getInteriorTemplateById(id) {
  return TEMPLATE_BY_ID.get(id) ?? null;
}

export function createInteriorScene(interiorId, options = {}) {
  const template = getInteriorTemplateById(interiorId);
  if (!template) {
    return null;
  }

  const {
    origin = INTERIOR_WORLD_ORIGIN,
    rotationQuarterTurns = 0,
    placementId = '',
    visible = true,
    includeExitInteractable = true
  } = options;
  const normalizedRotation = normalizeRotationQuarterTurns(rotationQuarterTurns);
  const [floorWidth, floorDepth] = template.floorSize;
  const halfWidth = floorWidth * 0.5;
  const halfDepth = floorDepth * 0.5;
  const halfDoorway = template.doorwayWidth * 0.5;
  const wallY = template.wallHeight * 0.5;
  const wallThickness = template.wallThickness;
  const southWallZ = halfDepth - (wallThickness * 0.5);
  const northWallZ = -halfDepth + (wallThickness * 0.5);
  const westWallX = -halfWidth + (wallThickness * 0.5);
  const eastWallX = halfWidth - (wallThickness * 0.5);
  const doorwaySegmentWidth = Math.max(0.8, halfWidth - halfDoorway);
  const isOfficeInterior = template.id === OFFICE_INTERIOR_ID;

  const group = new THREE.Group();
  group.name = `InteriorScene_${template.id}`;
  group.position.set(origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0);
  group.rotation.y = normalizedRotation * (Math.PI / 2);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(floorWidth, 0.25, floorDepth),
    new THREE.MeshStandardMaterial({
      color: template.palette.floor,
      roughness: 1
    })
  );
  floor.position.set(0, -0.125, 0);
  floor.receiveShadow = true;
  if (!isOfficeInterior) {
    group.add(floor);
  } else {
    addOfficeInteriorVisuals(group);
  }

  const northWall = createWallSegment(floorWidth, wallThickness, template.wallHeight, template.palette.wall);
  northWall.position.set(0, wallY, northWallZ);
  const westWall = createWallSegment(wallThickness, floorDepth, template.wallHeight, template.palette.wall);
  westWall.position.set(westWallX, wallY, 0);
  const eastWall = createWallSegment(wallThickness, floorDepth, template.wallHeight, template.palette.wall);
  eastWall.position.set(eastWallX, wallY, 0);
  const southWallLeft = createWallSegment(
    doorwaySegmentWidth,
    wallThickness,
    template.wallHeight,
    template.palette.wall
  );
  southWallLeft.position.set(-((halfWidth + halfDoorway) * 0.5), wallY, southWallZ);
  const southWallRight = createWallSegment(
    doorwaySegmentWidth,
    wallThickness,
    template.wallHeight,
    template.palette.wall
  );
  southWallRight.position.set(((halfWidth + halfDoorway) * 0.5), wallY, southWallZ);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(template.doorwayWidth, 0.6, wallThickness),
    new THREE.MeshStandardMaterial({
      color: template.palette.trim,
      roughness: 0.85
    })
  );
  trim.position.set(0, template.wallHeight - 0.4, southWallZ);

  for (const wall of [northWall, westWall, eastWall, southWallLeft, southWallRight, trim]) {
    wall.castShadow = true;
    wall.receiveShadow = true;
    if (!isOfficeInterior) {
      group.add(wall);
    }
  }

  const colliders = [
    createColliderFromLocalRect(origin, normalizedRotation, 0, northWallZ, halfWidth, wallThickness * 0.5, 0, template.wallHeight),
    createColliderFromLocalRect(origin, normalizedRotation, westWallX, 0, wallThickness * 0.5, halfDepth, 0, template.wallHeight),
    createColliderFromLocalRect(origin, normalizedRotation, eastWallX, 0, wallThickness * 0.5, halfDepth, 0, template.wallHeight),
    createColliderFromLocalRect(
      origin,
      normalizedRotation,
      -((halfWidth + halfDoorway) * 0.5),
      southWallZ,
      doorwaySegmentWidth * 0.5,
      wallThickness * 0.5,
      0,
      template.wallHeight
    ),
    createColliderFromLocalRect(
      origin,
      normalizedRotation,
      ((halfWidth + halfDoorway) * 0.5),
      southWallZ,
      doorwaySegmentWidth * 0.5,
      wallThickness * 0.5,
      0,
      template.wallHeight
    )
  ];

  const spawnPoint = transformLocalPoint(
    origin,
    normalizedRotation,
    template.spawnOffset[0] ?? 0,
    0,
    template.spawnOffset[1] ?? 0
  );
  const exitPosition = transformLocalPoint(
    origin,
    normalizedRotation,
    template.exitOffset[0] ?? 0,
    0,
    template.exitOffset[1] ?? 0
  );
  const doorwayThresholdPosition = transformLocalPoint(origin, normalizedRotation, 0, 0, southWallZ);
  const bounds = createBoundsFromLocalRect(
    origin,
    normalizedRotation,
    0,
    0,
    Math.max(0.2, halfWidth - template.boundsPadding),
    Math.max(0.2, halfDepth - template.boundsPadding),
    -1,
    template.wallHeight
  );
  const doorwayTriggerBounds = createBoundsFromLocalRect(
    origin,
    normalizedRotation,
    0,
    southWallZ,
    halfDoorway + INLINE_SHELL_TRIGGER_WIDTH_PADDING,
    INLINE_SHELL_TRIGGER_DEPTH * 0.5,
    -1,
    template.wallHeight
  );
  const interiorInteractables = [];

  for (const station of template.workoutStations ?? []) {
    const platform = createWorkoutPlatform(
      station.platformSize?.[0] ?? 6.8,
      station.platformSize?.[1] ?? 3.4
    );
    platform.position.set(
      station.platformPosition?.[0] ?? 0,
      0,
      station.platformPosition?.[1] ?? 0
    );
    group.add(platform);

    const floorBarbell = createOlympicBarbellVisual();
    floorBarbell.position.set(
      station.barbellPosition?.[0] ?? 0,
      0,
      station.barbellPosition?.[1] ?? 0
    );
    group.add(floorBarbell);

    interiorInteractables.push({
      kind: `${station.type}-workout`,
      stationId: station.id,
      position: transformLocalPoint(
        origin,
        normalizedRotation,
        station.barbellPosition?.[0] ?? 0,
        0,
        station.barbellPosition?.[1] ?? 0
      ),
      radius: 3.6,
      prompt: 'Snatch barbell',
      actionText: 'Step onto the platform and hit a snatch.',
      approachPosition: transformLocalPoint(
        origin,
        normalizedRotation,
        station.approachPosition?.[0] ?? 0,
        0,
        station.approachPosition?.[1] ?? 0
      ),
      approachRotationY: normalizedRotation * (Math.PI / 2) + (station.approachRotationY ?? 0),
      barbellObject: floorBarbell
    });
  }

  if (isOfficeInterior) {
    for (const station of listOfficeInteriorStations()) {
      const localPosition = station.localPosition ?? [0, 0];
      const floorY = getOfficeInteriorFloorHeight(station.floorId);
      const position = transformLocalPoint(
        origin,
        normalizedRotation,
        localPosition[0] ?? 0,
        floorY,
        localPosition[1] ?? 0
      );
      const stationPlacementId = makeOfficeInteriorStationPlacementId(placementId, station.id);
      const baseStationInteractable = {
        kind: station.type === OFFICE_INTERIOR_STATION_TYPES.transport
          ? 'office-floor-transition'
          : 'office-job-station',
        placementId: stationPlacementId,
        buildingPlacementId: placementId,
        officeStationId: station.id,
        officeFloorId: station.floorId,
        officeJobId: station.jobId ?? '',
        position,
        radius: station.radius ?? 3.2,
        label: station.label,
        prompt: station.prompt,
        actionText: station.actionText
      };

      if (station.type === OFFICE_INTERIOR_STATION_TYPES.transport) {
        const targetLocalPosition = station.targetLocalPosition ?? localPosition;
        interiorInteractables.push({
          ...baseStationInteractable,
          targetFloorId: station.targetFloorId,
          targetPosition: transformLocalPoint(
            origin,
            normalizedRotation,
            targetLocalPosition[0] ?? 0,
            getOfficeInteriorFloorHeight(station.targetFloorId),
            targetLocalPosition[1] ?? 0
          )
        });
      } else {
        interiorInteractables.push(baseStationInteractable);
      }
    }
  }

  const scene = {
    id: template.id,
    label: template.label,
    group,
    colliders,
    spawnPoint,
    doorwayThresholdPosition,
    doorwayTriggerBounds,
    bounds,
    interactables: [
      ...interiorInteractables,
      ...(includeExitInteractable
        ? [{
            kind: 'interior-exit',
            position: exitPosition,
            radius: 3.4,
            prompt: `Leave ${template.label}`,
            actionText: 'Step back outside.'
          }]
        : [])
    ],
    getGroundHeightAt(worldPosition = null) {
      if (isOfficeInterior) {
        const relativeY = Number(worldPosition?.y ?? 0) - (origin[1] ?? 0);
        return (origin[1] ?? 0) + getNearestOfficeInteriorFloorDefinition(relativeY).height;
      }

      return origin[1] ?? 0;
    },
    inlineOverlay: isOfficeInterior,
    setVisible(nextVisible) {
      group.visible = Boolean(nextVisible);
    }
  };

  scene.setVisible(visible);
  return scene;
}
