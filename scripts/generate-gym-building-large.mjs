import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

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
const outputPath = path.join(projectRoot, 'assets', 'vibe_theft_auto_custom', 'models', 'gym-building-large.glb');

function createMaterial(color, roughness = 0.98, metalness = 0.04) {
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

function addBoxes(group, specs) {
  for (const { size, position, material, rotation } of specs) {
    group.add(createBox(size, position, material, rotation));
  }
}

function addWoodFloorPanels(group, {
  width,
  depth,
  centerX,
  centerY,
  centerZ,
  panelCount = 10,
  panelGap = 0.08,
  baseMaterial,
  seamMaterial,
  accentMaterial
}) {
  group.add(createBox([width, 0.14, depth], [centerX, centerY, centerZ], baseMaterial));

  const rowDepth = (depth - (panelGap * (panelCount - 1))) / panelCount;
  const startZ = centerZ - (depth * 0.5) + (rowDepth * 0.5);
  const usableWidth = width - 0.36;
  const fullPlankLength = 3.6;
  const mediumPlankLength = 2.2;

  for (let row = 0; row < panelCount; row += 1) {
    const z = startZ + (row * (rowDepth + panelGap));
    const staggerOffset = row % 3 === 0
      ? 0
      : row % 3 === 1
        ? (fullPlankLength * 0.5)
        : (mediumPlankLength * 0.5);
    let cursor = -usableWidth * 0.5 - staggerOffset;
    let plankIndex = 0;

    while (cursor < usableWidth * 0.5) {
      const preferredLength = plankIndex % 3 === 1 ? mediumPlankLength : fullPlankLength;
      const clampedStart = Math.max(cursor, -usableWidth * 0.5);
      const clampedEnd = Math.min(cursor + preferredLength, usableWidth * 0.5);
      const plankLength = clampedEnd - clampedStart;

      if (plankLength > 1.1) {
        const x = centerX + ((clampedStart + clampedEnd) * 0.5);
        const material = (row + plankIndex) % 2 === 0 ? seamMaterial : accentMaterial;
        group.add(createBox([plankLength, 0.022, rowDepth], [x, centerY + 0.08, z], material));
      }

      cursor += preferredLength + panelGap;
      plankIndex += 1;
    }
  }

  group.add(createBox([width, 0.02, 0.18], [centerX, centerY + 0.085, centerZ - (depth * 0.5) + 0.24], accentMaterial));
  group.add(createBox([width, 0.02, 0.18], [centerX, centerY + 0.085, centerZ + (depth * 0.5) - 0.24], accentMaterial));
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
  wallThickness = 0.34,
  roofThickness = 0.34,
  omitFrontWall = false,
  omitBackWall = false,
  omitLeftWall = false,
  omitRightWall = false,
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

  if (!omitBackWall) {
    addFrontOrBackWall('back');
  }
  if (!omitFrontWall) {
    addFrontOrBackWall('front');
  }
  if (!omitLeftWall) {
    getWallGroup('left').add(createBox(
      [wallThickness, height, depth],
      [centerX - halfWidth + (wallThickness * 0.5), centerY, centerZ],
      material
    ));
  }
  if (!omitRightWall) {
    getWallGroup('right').add(createBox(
      [wallThickness, height, depth],
      [centerX + halfWidth - (wallThickness * 0.5), centerY, centerZ],
      material
    ));
  }

  targetRoofGroup.add(createBox(
    [width, roofThickness, depth],
    [centerX, centerY + halfHeight - (roofThickness * 0.5), centerZ],
    roofMaterial
  ));
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

function addWindowRow(group, {
  startX,
  count,
  spacing,
  size,
  y,
  z,
  windowMaterial,
  frameMaterial,
  ledgeMaterial,
  depthOffset = 0
}) {
  for (let index = 0; index < count; index += 1) {
    const x = startX + (index * spacing);
    const [width, height, depth] = size;
    group.add(createBox(size, [x, y, z], windowMaterial));
    group.add(createBox([width + 0.22, height + 0.18, 0.08], [x, y, z - (0.08 + depthOffset)], frameMaterial));
    group.add(createBox([width + 0.18, 0.06, 0.14], [x, y - (height * 0.58), z + 0.02], ledgeMaterial));
  }
}

function addDetailedFacadeWindow(group, {
  x,
  y,
  z,
  width,
  height,
  glassMaterial,
  frameMaterial,
  sillMaterial,
  accentMaterial,
  mullionCount = 0
}) {
  const frameDepth = 0.08;
  const glassDepth = 0.08;
  const mullionWidth = 0.07;
  const sideFrameWidth = 0.1;
  const topBottomFrameHeight = 0.1;
  const innerWidth = Math.max(0.4, width - 0.24);
  const innerHeight = Math.max(0.4, height - 0.22);

  group.add(createBox([width + 0.14, height + 0.14, 0.04], [x, y, z - 0.08], accentMaterial));
  group.add(createBox([innerWidth, innerHeight, glassDepth], [x, y, z], glassMaterial));
  group.add(createBox([sideFrameWidth, height + 0.02, frameDepth], [x - (width * 0.5) + 0.05, y, z - 0.01], frameMaterial));
  group.add(createBox([sideFrameWidth, height + 0.02, frameDepth], [x + (width * 0.5) - 0.05, y, z - 0.01], frameMaterial));
  group.add(createBox([width - 0.08, topBottomFrameHeight, frameDepth], [x, y + (height * 0.5) - 0.05, z - 0.01], frameMaterial));
  group.add(createBox([width - 0.08, topBottomFrameHeight, frameDepth], [x, y - (height * 0.5) + 0.05, z - 0.01], frameMaterial));
  group.add(createBox([width + 0.12, 0.08, 0.16], [x, y - (height * 0.5) - 0.08, z + 0.03], sillMaterial));
  group.add(createBox([width + 0.08, 0.06, 0.12], [x, y + (height * 0.5) + 0.08, z], accentMaterial));

  for (let index = 1; index <= mullionCount; index += 1) {
    const t = index / (mullionCount + 1);
    const mullionX = x - (innerWidth * 0.5) + (innerWidth * t);
    group.add(createBox([mullionWidth, innerHeight + 0.04, 0.1], [mullionX, y, z + 0.01], frameMaterial));
  }
}

function addSideWindowColumn(group, {
  x,
  startY,
  count,
  spacing,
  size,
  z,
  windowMaterial,
  frameMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const y = startY + (index * spacing);
    const [, height, depth] = size;
    group.add(createBox(size, [x, y, z], windowMaterial));
    group.add(createBox([0.08, height + 0.18, depth + 0.18], [x - 0.08, y, z], frameMaterial));
  }
}

function addFrontCanopySupports(group, xs, y, z, materials) {
  for (const x of xs) {
    group.add(createCylinder(0.1, 0.1, 2.6, 8, [x, y, z], materials.metalDark));
    group.add(createBox([0.34, 0.12, 0.34], [x, y + 1.26, z], materials.trim));
  }
}

function addPlanter(group, position, materials, rotationY = 0) {
  const planter = new THREE.Group();
  planter.position.set(...position);
  planter.rotation.y = rotationY;

  planter.add(createBox([2.2, 0.78, 1.1], [0, 0.39, 0], materials.accentDark));
  planter.add(createBox([1.88, 0.12, 0.82], [0, 0.74, 0], materials.trimDark));
  planter.add(createSphere(0.46, 10, 8, [-0.44, 1.08, 0], materials.greeneryDark));
  planter.add(createSphere(0.5, 10, 8, [0.34, 1.14, 0.08], materials.greenery));
  planter.add(createSphere(0.34, 10, 8, [0.06, 1.38, -0.18], materials.greeneryLite));

  group.add(planter);
}

function addRooftopUnit(group, position, materials, rotationY = 0) {
  const unit = new THREE.Group();
  unit.position.set(...position);
  unit.rotation.y = rotationY;

  unit.add(createBox([2.8, 1.22, 1.86], [0, 0.61, 0], materials.metalDark));
  unit.add(createBox([2.42, 0.16, 1.54], [0, 1.24, 0], materials.trim));
  unit.add(createBox([2.1, 0.12, 1.4], [0, 1.36, 0], materials.metal));
  unit.add(createCylinder(0.42, 0.42, 0.16, 16, [-0.66, 1.5, 0], materials.weight));
  unit.add(createCylinder(0.42, 0.42, 0.16, 16, [0.66, 1.5, 0], materials.weight));
  unit.add(createCylinder(0.08, 0.08, 0.82, 8, [-1.02, 1.73, -0.22], materials.metal));
  unit.add(createCylinder(0.08, 0.08, 0.82, 8, [1.02, 1.73, 0.22], materials.metal));

  group.add(unit);
}

function addBench(group, position, materials, rotationY = 0) {
  const bench = new THREE.Group();
  bench.position.set(...position);
  bench.rotation.y = rotationY;

  bench.add(createBox([2.6, 0.16, 0.72], [0, 0.96, 0], materials.accentDark));
  bench.add(createBox([2.6, 0.14, 0.54], [0, 1.44, -0.16], materials.accentDark, [-0.24, 0, 0]));
  for (const x of [-1.02, 1.02]) {
    bench.add(createBox([0.16, 0.96, 0.16], [x, 0.46, -0.2], materials.metalDark));
    bench.add(createBox([0.16, 0.96, 0.16], [x, 0.46, 0.2], materials.metalDark));
  }

  group.add(bench);
}

function addTreadmill(group, position, materials, rotationY = 0) {
  const treadmill = new THREE.Group();
  treadmill.position.set(...position);
  treadmill.rotation.y = rotationY;

  treadmill.add(createBox([2.8, 0.16, 1.02], [0, 0.56, 0], materials.rubberFloor));
  treadmill.add(createBox([2.2, 0.06, 0.72], [0.14, 0.68, 0], materials.metalDark));
  treadmill.add(createBox([0.14, 1.48, 0.14], [-1.08, 1.24, -0.34], materials.metalDark, [0.16, 0, 0]));
  treadmill.add(createBox([0.14, 1.48, 0.14], [-1.08, 1.24, 0.34], materials.metalDark, [0.16, 0, 0]));
  treadmill.add(createBox([0.9, 0.18, 0.92], [-0.62, 2.0, 0], materials.glassDark, [-0.18, 0, 0]));
  treadmill.add(createBox([1.2, 0.1, 0.1], [-0.64, 1.62, -0.44], materials.metal));
  treadmill.add(createBox([1.2, 0.1, 0.1], [-0.64, 1.62, 0.44], materials.metal));

  group.add(treadmill);
}

function addExerciseBike(group, position, materials, rotationY = 0) {
  const bike = new THREE.Group();
  bike.position.set(...position);
  bike.rotation.y = rotationY;

  bike.add(createCylinder(0.52, 0.52, 0.18, 18, [0, 0.7, 0], materials.weight, [Math.PI * 0.5, 0, 0]));
  bike.add(createBox([0.18, 1.32, 0.18], [0, 1.14, 0], materials.metalDark, [0.32, 0, 0]));
  bike.add(createBox([1.18, 0.12, 0.12], [0.42, 1.46, 0], materials.metal, [0, 0, -0.52]));
  bike.add(createBox([1.34, 0.12, 0.12], [-0.3, 1.56, 0], materials.metal, [0, 0, 0.36]));
  bike.add(createBox([0.48, 0.16, 0.24], [0.76, 1.92, 0], materials.accentDark));
  bike.add(createBox([0.56, 0.14, 0.2], [-0.74, 2.0, 0], materials.metalDark));
  bike.add(createBox([1.86, 0.12, 0.66], [0, 0.22, 0], materials.metalDark));

  group.add(bike);
}

function addPlateStack(group, position, materials) {
  const [x, y, z] = position;
  group.add(createCylinder(0.66, 0.66, 0.2, 18, [x, y, z], materials.weight));
  group.add(createCylinder(0.54, 0.54, 0.2, 18, [x, y + 0.22, z], materials.weight));
  group.add(createCylinder(0.42, 0.42, 0.2, 18, [x, y + 0.44, z], materials.weight));
  group.add(createCylinder(0.12, 0.12, 1.08, 10, [x, y + 0.78, z], materials.metal));
}

function addDumbbell(group, position, materials, rotationY = 0) {
  const dumbbell = new THREE.Group();
  dumbbell.position.set(...position);
  dumbbell.rotation.y = rotationY;

  dumbbell.add(createBox([1.82, 0.12, 0.12], [0, 0, 0], materials.metal));
  dumbbell.add(createCylinder(0.48, 0.48, 0.18, 18, [-0.72, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  dumbbell.add(createCylinder(0.34, 0.34, 0.14, 18, [-0.98, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  dumbbell.add(createCylinder(0.48, 0.48, 0.18, 18, [0.72, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  dumbbell.add(createCylinder(0.34, 0.34, 0.14, 18, [0.98, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));

  group.add(dumbbell);
}

function addElliptical(group, position, materials, rotationY = 0) {
  const machine = new THREE.Group();
  machine.position.set(...position);
  machine.rotation.y = rotationY;

  machine.add(createBox([1.8, 0.12, 0.72], [0, 0.14, 0], materials.metalDark));
  machine.add(createCylinder(0.26, 0.26, 0.18, 16, [-0.48, 0.42, 0], materials.weight, [Math.PI * 0.5, 0, 0]));
  machine.add(createCylinder(0.26, 0.26, 0.18, 16, [0.48, 0.42, 0], materials.weight, [Math.PI * 0.5, 0, 0]));
  machine.add(createBox([0.14, 2.26, 0.14], [-0.6, 1.44, -0.12], materials.metal, [0.12, 0, -0.16]));
  machine.add(createBox([0.14, 2.26, 0.14], [0.6, 1.44, 0.12], materials.metal, [0.12, 0, 0.16]));
  machine.add(createBox([0.12, 2.1, 0.12], [-0.2, 1.58, 0], materials.metalDark, [0, 0, -0.24]));
  machine.add(createBox([0.12, 2.1, 0.12], [0.2, 1.58, 0], materials.metalDark, [0, 0, 0.24]));
  machine.add(createBox([0.86, 0.14, 0.14], [0, 2.44, 0], materials.metalDark));
  machine.add(createBox([0.72, 0.24, 0.44], [0, 2.04, 0], materials.glassDark, [-0.22, 0, 0]));

  group.add(machine);
}

function addBarbellEmblem(group, position, materials, scale = 1, rotationY = 0) {
  const emblem = new THREE.Group();
  emblem.position.set(...position);
  emblem.scale.setScalar(scale);
  emblem.rotation.y = rotationY;

  emblem.add(createBox([7.1, 0.24, 0.24], [0, 0, 0], materials.metal));
  emblem.add(createBox([0.24, 0.46, 0.24], [-1.26, 0, 0], materials.metalDark));
  emblem.add(createBox([0.24, 0.46, 0.24], [1.26, 0, 0], materials.metalDark));

  for (const [x, radius, depth] of [
    [-2.8, 1.12, 0.26],
    [-3.16, 0.82, 0.22],
    [2.8, 1.12, 0.26],
    [3.16, 0.82, 0.22]
  ]) {
    emblem.add(createCylinder(radius, radius, depth, 18, [x, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  }

  group.add(emblem);
}

function addGymLetters(group, centerX, y, z, materials) {
  const faceMaterial = materials.signLight;
  const shadowMaterial = materials.signShadow;
  const faceDepth = 0.42;
  const shadowDepth = 0.22;

  function addPart(size, position, rotation = [0, 0, 0]) {
    group.add(createBox(
      [size[0] * 1.08, size[1] * 1.08, shadowDepth],
      [position[0] + 0.07, position[1] - 0.1, z - 0.12],
      shadowMaterial,
      rotation
    ));
    group.add(createBox(
      [size[0], size[1], faceDepth],
      [position[0], position[1], z],
      faceMaterial,
      rotation
    ));
  }

  function addG(x) {
    addPart([0.5, 2.5], [x - 0.84, y]);
    addPart([1.72, 0.46], [x, y + 1.02]);
    addPart([1.72, 0.46], [x, y - 1.02]);
    addPart([0.44, 1.18], [x + 0.8, y - 0.38]);
    addPart([0.92, 0.38], [x + 0.52, y - 0.06]);
  }

  function addY(x) {
    addPart([0.38, 1.52], [x - 0.54, y + 0.58], [0, 0, 0.44]);
    addPart([0.38, 1.52], [x + 0.54, y + 0.58], [0, 0, -0.44]);
    addPart([0.42, 1.4], [x, y - 0.54]);
  }

  function addM(x) {
    addPart([0.44, 2.5], [x - 0.98, y]);
    addPart([0.44, 2.5], [x + 0.98, y]);
    addPart([0.38, 1.78], [x - 0.36, y + 0.32], [0, 0, 0.34]);
    addPart([0.38, 1.78], [x + 0.36, y + 0.32], [0, 0, -0.34]);
  }

  addG(centerX - 2.45);
  addY(centerX);
  addM(centerX + 2.45);
}

function createGymMaterials() {
  return {
    slab: createMaterial(0x5d6369),
    pavement: createMaterial(0xd9d4c9),
    rubberFloor: createMaterial(0x2e363d),
    woodFloor: createMaterial(0xcfd3d8),
    woodFloorLite: createMaterial(0xe1e4e8),
    woodFloorWarm: createMaterial(0xb9bec6),
    facade: createMaterial(0xc9dbe4),
    facadeDark: createMaterial(0x7ea1b7),
    facadeDeep: createMaterial(0x7098b1),
    trim: createMaterial(0xf3eee4),
    trimDark: createMaterial(0x9fb2bf),
    accent: createMaterial(0xe0a94f),
    accentDark: createMaterial(0x95682f),
    sign: createMaterial(0x243747),
    signShadow: createMaterial(0x101b23),
    signLight: createMaterial(0xf8f6f0),
    glass: createMaterial(0x84b3c7, 0.75, 0.08),
    glassLite: createMaterial(0xc2e6ef, 0.72, 0.06),
    glassDark: createMaterial(0x5d8398, 0.82, 0.12),
    door: createMaterial(0x1c2f3c),
    metal: createMaterial(0xc6ced5, 0.9, 0.12),
    metalDark: createMaterial(0x5f6972, 0.92, 0.1),
    weight: createMaterial(0x1f262c, 0.94, 0.06),
    greenery: createMaterial(0x6e9354, 0.98, 0.02),
    greeneryDark: createMaterial(0x456238, 0.98, 0.02),
    greeneryLite: createMaterial(0x98b86b, 0.98, 0.02)
  };
}

function buildGym() {
  const scene = new THREE.Scene();
  const gym = new THREE.Group();
  gym.name = 'gym_building_large';
  const foundationGroup = new THREE.Group();
  foundationGroup.name = 'gym_foundation';
  const shellGroup = new THREE.Group();
  shellGroup.name = 'gym_shell';
  const shellBackGroup = new THREE.Group();
  shellBackGroup.name = 'gym_hull_wall_back';
  const shellLeftGroup = new THREE.Group();
  shellLeftGroup.name = 'gym_hull_wall_left';
  const shellRightGroup = new THREE.Group();
  shellRightGroup.name = 'gym_hull_wall_right';
  const shellFrontGroup = new THREE.Group();
  shellFrontGroup.name = 'gym_hull_wall_front';
  const roofGroup = new THREE.Group();
  roofGroup.name = 'gym_cutaway_roof';
  const upperCutawayGroup = new THREE.Group();
  upperCutawayGroup.name = 'gym_cutaway_upper';
  const cornerCutawayGroup = new THREE.Group();
  cornerCutawayGroup.name = 'gym_cutaway_corner';
  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'gym_exterior_detail';
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'gym_interior';

  const materials = createGymMaterials();

  gym.add(foundationGroup);
  gym.add(shellGroup);
  shellGroup.add(shellBackGroup);
  shellGroup.add(shellLeftGroup);
  shellGroup.add(shellRightGroup);
  shellGroup.add(shellFrontGroup);
  gym.add(roofGroup);
  gym.add(upperCutawayGroup);
  gym.add(cornerCutawayGroup);
  gym.add(exteriorGroup);
  gym.add(interiorGroup);

  addBoxes(foundationGroup, [
    { size: [22.7, 0.62, 22.2], position: [0, 0.31, 0], material: materials.slab }
  ]);

  addWoodFloorPanels(interiorGroup, {
    width: 20.6,
    depth: 18.2,
    centerX: 0,
    centerY: 0.69,
    centerZ: 1.55,
    panelCount: 15,
    panelGap: 0.08,
    baseMaterial: materials.woodFloor,
    seamMaterial: materials.woodFloorLite,
    accentMaterial: materials.woodFloorWarm
  });

  addShellBlock(shellGroup, {
    centerX: 0,
    centerY: 4.04,
    centerZ: 1.55,
    width: 21.66,
    height: 7.2,
    depth: 18.78,
    material: materials.facade,
    roofGroup,
    doorwaySide: 'front',
    doorwayWidth: 6.8,
    doorwayHeight: 3.4,
    wallGroups: {
      back: shellBackGroup,
      left: shellLeftGroup,
      right: shellRightGroup,
      front: shellFrontGroup
    }
  });
  addShellBlock(upperCutawayGroup, {
    centerX: 0,
    centerY: 9.8,
    centerZ: -1.8,
    width: 14.6,
    height: 4.8,
    depth: 9.4,
    material: materials.facadeDark,
    roofGroup
  });
  addShellBlock(cornerCutawayGroup, {
    centerX: -7.5,
    centerY: 3.56,
    centerZ: 3.4,
    width: 5.2,
    height: 6.2,
    depth: 8.6,
    material: materials.facadeDeep,
    roofGroup
  });
  addShellBlock(cornerCutawayGroup, {
    centerX: 7.5,
    centerY: 3.16,
    centerZ: 3.55,
    width: 5.2,
    height: 5.4,
    depth: 8.4,
    material: materials.facadeDeep,
    roofGroup
  });
  addBoxes(exteriorGroup, [
    { size: [21.22, 0.26, 0.2], position: [0, 7.98, 10.84], material: materials.trim },
    { size: [21.18, 0.18, 0.18], position: [0, 0.92, 10.86], material: materials.trimDark },
    { size: [21.1, 0.18, 0.18], position: [0, 1.02, 10.86], material: materials.trimDark },
    { size: [0.42, 6.5, 0.18], position: [-10.1, 3.25, 10.86], material: materials.trim },
    { size: [0.42, 6.5, 0.18], position: [10.1, 3.25, 10.86], material: materials.trim },
    { size: [0.28, 6.16, 0.16], position: [-8.88, 3.14, 10.88], material: materials.trimDark },
    { size: [0.28, 6.16, 0.16], position: [8.88, 3.14, 10.88], material: materials.trimDark },
    { size: [0.34, 4.18, 0.16], position: [-3.56, 2.06, 10.88], material: materials.trim },
    { size: [0.34, 4.18, 0.16], position: [3.56, 2.06, 10.88], material: materials.trim },
    { size: [7.54, 0.26, 0.16], position: [0, 3.6, 10.88], material: materials.accentDark },
    { size: [7.54, 0.16, 0.16], position: [0, 0.96, 10.88], material: materials.metalDark },
    { size: [7.38, 0.14, 0.14], position: [0, 6.06, 10.88], material: materials.trimDark },
    { size: [7.92, 0.18, 0.16], position: [0, 6.92, 10.84], material: materials.accent },
    { size: [21.0, 0.12, 0.16], position: [0, 4.22, 10.84], material: materials.trimDark }
  ]);
  for (const x of [-7.52, -5.08, 5.08, 7.52]) {
    addDetailedFacadeWindow(exteriorGroup, {
      x,
      y: 2.46,
      z: 10.92,
      width: 2.02,
      height: 2.62,
      glassMaterial: materials.glassLite,
      frameMaterial: materials.metalDark,
      sillMaterial: materials.trimDark,
      accentMaterial: materials.trimDark,
      mullionCount: 0
    });
  }
  for (const x of [-7.52, -5.08, 5.08, 7.52]) {
    addDetailedFacadeWindow(exteriorGroup, {
      x,
      y: 6.04,
      z: 10.9,
      width: 2.02,
      height: 0.92,
      glassMaterial: materials.glass,
      frameMaterial: materials.metalDark,
      sillMaterial: materials.trimDark,
      accentMaterial: materials.trimDark,
      mullionCount: 0
    });
  }
  addBoxes(upperCutawayGroup, [
    { size: [14.7, 0.18, 0.22], position: [0, 11.98, 2.02], material: materials.accent },
    { size: [14.7, 0.12, 0.22], position: [0, 9.08, 2.02], material: materials.trimDark },
    { size: [0.26, 4.9, 0.26], position: [-7.28, 9.84, 2.18], material: materials.trim },
    { size: [0.26, 4.9, 0.26], position: [7.28, 9.84, 2.18], material: materials.trim }
  ]);

  addBoxes(cornerCutawayGroup, [
    { size: [5.4, 0.16, 0.22], position: [-7.5, 6.86, 7.54], material: materials.accent },
    { size: [5.4, 0.12, 0.22], position: [-7.5, 4.1, 7.54], material: materials.trimDark },
    { size: [5.4, 0.16, 0.22], position: [7.5, 6.1, 7.36], material: materials.accent },
    { size: [5.4, 0.12, 0.22], position: [7.5, 3.72, 7.36], material: materials.trimDark },
    { size: [0.24, 6.2, 8.62], position: [-10.08, 3.56, 3.4], material: materials.trim },
    { size: [0.24, 6.2, 8.62], position: [-4.92, 3.56, 3.4], material: materials.trim },
    { size: [0.24, 5.4, 8.42], position: [4.92, 3.16, 3.55], material: materials.trim },
    { size: [0.24, 5.4, 8.42], position: [10.08, 3.16, 3.55], material: materials.trim },
    { size: [0.42, 7.26, 0.26], position: [-10.24, 4.08, 5.94], material: materials.accentDark },
    { size: [0.42, 7.26, 0.26], position: [10.24, 4.08, 5.94], material: materials.accentDark },
    { size: [0.6, 2.4, 0.28], position: [-5.84, 2.34, 9.72], material: materials.trim },
    { size: [0.6, 2.4, 0.28], position: [5.84, 2.34, 9.72], material: materials.trim },
    { size: [4.6, 0.18, 0.18], position: [-7.5, 7.18, 7.88], material: materials.trim },
    { size: [4.6, 0.18, 0.18], position: [7.5, 6.42, 7.72], material: materials.trim }
  ]);

  addBoxes(roofGroup, [
    { size: [2.0, 0.7, 1.8], position: [-7.52, 6.86, 0.3], material: materials.facadeDeep },
    { size: [2.2, 0.72, 1.9], position: [7.5, 6.22, 0.8], material: materials.facadeDeep },
    { size: [1.5, 0.38, 1.3], position: [-2.2, 12.34, -1.95], material: materials.facadeDeep },
    { size: [1.6, 0.42, 1.4], position: [2.2, 12.3, -0.95], material: materials.facadeDeep },
    { size: [0.6, 1.1, 0.6], position: [-2.2, 13.1, -1.95], material: materials.metalDark },
    { size: [0.6, 1.1, 0.6], position: [2.2, 13.16, -0.95], material: materials.metalDark },
    { size: [3.4, 0.1, 1.0], position: [-4.8, 12.48, -1.62], material: materials.glassLite },
    { size: [3.4, 0.1, 1.0], position: [0, 12.48, -1.62], material: materials.glassLite },
    { size: [3.4, 0.1, 1.0], position: [4.8, 12.48, -1.62], material: materials.glassLite }
  ]);

  addParapetRect(roofGroup, {
    centerX: 0,
    centerY: 7.78,
    centerZ: -1.2,
    width: 19.92,
    depth: 12.72,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(roofGroup, {
    centerX: 0,
    centerY: 12.16,
    centerZ: -1.8,
    width: 14.1,
    depth: 8.96,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(roofGroup, {
    centerX: -7.5,
    centerY: 6.9,
    centerZ: 3.4,
    width: 4.92,
    depth: 8.26,
    parapetHeight: 0.2,
    thickness: 0.16,
    material: materials.trim
  });
  addParapetRect(roofGroup, {
    centerX: 7.5,
    centerY: 6.14,
    centerZ: 3.55,
    width: 4.92,
    depth: 8.06,
    parapetHeight: 0.2,
    thickness: 0.16,
    material: materials.trim
  });

  addWindowRow(cornerCutawayGroup, {
    startX: -7.5,
    count: 6,
    spacing: 3.0,
    size: [2.14, 3.1, 0.18],
    y: 2.54,
    z: 5.86,
    windowMaterial: materials.glassLite,
    frameMaterial: materials.trim,
    ledgeMaterial: materials.trim
  });

  addWindowRow(upperCutawayGroup, {
    startX: -4.96,
    count: 5,
    spacing: 2.48,
    size: [1.5, 1.08, 0.16],
    y: 9.92,
    z: 2.18,
    windowMaterial: materials.glass,
    frameMaterial: materials.trim,
    ledgeMaterial: materials.trim
  });

  addSideWindowColumn(cornerCutawayGroup, {
    x: -10.34,
    startY: 2.3,
    count: 3,
    spacing: 2.1,
    size: [0.16, 1.16, 1.24],
    z: 0.5,
    windowMaterial: materials.glass,
    frameMaterial: materials.trim
  });
  addSideWindowColumn(cornerCutawayGroup, {
    x: 4.64,
    startY: 2.0,
    count: 3,
    spacing: 1.9,
    size: [0.16, 1.04, 1.08],
    z: 0.72,
    windowMaterial: materials.glassLite,
    frameMaterial: materials.trim
  });

  addBarbellEmblem(roofGroup, [0, 8.64, 8.72], materials, 1.14);
  addBarbellEmblem(roofGroup, [2.4, 12.58, 0.3], materials, 0.52, 0.72);
  addGymLetters(exteriorGroup, 0, 6.76, 10.76, materials);
  addRooftopUnit(roofGroup, [-4.7, 7.96, -2.8], materials, 0.18);
  addRooftopUnit(roofGroup, [4.8, 7.96, -1.64], materials, -0.12);

  tagGroupMeshes(roofGroup, 'gym_cutaway_roof');
  tagGroupMeshes(upperCutawayGroup, 'gym_cutaway_upper');
  tagGroupMeshes(cornerCutawayGroup, 'gym_cutaway_corner');

  scene.add(gym);
  return scene;
}

async function main() {
  const exporter = new GLTFExporter();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const scene = buildGym();
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

await main();
