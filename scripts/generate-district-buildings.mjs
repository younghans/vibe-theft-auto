import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onerror = null;
  }

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }
  }

  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const mime = blob.type || 'application/octet-stream';
      this.result = `data:${mime};base64,${buffer.toString('base64')}`;
      this.onloadend?.({ target: this });
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }
  }
}

globalThis.FileReader = globalThis.FileReader ?? NodeFileReader;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDirectory = path.join(projectRoot, 'assets', 'stickrpg_custom', 'models');

const FONT = Object.freeze({
  A: [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],
  B: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10001',
    '10001',
    '11110'
  ],
  C: [
    '01111',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '01111'
  ],
  E: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111'
  ],
  F: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000'
  ],
  H: [
    '10001',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001'
  ],
  I: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111'
  ],
  K: [
    '10001',
    '10010',
    '10100',
    '11000',
    '10100',
    '10010',
    '10001'
  ],
  L: [
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '11111'
  ],
  N: [
    '10001',
    '11001',
    '10101',
    '10011',
    '10001',
    '10001',
    '10001'
  ],
  O: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],
  R: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10100',
    '10010',
    '10001'
  ],
  S: [
    '01111',
    '10000',
    '10000',
    '01110',
    '00001',
    '00001',
    '11110'
  ],
  ' ': [
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000',
    '00000'
  ]
});

function createMaterial(color, roughness = 0.96, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true
  });
}

function createMesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createBox(size, position, material, rotation = [0, 0, 0]) {
  return createMesh(new THREE.BoxGeometry(...size), material, position, rotation);
}

function createCylinder(radiusTop, radiusBottom, height, segments, position, material, rotation = [0, 0, 0]) {
  return createMesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
    position,
    rotation
  );
}

function createSphere(radius, widthSegments, heightSegments, position, material) {
  return createMesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material, position);
}

function createTorus(radius, tube, radialSegments, tubularSegments, position, material, rotation = [0, 0, 0]) {
  return createMesh(
    new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
    material,
    position,
    rotation
  );
}

function addBoxes(group, specs) {
  for (const { size, position, material, rotation } of specs) {
    group.add(createBox(size, position, material, rotation));
  }
}

function addPixelText(group, text, {
  centerX,
  y,
  z,
  pixelSize,
  depth,
  material
}) {
  const chars = [...String(text).toUpperCase()];
  const charAdvance = pixelSize * 6;
  const totalWidth = Math.max(0, (chars.length * charAdvance) - pixelSize);
  let cursorX = centerX - (totalWidth * 0.5);

  for (const char of chars) {
    const bitmap = FONT[char] ?? FONT[' '];
    for (let row = 0; row < bitmap.length; row += 1) {
      for (let col = 0; col < bitmap[row].length; col += 1) {
        if (bitmap[row][col] !== '1') {
          continue;
        }

        group.add(createBox(
          [pixelSize, pixelSize, depth],
          [
            cursorX + (col * pixelSize) + (pixelSize * 0.5),
            y + (((bitmap.length - 1) * 0.5 - row) * pixelSize),
            z
          ],
          material
        ));
      }
    }
    cursorX += charAdvance;
  }
}

function addSignText(group, text, options) {
  addPixelText(group, text, {
    ...options,
    centerX: options.centerX + 0.08,
    y: options.y - 0.1,
    z: options.z - 0.1,
    material: options.shadowMaterial
  });
  addPixelText(group, text, options);
}

function addSignPanel(group, {
  centerX,
  y,
  z,
  width,
  height,
  panelMaterial,
  trimMaterial
}) {
  group.add(createBox([width, height, 0.34], [centerX, y, z], panelMaterial));
  group.add(createBox([width + 0.36, 0.22, 0.42], [centerX, y + (height * 0.5) + 0.1, z + 0.03], trimMaterial));
  group.add(createBox([width + 0.36, 0.22, 0.42], [centerX, y - (height * 0.5) - 0.1, z + 0.03], trimMaterial));
  group.add(createBox([0.22, height + 0.36, 0.42], [centerX - (width * 0.5) - 0.1, y, z + 0.03], trimMaterial));
  group.add(createBox([0.22, height + 0.36, 0.42], [centerX + (width * 0.5) + 0.1, y, z + 0.03], trimMaterial));
}

function addParapetRect(group, {
  centerX,
  centerY,
  centerZ,
  width,
  depth,
  parapetHeight,
  thickness,
  material
}) {
  group.add(createBox([width, parapetHeight, thickness], [centerX, centerY, centerZ + ((depth - thickness) * 0.5)], material));
  group.add(createBox([width, parapetHeight, thickness], [centerX, centerY, centerZ - ((depth - thickness) * 0.5)], material));
  group.add(createBox([thickness, parapetHeight, depth], [centerX - ((width - thickness) * 0.5), centerY, centerZ], material));
  group.add(createBox([thickness, parapetHeight, depth], [centerX + ((width - thickness) * 0.5), centerY, centerZ], material));
}

function addShellBlock(group, {
  centerX,
  centerY,
  centerZ,
  width,
  height,
  depth,
  material,
  roofGroup = null,
  roofMaterial = material,
  wallThickness = 0.36,
  roofThickness = 0.36,
  doorwaySide = '',
  doorwayWidth = 0,
  doorwayHeight = 0,
  doorwayOffset = 0
}) {
  const targetRoofGroup = roofGroup ?? group;
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const halfDepth = depth * 0.5;
  const clampedDoorwayHeight = Math.max(0, Math.min(height - 0.2, doorwayHeight));
  const clampedDoorwayWidth = Math.max(0, Math.min(width - (wallThickness * 2) - 0.2, doorwayWidth));
  const doorwayCenterX = THREE.MathUtils.clamp(
    doorwayOffset,
    -halfWidth + wallThickness + (clampedDoorwayWidth * 0.5),
    halfWidth - wallThickness - (clampedDoorwayWidth * 0.5)
  );

  const addFrontOrBackWall = (side) => {
    const z = centerZ + ((side === 'front' ? 1 : -1) * (halfDepth - (wallThickness * 0.5)));
    const hasDoorway = doorwaySide === side && clampedDoorwayWidth > 0.2 && clampedDoorwayHeight > 0.2;

    if (!hasDoorway) {
      group.add(createBox([width, height, wallThickness], [centerX, centerY, z], material));
      return;
    }

    const leftBoundary = -halfWidth;
    const rightBoundary = halfWidth;
    const doorMin = doorwayCenterX - (clampedDoorwayWidth * 0.5);
    const doorMax = doorwayCenterX + (clampedDoorwayWidth * 0.5);
    const leftWidth = doorMin - leftBoundary;
    const rightWidth = rightBoundary - doorMax;
    const topHeight = height - clampedDoorwayHeight;

    if (leftWidth > 0.08) {
      group.add(createBox(
        [leftWidth, height, wallThickness],
        [centerX + ((leftBoundary + doorMin) * 0.5), centerY, z],
        material
      ));
    }

    if (rightWidth > 0.08) {
      group.add(createBox(
        [rightWidth, height, wallThickness],
        [centerX + ((doorMax + rightBoundary) * 0.5), centerY, z],
        material
      ));
    }

    if (topHeight > 0.08) {
      group.add(createBox(
        [clampedDoorwayWidth, topHeight, wallThickness],
        [centerX + doorwayCenterX, centerY - halfHeight + clampedDoorwayHeight + (topHeight * 0.5), z],
        material
      ));
    }
  };

  addFrontOrBackWall('back');
  addFrontOrBackWall('front');
  group.add(createBox(
    [wallThickness, height, depth],
    [centerX - halfWidth + (wallThickness * 0.5), centerY, centerZ],
    material
  ));
  group.add(createBox(
    [wallThickness, height, depth],
    [centerX + halfWidth - (wallThickness * 0.5), centerY, centerZ],
    material
  ));
  targetRoofGroup.add(createBox(
    [width, roofThickness, depth],
    [centerX, centerY + halfHeight - (roofThickness * 0.5), centerZ],
    roofMaterial
  ));
}

function addFloorPanels(group, {
  width,
  depth,
  centerX,
  centerY,
  centerZ,
  panelCount,
  baseMaterial,
  stripeMaterial,
  accentMaterial
}) {
  group.add(createBox([width, 0.16, depth], [centerX, centerY, centerZ], baseMaterial));
  const rowDepth = depth / panelCount;
  const startZ = centerZ - (depth * 0.5) + (rowDepth * 0.5);

  for (let row = 0; row < panelCount; row += 1) {
    const z = startZ + (row * rowDepth);
    const material = row % 2 === 0 ? stripeMaterial : accentMaterial;
    group.add(createBox([width - 0.36, 0.03, Math.max(0.08, rowDepth - 0.08)], [centerX, centerY + 0.1, z], material));
  }
}

function addDetailedFrontWindow(group, {
  x,
  y,
  z,
  width,
  height,
  glassMaterial,
  frameMaterial,
  sillMaterial,
  mullions = 1
}) {
  group.add(createBox([width + 0.28, height + 0.26, 0.08], [x, y, z - 0.08], frameMaterial));
  group.add(createBox([width, height, 0.1], [x, y, z], glassMaterial));
  group.add(createBox([width + 0.18, 0.08, 0.18], [x, y - (height * 0.5) - 0.08, z + 0.04], sillMaterial));
  group.add(createBox([width + 0.14, 0.07, 0.14], [x, y + (height * 0.5) + 0.07, z + 0.02], frameMaterial));

  for (let index = 1; index <= mullions; index += 1) {
    const t = index / (mullions + 1);
    const mullionX = x - (width * 0.5) + (width * t);
    group.add(createBox([0.08, height + 0.08, 0.13], [mullionX, y, z + 0.02], frameMaterial));
  }
}

function addSideWindow(group, {
  x,
  y,
  z,
  width,
  height,
  glassMaterial,
  frameMaterial
}) {
  group.add(createBox([0.08, height + 0.24, width + 0.26], [x, y, z], frameMaterial));
  group.add(createBox([0.1, height, width], [x, y, z], glassMaterial));
  group.add(createBox([0.14, 0.08, width + 0.18], [x, y - (height * 0.5) - 0.08, z], frameMaterial));
}

function addDoorTrim(group, materials, { z = 10.92, accentMaterial = materials.trim } = {}) {
  addBoxes(group, [
    { size: [0.34, 3.84, 0.28], position: [-3.56, 2.34, z], material: accentMaterial },
    { size: [0.34, 3.84, 0.28], position: [3.56, 2.34, z], material: accentMaterial },
    { size: [7.26, 0.32, 0.32], position: [0, 4.18, z], material: accentMaterial },
    { size: [7.4, 0.2, 0.46], position: [0, 0.82, z + 0.04], material: materials.trimDark },
    { size: [1.18, 2.8, 0.14], position: [-2.64, 2.18, z + 0.2], material: materials.door, rotation: [0, -0.32, 0] },
    { size: [1.18, 2.8, 0.14], position: [2.64, 2.18, z + 0.2], material: materials.door, rotation: [0, 0.32, 0] }
  ]);
}

function addRooftopUnit(group, position, materials, rotationY = 0) {
  const unit = new THREE.Group();
  unit.position.set(...position);
  unit.rotation.y = rotationY;
  unit.add(createBox([2.6, 1.05, 1.7], [0, 0.52, 0], materials.metalDark));
  unit.add(createBox([2.24, 0.14, 1.4], [0, 1.12, 0], materials.trimDark));
  unit.add(createCylinder(0.36, 0.36, 0.14, 16, [-0.58, 1.28, 0], materials.metal));
  unit.add(createCylinder(0.36, 0.36, 0.14, 16, [0.58, 1.28, 0], materials.metal));
  group.add(unit);
}

function tagGroupMeshes(group, prefix) {
  let index = 0;
  group.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.name = `${prefix}_${index}`;
    index += 1;
  });
}

function mergeMeshesByMaterial(group) {
  group.updateWorldMatrix(true, true);
  const groupInverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();

  group.traverse((node) => {
    if (!node.isMesh || !node.geometry || Array.isArray(node.material)) {
      return;
    }

    node.updateWorldMatrix(true, false);
    const geometry = node.geometry.clone();
    const localMatrix = new THREE.Matrix4().multiplyMatrices(groupInverse, node.matrixWorld);
    geometry.applyMatrix4(localMatrix);

    const key = node.material.uuid;
    const bucket = buckets.get(key) ?? { material: node.material, geometries: [] };
    bucket.geometries.push(geometry);
    buckets.set(key, bucket);
  });

  group.clear();
  let index = 0;
  for (const bucket of buckets.values()) {
    const geometry = bucket.geometries.length === 1
      ? bucket.geometries[0]
      : mergeGeometries(bucket.geometries, false);
    if (!geometry) {
      continue;
    }

    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.name = `${group.name}_merged_${index}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    index += 1;
  }
}

function optimizeBuildingGroups(groups) {
  for (const group of [
    groups.foundation,
    groups.shell,
    groups.roof,
    groups.upper,
    groups.exterior,
    groups.interior
  ]) {
    mergeMeshesByMaterial(group);
  }
}

function addDesk(group, position, materials, rotationY = 0) {
  const desk = new THREE.Group();
  desk.position.set(...position);
  desk.rotation.y = rotationY;
  desk.add(createBox([1.65, 0.16, 1.05], [0, 0.92, 0], materials.wood));
  desk.add(createBox([1.48, 0.1, 0.16], [0, 0.66, -0.46], materials.woodDark));
  for (const [x, z] of [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.36], [0.62, 0.36]]) {
    desk.add(createBox([0.12, 0.72, 0.12], [x, 0.38, z], materials.metalDark));
  }
  desk.add(createBox([1.1, 0.12, 0.72], [0, 0.48, 1.02], materials.chair));
  desk.add(createBox([1.1, 0.86, 0.12], [0, 1.0, 1.34], materials.chair));
  group.add(desk);
}

function addRoundTable(group, position, materials, rotationY = 0) {
  const table = new THREE.Group();
  table.position.set(...position);
  table.rotation.y = rotationY;
  table.add(createCylinder(1.1, 1.1, 0.18, 18, [0, 1.05, 0], materials.wood));
  table.add(createCylinder(0.14, 0.18, 0.95, 10, [0, 0.55, 0], materials.metalDark));
  table.add(createCylinder(0.62, 0.62, 0.1, 14, [0, 0.06, 0], materials.metalDark));
  for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    const x = Math.sin(angle) * 1.72;
    const z = Math.cos(angle) * 1.72;
    table.add(createCylinder(0.34, 0.38, 0.7, 10, [x, 0.42, z], materials.chair));
    table.add(createBox([0.72, 0.1, 0.52], [x, 0.8, z], materials.chair, [0, angle, 0]));
  }
  group.add(table);
}

function addSlotMachine(group, position, materials, rotationY = 0) {
  const slot = new THREE.Group();
  slot.position.set(...position);
  slot.rotation.y = rotationY;
  slot.add(createBox([1.05, 2.25, 0.72], [0, 1.18, 0], materials.slotBody));
  slot.add(createBox([0.76, 0.48, 0.08], [0, 1.64, 0.4], materials.glassLite));
  slot.add(createBox([0.78, 0.34, 0.08], [0, 0.92, 0.41], materials.signFace));
  for (const x of [-0.28, 0, 0.28]) {
    slot.add(createBox([0.18, 0.2, 0.1], [x, 1.64, 0.47], materials.accent));
  }
  slot.add(createCylinder(0.08, 0.08, 0.68, 8, [0.64, 1.42, 0.12], materials.metalDark, [0.42, 0, 0]));
  slot.add(createSphere(0.18, 10, 8, [0.76, 1.78, -0.08], materials.accent));
  group.add(slot);
}

function addCubicle(group, position, materials, rotationY = 0) {
  const cube = new THREE.Group();
  cube.position.set(...position);
  cube.rotation.y = rotationY;
  cube.add(createBox([2.6, 0.16, 1.08], [0, 0.92, 0], materials.wood));
  cube.add(createBox([2.82, 1.36, 0.12], [0, 1.2, -0.76], materials.partition));
  cube.add(createBox([0.12, 1.36, 1.64], [-1.46, 1.2, 0.0], materials.partition));
  cube.add(createBox([0.74, 0.46, 0.08], [-0.52, 1.24, 0.58], materials.screen));
  cube.add(createBox([0.18, 0.28, 0.14], [-0.52, 0.92, 0.5], materials.metalDark));
  cube.add(createBox([0.7, 0.1, 0.48], [0.76, 0.54, 0.9], materials.chair));
  cube.add(createBox([0.7, 0.8, 0.1], [0.76, 0.98, 1.16], materials.chair));
  group.add(cube);
}

function createThemeMaterials(overrides = {}) {
  const palette = {
    slab: 0x565d62,
    pavement: 0xd8d1c4,
    facade: 0xd7ddd8,
    facadeAlt: 0xb9c8cf,
    facadeDark: 0x8aa0aa,
    roof: 0x4d555c,
    trim: 0xf2eee4,
    trimDark: 0x8e979e,
    glass: 0x789eb2,
    glassLite: 0xbfdfe8,
    door: 0x27313a,
    sign: 0x263746,
    signFace: 0xf7f2df,
    signShadow: 0x101820,
    accent: 0xd8a044,
    accentDark: 0x8f6630,
    metal: 0xc4ccd2,
    metalDark: 0x59636b,
    floor: 0x6a7177,
    floorStripe: 0x7c858c,
    floorAccent: 0x5b6269,
    wood: 0xa97948,
    woodDark: 0x68452b,
    chair: 0x49637b,
    green: 0x5e8d58,
    red: 0xb9413e,
    blue: 0x3d78a0,
    gold: 0xd2aa44,
    slotBody: 0x9b2f3d,
    partition: 0xabb6bd,
    screen: 0x293542,
    ...overrides
  };

  return Object.fromEntries(
    Object.entries(palette).map(([key, color]) => [
      key,
      createMaterial(color, key.includes('metal') ? 0.88 : 0.96, key.includes('metal') ? 0.12 : 0.04)
    ])
  );
}

function createBaseGroups(key) {
  const building = new THREE.Group();
  building.name = `${key}_building`;

  const groups = {
    building,
    foundation: new THREE.Group(),
    shell: new THREE.Group(),
    roof: new THREE.Group(),
    upper: new THREE.Group(),
    exterior: new THREE.Group(),
    interior: new THREE.Group()
  };

  groups.foundation.name = `${key}_foundation`;
  groups.shell.name = `${key}_hull_wall`;
  groups.roof.name = `${key}_cutaway_roof`;
  groups.upper.name = `${key}_cutaway_upper`;
  groups.exterior.name = `${key}_exterior_detail`;
  groups.interior.name = `${key}_interior`;

  building.add(groups.foundation);
  building.add(groups.shell);
  building.add(groups.roof);
  building.add(groups.upper);
  building.add(groups.exterior);
  building.add(groups.interior);

  return groups;
}

function addCommonBuildingShell(groups, materials, options = {}) {
  const wallHeight = options.wallHeight ?? 7.6;
  addBoxes(groups.foundation, [
    { size: [22.8, 0.62, 22.6], position: [0, 0.31, 0], material: materials.slab },
    { size: [18.8, 0.16, 2.6], position: [0, 0.68, 10.0], material: materials.pavement },
    { size: [7.2, 0.18, 1.2], position: [0, 0.74, 11.1], material: materials.trimDark }
  ]);

  addFloorPanels(groups.interior, {
    width: 20.6,
    depth: 18.9,
    centerX: 0,
    centerY: 0.72,
    centerZ: 0.35,
    panelCount: 13,
    baseMaterial: materials.floor,
    stripeMaterial: materials.floorStripe,
    accentMaterial: materials.floorAccent
  });

  addShellBlock(groups.shell, {
    centerX: 0,
    centerY: 0.58 + (wallHeight * 0.5),
    centerZ: 0.35,
    width: 21.7,
    height: wallHeight,
    depth: 20.9,
    material: materials.facade,
    roofGroup: groups.roof,
    roofMaterial: materials.roof,
    doorwaySide: 'front',
    doorwayWidth: 6.7,
    doorwayHeight: 3.55
  });

  const upper = options.upper ?? {};
  addShellBlock(groups.upper, {
    centerX: upper.centerX ?? 0,
    centerY: upper.centerY ?? 10.05,
    centerZ: upper.centerZ ?? -2.8,
    width: upper.width ?? 14.8,
    height: upper.height ?? 4.7,
    depth: upper.depth ?? 8.4,
    material: materials.facadeAlt,
    roofGroup: groups.roof,
    roofMaterial: materials.roof
  });

  addParapetRect(groups.roof, {
    centerX: 0,
    centerY: 0.58 + wallHeight + 0.16,
    centerZ: 0.35,
    width: 21.3,
    depth: 20.5,
    parapetHeight: 0.34,
    thickness: 0.2,
    material: materials.trim
  });

  addParapetRect(groups.roof, {
    centerX: upper.centerX ?? 0,
    centerY: (upper.centerY ?? 10.05) + ((upper.height ?? 4.7) * 0.5) + 0.16,
    centerZ: upper.centerZ ?? -2.8,
    width: (upper.width ?? 14.8) - 0.4,
    depth: (upper.depth ?? 8.4) - 0.4,
    parapetHeight: 0.26,
    thickness: 0.18,
    material: materials.trim
  });

  addDoorTrim(groups.exterior, materials, { accentMaterial: options.doorAccentMaterial ?? materials.trim });
  addRooftopUnit(groups.roof, [-5.4, 8.48, -4.1], materials, 0.24);
  addRooftopUnit(groups.roof, [5.2, 8.48, -2.3], materials, -0.18);
}

function addStandardSideWindows(groups, materials) {
  for (const x of [-10.92, 10.92]) {
    for (const z of [-6.8, -3.6, -0.4, 2.8, 6.0]) {
      addSideWindow(groups.exterior, {
        x,
        y: 3.2,
        z,
        width: 1.3,
        height: 1.4,
        glassMaterial: materials.glass,
        frameMaterial: materials.trim
      });
    }
  }
}

function addSchoolDetails(groups, materials) {
  addBoxes(groups.exterior, [
    { size: [21.3, 0.28, 0.22], position: [0, 7.76, 10.82], material: materials.trim },
    { size: [21.1, 0.22, 0.22], position: [0, 4.72, 10.84], material: materials.accent },
    { size: [9.6, 2.1, 0.42], position: [0, 6.28, 10.98], material: materials.sign },
    { size: [7.7, 0.24, 1.9], position: [0, 4.55, 10.92], material: materials.accent, rotation: [0.18, 0, 0] }
  ]);
  addSignText(groups.exterior, 'SCHOOL', {
    centerX: 0,
    y: 6.34,
    z: 11.24,
    pixelSize: 0.26,
    depth: 0.18,
    material: materials.signFace,
    shadowMaterial: materials.signShadow
  });

  for (const x of [-7.6, -5.0, 5.0, 7.6]) {
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 2.75,
      z: 10.96,
      width: 1.72,
      height: 2.1,
      glassMaterial: materials.glassLite,
      frameMaterial: materials.trim,
      sillMaterial: materials.trimDark,
      mullions: 1
    });
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 6.05,
      z: 10.96,
      width: 1.42,
      height: 1.1,
      glassMaterial: materials.glass,
      frameMaterial: materials.trim,
      sillMaterial: materials.trimDark,
      mullions: 0
    });
  }
  addStandardSideWindows(groups, materials);

  const clock = new THREE.Group();
  clock.add(createCylinder(0.78, 0.78, 0.16, 24, [0, 0, 0], materials.signFace, [Math.PI * 0.5, 0, 0]));
  clock.add(createCylinder(0.64, 0.64, 0.08, 24, [0, 0, 0.08], materials.trim, [Math.PI * 0.5, 0, 0]));
  clock.add(createBox([0.08, 0.48, 0.08], [0, 0.14, 0.18], materials.signShadow));
  clock.add(createBox([0.42, 0.08, 0.08], [0.18, 0, 0.18], materials.signShadow));
  clock.position.set(0, 8.36, 10.98);
  groups.exterior.add(clock);

  groups.exterior.add(createCylinder(0.08, 0.08, 5.7, 8, [-9.4, 3.22, 9.6], materials.metalDark));
  addBoxes(groups.exterior, [
    { size: [1.45, 0.76, 0.06], position: [-8.72, 5.6, 9.6], material: materials.accent },
    { size: [1.45, 0.36, 0.07], position: [-8.72, 5.06, 9.6], material: materials.signFace }
  ]);

  addBoxes(groups.interior, [
    { size: [8.4, 1.9, 0.18], position: [0, 2.35, -8.85], material: materials.green },
    { size: [8.8, 0.14, 0.22], position: [0, 1.34, -8.74], material: materials.trim },
    { size: [3.0, 0.22, 1.2], position: [0, 1.0, -6.8], material: materials.wood }
  ]);
  for (const x of [-6.0, -3.0, 0, 3.0, 6.0]) {
    for (const z of [-2.6, 0.1, 2.8, 5.5]) {
      addDesk(groups.interior, [x, 0, z], materials, Math.PI);
    }
  }
  for (const x of [-10.0, 10.0]) {
    for (const z of [-6.5, -4.4, -2.3, -0.2]) {
      groups.interior.add(createBox([0.34, 1.65, 1.18], [x, 1.52, z], materials.facadeDark));
      groups.interior.add(createBox([0.38, 0.12, 1.1], [x, 1.52, z], materials.trim));
    }
  }
}

function addBarDetails(groups, materials) {
  addBoxes(groups.exterior, [
    { size: [21.3, 0.26, 0.22], position: [0, 7.6, 10.82], material: materials.trim },
    { size: [20.8, 3.3, 0.48], position: [0, 5.48, 10.98], material: materials.sign },
    { size: [20.9, 0.2, 0.26], position: [0, 3.66, 11.0], material: materials.accentDark },
    { size: [8.2, 0.3, 2.4], position: [0, 4.45, 10.7], material: materials.accent, rotation: [0.2, 0, 0] }
  ]);
  addSignText(groups.exterior, 'BAR', {
    centerX: 0,
    y: 5.74,
    z: 11.34,
    pixelSize: 0.48,
    depth: 0.26,
    material: materials.signFace,
    shadowMaterial: materials.signShadow
  });

  for (const x of [-7.6, -5.2, 5.2, 7.6]) {
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 2.3,
      z: 11.02,
      width: 1.6,
      height: 1.45,
      glassMaterial: materials.gold,
      frameMaterial: materials.trim,
      sillMaterial: materials.accentDark,
      mullions: 0
    });
  }
  addStandardSideWindows(groups, materials);

  const mug = new THREE.Group();
  mug.add(createCylinder(0.75, 0.62, 1.55, 14, [0, 0, 0], materials.glassLite));
  mug.add(createCylinder(0.6, 0.54, 1.08, 14, [0, -0.12, 0], materials.gold));
  mug.add(createSphere(0.36, 10, 8, [-0.36, 0.86, 0], materials.signFace));
  mug.add(createSphere(0.42, 10, 8, [0.16, 0.96, 0], materials.signFace));
  mug.add(createTorus(0.48, 0.1, 8, 14, [0.86, -0.02, 0], materials.glassLite, [0, 0, Math.PI * 0.5]));
  mug.position.set(0, 9.35, 10.74);
  mug.rotation.z = -0.08;
  groups.exterior.add(mug);

  addBoxes(groups.interior, [
    { size: [13.0, 1.25, 1.25], position: [-2.4, 1.18, -7.1], material: materials.woodDark },
    { size: [13.2, 0.28, 1.5], position: [-2.4, 1.94, -7.1], material: materials.wood },
    { size: [0.34, 2.6, 7.0], position: [-8.6, 1.64, -3.4], material: materials.woodDark },
    { size: [4.8, 2.1, 0.24], position: [-5.8, 2.1, -9.0], material: materials.glass },
    { size: [4.8, 0.18, 0.34], position: [-5.8, 3.26, -8.85], material: materials.trim }
  ]);
  for (const x of [-7.0, -4.8, -2.6, -0.4, 1.8]) {
    groups.interior.add(createCylinder(0.36, 0.42, 0.86, 12, [x, 0.62, -5.35], materials.chair));
    groups.interior.add(createCylinder(0.18, 0.18, 0.86, 8, [x, 0.98, -5.35], materials.metalDark));
  }
  for (const position of [[4.9, 0, -2.2], [7.2, 0, 1.8], [3.6, 0, 5.6]]) {
    addRoundTable(groups.interior, position, materials);
  }
  for (const [x, z] of [[8.5, -7.1], [9.4, -5.7], [8.5, -4.3]]) {
    groups.interior.add(createCylinder(0.46, 0.52, 1.05, 10, [x, 1.0, z], materials.wood));
    groups.interior.add(createCylinder(0.54, 0.54, 0.1, 10, [x, 1.45, z], materials.metalDark));
    groups.interior.add(createCylinder(0.54, 0.54, 0.1, 10, [x, 0.56, z], materials.metalDark));
  }
}

function addBankDetails(groups, materials) {
  addBoxes(groups.exterior, [
    { size: [21.4, 0.28, 0.22], position: [0, 7.92, 10.84], material: materials.trim },
    { size: [12.4, 1.85, 0.42], position: [0, 6.52, 11.04], material: materials.sign },
    { size: [16.8, 0.44, 1.9], position: [0, 4.68, 10.7], material: materials.trim, rotation: [0.18, 0, 0] }
  ]);
  for (const x of [-8.2, -5.2, 5.2, 8.2]) {
    groups.exterior.add(createCylinder(0.34, 0.42, 4.0, 16, [x, 2.65, 10.68], materials.trim));
    groups.exterior.add(createCylinder(0.52, 0.52, 0.22, 16, [x, 0.92, 10.68], materials.trimDark));
    groups.exterior.add(createCylinder(0.48, 0.48, 0.22, 16, [x, 4.54, 10.68], materials.trimDark));
  }
  addSignText(groups.exterior, 'BANK', {
    centerX: 0,
    y: 6.5,
    z: 11.28,
    pixelSize: 0.36,
    depth: 0.22,
    material: materials.signFace,
    shadowMaterial: materials.signShadow
  });

  for (const x of [-7.0, -4.6, 4.6, 7.0]) {
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 2.2,
      z: 11.02,
      width: 1.25,
      height: 1.7,
      glassMaterial: materials.glassLite,
      frameMaterial: materials.trim,
      sillMaterial: materials.trimDark,
      mullions: 1
    });
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 5.6,
      z: 11.0,
      width: 1.15,
      height: 1.08,
      glassMaterial: materials.glass,
      frameMaterial: materials.trim,
      sillMaterial: materials.trimDark,
      mullions: 0
    });
  }
  addStandardSideWindows(groups, materials);

  const coin = new THREE.Group();
  coin.add(createCylinder(0.78, 0.78, 0.18, 24, [0, 0, 0], materials.gold, [Math.PI * 0.5, 0, 0]));
  coin.add(createBox([0.18, 1.0, 0.1], [0, 0, 0.12], materials.signFace));
  coin.add(createBox([0.7, 0.14, 0.1], [0, 0.3, 0.13], materials.signFace));
  coin.add(createBox([0.7, 0.14, 0.1], [0, -0.3, 0.13], materials.signFace));
  coin.position.set(0, 8.82, 10.96);
  groups.exterior.add(coin);

  addBoxes(groups.interior, [
    { size: [15.4, 1.25, 1.2], position: [0, 1.18, -5.4], material: materials.trimDark },
    { size: [15.6, 0.28, 1.42], position: [0, 1.96, -5.4], material: materials.trim },
    { size: [0.18, 2.0, 1.0], position: [-5.0, 2.3, -5.0], material: materials.glassLite },
    { size: [0.18, 2.0, 1.0], position: [0, 2.3, -5.0], material: materials.glassLite },
    { size: [0.18, 2.0, 1.0], position: [5.0, 2.3, -5.0], material: materials.glassLite },
    { size: [3.2, 3.2, 0.42], position: [8.3, 2.42, -8.7], material: materials.metalDark }
  ]);
  groups.interior.add(createCylinder(1.32, 1.32, 0.28, 24, [8.3, 2.42, -8.42], materials.metal, [Math.PI * 0.5, 0, 0]));
  groups.interior.add(createCylinder(0.48, 0.48, 0.34, 18, [8.3, 2.42, -8.2], materials.signShadow, [Math.PI * 0.5, 0, 0]));
  for (const x of [-5.8, -1.9, 1.9, 5.8]) {
    groups.interior.add(createCylinder(0.08, 0.08, 1.02, 8, [x, 1.2, 0.0], materials.metalDark));
    groups.interior.add(createCylinder(0.08, 0.08, 1.02, 8, [x, 1.2, 2.4], materials.metalDark));
    groups.interior.add(createBox([3.3, 0.08, 0.08], [x + 1.7, 1.7, 0.0], materials.accent));
    groups.interior.add(createBox([3.3, 0.08, 0.08], [x + 1.7, 1.7, 2.4], materials.accent));
  }
  for (const x of [-6.2, -2.0, 2.0]) {
    addDesk(groups.interior, [x, 0, -7.8], materials, 0);
  }
}

function addCasinoDetails(groups, materials) {
  addBoxes(groups.exterior, [
    { size: [21.4, 0.28, 0.22], position: [0, 7.62, 10.84], material: materials.gold },
    { size: [20.2, 2.55, 0.5], position: [0, 5.82, 11.02], material: materials.sign },
    { size: [20.4, 0.34, 2.7], position: [0, 4.26, 10.62], material: materials.accent, rotation: [0.16, 0, 0] }
  ]);
  addSignText(groups.exterior, 'CASINO', {
    centerX: 0,
    y: 5.92,
    z: 11.34,
    pixelSize: 0.34,
    depth: 0.24,
    material: materials.signFace,
    shadowMaterial: materials.signShadow
  });
  for (let index = 0; index < 13; index += 1) {
    const x = -9 + (index * 1.5);
    groups.exterior.add(createSphere(0.18, 10, 8, [x, 7.28, 11.22], index % 2 === 0 ? materials.gold : materials.signFace));
    groups.exterior.add(createSphere(0.16, 10, 8, [x, 4.36, 11.22], index % 2 === 0 ? materials.signFace : materials.gold));
  }

  for (const x of [-7.6, -5.2, 5.2, 7.6]) {
    addDetailedFrontWindow(groups.exterior, {
      x,
      y: 2.2,
      z: 11.02,
      width: 1.55,
      height: 1.35,
      glassMaterial: materials.glass,
      frameMaterial: materials.gold,
      sillMaterial: materials.accentDark,
      mullions: 0
    });
  }
  addStandardSideWindows(groups, materials);

  const chip = new THREE.Group();
  chip.add(createCylinder(1.05, 1.05, 0.28, 24, [0, 0, 0], materials.signFace, [Math.PI * 0.5, 0, 0]));
  chip.add(createCylinder(0.72, 0.72, 0.32, 24, [0, 0, 0.02], materials.red, [Math.PI * 0.5, 0, 0]));
  for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    chip.add(createBox([0.34, 0.62, 0.08], [Math.sin(angle) * 0.82, Math.cos(angle) * 0.82, 0.24], materials.signFace, [0, 0, -angle]));
  }
  chip.position.set(-5.9, 9.15, 10.92);
  chip.rotation.z = 0.2;
  groups.exterior.add(chip);

  const dice = new THREE.Group();
  dice.add(createBox([1.46, 1.46, 1.46], [0, 0, 0], materials.signFace, [0.18, 0.34, 0.12]));
  for (const [x, y] of [[-0.32, -0.32], [0.32, 0.32], [-0.32, 0.32], [0.32, -0.32]]) {
    dice.add(createSphere(0.08, 8, 6, [x, y, 0.77], materials.signShadow));
  }
  dice.position.set(6.2, 9.15, 10.78);
  groups.exterior.add(dice);

  for (const position of [[-5.8, 0, -4.5], [0, 0, -2.6], [5.8, 0, -4.5]]) {
    groups.interior.add(createCylinder(1.68, 1.68, 0.2, 24, [position[0], 1.02, position[2]], materials.green));
    groups.interior.add(createCylinder(1.72, 1.72, 0.12, 24, [position[0], 0.88, position[2]], materials.gold));
    for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
      groups.interior.add(createCylinder(0.28, 0.34, 0.68, 10, [position[0] + Math.sin(angle) * 2.15, 0.45, position[2] + Math.cos(angle) * 2.15], materials.chair));
    }
  }
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      addSlotMachine(groups.interior, [-7.6 + (col * 1.85), 0, 4.2 + (row * 2.2)], materials, row === 0 ? 0 : Math.PI);
    }
  }
  for (const [x, z] of [[7.0, 4.2], [8.8, 4.2], [7.0, 6.4], [8.8, 6.4]]) {
    groups.interior.add(createCylinder(0.22, 0.22, 0.18, 14, [x, 1.16, z], materials.red));
    groups.interior.add(createCylinder(0.2, 0.2, 0.18, 14, [x, 1.36, z], materials.gold));
  }
}

function addOfficesDetails(groups, materials) {
  addBoxes(groups.exterior, [
    { size: [21.2, 0.28, 0.22], position: [0, 8.4, 10.84], material: materials.trim },
    { size: [19.8, 0.26, 0.2], position: [0, 5.65, 10.86], material: materials.trimDark },
    { size: [8.4, 1.28, 0.38], position: [0, 6.98, 11.02], material: materials.sign }
  ]);
  addSignText(groups.exterior, 'OFFICES', {
    centerX: 0,
    y: 6.98,
    z: 11.26,
    pixelSize: 0.22,
    depth: 0.18,
    material: materials.signFace,
    shadowMaterial: materials.signShadow
  });

  for (const y of [2.1, 3.82, 5.54, 7.26]) {
    for (const x of [-8.3, -6.0, -3.7, 3.7, 6.0, 8.3]) {
      addDetailedFrontWindow(groups.exterior, {
        x,
        y,
        z: 11.02,
        width: 1.34,
        height: 1.0,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
    }
  }
  for (const x of [-10.92, 10.92]) {
    for (const y of [2.3, 4.1, 5.9, 7.7]) {
      for (const z of [-6.6, -3.8, -1.0, 1.8, 4.6]) {
        addSideWindow(groups.exterior, {
          x,
          y,
          z,
          width: 1.02,
          height: 0.95,
          glassMaterial: materials.glass,
          frameMaterial: materials.trimDark
        });
      }
    }
  }

  for (const y of [10.3, 12.0, 13.7]) {
    for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
      addDetailedFrontWindow(groups.upper, {
        x,
        y,
        z: 1.52,
        width: 1.35,
        height: 0.86,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
    }
  }

  for (const x of [-6.0, -2.0, 2.0, 6.0]) {
    for (const z of [-5.2, -1.6, 2.0, 5.6]) {
      addCubicle(groups.interior, [x, 0, z], materials, z > 0 ? Math.PI : 0);
    }
  }
  addBoxes(groups.interior, [
    { size: [6.4, 0.22, 2.1], position: [0, 1.02, -8.0], material: materials.wood },
    { size: [0.16, 1.35, 1.4], position: [-8.8, 1.32, 8.0], material: materials.glassLite },
    { size: [0.16, 1.35, 1.4], position: [8.8, 1.32, 8.0], material: materials.glassLite }
  ]);
  groups.interior.add(createCylinder(0.32, 0.32, 1.35, 14, [-8.8, 1.08, 6.7], materials.glassLite));
  groups.interior.add(createCylinder(0.38, 0.38, 0.18, 14, [-8.8, 1.84, 6.7], materials.blue));
}

function buildDistrictBuilding(definition) {
  const scene = new THREE.Scene();
  const groups = createBaseGroups(definition.key);
  const materials = createThemeMaterials(definition.palette);

  addCommonBuildingShell(groups, materials, definition.shell);
  definition.decorate(groups, materials);
  optimizeBuildingGroups(groups);

  tagGroupMeshes(groups.roof, `${definition.key}_cutaway_roof`);
  tagGroupMeshes(groups.upper, `${definition.key}_cutaway_upper`);

  scene.add(groups.building);
  return scene;
}

const BUILDINGS = Object.freeze([
  {
    key: 'school',
    fileName: 'school-building.glb',
    palette: {
      facade: 0xcad5c8,
      facadeAlt: 0xa9c0bd,
      sign: 0x315944,
      accent: 0xd8b34d,
      accentDark: 0x765f2c,
      floor: 0x66766f,
      floorStripe: 0x74857d,
      floorAccent: 0x5b6762,
      chair: 0x446584,
      green: 0x355d43
    },
    shell: {
      wallHeight: 7.8,
      upper: { centerY: 10.18, centerZ: -3.2, width: 13.8, height: 4.4, depth: 7.6 }
    },
    decorate: addSchoolDetails
  },
  {
    key: 'bar',
    fileName: 'bar-building.glb',
    palette: {
      facade: 0xb68a61,
      facadeAlt: 0x8b6040,
      sign: 0x542817,
      accent: 0x9c6232,
      accentDark: 0x3c2115,
      trim: 0xf0dec0,
      trimDark: 0x74563c,
      glass: 0x586f73,
      glassLite: 0xe0c172,
      floor: 0x58483a,
      floorStripe: 0x665441,
      floorAccent: 0x493b31,
      chair: 0x5e3422
    },
    shell: {
      wallHeight: 7.3,
      upper: { centerY: 9.78, centerZ: -2.7, width: 12.6, height: 4.3, depth: 7.4 }
    },
    decorate: addBarDetails
  },
  {
    key: 'bank',
    fileName: 'bank-building.glb',
    palette: {
      facade: 0xd8d4c8,
      facadeAlt: 0xbfc3bc,
      sign: 0x2d4151,
      accent: 0xd0a74a,
      accentDark: 0x8a753a,
      trim: 0xf0eadc,
      trimDark: 0x9a9a92,
      floor: 0x74756f,
      floorStripe: 0x81827b,
      floorAccent: 0x686963,
      chair: 0x52606d
    },
    shell: {
      wallHeight: 7.8,
      upper: { centerY: 10.12, centerZ: -3.0, width: 13.6, height: 4.4, depth: 7.8 }
    },
    decorate: addBankDetails
  },
  {
    key: 'casino',
    fileName: 'casino-building.glb',
    palette: {
      facade: 0x8f3942,
      facadeAlt: 0x634256,
      sign: 0x231d2f,
      accent: 0xc23c48,
      accentDark: 0x70232d,
      trim: 0xf0df99,
      trimDark: 0x8a6f38,
      glass: 0x6c6a8a,
      glassLite: 0xdcc76a,
      floor: 0x463d50,
      floorStripe: 0x53475e,
      floorAccent: 0x3b3444,
      chair: 0x7a2632,
      slotBody: 0x9a2638
    },
    shell: {
      wallHeight: 7.5,
      upper: { centerY: 9.98, centerZ: -2.8, width: 14.2, height: 4.4, depth: 7.8 }
    },
    decorate: addCasinoDetails
  },
  {
    key: 'offices',
    fileName: 'offices-building.glb',
    palette: {
      facade: 0xc8d0d5,
      facadeAlt: 0x879aa8,
      sign: 0x263746,
      accent: 0x5a8fb5,
      accentDark: 0x355a78,
      trim: 0xe6eaec,
      trimDark: 0x66727a,
      glass: 0x6f9bb4,
      glassLite: 0xb7dce8,
      floor: 0x5d666c,
      floorStripe: 0x68737a,
      floorAccent: 0x525a60,
      chair: 0x415565,
      partition: 0xaeb8be,
      screen: 0x253542
    },
    shell: {
      wallHeight: 8.4,
      upper: { centerY: 12.15, centerZ: -2.8, width: 14.6, height: 7.0, depth: 8.2 }
    },
    decorate: addOfficesDetails
  }
]);

async function exportBuilding(definition, exporter) {
  const outputPath = path.join(outputDirectory, definition.fileName);
  const scene = buildDistrictBuilding(definition);
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

async function main() {
  const exporter = new GLTFExporter();
  await fs.mkdir(outputDirectory, { recursive: true });
  for (const definition of BUILDINGS) {
    await exportBuilding(definition, exporter);
  }
}

await main();
