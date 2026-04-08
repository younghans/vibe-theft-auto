import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { validateMixamoHumanoid } from '../src/animation/humanoid.js';

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

const humanoid = validateMixamoHumanoid(character);

if (humanoid.skinnedMeshes.length === 0) {
  console.error(`No skinned meshes found in ${characterPath}`);
  process.exit(1);
}

if (!humanoid.isHumanoid) {
  console.error(`Missing Mixamo bones in ${characterPath}: ${humanoid.missingBones.join(', ')}`);
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
console.log(`Skinned meshes: ${humanoid.skinnedMeshes.join(', ')}`);
if (humanoid.renamedBones.length > 0) {
  console.log(`Normalized bones: ${humanoid.renamedBones.map(({ from, to }) => `${from}->${to}`).join(', ')}`);
}
console.log(`Validated Mixamo clip: ${clipPath}`);
console.log(`Track count: ${clip.tracks.length}`);
