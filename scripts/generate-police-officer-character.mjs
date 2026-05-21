import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
globalThis.self = globalThis;
globalThis.window = globalThis.window ?? {
  URL: {
    createObjectURL() {
      return 'blob:mock';
    },
    revokeObjectURL() {}
  }
};
globalThis.document = globalThis.document ?? {
  createElementNS() {
    return {
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
      style: {},
      src: '',
      width: 0,
      height: 0
    };
  }
};
globalThis.Image = globalThis.Image ?? class {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const rigPath = path.join(projectRoot, 'assets', 'runtime', 'mixamo', 'characters', 'xBot.glb');
const characterOutputPath = path.join(projectRoot, 'assets', 'runtime', 'mixamo', 'characters', 'policeOfficer.glb');
const portraitOutputPath = path.join(projectRoot, 'assets', 'mixamo', 'portraits', 'police_officer.png');

const COLORS = Object.freeze({
  uniform: 0x1e416d,
  uniformLight: 0x2f6ea8,
  uniformDark: 0x132640,
  pants: 0x183658,
  black: 0x11141a,
  boot: 0x151414,
  belt: 0x181d22,
  beltPouch: 0x252a30,
  gold: 0xffcf57,
  skin: 0xd99a6c,
  skinLight: 0xf0b58a,
  cheek: 0xe97875,
  hair: 0x3b2518,
  white: 0xf7f4e9,
  eye: 0x15120f,
  radio: 0x2d333b,
  glass: 0x78d4ff
});

const FONT = Object.freeze({
  C: [
    '0111',
    '1000',
    '1000',
    '1000',
    '0111'
  ],
  E: [
    '1111',
    '1000',
    '1110',
    '1000',
    '1111'
  ],
  I: [
    '111',
    '010',
    '010',
    '010',
    '111'
  ],
  L: [
    '1000',
    '1000',
    '1000',
    '1000',
    '1111'
  ],
  O: [
    '0110',
    '1001',
    '1001',
    '1001',
    '0110'
  ],
  P: [
    '1110',
    '1001',
    '1110',
    '1000',
    '1000'
  ]
});

const LOCAL_OFFSET = new THREE.Vector3();
const LOCAL_ROTATION = new THREE.Euler();
const LOCAL_QUATERNION = new THREE.Quaternion();
const LOCAL_MATRIX = new THREE.Matrix4();
const BONE_SPACE_MATRIX = new THREE.Matrix4();
const LOCAL_SCALE = new THREE.Vector3(1, 1, 1);
const PART_SCALE = new THREE.Vector3(1, 1, 1);
const PRIMITIVE_UP = new THREE.Vector3(0, 1, 0);
const REFERENCE_LIMB_BIND_OFFSET = new THREE.Vector3(0, 0.828, 0);

const REFERENCE_LIMB_BONES = Object.freeze({
  sleeves: /(?:Shoulder|Arm)/,
  hands: /mixamorig(?:Right|Left)Hand$/,
  pants: /(?:Hips|UpLeg|mixamorig(?:Right|Left)Leg$)/,
  boots: /(?:Foot|Toe)/
});

function getArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function createMaterial(name, color, roughness = 0.78, metalness = 0.02) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true
  });
  material.name = name;
  return material;
}

function assignRigidSkinning(geometry, boneIndex) {
  const positionCount = geometry.attributes.position.count;
  const skinIndices = new Uint16Array(positionCount * 4);
  const skinWeights = new Float32Array(positionCount * 4);

  for (let index = 0; index < positionCount; index += 1) {
    skinIndices[index * 4] = boneIndex;
    skinWeights[index * 4] = 1;
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  return geometry;
}

function finalizePartGeometry(geometry, bone, boneIndex, {
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = PART_SCALE
} = {}) {
  LOCAL_OFFSET.fromArray(position);
  LOCAL_ROTATION.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0);
  LOCAL_QUATERNION.setFromEuler(LOCAL_ROTATION);
  LOCAL_MATRIX.compose(
    LOCAL_OFFSET,
    LOCAL_QUATERNION,
    Array.isArray(scale) ? LOCAL_SCALE.fromArray(scale) : scale
  );
  BONE_SPACE_MATRIX.multiplyMatrices(bone.matrixWorld, LOCAL_MATRIX);
  geometry.applyMatrix4(BONE_SPACE_MATRIX);
  assignRigidSkinning(geometry, boneIndex);
  return geometry;
}

function createRigidBox(bone, boneIndex, size, options = {}) {
  return finalizePartGeometry(
    new THREE.BoxGeometry(size[0], size[1], size[2], 1, 1, 1).toNonIndexed(),
    bone,
    boneIndex,
    options
  );
}

function createRigidCylinder(bone, boneIndex, radiusTop, radiusBottom, height, radialSegments, options = {}) {
  return finalizePartGeometry(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false).toNonIndexed(),
    bone,
    boneIndex,
    options
  );
}

function createRigidSphere(bone, boneIndex, radius, widthSegments, heightSegments, options = {}) {
  return finalizePartGeometry(
    new THREE.SphereGeometry(radius, widthSegments, heightSegments).toNonIndexed(),
    bone,
    boneIndex,
    options
  );
}

function createRigidCapsule(bone, boneIndex, radius, length, capSegments, radialSegments, options = {}) {
  return finalizePartGeometry(
    new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments).toNonIndexed(),
    bone,
    boneIndex,
    options
  );
}

function createRigidCone(bone, boneIndex, radius, height, radialSegments, options = {}) {
  return finalizePartGeometry(
    new THREE.ConeGeometry(radius, height, radialSegments, 1, false).toNonIndexed(),
    bone,
    boneIndex,
    options
  );
}

function createRigidSegment(bone, childBone, boneIndex, width, depth, options = {}) {
  const segmentVector = childBone.position.clone();
  const segmentLength = Math.max(0.001, segmentVector.length());
  const geometry = new THREE.CapsuleGeometry(Math.max(width, depth) * 0.5, segmentLength, 2, 8).toNonIndexed();
  const segmentDirection = LOCAL_OFFSET.copy(segmentVector).normalize();
  const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(PRIMITIVE_UP, segmentDirection);
  const midpoint = segmentVector.multiplyScalar(0.5);

  geometry.applyQuaternion(rotationQuaternion);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);

  return finalizePartGeometry(geometry, bone, boneIndex, {
    position: options.offset ?? [0, 0, 0],
    rotation: options.rotation ?? [0, 0, 0],
    scale: options.scale ?? [width / Math.max(width, depth), 1, depth / Math.max(width, depth)]
  });
}

function getAttributeComponent(attribute, vertexIndex, componentIndex) {
  switch (componentIndex) {
    case 0:
      return attribute.getX(vertexIndex);
    case 1:
      return attribute.getY(vertexIndex);
    case 2:
      return attribute.getZ(vertexIndex);
    case 3:
      return attribute.getW(vertexIndex);
    default:
      return 0;
  }
}

function getDominantBoneName(skinIndex, skinWeight, boneNames, vertexIndex) {
  let dominantBoneIndex = skinIndex.getX(vertexIndex);
  let dominantWeight = skinWeight.getX(vertexIndex);

  for (let componentIndex = 1; componentIndex < 4; componentIndex += 1) {
    const weight = getAttributeComponent(skinWeight, vertexIndex, componentIndex);
    if (weight > dominantWeight) {
      dominantWeight = weight;
      dominantBoneIndex = getAttributeComponent(skinIndex, vertexIndex, componentIndex);
    }
  }

  return boneNames[dominantBoneIndex] ?? '';
}

function createReferenceLimbGeometry(sourceMesh, boneMatcher, {
  bindOffset = REFERENCE_LIMB_BIND_OFFSET,
  inflate = 0.018,
  widenX = 1.06,
  deepenZ = 1.04
} = {}) {
  const sourceGeometry = sourceMesh.geometry;
  const sourceIndex = sourceGeometry.index;
  const position = sourceGeometry.getAttribute('position');
  const normal = sourceGeometry.getAttribute('normal');
  const skinIndex = sourceGeometry.getAttribute('skinIndex');
  const skinWeight = sourceGeometry.getAttribute('skinWeight');

  if (!sourceIndex || !position || !skinIndex || !skinWeight) {
    return null;
  }

  const boneNames = sourceMesh.skeleton.bones.map((bone) => bone?.name ?? '');
  const positions = [];
  const normals = [];
  const skinIndices = [];
  const skinWeights = [];
  const indices = [];
  const indexBySourceVertex = new Map();

  const addSourceVertex = (vertexIndex) => {
    const existingIndex = indexBySourceVertex.get(vertexIndex);
    if (existingIndex !== undefined) {
      return existingIndex;
    }

    const nx = normal ? normal.getX(vertexIndex) : 0;
    const ny = normal ? normal.getY(vertexIndex) : 0;
    const nz = normal ? normal.getZ(vertexIndex) : 0;
    const sourceX = position.getX(vertexIndex);
    const sourceZ = position.getZ(vertexIndex);
    const nextIndex = positions.length / 3;

    positions.push(
      (sourceX * widenX) + bindOffset.x + (nx * inflate),
      position.getY(vertexIndex) + bindOffset.y + (ny * inflate),
      (sourceZ * deepenZ) + bindOffset.z + (nz * inflate)
    );
    normals.push(nx, ny, nz);
    skinIndices.push(
      skinIndex.getX(vertexIndex),
      skinIndex.getY(vertexIndex),
      skinIndex.getZ(vertexIndex),
      skinIndex.getW(vertexIndex)
    );
    skinWeights.push(
      skinWeight.getX(vertexIndex),
      skinWeight.getY(vertexIndex),
      skinWeight.getZ(vertexIndex),
      skinWeight.getW(vertexIndex)
    );
    indexBySourceVertex.set(vertexIndex, nextIndex);
    return nextIndex;
  };

  for (let triangleIndex = 0; triangleIndex < sourceIndex.count; triangleIndex += 3) {
    const vertexIndices = [
      sourceIndex.getX(triangleIndex),
      sourceIndex.getX(triangleIndex + 1),
      sourceIndex.getX(triangleIndex + 2)
    ];
    const usesTargetBone = vertexIndices.some((vertexIndex) => (
      boneMatcher.test(getDominantBoneName(skinIndex, skinWeight, boneNames, vertexIndex))
    ));

    if (!usesTargetBone) {
      continue;
    }

    for (const vertexIndex of vertexIndices) {
      indices.push(addSourceVertex(vertexIndex));
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  return geometry;
}

function createMergedSkinnedMesh(geometries, material, name, skeleton, bindMatrix) {
  const mergedGeometry = geometries.length === 1
    ? geometries[0]
    : mergeGeometries(geometries, false);

  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();
  mergedGeometry.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, bindMatrix);
  return mesh;
}

function createPixelTextPieces(text, bone, boneIndex, {
  center = [0, 0, 0],
  pixelSize = 0.018,
  depth = 0.01
} = {}) {
  const letters = String(text).toUpperCase().split('');
  const geometries = [];
  const charWidths = letters.map((letter) => FONT[letter]?.[0]?.length ?? 3);
  const totalColumns = charWidths.reduce((sum, width) => sum + width + 1, -1);
  let cursor = -totalColumns * pixelSize * 0.5;

  for (let letterIndex = 0; letterIndex < letters.length; letterIndex += 1) {
    const bitmap = FONT[letters[letterIndex]];
    if (!bitmap) {
      cursor += 4 * pixelSize;
      continue;
    }

    for (let row = 0; row < bitmap.length; row += 1) {
      for (let col = 0; col < bitmap[row].length; col += 1) {
        if (bitmap[row][col] !== '1') {
          continue;
        }

        geometries.push(createRigidBox(bone, boneIndex, [pixelSize, pixelSize, depth], {
          position: [
            center[0] + cursor + (col * pixelSize) + (pixelSize * 0.5),
            center[1] + (((bitmap.length - 1) * 0.5 - row) * pixelSize),
            center[2]
          ]
        }));
      }
    }

    cursor += (charWidths[letterIndex] + 1) * pixelSize;
  }

  return geometries;
}

async function loadRig() {
  const bytes = await fs.readFile(rigPath);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(getArrayBuffer(bytes), path.dirname(rigPath) + path.sep);
  return gltf.scene;
}

function removeSourceMeshes(root) {
  const meshes = [];
  root.traverse((node) => {
    if (node?.isSkinnedMesh) {
      meshes.push(node);
    }
  });

  for (const mesh of meshes) {
    mesh.parent?.remove(mesh);
  }
}

function buildPoliceOfficerCharacter(root) {
  let sourceMesh = null;
  root.traverse((node) => {
    if (!sourceMesh && node?.isSkinnedMesh && node.skeleton) {
      sourceMesh = node;
    }
  });

  if (!sourceMesh?.skeleton) {
    throw new Error('The xBot rig did not expose a skinned mesh skeleton.');
  }

  root.name = 'policeOfficer_Root';
  root.userData = {
    title: 'Police Officer',
    appearance: 'Cartoony goofy police officer with oversized head, cap, badge, belt, and low-poly navy uniform.',
    source: 'Procedurally generated for Vibe Theft Auto from the existing xBot Mixamo-compatible runtime rig; no Sketchfab mesh data used.'
  };
  root.updateMatrixWorld(true);

  const skeleton = sourceMesh.skeleton;
  const bindMatrix = sourceMesh.bindMatrix.clone();
  const boneIndexByName = new Map();
  for (let index = 0; index < skeleton.bones.length; index += 1) {
    const bone = skeleton.bones[index];
    if (bone?.name) {
      boneIndexByName.set(bone.name, index);
    }
  }
  const getBoneIndex = (boneName) => boneIndexByName.get(boneName) ?? -1;
  const getBone = (boneName) => skeleton.getBoneByName(boneName);
  const requireBone = (boneName) => {
    const bone = getBone(boneName);
    if (!bone) {
      throw new Error(`Missing required Mixamo bone: ${boneName}`);
    }
    return bone;
  };

  const bones = {
    hips: requireBone('mixamorigHips'),
    spine: requireBone('mixamorigSpine'),
    spineMiddle: requireBone('mixamorigSpine1'),
    spineUpper: requireBone('mixamorigSpine2'),
    neck: requireBone('mixamorigNeck'),
    head: requireBone('mixamorigHead'),
    headTop: getBone('mixamorigHeadTop_End'),
    rightShoulder: requireBone('mixamorigRightShoulder'),
    leftShoulder: requireBone('mixamorigLeftShoulder'),
    rightArm: requireBone('mixamorigRightArm'),
    leftArm: requireBone('mixamorigLeftArm'),
    rightForeArm: requireBone('mixamorigRightForeArm'),
    leftForeArm: requireBone('mixamorigLeftForeArm'),
    rightHand: requireBone('mixamorigRightHand'),
    leftHand: requireBone('mixamorigLeftHand'),
    rightUpLeg: requireBone('mixamorigRightUpLeg'),
    leftUpLeg: requireBone('mixamorigLeftUpLeg'),
    rightLeg: requireBone('mixamorigRightLeg'),
    leftLeg: requireBone('mixamorigLeftLeg'),
    rightFoot: requireBone('mixamorigRightFoot'),
    leftFoot: requireBone('mixamorigLeftFoot'),
    rightToe: requireBone('mixamorigRightToeBase'),
    leftToe: requireBone('mixamorigLeftToeBase')
  };

  const materials = {
    skin: createMaterial('policeOfficerWarmSkin', COLORS.skin, 0.72, 0.01),
    skinLight: createMaterial('policeOfficerLightSkinHighlights', COLORS.skinLight, 0.74, 0.01),
    cheek: createMaterial('policeOfficerRosyCheeks', COLORS.cheek, 0.86, 0.01),
    uniform: createMaterial('policeOfficerNavyUniform', COLORS.uniform, 0.8, 0.02),
    uniformLight: createMaterial('policeOfficerLightBluePanels', COLORS.uniformLight, 0.78, 0.02),
    uniformDark: createMaterial('policeOfficerDarkUniformTrim', COLORS.uniformDark, 0.84, 0.02),
    uniformJoint: createMaterial('policeOfficerConnectedSleeves', COLORS.uniform, 0.82, 0.02),
    humanSleeves: createMaterial('policeOfficerGameRigSleeveUnderlay', COLORS.uniform, 0.8, 0.02),
    pants: createMaterial('policeOfficerNavyPants', COLORS.pants, 0.86, 0.02),
    pantsJoint: createMaterial('policeOfficerGroundedPantStructure', COLORS.pants, 0.86, 0.02),
    humanHands: createMaterial('policeOfficerGameRigHandUnderlay', COLORS.skinLight, 0.74, 0.01),
    humanPants: createMaterial('policeOfficerGameRigPantUnderlay', COLORS.pants, 0.86, 0.02),
    humanBoots: createMaterial('policeOfficerGameRigBootUnderlay', COLORS.boot, 0.82, 0.04),
    black: createMaterial('policeOfficerBlackDetails', COLORS.black, 0.7, 0.05),
    boot: createMaterial('policeOfficerChunkyBoots', COLORS.boot, 0.82, 0.04),
    belt: createMaterial('policeOfficerUtilityBelt', COLORS.belt, 0.64, 0.06),
    beltPouch: createMaterial('policeOfficerBeltPouches', COLORS.beltPouch, 0.72, 0.04),
    gold: createMaterial('policeOfficerGoldBadge', COLORS.gold, 0.46, 0.22),
    hair: createMaterial('policeOfficerMoustacheAndHair', COLORS.hair, 0.82, 0.02),
    white: createMaterial('policeOfficerWhiteDetails', COLORS.white, 0.76, 0.01),
    eye: createMaterial('policeOfficerGoofyEyes', COLORS.eye, 0.72, 0.02),
    radio: createMaterial('policeOfficerRadioGear', COLORS.radio, 0.68, 0.04),
    glass: createMaterial('policeOfficerRadioGlass', COLORS.glass, 0.52, 0.02)
  };

  const piecesByMaterial = new Map();
  for (const key of Object.keys(materials)) {
    piecesByMaterial.set(key, []);
  }
  const addPiece = (materialKey, geometry) => {
    if (geometry) {
      piecesByMaterial.get(materialKey)?.push(geometry);
    }
  };
  const addPieces = (materialKey, geometries) => {
    for (const geometry of geometries) {
      addPiece(materialKey, geometry);
    }
  };

  addPiece('humanSleeves', createReferenceLimbGeometry(sourceMesh, REFERENCE_LIMB_BONES.sleeves, {
    inflate: 0.024,
    widenX: 1.08,
    deepenZ: 1.08
  }));
  addPiece('humanHands', createReferenceLimbGeometry(sourceMesh, REFERENCE_LIMB_BONES.hands, {
    inflate: 0.014,
    widenX: 1.04,
    deepenZ: 1.02
  }));
  addPiece('humanPants', createReferenceLimbGeometry(sourceMesh, REFERENCE_LIMB_BONES.pants, {
    inflate: 0.03,
    widenX: 1.18,
    deepenZ: 1.1
  }));
  addPiece('humanBoots', createReferenceLimbGeometry(sourceMesh, REFERENCE_LIMB_BONES.boots, {
    inflate: 0.026,
    widenX: 1.2,
    deepenZ: 1.12
  }));

  addPiece('pants', createRigidCapsule(bones.hips, getBoneIndex('mixamorigHips'), 0.2, 0.24, 3, 10, {
    position: [0, 0.04, 0.01],
    scale: [1.42, 0.92, 0.9]
  }));
  addPiece('belt', createRigidCylinder(bones.hips, getBoneIndex('mixamorigHips'), 0.24, 0.25, 0.09, 14, {
    position: [0, 0.135, 0.012],
    scale: [1.15, 1, 0.72]
  }));
  addPiece('gold', createRigidBox(bones.hips, getBoneIndex('mixamorigHips'), [0.07, 0.055, 0.022], {
    position: [0, 0.13, 0.19]
  }));
  addPiece('beltPouch', createRigidBox(bones.hips, getBoneIndex('mixamorigHips'), [0.07, 0.085, 0.05], {
    position: [-0.19, 0.11, 0.1],
    rotation: [0, -0.3, 0]
  }));
  addPiece('beltPouch', createRigidBox(bones.hips, getBoneIndex('mixamorigHips'), [0.07, 0.085, 0.05], {
    position: [0.19, 0.11, 0.1],
    rotation: [0, 0.3, 0]
  }));
  addPiece('black', createRigidBox(bones.hips, getBoneIndex('mixamorigHips'), [0.045, 0.18, 0.045], {
    position: [0.24, 0.005, 0.08],
    rotation: [0.15, 0, -0.12]
  }));

  addPiece('uniform', createRigidCapsule(bones.spine, getBoneIndex('mixamorigSpine'), 0.18, 0.2, 3, 10, {
    position: [0, 0.055, 0.018],
    scale: [1.3, 1, 0.86]
  }));
  addPiece('uniform', createRigidCapsule(bones.spineMiddle, getBoneIndex('mixamorigSpine1'), 0.2, 0.22, 3, 10, {
    position: [0, 0.04, 0.02],
    scale: [1.34, 1, 0.86]
  }));
  addPiece('uniform', createRigidCapsule(bones.spineUpper, getBoneIndex('mixamorigSpine2'), 0.215, 0.18, 3, 10, {
    position: [0, 0.055, 0.018],
    scale: [1.42, 0.9, 0.86]
  }));
  addPiece('uniformLight', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.2, 0.22, 0.035], {
    position: [0, 0.06, 0.22]
  }));
  addPiece('uniformDark', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.04, 0.24, 0.04], {
    position: [0, 0.052, 0.245],
    rotation: [0, 0, 0.18]
  }));
  addPiece('gold', createRigidCylinder(bones.spineUpper, getBoneIndex('mixamorigSpine2'), 0.035, 0.045, 0.018, 5, {
    position: [-0.09, 0.115, 0.255],
    rotation: [Math.PI / 2, 0, Math.PI / 5],
    scale: [1.1, 1, 0.82]
  }));
  addPiece('white', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.095, 0.024, 0.014], {
    position: [0.1, 0.14, 0.255]
  }));
  addPieces('white', createPixelTextPieces('POLICE', bones.spineUpper, getBoneIndex('mixamorigSpine2'), {
    center: [0.005, -0.045, 0.26],
    pixelSize: 0.012,
    depth: 0.012
  }));
  addPiece('radio', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.055, 0.08, 0.035], {
    position: [0.19, 0.14, 0.18],
    rotation: [0, 0, -0.08]
  }));
  addPiece('black', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.014, 0.17, 0.014], {
    position: [0.165, 0.05, 0.25],
    rotation: [0.25, 0.06, -0.28]
  }));
  addPiece('glass', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.034, 0.018, 0.008], {
    position: [0.19, 0.15, 0.202]
  }));

  addPiece('skin', createRigidCapsule(bones.neck, getBoneIndex('mixamorigNeck'), 0.075, 0.05, 2, 8, {
    position: [0, 0.02, 0.01],
    scale: [1.05, 0.85, 0.95]
  }));
  addPiece('uniform', createRigidSphere(bones.rightShoulder, getBoneIndex('mixamorigRightShoulder'), 0.095, 8, 6, {
    position: [0, 0.045, 0],
    scale: [1.72, 1.22, 1.22]
  }));
  addPiece('uniform', createRigidSphere(bones.leftShoulder, getBoneIndex('mixamorigLeftShoulder'), 0.095, 8, 6, {
    position: [0, 0.045, 0],
    scale: [1.72, 1.22, 1.22]
  }));
  addPiece('uniformJoint', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.17, 0.18, 0.16], {
    position: [-0.31, 0.054, 0.002],
    rotation: [0, 0, -0.1]
  }));
  addPiece('uniformJoint', createRigidBox(bones.spineUpper, getBoneIndex('mixamorigSpine2'), [0.17, 0.18, 0.16], {
    position: [0.31, 0.054, 0.002],
    rotation: [0, 0, 0.1]
  }));
  addPiece('uniformJoint', createRigidSphere(bones.spineUpper, getBoneIndex('mixamorigSpine2'), 0.13, 8, 6, {
    position: [-0.29, 0.075, 0.006],
    scale: [1.05, 0.86, 0.9]
  }));
  addPiece('uniformJoint', createRigidSphere(bones.spineUpper, getBoneIndex('mixamorigSpine2'), 0.13, 8, 6, {
    position: [0.29, 0.075, 0.006],
    scale: [1.05, 0.86, 0.9]
  }));
  addPiece('uniformJoint', createRigidSegment(bones.rightShoulder, bones.rightArm, getBoneIndex('mixamorigRightShoulder'), 0.2, 0.16, {
    offset: [0, -0.004, 0.006],
    scale: [1.04, 1.2, 0.92]
  }));
  addPiece('uniformJoint', createRigidSegment(bones.leftShoulder, bones.leftArm, getBoneIndex('mixamorigLeftShoulder'), 0.2, 0.16, {
    offset: [0, -0.004, 0.006],
    scale: [1.04, 1.2, 0.92]
  }));
  addPiece('uniform', createRigidSegment(bones.rightArm, bones.rightForeArm, getBoneIndex('mixamorigRightArm'), 0.18, 0.145, {
    offset: [0, -0.015, 0.0],
    scale: [1.0, 1.0, 0.9]
  }));
  addPiece('uniform', createRigidSegment(bones.leftArm, bones.leftForeArm, getBoneIndex('mixamorigLeftArm'), 0.18, 0.145, {
    offset: [0, -0.015, 0.0],
    scale: [1.0, 1.0, 0.9]
  }));
  addPiece('uniformJoint', createRigidSphere(bones.rightForeArm, getBoneIndex('mixamorigRightForeArm'), 0.096, 8, 6, {
    position: [0, -0.012, 0.0],
    scale: [1.16, 0.92, 1.04]
  }));
  addPiece('uniformJoint', createRigidSphere(bones.leftForeArm, getBoneIndex('mixamorigLeftForeArm'), 0.096, 8, 6, {
    position: [0, -0.012, 0.0],
    scale: [1.16, 0.92, 1.04]
  }));
  addPiece('skin', createRigidSegment(bones.rightForeArm, bones.rightHand, getBoneIndex('mixamorigRightForeArm'), 0.14, 0.12, {
    offset: [0, -0.01, 0.0],
    scale: [0.94, 0.96, 0.84]
  }));
  addPiece('skin', createRigidSegment(bones.leftForeArm, bones.leftHand, getBoneIndex('mixamorigLeftForeArm'), 0.14, 0.12, {
    offset: [0, -0.01, 0.0],
    scale: [0.94, 0.96, 0.84]
  }));
  addPiece('skinLight', createRigidSphere(bones.rightHand, getBoneIndex('mixamorigRightHand'), 0.09, 8, 6, {
    position: [0, 0.035, 0.02],
    scale: [1.08, 0.86, 1.02]
  }));
  addPiece('skinLight', createRigidSphere(bones.leftHand, getBoneIndex('mixamorigLeftHand'), 0.09, 8, 6, {
    position: [0, 0.035, 0.02],
    scale: [1.08, 0.86, 1.02]
  }));
  addPiece('gold', createRigidCylinder(bones.rightShoulder, getBoneIndex('mixamorigRightShoulder'), 0.025, 0.025, 0.012, 5, {
    position: [0, 0.09, 0.085],
    rotation: [Math.PI / 2, 0, 0]
  }));
  addPiece('gold', createRigidCylinder(bones.leftShoulder, getBoneIndex('mixamorigLeftShoulder'), 0.025, 0.025, 0.012, 5, {
    position: [0, 0.09, 0.085],
    rotation: [Math.PI / 2, 0, 0]
  }));

  for (const side of ['right', 'left']) {
    const upLeg = bones[`${side}UpLeg`];
    const leg = bones[`${side}Leg`];
    const foot = bones[`${side}Foot`];
    const toe = bones[`${side}Toe`];
    const sign = side === 'right' ? -1 : 1;
    const localOutset = side === 'right' ? 0.026 : -0.026;
    const sideName = side === 'right' ? 'Right' : 'Left';
    addPiece('pantsJoint', createRigidSphere(upLeg, getBoneIndex(`mixamorig${sideName}UpLeg`), 0.15, 8, 6, {
      position: [localOutset * 0.75, 0.05, 0.008],
      scale: [1.28, 0.86, 1.02]
    }));
    addPiece('pantsJoint', createRigidSegment(bones.hips, upLeg, getBoneIndex('mixamorigHips'), 0.2, 0.165, {
      offset: [0, -0.006, 0.006],
      scale: [1.1, 1.12, 0.96]
    }));
    addPiece('pants', createRigidSphere(upLeg, getBoneIndex(`mixamorig${sideName}UpLeg`), 0.155, 8, 6, {
      position: [localOutset * 0.55, 0.026, 0.012],
      scale: [1.18, 0.98, 1.04]
    }));
    addPiece('pants', createRigidSegment(upLeg, leg, getBoneIndex(`mixamorig${sideName}UpLeg`), 0.215, 0.165, {
      offset: [localOutset, -0.02, 0.012],
      scale: [1.0, 1.0, 0.9]
    }));
    addPiece('pantsJoint', createRigidSphere(leg, getBoneIndex(`mixamorig${sideName}Leg`), 0.13, 8, 6, {
      position: [localOutset * 0.75, -0.006, 0.006],
      scale: [1.14, 0.9, 1.0]
    }));
    addPiece('pants', createRigidSegment(leg, foot, getBoneIndex(`mixamorig${sideName}Leg`), 0.18, 0.14, {
      offset: [localOutset * 0.75, -0.01, 0.0],
      scale: [0.98, 1.0, 0.88]
    }));
    addPiece('boot', createRigidSphere(foot, getBoneIndex(`mixamorig${sideName}Foot`), 0.108, 8, 6, {
      position: [localOutset * 0.5, 0.04, 0.045],
      scale: [1.48, 0.82, 1.5]
    }));
    addPiece('boot', createRigidSphere(toe, getBoneIndex(`mixamorig${sideName}ToeBase`), 0.108, 8, 6, {
      position: [localOutset * 0.5, 0.028, 0.05],
      scale: [1.5, 0.66, 1.66]
    }));
    addPiece('uniformDark', createRigidBox(leg, getBoneIndex(`mixamorig${sideName}Leg`), [0.024, 0.21, 0.02], {
      position: [sign * 0.045, 0.12, 0.082],
      rotation: [0.08, 0, 0]
    }));
  }

  addPiece('skin', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.175, 12, 8, {
    position: [0, 0.08, 0.055],
    scale: [1.0, 1.18, 0.88]
  }));
  addPiece('skinLight', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.075, 10, 6, {
    position: [0, 0.065, 0.205],
    scale: [0.72, 0.72, 1.0]
  }));
  addPiece('cheek', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.035, 8, 5, {
    position: [-0.092, 0.03, 0.205],
    scale: [1.2, 0.72, 0.34]
  }));
  addPiece('cheek', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.035, 8, 5, {
    position: [0.092, 0.03, 0.205],
    scale: [1.2, 0.72, 0.34]
  }));
  addPiece('white', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.035, 8, 5, {
    position: [-0.055, 0.125, 0.197],
    scale: [1.08, 0.9, 0.28]
  }));
  addPiece('white', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.035, 8, 5, {
    position: [0.055, 0.125, 0.197],
    scale: [1.08, 0.9, 0.28]
  }));
  addPiece('eye', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.014, 7, 5, {
    position: [-0.052, 0.122, 0.218],
    scale: [1.0, 1.0, 0.32]
  }));
  addPiece('eye', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.014, 7, 5, {
    position: [0.06, 0.13, 0.218],
    scale: [1.0, 1.0, 0.32]
  }));
  addPiece('hair', createRigidBox(bones.head, getBoneIndex('mixamorigHead'), [0.18, 0.025, 0.026], {
    position: [0, 0.07, 0.225]
  }));
  addPiece('white', createRigidBox(bones.head, getBoneIndex('mixamorigHead'), [0.12, 0.022, 0.016], {
    position: [0, 0.01, 0.226]
  }));
  addPiece('hair', createRigidBox(bones.head, getBoneIndex('mixamorigHead'), [0.17, 0.016, 0.015], {
    position: [0, 0.178, 0.192],
    rotation: [0, 0, 0.02]
  }));
  addPiece('skin', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.052, 8, 5, {
    position: [-0.17, 0.075, 0.04],
    scale: [0.58, 1.0, 0.82]
  }));
  addPiece('skin', createRigidSphere(bones.head, getBoneIndex('mixamorigHead'), 0.052, 8, 5, {
    position: [0.17, 0.075, 0.04],
    scale: [0.58, 1.0, 0.82]
  }));

  addPiece('uniform', createRigidCylinder(bones.head, getBoneIndex('mixamorigHead'), 0.155, 0.172, 0.08, 14, {
    position: [0, 0.25, 0.02],
    scale: [1.08, 1, 0.9]
  }));
  addPiece('uniformDark', createRigidCylinder(bones.head, getBoneIndex('mixamorigHead'), 0.172, 0.178, 0.028, 14, {
    position: [0, 0.203, 0.024],
    scale: [1.1, 1, 0.92]
  }));
  addPiece('uniformDark', createRigidBox(bones.head, getBoneIndex('mixamorigHead'), [0.215, 0.03, 0.145], {
    position: [0, 0.197, 0.156],
    rotation: [-0.1, 0, 0]
  }));
  addPiece('gold', createRigidCylinder(bones.head, getBoneIndex('mixamorigHead'), 0.035, 0.04, 0.012, 5, {
    position: [0, 0.218, 0.202],
    rotation: [Math.PI / 2, 0, Math.PI / 5],
    scale: [1.0, 1, 0.78]
  }));
  addPiece('gold', createRigidBox(bones.head, getBoneIndex('mixamorigHead'), [0.125, 0.012, 0.012], {
    position: [0, 0.258, 0.184]
  }));

  removeSourceMeshes(root);

  for (const [materialKey, geometries] of piecesByMaterial.entries()) {
    if (geometries.length === 0) {
      continue;
    }

    root.add(createMergedSkinnedMesh(
      geometries,
      materials[materialKey],
      `PoliceOfficer_${materialKey}`,
      skeleton,
      bindMatrix
    ));
  }

  return root;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPng(width, height, rgba) {
  const rows = [];
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(rgba.subarray(y * stride, (y + 1) * stride));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    createPngChunk('IEND')
  ]);
}

function writePixel(buffer, width, height, x, y, color) {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return;
  }
  const index = ((y * width) + x) * 4;
  buffer[index] = color[0];
  buffer[index + 1] = color[1];
  buffer[index + 2] = color[2];
  buffer[index + 3] = color[3] ?? 255;
}

function hexToRgba(hex, alpha = 255) {
  return [
    (hex >> 16) & 0xff,
    (hex >> 8) & 0xff,
    hex & 0xff,
    alpha
  ];
}

function fillEllipse(buffer, width, height, cx, cy, rx, ry, color) {
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if ((dx * dx) + (dy * dy) <= 1) {
        writePixel(buffer, width, height, x, y, color);
      }
    }
  }
}

function fillRect(buffer, width, height, x, y, w, h, color) {
  for (let yy = Math.floor(y); yy < Math.floor(y + h); yy += 1) {
    for (let xx = Math.floor(x); xx < Math.floor(x + w); xx += 1) {
      writePixel(buffer, width, height, xx, yy, color);
    }
  }
}

function drawPortraitPng() {
  const width = 220;
  const height = 220;
  const buffer = Buffer.alloc(width * height * 4);
  const transparent = [0, 0, 0, 0];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      writePixel(buffer, width, height, x, y, transparent);
    }
  }

  const navy = hexToRgba(COLORS.uniform);
  const navyDark = hexToRgba(COLORS.uniformDark);
  const skin = hexToRgba(COLORS.skin);
  const skinLight = hexToRgba(COLORS.skinLight);
  const white = hexToRgba(COLORS.white);
  const black = hexToRgba(COLORS.black);
  const gold = hexToRgba(COLORS.gold);
  const hair = hexToRgba(COLORS.hair);
  const cheek = hexToRgba(COLORS.cheek, 210);

  fillEllipse(buffer, width, height, 110, 172, 70, 58, navy);
  fillEllipse(buffer, width, height, 110, 148, 52, 36, navy);
  fillRect(buffer, width, height, 81, 137, 58, 54, hexToRgba(COLORS.uniformLight));
  fillRect(buffer, width, height, 103, 137, 14, 58, navyDark);
  fillEllipse(buffer, width, height, 85, 152, 12, 14, gold);

  fillEllipse(buffer, width, height, 110, 93, 51, 56, skin);
  fillEllipse(buffer, width, height, 110, 91, 31, 34, skinLight);
  fillEllipse(buffer, width, height, 69, 93, 11, 16, skin);
  fillEllipse(buffer, width, height, 151, 93, 11, 16, skin);
  fillEllipse(buffer, width, height, 90, 106, 11, 8, cheek);
  fillEllipse(buffer, width, height, 130, 106, 11, 8, cheek);
  fillEllipse(buffer, width, height, 94, 83, 10, 12, white);
  fillEllipse(buffer, width, height, 126, 83, 10, 12, white);
  fillEllipse(buffer, width, height, 96, 84, 4, 5, black);
  fillEllipse(buffer, width, height, 128, 85, 4, 5, black);
  fillEllipse(buffer, width, height, 110, 101, 13, 10, skin);
  fillRect(buffer, width, height, 87, 115, 46, 7, hair);
  fillRect(buffer, width, height, 94, 124, 32, 5, white);

  fillEllipse(buffer, width, height, 110, 53, 58, 19, navyDark);
  fillEllipse(buffer, width, height, 110, 43, 46, 24, navy);
  fillRect(buffer, width, height, 76, 57, 68, 15, navyDark);
  fillEllipse(buffer, width, height, 110, 64, 42, 8, navyDark);
  fillEllipse(buffer, width, height, 110, 59, 12, 14, gold);
  fillRect(buffer, width, height, 80, 36, 60, 5, gold);

  return createPng(width, height, buffer);
}

async function main() {
  await fs.mkdir(path.dirname(characterOutputPath), { recursive: true });
  await fs.mkdir(path.dirname(portraitOutputPath), { recursive: true });

  const root = await loadRig();
  const character = buildPoliceOfficerCharacter(root);
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(character, { binary: true });
  await fs.writeFile(characterOutputPath, Buffer.from(arrayBuffer));
  await fs.writeFile(portraitOutputPath, drawPortraitPng());

  console.log(`Generated ${path.relative(projectRoot, characterOutputPath)}`);
  console.log(`Generated ${path.relative(projectRoot, portraitOutputPath)}`);
}

await main();
