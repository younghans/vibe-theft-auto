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
const outputPath = path.join(projectRoot, 'assets', 'stickrpg_custom', 'models', 'bar-building-wide.glb');

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.98,
    metalness: 0.03,
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

function addWindowRow(group, {
  startX,
  count,
  spacing,
  size,
  y,
  z,
  material,
  trimMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const x = startX + (index * spacing);
    group.add(createBox(size, [x, y, z], material));
    if (trimMaterial) {
      group.add(createBox([size[0] + 0.28, size[1] + 0.22, 0.08], [x, y, z - 0.08], trimMaterial));
      group.add(createBox([size[0] + 0.14, 0.08, 0.14], [x, y - (size[1] * 0.6), z + 0.02], trimMaterial));
    }
  }
}

function addWindowColumn(group, {
  x,
  startY,
  count,
  spacing,
  size,
  z,
  material,
  trimMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const y = startY + (index * spacing);
    group.add(createBox(size, [x, y, z], material));
    if (trimMaterial) {
      group.add(createBox([0.08, size[1] + 0.24, size[2] + 0.18], [x - 0.08, y, z], trimMaterial));
    }
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

function addBarrel(group, position, materials) {
  const [x, y, z] = position;
  group.add(createCylinder(0.54, 0.6, 1.12, 10, [x, y, z], materials.barrelWood));
  group.add(createCylinder(0.62, 0.62, 0.12, 10, [x, y + 0.44, z], materials.barrelBand));
  group.add(createCylinder(0.62, 0.62, 0.12, 10, [x, y - 0.44, z], materials.barrelBand));
}

function addBeerMug(group, position, materials) {
  const mug = new THREE.Group();
  mug.position.set(...position);
  mug.rotation.z = -0.1;

  mug.add(createCylinder(1.95, 1.72, 4.3, 14, [0, 0, 0], materials.mugGlass));
  mug.add(createCylinder(1.56, 1.36, 3.1, 14, [0, -0.35, 0], materials.beer));
  mug.add(createCylinder(1.3, 1.2, 0.18, 14, [0, 1.58, 0], materials.beerFoamShadow));
  mug.add(createCylinder(1.24, 1.16, 0.16, 14, [0, 1.7, 0], materials.beer));
  mug.add(createCylinder(1.72, 1.56, 0.2, 14, [0, 2.08, 0], materials.foam));

  for (const foamSpec of [
    [-1.02, 2.28, 0.15, 0.54],
    [-0.22, 2.46, -0.12, 0.64],
    [0.62, 2.32, 0.2, 0.58],
    [1.1, 2.05, -0.08, 0.44],
    [-0.72, 1.95, -0.18, 0.4]
  ]) {
    const [x, y, z, radius] = foamSpec;
    mug.add(createSphere(radius, 10, 8, [x, y, z], materials.foam));
  }

  mug.add(createTorus(1.14, 0.22, 8, 14, [2.18, 0.24, 0], materials.mugGlass, [0, 0, Math.PI * 0.5]));
  mug.add(createCylinder(0.28, 0.28, 0.96, 8, [1.58, 1.12, 0], materials.mugGlass, [0, 0, 0.28]));
  mug.add(createCylinder(0.28, 0.28, 0.96, 8, [1.52, -0.74, 0], materials.mugGlass, [0, 0, -0.24]));

  group.add(mug);
}

function addBarLetters(group, centerX, y, z, materials) {
  const letterMaterial = materials.signAccent;
  const spacing = 3.4;
  const thickness = 0.36;
  const stemWidth = 0.48;
  const stem = 2.85;
  const top = y + 1.2;
  const mid = y + 0.06;
  const bottom = y - 1.05;

  const add = (size, position, rotation = [0, 0, 0]) => {
    group.add(createBox(size, position, letterMaterial, rotation));
  };

  const bx = centerX - spacing;
  add([stemWidth, stem, thickness], [bx - 0.78, y + 0.06, z]);
  add([1.9, 0.42, thickness], [bx + 0.05, top, z]);
  add([1.62, 0.38, thickness], [bx - 0.02, mid, z]);
  add([1.92, 0.42, thickness], [bx + 0.05, bottom, z]);
  add([0.46, 0.9, thickness], [bx + 0.78, y + 0.72, z]);
  add([0.46, 0.92, thickness], [bx + 0.78, y - 0.74, z]);

  const ax = centerX;
  add([0.5, 2.55, thickness], [ax - 0.88, y - 0.1, z], [0, 0, 0.18]);
  add([0.5, 2.55, thickness], [ax + 0.88, y - 0.1, z], [0, 0, -0.18]);
  add([2.02, 0.42, thickness], [ax, top, z]);
  add([1.44, 0.36, thickness], [ax, mid - 0.02, z]);

  const rx = centerX + spacing;
  add([stemWidth, stem, thickness], [rx - 0.84, y + 0.06, z]);
  add([1.88, 0.42, thickness], [rx + 0.02, top, z]);
  add([1.58, 0.38, thickness], [rx - 0.02, mid, z]);
  add([0.48, 0.96, thickness], [rx + 0.78, y + 0.72, z]);
  add([1.18, 0.44, thickness], [rx - 0.02, y + 0.76, z]);
  add([1.42, 0.44, thickness], [rx - 0.12, y + 0.02, z]);
  add([0.46, 1.58, thickness], [rx + 0.1, y - 0.38, z], [0, 0, -0.82]);
}

function createBarMaterials() {
  return {
    slab: createMaterial(0x3b4148),
    pavement: createMaterial(0xb8b0a5),
    brick: createMaterial(0x8c4f3f),
    brickDark: createMaterial(0x5c342d),
    stucco: createMaterial(0xd8c5a6),
    stuccoDark: createMaterial(0xb89f83),
    trim: createMaterial(0xf0e6d0),
    window: createMaterial(0x5d7681),
    windowLite: createMaterial(0x82a0aa),
    awning: createMaterial(0x6f2b27),
    awningDark: createMaterial(0x4d1c1b),
    sign: createMaterial(0x2e2724),
    signAccent: createMaterial(0xf1c24d),
    door: createMaterial(0x2a221f),
    barrelWood: createMaterial(0x8b633d),
    barrelBand: createMaterial(0x3e454c),
    mugGlass: createMaterial(0xd8d6bf),
    beer: createMaterial(0xd79a26),
    beerFoamShadow: createMaterial(0xc88610),
    foam: createMaterial(0xf7f1dc)
  };
}

function buildBar() {
  const scene = new THREE.Scene();
  const bar = new THREE.Group();
  bar.name = 'bar_building_wide';

  const materials = createBarMaterials();

  addBoxes(bar, [
    { size: [22.4, 0.58, 10.9], position: [0, 0.29, 0], material: materials.slab },
    { size: [18.9, 0.16, 2.5], position: [0, 0.66, 4.08], material: materials.pavement },
    { size: [19.1, 8.6, 6.6], position: [0.15, 4.6, -0.45], material: materials.brick },
    { size: [16.6, 3.45, 2.95], position: [0.05, 2.02, 3.38], material: materials.stucco },
    { size: [8.1, 3.5, 4.85], position: [0.35, 10.15, -0.6], material: materials.brickDark },
    { size: [5.2, 11.8, 4.85], position: [-7.25, 6.2, -1.0], material: materials.brickDark },
    { size: [4.9, 11.1, 4.45], position: [8.0, 5.84, -0.35], material: materials.brickDark },
    { size: [2.65, 2.7, 2.55], position: [-7.5, 1.66, 3.62], material: materials.stuccoDark },
    { size: [9.6, 0.32, 1.88], position: [0.2, 3.28, 4.45], material: materials.awning },
    { size: [13.9, 2.2, 0.62], position: [0.15, 5.75, 3.02], material: materials.sign },
    { size: [17.2, 0.18, 0.22], position: [0.15, 8.95, 2.95], material: materials.trim },
    { size: [17.2, 0.18, 0.22], position: [0.15, 6.75, 2.95], material: materials.awningDark },
    { size: [8.3, 0.18, 0.22], position: [0.35, 12.0, 1.62], material: materials.trim },
    { size: [4.75, 0.18, 0.22], position: [-7.25, 12.35, 1.5], material: materials.trim },
    { size: [4.55, 0.18, 0.22], position: [8.0, 11.65, 1.65], material: materials.trim },
    { size: [2.8, 0.14, 2.25], position: [8.0, 11.78, -0.25], material: materials.pavement },
    { size: [1.26, 2.18, 0.18], position: [-0.8, 1.28, 4.88], material: materials.door },
    { size: [1.26, 2.18, 0.18], position: [0.8, 1.28, 4.88], material: materials.door },
    { size: [0.18, 2.36, 0.18], position: [-1.92, 1.72, 4.92], material: materials.trim },
    { size: [0.18, 2.36, 0.18], position: [1.92, 1.72, 4.92], material: materials.trim },
    { size: [0.38, 1.52, 0.18], position: [0, 1.52, 4.94], material: materials.trim },
    { size: [1.32, 0.18, 0.22], position: [0, 2.45, 4.95], material: materials.trim },
    { size: [4.35, 0.12, 0.28], position: [-7.25, 8.95, 1.72], material: materials.stuccoDark },
    { size: [4.1, 0.12, 0.28], position: [8.0, 8.4, 1.72], material: materials.stuccoDark },
    { size: [0.32, 2.1, 0.2], position: [-4.9, 1.64, 4.4], material: materials.trim },
    { size: [0.32, 2.1, 0.2], position: [5.3, 1.64, 4.4], material: materials.trim },
    { size: [0.3, 3.9, 0.18], position: [-0.2, 11.55, -2.38], material: materials.brickDark },
    { size: [0.75, 0.78, 0.75], position: [-8.75, 12.55, -1.95], material: materials.brickDark },
    { size: [0.62, 1.02, 0.62], position: [7.0, 11.15, -1.72], material: materials.brickDark },
    { size: [1.05, 0.65, 0.92], position: [8.8, 12.25, -1.12], material: materials.stuccoDark },
    { size: [0.84, 0.55, 0.84], position: [-6.2, 12.72, -0.92], material: materials.stuccoDark }
  ]);

  addParapetRect(bar, {
    centerX: 0.15,
    centerY: 9.96,
    centerZ: -0.45,
    width: 18.7,
    depth: 6.4,
    parapetHeight: 0.24,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(bar, {
    centerX: -7.25,
    centerY: 12.24,
    centerZ: -1.0,
    width: 4.95,
    depth: 4.55,
    parapetHeight: 0.22,
    thickness: 0.16,
    material: materials.trim
  });
  addParapetRect(bar, {
    centerX: 8.0,
    centerY: 11.5,
    centerZ: -0.35,
    width: 4.6,
    depth: 4.15,
    parapetHeight: 0.22,
    thickness: 0.16,
    material: materials.trim
  });

  addWindowRow(bar, {
    startX: -6.0,
    count: 3,
    spacing: 2.05,
    size: [1.38, 1.12, 0.16],
    y: 1.88,
    z: 4.16,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });
  addWindowRow(bar, {
    startX: 2.85,
    count: 3,
    spacing: 2.05,
    size: [1.38, 1.12, 0.16],
    y: 1.88,
    z: 4.16,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });

  for (const [y, material] of [
    [7.15, materials.window],
    [5.1, materials.windowLite],
    [3.05, materials.window]
  ]) {
    addWindowRow(bar, {
      startX: -6.7,
      count: 7,
      spacing: 2.2,
      size: [1.22, 0.92, 0.16],
      y,
      z: 2.96,
      material,
      trimMaterial: materials.trim
    });
  }

  for (const [x, z, material] of [
    [-9.72, 0.95, materials.windowLite],
    [-9.72, -0.6, materials.window],
    [5.72, 0.85, materials.windowLite],
    [5.72, -0.65, materials.window]
  ]) {
    addWindowColumn(bar, {
      x,
      startY: 2.18,
      count: 4,
      spacing: 2.0,
      size: [0.16, 1.02, 1.08],
      z,
      material,
      trimMaterial: materials.trim
    });
  }

  addWindowRow(bar, {
    startX: -8.05,
    count: 2,
    spacing: 1.6,
    size: [0.92, 0.86, 0.16],
    y: 10.18,
    z: 1.62,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });
  addWindowRow(bar, {
    startX: 7.2,
    count: 2,
    spacing: 1.58,
    size: [0.92, 0.86, 0.16],
    y: 9.42,
    z: 1.78,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });

  for (const x of [-3.4, -1.7, 1.7, 3.4]) {
    bar.add(createCylinder(0.1, 0.1, 1.78, 8, [x, 2.42, 4.48], materials.trim));
  }

  addBarLetters(bar, 0.12, 5.9, 3.42, materials);
  addBeerMug(bar, [8.35, 14.2, -0.05], materials);
  addBarrel(bar, [-9.0, 1.1, 4.1], materials);
  addBarrel(bar, [8.95, 1.1, 4.1], materials);

  scene.add(bar);
  return scene;
}

async function main() {
  const exporter = new GLTFExporter();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const scene = buildBar();
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

await main();
