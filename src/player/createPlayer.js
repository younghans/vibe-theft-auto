import * as THREE from 'three';
import { createInPlaceClip, ensureMixamoSockets, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip } from '../animation/mixamoClips.js';
import { assets } from '../world/assetManifest.js';

const PLAYER_HEIGHT = 4.5;
const PLAYER_SPEED = 15;
const PLAYER_RADIUS = 1.4;

function normalizeCharacter(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? PLAYER_HEIGHT / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
}

function hideUnusedMeshes(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function projectMoveOnCamera(camera, inputVector) {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  forward.multiplyScalar(-1);
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const movement = new THREE.Vector3();
  movement.addScaledVector(right, inputVector.x);
  movement.addScaledVector(forward, inputVector.z);

  if (movement.lengthSq() > 1) {
    movement.normalize();
  }

  return movement;
}

function collidesWithBoxes(candidate, boxes, radius) {
  return boxes.some((box) => (
    candidate.x > box.min.x - radius &&
    candidate.x < box.max.x + radius &&
    candidate.z > box.min.z - radius &&
    candidate.z < box.max.z + radius
  ));
}

function dampAngle(current, target, smoothing) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * smoothing;
}

function createPlayerIndicator() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.9, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf2c871,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  return ring;
}

export async function createPlayer(library) {
  const character = await library.instantiate(assets.player.character);
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Mixamo player character is invalid. Missing bones: ${humanoid.missingBones.join(', ')}`);
  }

  const sockets = ensureMixamoSockets(character);
  const walkClip = createInPlaceClip(getMixamoClip(assets.player.walkClip), MIXAMO_BONES.hips);
  const mixer = new THREE.AnimationMixer(character);
  const walkAction = mixer.clipAction(walkClip);
  walkAction.play();
  walkAction.enabled = true;
  walkAction.setEffectiveWeight(0);

  hideUnusedMeshes(character);
  normalizeCharacter(character);

  const anchor = new THREE.Group();
  const visual = new THREE.Group();
  visual.add(character);
  anchor.add(createPlayerIndicator());
  anchor.add(visual);

  let walkWeight = 0;
  return {
    object: anchor,
    radius: PLAYER_RADIUS,
    position: anchor.position,
    sockets,
    update(deltaSeconds, input, camera, collisionBoxes, cityBounds) {
      const rawInput = input.getMovementVector();
      const moving = rawInput.x !== 0 || rawInput.z !== 0;
      const movement = moving ? projectMoveOnCamera(camera, rawInput) : new THREE.Vector3();

      if (moving) {
        const step = PLAYER_SPEED * deltaSeconds;
        const proposedX = anchor.position.clone().addScaledVector(new THREE.Vector3(movement.x, 0, 0), step);
        if (!collidesWithBoxes(proposedX, collisionBoxes, PLAYER_RADIUS)) {
          anchor.position.x = THREE.MathUtils.clamp(proposedX.x, cityBounds.min.x, cityBounds.max.x);
        }

        const proposedZ = anchor.position.clone().addScaledVector(new THREE.Vector3(0, 0, movement.z), step);
        if (!collidesWithBoxes(proposedZ, collisionBoxes, PLAYER_RADIUS)) {
          anchor.position.z = THREE.MathUtils.clamp(proposedZ.z, cityBounds.min.z, cityBounds.max.z);
        }

        const targetYaw = Math.atan2(movement.x, movement.z);
        anchor.rotation.y = dampAngle(anchor.rotation.y, targetYaw, 0.18);
      }

      walkWeight = THREE.MathUtils.damp(walkWeight, moving ? 1 : 0, 12, deltaSeconds);
      walkAction.setEffectiveWeight(walkWeight);
      walkAction.setEffectiveTimeScale(moving ? 1 : 0.35);
      mixer.update(deltaSeconds);
      visual.position.y = 0;
      visual.rotation.z = 0;
      visual.rotation.x = 0;
    }
  };
}
