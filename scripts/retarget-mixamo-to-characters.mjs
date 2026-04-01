import fs from 'node:fs/promises';
import path from 'node:path';

import { AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';

globalThis.self = globalThis;

const CHARACTER_GLB = 'D:/projects/stickrpg/assets/PolygonStarter-web/Characters.glb';
const SOURCE_FBX = 'D:/projects/stickrpg/animations/Walking.fbx';
const OUTPUT_JSON = 'D:/projects/stickrpg/assets/PolygonStarter-web/animations/Walking.retargeted.json';

const BONE_MAP = {
  Hips: 'mixamorigHips',
  Spine_01: 'mixamorigSpine',
  Spine_02: 'mixamorigSpine1',
  Spine_03: 'mixamorigSpine2',
  Neck: 'mixamorigNeck',
  Head: 'mixamorigHead',
  Clavicle_L: 'mixamorigLeftShoulder',
  Shoulder_L: 'mixamorigLeftArm',
  Elbow_L: 'mixamorigLeftForeArm',
  Hand_L: 'mixamorigLeftHand',
  Clavicle_R: 'mixamorigRightShoulder',
  Shoulder_R: 'mixamorigRightArm',
  Elbow_R: 'mixamorigRightForeArm',
  Hand_R: 'mixamorigRightHand',
  UpperLeg_L: 'mixamorigLeftUpLeg',
  LowerLeg_L: 'mixamorigLeftLeg',
  Ankle_L: 'mixamorigLeftFoot',
  Ball_L: 'mixamorigLeftToeBase',
  Toes_L: 'mixamorigLeftToe_End',
  UpperLeg_R: 'mixamorigRightUpLeg',
  LowerLeg_R: 'mixamorigRightLeg',
  Ankle_R: 'mixamorigRightFoot',
  Ball_R: 'mixamorigRightToeBase',
  Toes_R: 'mixamorigRightToe_End',
  Thumb_01: 'mixamorigLeftHandThumb1',
  Thumb_02: 'mixamorigLeftHandThumb2',
  Thumb_03: 'mixamorigLeftHandThumb3',
  IndexFinger_01: 'mixamorigLeftHandIndex1',
  IndexFinger_02: 'mixamorigLeftHandIndex2',
  IndexFinger_03: 'mixamorigLeftHandIndex3',
  Finger_01: 'mixamorigLeftHandMiddle1',
  Finger_02: 'mixamorigLeftHandMiddle2',
  Finger_03: 'mixamorigLeftHandMiddle3',
  Thumb_01_1: 'mixamorigRightHandThumb1',
  Thumb_02_1: 'mixamorigRightHandThumb2',
  Thumb_03_1: 'mixamorigRightHandThumb3',
  IndexFinger_01_1: 'mixamorigRightHandIndex1',
  IndexFinger_02_1: 'mixamorigRightHandIndex2',
  IndexFinger_03_1: 'mixamorigRightHandIndex3',
  Finger_01_1: 'mixamorigRightHandMiddle1',
  Finger_02_1: 'mixamorigRightHandMiddle2',
  Finger_03_1: 'mixamorigRightHandMiddle3'
};

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

async function loadFbx(filePath) {
  const loader = new FBXLoader();
  const bytes = await fs.readFile(filePath);
  return loader.parse(getArrayBuffer(bytes), path.dirname(filePath) + path.sep);
}

function getPrimarySkinnedMesh(root) {
  let firstMesh = null;
  root.traverse((node) => {
    if (!firstMesh && node.isSkinnedMesh) {
      firstMesh = node;
    }
  });
  if (!firstMesh) {
    throw new Error('No skinned mesh found.');
  }
  return firstMesh;
}

function renameTracksForBones(clip) {
  const renamedTracks = clip.tracks.map((track) => {
    const next = track.clone();
    next.name = next.name.replace(/^\.bones\[([^\]]+)\]\.(position|quaternion|scale)$/u, '$1.$2');
    return next;
  });

  return new AnimationClip(clip.name, clip.duration, renamedTracks);
}

const targetGltf = await loadGlb(CHARACTER_GLB);
const sourceFbx = await loadFbx(SOURCE_FBX);
const targetMesh = getPrimarySkinnedMesh(targetGltf.scene);
const sourceMesh = getPrimarySkinnedMesh(sourceFbx);
const sourceClip = sourceFbx.animations.find((clip) => clip.tracks.length > 0);

if (!sourceClip) {
  throw new Error('No usable animation clip found in source FBX.');
}

const retargeted = retargetClip(targetMesh, sourceMesh, sourceClip, {
  names: BONE_MAP,
  hip: 'mixamorigHips',
  preserveBonePositions: true,
  useFirstFramePosition: true
});

retargeted.name = 'Walking';

const runtimeClip = renameTracksForBones(retargeted);
const json = AnimationClip.toJSON(runtimeClip);

await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
await fs.writeFile(OUTPUT_JSON, JSON.stringify(json, null, 2));

console.log(`Saved retargeted clip to ${OUTPUT_JSON}`);
console.log(`Track count: ${runtimeClip.tracks.length}`);
console.log(`First tracks: ${runtimeClip.tracks.slice(0, 8).map((track) => track.name).join(', ')}`);
