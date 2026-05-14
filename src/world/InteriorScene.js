import * as THREE from 'three';
import {
  createOlympicBarbellVisual
} from './proceduralProps.js';
import {
  OFFICE_INTERIOR_ELEVATOR_SIZE,
  OFFICE_INTERIOR_FLOOR_IDS,
  OFFICE_INTERIOR_JANITOR_CLOSET_SIZE,
  OFFICE_INTERIOR_ID,
  OFFICE_INTERIOR_STATION_TYPES,
  OFFICE_INTERIOR_WALL_THICKNESS,
  getOfficeInteriorElevatorCenter,
  getOfficeInteriorFloorLayout,
  getNearestOfficeInteriorFloorDefinition,
  getOfficeInteriorFloorHeight,
  getOfficeInteriorStationDefinition,
  getOfficeInteriorTopHeight,
  listOfficeInteriorStations,
  makeOfficeInteriorStationPlacementId
} from '../shared/officeInteriorLayout.js';
import { normalizeRotationQuarterTurns } from '../shared/numberMath.js';
import { rotateFootprintOffset as rotateLocalOffset } from '../shared/tileFootprint.js';

const INTERIOR_WORLD_ORIGIN = Object.freeze([1000, 0, 1000]);
const INLINE_SHELL_TRIGGER_DEPTH = 4.4;
const INLINE_SHELL_TRIGGER_WIDTH_PADDING = 0.8;
const OFFICE_INACTIVE_FLOOR_OPACITY = 0.08;
const OFFICE_FLOOR_WALL_HEIGHT = 3.25;
const OFFICE_FLOOR_WALL_THICKNESS = OFFICE_INTERIOR_WALL_THICKNESS;
const OFFICE_STAIR_STEP_COUNT = 18;
const OFFICE_STAIR_WIDTH = 3.55;
const OFFICE_STAIR_BOTTOM = Object.freeze({ x: 7.35, z: -7.35 });
const OFFICE_STAIR_TOP = Object.freeze({ x: 7.05, z: -1.75 });
const OFFICE_STAIR_RUN_DEPTH = OFFICE_STAIR_TOP.z - OFFICE_STAIR_BOTTOM.z;
const OFFICE_STAIR_OPENING = Object.freeze({
  centerX: 7.15,
  centerZ: -4.65,
  width: 4.8,
  depth: 5.9
});
const OFFICE_DEFAULT_FLOOR_LAYOUT = getOfficeInteriorFloorLayout(OFFICE_INTERIOR_FLOOR_IDS.lobby);

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

function transformWorldPointToLocal(origin, rotationQuarterTurns, worldPosition = null) {
  const relativeX = Number(worldPosition?.x ?? 0) - (origin?.[0] ?? 0);
  const relativeZ = Number(worldPosition?.z ?? 0) - (origin?.[2] ?? 0);
  return rotateLocalOffset(relativeX, relativeZ, -rotationQuarterTurns);
}

function getOfficeStairProgressAtLocalPosition(localX = 0, localZ = 0) {
  if (
    !Number.isFinite(localX)
    || !Number.isFinite(localZ)
    || localZ < OFFICE_STAIR_BOTTOM.z
    || localZ > OFFICE_STAIR_TOP.z
  ) {
    return null;
  }

  const progress = THREE.MathUtils.clamp(
    (localZ - OFFICE_STAIR_BOTTOM.z) / Math.max(0.001, OFFICE_STAIR_RUN_DEPTH),
    0,
    1
  );
  const centerX = THREE.MathUtils.lerp(OFFICE_STAIR_BOTTOM.x, OFFICE_STAIR_TOP.x, progress);
  if (Math.abs(localX - centerX) > OFFICE_STAIR_WIDTH * 0.5) {
    return null;
  }

  return progress;
}

function getOfficeGroundHeightAtWorldPosition(origin, rotationQuarterTurns, worldPosition = null) {
  const originY = origin?.[1] ?? 0;
  const relativeY = Number(worldPosition?.y ?? 0) - originY;
  const cubicleHeight = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const ceoHeight = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  const local = transformWorldPointToLocal(origin, rotationQuarterTurns, worldPosition);
  const stairProgress = getOfficeStairProgressAtLocalPosition(local.x, local.z);
  if (stairProgress !== null && relativeY < (cubicleHeight + ceoHeight) * 0.5) {
    const lobbyHeight = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby);
    return originY + THREE.MathUtils.lerp(lobbyHeight, cubicleHeight, stairProgress);
  }

  return originY + getNearestOfficeInteriorFloorDefinition(relativeY).height;
}

function resolveOfficeFloorIdAtWorldPosition(origin, rotationQuarterTurns, worldPosition = null) {
  const originY = origin?.[1] ?? 0;
  const relativeY = Number(worldPosition?.y ?? 0) - originY;
  const cubicleHeight = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const ceoHeight = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  const local = transformWorldPointToLocal(origin, rotationQuarterTurns, worldPosition);
  const stairProgress = getOfficeStairProgressAtLocalPosition(local.x, local.z);
  if (stairProgress !== null && relativeY < (cubicleHeight + ceoHeight) * 0.5) {
    return stairProgress < 0.5
      ? OFFICE_INTERIOR_FLOOR_IDS.lobby
      : OFFICE_INTERIOR_FLOOR_IDS.cubicles;
  }

  return getNearestOfficeInteriorFloorDefinition(relativeY).id;
}

function getOfficeStationLocalPosition(stationId = '', fallback = [0, 0]) {
  const station = getOfficeInteriorStationDefinition(stationId);
  return Array.isArray(station?.localPosition) && station.localPosition.length >= 2
    ? station.localPosition
    : fallback;
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

function createOfficeFloorVisualGroup(floorId) {
  const group = new THREE.Group();
  group.name = `office_floor_${floorId}`;
  group.userData.officeFloorId = floorId;
  group.userData.officeFloorVisual = true;
  return group;
}

function createOfficeStairsVisualGroup() {
  const group = new THREE.Group();
  group.name = 'office_stairs_always_opaque';
  group.userData.officeStairsAlwaysOpaque = true;
  return group;
}

function ensureUniqueOpacityMaterials(mesh) {
  if (!mesh?.isMesh || !mesh.material || mesh.userData.officeOpacityMaterialCloned) {
    return;
  }

  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map((material) => material?.clone?.() ?? material)
    : mesh.material.clone?.() ?? mesh.material;
  mesh.userData.officeOpacityMaterialCloned = true;
}

function setOfficeVisualTreeOpacity(root, opacity = 1) {
  const normalizedOpacity = THREE.MathUtils.clamp(Number(opacity) || 0, 0, 1);
  root?.traverse?.((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    ensureUniqueOpacityMaterials(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }
      material.opacity = normalizedOpacity;
      material.transparent = normalizedOpacity < 0.999;
      material.depthWrite = normalizedOpacity >= 0.999;
      material.needsUpdate = true;
    }
  });
}

function setOfficeActiveFloor(officeVisuals = null, floorId = OFFICE_INTERIOR_FLOOR_IDS.lobby) {
  if (!officeVisuals?.floorGroups?.size) {
    return;
  }

  const activeFloorId = officeVisuals.floorGroups.has(floorId)
    ? floorId
    : OFFICE_INTERIOR_FLOOR_IDS.lobby;
  if (officeVisuals.activeFloorId === activeFloorId) {
    return;
  }

  for (const [candidateFloorId, floorGroup] of officeVisuals.floorGroups.entries()) {
    setOfficeVisualTreeOpacity(
      floorGroup,
      candidateFloorId === activeFloorId ? 1 : OFFICE_INACTIVE_FLOOR_OPACITY
    );
  }
  setOfficeVisualTreeOpacity(officeVisuals.stairsGroup, 1);
  officeVisuals.activeFloorId = activeFloorId;
}

function toCutoutRect(cutout) {
  const halfWidth = Math.max(0, Number(cutout?.width ?? 0)) * 0.5;
  const halfDepth = Math.max(0, Number(cutout?.depth ?? 0)) * 0.5;
  return {
    xMin: Number(cutout?.centerX ?? 0) - halfWidth,
    xMax: Number(cutout?.centerX ?? 0) + halfWidth,
    zMin: Number(cutout?.centerZ ?? 0) - halfDepth,
    zMax: Number(cutout?.centerZ ?? 0) + halfDepth
  };
}

function addRectSegment(segments, xMin, xMax, zMin, zMax) {
  if (xMax - xMin <= 0.02 || zMax - zMin <= 0.02) {
    return;
  }

  segments.push({ xMin, xMax, zMin, zMax });
}

function splitRectAroundCutout(rect, cutout) {
  const xMin = Math.max(rect.xMin, cutout.xMin);
  const xMax = Math.min(rect.xMax, cutout.xMax);
  const zMin = Math.max(rect.zMin, cutout.zMin);
  const zMax = Math.min(rect.zMax, cutout.zMax);
  if (xMin >= xMax || zMin >= zMax) {
    return [rect];
  }

  const segments = [];
  addRectSegment(segments, rect.xMin, xMin, rect.zMin, rect.zMax);
  addRectSegment(segments, xMax, rect.xMax, rect.zMin, rect.zMax);
  addRectSegment(segments, xMin, xMax, rect.zMin, zMin);
  addRectSegment(segments, xMin, xMax, zMax, rect.zMax);
  return segments;
}

function addOfficeRectWithCutouts(group, {
  xMin,
  xMax,
  zMin,
  zMax,
  y,
  height,
  material,
  cutouts = []
}) {
  const cutoutRects = cutouts.map(toCutoutRect);
  let segments = [{ xMin, xMax, zMin, zMax }];
  for (const cutout of cutoutRects) {
    segments = segments.flatMap((segment) => splitRectAroundCutout(segment, cutout));
  }

  for (const segment of segments) {
    group.add(createInteriorBox(
      [segment.xMax - segment.xMin, height, segment.zMax - segment.zMin],
      [
        (segment.xMin + segment.xMax) * 0.5,
        y,
        (segment.zMin + segment.zMax) * 0.5
      ],
      material
    ));
  }
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
  width = OFFICE_DEFAULT_FLOOR_LAYOUT.width,
  depth = OFFICE_DEFAULT_FLOOR_LAYOUT.depth,
  centerZ = OFFICE_DEFAULT_FLOOR_LAYOUT.centerZ,
  material = materials.floor,
  cutouts = []
} = {}) {
  addOfficeRectWithCutouts(group, {
    xMin: -width * 0.5,
    xMax: width * 0.5,
    zMin: centerZ - (depth * 0.5),
    zMax: centerZ + (depth * 0.5),
    y: floorY - 0.08,
    height: 0.16,
    material,
    cutouts
  });

  const stripeWidth = width - 0.9;
  for (const stripeZ of [centerZ - 5.8, centerZ, centerZ + 5.8]) {
    addOfficeRectWithCutouts(group, {
      xMin: -stripeWidth * 0.5,
      xMax: stripeWidth * 0.5,
      zMin: stripeZ - 0.09,
      zMax: stripeZ + 0.09,
      y: floorY + 0.015,
      height: 0.035,
      material: materials.floorStripe,
      cutouts
    });
  }
}

function addOfficeFloorWalls(group, materials, floorY, {
  width = OFFICE_DEFAULT_FLOOR_LAYOUT.width,
  depth = OFFICE_DEFAULT_FLOOR_LAYOUT.depth,
  centerZ = OFFICE_DEFAULT_FLOOR_LAYOUT.centerZ
} = {}) {
  const walls = new THREE.Group();
  walls.name = `office_floor_walls_${group.userData?.officeFloorId ?? 'unknown'}`;
  walls.userData.officeFloorWalls = true;

  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const xMin = -halfWidth;
  const xMax = halfWidth;
  const zMin = centerZ - halfDepth;
  const wallY = floorY + (OFFICE_FLOOR_WALL_HEIGHT * 0.5);
  const trimY = floorY + OFFICE_FLOOR_WALL_HEIGHT + 0.07;
  const northZ = zMin + (OFFICE_FLOOR_WALL_THICKNESS * 0.5);
  const westX = xMin + (OFFICE_FLOOR_WALL_THICKNESS * 0.5);
  const eastX = xMax - (OFFICE_FLOOR_WALL_THICKNESS * 0.5);

  walls.add(createInteriorBox(
    [width, OFFICE_FLOOR_WALL_HEIGHT, OFFICE_FLOOR_WALL_THICKNESS],
    [0, wallY, northZ],
    materials.wall
  ));
  walls.add(createInteriorBox(
    [OFFICE_FLOOR_WALL_THICKNESS, OFFICE_FLOOR_WALL_HEIGHT, depth],
    [westX, wallY, centerZ],
    materials.wall
  ));
  walls.add(createInteriorBox(
    [OFFICE_FLOOR_WALL_THICKNESS, OFFICE_FLOOR_WALL_HEIGHT, depth],
    [eastX, wallY, centerZ],
    materials.wall
  ));

  walls.add(createInteriorBox(
    [width + 0.14, 0.18, OFFICE_FLOOR_WALL_THICKNESS + 0.08],
    [0, trimY, northZ],
    materials.wallTrim
  ));
  walls.add(createInteriorBox(
    [OFFICE_FLOOR_WALL_THICKNESS + 0.08, 0.18, depth + 0.14],
    [westX, trimY, centerZ],
    materials.wallTrim
  ));
  walls.add(createInteriorBox(
    [OFFICE_FLOOR_WALL_THICKNESS + 0.08, 0.18, depth + 0.14],
    [eastX, trimY, centerZ],
    materials.wallTrim
  ));

  group.add(walls);
}

function addOfficeElevatorVisual(group, materials, floorY, x, z, rotationY = 0, floorId = '') {
  const elevator = new THREE.Group();
  elevator.name = 'office_elevator_box';
  elevator.userData.officeElevatorBox = true;
  elevator.userData.officeFloorId = floorId;
  elevator.userData.officeElevatorSize = { ...OFFICE_INTERIOR_ELEVATOR_SIZE };
  elevator.position.set(x, 0, z);
  elevator.rotation.y = rotationY;

  const { width, depth, height } = OFFICE_INTERIOR_ELEVATOR_SIZE;
  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const doorPanelWidth = (width - 0.38) * 0.5;
  const centerY = floorY + (height * 0.5);
  elevator.add(createInteriorBox([width, 0.16, depth], [0, floorY + 0.08, 0], materials.metalDark));
  elevator.add(createInteriorBox([width, 0.18, depth], [0, floorY + height + 0.09, 0], materials.metalDark));
  elevator.add(createInteriorBox([width, height, 0.16], [0, centerY, -halfDepth], materials.metalDark));
  elevator.add(createInteriorBox([0.16, height, depth], [-halfWidth, centerY, 0], materials.metalDark));
  elevator.add(createInteriorBox([0.16, height, depth], [halfWidth, centerY, 0], materials.metalDark));
  elevator.add(createInteriorBox([doorPanelWidth, height - 0.58, 0.1], [-doorPanelWidth * 0.5, floorY + 1.34, halfDepth], materials.metal));
  elevator.add(createInteriorBox([doorPanelWidth, height - 0.58, 0.1], [doorPanelWidth * 0.5, floorY + 1.34, halfDepth], materials.metal));
  elevator.add(createInteriorBox([0.1, height - 0.48, 0.14], [0, floorY + 1.36, halfDepth + 0.04], materials.trimDark));
  elevator.add(createInteriorBox([0.28, 0.62, 0.1], [halfWidth + 0.18, floorY + 1.34, 0.2], materials.sign));
  elevator.add(createInteriorCylinder(0.07, 0.07, 0.04, 12, [halfWidth + 0.18, floorY + 1.48, 0.28], materials.gold));
  elevator.add(createInteriorCylinder(0.07, 0.07, 0.04, 12, [halfWidth + 0.18, floorY + 1.2, 0.28], materials.glass));
  group.add(elevator);
}

function addOfficeStairsVisual(group, materials, floorY, x, z, rotationY = 0, {
  targetFloorY = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles)
} = {}) {
  const stairs = new THREE.Group();
  stairs.position.set(x, 0, z);
  stairs.rotation.y = rotationY;
  stairs.name = 'office_stair_flight_lobby_to_cubicles';

  const totalRise = Math.max(1, targetFloorY - floorY);
  const stepHeight = totalRise / OFFICE_STAIR_STEP_COUNT;
  const stepDepth = OFFICE_STAIR_RUN_DEPTH / OFFICE_STAIR_STEP_COUNT;
  for (let step = 0; step < OFFICE_STAIR_STEP_COUNT; step += 1) {
    stairs.add(createInteriorBox(
      [OFFICE_STAIR_WIDTH, stepHeight, stepDepth + 0.035],
      [0, floorY + (stepHeight * (step + 0.5)), stepDepth * (step + 0.5)],
      step % 2 === 0 ? materials.trimDark : materials.metalDark
    ));
  }

  const topLandingZ = OFFICE_STAIR_RUN_DEPTH + 0.44;
  stairs.add(createInteriorBox([OFFICE_STAIR_WIDTH + 0.25, 0.18, 0.95], [0, targetFloorY - 0.09, topLandingZ], materials.metalDark));
  const railAngle = -Math.atan2(totalRise, OFFICE_STAIR_RUN_DEPTH);
  for (const sideX of [-((OFFICE_STAIR_WIDTH * 0.5) + 0.22), (OFFICE_STAIR_WIDTH * 0.5) + 0.22]) {
    const rail = createInteriorBox(
      [0.12, 0.16, OFFICE_STAIR_RUN_DEPTH + 0.75],
      [sideX, floorY + (totalRise * 0.5) + 0.9, OFFICE_STAIR_RUN_DEPTH * 0.5],
      materials.metalDark
    );
    rail.rotation.x = railAngle;
    stairs.add(rail);

    for (let post = 0; post <= 6; post += 1) {
      const progress = post / 6;
      stairs.add(createInteriorBox(
        [0.12, 1.05, 0.12],
        [
          sideX,
          floorY + (totalRise * progress) + 0.58,
          OFFICE_STAIR_RUN_DEPTH * progress
        ],
        materials.metalDark
      ));
    }
  }
  group.add(stairs);
}

function addOfficeStairwellRailing(group, materials) {
  const floorY = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const xMin = OFFICE_STAIR_OPENING.centerX - (OFFICE_STAIR_OPENING.width * 0.5);
  const xMax = OFFICE_STAIR_OPENING.centerX + (OFFICE_STAIR_OPENING.width * 0.5);
  const zMin = OFFICE_STAIR_OPENING.centerZ - (OFFICE_STAIR_OPENING.depth * 0.5);
  const zMax = OFFICE_STAIR_OPENING.centerZ + (OFFICE_STAIR_OPENING.depth * 0.5);
  const centerZ = (zMin + zMax) * 0.5;
  const railY = floorY + 0.88;
  const railHeight = 0.18;

  group.add(createInteriorBox([0.16, railHeight, OFFICE_STAIR_OPENING.depth], [xMin, railY, centerZ], materials.metalDark));
  group.add(createInteriorBox([0.16, railHeight, OFFICE_STAIR_OPENING.depth], [xMax, railY, centerZ], materials.metalDark));
  group.add(createInteriorBox([OFFICE_STAIR_OPENING.width, railHeight, 0.16], [OFFICE_STAIR_OPENING.centerX, railY, zMin], materials.metalDark));
  for (const [x, z] of [
    [xMin, zMin],
    [xMax, zMin],
    [xMin, centerZ],
    [xMax, centerZ],
    [xMin, zMax - 0.4],
    [xMax, zMax - 0.4]
  ]) {
    group.add(createInteriorBox([0.14, 1.45, 0.14], [x, floorY + 0.72, z], materials.metalDark));
  }
}

function addOfficeJanitorClosetProp(group, materials, floorY) {
  const [doorX, doorZ] = getOfficeStationLocalPosition('janitor-closet', [-8.1, -5.65]);
  const { width, depth, height } = OFFICE_INTERIOR_JANITOR_CLOSET_SIZE;
  const frontZ = depth * 0.5;
  const sideX = (width * 0.5) + 0.24;
  const prop = new THREE.Group();
  prop.name = 'office_janitor_closet_prop';
  prop.userData.officeJanitorClosetProp = true;
  prop.userData.officeJanitorClosetSize = { ...OFFICE_INTERIOR_JANITOR_CLOSET_SIZE };
  prop.position.set(doorX, 0, doorZ - frontZ);

  prop.add(createInteriorBox([width, height, depth], [0, floorY + (height * 0.5), 0], materials.closet));
  prop.add(createInteriorBox([width + 0.1, 0.16, depth + 0.1], [0, floorY + height + 0.08, 0], materials.trimDark));
  prop.add(createInteriorBox([width + 0.1, 0.12, depth + 0.1], [0, floorY + 0.06, 0], materials.metalDark));

  const door = createInteriorBox([1.34, 2.22, 0.12], [0, floorY + 1.2, frontZ + 0.07], materials.door);
  door.name = 'office_janitor_closet_prop_door';
  door.userData.officeJanitorClosetDoor = true;
  prop.add(door);
  prop.add(createInteriorBox([1.52, 0.12, 0.16], [0, floorY + 2.36, frontZ + 0.08], materials.metalDark));
  prop.add(createInteriorBox([0.12, 2.28, 0.16], [-0.75, floorY + 1.23, frontZ + 0.08], materials.metalDark));
  prop.add(createInteriorBox([0.12, 2.28, 0.16], [0.75, floorY + 1.23, frontZ + 0.08], materials.metalDark));
  prop.add(createInteriorBox([0.13, 0.13, 0.08], [0.47, floorY + 1.34, frontZ + 0.15], materials.gold));

  const mop = createInteriorCylinder(0.045, 0.045, 2.35, 8, [sideX, floorY + 1.34, -0.32], materials.wood);
  mop.name = 'office_janitor_closet_side_mop';
  mop.userData.officeJanitorClosetMop = true;
  mop.rotation.z = -0.18;
  prop.add(mop);
  prop.add(createInteriorBox([0.58, 0.18, 0.18], [sideX + 0.18, floorY + 0.24, -0.08], materials.trimDark, -0.18));

  const bucket = createInteriorCylinder(0.34, 0.42, 0.5, 14, [sideX + 0.22, floorY + 0.34, 0.68], materials.green);
  bucket.name = 'office_janitor_closet_side_bucket';
  bucket.userData.officeJanitorClosetBucket = true;
  prop.add(bucket);
  prop.add(createInteriorBox([0.72, 0.06, 0.08], [sideX + 0.22, floorY + 0.68, 0.68], materials.metal));

  group.add(prop);
}

function addOfficeLobbyVisuals(group, stairsGroup, materials) {
  const floorY = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby);
  const layout = getOfficeInteriorFloorLayout(OFFICE_INTERIOR_FLOOR_IDS.lobby);
  addOfficeFloorVisual(group, materials, floorY, layout);
  addOfficeFloorWalls(group, materials, floorY, layout);
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
  addOfficeJanitorClosetProp(group, materials, floorY);
  addOfficeStairsVisual(stairsGroup, materials, floorY, OFFICE_STAIR_BOTTOM.x, OFFICE_STAIR_BOTTOM.z, 0);
}

function addOfficeCubicleFloorVisuals(group, materials) {
  const floorY = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const layout = getOfficeInteriorFloorLayout(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  addOfficeFloorVisual(group, materials, floorY, {
    ...layout,
    cutouts: [OFFICE_STAIR_OPENING]
  });
  addOfficeFloorWalls(group, materials, floorY, layout);
  for (const [x, z, rotationY] of [
    [-1.6, -3.35, 0],
    [2.6, -3.35, 0],
    [5.85, 1.35, Math.PI * 0.5],
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
  const [elevatorX, elevatorZ] = getOfficeInteriorElevatorCenter(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  addOfficeElevatorVisual(group, materials, floorY, elevatorX, elevatorZ, 0, OFFICE_INTERIOR_FLOOR_IDS.cubicles);
}

function addOfficeCeoFloorVisuals(group, materials) {
  const floorY = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  const layout = getOfficeInteriorFloorLayout(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  addOfficeFloorVisual(group, materials, floorY, {
    ...layout,
    material: materials.floorAccent
  });
  addOfficeFloorWalls(group, materials, floorY, layout);
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
  const [elevatorX, elevatorZ] = getOfficeInteriorElevatorCenter(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  addOfficeElevatorVisual(group, materials, floorY, elevatorX, elevatorZ, 0, OFFICE_INTERIOR_FLOOR_IDS.ceo);
}

function addOfficeInteriorVisuals(group) {
  const materials = {
    floor: createInteriorMaterial(0x5d666c),
    floorStripe: createInteriorMaterial(0x68737a),
    floorAccent: createInteriorMaterial(0x525a60),
    wall: createInteriorMaterial(0xd7e1e6, 0.9, 0.02),
    wallTrim: createInteriorMaterial(0x34424c, 0.82, 0.08),
    partition: createInteriorMaterial(0xaeb8be),
    trimDark: createInteriorMaterial(0x66727a),
    metal: createInteriorMaterial(0xc4ccd2, 0.84, 0.18),
    metalDark: createInteriorMaterial(0x59636b, 0.86, 0.16),
    wood: createInteriorMaterial(0xa97948),
    woodDark: createInteriorMaterial(0x68452b),
    closet: createInteriorMaterial(0x7f8a8f),
    chair: createInteriorMaterial(0x415565),
    screen: createInteriorMaterial(0x253542, 0.76, 0.08),
    glass: createInteriorMaterial(0xb7dce8, 0.62, 0.02),
    sign: createInteriorMaterial(0x263746),
    door: createInteriorMaterial(0x27313a),
    gold: createInteriorMaterial(0xd2aa44, 0.58, 0.18),
    green: createInteriorMaterial(0x5e8d58),
    accentDark: createInteriorMaterial(0x355a78)
  };

  const floorGroups = new Map([
    [OFFICE_INTERIOR_FLOOR_IDS.lobby, createOfficeFloorVisualGroup(OFFICE_INTERIOR_FLOOR_IDS.lobby)],
    [OFFICE_INTERIOR_FLOOR_IDS.cubicles, createOfficeFloorVisualGroup(OFFICE_INTERIOR_FLOOR_IDS.cubicles)],
    [OFFICE_INTERIOR_FLOOR_IDS.ceo, createOfficeFloorVisualGroup(OFFICE_INTERIOR_FLOOR_IDS.ceo)]
  ]);
  const stairsGroup = createOfficeStairsVisualGroup();

  addOfficeLobbyVisuals(floorGroups.get(OFFICE_INTERIOR_FLOOR_IDS.lobby), stairsGroup, materials);
  addOfficeCubicleFloorVisuals(floorGroups.get(OFFICE_INTERIOR_FLOOR_IDS.cubicles), materials);
  addOfficeCeoFloorVisuals(floorGroups.get(OFFICE_INTERIOR_FLOOR_IDS.ceo), materials);
  addOfficeStairwellRailing(stairsGroup, materials);

  for (const floorGroup of floorGroups.values()) {
    group.add(floorGroup);
  }
  group.add(stairsGroup);

  const officeVisuals = {
    floorGroups,
    stairsGroup,
    activeFloorId: ''
  };
  setOfficeActiveFloor(officeVisuals, OFFICE_INTERIOR_FLOOR_IDS.lobby);
  return officeVisuals;
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

function createOfficeFloorWallColliders(origin, rotationQuarterTurns, floorId) {
  const layout = getOfficeInteriorFloorLayout(floorId);
  const floorY = getOfficeInteriorFloorHeight(floorId);
  const halfWidth = layout.width * 0.5;
  const halfDepth = layout.depth * 0.5;
  const xMin = -halfWidth;
  const xMax = halfWidth;
  const zMin = layout.centerZ - halfDepth;
  const northZ = zMin + (OFFICE_FLOOR_WALL_THICKNESS * 0.5);
  const westX = xMin + (OFFICE_FLOOR_WALL_THICKNESS * 0.5);
  const eastX = xMax - (OFFICE_FLOOR_WALL_THICKNESS * 0.5);

  return [
    createColliderFromLocalRect(
      origin,
      rotationQuarterTurns,
      0,
      northZ,
      halfWidth,
      OFFICE_FLOOR_WALL_THICKNESS * 0.5,
      floorY,
      floorY + OFFICE_FLOOR_WALL_HEIGHT
    ),
    createColliderFromLocalRect(
      origin,
      rotationQuarterTurns,
      westX,
      layout.centerZ,
      OFFICE_FLOOR_WALL_THICKNESS * 0.5,
      halfDepth,
      floorY,
      floorY + OFFICE_FLOOR_WALL_HEIGHT
    ),
    createColliderFromLocalRect(
      origin,
      rotationQuarterTurns,
      eastX,
      layout.centerZ,
      OFFICE_FLOOR_WALL_THICKNESS * 0.5,
      halfDepth,
      floorY,
      floorY + OFFICE_FLOOR_WALL_HEIGHT
    )
  ];
}

function createOfficeObjectCollider(origin, rotationQuarterTurns, floorId, centerX, centerZ, width, depth, height) {
  const floorY = getOfficeInteriorFloorHeight(floorId);
  return createColliderFromLocalRect(
    origin,
    rotationQuarterTurns,
    centerX,
    centerZ,
    width * 0.5,
    depth * 0.5,
    floorY,
    floorY + height
  );
}

function createOfficeJanitorClosetCollider(origin, rotationQuarterTurns) {
  const [doorX, doorZ] = getOfficeStationLocalPosition('janitor-closet', [-8.1, -5.65]);
  const { width, depth, height } = OFFICE_INTERIOR_JANITOR_CLOSET_SIZE;
  return createOfficeObjectCollider(
    origin,
    rotationQuarterTurns,
    OFFICE_INTERIOR_FLOOR_IDS.lobby,
    doorX,
    doorZ - (depth * 0.5),
    width,
    depth,
    height
  );
}

function createOfficeElevatorCollider(origin, rotationQuarterTurns, floorId) {
  const [centerX, centerZ] = getOfficeInteriorElevatorCenter(floorId);
  const { width, depth, height } = OFFICE_INTERIOR_ELEVATOR_SIZE;
  return createOfficeObjectCollider(
    origin,
    rotationQuarterTurns,
    floorId,
    centerX,
    centerZ,
    width,
    depth,
    height
  );
}

function createOfficeActiveFloorColliderMap(origin, rotationQuarterTurns) {
  return new Map([
    [
      OFFICE_INTERIOR_FLOOR_IDS.lobby,
      [
        ...createOfficeFloorWallColliders(origin, rotationQuarterTurns, OFFICE_INTERIOR_FLOOR_IDS.lobby),
        createOfficeJanitorClosetCollider(origin, rotationQuarterTurns)
      ]
    ],
    [
      OFFICE_INTERIOR_FLOOR_IDS.cubicles,
      [
        ...createOfficeFloorWallColliders(origin, rotationQuarterTurns, OFFICE_INTERIOR_FLOOR_IDS.cubicles),
        createOfficeElevatorCollider(origin, rotationQuarterTurns, OFFICE_INTERIOR_FLOOR_IDS.cubicles)
      ]
    ],
    [
      OFFICE_INTERIOR_FLOOR_IDS.ceo,
      [
        ...createOfficeFloorWallColliders(origin, rotationQuarterTurns, OFFICE_INTERIOR_FLOOR_IDS.ceo),
        createOfficeElevatorCollider(origin, rotationQuarterTurns, OFFICE_INTERIOR_FLOOR_IDS.ceo)
      ]
    ]
  ]);
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
  let officeVisuals = null;

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
    officeVisuals = addOfficeInteriorVisuals(group);
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
  const upperFloorDoorwayBlocker = isOfficeInterior
    ? createColliderFromLocalRect(
        origin,
        normalizedRotation,
        0,
        southWallZ,
        halfDoorway + INLINE_SHELL_TRIGGER_WIDTH_PADDING,
        wallThickness * 0.75,
        0,
        template.wallHeight
      )
    : null;
  const officeActiveFloorCollidersById = isOfficeInterior
    ? createOfficeActiveFloorColliderMap(origin, normalizedRotation)
    : null;
  const interiorInteractables = [];

  function getActiveOfficeColliders(worldPosition = null) {
    if (!isOfficeInterior || !worldPosition) {
      return [];
    }

    const floorId = resolveOfficeFloorIdAtWorldPosition(origin, normalizedRotation, worldPosition);
    const activeFloorColliders = officeActiveFloorCollidersById?.get(floorId) ?? [];
    return floorId === OFFICE_INTERIOR_FLOOR_IDS.lobby || !upperFloorDoorwayBlocker
      ? [...activeFloorColliders]
      : [...activeFloorColliders, upperFloorDoorwayBlocker];
  }

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
        return getOfficeGroundHeightAtWorldPosition(origin, normalizedRotation, worldPosition);
      }

      return origin[1] ?? 0;
    },
    setActiveFloorId(floorId = OFFICE_INTERIOR_FLOOR_IDS.lobby) {
      if (isOfficeInterior) {
        setOfficeActiveFloor(officeVisuals, floorId);
      }
    },
    getOfficeFloorIdAtWorldPosition(worldPosition = null) {
      return isOfficeInterior
        ? resolveOfficeFloorIdAtWorldPosition(origin, normalizedRotation, worldPosition)
        : '';
    },
    getConditionalDoorColliders(worldPosition = null) {
      if (!isOfficeInterior || !worldPosition || !upperFloorDoorwayBlocker) {
        return [];
      }

      return resolveOfficeFloorIdAtWorldPosition(origin, normalizedRotation, worldPosition) === OFFICE_INTERIOR_FLOOR_IDS.lobby
        ? []
        : [upperFloorDoorwayBlocker];
    },
    getActiveOfficeColliders(worldPosition = null) {
      return getActiveOfficeColliders(worldPosition);
    },
    getCollidersAt(worldPosition = null) {
      return isOfficeInterior
        ? [...colliders, ...getActiveOfficeColliders(worldPosition)]
        : colliders;
    },
    setActiveFloorForWorldPosition(worldPosition = null) {
      if (isOfficeInterior && worldPosition) {
        setOfficeActiveFloor(
          officeVisuals,
          resolveOfficeFloorIdAtWorldPosition(origin, normalizedRotation, worldPosition)
        );
      }
    },
    inlineOverlay: isOfficeInterior,
    setVisible(nextVisible) {
      group.visible = Boolean(nextVisible);
    }
  };

  scene.setVisible(visible);
  return scene;
}
