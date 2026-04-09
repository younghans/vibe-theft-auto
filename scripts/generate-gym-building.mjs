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
const outputPath = path.join(projectRoot, 'assets', 'stickrpg_custom', 'models', 'gym-building.glb');

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.98,
    metalness: 0.04,
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

function addFrontWindowDetailRow(group, {
  startX,
  count,
  spacing,
  windowSize,
  y,
  z,
  backingMaterial,
  trimMaterial,
  sillMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const x = startX + (index * spacing);
    const [width, height] = windowSize;
    group.add(createBox([width + 0.18, height + 0.18, 0.08], [x, y, z - 0.08], backingMaterial));
    group.add(createBox([width + 0.26, 0.08, 0.22], [x, y + (height * 0.58), z + 0.02], trimMaterial));
    group.add(createBox([width + 0.18, 0.06, 0.12], [x, y - (height * 0.58), z + 0.01], sillMaterial));
  }
}

function addSideWindowDetailColumn(group, {
  x,
  startY,
  count,
  spacing,
  windowSize,
  z,
  backingMaterial,
  trimMaterial,
  sillMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const y = startY + (index * spacing);
    const [, height, depth] = windowSize;
    group.add(createBox([0.08, height + 0.18, depth + 0.2], [x + 0.09, y, z], backingMaterial));
    group.add(createBox([0.2, 0.08, depth + 0.28], [x - 0.03, y + (height * 0.58), z], trimMaterial));
    group.add(createBox([0.12, 0.06, depth + 0.18], [x - 0.01, y - (height * 0.58), z], sillMaterial));
  }
}

function addFrontWindowDetailColumn(group, {
  x,
  startY,
  count,
  spacing,
  windowSize,
  z,
  backingMaterial,
  trimMaterial,
  sillMaterial
}) {
  for (let index = 0; index < count; index += 1) {
    const y = startY + (index * spacing);
    const [width, height] = windowSize;
    group.add(createBox([width + 0.18, height + 0.18, 0.08], [x, y, z - 0.08], backingMaterial));
    group.add(createBox([width + 0.26, 0.08, 0.22], [x, y + (height * 0.58), z + 0.02], trimMaterial));
    group.add(createBox([width + 0.18, 0.06, 0.12], [x, y - (height * 0.58), z + 0.01], sillMaterial));
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

function addPlateStack(group, position, materials) {
  const [x, y, z] = position;
  group.add(createCylinder(0.56, 0.56, 0.18, 18, [x, y, z], materials.weight));
  group.add(createCylinder(0.47, 0.47, 0.18, 18, [x, y + 0.2, z], materials.weight));
  group.add(createCylinder(0.38, 0.38, 0.18, 18, [x, y + 0.4, z], materials.weight));
  group.add(createCylinder(0.14, 0.14, 1.02, 10, [x, y + 0.72, z], materials.metal));
}

function addBarbellEmblem(group, position, materials) {
  const emblem = new THREE.Group();
  emblem.position.set(...position);

  emblem.add(createBox([5.1, 0.22, 0.22], [0, 0, 0], materials.metal));
  emblem.add(createBox([0.2, 0.42, 0.22], [-0.95, 0, 0], materials.metalDark));
  emblem.add(createBox([0.2, 0.42, 0.22], [0.95, 0, 0], materials.metalDark));

  for (const [x, radius, depth] of [
    [-2.18, 0.92, 0.26],
    [-1.48, 0.62, 0.22],
    [1.48, 0.62, 0.22],
    [2.18, 0.92, 0.26]
  ]) {
    emblem.add(createCylinder(radius, radius, depth, 18, [x, 0, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  }

  group.add(emblem);
}

function addGymLetters(group, centerX, y, z, materials) {
  const faceMaterial = materials.signLight;
  const shadowMaterial = materials.signShadow;
  const faceDepth = 0.34;
  const shadowDepth = 0.2;

  function addPart(size, position, rotation = [0, 0, 0]) {
    group.add(createBox(
      [size[0] * 1.1, size[1] * 1.1, shadowDepth],
      [position[0] + 0.06, position[1] - 0.08, z - 0.12],
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
    addPart([0.42, 2.0], [x - 0.7, y]);
    addPart([1.34, 0.4], [x, y + 0.8]);
    addPart([1.34, 0.4], [x, y - 0.8]);
    addPart([0.38, 0.98], [x + 0.62, y - 0.31]);
    addPart([0.72, 0.34], [x + 0.34, y - 0.02]);
  }

  function addY(x) {
    addPart([0.34, 1.22], [x - 0.42, y + 0.44], [0, 0, 0.44]);
    addPart([0.34, 1.22], [x + 0.42, y + 0.44], [0, 0, -0.44]);
    addPart([0.38, 1.18], [x, y - 0.42]);
  }

  function addM(x) {
    addPart([0.38, 2.0], [x - 0.82, y]);
    addPart([0.38, 2.0], [x + 0.82, y]);
    addPart([0.34, 1.46], [x - 0.3, y + 0.24], [0, 0, -0.34]);
    addPart([0.34, 1.46], [x + 0.3, y + 0.24], [0, 0, 0.34]);
  }

  addG(centerX - 1.95);
  addY(centerX);
  addM(centerX + 1.95);
}

function addSquatRack(group, position, materials) {
  const rack = new THREE.Group();
  rack.position.set(...position);

  for (const x of [-1.15, 1.15]) {
    rack.add(createBox([0.18, 2.8, 0.18], [x, 1.4, 0], materials.metalDark));
    rack.add(createBox([0.42, 0.12, 0.22], [x, 2.15, 0], materials.metal));
  }

  rack.add(createBox([2.55, 0.16, 0.18], [0, 2.45, 0], materials.metalDark));
  rack.add(createBox([3.1, 0.18, 0.18], [0, 1.88, 0], materials.metal));

  for (const [x, radius] of [
    [-1.35, 0.52],
    [-0.86, 0.34],
    [0.86, 0.34],
    [1.35, 0.52]
  ]) {
    rack.add(createCylinder(radius, radius, 0.22, 16, [x, 1.88, 0], materials.weight, [0, 0, Math.PI * 0.5]));
  }

  rack.add(createBox([1.8, 0.12, 0.78], [0, 0.92, 0.55], materials.accentDark));
  rack.add(createBox([0.22, 0.52, 0.22], [-0.62, 0.52, 0.92], materials.metalDark));
  rack.add(createBox([0.22, 0.52, 0.22], [0.62, 0.52, 0.92], materials.metalDark));

  group.add(rack);
}

function createGymMaterials() {
  return {
    slab: createMaterial(0x5e656c),
    pavement: createMaterial(0xd8d3c6),
    rubberFloor: createMaterial(0x374048),
    facade: createMaterial(0xc4dff1),
    facadeDark: createMaterial(0x8fb6cf),
    facadeDeep: createMaterial(0x5d86a2),
    trim: createMaterial(0xf6f2e9),
    trimDark: createMaterial(0xa1b8ca),
    accent: createMaterial(0xd9b36a),
    accentDark: createMaterial(0xaa7e38),
    sign: createMaterial(0x2d4d63),
    signShadow: createMaterial(0x162633),
    signLight: createMaterial(0xf5f5ef),
    glass: createMaterial(0x84b5c9),
    glassLite: createMaterial(0xbfe4ef),
    door: createMaterial(0x203749),
    metal: createMaterial(0xc5ccd2),
    metalDark: createMaterial(0x68737c),
    weight: createMaterial(0x20262b)
  };
}

function buildGym() {
  const scene = new THREE.Scene();
  const gym = new THREE.Group();
  gym.name = 'gym_building';

  const materials = createGymMaterials();

  addBoxes(gym, [
    { size: [11.3, 0.58, 10.95], position: [0, 0.29, 0], material: materials.slab },
    { size: [9.1, 0.16, 2.8], position: [0.1, 0.66, 4.0], material: materials.pavement },
    { size: [3.2, 0.08, 1.42], position: [0.1, 0.71, 4.78], material: materials.rubberFloor },
    { size: [9.15, 5.95, 6.9], position: [0.15, 3.27, -0.3], material: materials.facade },
    { size: [5.95, 4.95, 4.55], position: [0.15, 8.98, -0.98], material: materials.facadeDark },
    { size: [3.18, 7.05, 4.1], position: [-3.95, 4.02, 0.08], material: materials.facadeDeep },
    { size: [2.92, 5.85, 4.02], position: [3.82, 3.42, -0.46], material: materials.facadeDeep },
    { size: [6.65, 3.22, 3.0], position: [0.1, 1.92, 4.02], material: materials.trim },
    { size: [2.55, 2.65, 2.72], position: [3.62, 1.72, 3.84], material: materials.facadeDeep },
    { size: [6.58, 3.55, 0.76], position: [0.15, 6.45, 3.03], material: materials.facade },
    { size: [6.58, 0.16, 0.24], position: [0.15, 7.55, 3.26], material: materials.accent },
    { size: [6.58, 0.12, 0.22], position: [0.15, 4.66, 3.26], material: materials.accentDark },
    { size: [5.36, 0.24, 1.88], position: [0.1, 3.26, 4.94], material: materials.accent, rotation: [-0.08, 0, 0] },
    { size: [5.0, 0.08, 1.66], position: [0.1, 3.18, 4.82], material: materials.trimDark, rotation: [-0.08, 0, 0] },
    { size: [5.52, 0.18, 0.2], position: [0.1, 3.18, 5.76], material: materials.accentDark },
    { size: [5.6, 2.5, 0.18], position: [0.15, 6.52, 3.28], material: materials.facade },
    { size: [0.22, 2.36, 0.22], position: [-2.26, 1.74, 4.98], material: materials.trim },
    { size: [0.22, 2.36, 0.22], position: [2.46, 1.74, 4.98], material: materials.trim },
    { size: [1.12, 2.02, 0.18], position: [-0.72, 1.22, 5.18], material: materials.door },
    { size: [1.12, 2.02, 0.18], position: [0.92, 1.22, 5.18], material: materials.door },
    { size: [2.92, 0.34, 0.16], position: [0.1, 2.55, 5.04], material: materials.glassLite },
    { size: [9.28, 0.18, 0.22], position: [0.15, 4.72, 3.22], material: materials.accent },
    { size: [9.28, 0.12, 0.22], position: [0.15, 2.56, 3.22], material: materials.trimDark },
    { size: [5.98, 0.18, 0.22], position: [0.15, 10.98, 1.36], material: materials.accent },
    { size: [5.98, 0.12, 0.22], position: [0.15, 8.36, 1.36], material: materials.trimDark },
    { size: [3.26, 0.16, 0.22], position: [-3.95, 7.18, 2.54], material: materials.accent },
    { size: [3.26, 0.12, 0.22], position: [-3.95, 4.88, 2.54], material: materials.trimDark },
    { size: [2.9, 0.16, 0.22], position: [3.82, 6.18, 1.9], material: materials.accent },
    { size: [2.9, 0.12, 0.22], position: [3.82, 3.96, 1.9], material: materials.trimDark },
    { size: [0.24, 7.05, 4.18], position: [-5.44, 4.02, 0.08], material: materials.trim },
    { size: [0.24, 7.05, 4.18], position: [-2.46, 4.02, 0.08], material: materials.trim },
    { size: [0.24, 5.85, 4.08], position: [2.36, 3.42, -0.46], material: materials.trim },
    { size: [0.24, 5.85, 4.08], position: [5.28, 3.42, -0.46], material: materials.trim },
    { size: [0.16, 2.1, 0.18], position: [-1.45, 9.7, 1.52], material: materials.accent },
    { size: [0.16, 2.1, 0.18], position: [0.15, 9.7, 1.52], material: materials.trim },
    { size: [0.16, 2.1, 0.18], position: [1.75, 9.7, 1.52], material: materials.accent },
    { size: [0.98, 0.58, 0.96], position: [2.65, 9.08, -2.0], material: materials.facadeDeep },
    { size: [0.42, 1.1, 0.42], position: [2.65, 9.92, -2.0], material: materials.metalDark },
    { size: [1.18, 0.5, 0.9], position: [-3.28, 11.08, -0.85], material: materials.facadeDeep },
    { size: [0.52, 0.92, 0.52], position: [-1.1, 11.0, -1.85], material: materials.metalDark },
    { size: [0.56, 0.34, 0.56], position: [0.95, 11.36, -1.25], material: materials.metalDark }
  ]);

  for (const x of [-1.72, 1.92]) {
    gym.add(createCylinder(0.08, 0.08, 1.28, 8, [x, 2.48, 5.14], materials.metalDark));
    gym.add(createBox([0.32, 0.12, 0.32], [x, 3.1, 5.16], materials.trim));
  }

  addParapetRect(gym, {
    centerX: 0.15,
    centerY: 6.33,
    centerZ: -0.3,
    width: 8.75,
    depth: 6.65,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: 0.15,
    centerY: 11.58,
    centerZ: -0.95,
    width: 5.62,
    depth: 4.32,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: -3.95,
    centerY: 7.62,
    centerZ: 0.08,
    width: 2.98,
    depth: 3.96,
    parapetHeight: 0.18,
    thickness: 0.16,
    material: materials.trim
  });
  addParapetRect(gym, {
    centerX: 3.78,
    centerY: 6.42,
    centerZ: -0.45,
    width: 2.72,
    depth: 3.82,
    parapetHeight: 0.18,
    thickness: 0.16,
    material: materials.trim
  });

  addWindowRow(gym, {
    startX: -2.98,
    count: 2,
    spacing: 6.05,
    size: [1.28, 2.18, 0.18],
    y: 1.76,
    z: 5.0,
    material: materials.glassLite
  });
  addFrontWindowDetailRow(gym, {
    startX: -2.98,
    count: 2,
    spacing: 6.05,
    windowSize: [1.28, 2.18, 0.18],
    y: 1.76,
    z: 5.0,
    backingMaterial: materials.trim,
    trimMaterial: materials.accentDark,
    sillMaterial: materials.trim
  });

  for (const [y, material] of [
    [3.54, materials.glassLite],
    [1.82, materials.glass]
  ]) {
    addWindowRow(gym, {
      startX: -2.42,
      count: 4,
      spacing: 1.68,
      size: [1.12, y > 3 ? 0.76 : 0.92, 0.18],
      y,
      z: y > 3 ? 4.02 : 3.92,
      material
    });
    addFrontWindowDetailRow(gym, {
      startX: -2.42,
      count: 4,
      spacing: 1.68,
      windowSize: [1.12, y > 3 ? 0.76 : 0.92, 0.18],
      y,
      z: y > 3 ? 4.02 : 3.92,
      backingMaterial: materials.trim,
      trimMaterial: materials.accentDark,
      sillMaterial: materials.trim
    });
  }

  for (const [y, material] of [
    [3.78, materials.glassLite],
    [5.72, materials.glass]
  ]) {
    addWindowColumn(gym, {
      x: -3.95,
      startY: y,
      count: 1,
      spacing: 1,
      size: [1.06, 0.92, 0.18],
      z: 2.54,
      material
    });
    addFrontWindowDetailColumn(gym, {
      x: -3.95,
      startY: y,
      count: 1,
      spacing: 1,
      windowSize: [1.06, 0.92, 0.18],
      z: 2.54,
      backingMaterial: materials.trim,
      trimMaterial: materials.accentDark,
      sillMaterial: materials.trim
    });
  }

  for (const [y, material] of [
    [2.0, materials.glass],
    [3.78, materials.glassLite],
    [5.56, materials.glass]
  ]) {
    addWindowColumn(gym, {
      x: 3.78,
      startY: y,
      count: 1,
      spacing: 1,
      size: [0.98, 0.88, 0.18],
      z: 1.9,
      material
    });
    addFrontWindowDetailColumn(gym, {
      x: 3.78,
      startY: y,
      count: 1,
      spacing: 1,
      windowSize: [0.98, 0.88, 0.18],
      z: 1.9,
      backingMaterial: materials.trim,
      trimMaterial: materials.accentDark,
      sillMaterial: materials.trim
    });
  }

  for (const [y, material] of [
    [8.92, materials.glassLite],
    [10.72, materials.glass]
  ]) {
    addWindowRow(gym, {
      startX: -1.54,
      count: 3,
      spacing: 1.7,
      size: [0.98, 0.88, 0.16],
      y,
      z: 1.4,
      material
    });
    addFrontWindowDetailRow(gym, {
      startX: -1.54,
      count: 3,
      spacing: 1.7,
      windowSize: [0.98, 0.88, 0.16],
      y,
      z: 1.4,
      backingMaterial: materials.trim,
      trimMaterial: materials.accentDark,
      sillMaterial: materials.trim
    });
  }

  addWindowColumn(gym, {
    x: -5.22,
    startY: 2.0,
    count: 3,
    spacing: 1.9,
    size: [0.16, 1.02, 1.02],
    z: 0.72,
    material: materials.glass
  });
  addSideWindowDetailColumn(gym, {
    x: -5.22,
    startY: 2.0,
    count: 3,
    spacing: 1.9,
    windowSize: [0.16, 1.02, 1.02],
    z: 0.72,
    backingMaterial: materials.trim,
    trimMaterial: materials.accentDark,
    sillMaterial: materials.trim
  });

  addWindowColumn(gym, {
    x: 2.36,
    startY: 1.92,
    count: 3,
    spacing: 1.78,
    size: [0.16, 0.94, 0.94],
    z: 0.36,
    material: materials.glassLite
  });
  addSideWindowDetailColumn(gym, {
    x: 2.36,
    startY: 1.92,
    count: 3,
    spacing: 1.78,
    windowSize: [0.16, 0.94, 0.94],
    z: 0.36,
    backingMaterial: materials.trim,
    trimMaterial: materials.accentDark,
    sillMaterial: materials.trim
  });

  addBarbellEmblem(gym, [0.15, 6.95, 3.46], materials);
  addGymLetters(gym, 0.15, 5.08, 3.46, materials);
  addSquatRack(gym, [0.15, 0.2, 2.6], materials);
  addPlateStack(gym, [-4.72, 0.84, 4.08], materials);
  addPlateStack(gym, [4.88, 0.84, 4.08], materials);

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
