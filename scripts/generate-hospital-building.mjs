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
const outputPath = path.join(projectRoot, 'assets', 'stickrpg_custom', 'models', 'hospital-building.glb');

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.98,
    metalness: 0.04,
    flatShading: true
  });
}

function createBox(size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(radiusTop, radiusBottom, height, segments, position, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBoxes(group, specs) {
  for (const { size, position, material } of specs) {
    group.add(createBox(size, position, material));
  }
}

function addWindowRow(group, {
  startX,
  count,
  spacing,
  size,
  y,
  z,
  material
}) {
  for (let index = 0; index < count; index += 1) {
    group.add(createBox(size, [startX + (index * spacing), y, z], material));
  }
}

function addWindowColumn(group, {
  x,
  startY,
  count,
  spacing,
  size,
  z,
  material
}) {
  for (let index = 0; index < count; index += 1) {
    group.add(createBox(size, [x, startY + (index * spacing), z], material));
  }
}

function addCross(group, position, material, backingMaterial = null) {
  const [x, y, z] = position;

  if (backingMaterial) {
    group.add(createBox([1.9, 1.9, 0.28], [x, y, z - 0.02], backingMaterial));
  }

  group.add(createBox([0.46, 1.44, 0.24], [x, y, z], material));
  group.add(createBox([1.28, 0.46, 0.24], [x, y, z], material));
}

function buildHospital() {
  const scene = new THREE.Scene();
  const hospital = new THREE.Group();
  hospital.name = 'hospital_building';

  const materials = {
    concrete: createMaterial(0xd9d6d2),
    concreteDark: createMaterial(0xa8afb8),
    trim: createMaterial(0xc84646),
    trimDark: createMaterial(0x8d2d34),
    glass: createMaterial(0x6e9db1),
    glassDark: createMaterial(0x405e6d),
    glassLite: createMaterial(0x8bb5c4),
    door: createMaterial(0x26343f),
    accent: createMaterial(0xf5f3ef),
    pad: createMaterial(0xbcc3cb),
    asphalt: createMaterial(0x30363c)
  };

  addBoxes(hospital, [
    { size: [11.4, 0.58, 11.1], position: [0, 0.29, 0], material: materials.concreteDark },
    { size: [10.0, 0.16, 2.8], position: [0, 0.66, 4.05], material: materials.accent },
    { size: [3.4, 0.14, 1.5], position: [3.6, 0.67, 3.85], material: materials.asphalt },
    { size: [9.0, 5.8, 7.1], position: [0.1, 3.48, -0.35], material: materials.concrete },
    { size: [5.9, 13.8, 4.8], position: [-1.65, 7.48, -1.55], material: materials.concreteDark },
    { size: [3.6, 2.3, 3.15], position: [-1.7, 15.03, -1.6], material: materials.concrete },
    { size: [2.85, 7.1, 3.55], position: [3.92, 4.15, 0.25], material: materials.concrete },
    { size: [5.2, 3.15, 2.7], position: [0, 1.95, 4.08], material: materials.accent },
    { size: [2.45, 2.6, 2.7], position: [3.75, 1.7, 3.65], material: materials.concrete },
    { size: [2.15, 1.7, 2.2], position: [-4.0, 1.25, 2.9], material: materials.concrete },
    { size: [5.8, 0.28, 2.35], position: [0, 3.08, 4.96], material: materials.trim },
    { size: [5.25, 0.12, 2.0], position: [0, 3.28, 4.9], material: materials.accent },
    { size: [0.22, 2.32, 0.22], position: [-2.1, 1.7, 4.94], material: materials.accent },
    { size: [0.22, 2.32, 0.22], position: [2.1, 1.7, 4.94], material: materials.accent },
    { size: [1.12, 2.02, 0.18], position: [-0.78, 1.22, 5.18], material: materials.door },
    { size: [1.12, 2.02, 0.18], position: [0.78, 1.22, 5.18], material: materials.door },
    { size: [2.25, 1.65, 0.26], position: [0, 5.2, 4.1], material: materials.accent },
    { size: [0.52, 1.18, 0.3], position: [0, 5.2, 4.24], material: materials.trim },
    { size: [1.32, 0.52, 0.3], position: [0, 5.2, 4.24], material: materials.trim },
    { size: [9.12, 0.2, 0.22], position: [0.1, 4.75, 3.24], material: materials.trim },
    { size: [9.12, 0.18, 0.22], position: [0.1, 2.55, 3.24], material: materials.trimDark },
    { size: [6.08, 0.18, 0.22], position: [-1.65, 12.65, 0.88], material: materials.trim },
    { size: [6.08, 0.18, 0.22], position: [-1.65, 10.3, 0.88], material: materials.trimDark },
    { size: [3.72, 0.18, 0.22], position: [-1.7, 16.18, 0.06], material: materials.trim },
    { size: [3.05, 0.18, 0.22], position: [3.92, 7.5, 2.02], material: materials.trim },
    { size: [3.05, 0.18, 0.22], position: [3.92, 5.15, 2.02], material: materials.trimDark },
    { size: [0.24, 13.8, 4.95], position: [-4.48, 7.48, -1.55], material: materials.accent },
    { size: [0.24, 13.8, 4.95], position: [1.18, 7.48, -1.55], material: materials.accent },
    { size: [0.24, 2.3, 3.2], position: [-3.38, 15.03, -1.6], material: materials.accent },
    { size: [0.24, 2.3, 3.2], position: [-0.02, 15.03, -1.6], material: materials.accent },
    { size: [0.24, 7.1, 3.7], position: [2.58, 4.15, 0.25], material: materials.accent },
    { size: [0.24, 7.1, 3.7], position: [5.26, 4.15, 0.25], material: materials.accent },
    { size: [0.65, 1.1, 0.65], position: [1.7, 6.55, -2.45], material: materials.concreteDark },
    { size: [1.24, 0.52, 0.92], position: [0.05, 6.25, -2.55], material: materials.concreteDark },
    { size: [0.88, 0.6, 0.88], position: [3.98, 7.5, -1.02], material: materials.concreteDark },
    { size: [0.72, 0.62, 0.72], position: [-3.65, 14.5, -2.2], material: materials.concreteDark },
    { size: [0.4, 1.28, 0.4], position: [-3.65, 15.3, -2.2], material: materials.trimDark },
    { size: [0.9, 1.95, 0.2], position: [3.56, 1.75, 4.88], material: materials.glassDark },
    { size: [0.32, 0.1, 1.1], position: [2.92, 0.78, 3.78], material: materials.trim },
    { size: [0.32, 0.1, 1.1], position: [4.28, 0.78, 3.78], material: materials.trim }
  ]);

  addCross(hospital, [3.75, 3.16, 4.98], materials.trim, materials.accent);

  for (const y of [1.78, 3.28, 4.78]) {
    addWindowRow(hospital, {
      startX: -3.1,
      count: 4,
      spacing: 2.1,
      size: [1.32, 0.9, 0.18],
      y,
      z: 3.36,
      material: y === 3.28 ? materials.glassLite : materials.glass
    });
  }

  for (const [y, material] of [
    [6.45, materials.glassLite],
    [8.55, materials.glass],
    [10.65, materials.glassLite],
    [12.75, materials.glass]
  ]) {
    addWindowRow(hospital, {
      startX: -3.35,
      count: 3,
      spacing: 1.75,
      size: [1.12, 0.9, 0.18],
      y,
      z: 0.98,
      material
    });
  }

  addWindowRow(hospital, {
    startX: -2.55,
    count: 2,
    spacing: 1.65,
    size: [0.92, 0.84, 0.16],
    y: 15.35,
    z: 0.18,
    material: materials.glassLite
  });

  addWindowRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    size: [0.95, 0.86, 0.16],
    y: 1.78,
    z: 2.1,
    material: materials.glass
  });
  addWindowRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    size: [0.95, 0.86, 0.16],
    y: 3.3,
    z: 2.1,
    material: materials.glassLite
  });
  addWindowRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    size: [0.95, 0.86, 0.16],
    y: 4.85,
    z: 2.1,
    material: materials.glass
  });
  addWindowRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    size: [0.95, 0.86, 0.16],
    y: 6.7,
    z: 2.1,
    material: materials.glassLite
  });
  addWindowColumn(hospital, {
    x: -4.5,
    startY: 2.05,
    count: 5,
    spacing: 2.0,
    size: [0.16, 1.08, 1.1],
    z: 0.78,
    material: materials.glass
  });
  addWindowColumn(hospital, {
    x: -2.65,
    startY: 6.35,
    count: 4,
    spacing: 2.0,
    size: [1.0, 1.0, 0.16],
    z: -4.06,
    material: materials.glassDark
  });
  addWindowColumn(hospital, {
    x: -0.75,
    startY: 6.35,
    count: 4,
    spacing: 2.0,
    size: [1.0, 1.0, 0.16],
    z: -4.06,
    material: materials.glassLite
  });

  hospital.add(createCylinder(1.72, 1.72, 0.12, 22, [-1.72, 16.26, -1.7], materials.pad));
  hospital.add(createCylinder(1.46, 1.46, 0.05, 22, [-1.72, 16.35, -1.7], materials.glassDark));
  hospital.add(createCylinder(1.32, 1.32, 0.03, 22, [-1.72, 16.41, -1.7], materials.pad));
  hospital.add(createBox([0.3, 1.08, 0.08], [-1.72, 16.45, -1.7], materials.accent));
  hospital.add(createBox([1.04, 0.3, 0.08], [-1.72, 16.45, -1.7], materials.accent));

  scene.add(hospital);
  return scene;
}

async function main() {
  const exporter = new GLTFExporter();
  const hospitalScene = buildHospital();
  const arrayBuffer = await exporter.parseAsync(hospitalScene, { binary: true });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));

  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

await main();
