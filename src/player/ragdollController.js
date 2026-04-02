import * as THREE from 'three';
import { MIXAMO_BONES } from '../animation/humanoid.js';
import {
  RAGDOLL_AIR_DAMPING,
  RAGDOLL_BONE_DEFS,
  RAGDOLL_CONSTRAINT_ITERATIONS,
  RAGDOLL_EXTRA_CONSTRAINTS,
  RAGDOLL_FLAIL_DURATION,
  RAGDOLL_FLAIL_FORCE,
  RAGDOLL_FLAIL_NODE_DEFS,
  RAGDOLL_FLAIL_VERTICAL_FORCE,
  RAGDOLL_GRAVITY,
  RAGDOLL_GROUND_BOUNCE,
  RAGDOLL_GROUND_FRICTION,
  RAGDOLL_INITIAL_ARM_IMPULSE,
  RAGDOLL_INITIAL_BODY_IMPULSE,
  RAGDOLL_INITIAL_LEG_IMPULSE,
  RAGDOLL_LINK_DEFS,
  RAGDOLL_NODE_DEFS,
  RAGDOLL_RECOVER_DURATION,
  RAGDOLL_SUBSTEP
} from './ragdollRig.js';

function easeInOutSine(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

export function createRagdollController(character) {
  const worldPosition = new THREE.Vector3();
  const restDirection = new THREE.Vector3();
  const desiredDirection = new THREE.Vector3();
  const correction = new THREE.Vector3();
  const currentVelocity = new THREE.Vector3();
  const groundVelocity = new THREE.Vector3();
  const alignQuaternion = new THREE.Quaternion();
  const targetGlobalQuaternion = new THREE.Quaternion();
  const parentInverseQuaternion = new THREE.Quaternion();
  const targetLocalQuaternion = new THREE.Quaternion();
  const currentHipsPosition = new THREE.Vector3();
  const targetHipsPosition = new THREE.Vector3();
  const flailForce = new THREE.Vector3();

  character.updateMatrixWorld(true);

  const nodes = new Map();
  for (const nodeDef of RAGDOLL_NODE_DEFS) {
    const bone = character.getObjectByName(nodeDef.boneName);
    if (!bone) {
      continue;
    }

    bone.getWorldPosition(worldPosition);
    character.worldToLocal(worldPosition);
    nodes.set(nodeDef.id, {
      id: nodeDef.id,
      bone,
      radius: nodeDef.radius,
      basePosition: worldPosition.clone(),
      position: worldPosition.clone(),
      previousPosition: worldPosition.clone()
    });
  }

  const links = RAGDOLL_LINK_DEFS
    .map(([from, to]) => {
      const fromNode = nodes.get(from);
      const toNode = nodes.get(to);
      if (!fromNode || !toNode) {
        return null;
      }

      return {
        from,
        to,
        length: fromNode.basePosition.distanceTo(toNode.basePosition),
        stiffness: 1
      };
    })
    .filter(Boolean);

  const extraConstraints = RAGDOLL_EXTRA_CONSTRAINTS
    .map(([from, to, stiffness]) => {
      const fromNode = nodes.get(from);
      const toNode = nodes.get(to);
      if (!fromNode || !toNode) {
        return null;
      }

      return {
        from,
        to,
        length: fromNode.basePosition.distanceTo(toNode.basePosition),
        stiffness
      };
    })
    .filter(Boolean);

  const boneTargets = RAGDOLL_BONE_DEFS
    .map((boneDef) => {
      const bone = character.getObjectByName(boneDef.boneName);
      const fromNode = nodes.get(boneDef.from);
      const toNode = nodes.get(boneDef.to);
      if (!bone || !fromNode || !toNode) {
        return null;
      }

      bone.getWorldQuaternion(targetGlobalQuaternion);
      restDirection.copy(toNode.basePosition).sub(fromNode.basePosition).normalize();

      return {
        ...boneDef,
        bone,
        baseGlobalQuaternion: targetGlobalQuaternion.clone(),
        restDirection: restDirection.clone()
      };
    })
    .filter(Boolean);

  const targetLocalRotations = new Map();
  const targetGlobalRotations = new Map();
  const hipsBone = character.getObjectByName(MIXAMO_BONES.hips);
  const hipsBasePosition = hipsBone?.position.clone() ?? new THREE.Vector3();
  const state = {
    active: false,
    recovering: false,
    recoverTime: 0,
    side: 1,
    activeTime: 0
  };

  function chooseSide(startedAtMs = Date.now()) {
    return Math.floor(Math.abs(startedAtMs) / 137) % 2 === 0 ? 1 : -1;
  }

  function captureCurrentPose() {
    character.updateMatrixWorld(true);
    for (const node of nodes.values()) {
      node.bone.getWorldPosition(worldPosition);
      character.worldToLocal(worldPosition);
      node.position.copy(worldPosition);
      node.previousPosition.copy(worldPosition);
    }
  }

  function applyImpulse(nodeId, velocity) {
    const node = nodes.get(nodeId);
    if (!node) {
      return;
    }

    node.previousPosition.copy(node.position).addScaledVector(velocity, -1 / 60);
  }

  function solveConstraint(constraint) {
    const fromNode = nodes.get(constraint.from);
    const toNode = nodes.get(constraint.to);
    if (!fromNode || !toNode) {
      return;
    }

    correction.copy(toNode.position).sub(fromNode.position);
    const distance = correction.length();
    if (distance <= 1e-5) {
      return;
    }

    const difference = (distance - constraint.length) / distance;
    correction.multiplyScalar(0.5 * difference * constraint.stiffness);
    fromNode.position.add(correction);
    toNode.position.sub(correction);
  }

  function solveGround(node) {
    if (node.position.y >= node.radius) {
      return;
    }

    node.position.y = node.radius;
    groundVelocity.copy(node.position).sub(node.previousPosition);
    groundVelocity.x *= RAGDOLL_GROUND_FRICTION;
    groundVelocity.z *= RAGDOLL_GROUND_FRICTION;
    groundVelocity.y = Math.min(0, groundVelocity.y) * RAGDOLL_GROUND_BOUNCE;
    node.previousPosition.copy(node.position).sub(groundVelocity);
  }

  function applyFlail(stepDelta, currentTime) {
    const flailWeight = Math.max(0, 1 - (currentTime / RAGDOLL_FLAIL_DURATION));
    if (flailWeight <= 0) {
      return;
    }

    for (const flailDef of RAGDOLL_FLAIL_NODE_DEFS) {
      const node = nodes.get(flailDef.id);
      if (!node) {
        continue;
      }

      const phase = (currentTime * 18) + flailDef.phase;
      const lateral = Math.sin(phase * 1.7) * flailDef.lateral;
      const vertical = Math.abs(Math.cos(phase * 2.1)) * flailDef.vertical;
      const forward = Math.sin((phase * 1.15) + 0.9) * flailDef.forward;

      flailForce.set(
        lateral * RAGDOLL_FLAIL_FORCE,
        vertical * RAGDOLL_FLAIL_VERTICAL_FORCE,
        forward * RAGDOLL_FLAIL_FORCE
      ).multiplyScalar(flailWeight * flailDef.multiplier * stepDelta * stepDelta);

      node.position.add(flailForce);
    }
  }

  function simulate(deltaSeconds) {
    const clampedDelta = Math.min(deltaSeconds, 1 / 30);
    const stepCount = Math.max(1, Math.min(5, Math.ceil(clampedDelta / RAGDOLL_SUBSTEP)));
    const stepDelta = clampedDelta / stepCount;
    const gravityStep = RAGDOLL_GRAVITY.clone().multiplyScalar(stepDelta * stepDelta);

    for (let step = 0; step < stepCount; step += 1) {
      for (const node of nodes.values()) {
        currentVelocity.copy(node.position).sub(node.previousPosition).multiplyScalar(RAGDOLL_AIR_DAMPING);
        node.previousPosition.copy(node.position);
        node.position.add(currentVelocity).add(gravityStep);
      }

      if (state.active) {
        applyFlail(stepDelta, state.activeTime + (step * stepDelta));
      }

      for (let iteration = 0; iteration < RAGDOLL_CONSTRAINT_ITERATIONS; iteration += 1) {
        for (const link of links) {
          solveConstraint(link);
        }
        for (const constraint of extraConstraints) {
          solveConstraint(constraint);
        }
        for (const node of nodes.values()) {
          solveGround(node);
        }
      }
    }

    if (state.active) {
      state.activeTime += clampedDelta;
    }
  }

  return {
    activate({ startedAtMs = Date.now() } = {}) {
      captureCurrentPose();
      state.active = true;
      state.recovering = false;
      state.recoverTime = 0;
      state.side = chooseSide(startedAtMs);
      state.activeTime = Math.max(0, (Date.now() - startedAtMs) / 1000);

      const bodyImpulse = new THREE.Vector3(state.side * RAGDOLL_INITIAL_BODY_IMPULSE, -12, 3.8);
      const armImpulse = new THREE.Vector3(state.side * RAGDOLL_INITIAL_ARM_IMPULSE, 7.5, 3.2);
      const counterArmImpulse = new THREE.Vector3(state.side * -12, 4, -2.4);
      const legImpulse = new THREE.Vector3(state.side * -RAGDOLL_INITIAL_LEG_IMPULSE, 2.8, -9.6);
      const counterLegImpulse = new THREE.Vector3(state.side * 8.5, 1.2, -6.4);
      applyImpulse('spine2', bodyImpulse);
      applyImpulse('neck', bodyImpulse);
      applyImpulse('head', bodyImpulse);
      applyImpulse('leftShoulder', armImpulse);
      applyImpulse('leftForeArm', armImpulse.clone().multiplyScalar(1.18));
      applyImpulse('leftHand', armImpulse.clone().multiplyScalar(1.32));
      applyImpulse('rightShoulder', counterArmImpulse);
      applyImpulse('rightForeArm', counterArmImpulse.clone().multiplyScalar(0.92));
      applyImpulse('rightHand', counterArmImpulse.clone().multiplyScalar(1.08));
      applyImpulse('leftUpLeg', legImpulse);
      applyImpulse('leftLeg', legImpulse.clone().multiplyScalar(1.08));
      applyImpulse('leftFoot', legImpulse.clone().multiplyScalar(1.16));
      applyImpulse('rightUpLeg', counterLegImpulse);
      applyImpulse('rightLeg', counterLegImpulse.clone().multiplyScalar(0.94));
      applyImpulse('rightFoot', counterLegImpulse.clone().multiplyScalar(1.06));
    },
    deactivate() {
      if (!state.active && !state.recovering) {
        return false;
      }

      state.active = false;
      state.recovering = true;
      state.recoverTime = 0;
      return false;
    },
    update(deltaSeconds) {
      if (state.active || state.recovering) {
        simulate(deltaSeconds);
      }

      if (!state.recovering) {
        return;
      }

      state.recoverTime = Math.min(RAGDOLL_RECOVER_DURATION, state.recoverTime + deltaSeconds);
      if (state.recoverTime >= RAGDOLL_RECOVER_DURATION) {
        state.recovering = false;
      }
    },
    applyToSkeleton() {
      const blend = state.active
        ? 1
        : state.recovering
          ? 1 - easeInOutSine(THREE.MathUtils.clamp(state.recoverTime / RAGDOLL_RECOVER_DURATION, 0, 1))
          : 0;

      if (!hipsBone) {
        return false;
      }

      if (blend <= 0.001) {
        hipsBone.position.copy(hipsBasePosition);
        return false;
      }

      targetGlobalRotations.clear();
      targetLocalRotations.clear();

      for (const boneTarget of boneTargets) {
        const fromNode = nodes.get(boneTarget.from);
        const toNode = nodes.get(boneTarget.to);
        if (!fromNode || !toNode) {
          continue;
        }

        desiredDirection.copy(toNode.position).sub(fromNode.position);
        if (desiredDirection.lengthSq() <= 1e-6) {
          desiredDirection.copy(boneTarget.restDirection);
        } else {
          desiredDirection.normalize();
        }

        alignQuaternion.setFromUnitVectors(boneTarget.restDirection, desiredDirection);
        targetGlobalQuaternion.copy(alignQuaternion).multiply(boneTarget.baseGlobalQuaternion);
        targetGlobalRotations.set(boneTarget.boneName, targetGlobalQuaternion.clone());

        if (boneTarget.parentBoneName && targetGlobalRotations.has(boneTarget.parentBoneName)) {
          parentInverseQuaternion.copy(targetGlobalRotations.get(boneTarget.parentBoneName)).invert();
          targetLocalQuaternion.copy(parentInverseQuaternion).multiply(targetGlobalQuaternion);
        } else {
          targetLocalQuaternion.copy(targetGlobalQuaternion);
        }

        targetLocalRotations.set(boneTarget.boneName, targetLocalQuaternion.clone());
      }

      currentHipsPosition.copy(hipsBone.position);
      targetHipsPosition.copy(nodes.get('hips')?.position ?? hipsBasePosition);
      hipsBone.position.copy(currentHipsPosition.lerp(targetHipsPosition, blend));

      for (const boneTarget of boneTargets) {
        const targetLocalRotation = targetLocalRotations.get(boneTarget.boneName);
        if (!targetLocalRotation) {
          continue;
        }

        boneTarget.bone.quaternion.slerp(targetLocalRotation, blend);
      }

      return true;
    },
    isActive() {
      return state.active;
    }
  };
}
