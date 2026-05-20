import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  OFFICE_INTERIOR_FLOOR_IDS,
  getOfficeInteriorFloorHeight
} from '../src/shared/officeInteriorLayout.js';

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
const outputDirectory = path.join(projectRoot, 'assets', 'vibe_theft_auto_custom', 'models');
const CASINO_GREEN_TABLE_POSITIONS = Object.freeze([
  [-5.8, 0, -2.5],
  [0, 0, -0.6],
  [5.8, 0, -2.5]
]);

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

function createGlassMaterial(color, opacity = 0.42) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.18,
    metalness: 0.05,
    transmission: 0.38,
    thickness: 0.18,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.72
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

const WINDOW_GLASS_DEPTH = 0.08;
const WINDOW_TRIM_DEPTH = 0.08;
const WINDOW_TRIM_THICKNESS = 0.12;
const WINDOW_FACE_GAP = 0.035;
const WINDOW_LIP_DEPTH = 0.16;

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
  const chars = String(text).toUpperCase();
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
  includeRoof = true,
  doorwaySide = '',
  doorwayWidth = 0,
  doorwayHeight = 0,
  doorwayOffset = 0,
  wallGroups = null
}) {
  const targetRoofGroup = roofGroup ?? group;
  const getWallGroup = (side) => wallGroups?.[side] ?? group;
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
    const wallGroup = getWallGroup(side);

    if (!hasDoorway) {
      wallGroup.add(createBox([width, height, wallThickness], [centerX, centerY, z], material));
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
      wallGroup.add(createBox(
        [leftWidth, height, wallThickness],
        [centerX + ((leftBoundary + doorMin) * 0.5), centerY, z],
        material
      ));
    }

    if (rightWidth > 0.08) {
      wallGroup.add(createBox(
        [rightWidth, height, wallThickness],
        [centerX + ((doorMax + rightBoundary) * 0.5), centerY, z],
        material
      ));
    }

    if (topHeight > 0.08) {
      wallGroup.add(createBox(
        [clampedDoorwayWidth, topHeight, wallThickness],
        [centerX + doorwayCenterX, centerY - halfHeight + clampedDoorwayHeight + (topHeight * 0.5), z],
        material
      ));
    }
  };

  addFrontOrBackWall('back');
  addFrontOrBackWall('front');
  getWallGroup('left').add(createBox(
    [wallThickness, height, depth],
    [centerX - halfWidth + (wallThickness * 0.5), centerY, centerZ],
    material
  ));
  getWallGroup('right').add(createBox(
    [wallThickness, height, depth],
    [centerX + halfWidth - (wallThickness * 0.5), centerY, centerZ],
    material
  ));
  if (includeRoof && roofThickness > 0) {
    targetRoofGroup.add(createBox(
      [width, roofThickness, depth],
      [centerX, centerY + halfHeight - (roofThickness * 0.5), centerZ],
      roofMaterial
    ));
  }
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
  const trimZ = z + (WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5);
  const lipZ = z + (WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_LIP_DEPTH * 0.5);
  const sideX = (width * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  const topY = (height * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  group.add(createBox([width, height, WINDOW_GLASS_DEPTH], [x, y, z], glassMaterial));
  group.add(createBox([WINDOW_TRIM_THICKNESS, height + 0.26, WINDOW_TRIM_DEPTH], [x - sideX, y, trimZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_THICKNESS, height + 0.26, WINDOW_TRIM_DEPTH], [x + sideX, y, trimZ], frameMaterial));
  group.add(createBox([width, WINDOW_TRIM_THICKNESS, WINDOW_TRIM_DEPTH], [x, y + topY, trimZ], frameMaterial));
  group.add(createBox([width, WINDOW_TRIM_THICKNESS, WINDOW_TRIM_DEPTH], [x, y - topY, trimZ], frameMaterial));
  group.add(createBox([width + 0.18, 0.08, WINDOW_LIP_DEPTH], [x, y - topY - 0.1, lipZ], sillMaterial));
  group.add(createBox([width + 0.14, 0.07, WINDOW_LIP_DEPTH], [x, y + topY + 0.1, lipZ], frameMaterial));

  for (let index = 1; index <= mullions; index += 1) {
    const t = index / (mullions + 1);
    const mullionX = x - (width * 0.5) + (width * t);
    group.add(createBox([0.08, height + 0.08, WINDOW_TRIM_DEPTH], [mullionX, y, trimZ], frameMaterial));
  }
}

function addDetailedBackWindow(group, {
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
  const trimZ = z - (WINDOW_GLASS_DEPTH * 0.5) - WINDOW_FACE_GAP - (WINDOW_TRIM_DEPTH * 0.5);
  const lipZ = z - (WINDOW_GLASS_DEPTH * 0.5) - WINDOW_FACE_GAP - (WINDOW_LIP_DEPTH * 0.5);
  const sideX = (width * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  const topY = (height * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  group.add(createBox([width, height, WINDOW_GLASS_DEPTH], [x, y, z], glassMaterial));
  group.add(createBox([WINDOW_TRIM_THICKNESS, height + 0.26, WINDOW_TRIM_DEPTH], [x - sideX, y, trimZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_THICKNESS, height + 0.26, WINDOW_TRIM_DEPTH], [x + sideX, y, trimZ], frameMaterial));
  group.add(createBox([width, WINDOW_TRIM_THICKNESS, WINDOW_TRIM_DEPTH], [x, y + topY, trimZ], frameMaterial));
  group.add(createBox([width, WINDOW_TRIM_THICKNESS, WINDOW_TRIM_DEPTH], [x, y - topY, trimZ], frameMaterial));
  group.add(createBox([width + 0.18, 0.08, WINDOW_LIP_DEPTH], [x, y - topY - 0.1, lipZ], sillMaterial));
  group.add(createBox([width + 0.14, 0.07, WINDOW_LIP_DEPTH], [x, y + topY + 0.1, lipZ], frameMaterial));

  for (let index = 1; index <= mullions; index += 1) {
    const t = index / (mullions + 1);
    const mullionX = x - (width * 0.5) + (width * t);
    group.add(createBox([0.08, height + 0.08, WINDOW_TRIM_DEPTH], [mullionX, y, trimZ], frameMaterial));
  }
}

function addDetailedSideWindow(group, {
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
  const outward = x < 0 ? -1 : 1;
  const trimX = x + (outward * ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5)));
  const lipX = x + (outward * ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_LIP_DEPTH * 0.5)));
  const sideZ = (width * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  const topY = (height * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  group.add(createBox([WINDOW_GLASS_DEPTH, height, width], [x, y, z], glassMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, height + 0.26, WINDOW_TRIM_THICKNESS], [trimX, y, z - sideZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, height + 0.26, WINDOW_TRIM_THICKNESS], [trimX, y, z + sideZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, WINDOW_TRIM_THICKNESS, width], [trimX, y + topY, z], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, WINDOW_TRIM_THICKNESS, width], [trimX, y - topY, z], frameMaterial));
  group.add(createBox([WINDOW_LIP_DEPTH, 0.08, width + 0.18], [lipX, y - topY - 0.1, z], sillMaterial));
  group.add(createBox([WINDOW_LIP_DEPTH, 0.07, width + 0.14], [lipX, y + topY + 0.1, z], frameMaterial));

  for (let index = 1; index <= mullions; index += 1) {
    const t = index / (mullions + 1);
    const mullionZ = z - (width * 0.5) + (width * t);
    group.add(createBox([WINDOW_TRIM_DEPTH, height + 0.08, 0.08], [trimX, y, mullionZ], frameMaterial));
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
  const outward = x < 0 ? -1 : 1;
  const trimX = x + (outward * ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5)));
  const sideZ = (width * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  const topY = (height * 0.5) + (WINDOW_TRIM_THICKNESS * 0.5);
  group.add(createBox([WINDOW_GLASS_DEPTH, height, width], [x, y, z], glassMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, height + 0.24, WINDOW_TRIM_THICKNESS], [trimX, y, z - sideZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, height + 0.24, WINDOW_TRIM_THICKNESS], [trimX, y, z + sideZ], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, WINDOW_TRIM_THICKNESS, width], [trimX, y + topY, z], frameMaterial));
  group.add(createBox([WINDOW_TRIM_DEPTH, WINDOW_TRIM_THICKNESS, width], [trimX, y - topY, z], frameMaterial));
  group.add(createBox([WINDOW_LIP_DEPTH, 0.08, width + 0.18], [trimX, y - topY - 0.1, z], frameMaterial));
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
    groups.shellBack,
    groups.shellLeft,
    groups.shellRight,
    groups.shellFront,
    groups.tower,
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

  const materials = {};
  for (const key in palette) {
    if (!Object.hasOwn(palette, key)) {
      continue;
    }
    const color = palette[key];
    const isMetal = key.includes('metal');
    materials[key] = createMaterial(color, isMetal ? 0.88 : 0.96, isMetal ? 0.12 : 0.04);
  }
  return materials;
}

function createBaseGroups(key) {
  const building = new THREE.Group();
  building.name = `${key}_building`;

  const groups = {
    building,
    foundation: new THREE.Group(),
    shell: new THREE.Group(),
    shellBack: new THREE.Group(),
    shellLeft: new THREE.Group(),
    shellRight: new THREE.Group(),
    shellFront: new THREE.Group(),
    tower: new THREE.Group(),
    roof: new THREE.Group(),
    upper: new THREE.Group(),
    exterior: new THREE.Group(),
    interior: new THREE.Group()
  };

  groups.foundation.name = `${key}_foundation`;
  groups.shell.name = `${key}_hull_wall`;
  groups.shellBack.name = `${key}_hull_wall_back`;
  groups.shellLeft.name = `${key}_hull_wall_left`;
  groups.shellRight.name = `${key}_hull_wall_right`;
  groups.shellFront.name = `${key}_hull_wall_front`;
  groups.tower.name = `${key}_cutaway_tower`;
  groups.roof.name = `${key}_cutaway_roof`;
  groups.upper.name = `${key}_cutaway_upper`;
  groups.exterior.name = `${key}_exterior_detail`;
  groups.interior.name = `${key}_interior`;

  building.add(groups.foundation);
  building.add(groups.shell);
  groups.shell.add(groups.shellBack);
  groups.shell.add(groups.shellLeft);
  groups.shell.add(groups.shellRight);
  groups.shell.add(groups.shellFront);
  building.add(groups.roof);
  building.add(groups.upper);
  building.add(groups.exterior);
  building.add(groups.interior);

  return groups;
}

function addCommonBuildingShell(groups, materials, options = {}) {
  const wallHeight = options.wallHeight ?? 7.6;
  const cutawayWallHeight = Number.isFinite(Number(options.cutawayWallHeight))
    ? THREE.MathUtils.clamp(Number(options.cutawayWallHeight), 0.5, wallHeight)
    : wallHeight;
  const upperWallHeight = Math.max(0, wallHeight - cutawayWallHeight);
  const splitWallForCutaway = upperWallHeight > 0.05;
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
    centerY: 0.58 + (cutawayWallHeight * 0.5),
    centerZ: 0.35,
    width: 21.7,
    height: cutawayWallHeight,
    depth: 20.9,
    material: materials.facade,
    roofGroup: splitWallForCutaway ? groups.shell : groups.roof,
    roofMaterial: materials.roof,
    includeRoof: !splitWallForCutaway,
    doorwaySide: 'front',
    doorwayWidth: 6.7,
    doorwayHeight: 3.55,
    wallGroups: {
      back: groups.shellBack,
      left: groups.shellLeft,
      right: groups.shellRight,
      front: groups.shellFront
    }
  });

  if (splitWallForCutaway) {
    groups.building.add(groups.tower);
    addShellBlock(groups.tower, {
      centerX: 0,
      centerY: 0.58 + cutawayWallHeight + (upperWallHeight * 0.5),
      centerZ: 0.35,
      width: 21.7,
      height: upperWallHeight,
      depth: 20.9,
      material: materials.facade,
      roofGroup: groups.roof,
      roofMaterial: materials.roof
    });
  }

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

  const roofUnits = options.roofUnits ?? [
    { position: [-5.4, 8.48, -4.1], rotationY: 0.24 },
    { position: [5.2, 8.48, -2.3], rotationY: -0.18 }
  ];
  for (const { position, rotationY = 0 } of roofUnits) {
    addRooftopUnit(groups.roof, position, materials, rotationY);
  }
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

const BANK_WALL_HEIGHT = 15.6;
const BANK_UPPER_HEIGHT = 8.8;
const BANK_UPPER_CENTER_Y = 20.24;
const BANK_UPPER_TOP_Y = BANK_UPPER_CENTER_Y + (BANK_UPPER_HEIGHT * 0.5);
const BANK_ROOF_UNIT_Y = BANK_UPPER_TOP_Y + 0.26;
const BANK_FRONT_DOOR_CLEAR_HALF_WIDTH = 3.74;
const BANK_FRONT_DOOR_GLASS_CLEAR_TOP_Y = 4.42;
const BANK_FRONT_GLASS_Z = 11.12;

function addBankDetails(groups, materials) {
  addModernBankGlassFacade(groups, materials);

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

function addBankFrontGlassPanel(group, material, {
  x,
  y,
  width,
  height,
  depth = 0.1,
  z = BANK_FRONT_GLASS_Z
}) {
  const minX = x - (width * 0.5);
  const maxX = x + (width * 0.5);
  const minY = y - (height * 0.5);
  const overlapsDoorX = minX < BANK_FRONT_DOOR_CLEAR_HALF_WIDTH && maxX > -BANK_FRONT_DOOR_CLEAR_HALF_WIDTH;
  const overlapsDoorY = minY < BANK_FRONT_DOOR_GLASS_CLEAR_TOP_Y;

  if (overlapsDoorX && overlapsDoorY) {
    throw new Error('Bank front glass panel overlaps the entrance door clearance.');
  }

  group.add(createBox([width, height, depth], [x, y, z], material));
}

function addModernBankGlassFacade(groups, materials) {
  const bankMaterials = {
    glass: createGlassMaterial(0xc7f3fb, 0.38),
    glassDeep: createGlassMaterial(0x9bd7e6, 0.44),
    glassHighlight: createMaterial(0xe7fbff, 0.34, 0.08),
    mullion: createMaterial(0x26343c, 0.48, 0.36),
    mullionLight: createMaterial(0xb9c5ca, 0.38, 0.26),
    signPanel: createMaterial(0x22313b, 0.52, 0.26),
    signLetter: createMaterial(0xf4fbff, 0.36, 0.1)
  };

  const lowerFrontRows = [5.18, 7.14, 9.1, 11.06, 13.02, 14.98];
  const sideWindowRows = [2.62, 4.74, 6.86, 8.98, 11.1, 13.22, 17.86, 19.78, 21.7, 23.42];
  const backWindowRows = [3.02, 5.14, 7.26, 9.38, 11.5, 13.62, 17.86, 19.78, 21.7, 23.42];

  addBoxes(groups.exterior, [
    { size: [21.6, 0.34, 0.36], position: [0, 16.04, 10.98], material: bankMaterials.mullion },
    { size: [9.7, 0.96, 0.28], position: [0, 7.42, 11.2], material: bankMaterials.signPanel },
    { size: [8.6, 0.2, 2.24], position: [0, 4.68, 10.82], material: bankMaterials.glassDeep, rotation: [0.1, 0, 0] },
    { size: [8.85, 0.16, 0.16], position: [0, 4.52, 11.74], material: bankMaterials.mullionLight },
    { size: [8.95, 0.14, 0.16], position: [0, 4.82, 9.86], material: bankMaterials.mullion }
  ]);
  for (const y of [2.02, 4.18, 6.14, 8.1, 10.06, 12.02, 13.98]) {
    groups.exterior.add(createBox([21.25, 0.18, 0.26], [0, y, 11.06], bankMaterials.mullionLight));
  }

  addSignText(groups.exterior, 'BANK', {
    centerX: 0,
    y: 7.42,
    z: 11.38,
    pixelSize: 0.29,
    depth: 0.18,
    material: bankMaterials.signLetter,
    shadowMaterial: materials.signShadow
  });

  for (const { x, width } of [
    { x: -8.9, width: 2.05 },
    { x: -6.35, width: 2.05 },
    { x: -4.65, width: 1.18 },
    { x: 4.65, width: 1.18 },
    { x: 6.35, width: 2.05 },
    { x: 8.9, width: 2.05 }
  ]) {
    addBankFrontGlassPanel(groups.exterior, bankMaterials.glassDeep, {
      x,
      y: 2.92,
      width,
      height: 3.18,
      depth: 0.12,
      z: 11.08
    });
  }
  for (const x of [-9.98, -7.62, -5.08, -3.86, 3.86, 5.08, 7.62, 9.98]) {
    groups.exterior.add(createBox([0.12, 14.16, 0.18], [x, 8.96, 11.18], bankMaterials.mullion));
  }
  for (const x of [-2.54, -1.22, 0, 1.22, 2.54]) {
    groups.exterior.add(createBox([0.12, 11.24, 0.18], [x, 10.42, 11.18], bankMaterials.mullion));
  }
  for (const y of lowerFrontRows) {
    for (const x of [-8.9, -6.35, -3.8, -1.25, 1.25, 3.8, 6.35, 8.9]) {
      addBankFrontGlassPanel(groups.exterior, bankMaterials.glass, {
        x,
        y,
        width: 2.05,
        height: 1.38
      });
      groups.exterior.add(createBox([1.52, 0.08, 0.12], [x, y + 0.5, 11.22], bankMaterials.glassHighlight));
    }
  }

  addBoxes(groups.exterior, [
    { size: [21.1, 6.95, 0.12], position: [0, BANK_UPPER_CENTER_Y, 10.84], material: bankMaterials.glassDeep },
    { size: [21.35, 0.16, 0.2], position: [0, 16.82, 10.92], material: bankMaterials.mullion },
    { size: [21.35, 0.16, 0.2], position: [0, 18.55, 10.92], material: bankMaterials.mullionLight },
    { size: [21.35, 0.16, 0.2], position: [0, 20.28, 10.92], material: bankMaterials.mullion },
    { size: [21.35, 0.16, 0.2], position: [0, 22.01, 10.92], material: bankMaterials.mullionLight },
    { size: [21.35, 0.16, 0.2], position: [0, 23.74, 10.92], material: bankMaterials.mullion }
  ]);
  for (const x of [-9.98, -7.62, -5.08, -2.54, 0, 2.54, 5.08, 7.62, 9.98]) {
    groups.exterior.add(createBox([0.11, 6.95, 0.18], [x, BANK_UPPER_CENTER_Y, 10.94], bankMaterials.mullion));
  }

  for (const sideX of [-10.98, 10.98]) {
    for (const y of sideWindowRows) {
      for (const z of [-7.3, -4.55, -1.8, 0.95, 3.7, 6.45]) {
        addDetailedSideWindow(groups.exterior, {
          x: sideX,
          y,
          z,
          width: 1.46,
          height: 1.2,
          glassMaterial: bankMaterials.glass,
          frameMaterial: bankMaterials.mullion,
          sillMaterial: bankMaterials.mullionLight,
          mullions: 0
        });
      }
    }
  }

  for (const y of backWindowRows) {
    for (const x of [-8.45, -5.65, -2.85, 0, 2.85, 5.65, 8.45]) {
      addDetailedBackWindow(groups.exterior, {
        x,
        y,
        z: -10.58,
        width: 1.42,
        height: 1.22,
        glassMaterial: bankMaterials.glass,
        frameMaterial: bankMaterials.mullion,
        sillMaterial: bankMaterials.mullionLight,
        mullions: 0
      });
    }
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

  for (const position of CASINO_GREEN_TABLE_POSITIONS) {
    groups.interior.add(createCylinder(1.68, 1.68, 0.2, 24, [position[0], 1.02, position[2]], materials.green));
    groups.interior.add(createCylinder(1.72, 1.72, 0.12, 24, [position[0], 0.88, position[2]], materials.gold));
    for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
      groups.interior.add(createCylinder(0.28, 0.34, 0.68, 10, [position[0] + Math.sin(angle) * 2.15, 0.45, position[2] + Math.cos(angle) * 2.15], materials.chair));
    }
  }
  for (const [x, z] of [[7.0, 4.2], [8.8, 4.2], [7.0, 6.4], [8.8, 6.4]]) {
    groups.interior.add(createCylinder(0.22, 0.22, 0.18, 14, [x, 1.16, z], materials.red));
    groups.interior.add(createCylinder(0.2, 0.2, 0.18, 14, [x, 1.36, z], materials.gold));
  }
}

const OFFICE_CUTAWAY_WALL_HEIGHT = 8.4;
const OFFICE_CUTAWAY_WALL_TOP_Y = 0.58 + OFFICE_CUTAWAY_WALL_HEIGHT;
const OFFICE_SKYSCRAPER_WALL_HEIGHT = 46.0;
const OFFICE_WINDOW_GRID_BOTTOM_Y = 1.6;
const OFFICE_MAIN_TOWER_START_Y = OFFICE_CUTAWAY_WALL_TOP_Y + 0.2;
const OFFICE_MAIN_TOWER_TOP_Y = 0.58 + OFFICE_SKYSCRAPER_WALL_HEIGHT;
const OFFICE_MAIN_FRONT_Z = 11.02;
const OFFICE_MAIN_BACK_Z = -10.32;
const OFFICE_MAIN_SIDE_X = 10.92;
const OFFICE_MAIN_SIDE_WINDOW_X = 10.98;
const OFFICE_PENTHOUSE_HEIGHT = 4.2;
const OFFICE_PENTHOUSE_BOTTOM_Y = OFFICE_MAIN_TOWER_TOP_Y + 0.18;
const OFFICE_PENTHOUSE_CENTER_Y = OFFICE_PENTHOUSE_BOTTOM_Y + (OFFICE_PENTHOUSE_HEIGHT * 0.5);
const OFFICE_PENTHOUSE_TOP_Y = OFFICE_PENTHOUSE_BOTTOM_Y + OFFICE_PENTHOUSE_HEIGHT;
const OFFICE_PENTHOUSE_CENTER_Z = -2.8;
const OFFICE_PENTHOUSE_WIDTH = 9.6;
const OFFICE_PENTHOUSE_DEPTH = 6.2;
const OFFICE_PENTHOUSE_FRONT_Z = OFFICE_PENTHOUSE_CENTER_Z + (OFFICE_PENTHOUSE_DEPTH * 0.5) + 0.22;
const OFFICE_PENTHOUSE_BACK_Z = OFFICE_PENTHOUSE_CENTER_Z - (OFFICE_PENTHOUSE_DEPTH * 0.5) - 0.22;
const OFFICE_PENTHOUSE_SIDE_X = (OFFICE_PENTHOUSE_WIDTH * 0.5) - 0.04;
const OFFICE_PENTHOUSE_SIDE_WINDOW_X = (OFFICE_PENTHOUSE_WIDTH * 0.5) + 0.18;
const OFFICE_LOBBY_FLOOR_Y = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby);
const OFFICE_CUBICLE_FLOOR_Y = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
const OFFICE_CEO_FLOOR_Y = getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo);

function getOfficeTowerWindowRows() {
  const rows = [];
  for (let y = OFFICE_MAIN_TOWER_START_Y + 1.55; y < OFFICE_MAIN_TOWER_TOP_Y - 1.2; y += 1.72) {
    rows.push(Number(y.toFixed(2)));
  }
  return rows;
}

function getOfficeSideBackWindowRows() {
  const rows = [];
  for (let y = 2.1; y < OFFICE_MAIN_TOWER_TOP_Y - 1.2; y += 1.72) {
    rows.push(Number(y.toFixed(2)));
  }
  return rows;
}

function addOfficeSideBackWindowGridSegment(group, materials, {
  bottomY,
  topY,
  rows
}) {
  const gridHeight = topY - bottomY;
  if (gridHeight <= 0.1) {
    return;
  }

  const gridCenterY = bottomY + (gridHeight * 0.5);
  const backColumns = [-8.2, -5.45, -2.7, 0, 2.7, 5.45, 8.2];
  const sideColumns = [-7.0, -4.35, -1.7, 0.95, 3.6, 6.25];

  for (const x of backColumns) {
    group.add(createBox(
      [1.35, gridHeight, 0.1],
      [x, gridCenterY, OFFICE_MAIN_BACK_Z],
      materials.glassLite
    ));
  }

  for (const z of sideColumns) {
    group.add(createBox(
      [0.1, gridHeight, 0.95],
      [-OFFICE_MAIN_SIDE_WINDOW_X, gridCenterY, z],
      materials.glassLite
    ));
    group.add(createBox(
      [0.1, gridHeight, 0.95],
      [OFFICE_MAIN_SIDE_WINDOW_X, gridCenterY, z],
      materials.glassLite
    ));
  }

  for (const y of rows) {
    const dividerY = Number((y + 0.52).toFixed(2));
    if (dividerY <= bottomY || dividerY >= topY) {
      continue;
    }

    group.add(createBox(
      [19.3, 0.045, WINDOW_TRIM_DEPTH],
      [0, dividerY, OFFICE_MAIN_BACK_Z - ((0.1 * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5))],
      materials.trimDark
    ));
    group.add(createBox(
      [WINDOW_TRIM_DEPTH, 0.045, 17.4],
      [-OFFICE_MAIN_SIDE_WINDOW_X - ((0.1 * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5)), dividerY, -0.35],
      materials.trimDark
    ));
    group.add(createBox(
      [WINDOW_TRIM_DEPTH, 0.045, 17.4],
      [OFFICE_MAIN_SIDE_WINDOW_X + ((0.1 * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5)), dividerY, -0.35],
      materials.trimDark
    ));
  }
}

function addOfficeFloorPanels(group, materials, floorY, {
  width = 20.4,
  depth = 18.6,
  centerZ = 0.35,
  panelCount = 13,
  baseMaterial = materials.floor,
  stripeMaterial = materials.floorStripe,
  accentMaterial = materials.floorAccent
} = {}) {
  addFloorPanels(group, {
    width,
    depth,
    centerX: 0,
    centerY: floorY - 0.08,
    centerZ,
    panelCount,
    baseMaterial,
    stripeMaterial,
    accentMaterial
  });
}

function addOfficeChair(group, position, materials, rotationY = 0) {
  const chair = new THREE.Group();
  chair.position.set(...position);
  chair.rotation.y = rotationY;
  chair.add(createBox([0.78, 0.14, 0.74], [0, 0.55, 0], materials.chair));
  chair.add(createBox([0.78, 0.86, 0.12], [0, 1.0, -0.34], materials.chair));
  for (const [x, z] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.24], [0.28, 0.24]]) {
    chair.add(createBox([0.08, 0.5, 0.08], [x, 0.26, z], materials.metalDark));
  }
  group.add(chair);
}

function addOfficeLobbyChairs(group, materials) {
  const floorY = OFFICE_LOBBY_FLOOR_Y;
  for (const [x, z, rotationY] of [
    [-3.2, 4.7, Math.PI],
    [-1.25, 4.7, Math.PI],
    [1.25, 4.7, Math.PI],
    [3.2, 4.7, Math.PI],
    [-4.35, 1.8, Math.PI * 0.5],
    [4.35, 1.8, -Math.PI * 0.5]
  ]) {
    addOfficeChair(group, [x, floorY, z], materials, rotationY);
  }

  group.add(createBox([5.8, 0.2, 1.25], [0, floorY + 0.82, 7.05], materials.wood));
  group.add(createBox([5.4, 0.18, 0.22], [0, floorY + 1.28, 6.45], materials.woodDark));
}

function addJanitorCloset(group, materials) {
  const floorY = OFFICE_LOBBY_FLOOR_Y;
  const wallY = floorY + 1.55;
  addBoxes(group, [
    { size: [4.8, 2.8, 0.16], position: [-7.35, wallY, -9.05], material: materials.partition },
    { size: [0.16, 2.8, 4.3], position: [-9.72, wallY, -6.9], material: materials.partition },
    { size: [0.16, 2.8, 4.3], position: [-4.98, wallY, -6.9], material: materials.partition },
    { size: [1.45, 2.8, 0.16], position: [-9.02, wallY, -4.78], material: materials.partition },
    { size: [1.45, 2.8, 0.16], position: [-5.68, wallY, -4.78], material: materials.partition },
    { size: [1.46, 2.35, 0.12], position: [-7.35, floorY + 1.42, -4.62], material: materials.door },
    { size: [3.35, 0.12, 0.58], position: [-7.35, floorY + 1.55, -8.55], material: materials.metalDark },
    { size: [3.35, 0.12, 0.58], position: [-7.35, floorY + 2.2, -8.55], material: materials.metalDark },
    { size: [0.48, 0.62, 0.48], position: [-8.45, floorY + 0.38, -7.82], material: materials.blue },
    { size: [0.52, 0.72, 0.52], position: [-6.25, floorY + 0.42, -7.74], material: materials.accent }
  ]);
  group.add(createCylinder(0.06, 0.06, 2.35, 8, [-8.75, floorY + 1.45, -5.72], materials.woodDark, [0.18, 0, -0.08]));
  group.add(createCylinder(0.24, 0.34, 0.44, 10, [-8.95, floorY + 0.34, -5.42], materials.green));
  group.add(createCylinder(0.05, 0.05, 2.18, 8, [-5.75, floorY + 1.37, -5.86], materials.woodDark, [-0.2, 0, 0.12]));
  group.add(createBox([0.5, 0.18, 0.1], [-5.55, floorY + 0.42, -5.55], materials.accentDark));
}

function addOfficeStaircase(group, materials, floorY, position, rotationY = 0) {
  const stairs = new THREE.Group();
  stairs.position.set(...position);
  stairs.rotation.y = rotationY;
  for (let step = 0; step < 8; step += 1) {
    stairs.add(createBox(
      [3.2, 0.18, 0.55],
      [0, floorY + 0.12 + (step * 0.16), step * 0.46],
      step % 2 === 0 ? materials.trimDark : materials.metalDark
    ));
  }
  stairs.add(createBox([0.12, 1.65, 4.2], [-1.76, floorY + 0.9, 1.62], materials.metalDark, [0.18, 0, 0]));
  stairs.add(createBox([0.12, 1.65, 4.2], [1.76, floorY + 0.9, 1.62], materials.metalDark, [0.18, 0, 0]));
  stairs.add(createBox([3.9, 0.12, 0.62], [0, floorY + 1.48, 3.75], materials.trim));
  group.add(stairs);
}

function addOfficeElevator(group, materials, floorY, position, rotationY = 0) {
  const elevator = new THREE.Group();
  elevator.position.set(...position);
  elevator.rotation.y = rotationY;
  elevator.add(createBox([2.7, 3.3, 0.22], [0, floorY + 1.78, 0], materials.metalDark));
  elevator.add(createBox([1.16, 2.72, 0.1], [-0.6, floorY + 1.54, 0.16], materials.metal));
  elevator.add(createBox([1.16, 2.72, 0.1], [0.6, floorY + 1.54, 0.16], materials.metal));
  elevator.add(createBox([0.08, 2.76, 0.14], [0, floorY + 1.54, 0.22], materials.trimDark));
  elevator.add(createBox([0.28, 0.72, 0.12], [1.72, floorY + 1.55, 0.2], materials.sign));
  elevator.add(createCylinder(0.08, 0.08, 0.04, 12, [1.72, floorY + 1.72, 0.28], materials.gold, [Math.PI * 0.5, 0, 0]));
  elevator.add(createCylinder(0.08, 0.08, 0.04, 12, [1.72, floorY + 1.42, 0.28], materials.glassLite, [Math.PI * 0.5, 0, 0]));
  group.add(elevator);
}

function addOfficeBreakRoom(group, materials) {
  const floorY = OFFICE_CUBICLE_FLOOR_Y;
  addBoxes(group, [
    { size: [5.4, 2.5, 0.14], position: [-7.25, floorY + 1.52, -8.98], material: materials.partition },
    { size: [0.14, 2.5, 5.5], position: [-9.78, floorY + 1.52, -6.2], material: materials.partition },
    { size: [0.14, 2.5, 2.0], position: [-4.62, floorY + 1.52, -8.0], material: materials.partition },
    { size: [3.15, 0.86, 0.74], position: [-7.45, floorY + 0.72, -7.86], material: materials.woodDark },
    { size: [3.4, 0.22, 0.92], position: [-7.45, floorY + 1.22, -7.86], material: materials.wood },
    { size: [1.1, 2.45, 0.88], position: [-9.0, floorY + 1.34, -7.82], material: materials.metal },
    { size: [0.92, 0.1, 0.92], position: [-9.0, floorY + 1.36, -7.32], material: materials.trimDark },
    { size: [0.82, 1.1, 0.64], position: [-6.46, floorY + 1.78, -7.62], material: materials.screen },
    { size: [0.56, 0.42, 0.5], position: [-6.46, floorY + 1.24, -7.38], material: materials.metalDark },
    { size: [0.42, 0.26, 0.42], position: [-5.78, floorY + 1.34, -7.46], material: materials.signFace }
  ]);
  group.add(createCylinder(0.24, 0.28, 0.46, 14, [-5.8, floorY + 1.55, -7.46], materials.gold));
  group.add(createCylinder(0.16, 0.16, 0.12, 14, [-5.8, floorY + 1.85, -7.46], materials.signShadow));
  addOfficeElevator(group, materials, floorY, [-8.55, 0, -3.25], Math.PI);
}

function addOfficeCubicleFloor(group, materials) {
  addOfficeFloorPanels(group, materials, OFFICE_CUBICLE_FLOOR_Y, { panelCount: 12 });
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
    addCubicle(group, [x, OFFICE_CUBICLE_FLOOR_Y, z], materials, rotationY);
  }

  addOfficeBreakRoom(group, materials);
  addOfficeStaircase(group, materials, OFFICE_CUBICLE_FLOOR_Y, [7.05, 0, -4.55], Math.PI);
}

function addExecutiveMeetingTable(group, materials) {
  const floorY = OFFICE_CEO_FLOOR_Y;
  group.add(createBox([9.4, 0.05, 4.7], [0, floorY + 0.04, -0.8], materials.accentDark));
  group.add(createBox([8.0, 0.24, 2.3], [0, floorY + 1.02, -0.8], materials.wood));
  group.add(createBox([7.5, 0.08, 1.84], [0, floorY + 1.18, -0.8], materials.woodDark));
  for (const [x, z] of [[-3.35, -1.6], [3.35, -1.6], [-3.35, 0], [3.35, 0]]) {
    group.add(createBox([0.24, 0.9, 0.24], [x, floorY + 0.55, z], materials.metalDark));
  }

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
    addOfficeChair(group, [x, floorY, z], materials, rotationY);
  }

  group.add(createBox([1.25, 0.12, 0.62], [0, floorY + 1.25, -0.8], materials.sign));
  group.add(createBox([1.05, 0.08, 0.46], [0, floorY + 1.34, -0.8], materials.gold));
}

function addOfficeCeoFloor(group, materials) {
  addOfficeFloorPanels(group, materials, OFFICE_CEO_FLOOR_Y, {
    width: 15.8,
    depth: 10.2,
    centerZ: -2.75,
    panelCount: 8,
    baseMaterial: materials.floorAccent,
    stripeMaterial: materials.floor,
    accentMaterial: materials.floorStripe
  });
  addBoxes(group, [
    { size: [14.8, 3.0, 0.14], position: [0, OFFICE_CEO_FLOOR_Y + 1.72, -7.45], material: materials.facadeAlt },
    { size: [0.14, 3.0, 8.6], position: [-7.6, OFFICE_CEO_FLOOR_Y + 1.72, -3.0], material: materials.facadeAlt },
    { size: [0.14, 3.0, 8.6], position: [7.6, OFFICE_CEO_FLOOR_Y + 1.72, -3.0], material: materials.facadeAlt },
    { size: [10.4, 0.12, 0.18], position: [0, OFFICE_CEO_FLOOR_Y + 3.35, -7.34], material: materials.gold },
    { size: [0.62, 2.2, 0.62], position: [6.2, OFFICE_CEO_FLOOR_Y + 1.22, -5.9], material: materials.green },
    { size: [0.82, 0.42, 0.82], position: [6.2, OFFICE_CEO_FLOOR_Y + 0.34, -5.9], material: materials.gold }
  ]);
  group.add(createSphere(0.72, 12, 8, [6.2, OFFICE_CEO_FLOOR_Y + 2.55, -5.9], materials.green));
  group.add(createSphere(0.48, 12, 8, [5.82, OFFICE_CEO_FLOOR_Y + 2.08, -5.52], materials.green));
  addExecutiveMeetingTable(group, materials);
  addOfficeElevator(group, materials, OFFICE_CEO_FLOOR_Y, [-8.1, 0, -4.45], Math.PI * 0.5);
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

  const towerRows = getOfficeTowerWindowRows();
  for (const y of towerRows) {
    for (const x of [-8.2, -5.45, -2.7, 0, 2.7, 5.45, 8.2]) {
      addDetailedFrontWindow(groups.tower, {
        x,
        y,
        z: OFFICE_MAIN_FRONT_Z,
        width: 1.35,
        height: 0.86,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
    }
  }

  const sideBackRows = getOfficeSideBackWindowRows();
  addOfficeSideBackWindowGridSegment(groups.exterior, materials, {
    bottomY: OFFICE_WINDOW_GRID_BOTTOM_Y,
    topY: OFFICE_CUTAWAY_WALL_TOP_Y - 0.1,
    rows: sideBackRows
  });
  addOfficeSideBackWindowGridSegment(groups.tower, materials, {
    bottomY: OFFICE_CUTAWAY_WALL_TOP_Y + 0.12,
    topY: OFFICE_MAIN_TOWER_TOP_Y - 0.75,
    rows: sideBackRows
  });

  const towerDetailHeight = OFFICE_MAIN_TOWER_TOP_Y - OFFICE_MAIN_TOWER_START_Y - 0.5;
  const towerDetailCenterY = OFFICE_MAIN_TOWER_START_Y + (towerDetailHeight * 0.5);
  const towerFrontTrimZ = OFFICE_MAIN_FRONT_Z + ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5));
  const towerBackTrimZ = OFFICE_MAIN_BACK_Z - ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5));
  const towerLeftTrimX = -OFFICE_MAIN_SIDE_WINDOW_X - ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5));
  const towerRightTrimX = OFFICE_MAIN_SIDE_WINDOW_X + ((WINDOW_GLASS_DEPTH * 0.5) + WINDOW_FACE_GAP + (WINDOW_TRIM_DEPTH * 0.5));
  for (const x of [-9.62, -6.86, -4.1, -1.36, 1.36, 4.1, 6.86, 9.62]) {
    groups.tower.add(createBox(
      [0.16, towerDetailHeight, WINDOW_TRIM_DEPTH],
      [x, towerDetailCenterY, towerFrontTrimZ],
      materials.trimDark
    ));
    groups.tower.add(createBox(
      [0.16, towerDetailHeight, WINDOW_TRIM_DEPTH],
      [x, towerDetailCenterY, towerBackTrimZ],
      materials.trimDark
    ));
  }

  for (const z of [-8.28, -5.52, -2.76, 0, 2.76, 5.52, 8.28]) {
    groups.tower.add(createBox(
      [WINDOW_TRIM_DEPTH, towerDetailHeight, 0.16],
      [towerLeftTrimX, towerDetailCenterY, z],
      materials.trimDark
    ));
    groups.tower.add(createBox(
      [WINDOW_TRIM_DEPTH, towerDetailHeight, 0.16],
      [towerRightTrimX, towerDetailCenterY, z],
      materials.trimDark
    ));
  }

  for (let y = OFFICE_MAIN_TOWER_START_Y + 5.8; y < OFFICE_MAIN_TOWER_TOP_Y - 2.0; y += 6.88) {
    const bandY = Number(y.toFixed(2));
    groups.tower.add(createBox(
      [20.2, 0.18, WINDOW_TRIM_DEPTH],
      [0, bandY, towerFrontTrimZ],
      materials.trim
    ));
    groups.tower.add(createBox(
      [20.2, 0.18, WINDOW_TRIM_DEPTH],
      [0, bandY, towerBackTrimZ],
      materials.trim
    ));
    groups.tower.add(createBox(
      [WINDOW_TRIM_DEPTH, 0.16, 18.6],
      [towerLeftTrimX, bandY, 0.35],
      materials.trim
    ));
    groups.tower.add(createBox(
      [WINDOW_TRIM_DEPTH, 0.16, 18.6],
      [towerRightTrimX, bandY, 0.35],
      materials.trim
    ));
  }

  for (const y of [OFFICE_PENTHOUSE_BOTTOM_Y + 1.25, OFFICE_PENTHOUSE_BOTTOM_Y + 2.85]) {
    for (const x of [-3.2, 0, 3.2]) {
      addDetailedFrontWindow(groups.upper, {
        x,
        y,
        z: OFFICE_PENTHOUSE_FRONT_Z,
        width: 1.18,
        height: 0.78,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
      addDetailedBackWindow(groups.upper, {
        x,
        y,
        z: OFFICE_PENTHOUSE_BACK_Z,
        width: 1.18,
        height: 0.78,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
    }
    for (const z of [-4.55, -2.25, 0.05]) {
      addDetailedSideWindow(groups.upper, {
        x: -OFFICE_PENTHOUSE_SIDE_WINDOW_X,
        y,
        z,
        width: 0.82,
        height: 0.72,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
      addDetailedSideWindow(groups.upper, {
        x: OFFICE_PENTHOUSE_SIDE_WINDOW_X,
        y,
        z,
        width: 0.82,
        height: 0.72,
        glassMaterial: materials.glassLite,
        frameMaterial: materials.trimDark,
        sillMaterial: materials.trimDark,
        mullions: 0
      });
    }
  }

  addBoxes(groups.roof, [
    { size: [20.5, 0.32, 19.7], position: [0, OFFICE_MAIN_TOWER_TOP_Y + 0.22, 0.35], material: materials.trim },
    { size: [18.0, 0.22, 16.8], position: [0, OFFICE_MAIN_TOWER_TOP_Y + 0.52, 0.35], material: materials.roof },
    { size: [OFFICE_PENTHOUSE_WIDTH + 1.2, 0.32, OFFICE_PENTHOUSE_DEPTH + 1.2], position: [0, OFFICE_PENTHOUSE_TOP_Y + 0.24, OFFICE_PENTHOUSE_CENTER_Z], material: materials.trim },
    { size: [OFFICE_PENTHOUSE_WIDTH - 1.6, 0.42, OFFICE_PENTHOUSE_DEPTH - 1.7], position: [0, OFFICE_PENTHOUSE_TOP_Y + 0.62, OFFICE_PENTHOUSE_CENTER_Z], material: materials.roof },
    { size: [2.8, 1.0, 1.9], position: [-2.3, OFFICE_PENTHOUSE_TOP_Y + 0.58, OFFICE_PENTHOUSE_CENTER_Z - 0.7], material: materials.metalDark },
    { size: [2.2, 0.82, 1.5], position: [2.4, OFFICE_PENTHOUSE_TOP_Y + 0.48, OFFICE_PENTHOUSE_CENTER_Z + 0.65], material: materials.metal },
    { size: [0.18, 2.4, 0.18], position: [0, OFFICE_PENTHOUSE_TOP_Y + 2.25, OFFICE_PENTHOUSE_CENTER_Z], material: materials.trimDark }
  ]);

  // The active office interior is rendered by InteriorScene as an inline overlay.
  // Keeping that duplicate out of the GLB preserves the exterior shell budget.
}

function buildDistrictBuilding(definition) {
  const scene = new THREE.Scene();
  const groups = createBaseGroups(definition.key);
  const materials = createThemeMaterials(definition.palette);

  addCommonBuildingShell(groups, materials, definition.shell);
  definition.decorate(groups, materials);
  optimizeBuildingGroups(groups);

  tagGroupMeshes(groups.roof, `${definition.key}_cutaway_roof`);
  tagGroupMeshes(groups.tower, `${definition.key}_cutaway_tower`);
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
      wallHeight: BANK_WALL_HEIGHT,
      roofUnits: [
        { position: [-5.4, BANK_ROOF_UNIT_Y, -4.1], rotationY: 0.24 },
        { position: [5.2, BANK_ROOF_UNIT_Y, -2.3], rotationY: -0.18 }
      ],
      upper: { centerY: BANK_UPPER_CENTER_Y, centerZ: 0.35, width: 21.7, height: BANK_UPPER_HEIGHT, depth: 20.9 }
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
      wallHeight: OFFICE_SKYSCRAPER_WALL_HEIGHT,
      cutawayWallHeight: OFFICE_CUTAWAY_WALL_HEIGHT,
      roofUnits: [
        { position: [-7.2, OFFICE_MAIN_TOWER_TOP_Y + 0.12, -7.0], rotationY: 0.24 },
        { position: [7.0, OFFICE_MAIN_TOWER_TOP_Y + 0.12, 6.0], rotationY: -0.18 }
      ],
      upper: {
        centerY: OFFICE_PENTHOUSE_CENTER_Y,
        centerZ: OFFICE_PENTHOUSE_CENTER_Z,
        width: OFFICE_PENTHOUSE_WIDTH,
        height: OFFICE_PENTHOUSE_HEIGHT,
        depth: OFFICE_PENTHOUSE_DEPTH
      }
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
  const requestedKeys = new Set();
  for (let index = 2; index < process.argv.length; index += 1) {
    const key = process.argv[index].trim();
    if (key) {
      requestedKeys.add(key);
    }
  }
  const definitions = [];
  const knownKeys = new Set();
  for (const definition of BUILDINGS) {
    knownKeys.add(definition.key);
    if (requestedKeys.size === 0 || requestedKeys.has(definition.key)) {
      definitions.push(definition);
    }
  }
  for (const key of requestedKeys) {
    if (!knownKeys.has(key)) {
      let knownKeyList = '';
      for (const knownKey of knownKeys) {
        knownKeyList += `${knownKeyList ? ', ' : ''}${knownKey}`;
      }
      throw new Error(`Unknown district building key "${key}". Known keys: ${knownKeyList}`);
    }
  }
  for (const definition of definitions) {
    await exportBuilding(definition, exporter);
  }
}

await main();
