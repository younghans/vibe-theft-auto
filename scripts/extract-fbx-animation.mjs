import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { AnimationClip } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

globalThis.self = globalThis;
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

const [, , inputArg, outputArg, clipNameArg] = process.argv;
const NUMBERED_MIXAMO_PREFIX_PATTERN = /^mixamorig\d+(?=[A-Z])/;

if (!inputArg || !outputArg) {
  console.error('Usage: node scripts/extract-fbx-animation.mjs <input.fbx> <output.json> [clipName]');
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const bytes = await fs.readFile(inputPath);
const object = new FBXLoader().parse(getArrayBuffer(bytes), path.dirname(inputPath) + path.sep);
const sourceClip = object.animations.find((clip) => clip && Array.isArray(clip.tracks) && clip.tracks.length > 0);

if (!sourceClip) {
  throw new Error(`No usable animation clip found in ${inputPath}`);
}

const clip = sourceClip.clone();
clip.name = clipNameArg ?? clip.name ?? path.basename(inputPath, path.extname(inputPath));
for (const track of clip.tracks) {
  track.name = track.name.replace(NUMBERED_MIXAMO_PREFIX_PATTERN, 'mixamorig');
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(AnimationClip.toJSON(clip), null, 2));

console.log(`Saved animation clip to ${outputPath}`);
