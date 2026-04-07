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
    group.add(createBox([1.9, 1.9, 0.24], [x, y, z - 0.08], backingMaterial));
  }

  group.add(createBox([0.46, 1.44, 0.18], [x, y, z + 0.1], material));
  group.add(createBox([1.28, 0.46, 0.18], [x, y, z + 0.1], material));
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
    group.add(createBox([width + 0.22, height + 0.18, 0.08], [x, y, z - 0.08], backingMaterial));
    group.add(createBox([width + 0.34, 0.08, 0.22], [x, y + (height * 0.58), z + 0.04], trimMaterial));
    group.add(createBox([width + 0.22, 0.06, 0.12], [x, y - (height * 0.58), z + 0.03], sillMaterial));
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
    group.add(createBox([0.08, height + 0.18, depth + 0.2], [x + 0.1, y, z], backingMaterial));
    group.add(createBox([0.22, 0.08, depth + 0.3], [x - 0.04, y + (height * 0.58), z], trimMaterial));
    group.add(createBox([0.12, 0.06, depth + 0.2], [x - 0.02, y - (height * 0.58), z], sillMaterial));
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
    group.add(createBox([width + 0.28, 0.08, 0.22], [x, y + (height * 0.58), z + 0.02], trimMaterial));
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
    { size: [5.8, 0.28, 2.35], position: [0, 3.08, 4.96], material: materials.trim },
    { size: [5.25, 0.12, 2.0], position: [0, 3.28, 4.9], material: materials.accent },
    { size: [0.22, 2.32, 0.22], position: [-2.1, 1.7, 4.94], material: materials.accent },
    { size: [0.22, 2.32, 0.22], position: [2.1, 1.7, 4.94], material: materials.accent },
    { size: [1.12, 2.02, 0.18], position: [-0.78, 1.22, 5.18], material: materials.door },
    { size: [1.12, 2.02, 0.18], position: [0.78, 1.22, 5.18], material: materials.door },
    { size: [9.12, 0.2, 0.22], position: [0.1, 4.75, 3.24], material: materials.trim },
    { size: [9.12, 0.18, 0.22], position: [0.1, 2.55, 3.24], material: materials.trimDark },
    { size: [6.08, 0.18, 0.22], position: [-1.65, 12.65, 0.88], material: materials.trim },
    { size: [6.08, 0.18, 0.22], position: [-1.65, 10.3, 0.88], material: materials.trimDark },
    { size: [3.72, 0.18, 0.22], position: [-1.7, 16.18, 0.06], material: materials.trim },
    { size: [3.05, 0.18, 0.22], position: [3.92, 7.5, 2.02], material: materials.trim },
    { size: [3.05, 0.18, 0.22], position: [3.92, 5.15, 2.02], material: materials.trimDark },
    { size: [0.24, 13.8, 4.95], position: [-4.72, 7.48, -1.55], material: materials.accent },
    { size: [0.24, 13.8, 4.95], position: [1.42, 7.48, -1.55], material: materials.accent },
    { size: [0.24, 2.3, 3.2], position: [-3.62, 15.03, -1.6], material: materials.accent },
    { size: [0.24, 2.3, 3.2], position: [0.22, 15.03, -1.6], material: materials.accent },
    { size: [0.24, 7.1, 3.7], position: [2.58, 4.15, 0.25], material: materials.accent },
    { size: [0.24, 7.1, 3.7], position: [5.26, 4.15, 0.25], material: materials.accent },
    { size: [0.65, 1.1, 0.65], position: [1.7, 6.55, -2.45], material: materials.concreteDark },
    { size: [1.24, 0.52, 0.92], position: [0.05, 6.25, -2.55], material: materials.concreteDark },
    { size: [0.88, 0.6, 0.88], position: [3.98, 7.5, -1.02], material: materials.concreteDark },
    { size: [0.72, 0.62, 0.72], position: [-3.65, 14.5, -2.2], material: materials.concreteDark },
    { size: [0.4, 1.28, 0.4], position: [-3.65, 15.3, -2.2], material: materials.trimDark },
    { size: [0.9, 1.95, 0.2], position: [3.56, 1.75, 4.88], material: materials.glassDark },
    { size: [0.32, 0.1, 1.1], position: [2.92, 0.78, 3.78], material: materials.trim },
    { size: [0.32, 0.1, 1.1], position: [4.28, 0.78, 3.78], material: materials.trim },
    { size: [6.7, 0.09, 0.34], position: [-1.65, 5.4, 1.1], material: materials.accent },
    { size: [6.7, 0.09, 0.34], position: [-1.65, 7.5, 1.1], material: materials.accent },
    { size: [6.7, 0.09, 0.34], position: [-1.65, 11.7, 1.1], material: materials.accent },
    { size: [4.05, 0.08, 0.28], position: [3.92, 2.45, 2.22], material: materials.accent },
    { size: [4.05, 0.08, 0.28], position: [3.92, 4.0, 2.22], material: materials.accent },
    { size: [4.05, 0.08, 0.28], position: [3.92, 5.55, 2.22], material: materials.accent },
    { size: [4.05, 0.08, 0.28], position: [3.92, 7.4, 2.22], material: materials.accent },
    { size: [0.95, 0.65, 1.15], position: [0.65, 6.35, -2.05], material: materials.concreteDark },
    { size: [1.25, 0.5, 0.9], position: [-2.85, 13.45, -0.95], material: materials.concreteDark },
    { size: [0.42, 1.0, 0.42], position: [-0.15, 13.75, -0.75], material: materials.trimDark },
    { size: [0.42, 0.75, 0.42], position: [4.55, 7.95, -0.25], material: materials.trimDark }
  ]);

  addCross(hospital, [3.75, 3.16, 4.98], materials.trim, materials.accent);

  addParapetRect(hospital, {
    centerX: 0.1,
    centerY: 6.53,
    centerZ: -0.35,
    width: 8.7,
    depth: 6.8,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.accent
  });
  addParapetRect(hospital, {
    centerX: -1.65,
    centerY: 14.5,
    centerZ: -1.55,
    width: 5.6,
    depth: 4.5,
    parapetHeight: 0.22,
    thickness: 0.18,
    material: materials.accent
  });
  addParapetRect(hospital, {
    centerX: 3.92,
    centerY: 7.88,
    centerZ: 0.25,
    width: 2.55,
    depth: 3.25,
    parapetHeight: 0.18,
    thickness: 0.16,
    material: materials.accent
  });

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
  for (const y of [1.78, 3.28, 4.78]) {
    addFrontWindowDetailRow(hospital, {
      startX: -3.1,
      count: 4,
      spacing: 2.1,
      windowSize: [1.32, 0.9, 0.18],
      y,
      z: 3.36,
      backingMaterial: materials.accent,
      trimMaterial: materials.trimDark,
      sillMaterial: materials.accent
    });
  }

  for (const [y, material] of [
    [6.45, materials.glassLite],
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
  for (const y of [6.45, 12.75]) {
    addFrontWindowDetailRow(hospital, {
      startX: -3.35,
      count: 3,
      spacing: 1.75,
      windowSize: [1.12, 0.9, 0.18],
      y,
      z: 0.98,
      backingMaterial: materials.accent,
      trimMaterial: materials.trimDark,
      sillMaterial: materials.accent
    });
  }

  for (const [y, material] of [
    [8.55, materials.glass],
    [10.65, materials.glassLite]
  ]) {
    addWindowRow(hospital, {
      startX: -3.25,
      count: 2,
      spacing: 3.2,
      size: [1.12, 0.9, 0.18],
      y,
      z: 0.98,
      material
    });
  }
  for (const y of [8.55, 10.65]) {
    addFrontWindowDetailRow(hospital, {
      startX: -3.25,
      count: 2,
      spacing: 3.2,
      windowSize: [1.12, 0.9, 0.18],
      y,
      z: 0.98,
      backingMaterial: materials.accent,
      trimMaterial: materials.trimDark,
      sillMaterial: materials.accent
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
  addFrontWindowDetailRow(hospital, {
    startX: -2.55,
    count: 2,
    spacing: 1.65,
    windowSize: [0.92, 0.84, 0.16],
    y: 15.35,
    z: 0.18,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
  });

  addCross(hospital, [-1.65, 9.6, 1.02], materials.trim, materials.accent);

  addWindowRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    size: [0.95, 0.86, 0.16],
    y: 1.78,
    z: 2.1,
    material: materials.glass
  });
  addFrontWindowDetailRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    windowSize: [0.95, 0.86, 0.16],
    y: 1.78,
    z: 2.1,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
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
  addFrontWindowDetailRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    windowSize: [0.95, 0.86, 0.16],
    y: 3.3,
    z: 2.1,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
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
  addFrontWindowDetailRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    windowSize: [0.95, 0.86, 0.16],
    y: 4.85,
    z: 2.1,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
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
  addFrontWindowDetailRow(hospital, {
    startX: 3.12,
    count: 2,
    spacing: 1.5,
    windowSize: [0.95, 0.86, 0.16],
    y: 6.7,
    z: 2.1,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
  });
  addWindowColumn(hospital, {
    x: -4.68,
    startY: 2.05,
    count: 5,
    spacing: 2.0,
    size: [0.16, 1.08, 1.1],
    z: 0.78,
    material: materials.glass
  });
  addSideWindowDetailColumn(hospital, {
    x: -4.68,
    startY: 2.05,
    count: 5,
    spacing: 2.0,
    windowSize: [0.16, 1.08, 1.1],
    z: 0.78,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
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
  addFrontWindowDetailColumn(hospital, {
    x: -2.65,
    startY: 6.35,
    count: 4,
    spacing: 2.0,
    windowSize: [1.0, 1.0, 0.16],
    z: -4.06,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
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
  addFrontWindowDetailColumn(hospital, {
    x: -0.75,
    startY: 6.35,
    count: 4,
    spacing: 2.0,
    windowSize: [1.0, 1.0, 0.16],
    z: -4.06,
    backingMaterial: materials.accent,
    trimMaterial: materials.trimDark,
    sillMaterial: materials.accent
  });

  hospital.add(createCylinder(1.72, 1.72, 0.12, 22, [-1.72, 16.26, -1.7], materials.pad));
  hospital.add(createCylinder(1.46, 1.46, 0.05, 22, [-1.72, 16.35, -1.7], materials.glassDark));
  hospital.add(createCylinder(1.32, 1.32, 0.03, 22, [-1.72, 16.41, -1.7], materials.pad));

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
