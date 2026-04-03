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
  head: 'mixamorigHead',
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

const REQUIRED_BONES = Object.values(MIXAMO_BONES);

export function validateMixamoHumanoid(root) {
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
    skinnedMeshes,
    bodyMeshes
  };
}

export function ensureMixamoSockets(root) {
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
