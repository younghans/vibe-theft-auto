import * as THREE from 'three';

export function normalizeNpcCharacter(root, targetHeight) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
}

export function markNpcRenderable(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

export function prepareNpcRenderObject(root, model, { enableShadows = true } = {}) {
  if (enableShadows) {
    markNpcRenderable(root);
  }

  normalizeNpcCharacter(root, model.height);
}
