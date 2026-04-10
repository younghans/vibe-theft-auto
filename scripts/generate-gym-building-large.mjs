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
const outputPath = path.join(projectRoot, 'assets', 'stickrpg_custom', 'models', 'gym-building-large.glb');

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

function addBarbellEmblem(group, position, materials) {
  const emblem = new THREE.Group();
  emblem.position.set(...position);

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

  const materials = createGymMaterials();

  addBoxes(gym, [
    { size: [22.7, 0.62, 22.2], position: [0, 0.31, 0], material: materials.slab },
    { size: [14.6, 0.18, 4.4], position: [0, 0.72, 8.48], material: materials.pavement },
    { size: [8.2, 0.08, 1.6], position: [0, 0.77, 10.0], material: materials.rubberFloor },
    { size: [20.4, 7.2, 13.2], position: [0, 4.04, -1.2], material: materials.facade },
    { size: [11.8, 4.8, 7.0], position: [0, 9.8, -5.2], material: materials.facadeDark },
    { size: [5.2, 6.2, 8.6], position: [-7.5, 3.56, 3.4], material: materials.facadeDeep },
    { size: [5.2, 5.4, 8.4], position: [7.5, 3.16, 3.55], material: materials.facadeDeep },
    { size: [10.2, 3.5, 3.5], position: [0, 2.06, 8.72], material: materials.trim },
    { size: [6.2, 0.26, 2.2], position: [0, 4.22, 10.16], material: materials.accent, rotation: [-0.1, 0, 0] },
    { size: [6.0, 0.08, 1.9], position: [0, 4.1, 10.02], material: materials.trimDark, rotation: [-0.1, 0, 0] },
    { size: [6.4, 0.18, 0.2], position: [0, 4.06, 11.1], material: materials.accentDark },
    { size: [20.6, 0.18, 0.22], position: [0, 7.74, 5.42], material: materials.accent },
    { size: [20.6, 0.12, 0.22], position: [0, 4.18, 5.42], material: materials.trimDark },
    { size: [11.9, 0.18, 0.22], position: [0, 11.98, -1.72], material: materials.accent },
    { size: [11.9, 0.12, 0.22], position: [0, 9.08, -1.72], material: materials.trimDark },
    { size: [5.4, 0.16, 0.22], position: [-7.5, 6.86, 7.54], material: materials.accent },
    { size: [5.4, 0.12, 0.22], position: [-7.5, 4.1, 7.54], material: materials.trimDark },
    { size: [5.4, 0.16, 0.22], position: [7.5, 6.1, 7.36], material: materials.accent },
    { size: [5.4, 0.12, 0.22], position: [7.5, 3.72, 7.36], material: materials.trimDark },
    { size: [0.24, 6.2, 8.62], position: [-10.08, 3.56, 3.4], material: materials.trim },
    { size: [0.24, 6.2, 8.62], position: [-4.92, 3.56, 3.4], material: materials.trim },
    { size: [0.24, 5.4, 8.42], position: [4.92, 3.16, 3.55], material: materials.trim },
    { size: [0.24, 5.4, 8.42], position: [10.08, 3.16, 3.55], material: materials.trim },
    { size: [3.9, 2.7, 0.16], position: [0, 1.72, 11.18], material: materials.door },
    { size: [0.08, 2.3, 0.12], position: [0, 1.22, 11.26], material: materials.metalDark },
    { size: [3.2, 0.34, 0.08], position: [0, 2.46, 11.22], material: materials.glassLite },
    { size: [0.74, 2.0, 0.08], position: [-1.36, 1.2, 11.22], material: materials.glassLite },
    { size: [0.88, 2.0, 0.08], position: [-0.36, 1.2, 11.26], material: materials.glassDark },
    { size: [0.88, 2.0, 0.08], position: [0.6, 1.2, 11.26], material: materials.glassDark },
    { size: [0.74, 2.0, 0.08], position: [1.58, 1.2, 11.22], material: materials.glassLite },
    { size: [7.4, 0.22, 0.22], position: [0, 2.98, 11.02], material: materials.trim },
    { size: [7.4, 0.14, 0.22], position: [0, 0.82, 11.02], material: materials.metalDark },
    { size: [12.2, 0.22, 0.28], position: [0, 3.58, 10.7], material: materials.trim },
    { size: [12.6, 0.16, 0.28], position: [0, 3.76, 10.86], material: materials.accentDark },
    { size: [12.8, 0.26, 0.3], position: [0, 8.04, 6.22], material: materials.trim },
    { size: [12.8, 0.26, 0.3], position: [0, 4.22, 6.22], material: materials.trim },
    { size: [12.0, 0.24, 0.28], position: [0, 12.26, -0.72], material: materials.trim },
    { size: [20.8, 0.14, 0.22], position: [0, 1.14, 10.7], material: materials.accentDark },
    { size: [0.42, 7.26, 0.26], position: [-10.24, 4.08, 5.94], material: materials.accentDark },
    { size: [0.42, 7.26, 0.26], position: [10.24, 4.08, 5.94], material: materials.accentDark },
    { size: [0.26, 4.9, 0.26], position: [-5.88, 9.84, -1.56], material: materials.trim },
    { size: [0.26, 4.9, 0.26], position: [5.88, 9.84, -1.56], material: materials.trim },
    { size: [2.0, 0.7, 1.8], position: [-7.52, 6.86, 0.3], material: materials.facadeDeep },
    { size: [2.2, 0.72, 1.9], position: [7.5, 6.22, 0.8], material: materials.facadeDeep },
    { size: [1.3, 0.38, 1.2], position: [-1.8, 12.34, -5.4], material: materials.facadeDeep },
    { size: [1.4, 0.42, 1.3], position: [1.7, 12.3, -4.5], material: materials.facadeDeep },
    { size: [0.6, 1.1, 0.6], position: [-1.8, 13.1, -5.4], material: materials.metalDark },
    { size: [0.6, 1.1, 0.6], position: [1.7, 13.16, -4.5], material: materials.metalDark },
    { size: [0.6, 2.4, 0.28], position: [-5.84, 2.34, 9.72], material: materials.trim },
    { size: [0.6, 2.4, 0.28], position: [5.84, 2.34, 9.72], material: materials.trim },
    { size: [4.6, 0.18, 0.18], position: [-7.5, 7.18, 7.88], material: materials.trim },
    { size: [4.6, 0.18, 0.18], position: [7.5, 6.42, 7.72], material: materials.trim }
  ]);

  gym.add(createBox([11.4, 0.44, 3.4], [0, 4.72, 9.54], materials.accent, [-0.24, 0, 0]));
  gym.add(createBox([11.0, 0.16, 3.0], [0, 4.62, 9.4], materials.trimDark, [-0.24, 0, 0]));
  gym.add(createBox([18.4, 0.2, 0.26], [0, 6.08, 5.96], materials.accentDark));
  gym.add(createBox([10.8, 0.2, 0.26], [0, 10.46, -1.04], materials.accentDark));
  gym.add(createBox([14.8, 0.3, 4.1], [0, 4.44, 10.08], materials.sign, [-0.18, 0, 0]));
  gym.add(createBox([15.2, 0.1, 4.26], [0, 4.58, 10.14], materials.accent, [-0.18, 0, 0]));
  gym.add(createBox([14.8, 0.14, 0.28], [0, 2.92, 10.82], materials.trim));
  gym.add(createBox([3.2, 0.1, 1.0], [-4.8, 12.48, -5.02], materials.glassLite));
  gym.add(createBox([3.2, 0.1, 1.0], [0, 12.48, -5.02], materials.glassLite));
  gym.add(createBox([3.2, 0.1, 1.0], [4.8, 12.48, -5.02], materials.glassLite));

  addParapetRect(gym, {
    centerX: 0,
    centerY: 7.78,
    centerZ: -1.2,
    width: 19.92,
    depth: 12.72,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: 0,
    centerY: 12.16,
    centerZ: -5.2,
    width: 11.3,
    depth: 6.56,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: -7.5,
    centerY: 6.9,
    centerZ: 3.4,
    width: 4.92,
    depth: 8.26,
    parapetHeight: 0.2,
    thickness: 0.16,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: 7.5,
    centerY: 6.14,
    centerZ: 3.55,
    width: 4.92,
    depth: 8.06,
    parapetHeight: 0.2,
    thickness: 0.16,
    material: materials.trim
  });

  addWindowRow(gym, {
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

  addWindowRow(gym, {
    startX: -3.7,
    count: 4,
    spacing: 2.48,
    size: [1.5, 1.08, 0.16],
    y: 9.92,
    z: -1.56,
    windowMaterial: materials.glass,
    frameMaterial: materials.trim,
    ledgeMaterial: materials.trim
  });

  addSideWindowColumn(gym, {
    x: -10.34,
    startY: 2.3,
    count: 3,
    spacing: 2.1,
    size: [0.16, 1.16, 1.24],
    z: 0.5,
    windowMaterial: materials.glass,
    frameMaterial: materials.trim
  });
  addSideWindowColumn(gym, {
    x: 4.64,
    startY: 2.0,
    count: 3,
    spacing: 1.9,
    size: [0.16, 1.04, 1.08],
    z: 0.72,
    windowMaterial: materials.glassLite,
    frameMaterial: materials.trim
  });

  addFrontCanopySupports(gym, [-5.0, -2.4, 2.4, 5.0], 2.0, 10.12, materials);
  addBarbellEmblem(gym, [0, 8.34, 3.72], materials);
  addGymLetters(gym, 0, 6.76, 6.42, materials);

  addTreadmill(gym, [-4.8, 0.18, 2.6], materials, Math.PI);
  addTreadmill(gym, [-1.6, 0.18, 2.6], materials, Math.PI);
  addElliptical(gym, [1.9, 0.18, 2.8], materials, Math.PI);
  addExerciseBike(gym, [4.7, 0.18, 3.1], materials, Math.PI * 0.92);
  addExerciseBike(gym, [7.2, 0.18, 2.9], materials, Math.PI * 0.92);
  addBench(gym, [-7.5, 0.18, 9.0], materials, 0.16);
  addBench(gym, [7.5, 0.18, 8.72], materials, -0.16);
  addPlanter(gym, [-8.7, 0.02, 10.06], materials, 0.1);
  addPlanter(gym, [8.7, 0.02, 10.02], materials, -0.1);
  addPlateStack(gym, [-9.3, 0.9, 8.6], materials);
  addPlateStack(gym, [9.36, 0.9, 8.46], materials);
  addDumbbell(gym, [0, 12.62, -2.08], materials, 0.24);
  addRooftopUnit(gym, [-4.7, 7.96, -2.8], materials, 0.18);
  addRooftopUnit(gym, [4.8, 7.96, -1.64], materials, -0.12);

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
