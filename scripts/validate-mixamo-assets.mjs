import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

globalThis.self = globalThis;
globalThis.window = {
  URL: {
    createObjectURL() {
      return 'blob:mock';
    },
    revokeObjectURL() {}
  }
};
globalThis.document = {
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
globalThis.Image = class {};

const REQUIRED_BONES = [
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigRightHand',
  'mixamorigLeftHand',
  'mixamorigRightUpLeg',
  'mixamorigLeftUpLeg'
];

function getArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const [, , characterArg, clipArg] = process.argv;

if (!characterArg || !clipArg) {
  console.error('Usage: node scripts/validate-mixamo-assets.mjs <character.fbx> <clip.json>');
  process.exit(1);
}

const characterPath = path.resolve(characterArg);
const clipPath = path.resolve(clipArg);

const characterBytes = await fs.readFile(characterPath);
const character = new FBXLoader().parse(getArrayBuffer(characterBytes), path.dirname(characterPath) + path.sep);
const clipJson = JSON.parse(await fs.readFile(clipPath, 'utf8'));
const clip = THREE.AnimationClip.parse(clipJson);

const skinnedMeshes = [];
const boneNames = [];

character.traverse((node) => {
  if (node.isSkinnedMesh) {
    skinnedMeshes.push(node.name || '(unnamed skinned mesh)');
  }

  if (node.isBone && !boneNames.includes(node.name)) {
    boneNames.push(node.name);
  }
});

const missingBones = REQUIRED_BONES.filter((bone) => !boneNames.includes(bone));

if (skinnedMeshes.length === 0) {
  console.error(`No skinned meshes found in ${characterPath}`);
  process.exit(1);
}

if (missingBones.length > 0) {
  console.error(`Missing Mixamo bones in ${characterPath}: ${missingBones.join(', ')}`);
  process.exit(1);
}

if (!clip || !Array.isArray(clip.tracks) || clip.tracks.length === 0) {
  console.error(`No usable tracks found in ${clipPath}`);
  process.exit(1);
}

if (!clip.tracks.some((track) => track.name === 'mixamorigHips.position')) {
  console.error(`Expected mixamorigHips.position track in ${clipPath}`);
  process.exit(1);
}

console.log(`Validated Mixamo character: ${characterPath}`);
console.log(`Skinned meshes: ${skinnedMeshes.join(', ')}`);
console.log(`Validated Mixamo clip: ${clipPath}`);
console.log(`Track count: ${clip.tracks.length}`);
