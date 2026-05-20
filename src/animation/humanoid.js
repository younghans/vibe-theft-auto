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
  const missingBones = [];
  for (let index = 0; index < REQUIRED_BONES.length; index += 1) {
    const boneName = REQUIRED_BONES[index];
    if (!root.getObjectByName(boneName)) {
      missingBones.push(boneName);
    }
  }

  const skinnedMeshes = [];
  const bodyMeshes = [];

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      const meshName = node.name || '(unnamed skinned mesh)';
      skinnedMeshes.push(meshName);

      let isNonBodyMesh = false;
      for (let index = 0; index < NON_BODY_MESH_PATTERNS.length; index += 1) {
        if (NON_BODY_MESH_PATTERNS[index].test(meshName)) {
          isNonBodyMesh = true;
          break;
        }
      }

      if (!isNonBodyMesh) {
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

  const filteredTracks = [];
  const rootPositionTrackName = `${rootBoneName}.position`;
  for (let index = 0; index < clip.tracks.length; index += 1) {
    const track = clip.tracks[index];
    if (track.name !== rootPositionTrackName) {
      filteredTracks.push(track.clone());
    }
  }

  return new THREE.AnimationClip(`${clip.name}_InPlace`, clip.duration, filteredTracks);
}

export function createBoneFilteredClip(clip, boneNames = [], clipName = `${clip?.name ?? 'Clip'}_Filtered`) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const allowedBoneNames = new Set();
  for (let index = 0; index < boneNames.length; index += 1) {
    const boneName = boneNames[index];
    if (boneName) {
      allowedBoneNames.add(boneName);
    }
  }

  const filteredTracks = [];
  for (let index = 0; index < clip.tracks.length; index += 1) {
    const track = clip.tracks[index];
    if (allowedBoneNames.has(getTrackTarget(track.name))) {
      filteredTracks.push(track.clone());
    }
  }

  return new THREE.AnimationClip(clipName, clip.duration, filteredTracks);
}

export function createTargetFilteredClip(clip, root, clipName = `${clip?.name ?? 'Clip'}_TargetFiltered`) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const targetNames = new Set();
  root?.traverse?.((node) => {
    if (node?.name) {
      targetNames.add(node.name);
    }
  });

  const filteredTracks = [];
  for (let index = 0; index < clip.tracks.length; index += 1) {
    const track = clip.tracks[index];
    const trackTarget = getTrackTarget(track.name);
    if (!trackTarget || targetNames.has(trackTarget)) {
      filteredTracks.push(track.clone());
    }
  }

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
  const poseTracks = [];
  for (let index = 0; index < clip.tracks.length; index += 1) {
    const track = clip.tracks[index];
    const valueSize = track.getValueSize();
    const resultBuffer = new track.ValueBufferType(valueSize);
    const sampledValues = track.createInterpolant(resultBuffer).evaluate(sampleTime);
    const heldValues = new track.ValueBufferType(valueSize * 2);
    for (let valueIndex = 0; valueIndex < valueSize; valueIndex += 1) {
      const sampledValue = sampledValues[valueIndex];
      heldValues[valueIndex] = sampledValue;
      heldValues[valueIndex + valueSize] = sampledValue;
    }
    poseTracks.push(new track.constructor(track.name, [0, poseDuration], heldValues, track.getInterpolation()));
  }

  return new THREE.AnimationClip(clipName, poseDuration, poseTracks);
}

export function createMirroredClip(clip, boneNameMap = new Map(), clipName = `${clip?.name ?? 'Clip'}_Mirrored`) {
  if (!clip || !Array.isArray(clip.tracks)) {
    throw new Error(`Expected an animation clip with tracks, but received ${clip ? 'an invalid clip' : 'nothing'}.`);
  }

  const mirrorMatrix = new THREE.Matrix4().makeScale(-1, 1, 1);
  const sourceRotationMatrix = new THREE.Matrix4();
  const mirroredRotationMatrix = new THREE.Matrix4();
  const mirroredQuaternion = new THREE.Quaternion();
  const mirroredTracks = [];
  for (let trackIndex = 0; trackIndex < clip.tracks.length; trackIndex += 1) {
    const track = clip.tracks[trackIndex];
    const mirroredTrack = track.clone();
    const trackName = String(track.name ?? '');
    const propertySeparatorIndex = trackName.indexOf('.');
    const trackTarget = propertySeparatorIndex === -1 ? trackName : trackName.slice(0, propertySeparatorIndex);
    const propertyPath = propertySeparatorIndex === -1 ? '' : trackName.slice(propertySeparatorIndex + 1);
    const mirroredTarget = boneNameMap.get(trackTarget) ?? trackTarget;
    mirroredTrack.name = propertyPath ? `${mirroredTarget}.${propertyPath}` : mirroredTarget;

    if (propertyPath === 'quaternion') {
      for (let index = 0; index < mirroredTrack.values.length; index += 4) {
        mirroredQuaternion.fromArray(mirroredTrack.values, index).normalize();
        sourceRotationMatrix.makeRotationFromQuaternion(mirroredQuaternion);
        mirroredRotationMatrix.copy(mirrorMatrix).multiply(sourceRotationMatrix).multiply(mirrorMatrix);
        mirroredQuaternion.setFromRotationMatrix(mirroredRotationMatrix).normalize();
        mirroredTrack.values[index] = mirroredQuaternion.x;
        mirroredTrack.values[index + 1] = mirroredQuaternion.y;
        mirroredTrack.values[index + 2] = mirroredQuaternion.z;
        mirroredTrack.values[index + 3] = mirroredQuaternion.w;
      }
      mirroredTracks.push(mirroredTrack);
      continue;
    }

    if (propertyPath === 'position' || propertyPath === 'scale') {
      const valueSize = mirroredTrack.getValueSize();
      for (let index = 0; index < mirroredTrack.values.length; index += valueSize) {
        mirroredTrack.values[index] *= -1;
      }
    }

    mirroredTracks.push(mirroredTrack);
  }

  return new THREE.AnimationClip(clipName, clip.duration, mirroredTracks);
}

function getTrackTarget(trackName) {
  const normalizedTrackName = String(trackName ?? '');
  const propertySeparatorIndex = normalizedTrackName.indexOf('.');
  return propertySeparatorIndex === -1 ? normalizedTrackName : normalizedTrackName.slice(0, propertySeparatorIndex);
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
