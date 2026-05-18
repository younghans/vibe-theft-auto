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
const outputDirectory = path.join(projectRoot, 'assets', 'vibe_theft_auto_custom', 'models');

const FONT = Object.freeze({
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
  I: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111'
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
  O: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110'
  ],
  P: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10000',
    '10000',
    '10000'
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

function createMaterial(color, roughness = 0.92, metalness = 0.03) {
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

function createCabinGeometry() {
  const vertices = new Float32Array([
    -1.82, 0.00, -2.05,
     1.82, 0.00, -2.05,
     1.82, 0.00,  2.02,
    -1.82, 0.00,  2.02,
    -1.22, 1.62, -1.42,
     1.22, 1.62, -1.42,
     1.22, 1.62,  1.06,
    -1.22, 1.62,  1.06
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addPixelWordOnSide(group, text, {
  sideX,
  centerZ,
  centerY,
  pixelSize,
  depth,
  material
}) {
  const chars = [...String(text).toUpperCase()];
  const charAdvance = pixelSize * 6;
  const totalWidth = Math.max(0, (chars.length * charAdvance) - pixelSize);
  let cursorZ = centerZ - (totalWidth * 0.5);
  const outward = Math.sign(sideX) || 1;

  for (const char of chars) {
    const bitmap = FONT[char] ?? FONT[' '];
    for (let row = 0; row < bitmap.length; row += 1) {
      for (let col = 0; col < bitmap[row].length; col += 1) {
        if (bitmap[row][col] !== '1') {
          continue;
        }

        group.add(createBox(
          [depth, pixelSize, pixelSize],
          [
            sideX + (outward * depth * 0.5),
            centerY + (((bitmap.length - 1) * 0.5 - row) * pixelSize),
            cursorZ + (col * pixelSize) + (pixelSize * 0.5)
          ],
          material
        ));
      }
    }
    cursorZ += charAdvance;
  }
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
    for (const attributeName of Object.keys(geometry.attributes)) {
      if (attributeName !== 'position' && attributeName !== 'normal') {
        geometry.deleteAttribute(attributeName);
      }
    }
    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    }
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

function buildPoliceVehicle() {
  const scene = new THREE.Scene();
  scene.name = 'original_low_poly_police_vehicle_scene';
  scene.userData = {
    title: 'Original Low-Poly Police Vehicle',
    source: 'Procedurally generated for this repository; no third-party mesh data used.'
  };

  const vehicle = new THREE.Group();
  vehicle.name = 'original_low_poly_police_vehicle';

  const materials = {
    white: createMaterial(0xf2f0e8),
    whitePanel: createMaterial(0xfffbef),
    black: createMaterial(0x121518),
    charcoal: createMaterial(0x2c3035),
    glass: createMaterial(0x4f7584, 0.48, 0.02),
    glassDark: createMaterial(0x273945, 0.5, 0.02),
    tire: createMaterial(0x101112, 0.88, 0.02),
    rim: createMaterial(0xb4b9b8, 0.72, 0.08),
    bumper: createMaterial(0x24272a, 0.82, 0.06),
    blue: createMaterial(0x1f67d8, 0.62, 0.02),
    red: createMaterial(0xc63232, 0.62, 0.02),
    amber: createMaterial(0xf0c45f, 0.52, 0.02)
  };

  vehicle.add(createBox([4.7, 0.58, 8.85], [0, 0.72, 0], materials.black));
  vehicle.add(createBox([4.35, 1.02, 8.55], [0, 1.26, 0], materials.white));
  vehicle.add(createBox([4.5, 0.28, 8.72], [0, 1.05, 0], materials.charcoal));
  vehicle.add(createBox([4.1, 0.5, 2.65], [0, 1.76, 3.08], materials.whitePanel));
  vehicle.add(createBox([4.1, 0.48, 2.25], [0, 1.75, -3.16], materials.whitePanel));
  vehicle.add(createBox([4.66, 0.42, 0.46], [0, 1.02, 4.64], materials.bumper));
  vehicle.add(createBox([4.66, 0.42, 0.46], [0, 1.02, -4.64], materials.bumper));

  const cabin = createMesh(createCabinGeometry(), materials.white, [0, 1.58, -0.05]);
  cabin.name = 'low_poly_police_vehicle_cabin';
  vehicle.add(cabin);

  vehicle.add(createBox([2.64, 0.72, 0.08], [0, 2.44, 1.5], materials.glassDark, [-0.44, 0, 0]));
  vehicle.add(createBox([2.62, 0.68, 0.08], [0, 2.37, -1.88], materials.glassDark, [0.34, 0, 0]));
  for (const sideX of [-1.86, 1.86]) {
    vehicle.add(createBox([0.08, 0.8, 1.14], [sideX, 2.42, 0.8], materials.glass));
    vehicle.add(createBox([0.08, 0.8, 1.05], [sideX, 2.38, -0.68], materials.glass));
    vehicle.add(createBox([0.1, 0.9, 2.85], [sideX * 1.02, 1.58, 0], materials.whitePanel));
    vehicle.add(createBox([0.11, 0.22, 8.05], [sideX * 1.03, 1.18, 0], materials.black));
    addPixelWordOnSide(vehicle, 'POLICE', {
      sideX: sideX * 1.04,
      centerZ: 0.05,
      centerY: 1.67,
      pixelSize: 0.105,
      depth: 0.065,
      material: materials.black
    });
  }

  vehicle.add(createBox([2.0, 0.16, 0.58], [0, 3.32, 0.02], materials.black));
  vehicle.add(createBox([0.88, 0.32, 0.52], [-0.5, 3.54, 0.02], materials.red));
  vehicle.add(createBox([0.88, 0.32, 0.52], [0.5, 3.54, 0.02], materials.blue));
  vehicle.add(createBox([0.32, 0.12, 0.56], [0, 3.58, 0.02], materials.whitePanel));

  for (const x of [-1.35, 1.35]) {
    vehicle.add(createBox([0.78, 0.24, 0.1], [x, 1.26, 4.91], materials.amber));
    vehicle.add(createBox([0.72, 0.24, 0.1], [x, 1.24, -4.91], materials.red));
  }

  vehicle.add(createBox([2.9, 0.12, 0.16], [0, 1.48, 5.0], materials.black));
  vehicle.add(createBox([0.14, 0.86, 0.16], [-1.55, 1.22, 5.02], materials.black));
  vehicle.add(createBox([0.14, 0.86, 0.16], [1.55, 1.22, 5.02], materials.black));

  for (const x of [-2.42, 2.42]) {
    for (const z of [-2.9, 2.9]) {
      vehicle.add(createCylinder(0.66, 0.66, 0.46, 12, [x, 0.66, z], materials.tire, [0, 0, Math.PI * 0.5]));
      vehicle.add(createCylinder(0.34, 0.34, 0.5, 10, [x + (Math.sign(x) * 0.02), 0.66, z], materials.rim, [0, 0, Math.PI * 0.5]));
    }
  }

  vehicle.add(createBox([4.25, 0.12, 0.12], [0, 2.04, 2.02], materials.black));
  vehicle.add(createBox([4.25, 0.12, 0.12], [0, 2.02, -2.08], materials.black));
  vehicle.add(createBox([0.12, 0.8, 4.22], [-2.22, 1.72, 0], materials.black));
  vehicle.add(createBox([0.12, 0.8, 4.22], [2.22, 1.72, 0], materials.black));

  mergeMeshesByMaterial(vehicle);
  scene.add(vehicle);
  return scene;
}

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  const exporter = new GLTFExporter();
  const scene = buildPoliceVehicle();
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  const outputPath = path.join(outputDirectory, 'original-low-poly-police-vehicle.glb');
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

await main();
