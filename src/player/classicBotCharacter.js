import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CLASSIC_BOT_COLORS = Object.freeze({
  skin: 0xc8a177,
  shirt: 0x6e7a34,
  pants: 0x2d8a4a,
  boots: 0x5a3a22,
  belt: 0x8c2318,
  cuffs: 0x79808a,
  hair: 0x7b5a2d,
  eyes: 0x24160f
});

const PRIMITIVE_UP = new THREE.Vector3(0, 1, 0);
const PART_SCALE = new THREE.Vector3(1, 1, 1);
const LOCAL_OFFSET = new THREE.Vector3();
const LOCAL_ROTATION = new THREE.Euler();
const LOCAL_QUATERNION = new THREE.Quaternion();
const LOCAL_MATRIX = new THREE.Matrix4();
const BONE_SPACE_MATRIX = new THREE.Matrix4();
const LOCAL_SCALE = new THREE.Vector3(1, 1, 1);
let sharedClassicBotMaterials = null;

function createClassicBotMaterials() {
  if (sharedClassicBotMaterials) {
    return sharedClassicBotMaterials;
  }

  const createMaterial = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true
  });

  sharedClassicBotMaterials = {
    skin: createMaterial(CLASSIC_BOT_COLORS.skin),
    shirt: createMaterial(CLASSIC_BOT_COLORS.shirt),
    pants: createMaterial(CLASSIC_BOT_COLORS.pants),
    boots: createMaterial(CLASSIC_BOT_COLORS.boots),
    belt: createMaterial(CLASSIC_BOT_COLORS.belt),
    cuffs: createMaterial(CLASSIC_BOT_COLORS.cuffs),
    hair: createMaterial(CLASSIC_BOT_COLORS.hair),
    eyes: createMaterial(CLASSIC_BOT_COLORS.eyes)
  };

  return sharedClassicBotMaterials;
}

function getPrimarySkinnedMesh(root) {
  let skinnedMesh = null;

  root.traverse((node) => {
    if (!skinnedMesh && node.isSkinnedMesh) {
      skinnedMesh = node;
    }
  });

  return skinnedMesh;
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
  LOCAL_ROTATION.set(rotation[0], rotation[1], rotation[2]);
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
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2], 1, 1, 1).toNonIndexed();
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createTaperedBoxGeometry(size, {
  topScale = [1, 1],
  bottomScale = [1, 1]
} = {}) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2], 1, 1, 1).toNonIndexed();
  const positions = geometry.attributes.position;
  const halfHeight = size[1] * 0.5;

  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const normalized = (y + halfHeight) / Math.max(0.0001, size[1]);
    const scaleX = THREE.MathUtils.lerp(bottomScale[0], topScale[0], normalized);
    const scaleZ = THREE.MathUtils.lerp(bottomScale[1], topScale[1], normalized);
    positions.setX(index, positions.getX(index) * scaleX);
    positions.setZ(index, positions.getZ(index) * scaleZ);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createRigidTaperedBox(bone, boneIndex, size, taper, options = {}) {
  const geometry = createTaperedBoxGeometry(size, taper);
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createRigidCylinder(bone, boneIndex, radiusTop, radiusBottom, height, radialSegments, options = {}) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false).toNonIndexed();
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createRigidSphere(bone, boneIndex, radius, widthSegments, heightSegments, options = {}) {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments).toNonIndexed();
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createRigidCapsule(bone, boneIndex, radius, length, capSegments, radialSegments, options = {}) {
  const geometry = new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments).toNonIndexed();
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createRigidCone(bone, boneIndex, radius, height, radialSegments, options = {}) {
  const geometry = new THREE.ConeGeometry(radius, height, radialSegments, 1, false).toNonIndexed();
  return finalizePartGeometry(geometry, bone, boneIndex, options);
}

function createRigidSegment(bone, childBone, boneIndex, width, depth, options = {}) {
  const segmentVector = childBone.position.clone();
  const segmentLength = Math.max(0.001, segmentVector.length());
  const geometry = new THREE.BoxGeometry(width, segmentLength, depth, 1, 1, 1).toNonIndexed();
  const segmentDirection = LOCAL_OFFSET.copy(segmentVector).normalize();
  const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(PRIMITIVE_UP, segmentDirection);
  const midpoint = segmentVector.multiplyScalar(0.5);
  const localOffset = options.offset ?? [0, 0, 0];
  const localRotation = options.rotation ?? [0, 0, 0];

  geometry.applyQuaternion(rotationQuaternion);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);

  return finalizePartGeometry(geometry, bone, boneIndex, {
    position: [
      localOffset[0] ?? 0,
      localOffset[1] ?? 0,
      localOffset[2] ?? 0
    ],
    rotation: localRotation,
    scale: options.scale ?? PART_SCALE
  });
}

function createRigidTaperedSegment(bone, childBone, boneIndex, size, taper, options = {}) {
  const segmentVector = childBone.position.clone();
  const segmentLength = Math.max(0.001, segmentVector.length());
  const geometry = createTaperedBoxGeometry([size[0], segmentLength, size[1]], taper);
  const segmentDirection = LOCAL_OFFSET.copy(segmentVector).normalize();
  const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(PRIMITIVE_UP, segmentDirection);
  const midpoint = segmentVector.multiplyScalar(0.5);
  const localOffset = options.offset ?? [0, 0, 0];
  const localRotation = options.rotation ?? [0, 0, 0];

  geometry.applyQuaternion(rotationQuaternion);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);

  return finalizePartGeometry(geometry, bone, boneIndex, {
    position: [
      localOffset[0] ?? 0,
      localOffset[1] ?? 0,
      localOffset[2] ?? 0
    ],
    rotation: localRotation,
    scale: options.scale ?? PART_SCALE
  });
}

function createMergedSkinnedMesh(geometries, material, name, skeleton, bindMatrix) {
  const mergedGeometry = mergeGeometries(geometries, false);
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();

  const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, bindMatrix);
  return mesh;
}

function hideSourceMeshes(root) {
  root.traverse((node) => {
    if (!node.isSkinnedMesh) {
      return;
    }

    node.visible = false;
    node.castShadow = false;
    node.receiveShadow = false;
  });
}

export function createClassicBotCharacter(root) {
  if (root.userData.classicBotBuilt) {
    return root;
  }

  const sourceMesh = getPrimarySkinnedMesh(root);
  if (!sourceMesh?.skeleton) {
    return root;
  }

  root.updateMatrixWorld(true);

  const skeleton = sourceMesh.skeleton;
  const bindMatrix = sourceMesh.bindMatrix.clone();
  const materials = createClassicBotMaterials();
  const piecesByMaterial = new Map();
  for (const key in materials) {
    if (Object.hasOwn(materials, key)) {
      piecesByMaterial.set(key, []);
    }
  }
  const boneIndexByName = new Map();
  for (let index = 0; index < skeleton.bones.length; index += 1) {
    const bone = skeleton.bones[index];
    if (bone?.name) {
      boneIndexByName.set(bone.name, index);
    }
  }
  const getBoneIndex = (boneName) => boneIndexByName.get(boneName) ?? -1;
  const getBone = (boneName) => skeleton.getBoneByName(boneName);
  const addPiece = (materialKey, geometry) => {
    if (geometry) {
      piecesByMaterial.get(materialKey)?.push(geometry);
    }
  };

  const hips = getBone('mixamorigHips');
  const spine = getBone('mixamorigSpine');
  const spineMiddle = getBone('mixamorigSpine1');
  const spineUpper = getBone('mixamorigSpine2');
  const neck = getBone('mixamorigNeck');
  const head = getBone('mixamorigHead');
  const headTop = getBone('mixamorigHeadTop_End');
  const rightShoulder = getBone('mixamorigRightShoulder');
  const leftShoulder = getBone('mixamorigLeftShoulder');
  const rightArm = getBone('mixamorigRightArm');
  const leftArm = getBone('mixamorigLeftArm');
  const rightForeArm = getBone('mixamorigRightForeArm');
  const leftForeArm = getBone('mixamorigLeftForeArm');
  const rightHand = getBone('mixamorigRightHand');
  const leftHand = getBone('mixamorigLeftHand');
  const rightUpLeg = getBone('mixamorigRightUpLeg');
  const leftUpLeg = getBone('mixamorigLeftUpLeg');
  const rightLeg = getBone('mixamorigRightLeg');
  const leftLeg = getBone('mixamorigLeftLeg');
  const rightFoot = getBone('mixamorigRightFoot');
  const leftFoot = getBone('mixamorigLeftFoot');
  const rightToe = getBone('mixamorigRightToeBase');
  const leftToe = getBone('mixamorigLeftToeBase');

  addPiece('shirt', createRigidCapsule(hips, getBoneIndex('mixamorigHips'), 8.2, 4.8, 3, 8, {
    position: [0, 2.8, 0.7],
    scale: [1.82, 1, 1.22]
  }));
  addPiece('belt', createRigidCylinder(hips, getBoneIndex('mixamorigHips'), 12.6, 13.3, 3.8, 8, {
    position: [0, 6.7, 0.8],
    scale: [1, 1, 0.62]
  }));
  addPiece('belt', createRigidBox(hips, getBoneIndex('mixamorigHips'), [7.2, 4.2, 2.8], {
    position: [5.2, 6.8, 6.2],
    rotation: [0.04, -0.3, 0]
  }));

  addPiece('shirt', createRigidCapsule(spine, getBoneIndex('mixamorigSpine'), 7.4, 3.9, 3, 8, {
    position: [0, 5.4, 0.9],
    scale: [1.92, 1, 1.2]
  }));
  addPiece('shirt', createRigidCapsule(spineMiddle, getBoneIndex('mixamorigSpine1'), 7.9, 4, 3, 8, {
    position: [0, 5.2, 1.2],
    scale: [2.02, 1, 1.24]
  }));
  addPiece('shirt', createRigidCapsule(spineUpper, getBoneIndex('mixamorigSpine2'), 8.3, 4.2, 3, 8, {
    position: [0, 6.4, 1.1],
    scale: [2.08, 1, 1.26]
  }));
  addPiece('shirt', createRigidCapsule(spineUpper, getBoneIndex('mixamorigSpine2'), 5.4, 2.2, 3, 8, {
    position: [0, 9.8, 5.1],
    scale: [2.22, 1, 1.02]
  }));
  addPiece('skin', createRigidBox(neck, getBoneIndex('mixamorigNeck'), [7.2, 5.6, 6], {
    position: [0, 3.8, 1.9]
  }));
  addPiece('skin', createRigidSphere(rightShoulder, getBoneIndex('mixamorigRightShoulder'), 3.8, 7, 5, {
    position: [0, 4.4, 0.3],
    scale: [1.08, 1.02, 1.06]
  }));
  addPiece('skin', createRigidSphere(leftShoulder, getBoneIndex('mixamorigLeftShoulder'), 3.8, 7, 5, {
    position: [0, 4.4, 0.3],
    scale: [1.08, 1.02, 1.06]
  }));

  addPiece('shirt', createRigidSphere(rightShoulder, getBoneIndex('mixamorigRightShoulder'), 5.8, 8, 6, {
    position: [0, 4.7, 0.2],
    scale: [1.34, 1.14, 1.2]
  }));
  addPiece('shirt', createRigidSphere(leftShoulder, getBoneIndex('mixamorigLeftShoulder'), 5.8, 8, 6, {
    position: [0, 4.7, 0.2],
    scale: [1.34, 1.14, 1.2]
  }));
  addPiece('shirt', createRigidCapsule(rightArm, getBoneIndex('mixamorigRightArm'), 5.1, 6.6, 2, 7, {
    position: [0, 5.5, 0.2],
    scale: [1.12, 0.76, 1.08]
  }));
  addPiece('shirt', createRigidCapsule(leftArm, getBoneIndex('mixamorigLeftArm'), 5.1, 6.6, 2, 7, {
    position: [0, 5.5, 0.2],
    scale: [1.12, 0.76, 1.08]
  }));
  addPiece('skin', createRigidCapsule(rightArm, getBoneIndex('mixamorigRightArm'), 4.2, 16.6, 2, 7, {
    position: [0, 10.6, 0.4],
    scale: [1.08, 0.92, 1.04]
  }));
  addPiece('skin', createRigidCapsule(leftArm, getBoneIndex('mixamorigLeftArm'), 4.2, 16.6, 2, 7, {
    position: [0, 10.6, 0.4],
    scale: [1.08, 0.92, 1.04]
  }));
  addPiece('skin', createRigidSphere(rightForeArm, getBoneIndex('mixamorigRightForeArm'), 4.25, 7, 5, {
    position: [0, 2.6, 0.3],
    scale: [1.1, 1.02, 1.04]
  }));
  addPiece('skin', createRigidSphere(leftForeArm, getBoneIndex('mixamorigLeftForeArm'), 4.25, 7, 5, {
    position: [0, 2.6, 0.3],
    scale: [1.1, 1.02, 1.04]
  }));
  addPiece('cuffs', createRigidCapsule(rightForeArm, getBoneIndex('mixamorigRightForeArm'), 4.15, 15.2, 2, 7, {
    position: [0, 10.1, 0.4],
    scale: [1.06, 0.88, 1.04]
  }));
  addPiece('cuffs', createRigidCapsule(leftForeArm, getBoneIndex('mixamorigLeftForeArm'), 4.15, 15.2, 2, 7, {
    position: [0, 10.1, 0.4],
    scale: [1.06, 0.88, 1.04]
  }));
  addPiece('cuffs', createRigidSphere(rightForeArm, getBoneIndex('mixamorigRightForeArm'), 4.15, 7, 5, {
    position: [0, 2.7, 0.35],
    scale: [1.04, 0.98, 1]
  }));
  addPiece('cuffs', createRigidSphere(leftForeArm, getBoneIndex('mixamorigLeftForeArm'), 4.15, 7, 5, {
    position: [0, 2.7, 0.35],
    scale: [1.04, 0.98, 1]
  }));
  addPiece('skin', createRigidSphere(rightHand, getBoneIndex('mixamorigRightHand'), 3.9, 7, 5, {
    position: [0, 3.1, 1.1],
    scale: [1.12, 0.94, 1.14]
  }));
  addPiece('skin', createRigidSphere(leftHand, getBoneIndex('mixamorigLeftHand'), 3.9, 7, 5, {
    position: [0, 3.1, 1.1],
    scale: [1.12, 0.94, 1.14]
  }));
  addPiece('skin', createRigidSphere(rightHand, getBoneIndex('mixamorigRightHand'), 2.8, 7, 5, {
    position: [0, 0.6, 0.8],
    scale: [1.06, 0.92, 1.04]
  }));
  addPiece('skin', createRigidSphere(leftHand, getBoneIndex('mixamorigLeftHand'), 2.8, 7, 5, {
    position: [0, 0.6, 0.8],
    scale: [1.06, 0.92, 1.04]
  }));

  addPiece('pants', createRigidSphere(rightUpLeg, getBoneIndex('mixamorigRightUpLeg'), 5.6, 7, 5, {
    position: [0, 3.4, 0.9],
    scale: [1.22, 1, 1.12]
  }));
  addPiece('pants', createRigidSphere(leftUpLeg, getBoneIndex('mixamorigLeftUpLeg'), 5.6, 7, 5, {
    position: [0, 3.4, 0.9],
    scale: [1.22, 1, 1.12]
  }));
  addPiece('pants', createRigidCapsule(rightUpLeg, getBoneIndex('mixamorigRightUpLeg'), 6.6, 20.4, 2, 7, {
    position: [0, 17.9, 0.9],
    scale: [1.2, 0.9, 1.14]
  }));
  addPiece('pants', createRigidCapsule(leftUpLeg, getBoneIndex('mixamorigLeftUpLeg'), 6.6, 20.4, 2, 7, {
    position: [0, 17.9, 0.9],
    scale: [1.2, 0.9, 1.14]
  }));
  addPiece('pants', createRigidCapsule(rightLeg, getBoneIndex('mixamorigRightLeg'), 5.6, 20.6, 2, 7, {
    position: [0, 17.8, 0.5],
    scale: [1.04, 0.92, 1.02]
  }));
  addPiece('pants', createRigidCapsule(leftLeg, getBoneIndex('mixamorigLeftLeg'), 5.6, 20.6, 2, 7, {
    position: [0, 17.8, 0.5],
    scale: [1.04, 0.92, 1.02]
  }));
  addPiece('pants', createRigidSphere(rightLeg, getBoneIndex('mixamorigRightLeg'), 5.2, 7, 5, {
    position: [0, 3.6, 0.4],
    scale: [1.08, 0.96, 1]
  }));
  addPiece('pants', createRigidSphere(leftLeg, getBoneIndex('mixamorigLeftLeg'), 5.2, 7, 5, {
    position: [0, 3.6, 0.4],
    scale: [1.08, 0.96, 1]
  }));
  addPiece('pants', createRigidCapsule(rightUpLeg, getBoneIndex('mixamorigRightUpLeg'), 5.1, 35.6, 2, 7, {
    position: [0, 27.2, 0.8],
    scale: [0.98, 0.92, 0.98]
  }));
  addPiece('pants', createRigidCapsule(leftUpLeg, getBoneIndex('mixamorigLeftUpLeg'), 5.1, 35.6, 2, 7, {
    position: [0, 27.2, 0.8],
    scale: [0.98, 0.92, 0.98]
  }));
  addPiece('pants', createRigidSphere(rightLeg, getBoneIndex('mixamorigRightLeg'), 5.1, 7, 5, {
    position: [0, 0.8, 0.4],
    scale: [1.04, 0.94, 1]
  }));
  addPiece('pants', createRigidSphere(leftLeg, getBoneIndex('mixamorigLeftLeg'), 5.1, 7, 5, {
    position: [0, 0.8, 0.4],
    scale: [1.04, 0.94, 1]
  }));
  addPiece('boots', createRigidCapsule(rightFoot, getBoneIndex('mixamorigRightFoot'), 4.8, 8.2, 2, 7, {
    position: [0, 7.2, 2.8],
    scale: [1.12, 0.84, 1.54]
  }));
  addPiece('boots', createRigidCapsule(leftFoot, getBoneIndex('mixamorigLeftFoot'), 4.8, 8.2, 2, 7, {
    position: [0, 7.2, 2.8],
    scale: [1.12, 0.84, 1.54]
  }));
  addPiece('boots', createRigidSphere(rightToe, getBoneIndex('mixamorigRightToeBase'), 4.7, 7, 5, {
    position: [0, 3, 4.4],
    scale: [1.16, 0.74, 1.5]
  }));
  addPiece('boots', createRigidSphere(leftToe, getBoneIndex('mixamorigLeftToeBase'), 4.7, 7, 5, {
    position: [0, 3, 4.4],
    scale: [1.16, 0.74, 1.5]
  }));
  addPiece('boots', createRigidSphere(rightFoot, getBoneIndex('mixamorigRightFoot'), 4.7, 7, 5, {
    position: [0, 1.8, 1.8],
    scale: [1.08, 0.86, 1.18]
  }));
  addPiece('boots', createRigidSphere(leftFoot, getBoneIndex('mixamorigLeftFoot'), 4.7, 7, 5, {
    position: [0, 1.8, 1.8],
    scale: [1.08, 0.86, 1.18]
  }));

  const headHeight = headTop ? Math.max(16, headTop.position.length() * 0.58) : 16;
  addPiece('skin', createRigidSphere(head, getBoneIndex('mixamorigHead'), 8.4, 8, 6, {
    position: [0, 9.8, 4],
    scale: [1.08, headHeight / 15.2, 1]
  }));
  addPiece('skin', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 6.2, 2.8, 2, 8, {
    position: [0, 4.4, 5.8],
    scale: [1.16, 0.86, 0.98]
  }));
  addPiece('skin', createRigidBox(head, getBoneIndex('mixamorigHead'), [2, 2.8, 2.6], {
    position: [0, 8.8, 9.6],
    rotation: [Math.PI / 2, Math.PI / 4, 0]
  }));
  addPiece('hair', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 6.1, 4.6, 2, 8, {
    position: [0, 5.2, 8.3],
    scale: [1.18, 0.9, 0.8],
    rotation: [0.12, 0, 0]
  }));
  addPiece('hair', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 2.1, 5.2, 2, 6, {
    position: [-5.2, 6.2, 6.5],
    rotation: [0.02, -0.08, 0.2],
    scale: [0.96, 1.06, 1.14]
  }));
  addPiece('hair', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 2.1, 5.2, 2, 6, {
    position: [5.2, 6.2, 6.5],
    rotation: [0.02, 0.08, -0.2],
    scale: [0.96, 1.06, 1.14]
  }));
  addPiece('hair', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 3.1, 4.2, 2, 7, {
    position: [0, 2.4, 7.8],
    scale: [1.12, 0.8, 1.04]
  }));
  addPiece('hair', createRigidCapsule(head, getBoneIndex('mixamorigHead'), 3.4, 1.6, 2, 7, {
    position: [0, 13.1, 5.5],
    scale: [1.2, 0.62, 0.94]
  }));
  addPiece('eyes', createRigidBox(head, getBoneIndex('mixamorigHead'), [5.4, 0.8, 0.7], {
    position: [0, 10.2, 9.15]
  }));
  addPiece('eyes', createRigidBox(head, getBoneIndex('mixamorigHead'), [1.6, 1.2, 0.7], {
    position: [-2.2, 8.8, 9.15]
  }));
  addPiece('eyes', createRigidBox(head, getBoneIndex('mixamorigHead'), [1.6, 1.2, 0.7], {
    position: [2.2, 8.8, 9.15]
  }));

  hideSourceMeshes(root);

  for (const materialKey of piecesByMaterial.keys()) {
    const geometries = piecesByMaterial.get(materialKey);
    if (geometries.length === 0) {
      continue;
    }

    root.add(
      createMergedSkinnedMesh(
        geometries,
        materials[materialKey],
        `ClassicBot_${materialKey}`,
        skeleton,
        bindMatrix
      )
    );
  }

  root.userData.classicBotBuilt = true;
  return root;
}
