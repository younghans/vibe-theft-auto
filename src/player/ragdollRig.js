import * as THREE from 'three';
import { MIXAMO_BONES } from '../animation/humanoid.js';

export const RAGDOLL_RECOVER_DURATION = 0.38;
export const RAGDOLL_GRAVITY = new THREE.Vector3(0, -260, 0);
export const RAGDOLL_AIR_DAMPING = 0.992;
export const RAGDOLL_GROUND_FRICTION = 0.58;
export const RAGDOLL_GROUND_BOUNCE = 0.18;
export const RAGDOLL_SUBSTEP = 1 / 120;
export const RAGDOLL_CONSTRAINT_ITERATIONS = 7;
export const RAGDOLL_FLAIL_DURATION = 0.42;
export const RAGDOLL_FLAIL_FORCE = 160;
export const RAGDOLL_FLAIL_VERTICAL_FORCE = 105;
export const RAGDOLL_INITIAL_BODY_IMPULSE = 15;
export const RAGDOLL_INITIAL_ARM_IMPULSE = 26;
export const RAGDOLL_INITIAL_LEG_IMPULSE = 18;

export const RAGDOLL_NODE_DEFS = Object.freeze([
  { id: 'hips', boneName: MIXAMO_BONES.hips, radius: 0.26 },
  { id: 'spine', boneName: 'mixamorigSpine', radius: 0.24 },
  { id: 'spine1', boneName: 'mixamorigSpine1', radius: 0.23 },
  { id: 'spine2', boneName: 'mixamorigSpine2', radius: 0.22 },
  { id: 'neck', boneName: 'mixamorigNeck', radius: 0.18 },
  { id: 'head', boneName: MIXAMO_BONES.head, radius: 0.26 },
  { id: 'headEnd', boneName: 'mixamorigHeadTop_End', radius: 0.08 },
  { id: 'leftShoulder', boneName: 'mixamorigLeftShoulder', radius: 0.14 },
  { id: 'leftArm', boneName: 'mixamorigLeftArm', radius: 0.14 },
  { id: 'leftForeArm', boneName: 'mixamorigLeftForeArm', radius: 0.12 },
  { id: 'leftHand', boneName: 'mixamorigLeftHand', radius: 0.1 },
  { id: 'leftHandTip', boneName: 'mixamorigLeftHandMiddle1', radius: 0.06 },
  { id: 'rightShoulder', boneName: 'mixamorigRightShoulder', radius: 0.14 },
  { id: 'rightArm', boneName: 'mixamorigRightArm', radius: 0.14 },
  { id: 'rightForeArm', boneName: 'mixamorigRightForeArm', radius: 0.12 },
  { id: 'rightHand', boneName: 'mixamorigRightHand', radius: 0.1 },
  { id: 'rightHandTip', boneName: 'mixamorigRightHandMiddle1', radius: 0.06 },
  { id: 'leftUpLeg', boneName: 'mixamorigLeftUpLeg', radius: 0.17 },
  { id: 'leftLeg', boneName: 'mixamorigLeftLeg', radius: 0.15 },
  { id: 'leftFoot', boneName: 'mixamorigLeftFoot', radius: 0.12 },
  { id: 'leftToeBase', boneName: 'mixamorigLeftToeBase', radius: 0.08 },
  { id: 'leftToeEnd', boneName: 'mixamorigLeftToe_End', radius: 0.05 },
  { id: 'rightUpLeg', boneName: 'mixamorigRightUpLeg', radius: 0.17 },
  { id: 'rightLeg', boneName: 'mixamorigRightLeg', radius: 0.15 },
  { id: 'rightFoot', boneName: 'mixamorigRightFoot', radius: 0.12 },
  { id: 'rightToeBase', boneName: 'mixamorigRightToeBase', radius: 0.08 },
  { id: 'rightToeEnd', boneName: 'mixamorigRightToe_End', radius: 0.05 }
]);

export const RAGDOLL_LINK_DEFS = Object.freeze([
  ['hips', 'spine'],
  ['spine', 'spine1'],
  ['spine1', 'spine2'],
  ['spine2', 'neck'],
  ['neck', 'head'],
  ['head', 'headEnd'],
  ['spine2', 'leftShoulder'],
  ['leftShoulder', 'leftArm'],
  ['leftArm', 'leftForeArm'],
  ['leftForeArm', 'leftHand'],
  ['leftHand', 'leftHandTip'],
  ['spine2', 'rightShoulder'],
  ['rightShoulder', 'rightArm'],
  ['rightArm', 'rightForeArm'],
  ['rightForeArm', 'rightHand'],
  ['rightHand', 'rightHandTip'],
  ['hips', 'leftUpLeg'],
  ['leftUpLeg', 'leftLeg'],
  ['leftLeg', 'leftFoot'],
  ['leftFoot', 'leftToeBase'],
  ['leftToeBase', 'leftToeEnd'],
  ['hips', 'rightUpLeg'],
  ['rightUpLeg', 'rightLeg'],
  ['rightLeg', 'rightFoot'],
  ['rightFoot', 'rightToeBase'],
  ['rightToeBase', 'rightToeEnd']
]);

export const RAGDOLL_EXTRA_CONSTRAINTS = Object.freeze([
  ['leftShoulder', 'rightShoulder', 1],
  ['leftUpLeg', 'rightUpLeg', 1],
  ['leftShoulder', 'leftUpLeg', 0.7],
  ['rightShoulder', 'rightUpLeg', 0.7],
  ['leftShoulder', 'rightUpLeg', 0.45],
  ['rightShoulder', 'leftUpLeg', 0.45],
  ['leftHand', 'rightHand', 0.18],
  ['head', 'spine2', 0.55]
]);

export const RAGDOLL_BONE_DEFS = Object.freeze([
  { boneName: MIXAMO_BONES.hips, from: 'hips', to: 'spine', parentBoneName: null },
  { boneName: 'mixamorigSpine', from: 'spine', to: 'spine1', parentBoneName: MIXAMO_BONES.hips },
  { boneName: 'mixamorigSpine1', from: 'spine1', to: 'spine2', parentBoneName: 'mixamorigSpine' },
  { boneName: 'mixamorigSpine2', from: 'spine2', to: 'neck', parentBoneName: 'mixamorigSpine1' },
  { boneName: 'mixamorigNeck', from: 'neck', to: 'head', parentBoneName: 'mixamorigSpine2' },
  { boneName: MIXAMO_BONES.head, from: 'head', to: 'headEnd', parentBoneName: 'mixamorigNeck' },
  { boneName: 'mixamorigLeftShoulder', from: 'leftShoulder', to: 'leftArm', parentBoneName: 'mixamorigSpine2' },
  { boneName: 'mixamorigLeftArm', from: 'leftArm', to: 'leftForeArm', parentBoneName: 'mixamorigLeftShoulder' },
  { boneName: 'mixamorigLeftForeArm', from: 'leftForeArm', to: 'leftHand', parentBoneName: 'mixamorigLeftArm' },
  { boneName: 'mixamorigLeftHand', from: 'leftHand', to: 'leftHandTip', parentBoneName: 'mixamorigLeftForeArm' },
  { boneName: 'mixamorigRightShoulder', from: 'rightShoulder', to: 'rightArm', parentBoneName: 'mixamorigSpine2' },
  { boneName: 'mixamorigRightArm', from: 'rightArm', to: 'rightForeArm', parentBoneName: 'mixamorigRightShoulder' },
  { boneName: 'mixamorigRightForeArm', from: 'rightForeArm', to: 'rightHand', parentBoneName: 'mixamorigRightArm' },
  { boneName: 'mixamorigRightHand', from: 'rightHand', to: 'rightHandTip', parentBoneName: 'mixamorigRightForeArm' },
  { boneName: 'mixamorigLeftUpLeg', from: 'leftUpLeg', to: 'leftLeg', parentBoneName: MIXAMO_BONES.hips },
  { boneName: 'mixamorigLeftLeg', from: 'leftLeg', to: 'leftFoot', parentBoneName: 'mixamorigLeftUpLeg' },
  { boneName: 'mixamorigLeftFoot', from: 'leftFoot', to: 'leftToeBase', parentBoneName: 'mixamorigLeftLeg' },
  { boneName: 'mixamorigLeftToeBase', from: 'leftToeBase', to: 'leftToeEnd', parentBoneName: 'mixamorigLeftFoot' },
  { boneName: 'mixamorigRightUpLeg', from: 'rightUpLeg', to: 'rightLeg', parentBoneName: MIXAMO_BONES.hips },
  { boneName: 'mixamorigRightLeg', from: 'rightLeg', to: 'rightFoot', parentBoneName: 'mixamorigRightUpLeg' },
  { boneName: 'mixamorigRightFoot', from: 'rightFoot', to: 'rightToeBase', parentBoneName: 'mixamorigRightLeg' },
  { boneName: 'mixamorigRightToeBase', from: 'rightToeBase', to: 'rightToeEnd', parentBoneName: 'mixamorigRightFoot' }
]);

export const RAGDOLL_FLAIL_NODE_DEFS = Object.freeze([
  { id: 'head', lateral: 0.55, vertical: 0.4, forward: 0.3, multiplier: 0.8, phase: 0.2 },
  { id: 'leftShoulder', lateral: 0.8, vertical: 0.35, forward: 0.45, multiplier: 0.75, phase: 0.55 },
  { id: 'leftForeArm', lateral: 1.2, vertical: 0.9, forward: 0.5, multiplier: 1, phase: 1.1 },
  { id: 'leftHand', lateral: 1.55, vertical: 1.1, forward: 0.45, multiplier: 1.2, phase: 1.45 },
  { id: 'rightShoulder', lateral: -0.8, vertical: 0.3, forward: -0.35, multiplier: 0.65, phase: 2.1 },
  { id: 'rightForeArm', lateral: -1.15, vertical: 0.8, forward: -0.45, multiplier: 0.92, phase: 2.55 },
  { id: 'rightHand', lateral: -1.45, vertical: 0.95, forward: -0.55, multiplier: 1.08, phase: 2.95 },
  { id: 'leftUpLeg', lateral: -0.5, vertical: 0.15, forward: -0.9, multiplier: 0.7, phase: 3.35 },
  { id: 'leftLeg', lateral: -0.72, vertical: 0.2, forward: -1.05, multiplier: 0.88, phase: 3.8 },
  { id: 'leftFoot', lateral: -0.88, vertical: 0.42, forward: -1.25, multiplier: 1.05, phase: 4.1 },
  { id: 'rightUpLeg', lateral: 0.42, vertical: 0.12, forward: -0.68, multiplier: 0.62, phase: 4.45 },
  { id: 'rightLeg', lateral: 0.64, vertical: 0.15, forward: -0.96, multiplier: 0.8, phase: 4.85 },
  { id: 'rightFoot', lateral: 0.8, vertical: 0.36, forward: -1.1, multiplier: 0.96, phase: 5.2 }
]);
