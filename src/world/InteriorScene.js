import * as THREE from 'three';

const INTERIOR_WORLD_ORIGIN = Object.freeze([1000, 0, 1000]);

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

function createCollider(minX, minZ, maxX, maxZ, minY = 0, maxY = 14) {
  return {
    type: 'box',
    box: new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    )
  };
}

export function getInteriorTemplateById(id) {
  return TEMPLATE_BY_ID.get(id) ?? null;
}

export function createInteriorScene(interiorId) {
  const template = getInteriorTemplateById(interiorId);
  if (!template) {
    return null;
  }

  const [originX, originY, originZ] = INTERIOR_WORLD_ORIGIN;
  const [floorWidth, floorDepth] = template.floorSize;
  const halfWidth = floorWidth * 0.5;
  const halfDepth = floorDepth * 0.5;
  const halfDoorway = template.doorwayWidth * 0.5;
  const wallY = originY + (template.wallHeight * 0.5);
  const wallThickness = template.wallThickness;
  const southWallZ = originZ + halfDepth - (wallThickness * 0.5);
  const northWallZ = originZ - halfDepth + (wallThickness * 0.5);
  const westWallX = originX - halfWidth + (wallThickness * 0.5);
  const eastWallX = originX + halfWidth - (wallThickness * 0.5);
  const sideWallDepth = Math.max(0.8, halfDepth - halfDoorway);

  const group = new THREE.Group();
  group.name = `InteriorScene_${template.id}`;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(floorWidth, 0.25, floorDepth),
    new THREE.MeshStandardMaterial({
      color: template.palette.floor,
      roughness: 1
    })
  );
  floor.position.set(originX, originY - 0.125, originZ);
  floor.receiveShadow = true;
  group.add(floor);

  const northWall = createWallSegment(floorWidth, wallThickness, template.wallHeight, template.palette.wall);
  northWall.position.set(originX, wallY, northWallZ);
  const westWall = createWallSegment(wallThickness, floorDepth, template.wallHeight, template.palette.wall);
  westWall.position.set(westWallX, wallY, originZ);
  const eastWall = createWallSegment(wallThickness, floorDepth, template.wallHeight, template.palette.wall);
  eastWall.position.set(eastWallX, wallY, originZ);
  const southWallLeft = createWallSegment(
    Math.max(0.8, halfWidth - halfDoorway),
    wallThickness,
    template.wallHeight,
    template.palette.wall
  );
  southWallLeft.position.set(originX - ((halfWidth + halfDoorway) * 0.5), wallY, southWallZ);
  const southWallRight = createWallSegment(
    Math.max(0.8, halfWidth - halfDoorway),
    wallThickness,
    template.wallHeight,
    template.palette.wall
  );
  southWallRight.position.set(originX + ((halfWidth + halfDoorway) * 0.5), wallY, southWallZ);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(template.doorwayWidth, 0.6, wallThickness),
    new THREE.MeshStandardMaterial({
      color: template.palette.trim,
      roughness: 0.85
    })
  );
  trim.position.set(originX, originY + template.wallHeight - 0.4, southWallZ);

  for (const wall of [northWall, westWall, eastWall, southWallLeft, southWallRight, trim]) {
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const colliders = [
    createCollider(originX - halfWidth, originZ - halfDepth, originX + halfWidth, originZ - halfDepth + wallThickness),
    createCollider(originX - halfWidth, originZ - halfDepth, originX - halfWidth + wallThickness, originZ + halfDepth),
    createCollider(originX + halfWidth - wallThickness, originZ - halfDepth, originX + halfWidth, originZ + halfDepth),
    createCollider(originX - halfWidth, originZ + halfDepth - wallThickness, originX - halfDoorway, originZ + halfDepth),
    createCollider(originX + halfDoorway, originZ + halfDepth - wallThickness, originX + halfWidth, originZ + halfDepth)
  ];

  const spawnPoint = new THREE.Vector3(
    originX + (template.spawnOffset[0] ?? 0),
    originY,
    originZ + (template.spawnOffset[1] ?? 0)
  );
  const exitPosition = new THREE.Vector3(
    originX + (template.exitOffset[0] ?? 0),
    originY,
    originZ + (template.exitOffset[1] ?? 0)
  );

  return {
    id: template.id,
    label: template.label,
    group,
    colliders,
    spawnPoint,
    bounds: new THREE.Box3(
      new THREE.Vector3(
        originX - halfWidth + template.boundsPadding,
        originY - 1,
        originZ - halfDepth + template.boundsPadding
      ),
      new THREE.Vector3(
        originX + halfWidth - template.boundsPadding,
        originY + template.wallHeight,
        originZ + halfDepth - template.boundsPadding
      )
    ),
    interactables: [
      {
        kind: 'interior-exit',
        position: exitPosition,
        radius: 3.4,
        prompt: `Leave ${template.label}`,
        actionText: 'Step back outside.'
      }
    ],
    getGroundHeightAt() {
      return originY;
    },
    setVisible(visible) {
      group.visible = Boolean(visible);
    }
  };
}
