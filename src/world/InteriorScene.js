import * as THREE from 'three';

const INTERIOR_WORLD_ORIGIN = Object.freeze([1000, 0, 1000]);
const INLINE_SHELL_TRIGGER_DEPTH = 4.4;
const INLINE_SHELL_TRIGGER_WIDTH_PADDING = 0.8;

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
    palette: Object.freeze({
      floor: 0x50565d,
      wall: 0xd8d5ce,
      trim: 0x9e988f
    })
  }
]);

const TEMPLATE_BY_ID = new Map(INTERIOR_TEMPLATES.map((template) => [template.id, template]));

function normalizeRotationQuarterTurns(value = 0) {
  return ((Math.round(Number(value) || 0) % 4) + 4) % 4;
}

function rotateLocalOffset(x, z, rotationQuarterTurns = 0) {
  switch (normalizeRotationQuarterTurns(rotationQuarterTurns)) {
    case 1:
      return { x: z, z: -x };
    case 2:
      return { x: -x, z: -z };
    case 3:
      return { x: -z, z: x };
    default:
      return { x, z };
  }
}

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
  group.add(floor);

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
    group.add(wall);
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

  const scene = {
    id: template.id,
    label: template.label,
    group,
    colliders,
    spawnPoint,
    doorwayThresholdPosition,
    doorwayTriggerBounds,
    bounds,
    interactables: includeExitInteractable
      ? [{
          kind: 'interior-exit',
          position: exitPosition,
          radius: 3.4,
          prompt: `Leave ${template.label}`,
          actionText: 'Step back outside.'
        }]
      : [],
    getGroundHeightAt() {
      return origin[1] ?? 0;
    },
    setVisible(nextVisible) {
      group.visible = Boolean(nextVisible);
    }
  };

  scene.setVisible(visible);
  return scene;
}
