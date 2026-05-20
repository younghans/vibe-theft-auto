import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
globalThis.self = globalThis.self ?? globalThis;
globalThis.ProgressEvent = globalThis.ProgressEvent ?? class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.lengthComputable = Boolean(init.lengthComputable);
    this.loaded = Number(init.loaded ?? 0);
    this.total = Number(init.total ?? 0);
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputPath = path.join(projectRoot, 'assets', 'vibe_theft_auto_custom', 'models', 'police-station-building.glb');
const carPoliceGltfPath = path.join(
  projectRoot,
  'assets',
  'KayKit_City_Builder_Bits_1.0_FREE',
  'Assets',
  'gltf',
  'car_police.gltf'
);

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
  P: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10000',
    '10000',
    '10000'
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
  T: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100'
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

function createMaterial(color, roughness = 0.92, metalness = 0.05, name = '') {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true
  });
  material.name = name;
  return material;
}

function createGlassMaterial(color, opacity = 0.48, name = '') {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    metalness: 0.04,
    transmission: 0.28,
    thickness: 0.12,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.62
  });
  material.name = name;
  return material;
}

function createMesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createBox(size, position, material, rotation = [0, 0, 0], name = '') {
  return createMesh(new THREE.BoxGeometry(...size), material, position, rotation, name);
}

function addBoxes(group, specs) {
  for (const { size, position, material, rotation, name } of specs) {
    group.add(createBox(size, position, material, rotation, name));
  }
}

function addPixelText(group, text, {
  centerX,
  y,
  z,
  pixelSize,
  depth,
  material,
  namePrefix
}) {
  const chars = [...String(text).toUpperCase()];
  const charAdvance = pixelSize * 6;
  const totalWidth = Math.max(0, (chars.length * charAdvance) - pixelSize);
  let cursorX = centerX - (totalWidth * 0.5);

  for (const [charIndex, char] of chars.entries()) {
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
          material,
          [0, 0, 0],
          `${namePrefix}_${charIndex}_${row}_${col}`
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
    material: options.shadowMaterial,
    namePrefix: `${options.namePrefix}_shadow`
  });
  addPixelText(group, text, options);
}

function addCarSidePixelText(group, text, {
  x,
  centerZ,
  y,
  pixelSize,
  depth,
  material,
  namePrefix,
  mirrorZ = false
}) {
  const chars = [...String(text).toUpperCase()];
  const charAdvance = pixelSize * 6;
  const totalWidth = Math.max(0, (chars.length * charAdvance) - pixelSize);
  const originZ = centerZ - (totalWidth * 0.5);

  for (const [charIndex, char] of chars.entries()) {
    const bitmap = FONT[char] ?? FONT[' '];
    for (let row = 0; row < bitmap.length; row += 1) {
      for (let col = 0; col < bitmap[row].length; col += 1) {
        if (bitmap[row][col] !== '1') {
          continue;
        }

        group.add(createBox(
          [depth, pixelSize, pixelSize],
          [
            x,
            y + (((bitmap.length - 1) * 0.5 - row) * pixelSize),
            originZ + (
              mirrorZ
                ? totalWidth - ((charIndex * charAdvance) + (col * pixelSize) + (pixelSize * 0.5))
                : (charIndex * charAdvance) + (col * pixelSize) + (pixelSize * 0.5)
            )
          ],
          material,
          [0, 0, 0],
          `${namePrefix}_${charIndex}_${row}_${col}`
        ));
      }
    }
  }
}

function addFrontWindow(group, {
  x,
  y,
  z,
  width = 1.22,
  height = 0.88,
  glassMaterial,
  frameMaterial
}) {
  group.add(createBox([width, height, 0.12], [x, y, z], glassMaterial, [0, 0, 0], 'policeStationFrontWindowGlass'));
  group.add(createBox([width + 0.28, 0.1, 0.2], [x, y + (height * 0.58), z + 0.06], frameMaterial));
  group.add(createBox([width + 0.28, 0.1, 0.2], [x, y - (height * 0.58), z + 0.06], frameMaterial));
  group.add(createBox([0.1, height + 0.24, 0.18], [x - (width * 0.56), y, z + 0.05], frameMaterial));
  group.add(createBox([0.1, height + 0.24, 0.18], [x + (width * 0.56), y, z + 0.05], frameMaterial));
}

function addSideWindowColumn(group, {
  x,
  z,
  yValues,
  glassMaterial,
  frameMaterial
}) {
  const outward = x < 0 ? -1 : 1;
  for (const y of yValues) {
    group.add(createBox([0.12, 0.84, 1.04], [x, y, z], glassMaterial));
    group.add(createBox([0.18, 0.1, 1.24], [x + (outward * 0.05), y + 0.5, z], frameMaterial));
    group.add(createBox([0.18, 0.1, 1.24], [x + (outward * 0.05), y - 0.5, z], frameMaterial));
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

function createPoliceMaterials() {
  return {
    slab: createMaterial(0x3b4248, 0.86, 0.06),
    sidewalk: createMaterial(0xb9c1c6, 0.9, 0.02),
    asphalt: createMaterial(0x252b31, 0.94, 0.02),
    facade: createMaterial(0xbfc8cf, 0.86, 0.04),
    facadeDark: createMaterial(0x73808a, 0.78, 0.08),
    trim: createMaterial(0xe7edf1, 0.72, 0.12),
    trimDark: createMaterial(0x2b3540, 0.62, 0.24),
    blue: createMaterial(0x234d7a, 0.62, 0.18),
    blueDeep: createMaterial(0x122842, 0.64, 0.24),
    sign: createMaterial(0x172332, 0.52, 0.28),
    signFace: createMaterial(0xf4f7fb, 0.34, 0.12),
    signShadow: createMaterial(0x06090d, 0.6, 0.12),
    glass: createGlassMaterial(0x2f86d8, 0.62, 'policeStationBlueWindowGlass'),
    glassLite: createGlassMaterial(0x5bb8ff, 0.58, 'policeStationBrightBlueWindowGlass'),
    garageDoor: createMaterial(0x56636e, 0.58, 0.25),
    garageDoorDark: createMaterial(0x202832, 0.7, 0.2),
    redLight: createMaterial(0xd63843, 0.34, 0.2),
    blueLight: createMaterial(0x2d67d8, 0.34, 0.2),
    carBody: createMaterial(0xf3f4f0, 0.58, 0.12, 'policeStationRoofCarWhitePaint'),
    carBlue: createMaterial(0x164fa3, 0.52, 0.18, 'policeStationRoofCarBluePaint'),
    carBlack: createMaterial(0x15181d, 0.76, 0.18, 'policeStationRoofCarBlackPaint'),
    carLetter: createMaterial(0xf6fbff, 0.42, 0.08, 'policeStationRoofCarLetterPaint'),
    carWheel: createMaterial(0x15181d, 0.76, 0.18, 'policeStationRoofCarWheelPaint')
  };
}

async function loadCarPoliceProp(materials) {
  const source = JSON.parse(await fs.readFile(carPoliceGltfPath, 'utf8'));
  const sourceDirectory = path.dirname(carPoliceGltfPath);

  for (const material of source.materials ?? []) {
    material.pbrMetallicRoughness = {
      ...(material.pbrMetallicRoughness ?? {}),
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0.05,
      roughnessFactor: 0.58
    };
    delete material.pbrMetallicRoughness.baseColorTexture;
  }
  delete source.images;
  delete source.textures;
  delete source.samplers;

  for (const buffer of source.buffers ?? []) {
    if (!buffer.uri || buffer.uri.startsWith('data:')) {
      continue;
    }
    const bytes = await fs.readFile(path.join(sourceDirectory, buffer.uri));
    buffer.uri = `data:application/octet-stream;base64,${bytes.toString('base64')}`;
  }

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(JSON.stringify(source), '');
  const car = (gltf.scene.getObjectByName('car_police') ?? gltf.scene).clone(true);
  car.name = 'car_police';
  car.traverse((node) => {
    if (!node.isMesh) {
      return;
    }
    node.material = String(node.name ?? '').toLowerCase().includes('wheel')
      ? materials.carWheel
      : materials.carBody;
    node.castShadow = true;
    node.receiveShadow = true;
  });

  const wrapper = new THREE.Group();
  wrapper.name = 'policeStationRoofCarProp';
  wrapper.add(car);

  const originalBounds = new THREE.Box3().setFromObject(car);
  const originalSize = new THREE.Vector3();
  originalBounds.getSize(originalSize);
  const targetLength = 4.8;
  const scale = targetLength / Math.max(originalSize.x, originalSize.z, 0.001);
  car.scale.setScalar(scale);
  car.updateWorldMatrix(true, true);

  const scaledBounds = new THREE.Box3().setFromObject(car);
  const scaledCenter = new THREE.Vector3();
  scaledBounds.getCenter(scaledCenter);
  car.position.x -= scaledCenter.x;
  car.position.z -= scaledCenter.z;
  car.position.y -= scaledBounds.min.y;

  car.updateWorldMatrix(true, true);
  const normalizedBounds = new THREE.Box3().setFromObject(car);
  const normalizedSize = new THREE.Vector3();
  normalizedBounds.getSize(normalizedSize);
  const topY = normalizedBounds.max.y;
  const sidePanelX = (normalizedSize.x * 0.5) + 0.04;
  const sidePanelHeight = Math.max(0.28, topY * 0.28);
  const sidePanelY = Math.max(0.42, topY * 0.48);
  const sidePanelLength = Math.max(1.7, normalizedSize.z * 0.44);
  wrapper.add(createBox([0.08, sidePanelHeight, sidePanelLength], [-sidePanelX, sidePanelY, 0], materials.carBlue, [0, 0, 0], 'policeStationRoofCarBlueSideLeft'));
  wrapper.add(createBox([0.08, sidePanelHeight, sidePanelLength], [sidePanelX, sidePanelY, 0], materials.carBlue, [0, 0, 0], 'policeStationRoofCarBlueSideRight'));
  wrapper.add(createBox([normalizedSize.x * 0.68, 0.08, normalizedSize.z * 0.18], [0, Math.max(0.44, topY * 0.52), normalizedSize.z * 0.31], materials.carBlue, [0, 0, 0], 'policeStationRoofCarBlueHoodPanel'));
  wrapper.add(createBox([normalizedSize.x * 0.66, 0.08, normalizedSize.z * 0.16], [0, Math.max(0.42, topY * 0.48), -normalizedSize.z * 0.34], materials.carBlue, [0, 0, 0], 'policeStationRoofCarBlueTrunkPanel'));
  wrapper.add(createBox([normalizedSize.x * 0.52, 0.08, normalizedSize.z * 0.18], [0, Math.max(0.5, topY * 0.66), normalizedSize.z * 0.08], materials.carBlack, [0, 0, 0], 'policeStationRoofCarBlackWindshield'));
  wrapper.add(createBox([normalizedSize.x * 0.42, 0.08, 0.16], [0, Math.max(0.36, topY * 0.38), (normalizedSize.z * 0.5) + 0.05], materials.carBlack, [0, 0, 0], 'policeStationRoofCarPushBar'));
  wrapper.add(createBox([0.48, 0.16, 0.22], [-0.26, topY + 0.08, 0.08], materials.redLight, [0, 0, 0], 'policeStationRoofCarLightRed'));
  wrapper.add(createBox([0.48, 0.16, 0.22], [0.26, topY + 0.08, 0.08], materials.blueLight, [0, 0, 0], 'policeStationRoofCarLightBlue'));
  addCarSidePixelText(wrapper, 'POLICE', {
    x: -sidePanelX - 0.05,
    centerZ: 0,
    y: sidePanelY,
    pixelSize: Math.min(0.065, sidePanelHeight / 6.7),
    depth: 0.04,
    material: materials.carLetter,
    namePrefix: 'policeStationRoofCarPoliceLabelLeft'
  });
  addCarSidePixelText(wrapper, 'POLICE', {
    x: sidePanelX + 0.05,
    centerZ: 0,
    y: sidePanelY,
    pixelSize: Math.min(0.065, sidePanelHeight / 6.7),
    depth: 0.04,
    material: materials.carLetter,
    namePrefix: 'policeStationRoofCarPoliceLabelRight',
    mirrorZ: true
  });

  return wrapper;
}

async function buildPoliceStation() {
  const scene = new THREE.Scene();
  const station = new THREE.Group();
  station.name = 'police_station_building';
  const materials = createPoliceMaterials();

  addBoxes(station, [
    { name: 'policeStationSlab', size: [22.8, 0.58, 11.1], position: [0, 0.29, 0], material: materials.slab },
    { name: 'policeStationFrontSidewalk', size: [21.6, 0.14, 2.15], position: [0, 0.67, 4.55], material: materials.sidewalk },
    { name: 'policeStationGarageDriveway', size: [10.4, 0.16, 3.25], position: [-5.7, 0.71, 4.72], material: materials.asphalt },
    { name: 'policeStationMainFloor', size: [21.6, 0.18, 9.35], position: [0, 0.8, -0.22], material: materials.facadeDark },
    { name: 'policeStationBackWall', size: [21.8, 11.35, 0.42], position: [0, 6.42, -4.88], material: materials.facade },
    { name: 'policeStationLeftWall', size: [0.42, 11.35, 9.9], position: [-10.9, 6.42, 0], material: materials.facade },
    { name: 'policeStationRightWall', size: [0.42, 11.35, 9.9], position: [10.9, 6.42, 0], material: materials.facade },
    { name: 'policeStationFrontUpperWall', size: [21.8, 5.75, 0.42], position: [0, 9.0, 4.88], material: materials.facade },
    { name: 'policeStationFrontRightGroundWall', size: [10.6, 4.85, 0.42], position: [5.45, 3.28, 4.88], material: materials.facade },
    { name: 'policeStationGarageLeftPier', size: [0.72, 5.45, 0.58], position: [-10.16, 3.56, 4.96], material: materials.facadeDark },
    { name: 'policeStationGarageCenterPier', size: [0.72, 5.45, 0.58], position: [-0.92, 3.56, 4.96], material: materials.facadeDark },
    { name: 'policeStationGarageHeader', size: [9.6, 0.84, 0.58], position: [-5.54, 6.08, 4.96], material: materials.facadeDark },
    { name: 'policeStationGarageInteriorShadow', size: [8.95, 4.55, 0.18], position: [-5.54, 3.22, 4.7], material: materials.garageDoorDark },
    { name: 'policeStationRoofDeck', size: [22.0, 0.46, 9.85], position: [0, 12.18, 0], material: materials.trimDark },
    { name: 'policeStationRoofCap', size: [20.9, 0.24, 8.85], position: [0, 12.54, 0], material: materials.facadeDark },
    { name: 'policeStationBlueBandGround', size: [21.9, 0.28, 0.24], position: [0, 5.82, 5.14], material: materials.blue },
    { name: 'policeStationBlueBandSecond', size: [21.9, 0.24, 0.24], position: [0, 8.02, 5.14], material: materials.blueDeep },
    { name: 'policeStationBlueBandThird', size: [21.9, 0.24, 0.24], position: [0, 10.4, 5.14], material: materials.blue },
    { name: 'policeStationSignPanel', size: [10.05, 4.1, 0.36], position: [5.45, 3.35, 5.21], material: materials.sign },
    { name: 'policeStationSignTopTrim', size: [10.35, 0.2, 0.44], position: [5.45, 5.5, 5.25], material: materials.trim },
    { name: 'policeStationSignBottomTrim', size: [10.35, 0.2, 0.44], position: [5.45, 1.2, 5.25], material: materials.trim },
    { name: 'policeStationSignDivider', size: [8.85, 0.08, 0.22], position: [5.45, 3.34, 5.42], material: materials.blue }
  ]);

  const garageDoor = new THREE.Group();
  garageDoor.name = 'police_station_garage_door_closed';
  garageDoor.add(createBox(
    [8.85, 4.45, 0.28],
    [-5.54, 3.22, 5.08],
    materials.garageDoor,
    [0, 0, 0],
    'policeStationGarageDoorPanel'
  ));
  for (let index = 0; index < 6; index += 1) {
    garageDoor.add(createBox(
      [8.55, 0.08, 0.12],
      [-5.54, 1.36 + (index * 0.64), 5.25],
      materials.garageDoorDark,
      [0, 0, 0],
      `policeStationGarageDoorSlat${index + 1}`
    ));
  }
  station.add(garageDoor);

  addSignText(station, 'POLICE', {
    centerX: 5.45,
    y: 4.34,
    z: 5.48,
    pixelSize: 0.25,
    depth: 0.18,
    material: materials.signFace,
    shadowMaterial: materials.signShadow,
    namePrefix: 'policeStationSignPolice'
  });
  addSignText(station, 'STATION', {
    centerX: 5.45,
    y: 2.36,
    z: 5.48,
    pixelSize: 0.205,
    depth: 0.18,
    material: materials.signFace,
    shadowMaterial: materials.signShadow,
    namePrefix: 'policeStationSignStation'
  });

  for (const y of [6.9, 9.25]) {
    for (const x of [-9, -6.75, -4.5, -2.25, 0, 2.25, 4.5, 6.75, 9]) {
      addFrontWindow(station, {
        x,
        y,
        z: 5.12,
        glassMaterial: y > 8 ? materials.glassLite : materials.glass,
        frameMaterial: materials.trimDark
      });
    }
  }

  for (const [x, z] of [
    [-10.92, -3.15],
    [-10.92, -1.25],
    [-10.92, 0.65],
    [10.92, -3.15],
    [10.92, -1.25],
    [10.92, 0.65]
  ]) {
    addSideWindowColumn(station, {
      x,
      z,
      yValues: [3.6, 6.9, 9.25],
      glassMaterial: materials.glass,
      frameMaterial: materials.trimDark
    });
  }

  addParapetRect(station, {
    centerX: 0,
    centerY: 12.92,
    centerZ: 0,
    width: 21.9,
    depth: 9.8,
    parapetHeight: 0.54,
    thickness: 0.32,
    material: materials.trimDark
  });

  addBoxes(station, [
    { name: 'policeStationRooftopUnitLeft', size: [2.4, 0.9, 1.55], position: [4.4, 13.08, -2.55], material: materials.facadeDark },
    { name: 'policeStationRooftopUnitRight', size: [1.8, 0.78, 1.35], position: [7.1, 13.0, 1.15], material: materials.trimDark },
    { name: 'policeStationFlagPole', size: [0.16, 2.4, 0.16], position: [9.4, 14.05, 3.4], material: materials.trimDark },
    { name: 'policeStationBlueFlag', size: [1.25, 0.7, 0.08], position: [8.75, 14.7, 3.4], material: materials.blue }
  ]);

  const roofCar = await loadCarPoliceProp(materials);
  roofCar.position.set(-5.54, 13.04, 3.1);
  roofCar.rotation.y = Math.PI / 2;
  station.add(roofCar);

  scene.add(station);
  return scene;
}

async function main() {
  const exporter = new GLTFExporter();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const scene = await buildPoliceStation();
  const arrayBuffer = await exporter.parseAsync(scene, { binary: true });
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}

await main();
