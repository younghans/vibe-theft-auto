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
  const thickness = 0.58;

  const add = (size, position, rotation = [0, 0, 0]) => {
    group.add(createBox(size, position, letterMaterial, rotation));
  };

  function addB(x) {
    add([0.58, 3.5, thickness], [x - 0.96, y, z]);
    add([2.0, 0.52, thickness], [x, y + 1.5, z]);
    add([1.8, 0.48, thickness], [x - 0.06, y + 0.1, z]);
    add([2.0, 0.52, thickness], [x, y - 1.4, z]);
    add([0.56, 1.06, thickness], [x + 0.7, y + 0.9, z]);
    add([0.56, 1.08, thickness], [x + 0.7, y - 0.9, z]);
  }

  function addA(x) {
    add([0.58, 3.38, thickness], [x - 0.96, y - 0.02, z], [0, 0, 0.18]);
    add([0.58, 3.38, thickness], [x + 0.96, y - 0.02, z], [0, 0, -0.18]);
    add([2.08, 0.54, thickness], [x, y + 1.42, z]);
    add([1.52, 0.46, thickness], [x, y + 0.02, z]);
  }

  function addR(x) {
    add([0.58, 3.5, thickness], [x - 1.0, y, z]);
    add([2.06, 0.52, thickness], [x + 0.04, y + 1.5, z]);
    add([1.82, 0.48, thickness], [x - 0.08, y + 0.08, z]);
    add([0.58, 1.08, thickness], [x + 0.76, y + 0.92, z]);
    add([1.56, 0.48, thickness], [x - 0.02, y + 0.84, z]);
    add([0.58, 2.08, thickness], [x + 0.24, y - 0.82, z], [0, 0, -0.68]);
  }

  addB(centerX - 4.2);
  addA(centerX);
  addR(centerX + 4.2);
}

function createBarMaterials() {
  return {
    slab: createMaterial(0x4b4137),
    pavement: createMaterial(0xcab99a),
    brick: createMaterial(0xc6ad87),
    brickDark: createMaterial(0x6f4a2f),
    stucco: createMaterial(0xdfcda9),
    stuccoDark: createMaterial(0xa9754a),
    trim: createMaterial(0xf2e6cc),
    window: createMaterial(0x5d6e73),
    windowLite: createMaterial(0xd29f56),
    awning: createMaterial(0x7a5531),
    awningDark: createMaterial(0x4b2f1d),
    sign: createMaterial(0x6a3d20),
    signAccent: createMaterial(0xf1c24d),
    door: createMaterial(0x2d180f),
    barrelWood: createMaterial(0x8b633d),
    barrelBand: createMaterial(0x3e454c),
    mugGlass: createMaterial(0xd8d6bf),
    beer: createMaterial(0xe0be37),
    beerFoamShadow: createMaterial(0xc79216),
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
    { size: [19.2, 0.18, 2.55], position: [0, 0.66, 4.06], material: materials.pavement },
    { size: [19.0, 6.8, 6.35], position: [0, 4.0, -0.48], material: materials.brick },
    { size: [19.0, 3.25, 3.0], position: [0, 1.92, 3.32], material: materials.stuccoDark },
    { size: [8.2, 4.3, 4.1], position: [0, 8.65, -0.32], material: materials.stucco },
    { size: [4.9, 8.9, 4.75], position: [-7.2, 4.95, -0.82], material: materials.brickDark },
    { size: [4.9, 8.3, 4.45], position: [7.2, 4.65, -0.52], material: materials.brickDark },
    { size: [13.8, 3.45, 0.7], position: [0, 5.12, 3.02], material: materials.sign },
    { size: [14.2, 0.24, 0.28], position: [0, 7.0, 2.9], material: materials.trim },
    { size: [14.0, 0.24, 0.28], position: [0, 3.2, 2.9], material: materials.awningDark },
    { size: [8.5, 0.22, 0.28], position: [0, 10.62, 1.76], material: materials.trim },
    { size: [18.7, 0.26, 0.32], position: [0, 8.96, -0.52], material: materials.awningDark },
    { size: [4.0, 0.22, 4.0], position: [0, 12.12, -0.55], material: materials.awningDark },
    { size: [1.26, 2.18, 0.18], position: [-0.8, 1.28, 4.88], material: materials.door },
    { size: [1.26, 2.18, 0.18], position: [0.8, 1.28, 4.88], material: materials.door },
    { size: [0.18, 2.36, 0.18], position: [-1.92, 1.72, 4.92], material: materials.trim },
    { size: [0.18, 2.36, 0.18], position: [1.92, 1.72, 4.92], material: materials.trim },
    { size: [0.38, 1.52, 0.18], position: [0, 1.52, 4.94], material: materials.trim },
    { size: [1.32, 0.18, 0.22], position: [0, 2.45, 4.95], material: materials.trim },
    { size: [18.9, 0.2, 0.22], position: [0, 6.32, 2.96], material: materials.awningDark },
    { size: [18.9, 0.2, 0.22], position: [0, 3.18, 2.96], material: materials.awningDark },
    { size: [7.95, 0.18, 0.24], position: [0, 10.92, 1.82], material: materials.awningDark },
    { size: [0.3, 4.15, 0.18], position: [0, 10.82, -2.2], material: materials.brickDark }
  ]);

  bar.add(createBox([19.4, 0.46, 4.7], [0, 8.15, 1.05], materials.awning, [0.42, 0, 0]));
  bar.add(createBox([19.4, 0.46, 4.9], [0, 8.18, -2.02], materials.awning, [-0.42, 0, 0]));
  bar.add(createBox([8.8, 0.42, 2.95], [0, 10.95, 0.6], materials.awning, [0.56, 0, 0]));
  bar.add(createBox([8.8, 0.42, 3.1], [0, 10.98, -1.9], materials.awning, [-0.56, 0, 0]));
  bar.add(createBox([18.5, 0.26, 0.28], [0, 9.02, -0.48], materials.trim));
  bar.add(createBox([8.6, 0.24, 0.26], [0, 11.98, -0.66], materials.trim));
  bar.add(createBox([18.1, 0.34, 2.7], [0, 4.2, 4.25], materials.awning, [-0.24, 0, 0]));

  addWindowRow(bar, {
    startX: -6.0,
    count: 2,
    spacing: 2.05,
    size: [1.52, 1.3, 0.16],
    y: 1.92,
    z: 4.16,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });
  addWindowRow(bar, {
    startX: 3.95,
    count: 2,
    spacing: 2.05,
    size: [1.52, 1.3, 0.16],
    y: 1.92,
    z: 4.16,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });

  for (const [y, material] of [
    [6.85, materials.windowLite],
    [4.75, materials.window]
  ]) {
    addWindowRow(bar, {
      startX: -6.5,
      count: 2,
      spacing: 2.3,
      size: [1.18, 1.0, 0.16],
      y,
      z: 2.96,
      material,
      trimMaterial: materials.trim
    });
    addWindowRow(bar, {
      startX: 4.2,
      count: 2,
      spacing: 2.3,
      size: [1.18, 1.0, 0.16],
      y,
      z: 2.96,
      material,
      trimMaterial: materials.trim
    });
  }

  addWindowRow(bar, {
    startX: -2.25,
    count: 3,
    spacing: 2.25,
    size: [1.04, 0.98, 0.16],
    y: 9.02,
    z: 2.0,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });

  for (const [x, z, material] of [
    [-9.28, 0.9, materials.windowLite],
    [-9.28, -0.76, materials.window],
    [9.28, 0.76, materials.windowLite],
    [9.28, -0.72, materials.window]
  ]) {
    addWindowColumn(bar, {
      x,
      startY: 2.18,
      count: 3,
      spacing: 2.0,
      size: [0.16, 1.02, 1.08],
      z,
      material,
      trimMaterial: materials.trim
    });
  }

  addWindowRow(bar, {
    startX: -8.0,
    count: 2,
    spacing: 1.6,
    size: [0.92, 0.86, 0.16],
    y: 7.95,
    z: 1.62,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });
  addWindowRow(bar, {
    startX: 6.4,
    count: 2,
    spacing: 1.58,
    size: [0.92, 0.86, 0.16],
    y: 7.48,
    z: 1.78,
    material: materials.windowLite,
    trimMaterial: materials.trim
  });

  for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
    bar.add(createCylinder(0.16, 0.16, 2.5, 8, [x, 2.0, 4.28], materials.awningDark));
    bar.add(createBox([0.48, 0.28, 0.48], [x, 3.32, 4.28], materials.trim));
  }

  for (const x of [-7.0, -3.5, 0, 3.5, 7.0]) {
    bar.add(createBox([0.22, 6.4, 0.18], [x, 4.0, 2.84], materials.awningDark));
  }

  bar.add(createBox([14.0, 0.24, 0.24], [0, 6.95, 3.44], materials.trim));
  bar.add(createBox([14.0, 0.24, 0.24], [0, 3.3, 3.44], materials.trim));
  bar.add(createBox([0.24, 3.65, 0.24], [-6.9, 5.12, 3.44], materials.trim));
  bar.add(createBox([0.24, 3.65, 0.24], [6.9, 5.12, 3.44], materials.trim));

  addBarLetters(bar, 0, 5.1, 3.55, materials);
  addBeerMug(bar, [0, 14.0, -0.52], materials);
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
