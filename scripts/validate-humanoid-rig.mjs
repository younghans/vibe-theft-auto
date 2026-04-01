import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;

const REQUIRED_BONES = [
  'Hips',
  'Spine_01',
  'Spine_02',
  'Spine_03',
  'Neck',
  'Head',
  'Clavicle_L',
  'Shoulder_L',
  'Elbow_L',
  'Hand_L',
  'Clavicle_R',
  'Shoulder_R',
  'Elbow_R',
  'Hand_R',
  'UpperLeg_L',
  'LowerLeg_L',
  'Ankle_L',
  'UpperLeg_R',
  'LowerLeg_R',
  'Ankle_R'
];

const NON_BODY_MESH_PATTERNS = [
  /face/iu,
  /hair/iu,
  /eyebrow/iu,
  /eyes/iu,
  /lash/iu
];

function getArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadGlb(filePath) {
  const loader = new GLTFLoader();
  const bytes = await fs.readFile(filePath);
  return new Promise((resolve, reject) => {
    loader.parse(getArrayBuffer(bytes), '', resolve, reject);
  });
}

function listSkinnedMeshes(root) {
  const meshes = [];
  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      meshes.push(node);
    }
  });
  return meshes;
}

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-humanoid-rig.mjs <character.glb>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);
const gltf = await loadGlb(absolutePath);
const skinnedMeshes = listSkinnedMeshes(gltf.scene);

if (skinnedMeshes.length === 0) {
  console.error(`No skinned meshes found in ${absolutePath}`);
  process.exit(1);
}

const skeleton = skinnedMeshes[0].skeleton;
const boneNames = skeleton.bones.map((bone) => bone.name);
const missingBones = REQUIRED_BONES.filter((name) => !boneNames.includes(name));
const bodyMeshes = skinnedMeshes
  .map((mesh) => mesh.name)
  .filter((name) => !NON_BODY_MESH_PATTERNS.some((pattern) => pattern.test(name)));

console.log(`Validated ${absolutePath}`);
console.log(`Skinned meshes: ${skinnedMeshes.map((mesh) => mesh.name).join(', ')}`);
console.log(`Bone count: ${boneNames.length}`);

if (missingBones.length > 0) {
  console.error(`Missing required bones: ${missingBones.join(', ')}`);
  process.exit(1);
}

if (bodyMeshes.length === 0) {
  console.error('No full-body skinned mesh found. The asset appears to contain only face/hair meshes.');
  process.exit(1);
}

console.log('Required humanoid bones are present.');
