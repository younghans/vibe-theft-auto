import * as THREE from 'three';

export const HUMANOID_ATTACHMENT_SOCKETS = Object.freeze({
  handRight: 'Socket_Hand_R',
  handLeft: 'Socket_Hand_L',
  back: 'Socket_Back'
});

export const HUMANOID_SOCKETS = Object.freeze({
  weaponRight: HUMANOID_ATTACHMENT_SOCKETS.handRight,
  weaponLeft: HUMANOID_ATTACHMENT_SOCKETS.handLeft,
  back: HUMANOID_ATTACHMENT_SOCKETS.back
});

export const MIXAMO_BONES = Object.freeze({
  hips: 'mixamorigHips',
  spine: 'mixamorigSpine',
  spineMiddle: 'mixamorigSpine1',
  neck: 'mixamorigNeck',
  head: 'mixamorigHead',
  rightShoulder: 'mixamorigRightShoulder',
  leftShoulder: 'mixamorigLeftShoulder',
  rightArm: 'mixamorigRightArm',
  leftArm: 'mixamorigLeftArm',
  rightForeArm: 'mixamorigRightForeArm',
  leftForeArm: 'mixamorigLeftForeArm',
  rightHand: 'mixamorigRightHand',
  leftHand: 'mixamorigLeftHand',
  spineUpper: 'mixamorigSpine2'
});

const NON_BODY_MESH_PATTERNS = [
  /face/iu,
  /hair/iu,
  /eyebrow/iu,
  /eyes/iu,
  /lash/iu
];

const REQUIRED_BONES = [
  MIXAMO_BONES.hips,
  MIXAMO_BONES.head,
  MIXAMO_BONES.rightHand,
  MIXAMO_BONES.leftHand,
  MIXAMO_BONES.spineUpper
];

function getCanonicalMixamoBoneName(name) {
  const match = /^mixamorig\d+(.+)$/.exec(name ?? '');
  if (!match) {
    return name;
  }

  return `mixamorig${match[1]}`;
}

function normalizeMixamoBoneNames(root) {
  const renamedBones = [];
  const occupiedNames = new Set();

  root.traverse((node) => {
    if (node?.name) {
      occupiedNames.add(node.name);
    }
  });

  root.traverse((node) => {
    if (!node?.isBone || !node.name) {
      return;
    }

    const canonicalName = getCanonicalMixamoBoneName(node.name);
    if (!canonicalName || canonicalName === node.name || occupiedNames.has(canonicalName)) {
      return;
    }

    occupiedNames.delete(node.name);
    occupiedNames.add(canonicalName);
    renamedBones.push({
      from: node.name,
      to: canonicalName
    });
    node.name = canonicalName;
  });

  return renamedBones;
}

export function validateMixamoHumanoid(root) {
  const renamedBones = normalizeMixamoBoneNames(root);
  const missingBones = REQUIRED_BONES.filter((boneName) => !root.getObjectByName(boneName));
  const skinnedMeshes = [];
  const bodyMeshes = [];

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      const meshName = node.name || '(unnamed skinned mesh)';
      skinnedMeshes.push(meshName);

      if (!NON_BODY_MESH_PATTERNS.some((pattern) => pattern.test(meshName))) {
        bodyMeshes.push(meshName);
      }
    }
  });

  return {
    isHumanoid: missingBones.length === 0 && bodyMeshes.length > 0,
    missingBones,
    renamedBones,
    skinnedMeshes,
    bodyMeshes
  };
}

export function ensureMixamoSockets(root) {
  normalizeMixamoBoneNames(root);
  const sockets = {};

  sockets.handRight = ensureSocket(root, MIXAMO_BONES.rightHand, HUMANOID_ATTACHMENT_SOCKETS.handRight);
  sockets.handLeft = ensureSocket(root, MIXAMO_BONES.leftHand, HUMANOID_ATTACHMENT_SOCKETS.handLeft);
  sockets.back = ensureSocket(root, MIXAMO_BONES.spineUpper, HUMANOID_ATTACHMENT_SOCKETS.back, new THREE.Vector3(0, 0.12, -0.18));
  sockets.weaponRight = sockets.handRight;
  sockets.weaponLeft = sockets.handLeft;

  return sockets;
}

export function createInPlaceClip(clip, rootBoneName) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const filteredTracks = clip.tracks
    .filter((track) => track.name !== `${rootBoneName}.position`)
    .map((track) => track.clone());

  return new THREE.AnimationClip(`${clip.name}_InPlace`, clip.duration, filteredTracks);
}

export function createBoneFilteredClip(clip, boneNames = [], clipName = `${clip?.name ?? 'Clip'}_Filtered`) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const allowedBoneNames = new Set(boneNames.filter(Boolean));
  const filteredTracks = clip.tracks
    .filter((track) => {
      const trackTarget = String(track.name ?? '').split('.')[0];
      return allowedBoneNames.has(trackTarget);
    })
    .map((track) => track.clone());

  return new THREE.AnimationClip(clipName, clip.duration, filteredTracks);
}

export function createPoseClip(clip, sampleTimeSeconds = 0, clipName = `${clip?.name ?? 'Clip'}_Pose`) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const clipDuration = Math.max(0, Number(clip.duration) || 0);
  const sampleTime = THREE.MathUtils.clamp(
    Number.isFinite(sampleTimeSeconds) ? sampleTimeSeconds : 0,
    0,
    clipDuration
  );
  const poseDuration = 1 / 30;
  const poseTracks = clip.tracks.map((track) => {
    const valueSize = track.getValueSize();
    const resultBuffer = new track.ValueBufferType(valueSize);
    const sampledValues = Array.from(track.createInterpolant(resultBuffer).evaluate(sampleTime)).slice(0, valueSize);
    const heldValues = [...sampledValues, ...sampledValues];
    return new track.constructor(track.name, [0, poseDuration], heldValues, track.getInterpolation());
  });

  return new THREE.AnimationClip(clipName, poseDuration, poseTracks);
}

function ensureSocket(root, boneName, socketName, position = null) {
  const bone = root.getObjectByName(boneName);

  if (!bone) {
    return null;
  }

  const existing = bone.getObjectByName(socketName);
  if (existing) {
    return existing;
  }

  const socket = new THREE.Group();
  socket.name = socketName;

  if (position) {
    socket.position.copy(position);
  }

  bone.add(socket);
  return socket;
}
